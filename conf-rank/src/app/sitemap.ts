import type { MetadataRoute } from "next";
import { getConferences } from "@/lib/data";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.GITHUB_ACTIONS === "true"
    ? `https://${(process.env.GITHUB_REPOSITORY ?? "rabimba/ranking").split("/")[0]}.github.io/${(process.env.GITHUB_REPOSITORY ?? "rabimba/ranking").split("/")[1]}`
    : "http://localhost:3000");

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const venues = getConferences();
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/suggest/`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...venues.map((v) => ({
      url: `${siteUrl}/conference/${v.id}/`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
