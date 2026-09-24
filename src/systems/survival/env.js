// SURV7 - THE FEED: what a host hands the minute law, composed once.
// `survivalMinute` (needs.js) takes an ENV (where the player stands -
// climate, month, hour, weather, inside a building or a dungeon, in
// the sun, swimming, riding, by a fire, resting, sleeping and how) and
// DEPS (the worn items for the warmth law, a ctx of the body's own
// resistances). The hosts know the first; the second is the entity's
// and the same in every host, so it is built HERE from the entity and
// never four times. `survivalFeed` is the `survival` argument
// worldTick.js tickPlayerMinutes takes; null runs nothing (the mod off,
// or a host with no reader yet).
//
// THE REST GATE rides the same seam: rest.js's restBlock asks the felt
// temperature (the record's last reading, SURV5), a fire near and a
// roof - `restGateEnv` reads the first off the record and the other two
// off the host's env, and `installSurvivalGate` puts the two handlers
// on DFU's RegisterPreventRestCondition ONCE per host build (the seam
// is a registry; a second host in one boot is the dev scenes' case and
// registers its own).
//
// SURV-TIERS (2026-09-23): THE TIER RIDES THE SAME SEAM. The feed hands
// the minute law the live tier's rules (`deps.rules`, survival/
// difficulty.js), and the gate is installed on every host but answers
// only in a tier that refuses a sleep (`restGate` - Hard's alone).
//
// PURE: a leaf - racialLive.js is import-free, races.js a data leaf.
import { temperatureWord } from './temperature.js';
import { installSurvivalRestGate } from './rest.js';
import { survivalRules } from './switch.js';
import { liveVampirism } from '../racialLive.js';
import { raceById } from '../races.js';

/** The env keys a host feeds, with their defaults (the reader may give a subset). */
export const ENV_DEFAULTS = Object.freeze({
  climateIndex: 232, month: 0, hour: 12, weather: 'sunny', insideBuilding: false, insideDungeon: false, inSunlight: false,
  swimming: false, transport: false, byFire: false, resting: false, sleeping: null,
  lycanthrope: false, beastForm: false, fireResist: 0, frostResist: 0,
});

/** The body's ctx for the temperature law, off the entity and the env's live flags. */
export function survivalCtx(entity, env = {}) {
  return {
    vampire: !!liveVampirism(entity),
    raceId: entity?.raceId ?? 1,
    raceTemplate: raceById(entity?.raceId ?? 1) ?? {},
    lycanthrope: !!env.lycanthrope, beastForm: !!env.beastForm,
    fireResist: env.fireResist ?? 0, frostResist: env.frostResist ?? 0,
  };
}

/**
 * tickPlayerMinutes' `survival` argument: { env, deps } - or null when
 * the mod is off or the host gave no env. `worn` is the equip table's
 * slot array (an item a slot, the shape temperature.js reads); `rules`
 * the live tier's (SURV-TIERS).
 */
export function survivalFeed(entity, env = null, { rolls = null, say = null } = {}) {
  const rules = survivalRules();
  if (!rules || !entity || !env) return null;
  const full = { ...ENV_DEFAULTS, ...env };
  const deps = { worn: entity.equip?.slots ?? null, ctx: survivalCtx(entity, full), rules };
  if (rolls) deps.rolls = rolls;
  if (say) deps.say = say;
  return { env: full, deps };
}

/** The rest gate's three: the record's last felt word, the host's fire and roof. */
export function restGateEnv(entity, env = null) {
  const s = entity?.survival;
  const felt = Number.isFinite(s?.felt) ? s.felt : null;
  return {
    tempWord: felt == null ? 'comfortable' : temperatureWord(felt),
    byFire: !!env?.byFire,
    insideBuilding: !!env?.insideBuilding,
  };
}

/**
 * Put the gate on the seam for a host: `register` is restSession.js's
 * registerPreventRestCondition, `entity()` and `env()` the host's
 * readers. Returns the two handlers (for a teardown's unregister).
 */
export function installSurvivalGate(register, entity, env) {
  return installSurvivalRestGate(() => { const e = env?.(); return e ? restGateEnv(entity?.(), e) : null; }, register, { enabled: survivalGateOn });
}
/** SURV-TIERS: the gate stands only in a tier that refuses a sleep - Off has no arc and Casual refuses nothing. */
export const survivalGateOn = () => !!survivalRules()?.restGate;

/** AUDIT SURV B/C: a torn-down host takes its pair off the seam (a dead dungeon's handler was refusing the outdoor fire). */
export function uninstallSurvivalGate(pair, unregister) {
  for (const h of pair ?? []) unregister?.(h);
}
