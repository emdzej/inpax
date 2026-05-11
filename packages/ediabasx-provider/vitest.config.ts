import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Local glob — anchored to this package so `pnpm test` works both
    // from the workspace root (via turbo) and from inside the package
    // directory. The root config's `packages/**/src/**/*.test.ts`
    // doesn't match when cwd is the package itself.
    include: ["src/**/*.test.ts"],
  },
});
