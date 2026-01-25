import { useState, useCallback } from 'react'
import { useFieldStore } from '../core/store/fieldStore'
import { InlineEditor } from '../markdown/editor/InlineEditor'

interface NodeDetailPanelProps {
  nodeId: string
  onClose: () => void
}

export function NodeDetailPanel({ nodeId, onClose }: NodeDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false)

  const node = useFieldStore((state) => state.nodes.get(nodeId))
  const edges = useFieldStore((state) => state.edges)
  const nodes = useFieldStore((state) => state.nodes)
  const focusNode = useFieldStore((state) => state.focusNode)

  if (!node) return null

  // Get connected nodes
  const connectedEdges = Array.from(edges.values()).filter(
    (e) => e.source === nodeId || e.target === nodeId
  )

  const connectedNodes = connectedEdges.map((edge) => {
    const otherId = edge.source === nodeId ? edge.target : edge.source
    return { edge, node: nodes.get(otherId) }
  }).filter((item) => item.node !== undefined)

  const handleNodeClick = useCallback((id: string) => {
    focusNode(id)
  }, [focusNode])

  const getNodeTypeColor = () => {
    switch (node.data.type) {
      case 'knowledge': return '#4a6fa5'
      case 'rule': return '#e07020'
      case 'decision': return '#8a4fa5'
      default: return '#4a6fa5'
    }
  }

  const getContent = () => {
    switch (node.data.type) {
      case 'knowledge':
        return node.data.content
      case 'rule':
        return node.data.content
      case 'decision':
        return `**Context:** ${node.data.context}\n\n**Rationale:** ${node.data.rationale}`
      default:
        return ''
    }
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 60,
          right: 16,
          width: 320,
          maxHeight: 'calc(100vh - 80px)',
          backgroundColor: '#1a1a24',
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100
        }}
      >
        {/* Header */}
        <div style={{
          padding: 16,
          borderBottom: '1px solid #2a2a3a',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12
        }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: getNodeTypeColor(),
              marginTop: 6,
              flexShrink: 0
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              margin: 0,
              color: '#e0e0e0',
              fontSize: 14,
              fontWeight: 600,
              wordBreak: 'break-word'
            }}>
              {node.title}
            </h3>
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              {node.data.type} • {new Date(node.updatedAt).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: 16,
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Tags */}
          {node.data.type === 'knowledge' && node.data.tags.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {node.data.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    marginRight: 4,
                    marginBottom: 4,
                    backgroundColor: '#2a2a3a',
                    borderRadius: 3,
                    fontSize: 11,
                    color: '#888'
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Content preview */}
          <div style={{
            padding: 12,
            backgroundColor: '#0a0a0f',
            borderRadius: 4,
            fontSize: 13,
            color: '#ccc',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflowY: 'auto'
          }}>
            {getContent() || <span style={{ color: '#555' }}>No content</span>}
          </div>

          {/* Connections */}
          {connectedNodes.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                Connections ({connectedNodes.length})
              </div>
              {connectedNodes.map(({ edge, node: connNode }) => (
                <div
                  key={edge.id}
                  onClick={() => handleNodeClick(connNode!.id)}
                  style={{
                    padding: '8px 12px',
                    marginBottom: 4,
                    backgroundColor: '#2a2a3a',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <span style={{ fontSize: 10, color: '#666' }}>
                    {edge.source === nodeId ? '→' : '←'}
                  </span>
                  <span style={{ fontSize: 12, color: '#ccc', flex: 1 }}>
                    {connNode!.title}
                  </span>
                  <span style={{ fontSize: 10, color: '#555' }}>
                    {edge.type}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Decision-specific fields */}
          {node.data.type === 'decision' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                Status: <span style={{ color: '#e0e0e0' }}>{node.data.status}</span>
              </div>
              {node.data.alternatives.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                    Alternatives:
                  </div>
                  {node.data.alternatives.map((alt, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#ccc', paddingLeft: 12 }}>
                      • {alt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rule-specific fields */}
          {node.data.type === 'rule' && (
            <div style={{ marginTop: 16, fontSize: 12 }}>
              <div style={{ color: '#888' }}>
                Scope: <span style={{ color: '#e0e0e0' }}>{node.data.scope}</span>
              </div>
              <div style={{ color: '#888' }}>
                Enforcement: <span style={{ color: '#e0e0e0' }}>{node.data.enforcement}</span>
              </div>
            </div>
          )}

          {/* Importance */}
          {node.data.type === 'knowledge' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                Importance
              </div>
              <div style={{
                height: 4,
                backgroundColor: '#2a2a3a',
                borderRadius: 2,
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${node.data.importance * 100}%`,
                  height: '100%',
                  backgroundColor: '#4a6fa5'
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: 12,
          borderTop: '1px solid #2a2a3a',
          display: 'flex',
          gap: 8
        }}>
          <button
            onClick={() => setIsEditing(true)}
            style={{
              flex: 1,
              padding: '6px 12px',
              background: '#4a6fa5',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            Edit
          </button>
        </div>
      </div>

      {/* Editor modal */}
      {isEditing && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999
            }}
            onClick={() => setIsEditing(false)}
          />
          <InlineEditor node={node} onClose={() => setIsEditing(false)} />
        </>
      )}
    </>
  )
}
