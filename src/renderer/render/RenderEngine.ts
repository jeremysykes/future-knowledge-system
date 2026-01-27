import type { KnowledgeNode } from '../core/types/node'
import type { Edge, EdgeType } from '../core/types/edge'

interface LensRenderState {
  emphasized: Set<string>
  dimmed: Set<string>
  sizeMultipliers: Map<string, number>
}

interface RenderState {
  panX: number
  panY: number
  scale: number
  focusedNodeId: string | null
  selectedNodeIds: Set<string>
  hoveredNodeId: string | null
  time: number
  lens?: LensRenderState
}

const NODE_COLORS: Record<string, string> = {
  knowledge: '#4a80e6',
  rule: '#e69a2e',
  decision: '#9a4ae6'
}

const EDGE_COLORS: Record<EdgeType, string> = {
  link: 'rgba(100, 130, 180, 0.6)',
  reference: 'rgba(100, 130, 180, 0.4)',
  contradiction: 'rgba(220, 80, 80, 0.6)',
  supports: 'rgba(80, 180, 100, 0.6)',
  derived: 'rgba(140, 100, 180, 0.6)'
}

export class RenderEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private animationFrameId: number | null = null
  private startTime: number = 0

  private nodes: Map<string, KnowledgeNode> = new Map()
  private edges: Map<string, Edge> = new Map()
  private renderState: RenderState = {
    panX: 0,
    panY: 0,
    scale: 1,
    focusedNodeId: null,
    selectedNodeIds: new Set(),
    hoveredNodeId: null,
    time: 0
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.startTime = performance.now()
  }

  async initialize(): Promise<void> {
    // Canvas 2D doesn't need async initialization
    console.log('Canvas 2D renderer initialized')
  }

  updateNodes(nodes: Map<string, KnowledgeNode>): void {
    this.nodes = nodes
  }

  updateEdges(edges: Map<string, Edge>): void {
    this.edges = edges
  }

  updateRenderState(state: Partial<RenderState>): void {
    this.renderState = { ...this.renderState, ...state }
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1
    // Only set internal buffer dimensions, not CSS styles
    this.canvas.width = width * dpr
    this.canvas.height = height * dpr
    // CSS handles layout size (100% width/height from Canvas component)
    // DPR scaling is handled in render() via setTransform
  }

  render(): void {
    const { width, height } = this.canvas
    const dpr = window.devicePixelRatio || 1
    const w = width / dpr
    const h = height / dpr
    const { panX, panY, scale } = this.renderState

    // Reset transform and clear
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.fillStyle = '#0a0a0f'
    this.ctx.fillRect(0, 0, w, h)

    // Apply camera transform
    this.ctx.save()
    this.ctx.translate(w / 2 + panX, h / 2 + panY)
    this.ctx.scale(scale, scale)

    // Draw edges first
    this.drawEdges()

    // Draw nodes
    this.drawNodes()

    this.ctx.restore()
  }

  private drawEdges(): void {
    const ctx = this.ctx
    const { hoveredNodeId } = this.renderState

    for (const edge of this.edges.values()) {
      const sourceNode = this.nodes.get(edge.source)
      const targetNode = this.nodes.get(edge.target)
      if (!sourceNode || !targetNode) continue

      const isEdgeDimmed =
        hoveredNodeId != null && edge.source !== hoveredNodeId && edge.target !== hoveredNodeId

      ctx.beginPath()
      ctx.moveTo(sourceNode.position.x, sourceNode.position.y)
      ctx.lineTo(targetNode.position.x, targetNode.position.y)
      ctx.strokeStyle = EDGE_COLORS[edge.type] || EDGE_COLORS.link
      ctx.lineWidth = 1 + edge.strength
      if (isEdgeDimmed) ctx.globalAlpha = 0.25
      ctx.stroke()
      if (isEdgeDimmed) ctx.globalAlpha = 1
    }
    ctx.globalAlpha = 1
  }

  private drawNodes(): void {
    const ctx = this.ctx
    const { focusedNodeId, selectedNodeIds, hoveredNodeId, lens } = this.renderState

    for (const node of this.nodes.values()) {
      const { x, y } = node.position
      const importance = node.data.type === 'knowledge' ? node.data.importance : 0.5

      // Apply lens size multiplier if present
      const sizeMultiplier = lens?.sizeMultipliers.get(node.id) ?? 1
      const baseRadius = (8 + importance * 12) * sizeMultiplier

      const isSelected = selectedNodeIds.has(node.id)
      const isFocused = focusedNodeId === node.id
      const isHovered = hoveredNodeId === node.id
      const isDimmed =
        (lens?.dimmed.has(node.id) ?? false) || (hoveredNodeId != null && !isHovered)
      const isEmphasized = lens?.emphasized.has(node.id) ?? false

      // Calculate alpha based on lens and hover state
      let alpha = 1
      if (isDimmed) alpha = 0.25

      // Draw glow for focused or emphasized nodes
      if (isFocused || isEmphasized) {
        const glowAlpha = isFocused ? 0.4 : 0.2
        const gradient = ctx.createRadialGradient(x, y, baseRadius, x, y, baseRadius * 2.5)
        gradient.addColorStop(0, `rgba(100, 150, 255, ${glowAlpha})`)
        gradient.addColorStop(1, 'rgba(100, 150, 255, 0)')
        ctx.beginPath()
        ctx.arc(x, y, baseRadius * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      // Draw node body
      ctx.beginPath()

      if (node.data.type === 'rule') {
        // Diamond shape for rules
        ctx.moveTo(x, y - baseRadius)
        ctx.lineTo(x + baseRadius, y)
        ctx.lineTo(x, y + baseRadius)
        ctx.lineTo(x - baseRadius, y)
        ctx.closePath()
      } else if (node.data.type === 'decision') {
        // Rounded square for decisions
        const r = baseRadius * 0.3
        ctx.moveTo(x - baseRadius + r, y - baseRadius)
        ctx.lineTo(x + baseRadius - r, y - baseRadius)
        ctx.quadraticCurveTo(x + baseRadius, y - baseRadius, x + baseRadius, y - baseRadius + r)
        ctx.lineTo(x + baseRadius, y + baseRadius - r)
        ctx.quadraticCurveTo(x + baseRadius, y + baseRadius, x + baseRadius - r, y + baseRadius)
        ctx.lineTo(x - baseRadius + r, y + baseRadius)
        ctx.quadraticCurveTo(x - baseRadius, y + baseRadius, x - baseRadius, y + baseRadius - r)
        ctx.lineTo(x - baseRadius, y - baseRadius + r)
        ctx.quadraticCurveTo(x - baseRadius, y - baseRadius, x - baseRadius + r, y - baseRadius)
      } else {
        // Circle for knowledge
        ctx.arc(x, y, baseRadius, 0, Math.PI * 2)
      }

      // Fill node with alpha
      const color = NODE_COLORS[node.data.type] || NODE_COLORS.knowledge
      ctx.globalAlpha = alpha
      ctx.fillStyle = color
      ctx.fill()
      ctx.globalAlpha = 1

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Draw label if zoomed in enough and not dimmed
      if (this.renderState.scale > 0.5 && !isDimmed) {
        ctx.fillStyle = `rgba(224, 224, 224, ${alpha})`
        ctx.font = `${Math.max(10, 12 * importance)}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'

        const label = node.title.length > 20 ? node.title.slice(0, 20) + '...' : node.title
        ctx.fillText(label, x, y + baseRadius + 4)
      }
    }
  }

  startRenderLoop(): void {
    const loop = () => {
      this.render()
      this.animationFrameId = requestAnimationFrame(loop)
    }
    loop()
  }

  stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  destroy(): void {
    this.stopRenderLoop()
  }
}
