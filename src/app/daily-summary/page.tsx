"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";

type Report = {
  date: string;
  attendance: { summary: Record<string, number>; total: number; records: Array<Record<string, unknown>> };
  plans: Array<Record<string, unknown> & { tasks?: Array<Record<string, unknown>> }>;
  progress: { siteReports: Array<Record<string, unknown>>; progressRecords: Array<Record<string, unknown>> };
  materials: { transactions: Array<Record<string, unknown>>; stock: Array<Record<string, unknown>> };
  safety: { inspections: Array<Record<string, unknown>>; incidents: Array<Record<string, unknown>> };
  outstandingIssues: { followUps: Array<Record<string, unknown>>; pendingReports: Array<Record<string, unknown>>; openDefects: Array<Record<string, unknown>> };
};

function val(v: unknown) { return v === null || v === undefined || v === "" ? "—" : String(v); }

export default function DailySummaryPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(d: string, isCurrent: () => boolean) {
    setLoading(true); setError(null);
    try {
      const result = await fetchJson<Report>(`/api/reports/daily-operations?date=${encodeURIComponent(d)}`);
      if (isCurrent()) setReport(result);
    } catch (e) {
      if (!isCurrent()) return;
      setError(e instanceof Error ? e.message : "Report could not be loaded.");
      setReport(null);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => load(date, () => active));
    return () => { active = false; };
  }, [date]);

  return (
    <main className="management-main">
      <section className="management-heading">
        <div>
          <div className="eyebrow">DAILY OPERATIONS</div>
          <h1>Daily operations report</h1>
          <p className="page-subtitle">Attendance, progress, materials, safety, and outstanding issues for the selected day.</p>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </section>

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
            <div className="management-card-heading"><h2>Daily plans & tasks</h2><p>{report.plans.length} plans</p></div>
            {report.plans.length === 0 && <p>No daily plans for this date.</p>}
            {report.plans.map((p, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <p><strong>Plan #{val(p.id)}</strong> — {val(p.planDate)} · Supervisor: {val(p.supervisorName)} · Status: {val(p.status)} · Resources: {val(p.requiredResources)}</p>
                <ul>{(p.tasks ?? []).map((t, j) => <li key={j}>{val(t.task)} (deadline: {val(t.deadline)}, assignee: {val(t.assignee)}, resources: {val(t.requiredResources)}, status: {val(t.status)})</li>)}</ul>
              </div>
            ))}
          </section>

          <section className="management-card">
            <div className="management-card-heading"><h2>Progress & site reports</h2><p>{report.progress.siteReports.length} site reports, {report.progress.progressRecords.length} progress records</p></div>
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
            <div className="management-card-heading"><h2>Outstanding issues & follow-up</h2><p>Open follow-ups, pending reports, and open quality defects.</p></div>
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
    </main>
  );
}
