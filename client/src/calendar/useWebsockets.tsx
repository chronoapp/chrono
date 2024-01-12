import { useEffect, useRef, useCallback } from 'react'

const useWebSocket = (url) => {
  const ws = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const reconnectInterval = useRef(1000) // Start with 1 second

  const connect = useCallback(() => {
    ws.current = new WebSocket(url)

    ws.current.onopen = () => {
      console.debug('Connected to notification server.')
      reconnectAttempts.current = 0 // Reset on successful connection
      reconnectInterval.current = 1000 // Reset the interval on successful connection
    }

    ws.current.onmessage = (event) => {
      console.debug(event.data)
    }

    ws.current.onclose = () => {
      if (reconnectAttempts.current < maxReconnectAttempts) {
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

    return () => {
      ws.current && ws.current.close()
    }
  }, [url])

  useEffect(() => {
    const disconnect = connect()

    return () => {
      disconnect()
    }
  }, [connect])

  return ws
}

export default useWebSocket
