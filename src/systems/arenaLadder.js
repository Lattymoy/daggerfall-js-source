// @ts-check
// ARENA2 (2026-10-02, Mac: "climb esclating tiers of opponents"; "Being a top rank PvE fighter comes with it's own
// title"): THE LADDER - ten tiers of Daggerfall's own class enemies and monsters, offline, and the exhibitions the city
// floor holds on the hour. Design: bible/11-Multiplayer/Arena.md "2. The fights" (the tier table is its own, row for
// row) and "6. Titles".
//
// A FIXED MOUNTAIN. A tier is three bouts; a fourth, its CHAMPION, opens when three are won; the champion beaten moves
// the fighter up and gives the tier's title. Opponents scale with the tier, never with the player - the Arena of TES I's
// law. Losing costs only the purse. Tier 10 is the Grand Melee - every fighter for themselves - and then the Grand
// Champion. The purses are Daggerfall's scale (a tier-1 win 50 gold, the Grand Champion's 10,000), raised or cut by the
// crowd's favour (systems/arenaBout.js boutPurse).
//
// THE SAVE. The ladder rides the player's save (systems/save.js `arena`): `arenaLadderSnapshot` writes it versioned,
// `arenaLadderRestore` reads any shape back to a whole ladder - a save from before ARENA2 (none) is a fresh one.
//
// THE EXHIBITIONS. One bout on the hour of the game's clock, its fighters drawn from the hour (`exhibitionFor`): the
// same hour is the same bout on every screen, so ARENA4's relay can run the schedule on the shared clock (ARENA4b: it
// does - the law lives in net/arenaExhibition.js, in the relay's import graph, and is handed on from here).
//
// Pure. Not a DFU member. Ledger A (ARENA).

import { MOBILE_TYPES as M } from '../characters/mobileTypes.js';
import { ARENA_TEXT } from './arenaText.js';
import { seededRng } from './wind.js';   // the port's one seeded die (mulberry32) - one home
import { EXHIBITION_START_MINUTES, EXHIBITION_HOURS, ARENA_SEED, arenaHash, hourIndexOf, exhibitionFor } from '../net/arenaExhibition.js';   // ARENA4b: the exhibitions' law, the relay's too

/** The ladder's save shape's version. */
export const ARENA_LADDER_VERSION = 1;
/** Bouts in a tier before its champion. */
export const BOUTS_PER_TIER = 3;

/**
 * THE TEN TIERS (the design table): each tier's three bouts' opponents (a bout's list - one fighter, two at once, or
 * a Grand Melee's three), their levels (null: a monster at its own), and the champion. `free` - every fighter a side of
 * its own (the Grand Melee). `beasts` - the crowd thinks it unfair.
 */
const b = (mobile, level = null) => Object.freeze({ mobile, level });
/** @type {ReadonlyArray<{ bouts: ReadonlyArray<ReadonlyArray<{ mobile: number, level: number|null }>>, champion: ReadonlyArray<{ mobile: number, level: number|null }>, free?: boolean, beasts?: boolean }>} */
export const LADDER_TIERS = Object.freeze([
  Object.freeze({ bouts: [[b(M.Thief, 1)], [b(M.Rogue, 2)], [b(M.Barbarian, 3)]], champion: [b(M.Barbarian, 3)] }),
  Object.freeze({ bouts: [[b(M.Warrior, 3)], [b(M.Monk, 4)], [b(M.Archer, 5)]], champion: [b(M.Knight, 5)] }),
  Object.freeze({ bouts: [[b(M.Spellsword, 5)], [b(M.Nightblade, 6)], [b(M.Ranger, 7)]], champion: [b(M.Battlemage, 7)] }),
  Object.freeze({ bouts: [[b(M.Knight, 7)], [b(M.Barbarian, 8)], [b(M.Healer, 9)]], champion: [b(M.Assassin, 9)] }),
  Object.freeze({ bouts: [[b(M.Battlemage, 9)], [b(M.Sorcerer, 10)], [b(M.Warrior, 11)]], champion: [b(M.Warrior, 11), b(M.Warrior, 11)] }),
  Object.freeze({ bouts: [[b(M.GrizzlyBear)], [b(M.SabertoothTiger)], [b(M.GiantScorpion)]], champion: [b(M.Spriggan)], beasts: true }),
  Object.freeze({ bouts: [[b(M.Knight, 13)], [b(M.Spellsword, 14)], [b(M.Nightblade, 15)]], champion: [b(M.OrcWarlord)] }),
  Object.freeze({ bouts: [[b(M.Assassin, 15)], [b(M.Battlemage, 16)], [b(M.Monk, 17)]], champion: [b(M.DaedraSeducer)] }),
  Object.freeze({ bouts: [[b(M.Knight, 17), b(M.Healer, 17)], [b(M.Warrior, 18), b(M.Mage, 18)], [b(M.Knight, 19), b(M.Mage, 19)]], champion: [b(M.Vampire)] }),
  Object.freeze({ bouts: [[b(M.Knight, 20), b(M.Warrior, 20), b(M.Healer, 20)], [b(M.Assassin, 21), b(M.Battlemage, 21), b(M.Monk, 21)], [b(M.Vampire), b(M.DaedraSeducer), b(M.OrcWarlord)]], champion: [b(M.IronAtronach)], free: true }),
].map((t) => Object.freeze({ ...t, bouts: Object.freeze(t.bouts.map((x) => Object.freeze(x))), champion: Object.freeze(t.champion) })));

/** THE PURSES, gold: a bout won in each tier, its champion beaten, and the Grand Champion's. */
export const BOUT_PURSE = Object.freeze([50, 100, 175, 275, 400, 550, 750, 1000, 1350, 1800]);
export const CHAMPION_PURSE = Object.freeze([200, 400, 700, 1100, 1600, 2200, 3000, 4000, 5400, 10000]);
/** An exhibition's purse to its winner (the house's, said for the crowd - nobody is paid on this screen). */
export const EXHIBITION_PURSE = 100;

/** A fresh ladder: tier 0, nothing won. */
export function newArenaLadder() {
  return {
    v: ARENA_LADDER_VERSION, tier: 0, won: 0, champs: Array(LADDER_TIERS.length).fill(false), grand: false,
    record: { wins: 0, losses: 0, yields: 0, falls: 0, ringouts: 0, purses: 0, streak: 0, best: 0 },
  };
}

const int = (v, lo, hi, d = lo) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
/** Any shape back to a whole ladder (a save from before ARENA2, a hand-edited one, a newer one's fields dropped). */
export function arenaLadderRestore(raw) {
  const L = newArenaLadder();
  if (!raw || typeof raw !== 'object') return L;
  L.tier = int(raw.tier, 0, LADDER_TIERS.length - 1);
  L.won = int(raw.won, 0, BOUTS_PER_TIER);
  if (Array.isArray(raw.champs)) L.champs = L.champs.map((_, i) => raw.champs[i] === true);
  L.grand = raw.grand === true;
  // a champion beaten below the tier is the climb's own record - a tier above any champion beaten is the next
  const r = raw.record ?? {};
  for (const k of Object.keys(L.record)) L.record[k] = int(r[k], 0, 1e9);
  return L;
}
/** The ladder as the save writes it (a copy). */
export function arenaLadderSnapshot(L) {
  const s = arenaLadderRestore(L);
  return { v: ARENA_LADDER_VERSION, tier: s.tier, won: s.won, champs: [...s.champs], grand: s.grand, record: { ...s.record } };
}

/** THE NEXT BOUT on the ladder: `{ tier, bout, champion, grand, opponents, free, beasts, purse, label }` - the bout
 *  index (0..2), or the champion once three are won; null when the Grand Champion has been beaten. */
export function nextLadderBout(L) {
  const s = arenaLadderRestore(L);
  if (s.grand) return null;
  const t = LADDER_TIERS[s.tier];
  const champion = s.won >= BOUTS_PER_TIER;
  const grand = champion && s.tier === LADDER_TIERS.length - 1;
  const opponents = champion ? t.champion : t.bouts[s.won];
  return {
    tier: s.tier, bout: champion ? BOUTS_PER_TIER : s.won, champion, grand, opponents, free: !!t.free && !champion, beasts: !!t.beasts,
    purse: champion ? CHAMPION_PURSE[s.tier] : BOUT_PURSE[s.tier],
    label: grand ? ARENA_TEXT.grandLabel : champion ? ARENA_TEXT.champLabel : ARENA_TEXT.boutLabel(s.won + 1),
    tierName: ARENA_TEXT.tiers[s.tier],
  };
}

/**
 * A LADDER BOUT'S END on the ladder: a win counts the bout (the champion beaten moves the tier up and gives its
 * title; the last one is the Grand Champion), a loss counts nothing but the record. `how` the bout's ending for the
 * player ('yield', 'fall', 'ringout', 'judges', 'draw'). Answers `{ ladder, title, tierUp, grand }` - a new ladder.
 */
export function ladderAfter(L, { won, how = '', purse = 0 }) {
  const s = arenaLadderRestore(L);
  const next = nextLadderBout(s);
  const out = { ladder: s, title: null, tierUp: false, grand: false };
  if (!next) return out;
  const r = s.record;
  if (won) {
    r.wins++; r.streak++; r.best = Math.max(r.best, r.streak); r.purses += Math.max(0, Math.round(purse));
    if (next.champion) {
      s.champs[next.tier] = true;
      out.title = ARENA_TEXT.titles[next.tier];
      if (next.grand) { s.grand = true; out.grand = true; s.won = BOUTS_PER_TIER; }
      else { s.tier = Math.min(LADDER_TIERS.length - 1, s.tier + 1); s.won = 0; out.tierUp = true; }
    } else s.won = Math.min(BOUTS_PER_TIER, s.won + 1);
  } else {
    r.losses++; r.streak = 0;
    if (how === 'yield') r.yields++;
    else if (how === 'fall') r.falls++;
    else if (how === 'ringout') r.ringouts++;
  }
  return out;
}

/** The title a ladder gives (the highest tier whose champion was beaten; the Grand Champion's over all), or null. */
export function ladderTitle(L) {
  const s = arenaLadderRestore(L);
  if (s.grand) return ARENA_TEXT.titles[LADDER_TIERS.length - 1];
  for (let i = s.champs.length - 1; i >= 0; i--) if (s.champs[i]) return ARENA_TEXT.titles[i];
  return null;
}
/** Every tier title a ladder has earned, lowest first. */
export const ladderTitles = (L) => arenaLadderRestore(L).champs.map((c, i) => (c ? ARENA_TEXT.titles[i] : null)).filter(Boolean);

// ── THE UNDERCROFT (ARENA-FIX 4; world/arenaUndercroft.js) ─────────────────────────────────────────────────
/**
 * THE TRAINING PIT'S BOUT: unranked - no purse, no step on the ladder, no crowd - against a sparring fighter of the
 * player's own tier (its first bout's opponent at its level: the Pit Master shows you what the next bout will ask). A
 * Grand Champion spars the Grand Melee's first. Answers the shape `nextLadderBout` does, `practice` set. Pure.
 */
export function practiceBout(L) {
  const s = arenaLadderRestore(L);
  const t = LADDER_TIERS[s.tier];
  return {
    tier: s.tier, bout: 0, champion: false, grand: false, opponents: Object.freeze([t.bouts[0][0]]), free: false, beasts: !!t.beasts,
    purse: 0, label: ARENA_TEXT.undercroft.practiceLabel, tierName: ARENA_TEXT.tiers[s.tier], practice: true,
  };
}
/**
 * THE HALL OF CHAMPIONS: the lines its keeper reads off the wall for this save - its Grand Champion, then each tier
 * whose champion was beaten (its number, its name, the title it gave), the highest first; the stone's waiting line
 * when none is cut. `name` the player's. Pure.
 *
 * ARENA3: and THE ARENA'S GRAND CHAMPIONS this save has seen - the banners' fighters who took the title
 * (systems/arenaLeague.js rosterGrandChampions, handed in as `champions` `[{ season, name, home, banner }]`, the newest
 * season first): their season, their name and home, the banner they fought for. With none handed in the wall reads as
 * it always did.
 */
export function hallOfChampions(L, name, champions = []) {
  const s = arenaLadderRestore(L);
  const U = ARENA_TEXT.undercroft;
  const lines = [U.hallTitle, '', U.hallIntro, ''];
  const cut = [];
  if (s.grand) cut.push(U.hallGrand(name));
  for (let i = s.champs.length - 1; i >= 0; i--) if (s.champs[i] && !(s.grand && i === s.champs.length - 1)) cut.push(U.hallTier(U.hallTierName(i + 1, ARENA_TEXT.tiers[i]), ARENA_TEXT.titles[i], name));
  const theirs = Array.isArray(champions) ? champions : [];
  if (!cut.length) lines.push(theirs.length ? U.hallNotYou : U.hallNone);
  else lines.push(...cut, '', U.hallYours(cut.length));
  if (theirs.length) {
    lines.push('', U.hallTheirs);
    for (const c of theirs) lines.push(U.hallTheir(c.season, `${c.name} of ${c.home}`, ARENA_TEXT.teams.the[c.banner] ?? ''));
  }
  return lines;
}

// ── THE EXHIBITIONS ────────────────────────────────────────────────────────────────────────────────────────
// ARENA4b: the schedule, the hour's draw and the arena's hash moved to net/arenaExhibition.js - the relay runs the same
// hour's bout from there (the relay's import graph cannot reach this file's mobile and text tables) - and are handed on
// from here, so every reader of the ladder reads them where it always did (one home, no copy).
export { EXHIBITION_START_MINUTES, EXHIBITION_HOURS, ARENA_SEED, arenaHash, hourIndexOf, exhibitionFor };
/** A seeded die: `rng()` in [0, 1), the same sequence for the same seed - the port's one (systems/wind.js seededRng,
 *  mulberry32), handed on from here so the arena's modules ask their own law for it (audit24 one-home). */
export { seededRng };

/** The next hour (from `gameMinutes`) with an exhibition, as "HH:00". */
export function nextExhibitionHour(gameMinutes) {
  let h = hourIndexOf(gameMinutes) + 1;
  for (let k = 0; k < 48; k++, h++) if (EXHIBITION_HOURS.includes(h % 24)) return `${String(h % 24).padStart(2, '0')}:00`;
  return '08:00';
}

// ── THE FIGHTERS' NAMES ────────────────────────────────────────────────────────────────────────────────────
/** Where a fighter comes from, and the name bank (characters/nameHelper.js BANK_TYPES) their name is drawn from. */
export const ARENA_HOMES = Object.freeze([
  ['Daggerfall', 0], ['Wayrest', 0], ['Shornhelm', 0], ['Evermor', 0], ['Camlorn', 0], ['Farrun', 0], ['Northmoor', 0],
  ['Glenpoint', 0], ['Menevia', 0], ['Kambria', 0], ['Gavaudon', 0], ['Urvaius', 0], ['Betony', 0],
  ['Sentinel', 1], ['Totambu', 1], ['Antiphyllos', 1], ['Bergama', 1], ['Ayasofya', 1], ['Myrkwasa', 1], ['Satakalaam', 1],
  ['Skyrim', 2], ['Morrowind', 3], ['the Summerset Isles', 4], ['Valenwood', 5], ['Elsweyr', 6], ['the Imperial City', 7],
  ['Orsinium', 8],
].map(([town, bank]) => Object.freeze({ town, bank })));
/** The wild places a beast is billed from. */
export const BEAST_HOMES = Object.freeze(['the Wrothgarian Mountains', 'the Dragontail Mountains', 'the Alik\'r Desert', 'the Ilessan Hills', 'the Bayside Woods', 'Glenumbra Moors']);
