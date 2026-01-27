import { useState, useMemo } from 'react'
import { useFieldStore } from '../core/store/fieldStore'
import { SeedDatabase } from './SeedDatabase'
import { LensSelector } from './LensSelector'
import type { LensConfig } from '../semantic/lens/LensEngine'

interface LeftPanelProps {
  onSearchOpen: () => void
  onHistoryOpen: () => void
  onLensChange: (lens: LensConfig) => void
  start: () => void
  stop: () => void
  reheat: (alpha: number) => void
  dbAvailable?: boolean
}

const PANEL_WIDTH = 280
const TAB_WIDTH = 24

export function LeftPanel({
  onSearchOpen,
  onHistoryOpen,
  onLensChange,
  start,
  stop,
  reheat,
  dbAvailable = true
}: LeftPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [nodeListFilter, setNodeListFilter] = useState('')
  const [nodeListSort, setNodeListSort] = useState<'type' | 'title' | 'importance' | 'tag'>('title')
  const [hintsHovered, setHintsHovered] = useState(false)

  const nodes = useFieldStore((state) => state.nodes)
  const nodeCount = useFieldStore((state) => state.nodes.size)
  const edgeCount = useFieldStore((state) => state.edges.size)
  const isSimulationRunning = useFieldStore((state) => state.isSimulationRunning)
  const selectNode = useFieldStore((state) => state.selectNode)
  const deleteNode = useFieldStore((state) => state.deleteNode)
  const selectedNodeIds = useFieldStore((state) => state.selectedNodeIds)

  const filteredNodes = useMemo(() => {
    let list = Array.from(nodes.values())
    if (nodeListFilter.trim()) {
      const q = nodeListFilter.toLowerCase()
      list = list.filter((n) => {
        if (n.title.toLowerCase().includes(q)) return true
        const c = 'content' in n.data ? String((n.data as { content?: string }).content ?? '').toLowerCase() : ''
        return c.includes(q)
      })
    }
    const typeOrder = (t: string) => (t === 'knowledge' ? 0 : t === 'rule' ? 1 : 2)
    list.sort((a, b) => {
      switch (nodeListSort) {
        case 'type':
          return typeOrder(a.data.type) - typeOrder(b.data.type) || a.title.localeCompare(b.title)
        case 'title':
          return a.title.localeCompare(b.title)
        case 'importance': {
          const va = a.data.type === 'knowledge' ? (a.data as { importance?: number }).importance ?? 0.5 : 0.5
          const vb = b.data.type === 'knowledge' ? (b.data as { importance?: number }).importance ?? 0.5 : 0.5
          return vb - va
        }
        case 'tag': {
          const ta = (a.data as { tags?: string[] }).tags?.[0] ?? ''
          const tb = (b.data as { tags?: string[] }).tags?.[0] ?? ''
          return ta.localeCompare(tb) || a.title.localeCompare(b.title)
        }
        default:
          return 0
      }
    })
    return list
  }, [nodes, nodeListFilter, nodeListSort])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: isCollapsed ? TAB_WIDTH : PANEL_WIDTH,
        flexShrink: 0,
        height: '100%',
        backgroundColor: '#0d0d12',
        borderRight: '1px solid #1e1e28',
        transition: 'width 0.2s ease'
      }}
    >
      {/* Collapse tab / chevron */}
      <button
        onClick={() => setIsCollapsed((c) => !c)}
        style={{
          width: TAB_WIDTH,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#16161d',
          border: 'none',
          borderRight: '1px solid #252532',
          color: '#6a6a7a',
          cursor: 'pointer',
          fontSize: 12
        }}
        title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {isCollapsed ? '›' : '‹'}
      </button>

      {!isCollapsed && (
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Top section */}
          <div
            style={{
              flexShrink: 0,
              padding: 12,
              color: '#888',
              fontSize: 12,
              fontFamily: 'system-ui, sans-serif',
              userSelect: 'none',
              borderBottom: '1px solid #1e1e28'
            }}
          >
            <div>Nodes: {nodeCount}</div>
            <div>Edges: {edgeCount}</div>
            <div>Simulation: {isSimulationRunning ? 'Running' : 'Stopped'}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => (isSimulationRunning ? stop() : start())}
                style={btnStyle}
              >
                {isSimulationRunning ? 'Stop' : 'Start'}
              </button>
              <button onClick={() => reheat(0.5)} style={btnStyle}>Reheat</button>
              <button onClick={onSearchOpen} style={btnStyle}>Search (⌘K)</button>
              <button onClick={onHistoryOpen} style={btnStyle}>History</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <SeedDatabase dbAvailable={dbAvailable} />
            </div>
            <div
              onMouseEnter={() => setHintsHovered(true)}
              onMouseLeave={() => setHintsHovered(false)}
              style={{
                marginTop: 8,
                fontSize: 11,
                color: hintsHovered ? '#9a9aa0' : '#555',
                cursor: 'default',
                pointerEvents: 'auto'
              }}
            >
              Drag empty: Pan • Scroll: Zoom • Drag node: Move
              <br />
              Click: Select • Shift+Click: Multi-select • Delete: Remove • Arrows: Nudge
              <br />
              Double-click: Focus or create • ⌘N: New node • ⌘K: Search
            </div>
          </div>

          {/* Middle: node list + filter */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              borderBottom: '1px solid #1e1e28'
            }}
          >
            <div style={{ flexShrink: 0, margin: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#666' }}>Sort:</span>
                <select
                  value={nodeListSort}
                  onChange={(e) => setNodeListSort(e.target.value as 'type' | 'title' | 'importance' | 'tag')}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    background: '#1a1a24',
                    border: '1px solid #2a2a3a',
                    borderRadius: 4,
                    color: '#e0e0e0',
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  <option value="title">Title</option>
                  <option value="type">Type</option>
                  <option value="importance">Importance</option>
                  <option value="tag">Tag</option>
                </select>
              </div>
              <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Filter nodes…"
                value={nodeListFilter}
                onChange={(e) => setNodeListFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  paddingRight: nodeListFilter.length > 0 ? 28 : 8,
                  background: '#1a1a24',
                  border: '1px solid #2a2a3a',
                  borderRadius: 4,
                  color: '#e0e0e0',
                  fontSize: 12,
                  boxSizing: 'border-box'
                }}
              />
              {nodeListFilter.length > 0 && (
                <button
                  type="button"
                  onClick={() => setNodeListFilter('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#6a6a7a',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1
                  }}
                  title="Clear filter"
                >
                  ×
                </button>
              )}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0 8px 8px'
              }}
            >
              {filteredNodes.map((node) => {
                const isSelected = selectedNodeIds.has(node.id)
                return (
                  <div
                    key={node.id}
                    onClick={() => selectNode(node.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      color: isSelected ? '#fff' : '#b0b0b8',
                      background: isSelected ? '#2a3a5a' : 'transparent'
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {node.title || 'Untitled'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNode(node.id)
                      }}
                      title="Delete node"
                      style={{
                        flexShrink: 0,
                        marginLeft: 6,
                        padding: '2px 4px',
                        background: 'none',
                        border: 'none',
                        color: '#555',
                        cursor: 'pointer',
                        fontSize: 14,
                        lineHeight: 1
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#c44'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#555'
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom section */}
          <div
            style={{
              flexShrink: 0,
              padding: 8,
              overflow: 'auto'
            }}
          >
            <LensSelector onLensChange={onLensChange} embedded />
          </div>
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '4px 8px',
  background: '#2a2a3a',
  border: '1px solid #4a4a5a',
  borderRadius: 4,
  color: '#ccc',
  cursor: 'pointer',
  fontSize: 11
}
