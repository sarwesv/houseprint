const svg = document.getElementById('canvas');
const selectionLayer = document.getElementById('selection-layer');
const deleteBtn = document.getElementById('btn-delete');

let currentTool = 'select';
let floors = { "Floor 1": [] };
let currentFloor = "Floor 1";

let activeElement = null;
let interactionMode = null;
let startX, startY;
let currentFill = 'none';

// ── Tool selection ──────────────────────────────────────────────────────────

function setTool(toolName) {
    currentTool = toolName;
    document.querySelectorAll('.tool-group button').forEach(btn => {
        if (btn.id.startsWith('tool-')) btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`tool-${toolName}`);
    if (activeBtn) activeBtn.classList.add('active');
    if (toolName !== 'select') clearSelection();
}

// ── RGB fill sliders ────────────────────────────────────────────────────────

function slidersToHex() {
    const r = parseInt(document.getElementById('slider-r').value);
    const g = parseInt(document.getElementById('slider-g').value);
    const b = parseInt(document.getElementById('slider-b').value);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function updateColorPreview() {
    const isNone = document.getElementById('fill-none-check').checked;
    const hex = slidersToHex();
    const preview = document.getElementById('color-preview');
    preview.style.background = isNone ? 'transparent' : hex;
    preview.classList.toggle('no-fill', isNone);
    document.getElementById('val-r').textContent = document.getElementById('slider-r').value;
    document.getElementById('val-g').textContent = document.getElementById('slider-g').value;
    document.getElementById('val-b').textContent = document.getElementById('slider-b').value;
}

function onSliderChange() {
    document.getElementById('fill-none-check').checked = false;
    currentFill = slidersToHex();
    updateColorPreview();
    if (currentTool === 'select' && activeElement && activeElement.tagName === 'rect') {
        activeElement.setAttribute('fill', currentFill);
        saveState();
    }
}

function onFillNoneChange() {
    currentFill = document.getElementById('fill-none-check').checked ? 'none' : slidersToHex();
    updateColorPreview();
    if (currentTool === 'select' && activeElement && activeElement.tagName === 'rect') {
        activeElement.setAttribute('fill', currentFill);
        saveState();
    }
}

function syncSlidersToFill(fill) {
    if (!fill || fill === 'none') {
        document.getElementById('fill-none-check').checked = true;
    } else {
        document.getElementById('fill-none-check').checked = false;
        const r = parseInt(fill.slice(1, 3), 16);
        const g = parseInt(fill.slice(3, 5), 16);
        const b = parseInt(fill.slice(5, 7), 16);
        document.getElementById('slider-r').value = r;
        document.getElementById('slider-g').value = g;
        document.getElementById('slider-b').value = b;
    }
    updateColorPreview();
}

// ── Mouse events ────────────────────────────────────────────────────────────

svg.addEventListener('mousedown', (e) => {
    const coords = getMouseCoords(e);
    startX = coords.x;
    startY = coords.y;

    if (currentTool !== 'select') {
        interactionMode = 'drawing';
        if (currentTool === 'shape') {
            activeElement = createSVGElement('rect', {
                x: startX, y: startY, width: 0, height: 0, fill: currentFill, class: 'design-rect'
            });
        } else if (currentTool === 'line') {
            activeElement = createSVGElement('path', {
                d: `M ${startX} ${startY} Q ${startX} ${startY} ${startX} ${startY}`, class: 'design-line'
            });
        } else if (currentTool === 'text') {
            activeElement = createSVGElement('text', {
                x: startX, y: startY, class: 'design-text', 'font-size': '16'
            }, 'Double-click to enter text');
            setupSelectable(activeElement);
            saveState();
            setTool('select');
            selectElement(activeElement);
            restructureLayers();
            interactionMode = null;
        }
        return;
    } else {
        if (e.target === svg || e.target === selectionLayer) clearSelection();
    }
});

svg.addEventListener('mousemove', (e) => {
    if (!interactionMode) return;
    const coords = getMouseCoords(e);
    const dx = coords.x - startX;
    const dy = coords.y - startY;

    if (interactionMode === 'drawing') {
        if (currentTool === 'shape') {
            const x = Math.min(startX, coords.x);
            const y = Math.min(startY, coords.y);
            setAttrs(activeElement, { x, y, width: Math.abs(dx), height: Math.abs(dy) });
        } else if (currentTool === 'line') {
            const mx = (startX + coords.x) / 2;
            const my = (startY + coords.y) / 2;
            setAttrs(activeElement, { d: `M ${startX} ${startY} Q ${mx} ${my} ${coords.x} ${coords.y}` });
        }
    }
    else if (interactionMode === 'moving' && activeElement) {
        if (activeElement.tagName === 'rect' || activeElement.tagName === 'text') {
            setAttrs(activeElement, {
                x: parseFloat(activeElement.getAttribute('x')) + dx,
                y: parseFloat(activeElement.getAttribute('y')) + dy
            });
        } else if (activeElement.tagName === 'path') {
            let pts = parsePath(activeElement.getAttribute('d'));
            setAttrs(activeElement, {
                d: `M ${pts.x1 + dx} ${pts.y1 + dy} Q ${pts.cx + dx} ${pts.cy + dy} ${pts.x2 + dx} ${pts.y2 + dy}`
            });
        }
        startX = coords.x;
        startY = coords.y;
        updateSelectionOverlay();
    }
    else if (interactionMode === 'resizing' && activeElement) {
        if (activeElement.tagName === 'rect') {
            setAttrs(activeElement, {
                width: Math.max(10, parseFloat(activeElement.getAttribute('width')) + dx),
                height: Math.max(10, parseFloat(activeElement.getAttribute('height')) + dy)
            });
        } else if (activeElement.tagName === 'text') {
            let newSize = Math.max(10, parseFloat(activeElement.getAttribute('font-size')) + dx * 0.4);
            setAttrs(activeElement, { 'font-size': newSize });
        } else if (activeElement.tagName === 'path') {
            let pts = parsePath(activeElement.getAttribute('d'));
            setAttrs(activeElement, { d: `M ${pts.x1} ${pts.y1} Q ${pts.cx} ${pts.cy} ${coords.x} ${coords.y}` });
        }
        startX = coords.x;
        startY = coords.y;
        updateSelectionOverlay();
    }
    else if (interactionMode === 'bending' && activeElement) {
        let pts = parsePath(activeElement.getAttribute('d'));
        setAttrs(activeElement, { d: `M ${pts.x1} ${pts.y1} Q ${coords.x} ${coords.y} ${pts.x2} ${pts.y2}` });
        updateSelectionOverlay();
    }
});

window.addEventListener('mouseup', () => {
    if (interactionMode === 'drawing' && activeElement) {
        saveState();
        setupSelectable(activeElement);
        let targetEl = activeElement;
        setTool('select');
        selectElement(targetEl);
        restructureLayers();
    } else if (interactionMode) {
        saveState();
    }
    interactionMode = null;
});

window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && currentTool === 'select') deleteActiveElement();
});

// ── Selection ───────────────────────────────────────────────────────────────

function setupSelectable(el) {
    el.addEventListener('mousedown', (e) => {
        if (currentTool !== 'select') return;
        e.stopPropagation();
        selectElement(el);
        interactionMode = 'moving';
        const coords = getMouseCoords(e);
        startX = coords.x;
        startY = coords.y;
    });

    if (el.tagName === 'text') {
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            startTextEdit(el);
        });
    }
}

function selectElement(el) {
    activeElement = el;
    deleteBtn.style.display = 'block';
    if (el.tagName === 'rect') syncSlidersToFill(el.getAttribute('fill') || 'none');
    updateSelectionOverlay();
}

function clearSelection() {
    activeElement = null;
    selectionLayer.innerHTML = '';
    deleteBtn.style.display = 'none';
}

function deleteActiveElement() {
    if (activeElement) {
        activeElement.remove();
        clearSelection();
        saveState();
    }
}

// ── Inline text editing ─────────────────────────────────────────────────────

function startTextEdit(el) {
    const bbox = el.getBBox();
    const svgRect = svg.getBoundingClientRect();
    const fontSize = parseFloat(el.getAttribute('font-size')) || 16;

    el.style.visibility = 'hidden';
    clearSelection();

    const input = document.createElement('input');
    input.type = 'text';
    input.value = el.textContent === 'Double-click to enter text' ? '' : el.textContent;
    input.placeholder = 'Type label...';
    Object.assign(input.style, {
        position:   'fixed',
        left:       (svgRect.left + bbox.x) + 'px',
        top:        (svgRect.top + bbox.y - 2) + 'px',
        fontSize:   fontSize + 'px',
        fontFamily: 'Arial, sans-serif',
        background: '#0d1f3c',
        color:      '#c0e0ff',
        border:     '1px solid #5bc8ff',
        padding:    '2px 6px',
        outline:    'none',
        minWidth:   '140px',
        zIndex:     '1000',
        borderRadius: '3px',
    });

    document.body.appendChild(input);
    input.focus();
    input.select();

    function finish() {
        const newText = input.value.trim() || 'Double-click to enter text';
        el.textContent = newText;
        el.style.visibility = '';
        if (document.body.contains(input)) document.body.removeChild(input);
        saveState();
        selectElement(el);
    }

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') input.blur();
        if (ev.key === 'Escape') {
            input.removeEventListener('blur', finish);
            el.style.visibility = '';
            document.body.removeChild(input);
        }
    });
}

// ── Selection overlay ───────────────────────────────────────────────────────

function updateSelectionOverlay() {
    selectionLayer.innerHTML = '';
    if (!activeElement || currentTool !== 'select') return;

    if (activeElement.tagName === 'rect') {
        const x = parseFloat(activeElement.getAttribute('x'));
        const y = parseFloat(activeElement.getAttribute('y'));
        const w = parseFloat(activeElement.getAttribute('width'));
        const h = parseFloat(activeElement.getAttribute('height'));
        createOverlayElement('rect', { x, y, width: w, height: h, class: 'selected-outline' });
        createHandle(x + w, y + h, 'resizing');
    }
    else if (activeElement.tagName === 'text') {
        const bbox = activeElement.getBBox();
        createOverlayElement('rect', { x: bbox.x - 2, y: bbox.y - 2, width: bbox.width + 4, height: bbox.height + 4, class: 'selected-outline' });
        createHandle(bbox.x + bbox.width, bbox.y + bbox.height, 'resizing');
    }
    else if (activeElement.tagName === 'path') {
        const pts = parsePath(activeElement.getAttribute('d'));
        createHandle(pts.x2, pts.y2, 'resizing');
        createHandle(pts.cx, pts.cy, 'bending', true);
    }
}

function createHandle(cx, cy, mode, isBend = false) {
    const handle = createOverlayElement('circle', { cx, cy, r: 7, class: isBend ? 'bend-handle' : 'control-handle' });
    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        interactionMode = mode;
        const coords = getMouseCoords(e);
        startX = coords.x;
        startY = coords.y;
    });
}

// ── Layer ordering ──────────────────────────────────────────────────────────

function restructureLayers() {
    svg.querySelectorAll('.design-text').forEach(item => svg.appendChild(item));
    if (selectionLayer) svg.appendChild(selectionLayer);
}

// ── SVG helpers ─────────────────────────────────────────────────────────────

function createSVGElement(type, attrs, textContent = '') {
    const el = document.createElementNS('http://www.w3.org/2000/svg', type);
    setAttrs(el, attrs);
    if (textContent) el.textContent = textContent;
    svg.appendChild(el);
    return el;
}

function createOverlayElement(type, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', type);
    setAttrs(el, attrs);
    selectionLayer.appendChild(el);
    return el;
}

function setAttrs(el, attrs) {
    for (let key in attrs) el.setAttribute(key, attrs[key]);
}

function getMouseCoords(e) {
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function parsePath(dAttr) {
    const parts = dAttr.replace(/[MQ]/g, '').trim().split(/\s+/).map(Number);
    return { x1: parts[0], y1: parts[1], cx: parts[2], cy: parts[3], x2: parts[4], y2: parts[5] };
}

// ── Floor management ────────────────────────────────────────────────────────

function updateFloorMenu() {
    const select = document.getElementById('floor-select');
    select.innerHTML = '';
    Object.keys(floors).sort().forEach(f => {
        const opt = document.createElement('option');
        opt.value = f; opt.innerText = f;
        select.appendChild(opt);
    });
    select.value = currentFloor;
}

function addNewFloor() {
    saveState();
    const count = Object.keys(floors).length + 1;
    floors[`Floor ${count}`] = [];
    currentFloor = `Floor ${count}`;
    updateFloorMenu();
    loadFloor();
}

function switchFloor(name) {
    saveState();
    currentFloor = name;
    loadFloor();
}

function saveState() {
    let state = [];
    svg.querySelectorAll('.design-rect, .design-line').forEach(el => {
        let data = { type: el.tagName, attrs: {} };
        for (let attr of el.attributes) data.attrs[attr.name] = attr.value;
        state.push(data);
    });
    svg.querySelectorAll('.design-text').forEach(el => {
        let data = { type: el.tagName, attrs: {}, text: el.textContent };
        for (let attr of el.attributes) data.attrs[attr.name] = attr.value;
        state.push(data);
    });
    floors[currentFloor] = state;
}

function loadFloor() {
    svg.querySelectorAll('.design-rect, .design-line, .design-text').forEach(el => el.remove());
    clearSelection();
    (floors[currentFloor] || []).forEach(obj => {
        const el = createSVGElement(obj.type, obj.attrs, obj.text);
        setupSelectable(el);
    });
    restructureLayers();
}

// ── PDF export ──────────────────────────────────────────────────────────────

function downloadPDF() {
    saveState();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('landscape', 'pt', [1000, 750]);
    const title = document.getElementById('pdf-title').value.trim() || 'Blueprint';
    const sortedFloors = Object.keys(floors).sort();

    sortedFloors.forEach((floorName, index) => {
        if (index > 0) pdf.addPage([1000, 750], 'landscape');
        pdf.setFont("Helvetica", "bold");
        pdf.setFontSize(22);
        pdf.text(`${title}: ${floorName}`, 50, 50);
        pdf.setLineWidth(1.5);
        pdf.line(50, 65, 950, 65);

        floors[floorName].forEach(item => {
            if (item.type === 'rect') {
                const x = parseFloat(item.attrs.x);
                const y = parseFloat(item.attrs.y);
                const w = parseFloat(item.attrs.width);
                const h = parseFloat(item.attrs.height);
                const fill = item.attrs.fill || 'none';
                if (fill !== 'none') { pdf.setFillColor(fill); pdf.rect(x, y, w, h, 'F'); }
                pdf.setLineWidth(2.5);
                pdf.rect(x, y, w, h, 'S');
            } else if (item.type === 'path') {
                pdf.setLineWidth(3);
                const pts = parsePath(item.attrs.d);
                pdf.line(pts.x1, pts.y1, pts.cx, pts.cy);
                pdf.line(pts.cx, pts.cy, pts.x2, pts.y2);
            } else if (item.type === 'text') {
                pdf.setFont("Helvetica", "bold");
                pdf.setFontSize(parseFloat(item.attrs['font-size']) || 16);
                pdf.text(item.text, parseFloat(item.attrs.x), parseFloat(item.attrs.y));
            }
        });
    });
    pdf.save('blueprint.pdf');
}

// ── Room templates ──────────────────────────────────────────────────────────
// Each item type:
//   'room'  – room outline rect (no fill)
//   'box'   – furniture rect + label auto-centered inside it
//   'label' – standalone room-name text, centered at (dx, dy)

const TEMPLATES = {
    bedroom: { w: 235, h: 215, items: [
        { type: 'room', dx: 0,   dy: 0,   width: 235, height: 215 },
        { type: 'box',  dx: 10,  dy: 20,  width: 135, height: 160, fill: '#c8e0ff', label: 'Bed' },
        { type: 'box',  dx: 155, dy: 20,  width: 42,  height: 38,  fill: '#d0d8e8', label: 'Stand',    fontSize: 10 },
        { type: 'box',  dx: 155, dy: 68,  width: 72,  height: 105, fill: '#d0d8e8', label: 'Wardrobe', fontSize: 11 },
        { type: 'label', dx: 118, dy: 205, text: 'Bedroom' },
    ]},
    bathroom: { w: 175, h: 195, items: [
        { type: 'room', dx: 0,  dy: 0,   width: 175, height: 195 },
        { type: 'box',  dx: 10, dy: 10,  width: 48,  height: 60,  fill: '#d0d8e8', label: 'Toilet',  fontSize: 11 },
        { type: 'box',  dx: 10, dy: 80,  width: 58,  height: 50,  fill: '#d0d8e8', label: 'Sink',    fontSize: 11 },
        { type: 'box',  dx: 75, dy: 10,  width: 90,  height: 165, fill: '#b8e8ff', label: 'Shower' },
        { type: 'label', dx: 88, dy: 187, text: 'Bathroom' },
    ]},
    kitchen: { w: 270, h: 210, items: [
        { type: 'room', dx: 0,   dy: 0,   width: 270, height: 210 },
        { type: 'box',  dx: 10,  dy: 10,  width: 250, height: 42,  fill: '#d0d8e8', label: 'Counter' },
        { type: 'box',  dx: 10,  dy: 62,  width: 62,  height: 48,  fill: '#d0d8e8', label: 'Sink',   fontSize: 11 },
        { type: 'box',  dx: 205, dy: 62,  width: 55,  height: 62,  fill: '#d0d8e8', label: 'Fridge', fontSize: 11 },
        { type: 'box',  dx: 72,  dy: 118, width: 145, height: 68,  fill: '#c8e0ff', label: 'Island' },
        { type: 'label', dx: 135, dy: 201, text: 'Kitchen' },
    ]},
    living: { w: 305, h: 260, items: [
        { type: 'room', dx: 0,   dy: 0,   width: 305, height: 260 },
        { type: 'box',  dx: 63,  dy: 10,  width: 180, height: 32,  fill: '#162030', label: 'TV',    fontSize: 11 },
        { type: 'box',  dx: 10,  dy: 65,  width: 68,  height: 68,  fill: '#d0d8e8', label: 'Chair', fontSize: 11 },
        { type: 'box',  dx: 228, dy: 65,  width: 68,  height: 68,  fill: '#d0d8e8', label: 'Chair', fontSize: 11 },
        { type: 'box',  dx: 98,  dy: 72,  width: 110, height: 55,  fill: '#c8e0ff', label: 'Table', fontSize: 11 },
        { type: 'box',  dx: 40,  dy: 162, width: 225, height: 78,  fill: '#d0d8e8', label: 'Sofa' },
        { type: 'label', dx: 153, dy: 250, text: 'Living Room' },
    ]},
    dining: { w: 280, h: 235, items: [
        { type: 'room', dx: 0,   dy: 0,   width: 280, height: 235 },
        { type: 'box',  dx: 65,  dy: 73,  width: 150, height: 90,  fill: '#c8e0ff', label: 'Dining Table', fontSize: 11 },
        { type: 'box',  dx: 112, dy: 43,  width: 56,  height: 25,  fill: '#d0d8e8', label: 'Chair', fontSize: 9 },
        { type: 'box',  dx: 112, dy: 168, width: 56,  height: 25,  fill: '#d0d8e8', label: 'Chair', fontSize: 9 },
        { type: 'box',  dx: 30,  dy: 90,  width: 28,  height: 55,  fill: '#d0d8e8', label: 'Chair', fontSize: 9 },
        { type: 'box',  dx: 222, dy: 90,  width: 28,  height: 55,  fill: '#d0d8e8', label: 'Chair', fontSize: 9 },
        { type: 'label', dx: 140, dy: 225, text: 'Dining Room' },
    ]},
    laundry: { w: 215, h: 205, items: [
        { type: 'room', dx: 0,   dy: 0,   width: 215, height: 205 },
        { type: 'box',  dx: 10,  dy: 10,  width: 85,  height: 85,  fill: '#c8e0ff', label: 'Washer' },
        { type: 'box',  dx: 105, dy: 10,  width: 85,  height: 85,  fill: '#d0d8e8', label: 'Dryer' },
        { type: 'box',  dx: 10,  dy: 105, width: 62,  height: 68,  fill: '#d0d8e8', label: 'Sink',    fontSize: 11 },
        { type: 'box',  dx: 82,  dy: 108, width: 120, height: 58,  fill: '#c8e0ff', label: 'Folding', fontSize: 11 },
        { type: 'label', dx: 108, dy: 196, text: 'Laundry' },
    ]},
    office: { w: 240, h: 205, items: [
        { type: 'room', dx: 0,   dy: 0,   width: 240, height: 205 },
        { type: 'box',  dx: 10,  dy: 10,  width: 175, height: 62,  fill: '#c8e0ff', label: 'Desk' },
        { type: 'box',  dx: 60,  dy: 82,  width: 68,  height: 65,  fill: '#d0d8e8', label: 'Chair',   fontSize: 11 },
        { type: 'box',  dx: 10,  dy: 82,  width: 42,  height: 65,  fill: '#d0d8e8', label: 'Cabinet', fontSize: 9 },
        { type: 'box',  dx: 200, dy: 10,  width: 32,  height: 150, fill: '#d0d8e8', label: 'Shelf',   fontSize: 10 },
        { type: 'label', dx: 120, dy: 196, text: 'Office' },
    ]},
    garage: { w: 300, h: 230, items: [
        { type: 'room', dx: 0,  dy: 0,   width: 300, height: 230 },
        { type: 'box',  dx: 45, dy: 15,  width: 210, height: 125, fill: '#1e2d3d', label: 'Car', fontSize: 14 },
        { type: 'box',  dx: 10, dy: 153, width: 280, height: 48,  fill: '#d0d8e8', label: 'Workbench' },
        { type: 'label', dx: 150, dy: 221, text: 'Garage' },
    ]},
};

function insertTemplate() {
    const key = document.getElementById('insert-select').value;
    const tmpl = TEMPLATES[key];
    if (!tmpl) return;

    const container = document.getElementById('canvas-container');
    const ox = Math.round(container.scrollLeft + (container.clientWidth  - tmpl.w) / 2);
    const oy = Math.round(container.scrollTop  + (container.clientHeight - tmpl.h) / 2);

    tmpl.items.forEach(def => {
        if (def.type === 'room') {
            setupSelectable(createSVGElement('rect', {
                class: 'design-rect', fill: 'none',
                x: ox + def.dx, y: oy + def.dy, width: def.width, height: def.height,
            }));
        } else if (def.type === 'box') {
            setupSelectable(createSVGElement('rect', {
                class: 'design-rect',
                x: ox + def.dx, y: oy + def.dy, width: def.width, height: def.height,
                fill: def.fill || 'none',
            }));
            setupSelectable(createSVGElement('text', {
                class: 'design-text',
                x: ox + def.dx + def.width  / 2,
                y: oy + def.dy + def.height / 2,
                'font-size': String(def.fontSize || 12),
                'text-anchor': 'middle',
                'dominant-baseline': 'central',
            }, def.label || ''));
        } else if (def.type === 'label') {
            setupSelectable(createSVGElement('text', {
                class: 'design-text',
                x: ox + def.dx, y: oy + def.dy,
                'font-size': String(def.fontSize || 13),
                'text-anchor': 'middle',
            }, def.text || ''));
        }
    });

    restructureLayers();
    saveState();
}

// ── Init ────────────────────────────────────────────────────────────────────

updateColorPreview();
updateFloorMenu();
loadFloor();

let _loadedVersion = null;

async function _fetchVersion() {
    const res = await fetch('version.json?_=' + Date.now());
    const data = await res.json();
    return data.version;
}

_fetchVersion().then(v => {
    _loadedVersion = v;
    document.getElementById('version-badge').textContent = 'v' + v;
}).catch(() => {});

setInterval(() => {
    _fetchVersion().then(v => {
        if (_loadedVersion && v !== _loadedVersion) location.reload();
    }).catch(() => {});
}, 30000);
