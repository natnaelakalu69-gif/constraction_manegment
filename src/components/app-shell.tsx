"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import NotificationBell from "@/components/notification-bell";

type SessionUser = {
  id: number;
  fullName: string;
  email: string;
  role: string;
};

const navigation = [
  { href: "/", label: "Overview", icon: "O" },
  { href: "/notifications", label: "Notifications", icon: "N" },
  { href: "/procurement", label: "Procurement", icon: "C" },
  { href: "/documents", label: "Documents", icon: "F" },
  { href: "/daily-plans", label: "Daily plans", icon: "D" },
  { href: "/tasks", label: "Tasks", icon: "T" },
  { href: "/payroll", label: "Payroll", icon: "W" },
  { href: "/expenses", label: "Expenses", icon: "$" },
  { href: "/projects", label: "Projects", icon: "P" },
  { href: "/sites", label: "Sites", icon: "S" },
  { href: "/workers", label: "Workforce", icon: "W" },
  { href: "/attendance", label: "Attendance", icon: "A" },
  { href: "/daily-reports", label: "Daily reports", icon: "R" },
  { href: "/materials", label: "Materials", icon: "M" },
  { href: "/safety", label: "Safety & quality", icon: "Q" },
  { href: "/daily-summary", label: "Reports", icon: "S" },
  { href: "/executive-summary", label: "Executive summary", icon: "E" },
  { href: "/roles", label: "Roles & access", icon: "L" },
  { href: "/settings", label: "Settings", icon: "G" },
];

const pageTitles: Record<string, string> = {
  "/": "Overview",
  "/notifications": "Notifications",
  "/procurement": "Procurement",
  "/documents": "Documents",
  "/daily-plans": "Daily plans",
  "/tasks": "Tasks & teams",
  "/payroll": "Payroll & wages",
  "/expenses": "Expenses & budgets",
  "/projects": "Projects",
  "/sites": "Sites",
  "/workers": "Workforce",
  "/attendance": "Attendance",
  "/daily-reports": "Daily reports",
  "/materials": "Materials",
  "/safety": "Safety & quality",
  "/daily-summary": "Operations reports",
  "/executive-summary": "Executive summary",
  "/roles": "Roles & access",
  "/settings": "Settings",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (pathname === "/login") return;

    const controller = new AbortController();
    void fetch("/api/auth/me", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return null;
        }
        if (!response.ok) return null;
        return (await response.json()) as SessionUser;
      })
      .then((currentUser) => {
        if (!controller.signal.aborted && currentUser) setUser(currentUser);
      })
      .catch(() => {
        // The proxy still protects the page if this request fails.
      });

    return () => controller.abort();
  }, [pathname, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  async function signOut() {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Still return to the sign-in screen if the network request fails.
    } finally {
      setUser(null);
      router.replace("/login");
      setIsSigningOut(false);
    }
  }

  const title = pageTitles[pathname] ?? "Operations";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Construction operations home">
          <span className="brand-mark">C</span>
          <span className="brand-copy">
            <strong>CONSTRUCT</strong>
            <span>FIELD OPERATIONS</span>
          </span>
        </Link>

        <div className="workspace-picker">
          <span className="workspace-avatar">CO</span>
          <span className="workspace-copy">
            <strong>Company workspace</strong>
            <small>Operations</small>
          </span>
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          <span className="nav-label">WORKSPACE</span>
          {navigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                className={`nav-link${active ? " active" : ""}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className="status-orb" />
            <span>Core operations</span>
          </div>
          <p>Notifications, procurement, documents, tasks, payroll, expenses, attendance, materials, safety and reports are available.</p>
          <Link className="sidebar-cta" href="/attendance">
            <span aria-hidden="true">+</span>
            Record attendance
          </Link>
          <div className="sidebar-version">CONSTRUCTION OPERATIONS</div>
        </div>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <NotificationBell />
            <div className="user-chip" title={user?.email ?? "Workspace user"}>
              <span className="topbar-avatar" aria-hidden="true">
                {initials(user?.fullName ?? "Workspace user")}
              </span>
              <span className="user-copy">
                <strong>{user?.fullName ?? "Workspace user"}</strong>
                <small>{user?.role ?? "Operations"}</small>
              </span>
            </div>
            <button
              className="signout-button"
              type="button"
              onClick={signOut}
              disabled={isSigningOut}
              aria-label="Log out"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
                <path d="M14 8l4 4-4 4M18 12H9" />
              </svg>
              <span>{isSigningOut ? "Logging out…" : "Log out"}</span>
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
