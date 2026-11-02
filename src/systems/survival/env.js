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
import { survivalOf, feltCtx } from './needs.js';
import { temperatureWord, feltTemperature, temperatureBreakdown } from './temperature.js';
import { installSurvivalRestGate } from './rest.js';
import { survivalRules } from './switch.js';
import { liveVampirism } from '../racialLive.js';
import { raceById } from '../races.js';

/** TEMP-UI: the last feed built for each entity (feltNow, at the end of this file) - weak, never on the entity. */
const LAST_FEED = new WeakMap();

/** The env keys a host feeds, with their defaults (the reader may give a subset). */
export const ENV_DEFAULTS = Object.freeze({
  climateIndex: 232, month: 0, hour: 12, weather: 'sunny', insideBuilding: false, insideDungeon: false, inSunlight: false,
  falling: null,   // WET-FALL: what falls on the player, `{ word, level }` (weatherSim.js fallingWeather) - null: the sky's word, whole
  swimming: false, submerged: false, wading: false, transport: false, byFire: false, resting: false, sleeping: null, sheltered: false,
  castle: false,   // AUDIT C&C (lens T): a castle's halls, which the dungeon host stands - the law's own (the mod's Dungeon() corrects them too), the breakdown's word for it
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
  // AUDIT TEMP-UI E2: A SWIMMER IS IN THE WATER - every host says `swimming` and the law soaks on `submerged` or
  // `wading` (temperature.js environmentWet), so thirty minutes' swim had left the body dry. AUDIT C&C (lens T D3): AS
  // THE MOD HAS IT - a swim on the surface WADES (Climates.cs Water(): the motor's OnExteriorWater Swimming, fifty a
  // minute), and only a head under the water is SUBMERGED (IsPlayerSubmerged, the whole three hundred at once): E2 read
  // every swim as submerged, so one minute in a river left a body Drenched for five hours. The hosts that know the head
  // is under say `submerged` (world.js the sea's, dungeonContext.js the hall's); a reader that says `wading` is believed.
  if (full.swimming && !full.submerged && !Object.hasOwn(env, 'wading')) full.wading = true;
  const deps = { worn: entity.equip?.slots ?? null, ctx: survivalCtx(entity, full), rules };
  LAST_FEED.set(entity, { env: full, ctx: deps.ctx });   // TEMP-UI: where the body last stood, for the pack's live reading
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

/** A load or an arrival: the record made if missing and aligned to now (needs.js alignSurvival's law). */
export const survivalRecordAt = (entity, now) => survivalOf(entity, now);

/**
 * TEMP-UI (2026-10-12): WHERE THE BODY LAST STOOD, AND WHAT IT WOULD FEEL THERE NOW. Every host hands its reader to the
 * one feed above, every frame the needs run, so the feed keeps the last environment and the body's context it built
 * for each entity - held weakly, never on the entity, so nothing of it rides a save or the wire. The pack reads it to
 * show the felt temperature as it stands this instant, and as it WOULD stand in other clothes (`worn`, a slot array,
 * and `mods`, the wardrobe's folded channels for that table - systems/entityMods.js computeEntityMods): putting a cloak
 * on under a paused window shows its warmth at once, where the record's `felt` waits for the next game minute. The
 * reading is the minute law's own (feltTemperature with needs.js feltCtx - THE ONE CONSTRUCTION SEAM).
 */
/** The last { env, ctx } the feed built for this entity, or null before the needs have run (or with the arc Off since a load). */
export const lastSurvivalFeed = (entity) => (entity && LAST_FEED.get(entity)) ?? null;
/** The felt temperature `entity` would feel where it last stood, in `worn` (its own slots by default) with `mods` (its
 *  own folded channels by default): feltTemperature's whole answer plus `env` - or null with no feed yet. */
export function feltNow(entity, { worn = entity?.equip?.slots ?? null, mods = entity?._mods } = {}) {
  const feed = lastSurvivalFeed(entity);
  if (!feed) return null;
  const s = entity.survival && typeof entity.survival === 'object' ? entity.survival : null;
  return { ...feltTemperature(feed.env, worn, feltCtx(entity, s, feed.ctx, mods)), env: feed.env };
}
/** The live reading's rows (temperature.js temperatureBreakdown), or [] with no feed yet. */
export function feltBreakdownNow(entity, opts) {
  const t = feltNow(entity, opts);
  return t ? temperatureBreakdown(t.env, t) : [];
}

