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
};

const emptyForm: WorkerForm = {
  workerCode: "",
  fullName: "",
  position: "",
  department: "",
  phone: "",
};

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [form, setForm] = useState<WorkerForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  async function addWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson<Worker>("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setSuccess("Worker added.");
      await loadWorkers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Worker could not be added.");
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
          <h2>Add a worker</h2>
          <p>Worker code, name, and position are required.</p>
        </div>
        <form className="management-form" onSubmit={addWorker}>
          <label>
            Worker code
            <input value={form.workerCode} onChange={(event) => setForm({ ...form, workerCode: event.target.value })} required />
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
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={isSaving}>
              {isSaving ? "Adding…" : "Add worker"}
            </button>
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
              <tr><th scope="col">Code</th><th scope="col">Name</th><th scope="col">Position</th><th scope="col">Department</th><th scope="col">Phone</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.id}>
                  <td>{worker.workerCode}</td><td>{worker.fullName}</td><td>{worker.position}</td>
                  <td>{worker.department || "—"}</td><td>{worker.phone || "—"}</td><td>{worker.status}</td>
                </tr>
              ))}
              {isLoading && <tr><td className="management-empty" colSpan={6}>Loading workers…</td></tr>}
              {!isLoading && !error && workers.length === 0 && <tr><td className="management-empty" colSpan={6}>No workers have been added yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
