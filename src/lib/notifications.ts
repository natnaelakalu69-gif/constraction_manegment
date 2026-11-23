/** Shared notification vocabulary used by the API, inbox page and header badge. */
export const NOTIFICATION_TYPES = [
  "late_worker",
  "absence",
  "safety_incident",
  "material_shortage",
  "task_deadline",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  late_worker: "Late workers",
  absence: "Absences",
  safety_incident: "Safety incidents",
  material_shortage: "Material shortages",
  task_deadline: "Task deadlines",
};

export type NotificationSeverity = "critical" | "warning" | "info";

export type NotificationItem = {
  /** Stable key derived from the source record, used for read/dismiss state. */
  id: string;
  type: NotificationType;
  typeLabel: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  href: string;
  occurredAt: string | null;
  recordId: number;
};

export type NotificationBundle = {
  date: string;
  generatedAt: string;
  notifications: NotificationItem[];
  counts: Record<NotificationType, number>;
  total: number;
};
