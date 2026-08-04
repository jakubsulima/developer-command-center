import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDuration, useElapsedTime } from "./useElapsedTime";

describe("czas Focus Session", () => {
  afterEach(() => vi.useRealTimers());

  it("formatuje czas bez przepełnień", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(3661)).toBe("01:01:01");
    expect(formatDuration(-10)).toBe("00:00");
  });

  it("zwiększa licznik tylko dla uruchomionej sesji", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T08:00:00Z"));
    const startedAt = Date.now();
    const { result, rerender } = renderHook(({ running, start }) => useElapsedTime({ running, startedAt: start, elapsedBeforeStart: 10, projectId: "p", workItemId: "w", scratchpad: "" }), { initialProps: { running: true, start: startedAt } });
    expect(result.current).toBe(10);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current).toBe(12);
    rerender({ running: false, start: startedAt });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current).toBe(10);
  });
});
