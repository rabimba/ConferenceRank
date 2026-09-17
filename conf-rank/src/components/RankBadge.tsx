const RANK_STYLES: Record<string, { classes: string; label: string }> = {
  "A*": {
    classes:
      "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
    label: "A*",
  },
  A: {
    classes:
      "bg-blue-100 text-blue-900 ring-1 ring-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-800",
    label: "A",
  },
  B: {
    classes:
      "bg-teal-100 text-teal-900 ring-1 ring-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-800",
    label: "B",
  },
  C: {
    classes:
      "bg-slate-100 text-slate-600 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600",
    label: "C",
  },
  "Australasian B": {
    classes:
      "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:ring-teal-800",
    label: "Aus B",
  },
  "Australasian C": {
    classes:
      "bg-slate-50 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700",
    label: "Aus C",
  },
};

const sizeCls = {
  sm: "text-[11px] px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
  lg: "text-base px-3 py-1",
};

export default function RankBadge({
  rank,
  size = "md",
}: {
  rank: string;
  size?: "sm" | "md" | "lg";
}) {
  const style = RANK_STYLES[rank];
  const cls = sizeCls[size];
  if (style) {
    return (
      <span
        title={`CORE rank: ${rank}`}
        className={`inline-flex items-center rounded-full font-bold tracking-wide whitespace-nowrap ${style.classes} ${cls}`}
      >
        {style.label}
      </span>
    );
  }
  const isUnranked = rank.toLowerCase().startsWith("unranked");
  const label = isUnranked
    ? "Unranked"
    : rank.length > 16
      ? rank.slice(0, 15) + "…"
      : rank;
  return (
    <span
      title={`CORE rank: ${rank}`}
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ring-1 ${cls} ${
        isUnranked
          ? "bg-neutral-50 text-neutral-500 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-700"
          : "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-800"
      }`}
    >
      {label}
    </span>
  );
}
