import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { App } from "../app/App";
import { StoreProvider } from "../app/store";
import { humanizeEntityReferences } from "../domain/humanizeAIText";

function renderReview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter initialEntries={["/review"]}><QueryClientProvider client={client}><DemoAuthProvider><StoreProvider><App /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
}

describe("AIGoalReview", () => {
  it("zamienia techniczne odwołania AI na nazwy czytelne dla użytkownika", () => {
    const labels: Array<[string, string]> = [["goal-1", "Płynna praca w terminalu"]];

    expect(humanizeEntityReferences("Czy goalId goal-1 ma przekroczyć próg aktywności?", labels))
      .toBe("Czy Cel „Płynna praca w terminalu” ma przekroczyć próg aktywności?");
    expect(humanizeEntityReferences("Sygnały missing_criteria i missing_next_action blokują postęp.", labels))
      .toBe("Sygnały brak kryteriów sukcesu i brak następnego Działania blokują postęp.");
    expect(humanizeEntityReferences("Brak missing_next_action. completed7Days: 1; progress entry.", labels))
      .toBe("Brak następnego Działania. Działania ukończone w ostatnich 7 dniach: 1; wpis postępu.");
    expect(humanizeEntityReferences("Brak missing_next_action mimo 1 completed7Days.", labels))
      .toBe("Brak następnego Działania mimo jednego Działania ukończonego w ostatnich 7 dniach.");
    expect(humanizeEntityReferences("Sygnały stallują postęp.", labels)).toBe("Sygnały wstrzymują postęp.");
  });

  it("wymaga świadomej zgody i pokazuje deterministyczną symulację", async () => {
    const user = userEvent.setup();
    renderReview();
    await screen.findByRole("heading", { name: "Przegląd Celów z AI" });
    await user.click(screen.getByRole("button", { name: "Przeanalizuj moje Cele" }));
    const consent = screen.getByRole("dialog", { name: "Zanim uruchomisz Przegląd AI" });
    expect(within(consent).getByText(/nie wysyłamy profilu/i)).toBeInTheDocument();
    await user.click(within(consent).getByRole("button", { name: /uruchom analizę/i }));
    expect(await screen.findByText("Zakres analizy")).toBeInTheDocument();
    expect(screen.getByText("Symulacja")).toBeInTheDocument();
    const target = screen.getAllByLabelText("Dotyczy")[0]!;
    expect(within(target).getByRole("link", { name: /Zbudować spokojny budżet domowy/i })).toHaveAttribute("href", "/goals/goal-budget");
  });

  it("draft AI nie zapisuje się przed zatwierdzeniem", async () => {
    const user = userEvent.setup();
    renderReview();
    await user.click(await screen.findByRole("button", { name: "Przeanalizuj moje Cele" }));
    await user.click(within(screen.getByRole("dialog", { name: "Zanim uruchomisz Przegląd AI" })).getByRole("button", { name: /uruchom analizę/i }));
    const add = await screen.findAllByRole("button", { name: "Dodaj Działanie" });
    await user.click(add[0]!);
    const dialog = screen.getByRole("dialog", { name: "Sprawdź propozycję Działania" });
    expect(within(dialog).getByText(/zapis nastąpi dopiero/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("dialog", { name: "Sprawdź propozycję Działania" })).not.toBeInTheDocument();
  });
});
