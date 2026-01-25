import { db, type HistoryEvent, type Snapshot, nodeToStored, storedToNode, edgeToStored, storedToEdge } from './db'
import type { KnowledgeNode } from '../core/types/node'
import type { Edge } from '../core/types/edge'
import { eventBus } from '../core/events/eventBus'

export interface HistorySnapshot {
  timestamp: string
  nodes: KnowledgeNode[]
  edges: Edge[]
}

export class HistoryRepository {
  private isRecording = true
  private maxEvents = 10000
  private maxSnapshots = 50
  private eventCountSinceLastSnapshot = 0
  private lastSnapshotTime = Date.now()
  private snapshotInterval = 60 * 60 * 1000 // 1 hour
  private snapshotEventThreshold = 100 // Create snapshot after 100 events

  constructor() {
    this.setupListeners()
  }

  private setupListeners(): void {
    eventBus.on('node:created', ({ node }) => {
      this.recordEvent('node:created', node.id, undefined, node)
    })

    eventBus.on('node:updated', ({ node, changes }) => {
      this.recordEvent('node:updated', node.id, changes, node)
    })

    eventBus.on('node:deleted', ({ nodeId }) => {
      this.recordEvent('node:deleted', nodeId)
    })

    eventBus.on('edge:created', ({ edge }) => {
      this.recordEvent('edge:created', edge.id, undefined, edge)
    })

    eventBus.on('edge:deleted', ({ edgeId }) => {
      this.recordEvent('edge:deleted', edgeId)
    })
  }

  private async recordEvent(
    type: HistoryEvent['type'],
    entityId: string,
    previousState?: unknown,
    newState?: unknown
  ): Promise<void> {
    if (!this.isRecording) return

    const event: HistoryEvent = {
      timestamp: new Date().toISOString(),
      type,
      entityId,
      previousState: previousState ? JSON.stringify(previousState) : undefined,
      newState: newState ? JSON.stringify(newState) : undefined
    }

    try {
      await db.history.add(event)

      // Trim old events if needed
      const count = await db.history.count()
      if (count > this.maxEvents) {
        const oldestEvents = await db.history
          .orderBy('id')
          .limit(count - this.maxEvents)
          .toArray()

        await db.history.bulkDelete(oldestEvents.map((e) => e.id!))
      }

      // Check if we should create an automatic snapshot
      this.eventCountSinceLastSnapshot++
      const timeSinceLastSnapshot = Date.now() - this.lastSnapshotTime

      if (
        this.eventCountSinceLastSnapshot >= this.snapshotEventThreshold ||
        timeSinceLastSnapshot >= this.snapshotInterval
      ) {
        await this.createSnapshot({ isManual: false })
        this.eventCountSinceLastSnapshot = 0
        this.lastSnapshotTime = Date.now()
      }
    } catch (error) {
      console.error('Failed to record history event:', error)
    }
  }

  async getEvents(
    options: {
      startDate?: string
      endDate?: string
      type?: HistoryEvent['type']
      entityId?: string
      limit?: number
    } = {}
  ): Promise<HistoryEvent[]> {
    let query = db.history.orderBy('timestamp').reverse()

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const events = await query.toArray()

    return events.filter((event) => {
      if (options.startDate && event.timestamp < options.startDate) return false
      if (options.endDate && event.timestamp > options.endDate) return false
      if (options.type && event.type !== options.type) return false
      if (options.entityId && event.entityId !== options.entityId) return false
      return true
    })
  }

  async createSnapshot(options: { description?: string; isManual?: boolean } = {}): Promise<Snapshot | null> {
    try {
      const [storedNodes, storedEdges] = await Promise.all([
        db.nodes.toArray(),
        db.edges.toArray()
      ])

      const timestamp = new Date().toISOString()
      const snapshot: Snapshot = {
        timestamp,
        nodeCount: storedNodes.length,
        edgeCount: storedEdges.length,
        nodes: storedNodes,
        edges: storedEdges,
        metadata: {
          description: options.description,
          isManual: options.isManual ?? false
        }
      }

      const snapshotId = await db.snapshots.add(snapshot)

      // Trim old snapshots if needed
      const snapshotCount = await db.snapshots.count()
      if (snapshotCount > this.maxSnapshots) {
        const oldestSnapshots = await db.snapshots
          .orderBy('id')
          .limit(snapshotCount - this.maxSnapshots)
          .toArray()

        await db.snapshots.bulkDelete(oldestSnapshots.map((s) => s.id!))
      }

      this.eventCountSinceLastSnapshot = 0
      this.lastSnapshotTime = Date.now()

      return { ...snapshot, id: snapshotId as number }
    } catch (error) {
      console.error('Failed to create snapshot:', error)
      return null
    }
  }

  async getSnapshots(limit?: number): Promise<Snapshot[]> {
    let query = db.snapshots.orderBy('timestamp').reverse()
    if (limit) {
      query = query.limit(limit)
    }
    return query.toArray()
  }

  async getSnapshot(timestamp: string): Promise<HistorySnapshot | null> {
    // Try to find nearest snapshot before or at the timestamp
    const snapshots = await db.snapshots
      .where('timestamp')
      .belowOrEqual(timestamp)
      .reverse()
      .limit(1)
      .toArray()

    let baseSnapshot: Snapshot | null = null
    let eventsToReplay: HistoryEvent[] = []

    if (snapshots.length > 0) {
      baseSnapshot = snapshots[0]
      // Get events after the snapshot timestamp up to target timestamp
      eventsToReplay = await db.history
        .where('timestamp')
        .between(baseSnapshot.timestamp, timestamp, true, true)
        .toArray()
    } else {
      // No snapshot found, replay all events
      eventsToReplay = await db.history
        .where('timestamp')
        .belowOrEqual(timestamp)
        .toArray()
    }

    if (baseSnapshot) {
      // Start from snapshot state
      const nodes = new Map<string, KnowledgeNode>(
        baseSnapshot.nodes.map((stored) => [stored.id, storedToNode(stored)])
      )
      const edges = new Map<string, Edge>(
        baseSnapshot.edges.map((stored) => [stored.id, storedToEdge(stored)])
      )

      // Replay events from snapshot to target timestamp
      for (const event of eventsToReplay) {
        switch (event.type) {
          case 'node:created':
          case 'node:updated':
            if (event.newState) {
              const node = JSON.parse(event.newState) as KnowledgeNode
              nodes.set(event.entityId, node)
            }
            break

          case 'node:deleted':
            nodes.delete(event.entityId)
            break

          case 'edge:created':
            if (event.newState) {
              const edge = JSON.parse(event.newState) as Edge
              edges.set(event.entityId, edge)
            }
            break

          case 'edge:deleted':
            edges.delete(event.entityId)
            break
        }
      }

      return {
        timestamp,
        nodes: Array.from(nodes.values()),
        edges: Array.from(edges.values())
      }
    } else if (eventsToReplay.length > 0) {
      // Fallback to full event replay
      const nodes = new Map<string, KnowledgeNode>()
      const edges = new Map<string, Edge>()

      for (const event of eventsToReplay) {
        switch (event.type) {
          case 'node:created':
          case 'node:updated':
            if (event.newState) {
              const node = JSON.parse(event.newState) as KnowledgeNode
              nodes.set(event.entityId, node)
            }
            break

          case 'node:deleted':
            nodes.delete(event.entityId)
            break

          case 'edge:created':
            if (event.newState) {
              const edge = JSON.parse(event.newState) as Edge
              edges.set(event.entityId, edge)
            }
            break

          case 'edge:deleted':
            edges.delete(event.entityId)
            break
        }
      }

      return {
        timestamp,
        nodes: Array.from(nodes.values()),
        edges: Array.from(edges.values())
      }
    }

    return null
  }

  async restoreFromSnapshot(snapshotId: number): Promise<HistorySnapshot | null> {
    const snapshot = await db.snapshots.get(snapshotId)
    if (!snapshot) return null

    try {
      this.isRecording = false

      await db.transaction('rw', [db.nodes, db.edges], async () => {
        // Clear existing data
        await db.nodes.clear()
        await db.edges.clear()

        // Restore from snapshot
        await db.nodes.bulkPut(snapshot.nodes)
        await db.edges.bulkPut(snapshot.edges)
      })

      return {
        timestamp: snapshot.timestamp,
        nodes: snapshot.nodes.map(storedToNode),
        edges: snapshot.edges.map(storedToEdge)
      }
    } catch (error) {
      console.error('Failed to restore from snapshot:', error)
      return null
    } finally {
      this.isRecording = true
    }
  }

  async getTimeline(
    startDate: string,
    endDate: string,
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<Array<{ timestamp: string; nodeCount: number; edgeCount: number; changeCount: number }>> {
    const events = await db.history
      .where('timestamp')
      .between(startDate, endDate)
      .toArray()

    // Group events by time period
    const periods = new Map<string, HistoryEvent[]>()

    for (const event of events) {
      const date = new Date(event.timestamp)
      let periodKey: string

      switch (granularity) {
        case 'hour':
          periodKey = date.toISOString().slice(0, 13)
          break
        case 'day':
          periodKey = date.toISOString().slice(0, 10)
          break
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          periodKey = weekStart.toISOString().slice(0, 10)
          break
      }

      if (!periods.has(periodKey)) {
        periods.set(periodKey, [])
      }
      periods.get(periodKey)!.push(event)
    }

    // Build timeline
    const timeline: Array<{
      timestamp: string
      nodeCount: number
      edgeCount: number
      changeCount: number
    }> = []

    let runningNodeCount = 0
    let runningEdgeCount = 0

    for (const [timestamp, periodEvents] of Array.from(periods.entries()).sort()) {
      for (const event of periodEvents) {
        if (event.type === 'node:created') runningNodeCount++
        if (event.type === 'node:deleted') runningNodeCount--
        if (event.type === 'edge:created') runningEdgeCount++
        if (event.type === 'edge:deleted') runningEdgeCount--
      }

      timeline.push({
        timestamp,
        nodeCount: runningNodeCount,
        edgeCount: runningEdgeCount,
        changeCount: periodEvents.length
      })
    }

    return timeline
  }

  async undoLastChange(): Promise<boolean> {
    const lastEvent = await db.history.orderBy('id').last()
    if (!lastEvent || !lastEvent.previousState) return false

    this.isRecording = false

    try {
      switch (lastEvent.type) {
        case 'node:created':
          await db.nodes.delete(lastEvent.entityId)
          break

        case 'node:updated':
          const prevNode = JSON.parse(lastEvent.previousState) as Partial<KnowledgeNode>
          await db.nodes.update(lastEvent.entityId, nodeToStored(prevNode as KnowledgeNode))
          break

        case 'node:deleted':
          const restoredNode = JSON.parse(lastEvent.previousState) as KnowledgeNode
          await db.nodes.put(nodeToStored(restoredNode))
          break

        case 'edge:created':
          await db.edges.delete(lastEvent.entityId)
          break

        case 'edge:deleted':
          const restoredEdge = JSON.parse(lastEvent.previousState) as Edge
          await db.edges.put(edgeToStored(restoredEdge))
          break
      }

      await db.history.delete(lastEvent.id!)
      return true
    } finally {
      this.isRecording = true
    }
  }

  async clearHistory(): Promise<void> {
    await db.history.clear()
  }

  setRecording(enabled: boolean): void {
    this.isRecording = enabled
  }
}

// Singleton instance
let historyRepoInstance: HistoryRepository | null = null

export function getHistoryRepository(): HistoryRepository {
  if (!historyRepoInstance) {
    historyRepoInstance = new HistoryRepository()
  }
  return historyRepoInstance
}
