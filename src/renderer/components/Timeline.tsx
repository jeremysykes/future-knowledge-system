import { useState, useEffect } from 'react'
import { getHistoryRepository } from '../persistence/historyRepository'
import type { HistoryEvent, Snapshot } from '../persistence/db'

interface TimelineProps {
  isOpen: boolean
  onClose: () => void
  onRestoreSnapshot: (timestamp: string) => void
}

export function Timeline({ isOpen, onClose, onRestoreSnapshot }: TimelineProps) {
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [timelineData, setTimelineData] = useState<
    Array<{ timestamp: string; nodeCount: number; edgeCount: number; changeCount: number }>
  >([])
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [viewMode, setViewMode] = useState<'events' | 'timeline' | 'snapshots'>('snapshots')

  useEffect(() => {
    if (!isOpen) return

    const loadData = async () => {
      const historyRepo = getHistoryRepository()

      // Load recent events
      const recentEvents = await historyRepo.getEvents({ limit: 100 })
      setEvents(recentEvents)

      // Load snapshots
      const allSnapshots = await historyRepo.getSnapshots(50)
      setSnapshots(allSnapshots)

      // Load timeline data
      const endDate = new Date().toISOString()
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const timeline = await historyRepo.getTimeline(startDate, endDate, 'day')
      setTimelineData(timeline)
    }

    loadData()
  }, [isOpen])

  const handleRestore = async () => {
    if (selectedSnapshotId !== null) {
      // Restore from snapshot
      setIsRestoring(true)
      try {
        const historyRepo = getHistoryRepository()
        const snapshot = await historyRepo.restoreFromSnapshot(selectedSnapshotId)
        if (snapshot) {
          onRestoreSnapshot(snapshot.timestamp)
          onClose()
        }
      } catch (error) {
        console.error('Failed to restore from snapshot:', error)
        alert('Failed to restore from snapshot. Check console for details.')
      } finally {
        setIsRestoring(false)
      }
    } else if (selectedTimestamp) {
      // Restore from timestamp (event replay)
      onRestoreSnapshot(selectedTimestamp)
      onClose()
    }
  }

  const formatEventType = (type: HistoryEvent['type']): string => {
    switch (type) {
      case 'node:created': return '+ Node'
      case 'node:updated': return '~ Node'
      case 'node:deleted': return '- Node'
      case 'edge:created': return '+ Edge'
      case 'edge:deleted': return '- Edge'
      default: return type
    }
  }

  const getEventColor = (type: HistoryEvent['type']): string => {
    if (type.includes('created')) return '#4ade80'
    if (type.includes('deleted')) return '#f87171'
    return '#60a5fa'
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 400,
        backgroundColor: '#1a1a24',
        boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000
      }}
    >
      {/* Header */}
      <div style={{
        padding: 16,
        borderBottom: '1px solid #2a2a3a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: 16 }}>History</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: 18
          }}
        >
          ×
        </button>
      </div>

      {/* View mode toggle */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid #2a2a3a',
        display: 'flex',
        gap: 8
      }}>
        <button
          onClick={() => setViewMode('events')}
          style={{
            padding: '4px 12px',
            background: viewMode === 'events' ? '#4a6fa5' : '#2a2a3a',
            border: 'none',
            borderRadius: 4,
            color: '#e0e0e0',
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          Events
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          style={{
            padding: '4px 12px',
            background: viewMode === 'timeline' ? '#4a6fa5' : '#2a2a3a',
            border: 'none',
            borderRadius: 4,
            color: '#e0e0e0',
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          Timeline
        </button>
        <button
          onClick={() => setViewMode('snapshots')}
          style={{
            padding: '4px 12px',
            background: viewMode === 'snapshots' ? '#4a6fa5' : '#2a2a3a',
            border: 'none',
            borderRadius: 4,
            color: '#e0e0e0',
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          Snapshots
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {viewMode === 'events' && (
          <div style={{ padding: 8 }}>
            {events.map((event, index) => (
              <div
                key={event.id || index}
                onClick={() => setSelectedTimestamp(event.timestamp)}
                style={{
                  padding: '8px 12px',
                  marginBottom: 4,
                  backgroundColor: selectedTimestamp === event.timestamp ? '#2a2a3a' : 'transparent',
                  borderRadius: 4,
                  cursor: 'pointer',
                  borderLeft: `3px solid ${getEventColor(event.type)}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: getEventColor(event.type), fontSize: 12, fontWeight: 500 }}>
                    {formatEventType(event.type)}
                  </span>
                  <span style={{ color: '#666', fontSize: 10 }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                  {event.entityId.slice(0, 30)}...
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
                No history events
              </div>
            )}
          </div>
        )}

        {viewMode === 'timeline' && (
          <div style={{ padding: 16 }}>
            {/* Simple bar chart */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                Changes over last 30 days
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', height: 100, gap: 2 }}>
                {timelineData.map((data, index) => {
                  const maxChanges = Math.max(...timelineData.map((d) => d.changeCount), 1)
                  const height = (data.changeCount / maxChanges) * 100

                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedTimestamp(data.timestamp)}
                      style={{
                        flex: 1,
                        height: `${height}%`,
                        minHeight: 2,
                        backgroundColor: selectedTimestamp === data.timestamp ? '#4a6fa5' : '#3a3a4a',
                        cursor: 'pointer',
                        borderRadius: '2px 2px 0 0'
                      }}
                      title={`${data.timestamp}: ${data.changeCount} changes`}
                    />
                  )
                })}
              </div>
            </div>

            {/* Stats */}
            {timelineData.length > 0 && (
              <div style={{ fontSize: 11, color: '#666' }}>
                <div>Total days: {timelineData.length}</div>
                <div>
                  Total changes:{' '}
                  {timelineData.reduce((sum, d) => sum + d.changeCount, 0)}
                </div>
                {selectedTimestamp && (
                  <div style={{ marginTop: 8, color: '#888' }}>
                    Selected: {new Date(selectedTimestamp).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {viewMode === 'snapshots' && (
          <div style={{ padding: 8 }}>
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                onClick={() => {
                  setSelectedSnapshotId(snapshot.id ?? null)
                  setSelectedTimestamp(snapshot.timestamp)
                }}
                style={{
                  padding: '12px',
                  marginBottom: 8,
                  backgroundColor: selectedSnapshotId === snapshot.id ? '#2a2a3a' : 'transparent',
                  borderRadius: 4,
                  cursor: 'pointer',
                  borderLeft: `3px solid ${snapshot.metadata?.isManual ? '#e69a2e' : '#4ade80'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 500 }}>
                    {snapshot.metadata?.isManual ? '📸 Manual' : '💾 Auto'} Snapshot
                  </span>
                  <span style={{ color: '#666', fontSize: 10 }}>
                    {new Date(snapshot.timestamp).toLocaleString()}
                  </span>
                </div>
                <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                  {snapshot.nodeCount} nodes, {snapshot.edgeCount} edges
                </div>
                {snapshot.metadata?.description && (
                  <div style={{ color: '#aaa', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                    {snapshot.metadata.description}
                  </div>
                )}
              </div>
            ))}
            {snapshots.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
                No snapshots available
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {(selectedTimestamp || selectedSnapshotId !== null) && (
        <div style={{
          padding: 16,
          borderTop: '1px solid #2a2a3a',
          display: 'flex',
          gap: 8
        }}>
          <button
            onClick={handleRestore}
            disabled={isRestoring}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: isRestoring ? '#4a4a5a' : '#4a6fa5',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              cursor: isRestoring ? 'not-allowed' : 'pointer'
            }}
          >
            {isRestoring
              ? 'Restoring...'
              : selectedSnapshotId !== null
              ? `Restore from Snapshot (${new Date(selectedTimestamp!).toLocaleString()})`
              : `Restore to ${new Date(selectedTimestamp!).toLocaleString()}`}
          </button>
        </div>
      )}
    </div>
  )
}
