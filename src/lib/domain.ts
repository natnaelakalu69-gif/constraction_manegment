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

/** The dashboard filter adds an "all" option that is never stored on a worker. */
export const ALL_TRADES = "All Trades";
export const TRADE_FILTER_OPTIONS = [ALL_TRADES, ...TRADES] as const;

export function isTrade(value: string): value is Trade {
  return (TRADES as readonly string[]).includes(value);
}

/** Worker type values are stored with the enterprise employment type vocabulary. */
export const EMPLOYMENT_TYPES = ["employee", "day_labor", "contractor"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  employee: "Employee",
  day_labor: "Day Labor",
  contractor: "Contractor",
};

export function isEmploymentType(value: string): value is EmploymentType {
  return (EMPLOYMENT_TYPES as readonly string[]).includes(value);
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
