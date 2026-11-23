export type Period = "daily" | "weekly" | "monthly" | "yearly";

export type PeriodReport = {
  period: Period;
  anchorDate: string;
  startDate: string;
  endDate: string;
  attendance: {
    total: number;
    byStatus: Record<string, number>;
    byDate: Array<Record<string, string | number>>;
  };
  operations: {
    plans: number;
    planByStatus: Record<string, number>;
    tasks: number;
    taskByStatus: Record<string, number>;
    siteReports: number;
    siteReportByStatus: Record<string, number>;
    averageProgress: number | null;
    progressRecords: number;
    progressQuantity: number;
    inspections: number;
    incidents: number;
    incidentBySeverity: Record<string, number>;
    materialMovements: number;
  };
  materials: Array<{ movement: string; count: number; quantity: number }>;
  outstanding: { followUps: number; pendingReports: number; openDefects: number };
  timeline: Array<{
    key: string;
    attendance: number;
    siteReports: number;
    materialMovements: number;
    incidents: number;
  }>;
};

export type ExecutiveSummary = {
  anchorDate: string;
  generatedAt: string;
  counts: {
    projects: number;
    activeProjects: number;
    sites: number;
    activeSites: number;
    workers: number;
    activeWorkers: number;
  };
  periods: Record<Period, PeriodReport>;
};

export type BudgetVsActualRow = {
  budgetId: number | null;
  projectId: number;
  projectName: string;
  costCode: string;
  description: string;
  budget: number;
  actual: number;
  variance: number;
  utilization: number;
};

export type ExpenseReport = {
  projectId: number | null;
  totals: {
    budget: number;
    actual: number;
    variance: number;
    utilization: number;
  };
  byCategory: Array<{ category: string; label: string; amount: number }>;
  rows: BudgetVsActualRow[];
};
