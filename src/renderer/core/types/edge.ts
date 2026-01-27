export type EdgeType = 'link' | 'reference' | 'contradiction' | 'supports' | 'derived'

export type EdgeOrigin = 'explicit' | 'implicit'

export interface Edge {
  id: string
  source: string // node id
  target: string // node id
  type: EdgeType
  strength: number // 0-1 scale, affects attraction
  label?: string
  createdAt: string
  bidirectional: boolean
  origin?: EdgeOrigin // explicit: from [[links]]/markdown; implicit: from similarity
}

export function createEdge(
  source: string,
  target: string,
  type: EdgeType = 'link',
  options?: Partial<Pick<Edge, 'strength' | 'label' | 'bidirectional' | 'origin'>> & { id?: string }
): Edge {
  return {
    id: options?.id ?? `${source}->${target}`,
    source,
    target,
    type,
    strength: options?.strength ?? 0.5,
    label: options?.label,
    bidirectional: options?.bidirectional ?? false,
    origin: options?.origin ?? 'explicit',
    createdAt: new Date().toISOString()
  }
}

export function getEdgeDistance(type: EdgeType): number {
  switch (type) {
    case 'link':
      return 100
    case 'reference':
      return 150
    case 'supports':
      return 80
    case 'contradiction':
      return 200 // push apart
    case 'derived':
      return 60
    default:
      return 100
  }
}

export function getEdgeStrengthMultiplier(type: EdgeType): number {
  switch (type) {
    case 'link':
      return 1
    case 'reference':
      return 0.5
    case 'supports':
      return 1.2
    case 'contradiction':
      return -0.5 // repel
    case 'derived':
      return 1.5
    default:
      return 1
  }
}
