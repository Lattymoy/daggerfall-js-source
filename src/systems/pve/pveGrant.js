// @ts-check
// FIXED-PVE STAGE 7 (bible/05-Combat/Fixed-PvE.md section 9): A SPAWN GRANT STANDS A TEMPLATE. While the switch is on
// a seed-rolled grant (net/grantLaw.js, `encr`; a camp's) draws each member from the spawn table at the grant's pixel
// with the member's own species die, so the owner and every reader stand the same template. Its level, health and blow
// are the template's: the owner's signed level, Renown and party never move them. A reader refuses a record whose body or
// level is not the seed's template. The world hooks `tableAt` in when the switch turns on. Ledger A (FIXED-PVE).
import { grantDice, grantRng } from '../../net/grantLaw.js';
import { isNight } from '../../world/worldClock.js';
import { inBay, bayToPicture } from '../../world/tamriel/tamrielFrame.js';
import { theatreAt } from '../../world/worldWide/worldGrid.js';
import { provinceKeyAt } from '../../world/tamriel/tamrielLand.js';
import { regionOfTheatre, REGION_RACES } from '../../formats/mapsTables.js';
import { DUNGEON_TYPES } from '../../formats/mapsFile.js';
import { TEMPLATE_BY_KEY, GROUP_TEMPLATES, templateStats, groupWeight } from './pveTemplates.js';
import { SPECIES_BY_KEY } from './pveSpecies.js';
import { ORSINIUM_REGION } from './pveBestiary.js';
import { drawByShare } from './pveEncounter.js';
import { spawnTable } from './pveSpawnTable.js';

/** The factions that hold a place: outlaws every road and wild, the clans their Wrothgar and their strongholds. A first
 *  pass until a territory map stands. @param {number} region @param {string} place @param {number|null} [dungeon] */
export function factionsHolding(region, place, dungeon = null) {
  const f = place === 'town' ? [] : ['bandits'];
  if (region === ORSINIUM_REGION || dungeon === DUNGEON_TYPES.OrcStronghold) f.push('orc-clans');
  return f;
}

/**
 * The spawn table at world pixel (`px`, `py`) at world minute `minute`: its region (the map's on the Bay, the
 * province's past it), province, climate and holders. `regionAt` and `climateAt` are the map's.
 * @param {number} px @param {number} py
 * @param {{ regionAt: (x: number, y: number) => number, climateAt: (x: number, y: number) => number, minute: number,
 *   place?: string, dungeon?: number|null, event?: string|null }} o
 */
export function pveTableAt(px, py, { regionAt, climateAt, minute, place = 'wild', dungeon = null, event = null }) {
  const region = inBay(px, py) ? regionAt(px, py) : regionOfTheatre(theatreAt(px, py));
  if (!(region >= 0)) return null;
  const province = provinceKeyAt(...bayToPicture(px + 0.5, py + 0.5)) ?? (REGION_RACES[region] === 1 ? 'Hammerfell' : 'HighRock');
  return spawnTable({ px, py, region, place, dungeon, province, climate: climateAt(px, py), night: isNight(minute), event,
    factions: factionsHolding(region, place, dungeon) });
}

/**
 * Member `i`'s template key under grant `gr` ({ k, s }) from `table`: an encounter's from the plain foes by its species
 * die; a camp's the seed's group, member by member. Null where the table holds none or the group is short of `i`.
 * @param {{ k: string, s: number }} gr @param {number} i @param {{ lists: Record<string, Array<{key: string, w: number}>> }|null} table
 */
export function grantTemplateKey(gr, i, table) {
  if (!table) return null;
  if (gr.k === 'camp') {
    const g = campGroup(gr, table);
    return g ? g.members.flatMap(([k, n]) => Array(n).fill(k))[i] ?? null : null;
  }
  return gr.k === 'encr' ? drawByShare(table.lists.encounter, 1, grantDice(gr.s, i).species)[0] ?? null : null;
}
/** A camp grant's group: the seed's draw from the table's groups. */
const campGroup = (gr, table) => GROUP_TEMPLATES.find((x) => x.key === drawByShare(table.lists.group, 1, grantRng(gr.s, 'group'))[0]) ?? null;

/** GROUP-SOLO (2026-10-30, a level 45 grinds groups in the level 45 area, and lower levels grind groups too): a camp's members stand as a pack whose whole weighs this many Normal foes of its level - one
 *  player grinds it (the simulator: 75-100% of every build at every group's level). A party zone keeps groups whole. */
export const GROUP_SOLO_WEIGHT = 1.5;
/** The pack share of group `g`: its members' health and blow over their template's, 1 where it already weighs no more. @param {any} g */
export const packShare = (g) => Math.min(1, GROUP_SOLO_WEIGHT / Math.max(1e-9, groupWeight(g)));

/** GROUP-PARTY (level 45 parties grind level 50 packs in an area they have to group for): in the party zone every foe stands whole at level 50 - a level
 *  45's health half again and its blow a quarter more. The simulator: four level 45 players grind any group there,
 *  three sometimes, two never. */
export const PARTY_FOE = Object.freeze({ level: 50, health: 1.5, damage: 1.25 });

/** Member `i`'s template foe under grant `gr` at `table`: a camp's at its pack share; the party zone's whole, at PARTY_FOE.
 *  @param {{ k: string, s: number }} gr @param {number} i @param {any} table */
export function grantTemplateFoe(gr, i, table) {
  const key = grantTemplateKey(gr, i, table);
  if (key && table?.zone?.party) {
    const t = TEMPLATE_BY_KEY.get(key), body = t ? SPECIES_BY_KEY.get(t.species)?.body : undefined;
    if (!t || body == null) return null;
    return Object.freeze({ key: t.key, name: t.name, mobile: body, ...templateStats({ ...t, pack: { health: PARTY_FOE.health, damage: PARTY_FOE.damage } }, 45), level: PARTY_FOE.level });
  }
  if (!key || gr.k !== 'camp') return templateFoe(key);
  const k = packShare(campGroup(gr, table));
  return templateFoe(key, { health: k, damage: k });
}

/** What a template stands as: its body's mobile id and its own level, health and blow. Null for no template. @param {string|null} key */
export function templateFoe(key, pack = null) {
  const t = key ? TEMPLATE_BY_KEY.get(key) : null;
  const body = t ? SPECIES_BY_KEY.get(t.species)?.body : undefined;
  if (!t || body == null) return null;
  return Object.freeze({ key: t.key, name: t.name, mobile: body, ...templateStats(pack ? { ...t, pack } : t) });   // GROUP-SOLO: a pack member's share
}

/** A reader's word on record `r` ({ t: mobile, l: level, gr: [g, i] }) under grant `gr` at `table`: 'dice' when its body
 *  or level is not the seed's template, else null. @param {{ k: string, s: number }} gr @param {any} r @param {any} table */
export function templateDiceRefusal(gr, r, table) {
  const f = templateFoe(grantTemplateKey(gr, r.gr[1], table));
  if (!f) return 'dice';
  return r.t !== f.mobile || (Number.isInteger(r.l) && r.l !== f.level) ? 'dice' : null;
}

/** Stand `entity` as template `foe`: its own name, level and health, and every blow it lands in the template's range
 *  (combat/formulas.js reads `pveBlow`) - after which nothing of the player's moves it. @param {any} entity @param {ReturnType<typeof templateFoe>} foe */
export function standTemplate(entity, foe) {
  if (!entity || !foe) return entity;
  entity.level = foe.level;
  entity.maxHealth = foe.health; entity.health = foe.health;
  entity.pveBlow = [foe.damage[0], foe.damage[1]];
  entity.pveTemplate = foe.key;
  entity.pveCategory = foe.category;   // pveBackstab.js: a leader's cap
  entity.name = foe.name;   // its own name over its body's, on the hover and the target bar
  return entity;
}

/** FIXED-PVE ELITES: a promoted template foe stands at this rank over its template - two levels, two and a half times
 *  the health, half again the blow - in place of the street elite's x5 health and x3 blows. */
export const ELITE_RANK = Object.freeze({ levels: 2, health: 2.5, damage: 1.5 });

/** Whether template `foe` may roll elite: a plain foe may; a leader (Strong, Elite, Champion) already is one. No template, the old law. @param {ReturnType<typeof templateFoe>} foe */
export const templateMayBeElite = (foe) => !foe || foe.category === 'normal';

/** Stand an elite template foe at ELITE_RANK over `foe` (after promoteEliteFoe, whose multipliers it replaces). @param {any} entity @param {ReturnType<typeof templateFoe>} foe */
export function rankTemplateElite(entity, foe) {
  if (!entity?.eliteFoe || !foe) return entity;
  entity.level = foe.level + ELITE_RANK.levels;
  entity.maxHealth = Math.max(1, Math.round(foe.health * ELITE_RANK.health)); entity.health = entity.maxHealth;
  entity.healthMult = ELITE_RANK.health;
  entity.damageScale = ELITE_RANK.damage;
  return entity;
}

/** FIXED-PVE REVENANTS: what revenant record `r` stands as when it was a template foe (its `tpl`): that template, a level
 *  higher per rank; its rank's health and blows ride on it (revenant.js applyRevenant). Null for one that was not. @param {any} r */
export function revenantTemplate(r) {
  const f = typeof r?.tpl === 'string' ? templateFoe(r.tpl) : null;
  return f ? Object.freeze({ ...f, level: f.level + Math.max(1, r.rank | 0) }) : null;
}

/** A template revenant's band: the rest of the first group its template fights in (else its own template again), at
 *  the templates' own levels, `n` of them - never the player's level. Null for a revenant that was no template.
 *  @param {any} r @param {number} n */
export function templateBand(r, n) {
  const own = typeof r?.tpl === 'string' ? templateFoe(r.tpl) : null;
  if (!own) return null;
  const g = GROUP_TEMPLATES.find((x) => x.members.some(([k]) => k === r.tpl));
  const keys = g ? g.members.flatMap(([k, c]) => Array(c).fill(k)) : [];
  const i = keys.indexOf(r.tpl);
  if (i >= 0) keys.splice(i, 1);
  while (keys.length < n) keys.push(r.tpl);
  return keys.slice(0, Math.max(0, n)).map((k) => templateFoe(k)).filter((f) => f != null).map((f) => ({ mobileType: f.mobile, level: f.level, template: f }));
}
