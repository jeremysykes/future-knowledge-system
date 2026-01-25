import { parseMarkdown, type ParsedLink } from './parser'
import type { Edge } from '../core/types/edge'
import { createEdge } from '../core/types/edge'

export interface ExtractedLinks {
  outgoing: ParsedLink[]
  nodeTitle: string
}

export interface LinkResolutionResult {
  edges: Edge[]
  unresolvedLinks: ParsedLink[]
}

export function extractLinks(content: string, nodeTitle: string): ExtractedLinks {
  const parsed = parseMarkdown(content)

  return {
    outgoing: parsed.links,
    nodeTitle
  }
}

export function resolveLinks(
  sourceNodeId: string,
  links: ParsedLink[],
  nodesByTitle: Map<string, string> // title -> nodeId
): LinkResolutionResult {
  const edges: Edge[] = []
  const unresolvedLinks: ParsedLink[] = []

  for (const link of links) {
    if (link.type === 'url') {
      // External URLs don't create edges
      continue
    }

    // Try to resolve the target
    const targetTitle = normalizeTitle(link.target)
    const targetNodeId = nodesByTitle.get(targetTitle)

    if (targetNodeId) {
      // Create edge
      const edgeType = link.type === 'wiki' ? 'link' : 'reference'
      edges.push(
        createEdge(sourceNodeId, targetNodeId, edgeType, {
          strength: link.type === 'wiki' ? 0.8 : 0.5,
          label: link.text !== link.target ? link.text : undefined
        })
      )
    } else {
      unresolvedLinks.push(link)
    }
  }

  return { edges, unresolvedLinks }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\.md$/i, '')
}

export function buildTitleIndex(
  nodes: Map<string, { id: string; title: string }>
): Map<string, string> {
  const index = new Map<string, string>()

  for (const [id, node] of nodes) {
    const normalizedTitle = normalizeTitle(node.title)
    index.set(normalizedTitle, id)

    // Also index without common prefixes/suffixes
    const variants = [
      normalizedTitle,
      normalizedTitle.replace(/^(the|a|an)\s+/i, ''),
      normalizedTitle.replace(/\s+(note|notes|doc|document)$/i, '')
    ]

    for (const variant of variants) {
      if (!index.has(variant)) {
        index.set(variant, id)
      }
    }
  }

  return index
}

export function findBacklinks(
  targetNodeId: string,
  edges: Map<string, Edge>
): string[] {
  const backlinks: string[] = []

  for (const edge of edges.values()) {
    if (edge.target === targetNodeId && !edge.bidirectional) {
      backlinks.push(edge.source)
    }
  }

  return backlinks
}

export function createBidirectionalEdges(edges: Edge[]): Edge[] {
  const edgeMap = new Map<string, Edge>()
  const bidirectionalPairs = new Set<string>()

  for (const edge of edges) {
    edgeMap.set(edge.id, edge)

    // Check if reverse edge exists
    const reverseId = `${edge.target}->${edge.source}`
    if (edgeMap.has(reverseId)) {
      bidirectionalPairs.add(edge.id)
      bidirectionalPairs.add(reverseId)
    }
  }

  // Mark bidirectional edges
  return edges.map((edge) => {
    if (bidirectionalPairs.has(edge.id)) {
      return { ...edge, bidirectional: true }
    }
    return edge
  })
}
