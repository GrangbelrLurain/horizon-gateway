import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

/**
 * Custom plugin to copy injection script to tauri resources
 */
const copyInjectionPlugin = () => {
  return {
    name: "copy-injection",
    closeBundle() {
      const src = path.resolve(__dirname, "dist/inspector.js");
      const dest = path.resolve(__dirname, "src-tauri/resources/inspector.js");
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`\n✅ Copied ${src} to ${dest}\n`);
      }
    },
  };
};

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routeFileIgnorePattern: "((en|ko|store)\\.ts$)",
    }),
    react(),
    tailwindcss(),
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
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        injection: path.resolve(__dirname, "src/injection/main.tsx"),
      },
      output: {
        inlineDynamicImports: false,
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === "injection" ? "inspector.js" : "assets/[name]-[hash].js";
        },
        manualChunks: (id) => {
          if (
            id.includes("src/injection") ||
            id.includes("node_modules/react") ||
            id.includes("node_modules/scheduler")
          ) {
            return "inspector";
          }
        },
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
}));
