const sizeCls = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-[10px] px-2 py-0.5",
  lg: "text-xs px-2.5 py-1",
};

/** Pill for newly discovered, not-yet-CORE-ranked venues. */
export default function EmergingBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span
      title="Newly announced venue, not yet ranked by CORE"
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wide whitespace-nowrap bg-sky-100/90 text-sky-950 ring-1 ring-sky-300/80 dark:bg-sky-950/70 dark:text-sky-200 dark:ring-sky-700/60 ${sizeCls[size]}`}
    >
      Emerging
    </span>
  );
}
