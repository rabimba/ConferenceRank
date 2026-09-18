import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.GITHUB_ACTIONS === "true"
    ? `https://${(process.env.GITHUB_REPOSITORY ?? "rabimba/ConferenceRank").split("/")[0]}.github.io/${(process.env.GITHUB_REPOSITORY ?? "rabimba/ConferenceRank").split("/")[1]}`
    : "https://rabimba.github.io/ConferenceRank");

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
