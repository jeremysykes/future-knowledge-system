export type NodeType = 'knowledge' | 'rule' | 'decision'

export interface NodePosition {
  x: number
  y: number
}

export interface NodeVelocity {
  vx: number
  vy: number
}

export interface KnowledgeNodeData {
  type: 'knowledge'
  content: string
  tags: string[]
  importance: number // 0-1 scale
}

export interface RuleNodeData {
  type: 'rule'
  content: string
  scope: 'local' | 'global'
  enforcement: 'hard' | 'soft'
  anchorPosition?: NodePosition
}

export interface DecisionNodeData {
  type: 'decision'
  context: string
  alternatives: string[]
  rationale: string
  status: 'open' | 'decided' | 'superseded'
  decidedAt?: string
}

export type NodeData = KnowledgeNodeData | RuleNodeData | DecisionNodeData

export interface KnowledgeNode {
  id: string
  title: string
  data: NodeData
  position: NodePosition
  velocity: NodeVelocity
  createdAt: string
  updatedAt: string
  filePath?: string
  fx?: number | null // fixed x position (for pinning)
  fy?: number | null // fixed y position (for pinning)
}

export function createKnowledgeNode(
  id: string,
  title: string,
  content: string = '',
  position?: Partial<NodePosition>
): KnowledgeNode {
  const now = new Date().toISOString()
  return {
    id,
    title,
    data: {
      type: 'knowledge',
      content,
      tags: [],
      importance: 0.5
    },
    position: {
      x: position?.x ?? Math.random() * 1000 - 500,
      y: position?.y ?? Math.random() * 1000 - 500
    },
    velocity: { vx: 0, vy: 0 },
    createdAt: now,
    updatedAt: now
  }
}

export function createRuleNode(
  id: string,
  title: string,
  content: string,
  scope: 'local' | 'global' = 'local',
  enforcement: 'hard' | 'soft' = 'soft',
  position?: Partial<NodePosition>
): KnowledgeNode {
  const now = new Date().toISOString()
  return {
    id,
    title,
    data: {
      type: 'rule',
      content,
      scope,
      enforcement
    },
    position: {
      x: position?.x ?? Math.random() * 1000 - 500,
      y: position?.y ?? Math.random() * 1000 - 500
    },
    velocity: { vx: 0, vy: 0 },
    createdAt: now,
    updatedAt: now
  }
}

export function createDecisionNode(
  id: string,
  context: string,
  alternatives: string[] = [],
  position?: Partial<NodePosition>
): KnowledgeNode {
  const now = new Date().toISOString()
  return {
    id,
    title: `Decision: ${context.slice(0, 50)}...`,
    data: {
      type: 'decision',
      context,
      alternatives,
      rationale: '',
      status: 'open'
    },
    position: {
      x: position?.x ?? Math.random() * 1000 - 500,
      y: position?.y ?? Math.random() * 1000 - 500
    },
    velocity: { vx: 0, vy: 0 },
    createdAt: now,
    updatedAt: now
  }
}
