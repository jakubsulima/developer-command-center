import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { emptyState } from "../data/empty";
import { App } from "./App";
import { StoreProvider } from "./store";

function renderApp(path = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <DemoAuthProvider><StoreProvider><App /></StoreProvider></DemoAuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("goal-centric workspace", () => {
  it("przechwytuje treść bez wcześniejszej klasyfikacji", async () => {
    const user = userEvent.setup();
    renderApp("/inbox");
    const capture = await screen.findByPlaceholderText("Zapisz myśl, zadanie lub link…");
    await user.type(capture, "Sprawdzić indeks na tabeli transakcji");
    await user.click(screen.getByRole("button", { name: "Zapisz do Inboxu" }));
    expect(screen.getAllByText("Sprawdzić indeks na tabeli transakcji").length).toBeGreaterThanOrEqual(1);
    expect(capture).toHaveValue("");
  });

  it("tworzy Cel z pierwszym Działaniem bez mechaniki Focus", async () => {
    localStorage.setItem("command-center-state-v1", JSON.stringify(emptyState));
    const user = userEvent.setup();
    renderApp("/goals");
    await screen.findByRole("heading", { name: "Cele" });
    await user.click(screen.getByRole("button", { name: "Nowy cel" }));
    const dialog = screen.getByRole("dialog", { name: "Nowy cel" });
    expect(within(dialog).getByText("Cel to prosty rezultat do wykonania. Wystarczy nazwa — resztę możesz dopisać później.")).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("Nazwa Celu"));
    await user.paste("Uruchomić nowy produkt");
    await user.click(within(dialog).getByLabelText(/Jaki jest pierwszy krok/));
    await user.paste("Zbudować formularz startowy");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz cel" }));
    expect(await screen.findByRole("heading", { name: "Uruchomić nowy produkt", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("Zbudować formularz startowy").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/timer|rozpocznij fokus/i)).not.toBeInTheDocument();
  });

  it("tworzy własny szablon Celu", async () => {
    const user = userEvent.setup();
    renderApp("/goals");
    await screen.findByRole("heading", { name: "Cele" });
    await user.click(screen.getByRole("button", { name: "Szablony Celów" }));
    const dialog = screen.getByRole("dialog", { name: "Własne szablony Celów" });
    await user.type(within(dialog).getByLabelText("Nazwa", { selector: "#template-name" }), "Plan kwartalny");
    await user.type(within(dialog).getByLabelText("Domyślne pierwsze Działanie"), "Określ miernik");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz szablon" }));
    expect(await within(dialog).findByText("Plan kwartalny")).toBeInTheDocument();
  });

  it("tworzy stały Projekt jako osobny kontener", async () => {
    const user = userEvent.setup();
    renderApp("/projects");
    await user.click(await screen.findByRole("button", { name: "Nowy projekt" }));
    const dialog = screen.getByRole("dialog", { name: "Nowy projekt" });
    await user.type(within(dialog).getByLabelText("Nazwa Projektu"), "Zdrowie");
    await user.type(within(dialog).getByLabelText(/Krótki kontekst/), "Cele, zadania i wiedza o zdrowiu");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz Projekt" }));
    expect(await screen.findByRole("heading", { name: "Zdrowie" })).toBeInTheDocument();
  });

  it("tworzy, edytuje i wzbogaca własną serię cykliczną", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Dzisiaj" });
    await user.click(screen.getByRole("button", { name: "Nowe cykliczne" }));
    const create = screen.getByRole("dialog", { name: "Nowe Działanie cykliczne" });
    expect(within(create).getByText("Tak zapiszesz serię")).toBeInTheDocument();
    expect(within(create).getByRole("button", { name: /Co tydzień/ })).toHaveAttribute("aria-pressed", "true");
    await user.type(within(create).getByLabelText("Nazwa"), "Cotygodniowy plan posiłków");
    await user.type(within(create).getByLabelText("Opis"), "Ustal menu i listę zakupów");
    await user.click(within(create).getByRole("button", { name: "Utwórz serię" }));
    const materialSelect = await screen.findByLabelText("Dodaj materiał do serii Cotygodniowy plan posiłków");
    const series = materialSelect.closest(".series-row") as HTMLElement;
    expect(within(series).getByText(/Co tydzień/)).toBeInTheDocument();
    expect(within(series).getByText("Następne")).toBeInTheDocument();
    expect(within(series).getByText("Start")).toBeInTheDocument();
    expect(within(series).getByText("Kontekst")).toBeInTheDocument();
    await user.selectOptions(materialSelect, "know-3");
    expect(await within(series).findByRole("button", { name: "Odłącz PostgreSQL: constraints and normalization" })).toBeInTheDocument();
    await user.click(within(series).getByRole("button", { name: "Edytuj" }));
    const edit = screen.getByRole("dialog", { name: "Edytuj serię cykliczną" });
    await user.clear(within(edit).getByLabelText("Nazwa"));
    await user.type(within(edit).getByLabelText("Nazwa"), "Plan posiłków i zakupów");
    await user.click(within(edit).getByRole("button", { name: "Zapisz serię" }));
    expect(await screen.findByLabelText("Dodaj materiał do serii Plan posiłków i zakupów")).toBeInTheDocument();
  });

  it("pokazuje podsumowanie podczas szybkiego dodawania Działania", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Dzisiaj" });
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    const dialog = screen.getByRole("dialog", { name: "Dodaj Działanie" });
    await user.type(within(dialog).getByLabelText("Nazwa Działania"), "Przygotować plan rozmowy");
    await user.click(within(dialog).getByRole("button", { name: "Jutro" }));
    expect(within(dialog).getByRole("button", { name: "Jutro" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByText("Tak zapiszesz Działanie")).toBeInTheDocument();
    expect(within(dialog).getByText("Przygotować plan rozmowy")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Dodaj Działanie" }));
    expect(await screen.findByText("Przygotować plan rozmowy")).toBeInTheDocument();
  });
});
