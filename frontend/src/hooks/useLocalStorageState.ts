import { useCallback, useEffect, useState } from 'react'

/** Persist a small, serializable piece of dashboard state in this browser. */
export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue
      const saved = window.localStorage.getItem(key)
      return saved === null ? initialValue : (JSON.parse(saved) as T)
    } catch {
      return initialValue
    }
  })

  const updateValue = useCallback((next: T | ((current: T) => T)) => {
    setValue(current => typeof next === 'function' ? (next as (current: T) => T)(current) : next)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // The dashboard remains usable when browser storage is unavailable.
    }
  }, [key, value])

  // Keep tabs for the same browser profile in sync.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== key) return
      try {
        setValue(event.newValue === null ? initialValue : JSON.parse(event.newValue) as T)
      } catch {
        setValue(initialValue)
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key, initialValue])

  return [value, updateValue] as const
}
