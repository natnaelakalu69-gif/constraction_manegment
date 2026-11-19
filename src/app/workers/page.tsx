"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchJson } from "@/lib/client-api";

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
          phone: form.phone.trim(),
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
          <p>Worker code, name, and position are required.</p>
        </div>
        <form className="management-form" onSubmit={addWorker}>
          <label>
            Worker code
            <input value={form.workerCode} disabled={editingId !== null} onChange={(event) => setForm({ ...form, workerCode: event.target.value })} required />
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
            <input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
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
              {workers.map((worker) => (
                <tr key={worker.id} className={editingId === worker.id ? "editing-row" : undefined}>
                  <td>{worker.workerCode}</td><td>{worker.fullName}</td><td>{worker.position}</td>
                  <td>{worker.department || "—"}</td><td>{worker.phone || "—"}</td><td>{worker.status}</td>
                  <td>
                    <button className="button button-secondary row-action" type="button" onClick={() => startEdit(worker)} disabled={isSaving}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td className="management-empty" colSpan={7}>Loading workers…</td></tr>}
              {!isLoading && !error && workers.length === 0 && <tr><td className="management-empty" colSpan={7}>No workers have been added yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
