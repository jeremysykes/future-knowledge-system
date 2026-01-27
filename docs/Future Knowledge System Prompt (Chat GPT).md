# 🧠 Post‑Document Knowledge System

### Technical Requirements & Philosophy Prompt

_(For Claude Code)_

---

## ROLE & CONTEXT

You are a **senior creative technologist** with deep experience designing **post‑document user interfaces** — systems that treat knowledge as **living structure**, not static files.

You are tasked with designing and implementing a **local‑first, web‑native knowledge application** that **reimagines tools like Obsidian or Notion**, not by adding features, but by **changing the substrate** they operate on.

This system must feel like **a distant future interface**, brought back and built using **today’s open web standards**.

AI tools may be used to **assist in authoring this software**, but **AI must not be a runtime dependency** of the final application.

---

## CORE PHILOSOPHY

### 1. From Documents → Fields

Traditional tools assume:

> Knowledge = pages + folders + links

This system assumes:

> Knowledge = a **continuous semantic field**  
> Documents are **temporary projections** of that field.

There is no primary “page view.”  
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

- they have **weight**
    
- they exert **influence**
    
- they **drift**, **cluster**, and **decay**
    
- attention acts like **gravity**
    
- time acts like **erosion**
    

The UI is not a filing system.  
It is a **living environment**.

---

### 3. Spatial UI Is Not Decoration

Spatial layout is not cosmetic.

It is the **primary interface for cognition**:

- distance = relevance
    
- motion = change
    
- density = uncertainty or overload
    
- glow = importance
    
- fog = ambiguity or forgotten context
    

If the system were flattened into a list, it should lose meaning.

---

## NON‑GOALS (EXTREMELY IMPORTANT)

The system must **not** become:

- “Notion but 3D”
    
- a VR experience
    
- a game engine
    
- a chat interface
    
- a productivity dashboard
    
- a visual effect showcase
    

If something does not **increase sense‑making**, it is out of scope.

---

## MVP SCOPE (WHAT MUST EXIST)

The MVP should be **small, opinionated, and coherent**.

### Required Capabilities

1. **Create a node**
    
    - Markdown text
        
    - Optional metadata (tags, created time)
        
2. **Link nodes**
    
    - Explicit links
        
    - Implicit similarity (derived)
        
3. **Spatial field**
    
    - Nodes exist in continuous space
        
    - Position has meaning
        
4. **Forces**
    
    - Related nodes attract
        
    - Overlap repels
        
    - Unused nodes slowly drift away
        
    - Focus increases gravity
        
5. **Focus**
    
    - Selecting a node reshapes the space
        
    - Focus is not just zoom — it is influence
        
6. **Local persistence**
    
    - Data stored locally
        
    - Exportable as plain files
        
    - No server required
        

---

## USER EXPERIENCE PRINCIPLES

- No modal dialogs for core actions
    
- Minimal chrome
    
- Interaction over menus
    
- Motion should communicate state, not impress
    
- The system should feel **calm, intentional, and inevitable**
    

---

## DATA MODEL (CANONICAL)

### Node
```
Node {
  id: string
  markdown: string
  createdAt: number
  updatedAt: number
  links: string[]
  metadata: {
    tags?: string[]
    confidence?: number
  }
}

```

### Edge
```
Edge {
  from: string
  to: string
  weight: number
  type: "explicit" | "implicit"
}

```

### Field State
```
Field {
  focusNodeId?: string
  activeLens?: string
  timeBias: number
}

```

---

## TECHNICAL ARCHITECTURE (FREE / OPEN ONLY)

### Runtime Stack (Defensible, Standards‑Forward)

- **TypeScript**
    
- **WebGPU** (primary renderer)
    
- **React** (UI shell only — not scene graph)
    
- **D3.js** (semantic math only: scales, forces, transforms)
    
- **Rust → WASM** (optional, for clustering / similarity)
    
- **IndexedDB** (local persistence)
    
- **Markdown parser** (open source)
    

No proprietary SDKs.  
No paid APIs.  
No cloud lock‑in.

---

### Architectural Layers

#### 1. Semantic Engine (Meaning)

- Node importance
    
- Similarity
    
- Force parameters
    
- Lenses (filters that bend space)
    

This layer does **not** render pixels.

#### 2. Render Engine (Perception)

- WebGPU buffers
    
- Instanced nodes
    
- Fog, glow, depth
    
- GPU picking
    

This layer does **not** decide meaning.

#### 3. Interaction Engine (Intent)

- Drag
    
- Focus
    
- Hover
    
- Temporal evolution
    

Interaction reshapes semantics, not just camera.

---

## RENDERING PRINCIPLES

- Millions of nodes must be theoretically possible
    
- Labels are selective, not universal
    
- GPU picking is mandatory
    
- Motion must preserve continuity (no hard resets)
    

---

## LOCAL‑FIRST GUARANTEES

- Works offline
    
- Files can be exported as:
    
    - Markdown
        
    - JSON
        
- User owns their data
    
- No account required
    

---

## BUILD SEQUENCE (MANDATORY ORDER)

1. Static spatial field with placeholder nodes
    
2. Force system with no UI
    
3. GPU rendering at scale
    
4. Interaction + focus reshaping
    
5. Markdown editing
    
6. Persistence
    
7. Lenses (filters that bend space)
    

If any step feels wrong, **stop and refine** before continuing.

---

## SUCCESS CRITERIA (MVP)

The system is successful if:

- a non‑technical user can _feel_ relationships without explanation
    
- the user forgets they are “opening files”
    
- the space reorganizes in ways that feel intelligent
    
- it remains usable after weeks of accumulation
    

---

## FINAL INSTRUCTION

Design and implement this system **as an authored instrument**, not a platform.

Prefer:

- clarity over flexibility
    
- inevitability over features
    
- meaning over novelty
    

You are not building software for today’s paradigms.  
You are building something that looks like it arrived early.

Proceed.