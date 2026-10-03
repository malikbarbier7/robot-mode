import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { SITE_NAME, VALUE_PROP } from "@/lib/site"

// Drawn once at build time: the site is a static export.
export const dynamic = "force-static"

export const alt = `${SITE_NAME}: ${VALUE_PROP.join(" ")}`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const PANEL = "#cdc5b1"
const CASING = "#2a2620"
const SCREEN = "#14110c"
const PHOSPHOR = "#ffb238"
const INK = "#1b1914"

/**
 * The link preview: the machine's screen with the value proposition on it, set
 * in the panel's beige, as the landing page opens. The screen's own bitmap face
 * (VT323) and the panel's mono (IBM Plex Mono), both under the Open Font License.
 */
export default async function Image() {
  const [crt, mono] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/VT323-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/IBMPlexMono-SemiBold.ttf")),
  ])

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PANEL, padding: "28px 40px 22px" }}>
        {/* The nameplate and the power lamp. */}
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 20 }}>
          <div style={{ display: "flex", border: `3px solid ${INK}`, background: "#d8d0bf", padding: "6px 16px", fontFamily: "Plex", fontSize: 26, letterSpacing: 6, color: INK }}>
            ROBOT MODE
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "Plex", fontSize: 18, letterSpacing: 3, color: "rgba(27,25,20,0.7)" }}>
            <div style={{ width: 14, height: 14, background: PHOSPHOR, border: `2px solid rgba(27,25,20,0.6)` }} />
            POWER
          </div>
        </div>

        {/* The screen, in its bezel. */}
        <div style={{ flex: 1, display: "flex", background: CASING, padding: 18, border: `2px solid ${INK}` }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              background: SCREEN,
              padding: "0 56px",
              fontFamily: "VT323",
              color: PHOSPHOR,
              textShadow: "0 0 12px rgba(255,178,56,0.55)",
            }}
          >
            {VALUE_PROP.map((line) => (
              <div key={line} style={{ display: "flex", fontSize: 76, lineHeight: 1, letterSpacing: 3, textTransform: "uppercase" }}>
                {line}
              </div>
            ))}
            <div style={{ display: "flex", marginTop: 26, fontSize: 32, letterSpacing: 8, color: "rgba(255,178,56,0.85)" }}>
              FREE · NO AI · PRIVATE
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "VT323", data: crt, style: "normal", weight: 400 },
        { name: "Plex", data: mono, style: "normal", weight: 600 },
      ],
    },
  )
}
