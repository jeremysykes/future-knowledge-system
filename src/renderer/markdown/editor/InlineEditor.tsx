import { useState, useEffect, useRef, useCallback } from 'react'
import type { KnowledgeNode } from '../../core/types/node'
import { useFieldStore } from '../../core/store/fieldStore'
import { parseMarkdown } from '../parser'
import { resolveLinks, buildTitleIndex } from '../linkExtractor'
import { getSearchIndex } from '../../semantic/search/SearchIndex'

interface InlineEditorProps {
  node: KnowledgeNode
  onClose?: (saved?: boolean) => void
}

export function InlineEditor({ node, onClose }: InlineEditorProps) {
  const updateNode = useFieldStore((state) => state.updateNode)
  const addEdge = useFieldStore((state) => state.addEdge)
  const deleteEdge = useFieldStore((state) => state.deleteEdge)
  const nodes = useFieldStore((state) => state.nodes)

  const [title, setTitle] = useState(node.title)
  const [content, setContent] = useState(
    node.data.type === 'knowledge' ? node.data.content :
    node.data.type === 'rule' ? node.data.content :
    node.data.type === 'decision' ? node.data.context : ''
  )
  const [showLinkSuggestions, setShowLinkSuggestions] = useState(false)
  const [linkQuery, setLinkQuery] = useState('')
  const [linkSuggestions, setLinkSuggestions] = useState<KnowledgeNode[]>([])
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [content])

  // Handle wiki-link autocomplete
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setContent(value)

    // Check for [[link pattern
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = value.slice(0, cursorPos)
    const linkMatch = textBeforeCursor.match(/\[\[([^\]]*?)$/)

    if (linkMatch) {
      const query = linkMatch[1]
      setLinkQuery(query)
      setShowLinkSuggestions(true)

      // Get suggestions
      if (query.length >= 1) {
        const searchIndex = getSearchIndex()
        const results = searchIndex.search(query)
        const suggestions = results
          .map((r) => nodes.get(r.nodeId))
          .filter((n): n is KnowledgeNode => n !== undefined && n.id !== node.id)
          .slice(0, 5)
        setLinkSuggestions(suggestions)
      } else {
        // Show recent nodes
        const recentNodes = Array.from(nodes.values())
          .filter((n) => n.id !== node.id)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5)
        setLinkSuggestions(recentNodes)
      }

      // Calculate cursor position for suggestions popup
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect()
        setCursorPosition({ x: rect.left + 20, y: rect.top + 50 })
      }
    } else {
      setShowLinkSuggestions(false)
    }
  }, [node.id, nodes])

  const insertLink = useCallback((targetNode: KnowledgeNode) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBeforeCursor = content.slice(0, cursorPos)
    const textAfterCursor = content.slice(cursorPos)

    // Find the start of [[ before cursor
    const linkStart = textBeforeCursor.lastIndexOf('[[')
    if (linkStart === -1) return

    const newContent =
      textBeforeCursor.slice(0, linkStart) +
      `[[${targetNode.title}]]` +
      textAfterCursor

    setContent(newContent)
    setShowLinkSuggestions(false)

    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = linkStart + targetNode.title.length + 4
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }, [content])

  const handleSave = useCallback(() => {
    const updates: Partial<KnowledgeNode> = {
      title
    }

    const parsed = parseMarkdown(content)
    if (node.data.type === 'knowledge') {
      updates.data = {
        ...node.data,
        content,
        tags: parsed.tags
      }
    } else if (node.data.type === 'rule') {
      updates.data = {
        ...node.data,
        content
      }
    } else if (node.data.type === 'decision') {
      updates.data = {
        ...node.data,
        context: content
      }
    }

    updateNode(node.id, updates)

    // Explicit edge sync: replace outgoing explicit edges from [[links]] and [md](url)
    const titleIndex = buildTitleIndex(nodes)
    const { edges: newEdges } = resolveLinks(node.id, parsed.links, titleIndex)
    const { edges } = useFieldStore.getState()
    for (const e of edges.values()) {
      if (e.source === node.id && (e.origin === 'explicit' || e.origin == null)) {
        deleteEdge(e.id)
      }
    }
    for (const e of newEdges) {
      addEdge(e)
    }

    onClose?.(true)
  }, [node, title, content, updateNode, addEdge, deleteEdge, nodes, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showLinkSuggestions) {
        setShowLinkSuggestions(false)
      } else {
        onClose?.()
      }
    } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    } else if (showLinkSuggestions && e.key === 'Tab' && linkSuggestions.length > 0) {
      e.preventDefault()
      insertLink(linkSuggestions[0])
    }
  }, [showLinkSuggestions, linkSuggestions, onClose, handleSave, insertLink])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600,
        maxWidth: '90vw',
        maxHeight: '80vh',
        backgroundColor: '#1a1a24',
        borderRadius: 8,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        zIndex: 1000
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #2a2a3a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            flex: 1,
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#e0e0e0',
            fontSize: 16,
            fontWeight: 600,
            outline: 'none'
          }}
          placeholder="Node title..."
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onClose?.()}
            style={{
              padding: '4px 12px',
              background: '#2a2a3a',
              border: 'none',
              borderRadius: 4,
              color: '#ccc',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '4px 12px',
              background: '#4a6fa5',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(80vh - 60px)' }}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          style={{
            width: '100%',
            minHeight: 200,
            padding: 12,
            backgroundColor: '#0a0a0f',
            border: '1px solid #2a2a3a',
            borderRadius: 4,
            color: '#e0e0e0',
            fontSize: 14,
            fontFamily: 'monospace',
            lineHeight: 1.6,
            resize: 'none',
            outline: 'none'
          }}
          placeholder="Write your content here... Use [[link]] for wiki-style links"
        />

        {/* Link suggestions */}
        {showLinkSuggestions && linkSuggestions.length > 0 && cursorPosition && (
          <div
            style={{
              position: 'fixed',
              left: cursorPosition.x,
              top: cursorPosition.y,
              backgroundColor: '#2a2a3a',
              borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              zIndex: 1001
            }}
          >
            {linkSuggestions.map((suggestion, i) => (
              <div
                key={suggestion.id}
                onClick={() => insertLink(suggestion)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  backgroundColor: i === 0 ? '#3a3a4a' : 'transparent',
                  borderBottom: '1px solid #1a1a24'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#3a3a4a'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = i === 0 ? '#3a3a4a' : 'transparent'
                }}
              >
                <div style={{ color: '#e0e0e0', fontSize: 13 }}>{suggestion.title}</div>
              </div>
            ))}
            <div style={{ padding: '4px 12px', fontSize: 10, color: '#666' }}>
              Tab to insert first • Esc to close
            </div>
          </div>
        )}

        {/* Metadata */}
        <div style={{ marginTop: 12, fontSize: 11, color: '#555' }}>
          <div>Created: {new Date(node.createdAt).toLocaleString()}</div>
          <div>Updated: {new Date(node.updatedAt).toLocaleString()}</div>
          {node.data.type === 'knowledge' && node.data.tags.length > 0 && (
            <div style={{ marginTop: 4 }}>
              Tags: {node.data.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-block',
                    padding: '1px 6px',
                    margin: '2px',
                    backgroundColor: '#2a2a3a',
                    borderRadius: 3
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #2a2a3a',
        fontSize: 10,
        color: '#555',
        display: 'flex',
        gap: 16
      }}>
        <span>⌘+S Save</span>
        <span>Esc Close</span>
        <span>[[text Link node</span>
      </div>
    </div>
  )
}
