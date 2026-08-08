import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AuthContext, type AuthContextValue } from "../auth/auth-context";
import { demoState } from "../data/demo";
import { emptyState } from "../data/empty";
import { useStore } from "./useStore";
import { StoreProvider } from "./store";

const repository = vi.hoisted(() => ({
  loadSupabaseState: vi.fn(), captureRemote: vi.fn(), resolveInboxRemote: vi.fn(), startFocusRemote: vi.fn(),
  endFocusRemote: vi.fn(), recordLearningEvidenceRemote: vi.fn(), updateScratchpadRemote: vi.fn(),
  decideAIProposalRemote: vi.fn(), completeReviewRemote: vi.fn(), createProjectRemote: vi.fn(),
  createGoalRemote: vi.fn(), createLearningGoalRemote: vi.fn(), exportWorkspaceRemote: vi.fn(), setEntityVisibilityRemote: vi.fn(),
  setInboxStatusRemote: vi.fn(), releaseDueInboxItemsRemote: vi.fn(), setCommitmentStatusRemote: vi.fn(), setLearningGoalStatusRemote: vi.fn()
}));
vi.mock("../data/supabaseRepository", () => repository);

const auth: AuthContextValue = {
  mode: "supabase",
  user: { id: "user-1", email: "dev@example.com", name: "Dev" },
  loading: false,
  signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), continueInDemo: vi.fn()
};

function renderStore(child: ReactNode, authValue = auth, queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={authValue}><StoreProvider>{child}</StoreProvider></AuthContext.Provider></QueryClientProvider>);
}

function Probe() {
  const store = useStore();
  const { state } = store;
  return <>
    <span>{state.workspaceId}</span><span>{state.inbox[0]?.content}</span><span>{state.projects.map((item) => item.name).join("|")}</span>
    <span>{state.learningGoals.map((item) => item.title).join("|")}</span><span data-testid="focus-status">{state.focus.running ? "running" : "stopped"}</span>
    <span data-testid="inbox-status">{state.inbox.find((item) => item.id === "in-1")?.status}</span>
    <span data-testid="visibility-status">{state.knowledge.find((item) => item.id === "know-1")?.archivedAt ? "archived" : "active"}</span>
    <span data-testid="commitment-status">{state.projects.find((item) => item.id === "portfolio-v2")?.commitmentStatus}</span>
    <span data-testid="goal-status">{state.learningGoals.find((item) => item.id === "goal-ts-modeling")?.status}</span>
    <span data-testid="ai-status">{state.aiProposal}</span><span data-testid="review-status">{state.reviewCompletedAt ? "reviewed" : "not-reviewed"}</span><span>{store.error}</span>
    <button onClick={() => void store.capture("Nowy zdalny capture").catch(() => undefined)}>Capture</button>
    <button onClick={() => void store.resolveInbox("in-1")}>Resolve</button>
    <button onClick={() => void store.setInboxStatus("in-1", "discarded").catch(() => undefined)}>InboxStatus</button>
    <button onClick={() => void store.setVisibility("knowledge", "know-1", "archived").catch(() => undefined)}>Visibility</button>
    <button onClick={() => void store.setCommitmentStatus("portfolio-v2", "released").catch(() => undefined)}>Commitment</button>
    <button onClick={() => void store.setLearningGoalStatus("goal-ts-modeling", "abandoned", "Zmiana kierunku").catch(() => undefined)}>GoalStatus</button>
    <button onClick={() => void store.createProject({ title: "Remote Project", outcome: "Outcome", technology: "React", firstWorkItemTitle: "Work", firstWorkItemDescription: "Detail", wipOverrideReason: "Świadomy wyjątek testowy" }).catch(() => undefined)}>Project</button>
    <button onClick={() => void store.createGoal({ title: "Early Goal", outcome: "Outcome" }).catch(() => undefined)}>UnifiedGoal</button>
    <button onClick={() => void store.createLearningGoal({ title: "Remote Goal", criterion: "Criterion", skill: "Skill" }).catch(() => undefined)}>Goal</button>
    <button onClick={() => void store.startFocus()}>Start</button>
    <button onClick={() => void store.pauseFocus({ currentState: "State", nextAction: "Next", evidence: { learningGoalId: "goal-ts-modeling", title: "Evidence", result: "supports", feedback: "Good" } })}>Pause</button>
    <button onClick={() => store.updateScratchpad("Remote scratchpad")}>Scratch</button>
    <button onClick={() => void store.setAIProposal("approved")}>AI</button>
    <button onClick={() => void store.completeReview("Decision")}>Review</button>
    <button onClick={() => void store.exportData().catch(() => undefined)}>Export</button>
    <button onClick={() => void store.reload()}>Reload</button>
  </>;
}

describe("StoreProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.loadSupabaseState.mockResolvedValue({ ...structuredClone(demoState), workspaceId: "workspace-1", aiProposalId: "proposal-1" });
    repository.captureRemote.mockImplementation(async (_workspace: string, content: string) => ({ id: "server-item", kind: "text", content, createdAt: "2026-08-01T08:00:00Z", status: "unprocessed" }));
    repository.startFocusRemote.mockResolvedValue({ id: "server-session", startedAt: Date.now() });
    repository.exportWorkspaceRemote.mockResolvedValue({ format: "export" });
  });

  it("ładuje prywatny Workspace i zapisuje capture przez repozytorium", async () => {
    const user = userEvent.setup();
    renderStore(<Probe />);
    expect(await screen.findByText("workspace-1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Capture" }));
    await waitFor(() => expect(repository.captureRemote).toHaveBeenCalledWith("workspace-1", "Nowy zdalny capture", "text", expect.any(String)));
    expect(await screen.findByText("Nowy zdalny capture")).toBeInTheDocument();
  });

  it("wykonuje zdalne komendy projektu, celu, Inboxu, Focus, AI, Review i eksportu", async () => {
    const user = userEvent.setup();
    renderStore(<Probe />);
    await screen.findByText("workspace-1");
    for (const name of ["Resolve", "InboxStatus", "Visibility", "Commitment", "GoalStatus", "Project", "Goal", "Start", "Scratch", "AI", "Review", "Export", "Reload"]) await user.click(screen.getByRole("button", { name }));
    await waitFor(() => expect(repository.startFocusRemote).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => {
      expect(repository.resolveInboxRemote).toHaveBeenCalledWith("in-1");
      expect(repository.setInboxStatusRemote).toHaveBeenCalledWith("in-1", "discarded", undefined);
      expect(repository.setEntityVisibilityRemote).toHaveBeenCalledWith("know-1", "archived");
      expect(repository.setCommitmentStatusRemote).toHaveBeenCalledWith("portfolio-v2", "released");
      expect(repository.setLearningGoalStatusRemote).toHaveBeenCalledWith("goal-ts-modeling", "abandoned", "Zmiana kierunku");
      expect(repository.createProjectRemote).toHaveBeenCalled();
      expect(repository.createLearningGoalRemote).toHaveBeenCalled();
      expect(repository.endFocusRemote).toHaveBeenCalledWith("server-session", "paused", "State", "Next");
      expect(repository.recordLearningEvidenceRemote).toHaveBeenCalled();
      expect(repository.decideAIProposalRemote).toHaveBeenCalledWith("proposal-1", "approved");
      expect(repository.completeReviewRemote).toHaveBeenCalledWith("workspace-1", "Decision");
      expect(repository.exportWorkspaceRemote).toHaveBeenCalledWith("workspace-1");
    });
  });

  it("wycofuje optymistyczny projekt i pokazuje błąd po odrzuceniu komendy", async () => {
    repository.createProjectRemote.mockRejectedValueOnce(new Error("wip_limit_reached"));
    const user = userEvent.setup();
    renderStore(<Probe />);
    await screen.findByText("workspace-1");
    await user.click(screen.getByRole("button", { name: "Project" }));
    await waitFor(() => expect(screen.getByText("wip_limit_reached")).toBeInTheDocument());
    expect(screen.queryByText(/Remote Project/)).not.toBeInTheDocument();
  });

  it("odświeża brakujący kontekst Workspace przed utworzeniem Celu", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["workspace-state", "user-1"], structuredClone(emptyState));
    const user = userEvent.setup();
    renderStore(<Probe />, auth, queryClient);

    await user.click(screen.getByRole("button", { name: "UnifiedGoal" }));

    await waitFor(() => expect(repository.createGoalRemote).toHaveBeenCalledWith(
      "workspace-1",
      expect.any(String),
      undefined,
      expect.objectContaining({ title: "Early Goal", outcome: "Outcome" }),
      [],
      expect.any(String)
    ));
    expect(screen.queryByText("Brak aktywnego Workspace.")).not.toBeInTheDocument();
  });

  it("wycofuje optymistyczne zmiany Capture, Inboxu, Focus, AI i Review po błędach synchronizacji", async () => {
    const user = userEvent.setup();
    renderStore(<Probe />);
    await screen.findByText("workspace-1");

    repository.captureRemote.mockRejectedValueOnce(new Error("capture_failed"));
    await user.click(screen.getByRole("button", { name: "Capture" }));
    await screen.findByText("capture_failed");
    expect(screen.queryByText("Nowy zdalny capture")).not.toBeInTheDocument();

    repository.resolveInboxRemote.mockRejectedValueOnce(new Error("resolve_failed"));
    await user.click(screen.getByRole("button", { name: "Resolve" }));
    await screen.findByText("resolve_failed");
    expect(screen.getByTestId("inbox-status")).toHaveTextContent("unprocessed");

    repository.startFocusRemote.mockRejectedValueOnce(new Error("focus_failed"));
    await user.click(screen.getByRole("button", { name: "Start" }));
    await screen.findByText("focus_failed");
    expect(screen.getByTestId("focus-status")).toHaveTextContent("stopped");

    repository.decideAIProposalRemote.mockRejectedValueOnce(new Error("ai_failed"));
    await user.click(screen.getByRole("button", { name: "AI" }));
    await screen.findByText("ai_failed");
    expect(screen.getByTestId("ai-status")).toHaveTextContent("pending");

    repository.completeReviewRemote.mockRejectedValueOnce(new Error("review_failed"));
    await user.click(screen.getByRole("button", { name: "Review" }));
    await screen.findByText("review_failed");
    expect(screen.getByTestId("review-status")).toHaveTextContent("not-reviewed");
  });

  it("wycofuje odwracalne statusy po błędzie repozytorium", async () => {
    repository.setInboxStatusRemote.mockRejectedValueOnce(new Error("inbox_status_failed"));
    repository.setEntityVisibilityRemote.mockRejectedValueOnce(new Error("visibility_failed"));
    repository.setCommitmentStatusRemote.mockRejectedValueOnce(new Error("commitment_failed"));
    repository.setLearningGoalStatusRemote.mockRejectedValueOnce(new Error("goal_status_failed"));
    const user = userEvent.setup();
    renderStore(<Probe />);
    await screen.findByText("workspace-1");

    await user.click(screen.getByRole("button", { name: "InboxStatus" }));
    await waitFor(() => expect(screen.getByTestId("inbox-status")).toHaveTextContent("unprocessed"));
    await user.click(screen.getByRole("button", { name: "Visibility" }));
    await waitFor(() => expect(screen.getByTestId("visibility-status")).toHaveTextContent("active"));
    await user.click(screen.getByRole("button", { name: "Commitment" }));
    await waitFor(() => expect(screen.getByTestId("commitment-status")).toHaveTextContent("active"));
    await user.click(screen.getByRole("button", { name: "GoalStatus" }));
    await waitFor(() => expect(screen.getByTestId("goal-status")).toHaveTextContent("shaped"));
  });

  it("zapisuje scratchpad z opóźnieniem dla aktywnej zdalnej sesji", async () => {
    const user = userEvent.setup();
    renderStore(<Probe />);
    await screen.findByText("workspace-1");
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(screen.getByTestId("focus-status")).toHaveTextContent("running"));
    await user.click(screen.getByRole("button", { name: "Scratch" }));
    await waitFor(
      () => expect(repository.updateScratchpadRemote).toHaveBeenCalledWith("server-session", "Remote scratchpad"),
      { timeout: 1_500 }
    );
  });

  it("pokazuje ekran odzyskiwalnego błędu ładowania Workspace", async () => {
    repository.loadSupabaseState.mockRejectedValue(new Error("Brak połączenia"));
    const user = userEvent.setup();
    renderStore(<Probe />);
    expect(await screen.findByRole("heading", { name: "Nie udało się otworzyć Workspace" })).toBeInTheDocument();
    expect(screen.getByText("Brak połączenia")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(repository.loadSupabaseState).toHaveBeenCalledTimes(2);
  });

  it("odtwarza bezpieczne demo po uszkodzeniu lokalnego cache", async () => {
    localStorage.setItem("command-center-state-v1", "{broken-json");
    renderStore(<Probe />, { ...auth, mode: "demo", user: { id: "demo", email: "demo@example.com", name: "Demo" } });
    expect(screen.getByText(/FinTrack API/)).toBeInTheDocument();
  });
});
