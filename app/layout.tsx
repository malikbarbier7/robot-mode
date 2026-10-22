import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans, Russo_One, VT323 } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site"

// No serif anywhere: the machine is set in a technical mono, its screens in a
// bitmap terminal face, and its printouts in a plain grotesk. The display face
// is the mono's heavier weights, loaded once: globals.css points --font-display at it.
const crt = VT323({ variable: "--font-crt-ui", subsets: ["latin"], weight: "400" })
const sans = IBM_Plex_Sans({ variable: "--font-sans-ui", subsets: ["latin"], weight: ["400", "500", "600"] })
const mono = IBM_Plex_Mono({ variable: "--font-mono-ui", subsets: ["latin"], weight: ["400", "500", "600"] })
// The nameplate only: a Soviet-poster face, with Cyrillic for its lookalike letters.
const logo = Russo_One({ variable: "--font-logo-ui", subsets: ["latin", "cyrillic"], weight: "400" })

export const metadata: Metadata = {
  // Every relative URL below (the share image, the canonical address) is resolved against the site's address.
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en",
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
}

/** The panel's beige, for the browser's own chrome on phones. */
export const viewport: Viewport = { themeColor: "#cdc5b1" }

/**
 * Before the landing page paints: a setup link made before the machine moved
 * to /app/ is passed on to it, and someone who already has a week goes
 * straight to it (`/?home` shows the landing anyway). Only on `/`. It has to
 * live here: a script that runs before the page must sit in the root layout.
 */
const PASS_THROUGH = `try{if(location.pathname==="/"){var h=location.hash;if(h.indexOf("#setup=")===0)location.replace("/app/"+h);else if(!/[?&]home(=|&|$)/.test(location.search)){var s=JSON.parse(localStorage.getItem("robot-mode:v1")||"null");if(s&&s.generated)location.replace("/app/")}}}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${crt.variable} ${sans.variable} ${mono.variable} ${logo.variable} h-full`}>
      <body className="min-h-full">
        <Script id="pass-through" strategy="beforeInteractive">
          {PASS_THROUGH}
        </Script>
        {children}
      </body>
    </html>
  )
}
