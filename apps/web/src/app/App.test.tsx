import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { StoreProvider } from "./store";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { emptyState } from "../data/empty";

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

describe("Developer Command Center", () => {
  it("przechwytuje treść bez wcześniejszej klasyfikacji", async () => {
    const user = userEvent.setup();
    renderApp("/inbox");

    const capture = screen.getByPlaceholderText("Zapisz myśl, zadanie lub link…");
    await user.type(capture, "Sprawdzić indeks na tabeli transakcji");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));

    expect(screen.getAllByText("Sprawdzić indeks na tabeli transakcji").length).toBeGreaterThanOrEqual(1);
    expect(capture).toHaveValue("");
  });

  it("prowadzi od rozpoczęcia focusu do obowiązkowego checkpointu", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Rozpocznij fokus" }));
    expect(await screen.findByText("Sesja fokusowa")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zapisz checkpoint" }));
    await user.type(screen.getByLabelText("Aktualny stan"), "Diagram ERD obejmuje konta i transakcje.");
    await user.type(screen.getByLabelText("Następna fizyczna akcja"), "Dodać ograniczenia integralności.");
    await user.selectOptions(screen.getByLabelText(/Learning Evidence/), "goal-ts-modeling");
    await user.type(screen.getByLabelText("Nazwa ocenionej próby"), "Obrona modelu danych");
    await user.type(screen.getByLabelText("Ocena / feedback"), "Relacje zostały poprawnie uzasadnione.");
    await user.click(screen.getByRole("button", { name: "Zapisz i zakończ" }));

    expect(screen.getByRole("button", { name: "Wznów fokus" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("link", { name: "Nauka" })[0]!);
    expect(await screen.findByText("Obrona modelu danych")).toBeInTheDocument();
  });

  it("tworzy ukształtowany projekt i uruchamia jego pierwszy Work Item", async () => {
    localStorage.setItem("command-center-state-v1", JSON.stringify(emptyState));
    const user = userEvent.setup();
    renderApp("/projects");

    await user.click(screen.getByRole("button", { name: "Nowy projekt" }));
    const dialog = screen.getByRole("dialog", { name: "Ukształtuj nowy projekt" });
    await user.type(within(dialog).getByLabelText("Nazwa projektu"), "Nowy produkt");
    await user.type(within(dialog).getByLabelText("Outcome — obserwowalna zmiana"), "Użytkownik kończy pierwszy przepływ");
    await user.type(within(dialog).getByLabelText("Technologie"), "React, Supabase");
    await user.type(within(dialog).getByLabelText("Pierwszy fizyczny krok"), "Zbuduj formularz startowy");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz projekt" }));

    expect(await screen.findByText("Nowy produkt")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Otwórz workspace" }));
    await user.click(screen.getByRole("button", { name: "Rozpocznij fokus" }));
    expect(await screen.findByRole("heading", { name: "Użytkownik kończy pierwszy przepływ" })).toBeInTheDocument();
    expect(screen.getByText("Zbuduj formularz startowy")).toBeInTheDocument();
  });

  it("prowadzi pusty Workspace od rezultatu do uruchomionej pierwszej Focus Session", async () => {
    localStorage.setItem("command-center-state-v1", JSON.stringify(emptyState));
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Rozpocznij pierwszy fokus" }));
    const dialog = screen.getByRole("dialog", { name: "Przygotuj pierwszy fokus" });
    const outcome = within(dialog).getByLabelText("Rezultat");
    await user.type(outcome, "Klienci mogą samodzielnie zresetować hasło");
    await user.click(within(dialog).getByRole("button", { name: "Dalej" }));

    const action = within(dialog).getByLabelText("Pierwsza konkretna akcja");
    await user.type(action, "Dodać formularz prośby o reset hasła");
    await user.click(within(dialog).getByRole("button", { name: "Wstecz" }));
    expect(within(dialog).getByLabelText("Rezultat")).toHaveValue("Klienci mogą samodzielnie zresetować hasło");
    await user.click(within(dialog).getByRole("button", { name: "Dalej" }));
    expect(within(dialog).getByLabelText("Pierwsza konkretna akcja")).toHaveValue("Dodać formularz prośby o reset hasła");

    await user.click(within(dialog).getByRole("button", { name: "Utwórz pierwszy krok" }));
    const readyDialog = await screen.findByRole("dialog", { name: "Wszystko gotowe" });
    await user.click(within(readyDialog).getByRole("button", { name: "Rozpocznij fokus" }));

    expect(await screen.findByRole("heading", { name: "Klienci mogą samodzielnie zresetować hasło" })).toBeInTheDocument();
    expect(screen.getByText("Dodać formularz prośby o reset hasła")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pauza" })).toBeInTheDocument();
  });
});
