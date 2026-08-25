// S44: PersistentFactionData's RELATION half - the ally/enemy/parent
// questions and the four mutators that change them
// (PersistentFactionData.cs:550-880). These are what
// RegionPowerAndConditionsUpdate's CONDITIONS body runs on: it ends and
// starts alliances and rivalries, and decides who can go to war with
// whom, entirely through this set. S43 shipped the power half and had
// to flag the conditions body precisely because none of this existed.
//
// It also retires a STUB. `isFaction2RelatedToFaction1` has been a hook
// in world.js answering a hardcoded `false` since the talk arc
// (`// the faction-relation walk rides TK-v`), so answerPipeline's
// faction-relation gate could never fire. The real member is here now
// and the hook calls it.

import { FACTION_TYPES } from '../formats/factionFile.js';
import { rand, randomRangeInclusive } from '../formats/dfRandom.js';

/** PersistentFactionData.borderRegions (:52-113) - eleven neighbours per
 *  region, zero-padded, indexed `[11 * region + i]`. Transcribed
 *  mechanically out of the C# rather than by hand: 62 rows of 11, and a
 *  table with one wrong cell is worse than no table. */
export const BORDER_REGIONS = Object.freeze([
   44,  45,  47,  21,  56,  48,  49,   2,  55,  12,  57,   // Alik'r Desert
    1,  49,  55,  12,  54,  53,  52,  50,  23,  10,   0,   // Dragontail Mountains
   22,  40,  39,  17,  38,  37,  10,   0,   0,   0,   0,   // Dwynnen
    6,  37,  36,  35,  34,  24,  51,  23,   2,   0,   0,   // Isle of Balfiera
    1,  55,   2,   0,   0,   0,   0,   0,   0,   0,   0,   // Dak'fron
   24,  53,  58,  51,   0,   0,   0,   0,   0,   0,   0,   // Bjoulsae River
   39,   6,  38,  36,  35,  34,  27,  24,  58,   0,   0,   // Wrothgarian Mountains
   20,  59,  19,  43,  61,   0,   0,   0,   0,   0,   0,   // Daggerfall
   18,  59,  60,  33,  61,   0,   0,   0,   0,   0,   0,
   18,  59,   0,   0,   0,   0,   0,   0,   0,   0,   0,   // Betony
   47,   1,  56,  48,  62,   0,   0,   0,   0,   0,   0,
   43,  42,  40,   6,   0,   0,   0,   0,   0,   0,   0,   // Anticlere
    2,  50,  52,  51,  10,   0,   0,   0,   0,   0,   0,
   16,  58,  17,  27,  34,  10,  53,  51,   0,   0,   0,
   17,  34,  24,   0,   0,   0,   0,   0,   0,   0,   0,
   60,  19,  61,  41,   0,   0,   0,   0,   0,   0,   0,
   10,  35,  17,  27,  24,   0,   0,   0,   0,   0,   0,   // Menevia
   10,  36,  17,  34,   0,   0,   0,   0,   0,   0,   0,   // Alcaire
   10,  37,  38,  17,  35,   0,   0,   0,   0,   0,   0,   // Koegria
   10,   6,  38,  36,   0,   0,   0,   0,   0,   0,   0,   // Bhoriane
   37,   6,  17,  36,   0,   0,   0,   0,   0,   0,   0,   // Kambria
   41,  40,   6,  17,   0,   0,   0,   0,   0,   0,   0,   // Phrygias
   22,  42,  41,  39,   6,   0,   0,   0,   0,   0,   0,
   33,  61,  42,  40,  39,   0,   0,   0,   0,   0,   0,
   22,  43,  61,  41,  40,   0,   0,   0,   0,   0,   0,
   18,  61,  42,  22,   0,   0,   0,   0,   0,   0,   0,
   45,   1,   0,   0,   0,   0,   0,   0,   0,   0,   0,
   44,  46,  47,   1,   0,   0,   0,   0,   0,   0,   0,
   45,  47,   0,   0,   0,   0,   0,   0,   0,   0,   0,
   46,  45,   1,  21,   0,   0,   0,   0,   0,   0,   0,
   21,  56,   1,  49,  62,   0,   0,   0,   0,   0,   0,
   48,   1,   2,  62,   0,   0,   0,   0,   0,   0,   0,
    2,  52,  23,   0,   0,   0,   0,   0,   0,   0,   0,
   10,  23,  52,  53,  16,  24,   0,   0,   0,   0,   0,
   23,  50,   2,  53,  51,   0,   0,   0,   0,   0,   0,
   51,  52,   2,  16,  58,  24,   0,   0,   0,   0,   0,
    2,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    1,  12,   2,   0,   0,   0,   0,   0,   0,   0,   0,
    1,  21,  48,   0,   0,   0,   0,   0,   0,   0,   0,
    1,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
   24,  17,  16,  53,   0,   0,   0,   0,   0,   0,   0,
   18,  19,  60,  20,   0,   0,   0,   0,   0,   0,   0,
   33,  19,  59,   0,   0,   0,   0,   0,   0,   0,   0,
   18,  19,  33,  41,  42,  43,   0,   0,   0,   0,   0,
   21,  48,  49,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
    0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,
]);
export const BORDERS_PER_REGION = 11;

const get = (dict, id) => dict?.get(id) ?? null;
const alliesOf = (f) => [f.ally1, f.ally2, f.ally3];
const enemiesOf = (f) => [f.enemy1, f.enemy2, f.enemy3];

/**
 * GetNumberOfCommonAlliesAndEnemies (:550-583).
 *
 * DFU's own comment says classic's version "seems wrong" - it compared
 * faction2's allies against faction1's ALLIES' allies - and that DFU
 * rewrote it as the plainer "how many allies and enemies do these two
 * share". This port takes DFU's version, which is the rule the game
 * actually runs.
 *
 * THE ZERO QUIRK, verbatim: the 3x3 comparison has no `!= 0` guard, and
 * an empty ally or enemy slot is 0. So two factions with no allies and
 * no enemies at all score EIGHTEEN - nine ally pairs of 0 == 0 plus
 * nine enemy pairs - not zero. That is not a rounding detail: the count
 * feeds `(powerSum + count * 3) / 5 + 70` in the alliance-ending roll,
 * so eighteen shifts that chance by about ten points versus nothing.
 * DFU counts them, so this counts them.
 */
export function getNumberOfCommonAlliesAndEnemies(dict, factionID1, factionID2) {
  const f1 = get(dict, factionID1); const f2 = get(dict, factionID2);
  if (!f1 || !f2) return 0;
  const a1 = alliesOf(f1); const a2 = alliesOf(f2);
  const e1 = enemiesOf(f1); const e2 = enemiesOf(f2);
  let count = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (a1[i] === a2[j]) count++;
      if (e1[i] === e2[j]) count++;
    }
  }
  return count;
}

/** IsFaction2AnAllyOfFaction1 (:589-607). One-directional: it reads
 *  faction1's list only, and the two lists can disagree. */
export function isFaction2AnAllyOfFaction1(dict, factionID1, factionID2) {
  const f1 = get(dict, factionID1);
  if (!f1 || !get(dict, factionID2)) return false;
  return alliesOf(f1).includes(factionID2);
}

/** IsFaction2AnEnemyOfFaction1 (:610-628). */
export function isFaction2AnEnemyOfFaction1(dict, factionID1, factionID2) {
  const f1 = get(dict, factionID1);
  if (!f1 || !get(dict, factionID2)) return false;
  return enemiesOf(f1).includes(factionID2);
}

/**
 * GetFaction2RelationToFaction1 (:636-669). Four answers and a miss:
 *
 *   0  the same faction
 *   1  faction2 is an ANCESTOR of faction1
 *   3  faction2 is a DESCENDANT of faction1
 *   2  they share an ancestor
 *  -1  unrelated, or either id is unknown
 *
 * The 1 / 3 / 2 numbering is DFU's and is not a typo - 2 is the last
 * arm tested, after both walks have run to their roots.
 *
 * Both walks climb to the root and the shared-ancestor test then
 * compares the two ROOTS, with `factionData1.id != factionID1 &&
 * factionData2.id != factionID2` guarding the case where a faction has
 * no parent at all (its walk never moved, so its "root" is itself and
 * that is not a shared ancestor).
 */
export function getFaction2RelationToFaction1(dict, factionID1, factionID2) {
  let f1 = get(dict, factionID1); const start2 = get(dict, factionID2);
  if (!f1 || !start2) return -1;
  if (factionID1 === factionID2) return 0;
  while (f1.parent !== 0) {
    if (f1.parent === factionID2) return 1;
    const next = dict.get(f1.parent);
    // DFU indexes the dictionary directly here and would throw on a
    // broken parent chain; the port stops the walk instead, which is
    // the same answer for every chain that terminates. Recorded.
    if (!next) break;
    f1 = next;
  }
  let f2 = start2;
  while (f2.parent !== 0) {
    if (f2.parent === factionID1) return 3;
    const next = dict.get(f2.parent);
    if (!next) break;
    f2 = next;
  }
  if (f1.id !== factionID1 && f2.id !== factionID2 && f1.id === f2.id) return 2;
  return -1;
}

/** IsFaction2RelatedToFaction1 (:675-689), recursive up faction1's
 *  parents. This is the member world.js has been answering with a
 *  hardcoded `false`. */
export function isFaction2RelatedToFaction1(dict, factionID1, factionID2) {
  if (getFaction2RelationToFaction1(dict, factionID1, factionID2) > -1
    || isFaction2AnAllyOfFaction1(dict, factionID1, factionID2)
    || isFaction2AnEnemyOfFaction1(dict, factionID1, factionID2)) return true;
  const f1 = get(dict, factionID1);
  // DFU indexes factionDict[factionID1] unguarded AFTER the checks above
  // (:685) - reachable only through the recursive call, since the first
  // check returns -1 for an unknown id rather than throwing. Guarded
  // here; same answer, no throw.
  if (f1 && f1.parent !== 0) return isFaction2RelatedToFaction1(dict, f1.parent, factionID2);
  return false;
}

// ── the four mutators ───────────────────────────────────────────────
//
// C# READS TWO STRUCT COPIES, mutates them, and writes both back
// (`factionDict[id1] = factionData1; factionDict[id2] = factionData2;`).
// The port's dictionary holds OBJECTS, so an in-place mutation would
// differ in exactly one reachable case: id1 === id2, where C# has two
// independent copies and the SECOND write-back clobbers the first. The
// helper below reproduces the copy-and-write-back so that case lands
// the same way it does in DFU.
function mutatePair(dict, id1, id2, fn) {
  const f1 = get(dict, id1); const f2 = get(dict, id2);
  if (!f1 || !f2) return false;
  const c1 = { ...f1 }; const c2 = { ...f2 };
  fn(c1, c2);
  Object.assign(f1, c1);
  Object.assign(f2, c2);   // DFU's write-back order - it wins when f1 === f2
  return true;
}

/** StartFactionAllies (:693-721). ASYMMETRIC, and DFU says so in its own
 *  doc comment: faction1's slot is set at the INDEX given, overwriting
 *  whatever sat there, while faction2 only takes faction1 "if it has
 *  room" - its first empty slot. A faction2 with three allies already
 *  gains nothing, and the call still answers true. */
export function startFactionAllies(dict, factionID1, allyNumberForFaction1, factionID2) {
  return mutatePair(dict, factionID1, factionID2, (c1, c2) => {
    if (allyNumberForFaction1 === 0) c1.ally1 = factionID2;
    else if (allyNumberForFaction1 === 1) c1.ally2 = factionID2;
    else if (allyNumberForFaction1 === 2) c1.ally3 = factionID2;
    if (c2.ally1 === 0) c2.ally1 = factionID1;
    else if (c2.ally2 === 0) c2.ally2 = factionID1;
    else if (c2.ally3 === 0) c2.ally3 = factionID1;
  });
}

/** EndFactionAllies (:726-754). Symmetric, and every matching slot is
 *  cleared - DFU uses three separate `if`s, not else-ifs, so a faction
 *  listed twice loses both entries. */
export function endFactionAllies(dict, factionID1, factionID2) {
  return mutatePair(dict, factionID1, factionID2, (c1, c2) => {
    if (c1.ally1 === factionID2) c1.ally1 = 0;
    if (c1.ally2 === factionID2) c1.ally2 = 0;
    if (c1.ally3 === factionID2) c1.ally3 = 0;
    if (c2.ally1 === factionID1) c2.ally1 = 0;
    if (c2.ally2 === factionID1) c2.ally2 = 0;
    if (c2.ally3 === factionID1) c2.ally3 = 0;
  });
}

/** StartFactionEnemies (:760-788), the enemy twin of StartFactionAllies. */
export function startFactionEnemies(dict, factionID1, enemyNumberForFaction1, factionID2) {
  return mutatePair(dict, factionID1, factionID2, (c1, c2) => {
    if (enemyNumberForFaction1 === 0) c1.enemy1 = factionID2;
    else if (enemyNumberForFaction1 === 1) c1.enemy2 = factionID2;
    else if (enemyNumberForFaction1 === 2) c1.enemy3 = factionID2;
    if (c2.enemy1 === 0) c2.enemy1 = factionID1;
    else if (c2.enemy2 === 0) c2.enemy2 = factionID1;
    else if (c2.enemy3 === 0) c2.enemy3 = factionID1;
  });
}

/** EndFactionEnemies (:793-821). */
export function endFactionEnemies(dict, factionID1, factionID2) {
  return mutatePair(dict, factionID1, factionID2, (c1, c2) => {
    if (c1.enemy1 === factionID2) c1.enemy1 = 0;
    if (c1.enemy2 === factionID2) c1.enemy2 = 0;
    if (c1.enemy3 === factionID2) c1.enemy3 = 0;
    if (c2.enemy1 === factionID1) c2.enemy1 = 0;
    if (c2.enemy2 === factionID1) c2.enemy2 = 0;
    if (c2.enemy3 === factionID1) c2.enemy3 = 0;
  });
}

/** IsEnemyStatePermanentUntilWarOver (:838-849): are the two regions
 *  NEIGHBOURS? Eleven slots per region, and the padding zeros are
 *  compared like any other entry - so region 0 (Alik'r Desert) reads as
 *  a neighbour of every region whose row is short. DFU's, kept. */
export function isEnemyStatePermanentUntilWarOver(faction1, faction2) {
  if (!faction1 || !faction2) return false;
  if (faction1.region === -1 || faction2.region === -1) return false;
  for (let i = 0; i < BORDERS_PER_REGION; i++) {
    if (BORDER_REGIONS[(BORDERS_PER_REGION * faction1.region) + i] === faction2.region) return true;
  }
  return false;
}

/** IsFaction2APotentialWarEnemyOfFaction1 (:823-836): both Provinces
 *  with real regions, faction2 already an enemy of faction1, and the
 *  two regions bordering. */
export function isFaction2APotentialWarEnemyOfFaction1(dict, factionID1, factionID2) {
  const f1 = get(dict, factionID1); const f2 = get(dict, factionID2);
  if (!f1 || !f2) return false;
  return f1.region !== -1 && f1.type === FACTION_TYPES.Province
    && f2.region !== -1 && f2.type === FACTION_TYPES.Province
    && isFaction2AnEnemyOfFaction1(dict, factionID1, factionID2)
    && isEnemyStatePermanentUntilWarOver(f1, f2);
}

/** SetNewRulerData (:851-865). Two DFRandom draws in DFU's order: the
 *  power bonus first (random_range_inclusive(0, 50) + 20), then the
 *  name seed as `rand() | (rand() << 16)` - and note the SHIFTED half
 *  is drawn FIRST, because C# evaluates `random` on the line above. */
export function setNewRulerData(dict, factionID) {
  const f = get(dict, factionID);
  if (!f) return false;
  f.rulerPowerBonus = randomRangeInclusive(0, 50) + 20;
  const high = (rand() << 16) >>> 0;
  f.rulerNameSeed = (rand() | high) >>> 0;
  return true;
}

/** SetRulerType (:530-541). */
export function setRulerType(dict, factionID, ruler) {
  const f = get(dict, factionID);
  if (!f) return false;
  f.ruler = ruler;
  return true;
}
