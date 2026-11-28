import { describe, expect, it } from "vitest";
import { polishCount } from "./labels";

describe("odmiana polskich liczników", () => {
  it.each([
    [0, "0 grup działań"],
    [1, "1 grupa działań"],
    [2, "2 grupy działań"],
    [5, "5 grup działań"],
    [12, "12 grup działań"],
  ])("odmienia licznik dla %i", (count, expected) => {
    expect(polishCount(count, "grupa działań", "grupy działań", "grup działań")).toBe(expected);
  });
});
