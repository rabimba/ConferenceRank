#!/usr/bin/env python3
"""Generate blog visuals for ConferenceRank post. 1600x900, matches pro-post-wrapper palette."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

BLUE = "#4285f4"; RED = "#ea4335"; YELLOW = "#fbbc04"; GREEN = "#34a853"
INK = "#202124"; GREY = "#5f6368"; LIGHT = "#f4f8ff"; BORDER = "#d2e3fc"

plt.rcParams["font.family"] = "DejaVu Sans"

W, H = 16, 9

def new_fig():
    fig = plt.figure(figsize=(W, H), dpi=100)
    fig.patch.set_facecolor("white")
    return fig

def box(ax, x, y, w, h, color, title, sub="", title_size=13, sub_size=9.5, text_color="white"):
    p = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.012,rounding_size=0.025",
                       linewidth=0, facecolor=color, mutation_aspect=H/W)
    ax.add_patch(p)
    ax.text(x+w/2, y+h/2 + (0.035 if sub else 0), title, ha="center", va="center",
            fontsize=title_size, fontweight="bold", color=text_color)
    if sub:
        ax.text(x+w/2, y+h/2 - 0.045, sub, ha="center", va="center",
                fontsize=sub_size, color=text_color, alpha=0.92)

def arrow(ax, x1, y1, x2, y2, color=GREY, lw=2.2):
    a = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=22,
                        linewidth=lw, color=color, shrinkA=4, shrinkB=4)
    ax.add_patch(a)

# ---------------------------------------------------------------- FIG 1: pipeline
fig = new_fig()
ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")

ax.text(0.5, 0.955, "One dataset, ten public sources, zero servers",
        ha="center", fontsize=21, fontweight="bold", color=INK)
ax.text(0.5, 0.905, "ConferenceRank data pipeline — scheduled GitHub Actions run the scrapers weekly, merge, and redeploy a static site",
        ha="center", fontsize=12, color=GREY)

# sources column (left)
srcs = [
    ("CORE / ICORE portal", "987 conf detail pages + rank history", BLUE),
    ("CORE journals + ERA", "864 journal rankings", BLUE),
    ("SCImago (Scopus)", "11,782 journals across CS + 7 sciences · SJR", GREEN),
    ("Paper Copilot + lixin4ever", "per-year acceptance stats, oral/poster tiers", YELLOW),
    ("csconferences + ccf-deadlines", "multi-decade rates: SOSP, SIGMOD, STOC…", YELLOW),
    ("OpenAlex + DBLP", "topics, trends, top institutions", RED),
    ("ai/sec-deadlines", "300+ upcoming deadlines (AoE)", GREY),
]
y = 0.83
for name, sub, c in srcs:
    box(ax, 0.03, y-0.055, 0.24, 0.075, c, name, sub, title_size=10.5, sub_size=8)
    arrow(ax, 0.275, y-0.017, 0.345, 0.52, color="#b0b7bf", lw=1.6)
    y -= 0.112

# scraper layer
box(ax, 0.35, 0.42, 0.17, 0.20, INK, "Python scrapers",
    "cache-first · resume-safe\nfetch → merge.py\n7 fetch scripts + tests", title_size=13)
ax.text(0.435, 0.385, "data/raw/ cached — re-runs are cheap", ha="center", fontsize=9, color=GREY, style="italic")

# data artifacts
box(ax, 0.58, 0.42, 0.15, 0.20, BLUE, "Merged JSON",
    "conferences.json\njournals.json\ndeadlines.json", title_size=13)
arrow(ax, 0.525, 0.52, 0.575, 0.52)

# frontend
box(ax, 0.79, 0.42, 0.18, 0.20, GREEN, "Next.js static site",
    "React 19 · TypeScript\nMiniLM in WASM + TF-IDF\nRecharts · GitHub Pages", title_size=13)
arrow(ax, 0.735, 0.52, 0.785, 0.52)

# bottom band: what users get
feats = [
    "987 conferences\n800 CORE-ranked",
    "11,782 journals\ndual CORE × SJR badges",
    "105 venues w/\nacceptance history",
    "298+ deadlines\nAoE countdowns + .ics",
    "Venue suggester\nMiniLM in your browser",
    "Zero login\nlocalStorage watchlist",
]
x = 0.03
for f in feats:
    box(ax, x, 0.10, 0.15, 0.16, LIGHT, "", "", text_color=INK)
    ax.patches[-1].set_edgecolor(BORDER); ax.patches[-1].set_linewidth(1.5)
    lines = f.split("\n")
    ax.text(x+0.075, 0.205, lines[0], ha="center", fontsize=10.5, fontweight="bold", color=INK)
    ax.text(x+0.075, 0.145, lines[1], ha="center", fontsize=9, color=GREY)
    arrow(ax, x+0.075, 0.415, x+0.075, 0.27, color="#b0b7bf", lw=1.4)
    x += 0.162

fig.savefig("blogpost_assets/pipeline.png", facecolor="white")
plt.close(fig)

# ---------------------------------------------------------------- FIG 2: who it's for
fig = new_fig()
ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")

ax.text(0.5, 0.955, "The same five questions, at every career stage",
        ha="center", fontsize=21, fontweight="bold", color=INK)
ax.text(0.5, 0.905, "Where should this work go? · How hard is it to get in? · Is this venue rising or fading? · When is the deadline? · Is this journal predatory or real?",
        ha="center", fontsize=11.5, color=GREY)

cards = [
    ("PhD student,\nyear one", "Doesn't know yet that ACL ≠ a journal,\nor why 'A*' matters more than\nthe acceptance rate alone.",
     "Abstract → suggester,\nrank tiers, acceptance\ntrends by year", BLUE),
    ("Postdoc on\nthe clock", "Fellowship clocks and tenure\ntracks run on venue tiers.\nA wrong submission costs\nsix months.", "Deadline countdowns,\nwatchlist alerts,\nside-by-side compare", RED),
    ("Professor,\nmentoring", "Fifteen students, fifteen\nfields. Nobody memorizes\nevery venue's trajectory.", "Rank history across\nICORE editions, rising-\nvenue upgrades feed", YELLOW),
    ("Industry\nresearcher", "NeurIPS or a systems venue?\nDifferent prestige economy,\nsame need for evidence.", "Cross-area stats:\nsystems, theory, ML,\nsecurity, vision", GREEN),
    ("Outside CS\nentirely", "A bioinformatician or\neconomist publishing CS-\nadjacent work has no map\nat all.", "Journals directory:\nSJR quartiles, publisher,\nISSN — the predator check", INK),
]
x = 0.025
for title, pain, fix, c in cards:
    box(ax, x, 0.60, 0.185, 0.20, c, title, "", title_size=13)
    ax.text(x+0.0925, 0.55, pain, ha="center", va="top", fontsize=9.3, color=INK)
    arrow(ax, x+0.0925, 0.40, x+0.0925, 0.345, color=c, lw=2.4)
    box(ax, x, 0.16, 0.185, 0.17, LIGHT, "", "", text_color=INK)
    ax.patches[-1].set_edgecolor(c); ax.patches[-1].set_linewidth(2)
    ax.text(x+0.0925, 0.30, fix, ha="center", va="top", fontsize=9.3, color=INK, fontweight="bold")
    x += 0.196

ax.text(0.5, 0.06, "ConferenceRank puts the ranking data, the acceptance history, and the deadlines in one tab — free, static, open source.",
        ha="center", fontsize=12, color=GREY, style="italic")

fig.savefig("blogpost_assets/audience.png", facecolor="white")
plt.close(fig)
print("done")
