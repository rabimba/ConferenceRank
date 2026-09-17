"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Directory, { type DirectoryEntry } from "./Directory";
import CompareModal from "./CompareModal";
import { RankRateScatterChart, type LandscapePoint } from "./Charts";
import type { Conference } from "@/lib/types";

export default function HomeClient({
  venues,
  entries,
  scatterPoints,
}: {
  venues: Conference[];
  entries: DirectoryEntry[];
  scatterPoints: LandscapePoint[];
}) {
  const router = useRouter();
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showScatter, setShowScatter] = useState(false);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const removeCompare = (id: string) => {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  };

  const selectedVenues = venues.filter((v) => compareIds.includes(v.id));

  return (
    <>
      {/* Landscape Scatterplot Toggle */}
      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>📊 Conference Landscape (Rank vs. Acceptance Rate)</span>
              <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                ({scatterPoints.length} venues with stats)
              </span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Compare selectivity against CORE prestige tier. Dot size corresponds to papers accepted.
            </p>
          </div>
          <button
            onClick={() => setShowScatter(!showScatter)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 transition"
          >
            {showScatter ? "Hide Chart ▲" : "Show Chart ▼"}
          </button>
        </div>
        {showScatter && (
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <RankRateScatterChart
              data={scatterPoints}
              onSelectVenue={(id) => {
                router.push(`/conference/${id}`);
              }}
            />
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
