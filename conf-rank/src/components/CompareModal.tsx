"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import RankBadge from "./RankBadge";
import type { Conference } from "@/lib/types";

export default function CompareModal({
  venues,
  onClose,
  onRemove,
}: {
  venues: Conference[];
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape to close, autofocus close button, restore focus on unmount
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevActive?.focus?.();
    };
  }, [onClose]);

  if (venues.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Venue comparison"
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-black tracking-tight text-neutral-900 dark:text-neutral-100">
              Venue Comparison
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Side-by-side analysis of selected conferences ({venues.length})
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close comparison"
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              {/* Header / Acronym & Title */}
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="w-36 py-3 font-semibold text-neutral-400 dark:text-neutral-500 text-xs uppercase">
                  Venue
                </th>
                {venues.map((v) => (
                  <td key={v.id} className="min-w-[200px] py-3 pr-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/conference/${v.id}`}
                            className="font-bold text-neutral-900 hover:underline dark:text-neutral-100"
                          >
                            {v.acronym}
                          </Link>
                          <RankBadge rank={v.rank} size="sm" />
                        </div>
                        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                          {v.title}
                        </div>
                      </div>
                      <button
                        onClick={() => onRemove(v.id)}
                        title="Remove from comparison"
                        className="text-xs text-neutral-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                ))}
              </tr>

              {/* CORE Rank */}
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="py-3 font-semibold text-neutral-400 dark:text-neutral-500 text-xs uppercase">
                  CORE Rank
                </th>
                {venues.map((v) => (
                  <td key={v.id} className="py-3 pr-4 font-semibold text-neutral-800 dark:text-neutral-200">
                    {v.rank}
                  </td>
                ))}
              </tr>

              {/* Acceptance Rate */}
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="py-3 font-semibold text-neutral-400 dark:text-neutral-500 text-xs uppercase">
                  Acceptance Rate
                </th>
                {venues.map((v) => {
                  const stat = v.stats?.find((s) => s.rate && s.rate > 0 && s.rate < 60);
                  return (
                    <td key={v.id} className="py-3 pr-4">
                      {stat?.rate != null ? (
                        <div>
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {stat.rate}%
                          </span>
                          <span className="ml-1 text-xs text-neutral-400">({stat.year})</span>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">No data</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Papers Accepted */}
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="py-3 font-semibold text-neutral-400 dark:text-neutral-500 text-xs uppercase">
                  Accepted (Latest)
                </th>
                {venues.map((v) => {
                  const stat = v.stats?.[v.stats.length - 1];
                  const acc = stat?.accepted ?? stat?.accepted_short;
                  return (
                    <td key={v.id} className="py-3 pr-4 tabular-nums text-neutral-700 dark:text-neutral-300">
                      {acc != null ? (
                        <div>
                          <span>{acc.toLocaleString()}</span>
                          {stat?.submitted && (
                            <span className="text-xs text-neutral-400 ml-1">
                              / {stat.submitted.toLocaleString()} sub
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Categories */}
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="py-3 font-semibold text-neutral-400 dark:text-neutral-500 text-xs uppercase">
                  Categories
                </th>
                {venues.map((v) => (
                  <td key={v.id} className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {v.categories.map((c) => (
                        <span
                          key={c}
                          className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Community Rating */}
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="py-3 font-semibold text-neutral-400 dark:text-neutral-500 text-xs uppercase">
                  Rating
                </th>
                {venues.map((v) => (
                  <td key={v.id} className="py-3 pr-4 text-xs font-medium text-amber-600 dark:text-amber-400">
                    {v.avg_rating ? `★ ${v.avg_rating} / 5` : "—"}
                  </td>
                ))}
              </tr>

              {/* External Links */}
              <tr>
                <th className="py-3 font-semibold text-neutral-400 dark:text-neutral-500 text-xs uppercase">
                  Links
                </th>
                {venues.map((v) => (
                  <td key={v.id} className="py-3 pr-4">
                    <div className="flex gap-2 text-xs">
                      <Link
                        href={`/conference/${v.id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Full Details ↗
                      </Link>
                      {v.dblp_url && (
                        <a
                          href={v.dblp_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neutral-500 hover:underline"
                        >
                          DBLP ↗
                        </a>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
