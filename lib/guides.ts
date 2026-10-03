/**
 * The guides: long-form articles on planning a week, each one leading into
 * the machine. Their text lives in app/guides/<slug>/page.tsx;
 * this is the list the index, the sitemap and the cross-links read.
 * Targets and the reasoning behind them: plans/seo-keywords.md.
 */
export type Guide = {
  slug: string
  /** The article's heading. */
  title: string
  /** The title in search results. */
  metaTitle: string
  description: string
  /** First published (YYYY-MM-DD). */
  published: string
  /** Minutes to read, rounded. */
  minutes: number
}

export const guides: Guide[] = [
  {
    slug: "how-to-plan-your-week",
    title: "How to plan your week (and stop deciding every day)",
    metaTitle: "How to plan your week effectively, and stop deciding every day",
    description:
      "A practical way to plan your week: decide once what matters, fix it in time around sleep and meals, and follow the plan instead of renegotiating it every morning. With a template that plans itself.",
    published: "2026-10-03",
    minutes: 7,
  },
  {
    slug: "time-blocking-examples",
    title: "Time blocking: real examples, and a week that blocks itself",
    metaTitle: "Time blocking examples (for work and students) + a free weekly template",
    description:
      "What time blocking is, three complete weekly examples (deep work, a 9-to-5, a student week), the mistakes that make blocks collapse, and how to build a blocked week without dragging boxes around.",
    published: "2026-10-03",
    minutes: 8,
  },
  {
    slug: "ideal-week",
    title: "How to design your ideal week",
    metaTitle: "Ideal weekly schedule: how to design your ideal week (with examples)",
    description:
      "An ideal week is a default schedule you plan against, so you stop rebuilding your week from a blank page every Sunday. How to design one in five steps, with real example weeks.",
    published: "2026-10-03",
    minutes: 7,
  },
]

export function guideBySlug(slug: string): Guide {
  const guide = guides.find((g) => g.slug === slug)
  if (!guide) throw new Error(`No guide ${slug}`)
  return guide
}
