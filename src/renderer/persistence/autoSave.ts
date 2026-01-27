import { db, nodeToStored, edgeToStored, storedToNode, storedToEdge } from './db'
import type { KnowledgeNode } from '../core/types/node'
import type { Edge } from '../core/types/edge'
import { eventBus } from '../core/events/eventBus'
import { getHistoryRepository } from './historyRepository'

export interface AutoSaveConfig {
  debounceMs: number
  enabled: boolean
}

const DEFAULT_CONFIG: AutoSaveConfig = {
  debounceMs: 500,
  enabled: true
}

export class AutoSave {
  private config: AutoSaveConfig
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private flushInterval: ReturnType<typeof setInterval> | null = null
  private pendingNodes = new Map<string, KnowledgeNode>()
  private pendingEdges = new Map<string, Edge>()
  private pendingDeletes = {
    nodes: new Set<string>(),
    edges: new Set<string>()
  }

  constructor(config: Partial<AutoSaveConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.setupListeners()
    this.startPeriodicFlush()
  }

  private startPeriodicFlush(): void {
    if (this.flushInterval) return
    this.flushInterval = setInterval(() => {
      if (this.config.enabled && (this.pendingNodes.size > 0 || this.pendingEdges.size > 0 || this.pendingDeletes.nodes.size > 0 || this.pendingDeletes.edges.size > 0)) {
        this.flush()
      }
    }, 2000)
  }

  private stopPeriodicFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
  }

  private setupListeners(): void {
    eventBus.on('node:created', ({ node }) => {
      this.queueNodeSave(node)
    })

    eventBus.on('node:updated', ({ node }) => {
      this.queueNodeSave(node)
    })

    eventBus.on('node:deleted', ({ nodeId }) => {
      this.queueNodeDelete(nodeId)
    })

    eventBus.on('edge:created', ({ edge }) => {
      this.queueEdgeSave(edge)
    })

    eventBus.on('edge:deleted', ({ edgeId }) => {
      this.queueEdgeDelete(edgeId)
    })
  }

  private queueNodeSave(node: KnowledgeNode): void {
    if (!this.config.enabled) return

    this.pendingNodes.set(node.id, node)
    this.pendingDeletes.nodes.delete(node.id)
    this.scheduleSave()
  }

  private queueNodeDelete(nodeId: string): void {
    if (!this.config.enabled) return

    this.pendingNodes.delete(nodeId)
    this.pendingDeletes.nodes.add(nodeId)
    this.scheduleSave()
  }

  private queueEdgeSave(edge: Edge): void {
    if (!this.config.enabled) return

    this.pendingEdges.set(edge.id, edge)
    this.pendingDeletes.edges.delete(edge.id)
    this.scheduleSave()
  }

  private queueEdgeDelete(edgeId: string): void {
    if (!this.config.enabled) return

    this.pendingEdges.delete(edgeId)
    this.pendingDeletes.edges.add(edgeId)
    this.scheduleSave()
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }

    this.saveTimer = setTimeout(() => {
      this.flush()
    }, this.config.debounceMs)
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }

    if (this.pendingNodes.size > 0 || this.pendingEdges.size > 0 || this.pendingDeletes.nodes.size > 0 || this.pendingDeletes.edges.size > 0) {
      console.log(`[AutoSave] Flushing ${this.pendingNodes.size} nodes`)
    }

    try {
      await db.transaction('rw', [db.nodes, db.edges, db.history], async () => {
        // Save nodes
        if (this.pendingNodes.size > 0) {
          const storedNodes = Array.from(this.pendingNodes.values()).map(nodeToStored)
          await db.nodes.bulkPut(storedNodes)
        }

        // Save edges
        if (this.pendingEdges.size > 0) {
          const storedEdges = Array.from(this.pendingEdges.values()).map(edgeToStored)
          await db.edges.bulkPut(storedEdges)
        }

        // Delete nodes
        if (this.pendingDeletes.nodes.size > 0) {
          await db.nodes.bulkDelete(Array.from(this.pendingDeletes.nodes))
        }

        // Delete edges
        if (this.pendingDeletes.edges.size > 0) {
          await db.edges.bulkDelete(Array.from(this.pendingDeletes.edges))
        }
      })

      // Clear pending
      this.pendingNodes.clear()
      this.pendingEdges.clear()
      this.pendingDeletes.nodes.clear()
      this.pendingDeletes.edges.clear()

      eventBus.emit('data:saved', { timestamp: new Date().toISOString() })
    } catch (error) {
      console.error('AutoSave failed:', error)
      eventBus.emit('data:error', { error: String(error) })
    }
  }

  async loadAll(): Promise<{ nodes: KnowledgeNode[]; edges: Edge[] }> {
    try {
      const [storedNodes, storedEdges] = await Promise.all([
        db.nodes.toArray(),
        db.edges.toArray()
      ])

      const nodes = storedNodes.map(storedToNode)
      const edges = storedEdges.map(storedToEdge)

      console.log(`[AutoSave] Loaded ${nodes.length} nodes, ${edges.length} edges`)

      eventBus.emit('data:loaded', {
        nodeCount: nodes.length,
        edgeCount: edges.length
      })

      return { nodes, edges }
    } catch (error) {
      console.error('Load failed:', error)
      eventBus.emit('data:error', { error: String(error) })
      return { nodes: [], edges: [] }
    }
  }

  /**
   * @deprecated This method is dangerous as it clears the entire database before saving.
   * Use saveAllSafe() instead, which creates a snapshot backup before clearing.
   * For incremental updates, use flush() which is called automatically on changes.
   */
  async saveAll(nodes: KnowledgeNode[], edges: Edge[]): Promise<void> {
    console.warn(
      'saveAll() is deprecated and dangerous. It clears the entire database before saving. ' +
      'Use saveAllSafe() instead, or use flush() for incremental updates.'
    )
    return this.saveAllSafe(nodes, edges)
  }

  async saveAllSafe(nodes: KnowledgeNode[], edges: Edge[]): Promise<void> {
    try {
      const historyRepo = getHistoryRepository()

      // Create a snapshot backup before clearing
      await historyRepo.createSnapshot({
        description: 'Backup before saveAllSafe operation',
        isManual: true
      })

      await db.transaction('rw', [db.nodes, db.edges], async () => {
        // Get current state to determine what needs updating
        const currentNodes = await db.nodes.toArray()
        const currentEdges = await db.edges.toArray()

        const nodeMap = new Map(nodes.map((n) => [n.id, n]))
        const edgeMap = new Map(edges.map((e) => [e.id, e]))

        // Determine what to add, update, or delete
        const nodesToAdd: KnowledgeNode[] = []
        const nodesToUpdate: KnowledgeNode[] = []
        const nodesToDelete: string[] = []

        for (const node of nodes) {
          const existing = currentNodes.find((n) => n.id === node.id)
          if (existing) {
            nodesToUpdate.push(node)
          } else {
            nodesToAdd.push(node)
          }
        }

        for (const current of currentNodes) {
          if (!nodeMap.has(current.id)) {
            nodesToDelete.push(current.id)
          }
        }

        const edgesToAdd: Edge[] = []
        const edgesToUpdate: Edge[] = []
        const edgesToDelete: string[] = []

        for (const edge of edges) {
          const existing = currentEdges.find((e) => e.id === edge.id)
          if (existing) {
            edgesToUpdate.push(edge)
          } else {
            edgesToAdd.push(edge)
          }
        }

        for (const current of currentEdges) {
          if (!edgeMap.has(current.id)) {
            edgesToDelete.push(current.id)
          }
        }

        // Perform incremental updates instead of clear + bulkPut
        if (nodesToDelete.length > 0) {
          await db.nodes.bulkDelete(nodesToDelete)
        }
        if (edgesToDelete.length > 0) {
          await db.edges.bulkDelete(edgesToDelete)
        }
        if (nodesToAdd.length > 0) {
          await db.nodes.bulkPut(nodesToAdd.map(nodeToStored))
        }
        if (nodesToUpdate.length > 0) {
          await db.nodes.bulkPut(nodesToUpdate.map(nodeToStored))
        }
        if (edgesToAdd.length > 0) {
          await db.edges.bulkPut(edgesToAdd.map(edgeToStored))
        }
        if (edgesToUpdate.length > 0) {
          await db.edges.bulkPut(edgesToUpdate.map(edgeToStored))
        }
      })

      eventBus.emit('data:saved', { timestamp: new Date().toISOString() })
    } catch (error) {
      console.error('SaveAllSafe failed:', error)
      eventBus.emit('data:error', { error: String(error) })
      throw error
    }
  }

  async clear(): Promise<void> {
    try {
      await db.transaction('rw', [db.nodes, db.edges], async () => {
        await db.nodes.clear()
        await db.edges.clear()
      })
    } catch (error) {
      console.error('Clear failed:', error)
      eventBus.emit('data:error', { error: String(error) })
    }
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled

    if (!enabled) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer)
        this.saveTimer = null
      }
      this.stopPeriodicFlush()
    } else {
      this.startPeriodicFlush()
    }
  }

  destroy(): void {
    this.stopPeriodicFlush()
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
  }

  updateConfig(config: Partial<AutoSaveConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// Singleton instance
let autoSaveInstance: AutoSave | null = null

export function getAutoSave(): AutoSave {
  if (!autoSaveInstance) {
    autoSaveInstance = new AutoSave()
  }
  return autoSaveInstance
}
