import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter, SiteHeader, START } from "@/components/SiteChrome"

export const metadata: Metadata = { title: "No such page" }

/** A wrong address: the machine's screen says so, and offers the way back. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center px-3 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-[900px]">
          <div className="crt px-6 py-12 text-center font-crt uppercase sm:px-12 sm:py-20">
            <p className="text-[22px] tracking-[0.2em] text-ink/70">Error 404</p>
            <h1 className="mt-4 text-[48px] leading-none tracking-[0.04em] sm:text-[72px]">No such page.</h1>
            <p className="mt-6 text-[22px] tracking-[0.1em] text-ink/80">The machine looked everywhere. It isn&rsquo;t here.</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[26px] tracking-[0.12em]">
              <Link href="/?home" className="hover:bg-ink/15">
                <span className="text-ink/70">[ </span>Front page<span className="text-ink/70"> ]</span>
              </Link>
              <a href={START} className="bg-ink px-4 text-paper [text-shadow:none] hover:bg-[#ffc560]">
                Build my week ▶
              </a>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
