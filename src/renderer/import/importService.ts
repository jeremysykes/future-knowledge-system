import matter from 'gray-matter'
import { createKnowledgeNode, type KnowledgeNode } from '../core/types/node'
import { parseMarkdown, extractTitle } from '../markdown/parser'
import { resolveLinks, buildTitleIndex } from '../markdown/linkExtractor'
import type { Edge } from '../core/types/edge'

declare global {
  interface Window {
    api: {
      fs: {
        selectDirectory: () => Promise<string | null>
        selectFiles: (options?: { extensions?: string[] }) => Promise<string[]>
        readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
        listMarkdownFiles: (dir: string) => Promise<{ success: boolean; files: Array<{ path: string; name: string }>; error?: string }>
      }
    }
  }
}

export interface ImportProgress {
  total: number
  current: number
  currentFile: string
  phase: 'reading' | 'parsing' | 'linking'
}

export interface ImportResult {
  nodes: KnowledgeNode[]
  edges: Edge[]
  errors: Array<{ file: string; error: string }>
}

export type ProgressCallback = (progress: ImportProgress) => void

export async function importDirectory(
  onProgress?: ProgressCallback
): Promise<ImportResult | null> {
  // Select directory
  const dirPath = await window.api.fs.selectDirectory()
  if (!dirPath) return null

  return importFromPath(dirPath, onProgress)
}

export async function importFiles(
  onProgress?: ProgressCallback
): Promise<ImportResult | null> {
  // Select files
  const filePaths = await window.api.fs.selectFiles({ extensions: ['md'] })
  if (filePaths.length === 0) return null

  const nodes: KnowledgeNode[] = []
  const errors: Array<{ file: string; error: string }> = []
  const parsedContent = new Map<string, { node: KnowledgeNode; links: ReturnType<typeof parseMarkdown>['links'] }>()

  // Phase 1: Read and parse files
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i]

    onProgress?.({
      total: filePaths.length,
      current: i + 1,
      currentFile: filePath,
      phase: 'reading'
    })

    try {
      const result = await window.api.fs.readFile(filePath)
      if (!result.success || !result.content) {
        errors.push({ file: filePath, error: result.error || 'Failed to read file' })
        continue
      }

      const { node, links } = parseFile(filePath, result.content)
      nodes.push(node)
      parsedContent.set(node.id, { node, links })
    } catch (error) {
      errors.push({ file: filePath, error: String(error) })
    }
  }

  // Phase 2: Resolve links
  onProgress?.({
    total: filePaths.length,
    current: filePaths.length,
    currentFile: '',
    phase: 'linking'
  })

  const edges = resolveAllLinks(parsedContent)

  return { nodes, edges, errors }
}

export async function importFromPath(
  dirPath: string,
  onProgress?: ProgressCallback
): Promise<ImportResult> {
  const nodes: KnowledgeNode[] = []
  const errors: Array<{ file: string; error: string }> = []
  const parsedContent = new Map<string, { node: KnowledgeNode; links: ReturnType<typeof parseMarkdown>['links'] }>()

  // Get list of markdown files
  const listResult = await window.api.fs.listMarkdownFiles(dirPath)
  if (!listResult.success) {
    return { nodes: [], edges: [], errors: [{ file: dirPath, error: listResult.error || 'Failed to list files' }] }
  }

  const files = listResult.files

  // Phase 1: Read and parse files
  for (let i = 0; i < files.length; i++) {
    const file = files[i]

    onProgress?.({
      total: files.length,
      current: i + 1,
      currentFile: file.name,
      phase: 'reading'
    })

    try {
      const result = await window.api.fs.readFile(file.path)
      if (!result.success || !result.content) {
        errors.push({ file: file.path, error: result.error || 'Failed to read file' })
        continue
      }

      const { node, links } = parseFile(file.path, result.content)
      nodes.push(node)
      parsedContent.set(node.id, { node, links })
    } catch (error) {
      errors.push({ file: file.path, error: String(error) })
    }
  }

  // Phase 2: Resolve links
  onProgress?.({
    total: files.length,
    current: files.length,
    currentFile: '',
    phase: 'linking'
  })

  const edges = resolveAllLinks(parsedContent)

  return { nodes, edges, errors }
}

function parseFile(filePath: string, content: string): {
  node: KnowledgeNode
  links: ReturnType<typeof parseMarkdown>['links']
} {
  // Parse frontmatter
  const { data: frontmatter, content: markdownContent } = matter(content)

  // Parse markdown
  const parsed = parseMarkdown(markdownContent)

  // Extract title
  const title = frontmatter.title || extractTitle(markdownContent)

  // Create node ID from file path
  const id = generateNodeId(filePath)

  // Create node
  const node = createKnowledgeNode(id, title, markdownContent)

  // Set additional properties from frontmatter
  if (node.data.type === 'knowledge') {
    node.data.tags = parsed.tags.concat(frontmatter.tags || [])
    node.data.importance = frontmatter.importance ?? 0.5
  }

  node.filePath = filePath

  // Apply position from frontmatter if available
  if (frontmatter.x !== undefined && frontmatter.y !== undefined) {
    node.position = { x: frontmatter.x, y: frontmatter.y }
  }

  // Apply dates from frontmatter
  if (frontmatter.created) {
    node.createdAt = new Date(frontmatter.created).toISOString()
  }
  if (frontmatter.updated) {
    node.updatedAt = new Date(frontmatter.updated).toISOString()
  }

  return { node, links: parsed.links }
}

function generateNodeId(filePath: string): string {
  // Extract filename without extension
  const parts = filePath.split(/[/\\]/)
  const filename = parts[parts.length - 1].replace(/\.md$/i, '')

  // Create a simple hash
  let hash = 0
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  return `${filename}-${Math.abs(hash).toString(36)}`
}

function resolveAllLinks(
  parsedContent: Map<string, { node: KnowledgeNode; links: ReturnType<typeof parseMarkdown>['links'] }>
): Edge[] {
  // Build title index
  const nodesByTitle = buildTitleIndex(
    new Map(
      Array.from(parsedContent.values()).map(({ node }) => [node.id, { id: node.id, title: node.title }])
    )
  )

  const allEdges: Edge[] = []

  for (const [nodeId, { links }] of parsedContent) {
    const { edges } = resolveLinks(nodeId, links, nodesByTitle)
    allEdges.push(...edges)
  }

  return allEdges
}

export async function exportToMarkdown(
  nodes: KnowledgeNode[],
  outputDir: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await window.api.fs.ensureDir(outputDir)

    for (const node of nodes) {
      const filename = node.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md'
      const filePath = `${outputDir}/${filename}`

      // Build frontmatter
      const frontmatter: Record<string, unknown> = {
        title: node.title,
        created: node.createdAt,
        updated: node.updatedAt,
        x: node.position.x,
        y: node.position.y
      }

      if (node.data.type === 'knowledge') {
        frontmatter.tags = node.data.tags
        frontmatter.importance = node.data.importance
      }

      // Build content
      let content = '---\n'
      for (const [key, value] of Object.entries(frontmatter)) {
        if (Array.isArray(value)) {
          content += `${key}:\n`
          for (const item of value) {
            content += `  - ${item}\n`
          }
        } else {
          content += `${key}: ${JSON.stringify(value)}\n`
        }
      }
      content += '---\n\n'

      if (node.data.type === 'knowledge') {
        content += node.data.content
      } else if (node.data.type === 'rule') {
        content += node.data.content
      } else if (node.data.type === 'decision') {
        content += `# ${node.title}\n\n`
        content += `## Context\n${node.data.context}\n\n`
        content += `## Alternatives\n`
        for (const alt of node.data.alternatives) {
          content += `- ${alt}\n`
        }
        content += `\n## Rationale\n${node.data.rationale}\n`
      }

      await window.api.fs.writeFile(filePath, content)
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function exportToJSON(
  nodes: KnowledgeNode[],
  edges: Edge[]
): Promise<string> {
  return JSON.stringify({ nodes, edges }, null, 2)
}
