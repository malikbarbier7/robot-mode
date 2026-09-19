import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
import { defineConfig } from "vitest/config"

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: { include: ["lib/**/*.test.ts"] },
})
