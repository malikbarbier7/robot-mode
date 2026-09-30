import type { Metadata } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans, VT323 } from "next/font/google"
import "./globals.css"

// No serif anywhere: the machine is set in a technical mono, its screens in a
// bitmap terminal face, and its printouts in a plain grotesk.
const display = IBM_Plex_Mono({ variable: "--font-display-ui", subsets: ["latin"], weight: ["500", "600"] })
const crt = VT323({ variable: "--font-crt-ui", subsets: ["latin"], weight: "400" })
const sans = IBM_Plex_Sans({ variable: "--font-sans-ui", subsets: ["latin"], weight: ["400", "500", "600"] })
const mono = IBM_Plex_Mono({ variable: "--font-mono-ui", subsets: ["latin"], weight: ["400", "500"] })

export const metadata: Metadata = {
  title: "Robot Mode",
  description: "Tell Robot Mode what you want to do. It figures out when.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${crt.variable} ${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
