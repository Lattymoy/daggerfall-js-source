// @ts-check
// PACE-DIALS (2026-10-06): THE STEPPERS - Speed and Near enemies, each on the ladder 5, 10, 20, 30, 40, 60, 100 (x100 on
// a road alone; systems/travelPace.js holds the rule). One builder for every place they stand: the Overworld's block,
// journey or none (ui/travelViewHud.js), the enhanced journey bar away from the Overworld (ui/enhancedTravelControl.js),
// and THE PACE BOX - a small box of its own for every other skin (the classic strip, GrimoireUI) while a journey runs,
// so the dials and their rule are the same in every UI, online or off.
import {
  TRAVEL_PACE_DIALS, TRAVEL_PACE_TEXT, PACE_STEPS, OPEN_PACE_MAX, paceNow, paceCanRise, paceOnRoad, stepTravelPace, onTravelPace,
} from '../systems/travelPace.js';

/**
 * Build the steppers. `cls` prefixes every class (`tview` gives `tview-pace`, `tview-pace-row`, ...). Returns the root,
 * a paint() and a dispose() that stops listening.
 * @param {Document} doc @param {string} cls
 */
export function buildPaceControls(doc, cls) {
  const el = (tag, c, text = '') => { const n = doc.createElement(tag); n.className = c; if (text) n.textContent = text; return n; };
  const root = el('div', `${cls}-pace`);
  root.setAttribute?.('role', 'group');
  root.setAttribute?.('aria-label', TRAVEL_PACE_TEXT.title);
  root.append(el('div', `${cls}-label ${cls}-pace-title`, TRAVEL_PACE_TEXT.title));
  const rows = {};
  for (const k of TRAVEL_PACE_DIALS) {
    const row = el('div', `${cls}-pace-row`);
    row.title = TRAVEL_PACE_TEXT.tip[k];
    const word = el('span', `${cls}-pace-word`, TRAVEL_PACE_TEXT[k]);
    const down = el('button', `${cls}-pace-step`, '−');
    const num = el('span', `${cls}-pace-num`, '');
    const up = el('button', `${cls}-pace-step`, '+');
    for (const [b, dir, w] of [[down, -1, TRAVEL_PACE_TEXT.slower], [up, 1, TRAVEL_PACE_TEXT.faster]]) {
      b.type = 'button';
      b.setAttribute?.('aria-label', `${w} - ${TRAVEL_PACE_TEXT[k].toLowerCase()}`);
      b.tabIndex = -1;   // never the focus: a focused button is pressed again by Space, and Space is the world's
      b.onpointerdown = (e) => e.preventDefault?.();
      b.onclick = (e) => { e.preventDefault(); e.stopPropagation?.(); stepTravelPace(k, dir); };
    }
    row.append(word, down, num, up);
    rows[k] = { row, down, up, num };
    root.append(row);
  }
  // a press in here is the dials' - never the world's swing or the map's pick
  const own = (e) => e.stopPropagation?.();
  root.addEventListener?.('mousedown', own);
  root.addEventListener?.('mouseup', own);
  root.addEventListener?.('pointerdown', own);
  const paint = () => {
    for (const k of TRAVEL_PACE_DIALS) {
      const r = rows[k], v = paceNow(k);
      const t = `×${v}`;
      if (r.num.textContent !== t) r.num.textContent = t;
      r.down.disabled = v <= PACE_STEPS[0];
      const rise = paceCanRise(k);
      r.up.disabled = !rise;
      r.up.title = !rise && !paceOnRoad() && v >= OPEN_PACE_MAX ? TRAVEL_PACE_TEXT.roadOnly : `${TRAVEL_PACE_TEXT.faster} - ${TRAVEL_PACE_TEXT[k].toLowerCase()}`;
      r.down.title = `${TRAVEL_PACE_TEXT.slower} - ${TRAVEL_PACE_TEXT[k].toLowerCase()}`;
    }
  };
  const stop = onTravelPace(paint);
  paint();
  return { root, paint, dispose: () => stop() };
}

/** The steppers' style, for any prefix. Every rule sits under `:where()` - no weight at all - so the Enhanced Plus kit
 *  (ui/enhancedFrame.js FRAME_ROLES: the presses are buttons, the number a sunk well) and its sheet always dress them,
 *  whichever order the sheets landed in: a sheet a panel lays later can never paint over the kit's stone. */
export function paceControlsCss(cls, scope = '') {
  const w = (sel) => `:where(${scope ? `${scope} ` : ''}.${cls}-${sel})`;
  return `
${w('pace')} { display: flex; flex-direction: column; gap: 6px; padding: 9px 14px 10px; }
${w('pace-title')} { padding: 0; }
${w('pace-row')} { display: grid; grid-template-columns: 1fr 30px 66px 30px; align-items: center; gap: 0; min-width: 0; }
${w('pace-word')} { padding-right: 8px; font-size: 12px; letter-spacing: 0.06em; color: var(--bone, #e9e4d9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${w('pace-num')} { height: 30px; box-sizing: border-box; display: grid; place-items: center; margin: 0 -2px; position: relative; z-index: 1;
  font-size: 16px; letter-spacing: 0.04em; font-variant-numeric: tabular-nums; color: var(--brass, #c08a3e);
  background: rgba(0,0,0,0.38); border: 1px solid rgba(192,138,62,0.4); }
${w('pace-step')} { pointer-events: auto; height: 30px; padding: 0; cursor: pointer; line-height: 1; font-family: inherit; font-size: 16px;
  color: var(--bone, #e9e4d9); background: rgba(43,50,59,0.9); border: 1px solid rgba(192,138,62,0.4); border-radius: 2px; }
${w('pace-step')}:hover:not(:disabled) { border-color: var(--verdigris, #4e7f72); color: rgb(243,239,44); }
${w('pace-step')}:disabled { cursor: default; color: #6c6552; }
`;
}

// ── THE PACE BOX: every other skin's dials, while a journey runs ─────
export const PACE_BOX_ID = 'travel-pace-box';
const PACE_BOX_STYLE_ID = 'travel-pace-box-style';
let box = null;
/** Show the box (made once, kept until hidden). Under the classic strip's top edge, at the right. */
export function showPaceBox(doc = globalThis.document) {
  if (!doc?.body) return false;
  if (box?.root?.isConnected) return true;
  if (!doc.getElementById?.(PACE_BOX_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = PACE_BOX_STYLE_ID;
    st.textContent = `${paceControlsCss('pbox')}
#${PACE_BOX_ID} { position: fixed; right: 12px; top: 64px; z-index: 30; width: 190px; pointer-events: auto; box-sizing: border-box;
  font-family: system-ui, sans-serif; background: rgba(14,16,19,0.88); border: 1px solid rgba(192,138,62,0.5); border-radius: 3px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5); }
#${PACE_BOX_ID} .pbox-label { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #9a9384; }`;
    (doc.head ?? doc.body).append(st);
  }
  box = buildPaceControls(doc, 'pbox');
  box.root.id = PACE_BOX_ID;
  doc.body.append(box.root);
  return true;
}
/** Take it down (the journey over, or the enhanced skin worn). */
export function hidePaceBox() {
  const b = box;
  if (!b) return;
  box = null;
  b.dispose();
  b.root.remove?.();
}
