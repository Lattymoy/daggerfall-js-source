// @ts-check
// FIXED-PVE STAGE 6 (bible/05-Combat/Fixed-PvE.md section 8): THE ENCOUNTER DIRECTOR AND WHO JOINS A FIGHT. The director
// builds a place's encounters from what lives there (pveBestiary.js), inside the zone's fixed level band, from the place
// and a seed alone - no player, no Combat Score, no party size. A peaceful or protected population is ambient, never a
// hostile encounter, unless an event says so. A struck creature's group joins it; nearby kin of its faction join if
// already hostile, its guards if the blow wronged the faction; a shared species alone brings nobody, and a joiner calls
// no one further. Every harmful ability must give a tell a player can answer over the network. Ledger A (FIXED-PVE).
import { TEMPLATE_BY_KEY, GROUP_TEMPLATES, templateProblems } from './pveTemplates.js';
import { ABILITIES } from './pveAbilities.js';
import { regionalTemplates } from './pveBestiary.js';
import { aggressionKind } from './pveStanding.js';

/** Encounter kinds (spec 16.1): the categories each draws and the party it is made for. */
export const ENCOUNTER_KINDS = Object.freeze({
  solo: Object.freeze({ categories: ['normal', 'strong'], party: 1 }),
  smallGroup: Object.freeze({ group: true, party: 4 }),
  eliteGroup: Object.freeze({ categories: ['elite', 'champion'], party: 3 }),
  dungeonBoss: Object.freeze({ categories: ['boss'], party: 5 }),
  worldBoss: Object.freeze({ categories: ['boss'], party: 5, personal: true }),
  raid: Object.freeze({ categories: ['raidBoss'], party: 10, personal: true }),
});

/** The least tell (seconds) a harmful ability gives: a blow or a spell, and one that strikes an area. */
export const TELL_MIN = Object.freeze({ blow: 0.3, area: 0.8 });
const HARMS = ['blow:', 'spells:', 'summon:', 'tactics:charge', 'tactics:leap'];

/** Why ability `a` (keyed `k`) is too quick to answer, or null: a harmful one must give its tell. @param {string} k @param {any} a */
export function tellProblem(k, a) {
  if (a?.kind !== 'active' || !HARMS.some((h) => a.uses.startsWith(h))) return null;
  const need = a.area ? TELL_MIN.area : TELL_MIN.blow;
  return (a.tell ?? 0) >= need ? null : `${k} gives ${a.tell ?? 0} s of tell, under ${need}`;
}

/** Every harmful ability of `t` whose tell is too short to answer. @param {any} t */
export const readabilityProblems = (t) => (t?.abilities ?? []).map((k) => tellProblem(k, ABILITIES[k])).filter(Boolean);

/** A seeded number source from a place's key: the same key, the same encounters. @param {string} key */
export function placeRng(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let s = h >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; };
}

/** Whether `t` starts a fight with nobody's standing in play, or the place's event makes it hostile. */
const startsHostile = (t, event) => event === 'hostile' || (!t.protected && (t.wildlife ? t.wildlife === 'predatory' : t.disposition === 'hostile'));

/**
 * A place's encounters of `kind`: its templates in the zone's band that stand and read, split into hostile and ambient,
 * and `count` picks drawn by share from the place's seed. Groups for a small group: every member living there, in band.
 * @param {{ band: [number, number], kind?: string, count?: number, key: string }} zone
 * @param {Parameters<typeof regionalTemplates>[0] & { event?: string|null }} place
 */
export function directEncounters({ band, kind = 'solo', count = 3, key }, place) {
  const k = ENCOUNTER_KINDS[kind];
  const lives = new Map(regionalTemplates(place).map((x) => [x.template, x.weight]));
  const fit = (t) => t && t.level >= band[0] && t.level <= band[1] && !templateProblems(t).length && !readabilityProblems(t).length;
  const pool = [...lives].map(([tk, w]) => ({ t: TEMPLATE_BY_KEY.get(tk), w })).filter((x) => fit(x.t));
  const ambient = pool.filter((x) => !startsHostile(x.t, place.event)).map((x) => x.t.key);
  let hostile;
  if (k?.group) hostile = GROUP_TEMPLATES.filter((g) => !g.community && g.members.every(([m]) => lives.has(m) && fit(TEMPLATE_BY_KEY.get(m))))
    .map((g) => ({ key: g.key, w: Math.min(...g.members.map(([m]) => lives.get(m) ?? 0)) }));
  else hostile = pool.filter((x) => startsHostile(x.t, place.event) && k?.categories?.includes(x.t.category)).map((x) => ({ key: x.t.key, w: x.w }));
  hostile.sort((a, b) => a.key.localeCompare(b.key));
  const rng = placeRng(`${key}|${kind}`), total = hostile.reduce((s, x) => s + x.w, 0), picks = [];
  for (let i = 0; i < count && total > 0; i++) {
    let r = rng() * total;
    picks.push((hostile.find((x) => (r -= x.w) < 0) ?? hostile[hostile.length - 1]).key);
  }
  return { hostile: hostile.map((x) => x.key), ambient: ambient.sort(), picks, party: k?.party ?? 1, personal: !!k?.personal };
}

/** How far kin hear a fight (metres), how many may join one blow, and how far a creature's own group comes from. */
export const ASSIST = Object.freeze({ radius: 20, groupRadius: 40, max: 6 });

/**
 * Who joins a fight when `struck` is hit: its own group within reach; within the assist radius, its faction's kin
 * already hostile, and its guards when the blow wronged the faction. Nearest first, at most ASSIST.max; a joiner (`depth` past
 * 0) calls nobody.
 * @param {{ template: any, group?: string|null, state: string }} struck
 * @param {Array<{ id: string, template: any, group?: string|null, dist: number, state: string }>} near
 * @param {{ depth?: number, provoked?: boolean }} [o]
 */
export function assistants(struck, near, { depth = 0, provoked = false } = {}) {
  if (depth > 0) return [];
  const kind = aggressionKind(struck.template, struck.state, { provoked });
  const wronged = kind === 'protected' || kind === 'factionMember';
  const fac = struck.template?.faction;
  return near.filter((o) => {
    if (struck.group && o.group === struck.group) return o.dist <= ASSIST.groupRadius;
    if (!fac || o.template?.faction !== fac || o.dist > ASSIST.radius) return false;
    return o.state === 'hostile' || (wronged && (o.template?.noncombat ?? []).includes('guard'));
  }).sort((a, b) => a.dist - b.dist || a.id.localeCompare(b.id)).slice(0, ASSIST.max).map((o) => o.id);
}
