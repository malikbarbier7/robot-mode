import type { Metadata } from "next"

/**
 * The machine itself. It holds nothing a search engine could use (everything
 * lives in the visitor's browser), so only the landing page is indexed.
 */
export const metadata: Metadata = {
  title: "The machine",
  robots: { index: false, follow: true },
  alternates: { canonical: "/app/" },
}

export default function MachineLayout({ children }: { children: React.ReactNode }) {
  return children
}
