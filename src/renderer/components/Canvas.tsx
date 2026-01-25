import { useEffect, useRef, useCallback } from 'react'
import { RenderEngine } from '../render/RenderEngine'
import { Viewport } from '../render/viewport/Viewport'
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
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)

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

  // Track mouse down to distinguish click from drag
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  // Handle node click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!viewportRef.current || !canvasRef.current) return

    // Check if this was a drag (mouse moved significantly)
    if (mouseDownPosRef.current) {
      const dx = e.clientX - mouseDownPosRef.current.x
      const dy = e.clientY - mouseDownPosRef.current.y
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        // This was a drag, not a click
        mouseDownPosRef.current = null
        return
      }
    }
    mouseDownPosRef.current = null

    const rect = canvasRef.current.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    const worldPos = viewportRef.current.screenToWorld(screenX, screenY)

    // Find node at click position
    // Node size matches RenderEngine: 8 + importance * 12
    const state = useFieldStore.getState()
    for (const node of state.nodes.values()) {
      const dx = node.position.x - worldPos.x
      const dy = node.position.y - worldPos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const importance = node.data.type === 'knowledge' ? node.data.importance : 0.5
      const nodeSize = 8 + importance * 12

      if (dist < nodeSize) {
        if (e.shiftKey) {
          if (state.selectedNodeIds.has(node.id)) {
            state.deselectNode(node.id)
          } else {
            state.selectNode(node.id, true)
          }
        } else {
          state.selectNode(node.id)
        }
        return
      }
    }

    // Click on empty space clears selection
    state.clearSelection()
  }, [])

  // Handle double click to focus
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!viewportRef.current || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    const worldPos = viewportRef.current.screenToWorld(screenX, screenY)

    const state = useFieldStore.getState()
    for (const node of state.nodes.values()) {
      const dx = node.position.x - worldPos.x
      const dy = node.position.y - worldPos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      // Node size matches RenderEngine: 8 + importance * 12
      const importance = node.data.type === 'knowledge' ? node.data.importance : 0.5
      const nodeSize = 8 + importance * 12

      if (dist < nodeSize) {
        state.focusNode(node.id)
        return
      }
    }

    state.focusNode(null)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none'
      }}
    />
  )
}
