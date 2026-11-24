import { ALL_TRADES, EMPLOYMENT_TYPE_MAX_LENGTH } from "@/lib/domain";
import { isValidPhone, phoneError } from "@/lib/validation";

export type ParsedWorkerFields = {
  fullName: string;
  position: string;
  trade: string;
  department: string | null;
  site: string | null;
  workLine: string | null;
  employmentType: string;
  dailyWage: number | null;
  phone: string;
  hireDate: string | null;
  status: "ACTIVE" | "INACTIVE";
};

function readText(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalText(fields: Record<string, unknown>, key: string): string | null {
  const value = readText(fields, key);
  return value || null;
}

function readDailyWage(fields: Record<string, unknown>): number | null | undefined {
  const value = fields.dailyWage;
  if (value === null || value === undefined || value === "") return null;
  const wage = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(wage) || !Number.isInteger(wage) || wage < 0 || wage > 10_000_000) return undefined;
  return wage;
}

/**
 * Shared parsing for worker create/update requests. The Employment type can be
 * a preset trade or a custom value typed under "Other"; it is mirrored into the
 * legacy `trade` and `position` columns so attendance/report queries keep working.
 */
export function parseWorkerFields(fields: Record<string, unknown>):
  | { ok: true; value: ParsedWorkerFields }
  | { ok: false; error: string } {
  const fullName = readText(fields, "fullName");
  if (!fullName) return { ok: false, error: "fullName is required." };

  const employmentValue = readText(fields, "employmentType") || readText(fields, "trade") || ALL_TRADES;
  if (!employmentValue) {
    return { ok: false, error: "Employment type is required." };
  }
  if (employmentValue.length > EMPLOYMENT_TYPE_MAX_LENGTH) {
    return { ok: false, error: `Employment type must be ${EMPLOYMENT_TYPE_MAX_LENGTH} characters or fewer.` };
  }
  const employmentType = employmentValue;

  const phone = readText(fields, "phone");
  if (!isValidPhone(phone)) return { ok: false, error: phoneError("Phone number") };

  const dailyWage = readDailyWage(fields);
  if (dailyWage === undefined) {
    return { ok: false, error: "Daily wage must be a whole number of ETB or left empty." };
  }

  return {
    ok: true,
    value: {
      fullName,
      position: employmentType,
      trade: employmentType,
      department: readOptionalText(fields, "department"),
      site: readOptionalText(fields, "site"),
      workLine: readOptionalText(fields, "workLine"),
      employmentType,
      dailyWage,
      phone,
      hireDate: readOptionalText(fields, "hireDate"),
      status: fields.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    },
  };
}
