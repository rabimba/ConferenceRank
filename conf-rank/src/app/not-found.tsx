import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="text-center">
        <p className="text-6xl font-black text-neutral-200 dark:text-neutral-800">404</p>
        <h1 className="mt-2 text-lg font-bold text-neutral-900 dark:text-neutral-100">
          Venue not found
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          It may not be in the ICORE/CORE rankings database.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white
                     hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Browse all venues
        </Link>
      </div>
    </div>
  );
}
