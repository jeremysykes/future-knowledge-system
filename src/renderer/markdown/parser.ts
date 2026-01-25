import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import remarkGfm from 'remark-gfm'
import type { Root, Content, Link, Text } from 'mdast'

export interface ParsedLink {
  type: 'wiki' | 'markdown' | 'url'
  target: string
  text: string
  position: {
    start: number
    end: number
  }
}

export interface ParsedMarkdown {
  content: string
  links: ParsedLink[]
  headings: Array<{ level: number; text: string }>
  tags: string[]
}

// Wiki link pattern: [[target]] or [[target|display text]]
const WIKI_LINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

// Tag pattern: #tag-name
const TAG_REGEX = /#([a-zA-Z][a-zA-Z0-9_-]*)/g

export function parseMarkdown(content: string): ParsedMarkdown {
  const links: ParsedLink[] = []
  const headings: Array<{ level: number; text: string }> = []
  const tags: string[] = []

  // Parse with remark
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)

  const tree = processor.parse(content) as Root

  // Extract standard markdown links and headings from AST
  function visit(node: Content | Root, parent?: Content | Root): void {
    if (node.type === 'link') {
      const linkNode = node as Link
      const text = extractText(linkNode)
      const start = linkNode.position?.start.offset ?? 0
      const end = linkNode.position?.end.offset ?? 0

      links.push({
        type: linkNode.url.startsWith('http') ? 'url' : 'markdown',
        target: linkNode.url,
        text,
        position: { start, end }
      })
    }

    if (node.type === 'heading') {
      const text = extractText(node)
      headings.push({
        level: (node as { depth: number }).depth,
        text
      })
    }

    if ('children' in node) {
      for (const child of (node as { children: Content[] }).children) {
        visit(child, node)
      }
    }
  }

  visit(tree)

  // Extract wiki-style links [[target]] or [[target|text]]
  let match
  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    const target = match[1].trim()
    const displayText = match[2]?.trim() || target

    links.push({
      type: 'wiki',
      target,
      text: displayText,
      position: {
        start: match.index,
        end: match.index + match[0].length
      }
    })
  }

  // Extract tags
  while ((match = TAG_REGEX.exec(content)) !== null) {
    const tag = match[1]
    if (!tags.includes(tag)) {
      tags.push(tag)
    }
  }

  // Sort links by position
  links.sort((a, b) => a.position.start - b.position.start)

  return {
    content,
    links,
    headings,
    tags
  }
}

function extractText(node: Content | Root): string {
  if (node.type === 'text') {
    return (node as Text).value
  }

  if ('children' in node) {
    return (node as { children: Content[] }).children
      .map((child) => extractText(child))
      .join('')
  }

  return ''
}

export function stringifyMarkdown(tree: Root): string {
  const processor = unified()
    .use(remarkStringify, {
      bullet: '-',
      emphasis: '_',
      strong: '*',
      rule: '-'
    })
    .use(remarkGfm)

  return processor.stringify(tree)
}

export function extractTitle(content: string): string {
  const parsed = parseMarkdown(content)

  // Use first h1 heading if available
  const h1 = parsed.headings.find((h) => h.level === 1)
  if (h1) {
    return h1.text
  }

  // Otherwise use first heading of any level
  if (parsed.headings.length > 0) {
    return parsed.headings[0].text
  }

  // Otherwise use first line (trimmed)
  const firstLine = content.split('\n')[0]?.trim()
  if (firstLine) {
    // Remove markdown formatting
    return firstLine
      .replace(/^#+\s*/, '')
      .replace(/\*\*|__/g, '')
      .replace(/\*|_/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
  }

  return 'Untitled'
}

export function replaceWikiLinksWithMarkdown(content: string): string {
  return content.replace(WIKI_LINK_REGEX, (_, target, displayText) => {
    const text = displayText || target
    const filename = target.toLowerCase().replace(/\s+/g, '-')
    return `[${text}](./${filename}.md)`
  })
}

export function replaceMarkdownLinksWithWiki(content: string): string {
  // Replace [text](./filename.md) with [[filename|text]] or [[filename]] if text matches
  const mdLinkRegex = /\[([^\]]+)\]\(\.\/([^)]+)\.md\)/g

  return content.replace(mdLinkRegex, (_, text, filename) => {
    const normalizedFilename = filename.replace(/-/g, ' ')
    if (text.toLowerCase() === normalizedFilename.toLowerCase()) {
      return `[[${normalizedFilename}]]`
    }
    return `[[${normalizedFilename}|${text}]]`
  })
}
