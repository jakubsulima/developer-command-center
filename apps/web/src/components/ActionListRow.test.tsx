import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GoalAction } from "../domain/types";
import { ActionListRow } from "./ActionListRow";

const action: GoalAction = {
  id: "action-1", goalId: "goal-1", title: "Opublikuj wynik", detail: "",
  status: "ready", position: 0, isNext: false, pinnedToToday: true, checklist: [], version: 1
};

const touch = { pointerId: 1, isPrimary: true, pointerType: "touch", clientX: 20, clientY: 20 };

function renderRow() {
  const onToggleComplete = vi.fn();
  const onOpenStatus = vi.fn();
  render(<MemoryRouter><ActionListRow as="div" action={action} navigation={{ breadcrumbs: [], returnTo: "/actions", returnLabel: "Działania" }} timeZone="Europe/Warsaw" today="2026-11-21" onToggleComplete={onToggleComplete} onOpenStatus={onOpenStatus} /></MemoryRouter>);
  return { button: screen.getByRole("button", { name: "Ukończ: Opublikuj wynik" }), title: screen.getByRole("link", { name: "Opublikuj wynik" }), onToggleComplete, onOpenStatus };
}

afterEach(() => vi.useRealTimers());

describe("ActionListRow", () => {
  it("kończy Działanie po krótkim dotknięciu", async () => {
    const user = userEvent.setup();
    const { button, onToggleComplete, onOpenStatus } = renderRow();
    await user.pointer({ keys: "[TouchA]", target: button });
    expect(onToggleComplete).toHaveBeenCalledOnce();
    expect(onOpenStatus).not.toHaveBeenCalled();
  });

  it("otwiera wybór statusu przy przytrzymaniu tytułu i blokuje jego kliknięcie po puszczeniu", () => {
    vi.useFakeTimers();
    const { title, onToggleComplete, onOpenStatus } = renderRow();
    fireEvent.pointerDown(title, touch);
    vi.advanceTimersByTime(499);
    expect(onOpenStatus).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onOpenStatus).toHaveBeenCalledOnce();
    fireEvent.pointerUp(title, touch);
    expect(fireEvent.click(title, { detail: 1 })).toBe(false);
    expect(onToggleComplete).not.toHaveBeenCalled();
  });

  it("anuluje przytrzymanie po przesunięciu palca", () => {
    vi.useFakeTimers();
    const { button, onToggleComplete, onOpenStatus } = renderRow();
    fireEvent.pointerDown(button, touch);
    fireEvent.pointerMove(button, { ...touch, clientY: 40 });
    vi.advanceTimersByTime(500);
    fireEvent.pointerUp(button, touch);
    fireEvent.click(button, { detail: 1 });
    expect(onOpenStatus).not.toHaveBeenCalled();
    expect(onToggleComplete).not.toHaveBeenCalled();
  });
});
