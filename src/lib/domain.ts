/** Shared option lists for the workforce, task, payroll and expense modules. */

/** Construction trades offered in the workforce registration form. */
export const TRADES = [
  "Mason",
  "Carpenter",
  "Electrician",
  "Plumber",
  "Steel Fixer",
  "Welder",
  "Painter",
  "Rigger",
  "Operator",
  "General Laborer",
  "Tiler",
  "Roofer",
  "Scaffolder",
  "HVAC Technician",
  "Surveyor",
  "Heavy Equipment Mechanic",
  "Foreman",
  "Site Supervisor",
  "Safety Officer",
] as const;

export type Trade = (typeof TRADES)[number];

/** "All Trades" shows the whole roster; "Other" reveals a custom-type input. */
export const ALL_TRADES = "All Trades";
export const OTHER_EMPLOYMENT_TYPE = "Other";
export const CUSTOM_EMPLOYMENT_TYPE = "Custom type";
export const EMPLOYMENT_TYPE_MAX_LENGTH = 80;

/** The dropdown suggestions include a Custom type option that reveals a text field. */
export const EMPLOYMENT_TYPE_OPTIONS = [
  ALL_TRADES,
  ...TRADES,
  OTHER_EMPLOYMENT_TYPE,
  CUSTOM_EMPLOYMENT_TYPE,
] as const;

/** Older employee/day_labor/contractor rows fall back to their trade or position. */
export const LEGACY_EMPLOYMENT_TYPES = ["employee", "day_labor", "contractor"] as const;

export function isLegacyEmploymentType(value: string): boolean {
  return (LEGACY_EMPLOYMENT_TYPES as readonly string[]).includes(value.trim().toLowerCase());
}

export const TASK_STATUSES = ["pending", "in_progress", "completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

export const ASSIGNEE_TYPES = ["worker", "team"] as const;
export type AssigneeType = (typeof ASSIGNEE_TYPES)[number];

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const WAGE_PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
export type WagePaymentStatus = (typeof WAGE_PAYMENT_STATUSES)[number];

export const WAGE_PAYMENT_STATUS_LABELS: Record<WagePaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Part paid",
  paid: "Paid",
};

export const EXPENSE_CATEGORIES = ["material", "labor", "equipment", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  material: "Material",
  labor: "Labor",
  equipment: "Equipment",
  other: "Other",
};

export const PAYMENT_FREQUENCIES = ["daily", "weekly", "biweekly", "monthly"] as const;
export const BOOLEAN_OPTIONS = ["true", "false"] as const;
export const RECORD_STATUSES = ["active", "inactive", "archived"] as const;

/** Document register categories and the module resource that owns each one. */
export const DOCUMENT_CATEGORIES = ["contract", "project", "drawing", "permit", "safety", "delivery"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_RESOURCE_CATEGORIES: Record<string, DocumentCategory> = {
  "contract-documents": "contract",
  "project-documents": "project",
  drawings: "drawing",
  permits: "permit",
  "safety-documents": "safety",
  "delivery-documents": "delivery",
};
