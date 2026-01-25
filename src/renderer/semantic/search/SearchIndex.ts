import FlexSearch from 'flexsearch'
import type { KnowledgeNode } from '../../core/types/node'
import { eventBus } from '../../core/events/eventBus'

export interface SearchResult {
  nodeId: string
  score: number
  matches: {
    field: 'title' | 'content' | 'tags'
    snippet: string
  }[]
}

export interface SearchConfig {
  tokenize: 'strict' | 'forward' | 'reverse' | 'full'
  resolution: number
  minLength: number
  maxResults: number
}

const DEFAULT_CONFIG: SearchConfig = {
  tokenize: 'forward',
  resolution: 9,
  minLength: 2,
  maxResults: 50
}

export class SearchIndex {
  private config: SearchConfig
  private titleIndex: FlexSearch.Index
  private contentIndex: FlexSearch.Index
  private tagIndex: FlexSearch.Index
  private nodeData = new Map<string, KnowledgeNode>()

  constructor(config: Partial<SearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Create separate indices for different fields
    this.titleIndex = new FlexSearch.Index({
      tokenize: this.config.tokenize,
      resolution: this.config.resolution
    })

    this.contentIndex = new FlexSearch.Index({
      tokenize: this.config.tokenize,
      resolution: this.config.resolution
    })

    this.tagIndex = new FlexSearch.Index({
      tokenize: 'strict',
      resolution: this.config.resolution
    })
  }

  addNode(node: KnowledgeNode): void {
    const numericId = this.nodeIdToNumeric(node.id)
    this.nodeData.set(node.id, node)

    // Index title
    this.titleIndex.add(numericId, node.title)

    // Index content
    if (node.data.type === 'knowledge') {
      this.contentIndex.add(numericId, node.data.content)

      // Index tags
      for (const tag of node.data.tags) {
        this.tagIndex.add(numericId, tag)
      }
    } else if (node.data.type === 'rule') {
      this.contentIndex.add(numericId, node.data.content)
    } else if (node.data.type === 'decision') {
      this.contentIndex.add(numericId, `${node.data.context} ${node.data.rationale}`)
    }
  }

  updateNode(node: KnowledgeNode): void {
    this.removeNode(node.id)
    this.addNode(node)
  }

  removeNode(nodeId: string): void {
    const numericId = this.nodeIdToNumeric(nodeId)
    this.nodeData.delete(nodeId)
    this.titleIndex.remove(numericId)
    this.contentIndex.remove(numericId)
    this.tagIndex.remove(numericId)
  }

  search(query: string): SearchResult[] {
    if (query.length < this.config.minLength) {
      return []
    }

    const results = new Map<string, SearchResult>()

    // Search title (highest weight)
    const titleMatches = this.titleIndex.search(query, this.config.maxResults) as number[]
    for (const numericId of titleMatches) {
      const nodeId = this.numericToNodeId(numericId)
      if (!nodeId) continue

      const node = this.nodeData.get(nodeId)
      if (!node) continue

      results.set(nodeId, {
        nodeId,
        score: 3, // Title matches have highest weight
        matches: [{ field: 'title', snippet: node.title }]
      })
    }

    // Search content
    const contentMatches = this.contentIndex.search(query, this.config.maxResults) as number[]
    for (const numericId of contentMatches) {
      const nodeId = this.numericToNodeId(numericId)
      if (!nodeId) continue

      const node = this.nodeData.get(nodeId)
      if (!node) continue

      const content = this.getNodeContent(node)
      const snippet = this.createSnippet(content, query)

      const existing = results.get(nodeId)
      if (existing) {
        existing.score += 1
        existing.matches.push({ field: 'content', snippet })
      } else {
        results.set(nodeId, {
          nodeId,
          score: 1,
          matches: [{ field: 'content', snippet }]
        })
      }
    }

    // Search tags
    const tagMatches = this.tagIndex.search(query, this.config.maxResults) as number[]
    for (const numericId of tagMatches) {
      const nodeId = this.numericToNodeId(numericId)
      if (!nodeId) continue

      const node = this.nodeData.get(nodeId)
      if (!node || node.data.type !== 'knowledge') continue

      const matchingTag = node.data.tags.find((t) =>
        t.toLowerCase().includes(query.toLowerCase())
      )

      const existing = results.get(nodeId)
      if (existing) {
        existing.score += 2
        existing.matches.push({ field: 'tags', snippet: matchingTag || '' })
      } else {
        results.set(nodeId, {
          nodeId,
          score: 2,
          matches: [{ field: 'tags', snippet: matchingTag || '' }]
        })
      }
    }

    // Sort by score descending
    return Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxResults)
  }

  searchByTag(tag: string): KnowledgeNode[] {
    const results: KnowledgeNode[] = []

    for (const node of this.nodeData.values()) {
      if (node.data.type === 'knowledge' && node.data.tags.includes(tag)) {
        results.push(node)
      }
    }

    return results
  }

  getAllTags(): Map<string, number> {
    const tagCounts = new Map<string, number>()

    for (const node of this.nodeData.values()) {
      if (node.data.type === 'knowledge') {
        for (const tag of node.data.tags) {
          const count = tagCounts.get(tag) || 0
          tagCounts.set(tag, count + 1)
        }
      }
    }

    return tagCounts
  }

  private getNodeContent(node: KnowledgeNode): string {
    switch (node.data.type) {
      case 'knowledge':
        return node.data.content
      case 'rule':
        return node.data.content
      case 'decision':
        return `${node.data.context} ${node.data.rationale}`
    }
  }

  private createSnippet(content: string, query: string, contextChars: number = 50): string {
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const index = lowerContent.indexOf(lowerQuery)

    if (index === -1) {
      return content.slice(0, contextChars * 2) + '...'
    }

    const start = Math.max(0, index - contextChars)
    const end = Math.min(content.length, index + query.length + contextChars)

    let snippet = content.slice(start, end)

    if (start > 0) snippet = '...' + snippet
    if (end < content.length) snippet = snippet + '...'

    return snippet
  }

  // Simple hash for converting string IDs to numeric
  private nodeIdToNumeric(nodeId: string): number {
    let hash = 0
    for (let i = 0; i < nodeId.length; i++) {
      const char = nodeId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  private numericToNodeId(numericId: number): string | null {
    for (const [nodeId, _node] of this.nodeData) {
      if (this.nodeIdToNumeric(nodeId) === numericId) {
        return nodeId
      }
    }
    return null
  }

  clear(): void {
    this.nodeData.clear()
    // Recreate indices
    this.titleIndex = new FlexSearch.Index({
      tokenize: this.config.tokenize,
      resolution: this.config.resolution
    })
    this.contentIndex = new FlexSearch.Index({
      tokenize: this.config.tokenize,
      resolution: this.config.resolution
    })
    this.tagIndex = new FlexSearch.Index({
      tokenize: 'strict',
      resolution: this.config.resolution
    })
  }

  indexAll(nodes: Map<string, KnowledgeNode>): void {
    this.clear()
    for (const node of nodes.values()) {
      this.addNode(node)
    }
  }
}

// Singleton instance
let searchIndexInstance: SearchIndex | null = null

export function getSearchIndex(): SearchIndex {
  if (!searchIndexInstance) {
    searchIndexInstance = new SearchIndex()
  }
  return searchIndexInstance
}
