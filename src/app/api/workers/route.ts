import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";

export async function GET() {
  return NextResponse.json(await db.select().from(workers).orderBy(desc(workers.id)));
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b.workerCode || !b.fullName || !b.position) return NextResponse.json({ error: "workerCode, fullName and position are required" }, { status: 400 });
    const [worker] = await db.insert(workers).values({
      workerCode: String(b.workerCode),
      fullName: String(b.fullName),
      phone: b.phone ? String(b.phone) : null,
      position: String(b.position),
      department: b.department ? String(b.department) : null,
      hireDate: b.hireDate ? String(b.hireDate) : null,
      status: b.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    }).returning();
    return NextResponse.json(worker, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Worker code may already exist" }, { status: 409 });
  }
}