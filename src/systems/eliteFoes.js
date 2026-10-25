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
// RENOWN-GATE (2026-10-12, bible/06-Systems/Revenants.md section 39): ONLINE, AN ELITE OF MY OWN WAITS FOR RENOWN 5 -
// the open world's roll and a search's (ELITE_FOE_MIN_RENOWN); a shared dungeon's pick stays every client's, and
// offline every roll stands as BAL4 has it.
//
// PURE but for the item minters - the hosts call in.
import { createRandomWeapon, createRandomArmor } from './loot/loot.js';
import { mintCondition, setItemFields } from './item/itemTemplates.js';
import { applyRarity, rarityEligible, rarityChances, championSource, corpseSource, lootRarityOn } from './loot/lootRarity.js';   // ELITE-RARE: the champion's blue the elite's Rare is read off; BAL4: the ladder's switch, offline
import { goldStack } from './inventory.js';
import { isAmmunition } from './item/itemTemplates.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobile/mobileTypes.js';   // ELITE-FLOOR: the watch is never an elite
import { ENEMY_BASICS, isClassEnemyId } from '../characters/enemy/enemyBasics.js';   // ELITE-FLOOR: a kind's own level, the same on every client
import { WEAPON_MATERIALS } from '../characters/weapons.js';   // BOSS-HARD: Silver, the Troll's floor
import { renownOpens } from './sigil/sigil.js';   // RENOWN-GATE: the page's Renown, the door every Renown-woken power reads
import { markUnquiet } from './revenant/unquietMark.js';   // UNQUIET (Revenants.md section 46): one elite in four carries the mark - its own, never a puppet's

/** Health and damage, times the foe's own (rolled, before any Elite Dungeon doubling - an elite is 5x, not 10x). */
export const ELITE_FOE_HEALTH_MULT = 5;
export const ELITE_FOE_DAMAGE_MULT = 3;
/** ...and in an Elite Dungeon, where every foe is already doubled: a partial stack, not 10x / 6x. */
export const ELITE_FOE_ELITE_DUNGEON_HEALTH_MULT = 7;
export const ELITE_FOE_ELITE_DUNGEON_DAMAGE_MULT = 4;
/** SD4a (bible/11-Multiplayer/Super-Dungeons.md section 5): ...and in a Super dungeon, where every foe is x4 / x2.5
 *  already - the Elite Dungeon's stack read the same way: the health the dungeon's and the elite's added (2 + 5 = 7
 *  there, 4 + 5 = 9 here), the damage the dungeon's and the elite's extra over a plain blow (2 + 2 = 4 there, 2.5 + 2 =
 *  4.5 here). */
export const ELITE_FOE_SUPER_DUNGEON_HEALTH_MULT = 9;
export const ELITE_FOE_SUPER_DUNGEON_DAMAGE_MULT = 4.5;
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
 *  pieces on it (systems/loot/lootRarity.js championSource: its Magic at half a plain foe's), at Luck 50. It was a flat 25%. */
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
/** RENOWN-GATE (2026-10-12, the owner: "gate elite/revenant spawns behind renown level"; asked, "Elites 5, revenants 10",
 *  offline "Unchanged offline", a shared dungeon "Room's pick stands"): ONLINE, AN ELITE OF MY OWN WAITS FOR THIS RENOWN -
 *  the open world's roll (rollOverworldElite) and a search's (searchables.js rollSearchElite), each a foe its roller
 *  stands as its own, so the roller's Renown is the word (a street puppet reads it off `z`). Not a shared dungeon's pick
 *  (pickDungeonElites): every client builds that alike and the room's memory carries no word of an elite (wire.js
 *  validSharedFoe), so one client's Renown would split the room - it stays the room's, as ELITE-FLOOR's class level
 *  does online. A returning revenant stands as what it was (its record's `elite`), never a fresh roll. */
export const ELITE_FOE_MIN_RENOWN = 5;
/** RENOWN-GATE: does the page's Renown open an elite of its own? Offline always (sigil.js renownOpens).
 *  @param {{ online?: boolean, renown?: number|null }} [o] */
export const eliteRenownOpen = (o) => renownOpens(ELITE_FOE_MIN_RENOWN, o);

/** ELITE-FLOOR: may this freshly built foe stand as an elite? Never under ELITE_FOE_MIN_LEVEL, never the city watch,
 *  never an ally - LOOT7's own exclusions (systems/champions.js applyChampion). */
export const eliteEligible = (entity, { checkLevel = true } = {}) => !!entity
  && (!checkLevel || (entity.level | 0) >= ELITE_FOE_MIN_LEVEL)
  && entity.mobileType !== KNIGHT_CITY_WATCH
  && entity.team !== 'PlayerAlly' && entity.mobileTeam !== 'PlayerAlly';

/** Where elites stand: online - an online page, or a host in a room - always; and BAL4 (bible/05-Combat/Balance-Arc.md
 *  section 6; Mac, 2026-10-10: "Do everything", of "smarter AI and elites offline") offline too, wherever the loot ladder
 *  is on - an elite's drop is the ladder's (eliteLoot's tiers), so with the ladder off no foe is ever one and the 1:1
 *  lane is DFU exactly, as a champion's is (systems/champions.js). It was online only (Mac's word, as this comment
 *  carried it: "elite enemies are online mode only"), until offline was found to field nothing past DFU's own foes. */
export const elitesAllowed = ({ onlinePage = false, inRoom = false } = {}) => !!(onlinePage || inRoom) || lootRarityOn();

/** Is this entity an elite foe? */
export const isEliteFoe = (entity) => !!entity?.eliteFoe;

/** Make a freshly built foe an elite: health, damage, the flag. `own` false for a puppet - its maximum is its owner's
 *  word (the record's `k`), so only the blows, the size and the glow are stood here (and its owner already asked
 *  eliteEligible). Idempotent. ELITE-FLOOR: answers whether it stands as an elite - false for a foe eliteEligible
 *  refuses, which is then built as it would have been. */
export function promoteEliteFoe(entity, { own = true, eliteDungeon = false, superDungeon = false, checkLevel = true } = {}) {
  if (!entity) return false;
  if (entity.eliteFoe) return true;
  if (own && !eliteEligible(entity, { checkLevel })) return false;
  entity.eliteFoe = true;
  // the hosts promote BEFORE any other scaling (and in place of the Elite Dungeon's doubling), so this is the foe's own
  // roll: an elite is 5x, not 10x
  if (own) {
    const hm = superDungeon ? ELITE_FOE_SUPER_DUNGEON_HEALTH_MULT : eliteDungeon ? ELITE_FOE_ELITE_DUNGEON_HEALTH_MULT : ELITE_FOE_HEALTH_MULT;   // SD4a: a Super dungeon's
    entity.maxHealth = Math.max(1, Math.round((entity.maxHealth || 1) * hm));
    entity.health = entity.maxHealth;
    entity.healthMult = (entity.healthMult ?? 1) * hm;   // TELL1: what was stood on the kind's own health (ai/tells.js kindHealth - its poise)
  }
  const prior = Number.isFinite(entity.damageScale) && entity.damageScale > 0 ? entity.damageScale : 1;
  entity.damageScale = prior * (superDungeon ? ELITE_FOE_SUPER_DUNGEON_DAMAGE_MULT : eliteDungeon ? ELITE_FOE_ELITE_DUNGEON_DAMAGE_MULT : ELITE_FOE_DAMAGE_MULT);   // SD4a: a Super dungeon's
  if (own) markUnquiet(entity);   // UNQUIET: the mark that lets it rise, drawn on its own
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
 * `eliteFoe: true` in place and answers how many. SD4a: `count` a number of the caller's own - a Super dungeon's
 * SUPER_ELITE_FOES (world/superDungeon/sdDungeon.js).
 */
export function pickDungeonElites(enemies, key, { elite = true, count = null, classLevel = Infinity } = {}) {
  if (!Array.isArray(enemies) || !enemies.length) return 0;
  const rng = eliteRng(eliteHash(elite ? 'elite-dungeon' : 'normal-dungeon', key));
  // an Elite Dungeon: 3 or 4; a normal one: at most 1, one time in five; SD4a: a Super dungeon its own `count` (six)
  const want = Number.isInteger(count) ? Math.max(0, count) : elite
    ? ELITE_FOE_DUNGEON_MIN + Math.floor(rng() * (ELITE_FOE_DUNGEON_MAX - ELITE_FOE_DUNGEON_MIN + 1))
    : (rng() < ELITE_FOE_NORMAL_DUNGEON_CHANCE ? 1 : 0);
  const pool = [];
  // ELITE-FLOOR, the same on every client: a kind under the floor by its OWN level never stands as one (a class foe's
  // level is the party's, built per client, so the floor is the pick's here and promoteEliteFoe is told not to re-ask).
  // AUDIT BAL (bible/05-Combat/Balance-Arc.md section 10): `classLevel` the level this dungeon's class foes are built
  // at - offline one client builds them, so the host hands it and a new character's level-1 Knight is no elite; online
  // it stays Infinity (each client builds its own, and the pick must be every client's)
  const kindLevel = (t) => (isClassEnemyId(t) ? classLevel : (ENEMY_BASICS[t]?.level ?? 0));
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

/** THE OPEN WORLD'S ROLL: is this new foe an elite? RENOWN-GATE: the roll drawn first, then the Renown's word - the
 *  same draw either way. */
export const rollOverworldElite = (rolls = Math.random) => rolls() < ELITE_FOE_OVERWORLD_CHANCE && eliteRenownOpen();

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

/** THE GLOW: a slow pulse, 0.55..1, phased per foe so a pack does not breathe in step. 0 for anything not elite.
 *  STAFF-EVENT: a mini boss's is the same pulse past STAFF_BOSS_GLOW, which the shaders read as its yellow. */
export function eliteGlow(entity, nowSeconds, phase = 0) {
  if (!entity?.eliteFoe) return 0;
  const k = 0.775 + 0.225 * Math.sin(nowSeconds * 3.2 + phase);
  return entity.staffBoss ? STAFF_BOSS_GLOW + k : k;
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
export function markEliteCorpseBatch(batch, phase = Math.random(), boss = false) {
  if (!batch) return;
  // negative: a corpse - its magnitude is the pulse's phase (0.05..1), so bodies side by side do not breathe in step;
  // the shader runs the pulse off its own clock (systems/hitFlash.js eliteRimK). STAFF-EVENT: a mini boss's past
  // STAFF_BOSS_GLOW - its outline stays yellow
  batch.eliteGlow = -((boss ? STAFF_BOSS_GLOW : 0) + 0.05 + 0.95 * Math.min(1, Math.max(0, phase)));
  batch.elitePad = ELITE_CORPSE_PAD;
}
/** An elite's body lies a quarter larger too, like the elite that fell (STAFF-EVENT: a mini boss's as large as it stood). */
export const eliteCorpseSize = (size, entity) => (isEliteCorpse(entity) && size ? { ...size, w: size.w * eliteSize(entity), h: size.h * eliteSize(entity) } : size);

/** The size a sprite is drawn at (STAFF-EVENT: a mini boss's its event's). */
export const eliteSize = (entity) => (entity?.staffBoss ? entity.staffBoss.size : entity?.eliteFoe ? ELITE_FOE_SIZE : 1);

// ═══ STAFF-EVENT: A STAFF EVENT'S MINI BOSS ═══════════════════════════════════════════════════════
// (2026-10-24, mob: "mini boss need to be a single enlarges version of the mob spawns / instead of the blue elite glow
// lets make the mini boss have a yellow glow", "also let staff pick the miniboss"; net/staffEvent/staffEventLaw.js.) The
// one foe a staff event's full meter calls: an ELITE underneath - every surface that draws, names, sizes and loots an
// elite draws this one - at its event's size (net/staffEvent/staffEventLaw.js STAFF_BOSS_SIZE_*), ten times its kind's
// health and an elite's blows, its glow yellow (STAFF_BOSS_GLOW: the pulse past it - systems/hitFlash.js reads it).
/** The glow's offset that says a mini boss to the shaders (systems/hitFlash.js STAFF_BOSS_RIM): a living one's pulse is
 *  2.55..3, its corpse's -2.05..-3. */
export const STAFF_BOSS_GLOW = 2;
export const STAFF_BOSS_HEALTH_MULT = 10;
export const STAFF_BOSS_DAMAGE_MULT = ELITE_FOE_DAMAGE_MULT;
// BOSS-HARD (2026-10-25, mob: "apply this logic to all mini bosses we spawn we want them to be very hard for the players"):
// every mini boss is held to the Enemy Expansion Troll's rules (MonsterBase.mdb.csv row 272) - MinMetalToHit Silver, so a
// blade below Silver does nothing (combat/formulas.js dropWeaponIfTargetImmune; hand-to-hand still lands, as DFU's does),
// and ArmorValue 2, so its every part is at least as hard to hit as a Troll's (EnemyEntity.cs:264-267: ArmorValue x 5).
/** The weapon material a mini boss asks before a blade bites (WeaponMaterialTypes: Silver). */
export const STAFF_BOSS_MIN_METAL = WEAPON_MATERIALS.Silver;
/** A mini boss's worst armour on any part (the Troll's ArmorValue 2 x 5; lower is harder to hit). */
export const STAFF_BOSS_ARMOR = 10;
/** Is this entity a staff event's mini boss? */
export const isStaffBoss = (entity) => !!entity?.staffBoss;
/**
 * Make a freshly built foe a staff event's mini boss: an elite (the flag, the blows, the drop), `healthX` times its health
 * (staff's pick on the start form, 1-100; STAFF_BOSS_HEALTH_MULT unset) or BOSS-HP's `hp`, the exact health staff typed (it
 * wins; 0 none), at `sizePct` of its kind's size, held to the Troll's Silver and armour (BOSS-HARD). `own` false for a puppet - its maximum is its owner's word (the record's `k`). Idempotent.
 * @param {any} entity @param {{ own?: boolean, sizePct?: number, healthX?: number, hp?: number, level?: number }} [o]
 */
export function promoteStaffBoss(entity, { own = true, sizePct = 200, healthX = STAFF_BOSS_HEALTH_MULT, hp = 0, level } = {}) {
  if (!entity || entity.staffBoss) return !!entity;
  entity.staffBoss = { size: Math.max(1.5, Math.min(3, sizePct / 100)) };
  entity.eliteFoe = true;
  if (own) {
    const base = entity.maxHealth || 1;
    const hx = Number.isSafeInteger(hp) && hp >= 1 ? Math.min(1000000, hp) / base   // BOSS-HP: the exact health staff typed
      : Number.isFinite(healthX) && healthX >= 1 ? Math.min(100, healthX) : STAFF_BOSS_HEALTH_MULT;   // staff's pick on the start form
    entity.maxHealth = Math.max(1, Math.round((entity.maxHealth || 1) * hx));
    entity.health = entity.maxHealth;
    entity.healthMult = (entity.healthMult ?? 1) * hx;
  }
  const prior = Number.isFinite(entity.damageScale) && entity.damageScale > 0 ? entity.damageScale : 1;
  entity.damageScale = prior * STAFF_BOSS_DAMAGE_MULT;
  // BOSS-HARD: owner and puppet alike - a peer's blow on a puppet is rolled against the puppet's entity
  entity.minMetalToHit = Math.max(entity.minMetalToHit ?? -1, STAFF_BOSS_MIN_METAL);
  entity.armorValues = Array.from({ length: 7 }, (_, i) => Math.min(entity.armorValues?.[i] ?? 100, STAFF_BOSS_ARMOR));
  entity.armor = Math.min(entity.armor ?? 100, STAFF_BOSS_ARMOR);
  if (own) grantEliteLoot(entity, level ?? entity.level);
  return true;
}
