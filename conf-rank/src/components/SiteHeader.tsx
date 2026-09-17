import Link from "next/link";
import VenueLookup from "./VenueLookup";
import ThemeToggle from "./ThemeToggle";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur
                       dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 whitespace-nowrap">
          <span className="grid size-8 place-items-center rounded-lg bg-neutral-900 text-sm font-black text-white
                           dark:bg-white dark:text-neutral-900">
            CR
          </span>
          <span className="hidden text-sm font-bold tracking-tight text-neutral-900 sm:block
                           dark:text-neutral-100">
            ConferenceRank
          </span>
        </Link>
        <div className="flex flex-1 justify-center">
          <VenueLookup />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/suggest/"
            className="hidden items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 sm:inline-flex dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 transition"
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
