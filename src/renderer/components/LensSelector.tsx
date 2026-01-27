import { useState, useCallback } from 'react'
import { getLensEngine, type LensConfig, type LensType } from '../semantic/lens/LensEngine'
import { useFieldStore } from '../core/store/fieldStore'
import { getSearchIndex } from '../semantic/search/SearchIndex'

interface LensSelectorProps {
  onLensChange: (lens: LensConfig) => void
  /** When true, render inline in a panel instead of absolute overlay */
  embedded?: boolean
}

export function LensSelector({ onLensChange, embedded }: LensSelectorProps) {
  const [activeLens, setActiveLens] = useState<LensType>('all')
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [minImportance, setMinImportance] = useState(0.5)
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('week')

  const nodes = useFieldStore((state) => state.nodes)

  const applyLens = useCallback((type: LensType, params: Record<string, unknown> = {}) => {
    const lensEngine = getLensEngine()
    const lensConfig: LensConfig = { type, params }
    const result = lensEngine.applyLens(nodes, lensConfig)
    setActiveLens(type)
    onLensChange(lensConfig)
  }, [nodes, onLensChange])

  const allTags = Array.from(getSearchIndex().getAllTags().entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)

  const lensButtons: Array<{ type: LensType; label: string }> = [
    { type: 'all', label: 'All' },
    { type: 'tag', label: 'Tags' },
    { type: 'time', label: 'Time' },
    { type: 'importance', label: 'Importance' },
    { type: 'type', label: 'Type' }
  ]

  return (
    <div
      style={{
        ...(embedded ? { position: 'relative' as const } : { position: 'absolute', bottom: 16, left: 16 }),
        backgroundColor: '#1a1a24',
        borderRadius: 8,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 120
      }}
    >
      {/* Main lens buttons */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {lensButtons.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => {
              if (type === 'all') {
                applyLens('all')
                setIsExpanded(false)
              } else {
                setActiveLens(type)
                setIsExpanded(true)
              }
            }}
            style={{
              padding: '4px 8px',
              background: activeLens === type ? '#4a6fa5' : '#2a2a3a',
              border: 'none',
              borderRadius: 4,
              color: '#e0e0e0',
              cursor: 'pointer',
              fontSize: 11
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Expanded lens options */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid #2a2a3a', paddingTop: 8 }}>
          {activeLens === 'tag' && (
            <div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                Select tags:
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxHeight: 100, overflowY: 'auto' }}>
                {allTags.map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const newTags = selectedTags.includes(tag)
                        ? selectedTags.filter((t) => t !== tag)
                        : [...selectedTags, tag]
                      setSelectedTags(newTags)
                      if (newTags.length > 0) {
                        applyLens('tag', { tags: newTags, mode: 'include' })
                      } else {
                        applyLens('all')
                      }
                    }}
                    style={{
                      padding: '2px 6px',
                      background: selectedTags.includes(tag) ? '#4a6fa5' : '#2a2a3a',
                      border: 'none',
                      borderRadius: 3,
                      color: '#ccc',
                      cursor: 'pointer',
                      fontSize: 10
                    }}
                  >
                    #{tag} ({count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeLens === 'time' && (
            <div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                Time range:
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['day', 'week', 'month', 'year'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setTimeRange(range)
                      applyLens('time', { range, emphasizeRecent: true })
                    }}
                    style={{
                      padding: '2px 6px',
                      background: timeRange === range ? '#4a6fa5' : '#2a2a3a',
                      border: 'none',
                      borderRadius: 3,
                      color: '#ccc',
                      cursor: 'pointer',
                      fontSize: 10
                    }}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeLens === 'importance' && (
            <div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                Min importance: {minImportance.toFixed(1)}
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={minImportance}
                onChange={(e) => {
                  const value = parseFloat(e.target.value)
                  setMinImportance(value)
                  applyLens('importance', { minImportance: value, scaleByImportance: true })
                }}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {activeLens === 'type' && (
            <div style={{ display: 'flex', gap: 4 }}>
              {(['knowledge', 'rule', 'decision'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => applyLens('type', { types: [type] })}
                  style={{
                    padding: '2px 6px',
                    background: '#2a2a3a',
                    border: 'none',
                    borderRadius: 3,
                    color: '#ccc',
                    cursor: 'pointer',
                    fontSize: 10
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
