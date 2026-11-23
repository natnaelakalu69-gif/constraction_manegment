"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "construction-notifications-read-v1";
export const NOTIFICATION_READ_EVENT = "notification-read-change";

function storedKeys(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function persist(keys: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Storage can be unavailable (private mode); the UI still works for this session.
  }
  window.dispatchEvent(new Event(NOTIFICATION_READ_EVENT));
}

/**
 * Read state is browser-local until per-user authentication is wired into the app.
 * All inbox views stay in sync through the custom event and the storage event.
 */
export function useNotificationReadState() {
  const [readKeys, setReadKeys] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setReadKeys(storedKeys());
    sync();
    window.addEventListener(NOTIFICATION_READ_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(NOTIFICATION_READ_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const markRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    persist([...new Set([...storedKeys(), ...ids])]);
  }, []);

  const clearRead = useCallback(() => persist([]), []);

  return { readKeys, markRead, clearRead };
}
