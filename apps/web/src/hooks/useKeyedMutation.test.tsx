import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyedMutation } from "./useKeyedMutation";

describe("useKeyedMutation", () => {
  it("deduplicates only the same key and exposes a retry", async () => {
    let release!: () => void;
    const first = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const second = vi.fn(async () => undefined);
    const { result } = renderHook(() => useKeyedMutation());
    act(() => { void result.current.run("save:one", first); void result.current.run("save:one", first); void result.current.run("save:two", second); });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    await act(async () => release());

    const failure = vi.fn(async () => { throw new Error("offline"); });
    await act(async () => result.current.run("archive:one", failure));
    expect(result.current.error("archive:one")).toBe("offline");
    await act(async () => result.current.retry("archive:one")?.());
    expect(failure).toHaveBeenCalledTimes(2);
  });
});
