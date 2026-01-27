import { useEffect, useState, useRef } from 'react'

const UPDATE_INTERVAL_MS = 400
const SAMPLE_SIZE = 30

export function PerformanceMonitor() {
  const [fps, setFps] = useState(0)
  const [frameMs, setFrameMs] = useState(0)
  const lastRef = useRef<number>(0)
  const samplesRef = useRef<number[]>([])
  const rafRef = useRef<number>(0)
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0)

  useEffect(() => {
    const measure = (now: number) => {
      const delta = lastRef.current ? now - lastRef.current : 0
      lastRef.current = now

      if (delta > 0 && delta < 500) {
        samplesRef.current.push(delta)
        if (samplesRef.current.length > SAMPLE_SIZE) {
          samplesRef.current.shift()
        }
      }

      rafRef.current = requestAnimationFrame(measure)
    }

    rafRef.current = requestAnimationFrame((now) => {
      lastRef.current = now
      rafRef.current = requestAnimationFrame(measure)
    })

    const scheduleUpdate = () => {
      updateTimeoutRef.current = setTimeout(() => {
        const arr = samplesRef.current
        if (arr.length > 0) {
          const avg = arr.reduce((a, b) => a + b, 0) / arr.length
          setFrameMs(Math.round(avg * 10) / 10)
          setFps(Math.round(1000 / avg))
        }
        scheduleUpdate()
      }, UPDATE_INTERVAL_MS)
    }
    scheduleUpdate()

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(updateTimeoutRef.current)
    }
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 400,
        padding: '6px 10px',
        background: '#1a1a24',
        border: '1px solid #2a2a3a',
        borderRadius: 4,
        color: '#666',
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        userSelect: 'none'
      }}
    >
      <div>FPS: {fps}</div>
      <div>Frame: {frameMs}ms</div>
    </div>
  )
}
