// @ts-check
// SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"): SETHRAKUL'S BAR - the gate's boss bar
// (ui/gateBossBar.js drawGateBossBar: one readout, one node, updated never rebuilt) in the sea's colours, its model made
// here from the serpent host's (scenes/serpentHost.js bar). Its name over its epithet, its health with the two phase
// marks cut in it, the ward while it turns a phase, the attack it winds up named in its colour with a line filling to
// its landing (and MOVE when it is laid on my ship), its stun, the coil's health while one holds a ship, the ships in
// its waters, and its sounding's countdown - pulsing in its last minute. Design: bible/11-Multiplayer/Sea-Serpent.md
// section 9.
//
// `serpentBarModel` is pure - the host's bar and the clock in, the gate bar's model out. Not a DFU member. Ledger A
// (SERPENT1).
import { SERPENT_PHASE_AT } from '../net/serpentBrain.js';
import { serpentClock } from '../net/serpentLaw.js';

/** The attacks' colours on the bar (css) - the warning's, the coil's, the venom's, the turns' own. */
export const SERPENT_CALL_CSS = Object.freeze({
  lash: '#ff8a4c', ram: '#ff6a3c', breach: '#ff9c5a', spit: '#9cf06a', coil: '#c69cff', roar: '#ffb46a', cry: '#8fe3cf', mael: '#7fd4ff',
});
export const SERPENT_RING_CSS = '#8fe3cf';
export const STUN_CSS = '#fff2a6';
/** The words. */
export const SERPENT_BAR_TEXT = Object.freeze({
  ships: (n) => (n === 1 ? '1 ship fighting it' : `${n} ships fighting it`),   // AUDIT 2 XC8: the count is the ships fighting it (AUDIT SHIPS C1), not every hull in its waters
  sounds: (left) => `It dives in ${left}`,
  stunned: (s) => `Stunned - strike its head! ${s}s`,
  coil: (h, m, mine) => (mine ? `Its coils hold YOUR ship - ${h} / ${m}` : `Break the coil - ${h} / ${m}`),
  phase: (n, name) => `${['I', 'II', 'III'][n - 1] ?? n} - ${name}`,
});
/** Its sounding's countdown shows this close to it, and pulses in its last minute. */
export const SOUND_WARN_MS = 5 * 60 * 1000;
export const SOUND_NEAR_MS = 60 * 1000;
/** After its fall the bar holds a moment, then fades. */
export const SERPENT_FELL_HOLD_MS = 1500;
export const SERPENT_FELL_FADE_MS = 600;

/**
 * The gate bar's model for the serpent's bar (`b` scenes/serpentHost.js bar()), or null.
 * @param {any} b @param {number} now the relay's clock
 */
export function serpentBarModel(b, now = b?.now ?? 0) {
  if (!b) return null;
  const frac = b.fell ? 0 : b.max > 0 ? Math.max(0, Math.min(1, b.hp / b.max)) : 1;
  let callout = null;
  if (!b.fell && !b.gone && b.stunned) callout = { text: SERPENT_BAR_TEXT.stunned(Math.ceil(b.stunLeft / 1000)), color: STUN_CSS, t: null, dagon: false, move: false };
  else if (!b.fell && !b.gone && b.atk) callout = { text: b.atk.name, color: SERPENT_CALL_CSS[b.atk.key] ?? SERPENT_RING_CSS, t: b.atk.t, dagon: b.atk.key === 'cry' || b.atk.key === 'mael', move: !!b.atk.aimed };
  const since = b.fell ? Math.max(0, now - b.fell.at) : 0;
  const alpha = b.gone ? 0 : b.fell ? Math.max(0, Math.min(1, 1 - (since - SERPENT_FELL_HOLD_MS) / SERPENT_FELL_FADE_MS)) : 1;
  const soundIn = Number.isFinite(b.soundIn) ? b.soundIn : Infinity;
  return {
    theme: 'sea', ringCss: SERPENT_RING_CSS,
    name: b.name, title: b.title, epithet: '', epithetColor: null, marksView: null, trials: '',
    frac, marks: [...SERPENT_PHASE_AT], phase: b.phase, spent: SERPENT_PHASE_AT.map((_, i) => b.phase > i + 1),
    warded: !b.fell && !!b.warded, fallen: !!b.fell, callout,
    wrath: !b.fell && soundIn <= SOUND_WARN_MS ? SERPENT_BAR_TEXT.sounds(serpentClock(soundIn)) : null,
    wrathNear: !b.fell && soundIn <= SOUND_NEAR_MS,
    fighters: b.fighters | 0, fightersLine: SERPENT_BAR_TEXT.ships(b.fighters | 0),
    host: b.fell ? null : SERPENT_BAR_TEXT.phase(b.phase, b.phaseName),
    reckonIn: b.coil ? SERPENT_BAR_TEXT.coil(b.coil.h, b.coil.m, b.coil.mine) : null,
    alpha: Math.round(alpha * 20) / 20, now, low: !b.fell && frac > 0 && frac < 0.2,
  };
}
