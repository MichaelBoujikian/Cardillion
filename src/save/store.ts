/**
 * The slice of the Web Storage interface the save layer needs, so the adapters are pure and
 * testable in Node. The browser passes `localStorage`; tests pass a MemoryStore.
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory store for tests. `failing` makes every call throw, like a blocked localStorage. */
export class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, string>();
  failing = false;

  getItem(key: string): string | null {
    if (this.failing) throw new Error('storage unavailable');
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failing) throw new Error('storage unavailable');
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    if (this.failing) throw new Error('storage unavailable');
    this.map.delete(key);
  }
}
