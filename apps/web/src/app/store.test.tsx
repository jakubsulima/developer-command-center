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
import { usePersistentDraft } from "../hooks/usePersistentDraft";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

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
    <span>{state.learningGoals.map((item) => item.title).join("|")}</span>
    <span data-testid="inbox-status">{state.inbox.find((item) => item.id === "in-1")?.status}</span>
    <span data-testid="visibility-status">{state.knowledge.find((item) => item.id === "know-1")?.archivedAt ? "archived" : "active"}</span>
    <span data-testid="commitment-status">{state.projects.find((item) => item.id === "portfolio-v2")?.commitmentStatus}</span>
    <span data-testid="goal-status">{state.learningGoals.find((item) => item.id === "goal-ts-modeling")?.status}</span>
    <span data-testid="ai-status">{state.aiProposal}</span><span data-testid="review-status">{state.reviewCompletedAt ? "reviewed" : "not-reviewed"}</span>{Object.values(store.syncState.errors).map((error) => <span key={error}>{error}</span>)}
    <button onClick={() => void store.capture("Nowy zdalny capture").catch(() => undefined)}>Capture</button>
    <button onClick={() => void store.resolveInbox("in-1")}>Resolve</button>
    <button onClick={() => void store.setInboxStatus("in-1", "discarded").catch(() => undefined)}>InboxStatus</button>
    <button onClick={() => void store.setVisibility("knowledge", "know-1", "archived").catch(() => undefined)}>Visibility</button>
    <button onClick={() => void store.setCommitmentStatus("portfolio-v2", "released").catch(() => undefined)}>Commitment</button>
    <button onClick={() => void store.setLearningGoalStatus("goal-ts-modeling", "abandoned", "Zmiana kierunku").catch(() => undefined)}>GoalStatus</button>
    <button onClick={() => void store.createProject({ title: "Remote Project", outcome: "Outcome", technology: "React", firstWorkItemTitle: "Work", firstWorkItemDescription: "Detail", wipOverrideReason: "Świadomy wyjątek testowy" }).catch(() => undefined)}>Project</button>
    <button onClick={() => void store.createGoal({ title: "Early Goal", outcome: "Outcome" }).catch(() => undefined)}>UnifiedGoal</button>
    <button onClick={() => void store.createLearningGoal({ title: "Remote Goal", criterion: "Criterion", skill: "Skill" }).catch(() => undefined)}>Goal</button>
    <button onClick={() => void store.setAIProposal("approved")}>AI</button>
    <button onClick={() => void store.completeReview("Decision")}>Review</button>
    <button onClick={() => void store.exportData().catch(() => undefined)}>Export</button>
    <button onClick={() => void store.reload()}>Reload</button>
  </>;
}

function DirtyDraftProbe() {
  const store = useStore();
  const draft = usePersistentDraft("goal-edit", { text: "" }, 60_000, { targetId: "goal-1" });
  return <><input aria-label="Treść lokalnego szkicu" value={draft.value.text} onChange={(event) => draft.setValue({ text: event.target.value })} /><button onClick={() => void store.reload().catch(() => undefined)}>Odśwież</button></>;
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
    for (const name of ["Resolve", "InboxStatus", "Visibility", "Commitment", "GoalStatus", "Project", "Goal", "AI", "Review", "Export", "Reload"]) await user.click(screen.getByRole("button", { name }));
    await waitFor(() => {
      expect(repository.resolveInboxRemote).toHaveBeenCalledWith("in-1");
      expect(repository.setInboxStatusRemote).toHaveBeenCalledWith("in-1", "discarded", undefined);
      expect(repository.setEntityVisibilityRemote).toHaveBeenCalledWith("know-1", "archived");
      expect(repository.setCommitmentStatusRemote).toHaveBeenCalledWith("portfolio-v2", "released");
      expect(repository.setLearningGoalStatusRemote).toHaveBeenCalledWith("goal-ts-modeling", "abandoned", "Zmiana kierunku");
      expect(repository.createProjectRemote).toHaveBeenCalled();
      expect(repository.createLearningGoalRemote).toHaveBeenCalled();
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
    expect(screen.queryByText("Brak aktywnej przestrzeni pracy.")).not.toBeInTheDocument();
  });

  it("wycofuje optymistyczne zmiany Capture, Inboxu, AI i Review po błędach synchronizacji", async () => {
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

  it("pokazuje ekran odzyskiwalnego błędu ładowania Workspace", async () => {
    repository.loadSupabaseState.mockRejectedValue(new Error("Brak połączenia"));
    const user = userEvent.setup();
    renderStore(<Probe />);
    expect(await screen.findByRole("heading", { name: "Nie udało się otworzyć przestrzeni pracy" })).toBeInTheDocument();
    expect(screen.getByText("Brak połączenia")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(repository.loadSupabaseState).toHaveBeenCalledTimes(2);
  });

  it("odtwarza bezpieczne demo po uszkodzeniu lokalnego cache", async () => {
    localStorage.setItem("command-center-state-v1", "{broken-json");
    renderStore(<Probe />, { ...auth, mode: "demo", user: { id: "demo", email: "demo@example.com", name: "Demo" } });
    expect(screen.getByText(/FinTrack API/)).toBeInTheDocument();
  });

  it("ręczny refresh przed progiem i równoczesne triggery wykonują jeden odczyt", async () => {
    const initial = { ...structuredClone(demoState), workspaceId: "workspace-1" };
    const updated = { ...structuredClone(initial), inbox: [{ ...initial.inbox[0], content: "Zmiana z drugiego klienta" }, ...initial.inbox.slice(1)] };
    const refresh = deferred<typeof updated>();
    repository.loadSupabaseState.mockReset();
    repository.loadSupabaseState.mockResolvedValueOnce(initial).mockImplementationOnce(() => refresh.promise);
    const user = userEvent.setup();
    renderStore(<Probe />);
    await screen.findByText("workspace-1");

    await user.click(screen.getByRole("button", { name: "Reload" }));
    await user.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(repository.loadSupabaseState).toHaveBeenCalledTimes(2));
    refresh.resolve(updated);
    expect(await screen.findByText("Zmiana z drugiego klienta")).toBeInTheDocument();
  });

  it("ponawia odczyt po wyścigu read/write i zachowuje zmianę optymistyczną", async () => {
    const initial = { ...structuredClone(demoState), workspaceId: "workspace-1" };
    const staleRead = deferred<typeof initial>();
    const fresh = { ...structuredClone(initial), inbox: [{ id: "server-item", kind: "text" as const, content: "Zapis klienta A", createdAt: "2026-09-08T10:00:00.000Z", status: "unprocessed" as const }, ...initial.inbox] };
    const freshRead = deferred<typeof fresh>();
    const pendingCapture = deferred<Awaited<ReturnType<typeof repository.captureRemote>>>();
    repository.loadSupabaseState.mockReset();
    repository.loadSupabaseState.mockResolvedValueOnce(initial).mockImplementationOnce(() => staleRead.promise).mockImplementationOnce(() => freshRead.promise);
    repository.captureRemote.mockImplementationOnce(() => pendingCapture.promise);
    const user = userEvent.setup();
    renderStore(<Probe />);
    await screen.findByText("workspace-1");

    await user.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(repository.loadSupabaseState).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "Capture" }));
    await waitFor(() => expect(repository.captureRemote).toHaveBeenCalled());
    staleRead.resolve(initial);
    expect(await screen.findByText("Nowy zdalny capture")).toBeInTheDocument();
    pendingCapture.resolve({ id: "server-item", kind: "text", content: "Zapis klienta A", createdAt: "2026-09-08T10:00:00.000Z", status: "unprocessed" });
    await waitFor(() => expect(repository.loadSupabaseState).toHaveBeenCalledTimes(3));
    freshRead.resolve(fresh);
    expect(await screen.findByText("Zapis klienta A")).toBeInTheDocument();
    expect(screen.queryByText("Nowy zdalny capture")).not.toBeInTheDocument();
  });

  it("nie narusza treści dirty form podczas ręcznego odświeżenia", async () => {
    const initial = { ...structuredClone(demoState), workspaceId: "workspace-1" };
    const updated = { ...structuredClone(initial), inbox: [{ ...initial.inbox[0], content: "Odświeżone dane" }, ...initial.inbox.slice(1)] };
    repository.loadSupabaseState.mockReset().mockResolvedValueOnce(initial).mockResolvedValueOnce(updated);
    const user = userEvent.setup();
    renderStore(<DirtyDraftProbe />);
    await waitFor(() => expect(repository.loadSupabaseState).toHaveBeenCalledTimes(1));
    const input = screen.getByRole("textbox", { name: "Treść lokalnego szkicu" });
    await user.type(input, "Nie zgubić tego wpisu");
    await user.click(screen.getByRole("button", { name: "Odśwież" }));
    await waitFor(() => expect(repository.loadSupabaseState).toHaveBeenCalledTimes(2));
    expect(input).toHaveValue("Nie zgubić tego wpisu");
  });

  it("ignoruje spóźnioną odpowiedź poprzedniego Usera po zmianie sesji", async () => {
    const oldRead = deferred<typeof demoState>();
    const nextState = { ...structuredClone(demoState), workspaceId: "workspace-2", inbox: [{ ...demoState.inbox[0], content: "Dane drugiego Usera" }, ...demoState.inbox.slice(1)] };
    repository.loadSupabaseState.mockReset().mockImplementation((userId: string) => userId === "user-1" ? oldRead.promise : Promise.resolve(nextState));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const firstAuth = { ...auth, user: { id: "user-1", email: "one@example.com", name: "One" } };
    const secondAuth = { ...auth, user: { id: "user-2", email: "two@example.com", name: "Two" } };
    const view = renderStore(<Probe />, firstAuth, queryClient);
    await waitFor(() => expect(repository.loadSupabaseState).toHaveBeenCalledWith("user-1"));
    view.rerender(<QueryClientProvider client={queryClient}><AuthContext.Provider value={secondAuth}><StoreProvider><Probe /></StoreProvider></AuthContext.Provider></QueryClientProvider>);
    expect(await screen.findByText("workspace-2")).toBeInTheDocument();
    oldRead.resolve({ ...structuredClone(demoState), workspaceId: "workspace-1", inbox: [{ ...demoState.inbox[0], content: "Stare dane Usera" }, ...demoState.inbox.slice(1)] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("Stare dane Usera")).not.toBeInTheDocument();
    expect(screen.getByText("Dane drugiego Usera")).toBeInTheDocument();
  });
});
