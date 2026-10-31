// @ts-check
// DRAGON3 (bible/11-Multiplayer/Dwarven-Dragon.md section 9): THE DRAGON'S BAR - the gate's boss bar (ui/gate/gateBossBar.js
// drawGateBossBar) in brass, its model made here from the dragon host's bar (scenes/dragonHost.js): its name over its
// epithet, its health with the two phase marks, ALOFT or GROUNDED with the seconds left down, the blow it winds up in its
// element's colour (MOVE when its shape holds my feet), the fighters, and its climb away in its last five minutes. Pure.
// Not a DFU member. Ledger A (DRAGON).
import { FELL_HOLD_MS, FELL_FADE_MS } from './gate/gateBossBar.js';
import { LOW_HEALTH } from '../world/gate/gateBoss.js';
import { countdownText } from '../net/gate/gateLaw.js';
import { DRAGON_BAR_WORDS } from '../systems/dragon/dragonWords.js';

/** Its phases' marks (section 5: 66% and 33%). */
export const DRAGON_PHASE_AT = Object.freeze([2 / 3, 1 / 3]);
/** The blows' colours on the bar by element (css): its shock, its fire, its weight. */
export const DRAGON_BAR_CSS = Object.freeze({ shock: '#9cc8ff', fire: '#ff8a4c', weight: '#ffcf70', ring: '#e8c060' });
/** Its climb away is counted down this close to it (ms). */
export const DRAGON_LEAVE_WARN_MS = 5 * 60 * 1000;
export const DRAGON_LEAVE_NEAR_MS = 60 * 1000;

/**
 * The gate bar's model for the dragon's bar (`b` scenes/dragonHost.js bar()), or null.
 * @param {any} b @param {number} [now] the relay's clock
 */
export function dragonBarModel(b, now = b?.now ?? 0) {
  if (!b) return null;
  const frac = b.fell ? 0 : b.max > 0 ? Math.max(0, Math.min(1, b.hp / b.max)) : 1;
  const callout =
    !b.fell && !b.gone && b.atk
      ? {
          text: b.atk.name,
          color: DRAGON_BAR_CSS[b.atk.el ?? 'weight'] ?? DRAGON_BAR_CSS.weight,
          t: b.atk.t,
          dagon: false,
          move: !!b.atk.aimed,
        }
      : null;
  const since = b.fell ? Math.max(0, now - b.fell.at) : 0;
  const alpha = b.gone ? 0 : b.fell ? Math.max(0, Math.min(1, 1 - (since - FELL_HOLD_MS) / FELL_FADE_MS)) : 1;
  const leaveIn = Number.isFinite(b.leaveIn) ? b.leaveIn : Infinity;
  return {
    theme: 'brass',
    ringCss: DRAGON_BAR_CSS.ring,
    name: b.name,
    title: b.title,
    epithet: '',
    epithetColor: null,
    marksView: null,
    trials: '',
    frac,
    marks: [...DRAGON_PHASE_AT],
    phase: b.phase,
    spent: DRAGON_PHASE_AT.map((_, i) => b.phase > i + 1),
    warded: !b.fell && !!b.warded,
    fallen: !!b.fell,
    callout,
    wrath: !b.fell && leaveIn <= DRAGON_LEAVE_WARN_MS ? DRAGON_BAR_WORDS.climbs(countdownText(leaveIn)) : null,
    wrathNear: !b.fell && leaveIn <= DRAGON_LEAVE_NEAR_MS,
    fighters: b.fighters | 0,
    fightersLine: DRAGON_BAR_WORDS.fighters(b.fighters | 0),
    host: b.fell
      ? null
      : b.grounded
        ? DRAGON_BAR_WORDS.grounded(Math.max(0, Math.ceil(b.groundLeft / 1000)))
        : DRAGON_BAR_WORDS.aloft,
    reckonIn: null,
    alpha: Math.round(alpha * 20) / 20,
    now,
    low: !b.fell && frac > 0 && frac < LOW_HEALTH,
  };
}
