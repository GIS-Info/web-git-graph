import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const modules = {
  protocol: {
    directory: "packages/protocol",
    allowed: new Set()
  },
  web: {
    directory: "packages/web",
    allowed: new Set(["protocol"])
  },
  node: {
    directory: "packages/node",
    allowed: new Set(["protocol"])
  },
  vscode: {
    directory: "packages/vscode",
    allowed: new Set(["protocol", "web", "node"])
  },
  demo: {
    directory: "apps/demo",
    allowed: new Set(["protocol", "web"])
  }
};

const failures = [];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(path);
  }
  return files;
}

for (const [name, module] of Object.entries(modules)) {
  const directoryUrl = new URL(`${module.directory}/`, root);
  const directory = fileURLToPath(directoryUrl);
  const manifest = JSON.parse(await readFile(new URL("package.json", directoryUrl), "utf8"));
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies
  };
  for (const dependency of Object.keys(dependencies)) {
    const match = /^@web-git-graph\/([^/]+)$/.exec(dependency);
    if (match && !module.allowed.has(match[1])) {
      failures.push(`${name}: package.json cannot depend on ${dependency}`);
    }
  }

  for (const file of await sourceFiles(directory)) {
    const source = await readFile(file, "utf8");
    const imports = source.matchAll(
      /(?:from\s+|import\s*(?:\(\s*)?)["'](@web-git-graph\/[^"']+|node:[^"']+)["']/g
    );
    for (const [, specifier] of imports) {
      if (specifier.includes("/src/")) {
        failures.push(`${name}: ${file} deep-imports ${specifier}`);
        continue;
      }
      if (specifier.startsWith("node:") && (name === "protocol" || name === "web" || name === "demo")) {
        failures.push(`${name}: ${file} imports Node builtin ${specifier}`);
        continue;
      }
      const match = /^@web-git-graph\/([^/]+)/.exec(specifier);
      if (match && match[1] !== name && !module.allowed.has(match[1])) {
        failures.push(`${name}: ${file} cannot import ${specifier}`);
      }
    }
  }
}

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Module dependency seams are valid.\n");
}
