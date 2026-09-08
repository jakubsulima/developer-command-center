import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "../data/workspaceRepository";
import { GlobalSearch } from "./GlobalSearch";

const store = vi.hoisted(() => ({ search: vi.fn<(query: string, limit?: number) => Promise<SearchResult[]>>() }));
vi.mock("../app/useStore", () => ({ useStore: () => store }));
const item = (title: string): SearchResult => ({ id: title, title, type: "goal", route: `/goals/${title}` });
function deferred() {
  let resolve!: (items: SearchResult[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<SearchResult[]>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function Location() { return <span data-testid="location">{useLocation().pathname}</span>; }
function view(visible = true) { return <MemoryRouter><GlobalSearch visible={visible} /><Location /></MemoryRouter>; }
function type(value: string) { fireEvent.change(screen.getByRole("combobox"), { target: { value } }); }
async function debounce() { await act(() => vi.advanceTimersByTimeAsync(200)); }

describe("GlobalSearch", () => {
  beforeEach(() => { vi.useFakeTimers(); sessionStorage.clear(); store.search = vi.fn().mockResolvedValue([]); });
  afterEach(() => { vi.useRealTimers(); });

  it("nie szuka pustej i krótkiej frazy; odróżnia zero wyników od błędu", async () => {
    render(view());
    fireEvent.focus(screen.getByRole("combobox"));
    await debounce();
    type("a");
    expect(screen.getByRole("status")).toHaveTextContent("Wpisz co najmniej 2 znaki");
    await debounce();
    expect(store.search).not.toHaveBeenCalled();
    type("  ab  ");
    expect(screen.getByRole("status")).toHaveTextContent("Szukanie…");
    await debounce();
    expect(store.search).toHaveBeenCalledWith("ab", 20);
    expect(screen.getByRole("status")).toHaveTextContent("Brak wyników");
    store.search.mockRejectedValueOnce(new Error("private diagnostics"));
    type("abc");
    await debounce();
    expect(screen.getByRole("status")).toHaveTextContent("Nie udało się wyszukać. Spróbuj ponownie.");
    expect(screen.queryByText(/private diagnostics|Brak wyników/)).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ponawia bieżącą frazę tylko raz i zachowuje tekst", async () => {
    const retry = deferred();
    store.search.mockRejectedValueOnce(new Error("offline")).mockReturnValueOnce(retry.promise);
    render(view()); type("Portfolio"); await debounce();
    const button = screen.getByRole("button", { name: "Ponów" });
    fireEvent.click(button); fireEvent.click(button);
    await debounce();
    expect(store.search).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("combobox")).toHaveValue("Portfolio");
    expect(screen.queryByRole("button", { name: "Ponów" })).not.toBeInTheDocument();
    await act(async () => retry.resolve([item("Portfolio")]));
    expect(screen.getByRole("option")).toHaveTextContent("Portfolio");
  });

  it.each(["success", "error"])("ignoruje spóźnione %s starszej frazy także po retry", async (outcome) => {
    const old = deferred();
    store.search.mockRejectedValueOnce(new Error("offline")).mockReturnValueOnce(old.promise).mockResolvedValueOnce([item("nowy")]);
    render(view()); type("stary"); await debounce();
    fireEvent.click(screen.getByRole("button", { name: "Ponów" })); await debounce();
    type("nowy");
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");
    await debounce();
    await act(async () => { if (outcome === "success") old.resolve([item("stary")]); else old.reject(new Error("old failure")); });
    expect(screen.getByRole("option")).toHaveTextContent("nowy");
    expect(screen.queryByText(/Nie udało/)).not.toBeInTheDocument();
  });

  it.each(["outside", "hidden", "account", "unmount"])("unieważnia odpowiedź po %s", async (change) => {
    const old = deferred(); store.search.mockReturnValueOnce(old.promise);
    const rendered = render(view()); type("stary"); await debounce();
    if (change === "outside") fireEvent.pointerDown(document.body);
    if (change === "hidden") rendered.rerender(view(false));
    if (change === "unmount") rendered.unmount();
    if (change === "account") { store.search = vi.fn().mockResolvedValue([item("nowe konto")]); rendered.rerender(view()); await debounce(); }
    await act(async () => old.resolve([item("stary")]));
    expect(screen.queryByRole("option", { name: /stary/ })).not.toBeInTheDocument();
    if (change === "account") expect(screen.getByRole("option")).toHaveTextContent("nowe konto");
  });

  it("obsługuje strzałki, Enter i Escape bez nieistniejącej aktywnej opcji", async () => {
    store.search.mockResolvedValue([item("pierwszy"), item("drugi")]);
    render(view()); type("cel"); await debounce();
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(document.getElementById(input.getAttribute("aria-activedescendant")!)).toHaveTextContent("drugi");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(document.getElementById(input.getAttribute("aria-activedescendant")!)).toHaveTextContent("pierwszy");
    type("inna fraza");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    await debounce(); fireEvent.keyDown(input, { key: "ArrowDown" }); fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("location")).toHaveTextContent("/goals/drugi");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    fireEvent.focus(input); await debounce(); fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue(""); expect(input).toHaveAttribute("aria-expanded", "false");
  });
});
