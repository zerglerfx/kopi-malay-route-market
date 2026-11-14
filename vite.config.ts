// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig({
  vite: {
    plugins: [{
      name: "email-server-env",
      config(_config, { mode }) {
        // Keep the preset's VITE_-only browser injection unchanged.
        Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
      },
    }],
    resolve: {
      // Match only legacy entry points: modern htmlparser2 must resolve its
      // own entities/decode export instead of rewriting it to a v4 file path.
      alias: [
        { find: /^entities\/lib\/decode\.js$/, replacement: path.resolve(process.cwd(), "node_modules/entities/lib/esm/decode.js") },
        { find: /^entities\/lib\/encode\.js$/, replacement: path.resolve(process.cwd(), "node_modules/entities/lib/esm/encode.js") },
        { find: /^entities$/, replacement: path.resolve(process.cwd(), "node_modules/entities/lib/esm/index.js") },
      ],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
