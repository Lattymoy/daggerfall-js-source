// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-5 (2026-10-14) - THE UV EDITOR'S PANEL: ONE MATERIAL'S UVS OVER ITS PICTURE.
//
// Mac: "Full UV editor" (bible/06-Systems/POI-Editor-Arc.md POI-5). A dialog over the POI editor, drawn on a canvas -
// the material's picture as it is (u right, v down from its top: poi/uv/uvMesh.js's order), the square's grid, every face
// of the material, the seams red, the selection lit - over the UV editor's hands (poi/uv/uvEdit.js):
//
//   - THE POINTER: a click takes the vertex, edge, face or island under it (1 2 3 4 the modes), Shift adds and takes
//     away; a drag from empty space a box; a drag from the selection the tool's - move, turn or size about the
//     selection's centre (M T S), one step however long; the wheel zooms at the pointer, the middle button (or Alt) pans.
//   - THE TOOLS: a quarter turn either way, flip, fit to the square; mark and clear seams; unwrap; project (planar along
//     X, Y or Z, box, cylindrical, spherical); pack (its margin, turned or not); the texel density read against the
//     picture and set; undo and redo (Ctrl+Z, Ctrl+Y) of its own.
//   - APPLY: the part's mesh made again from the UVs (`onApply` - the editor uploads it by its new name, and the part
//     wears it as one step of the POI's undo); CANCEL lets it all go.
//
// Every word through the text core (L10N4); the canvas a surface of its own, the presses on it its own.
//
// Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { t } from '../../systems/textManager.js';   // L10N4: the words through the text core
import { createUvEdit } from '../../poi/uv/uvEdit.js';
import { isTextEntryTarget } from '../input.js';   // AUDIT POI U6: a key typed into the dialog's own fields is the field's

export const POI_UV_STYLE_ID = 'dfpoi-uv-style';
export const POI_UV_CSS = `
.dfpoi-uv { pointer-events: auto; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(860px, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow: auto; padding: 8px; background: rgba(14, 16, 19, .97); border: 1px solid #6b5230; border-radius: 6px; display: flex; flex-direction: column; gap: 6px; }
.dfpoi-uv-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.dfpoi-uv-canvas { width: 100%; aspect-ratio: 1 / 1; max-height: calc(100vh - 200px); background: #121212; border: 1px solid #4b3c27; touch-action: none; cursor: crosshair; }
`;
export function injectPoiUvStyle(doc = document) {
  if (doc.getElementById?.(POI_UV_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = POI_UV_STYLE_ID;
  el.textContent = POI_UV_CSS;
  (doc.head ?? doc.body).append(el);
}

/** The view: UV (0 - 1) to canvas pixels and back, zoomed about a point and panned. */
export function uvView(w, h) {
  const v = { zoom: 0.8, cu: 0.5, cv: 0.5, w, h };
  const k = () => Math.min(v.w, v.h) * v.zoom;
  return {
    get state() { return { ...v }; },
    resize(nw, nh) { v.w = nw; v.h = nh; },
    toPx: (u, vv) => [v.w / 2 + (u - v.cu) * k(), v.h / 2 + (vv - v.cv) * k()],
    toUv: (x, y) => [v.cu + (x - v.w / 2) / k(), v.cv + (y - v.h / 2) / k()],
    /** Zoom by `f` keeping the UV point under (x, y) where it is. */
    zoomAt(x, y, f) {
      const before = [v.cu + (x - v.w / 2) / k(), v.cv + (y - v.h / 2) / k()];
      v.zoom = Math.min(64, Math.max(0.05, v.zoom * f));
      v.cu = before[0] - (x - v.w / 2) / k(); v.cv = before[1] - (y - v.h / 2) / k();
    },
    panPx(dx, dy) { v.cu -= dx / k(); v.cv -= dy / k(); },
    /** A length of `px` canvas pixels in UV. */
    uvOfPx: (px) => px / k(),
  };
}

/**
 * @param {{
 *   doc?: Document, mesh: any, sub?: number, materials: number, title: string,
 *   picture?: Promise<{ width: number, height: number, data: Uint8Array | Uint8ClampedArray } | null>,
 *   onApply: (mesh: any) => (Promise<boolean> | boolean), onClose: () => void,
 * }} deps `materials` how many the part has (the selector's choices); `picture` the material's, decoded
 */
export function createPoiUvPanel({ doc = document, mesh, sub = 0, materials, title, picture = Promise.resolve(null), onApply, onClose }) {
  injectPoiUvStyle(doc);
  const ed = createUvEdit(mesh, { sub });
  const el = (tag, cls = '', text = null) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const btn = (text, fn, title2 = '') => { const b = el('button', 'dfpoi-btn', text); b.type = 'button'; if (title2) b.title = title2; b.addEventListener('click', (e) => { e.stopPropagation?.(); fn(); draw(); }); return b; };
  const root = el('div', 'dfpoi-uv');
  for (const ty of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'contextmenu', 'touchstart', 'keydown', 'keyup']) root.addEventListener(ty, (e) => e.stopPropagation?.());
  root.tabIndex = 0;
  const canvas = /** @type {HTMLCanvasElement} */ (el('canvas', 'dfpoi-uv-canvas'));
  canvas.width = 640; canvas.height = 640;
  const view = uvView(canvas.width, canvas.height);
  /** @type {'move' | 'turn' | 'size'} */
  let tool = 'move';
  let pic = null, picW = 0, picH = 0;
  let margin = 0.01, rotate = true;
  const status = el('div', '');
  const say = (text) => { status.textContent = text; };

  // ── THE BARS ─────────────────────────────────────────────────────
  const modeBtns = {};
  const modes = el('div', 'dfpoi-uv-row');
  for (const [m, key, text] of [['vertex', '1', t('poi.uv.vertex', 'Vertex')], ['edge', '2', t('poi.uv.edge', 'Edge')], ['face', '3', t('poi.uv.face', 'Face')], ['island', '4', t('poi.uv.island', 'Island')]]) {
    modeBtns[m] = btn(`${text} (${key})`, () => ed.setMode(/** @type {any} */ (m)));
    modes.append(modeBtns[m]);
  }
  const toolBtns = {};
  for (const [m, key, text] of [['move', 'M', t('poi.uv.move', 'Move')], ['turn', 'T', t('poi.uv.turn', 'Turn')], ['size', 'S', t('poi.uv.size', 'Size')]]) {
    toolBtns[m] = btn(`${text} (${key})`, () => { tool = /** @type {any} */ (m); });
    modes.append(toolBtns[m]);
  }
  const sel = el('select');
  for (let i = 0; i < materials; i++) { const o = el('option', '', t('poi.where.material', 'material {n}', { n: i + 1 })); o.value = String(i); sel.append(o); }
  sel.value = String(sub);
  sel.addEventListener('change', () => { ed.setSubmesh(Number(sel.value)); draw(); });
  modes.append(sel);

  const tools = el('div', 'dfpoi-uv-row');
  const undoBtn = btn(t('poi.editor.undo', 'Undo'), () => ed.undo());
  const redoBtn = btn(t('poi.editor.redo', 'Redo'), () => ed.redo());
  tools.append(
    btn(t('poi.uv.turnLeft', 'Turn left 90'), () => ed.transform({ turn: 90 })),
    btn(t('poi.uv.turnRight', 'Turn right 90'), () => ed.transform({ turn: -90 })),
    btn(t('poi.uv.flipU', 'Flip across'), () => ed.flip('u')), btn(t('poi.uv.flipV', 'Flip up and down'), () => ed.flip('v')),
    btn(t('poi.uv.fit', 'Fit to the square'), () => ed.fit()),
    btn(t('poi.uv.markSeam', 'Mark seam'), () => { if (!ed.seams(true)) say(t('poi.uv.seamHint', 'Select edges first (2).')); }),
    btn(t('poi.uv.clearSeam', 'Clear seam'), () => { if (!ed.seams(false)) say(t('poi.uv.seamHint', 'Select edges first (2).')); }),
    // AUDIT POI M13 (the lead's wiring): the unwrap off the page's thread (poi/uv/uvEdit.js unwrapOffThread) - the dialog
    // paints and pans while it works; its answer lands as one step, and is let go if the dialog closed meanwhile
    btn(t('poi.uv.unwrap', 'Unwrap'), () => {
      if (ed.busy()) return;
      say(t('poi.uv.unwrapping', 'Unwrapping...'));
      draw();
      ed.unwrapOffThread().then((n) => {
        if (closed) return;
        say(t('poi.uv.unwrapped', 'Unwrapped {n, plural, one {# island} other {# islands}}.', { n }));
        draw();
      });
    }, t('poi.uv.unwrapHint', 'Lays the selection flat, keeping its angles. Marked seams are cut open.')),
    undoBtn, redoBtn,
  );
  const proj = el('div', 'dfpoi-uv-row');
  proj.append(el('span', '', t('poi.uv.project', 'Project:')),
    btn(t('poi.uv.planarX', 'along X'), () => ed.project('x')), btn(t('poi.uv.planarY', 'along Y'), () => ed.project('y')), btn(t('poi.uv.planarZ', 'along Z'), () => ed.project('z')),
    btn(t('poi.uv.box', 'Box'), () => ed.project('box')), btn(t('poi.uv.cylinder', 'Cylinder'), () => ed.project('cylinder', 'y')), btn(t('poi.uv.sphere', 'Sphere'), () => ed.project('sphere')));
  const pack = el('div', 'dfpoi-uv-row');
  const marginIn = el('input'); marginIn.type = 'number'; marginIn.step = '0.005'; marginIn.min = '0'; marginIn.max = '0.2'; marginIn.value = String(margin); marginIn.title = t('poi.uv.margin', 'Margin around each island (a fraction of the square)');
  marginIn.addEventListener('change', () => { const v = Number(marginIn.value); if (v >= 0 && v <= 0.2) margin = v; });
  const rot = el('input'); rot.type = 'checkbox'; rot.checked = rotate; rot.addEventListener('change', () => { rotate = !!rot.checked; });
  const densityOut = el('span', '');
  const densityIn = el('input'); densityIn.type = 'number'; densityIn.step = '1'; densityIn.min = '1'; densityIn.value = '256';
  // AUDIT POI M9: a pack that cannot fit moves nothing and is no step (poi/uv/uvMesh.js packIslands) - and says so
  pack.append(btn(t('poi.uv.pack', 'Pack'), () => { if (!ed.pack({ margin, rotate })) say(t('poi.uv.packNoRoom', 'The islands do not fit in the square at that margin. Nothing was moved. Try a smaller margin.')); }), marginIn, el('label', '', t('poi.uv.packTurn', 'turn islands')), rot,
    el('span', 'dfpoi-sep'), densityOut, densityIn,
    btn(t('poi.uv.setDensity', 'Set density'), () => { if (picW) ed.setDensity(Number(densityIn.value) || 256, picW, picH); else say(t('poi.uv.noPicture', 'This material has no picture, so there are no pixels to set a density by.')); }));
  const acts = el('div', 'dfpoi-uv-row');
  let applying = false;
  const apply = btn(t('poi.uv.apply', 'Apply to the part'), async () => {
    if (applying || ed.busy()) return;   // AUDIT POI M13: never the UVs from before an unwrap still out
    applying = true; draw();
    const ok = await onApply(ed.result());
    applying = false;
    if (ok) close(); else draw();
  });
  acts.append(apply, btn(t('poi.editor.cancel', 'Cancel'), () => close()), status);
  root.append(el('div', 'dfpoi-h', title), modes, tools, proj, pack, canvas, acts);

  // ── THE DRAWING ──────────────────────────────────────────────────
  const ctx = canvas.getContext('2d');
  function draw() {
    for (const [m, b] of Object.entries(modeBtns)) b.setAttribute('aria-pressed', String(ed.mode() === m));
    for (const [m, b] of Object.entries(toolBtns)) b.setAttribute('aria-pressed', String(tool === m));
    undoBtn.disabled = !ed.canUndo(); redoBtn.disabled = !ed.canRedo();
    apply.disabled = applying || ed.busy();
    densityOut.textContent = picW ? t('poi.uv.density', '{px, number} px/m', { px: Math.round(ed.density(picW, picH)) }) : '';
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#121212'; ctx.fillRect(0, 0, W, H);
    const [x0, y0] = view.toPx(0, 0), [x1, y1] = view.toPx(1, 1);
    if (pic) ctx.drawImage(pic, x0, y0, x1 - x0, y1 - y0);
    else { ctx.fillStyle = '#2a2620'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
    ctx.strokeStyle = 'rgba(216, 183, 122, .35)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const [ax, ay] = view.toPx(i / 8, 0), [bx, by] = view.toPx(i / 8, 1); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const [cx, cy] = view.toPx(0, i / 8), [dx, dy] = view.toPx(1, i / 8); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();
    }
    const selSet = ed.selection(), mode = ed.mode();
    const litFaces = mode === 'face' || mode === 'island' ? selSet : new Set();
    for (const f of ed.faces()) {
      const p = ed.faceUvs(f).map(([u, v]) => view.toPx(u, v));
      if (litFaces.has(f)) {
        ctx.fillStyle = 'rgba(255, 170, 60, .35)';
        ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 3; i++) {
        const lit = mode === 'edge' && selSet.has(f * 3 + i);
        ctx.strokeStyle = lit ? '#ffb43c' : ed.isSeam(f, i) ? '#e0483c' : 'rgba(240, 240, 240, .8)';
        ctx.lineWidth = lit || ed.isSeam(f, i) ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(p[i][0], p[i][1]); ctx.lineTo(p[(i + 1) % 3][0], p[(i + 1) % 3][1]); ctx.stroke();
      }
    }
    // the selected vertices lit - none when none is selected (selectedCorners() is the whole material then, for the tools)
    if (mode === 'vertex' && ed.selection().size) {
      ctx.fillStyle = '#ffb43c';
      for (const c of ed.selectedCorners()) { const [u, v] = [ed.session.cornerUv[c * 2], ed.session.cornerUv[c * 2 + 1]]; const [x, y] = view.toPx(u, v); ctx.fillRect(x - 2.5, y - 2.5, 5, 5); }
    }
    if (boxDrag) {
      ctx.strokeStyle = '#ffffff'; ctx.setLineDash?.([4, 3]);
      ctx.strokeRect(boxDrag.x0, boxDrag.y0, boxDrag.x - boxDrag.x0, boxDrag.y - boxDrag.y0);
      ctx.setLineDash?.([]);
    }
  }
  picture.then((im) => {
    if (!im) return;
    picW = im.width; picH = im.height;
    try {
      const c = /** @type {HTMLCanvasElement} */ (doc.createElement('canvas'));
      c.width = im.width; c.height = im.height;
      const cx = c.getContext('2d');
      const data = cx?.createImageData(im.width, im.height);
      if (cx && data) { data.data.set(im.data); cx.putImageData(data, 0, 0); pic = c; }
    } catch (e) { console.warn('[poi] the UV editor\'s picture', e); }
    draw();
  }, () => {});

  // ── THE POINTER ──────────────────────────────────────────────────
  let boxDrag = null, pan = null, toolDrag = null;
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / Math.max(1, r.width)) * canvas.width, ((e.clientY - r.top) / Math.max(1, r.height)) * canvas.height];
  };
  const reach = () => view.uvOfPx(6);
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    const [x, y] = at(e);
    if (e.button === 1 || e.altKey) { pan = { x, y }; return; }
    if (e.button !== 0) return;
    const [u, v] = view.toUv(x, y);
    // a press on the selection: the tool's drag; elsewhere, a click or a box
    const before = ed.selection();
    const hit = before.size ? hitsSelection(u, v) : false;
    if (hit) { ed.begin(); toolDrag = { x, y, pivot: view.toPx(...ed.pivot()) }; return; }
    boxDrag = { x0: x, y0: y, x, y, shift: !!e.shiftKey };
  });
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = at(e);
    if (pan) { view.panPx(x - pan.x, y - pan.y); pan = { x, y }; draw(); return; }
    if (toolDrag) {
      const d = [view.uvOfPx(x - toolDrag.x), view.uvOfPx(y - toolDrag.y)];
      if (tool === 'move') ed.drag({ move: d });
      else {
        const [px, py] = toolDrag.pivot;
        const a0 = Math.atan2(toolDrag.y - py, toolDrag.x - px), a1 = Math.atan2(y - py, x - px);
        const r0 = Math.hypot(toolDrag.x - px, toolDrag.y - py), r1 = Math.hypot(x - px, y - py);
        if (tool === 'turn') ed.drag({ turn: (-(a1 - a0) * 180) / Math.PI });
        else { const k = r0 > 1 ? r1 / r0 : 1; ed.drag({ scale: [k, k] }); }
      }
      draw();
      return;
    }
    if (boxDrag) { boxDrag.x = x; boxDrag.y = y; draw(); }
  });
  canvas.addEventListener('pointerup', (e) => {
    const [x, y] = at(e);
    if (pan) { pan = null; return; }
    if (toolDrag) { ed.end(); toolDrag = null; draw(); return; }
    if (boxDrag) {
      const b = boxDrag; boxDrag = null;
      if (Math.hypot(x - b.x0, y - b.y0) < 4) { const [u, v] = view.toUv(x, y); ed.pick(u, v, reach(), b.shift); }
      else { const [u0, v0] = view.toUv(b.x0, b.y0), [u1, v1] = view.toUv(x, y); ed.box(u0, v0, u1, v1, b.shift); }
      draw();
    }
  });
  canvas.addEventListener('wheel', (e) => { const [x, y] = at(e); view.zoomAt(x, y, e.deltaY < 0 ? 1.15 : 1 / 1.15); e.preventDefault?.(); draw(); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault?.());
  /** Is the UV point on the selection (a selected face under it, or near a selected vertex or edge)? */
  function hitsSelection(u, v) {
    const s = ed.selection(), m = ed.mode(), r = reach();
    if (m === 'face' || m === 'island') return [...s].some((f) => { const [a, b, c] = ed.faceUvs(f); return inTriangle([u, v], a, b, c); });
    return ed.selectedCorners().some((c) => Math.hypot(ed.session.cornerUv[c * 2] - u, ed.session.cornerUv[c * 2 + 1] - v) <= r * 2);
  }
  root.addEventListener('keydown', (e) => {
    // AUDIT POI U6: the margin's and the density's fields keep what is typed into them - "256" was "56" (the 2 the edge
    // mode), Ctrl+A every UV and not the field's text, Ctrl+Z the UVs' undo
    if (isTextEntryTarget(e.target)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.code === 'KeyZ') { if (e.shiftKey) ed.redo(); else ed.undo(); }
    else if (mod && e.code === 'KeyY') ed.redo();
    else if (mod && e.code === 'KeyA') ed.selectAll();
    else if (e.code === 'Digit1') ed.setMode('vertex');
    else if (e.code === 'Digit2') ed.setMode('edge');
    else if (e.code === 'Digit3') ed.setMode('face');
    else if (e.code === 'Digit4') ed.setMode('island');
    else if (e.code === 'KeyM') tool = 'move';
    else if (e.code === 'KeyT') tool = 'turn';
    else if (e.code === 'KeyS' && !mod) tool = 'size';
    else if (e.code === 'Escape') { if (ed.dragging()) ed.cancel(); else ed.clear(); }
    else return;
    e.preventDefault?.();
    draw();
  });

  // AUDIT POI U7: closed once - Cancel, then the Apply that answers after it, close one dialog and tell the editor once (a
  // second word let go of its handle to a UV editor opened since, and dialogs stacked); `closed` says so to the Apply out
  let closed = false;
  function close() { if (closed) return; closed = true; ed.dispose(); root.remove?.(); onClose(); }   // the unwrap's worker let go (M13)
  draw();
  return { root, edit: ed, view, draw, close, closed: () => closed, setTool: (m) => { tool = m; draw(); } };
}

function inTriangle(p, a, b, c) {
  const s1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const s2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]);
  const s3 = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0]);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}
