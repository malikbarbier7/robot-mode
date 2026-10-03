import type { Metadata } from "next"
import Link from "next/link"
import { SheetPage, Missing } from "@/components/SiteChrome"
import { HOST, PUBLISHER, SITE_NAME, SITE_URL } from "@/lib/site"

export const metadata: Metadata = {
  title: "Legal notice",
  description: `Who publishes and hosts ${SITE_NAME}.`,
  alternates: { canonical: "/legal/" },
}

/** Each field from lib/site.ts, or a visible gap while it is still empty. */
function Field({ value, what }: { value: string; what: string }) {
  return value ? <>{value}</> : <Missing what={what} />
}

/** The legal notice (in France, the "mentions légales"): who publishes the site and who hosts it. */
export default function LegalPage() {
  return (
    <SheetPage eyebrow="Legal notice" title="Who is behind the machine">
      <section>
        <h2>Publisher</h2>
        <p>
          {SITE_NAME} ({SITE_URL}) is published by <Field value={PUBLISHER.name} what="Publisher name" />,{" "}
          <Field value={PUBLISHER.address} what="Postal address" />.
          <br />
          Contact:{" "}
          {PUBLISHER.email ? <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a> : <Missing what="Contact email" />}
        </p>
        <p>
          Director of publication: <Field value={PUBLISHER.name} what="Publisher name" />.
        </p>
      </section>

      <section>
        <h2>Hosting</h2>
        <p>
          <Field value={HOST.name} what="Host name" />, <Field value={HOST.address} what="Host address" />.
        </p>
      </section>

      <section>
        <h2>Personal data</h2>
        <p>
          The site collects no personal data: what you enter stays in your browser. Details on the <Link href="/privacy/">privacy page</Link>.
        </p>
      </section>

      <section>
        <h2>Fonts</h2>
        <p>VT323, IBM Plex Sans, IBM Plex Mono and Russo One, under the SIL Open Font License.</p>
      </section>
    </SheetPage>
  )
}
