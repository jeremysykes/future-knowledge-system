import { useState, useCallback } from 'react'
import { seedDatabase } from '../persistence/seedDatabase'
import { useFieldStore } from '../core/store/fieldStore'
import { eventBus } from '../core/events/eventBus'

const SEED_PRESETS = [10, 100, 1000, 10000] as const
const SEED_CAP = 10_000

interface SeedDatabaseProps {
  onComplete?: () => void
  dbAvailable?: boolean
}

export function SeedDatabase({ onComplete, dbAvailable = true }: SeedDatabaseProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [clearExisting, setClearExisting] = useState(false)
  const [scalePreset, setScalePreset] = useState<number>(100)
  const [useCustomScale, setUseCustomScale] = useState(false)
  const [customScale, setCustomScale] = useState(500)
  const loadData = useFieldStore((state) => state.loadData)

  const nodeCount = useCustomScale
    ? Math.min(SEED_CAP, Math.max(1, customScale))
    : scalePreset

  const handleSeed = useCallback(async () => {
    setIsSeeding(true)
    try {
      const { nodes, edges } = await seedDatabase({
        clearExisting,
        nodeCount,
        persist: dbAvailable
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
      alert('Failed to seed database. Check console for details. The local database could not be written to.')
    } finally {
      setIsSeeding(false)
    }
  }, [clearExisting, nodeCount, loadData, onComplete, dbAvailable])

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

        {!dbAvailable && (
          <p style={{ margin: '0 0 16px 0', fontSize: 12, color: '#e8a030' }}>
            Database unavailable; new data will be in memory only and won't be saved.
          </p>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>Scale (nodes)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {SEED_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setScalePreset(n); setUseCustomScale(false) }}
                style={{
                  padding: '6px 12px',
                  background: !useCustomScale && scalePreset === n ? '#4a6fa5' : '#2a2a3a',
                  border: '1px solid #4a4a5a',
                  borderRadius: 4,
                  color: '#e0e0e0',
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                {n}
              </button>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useCustomScale}
                onChange={(e) => setUseCustomScale(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: '#aaa' }}>Other</span>
            </label>
            {useCustomScale && (
              <input
                type="number"
                min={1}
                max={SEED_CAP}
                value={customScale}
                onChange={(e) => setCustomScale(Math.min(SEED_CAP, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                style={{
                  width: 80,
                  padding: '4px 8px',
                  background: '#0a0a0f',
                  border: '1px solid #4a4a5a',
                  borderRadius: 4,
                  color: '#e0e0e0',
                  fontSize: 12
                }}
              />
            )}
          </div>
          <div style={{ fontSize: 11, color: '#666' }}>Cap: {SEED_CAP.toLocaleString()} nodes. Edges derived from node count.</div>
        </div>

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
