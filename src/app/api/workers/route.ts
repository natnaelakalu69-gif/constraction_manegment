import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { isUniqueConstraintViolation } from "@/lib/postgres-errors";
import { businessCodeError, isValidBusinessCode } from "@/lib/validation";
import { parseWorkerFields } from "@/lib/worker-input";

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
  if (!workerCode) {
    return NextResponse.json({ error: "workerCode is required." }, { status: 400 });
  }
  if (!isValidBusinessCode(workerCode)) {
    return NextResponse.json({ error: businessCodeError("Worker code") }, { status: 400 });
  }

  const parsed = parseWorkerFields(fields);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const [worker] = await db.insert(workers).values({
      workerCode,
      ...parsed.value,
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
