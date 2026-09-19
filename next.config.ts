import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keeps the bottom-left overlay from sitting on top of the add-activity form.
  devIndicators: false,
  turbopack: { root: __dirname },
}

export default nextConfig
