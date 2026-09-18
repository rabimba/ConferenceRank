/**
 * Client-side browser embedding inference using transformers.js (ONNX + WASM).
 * Runs Xenova/all-MiniLM-L6-v2 locally in the browser with fallback to CDN/Hub.
 */

export type EmbedderStatus = "idle" | "loading" | "ready" | "error";

export interface EmbedderState {
  status: EmbedderStatus;
  progress: number; // 0..100
  statusText: string;
  error?: string;
}

type ProgressCallback = (state: EmbedderState) => void;

interface FeatureExtractorOutput {
  data: Float32Array | number[];
  dims: number[];
}

type FeatureExtractor = (
  text: string,
  options?: { pooling?: "mean" | "none" | "cls"; normalize?: boolean }
) => Promise<FeatureExtractorOutput>;

interface TransformersEnv {
  allowLocalModels: boolean;
  allowRemoteModels: boolean;
  localModelPath: string;
}

interface TransformersModule {
  pipeline: (
    task: string,
    model: string,
    options?: { dtype?: string; progress_callback?: (p: { status: string; progress?: number }) => void }
  ) => Promise<FeatureExtractor>;
  env: TransformersEnv;
}

let embedderInstance: FeatureExtractor | null = null;
let pipelinePromise: Promise<FeatureExtractor> | null = null;
let currentState: EmbedderState = {
  status: "idle",
  progress: 0,
  statusText: "Semantic model ready to load",
};

const listeners = new Set<ProgressCallback>();

export function getEmbedderState(): EmbedderState {
  return currentState;
}

export function subscribeEmbedderState(cb: ProgressCallback): () => void {
  listeners.add(cb);
  cb(currentState);
  return () => {
    listeners.delete(cb);
  };
}

function updateState(next: Partial<EmbedderState>) {
  currentState = { ...currentState, ...next };
  listeners.forEach((cb) => {
    try {
      cb(currentState);
    } catch (e) {
      console.error("Error in embedder state listener", e);
    }
  });
}

/**
 * Initializes the transformers.js feature extraction pipeline.
 */
export async function initEmbedder(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (embedderInstance) return true;
  if (pipelinePromise) return pipelinePromise.then(() => true).catch(() => false);

  updateState({ status: "loading", progress: 5, statusText: "Loading neural embedding engine…" });

  pipelinePromise = (async () => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    let transformersModule: TransformersModule;

    // 1. Try local vendor bundle first, then fallback to CDN
    const dynamicImport = new Function("url", "return import(url)");
    try {
      transformersModule = (await dynamicImport(`${basePath}/vendor/transformers.js`)) as TransformersModule;
    } catch (localErr) {
      console.warn("Local transformers vendor load failed, trying CDN fallback:", localErr);
      try {
        transformersModule = (await dynamicImport(
          "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.js"
        )) as TransformersModule;
      } catch (cdnErr) {
        throw new Error(`Failed to load transformers.js from local and CDN: ${cdnErr}`);
      }
    }

    const { pipeline, env } = transformersModule;

    // Configure model resolution paths
    if (env) {
      env.allowLocalModels = true;
      env.allowRemoteModels = true;
      env.localModelPath = `${window.location.origin}${basePath}/models/`;
    }

    updateState({ progress: 25, statusText: "Loading all-MiniLM-L6-v2 ONNX weights…" });

    const progressCallback = (p: { status: string; progress?: number }) => {
      if (p.status === "progress" && typeof p.progress === "number") {
        const pct = Math.min(95, Math.round(25 + p.progress * 0.7));
        updateState({
          progress: pct,
          statusText: `Downloading model weights (${Math.round(p.progress)}%)…`,
        });
      }
    };

    // Try loading self-hosted local model first, then fallback to Xenova hub
    let pipe: FeatureExtractor;
    try {
      pipe = await pipeline("feature-extraction", "all-MiniLM-L6-v2", {
        dtype: "q8",
        progress_callback: progressCallback,
      });
    } catch (localModelErr) {
      console.warn("Local model load failed, falling back to HuggingFace Hub:", localModelErr);
      pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
        dtype: "q8",
        progress_callback: progressCallback,
      });
    }

    embedderInstance = pipe;
    updateState({
      status: "ready",
      progress: 100,
      statusText: "Semantic AI matching active",
    });
    return pipe;
  })();

  try {
    await pipelinePromise;
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to initialize embedder:", err);
    updateState({
      status: "error",
      progress: 0,
      statusText: "Semantic model unavailable; using keyword fallback",
      error: message,
    });
    return false;
  } finally {
    pipelinePromise = null;
  }
}

/**
 * Encodes paper abstract into a 384-dimensional normalized Float32Array.
 */
export async function embedAbstract(text: string): Promise<Float32Array | null> {
  if (!text || text.trim().length === 0) return null;

  if (!embedderInstance) {
    const success = await initEmbedder();
    if (!success || !embedderInstance) return null;
  }

  try {
    const output = await embedderInstance(text, {
      pooling: "mean",
      normalize: true,
    });
    if (output && output.data) {
      return new Float32Array(output.data);
    }
    return null;
  } catch (err) {
    console.error("Error embedding text:", err);
    return null;
  }
}
