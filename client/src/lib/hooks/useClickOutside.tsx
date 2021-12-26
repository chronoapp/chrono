import React from 'react'

type CallBack = (event: MouseEvent) => void

const useClickOutside = (ref: React.RefObject<Element>, callback: CallBack) => {
  const handleClick = (e) => {
    if (ref.current && !ref.current.contains(e.target)) {
      callback(e)
    }
  }
  React.useEffect(() => {
    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  })
}

export default useClickOutside
