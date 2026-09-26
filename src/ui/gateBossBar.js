// @ts-check
// WB4 (2026-09-25, Mac: "a large boss arena with an oversized enemy"): THE BOSS'S BAR - his name and title over his
// health across the top of the screen, the two phase marks cut in it, the ward's gold over it while he stands
// shielded, the attack he is winding up said under it in its own colour, and the Wrath's countdown when the gate's
// midnight nears. Design: bible/11-Multiplayer/World-Bosses.md section 5.
//
// A READOUT, NOT A WINDOW (the gate banner's law, ui/gateBanner.js): no click, no overlay stack, one node made on the
// first word and UPDATED, NOT REBUILT - each part written only when it changes - hidden (never removed) when there is
// nothing to show, and hidden with the HUD. In every skin: the fight must be read whatever the player plays in.
//
// `bossBarModel` is pure - the court's state and the clock in, what the bar says out; the pins read it.
//
// Not a DFU member. Ledger A (WB).
import { ATTACK_BY_ID, PHASE_AT } from '../net/gateBrain.js';
import { telegraphAt } from '../net/gateStrike.js';
import { countdownText } from '../net/gateLaw.js';
import { ATTACK_COLORS } from '../world/gateBoss.js';
import { GATE_RING_CSS } from './gateMapMark.js';

/** Where it stands: under the compass strip, centred (the gate banner's place - the two never show together: the
 *  banner is the street's, the bar the court's). */
export const BOSS_BAR_TOP = '58px';
export const BOSS_BAR_WIDTH = 460;
/** The Wrath's countdown shows this close to the gate's midnight. */
export const WRATH_WARN_MS = 5 * 60 * 1000;
/** The words. */
export const BOSS_BAR_TEXT = Object.freeze({
  warded: 'Warded',
  fallen: 'Fallen',
  wrathIn: (left) => `Dagon's Wrath in ${left}`,
  fighters: (n) => (n === 1 ? '1 in the court' : `${n} in the court`),
});

const css = (c) => `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;

/** PLUS-DRESS (2026-09-26): the bar's own sheet - what was written inline on each part, moved to a class so a skin's
 *  sheet can dress it (the Enhanced Plus sheet does: ui/enhancedPlusStyle.js ONLINE_DRESS_CSS). Only what MOVES stays
 *  inline: the fill's width, the ward shown or not, the callout's colour and the marks' places. */
export const BOSS_BAR_STYLE_ID = 'dagger-gate-bar-style';
export const BOSS_BAR_CSS = `
.wb-boss-bar { position: fixed; left: 50%; top: ${BOSS_BAR_TOP}; transform: translateX(-50%); width: ${BOSS_BAR_WIDTH}px; max-width: 88vw;
  pointer-events: none; z-index: 30; font: 600 13px 'Cormorant', Georgia, serif; letter-spacing: 0.08em; color: #f3d9c4;
  text-shadow: 0 0 3px #000, 0 0 8px rgba(0,0,0,0.9); text-align: center; }
.wb-boss-name { font-size: 15px; text-transform: uppercase; color: ${GATE_RING_CSS}; text-shadow: 0 0 3px #000, 0 0 10px rgba(255,70,30,0.5); }
.wb-boss-track { position: relative; height: 12px; margin: 4px 0 3px; border: 1px solid rgba(255,120,60,0.55);
  background: rgba(20,4,2,0.72); box-shadow: 0 0 10px rgba(0,0,0,0.8), inset 0 0 6px rgba(0,0,0,0.9); }
.wb-boss-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 100%;
  background: linear-gradient(180deg, #ff7a3a 0%, #c81e0c 55%, #6e0a04 100%); transition: width 180ms linear; }
.wb-boss-mark { position: absolute; top: -2px; bottom: -2px; width: 2px; background: rgba(255,230,200,0.75); }
.wb-boss-ward { position: absolute; inset: -2px; border: 2px solid rgba(255,220,130,0.95); box-shadow: 0 0 12px rgba(255,210,120,0.85); }
.wb-boss-callout { font-size: 16px; text-transform: uppercase; min-height: 18px; }
.wb-boss-foot { font-size: 12px; opacity: 0.85; }
`;

/**
 * What the bar says now, or null (no fight heard). `frac` his health's share, `marks` the phase marks, `warded` while
 * the ward stands, `callout` the attack being wound up ({ text, color } - its name in its colour), `wrath` the
 * countdown (null until WRATH_WARN_MS before the midnight), `fighters` how many the fight holds.
 * @param {any} s the court's state (net/gateLink.js GateState) @param {number} now the relay's clock
 * @param {{ name: string, title: string }} boss net/gateLaw.js gateBossOf
 */
export function bossBarModel(s, now, boss) {
  if (!s || s.day === null || !boss) return null;
  const frac = s.fell ? 0 : s.max > 0 ? Math.max(0, Math.min(1, s.hp / s.max)) : 1;
  const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
  const tel = A ? telegraphAt(atk, s.phase, now) : null;
  const callout = !s.fell && A && tel && !tel.over ? { text: A.name, color: css(ATTACK_COLORS[A.key]) } : null;
  const toWrath = Number.isFinite(s.wrathAt) ? s.wrathAt - now : Infinity;
  return {
    name: boss.name, title: boss.title, frac, marks: [...PHASE_AT], phase: s.phase,
    warded: !s.fell && now < s.shieldUntil, fallen: !!s.fell, callout,
    wrath: !s.fell && s.wrath == null && toWrath <= WRATH_WARN_MS ? BOSS_BAR_TEXT.wrathIn(countdownText(toWrath)) : null,
    fighters: s.fighters | 0,
  };
}

let root = null, parts = null;
let shown = { vis: '', name: '', frac: -1, warded: null, callout: '', calloutColor: '', foot: '' };

function build(doc) {
  if (doc.getElementById && !doc.getElementById(BOSS_BAR_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = BOSS_BAR_STYLE_ID;
    st.textContent = BOSS_BAR_CSS;
    (doc.head ?? doc.body)?.append(st);
  }
  const part = (cls) => { const n = doc.createElement('div'); n.className = cls; return n; };
  root = part('wb-boss-bar');
  const name = part('wb-boss-name');
  const track = part('wb-boss-track');
  const fill = part('wb-boss-fill');
  const ward = part('wb-boss-ward');
  ward.style.display = 'none';
  track.append(fill);
  for (const m of PHASE_AT) {
    const tick = part('wb-boss-mark');
    tick.style.left = `${(m * 100).toFixed(1)}%`;
    track.append(tick);
  }
  track.append(ward);
  const callout = part('wb-boss-callout');
  const foot = part('wb-boss-foot');
  root.append(name, track, callout, foot);
  (doc.body ?? doc.documentElement)?.append(root);
  parts = { name, fill, ward, callout, foot };
}

/** Draw the bar for a model (null hides it); `hidden` is the HUD's own hide. */
export function drawGateBossBar(model, { hidden = false, doc = globalThis.document } = {}) {
  const want = !hidden && !!model;
  if (!root) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  const vis = want ? 'on' : 'off';
  if (vis !== shown.vis) { shown.vis = vis; root.style.display = want ? '' : 'none'; }
  if (!want || !model) return;
  const name = `${model.name} - ${model.title}`;
  if (name !== shown.name) { shown.name = name; parts.name.textContent = name; }
  const frac = Math.round(model.frac * 1000) / 1000;
  if (frac !== shown.frac) { shown.frac = frac; parts.fill.style.width = `${(frac * 100).toFixed(1)}%`; }
  if (model.warded !== shown.warded) { shown.warded = model.warded; parts.ward.style.display = model.warded ? '' : 'none'; }
  const callout = model.fallen ? BOSS_BAR_TEXT.fallen : model.callout ? model.callout.text : model.warded ? BOSS_BAR_TEXT.warded : '';
  const color = model.callout && !model.fallen ? model.callout.color : GATE_RING_CSS;
  if (callout !== shown.callout || color !== shown.calloutColor) {
    shown.callout = callout; shown.calloutColor = color;
    parts.callout.textContent = callout;
    parts.callout.style.color = color;
  }
  const foot = [BOSS_BAR_TEXT.fighters(model.fighters), model.wrath].filter(Boolean).join('  -  ');
  if (foot !== shown.foot) { shown.foot = foot; parts.foot.textContent = foot; }
}

/** The page is going (a test's reset): the node leaves with it. */
export function destroyGateBossBar() {
  root?.remove?.();
  root = null; parts = null;
  shown = { vis: '', name: '', frac: -1, warded: null, callout: '', calloutColor: '', foot: '' };
}
