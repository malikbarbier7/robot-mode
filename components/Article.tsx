import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { SiteFooter, SiteHeader, START } from "./SiteChrome"
import { PlottedWeek } from "./SampleSheets"
import { generate } from "@/lib/scheduler"
import { guides, type Guide } from "@/lib/guides"
import { PUBLISHER, SITE_NAME, SITE_URL } from "@/lib/site"
import { templates } from "@/lib/templates"

/** Search and preview metadata for a guide. */
export function guideMetadata(guide: Guide): Metadata {
  return {
    title: { absolute: guide.metaTitle },
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}/` },
    openGraph: { type: "article", title: guide.metaTitle, description: guide.description, url: `/guides/${guide.slug}/`, publishedTime: guide.published },
  }
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

/**
 * A guide, laid out for reading: the panel, a single column of plain text in
 * the printouts' grotesk (the machine's mono is kept for labels and lines to
 * type), the way into the machine at the end, and the other guides. Carries
 * the article's structured data for search engines.
 */
export function Article({ guide, children }: { guide: Guide; children: ReactNode }) {
  const others = guides.filter((g) => g.slug !== guide.slug)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.published,
    dateModified: guide.published,
    mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}/`,
    image: `${SITE_URL}/opengraph-image`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    ...(PUBLISHER.name ? { author: { "@type": "Person", name: PUBLISHER.name } } : { author: { "@type": "Organization", name: SITE_NAME } }),
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-[720px] px-5 py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="label text-ink/70">
            <Link href="/guides/" className="hover:text-ink hover:underline">
              Guides
            </Link>
          </nav>
          <h1 className="mt-3 font-display text-[28px] font-semibold uppercase leading-tight tracking-[0.05em] sm:text-[38px]">{guide.title}</h1>
          <p className="label mt-4 text-ink/70">
            {DATE.format(new Date(guide.published))} · {guide.minutes} min read
          </p>
          <div className="prose-machine mt-8">{children}</div>
        </article>

        <section className="border-t-2 border-ink bg-[#cdc5b1]">
          <div className="mx-auto w-full max-w-[720px] px-5 py-12">
            <h2 className="font-display text-[20px] font-semibold uppercase tracking-[0.06em]">Keep reading</h2>
            <ul className="mt-5 space-y-3">
              {others.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}/`} className="block border border-ink/40 bg-paper px-4 py-3 hover:border-ink">
                    <span className="font-display text-[15px] font-semibold uppercase tracking-[0.05em]">{g.title}</span>
                    <span className="mt-1 block text-[14px] text-ink/80">{g.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

/** A line typed at the machine's keyboard, as it shows in the readout. */
export function Typed({ children }: { children: string }) {
  return (
    <span className="crt my-1 block px-3 py-1.5 font-crt text-[20px] uppercase not-italic" style={{ borderWidth: 4 }}>
      <span className="text-ink/70">&gt; </span>
      {children}
    </span>
  )
}

/** A whole week from one of the machine's ready-made weeks, solved by the real engine at build time. */
export function ExampleWeek({ templateId, caption }: { templateId: string; caption: string }) {
  const template = templates.find((t) => t.id === templateId)
  if (!template) throw new Error(`No template ${templateId}`)
  return (
    <figure className="not-prose my-8 -mx-5 sm:mx-0">
      <PlottedWeek settings={template.settings} schedule={generate(template.settings)} label={template.name} />
      <figcaption className="mt-3 px-5 text-[14px] leading-relaxed text-ink/80 sm:px-0">
        {caption}
      </figcaption>
    </figure>
  )
}

/** The way into the machine, at the end of a guide. */
export function TryIt({ children }: { children: ReactNode }) {
  return (
    <aside className="not-prose my-10 border-2 border-ink bg-paper p-6">
      <p className="text-[16px] leading-relaxed text-ink/90">{children}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href={START} className="key key-dark px-5 py-2.5 text-[13px]!">
          Build my week ▶
        </a>
      </div>
      <p className="label mt-4 text-ink/75">Free · No AI · Private</p>
    </aside>
  )
}
