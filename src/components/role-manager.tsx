"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { fetchJson } from "@/lib/client-api";

type Role = {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  companyId: number | null;
};

type Permission = {
  id: number;
  code: string;
  module: string;
  description: string | null;
};

type AppUser = {
  id: number;
  email: string;
  fullName: string;
  isActive: boolean;
};

type Snapshot = {
  roles: Role[];
  permissions: Permission[];
  users: AppUser[];
  rolePermissions: Array<{ roleId: number; permissionId: number }>;
  userRoles: Array<{ userId: number; roleId: number }>;
};

const emptyRole = { name: "", description: "" };
const emptyPermission = { code: "", module: "", description: "" };
const emptyUser = { fullName: "", email: "", password: "", status: "ACTIVE" };

export default function RoleManager() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [permissionForm, setPermissionForm] = useState(emptyPermission);
  const [userForm, setUserForm] = useState(emptyUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editingPermissionId, setEditingPermissionId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setSnapshot(await fetchJson<Snapshot>("/api/roles"));
  }, []);

  useEffect(() => {
    void Promise.resolve()
      .then(() => refresh())
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Roles could not be loaded."));
  }, [refresh]);

  async function run(action: () => Promise<unknown>, message: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function submit(prefix: string, event: FormEvent<HTMLFormElement>, form: Record<string, string>, action: (body: Record<string, string>) => Promise<unknown>, message: string) {
    event.preventDefault();
    void run(() => action(form), message).then((saved) => {
      if (!saved) return;
      if (prefix === "role") { setRoleForm(emptyRole); setEditingRoleId(null); }
      if (prefix === "permission") { setPermissionForm(emptyPermission); setEditingPermissionId(null); }
      if (prefix === "user") { setUserForm(emptyUser); setEditingUserId(null); }
    });
  }

  const write = (method: "POST" | "PATCH", url: string) => (body: Record<string, string>) =>
    fetchJson(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const post = (url: string) => write("POST", url);
  const patch = (url: string) => write("PATCH", url);

  function startRoleEdit(role: Role) {
    setEditingRoleId(role.id);
    setRoleForm({ name: role.name, description: role.description ?? "" });
    setError(null);
    setNotice(null);
  }

  function startPermissionEdit(permission: Permission) {
    setEditingPermissionId(permission.id);
    setPermissionForm({ code: permission.code, module: permission.module, description: permission.description ?? "" });
    setError(null);
    setNotice(null);
  }

  function startUserEdit(user: AppUser) {
    setEditingUserId(user.id);
    setUserForm({ fullName: user.fullName, email: user.email, password: "", status: user.isActive ? "ACTIVE" : "INACTIVE" });
    setError(null);
    setNotice(null);
  }

  function cancelEdit() {
    setEditingRoleId(null);
    setEditingPermissionId(null);
    setEditingUserId(null);
    setRoleForm(emptyRole);
    setPermissionForm(emptyPermission);
    setUserForm(emptyUser);
    setError(null);
    setNotice(null);
  }

  async function removeRole(role: Role) {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    if (await run(() => fetchJson(`/api/roles/${role.id}`, { method: "DELETE" }), "Role deleted.") && editingRoleId === role.id) {
      setEditingRoleId(null);
    }
  }

  async function removePermission(permission: Permission) {
    if (!window.confirm(`Delete permission "${permission.code}"? It will be removed from all roles.`)) return;
    if (await run(() => fetchJson(`/api/roles/permissions/${permission.id}`, { method: "DELETE" }), "Permission deleted.") && editingPermissionId === permission.id) {
      setEditingPermissionId(null);
    }
  }

  async function removeUser(user: AppUser) {
    if (!window.confirm(`Delete user "${user.fullName}"? Their role assignments will be removed.`)) return;
    if (await run(() => fetchJson(`/api/roles/users/${user.id}`, { method: "DELETE" }), "User deleted.") && editingUserId === user.id) {
      setEditingUserId(null);
    }
  }

  const editingSystemRole = editingRoleId !== null && snapshot?.roles.find((role) => role.id === editingRoleId)?.isSystem === true;

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const permission of snapshot?.permissions ?? []) {
      const list = groups.get(permission.module) ?? [];
      list.push(permission);
      groups.set(permission.module, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [snapshot?.permissions]);

  const grantedPermissions = useMemo(
    () => new Set((snapshot?.rolePermissions ?? []).map((grant) => `${grant.roleId}:${grant.permissionId}`)),
    [snapshot?.rolePermissions],
  );
  const assignedRoles = useMemo(
    () => new Set((snapshot?.userRoles ?? []).map((assignment) => `${assignment.userId}:${assignment.roleId}`)),
    [snapshot?.userRoles],
  );

  function togglePermission(role: Role, permission: Permission) {
    const key = `${role.id}:${permission.id}`;
    const action = grantedPermissions.has(key)
      ? () => fetchJson(`/api/roles/grants?type=permission&roleId=${role.id}&permissionId=${permission.id}`, { method: "DELETE" })
      : () => post("/api/roles/grants")({ type: "permission", roleId: String(role.id), permissionId: String(permission.id) });
    void run(action, grantedPermissions.has(key) ? "Permission removed." : "Permission granted.");
  }

  function toggleUserRole(user: AppUser, role: Role) {
    const key = `${user.id}:${role.id}`;
    const action = assignedRoles.has(key)
      ? () => fetchJson(`/api/roles/grants?type=role&userId=${user.id}&roleId=${role.id}`, { method: "DELETE" })
      : () => post("/api/roles/grants")({ type: "role", userId: String(user.id), roleId: String(role.id) });
    void run(action, assignedRoles.has(key) ? "Role removed from user." : "Role assigned to user.");
  }

  return (
    <main className="management-main">
      <section className="management-heading">
        <div>
          <div className="eyebrow">ACCESS CONTROL</div>
          <h1>Roles &amp; permissions</h1>
          <p className="page-subtitle">Define roles, grant permissions, and assign roles to application users.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void run(() => refresh(), "Roles refreshed.")} disabled={busy}>
          Refresh
        </button>
      </section>

      {error && <div className="management-message error-message" role="alert">{error}</div>}
      {notice && <div className="management-message success-message" role="status">{notice}</div>}

      <section className="management-card">
        <div className="management-card-heading">
          <h2>{editingRoleId !== null ? "Edit role" : "Create role"}</h2>
          <p>Add a custom role, then grant the permissions it needs below.</p>
        </div>
        <form
          className="management-form"
          onSubmit={(event) => submit(
            "role",
            event,
            roleForm,
            editingRoleId !== null ? patch(`/api/roles/${editingRoleId}`) : post("/api/roles"),
            editingRoleId !== null ? "Role updated." : "Role created.",
          )}
        >
          <label>Role name<input required disabled={editingSystemRole} value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} placeholder="e.g. Site Engineer" /></label>
          <label>Description<input value={roleForm.description} onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })} /></label>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : editingRoleId !== null ? "Save changes" : "Create role"}
            </button>
            {editingRoleId !== null && (
              <button className="button button-secondary" type="button" onClick={cancelEdit} disabled={busy}>Cancel edit</button>
            )}
          </div>
        </form>
      </section>

      <section className="management-card">
        <div className="management-card-heading">
          <h2>Roles &amp; permission grants</h2>
          <p>{snapshot?.roles.length ?? 0} roles · {snapshot?.permissions.length ?? 0} permissions. Default roles can be customised but not deleted.</p>
        </div>
        {!snapshot && <p className="page-subtitle">Loading roles…</p>}
        <div className="role-grid">
          {(snapshot?.roles ?? []).map((role) => (
            <article className={`role-card${editingRoleId === role.id ? " editing-row" : ""}`} key={role.id}>
              <div className="role-card-head">
                <div>
                  <strong>{role.name}</strong>
                  {role.isSystem && <span className="role-badge">Default</span>}
                  <p>{role.description || "No description"}</p>
                </div>
                <div className="role-card-actions">
                  <button
                    className="button button-secondary row-action"
                    type="button"
                    disabled={busy}
                    onClick={() => startRoleEdit(role)}
                  >
                    Edit
                  </button>
                  {!role.isSystem && (
                    <button
                      className="button button-danger row-action"
                      type="button"
                      disabled={busy}
                      onClick={() => void removeRole(role)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <div className="permission-groups">
                {groupedPermissions.map(([module, permissions]) => (
                  <div className="permission-group" key={module}>
                    <span className="permission-module">{module}</span>
                    <div className="permission-items">
                      {permissions.map((permission) => (
                        <label className="permission-item" key={permission.id}>
                          <input
                            type="checkbox"
                            checked={grantedPermissions.has(`${role.id}:${permission.id}`)}
                            disabled={busy}
                            onChange={() => togglePermission(role, permission)}
                          />
                          <span>{permission.code}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="management-card">
        <div className="management-card-heading">
          <h2>{editingPermissionId !== null ? "Edit permission" : "Permission catalogue"}</h2>
          <p>Add new permission codes to use in role grants.</p>
        </div>
        <form
          className="management-form"
          onSubmit={(event) => submit(
            "permission",
            event,
            permissionForm,
            editingPermissionId !== null ? patch(`/api/roles/permissions/${editingPermissionId}`) : post("/api/roles/permissions"),
            editingPermissionId !== null ? "Permission updated." : "Permission created.",
          )}
        >
          <label>Code<input required value={permissionForm.code} onChange={(event) => setPermissionForm({ ...permissionForm, code: event.target.value })} placeholder="reports.export" /></label>
          <label>Module<input required value={permissionForm.module} onChange={(event) => setPermissionForm({ ...permissionForm, module: event.target.value })} placeholder="reports" /></label>
          <label>Description<input value={permissionForm.description} onChange={(event) => setPermissionForm({ ...permissionForm, description: event.target.value })} /></label>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : editingPermissionId !== null ? "Save changes" : "Add permission"}
            </button>
            {editingPermissionId !== null && (
              <button className="button button-secondary" type="button" onClick={cancelEdit} disabled={busy}>Cancel edit</button>
            )}
          </div>
        </form>

        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Module</th>
                <th scope="col">Description</th>
                <th scope="col">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {(snapshot?.permissions ?? []).map((permission) => (
                <tr key={permission.id} className={editingPermissionId === permission.id ? "editing-row" : undefined}>
                  <td>{permission.code}</td>
                  <td>{permission.module}</td>
                  <td>{permission.description || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="button button-secondary row-action" type="button" onClick={() => startPermissionEdit(permission)} disabled={busy}>
                        Edit
                      </button>
                      <button className="button button-danger row-action" type="button" onClick={() => void removePermission(permission)} disabled={busy}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!snapshot && <tr><td className="management-empty" colSpan={4}>Loading permissions…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="management-card">
        <div className="management-card-heading">
          <h2>{editingUserId !== null ? "Edit user" : "Users & role assignments"}</h2>
          <p>Create application users and choose which roles each user holds.</p>
        </div>
        <form
          className="management-form"
          onSubmit={(event) => submit(
            "user",
            event,
            userForm,
            editingUserId !== null ? patch(`/api/roles/users/${editingUserId}`) : post("/api/roles/users"),
            editingUserId !== null ? "User updated." : "User created.",
          )}
        >
          <label>Full name<input required value={userForm.fullName} onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })} /></label>
          <label>Email<input required type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label>
          <label>
            Password
            <input
              type="password"
              minLength={6}
              required={editingUserId === null}
              value={userForm.password}
              onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
              placeholder={editingUserId !== null ? "Leave blank to keep current password" : undefined}
            />
          </label>
          <label>
            Status
            <select value={userForm.status} onChange={(event) => setUserForm({ ...userForm, status: event.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : editingUserId !== null ? "Save changes" : "Create user"}
            </button>
            {editingUserId !== null && (
              <button className="button button-secondary" type="button" onClick={cancelEdit} disabled={busy}>Cancel edit</button>
            )}
          </div>
        </form>

        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Email</th>
                <th scope="col">Status</th>
                <th scope="col">Roles</th>
                <th scope="col">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {(snapshot?.users ?? []).map((user) => (
                <tr key={user.id} className={editingUserId === user.id ? "editing-row" : undefined}>
                  <td><strong>{user.fullName}</strong></td>
                  <td>{user.email}</td>
                  <td>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => void run(
                        () => fetchJson(`/api/roles/users/${user.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isActive: !user.isActive }),
                        }),
                        user.isActive ? "User deactivated." : "User activated.",
                      )}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td>
                    <div className="role-assignments">
                      {(snapshot?.roles ?? []).map((role) => (
                        <label className="role-option" key={role.id}>
                          <input
                            type="checkbox"
                            checked={assignedRoles.has(`${user.id}:${role.id}`)}
                            disabled={busy}
                            onChange={() => toggleUserRole(user, role)}
                          />
                          <span>{role.name}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="button button-secondary row-action" type="button" onClick={() => startUserEdit(user)} disabled={busy}>
                        Edit
                      </button>
                      <button className="button button-danger row-action" type="button" onClick={() => void removeUser(user)} disabled={busy}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {snapshot?.users.length === 0 && <tr><td className="management-empty" colSpan={5}>No application users yet. Create one above.</td></tr>}
              {!snapshot && <tr><td className="management-empty" colSpan={5}>Loading users…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
