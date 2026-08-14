import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

/**
 * Copy the injection bundle into hg-serve resources. Serve injects and hosts it.
 */
const copyInjectionPlugin = () => {
  return {
    name: "copy-injection",
    closeBundle() {
      const src = path.resolve(__dirname, "dist/inspector.js");
      const dests = [path.resolve(__dirname, "src-tauri/hg-serve/resources/inspector.js")];
      if (fs.existsSync(src)) {
        for (const dest of dests) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
          console.log(`\n✅ Copied ${src} to ${dest}\n`);
        }
      }
    },
  };
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isInjectionBuild = mode === "injection";

  return {
    plugins: [
      ...(!isInjectionBuild
        ? [
            tanstackRouter({
              target: "react",
              autoCodeSplitting: true,
              routeFileIgnorePattern: "((en|ko|store)\\.ts$)",
            }),
          ]
        : []),
      react(),
      ...(!isInjectionBuild ? [tailwindcss()] : []),
      copyInjectionPlugin(),
    ],
    define: {
      "process.env": {},
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      emptyOutDir: !isInjectionBuild,
      cssCodeSplit: false,
      rollupOptions: isInjectionBuild
        ? {
            input: path.resolve(__dirname, "src/injection/main.tsx"),
            output: {
              format: "es",
              entryFileNames: "inspector.js",
              inlineDynamicImports: true,
            },
          }
        : {
            input: path.resolve(__dirname, "index.html"),
            output: {
              entryFileNames: "assets/[name]-[hash].js",
            },
          },
    },
    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // 3. tell Vite to ignore watching `src-tauri` and `dist`
        ignored: ["**/src-tauri/**", "**/dist/**"],
      },
    },
  };
});
