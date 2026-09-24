import { describe, expect, it } from "vitest";
import { breadcrumbsForPage, navigationCardId, readNavigationState } from "./navigation";

describe("NavigationState", () => {
  it("keeps the return address, source card and scroll position", () => {
    expect(readNavigationState({
      breadcrumbs: [{ label: "Projekt", to: "/projects/p1" }],
      returnTo: "/projects/p1?view=goals",
      returnLabel: "Projekt: Finanse",
      sourceCardId: "goal-g1",
      scrollY: 480
    })).toEqual({
      breadcrumbs: [{ label: "Projekt", to: "/projects/p1" }],
      returnTo: "/projects/p1?view=goals",
      returnLabel: "Projekt: Finanse",
      sourceCardId: "goal-g1",
      scrollY: 480
    });
  });

  it("supports older back fields while keeping breadcrumb limits at the UI boundary", () => {
    expect(readNavigationState({ backTo: "/projects/p1", backLabel: "Projekt" })).toMatchObject({ returnTo: "/projects/p1", returnLabel: "Projekt" });
    const page = breadcrumbsForPage(
      { breadcrumbs: [{ label: "Projekty", to: "/projects" }, { label: "Finanse", to: "/projects/p1" }, { label: "Cel", to: "/goals/g1" }], returnTo: "/projects/p1", returnLabel: "Projekt" },
      [],
      { label: "Działanie" }
    );
    expect(page.map((item) => item.label)).toEqual(["Projekty", "Finanse", "Cel", "Działanie"]);
  });

  it("cuts a circular trail when a knowledge relation returns to an earlier entity", () => {
    const project = { label: "Projekt", to: "/projects/p1" };
    const knowledge = { label: "Wiedza: Notatka", to: "/knowledge/k1" };
    const returned = breadcrumbsForPage(
      { breadcrumbs: [project, knowledge], returnTo: "/knowledge/k1", returnLabel: knowledge.label },
      [{ label: "Projekty", to: "/projects" }],
      { ...project, to: "/projects/p1?view=knowledge" }
    );
    expect(returned).toEqual([{ label: "Projekt", to: "/projects/p1?view=knowledge" }]);
    expect(breadcrumbsForPage({ breadcrumbs: [...returned, knowledge] }, [], project)).toEqual([project]);
  });

  it("generates stable entity card ids", () => {
    expect(navigationCardId("goal", "g/1")).toBe("goal-g/1");
    expect(navigationCardId("action", "a1")).toBe("action-a1");
    expect(navigationCardId("knowledge", "k1")).toBe("knowledge-k1");
  });
});
