import type { NextConfig } from "next";

const isGHPages = process.env.GITHUB_ACTIONS === "true";
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "conf-rank";
const isUserPages = repo.endsWith(".github.io");
const basePath = isGHPages && !isUserPages ? `/${repo}` : "";

const nextConfig: NextConfig = {
  // `output: export` is only valid at build time; keep it on so `npm run build`
  // produces static files, but disable basePath during `next dev` so local URLs
  // work at the root.
  output: "export",
  trailingSlash: true,
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
