import { integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workers = pgTable("workers", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  phone: text("phone").notNull().default(""),
  projectId: integer("project_id").references(() => projects.id),
  color: text("color").notNull().default("orange"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  workerId: integer("worker_id").notNull().references(() => workers.id),
  projectId: integer("project_id").references(() => projects.id),
  date: text("date").notNull(),
  status: text("status").notNull().default("present"),
  checkIn: text("check_in"),
  checkOut: text("check_out"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("attendance_worker_date_idx").on(table.workerId, table.date)]);
