import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url);
const manifestPath = [".vite/manifest.json", "manifest.json"].map((file) => new URL(file, dist)).find((file) => existsSync(file));
if (!manifestPath) throw new Error("Bundle manifest not found. Run the production build first.");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const entryFiles = new Set(Object.values(manifest).filter((item) => item.isEntry).flatMap((item) => [item.file, ...(item.css ?? [])]));
const assetFiles = readdirSync(new URL("assets/", dist));
const sizes = assetFiles.map((file) => ({ file, bytes: gzipSync(readFileSync(new URL(`assets/${file}`, dist))).byteLength }));
const js = sizes.filter((item) => item.file.endsWith(".js"));
const css = sizes.filter((item) => item.file.endsWith(".css"));
const entryJs = js.filter((item) => entryFiles.has(`assets/${item.file}`) || entryFiles.has(item.file));
const routeJs = js.filter((item) => !entryJs.includes(item));
// The viewport-aware creation flows intentionally add CSS; keep the check
// blocking while allowing the current stylesheet a small amount of headroom.
const cssGzipLimit = 37 * 1024;

const failures = [
  ...entryJs.filter((item) => item.bytes > 120 * 1024).map((item) => `entry JS ${item.file} is ${item.bytes} B gzip (limit 122880)`),
  ...routeJs.filter((item) => item.bytes > 80 * 1024).map((item) => `route JS ${item.file} is ${item.bytes} B gzip (limit 81920)`),
  ...css.filter((item) => item.bytes > cssGzipLimit).map((item) => `CSS ${item.file} is ${item.bytes} B gzip (limit ${cssGzipLimit})`)
];

for (const item of sizes.filter((candidate) => candidate.file.endsWith(".js") || candidate.file.endsWith(".css"))) {
  console.log(`${item.file}: ${item.bytes} B gzip`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
