"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchJson } from "@/lib/client-api";
import { PaginationControls, usePagination } from "@/components/pagination";
import {
  CODE_MIN_DIGITS,
  PHONE_MIN_DIGITS,
  businessCodeError,
  isValidBusinessCode,
  isValidPhone,
  phoneError,
} from "@/lib/validation";

type Worker = {
  id: number;
  workerCode: string;
  fullName: string;
  position: string;
  department: string | null;
  phone: string | null;
  status: string;
};

type WorkerForm = {
  workerCode: string;
  fullName: string;
  position: string;
  department: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE";
};

const emptyForm: WorkerForm = {
  workerCode: "",
  fullName: "",
  position: "",
  department: "",
  phone: "",
  status: "ACTIVE",
};

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [form, setForm] = useState<WorkerForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const pagination = usePagination(workers.length);
  const visibleWorkers = pagination.pageSlice(workers);

  async function loadWorkers() {
    setIsLoading(true);
    setError(null);
    try {
      setWorkers(await fetchJson<Worker[]>("/api/workers"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workers could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchJson<Worker[]>("/api/workers")
      .then((rows) => {
        if (cancelled) return;
        setWorkers(rows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Workers could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function startEdit(worker: Worker) {
    setEditingId(worker.id);
    setForm({
      workerCode: worker.workerCode,
      fullName: worker.fullName,
      position: worker.position,
      department: worker.department ?? "",
      phone: worker.phone ?? "",
      status: worker.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    });
    setError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setSuccess(null);
  }

  async function removeWorker(worker: Worker) {
    if (!window.confirm(`Delete worker "${worker.fullName}"? This cannot be undone.`)) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson(`/api/workers/${worker.id}`, { method: "DELETE" });
      if (editingId === worker.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      setSuccess("Worker deleted.");
      await loadWorkers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Worker could not be deleted.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editing = editingId !== null;
    const workerCode = form.workerCode.trim();
    const fullName = form.fullName.trim();
    const position = form.position.trim();

    if ((!editing && !workerCode) || !fullName || !position) {
      setError("Worker code, full name, and position are required.");
      return;
    }
    if (!editing && !isValidBusinessCode(workerCode)) {
      setError(businessCodeError("Worker code"));
      return;
    }
    const phone = form.phone.trim();
    if (!isValidPhone(phone)) {
      setError(phoneError("Phone number"));
      return;
    }
    if (!editing && workers.some((worker) => worker.workerCode.toLowerCase() === workerCode.toLowerCase())) {
      setError(`Worker code "${workerCode}" already exists.`);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson<Worker>(editing ? `/api/workers/${editingId}` : "/api/workers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          workerCode,
          fullName,
          position,
          department: form.department.trim(),
          phone,
        }),
      });
      setForm(emptyForm);
      setEditingId(null);
      setSuccess(editing ? "Worker updated." : "Worker added.");
      await loadWorkers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Worker could not be ${editing ? "updated" : "added"}.`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="management-main">
      <section className="management-heading">
        <div>
          <div className="eyebrow">WORKFORCE</div>
          <h1>Construction workers</h1>
          <p className="page-subtitle">Maintain worker records for your active sites.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void loadWorkers()} disabled={isLoading}>
          {isLoading ? "Loading…" : "Refresh"}
        </button>
      </section>

      {error && <div className="management-message error-message" role="alert">{error}</div>}
      {success && <div className="management-message success-message" role="status">{success}</div>}

      <section className="management-card">
        <div className="management-card-heading">
          <h2>{editingId !== null ? "Edit worker" : "Add a worker"}</h2>
          <p>
            Worker code ({CODE_MIN_DIGITS}+ digits), name, position, and phone number ({PHONE_MIN_DIGITS}+ digits) are required.
          </p>
        </div>
        <form className="management-form" onSubmit={addWorker}>
          <label>
            Worker code
            <input
              value={form.workerCode}
              disabled={editingId !== null}
              onChange={(event) => setForm({ ...form, workerCode: event.target.value })}
              minLength={CODE_MIN_DIGITS}
              pattern={`[0-9]{${CODE_MIN_DIGITS},}`}
              title={businessCodeError("Worker code")}
              inputMode="numeric"
              required
            />
          </label>
          <label>
            Full name
            <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
          </label>
          <label>
            Position
            <input value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} required />
          </label>
          <label>
            Department
            <input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              minLength={PHONE_MIN_DIGITS}
              pattern="[0-9 +().-]+"
              title={phoneError("Phone number")}
              inputMode="tel"
              required
            />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as WorkerForm["status"] })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : editingId !== null ? "Save changes" : "Add worker"}
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
          <h2>Workers</h2>
          <p>{workers.length} records</p>
        </div>
        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th scope="col">Code</th><th scope="col">Name</th><th scope="col">Position</th>
                <th scope="col">Department</th><th scope="col">Phone</th><th scope="col">Status</th>
                <th scope="col">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visibleWorkers.map((worker) => (
                <tr key={worker.id} className={editingId === worker.id ? "editing-row" : undefined}>
                  <td>{worker.workerCode}</td><td>{worker.fullName}</td><td>{worker.position}</td>
                  <td>{worker.department || "—"}</td><td>{worker.phone || "—"}</td><td>{worker.status}</td>
                  <td>
                    <div className="row-actions">
                      <button className="button button-secondary row-action" type="button" onClick={() => startEdit(worker)} disabled={isSaving}>
                        Edit
                      </button>
                      <button className="button button-danger row-action" type="button" onClick={() => void removeWorker(worker)} disabled={isSaving}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td className="management-empty" colSpan={7}>Loading workers…</td></tr>}
              {!isLoading && !error && workers.length === 0 && <tr><td className="management-empty" colSpan={7}>No workers have been added yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <PaginationControls pagination={pagination} />
      </section>
    </main>
  );
}
