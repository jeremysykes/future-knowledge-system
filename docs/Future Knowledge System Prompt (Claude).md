# Post‑Document Knowledge System

## Technical Specification & Design Philosophy

---

## Context

You are designing a **local‑first, web‑native knowledge application** that treats knowledge as **living structure** rather than static files.

This is not an improvement to Obsidian or Notion. It is a **substrate change** — a fundamental rethinking of how knowledge tools work.

The system must feel like a **future interface built with today's web standards**. AI may assist in building it, but **AI is not a runtime dependency**.

---

## Core Principles

### Knowledge as Field, Not Files

Traditional assumption:
> Knowledge = pages + folders + links

This system's assumption:
> Knowledge = **continuous semantic field**
> Documents are **temporary projections** of that field

There is no primary page view, no canonical list, no folder tree.

Meaning emerges from: **relationships, proximity, time, attention, interaction**.

### Knowledge Behaves Like Matter

Ideas have **weight** and exert **influence**. They **drift**, **cluster**, and **decay**. Attention acts as **gravity**. Time acts as **erosion**.

The interface is not a filing system. It is a **living environment**.

### Spatial Layout as Primary Interface

Spatial arrangement is the **primary cognitive interface**:

| Visual Property | Semantic Meaning |
|-----------------|------------------|
| Distance | Relevance |
| Motion | Change |
| Density | Uncertainty / Overload |
| Glow | Importance |
| Fog | Ambiguity / Forgotten |

If flattened to a list, the system should lose meaning.

---

## Non‑Goals

The system must **never** become:

- "Notion but 3D"
- A VR experience
- A game engine
- A chat interface
- A productivity dashboard
- A visual effect showcase

**If it doesn't increase sense‑making, it's out of scope.**

---

## Platform Targets

**Primary:** Desktop (mouse, keyboard, large display)

**Secondary:** Tablet and mobile with graceful adaptation:
- Touch-optimized interactions and gestures
- Simplified node representations at smaller sizes
- Progressive disclosure of detail
- Touch-friendly interaction targets

Desktop should not feel like scaled-up mobile. Mobile should not feel like crippled desktop.

---

## MVP Capabilities

### 1. Node Creation
- Markdown content with inline editing (no separate edit mode)
- Optional metadata: tags, timestamps, confidence score

### 2. Node Linking
- **Explicit:** User-created `[[wiki links]]` and `[markdown](url)` links
- **Implicit:** Automatically derived similarity connections
- Both create weighted edges (0.0 to 1.0)

### 3. Spatial Field
- Continuous 2D space with optional 2.5D depth cues
- Unbounded infinite canvas
- Position carries semantic meaning

### 4. Force Simulation
- **Attraction:** Related nodes pull together (strength = edge weight)
- **Repulsion:** Prevents overlap and clutter
- **Decay:** Unused nodes drift toward periphery over time
- **Focus gravity:** Selected node attracts related nodes
- Continuous simulation with pause capability

### 5. Focus Mechanism
- Selection reshapes the entire field (not just zoom)
- Related nodes move closer during focus
- Smooth, continuous transitions

### 6. Search & Discovery
- Full-text search across content and metadata
- Search results highlight spatially
- Discovery through visual exploration and serendipity

### 7. Import
- Import Markdown files (`.md`, `.markdown`)
- Parse wiki links and markdown links
- Extract frontmatter metadata
- No direct tool integration — file import only

### 8. Local Persistence
- IndexedDB storage
- Auto-save on changes
- Export as Markdown (one file per node) or JSON (complete dump)
- Works completely offline
- No account required

### 9. Project Rules
- Persistent constraints that govern the knowledge space
- Rules are nodes with special behavior: they don't decay, they attract related content
- Examples: style guidelines, naming conventions, architectural constraints, team agreements
- Rules can be scoped (global, per-tag, per-cluster)
- Visual distinction: rules appear as anchor points or boundaries in the field
- Rules influence similarity — nodes that violate rules may show tension visually

### 10. Project History
- Automatic timeline of significant changes
- Captures: node creation, major edits, link changes, rule additions
- History is navigable — scrub through time to see field evolution
- "Time lens" shows the field as it existed at a past moment
- History nodes cluster chronologically but also connect to the content they describe
- Supports understanding "how did we get here?"

### 11. Decisions
- Special node type for recording choices and their rationale
- Structure: **context** (what situation prompted this), **decision** (what was chosen), **alternatives** (what was rejected), **consequences** (what followed)
- Decisions link bidirectionally to affected nodes
- Decisions don't decay — they remain accessible as institutional memory
- Can be marked as **active**, **superseded**, or **revisit**
- Visual: decisions appear as waypoints or milestones in the field

---

## Scale Requirements

| Scale | Expectation |
|-------|-------------|
| Thousands | Baseline, must be smooth |
| Tens of thousands | Performant with optimizations |
| Hundreds of thousands | Theoretically possible |

**Performance strategies:**
- Level-of-detail rendering
- Spatial indexing for queries
- Incremental similarity calculation
- Lazy content loading
- Efficient force algorithms (Barnes-Hut or similar)
- Target: 60fps desktop, 30fps mobile minimum

---

## Similarity Calculation

**Goal:** Intuitive clustering where related nodes naturally group together.

**Approaches to consider:**
- Text similarity (TF-IDF, word overlap)
- Structural similarity (shared links, common neighbors)
- Hybrid combination

**Requirements:**
- Natural-feeling results
- Real-time performance
- Incremental updates (recalculate only on change)
- Produces weighted edges (0.0 to 1.0)

Start simple. Refine based on observed behavior.

---

## Data Model

### Node
```typescript
interface Node {
  id: string                    // UUID
  type: 'note' | 'rule' | 'decision' | 'history'
  markdown: string
  createdAt: number             // timestamp
  updatedAt: number             // timestamp
  links: string[]               // explicit link target IDs
  position: { x: number; y: number; z?: number }
  metadata: {
    tags?: string[]
    confidence?: number         // 0.0 to 1.0
    lastAccessed?: number       // timestamp
  }
}
```

### Rule (extends Node)
```typescript
interface Rule extends Node {
  type: 'rule'
  scope: 'global' | 'tag' | 'cluster'
  scopeTarget?: string          // tag name or cluster ID if scoped
  enforcement: 'advisory' | 'warning' | 'strict'
}
```

### Decision (extends Node)
```typescript
interface Decision extends Node {
  type: 'decision'
  context: string               // what prompted this decision
  alternatives: string[]        // what was considered but rejected
  consequences?: string         // observed outcomes
  status: 'active' | 'superseded' | 'revisit'
  supersededBy?: string         // node ID if superseded
  affectedNodes: string[]       // nodes this decision applies to
}
```

### HistoryEvent
```typescript
interface HistoryEvent {
  id: string
  timestamp: number
  eventType: 'create' | 'update' | 'delete' | 'link' | 'rule' | 'decision'
  nodeId: string
  summary: string               // human-readable description
  snapshot?: Partial<Node>      // state at time of event (for significant changes)
}
```

### Edge
```typescript
interface Edge {
  from: string                  // node ID
  to: string                    // node ID
  weight: number                // 0.0 to 1.0
  type: 'explicit' | 'implicit'
  createdAt?: number            // for implicit edges
}
```

### Field State
```typescript
interface Field {
  focusNodeId?: string
  activeLens?: string
  timeBias: number              // 0.0 to 1.0, affects temporal decay
  viewport: { center: { x: number; y: number }; zoom: number }
  searchQuery?: string
  historyTimestamp?: number     // if set, view field as it existed at this time
}
```

### Lens
```typescript
interface Lens {
  id: string
  name: string
  type: 'tag' | 'time' | 'importance' | 'custom'
  parameters: Record<string, unknown>
  // Lenses modify how nodes are positioned or displayed
}
```

---

## Technical Architecture

### Stack (Free & Open Only)

- **Electron** — Desktop shell (native file system, cross-platform distribution)
- **TypeScript** — Language
- **WebGPU** — Primary renderer (WebGL fallback)
- **React** — UI shell only (not scene graph)
- **D3.js** — Semantic math: scales, forces, transforms
- **Rust → WASM** — Optional, for clustering/similarity
- **IndexedDB** — Local persistence (with native file system for import/export)
- **Markdown parser** — marked, markdown-it, or remark

**No proprietary SDKs. No paid APIs. No cloud lock-in.**

*Note: Core rendering and logic remain web-native. Electron provides the desktop container with native file access. A PWA variant for mobile/tablet remains possible using the same codebase.*

### Layer Separation

#### Semantic Engine (Meaning)
- Node importance calculation
- Similarity computation
- Force parameters and simulation
- Lens transformations
- Search indexing

*Does not render pixels.*

#### Render Engine (Perception)
- WebGPU buffers and shaders
- Instanced node rendering
- Visual effects (fog, glow, depth)
- GPU picking for interaction
- Level-of-detail system
- Viewport culling

*Does not decide meaning.*

#### Interaction Engine (Intent)
- Input mapping (mouse, touch, keyboard)
- Focus and selection
- Pan and zoom (wheel, pinch)
- Drag operations
- Node editing triggers
- Force simulation control

*Interaction reshapes semantics, not just camera.*

---

## Rendering Requirements

- Level-of-detail: points → circles → labels based on zoom/proximity
- Labels: selective (focused, nearby, hovered) not universal
- GPU picking: mandatory for performance
- Motion: continuous, no hard resets or jarring transitions
- Responsive: adapt quality to device capabilities

---

## Force Simulation Details

**Attraction:**
- Proportional to edge weight
- Distance-based decay (inverse square or similar)
- Maximum distance cap

**Repulsion:**
- Strong at close range, weak at distance
- Considers node "size" (importance or content length)

**Decay:**
- Unused nodes drift outward based on `lastAccessed`
- Slow, subtle, continuous

**Focus Gravity:**
- Focused node creates additional attraction
- Effect diminishes with graph distance
- Smooth transition on focus change

**Implementation:**
- Use D3 force simulation or equivalent
- Consider web worker for performance
- Throttle updates as needed
- Allow user pause/resume

---

## UX Principles

- No modal dialogs for core actions
- Minimal chrome
- Interaction over menus
- Motion communicates state, not spectacle
- **The system should feel calm, intentional, and inevitable**
- Desktop: keyboard shortcuts, precise mouse control
- Mobile: gestures, appropriate touch targets

---

## Build Sequence

Execute in order. If a step feels wrong, stop and refine before continuing.

1. **Static spatial field** — Render nodes at fixed positions, basic viewport
2. **Force system** — Implement simulation, test at scale, no UI
3. **GPU rendering** — WebGPU, level-of-detail, test across devices
4. **Interaction** — Input handling, focus mechanism, force responds to focus
5. **Markdown editing** — Inline editing, parsing, link creation
6. **Persistence** — IndexedDB, auto-save, load on startup, export
7. **Search** — Index building, search UI, spatial highlighting
8. **Import** — File picker, Markdown parsing, node creation
9. **Lenses** — Architecture, basic lenses (tag, time, importance), lens UI
10. **Rules** — Rule node type, scope enforcement, visual anchoring
11. **Decisions** — Decision node type, structured fields, status tracking
12. **History** — Event logging, timeline navigation, time-travel view

---

## Success Criteria

The MVP succeeds if:

- A non-technical user **feels** relationships without explanation
- The user forgets they are "opening files"
- The space reorganizes in ways that feel intelligent
- It remains usable after weeks of accumulation (thousands of nodes)
- Search quickly surfaces relevant content
- Import feels seamless (Markdown files become nodes naturally)
- Smooth on desktop, acceptable on mobile/tablet
- Performance holds at thousands of nodes
- Rules feel like guardrails, not bureaucracy
- Decisions are discoverable when you need to understand "why"
- History enables "how did we get here?" without leaving the field

---

## Design Stance

Build this as an **authored instrument**, not a platform.

Prefer:
- **Clarity** over flexibility
- **Inevitability** over features
- **Meaning** over novelty

This is not software for today's paradigms.
This is something that looks like it arrived early.

**Proceed.**
