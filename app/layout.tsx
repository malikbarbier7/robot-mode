import type { Metadata } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans, Russo_One, VT323 } from "next/font/google"
import "./globals.css"

// No serif anywhere: the machine is set in a technical mono, its screens in a
// bitmap terminal face, and its printouts in a plain grotesk.
const display = IBM_Plex_Mono({ variable: "--font-display-ui", subsets: ["latin"], weight: ["500", "600"] })
const crt = VT323({ variable: "--font-crt-ui", subsets: ["latin"], weight: "400" })
const sans = IBM_Plex_Sans({ variable: "--font-sans-ui", subsets: ["latin"], weight: ["400", "500", "600"] })
const mono = IBM_Plex_Mono({ variable: "--font-mono-ui", subsets: ["latin"], weight: ["400", "500"] })
// The nameplate only: a Soviet-poster face, with Cyrillic for its lookalike letters.
const logo = Russo_One({ variable: "--font-logo-ui", subsets: ["latin", "cyrillic"], weight: "400" })

export const metadata: Metadata = {
  title: "Robot Mode",
  description: "Tell Robot Mode what you want to do. It figures out when.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${crt.variable} ${sans.variable} ${mono.variable} ${logo.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
