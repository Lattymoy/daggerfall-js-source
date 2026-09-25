// WM1: WINDOWS UNFOLD AND FOLD - the enhanced skin's open and close.
//
// A window APPEARS by unfolding from a seam across its middle, in whole
// pixel steps, with its frame lit bright for the first frames and the
// scrim behind it fading in. It VANISHES the same way in reverse.
//
// WHY AN OBSERVER AND NOT FORTY DOORS. Every enhanced door mounts its
// host as a child of <body> and closes it with a plain `host.remove()`
// (pauseDoor, inventoryDoor, tradeDoor, tavernDoor, talkDoor, ...), and
// the close paths around those calls are synchronous on purpose - the
// pointer relock needs the close inside the click (MAC1 J), and a
// window that reopens in the same tick must find the slot empty. So no
// close is delayed here. The real host goes when the door says; what
// folds away is an AFTERIMAGE: a clone of the host, inert and
// pointer-transparent, painted over the game for MOTION_OUT_MS and then
// dropped. Canvases are copied into the clone and scroll positions are
// restored, so the afterimage is the window as the player last saw it.
//
// WHAT IT LEAVES ALONE. A host whose window is swapped for one of the
// same kind in the same tick (a re-render) plays nothing. The notice
// stack keeps its own slide. Under an automated browser (the probes)
// motion is OFF, so every geometry and "the window is gone" probe
// measures the same page it always did; `?motion` turns it back on for
// a screenshot. Reduced motion keeps only a short fade.

/** The window roles that open and close with motion. */
export const MOTION_WINDOWS = ['.px-win', '.pack-win', '.loot-win', '.px-about', '.px-profile', '.hmbox', '.inputbox', '.dlg-win'];
export const MOTION_IN_MS = 240;
export const MOTION_OUT_MS = 180;
const SEL = MOTION_WINDOWS.join(', ');

/** The frame reaches outside its box (border-image-outset and shadow),
 *  so the clip opens past the box by this much. */
const REACH = 24;

export const MOTION_CSS = `
/* ── WM1: WINDOWS UNFOLD AND FOLD (ui/windowMotion.js) ───────────── */
@keyframes wm-unfold {
  0%   { clip-path: inset(50% -${REACH}px 50% -${REACH}px); filter: brightness(1.9); }
  35%  { filter: brightness(1.25); }
  100% { clip-path: inset(-${REACH}px); filter: brightness(1); }
}
@keyframes wm-fold {
  0%   { clip-path: inset(-${REACH}px); filter: brightness(1); opacity: 1; }
  45%  { filter: brightness(1.3); opacity: 1; }
  100% { clip-path: inset(50% -${REACH}px 50% -${REACH}px); filter: brightness(1.9); opacity: 0.2; }
}
@keyframes wm-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes wm-fade-out { from { opacity: 1; } to { opacity: 0; } }
.wm-host-in { animation: wm-fade-in ${MOTION_IN_MS - 60}ms ease-out both; }
.wm-in { animation: wm-unfold ${MOTION_IN_MS}ms steps(8, end) both; }
.wm-ghost { pointer-events: none !important; z-index: 39 !important; }   /* under the asset picker (dataSource.js ASSET_PICKER_Z, MWFIX 1) */
.wm-ghost.wm-host-out { animation: wm-fade-out ${MOTION_OUT_MS}ms ease-in both; }
.wm-ghost .wm-out, .wm-ghost.wm-out { animation: wm-fold ${MOTION_OUT_MS}ms steps(6, end) both; }
@media (prefers-reduced-motion: reduce) {
  .wm-in, .wm-ghost .wm-out, .wm-ghost.wm-out { animation: none; }
  .wm-host-in { animation-duration: 120ms; }
  .wm-ghost.wm-host-out { animation-duration: 100ms; }
}
`;

/** Is motion on for this page? Off under automation unless asked for. */
export function motionEnabled(win = globalThis) {
  const q = new URLSearchParams(win.location?.search ?? '');
  if (q.has('nomotion')) return false;
  if (q.has('motion')) return true;
  return !win.navigator?.webdriver;
}

/** A host "is a window" when it is one, or holds one. */
const windowsIn = (node) => {
  if (node?.nodeType !== 1) return [];
  const out = node.matches?.(SEL) ? [node] : [];
  return out.concat([...(node.querySelectorAll?.(SEL) ?? [])]);
};
/** Two hosts are the same kind of window when their first windows share a class list. */
const kindOf = (node) => windowsIn(node)[0]?.className ?? '';

// Scroll positions, remembered as they happen: a node that has left the
// document has no layout, so its scrollTop reads 0 by the time the
// observer sees it.
const scrolls = new WeakMap();
let installed = null;

function afterimage(host, doc) {
  const clone = host.cloneNode(true);
  // one tree walked in step with the other: canvases and scroll offsets
  const a = [host, ...host.querySelectorAll('*')];
  const b = [clone, ...clone.querySelectorAll('*')];
  const restore = [];
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i].tagName === 'CANVAS' && a[i].width && a[i].height) {
      try { b[i].getContext('2d')?.drawImage(a[i], 0, 0); } catch { /* a webgl or tainted canvas stays blank */ }
    }
    const s = scrolls.get(a[i]);
    if (s) restore.push([b[i], s]);
    if (b[i].id) b[i].removeAttribute('id');   // the real window may reopen at once
  }
  clone.classList.add('wm-ghost', 'wm-host-out');
  clone.setAttribute('aria-hidden', 'true');
  clone.inert = true;
  for (const w of windowsIn(clone)) w.classList.add('wm-out');
  doc.body.append(clone);
  for (const [el, s] of restore) { el.scrollTop = s.top; el.scrollLeft = s.left; }
  const drop = () => { try { clone.remove(); } catch { /* gone */ } };
  setTimeout(drop, MOTION_OUT_MS + 60);
}

function unfold(host) {
  host.classList.add('wm-host-in');
  const wins = windowsIn(host);
  for (const w of wins) w.classList.add('wm-in');
  setTimeout(() => {
    host.classList.remove('wm-host-in');
    for (const w of wins) w.classList.remove('wm-in');
  }, MOTION_IN_MS + 60);
}

/** Start watching <body>. Safe to call from every mount site. */
export function installWindowMotion(doc = globalThis.document) {
  const Observer = (doc?.defaultView ?? globalThis).MutationObserver;
  if (!doc?.body || installed || typeof Observer !== 'function') return;
  if (!motionEnabled(doc.defaultView ?? globalThis)) return;
  doc.addEventListener('scroll', (e) => {
    const t = e.target;
    if (t?.nodeType === 1) scrolls.set(t, { top: t.scrollTop, left: t.scrollLeft });
  }, { capture: true, passive: true });
  installed = new Observer((records) => {
    const added = [], removed = [];
    for (const r of records) {
      for (const n of r.addedNodes) if (windowsIn(n).length && !n.classList?.contains('wm-ghost')) added.push(n);
      for (const n of r.removedNodes) if (windowsIn(n).length && !n.classList?.contains('wm-ghost')) removed.push(n);
    }
    // a swap of like for like in one tick is a re-render, not an open and a close
    const addedKinds = new Set(added.map(kindOf));
    const removedKinds = new Set(removed.map(kindOf));
    for (const n of removed) if (!addedKinds.has(kindOf(n)) && !n.isConnected) afterimage(n, doc);
    for (const n of added) if (!removedKinds.has(kindOf(n)) && n.isConnected) unfold(n);
  });
  installed.observe(doc.body, { childList: true });
}
