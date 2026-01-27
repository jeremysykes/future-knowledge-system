import { useEffect, useState, useCallback } from 'react'
import { Canvas } from './components/Canvas'
import { SearchBar } from './components/SearchBar'
import { LeftPanel } from './components/LeftPanel'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { InlineEditor } from './markdown/editor/InlineEditor'
import { Timeline } from './components/Timeline'
import { PerformanceMonitor } from './components/PerformanceMonitor'
import { SeedDatabase } from './components/SeedDatabase'
import { useFieldStore } from './core/store/fieldStore'
import { useViewportStore } from './core/store/viewportStore'
import { createKnowledgeNode, createRuleNode, createDecisionNode } from './core/types/node'
import { createEdge } from './core/types/edge'
import { useForceSimulation } from './semantic/force/useForceSimulation'
import { useImplicitEdgeSync } from './semantic/similarity/useImplicitEdgeSync'
import { ensureDbOpen } from './persistence/db'
import { getAutoSave } from './persistence/autoSave'
import { getSearchIndex } from './semantic/search/SearchIndex'
import { getHistoryRepository } from './persistence/historyRepository'
import { eventBus } from './core/events/eventBus'
import { getLensEngine, type LensConfig, type LensResult } from './semantic/lens/LensEngine'

function generateTestNodes(count: number) {
  const nodes = []
  const edges = []

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 120
    const y = (Math.random() - 0.5) * 120

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
  const [editorOpenNodeId, setEditorOpenNodeId] = useState<string | null>(null)
  const [editorOpenIsNew, setEditorOpenIsNew] = useState(false)
  const [searchToast, setSearchToast] = useState<{ shown: number; total: number } | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)
  const [dbBannerDismissed, setDbBannerDismissed] = useState(false)

  const loadData = useFieldStore((state) => state.loadData)
  const deleteNode = useFieldStore((state) => state.deleteNode)
  const addNode = useFieldStore((state) => state.addNode)
  const nodes = useFieldStore((state) => state.nodes)
  const focusedNodeId = useFieldStore((state) => state.focusedNodeId)
  const focusNode = useFieldStore((state) => state.focusNode)

  const { start, stop, reheat } = useForceSimulation()

  useImplicitEdgeSync()

  // Initialize services
  useEffect(() => {
    const autoSave = getAutoSave()
    const searchIndex = getSearchIndex()

    // Electron: register for prepare-to-close so we can flush before window destroy
    const w = window as unknown as { api?: { onPrepareToClose?: (cb: () => Promise<void>) => void } }
    if (w.api?.onPrepareToClose) {
      w.api.onPrepareToClose(() => getAutoSave().flush())
    }

    // beforeunload: start flush (fire-and-forget) for browser or when handshake not used
    const onBeforeUnload = (): void => {
      getAutoSave().flush()
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    const run = async () => {
      const dbOk = await ensureDbOpen()
      if (!dbOk) {
        autoSave.setEnabled(false)
        setDbUnavailable(true)
        console.log('[App] IndexedDB unavailable; using in-memory data only')
        const { nodes: testNodes, edges: testEdges } = generateTestNodes(100)
        loadData(testNodes, testEdges)
        searchIndex.indexAll(new Map(testNodes.map((n) => [n.id, n])))
        setTimeout(() => start(true), 100)
        return
      }

      // Try to load saved data first
      console.log('[App] location.origin:', typeof location !== 'undefined' ? location.origin : 'N/A')
      autoSave.loadAll().then(({ nodes: savedNodes, edges: savedEdges }) => {
        if (savedNodes.length > 0) {
          console.log('[App] Using saved data:', savedNodes.length, 'nodes,', savedEdges.length, 'edges')
          loadData(savedNodes, savedEdges)
          searchIndex.indexAll(new Map(savedNodes.map((n) => [n.id, n])))
        } else {
          console.log('[App] No saved data, generating test data')
          const { nodes: testNodes, edges: testEdges } = generateTestNodes(100)
          loadData(testNodes, testEdges)
          searchIndex.indexAll(new Map(testNodes.map((n) => [n.id, n])))
        }

        // Start simulation
        setTimeout(() => start(true), 100)
      })
    }
    run()

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        const vp = useViewportStore.getState()
        const { x, y } = vp.screenToWorld(vp.width / 2, vp.height / 2)
        const node = createKnowledgeNode(crypto.randomUUID(), 'Untitled', '', { x, y })
        addNode(node)
        eventBus.emit('editor:open', { nodeId: node.id, isNew: true })
        focusNode(null)
      }
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
  }, [addNode, focusNode])

  // Listen for search trigger
  useEffect(() => {
    const unsubscribe = eventBus.on('search:query', () => {
      setIsSearchOpen(true)
    })
    return unsubscribe
  }, [])

  // Search submit toast: "X of Y nodes selected", 3s, reset on new submit
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const unsub = eventBus.on('search:submit:result', (p) => {
      if (timeoutId) clearTimeout(timeoutId)
      setSearchToast(p)
      timeoutId = setTimeout(() => {
        setSearchToast(null)
        timeoutId = null
      }, 3000)
    })

    return () => {
      unsub()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  // Listen for editor:open (create flow: dblclick empty, ⌘N)
  useEffect(() => {
    const unsub = eventBus.on('editor:open', (p) => {
      focusNode(null)
      setEditorOpenNodeId(p.nodeId)
      setEditorOpenIsNew(p.isNew)
    })
    return unsub
  }, [focusNode])

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
        display: 'flex',
        flexDirection: 'row'
      }}
    >
      <LeftPanel
        onSearchOpen={() => setIsSearchOpen(true)}
        onHistoryOpen={() => setIsTimelineOpen(true)}
        onLensChange={handleLensChange}
        start={start}
        stop={stop}
        reheat={reheat}
        dbAvailable={!dbUnavailable}
      />

      {/* DB unavailable banner */}
      {dbUnavailable && !dbBannerDismissed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: '#3a2020',
            borderBottom: '1px solid #5a3030',
            color: '#e8c0c0',
            fontSize: 13,
            fontFamily: 'system-ui, sans-serif'
          }}
        >
          <span>Local database could not be opened. Data is not being saved.</span>
          <button
            type="button"
            onClick={() => setDbBannerDismissed(true)}
            style={{
              padding: '4px 10px',
              background: '#4a3030',
              border: '1px solid #6a4040',
              borderRadius: 4,
              color: '#e8c0c0',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        <Canvas lensResult={lensResult} />

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
          letterSpacing: 1,
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      >
        FUTURE KNOWLEDGE SYSTEM
      </div>

      {/* Node Detail Panel */}
      {focusedNodeId && (
        <NodeDetailPanel
          nodeId={focusedNodeId}
          onClose={() => focusNode(null)}
        />
      )}

      {/* Performance monitor */}
      <PerformanceMonitor />

      {/* Search Bar */}
      <SearchBar
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        stopSimulation={stop}
        startSimulation={start}
      />

      {/* Search submit toast */}
      {searchToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 16px',
            backgroundColor: '#1a1a24',
            border: '1px solid #2a2a3a',
            borderRadius: 8,
            color: '#e0e0e0',
            fontSize: 13,
            fontFamily: 'system-ui, sans-serif',
            zIndex: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}
        >
          {searchToast.shown} of {searchToast.total} nodes selected
        </div>
      )}

      {/* Timeline */}
      <Timeline
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        onRestoreSnapshot={handleRestoreSnapshot}
      />

      {/* Editor modal (create flow: editor:open) */}
      {editorOpenNodeId && (() => {
        const node = nodes.get(editorOpenNodeId)
        if (!node) return null
        const isNew = editorOpenIsNew
        return (
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
              onClick={() => {
                setEditorOpenNodeId(null)
                setEditorOpenIsNew(false)
                if (isNew) deleteNode(editorOpenNodeId)
              }}
            />
            <InlineEditor
              node={node}
              onClose={(saved) => {
                setEditorOpenNodeId(null)
                setEditorOpenIsNew(false)
                if (isNew && !saved) deleteNode(editorOpenNodeId)
              }}
            />
          </>
        )
      })()}
      </div>
    </div>
  )
}
