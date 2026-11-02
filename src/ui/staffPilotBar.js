// @ts-check
// PILOT-BAR (2026-10-28: "let me see the bosses bar so i know when im hurt"): THE BOSS I STEER'S BAR - the gate's
// boss bar (ui/gate/gateBossBar.js) for the mini boss of Play as boss (systems/staffBossPilot.js): its name, its health
// and the numbers under it. Pure: the boss in, the bar's model out. Not a DFU member.
import { enemyDisplayName } from '../characters/enemy/enemyBasics.js';
import { t } from '../systems/textManager.js';

/** Where the bar cuts its two marks: half and a quarter of the boss's health. */
export const PILOT_BAR_MARKS = Object.freeze([0.5, 0.25]);
/** The words. */
export const PILOT_BAR_TEXT = Object.freeze({
  title: () => t('staff.pilot.bar.title', 'Your mini boss'),
  health: (/** @type {number} */ hp, /** @type {number} */ max) =>
    t('staff.pilot.bar.health', 'Health {hp} / {max}', { hp, max }),
});

/** The bar's model for the boss `f` I steer (null: none) at `now` ms. @param {any} f @param {number} now */
export function pilotBarModel(f, now) {
  const e = f?.entity;
  if (!e || f.dead) return null;
  const max = Math.max(1, Math.round(e.maxHealth || 1)),
    hp = Math.max(0, Math.round(e.health ?? 0));
  const frac = Math.max(0, Math.min(1, hp / max));
  return {
    name: enemyDisplayName(f.mobileType),
    title: PILOT_BAR_TEXT.title(),
    epithet: '',
    epithetColor: null,
    marksView: null,
    trials: '',
    frac,
    marks: [...PILOT_BAR_MARKS],
    spent: PILOT_BAR_MARKS.map((at) => frac < at),
    warded: false,
    fallen: false,
    callout: null,
    wrath: null,
    wrathNear: false,
    fighters: 0,
    fightersLine: PILOT_BAR_TEXT.health(hp, max),
    host: null,
    reckonIn: null,
    alpha: 1,
    now,
    low: frac > 0 && frac < 0.2,
  };
}
