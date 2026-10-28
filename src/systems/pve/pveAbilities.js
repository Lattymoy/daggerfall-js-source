// @ts-check
// FIXED-PVE (bible/05-Combat/Fixed-PvE.md): ONE LIBRARY OF FOE ABILITIES, EACH A THING THE GAME ALREADY DOES. `uses`
// names the system that runs it (a tactics gap closer, a boss trait, a body's classic spell list, a heal), so a
// template picks abilities by key and adds no code. Every active ability has a cooldown, a trigger and a tell a player
// can read and answer; a passive is always on. Ledger A (FIXED-PVE).

import { BOSS_TRAITS } from '../bossTraits.js';
import { MONSTER_SPELL_LISTS } from '../enemySpells.js';

/** When an active ability may fire. */
export const TRIGGERS = Object.freeze(['inCombat', 'targetFar', 'targetCasting', 'selfHurt', 'allyHurt', 'allyDied',
  'leaderDied', 'combatStart']);

/** @typedef {{ kind: 'active'|'passive', uses: string, cooldown?: number, trigger?: string, below?: number,
 *  tell?: number, area?: number, value?: number, body?: number }} Ability */

/** @type {Readonly<Record<string, Ability>>} */
export const ABILITIES = Object.freeze({
  // movement and blows (ai/tactics.js)
  charge: Object.freeze({ kind: 'active', uses: 'tactics:charge', cooldown: 12, trigger: 'targetFar', tell: 0.8 }),
  leap: Object.freeze({ kind: 'active', uses: 'tactics:leap', cooldown: 14, trigger: 'targetFar', tell: 0.6 }),
  warCry: Object.freeze({ kind: 'active', uses: 'tactics:roar', cooldown: 30, trigger: 'combatStart', tell: 1, area: 12, value: 0.15 }),
  cleave: Object.freeze({ kind: 'active', uses: 'blow:arc', cooldown: 8, trigger: 'inCombat', tell: 0.9, area: 3 }),
  retreat: Object.freeze({ kind: 'active', uses: 'tactics:backOff', cooldown: 20, trigger: 'selfHurt', below: 0.3 }),
  // a group's own
  shieldWall: Object.freeze({ kind: 'active', uses: 'guard:self', cooldown: 25, trigger: 'selfHurt', below: 0.6, tell: 0.5, value: 0.4 }),
  guardAlly: Object.freeze({ kind: 'active', uses: 'guard:ally', cooldown: 15, trigger: 'allyHurt', below: 0.5, value: 0.3 }),
  rally: Object.freeze({ kind: 'active', uses: 'aura:damage', cooldown: 40, trigger: 'combatStart', area: 15, value: 0.15 }),
  avenge: Object.freeze({ kind: 'active', uses: 'aura:damage', cooldown: 60, trigger: 'leaderDied', area: 20, value: 0.25 }),
  callHelp: Object.freeze({ kind: 'active', uses: 'social:call', cooldown: 60, trigger: 'selfHurt', below: 0.5, area: 30 }),
  summonKin: Object.freeze({ kind: 'active', uses: 'summon:kin', cooldown: 45, trigger: 'inCombat', tell: 2, value: 2 }),
  // healing (systems/spellcast.js through the body's own effect)
  mendAlly: Object.freeze({ kind: 'active', uses: 'heal:ally', cooldown: 10, trigger: 'allyHurt', below: 0.6, tell: 1.5, value: 0.25 }),
  mendSelf: Object.freeze({ kind: 'active', uses: 'heal:self', cooldown: 20, trigger: 'selfHurt', below: 0.4, tell: 1.5, value: 0.2 }),
  // spells: the classic list of the named body (systems/enemySpells.js)
  shamanSpells: Object.freeze({ kind: 'active', uses: 'spells:list', body: 21, cooldown: 6, trigger: 'inCombat', tell: 1 }),
  lichSpells: Object.freeze({ kind: 'active', uses: 'spells:list', body: 32, cooldown: 5, trigger: 'inCombat', tell: 1 }),
  daedraSpells: Object.freeze({ kind: 'active', uses: 'spells:list', body: 31, cooldown: 5, trigger: 'inCombat', tell: 1 }),
  interrupt: Object.freeze({ kind: 'active', uses: 'blow:interrupt', cooldown: 12, trigger: 'targetCasting', tell: 0.3 }),
  // passives
  rage: Object.freeze({ kind: 'passive', uses: 'self:rage', below: 0.35, value: 0.25 }),
  ...Object.fromEntries(BOSS_TRAITS.map((t) => [t, Object.freeze({ kind: 'passive', uses: `bossTrait:${t}` })])),
});
export const ABILITY_KEYS = Object.freeze(Object.keys(ABILITIES));

/** Why an ability key cannot stand, or null. @param {string} key */
export function abilityProblem(key) {
  const a = ABILITIES[key];
  if (!a) return `unknown ability ${key}`;
  if (a.kind === 'active' && !(a.cooldown > 0)) return `${key} has no cooldown`;
  if (a.kind === 'active' && !TRIGGERS.includes(/** @type {string} */ (a.trigger))) return `${key} has no trigger`;
  if (a.uses === 'spells:list' && MONSTER_SPELL_LISTS[/** @type {number} */ (a.body)] == null) return `${key} names a body with no spells`;
  return null;
}
