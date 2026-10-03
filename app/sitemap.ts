import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"
import { guides } from "@/lib/guides"

// Written out at build time: the site is a static export.
export const dynamic = "force-static"

/** The pages worth finding. The machine (/app) is left out: it holds nothing until it is used. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/guides/`, changeFrequency: "monthly", priority: 0.6 },
    ...guides.map((g) => ({ url: `${SITE_URL}/guides/${g.slug}/`, lastModified: g.published, changeFrequency: "yearly" as const, priority: 0.6 })),
    { url: `${SITE_URL}/privacy/`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/`, changeFrequency: "yearly", priority: 0.1 },
  ]
}
