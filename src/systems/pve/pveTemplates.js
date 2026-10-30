// @ts-check
// FIXED-PVE (bible/05-Combat/Fixed-PvE.md): A MOB TEMPLATE IS ONE GAMEPLAY VARIANT - a species' body at a fixed level
// and category, with its roles, abilities, temper and kit. Many templates share one body: an Orc Grunt and an Orc
// Defender draw the same sprite and fight apart. Its numbers come from its level, category and roles alone, so two
// players meet the same foe. A group template is an encounter: members that fight as one. Ledger A (FIXED-PVE).

import { SPECIES_BY_KEY } from './pveSpecies.js';
import { PVE_CATEGORIES, LEVEL_MIN, LEVEL_MAX, categoryStats } from './pveCategories.js';
import { COMBAT_ROLES, NONCOMBAT_ROLES, roleProblem, roleShares } from './pveRoles.js';
import { abilityProblem } from './pveAbilities.js';
import { DISPOSITIONS, WILDLIFE, INTERACTIONS } from './pveDisposition.js';

/** The metals a foe's kit may be made of (systems/armorMaterials.js names). */
export const KIT_METALS = Object.freeze(['iron', 'steel', 'silver', 'elven', 'dwarven', 'mithril', 'adamantium',
  'ebony', 'orcish', 'daedric', 'leather', 'chain']);

/** @typedef {{ key: string, name: string, species: string, level: number, category: string, roles: string[],
 *  noncombat?: string[], abilities?: string[], disposition: string, wildlife?: string, interact?: string[],
 *  faction?: string|null, protected?: boolean, kit?: string|null }} MobTemplate */

const T = (o) => Object.freeze({ noncombat: [], abilities: [], interact: [], faction: null, protected: false, kit: null, ...o });

/** @type {ReadonlyArray<MobTemplate>} */
export const MOB_TEMPLATES = Object.freeze([
  // an orc stronghold: seven ways to be an orc on three bodies
  T({ key: 'orc-grunt', name: 'Orc Grunt', species: 'orc', level: 24, category: 'normal', roles: ['fighter'], abilities: ['cleave'], disposition: 'hostile', faction: 'orc-clans', kit: 'orcish' }),
  T({ key: 'orc-defender', name: 'Orc Defender', species: 'orc', level: 26, category: 'normal', roles: ['tank'], abilities: ['shieldWall', 'guardAlly'], disposition: 'hostile', faction: 'orc-clans', kit: 'orcish' }),
  T({ key: 'orc-hunter', name: 'Orc Hunter', species: 'orc', level: 27, category: 'normal', roles: ['assassin'], noncombat: ['hunter'], abilities: ['charge', 'retreat'], disposition: 'neutral', faction: 'orc-clans', kit: 'leather' }),
  T({ key: 'orc-shaman', name: 'Orc Shaman', species: 'orc-shaman', level: 29, category: 'normal', roles: ['mage', 'healer'], abilities: ['shamanSpells', 'mendAlly'], disposition: 'neutral', faction: 'orc-clans' }),
  T({ key: 'orc-warlord', name: 'Orc Warlord', species: 'orc-warlord', level: 33, category: 'strong', roles: ['commander', 'fighter'], abilities: ['warCry', 'rally', 'callHelp'], disposition: 'hostile', faction: 'orc-clans', kit: 'orcish' }),
  T({ key: 'orc-merchant', name: 'Orc Merchant', species: 'orc', level: 25, category: 'normal', roles: ['fighter'], noncombat: ['merchant'], disposition: 'friendly', interact: ['talk', 'trade'], faction: 'orc-clans', protected: true }),
  T({ key: 'orc-stronghold-guard', name: 'Orc Stronghold Guard', species: 'orc-sergeant', level: 30, category: 'strong', roles: ['tank'], noncombat: ['guard'], abilities: ['shieldWall', 'callHelp'], disposition: 'neutral', faction: 'orc-clans', protected: true, kit: 'orcish' }),
  // a crypt
  T({ key: 'crypt-skeleton', name: 'Crypt Skeleton', species: 'skeletal-warrior', level: 12, category: 'normal', roles: ['fighter'], disposition: 'hostile', kit: 'iron' }),
  T({ key: 'crypt-guardian', name: 'Crypt Guardian', species: 'skeletal-warrior', level: 15, category: 'strong', roles: ['tank'], abilities: ['shieldWall', 'stoneskin'], disposition: 'hostile', kit: 'steel' }),
  T({ key: 'crypt-wraith', name: 'Crypt Wraith', species: 'wraith', level: 18, category: 'normal', roles: ['assassin'], abilities: ['interrupt'], disposition: 'hostile' }),
  T({ key: 'crypt-lich', name: 'Lich of the Deep Crypt', species: 'lich', level: 40, category: 'boss', roles: ['mage', 'summoner'], abilities: ['lichSpells', 'summonKin', 'warded', 'curbing'], disposition: 'hostile' }),
  // a bandit camp on class bodies (the ones with bows)
  T({ key: 'bandit-cutthroat', name: 'Bandit Cutthroat', species: 'rogue', level: 8, category: 'normal', roles: ['assassin'], abilities: ['charge'], disposition: 'hostile', faction: 'bandits', kit: 'leather' }),
  T({ key: 'bandit-archer', name: 'Bandit Archer', species: 'archer', level: 9, category: 'normal', roles: ['archer'], abilities: ['retreat'], disposition: 'hostile', faction: 'bandits', kit: 'leather' }),
  T({ key: 'bandit-hedge-healer', name: 'Bandit Hedge-Healer', species: 'healer', level: 10, category: 'normal', roles: ['healer'], abilities: ['mendAlly', 'mendSelf'], disposition: 'hostile', faction: 'bandits' }),
  T({ key: 'bandit-chief', name: 'Bandit Chief', species: 'barbarian', level: 12, category: 'strong', roles: ['commander', 'berserker'], abilities: ['warCry', 'rally', 'rage'], disposition: 'hostile', faction: 'bandits', kit: 'steel' }),
  // the wild
  T({ key: 'wild-rat', name: 'Rat', species: 'rat', level: 1, category: 'normal', roles: ['fighter'], noncombat: ['wildlife'], disposition: 'neutral', wildlife: 'passive' }),
  T({ key: 'grizzly', name: 'Grizzly Bear', species: 'grizzly-bear', level: 6, category: 'normal', roles: ['berserker'], noncombat: ['wildlife'], abilities: ['rage'], disposition: 'territorial', wildlife: 'territorial' }),
  T({ key: 'sabretooth', name: 'Sabretooth', species: 'sabretooth-tiger', level: 9, category: 'normal', roles: ['assassin'], noncombat: ['wildlife'], abilities: ['leap'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'grove-spriggan', name: 'Grove Spriggan', species: 'spriggan', level: 8, category: 'normal', roles: ['tank'], abilities: ['mendSelf'], disposition: 'territorial' }),
  // a raid
  T({ key: 'orc-warchief', name: 'Warchief of the Iron Clan', species: 'orc-warlord', level: 45, category: 'raidBoss', roles: ['commander', 'berserker'], abilities: ['warCry', 'rally', 'callHelp', 'rage', 'curbing', 'warded', 'wrathful'], disposition: 'hostile', faction: 'orc-clans', kit: 'orcish' }),
]);

/** @typedef {{ key: string, name: string, members: Array<[string, number]>, leader?: string, community?: boolean }} GroupTemplate */

/** @type {ReadonlyArray<GroupTemplate>} */
export const GROUP_TEMPLATES = Object.freeze(/** @type {GroupTemplate[]} */ ([
  Object.freeze({ key: 'orc-warband', name: 'Orc Warband', members: [['orc-grunt', 2], ['orc-defender', 1], ['orc-shaman', 1]] }),
  Object.freeze({ key: 'orc-war-party', name: 'Orc War Party', members: [['orc-grunt', 2], ['orc-defender', 1], ['orc-shaman', 1], ['orc-warlord', 1]], leader: 'orc-warlord' }),
  Object.freeze({ key: 'bandit-camp', name: 'Bandit Camp', members: [['bandit-cutthroat', 2], ['bandit-archer', 2], ['bandit-hedge-healer', 1], ['bandit-chief', 1]], leader: 'bandit-chief' }),
  Object.freeze({ key: 'crypt-patrol', name: 'Crypt Patrol', members: [['crypt-skeleton', 3], ['crypt-guardian', 1]] }),
  // STAGE 4: a peaceful community - its people meet a player by the clan's standing (pveStanding.js)
  Object.freeze({ key: 'orc-stronghold', name: 'Orc Stronghold', members: [['orc-merchant', 1], ['orc-stronghold-guard', 2], ['orc-hunter', 1], ['orc-shaman', 1]], leader: 'orc-stronghold-guard', community: true }),
]));

export const TEMPLATE_BY_KEY = new Map(MOB_TEMPLATES.map((t) => [t.key, t]));

/** Every reason `t` cannot stand (empty when it can). @param {MobTemplate} t */
export function templateProblems(t) {
  const out = [];
  const sp = SPECIES_BY_KEY.get(t?.species);
  if (!t?.key || !t?.name) out.push('no key or name');
  if (!sp) out.push(`unknown species ${t?.species}`);
  if (!Number.isInteger(t?.level) || t.level < LEVEL_MIN || t.level > LEVEL_MAX) out.push(`level ${t?.level} outside ${LEVEL_MIN}-${LEVEL_MAX}`);
  if (!PVE_CATEGORIES[t?.category]) out.push(`unknown category ${t?.category}`);
  const rp = roleProblem(t?.roles); if (rp) out.push(rp);
  for (const r of t?.roles ?? []) {
    const need = COMBAT_ROLES[r]?.needs;
    if (need && sp && !sp[need]) out.push(`${r} needs a body that ${need}; ${sp.name} does not`);
  }
  for (const n of t?.noncombat ?? []) if (!NONCOMBAT_ROLES.includes(n)) out.push(`unknown noncombat role ${n}`);
  for (const a of t?.abilities ?? []) { const p = abilityProblem(a); if (p) out.push(p); }
  if (!DISPOSITIONS.includes(t?.disposition)) out.push(`unknown disposition ${t?.disposition}`);
  if (t?.wildlife != null && !WILDLIFE[t.wildlife]) out.push(`unknown wildlife way ${t.wildlife}`);
  for (const i of t?.interact ?? []) if (!INTERACTIONS.includes(i)) out.push(`unknown interaction ${i}`);
  if ((t?.interact ?? []).length && t.disposition === 'hostile') out.push('a hostile creature offers no service');
  if (t?.kit != null && !KIT_METALS.includes(t.kit)) out.push(`unknown kit metal ${t.kit}`);
  return out;
}

/** Every reason `g` cannot stand. @param {GroupTemplate} g @param {Map<string, MobTemplate>} [byKey] */
export function groupProblems(g, byKey = TEMPLATE_BY_KEY) {
  const out = [];
  if (!g?.members?.length) out.push('no members');
  for (const [k, n] of g?.members ?? []) {
    if (!byKey.has(k)) out.push(`unknown member ${k}`);
    if (!(Number.isInteger(n) && n > 0)) out.push(`${k} count ${n}`);
  }
  if (g?.leader != null && !(g.members ?? []).some(([k]) => k === g.leader)) out.push(`leader ${g.leader} is not a member`);
  if (g?.community) for (const [k] of g.members ?? []) if (byKey.get(k)?.disposition === 'hostile') out.push(`a community's ${k} starts hostile`);
  return out;
}

/**
 * A template's own numbers: health and a blow's [min, max] from its level, category and roles - nothing else is read. Pure.
 * @param {MobTemplate} t
 */
export function templateStats(t) {
  const base = categoryStats(t.level, t.category);
  const s = roleShares(t.roles);
  return { level: base.level, category: base.category, health: Math.max(1, Math.round(base.health * s.health)),
    damage: /** @type {[number, number]} */ ([Math.max(1, Math.round(base.damage[0] * s.damage)), Math.max(1, Math.round(base.damage[1] * s.damage))]) };
}

/** How many reference players of the group's level a group weighs: each member's health times blow over a Normal foe's,
 *  the square root of it, summed - so N Normal foes weigh N. */
export function groupWeight(g, byKey = TEMPLATE_BY_KEY) {
  let w = 0;
  for (const [k, n] of g.members) {
    const t = byKey.get(k); if (!t) continue;
    const c = PVE_CATEGORIES[t.category], s = roleShares(t.roles);
    w += n * Math.sqrt(c.health * s.health * c.damage * s.damage);
  }
  return w;
}
