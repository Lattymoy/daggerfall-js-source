// @ts-check
// BOUNTY1 (2026-09-28, Mac: "Cities in this game have always 2 Bulletin Boards can we make it so that one of the two
// when opened gives a quest screen in Enhanced Plus UI look"): THE TOWN'S BOUNTY BOARD - the law, pure.
//
// Not a DFU member and not a mod's port: the port's own. Half of a town's bulletin boards (every other one by
// position, every client picks the same ones - see `questBoardIndices`) post the town's FOUR hunts a day - the same
// four on each of them. Each names a map pixel four to ten pixels from the town (Chebyshev) and a pack of four to
// eight beasts sized to the reader's level - or a dungeon in that ring and two to four of them in it. The pack stands
// when the hunter walks onto that pixel; killing the last of it pays at once - a notice that holds the game until it
// is read, gold, and one plain (white) or, from level 4, sometimes magic (blue) piece of kit.
//
// EVERY CLIENT READS THE SAME BOARD. A posting is a pure function of (the day, the town's pixel, the slot): where it
// is, which of its tier's beasts it names, how many and which story it tells. The one thing the READER brings is the
// tier - a level 2 hunter reads "Rats" where a level 12 reads "Giants" on the same slot, at the same spot. A bounty
// taken carries the taker's level in its id (`bountyId`), so a party mate it is shared with hunts the same pack for
// the same purse (scenes/bountyHost.js).
//
// This file owns the numbers, the words and the ledger's rules. The world (spawning, the map, the purse, the pose)
// is scenes/bountyHost.js; the window is ui/bounty/bountyWindow.js.

import { MINUTES_PER_DAY } from '../gameDate.js';
import { BOUNTY_POSE_MAX, worldPixelOk } from '../../net/wire.js'; // LAIR-WORLD: a town's pixel is the world's, the Bay's and past it
import { t } from '../textManager.js'; // QUARRY-WORLD: the beasts' words in the player's language
export { MINUTES_PER_DAY, BOUNTY_POSE_MAX };

/** The per-mod save slot's vendor name (systems/modSaveData.js). */
export const BOUNTY_VENDOR = 'bountyBoard';
/** Postings on one board, each game day. */
export const BOUNTIES_PER_DAY = 4;
/** The most bounties one hunter holds at once. */
export const BOUNTY_ACTIVE_MAX = 4;
/** How far from its town a bounty's pixel lies, map pixels (Chebyshev) - Mac, 2026-09-28: "make it 4-10 pixel
 *  around the city" (it was 1-4). The dungeons a board may name are sought in the same ring. */
export const BOUNTY_MIN_PX = 4;
export const BOUNTY_MAX_PX = 10;
/** A pack's size, inclusive. */
export const BOUNTY_PACK_MIN = 4;
export const BOUNTY_PACK_MAX = 8;
/** A dungeon's pack is smaller - its halls are close (Mac, 2026-09-28: "the pack must be smaller in dungeons 2-4"). */
export const BOUNTY_DUNGEON_PACK_MIN = 2;
export const BOUNTY_DUNGEON_PACK_MAX = 4;
/** How long a taken bounty stands before it lapses (a game day - gameDate's own MINUTES_PER_DAY, one home). */
export const BOUNTY_LIFETIME_MINUTES = MINUTES_PER_DAY;
/** The level an id may carry. */
export const BOUNTY_LEVEL_MAX = 99;

/** The ladder: which beasts a level hunts. Ids are ENEMY_BASICS rows; each list runs weakest to strongest (the
 *  15+ purse reads the rank). The werebeasts are left off - a bounty is not a way to catch a curse. (Beasts that
 *  want a silver-or-better blade stay on: the server runs without that rule - Mac, 2026-09-28.) QUARRY-WORLD
 *  (2026-10-27): a tier's `levels` are its own beasts' (their levels as Daggerfall has them, the strongest tier's open
 *  above) - the band a board hunts the land's own wild in (bountyQuarry); the ladder's beasts are what a board posts
 *  where the land's wild is not known. */
export const BOUNTY_TIERS = Object.freeze([
  Object.freeze({ min: 1, max: 3, foes: Object.freeze([0, 3, 6]), levels: Object.freeze([1, 4]) }), // Rat, Giant Bat, Spider
  Object.freeze({ min: 4, max: 5, foes: Object.freeze([4, 5, 7]), levels: Object.freeze([4, 5]) }), // Grizzly Bear, Sabretooth Tiger, Orc
  Object.freeze({ min: 6, max: 10, foes: Object.freeze([8, 12, 13, 15, 17]), levels: Object.freeze([5, 10]) }), // Centaur, Orc Sergeant, Harpy, Skeletal Warrior, Zombie
  Object.freeze({ min: 11, max: 14, foes: Object.freeze([16, 19, 20, 21]), levels: Object.freeze([10, 13]) }), // Giant, Mummy, Giant Scorpion, Orc Shaman
  Object.freeze({
    min: 15,
    max: Infinity,
    foes: Object.freeze([22, 23, 24, 27]),
    levels: Object.freeze([14, Infinity]),
  }), // Gargoyle, Wraith, Orc Warlord, Daedroth
]);

/** A board's words for a pack of each beast, in the player's language, and the kind of trouble it is - which of the
 *  stories below it is told in. QUARRY-WORLD (2026-10-27): every beast the land's own wild holds (the encounter law's
 *  day and night tables - DFU's climates on the Bay, TESA-BIOME's zones past it - with Daggerfall Enemy Expansion's or
 *  without: bountyQuarry), where it was the ladder's nineteen alone; routed through the text core (L10N4), its words
 *  before English-only. No werebeast and no vampire has words: a bounty is not a way to catch a curse. */
const FOES = Object.freeze({
  0: ['vermin', () => t('bounty.foes.rats', 'Rats')],
  1: ['dread', () => t('bounty.foes.imps', 'Imps')],
  2: ['beast', () => t('bounty.foes.spriggans', 'Spriggans')],
  3: ['vermin', () => t('bounty.foes.giantBats', 'Giant Bats')],
  4: ['beast', () => t('bounty.foes.grizzlyBears', 'Grizzly Bears')],
  5: ['beast', () => t('bounty.foes.sabretoothTigers', 'Sabretooth Tigers')],
  6: ['vermin', () => t('bounty.foes.spiders', 'Spiders')],
  7: ['orc', () => t('bounty.foes.orcs', 'Orcs')],
  8: ['beast', () => t('bounty.foes.centaurs', 'Centaurs')],
  10: ['beast', () => t('bounty.foes.nymphs', 'Nymphs')],
  12: ['orc', () => t('bounty.foes.orcSergeants', 'Orc Sergeants')],
  13: ['beast', () => t('bounty.foes.harpies', 'Harpies')],
  15: ['undead', () => t('bounty.foes.skeletalWarriors', 'Skeletal Warriors')],
  16: ['giant', () => t('bounty.foes.giants', 'Giants')],
  17: ['undead', () => t('bounty.foes.zombies', 'Zombies')],
  18: ['undead', () => t('bounty.foes.ghosts', 'Ghosts')],
  19: ['undead', () => t('bounty.foes.mummies', 'Mummies')],
  20: ['vermin', () => t('bounty.foes.giantScorpions', 'Giant Scorpions')],
  21: ['orc', () => t('bounty.foes.orcShamans', 'Orc Shamans')],
  22: ['dread', () => t('bounty.foes.gargoyles', 'Gargoyles')],
  23: ['undead', () => t('bounty.foes.wraiths', 'Wraiths')],
  24: ['orc', () => t('bounty.foes.orcWarlords', 'Orc Warlords')],
  25: ['dread', () => t('bounty.foes.frostDaedra', 'Frost Daedra')],
  26: ['dread', () => t('bounty.foes.fireDaedra', 'Fire Daedra')],
  27: ['dread', () => t('bounty.foes.daedroths', 'Daedroths')],
  29: ['dread', () => t('bounty.foes.daedraSeducers', 'Daedra Seducers')],
  32: ['undead', () => t('bounty.foes.liches', 'Liches')],
  33: ['undead', () => t('bounty.foes.ancientLiches', 'Ancient Liches')],
  34: ['beast', () => t('bounty.foes.dragonlings', 'Dragonlings')],
  35: ['dread', () => t('bounty.foes.fireAtronachs', 'Fire Atronachs')],
  36: ['dread', () => t('bounty.foes.ironAtronachs', 'Iron Atronachs')],
  37: ['dread', () => t('bounty.foes.fleshAtronachs', 'Flesh Atronachs')],
  38: ['dread', () => t('bounty.foes.iceAtronachs', 'Ice Atronachs')],
  40: ['beast', () => t('bounty.foes.dragonlings', 'Dragonlings')], // the dragonling's second look, the same beast
  // Daggerfall Enemy Expansion's (systems/enemyExpansion/dexNames.js names each one)
  256: ['orc', () => t('bounty.foes.goblins', 'Goblins')],
  258: ['orc', () => t('bounty.foes.lizardMen', 'Lizard Men')],
  259: ['orc', () => t('bounty.foes.lizardWarriors', 'Lizard Warriors')],
  260: ['vermin', () => t('bounty.foes.bats', 'Bats')],
  261: ['dread', () => t('bounty.foes.medusas', 'Medusas')],
  262: ['beast', () => t('bounty.foes.wolves', 'Wolves')],
  263: ['beast', () => t('bounty.foes.snowWolves', 'Snow Wolves')],
  266: ['undead', () => t('bounty.foes.skeletalSoldiers', 'Skeletal Soldiers')],
  267: ['beast', () => t('bounty.foes.dogs', 'Dogs')],
  269: ['giant', () => t('bounty.foes.minotaurs', 'Minotaurs')],
  271: ['vermin', () => t('bounty.foes.bloodSpiders', 'Blood Spiders')],
  272: ['giant', () => t('bounty.foes.trolls', 'Trolls')],
  273: ['undead', () => t('bounty.foes.gloomWraiths', 'Gloom Wraiths')],
  274: ['undead', () => t('bounty.foes.fadedGhosts', 'Faded Ghosts')],
  277: ['undead', () => t('bounty.foes.ghouls', 'Ghouls')],
  278: ['beast', () => t('bounty.foes.boars', 'Boars')],
  279: ['beast', () => t('bounty.foes.landDreughs', 'Land Dreughs')],
  280: ['beast', () => t('bounty.foes.mountainLions', 'Mountain Lions')],
  281: ['vermin', () => t('bounty.foes.mudcrabs', 'Mudcrabs')],
  282: ['giant', () => t('bounty.foes.ogres', 'Ogres')],
  283: ['dread', () => t('bounty.foes.willOWisps', "Will-o'-wisps")],
  288: ['vermin', () => t('bounty.foes.scamps', 'Scamps')],
  289: ['dread', () => t('bounty.foes.centurionSpheres', 'Centurion Spheres')],
});
/** QUARRY-WORLD: does the board have words for a beast - one it may post? @param {number} id */
export const bountyNames = (id) => Object.hasOwn(FOES, id);
/** A board's word for a pack of a beast, in the player's language; 'beasts' for one it has none for. @param {number} id */
export const bountyFoesWord = (id) => (Object.hasOwn(FOES, id) ? FOES[id][1]() : 'beasts');
/** The kind of trouble a beast is (the stories' key). @param {number} id */
const kindOf = (id) => (Object.hasOwn(FOES, id) ? FOES[id][0] : 'beast');

/**
 * QUARRY-WORLD (2026-10-27, the audit NO SYSTEM LEFT BEHIND IN THE BAY item 37; the owner: "Every single thing here needs to
 * be addressed. No exceptions."): THE BEASTS A TIER HUNTS ABOUT A TOWN - of the land's own wild (`wild`, `[id, level]` pairs:
 * the encounter law's day and night tables at the town, each beast at its level as the game loaded it -
 * systems/bounty/bountyQuarry.js landWildAt), those the board has words for whose level lies in the tier's band (`levels`,
 * its own beasts' - BOUNTY_TIERS); where none does, the land's beasts nearest the band; weakest first (the 15+ purse reads
 * the rank), a tie by id. One global ladder had posted Orc Warlords and Centaurs on a Black Marsh board and Grizzly Bears
 * in the Alik'r. With no wild known, or none the board can name, the ladder's own beasts. Pure: the same `wild`, the same
 * list, on every machine.
 * @param {number} level @param {?Array<[number, number]>} [wild]
 */
export function bountyQuarry(level, wild = null) {
  const tier = bountyTierFor(level);
  const land = (wild ?? []).filter(([id, lv]) => bountyNames(id) && Number.isFinite(lv));
  if (!land.length) return tier.foes;
  const [lo, hi] = tier.levels;
  const off = (lv) => (lv < lo ? lo - lv : lv > hi ? lv - hi : 0);
  let best = Infinity;
  for (const [, lv] of land) best = Math.min(best, off(lv));
  return Object.freeze(
    land
      .filter(([, lv]) => off(lv) === best)
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
      .map(([id]) => id),
  );
}

const clampLevel = (level) => Math.max(1, Math.min(BOUNTY_LEVEL_MAX, Math.trunc(Number(level) || 1)));

/** The tier a level hunts in. */
export function bountyTierFor(level) {
  const l = clampLevel(level);
  return BOUNTY_TIERS.find((t) => l >= t.min && l <= t.max) ?? BOUNTY_TIERS[BOUNTY_TIERS.length - 1];
}

/** BOUNTY-PURSE (Mac, 2026-09-28: "when the needed kills are only 4 it should give less money"): what a FULL open-ground
 *  pack of eight pays in each monster tier - Mac's own numbers (50, 75, 90, 100). Each beast short of eight takes a
 *  tenth of it off, so four pay six tenths. The 15+ tier runs 150..200 on its own law below. */
export const BOUNTY_FULL_PURSE = Object.freeze([50, 75, 90, 100]);
/** The share of the full purse a pack of `n` pays: 4 -> 0.6, 5 -> 0.7 ... 8 -> 1. */
export const purseShare = (n) =>
  0.6 + 0.1 * (Math.max(BOUNTY_PACK_MIN, Math.min(BOUNTY_PACK_MAX, n | 0)) - BOUNTY_PACK_MIN);

/**
 * The purse, by the MONSTER TIER the bounty's level hunts in (bountyTierFor) and the size of its pack.
 *   tiers 1-4 (levels 1-14): the tier's full purse x purseShare(pack) - e.g. tier 1 pays 30 35 40 45 50 for 4..8;
 *   tier 5 (15+): 150 + 10 a beast past four (150..190) + up to 10 for the beast's rank in its tier's list (..200).
 * A dungeon's pack (2-4) is small because its halls are close, not because it is less work: 2 pays as 4 would,
 * 3 as 6, 4 as 8.
 * @param {number} level the bounty's level (the taker's, when it was taken)
 * @param {number} count the pack's size
 * @param {number} mobileType the beast
 * @param {boolean} [underground] a dungeon's pack
 * @param {?readonly number[]} [foesList] QUARRY-WORLD: the tier's beasts the posting drew from (bountyQuarry); the ladder's by default
 */
export function bountyGold(level, count, mobileType, underground = false, foesList = null) {
  const l = clampLevel(level);
  const n = underground
    ? BOUNTY_PACK_MIN +
      2 * (Math.max(BOUNTY_DUNGEON_PACK_MIN, Math.min(BOUNTY_DUNGEON_PACK_MAX, count | 0)) - BOUNTY_DUNGEON_PACK_MIN)
    : Math.max(BOUNTY_PACK_MIN, Math.min(BOUNTY_PACK_MAX, count | 0));
  const tier = BOUNTY_TIERS.indexOf(bountyTierFor(l));
  if (tier < BOUNTY_FULL_PURSE.length) return Math.round(BOUNTY_FULL_PURSE[tier] * purseShare(n));
  const foes = foesList ?? bountyTierFor(l).foes; // QUARRY-WORLD: the rank among the beasts the posting drew from (bountyQuarry)
  const rank = Math.max(0, foes.indexOf(mobileType));
  const strength = foes.length > 1 ? rank / (foes.length - 1) : 1;
  return 150 + 10 * (n - BOUNTY_PACK_MIN) + Math.round(10 * strength);
}

/**
 * The piece of kit (Mac: "an random item in white for players with medium durabilty lvl 1-3, 4-5 white better
 * durabily and 6-10 full durability then with 11-14 it should start given randomly white and blue items. Not more.
 * And thats it till max level."). `condition` is the share of the piece's maxCondition it arrives with; `magicChance`
 * the chance it is minted Magic (blue) - never more than Magic, at any level.
 * @param {number} level
 * @returns {{ condition: number, magicChance: number }}
 */
export function bountyItemRule(level) {
  const l = clampLevel(level);
  if (l <= 3) return { condition: 0.5, magicChance: 0 };
  // BOUNTY-BLUE (Mac, 2026-09-28: "let start the blue items 50/50 chance at lvl 4"): the coin for Magic from level 4
  if (l <= 5) return { condition: 0.75, magicChance: 0.5 };
  return { condition: 1, magicChance: 0.5 };
}

// ── the hash every client agrees on ───────────────────────────────────
/** A 32-bit mix of small integers (FNV-1a over their bytes, then a murmur finaliser). Pure; the same everywhere. */
export function bountyHash(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    let v = Math.trunc(Number(p) || 0) >>> 0;
    for (let k = 0; k < 4; k++) {
      h ^= v & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
      v >>>= 8;
    }
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
/** Salts, so the four questions a slot asks are four independent rolls. */
const SALT = Object.freeze({ site: 0x51, beast: 0xbe, count: 0xc0, story: 0x57, poster: 0x9a });

/** The day a classic-minutes clock reads. */
export const bountyDay = (classicMinutes) => Math.floor(Math.max(0, Number(classicMinutes) || 0) / MINUTES_PER_DAY);

// ── ids ───────────────────────────────────────────────────────────────
/** A slot of a town's board on a day - what "the same posting" means whoever reads it. */
export const bountySlotKey = (day, px, py, slot) => `${day}.${px}.${py}.${slot}`;
/** A bounty as TAKEN: its slot and the level it was taken at. The wire's shape (net/wire.js validPartyPose `bq`). */
export const bountyId = (day, px, py, slot, level) => `${bountySlotKey(day, px, py, slot)}.${clampLevel(level)}`;
/** LAIR-WORLD (2026-10-26): a town's pixel the world's (net/wire.js worldPixelOk - past the Bay up to four digits, and
 *  west or north of the Bay's corner below zero), where it was the Bay's three. A Bay id reads as it always did. */
export const BOUNTY_ID_RE = /^(\d{1,7})\.(-?\d{1,4})\.(-?\d{1,4})\.([0-3])\.(\d{1,2})$/;
/** BOUNTY-TIER (Mac, 2026-09-28: "Higher level players cant share their quest with lower level players ONLY when in
 *  the same tier. They should be still able to help"): the monster tier a level hunts in, as its index (0..4). */
export const bountyTierIndex = (level) => BOUNTY_TIERS.indexOf(bountyTierFor(level));
/** THE HUNT a bounty is: its slot AND its tier. Two holders of one notice in one tier hunt one pack and are paid
 *  together (whatever their levels inside it); in two tiers they are two hunts - different beasts, different purses. */
export function bountyHuntKey(id) {
  const b = parseBountyId(id);
  return b ? `${b.slotKey}.t${bountyTierIndex(b.level)}` : null;
}
/** May a hunter of `level` hold this bounty (taken, shared, joined)? Only in its own tier. */
export const bountyTierFits = (id, level) => {
  const b = parseBountyId(id);
  return !!b && bountyTierIndex(b.level) === bountyTierIndex(level);
};

/** BOUNTY-TIERLABEL (Mac, 2026-09-28: "can the quests also show which tier they are and what levels are put in the
 *  tier"): "Tier 2 (levels 4-5)", "Tier 5 (levels 15+)" - numbered from 1, as a player counts. */
export function bountyTierLabel(level) {
  const t = bountyTierFor(level);
  const n = BOUNTY_TIERS.indexOf(t) + 1;
  return `Tier ${n} (levels ${Number.isFinite(t.max) ? `${t.min}\u2013${t.max}` : `${t.min}+`})`;
}

/** An id read back, or null. */
export function parseBountyId(id) {
  const m = BOUNTY_ID_RE.exec(String(id ?? ''));
  if (!m) return null;
  const [day, px, py, slot, level] = m.slice(1).map(Number);
  if (!worldPixelOk(px) || !worldPixelOk(py) || level < 1) return null; // LAIR-WORLD: the world's pixel
  return { day, px, py, slot, level, slotKey: bountySlotKey(day, px, py, slot) };
}

// ── where ─────────────────────────────────────────────────────────────
/**
 * The ground a town's board may send a hunter to: every pixel four to ten pixels out (Chebyshev) that `siteOk`
 * passes, in row-major order (so the pick below is the data's, not the caller's).
 * @param {number} px @param {number} py the town's pixel
 * @param {(x:number, y:number) => boolean} siteOk
 */
export function bountySites(px, py, siteOk) {
  const out = [];
  for (let dy = -BOUNTY_MAX_PX; dy <= BOUNTY_MAX_PX; dy++) {
    for (let dx = -BOUNTY_MAX_PX; dx <= BOUNTY_MAX_PX; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d < BOUNTY_MIN_PX) continue;
      const x = px + dx,
        y = py + dy;
      if (!worldPixelOk(x) || !worldPixelOk(y)) continue; // LAIR-WORLD: the world's pixels, past the Bay too
      let ok = false;
      try {
        ok = !!siteOk(x, y);
      } catch {
        ok = false;
      }
      if (ok) out.push([x, y]);
    }
  }
  return out;
}

/** The most of a day's four postings that send the hunter into a dungeon (Mac, 2026-09-28: "Dungeon bounties
 *  (notices name a nearby dungeon)"). Slot 3 goes underground when one dungeon lies in reach, slot 2 as well when two
 *  do; slots 0 and 1 always hunt the open ground. */
export const BOUNTY_DUNGEON_SLOTS_MAX = 2;
/**
 * The dungeons a town's board may send a hunter into: every one 4 to 10 pixels out (Chebyshev), row-major, from
 * `dungeonAt(x, y)` - the dungeon's name on that pixel, or null. The host answers it from the game's OWN locations
 * alone (no spawned dungeon, no mod's addition), so every client lists the same ones.
 * @param {number} px @param {number} py @param {(x:number, y:number) => (string|null)} dungeonAt
 * @param {(x:number, y:number) => unknown} [graveyardAt] - GRAVEYARD: whether the pixel's dungeon is a graveyard (truthy)
 * @returns {Array<{px:number, py:number, name:string, graveyard:boolean}>}
 */
export function bountyDungeons(px, py, dungeonAt, graveyardAt) {
  const out = [];
  if (typeof dungeonAt !== 'function') return out;
  for (let dy = -BOUNTY_MAX_PX; dy <= BOUNTY_MAX_PX; dy++) {
    for (let dx = -BOUNTY_MAX_PX; dx <= BOUNTY_MAX_PX; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < BOUNTY_MIN_PX) continue;
      const x = px + dx,
        y = py + dy;
      if (!worldPixelOk(x) || !worldPixelOk(y)) continue; // LAIR-WORLD: the world's pixels, past the Bay too
      let name = null;
      try {
        name = dungeonAt(x, y);
      } catch {
        name = null;
      }
      // GRAVEYARD: a graveyard's hunt is fought in the open air outside it, never down in its crypt
      let grave = false;
      if (name && typeof graveyardAt === 'function') {
        try {
          grave = !!graveyardAt(x, y);
        } catch {
          grave = false;
        }
      }
      if (name) out.push({ px: x, py: y, name: String(name), graveyard: grave });
    }
  }
  return out;
}
/** Which slots of a board go underground, given how many dungeons lie in reach. */
export const dungeonSlotsFor = (n) => (n >= 2 ? [2, 3] : n === 1 ? [3] : []).slice(0, BOUNTY_DUNGEON_SLOTS_MAX);

/** The compass word from one map pixel to another (the map's y runs south). */
export function compassWord(dx, dy) {
  if (!dx && !dy) return 'nearby';
  const a = (Math.atan2(-dy, dx) * 180) / Math.PI; // east 0, north 90
  const words = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  return words[((Math.round(a / 45) % 8) + 8) % 8];
}
/** How far, in the words a town crier would use. */
export function distanceWord(d) {
  if (d <= 3) return 'a short walk';
  if (d <= 5) return "half a day's walk";
  if (d <= 7) return 'a long walk';
  return "a day's ride";
}

// ── the words ─────────────────────────────────────────────────────────
/** Who pinned the notice up. */
export const BOUNTY_POSTERS = Object.freeze([
  'the Captain of the Guard',
  'the town Reeve',
  'a worried farmer',
  'the Fighters Guild',
  'the local magistrate',
  "the shepherds' guild",
  'a traveling merchant',
  "the temple's steward",
]);
/** The notices, by kind of trouble. {foes} the beasts, {count} how many, {town}, {dir}, {far}. */
export const BOUNTY_STORIES = Object.freeze({
  vermin: Object.freeze([
    'The granaries {dir} of {town} are overrun. {count} {foes} have made a nest out there, and the next harvest will not survive them. Clear them out.',
    'Travelers on the road {dir} of {town} come back bitten and feverish. Some {count} {foes} have taken the ditches there. Put an end to it.',
    'Something has been stripping the orchards {dir} of town at night. The hands say {foes} - a great many of them. We want them gone.',
  ]),
  beast: Object.freeze([
    'I have seen {foes} out there, {far} {dir} of {town}. {count} of them at least. Get rid of them before they attack our children.',
    'Two shepherds went up into the hills {dir} of {town} and only one came back. He speaks of {foes}, {count} or more. Hunt them down.',
    "Our cattle are being taken {dir} of the walls, and the tracks are not wolves'. {count} {foes}, the hunters reckon. The town will pay for their pelts.",
  ]),
  orc: Object.freeze([
    'A band of {foes} has made camp {dir} of {town}, {far} out. {count} of them, bold enough to light fires. Break the camp before they come for the gates.',
    'Merchants will not use the road {dir} of {town} since the {foes} took it, {count} blades at the last count. Clear the road.',
  ]),
  undead: Object.freeze([
    'The old barrows {dir} of {town} are restless. {count} {foes} have been seen walking the fields at dusk. Lay them to rest, for good this time.',
    'Our dead will not stay buried. The gravediggers fled when {foes} came up out of the ground {dir} of town, {count} of them. End this.',
  ]),
  giant: Object.freeze([
    'The earth shakes {dir} of {town}. {count} {foes} have come down from the high country and are tearing up the farmsteads. We need a hero, and we will pay like it.',
  ]),
  dread: Object.freeze([
    'Something wicked has come to the land {dir} of {town}. {count} {foes}, the scouts swear it, and none of them came back unmarked. Only the bravest need answer this.',
    'The temple speaks of a stain upon the wilds {dir} of {town}: {foes}, {count} strong. Burn it out before it spreads to our streets.',
  ]),
});
/** The notices that send a hunter underground. {place} the dungeon's name, the rest as above. */
export const BOUNTY_DUNGEON_STORIES = Object.freeze([
  '{count} {foes} have made their lair in {place}, {far} {dir} of {town}. They come up at night and are growing bolder. Go down there and put an end to them.',
  'The last patrol sent into {place} did not come back. The one survivor found crawling out speaks of {foes}, {count} of them, deep inside. Clear the place.',
  'Whatever sleeps in {place} has woken: {count} {foes} now roam its halls, and the farms {dir} of {town} lie in their shadow. Descend and cleanse it.',
  "A reward is offered to any blade willing to enter {place}, {dir} of {town}, and slay the {foes} nesting there, {count} strong by the trappers' count.",
]);
/** A notice that speaks of a farm - its granary, its orchard, its cattle, its sheep - stands a farm on its pixel
 *  (BOUNTY-FARM, scenes/bountyFarms.js). Read off the notice's own words, so a new story that names a farm gets one. */
export const FARM_STORY_RE = /granar|orchard|harvest|cattle|shepherd|farm/i;
/** Every notice ends by sending the reader to the map. */
export const BOUNTY_MAP_LINE = 'Take a look at your map: the place is marked with a black circle.';
/** A graveyard's notices: they never say whether the hunt is inside or outside the place. {place} the graveyard's name. */
export const BOUNTY_GRAVEYARD_STORIES = Object.freeze([
  '{count} {foes} have been seen at {place}, {far} {dir} of {town}. They stir among the stones after dark. Hunt them down before they reach the road.',
  'The gravedigger at {place} refuses to work after dusk: {foes}, {count} of them, have taken to the place. Put an end to them, {dir} of {town}, for good.',
  'Mourners were driven from {place}, {dir} of {town}, by {count} {foes}. Rid the graveyard of them.',
  "A reward is offered to any blade willing to stand watch at {place}, {dir} of {town}, and slay the {foes} haunting it, {count} strong by the sexton's count.",
]);
/** ...and a dungeon's names the place. */
export const bountyDungeonMapLine = (place) => `Take a look at your map: ${place} is marked with a black circle.`;

/** The payday, told. {town} the board's town, {gold}, {item}. */
export const BOUNTY_REWARD_STORIES = Object.freeze([
  'An unknown rider approaches you at a gallop, throws you a heavy sack and is gone as fast as he came. Inside you find {gold} gold pieces and {item}.',
  'A boy from {town} comes running up the road, red-faced and out of breath. "From the Captain," he gasps, pressing a pouch into your hands, and dashes off before you can thank him. It holds {gold} gold pieces and {item}.',
  'A hooded courier steps out of the brush, nods once at the bodies, and hands you a bundle wrapped in oilcloth. Before you can ask a thing, the stranger has vanished. Inside: {gold} gold pieces and {item}.',
  'A gray-haired huntsman whistles low at the carnage. "The town will sleep easier," he says, tossing you a purse of {gold} gold pieces and {item}, and walks off whistling.',
  'A raven lands on the nearest carcass with a small satchel tied to its leg. It lets you take it, croaks once, and flies back toward {town}. Inside are {gold} gold pieces and {item}.',
]);
export const BOUNTY_REWARD_TITLE = 'Bounty Fulfilled';

/** Fill a story's blanks. */
export const fillStory = (text, words) =>
  String(text).replace(/\{(\w+)\}/g, (all, k) => (words[k] != null ? String(words[k]) : all));

const pick = (list, h) => list[h % list.length];
const capital = (s) =>
  String(s)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('-');

/**
 * One slot of a town's board, as a reader of `level` reads it - or null when the town has no ground to send anyone
 * to. `sites` is bountySites' list (the caller keeps it; it is the same all day). QUARRY-WORLD: `wild` the land's own
 * wild about the town (bountyQuarry) - its beasts are the ones the board hunts.
 * @param {{ day:number, px:number, py:number, name?:string, slot:number, level:number, sites:Array<[number,number]>,
 *   dungeons?:Array<{px:number, py:number, name:string}>, wild?:?Array<[number, number]> }} o
 */
export function bountyPosting({ day, px, py, name = '', slot, level, sites, dungeons = [], wild = null }) {
  const underground = dungeonSlotsFor(dungeons?.length ?? 0).includes(slot);
  if (!underground && !sites?.length) return null;
  // SITE: four slots, four different spots where the ground allows it - a slot takes the next free spot after its own
  // roll, so the list decides, never the order the slots were asked in
  const used = new Set();
  let site = null;
  let place = null;
  if (underground) {
    // DUNGEON: the underground slots take different dungeons where there are two, the next free one after the roll
    const dslots = dungeonSlotsFor(dungeons.length);
    const taken = new Set();
    for (const s of dslots) {
      let i = bountyHash(day, px, py, s, SALT.site) % dungeons.length;
      while (taken.has(i) && taken.size < dungeons.length) i = (i + 1) % dungeons.length;
      taken.add(i);
      if (s === slot) place = dungeons[i];
    }
    site = [place.px, place.py];
  }
  for (let s = 0; s <= slot && !underground; s++) {
    const start = bountyHash(day, px, py, s, SALT.site) % sites.length;
    let i = start;
    if (sites.length >= BOUNTIES_PER_DAY) while (used.has(i)) i = (i + 1) % sites.length;
    used.add(i);
    if (s === slot) site = sites[i];
  }
  const [tx, ty] = site;
  const quarry = bountyQuarry(level, wild); // QUARRY-WORLD: the land's own beasts in the tier's band
  const mobileType = quarry[bountyHash(day, px, py, slot, SALT.beast) % quarry.length];
  const count = underground
    ? BOUNTY_DUNGEON_PACK_MIN +
      (bountyHash(day, px, py, slot, SALT.count) % (BOUNTY_DUNGEON_PACK_MAX - BOUNTY_DUNGEON_PACK_MIN + 1))
    : BOUNTY_PACK_MIN + (bountyHash(day, px, py, slot, SALT.count) % (BOUNTY_PACK_MAX - BOUNTY_PACK_MIN + 1));
  const foes = bountyFoesWord(mobileType);
  const kind = kindOf(mobileType);
  const dir = compassWord(tx - px, ty - py);
  const far = distanceWord(Math.max(Math.abs(tx - px), Math.abs(ty - py)));
  const town = name || 'town';
  const graveyard = !!place?.graveyard;
  const template = pick(
    graveyard ? BOUNTY_GRAVEYARD_STORIES : place ? BOUNTY_DUNGEON_STORIES : BOUNTY_STORIES[kind],
    bountyHash(day, px, py, slot, SALT.story),
  );
  const story = fillStory(template, { foes, count, town, dir, far, place: place?.name ?? '' });
  const lvl = clampLevel(level);
  return {
    id: bountyId(day, px, py, slot, lvl),
    slotKey: bountySlotKey(day, px, py, slot),
    day,
    slot,
    level: lvl,
    town: { px, py, name: town },
    target: { px: tx, py: ty },
    mobileType,
    count,
    foes,
    kind: place ? 'dungeon' : 'field',
    place: place?.name ?? null,
    graveyard,
    tier: bountyTierIndex(lvl) + 1,
    tierLabel: bountyTierLabel(lvl), // BOUNTY-TIERLABEL
    farm: !place && FARM_STORY_RE.test(template), // BOUNTY-FARM: a farm stands on its pixel while it is held
    title: place ? `${foes} in ${place.name}` : `${foes} ${dir === 'nearby' ? 'nearby' : `to the ${capital(dir)}`}`,
    story,
    mapLine: place ? bountyDungeonMapLine(place.name) : BOUNTY_MAP_LINE,
    poster: pick(BOUNTY_POSTERS, bountyHash(day, px, py, slot, SALT.poster)),
    dir,
    far,
    gold: bountyGold(lvl, count, mobileType, underground, quarry),
    item: bountyItemRule(lvl),
  };
}

/** A whole board: the day's four postings as `level` reads them (fewer only when the town has no ground). */
export function boardPostings({ day, px, py, name = '', level, sites, dungeons = [], wild = null }) {
  const out = [];
  for (let slot = 0; slot < BOUNTIES_PER_DAY; slot++) {
    const p = bountyPosting({ day, px, py, name, slot, level, sites, dungeons, wild });
    if (p) out.push(p);
  }
  return out;
}

/**
 * A taken bounty's posting rebuilt from its id alone - the party's shared copy, a save's, the wire's.
 * @param {string} id
 * @param {{ name?:string, sites?:Array<[number,number]>, dungeons?:Array<{px:number, py:number, name:string}>, wild?:?Array<[number, number]> }} [o]
 */
export function postingFromId(id, { name = '', sites = [], dungeons = [], wild = null } = {}) {
  const b = parseBountyId(id);
  if (!b) return null;
  return bountyPosting({ day: b.day, px: b.px, py: b.py, name, slot: b.slot, level: b.level, sites, dungeons, wild });
}

/** The words the reward notice speaks. `h` picks the story (a roll the host makes). */
export function rewardStory({ town = 'town', gold, itemName }, h = 0) {
  return fillStory(pick(BOUNTY_REWARD_STORIES, h >>> 0), { town, gold, item: itemName || 'a small trinket' });
}

/** The boards by position - x, then z, then y - as `[box, index]`; a board with no box takes no place. */
const boardOrder = (boards) =>
  (Array.isArray(boards) ? boards : [])
    .map((b, i) => [b?.box, i])
    .filter(([b]) => Array.isArray(b))
    .sort(([a], [b]) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);

/** Which of a town's boards are bounty boards (Mac, 2026-09-28: "always the half of the bounty boards in every city
 *  should share the same quests"): HALF of them, spread through the town - the boards sorted by position (x, then z,
 *  then y) and every other one taken, starting with the first. Two boards give one, four give two, five give two. A
 *  town with a single board keeps it for its notices. Every bounty board of a town posts the SAME four hunts - a
 *  posting is the town's, never the board's. One answer on every client, whichever order the blocks were laid.
 *  @param {Array<{box:number[]}>} boards pixel-local boxes, [minX, minY, minZ, maxX, maxY, maxZ]
 *  @returns {Set<number>} the indices into `boards` that are bounty boards */
export function questBoardIndices(boards) {
  const out = new Set();
  const order = boardOrder(boards);
  const want = Math.floor(order.length / 2);
  for (let k = 0; k < order.length && out.size < want; k += 2) out.add(order[k][1]);
  return out;
}

/** THE RUMOUR BOARD NEAREST THE TOWN'S MIDDLE: of the boards questBoardIndices left, the one nearest `centre` (the
 *  town's middle on the ground, [x, z]), the first by position on a tie or with no centre - the board the siege field
 *  takes for its Market (systems/siegeField.js). ONE-BOARD (2026-10-06) made it the town's one Notice Board online;
 *  ONE-BOARD REVERTED (2026-10-07, Mac: revert "just that change") made every board questBoardIndices left a Notice
 *  Board again, and this the field's alone. Pure.
 *  @param {Array<{box:number[]}>} boards pixel-local boxes, as questBoardIndices reads them
 *  @param {Set<number>} [bounty] the indices questBoardIndices took
 *  @param {number[]|null} [centre]
 *  @returns {number} the Notice Board's index into `boards`, or -1 where every board is a bounty board */
export function noticeBoardIndex(boards, bounty = questBoardIndices(boards), centre = null) {
  let best = -1,
    near = Infinity;
  for (const [box, i] of boardOrder(boards)) {
    if (bounty.has(i)) continue;
    const d = Array.isArray(centre)
      ? Math.hypot((box[0] + box[3]) / 2 - centre[0], (box[2] + box[5]) / 2 - centre[1])
      : 0;
    if (d < near) {
      near = d;
      best = i;
    }
  }
  return best;
}

// ── the ledger ────────────────────────────────────────────────────────
/**
 * A hunter's bounties: the ones held, and the slots already paid (a slot paid is not posted to that hunter again
 * that day). Plain data - it is the save record as it stands.
 * @typedef {{ id:string, takenAt:number, killed:number, shared?:boolean, from?:string }} HeldBounty
 * @typedef {{ held: HeldBounty[], paid: string[], dropped: string[], paidAt?: Record<string, number>, droppedKilled?: Record<string, number>, v?: number }} BountyLedger
 */
/** AUDIT 28 B1/B2: `paidAt` - slotKey -> the minute it was paid (a mate's clear pays only a bounty held before it);
 *  `droppedKilled` - slotKey -> the kills a bounty given up had (taken again, it goes on from them). */
/** AUDIT REST II Q3: THE LEDGER'S VERSION, saved with it as `v`. 1 - every ledger written before the mark (it is
 *  absent): under TIMEFREE (app-v0.1.5694, `Online-Time-Arc.md` 6.3b) a held bounty never lapsed online, so a row held
 *  through that build can carry a `takenAt` days behind the world's clock, and QCLOCK-WORLD's lapse sweep, back, took
 *  every such row - and its kills - on the first tick after the update. 2 - a ledger this build wrote, whose rows ran
 *  under a lapse sweep online. */
export const BOUNTY_LEDGER_VERSION = 2;
/** @returns {BountyLedger} */
export const newBountyLedger = () => ({
  held: [],
  paid: [],
  dropped: [],
  paidAt: /** @type {Record<string, number>} */ ({}),
  droppedKilled: /** @type {Record<string, number>} */ ({}),
  v: BOUNTY_LEDGER_VERSION,
});

/** A save record, read defensively - anything malformed is dropped rather than trusted. */
export function readBountyLedger(rec) {
  const out = newBountyLedger();
  if (!rec || typeof rec !== 'object') return out;
  for (const h of Array.isArray(rec.held) ? rec.held : []) {
    if (!h || !parseBountyId(h.id) || out.held.some((x) => x.id === h.id)) continue;
    out.held.push({
      id: h.id,
      takenAt: Number.isFinite(h.takenAt) ? h.takenAt : 0,
      killed: Math.max(0, h.killed | 0),
      ...(h.shared ? { shared: true } : {}),
      ...(typeof h.from === 'string' ? { from: h.from.slice(0, 24) } : {}),
    });
    if (out.held.length >= BOUNTY_ACTIVE_MAX) break;
  }
  for (const k of ['paid', 'dropped'])
    for (const s of Array.isArray(rec[k]) ? rec[k] : []) if (typeof s === 'string' && s.length <= 40) out[k].push(s);
  for (const k of /** @type {const} */ (['paidAt', 'droppedKilled'])) {
    const src = rec[k] && typeof rec[k] === 'object' && !Array.isArray(rec[k]) ? rec[k] : {};
    const into = /** @type {Record<string, number>} */ (out[k]);
    for (const [slot, v] of Object.entries(src))
      if (slot.length <= 40 && Number.isSafeInteger(v) && v >= 0) into[slot] = v;
  }
  out.v = Number.isSafeInteger(rec.v) && rec.v >= 1 ? rec.v : 1; // AUDIT REST II Q3: no mark - a ledger from before it
  return out;
}

/** AUDIT REST II Q3: a ledger written before the version mark, first played online: every bounty it holds runs from
 *  `nowMinutes` - ONCE (the mark is set, and saved with the ledger). The never-lapse build kept no time for them, so a
 *  row held through it lapses a day after the update, never on its first tick with its kills. The host asks it online
 *  alone: offline a held bounty lapsed under that build too, and the mark waits for the first online tick. Answers the
 *  rows re-stamped. */
export function restampNeverLapsed(ledger, nowMinutes) {
  if ((ledger.v ?? 1) >= BOUNTY_LEDGER_VERSION) return [];
  for (const h of ledger.held) h.takenAt = nowMinutes;
  ledger.v = BOUNTY_LEDGER_VERSION;
  return ledger.held.slice();
}

const heldSlot = (ledger, slotKey) => ledger.held.find((h) => parseBountyId(h.id)?.slotKey === slotKey) ?? null;

/**
 * Where a posting stands for this hunter: 'held' (theirs), 'paid' (done today), 'full' (four held already), or 'open'.
 * @param {BountyLedger} ledger @param {{slotKey:string}} posting
 */
export function postingState(ledger, posting) {
  if (heldSlot(ledger, posting.slotKey)) return 'held';
  if (ledger.paid.includes(posting.slotKey)) return 'paid';
  if (ledger.held.length >= BOUNTY_ACTIVE_MAX) return 'full';
  return 'open';
}

/** Take a bounty. Answers the held row, or a refusal's reason ('held' | 'paid' | 'full' | 'bad'). */
export function takeBounty(ledger, id, nowMinutes, { shared = false, from = null } = {}) {
  const b = parseBountyId(id);
  if (!b) return { ok: false, reason: 'bad' };
  if (heldSlot(ledger, b.slotKey)) return { ok: false, reason: 'held' };
  if (ledger.paid.includes(b.slotKey)) return { ok: false, reason: 'paid' };
  if (ledger.held.length >= BOUNTY_ACTIVE_MAX) return { ok: false, reason: 'full' };
  // AUDIT 28 B2: a notice given up and taken again goes on from the kills it had - never a fresh pack to farm
  const killed = Math.max(0, ledger.droppedKilled?.[b.slotKey] ?? 0);
  const row = {
    id,
    takenAt: nowMinutes,
    killed,
    ...(shared ? { shared: true } : {}),
    ...(from ? { from: String(from).slice(0, 24) } : {}),
  };
  ledger.held.push(row);
  ledger.dropped = ledger.dropped.filter((s) => s !== b.slotKey);
  if (ledger.droppedKilled) delete ledger.droppedKilled[b.slotKey];
  return { ok: true, row };
}

/** Give a bounty up. A slot given up is remembered, so a party mate's share does not push it straight back. */
export function dropBounty(ledger, id) {
  const i = ledger.held.findIndex((h) => h.id === id);
  if (i < 0) return false;
  const [row] = ledger.held.splice(i, 1);
  const k = parseBountyId(row.id)?.slotKey;
  if (k && !ledger.dropped.includes(k)) ledger.dropped.push(k);
  if (k && row.killed > 0) (ledger.droppedKilled ??= {})[k] = row.killed;
  return true;
}

/** A bounty paid: out of the held list, its slot into the paid list. Answers the row, or null. */
export function payBounty(ledger, id, nowMinutes = null) {
  const i = ledger.held.findIndex((h) => h.id === id);
  if (i < 0) return null;
  const [row] = ledger.held.splice(i, 1);
  const k = parseBountyId(row.id)?.slotKey;
  if (k && !ledger.paid.includes(k)) ledger.paid.push(k);
  if (k && Number.isSafeInteger(nowMinutes)) (ledger.paidAt ??= {})[k] = nowMinutes; // AUDIT 28 B1: WHEN - the pose's `t`
  return row;
}

/** The bounties whose time ran out at `nowMinutes` - taken, and removed from the ledger. */
export function lapseBounties(ledger, nowMinutes) {
  const gone = ledger.held.filter((h) => nowMinutes - h.takenAt >= BOUNTY_LIFETIME_MINUTES);
  if (gone.length) ledger.held = ledger.held.filter((h) => !gone.includes(h));
  return gone;
}

/** Forget paid and dropped slots older than yesterday - the board they were on is long gone. */
export function pruneBountyLedger(ledger, today) {
  const keep = (s) => {
    const d = Number(String(s).split('.')[0]);
    return Number.isFinite(d) && d >= today - 1;
  };
  ledger.paid = ledger.paid.filter(keep);
  ledger.dropped = ledger.dropped.filter(keep);
  for (const k of ['paidAt', 'droppedKilled'])
    for (const slot of Object.keys(ledger[k] ?? {})) if (!keep(slot)) delete ledger[k][slot];
}

/** Minutes a held bounty has left. */
export const bountyMinutesLeft = (row, nowMinutes) =>
  Math.max(0, BOUNTY_LIFETIME_MINUTES - (nowMinutes - (row?.takenAt ?? nowMinutes)));
/** "14h 05m" / "38m". */
export function bountyTimeText(minutes) {
  const m = Math.max(0, Math.ceil(minutes));
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

// ── the party's word (net/wire.js validPartyPose `bq`) ────────────────
/** The most bounty rows one pose carries - the wire's own bound (net/wire.js), one home. */
/**
 * What my party pose says of my bounties: every one I hold (`s: 1` if I shared it; AUDIT 28 B3/B4: `k` its kills, `a: 1`
 * while its pack stands on my machine) and every one paid (`c: 1`, `t` the minute - AUDIT 28 B1), NEWEST PAID FIRST
 * (B7: the oldest were kept and today's cut), so a mate holding the same hunt is paid when I clear it - if they held it
 * before - and a mate I shared one with takes it up.
 * @param {BountyLedger} ledger @param {Map<string,string>} paidIds slotKey -> the id I was paid for
 * @param {{ standing?: (id: string) => boolean }} [o]
 */
export function bountyPoseField(ledger, paidIds, { standing = () => false } = {}) {
  /** @type {Array<{ i:string, s?:number, c?:number, k?:number, a?:number, t?:number }>} */
  const rows = ledger.held.map((h) => ({
    i: h.id,
    ...(h.shared ? { s: 1 } : {}),
    ...(h.killed > 0 ? { k: h.killed } : {}),
    ...(standing(h.id) ? { a: 1 } : {}),
  }));
  const paid = [...paidIds.entries()]
    .map(([slot, id]) => ({ id, t: ledger.paidAt?.[slot] ?? -1 }))
    .sort((a, b) => b.t - a.t);
  for (const { id, t } of paid) if (rows.length < BOUNTY_POSE_MAX) rows.push({ i: id, c: 1, ...(t >= 0 ? { t } : {}) });
  return rows.length ? { bq: rows.slice(0, BOUNTY_POSE_MAX) } : {};
}

/** AUDIT 28 B12: a bounty id at another level - the same notice and, where the tier fits, the same hunt; a mate's copy
 *  taken up is rebuilt at the taker's own level, so the piece it pays is minted for them. */
export function bountyIdAtLevel(id, level) {
  const b = parseBountyId(id);
  return b ? bountyId(b.day, b.px, b.py, b.slot, level) : null;
}

/**
 * Who stands the pack when several of a party are on its pixel at once - one answer on every client, so a party hunts
 * ONE pack, never one each. AUDIT 28 B3: a mate whose pack for the hunt STANDS (`a: 1`), wherever they are, owns it -
 * the lowest account of those if two raced; else the lowest account among the living, online holders on the pixel. (By
 * the lowest account alone, a holder arriving after the pack stood stood a second, and one who stepped off the pixel
 * handed the hunt to a mate who stood another.)
 * @param {string|null} me my account (null offline: I always stand it)
 * @param {Array<{acct:string, p:any, online?:boolean}>} mates the party's other members, with their poses
 * @param {string} huntKey bountyHuntKey - the slot and the tier @param {{px:number, py:number}} target where the pack
 *   stands, as the poses say a place (the pose's own pixel)
 * @param {number} [inside] where the pack stands - 0 the open air, 1 a dungeon (the party pose's `in`)
 */
export function bountyPackOwner(me, mates, huntKey, target, inside = 0) {
  if (!me) return me;
  const rowOf = (p) => (Array.isArray(p?.bq) ? p.bq.find((r) => !r.c && bountyHuntKey(r.i) === huntKey) : null); // BOUNTY-TIER: the same hunt - slot and tier
  const live = (mates ?? []).filter((m) => m?.acct && m.p && m.online !== false && !(m.p.h === 0)); // the dead and the gone stand nothing
  const standing = live
    .filter((m) => rowOf(m.p)?.a === 1)
    .map((m) => String(m.acct))
    .sort();
  if (standing.length) return standing[0];
  let owner = me;
  for (const m of live) {
    const p = m.p;
    if (p.px !== target.px || p.py !== target.py || (p.in ?? 0) !== inside) continue;
    if (rowOf(p) && String(m.acct) < String(owner)) owner = m.acct;
  }
  return owner;
}

/** AUDIT 28 B4: THE HUNT'S KILLS, the party's: the most any holder of the same hunt reports (a pose's `k`) - so an owner
 *  who fell or walked off hands on a hunt part done, never a fresh one. */
export function bountyPartyKills(mates, huntKey) {
  let k = 0;
  for (const m of mates ?? [])
    for (const r of Array.isArray(m?.p?.bq) ? m.p.bq : []) {
      if (!r.c && Number.isSafeInteger(r.k) && bountyHuntKey(r.i) === huntKey) k = Math.max(k, r.k);
    }
  return k;
}
/** AUDIT 28 B1: whether a mate's clear of this hunt came after `takenAt` (the pose's `t`) - only then does it pay. */
export function bountyClearPays(r, takenAt) {
  return r?.c === 1 && Number.isSafeInteger(r.t) && Number.isFinite(takenAt) && r.t >= takenAt;
}
