import { EMPLOYMENT_TYPES, TRADES, isEmploymentType, isTrade } from "@/lib/domain";
import type { EmploymentType, Trade } from "@/lib/domain";
import { isValidPhone, phoneError } from "@/lib/validation";

export type ParsedWorkerFields = {
  fullName: string;
  position: string;
  trade: Trade;
  department: string | null;
  site: string | null;
  workLine: string | null;
  employmentType: EmploymentType;
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
 * Shared parsing for worker create/update requests. The legacy `position`
 * column mirrors the selected trade so existing attendance/report queries keep
 * working while the registration UI uses a controlled Trade dropdown.
 */
export function parseWorkerFields(fields: Record<string, unknown>):
  | { ok: true; value: ParsedWorkerFields }
  | { ok: false; error: string } {
  const fullName = readText(fields, "fullName");
  if (!fullName) return { ok: false, error: "fullName is required." };

  const tradeValue = readText(fields, "trade") || readText(fields, "position");
  if (!isTrade(tradeValue)) {
    return {
      ok: false,
      error: `Trade must be one of: ${TRADES.join(", ")}.`,
    };
  }
  const trade: Trade = tradeValue;

  const phone = readText(fields, "phone");
  if (!isValidPhone(phone)) return { ok: false, error: phoneError("Phone number") };

  const employmentValue = readText(fields, "employmentType") || "employee";
  if (!isEmploymentType(employmentValue)) {
    return {
      ok: false,
      error: `Employment type must be one of: ${EMPLOYMENT_TYPES.join(", ")}.`,
    };
  }
  const employmentType: EmploymentType = employmentValue;

  const dailyWage = readDailyWage(fields);
  if (dailyWage === undefined) {
    return { ok: false, error: "Daily wage must be a whole number of ETB or left empty." };
  }

  return {
    ok: true,
    value: {
      fullName,
      position: trade,
      trade,
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
