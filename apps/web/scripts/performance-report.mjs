import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dist = new URL("../dist/", import.meta.url);
const manifestFile = [".vite/manifest.json", "manifest.json"].map((file) => new URL(file, dist)).find((file) => existsSync(file));
if (!manifestFile) throw new Error("Bundle manifest not found. Run the production build first.");

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const baselineFile = valueAfter("--baseline") ? fileURLToPath(new URL(valueAfter("--baseline"), `file://${repoRoot}/`)) : new URL("../../../docs/performance/plan-06-baseline.json", import.meta.url);
const timingsFile = valueAfter("--timings") ? fileURLToPath(new URL(valueAfter("--timings"), `file://${repoRoot}/`)) : undefined;

const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const entryFiles = new Set(Object.values(manifest).filter((item) => item.isEntry).flatMap((item) => [item.file, ...(item.css ?? [])]));
const assets = readdirSync(new URL("assets/", dist)).map((file) => ({
  file,
  bytes: gzipSync(readFileSync(new URL(`assets/${file}`, dist))).byteLength
}));
const entryJs = assets.filter(({ file }) => file.endsWith(".js") && (entryFiles.has(`assets/${file}`) || entryFiles.has(file)));
const entryCss = assets.filter(({ file }) => file.endsWith(".css") && (entryFiles.has(`assets/${file}`) || entryFiles.has(file)));
const routeJs = assets.filter(({ file }) => file.endsWith(".js") && !entryJs.some((entry) => entry.file === file));

const current = {
  entryJsGzip: sum(entryJs),
  entryCssGzip: sum(entryCss),
  largestRouteJsGzip: Math.max(0, ...routeJs.map((item) => item.bytes))
};

console.log("Plan 06 — raport wydajności produkcyjnego buildu");
console.log(`Entry JS: ${formatBytes(current.entryJsGzip)} gzip`);
console.log(`Entry CSS: ${formatBytes(current.entryCssGzip)} gzip`);
console.log(`Największy lazy route: ${formatBytes(current.largestRouteJsGzip)} gzip`);
console.log("Profile runtime: desktop (>=481 px) oraz mobile (<=480 px; scenariusz 390×844).");

if (existsSync(baselineFile)) {
  const baseline = JSON.parse(readFileSync(baselineFile, "utf8"));
  console.log("\nPorównanie bundle z baseline:");
  printDelta("Entry JS", baseline.bundle?.entryJsGzip, current.entryJsGzip);
  printDelta("Entry CSS", baseline.bundle?.entryCssGzip, current.entryCssGzip);
}

if (timingsFile) {
  const timings = normaliseTimings(JSON.parse(readFileSync(timingsFile, "utf8")));
  console.log("\nTimingi runtime (ms; średnia z agregatów):");
  for (const profile of ["desktop", "mobile"]) {
    console.log(`  ${profile}:`);
    for (const metric of ["app-start", "lazy-route-transition", "quick-add-open", "workspace-first-interaction"]) {
      const value = timings[profile]?.[metric];
      console.log(`    ${metric}: ${value === undefined ? "—" : value}`);
    }
  }
}

function sum(items) {
  return items.reduce((total, item) => total + item.bytes, 0);
}

function formatBytes(bytes) {
  return `${bytes.toLocaleString("pl-PL")} B`;
}

function printDelta(label, before, after) {
  if (!Number.isFinite(before)) {
    console.log(`  ${label}: ${formatBytes(after)} (brak wartości baseline)`);
    return;
  }
  const delta = after - before;
  const sign = delta > 0 ? "+" : "";
  console.log(`  ${label}: ${formatBytes(before)} → ${formatBytes(after)} (${sign}${delta.toLocaleString("pl-PL")} B)`);
}

function normaliseTimings(input) {
  if (!input || typeof input !== "object") throw new Error("Timings JSON must be an object.");
  const source = input.kind === "performance" && input.metrics && typeof input.metrics === "object" ? input.metrics : input;

  // Accept the flat report format as well as the raw object returned by
  // window.__commandPerformance(), so a browser snapshot can be saved directly.
  if (hasFlatProfile(source)) return source;

  const grouped = { desktop: {}, mobile: {} };
  for (const [key, value] of Object.entries(source)) {
    const [metric, ...dimensions] = key.split("|");
    const fields = Object.fromEntries(dimensions.map((dimension) => dimension.split("=", 2)));
    const profile = fields.viewport;
    if (!grouped[profile] || !isMetric(value)) continue;

    const previous = grouped[profile][metric];
    const count = (previous?.count ?? 0) + value.count;
    const totalMs = (previous?.totalMs ?? 0) + value.totalMs;
    grouped[profile][metric] = { count, totalMs };
  }

  const normalised = Object.fromEntries(Object.entries(grouped).map(([profile, metrics]) => [
    profile,
    Object.fromEntries(Object.entries(metrics).map(([metric, value]) => [metric, Math.round(value.totalMs / value.count)]))
  ]));
  if (!Object.values(normalised).some((profile) => Object.keys(profile).length)) {
    throw new Error("Timings JSON does not contain supported performance metrics.");
  }
  return normalised;
}

function hasFlatProfile(input) {
  return ["desktop", "mobile"].some((profile) => input[profile] && typeof input[profile] === "object");
}

function isMetric(value) {
  return value && typeof value === "object" && Number.isFinite(value.count) && value.count > 0 && Number.isFinite(value.totalMs);
}
