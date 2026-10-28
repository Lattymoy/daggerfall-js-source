// @ts-check
// FIXED-PVE (bible/05-Combat/Fixed-PvE.md): HOW A CREATURE FIGHTS, AND WHAT IT DOES WHEN IT DOES NOT. A combat role is
// a profile the tactics brain (ai/tactics.js) reads - where it stands, whom it picks, when it backs off - and a share of
// the category's health and blow it trades for that job. A noncombat role names a service the game already has. Roles
// combine, at most ROLE_MAX, never two that pull apart, and at most COMPLEX_MAX that run their own mechanic.
// Ledger A (FIXED-PVE).

/** @typedef {{ health: number, damage: number, stance: string, target: string, needs?: 'shoots'|'casts', complex?: boolean }} CombatRole */

/** @type {Readonly<Record<string, CombatRole>>} */
export const COMBAT_ROLES = Object.freeze({
  fighter: Object.freeze({ health: 1, damage: 1, stance: 'melee', target: 'threat' }),
  tank: Object.freeze({ health: 1.5, damage: 0.75, stance: 'front', target: 'nearestToAlly' }),
  archer: Object.freeze({ health: 0.8, damage: 1.1, stance: 'standOff', target: 'threat', needs: 'shoots' }),
  mage: Object.freeze({ health: 0.75, damage: 1.25, stance: 'standOff', target: 'lowestWard', needs: 'casts' }),
  healer: Object.freeze({ health: 0.85, damage: 0.6, stance: 'back', target: 'hurtAlly', needs: 'casts', complex: true }),
  assassin: Object.freeze({ health: 0.8, damage: 1.35, stance: 'flank', target: 'weakest' }),
  berserker: Object.freeze({ health: 1.1, damage: 1, stance: 'press', target: 'nearest' }),
  summoner: Object.freeze({ health: 0.8, damage: 0.7, stance: 'back', target: 'threat', needs: 'casts', complex: true }),
  commander: Object.freeze({ health: 1.25, damage: 0.9, stance: 'centre', target: 'threat', complex: true }),
});
export const COMBAT_ROLE_KEYS = Object.freeze(Object.keys(COMBAT_ROLES));

/** Services and ways of living the game already has; a creature may hold several, and still defends itself. */
export const NONCOMBAT_ROLES = Object.freeze(['civilian', 'merchant', 'trainer', 'questGiver', 'hunter', 'gatherer',
  'guard', 'patrol', 'traveller', 'caravan', 'factionAgent', 'wildlife', 'companion']);

export const ROLE_MAX = 2;
export const COMPLEX_MAX = 1;
/** Pairs that pull a body two ways at once. */
export const ROLE_CLASHES = Object.freeze([['tank', 'assassin'], ['tank', 'archer'], ['healer', 'berserker'],
  ['archer', 'berserker'], ['assassin', 'commander']]);

/** Why a set of combat roles cannot stand together, or null when it can. @param {string[]} roles */
export function roleProblem(roles) {
  if (!Array.isArray(roles) || !roles.length) return 'no combat role';
  if (roles.length > ROLE_MAX) return `more than ${ROLE_MAX} combat roles`;
  const bad = roles.find((r) => !COMBAT_ROLES[r]);
  if (bad) return `unknown combat role ${bad}`;
  if (new Set(roles).size !== roles.length) return 'a role twice';
  if (roles.filter((r) => COMBAT_ROLES[r].complex).length > COMPLEX_MAX) return `more than ${COMPLEX_MAX} complex role`;
  const clash = ROLE_CLASHES.find(([a, b]) => roles.includes(a) && roles.includes(b));
  return clash ? `${clash[0]} and ${clash[1]} clash` : null;
}

/** The health and blow shares of combined roles: the mean of each, so two roles never stack into a stronger foe. */
export function roleShares(roles) {
  const rs = roles.map((r) => COMBAT_ROLES[r]).filter(Boolean);
  if (!rs.length) return { health: 1, damage: 1 };
  return { health: rs.reduce((a, r) => a + r.health, 0) / rs.length, damage: rs.reduce((a, r) => a + r.damage, 0) / rs.length };
}
