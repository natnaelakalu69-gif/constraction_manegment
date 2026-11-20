import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { isForeignKeyViolation } from "@/lib/postgres-errors";
import { isValidPhone, phoneError } from "@/lib/validation";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  const position = typeof b.position === "string" ? b.position.trim() : "";
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  if (!fullName || !position) {
    return NextResponse.json({ error: "fullName and position are required." }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: phoneError("Phone number") }, { status: 400 });
  }

  const [updated] = await db.update(workers).set({
    fullName, phone: phone || null, position,
    department: typeof b.department === "string" && b.department.trim() ? b.department.trim() : null,
    hireDate: typeof b.hireDate === "string" && b.hireDate ? b.hireDate : null,
    status: b.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  }).where(eq(workers.id, id)).returning();
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Worker not found" }, { status: 404 });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  try {
    const [deleted] = await db.delete(workers).where(eq(workers.id, id)).returning({ id: workers.id });
    if (!deleted) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    return NextResponse.json({ message: "Worker deleted" });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return NextResponse.json({ error: "This worker is referenced by attendance or other records and cannot be deleted." }, { status: 409 });
    }
    throw error;
  }
}
