import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // A static site: `next build` writes plain HTML, CSS and JS to out/, for any static host (Cloudflare Pages).
  // No server runs: the week lives in the visitor's browser.
  output: "export",
  // /app/ is written as app/index.html, which every static host serves the same way (app.html beside an
  // app/ folder is resolved differently from host to host).
  trailingSlash: true,
  // Keeps the bottom-left overlay from sitting on top of the add-activity form.
  devIndicators: false,
  turbopack: { root: __dirname },
}

export default nextConfig
