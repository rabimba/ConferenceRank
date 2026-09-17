"use client";

import { useState } from "react";
import Directory, { type DirectoryEntry } from "./Directory";
import CompareModal from "./CompareModal";
import AcceptanceLandscape from "./AcceptanceLandscape";
import type { LandscapePoint } from "@/app/page";
import type { Conference } from "@/lib/types";

export default function HomeClient({
  venues,
  entries,
  landscapePoints,
  totalAStar,
}: {
  venues: Conference[];
  entries: DirectoryEntry[];
  landscapePoints: LandscapePoint[];
  totalAStar: number;
}) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showLandscape, setShowLandscape] = useState(false);
  const [capNotice, setCapNotice] = useState(false);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) {
        setCapNotice(true);
        setTimeout(() => setCapNotice(false), 2500);
        return prev;
      }
      return [...prev, id];
    });
  };

  const removeCompare = (id: string) => {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  };

  const selectedVenues = venues.filter((v) => compareIds.includes(v.id));

  return (
    <>
      {/* Acceptance Rate & Selectivity Landscape */}
      <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>📊 Conference Selectivity Landscape</span>
              <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                ({landscapePoints.length} venues with acceptance stats)
              </span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Benchmark acceptance rates across CORE prestige tiers (A* through C) and computer science fields.
            </p>
          </div>
          <button
            onClick={() => setShowLandscape(!showLandscape)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 transition"
          >
            {showLandscape ? "Hide Section ▲" : "Show Section ▼"}
          </button>
        </div>

        {showLandscape && (
          <div className="mt-5 pt-5 border-t border-neutral-100 dark:border-neutral-800">
            <AcceptanceLandscape points={landscapePoints} totalAStar={totalAStar} />
          </div>
        )}
      </div>

      <Directory
        venues={entries}
        onCompare={toggleCompare}
        selectedForCompare={compareIds}
      />

      {/* Floating Compare Drawer / Bar */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-neutral-300 bg-white/95 px-5 py-2.5 shadow-xl backdrop-blur-md dark:border-neutral-700 dark:bg-neutral-900/95">
          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
            {compareIds.length} venue{compareIds.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-1">
            {selectedVenues.map((v) => (
              <span
                key={v.id}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              >
                {v.acronym}
                <button onClick={() => removeCompare(v.id)} className="hover:text-red-500">
                  ×
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            Compare Side-by-Side
          </button>
          <button
            onClick={() => setCompareIds([])}
            className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            Clear
          </button>
        </div>
      )}

      {capNotice && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
        >
          Compare is limited to 4 venues
        </div>
      )}

      {showModal && (
        <CompareModal
          venues={selectedVenues}
          onClose={() => setShowModal(false)}
          onRemove={removeCompare}
        />
      )}
    </>
  );
}
