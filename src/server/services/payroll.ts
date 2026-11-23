import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workers as workforce } from "@/db/schema/enterprise";
import { WAGE_PAYMENT_STATUS_LABELS, type WagePaymentStatus } from "@/lib/domain";

type Money = string | number | null | undefined;

export type WageTotals = {
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  deductions: number;
  netPay: number;
};

type WageCalculationInput = {
  workingDays: Money;
  dailyRate: Money;
  overtimeHours?: Money;
  overtimeRate?: Money;
  approvedOvertime?: Money;
  approvedDeductions?: Money;
};

function toNumber(value: Money): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Overtime defaults to 1.5x the hourly rate derived from an 8-hour day. */
export function resolveOvertimeRate(dailyRate: Money, overtimeRate: Money): string {
  const explicit = toNumber(overtimeRate);
  if (explicit > 0) return round(explicit).toFixed(2);
  return round((toNumber(dailyRate) / 8) * 1.5).toFixed(2);
}

/**
 * Single source of truth for daily wage salary calculation. Numeric columns are
 * returned as strings by Postgres, so all inputs are normalised here.
 */
export function calculateWageTotals(input: WageCalculationInput): WageTotals {
  const workingDays = Math.max(0, toNumber(input.workingDays));
  const dailyRate = Math.max(0, toNumber(input.dailyRate));
  const overtimeHours = Math.max(0, toNumber(input.overtimeHours));

  const regularPay = round(workingDays * dailyRate);
  const overtimePay = overtimeHours > 0
    ? round(overtimeHours * toNumber(resolveOvertimeRate(dailyRate, input.overtimeRate)))
    : round(toNumber(input.approvedOvertime));
  const grossPay = round(regularPay + overtimePay);
  const deductions = Math.max(0, toNumber(input.approvedDeductions));
  const netPay = Math.max(0, round(grossPay - deductions));

  return { regularPay, overtimePay, grossPay, deductions, netPay };
}

export function paymentStatusFor(paidAmount: Money, total: Money): WagePaymentStatus {
  const paid = toNumber(paidAmount);
  const payable = toNumber(total);
  if (payable > 0 && paid >= payable - 0.005) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

export function paymentStatusLabel(status: WagePaymentStatus): string {
  return WAGE_PAYMENT_STATUS_LABELS[status] ?? status;
}

export async function wageLabels(companyId: number): Promise<Map<number, string>> {
  const rows = await db.select({ id: workforce.id, fullName: workforce.fullName, workerCode: workforce.workerCode })
    .from(workforce)
    .where(eq(workforce.companyId, companyId))
    .orderBy(asc(workforce.fullName));
  return new Map(rows.map((row) => [row.id, `${row.fullName} (${row.workerCode})`]));
}

export function wageDisplayLabel(
  wage: { workerId: number; periodStart: string; periodEnd: string },
  labels: Map<number, string>,
): string {
  const worker = labels.get(wage.workerId) ?? `Worker #${wage.workerId}`;
  return `${worker} · ${wage.periodStart} to ${wage.periodEnd}`;
}
