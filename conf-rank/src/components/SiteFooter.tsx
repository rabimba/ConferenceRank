export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-neutral-200 pt-6 pb-12 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-relaxed max-w-2xl">
          Data: ICORE/CORE conference rankings · csconferences · Paper Copilot ·
          lixin4ever · ccf-deadlines · OpenAlex · DBLP. Ranks © CORE (Computing Research &
          Education Assoc. of Australasia). This site is an independent view over public data;
          always verify with venue before submitting.
        </p>
        <p className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-neutral-700 dark:text-neutral-300">
          <span>Made with</span>
          <span className="text-red-500 animate-pulse inline-block" aria-label="love">
            ❤️
          </span>
          <span>by</span>
          <a
            href="https://rabimba.github.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            Rabimba
          </a>
        </p>
      </div>
    </footer>
  );
}
