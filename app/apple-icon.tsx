import { ImageResponse } from "next/og"

// Drawn once at build time: the site is a static export.
export const dynamic = "force-static"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

/** The home-screen icon: the favicon's screen, amber lines on the dark CRT, at phone size. */
export default function AppleIcon() {
  const line = (width: number, opacity = 1) => (
    <div style={{ width, height: 16, background: "#ffb238", opacity, boxShadow: "0 0 10px rgba(255,178,56,0.6)" }} />
  )
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#2a2620", padding: 18 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, background: "#14110c", padding: "0 22px" }}>
          {line(100)}
          {line(66)}
          <div style={{ display: "flex", gap: 12 }}>
            {line(38)}
            {line(16, 0.6)}
          </div>
        </div>
      </div>
    ),
    size,
  )
}
