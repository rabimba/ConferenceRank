/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "cr_watchlist";
const EVENT_NAME = "cr_watchlist_change";

export function getWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: ids }));
  } catch (err) {
    console.error("Failed to save watchlist to localStorage:", err);
  }
}

export function toggleWatchlist(id: string): string[] {
  const current = getWatchlist();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  saveWatchlist(next);
  return next;
}

export function isWatchlisted(id: string): boolean {
  return getWatchlist().includes(id);
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setWatchlist(getWatchlist());
    setHydrated(true);

    const handleUpdate = () => {
      setWatchlist(getWatchlist());
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    toggleWatchlist(id);
  }, []);

  const isSaved = useCallback(
    (id: string) => {
      return watchlist.includes(id);
    },
    [watchlist]
  );

  return {
    watchlist,
    toggle,
    isSaved,
    hydrated,
    count: watchlist.length,
  };
}
