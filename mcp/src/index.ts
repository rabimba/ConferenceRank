#!/usr/bin/env node
/**
 * conferencerank-mcp — stdio MCP server exposing the ConferenceRank dataset
 * (CS conference/journal ranks, acceptance rates, deadlines) as agent tools.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  ALL_CATEGORIES,
  acceptanceStats,
  compareVenues,
  getVenue,
  refreshStamp,
  searchVenues,
  suggestForAbstract,
  upcomingDeadlines,
} from "./venues.js";

const server = new McpServer({
  name: "conferencerank",
  version: "0.1.0",
});

const ranksSchema = z
  .array(z.enum(["A*", "A", "B", "C", "Australasian B", "Australasian C", "National", "Unranked", "Q1", "Q2", "Q3", "Q4"]))
  .optional()
  .describe("Filter by CORE rank (A*/A/B/C) and/or SJR quartile (Q1-Q4). Empty = all tiers.");

const categoriesSchema = z
  .array(z.string())
  .optional()
  .describe(`Filter by discipline. Known values include: ${ALL_CATEGORIES.slice(0, 14).join("; ")}; plus pure sciences (Mathematics, Physics & Astronomy, Chemistry, Materials Science, Biochemistry/Genetics/Molecular Biology, Neuroscience, Earth & Planetary Sciences).`);

server.registerTool(
  "search_venues",
  {
    title: "Search venues",
    description:
      "Search 987 CS conferences + 11,782 journals by title/acronym/publisher/ISSN, with optional rank and discipline filters. Returns summaries with rank, acceptance rate, and upcoming deadlines.",
    inputSchema: {
      query: z.string().describe("Free-text: title, acronym (e.g. 'SOSP', 'TPAMI'), publisher, or ISSN"),
      type: z.enum(["all", "conference", "journal"]).optional().describe("Venue kind; default all"),
      ranks: ranksSchema,
      categories: categoriesSchema,
      limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
    },
  },
  async (args) => {
    const result = await searchVenues(args);
    await refreshStamp();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_venue",
  {
    title: "Get venue details",
    description:
      "Full record for one venue by id: rank history across CORE editions, per-year acceptance stats, SJR/H-index history back to 1999 (journals), deadlines, OpenAlex topics and top institutions.",
    inputSchema: {
      id: z.string().describe("Venue id (numeric string for conferences, slug for journals — use search_venues to find ids)"),
    },
  },
  async ({ id }) => {
    const result = await getVenue(id);
    await refreshStamp();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "compare_venues",
  {
    title: "Compare venues side-by-side",
    description: "Side-by-side comparison of up to ~6 venues: ranks, acceptance rates, SJR, deadlines, history.",
    inputSchema: {
      ids: z.array(z.string()).min(2).max(10).describe("Venue ids to compare"),
    },
  },
  async ({ ids }) => {
    const result = await compareVenues(ids);
    await refreshStamp();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "suggest_venues",
  {
    title: "Suggest venues for an abstract",
    description:
      "Given a paper title+abstract, suggest target conferences/journals using the same TF-IDF + category-lexicon scoring as the ConferenceRank website. Returns ranked venues with match reasons and stretch/target/safe tiering.",
    inputSchema: {
      abstract: z.string().min(50).describe("Paper title + abstract text (≥ ~35 words for meaningful results)"),
      type: z.enum(["all", "conference", "journal"]).optional().describe("Restrict to conferences or journals; default all"),
      ambition: z.enum(["all", "stretch", "target", "safe"]).optional().describe("Risk profile: stretch = highly selective, safe = accessible; default all"),
      topN: z.number().int().min(1).max(30).optional().describe("Number of suggestions (default 12)"),
    },
  },
  async (args) => {
    const result = await suggestForAbstract(args);
    await refreshStamp();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "upcoming_deadlines",
  {
    title: "Upcoming submission deadlines",
    description:
      "Deadlines within a forward window (default 60 days), AoE-normalized, with CFP links. deadlineType=abstract surfaces abstract-registration cutoffs (missing one usually disqualifies the paper).",
    inputSchema: {
      windowDays: z.number().int().min(1).max(730).optional().describe("Forward window in days (default 60)"),
      ranks: ranksSchema,
      categories: categoriesSchema,
      deadlineType: z.enum(["paper", "abstract"]).optional().describe("paper (default) or abstract-registration deadlines"),
    },
  },
  async (args) => {
    const result = await upcomingDeadlines(args);
    await refreshStamp();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "acceptance_stats",
  {
    title: "Acceptance-rate history",
    description: "Full per-year acceptance history (accepted/submitted/rate) for one conference.",
    inputSchema: {
      id: z.string().describe("Conference id (numeric string)"),
    },
  },
  async ({ id }) => {
    const result = await acceptanceStats(id);
    await refreshStamp();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("conferencerank-mcp running on stdio");
