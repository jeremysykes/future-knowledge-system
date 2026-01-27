# 🧠 Post‑Document Knowledge System

### Technical Requirements & Philosophy Prompt (Improved)

_(For Claude Code)_

---

## ROLE & CONTEXT

You are a **senior creative technologist** with deep experience designing **post‑document user interfaces** — systems that treat knowledge as **living structure**, not static files.

You are tasked with designing and implementing a **local‑first, web‑native knowledge application** that **reimagines tools like Obsidian or Notion**, not by adding features, but by **changing the substrate** they operate on.

This system must feel like **a distant future interface**, brought back and built using **today's open web standards**.

AI tools may be used to **assist in authoring this software**, but **AI must not be a runtime dependency** of the final application.

---

## PLATFORM & DEVICE SUPPORT

**Primary Target:** Desktop-first experience optimized for mouse, keyboard, and large displays.

**Secondary Targets:** The system must work seamlessly on:
- **Tablets:** Touch-optimized interactions, responsive layout, gesture support
- **Mobile:** Simplified interface, essential features accessible, performance-conscious rendering

The spatial field should adapt gracefully across screen sizes. On smaller devices, consider:
- Simplified node representations
- Gesture-based navigation (pinch to zoom, pan to navigate)
- Progressive disclosure of detail
- Touch-friendly interaction targets

The core experience must remain coherent across all platforms. Desktop should not feel like a scaled-up mobile app, and mobile should not feel like a crippled desktop version.

---

## CORE PHILOSOPHY

### 1. From Documents → Fields

Traditional tools assume:

> Knowledge = pages + folders + links

This system assumes:

> Knowledge = a **continuous semantic field**  
> Documents are **temporary projections** of that field.

There is no primary "page view."  
There is no canonical list.  
There is no folder tree.

Instead, meaning emerges from:

- relationships
- proximity
- time
- attention
- interaction

---

### 2. Knowledge Behaves Like Matter

Ideas in this system should feel like:

- they have **weight**
- they exert **influence**
- they **drift**, **cluster**, and **decay**
- attention acts like **gravity**
- time acts like **erosion**

The UI is not a filing system.  
It is a **living environment**.

---

### 3. Spatial UI Is Not Decoration

Spatial layout is not cosmetic.

It is the **primary interface for cognition**:

- distance = relevance
- motion = change
- density = uncertainty or overload
- glow = importance
- fog = ambiguity or forgotten context

If the system were flattened into a list, it should lose meaning.

---

## NON‑GOALS (EXTREMELY IMPORTANT)

The system must **not** become:

- "Notion but 3D"
- a VR experience
- a game engine
- a chat interface
- a productivity dashboard
- a visual effect showcase

If something does not **increase sense‑making**, it is out of scope.

---

## MVP SCOPE (WHAT MUST EXIST)

The MVP should be **small, opinionated, and coherent**.

### Required Capabilities

1. **Create a node**
    - Markdown text
    - Optional metadata (tags, created time)
    - Inline editing (no separate edit mode)

2. **Link nodes**
    - Explicit links (user-created `[[link]]` syntax)
    - Implicit similarity (derived automatically)
    - Links create edges with appropriate weights

3. **Spatial field**
    - Nodes exist in continuous 2D space (consider 2.5D with depth cues)
    - Position has semantic meaning
    - Field is unbounded (infinite canvas concept)

4. **Forces**
    - Related nodes attract (strength based on edge weight)
    - Overlap repels (prevents visual clutter)
    - Unused nodes slowly drift away (time-based decay)
    - Focus increases gravity (focused node attracts related nodes)
    - Force simulation runs continuously but can be paused

5. **Focus**
    - Selecting a node reshapes the space
    - Focus is not just zoom — it is influence (affects force calculations)
    - Related nodes move closer when a node is focused
    - Smooth transitions, no jarring jumps

6. **Search & Discovery**
    - **Search:** Text-based search across node content and metadata
    - **Discovery:** Visual exploration through spatial navigation
    - Search results highlight in the spatial field
    - Discovery happens through proximity, relationships, and serendipity

7. **Import**
    - Import Markdown files from other knowledge tools
    - Parse Markdown files and create nodes
    - Extract links from Markdown (both `[[wiki links]]` and `[markdown links](url)`)
    - Preserve file structure as initial spatial hints (optional)
    - **No direct integration** with other tools — just file import

8. **Local persistence**
    - Data stored locally in IndexedDB
    - Exportable as plain files (Markdown, JSON)
    - No server required
    - Auto-save on changes

---

## SCALE EXPECTATIONS

The system must handle:
- **Thousands of nodes** as a baseline expectation
- **Tens of thousands** should remain performant
- **Hundreds of thousands** should be theoretically possible (with appropriate optimizations)

Performance considerations:
- Level-of-detail rendering (simplified representations at distance)
- Spatial indexing for efficient queries
- Incremental similarity calculation (not all pairs at once)
- Lazy loading of node content
- Efficient force simulation (consider Barnes-Hut or similar for large graphs)

---

## SIMILARITY CALCULATION

**Approach:** Choose whichever method feels most intuitive and performant.

Options to consider:
- **Text similarity:** TF-IDF, cosine similarity on word vectors
- **Semantic similarity:** Word embeddings (if available client-side)
- **Structural similarity:** Shared links, common neighbors
- **Hybrid approach:** Combine multiple signals

The similarity calculation should:
- Feel natural (nodes that seem related should cluster)
- Be fast enough for real-time updates
- Work incrementally (recalculate only when nodes change)
- Create edges with appropriate weights (0.0 to 1.0)

**Recommendation:** Start with a simple text-based approach (TF-IDF or word overlap), then refine based on user feedback. The goal is intuitive clustering, not perfect semantic understanding.

---

## COLLABORATION

The system should support **both single-user and multi-user** scenarios:

**Single-user (MVP):**
- Local-only, no sync needed
- Full feature set available

**Multi-user (future consideration, not MVP):**
- Design data model to be conflict-free where possible
- Consider CRDTs or similar for eventual consistency
- Real-time collaboration can be added later
- For MVP, focus on single-user experience

---

## USER EXPERIENCE PRINCIPLES

- No modal dialogs for core actions
- Minimal chrome
- Interaction over menus
- Motion should communicate state, not impress
- The system should feel **calm, intentional, and inevitable**
- **Desktop-first:** Rich interactions, keyboard shortcuts, precise mouse control
- **Mobile-friendly:** Gestures, touch targets, simplified but functional

---

## DATA MODEL (CANONICAL)

### Node
```
Node {
  id: string (UUID or similar)
  markdown: string
  createdAt: number (timestamp)
  updatedAt: number (timestamp)
  links: string[] (array of node IDs)
  position: { x: number, y: number, z?: number } (spatial coordinates)
  metadata: {
    tags?: string[]
    confidence?: number (0.0 to 1.0)
    lastAccessed?: number (timestamp)
  }
}
```

### Edge
```
Edge {
  from: string (node ID)
  to: string (node ID)
  weight: number (0.0 to 1.0)
  type: "explicit" | "implicit"
  createdAt?: number (for implicit edges, when discovered)
}
```

### Field State
```
Field {
  focusNodeId?: string
  activeLens?: string
  timeBias: number (0.0 to 1.0, affects temporal decay)
  viewport: { center: { x: number, y: number }, zoom: number }
  searchQuery?: string
}
```

### Lens (Filter that bends space)
```
Lens {
  id: string
  name: string
  type: "tag" | "time" | "importance" | "custom"
  parameters: Record<string, any>
  // A lens modifies how nodes are positioned or displayed
  // Examples: "show only recent", "highlight by tag", "emphasize connections"
}
```

---

## TECHNICAL ARCHITECTURE (FREE / OPEN ONLY)

### Runtime Stack (Defensible, Standards‑Forward)

- **TypeScript**
- **WebGPU** (primary renderer) — with fallback to WebGL if needed
- **React** (UI shell only — not scene graph)
- **D3.js** (semantic math only: scales, forces, transforms)
- **Rust → WASM** (optional, for clustering / similarity calculations)
- **IndexedDB** (local persistence)
- **Markdown parser** (open source, e.g., marked, markdown-it, or remark)

No proprietary SDKs.  
No paid APIs.  
No cloud lock‑in.

---

### Architectural Layers

#### 1. Semantic Engine (Meaning)

- Node importance calculation
- Similarity computation
- Force parameters and simulation
- Lenses (filters that bend space)
- Search indexing

This layer does **not** render pixels.

**Key responsibilities:**
- Calculate implicit edges based on similarity
- Determine node importance (based on connections, recency, user attention)
- Run force-directed layout simulation
- Apply lens transformations to node positions
- Build and query search index

#### 2. Render Engine (Perception)

- WebGPU buffers and shaders
- Instanced node rendering
- Fog, glow, depth effects
- GPU picking (mouse/touch interaction)
- Level-of-detail system
- Responsive rendering (adapt to device capabilities)

This layer does **not** decide meaning.

**Key responsibilities:**
- Render nodes as points, circles, or simple shapes
- Render edges as lines (with appropriate opacity/width)
- Apply visual effects (glow for importance, fog for distance)
- Handle camera/viewport transformations
- Implement efficient culling (don't render off-screen nodes)
- Support touch and mouse input for picking

#### 3. Interaction Engine (Intent)

- Drag (desktop: mouse, mobile: touch)
- Focus (click/tap)
- Hover (desktop only)
- Pan (mouse drag on background, touch drag)
- Zoom (mouse wheel, pinch gesture)
- Temporal evolution (force simulation updates)
- Search interaction
- Node editing

Interaction reshapes semantics, not just camera.

**Key responsibilities:**
- Map user input to spatial actions
- Update field state based on interactions
- Trigger semantic recalculation when needed
- Handle multi-touch gestures on mobile
- Provide keyboard shortcuts for desktop

---

## RENDERING PRINCIPLES

- **Scale:** Must handle thousands of nodes smoothly, tens of thousands with optimizations
- **Level-of-detail:** Simplify node representation at distance (points → circles → labels)
- **Labels:** Selective, not universal (show labels for focused nodes, nearby nodes, or on hover)
- **GPU picking:** Mandatory for performance (use color-based picking or compute shaders)
- **Motion:** Must preserve continuity (no hard resets, smooth transitions)
- **Responsive:** Adapt rendering quality to device capabilities
- **Performance:** Target 60fps on desktop, 30fps minimum on mobile

---

## FORCE SIMULATION DETAILS

The force system should feel natural and responsive:

**Attraction Forces:**
- Strength proportional to edge weight
- Distance-based decay (inverse square or similar)
- Maximum attraction distance to prevent infinite fields

**Repulsion Forces:**
- Prevent node overlap
- Strong at close range, weak at distance
- Consider node "size" (based on importance or content length)

**Decay Forces:**
- Unused nodes drift toward edges (or fade)
- Based on `lastAccessed` timestamp
- Slow, subtle movement

**Focus Gravity:**
- Focused node creates additional attraction for related nodes
- Effect diminishes with distance
- Smoothly transitions when focus changes

**Implementation notes:**
- Use D3's force simulation or similar
- Run simulation in a worker thread if possible
- Throttle updates to maintain performance
- Allow user to pause/resume simulation

---

## SEARCH & DISCOVERY

**Search:**
- Full-text search across node markdown content
- Search metadata (tags, etc.)
- Results highlight in spatial field
- Jump to result (smooth camera movement)
- Search index built incrementally as nodes are created/updated

**Discovery:**
- Visual exploration through spatial navigation
- Proximity reveals relationships
- Hover/click reveals connections
- Lenses filter and reorganize view
- Serendipitous discovery through spatial wandering

---

## IMPORT FUNCTIONALITY

**Import Process:**
1. User selects one or more Markdown files
2. Parse each file to extract:
   - Content (markdown text)
   - Links (both `[[wiki links]]` and markdown `[text](url)` links)
   - Frontmatter/metadata if present
3. Create nodes for each file
4. Create explicit edges for discovered links
5. Optionally use file structure (directory hierarchy) as initial spatial hints
6. Add imported nodes to the field

**Scope Control:**
- Import only Markdown files (`.md`, `.markdown`)
- No direct API integration with other tools
- No automatic syncing
- User controls what to import

---

## LOCAL‑FIRST GUARANTEES

- Works completely offline
- Files can be exported as:
    - **Markdown:** One file per node, preserving links
    - **JSON:** Complete data dump (nodes, edges, field state)
- User owns their data (stored locally, no cloud)
- No account required
- Data is portable and future-proof

---

## BUILD SEQUENCE (MANDATORY ORDER)

1. **Static spatial field** with placeholder nodes
   - Render nodes at fixed positions
   - Basic camera/viewport
   - No interaction yet

2. **Force system** with no UI
   - Implement force simulation
   - Test with various node counts
   - Verify performance

3. **GPU rendering at scale**
   - Implement WebGPU rendering
   - Add level-of-detail
   - Optimize for thousands of nodes
   - Test on different devices

4. **Interaction + focus reshaping**
   - Mouse/touch input
   - Focus mechanism
   - Camera controls (pan, zoom)
   - Force simulation responds to focus

5. **Markdown editing**
   - Inline editing
   - Markdown parsing and rendering
   - Link creation/editing

6. **Persistence**
   - IndexedDB storage
   - Auto-save
   - Load on startup
   - Export functionality

7. **Search & Discovery**
   - Search index
   - Search UI
   - Result highlighting

8. **Import**
   - File picker
   - Markdown parser
   - Node creation from files
   - Link extraction

9. **Lenses** (filters that bend space)
   - Lens system architecture
   - Basic lenses (tag, time, importance)
   - UI for lens selection

If any step feels wrong, **stop and refine** before continuing.

---

## SUCCESS CRITERIA (MVP)

The system is successful if:

- A non‑technical user can **feel** relationships without explanation
- The user forgets they are "opening files"
- The space reorganizes in ways that feel intelligent
- It remains usable after weeks of accumulation (thousands of nodes)
- Search helps users find content quickly
- Import feels seamless (Markdown files become nodes naturally)
- The system works smoothly on desktop and acceptably on mobile/tablet
- Performance remains good with thousands of nodes

---

## FINAL INSTRUCTION

Design and implement this system **as an authored instrument**, not a platform.

Prefer:

- clarity over flexibility
- inevitability over features
- meaning over novelty

You are not building software for today's paradigms.  
You are building something that looks like it arrived early.

**Proceed.**
