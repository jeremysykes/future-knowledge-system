import type { KnowledgeNode } from './node'
import type { Edge } from './edge'

export interface ViewBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface FieldState {
  nodes: Map<string, KnowledgeNode>
  edges: Map<string, Edge>
  focusedNodeId: string | null
  selectedNodeIds: Set<string>
  bounds: ViewBounds
}

export interface FieldMetrics {
  nodeCount: number
  edgeCount: number
  density: number // edges per node
  averageConnections: number
}

export function createFieldState(): FieldState {
  return {
    nodes: new Map(),
    edges: new Map(),
    focusedNodeId: null,
    selectedNodeIds: new Set(),
    bounds: {
      minX: -1000,
      minY: -1000,
      maxX: 1000,
      maxY: 1000
    }
  }
}

export function calculateFieldMetrics(state: FieldState): FieldMetrics {
  const nodeCount = state.nodes.size
  const edgeCount = state.edges.size

  if (nodeCount === 0) {
    return {
      nodeCount: 0,
      edgeCount: 0,
      density: 0,
      averageConnections: 0
    }
  }

  const connectionCounts = new Map<string, number>()
  for (const node of state.nodes.values()) {
    connectionCounts.set(node.id, 0)
  }

  for (const edge of state.edges.values()) {
    const sourceCount = connectionCounts.get(edge.source) ?? 0
    connectionCounts.set(edge.source, sourceCount + 1)

    const targetCount = connectionCounts.get(edge.target) ?? 0
    connectionCounts.set(edge.target, targetCount + 1)
  }

  const totalConnections = Array.from(connectionCounts.values()).reduce((a, b) => a + b, 0)

  return {
    nodeCount,
    edgeCount,
    density: edgeCount / nodeCount,
    averageConnections: totalConnections / nodeCount
  }
}

export function calculateBounds(nodes: KnowledgeNode[], padding: number = 100): ViewBounds {
  if (nodes.length === 0) {
    return { minX: -500, minY: -500, maxX: 500, maxY: 500 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x)
    maxY = Math.max(maxY, node.position.y)
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding
  }
}
