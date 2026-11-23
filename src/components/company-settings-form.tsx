"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchJson } from "@/lib/client-api";

type Company = {
  id: number;
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  countryCode: string;
  currency: string;
  timezone: string;
  status: string;
};

type FieldName = Exclude<keyof Company, "id">;
type Field = {
  name: FieldName;
  label: string;
  type?: "text" | "email" | "tel" | "select";
  options?: readonly string[];
  required?: boolean;
  wide?: boolean;
  placeholder?: string;
};

const fields: Field[] = [
  { name: "name", label: "Company name", required: true },
  { name: "legalName", label: "Legal name" },
  { name: "registrationNumber", label: "Registration number" },
  { name: "taxNumber", label: "Tax number" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "address", label: "Address", wide: true },
  { name: "countryCode", label: "Country code", placeholder: "ET" },
  { name: "currency", label: "Currency", placeholder: "ETB" },
  { name: "timezone", label: "Timezone", placeholder: "Africa/Addis_Ababa" },
  { name: "status", label: "Status", type: "select", options: ["active", "inactive", "archived"] },
];

function toForm(company: Company): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.name, company[field.name] ?? ""]));
}

export default function CompanySettingsForm() {
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, ""])));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchJson<Company>("/api/settings/company", { signal: controller.signal })
      .then((company) => {
        if (controller.signal.aborted) return;
        setForm(toForm(company));
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Company settings could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const payload = Object.fromEntries(fields.map((field) => [field.name, (form[field.name] ?? "").trim()]));
    try {
      const updated = await fetchJson<Company>("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setForm(toForm(updated));
      setSuccess("Company settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Company settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="management-card">
      <div className="management-card-heading">
        <h2>Company settings</h2>
        <p>Identity, registration and reporting defaults for this workspace.</p>
      </div>

      {error && <div className="management-message error-message" role="alert">{error}</div>}
      {success && <div className="management-message success-message" role="status">{success}</div>}

      <form className="management-form" onSubmit={submit}>
        {fields.map((field) => (
          <label key={field.name} className={field.wide ? "form-field-wide" : undefined}>
            {field.label}
            {field.type === "select" ? (
              <select
                value={form[field.name] ?? ""}
                onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
                required={field.required}
                disabled={loading}
              >
                {(field.options ?? []).map((option) => <option value={option} key={option}>{option}</option>)}
              </select>
            ) : (
              <input
                type={field.type ?? "text"}
                value={form[field.name] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
                required={field.required}
                disabled={loading}
              />
            )}
          </label>
        ))}
        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={loading || saving}>
            {saving ? "Saving…" : "Save company settings"}
          </button>
        </div>
      </form>
    </section>
  );
}
