# Design Specification: Visual System, Ambient Gradients & Usability Polish

**Date:** 2026-09-17  
**Status:** Approved  
**Scope:** Visual Aesthetics (1) and Usability & UX (2) for ConferenceRank

---

## 1. Goal & Context
ConferenceRank was recently transitioned to a warm Sand & Terracotta color scheme (`#F5F1EA` / `#C2410C`). However:
1. `RankBadge.tsx` still uses raw, saturated Tailwind primaries (Indigo, Teal, Stone) that clash with the warm terracotta aesthetic.
2. Surfaces lack depth, ambient glow, and tactile hierarchy.
3. The category filter in `Directory.tsx` wraps 17+ pills in a chaotic cluster.
4. Active filters, search queries, and sorting are not synced to the URL, making filtered views unshareable and easily lost on refresh.
5. On mobile, table horizontal scrolling obscures venue identity (acronym and rank).

This specification resolves these issues with Approach A: Evolutionary In-Place Polish.

---

## 2. Architecture & Changes

### 2.1 Visual System & Ambient Gradients
- **Ambient Hero Glow:**
  - In `conf-rank/src/app/globals.css`, add background radial glow styling:
    - Light: `radial-gradient(ellipse 80% 50% at 50% -20%, rgba(194, 65, 12, 0.05), transparent 70%)`
    - Dark: `radial-gradient(ellipse 80% 50% at 50% -20%, rgba(251, 146, 60, 0.06), transparent 70%)`
  - Subtle card borders using `border-border` and ambient elevation `shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]`.
- **Prestige Tier Harmonization (`RankBadge.tsx`):**
  - **A*:** Warm Gilded Amber (`bg-amber-100/80 text-amber-950 ring-1 ring-amber-300/80 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-amber-700/60`).
  - **A:** Terracotta / Warm Rust (`bg-orange-100/80 text-orange-950 ring-1 ring-orange-300/80 dark:bg-orange-950/70 dark:text-orange-200 dark:ring-orange-700/60`).
  - **B:** Warm Sage / Emerald (`bg-emerald-100/70 text-emerald-950 ring-1 ring-emerald-300/70 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800/60`).
  - **C & Aus:** Warm Stone / Pebble (`bg-stone-200/60 text-stone-800 ring-1 ring-stone-300/70 dark:bg-stone-800/70 dark:text-stone-200 dark:ring-stone-700/60`).
- **Token Consistency:** Replace raw `stone-200`, `stone-300`, `stone-700`, `stone-800` borders on cards with semantic `border-border` and `bg-surface`.

### 2.2 Usability & UX System
- **Curated Category Filters:**
  - Group top primary CS domains (AI & Machine Learning, Systems, Security, Theory, Networks, Databases, Software Engineering) as prominent quick-toggles.
  - Provide a "+ More Categories (N)" toggle pill that smoothly expands the secondary domains or contracts them, keeping the initial viewport clean and uncluttered.
- **URL Parameter Synchronization:**
  - In `conf-rank/src/components/Directory.tsx`, read initial state from `useSearchParams` (`q`, `rank`, `cat`, `sort`, `dir`, `page`).
  - Update browser URL via `router.replace(..., { scroll: false })` whenever filters, sort, or pagination change.
  - Ensure component is wrapped in `<Suspense>` boundary in `HomeClient.tsx` to maintain compatibility with Next.js static generation.
- **Mobile Sticky Columns:**
  - In `conf-rank/src/components/Directory.tsx`, freeze the `Rank` and `Acronym` columns on horizontal scroll (`sticky left-0 bg-surface z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]`) so context is maintained while panning across acceptance rate and statistics columns.
- **Refined Search Input:**
  - Add quick clear (`×`) button in the search field when query is non-empty.
  - Retain keyboard navigation accessibility.

---

## 3. Files Impacted
1. `conf-rank/src/app/globals.css` — Ambient glow utilities, card elevation, token refinement.
2. `conf-rank/src/components/RankBadge.tsx` — Warm palette badge styles.
3. `conf-rank/src/components/Directory.tsx` — Curated category toggle, URL sync, sticky table columns, search UX.
4. `conf-rank/src/components/HomeClient.tsx` — Suspense wrapping for `Directory`.
5. `conf-rank/src/components/SiteHeader.tsx` — Semantic border and elevation adjustments.

---

## 4. Verification & Testing
- Next.js full static build (`npm run build` in `conf-rank`) to ensure zero type errors or SSG bailouts.
- Verify light and dark mode appearance, contrast ratios, and responsiveness across viewports.
