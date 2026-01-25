import { useFieldStore } from '../../core/store/fieldStore'
import { useViewportStore } from '../../core/store/viewportStore'
import { eventBus } from '../../core/events/eventBus'
import type { KnowledgeNode } from '../../core/types/node'

export interface FocusConfig {
  animationDuration: number
  zoomLevel: number
  highlightConnections: boolean
}

const DEFAULT_CONFIG: FocusConfig = {
  animationDuration: 300,
  zoomLevel: 1.5,
  highlightConnections: true
}

export class FocusManager {
  private config: FocusConfig
  private focusHistory: string[] = []
  private maxHistorySize = 50

  constructor(config: Partial<FocusConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Listen for focus events
    eventBus.on('node:focused', this.handleNodeFocused.bind(this))
    eventBus.on('node:unfocused', this.handleNodeUnfocused.bind(this))
  }

  private handleNodeFocused({ nodeId }: { nodeId: string }): void {
    // Add to history
    const historyIndex = this.focusHistory.indexOf(nodeId)
    if (historyIndex !== -1) {
      this.focusHistory.splice(historyIndex, 1)
    }
    this.focusHistory.push(nodeId)

    // Trim history
    if (this.focusHistory.length > this.maxHistorySize) {
      this.focusHistory.shift()
    }
  }

  private handleNodeUnfocused(_payload: { nodeId: string | null }): void {
    // Could add unfocus handling here
  }

  async focusNode(nodeId: string): Promise<void> {
    const state = useFieldStore.getState()
    const viewport = useViewportStore.getState()
    const node = state.nodes.get(nodeId)

    if (!node) return

    state.focusNode(nodeId)

    // Calculate target viewport position
    const targetPanX = viewport.width / 2 - node.position.x * this.config.zoomLevel
    const targetPanY = viewport.height / 2 - node.position.y * this.config.zoomLevel

    await viewport.animateTo(
      targetPanX,
      targetPanY,
      Math.max(viewport.scale, this.config.zoomLevel),
      this.config.animationDuration
    )
  }

  unfocus(): void {
    useFieldStore.getState().focusNode(null)
  }

  focusPrevious(): void {
    if (this.focusHistory.length < 2) return

    const currentId = this.focusHistory[this.focusHistory.length - 1]
    const previousId = this.focusHistory[this.focusHistory.length - 2]

    // Remove current from history end
    this.focusHistory.pop()

    // Focus previous
    const state = useFieldStore.getState()
    if (state.nodes.has(previousId)) {
      this.focusNode(previousId)
    }
  }

  focusNext(): void {
    const state = useFieldStore.getState()
    const currentFocused = state.focusedNodeId

    if (!currentFocused) {
      // Focus first node
      const firstNode = state.nodes.values().next().value as KnowledgeNode | undefined
      if (firstNode) {
        this.focusNode(firstNode.id)
      }
      return
    }

    // Get connected nodes and focus the first unvisited one
    const connectedNodes = state.getConnectedNodes(currentFocused)
    for (const node of connectedNodes) {
      if (!this.focusHistory.includes(node.id)) {
        this.focusNode(node.id)
        return
      }
    }

    // If all connected nodes visited, just focus the first connected
    if (connectedNodes.length > 0) {
      this.focusNode(connectedNodes[0].id)
    }
  }

  getConnectedNodes(nodeId: string): KnowledgeNode[] {
    return useFieldStore.getState().getConnectedNodes(nodeId)
  }

  getFocusHistory(): string[] {
    return [...this.focusHistory]
  }

  clearHistory(): void {
    this.focusHistory = []
  }

  updateConfig(config: Partial<FocusConfig>): void {
    this.config = { ...this.config, ...config }
  }
}
