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

type WorkerMessage =
  | { type: 'init'; config: ForceConfig }
  | { type: 'updateNodes'; nodes: NodeData[] }
  | { type: 'updateEdges'; edges: EdgeData[] }
  | { type: 'start'; soft?: boolean }
  | { type: 'stop' }
  | { type: 'reheat'; alpha: number }
  | { type: 'pinNode'; nodeId: string; x: number; y: number }
  | { type: 'unpinNode'; nodeId: string }
  | { type: 'updateConfig'; config: Partial<ForceConfig> }
  | { type: 'setGravitySource'; focusedNodeId?: string | null; draggedNodeId?: string | null }

type WorkerResponse =
  | { type: 'tick'; positions: Array<{ id: string; x: number; y: number; vx: number; vy: number }> }
  | { type: 'stabilized' }
  | { type: 'ready' }

let simulation: Simulation<SimNode, SimLink> | null = null
const nodes = new Map<string, SimNode>()
const links = new Map<string, SimLink>()
let gravitySourceId: string | null = null
let config: ForceConfig = {
  chargeStrength: -300,
  linkStrength: 0.3,
  centerStrength: 0.01,
  collideRadius: 35,
  alphaDecay: 0.02,
  velocityDecay: 0.3
}
let tickInterval: ReturnType<typeof setInterval> | null = null
let hasEverStarted = false

const RADIAL_BOUND = 1000

function applyRadialBound(): void {
  for (const node of nodes.values()) {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const r = Math.sqrt(x * x + y * y)
    if (r > RADIAL_BOUND) {
      const s = RADIAL_BOUND / r
      node.x = x * s
      node.y = y * s
    }
  }
}

function createSimulation(): Simulation<SimNode, SimLink> {
  const sim = forceSimulation<SimNode, SimLink>()
    .force('charge', forceManyBody<SimNode>().strength(config.chargeStrength))
    .force('link', forceLink<SimNode, SimLink>()
      .id((d) => d.id)
      .distance((d) => d.distance)
      .strength((d) => d.strength * config.linkStrength)
    )
    .force('center', forceCenter(0, 0).strength(config.centerStrength))
    .force('collide', forceCollide<SimNode>().radius(config.collideRadius))
    .force('x', forceX(0).strength(0.005))
    .force('y', forceY(0).strength(0.005))
    .alphaDecay(config.alphaDecay)
    .velocityDecay(config.velocityDecay)
    .stop() // We'll control ticking manually

  return sim
}

function applyGravityForces(): void {
  if (!simulation) return
  if (gravitySourceId) {
    const strengthFn = (d: SimNode) => {
      if (d.id === gravitySourceId) return 0
      const linked = Array.from(links.values()).some((l) => {
        const sid = typeof l.source === 'object' ? (l.source as SimNode).id : l.source
        const tid = typeof l.target === 'object' ? (l.target as SimNode).id : l.target
        return (sid === d.id && tid === gravitySourceId) || (tid === d.id && sid === gravitySourceId)
      })
      return linked ? 0.1 : 0.02
    }
    simulation.force('focusX', forceX(() => nodes.get(gravitySourceId!)?.x ?? 0).strength(strengthFn))
    simulation.force('focusY', forceY(() => nodes.get(gravitySourceId!)?.y ?? 0).strength(strengthFn))
  } else {
    simulation.force('focusX', null)
    simulation.force('focusY', null)
  }
}

function sendTick(): void {
  const positions: Array<{ id: string; x: number; y: number; vx: number; vy: number }> = []

  for (const node of nodes.values()) {
    positions.push({
      id: node.id,
      x: node.x ?? 0,
      y: node.y ?? 0,
      vx: node.vx ?? 0,
      vy: node.vy ?? 0
    })
  }

  const response: WorkerResponse = { type: 'tick', positions }
  self.postMessage(response)
}

function handleMessage(e: MessageEvent<WorkerMessage>): void {
  const message = e.data

  switch (message.type) {
    case 'init':
      config = message.config
      simulation = createSimulation()
      self.postMessage({ type: 'ready' } as WorkerResponse)
      break

    case 'updateNodes': {
      const existingIds = new Set(nodes.keys())
      const newIds = new Set(message.nodes.map((n) => n.id))

      // Remove deleted nodes
      for (const id of existingIds) {
        if (!newIds.has(id)) {
          nodes.delete(id)
        }
      }

      // Add or update nodes
      for (const nodeData of message.nodes) {
        let simNode = nodes.get(nodeData.id)
        if (!simNode) {
          simNode = {
            id: nodeData.id,
            x: nodeData.x,
            y: nodeData.y,
            vx: nodeData.vx,
            vy: nodeData.vy,
            fx: nodeData.fx,
            fy: nodeData.fy
          }
          nodes.set(nodeData.id, simNode)
        } else {
          simNode.x = nodeData.x
          simNode.y = nodeData.y
          simNode.vx = nodeData.vx
          simNode.vy = nodeData.vy
          simNode.fx = nodeData.fx
          simNode.fy = nodeData.fy
        }
      }

      if (simulation) {
        simulation.nodes(Array.from(nodes.values()))
      }
      break
    }

    case 'updateEdges': {
      links.clear()
      for (const edgeData of message.edges) {
        const sourceNode = nodes.get(edgeData.source)
        const targetNode = nodes.get(edgeData.target)
        if (sourceNode && targetNode) {
          links.set(edgeData.id, {
            id: edgeData.id,
            source: sourceNode,
            target: targetNode,
            strength: edgeData.strength,
            distance: edgeData.distance
          })
        }
      }

      if (simulation) {
        const linkForce = simulation.force('link') as ReturnType<typeof forceLink<SimNode, SimLink>>
        if (linkForce) {
          linkForce.links(Array.from(links.values()))
        }
      }
      break
    }

    case 'start': {
      if (!simulation || tickInterval) break
      if (!hasEverStarted) {
        for (const node of nodes.values()) {
          node.vx = 0
          node.vy = 0
        }
        hasEverStarted = true
      }
      const alpha = message.soft === true ? 0.1 : 1
      simulation.alpha(alpha).restart()
      // Run at 30Hz
      tickInterval = setInterval(() => {
          if (simulation) {
            simulation.tick()
            applyRadialBound()
            sendTick()

            if (simulation.alpha() < 0.001) {
              self.postMessage({ type: 'stabilized' } as WorkerResponse)
            }
          }
        }, 33.33)
      break
    }

    case 'stop':
      if (tickInterval) {
        clearInterval(tickInterval)
        tickInterval = null
      }
      if (simulation) {
        simulation.stop()
      }
      break

    case 'reheat':
      if (simulation) {
        simulation.alpha(message.alpha).restart()
      }
      break

    case 'pinNode': {
      const node = nodes.get(message.nodeId)
      if (node) {
        node.fx = message.x
        node.fy = message.y
        node.x = message.x
        node.y = message.y
      }
      break
    }

    case 'unpinNode': {
      const node = nodes.get(message.nodeId)
      if (node) {
        node.fx = null
        node.fy = null
      }
      break
    }

    case 'setGravitySource':
      gravitySourceId = message.draggedNodeId ?? message.focusedNodeId ?? null
      applyGravityForces()
      break

    case 'updateConfig':
      config = { ...config, ...message.config }

      if (simulation) {
        const chargeForce = simulation.force('charge') as ReturnType<typeof forceManyBody>
        if (chargeForce) {
          chargeForce.strength(config.chargeStrength)
        }

        const linkForce = simulation.force('link') as ReturnType<typeof forceLink<SimNode, SimLink>>
        if (linkForce) {
          linkForce.strength((d: SimLink) => d.strength * config.linkStrength)
        }

        const centerForce = simulation.force('center') as ReturnType<typeof forceCenter>
        if (centerForce) {
          centerForce.strength(config.centerStrength)
        }

        const collideForce = simulation.force('collide') as ReturnType<typeof forceCollide>
        if (collideForce) {
          collideForce.radius(config.collideRadius)
        }

        simulation.alphaDecay(config.alphaDecay)
        simulation.velocityDecay(config.velocityDecay)
      }
      break
  }
}

self.onmessage = handleMessage
