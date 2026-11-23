import { NextResponse } from "next/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appUsers, attendanceRules, budgets, dailyFollowUps, dailyPlanTasks, dailyPlans, dailySiteReports, dayLaborWages,
  departments, documents, equipment, equipmentUsage, inventoryTransactions, materials, progressRecords, projectCosts,
  projects, purchaseOrders, purchaseRequests, qualityDefects, qualityInspections, safetyIncidents,
  safetyInspections, shifts, sites, suppliers, teamMembers, wagePayments, wageSettings, workPackages,
  workTeams, workTasks, workers as workforce,
} from "@/db/schema/enterprise";
import {
  ASSIGNEE_TYPES, BOOLEAN_OPTIONS, DOCUMENT_RESOURCE_CATEGORIES, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS,
  PAYMENT_FREQUENCIES, RECORD_STATUSES, TASK_PRIORITIES, TASK_STATUSES, TASK_STATUS_LABELS, WAGE_PAYMENT_STATUS_LABELS,
  type DocumentCategory, type ExpenseCategory, type TaskStatus,
} from "@/lib/domain";
import { isForeignKeyViolation, isUniqueConstraintViolation } from "@/lib/postgres-errors";
import { getWorkspaceCompanyId, getWorkspaceUserId } from "@/lib/workspace";
import { businessCodeError, isValidBusinessCode } from "@/lib/validation";
import {
  calculateWageTotals, getWageConfig, paymentStatusFor, resolveOvertimeRate, wageDisplayLabel, wageLabels,
} from "@/server/services/payroll";

class BadRequest extends Error {}

type Body = Record<string, unknown>;

function text(b: Body, key: string): string | null {
  const value = b[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(b: Body, key: string): string {
  const value = text(b, key);
  if (!value) throw new BadRequest(`${key} is required.`);
  return value;
}

function businessCode(b: Body, key: string, label: string): string {
  const value = requiredText(b, key);
  if (!isValidBusinessCode(value)) throw new BadRequest(businessCodeError(label));
  return value;
}

function numeric(b: Body, key: string, fallback?: string): string | null {
  const value = b[key];
  const raw = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  if (!raw) {
    if (fallback !== undefined) return fallback;
    if (value === null || value === undefined || value === "") return null;
    throw new BadRequest(`${key} must be a number.`);
  }
  if (Number.isNaN(Number(raw))) throw new BadRequest(`${key} must be a number.`);
  return raw;
}

function requiredNumber(b: Body, key: string): string {
  const value = numeric(b, key);
  if (value === null) throw new BadRequest(`${key} is required.`);
  return value;
}

function int(b: Body, key: string, required = true): number | null {
  const value = numeric(b, key);
  if (value === null) {
    if (required) throw new BadRequest(`${key} is required.`);
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new BadRequest(`${key} must be a positive integer.`);
  return parsed;
}

function date(b: Body, key: string, required = false): string | null {
  const value = text(b, key);
  if (!value) {
    if (required) throw new BadRequest(`${key} is required.`);
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequest(`${key} must be a date (YYYY-MM-DD).`);
  return value;
}

function timestamp(b: Body, key: string): Date {
  const value = text(b, key);
  if (!value) throw new BadRequest(`${key} is required.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequest(`${key} must be a valid date and time.`);
  return parsed;
}

function oneOf<T extends string>(b: Body, key: string, allowed: readonly T[], fallback?: T): T {
  const value = text(b, key);
  if (!value) {
    if (fallback) return fallback;
    throw new BadRequest(`${key} is required.`);
  }
  if (!allowed.includes(value as T)) throw new BadRequest(`${key} must be one of: ${allowed.join(", ")}.`);
  return value as T;
}

function nonNegativeInt(b: Body, key: string, fallback: number): number {
  const value = b[key];
  const raw = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw) || !Number.isInteger(Number(raw))) {
    throw new BadRequest(`${key} must be a non-negative integer.`);
  }
  return Number(raw);
}

function timeValue(b: Body, key: string): string {
  const value = requiredText(b, key);
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value)) throw new BadRequest(`${key} must be a time (HH:MM).`);
  return value;
}

function bool(b: Body, key: string, fallback: boolean): boolean {
  const value = b[key];
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const raw = String(value).trim().toLowerCase();
  if (!BOOLEAN_OPTIONS.includes(raw as (typeof BOOLEAN_OPTIONS)[number])) {
    throw new BadRequest(`${key} must be true or false.`);
  }
  return raw === "true";
}

const APPROVAL_STATES = ["draft", "submitted", "approved", "rejected", "cancelled"] as const;
const INVENTORY_MOVEMENTS = ["receipt", "issue", "return", "transfer_in", "transfer_out", "adjustment", "wastage"] as const;

type Resource = {
  list: (companyId: number) => Promise<unknown[]>;
  create: (b: Body, companyId: number) => Promise<unknown>;
};

/** All document sections share one table; the category is fixed by the endpoint. */
function documentResource(category: DocumentCategory): Resource {
  return {
    list: async (companyId) => {
      const rows = await db.select({
        document: documents,
        projectName: projects.name,
        uploadedByName: appUsers.fullName,
      }).from(documents)
        .leftJoin(projects, eq(documents.projectId, projects.id))
        .leftJoin(appUsers, eq(documents.uploadedBy, appUsers.id))
        .where(and(eq(documents.companyId, companyId), eq(documents.category, category)))
        .orderBy(desc(documents.createdAt), desc(documents.id));
      return rows.map(({ document, projectName, uploadedByName }) => ({
        ...document,
        projectName: projectName ?? (document.projectId ? `Project #${document.projectId}` : null),
        uploadedByName: uploadedByName ?? (document.uploadedBy ? `User #${document.uploadedBy}` : null),
      }));
    },
    create: async (b, companyId) => {
      const requestedVersion = nonNegativeInt(b, "version", 1);
      const [row] = await db.insert(documents).values({
        companyId,
        projectId: int(b, "projectId", false),
        category,
        title: requiredText(b, "title"),
        storageKey: requiredText(b, "storageKey"),
        mimeType: text(b, "mimeType") ?? "application/pdf",
        sizeBytes: nonNegativeInt(b, "sizeBytes", 0),
        version: requestedVersion > 0 ? requestedVersion : 1,
        uploadedBy: await getWorkspaceUserId(companyId),
      }).returning();
      return row;
    },
  };
}

const resources: Record<string, Resource> = {
  projects: {
    list: (companyId) => db.select().from(projects).where(eq(projects.companyId, companyId)).orderBy(desc(projects.id)),
    create: (b, companyId) => db.insert(projects).values({
      companyId,
      code: businessCode(b, "code", "Project code"),
      name: requiredText(b, "name"),
      clientName: text(b, "clientName"),
      location: text(b, "location"),
      status: oneOf(b, "status", ["planning", "active", "suspended", "completed", "cancelled"] as const, "planning"),
      budget: numeric(b, "budget", "0")!,
      startDate: date(b, "startDate"),
      plannedEndDate: date(b, "plannedEndDate"),
    }).returning().then(([row]) => row),
  },
  "work-packages": {
    list: (companyId) => db.select().from(workPackages).where(eq(workPackages.companyId, companyId)).orderBy(desc(workPackages.id)),
    create: (b, companyId) => db.insert(workPackages).values({
      companyId,
      projectId: int(b, "projectId")!,
      code: businessCode(b, "code", "Package code"),
      name: requiredText(b, "name"),
      plannedQuantity: numeric(b, "plannedQuantity", "0")!,
      unit: requiredText(b, "unit"),
      plannedStart: date(b, "plannedStart"),
      plannedEnd: date(b, "plannedEnd"),
    }).returning().then(([row]) => row),
  },
  "progress-records": {
    list: (companyId) => db.select().from(progressRecords).where(eq(progressRecords.companyId, companyId)).orderBy(desc(progressRecords.id)),
    create: (b, companyId) => db.insert(progressRecords).values({
      companyId,
      workPackageId: int(b, "workPackageId")!,
      recordedOn: date(b, "recordedOn", true)!,
      quantityCompleted: requiredNumber(b, "quantityCompleted"),
      notes: text(b, "notes"),
    }).returning().then(([row]) => row),
  },
  budgets: {
    list: async (companyId) => {
      const rows = await db.select().from(budgets)
        .leftJoin(projects, eq(budgets.projectId, projects.id))
        .where(eq(budgets.companyId, companyId))
        .orderBy(desc(budgets.id));
      return rows.map(({ project_budgets: budget, projects: project }) => {
        const projectName = project?.name ?? `Project #${budget.projectId}`;
        return { ...budget, projectName, displayLabel: `${projectName} · ${budget.costCode}` };
      });
    },
    create: (b, companyId) => db.insert(budgets).values({
      companyId,
      projectId: int(b, "projectId")!,
      costCode: businessCode(b, "costCode", "Cost code"),
      description: requiredText(b, "description"),
      plannedAmount: requiredNumber(b, "plannedAmount"),
    }).returning().then(([row]) => row),
  },
  "project-costs": {
    list: async (companyId) => {
      const rows = await db.select().from(projectCosts)
        .leftJoin(projects, eq(projectCosts.projectId, projects.id))
        .where(eq(projectCosts.companyId, companyId))
        .orderBy(desc(projectCosts.id));
      return rows.map(({ project_costs: cost, projects: project }) => ({
        ...cost,
        projectName: project?.name ?? `Project #${cost.projectId}`,
        expenseCategoryLabel: EXPENSE_CATEGORY_LABELS[cost.expenseCategory as ExpenseCategory] ?? cost.expenseCategory,
      }));
    },
    create: (b, companyId) => db.insert(projectCosts).values({
      companyId,
      projectId: int(b, "projectId")!,
      budgetId: int(b, "budgetId", false),
      category: requiredText(b, "category"),
      expenseCategory: oneOf(b, "expenseCategory", EXPENSE_CATEGORIES, "other"),
      description: text(b, "description"),
      amount: requiredNumber(b, "amount"),
      incurredOn: date(b, "incurredOn", true)!,
      reference: text(b, "reference"),
    }).returning().then(([row]) => row),
  },
  materials: {
    list: (companyId) => db.select().from(materials).where(eq(materials.companyId, companyId)).orderBy(desc(materials.id)),
    create: (b, companyId) => db.insert(materials).values({
      companyId,
      sku: businessCode(b, "sku", "SKU"),
      name: requiredText(b, "name"),
      unit: requiredText(b, "unit"),
      minimumStock: numeric(b, "minimumStock", "0")!,
    }).returning().then(([row]) => row),
  },
  "inventory-transactions": {
    list: (companyId) => db.select().from(inventoryTransactions).where(eq(inventoryTransactions.companyId, companyId)).orderBy(desc(inventoryTransactions.id)),
    create: (b, companyId) => db.insert(inventoryTransactions).values({
      companyId,
      materialId: int(b, "materialId")!,
      movement: oneOf(b, "movement", INVENTORY_MOVEMENTS),
      quantity: requiredNumber(b, "quantity"),
      unitCost: numeric(b, "unitCost"),
      notes: text(b, "notes"),
    }).returning().then(([row]) => row),
  },
  equipment: {
    list: (companyId) => db.select().from(equipment).where(eq(equipment.companyId, companyId)).orderBy(desc(equipment.id)),
    create: (b, companyId) => db.insert(equipment).values({
      companyId,
      equipmentNumber: businessCode(b, "equipmentNumber", "Equipment number"),
      name: requiredText(b, "name"),
      equipmentType: text(b, "equipmentType"),
    }).returning().then(([row]) => row),
  },
  "equipment-usage": {
    list: (companyId) => db.select().from(equipmentUsage).where(eq(equipmentUsage.companyId, companyId)).orderBy(desc(equipmentUsage.id)),
    create: (b, companyId) => db.insert(equipmentUsage).values({
      companyId,
      equipmentId: int(b, "equipmentId")!,
      usageDate: date(b, "usageDate", true)!,
      workingHours: numeric(b, "workingHours", "0")!,
      fuelLiters: numeric(b, "fuelLiters", "0")!,
      notes: text(b, "notes"),
    }).returning().then(([row]) => row),
  },
  "safety-incidents": {
    list: (companyId) => db.select().from(safetyIncidents).where(eq(safetyIncidents.companyId, companyId)).orderBy(desc(safetyIncidents.id)),
    create: (b, companyId) => db.insert(safetyIncidents).values({
      companyId,
      incidentNumber: businessCode(b, "incidentNumber", "Incident number"),
      incidentType: requiredText(b, "incidentType"),
      occurredAt: timestamp(b, "occurredAt"),
      severity: oneOf(b, "severity", ["low", "medium", "high", "critical"] as const, "medium"),
      description: requiredText(b, "description"),
      status: oneOf(b, "status", APPROVAL_STATES, "submitted"),
    }).returning().then(([row]) => row),
  },
  "quality-inspections": {
    list: (companyId) => db.select().from(qualityInspections).where(eq(qualityInspections.companyId, companyId)).orderBy(desc(qualityInspections.id)),
    create: (b, companyId) => db.insert(qualityInspections).values({
      companyId,
      projectId: int(b, "projectId")!,
      inspectionDate: date(b, "inspectionDate", true)!,
      result: oneOf(b, "result", ["pass", "fail", "conditional"] as const),
      notes: text(b, "notes"),
    }).returning().then(([row]) => row),
  },
  "quality-defects": {
    list: (companyId) => db.select().from(qualityDefects).where(eq(qualityDefects.companyId, companyId)).orderBy(desc(qualityDefects.id)),
    create: (b, companyId) => db.insert(qualityDefects).values({
      companyId,
      projectId: int(b, "projectId")!,
      inspectionId: int(b, "inspectionId", false),
      title: requiredText(b, "title"),
      description: text(b, "description"),
      severity: text(b, "severity"),
      status: oneOf(b, "status", APPROVAL_STATES, "submitted"),
      dueDate: date(b, "dueDate"),
    }).returning().then(([row]) => row),
  },
  "daily-plans": {
    list: (companyId) => db.select().from(dailyPlans).where(eq(dailyPlans.companyId, companyId)).orderBy(desc(dailyPlans.planDate), desc(dailyPlans.id)),
    create: (b, companyId) => db.insert(dailyPlans).values({
      companyId,
      projectId: int(b, "projectId", false),
      siteId: int(b, "siteId", false),
      planDate: date(b, "planDate", true)!,
      supervisorName: requiredText(b, "supervisorName"),
      requiredResources: text(b, "requiredResources"),
      notes: text(b, "notes"),
      status: oneOf(b, "status", APPROVAL_STATES, "draft"),
    }).returning().then(([row]) => row),
  },
  "daily-plan-tasks": {
    list: (companyId) => db.select().from(dailyPlanTasks).where(eq(dailyPlanTasks.companyId, companyId)).orderBy(desc(dailyPlanTasks.id)),
    create: (b, companyId) => db.insert(dailyPlanTasks).values({
      companyId,
      planId: int(b, "planId")!,
      task: requiredText(b, "task"),
      deadline: date(b, "deadline"),
      assignee: text(b, "assignee"),
      requiredResources: text(b, "requiredResources"),
      status: text(b, "status") ?? "planned",
    }).returning().then(([row]) => row),
  },
  "daily-site-reports": {
    list: (companyId) => db.select().from(dailySiteReports).where(eq(dailySiteReports.companyId, companyId)).orderBy(desc(dailySiteReports.reportDate), desc(dailySiteReports.id)),
    create: (b, companyId) => db.insert(dailySiteReports).values({
      companyId,
      projectId: int(b, "projectId", false),
      siteId: int(b, "siteId", false),
      planId: int(b, "planId", false),
      reportDate: date(b, "reportDate", true)!,
      supervisorName: requiredText(b, "supervisorName"),
      completedWork: requiredText(b, "completedWork"),
      progressPercent: requiredNumber(b, "progressPercent"),
      photos: text(b, "photos"),
      challenges: text(b, "challenges"),
      delays: text(b, "delays"),
      status: oneOf(b, "status", APPROVAL_STATES, "submitted"),
      reviewNotes: text(b, "reviewNotes"),
    }).returning().then(([row]) => row),
  },
  "daily-follow-ups": {
    list: (companyId) => db.select().from(dailyFollowUps).where(eq(dailyFollowUps.companyId, companyId)).orderBy(desc(dailyFollowUps.id)),
    create: (b, companyId) => db.insert(dailyFollowUps).values({
      companyId,
      reportId: int(b, "reportId", false),
      projectId: int(b, "projectId", false),
      siteId: int(b, "siteId", false),
      issue: requiredText(b, "issue"),
      action: requiredText(b, "action"),
      assignedTo: text(b, "assignedTo"),
      dueDate: date(b, "dueDate"),
      status: oneOf(b, "status", ["open", "in_progress", "done", "cancelled"] as const, "open"),
      notes: text(b, "notes"),
    }).returning().then(([row]) => row),
  },
  "safety-inspections": {
    list: (companyId) => db.select().from(safetyInspections).where(eq(safetyInspections.companyId, companyId)).orderBy(desc(safetyInspections.inspectionDate), desc(safetyInspections.id)),
    create: (b, companyId) => db.insert(safetyInspections).values({
      companyId,
      projectId: int(b, "projectId", false),
      siteId: int(b, "siteId", false),
      inspectionDate: date(b, "inspectionDate", true)!,
      inspectorName: requiredText(b, "inspectorName"),
      hazards: text(b, "hazards"),
      incidentsObserved: text(b, "incidentsObserved"),
      correctiveActions: text(b, "correctiveActions"),
      status: oneOf(b, "status", APPROVAL_STATES, "submitted"),
      notes: text(b, "notes"),
    }).returning().then(([row]) => row),
  },
  workforce: {
    list: (companyId) => db.select().from(workforce).where(eq(workforce.companyId, companyId)).orderBy(workforce.fullName).then((rows) =>
      rows.map((row) => ({ ...row, displayLabel: `${row.fullName} (${row.workerCode})` }))),
    create: (b, companyId) => db.insert(workforce).values({
      companyId,
      workerCode: businessCode(b, "workerCode", "Worker code"),
      fullName: requiredText(b, "fullName"),
      phone: text(b, "phone"),
      employmentType: oneOf(b, "employmentType", ["employee", "day_labor", "contractor"] as const, "employee"),
      dailyRate: numeric(b, "dailyRate", "0")!,
    }).returning().then(([row]) => row),
  },
  teams: {
    list: (companyId) => db.select().from(workTeams).where(eq(workTeams.companyId, companyId)).orderBy(workTeams.name).then((rows) =>
      rows.map((row) => ({ ...row, displayLabel: `${row.name} (${row.code})` }))),
    create: (b, companyId) => db.insert(workTeams).values({
      companyId,
      code: requiredText(b, "code"),
      name: requiredText(b, "name"),
      supervisorName: text(b, "supervisorName"),
      notes: text(b, "notes"),
    }).returning().then(([row]) => row),
  },
  "team-members": {
    list: async (companyId) => {
      const rows = await db.select().from(teamMembers)
        .leftJoin(workTeams, eq(teamMembers.teamId, workTeams.id))
        .leftJoin(workforce, eq(teamMembers.workerId, workforce.id))
        .where(eq(teamMembers.companyId, companyId))
        .orderBy(desc(teamMembers.id));
      return rows.map(({ team_members: member, work_teams: team, workforce: worker }) => ({
        ...member,
        teamName: team?.name ?? `Team #${member.teamId}`,
        workerName: worker?.fullName ?? `Worker #${member.workerId}`,
      }));
    },
    create: (b, companyId) => db.insert(teamMembers).values({
      companyId,
      teamId: int(b, "teamId")!,
      workerId: int(b, "workerId")!,
    }).returning().then(([row]) => row),
  },
  "work-tasks": {
    list: async (companyId) => {
      const rows = await db.select().from(workTasks)
        .leftJoin(workforce, eq(workTasks.workerId, workforce.id))
        .leftJoin(workTeams, eq(workTasks.teamId, workTeams.id))
        .where(eq(workTasks.companyId, companyId))
        .orderBy(sql`${workTasks.deadline} asc nulls last`, desc(workTasks.id));
      return rows.map(({ work_tasks: task, workforce: worker, work_teams: team }) => ({
        ...task,
        assigneeName: task.assigneeType === "worker"
          ? (worker?.fullName ?? `Worker #${task.workerId}`)
          : (team?.name ?? `Team #${task.teamId}`),
        statusLabel: TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status,
      }));
    },
    create: async (b, companyId) => {
      const assigneeType = oneOf(b, "assigneeType", ASSIGNEE_TYPES, "worker");
      const [row] = await db.insert(workTasks).values({
        companyId,
        projectId: int(b, "projectId", false),
        siteId: int(b, "siteId", false),
        title: requiredText(b, "title"),
        description: text(b, "description"),
        assigneeType,
        workerId: assigneeType === "worker" ? int(b, "workerId") : null,
        teamId: assigneeType === "team" ? int(b, "teamId") : null,
        supervisorName: requiredText(b, "supervisorName"),
        priority: oneOf(b, "priority", TASK_PRIORITIES, "normal"),
        status: oneOf(b, "status", TASK_STATUSES, "pending"),
        deadline: date(b, "deadline"),
      }).returning();
      return row;
    },
  },
  "day-labor-wages": {
    list: async (companyId) => {
      const [rows, labels] = await Promise.all([
        db.select().from(dayLaborWages).where(eq(dayLaborWages.companyId, companyId)).orderBy(desc(dayLaborWages.periodEnd), desc(dayLaborWages.id)),
        wageLabels(companyId),
      ]);
      return rows.map((row) => ({
        ...row,
        ...calculateWageTotals(row),
        paymentStatusLabel: WAGE_PAYMENT_STATUS_LABELS[row.paymentStatus] ?? row.paymentStatus,
        displayLabel: wageDisplayLabel(row, labels),
      }));
    },
    create: async (b, companyId) => {
      const periodStart = date(b, "periodStart", true)!;
      const periodEnd = date(b, "periodEnd", true)!;
      if (periodEnd < periodStart) throw new BadRequest("periodEnd must be on or after periodStart.");

      const config = await getWageConfig(companyId);
      const dailyRate = requiredNumber(b, "dailyRate");
      const overtimeRate = resolveOvertimeRate(dailyRate, numeric(b, "overtimeRate"), config);
      const totals = calculateWageTotals({
        workingDays: requiredNumber(b, "workingDays"),
        dailyRate,
        overtimeHours: numeric(b, "overtimeHours", "0"),
        overtimeRate,
        approvedOvertime: numeric(b, "approvedOvertime", "0"),
        approvedDeductions: numeric(b, "approvedDeductions", "0"),
      }, config);
      const [row] = await db.insert(dayLaborWages).values({
        companyId,
        workerId: int(b, "workerId")!,
        periodStart,
        periodEnd,
        workingDays: requiredNumber(b, "workingDays"),
        dailyRate,
        overtimeHours: numeric(b, "overtimeHours", "0")!,
        overtimeRate,
        approvedOvertime: numeric(b, "approvedOvertime", "0")!,
        approvedDeductions: numeric(b, "approvedDeductions", "0")!,
        total: totals.netPay.toFixed(2),
        status: oneOf(b, "status", APPROVAL_STATES, "draft"),
      }).returning();
      return row;
    },
  },
  "wage-payments": {
    list: async (companyId) => {
      const [rows, labels] = await Promise.all([
        db.select().from(wagePayments).where(eq(wagePayments.companyId, companyId)).orderBy(desc(wagePayments.paymentDate), desc(wagePayments.id)),
        wageLabels(companyId),
      ]);
      const wages = await db.select().from(dayLaborWages).where(eq(dayLaborWages.companyId, companyId));
      const wagesById = new Map(wages.map((wage) => [wage.id, wage]));
      return rows.map((row) => {
        const wage = wagesById.get(row.wageId);
        return { ...row, wageLabel: wage ? wageDisplayLabel(wage, labels) : `Wage #${row.wageId}` };
      });
    },
    create: async (b, companyId) => {
      const wageId = int(b, "wageId")!;
      const amount = requiredNumber(b, "amount");
      if (Number(amount) <= 0) throw new BadRequest("amount must be greater than zero.");

      return db.transaction(async (tx) => {
        const [wage] = await tx.select().from(dayLaborWages)
          .where(and(eq(dayLaborWages.id, wageId), eq(dayLaborWages.companyId, companyId)));
        if (!wage) throw new BadRequest("Wage record not found.");

        const [payment] = await tx.insert(wagePayments).values({
          companyId,
          wageId,
          amount,
          paymentDate: date(b, "paymentDate", true)!,
          method: text(b, "method") ?? "cash",
          reference: text(b, "reference"),
          notes: text(b, "notes"),
        }).returning();

        const [aggregate] = await tx.select({ paid: sql<string>`coalesce(sum(${wagePayments.amount}), 0)` })
          .from(wagePayments)
          .where(and(eq(wagePayments.wageId, wageId), eq(wagePayments.companyId, companyId)));
        const paidAmount = Number(aggregate?.paid ?? 0);
        const status = paymentStatusFor(paidAmount, wage.total);
        await tx.update(dayLaborWages).set({
          paidAmount: paidAmount.toFixed(2),
          paymentStatus: status,
          paidAt: status === "paid" ? new Date() : null,
          updatedAt: new Date(),
        }).where(and(eq(dayLaborWages.id, wageId), eq(dayLaborWages.companyId, companyId)));

        return payment;
      });
    },
  },
  sites: {
    list: async (companyId) => {
      const rows = await db.select().from(sites)
        .leftJoin(projects, eq(sites.projectId, projects.id))
        .where(eq(sites.companyId, companyId))
        .orderBy(desc(sites.id));
      return rows.map(({ project_sites: site, projects: project }) => ({
        ...site,
        projectName: project?.name ?? `Project #${site.projectId}`,
      }));
    },
    create: (b, companyId) => db.insert(sites).values({
      companyId,
      projectId: int(b, "projectId")!,
      code: requiredText(b, "code"),
      name: requiredText(b, "name"),
      location: text(b, "location"),
      status: oneOf(b, "status", RECORD_STATUSES, "active"),
    }).returning().then(([row]) => row),
  },
  departments: {
    list: (companyId) => db.select().from(departments)
      .where(eq(departments.companyId, companyId))
      .orderBy(departments.name, departments.id),
    create: (b, companyId) => db.insert(departments).values({
      companyId,
      branchId: int(b, "branchId", false),
      parentId: int(b, "parentId", false),
      code: requiredText(b, "code"),
      name: requiredText(b, "name"),
    }).returning().then(([row]) => row),
  },
  shifts: {
    list: (companyId) => db.select().from(shifts)
      .where(eq(shifts.companyId, companyId))
      .orderBy(shifts.startsAt, shifts.name),
    create: (b, companyId) => db.insert(shifts).values({
      companyId,
      name: requiredText(b, "name"),
      startsAt: timeValue(b, "startsAt"),
      endsAt: timeValue(b, "endsAt"),
      breakMinutes: nonNegativeInt(b, "breakMinutes", 0),
    }).returning().then(([row]) => row),
  },
  "attendance-rules": {
    list: (companyId) => db.select().from(attendanceRules)
      .where(eq(attendanceRules.companyId, companyId))
      .orderBy(desc(attendanceRules.id)),
    create: (b, companyId) => db.insert(attendanceRules).values({
      companyId,
      name: requiredText(b, "name"),
      shiftId: int(b, "shiftId", false),
      lateAfterMinutes: nonNegativeInt(b, "lateAfterMinutes", 15),
      earlyLeaveAfterMinutes: nonNegativeInt(b, "earlyLeaveAfterMinutes", 15),
      overtimeStartsAfterMinutes: nonNegativeInt(b, "overtimeStartsAfterMinutes", 480),
      standardHoursPerDay: numeric(b, "standardHoursPerDay", "8")!,
      markAbsentAfterMinutes: nonNegativeInt(b, "markAbsentAfterMinutes", 60),
      isActive: bool(b, "isActive", true),
    }).returning().then(([row]) => row),
  },
  "wage-settings": {
    list: (companyId) => db.select().from(wageSettings)
      .where(eq(wageSettings.companyId, companyId))
      .orderBy(desc(wageSettings.id)),
    create: (b, companyId) => db.insert(wageSettings).values({
      companyId,
      name: requiredText(b, "name"),
      currency: (text(b, "currency") ?? "ETB").toUpperCase().slice(0, 3),
      regularHoursPerDay: numeric(b, "regularHoursPerDay", "8")!,
      overtimeMultiplier: numeric(b, "overtimeMultiplier", "1.5")!,
      paymentFrequency: oneOf(b, "paymentFrequency", PAYMENT_FREQUENCIES, "weekly"),
      defaultDailyRate: numeric(b, "defaultDailyRate", "0")!,
      isActive: bool(b, "isActive", true),
    }).returning().then(([row]) => row),
  },
  suppliers: {
    list: (companyId) => db.select().from(suppliers)
      .where(eq(suppliers.companyId, companyId))
      .orderBy(asc(suppliers.name), asc(suppliers.id)),
    create: (b, companyId) => db.insert(suppliers).values({
      companyId,
      name: requiredText(b, "name"),
      contactName: text(b, "contactName"),
      email: text(b, "email"),
      phone: text(b, "phone"),
      address: text(b, "address"),
    }).returning().then(([row]) => row),
  },
  "purchase-requests": {
    list: async (companyId) => {
      const rows = await db.select().from(purchaseRequests)
        .leftJoin(appUsers, eq(purchaseRequests.requestedBy, appUsers.id))
        .leftJoin(projects, eq(purchaseRequests.projectId, projects.id))
        .where(eq(purchaseRequests.companyId, companyId))
        .orderBy(desc(purchaseRequests.id));
      return rows.map(({ purchase_requests: request, app_users: user, projects: project }) => ({
        ...request,
        requesterName: user?.fullName ?? `User #${request.requestedBy}`,
        projectName: project?.name ?? (request.projectId ? `Project #${request.projectId}` : null),
      }));
    },
    create: async (b, companyId) => {
      const [row] = await db.insert(purchaseRequests).values({
        companyId,
        projectId: int(b, "projectId", false),
        requestedBy: await getWorkspaceUserId(companyId),
        requestNumber: requiredText(b, "requestNumber"),
        status: oneOf(b, "status", APPROVAL_STATES, "draft"),
        requiredBy: date(b, "requiredBy"),
        justification: text(b, "justification"),
      }).returning();
      return row;
    },
  },
  "purchase-orders": {
    list: async (companyId) => {
      const rows = await db.select().from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .leftJoin(projects, eq(purchaseOrders.projectId, projects.id))
        .where(eq(purchaseOrders.companyId, companyId))
        .orderBy(desc(purchaseOrders.id));
      return rows.map(({ purchase_orders: order, suppliers: supplier, projects: project }) => ({
        ...order,
        supplierName: supplier?.name ?? `Supplier #${order.supplierId}`,
        projectName: project?.name ?? (order.projectId ? `Project #${order.projectId}` : null),
      }));
    },
    create: (b, companyId) => db.insert(purchaseOrders).values({
      companyId,
      requestId: int(b, "requestId", false),
      supplierId: int(b, "supplierId")!,
      projectId: int(b, "projectId", false),
      orderNumber: requiredText(b, "orderNumber"),
      status: oneOf(b, "status", APPROVAL_STATES, "draft"),
      total: numeric(b, "total", "0")!,
      currency: (text(b, "currency") ?? "ETB").toUpperCase().slice(0, 3),
      orderedAt: date(b, "orderedAt"),
    }).returning().then(([row]) => row),
  },
  "material-receipts": {
    list: async (companyId) => {
      const rows = await db.select().from(inventoryTransactions)
        .leftJoin(materials, eq(inventoryTransactions.materialId, materials.id))
        .leftJoin(purchaseOrders, and(
          eq(inventoryTransactions.referenceId, purchaseOrders.id),
          eq(inventoryTransactions.referenceType, "purchase_order"),
        ))
        .where(and(
          eq(inventoryTransactions.companyId, companyId),
          eq(inventoryTransactions.movement, "receipt"),
        ))
        .orderBy(desc(inventoryTransactions.occurredAt), desc(inventoryTransactions.id));
      return rows.map(({ inventory_transactions: receipt, materials: material, purchase_orders: order }) => ({
        ...receipt,
        materialName: material?.name ?? `Material #${receipt.materialId}`,
        materialSku: material?.sku ?? "",
        orderNumber: order?.orderNumber ?? null,
        lineTotal: (Number(receipt.quantity ?? 0) * Number(receipt.unitCost ?? 0)).toFixed(2),
      }));
    },
    create: async (b, companyId) => {
      const quantity = requiredNumber(b, "quantity");
      if (Number(quantity) <= 0) throw new BadRequest("quantity must be greater than zero.");
      const referenceId = int(b, "referenceId", false);
      const [row] = await db.insert(inventoryTransactions).values({
        companyId,
        materialId: int(b, "materialId")!,
        movement: "receipt",
        quantity,
        unitCost: numeric(b, "unitCost"),
        siteId: int(b, "siteId", false),
        referenceType: referenceId ? "purchase_order" : null,
        referenceId,
        occurredAt: typeof b.occurredAt === "string" && b.occurredAt.trim()
          ? timestamp(b, "occurredAt")
          : undefined,
        notes: text(b, "notes"),
      }).returning();
      return row;
    },
  },
};

for (const [resource, category] of Object.entries(DOCUMENT_RESOURCE_CATEGORIES)) {
  resources[resource] = documentResource(category);
}

export async function GET(_req: Request, ctx: { params: Promise<{ resource: string }> }) {
  const resource = resources[(await ctx.params).resource];
  if (!resource) return NextResponse.json({ error: "Unknown module resource." }, { status: 404 });
  return NextResponse.json(await resource.list(await getWorkspaceCompanyId()));
}

export async function POST(req: Request, ctx: { params: Promise<{ resource: string }> }) {
  const resource = resources[(await ctx.params).resource];
  if (!resource) return NextResponse.json({ error: "Unknown module resource." }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  try {
    const created = await resource.create(body as Body, await getWorkspaceCompanyId());
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof BadRequest) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isUniqueConstraintViolation(error)) {
      return NextResponse.json({ error: "A record with that code already exists." }, { status: 409 });
    }
    if (isForeignKeyViolation(error)) {
      return NextResponse.json({ error: "A referenced record does not exist." }, { status: 409 });
    }
    console.error("Failed to create module record:", error);
    return NextResponse.json({ error: "The record could not be created." }, { status: 500 });
  }
}
