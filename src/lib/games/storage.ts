type StorageGetResult = { key: string; value: string; shared: boolean } | null;
type StorageListResult = { keys: string[]; shared: boolean } | null;

export interface StorageClient {
  get: (key: string, shared?: boolean) => Promise<StorageGetResult>;
  set: (key: string, value: string, shared?: boolean) => Promise<StorageGetResult>;
  list: (prefix?: string, shared?: boolean) => Promise<StorageListResult>;
}

function localStorageClient(): StorageClient {
  return {
    async get(key: string, shared = false) {
      try {
        const value = window.localStorage.getItem(key);
        if (value === null) {
          return null;
        }
        return { key, value, shared };
      } catch {
        return null;
      }
    },

    async set(key: string, value: string, shared = false) {
      try {
        window.localStorage.setItem(key, value);
        return { key, value, shared };
      } catch {
        return null;
      }
    },

    async list(prefix = '', shared = false) {
      try {
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            keys.push(key);
          }
        }
        return { keys, shared };
      } catch {
        return { keys: [], shared };
      }
    },
  };
}

function resolveStorage(): StorageClient {
  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  if (win?.storage && typeof win.storage.get === 'function' && typeof win.storage.set === 'function' && typeof win.storage.list === 'function') {
    return win.storage as StorageClient;
  }
  return localStorageClient();
}

export const safeStorage = resolveStorage();
