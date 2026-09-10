export interface SyncState {
  status: "idle" | "syncing" | "error";
  pendingCount: number;
  errors: Record<string, string>;
}

export interface WorkspaceMutationApplication<State> {
  /** The state after the entity-scoped optimistic change. */
  nextState: State;
  /** Restore only the entity changed by this operation. */
  rollback: (currentState: State) => State;
  /** Reapply this operation on top of a fresh server snapshot. */
  reapply?: (freshState: State) => State;
}

export interface WorkspaceMutation<State> {
  key: string;
  apply: () => WorkspaceMutationApplication<State>;
  persist: () => Promise<void>;
  reconcile?: () => Promise<State | undefined>;
}

export interface WorkspaceMutationCoordinatorOptions<State> {
  getState: () => State;
  setState: (state: State) => void;
  onError?: (key: string, error: unknown) => void;
}

interface PendingMutation<State> {
  id: number;
  key: string;
  application: WorkspaceMutationApplication<State>;
}

/**
 * Coordinates optimistic Workspace writes without coupling the flow to React,
 * a particular data client, or a particular state shape.
 */
export class WorkspaceMutationCoordinator<State> {
  private readonly lanes = new Map<string, Promise<void>>();
  private readonly pending = new Map<number, PendingMutation<State>>();
  private readonly listeners = new Set<() => void>();
  private readonly errors: Record<string, string> = {};
  private syncSnapshot: SyncState = { status: "idle", pendingCount: 0, errors: {} };
  private nextId = 0;
  private writeRevision = 0;
  private activeOperations = 0;
  private readonly idleWaiters = new Set<() => void>();
  private generation = 0;

  public constructor(private readonly options: WorkspaceMutationCoordinatorOptions<State>) {}

  public getSyncState = (): SyncState => this.syncSnapshot;

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public clearError(key: string) {
    if (!(key in this.errors)) return;
    delete this.errors[key];
    this.emit();
  }

  public recordError(key: string, error: unknown, fallback = "Nie udało się zapisać zmiany.") {
    this.errors[key] = error instanceof Error ? error.message : fallback;
    this.emit();
  }

  /** Overlay all still-active optimistic entity changes on a fresh snapshot. */
  public refresh(snapshot: State, readRevision?: number) {
    if (readRevision !== undefined && readRevision < this.writeRevision) return false;
    this.options.setState(this.withOverlays(snapshot));
    return true;
  }

  public getWriteRevision() {
    return this.writeRevision;
  }

  public whenIdle() {
    if (this.activeOperations === 0) return Promise.resolve();
    return new Promise<void>((resolve) => this.idleWaiters.add(resolve));
  }

  /** Drop local work from an old User/Workspace generation. In-flight network
   * promises cannot be cancelled here, but their completions are ignored. */
  public reset() {
    this.generation += 1;
    this.pending.clear();
    this.lanes.clear();
    for (const key of Object.keys(this.errors)) delete this.errors[key];
    this.emit();
  }

  public run(mutation: WorkspaceMutation<State>): Promise<void> {
    const previous = this.lanes.get(mutation.key) ?? Promise.resolve();
    this.activeOperations += 1;
    const task = previous.then(() => this.execute(mutation));
    const lane = task.catch(() => undefined);
    this.lanes.set(mutation.key, lane);
    void lane.finally(() => {
      if (this.lanes.get(mutation.key) === lane) this.lanes.delete(mutation.key);
      this.activeOperations -= 1;
      if (this.activeOperations === 0) {
        for (const resolve of this.idleWaiters) resolve();
        this.idleWaiters.clear();
      }
    });
    return task;
  }

  private async execute(mutation: WorkspaceMutation<State>) {
    const generation = this.generation;
    const application = mutation.apply();
    this.writeRevision += 1;
    const id = ++this.nextId;
    this.pending.set(id, { id, key: mutation.key, application });
    this.options.setState(application.nextState);
    this.emit();

    try {
      await mutation.persist();
      if (generation !== this.generation) return;
      this.pending.delete(id);
      const reconciled = await mutation.reconcile?.();
      if (reconciled !== undefined) this.options.setState(this.withOverlays(reconciled));
      this.clearError(mutation.key);
      this.emit();
    } catch (caught) {
      if (generation !== this.generation) throw caught;
      this.options.onError?.(mutation.key, caught);
      this.pending.delete(id);
      const rolledBack = application.rollback(this.options.getState());
      const reconciled = await mutation.reconcile?.().catch(() => undefined);
      this.options.setState(this.withOverlays(reconciled ?? rolledBack));
      this.errors[mutation.key] = caught instanceof Error ? caught.message : "Nie udało się zapisać zmiany.";
      this.emit();
      throw caught;
    }
  }

  private withOverlays(snapshot: State) {
    return [...this.pending.values()]
      .sort((left, right) => left.id - right.id)
      .reduce((state, pending) => pending.application.reapply?.(state) ?? state, snapshot);
  }

  private emit() {
    this.syncSnapshot = {
      status: Object.keys(this.errors).length > 0 ? "error" : this.pending.size > 0 ? "syncing" : "idle",
      pendingCount: this.pending.size,
      errors: { ...this.errors }
    };
    for (const listener of this.listeners) listener();
  }
}
