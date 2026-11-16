import { db } from "@/db";
import { attendance, projects, workers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const seedProjects = [
  { name: "Riverside Tower", location: "Downtown, Austin", status: "Active" },
  { name: "Harbor Point Residences", location: "East Austin, TX", status: "Active" },
  { name: "Northline Commercial", location: "North Austin, TX", status: "Active" },
  { name: "Westfield Renovation", location: "West Lake Hills, TX", status: "Planning" },
];

const seedWorkers = [
  { name: "Marcus Johnson", role: "Site Supervisor", phone: "+1 (512) 555-0101", project: 0, color: "orange" },
  { name: "David Chen", role: "Electrician", phone: "+1 (512) 555-0102", project: 0, color: "blue" },
  { name: "Carlos Rodriguez", role: "Carpenter", phone: "+1 (512) 555-0103", project: 0, color: "purple" },
  { name: "James Wilson", role: "Heavy Equipment Op.", phone: "+1 (512) 555-0104", project: 1, color: "green" },
  { name: "Amir Patel", role: "Plumber", phone: "+1 (512) 555-0105", project: 1, color: "amber" },
  { name: "Robert Davis", role: "Concrete Finisher", phone: "+1 (512) 555-0106", project: 1, color: "rose" },
  { name: "Miguel Hernandez", role: "Steel Worker", phone: "+1 (512) 555-0107", project: 2, color: "teal" },
  { name: "Daniel Thompson", role: "Electrician", phone: "+1 (512) 555-0108", project: 2, color: "blue" },
  { name: "Samuel Brooks", role: "General Laborer", phone: "+1 (512) 555-0109", project: 2, color: "purple" },
  { name: "Omar Hassan", role: "Safety Officer", phone: "+1 (512) 555-0110", project: 0, color: "green" },
  { name: "Ethan Miller", role: "Carpenter", phone: "+1 (512) 555-0111", project: 1, color: "orange" },
  { name: "Noah Williams", role: "General Laborer", phone: "+1 (512) 555-0112", project: 2, color: "rose" },
];

async function ensureSeeded() {
  const existing = await db.select({ id: projects.id }).from(projects).limit(1);
  if (existing.length) return;
  const addedProjects = await db.insert(projects).values(seedProjects).returning();
  const addedWorkers = await db.insert(workers).values(seedWorkers.map((worker, index) => ({
    employeeId: `WRK-${String(1001 + index)}`,
    name: worker.name,
    role: worker.role,
    phone: worker.phone,
    projectId: addedProjects[worker.project].id,
    color: worker.color,
  }))).returning();
  const today = new Date();
  const rows = [];
  for (let day = 6; day >= 0; day--) {
    const current = new Date(today);
    current.setUTCDate(current.getUTCDate() - day);
    const date = current.toISOString().slice(0, 10);
    for (let index = 0; index < addedWorkers.length; index++) {
      const worker = addedWorkers[index];
      const status = day === 0
        ? (index === 5 || index === 11 ? "absent" : index === 4 ? "late" : "present")
        : ((index + day * 3) % 13 === 0 ? "absent" : (index + day) % 11 === 0 ? "late" : "present");
      rows.push({
        workerId: worker.id,
        projectId: worker.projectId,
        date,
        status,
        checkIn: status === "absent" ? null : status === "late" ? "09:24" : `07:${String(42 + (index * 3) % 17).padStart(2, "0")}`,
        checkOut: day === 0 || status === "absent" ? null : `17:${String(2 + (index * 4) % 31).padStart(2, "0")}`,
      });
    }
  }
  await db.insert(attendance).values(rows);
}

export async function GET() {
  try {
    await ensureSeeded();
    const [allProjects, allWorkers, allAttendance] = await Promise.all([
      db.select().from(projects).orderBy(projects.id),
      db.select().from(workers).orderBy(workers.id),
      db.select().from(attendance).orderBy(attendance.id),
    ]);
    return Response.json({ projects: allProjects, workers: allWorkers, attendance: allAttendance });
  } catch (error) {
    console.error("Dashboard load failed", error);
    return Response.json({ error: "Could not load dashboard data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "worker") {
      const name = String(body.name ?? "").trim();
      const role = String(body.role ?? "").trim();
      if (!name || !role) return Response.json({ error: "Name and trade are required." }, { status: 400 });
      const projectId = Number(body.projectId);
      const employeeId = `WRK-${Date.now().toString().slice(-7)}`;
      const [created] = await db.insert(workers).values({
        employeeId, name, role, phone: String(body.phone ?? "").trim(),
        projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : null,
        color: ["orange", "blue", "purple", "green", "amber", "teal"][Math.floor(Math.random() * 6)],
      }).returning();
      return Response.json({ worker: created });
    }
    if (body.action === "project") {
      const name = String(body.name ?? "").trim();
      const location = String(body.location ?? "").trim();
      if (!name || !location) return Response.json({ error: "Project name and location are required." }, { status: 400 });
      const [created] = await db.insert(projects).values({ name, location, status: "Active" }).returning();
      return Response.json({ project: created });
    }
    if (body.action === "attendance") {
      const workerId = Number(body.workerId);
      const date = String(body.date ?? "");
      const status = String(body.status ?? "");
      if (!Number.isInteger(workerId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !["present", "late", "absent", "on_leave"].includes(status)) {
        return Response.json({ error: "Invalid attendance details." }, { status: 400 });
      }
      const [worker] = await db.select().from(workers).where(eq(workers.id, workerId)).limit(1);
      if (!worker) return Response.json({ error: "Worker not found." }, { status: 404 });
      const [record] = await db.select().from(attendance).where(and(eq(attendance.workerId, workerId), eq(attendance.date, date))).limit(1);
      const checkIn = status === "absent" || status === "on_leave" ? null : body.checkIn === null ? null : String(body.checkIn || (record?.checkIn ?? new Date().toTimeString().slice(0, 5)));
      const checkOut = status === "absent" || status === "on_leave" ? null : body.checkOut === null ? null : String(body.checkOut || record?.checkOut || "") || null;
      const values = { workerId, projectId: worker.projectId, date, status, checkIn, checkOut };
      const [saved] = await db.insert(attendance).values(values).onConflictDoUpdate({
        target: [attendance.workerId, attendance.date],
        set: { status, checkIn, checkOut, projectId: worker.projectId },
      }).returning();
      return Response.json({ attendance: saved });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Dashboard update failed", error);
    return Response.json({ error: "Could not save changes." }, { status: 500 });
  }
}
