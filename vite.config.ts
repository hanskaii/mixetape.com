import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import stylex from "@stylexjs/unplugin";
import { cloudflare } from "@cloudflare/vite-plugin";

const config = defineConfig({
  // .wrangler holds local D1 files and the emails Miniflare writes; watching it made the
  // page reload mid-login every time a sign-in code was "sent". docs/ (separate Astro project)
  // and .claude/ (agent worktrees are full repo copies) are not part of the app.
  server: {
    allowedHosts: true,
    watch: { ignored: ["**/.wrangler/**", "**/docs/**", "**/.claude/**"] },
  },
  resolve: { tsconfigPaths: true },
  // Icons are imported one file each (@phosphor-icons/react/X). Pre-bundling them made the SSR
  // optimizer find them a page at a time and reload after each; served as-is they are small ESM.
  optimizeDeps: { exclude: ["@phosphor-icons/react"] },
  environments: { ssr: { optimizeDeps: { exclude: ["@phosphor-icons/react"] } } },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart(),
    stylex.vite({
      useCSSLayers: true,
      runtimeInjection: false,
      dev: process.env.NODE_ENV === "development",
    }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});

export default config;
