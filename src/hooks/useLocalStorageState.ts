import { useEffect, useState } from 'react'

/** Persist a small, serializable piece of dashboard state in this browser. */
export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key)
      return saved === null ? initialValue : (JSON.parse(saved) as T)
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // The dashboard remains usable when browser storage is unavailable.
    }
  }, [key, value])

  return [value, setValue] as const
}
