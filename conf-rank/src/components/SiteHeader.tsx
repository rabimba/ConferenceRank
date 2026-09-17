import Link from "next/link";
import VenueLookup from "./VenueLookup";
import ThemeToggle from "./ThemeToggle";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 whitespace-nowrap">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-black text-accent-contrast">
            CR
          </span>
          <span className="hidden text-sm font-bold tracking-tight text-foreground sm:block">
            ConferenceRank
          </span>
        </Link>
        <div className="flex flex-1 justify-center">
          <VenueLookup />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/?tab=deadlines"
            className="hidden items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-foreground hover:border-accent hover:bg-accent-soft hover:text-accent sm:inline-flex dark:hover:border-accent dark:hover:bg-accent-soft dark:hover:text-accent transition"
          >
            <span>⏰</span>
            <span>Deadlines</span>
          </Link>
          <Link
            href="/suggest/"
            className="hidden items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-foreground hover:border-accent hover:bg-accent-soft hover:text-accent sm:inline-flex dark:hover:border-accent dark:hover:bg-accent-soft dark:hover:text-accent transition"
          >
            <span>✨</span>
            <span>Suggest Venue</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
