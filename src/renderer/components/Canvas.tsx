import { useEffect, useRef } from 'react'
import { RenderEngine } from '../render/RenderEngine'
import { Viewport } from '../render/viewport/Viewport'
import { InteractionEngine } from '../interaction/InteractionEngine'
import { useFieldStore } from '../core/store/fieldStore'
import { useViewportStore } from '../core/store/viewportStore'
import type { LensResult } from '../semantic/lens/LensEngine'

interface CanvasProps {
  lensResult?: LensResult
}

export function Canvas({ lensResult }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<RenderEngine | null>(null)
  const viewportRef = useRef<Viewport | null>(null)
  const interactionRef = useRef<InteractionEngine | null>(null)

  const nodes = useFieldStore((state) => state.nodes)
  const edges = useFieldStore((state) => state.edges)
  const selectedNodeIds = useFieldStore((state) => state.selectedNodeIds)
  const focusedNodeId = useFieldStore((state) => state.focusedNodeId)

  const panX = useViewportStore((state) => state.panX)
  const panY = useViewportStore((state) => state.panY)
  const scale = useViewportStore((state) => state.scale)

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new RenderEngine(canvas)
    engineRef.current = engine

    const viewport = new Viewport({ canvas })
    viewportRef.current = viewport

    const interaction = new InteractionEngine(canvas)
    interactionRef.current = interaction

    // Set initial size and synchronize both engine and viewport
    const resize = (width: number, height: number) => {
      engine.resize(width, height)
      viewport.handleResize() // Update viewport store after engine resize
    }

    // Initial size using getBoundingClientRect (only for initial setup)
    const initialRect = canvas.getBoundingClientRect()
    resize(initialRect.width, initialRect.height)

    // Use ResizeObserver entry data for accurate size detection
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use borderBoxSize (modern) or contentRect (legacy)
        let width: number
        let height: number

        if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
          width = entry.borderBoxSize[0].inlineSize
          height = entry.borderBoxSize[0].blockSize
        } else {
          // Fallback to contentRect for older browsers
          width = entry.contentRect.width
          height = entry.contentRect.height
        }

        resize(width, height)
      }
    })

    // Observe the canvas's parent container for more reliable detection
    const parentElement = canvas.parentElement
    if (parentElement) {
      resizeObserver.observe(parentElement)
    } else {
      // Fallback to canvas if no parent
      resizeObserver.observe(canvas)
    }

    // Keep window resize as fallback
    const windowResizeHandler = () => {
      const rect = canvas.getBoundingClientRect()
      resize(rect.width, rect.height)
    }
    window.addEventListener('resize', windowResizeHandler)

    engine.initialize().then(() => {
      engine.startRenderLoop()
    })

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', windowResizeHandler)
      interactionRef.current?.destroy()
      interactionRef.current = null
      engine.destroy()
      viewport.destroy()
    }
  }, [])

  // Update nodes
  useEffect(() => {
    engineRef.current?.updateNodes(nodes)
  }, [nodes])

  // Update edges
  useEffect(() => {
    engineRef.current?.updateEdges(edges)
  }, [edges])

  // Update render state
  useEffect(() => {
    engineRef.current?.updateRenderState({
      panX,
      panY,
      scale,
      selectedNodeIds,
      focusedNodeId,
      lens: lensResult ? {
        emphasized: lensResult.emphasized,
        dimmed: lensResult.dimmed,
        sizeMultipliers: lensResult.sizeMultipliers
      } : undefined
    })
  }, [panX, panY, scale, selectedNodeIds, focusedNodeId, lensResult])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none'
      }}
    />
  )
}
