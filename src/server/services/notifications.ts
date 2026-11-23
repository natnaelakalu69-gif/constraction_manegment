import { and, asc, desc, eq, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendance, sites as constructionSites, workers as legacyWorkers } from "@/db/schema";
import { inventoryTransactions, materials, safetyIncidents, workTasks } from "@/db/schema/enterprise";
import {
  NOTIFICATION_TYPE_LABELS, type NotificationBundle, type NotificationItem,
  type NotificationSeverity, type NotificationType,
} from "@/lib/notifications";

const SEVERITY_RANK: Record<NotificationSeverity, number> = { critical: 0, warning: 1, info: 2 };

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function makeItem(
  type: NotificationType,
  recordId: number,
  severity: NotificationSeverity,
  title: string,
  body: string,
  href: string,
  occurredAt: string | null,
): NotificationItem {
  return {
    id: `${type}:${recordId}`,
    type,
    typeLabel: NOTIFICATION_TYPE_LABELS[type],
    severity,
    title,
    body,
    href,
    occurredAt,
    recordId,
  };
}

/**
 * Notifications are derived from live operational records rather than stored
 * copies, so resolving a source record removes its alert immediately.
 */
export async function getNotifications(companyId: number, date: string): Promise<NotificationBundle> {
  const horizon = new Date(`${date}T00:00:00.000Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 7);
  const horizonDate = horizon.toISOString().slice(0, 10);

  const [attendanceRows, incidents, stockRows, tasks] = await Promise.all([
    db.select({
      id: attendance.id,
      workerId: attendance.workerId,
      workerName: legacyWorkers.fullName,
      workerCode: legacyWorkers.workerCode,
      siteName: constructionSites.siteName,
      status: attendance.status,
      checkIn: attendance.checkIn,
      loggedInAt: attendance.loggedInAt,
    }).from(attendance)
      .leftJoin(legacyWorkers, eq(attendance.workerId, legacyWorkers.id))
      .leftJoin(constructionSites, eq(attendance.siteId, constructionSites.id))
      .where(eq(attendance.attendanceDate, date))
      .orderBy(desc(attendance.id)),

    db.select({
      id: safetyIncidents.id,
      incidentNumber: safetyIncidents.incidentNumber,
      incidentType: safetyIncidents.incidentType,
      severity: safetyIncidents.severity,
      description: safetyIncidents.description,
      occurredAt: safetyIncidents.occurredAt,
    }).from(safetyIncidents)
      .where(and(
        eq(safetyIncidents.companyId, companyId),
        inArray(safetyIncidents.status, ["draft", "submitted", "approved"]),
      ))
      .orderBy(desc(safetyIncidents.occurredAt))
      .limit(50),

    db.select({
      id: materials.id,
      sku: materials.sku,
      name: materials.name,
      unit: materials.unit,
      minimumStock: materials.minimumStock,
      remaining: sql<string>`coalesce(sum(case
        when ${inventoryTransactions.movement} in ('receipt', 'return', 'transfer_in', 'adjustment')
          then ${inventoryTransactions.quantity}::numeric
        when ${inventoryTransactions.movement} in ('issue', 'transfer_out', 'wastage')
          then -${inventoryTransactions.quantity}::numeric
        else 0 end), 0)`,
    }).from(materials)
      .leftJoin(inventoryTransactions, and(
        eq(inventoryTransactions.materialId, materials.id),
        eq(inventoryTransactions.companyId, companyId),
      ))
      .where(eq(materials.companyId, companyId))
      .groupBy(materials.id)
      .orderBy(asc(materials.name)),

    db.select({
      id: workTasks.id,
      title: workTasks.title,
      deadline: workTasks.deadline,
      status: workTasks.status,
      priority: workTasks.priority,
      supervisorName: workTasks.supervisorName,
    }).from(workTasks)
      .where(and(
        eq(workTasks.companyId, companyId),
        ne(workTasks.status, "completed"),
        isNotNull(workTasks.deadline),
        lte(workTasks.deadline, horizonDate),
      ))
      .orderBy(asc(workTasks.deadline))
      .limit(100),
  ]);

  const notifications: NotificationItem[] = [];

  for (const row of attendanceRows) {
    const worker = row.workerName ?? `Worker #${row.workerId}`;
    const site = row.siteName ? ` · ${row.siteName}` : "";
    const when = iso(row.loggedInAt);
    if (row.status === "LATE") {
      notifications.push(makeItem(
        "late_worker", row.id, "warning",
        `${worker} was marked late`,
        `${date}${site}${row.checkIn ? ` · Check-in ${row.checkIn.slice(0, 5)}` : ""}`,
        "/attendance", when,
      ));
    } else if (row.status === "ABSENT") {
      notifications.push(makeItem(
        "absence", row.id, "critical",
        `${worker} was marked absent`,
        `${date}${site} · Follow up with the site supervisor`,
        "/attendance", when,
      ));
    }
  }

  for (const incident of incidents) {
    const highSeverity = incident.severity === "high" || incident.severity === "critical";
    notifications.push(makeItem(
      "safety_incident", incident.id, highSeverity ? "critical" : "warning",
      `${incident.incidentNumber}: ${incident.incidentType}`,
      `${incident.severity || "unspecified"} severity · ${incident.description || "Review the reported incident."}`,
      "/safety", iso(incident.occurredAt),
    ));
  }

  for (const material of stockRows) {
    const minimum = Number(material.minimumStock ?? 0);
    const remaining = Number(material.remaining ?? 0);
    if (minimum <= 0 || remaining >= minimum) continue;
    notifications.push(makeItem(
      "material_shortage", material.id, remaining <= 0 ? "critical" : "warning",
      `${material.name} is below minimum stock`,
      `${material.sku} · ${remaining} ${material.unit ?? ""} remaining / ${minimum} minimum`.trim(),
      "/materials", null,
    ));
  }

  for (const task of tasks) {
    const deadline = task.deadline ?? "";
    const overdue = deadline < date;
    notifications.push(makeItem(
      "task_deadline", task.id, overdue ? "critical" : "warning",
      task.title,
      overdue
        ? `Overdue since ${deadline} · ${task.status} · ${task.supervisorName}`
        : `Due ${deadline} · ${task.status} · ${task.supervisorName}`,
      "/tasks", deadline,
    ));
  }

  notifications.sort((a, b) =>
    (b.occurredAt ?? "").localeCompare(a.occurredAt ?? "")
    || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const counts = Object.fromEntries(
    (Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]).map((type) => [type, 0]),
  ) as Record<NotificationType, number>;
  for (const notification of notifications) counts[notification.type] += 1;

  return {
    date,
    generatedAt: new Date().toISOString(),
    notifications,
    counts,
    total: notifications.length,
  };
}
