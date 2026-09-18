/**
 * Client-side index for precomputed venue embeddings.
 * Dequantizes int8 vectors to Float32Array and performs sub-millisecond
 * batch cosine similarity dot products against abstract query vectors.
 */

export interface VenueEmbeddingPayload {
  model: string;
  dims: number;
  vectors: Record<string, { s: number; q: number[] }>;
}

export interface VenueEmbeddingIndex {
  dims: number;
  venueCount: number;
  computeSimilarity(queryVec: Float32Array): Map<string, number>;
}

let cachedIndex: VenueEmbeddingIndex | null = null;
let loadingPromise: Promise<VenueEmbeddingIndex | null> | null = null;

export async function getVenueEmbeddingIndex(): Promise<VenueEmbeddingIndex | null> {
  if (cachedIndex) return cachedIndex;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const res = await fetch(`${basePath}/venue-embeddings.json`);
      if (!res.ok) {
        console.warn(`Failed to fetch venue-embeddings.json: ${res.status}`);
        return null;
      }
      const data: VenueEmbeddingPayload = await res.json();
      const dims = data.dims || 384;
      const venueIds = Object.keys(data.vectors);
      const totalVenues = venueIds.length;

      // Pack dequantized vectors into a single contiguous Float32Array
      const matrix = new Float32Array(totalVenues * dims);
      const idToIndex = new Map<string, number>();

      for (let i = 0; i < totalVenues; i++) {
        const vid = venueIds[i];
        idToIndex.set(vid, i);
        const { s, q } = data.vectors[vid];
        const offset = i * dims;
        let sumSq = 0;
        for (let d = 0; d < dims; d++) {
          const val = (q[d] * s) / 127.0;
          matrix[offset + d] = val;
          sumSq += val * val;
        }
        // Normalize vector to unit length
        const norm = Math.sqrt(sumSq) || 1.0;
        for (let d = 0; d < dims; d++) {
          matrix[offset + d] /= norm;
        }
      }

      cachedIndex = {
        dims,
        venueCount: totalVenues,
        computeSimilarity(queryVec: Float32Array): Map<string, number> {
          const results = new Map<string, number>();
          if (queryVec.length !== dims) return results;

          // Normalize query vector
          let qSumSq = 0;
          for (let d = 0; d < dims; d++) {
            qSumSq += queryVec[d] * queryVec[d];
          }
          const qNorm = Math.sqrt(qSumSq) || 1.0;

          for (let i = 0; i < totalVenues; i++) {
            const offset = i * dims;
            let dot = 0;
            for (let d = 0; d < dims; d++) {
              dot += (queryVec[d] / qNorm) * matrix[offset + d];
            }
            results.set(venueIds[i], dot);
          }
          return results;
        },
      };

      return cachedIndex;
    } catch (err) {
      console.error("Error loading venue embedding index:", err);
      return null;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}
