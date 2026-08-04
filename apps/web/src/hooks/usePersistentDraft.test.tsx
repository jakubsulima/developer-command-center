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
