"use client";

import { useCallback, useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { fetchJson } from "@/lib/client-api";
import {
  CODE_MIN_DIGITS,
  PHONE_MIN_DIGITS,
  businessCodeError,
  isValidBusinessCode,
  isValidPhone,
  phoneError,
} from "@/lib/validation";

function notifyModuleChange(endpoint: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("module-change", { detail: { endpoint } }));
  }
}

export type ModuleField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "select";
  options?: readonly string[];
  optionsFrom?: string;
  optionLabel?: string;
  required?: boolean;
  placeholder?: string;
  format?: "businessCode" | "phone";
};

type FieldInputAttributes = Pick<InputHTMLAttributes<HTMLInputElement>, "minLength" | "pattern" | "title" | "inputMode">;

function fieldInputAttributes(field: ModuleField): FieldInputAttributes {
  if (field.format === "businessCode") {
    return {
      minLength: CODE_MIN_DIGITS,
      pattern: `[0-9]{${CODE_MIN_DIGITS},}`,
      title: businessCodeError(field.label),
      inputMode: "numeric",
    };
  }
  if (field.format === "phone") {
    return {
      minLength: PHONE_MIN_DIGITS,
      pattern: "[0-9 +().-]+",
      title: phoneError(field.label),
      inputMode: "tel",
    };
  }
  return {};
}

export type ModuleSection = {
  key: string;
  title: string;
  description: string;
  endpoint: string;
  fields: ModuleField[];
  columns: { key: string; label: string }[];
};

type Row = Record<string, unknown>;
type Option = { value: string; label: string };

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function inputValue(value: unknown, type?: ModuleField["type"]): string {
  if (value === null || value === undefined) return "";
  if (type === "datetime-local") {
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function ModuleSectionCard({ section }: { section: ModuleSection }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(section.fields.map((field) => [
      field.name,
      field.type === "datetime-local" ? new Date().toISOString().slice(0, 16) : "",
    ]))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchRows = useCallback(async () => fetchJson<Row[]>(section.endpoint), [section.endpoint]);

  function emptyForm(): Record<string, string> {
    return Object.fromEntries(section.fields.map((field) => [
      field.name,
      field.type === "datetime-local" ? new Date().toISOString().slice(0, 16) : "",
    ]));
  }

  function startEdit(row: Row) {
    setEditingId(Number(row.id));
    setForm(Object.fromEntries(section.fields.map((field) => [field.name, inputValue(row[field.name], field.type)])));
    setError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setSuccess(null);
  }

  async function remove(row: Row) {
    const id = Number(row.id);
    if (!window.confirm("Delete this record? This cannot be undone.")) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson(`${section.endpoint}/${id}`, { method: "DELETE" });
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm());
      }
      setSuccess("Record deleted.");
      setRows(await fetchRows());
      notifyModuleChange(section.endpoint);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The record could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchRows()
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Records could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const optionFields = section.fields.filter((field) => field.optionsFrom);
    void Promise.all(optionFields.map(async (field) => {
      const records = await fetchJson<Row[]>(field.optionsFrom!);
      return [field.name, records.map((row) => ({
        value: String(row.id),
        label: display(row[field.optionLabel ?? "name"]),
      }))] as const;
    }))
      .then((entries) => {
        if (!cancelled) setOptions(Object.fromEntries(entries));
      })
      .catch(() => {
        // Optional dropdown data failing should not block the rest of the module.
      });

    return () => { cancelled = true; };
  }, [fetchRows, section.fields]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editing = editingId !== null;
    for (const field of section.fields) {
      const value = (form[field.name] ?? "").trim();
      if (!value && !field.required) continue;
      if (field.format === "businessCode" && !isValidBusinessCode(value)) {
        setError(businessCodeError(field.label));
        return;
      }
      if (field.format === "phone" && !isValidPhone(value)) {
        setError(phoneError(field.label));
        return;
      }
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson<Row>(editing ? `${section.endpoint}/${editingId}` : section.endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSuccess(editing ? "Record updated." : "Record added.");
      if (editing) setEditingId(null);
      setForm(emptyForm());
      setRows(await fetchRows());
      notifyModuleChange(section.endpoint);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `The record could not be ${editing ? "updated" : "added"}.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="management-card">
      <div className="management-card-heading">
        <h2>{section.title}</h2>
        <p>{section.description}</p>
      </div>

      {error && <div className="management-message error-message" role="alert">{error}</div>}
      {success && <div className="management-message success-message" role="status">{success}</div>}

      <form className="management-form" onSubmit={submit}>
        {section.fields.map((field) => (
          <label key={field.name}>
            {field.label}
            {field.type === "select" ? (
              <select
                value={form[field.name] ?? ""}
                onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
                required={field.required}
              >
                <option value="">Select…</option>
                {(field.options ?? options[field.name] ?? []).map((option) =>
                  typeof option === "string"
                    ? <option value={option} key={option}>{option}</option>
                    : <option value={option.value} key={option.value}>{option.label}</option>
                )}
              </select>
            ) : (
              <input
                type={field.type ?? "text"}
                step={field.type === "number" ? "any" : undefined}
                placeholder={field.placeholder}
                value={form[field.name] ?? ""}
                onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
                required={field.required}
                {...fieldInputAttributes(field)}
              />
            )}
          </label>
        ))}
        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : editingId !== null ? "Save changes" : "Add record"}
          </button>
          {editingId !== null && (
            <button className="button button-secondary" type="button" onClick={cancelEdit} disabled={saving}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="management-table-wrap">
        <table className="management-table">
          <thead>
            <tr>
              {section.columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}
              <th scope="col">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)} className={editingId === Number(row.id) ? "editing-row" : undefined}>
                {section.columns.map((column) => <td key={column.key}>{display(row[column.key])}</td>)}
                <td>
                  <div className="row-actions">
                    <button className="button button-secondary row-action" type="button" onClick={() => startEdit(row)} disabled={saving}>
                      Edit
                    </button>
                    <button className="button button-danger row-action" type="button" onClick={() => void remove(row)} disabled={saving}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {loading && <tr><td className="management-empty" colSpan={section.columns.length + 1}>Loading records…</td></tr>}
            {!loading && rows.length === 0 && <tr><td className="management-empty" colSpan={section.columns.length + 1}>No records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ModuleManager({ title, subtitle, sections }: { title: string; subtitle: string; sections: ModuleSection[] }) {
  return (
    <main className="management-main">
      <section className="management-heading">
        <div>
          <div className="eyebrow">OPERATIONS MODULE</div>
          <h1>{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
      </section>
      {sections.map((section) => <ModuleSectionCard key={section.key} section={section} />)}
    </main>
  );
}
