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
// WB13c (2026-10-01, Mac: "just overall bring more AAA grade polish to what is already developed"): THE BAR, HONED -
// filmed in Chromium in both skins at a desk, a portrait and a landscape phone (bible/11-Multiplayer/World-Bosses.md
// section 20, WB13c): a TRAILING DAMAGE segment (ui/barLoss.js, the vitals' and the foes' own) over a smooth drain; his
// name on one line and his epithet beneath it; the WARD a state - it fades in, a cage, the fill dimmed under it, and a
// flash when it fails; a CALLOUT that comes in and goes out, with a line filling to its landing, and Dagon's own on a
// red plate; the phase marks spent as he passes them; the marks one line each; the Wrath's countdown its own chip,
// pulsing in its last minute; FELLED, then the bar goes; never over the step's fire; and on a landscape phone no
// marks' row, the bar clear of the crosshair.
//
// Not a DFU member. Ledger A (WB).
import { ATTACK_BY_ID, ATTACKS, PHASE_AT, profileOf, HOST, isDagons } from '../net/gateBrain.js';
import { telegraphAt } from '../net/gateStrike.js';
import { countdownText } from '../net/gateLaw.js';
import { attackColor, crystalColor, STUN_COLOR, WARD_COLOR } from '../world/gateBoss.js';
import { GATE_RING_CSS } from './gateMapMark.js';
import { marksViewOf, markIconHtml } from './gateMarksView.js';   // WB9a: the night's marks under his health, each its sign and name
import { stepGhost } from './barLoss.js';   // WB13c: the trailing damage segment, the vitals' own
import { LOW_HEALTH } from '../world/gateBoss.js';   // WB13e: the bar pulses under his low health
import { injectEnhancedFonts } from './enhancedStyle.js';   // WB13c: the classic face, loaded by the gate's own screens

/** Where it stands: under the compass strip, centred (the gate banner's place - the two never show together: the
 *  banner is the street's, the bar the court's). */
export const BOSS_BAR_TOP = '58px';
export const BOSS_BAR_WIDTH = 460;
/** The Wrath's countdown shows this close to the gate's midnight; WB13c: and pulses in its last WRATH_NEAR_MS. */
export const WRATH_WARN_MS = 5 * 60 * 1000;
export const WRATH_NEAR_MS = 60 * 1000;
/** WB13c: after his fall the bar holds Fallen this long, then fades over FELL_FADE_MS (the damage chart has the court). */
export const FELL_HOLD_MS = 1200;
export const FELL_FADE_MS = 500;
/** WB13c: a callout leaving fades over this long; the bar's first showing comes up over INTRO_MS. */
export const CALLOUT_OUT_MS = 160;
export const INTRO_MS = 800;
/** WB13c: the one-shot flashes - the ward failing, a phase mark spent, a callout coming - each a class held this long by
 *  the fight's clock, then dropped, so the HUD shown again never plays one twice. */
export const FLASH_MS = Object.freeze({ wardBreak: 250, spent: 400, callIn: 160 });
/** The words. */
export const BOSS_BAR_TEXT = Object.freeze({
  warded: 'Warded',
  fallen: 'Felled',   // WB13c: the word a boss bar says
  move: 'Move',   // WB13c: his blow is aimed where I stand
  wrathIn: (left) => `Dagon's Wrath in ${left}`,
  fighters: (n) => (n === 1 ? '1 in the court' : `${n} in the court`),
  // GATE-UX (2026-10-01, Mac: "Remove the text below each boss health bar that shows phase details"): WBX5's phase line
  // ("II - The Burning Court") is gone from the foot - the marks cut in his health say where the phases turn, and a
  // turn is still shown over the screen as it comes (scenes/gateCourt.js courtPhaseCard - WB13e: its card)
  // WB9c: DAGON'S RECKONING on the bar - its name, the crystals still standing and the seconds to its landing; the stun
  // a broken one leaves him in, and its seconds; and the next one's coming, in the foot
  reckon: (name, left, n, secs) => `${name} - ${left} of ${n} ${n === 1 ? 'crystal' : 'crystals'} - ${secs}s`,
  stunned: (secs) => `Stunned - ${secs}s`,
  reckonIn: (left) => `Reckoning in ${left}`,
  // WB11c: HIS HOST on the bar - while his Ward-Bearers hold his ward, how many stand (of how many rose, where this screen
  // saw them rise); the rest of his host standing, in the foot
  bearers: (left, n) => `Ward-Bearers - ${n > left ? `${left} of ${n}` : left} ${left === 1 ? 'stands' : 'stand'}`,
  host: (n) => `His host: ${n}`,
});

const css = (c) => `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
const WARD_CSS = css(WARD_COLOR);

/** PLUS-DRESS (2026-09-26): the bar's own sheet - what was written inline on each part, moved to a class so a skin's
 *  sheet can dress it (the Enhanced Plus sheet does: ui/enhancedPlusStyle.js ONLINE_DRESS_CSS). Only what MOVES stays
 *  inline: the fill's and the ghost's width, the callout's colour and line, the marks' places and the bar's fade.
 *  WB13c: the ward, the spent marks, the callout's coming and going, Dagon's plate, the Wrath's last minute and the
 *  bar's first showing are classes. */
export const BOSS_BAR_STYLE_ID = 'dagger-gate-bar-style';
export const BOSS_BAR_CSS = `
.wb-boss-bar { position: fixed; left: 50%; top: ${BOSS_BAR_TOP}; transform: translateX(-50%); width: ${BOSS_BAR_WIDTH}px; max-width: 88vw;
  pointer-events: none; z-index: 30; font: 600 13px 'Cormorant', Georgia, serif; letter-spacing: 0.08em; color: #f3d9c4;
  text-shadow: 0 0 3px #000, 0 0 8px rgba(0,0,0,0.9); text-align: center; }
.wb-boss-name { font-size: 16px; letter-spacing: 0.12em; text-transform: uppercase; color: ${GATE_RING_CSS}; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; text-shadow: 0 0 3px #000, 0 0 10px rgba(255,70,30,0.5); }
.wb-boss-sub { font-size: 12px; letter-spacing: 0.06em; line-height: 1.2; color: #d9b9a0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wb-boss-marks { display: flex; flex-wrap: wrap; justify-content: center; gap: 1px 14px; margin: 1px 0 3px; }
.wb-boss-chip { flex: 0 0 auto; text-align: left; line-height: 1.15; }
.wb-boss-chip-head { display: flex; align-items: center; gap: 4px; min-width: 0; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap; }
.wb-boss-chip-icon { flex: 0 0 13px; height: 13px; display: flex; align-items: center; }
.wb-boss-chip-name { overflow: hidden; text-overflow: ellipsis; }
.wb-boss-track { position: relative; height: 12px; margin: 4px 0 3px; border: 1px solid rgba(255,120,60,0.55);
  background: rgba(20,4,2,0.72); box-shadow: 0 0 10px rgba(0,0,0,0.8), inset 0 0 6px rgba(0,0,0,0.9); }
.wb-boss-ghost { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: rgba(255,232,196,0.78); }
.wb-boss-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 100%;
  background: linear-gradient(180deg, #ff7a3a 0%, #c81e0c 55%, #6e0a04 100%); transition: width 250ms cubic-bezier(.2,.7,.3,1), filter 160ms; }
.wb-boss-mark { position: absolute; top: -2px; bottom: -2px; width: 2px; background: rgba(255,230,200,0.75); transition: opacity 300ms; }
.wb-boss-mark.spent { opacity: 0.35; }
.wb-boss-mark.spent.now { animation: wb-mark-spent ${FLASH_MS.spent}ms ease-out; }
@keyframes wb-mark-spent { 0% { opacity: 1; background: #fff; box-shadow: 0 0 8px 2px #fff; } 100% { opacity: 0.35; } }
.wb-boss-ward { position: absolute; inset: -2px; border: 2px solid rgba(255,220,130,0.95); box-shadow: 0 0 12px rgba(255,210,120,0.85);
  opacity: 0; transform: scale(1.04); transition: opacity 160ms ease-out, transform 160ms ease-out; }
.wb-boss-bar.warded .wb-boss-ward { opacity: 1; transform: scale(1); }
.wb-boss-bar.warded .wb-boss-fill { filter: saturate(0.45) brightness(0.8); }
.wb-boss-bar.wbreak .wb-boss-track { animation: wb-ward-break ${FLASH_MS.wardBreak}ms ease-out; }
@keyframes wb-ward-break { from { box-shadow: 0 0 0 2px #fff, 0 0 22px 6px rgba(255,244,214,0.95); } }
.wb-boss-callout { display: inline-block; font-size: 16px; text-transform: uppercase; min-height: 18px; margin-top: 1px; }
.wb-boss-callout-line { height: 2px; margin-top: 1px; background: currentColor; transform-origin: left center; transform: scaleX(0); opacity: 0.85; }
.wb-boss-callout.cin { animation: wb-callout-in 140ms ease-out; }
@keyframes wb-callout-in { from { opacity: 0; transform: translateY(-4px) scale(1.06); } }
.wb-boss-callout.cout { opacity: 0; transition: opacity ${CALLOUT_OUT_MS}ms ease-in; }
.wb-boss-callout.dagon .wb-boss-callout-text { display: inline-block; padding: 1px 10px; font-size: 18px; color: #f6ead2; background: rgba(130,10,10,0.88);
  box-shadow: 0 0 10px rgba(0,0,0,0.85); animation: wb-dagon-plate 250ms ease-in-out infinite alternate; }
@keyframes wb-dagon-plate { from { background: rgba(110,6,6,0.88); } to { background: rgba(170,16,16,0.95); } }
.wb-boss-move { display: none; margin-left: 8px; padding: 0 6px; font-size: 13px; letter-spacing: 0.14em; color: #fff4e6; background: rgba(214,58,12,0.92);
  vertical-align: 2px; box-shadow: 0 0 8px rgba(255,90,20,0.7); }
.wb-boss-callout.aimed .wb-boss-move { display: inline-block; animation: wb-move 250ms ease-in-out infinite alternate; }
@keyframes wb-move { from { opacity: 0.75; } to { opacity: 1; } }
.wb-boss-foot { display: flex; justify-content: center; flex-wrap: wrap; gap: 3px 6px; margin-top: 2px; font-size: 12px; font-variant-numeric: lining-nums tabular-nums; }
.wb-boss-tag { padding: 0 6px; line-height: 16px; background: rgba(20,4,2,0.55); border: 1px solid rgba(255,120,60,0.22); opacity: 0.9; }
.wb-boss-wrath { color: #ff9a7a; border-color: rgba(255,90,60,0.55); opacity: 1; }
.wb-boss-wrath.near { color: #fff0e8; background: rgba(150,14,8,0.85); animation: wb-wrath-near 500ms ease-in-out infinite alternate; }
.wb-boss-host.near { color: #fff6dc; animation: wb-wrath-near 500ms ease-in-out infinite alternate; }
.wb-boss-bar.brass .wb-boss-host.near { animation-name: wb-brass-near; }
@keyframes wb-brass-near { from { background: rgba(90,64,10,0.8); } to { background: rgba(170,128,30,0.95); } }
@keyframes wb-wrath-near { from { background: rgba(110,8,6,0.8); } to { background: rgba(190,20,12,0.95); } }
.wb-boss-bar.intro .wb-boss-fill { animation: wb-fill-in 700ms cubic-bezier(.2,.7,.3,1); }
.wb-boss-bar.low .wb-boss-fill { animation: wb-low 650ms ease-in-out infinite alternate; }
@keyframes wb-low { to { filter: brightness(1.55) saturate(1.2); } }
.wb-boss-bar.intro .wb-boss-name { animation: wb-name-in 250ms ease-out; }
@keyframes wb-fill-in { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes wb-name-in { from { opacity: 0; letter-spacing: 0.3em; } }
/* SD8c: the Brass Remnant's bar - the same readout in the Hour's brass (its model's \`theme\`, ui/sdRemnantBar.js) */
.wb-boss-bar.brass { color: #f2e2bc; }
.wb-boss-bar.brass .wb-boss-name { color: #e8c060; text-shadow: 0 0 3px #000, 0 0 10px rgba(230,180,70,0.5); }
.wb-boss-bar.brass .wb-boss-sub { color: #d8c49a; }
.wb-boss-bar.brass .wb-boss-track { border-color: rgba(230,190,90,0.55); background: rgba(16,12,4,0.75); }
.wb-boss-bar.brass .wb-boss-fill { background: linear-gradient(180deg, #ffd977 0%, #b8862a 55%, #4a3208 100%); }
.wb-boss-bar.brass .wb-boss-tag { background: rgba(16,12,4,0.55); border-color: rgba(230,190,90,0.25); }
.wb-boss-bar.brass .wb-boss-wrath { color: #ffd2a0; border-color: rgba(255,160,80,0.55); }
/* SERPENT1: the sea serpent's bar - the same readout in the sea's colours (its model's \`theme\`, ui/serpentBar.js) */
.wb-boss-bar.sea { color: #d6efe8; }
.wb-boss-bar.sea .wb-boss-name { color: #8fe3cf; text-shadow: 0 0 3px #000, 0 0 10px rgba(40,200,170,0.5); }
.wb-boss-bar.sea .wb-boss-sub { color: #a9cfc4; }
.wb-boss-bar.sea .wb-boss-track { border-color: rgba(90,210,190,0.55); background: rgba(2,14,18,0.75); }
.wb-boss-bar.sea .wb-boss-fill { background: linear-gradient(180deg, #4fe0c0 0%, #1a8a86 55%, #0b3a4a 100%); }
.wb-boss-bar.sea .wb-boss-tag { background: rgba(2,14,18,0.55); border-color: rgba(90,210,190,0.25); }
.wb-boss-bar.sea .wb-boss-wrath { color: #ffd2a0; border-color: rgba(255,160,80,0.55); }
@media (max-width: 640px) {
  .wb-boss-bar { top: 72px; }
  .wb-boss-marks { column-gap: 10px; }
  .wb-boss-chip-head { font-size: 10px; letter-spacing: 0.06em; }
}
@media (max-height: 480px) {
  .wb-boss-bar { top: 44px; }
  .wb-boss-marks { display: none !important; }
}
`;

/**
 * What the bar says now, or null (no fight heard). `frac` his health's share, `marks` the phase marks, `warded` while
 * the ward stands, `callout` the attack being wound up ({ text, color } - its name in its colour), `wrath` the
 * countdown (null until WRATH_WARN_MS before the midnight), `fighters` how many the fight holds. WB8b: his marks - the
 * aspect's epithet after his name (`epithet`, none unmarked), the trials joined (`trials`), and each attack by the
 * name and in the colour his aspect gives it. WB9a: `marksView` - the night's marks as the row under his health draws
 * them (ui/gateMarksView.js marksViewOf: his aspect's sign, name and element in its colour, then each trial's sign,
 * name and line), null for the Warden unmarked. WB13c: `epithetColor` his aspect's; the callout's `t` (its wind-up's
 * share, its line's reach - none for a stun or his bearers), `dagon` (Dagon's own, on a plate) and `move` (his blow
 * named is the one on my feet: `aimed`, scenes/gateCourt.js perilAt's name); `spent` the phase marks he has passed;
 * `wrathNear` its last minute; `alpha` the bar's fade after his fall; `now` the clock it was read at (the trailing
 * segment's).
 * @param {any} s the court's state (net/gateLink.js GateState) @param {number} now the relay's clock
 * @param {{ name: string, title: string }} boss net/gateLaw.js gateBossOf
 * @param {string|null} [aimed] the name of the blow still to land on my feet
 */
export function bossBarModel(s, now, boss, aimed = null) {
  if (!s || s.day === null || !boss) return null;
  const P = profileOf(s);
  const frac = s.fell ? 0 : s.max > 0 ? Math.max(0, Math.min(1, s.hp / s.max)) : 1;
  const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
  const tel = A ? telegraphAt(atk, s.phase, now) : null;
  let callout = !s.fell && A && tel && !tel.over ? { text: P.atk[A.key].name, color: css(attackColor(A, P)), t: now < atk.at ? tel.t : 1, dagon: isDagons(A), move: !!aimed && aimed === P.atk[A.key].name } : null;
  // WB9c: the Reckoning winding up says what is left to break and how long there is; a stun says itself
  if (!s.fell && A === ATTACKS.reckon && tel && now < atk.at && s.cx) {
    let left = 0;
    for (const q of s.cx.c) if (q[2] > 0) left++;
    callout = { text: BOSS_BAR_TEXT.reckon(P.atk.reckon.name, left, s.cx.c.length, Math.ceil((atk.at - now) / 1000)), color: css(crystalColor(P)), t: tel.t, dagon: true, move: false };
  } else if (!s.fell && s.wrath == null && now < (s.stunUntil ?? 0)) callout = { text: BOSS_BAR_TEXT.stunned(Math.ceil((s.stunUntil - now) / 1000)), color: css(STUN_COLOR), t: null, dagon: false, move: false };
  // WB11c: his Ward-Bearers holding his ward say themselves where nothing of his is being wound up
  let bearers = 0, others = 0;
  for (const a of s.lg?.ads ?? []) { if (a.k === HOST.bearer) bearers++; else others++; }
  if (!s.fell && s.wrath == null && bearers > 0 && now < s.shieldUntil && !callout) callout = { text: BOSS_BAR_TEXT.bearers(bearers, s.lg?.ward?.n ?? bearers), color: css(WARD_COLOR), t: null, dagon: false, move: false };
  const toWrath = Number.isFinite(s.wrathAt) ? s.wrathAt - now : Infinity;
  const toReckon = !s.fell && s.wrath == null && s.phase >= 3 && s.rk > now ? s.rk - now : null;
  const since = s.fell ? now - (Number.isFinite(s.fell.at) ? s.fell.at : now) : 0;
  const alpha = s.fell ? Math.max(0, Math.min(1, 1 - (since - FELL_HOLD_MS) / FELL_FADE_MS)) : 1;
  const view = P.md ? marksViewOf(P.md) : null;   // WB9a: the row under his health - made once a marks array
  return {
    name: boss.name, title: boss.title, frac, marks: [...PHASE_AT], phase: s.phase,
    spent: PHASE_AT.map((_, i) => s.phase > i + 1),   // WB13c: the marks he has passed
    epithet: P.md ? P.aspect.epithet : '', trials: P.trialsLine,   // AUDIT PRE-MERGE 0929 W2-2: joined once, on the profile
    epithetColor: view?.aspect.color ?? null, marksView: view,
    warded: !s.fell && now < s.shieldUntil, fallen: !!s.fell, callout,
    wrath: !s.fell && s.wrath == null && toWrath <= WRATH_WARN_MS ? BOSS_BAR_TEXT.wrathIn(countdownText(toWrath)) : null,
    wrathNear: !s.fell && s.wrath == null && toWrath <= WRATH_NEAR_MS,
    fighters: s.fighters | 0,
    reckonIn: toReckon !== null ? BOSS_BAR_TEXT.reckonIn(countdownText(toReckon)) : null,   // WB9c
    host: !s.fell && s.wrath == null && others > 0 ? BOSS_BAR_TEXT.host(others) : null,   // WB11c: the rest of his host standing
    alpha: Math.round(alpha * 20) / 20, now,
    low: !s.fell && frac > 0 && frac < LOW_HEALTH,   // WB13e: the bar pulses
  };
}

let root = null, parts = null;
/** What the node shows, so each part is written only when it changes - every field unlike any model's, so a fight's
 *  first draw writes the whole bar (WB13c: a fight gone resets it, and the next fight's bar never shows the last's). */
const SHOWN = () => ({ vis: '', name: null, sub: null, subColor: null, marks: null, spent: null, ticks: null, spentAt: null, spentNew: null, marksAt: null,
  frac: -1, ghost: -1, g: null, at: null, warded: null, breakAt: null, rootCls: null,
  callout: null, calloutColor: null, calloutCls: null, calloutT: -1, inAt: null, outAt: null, dagon: false, move: false,
  tags: [null, null, null, null], wrathNear: null, hostNear: null, alpha: -1, introAt: null });
let shown = SHOWN();

function build(doc) {
  if (doc.getElementById && !doc.getElementById(BOSS_BAR_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = BOSS_BAR_STYLE_ID;
    st.textContent = BOSS_BAR_CSS;
    (doc.head ?? doc.body)?.append(st);
    if (doc.head) injectEnhancedFonts(doc);   // WB13c: Cormorant on the classic skin too (it came only if another window had asked)
  }
  const part = (cls, tag = 'div') => { const n = doc.createElement(tag); n.className = cls; return n; };
  root = part('wb-boss-bar');
  const name = part('wb-boss-name');
  // WB13c: his epithet in his aspect's colour on its own line under his name (name, epithet and title wrapped in two);
  // the Warden unmarked has his title there
  const sub = part('wb-boss-sub');
  const track = part('wb-boss-track');
  const ghost = part('wb-boss-ghost');   // WB13c: the trailing damage segment, under the fill
  const fill = part('wb-boss-fill');
  const ward = part('wb-boss-ward');
  track.append(ghost, fill);
  const ticks = PHASE_AT.map((m) => {
    const tick = part('wb-boss-mark');
    tick.style.left = `${(m * 100).toFixed(1)}%`;
    track.append(tick);
    return tick;
  });
  track.append(ward);
  // WB9a (Mac: "Can we add the modifers below his health bar?"): THE NIGHT'S MARKS UNDER HIS HEALTH - a chip a mark
  // (his aspect, then his trials), each its sign and name (WB13c: the line under each gone - the card says what each
  // does); the row hidden for the Warden unmarked
  const marks = part('wb-boss-marks');
  const chips = [0, 1, 2].map(() => {
    const chip = part('wb-boss-chip'), head = part('wb-boss-chip-head'), icon = part('wb-boss-chip-icon'), label = part('wb-boss-chip-name');
    head.append(icon, label);
    chip.append(head);
    marks.append(chip);
    return { chip, icon, label };
  });
  marks.style.display = 'none';
  const callout = part('wb-boss-callout'), calloutText = part('wb-boss-callout-text', 'span'), move = part('wb-boss-move', 'span'), calloutLine = part('wb-boss-callout-line');
  move.textContent = BOSS_BAR_TEXT.move;
  callout.append(calloutText, move, calloutLine);
  // WB13c: the foot's chips - the court's fighters, his host standing, the next Reckoning and the Wrath's countdown
  const foot = part('wb-boss-foot');
  const tags = ['wb-boss-tag', 'wb-boss-tag wb-boss-host', 'wb-boss-tag', 'wb-boss-tag wb-boss-wrath'].map((cls) => { const t = part(cls, 'span'); t.style.display = 'none'; return t; });
  foot.append(...tags);
  root.append(name, sub, track, marks, callout, foot);
  (doc.body ?? doc.documentElement)?.append(root);
  parts = { name, sub, marks, chips, ghost, fill, ward, ticks, callout, calloutText, move, calloutLine, foot, tags };
}

/** WB9a: one chip of the marks' row - a mark's sign and name (the aspect's in its colour) - or hidden (no mark for it). */
function writeChip(c, m) {
  if (!m) { c.chip.style.display = 'none'; return; }
  c.chip.style.display = '';
  c.icon.innerHTML = markIconHtml(m, 12);   // SD18b: the Hour's own signs
  c.icon.style.color = m.kind === 'aspect' ? m.color : '#ffb27a';
  c.label.textContent = m.name;
  c.label.style.color = m.kind === 'aspect' ? m.color : '';
}

/** WB13c: a one-shot flash stands from `at` for `ms` of the fight's clock. */
const flashing = (at, now, ms) => at !== null && now - at < ms;

/** Draw the bar for a model (null hides it); `hidden` is the HUD's own hide. */
export function drawGateBossBar(model, { hidden = false, doc = globalThis.document } = {}) {
  const want = !hidden && !!model && (model.alpha ?? 1) > 0;
  if (!root) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  const vis = want ? 'on' : 'off';
  if (vis !== shown.vis) { shown.vis = vis; root.style.display = want ? '' : 'none'; }
  if (!model && shown.introAt !== null) {   // WB13c: a fight gone - the next one's bar comes up whole, and again
    shown = { ...SHOWN(), vis: shown.vis };
    parts.calloutText.textContent = '';
  }
  if (!want || !model) return;
  const now = Number.isFinite(model.now) ? model.now : 0;
  // WB13c: THE FIRST SHOWING - his name comes in and his health sweeps up (never on every showing of the HUD)
  if (shown.introAt === null) shown.introAt = now;
  if (model.name !== shown.name) { shown.name = model.name; parts.name.textContent = model.name; }
  // WB8b: "the Rime-Wrought" - WB13c: under his name, a line's head ("The Rime-Wrought"), in his aspect's colour
  const sub = model.epithet ? `${model.epithet.charAt(0).toUpperCase()}${model.epithet.slice(1)}` : model.title;
  if (sub !== shown.sub) { shown.sub = sub; parts.sub.textContent = sub; }
  const subColor = model.epithet ? model.epithetColor ?? '' : '';
  if (subColor !== shown.subColor) { shown.subColor = subColor; parts.sub.style.color = subColor; }
  const view = model.marksView ?? null, marksKey = view?.key ?? '';
  if (marksKey !== shown.marks) {   // WB9a: written when the night's marks change - never a frame
    shown.marks = marksKey;
    parts.marks.style.display = view ? '' : 'none';
    const all = view ? [view.aspect, ...view.trials] : [];
    parts.chips.forEach((c, i) => writeChip(c, all[i] ?? null));
  }
  // SD8c: THE PHASE MARKS WHERE THE MODEL CUTS THEM (the Brass Remnant turns at 70% and 35%, not the gate's thirds) -
  // written when they change, never a frame
  const at = Array.isArray(model.marks) && model.marks.length === parts.ticks.length ? model.marks : PHASE_AT;
  const marksAt = at.join(',');
  if (marksAt !== shown.marksAt) { shown.marksAt = marksAt; parts.ticks.forEach((tick, i) => { tick.style.left = `${(at[i] * 100).toFixed(1)}%`; }); }
  // WB13c: THE PHASE MARKS SPENT as he passes them - each flashes as it is crossed (never one spent before I came)
  const spent = (model.spent ?? []).map((x) => (x ? 1 : 0)).join('');
  if (spent !== shown.spent) {
    if (shown.spent !== null) { shown.spentNew = [...spent].map((c, i) => c === '1' && shown.spent[i] !== '1'); shown.spentAt = now; }
    shown.spent = spent;
  }
  const ticks = parts.ticks.map((_, i) => (spent[i] === '1' ? (shown.spentNew?.[i] && flashing(shown.spentAt, now, FLASH_MS.spent) ? 'wb-boss-mark spent now' : 'wb-boss-mark spent') : 'wb-boss-mark'));
  const tickKey = ticks.join('|');
  if (tickKey !== shown.ticks) { shown.ticks = tickKey; ticks.forEach((c, i) => { parts.ticks[i].className = c; }); }
  const frac = Math.round(model.frac * 1000) / 1000;
  if (frac !== shown.frac) { shown.frac = frac; parts.fill.style.width = `${(frac * 100).toFixed(1)}%`; }
  // WB13c: THE TRAILING SEGMENT - where his health was before a blow, held, then drained (ui/barLoss.js stepGhost)
  const dt = shown.at === null ? 0 : Math.max(0, Math.min(0.25, (now - shown.at) / 1000));
  shown.at = now;
  shown.g = stepGhost(shown.g, frac * 100, dt);
  const ghost = Math.round(shown.g.at * 10) / 10;
  if (ghost !== shown.ghost) { shown.ghost = ghost; parts.ghost.style.width = `${ghost.toFixed(1)}%`; }
  // WB13c: THE WARD - a state (it comes in and goes); its failing flashes the track
  if (model.warded !== shown.warded) {
    if (shown.warded && !model.warded && !model.fallen) shown.breakAt = now;
    shown.warded = model.warded;
  }
  const cls = `wb-boss-bar${model.theme ? ` ${model.theme}` : ''}${model.warded ? ' warded' : ''}${flashing(shown.breakAt, now, FLASH_MS.wardBreak) ? ' wbreak' : ''}${flashing(shown.introAt, now, INTRO_MS) ? ' intro' : ''}${model.low ? ' low' : ''}`;
  if (cls !== shown.rootCls) { shown.rootCls = cls; root.className = cls; }
  const alpha = model.alpha ?? 1;
  if (alpha !== shown.alpha) { shown.alpha = alpha; root.style.opacity = alpha < 1 ? String(alpha) : ''; }
  // THE CALLOUT - WB13c: in on a change, out over CALLOUT_OUT_MS, a line filling to its landing, Dagon's on a plate
  const text = model.fallen ? BOSS_BAR_TEXT.fallen : model.callout ? model.callout.text : model.warded ? BOSS_BAR_TEXT.warded : '';
  const color = model.fallen ? model.ringCss ?? GATE_RING_CSS : model.callout ? model.callout.color : model.warded ? WARD_CSS : model.ringCss ?? GATE_RING_CSS;   // SERPENT1: the sea's ring colour
  if (text) {
    shown.outAt = null;
    if (text !== shown.callout) {
      const fresh = !shown.callout || shown.callout.split(' - ')[0] !== text.split(' - ')[0];   // a countdown ticking is the same callout
      shown.callout = text; parts.calloutText.textContent = text;
      if (fresh) shown.inAt = now;
    }
    shown.dagon = !!model.callout?.dagon && !model.fallen; shown.move = !!model.callout?.move && !model.fallen;
  } else if (shown.callout) {   // going: the old words, their plate and their line held while they fade
    if (shown.outAt === null) shown.outAt = now;
    else if (now - shown.outAt >= CALLOUT_OUT_MS) { shown.callout = ''; shown.outAt = null; shown.dagon = shown.move = false; parts.calloutText.textContent = ''; }
  }
  const ccls = `wb-boss-callout${flashing(shown.inAt, now, FLASH_MS.callIn) && shown.outAt === null ? ' cin' : ''}${shown.dagon ? ' dagon' : ''}${shown.move ? ' aimed' : ''}${shown.outAt !== null ? ' cout' : ''}`;
  if (ccls !== shown.calloutCls) { shown.calloutCls = ccls; parts.callout.className = ccls; }
  if (text && color !== shown.calloutColor) { shown.calloutColor = color; parts.callout.style.color = color; }
  const t = shown.outAt !== null ? shown.calloutT : text && model.callout && Number.isFinite(model.callout.t) && !model.fallen ? Math.round(model.callout.t * 50) / 50 : 0;
  if (t !== shown.calloutT) { shown.calloutT = t; parts.calloutLine.style.transform = `scaleX(${t})`; }
  // THE FOOT - WB13c: a chip each, the Wrath's pulsing in its last minute (WB9c: the next Reckoning; GATE-UX: no phase
  // line; WB11c: his host standing)
  const tags = [model.fightersLine ?? BOSS_BAR_TEXT.fighters(model.fighters), model.fallen ? '' : model.host ?? '', model.fallen ? '' : model.reckonIn ?? '', model.wrath ?? ''];   // SERPENT1: the sea's own count
  for (let i = 0; i < tags.length; i++) {
    if (tags[i] === shown.tags[i]) continue;
    shown.tags[i] = tags[i];
    parts.tags[i].textContent = tags[i];
    parts.tags[i].style.display = tags[i] ? '' : 'none';
  }
  const near = !!model.wrath && !!model.wrathNear;
  if (near !== shown.wrathNear) { shown.wrathNear = near; parts.tags[3].className = near ? 'wb-boss-tag wb-boss-wrath near' : 'wb-boss-tag wb-boss-wrath'; }
  // AUDIT SD II (L6 F6): the host's chip pulses as its own clock runs out (the Hour's fallen Echo rising)
  const hostNear = !!model.host && !!model.hostNear && !model.fallen;
  if (hostNear !== shown.hostNear) { shown.hostNear = hostNear; parts.tags[1].className = hostNear ? 'wb-boss-tag wb-boss-host near' : 'wb-boss-tag wb-boss-host'; }
}

/** The page is going (a test's reset): the node leaves with it. */
export function destroyGateBossBar() {
  root?.remove?.();
  root = null; parts = null;
  shown = SHOWN();
}
