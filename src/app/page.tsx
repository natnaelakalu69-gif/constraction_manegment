"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Clock3, Construction, Download, HardHat, HelpCircle, LayoutDashboard, MapPin, Menu, MoreHorizontal, Plus, Search, ShieldCheck, SlidersHorizontal, TrendingUp, UserRoundCheck, UserRoundX, Users, X } from "lucide-react";

type Project = { id: number; name: string; location: string; status: string; createdAt: string };
type Worker = { id: number; employeeId: string; name: string; role: string; phone: string; projectId: number | null; color: string; createdAt: string };
type Attendance = { id: number; workerId: number; projectId: number | null; date: string; status: string; checkIn: string | null; checkOut: string | null; notes: string };
type Data = { projects: Project[]; workers: Worker[]; attendance: Attendance[] };
type Tab = "Dashboard" | "Attendance" | "Workforce" | "Projects" | "Reports";
type Modal = "worker" | "project" | "attendance" | null;

const tabs = [
  { label: "Dashboard" as Tab, icon: LayoutDashboard },
  { label: "Attendance" as Tab, icon: ClipboardCheck },
  { label: "Workforce" as Tab, icon: Users },
  { label: "Projects" as Tab, icon: BriefcaseBusiness },
  { label: "Reports" as Tab, icon: Activity },
];
const statusLabels: Record<string, string> = { present: "Present", late: "Late arrival", absent: "Absent", on_leave: "On leave", unmarked: "Not marked" };
const blankData: Data = { projects: [], workers: [], attendance: [] };
const today = () => new Date().toISOString().slice(0, 10);
const prettyDate = (date: string, options?: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", options || { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
const timeLabel = (time: string | null) => { if (!time) return "—"; const [h, m] = time.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };

export default function HomePage() {
  const [data, setData] = useState<Data>(blankData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<Modal>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [workerForm, setWorkerForm] = useState({ name: "", role: "", phone: "", projectId: "" });
  const [projectForm, setProjectForm] = useState({ name: "", location: "" });
  const [attendanceForm, setAttendanceForm] = useState({ workerId: "", status: "present", checkIn: "08:00", checkOut: "" });

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("We couldn't load your workspace. Please try again.");
      setData(await response.json()); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(""), 3500); return () => clearTimeout(timer); } }, [toast]);

  const records = useMemo(() => data.attendance.filter((a) => a.date === date), [data.attendance, date]);
  const recordMap = useMemo(() => new Map(records.map((r) => [r.workerId, r])), [records]);
  const count = (status: string) => records.filter((r) => r.status === status).length;
  const present = count("present"); const late = count("late"); const absent = count("absent");
  const onSite = present + late;
  const attendanceRate = data.workers.length ? Math.round(onSite / data.workers.length * 100) : 0;
  const projectName = (id: number | null) => data.projects.find((p) => p.id === id)?.name || "Unassigned";
  const filteredWorkers = data.workers.filter((worker) => {
    const record = recordMap.get(worker.id);
    const matchesSearch = `${worker.name} ${worker.role} ${worker.employeeId} ${projectName(worker.projectId)}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (projectFilter === "all" || worker.projectId === Number(projectFilter)) && (statusFilter === "all" || (record?.status || "unmarked") === statusFilter);
  });
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const dayRecords = data.attendance.filter((a) => a.date === key);
    return { key, label: d.toLocaleDateString("en-US", { weekday: "short" }), present: dayRecords.filter((a) => a.status === "present" || a.status === "late").length, absent: dayRecords.filter((a) => a.status === "absent" || a.status === "on_leave").length };
  });

  async function save(body: Record<string, unknown>, success: string) {
    setSaving(true); setFormError("");
    try {
      const response = await fetch("/api/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save changes.");
      await load(); setModal(null); setToast(success);
      setWorkerForm({ name: "", role: "", phone: "", projectId: "" });
      setProjectForm({ name: "", location: "" });
      setAttendanceForm({ workerId: "", status: "present", checkIn: "08:00", checkOut: "" });
    } catch (err) { setFormError(err instanceof Error ? err.message : "Could not save changes."); }
    finally { setSaving(false); }
  }
  function openAttendance(worker?: Worker) {
    const record = worker ? recordMap.get(worker.id) : undefined;
    setAttendanceForm({ workerId: worker ? String(worker.id) : "", status: record?.status || "present", checkIn: record?.checkIn || "08:00", checkOut: record?.checkOut || "" });
    setFormError(""); setModal("attendance");
  }
  function changeDay(amount: number) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + amount); setDate(d.toISOString().slice(0, 10)); }
  function exportCSV() {
    const dates = tab === "Reports" ? weekly.map((day) => day.key) : [date];
    const rows = [["Date", "Worker ID", "Name", "Trade", "Project", "Status", "Check In", "Check Out"], ...dates.flatMap((day) => data.workers.map((worker) => {
      const record = data.attendance.find((item) => item.workerId === worker.id && item.date === day);
      return [day, worker.employeeId, worker.name, worker.role, projectName(worker.projectId), statusLabels[record?.status || "unmarked"], record?.checkIn || "", record?.checkOut || ""];
    }))];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `siteflow-attendance-${tab === "Reports" ? "weekly-" : ""}${date}.csv`; link.click(); URL.revokeObjectURL(url);
    setToast("Attendance report downloaded");
  }
  function navigate(next: Tab) { setTab(next); setMenuOpen(false); setSearch(""); setProjectFilter("all"); setStatusFilter("all"); }

  const workerRow = (worker: Worker, compact = false) => {
    const record = recordMap.get(worker.id);
    const status = record?.status || "unmarked";
    return <tr key={worker.id}>
      <td><div className="person-cell"><div className={`avatar avatar-${worker.color}`}>{initials(worker.name)}</div><div><strong>{worker.name}</strong><span>{worker.employeeId}</span></div></div></td>
      <td className="muted-cell">{worker.role}</td>
      <td className="muted-cell project-cell">{projectName(worker.projectId)}</td>
      {!compact && <td className="muted-cell">{timeLabel(record?.checkIn || null)}</td>}
      <td><span className={`status status-${status}`}><span className="status-dot" />{statusLabels[status]}</span></td>
      <td className="row-action"><button aria-label={`Edit attendance for ${worker.name}`} title="Edit attendance" className="icon-button small" onClick={() => openAttendance(worker)}><MoreHorizontal size={19} /></button></td>
    </tr>;
  };

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Construction size={23} strokeWidth={2.3} /></div><div className="brand-copy"><strong>siteflow<span>.</span></strong><small>WORKFORCE MANAGEMENT</small></div></div>
      <div className="sidebar-scroll"><div className="nav-label">WORKSPACE</div><nav className="side-nav" aria-label="Main navigation">{tabs.map((item) => <button key={item.label} className={`nav-item ${tab === item.label ? "active" : ""}`} onClick={() => navigate(item.label)}><item.icon size={19} strokeWidth={1.9} /><span>{item.label}</span>{tab === item.label && <span className="active-indicator" />}</button>)}</nav>
        <div className="nav-label management-label">MANAGEMENT</div><button className="nav-item extra-nav" onClick={() => { navigate("Projects"); setToast("Manage your active project sites here"); }}><MapPin size={19} strokeWidth={1.9} /><span>Site locations</span></button><button className="nav-item extra-nav" onClick={() => setToast("Your workspace is up to date") }><ShieldCheck size={19} strokeWidth={1.9} /><span>Safety center</span></button>
      </div>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><HelpCircle size={20} /></div><strong>Need a hand?</strong><p>Keep your crew on track, every day.</p><button onClick={() => setToast("Support is available at support@siteflow.app")}>Contact support <ArrowUpRight size={14} /></button></div><div className="sidebar-user"><div className="admin-avatar">AC</div><div><strong>Alex Carter</strong><span>Site Administrator</span></div><MoreHorizontal size={18} /></div></div>
    </aside>
    {menuOpen && <button className="mobile-overlay" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
    <div className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={22} /></button><span className="breadcrumb-muted">Workspace</span><ChevronRight size={15} className="breadcrumb-arrow" /><span className="breadcrumb-current">{tab}</span></div><div className="topbar-right"><div className="topbar-search"><Search size={17} /><input aria-label="Search workers" placeholder="Search anything..." value={search} onChange={(e) => { setSearch(e.target.value); if (e.target.value && tab !== "Workforce" && tab !== "Attendance") setTab("Workforce"); }} /><kbd>⌘ K</kbd></div><div className="topbar-divider" /><div className="notification-wrap"><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={20} /><span className="notification-dot" /></button>{notificationsOpen && <div className="notification-popover"><strong>Notifications</strong><div className="notification-entry"><span className="notification-icon"><Clock3 size={17} /></span><div><b>Daily attendance is ready</b><p>Review your crew&apos;s check-ins for today.</p></div></div><button onClick={() => { setNotificationsOpen(false); navigate("Attendance"); }}>View attendance <ArrowRight size={14} /></button></div>}</div><div className="topbar-profile"><div className="admin-avatar">AC</div><span>Alex Carter</span><ChevronDown size={15} /></div></div></header>
      <main className="content">
        {error && <div className="error-banner">{error}<button onClick={load}>Try again</button></div>}
        {loading ? <div className="loading-state"><div className="loading-spinner" /><span>Preparing your workspace...</span></div> : <>
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> CONSTRUCTION OPERATIONS</div><h1>{tab === "Dashboard" ? "Workforce overview" : tab}</h1><p>{tab === "Dashboard" ? "Here’s what’s happening across your sites today." : tab === "Attendance" ? "Track check-ins and keep every shift accounted for." : tab === "Workforce" ? "Your people are the foundation of every project." : tab === "Projects" ? "Stay on top of every site and the teams behind it." : "A clearer picture of your workforce, day by day."}</p></div><div className="heading-actions"><div className="date-control"><CalendarDays size={17} /><input type="date" aria-label="Selected date" value={date} onChange={(e) => setDate(e.target.value)} /></div>{tab === "Dashboard" || tab === "Reports" ? <button className="button button-outline" onClick={exportCSV}><ArrowDownToLine size={17} /> Export report</button> : <button className="button button-primary" onClick={() => { setFormError(""); if (tab === "Projects") setModal("project"); else if (tab === "Workforce") setModal("worker"); else openAttendance(); }}><Plus size={18} /> {tab === "Projects" ? "Add project" : tab === "Workforce" ? "Add worker" : "Mark attendance"}</button>}</div></div>
          {tab === "Dashboard" && <>
            <div className="section-heading"><div><h2>Today at a glance</h2><span>{prettyDate(date)}</span></div><div className="live-badge"><span /> LIVE OVERVIEW</div></div>
            <div className="stats-grid">
              <StatCard label="Total workforce" value={data.workers.length} icon={<Users size={21} />} tone="blue" note="Across all active sites" noteIcon={<ArrowUpRight size={14} />} />
              <StatCard label="Present today" value={onSite} icon={<UserRoundCheck size={21} />} tone="green" note={`${attendanceRate}% attendance rate`} noteIcon={<TrendingUp size={14} />} />
              <StatCard label="Late arrivals" value={late} icon={<Clock3 size={21} />} tone="amber" note="Arrived after shift start" noteIcon={<Clock3 size={14} />} />
              <StatCard label="Absent today" value={absent} icon={<UserRoundX size={21} />} tone="red" note="Not on site today" noteIcon={<ArrowUpRight size={14} />} />
            </div>
            <div className="analytics-grid"><section className="panel chart-panel"><div className="panel-head"><div><h3>Attendance overview</h3><p>Daily workforce attendance over the last 7 days</p></div><span className="panel-tag"><span /> Last 7 days <ChevronDown size={14} /></span></div><div className="chart-content"><div className="chart-y"><span>{data.workers.length}</span><span>{Math.round(data.workers.length * .75)}</span><span>{Math.round(data.workers.length * .5)}</span><span>{Math.round(data.workers.length * .25)}</span><span>0</span></div><div className="chart-main"><div className="chart-plot"><div className="grid-lines"><i /><i /><i /><i /><i /></div><div className="bars">{weekly.map((day) => <div className="bar-column" key={day.key} title={`${day.label}: ${day.present} on site, ${day.absent} absent`}><div className="bar-stack"><div className={`bar-present ${day.key === date ? "bar-current" : ""}`} style={{ height: `${data.workers.length ? (day.present / data.workers.length) * 100 : 0}%` }} /><div className="bar-absent" style={{ height: `${data.workers.length ? (day.absent / data.workers.length) * 100 : 0}%` }} /></div></div>)}</div></div><div className="chart-x">{weekly.map((day) => <span key={day.key} className={day.key === date ? "current-day" : ""}>{day.label}</span>)}</div></div></div><div className="chart-legend"><span><i className="legend-present" />On site</span><span><i className="legend-absent" />Absent</span></div></section>
              <section className="panel overview-panel"><div className="panel-head"><div><h3>Today&apos;s breakdown</h3><p>Where your workforce stands</p></div><button className="icon-button small" aria-label="View attendance" onClick={() => navigate("Attendance")}><MoreHorizontal size={20} /></button></div><div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(#ed873e 0 ${attendanceRate}%, #dcebe6 ${attendanceRate}% ${attendanceRate + (data.workers.length ? absent / data.workers.length * 100 : 0)}%, #e9edf1 0)` }}><div className="donut-inner"><strong>{attendanceRate}%</strong><span>attendance rate</span></div></div></div><div className="breakdown-list"><div><span><i className="breakdown-dot orange" />Present on site</span><strong>{onSite}</strong></div><div><span><i className="breakdown-dot sage" />Absent</span><strong>{absent}</strong></div><div><span><i className="breakdown-dot gray" />Not marked / leave</span><strong>{Math.max(0, data.workers.length - onSite - absent)}</strong></div></div></section></div>
            <div className="bottom-grid"><section className="panel table-panel"><div className="panel-head table-panel-head"><div><h3>Live attendance</h3><p>Real-time check-ins from your team</p></div><button className="text-link" onClick={() => navigate("Attendance")}>View all <ArrowRight size={16} /></button></div><div className="table-scroll"><table><thead><tr><th>WORKER</th><th>TRADE</th><th>PROJECT SITE</th><th>STATUS</th><th></th></tr></thead><tbody>{data.workers.slice(0, 5).map((worker) => workerRow(worker, true))}</tbody></table></div></section><section className="panel sites-panel"><div className="panel-head"><div><h3>Active sites</h3><p>Your projects at a glance</p></div><button className="text-link" onClick={() => navigate("Projects")}>View all <ArrowRight size={16} /></button></div><div className="site-list">{data.projects.filter((p) => p.status === "Active").slice(0, 3).map((project, index) => <button key={project.id} className="site-item" onClick={() => { setProjectFilter(String(project.id)); setTab("Workforce"); }}><div className={`site-icon site-icon-${index}`}><HardHat size={19} /></div><div><strong>{project.name}</strong><span><MapPin size={12} /> {project.location}</span></div><span className="site-count">{data.workers.filter((w) => w.projectId === project.id).length} crew <ChevronRight size={15} /></span></button>)}</div></section></div>
          </>}
          {tab === "Attendance" && <><div className="stats-grid compact-stats"><StatCard label="On site" value={onSite} icon={<UserRoundCheck size={21} />} tone="green" note="Checked in today" /><StatCard label="On time" value={present} icon={<CheckCircle2 size={21} />} tone="blue" note="Arrived on schedule" /><StatCard label="Late arrivals" value={late} icon={<Clock3 size={21} />} tone="amber" note="After shift start" /><StatCard label="Absent" value={absent} icon={<UserRoundX size={21} />} tone="red" note="Not on site" /></div><section className="panel directory-panel"><div className="directory-head"><div><h3>Daily attendance</h3><p>{prettyDate(date)} · {data.workers.length} workers</p></div><div className="day-controls"><button className="icon-button small" aria-label="Previous day" onClick={() => changeDay(-1)}><ArrowLeft size={17} /></button><button className="today-button" onClick={() => setDate(today())}>Today</button><button className="icon-button small" aria-label="Next day" onClick={() => changeDay(1)}><ArrowRight size={17} /></button></div></div><Filters search={search} setSearch={setSearch} projectFilter={projectFilter} setProjectFilter={setProjectFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} projects={data.projects} showStatus /><div className="table-scroll"><table><thead><tr><th>WORKER</th><th>TRADE</th><th>PROJECT SITE</th><th>CHECK IN</th><th>STATUS</th><th></th></tr></thead><tbody>{filteredWorkers.map((worker) => workerRow(worker))}</tbody></table></div>{filteredWorkers.length === 0 && <EmptyState text="No workers match your filters." />}</section></>}
          {tab === "Workforce" && <><div className="workforce-banner"><div className="banner-icon"><Users size={25} /></div><div><span>YOUR PEOPLE, YOUR PRIORITY</span><h2>Every great build starts with a great team.</h2><p>Keep your workforce organized and ready for what&apos;s next.</p></div><div className="banner-decoration"><HardHat size={126} strokeWidth={.8} /></div></div><section className="panel directory-panel"><div className="directory-head"><div><h3>Worker directory <span className="count-pill">{data.workers.length}</span></h3><p>Manage your crew across all project sites</p></div><button className="button button-primary" onClick={() => { setFormError(""); setModal("worker"); }}><Plus size={18} /> Add worker</button></div><Filters search={search} setSearch={setSearch} projectFilter={projectFilter} setProjectFilter={setProjectFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} projects={data.projects} /><div className="table-scroll"><table><thead><tr><th>WORKER</th><th>TRADE</th><th>ASSIGNED PROJECT</th><th>CHECK IN</th><th>TODAY&apos;S STATUS</th><th></th></tr></thead><tbody>{filteredWorkers.map((worker) => workerRow(worker))}</tbody></table></div>{filteredWorkers.length === 0 && <EmptyState text="No workers found. Try a different search or add a worker." />}</section></>}
          {tab === "Projects" && <><div className="project-intro"><div><span className="intro-icon"><BriefcaseBusiness size={21} /></span><h2>Project sites</h2><p>Manage active sites and see where your workforce is assigned.</p></div><span className="intro-count">{data.projects.length} total projects</span></div><div className="project-grid">{data.projects.map((project, index) => { const crew = data.workers.filter((w) => w.projectId === project.id); const checked = crew.filter((w) => { const s = recordMap.get(w.id)?.status; return s === "present" || s === "late"; }).length; return <div className="project-card" key={project.id}><div className="project-card-top"><div className={`project-symbol site-icon-${index % 3}`}><Construction size={22} /></div><span className={`project-status ${project.status === "Active" ? "" : "planning"}`}><span />{project.status}</span></div><h3>{project.name}</h3><p className="project-location"><MapPin size={15} />{project.location}</p><div className="project-rule" /><div className="project-meta"><div><span>Assigned crew</span><strong>{crew.length.toString().padStart(2, "0")}</strong></div><div><span>On site today</span><strong>{checked.toString().padStart(2, "0")}</strong></div></div><button className="project-action" onClick={() => { setProjectFilter(String(project.id)); setTab("Workforce"); }}>View workforce <ArrowRight size={16} /></button></div>; })}<button className="add-project-card" onClick={() => { setFormError(""); setModal("project"); }}><span><Plus size={24} /></span><strong>Add a new project</strong><small>Bring another site into your workspace</small></button></div></>}
          {tab === "Reports" && <><div className="stats-grid compact-stats"><StatCard label="Total workforce" value={data.workers.length} icon={<Users size={21} />} tone="blue" note="Registered workers" /><StatCard label="Attendance rate" value={`${attendanceRate}%`} icon={<TrendingUp size={21} />} tone="green" note="For selected day" /><StatCard label="Days tracked" value={new Set(data.attendance.map((r) => r.date)).size} icon={<CalendarDays size={21} />} tone="amber" note="Attendance records" /><StatCard label="Active sites" value={data.projects.filter((p) => p.status === "Active").length} icon={<HardHat size={21} />} tone="red" note="Projects in progress" /></div><section className="panel reports-panel"><div className="panel-head"><div><h3>Weekly attendance report</h3><p>Daily breakdown for the seven days ending {prettyDate(date, { month: "short", day: "numeric", year: "numeric" })}</p></div><button className="button button-outline" onClick={exportCSV}><Download size={16} /> Download CSV</button></div><div className="report-table-wrap"><table className="report-table"><thead><tr><th>DATE</th><th>ON SITE</th><th>ABSENT</th><th>ATTENDANCE RATE</th></tr></thead><tbody>{[...weekly].reverse().map((day) => <tr key={day.key}><td><strong>{prettyDate(day.key, { weekday: "long", month: "short", day: "numeric" })}</strong></td><td><span className="report-count green-count">{day.present} workers</span></td><td><span className="report-count red-count">{day.absent} workers</span></td><td><div className="rate-cell"><span className="rate-track"><span style={{ width: `${data.workers.length ? day.present / data.workers.length * 100 : 0}%` }} /></span><strong>{data.workers.length ? Math.round(day.present / data.workers.length * 100) : 0}%</strong></div></td></tr>)}</tbody></table></div></section></>}
        </>}
        <footer className="footer"><span>© {new Date().getFullYear()} siteflow. Built for the people who build.</span><span>Made for better workdays <span className="footer-spark">✦</span></span></footer>
      </main></div>
      {toast && <div className="toast"><Check size={16} />{toast}<button aria-label="Dismiss" onClick={() => setToast("")}><X size={15} /></button></div>}
      {modal && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div className="modal-heading-icon">{modal === "worker" ? <Users size={21} /> : modal === "project" ? <BriefcaseBusiness size={21} /> : <ClipboardCheck size={21} />}</div><button className="icon-button small" aria-label="Close dialog" onClick={() => setModal(null)}><X size={20} /></button></div><h2 id="modal-title">{modal === "worker" ? "Add a worker" : modal === "project" ? "Add a project" : "Mark attendance"}</h2><p className="modal-subtitle">{modal === "worker" ? "Add a new member to your workforce." : modal === "project" ? "Set up a new construction site." : `Update a crew member's attendance for ${prettyDate(date, { month: "long", day: "numeric" })}.`}</p>
        {modal === "worker" && <form onSubmit={(e) => { e.preventDefault(); save({ action: "worker", ...workerForm }, "Worker added successfully"); }}><label>Full name <input required placeholder="e.g. Jordan Smith" value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} /></label><label>Trade / role <input required placeholder="e.g. Electrician" value={workerForm.role} onChange={(e) => setWorkerForm({ ...workerForm, role: e.target.value })} /></label><label>Phone number <input type="tel" placeholder="e.g. +1 (512) 555-0100" value={workerForm.phone} onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })} /></label><label>Project site <select value={workerForm.projectId} onChange={(e) => setWorkerForm({ ...workerForm, projectId: e.target.value })}><option value="">Unassigned</option>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{formError && <p className="form-error">{formError}</p>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving..." : "Add worker"}</button></div></form>}
        {modal === "project" && <form onSubmit={(e) => { e.preventDefault(); save({ action: "project", ...projectForm }, "Project created successfully"); }}><label>Project name <input required placeholder="e.g. Central Plaza" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} /></label><label>Location <input required placeholder="e.g. Austin, TX" value={projectForm.location} onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })} /></label>{formError && <p className="form-error">{formError}</p>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving..." : "Create project"}</button></div></form>}
        {modal === "attendance" && <form onSubmit={(e) => { e.preventDefault(); save({ action: "attendance", workerId: Number(attendanceForm.workerId), date, status: attendanceForm.status, checkIn: attendanceForm.status === "absent" || attendanceForm.status === "on_leave" ? null : attendanceForm.checkIn, checkOut: attendanceForm.checkOut || null }, "Attendance updated successfully"); }}><label>Worker <select required value={attendanceForm.workerId} onChange={(e) => { const r = recordMap.get(Number(e.target.value)); setAttendanceForm({ workerId: e.target.value, status: r?.status || "present", checkIn: r?.checkIn || "08:00", checkOut: r?.checkOut || "" }); }}><option value="">Select a worker</option>{data.workers.map((w) => <option key={w.id} value={w.id}>{w.name} — {w.role}</option>)}</select></label><label>Status <select value={attendanceForm.status} onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value })}><option value="present">Present</option><option value="late">Late arrival</option><option value="absent">Absent</option><option value="on_leave">On leave</option></select></label>{attendanceForm.status !== "absent" && attendanceForm.status !== "on_leave" && <div className="form-two-col"><label>Check in <input type="time" value={attendanceForm.checkIn} onChange={(e) => setAttendanceForm({ ...attendanceForm, checkIn: e.target.value })} /></label><label>Check out <input type="time" value={attendanceForm.checkOut} onChange={(e) => setAttendanceForm({ ...attendanceForm, checkOut: e.target.value })} /></label></div>}{formError && <p className="form-error">{formError}</p>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving..." : "Save attendance"}</button></div></form>}
      </div></div>}
    </div>;
}

function StatCard({ label, value, icon, tone, note, noteIcon }: { label: string; value: number | string; icon: React.ReactNode; tone: string; note: string; noteIcon?: React.ReactNode }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon stat-${tone}`}>{icon}</div></div><strong className="stat-number">{value}</strong><div className="stat-note">{noteIcon && <span className={`note-icon note-${tone}`}>{noteIcon}</span>}{note}</div></div>; }
function Filters({ search, setSearch, projectFilter, setProjectFilter, statusFilter, setStatusFilter, projects, showStatus = false }: { search: string; setSearch: (v: string) => void; projectFilter: string; setProjectFilter: (v: string) => void; statusFilter: string; setStatusFilter: (v: string) => void; projects: Project[]; showStatus?: boolean }) { return <div className="filter-bar"><div className="filter-search"><Search size={18} /><input placeholder="Search workers..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="filter-select-wrap"><SlidersHorizontal size={16} /><select aria-label="Filter by project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}><option value="all">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={15} /></div>{showStatus && <div className="filter-select-wrap"><select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="present">Present</option><option value="late">Late arrival</option><option value="absent">Absent</option><option value="on_leave">On leave</option><option value="unmarked">Not marked</option></select><ChevronDown size={15} /></div>}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><Search size={28} /><strong>Nothing to show here</strong><p>{text}</p></div>; }
