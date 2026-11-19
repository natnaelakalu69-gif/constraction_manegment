import { NextResponse } from "next/server";
import { and, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendance } from "@/db/schema";
import {
  dailyFollowUps, dailyPlanTasks, dailyPlans, dailySiteReports, inventoryTransactions,
  progressRecords, qualityDefects, safetyIncidents, safetyInspections,
} from "@/db/schema/enterprise";
import { getWorkspaceCompanyId } from "@/lib/workspace";

const PERIODS = ["daily", "weekly", "monthly", "yearly"] as const;
type Period = (typeof PERIODS)[number];

function reportRange(period: Period, date: string) {
  const anchor = new Date(`${date}T00:00:00.000Z`);
  let start: Date;
  let end: Date;

  if (period === "daily") {
    start = new Date(anchor);
    end = new Date(anchor);
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (period === "weekly") {
    const mondayOffset = (anchor.getUTCDay() + 6) % 7;
    start = new Date(anchor);
    start.setUTCDate(start.getUTCDate() - mondayOffset);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
  } else if (period === "monthly") {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  } else {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
    end = new Date(Date.UTC(anchor.getUTCFullYear() + 1, 0, 1));
  }

  return {
    start,
    end,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function bucketKey(value: string | Date | null, period: Period): string | null {
  if (!value) return null;
  const timestamp = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(timestamp.getTime())) return null;
  return period === "yearly" ? timestamp.toISOString().slice(0, 7) : timestamp.toISOString().slice(0, 10);
}

function addCount(target: Record<string, number>, key: string, amount = 1) {
  target[key] = (target[key] ?? 0) + amount;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const rawPeriod = params.get("period") ?? "daily";
  const date = params.get("date");
  if (!PERIODS.includes(rawPeriod as Period)) {
    return NextResponse.json({ error: "period must be daily, weekly, monthly or yearly." }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date query parameter is required (YYYY-MM-DD)." }, { status: 400 });
  }

  const period = rawPeriod as Period;
  const { start, end, startDate, endDate } = reportRange(period, date);
  const companyId = await getWorkspaceCompanyId();
  const startDay = startDate;
  const endDay = endDate;

  const [
    attendanceRows,
    plans,
    siteReports,
    progressRows,
    transactionRows,
    inspectionRows,
    incidentRows,
    openFollowUps,
    pendingReports,
    openDefects,
  ] = await Promise.all([
    db.select({ day: attendance.attendanceDate, status: attendance.status, value: count() })
      .from(attendance)
      .where(and(gte(attendance.attendanceDate, startDay), lt(attendance.attendanceDate, endDay)))
      .groupBy(attendance.attendanceDate, attendance.status),
    db.select({ id: dailyPlans.id, status: dailyPlans.status })
      .from(dailyPlans)
      .where(and(eq(dailyPlans.companyId, companyId), gte(dailyPlans.planDate, startDay), lt(dailyPlans.planDate, endDay))),
    db.select({ id: dailySiteReports.id, status: dailySiteReports.status, reportDate: dailySiteReports.reportDate, progress: dailySiteReports.progressPercent })
      .from(dailySiteReports)
      .where(and(eq(dailySiteReports.companyId, companyId), gte(dailySiteReports.reportDate, startDay), lt(dailySiteReports.reportDate, endDay))),
    db.select({
      value: count(),
      quantity: sql<string>`coalesce(sum(${progressRecords.quantityCompleted}), 0)`,
    })
      .from(progressRecords)
      .where(and(eq(progressRecords.companyId, companyId), gte(progressRecords.recordedOn, startDay), lt(progressRecords.recordedOn, endDay))),
    db.select({ movement: inventoryTransactions.movement, occurredAt: inventoryTransactions.occurredAt, quantity: inventoryTransactions.quantity })
      .from(inventoryTransactions)
      .where(and(eq(inventoryTransactions.companyId, companyId), gte(inventoryTransactions.occurredAt, start), lt(inventoryTransactions.occurredAt, end))),
    db.select({ value: count() })
      .from(safetyInspections)
      .where(and(eq(safetyInspections.companyId, companyId), gte(safetyInspections.inspectionDate, startDay), lt(safetyInspections.inspectionDate, endDay))),
    db.select({ severity: safetyIncidents.severity, occurredAt: safetyIncidents.occurredAt })
      .from(safetyIncidents)
      .where(and(eq(safetyIncidents.companyId, companyId), gte(safetyIncidents.occurredAt, start), lt(safetyIncidents.occurredAt, end))),
    db.select({ value: count() })
      .from(dailyFollowUps)
      .where(and(eq(dailyFollowUps.companyId, companyId), inArray(dailyFollowUps.status, ["open", "in_progress"]))),
    db.select({ value: count() })
      .from(dailySiteReports)
      .where(and(eq(dailySiteReports.companyId, companyId), inArray(dailySiteReports.status, ["submitted", "draft"]))),
    db.select({ value: count() })
      .from(qualityDefects)
      .where(and(eq(qualityDefects.companyId, companyId), inArray(qualityDefects.status, ["draft", "submitted", "rejected"]))),
  ]);

  const planIds = plans.map((plan) => plan.id);
  const taskRows = planIds.length > 0
    ? await db.select({ status: dailyPlanTasks.status, value: count() })
      .from(dailyPlanTasks)
      .where(inArray(dailyPlanTasks.planId, planIds))
      .groupBy(dailyPlanTasks.status)
    : [];

  const attendanceByStatus: Record<string, number> = {};
  const attendanceByDate: Record<string, Record<string, number>> = {};
  for (const row of attendanceRows) {
    addCount(attendanceByStatus, row.status, row.value);
    const key = row.day ?? "unknown";
    attendanceByDate[key] ??= {};
    addCount(attendanceByDate[key], row.status, row.value);
  }

  const planByStatus: Record<string, number> = {};
  for (const plan of plans) addCount(planByStatus, plan.status);
  const taskByStatus: Record<string, number> = {};
  for (const row of taskRows) addCount(taskByStatus, row.status, row.value);

  const siteReportByStatus: Record<string, number> = {};
  const progressValues: number[] = [];
  for (const report of siteReports) {
    addCount(siteReportByStatus, report.status);
    const value = Number(report.progress);
    if (Number.isFinite(value)) progressValues.push(value);
  }

  const movementTotals: Record<string, { count: number; quantity: number }> = {};
  for (const row of transactionRows) {
    movementTotals[row.movement] ??= { count: 0, quantity: 0 };
    movementTotals[row.movement].count += 1;
    movementTotals[row.movement].quantity += Number(row.quantity ?? 0);
  }

  const incidentBySeverity: Record<string, number> = {};
  for (const row of incidentRows) addCount(incidentBySeverity, row.severity);

  const timelineKeys = new Set<string>();
  const addTimeline = (key: string | null) => { if (key) timelineKeys.add(key); };
  for (const row of attendanceRows) addTimeline(bucketKey(row.day, period));
  for (const report of siteReports) addTimeline(bucketKey(report.reportDate, period));
  for (const row of transactionRows) addTimeline(bucketKey(row.occurredAt, period));
  for (const row of incidentRows) addTimeline(bucketKey(row.occurredAt, period));

  const attendanceTimeline: Record<string, number> = {};
  for (const row of attendanceRows) {
    const key = bucketKey(row.day, period);
    if (key) attendanceTimeline[key] = (attendanceTimeline[key] ?? 0) + row.value;
  }
  const reportTimeline: Record<string, number> = {};
  for (const report of siteReports) {
    const key = bucketKey(report.reportDate, period);
    if (key) reportTimeline[key] = (reportTimeline[key] ?? 0) + 1;
  }
  const materialTimeline: Record<string, number> = {};
  for (const row of transactionRows) {
    const key = bucketKey(row.occurredAt, period);
    if (key) materialTimeline[key] = (materialTimeline[key] ?? 0) + 1;
  }
  const incidentTimeline: Record<string, number> = {};
  for (const row of incidentRows) {
    const key = bucketKey(row.occurredAt, period);
    if (key) incidentTimeline[key] = (incidentTimeline[key] ?? 0) + 1;
  }

  const timeline = Array.from(timelineKeys).sort().map((key) => ({
    key,
    attendance: attendanceTimeline[key] ?? 0,
    siteReports: reportTimeline[key] ?? 0,
    materialMovements: materialTimeline[key] ?? 0,
    incidents: incidentTimeline[key] ?? 0,
  }));

  const totalAttendance = Object.values(attendanceByStatus).reduce((sum, value) => sum + value, 0);
  const totalMaterialMovements = Object.values(movementTotals).reduce((sum, item) => sum + item.count, 0);

  return NextResponse.json({
    period,
    anchorDate: date,
    startDate,
    endDate,
    attendance: {
      total: totalAttendance,
      byStatus: attendanceByStatus,
      byDate: Object.entries(attendanceByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, counts]) => ({ day, ...counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) })),
    },
    operations: {
      plans: plans.length,
      planByStatus,
      tasks: taskRows.reduce((sum, row) => sum + row.value, 0),
      taskByStatus,
      siteReports: siteReports.length,
      siteReportByStatus,
      averageProgress: progressValues.length
        ? Math.round((progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length) * 100) / 100
        : null,
      progressRecords: progressRows[0]?.value ?? 0,
      progressQuantity: Number(progressRows[0]?.quantity ?? 0),
      inspections: inspectionRows[0]?.value ?? 0,
      incidents: incidentRows.length,
      incidentBySeverity,
      materialMovements: totalMaterialMovements,
    },
    materials: Object.entries(movementTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([movement, totals]) => ({ movement, ...totals })),
    outstanding: {
      followUps: openFollowUps[0]?.value ?? 0,
      pendingReports: pendingReports[0]?.value ?? 0,
      openDefects: openDefects[0]?.value ?? 0,
    },
    timeline,
  });
}
