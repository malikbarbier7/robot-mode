import type { Metadata } from "next"
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site"
import { Landing } from "@/components/Landing"
import { generate } from "@/lib/scheduler"
import { SAMPLE, sampleConflict } from "@/lib/sample"

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
}

export default function Home() {
  return (
    // Someone who already has a week skips this page before it paints: see PASS_THROUGH in the root layout.
    <Landing settings={SAMPLE} schedule={generate(SAMPLE)} conflict={sampleConflict(SAMPLE)} />
  )
}
