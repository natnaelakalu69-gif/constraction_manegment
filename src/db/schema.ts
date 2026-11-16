import {
  pgTable, serial, varchar, timestamp, date, time, integer,
  pgEnum, uniqueIndex
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["ADMIN", "SUPERVISOR"]);
export const workerStatus = pgEnum("worker_status", ["ACTIVE", "INACTIVE"]);
export const siteStatus = pgEnum("site_status", ["ACTIVE", "COMPLETED", "SUSPENDED"]);
export const attendanceStatus = pgEnum("attendance_status", ["PRESENT", "ABSENT", "LATE", "LEAVE"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRole("role").notNull().default("SUPERVISOR"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workers = pgTable("workers", {
  id: serial("id").primaryKey(),
  workerCode: varchar("worker_code", { length: 30 }).notNull().unique(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  position: varchar("position", { length: 80 }).notNull(),
  department: varchar("department", { length: 80 }),
  hireDate: date("hire_date"),
  status: workerStatus("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sites = pgTable("construction_sites", {
  id: serial("id").primaryKey(),
  siteCode: varchar("site_code", { length: 30 }).notNull().unique(),
  siteName: varchar("site_name", { length: 150 }).notNull(),
  location: varchar("location", { length: 200 }).notNull(),
  managerName: varchar("manager_name", { length: 120 }),
  status: siteStatus("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  workerId: integer("worker_id").notNull().references(() => workers.id, { onDelete: "cascade" }),
  siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  attendanceDate: date("attendance_date").notNull(),
  checkIn: time("check_in"),
  checkOut: time("check_out"),
  status: attendanceStatus("status").notNull(),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  workerDateUnique: uniqueIndex("attendance_worker_date_unique")
    .on(t.workerId, t.attendanceDate),
}));

export type Worker = typeof workers.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;