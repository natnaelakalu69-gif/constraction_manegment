"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

type DailyReport = {
  date: string;
  attendance: { summary: Record<string, number>; total: number; records: Array<Record<string, unknown>> };
  plans: Array<Record<string, unknown> & { tasks?: Array<Record<string, unknown>> }>;
  progress: { siteReports: Array<Record<string, unknown>>; progressRecords: Array<Record<string, unknown>> };
  materials: { transactions: Array<Record<string, unknown>>; stock: Array<Record<string, unknown>> };
  safety: { inspections: Array<Record<string, unknown>>; incidents: Array<Record<string, unknown>> };
  outstandingIssues: { followUps: Array<Record<string, unknown>>; pendingReports: Array<Record<string, unknown>>; openDefects: Array<Record<string, unknown>> };
};

type PeriodReport = {
  period: Period;
  anchorDate: string;
  startDate: string;
  endDate: string;
  attendance: {
    total: number;
    byStatus: Record<string, number>;
    byDate: Array<Record<string, number> & { day: string }>;
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

type LoadedReport<T> = { key: string; data: T } | { key: string; error: string };

function val(v: unknown) { return v === null || v === undefined || v === "" ? "—" : String(v); }
function breakdown(record: Record<string, number>) {
  const entries = Object.entries(record);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(" · ") : "None";
}

function DailyDetail({ date }: { date: string }) {
  const [state, setState] = useState<LoadedReport<DailyReport> | null>(null);

  useEffect(() => {
    let active = true;
    void fetchJson<DailyReport>(`/api/reports/daily-operations?date=${encodeURIComponent(date)}`)
      .then((data) => { if (active) setState({ key: date, data }); })
      .catch((e: unknown) => {
        if (active) setState({ key: date, error: e instanceof Error ? e.message : "Report could not be loaded." });
      });
    return () => { active = false; };
  }, [date]);

  const loading = state?.key !== date;
  const report = state && "data" in state ? state.data : null;
  const error = state && "error" in state ? state.error : null;

  return (
    <>
      {error && <div className="management-message error-message" role="alert">{error}</div>}
      {loading && <div className="management-card"><p>Generating daily report…</p></div>}

      {report && !loading && (
        <>
          <section className="management-card">
            <div className="management-card-heading"><h2>Attendance</h2><p>Total entries: {report.attendance.total}</p></div>
            <p><strong>Summary:</strong> {Object.keys(report.attendance.summary).length ? Object.entries(report.attendance.summary).map(([k, v]) => `${k}: ${v}`).join(" · ") : "No attendance recorded."}</p>
            <div className="management-table-wrap">
              <table className="management-table"><thead><tr><th>Worker</th><th>Site</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Notes</th></tr></thead>
                <tbody>
                  {report.attendance.records.map((r, i) => <tr key={i}><td>{val(r.workerName)} ({val(r.workerCode)})</td><td>{val(r.siteName)}</td><td>{val(r.status)}</td><td>{val(r.checkIn)}</td><td>{val(r.checkOut)}</td><td>{val(r.notes)}</td></tr>)}
                  {report.attendance.records.length === 0 && <tr><td className="management-empty" colSpan={6}>No attendance records for this date.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Daily plans &amp; tasks</h2><p>{report.plans.length} plans</p></div>
            {report.plans.length === 0 && <p>No daily plans for this date.</p>}
            {report.plans.map((p, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <p><strong>Plan #{val(p.id)}</strong> — {val(p.planDate)} · Supervisor: {val(p.supervisorName)} · Status: {val(p.status)} · Resources: {val(p.requiredResources)}</p>
                <ul>{(p.tasks ?? []).map((t, j) => <li key={j}>{val(t.task)} (deadline: {val(t.deadline)}, assignee: {val(t.assignee)}, resources: {val(t.requiredResources)}, status: {val(t.status)})</li>)}</ul>
              </div>
            ))}
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Progress &amp; site reports</h2><p>{report.progress.siteReports.length} site reports, {report.progress.progressRecords.length} progress records</p></div>
            <div className="management-table-wrap">
              <table className="management-table"><thead><tr><th>Report</th><th>Supervisor</th><th>Project</th><th>Progress %</th><th>Status</th><th>Completed work</th><th>Challenges</th><th>Delays</th></tr></thead>
                <tbody>
                  {report.progress.siteReports.map((r, i) => <tr key={i}><td>#{val(r.id)}</td><td>{val(r.supervisorName)}</td><td>{val(r.projectName) || val(r.projectId)}</td><td>{val(r.progressPercent)}%</td><td>{val(r.status)}</td><td>{val(r.completedWork)}</td><td>{val(r.challenges)}</td><td>{val(r.delays)}</td></tr>)}
                  {report.progress.siteReports.length === 0 && <tr><td className="management-empty" colSpan={8}>No site reports for this date.</td></tr>}
                </tbody>
              </table>
            </div>
            {report.progress.progressRecords.length > 0 && <p style={{ marginTop: 8 }}><strong>Progress records:</strong> {report.progress.progressRecords.map((r) => `#${val(r.id)} pkg ${val(r.workPackageId)} ${val(r.quantityCompleted)} on ${val(r.recordedOn)}`).join("; ")}</p>}
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Materials</h2><p>{report.materials.transactions.length} movements on {report.date}</p></div>
            <h3 style={{ margin: "8px 0" }}>Movements (received / issued / other)</h3>
            <div className="management-table-wrap">
              <table className="management-table"><thead><tr><th>Material</th><th>Movement</th><th>Quantity</th><th>Unit</th><th>Notes</th></tr></thead>
                <tbody>
                  {report.materials.transactions.map((t, i) => <tr key={i}><td>{val(t.materialName) || val(t.materialId)}</td><td>{val(t.movement)}</td><td>{val(t.quantity)}</td><td>{val(t.materialUnit)}</td><td>{val(t.notes)}</td></tr>)}
                  {report.materials.transactions.length === 0 && <tr><td className="management-empty" colSpan={5}>No material movements on this date.</td></tr>}
                </tbody>
              </table>
            </div>
            <h3 style={{ margin: "16px 0 8px" }}>Stock (received, issued, remaining)</h3>
            <div className="management-table-wrap">
              <table className="management-table"><thead><tr><th>Material</th><th>SKU</th><th>Received</th><th>Issued</th><th>Adjusted</th><th>Remaining</th><th>Unit</th></tr></thead>
                <tbody>
                  {report.materials.stock.map((s, i) => <tr key={i}><td>{val(s.name)}</td><td>{val(s.sku)}</td><td>{val(s.received)}</td><td>{val(s.issued)}</td><td>{val(s.adjusted)}</td><td><strong>{val(s.remaining)}</strong></td><td>{val(s.unit)}</td></tr>)}
                  {report.materials.stock.length === 0 && <tr><td className="management-empty" colSpan={7}>No materials in catalogue.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Safety</h2><p>{report.safety.inspections.length} inspections, {report.safety.incidents.length} incidents</p></div>
            <h3 style={{ margin: "8px 0" }}>Safety inspections (hazards, incidents, corrective actions)</h3>
            <div className="management-table-wrap">
              <table className="management-table"><thead><tr><th>Date</th><th>Inspector</th><th>Hazards</th><th>Incidents observed</th><th>Corrective actions</th><th>Status</th></tr></thead>
                <tbody>
                  {report.safety.inspections.map((s, i) => <tr key={i}><td>{val(s.inspectionDate)}</td><td>{val(s.inspectorName)}</td><td>{val(s.hazards)}</td><td>{val(s.incidentsObserved)}</td><td>{val(s.correctiveActions)}</td><td>{val(s.status)}</td></tr>)}
                  {report.safety.inspections.length === 0 && <tr><td className="management-empty" colSpan={6}>No safety inspections for this date.</td></tr>}
                </tbody>
              </table>
            </div>
            <h3 style={{ margin: "16px 0 8px" }}>Safety incidents</h3>
            <div className="management-table-wrap">
              <table className="management-table"><thead><tr><th>Number</th><th>Type</th><th>Severity</th><th>Status</th><th>Description</th></tr></thead>
                <tbody>
                  {report.safety.incidents.map((s, i) => <tr key={i}><td>{val(s.incidentNumber)}</td><td>{val(s.incidentType)}</td><td>{val(s.severity)}</td><td>{val(s.status)}</td><td>{val(s.description)}</td></tr>)}
                  {report.safety.incidents.length === 0 && <tr><td className="management-empty" colSpan={5}>No safety incidents on this date.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Outstanding issues &amp; follow-up</h2><p>Open follow-ups, pending reports, and open quality defects.</p></div>
            <h3 style={{ margin: "8px 0" }}>Follow-up actions (open/in progress)</h3>
            <div className="management-table-wrap">
              <table className="management-table"><thead><tr><th>Report</th><th>Issue</th><th>Action</th><th>Assigned to</th><th>Due</th><th>Status</th></tr></thead>
                <tbody>
                  {report.outstandingIssues.followUps.map((f, i) => <tr key={i}><td>{val(f.reportId)}</td><td>{val(f.issue)}</td><td>{val(f.action)}</td><td>{val(f.assignedTo)}</td><td>{val(f.dueDate)}</td><td>{val(f.status)}</td></tr>)}
                  {report.outstandingIssues.followUps.length === 0 && <tr><td className="management-empty" colSpan={6}>No open follow-up actions.</td></tr>}
                </tbody>
              </table>
            </div>
            <h3 style={{ margin: "16px 0 8px" }}>Pending site reports (submitted/draft)</h3>
            <div className="management-table-wrap">
              <table className="management-table"><thead><tr><th>ID</th><th>Date</th><th>Supervisor</th><th>Status</th><th>Progress %</th><th>Delays</th></tr></thead>
                <tbody>
                  {report.outstandingIssues.pendingReports.map((r, i) => <tr key={i}><td>{val(r.id)}</td><td>{val(r.reportDate)}</td><td>{val(r.supervisorName)}</td><td>{val(r.status)}</td><td>{val(r.progressPercent)}</td><td>{val(r.delays)}</td></tr>)}
                  {report.outstandingIssues.pendingReports.length === 0 && <tr><td className="management-empty" colSpan={6}>No pending site reports.</td></tr>}
                </tbody>
              </table>
            </div>
            <h3 style={{ margin: "16px 0 8px" }}>Open quality defects</h3>
            <div className="management-table-wrap">
              <table className="management-table"><thead><tr><th>ID</th><th>Title</th><th>Project</th><th>Severity</th><th>Status</th><th>Due</th></tr></thead>
                <tbody>
                  {report.outstandingIssues.openDefects.map((d, i) => <tr key={i}><td>{val(d.id)}</td><td>{val(d.title)}</td><td>{val(d.projectId)}</td><td>{val(d.severity)}</td><td>{val(d.status)}</td><td>{val(d.dueDate)}</td></tr>)}
                  {report.outstandingIssues.openDefects.length === 0 && <tr><td className="management-empty" colSpan={6}>No open quality defects.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function PeriodSummary({ period, date }: { period: Period; date: string }) {
  const [state, setState] = useState<LoadedReport<PeriodReport> | null>(null);

  useEffect(() => {
    let active = true;
    const key = `${period}|${date}`;
    void fetchJson<PeriodReport>(`/api/reports/period?period=${period}&date=${encodeURIComponent(date)}`)
      .then((data) => { if (active) setState({ key, data }); })
      .catch((e: unknown) => {
        if (active) setState({ key, error: e instanceof Error ? e.message : "Report could not be loaded." });
      });
    return () => { active = false; };
  }, [period, date]);

  const loading = state?.key !== `${period}|${date}`;
  const report = state && "data" in state ? state.data : null;
  const error = state && "error" in state ? state.error : null;
  const label = PERIODS.find((item) => item.key === period)?.label ?? period;

  return (
    <>
      {error && <div className="management-message error-message" role="alert">{error}</div>}
      {loading && <div className="management-card"><p>Generating {label.toLowerCase()} report…</p></div>}

      {report && !loading && (
        <>
          <section className="management-card">
            <div className="management-card-heading">
              <h2>{label} summary</h2>
              <p>{report.startDate} to {report.endDate} (end date exclusive) · anchored on {report.anchorDate}</p>
            </div>
            <div className="metrics-grid">
              <div className="metric-card metric-card-accent"><div className="metric-caption">ATTENDANCE</div><div className="metric-value">{report.attendance.total}</div><div className="metric-label">entries recorded</div></div>
              <div className="metric-card metric-card-accent"><div className="metric-caption">SITE REPORTS</div><div className="metric-value">{report.operations.siteReports}</div><div className="metric-label">submitted reports</div></div>
              <div className="metric-card metric-card-accent"><div className="metric-caption">AVG PROGRESS</div><div className="metric-value">{report.operations.averageProgress === null ? "—" : `${report.operations.averageProgress}%`}</div><div className="metric-label">across site reports</div></div>
              <div className="metric-card metric-card-accent"><div className="metric-caption">MATERIALS</div><div className="metric-value">{report.operations.materialMovements}</div><div className="metric-label">stock movements</div></div>
              <div className="metric-card"><div className="metric-caption">PLANS &amp; TASKS</div><div className="metric-value">{report.operations.plans} / {report.operations.tasks}</div><div className="metric-label">plans / tasks</div></div>
              <div className="metric-card"><div className="metric-caption">PROGRESS RECORDS</div><div className="metric-value">{report.operations.progressRecords}</div><div className="metric-label">total quantity {report.operations.progressQuantity}</div></div>
              <div className="metric-card"><div className="metric-caption">SAFETY</div><div className="metric-value">{report.operations.inspections} / {report.operations.incidents}</div><div className="metric-label">inspections / incidents</div></div>
              <div className="metric-card metric-card-alert"><div className="metric-caption">OUTSTANDING</div><div className="metric-value">{report.outstanding.followUps + report.outstanding.pendingReports + report.outstanding.openDefects}</div><div className="metric-label">open items</div></div>
            </div>
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Activity trend</h2><p>Grouped by {period === "yearly" ? "month" : "day"} across the selected range.</p></div>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead><tr><th scope="col">Period</th><th scope="col">Attendance</th><th scope="col">Site reports</th><th scope="col">Material movements</th><th scope="col">Incidents</th></tr></thead>
                <tbody>
                  {report.timeline.map((row) => <tr key={row.key}><td>{row.key}</td><td>{row.attendance}</td><td>{row.siteReports}</td><td>{row.materialMovements}</td><td>{row.incidents}</td></tr>)}
                  {report.timeline.length === 0 && <tr><td className="management-empty" colSpan={5}>No activity in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Attendance breakdown</h2><p>{report.attendance.total} entries in total.</p></div>
            <p><strong>By status:</strong> {breakdown(report.attendance.byStatus)}</p>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead><tr><th scope="col">{period === "yearly" ? "Month" : "Date"}</th><th scope="col">Entries</th><th scope="col">Status breakdown</th></tr></thead>
                <tbody>
                  {report.attendance.byDate.map((row) => {
                    const { day, total, ...statuses } = row;
                    return <tr key={day}><td>{day}</td><td>{total}</td><td>{breakdown(statuses as Record<string, number>)}</td></tr>;
                  })}
                  {report.attendance.byDate.length === 0 && <tr><td className="management-empty" colSpan={3}>No attendance recorded in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Operations breakdown</h2><p>Status totals for plans, tasks, site reports and incidents.</p></div>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead><tr><th scope="col">Area</th><th scope="col">Total</th><th scope="col">Status breakdown</th></tr></thead>
                <tbody>
                  <tr><td>Daily plans</td><td>{report.operations.plans}</td><td>{breakdown(report.operations.planByStatus)}</td></tr>
                  <tr><td>Plan tasks</td><td>{report.operations.tasks}</td><td>{breakdown(report.operations.taskByStatus)}</td></tr>
                  <tr><td>Site reports</td><td>{report.operations.siteReports}</td><td>{breakdown(report.operations.siteReportByStatus)}</td></tr>
                  <tr><td>Safety incidents</td><td>{report.operations.incidents}</td><td>{breakdown(report.operations.incidentBySeverity)}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Material movements</h2><p>{report.operations.materialMovements} movements in the selected range.</p></div>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead><tr><th scope="col">Movement</th><th scope="col">Transactions</th><th scope="col">Quantity</th></tr></thead>
                <tbody>
                  {report.materials.map((row) => <tr key={row.movement}><td>{row.movement}</td><td>{row.count}</td><td>{row.quantity}</td></tr>)}
                  {report.materials.length === 0 && <tr><td className="management-empty" colSpan={3}>No material movements in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Current outstanding items</h2><p>Open items as of now, independent of the selected range.</p></div>
            <p><strong>Follow-ups:</strong> {report.outstanding.followUps} · <strong>Pending site reports:</strong> {report.outstanding.pendingReports} · <strong>Open quality defects:</strong> {report.outstanding.openDefects}</p>
          </section>
        </>
      )}
    </>
  );
}

export default function SummaryPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <main className="management-main">
      <section className="management-heading">
        <div>
          <div className="eyebrow">OPERATIONS REPORTS</div>
          <h1>Operations reports</h1>
          <p className="page-subtitle">Daily detail or aggregated weekly, monthly and yearly summaries.</p>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </section>

      <div className="period-tabs" role="tablist" aria-label="Report period">
        {PERIODS.map((item) => (
          <button
            key={item.key}
            className={`period-tab${period === item.key ? " active" : ""}`}
            type="button"
            role="tab"
            aria-selected={period === item.key}
            onClick={() => setPeriod(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {period === "daily" ? <DailyDetail date={date} /> : <PeriodSummary period={period} date={date} />}
    </main>
  );
}
