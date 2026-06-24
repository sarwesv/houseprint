# Houseprint

A browser-based multi-floor house design tool. Draw rooms, walls, and labels across multiple floors and export a PDF blueprint — no installation required.

**Live site:** https://sarwesv.github.io/houseprint

## Features

- **Draw rooms** — click and drag to place rectangles with fill color options
- **Draw walls** — freehand lines with bendable curves (drag the orange handle)
- **Add labels** — click to place text, drag the corner handle to resize
- **Multi-floor support** — add floors and switch between them independently
- **Select & move** — click any element to select it, drag to reposition
- **Delete** — select an element and press Delete/Backspace, or use the button
- **Export PDF** — downloads a multi-page PDF with one page per floor

## Usage

Open the live site or run locally by opening `index.html` in any modern browser.

| Tool | How to use |
|------|-----------|
| Draw Room | Click and drag to draw a rectangle |
| Draw Wall | Click and drag to draw a wall line |
| Add Label | Click anywhere and type your text |
| Select / Move | Click an element to select, then drag to move |
| Resize | Select an element, drag the blue corner handle |
| Bend wall | Select a wall, drag the orange midpoint handle |

## Files

- `index.html` — app layout and styles
- `main.js` — all drawing, floor management, and PDF export logic

## Tech

Pure HTML, SVG, and JavaScript. PDF export via [jsPDF](https://github.com/parallax/jsPDF). No build step, no dependencies to install.
