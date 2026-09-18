import fs from "fs";
import path from "path";
import { suggestVenues, type SuggesterVenue } from "../conf-rank/src/lib/suggest";

interface EvalItem {
  venue_id: string;
  venue_acronym: string;
  venue_title: string;
  venue_rank: string;
  paper_title: string;
  abstract: string;
  word_count: number;
}

const EVAL_PATH = path.join(__dirname, "data", "eval_abstracts.json");
const QUERY_EMB_PATH = path.join(__dirname, "data", "eval_query_embeddings.json");
const VENUE_EMB_PATH = path.join(__dirname, "../conf-rank/public/venue-embeddings.json");
const CONFS_PATH = path.join(__dirname, "../conf-rank/src/data/conferences.json");

function evaluate(
  name: string,
  evalData: EvalItem[],
  venues: SuggesterVenue[],
  getEmbeddingScores?: (index: number) => Map<string, number>
) {
  let top1 = 0;
  let top5 = 0;
  let top10 = 0;
  let reciprocalRankSum = 0;
  const n = evalData.length;

  for (let i = 0; i < n; i++) {
    const item = evalData[i];
    const embeddingScores = getEmbeddingScores ? getEmbeddingScores(i) : undefined;

    const res = suggestVenues(item.abstract, venues, {
      ambition: "all",
      topN: 30,
      includeUnranked: true,
      embeddingScores,
    });

    const suggestions = res.suggestions;
    const targetId = String(item.venue_id);
    const targetAcr = item.venue_acronym.toLowerCase();

    let foundIndex = -1;
    for (let sIdx = 0; sIdx < suggestions.length; sIdx++) {
      const v = suggestions[sIdx].venue;
      if (String(v.id) === targetId || (targetAcr && v.acronym.toLowerCase() === targetAcr)) {
        foundIndex = sIdx;
        break;
      }
    }

    const rankPos = foundIndex >= 0 ? foundIndex + 1 : null;
    if (rankPos !== null) {
      if (rankPos === 1) top1++;
      if (rankPos <= 5) top5++;
      if (rankPos <= 10) top10++;
      reciprocalRankSum += 1 / rankPos;
    }
  }

  const r1 = (top1 / n) * 100;
  const r5 = (top5 / n) * 100;
  const r10 = (top10 / n) * 100;
  const mrr = reciprocalRankSum / n;

  console.log(`\n=========================================`);
  console.log(`  EVALUATION: ${name.toUpperCase()}`);
  console.log(`=========================================`);
  console.log(`Papers evaluated: ${n}`);
  console.log(`Recall@1:  ${top1}/${n} (${r1.toFixed(1)}%)`);
  console.log(`Recall@5:  ${top5}/${n} (${r5.toFixed(1)}%)`);
  console.log(`Recall@10: ${top10}/${n} (${r10.toFixed(1)}%)`);
  console.log(`MRR:       ${mrr.toFixed(3)}`);
  console.log(`=========================================\n`);
}

function main() {
  const evalData: EvalItem[] = JSON.parse(fs.readFileSync(EVAL_PATH, "utf8"));
  const rawConfs = JSON.parse(fs.readFileSync(CONFS_PATH, "utf8"));
  const venueEmbs = JSON.parse(fs.readFileSync(VENUE_EMB_PATH, "utf8"));
  const queryVectors: number[][] = JSON.parse(fs.readFileSync(QUERY_EMB_PATH, "utf8"));

  const venues: SuggesterVenue[] = rawConfs.map((c: any) => ({
    id: String(c.id),
    acronym: c.acronym ?? "",
    title: c.title ?? "",
    rank: c.rank ?? "Unranked",
    categories: c.categories ?? [],
    latest_rate: c.stats?.latest_rate ?? null,
    latest_accepted: c.stats?.latest_accepted ?? null,
    has_stats: Boolean(c.stats),
    topics: c.openalex?.topics?.map((t: any) => t.name) ?? [],
  }));

  // Dequantize venue embeddings for evaluation
  const dims = venueEmbs.dims || 384;
  const venueIds = Object.keys(venueEmbs.vectors);
  const totalVenues = venueIds.length;
  const matrix = new Float32Array(totalVenues * dims);

  for (let i = 0; i < totalVenues; i++) {
    const vid = venueIds[i];
    const { s, q } = venueEmbs.vectors[vid];
    const offset = i * dims;
    let sumSq = 0;
    for (let d = 0; d < dims; d++) {
      const val = (q[d] * s) / 127.0;
      matrix[offset + d] = val;
      sumSq += val * val;
    }
    const norm = Math.sqrt(sumSq) || 1.0;
    for (let d = 0; d < dims; d++) {
      matrix[offset + d] /= norm;
    }
  }

  function getEmbeddingScores(queryIndex: number): Map<string, number> {
    const qVec = queryVectors[queryIndex];
    const scores = new Map<string, number>();
    for (let i = 0; i < totalVenues; i++) {
      const offset = i * dims;
      let dot = 0;
      for (let d = 0; d < dims; d++) {
        dot += qVec[d] * matrix[offset + d];
      }
      scores.set(venueIds[i], dot);
    }
    return scores;
  }

  // 1. Run baseline (pure lexicon + TF-IDF)
  evaluate("Baseline (Lexicon + TF-IDF only)", evalData, venues);

  // 2. Run new hybrid model (Neural embeddings + Lexicon + TF-IDF)
  evaluate("Hybrid (Neural Embeddings + Lexicon + TF-IDF)", evalData, venues, getEmbeddingScores);
}

main();
