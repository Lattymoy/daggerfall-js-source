// @ts-check
// WB9d (2026-09-30, Mac: "Further improve his effects, ensure his ground affects actually cause damage and the player
// recieves proper feedback"): HIS GROUND AND HIS ELEMENT, FELT. His ground bit, and his fire landed - but a strike with
// an element never flashed the screen (ui/damageFlash.js: DFU's red flash rides a blow, never spell damage - the law the
// port keeps for every foe), so a fighter standing in his fire lost a tenth of their health a second to a hiss they
// could not place. The court is not DFU's: its ground and its elemental blows say themselves here, in their own colour.
//
//   - THE EDGE: the screen's rim glows in the ground's colour while I stand in it (breathing, never still), and FLARES
//     at each bite - and at each of his elemental blows that lands on me - fading over GROUND_BITE_MS.
//   - THE WARNING: while I stand in it, its name and the one thing to do, under the crosshair - "Burning ground - step
//     out!" - pulsing.
//   - WB13a (2026-10-01, Mac: "hone in telegraphs"): A BLOW STILL TO COME, ON ME. In first person at sword reach his
//     Cleave's shape is none of the frame and his Slam's a sliver - the ground under my own feet is out of sight. While
//     my feet stand in a blow still to land (his, or his host's), the rim rises in the danger edge's colour as it winds
//     up, the blow's name and the order stand under the crosshair - "Cleave - move!" - and an arrow points the nearest
//     way out of it.
//
// A READOUT, NOT A WINDOW (ui/gateBossBar.js's law): no click, two nodes made on the first need and UPDATED, NOT REBUILT,
// each written only when it changes, hidden (never removed) with nothing to show and with the HUD. `groundViewModel` is
// pure - the pins read it.
//
// Not a DFU member. Ledger A (WB).
import { injectEnhancedFonts } from './enhancedStyle.js';   // WB13c: the classic face, loaded by the gate's own screens

/** A bite's flare fades over this (ms); the rim breathes this fast while I stand in it (cycles a second). */
export const GROUND_BITE_MS = 650;
export const GROUND_BREATH_HZ = 1.6;
/** How bright the rim stands while I am in the ground (at the breath's low and high), and a bite's flare over it. */
export const GROUND_EDGE_IN = Object.freeze([0.28, 0.46]);
export const GROUND_EDGE_BITE = 0.62;
/** The rim's alpha is written in steps this fine (a style write only when it moves a step). */
export const GROUND_EDGE_STEP = 0.02;
/** WB13a: a blow still to come on me - the rim's rise over its wind-up (from the first, to the last, its share squared),
 *  and its height in the blow's last moment; the arrow stands this far out from the crosshair (px), turned in steps this
 *  fine (degrees). */
export const PERIL_EDGE = Object.freeze([0.25, 0.7]);
export const PERIL_EDGE_NOW = 0.9;
export const PERIL_ARROW_R = 72;
/** AUDIT SD III (T2): its ring on a phone held sideways (px) - at 72 the chevron pointing ahead stood on the boss bar's
 *  plate. */
export const PERIL_ARROW_R_LOW = 36;
export const PERIL_ARROW_STEP = 3;
/** The words. */
export const GROUND_VIEW_TEXT = Object.freeze({
  warn: (ground) => `${ground || 'Burning ground'} - step out!`,
  peril: (name) => `${name} - move!`,   // WB13a
});

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const rgbOf = (c) => `${Math.round(clamp01(c[0]) * 255)}, ${Math.round(clamp01(c[1]) * 255)}, ${Math.round(clamp01(c[2]) * 255)}`;

/**
 * What the rim and the warning say now, or null (nothing to feel). `inside` whether I stand in his ground now, `ground`
 * its name (his aspect's - net/gateMods.js `ground`), `color` its colour ([r, g, b] 0..1 - world/gateBoss.js poolColor);
 * `biteAt` when the last bite or elemental blow landed on me (the court's clock), `biteColor` its colour. WB13a: `peril`
 * a blow still to land on my feet (scenes/gateCourt.js perilAt - its name, its wind-up's share `t`, whether it is in its
 * last moment `now`, its line's colour, the way out's bearing on the screen `arrow` in degrees, 0 ahead): it takes the
 * rim's colour and the warning over the ground's. Pure.
 * @param {{ inside?: boolean, ground?: string, color?: ReadonlyArray<number>|null, biteAt?: number, biteColor?: ReadonlyArray<number>|null, now: number,
 *   peril?: { name: string, t: number, now?: boolean, color: ReadonlyArray<number>, arrow?: number|null }|null }} m
 */
export function groundViewModel({ inside = false, ground = '', color = null, biteAt = -Infinity, biteColor = null, now, peril = null }) {
  const since = now - biteAt;
  const bite = since >= 0 && since < GROUND_BITE_MS ? 1 - since / GROUND_BITE_MS : 0;
  if (!inside && !(bite > 0) && !peril) return null;
  const breath = inside ? GROUND_EDGE_IN[0] + (GROUND_EDGE_IN[1] - GROUND_EDGE_IN[0]) * (0.5 + 0.5 * Math.sin((now / 1000) * GROUND_BREATH_HZ * Math.PI * 2)) : 0;
  const t = peril ? clamp01(peril.t) : 0;
  const rise = peril ? (peril.now ? PERIL_EDGE_NOW : PERIL_EDGE[0] + (PERIL_EDGE[1] - PERIL_EDGE[0]) * t * t) : 0;
  const edge = clamp01(Math.max(breath, rise, breath + bite * bite * GROUND_EDGE_BITE));
  const c = (bite > 0 && biteColor) || (peril && peril.color) || color || biteColor || [1, 0.4, 0.1];
  const arrow = peril && Number.isFinite(peril.arrow) ? Math.round(peril.arrow / PERIL_ARROW_STEP) * PERIL_ARROW_STEP : null;
  return { edge: Math.round(edge / GROUND_EDGE_STEP) * GROUND_EDGE_STEP, rgb: rgbOf(c), warn: peril ? GROUND_VIEW_TEXT.peril(peril.name) : inside ? GROUND_VIEW_TEXT.warn(ground) : null, arrow };
}

export const GROUND_VIEW_STYLE_ID = 'dagger-gate-ground-style';
export const GROUND_VIEW_CSS = `
.wb-ground-edge { position: fixed; inset: 0; pointer-events: none; z-index: 28; opacity: 0; }
.wb-ground-warn { position: fixed; left: 50%; top: 60%; transform: translateX(-50%); pointer-events: none; z-index: 30;
  font: 700 17px 'Cormorant', Georgia, serif; letter-spacing: 0.16em; text-transform: uppercase; white-space: nowrap;
  text-shadow: 0 0 3px #000, 0 0 12px rgba(0,0,0,0.95); animation: wb-ground-warn 0.62s ease-in-out infinite alternate; }
@keyframes wb-ground-warn { from { opacity: 0.72; } to { opacity: 1; } }
.wb-ground-arrow { position: fixed; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; z-index: 30; }
.wb-ground-arrow svg { position: absolute; left: -14px; top: ${-PERIL_ARROW_R - 14}px; width: 28px; height: 28px;
  filter: drop-shadow(0 0 2px #000) drop-shadow(0 0 6px rgba(0,0,0,0.9)); }
@media (max-height: 480px) { .wb-ground-arrow svg { top: ${-PERIL_ARROW_R_LOW - 14}px; } }
`;
/** WB13a: the way out, a chevron - drawn pointing up (ahead) and turned about the crosshair. */
const ARROW_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 22 16h-6v6H8v-6H2z"/></svg>';

let edgeNode = null, warnNode = null, arrowNode = null;
let shown = { edge: -1, rgb: '', warn: null, vis: '', arrow: null };

function build(doc) {
  if (doc.getElementById && !doc.getElementById(GROUND_VIEW_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = GROUND_VIEW_STYLE_ID;
    st.textContent = GROUND_VIEW_CSS;
    (doc.head ?? doc.body)?.append(st);
    if (doc.head) injectEnhancedFonts(doc);   // WB13c: Cormorant on the classic skin too (it came only if another window had asked)
  }
  edgeNode = doc.createElement('div');
  edgeNode.className = 'wb-ground-edge';
  warnNode = doc.createElement('div');
  warnNode.className = 'wb-ground-warn';
  warnNode.style.display = 'none';
  arrowNode = doc.createElement('div');   // WB13a
  arrowNode.className = 'wb-ground-arrow';
  arrowNode.style.display = 'none';
  arrowNode.innerHTML = ARROW_SVG;
  (doc.body ?? doc.documentElement)?.append(edgeNode, warnNode, arrowNode);
}

/** Draw the rim and the warning for a model (null hides them); `hidden` is the HUD's own hide. */
export function drawGateGround(model, { hidden = false, doc = globalThis.document } = {}) {
  const want = !hidden && !!model;
  if (!edgeNode) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  const vis = want ? 'on' : 'off';
  if (vis !== shown.vis) {
    shown.vis = vis;
    if (!want) { edgeNode.style.opacity = '0'; warnNode.style.display = 'none'; arrowNode.style.display = 'none'; shown.edge = 0; shown.warn = null; shown.arrow = null; }
  }
  if (!want || !model) return;
  if (model.rgb !== shown.rgb) {
    shown.rgb = model.rgb;
    edgeNode.style.background = `radial-gradient(ellipse at 50% 50%, rgba(${model.rgb}, 0) 42%, rgba(${model.rgb}, 0.55) 78%, rgba(${model.rgb}, 1) 100%)`;
    warnNode.style.color = `rgb(${model.rgb})`;
    arrowNode.style.color = `rgb(${model.rgb})`;
  }
  if (model.edge !== shown.edge) { shown.edge = model.edge; edgeNode.style.opacity = String(model.edge); }
  if (model.warn !== shown.warn) {
    shown.warn = model.warn;
    warnNode.style.display = model.warn ? '' : 'none';
    if (model.warn) warnNode.textContent = model.warn;
  }
  const arrow = model.arrow ?? null;
  if (arrow !== shown.arrow) {   // WB13a: the way out, turned about the crosshair
    shown.arrow = arrow;
    arrowNode.style.display = arrow == null ? 'none' : '';
    if (arrow != null) arrowNode.style.transform = `rotate(${arrow}deg)`;
  }
}

/** The page is going (a test's reset): the nodes leave with it. */
export function destroyGateGround() {
  edgeNode?.remove?.(); warnNode?.remove?.(); arrowNode?.remove?.();
  edgeNode = null; warnNode = null; arrowNode = null;
  shown = { edge: -1, rgb: '', warn: null, vis: '', arrow: null };
}
