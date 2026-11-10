import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionFeedbackProvider } from "./ActionFeedback";
import { useActionFeedback } from "./action-feedback-context";

function Probe({ firstUndo, secondUndo, noticeAction }: { firstUndo: () => Promise<void> | void; secondUndo?: () => Promise<void> | void; noticeAction?: () => Promise<void> | void }) {
  const { notifyUndo, notifySuccess, notifyError } = useActionFeedback();
  return <>
    <button onClick={() => notifyUndo({ message: "Pierwsza operacja zapisana.", undo: firstUndo, action: noticeAction ? { label: "Dodaj rezultat", onClick: noticeAction } : undefined })}>Pierwsza</button>
    {secondUndo && <button onClick={() => notifyUndo({ message: "Druga operacja zapisana.", undo: secondUndo })}>Druga</button>}
    <button onClick={() => notifySuccess("Zapisano.")}>Sukces</button>
    <button onClick={() => notifyError("Brak połączenia.")}>Błąd</button>
  </>;
}

describe("ActionFeedback", () => {
  afterEach(() => vi.useRealTimers());

  it("najpierw wygasza komunikat, a potem usuwa go ze stosu", () => {
    vi.useFakeTimers();
    render(<ActionFeedbackProvider><Probe firstUndo={vi.fn()} /></ActionFeedbackProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Sukces" }));
    const slot = screen.getByRole("status").closest(".undo-notice-slot");

    act(() => vi.advanceTimersByTime(5_000));
    expect(slot).toHaveAttribute("data-leaving", "true");
    expect(slot).toHaveAttribute("inert");
    expect(screen.getByText("Zapisano.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByText("Zapisano.")).not.toBeInTheDocument();
  });

  it.each(["pointer", "focus"])("zatrzymuje czas przy interakcji %s i wznawia po jej zakończeniu", (interaction) => {
    vi.useFakeTimers();
    render(<ActionFeedbackProvider><Probe firstUndo={vi.fn()} /></ActionFeedbackProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Pierwsza" }));
    const notice = screen.getByRole("status");
    const close = within(notice).getByRole("button", { name: "Zamknij komunikat" });
    act(() => vi.advanceTimersByTime(2_000));
    if (interaction === "pointer") fireEvent.pointerEnter(notice);
    else fireEvent.focus(close);
    act(() => vi.advanceTimersByTime(10_000));
    expect(notice.closest(".undo-notice-slot")).not.toHaveAttribute("data-leaving");
    if (interaction === "pointer") fireEvent.pointerLeave(notice);
    else fireEvent.blur(close, { relatedTarget: screen.getByRole("button", { name: "Sukces" }) });
    act(() => vi.advanceTimersByTime(6_300));
    expect(notice).not.toBeInTheDocument();
  });

  it("zamyka tylko wskazany komunikat i zachowuje błędy do ręcznego zamknięcia", () => {
    vi.useFakeTimers();
    render(<ActionFeedbackProvider><Probe firstUndo={vi.fn()} /></ActionFeedbackProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Sukces" }));
    fireEvent.click(screen.getByRole("button", { name: "Błąd" }));
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Zamknij komunikat" }));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByText("Zapisano.")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("alert")).toHaveTextContent("Brak połączenia.");
  });

  it("pokazuje dostępny wynik i wykonuje komendę kompensującą", async () => {
    const undo = vi.fn();
    const user = userEvent.setup();
    render(<ActionFeedbackProvider><Probe firstUndo={undo} /></ActionFeedbackProvider>);
    await user.click(screen.getByRole("button", { name: "Pierwsza" }));
    const notice = screen.getByRole("status", { name: "" });
    expect(notice).toHaveTextContent("Pierwsza operacja zapisana.");
    await user.click(within(notice).getByRole("button", { name: "Cofnij" }));
    expect(undo).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText("Pierwsza operacja zapisana.")).not.toBeInTheDocument());
  });

  it("zachowuje kilka szybkich możliwości cofnięcia", async () => {
    const user = userEvent.setup();
    render(<ActionFeedbackProvider><Probe firstUndo={vi.fn()} secondUndo={vi.fn()} /></ActionFeedbackProvider>);
    await user.click(screen.getByRole("button", { name: "Pierwsza" }));
    await user.click(screen.getByRole("button", { name: "Druga" }));
    expect(screen.getByText("Pierwsza operacja zapisana.")).toBeInTheDocument();
    expect(screen.getByText("Druga operacja zapisana.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Cofnij" })).toHaveLength(2);
  });

  it("grupuje Cofnij i dodatkową akcję w jednym komunikacie", async () => {
    const user = userEvent.setup();
    const addResult = vi.fn();
    render(<ActionFeedbackProvider><Probe firstUndo={vi.fn()} noticeAction={addResult} /></ActionFeedbackProvider>);
    await user.click(screen.getByRole("button", { name: "Pierwsza" }));
    const notice = screen.getByRole("status", { name: "" });
    const actions = notice.querySelector(".undo-notice-actions");
    expect(actions).not.toBeNull();
    expect(within(actions as HTMLElement).getByRole("button", { name: "Cofnij" })).toBeInTheDocument();
    await user.click(within(actions as HTMLElement).getByRole("button", { name: "Dodaj rezultat" }));
    expect(addResult).toHaveBeenCalledOnce();
    await waitFor(() => expect(notice).not.toBeInTheDocument());
  });

  it("po błędzie undo pozostawia komunikat i pozwala ponowić", async () => {
    const undo = vi.fn().mockRejectedValueOnce(new Error("action_version_conflict")).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<ActionFeedbackProvider><Probe firstUndo={undo} /></ActionFeedbackProvider>);
    await user.click(screen.getByRole("button", { name: "Pierwsza" }));
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Działanie zmieniło się w międzyczasie. Odśwież widok i spróbuj ponownie.");
    await user.click(within(alert).getByRole("button", { name: "Cofnij" }));
    expect(undo).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("ogłasza globalnie błąd operacji bez akcji Cofnij", async () => {
    const user = userEvent.setup();
    render(<ActionFeedbackProvider><Probe firstUndo={vi.fn()} /></ActionFeedbackProvider>);
    await user.click(screen.getByRole("button", { name: "Błąd" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Brak połączenia.");
    expect(within(alert).queryByRole("button", { name: "Cofnij" })).not.toBeInTheDocument();
  });

  it("ogłasza sukces bez zbędnej akcji", async () => {
    const user = userEvent.setup();
    render(<ActionFeedbackProvider><Probe firstUndo={vi.fn()} /></ActionFeedbackProvider>);
    await user.click(screen.getByRole("button", { name: "Sukces" }));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Zapisano.");
    expect(within(status).queryByRole("button", { name: "Cofnij" })).not.toBeInTheDocument();
  });
});
