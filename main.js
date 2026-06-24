const svg = document.getElementById('canvas');
const selectionLayer = document.getElementById('selection-layer');
const deleteBtn = document.getElementById('btn-delete');
const fillSelect = document.getElementById('fill-select');

let currentTool = 'select';
let floors = { "Floor 1": [] };
let currentFloor = "Floor 1";

let activeElement = null;
let interactionMode = null; 
let startX, startY;
let currentFill = 'none';

function setTool(toolName) {
    currentTool = toolName;
    document.querySelectorAll('.tool-group button').forEach(btn => {
        if(btn.id.startsWith('tool-')) btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`tool-${toolName}`);
    if(activeBtn) activeBtn.classList.add('active');
    if (toolName !== 'select') clearSelection();
}

function updateFillColor(val) {
    currentFill = val;
    if (currentTool === 'select' && activeElement && activeElement.tagName === 'rect') {
        activeElement.setAttribute('fill', val);
        saveState();
    }
}

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
            const str = prompt("Enter text label:");
            if (str) {
                activeElement = createSVGElement('text', {
                    x: startX, y: startY, class: 'design-text', 'font-size': '16'
                }, str);
                saveState();
                setTool('select');
                selectElement(activeElement);
            } else {
                setTool('select');
            }
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
            setAttrs(activeElement, { x: x, y: y, width: Math.abs(dx), height: Math.abs(dy) });
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
        // Clean layer order sorting instantly right after drawing
        restructureLayers(); 
    } else if (interactionMode) {
        saveState();
    }
    interactionMode = null;
});

window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && currentTool === 'select') deleteActiveElement();
});

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
}

function selectElement(el) {
    activeElement = el;
    deleteBtn.style.display = 'block';
    if(el.tagName === 'rect') fillSelect.value = el.getAttribute('fill') || 'none';
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

function updateSelectionOverlay() {
    selectionLayer.innerHTML = '';
    if (!activeElement || currentTool !== 'select') return;

    if (activeElement.tagName === 'rect') {
        const x = parseFloat(activeElement.getAttribute('x'));
        const y = parseFloat(activeElement.getAttribute('y'));
        const w = parseFloat(activeElement.getAttribute('width'));
        const h = parseFloat(activeElement.getAttribute('height'));
        createOverlayElement('rect', { x: x, y: y, width: w, height: h, class: 'selected-outline' });
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
    const handle = createOverlayElement('circle', { cx: cx, cy: cy, r: 7, class: isBend ? 'bend-handle' : 'control-handle' });
    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        interactionMode = mode;
        const coords = getMouseCoords(e);
        startX = coords.x;
        startY = coords.y;
    });
}

/**
 * NEW LOGIC: Forces all text blocks to jump cleanly to the front layer.
 */
function restructureLayers() {
    const textItems = svg.querySelectorAll('.design-text');
    textItems.forEach(item => {
        svg.appendChild(item); // Appending an element to its parent pushes it to the front visual layer
    });
    if (selectionLayer) svg.appendChild(selectionLayer); // Selection box always stays on absolute top
}

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
    const parts = dAttr.replace(/[M|Q]/g, '').trim().split(/\s+/).map(Number);
    return { x1: parts[0], y1: parts[1], cx: parts[2], cy: parts[3], x2: parts[4], y2: parts[5] };
}

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
    const name = `Floor ${count}`;
    floors[name] = [];
    currentFloor = name;
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
    // Select shapes and lines first
    svg.querySelectorAll('.design-rect, .design-line').forEach(el => {
        let data = { type: el.tagName, attrs: {} };
        for (let attr of el.attributes) data.attrs[attr.name] = attr.value;
        state.push(data);
    });
    // Append text elements last so they consistently save on top
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
    const state = floors[currentFloor] || [];
    state.forEach(obj => {
        const el = createSVGElement(obj.type, obj.attrs, obj.text);
        setupSelectable(el);
    });
    restructureLayers();
}

function downloadPDF() {
    saveState();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('landscape', 'pt', [1000, 750]);
    const sortedFloors = Object.keys(floors).sort();

    sortedFloors.forEach((floorName, index) => {
        if (index > 0) pdf.addPage([1000, 750], 'landscape');
        pdf.setFont("Helvetica", "bold");
        pdf.setFontSize(22);
        pdf.text(`House Architecture Blueprint Suite: ${floorName}`, 50, 50);
        pdf.setLineWidth(1.5);
        pdf.line(50, 65, 950, 65);

        floors[floorName].forEach(item => {
            if (item.type === 'rect') {
                const x = parseFloat(item.attrs.x);
                const y = parseFloat(item.attrs.y);
                const w = parseFloat(item.attrs.width);
                const h = parseFloat(item.attrs.height);
                const fill = item.attrs.fill || 'none';
                if(fill !== 'none') {
                    pdf.setFillColor(fill);
                    pdf.rect(x, y, w, h, 'F');
                }
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
    pdf.save('architectural_blueprint_suite.pdf');
}

updateFloorMenu();
loadFloor();