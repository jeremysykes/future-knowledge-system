import type { KnowledgeNode } from '../types/node'
import type { Edge } from '../types/edge'

export type EventType =
  // Node events
  | 'node:created'
  | 'node:updated'
  | 'node:deleted'
  | 'node:selected'
  | 'node:deselected'
  | 'node:focused'
  | 'node:unfocused'
  | 'node:moved'
  | 'node:pinned'
  | 'node:unpinned'
  // Edge events
  | 'edge:created'
  | 'edge:deleted'
  | 'edge:updated'
  // Simulation events
  | 'simulation:tick'
  | 'simulation:started'
  | 'simulation:stopped'
  | 'simulation:stabilized'
  // Viewport events
  | 'viewport:pan'
  | 'viewport:zoom'
  | 'viewport:resize'
  // Search events
  | 'search:query'
  | 'search:results'
  | 'search:clear'
  // Persistence events
  | 'data:loaded'
  | 'data:saved'
  | 'data:error'
  // Editor
  | 'editor:open'

export interface EventPayloads {
  'node:created': { node: KnowledgeNode }
  'node:updated': { node: KnowledgeNode; changes: Partial<KnowledgeNode> }
  'node:deleted': { nodeId: string }
  'node:selected': { nodeId: string }
  'node:deselected': { nodeId: string }
  'node:focused': { nodeId: string }
  'node:unfocused': { nodeId: string | null }
  'node:moved': { nodeId: string; x: number; y: number }
  'node:pinned': { nodeId: string; x: number; y: number }
  'node:unpinned': { nodeId: string }
  'edge:created': { edge: Edge }
  'edge:deleted': { edgeId: string }
  'edge:updated': { edge: Edge }
  'simulation:tick': { positions: Map<string, { x: number; y: number }> }
  'simulation:started': Record<string, never>
  'simulation:stopped': Record<string, never>
  'simulation:stabilized': Record<string, never>
  'viewport:pan': { x: number; y: number }
  'viewport:zoom': { scale: number; centerX: number; centerY: number }
  'viewport:resize': { width: number; height: number }
  'search:query': { query: string }
  'search:results': { nodeIds: string[] }
  'search:clear': Record<string, never>
  'data:loaded': { nodeCount: number; edgeCount: number }
  'data:saved': { timestamp: string }
  'data:error': { error: string }
  'editor:open': { nodeId: string; isNew: boolean }
}

type EventCallback<T extends EventType> = (payload: EventPayloads[T]) => void

class EventBus {
  private listeners = new Map<EventType, Set<EventCallback<EventType>>>()

  on<T extends EventType>(event: T, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback as EventCallback<EventType>)

    return () => this.off(event, callback)
  }

  off<T extends EventType>(event: T, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback as EventCallback<EventType>)
    }
  }

  emit<T extends EventType>(event: T, payload: EventPayloads[T]): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(payload)
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error)
        }
      }
    }
  }

  once<T extends EventType>(event: T, callback: EventCallback<T>): () => void {
    const wrapper = (payload: EventPayloads[T]) => {
      this.off(event, wrapper as EventCallback<T>)
      callback(payload)
    }
    return this.on(event, wrapper as EventCallback<T>)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const eventBus = new EventBus()
