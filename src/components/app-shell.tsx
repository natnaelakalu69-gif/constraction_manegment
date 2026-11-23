"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import NotificationBell from "@/components/notification-bell";

const navigation = [
  { href: "/", label: "Overview", icon: "O" },
  { href: "/notifications", label: "Notifications", icon: "N" },
  { href: "/procurement", label: "Procurement", icon: "C" },
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

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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
          <p>Notifications, procurement, tasks, payroll, expenses, attendance, materials, safety and reports are available.</p>
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
            <span className="connection-state">Operations workspace</span>
            <span className="topbar-avatar" aria-label="Company workspace">CO</span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
