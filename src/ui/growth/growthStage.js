// @ts-check
// GROWTH3 (2026-10-17, the owner: the Firmament, the level-up page and the specialisations on a tab of their own; asked,
// "Drawn in the tab"; bible/10-UI/Growth.md section 6) - THE STAGE: a full-screen face (the Firmament, the captain's
// stars, the Ascension) drawn IN the Growth tab's detail pane. The pause window redraws its whole tree on every press
// (enhancedMenu.js render), so a face is mounted ONCE per visit into a host element of its own, and each draw of the
// page moves that host into the new pane - the canvas, its view and its pending stars travel with it. Full screen moves
// the same host into a box over the window (on the body, so no ancestor's transform holds it), and back.
//
// A face is `{ destroy(), resize?(refit), back?() }` - the windows' own (their `embed` mode). One stands at a time: a
// new page's drops the last, and leaving the tab or the window drops it (releaseGrowthTab).

import { isChunkLoadError, RELOAD_TEXT } from '../enhanced/enhancedChunk.js';   // MENU1's word for a chunk a deploy took

/** The face standing: `{ key, host, face, full, box }`, or null. */
let live = /** @type {null | { key: string, host: HTMLElement, face: any, full: boolean, box: HTMLElement|null, sized: boolean, el?: any, words?: { full: string, leave: string }, guard?: any }} */ (null);

/** Is a face up, and is it full screen? */
export const stageLive = () => (live ? { key: live.key, full: live.full } : null);
/** Test and probe seam: the face standing (its own seams - a star taken, its model). */
export const stageFace = () => live?.face ?? null;

/**
 * THE STAGE into `detail` for the face named `key`. `mount(host)` builds it (or a promise of it) the first time;
 * `el` the menu's maker; `full` / `leave` the toggle's words. Answers the stage's element.
 * @param {HTMLElement} detail
 * @param {string} key
 * @param {(host: HTMLElement) => any} mount
 * @param {{ el: (t: string, c?: string|null, x?: string|null) => HTMLElement, full: string, leave: string, loading: string, failed: string, lead?: string, open?: string, door?: boolean, badge?: string, heading?: string }} o
 *   `lead` the page's one line, on the stage's bar beside the toggle; `open` the narrow screen's door (below); `door`
 *   that door on any screen - a face the pane cannot hold (AUDIT GROWTH LANE2-8: the Ascension's column); `badge` and
 *   `heading` the door's crest and its title (GROWTH-BOOK)
 */
export function drawStage(detail, key, mount, { el, full, leave, loading, failed, lead = '', open = full, door = false, badge = '', heading = '' }) {
  if (live && live.key !== key) dropStage();
  if (!live) {
    const host = el('div', 'gr-stagehost');
    const me = { key, host, face: null, full: false, box: null, sized: false };
    live = me;
    host.append(el('p', 'gr-loading', loading));
    // AUDIT GROWTH LANE2 N4: a face left before its chunk landed is never built (a dropped Level face drew its pool and
    // played its fanfare); LANE2-10: MENU1's law (enhancedChunk.js) - a chunk that fails to load is tried once more, and
    // one a deploy took says a reload fixes it, not "try again"
    const tryMount = (again) => Promise.resolve().then(() => (live === me ? mount(host) : null)).catch((err) => {
      if (!again || live !== me || !isChunkLoadError(err)) throw err;
      return new Promise((r) => setTimeout(r, 400)).then(() => tryMount(false));
    });
    tryMount(true).then((face) => {
      if (live !== me) { try { face?.destroy?.(); } catch { /* gone */ } return; }
      host.querySelector?.('.gr-loading')?.remove?.();
      me.face = face;
      fit(me);
    }, (err) => {
      if (live !== me) return;
      host.textContent = '';
      host.append(el('p', 'gr-loading', isChunkLoadError(err) ? RELOAD_TEXT : failed));
      console.warn(`[growth] ${key} failed: ${err?.message ?? err}`);
    });
  }
  const me = live;
  me.el = el; me.words = { full, leave };   // LANE3-6: a detached face's ask opens it (asked)
  // A PHONE'S STAGE IS THE SCREEN: under a narrow window a face's own bar alone fills the pane (the sky's purses, its
  // search and its seven presses), so the page is its line and a door, and the face opens over everything - kept as
  // it was (its view, its pending stars) between two opens, until the page, the tab or the window is left.
  if (door || narrow()) {
    const card = el('div', 'gr-stagecard');
    if (badge) card.append(el('div', 'gr-crest', badge));
    if (heading) card.append(el('h3', 'gr-doorhead', heading));
    if (lead) card.append(el('p', 'gr-stagelead', lead));
    const b = el('button', 'act primary', open);
    b.onclick = () => setFull(true, el, { full, leave });
    card.append(b);
    detail.append(card);
    return card;
  }
  const bar = el('div', 'gr-stagebar');
  if (lead) bar.append(el('span', 'gr-stagelead', lead));
  const b = el('button', 'act', me.full ? leave : full);
  b.onclick = () => setFull(!me.full, el, { full, leave });
  bar.append(b);
  const wrap = el('div', 'gr-stage');
  if (!me.full) wrap.append(me.host);
  // GROWTH-BOOK: the stage in a frame of its own - the window's double rule and its four gems
  const frame = el('div', 'gr-frame');
  frame.append(wrap);
  for (const c of ['tl', 'tr', 'bl', 'br']) frame.append(el('span', `px-gem px-corner px-${c}`));
  detail.append(bar, frame);
  fit(me);
  return wrap;
}

/** Is the window a phone's - too narrow for a face in its pane? */
const narrow = () => (globalThis.innerWidth ?? 1280) <= 660;

/** The face told its stage moved - after the browser has laid it out (the first true size refits its view). */
function fit(me) {
  const go = () => {
    if (live !== me || !me.face || !me.host.isConnected) return;
    const refit = !me.sized && me.host.clientWidth > 0;
    if (refit) me.sized = true;
    try { me.face.resize?.(refit); } catch { /* the face's */ }
  };
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(go); else go();
}

/** Full screen and back: the face's host moved into a box over everything, or back into the page's stage. */
function setFull(on, el, words) {
  const me = live;
  if (!me || me.full === on || typeof document === 'undefined') return;
  me.full = on;
  if (on) {
    const box = el('div', 'gr-fullbox');
    const b = el('button', 'act gr-fullleave', words.leave);
    b.onclick = () => setFull(false, el, words);
    box.append(me.host, b);
    document.body.append(box);
    me.box = box;
    keepFocus(me, true);
  } else {
    keepFocus(me, false);
    me.box?.remove();
    me.box = null;
    // the page's stage is drawn again by the window's next render; until then the host stands nowhere (a phone's page
    // has no stage: the face waits, detached and deaf, for its door)
    const stage = document.querySelector?.('.gr-stage');
    if (stage) stage.append(me.host); else me.host.remove();
    const bar = document.querySelector?.('.gr-stagebar .act');
    if (bar) bar.textContent = words.full;
  }
  fit(me);
}

/** AUDIT GROWTH LANE2 N2: the focus stays in the full-screen box - a Tab walked under it to the window's own tabs (the
 *  pause door's tabIn sends it to the first), and an Enter there left the page behind the face. */
function keepFocus(me, on) {
  if (typeof document === 'undefined') return;
  if (me.guard) { document.removeEventListener?.('focusin', me.guard, true); me.guard = null; }
  if (!on) return;
  me.guard = (e) => { if (me.box && !me.box.contains?.(/** @type {any} */ (e.target))) /** @type {any} */ (me.box.querySelector?.('.gr-fullleave'))?.focus?.({ preventScroll: true }); };
  document.addEventListener?.('focusin', me.guard, true);
}

/** The face taken down (a page left, the tab left, the window gone). */
export function dropStage() {
  const me = live;
  if (!me) return;
  live = null;
  keepFocus(me, false);
  me.box?.remove();
  try { me.face?.destroy?.(); } catch { /* already gone */ }
  me.host.remove();
}

/**
 * THE TAB'S ESCAPE, ahead of the window's own back stack: the face's own (a confirm shut, unaccepted stars asked about
 * once), then full screen left. Answers whether the press was taken.
 */
export function stageBack() {
  const me = live;
  if (!me) return false;
  if (asked(me)) return true;
  if (me.full) { /** @type {HTMLElement|null} */ (me.box?.querySelector?.('.gr-fullleave') ?? null)?.click?.(); return true; }
  return false;
}

/**
 * GROWTH5: LEAVING ASKS FIRST - another page, another tab, the sheet's key or the QuickDial's: the
 * face's own ask (unaccepted stars said once), never full screen's. Answers whether the face held the press; the second
 * press goes (AUDIT RVN-STARS S8's law, for every face the stage holds).
 */
export function stageAsks() {
  const me = live;
  return me ? asked(me) : false;
}

/** The face's own ask - and a face that asks while it stands nowhere (a phone's, its full screen left: the page has no
 *  stage) is opened full screen again, so the ask is said where it can be read (AUDIT GROWTH LANE3-6: the first press
 *  looked dead and the second discarded the stars). */
function asked(me) {
  let held = false;
  try { held = !!me.face?.back?.(); } catch { return false; }
  if (held && !me.full && !me.host.isConnected && me.words) setFull(true, me.el, me.words);
  return held;
}

/** The stage's dress: the pane's height, its bar, the full-screen box over the window. */
export const STAGE_CSS = `
.px-sys .gr-stagebar { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin: 0 0 6px; }
.px-sys .gr-stagelead { flex: 1; min-width: 0; font-size: 14px; line-height: 1.35; color: #cfc7b1; }
.px-sys .gr-stagebar .act { flex: none; min-height: 38px; padding: 4px 14px; font-size: 15px; }
.px-sys .gr-frame { position: relative; display: flex; box-sizing: border-box; padding: 4px; background: #0b0c10;
  border: 2px solid #7d7460; box-shadow: 0 0 0 1px #050608, inset 0 0 0 1px #050608, 0 6px 18px rgba(0,0,0,0.45); }
.px-sys .gr-frame > .px-corner { z-index: 3; }
.px-sys .gr-stage { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; border: 1px solid rgba(125,116,96,0.5); background: #07080b;
  box-shadow: inset 0 0 0 1px #000; }
:root[data-plus-dress="grimoire"] .px-sys .gr-frame { padding: 5px; background: #3a2414; border: 2px solid #1c0f06;
  box-shadow: inset 0 0 0 1px #8a5a2b, inset 0 0 0 3px #4a2d16, 0 0 0 1px rgba(255,214,150,0.18), 0 4px 12px rgba(0,0,0,0.45); }
:root[data-plus-dress="grimoire"] .px-sys .gr-stage { border: 1px solid #1c0f06; box-shadow: 0 0 0 1px rgba(255,214,150,0.25); }
.gr-stagehost { position: absolute; inset: 0; overflow: hidden; }
.gr-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; margin: 0; font-size: 14px; color: #9c937d; }
.gr-fullbox { position: fixed; inset: 0; z-index: 15; background: #07080b; }
/* AUDIT GROWTH LANE2-8 / LANE2 N3: the face stands above a strip of its own and the leave press is in it - laid over the
   face it sat on the Ascension's Ascend and on the skies' summary panel */
.gr-fullbox > .gr-stagehost { bottom: 48px; }
.gr-fullbox .gr-fullleave { position: absolute; right: 12px; bottom: 6px; z-index: 2; min-height: 36px; padding: 4px 12px; font-size: 14px; }
.px-sys .gr-stagecard { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px 16px; text-align: center; }
.px-sys .gr-stagecard .gr-stagelead { flex: none; max-width: 520px; font-size: 15px; line-height: 1.45; }
.px-sys .gr-stagecard .act { min-height: 40px; min-width: 180px; padding: 6px 22px; font-size: 16px; }
.px-sys .gr-crest { position: relative; isolation: isolate; width: 96px; height: 96px; display: flex; align-items: center; justify-content: center;
  font-size: 36px; line-height: 1; color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-sys .gr-crest::before { content: ''; position: absolute; inset: 16px; z-index: -1; transform: rotate(45deg);
  border: 2px solid #7d7460; outline: 2px solid rgba(125,116,96,0.35); outline-offset: 5px; background: rgba(224,195,106,0.08); }
.px-sys .gr-doorhead { margin: 10px 0 0; font-size: 20px; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
:root[data-plus-dress="grimoire"] .px-sys .gr-crest { color: #8e1a10; text-shadow: none; }
:root[data-plus-dress="grimoire"] .px-sys .gr-crest::before { border-color: rgba(92,52,24,0.7); outline-color: rgba(92,52,24,0.3); background: rgba(142,26,16,0.06); }
:root[data-plus-dress="grimoire"] .px-sys .gr-doorhead { color: #8e1a10; text-shadow: none; text-transform: none; letter-spacing: 0; font-size: 22px; }
@media (max-width: 660px) { .gr-fullbox .gr-fullleave { right: 8px; } }
`;
