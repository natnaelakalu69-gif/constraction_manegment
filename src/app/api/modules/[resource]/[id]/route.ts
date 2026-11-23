import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceRules, budgets, dailyFollowUps, dailyPlanTasks, dailyPlans, dailySiteReports, dayLaborWages,
  departments, documents, equipment, equipmentUsage, inventoryTransactions, materials, progressRecords, projectCosts,
  projects, purchaseOrders, purchaseRequests, qualityDefects, qualityInspections, safetyIncidents,
  safetyInspections, shifts, sites, suppliers, teamMembers, wagePayments, wageSettings, workPackages,
  workTeams, workTasks, workers as workforce,
} from "@/db/schema/enterprise";
import {
  ASSIGNEE_TYPES, BOOLEAN_OPTIONS, DOCUMENT_RESOURCE_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_FREQUENCIES,
  RECORD_STATUSES, TASK_PRIORITIES, TASK_STATUSES, WAGE_PAYMENT_STATUSES,
} from "@/lib/domain";
import { isForeignKeyViolation, isUniqueConstraintViolation } from "@/lib/postgres-errors";
import { getWorkspaceCompanyId } from "@/lib/workspace";
import { businessCodeError, isValidBusinessCode, isValidPhone, phoneError } from "@/lib/validation";
import { calculateWageTotals, getWageConfig, paymentStatusFor, resolveOvertimeRate } from "@/server/services/payroll";

class BadRequest extends Error {}

type Body = Record<string, unknown>;
type FieldType = "text" | "int" | "nonNegativeInt" | "number" | "date" | "datetime" | "time" | "boolean" | "enum";
type FieldSpec = { type: FieldType; allowed?: readonly string[]; required?: boolean; format?: "businessCode" | "phone" };

const APPROVAL = ["draft", "submitted", "approved", "rejected", "cancelled"] as const;
const INVENTORY_MOVEMENTS = ["receipt", "issue", "return", "transfer_in", "transfer_out", "adjustment", "wastage"] as const;

/** Settings columns have database defaults but are NOT NULL: an empty form value leaves them unchanged. */
const KEEP_UNCHANGED_WHEN_EMPTY = new Set([
  "status", "isActive", "breakMinutes", "lateAfterMinutes", "earlyLeaveAfterMinutes",
  "overtimeStartsAfterMinutes", "standardHoursPerDay", "markAbsentAfterMinutes",
  "currency", "regularHoursPerDay", "overtimeMultiplier", "defaultDailyRate",
  "mimeType", "sizeBytes", "version",
]);
const KEEP_UNCHANGED_RESOURCES = new Set([
  "sites", "shifts", "attendance-rules", "wage-settings", "purchase-orders",
  ...Object.keys(DOCUMENT_RESOURCE_CATEGORIES),
]);

const TABLES: Record<string, any> = {
  projects,
  "work-packages": workPackages,
  "progress-records": progressRecords,
  budgets,
  "project-costs": projectCosts,
  materials,
  "inventory-transactions": inventoryTransactions,
  equipment,
  "equipment-usage": equipmentUsage,
  "safety-incidents": safetyIncidents,
  "quality-inspections": qualityInspections,
  "quality-defects": qualityDefects,
  "daily-plans": dailyPlans,
  "daily-plan-tasks": dailyPlanTasks,
  "daily-site-reports": dailySiteReports,
  "daily-follow-ups": dailyFollowUps,
  "safety-inspections": safetyInspections,
  workforce,
  teams: workTeams,
  "team-members": teamMembers,
  "work-tasks": workTasks,
  "day-labor-wages": dayLaborWages,
  "wage-payments": wagePayments,
  sites,
  departments,
  shifts,
  "attendance-rules": attendanceRules,
  "wage-settings": wageSettings,
  suppliers,
  "purchase-requests": purchaseRequests,
  "purchase-orders": purchaseOrders,
  "material-receipts": inventoryTransactions,
};

const DOCUMENT_FIELDS: Record<string, FieldSpec> = {
  projectId: { type: "int" },
  title: { type: "text", required: true },
  storageKey: { type: "text", required: true },
  mimeType: { type: "text" },
  sizeBytes: { type: "nonNegativeInt" },
  version: { type: "nonNegativeInt" },
};

const EDITABLE: Record<string, Record<string, FieldSpec>> = {
  projects: {
    code: { type: "text", required: true, format: "businessCode" }, name: { type: "text", required: true },
    clientName: { type: "text" }, location: { type: "text" },
    status: { type: "enum", allowed: ["planning", "active", "suspended", "completed", "cancelled"] },
    budget: { type: "number" }, startDate: { type: "date" }, plannedEndDate: { type: "date" },
  },
  "work-packages": {
    projectId: { type: "int", required: true }, code: { type: "text", required: true, format: "businessCode" },
    name: { type: "text", required: true }, unit: { type: "text", required: true },
    plannedQuantity: { type: "number" }, plannedStart: { type: "date" }, plannedEnd: { type: "date" },
  },
  "progress-records": {
    workPackageId: { type: "int", required: true }, recordedOn: { type: "date", required: true },
    quantityCompleted: { type: "number", required: true }, notes: { type: "text" },
  },
  budgets: {
    projectId: { type: "int", required: true }, costCode: { type: "text", required: true, format: "businessCode" },
    description: { type: "text", required: true }, plannedAmount: { type: "number", required: true },
  },
  "project-costs": {
    projectId: { type: "int", required: true }, budgetId: { type: "int" },
    category: { type: "text", required: true },
    expenseCategory: { type: "enum", allowed: EXPENSE_CATEGORIES },
    description: { type: "text" }, amount: { type: "number", required: true },
    incurredOn: { type: "date", required: true }, reference: { type: "text" },
  },
  materials: {
    sku: { type: "text", required: true, format: "businessCode" }, name: { type: "text", required: true },
    unit: { type: "text", required: true }, minimumStock: { type: "number" },
  },
  "inventory-transactions": {
    materialId: { type: "int", required: true }, movement: { type: "enum", allowed: INVENTORY_MOVEMENTS, required: true },
    quantity: { type: "number", required: true }, unitCost: { type: "number" },
    occurredAt: { type: "datetime" }, notes: { type: "text" },
  },
  equipment: {
    equipmentNumber: { type: "text", required: true, format: "businessCode" }, name: { type: "text", required: true },
    equipmentType: { type: "text" },
  },
  "equipment-usage": {
    equipmentId: { type: "int", required: true }, usageDate: { type: "date", required: true },
    workingHours: { type: "number" }, fuelLiters: { type: "number" }, notes: { type: "text" },
  },
  "safety-incidents": {
    incidentNumber: { type: "text", required: true, format: "businessCode" }, incidentType: { type: "text", required: true },
    occurredAt: { type: "datetime", required: true },
    severity: { type: "enum", allowed: ["low", "medium", "high", "critical"] },
    description: { type: "text", required: true }, status: { type: "enum", allowed: APPROVAL },
  },
  "quality-inspections": {
    projectId: { type: "int", required: true }, inspectionDate: { type: "date", required: true },
    result: { type: "enum", allowed: ["pass", "fail", "conditional"], required: true }, notes: { type: "text" },
  },
  "quality-defects": {
    projectId: { type: "int", required: true }, inspectionId: { type: "int" },
    title: { type: "text", required: true }, description: { type: "text" },
    severity: { type: "enum", allowed: ["low", "medium", "high", "critical"] },
    status: { type: "enum", allowed: APPROVAL }, dueDate: { type: "date" },
  },
  "daily-plans": {
    planDate: { type: "date", required: true }, supervisorName: { type: "text", required: true },
    projectId: { type: "int" }, siteId: { type: "int" },
    requiredResources: { type: "text" }, notes: { type: "text" }, status: { type: "enum", allowed: APPROVAL },
  },
  "daily-plan-tasks": {
    planId: { type: "int", required: true }, task: { type: "text", required: true },
    deadline: { type: "date" }, assignee: { type: "text" },
    requiredResources: { type: "text" },
    status: { type: "enum", allowed: ["planned", "in_progress", "done", "blocked"] },
  },
  "daily-site-reports": {
    reportDate: { type: "date", required: true }, supervisorName: { type: "text", required: true },
    projectId: { type: "int" }, siteId: { type: "int" }, planId: { type: "int" },
    completedWork: { type: "text", required: true }, progressPercent: { type: "number", required: true },
    photos: { type: "text" }, challenges: { type: "text" }, delays: { type: "text" },
    status: { type: "enum", allowed: APPROVAL }, reviewNotes: { type: "text" }, reviewedBy: { type: "text" },
  },
  "daily-follow-ups": {
    reportId: { type: "int" }, projectId: { type: "int" }, siteId: { type: "int" },
    issue: { type: "text", required: true }, action: { type: "text", required: true },
    assignedTo: { type: "text" }, dueDate: { type: "date" },
    status: { type: "enum", allowed: ["open", "in_progress", "done", "cancelled"] }, notes: { type: "text" },
  },
  "safety-inspections": {
    inspectionDate: { type: "date", required: true }, inspectorName: { type: "text", required: true },
    projectId: { type: "int" }, siteId: { type: "int" },
    hazards: { type: "text" }, incidentsObserved: { type: "text" },
    correctiveActions: { type: "text" }, status: { type: "enum", allowed: APPROVAL }, notes: { type: "text" },
  },
  workforce: {
    workerCode: { type: "text", required: true, format: "businessCode" }, fullName: { type: "text", required: true },
    phone: { type: "text", format: "phone" },
    employmentType: { type: "enum", allowed: ["employee", "day_labor", "contractor"] },
    dailyRate: { type: "number" }, status: { type: "enum", allowed: ["active", "inactive", "archived"] },
  },
  teams: {
    code: { type: "text", required: true }, name: { type: "text", required: true },
    supervisorName: { type: "text" }, notes: { type: "text" },
  },
  "team-members": {
    teamId: { type: "int", required: true }, workerId: { type: "int", required: true },
  },
  "work-tasks": {
    title: { type: "text", required: true }, description: { type: "text" },
    projectId: { type: "int" }, siteId: { type: "int" },
    assigneeType: { type: "enum", allowed: ASSIGNEE_TYPES }, workerId: { type: "int" }, teamId: { type: "int" },
    supervisorName: { type: "text", required: true },
    priority: { type: "enum", allowed: TASK_PRIORITIES }, status: { type: "enum", allowed: TASK_STATUSES },
    deadline: { type: "date" },
  },
  "day-labor-wages": {
    workerId: { type: "int", required: true }, periodStart: { type: "date", required: true },
    periodEnd: { type: "date", required: true }, workingDays: { type: "number", required: true },
    dailyRate: { type: "number", required: true }, overtimeHours: { type: "number" },
    overtimeRate: { type: "number" }, approvedOvertime: { type: "number" },
    approvedDeductions: { type: "number" }, status: { type: "enum", allowed: APPROVAL },
    paymentStatus: { type: "enum", allowed: WAGE_PAYMENT_STATUSES }, paidAmount: { type: "number" },
    paidAt: { type: "datetime" }, paymentReference: { type: "text" },
  },
  "wage-payments": {
    amount: { type: "number", required: true }, paymentDate: { type: "date", required: true },
    method: { type: "text" }, reference: { type: "text" }, notes: { type: "text" },
  },
  sites: {
    projectId: { type: "int", required: true }, code: { type: "text", required: true },
    name: { type: "text", required: true }, location: { type: "text" },
    status: { type: "enum", allowed: RECORD_STATUSES },
  },
  departments: {
    code: { type: "text", required: true }, name: { type: "text", required: true },
    branchId: { type: "int" }, parentId: { type: "int" },
  },
  shifts: {
    name: { type: "text", required: true },
    startsAt: { type: "time", required: true }, endsAt: { type: "time", required: true },
    breakMinutes: { type: "nonNegativeInt" },
  },
  "attendance-rules": {
    name: { type: "text", required: true }, shiftId: { type: "int" },
    lateAfterMinutes: { type: "nonNegativeInt" }, earlyLeaveAfterMinutes: { type: "nonNegativeInt" },
    overtimeStartsAfterMinutes: { type: "nonNegativeInt" }, standardHoursPerDay: { type: "number" },
    markAbsentAfterMinutes: { type: "nonNegativeInt" }, isActive: { type: "boolean" },
  },
  "wage-settings": {
    name: { type: "text", required: true }, currency: { type: "text" },
    regularHoursPerDay: { type: "number" }, overtimeMultiplier: { type: "number" },
    paymentFrequency: { type: "enum", allowed: PAYMENT_FREQUENCIES },
    defaultDailyRate: { type: "number" }, isActive: { type: "boolean" },
  },
  suppliers: {
    name: { type: "text", required: true }, contactName: { type: "text" },
    email: { type: "text" }, phone: { type: "text" }, address: { type: "text" },
  },
  "purchase-requests": {
    projectId: { type: "int" }, requestNumber: { type: "text", required: true },
    status: { type: "enum", allowed: APPROVAL }, requiredBy: { type: "date" },
    justification: { type: "text" },
  },
  "purchase-orders": {
    requestId: { type: "int" }, supplierId: { type: "int", required: true },
    projectId: { type: "int" }, orderNumber: { type: "text", required: true },
    status: { type: "enum", allowed: APPROVAL }, total: { type: "number" },
    currency: { type: "text" }, orderedAt: { type: "date" },
  },
  "material-receipts": {
    materialId: { type: "int", required: true }, quantity: { type: "number", required: true },
    unitCost: { type: "number" }, siteId: { type: "int" }, referenceId: { type: "int" },
    occurredAt: { type: "datetime" }, notes: { type: "text" },
  },
};

for (const resource of Object.keys(DOCUMENT_RESOURCE_CATEGORIES)) {
  TABLES[resource] = documents;
  EDITABLE[resource] = DOCUMENT_FIELDS;
}

async function syncWagePaymentStatus(wageId: number, companyId: number) {
  const [wage] = await db.select().from(dayLaborWages)
    .where(and(eq(dayLaborWages.id, wageId), eq(dayLaborWages.companyId, companyId)));
  if (!wage) return;

  const [aggregate] = await db.select({ paid: sql<string>`coalesce(sum(${wagePayments.amount}), 0)` })
    .from(wagePayments)
    .where(and(eq(wagePayments.wageId, wageId), eq(wagePayments.companyId, companyId)));
  const paidAmount = Number(aggregate?.paid ?? 0);
  const status = paymentStatusFor(paidAmount, wage.total);

  await db.update(dayLaborWages).set({
    paidAmount: paidAmount.toFixed(2),
    paymentStatus: status,
    paidAt: status === "paid" ? new Date() : null,
    updatedAt: new Date(),
  }).where(and(eq(dayLaborWages.id, wageId), eq(dayLaborWages.companyId, companyId)));
}

function coerce(value: unknown, spec: FieldSpec, key: string) {
  if (value === null || value === undefined || value === "") {
    if (spec.required) throw new BadRequest(`${key} is required.`);
    return null;
  }
  if (spec.type === "int") {
    const raw = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
    const parsed = Number.parseInt(raw, 10);
    if (!/^\d+$/.test(raw) || !Number.isInteger(parsed) || parsed <= 0) throw new BadRequest(`${key} must be a positive integer.`);
    return parsed;
  }
  if (spec.type === "nonNegativeInt") {
    const raw = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
    if (!/^\d+$/.test(raw) || !Number.isInteger(Number(raw))) {
      throw new BadRequest(`${key} must be a non-negative integer.`);
    }
    return Number(raw);
  }
  if (spec.type === "number") {
    const raw = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
    if (!raw || Number.isNaN(Number(raw))) throw new BadRequest(`${key} must be a number.`);
    return raw;
  }
  if (spec.type === "date") {
    const raw = String(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequest(`${key} must be a date (YYYY-MM-DD).`);
    return raw;
  }
  if (spec.type === "datetime") {
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) throw new BadRequest(`${key} must be a valid date and time.`);
    return parsed;
  }
  if (spec.type === "time") {
    const raw = String(value).trim();
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) throw new BadRequest(`${key} must be a time (HH:MM).`);
    return raw;
  }
  if (spec.type === "boolean") {
    if (typeof value === "boolean") return value;
    const raw = String(value).trim().toLowerCase();
    if (!BOOLEAN_OPTIONS.includes(raw as (typeof BOOLEAN_OPTIONS)[number])) {
      throw new BadRequest(`${key} must be true or false.`);
    }
    return raw === "true";
  }
  const raw = String(value).trim();
  if (spec.format === "businessCode" && !isValidBusinessCode(raw)) throw new BadRequest(businessCodeError(key));
  if (spec.format === "phone" && raw && !isValidPhone(raw)) throw new BadRequest(phoneError(key));
  if (spec.allowed && !spec.allowed.includes(raw)) throw new BadRequest(`${key} must be one of: ${spec.allowed.join(", ")}.`);
  return raw;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id: rawId } = await ctx.params;
  const table = TABLES[resource];
  const editable = EDITABLE[resource];
  if (!table || !editable) return NextResponse.json({ error: "Updates are not supported for this resource." }, { status: 404 });

  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  const b = body as Body;

  try {
    const values: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(editable)) {
      if (key in b) values[key] = coerce(b[key], spec, key);
    }
    if (KEEP_UNCHANGED_RESOURCES.has(resource)) {
      for (const key of Object.keys(values)) {
        if (values[key] === null && KEEP_UNCHANGED_WHEN_EMPTY.has(key)) delete values[key];
      }
    }
    if (Object.keys(values).length === 0) throw new BadRequest("No valid fields to update.");

    const companyId = await getWorkspaceCompanyId();
    const documentCategory = DOCUMENT_RESOURCE_CATEGORIES[resource];
    if (documentCategory && "version" in values && Number(values.version) < 1) {
      throw new BadRequest("version must be at least 1.");
    }

    if ((resource === "wage-settings" || resource === "purchase-orders") && "currency" in values) {
      values.currency = String(values.currency).toUpperCase().slice(0, 3);
    }

    if (resource === "material-receipts") {
      if ("quantity" in values && Number(values.quantity) <= 0) {
        throw new BadRequest("quantity must be greater than zero.");
      }
      if ("referenceId" in values) {
        values.referenceType = values.referenceId ? "purchase_order" : null;
      }
    }

    if (resource === "daily-site-reports" && "status" in values) {
      values.reviewedAt = values.status === "approved" || values.status === "rejected" ? new Date() : null;
    }

    if (resource === "work-tasks" && ("assigneeType" in values || "workerId" in values || "teamId" in values)) {
      const [existing] = await db.select().from(workTasks)
        .where(and(eq(workTasks.id, id), eq(workTasks.companyId, companyId)));
      if (!existing) return NextResponse.json({ error: "Record not found." }, { status: 404 });
      const assigneeType = values.assigneeType ?? existing.assigneeType;
      const workerId = "workerId" in values ? values.workerId : existing.workerId;
      const teamId = "teamId" in values ? values.teamId : existing.teamId;
      if (assigneeType === "worker") {
        if (!workerId) throw new BadRequest("workerId is required when the assignee type is worker.");
        values.teamId = null;
      } else {
        if (!teamId) throw new BadRequest("teamId is required when the assignee type is team.");
        values.workerId = null;
      }
    }

    if (resource === "day-labor-wages") {
      const [existing] = await db.select().from(dayLaborWages)
        .where(and(eq(dayLaborWages.id, id), eq(dayLaborWages.companyId, companyId)));
      if (!existing) return NextResponse.json({ error: "Record not found." }, { status: 404 });
      const merged = { ...existing, ...values } as typeof existing;
      if (merged.periodEnd < merged.periodStart) throw new BadRequest("periodEnd must be on or after periodStart.");
      const config = await getWageConfig(companyId);
      const overtimeRate = resolveOvertimeRate(merged.dailyRate, merged.overtimeRate, config);
      const totals = calculateWageTotals(merged, config);
      values.overtimeRate = overtimeRate;
      values.total = totals.netPay.toFixed(2);
      if (!("paymentStatus" in values)) {
        const paidAmount = "paidAmount" in values ? String(values.paidAmount) : merged.paidAmount;
        values.paymentStatus = paymentStatusFor(paidAmount, String(values.total));
      }
    }

    let paymentWageId: number | null = null;
    if (resource === "wage-payments") {
      if ("amount" in values && Number(values.amount) <= 0) throw new BadRequest("amount must be greater than zero.");
      const [existing] = await db.select({ wageId: wagePayments.wageId }).from(wagePayments)
        .where(and(eq(wagePayments.id, id), eq(wagePayments.companyId, companyId)));
      if (!existing) return NextResponse.json({ error: "Record not found." }, { status: 404 });
      paymentWageId = existing.wageId;
    }

    if ("updatedAt" in table) values.updatedAt = new Date();
    let updateWhere = and(eq(table.id, id), eq(table.companyId, companyId));
    if (resource === "material-receipts") {
      updateWhere = and(updateWhere, eq(inventoryTransactions.movement, "receipt"));
    }
    if (documentCategory) {
      updateWhere = and(updateWhere, eq(documents.category, documentCategory));
    }
    const [row] = await db.update(table).set(values)
      .where(updateWhere)
      .returning();
    if (!row) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    if (paymentWageId !== null) await syncWagePaymentStatus(paymentWageId, companyId);
    return NextResponse.json(row);
  } catch (error) {
    if (error instanceof BadRequest) return NextResponse.json({ error: error.message }, { status: 400 });
    if (isUniqueConstraintViolation(error)) return NextResponse.json({ error: "A record with that code already exists." }, { status: 409 });
    console.error("Failed to update module record:", error);
    return NextResponse.json({ error: "The record could not be updated." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id: rawId } = await ctx.params;
  const table = TABLES[resource];
  if (!table) return NextResponse.json({ error: "Deletes are not supported for this resource." }, { status: 404 });

  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  try {
    const companyId = await getWorkspaceCompanyId();
    const documentCategory = DOCUMENT_RESOURCE_CATEGORIES[resource];
    let paymentWageId: number | null = null;
    if (resource === "wage-payments") {
      const [existing] = await db.select({ wageId: wagePayments.wageId }).from(wagePayments)
        .where(and(eq(wagePayments.id, id), eq(wagePayments.companyId, companyId)));
      paymentWageId = existing?.wageId ?? null;
    }

    let deleteWhere = and(eq(table.id, id), eq(table.companyId, companyId));
    if (resource === "material-receipts") {
      deleteWhere = and(deleteWhere, eq(inventoryTransactions.movement, "receipt"));
    }
    if (documentCategory) {
      deleteWhere = and(deleteWhere, eq(documents.category, documentCategory));
    }
    const [deleted] = await db.delete(table)
      .where(deleteWhere)
      .returning({ id: table.id });
    if (!deleted) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    if (paymentWageId !== null) await syncWagePaymentStatus(paymentWageId, companyId);
    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return NextResponse.json({ error: "This record is referenced by other records and cannot be deleted." }, { status: 409 });
    }
    console.error("Failed to delete module record:", error);
    return NextResponse.json({ error: "The record could not be deleted." }, { status: 500 });
  }
}
