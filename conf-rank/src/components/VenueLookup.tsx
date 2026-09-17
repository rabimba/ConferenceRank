"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchEntry {
  id: string;
  acronym: string;
  title: string;
  rank: string;
}

type LoadState = "idle" | "loading" | "ok" | "error";

let cachedIndex: SearchEntry[] | null = null;
let fetchPromise: Promise<SearchEntry[]> | null = null;

function loadIndex(): Promise<SearchEntry[]> {
  if (cachedIndex) return Promise.resolve(cachedIndex);
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/search-index.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((d: SearchEntry[]) => {
      cachedIndex = d;
      return d;
    })
    .catch((e) => {
      fetchPromise = null;
      throw e;
    });
  return fetchPromise;
}

export default function VenueLookup() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<SearchEntry[]>(cachedIndex ?? []);
  const [loadState, setLoadState] = useState<LoadState>(cachedIndex ? "ok" : "idle");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();

  // debounce query input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
    }, 150);
    return () => clearTimeout(handler);
  }, [q]);

  const ensureIndex = () => {
    if (cachedIndex || loadState === "loading") return;
    setLoadState("loading");
    loadIndex()
      .then((d) => {
        setIndex(d);
        setLoadState("ok");
      })
      .catch(() => setLoadState("error"));
  };

  // lazy load after mount (microtask defers setState out of the effect body)
  useEffect(() => {
    if (cachedIndex) return;
    const t = setTimeout(ensureIndex, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const listboxId = "venue-lookup-listbox";

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={
          open && results[active] ? `${listboxId}-option-${results[active].id}` : undefined
        }
        aria-autocomplete="list"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => {
          ensureIndex();
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
        className="w-full rounded-lg border border-stone-300 bg-surface px-4 py-2 text-sm
                   text-foreground placeholder:text-muted
                   focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent
                   dark:border-stone-700 dark:placeholder:text-muted"
        aria-label="Look up a venue"
      />
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Matching venues"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border
                     border-stone-200 bg-surface py-1 shadow-lg
                     dark:border-stone-800"
        >
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`${listboxId}-option-${c.id}`}
              role="option"
              aria-selected={i === active}
            >
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(c)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm
                            ${i === active ? "bg-stone-100 dark:bg-stone-800" : ""}`}
              >
                <span className="font-semibold text-foreground">
                  {c.acronym || c.title.slice(0, 12)}
                </span>
                <span className="truncate text-muted">
                  {c.title}
                </span>
                {c.rank && (
                  <span className="ml-auto text-[11px] font-bold text-muted">
                    {c.rank}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && q && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-stone-200
                        bg-surface px-4 py-3 text-sm text-muted shadow-lg
                        dark:border-stone-800">
          {loadState === "error" ? (
            <span>
              Venue index failed to load.{" "}
              <button
                className="underline hover:text-foreground"
                onClick={() => {
                  setLoadState("idle");
                  ensureIndex();
                }}
              >
                Retry
              </button>
            </span>
          ) : loadState !== "ok" ? (
            "Loading venue index…"
          ) : (
            `No venues match “${q}”`
          )}
        </div>
      )}
    </div>
  );
}
