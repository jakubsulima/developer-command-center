import { describe, expect, it } from "vitest";
import { WorkspaceMutationCoordinator, type SyncState } from "./workspaceMutationCoordinator";

interface TestState {
  actions: Record<string, string>;
}

function setAction(state: TestState, id: string, value: string): TestState {
  return { ...state, actions: { ...state.actions, [id]: value } };
}

function mutation(
  coordinator: WorkspaceMutationCoordinator<TestState>,
  id: string,
  value: string,
  persist: () => Promise<void>,
  order: string[]
) {
  return coordinator.run({
    key: `action:${id}`,
    apply: () => {
      const next = setAction(state, id, value);
      return {
        nextState: next,
        rollback: (current) => setAction(current, id, state.actions[id]),
        reapply: (fresh) => setAction(fresh, id, value)
      };
    },
    persist: async () => { order.push(`${id}:start`); await persist(); order.push(`${id}:end`); }
  });
}

let state: TestState;

describe("WorkspaceMutationCoordinator", () => {
  it("keeps a successful entity when another entity fails and tracks 2→1→0", async () => {
    state = { actions: { a: "old-a", b: "old-b" } };
    const snapshots: SyncState[] = [];
    const coordinator = new WorkspaceMutationCoordinator({
      getState: () => state,
      setState: (next) => { state = next; }
    });
    coordinator.subscribe(() => snapshots.push(coordinator.getSyncState()));
    let releaseA!: () => void;
    const a = mutation(coordinator, "a", "new-a", () => new Promise<void>((resolve) => { releaseA = resolve; }), []);
    const b = coordinator.run({
      key: "action:b",
      apply: () => ({
        nextState: setAction(state, "b", "new-b"),
        rollback: (current) => setAction(current, "b", "old-b"),
        reapply: (fresh) => setAction(fresh, "b", "new-b")
      }),
      persist: async () => { throw new Error("b failed"); }
    });

    await Promise.resolve();
    expect(state.actions).toEqual({ a: "new-a", b: "new-b" });
    expect(coordinator.getSyncState().pendingCount).toBe(2);
    releaseA();
    await expect(a).resolves.toBeUndefined();
    await expect(b).rejects.toThrow("b failed");
    expect(state.actions).toEqual({ a: "new-a", b: "old-b" });
    expect(snapshots.some((snapshot) => snapshot.pendingCount === 1)).toBe(true);
    expect(coordinator.getSyncState()).toMatchObject({ status: "error", pendingCount: 0, errors: { "action:b": "b failed" } });
  });

  it("serializes mutations with the same key while keeping different keys parallel", async () => {
    state = { actions: { a: "old-a", b: "old-b" } };
    const order: string[] = [];
    const coordinator = new WorkspaceMutationCoordinator({ getState: () => state, setState: (next) => { state = next; } });
    let releaseFirst!: () => void;
    const first = mutation(coordinator, "a", "first", () => new Promise<void>((resolve) => { releaseFirst = resolve; }), order);
    const second = mutation(coordinator, "a", "second", async () => undefined, order);
    const other = mutation(coordinator, "b", "other", async () => undefined, order);
    await Promise.resolve();
    expect(order.slice(0, 2)).toEqual(["a:start", "b:start"]);
    releaseFirst();
    await Promise.all([first, other]);
    await second;
    expect(order.indexOf("b:end")).toBeLessThan(order.indexOf("a:end"));
    expect(order).toEqual(["a:start", "b:start", "b:end", "a:end", "a:start", "a:end"]);
    expect(state.actions).toEqual({ a: "second", b: "other" });
  });

  it("reapplies active optimistic changes after a refetch", async () => {
    state = { actions: { a: "old-a", b: "old-b" } };
    const coordinator = new WorkspaceMutationCoordinator({ getState: () => state, setState: (next) => { state = next; } });
    let release!: () => void;
    const pending = mutation(coordinator, "a", "optimistic-a", () => new Promise<void>((resolve) => { release = resolve; }), []);
    await Promise.resolve();
    coordinator.refresh({ actions: { a: "server-a", b: "server-b" } });
    expect(state).toEqual({ actions: { a: "optimistic-a", b: "server-b" } });
    release();
    await pending;
  });

  it("does not let a read that started before a completed write restore the old snapshot", async () => {
    state = { actions: { a: "old-a" } };
    const coordinator = new WorkspaceMutationCoordinator({ getState: () => state, setState: (next) => { state = next; } });
    let releaseWrite!: () => void;
    const write = coordinator.run({
      key: "action:a",
      apply: () => ({
        nextState: setAction(state, "a", "new-a"),
        rollback: (current) => setAction(current, "a", "old-a"),
        reapply: (fresh) => setAction(fresh, "a", "new-a")
      }),
      persist: () => new Promise<void>((resolve) => { releaseWrite = resolve; })
    });

    await Promise.resolve();
    const readRevision = 0;
    releaseWrite();
    await write;

    // This is the response from a read which began before the write committed.
    coordinator.refresh({ actions: { a: "old-a" } }, readRevision);

    expect(state.actions.a).toBe("new-a");
  });
});
