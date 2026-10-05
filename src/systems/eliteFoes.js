// ELITE FOES (2026-10-01, Mac: "randomly spawn elite enemies in dungeons and in the overworld ... 5x hp and do 3x
// damage. [They drop better loot.] They can appear up
// to 3 - 4 times in Elite Dungeons and in the overworld in any overworld enemy you can move to with a 5% chance ...
// make em bigger by 25% and make em glow").
//
// AN ELITE IS ONE FOE, NOT A PLACE. The Elite DUNGEON (world/spawnedDungeons.js) stands three foes at each marker at
// double strength; an ELITE FOE is a single champion among them - or one of a roaming band, a camp, a wild encounter -
// at five times its rolled health and three times its blows and spells, a quarter larger, glowing, with a gear drop of
// its own. The field on the entity is `eliteFoe` (`elite` is already the Elite Dungeon's word on every foe there, and
// `champion` LOOT7's trait - systems/champions.js; a foe is one or the other, never both).
//
// SHARED ONLINE WITH NOTHING NEW TO AGREE ON:
//   - in a dungeon every client builds the same foe list (the foe frame's index law), so the champions are a pure pick
//     over that list, seeded by the dungeon's own location id - every client marks the same records;
//   - outdoors the foe's owner rolls the 5% and the foe record carries it (`z`, net/wire.js), so a puppet stands as the
//     same elite: the size, the glow and the blows it lands at me (its owner's maximum health rides `k` already).
//
// PURE but for the item minters - the hosts call in.
import { createRandomWeapon, createRandomArmor } from './loot.js';
import { mintCondition, setItemFields } from './itemTemplates.js';
import { applyRarity, rarityEligible, rarityChances, championSource, corpseSource } from './lootRarity.js';   // ELITE-RARE: the champion's blue the elite's Rare is read off
import { goldStack } from './inventory.js';
import { isAmmunition } from './itemTemplates.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';   // ELITE-FLOOR: the watch is never an elite
import { ENEMY_BASICS } from '../characters/enemyBasics.js';   // ELITE-FLOOR: a kind's own level, the same on every client

/** Health and damage, times the foe's own (rolled, before any Elite Dungeon doubling - an elite is 5x, not 10x). */
export const ELITE_FOE_HEALTH_MULT = 5;
export const ELITE_FOE_DAMAGE_MULT = 3;
/** ...and in an Elite Dungeon, where every foe is already doubled: a partial stack, not 10x / 6x. */
export const ELITE_FOE_ELITE_DUNGEON_HEALTH_MULT = 7;
export const ELITE_FOE_ELITE_DUNGEON_DAMAGE_MULT = 4;
/** How much larger the sprite is drawn. */
export const ELITE_FOE_SIZE = 1.25;
/** The chance a foe in the open world stands as an elite. ELITE-RATES (2026-10-03, Mac: "Feel like they are too
 *  sparse. Back to original"): one in twenty again, no gate - ELITE-RARITY's one in fifty past a 180-minute gap undone. */
export const ELITE_FOE_OVERWORLD_CHANCE = 0.05;
/** How many elites an Elite Dungeon holds: 3 or 4 (fewer only if it has fewer foes). */
export const ELITE_FOE_DUNGEON_MIN = 3;
export const ELITE_FOE_DUNGEON_MAX = 4;
/** A normal (not Elite) dungeon holds at most one elite, and only this often (ELITE-RATES: one in five again). */
export const ELITE_FOE_NORMAL_DUNGEON_CHANCE = 0.2;
/** The elite's extra drop - better loot than its kind carries. */
export const ELITE_FOE_LOOT = Object.freeze({ magic: 2, common: 1, legendaryChance: 0.06, goldPerLevel: [20, 60] });   // ELITE-RARE: the Rare's chance is eliteRareChance's, by level
/** ELITE-RARE (2026-10-03, Mac: an elite's Rare "should be half of" a champion's blue): the elite's extra Rare roll, at a
 *  level - half the chance a champion's body of that level carries a Magic or better, with ELITE_RARE_PIECES eligible
 *  pieces on it (systems/lootRarity.js championSource: its Magic at half a plain foe's), at Luck 50. It was a flat 25%. */
export const ELITE_RARE_PIECES = 2;
export const ELITE_RARE_SHARE = 0.5;
export function eliteRareChance(level = 1) {
  const lv = Math.max(1, level | 0);
  const blue = rarityChances(championSource(corpseSource({ level: lv }, lv, null))).magic / 1000;
  return ELITE_RARE_SHARE * (1 - (1 - blue) ** ELITE_RARE_PIECES);
}
/** The name the HUD's target bar gives one (and, FOE-TITLE, every other surface - systems/foeTitle.js). */
export const ELITE_FOE_PREFIX = 'Elite ';
/** ELITE-FLOOR (2026-10-02): an elite is a foe of this level or more - LOOT7's champion floor (systems/champions.js
 *  CHAMPION_MIN_LEVEL), so a new character's first road is never a five-times foe that hits three times as hard. */
export const ELITE_FOE_MIN_LEVEL = 3;

/** ELITE-FLOOR: may this freshly built foe stand as an elite? Never under ELITE_FOE_MIN_LEVEL, never the city watch,
 *  never an ally - LOOT7's own exclusions (systems/champions.js applyChampion). */
export const eliteEligible = (entity, { checkLevel = true } = {}) => !!entity
  && (!checkLevel || (entity.level | 0) >= ELITE_FOE_MIN_LEVEL)
  && entity.mobileType !== KNIGHT_CITY_WATCH
  && entity.team !== 'PlayerAlly' && entity.mobileTeam !== 'PlayerAlly';

/** ONLINE ONLY (Mac: "elite enemies are online mode only"): elites stand in online play alone - an online page, or a
 *  host in a room. Offline and single-player, no foe is ever an elite. */
export const elitesAllowed = ({ onlinePage = false, inRoom = false } = {}) => !!(onlinePage || inRoom);

/** Is this entity an elite foe? */
export const isEliteFoe = (entity) => !!entity?.eliteFoe;

/** Make a freshly built foe an elite: health, damage, the flag. `own` false for a puppet - its maximum is its owner's
 *  word (the record's `k`), so only the blows, the size and the glow are stood here (and its owner already asked
 *  eliteEligible). Idempotent. ELITE-FLOOR: answers whether it stands as an elite - false for a foe eliteEligible
 *  refuses, which is then built as it would have been. */
export function promoteEliteFoe(entity, { own = true, eliteDungeon = false, checkLevel = true } = {}) {
  if (!entity) return false;
  if (entity.eliteFoe) return true;
  if (own && !eliteEligible(entity, { checkLevel })) return false;
  entity.eliteFoe = true;
  // the hosts promote BEFORE any other scaling (and in place of the Elite Dungeon's doubling), so this is the foe's own
  // roll: an elite is 5x, not 10x
  if (own) {
    const hm = eliteDungeon ? ELITE_FOE_ELITE_DUNGEON_HEALTH_MULT : ELITE_FOE_HEALTH_MULT;
    entity.maxHealth = Math.max(1, Math.round((entity.maxHealth || 1) * hm));
    entity.health = entity.maxHealth;
    entity.healthMult = (entity.healthMult ?? 1) * hm;   // TELL1: what was stood on the kind's own health (ai/tells.js kindHealth - its poise)
  }
  const prior = Number.isFinite(entity.damageScale) && entity.damageScale > 0 ? entity.damageScale : 1;
  entity.damageScale = prior * (eliteDungeon ? ELITE_FOE_ELITE_DUNGEON_DAMAGE_MULT : ELITE_FOE_DAMAGE_MULT);
  return true;
}

/** A small, stable 32-bit hash (FNV-1a) - the dungeon's pick and the roll's seed. */
export function eliteHash(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    h ^= 0x2c; h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
/** A seeded [0,1) stream (mulberry32). */
export function eliteRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * THE DUNGEON'S PICK (normal dungeons: 0 or 1, see below): which records of the dungeon's (already expanded) foe list are elites - 3 or 4 of them,
 * never an ally or a passive foe, the same on every client (seeded by `key`, the dungeon's location id). Marks them
 * `eliteFoe: true` in place and answers how many.
 */
export function pickDungeonElites(enemies, key, { elite = true } = {}) {
  if (!Array.isArray(enemies) || !enemies.length) return 0;
  const rng = eliteRng(eliteHash(elite ? 'elite-dungeon' : 'normal-dungeon', key));
  // an Elite Dungeon: 3 or 4; a normal one: at most 1, one time in five
  const want = elite
    ? ELITE_FOE_DUNGEON_MIN + Math.floor(rng() * (ELITE_FOE_DUNGEON_MAX - ELITE_FOE_DUNGEON_MIN + 1))
    : (rng() < ELITE_FOE_NORMAL_DUNGEON_CHANCE ? 1 : 0);
  const pool = [];
  // ELITE-FLOOR, the same on every client: a kind under the floor by its OWN level never stands as one (a class foe's
  // level is the party's, built per client, so the floor is the pick's here and promoteEliteFoe is told not to re-ask)
  const kindLevel = (t) => (t >= 128 ? Infinity : (ENEMY_BASICS[t]?.level ?? 0));
  enemies.forEach((e, i) => { if (e && !e.allied && e.reaction !== 'passive' && e.champion == null && kindLevel(e.mobileType) >= ELITE_FOE_MIN_LEVEL) pool.push(i); });   // never a LOOT7 champion (systems/champions.js; its trait index, 0 a trait too) - one or the other
  let n = 0;
  while (n < want && pool.length) {
    const at = Math.floor(rng() * pool.length);
    const i = pool.splice(at, 1)[0];
    enemies[i].eliteFoe = true;
    n++;
  }
  return n;
}

/** THE OPEN WORLD'S ROLL: is this new foe an elite? */
export const rollOverworldElite = (rolls = Math.random) => rolls() < ELITE_FOE_OVERWORLD_CHANCE;

function gearPiece(level, rolls) {
  for (let tries = 0; tries < 6; tries++) {
    const raw = rolls() < 0.5 ? createRandomWeapon(level, rolls) : createRandomArmor(level, rolls);
    if (!raw || isAmmunition(raw)) continue;
    const it = mintCondition(setItemFields(raw));
    if (it) return it;
  }
  return null;
}
function tiered(level, tier, rolls) {
  for (let tries = 0; tries < 6; tries++) {
    const it = gearPiece(level, rolls);
    if (!it) continue;
    if (tier === 'common') return it;
    if (!rarityEligible(it)) continue;
    applyRarity(it, tier, rolls);
    if (it.rarity === tier || (tier === 'legendary' && it.rarity)) return it;
  }
  return null;
}
/** REVENANT: a gear piece (a weapon or armour, never ammunition) at a tier - the elite's own minting, shared. */
export const tieredGear = (level, tier, rolls = Math.random) => tiered(Math.max(1, level | 0), tier, rolls);

/** THE ELITE'S DROP, added to the body's loot: better loot than its kind carries (the table above). */
export function eliteLoot(level = 1, rolls = Math.random) {
  const lv = Math.max(1, level | 0);
  const out = [];
  for (let i = 0; i < ELITE_FOE_LOOT.magic; i++) { const it = tiered(lv, 'magic', rolls); if (it) out.push(it); }
  for (let i = 0; i < ELITE_FOE_LOOT.common; i++) { const it = tiered(lv, 'common', rolls); if (it) out.push(it); }
  if (rolls() < eliteRareChance(lv)) { const it = tiered(lv, 'rare', rolls); if (it) out.push(it); }   // ELITE-RARE: half a champion's blue at this level
  if (rolls() < ELITE_FOE_LOOT.legendaryChance) { const it = tiered(lv, 'legendary', rolls); if (it) out.push(it); }
  const [lo, hi] = ELITE_FOE_LOOT.goldPerLevel;
  out.push(goldStack(Math.round(lv * (lo + rolls() * (hi - lo)))));
  return out;
}

/** Give an elite its drop (once). */
export function grantEliteLoot(entity, level, rolls = Math.random) {
  if (!entity?.eliteFoe || entity._eliteLoot) return;
  entity._eliteLoot = true;
  entity.items = entity.items ?? [];
  entity.items.push(...eliteLoot(level ?? entity.level, rolls));
}

/** THE GLOW: a slow pulse, 0.55..1, phased per foe so a pack does not breathe in step. 0 for anything not elite. */
export function eliteGlow(entity, nowSeconds, phase = 0) {
  if (!entity?.eliteFoe) return 0;
  return 0.775 + 0.225 * Math.sin(nowSeconds * 3.2 + phase);
}
/** Put the glow on a billboard batch (written only when it changes - the draw reads 0 for undefined). */
/** How far an elite's quad reaches past its sprite (left, bottom, right, top, as fractions of the sprite): room for the
 *  outline where a sprite is cropped to its frame, and above the head for the embers to climb. */
export const ELITE_FOE_PAD = Object.freeze([0.08, 0.03, 0.08, 0.24]);
export function setBatchEliteGlow(batch, k, nowSeconds = 0) {
  if (!batch) return;
  const v = k > 0 ? k : 0;
  if ((batch.eliteGlow || 0) !== v) batch.eliteGlow = v;
  batch.elitePad = v > 0 ? ELITE_FOE_PAD : null;
  if (v > 0) batch.eliteTime = nowSeconds % 3600;   // the embers' clock (wrapped, so a float keeps its precision)
}
/** THE BODY (Mac: "the dead corpse of those enemies need to also still have the blueish glow but dont flow pixels out
 *  anymore"): an elite's corpse keeps the blue outline, pulsing as the living elite's did, with no embers and no gold on the body. A NEGATIVE
 *  `eliteGlow` is the shaders' word for that - the rim at |k|, nothing else - and its quad is widened only enough for
 *  the rim to close (no room above for embers). */
export const ELITE_CORPSE_GLOW = 0.85;
export const ELITE_CORPSE_PAD = Object.freeze([0.08, 0.03, 0.08, 0.03]);
export const isEliteCorpse = (entity) => !!entity?.eliteFoe;
export function markEliteCorpseBatch(batch, phase = Math.random()) {
  if (!batch) return;
  // negative: a corpse - its magnitude is the pulse's phase (0.05..1), so bodies side by side do not breathe in step;
  // the shader runs the pulse off its own clock (systems/hitFlash.js eliteRimK)
  batch.eliteGlow = -(0.05 + 0.95 * Math.min(1, Math.max(0, phase)));
  batch.elitePad = ELITE_CORPSE_PAD;
}
/** An elite's body lies a quarter larger too, like the elite that fell. */
export const eliteCorpseSize = (size, entity) => (isEliteCorpse(entity) && size ? { ...size, w: size.w * ELITE_FOE_SIZE, h: size.h * ELITE_FOE_SIZE } : size);

/** The size a sprite is drawn at. */
export const eliteSize = (entity) => (entity?.eliteFoe ? ELITE_FOE_SIZE : 1);
