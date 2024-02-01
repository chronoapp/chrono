import { useEffect, useRef, useCallback } from 'react'

import { WEBSOCKET_URL } from '@/util/Api'

const MAX_RECONECT_ATTEMPTS = 5
const DEBOUNCE_DELAY = 5000

type MessageHandler = (msg: string) => void

/**
 * A debounce function that will delay the execution of the callback function
 * until the delay time has passed.
 */
const debouncePerType = (func: MessageHandler, delay: number) => {
  const debounceTimers = new Map<string, any>()

  return {
    call: function (msg: string) {
      if (debounceTimers.has(msg)) {
        clearTimeout(debounceTimers.get(msg))
      }

      const timedFuncCall = setTimeout(() => {
        func(msg)
      }, delay)

      debounceTimers.set(msg, timedFuncCall)
    },

    cleanup: function () {
      debounceTimers.forEach((timer) => {
        clearTimeout(timer)
      })
    },
  }
}

/**
 * A React hook for connecting to the notifications via Websockets.
 * The caller must provide a callback function to handle messages.
 */
const useNotifications = (userId: string | null, messageHandler: (msg: string) => void) => {
  const ws = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectInterval = useRef(1000)

  const debouncedMessageHandler = useRef(debouncePerType(messageHandler, DEBOUNCE_DELAY)).current

  const connect = useCallback(() => {
    if (userId) {
      ws.current = new WebSocket(`${WEBSOCKET_URL}/${userId}`)

      ws.current.onopen = () => {
        console.debug('Connected to notification server.')
        reconnectAttempts.current = 0 // Reset on successful connection
        reconnectInterval.current = 1000 // Reset the interval on successful connection
      }

      ws.current.onmessage = (event) => {
        debouncedMessageHandler.call(event.data)
      }

      ws.current.onclose = () => {
        if (reconnectAttempts.current < MAX_RECONECT_ATTEMPTS) {
          console.debug(
            'Disconnected. Reconnect will be attempted in',
            reconnectInterval.current,
            'ms.'
          )
          setTimeout(connect, reconnectInterval.current)
          reconnectInterval.current *= 2 // Exponential backoff
          reconnectAttempts.current++
        }
      }

      ws.current.onerror = (error) => {
        ws.current && ws.current.close()
      }
    }

    return () => {
      ws.current && ws.current.close()
    }
  }, [userId])

  useEffect(() => {
    const disconnect = connect()

    return () => {
      disconnect()
      debouncedMessageHandler.cleanup()
    }
  }, [connect])

  return ws
}

export default useNotifications
