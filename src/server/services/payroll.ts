import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { wageSettings, workers as workforce } from "@/db/schema/enterprise";
import { WAGE_PAYMENT_STATUS_LABELS, type WagePaymentStatus } from "@/lib/domain";

type Money = string | number | null | undefined;

export type WageConfig = { hoursPerDay: number; overtimeMultiplier: number };
export const DEFAULT_WAGE_CONFIG: WageConfig = { hoursPerDay: 8, overtimeMultiplier: 1.5 };

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

function normaliseConfig(config?: WageConfig): WageConfig {
  return {
    hoursPerDay: config && config.hoursPerDay > 0 ? config.hoursPerDay : DEFAULT_WAGE_CONFIG.hoursPerDay,
    overtimeMultiplier: config && config.overtimeMultiplier > 0 ? config.overtimeMultiplier : DEFAULT_WAGE_CONFIG.overtimeMultiplier,
  };
}

/** Overtime rate falls back to the active wage settings (default 1.5x hourly). */
export function resolveOvertimeRate(dailyRate: Money, overtimeRate: Money, config?: WageConfig): string {
  const explicit = toNumber(overtimeRate);
  if (explicit > 0) return round(explicit).toFixed(2);
  const { hoursPerDay, overtimeMultiplier } = normaliseConfig(config);
  return round((toNumber(dailyRate) / hoursPerDay) * overtimeMultiplier).toFixed(2);
}

/**
 * Single source of truth for daily wage salary calculation. Numeric columns are
 * returned as strings by Postgres, so all inputs are normalised here.
 */
export function calculateWageTotals(input: WageCalculationInput, config?: WageConfig): WageTotals {
  const workingDays = Math.max(0, toNumber(input.workingDays));
  const dailyRate = Math.max(0, toNumber(input.dailyRate));
  const overtimeHours = Math.max(0, toNumber(input.overtimeHours));

  const regularPay = round(workingDays * dailyRate);
  const overtimePay = overtimeHours > 0
    ? round(overtimeHours * toNumber(resolveOvertimeRate(dailyRate, input.overtimeRate, config)))
    : round(toNumber(input.approvedOvertime));
  const grossPay = round(regularPay + overtimePay);
  const deductions = Math.max(0, toNumber(input.approvedDeductions));
  const netPay = Math.max(0, round(grossPay - deductions));

  return { regularPay, overtimePay, grossPay, deductions, netPay };
}

/** Active wage settings drive overtime calculations; defaults apply when unset. */
export async function getWageConfig(companyId: number): Promise<WageConfig> {
  const [settings] = await db.select().from(wageSettings)
    .where(and(eq(wageSettings.companyId, companyId), eq(wageSettings.isActive, true)))
    .orderBy(desc(wageSettings.id))
    .limit(1);
  if (!settings) return DEFAULT_WAGE_CONFIG;
  return normaliseConfig({
    hoursPerDay: toNumber(settings.regularHoursPerDay),
    overtimeMultiplier: toNumber(settings.overtimeMultiplier),
  });
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
