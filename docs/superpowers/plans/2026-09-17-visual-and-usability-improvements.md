# Visual System, Ambient Gradients & Usability Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement warm visual polish (ambient gradients, tone-matched rank badges, refined card elevation) and key usability improvements (curated category filters, URL query state synchronization, and mobile sticky table columns).

**Architecture:** Update theme tokens and ambient background utilities in `globals.css`, align `RankBadge.tsx` to warm prestige tiers, re-architect category filter pills and table headers in `Directory.tsx`, and wrap directory loading with Next.js `<Suspense>` in `HomeClient.tsx`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-17-design-and-usability-improvements-design.md`

## Global Constraints
- Next.js static export compatibility: Any component reading `useSearchParams()` must be wrapped in a React `<Suspense>` boundary.
- Do not introduce external icon or UI libraries; use existing Tailwind classes and clean SVG/HTML primitives.
- Dark mode must maintain high contrast across all states.
- Always commit changes after each task.

---

### Task 1: Visual Polish — Ambient Gradients & Harmonized Rank Badges

**Files:**
- Modify: `conf-rank/src/app/globals.css`
- Modify: `conf-rank/src/components/RankBadge.tsx`

**Interfaces:**
- Consumes: Tailwind classes and CSS variables in `globals.css`
- Produces: Warm tone-matched badges for tiers `A*`, `A`, `B`, `C`, and ambient background glow.

- [ ] **Step 1: Update globals.css with ambient background glow and card elevation**

Add ambient hero glow gradient to body background:
```css
body {
  background:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(194, 65, 12, 0.04), transparent 70%),
    var(--background);
  color: var(--foreground);
}

.dark body, body:where(.dark, .dark *) {
  background:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(251, 146, 60, 0.05), transparent 70%),
    var(--background);
}
```

- [ ] **Step 2: Update RankBadge.tsx with warm prestige tiers**

Update `RANK_STYLES` in `conf-rank/src/components/RankBadge.tsx`:
```tsx
const RANK_STYLES: Record<string, { classes: string; label: string }> = {
  "A*": {
    classes:
      "bg-amber-100/90 text-amber-950 ring-1 ring-amber-300/80 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-amber-700/60",
    label: "A*",
  },
  A: {
    classes:
      "bg-orange-100/80 text-orange-950 ring-1 ring-orange-300/80 dark:bg-orange-950/70 dark:text-orange-200 dark:ring-orange-700/60",
    label: "A",
  },
  B: {
    classes:
      "bg-emerald-100/70 text-emerald-950 ring-1 ring-emerald-300/70 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800/60",
    label: "B",
  },
  C: {
    classes:
      "bg-stone-200/70 text-stone-800 ring-1 ring-stone-300/80 dark:bg-stone-800/80 dark:text-stone-200 dark:ring-stone-700/60",
    label: "C",
  },
  "Australasian B": {
    classes:
      "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60",
    label: "Aus B",
  },
  "Australasian C": {
    classes:
      "bg-stone-100 text-stone-700 ring-1 ring-stone-200 dark:bg-stone-800/50 dark:text-stone-300 dark:ring-stone-700/50",
    label: "Aus C",
  },
};
```

- [ ] **Step 3: Test build**
Run: `npm run build` in `conf-rank`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add conf-rank/src/app/globals.css conf-rank/src/components/RankBadge.tsx
git commit -m "style: harmonize rank badges to warm palette and add ambient background glow"
```

---

### Task 2: Curated Category Filtering UX

**Files:**
- Modify: `conf-rank/src/components/Directory.tsx`

**Interfaces:**
- Consumes: `ALL_CATEGORIES` list
- Produces: Primary categories pinned with "+ N more" toggle pill

- [ ] **Step 1: Define primary categories and toggle state in Directory.tsx**

Define curated top categories:
```tsx
const PRIMARY_CATEGORIES = [
  "Artificial Intelligence",
  "Computer Vision",
  "Machine Learning",
  "Security and Privacy",
  "Computer Systems",
  "Software Engineering",
  "Databases",
  "Networks",
  "Theory of Computation",
  "Human-Computer Interaction",
];
```
Add `showAllCategories` state boolean (default false), rendering primary pills + button `+ {otherCount} more categories` / `Show fewer`.

- [ ] **Step 2: Test build**
Run: `npm run build` in `conf-rank`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add conf-rank/src/components/Directory.tsx
git commit -m "feat: add curated category view with expandable toggle"
```

---

### Task 3: URL Query Parameter Synchronization

**Files:**
- Modify: `conf-rank/src/components/Directory.tsx`
- Modify: `conf-rank/src/components/HomeClient.tsx`

**Interfaces:**
- Consumes: Next.js navigation hooks (`useSearchParams`, `useRouter`, `usePathname`)
- Produces: Bidirectional state sync between URL query string (`?q=...&rank=...&cat=...&sort=...`) and Directory filters.

- [ ] **Step 1: Wrap Directory in Suspense inside HomeClient.tsx**

In `conf-rank/src/components/HomeClient.tsx`:
```tsx
import { Suspense } from "react";
// ...
<Suspense fallback={<div className="py-8 text-center text-sm text-muted">Loading directory...</div>}>
  <Directory
    venues={entries}
    onCompare={toggleCompare}
    selectedForCompare={compareIds}
  />
</Suspense>
```

- [ ] **Step 2: Implement searchParams reading and router.replace updating in Directory.tsx**

Read initial state from `useSearchParams`:
- `q`: search string
- `ranks`: comma-separated string
- `cats`: comma-separated string
- `sort`: sortKey
- `dir`: sortDir ("asc" | "desc")

Update URL query params using `window.history.replaceState` or `router.replace(newUrl, { scroll: false })` on filter changes.

- [ ] **Step 3: Test build**
Run: `npm run build` in `conf-rank`
Expected: PASS (all 995 static pages prerendered without SSG bailout)

- [ ] **Step 4: Commit**
```bash
git add conf-rank/src/components/HomeClient.tsx conf-rank/src/components/Directory.tsx
git commit -m "feat: sync search, rank, category, and sort state with URL query parameters"
```

---

### Task 4: Mobile Sticky Columns & Search Clear UX

**Files:**
- Modify: `conf-rank/src/components/Directory.tsx`

**Interfaces:**
- Consumes: Table layout and search input
- Produces: Sticky first 2 columns (Rank + Acronym) and instant clear `×` button on search input.

- [ ] **Step 1: Add sticky column CSS classes to Rank and Acronym header & body cells**

Header cells:
- Compare cell: `sticky left-0 bg-stone-50 dark:bg-stone-900 z-20`
- Rank cell: `sticky left-10 bg-stone-50 dark:bg-stone-900 z-20`
- Acronym cell: `sticky left-[88px] bg-stone-50 dark:bg-stone-900 z-20 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]`

Body cells:
- Compare cell: `sticky left-0 bg-surface z-10`
- Rank cell: `sticky left-10 bg-surface z-10`
- Acronym cell: `sticky left-[88px] bg-surface z-10 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]`

- [ ] **Step 2: Add quick clear button (`×`) to search input**

When `search.length > 0`, display inline clear button inside search field.

- [ ] **Step 3: Test build and visual layout**
Run: `npm run build` in `conf-rank`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add conf-rank/src/components/Directory.tsx
git commit -m "feat: add sticky table columns for mobile and search clear button"
```

---

### Task 5: End-to-End Build & Visual Verification

**Files:**
- Check all modified files

- [ ] **Step 1: Run production build and lint**
Run: `npm run build` in `conf-rank`
Expected: 0 errors, 995/995 pages built successfully.

- [ ] **Step 2: Verify git status and log**
Confirm git working directory is clean and commits follow repository conventions.
