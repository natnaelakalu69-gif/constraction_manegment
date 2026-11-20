import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { isUniqueConstraintViolation } from "@/lib/postgres-errors";
import { businessCodeError, isValidBusinessCode } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(await db.select().from(sites).orderBy(desc(sites.id)));
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
  const siteCode = typeof fields.siteCode === "string" ? fields.siteCode.trim() : "";
  const siteName = typeof fields.siteName === "string" ? fields.siteName.trim() : "";
  const location = typeof fields.location === "string" ? fields.location.trim() : "";
  if (!siteCode || !siteName || !location) {
    return NextResponse.json({ error: "siteCode, siteName and location are required." }, { status: 400 });
  }
  if (!isValidBusinessCode(siteCode)) {
    return NextResponse.json({ error: businessCodeError("Site code") }, { status: 400 });
  }

  try {
    const [site] = await db.insert(sites).values({
      siteCode,
      siteName,
      location,
      managerName: typeof fields.managerName === "string" && fields.managerName.trim() ? fields.managerName.trim() : null,
      status: fields.status === "COMPLETED" || fields.status === "SUSPENDED" ? fields.status : "ACTIVE",
    }).returning();
    return NextResponse.json(site, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return NextResponse.json({ error: `Site code "${siteCode}" already exists.` }, { status: 409 });
    }
    console.error("Failed to create site:", error);
    return NextResponse.json(
      { error: "The site could not be created. Check that the database is available and migrations have been applied." },
      { status: 500 }
    );
  }
}
