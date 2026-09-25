export interface CachedGoalReviewWindow {
  created_at: string;
  cache_expires_at: string;
}

export type GoalReviewFreshness = "none" | "current" | "source_changed" | "expired" | "configuration_changed" | "unknown";

export interface GoalReviewFreshnessRow extends CachedGoalReviewWindow {
  window_days: number;
  context_hash: string;
  provider: string;
  model: string;
  prompt_version: number;
  schema_version: number;
}

export function goalReviewFreshness(args: {
  row: GoalReviewFreshnessRow | null;
  windowDays: 7 | 14 | 28;
  contextHash: string;
  provider?: string;
  model?: string;
  promptVersion: number;
  schemaVersion: number;
  cacheHours: 24 | 72 | 168;
  now: Date;
}): GoalReviewFreshness {
  if (!args.row) return "none";
  if (!args.provider || !args.model) return "unknown";
  const row = args.row;
  if (row.window_days !== args.windowDays || row.provider !== args.provider || row.model !== args.model || row.prompt_version !== args.promptVersion || row.schema_version !== args.schemaVersion) return "configuration_changed";
  if (row.context_hash !== args.contextHash) return "source_changed";
  if (!Number.isFinite(effectiveGoalReviewExpiry(row, args.cacheHours))) return "unknown";
  if (!isGoalReviewCacheReusable(row, args.now, args.cacheHours)) return "expired";
  return "current";
}

export function effectiveGoalReviewExpiry(row: CachedGoalReviewWindow, cacheHours: 24 | 72 | 168) {
  const persistedExpiry = Date.parse(row.cache_expires_at);
  const configuredExpiry = Date.parse(row.created_at) + cacheHours * 60 * 60 * 1000;
  if (!Number.isFinite(persistedExpiry) || !Number.isFinite(configuredExpiry)) return Number.NaN;
  return Math.min(persistedExpiry, configuredExpiry);
}

export function isGoalReviewCacheReusable(row: CachedGoalReviewWindow, now: Date, cacheHours: 24 | 72 | 168) {
  return now.getTime() < effectiveGoalReviewExpiry(row, cacheHours);
}
