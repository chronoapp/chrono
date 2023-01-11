import { useState } from 'react'

export function getLocalStorageItem(keyName: string, defaultValue: any) {
  try {
    const value = window.localStorage.getItem(keyName)
    if (value) {
      return JSON.parse(value)
    } else {
      window.localStorage.setItem(keyName, JSON.stringify(defaultValue))

      return defaultValue
    }
  } catch (err) {
    return defaultValue
  }
}

export function setLocalStorageItem(keyName: string, newValue: any) {
  try {
    window.localStorage.setItem(keyName, JSON.stringify(newValue))
  } catch (err) {}
}

export function useLocalStorage(keyName: string, defaultValue: any) {
  const [storedValue, setStoredValue] = useState(() => {
    return getLocalStorageItem(keyName, defaultValue)
  })

  const setValue = (newValue) => {
    setLocalStorageItem(keyName, newValue)
    setStoredValue(newValue)
  }

  return [storedValue, setValue]
}
