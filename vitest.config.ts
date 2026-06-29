import { fileURLToPath } from "node:url";
import type { ESBuildOptions } from "vite";
import { defineConfig } from "vitest/config";

const reactJsxTransform = {
  jsx: "automatic",
} as unknown as ESBuildOptions;

export default defineConfig({
  esbuild: reactJsxTransform,
  oxc: false,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
