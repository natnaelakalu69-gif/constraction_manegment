"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type IconName =
  | "overview"
  | "projects"
  | "sites"
  | "people"
  | "attendance"
  | "inventory"
  | "safety"
  | "plan"
  | "report"
  | "refresh"
  | "arrow";

type Site = {
  id: number;
  siteCode: string;
  siteName: string;
  location: string;
  status: string;
};

type DailyReport = {
  date: string;
  summary: Partial<Record<"PRESENT" | "ABSENT" | "LATE" | "LEAVE", number>>;
  total: number;
};

type DashboardData = {
  sites: Site[];
  report: DailyReport;
};

const iconShapes: Record<IconName, React.ReactNode> = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="4" rx="1.2" />
      <rect x="13.5" y="10.5" width="7" height="10" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
    </>
  ),
  projects: (
    <>
      <path d="M3.5 20.5h17M5 20V9l7-5 7 5v11" />
      <path d="M9 20v-6h6v6M3.5 9h17" />
    </>
  ),
  sites: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20v-1.6a5.5 5.5 0 0 1 11 0V20ZM16 5.2a3.2 3.2 0 0 1 0 6.2M17 14.2a5 5 0 0 1 3.5 4.7V20" />
    </>
  ),
  attendance: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16M8 14l2.2 2.2L16 11.5" />
    </>
  ),
  inventory: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4.5 7.8 7.5 4.4 7.5-4.4M12 12.2V21M8 5.3l8 4.5" />
    </>
  ),
  safety: (
    <>
      <path d="M12 3 20 6v5.3c0 4.6-3.1 8.1-8 9.7-4.9-1.6-8-5.1-8-9.7V6l8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  plan: (
    <>
      <path d="M6 3.5h9l3 3v14H6z" />
      <path d="M14.5 3.5v3.5H18M9 11h6M9 14.5h6M9 18h4" />
    </>
  ),
  report: (
    <>
      <path d="M7 3.5h7l4 4v13H7z" />
      <path d="M14 3.5v4h4M10 12h5M10 15.5h5M10 19h3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5.6 9a7 7 0 0 1 11.8-2L20 12M4 12l2.6 5a7 7 0 0 0 11.8-2" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {iconShapes[name]}
    </svg>
  );
}

async function getJson<T>(url: string, signal: AbortSignal, label: string): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${label} could not be loaded (HTTP ${response.status}).`);
  }
  return (await response.json()) as T;
}

function utcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function prettyDate(date: string) {
  if (!date) return "Today's operations";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function countFor(report: DailyReport | undefined, status: keyof DailyReport["summary"]) {
  return report?.summary[status] ?? 0;
}

export default function OperationsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const today = utcDateKey();

    void Promise.all([
      getJson<Site[]>("/api/sites", controller.signal, "Sites"),
      getJson<DailyReport>(
        `/api/reports/daily?date=${encodeURIComponent(today)}`,
        controller.signal,
        "Attendance summary",
      ),
    ])
      .then(([sites, report]) => {
        if (controller.signal.aborted) return;
        setData({ sites, report });
        setDate(today);
        setError(null);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setDate(today);
        setError(cause instanceof Error ? cause.message : "Dashboard data could not be loaded.");
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  const activeSites = data?.sites.filter((site) => site.status === "ACTIVE").length ?? 0;
  const present = countFor(data?.report, "PRESENT");
  const late = countFor(data?.report, "LATE");
  const absent = countFor(data?.report, "ABSENT");
  const leave = countFor(data?.report, "LEAVE");
  const followUp = late + absent;
  const attendanceItems = [
    { label: "Present", value: present, color: "present" },
    { label: "Late", value: late, color: "late" },
    { label: "Absent", value: absent, color: "absent" },
    { label: "On leave", value: leave, color: "leave" },
  ];

  function refreshDashboard() {
    setIsLoading(true);
    setRefreshKey((current) => current + 1);
  }

  return (
    <main className="dashboard-main">
          <section className="page-heading">
            <div>
              <div className="eyebrow">OPERATIONS OVERVIEW</div>
              <h1>Good work starts with a clear view.</h1>
              <p className="page-subtitle">
                Your sites and workforce activity, together in one place.
              </p>
            </div>
            <div className="heading-actions">
              <div className="date-chip">
                <span className="date-chip-icon">▦</span>
                <span>{prettyDate(date)}</span>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={refreshDashboard}
                disabled={isLoading}
              >
                <Icon name="refresh" className={isLoading ? "icon-spin" : ""} />
                {isLoading ? "Refreshing" : "Refresh"}
              </button>
              <Link className="button button-primary" href="/attendance">
                <span aria-hidden="true">+</span>
                Record attendance
              </Link>
            </div>
          </section>

          {error && (
            <div className="data-alert" role="status">
              <span className="alert-mark">!</span>
              <div>
                <strong>Live data could not be loaded</strong>
                <p>{error}{data ? " Showing the last successfully loaded data." : ""}</p>
              </div>
              <button className="alert-retry" type="button" onClick={refreshDashboard}>
                Try again
              </button>
            </div>
          )}

          <section className="metrics-grid" aria-label="Operations summary">
            <article className="metric-card metric-card-accent">
              <div className="metric-topline">
                <span className="metric-icon icon-blue"><Icon name="sites" /></span>
                <span className="metric-caption">CURRENT FOOTPRINT</span>
              </div>
              <div className="metric-value">{isLoading && !data ? "—" : activeSites}</div>
              <div className="metric-label">Active sites</div>
              <div className="metric-footnote">
                {isLoading && !data ? "Loading sites" : `${data?.sites.length ?? 0} sites in your workspace`}
              </div>
            </article>
            <article className="metric-card">
              <div className="metric-topline">
                <span className="metric-icon icon-green"><Icon name="attendance" /></span>
                <span className="metric-caption">TODAY</span>
              </div>
              <div className="metric-value">{isLoading && !data ? "—" : data?.report.total ?? 0}</div>
              <div className="metric-label">Attendance entries</div>
              <div className="metric-footnote">Recorded for {date || "today"}</div>
            </article>
            <article className="metric-card">
              <div className="metric-topline">
                <span className="metric-icon icon-amber"><Icon name="people" /></span>
                <span className="metric-caption">ON SITE</span>
              </div>
              <div className="metric-value">{isLoading && !data ? "—" : present}</div>
              <div className="metric-label">Marked present</div>
              <div className="metric-footnote">Attendance recorded today</div>
            </article>
            <article className={`metric-card ${followUp > 0 ? "metric-card-alert" : ""}`}>
              <div className="metric-topline">
                <span className={`metric-icon ${followUp > 0 ? "icon-red" : "icon-slate"}`}>
                  <Icon name="safety" />
                </span>
                <span className="metric-caption">FOLLOW-UP</span>
              </div>
              <div className="metric-value">{isLoading && !data ? "—" : followUp}</div>
              <div className="metric-label">Late or absent</div>
              <div className="metric-footnote">
                {followUp > 0 ? "Review today's attendance" : "No attendance exceptions"}
              </div>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel sites-panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">FIELD FOOTPRINT</div>
                  <h2>Sites</h2>
                  <p className="panel-description">A snapshot of active construction locations.</p>
                </div>
                <Link className="text-link" href="/sites">
                  View all <Icon name="arrow" />
                </Link>
              </div>

              <div className="site-table-wrap">
                <table className="site-table">
                  <thead>
                    <tr>
                      <th scope="col">SITE</th>
                      <th scope="col">LOCATION</th>
                      <th scope="col">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.sites.slice(0, 5).map((site) => (
                      <tr key={site.id}>
                        <td>
                          <div className="site-name-cell">
                            <span className="site-marker"><Icon name="sites" /></span>
                            <span>
                              <strong>{site.siteName}</strong>
                              <small>{site.siteCode}</small>
                            </span>
                          </div>
                        </td>
                        <td className="location-cell">{site.location}</td>
                        <td>
                          <span className={`site-status ${site.status.toLowerCase()}`}>
                            <span />
                            {site.status.toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {data && data.sites.length === 0 && (
                      <tr>
                        <td className="empty-table" colSpan={3}>
                          <strong>No sites have been added yet.</strong>
                          <span>Add your first site to start tracking field operations.</span>
                        </td>
                      </tr>
                    )}
                    {isLoading && !data && (
                      <tr>
                        <td className="empty-table" colSpan={3}>Loading site information…</td>
                      </tr>
                    )}
                    {!isLoading && !data && (
                      <tr>
                        <td className="empty-table" colSpan={3}>Site information is unavailable.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="panel-footer">
                <span>Showing up to 5 sites</span>
                <Link href="/sites">Manage sites <Icon name="arrow" /></Link>
              </div>
            </article>

            <article className="panel attendance-panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">WORKFORCE PULSE</div>
                  <h2>Today&apos;s attendance</h2>
                  <p className="panel-description">Status breakdown from recorded check-ins.</p>
                </div>
                <Link className="round-link" href="/attendance" aria-label="Open attendance">
                  <Icon name="arrow" />
                </Link>
              </div>

              <div className="attendance-total">
                <strong>{isLoading && !data ? "—" : data?.report.total ?? 0}</strong>
                <span>total entries</span>
              </div>

              <div className="attendance-bars">
                {attendanceItems.map((item) => {
                  const percentage = data?.report.total
                    ? Math.round((item.value / data.report.total) * 100)
                    : 0;
                  return (
                    <div className="attendance-bar-row" key={item.label}>
                      <div className="attendance-bar-heading">
                        <span><i className={`legend-dot ${item.color}`} />{item.label}</span>
                        <strong>{isLoading && !data ? "—" : item.value}</strong>
                      </div>
                      <div className="bar-track">
                        <span
                          className={`bar-fill ${item.color}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <Link className="attendance-link" href="/attendance">
                Open daily attendance <Icon name="arrow" />
              </Link>
            </article>
          </section>

          <section className="modules-section">
            <div className="modules-heading">
              <div>
                <div className="eyebrow">BUILDING OUT</div>
                <h2>More of your operation, coming together.</h2>
              </div>
              <span className="roadmap-badge">AVAILABLE</span>
            </div>
            <div className="module-grid">
              <Link className="module-card" href="/daily-plans">
                <span className="module-icon module-indigo"><Icon name="plan" /></span>
                <div><strong>Daily plans</strong><p>Tasks, deadlines, supervisors and required resources.</p></div>
                <span className="module-status">Open</span>
              </Link>
              <Link className="module-card" href="/daily-reports">
                <span className="module-icon module-orange"><Icon name="attendance" /></span>
                <div><strong>Daily site reports</strong><p>Progress, photos, challenges, reviews and follow-ups.</p></div>
                <span className="module-status">Open</span>
              </Link>
              <Link className="module-card" href="/daily-summary">
                <span className="module-icon module-teal"><Icon name="report" /></span>
                <div><strong>Operations reports</strong><p>Daily detail plus weekly, monthly and yearly summaries.</p></div>
                <span className="module-status">Open</span>
              </Link>
              <Link className="module-card" href="/roles">
                <span className="module-icon module-indigo"><Icon name="safety" /></span>
                <div><strong>Roles &amp; access</strong><p>Roles, permissions and user assignments.</p></div>
                <span className="module-status">Open</span>
              </Link>
              <Link className="module-card" href="/projects">
                <span className="module-icon module-indigo"><Icon name="projects" /></span>
                <div><strong>Project controls</strong><p>Budgets, work packages, and progress tracking.</p></div>
                <span className="module-status">Open</span>
              </Link>
              <Link className="module-card" href="/materials">
                <span className="module-icon module-teal"><Icon name="inventory" /></span>
                <div><strong>Materials & equipment</strong><p>Materials, stock movements, and asset visibility.</p></div>
                <span className="module-status">Open</span>
              </Link>
              <Link className="module-card" href="/safety">
                <span className="module-icon module-orange"><Icon name="safety" /></span>
                <div><strong>Safety & quality</strong><p>Incidents, inspections, and defect records.</p></div>
                <span className="module-status">Open</span>
              </Link>
            </div>
          </section>

          <footer className="dashboard-footer">
            <span>Construction Operations</span>
            <span>Live data covers sites, attendance, daily plans, site reports, materials and safety.</span>
          </footer>
    </main>
  );
}
