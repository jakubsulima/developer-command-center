import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { emptyState } from "../data/empty";
import type { AppState, GoalAction } from "../domain/types";
import { ActionFeedbackProvider } from "./ActionFeedback";
import { WeeklyPlanPanel, type WeeklyPlanDraft } from "./WeeklyPlanPanel";

const week = { startDate: "2026-10-05", endDate: "2026-10-11", dates: ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"] };

function action(id: string, overrides: Partial<GoalAction> = {}): GoalAction {
  return { id, version: 4, title: id, detail: "", status: "ready", position: 0, isNext: false, pinnedToToday: false, checklist: [], ...overrides };
}

function renderPlan(state: AppState, overrides: Partial<WeeklyPlanDraft> = {}, props: { updateAction?: ReturnType<typeof vi.fn>; setActionStatus?: ReturnType<typeof vi.fn>; createAction?: ReturnType<typeof vi.fn> } = {}) {
  const updateAction = (props.updateAction ?? vi.fn().mockResolvedValue(undefined)) as unknown as (actionId: string, changes: { scheduledFor: string | null }, expectedVersion: number) => Promise<void>;
  const setActionStatus = (props.setActionStatus ?? vi.fn().mockResolvedValue(undefined)) as unknown as (actionId: string, status: "cancelled" | "ready" | "in_progress" | "testing", blocker?: string, expectedVersion?: number) => Promise<void>;
  const createAction = (props.createAction ?? vi.fn().mockResolvedValue("new-action")) as unknown as (input: { title: string; goalId?: string; areaId?: string; scheduledFor?: string }, idempotencyKey?: string) => Promise<string>;
  function Harness() {
    const [value, setValue] = useState<WeeklyPlanDraft>({ selectedGoalIds: [], includeStandalone: false, changes: {}, ...overrides });
    return <WeeklyPlanPanel state={state} week={week} value={value} onChange={(next) => setValue(next(value))} updateAction={updateAction} setActionStatus={setActionStatus} createAction={createAction} />;
  }
  render(<MemoryRouter><ActionFeedbackProvider><Harness /></ActionFeedbackProvider></MemoryRouter>);
  return { updateAction, setActionStatus, createAction };
}

describe("WeeklyPlanPanel", () => {
  it("filters the agenda by a selected day without hiding other planned actions", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.actions = [action("Poniedziałek", { scheduledFor: week.dates[0] }), action("Wtorek", { scheduledFor: week.dates[1] })];
    renderPlan(state);
    const agenda = screen.getByRole("region", { name: "Działania na ten tydzień" });
    expect(within(agenda).getByRole("link", { name: "Poniedziałek" })).toBeInTheDocument();
    expect(within(agenda).getByRole("link", { name: "Wtorek" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /5 paź/ }));
    expect(within(agenda).getByRole("link", { name: "Poniedziałek" })).toBeInTheDocument();
    expect(within(agenda).queryByRole("link", { name: "Wtorek" })).not.toBeInTheDocument();
  });

  it("retries only failed overdue items and keeps blocked actions out of bulk decisions", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.actions = [
      action("late-saved", { scheduledFor: "2026-09-10" }),
      action("late-retry", { scheduledFor: "2026-09-11", version: 8 }),
      action("late-blocked", { status: "blocked", blocker: "Czekam na decyzję", scheduledFor: "2026-09-12" })
    ];
    const updateAction = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("network" )).mockResolvedValueOnce(undefined);
    const { setActionStatus } = renderPlan(state, {}, { updateAction });
    const controls = screen.getByRole("region", { name: "Rozstrzygnij zaległe Działania" });
    const checkboxes = within(controls).getAllByRole("checkbox");
    await user.click(checkboxes[0]!);
    await user.click(checkboxes[1]!);
    expect(checkboxes[2]).toBeDisabled();
    await user.selectOptions(within(controls).getByRole("combobox", { name: "Decyzja dla zaznaczonych zaległych Działań" }), "reschedule");
    await user.click(within(controls).getByRole("button", { name: "Zapisz decyzje" }));
    await screen.findByText(/late-retry: Nie zapisano/);
    expect(updateAction).toHaveBeenNthCalledWith(1, "late-saved", { scheduledFor: week.dates[0] }, 4);
    expect(updateAction).toHaveBeenNthCalledWith(2, "late-retry", { scheduledFor: week.dates[0] }, 8);
    expect(setActionStatus).not.toHaveBeenCalled();
    await user.click(within(controls).getByRole("button", { name: "Zapisz decyzje" }));
    await waitFor(() => expect(updateAction).toHaveBeenCalledTimes(3));
    expect(updateAction).toHaveBeenNthCalledWith(3, "late-retry", { scheduledFor: week.dates[0] }, 8);
  });

  it("saves the new step with its selected date and reuses its idempotency key after an uncertain failure", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-1", name: "Projekt", visibility: "active", createdAt: "", updatedAt: "" }];
    state.goals = [{ id: "goal-1", title: "Cel", outcome: "", kind: "personal", status: "active", priority: "normal", visibility: "active", areaId: "project-1" }];
    const createAction = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce("new-action");
    renderPlan(state, { selectedGoalIds: ["goal-1"] }, { createAction });
    await user.type(screen.getByRole("textbox", { name: "Nowy krok" }), "Przygotować szkic");
    await user.selectOptions(screen.getByRole("combobox", { name: "Dzień nowego kroku" }), week.dates[2]!);
    await user.click(screen.getByRole("button", { name: "Dodaj krok" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox", { name: "Nowy krok" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Dzień nowego kroku" })).toBeDisabled();
    const requestId = createAction.mock.calls[0]?.[1];
    expect(createAction).toHaveBeenNthCalledWith(1, { title: "Przygotować szkic", goalId: "goal-1", areaId: "project-1", scheduledFor: week.dates[2] }, expect.any(String));
    await user.click(screen.getByRole("button", { name: "Dodaj krok" }));
    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(2));
    expect(createAction.mock.calls[1]?.[1]).toBe(requestId);
    expect(await screen.findByText("Krok dodany i zaplanowany.")).toBeInTheDocument();
  });

  it("undoes a saved date only against the next expected version", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.actions = [action("zaplanowane", { scheduledFor: week.dates[0] })];
    const updateAction = vi.fn().mockResolvedValue(undefined);
    renderPlan(state, {}, { updateAction });
    await user.selectOptions(screen.getByRole("combobox", { name: "Dzień dla Działania: zaplanowane" }), week.dates[1]!);
    await user.click(screen.getByRole("button", { name: "Zapisz terminy" }));
    await user.click(await screen.findByRole("button", { name: "Cofnij" }));
    await waitFor(() => expect(updateAction).toHaveBeenCalledTimes(2));
    expect(updateAction).toHaveBeenNthCalledWith(2, "zaplanowane", { scheduledFor: week.dates[0] }, 5);
  });
});
