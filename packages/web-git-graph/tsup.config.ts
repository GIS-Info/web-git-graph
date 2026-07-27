import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    register: "src/register.ts",
    protocol: "src/protocol.ts",
    "providers/github": "src/providers/github.ts",
    "providers/http": "src/providers/http.ts",
    node: "src/node/index.ts",
    cli: "src/node/cli.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  }
});
