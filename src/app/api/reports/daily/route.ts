import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { db } from "@/db";
import { attendance } from "@/db/schema";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });
  const rows = await db.select({ status: attendance.status, count: count() })
    .from(attendance).where(eq(attendance.attendanceDate, date)).groupBy(attendance.status);
  const summary = Object.fromEntries(rows.map(r => [r.status, Number(r.count)]));
  return NextResponse.json({ date, summary, total: Object.values(summary).reduce((a: number, b) => a + b, 0) });
}