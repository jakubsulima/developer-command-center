export const WORKSPACE_FRESHNESS_THRESHOLD_MS = 30_000;

export type WorkspaceFreshnessStatus = "idle" | "refreshing" | "success" | "error";

export interface WorkspaceFreshnessState {
  status: WorkspaceFreshnessStatus;
  lastSuccessfulAt?: number;
  error?: string;
}

interface WorkspaceDataFreshnessOptions {
  now?: () => number;
  onChange?: (state: WorkspaceFreshnessState) => void;
}

/**
 * Serialises focus/online/manual refresh triggers and keeps read freshness
 * separate from the mutation coordinator's pending-write state.
 */
export class WorkspaceDataFreshness {
  private readonly now: () => number;
  private readonly onChange?: (state: WorkspaceFreshnessState) => void;
  private state: WorkspaceFreshnessState = { status: "idle" };
  private inFlight?: Promise<unknown>;
  private generation = 0;

  public constructor(options: WorkspaceDataFreshnessOptions = {}) {
    this.now = options.now ?? Date.now;
    this.onChange = options.onChange;
  }

  public getSnapshot = () => this.state;

  public isRefreshing() {
    return Boolean(this.inFlight);
  }

  public markSuccessful(at = this.now()) {
    this.state = { status: "success", lastSuccessfulAt: at };
    this.onChange?.(this.state);
  }

  public reset() {
    this.generation += 1;
    this.inFlight = undefined;
    this.state = { status: "idle" };
    this.onChange?.(this.state);
  }

  public request<T>(read: () => Promise<T>, force = false): Promise<T | undefined> {
    if (this.inFlight) return this.inFlight as Promise<T | undefined>;
    const lastSuccessfulAt = this.state.lastSuccessfulAt;
    if (!force && lastSuccessfulAt !== undefined && this.now() - lastSuccessfulAt <= WORKSPACE_FRESHNESS_THRESHOLD_MS) {
      return Promise.resolve(undefined);
    }

    const generation = this.generation;
    this.state = { ...this.state, status: "refreshing", error: undefined };
    this.onChange?.(this.state);
    const task = read().then((value) => {
      if (generation !== this.generation) return undefined;
      this.state = { status: "success", lastSuccessfulAt: this.now() };
      this.onChange?.(this.state);
      return value;
    }).catch((error: unknown) => {
      if (generation === this.generation) {
        this.state = { ...this.state, status: "error", error: error instanceof Error ? error.message : "Nie udało się odświeżyć danych." };
        this.onChange?.(this.state);
      }
      throw error;
    }).finally(() => {
      if (generation === this.generation) this.inFlight = undefined;
    });
    this.inFlight = task;
    return task;
  }
}
