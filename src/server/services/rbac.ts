import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  appUsers, permissions, rolePermissions, roles, userRoles,
} from "@/db/schema/enterprise";
import { hashPassword } from "@/lib/auth";
import { isUniqueConstraintViolation } from "@/lib/postgres-errors";
import { getWorkspaceCompanyId } from "@/lib/workspace";

type Body = Record<string, unknown>;

export class RbacError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function text(b: Body, key: string): string | null {
  const value = b[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(b: Body, key: string): string {
  const value = text(b, key);
  if (!value) throw new RbacError(`${key} is required.`);
  return value;
}

export function parseId(value: unknown, key: string): number {
  const raw = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  const id = Number.parseInt(raw, 10);
  if (!/^\d+$/.test(raw) || !Number.isInteger(id) || id <= 0) {
    throw new RbacError(`${key} must be a positive integer.`);
  }
  return id;
}

export async function readBody(req: Request): Promise<Body> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new RbacError("Request body must be valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RbacError("Request body must be a JSON object.");
  }
  return body as Body;
}

export function errorPayload(error: unknown): { error: string; status: number } {
  if (error instanceof RbacError) return { error: error.message, status: error.status };
  if (isUniqueConstraintViolation(error)) {
    return { error: "A record with that name or code already exists.", status: 409 };
  }
  console.error("Role management request failed:", error);
  return { error: "The request could not be completed.", status: 500 };
}

const DEFAULT_PERMISSIONS = [
  { code: "projects.view", module: "projects", description: "View projects and progress" },
  { code: "projects.manage", module: "projects", description: "Create and update projects" },
  { code: "daily_plans.view", module: "daily-plans", description: "View daily plans" },
  { code: "daily_plans.manage", module: "daily-plans", description: "Create daily plans and tasks" },
  { code: "daily_plans.approve", module: "daily-plans", description: "Approve daily plans" },
  { code: "attendance.view", module: "attendance", description: "View attendance" },
  { code: "attendance.record", module: "attendance", description: "Record attendance" },
  { code: "daily_reports.view", module: "daily-reports", description: "View daily site reports" },
  { code: "daily_reports.submit", module: "daily-reports", description: "Submit daily site reports" },
  { code: "daily_reports.approve", module: "daily-reports", description: "Review and approve daily reports" },
  { code: "materials.view", module: "materials", description: "View materials and stock" },
  { code: "materials.manage", module: "materials", description: "Record material movements" },
  { code: "safety.view", module: "safety", description: "View safety and quality records" },
  { code: "safety.manage", module: "safety", description: "Record inspections and incidents" },
  { code: "reports.view", module: "daily-summary", description: "View generated daily reports" },
  { code: "roles.view", module: "roles", description: "View roles and assignments" },
  { code: "roles.manage", module: "roles", description: "Manage roles, permissions and assignments" },
] as const;

const DEFAULT_ROLE_GRANTS: Record<string, readonly string[]> = {
  Admin: DEFAULT_PERMISSIONS.map((permission) => permission.code),
  "Project Manager": [
    "projects.view", "projects.manage", "daily_plans.view", "daily_plans.manage",
    "daily_plans.approve", "attendance.view", "daily_reports.view",
    "daily_reports.approve", "materials.view", "safety.view", "reports.view",
  ],
  "Site Supervisor": [
    "daily_plans.view", "attendance.view", "attendance.record",
    "daily_reports.view", "daily_reports.submit", "reports.view",
  ],
  "Materials Manager": ["materials.view", "materials.manage", "reports.view"],
  "Safety Officer": ["safety.view", "safety.manage", "daily_reports.view", "reports.view"],
};

/** Create the standard permission catalogue, roles and grants on first use. */
export async function ensureDefaults() {
  const companyId = await getWorkspaceCompanyId();

  await db.insert(permissions)
    .values(DEFAULT_PERMISSIONS.map((permission) => ({ ...permission })))
    .onConflictDoNothing();

  await db.insert(roles)
    .values(Object.keys(DEFAULT_ROLE_GRANTS).map((name) => ({
      companyId,
      name,
      description: `Default ${name} role`,
      isSystem: true,
    })))
    .onConflictDoNothing({ target: [roles.companyId, roles.name] });

  const [permissionRows, roleRows] = await Promise.all([
    db.select().from(permissions).orderBy(asc(permissions.code)),
    db.select().from(roles)
      .where(or(eq(roles.companyId, companyId), isNull(roles.companyId)))
      .orderBy(asc(roles.name)),
  ]);

  const permissionByCode = new Map(permissionRows.map((permission) => [permission.code, permission.id]));
  const grants = roleRows.flatMap((role) =>
    (DEFAULT_ROLE_GRANTS[role.name] ?? []).flatMap((code) => {
      const permissionId = permissionByCode.get(code);
      return permissionId ? [{ roleId: role.id, permissionId }] : [];
    }));

  if (grants.length > 0) {
    await db.insert(rolePermissions).values(grants).onConflictDoNothing();
  }

  return { companyId, permissionRows, roleRows };
}

export async function getSnapshot() {
  const { companyId, permissionRows, roleRows } = await ensureDefaults();
  const userRows = await db.select({
    id: appUsers.id,
    email: appUsers.email,
    fullName: appUsers.fullName,
    isActive: appUsers.isActive,
  }).from(appUsers).where(eq(appUsers.companyId, companyId)).orderBy(asc(appUsers.id));

  const roleIds = roleRows.map((role) => role.id);
  const userIds = userRows.map((user) => user.id);

  const [grantRows, assignmentRows] = await Promise.all([
    roleIds.length > 0
      ? db.select({ roleId: rolePermissions.roleId, permissionId: rolePermissions.permissionId })
        .from(rolePermissions).where(inArray(rolePermissions.roleId, roleIds))
      : Promise.resolve([] as Array<{ roleId: number; permissionId: number }>),
    userIds.length > 0
      ? db.select({ userId: userRoles.userId, roleId: userRoles.roleId })
        .from(userRoles).where(inArray(userRoles.userId, userIds))
      : Promise.resolve([] as Array<{ userId: number; roleId: number }>),
  ]);

  return {
    roles: roleRows.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      companyId: role.companyId,
    })),
    permissions: permissionRows.map((permission) => ({
      id: permission.id,
      code: permission.code,
      module: permission.module,
      description: permission.description,
    })),
    users: userRows,
    rolePermissions: grantRows,
    userRoles: assignmentRows,
  };
}

async function scopedRole(id: number, companyId: number) {
  const [role] = await db.select().from(roles)
    .where(and(eq(roles.id, id), or(eq(roles.companyId, companyId), isNull(roles.companyId))))
    .limit(1);
  if (!role) throw new RbacError("Role not found.", 404);
  return role;
}

export async function createRole(b: Body) {
  const companyId = await getWorkspaceCompanyId();
  const [role] = await db.insert(roles).values({
    companyId,
    name: requiredText(b, "name"),
    description: text(b, "description"),
    isSystem: false,
  }).returning();
  return role;
}

export async function updateRole(id: number, b: Body) {
  const companyId = await getWorkspaceCompanyId();
  const role = await scopedRole(id, companyId);

  const values: Record<string, unknown> = {};
  const name = text(b, "name");
  if (name !== null) {
    if (role.isSystem) throw new RbacError("Default role names cannot be changed.", 403);
    values.name = name;
  }
  const description = text(b, "description");
  if (description !== null || b.description === "") values.description = description;
  if (Object.keys(values).length === 0) throw new RbacError("No valid fields to update.");

  const [updated] = await db.update(roles).set(values)
    .where(and(eq(roles.id, id), eq(roles.companyId, companyId)))
    .returning();
  return updated;
}

export async function deleteRole(id: number) {
  const companyId = await getWorkspaceCompanyId();
  const role = await scopedRole(id, companyId);
  if (role.isSystem) throw new RbacError("Default roles cannot be deleted.", 403);
  await db.delete(roles).where(and(eq(roles.id, id), eq(roles.companyId, companyId)));
  return { id, deleted: true };
}

export async function createPermission(b: Body) {
  const code = requiredText(b, "code");
  if (!/^[a-z][a-z0-9_.-]*$/.test(code)) {
    throw new RbacError("Permission code must use lowercase letters, numbers, dots, dashes or underscores.");
  }
  const [permission] = await db.insert(permissions).values({
    code,
    module: requiredText(b, "module"),
    description: text(b, "description"),
  }).returning();
  return permission;
}

export async function updatePermission(id: number, b: Body) {
  const code = requiredText(b, "code");
  if (!/^[a-z][a-z0-9_.-]*$/.test(code)) {
    throw new RbacError("Permission code must use lowercase letters, numbers, dots, dashes or underscores.");
  }
  const [permission] = await db.update(permissions).set({
    code,
    module: requiredText(b, "module"),
    description: text(b, "description"),
  }).where(eq(permissions.id, id)).returning();
  if (!permission) throw new RbacError("Permission not found.", 404);
  return permission;
}

export async function createUser(b: Body) {
  const email = requiredText(b, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RbacError("A valid email is required.");
  const password = typeof b.password === "string" ? b.password : "";
  if (password.length < 6) throw new RbacError("Password must be at least 6 characters.");

  const [user] = await db.insert(appUsers).values({
    companyId: await getWorkspaceCompanyId(),
    email,
    fullName: requiredText(b, "fullName"),
    passwordHash: hashPassword(password),
    isActive: true,
  }).returning();
  return { id: user.id, email: user.email, fullName: user.fullName, isActive: user.isActive };
}

export async function updateUser(id: number, b: Body) {
  const companyId = await getWorkspaceCompanyId();
  const [existing] = await db.select().from(appUsers)
    .where(and(eq(appUsers.id, id), eq(appUsers.companyId, companyId))).limit(1);
  if (!existing) throw new RbacError("User not found.", 404);

  const values: Record<string, unknown> = {};
  const email = text(b, "email");
  if (email !== null) {
    const normalized = email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new RbacError("A valid email is required.");
    values.email = normalized;
  }
  const fullName = text(b, "fullName");
  if (fullName !== null) values.fullName = fullName;
  if (typeof b.isActive === "boolean") values.isActive = b.isActive;
  const password = typeof b.password === "string" ? b.password : "";
  if (password) {
    if (password.length < 6) throw new RbacError("Password must be at least 6 characters.");
    values.passwordHash = hashPassword(password);
  }
  if (Object.keys(values).length === 0) throw new RbacError("No valid fields to update.");

  const [updated] = await db.update(appUsers).set(values)
    .where(and(eq(appUsers.id, id), eq(appUsers.companyId, companyId)))
    .returning({ id: appUsers.id, email: appUsers.email, fullName: appUsers.fullName, isActive: appUsers.isActive });
  return updated;
}

export async function grantPermission(b: Body) {
  const companyId = await getWorkspaceCompanyId();
  const roleId = parseId(b.roleId, "roleId");
  const permissionId = parseId(b.permissionId, "permissionId");
  await scopedRole(roleId, companyId);
  const [permission] = await db.select({ id: permissions.id }).from(permissions)
    .where(eq(permissions.id, permissionId)).limit(1);
  if (!permission) throw new RbacError("Permission not found.", 404);

  await db.insert(rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
  return { roleId, permissionId, granted: true };
}

export async function revokePermission(roleId: number, permissionId: number) {
  await scopedRole(roleId, await getWorkspaceCompanyId());
  await db.delete(rolePermissions)
    .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));
  return { roleId, permissionId, granted: false };
}

export async function grantUserRole(b: Body) {
  const companyId = await getWorkspaceCompanyId();
  const userId = parseId(b.userId, "userId");
  const roleId = parseId(b.roleId, "roleId");
  const [user] = await db.select({ id: appUsers.id }).from(appUsers)
    .where(and(eq(appUsers.id, userId), eq(appUsers.companyId, companyId))).limit(1);
  if (!user) throw new RbacError("User not found.", 404);
  await scopedRole(roleId, companyId);

  await db.insert(userRoles).values({ userId, roleId }).onConflictDoNothing();
  return { userId, roleId, assigned: true };
}

export async function revokeUserRole(userId: number, roleId: number) {
  const companyId = await getWorkspaceCompanyId();
  const [user] = await db.select({ id: appUsers.id }).from(appUsers)
    .where(and(eq(appUsers.id, userId), eq(appUsers.companyId, companyId))).limit(1);
  if (!user) throw new RbacError("User not found.", 404);
  await scopedRole(roleId, companyId);

  await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
  return { userId, roleId, assigned: false };
}
