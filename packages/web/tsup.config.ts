import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    register: "src/register.ts",
    jsx: "src/jsx.d.ts",
    "providers/github": "src/providers/github.ts",
    "providers/http": "src/providers/http.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  banner: { js: "" },
  external: ["@web-git-graph/protocol", "@web-git-graph/protocol/http", "react/jsx-runtime"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  }
});
