// A building's door takes seconds, and the full loading screen covers the street for all of them. This mark is a
// ring above the hotbar (the HUD's bottom column, whose first child sits over the bar) that does not take the
// pointer. The frame steps the full screen aside while it is up (syncInteriorLoad), so the street stays visible.
import { setLoadingAside, APPEAR_MS } from './loadingScreen.js';

const STYLE_ID = 'int-load-style';
const CSS = `
.int-load { width: 18px; height: 18px; box-sizing: border-box; flex: 0 0 auto; pointer-events: none;
  border: 2px solid rgba(201,168,90,0.35); border-top-color: #f0e2b6; border-radius: 50%;
  animation: int-load-spin 0.75s linear infinite; }
.int-load-slot { position: fixed; z-index: 6; left: 50%; pointer-events: none;
  bottom: calc(108px * var(--hud-scale, 1) + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); }
@keyframes int-load-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .int-load { animation: none; opacity: 0.85; } }
`;

let on = false;
let aside = false;
let node = null;
let styled = false;
let arm = null;

function styleOnce() {
  if (styled || typeof document === 'undefined' || !document.head) return;
  styled = true;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.append(s);
}

/** The HUD's bottom column when it stands, so the ring sits over the hotbar and rides the HUD's scale. */
function dock() {
  return document.body?.querySelector?.('.hud-bottom') ?? document.querySelector?.('.hud-bottom') ?? null;
}

function paint() {
  if (typeof document === 'undefined') return;
  if (!on) { node?.remove(); node = null; return; }
  styleOnce();
  if (!node) {
    node = document.createElement('div');
    node.className = 'int-load';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-label', 'Loading');
    node.style.pointerEvents = 'none';
  }
  const home = dock();
  const slot = node.parentNode?.className === 'int-load-slot' ? node.parentNode : null;
  if (home) {
    if (node.parentNode !== home || home.children?.[0] !== node) home.prepend(node);
    slot?.remove();
    return;
  }
  if (slot?.parentNode) return;
  const wrap = document.createElement('div');
  wrap.className = 'int-load-slot';
  wrap.style.pointerEvents = 'none';
  wrap.append(node);
  document.body.append(wrap);
}

function asideTo(next) {
  next = !!next;
  if (next === aside) return;
  aside = next;
  setLoadingAside('interior', aside);
}

/** The building door raises this as it starts and lowers it as it finishes. Returns `next`, so a flag can be set to it.
 *  The ring waits `APPEAR_MS`, the loading screen's own delay, so a door that costs a frame does not blink. Lowering
 *  hides it at once and leaves the full screen aside until the frame ends that hold. */
export function markInteriorLoad(next) {
  on = !!next;
  if (arm) { clearTimeout(arm); arm = null; }
  if (!on) { paint(); return on; }
  asideTo(true);
  arm = setTimeout(() => { arm = null; if (on) paint(); }, APPEAR_MS);
  return on;
}

/**
 * The world frame, every frame, before `syncLoading`. A transition that ended (or threw before it began) drops the
 * mark while that hold is still open, so the full screen stays hidden through its fade instead of appearing once the
 * building is already up.
 * @param {boolean} transitioning
 */
export function syncInteriorLoad(transitioning) {
  if (!transitioning && on) {
    on = false;
    if (arm) { clearTimeout(arm); arm = null; }
    paint();
  }
  asideTo(transitioning && on);
}

export const interiorLoadOn = () => on;
