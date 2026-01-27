import { db, nodeToStored, edgeToStored } from './db'
import type { KnowledgeNode } from '../core/types/node'
import type { Edge } from '../core/types/edge'
import { createKnowledgeNode, createRuleNode, createDecisionNode } from '../core/types/node'
import { createEdge } from '../core/types/edge'

const SEED_NODE_CAP = 10_000

export interface SeedOptions {
  clearExisting?: boolean
  nodeCount?: number
  edgeCount?: number
  /** If false, skip writing to IndexedDB and only return in-memory nodes/edges. Default true. */
  persist?: boolean
}

const KNOWLEDGE_TITLES = [
  'Machine Learning Fundamentals',
  'Web Development Best Practices',
  'Database Design Principles',
  'System Architecture Patterns',
  'User Experience Design',
  'API Design Guidelines',
  'Security Best Practices',
  'Performance Optimization',
  'Code Review Standards',
  'Testing Strategies',
  'DevOps Workflows',
  'Cloud Computing Concepts',
  'Data Structures and Algorithms',
  'Software Design Patterns',
  'Agile Methodology',
  'Project Management',
  'Team Collaboration',
  'Documentation Standards',
  'Version Control Best Practices',
  'Continuous Integration'
]

const RULE_TITLES = [
  'Code must be reviewed before merge',
  'All tests must pass in CI',
  'Documentation required for public APIs',
  'Security audit required for auth changes',
  'Performance benchmarks must be maintained',
  'Breaking changes require migration guide',
  'Dependencies must be kept up to date',
  'Error handling must be comprehensive'
]

const DECISION_CONTEXTS = [
  'Should we adopt microservices architecture?',
  'Which database technology to use?',
  'Should we implement feature flags?',
  'What authentication method to use?',
  'Should we migrate to TypeScript?',
  'Which cloud provider to choose?',
  'Should we use GraphQL or REST?',
  'What testing framework to adopt?'
]

const CONTENT_SAMPLES = [
  'This knowledge represents important concepts that should be understood by the team.',
  'Key insights derived from practical experience and research.',
  'Best practices gathered from industry standards and internal learnings.',
  'Important considerations for making informed decisions.',
  'Critical information that impacts system design and implementation.',
  'Valuable knowledge that should be shared across the organization.'
]

export async function seedDatabase(options: SeedOptions = {}): Promise<{ nodes: KnowledgeNode[], edges: Edge[] }> {
  const { clearExisting = false, nodeCount: requested = 75, edgeCount: requestedEdges, persist = true } = options
  const nodeCount = Math.min(SEED_NODE_CAP, Math.max(1, requested))
  const edgeCount = requestedEdges != null
    ? Math.min(Math.max(0, requestedEdges), nodeCount * 2)
    : Math.min(Math.floor(nodeCount * 0.4), Math.max(0, nodeCount - 1))

  const nodes: KnowledgeNode[] = []
  const edges: Edge[] = []

  // Generate nodes in a spiral layout for visual appeal
  const nodeTypes: Array<'knowledge' | 'rule' | 'decision'> = []
  for (let i = 0; i < nodeCount; i++) {
    if (i % 10 === 0) {
      nodeTypes.push('rule')
    } else if (i % 15 === 0) {
      nodeTypes.push('decision')
    } else {
      nodeTypes.push('knowledge')
    }
  }

  // Create nodes in a tight cluster around origin (no outer periphery on init)
  for (let i = 0; i < nodeCount; i++) {
    const x = (Math.random() - 0.5) * 120
    const y = (Math.random() - 0.5) * 120

    const type = nodeTypes[i]
    let node: KnowledgeNode

    if (type === 'rule') {
      const ruleIndex = Math.floor(i / 10) % RULE_TITLES.length
      node = createRuleNode(
        `seed-rule-${i}`,
        RULE_TITLES[ruleIndex],
        `This rule defines important constraints and guidelines for the project. It should be followed to maintain code quality and consistency.`,
        i % 3 === 0 ? 'global' : 'local',
        i % 2 === 0 ? 'hard' : 'soft',
        { x, y }
      )
    } else if (type === 'decision') {
      const decisionIndex = Math.floor(i / 15) % DECISION_CONTEXTS.length
      const alternatives = ['Option A', 'Option B', 'Option C']
      node = createDecisionNode(
        `seed-decision-${i}`,
        DECISION_CONTEXTS[decisionIndex],
        alternatives,
        { x, y }
      )
      if (node.data.type === 'decision') {
        node.data.status = i % 3 === 0 ? 'decided' : i % 3 === 1 ? 'open' : 'superseded'
        node.data.rationale = 'Decision rationale based on team discussion and analysis.'
      }
    } else {
      const titleIndex = i % KNOWLEDGE_TITLES.length
      const contentIndex = i % CONTENT_SAMPLES.length
      node = createKnowledgeNode(
        `seed-knowledge-${i}`,
        KNOWLEDGE_TITLES[titleIndex],
        CONTENT_SAMPLES[contentIndex],
        { x, y }
      )
      if (node.data.type === 'knowledge') {
        node.data.importance = 0.3 + Math.random() * 0.7
        node.data.tags = [
          `category-${Math.floor(i / 10)}`,
          `tag-${i % 5}`,
          `topic-${Math.floor(i / 15)}`
        ]
      }
    }

    nodes.push(node)
  }

  // Create edges with realistic relationships
  const createdEdges = new Set<string>()
  let edgeCounter = 0

  for (let i = 0; i < nodes.length && edgeCounter < edgeCount; i++) {
    const sourceNode = nodes[i]
    
    // Create 1-3 edges per node
    const edgeCountForNode = Math.min(
      Math.floor(Math.random() * 3) + 1,
      edgeCount - edgeCounter
    )

    for (let j = 0; j < edgeCountForNode && edgeCounter < edgeCount; j++) {
      // Prefer connecting to nearby nodes or nodes of different types
      let targetIndex: number
      let attempts = 0
      
      do {
        if (Math.random() > 0.5 && i > 0) {
          // Connect to a previous node (creates hierarchy)
          targetIndex = Math.floor(Math.random() * i)
        } else {
          // Connect to a random node
          targetIndex = Math.floor(Math.random() * nodes.length)
        }
        attempts++
      } while (
        targetIndex === i ||
        createdEdges.has(`${sourceNode.id}-${nodes[targetIndex].id}`) ||
        createdEdges.has(`${nodes[targetIndex].id}-${sourceNode.id}`) ||
        attempts > 20
      )

      if (targetIndex !== i && attempts <= 20) {
        const targetNode = nodes[targetIndex]
        const edgeId = `seed-edge-${edgeCounter}`
        
        // Choose edge type based on node types
        let edgeType: Edge['type'] = 'link'
        if (sourceNode.data.type === 'rule' || targetNode.data.type === 'rule') {
          edgeType = Math.random() > 0.5 ? 'supports' : 'reference'
        } else if (sourceNode.data.type === 'decision' || targetNode.data.type === 'decision') {
          edgeType = Math.random() > 0.5 ? 'supports' : 'reference'
        } else {
          const types: Edge['type'][] = ['link', 'reference', 'supports', 'derived']
          edgeType = types[Math.floor(Math.random() * types.length)]
        }

        const edge = createEdge(
          sourceNode.id,
          targetNode.id,
          edgeType,
          { strength: 0.3 + Math.random() * 0.7 }
        )
        edge.id = edgeId

        edges.push(edge)
        createdEdges.add(`${sourceNode.id}-${targetNode.id}`)
        edgeCounter++
      }
    }
  }

  // Save to database (skip when persist is false, e.g. DB unavailable)
  if (persist === false) {
    return { nodes, edges }
  }

  try {
    await db.transaction('rw', [db.nodes, db.edges], async () => {
      if (clearExisting) {
        await db.nodes.clear()
        await db.edges.clear()
      }

      const storedNodes = nodes.map(nodeToStored)
      const storedEdges = edges.map(edgeToStored)

      await db.nodes.bulkPut(storedNodes)
      await db.edges.bulkPut(storedEdges)
    })

    return { nodes, edges }
  } catch (error) {
    console.error('Failed to seed database:', error)
    throw error
  }
}
