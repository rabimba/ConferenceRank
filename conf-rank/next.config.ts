import type { NextConfig } from "next";

// Single source of truth: explicit NEXT_PUBLIC_BASE_PATH wins; otherwise derive
// from GITHUB_REPOSITORY inside Actions; else root for local dev/build.
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "conf-rank";
const isUserPages = repo.endsWith(".github.io");
const derived =
  process.env.GITHUB_ACTIONS === "true" && !isUserPages ? `/${repo}` : "";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? derived;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true }, // static export: no server-side image optimizer
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
