import type { Metadata } from "next"
import Link from "next/link"
import { SheetPage, Missing } from "@/components/SiteChrome"
import { PUBLISHER, SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: "Privacy",
  description: `${SITE_NAME} runs in your browser: your week stays on your device. No account, no cookies, nothing uploaded.`,
  alternates: { canonical: "/privacy/" },
}

export default function PrivacyPage() {
  return (
    <SheetPage eyebrow="Privacy" title="Your week stays on your device" updated="3 October 2026">
      <p>
        {SITE_NAME} has no accounts and no server of its own that stores anything. This page says exactly what is kept, where, and who can
        see it.
      </p>

      <section>
        <h2>What you enter</h2>
        <p>
          Your activities, hours, meals, the week, the paper and the binder are saved in your browser&rsquo;s own storage, on your device. They
          are never sent to us or to anyone else. Nobody but you can see them.
        </p>
        <p>
          To erase them, use RESTART on the machine (SYSTEM, then Restart terminal), or clear this site&rsquo;s data in your browser. Using
          another browser or device starts from a blank machine.
        </p>
      </section>

      <section>
        <h2>Backups and setup links</h2>
        <p>
          BACKUP downloads a file to your device; where it goes from there is up to you. A setup link carries your hours, meals and
          activities inside the link itself, after the # sign, a part of an address that browsers never send to a server. Anyone you give
          the link to can read that setup.
        </p>
      </section>

      <section>
        <h2>Visits</h2>
        <p>
          We count visits with Umami, a privacy-friendly analytics tool: no cookies, no advertising, no tracking across sites, and nothing
          that identifies you. It tells us how many people come and which pages and buttons they use, never what they type into the machine.
        </p>
        <p>
          The host that serves the site may keep standard technical logs (such as IP addresses) for security, as every web host does. The
          fonts are served from this site, not from Google.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          {PUBLISHER.email ? (
            <>
              Write to <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a>.
            </>
          ) : (
            <Missing what="Contact email" />
          )}{" "}
          Who publishes the site is on the <Link href="/legal/">legal notice</Link>.
        </p>
      </section>
    </SheetPage>
  )
}
