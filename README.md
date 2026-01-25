# Future Knowledge System

A local-first knowledge application where knowledge exists as a continuous semantic field, not files. Nodes attract/repel based on relationships, and user focus reshapes the entire space.

## Features

- **Semantic Field Visualization** - Knowledge nodes rendered in a continuous spatial field using WebGPU/WebGL
- **Force-Directed Layout** - D3.js force simulation running in a web worker at 30Hz
- **Multiple Node Types** - Knowledge, Rule, and Decision nodes with distinct visualizations
- **Wiki-Style Linking** - `[[wiki links]]` for connecting knowledge
- **Full-Text Search** - FlexSearch-powered search with Cmd+K
- **View Lenses** - Filter by tags, time, importance, or type
- **Auto-Save** - IndexedDB persistence via Dexie with debounced saving
- **History & Time Travel** - Track changes and restore previous states

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Controls

- **Pan**: Shift+Drag or Middle Mouse Button
- **Zoom**: Ctrl+Scroll or Pinch gesture
- **Select**: Click on a node
- **Focus**: Double-click on a node
- **Search**: Cmd+K (or Ctrl+K)
- **History**: Cmd+H (or Ctrl+H)
- **Delete**: Delete/Backspace (selected nodes)
- **Select All**: Cmd+A

## Architecture

```
src/
├── main/           # Electron main process
├── preload/        # Context bridge
└── renderer/
    ├── core/       # Types, stores, event bus
    ├── semantic/   # Force simulation, search, lenses
    ├── render/     # WebGPU/WebGL rendering
    ├── interaction/# Input handling, focus
    ├── persistence/# Dexie database, auto-save
    ├── markdown/   # Parser, editor
    ├── import/     # File import/export
    └── components/ # React UI
```

## Tech Stack

- **Electron** - Desktop shell
- **TypeScript** - Language
- **React** - UI components
- **WebGPU/WebGL** - GPU rendering
- **D3.js** - Force simulation
- **Dexie** - IndexedDB wrapper
- **Zustand** - State management
- **unified/remark** - Markdown parsing
- **FlexSearch** - Full-text search

## License

MIT
