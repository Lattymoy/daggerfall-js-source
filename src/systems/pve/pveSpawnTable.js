// @ts-check
// FIXED-PVE STAGE 7 (bible/05-Combat/Fixed-PvE.md section 9): A PLACE'S SPAWN TABLE, in the spec's six steps - where
// it is (province, region, climate, dungeon), what may live there (pveBestiary.js), what the hour, an event and the
// factions present allow, the zone's fixed band (pveZones.js), then the populations: ambient, farming, encounters,
// groups, road patrols, rare foes and settlements. The table is a function of the place alone, so every machine builds
// the same one. A town holds no hostile population unless an event says so. Ledger A (FIXED-PVE).
import { GROUP_TEMPLATES } from './pveTemplates.js';
import { DISTRIBUTION } from './pveBestiary.js';
import { encounterPool, bandGroups, meetsHostile } from './pveEncounter.js';
import { pveZoneAt, zoneAreaOf } from './pveZones.js';

/** The populations a table holds, in the order a cell fills them. */
export const POPULATIONS = Object.freeze(['settlement', 'ambient', 'farming', 'encounter', 'group', 'patrol', 'rare']);
/** How many of each stand alive in one cell at once - never more, however many players come. */
export const POP_DENSITY = Object.freeze({ settlement: 1, ambient: 4, farming: 8, encounter: 3, group: 1, patrol: 1, rare: 1 });
/** Seconds before a fallen slot stands again. */
export const RESPAWN_S = Object.freeze({ settlement: 1800, ambient: 120, farming: 60, encounter: 300, group: 600, patrol: 600, rare: 3600 });
/** The share of a rare slot's turns that stand a foe at all. */
export const RARE_CHANCE = 0.05;
/** Categories that count as rare foes in the open, beside any species the place holds only as an exception. */
export const RARE_CATEGORIES = Object.freeze(['strong', 'elite', 'champion']);

const byKey = (list) => list.sort((a, b) => a.key.localeCompare(b.key));

/**
 * The spawn table at a place: its zone and, for each population, the templates (or groups) it draws from at their
 * share. Null where no zone is.
 * @param {{ px: number, py: number, region: number, place?: string, dungeon?: number|null, province?: string,
 *   climate?: number|null, night?: boolean, event?: string|null, factions?: string[] }} at
 */
export function spawnTable(at) {
  const zone = pveZoneAt(at);
  if (!zone) return null;
  const event = at.event ?? null;
  const met = [...(at.night ? ['night'] : []), ...(event === 'incursion' ? ['incursion'] : [])];
  const p = encounterPool(zone.band, { px: at.px, py: at.py, province: at.province, region: at.region, area: zoneAreaOf(at.region), climate: at.climate ?? null,
    dungeon: at.dungeon ?? null, met, factions: at.factions ?? [] });
  const of = (keep) => byKey(p.pool.filter(keep).map((x) => ({ key: x.t.key, w: x.w })));
  const hostile = (x) => meetsHostile(x.t, event);
  const lists = {
    settlement: zone.place === 'dungeon' ? [] : byKey(GROUP_TEMPLATES.filter((g) => g.community && g.members.every(([m]) => p.lives.has(m))).map((g) => ({ key: g.key, w: 1 }))),
    ambient: of((x) => !hostile(x) && !x.t.protected && !(zone.safe && x.t.disposition === 'territorial')),   // the protected live in settlements; a town keeps no territorial beast
    farming: [], encounter: [], group: [], patrol: [], rare: [],
  };
  if (!zone.safe || event === 'hostile') {
    const normal = of((x) => hostile(x) && x.t.category === 'normal');
    lists.encounter = normal;
    lists.farming = zone.farming ? normal : [];
    lists.group = byKey(bandGroups(p));
    lists.patrol = zone.place === 'road' ? lists.group : [];
    lists.rare = of((x) => hostile(x) && (RARE_CATEGORIES.includes(x.t.category) || x.w <= DISTRIBUTION.exceptional));
  }
  return Object.freeze({ zone, lists: Object.freeze(lists) });
}
