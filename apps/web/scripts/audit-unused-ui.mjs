import { existsSync, readdirSync, readFileSync } from "node:fs";

const sourceRoot = new URL("../src/", import.meta.url);
const uiRoot = new URL("../src/components/ui/", import.meta.url);
const sourceFiles = collect(sourceRoot).filter((file) => !file.pathname.endsWith("styles.css"));
const source = sourceFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const candidates = readdirSync(uiRoot).filter((file) => file.endsWith(".tsx")).filter((file) => {
  const modulePath = file.slice(0, -4);
  return !new RegExp(`(?:from|import\\()\\s*[\"'][^\"']*/ui/${modulePath}[\"']`).test(source);
});

console.log("UI primitive audit (candidates require manual confirmation):");
console.log(candidates.length ? candidates.map((file) => `- components/ui/${file}`).join("\n") : "- no unreferenced primitive files");
console.log("CSS candidates are intentionally not auto-removed: dynamic class names and Tailwind @apply need visual verification.");

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    return entry.isDirectory() ? collect(url) : [url];
  });
}
