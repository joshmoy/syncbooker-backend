import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Don't parallelize across files by default — our tests mutate
    // process.env in-place, and running sequentially keeps that safe.
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
