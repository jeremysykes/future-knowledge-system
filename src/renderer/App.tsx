import { useEffect, useState, useCallback } from 'react'
import { Canvas } from './components/Canvas'
import { SearchBar } from './components/SearchBar'
import { LensSelector } from './components/LensSelector'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { Timeline } from './components/Timeline'
import { SeedDatabase } from './components/SeedDatabase'
import { useFieldStore } from './core/store/fieldStore'
import { createKnowledgeNode, createRuleNode, createDecisionNode } from './core/types/node'
import { createEdge } from './core/types/edge'
import { useForceSimulation } from './semantic/force/useForceSimulation'
import { getAutoSave } from './persistence/autoSave'
import { getSearchIndex } from './semantic/search/SearchIndex'
import { getHistoryRepository } from './persistence/historyRepository'
import { eventBus } from './core/events/eventBus'
import { getLensEngine, type LensConfig, type LensResult } from './semantic/lens/LensEngine'

function generateTestNodes(count: number) {
  const nodes = []
  const edges = []

  for (let i = 0; i < count; i++) {
    const angle = i * 0.5
    const radius = 50 + i * 3
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius

    if (i % 10 === 0) {
      nodes.push(
        createRuleNode(
          `rule-${i}`,
          `Rule ${i}`,
          `This is a rule node for testing purposes`,
          i % 20 === 0 ? 'global' : 'local',
          'soft',
          { x, y }
        )
      )
    } else if (i % 15 === 0) {
      nodes.push(
        createDecisionNode(
          `decision-${i}`,
          `Should we implement feature ${i}?`,
          ['Yes', 'No', 'Later'],
          { x, y }
        )
      )
    } else {
      const node = createKnowledgeNode(
        `node-${i}`,
        `Knowledge Node ${i}`,
        `This is test content for node ${i}. It contains some placeholder text to simulate real knowledge.`,
        { x, y }
      )
      node.data = {
        ...node.data,
        importance: Math.random(),
        tags: [`tag-${i % 5}`, `category-${i % 3}`]
      } as typeof node.data
      nodes.push(node)
    }

    if (i > 0) {
      const targetIndex = Math.floor(Math.random() * i)
      edges.push(
        createEdge(
          nodes[i].id,
          nodes[targetIndex].id,
          ['link', 'reference', 'supports'][Math.floor(Math.random() * 3)] as 'link' | 'reference' | 'supports',
          { strength: 0.3 + Math.random() * 0.7 }
        )
      )

      if (Math.random() > 0.7 && i > 2) {
        const anotherTarget = Math.floor(Math.random() * i)
        if (anotherTarget !== targetIndex) {
          edges.push(
            createEdge(nodes[i].id, nodes[anotherTarget].id, 'reference', {
              strength: 0.2 + Math.random() * 0.5
            })
          )
        }
      }
    }
  }

  return { nodes, edges }
}

export default function App() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isTimelineOpen, setIsTimelineOpen] = useState(false)
  const [activeLens, setActiveLens] = useState<LensConfig>({ type: 'all', params: {} })
  const [lensResult, setLensResult] = useState<LensResult | undefined>(undefined)

  const loadData = useFieldStore((state) => state.loadData)
  const nodeCount = useFieldStore((state) => state.nodes.size)
  const edgeCount = useFieldStore((state) => state.edges.size)
  const nodes = useFieldStore((state) => state.nodes)
  const isSimulationRunning = useFieldStore((state) => state.isSimulationRunning)
  const focusedNodeId = useFieldStore((state) => state.focusedNodeId)
  const focusNode = useFieldStore((state) => state.focusNode)

  const { start, stop, reheat } = useForceSimulation()

  // Initialize services
  useEffect(() => {
    const autoSave = getAutoSave()
    const searchIndex = getSearchIndex()
    const historyRepo = getHistoryRepository()

    // Try to load saved data first
    autoSave.loadAll().then(({ nodes: savedNodes, edges: savedEdges }) => {
      if (savedNodes.length > 0) {
        loadData(savedNodes, savedEdges)
        searchIndex.indexAll(new Map(savedNodes.map((n) => [n.id, n])))
      } else {
        // Generate test data if no saved data
        const { nodes: testNodes, edges: testEdges } = generateTestNodes(100)
        loadData(testNodes, testEdges)
        searchIndex.indexAll(new Map(testNodes.map((n) => [n.id, n])))
      }

      // Start simulation
      setTimeout(() => start(), 100)
    })

    return () => {
      stop()
      autoSave.flush()
    }
  }, [loadData, start, stop])

  // Index nodes when they change
  useEffect(() => {
    const searchIndex = getSearchIndex()
    searchIndex.indexAll(nodes)
  }, [nodes])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault()
        setIsTimelineOpen((open) => !open)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Listen for search trigger
  useEffect(() => {
    const unsubscribe = eventBus.on('search:query', () => {
      setIsSearchOpen(true)
    })
    return unsubscribe
  }, [])

  const handleLensChange = useCallback((lens: LensConfig) => {
    setActiveLens(lens)
    // Compute lens result
    const lensEngine = getLensEngine()
    const result = lensEngine.applyLens(nodes, lens)
    setLensResult(result)
  }, [nodes])

  const handleRestoreSnapshot = useCallback(async (timestamp: string) => {
    const historyRepo = getHistoryRepository()
    const snapshot = await historyRepo.getSnapshot(timestamp)
    if (snapshot) {
      loadData(snapshot.nodes, snapshot.edges)
      reheat(1)
      // Create a snapshot after restore for safety
      await historyRepo.createSnapshot({
        description: `Restore point after restoring to ${timestamp}`,
        isManual: true
      })
    }
  }, [loadData, reheat])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#0a0a0f',
        position: 'relative'
      }}
    >
      <Canvas lensResult={lensResult} />

      {/* Info overlay */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          color: '#888',
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
          userSelect: 'none'
        }}
      >
        <div>Nodes: {nodeCount}</div>
        <div>Edges: {edgeCount}</div>
        <div>Simulation: {isSimulationRunning ? 'Running' : 'Stopped'}</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button
            onClick={() => (isSimulationRunning ? stop() : start())}
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
            {isSimulationRunning ? 'Stop' : 'Start'}
          </button>
          <button
            onClick={() => reheat(0.5)}
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
            Reheat
          </button>
          <button
            onClick={() => setIsSearchOpen(true)}
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
            Search (⌘K)
          </button>
          <button
            onClick={() => setIsTimelineOpen(true)}
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
            History
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          <SeedDatabase />
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: '#555', pointerEvents: 'none' }}>
          Drag: Pan • Scroll: Zoom
          <br />
          Click: Select • Shift+Click: Multi-select
          <br />
          Double-click: Focus • ⌘K: Search
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: '#4a6fa5',
          fontSize: 14,
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 600,
          letterSpacing: 1
        }}
      >
        FUTURE KNOWLEDGE SYSTEM
      </div>

      {/* Lens Selector */}
      <LensSelector onLensChange={handleLensChange} />

      {/* Node Detail Panel */}
      {focusedNodeId && (
        <NodeDetailPanel
          nodeId={focusedNodeId}
          onClose={() => focusNode(null)}
        />
      )}

      {/* Search Bar */}
      <SearchBar
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Timeline */}
      <Timeline
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        onRestoreSnapshot={handleRestoreSnapshot}
      />
    </div>
  )
}
