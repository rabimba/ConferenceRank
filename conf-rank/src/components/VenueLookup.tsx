"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchEntry {
  id: string;
  acronym: string;
  title: string;
  rank: string;
}

let cachedIndex: SearchEntry[] | null = null;
let fetchPromise: Promise<SearchEntry[]> | null = null;

function loadIndex(): Promise<SearchEntry[]> {
  if (cachedIndex) return Promise.resolve(cachedIndex);
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/search-index.json`)
    .then((r) => r.json())
    .then((d: SearchEntry[]) => {
      cachedIndex = d;
      return d;
    })
    .catch(() => {
      fetchPromise = null;
      return [] as SearchEntry[];
    });
  return fetchPromise;
}

export default function VenueLookup() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<SearchEntry[]>(cachedIndex ?? []);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // debounce query input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
    }, 150);
    return () => clearTimeout(handler);
  }, [q]);

  // lazy load on focus / keystroke
  useEffect(() => {
    if (cachedIndex || index.length) return;
    loadIndex().then(setIndex);
  }, [index.length]);

  const results = useMemo(() => {
    const query = debouncedQ.toLowerCase().trim();
    if (!query) return [];
    const starts: SearchEntry[] = [];
    const contains: SearchEntry[] = [];
    for (const c of index) {
      const acr = c.acronym.toLowerCase();
      const title = c.title.toLowerCase();
      if (acr.startsWith(query)) starts.push(c);
      else if (acr.includes(query) || title.includes(query)) contains.push(c);
    }
    return [...starts, ...contains].slice(0, 8);
  }, [debouncedQ, index]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (c: SearchEntry) => {
    router.push(`/conference/${c.id}/`);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => {
          if (!cachedIndex && !index.length) loadIndex().then(setIndex);
          if (q) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            go(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Look up a venue… (e.g. NeurIPS, CVPR, security)"
        className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm
                   text-neutral-900 placeholder:text-neutral-500
                   focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900
                   dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100
                   dark:placeholder:text-neutral-400 dark:focus:border-neutral-400
                   dark:focus:ring-neutral-400"
        aria-label="Look up a venue"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border
                       border-neutral-200 bg-white py-1 shadow-lg
                       dark:border-neutral-700 dark:bg-neutral-900">
          {results.map((c, i) => (
            <li key={c.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(c)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm
                            ${i === active ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}
              >
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {c.acronym || c.title.slice(0, 12)}
                </span>
                <span className="truncate text-neutral-500 dark:text-neutral-400">
                  {c.title}
                </span>
                {c.rank && (
                  <span className="ml-auto text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    {c.rank}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && q && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200
                        bg-white px-4 py-3 text-sm text-neutral-500 shadow-lg
                        dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
          {index.length === 0 ? "Loading venue index…" : `No venues match “${q}”`}
        </div>
      )}
    </div>
  );
}
