import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema/enterprise";
import { RECORD_STATUSES } from "@/lib/domain";
import { isUniqueConstraintViolation } from "@/lib/postgres-errors";
import { isValidPhone, phoneError } from "@/lib/validation";
import { getWorkspaceCompanyId } from "@/lib/workspace";

class BadRequest extends Error {}

type Body = Record<string, unknown>;

function trimmed(b: Body, key: string): string | null {
  const value = b[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalText(b: Body, key: string, maxLength: number): string | null | undefined {
  if (!(key in b)) return undefined;
  const value = trimmed(b, key);
  if (value === null) return null;
  if (value.length > maxLength) throw new BadRequest(`${key} must be ${maxLength} characters or fewer.`);
  return value;
}

function upperCode(b: Body, key: string, length: number): string | undefined {
  if (!(key in b)) return undefined;
  const value = trimmed(b, key);
  if (!value) throw new BadRequest(`${key} is required.`);
  if (!new RegExp(`^[A-Za-z]{${length}}$`).test(value)) {
    throw new BadRequest(`${key} must be ${length} letters.`);
  }
  return value.toUpperCase();
}

async function currentCompany() {
  const companyId = await getWorkspaceCompanyId();
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  return company;
}

export async function GET() {
  const company = await currentCompany();
  if (!company) return NextResponse.json({ error: "Company settings could not be loaded." }, { status: 500 });
  return NextResponse.json(company);
}

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const b = body as Body;

  try {
    const values: Record<string, unknown> = {};

    if ("name" in b) {
      const name = trimmed(b, "name");
      if (!name) throw new BadRequest("name is required.");
      if (name.length > 200) throw new BadRequest("name must be 200 characters or fewer.");
      values.name = name;
    }

    const legalName = optionalText(b, "legalName", 250);
    if (legalName !== undefined) values.legalName = legalName;
    const registrationNumber = optionalText(b, "registrationNumber", 100);
    if (registrationNumber !== undefined) values.registrationNumber = registrationNumber;
    const taxNumber = optionalText(b, "taxNumber", 100);
    if (taxNumber !== undefined) values.taxNumber = taxNumber;
    const address = optionalText(b, "address", 2000);
    if (address !== undefined) values.address = address;

    // Bounded to the company column lengths without imposing a restrictive format.
    const email = optionalText(b, "email", 254);
    if (email !== undefined) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequest("email must be a valid email address.");
      values.email = email;
    }
    const phone = optionalText(b, "phone", 40);
    if (phone !== undefined) {
      if (phone && !isValidPhone(phone)) throw new BadRequest(phoneError("phone"));
      values.phone = phone;
    }

    const countryCode = upperCode(b, "countryCode", 2);
    if (countryCode !== undefined) values.countryCode = countryCode;
    const currency = upperCode(b, "currency", 3);
    if (currency !== undefined) values.currency = currency;

    if ("timezone" in b) {
      const timezone = trimmed(b, "timezone");
      if (!timezone) throw new BadRequest("timezone is required.");
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone });
      } catch {
        throw new BadRequest("timezone must be a valid IANA time zone.");
      }
      values.timezone = timezone.slice(0, 64);
    }

    if ("status" in b) {
      const status = trimmed(b, "status");
      if (!status || !RECORD_STATUSES.includes(status as (typeof RECORD_STATUSES)[number])) {
        throw new BadRequest(`status must be one of: ${RECORD_STATUSES.join(", ")}.`);
      }
      values.status = status;
    }

    if (Object.keys(values).length === 0) throw new BadRequest("No valid fields to update.");

    const companyId = await getWorkspaceCompanyId();
    values.updatedAt = new Date();
    const [updated] = await db.update(companies).set(values)
      .where(eq(companies.id, companyId))
      .returning();
    if (!updated) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof BadRequest) return NextResponse.json({ error: error.message }, { status: 400 });
    if (isUniqueConstraintViolation(error)) {
      return NextResponse.json({ error: "A company with that registration number already exists." }, { status: 409 });
    }
    console.error("Failed to update company settings:", error);
    return NextResponse.json({ error: "Company settings could not be saved." }, { status: 500 });
  }
}
