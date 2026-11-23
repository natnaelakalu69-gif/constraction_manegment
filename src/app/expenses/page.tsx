"use client";

import { useCallback, useEffect, useState } from "react";
import ModuleManager, { type ModuleSection } from "@/components/module-manager";
import { PaginationControls, usePagination } from "@/components/pagination";
import { fetchJson } from "@/lib/client-api";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/domain";
import type { ExpenseReport } from "@/lib/report-types";

const sections: ModuleSection[] = [
  {
    key: "budgets",
    title: "Project budgets",
    description: "Set planned amounts by cost code. These are the budget side of budget vs actual.",
    endpoint: "/api/modules/budgets",
    fields: [
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name", required: true },
      { name: "costCode", label: "Cost code", required: true, format: "businessCode" },
      { name: "description", label: "Description", required: true },
      { name: "plannedAmount", label: "Planned amount", type: "number", required: true },
    ],
    columns: [
      { key: "projectName", label: "Project" }, { key: "costCode", label: "Cost code" },
      { key: "description", label: "Description" }, { key: "plannedAmount", label: "Budget" },
    ],
  },
  {
    key: "project-costs",
    title: "Project expenses",
    description: "Record material, labor, equipment and other costs against a project and budget.",
    endpoint: "/api/modules/project-costs",
    fields: [
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name", required: true },
      { name: "budgetId", label: "Budget / cost code", type: "select", optionsFrom: "/api/modules/budgets", optionLabel: "displayLabel" },
      { name: "expenseCategory", label: "Expense type", type: "select", options: EXPENSE_CATEGORIES },
      { name: "category", label: "Category detail", required: true, placeholder: "e.g. Cement, Excavator fuel" },
      { name: "description", label: "Description" },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "incurredOn", label: "Incurred on", type: "date", required: true },
      { name: "reference", label: "Reference" },
    ],
    columns: [
      { key: "projectName", label: "Project" }, { key: "expenseCategoryLabel", label: "Type" },
      { key: "category", label: "Category" }, { key: "description", label: "Description" },
      { key: "amount", label: "Amount" }, { key: "incurredOn", label: "Date" },
    ],
  },
];

type Project = { id: number; name: string };

const CATEGORY_COLORS: Record<string, string> = {
  material: "bar-blue",
  labor: "bar-teal",
  equipment: "bar-orange",
  other: "bar-red",
};

function money(value: number): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ExpenseSummary() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<Project[]>("/api/modules/projects")
      .then(setProjects)
      .catch(() => { /* The summary still works without the project filter. */ });
  }, []);

  const load = useCallback(async () => {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    try {
      setReport(await fetchJson<ExpenseReport>(`/api/reports/expenses${query}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Expense summary could not be loaded.");
    }
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
    const onChange = () => { void load(); };
    window.addEventListener("module-change", onChange);
    return () => window.removeEventListener("module-change", onChange);
  }, [load]);

  const maxCategory = Math.max(1, ...(report?.byCategory.map((item) => item.amount) ?? [0]));
  const rows = report?.rows ?? [];
  const pagination = usePagination(rows.length);
  const visibleRows = pagination.pageSlice(rows);

  return (
    <section className="management-card">
      <div className="management-card-heading">
        <div>
          <h2>Budget vs actual cost</h2>
          <p>Planned budgets compared with recorded expenses, plus a breakdown by expense type.</p>
        </div>
        <div className="row-actions">
          <select
            className="summary-filter"
            aria-label="Filter by project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
          </select>
          <button className="button button-secondary" type="button" onClick={() => void load()}>Refresh</button>
        </div>
      </div>
      {error && <div className="management-message error-message" role="alert">{error}</div>}

      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <div className="metric-card">
          <div className="metric-caption">TOTAL BUDGET</div>
          <div className="metric-value">{money(report?.totals.budget ?? 0)}</div>
          <div className="metric-footnote">Planned amount across cost codes</div>
        </div>
        <div className="metric-card">
          <div className="metric-caption">ACTUAL COST</div>
          <div className="metric-value">{money(report?.totals.actual ?? 0)}</div>
          <div className="metric-footnote">Recorded project expenses</div>
        </div>
        <div className={`metric-card ${(report?.totals.variance ?? 0) < 0 ? "metric-card-alert" : ""}`}>
          <div className="metric-caption">VARIANCE</div>
          <div className="metric-value">{money(report?.totals.variance ?? 0)}</div>
          <div className="metric-footnote">Budget minus actual</div>
        </div>
        <div className="metric-card">
          <div className="metric-caption">UTILIZATION</div>
          <div className="metric-value">{money(report?.totals.utilization ?? 0)}%</div>
          <div className="metric-footnote">Actual as a share of budget</div>
        </div>
      </div>

      <div className="summary-subheading">Expenses by type</div>
      <div className="bar-list">
        {(report?.byCategory ?? []).map((item) => (
          <div className="bar-row" key={item.category}>
            <span className="bar-label">{EXPENSE_CATEGORY_LABELS[item.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? item.label}</span>
            <span className="bar-track"><span className={`bar-fill ${CATEGORY_COLORS[item.category] ?? "bar-blue"}`} style={{ width: `${(item.amount / maxCategory) * 100}%` }} /></span>
            <span className="bar-value">{money(item.amount)}</span>
          </div>
        ))}
      </div>

      <div className="summary-subheading">Cost code detail</div>
      <div className="management-table-wrap">
        <table className="management-table">
          <thead>
            <tr>
              <th scope="col">Project</th><th scope="col">Cost code</th><th scope="col">Description</th>
              <th scope="col">Budget</th><th scope="col">Actual</th><th scope="col">Variance</th><th scope="col">Used</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.projectId}-${row.costCode}-${row.budgetId ?? "unallocated"}`}>
                <td>{row.projectName}</td><td>{row.costCode}</td><td>{row.description}</td>
                <td>{money(row.budget)}</td><td>{money(row.actual)}</td>
                <td className={row.variance < 0 ? "variance-over" : "variance-under"}>{money(row.variance)}</td>
                <td>{money(row.utilization)}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="management-empty" colSpan={7}>No budgets or expenses yet. Add budgets above to see budget vs actual.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls pagination={pagination} />
    </section>
  );
}

export default function ExpensesPage() {
  return (
    <>
      <ModuleManager
        title="Expenses & budgets"
        subtitle="Material, labor, equipment and other project expenses with live budget vs actual reporting."
        sections={sections}
      />
      <div className="management-main" style={{ paddingTop: 0 }}>
        <ExpenseSummary />
      </div>
    </>
  );
}
