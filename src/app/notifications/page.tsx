"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { useNotificationReadState } from "@/lib/notification-read-state";
import {
  NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS,
  type NotificationBundle, type NotificationType,
} from "@/lib/notifications";

type Filter = "all" | NotificationType;

function formatWhen(value: string | null) {
  if (!value) return "—";
  if (!value.includes("T")) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }).format(parsed);
}

export default function NotificationsPage() {
  const [bundle, setBundle] = useState<NotificationBundle | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { readKeys, markRead } = useNotificationReadState();

  const load = useCallback(() =>
    fetchJson<NotificationBundle>("/api/notifications")
      .then((result) => {
        setBundle(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Notifications could not be loaded.");
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      }),
  []);

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("module-change", refresh);
    return () => window.removeEventListener("module-change", refresh);
  }, [load]);

  const isRead = useCallback((id: string) => readKeys.includes(id), [readKeys]);

  const unreadCount = (bundle?.notifications ?? []).filter((item) => !isRead(item.id)).length;

  const visible = useMemo(() =>
    (bundle?.notifications ?? []).filter((item) =>
      (filter === "all" || item.type === filter) && (!unreadOnly || !isRead(item.id))),
  [bundle, filter, unreadOnly, isRead]);

  function markAllRead() {
    markRead((bundle?.notifications ?? []).map((item) => item.id));
  }

  return (
    <main className="management-main">
      <section className="management-heading">
        <div>
          <div className="eyebrow">OPERATIONS ALERTS</div>
          <h1>Notifications</h1>
          <p className="page-subtitle">
            Live alerts for attendance exceptions, safety incidents, low stock and task deadlines.
          </p>
        </div>
        <div className="heading-actions">
          <span className="notification-total">
            {unreadCount} unread of {bundle?.total ?? 0}
          </span>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setRefreshing(true);
              void load();
            }}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button className="button button-primary" type="button" onClick={markAllRead} disabled={unreadCount === 0}>
            Mark all as read
          </button>
        </div>
      </section>

      {error && <div className="management-message error-message" role="alert">{error}</div>}

      <section className="metrics-grid" aria-label="Notification summary">
        {NOTIFICATION_TYPES.map((type) => (
          <article className="metric-card" key={type}>
            <div className="metric-topline">
              <span className="metric-caption">ALERTS</span>
            </div>
            <div className="metric-value">{loading && !bundle ? "—" : bundle?.counts[type] ?? 0}</div>
            <div className="metric-label">{NOTIFICATION_TYPE_LABELS[type]}</div>
          </article>
        ))}
      </section>

      <section className="management-card">
        <div className="management-card-heading">
          <h2>Alert inbox</h2>
          <p>Alerts are generated from current records and clear automatically when resolved.</p>
        </div>

        <div className="notification-filters">
          <button
            className={`notification-filter${filter === "all" ? " active" : ""}`}
            type="button"
            onClick={() => setFilter("all")}
          >
            All ({bundle?.total ?? 0})
          </button>
          {NOTIFICATION_TYPES.map((type) => (
            <button
              className={`notification-filter${filter === type ? " active" : ""}`}
              type="button"
              key={type}
              onClick={() => setFilter(type)}
            >
              {NOTIFICATION_TYPE_LABELS[type]} ({bundle?.counts[type] ?? 0})
            </button>
          ))}
          <button
            className={`notification-filter${unreadOnly ? " active" : ""}`}
            type="button"
            onClick={() => setUnreadOnly((current) => !current)}
          >
            Unread only ({unreadCount})
          </button>
        </div>

        <div className="management-table-wrap">
          <table className="management-table">
            <thead>
              <tr>
                <th scope="col">SEVERITY</th>
                <th scope="col">CATEGORY</th>
                <th scope="col">ALERT</th>
                <th scope="col">WHEN</th>
                <th scope="col">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className={isRead(item.id) ? undefined : "notification-unread"}>
                  <td><span className={`status-pill status-${item.severity}`}>{item.severity}</span></td>
                  <td>{item.typeLabel}</td>
                  <td className="notification-detail">
                    <Link href={item.href}>{item.title}</Link>
                    <small>{item.body}</small>
                  </td>
                  <td>{formatWhen(item.occurredAt)}</td>
                  <td>
                    <div className="row-actions">
                      {!isRead(item.id) && (
                        <button
                          className="button button-secondary row-action"
                          type="button"
                          onClick={() => markRead([item.id])}
                        >
                          Mark read
                        </button>
                      )}
                      <Link className="button button-secondary row-action" href={item.href}>Open</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && <tr><td className="management-empty" colSpan={5}>Loading notifications…</td></tr>}
              {!loading && visible.length === 0 && (
                <tr><td className="management-empty" colSpan={5}>No notifications in this view.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
