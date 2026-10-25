import { useEffect, useState } from 'react';

// useState that survives reloads (falls back to plain state if storage is blocked)
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
  }, [key, value]);

  return [value, setValue] as const;
}
