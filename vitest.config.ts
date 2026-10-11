import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/pdi/**/*.{test,spec}.ts",
      "src/pdi/**/*.{test,spec}.tsx",
      "src/**/*.{test,spec}.ts",
      "src/**/*.{test,spec}.tsx",
    ],
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
