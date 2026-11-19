"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchJson } from "@/lib/client-api";

type Site = {
  id: number;
  siteCode: string;
  siteName: string;
  location: string;
  managerName: string | null;
  status: string;
};

type SiteForm = {
  siteCode: string;
  siteName: string;
  location: string;
  managerName: string;
  status: "ACTIVE" | "INACTIVE";
};

const emptyForm: SiteForm = { siteCode: "", siteName: "", location: "", managerName: "", status: "ACTIVE" };

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState<SiteForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function loadSites() {
    setIsLoading(true);
    setError(null);
    try {
      setSites(await fetchJson<Site[]>("/api/sites"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sites could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchJson<Site[]>("/api/sites")
      .then((rows) => {
        if (cancelled) return;
        setSites(rows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Sites could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function startEdit(site: Site) {
    setEditingId(site.id);
    setForm({
      siteCode: site.siteCode,
      siteName: site.siteName,
      location: site.location,
      managerName: site.managerName ?? "",
      status: site.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
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

  async function removeSite(site: Site) {
    if (!window.confirm(`Delete site "${site.siteName}"? This cannot be undone.`)) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson(`/api/sites/${site.id}`, { method: "DELETE" });
      if (editingId === site.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      setSuccess("Site deleted.");
      await loadSites();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Site could not be deleted.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editing = editingId !== null;
    const siteCode = form.siteCode.trim();
    const siteName = form.siteName.trim();
    const location = form.location.trim();

    if ((!editing && !siteCode) || !siteName || !location) {
      setError("Site code, site name, and location are required.");
      return;
    }
    if (!editing && sites.some((site) => site.siteCode.toLowerCase() === siteCode.toLowerCase())) {
      setError(`Site code "${siteCode}" already exists.`);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchJson<Site>(editing ? `/api/sites/${editingId}` : "/api/sites", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          siteCode,
          siteName,
          location,
          managerName: form.managerName.trim(),
        }),
      });
      setForm(emptyForm);
      setEditingId(null);
      setSuccess(editing ? "Site updated." : "Site added.");
      await loadSites();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Site could not be ${editing ? "updated" : "added"}.`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="management-main">
      <section className="management-heading">
        <div>
          <div className="eyebrow">FIELD FOOTPRINT</div>
          <h1>Construction sites</h1>
          <p className="page-subtitle">Create and manage the locations where your teams work.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void loadSites()} disabled={isLoading}>
          {isLoading ? "Loading…" : "Refresh"}
        </button>
      </section>

      {error && <div className="management-message error-message" role="alert">{error}</div>}
      {success && <div className="management-message success-message" role="status">{success}</div>}

      <section className="management-card">
        <div className="management-card-heading">
          <h2>{editingId !== null ? "Edit site" : "Add a site"}</h2>
          <p>Site code, site name, and location are required.</p>
        </div>
        <form className="management-form" onSubmit={addSite}>
          <label>
            Site code
            <input value={form.siteCode} disabled={editingId !== null} onChange={(event) => setForm({ ...form, siteCode: event.target.value })} required />
          </label>
          <label>
            Site name
            <input value={form.siteName} onChange={(event) => setForm({ ...form, siteName: event.target.value })} required />
          </label>
          <label>
            Location
            <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} required />
          </label>
          <label>
            Manager
            <input value={form.managerName} onChange={(event) => setForm({ ...form, managerName: event.target.value })} />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as SiteForm["status"] })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : editingId !== null ? "Save changes" : "Add site"}
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
          <h2>Sites</h2>
          <p>{sites.length} records</p>
        </div>
        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th scope="col">Code</th><th scope="col">Site</th><th scope="col">Location</th>
                <th scope="col">Manager</th><th scope="col">Status</th><th scope="col">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id} className={editingId === site.id ? "editing-row" : undefined}>
                  <td>{site.siteCode}</td><td>{site.siteName}</td><td>{site.location}</td>
                  <td>{site.managerName || "—"}</td><td>{site.status}</td>
                  <td>
                    <div className="row-actions">
                      <button className="button button-secondary row-action" type="button" onClick={() => startEdit(site)} disabled={isSaving}>
                        Edit
                      </button>
                      <button className="button button-danger row-action" type="button" onClick={() => void removeSite(site)} disabled={isSaving}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td className="management-empty" colSpan={6}>Loading sites…</td></tr>}
              {!isLoading && !error && sites.length === 0 && <tr><td className="management-empty" colSpan={6}>No sites have been added yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
