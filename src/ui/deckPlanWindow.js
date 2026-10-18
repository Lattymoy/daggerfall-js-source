// @ts-check
// DECK-PROPS (2026-10-17, the owner: "Allowing prop placement on the ship itself"; bible/03-World/Naval-Refit.md
// DECK-PROPS) - THE PLAN OF HER DECK: her open deck from above (systems/naval/navalDeck.js - her walkable cells, her
// bow up), her fittings on it (systems/naval/deckFittings.js), and the fittings to set there. Opened from the Fleet
// page's Deck (scenes/deckPlanDoor.js, through the sea's window door), over the world.
//
// WHAT A CAPTAIN DOES HERE: chooses a fitting from the list and clicks her deck to set it there (a place that is no deck
// of hers, or too near another, refused with why); clicks a fitting to take it up, drags it to move it, turns it a
// sixteenth of a turn at a time (Q and E, or the buttons), takes it away (Delete); and Fits her out - the ledger keeps
// them (scenes/fleetHost.js `deck`), and every player who sights her sees them, stood in her own tree. Close leaves her
// as she was.
import { t } from '../systems/textManager.js';
import { boxesMeet } from '../systems/naval/shipLife.js';   // AUDIT 2: two turned boxes' overlap - the berths' own law (QUAY-CROSSING)
import { DECK_FITTINGS, DECK_FITTINGS_MAX, FITTING_GAP, YAW_STEPS, fittingsOf, fittingKind } from '../systems/naval/deckFittings.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhanced/enhancedStyle.js';

export const DECK_PLAN_STYLE_ID = 'deck-plan-style';
export const DECK_PLAN_CSS = `
.dpw-root { position: fixed; inset: 0; z-index: 13; display: flex; align-items: center; justify-content: center; background: rgba(4,6,10,0.72); font-family: var(--data); }
.dpw-box { display: flex; flex-direction: column; gap: 8px; width: min(1040px, calc(100vw - 32px)); height: min(760px, calc(100vh - 32px)); padding: 14px 16px; box-sizing: border-box; color: #e9e4d9; }
.dpw-box h2 { margin: 0; font-family: var(--display); font-size: 22px; color: #f3cf86; }
.dpw-body { display: flex; gap: 12px; min-height: 0; flex: 1 1 auto; }
.dpw-plan { flex: 1 1 auto; min-width: 220px; min-height: 220px; width: 100%; height: 100%; background: #0b1622; border: 1px solid rgba(201,176,120,0.35); touch-action: none; cursor: crosshair; }
.dpw-side { width: 230px; display: flex; flex-direction: column; gap: 6px; min-height: 0; }
.dpw-list { overflow-y: auto; flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px; }
.dpw-list button { text-align: left; font: inherit; font-size: 13px; padding: 4px 8px; color: #e9e4d9; background: rgba(255,255,255,0.04); border: 1px solid transparent; cursor: pointer; }
.dpw-list button.on { border-color: #f3cf86; color: #f3cf86; }
.dpw-say { min-height: 18px; font-size: 13px; color: #c2b79a; }
.dpw-say.no { color: #ffb4a6; }
.dpw-acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.dpw-acts button { font: inherit; font-size: 13px; letter-spacing: 0.04em; padding: 6px 12px; cursor: pointer; }
@media (max-width: 640px) { .dpw-box { padding: 10px 12px; } .dpw-body { flex-direction: column; } .dpw-plan { flex: 1 1 40%; } .dpw-side { width: auto; flex: 0 1 auto; max-height: 34vh; } }
`;

const el = (doc, tag, cls = null, text = null) => {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
/** A fitting's name: its kind's word - the game's, as the decorator names the same piece - and its number among its kind
 *  (in id order, as the decorator numbers them). */
export function fittingName(m) {
  const kind = fittingKind(m);
  const n = DECK_FITTINGS.filter(([, k]) => k === kind).findIndex(([id]) => id === m) + 1;
  return kind === 'chest' ? t('naval.deck.chest', 'Chest {n}', { n }) : t('naval.deck.crate', 'Crate {n}', { n });
}
/** AUDIT 2: a fitting's box on her deck - centred on (x, z), `fp` [width, depth], turned `yaw` steps (a step turns its
 *  front, +z, toward her starboard, +x) - its four corners in her frame, drawn in by FIT_INSET. Pure. */
export function fittingCorners(x, z, yaw, fp) {
  const a = ((Number(yaw) || 0) / YAW_STEPS) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
  const hw = Math.max(0, fp[0] / 2 - FIT_INSET), hd = Math.max(0, fp[1] / 2 - FIT_INSET);
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
}
/** AUDIT 2: how far a box's corners are drawn in before they are read (m) - a crate flush with her rail stands. */
export const FIT_INSET = 0.05;
/** Why `at` (her frame's x, z) cannot take a fitting - null where it can: her deck there, room from every other
 *  (`others`, the fitting being moved left out by the caller). AUDIT 2: with `me` (`{ m, yaw }` and `footprint(m)`, a
 *  model's box), its whole box - every corner on her deck (a crate hung over her rail stood there) and clear of every
 *  other's (two set into each other did); the centres FITTING_GAP apart still, for a model whose box is not in. Pure.
 * @param {any} deck @param {number[]} at @param {any[]} others @param {{ m: number, yaw: number } | null} [me]
 * @param {(m: number) => number[] | null} [footprint]
 */
export function placeRefusal(deck, at, others, me = null, footprint = () => null) {
  if (!deck?.walkable?.(at[0], at[1])) return t('naval.deck.offDeck', 'That spot isn\'t on the open deck.');
  if (others.some((f) => Math.hypot(f.x - at[0], f.z - at[1]) < FITTING_GAP)) return t('naval.deck.crowded', 'Too close to another fitting.');
  const fp = me ? footprint(me.m) : null;
  if (!fp) return null;
  const box = fittingCorners(at[0], at[1], me.yaw, fp);
  if (!box.every(([x, z]) => deck.walkable(x, z))) return t('naval.deck.offDeck', 'That spot isn\'t on the open deck.');
  if (others.some((f) => { const o = footprint(f.m); return !!o && boxesMeet(box, fittingCorners(f.x, f.z, f.yaw, o)); })) return t('naval.deck.crowded', 'Too close to another fitting.');
  return null;
}

/**
 * @param {HTMLElement} host
 * @param {{ name: string, deck: any, fittings: any[], footprint?: (m: number) => number[] | null, save: (list: any[]) => { ok: boolean, text: string },
 *   onExit?: (reason?: string) => void, doc?: Document }} deps - `footprint(m)` a model's box `[width, depth]` (metres), null
 *   while it loads
 */
export function mountDeckPlanWindow(host, { name, deck, fittings, footprint = () => null, save, onExit = () => {}, doc = document }) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  if (doc.getElementById && !doc.getElementById(DECK_PLAN_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = DECK_PLAN_STYLE_ID;
    st.textContent = DECK_PLAN_CSS;
    doc.head?.appendChild(st);
  }
  let list = fittingsOf(fittings).map((f) => ({ ...f }));
  let chosen = DECK_FITTINGS[0][0];   // the fitting a click on her deck sets
  let picked = -1;   // the fitting taken up (its index), -1 none
  let dragging = false;
  let dead = false;

  const root = el(doc, 'div', 'dpw-root');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  const box = el(doc, 'div', 'dpw-box');
  box.setAttribute('data-grim', 'wood');
  const title = el(doc, 'h2', null, t('naval.deck.title', 'Deck - {name}', { name }));
  const body = el(doc, 'div', 'dpw-body');
  const canvas = /** @type {HTMLCanvasElement} */ (el(doc, 'canvas', 'dpw-plan'));
  canvas.setAttribute('aria-label', t('naval.deck.planAria', 'Deck plan, top view'));
  const side = el(doc, 'div', 'dpw-side');
  const count = el(doc, 'div', 'dpw-say');
  const listBox = el(doc, 'div', 'dpw-list');
  const say = el(doc, 'div', 'dpw-say');
  say.setAttribute('role', 'status');
  const btn = (label, fn, cls = 'act') => { const b = el(doc, 'button', cls, label); b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
  const turnL = btn(t('naval.deck.turnLeft', 'Turn left (Q)'), () => turn(-1));
  const turnR = btn(t('naval.deck.turnRight', 'Turn right (E)'), () => turn(1));
  const remove = btn(t('naval.deck.remove', 'Remove (Del)'), () => takeAway());
  const tools = el(doc, 'div', 'dpw-acts');
  tools.append(turnL, turnR, remove);
  side.append(count, listBox, tools);
  body.append(canvas, side);
  const acts = el(doc, 'div', 'dpw-acts');
  acts.append(btn(t('naval.deck.clearAll', 'Clear deck'), () => { list = []; picked = -1; tell(t('naval.deck.cleared', 'All fittings removed. Click Save layout to keep this.')); }),
    btn(t('naval.flag.close', 'Close'), () => close()), btn(t('naval.deck.save', 'Save layout'), () => keep(), 'act primary'));
  box.append(title, body, say, acts);
  root.append(box);
  host.append(root);

  function tell(text, no = false) { say.textContent = text; say.classList.toggle('no', no); draw(); }
  function drawList() {
    const items = DECK_FITTINGS.map(([m]) => {
      const b = el(doc, 'button', m === chosen ? 'on' : null, fittingName(m));
      b.setAttribute('aria-pressed', m === chosen ? 'true' : 'false');
      b.onclick = () => { chosen = m; picked = -1; drawList(); tell(t('naval.deck.choose', 'Click the deck to place {what}.', { what: fittingName(m) })); };
      return b;
    });
    listBox.replaceChildren(...items);
  }

  // ── the plan's frame: her deck's cells to the canvas, seen from above (her frame's x to starboard, z to her bow - the
  // world's east and north at her heading 0) - her bow up, or laid bow to the right where that draws her larger (a long
  // hull in a wide plan) ──
  const view = { s: 20, ox: 0, oy: 0, laid: false };
  function layout() {
    const W = Math.max(220, Math.round(canvas.clientWidth || 420)), H = Math.max(220, Math.round(canvas.clientHeight || 460));
    canvas.width = W; canvas.height = H;
    const wM = deck.nx * deck.cell, hM = deck.nz * deck.cell;
    const up = Math.min((W - 20) / wM, (H - 28) / hM), laid = Math.min((W - 28) / hM, (H - 20) / wM);
    view.laid = laid > up * 1.1;
    view.s = view.laid ? laid : up;
    if (view.laid) {   // bow (+z) to the right, starboard (+x) down: the plan bow-up turned a quarter clockwise
      view.ox = (W - hM * view.s) / 2 - deck.minZ * view.s;
      view.oy = (H - wM * view.s) / 2 - deck.minX * view.s;
    } else {   // bow (+z) up, starboard (+x) right: the screen's y falls as z rises
      view.ox = (W - wM * view.s) / 2 - deck.minX * view.s;
      view.oy = (H + hM * view.s) / 2 + deck.minZ * view.s;
    }
  }
  const toScreen = (x, z) => (view.laid ? [view.ox + z * view.s, view.oy + x * view.s] : [view.ox + x * view.s, view.oy - z * view.s]);
  const toDeck = (sx, sy) => (view.laid ? [(sy - view.oy) / view.s, (sx - view.ox) / view.s] : [(sx - view.ox) / view.s, (view.oy - sy) / view.s]);
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  function draw() {
    if (dead || !ctx) return;
    count.textContent = t('naval.deck.count', '{n} of {max} fittings', { n: list.length, max: DECK_FITTINGS_MAX });
    ctx.fillStyle = '#0b1622';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // her deck: each cell by its height, lighter the higher
    let lo = Infinity, hi = -Infinity;
    for (const y of deck.y) if (!Number.isNaN(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    for (let k = 0; k < deck.nz; k++) for (let i = 0; i < deck.nx; i++) {
      const y = deck.y[k * deck.nx + i];
      if (Number.isNaN(y)) continue;
      const u = hi > lo ? (y - lo) / (hi - lo) : 0.5;
      ctx.fillStyle = `rgb(${Math.round(96 + 60 * u)}, ${Math.round(70 + 44 * u)}, ${Math.round(44 + 26 * u)})`;
      const [sx, sy] = toScreen(deck.minX + i * deck.cell, deck.minZ + (view.laid ? k : k + 1) * deck.cell);   // the cell's corner nearest the canvas's own
      ctx.fillRect(sx, sy, Math.ceil(deck.cell * view.s), Math.ceil(deck.cell * view.s));
    }
    // her bow's mark, at her bow's end
    ctx.fillStyle = '#c9b078';
    ctx.font = '12px sans-serif';
    ctx.textAlign = view.laid ? 'right' : 'center';
    if (view.laid) ctx.fillText(t('naval.deck.bow', 'bow'), canvas.width - 4, canvas.height / 2 + 4);
    else ctx.fillText(t('naval.deck.bow', 'bow'), canvas.width / 2, 14);
    // her fittings: each its box turned, the one taken up ringed
    list.forEach((f, i) => {
      const fp = footprint(f.m) ?? [0.8, 0.8];
      const [sx, sy] = toScreen(f.x, f.z);
      ctx.save();
      ctx.translate(sx, sy);
      // its turn as it will stand: a step turns its front from her bow toward starboard (world/quat.js quatAngleAxis about
      // up - +z to +x), clockwise from above; the laid plan turned a quarter more
      ctx.rotate((f.yaw / YAW_STEPS) * Math.PI * 2 + (view.laid ? Math.PI / 2 : 0));
      ctx.fillStyle = fittingKind(f.m) === 'chest' ? '#7a4a2a' : '#a07a46';
      ctx.strokeStyle = i === picked ? '#f3cf86' : '#2a1a10';
      ctx.lineWidth = i === picked ? 3 : 1.5;
      ctx.fillRect(-fp[0] / 2 * view.s, -fp[1] / 2 * view.s, fp[0] * view.s, fp[1] * view.s);
      ctx.strokeRect(-fp[0] / 2 * view.s, -fp[1] / 2 * view.s, fp[0] * view.s, fp[1] * view.s);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -fp[1] / 2 * view.s); ctx.stroke();   // its front
      ctx.restore();
    });
    turnL.disabled = turnR.disabled = remove.disabled = picked < 0;
  }

  /** The fitting under a screen point, or -1. */
  function under(sx, sy) {
    const [x, z] = toDeck(sx, sy);
    let best = -1, bestD = Infinity;
    list.forEach((f, i) => {
      const fp = footprint(f.m) ?? [0.8, 0.8], r = Math.max(fp[0], fp[1]) / 2 + 0.1, d = Math.hypot(f.x - x, f.z - z);
      if (d < r && d < bestD) { best = i; bestD = d; }
    });
    return best;
  }
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const snap = (v) => Math.round(v * 10) / 10;
  /** A press on the plan at a screen point: a fitting there taken up, else the chosen one set there. */
  function press(sx, sy, pointerId = null) {
    const i = under(sx, sy);
    if (i >= 0) { picked = i; dragging = true; if (pointerId != null) canvas.setPointerCapture?.(pointerId); tell(t('naval.deck.taken', '{what} selected. Drag to move, Q/E to turn, Del to remove.', { what: fittingName(list[i].m) })); return; }
    const [x, z] = toDeck(sx, sy).map(snap);
    if (list.length >= DECK_FITTINGS_MAX) { tell(t('naval.deck.full', 'A deck holds at most {max} fittings.', { max: DECK_FITTINGS_MAX }), true); return; }
    const why = placeRefusal(deck, [x, z], list, { m: Number(chosen), yaw: 0 }, footprint);   // AUDIT 2: its whole box
    if (why) { tell(why, true); return; }
    list.push({ m: chosen, x, z, yaw: 0 });
    picked = list.length - 1;
    tell(t('naval.deck.set1', '{what} placed.', { what: fittingName(chosen) }));
  }
  canvas.addEventListener('pointerdown', (e) => { const [sx, sy] = local(e); press(sx, sy, e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || picked < 0) return;
    const [x, z] = toDeck(...local(e)).map(snap);
    const others = list.filter((_, i) => i !== picked);
    if (!placeRefusal(deck, [x, z], others, list[picked], footprint)) { list[picked] = { ...list[picked], x, z }; draw(); }
  });
  const drop = () => { dragging = false; };
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);
  function turn(d) {
    if (picked < 0) return;
    const f = list[picked], yaw = (f.yaw + d + YAW_STEPS) % YAW_STEPS;
    // AUDIT 2: turned as it is set - never round into another, nor over her rail
    const why = placeRefusal(deck, [f.x, f.z], list.filter((_, i) => i !== picked), { m: f.m, yaw }, footprint);
    if (why) { tell(why, true); return; }
    list[picked] = { ...f, yaw };
    draw();
  }
  function takeAway() { if (picked < 0) return; list.splice(picked, 1); picked = -1; tell(t('naval.deck.removed', 'Fitting removed.')); }
  function keep() {
    const r = save(fittingsOf(list));
    if (r?.ok) close(); else tell(r?.text ?? t('naval.deck.bad', 'Those fittings can\'t be placed on this ship.'), true);
  }
  function onKey(e) {
    if (dead) return;
    let used = true;
    if (e.key === 'Escape') close();
    else if (e.key === 'q' || e.key === 'Q') turn(-1);
    else if (e.key === 'e' || e.key === 'E') turn(1);
    else if (e.key === 'Delete' || e.key === 'Backspace') takeAway();
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }
  globalThis.addEventListener?.('keydown', onKey, true);
  const onResize = () => { layout(); draw(); };
  globalThis.addEventListener?.('resize', onResize);
  // a model's box comes in after the window opens: drawn again as each does, a few times a second, while it is up
  const tick = globalThis.setInterval?.(() => draw(), 400);

  layout();
  drawList();
  tell(t('naval.deck.hint', 'Pick a fitting, then click the deck to place it. Click a placed fitting to select and drag it.'));

  function teardown() {
    if (dead) return false;
    dead = true;
    globalThis.clearInterval?.(tick);
    globalThis.removeEventListener?.('keydown', onKey, true);
    globalThis.removeEventListener?.('resize', onResize);
    root.remove();
    return true;
  }
  function close() { if (teardown()) try { onExit('close'); } catch { /* the host's */ } }
  return {
    unmount: teardown, destroy: close, repaint: () => draw(),
    /** Test seams: the fittings as they stand here, a click on her deck at a point of her frame, a key. */
    model: () => ({ list: list.map((f) => ({ ...f })), picked, chosen, laid: view.laid }),
    choose: (m) => { chosen = m; drawList(); },
    clickAt: (x, z) => { const [sx, sy] = toScreen(x, z); press(sx, sy); dragging = false; },
    key: (k) => onKey({ key: k, preventDefault() {}, stopPropagation() {} }),
    keep,
  };
}
