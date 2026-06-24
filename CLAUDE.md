# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step. Open `index.html` directly in a browser, or serve it locally:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

> **Known issue:** `index.html` currently references `<script src="coolcode.js">` but the actual file is `main.js`. Fix by updating the script tag to `<script src="main.js">`.

## Architecture

The app is two files:

**`index.html`** — layout, CSS, and the SVG canvas. Defines all DOM IDs that `main.js` binds to. The drawing surface is an inline `<svg id="canvas">` with a child `<g id="selection-layer">` that always stays on top via `restructureLayers()`.

**`main.js`** — all logic. No framework, no modules. Runs top-level on load (`updateFloorMenu(); loadFloor()` at the bottom).

### State model

- `floors` — object keyed by floor name, each value is a serialized array of `{ type, attrs, text }` saved from the SVG DOM
- `currentFloor` — active floor name
- `activeElement` — the currently selected SVG DOM element (live reference, not a copy)
- `interactionMode` — `'drawing' | 'moving' | 'resizing' | 'bending' | null`

Floor state is saved to `floors[currentFloor]` by reading live SVG attributes (`saveState()`), and restored by recreating SVG elements from that data (`loadFloor()`).

### Interaction flow

Mouse events on the SVG drive everything through `interactionMode`:
- `mousedown` → sets `interactionMode` and creates/selects an element
- `mousemove` → mutates element attributes in place based on mode
- `mouseup` → calls `saveState()`, then `restructureLayers()` (moves `.design-text` and `#selection-layer` to the front of the SVG child list so they render on top)

### Selection overlay

`updateSelectionOverlay()` clears and redraws `#selection-layer` after every interaction. Handles are SVG circles appended to the selection layer — they carry their own `mousedown` listeners that set `interactionMode` to `'resizing'` or `'bending'`.

### PDF export

`downloadPDF()` iterates `floors`, reconstructs each floor's elements into jsPDF draw calls (rect → `pdf.rect`, path → two `pdf.line` segments approximating the quadratic curve, text → `pdf.text`), and saves `architectural_blueprint_suite.pdf`. jsPDF is loaded from CDN in `index.html` and accessed via `window.jspdf`.

## Key DOM IDs expected by main.js

| ID | Element |
|----|---------|
| `canvas` | `<svg>` drawing surface |
| `selection-layer` | `<g>` inside canvas, always kept topmost |
| `floor-select` | `<select>` for floor switching |
| `fill-select` | `<select>` for room fill color |
| `btn-delete` | delete button (toggled visible on selection) |
| `tool-select`, `tool-shape`, `tool-line`, `tool-text` | toolbar buttons inside `.tool-group` |
