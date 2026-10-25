// @ts-check
// LOOT-GATE (2026-10-25, Dudey: two streamers found Legendaries at level 1 and 2 and never used another weapon; "early
// game 1-8/9/10ish swap out between blue gear, then at roughly 10/11ish you start finding yellow gear rarely and then
// legendaries get a small increase of chance to drop").
//
// THE ROLLER'S LEVEL SCALES THE TOP OF THE LADDER. Every rarity roll read its source alone - a Crypt's pile is tier 9
// whoever opens it - so a level 1 character met a Legendary in about one Crypt in three. Now the Rare and Legendary
// thresholds are multiplied by a factor of the roller's level before the roll (lootRarity.js rarityChances); Magic is
// left alone. The source still decides the odds; the level only holds the top tiers back until the character is ready.
// NOT EVERY DOOR (AUDIT UPDATE L7, AUDIT UPDATE II A6 - LEFT, the owner's call): the world's shared and receipt-seeded
// spoils pick their tier off rarityChances with no level - the Gate, the Abyss, the raids, the Ketch, the serpent, the
// starfall, a staff event's, a revenant's trophy - so a young character there meets them as anyone does.
//
//   Rare:      x0.15 up to level 7, then up to x1 at level 12
//   Legendary: x0.05 up to level 9, x0.25 at level 10, then up to x1 at level 15
//
// The drought (lootDrought.js) does not count under DROUGHT_FROM, so it never builds a pile of pity that empties on the
// day the character turns 10 - though a Legendary taken early still empties it (AUDIT UPDATE L6). A Legendary that does
// drop early is a whole one; a plain piece can be imbued Magic, and a found Magic one Rare, at the Mages Guild's Reforge
// (reforge.js imbuePiece) - never Legendary.
//
// KEPT FROM PLAYERS (Dudey, 2026-10-25): patch notes, release notes, Discord posts and in-game help never state these
// levels, factors or chances. Players are told only that Rare and Legendary gear is rarer early on and becomes more
// common as they grow.
//
// A leaf: the curves and the registered level, no import. The level comes from whoever registers it
// (lootPowers.js: the live player's effective level, Mentor Mode's when on, once a host publishes the player's door -
// systems/playerDoor.js); a roll with no level registered and none handed in is not gated, so a test or a tool rolls
// as before. AUDIT UPDATE L1: a roll every client must agree on is never the local player's - a room's base is rolled
// inside withRollerLevel at the room's own level (scenes/roomLootHost.js rollRoomBase), and every gate under it reads
// that. AUDIT UPDATE L4: the corpse door names its roller's level itself (scenes/hostCombat.js spawnEnemyLoot), since a
// scene's first foes are rolled before any host has published the player's door.

/** The Rare factor's floor, the level it holds to, and the level it reaches x1 at. */
export const RARE_GATE = Object.freeze({ floor: 0.15, holdTo: 7, fullAt: 12 });
/** The Legendary factor's floor, the level it holds to, its first step past that, and the level it reaches x1 at. */
export const LEGENDARY_GATE = Object.freeze({ floor: 0.05, holdTo: 9, step: 0.25, fullAt: 15 });
/** Under this level the drought does not count. */
export const DROUGHT_FROM = 10;

const lv = (level) => Math.max(1, Math.floor(Number(level) || 1));

/** The Rare threshold's factor at a level. */
export function rareGate(level) {
  const L = lv(level);
  const g = RARE_GATE;
  if (L <= g.holdTo) return g.floor;
  if (L >= g.fullAt) return 1;
  return g.floor + ((1 - g.floor) * (L - g.holdTo)) / (g.fullAt - g.holdTo);
}

/** The Legendary threshold's factor at a level. */
export function legendaryGate(level) {
  const L = lv(level);
  const g = LEGENDARY_GATE;
  if (L <= g.holdTo) return g.floor;
  if (L >= g.fullAt) return 1;
  return g.step + ((1 - g.step) * (L - g.holdTo - 1)) / (g.fullAt - g.holdTo - 1);
}

/** AUDIT UPDATE L9: a level the gate reads - a positive finite number (a number's string too), else null: no gate. */
export function gateLevel(level) {
  const v = Number(level);   // null and '' read 0: no level
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Whether the drought is held at this level (null: no level, never held). */
export const droughtHeld = (level) => gateLevel(level) != null && lv(level) < DROUGHT_FROM;

let _level = null;
/** AUDIT UPDATE L1: the scope's level (`{ level }`) while withRollerLevel runs, else null. */
let _scoped = null;
/** Register the roller's level (a function answering a number), or clear it with null. */
export function registerRollerLevel(fn) { _level = typeof fn === 'function' ? fn : null; }
/** AUDIT UPDATE L1: run `fn` with the roller's level `level` - every gate under it reads that level, never the
 *  registered player's (null rolls ungated). Nests; answers `fn`'s answer. */
export function withRollerLevel(level, fn) {
  const was = _scoped;
  _scoped = { level: gateLevel(level) };
  let out;
  try { out = fn(); } finally { _scoped = was; }
  // AUDIT UPDATE II A9: the scope is synchronous - an async body would read no scope past its first await
  if (out && typeof out.then === 'function') throw new TypeError('withRollerLevel: the body must be synchronous');
  return out;
}
/** The roller's level now - a scope's (withRollerLevel), else the registered one - or null when there is none or it
 *  answers nonsense. */
export function rollerLevel() {
  if (_scoped) return _scoped.level;
  if (!_level) return null;
  try { return gateLevel(_level()); } catch { return null; }
}
