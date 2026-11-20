import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  budgets, dailyFollowUps, dailyPlanTasks, dailyPlans, dailySiteReports, equipment,
  equipmentUsage, inventoryTransactions, materials, progressRecords, projectCosts,
  projects, qualityDefects, qualityInspections, safetyIncidents, safetyInspections, workPackages,
} from "@/db/schema/enterprise";
import { isForeignKeyViolation, isUniqueConstraintViolation } from "@/lib/postgres-errors";
import { getWorkspaceCompanyId } from "@/lib/workspace";
import { businessCodeError, isValidBusinessCode, isValidPhone, phoneError } from "@/lib/validation";

class BadRequest extends Error {}

type Body = Record<string, unknown>;
type FieldType = "text" | "int" | "number" | "date" | "datetime" | "enum";
type FieldSpec = { type: FieldType; allowed?: readonly string[]; required?: boolean; format?: "businessCode" | "phone" };

const APPROVAL = ["draft", "submitted", "approved", "rejected", "cancelled"] as const;
const INVENTORY_MOVEMENTS = ["receipt", "issue", "return", "transfer_in", "transfer_out", "adjustment", "wastage"] as const;

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
    projectId: { type: "int", required: true }, category: { type: "text", required: true },
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
};

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
    if (resource === "daily-site-reports" && "status" in values) {
      values.reviewedAt = values.status === "approved" || values.status === "rejected" ? new Date() : null;
    }
    if (Object.keys(values).length === 0) throw new BadRequest("No valid fields to update.");
    if ("updatedAt" in table) values.updatedAt = new Date();

    const companyId = await getWorkspaceCompanyId();
    const [row] = await db.update(table).set(values)
      .where(and(eq(table.id, id), eq(table.companyId, companyId)))
      .returning();
    if (!row) return NextResponse.json({ error: "Record not found." }, { status: 404 });
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
    const [deleted] = await db.delete(table)
      .where(and(eq(table.id, id), eq(table.companyId, companyId)))
      .returning({ id: table.id });
    if (!deleted) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return NextResponse.json({ error: "This record is referenced by other records and cannot be deleted." }, { status: 409 });
    }
    console.error("Failed to delete module record:", error);
    return NextResponse.json({ error: "The record could not be deleted." }, { status: 500 });
  }
}
