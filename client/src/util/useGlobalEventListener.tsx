import { useEffect } from 'react'
import { GlobalEvent } from '@/util/global'

/**
 * Custom hook for components to attach event listeners
 * to Global Events.
 */
export default function useGlobalEventListener(
  eventName: GlobalEvent,
  handler,
  element = document
) {
  useEffect(() => {
    element.addEventListener(eventName, handler)
    return () => {
      element.removeEventListener(eventName, handler)
    }
  }, [eventName, handler, element])
}
