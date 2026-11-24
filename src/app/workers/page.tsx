"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchJson } from "@/lib/client-api";
import { PaginationControls, usePagination } from "@/components/pagination";
import {
  ALL_TRADES,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  TRADES,
  TRADE_FILTER_OPTIONS,
  isEmploymentType,
  isTrade,
} from "@/lib/domain";
import type { EmploymentType } from "@/lib/domain";
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
  trade: string | null;
  department: string | null;
  site: string | null;
  workLine: string | null;
  employmentType: string | null;
  dailyWage: number | null;
  phone: string | null;
  status: string;
};

type WorkerForm = {
  workerCode: string;
  fullName: string;
  trade: string;
  department: string;
  site: string;
  workLine: string;
  employmentType: EmploymentType;
  dailyWage: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE";
};

const emptyForm: WorkerForm = {
  workerCode: "",
  fullName: "",
  trade: "",
  department: "",
  site: "",
  workLine: "",
  employmentType: "employee",
  dailyWage: "",
  phone: "",
  status: "ACTIVE",
};

function workerTrade(worker: Worker): string {
  if (worker.trade && isTrade(worker.trade)) return worker.trade;
  if (isTrade(worker.position)) return worker.position;
  return "General Laborer";
}

function formatWage(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString()} ETB`;
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [form, setForm] = useState<WorkerForm>(emptyForm);
  const [tradeFilter, setTradeFilter] = useState<string>(ALL_TRADES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const filteredWorkers =
    tradeFilter === ALL_TRADES ? workers : workers.filter((worker) => workerTrade(worker) === tradeFilter);
  const pagination = usePagination(filteredWorkers.length);
  const visibleWorkers = pagination.pageSlice(filteredWorkers);

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
    setTradeFilter(ALL_TRADES);
    setForm({
      workerCode: worker.workerCode,
      fullName: worker.fullName,
      trade: workerTrade(worker),
      department: worker.department ?? "",
      site: worker.site ?? "",
      workLine: worker.workLine ?? "",
      employmentType: worker.employmentType && isEmploymentType(worker.employmentType) ? worker.employmentType : "employee",
      dailyWage: worker.dailyWage === null ? "" : String(worker.dailyWage),
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
    const trade = form.trade.trim();

    if ((!editing && !workerCode) || !fullName || !trade) {
      setError("Worker ID, full name, and trade are required.");
      return;
    }
    if (!isTrade(trade)) {
      setError("Choose a valid trade.");
      return;
    }
    if (!editing && !isValidBusinessCode(workerCode)) {
      setError(businessCodeError("Worker ID"));
      return;
    }
    const phone = form.phone.trim();
    if (!isValidPhone(phone)) {
      setError(phoneError("Phone number"));
      return;
    }
    if (!editing && workers.some((worker) => worker.workerCode.toLowerCase() === workerCode.toLowerCase())) {
      setError(`Worker ID "${workerCode}" already exists.`);
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
          trade,
          department: form.department.trim(),
          site: form.site.trim(),
          workLine: form.workLine.trim(),
          dailyWage: form.dailyWage.trim(),
          phone,
        }),
      });
      setForm(emptyForm);
      setEditingId(null);
      setTradeFilter(ALL_TRADES);
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
          <p className="page-subtitle">Register workers by trade, site and team for your active projects.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void loadWorkers()} disabled={isLoading}>
          {isLoading ? "Loading…" : "Refresh"}
        </button>
      </section>

      {error && <div className="management-message error-message" role="alert">{error}</div>}
      {success && <div className="management-message success-message" role="status">{success}</div>}

      <section className="management-card">
        <div className="management-card-heading">
          <h2>{editingId !== null ? "Edit worker" : "Worker registration"}</h2>
          <p>
            Worker ID ({CODE_MIN_DIGITS}+ digits), full name, trade and phone number ({PHONE_MIN_DIGITS}+ digits) are required.
          </p>
        </div>
        <form className="management-form" onSubmit={addWorker}>
          <label>
            Worker ID
            <input
              value={form.workerCode}
              disabled={editingId !== null}
              onChange={(event) => setForm({ ...form, workerCode: event.target.value })}
              minLength={CODE_MIN_DIGITS}
              pattern={`[0-9]{${CODE_MIN_DIGITS},}`}
              title={businessCodeError("Worker ID")}
              inputMode="numeric"
              placeholder="1025001"
              required
            />
          </label>
          <label>
            Full name
            <input
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              placeholder="Abebe Kebede"
              required
            />
          </label>
          <label>
            Trade
            <select value={form.trade} onChange={(event) => setForm({ ...form, trade: event.target.value })} required>
              <option value="">Select trade</option>
              {TRADES.map((trade) => <option key={trade} value={trade}>{trade}</option>)}
            </select>
          </label>
          <label>
            Department
            <input
              value={form.department}
              onChange={(event) => setForm({ ...form, department: event.target.value })}
              placeholder="Construction"
            />
          </label>
          <label>
            Site
            <input
              value={form.site}
              onChange={(event) => setForm({ ...form, site: event.target.value })}
              placeholder="Project A"
            />
          </label>
          <label>
            Work line / team
            <input
              value={form.workLine}
              onChange={(event) => setForm({ ...form, workLine: event.target.value })}
              placeholder="Line 1"
            />
          </label>
          <label>
            Employment type
            <select
              value={form.employmentType}
              onChange={(event) => setForm({ ...form, employmentType: event.target.value as EmploymentType })}
            >
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>{EMPLOYMENT_TYPE_LABELS[type]}</option>
              ))}
            </select>
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
              placeholder="0912345678"
              required
            />
          </label>
          <label>
            Daily wage (ETB)
            <input
              type="number"
              value={form.dailyWage}
              onChange={(event) => setForm({ ...form, dailyWage: event.target.value })}
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="800"
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
          <div>
            <h2>Workers</h2>
            <p>{filteredWorkers.length} records</p>
          </div>
          <label className="workforce-trade-filter">
            Trade
            <select
              className="summary-filter"
              value={tradeFilter}
              onChange={(event) => setTradeFilter(event.target.value)}
              aria-label="Filter workers by trade"
            >
              {TRADE_FILTER_OPTIONS.map((trade) => <option key={trade} value={trade}>{trade}</option>)}
            </select>
          </label>
        </div>
        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col">Trade</th>
                <th scope="col">Department</th>
                <th scope="col">Site</th>
                <th scope="col">Team</th>
                <th scope="col">Type</th>
                <th scope="col">Daily wage</th>
                <th scope="col">Phone</th>
                <th scope="col">Status</th>
                <th scope="col">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visibleWorkers.map((worker) => (
                <tr key={worker.id} className={editingId === worker.id ? "editing-row" : undefined}>
                  <td>{worker.workerCode}</td>
                  <td>{worker.fullName}</td>
                  <td>{workerTrade(worker)}</td>
                  <td>{worker.department || "—"}</td>
                  <td>{worker.site || "—"}</td>
                  <td>{worker.workLine || "—"}</td>
                  <td>{worker.employmentType ? EMPLOYMENT_TYPE_LABELS[worker.employmentType as EmploymentType] ?? worker.employmentType : "—"}</td>
                  <td>{formatWage(worker.dailyWage)}</td>
                  <td>{worker.phone || "—"}</td>
                  <td>{worker.status}</td>
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
              {isLoading && <tr><td className="management-empty" colSpan={11}>Loading workers…</td></tr>}
              {!isLoading && !error && filteredWorkers.length === 0 && (
                <tr>
                  <td className="management-empty" colSpan={11}>
                    {tradeFilter === ALL_TRADES ? "No workers have been added yet." : `No ${tradeFilter} workers found.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls pagination={pagination} />
      </section>
    </main>
  );
}
