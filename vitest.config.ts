import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@web-git-graph/protocol/http",
        replacement: fileURLToPath(new URL("./packages/protocol/src/http.ts", import.meta.url))
      },
      {
        find: "@web-git-graph/protocol",
        replacement: fileURLToPath(new URL("./packages/protocol/src/index.ts", import.meta.url))
      },
      {
        find: "@web-git-graph/web/providers/http",
        replacement: fileURLToPath(new URL("./packages/web/src/providers/http.ts", import.meta.url))
      },
      {
        find: "@web-git-graph/web",
        replacement: fileURLToPath(new URL("./packages/web/src/index.ts", import.meta.url))
      },
      {
        find: "@web-git-graph/node",
        replacement: fileURLToPath(new URL("./packages/node/src/index.ts", import.meta.url))
      }
    ]
  }
});
