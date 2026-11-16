import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";

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
  await db.delete(sites).where(eq(sites.id, id));
  return NextResponse.json({ message: "Site deleted" });
}