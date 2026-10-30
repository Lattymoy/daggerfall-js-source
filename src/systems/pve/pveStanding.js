// @ts-check
// FIXED-PVE STAGE 4 (bible/05-Combat/Fixed-PvE.md section 6): HOW A CREATURE MEETS A PLAYER, AND WHAT A BLOW ON IT
// COSTS. One law for hostile, neutral and friendly creatures: the template's starting state, moved by the player's
// standing with its faction (the game's own reputation, factionRep.js), by what the player did to it or its kin, and by
// an event. Attacking a peaceful creature is a crime on the game's own list (crimes.js) where a law protects it, and a
// faction's reputation falls. A kill of one pays less than a foe's, so farming the peaceful never beats hunting the
// hostile. Pure: the spawn stage feeds it. Ledger A (FIXED-PVE).
import { WILDLIFE } from './pveDisposition.js';
import { CRIMES } from '../crimes.js';
import { getReputation } from '../faction/factionRep.js';

/** A template's faction in the game's FACTION.TXT (Orsinium, #358), or an outlaw band that no law shields. */
export const PVE_FACTIONS = Object.freeze({
  'orc-clans': Object.freeze({ factionId: 358, outlaw: false }),
  bandits: Object.freeze({ factionId: null, outlaw: true }),
});

/** Reputation lines: at or under HOSTILE a faction's members fight the player; at or over ALLY they are friendly. */
export const STANDING = Object.freeze({ HOSTILE: -20, ALLY: 20 });

/** What each service asks of the player's standing with the creature's faction (no faction: none). */
export const SERVICE_REP = Object.freeze({ talk: -19, rumour: -19, trade: 0, quest: 10, train: 20, faction: 20, hire: 30 });

/** How far a territorial creature lets a player come (metres), and how long it warns before it fights (seconds). */
export const TERRITORY = Object.freeze({ warn: 20, fight: 10, warnS: 4 });

/** A kill's reward share by what was killed: a foe pays whole, a peaceful one little, a protected one nothing. */
export const KILL_SHARE = Object.freeze({ hostile: 1, wildlife: 1, peaceful: 0.25, protected: 0 });

/** Reputation a blow and a kill cost with the creature's faction. */
export const AGGRESSION_REP = Object.freeze({ blow: -5, kill: -15 });

/** The player's standing with `t`'s faction: the game's reputation, or null for no faction. @param {any} t @param {any} store */
export function factionStanding(t, store) {
  const id = PVE_FACTIONS[t?.faction]?.factionId;
  return id == null || !store ? null : getReputation(store, id);
}

/**
 * The state `t` meets this player in. In order: an event's word, then what the player did (a blow on it or its kin, a
 * crime against its faction), then the faction's standing, then the template's own start.
 * @param {any} t
 * @param {{ rep?: number|null, struck?: boolean, crime?: boolean, event?: string|null, ally?: boolean }} [ctx]
 */
export function effectiveDisposition(t, { rep = null, struck = false, crime = false, event = null, ally = false } = {}) {
  if (event) return event;
  if (struck) return struckState(t);
  if (crime && t?.faction) return 'hostile';
  const start = t?.wildlife ? WILDLIFE[t.wildlife].start : t?.disposition;
  if (PVE_FACTIONS[t?.faction]?.outlaw || rep == null) return ally && start !== 'hostile' ? 'friendly' : start;
  if (rep <= STANDING.HOSTILE) return 'hostile';
  if (ally || rep >= STANDING.ALLY) return start === 'hostile' ? 'neutral' : 'friendly';
  return start;
}

/** The state a blow moves `t` to: wildlife by its way, anything else turns on the one who struck it. @param {any} t */
export const struckState = (t) => (t?.wildlife ? WILDLIFE[t.wildlife].struck : 'hostile');

/**
 * What a creature in `state` does about a player `dist` metres off, `nearS` seconds inside its warning line: attack,
 * warn, watch, flee or ignore. A neutral or friendly creature starts nothing.
 */
export function neutralAction(state, dist, nearS = 0) {
  if (state === 'hostile') return 'attack';
  if (state === 'fleeing') return 'flee';
  if (state === 'territorial') {
    if (dist <= TERRITORY.fight || (dist <= TERRITORY.warn && nearS >= TERRITORY.warnS)) return 'attack';
    return dist <= TERRITORY.warn ? 'warn' : 'ignore';
  }
  if (state === 'wary') return dist <= TERRITORY.warn ? 'watch' : 'ignore';
  return 'ignore';
}

/**
 * What a blow on `t` in `state` is (spec 7.8): a foe, self-defence (it struck first), legal hunting (wildlife, an
 * outlaw), an attack on a protected one, on a faction's member, or plain aggression.
 * @param {any} t @param {string} state @param {{ provoked?: boolean }} [ctx]
 */
export function aggressionKind(t, state, { provoked = false } = {}) {
  if (provoked) return 'selfDefence';
  if (t?.protected) return 'protected';
  if (state === 'hostile') return 'foe';
  if (t?.wildlife || PVE_FACTIONS[t?.faction]?.outlaw) return 'hunting';
  return t?.faction ? 'factionMember' : 'aggression';
}

/**
 * What a blow (or a kill) of `kind` costs: a crime on the game's list for the guards, the faction's reputation, whether
 * its services close. Nothing for a foe, self-defence or hunting.
 * @param {string} kind @param {boolean} [kill]
 */
export function aggressionCost(kind, kill = false) {
  const rep = kill ? AGGRESSION_REP.kill : AGGRESSION_REP.blow;
  if (kind === 'protected') return { crime: kill ? CRIMES.Murder : CRIMES.Assault, rep, servicesLost: true };
  if (kind === 'factionMember') return { crime: null, rep, servicesLost: true };
  return { crime: null, rep: 0, servicesLost: false };
}

/** A kill's reward share for `t`, by how it STARTS - one the player turned hostile is still a peaceful one. @param {any} t */
export function killShare(t) {
  if (t?.protected) return KILL_SHARE.protected;
  if (t?.wildlife) return KILL_SHARE.wildlife;
  return t?.disposition === 'hostile' ? KILL_SHARE.hostile : KILL_SHARE.peaceful;
}

/**
 * The services `t` offers this player now: its own list, none while it fights or flees, each held to the standing it
 * asks. A creature with nothing to offer needs no profile.
 * @param {any} t @param {string} state @param {number|null} [rep]
 */
export function servicesOffered(t, state, rep = null) {
  if (!(state === 'friendly' || state === 'neutral' || state === 'wary')) return [];
  return (t?.interact ?? []).filter((s) => rep == null || rep >= (SERVICE_REP[s] ?? 0));
}
