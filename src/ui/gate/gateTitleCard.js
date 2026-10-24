// @ts-check
// WB13e (2026-10-01, Mac: "just overall bring more AAA grade polish to what is already developed"): THE FIGHT'S BEATS,
// LARGE - a card over the upper middle of the screen for the moments a fight turns on: his wake (his name, his epithet
// under it, as he first moves), a phase's turn ("II", "The Burning Court", its one order under it until he lands) and his
// fall ("Felled" under his name, over his spoils). Design: bible/11-Multiplayer/World-Bosses.md section 20, WB13e.
//
// A READOUT, NOT A WINDOW (the gate banner's law, ui/gate/gateBanner.js): no click, no overlay stack, one node made on the
// first word and UPDATED, NOT REBUILT - each part written only when it changes - hidden (never removed) when there is
// nothing to show, hidden with the HUD and under the step's fire. In every skin.
//
// `titleCardModel` is pure - a beat and the clock in, what the card says out; the pins read it.
//
// Not a DFU member. Ledger A (WB).
import { GATE_RING_CSS } from './gateMapMark.js';
import { injectEnhancedFonts } from '../enhanced/enhancedStyle.js';   // the classic face, loaded by the gate's own screens
import { egReducedMotion } from '../eliteGates/egAccess.js';   // AUDIT EG V (c, L7-17): reduced motion - the port's row or the system's

/** A card comes in over TITLE_IN_MS and goes over TITLE_OUT_MS; it stands at least TITLE_HOLD_MS. */
export const TITLE_IN_MS = 300;
export const TITLE_OUT_MS = 600;
export const TITLE_HOLD_MS = 2600;

export const TITLE_CARD_STYLE_ID = 'dagger-gate-title-style';
export const TITLE_CARD_CSS = `
.wb-title-card { position: fixed; left: 50%; top: 34%; transform: translate(-50%, -50%); width: min(720px, 92vw);
  pointer-events: none; z-index: 32; text-align: center; font: 600 15px 'Cormorant', Georgia, serif; color: #f3d9c4;
  text-shadow: 0 0 4px #000, 0 0 14px rgba(0,0,0,0.95); }
.wb-title-kicker { font-size: 14px; letter-spacing: 0.42em; text-transform: uppercase; color: ${GATE_RING_CSS}; min-height: 17px; }
.wb-title-main { font-size: 42px; line-height: 1.05; letter-spacing: 0.1em; text-transform: uppercase; color: #ffe7cf;
  text-shadow: 0 0 4px #000, 0 0 18px rgba(255,70,30,0.55), 0 0 36px rgba(0,0,0,0.9); }
.wb-title-rule { height: 1px; width: 62%; margin: 7px auto 6px; background: linear-gradient(90deg, transparent, ${GATE_RING_CSS}, transparent);
  transform: scaleX(0); transition: transform 500ms cubic-bezier(.2,.7,.3,1); }
.wb-title-card.on .wb-title-rule { transform: scaleX(1); }
.wb-title-sub { font-size: 18px; letter-spacing: 0.06em; min-height: 22px; }
.wb-title-card.in .wb-title-main { animation: wb-title-in 420ms cubic-bezier(.2,.7,.3,1); }
@keyframes wb-title-in { from { opacity: 0; letter-spacing: 0.32em; } }
.wb-title-card.still .wb-title-rule { transition: none; }
.wb-title-card.still .wb-title-main { animation: none; }
@media (prefers-reduced-motion: reduce) { .wb-title-rule { transition: none; } .wb-title-card.in .wb-title-main { animation: none; } }
@media (max-width: 640px) { .wb-title-card { top: 30%; } .wb-title-main { font-size: 28px; } .wb-title-sub { font-size: 15px; } .wb-title-kicker { font-size: 12px; letter-spacing: 0.22em; } }
@media (max-height: 480px) { .wb-title-card { top: 48%; } .wb-title-main { font-size: 26px; } .wb-title-kicker { font-size: 12px; } }
`;

/**
 * What the card says now, or null: a beat ({ kind, at, until, kicker, main, sub, color }) stands from `at` until
 * `until`, in over TITLE_IN_MS and out over its last TITLE_OUT_MS. Pure.
 * @param {{ kind: string, at: number, until: number, kicker?: string, main: string, sub?: string, color?: string|null }|null} beat
 * @param {number} now
 */
export function titleCardModel(beat, now) {
  if (!beat || !(now >= beat.at) || !(now < beat.until) || !beat.main) return null;
  const alpha = Math.max(0, Math.min(1, (now - beat.at) / TITLE_IN_MS, (beat.until - now) / TITLE_OUT_MS));
  return { key: `${beat.kind}@${beat.at}:${beat.main}`, kicker: beat.kicker ?? '', main: beat.main, sub: beat.sub ?? '', color: beat.color ?? null, alpha: Math.round(alpha * 20) / 20, fresh: now - beat.at < 450 };
}

let root = null, parts = null;
const SHOWN = () => ({ vis: '', key: '', sub: null, alpha: -1, cls: '' });
let shown = SHOWN();

function build(doc) {
  if (doc.getElementById && !doc.getElementById(TITLE_CARD_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = TITLE_CARD_STYLE_ID;
    st.textContent = TITLE_CARD_CSS;
    (doc.head ?? doc.body)?.append(st);
    if (doc.head) injectEnhancedFonts(doc);
  }
  const part = (cls) => { const n = doc.createElement('div'); n.className = cls; return n; };
  root = part('wb-title-card');
  root.setAttribute?.('aria-hidden', 'true');   // the chat and the mid-screen line say it in words
  const kicker = part('wb-title-kicker'), main = part('wb-title-main'), rule = part('wb-title-rule'), sub = part('wb-title-sub');
  root.append(kicker, main, rule, sub);
  (doc.body ?? doc.documentElement)?.append(root);
  parts = { kicker, main, rule, sub };
}

/** Draw the card for a model (null hides it); `hidden` is the HUD's own hide and the step's fire. AUDIT EG V (c, L7-17;
 *  Elite-Gates.md section 25.7): `still` reduced motion - the port's row or the system's (ui/eliteGates/egAccess.js egReducedMotion,
 *  read here unless the caller says) - the name never flies in and the rule never sweeps: the wake's and the fall's card
 *  in the Spire stood still where its arrival card and THE FALL's did. */
export function drawGateTitleCard(model, { hidden = false, doc = globalThis.document, still = egReducedMotion() } = {}) {
  const want = !hidden && !!model;
  if (!root) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  const vis = want ? 'on' : 'off';
  if (vis !== shown.vis) { shown.vis = vis; root.style.display = want ? '' : 'none'; }
  if (!want || !model) return;
  if (model.key !== shown.key) {
    shown.key = model.key;
    parts.kicker.textContent = model.kicker;
    parts.main.textContent = model.main;
    parts.main.style.color = model.color ?? '';
  }
  if (model.sub !== shown.sub) { shown.sub = model.sub; parts.sub.textContent = model.sub; }
  const cls = `wb-title-card on${model.fresh && !still ? ' in' : ''}${still ? ' still' : ''}`;
  if (cls !== shown.cls) { shown.cls = cls; root.className = cls; }
  if (model.alpha !== shown.alpha) { shown.alpha = model.alpha; root.style.opacity = String(model.alpha); }
}

/** The page is going (a test's reset): the node leaves with it. */
export function destroyGateTitleCard() {
  root?.remove?.();
  root = null; parts = null;
  shown = SHOWN();
}
