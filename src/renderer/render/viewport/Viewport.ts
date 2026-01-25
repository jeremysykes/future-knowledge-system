import { useViewportStore } from '../../core/store/viewportStore'

interface ViewportOptions {
  canvas: HTMLCanvasElement
  minScale?: number
  maxScale?: number
  zoomSpeed?: number
  panSpeed?: number
}

export class Viewport {
  private canvas: HTMLCanvasElement
  private store = useViewportStore.getState
  private zoomSpeed: number
  private panSpeed: number

  private isDragging = false
  private lastMouseX = 0
  private lastMouseY = 0
  private isPinching = false
  private lastPinchDistance = 0

  private boundHandlers: {
    mouseDown: (e: MouseEvent) => void
    mouseMove: (e: MouseEvent) => void
    mouseUp: (e: MouseEvent) => void
    wheel: (e: WheelEvent) => void
    touchStart: (e: TouchEvent) => void
    touchMove: (e: TouchEvent) => void
    touchEnd: (e: TouchEvent) => void
    resize: () => void
  }

  constructor(options: ViewportOptions) {
    this.canvas = options.canvas
    this.zoomSpeed = options.zoomSpeed ?? 0.001
    this.panSpeed = options.panSpeed ?? 1

    useViewportStore.setState({
      minScale: options.minScale ?? 0.1,
      maxScale: options.maxScale ?? 10
    })

    this.boundHandlers = {
      mouseDown: this.handleMouseDown.bind(this),
      mouseMove: this.handleMouseMove.bind(this),
      mouseUp: this.handleMouseUp.bind(this),
      wheel: this.handleWheel.bind(this),
      touchStart: this.handleTouchStart.bind(this),
      touchMove: this.handleTouchMove.bind(this),
      touchEnd: this.handleTouchEnd.bind(this),
      resize: this.handleResize.bind(this)
    }

    this.attachListeners()
    this.handleResize()
  }

  private attachListeners(): void {
    this.canvas.addEventListener('mousedown', this.boundHandlers.mouseDown)
    this.canvas.addEventListener('mousemove', this.boundHandlers.mouseMove)
    this.canvas.addEventListener('mouseup', this.boundHandlers.mouseUp)
    this.canvas.addEventListener('mouseleave', this.boundHandlers.mouseUp)
    this.canvas.addEventListener('wheel', this.boundHandlers.wheel, { passive: false })
    this.canvas.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: false })
    this.canvas.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: false })
    this.canvas.addEventListener('touchend', this.boundHandlers.touchEnd)
    window.addEventListener('resize', this.boundHandlers.resize)
  }

  private handleMouseDown(e: MouseEvent): void {
    // Middle mouse button or left mouse button (pan on any drag)
    if (e.button === 1 || e.button === 0) {
      // Don't start pan immediately for left button - wait for move to determine if it's a drag
      this.lastMouseX = e.clientX
      this.lastMouseY = e.clientY
      if (e.button === 1) {
        // Middle button starts drag immediately
        e.preventDefault()
        this.isDragging = true
        this.canvas.style.cursor = 'grabbing'
      }
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const deltaX = e.clientX - this.lastMouseX
    const deltaY = e.clientY - this.lastMouseY

    // Start dragging if moved enough (prevents accidental pans on clicks)
    if (!this.isDragging && (e.buttons === 1 || e.buttons === 4)) {
      const moveThreshold = 3
      if (Math.abs(deltaX) > moveThreshold || Math.abs(deltaY) > moveThreshold) {
        this.isDragging = true
        this.canvas.style.cursor = 'grabbing'
      }
    }

    if (!this.isDragging) return

    this.store().pan(deltaX * this.panSpeed, deltaY * this.panSpeed)

    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY
  }

  private handleMouseUp(_e: MouseEvent): void {
    this.isDragging = false
    this.canvas.style.cursor = 'default'
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault()

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // If there's horizontal delta (trackpad two-finger swipe), pan
    // Otherwise zoom with vertical scroll
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5) {
      // Horizontal dominant - pan
      this.store().pan(-e.deltaX, -e.deltaY)
    } else {
      // Vertical dominant - zoom towards mouse position
      const zoomFactor = 1 - e.deltaY * this.zoomSpeed
      this.store().zoom(zoomFactor, mouseX, mouseY)
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      e.preventDefault()
      this.isPinching = true
      this.lastPinchDistance = this.getTouchDistance(e.touches)
    } else if (e.touches.length === 1) {
      this.isDragging = true
      this.lastMouseX = e.touches[0].clientX
      this.lastMouseY = e.touches[0].clientY
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (this.isPinching && e.touches.length === 2) {
      e.preventDefault()
      const distance = this.getTouchDistance(e.touches)
      const scale = distance / this.lastPinchDistance

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const rect = this.canvas.getBoundingClientRect()

      this.store().zoom(scale, centerX - rect.left, centerY - rect.top)
      this.lastPinchDistance = distance
    } else if (this.isDragging && e.touches.length === 1) {
      const deltaX = (e.touches[0].clientX - this.lastMouseX) * this.panSpeed
      const deltaY = (e.touches[0].clientY - this.lastMouseY) * this.panSpeed

      this.store().pan(deltaX, deltaY)

      this.lastMouseX = e.touches[0].clientX
      this.lastMouseY = e.touches[0].clientY
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (e.touches.length < 2) {
      this.isPinching = false
    }
    if (e.touches.length === 0) {
      this.isDragging = false
    }
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  handleResize(): void {
    const rect = this.canvas.getBoundingClientRect()
    this.store().setDimensions(rect.width, rect.height)
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return this.store().screenToWorld(screenX, screenY)
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return this.store().worldToScreen(worldX, worldY)
  }

  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown)
    this.canvas.removeEventListener('mousemove', this.boundHandlers.mouseMove)
    this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseUp)
    this.canvas.removeEventListener('mouseleave', this.boundHandlers.mouseUp)
    this.canvas.removeEventListener('wheel', this.boundHandlers.wheel)
    this.canvas.removeEventListener('touchstart', this.boundHandlers.touchStart)
    this.canvas.removeEventListener('touchmove', this.boundHandlers.touchMove)
    this.canvas.removeEventListener('touchend', this.boundHandlers.touchEnd)
    window.removeEventListener('resize', this.boundHandlers.resize)
  }
}
