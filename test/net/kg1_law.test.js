// KG1 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 2, 4 and 11): THE KING'S GAMBIT'S LAW
// (net/kingsGambit.js), pinned against the mod's own numbers - TheKingsGambit.dll's fields, the record's tables - and
// driven: the roster off DFU's EnemyBasics (every row, Unity's half to even), the army's law and Auto-fill on a scripted
// source, the board's four layouts, its retry and the Open field from scripted draws, the 97% at float32, the
// deployment's order, the turn's legality (GetReachable's walk, InRange, HasLineOfSight's samples), a blow's roll, the
// potions, the turn's end (hazards, the round, the tick, the warning pairs, MaxHazards), the end of a game, every step's
// new state, and hundreds of whole games between two greedy players.
//
// THE SCRIPTED DRAWS. The law's Rand(a, b) is a + drawBelow(b - a), and drawBelow answers its draw modulo b - a. Every
// scripted draw below is the value wanted PLUS 1009 times the modulus (R), so the script answers the law's value under
// the law's own bound and a different one under any bound a mutant might write - a range is pinned, not only its value.
// 1009 is a prime: a thousand was not, and a bound mutated to 4 or 5 divided its offset away (three survivors). One
// bound still reads the value alike - a divisor of the law's own modulus, for a value under that divisor (AUDIT KG A11:
// the moat's Rand(2, 6) read as Rand(2, 4) at its bridge 3) - so each such range is drawn at a value past its divisors too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../../src/net/kingsGambit.js';

/** The raw draw that Rand(a, b) answers `v` with - under drawBelow's modulus b - a, and under no other modulus below 1009
 *  but a divisor of b - a, for a `v - a` under that divisor (the offset is a prime multiple of the modulus). */
const R = (v, a, b) => (v - a) + 1009 * (b - a);
/** A source that answers `xs` in turn and throws when it runs dry. */
const script = (xs) => { let i = 0; const f = () => { if (i >= xs.length) throw new Error(`script ran dry at ${i}`); return xs[i++]; }; f.left = () => xs.length - i; return f; };
/** A xorshift32 source, for the whole games. */
const xorshift = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; }; };
/** Random.value's raw draw for a [0, 1) value. */
const V = (x) => Math.floor(x * 2 ** 32);
/** A board as text, a row a line: '.' floor, '#' wall, 'o' pillar, '~' water. */
const picture = (tiles) => Array.from({ length: K.KG_ROWS }, (_, r) => Array.from({ length: K.KG_COLS }, (_, c) => '.#o~'[tiles[K.cellIndex(c, r)]]).join(''));
/** A hazard pair's draws: its cell, then (laid) its kind. */
const pair = (c, r, kind) => [R(c, 0, 15), R(r, 3, 10), R(K.KG_HAZARD_KINDS.indexOf(kind), 0, 3)];
/** A try that misses: a cell refused, no kind drawn. */
const miss = (c, r) => [R(c, 0, 15), R(r, 3, 10)];
/** A chunk's draws. */
const chunk = (c, r, shape) => [R(c, 1, 14), R(r, 3, 7), R(shape, 0, 5)];

/** THE PILLARED HALL a script lays: two chunks (a wall pair, and a row's three-wide with its far end off the zone's
 *  columns), three hazard pairs - the second after the centre and a pillar refused, the third after a taken cell and a
 *  wall. */
const PILLARED = [R(0, 0, 4), ...chunk(2, 4, 1), ...chunk(13, 6, 4),
  ...pair(0, 3, 'fire'), ...miss(7, 6), ...miss(1, 3), ...pair(5, 4, 'poison'), ...miss(0, 3), ...miss(2, 4), ...pair(6, 9, 'spikes')];
const PILLARED_PICTURE = [
  '...............',
  '...............',
  '...............',
  '.o..o..o..o..o.',
  '..##...........',
  '.o..o..o..o..o.',
  '.##.........##.',
  '.o..o..o..o..o.',
  '...........##..',
  '.o..o..o..o..o.',
  '...............',
  '...............',
  '...............',
];
const PILLARED_HAZARDS = [
  { col: 0, row: 3, kind: 'fire', active: true }, { col: 14, row: 9, kind: 'fire', active: true },
  { col: 5, row: 4, kind: 'poison', active: true }, { col: 9, row: 8, kind: 'poison', active: true },
  { col: 6, row: 9, kind: 'spikes', active: true }, { col: 8, row: 3, kind: 'spikes', active: true },
];
/** A GUARD ROOMS try that seals itself: both doorways a chunk closes leave the head's king cell unreachable. */
const SEALED = [R(1, 0, 4), R(2, 1, 4), ...chunk(2, 5, 0), ...chunk(7, 5, 0), ...pair(0, 3, 'fire'), ...pair(3, 4, 'spikes'), ...pair(0, 8, 'poison')];

/** The record's section 2.2 table: [id, name, level, hp, attack, cost, ranged], the roster's own order. */
const ROSTER = [
  [0, 'Rat', 1, 12, 2, 6, false], [1, 'Imp', 2, 14, 4, 7, false], [3, 'Giant Bat', 3, 19, 6, 11, false],
  [2, 'Spriggan', 3, 19, 6, 11, false], [4, 'Grizzly Bear', 4, 23, 8, 14, false], [5, 'Sabretooth Tiger', 4, 23, 8, 14, false],
  [6, 'Spider', 4, 23, 8, 14, false], [7, 'Orc', 5, 23, 10, 15, false], [8, 'Centaur', 5, 30, 10, 17, false],
  [10, 'Nymph', 6, 32, 12, 20, false], [12, 'Orc Sergeant', 7, 32, 14, 21, false], [11, 'Slaughterfish', 7, 32, 14, 21, false],
  [141, 'Archer', 6, 30, 9, 22, true], [128, 'Mage', 6, 30, 9, 22, true], [142, 'Ranger', 6, 30, 9, 22, true],
  [131, 'Sorcerer', 6, 30, 9, 22, true], [9, 'Werewolf', 6, 41, 12, 22, false], [14, 'Wereboar', 8, 41, 16, 26, false],
  [41, 'Dreugh', 16, 23, 32, 27, false], [15, 'Skeletal Warrior', 9, 41, 18, 27, false], [13, 'Harpy', 8, 50, 16, 28, false],
  [34, 'Dragonling', 16, 28, 32, 30, false], [40, 'Dragonling', 16, 28, 32, 30, false], [18, 'Ghost', 11, 41, 22, 30, false],
  [16, 'Giant', 10, 46, 20, 30, false], [19, 'Mummy', 11, 41, 22, 30, false], [20, 'Giant Scorpion', 12, 46, 24, 33, false],
  [42, 'Lamia', 16, 37, 32, 34, false], [17, 'Zombie', 10, 59, 20, 34, false], [21, 'Orc Shaman', 13, 46, 26, 35, false],
  [22, 'Gargoyle', 14, 50, 28, 37, false], [24, 'Orc Warlord', 16, 55, 32, 42, false], [23, 'Wraith', 15, 60, 30, 42, false],
  [35, 'Fire Atronach', 16, 77, 32, 50, false], [37, 'Flesh Atronach', 16, 77, 32, 50, false], [38, 'Ice Atronach', 16, 77, 32, 50, false],
  [36, 'Iron Atronach', 16, 77, 32, 50, false], [25, 'Frost Daedra', 17, 77, 34, 51, false], [26, 'Fire Daedra', 17, 82, 34, 53, false],
  [27, 'Daedroth', 18, 86, 36, 56, false], [29, 'Daedra Seducer', 19, 86, 38, 57, false], [28, 'Vampire', 19, 91, 38, 59, false],
  [30, 'Ancient Vampire', 20, 100, 40, 63, false], [32, 'Lich', 20, 100, 40, 63, false], [33, 'Ancient Lich', 21, 100, 42, 65, false],
  [31, 'Daedra Lord', 20, 122, 40, 70, false],
];

/** A game on the scripted Pillared hall, its armies `host` and `guest`. */
function game(host, guest, opts = {}) {
  const st = K.newGambit({ armies: [host, guest], rand32: script(PILLARED), ...opts });
  assert.ok(st, 'the scripted game deals');
  return st;
}
/** The same game with every cell floor and no hazard - the board a piece's walk and reach are read on. */
function open(host, guest, opts) {
  const st = game(host, guest, opts);
  st.tiles.fill(K.KG_TILE.floor);
  st.hazards = [];
  return st;
}
/** A piece stood on (c, r) - the producer's own piece, moved as a test's fixture. */
function standAt(st, id, c, r) { const p = K.pieceById(st, id); p.col = c; p.row = r; return p; }
/** Act, and answer the next state (asserting the law took it). */
function act(st, side, cmd, rand32) {
  const out = K.gambitAct(st, side, cmd, rand32);
  assert.ok(out.state, `refused ${out.refused} for ${JSON.stringify(cmd)}`);
  return out;
}

test('KG1 THE MOD\'S NUMBERS: the board, the hazards, the army, the units, the turn - TheKingsGambit.dll\'s fields', () => {
  assert.deepEqual([K.KG_COLS, K.KG_ROWS, K.KG_ZONE_TOP, K.KG_ZONE_BOTTOM], [15, 13, 3, 9]);
  assert.deepEqual(K.KG_TILE, { floor: 0, wall: 1, pillar: 2, water: 3 });
  assert.deepEqual(K.KG_KING_CELL, [7, 12]);
  assert.deepEqual(K.KG_HAZARD_KINDS, ['fire', 'spikes', 'poison']);
  assert.deepEqual(K.KG_HAZARD_DAMAGE, { fire: 8, spikes: 6, poison: 5 });
  assert.deepEqual([K.KG_HAZARD_PAIRS_AT_START, K.KG_HAZARD_SPAWN_EVERY, K.KG_MAX_HAZARDS, K.KG_HAZARD_TRIES], [3, 2, 14, 40]);
  assert.deepEqual([K.KG_MAP_TRIES, K.KG_PLAYABLE_SHARE, K.KG_UNREACHABLE], [30, 0.97, 9999]);
  assert.deepEqual([K.KG_POINT_BUDGET, K.KG_MAX_UNITS, K.KG_MIN_COST, K.KG_COST_SCALE, K.KG_RANGED_COST_FACTOR], [300, 12, 6, 1, 1.35]);
  assert.deepEqual([K.KG_DAMAGE_PER_LEVEL, K.KG_RANGED_DAMAGE_FACTOR], [2, 0.75]);
  assert.deepEqual([K.KG_KING_LEVEL, K.KG_KING_HP, K.KG_CLASS_LEVEL, K.KG_CLASS_HP], [8, 70, 6, 30]);
  assert.deepEqual(K.KG_RANGED_CLASSES, [128, 131, 141, 142]);
  assert.deepEqual(K.KG_KING_CLASSES, [145, 143]);
  assert.deepEqual([K.KG_ACTIONS_PER_TURN, K.KG_POTIONS_PER_SIDE, K.KG_POTION_HEAL], [2, 3, 30]);
  assert.deepEqual([K.KG_MOVE_RANGE, K.KG_RANGED_RANGE, K.KG_SIGHT_SAMPLES], [3, 4, 4]);
  assert.deepEqual([K.KG_BLOW_LOW, K.KG_BLOW_SPREAD], [0.8, 0.4]);
  assert.deepEqual([K.KG_AUTOFILL_ROUNDS, K.KG_AUTOFILL_RANGED, K.KG_AUTOFILL_LEAN], [200, 2, 0.5]);
  assert.deepEqual(K.KG_CENTER_OUT, [7, 6, 8, 5, 9, 4, 10, 3, 11, 2, 12, 1, 13, 0, 14]);
  assert.deepEqual(K.KG_COMMANDS, ['move', 'attack', 'potion', 'end']);
  // and the port's own bounds on what a caller may hand the law: the potions, the budget, the draws a step may take
  assert.deepEqual([K.KG_POTIONS_MAX, K.KG_BUDGET_MAX, K.KG_RAND_DRAWS_MAX], [9, 10_000, 100_000]);
  // the mod's names (Pillared hall, Guard rooms, Ruined keep, Moat and bridges, Open field) are the client's to say
  assert.deepEqual(K.KG_LAYOUTS, [
    { key: 'pillared-hall', floor: [[0.27, 0.27, 0.3], [0.36, 0.36, 0.4]] },
    { key: 'guard-rooms', floor: [[0.3, 0.23, 0.17], [0.4, 0.31, 0.22]] },
    { key: 'ruined-keep', floor: [[0.24, 0.29, 0.2], [0.32, 0.38, 0.26]] },
    { key: 'moat-and-bridges', floor: [[0.4, 0.35, 0.24], [0.49, 0.43, 0.3]] },
  ]);
  assert.deepEqual(K.KG_OPEN_FIELD, { key: 'open-field', floor: [[0.24, 0.29, 0.2], [0.32, 0.38, 0.26]] });
});

test('KG1 THE ROSTER is DFU\'s table through MakeUnit: the record\'s 46 rows in the mod\'s order, the kings, Unity\'s half to even', () => {
  assert.deepEqual(K.KG_ROSTER.map((u) => [u.id, u.name, u.level, u.hp, u.atk, u.cost, u.ranged]), ROSTER);
  assert.ok(K.KG_ROSTER.every((u) => u.king === false && Object.isFrozen(u)));
  assert.deepEqual(K.KG_KINGS, [
    { id: 145, name: 'Knight', level: 8, hp: 70, atk: 16, cost: 0, ranged: false, king: true },
    { id: 143, name: 'Barbarian', level: 8, hp: 70, atk: 16, cost: 0, ranged: false, king: true },
  ]);
  // no Horse (no texture), no City Watch nor any calling outside RangedClasses, no king among the recruits
  for (const id of [39, 146, 129, 133, 143, 144, 145]) assert.equal(K.rosterUnit(id), null, `${id} is no recruit`);
  assert.equal(K.rosterUnit(31).name, 'Daedra Lord');
  assert.equal(K.makeUnit(39), null, 'the Horse\'s row holds no numbers');
  assert.equal(K.makeUnit(9999), null);
  assert.equal(K.makeUnit(1.5), null);
  // RoundToInt (systems/mathf.js) rounds a half to even - the vanilla rows meet no half, a ranged monster of an odd level does
  assert.deepEqual(K.makeUnit(3, { ranged: true }), { id: 3, name: 'Giant Bat', level: 3, hp: 19, atk: 4, cost: 12, ranged: true, king: false });
  assert.equal(K.makeUnit(12, { ranged: true }).atk, 10, '7 x 2 x 0.75 = 10.5 rounds to the even 10');
  assert.equal(K.makeUnit(146).level, 6, 'a calling\'s level is ClassLevel');
});

test('KG1 THE ARMY\'S LAW: its cost, its refusals, a recruit\'s room - ParseArmy and TryAdd', () => {
  assert.equal(K.armyCost([0, 128, 33]), 6 + 22 + 65);
  assert.equal(K.armyCost([]), 0);
  assert.equal(K.armyRefusal(null), 'shape');
  assert.equal(K.armyRefusal([0, 1.5]), 'shape');
  // eslint-disable-next-line no-sparse-arrays
  assert.equal(K.armyRefusal([0, , 1]), 'shape', 'a hole is no integer (AUDIT KG A3: every() stepped over it)');
  assert.equal(K.armyRefusal([]), 'empty');
  assert.equal(K.armyRefusal(new Array(13).fill(0)), 'units');
  assert.equal(K.armyRefusal(new Array(12).fill(0)), null, 'twelve is the most');
  assert.equal(K.armyRefusal([0, 39]), 'unit');
  assert.equal(K.armyRefusal([143]), 'unit', 'a king is never recruited');
  assert.equal(K.armyRefusal([31, 31, 31, 31, 31]), 'points', '350 is past 300');
  assert.equal(K.armyRefusal([31, 31, 31, 31, 31], 450), null, 'a Grandmaster\'s 450');
  assert.equal(K.armyRefusal([31, 31, 31, 31, 10]), null, 'exactly 300');
  assert.equal(K.armyRefusal([31, 31, 31, 31, 10, 0]), 'points', '306');
  const eleven = new Array(11).fill(0);
  assert.equal(K.canRecruit(eleven, 0), true);
  assert.equal(K.canRecruit([...eleven, 0], 0), false, 'twelve hold no room');
  assert.equal(K.canRecruit([31, 31, 31, 31], 128), false, '280 + 22 is past 300');
  assert.equal(K.canRecruit([31, 31, 31, 31], 1), true, '280 + 7');
  assert.equal(K.canRecruit([31, 31, 31, 31], 13), false, '280 + 28 is past 300');
  assert.equal(K.canRecruit([31, 31, 31, 31], 13, 308), true);
  assert.equal(K.canRecruit([], 39), false);
});

test('KG1 AUTO-FILL on a scripted source: the lean to ranged one time in two, two draws and the dearer kept, the points spent', () => {
  const roster = (id) => K.KG_ROSTER.findIndex((u) => u.id === id);
  const draws = script([
    0, R(1, 0, 4), R(2, 0, 4),                         // no ranged yet, 0 < 0.5 leans: the Mage and the Ranger, a tie keeps the first
    V(0.5), R(roster(31), 0, 46), R(roster(0), 0, 46),   // 0.5 does not lean: the Daedra Lord over the Rat
    0xFFFFFFFF, R(roster(12), 0, 46), R(roster(33), 0, 46), // the Ancient Lich is dearer than the Orc Sergeant
    V(0.45), R(0, 0, 4), R(3, 0, 4),                     // 0.45 leans: the Archer and the Sorcerer tie, the first kept
    R(roster(13), 0, 46), R(roster(5), 0, 46),           // two ranged held - no lean drawn at all
    R(roster(31), 0, 46), R(roster(31), 0, 46),          // the Daedra Lord twice
    R(roster(9), 0, 17), R(roster(0), 0, 17),            // 23 left: seventeen units, the Werewolf
  ]);
  assert.deepEqual(K.autoFill([], 300, draws), [128, 31, 33, 141, 13, 31, 9]);
  assert.equal(draws.left(), 0, 'one point left buys nothing - no draw past it');
  // an army already over its budget draws nothing and buys nothing; a full one is kept as it is
  assert.deepEqual(K.autoFill([31, 31, 31, 31, 31], 300, script([])), [31, 31, 31, 31, 31]);
  const twelve = new Array(12).fill(0);
  assert.deepEqual(K.autoFill(twelve, 300, script([])), twelve);
  assert.notEqual(K.autoFill(twelve, 300, script([])), twelve, 'a new list');
  // THE LEAN IS RANDOM.VALUE AT FLOAT32 against the C#'s 0.5f (AUDIT KG A1): raw 2147483583 is under it and leans - 22
  // points buy one of the four ranged callings, the Mage the second - and 2147483584 rounds up to 0.5f and does not: any
  // of the seventeen units 22 buys, the Centaur the ninth
  assert.deepEqual(K.autoFill([], 22, script([2147483583, R(1, 0, 4), R(1, 0, 4)])), [128]);
  assert.deepEqual(K.autoFill([], 22, script([2147483584, R(8, 0, 17), R(8, 0, 17)])), [8]);
  // A SOURCE THAT IS NO SOURCE fills nothing (AUDIT KG A2): a draw that is no 32-bit draw, one that runs dry, and one
  // stuck where drawBelow throws every draw back - refused at the law's bound, not spun for ever
  assert.equal(K.autoFill([], 300, () => 1.5), null);
  assert.equal(K.autoFill([], 300, script([0])), null);
  let stuck = 0;
  assert.equal(K.autoFill([], 300, () => { stuck++; return 0xFFFFFFFF; }), null);
  assert.ok(stuck <= K.KG_RAND_DRAWS_MAX + 1, 'refused at the bound');
  // a real source: always lawful, at most the budget
  const rnd = xorshift(7);
  for (let i = 0; i < 400; i++) {
    const budget = [220, 300, 360, 450][i % 4];
    const army = K.autoFill([], budget, rnd);
    assert.equal(K.armyRefusal(army, budget), null);
    assert.ok(budget - K.armyCost(army) < K.KG_MIN_COST || army.length === K.KG_MAX_UNITS, 'it stops only when nothing fits or the army is full');
  }
});

test('KG1 THE BOARD: the Pillared hall from scripted draws - its pillars, two chunks (one end off the columns), three pairs after five misses', () => {
  const src = script(PILLARED);
  const map = K.buildMap(src);
  assert.equal(map.layout, 'pillared-hall');
  assert.deepEqual(picture(map.tiles), PILLARED_PICTURE);
  assert.deepEqual(map.hazards, PILLARED_HAZARDS);
  assert.equal(src.left(), 0, 'every draw the mod takes, and no more');
});

test('KG1 THE BOARD: Guard rooms sealed by its chunks is thrown away; the Moat and bridges after it, its chunks refused on water', () => {
  const src = script([...SEALED,
    R(3, 0, 4), R(3, 2, 6), ...chunk(4, 3, 2), ...chunk(10, 5, 3), ...chunk(6, 6, 0),
    ...pair(0, 3, 'fire'), ...miss(0, 6), ...pair(5, 4, 'spikes'), ...pair(13, 5, 'poison')]);   // (0, 6) is water: no hazard (AUDIT KG A8)
  const map = K.buildMap(src);
  assert.equal(map.layout, 'moat-and-bridges');
  assert.deepEqual(picture(map.tiles), [
    '...............',
    '...............',
    '...............',
    '....#..........',
    '....#..........',
    '..........##...',
    '~~~.~~~.~~~.~~~',
    '...##..........',
    '..........#....',
    '..........#....',
    '...............',
    '...............',
    '...............',
  ]);
  assert.deepEqual(map.hazards.map((h) => [h.col, h.row, h.kind]), [[0, 3, 'fire'], [14, 9, 'fire'], [5, 4, 'spikes'], [9, 8, 'spikes'], [13, 5, 'poison'], [1, 7, 'poison']]);
  assert.equal(src.left(), 0, 'the sealed try drew its whole build before it was thrown away');
  // a moat bridged at 4 - past 2, the one divisor of its range's modulus (AUDIT KG A11)
  const moat4 = K.buildMap(script([R(3, 0, 4), R(4, 2, 6), ...chunk(1, 3, 0), ...chunk(1, 3, 0), ...chunk(1, 3, 0),
    ...pair(0, 3, 'fire'), ...pair(5, 4, 'spikes'), ...pair(13, 5, 'poison')]));
  assert.equal(moat4.layout, 'moat-and-bridges');
  assert.equal(picture(moat4.tiles)[6], '~~~~.~~.~~.~~~~');
});

test('KG1 THE BOARD: a Guard rooms kept, a Ruined keep\'s every chunk shape, thirty failures lay the Open field', () => {
  const guard = K.buildMap(script([R(1, 0, 4), R(1, 1, 4), ...chunk(4, 3, 0), ...chunk(9, 4, 0), ...pair(0, 3, 'fire'), ...pair(3, 4, 'spikes'), ...pair(0, 8, 'poison')]));
  assert.equal(guard.layout, 'guard-rooms');
  assert.deepEqual(picture(guard.tiles), [
    '...............',
    '...............',
    '...............',
    '....#..........',
    '.........#.....',
    '#.#####.#####.#',
    '.....#...#.....',
    '#.#####.#####.#',
    '.....#.........',
    '..........#....',
    '...............',
    '...............',
    '...............',
  ]);
  // every shape of a chunk, one refused at the zone's last column, one on a wall already there, one at the first column
  const keep = K.buildMap(script([R(2, 0, 4),
    ...chunk(2, 3, 0), ...chunk(4, 3, 1), ...chunk(7, 4, 2), ...chunk(10, 3, 3), ...chunk(2, 6, 4),
    ...chunk(13, 4, 1), ...chunk(4, 3, 0), ...chunk(1, 5, 4),
    ...pair(0, 3, 'fire'), ...pair(14, 8, 'spikes'), ...pair(6, 3, 'poison')]));
  assert.equal(keep.layout, 'ruined-keep');
  assert.deepEqual(picture(keep.tiles), [
    '...............',
    '...............',
    '...............',
    '..#.##....##...',
    '.......#..#..#.',
    '.##....#.......',
    '.###.......###.',
    '.......#....##.',
    '.#..#..#.......',
    '...##....##.#..',
    '...............',
    '...............',
    '...............',
  ]);
  // thirty sealed tries: the Open field, its own three pairs
  const src = script([...Array(30).fill(SEALED).flat(), ...pair(2, 3, 'spikes'), ...pair(4, 5, 'fire'), ...pair(7, 3, 'poison')]);
  const field = K.buildMap(src);
  assert.equal(field.layout, 'open-field');
  assert.ok(field.tiles.every((t) => t === K.KG_TILE.floor));
  assert.deepEqual(field.hazards.map((h) => [h.col, h.row, h.kind, h.active]), [[2, 3, 'spikes', true], [12, 9, 'spikes', true], [4, 5, 'fire', true], [10, 7, 'fire', true], [7, 3, 'poison', true], [7, 9, 'poison', true]]);
  assert.equal(src.left(), 0);
  // and dealt: the thirty failures' 519 draws are a lawful game's, well inside the law's bound on a step's draws
  const dealt = K.newGambit({ armies: [[0], [0]], rand32: script([...Array(30).fill(SEALED).flat(), ...pair(2, 3, 'spikes'), ...pair(4, 5, 'fire'), ...pair(7, 3, 'poison')]) });
  assert.equal(dealt?.layout, 'open-field');
});

test('KG1 MapIsPlayable: the head\'s king cell reached, and 97% of the floor at float32 - a pocket board either side of it', () => {
  /** n walled single-cell pockets of floor in rows 3-5, from column 0: 5n + 3 walls, n cells nobody reaches. */
  const pockets = (n) => {
    const t = Array(K.KG_COLS * K.KG_ROWS).fill(K.KG_TILE.floor);
    for (let c = 0; c <= 2 * n; c++) { t[K.cellIndex(c, 3)] = K.KG_TILE.wall; t[K.cellIndex(c, 5)] = K.KG_TILE.wall; if (c % 2 === 0) t[K.cellIndex(c, 4)] = K.KG_TILE.wall; }
    return t;
  };
  // five pockets: 167 floor, 162 reached - 0.97006, playable; six: 162 floor, 156 reached - 0.96296, not
  assert.equal(pockets(5).filter((x) => x === K.KG_TILE.floor).length, 167);
  assert.equal(K.mapIsPlayable(pockets(5)), true);
  assert.equal(K.mapIsPlayable(pockets(6)), false);
  assert.equal(K.mapIsPlayable(Array(K.KG_COLS * K.KG_ROWS).fill(K.KG_TILE.floor)), true);
  const cut = Array(K.KG_COLS * K.KG_ROWS).fill(K.KG_TILE.floor);
  for (let c = 0; c < K.KG_COLS; c++) cut[K.cellIndex(c, 6)] = K.KG_TILE.water;
  assert.equal(K.mapIsPlayable(cut), false, 'the head unreached');
  const walled = Array(K.KG_COLS * K.KG_ROWS).fill(K.KG_TILE.floor);
  for (const [c, r] of [[6, 0], [8, 0], [7, 1]]) walled[K.cellIndex(c, r)] = K.KG_TILE.wall;
  assert.equal(K.mapIsPlayable(walled), false, 'the head\'s king cell walled off - though 191 of 192 floor cells are reached');
  // PathMap: steps over floor, water and walls no way, a start off the board reaching nothing
  const d = K.pathMap(cut, 7, 12);
  assert.deepEqual([d[K.cellIndex(7, 12)], d[K.cellIndex(7, 7)], d[K.cellIndex(0, 7)], d[K.cellIndex(7, 5)]], [0, 5, 12, K.KG_UNREACHABLE]);
  assert.ok(K.pathMap(cut, -1, 0).every((x) => x === K.KG_UNREACHABLE));
});

test('KG1 THE DEPLOYMENT: the king on (7, 12), the dearest first, melee into row 11 and ranged into row 12 centre-out, the guest mirrored', () => {
  const st = game([0, 128, 33, 141, 9, 0], [31]);
  assert.deepEqual(st.pieces.map((p) => [p.id, p.side, p.unit, p.king, p.col, p.row]), [
    [0, 0, 145, true, 7, 12], [1, 0, 33, false, 7, 11], [2, 0, 9, false, 6, 11], [3, 0, 128, false, 6, 12],
    [4, 0, 141, false, 8, 12], [5, 0, 0, false, 8, 11], [6, 0, 0, false, 5, 11],
    [7, 1, 143, true, 7, 0], [8, 1, 31, false, 7, 1],
  ]);
  const lich = K.pieceById(st, 1);
  assert.deepEqual([lich.level, lich.hp, lich.maxHp, lich.atk, lich.ranged], [21, 100, 100, 42, false]);
  // twelve of a kind fill one row - the mod's fallback rows never fill
  const full = game(new Array(12).fill(0), new Array(12).fill(141));
  assert.deepEqual(full.pieces.filter((p) => p.side === 0 && !p.king).map((p) => [p.col, p.row]), [7, 6, 8, 5, 9, 4, 10, 3, 11, 2, 12, 1].map((c) => [c, 11]));
  assert.deepEqual(full.pieces.filter((p) => p.side === 1 && !p.king).map((p) => [p.col, p.row]), [8, 6, 9, 5, 10, 4, 11, 3, 12, 2, 13, 1].map((c) => [c, 0]));
  assert.deepEqual([st.turn, st.actions, st.round, st.potions, st.ending, st.over, st.layout], [0, 2, 1, [3, 3], false, null, 'pillared-hall']);
});

test('KG1 A NEW GAME refuses what the law does not take, and a source that is no source', () => {
  const ok = { armies: [[0], [0]], rand32: xorshift(3) };
  assert.ok(K.newGambit(ok));
  assert.equal(K.newGambit({ ...ok, armies: [[0]] }), null);
  assert.equal(K.newGambit({ ...ok, armies: [[], [0]] }), null);
  assert.equal(K.newGambit({ ...ok, armies: [[0], [31, 31, 31, 31, 31]] }), null, 'past the guest\'s 300');
  assert.ok(K.newGambit({ ...ok, armies: [[0], [31, 31, 31, 31, 31]], budgets: [300, 450] }), 'within a Grandmaster\'s 450');
  assert.equal(K.newGambit({ ...ok, budgets: [300, 1.5] }), null);
  assert.equal(K.newGambit({ ...ok, budgets: [300, K.KG_BUDGET_MAX + 1] }), null);
  assert.equal(K.newGambit({ ...ok, potions: [3, -1] }), null);
  assert.equal(K.newGambit({ ...ok, potions: [3, K.KG_POTIONS_MAX + 1] }), null);
  assert.deepEqual(K.newGambit({ ...ok, potions: [3, 4] }).potions, [3, 4]);
  assert.equal(K.newGambit({ ...ok, rand32: null }), null);
  assert.equal(K.newGambit({ ...ok, rand32: () => 1.5 }), null, 'not an integer');
  assert.equal(K.newGambit({ ...ok, rand32: () => -1 }), null);
  assert.equal(K.newGambit({ ...ok, rand32: () => -4294967295 }), null, 'negative, though its low 32 bits read 1');
  // a hole is no army, no budget and no potion count - each side is read by its index (AUDIT KG A3)
  /* eslint-disable no-sparse-arrays */
  assert.equal(K.newGambit({ ...ok, armies: [[0, , 1], [0]] }), null);
  assert.equal(K.newGambit({ ...ok, armies: [, [0]] }), null);
  assert.equal(K.newGambit({ ...ok, potions: [, 3] }), null);
  assert.equal(K.newGambit({ ...ok, budgets: [, 300] }), null);
  /* eslint-enable no-sparse-arrays */
  assert.equal(K.newGambit({ ...ok, rand32: () => 2 ** 32 }), null);
  const top = xorshift(5);
  let first = true;
  assert.ok(K.newGambit({ ...ok, rand32: () => (first ? ((first = false), 0xFFFFFFFF) : top()) }), '0xFFFFFFFF is a 32-bit draw');
  assert.ok(K.newGambit({ ...ok, budgets: [300, K.KG_BUDGET_MAX] }));
  assert.ok(K.newGambit({ ...ok, potions: [3, K.KG_POTIONS_MAX] }));
  assert.equal(K.newGambit({ ...ok, rand32: script([R(0, 0, 4)]) }), null, 'a source that runs dry');
  let n = 0;
  assert.equal(K.newGambit({ ...ok, rand32: () => { n++; return 0xFFFFFFFF; } }), null, 'one stuck past every limit');
  assert.ok(n <= K.KG_RAND_DRAWS_MAX + 1, 'refused at the bound, not spun for ever');
});

test('KG1 GetReachable: three steps breadth-first in the mod\'s order, through no piece, never the piece\'s own cell; walls and water no way', () => {
  const st = open([0, 128, 33, 141, 9, 0], [31]);
  const lich = K.pieceById(st, 1);   // (7, 11): the king below, the Werewolf and a Rat beside
  assert.deepEqual(K.reachable(st, lich), [[7, 10], [8, 10], [6, 10], [7, 9], [9, 10], [8, 9], [5, 10], [6, 9], [7, 8]]);
  st.tiles[K.cellIndex(7, 9)] = K.KG_TILE.water;
  st.tiles[K.cellIndex(8, 10)] = K.KG_TILE.wall;
  assert.deepEqual(K.reachable(st, lich), [[7, 10], [6, 10], [5, 10], [6, 9]]);
  assert.equal(K.gambitRefusal(st, 0, { type: 'move', piece: 1, col: 6, row: 9 }), null);
  assert.equal(K.gambitRefusal(st, 0, { type: 'move', piece: 1, col: 6, row: 8 }), 'cell', 'four steps round the wall');
  assert.equal(K.gambitRefusal(st, 0, { type: 'move', piece: 1, col: 7, row: 8 }), 'cell', 'past the water');
  assert.equal(K.gambitRefusal(st, 0, { type: 'move', piece: 1, col: 7, row: 11 }), 'cell', 'its own cell');
  assert.equal(K.gambitRefusal(st, 0, { type: 'move', piece: 1, col: 6, row: 11 }), 'cell', 'a piece\'s cell');
  assert.equal(K.gambitRefusal(st, 0, { type: 'move', piece: 1, col: 4, row: 10 }), 'cell', 'four steps');
  assert.equal(K.gambitRefusal(st, 0, { type: 'move', piece: 1, col: 6, row: 8.5 }), 'shape');
  assert.equal(K.gambitRefusal(st, 0, { type: 'move', piece: 8, col: 7, row: 2 }), 'piece', 'the other side\'s');
  assert.equal(K.gambitRefusal(st, 0, { type: 'move', piece: 99, col: 7, row: 2 }), 'piece');
});

test('KG1 InRange and HasLineOfSight: melee at 1, ranged 1-4 along a sight line - its samples, RoundDiv\'s half away from zero, water no bar', () => {
  assert.deepEqual([[1, 2], [-1, 2], [3, 12], [6, 12], [-6, 12], [9, 12], [18, 12], [-18, 12], [0, 5]].map(([a, b]) => K.roundDiv(a, b)), [1, -1, 0, 1, -1, 1, 2, -2, 0]);
  const floor = () => Array(K.KG_COLS * K.KG_ROWS).fill(K.KG_TILE.floor);
  // (2, 10) to (5, 9) samples (3, 10) and (4, 9) between its ends - and no other cell
  const with1 = (c, r, t = K.KG_TILE.wall) => { const x = floor(); x[K.cellIndex(c, r)] = t; return x; };
  assert.equal(K.hasLineOfSight(with1(3, 10), 2, 10, 5, 9), false);
  assert.equal(K.hasLineOfSight(with1(4, 9), 2, 10, 5, 9), false);
  assert.equal(K.hasLineOfSight(with1(4, 9, K.KG_TILE.pillar), 2, 10, 5, 9), false);
  assert.equal(K.hasLineOfSight(with1(3, 10, K.KG_TILE.water), 2, 10, 5, 9), true, 'ranged attacks pass over water');
  for (const [c, r] of [[3, 9], [4, 10], [2, 9], [5, 10], [2, 10], [5, 9]]) assert.equal(K.hasLineOfSight(with1(c, r), 2, 10, 5, 9), true, `(${c}, ${r}) is not sampled`);
  const st = open([128, 33], [31]);
  const mage = standAt(st, 2, 2, 10), lich = K.pieceById(st, 1), lord = standAt(st, 4, 5, 9);
  standAt(st, 3, 9, 3);   // the guest's king out of the way
  assert.equal(K.targetInRange(st, mage, 2, 10, lord), true, 'four, in sight');
  st.tiles[K.cellIndex(4, 9)] = K.KG_TILE.wall;
  assert.equal(K.targetInRange(st, mage, 2, 10, lord), false, 'four, behind a wall');
  assert.equal(K.gambitRefusal(st, 0, { type: 'attack', piece: 2, target: 4 }), 'range');
  // the sight line binds from two cells on (AUDIT KG A9): up the Mage's column, a wall on (2, 9) between it and a foe
  // two cells off and three
  st.tiles[K.cellIndex(2, 9)] = K.KG_TILE.wall;
  standAt(st, 4, 2, 8);
  assert.equal(K.targetInRange(st, mage, 2, 10, lord), false, 'two, behind a wall');
  standAt(st, 4, 2, 7);
  assert.equal(K.targetInRange(st, mage, 2, 10, lord), false, 'three, behind a wall');
  st.tiles[K.cellIndex(2, 9)] = K.KG_TILE.floor;
  assert.equal(K.targetInRange(st, mage, 2, 10, lord), true, 'three, in sight');
  standAt(st, 4, 2, 9);
  assert.equal(K.targetInRange(st, mage, 2, 10, lord), true, 'adjacent needs no sight line');
  standAt(st, 4, 2, 5);
  assert.equal(K.targetInRange(st, mage, 2, 10, lord), false, 'five is past four');
  standAt(st, 4, 6, 10);
  assert.equal(K.targetInRange(st, mage, 2, 10, lord), true);
  standAt(st, 1, 5, 10);
  assert.equal(K.targetInRange(st, lich, 5, 10, lord), true, 'melee at 1');
  assert.equal(K.targetInRange(st, lich, 5, 9, lord), false, 'melee diagonal is two');
  assert.equal(K.targetInRange(st, lich, 4, 10, lord), false, 'melee at 2');
  assert.deepEqual(K.foesInRange(st, mage).map((p) => p.id), [4]);
  assert.equal(K.gambitRefusal(st, 0, { type: 'attack', piece: 2, target: 1 }), 'target', 'its own side');
  assert.equal(K.gambitRefusal(st, 0, { type: 'attack', piece: 2, target: 77 }), 'target');
  assert.equal(K.gambitRefusal(st, 0, { type: 'attack', piece: 2 }), 'shape');
});

test('KG1 A BLOW: attack x (0.8 + 0.4u) at float32, half to even, at least 1 - the one draw it takes, its kill, its shot', () => {
  assert.deepEqual([[10, 0], [42, 0], [10, 0.9999999], [1, 0], [2, 0], [5, 0.25], [7, 0.5]].map(([a, u]) => K.blowRoll(a, u)), [8, 34, 12, 1, 2, 4, 7]);
  // THE MULTIPLIER IS FLOAT32 AT EVERY STEP (AUDIT KG A6), on two real attacks: a Lich's 38 at raw 28256319 makes 30.500002,
  // 31 - a float64 multiplier makes exactly 30.5, the even 30; a Gargoyle's 28 at raw 38348481 makes exactly 22.5, the
  // even 22 - a draw left unrounded makes 22.500002, 23
  assert.deepEqual([K.blowRoll(38, 28256319 / 2 ** 32), K.blowRoll(28, 38348481 / 2 ** 32)], [31, 22]);
  const st = open([128, 33], [31]);
  standAt(st, 1, 7, 2);   // the Ancient Lich beside the Daedra Lord (7, 1)
  const src = script([0]);
  const { state, events } = act(st, 0, { type: 'attack', piece: 1, target: 4 }, src);
  assert.deepEqual(events, [{ t: 'attack', side: 0, piece: 1, target: 4, damage: 34, killed: false, shot: false }]);
  assert.equal(K.pieceById(state, 4).hp, 122 - 34);
  assert.equal(src.left(), 0, 'one draw');
  assert.equal(K.pieceById(st, 4).hp, 122, 'the state it was handed is untouched');
  // a shot past 1, and a kill
  const s2 = open([128, 33], [0]);
  standAt(s2, 2, 7, 4);   // the Mage three below the guest's Rat on (7, 1)
  K.pieceById(s2, 4).hp = 9;
  const kill = act(s2, 0, { type: 'attack', piece: 2, target: 4 }, script([V(0.5)]));
  assert.deepEqual(kill.events, [{ t: 'attack', side: 0, piece: 2, target: 4, damage: 9, killed: true, shot: true }]);
  assert.equal(K.pieceById(kill.state, 4), null, 'the Rat is gone');
  assert.equal(kill.state.over, null, 'the guest\'s king stands');
  // a ranged piece's blow at one cell is no shot - the mod's bolt flies past 1 alone (AUDIT KG A5)
  const s3 = open([128, 33], [0]);
  standAt(s3, 2, 7, 2);   // the Mage beside the guest's Rat (7, 1)
  assert.deepEqual(act(s3, 0, { type: 'attack', piece: 2, target: 4 }, script([V(0.5)])).events, [{ t: 'attack', side: 0, piece: 2, target: 4, damage: 9, killed: false, shot: false }]);
  // a broken source refuses the blow and changes nothing
  assert.deepEqual(K.gambitAct(s2, 0, { type: 'attack', piece: 2, target: 4 }, () => 'x'), { refused: 'rand' });
  assert.deepEqual(K.gambitAct(s2, 0, { type: 'attack', piece: 2, target: 4 }), { refused: 'rand' });
});

test('KG1 POTIONS: a hurt piece of one\'s own heals the least of 30 and what it lacks; a full one, or none left, is refused', () => {
  const st = open([33], [31], { potions: [1, 3] });
  assert.equal(K.gambitRefusal(st, 0, { type: 'potion', piece: 1 }), 'full');
  K.pieceById(st, 1).hp = 50;
  const a = act(st, 0, { type: 'potion', piece: 1 });
  assert.deepEqual(a.events, [{ t: 'potion', side: 0, piece: 1, healed: 30 }]);
  assert.deepEqual([K.pieceById(a.state, 1).hp, a.state.potions], [80, [0, 3]]);
  K.pieceById(a.state, 1).hp = 90;
  assert.equal(K.gambitRefusal(a.state, 0, { type: 'potion', piece: 1 }), 'potions');
  const b = open([33], [31]);
  K.pieceById(b, 1).hp = 90;
  assert.equal(act(b, 0, { type: 'potion', piece: 1 }).events[0].healed, 10, 'what it lacks');
  assert.equal(K.gambitRefusal(b, 0, { type: 'potion', piece: 3 }), 'piece', 'the other side\'s');
  // THE GUEST'S POTIONS ARE ITS OWN (AUDIT KG A10): it drinks from its count, and is refused on its own none while the
  // host still holds three
  const g = open([33], [31], { potions: [3, 1] });
  const guestTurn = K.finishTurn(act(g, 0, { type: 'end' }).state).state;
  K.pieceById(guestTurn, 3).hp = 50;   // the guest's Daedra Lord
  const drink = act(guestTurn, 1, { type: 'potion', piece: 3 });
  assert.deepEqual([drink.events, drink.state.potions], [[{ t: 'potion', side: 1, piece: 3, healed: 30 }], [3, 0]]);
  K.pieceById(drink.state, 3).hp = 50;
  assert.equal(K.gambitRefusal(drink.state, 1, { type: 'potion', piece: 3 }), 'potions');
});

test('KG1 THE TURN: the host first, two actions, the turn ending until its end is taken; End turn; refusals change nothing', () => {
  const st = open([33, 0], [31, 0]);
  assert.equal(K.gambitRefusal(st, 1, { type: 'end' }), 'turn');
  assert.equal(K.gambitRefusal(st, 2, { type: 'end' }), 'side');
  assert.equal(K.gambitRefusal(st, 0, { type: 'dance' }), 'shape');
  assert.equal(K.gambitRefusal(st, 0, null), 'shape');
  assert.equal(K.gambitRefusal(null, 0, { type: 'end' }), 'over');
  assert.deepEqual(K.gambitAct(st, 1, { type: 'end' }), { refused: 'turn' });
  const one = act(st, 0, { type: 'move', piece: 1, col: 7, row: 9 });
  assert.deepEqual(one.events, [{ t: 'move', side: 0, piece: 1, from: [7, 11], to: [7, 9] }]);
  assert.deepEqual([one.state.actions, one.state.ending], [1, false]);
  const two = act(one.state, 0, { type: 'move', piece: 2, col: 7, row: 10 });
  assert.deepEqual([two.state.actions, two.state.ending], [0, true]);
  assert.equal(K.gambitRefusal(two.state, 0, { type: 'end' }), 'ending');
  assert.equal(K.gambitRefusal(two.state, 1, { type: 'end' }), 'ending');
  assert.deepEqual(K.finishTurn(st, null), { refused: 'ending' });
  const next = K.finishTurn(two.state);
  assert.deepEqual(next.events, [{ t: 'turn', side: 1, round: 1 }]);
  assert.deepEqual([next.state.turn, next.state.actions, next.state.ending, next.state.round], [1, 2, false, 1]);
  const ended = act(next.state, 1, { type: 'end' });
  assert.deepEqual(ended.events, [{ t: 'end', side: 1 }]);
  assert.deepEqual([ended.state.actions, ended.state.ending], [0, true]);
  const back = K.finishTurn(ended.state, script(pair(0, 3, 'fire')));
  assert.deepEqual([back.state.turn, back.state.round], [0, 2], 'the round counts on after the guest\'s turn');
  assert.deepEqual(back.events, [{ t: 'warning', kind: 'fire', cells: [[0, 3], [14, 9]] }, { t: 'turn', side: 0, round: 2 }]);
  assert.deepEqual([one.state === st, two.state === one.state], [false, false], 'every step a new state');
  assert.deepEqual([K.pieceById(st, 1).row, st.actions], [11, 2], 'the first untouched');
});

test('KG1 THE TURN\'S END: hazards bite the side that moved alone, active alone; a bite kills; the tick arms the warnings and lays a pair; at most fourteen', () => {
  const st = open([33, 0], [31, 0]);
  st.hazards = [
    { col: 7, row: 11, kind: 'fire', active: true },     // under the host's Ancient Lich
    { col: 6, row: 11, kind: 'poison', active: false },  // under the host's Rat - a warning
    { col: 7, row: 1, kind: 'spikes', active: true },    // under the guest's Daedra Lord
    { col: 14, row: 12, kind: 'spikes', active: false },
  ];
  K.pieceById(st, 2).hp = 5;   // the Rat
  const host = K.finishTurn(act(st, 0, { type: 'end' }).state);
  assert.deepEqual(host.events, [{ t: 'hazard', side: 0, piece: 1, kind: 'fire', damage: 8, killed: false }, { t: 'turn', side: 1, round: 1 }]);
  assert.deepEqual([K.pieceById(host.state, 1).hp, K.pieceById(host.state, 2).hp, K.pieceById(host.state, 4).hp], [92, 5, 122]);
  // the guest's turn ends on the spikes; round 2 arms the two warnings and lays a new pair
  standAt(host.state, 5, 12, 7);   // the guest's Rat out into the zone, on the mirror of (2, 5)
  const warn = script([...miss(7, 6), ...miss(2, 5), ...pair(2, 4, 'poison')]);
  const guest = K.finishTurn(act(host.state, 1, { type: 'end' }).state, warn);
  assert.deepEqual(guest.events, [
    { t: 'hazard', side: 1, piece: 4, kind: 'spikes', damage: 6, killed: false },
    { t: 'armed', cells: [[6, 11], [14, 12]] },
    { t: 'warning', kind: 'poison', cells: [[2, 4], [12, 8]] },
    { t: 'turn', side: 0, round: 2 },
  ]);
  assert.ok(guest.state.hazards.slice(0, 4).every((h) => h.active));
  assert.deepEqual(guest.state.hazards.slice(4), [{ col: 2, row: 4, kind: 'poison', active: false }, { col: 12, row: 8, kind: 'poison', active: false }]);
  assert.equal(warn.left(), 0);
  // the host's turn ends: the Rat on armed poison dies of it
  const bite = K.finishTurn(act(guest.state, 0, { type: 'end' }).state);
  assert.deepEqual(bite.events.slice(0, 2), [{ t: 'hazard', side: 0, piece: 1, kind: 'fire', damage: 8, killed: false }, { t: 'hazard', side: 0, piece: 2, kind: 'poison', damage: 5, killed: true }]);
  assert.equal(K.pieceById(bite.state, 2), null);
  // round 3 lays nothing (odd); round 4 would, but thirteen or fourteen hazards take no pair - and draw nothing
  const r3 = K.finishTurn(act(bite.state, 1, { type: 'end' }).state, script([]));
  assert.equal(r3.state.round, 3);
  const full = structuredClone(r3.state);
  while (full.hazards.length < 13) full.hazards.push({ col: 0, row: 0, kind: 'fire', active: false });
  const r4 = K.finishTurn(act(K.finishTurn(act(full, 0, { type: 'end' }).state).state, 1, { type: 'end' }).state, script([]));
  assert.equal(r4.state.round, 4);
  assert.equal(r4.state.hazards.length, 13);
  full.hazards.pop();   // twelve: room for a pair - fourteen
  const r4b = K.finishTurn(act(K.finishTurn(act(full, 0, { type: 'end' }).state).state, 1, { type: 'end' }).state, script(pair(3, 3, 'fire')));
  assert.equal(r4b.state.hazards.length, 14);
  // a pair that finds no cell in forty tries lays nothing - every one of the forty drawn (AUDIT KG A7) - and one that
  // finds its cell at the fortieth lays it
  const busy = structuredClone(r3.state);
  const toRound4 = (tries) => K.finishTurn(act(K.finishTurn(act(busy, 0, { type: 'end' }).state).state, 1, { type: 'end' }).state, tries);
  const forty = script(Array(40).fill(miss(7, 6)).flat());
  assert.equal(toRound4(forty).events.some((e) => e.t === 'warning'), false);
  assert.equal(forty.left(), 0, 'forty tries drawn');
  const fortieth = script([...Array(39).fill(miss(7, 6)).flat(), ...pair(3, 3, 'fire')]);
  assert.deepEqual(toRound4(fortieth).events.find((e) => e.t === 'warning'), { t: 'warning', kind: 'fire', cells: [[3, 3], [11, 9]] });
  assert.equal(fortieth.left(), 0);
});

test('KG1 THE END: a king\'s fall ends it - by a blow or by a bite, either felling one side alone; nothing is taken after', () => {
  const st = open([33], [0]);
  standAt(st, 1, 6, 0);   // the Ancient Lich beside the guest's king (7, 0)
  K.pieceById(st, 2).hp = 10;
  const won = act(st, 0, { type: 'attack', piece: 1, target: 2 }, script([0]));
  assert.deepEqual(won.events, [{ t: 'attack', side: 0, piece: 1, target: 2, damage: 34, killed: true, shot: false }, { t: 'over', winner: 0, fallen: 1 }]);
  assert.deepEqual([won.state.over, won.state.ending, won.state.actions], [{ winner: 0, fallen: 1 }, false, 1]);
  assert.equal(K.gambitRefusal(won.state, 0, { type: 'end' }), 'over');
  assert.deepEqual(K.finishTurn(won.state), { refused: 'over' });
  // the game-ending blow as the turn's second action leaves no turn ending
  const st2 = open([33], [0]);
  standAt(st2, 1, 5, 0);
  K.pieceById(st2, 2).hp = 10;
  const second = act(act(st2, 0, { type: 'move', piece: 1, col: 6, row: 0 }).state, 0, { type: 'attack', piece: 1, target: 2 }, script([0]));
  assert.deepEqual([second.state.over, second.state.ending, second.state.actions], [{ winner: 0, fallen: 1 }, false, 0]);
  // the host's king bitten to death at the end of the host's turn: the guest wins
  const s2 = open([0], [0]);
  s2.hazards = [{ col: 7, row: 12, kind: 'fire', active: true }];
  K.pieceById(s2, 0).hp = 8;
  const lost = K.finishTurn(act(s2, 0, { type: 'end' }).state);
  assert.deepEqual(lost.events, [{ t: 'hazard', side: 0, piece: 0, kind: 'fire', damage: 8, killed: true }, { t: 'over', winner: 1, fallen: 0 }]);
  assert.deepEqual(lost.state.over, { winner: 1, fallen: 0 });
  // the king alone: no piece left but the king is no fall
  const s3 = open([0], [0]);
  standAt(s3, 1, 7, 2);   // the host's Rat below the guest's (7, 1)
  K.pieceById(s3, 3).hp = 1;
  const rat = act(s3, 0, { type: 'attack', piece: 1, target: 3 }, script([0]));
  assert.equal(rat.state.over, null, 'the guest\'s Rat dies, its king stands');
});

test('KG1 WHOLE GAMES: two greedy players over hundreds of seeded boards - every game ends, every step lawful, the same seed the same game', () => {
  /** Greedy: the first foe in reach of the first piece that has one; else the step that nears the other king most by
   *  walking distance (PathMap - the mod's own AI reads the same); else, one time in four, a seeded step anywhere (a
   *  jam of pieces in a corridor is broken); else the end of the turn. */
  const greedy = (st, side, rnd) => {
    const mine = st.pieces.filter((p) => p.side === side);
    for (const p of mine) { const f = K.foesInRange(st, p)[0]; if (f) return { type: 'attack', piece: p.id, target: f.id }; }
    const king = st.pieces.find((p) => p.side !== side && p.king);
    const far = K.pathMap(st.tiles, king.col, king.row);
    let best = null, gain = 0;
    for (const p of mine) {
      for (const [c, r] of K.reachable(st, p)) {
        const g = far[K.cellIndex(p.col, p.row)] - far[K.cellIndex(c, r)];
        if (g > gain) { gain = g; best = { type: 'move', piece: p.id, col: c, row: r }; }
      }
    }
    if (best) return best;
    const movers = mine.map((p) => [p, K.reachable(st, p)]).filter(([, cells]) => cells.length);
    if (movers.length && rnd() % 4 === 0) {
      const [p, cells] = movers[rnd() % movers.length], [c, r] = cells[rnd() % cells.length];
      return { type: 'move', piece: p.id, col: c, row: r };
    }
    return { type: 'end' };
  };
  const play = (seed) => {
    const rnd = xorshift(seed);
    const armies = [K.autoFill([], 300, rnd), K.autoFill([], [220, 300, 360, 450][seed % 4], rnd)];
    let st = K.newGambit({ armies, rand32: rnd, budgets: [300, 450], potions: [3, 2 + (seed % 3)] });
    const log = [];
    for (let step = 0; step < 20000 && !st.over; step++) {
      if (st.ending) { const out = K.finishTurn(st, rnd); st = out.state; log.push(...out.events); continue; }
      const out = K.gambitAct(st, st.turn, greedy(st, st.turn, rnd), rnd);
      assert.ok(out.state, `seed ${seed}: the greedy command was lawful`);
      st = out.state;
      log.push(...out.events);
      // the board's invariants at every step
      const cells = new Set(st.pieces.map((p) => K.cellIndex(p.col, p.row)));
      assert.equal(cells.size, st.pieces.length, 'one piece a cell');
      assert.ok(st.pieces.every((p) => K.isPassable(st.tiles, p.col, p.row) && p.hp > 0 && p.hp <= p.maxHp));
      assert.ok(st.hazards.length <= K.KG_MAX_HAZARDS && st.potions.every((n) => n >= 0));
    }
    return { st, log };
  };
  for (let seed = 1; seed <= 250; seed++) {
    const { st, log } = play(seed);
    assert.ok(st.over, `seed ${seed} ends`);
    assert.equal(st.pieces.some((p) => p.side === st.over.fallen && p.king), false, 'the fallen side has no king');
    // the board as the mod builds it: point-symmetric, the deployment rows floor
    for (let i = 0; i < st.tiles.length; i++) assert.equal(st.tiles[i], st.tiles[st.tiles.length - 1 - i], 'mirrored through the centre');
    for (const r of [0, 1, 2, 10, 11, 12]) for (let c = 0; c < K.KG_COLS; c++) assert.equal(st.tiles[K.cellIndex(c, r)], K.KG_TILE.floor);
    if (seed <= 20) assert.deepEqual(play(seed).log, log, 'the same seed, the same game');
  }
});
