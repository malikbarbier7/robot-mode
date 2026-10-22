import type { Metadata } from "next"
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site"
import { Landing } from "@/components/Landing"
import { generate } from "@/lib/scheduler"
import { SAMPLE, sampleConflict } from "@/lib/sample"
import { FAQ } from "@/lib/landing"

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
}

/**
 * What the page is, for search engines: a free web application, and the
 * questions it answers. The FAQ's `typed lines` lose their backticks here.
 */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a.replace(/`/g, "") },
      })),
    },
  ],
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c") }} />
      {/* Someone who already has a week skips this page before it paints: see PASS_THROUGH in the root layout. */}
      <Landing settings={SAMPLE} schedule={generate(SAMPLE)} conflict={sampleConflict(SAMPLE)} />
    </>
  )
}
