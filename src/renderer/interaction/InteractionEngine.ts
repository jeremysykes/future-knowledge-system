import type { KnowledgeNode } from '../core/types/node'
import { useFieldStore } from '../core/store/fieldStore'
import { useViewportStore } from '../core/store/viewportStore'
import { eventBus } from '../core/events/eventBus'

export type GestureType = 'tap' | 'double-tap' | 'drag' | 'pan' | 'pinch'

export interface DragState {
  isDragging: boolean
  nodeId: string | null
  startX: number
  startY: number
  currentX: number
  currentY: number
  offsetX: number
  offsetY: number
}

export interface InteractionConfig {
  dragThreshold: number
  doubleTapDelay: number
  longPressDelay: number
  pinchThreshold: number
}

const DEFAULT_CONFIG: InteractionConfig = {
  dragThreshold: 5,
  doubleTapDelay: 300,
  longPressDelay: 500,
  pinchThreshold: 10
}

export class InteractionEngine {
  private canvas: HTMLCanvasElement
  private config: InteractionConfig
  private dragState: DragState = {
    isDragging: false,
    nodeId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    offsetX: 0,
    offsetY: 0
  }

  private lastTapTime = 0
  private lastTapPosition = { x: 0, y: 0 }
  private longPressTimer: ReturnType<typeof setTimeout> | null = null

  private touchState = {
    touches: new Map<number, { x: number; y: number }>(),
    lastPinchDistance: 0,
    isPinching: false
  }

  private boundHandlers: {
    mouseDown: (e: MouseEvent) => void
    mouseMove: (e: MouseEvent) => void
    mouseUp: (e: MouseEvent) => void
    click: (e: MouseEvent) => void
    dblClick: (e: MouseEvent) => void
    touchStart: (e: TouchEvent) => void
    touchMove: (e: TouchEvent) => void
    touchEnd: (e: TouchEvent) => void
    keyDown: (e: KeyboardEvent) => void
    keyUp: (e: KeyboardEvent) => void
  }

  constructor(canvas: HTMLCanvasElement, config: Partial<InteractionConfig> = {}) {
    this.canvas = canvas
    this.config = { ...DEFAULT_CONFIG, ...config }

    this.boundHandlers = {
      mouseDown: this.handleMouseDown.bind(this),
      mouseMove: this.handleMouseMove.bind(this),
      mouseUp: this.handleMouseUp.bind(this),
      click: this.handleClick.bind(this),
      dblClick: this.handleDoubleClick.bind(this),
      touchStart: this.handleTouchStart.bind(this),
      touchMove: this.handleTouchMove.bind(this),
      touchEnd: this.handleTouchEnd.bind(this),
      keyDown: this.handleKeyDown.bind(this),
      keyUp: this.handleKeyUp.bind(this)
    }

    this.attachListeners()
  }

  private attachListeners(): void {
    this.canvas.addEventListener('mousedown', this.boundHandlers.mouseDown)
    this.canvas.addEventListener('mousemove', this.boundHandlers.mouseMove)
    this.canvas.addEventListener('mouseup', this.boundHandlers.mouseUp)
    this.canvas.addEventListener('mouseleave', this.boundHandlers.mouseUp)
    this.canvas.addEventListener('click', this.boundHandlers.click)
    this.canvas.addEventListener('dblclick', this.boundHandlers.dblClick)
    this.canvas.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: false })
    this.canvas.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: false })
    this.canvas.addEventListener('touchend', this.boundHandlers.touchEnd)
    window.addEventListener('keydown', this.boundHandlers.keyDown)
    window.addEventListener('keyup', this.boundHandlers.keyUp)
  }

  private getWorldPosition(screenX: number, screenY: number): { x: number; y: number } {
    const viewport = useViewportStore.getState()
    const rect = this.canvas.getBoundingClientRect()
    return viewport.screenToWorld(screenX - rect.left, screenY - rect.top)
  }

  private findNodeAtPosition(worldX: number, worldY: number): KnowledgeNode | null {
    const state = useFieldStore.getState()
    const scale = useViewportStore.getState().scale

    // Search in reverse order (top nodes first)
    const nodes = Array.from(state.nodes.values()).reverse()

    for (const node of nodes) {
      const dx = node.position.x - worldX
      const dy = node.position.y - worldY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const importance = node.data.type === 'knowledge' ? node.data.importance : 0.5
      const nodeRadius = (20 + importance * 15) / scale

      if (dist < nodeRadius) {
        return node
      }
    }

    return null
  }

  private handleMouseDown(e: MouseEvent): void {
    // Only handle left button for node dragging
    if (e.button !== 0 || e.shiftKey) return

    const worldPos = this.getWorldPosition(e.clientX, e.clientY)
    const node = this.findNodeAtPosition(worldPos.x, worldPos.y)

    if (node) {
      this.dragState = {
        isDragging: false, // Will become true on move
        nodeId: node.id,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        offsetX: node.position.x - worldPos.x,
        offsetY: node.position.y - worldPos.y
      }

      // Start long press timer
      this.longPressTimer = setTimeout(() => {
        if (this.dragState.nodeId && !this.dragState.isDragging) {
          const state = useFieldStore.getState()
          state.pinNode(this.dragState.nodeId, node.position.x, node.position.y)
        }
      }, this.config.longPressDelay)
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.dragState.nodeId) return

    const dx = e.clientX - this.dragState.startX
    const dy = e.clientY - this.dragState.startY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > this.config.dragThreshold) {
      this.dragState.isDragging = true
      this.canvas.style.cursor = 'grabbing'

      // Cancel long press
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer)
        this.longPressTimer = null
      }

      // Move the node
      const worldPos = this.getWorldPosition(e.clientX, e.clientY)
      const newX = worldPos.x + this.dragState.offsetX
      const newY = worldPos.y + this.dragState.offsetY

      const state = useFieldStore.getState()
      state.setNodePosition(this.dragState.nodeId, newX, newY)
      state.pinNode(this.dragState.nodeId, newX, newY)
    }

    this.dragState.currentX = e.clientX
    this.dragState.currentY = e.clientY
  }

  private handleMouseUp(e: MouseEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }

    if (this.dragState.isDragging && this.dragState.nodeId) {
      // Unpin after drag unless it was a long press
      const state = useFieldStore.getState()
      state.unpinNode(this.dragState.nodeId)
    }

    this.dragState = {
      isDragging: false,
      nodeId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      offsetX: 0,
      offsetY: 0
    }
    this.canvas.style.cursor = 'default'
  }

  private handleClick(e: MouseEvent): void {
    if (this.dragState.isDragging) return

    const worldPos = this.getWorldPosition(e.clientX, e.clientY)
    const node = this.findNodeAtPosition(worldPos.x, worldPos.y)
    const state = useFieldStore.getState()

    if (node) {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        // Additive selection
        if (state.selectedNodeIds.has(node.id)) {
          state.deselectNode(node.id)
        } else {
          state.selectNode(node.id, true)
        }
      } else {
        // Single selection
        state.selectNode(node.id)
      }
    } else {
      state.clearSelection()
    }
  }

  private handleDoubleClick(e: MouseEvent): void {
    const worldPos = this.getWorldPosition(e.clientX, e.clientY)
    const node = this.findNodeAtPosition(worldPos.x, worldPos.y)
    const state = useFieldStore.getState()

    if (node) {
      state.focusNode(node.id)

      // Animate viewport to center on node
      const viewport = useViewportStore.getState()
      const targetPanX = viewport.width / 2 - node.position.x * viewport.scale
      const targetPanY = viewport.height / 2 - node.position.y * viewport.scale
      viewport.animateTo(targetPanX, targetPanY, Math.max(viewport.scale, 1.5))
    } else {
      state.focusNode(null)
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      this.touchState.touches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY
      })
    }

    if (e.touches.length === 2) {
      e.preventDefault()
      this.touchState.isPinching = true
      this.touchState.lastPinchDistance = this.getTouchDistance(e.touches)
    } else if (e.touches.length === 1) {
      // Single touch - check for node tap
      const touch = e.touches[0]
      const worldPos = this.getWorldPosition(touch.clientX, touch.clientY)
      const node = this.findNodeAtPosition(worldPos.x, worldPos.y)

      if (node) {
        this.dragState = {
          isDragging: false,
          nodeId: node.id,
          startX: touch.clientX,
          startY: touch.clientY,
          currentX: touch.clientX,
          currentY: touch.clientY,
          offsetX: node.position.x - worldPos.x,
          offsetY: node.position.y - worldPos.y
        }
      }
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (this.touchState.isPinching && e.touches.length === 2) {
      e.preventDefault()
      const distance = this.getTouchDistance(e.touches)
      const scale = distance / this.touchState.lastPinchDistance

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const rect = this.canvas.getBoundingClientRect()

      useViewportStore.getState().zoom(scale, centerX - rect.left, centerY - rect.top)
      this.touchState.lastPinchDistance = distance
    } else if (e.touches.length === 1 && this.dragState.nodeId) {
      const touch = e.touches[0]
      const dx = touch.clientX - this.dragState.startX
      const dy = touch.clientY - this.dragState.startY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > this.config.dragThreshold) {
        this.dragState.isDragging = true

        const worldPos = this.getWorldPosition(touch.clientX, touch.clientY)
        const newX = worldPos.x + this.dragState.offsetX
        const newY = worldPos.y + this.dragState.offsetY

        const state = useFieldStore.getState()
        state.setNodePosition(this.dragState.nodeId, newX, newY)
        state.pinNode(this.dragState.nodeId, newX, newY)
      }
    }

    // Update touch positions
    for (const touch of Array.from(e.changedTouches)) {
      this.touchState.touches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY
      })
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      this.touchState.touches.delete(touch.identifier)
    }

    if (e.touches.length < 2) {
      this.touchState.isPinching = false
    }

    if (e.touches.length === 0) {
      // Check for tap vs drag
      if (!this.dragState.isDragging && this.dragState.nodeId) {
        const now = Date.now()
        const timeSinceLastTap = now - this.lastTapTime

        if (timeSinceLastTap < this.config.doubleTapDelay) {
          // Double tap
          const node = useFieldStore.getState().nodes.get(this.dragState.nodeId)
          if (node) {
            useFieldStore.getState().focusNode(node.id)
          }
        } else {
          // Single tap
          useFieldStore.getState().selectNode(this.dragState.nodeId)
        }

        this.lastTapTime = now
      }

      if (this.dragState.nodeId) {
        useFieldStore.getState().unpinNode(this.dragState.nodeId)
      }

      this.dragState = {
        isDragging: false,
        nodeId: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        offsetX: 0,
        offsetY: 0
      }
    }
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const state = useFieldStore.getState()

    switch (e.key) {
      case 'Escape':
        state.clearSelection()
        state.focusNode(null)
        break

      case 'Delete':
      case 'Backspace':
        if (state.selectedNodeIds.size > 0) {
          for (const nodeId of state.selectedNodeIds) {
            state.deleteNode(nodeId)
          }
        }
        break

      case 'a':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          state.selectAll()
        }
        break

      case 'f':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          // Will trigger search (Phase 7)
          eventBus.emit('search:query', { query: '' })
        }
        break

      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        // Nudge selected nodes
        if (state.selectedNodeIds.size > 0) {
          e.preventDefault()
          const delta = e.shiftKey ? 10 : 1
          const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0
          const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0

          for (const nodeId of state.selectedNodeIds) {
            const node = state.nodes.get(nodeId)
            if (node) {
              state.setNodePosition(nodeId, node.position.x + dx, node.position.y + dy)
            }
          }
        }
        break

      case '+':
      case '=':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          useViewportStore.getState().zoom(1.2)
        }
        break

      case '-':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          useViewportStore.getState().zoom(0.8)
        }
        break

      case '0':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          useViewportStore.getState().reset()
        }
        break
    }
  }

  private handleKeyUp(_e: KeyboardEvent): void {
    // Handle key release if needed
  }

  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown)
    this.canvas.removeEventListener('mousemove', this.boundHandlers.mouseMove)
    this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseUp)
    this.canvas.removeEventListener('mouseleave', this.boundHandlers.mouseUp)
    this.canvas.removeEventListener('click', this.boundHandlers.click)
    this.canvas.removeEventListener('dblclick', this.boundHandlers.dblClick)
    this.canvas.removeEventListener('touchstart', this.boundHandlers.touchStart)
    this.canvas.removeEventListener('touchmove', this.boundHandlers.touchMove)
    this.canvas.removeEventListener('touchend', this.boundHandlers.touchEnd)
    window.removeEventListener('keydown', this.boundHandlers.keyDown)
    window.removeEventListener('keyup', this.boundHandlers.keyUp)

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
    }
  }
}
