import { defineConfig } from "vite";

export default defineConfig({
  base: "/web-git-graph/",
  build: {
    target: "es2022",
    sourcemap: true
  }
});
