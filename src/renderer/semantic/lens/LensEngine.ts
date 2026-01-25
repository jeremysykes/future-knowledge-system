import type { KnowledgeNode } from '../../core/types/node'

export type LensType = 'all' | 'tag' | 'time' | 'importance' | 'type' | 'custom'

export interface LensConfig {
  type: LensType
  params: Record<string, unknown>
}

export interface LensResult {
  visible: Set<string>
  emphasized: Set<string>
  dimmed: Set<string>
  sizeMultipliers: Map<string, number>
  colorOverrides: Map<string, [number, number, number, number]>
}

export interface TagLensParams {
  tags: string[]
  mode: 'include' | 'exclude'
}

export interface TimeLensParams {
  range: 'day' | 'week' | 'month' | 'year' | 'custom'
  startDate?: string
  endDate?: string
  emphasizeRecent: boolean
}

export interface ImportanceLensParams {
  minImportance: number
  scaleByImportance: boolean
}

export interface TypeLensParams {
  types: Array<'knowledge' | 'rule' | 'decision'>
}

export class LensEngine {
  private currentLens: LensConfig = { type: 'all', params: {} }
  private transitionDuration = 300

  applyLens(
    nodes: Map<string, KnowledgeNode>,
    lens: LensConfig
  ): LensResult {
    this.currentLens = lens

    switch (lens.type) {
      case 'all':
        return this.applyAllLens(nodes)
      case 'tag':
        return this.applyTagLens(nodes, lens.params as TagLensParams)
      case 'time':
        return this.applyTimeLens(nodes, lens.params as TimeLensParams)
      case 'importance':
        return this.applyImportanceLens(nodes, lens.params as ImportanceLensParams)
      case 'type':
        return this.applyTypeLens(nodes, lens.params as TypeLensParams)
      default:
        return this.applyAllLens(nodes)
    }
  }

  private applyAllLens(nodes: Map<string, KnowledgeNode>): LensResult {
    const visible = new Set(nodes.keys())
    return {
      visible,
      emphasized: new Set(),
      dimmed: new Set(),
      sizeMultipliers: new Map(),
      colorOverrides: new Map()
    }
  }

  private applyTagLens(
    nodes: Map<string, KnowledgeNode>,
    params: TagLensParams
  ): LensResult {
    const visible = new Set<string>()
    const emphasized = new Set<string>()
    const dimmed = new Set<string>()

    for (const [id, node] of nodes) {
      if (node.data.type !== 'knowledge') {
        visible.add(id)
        dimmed.add(id)
        continue
      }

      const hasMatchingTag = node.data.tags.some((tag) =>
        params.tags.includes(tag)
      )

      if (params.mode === 'include') {
        if (hasMatchingTag) {
          visible.add(id)
          emphasized.add(id)
        } else {
          visible.add(id)
          dimmed.add(id)
        }
      } else {
        if (!hasMatchingTag) {
          visible.add(id)
          emphasized.add(id)
        } else {
          visible.add(id)
          dimmed.add(id)
        }
      }
    }

    return {
      visible,
      emphasized,
      dimmed,
      sizeMultipliers: new Map(),
      colorOverrides: new Map()
    }
  }

  private applyTimeLens(
    nodes: Map<string, KnowledgeNode>,
    params: TimeLensParams
  ): LensResult {
    const visible = new Set<string>()
    const emphasized = new Set<string>()
    const dimmed = new Set<string>()
    const sizeMultipliers = new Map<string, number>()

    const now = new Date()
    let startDate: Date
    let endDate = now

    switch (params.range) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      case 'custom':
        startDate = params.startDate ? new Date(params.startDate) : new Date(0)
        endDate = params.endDate ? new Date(params.endDate) : now
        break
    }

    const rangeMs = endDate.getTime() - startDate.getTime()

    for (const [id, node] of nodes) {
      const nodeDate = new Date(node.updatedAt)
      visible.add(id)

      if (nodeDate >= startDate && nodeDate <= endDate) {
        emphasized.add(id)

        if (params.emphasizeRecent) {
          // Scale size based on recency
          const ageMs = endDate.getTime() - nodeDate.getTime()
          const recency = 1 - (ageMs / rangeMs)
          sizeMultipliers.set(id, 0.8 + recency * 0.6)
        }
      } else {
        dimmed.add(id)
        sizeMultipliers.set(id, 0.6)
      }
    }

    return {
      visible,
      emphasized,
      dimmed,
      sizeMultipliers,
      colorOverrides: new Map()
    }
  }

  private applyImportanceLens(
    nodes: Map<string, KnowledgeNode>,
    params: ImportanceLensParams
  ): LensResult {
    const visible = new Set<string>()
    const emphasized = new Set<string>()
    const dimmed = new Set<string>()
    const sizeMultipliers = new Map<string, number>()

    for (const [id, node] of nodes) {
      visible.add(id)

      const importance = node.data.type === 'knowledge' ? node.data.importance : 0.5

      if (importance >= params.minImportance) {
        emphasized.add(id)

        if (params.scaleByImportance) {
          sizeMultipliers.set(id, 0.5 + importance)
        }
      } else {
        dimmed.add(id)
        sizeMultipliers.set(id, 0.5)
      }
    }

    return {
      visible,
      emphasized,
      dimmed,
      sizeMultipliers,
      colorOverrides: new Map()
    }
  }

  private applyTypeLens(
    nodes: Map<string, KnowledgeNode>,
    params: TypeLensParams
  ): LensResult {
    const visible = new Set<string>()
    const emphasized = new Set<string>()
    const dimmed = new Set<string>()

    for (const [id, node] of nodes) {
      visible.add(id)

      if (params.types.includes(node.data.type)) {
        emphasized.add(id)
      } else {
        dimmed.add(id)
      }
    }

    return {
      visible,
      emphasized,
      dimmed,
      sizeMultipliers: new Map(),
      colorOverrides: new Map()
    }
  }

  getCurrentLens(): LensConfig {
    return this.currentLens
  }

  setTransitionDuration(duration: number): void {
    this.transitionDuration = duration
  }

  getTransitionDuration(): number {
    return this.transitionDuration
  }
}

// Singleton instance
let lensEngineInstance: LensEngine | null = null

export function getLensEngine(): LensEngine {
  if (!lensEngineInstance) {
    lensEngineInstance = new LensEngine()
  }
  return lensEngineInstance
}
