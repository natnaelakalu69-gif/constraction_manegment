import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { dailyFollowUps, dailyPlans, dailySiteReports, safetyInspections } from "@/db/schema/enterprise";
import { getWorkspaceCompanyId } from "@/lib/workspace";

class BadRequest extends Error {}

type Body = Record<string, unknown>;
const text = (b: Body, key: string) => {
  const v = b[key];
  return typeof v === "string" && v.trim() ? v.trim() : v === "" || v === null ? null : undefined;
};
const date = (b: Body, key: string) => {
  const v = text(b, key);
  if (v === undefined || v === null) return v;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new BadRequest(`${key} must be a date (YYYY-MM-DD).`);
  return v;
};
const oneOf = <T extends string>(b: Body, key: string, allowed: readonly T[]) => {
  const v = text(b, key);
  if (v === undefined || v === null) return v;
  if (!allowed.includes(v as T)) throw new BadRequest(`${key} must be one of: ${allowed.join(", ")}.`);
  return v as T;
};

const APPROVAL = ["draft", "submitted", "approved", "rejected", "cancelled"] as const;
const FOLLOWUP = ["open", "in_progress", "done", "cancelled"] as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id: rawId } = await ctx.params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  const b = body as Body;
  const companyId = await getWorkspaceCompanyId();

  try {
    if (resource === "daily-site-reports") {
      const values: Record<string, unknown> = {};
      const status = oneOf(b, "status", APPROVAL); if (status !== undefined) values.status = status ?? "submitted";
      const reviewNotes = text(b, "reviewNotes"); if (reviewNotes !== undefined) values.reviewNotes = reviewNotes;
      const delays = text(b, "delays"); if (delays !== undefined) values.delays = delays;
      const reviewedBy = text(b, "reviewedBy"); if (reviewedBy !== undefined) values.reviewedBy = reviewedBy;
      if (status === "approved" || status === "rejected") values.reviewedAt = new Date();
      if (Object.keys(values).length === 0) throw new BadRequest("No valid fields to update.");
      const [row] = await db.update(dailySiteReports).set(values).where(and(eq(dailySiteReports.id, id), eq(dailySiteReports.companyId, companyId))).returning();
      if (!row) return NextResponse.json({ error: "Record not found." }, { status: 404 });
      return NextResponse.json(row);
    }
    if (resource === "daily-follow-ups") {
      const values: Record<string, unknown> = {};
      const status = oneOf(b, "status", FOLLOWUP); if (status !== undefined) values.status = status ?? "open";
      const notes = text(b, "notes"); if (notes !== undefined) values.notes = notes;
      const action = text(b, "action"); if (action !== undefined) values.action = action;
      const issue = text(b, "issue"); if (issue !== undefined) values.issue = issue;
      const assignedTo = text(b, "assignedTo"); if (assignedTo !== undefined) values.assignedTo = assignedTo;
      const dueDate = date(b, "dueDate"); if (dueDate !== undefined) values.dueDate = dueDate;
      if (Object.keys(values).length === 0) throw new BadRequest("No valid fields to update.");
      if (values.issue === null || values.action === null) throw new BadRequest("issue and action cannot be empty.");
      const [row] = await db.update(dailyFollowUps).set(values).where(and(eq(dailyFollowUps.id, id), eq(dailyFollowUps.companyId, companyId))).returning();
      if (!row) return NextResponse.json({ error: "Record not found." }, { status: 404 });
      return NextResponse.json(row);
    }
    if (resource === "daily-plans") {
      const values: Record<string, unknown> = {};
      const status = oneOf(b, "status", APPROVAL); if (status !== undefined) values.status = status ?? "draft";
      const notes = text(b, "notes"); if (notes !== undefined) values.notes = notes;
      if (Object.keys(values).length === 0) throw new BadRequest("No valid fields to update.");
      const [row] = await db.update(dailyPlans).set(values).where(and(eq(dailyPlans.id, id), eq(dailyPlans.companyId, companyId))).returning();
      if (!row) return NextResponse.json({ error: "Record not found." }, { status: 404 });
      return NextResponse.json(row);
    }
    if (resource === "safety-inspections") {
      const values: Record<string, unknown> = {};
      const status = oneOf(b, "status", APPROVAL); if (status !== undefined) values.status = status ?? "submitted";
      const notes = text(b, "notes"); if (notes !== undefined) values.notes = notes;
      const corrective = text(b, "correctiveActions"); if (corrective !== undefined) values.correctiveActions = corrective;
      if (Object.keys(values).length === 0) throw new BadRequest("No valid fields to update.");
      const [row] = await db.update(safetyInspections).set(values).where(and(eq(safetyInspections.id, id), eq(safetyInspections.companyId, companyId))).returning();
      if (!row) return NextResponse.json({ error: "Record not found." }, { status: 404 });
      return NextResponse.json(row);
    }
    return NextResponse.json({ error: "Updates are not supported for this resource." }, { status: 404 });
  } catch (error) {
    if (error instanceof BadRequest) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Failed to update module record:", error);
    return NextResponse.json({ error: "The record could not be updated." }, { status: 500 });
  }
}
