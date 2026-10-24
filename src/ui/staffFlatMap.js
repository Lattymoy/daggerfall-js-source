// @ts-check
// STAFF-FLATMAP (2026-10-24, mob: "did u get the flat map done?", "make sure the overwolrd map and flat map works"; design
// doc "DFO Staff Panel: design", Flat map - mob 2026-10-22: "flat map work per region?", "then we can just select
// regions?", a third in-game view, top-down per region to save FPS, dots red/grey, the Most urgent list) - THE FLAT MAP'S
// SCREEN, which scenes/staffFlatMapHost.js fills. A fixed sheet over the game: a head (the region's name, the previous
// and next region, Close), the region drawn from above off the politic map (its own map pixels bright, its neighbours
// dim, the sea dark), a dot a traveller - red, amber or grey by their most urgent flag, the staff member's own in cyan -
// with their name beside it, and at the right the Most urgent list, most urgent first. A dot's or a row's press is the
// host's (`onPick`, its menu); the sheet's presses never reach the world. Drawn again only when what it shows changed.
import { PIXEL_FONT_CSS, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';
import { STAFF_TAG_COLORS } from './staffTags.js';
import { t } from '../systems/textManager.js';

const SHEET_CSS = `position:fixed;inset:4% 4%;z-index:14;display:flex;flex-direction:column;${PIXEL_FONT_CSS}font-size:13px;color:${STAFF_TAG_COLORS.name};background:rgba(10,12,15,0.95);border:1px solid rgba(127,227,240,0.45);border-radius:4px;text-shadow:${PIXEL_TEXT_SHADOW};pointer-events:auto;`;
const HEAD_CSS = 'display:flex;gap:8px;align-items:center;padding:6px 10px;border-bottom:1px solid rgba(127,227,240,0.25);';
const BODY_CSS = 'display:flex;flex:1;min-height:0;';
const LIST_CSS = 'width:240px;overflow-y:auto;border-left:1px solid rgba(127,227,240,0.25);padding:6px 8px;';
const BTN_CSS = `${PIXEL_FONT_CSS}font-size:13px;color:${STAFF_TAG_COLORS.plain};background:rgba(127,227,240,0.12);border:1px solid rgba(127,227,240,0.45);border-radius:3px;padding:1px 8px;cursor:pointer;text-shadow:${PIXEL_TEXT_SHADOW};`;
const ROW_CSS = `display:block;width:100%;text-align:left;${PIXEL_FONT_CSS}font-size:12px;color:${STAFF_TAG_COLORS.name};background:none;border:0;border-bottom:1px solid rgba(127,227,240,0.1);padding:3px 0;cursor:pointer;text-shadow:${PIXEL_TEXT_SHADOW};`;
/** A dot's colour by its most urgent flag; the staff member's own. */
export const FLAT_DOT = Object.freeze({ high: STAFF_TAG_COLORS.high, medium: STAFF_TAG_COLORS.medium, low: STAFF_TAG_COLORS.low, none: '#c8c8c8', me: '#7FE3F0' });
/** The land's colours: the region's own map pixels, a neighbour's, the sea. */
const LAND = Object.freeze({ own: [74, 92, 70], other: [36, 40, 38], sea: [14, 22, 34] });
/** How near a press must be to a dot to be its (px). */
export const FLAT_PICK_PX = 10;

/**
 * @param {{ doc?: any, onPick: (id: string, at: { x: number, y: number }) => void, onRegion: (step: number) => void, onClose: () => void }} deps
 */
export function createStaffFlatMap({ doc = globalThis.document, onPick, onRegion, onClose }) {
  if (!doc?.createElement || !doc.body) return { show() {}, hide() {}, open: () => false, dispose() {} };
  let sheet = /** @type {any} */ (null), title = /** @type {any} */ (null), hint = /** @type {any} */ (null), cv = /** @type {any} */ (null), list = /** @type {any} */ (null);
  let shown = false, sig = '', landKey = '', land = /** @type {any} */ (null);
  /** @type {Array<{ id: string, x: number, y: number }>} where each dot was drawn, for a press */
  let dots = [];
  const stop = (/** @type {any} */ n) => { for (const k of ['pointerdown', 'mousedown', 'click', 'wheel']) n.addEventListener?.(k, (/** @type {any} */ e) => e.stopPropagation?.()); };
  const button = (/** @type {string} */ text, /** @type {string} */ data, /** @type {() => void} */ run) => {
    const b = doc.createElement('button');
    b.setAttribute('type', 'button');
    b.setAttribute(data, '');
    b.style.cssText = BTN_CSS;
    b.textContent = text;
    b.addEventListener?.('click', (/** @type {any} */ e) => { e.stopPropagation?.(); e.preventDefault?.(); run(); });
    return b;
  };
  function make() {
    sheet = doc.createElement('div');
    sheet.setAttribute('data-staff-flat-map', '');
    sheet.style.cssText = SHEET_CSS;
    stop(sheet);
    const head = doc.createElement('div');
    head.style.cssText = HEAD_CSS;
    title = doc.createElement('span');
    title.style.flex = '1';
    hint = doc.createElement('span');
    hint.style.color = STAFF_TAG_COLORS.plain;
    head.append(button('◀', 'data-flat-prev', () => onRegion(-1)), title, hint, button('▶', 'data-flat-next', () => onRegion(1)), button(t('net.staffFlat.close', 'Close'), 'data-flat-close', onClose));
    const body = doc.createElement('div');
    body.style.cssText = BODY_CSS;
    cv = doc.createElement('canvas');
    cv.setAttribute('data-flat-canvas', '');
    cv.style.cssText = 'flex:1;min-width:0;cursor:pointer;';
    cv.addEventListener?.('click', (/** @type {any} */ e) => {
      const r = cv.getBoundingClientRect?.() ?? { left: 0, top: 0 };
      const x = Number(e?.clientX) - r.left, y = Number(e?.clientY) - r.top;
      let best = null, bd = FLAT_PICK_PX;
      for (const d of dots) { const dd = Math.hypot(d.x - x, d.y - y); if (dd <= bd) { bd = dd; best = d; } }
      if (best) onPick(best.id, { x: Number(e?.clientX) || 0, y: Number(e?.clientY) || 0 });
    });
    list = doc.createElement('div');
    list.setAttribute('data-flat-list', '');
    list.style.cssText = LIST_CSS;
    body.append(cv, list);
    sheet.append(head, body);
    doc.body.append(sheet);
  }
  /** The region's land, map pixel by map pixel over its box (with a margin), drawn once a region. */
  function landOf(/** @type {any} */ v) {
    const key = `${v.region}|${v.box.x0},${v.box.y0},${v.box.x1},${v.box.y1}`;
    if (key === landKey) return land;
    landKey = key;
    const w = v.box.x1 - v.box.x0 + 1, h = v.box.y1 - v.box.y0 + 1;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = v.landAt(v.box.x0 + x, v.box.y0 + y);
      const c = k === 'own' ? LAND.own : k === 'sea' ? LAND.sea : LAND.other;
      const i = (y * w + x) * 4;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
    }
    land = { w, h, px };
    return land;
  }
  function draw(/** @type {any} */ v) {
    const W = Math.max(1, Math.round(cv.clientWidth || 600)), H = Math.max(1, Math.round(cv.clientHeight || 400));
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    const g = cv.getContext?.('2d');
    dots = [];
    if (!g) return;
    g.fillStyle = 'rgb(14,22,34)';
    g.fillRect(0, 0, W, H);
    if (!v.box) return;
    const L = landOf(v);
    const k = Math.min(W / L.w, H / L.h);
    const ox = (W - L.w * k) / 2, oy = (H - L.h * k) / 2;
    if (typeof doc.createElement === 'function' && typeof globalThis.ImageData === 'function') {
      const off = doc.createElement('canvas');
      off.width = L.w; off.height = L.h;
      off.getContext?.('2d')?.putImageData?.(new globalThis.ImageData(L.px, L.w, L.h), 0, 0);
      g.imageSmoothingEnabled = false;
      g.drawImage?.(off, ox, oy, L.w * k, L.h * k);
    }
    const at = (/** @type {number} */ px, /** @type {number} */ py) => [ox + (px - v.box.x0) * k, oy + (py - v.box.y0) * k];
    g.font = '12px sans-serif';
    for (const p of v.players) {
      const [x, y] = at(p.px, p.py);
      dots.push({ id: p.id, x, y });
      g.fillStyle = FLAT_DOT[/** @type {keyof typeof FLAT_DOT} */ (p.level || 'none')] ?? FLAT_DOT.none;
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
      g.fillText(p.line ? `${p.name} - ${p.line}` : p.name, x + 7, y - 5);
    }
    if (v.me) {
      const [x, y] = at(v.me.x, v.me.y);
      g.strokeStyle = FLAT_DOT.me; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.stroke();
    }
  }
  function rows(/** @type {any[]} */ players) {
    const head = doc.createElement('div');
    head.textContent = t('net.staffFlat.urgent', 'Most urgent');
    head.style.cssText = 'font-weight:bold;margin-bottom:4px;';
    const out = [head];
    for (const p of players) {
      const b = doc.createElement('button');
      b.setAttribute('type', 'button');
      b.setAttribute('data-flat-row', p.id);
      b.style.cssText = ROW_CSS;
      const name = doc.createElement('span'), words = doc.createElement('span');
      name.style.display = 'block'; words.style.display = 'block';
      name.textContent = p.name;
      words.textContent = p.line || t('net.staffFlat.noFlag', 'no flag');
      words.style.color = FLAT_DOT[/** @type {keyof typeof FLAT_DOT} */ (p.level || 'none')] ?? FLAT_DOT.none;
      b.append(name, words);
      b.addEventListener?.('click', (/** @type {any} */ e) => { e.stopPropagation?.(); e.preventDefault?.(); onPick(p.id, { x: Number(e?.clientX) || 0, y: Number(e?.clientY) || 0 }); });
      out.push(b);
    }
    if (!players.length) { const none = doc.createElement('div'); none.textContent = t('net.staffFlat.nobody', 'Nobody with a position here right now.'); none.style.color = STAFF_TAG_COLORS.plain; out.push(none); }
    list.replaceChildren(...out);
  }
  return {
    /** The sheet this frame: `v` { region, name, hint, box: { x0, y0, x1, y1 } | null, landAt(x, y) -> 'own'|'other'|'sea',
     *  players: [{ id, name, line, level, px, py }] most urgent first, me: { x, y } | null }. @param {any} v */
    show(v) {
      if (!sheet) make();
      if (!shown) { shown = true; sheet.style.display = 'flex'; sig = ''; }
      const s = JSON.stringify([v.region, v.name, v.hint, v.box, v.players, v.me, cv.clientWidth, cv.clientHeight]);
      if (s === sig) return;
      sig = s;
      title.textContent = t('net.staffFlat.title', 'Region map - {name}', { name: v.name ?? '' });
      hint.textContent = v.hint ?? '';
      draw(v);
      rows(v.players);
    },
    hide() { if (sheet && shown) { shown = false; sheet.style.display = 'none'; } },
    open: () => shown,
    dispose() { sheet?.remove(); sheet = null; shown = false; landKey = ''; land = null; },
  };
}
