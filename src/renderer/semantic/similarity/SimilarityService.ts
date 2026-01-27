import type { KnowledgeNode } from '../../core/types/node'
import type { Edge } from '../../core/types/edge'

const THRESHOLD = 0.15
const CAP_PER_NODE = 5

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0)
  )
}

function getNodeText(node: KnowledgeNode): string {
  const parts: string[] = [node.title]
  switch (node.data.type) {
    case 'knowledge':
      parts.push(node.data.content)
      break
    case 'rule':
      parts.push(node.data.content)
      break
    case 'decision':
      parts.push(node.data.context, node.data.rationale, node.data.alternatives.join(' '))
      break
    default:
      break
  }
  return parts.filter(Boolean).join(' ')
}

/** Dice coefficient: 2 * |A ∩ B| / (|A| + |B|) */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let inter = 0
  for (const w of a) {
    if (b.has(w)) inter++
  }
  return (2 * inter) / (a.size + b.size)
}

export interface SimilarityPair {
  source: string
  target: string
  weight: number
}

/**
 * Compute text similarity (word overlap) between nodes.
 * - knowledge/rule: title + content; decision: title + context + rationale + alternatives.
 * - Skips pairs that already have an explicit edge.
 * - Threshold 0.15, cap 5 implicit edges per node.
 */
export function compute(
  nodes: Map<string, KnowledgeNode>,
  edges: Map<string, Edge>
): SimilarityPair[] {
  const explicitPairs = new Set<string>()
  for (const e of edges.values()) {
    if (e.origin === 'explicit' || e.origin == null) {
      const a = e.source < e.target ? e.source : e.target
      const b = e.source < e.target ? e.target : e.source
      explicitPairs.add(`${a}:${b}`)
    }
  }

  const arr = Array.from(nodes.values())
  const pairs: SimilarityPair[] = []

  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i]
      const b = arr[j]
      const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`
      if (explicitPairs.has(key)) continue

      const ta = tokenize(getNodeText(a))
      const tb = tokenize(getNodeText(b))
      const w = similarity(ta, tb)
      if (w >= THRESHOLD) {
        pairs.push({
          source: a.id,
          target: b.id,
          weight: Math.min(1, w)
        })
      }
    }
  }

  // Sort by weight descending, then cap 5 per node
  pairs.sort((x, y) => y.weight - x.weight)
  const count = new Map<string, number>()
  const result: SimilarityPair[] = []
  for (const p of pairs) {
    const ca = count.get(p.source) ?? 0
    const cb = count.get(p.target) ?? 0
    if (ca >= CAP_PER_NODE || cb >= CAP_PER_NODE) continue
    result.push(p)
    count.set(p.source, ca + 1)
    count.set(p.target, cb + 1)
  }
  return result
}
