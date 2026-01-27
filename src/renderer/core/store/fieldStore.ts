import { create } from 'zustand'
import type { KnowledgeNode } from '../types/node'
import type { Edge } from '../types/edge'
import { eventBus } from '../events/eventBus'

interface FieldStore {
  // State
  nodes: Map<string, KnowledgeNode>
  edges: Map<string, Edge>
  focusedNodeId: string | null
  selectedNodeIds: Set<string>
  isSimulationRunning: boolean
  draggedNodeId: string | null
  hoveredNodeId: string | null

  // Node actions
  addNode: (node: KnowledgeNode) => void
  updateNode: (id: string, changes: Partial<KnowledgeNode>) => void
  deleteNode: (id: string) => void
  setNodePosition: (id: string, x: number, y: number) => void
  pinNode: (id: string, x: number, y: number) => void
  unpinNode: (id: string) => void
  bulkUpdatePositions: (positions: Map<string, { x: number; y: number; vx?: number; vy?: number }>) => void

  // Edge actions
  addEdge: (edge: Edge) => void
  deleteEdge: (id: string) => void
  updateEdge: (id: string, changes: Partial<Edge>) => void

  // Selection actions
  selectNode: (id: string, additive?: boolean) => void
  deselectNode: (id: string) => void
  clearSelection: () => void
  selectAll: () => void

  // Focus actions
  focusNode: (id: string | null) => void
  setDraggedNodeId: (id: string | null) => void
  setHoveredNodeId: (id: string | null) => void

  // Simulation
  setSimulationRunning: (running: boolean) => void

  // Bulk operations
  loadData: (nodes: KnowledgeNode[], edges: Edge[]) => void
  clear: () => void

  // Getters
  getNode: (id: string) => KnowledgeNode | undefined
  getEdge: (id: string) => Edge | undefined
  getNodeEdges: (nodeId: string) => Edge[]
  getConnectedNodes: (nodeId: string) => KnowledgeNode[]
}

export const useFieldStore = create<FieldStore>((set, get) => ({
  nodes: new Map(),
  edges: new Map(),
  focusedNodeId: null,
  selectedNodeIds: new Set(),
  isSimulationRunning: false,
  draggedNodeId: null,
  hoveredNodeId: null,

  addNode: (node) => {
    set((state) => {
      const newNodes = new Map(state.nodes)
      newNodes.set(node.id, node)
      return { nodes: newNodes }
    })
    eventBus.emit('node:created', { node })
  },

  updateNode: (id, changes) => {
    set((state) => {
      const node = state.nodes.get(id)
      if (!node) return state

      const updatedNode = {
        ...node,
        ...changes,
        updatedAt: new Date().toISOString()
      }
      const newNodes = new Map(state.nodes)
      newNodes.set(id, updatedNode)

      eventBus.emit('node:updated', { node: updatedNode, changes })
      return { nodes: newNodes }
    })
  },

  deleteNode: (id) => {
    set((state) => {
      const newNodes = new Map(state.nodes)
      newNodes.delete(id)

      // Also delete connected edges
      const newEdges = new Map(state.edges)
      for (const [edgeId, edge] of state.edges) {
        if (edge.source === id || edge.target === id) {
          newEdges.delete(edgeId)
          eventBus.emit('edge:deleted', { edgeId })
        }
      }

      const newSelected = new Set(state.selectedNodeIds)
      newSelected.delete(id)

      eventBus.emit('node:deleted', { nodeId: id })
      return {
        nodes: newNodes,
        edges: newEdges,
        selectedNodeIds: newSelected,
        focusedNodeId: state.focusedNodeId === id ? null : state.focusedNodeId,
        draggedNodeId: state.draggedNodeId === id ? null : state.draggedNodeId
      }
    })
  },

  setNodePosition: (id, x, y) => {
    set((state) => {
      const node = state.nodes.get(id)
      if (!node) return state

      const updatedNode = {
        ...node,
        position: { x, y }
      }
      const newNodes = new Map(state.nodes)
      newNodes.set(id, updatedNode)
      return { nodes: newNodes }
    })
    eventBus.emit('node:moved', { nodeId: id, x, y })
  },

  pinNode: (id, x, y) => {
    set((state) => {
      const node = state.nodes.get(id)
      if (!node) return state

      const updatedNode = {
        ...node,
        fx: x,
        fy: y,
        position: { x, y }
      }
      const newNodes = new Map(state.nodes)
      newNodes.set(id, updatedNode)
      return { nodes: newNodes }
    })
    eventBus.emit('node:pinned', { nodeId: id, x, y })
  },

  unpinNode: (id) => {
    set((state) => {
      const node = state.nodes.get(id)
      if (!node) return state

      const updatedNode = {
        ...node,
        fx: null,
        fy: null,
        velocity: { vx: 0, vy: 0 }
      }
      const newNodes = new Map(state.nodes)
      newNodes.set(id, updatedNode)
      return { nodes: newNodes }
    })
    eventBus.emit('node:unpinned', { nodeId: id })
  },

  bulkUpdatePositions: (positions) => {
    set((state) => {
      const newNodes = new Map(state.nodes)
      for (const [id, pos] of positions) {
        const node = newNodes.get(id)
        if (node) {
          newNodes.set(id, {
            ...node,
            position: { x: pos.x, y: pos.y },
            velocity: {
              vx: pos.vx ?? node.velocity.vx,
              vy: pos.vy ?? node.velocity.vy
            }
          })
        }
      }
      return { nodes: newNodes }
    })
  },

  addEdge: (edge) => {
    set((state) => {
      const newEdges = new Map(state.edges)
      newEdges.set(edge.id, edge)
      return { edges: newEdges }
    })
    eventBus.emit('edge:created', { edge })
  },

  deleteEdge: (id) => {
    set((state) => {
      const newEdges = new Map(state.edges)
      newEdges.delete(id)
      return { edges: newEdges }
    })
    eventBus.emit('edge:deleted', { edgeId: id })
  },

  updateEdge: (id, changes) => {
    set((state) => {
      const edge = state.edges.get(id)
      if (!edge) return state

      const updatedEdge = { ...edge, ...changes }
      const newEdges = new Map(state.edges)
      newEdges.set(id, updatedEdge)

      eventBus.emit('edge:updated', { edge: updatedEdge })
      return { edges: newEdges }
    })
  },

  selectNode: (id, additive = false) => {
    set((state) => {
      const newSelected = additive ? new Set(state.selectedNodeIds) : new Set<string>()
      newSelected.add(id)
      eventBus.emit('node:selected', { nodeId: id })
      return { selectedNodeIds: newSelected }
    })
  },

  deselectNode: (id) => {
    set((state) => {
      const newSelected = new Set(state.selectedNodeIds)
      newSelected.delete(id)
      eventBus.emit('node:deselected', { nodeId: id })
      return { selectedNodeIds: newSelected }
    })
  },

  clearSelection: () => {
    const state = get()
    for (const id of state.selectedNodeIds) {
      eventBus.emit('node:deselected', { nodeId: id })
    }
    set({ selectedNodeIds: new Set() })
  },

  selectAll: () => {
    set((state) => {
      const newSelected = new Set(state.nodes.keys())
      for (const id of newSelected) {
        eventBus.emit('node:selected', { nodeId: id })
      }
      return { selectedNodeIds: newSelected }
    })
  },

  focusNode: (id) => {
    const state = get()
    if (state.focusedNodeId) {
      eventBus.emit('node:unfocused', { nodeId: state.focusedNodeId })
    }
    if (id) {
      eventBus.emit('node:focused', { nodeId: id })
    }
    set({ focusedNodeId: id })
  },

  setDraggedNodeId: (id) => set({ draggedNodeId: id }),

  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),

  setSimulationRunning: (running) => {
    set({ isSimulationRunning: running })
    eventBus.emit(running ? 'simulation:started' : 'simulation:stopped', {})
  },

  loadData: (nodes, edges) => {
    const nodeMap = new Map<string, KnowledgeNode>()
    for (const node of nodes) {
      nodeMap.set(node.id, node)
    }

    const edgeMap = new Map<string, Edge>()
    for (const edge of edges) {
      edgeMap.set(edge.id, edge)
    }

    set({
      nodes: nodeMap,
      edges: edgeMap,
      selectedNodeIds: new Set(),
      focusedNodeId: null,
      draggedNodeId: null,
      hoveredNodeId: null
    })

    eventBus.emit('data:loaded', { nodeCount: nodes.length, edgeCount: edges.length })
  },

  clear: () => {
    set({
      nodes: new Map(),
      edges: new Map(),
      selectedNodeIds: new Set(),
      focusedNodeId: null,
      draggedNodeId: null,
      hoveredNodeId: null
    })
  },

  getNode: (id) => get().nodes.get(id),

  getEdge: (id) => get().edges.get(id),

  getNodeEdges: (nodeId) => {
    const edges: Edge[] = []
    for (const edge of get().edges.values()) {
      if (edge.source === nodeId || edge.target === nodeId) {
        edges.push(edge)
      }
    }
    return edges
  },

  getConnectedNodes: (nodeId) => {
    const state = get()
    const connected: KnowledgeNode[] = []
    const edges = state.getNodeEdges(nodeId)

    for (const edge of edges) {
      const otherId = edge.source === nodeId ? edge.target : edge.source
      const node = state.nodes.get(otherId)
      if (node) {
        connected.push(node)
      }
    }

    return connected
  }
}))
