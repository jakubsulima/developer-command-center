import { describe, expect, it, vi } from "vitest";
import { WorkspaceDataFreshness, WORKSPACE_FRESHNESS_THRESHOLD_MS } from "./workspaceDataFreshness";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

describe("WorkspaceDataFreshness", () => {
  it("uses the 30-second threshold, while manual triggers share one request", async () => {
    let now = 10_000;
    const read = deferred<string>();
    const load = vi.fn(() => read.promise);
    const freshness = new WorkspaceDataFreshness({ now: () => now });
    freshness.markSuccessful();

    now += WORKSPACE_FRESHNESS_THRESHOLD_MS;
    expect(await freshness.request(load)).toBeUndefined();
    now += 1;
    const first = freshness.request(load, true);
    const second = freshness.request(load, true);
    expect(first).toBe(second);
    expect(load).toHaveBeenCalledTimes(1);
    read.resolve("fresh");
    await expect(first).resolves.toBe("fresh");
    expect(freshness.getSnapshot()).toMatchObject({ status: "success", lastSuccessfulAt: now });
  });

  it("keeps the last successful timestamp after an error and permits an explicit retry", async () => {
    let now = 20_000;
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce("fresh");
    const freshness = new WorkspaceDataFreshness({ now: () => now });
    freshness.markSuccessful();
    now += WORKSPACE_FRESHNESS_THRESHOLD_MS + 1;

    await expect(freshness.request(load)).rejects.toThrow("network down");
    expect(freshness.getSnapshot()).toMatchObject({ status: "error", lastSuccessfulAt: 20_000, error: "network down" });
    now += 1;
    await expect(freshness.request(load, true)).resolves.toBe("fresh");
    expect(freshness.getSnapshot().status).toBe("success");
  });

  it("ignores a response belonging to a previous identity after reset", async () => {
    const load = deferred<string>();
    const changes: string[] = [];
    const freshness = new WorkspaceDataFreshness({ onChange: (state) => changes.push(state.status) });
    const oldRequest = freshness.request(() => load.promise, true);
    freshness.reset();
    load.resolve("old-account");

    await expect(oldRequest).resolves.toBeUndefined();
    expect(freshness.getSnapshot()).toEqual({ status: "idle" });
    expect(changes).toContain("refreshing");
  });
});
