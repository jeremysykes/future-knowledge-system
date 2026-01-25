import { useState, useEffect, useCallback, useRef } from 'react'
import { getSearchIndex, type SearchResult } from '../semantic/search/SearchIndex'
import { useFieldStore } from '../core/store/fieldStore'
import { useViewportStore } from '../core/store/viewportStore'
import { eventBus } from '../core/events/eventBus'

interface SearchBarProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchBar({ isOpen, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const nodes = useFieldStore((state) => state.nodes)
  const selectNode = useFieldStore((state) => state.selectNode)
  const focusNode = useFieldStore((state) => state.focusNode)

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Index nodes when they change
  useEffect(() => {
    const searchIndex = getSearchIndex()
    searchIndex.indexAll(nodes)
  }, [nodes])

  // Search on query change
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const searchIndex = getSearchIndex()
    const searchResults = searchIndex.search(query)
    setResults(searchResults)
    setSelectedIndex(0)

    eventBus.emit('search:results', { nodeIds: searchResults.map((r) => r.nodeId) })
  }, [query])

  const handleSelect = useCallback((result: SearchResult) => {
    const node = nodes.get(result.nodeId)
    if (!node) return

    selectNode(result.nodeId)
    focusNode(result.nodeId)

    // Animate to node
    const viewport = useViewportStore.getState()
    const targetPanX = viewport.width / 2 - node.position.x * viewport.scale
    const targetPanY = viewport.height / 2 - node.position.y * viewport.scale
    viewport.animateTo(targetPanX, targetPanY, Math.max(viewport.scale, 1.2))

    onClose()
  }, [nodes, selectNode, focusNode, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose()
        eventBus.emit('search:clear', {})
        break

      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break

      case 'Enter':
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex])
        }
        break
    }
  }, [results, selectedIndex, handleSelect, onClose])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 100,
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 500,
          maxWidth: '90vw',
          backgroundColor: '#1a1a24',
          borderRadius: 8,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          maxHeight: 400
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 12, borderBottom: '1px solid #2a2a3a' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search nodes..."
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0a0a0f',
              border: '1px solid #3a3a4a',
              borderRadius: 4,
              color: '#e0e0e0',
              fontSize: 14,
              outline: 'none'
            }}
          />
        </div>

        {results.length > 0 && (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {results.map((result, index) => {
              const node = nodes.get(result.nodeId)
              if (!node) return null

              return (
                <div
                  key={result.nodeId}
                  onClick={() => handleSelect(result)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    backgroundColor: index === selectedIndex ? '#2a2a3a' : 'transparent',
                    borderBottom: '1px solid #1a1a24'
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div style={{ color: '#e0e0e0', fontSize: 14, marginBottom: 4 }}>
                    {node.title}
                  </div>
                  <div style={{ color: '#666', fontSize: 12 }}>
                    {result.matches.map((m, i) => (
                      <span key={i}>
                        <span style={{ color: '#4a6fa5' }}>{m.field}: </span>
                        {m.snippet}
                        {i < result.matches.length - 1 && ' • '}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
            No results found
          </div>
        )}

        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #2a2a3a',
          fontSize: 11,
          color: '#555',
          display: 'flex',
          gap: 16
        }}>
          <span>↑↓ Navigate</span>
          <span>Enter Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
