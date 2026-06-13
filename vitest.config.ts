import { defineConfig } from "vitest/config";

/**
 * Workspace-wide unit test runner.
 * Convention: pure, hermetic tests live in <package>/test/*.test.ts and never
 * touch Postgres/Redis. Integration tests (DB-backed) and e2e (Playwright)
 * get their own configs when introduced.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
  },
});
