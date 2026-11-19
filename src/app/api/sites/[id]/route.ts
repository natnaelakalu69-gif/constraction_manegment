import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { isForeignKeyViolation } from "@/lib/postgres-errors";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const b = await req.json();
  const [site] = await db.update(sites).set({
    siteName: b.siteName, location: b.location, managerName: b.managerName ?? null, status: b.status ?? "ACTIVE",
  }).where(eq(sites.id, id)).returning();
  return site ? NextResponse.json(site) : NextResponse.json({ error: "Site not found" }, { status: 404 });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  try {
    const [deleted] = await db.delete(sites).where(eq(sites.id, id)).returning({ id: sites.id });
    if (!deleted) return NextResponse.json({ error: "Site not found" }, { status: 404 });
    return NextResponse.json({ message: "Site deleted" });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return NextResponse.json({ error: "This site is referenced by attendance or other records and cannot be deleted." }, { status: 409 });
    }
    throw error;
  }
}