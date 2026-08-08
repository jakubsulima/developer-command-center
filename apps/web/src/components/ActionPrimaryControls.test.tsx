import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GoalAction } from "../domain/types";
import { ActionPrimaryControls } from "./ActionPrimaryControls";

const action: GoalAction = {
  id: "action-1", goalId: "goal-1", title: "Opublikuj wynik", detail: "",
  status: "ready", position: 0, isNext: false, pinnedToToday: true, checklist: [], version: 1
};

describe("ActionPrimaryControls", () => {
  it("udostępnia wspólne akcje Ukończ, Następne i Więcej", async () => {
    const user = userEvent.setup();
    const onToggleComplete = vi.fn();
    const onSetNext = vi.fn();
    const onMore = vi.fn();
    render(<ActionPrimaryControls action={action} busy={false} onToggleComplete={onToggleComplete} onSetNext={onSetNext} onMore={onMore} />);

    await user.click(screen.getByRole("button", { name: "Ukończ: Opublikuj wynik" }));
    await user.click(screen.getByRole("button", { name: "Ustaw następne" }));
    await user.click(screen.getByRole("button", { name: "Więcej opcji: Opublikuj wynik" }));
    expect(onToggleComplete).toHaveBeenCalledOnce();
    expect(onSetNext).toHaveBeenCalledOnce();
    expect(onMore).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Ustaw następne" })).toHaveAttribute("aria-pressed", "false");
  });
});
