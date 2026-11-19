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
const emptyUser = { fullName: "", email: "", password: "" };

export default function RoleManager() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [permissionForm, setPermissionForm] = useState(emptyPermission);
  const [userForm, setUserForm] = useState(emptyUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      if (prefix === "role") setRoleForm(emptyRole);
      if (prefix === "permission") setPermissionForm(emptyPermission);
      if (prefix === "user") setUserForm(emptyUser);
    });
  }

  const post = (url: string) => (body: Record<string, string>) =>
    fetchJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

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
          <h2>Create role</h2>
          <p>Add a custom role, then grant the permissions it needs below.</p>
        </div>
        <form className="management-form" onSubmit={(event) => submit("role", event, roleForm, post("/api/roles"), "Role created.")}>
          <label>Role name<input required value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} placeholder="e.g. Site Engineer" /></label>
          <label>Description<input value={roleForm.description} onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })} /></label>
          <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy}>Create role</button></div>
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
            <article className="role-card" key={role.id}>
              <div className="role-card-head">
                <div>
                  <strong>{role.name}</strong>
                  {role.isSystem && <span className="role-badge">Default</span>}
                  <p>{role.description || "No description"}</p>
                </div>
                {!role.isSystem && (
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => fetchJson(`/api/roles/${role.id}`, { method: "DELETE" }), "Role deleted.")}
                  >
                    Delete
                  </button>
                )}
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
          <h2>Permission catalogue</h2>
          <p>Add new permission codes to use in role grants.</p>
        </div>
        <form className="management-form" onSubmit={(event) => submit("permission", event, permissionForm, post("/api/roles/permissions"), "Permission created.")}>
          <label>Code<input required value={permissionForm.code} onChange={(event) => setPermissionForm({ ...permissionForm, code: event.target.value })} placeholder="reports.export" /></label>
          <label>Module<input required value={permissionForm.module} onChange={(event) => setPermissionForm({ ...permissionForm, module: event.target.value })} placeholder="reports" /></label>
          <label>Description<input value={permissionForm.description} onChange={(event) => setPermissionForm({ ...permissionForm, description: event.target.value })} /></label>
          <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy}>Add permission</button></div>
        </form>
      </section>

      <section className="management-card">
        <div className="management-card-heading">
          <h2>Users &amp; role assignments</h2>
          <p>Create application users and choose which roles each user holds.</p>
        </div>
        <form className="management-form" onSubmit={(event) => submit("user", event, userForm, post("/api/roles/users"), "User created.")}>
          <label>Full name<input required value={userForm.fullName} onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })} /></label>
          <label>Email<input required type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label>
          <label>Password<input required type="password" minLength={6} value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label>
          <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy}>Create user</button></div>
        </form>

        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Email</th>
                <th scope="col">Status</th>
                <th scope="col">Roles</th>
              </tr>
            </thead>
            <tbody>
              {(snapshot?.users ?? []).map((user) => (
                <tr key={user.id}>
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
                </tr>
              ))}
              {snapshot?.users.length === 0 && <tr><td className="management-empty" colSpan={4}>No application users yet. Create one above.</td></tr>}
              {!snapshot && <tr><td className="management-empty" colSpan={4}>Loading users…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
