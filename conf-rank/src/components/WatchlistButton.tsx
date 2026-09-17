"use client";

import { useWatchlist } from "@/lib/watchlist";

export default function WatchlistButton({
  venueId,
  acronym,
  size = "md",
  showLabel = false,
  className = "",
}: {
  venueId: string;
  acronym?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  const { isSaved, toggle, hydrated } = useWatchlist();
  const saved = hydrated && isSaved(venueId);

  const iconSizes = {
    sm: "size-3.5",
    md: "size-4",
    lg: "size-5",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-xs",
    lg: "text-sm font-semibold",
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle(venueId);
      }}
      title={saved ? `Remove ${acronym || "venue"} from watchlist` : `Add ${acronym || "venue"} to target watchlist`}
      aria-label={saved ? `Remove ${acronym || "venue"} from watchlist` : `Add ${acronym || "venue"} to target watchlist`}
      aria-pressed={saved}
      className={`inline-flex items-center gap-1 rounded-md p-1 transition select-none ${
        saved
          ? "text-amber-500 hover:text-amber-600"
          : "text-muted/60 hover:text-amber-500"
      } ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={saved ? "1" : "2"}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${iconSizes[size]} transition-transform active:scale-125`}
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      {showLabel && (
        <span className={textSizes[size]}>
          {saved ? "Targeted" : "Watch"}
        </span>
      )}
    </button>
  );
}
