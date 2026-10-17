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

/** The face standing: `{ key, host, face, full, box }`, or null. */
let live = /** @type {null | { key: string, host: HTMLElement, face: any, full: boolean, box: HTMLElement|null, sized: boolean }} */ (null);

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
 * @param {{ el: (t: string, c?: string|null, x?: string|null) => HTMLElement, full: string, leave: string, loading: string, failed: string, lead?: string, open?: string }} o
 *   `lead` the page's one line, on the stage's bar beside the toggle; `open` the narrow screen's door (below)
 */
export function drawStage(detail, key, mount, { el, full, leave, loading, failed, lead = '', open = full }) {
  if (live && live.key !== key) dropStage();
  if (!live) {
    const host = el('div', 'gr-stagehost');
    const me = { key, host, face: null, full: false, box: null, sized: false };
    live = me;
    host.append(el('p', 'gr-loading', loading));
    Promise.resolve().then(() => mount(host)).then((face) => {
      if (live !== me) { try { face?.destroy?.(); } catch { /* gone */ } return; }
      host.querySelector?.('.gr-loading')?.remove?.();
      me.face = face;
      fit(me);
    }, (err) => {
      if (live !== me) return;
      host.textContent = '';
      host.append(el('p', 'gr-loading', failed));
      console.warn(`[growth] ${key} failed: ${err?.message ?? err}`);
    });
  }
  const me = live;
  // A PHONE'S STAGE IS THE SCREEN: under a narrow window a face's own bar alone fills the pane (the sky's purses, its
  // search and its seven presses), so the page is its line and a door, and the face opens over everything - kept as
  // it was (its view, its pending stars) between two opens, until the page, the tab or the window is left.
  if (narrow()) {
    const card = el('div', 'gr-stagecard');
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
  detail.append(bar, wrap);
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
  } else {
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

/** The face taken down (a page left, the tab left, the window gone). */
export function dropStage() {
  const me = live;
  if (!me) return;
  live = null;
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
  try { if (me.face?.back?.()) return true; } catch { /* the face's */ }
  if (me.full) { /** @type {HTMLElement|null} */ (me.box?.querySelector?.('.gr-fullleave') ?? null)?.click?.(); return true; }
  return false;
}

/** The stage's dress: the pane's height, its bar, the full-screen box over the window. */
export const STAGE_CSS = `
.px-sys .gr-stagebar { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin: 0 0 6px; }
.px-sys .gr-stagelead { flex: 1; min-width: 0; font-size: 14px; line-height: 1.35; color: #cfc7b1; }
.px-sys .gr-stagebar .act { flex: none; min-height: 38px; padding: 4px 14px; font-size: 15px; }
.px-sys .gr-stage { position: relative; height: clamp(320px, 64vh, 760px); overflow: hidden; border: 2px solid rgba(125,116,96,0.55); background: #07080b; }
.gr-stagehost { position: absolute; inset: 0; overflow: hidden; }
.gr-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; margin: 0; font-size: 14px; color: #9c937d; }
.gr-fullbox { position: fixed; inset: 0; z-index: 15; background: #07080b; }
.gr-fullbox .gr-fullleave { position: absolute; right: 12px; bottom: 52px; z-index: 2; min-height: 36px; padding: 4px 12px; font-size: 14px; }   /* over the faces' own hint lines, never on them */
.px-sys .gr-stagecard { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 10px 0; }
.px-sys .gr-stagecard .gr-stagelead { flex: none; }
@media (max-width: 660px) { .gr-fullbox .gr-fullleave { right: 8px; bottom: 48px; } }
`;
