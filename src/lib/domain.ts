/** Shared option lists for the task, payroll and expense modules. */
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
