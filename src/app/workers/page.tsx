"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchJson } from "@/lib/client-api";
import { PaginationControls, usePagination } from "@/components/pagination";
import {
  ALL_TRADES,
  CUSTOM_EMPLOYMENT_TYPE,
  EMPLOYMENT_TYPE_MAX_LENGTH,
  EMPLOYMENT_TYPE_OPTIONS,
  isLegacyEmploymentType,
} from "@/lib/domain";
import {
  PHONE_MIN_DIGITS,
  WORKER_ID_MIN_DIGITS,
  isValidPhone,
  isValidWorkerId,
  phoneError,
  workerIdError,
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
  department: string;
  site: string;
  workLine: string;
  employmentType: string;
  customEmploymentType: string;
  dailyWage: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE";
};

const emptyForm: WorkerForm = {
  workerCode: "",
  fullName: "",
  department: "",
  site: "",
  workLine: "",
  employmentType: "",
  customEmploymentType: "",
  dailyWage: "",
  phone: "",
  status: "ACTIVE",
};

function workerType(worker: Worker): string {
  const storedType = worker.employmentType?.trim();
  if (storedType && !isLegacyEmploymentType(storedType)) return storedType;
  const storedTrade = worker.trade?.trim();
  if (storedTrade && !isLegacyEmploymentType(storedTrade)) return storedTrade;
  const storedPosition = worker.position.trim();
  if (storedPosition && !isLegacyEmploymentType(storedPosition)) return storedPosition;
  return ALL_TRADES;
}

function isPresetEmploymentType(value: string): boolean {
  return (EMPLOYMENT_TYPE_OPTIONS as readonly string[]).includes(value) && value !== CUSTOM_EMPLOYMENT_TYPE;
}

function formatWage(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString()} ETB`;
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [form, setForm] = useState<WorkerForm>(emptyForm);
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TRADES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const typeSuggestions = Array.from(
    new Set<string>([
      ...EMPLOYMENT_TYPE_OPTIONS,
      ...workers.map(workerType),
    ])
  );
  const typeFilterOptions = typeSuggestions.filter((type) => type !== CUSTOM_EMPLOYMENT_TYPE);
  const filteredWorkers =
    typeFilter === ALL_TRADES ? workers : workers.filter((worker) => workerType(worker) === typeFilter);
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
    const currentType = workerType(worker);
    const isPreset = isPresetEmploymentType(currentType);
    setEditingId(worker.id);
    setTypeFilter(ALL_TRADES);
    setForm({
      workerCode: worker.workerCode,
      fullName: worker.fullName,
      department: worker.department ?? "",
      site: worker.site ?? "",
      workLine: worker.workLine ?? "",
      employmentType: isPreset ? currentType : CUSTOM_EMPLOYMENT_TYPE,
      customEmploymentType: isPreset ? "" : currentType,
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
    const employmentType = form.employmentType.trim();
    const customType = form.customEmploymentType.trim();
    let savedType = employmentType;

    if ((!editing && !workerCode) || !fullName || !employmentType) {
      setError("Worker ID, full name, and employment type are required.");
      return;
    }
    if (employmentType === CUSTOM_EMPLOYMENT_TYPE) {
      if (!customType) {
        setError("Type the custom employment type.");
        return;
      }
      if (customType.length > EMPLOYMENT_TYPE_MAX_LENGTH) {
        setError(`Employment type must be ${EMPLOYMENT_TYPE_MAX_LENGTH} characters or fewer.`);
        return;
      }
      savedType = customType;
    } else if (employmentType.length > EMPLOYMENT_TYPE_MAX_LENGTH) {
      setError(`Employment type must be ${EMPLOYMENT_TYPE_MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (!editing && !isValidWorkerId(workerCode)) {
      setError(workerIdError("Worker ID"));
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
          workerCode,
          fullName,
          employmentType: savedType,
          department: form.department.trim(),
          site: form.site.trim(),
          workLine: form.workLine.trim(),
          dailyWage: form.dailyWage.trim(),
          phone,
          status: form.status,
        }),
      });
      setForm(emptyForm);
      setEditingId(null);
      setTypeFilter(ALL_TRADES);
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
          <p className="page-subtitle">Register workers by employment type, site and team for your active projects.</p>
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
            Worker ID ({WORKER_ID_MIN_DIGITS}+ digits), full name, employment type (choose from the list or type your own) and phone number ({PHONE_MIN_DIGITS}+ digits) are required.
          </p>
        </div>
        <form className="management-form" onSubmit={addWorker}>
          <label>
            Worker ID
            <input
              value={form.workerCode}
              disabled={editingId !== null}
              onChange={(event) => setForm({ ...form, workerCode: event.target.value })}
              minLength={WORKER_ID_MIN_DIGITS}
              pattern={`[0-9]{${WORKER_ID_MIN_DIGITS},}`}
              title={workerIdError("Worker ID")}
              inputMode="numeric"
              placeholder="1025"
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
          <datalist id="employment-type-options">
            {typeSuggestions.map((type) => <option key={type} value={type} />)}
          </datalist>
          <label>
            Employment type
            <input
              list="employment-type-options"
              value={form.employmentType}
              onChange={(event) => {
                const value = event.target.value;
                setForm({
                  ...form,
                  employmentType: value,
                  customEmploymentType: value === CUSTOM_EMPLOYMENT_TYPE ? form.customEmploymentType : "",
                });
              }}
              maxLength={EMPLOYMENT_TYPE_MAX_LENGTH}
              placeholder="Select or type a type"
              required
            />
          </label>
          {form.employmentType === CUSTOM_EMPLOYMENT_TYPE && (
            <label>
              Custom type
              <input
                value={form.customEmploymentType}
                onChange={(event) => setForm({ ...form, customEmploymentType: event.target.value })}
                maxLength={EMPLOYMENT_TYPE_MAX_LENGTH}
                placeholder="e.g. Concrete Finisher"
                required
              />
            </label>
          )}
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
            Employment type
            <select
              className="summary-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filter workers by employment type"
            >
              {typeFilterOptions.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        </div>
        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col">Employment type</th>
                <th scope="col">Department</th>
                <th scope="col">Site</th>
                <th scope="col">Team</th>
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
                  <td>{workerType(worker)}</td>
                  <td>{worker.department || "—"}</td>
                  <td>{worker.site || "—"}</td>
                  <td>{worker.workLine || "—"}</td>
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
              {isLoading && <tr><td className="management-empty" colSpan={10}>Loading workers…</td></tr>}
              {!isLoading && !error && filteredWorkers.length === 0 && (
                <tr>
                  <td className="management-empty" colSpan={10}>
                    {typeFilter === ALL_TRADES ? "No workers have been added yet." : `No workers found for ${typeFilter}.`}
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
