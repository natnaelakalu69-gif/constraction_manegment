"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { useNotificationReadState } from "@/lib/notification-read-state";
import type { NotificationBundle, NotificationItem } from "@/lib/notifications";

export default function NotificationBell() {
  const { readKeys } = useNotificationReadState();
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = useCallback(() => {
    const controller = new AbortController();
    void fetchJson<NotificationBundle>("/api/notifications", { signal: controller.signal })
      .then((bundle) => setItems(bundle.notifications))
      .catch(() => setItems([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const cancel = load();
    const refresh = () => { load(); };
    window.addEventListener("module-change", refresh);
    window.addEventListener("notification-read-change", refresh);
    return () => {
      cancel();
      window.removeEventListener("module-change", refresh);
      window.removeEventListener("notification-read-change", refresh);
    };
  }, [load]);

  const unread = items.filter((item) => !readKeys.includes(item.id)).length;

  return (
    <Link
      className="notification-bell"
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      title={unread > 0 ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "No unread notifications"}
    >
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" />
      </svg>
      {unread > 0 && <span className="notification-bell-count">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}
