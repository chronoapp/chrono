import React from 'react'

type CallBack = (event: MouseEvent) => void

export const useClickOutside = (ref: React.RefObject<Element>, callback: CallBack) => {
  const callbackRef = React.useRef<CallBack>()
  callbackRef.current = callback

  React.useEffect(() => {
    const handleClick = (e) => {
      if (!ref?.current?.contains(e.target) && callbackRef.current) {
        callbackRef.current(e)
      }
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [callbackRef, ref])
}
