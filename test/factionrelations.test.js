// S44 - PersistentFactionData's RELATION half
// (PersistentFactionData.cs:530-880): the ally/enemy/parent questions
// and the four mutators RegionPowerAndConditionsUpdate's conditions
// body runs on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BORDER_REGIONS, BORDERS_PER_REGION,
  getNumberOfCommonAlliesAndEnemies, isFaction2AnAllyOfFaction1, isFaction2AnEnemyOfFaction1,
  getFaction2RelationToFaction1, isFaction2RelatedToFaction1,
  startFactionAllies, endFactionAllies, startFactionEnemies, endFactionEnemies,
  isEnemyStatePermanentUntilWarOver, isFaction2APotentialWarEnemyOfFaction1,
  setNewRulerData, setRulerType,
} from '../src/systems/factionRelations.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';
import { srand } from '../src/formats/dfRandom.js';

const f = (o) => ({
  id: 1, parent: 0, type: FACTION_TYPES.Group, region: -1, ruler: 0,
  rulerPowerBonus: 0, rulerNameSeed: 0, power: 50,
  ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, ...o,
});
const D = (...fs) => new Map(fs.map((x) => [x.id, x]));

// ── the border table ────────────────────────────────────────────────

test('S44 borders: the table is 62 x 11 and matches the C# cell for cell', () => {
  assert.equal(BORDERS_PER_REGION, 11);
  assert.equal(BORDER_REGIONS.length, 62 * 11, 'PersistentFactionData.cs:52-113');
  // Spot the two ends against the C# literal, and pin that every cell
  // is a byte - the whole table was transcribed mechanically, and the
  // real guard against a bad cell is that extraction, not this test.
  assert.deepEqual(BORDER_REGIONS.slice(0, 11), [44, 45, 47, 21, 56, 48, 49, 2, 55, 12, 57], "Alik'r Desert");
  assert.deepEqual(BORDER_REGIONS.slice(11, 22), [1, 49, 55, 12, 54, 53, 52, 50, 23, 10, 0], 'Dragontail Mountains');
  for (const v of BORDER_REGIONS) assert.ok(Number.isInteger(v) && v >= 0 && v <= 255);
});

test('S44 borders: neighbours are symmetric only where DFU made them so, and PADDING ZEROS COMPARE', () => {
  // region 0 borders 44; region 44's row should mention 0 back
  const a = f({ id: 1, region: 0 }); const b = f({ id: 2, region: 44 });
  assert.equal(isEnemyStatePermanentUntilWarOver(a, b), true);
  // THE PADDING QUIRK: rows shorter than eleven are zero-padded, and the
  // loop compares those zeros like any other entry - so region 0 reads
  // as a neighbour of every short-rowed region. Dragontail's row ends
  // in a 0, so region 0 is "adjacent" to it whether or not it is.
  const dragon = f({ id: 3, region: 1 });
  const alikr = f({ id: 4, region: 0 });
  assert.equal(BORDER_REGIONS[11 * 1 + 10], 0, 'the row really is padded');
  assert.equal(isEnemyStatePermanentUntilWarOver(dragon, alikr), true,
    'the padding zero matches region 0 - DFU compares it, so this does');
  // region -1 is never a neighbour
  assert.equal(isEnemyStatePermanentUntilWarOver(f({ region: -1 }), a), false);
  assert.equal(isEnemyStatePermanentUntilWarOver(null, a), false);
});

// ── GetNumberOfCommonAlliesAndEnemies ───────────────────────────────

test('S44 common: THE ZERO QUIRK - two factions with no allies and no enemies score EIGHTEEN', () => {
  // The 3x3 comparison has no `!= 0` guard and an empty slot is 0, so
  // nine ally pairs and nine enemy pairs all match. The count feeds
  // `(powerSum + count * 3) / 5 + 70`, so eighteen moves that chance by
  // about ten points against nothing. DFU counts them; so does this.
  const d = D(f({ id: 1 }), f({ id: 2 }));
  assert.equal(getNumberOfCommonAlliesAndEnemies(d, 1, 2), 18);

  // One real shared ally, and the empty slots still count.
  const d2 = D(f({ id: 1, ally1: 9 }), f({ id: 2, ally1: 9 }));
  // allies: (9,9) match, (9,0)x2 no, (0,9)x2 no, (0,0)x4 match => 1 + 4 = 5
  // enemies: all zero => 9.  total 14
  assert.equal(getNumberOfCommonAlliesAndEnemies(d2, 1, 2), 14);

  assert.equal(getNumberOfCommonAlliesAndEnemies(d, 1, 999), 0, 'an unknown id scores nothing');
  assert.equal(getNumberOfCommonAlliesAndEnemies(null, 1, 2), 0);
});

// ── the one-directional questions ───────────────────────────────────

test('S44 ally/enemy: the lists are ONE-directional and may disagree', () => {
  const d = D(f({ id: 1, ally1: 2 }), f({ id: 2 }));
  assert.equal(isFaction2AnAllyOfFaction1(d, 1, 2), true);
  assert.equal(isFaction2AnAllyOfFaction1(d, 2, 1), false, 'faction 2 does not list faction 1');
  const e = D(f({ id: 1, enemy2: 2 }), f({ id: 2 }));
  assert.equal(isFaction2AnEnemyOfFaction1(e, 1, 2), true);
  assert.equal(isFaction2AnEnemyOfFaction1(e, 2, 1), false);
  assert.equal(isFaction2AnAllyOfFaction1(d, 1, 999), false, 'an unknown second id is not an ally');
});

// ── GetFaction2RelationToFaction1 ───────────────────────────────────

test('S44 relation: the four answers and the miss, with DFU\'s own 1/3/2 numbering', () => {
  //  root(9) -> mid(5) -> leaf(1),  and sibling(2) under mid
  const d = D(f({ id: 9 }), f({ id: 5, parent: 9 }), f({ id: 1, parent: 5 }), f({ id: 2, parent: 5 }));
  assert.equal(getFaction2RelationToFaction1(d, 1, 1), 0, 'same faction');
  assert.equal(getFaction2RelationToFaction1(d, 1, 5), 1, 'faction2 is an ancestor');
  assert.equal(getFaction2RelationToFaction1(d, 1, 9), 1, 'a further ancestor is still 1');
  assert.equal(getFaction2RelationToFaction1(d, 5, 1), 3, 'faction2 is a descendant');
  assert.equal(getFaction2RelationToFaction1(d, 1, 2), 2, 'siblings share an ancestor');
  const un = D(f({ id: 1 }), f({ id: 7 }));
  assert.equal(getFaction2RelationToFaction1(un, 1, 7), -1, 'two rootless strangers');
  assert.equal(getFaction2RelationToFaction1(d, 1, 404), -1, 'unknown id');
});

test('S44 relation: two PARENTLESS factions are not "sharing an ancestor" with each other', () => {
  // The `factionData1.id != factionID1` guard: a faction whose walk
  // never moved is its own root, and two of those would otherwise
  // compare equal to themselves and answer 2 for every pair.
  const d = D(f({ id: 1 }), f({ id: 2 }));
  assert.equal(getFaction2RelationToFaction1(d, 1, 2), -1);
  // and one with a parent against one without
  const d2 = D(f({ id: 1, parent: 9 }), f({ id: 9 }), f({ id: 2 }));
  assert.equal(getFaction2RelationToFaction1(d2, 1, 2), -1);

  // RECORDED EQUIVALENT: dropping the two `id !=` clauses from that arm
  // survives every pin here, and it is genuinely unreachable rather
  // than merely untested. The arm needs `f1.id === f2.id`. If f1 never
  // moved then f1.id is factionID1, so f2's walk would have had to
  // reach factionID1 - and it cannot, because the step that would take
  // it there tests `f2.parent === factionID1` and returns 3 first. The
  // mirror argument covers f2. So the guard only ever blocks a case the
  // earlier arms have already answered. Ported because it is in the C#.
});

test('S44 related: the recursive walk climbs faction1\'s parents - and it used to be a hardcoded false', () => {
  // world.js answered `false` for this from the talk arc onward, so
  // answerPipeline's faction-relation gate never fired.
  const d = D(f({ id: 1, parent: 5 }), f({ id: 5, ally1: 7 }), f({ id: 7 }));
  assert.equal(isFaction2AnAllyOfFaction1(d, 1, 7), false, 'faction 1 itself does not list 7');
  assert.equal(isFaction2RelatedToFaction1(d, 1, 7), true, 'but its PARENT does, and the walk finds it');
  const un = D(f({ id: 1 }), f({ id: 8 }));
  assert.equal(isFaction2RelatedToFaction1(un, 1, 8), false);
});

// ── the four mutators ───────────────────────────────────────────────

test('S44 startAllies: ASYMMETRIC - an INDEX for faction1, first free slot for faction2', () => {
  const a = f({ id: 1, ally2: 77 }); const b = f({ id: 2, ally1: 88 });
  const d = D(a, b);
  assert.equal(startFactionAllies(d, 1, 1, 2), true);
  assert.equal(a.ally2, 2, "faction1's slot is OVERWRITTEN at the index given - 77 is gone");
  assert.equal(b.ally2, 1, "faction2 took its first FREE slot, not an index");
  assert.equal(b.ally1, 88, 'and its occupied slot is untouched');

  // faction2 with no room gains nothing, and the call still answers true
  const full = f({ id: 3, ally1: 4, ally2: 5, ally3: 6 });
  const d2 = D(f({ id: 1 }), full);
  assert.equal(startFactionAllies(d2, 1, 0, 3), true, 'DFU returns true regardless');
  assert.deepEqual([full.ally1, full.ally2, full.ally3], [4, 5, 6], 'no room, no entry');

  assert.equal(startFactionAllies(d2, 1, 0, 999), false, 'an unknown id is the only false');
});

test('S44 startAllies: a SELF call lands DFU\'s struct write-back order, not an in-place merge', () => {
  // C# reads two copies of the same struct and writes both back, so the
  // SECOND assignment wins and the first mutation is lost. The port
  // holds objects, so a naive in-place version would keep both.
  const solo = f({ id: 1 });
  const d = D(solo);
  startFactionAllies(d, 1, 0, 1);
  // copy1 set ally1 = 1; copy2 (also blank at read time) set ally1 = 1
  // too - both agree here, so use an index that separates them:
  const solo2 = f({ id: 1 });
  const d2 = D(solo2);
  startFactionAllies(d2, 1, 2, 1);
  // copy1: ally3 = 1.  copy2: first free is ally1, so ally1 = 1.
  // write-back order means copy2 wins whole: ally1 = 1, ally3 = 0.
  assert.deepEqual([solo2.ally1, solo2.ally2, solo2.ally3], [1, 0, 0],
    "the second write-back clobbers the first, exactly as C#'s struct copies do");
});

test('S44 endAllies: symmetric, and EVERY matching slot clears (three ifs, not else-ifs)', () => {
  const a = f({ id: 1, ally1: 2, ally2: 9, ally3: 2 });   // listed twice
  const b = f({ id: 2, ally2: 1 });
  const d = D(a, b);
  assert.equal(endFactionAllies(d, 1, 2), true);
  assert.deepEqual([a.ally1, a.ally2, a.ally3], [0, 9, 0], 'both copies of 2 cleared, 9 untouched');
  assert.equal(b.ally2, 0, 'and the other side too');
  assert.equal(endFactionAllies(d, 1, 404), false);
});

test('S44 enemies: the two enemy mutators are the exact twins of the ally pair', () => {
  const a = f({ id: 1, enemy2: 77 }); const b = f({ id: 2, enemy1: 88 });
  const d = D(a, b);
  startFactionEnemies(d, 1, 1, 2);
  assert.equal(a.enemy2, 2);
  assert.equal(b.enemy2, 1);
  endFactionEnemies(d, 1, 2);
  assert.deepEqual([a.enemy1, a.enemy2, a.enemy3], [0, 0, 0]);
  assert.deepEqual([b.enemy1, b.enemy2, b.enemy3], [88, 0, 0]);
});

// ── the war predicate ───────────────────────────────────────────────

test('S44 war: all four terms are required - two bordering PROVINCES that are already enemies', () => {
  const mk = (o1, o2) => {
    const a = f({ id: 1, type: FACTION_TYPES.Province, region: 0, enemy1: 2, ...o1 });
    const b = f({ id: 2, type: FACTION_TYPES.Province, region: 44, ...o2 });
    return { d: D(a, b), a, b };
  };
  assert.equal(isFaction2APotentialWarEnemyOfFaction1(mk().d, 1, 2), true);
  assert.equal(isFaction2APotentialWarEnemyOfFaction1(mk({ type: FACTION_TYPES.Group }).d, 1, 2), false, 'faction1 not a Province');
  assert.equal(isFaction2APotentialWarEnemyOfFaction1(mk({}, { type: FACTION_TYPES.Group }).d, 1, 2), false, 'faction2 not a Province');
  assert.equal(isFaction2APotentialWarEnemyOfFaction1(mk({ enemy1: 0 }).d, 1, 2), false, 'not already an enemy');
  assert.equal(isFaction2APotentialWarEnemyOfFaction1(mk({}, { region: 30 }).d, 1, 2), false, 'regions do not border');
  assert.equal(isFaction2APotentialWarEnemyOfFaction1(mk({ region: -1 }).d, 1, 2), false, 'no region');
});

// ── the ruler members ───────────────────────────────────────────────

test('S44 ruler: SetNewRulerData draws the bonus then the seed, in DFU\'s order', () => {
  const target = f({ id: 1 });
  const d = D(target);
  srand(12345);
  assert.equal(setNewRulerData(d, 1), true);
  // EXACT values off a pinned DFRandom seed, not a range: `bonus >= 20
  // && bonus <= 70` cannot see the `+ 20` go missing (0..50 lands
  // inside it), and comparing a run against itself cannot see the two
  // rand() draws swap. Both mutations survived that first draft.
  assert.equal(target.rulerPowerBonus, 68, 'random_range_inclusive(0, 50) + 20, drawn FIRST');
  assert.equal(target.rulerNameSeed, 654595685,
    'rand() | (rand() << 16) - and the SHIFTED half is drawn first, because C# evaluates `random` on the line above');
  // deterministic off the same seed
  const again = f({ id: 1 }); srand(12345);
  setNewRulerData(D(again), 1);
  assert.equal(again.rulerPowerBonus, 68);
  assert.equal(again.rulerNameSeed, 654595685, 'same seed, same ruler');
  assert.equal(setNewRulerData(d, 404), false);
});

test('S44 ruler: SetRulerType writes the field and answers false for an unknown id', () => {
  const target = f({ id: 1 });
  const d = D(target);
  assert.equal(setRulerType(d, 1, 7), true);
  assert.equal(target.ruler, 7);
  assert.equal(setRulerType(d, 404, 7), false);
});
