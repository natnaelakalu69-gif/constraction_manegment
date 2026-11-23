"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { fetchJson } from "@/lib/client-api";
import { PaginationControls, usePagination } from "@/components/pagination";

type Worker = { id: number; workerCode: string; fullName: string };
type Site = { id: number; siteName: string };
type AttendanceRecord = {
  id: number;
  workerId: number;
  siteId: number;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  notes: string | null;
  loggedInAt: string | null;
};
type AttendanceForm = {
  workerId: string;
  siteId: string;
  attendanceDate: string;
  checkIn: string;
  checkOut: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
  notes: string;
};

function formatLoggedInAt(value: string | null) {
  if (!value) return "—";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function createForm(): AttendanceForm {
  return {
    workerId: "",
    siteId: "",
    attendanceDate: new Date().toISOString().slice(0, 10),
    checkIn: "08:00",
    checkOut: "17:00",
    status: "PRESENT",
    notes: "",
  };
}

export default function AttendancePage() {
  const [form, setForm] = useState<AttendanceForm>(createForm);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const pagination = usePagination(records.length);
  const visibleRecords = pagination.pageSlice(records);

  const loadData = useCallback(() => Promise.all([
    fetchJson<Worker[]>("/api/workers"),
    fetchJson<Site[]>("/api/sites"),
    fetchJson<AttendanceRecord[]>(`/api/attendance?date=${encodeURIComponent(form.attendanceDate)}`),
  ]), [form.attendanceDate]);

  const applyLoadedData = useCallback(([workerRows, siteRows, attendanceRows]: [Worker[], Site[], AttendanceRecord[]]) => {
      setWorkers(workerRows);
      setSites(siteRows);
      setRecords(attendanceRows);
      setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadData()
      .then((data) => {
        if (!cancelled) applyLoadedData(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Attendance data could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [applyLoadedData, loadData]);

  async function refreshData() {
    setIsLoading(true);
    setError(null);
    try {
      applyLoadedData(await loadData());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Attendance data could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  function startEdit(record: AttendanceRecord) {
    setEditingId(record.id);
    setForm({
      workerId: String(record.workerId),
      siteId: String(record.siteId),
      attendanceDate: form.attendanceDate,
      checkIn: record.checkIn?.slice(0, 5) ?? "",
      checkOut: record.checkOut?.slice(0, 5) ?? "",
      status: record.status as AttendanceForm["status"],
      notes: record.notes ?? "",
    });
    setError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(createForm());
    setError(null);
    setSuccess(null);
  }

  async function removeAttendance(record: AttendanceRecord) {
    const workerName = workers.find((worker) => worker.id === record.workerId)?.fullName ?? `#${record.workerId}`;
    if (!window.confirm(`Delete attendance for ${workerName} on ${form.attendanceDate}? This cannot be undone.`)) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson(`/api/attendance?id=${record.id}`, { method: "DELETE" });
      if (editingId === record.id) {
        setEditingId(null);
        setForm(createForm());
      }
      setSuccess("Attendance entry deleted.");
      await refreshData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Attendance entry could not be deleted.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson<AttendanceRecord>("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSuccess(editingId !== null ? "Attendance entry updated." : "Attendance saved.");
      setEditingId(null);
      setForm(createForm());
      await refreshData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Attendance could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="management-main">
      <section className="management-heading">
        <div>
          <div className="eyebrow">WORKFORCE PULSE</div>
          <h1>Daily attendance</h1>
          <p className="page-subtitle">Record and review worker check-ins by date.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void refreshData()} disabled={isLoading}>
          {isLoading ? "Loading…" : "Refresh"}
        </button>
      </section>

      {error && <div className="management-message error-message" role="alert">{error}</div>}
      {success && <div className="management-message success-message" role="status">{success}</div>}

      <section className="management-card">
        <div className="management-card-heading">
          <h2>{editingId !== null ? "Edit attendance entry" : "Record attendance"}</h2>
          <p>Saving again for the same worker and date updates that entry and its recorded login time.</p>
        </div>
        <form className="management-form" onSubmit={saveAttendance}>
          <label>
            Date
            <input
              type="date"
              value={form.attendanceDate}
              disabled={editingId !== null}
              onChange={(event) => {
                setRecords([]);
                setIsLoading(true);
                setForm({ ...form, attendanceDate: event.target.value });
              }}
              required
            />
          </label>
          <label>
            Worker
            <select value={form.workerId} disabled={editingId !== null} onChange={(event) => setForm({ ...form, workerId: event.target.value })} required>
              <option value="">Select a worker</option>
              {workers.map((worker) => <option value={worker.id} key={worker.id}>{worker.workerCode} — {worker.fullName}</option>)}
            </select>
          </label>
          <label>
            Site
            <select value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })} required>
              <option value="">Select a site</option>
              {sites.map((site) => <option value={site.id} key={site.id}>{site.siteName}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AttendanceForm["status"] })}>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="LEAVE">On leave</option>
            </select>
          </label>
          <label>
            Check-in
            <input type="time" value={form.checkIn} onChange={(event) => setForm({ ...form, checkIn: event.target.value })} />
          </label>
          <label>
            Check-out
            <input type="time" value={form.checkOut} onChange={(event) => setForm({ ...form, checkOut: event.target.value })} />
          </label>
          <label className="form-field-wide">
            Notes
            <input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={isSaving || workers.length === 0 || sites.length === 0}>
              {isSaving ? "Saving…" : editingId !== null ? "Save changes" : "Save attendance"}
            </button>
            {editingId !== null && (
              <button className="button button-secondary" type="button" onClick={cancelEdit} disabled={isSaving}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="management-card">
        <div className="management-card-heading">
          <h2>Attendance entries</h2>
          <p>{records.length} records for {form.attendanceDate}</p>
        </div>
        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th scope="col">Worker</th><th scope="col">Site</th><th scope="col">Check-in</th>
                <th scope="col">Check-out</th><th scope="col">Logged in at</th><th scope="col">Status</th>
                <th scope="col">Notes</th><th scope="col">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr key={record.id} className={editingId === record.id ? "editing-row" : undefined}>
                  <td>{workers.find((worker) => worker.id === record.workerId)?.fullName ?? `#${record.workerId}`}</td>
                  <td>{sites.find((site) => site.id === record.siteId)?.siteName ?? `#${record.siteId}`}</td>
                  <td>{record.checkIn || "—"}</td><td>{record.checkOut || "—"}</td>
                  <td>{formatLoggedInAt(record.loggedInAt)}</td>
                  <td>{record.status}</td><td>{record.notes || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="button button-secondary row-action" type="button" onClick={() => startEdit(record)} disabled={isSaving}>
                        Edit
                      </button>
                      <button className="button button-danger row-action" type="button" onClick={() => void removeAttendance(record)} disabled={isSaving}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td className="management-empty" colSpan={8}>Loading attendance…</td></tr>}
              {!isLoading && !error && records.length === 0 && <tr><td className="management-empty" colSpan={8}>No attendance entries for this date.</td></tr>}
            </tbody>
          </table>
        </div>
        <PaginationControls pagination={pagination} />
      </section>
    </main>
  );
}
