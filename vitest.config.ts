import { defineConfig } from "vitest/config";

// Deliberately does not extend vite.config.ts: that config loads the
// Cloudflare plugin, which would boot a workerd environment. The units under
// test here are pure and run in plain Node.
export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": new URL("./src/test/cloudflare-workers.stub.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
