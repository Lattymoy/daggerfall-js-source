// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 12): THE KETCH ON THE SCREEN - two readouts, both the page's
// law for a HUD (ui/gate/gateBanner.js): no click, no overlay stack, one node made on the first word and UPDATED, NOT
// REBUILT, hidden (never removed) with nothing to say and with the HUD.
//
//   THE VOYAGE'S TRACKER (drawKetchHud, over its pure model ketchHudModel): the ship's name, the stage the crew stands at
//     and what it asks - the Watch's wave and the constructs still standing; the Hammer Wardens; the engine's cells set of
//     those it needs, the cradles charged, the cells lying loose; the Sailwalk and the bosun's line; the Warden's phase
//     and what it asks (the false resonators, the forks); the cabin open - and the cell in MY hands and how to let it go,
//     the places this ship's crew has taken of KT_CREW_MAX (AUDIT KETCH L3-8: the door's count, said as aboard), and the clock (the Ketch weighing anchor; the crews' last minutes).
//   THE TONAL WARDEN'S BAR (wardenBarModel - the gate's boss bar, ui/gate/gateBossBar.js drawGateBossBar, in the Hour's
//     brass): its name over its phase, its health cut at its two turns, the ward while the Discord holds it, the blow it
//     winds up named in its colour with a line filling to its landing (the Keel-Song with its forks still standing), the
//     stun, the resonators true or the forks standing, and the end's countdown.
//
// Both models are pure - the link's state (net/ketch/ketchLink.js) and the relay's clock in. Not a DFU member. Ledger A
// (KETCH).
import { KT_STAGE, KT_CREW_MAX, KT_WATCH_WAVES, ketchVoyageOf } from '../../net/ketch/ketchLaw.js';
import { t } from '../../systems/textManager.js';
import { KT_WORDS, ketchWhen, ketchStageName, ketchPhaseName, ketchBlowName, ketchKindName } from '../../systems/ketch/ketchWords.js';
import { KT_KIND_BY_K } from '../../net/ketch/ketchConstructs.js';
import { KW_PHASE_AT, KW_BLOW_BY_A, KW_BLOWS, KW_FORKS_CLOSE_MS } from '../../net/ketch/ketchWarden.js';
import { ktBlowDone } from '../../net/ketch/ketchLink.js';
import { countdownText } from '../../net/gate/gateLaw.js';
import { FELL_HOLD_MS, FELL_FADE_MS } from '../gate/gateBossBar.js';
import { LOW_HEALTH } from '../../world/gate/gateBoss.js';
import { FRAME_TONES } from '../enhanced/enhancedFrame.js';
import { PIXEL_FONT_CSS } from '../pixelifyFive.js';

/** The words - each read through the text core when the HUD reads it (L10N4). */
export const KT_HUD_TEXT = Object.freeze({
  get kicker() { return KT_WORDS.name; },
  get waiting() { return t('ketch.hud.waiting', 'Step into the waist. The Watch is waiting.'); },
  wave: (w) => t('ketch.hud.wave', 'Break the Watch - wave {w} of {n}', { w, n: KT_WATCH_WAVES }),
  standing: (n) => t('ketch.hud.standing', '{n, plural, one {# construct stands} other {# constructs stand}}', { n }),
  get gallery() { return t('ketch.hud.gallery', 'Cross the Gallery of Hammers and fell the Hammer Wardens.'); },
  wardens: (n) => t('ketch.hud.wardens', '{n, plural, one {# Hammer Warden stands} other {# Hammer Wardens stand}}', { n }),
  get asleep() { return t('ketch.hud.asleep', 'They wake as you pass the last hammers.'); },
  get engine() { return t('ketch.hud.engine', 'Carry aether cells from the cradles to the engine\'s sockets.'); },
  cells: (k, n) => t('ketch.hud.cells', 'Cells set: {k} of {n}', { k, n }),
  cradles: (c, lo) => (lo > 0 ? t('ketch.hud.cradlesLoose', 'Cradles charged: {c} of 6 - {lo} lying loose', { c, lo }) : t('ketch.hud.cradles', 'Cradles charged: {c} of 6', { c })),
  get sailwalk() { return t('ketch.hud.sailwalk', 'Ride the mast-lift to the main top and cross the Sailwalk to the bridge.'); },
  get lineUp() { return t('ketch.hud.lineUp', 'The bosun\'s line runs from the main top to the bridge.'); },
  get bridge() { return t('ketch.hud.bridge', 'Step onto the bridge. The Tonal Warden keeps the helm.'); },
  get steersman() { return t('ketch.hud.steersman', 'Bring the Tonal Warden down.'); },
  get discord() { return t('ketch.hud.discord', 'Carry cells from the bridge\'s cradles to the false resonators.'); },
  resonators: (n) => t('ketch.hud.resonators', 'Resonators true: {n} of 4', { n }),
  get lastNote() { return t('ketch.hud.lastNote', 'Break the tuning-forks before the Keel-Song lands.'); },
  forks: (n) => t('ketch.hud.forks', '{n, plural, one {# fork stands} other {# forks stand}}', { n }),
  get vault() { return t('ketch.hud.vault', 'The Warden is felled. The Ketchmaster\'s cabin is open.'); },
  get vaultSub() { return t('ketch.hud.vaultSub', 'Your share waits at the hold. The stern lift takes you down.'); },
  get carry() { return t('ketch.hud.carry', 'You carry an aether cell. Ready your weapon to let it go.'); },
  crew: (n) => t('ketch.hud.crew', 'Crew: {n} of {max}', { n, max: KT_CREW_MAX }),
  anchor: (w) => t('ketch.hud.anchor', 'She weighs anchor in {w}', { w }),
  last: (w) => t('ketch.hud.last', 'She leaves the sky in {w}', { w }),   // the voyage's end - never the fight's "turns west" (AUDIT KETCH L3-9)
});
/** The tracker's clock burns red under this (ms), and pulses under this. */
export const KT_HUD_LOW_MS = 5 * 60_000;
export const KT_HUD_PULSE_MS = 60_000;

/** How many constructs of the kinds `keys` stand (alive) in the state. */
const standing = (V, keys) => (V?.bodies ?? []).filter((B) => B.h > 0 && keys.includes(KT_KIND_BY_K[B.k]?.key)).length;

/**
 * THE TRACKER'S MODEL for the ship as the page holds it (`V` - net/ketch/ketchLink.js state) at `now` (the relay's ms), or
 * null - no ship heard. `carrying` whether a cell is in my hands. Pure.
 * @param {any} V @param {number} now @param {{ carrying?: boolean }} [o]
 */
export function ketchHudModel(V, now, { carrying = false } = {}) {
  if (!V || !(V.n >= 0)) return null;
  const sg = V.sg ?? KT_STAGE.watch, cl = V.cl, ws = V.ws;
  let line = '', sub = '', tally = '';
  if (sg === KT_STAGE.watch) {
    if (!(V.wv > 0)) line = KT_HUD_TEXT.waiting;
    else { line = KT_HUD_TEXT.wave(V.wv); const n = standing(V, ['sphere', 'sentry', 'captain']); sub = n > 0 ? KT_HUD_TEXT.standing(n) : ''; }
  } else if (sg === KT_STAGE.gallery) {
    line = KT_HUD_TEXT.gallery;
    const wardens = (V.bodies ?? []).filter((B) => B.h > 0 && KT_KIND_BY_K[B.k]?.key === 'warden');
    sub = wardens.length ? KT_HUD_TEXT.wardens(wardens.length) : '';
    tally = wardens.length && wardens.every((B) => !B.wake) ? KT_HUD_TEXT.asleep : '';
  } else if (sg === KT_STAGE.engine) {
    line = KT_HUD_TEXT.engine;
    sub = cl ? KT_HUD_TEXT.cells(cl.bk, cl.nd) : '';
    tally = cl ? KT_HUD_TEXT.cradles(cl.cr.filter((c) => c === 1).length, (cl.lo ?? []).filter((l) => l[2] < -9).length) : '';
  } else if (sg === KT_STAGE.sailwalk) {
    line = KT_HUD_TEXT.sailwalk;
  } else if (sg === KT_STAGE.bridge) {
    if (!ws || ws.lost) { line = KT_HUD_TEXT.bridge; sub = V.br ? KT_HUD_TEXT.lineUp : ''; }
    else if (ws.ph === 2 && ws.ward) { line = KT_HUD_TEXT.discord; sub = KT_HUD_TEXT.resonators((ws.rs ?? []).filter((v) => v === 1).length); }
    else if (ws.ph === 3 && ws.fk) { line = KT_HUD_TEXT.lastNote; sub = KT_HUD_TEXT.forks(ws.fk.c.filter((q) => q[2] > 0).length); }
    else { line = ws.ph === 1 ? KT_HUD_TEXT.steersman : ketchPhaseName(ws.ph) || KT_HUD_TEXT.steersman; sub = V.br ? KT_HUD_TEXT.lineUp : ''; }
  } else { line = KT_HUD_TEXT.vault; sub = KT_HUD_TEXT.vaultSub; }
  const v = ketchVoyageOf(V.n), docked = now < v.departAt, left = (docked ? v.departAt : v.endAt) - now;
  const w = ketchWhen({ ...v, phase: docked ? 'docked' : 'departing' }, now);
  return {
    kicker: KT_HUD_TEXT.kicker, title: ketchStageName(sg), line, sub, tally,
    carry: carrying ? KT_HUD_TEXT.carry : '',
    crew: KT_HUD_TEXT.crew((V.crew ?? []).length),
    clock: docked ? KT_HUD_TEXT.anchor(w) : KT_HUD_TEXT.last(w),
    low: !docked || left <= KT_HUD_LOW_MS, pulse: !docked && left <= KT_HUD_PULSE_MS,
  };
}

/** The Warden's blows' colours on the bar (css). */
export const KT_BAR_CSS = Object.freeze({ keel: '#ffd27a', lash: '#ff8a4c', ring: '#f3cf86', discord: '#ff6a3a', song: '#9ce8ff', west: '#ff5a4a', stun: '#9cc8ff', ward: '#f0c060', ring0: '#e8c060' });
/** The bar's words (L10N4, as the tracker's). */
export const KT_BAR_TEXT = Object.freeze({
  get name() { return ketchKindName('tonal'); },
  stirs: (s) => t('ketch.bar.stirs', 'It turns from the helm - {s}s', { s }),
  song: (left, n, s) => t('ketch.bar.song', 'The Keel-Song - {left} of {n} forks - {s}s', { left, n, s }),
  stunned: (s) => t('ketch.bar.stunned', 'Reeling - {s}s', { s }),
  get warded() { return t('ketch.bar.warded', 'Out of tune'); },
  resonators: (n) => t('ketch.hud.resonators', 'Resonators true: {n} of 4', { n }),
  endsIn: (left) => t('ketch.bar.endsIn', 'The Ketch turns west in {left}', { left }),
  fighters: (n) => t('ketch.bar.fighters', '{n, plural, one {# on the bridge} other {# on the bridge}}', { n }),
  get felled() { return t('ketch.bar.felled', 'Felled'); },
});
/** The end's countdown on the bar this close to it, pulsing in its last minute. */
export const KT_ENDS_WARN_MS = 5 * 60_000;
export const KT_ENDS_NEAR_MS = 60_000;

/**
 * THE WARDEN'S BAR'S MODEL (the gate bar's - ui/superDungeon/sdRemnantBar.js's shape) for the fight `ws` (the link's state's)
 * at `now`, or null - no fight, or one lost. Pure.
 */
export function wardenBarModel(ws, now, endAt = Infinity) {
  if (!ws || !(ws.fi > 0) || ws.lost) return null;
  const frac = ws.fell ? 0 : ws.m > 0 ? Math.max(0, Math.min(1, ws.h / ws.m)) : 1;
  const asleep = now < ws.op, stunned = !ws.fell && now < (ws.su ?? 0), warded = !ws.fell && (asleep || !!ws.ward || now < (ws.ou ?? 0));
  let callout = null;
  if (!ws.fell) {
    const blow = (ws.bl ?? []).filter((b) => !ktBlowDone(b, now)).sort((a, b) => a.at - b.at)[0] ?? null;
    const B = blow ? KW_BLOW_BY_A[blow.a] : null;
    const t = blow && blow.wu > 0 ? Math.max(0, Math.min(1, (now - (blow.at - blow.wu)) / blow.wu)) : 1;
    if (asleep) callout = { text: KT_BAR_TEXT.stirs(Math.ceil((ws.op - now) / 1000)), color: KT_BAR_CSS.ward, t: null, dagon: false, move: false };
    else if (B === KW_BLOWS.song && ws.fk && now < blow.at) {
      const left = ws.fk.c.filter((q) => q[2] > 0).length;
      callout = { text: KT_BAR_TEXT.song(left, ws.fk.c.length, Math.ceil((blow.at - now) / 1000)), color: KT_BAR_CSS.song, t, dagon: true, move: false };
    } else if (B && now < blow.at) callout = { text: ketchBlowName(B.key), color: KT_BAR_CSS[B.key] ?? KT_BAR_CSS.ring0, t, dagon: B.sh === 'all', move: false };
    else if (stunned) callout = { text: KT_BAR_TEXT.stunned(Math.ceil((ws.su - now) / 1000)), color: KT_BAR_CSS.stun, t: null, dagon: false, move: false };
    else if (B) callout = { text: ketchBlowName(B.key), color: KT_BAR_CSS[B.key] ?? KT_BAR_CSS.ring0, t: 1, dagon: B.sh === 'all', move: false };
  }
  // the fight's own end (the Ketch turning west at its helm), or the voyage's (her crews' last minutes, `endAt`) when that
  // comes first - one clock, its own words (AUDIT KETCH L3-9: two clocks, both "turns west", counted to two moments)
  const toFight = Number.isFinite(ws.ends) && ws.ends > 0 ? ws.ends - now : Infinity, toGone = Number.isFinite(endAt) ? endAt - now : Infinity;
  const toEnd = Math.min(toFight, toGone);
  const since = ws.fell ? Math.max(0, now - ws.fell.at) : 0;
  const alpha = ws.fell ? Math.max(0, Math.min(1, 1 - (since - FELL_HOLD_MS) / FELL_FADE_MS)) : 1;
  const forkLive = !ws.fell && ws.fk && now < ws.fk.at - KW_FORKS_CLOSE_MS;
  return {
    theme: 'brass', ringCss: KT_BAR_CSS.ring0,
    name: KT_BAR_TEXT.name, title: ketchPhaseName(ws.ph), epithet: '', epithetColor: null, marksView: null,
    frac, marks: [...KW_PHASE_AT], phase: ws.ph, spent: KW_PHASE_AT.map((_, i) => ws.ph > i + 1),
    warded, wardedText: ws.ward ? KT_BAR_TEXT.warded : undefined, fallen: !!ws.fell, fallenText: KT_BAR_TEXT.felled, callout,
    wrath: ws.fell ? null : toEnd <= KT_ENDS_WARN_MS ? (toGone < toFight ? KT_HUD_TEXT.last(countdownText(Math.max(0, toGone))) : KT_BAR_TEXT.endsIn(countdownText(Math.max(0, toFight)))) : null,
    wrathNear: !ws.fell && (!!ws.ended || toEnd <= KT_ENDS_NEAR_MS),
    fighters: ws.n | 0, fightersLine: KT_BAR_TEXT.fighters(ws.n | 0),
    host: ws.fell ? null : ws.ph === 2 && ws.ward ? KT_BAR_TEXT.resonators((ws.rs ?? []).filter((v) => v === 1).length) : forkLive ? KT_HUD_TEXT.forks(ws.fk.c.filter((q) => q[2] > 0).length) : null,
    hostNear: !!forkLive,
    reckonIn: null,
    alpha: Math.round(alpha * 20) / 20, now, low: !ws.fell && frac > 0 && frac < LOW_HEALTH,
  };
}

// ── THE TRACKER'S NODE ─────────────────────────────────────────────────────────────────────────────────────────
export const KT_HUD_STYLE_ID = 'dagger-kt-hud-style';
export const KT_HUD_CSS = `
.kt-hud { position: fixed; right: 16px; top: 24%; width: min(320px, 72vw); box-sizing: border-box; pointer-events: none; z-index: 30;
  padding: 9px 12px 10px; border: 2px solid ${FRAME_TONES.brass}; background: rgba(18, 13, 6, 0.72); box-shadow: inset 0 0 0 1px ${FRAME_TONES.brassDark}, 0 0 12px rgba(0,0,0,0.6);
  ${PIXEL_FONT_CSS} font-size: calc(14px * var(--hud-scale, 1)); line-height: 1.35; color: #efe8d6; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.kt-hud-kicker { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: ${FRAME_TONES.brassHi}; }
.kt-hud-title { font-size: 16px; line-height: 1.25; margin-top: 3px; color: #fff2cc; }
.kt-hud-line { font-size: 15px; margin-top: 6px; }
.kt-hud-sub, .kt-hud-tally { font-size: 13px; margin-top: 3px; color: #c9b993; }
.kt-hud-carry { font-size: 13px; margin-top: 6px; color: #9ce8ff; }
.kt-hud-foot { display: flex; justify-content: space-between; gap: 8px; margin-top: 7px; font-size: 12px; color: #b9ab93; font-variant-numeric: tabular-nums; }
.kt-hud-clock.low { color: #ff8a5a; }
.kt-hud-clock.pulse { color: #ff5a3a; animation: kt-pulse 1s steps(2, jump-none) infinite; }
@keyframes kt-pulse { 50% { opacity: 0.55; } }
@media (prefers-reduced-motion: reduce) { .kt-hud-clock.pulse { animation: none; } }
.kt-hud-sub:empty, .kt-hud-tally:empty, .kt-hud-carry:empty { display: none; }
@media (max-width: 640px) { .kt-hud { top: 16%; right: 8px; padding: 7px 10px 8px; } .kt-hud-title { font-size: 15px; } .kt-hud-line { font-size: 14px; } }
`;
let node = null, parts = null;
const shown = new Map();
/** THE TRACKER drawn: `model` (ketchHudModel's, or null to hide it); `hidden` the HUD's own hide. */
export function drawKetchHud(model, { hidden = false, doc = globalThis.document } = {}) {
  const want = !hidden && !!model;
  if (!node) {
    if (!want || !doc?.createElement) return;
    if (doc.getElementById && !doc.getElementById(KT_HUD_STYLE_ID)) {
      const st = doc.createElement('style');
      st.id = KT_HUD_STYLE_ID; st.textContent = KT_HUD_CSS;
      (doc.head ?? doc.body)?.append(st);
    }
    node = doc.createElement('div');
    node.className = 'kt-hud';
    const el = (cls, parent = node) => { const e = doc.createElement('div'); e.className = cls; parent.append(e); return e; };
    parts = { kicker: el('kt-hud-kicker'), title: el('kt-hud-title'), line: el('kt-hud-line'), sub: el('kt-hud-sub'), tally: el('kt-hud-tally'), carry: el('kt-hud-carry') };
    const foot = el('kt-hud-foot');
    parts.crew = el('kt-hud-crew', foot); parts.clock = el('kt-hud-clock', foot);
    (doc.body ?? doc.documentElement)?.append(node);
  }
  const vis = want ? '' : 'none';
  if (shown.get('vis') !== vis) { shown.set('vis', vis); node.style.display = vis; }
  if (!want) return;
  for (const k of ['kicker', 'title', 'line', 'sub', 'tally', 'carry', 'crew', 'clock']) {
    const v = String(model[k] ?? '');
    if (shown.get(k) !== v) { shown.set(k, v); parts[k].textContent = v; }
  }
  const cls = `kt-hud-clock${model.pulse ? ' pulse' : model.low ? ' low' : ''}`;
  if (shown.get('clockCls') !== cls) { shown.set('clockCls', cls); parts.clock.className = cls; }
}
/** The page is going (a test's reset): the node leaves with it. */
export function destroyKetchHud() { node?.remove?.(); node = null; parts = null; shown.clear(); }
