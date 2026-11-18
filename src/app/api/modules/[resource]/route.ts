import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  budgets, equipment, equipmentUsage, inventoryTransactions, materials,
  progressRecords, projectCosts, projects, qualityDefects, qualityInspections,
  safetyIncidents, workPackages,
} from "@/db/schema/enterprise";
import { isUniqueConstraintViolation } from "@/lib/postgres-errors";
import { getWorkspaceCompanyId } from "@/lib/workspace";

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

const APPROVAL_STATES = ["draft", "submitted", "approved", "rejected", "cancelled"] as const;
const INVENTORY_MOVEMENTS = ["receipt", "issue", "return", "transfer_in", "transfer_out", "adjustment", "wastage"] as const;

type Resource = {
  list: (companyId: number) => Promise<unknown[]>;
  create: (b: Body, companyId: number) => Promise<unknown>;
};

const resources: Record<string, Resource> = {
  projects: {
    list: (companyId) => db.select().from(projects).where(eq(projects.companyId, companyId)).orderBy(desc(projects.id)),
    create: (b, companyId) => db.insert(projects).values({
      companyId,
      code: requiredText(b, "code"),
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
      code: requiredText(b, "code"),
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
    list: (companyId) => db.select().from(budgets).where(eq(budgets.companyId, companyId)).orderBy(desc(budgets.id)),
    create: (b, companyId) => db.insert(budgets).values({
      companyId,
      projectId: int(b, "projectId")!,
      costCode: requiredText(b, "costCode"),
      description: requiredText(b, "description"),
      plannedAmount: requiredNumber(b, "plannedAmount"),
    }).returning().then(([row]) => row),
  },
  "project-costs": {
    list: (companyId) => db.select().from(projectCosts).where(eq(projectCosts.companyId, companyId)).orderBy(desc(projectCosts.id)),
    create: (b, companyId) => db.insert(projectCosts).values({
      companyId,
      projectId: int(b, "projectId")!,
      category: requiredText(b, "category"),
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
      sku: requiredText(b, "sku"),
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
      equipmentNumber: requiredText(b, "equipmentNumber"),
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
      incidentNumber: requiredText(b, "incidentNumber"),
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
};

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
    console.error("Failed to create module record:", error);
    return NextResponse.json({ error: "The record could not be created." }, { status: 500 });
  }
}
