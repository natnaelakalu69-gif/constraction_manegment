import { eq } from "drizzle-orm";
import { db } from "@/db";
import { budgets, projectCosts, projects } from "@/db/schema/enterprise";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/domain";
import { getWorkspaceCompanyId } from "@/lib/workspace";
import type { BudgetVsActualRow, ExpenseReport } from "@/lib/report-types";

function toNumber(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function withVariance(row: BudgetVsActualRow): BudgetVsActualRow {
  return {
    ...row,
    variance: round(row.budget - row.actual),
    utilization: row.budget > 0 ? round((row.actual / row.budget) * 100) : 0,
  };
}

/** Company-scoped expense ledger aggregated by budget cost code and category. */
export async function buildExpenseReport(projectId?: number): Promise<ExpenseReport> {
  const companyId = await getWorkspaceCompanyId();
  const [budgetRows, costRows, projectRows] = await Promise.all([
    db.select().from(budgets).where(eq(budgets.companyId, companyId)),
    db.select().from(projectCosts).where(eq(projectCosts.companyId, companyId)),
    db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.companyId, companyId)),
  ]);

  const scopedBudgets = projectId ? budgetRows.filter((row) => row.projectId === projectId) : budgetRows;
  const scopedCosts = projectId ? costRows.filter((row) => row.projectId === projectId) : costRows;
  const projectNames = new Map(projectRows.map((row) => [row.id, row.name]));

  const allRows: BudgetVsActualRow[] = [];
  const byBudgetId = new Map<number, BudgetVsActualRow>();
  const unallocated = new Map<string, BudgetVsActualRow>();

  for (const budget of scopedBudgets) {
    const row: BudgetVsActualRow = {
      budgetId: budget.id,
      projectId: budget.projectId,
      projectName: projectNames.get(budget.projectId) ?? `Project #${budget.projectId}`,
      costCode: budget.costCode,
      description: budget.description,
      budget: toNumber(budget.plannedAmount),
      actual: 0,
      variance: 0,
      utilization: 0,
    };
    allRows.push(row);
    byBudgetId.set(budget.id, row);
  }

  for (const cost of scopedCosts) {
    const category = (EXPENSE_CATEGORIES.includes(cost.expenseCategory as ExpenseCategory)
      ? cost.expenseCategory
      : "other") as ExpenseCategory;
    let row = cost.budgetId ? byBudgetId.get(cost.budgetId) : undefined;

    if (!row) {
      const key = `${cost.projectId}:${category}`;
      row = unallocated.get(key);
      if (!row) {
        row = {
          budgetId: null,
          projectId: cost.projectId,
          projectName: projectNames.get(cost.projectId) ?? `Project #${cost.projectId}`,
          costCode: "UNALLOCATED",
          description: `${EXPENSE_CATEGORY_LABELS[category]} expenses without a budget`,
          budget: 0,
          actual: 0,
          variance: 0,
          utilization: 0,
        };
        unallocated.set(key, row);
        allRows.push(row);
      }
    }
    row.actual = round(row.actual + toNumber(cost.amount));
  }

  const rows = allRows.map(withVariance).sort((a, b) =>
    a.projectName.localeCompare(b.projectName) || a.costCode.localeCompare(b.costCode));

  const budget = round(rows.reduce((sum, row) => sum + row.budget, 0));
  const actual = round(rows.reduce((sum, row) => sum + row.actual, 0));
  const byCategory = EXPENSE_CATEGORIES.map((category) => ({
    category,
    label: EXPENSE_CATEGORY_LABELS[category],
    amount: round(scopedCosts
      .filter((cost) => (EXPENSE_CATEGORIES.includes(cost.expenseCategory as ExpenseCategory)
        ? cost.expenseCategory
        : "other") === category)
      .reduce((sum, cost) => sum + toNumber(cost.amount), 0)),
  }));

  return {
    projectId: projectId ?? null,
    totals: {
      budget,
      actual,
      variance: round(budget - actual),
      utilization: budget > 0 ? round((actual / budget) * 100) : 0,
    },
    byCategory,
    rows,
  };
}
