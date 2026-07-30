import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      extension: "src/extension.ts"
    },
    outDir: "dist/extension",
    platform: "node",
    format: ["cjs"],
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    external: ["vscode"],
    noExternal: [/^@web-git-graph\//],
    outExtension() {
      return { js: ".cjs" };
    }
  },
  {
    entry: {
      webview: "webview/index.ts"
    },
    outDir: "dist/webview",
    platform: "browser",
    format: ["esm"],
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    noExternal: [/^@web-git-graph\//]
  }
]);
