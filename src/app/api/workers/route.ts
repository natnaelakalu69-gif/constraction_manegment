import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { isUniqueConstraintViolation } from "@/lib/postgres-errors";
import { businessCodeError, isValidBusinessCode, isValidPhone, phoneError } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(await db.select().from(workers).orderBy(desc(workers.id)));
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const fields = body as Record<string, unknown>;
  const workerCode = typeof fields.workerCode === "string" ? fields.workerCode.trim() : "";
  const fullName = typeof fields.fullName === "string" ? fields.fullName.trim() : "";
  const position = typeof fields.position === "string" ? fields.position.trim() : "";
  const phone = typeof fields.phone === "string" ? fields.phone.trim() : "";
  if (!workerCode || !fullName || !position) {
    return NextResponse.json({ error: "workerCode, fullName and position are required." }, { status: 400 });
  }
  if (!isValidBusinessCode(workerCode)) {
    return NextResponse.json({ error: businessCodeError("Worker code") }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: phoneError("Phone number") }, { status: 400 });
  }

  try {
    const [worker] = await db.insert(workers).values({
      workerCode,
      fullName,
      phone: phone || null,
      position,
      department: typeof fields.department === "string" && fields.department.trim() ? fields.department.trim() : null,
      hireDate: typeof fields.hireDate === "string" && fields.hireDate ? fields.hireDate : null,
      status: fields.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    }).returning();
    return NextResponse.json(worker, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return NextResponse.json({ error: `Worker code "${workerCode}" already exists.` }, { status: 409 });
    }
    console.error("Failed to create worker:", error);
    return NextResponse.json(
      { error: "The worker could not be created. Check that the database is available and migrations have been applied." },
      { status: 500 }
    );
  }
}
