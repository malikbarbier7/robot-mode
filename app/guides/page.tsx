import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter, SiteHeader } from "@/components/SiteChrome"
import { guides } from "@/lib/guides"

export const metadata: Metadata = {
  title: { absolute: "Guides to planning your week · Robot Mode" },
  description: "How to plan your week, time blocking with real examples, and how to design your ideal week. Practical guides, with weeks you can open and print.",
  alternates: { canonical: "/guides/" },
}

/** Every guide, newest first. */
export default function GuidesIndex() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-[860px] px-5 py-10 sm:py-14">
          <p className="label text-ink/70">Guides</p>
          <h1 className="mt-3 font-display text-[28px] font-semibold uppercase leading-tight tracking-[0.06em] sm:text-[40px]">
            Planning your week
          </h1>
          <p className="mt-4 max-w-[40rem] text-[16px] leading-relaxed text-ink/85">
            Practical guides to deciding your week once and following it, each with real weeks you can open in the machine and print.
          </p>
          <ul className="mt-10 space-y-4">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}/`} className="block border-2 border-ink bg-paper p-5 hover:-translate-y-0.5">
                  <span className="font-display text-[18px] font-semibold uppercase leading-snug tracking-[0.05em]">{g.title}</span>
                  <span className="mt-2 block text-[15px] leading-relaxed text-ink/85">{g.description}</span>
                  <span className="label mt-3 block text-ink/70">{g.minutes} min read</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
