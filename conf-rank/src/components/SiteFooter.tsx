import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border pt-6 pb-12 text-xs text-muted">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold text-stone-700 hover:text-foreground dark:text-stone-300">
            Directory
          </Link>
          <Link href="/journals/" className="font-semibold text-stone-700 hover:text-foreground dark:text-stone-300">
            Journals
          </Link>
          <Link href="/suggest/" className="font-semibold text-accent hover:underline inline-flex items-center gap-1">
            <span>✨</span>
            <span>Venue Suggester</span>
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-relaxed max-w-2xl">
          Data: ICORE/CORE conference &amp; journal rankings · SCImago Journal Rank (SJR) · csconferences · Paper Copilot ·
          lixin4ever · ccf-deadlines · OpenAlex · DBLP. Ranks © CORE (Computing Research &amp;
          Education Assoc. of Australasia) &amp; SCImago Lab / Scopus. This site is an independent view over public data;
          always verify with venue before submitting.
        </p>
        <p className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-stone-700 dark:text-stone-300">
          <span>Made with</span>
          <span className="text-accent animate-pulse inline-block" role="img" aria-label="love">
            ❤️
          </span>
          <span>by</span>
          <a
            href="https://rabimba.github.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent hover:underline"
          >
            Rabimba
          </a>
        </p>
      </div>
    </footer>
  );
}
