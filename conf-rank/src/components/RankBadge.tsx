const RANK_STYLES: Record<string, { classes: string; label: string }> = {
  "A*": {
    classes:
      "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
    label: "A*",
  },
  A: {
    classes:
      "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:ring-indigo-800",
    label: "A",
  },
  B: {
    classes:
      "bg-teal-100 text-teal-900 ring-1 ring-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-800",
    label: "B",
  },
  C: {
    classes:
      "bg-stone-100 text-stone-600 ring-1 ring-stone-300 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-600",
    label: "C",
  },
  "Australasian B": {
    classes:
      "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:ring-teal-800",
    label: "Aus B",
  },
  "Australasian C": {
    classes:
      "bg-stone-50 text-stone-500 ring-1 ring-stone-200 dark:bg-stone-800/60 dark:text-stone-300 dark:ring-stone-700",
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
