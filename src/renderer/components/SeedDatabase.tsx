import { useState, useCallback } from 'react'
import { seedDatabase } from '../persistence/seedDatabase'
import { useFieldStore } from '../core/store/fieldStore'
import { eventBus } from '../core/events/eventBus'

interface SeedDatabaseProps {
  onComplete?: () => void
}

export function SeedDatabase({ onComplete }: SeedDatabaseProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [clearExisting, setClearExisting] = useState(false)
  const loadData = useFieldStore((state) => state.loadData)

  const handleSeed = useCallback(async () => {
    setIsSeeding(true)
    try {
      const { nodes, edges } = await seedDatabase({
        clearExisting,
        nodeCount: 75,
        edgeCount: 30
      })

      loadData(nodes, edges)
      eventBus.emit('data:loaded', {
        nodeCount: nodes.length,
        edgeCount: edges.length
      })

      setIsOpen(false)
      onComplete?.()
    } catch (error) {
      console.error('Failed to seed database:', error)
      alert('Failed to seed database. Check console for details.')
    } finally {
      setIsSeeding(false)
    }
  }, [clearExisting, loadData, onComplete])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: '4px 8px',
          background: '#2a2a3a',
          border: '1px solid #4a4a5a',
          borderRadius: 4,
          color: '#ccc',
          cursor: 'pointer',
          fontSize: 11
        }}
      >
        Seed Database
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsOpen(false)
        }
      }}
    >
      <div
        style={{
          background: '#1a1a24',
          border: '1px solid #4a4a5a',
          borderRadius: 8,
          padding: 24,
          minWidth: 400,
          maxWidth: 500,
          color: '#e0e0e0'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#fff' }}>
          Seed Database
        </h2>

        <p style={{ margin: '0 0 16px 0', fontSize: 14, color: '#aaa' }}>
          This will populate the database with dummy data including knowledge nodes, rules, and decisions.
        </p>

        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: 14,
              marginBottom: 8
            }}
          >
            <input
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              style={{ marginRight: 8, cursor: 'pointer' }}
            />
            <span>Clear existing data before seeding</span>
          </label>
          {clearExisting && (
            <p style={{ margin: '8px 0 0 24px', fontSize: 12, color: '#f87171' }}>
              Warning: This will permanently delete all existing nodes and edges.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => setIsOpen(false)}
            disabled={isSeeding}
            style={{
              padding: '8px 16px',
              background: '#2a2a3a',
              border: '1px solid #4a4a5a',
              borderRadius: 4,
              color: '#ccc',
              cursor: isSeeding ? 'not-allowed' : 'pointer',
              fontSize: 14
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            style={{
              padding: '8px 16px',
              background: isSeeding ? '#4a4a5a' : '#4a6fa5',
              border: '1px solid #4a4a5a',
              borderRadius: 4,
              color: '#fff',
              cursor: isSeeding ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            {isSeeding ? 'Seeding...' : 'Seed Database'}
          </button>
        </div>
      </div>
    </div>
  )
}
