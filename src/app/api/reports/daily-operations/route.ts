import { NextResponse } from "next/server";
import { and, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendance, sites as constructionSites, workers } from "@/db/schema";
import {
  dailyFollowUps, dailyPlanTasks, dailyPlans, dailySiteReports, inventoryTransactions, materials,
  progressRecords, projects, qualityDefects, safetyIncidents, safetyInspections,
} from "@/db/schema/enterprise";
import { getWorkspaceCompanyId } from "@/lib/workspace";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date query parameter is required (YYYY-MM-DD)." }, { status: 400 });
  }
  const companyId = await getWorkspaceCompanyId();
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const [
    attendanceRows,
    attendanceByStatus,
    plans,
    planTasks,
    siteReports,
    progress,
    transactions,
    materialBalances,
    inspections,
    incidents,
    followUps,
    openDefects,
  ] = await Promise.all([
    db.select({
      id: attendance.id,
      workerId: attendance.workerId,
      workerName: workers.fullName,
      workerCode: workers.workerCode,
      siteId: attendance.siteId,
      siteName: constructionSites.siteName,
      status: attendance.status,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      notes: attendance.notes,
      loggedInAt: attendance.loggedInAt,
    }).from(attendance)
      .leftJoin(workers, eq(attendance.workerId, workers.id))
      .leftJoin(constructionSites, eq(attendance.siteId, constructionSites.id))
      .where(eq(attendance.attendanceDate, date))
      .orderBy(desc(attendance.id)),
    db.select({ status: attendance.status, count: count() }).from(attendance).where(eq(attendance.attendanceDate, date)).groupBy(attendance.status),
    db.select().from(dailyPlans).where(and(eq(dailyPlans.companyId, companyId), eq(dailyPlans.planDate, date))).orderBy(desc(dailyPlans.id)),
    db.select().from(dailyPlanTasks).where(eq(dailyPlanTasks.companyId, companyId)).orderBy(desc(dailyPlanTasks.id)),
    db.select({
      id: dailySiteReports.id, reportDate: dailySiteReports.reportDate, planId: dailySiteReports.planId,
      projectId: dailySiteReports.projectId, siteId: dailySiteReports.siteId, supervisorName: dailySiteReports.supervisorName,
      completedWork: dailySiteReports.completedWork, progressPercent: dailySiteReports.progressPercent, photos: dailySiteReports.photos,
      challenges: dailySiteReports.challenges, delays: dailySiteReports.delays, status: dailySiteReports.status,
      reviewNotes: dailySiteReports.reviewNotes, reviewedBy: dailySiteReports.reviewedBy, projectName: projects.name,
    }).from(dailySiteReports)
      .leftJoin(projects, eq(dailySiteReports.projectId, projects.id))
      .where(and(eq(dailySiteReports.companyId, companyId), eq(dailySiteReports.reportDate, date)))
      .orderBy(desc(dailySiteReports.id)),
    db.select().from(progressRecords).where(and(eq(progressRecords.companyId, companyId), eq(progressRecords.recordedOn, date))).orderBy(desc(progressRecords.id)),
    db.select({
      id: inventoryTransactions.id, materialId: inventoryTransactions.materialId, materialName: materials.name, materialUnit: materials.unit,
      movement: inventoryTransactions.movement, quantity: inventoryTransactions.quantity, unitCost: inventoryTransactions.unitCost,
      notes: inventoryTransactions.notes, occurredAt: inventoryTransactions.occurredAt,
    }).from(inventoryTransactions)
      .leftJoin(materials, eq(inventoryTransactions.materialId, materials.id))
      .where(and(eq(inventoryTransactions.companyId, companyId), gte(inventoryTransactions.occurredAt, dayStart), lt(inventoryTransactions.occurredAt, dayEnd)))
      .orderBy(desc(inventoryTransactions.id)),
    db.select({
      id: materials.id, sku: materials.sku, name: materials.name, unit: materials.unit, minimumStock: materials.minimumStock,
      received: sql<string>`coalesce(sum(case when ${inventoryTransactions.movement} in ('receipt','return','transfer_in') then ${inventoryTransactions.quantity}::numeric else 0 end), 0)`,
      issued: sql<string>`coalesce(sum(case when ${inventoryTransactions.movement} in ('issue','transfer_out','wastage') then ${inventoryTransactions.quantity}::numeric else 0 end), 0)`,
      adjusted: sql<string>`coalesce(sum(case when ${inventoryTransactions.movement} = 'adjustment' then ${inventoryTransactions.quantity}::numeric else 0 end), 0)`,
      remaining: sql<string>`coalesce(sum(case when ${inventoryTransactions.movement} in ('receipt','return','transfer_in','adjustment') then ${inventoryTransactions.quantity}::numeric when ${inventoryTransactions.movement} in ('issue','transfer_out','wastage') then -${inventoryTransactions.quantity}::numeric else 0 end), 0)`,
    }).from(materials)
      .leftJoin(inventoryTransactions, and(eq(inventoryTransactions.materialId, materials.id), eq(inventoryTransactions.companyId, companyId)))
      .where(eq(materials.companyId, companyId))
      .groupBy(materials.id)
      .orderBy(materials.name),
    db.select().from(safetyInspections).where(and(eq(safetyInspections.companyId, companyId), eq(safetyInspections.inspectionDate, date))).orderBy(desc(safetyInspections.id)),
    db.select().from(safetyIncidents).where(and(eq(safetyIncidents.companyId, companyId), gte(safetyIncidents.occurredAt, dayStart), lt(safetyIncidents.occurredAt, dayEnd))).orderBy(desc(safetyIncidents.id)),
    db.select().from(dailyFollowUps).where(and(eq(dailyFollowUps.companyId, companyId), inArray(dailyFollowUps.status, ["open", "in_progress"]))).orderBy(desc(dailyFollowUps.id)),
    db.select().from(qualityDefects).where(and(eq(qualityDefects.companyId, companyId), inArray(qualityDefects.status, ["draft", "submitted", "rejected"]))).orderBy(desc(qualityDefects.id)),
  ]);

  const planIds = new Set(plans.map((p) => p.id));
  const tasksForDay = planTasks.filter((t) => planIds.has(t.planId));
  const pendingReports = await db.select().from(dailySiteReports).where(and(eq(dailySiteReports.companyId, companyId), inArray(dailySiteReports.status, ["submitted", "draft"]))).orderBy(desc(dailySiteReports.reportDate), desc(dailySiteReports.id));

  const attendanceSummary = Object.fromEntries(attendanceByStatus.map((r) => [r.status, Number(r.count)]));
  return NextResponse.json({
    date,
    attendance: {
      summary: attendanceSummary,
      total: Object.values(attendanceSummary).reduce((a, b) => a + b, 0),
      records: attendanceRows,
    },
    plans: plans.map((plan) => ({ ...plan, tasks: tasksForDay.filter((t) => t.planId === plan.id) })),
    progress: {
      siteReports,
      progressRecords: progress,
    },
    materials: {
      transactions,
      stock: materialBalances,
    },
    safety: {
      inspections,
      incidents,
    },
    outstandingIssues: {
      followUps,
      pendingReports,
      openDefects,
    },
  });
}
