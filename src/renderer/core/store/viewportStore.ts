import { create } from 'zustand'
import { eventBus } from '../events/eventBus'

interface ViewportState {
  panX: number
  panY: number
  scale: number
  width: number
  height: number
  minScale: number
  maxScale: number
  isAnimating: boolean
}

interface ViewportActions {
  setPan: (x: number, y: number) => void
  setScale: (scale: number, centerX?: number, centerY?: number) => void
  pan: (deltaX: number, deltaY: number) => void
  zoom: (factor: number, centerX?: number, centerY?: number) => void
  setDimensions: (width: number, height: number) => void
  reset: () => void
  fitToContent: (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => void
  animateTo: (x: number, y: number, scale: number, duration?: number) => Promise<void>
  setAnimating: (animating: boolean) => void
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number }
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number }
}

type ViewportStore = ViewportState & ViewportActions

const DEFAULT_STATE: ViewportState = {
  panX: 0,
  panY: 0,
  scale: 1,
  width: 800,
  height: 600,
  minScale: 0.1,
  maxScale: 10,
  isAnimating: false
}

export const useViewportStore = create<ViewportStore>((set, get) => ({
  ...DEFAULT_STATE,

  setPan: (x, y) => {
    set({ panX: x, panY: y })
    eventBus.emit('viewport:pan', { x, y })
  },

  setScale: (scale, centerX, centerY) => {
    const state = get()
    const clampedScale = Math.max(state.minScale, Math.min(state.maxScale, scale))

    if (centerX !== undefined && centerY !== undefined) {
      // Convert screen point to world before zoom
      const worldX = (centerX - state.width / 2 - state.panX) / state.scale
      const worldY = (centerY - state.height / 2 - state.panY) / state.scale

      // Calculate new pan to keep world point under cursor
      const newPanX = centerX - state.width / 2 - worldX * clampedScale
      const newPanY = centerY - state.height / 2 - worldY * clampedScale

      set({ scale: clampedScale, panX: newPanX, panY: newPanY })
    } else {
      set({ scale: clampedScale })
    }

    eventBus.emit('viewport:zoom', {
      scale: clampedScale,
      centerX: centerX ?? state.width / 2,
      centerY: centerY ?? state.height / 2
    })
  },

  pan: (deltaX, deltaY) => {
    const state = get()
    const newX = state.panX + deltaX
    const newY = state.panY + deltaY
    set({ panX: newX, panY: newY })
    eventBus.emit('viewport:pan', { x: newX, y: newY })
  },

  zoom: (factor, centerX, centerY) => {
    const state = get()
    const newScale = state.scale * factor
    get().setScale(newScale, centerX, centerY)
  },

  setDimensions: (width, height) => {
    set({ width, height })
    eventBus.emit('viewport:resize', { width, height })
  },

  reset: () => {
    set({ panX: 0, panY: 0, scale: 1 })
  },

  fitToContent: (bounds) => {
    const state = get()
    const contentWidth = bounds.maxX - bounds.minX
    const contentHeight = bounds.maxY - bounds.minY

    if (contentWidth === 0 || contentHeight === 0) return

    const padding = 50
    const availableWidth = state.width - padding * 2
    const availableHeight = state.height - padding * 2

    const scaleX = availableWidth / contentWidth
    const scaleY = availableHeight / contentHeight
    const newScale = Math.min(scaleX, scaleY, state.maxScale)

    const contentCenterX = (bounds.minX + bounds.maxX) / 2
    const contentCenterY = (bounds.minY + bounds.maxY) / 2

    // Pan to center the content
    const newPanX = -contentCenterX * newScale
    const newPanY = -contentCenterY * newScale

    set({ scale: newScale, panX: newPanX, panY: newPanY })
  },

  animateTo: async (targetX, targetY, targetScale, duration = 300) => {
    const state = get()
    set({ isAnimating: true })

    const startX = state.panX
    const startY = state.panY
    const startScale = state.scale
    const startTime = performance.now()

    return new Promise((resolve) => {
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)

        const currentX = startX + (targetX - startX) * eased
        const currentY = startY + (targetY - startY) * eased
        const currentScale = startScale + (targetScale - startScale) * eased

        set({ panX: currentX, panY: currentY, scale: currentScale })

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          set({ isAnimating: false })
          resolve()
        }
      }

      requestAnimationFrame(animate)
    })
  },

  setAnimating: (animating) => {
    set({ isAnimating: animating })
  },

  // Convert screen coordinates to world coordinates
  // Screen: (0,0) is top-left of canvas
  // World: (0,0) is center, affected by pan and scale
  screenToWorld: (screenX, screenY) => {
    const state = get()
    return {
      x: (screenX - state.width / 2 - state.panX) / state.scale,
      y: (screenY - state.height / 2 - state.panY) / state.scale
    }
  },

  worldToScreen: (worldX, worldY) => {
    const state = get()
    return {
      x: worldX * state.scale + state.panX + state.width / 2,
      y: worldY * state.scale + state.panY + state.height / 2
    }
  }
}))
