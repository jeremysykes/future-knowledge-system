import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum
} from 'd3-force'
import type { KnowledgeNode } from '../../core/types/node'
import type { Edge } from '../../core/types/edge'
import { getEdgeDistance, getEdgeStrengthMultiplier } from '../../core/types/edge'
import { eventBus } from '../../core/events/eventBus'

interface SimNode extends SimulationNodeDatum {
  id: string
  fx?: number | null
  fy?: number | null
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string
  strength: number
  distance: number
}

export interface ForceConfig {
  chargeStrength: number
  linkDistance: number
  linkStrength: number
  centerStrength: number
  collideRadius: number
  alphaDecay: number
  velocityDecay: number
}

const DEFAULT_CONFIG: ForceConfig = {
  chargeStrength: -300,
  linkDistance: 100,
  linkStrength: 0.3,
  centerStrength: 0.01,
  collideRadius: 35,
  alphaDecay: 0.02,
  velocityDecay: 0.3
}

export class ForceSimulation {
  private simulation: Simulation<SimNode, SimLink>
  private nodes: Map<string, SimNode> = new Map()
  private links: Map<string, SimLink> = new Map()
  private config: ForceConfig
  private isRunning = false
  private focusedNodeId: string | null = null

  // Interpolation state
  private targetPositions: Map<string, { x: number; y: number }> = new Map()
  private interpolatedPositions: Map<string, { x: number; y: number }> = new Map()
  private lastTickTime = 0
  private interpolationFrame: number | null = null

  constructor(config: Partial<ForceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    this.simulation = forceSimulation<SimNode, SimLink>()
      .force('charge', forceManyBody<SimNode>().strength(this.config.chargeStrength))
      .force('link', forceLink<SimNode, SimLink>()
        .id((d) => d.id)
        .distance((d) => d.distance)
        .strength((d) => d.strength * this.config.linkStrength)
      )
      .force('center', forceCenter(0, 0).strength(this.config.centerStrength))
      .force('collide', forceCollide<SimNode>().radius(this.config.collideRadius))
      .force('x', forceX(0).strength(0.005))
      .force('y', forceY(0).strength(0.005))
      .alphaDecay(this.config.alphaDecay)
      .velocityDecay(this.config.velocityDecay)

    this.simulation.on('tick', this.handleTick.bind(this))
    this.simulation.on('end', this.handleEnd.bind(this))
  }

  private handleTick(): void {
    this.lastTickTime = performance.now()

    // Store target positions from simulation
    for (const node of this.nodes.values()) {
      this.targetPositions.set(node.id, {
        x: node.x ?? 0,
        y: node.y ?? 0
      })
    }

    // Emit positions to store
    eventBus.emit('simulation:tick', { positions: new Map(this.targetPositions) })
  }

  private handleEnd(): void {
    eventBus.emit('simulation:stabilized', {})
  }

  updateNodes(nodes: Map<string, KnowledgeNode>): void {
    const existingIds = new Set(this.nodes.keys())
    const newIds = new Set(nodes.keys())

    // Remove deleted nodes
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        this.nodes.delete(id)
        this.targetPositions.delete(id)
        this.interpolatedPositions.delete(id)
      }
    }

    // Add or update nodes
    for (const [id, node] of nodes) {
      let simNode = this.nodes.get(id)

      if (!simNode) {
        simNode = {
          id,
          x: node.position.x,
          y: node.position.y,
          vx: node.velocity.vx,
          vy: node.velocity.vy,
          fx: node.fx,
          fy: node.fy
        }
        this.nodes.set(id, simNode)
        this.targetPositions.set(id, { x: node.position.x, y: node.position.y })
        this.interpolatedPositions.set(id, { x: node.position.x, y: node.position.y })
      } else {
        // Update fixed positions
        simNode.fx = node.fx
        simNode.fy = node.fy
      }
    }

    this.simulation.nodes(Array.from(this.nodes.values()))
    this.reheat()
  }

  updateEdges(edges: Map<string, Edge>): void {
    this.links.clear()

    for (const edge of edges.values()) {
      const sourceNode = this.nodes.get(edge.source)
      const targetNode = this.nodes.get(edge.target)

      if (sourceNode && targetNode) {
        this.links.set(edge.id, {
          id: edge.id,
          source: sourceNode,
          target: targetNode,
          strength: edge.strength * getEdgeStrengthMultiplier(edge.type),
          distance: getEdgeDistance(edge.type)
        })
      }
    }

    const linkForce = this.simulation.force('link') as ReturnType<typeof forceLink<SimNode, SimLink>>
    if (linkForce) {
      linkForce.links(Array.from(this.links.values()))
    }

    this.reheat()
  }

  setFocusedNode(nodeId: string | null): void {
    this.focusedNodeId = nodeId
    this.updateFocusForce()
    this.reheat()
  }

  private updateFocusForce(): void {
    if (this.focusedNodeId) {
      const focusedNode = this.nodes.get(this.focusedNodeId)
      if (focusedNode) {
        // Increase attraction towards focused node
        this.simulation.force('focusX', forceX((focusedNode.x ?? 0)).strength((d) => {
          if (d.id === this.focusedNodeId) return 0
          const link = Array.from(this.links.values()).find(
            (l) => {
              const sourceId = typeof l.source === 'object' ? l.source.id : l.source
              const targetId = typeof l.target === 'object' ? l.target.id : l.target
              return (sourceId === d.id && targetId === this.focusedNodeId) ||
                     (targetId === d.id && sourceId === this.focusedNodeId)
            }
          )
          return link ? 0.1 : 0.02
        }))
        this.simulation.force('focusY', forceY((focusedNode.y ?? 0)).strength((d) => {
          if (d.id === this.focusedNodeId) return 0
          const link = Array.from(this.links.values()).find(
            (l) => {
              const sourceId = typeof l.source === 'object' ? l.source.id : l.source
              const targetId = typeof l.target === 'object' ? l.target.id : l.target
              return (sourceId === d.id && targetId === this.focusedNodeId) ||
                     (targetId === d.id && sourceId === this.focusedNodeId)
            }
          )
          return link ? 0.1 : 0.02
        }))
      }
    } else {
      this.simulation.force('focusX', null)
      this.simulation.force('focusY', null)
    }
  }

  pinNode(nodeId: string, x: number, y: number): void {
    const node = this.nodes.get(nodeId)
    if (node) {
      node.fx = x
      node.fy = y
      node.x = x
      node.y = y
    }
  }

  unpinNode(nodeId: string): void {
    const node = this.nodes.get(nodeId)
    if (node) {
      node.fx = null
      node.fy = null
    }
  }

  reheat(alpha: number = 0.3): void {
    this.simulation.alpha(alpha).restart()
  }

  start(): void {
    if (!this.isRunning) {
      this.isRunning = true
      this.simulation.restart()
      this.startInterpolation()
      eventBus.emit('simulation:started', {})
    }
  }

  stop(): void {
    if (this.isRunning) {
      this.isRunning = false
      this.simulation.stop()
      this.stopInterpolation()
      eventBus.emit('simulation:stopped', {})
    }
  }

  private startInterpolation(): void {
    const interpolate = () => {
      if (!this.isRunning) return

      const now = performance.now()
      const timeSinceLastTick = now - this.lastTickTime
      const alpha = Math.min(timeSinceLastTick / 33.33, 1) // 30Hz = 33.33ms

      // Interpolate towards target positions
      for (const [id, target] of this.targetPositions) {
        const current = this.interpolatedPositions.get(id) || { x: target.x, y: target.y }
        this.interpolatedPositions.set(id, {
          x: current.x + (target.x - current.x) * alpha,
          y: current.y + (target.y - current.y) * alpha
        })
      }

      this.interpolationFrame = requestAnimationFrame(interpolate)
    }

    this.interpolationFrame = requestAnimationFrame(interpolate)
  }

  private stopInterpolation(): void {
    if (this.interpolationFrame !== null) {
      cancelAnimationFrame(this.interpolationFrame)
      this.interpolationFrame = null
    }
  }

  getInterpolatedPositions(): Map<string, { x: number; y: number }> {
    return this.interpolatedPositions
  }

  updateConfig(config: Partial<ForceConfig>): void {
    this.config = { ...this.config, ...config }

    const chargeForce = this.simulation.force('charge') as ReturnType<typeof forceManyBody>
    if (chargeForce) {
      chargeForce.strength(this.config.chargeStrength)
    }

    const linkForce = this.simulation.force('link') as ReturnType<typeof forceLink<SimNode, SimLink>>
    if (linkForce) {
      linkForce.distance((d: SimLink) => d.distance)
      linkForce.strength((d: SimLink) => d.strength * this.config.linkStrength)
    }

    const centerForce = this.simulation.force('center') as ReturnType<typeof forceCenter>
    if (centerForce) {
      centerForce.strength(this.config.centerStrength)
    }

    const collideForce = this.simulation.force('collide') as ReturnType<typeof forceCollide>
    if (collideForce) {
      collideForce.radius(this.config.collideRadius)
    }

    this.simulation.alphaDecay(this.config.alphaDecay)
    this.simulation.velocityDecay(this.config.velocityDecay)

    this.reheat()
  }

  destroy(): void {
    this.stop()
    this.simulation.stop()
    this.nodes.clear()
    this.links.clear()
    this.targetPositions.clear()
    this.interpolatedPositions.clear()
  }
}
