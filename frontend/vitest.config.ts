import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Task 2 (src/api/client.ts) statically imports `../auth/cognitoAuth`,
    // which lands in Task 3 and doesn't exist yet. The client.test.ts suite
    // never exercises that import (it only calls `createApiClient(...)`
    // directly with a fake token getter), but Vite still resolves every
    // static import at transform time regardless of usage, so the test file
    // can't even load without this. This alias is test-only (vitest's
    // `test.alias`, not the top-level `resolve.alias` used by `vite build`),
    // so `npm run build` is unaffected and still correctly fails until
    // Task 3 adds the real module. Remove once Task 3 lands.
    alias: [
      {
        find: /^\.\.\/auth\/cognitoAuth$/,
        replacement: fileURLToPath(
          new URL("./src/api/__testStubs__/cognitoAuth.ts", import.meta.url)
        ),
      },
    ],
  },
});
