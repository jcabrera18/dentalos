'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [active, setActive] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Pathname changed → navigation complete
  useEffect(() => {
    if (!active) return
    timersRef.current.forEach(clearTimeout)
    setProgress(100)
    const t = setTimeout(() => setActive(false), 250)
    timersRef.current = [t]
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function start() {
      timersRef.current.forEach(clearTimeout)
      setActive(true)
      setProgress(0)
      // Simulate incremental progress until navigation resolves
      const t1 = setTimeout(() => setProgress(35), 60)
      const t2 = setTimeout(() => setProgress(60), 400)
      const t3 = setTimeout(() => setProgress(78), 1000)
      timersRef.current = [t1, t2, t3]
    }
    window.addEventListener('navigation-start', start)
    return () => window.removeEventListener('navigation-start', start)
  }, [])

  if (!active) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-[2px] pointer-events-none">
      <div
        className="h-full bg-[#00C4BC]"
        style={{
          width: `${progress}%`,
          transition: progress === 0 ? 'none' : progress === 100 ? 'width 150ms ease-in' : 'width 600ms ease-out',
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  )
}
