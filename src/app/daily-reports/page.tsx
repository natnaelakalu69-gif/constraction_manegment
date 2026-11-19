"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { fetchJson } from "@/lib/client-api";

type Plan = { id: number; planDate: string; supervisorName: string };
type Project = { id: number; name: string };
type Report = {
  id: number; reportDate: string; supervisorName: string; projectId: number | null; planId: number | null;
  completedWork: string; progressPercent: string | number; photos: string | null; challenges: string | null;
  delays: string | null; status: string; reviewNotes: string | null; reviewedBy: string | null;
};
type FollowUp = {
  id: number; reportId: number | null; issue: string; action: string; assignedTo: string | null;
  dueDate: string | null; status: string; notes: string | null;
};

const emptyReport = {
  reportDate: new Date().toISOString().slice(0, 10), supervisorName: "", projectId: "", planId: "",
  completedWork: "", progressPercent: "0", photos: "", challenges: "", delays: "", status: "submitted",
};

export default function DailyReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<Record<string, string>>(emptyReport);
  const [review, setReview] = useState<Record<number, { status: string; delays: string; reviewNotes: string; reviewedBy: string }>>({});
  const [followForm, setFollowForm] = useState<Record<number, { issue: string; action: string; assignedTo: string; dueDate: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [r, f, p, pr] = await Promise.all([
      fetchJson<Report[]>("/api/modules/daily-site-reports"),
      fetchJson<FollowUp[]>("/api/modules/daily-follow-ups"),
      fetchJson<Plan[]>("/api/modules/daily-plans"),
      fetchJson<Project[]>("/api/modules/projects"),
    ]);
    setReports(r); setFollowUps(f); setPlans(p); setProjects(pr);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => load())
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Could not load reports.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [load]);

  async function submitReport(e: FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    try {
      await fetchJson("/api/modules/daily-site-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setForm({ ...emptyReport, reportDate: form.reportDate });
      setSuccess("Daily site report submitted.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Report could not be submitted."); }
  }

  async function applyReview(report: Report) {
    const r = review[report.id] ?? { status: report.status, delays: report.delays ?? "", reviewNotes: report.reviewNotes ?? "", reviewedBy: report.reviewedBy ?? "" };
    setError(null); setSuccess(null);
    try {
      await fetchJson(`/api/modules/daily-site-reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
      setSuccess(`Report #${report.id} updated.`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Review could not be saved."); }
  }

  async function addFollowUp(reportId: number) {
    const f = followForm[reportId] ?? { issue: "", action: "", assignedTo: "", dueDate: "" };
    if (!f.issue.trim() || !f.action.trim()) { setError("Follow-up issue and action are required."); return; }
    setError(null); setSuccess(null);
    try {
      await fetchJson("/api/modules/daily-follow-ups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId, ...f, status: "open" }) });
      setFollowForm((s) => ({ ...s, [reportId]: { issue: "", action: "", assignedTo: "", dueDate: "" } }));
      setSuccess("Follow-up action assigned.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Follow-up could not be added."); }
  }

  async function setFollowUpStatus(id: number, status: string) {
    setError(null);
    try { await fetchJson(`/api/modules/daily-follow-ups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Follow-up could not be updated."); }
  }

  const projectName = (id: number | null) => projects.find((p) => p.id === id)?.name ?? (id ? `#${id}` : "—");

  return (
    <main className="management-main">
      <section className="management-heading">
        <div>
          <div className="eyebrow">DAILY OPERATIONS</div>
          <h1>Daily site reports & review</h1>
          <p className="page-subtitle">Supervisors submit reports; managers approve, identify delays, and assign follow-up actions.</p>
        </div>
      </section>

      {error && <div className="management-message error-message" role="alert">{error}</div>}
      {success && <div className="management-message success-message" role="status">{success}</div>}

      <section className="management-card">
        <div className="management-card-heading"><h2>Submit daily site report</h2><p>Record completed work, progress %, photos, and challenges.</p></div>
        <form className="management-form" onSubmit={submitReport}>
          <label>Report date<input type="date" required value={form.reportDate} onChange={(e) => setForm({ ...form, reportDate: e.target.value })} /></label>
          <label>Supervisor name<input required value={form.supervisorName} onChange={(e) => setForm({ ...form, supervisorName: e.target.value })} /></label>
          <label>Project<select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Daily plan<select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}><option value="">Select…</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.planDate} — {p.supervisorName}</option>)}</select></label>
          <label className="form-field-wide">Completed work<textarea value={form.completedWork} required onChange={(e) => setForm({ ...form, completedWork: e.target.value })} rows={3} /></label>
          <label>Progress %<input type="number" step="0.01" min="0" max="100" required value={form.progressPercent} onChange={(e) => setForm({ ...form, progressPercent: e.target.value })} /></label>
          <label className="form-field-wide">Photos (URLs or paths, one per line)<textarea value={form.photos} onChange={(e) => setForm({ ...form, photos: e.target.value })} rows={2} /></label>
          <label className="form-field-wide">Challenges<textarea value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} rows={2} /></label>
          <div className="form-actions"><button className="button button-primary" type="submit">Submit report</button></div>
        </form>
      </section>

      <section className="management-card">
        <div className="management-card-heading"><h2>Reports for review</h2><p>{reports.length} reports. Approve reports, identify delays, and assign follow-up actions.</p></div>
        {loading && <p className="page-subtitle">Loading reports…</p>}
        {!loading && reports.length === 0 && <p className="page-subtitle">No reports yet.</p>}
        <div style={{ display: "grid", gap: 16 }}>
          {reports.map((report) => {
            const rv = review[report.id] ?? { status: report.status, delays: report.delays ?? "", reviewNotes: report.reviewNotes ?? "", reviewedBy: report.reviewedBy ?? "" };
            const rf = followForm[report.id] ?? { issue: "", action: "", assignedTo: "", dueDate: "" };
            const related = followUps.filter((f) => f.reportId === report.id);
            return (
              <div key={report.id} style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div><strong>#{report.id}</strong> — {report.reportDate} · {report.supervisorName} · {projectName(report.projectId)} · <strong>{report.progressPercent}%</strong></div>
                  <span className="status-pill">{report.status}</span>
                </div>
                <p style={{ margin: "8px 0" }}><strong>Completed work:</strong> {report.completedWork}</p>
                {report.challenges && <p style={{ margin: "4px 0" }}><strong>Challenges:</strong> {report.challenges}</p>}
                {report.photos && <p style={{ margin: "4px 0" }}><strong>Photos:</strong> {report.photos}</p>}
                {report.delays && <p style={{ margin: "4px 0" }}><strong>Delays:</strong> {report.delays}</p>}
                {report.reviewNotes && <p style={{ margin: "4px 0" }}><strong>Review notes:</strong> {report.reviewNotes} {report.reviewedBy ? `(by ${report.reviewedBy})` : ""}</p>}

                <div className="management-form" style={{ marginTop: 12 }}>
                  <label>Status<select value={rv.status} onChange={(e) => setReview((s) => ({ ...s, [report.id]: { ...rv, status: e.target.value } }))}>
                    <option value="submitted">submitted</option><option value="approved">approved</option><option value="rejected">rejected</option><option value="draft">draft</option>
                  </select></label>
                  <label>Reviewed by<input value={rv.reviewedBy} onChange={(e) => setReview((s) => ({ ...s, [report.id]: { ...rv, reviewedBy: e.target.value } }))} placeholder="Manager name" /></label>
                  <label className="form-field-wide">Delays identified<input value={rv.delays} onChange={(e) => setReview((s) => ({ ...s, [report.id]: { ...rv, delays: e.target.value } }))} /></label>
                  <label className="form-field-wide">Review notes<input value={rv.reviewNotes} onChange={(e) => setReview((s) => ({ ...s, [report.id]: { ...rv, reviewNotes: e.target.value } }))} /></label>
                  <div className="form-actions"><button className="button button-primary" type="button" onClick={() => void applyReview(report)}>Save review / approve</button></div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <strong>Follow-up actions</strong>
                  {related.length === 0 && <p className="page-subtitle">No follow-up actions yet.</p>}
                  {related.map((f) => (
                    <div key={f.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                      <span>#{f.id} [{f.status}] {f.issue} → {f.action} {f.assignedTo ? `(${f.assignedTo})` : ""} {f.dueDate ? `due ${f.dueDate}` : ""}</span>
                      {f.status !== "done" && <button className="button button-secondary" type="button" onClick={() => void setFollowUpStatus(f.id, "done")}>Mark done</button>}
                    </div>
                  ))}
                  <div className="management-form" style={{ marginTop: 8 }}>
                    <label>Issue / delay<input value={rf.issue} onChange={(e) => setFollowForm((s) => ({ ...s, [report.id]: { ...rf, issue: e.target.value } }))} /></label>
                    <label>Follow-up action<input value={rf.action} onChange={(e) => setFollowForm((s) => ({ ...s, [report.id]: { ...rf, action: e.target.value } }))} /></label>
                    <label>Assign to<input value={rf.assignedTo} onChange={(e) => setFollowForm((s) => ({ ...s, [report.id]: { ...rf, assignedTo: e.target.value } }))} /></label>
                    <label>Due date<input type="date" value={rf.dueDate} onChange={(e) => setFollowForm((s) => ({ ...s, [report.id]: { ...rf, dueDate: e.target.value } }))} /></label>
                    <div className="form-actions"><button className="button button-secondary" type="button" onClick={() => void addFollowUp(report.id)}>Add follow-up</button></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="management-card">
        <div className="management-card-heading"><h2>All follow-up actions</h2><p>Track outstanding and completed follow-ups across reports.</p></div>
        <div className="management-table-wrap">
          <table className="management-table"><thead><tr><th>Report</th><th>Issue</th><th>Action</th><th>Assigned to</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {followUps.map((f) => (
                <tr key={f.id}><td>{f.reportId ?? "—"}</td><td>{f.issue}</td><td>{f.action}</td><td>{f.assignedTo ?? "—"}</td><td>{f.dueDate ?? "—"}</td><td>{f.status}</td><td>{f.status !== "done" && <button className="button button-secondary" type="button" onClick={() => void setFollowUpStatus(f.id, "done")}>Done</button>}</td></tr>
              ))}
              {followUps.length === 0 && <tr><td className="management-empty" colSpan={7}>No follow-up actions.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
