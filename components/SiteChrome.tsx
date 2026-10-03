"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useWords } from "@/lib/words"
import { PUBLISHER } from "@/lib/site"
import { Lamp } from "./Machine"

/**
 * Where Build my week goes: the machine, already switched on, at its first
 * question. A full load, not a client-side hop: the app reads the flag from the
 * address as it starts.
 */
export const START = "/app/?start"

/** The machine's panel, as in the app, with the one key that matters always in reach. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b-2 border-ink bg-[#cdc5b1] px-3 py-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] sm:px-6 sm:py-2.5">
      <div className="flex items-center gap-6">
        <Nameplate />
        <span className="label hidden items-center gap-1.5 text-ink/70 sm:flex">
          <Lamp /> Power
        </span>
      </div>
      <a href={START} className="key key-dark px-3 py-1.5">
        Build my week ▶
      </a>
    </header>
  )
}

/** The nameplate, screws and all. */
function Nameplate() {
  const words = useWords()
  return (
    <Link href="/?home" className="relative flex items-baseline gap-4 border-2 border-ink bg-paper px-3 py-1 sm:px-4 sm:py-1.5">
      {["left-1 top-1", "right-1 top-1", "left-1 bottom-1", "right-1 bottom-1"].map((at) => (
        <span key={at} aria-hidden className={`absolute h-1 w-1 rounded-full bg-ink/50 ${at}`} />
      ))}
      <span className="font-logo text-[17px] uppercase leading-none tracking-[0.18em] sm:text-[22px]">
        <span aria-hidden>{words.logo}</span>
        <span className="sr-only">{words.name}</span>
      </span>
      <span className="label hidden text-ink/70 sm:inline">{words.model}</span>
    </Link>
  )
}

/** The plate along the bottom: what the machine is, and the pages every site owes its visitors. */
export function SiteFooter() {
  const words = useWords()
  return (
    <footer className="label flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-ink/40 px-4 py-3 text-ink/70 sm:px-6">
      <span>
        {words.model} · {words.boot.subtitle}
      </span>
      <nav aria-label="About this site" className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <Link href="/guides/" className="hover:text-ink hover:underline">
          Guides
        </Link>
        <Link href="/privacy/" className="hover:text-ink hover:underline">
          Privacy
        </Link>
        <Link href="/legal/" className="hover:text-ink hover:underline">
          Legal notice
        </Link>
        {PUBLISHER.email && (
          <a href={`mailto:${PUBLISHER.email}?subject=Robot%20Mode`} className="hover:text-ink hover:underline">
            Feedback
          </a>
        )}
        <span className="text-ink/70">Rev. 2.7</span>
      </nav>
    </footer>
  )
}

/** A plain page of the site (privacy, legal notice): the panel, a printed sheet to read, the footer. */
export function SheetPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 px-3 py-8 sm:px-6 sm:py-14">
        <article className="sheet mx-auto max-w-[760px] px-8 py-10 font-mono text-[14px] leading-relaxed sm:px-16 sm:py-14">
          <p className="label text-ink/70">{eyebrow}</p>
          <h1 className="mt-2 font-display text-[26px] font-semibold uppercase tracking-[0.08em] sm:text-[32px]">{title}</h1>
          {updated && <p className="label mt-2 text-ink/70">Last updated {updated}</p>}
          <div className="mt-8 space-y-6 [&_h2]:font-display [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_p]:text-ink/85 [&_a]:underline">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}

/** A field of the legal notice that has not been filled in yet, shown as missing rather than left blank. */
export function Missing({ what }: { what: string }) {
  return <span className="bg-alert px-1 text-sheet">[{what}: to fill in before publishing]</span>
}
