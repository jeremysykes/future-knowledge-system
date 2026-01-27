import { useEffect, useRef } from 'react'
import { useFieldStore } from '../../core/store/fieldStore'
import { eventBus } from '../../core/events/eventBus'
import { createEdge } from '../../core/types/edge'
import { compute } from './SimilarityService'

const DEBOUNCE_DATA_LOADED_MS = 300
const DEBOUNCE_NODE_EVENTS_MS = 500

function runSync(): void {
  const { nodes, edges, deleteEdge, addEdge } = useFieldStore.getState()
  for (const e of edges.values()) {
    if (e.origin === 'implicit' || (e.id != null && e.id.startsWith('implicit:'))) {
      deleteEdge(e.id)
    }
  }
  const pairs = compute(nodes, edges)
  for (const p of pairs) {
    const a = p.source < p.target ? p.source : p.target
    const b = p.source < p.target ? p.target : p.source
    addEdge(
      createEdge(p.source, p.target, 'reference', {
        id: `implicit:${a}:${b}`,
        origin: 'implicit',
        strength: p.weight
      })
    )
  }
}

export function useImplicitEdgeSync(): void {
  const dataLoadedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodeEventTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onDataLoaded = () => {
      if (dataLoadedTimeoutRef.current) clearTimeout(dataLoadedTimeoutRef.current)
      dataLoadedTimeoutRef.current = setTimeout(() => {
        dataLoadedTimeoutRef.current = null
        runSync()
      }, DEBOUNCE_DATA_LOADED_MS)
    }

    const onNodeEvent = () => {
      if (nodeEventTimeoutRef.current) clearTimeout(nodeEventTimeoutRef.current)
      nodeEventTimeoutRef.current = setTimeout(() => {
        nodeEventTimeoutRef.current = null
        runSync()
      }, DEBOUNCE_NODE_EVENTS_MS)
    }

    const unsubData = eventBus.on('data:loaded', onDataLoaded)
    const unsubCreated = eventBus.on('node:created', onNodeEvent)
    const unsubUpdated = eventBus.on('node:updated', onNodeEvent)
    const unsubDeleted = eventBus.on('node:deleted', onNodeEvent)

    return () => {
      unsubData()
      unsubCreated()
      unsubUpdated()
      unsubDeleted()
      if (dataLoadedTimeoutRef.current) clearTimeout(dataLoadedTimeoutRef.current)
      if (nodeEventTimeoutRef.current) clearTimeout(nodeEventTimeoutRef.current)
    }
  }, [])
}
