export type RendererType = 'webgpu' | 'webgl'

export interface GPUContextConfig {
  canvas: HTMLCanvasElement
  preferWebGPU?: boolean
}

export interface GPUContext {
  type: RendererType
  canvas: HTMLCanvasElement
  width: number
  height: number
  destroy: () => void
}

export interface WebGPUContextResult extends GPUContext {
  type: 'webgpu'
  device: GPUDevice
  context: GPUCanvasContext
  format: GPUTextureFormat
  resize: (width: number, height: number) => void
}

export interface WebGLContextResult extends GPUContext {
  type: 'webgl'
  gl: WebGL2RenderingContext
  resize: (width: number, height: number) => void
}

export async function createGPUContext(config: GPUContextConfig): Promise<WebGPUContextResult | WebGLContextResult> {
  const { canvas, preferWebGPU = true } = config

  if (preferWebGPU && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      })

      if (adapter) {
        const device = await adapter.requestDevice({
          requiredFeatures: [],
          requiredLimits: {}
        })

        const context = canvas.getContext('webgpu')
        if (context) {
          const format = navigator.gpu.getPreferredCanvasFormat()
          context.configure({
            device,
            format,
            alphaMode: 'premultiplied'
          })

          console.log('WebGPU context created successfully')

          return {
            type: 'webgpu',
            canvas,
            device,
            context,
            format,
            width: canvas.width,
            height: canvas.height,
            resize: (width: number, height: number) => {
              canvas.width = width
              canvas.height = height
            },
            destroy: () => {
              device.destroy()
            }
          }
        }
      }
    } catch (error) {
      console.warn('WebGPU initialization failed, falling back to WebGL:', error)
    }
  }

  // Fallback to WebGL2
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    alpha: true,
    premultipliedAlpha: true
  })

  if (!gl) {
    throw new Error('Neither WebGPU nor WebGL2 is supported')
  }

  console.log('WebGL2 context created (fallback)')

  return {
    type: 'webgl',
    canvas,
    gl,
    width: canvas.width,
    height: canvas.height,
    resize: (width: number, height: number) => {
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    },
    destroy: () => {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }
}
