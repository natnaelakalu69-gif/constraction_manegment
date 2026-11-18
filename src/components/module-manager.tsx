"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { fetchJson } from "@/lib/client-api";

export type ModuleField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "select";
  options?: readonly string[];
  optionsFrom?: string;
  optionLabel?: string;
  required?: boolean;
  placeholder?: string;
};

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

  const fetchRows = useCallback(async () => fetchJson<Row[]>(section.endpoint), [section.endpoint]);

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
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson<Row>(section.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSuccess("Record added.");
      setForm(Object.fromEntries(section.fields.map((field) => [field.name, ""])));
      setRows(await fetchRows());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The record could not be added.");
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
              />
            )}
          </label>
        ))}
        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Adding…" : "Add record"}</button>
        </div>
      </form>

      <div className="management-table-wrap">
        <table className="management-table">
          <thead>
            <tr>{section.columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                {section.columns.map((column) => <td key={column.key}>{display(row[column.key])}</td>)}
              </tr>
            ))}
            {loading && <tr><td className="management-empty" colSpan={section.columns.length}>Loading records…</td></tr>}
            {!loading && rows.length === 0 && <tr><td className="management-empty" colSpan={section.columns.length}>No records yet.</td></tr>}
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
