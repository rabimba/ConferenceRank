/**
 * Lightweight TF-IDF cosine similarity over venue documents.
 * Captures token overlap beyond the hand-curated lexicon (stems, bigrams,
 * rare terms like "differential" or "quantization"). Zero dependencies.
 */

import { ENGLISH_STOPWORDS } from "./lexicon";

function stem(w: string): string {
  // cheap suffix stripping for morphology ("networks"->"network", "learning"->"learn")
  return w
    .replace(/(ations?|ation)$/i, "ate")
    .replace(/(ing|ers?|ies|es|s)$/i, (m) => (m === "ies" ? "y" : ""));
}

export function docTokens(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !ENGLISH_STOPWORDS.has(w))
    .map(stem);
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return [...words, ...bigrams];
}

export interface TfidfIndex {
  idf: Map<string, number>;
  docs: Map<string, { tf: Map<string, number>; norm: number }>;
}

export function buildTfidfIndex(docs: { id: string; text: string }[]): TfidfIndex {
  const df = new Map<string, number>();
  const raw = docs.map(({ id, text }) => {
    const tf = new Map<string, number>();
    for (const t of docTokens(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return { id, tf };
  });
  const n = docs.length || 1;
  const idf = new Map<string, number>();
  for (const [t, c] of df) idf.set(t, Math.log(1 + n / c));
  const out = new Map<string, { tf: Map<string, number>; norm: number }>();
  for (const { id, tf } of raw) {
    let norm = 0;
    for (const [t, c] of tf) {
      const w = c * (idf.get(t) ?? 0);
      norm += w * w;
    }
    out.set(id, { tf, norm: Math.sqrt(norm) || 1 });
  }
  return { idf, docs: out };
}

/** Cosine similarity of query text against indexed doc; 0..1 */
export function similarity(index: TfidfIndex, docId: string, queryText: string): number {
  const doc = index.docs.get(docId);
  if (!doc) return 0;
  let dot = 0;
  let qnorm = 0;
  const qtf = new Map<string, number>();
  for (const t of docTokens(queryText)) qtf.set(t, (qtf.get(t) ?? 0) + 1);
  for (const [t, qc] of qtf) {
    const w = qc * (index.idf.get(t) ?? Math.log(1 + index.docs.size));
    qnorm += w * w;
    const dc = doc.tf.get(t);
    if (dc) dot += w * dc * (index.idf.get(t) ?? 0);
  }
  qnorm = Math.sqrt(qnorm) || 1;
  return dot / (qnorm * doc.norm);
}
