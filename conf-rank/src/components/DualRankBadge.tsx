// conf-rank/src/components/DualRankBadge.tsx
import React from "react";

interface DualRankBadgeProps {
  coreRank?: string | null;
  sjrQuartile?: string | null;
  size?: "sm" | "md" | "lg";
}

export function DualRankBadge({ coreRank, sjrQuartile, size = "md" }: DualRankBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  }[size];

  const getCoreColor = (rank: string) => {
    switch (rank) {
      case "A*": return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
      case "A": return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
      case "B": return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
      case "C": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
      default: return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30";
    }
  };

  const getSjrColor = (q: string) => {
    switch (q) {
      case "Q1": return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
      case "Q2": return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";
      case "Q3": return "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30";
      case "Q4": return "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30";
      default: return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30";
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {coreRank && (
        <span className={`font-mono font-semibold rounded border ${sizeClasses} ${getCoreColor(coreRank)}`}>
          CORE {coreRank}
        </span>
      )}
      {sjrQuartile && (
        <span className={`font-mono font-semibold rounded border ${sizeClasses} ${getSjrColor(sjrQuartile)}`}>
          SJR {sjrQuartile}
        </span>
      )}
      {!coreRank && !sjrQuartile && (
        <span className={`font-mono rounded border ${sizeClasses} bg-zinc-500/15 text-zinc-500 border-zinc-500/20`}>
          Unranked
        </span>
      )}
    </div>
  );
}
export default DualRankBadge;
