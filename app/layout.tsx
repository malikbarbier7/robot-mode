import type { Metadata } from "next"
import { DM_Mono, DM_Sans, Instrument_Serif } from "next/font/google"
import "./globals.css"

const display = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400" })
const sans = DM_Sans({ variable: "--font-sans-ui", subsets: ["latin"] })
const mono = DM_Mono({ variable: "--font-mono-ui", subsets: ["latin"], weight: ["400", "500"] })

export const metadata: Metadata = {
  title: "Robot Mode",
  description: "Tell Robot Mode what you want to do. It figures out when.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
