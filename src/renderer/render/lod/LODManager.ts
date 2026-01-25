import type { KnowledgeNode } from '../../core/types/node'

export type LODLevel = 'point' | 'circle' | 'label' | 'full'

export interface LODConfig {
  pointThreshold: number     // scale below which nodes are rendered as points
  circleThreshold: number    // scale below which nodes are rendered as circles (no labels)
  labelThreshold: number     // scale above which labels are shown
  fullThreshold: number      // scale above which full detail is shown
}

export interface LODResult {
  level: LODLevel
  nodeSize: number
  showLabel: boolean
  showContent: boolean
  labelFontSize: number
}

const DEFAULT_CONFIG: LODConfig = {
  pointThreshold: 0.2,
  circleThreshold: 0.5,
  labelThreshold: 0.8,
  fullThreshold: 1.5
}

export class LODManager {
  private config: LODConfig

  constructor(config: Partial<LODConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  getLODLevel(scale: number): LODLevel {
    if (scale < this.config.pointThreshold) {
      return 'point'
    } else if (scale < this.config.circleThreshold) {
      return 'circle'
    } else if (scale < this.config.labelThreshold) {
      return 'label'
    } else {
      return 'full'
    }
  }

  getNodeLOD(node: KnowledgeNode, scale: number, isFocused: boolean = false): LODResult {
    // Focused nodes always get higher LOD
    const effectiveScale = isFocused ? Math.max(scale, this.config.fullThreshold) : scale

    const level = this.getLODLevel(effectiveScale)
    const importance = node.data.type === 'knowledge' ? node.data.importance : 0.5

    // Base size adjusted by importance
    const baseSize = 8 + importance * 12

    switch (level) {
      case 'point':
        return {
          level,
          nodeSize: Math.max(2, baseSize * 0.3),
          showLabel: false,
          showContent: false,
          labelFontSize: 0
        }

      case 'circle':
        return {
          level,
          nodeSize: baseSize * 0.6,
          showLabel: false,
          showContent: false,
          labelFontSize: 0
        }

      case 'label':
        return {
          level,
          nodeSize: baseSize,
          showLabel: true,
          showContent: false,
          labelFontSize: 10 + importance * 4
        }

      case 'full':
        return {
          level,
          nodeSize: baseSize * 1.2,
          showLabel: true,
          showContent: true,
          labelFontSize: 12 + importance * 6
        }
    }
  }

  // Batch process nodes for efficient rendering
  categorizeNodes(
    nodes: Map<string, KnowledgeNode>,
    scale: number,
    focusedNodeId: string | null
  ): Map<LODLevel, KnowledgeNode[]> {
    const categories = new Map<LODLevel, KnowledgeNode[]>([
      ['point', []],
      ['circle', []],
      ['label', []],
      ['full', []]
    ])

    for (const node of nodes.values()) {
      const isFocused = node.id === focusedNodeId
      const { level } = this.getNodeLOD(node, scale, isFocused)
      categories.get(level)!.push(node)
    }

    return categories
  }

  // Get visible nodes within viewport
  getVisibleNodes(
    nodes: Map<string, KnowledgeNode>,
    viewport: { minX: number; minY: number; maxX: number; maxY: number },
    padding: number = 50
  ): KnowledgeNode[] {
    const visible: KnowledgeNode[] = []

    const expandedBounds = {
      minX: viewport.minX - padding,
      minY: viewport.minY - padding,
      maxX: viewport.maxX + padding,
      maxY: viewport.maxY + padding
    }

    for (const node of nodes.values()) {
      if (
        node.position.x >= expandedBounds.minX &&
        node.position.x <= expandedBounds.maxX &&
        node.position.y >= expandedBounds.minY &&
        node.position.y <= expandedBounds.maxY
      ) {
        visible.push(node)
      }
    }

    return visible
  }

  updateConfig(config: Partial<LODConfig>): void {
    this.config = { ...this.config, ...config }
  }
}
