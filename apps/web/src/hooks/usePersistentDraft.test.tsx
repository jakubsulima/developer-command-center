import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StoreContext, type AppStore } from "../app/store-context";
import { AuthContext, type AuthContextValue } from "../auth/auth-context";
import { emptyState } from "../data/empty";
import { draftStorageKey, usePersistentDraft } from "./usePersistentDraft";

const initial = { text: "" };

function wrapperFor(workspaceId: string, userId = "user-a") {
  const store = { state: { ...structuredClone(emptyState), workspaceId } } as AppStore;
  const auth = {
    mode: "demo", user: { id: userId, email: `${userId}@example.com`, name: userId }, loading: false,
    signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), continueInDemo: vi.fn()
  } as AuthContextValue;
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthContext.Provider value={auth}><StoreContext.Provider value={store}>{children}</StoreContext.Provider></AuthContext.Provider>;
  };
}

describe("usePersistentDraft", () => {
  it("flushuje szkic przy szybkim wyjściu i zachowuje wersję bazową", () => {
    const draft = renderHook(() => usePersistentDraft("goal-edit", initial, 60_000, { targetId: "goal-1", baseVersion: 7 }), { wrapper: wrapperFor("workspace-a") });
    act(() => draft.result.current.setValue({ text: "Wpis przed przejściem" }));
    expect(localStorage.getItem(draftStorageKey("user-a", "workspace-a", "goal-edit", "goal-1"))).toBeNull();
    draft.unmount();
    expect(JSON.parse(localStorage.getItem(draftStorageKey("user-a", "workspace-a", "goal-edit", "goal-1")) ?? "null")).toMatchObject({ version: 2, value: { text: "Wpis przed przejściem" }, baseVersion: 7 });
  });

  it("izoluje szkice różnych rekordów tego samego typu i odrzuca uszkodzony JSON", async () => {
    const first = renderHook(() => usePersistentDraft("goal-edit", initial, 0, { targetId: "goal-1" }), { wrapper: wrapperFor("workspace-a") });
    const second = renderHook(() => usePersistentDraft("goal-edit", initial, 0, { targetId: "goal-2" }), { wrapper: wrapperFor("workspace-a") });
    act(() => first.result.current.setValue({ text: "Pierwszy Cel" }));
    act(() => second.result.current.setValue({ text: "Drugi Cel" }));
    await waitFor(() => expect(first.result.current.status).toBe("saved"));
    await waitFor(() => expect(second.result.current.status).toBe("saved"));
    expect(JSON.parse(localStorage.getItem(draftStorageKey("user-a", "workspace-a", "goal-edit", "goal-1")) ?? "null").value.text).toBe("Pierwszy Cel");
    expect(JSON.parse(localStorage.getItem(draftStorageKey("user-a", "workspace-a", "goal-edit", "goal-2")) ?? "null").value.text).toBe("Drugi Cel");

    localStorage.setItem(draftStorageKey("user-a", "workspace-a", "goal-edit", "goal-broken"), "{not-json");
    const broken = renderHook(() => usePersistentDraft("goal-edit", initial, 0, { targetId: "goal-broken" }), { wrapper: wrapperFor("workspace-a") });
    expect(broken.result.current.value).toEqual(initial);
    expect(broken.result.current.status).toBe("error");
    expect(broken.result.current.errorMessage).toContain("odczytać");
  });

  it("czyta starą kopertę i pozwala ponowić zapis po błędzie storage", async () => {
    const key = draftStorageKey("user-a", "workspace-a", "legacy", "new");
    localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: "2026-09-08T10:00:00.000Z", value: { text: "Stary szkic" } }));
    const restored = renderHook(() => usePersistentDraft("legacy", initial, 0, { targetId: "new" }), { wrapper: wrapperFor("workspace-a") });
    expect(restored.result.current.value.text).toBe("Stary szkic");
    expect(restored.result.current.restored).toBe(true);

    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error("quota"); });
    const failed = renderHook(() => usePersistentDraft("retry", initial, 0, { targetId: "new" }), { wrapper: wrapperFor("workspace-a") });
    act(() => failed.result.current.setValue({ text: "Do ponowienia" }));
    await waitFor(() => expect(failed.result.current.status).toBe("error"));
    setItem.mockRestore();
    act(() => failed.result.current.retry());
    expect(failed.result.current.status).toBe("saved");
  });

  it("nie podmienia wpisanego tekstu, gdy rekord dociera później", () => {
    const hook = renderHook(({ text }) => usePersistentDraft("late-record", { text }, 60_000, { targetId: "goal-1" }), {
      initialProps: { text: "" },
      wrapper: wrapperFor("workspace-a")
    });
    act(() => hook.result.current.setValue({ text: "Wpisany lokalnie" }));
    hook.rerender({ text: "Wersja z refetchu" });
    expect(hook.result.current.value.text).toBe("Wpisany lokalnie");
  });

  it("przywraca draft po ponownym montażu i usuwa wyłącznie wskazany formularz", async () => {
    const wrapper = wrapperFor("workspace-a");
    const onboarding = renderHook(() => usePersistentDraft("onboarding", initial, 0), { wrapper });
    act(() => onboarding.result.current.setValue({ text: "Pierwszy rezultat" }));
    await waitFor(() => expect(onboarding.result.current.status).toBe("saved"));

    const project = renderHook(() => usePersistentDraft("project", initial, 0), { wrapper });
    act(() => project.result.current.setValue({ text: "Drugi formularz" }));
    await waitFor(() => expect(project.result.current.status).toBe("saved"));
    expect(localStorage.getItem(draftStorageKey("user-a", "workspace-a", "project"))).not.toBeNull();

    onboarding.unmount();
    const restored = renderHook(() => usePersistentDraft("onboarding", initial, 0), { wrapper });
    expect(restored.result.current.value.text).toBe("Pierwszy rezultat");
    expect(restored.result.current.restored).toBe(true);
    act(() => restored.result.current.clear());

    expect(localStorage.getItem(draftStorageKey("user-a", "workspace-a", "onboarding"))).toBeNull();
    expect(localStorage.getItem(draftStorageKey("user-a", "workspace-a", "project"))).not.toBeNull();
  });

  it("zachowuje treść po błędzie zapisu i nie przecieka między Workspace ani Userami", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error("quota"); });
    const failed = renderHook(() => usePersistentDraft("review-summary", initial, 0), { wrapper: wrapperFor("workspace-a", "user-a") });
    act(() => failed.result.current.setValue({ text: "Decyzja tygodnia" }));
    await waitFor(() => expect(failed.result.current.status).toBe("error"));
    expect(failed.result.current.value.text).toBe("Decyzja tygodnia");
    setItem.mockRestore();

    const otherWorkspace = renderHook(() => usePersistentDraft("review-summary", initial, 0), { wrapper: wrapperFor("workspace-b", "user-a") });
    const otherUser = renderHook(() => usePersistentDraft("review-summary", initial, 0), { wrapper: wrapperFor("workspace-a", "user-b") });
    expect(otherWorkspace.result.current.value.text).toBe("");
    expect(otherUser.result.current.value.text).toBe("");
  });
});
