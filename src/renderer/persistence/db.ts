import Dexie, { type Table } from 'dexie'
import type { KnowledgeNode, NodeData } from '../core/types/node'
import type { Edge } from '../core/types/edge'

export interface StoredNode {
  id: string
  title: string
  data: NodeData
  positionX: number
  positionY: number
  velocityVx: number
  velocityVy: number
  fx: number | null
  fy: number | null
  createdAt: string
  updatedAt: string
  filePath?: string
}

export interface StoredEdge {
  id: string
  source: string
  target: string
  type: Edge['type']
  strength: number
  label?: string
  createdAt: string
  bidirectional: boolean
}

export interface HistoryEvent {
  id?: number
  timestamp: string
  type: 'node:created' | 'node:updated' | 'node:deleted' | 'edge:created' | 'edge:deleted'
  entityId: string
  previousState?: string
  newState?: string
}

export interface Settings {
  key: string
  value: string
}

export interface Snapshot {
  id?: number
  timestamp: string
  nodeCount: number
  edgeCount: number
  nodes: StoredNode[]
  edges: StoredEdge[]
  metadata?: {
    description?: string
    isManual?: boolean
  }
}

class KnowledgeDatabase extends Dexie {
  nodes!: Table<StoredNode, string>
  edges!: Table<StoredEdge, string>
  history!: Table<HistoryEvent, number>
  settings!: Table<Settings, string>
  snapshots!: Table<Snapshot, number>

  constructor() {
    super('FutureKnowledgeSystem')

    this.version(1).stores({
      nodes: 'id, title, createdAt, updatedAt, [data.type]',
      edges: 'id, source, target, type',
      history: '++id, timestamp, type, entityId',
      settings: 'key'
    })

    this.version(2).stores({
      nodes: 'id, title, createdAt, updatedAt, [data.type]',
      edges: 'id, source, target, type',
      history: '++id, timestamp, type, entityId',
      settings: 'key',
      snapshots: '++id, timestamp'
    })
  }
}

export const db = new KnowledgeDatabase()

// Conversion utilities
export function nodeToStored(node: KnowledgeNode): StoredNode {
  return {
    id: node.id,
    title: node.title,
    data: node.data,
    positionX: node.position.x,
    positionY: node.position.y,
    velocityVx: node.velocity.vx,
    velocityVy: node.velocity.vy,
    fx: node.fx ?? null,
    fy: node.fy ?? null,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    filePath: node.filePath
  }
}

export function storedToNode(stored: StoredNode): KnowledgeNode {
  return {
    id: stored.id,
    title: stored.title,
    data: stored.data,
    position: {
      x: stored.positionX,
      y: stored.positionY
    },
    velocity: {
      vx: stored.velocityVx,
      vy: stored.velocityVy
    },
    fx: stored.fx,
    fy: stored.fy,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    filePath: stored.filePath
  }
}

export function edgeToStored(edge: Edge): StoredEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    strength: edge.strength,
    label: edge.label,
    createdAt: edge.createdAt,
    bidirectional: edge.bidirectional
  }
}

export function storedToEdge(stored: StoredEdge): Edge {
  return {
    id: stored.id,
    source: stored.source,
    target: stored.target,
    type: stored.type,
    strength: stored.strength,
    label: stored.label,
    createdAt: stored.createdAt,
    bidirectional: stored.bidirectional
  }
}
