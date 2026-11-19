import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { attendance } from "@/db/schema";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const rows = date
    ? await db.select().from(attendance).where(eq(attendance.attendanceDate, date)).orderBy(desc(attendance.id))
    : await db.select().from(attendance).orderBy(desc(attendance.id));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.workerId || !b.siteId || !b.attendanceDate || !b.status)
    return NextResponse.json({ error: "workerId, siteId, attendanceDate and status are required" }, { status: 400 });

  const existing = await db.query.attendance.findFirst({
    where: and(eq(attendance.workerId, Number(b.workerId)), eq(attendance.attendanceDate, String(b.attendanceDate)))
  });

  const values = {
    workerId: Number(b.workerId), siteId: Number(b.siteId),
    attendanceDate: String(b.attendanceDate), checkIn: b.checkIn ?? null,
    checkOut: b.checkOut ?? null, status: b.status, notes: b.notes ?? null,
    // Always set by the server so the recorded login time cannot be spoofed by the client.
    loggedInAt: new Date(),
  };

  if (existing) {
    const [updated] = await db.update(attendance).set(values).where(eq(attendance.id, existing.id)).returning();
    return NextResponse.json(updated);
  }
  const [created] = await db.insert(attendance).values(values).returning();
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const [deleted] = await db.delete(attendance).where(eq(attendance.id, id)).returning({ id: attendance.id });
  if (!deleted) return NextResponse.json({ error: "Attendance entry not found" }, { status: 404 });
  return NextResponse.json({ message: "Attendance entry deleted" });
}