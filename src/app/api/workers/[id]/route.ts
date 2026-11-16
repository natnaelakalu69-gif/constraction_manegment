import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const b = await req.json();
  const [updated] = await db.update(workers).set({
    fullName: b.fullName, phone: b.phone ?? null, position: b.position,
    department: b.department ?? null, hireDate: b.hireDate ?? null,
    status: b.status ?? "ACTIVE",
  }).where(eq(workers.id, id)).returning();
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Worker not found" }, { status: 404 });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  await db.delete(workers).where(eq(workers.id, id));
  return NextResponse.json({ message: "Worker deleted" });
}