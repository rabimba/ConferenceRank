const RANK_STYLES: Record<string, { classes: string; label: string }> = {
  "A*": {
    classes:
      "bg-amber-100/90 text-amber-950 ring-1 ring-amber-300/80 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-amber-700/60",
    label: "A*",
  },
  A: {
    classes:
      "bg-orange-100/80 text-orange-950 ring-1 ring-orange-300/80 dark:bg-orange-950/70 dark:text-orange-200 dark:ring-orange-700/60",
    label: "A",
  },
  B: {
    classes:
      "bg-emerald-100/70 text-emerald-950 ring-1 ring-emerald-300/70 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800/60",
    label: "B",
  },
  C: {
    classes:
      "bg-stone-200/70 text-stone-800 ring-1 ring-stone-300/80 dark:bg-stone-800/80 dark:text-stone-200 dark:ring-stone-700/60",
    label: "C",
  },
  "Australasian B": {
    classes:
      "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60",
    label: "Aus B",
  },
  "Australasian C": {
    classes:
      "bg-stone-100 text-stone-700 ring-1 ring-stone-200 dark:bg-stone-800/50 dark:text-stone-300 dark:ring-stone-700/50",
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
          ? "bg-stone-100 text-stone-500 ring-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:ring-stone-800"
          : "bg-stone-200/70 text-stone-700 ring-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700"
      }`}
    >
      {label}
    </span>
  );
}
