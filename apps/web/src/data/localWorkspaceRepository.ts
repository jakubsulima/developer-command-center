import { executeDomainCommand, type DomainCommand } from "../domain/commands";
import type { AppState } from "../domain/types";
import { emptyState } from "./empty";

const DATABASE_NAME = "developer-command-center";
const STORE_NAME = "workspace";
const STATE_KEY = "active";
const FALLBACK_KEY = "command-center-local-workspace-v2";
const SCHEMA_VERSION = 2;

interface StoredWorkspace {
  version: number;
  savedAt: string;
  state: AppState;
}

export interface WorkspaceRepository {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  execute(command: DomainCommand): Promise<AppState>;
  export(): Promise<{ format: string; version: number; exportedAt: string; state: AppState }>;
  clear(): Promise<void>;
}

interface LocalRepositoryOptions {
  indexedDb: IDBFactory | undefined;
  storage: Storage;
}

function envelope(state: AppState): StoredWorkspace {
  return { version: SCHEMA_VERSION, savedAt: new Date().toISOString(), state: structuredClone(state) };
}

function openDatabase(factory: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexed_db_open_failed"));
  });
}

async function readIndexedDb(factory: IDBFactory) {
  const database = await openDatabase(factory);
  return new Promise<StoredWorkspace | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve((request.result as StoredWorkspace | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("indexed_db_read_failed"));
    transaction.oncomplete = () => database.close();
  });
}

async function writeIndexedDb(factory: IDBFactory, value: StoredWorkspace | null) {
  const database = await openDatabase(factory);
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    if (value) store.put(value, STATE_KEY);
    else store.delete(STATE_KEY);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("indexed_db_write_failed")); };
  });
}

export function createLocalWorkspaceRepository(options: LocalRepositoryOptions = {
  indexedDb: globalThis.indexedDB,
  storage: globalThis.localStorage
}): WorkspaceRepository {
  const { indexedDb, storage } = options;

  const load = async () => {
    const stored = indexedDb
      ? await readIndexedDb(indexedDb)
      : JSON.parse(storage.getItem(FALLBACK_KEY) ?? "null") as StoredWorkspace | null;
    if (!stored?.state) return null;
    return structuredClone(stored.state);
  };

  const save = async (state: AppState) => {
    const stored = envelope(state);
    if (indexedDb) await writeIndexedDb(indexedDb, stored);
    else storage.setItem(FALLBACK_KEY, JSON.stringify(stored));
  };

  return {
    load,
    save,
    async execute(command) {
      const current = await load() ?? structuredClone(emptyState);
      const next = executeDomainCommand(current, command);
      await save(next);
      return next;
    },
    async export() {
      return {
        format: "developer-command-center/export",
        version: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        state: await load() ?? structuredClone(emptyState)
      };
    },
    async clear() {
      if (indexedDb) await writeIndexedDb(indexedDb, null);
      else storage.removeItem(FALLBACK_KEY);
    }
  };
}
