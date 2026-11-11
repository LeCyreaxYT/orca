import { useCallback, useRef, useState } from 'react'

export function useWorktreeListIntro() {
  const [height, setHeight] = useState(0)
  const observer = useRef<ResizeObserver | null>(null)
  const introRef = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!node) {
      setHeight(0)
      return
    }
    const measure = () => setHeight(node.getBoundingClientRect().height)
    measure()
    observer.current = new ResizeObserver(measure)
    observer.current.observe(node, { box: 'border-box' })
  }, [])
  return { introRef, height }
}
