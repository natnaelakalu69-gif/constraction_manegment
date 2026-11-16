import {
  pgTable, pgEnum, serial, integer, varchar, text, boolean, date, time,
  timestamp, numeric, jsonb, index, uniqueIndex, foreignKey,
} from "drizzle-orm/pg-core";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};
const money = (name: string) => numeric(name, { precision: 16, scale: 2 });
const qty = (name: string) => numeric(name, { precision: 18, scale: 4 });

export const recordStatus = pgEnum("record_status", ["active", "inactive", "archived"]);
export const projectStatus = pgEnum("project_status", ["planning", "active", "suspended", "completed", "cancelled"]);
export const employmentType = pgEnum("employment_type", ["employee", "day_labor", "contractor"]);
export const attendanceState = pgEnum("attendance_state", ["present", "absent", "late", "leave", "holiday", "off"]);
export const requestState = pgEnum("approval_state", ["draft", "submitted", "approved", "rejected", "cancelled"]);
export const inventoryMovementType = pgEnum("inventory_movement_type", ["receipt", "issue", "return", "transfer_in", "transfer_out", "adjustment", "wastage"]);

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(), name: varchar("name", { length: 200 }).notNull(), legalName: varchar("legal_name", { length: 250 }),
  registrationNumber: varchar("registration_number", { length: 100 }), taxNumber: varchar("tax_number", { length: 100 }),
  email: varchar("email", { length: 254 }), phone: varchar("phone", { length: 40 }), address: text("address"),
  countryCode: varchar("country_code", { length: 2 }).notNull().default("ET"), currency: varchar("currency", { length: 3 }).notNull().default("ETB"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Africa/Addis_Ababa"), status: recordStatus("status").notNull().default("active"), ...auditColumns,
}, (t) => ({ nameIdx: index("companies_name_idx").on(t.name), regUnique: uniqueIndex("companies_registration_unique").on(t.registrationNumber) }));

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), code: varchar("code", { length: 30 }).notNull(), name: varchar("name", { length: 180 }).notNull(), address: text("address"), ...auditColumns,
}, (t) => ({ companyCodeUnique: uniqueIndex("branches_company_code_unique").on(t.companyId, t.code) }));
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), branchId: integer("branch_id").references(() => branches.id), parentId: integer("parent_id"), code: varchar("code", { length: 30 }).notNull(), name: varchar("name", { length: 150 }).notNull(), ...auditColumns,
}, (t) => ({ companyCodeUnique: uniqueIndex("departments_company_code_unique").on(t.companyId, t.code), parentFk: foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }) }));
export const positions = pgTable("positions", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), code: varchar("code", { length: 30 }).notNull(), title: varchar("title", { length: 120 }).notNull(), description: text("description"), ...auditColumns,
}, (t) => ({ companyCodeUnique: uniqueIndex("positions_company_code_unique").on(t.companyId, t.code) }));
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(), companyId: integer("company_id").references(() => companies.id), name: varchar("name", { length: 100 }).notNull(), description: text("description"), isSystem: boolean("is_system").default(false).notNull(), ...auditColumns,
}, (t) => ({ scopeNameUnique: uniqueIndex("roles_scope_name_unique").on(t.companyId, t.name) }));
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(), code: varchar("code", { length: 120 }).notNull().unique(), description: text("description"), module: varchar("module", { length: 60 }).notNull(),
});
export const rolePermissions = pgTable("role_permissions", {
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }), permissionId: integer("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (t) => ({ pk: uniqueIndex("role_permissions_pk").on(t.roleId, t.permissionId) }));

export const appUsers = pgTable("app_users", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), email: varchar("email", { length: 254 }).notNull(), fullName: varchar("full_name", { length: 180 }).notNull(), passwordHash: varchar("password_hash", { length: 255 }).notNull(), isActive: boolean("is_active").notNull().default(true), lastLoginAt: timestamp("last_login_at", { withTimezone: true }), ...auditColumns,
}, (t) => ({ companyEmailUnique: uniqueIndex("app_users_company_email_unique").on(t.companyId, t.email), companyIdx: index("app_users_company_idx").on(t.companyId) }));
export const userRoles = pgTable("user_roles", {
  userId: integer("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }), roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }), grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ pk: uniqueIndex("user_roles_pk").on(t.userId, t.roleId) }));
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(), userId: integer("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }), tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), revokedAt: timestamp("revoked_at", { withTimezone: true }), ipAddress: varchar("ip_address", { length: 64 }), userAgent: text("user_agent"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ userIdx: index("user_sessions_user_idx").on(t.userId), expiryIdx: index("user_sessions_expiry_idx").on(t.expiresAt) }));

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), branchId: integer("branch_id").references(() => branches.id), code: varchar("code", { length: 40 }).notNull(), name: varchar("name", { length: 200 }).notNull(), clientName: varchar("client_name", { length: 200 }), contractNumber: varchar("contract_number", { length: 100 }), location: text("location"), managerUserId: integer("manager_user_id").references(() => appUsers.id), startDate: date("start_date"), plannedEndDate: date("planned_end_date"), actualEndDate: date("actual_end_date"), status: projectStatus("status").notNull().default("planning"), budget: money("budget").notNull().default("0"), contractValue: money("contract_value").notNull().default("0"), currency: varchar("currency", { length: 3 }).notNull().default("ETB"), ...auditColumns,
}, (t) => ({ companyCodeUnique: uniqueIndex("projects_company_code_unique").on(t.companyId, t.code), companyStatusIdx: index("projects_company_status_idx").on(t.companyId, t.status) }));
export const projectMembers = pgTable("project_members", {
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), userId: integer("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }), memberRole: varchar("member_role", { length: 80 }), assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ pk: uniqueIndex("project_members_pk").on(t.projectId, t.userId) }));
export const sites = pgTable("project_sites", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), projectId: integer("project_id").notNull().references(() => projects.id), code: varchar("code", { length: 40 }).notNull(), name: varchar("name", { length: 180 }).notNull(), location: text("location"), managerId: integer("manager_id").references(() => appUsers.id), status: recordStatus("status").notNull().default("active"), ...auditColumns,
}, (t) => ({ projectCodeUnique: uniqueIndex("project_sites_project_code_unique").on(t.projectId, t.code), companyIdx: index("project_sites_company_idx").on(t.companyId) }));
export const siteSections = pgTable("site_sections", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }), parentId: integer("parent_id"), code: varchar("code", { length: 40 }).notNull(), name: varchar("name", { length: 160 }).notNull(), ...auditColumns,
}, (t) => ({ siteCodeUnique: uniqueIndex("site_sections_site_code_unique").on(t.siteId, t.code), parentFk: foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }) }));

export const workers = pgTable("workforce", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), workerCode: varchar("worker_code", { length: 40 }).notNull(), fullName: varchar("full_name", { length: 180 }).notNull(), phone: varchar("phone", { length: 40 }), employmentType: employmentType("employment_type").notNull().default("employee"), departmentId: integer("department_id").references(() => departments.id), positionId: integer("position_id").references(() => positions.id), supervisorId: integer("supervisor_id"), hireDate: date("hire_date"), dailyRate: money("daily_rate"), status: recordStatus("status").notNull().default("active"), ...auditColumns,
}, (t) => ({ companyWorkerUnique: uniqueIndex("workforce_company_code_unique").on(t.companyId, t.workerCode), supervisorFk: foreignKey({ columns: [t.supervisorId], foreignColumns: [t.id] }), companyStatusIdx: index("workforce_company_status_idx").on(t.companyId, t.status) }));
export const workerAssignments = pgTable("worker_assignments", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), workerId: integer("worker_id").notNull().references(() => workers.id), projectId: integer("project_id").notNull().references(() => projects.id), siteId: integer("site_id").references(() => sites.id), sectionId: integer("section_id").references(() => siteSections.id), startsOn: date("starts_on").notNull(), endsOn: date("ends_on"), assignedBy: integer("assigned_by").references(() => appUsers.id), ...auditColumns,
}, (t) => ({ workerDatesIdx: index("worker_assignments_worker_dates_idx").on(t.workerId, t.startsOn, t.endsOn), projectIdx: index("worker_assignments_project_idx").on(t.projectId) }));
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), name: varchar("name", { length: 100 }).notNull(), startsAt: time("starts_at").notNull(), endsAt: time("ends_at").notNull(), breakMinutes: integer("break_minutes").notNull().default(0), ...auditColumns,
});
export const attendanceRecords = pgTable("workforce_attendance", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), workerId: integer("worker_id").notNull().references(() => workers.id), projectId: integer("project_id").references(() => projects.id), siteId: integer("site_id").references(() => sites.id), shiftId: integer("shift_id").references(() => shifts.id), attendanceDate: date("attendance_date").notNull(), checkIn: timestamp("check_in", { withTimezone: true }), checkOut: timestamp("check_out", { withTimezone: true }), state: attendanceState("state").notNull(), overtimeMinutes: integer("overtime_minutes").notNull().default(0), notes: text("notes"), recordedBy: integer("recorded_by").references(() => appUsers.id), ...auditColumns,
}, (t) => ({ workerDateUnique: uniqueIndex("workforce_attendance_worker_date_unique").on(t.workerId, t.attendanceDate), companyDateIdx: index("workforce_attendance_company_date_idx").on(t.companyId, t.attendanceDate), siteDateIdx: index("workforce_attendance_site_date_idx").on(t.siteId, t.attendanceDate) }));
export const dayLaborWages = pgTable("day_labor_wages", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), workerId: integer("worker_id").notNull().references(() => workers.id), periodStart: date("period_start").notNull(), periodEnd: date("period_end").notNull(), workingDays: qty("working_days").notNull(), dailyRate: money("daily_rate").notNull(), approvedOvertime: money("approved_overtime").notNull().default("0"), approvedDeductions: money("approved_deductions").notNull().default("0"), total: money("total").notNull(), status: requestState("status").notNull().default("draft"), approvedBy: integer("approved_by").references(() => appUsers.id), ...auditColumns,
});

export const workPackages = pgTable("work_packages", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), projectId: integer("project_id").notNull().references(() => projects.id), parentId: integer("parent_id"), code: varchar("code", { length: 50 }).notNull(), name: varchar("name", { length: 200 }).notNull(), plannedQuantity: qty("planned_quantity").notNull().default("0"), unit: varchar("unit", { length: 30 }).notNull(), plannedStart: date("planned_start"), plannedEnd: date("planned_end"), ...auditColumns,
}, (t) => ({ projectCodeUnique: uniqueIndex("work_packages_project_code_unique").on(t.projectId, t.code), projectIdx: index("work_packages_project_idx").on(t.projectId), parentFk: foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }) }));
export const progressRecords = pgTable("progress_records", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), workPackageId: integer("work_package_id").notNull().references(() => workPackages.id), siteId: integer("site_id").references(() => sites.id), recordedOn: date("recorded_on").notNull(), quantityCompleted: qty("quantity_completed").notNull(), notes: text("notes"), recordedBy: integer("recorded_by").references(() => appUsers.id), ...auditColumns,
}, (t) => ({ packageDateIdx: index("progress_package_date_idx").on(t.workPackageId, t.recordedOn), companyDateIdx: index("progress_company_date_idx").on(t.companyId, t.recordedOn) }));

export const materialCategories = pgTable("material_categories", { id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), name: varchar("name", { length: 120 }).notNull(), ...auditColumns });
export const materials = pgTable("materials", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), categoryId: integer("category_id").references(() => materialCategories.id), sku: varchar("sku", { length: 60 }).notNull(), name: varchar("name", { length: 180 }).notNull(), unit: varchar("unit", { length: 30 }).notNull(), minimumStock: qty("minimum_stock").notNull().default("0"), ...auditColumns,
}, (t) => ({ companySkuUnique: uniqueIndex("materials_company_sku_unique").on(t.companyId, t.sku), companyNameIdx: index("materials_company_name_idx").on(t.companyId, t.name) }));
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), name: varchar("name", { length: 180 }).notNull(), contactName: varchar("contact_name", { length: 150 }), email: varchar("email", { length: 254 }), phone: varchar("phone", { length: 40 }), address: text("address"), ...auditColumns,
});
export const purchaseRequests = pgTable("purchase_requests", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), projectId: integer("project_id").references(() => projects.id), requestedBy: integer("requested_by").notNull().references(() => appUsers.id), requestNumber: varchar("request_number", { length: 50 }).notNull(), status: requestState("status").notNull().default("draft"), requiredBy: date("required_by"), justification: text("justification"), approvedBy: integer("approved_by").references(() => appUsers.id), ...auditColumns,
}, (t) => ({ numberUnique: uniqueIndex("purchase_requests_company_number_unique").on(t.companyId, t.requestNumber) }));
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), requestId: integer("request_id").references(() => purchaseRequests.id), supplierId: integer("supplier_id").notNull().references(() => suppliers.id), projectId: integer("project_id").references(() => projects.id), orderNumber: varchar("order_number", { length: 50 }).notNull(), status: requestState("status").notNull().default("draft"), total: money("total").notNull().default("0"), currency: varchar("currency", { length: 3 }).notNull().default("ETB"), orderedAt: date("ordered_at"), ...auditColumns,
}, (t) => ({ numberUnique: uniqueIndex("purchase_orders_company_number_unique").on(t.companyId, t.orderNumber) }));
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), materialId: integer("material_id").notNull().references(() => materials.id), siteId: integer("site_id").references(() => sites.id), movement: inventoryMovementType("movement").notNull(), quantity: qty("quantity").notNull(), unitCost: money("unit_cost"), referenceType: varchar("reference_type", { length: 40 }), referenceId: integer("reference_id"), occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(), createdBy: integer("created_by").references(() => appUsers.id), notes: text("notes"),
}, (t) => ({ materialDateIdx: index("inventory_material_date_idx").on(t.materialId, t.occurredAt), companyDateIdx: index("inventory_company_date_idx").on(t.companyId, t.occurredAt), siteIdx: index("inventory_site_idx").on(t.siteId) }));

export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), equipmentNumber: varchar("equipment_number", { length: 50 }).notNull(), name: varchar("name", { length: 160 }).notNull(), equipmentType: varchar("equipment_type", { length: 100 }), status: recordStatus("status").notNull().default("active"), ...auditColumns,
}, (t) => ({ companyNumberUnique: uniqueIndex("equipment_company_number_unique").on(t.companyId, t.equipmentNumber) }));
export const equipmentUsage = pgTable("equipment_usage", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), equipmentId: integer("equipment_id").notNull().references(() => equipment.id), projectId: integer("project_id").references(() => projects.id), siteId: integer("site_id").references(() => sites.id), operatorId: integer("operator_id").references(() => workers.id), usageDate: date("usage_date").notNull(), workingHours: numeric("working_hours", { precision: 7, scale: 2 }).notNull().default("0"), fuelLiters: numeric("fuel_liters", { precision: 10, scale: 2 }).notNull().default("0"), notes: text("notes"), ...auditColumns,
}, (t) => ({ equipmentDateIdx: index("equipment_usage_date_idx").on(t.equipmentId, t.usageDate) }));
export const equipmentMaintenance = pgTable("equipment_maintenance", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), equipmentId: integer("equipment_id").notNull().references(() => equipment.id), maintenanceType: varchar("maintenance_type", { length: 80 }).notNull(), description: text("description"), performedAt: date("performed_at").notNull(), cost: money("cost"), nextDueAt: date("next_due_at"), ...auditColumns,
});

export const contractors = pgTable("contractors", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), name: varchar("name", { length: 180 }).notNull(), registrationNumber: varchar("registration_number", { length: 100 }), contactName: varchar("contact_name", { length: 150 }), phone: varchar("phone", { length: 40 }), email: varchar("email", { length: 254 }), ...auditColumns,
});
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), contractorId: integer("contractor_id").notNull().references(() => contractors.id), projectId: integer("project_id").notNull().references(() => projects.id), workPackageId: integer("work_package_id").references(() => workPackages.id), contractNumber: varchar("contract_number", { length: 80 }).notNull(), contractValue: money("contract_value").notNull(), retentionPercent: numeric("retention_percent", { precision: 5, scale: 2 }).notNull().default("0"), startDate: date("start_date"), endDate: date("end_date"), status: requestState("status").notNull().default("draft"), ...auditColumns,
}, (t) => ({ numberUnique: uniqueIndex("contracts_company_number_unique").on(t.companyId, t.contractNumber) }));
export const contractorPayments = pgTable("contractor_payments", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), contractId: integer("contract_id").notNull().references(() => contracts.id), amount: money("amount").notNull(), retention: money("retention").notNull().default("0"), status: requestState("status").notNull().default("draft"), paymentDate: date("payment_date"), ...auditColumns,
});

export const budgets = pgTable("project_budgets", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), projectId: integer("project_id").notNull().references(() => projects.id), costCode: varchar("cost_code", { length: 60 }).notNull(), description: varchar("description", { length: 180 }).notNull(), plannedAmount: money("planned_amount").notNull(), currency: varchar("currency", { length: 3 }).notNull().default("ETB"), version: integer("version").notNull().default(1), status: requestState("status").notNull().default("draft"), ...auditColumns,
}, (t) => ({ projectCodeIdx: index("project_budgets_project_code_idx").on(t.projectId, t.costCode) }));
export const projectCosts = pgTable("project_costs", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), projectId: integer("project_id").notNull().references(() => projects.id), budgetId: integer("budget_id").references(() => budgets.id), category: varchar("category", { length: 60 }).notNull(), description: text("description"), amount: money("amount").notNull(), currency: varchar("currency", { length: 3 }).notNull().default("ETB"), incurredOn: date("incurred_on").notNull(), reference: varchar("reference", { length: 100 }), recordedBy: integer("recorded_by").references(() => appUsers.id), ...auditColumns,
}, (t) => ({ projectDateIdx: index("project_costs_project_date_idx").on(t.projectId, t.incurredOn) }));
export const paymentRequests = pgTable("payment_requests", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), projectId: integer("project_id").references(() => projects.id), requestedBy: integer("requested_by").notNull().references(() => appUsers.id), amount: money("amount").notNull(), currency: varchar("currency", { length: 3 }).notNull().default("ETB"), purpose: text("purpose").notNull(), status: requestState("status").notNull().default("draft"), approvedBy: integer("approved_by").references(() => appUsers.id), ...auditColumns,
});

export const safetyIncidents = pgTable("safety_incidents", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), projectId: integer("project_id").references(() => projects.id), siteId: integer("site_id").references(() => sites.id), incidentNumber: varchar("incident_number", { length: 50 }).notNull(), incidentType: varchar("incident_type", { length: 80 }).notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), severity: varchar("severity", { length: 30 }).notNull(), description: text("description").notNull(), status: requestState("status").notNull().default("submitted"), reportedBy: integer("reported_by").references(() => appUsers.id), ...auditColumns,
}, (t) => ({ numberUnique: uniqueIndex("safety_incidents_company_number_unique").on(t.companyId, t.incidentNumber), companyTimeIdx: index("safety_incidents_company_time_idx").on(t.companyId, t.occurredAt) }));
export const qualityInspections = pgTable("quality_inspections", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), projectId: integer("project_id").notNull().references(() => projects.id), siteId: integer("site_id").references(() => sites.id), workPackageId: integer("work_package_id").references(() => workPackages.id), inspectionDate: date("inspection_date").notNull(), checklist: jsonb("checklist").notNull().default([]), result: varchar("result", { length: 30 }).notNull(), inspectorId: integer("inspector_id").references(() => appUsers.id), notes: text("notes"), ...auditColumns,
}, (t) => ({ projectDateIdx: index("quality_inspections_project_date_idx").on(t.projectId, t.inspectionDate) }));
export const qualityDefects = pgTable("quality_defects", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), inspectionId: integer("inspection_id").references(() => qualityInspections.id), projectId: integer("project_id").notNull().references(() => projects.id), title: varchar("title", { length: 180 }).notNull(), description: text("description"), severity: varchar("severity", { length: 30 }), status: requestState("status").notNull().default("submitted"), dueDate: date("due_date"), ...auditColumns,
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), projectId: integer("project_id").references(() => projects.id), workerId: integer("worker_id").references(() => workers.id), category: varchar("category", { length: 80 }).notNull(), title: varchar("title", { length: 200 }).notNull(), storageKey: text("storage_key").notNull(), mimeType: varchar("mime_type", { length: 120 }).notNull(), sizeBytes: integer("size_bytes").notNull(), version: integer("version").notNull().default(1), uploadedBy: integer("uploaded_by").references(() => appUsers.id), ...auditColumns,
}, (t) => ({ projectIdx: index("documents_project_idx").on(t.projectId), companyCategoryIdx: index("documents_company_category_idx").on(t.companyId, t.category) }));
export const workflowTasks = pgTable("workflow_tasks", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), projectId: integer("project_id").references(() => projects.id), title: varchar("title", { length: 200 }).notNull(), description: text("description"), assignedTo: integer("assigned_to").references(() => appUsers.id), createdBy: integer("created_by").references(() => appUsers.id), priority: varchar("priority", { length: 20 }).notNull().default("normal"), status: varchar("status", { length: 30 }).notNull().default("open"), dueAt: timestamp("due_at", { withTimezone: true }), ...auditColumns,
}, (t) => ({ companyStatusIdx: index("workflow_tasks_company_status_idx").on(t.companyId, t.status), assigneeIdx: index("workflow_tasks_assignee_idx").on(t.assignedTo) }));
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), userId: integer("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }), type: varchar("type", { length: 60 }).notNull(), title: varchar("title", { length: 180 }).notNull(), body: text("body"), readAt: timestamp("read_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ inboxIdx: index("notifications_inbox_idx").on(t.userId, t.readAt, t.createdAt) }));
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id), actorUserId: integer("actor_user_id").references(() => appUsers.id), action: varchar("action", { length: 100 }).notNull(), entityType: varchar("entity_type", { length: 100 }).notNull(), entityId: varchar("entity_id", { length: 80 }), oldValue: jsonb("old_value"), newValue: jsonb("new_value"), ipAddress: varchar("ip_address", { length: 64 }), sessionId: integer("session_id").references(() => userSessions.id), requestId: varchar("request_id", { length: 100 }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ entityIdx: index("audit_logs_entity_idx").on(t.companyId, t.entityType, t.entityId), actorTimeIdx: index("audit_logs_actor_time_idx").on(t.actorUserId, t.createdAt) }));

export const enterpriseSchema = {
  companies, branches, departments, positions, roles, permissions, rolePermissions, appUsers, userRoles, userSessions,
  projects, projectMembers, sites, siteSections, workers, workerAssignments, shifts, attendanceRecords, dayLaborWages,
  workPackages, progressRecords, materialCategories, materials, suppliers, purchaseRequests, purchaseOrders, inventoryTransactions,
  equipment, equipmentUsage, equipmentMaintenance, contractors, contracts, contractorPayments, budgets, projectCosts, paymentRequests,
  safetyIncidents, qualityInspections, qualityDefects, documents, workflowTasks, notifications, auditLogs,
};
