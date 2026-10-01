import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { demoState } from "../data/demo";
import { App } from "./App";
import { StoreProvider } from "./store";

beforeEach(() => {
  vi.stubGlobal("indexedDB", undefined);
  localStorage.removeItem("command-center-local-workspace-v2");
  localStorage.setItem("command-center-state-v1", JSON.stringify(structuredClone(demoState)));
});
afterEach(() => vi.unstubAllGlobals());

function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={queryClient}><DemoAuthProvider><StoreProvider><App /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
}

describe("codzienna pętla Działania na Starcie", () => {
  it("kończy z listy jednym dotknięciem, pokazuje Cofnij i przywraca Działanie", async () => {
    const user = userEvent.setup();
    const app = renderApp("/");
    const link = await screen.findByRole("link", { name: "Spisać stałe koszty" });
    const row = link.closest(".today-action") as HTMLElement;

    await user.click(within(row).getByRole("button", { name: "Ukończ: Spisać stałe koszty" }));
    expect(await screen.findByText("Działanie ukończone.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Spisać stałe koszty" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByRole("link", { name: "Spisać stałe koszty" })).toBeInTheDocument();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("command-center-local-workspace-v2") ?? "null");
      expect(saved.state.actions.find((action: { id: string }) => action.id === "action-budget-today")).toMatchObject({ status: "ready", isNext: true });
    });

    app.unmount();
    renderApp("/");
    expect(await screen.findByRole("link", { name: "Spisać stałe koszty" })).toBeInTheDocument();
    await waitFor(() => {
      const reloaded = JSON.parse(localStorage.getItem("command-center-local-workspace-v2") ?? "null");
      expect(reloaded.state.actions.find((action: { id: string }) => action.id === "action-budget-today")).toMatchObject({ status: "ready", isNext: true });
    });
  });

  it("zachowuje nowo wybrany następny krok po cofnięciu i po ponownym odczycie", async () => {
    const user = userEvent.setup();
    const app = renderApp("/goals/goal-budget");
    await user.click(await screen.findByRole("button", { name: "Ukończ: Spisać stałe koszty" }));
    expect(await screen.findByText("Działanie ukończone.")).toBeInTheDocument();

    const other = screen.getByRole("button", { name: "Więcej opcji: Ustalić kwotę automatycznego przelewu" });
    await user.click(other);
    await user.click(within(screen.getByRole("dialog", { name: "Działanie — więcej opcji" })).getByRole("button", { name: "Ustaw jako następne" }));
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("command-center-local-workspace-v2") ?? "null");
      expect(saved.state.actions.find((action: { id: string }) => action.id === "action-budget-upcoming")?.isNext).toBe(true);
    });

    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    const restoredA = await screen.findByRole("link", { name: "Spisać stałe koszty" });
    const rowA = restoredA.closest("[data-action-id]") as HTMLElement;
    const rowB = screen.getByRole("link", { name: "Ustalić kwotę automatycznego przelewu" }).closest("[data-action-id]") as HTMLElement;
    expect(rowA).toHaveClass("goal-action", "ready");
    expect(rowB).toHaveClass("goal-featured-action", "ready");
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("command-center-local-workspace-v2") ?? "null");
      expect(saved.state.actions.find((action: { id: string }) => action.id === "action-budget-today")).toMatchObject({ status: "ready", isNext: false });
      expect(saved.state.actions.find((action: { id: string }) => action.id === "action-budget-upcoming")).toMatchObject({ isNext: true });
    });

    app.unmount();
    renderApp("/goals/goal-budget");
    const reloadedA = await screen.findByRole("link", { name: "Spisać stałe koszty" });
    const restoredB = await screen.findByRole("link", { name: "Ustalić kwotę automatycznego przelewu" });
    expect(reloadedA.closest("[data-action-id]")).toHaveClass("goal-action", "ready");
    expect(restoredB.closest("[data-action-id]")).toHaveClass("goal-featured-action", "ready");
  });

  it("nie potwierdza cofnięcia po błędzie zapisu i pozwala bezpiecznie ponowić", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const link = await screen.findByRole("link", { name: "Spisać stałe koszty" });
    await user.click(within(link.closest(".today-action") as HTMLElement).getByRole("button", { name: "Ukończ: Spisać stałe koszty" }));
    expect(await screen.findByText("Działanie ukończone.")).toBeInTheDocument();

    const originalSetItem = Storage.prototype.setItem;
    let failUndoSave = true;
    const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (failUndoSave && key === "command-center-local-workspace-v2") {
        failUndoSave = false;
        throw new Error("quota");
      }
      originalSetItem.call(this, key, value);
    });
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByText("Cofnięcie nie powiodło się: quota")).toBeInTheDocument();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("command-center-local-workspace-v2") ?? "null");
      expect(saved.state.actions.find((action: { id: string }) => action.id === "action-budget-today")).toMatchObject({ status: "completed", isNext: false });
    });

    storage.mockRestore();
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByRole("link", { name: "Spisać stałe koszty" })).toBeInTheDocument();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("command-center-local-workspace-v2") ?? "null");
      expect(saved.state.actions.find((action: { id: string }) => action.id === "action-budget-today")).toMatchObject({ status: "ready", isNext: true });
    });
  });
});
