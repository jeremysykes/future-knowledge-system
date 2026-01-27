import { useEffect, useRef, useCallback } from 'react'
import { useFieldStore } from '../../core/store/fieldStore'
import { eventBus } from '../../core/events/eventBus'
import { getEdgeDistance, getEdgeStrengthMultiplier } from '../../core/types/edge'

interface NodeData {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  fx?: number | null
  fy?: number | null
}

interface EdgeData {
  id: string
  source: string
  target: string
  strength: number
  distance: number
}

interface ForceConfig {
  chargeStrength: number
  linkStrength: number
  centerStrength: number
  collideRadius: number
  alphaDecay: number
  velocityDecay: number
}

const DEFAULT_CONFIG: ForceConfig = {
  chargeStrength: -300,
  linkStrength: 0.3,
  centerStrength: 0.01,
  collideRadius: 35,
  alphaDecay: 0.02,
  velocityDecay: 0.3
}

export function useForceSimulation(config: Partial<ForceConfig> = {}) {
  const workerRef = useRef<Worker | null>(null)
  const isInitializedRef = useRef(false)
  const configRef = useRef({ ...DEFAULT_CONFIG, ...config })

  const nodes = useFieldStore((state) => state.nodes)
  const edges = useFieldStore((state) => state.edges)
  const focusedNodeId = useFieldStore((state) => state.focusedNodeId)
  const draggedNodeId = useFieldStore((state) => state.draggedNodeId)
  const bulkUpdatePositions = useFieldStore((state) => state.bulkUpdatePositions)
  const setSimulationRunning = useFieldStore((state) => state.setSimulationRunning)

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL('../../../../workers/forceWorker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (e) => {
      const message = e.data

      switch (message.type) {
        case 'ready':
          isInitializedRef.current = true
          worker.postMessage({
            type: 'setGravitySource',
            focusedNodeId: useFieldStore.getState().focusedNodeId,
            draggedNodeId: useFieldStore.getState().draggedNodeId
          })
          break

        case 'tick': {
          const positions = new Map<string, { x: number; y: number; vx?: number; vy?: number }>()
          for (const pos of message.positions) {
            positions.set(pos.id, { x: pos.x, y: pos.y, vx: pos.vx, vy: pos.vy })
          }
          bulkUpdatePositions(positions)
          eventBus.emit('simulation:tick', { positions })
          break
        }

        case 'stabilized':
          eventBus.emit('simulation:stabilized', {})
          break
      }
    }

    worker.postMessage({ type: 'init', config: configRef.current })
    workerRef.current = worker

    return () => {
      worker.terminate()
      workerRef.current = null
      isInitializedRef.current = false
    }
  }, [bulkUpdatePositions])

  // Sync nodes with worker
  useEffect(() => {
    if (!workerRef.current || !isInitializedRef.current) return

    const nodeData: NodeData[] = Array.from(nodes.values()).map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      vx: node.velocity.vx,
      vy: node.velocity.vy,
      fx: node.fx,
      fy: node.fy
    }))

    workerRef.current.postMessage({ type: 'updateNodes', nodes: nodeData })
  }, [nodes])

  // Sync edges with worker
  useEffect(() => {
    if (!workerRef.current || !isInitializedRef.current) return

    const edgeData: EdgeData[] = Array.from(edges.values()).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      strength: edge.strength * getEdgeStrengthMultiplier(edge.type),
      distance: getEdgeDistance(edge.type)
    }))

    workerRef.current.postMessage({ type: 'updateEdges', edges: edgeData })
  }, [edges])

  // Sync gravity source (dragged > focused) with worker
  useEffect(() => {
    if (!workerRef.current) return
    workerRef.current.postMessage({ type: 'setGravitySource', focusedNodeId, draggedNodeId })
  }, [focusedNodeId, draggedNodeId])

  const start = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'start' })
      setSimulationRunning(true)
    }
  }, [setSimulationRunning])

  const stop = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'stop' })
      setSimulationRunning(false)
    }
  }, [setSimulationRunning])

  const reheat = useCallback((alpha: number = 0.3) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'reheat', alpha })
    }
  }, [])

  const pinNode = useCallback((nodeId: string, x: number, y: number) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'pinNode', nodeId, x, y })
    }
  }, [])

  const unpinNode = useCallback((nodeId: string) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'unpinNode', nodeId })
    }
  }, [])

  const updateConfig = useCallback((newConfig: Partial<ForceConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig }
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'updateConfig', config: newConfig })
    }
  }, [])

  return {
    start,
    stop,
    reheat,
    pinNode,
    unpinNode,
    updateConfig
  }
}
