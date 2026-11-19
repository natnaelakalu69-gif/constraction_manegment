"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { ReportExportButtons } from "@/components/report-export-buttons";
import { statusRows, type CsvRow } from "@/lib/report-export";
import type { ExecutiveSummary, Period, PeriodReport } from "@/lib/report-types";

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

type LoadedSummary = { key: string; data: ExecutiveSummary } | { key: string; error: string };

function executiveCsvRows(summary: ExecutiveSummary): CsvRow[] {
  const rows: CsvRow[] = [
    ["Executive summary", summary.anchorDate],
    ["Generated", summary.generatedAt],
    [],
    ["Resource", "Total", "Active"],
    ["Projects", summary.counts.projects, summary.counts.activeProjects],
    ["Sites", summary.counts.sites, summary.counts.activeSites],
    ["Workers", summary.counts.workers, summary.counts.activeWorkers],
    [],
    ["Period comparison", "Range", "Attendance", "Plans", "Tasks", "Site reports", "Avg progress", "Material movements", "Inspections", "Incidents", "Outstanding"],
  ];

  for (const { key, label } of PERIODS) {
    const report = summary.periods[key];
    rows.push([
      label,
      `${report.startDate} to ${report.endDate}`,
      report.attendance.total,
      report.operations.plans,
      report.operations.tasks,
      report.operations.siteReports,
      report.operations.averageProgress ?? "",
      report.operations.materialMovements,
      report.operations.inspections,
      report.operations.incidents,
      report.outstanding.followUps + report.outstanding.pendingReports + report.outstanding.openDefects,
    ]);
  }

  rows.push([], ["Yearly activity by month", "Attendance", "Site reports", "Material movements", "Incidents"]);
  for (const row of summary.periods.yearly.timeline) {
    rows.push([row.key, row.attendance, row.siteReports, row.materialMovements, row.incidents]);
  }
  rows.push([], ...statusRows("Attendance status (year)", summary.periods.yearly.attendance.byStatus));
  rows.push([], ...statusRows("Site report status (year)", summary.periods.yearly.operations.siteReportByStatus));
  rows.push([], ...statusRows("Incident severity (year)", summary.periods.yearly.operations.incidentBySeverity));
  return rows;
}

function totalOutstanding(report: PeriodReport) {
  return report.outstanding.followUps + report.outstanding.pendingReports + report.outstanding.openDefects;
}

function BarChart({ title, note, items, tone = "blue" }: {
  title: string;
  note?: string;
  items: Array<{ label: string; value: number }>;
  tone?: "blue" | "teal" | "orange" | "red";
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <section className="management-card">
      <div className="management-card-heading"><h2>{title}</h2>{note && <p>{note}</p>}</div>
      {items.length === 0 ? (
        <p className="management-empty">No data available.</p>
      ) : (
        <div className="bar-list">
          {items.map((item) => (
            <div className="bar-row" key={item.label}>
              <span className="bar-label">{item.label}</span>
              <span className="bar-track"><span className={`bar-fill bar-${tone}`} style={{ width: `${(item.value / max) * 100}%` }} /></span>
              <span className="bar-value">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MiniBar({ value, max, tone }: { value: number; max: number; tone: "blue" | "teal" | "orange" | "red" }) {
  return (
    <span className="mini-bar-cell">
      <span className={`mini-bar mini-${tone}`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      <span>{value}</span>
    </span>
  );
}

export default function ExecutiveSummaryPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [state, setState] = useState<LoadedSummary | null>(null);

  useEffect(() => {
    let active = true;
    void fetchJson<ExecutiveSummary>(`/api/reports/executive?date=${encodeURIComponent(date)}`)
      .then((data) => { if (active) setState({ key: date, data }); })
      .catch((e: unknown) => {
        if (active) setState({ key: date, error: e instanceof Error ? e.message : "Summary could not be loaded." });
      });
    return () => { active = false; };
  }, [date]);

  const loading = state?.key !== date;
  const summary = state && "data" in state ? state.data : null;
  const error = state && "error" in state ? state.error : null;

  return (
    <main className="management-main">
      <section className="management-heading">
        <div>
          <div className="eyebrow">EXECUTIVE REPORTING</div>
          <h1>Executive summary</h1>
          <p className="page-subtitle">Portfolio-wide KPIs and daily, weekly, monthly and yearly comparisons.</p>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Anchor date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </section>

      {error && <div className="management-message error-message" role="alert">{error}</div>}
      {loading && <div className="management-card"><p>Generating executive summary…</p></div>}

      {summary && !loading && (
        <>
          <div className="print-report-heading">
            <h2>Executive summary — {summary.anchorDate}</h2>
            <p>Construction operations · portfolio KPIs and period comparison</p>
          </div>
          <div className="report-toolbar">
            <span>Generated {new Date(summary.generatedAt).toLocaleString()} · anchored on <strong>{summary.anchorDate}</strong></span>
            <ReportExportButtons filename={`executive-summary-${summary.anchorDate}.csv`} buildRows={() => executiveCsvRows(summary)} />
          </div>

          <section className="management-card">
            <div className="management-card-heading"><h2>Key metrics</h2><p>Current records and attendance totals for each reporting period.</p></div>
            <div className="metrics-grid">
              <div className="metric-card metric-card-accent">
                <div className="metric-caption">PROJECTS</div>
                <div className="metric-value">{summary.counts.projects}</div>
                <div className="metric-label">{summary.counts.activeProjects} active</div>
              </div>
              <div className="metric-card metric-card-accent">
                <div className="metric-caption">SITES</div>
                <div className="metric-value">{summary.counts.sites}</div>
                <div className="metric-label">{summary.counts.activeSites} active</div>
              </div>
              <div className="metric-card metric-card-accent">
                <div className="metric-caption">WORKFORCE</div>
                <div className="metric-value">{summary.counts.workers}</div>
                <div className="metric-label">{summary.counts.activeWorkers} active</div>
              </div>
              <div className="metric-card metric-card-alert">
                <div className="metric-caption">OUTSTANDING</div>
                <div className="metric-value">{totalOutstanding(summary.periods.yearly)}</div>
                <div className="metric-label">open items</div>
              </div>
              {PERIODS.map(({ key, label }) => (
                <div key={key} className="metric-card">
                  <div className="metric-caption">ATTENDANCE — {label.toUpperCase()}</div>
                  <div className="metric-value">{summary.periods[key].attendance.total}</div>
                  <div className="metric-label">{summary.periods[key].startDate} to {summary.periods[key].endDate}</div>
                </div>
              ))}
              <div className="metric-card">
                <div className="metric-caption">AVG PROGRESS — YEAR</div>
                <div className="metric-value">{summary.periods.yearly.operations.averageProgress === null ? "—" : `${summary.periods.yearly.operations.averageProgress}%`}</div>
                <div className="metric-label">across site reports</div>
              </div>
              <div className="metric-card">
                <div className="metric-caption">SAFETY — YEAR</div>
                <div className="metric-value">{summary.periods.yearly.operations.inspections} / {summary.periods.yearly.operations.incidents}</div>
                <div className="metric-label">inspections / incidents</div>
              </div>
            </div>
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Period comparison</h2><p>Same metrics viewed over four different ranges.</p></div>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead>
                  <tr>
                    <th scope="col">Period</th><th scope="col">Range</th><th scope="col">Attendance</th>
                    <th scope="col">Plans</th><th scope="col">Tasks</th><th scope="col">Site reports</th>
                    <th scope="col">Avg progress</th><th scope="col">Materials</th><th scope="col">Inspections</th>
                    <th scope="col">Incidents</th><th scope="col">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map(({ key, label }) => {
                    const report = summary.periods[key];
                    return (
                      <tr key={key}>
                        <td><strong>{label}</strong></td>
                        <td>{report.startDate} → {report.endDate}</td>
                        <td>{report.attendance.total}</td>
                        <td>{report.operations.plans}</td>
                        <td>{report.operations.tasks}</td>
                        <td>{report.operations.siteReports}</td>
                        <td>{report.operations.averageProgress === null ? "—" : `${report.operations.averageProgress}%`}</td>
                        <td>{report.operations.materialMovements}</td>
                        <td>{report.operations.inspections}</td>
                        <td>{report.operations.incidents}</td>
                        <td>{totalOutstanding(report)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <BarChart
            title="Attendance by period"
            note="Entries recorded in each range."
            items={PERIODS.map(({ key, label }) => ({ label, value: summary.periods[key].attendance.total }))}
          />

          <section className="management-card">
            <div className="management-card-heading"><h2>Yearly activity by month</h2><p>Grouped by month across the selected year.</p></div>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead>
                  <tr>
                    <th scope="col">Month</th><th scope="col">Attendance</th><th scope="col">Site reports</th>
                    <th scope="col">Material movements</th><th scope="col">Incidents</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.periods.yearly.timeline.map((row) => {
                    const max = Math.max(1, ...summary.periods.yearly.timeline.map((item) => Math.max(item.attendance, item.siteReports, item.materialMovements, item.incidents)));
                    return (
                      <tr key={row.key}>
                        <td><strong>{row.key}</strong></td>
                        <td><MiniBar value={row.attendance} max={max} tone="blue" /></td>
                        <td><MiniBar value={row.siteReports} max={max} tone="teal" /></td>
                        <td><MiniBar value={row.materialMovements} max={max} tone="orange" /></td>
                        <td><MiniBar value={row.incidents} max={max} tone="red" /></td>
                      </tr>
                    );
                  })}
                  {summary.periods.yearly.timeline.length === 0 && <tr><td className="management-empty" colSpan={5}>No activity recorded this year.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className="summary-chart-grid">
            <BarChart
              title="Attendance status — year"
              note="Breakdown of all attendance entries."
              items={Object.entries(summary.periods.yearly.attendance.byStatus).map(([label, value]) => ({ label, value }))}
              tone="blue"
            />
            <BarChart
              title="Site report status — year"
              items={Object.entries(summary.periods.yearly.operations.siteReportByStatus).map(([label, value]) => ({ label, value }))}
              tone="teal"
            />
            <BarChart
              title="Incident severity — year"
              items={Object.entries(summary.periods.yearly.operations.incidentBySeverity).map(([label, value]) => ({ label, value }))}
              tone="red"
            />
            <BarChart
              title="Material movements — year"
              items={summary.periods.yearly.materials.map((row) => ({ label: row.movement, value: row.count }))}
              tone="orange"
            />
          </div>

          <section className="management-card">
            <div className="management-card-heading"><h2>Current outstanding items</h2><p>Open items as of now, independent of the selected range.</p></div>
            <div className="metrics-grid">
              <div className="metric-card metric-card-alert">
                <div className="metric-caption">FOLLOW-UPS</div>
                <div className="metric-value">{summary.periods.yearly.outstanding.followUps}</div>
                <div className="metric-label">open or in progress</div>
              </div>
              <div className="metric-card metric-card-alert">
                <div className="metric-caption">PENDING REPORTS</div>
                <div className="metric-value">{summary.periods.yearly.outstanding.pendingReports}</div>
                <div className="metric-label">draft or submitted</div>
              </div>
              <div className="metric-card metric-card-alert">
                <div className="metric-caption">QUALITY DEFECTS</div>
                <div className="metric-value">{summary.periods.yearly.outstanding.openDefects}</div>
                <div className="metric-label">still open</div>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
