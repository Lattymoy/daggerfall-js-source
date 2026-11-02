// KG2 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 2.7, 10.5 and 12; the owner: "Do KG2"): THE
// INNKEEPER'S PLAY (systems/gambit/gambitPatrons.js), pinned against TheKingsGambit.dll's own: the Tiers table, TierFor's hash
// and bands over a regular's seed, the deal (StartBattle's Auto-fill, then BeginMatch), and AiAction rule by rule on
// boards built for each - the blunder (its chance at float32, its draws), the potion's line, TryEscape, the best blow,
// the best move - then AiTurnRoutine's step, and a miniature of the record's measure (tools/kgMeasure.mjs).
//
// THE SCRIPTED DRAWS. Random.value is the raw draw V(x) for x; Random.Range(0, n) is drawBelow(n), answered by
// R(v, n) - the value plus 1009 times n, so a range mutated to any other bound under 1009 answers another value (KG1's
// prime offset). A script throws when it runs dry, and every test reads what is left: a draw the mod does not take
// is a test that fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../../src/net/kingsGambit.js';
import * as G from '../../src/systems/gambit/gambitPatrons.js';
import { measureTier, playRegular, gameSeed, xorshift } from '../../tools/kgMeasure.mjs';

const R = (v, n) => v + 1009 * n;
const V = (x) => Math.floor(x * 2 ** 32);
/** A source that answers `xs` in turn and throws when it runs dry. */
const script = (xs) => { let i = 0; const f = () => { if (i >= xs.length) throw new Error(`script ran dry at ${i}`); return xs[i++]; }; f.left = () => xs.length - i; return f; };
const [AMATEUR, SEASONED, VETERAN, GRANDMASTER] = G.GAMBIT_TIERS;
/** No blunder - a draw of V(0.9) clears every tier's chance. */
const CLEAR = V(0.9);

/** A game on an open board (every cell floor, no hazard): the host's army `host`, the regular's (the guest's) `guest`,
 *  the regular's turn with `actions` left. Pieces: the host's king 0, its units from 1 dearest first; then the guest's king and
 *  units. */
function board(host, guest, { actions = 2, potions = [3, 3] } = {}) {
  const st = K.newGambit({ armies: [host, guest], rand32: xorshift(1), potions, budgets: [K.KG_BUDGET_MAX, K.KG_BUDGET_MAX] });
  assert.ok(st);
  st.tiles.fill(K.KG_TILE.floor);
  st.hazards = [];
  st.turn = 1;
  st.actions = actions;
  return st;
}
/** A piece stood on (c, r). */
const at = (st, id, c, r) => { const p = K.pieceById(st, id); p.col = c; p.row = r; return p; };
/** A hazard laid on (c, r). */
const lay = (st, c, r, kind, active = true) => { st.hazards.push({ col: c, row: r, kind, active }); };
/** The regular's choice off `draws`, every draw taken. */
function choose(st, tier, draws) {
  const src = script(draws);
  const cmd = G.regularAction(st, 1, tier, src);
  assert.equal(src.left(), 0, `draws left over: ${src.left()}`);
  return cmd;
}
/** One jitter draw a cell, V(0) but for the cells `wins` names (each V(0.5)). */
const jitters = (cells, wins = []) => cells.map(([c, r]) => (wins.some(([wc, wr]) => wc === c && wr === r) ? V(0.5) : V(0)));

test('KG2 THE TIERS: the mod\'s Tiers table by key and number (its words the client\'s), TierFor\'s hash and bands over a seed', () => {
  assert.deepEqual(G.GAMBIT_TIERS, [
    { key: 'amateur', stake: 10, budget: 220, potions: 2, blunder: 0.35 },
    { key: 'seasoned', stake: 50, budget: 300, potions: 3, blunder: 0.15 },
    { key: 'veteran', stake: 200, budget: 360, potions: 3, blunder: 0.05 },
    { key: 'grandmaster', stake: 1000, budget: 450, potions: 4, blunder: 0 },
  ]);
  assert.ok(G.GAMBIT_TIERS.every((t) => Object.isFrozen(t)) && Object.isFrozen(G.GAMBIT_TIERS));
  assert.deepEqual(G.GAMBIT_TIER_HASH, [73856093, 0x127409F]);
  assert.deepEqual(G.GAMBIT_TIER_BANDS, [40, 75, 93]);
  // TierFor's arithmetic, done again on BigInts as the C# does it: the product wrapped to an int32, the XOR, C#'s
  // remainder (its dividend's sign) made positive
  const hash = (seed) => {
    const x = BigInt.asIntN(32, BigInt.asIntN(32, BigInt(seed | 0) * 73856093n) ^ 0x127409Fn);
    return Number(((x % 100n) + 100n) % 100n);
  };
  const band = (h) => (h < 40 ? 0 : h < 75 ? 1 : h < 93 ? 2 : 3);
  const seeds = [0, 1, 2, 3, 0x7FFFFFFF, 0x80000000, 0xFFFFFFFF, 0xDEADBEEF, ...Array.from({ length: 4000 }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0)];
  let negative = 0;
  for (const s of seeds) {
    assert.equal(G.tierFor(s), G.GAMBIT_TIERS[band(hash(s))], `seed ${s}`);
    if (BigInt.asIntN(32, BigInt.asIntN(32, BigInt(s | 0) * 73856093n) ^ 0x127409Fn) < 0n) negative++;
  }
  assert.ok(negative > 1000, 'half the hashes are negative ints - the remainder made positive is pinned');
  assert.equal(G.tierFor(0), SEASONED, '0x127409F mod 100 is 63');
  assert.equal(G.tierFor(-1), G.tierFor(0xFFFFFFFF), 'a uint32 seed is the int32 the C# multiplies');
  // each band's edges: the first seeds whose hash is 39, 40, 74, 75, 92 and 93
  const edges = new Map();
  for (let s = 0; edges.size < 6; s++) { const h = hash(s); if ([39, 40, 74, 75, 92, 93].includes(h) && !edges.has(h)) edges.set(h, s); }
  assert.deepEqual([39, 40, 74, 75, 92, 93].map((h) => G.tierFor(edges.get(h)).key), ['amateur', 'seasoned', 'seasoned', 'veteran', 'veteran', 'grandmaster']);
  // the shares a tavern's regulars fall into: 40, 35, 18 and 7 in a hundred
  const count = [0, 0, 0, 0];
  for (let s = 0; s < 200000; s++) count[G.GAMBIT_TIERS.indexOf(G.tierFor(s))]++;
  count.forEach((n, i) => assert.ok(Math.abs(n / 200000 - [0.40, 0.35, 0.18, 0.07][i]) < 0.005, `tier ${i}: ${n}`));
});

test('KG2 THE DEAL: the regular\'s army Auto-filled to the tier\'s points first, then the board; the regular\'s potions the tier\'s', () => {
  for (const tier of G.GAMBIT_TIERS) {
    for (let seed = 1; seed <= 8; seed++) {
      const army = G.regularArmy(tier, xorshift(seed));
      assert.deepEqual(army, K.autoFill([], tier.budget, xorshift(seed)), 'Auto-fill to the tier\'s points');
      assert.equal(K.armyRefusal(army, tier.budget), null);
      assert.ok(K.armyCost(army) <= tier.budget && army.length <= K.KG_MAX_UNITS);
    }
  }
  // the order of draws: the regular's army, then BuildMap - one source
  const x = xorshift(9), y = xorshift(9);
  const dealt = G.dealRegular({ army: [0, 128], tier: GRANDMASTER, rand32: x });
  const theirs = K.autoFill([], 450, y);
  assert.deepEqual(dealt, K.newGambit({ armies: [[0, 128], theirs], rand32: y, potions: [3, 4], budgets: [300, 450] }));
  assert.deepEqual(dealt.potions, [3, 4], 'three for the player, the Grandmaster\'s four');
  assert.deepEqual(dealt.pieces.filter((p) => p.side === 1 && !p.king).map((p) => p.unit).sort((a, b) => a - b), theirs.slice().sort((a, b) => a - b));
  assert.ok(K.armyCost(theirs) > 300, 'the Grandmaster fields more than the player may');
  assert.deepEqual(G.dealRegular({ army: [0, 128], tier: AMATEUR, rand32: xorshift(9) }).potions, [3, 2]);
  assert.equal(G.dealRegular({ army: new Array(13).fill(0), tier: SEASONED, rand32: xorshift(9) }), null, 'an army the law refuses deals nothing');
  assert.equal(G.dealRegular({ army: [31, 31, 31, 31, 31], tier: SEASONED, rand32: xorshift(9) }), null, 'nor one past the player\'s 300');
  assert.equal(G.dealRegular({ army: [0, 128], tier: SEASONED, rand32: () => 0xFFFFFFFF }), null, 'nor a stuck source - refused, never spun (AUDIT KG A2)');
});

test('KG2 A BLUNDER (AiBlunder): by the tier\'s chance at float32, drawn every action; a random piece strikes one time in two', () => {
  // the host's king 0 and Rat 1, the regular's king 2 and Rat 3 - the regular's Rat beside the host's
  const st = board([0], [0]);
  at(st, 1, 7, 11);
  at(st, 3, 7, 10);
  // a blunder: the regular's Rat (the second of two pieces), a strike (0.25 < 0.5), at its one foe
  assert.deepEqual(choose(st, AMATEUR, [V(0.3), R(1, 2), V(0.25), R(0, 1)]), { type: 'attack', piece: 3, target: 1 });
  // no strike (0.5): the walk - a cell it reaches, at random
  const cells = K.reachable(st, K.pieceById(st, 3));
  assert.deepEqual(choose(st, AMATEUR, [V(0.3), R(1, 2), V(0.5), R(2, cells.length)]), { type: 'move', piece: 3, col: cells[2][0], row: cells[2][1] });
  // the regular's king, with no foe in range, walks - and the strike's draw is never taken
  const kc = K.reachable(st, K.pieceById(st, 2));
  assert.deepEqual(choose(st, AMATEUR, [V(0.3), R(0, 2), R(4, kc.length)]), { type: 'move', piece: 2, col: kc[4][0], row: kc[4][1] });
  // a king walled in, no foe in range: no blunder to make, no action
  const shut = board([0], [0]);
  at(shut, 3, 0, 6);
  for (const [c, r] of [[6, 0], [8, 0], [7, 1]]) shut.tiles[K.cellIndex(c, r)] = K.KG_TILE.wall;
  assert.equal(choose(shut, AMATEUR, [V(0.3), R(0, 2)]), null);
  // THE CHANCE AT FLOAT32: Random.value and the tier's 0.35f are floats - raw 1503238465 rounds up to 0.35f and is no
  // blunder (a float64 comparison would call it one); 1503238464 is the last that is. No blunder: the best blow.
  assert.deepEqual(choose(st, AMATEUR, [1503238465, V(0.5)]), { type: 'attack', piece: 3, target: 1 });
  assert.deepEqual(choose(st, AMATEUR, [1503238464, R(1, 2), V(0.25), R(0, 1)]), { type: 'attack', piece: 3, target: 1 });
  assert.deepEqual(choose(st, SEASONED, [644245087, R(1, 2), V(0.25), R(0, 1)]), { type: 'attack', piece: 3, target: 1 });
  assert.deepEqual(choose(st, SEASONED, [644245088, V(0.5)]), { type: 'attack', piece: 3, target: 1 });
  assert.deepEqual(choose(st, VETERAN, [214748360, R(1, 2), V(0.25), R(0, 1)]), { type: 'attack', piece: 3, target: 1 });
  assert.deepEqual(choose(st, VETERAN, [214748361, V(0.5)]), { type: 'attack', piece: 3, target: 1 });
  // a Grandmaster never blunders, and the draw is taken all the same
  assert.deepEqual(choose(st, GRANDMASTER, [V(0), V(0.5)]), { type: 'attack', piece: 3, target: 1 });
  // THE STRIKE'S COIN IS RANDOM.VALUE AT FLOAT32 too (AUDIT KG B2): raw 2147483647 rounds up to 0.5f, no strike - it walks
  assert.deepEqual(choose(st, AMATEUR, [V(0.3), R(1, 2), 2147483647, R(2, cells.length)]), { type: 'move', piece: 3, col: cells[2][0], row: cells[2][1] });
  // and its foe is drawn by its place among those in range (AUDIT KG B2): the host's king beside the Rat as well, drawn first
  at(st, 0, 6, 10);
  assert.deepEqual(choose(st, AMATEUR, [V(0.3), R(1, 2), V(0.25), R(0, 2)]), { type: 'attack', piece: 3, target: 0 });
  assert.deepEqual(choose(st, AMATEUR, [V(0.3), R(1, 2), V(0.25), R(1, 2)]), { type: 'attack', piece: 3, target: 1 });
});

test('KG2 THE POTION: while one is held, for the piece with the least share of its health at or below its line', () => {
  // the regular's king 2, Mage 3 (30 health) and Rat 4 (12), far from the host's
  const st = board([0], [0, 128]);
  const [king, mage, rat] = [2, 3, 4].map((id) => K.pieceById(st, id));
  king.hp = 35; mage.hp = 9; rat.hp = 3;
  assert.deepEqual(choose(st, SEASONED, [CLEAR]), { type: 'potion', piece: 4 }, 'the Rat\'s quarter is the least');
  rat.hp = 12;
  assert.deepEqual(choose(st, SEASONED, [CLEAR]), { type: 'potion', piece: 3 }, 'the Mage at exactly three tenths (0.3f at float32) drinks');
  mage.hp = 10;
  assert.deepEqual(choose(st, SEASONED, [CLEAR]), { type: 'potion', piece: 2 }, 'the king at exactly a half drinks');
  // above every line, or none held: the next rule - the regular's Rat beside the host's strikes
  king.hp = 36;
  rat.hp = 4;
  at(st, 1, 7, 11);
  at(st, 4, 7, 10);
  assert.deepEqual(choose(st, SEASONED, [CLEAR, V(0)]), { type: 'attack', piece: 4, target: 1 }, 'a third of a Rat is above its line');
  rat.hp = 3;
  st.potions[1] = 0;
  assert.deepEqual(choose(st, SEASONED, [CLEAR, V(0)]), { type: 'attack', piece: 4, target: 1 }, 'no potion held');
  // a tie keeps the first in the pieces' order
  const two = board([0], [0, 0]);
  K.pieceById(two, 3).hp = 3;
  K.pieceById(two, 4).hp = 3;
  assert.deepEqual(choose(two, SEASONED, [CLEAR]), { type: 'potion', piece: 3 });
});

test('KG2 AN ESCAPE (TryEscape): off an active hazard that would kill, or any on the last action - to a clear cell, a draw on each', () => {
  // the regular's Rat 3 on fire (8) at (7, 5), the host's Rat 1 below it at (7, 6), the host's king at (7, 12)
  const fresh = (hp, { actions = 2, active = true } = {}) => {
    const st = board([0], [0], { actions });
    at(st, 1, 7, 6);
    at(st, 3, 7, 5).hp = hp;
    lay(st, 7, 5, 'fire', active);
    return st;
  };
  // the clear cells nearest a foe are beside the host's Rat: (8, 6) before (6, 6) in GetReachable's order - the first
  // kept on a tie, the draw deciding else
  let st = fresh(8);
  const cells = K.reachable(st, K.pieceById(st, 3));
  assert.ok(cells.findIndex(([c, r]) => c === 8 && r === 6) < cells.findIndex(([c, r]) => c === 6 && r === 6));
  assert.deepEqual(choose(st, SEASONED, [CLEAR, ...jitters(cells)]), { type: 'move', piece: 3, col: 8, row: 6 }, 'eight health, fire bites eight');
  assert.deepEqual(choose(st, SEASONED, [CLEAR, ...jitters(cells, [[6, 6]])]), { type: 'move', piece: 3, col: 6, row: 6 });
  // a hazard on a cell, warning or not, takes it out - and its draw
  lay(st, 8, 6, 'poison', false);
  const clear = cells.filter(([c, r]) => !(c === 8 && r === 6));
  assert.deepEqual(choose(st, SEASONED, [CLEAR, ...jitters(clear)]), { type: 'move', piece: 3, col: 6, row: 6 });
  // a bite it lives through waits for the turn's last action; the blow comes first
  assert.deepEqual(choose(fresh(9), SEASONED, [CLEAR, V(0)]), { type: 'attack', piece: 3, target: 1 });
  st = fresh(9, { actions: 1 });
  assert.deepEqual(choose(st, SEASONED, [CLEAR, ...jitters(cells)]), { type: 'move', piece: 3, col: 8, row: 6 }, 'the last action steps off');
  // a warning bites nothing yet
  assert.deepEqual(choose(fresh(8, { active: false }), SEASONED, [CLEAR, V(0)]), { type: 'attack', piece: 3, target: 1 });
  // A KING runs farthest: the regular's king on spikes (6) at (7, 5) with 6 health, the host's Rat at (7, 9) - seven
  // cells tie at seven steps from it, the draw picks (4, 5). No potion held: a king at 6 of 70 would drink first.
  const k = board([0], [0], { potions: [3, 0] });
  at(k, 1, 7, 9);
  at(k, 3, 0, 0);
  at(k, 2, 7, 5).hp = 6;
  lay(k, 7, 5, 'spikes');
  const kc = K.reachable(k, K.pieceById(k, 2));
  assert.deepEqual(choose(k, SEASONED, [CLEAR, ...jitters(kc, [[4, 5]])]), { type: 'move', piece: 2, col: 4, row: 5 });
  // no clear cell: no escape - the next rule (here none: a lone king, unalarmed, no move above 0... or a blow)
  const boxed = fresh(8);
  for (const [c, r] of K.reachable(boxed, K.pieceById(boxed, 3))) lay(boxed, c, r, 'spikes', false);
  assert.deepEqual(choose(boxed, SEASONED, [CLEAR, V(0)]), { type: 'attack', piece: 3, target: 1 }, 'cornered, it strikes');
  // THE BITE IS ITS OWN KIND'S (AUDIT KG B2): a Rat with 7 on spikes (6) lives through it - no escape before the last
  // action, the blow comes first - where fire's 8 would kill it
  const spikes = board([0], [0]);
  at(spikes, 1, 7, 6);
  at(spikes, 3, 7, 5).hp = 7;
  lay(spikes, 7, 5, 'spikes');
  assert.deepEqual(choose(spikes, SEASONED, [CLEAR, V(0)]), { type: 'attack', piece: 3, target: 1 });
  // A BOXED PIECE GIVES WAY TO THE NEXT (AUDIT KG B2: TryEscape answers false and the loop goes on): the regular's first Rat
  // on fire with every cell it reaches under a warning, the second on fire beside a clear field - the second steps off
  const two = board([0], [0, 0]);
  at(two, 1, 11, 5);
  at(two, 3, 2, 4).hp = 8;
  lay(two, 2, 4, 'fire');
  for (const [c, r] of K.reachable(two, K.pieceById(two, 3))) lay(two, c, r, 'poison', false);
  at(two, 4, 11, 4).hp = 8;
  lay(two, 11, 4, 'fire');
  const clear4 = K.reachable(two, K.pieceById(two, 4)).filter(([c, r]) => !K.hazardAt(two, c, r));
  assert.deepEqual(choose(two, SEASONED, [CLEAR, ...jitters(clear4)]), { type: 'move', piece: 4, col: 12, row: 5 });
  // TWO THAT CAN STEP OFF: the first in the pieces' order does (AUDIT KG B2)
  const pair = board([0], [0, 0]);
  at(pair, 1, 7, 9);
  at(pair, 3, 2, 4).hp = 8;
  lay(pair, 2, 4, 'fire');
  at(pair, 4, 11, 4).hp = 8;
  lay(pair, 11, 4, 'fire');
  const clear3 = K.reachable(pair, K.pieceById(pair, 3)).filter(([c, r]) => !K.hazardAt(pair, c, r));
  assert.deepEqual(choose(pair, SEASONED, [CLEAR, ...jitters(clear3)]), { type: 'move', piece: 3, col: 5, row: 4 });
});

test('KG2 THE BEST BLOW: attack and a draw, 40 more at the king, 30 more for a kill - a draw a pair, the first kept on a tie', () => {
  // host: king 0, Daedra Lord 1, Daedra Lord 2; the regular: king 3, Daedra Lord 4, Rat 5
  const st = board([31, 31], [31, 0]);
  at(st, 4, 3, 5); at(st, 1, 3, 6);    // the regular's Lord over the host's first Lord
  at(st, 5, 10, 5); at(st, 0, 10, 6);  // the regular's Rat over the host's king
  at(st, 2, 0, 12); at(st, 3, 7, 0);
  // 40 + u for the Lord's blow, 2 + 40 + u for the Rat's at the king: the king, whatever the draws
  assert.deepEqual(choose(st, SEASONED, [CLEAR, V(0.99), V(0)]), { type: 'attack', piece: 5, target: 0 });
  // a kill: the host's Lord at 40 health - 40 + 30 + u
  K.pieceById(st, 1).hp = 40;
  assert.deepEqual(choose(st, SEASONED, [CLEAR, V(0), V(0.99)]), { type: 'attack', piece: 4, target: 1 });
  K.pieceById(st, 1).hp = 41;
  assert.deepEqual(choose(st, SEASONED, [CLEAR, V(0.99), V(0)]), { type: 'attack', piece: 5, target: 0 }, '41 is no kill');
  // two blows alike: the draw decides, the first kept when it does not
  const tie = board([31, 31], [31]);
  at(tie, 4, 5, 5); at(tie, 1, 4, 5); at(tie, 2, 6, 5); at(tie, 3, 7, 0);
  assert.deepEqual(choose(tie, SEASONED, [CLEAR, V(0.5), V(0.5)]), { type: 'attack', piece: 4, target: 1 });
  assert.deepEqual(choose(tie, SEASONED, [CLEAR, V(0.5), V(0.6)]), { type: 'attack', piece: 4, target: 2 });
});

test('KG2 THE BEST MOVE: into range (more at the king, a ranged piece keeping its distance), else nearer; a king flees; above 0 alone', () => {
  // the host's Rat 1 at (7, 9) and king 0 at (7, 12); the regular's king 2 at (7, 0), Rat 3 at (7, 3)
  const st = board([0], [0]);
  at(st, 1, 7, 9);
  at(st, 3, 7, 3);
  /** The regular's draws: the blunder's, then a jitter for every cell each of the regular's pieces (2, then 3) reaches. */
  const draws = (s, wins) => [CLEAR, ...[2, 3].flatMap((id) => jitters(K.reachable(s, K.pieceById(s, id)), wins))];
  // nearer by three steps (9): the regular's king, unalarmed nine steps off, never moves (-100)
  assert.deepEqual(choose(st, SEASONED, draws(st)), { type: 'move', piece: 3, col: 7, row: 6 });
  // an active hazard on it (-40): two steps nearer (6) instead
  lay(st, 7, 6, 'fire');
  assert.deepEqual(choose(st, SEASONED, draws(st)), { type: 'move', piece: 3, col: 7, row: 5 });
  // a warning there (-8) and an active hazard on (7, 5): (7, 6) scores 1, below a step nearer (3) - three cells tie at
  // 3, the draw picks (6, 5)
  st.hazards = [];
  lay(st, 7, 6, 'fire', false);
  lay(st, 7, 5, 'fire');
  assert.deepEqual(choose(st, SEASONED, draws(st, [[6, 5]])), { type: 'move', piece: 3, col: 6, row: 5 });
  assert.deepEqual(choose(st, SEASONED, draws(st)), { type: 'move', piece: 3, col: 7, row: 4 }, 'drawn alike: the first in GetReachable\'s order');
  // INTO RANGE: the Rat from (7, 5) reaches (7, 8), beside the host's Rat - 50 over any step nearer; beside the host's
  // king, moved to (5, 7), 70: (5, 6) or (6, 7), the draw deciding
  const into = board([0], [0]);
  at(into, 1, 7, 9);
  at(into, 3, 7, 5);
  assert.deepEqual(choose(into, SEASONED, draws(into)), { type: 'move', piece: 3, col: 7, row: 8 });
  // THE HAZARD DANCE's first step: an active hazard on the one cell in range - 50 less 40 is 10, over two steps nearer
  // (6); on the turn's last action the Rat steps off it again before it strikes (the escape, above)
  lay(into, 7, 8, 'fire');
  assert.deepEqual(choose(into, SEASONED, draws(into)), { type: 'move', piece: 3, col: 7, row: 8 });
  into.hazards = [];
  at(into, 0, 5, 7);
  // (7, 8), beside the Rat alone, drawn highest (0.09): the king's 20 still carries (6, 7)
  const kingFirst = [CLEAR, ...jitters(K.reachable(into, K.pieceById(into, 2))),
    ...K.reachable(into, K.pieceById(into, 3)).map(([c, r]) => (c === 7 && r === 8 ? V(0.9) : c === 6 && r === 7 ? V(0.5) : V(0)))];
  assert.deepEqual(choose(into, SEASONED, kingFirst), { type: 'move', piece: 3, col: 6, row: 7 });
  // A RANGED PIECE keeps its distance: the Mage from (7, 3) to (7, 5), four steps off - 52 - over (7, 6) at three
  // (51.5), however high (7, 6)'s draw (0.09: the jitter breaks ties, it never bridges half a point)
  const mage = board([0], [128]);
  at(mage, 1, 7, 9);
  at(mage, 3, 7, 3);
  const high = (s, id, cell) => K.reachable(s, K.pieceById(s, id)).map(([c, r]) => (c === cell[0] && r === cell[1] ? V(0.9) : V(0)));
  assert.deepEqual(choose(mage, SEASONED, [CLEAR, ...high(mage, 2, [-1, -1]), ...high(mage, 3, [7, 6])]), { type: 'move', piece: 3, col: 7, row: 5 });
  // A KING ALARMED: a foe within four steps - it flees by the gain times 5; the Rat taken off the board
  const flee = board([0], [0]);
  flee.pieces = flee.pieces.filter((p) => p.id !== 3);
  at(flee, 1, 7, 9);
  at(flee, 2, 7, 6);
  const fc = K.reachable(flee, K.pieceById(flee, 2));
  assert.deepEqual(choose(flee, SEASONED, [CLEAR, ...jitters(fc, [[10, 6]])]), { type: 'move', piece: 2, col: 10, row: 6 }, 'seven cells six steps off tie');
  at(flee, 2, 7, 4);   // five steps off: no alarm, no move above 0
  assert.equal(choose(flee, SEASONED, [CLEAR, ...jitters(K.reachable(flee, K.pieceById(flee, 2)))]), null);
});

test('KG2 THE WEIGHTS AT THEIR EDGES: each of the mod\'s numbers decides a choice it alone decides, on a board built for it', () => {
  /** A board sealed in two: row 1 walls end to end, row 0 a corridor of its own. */
  const sealed = (host, guest) => {
    const st = board(host, guest);
    for (let c = 0; c < K.KG_COLS; c++) st.tiles[K.cellIndex(c, 1)] = K.KG_TILE.wall;
    return st;
  };
  /** The regular's draws: the blunder's, then one a cell for each of the regular's pieces in order, `x` for the cells named. */
  const drawn = (st, named = {}) => [CLEAR, ...st.pieces.filter((p) => p.side === 1).flatMap((p) => K.reachable(st, p)
    .map(([c, r]) => V(named[`${p.id}:${c},${r}`] ?? 0)))];

  // THE KING FLEES BY 5 A STEP, A STEP NEARER IS 3: the regular's king in the corridor at (1, 0), the host's first Rat at
  // (4, 0) - one step away to (0, 0) is all it has (5); the regular's Rat in the hall two steps nearer the host's second
  // Rat (6), the third
  // step's cell under an active hazard. The king's draw is the higher, and the Rat's 6 still carries.
  const flee1 = sealed([0, 0], [0]);
  at(flee1, 3, 1, 0); at(flee1, 1, 4, 0);
  at(flee1, 4, 7, 4); at(flee1, 2, 7, 9); at(flee1, 0, 0, 12);
  lay(flee1, 7, 7, 'fire');
  assert.deepEqual(choose(flee1, SEASONED, drawn(flee1, { '3:0,0': 0.9 })), { type: 'move', piece: 4, col: 7, row: 6 });

  // THE DANCE'S 10 AGAINST A KING'S TWO STEPS AWAY (10): drawn alike but for one, the draw decides - the regular's king at
  // (2, 0) flees to (0, 0); the regular's Rat's one cell in range, (7, 8), under an active hazard (50 - 40)
  const dance = sealed([0, 0], [0]);
  at(dance, 3, 2, 0); at(dance, 1, 5, 0);
  at(dance, 4, 7, 5); at(dance, 2, 7, 9); at(dance, 0, 0, 12);
  lay(dance, 7, 8, 'fire');
  assert.deepEqual(choose(dance, SEASONED, drawn(dance, { '3:0,0': 0.5 })), { type: 'move', piece: 3, col: 0, row: 0 });
  assert.deepEqual(choose(dance, SEASONED, drawn(dance, { '4:7,8': 0.5 })), { type: 'move', piece: 4, col: 7, row: 8 });

  // ONLY ABOVE 0 MOVES: the regular's Rat in the corridor, no foe walks to it - every step gains nothing; drawn 0, no move; any draw
  // above 0 and it wanders
  const idle = sealed([0], [0]);
  at(idle, 3, 5, 0);
  assert.equal(choose(idle, SEASONED, drawn(idle)), null);
  assert.deepEqual(choose(idle, SEASONED, drawn(idle, { '3:6,0': 0.5 })), { type: 'move', piece: 3, col: 6, row: 0 });

  // ACROSS WATER, A RANGED PIECE'S WALK: row 6 water but a bridge at (14, 6). The host's Rat at (8, 7); the regular's Mage at
  // (5, 3) reaches three cells in range of it, each a walk of 16 - with a warning on each, 50 + 8 - 8 = 50 - and the Rat, in the
  // south, steps beside the host's Rat for a clean 50: drawn alike, the draw decides
  const across = (named) => {
    const st = board([0], [128, 0]);
    for (let c = 0; c < K.KG_COLS - 1; c++) st.tiles[K.cellIndex(c, 6)] = K.KG_TILE.water;
    at(st, 1, 8, 7); at(st, 0, 0, 12);
    at(st, 3, 5, 3); at(st, 4, 8, 10);
    for (const [c, r] of [[8, 3], [7, 4], [6, 5]]) lay(st, c, r, 'spikes', false);
    return choose(st, SEASONED, drawn(st, named));
  };
  assert.deepEqual(across({ '3:7,4': 0.5, '4:8,8': 0.25 }), { type: 'move', piece: 3, col: 7, row: 4 });
  assert.deepEqual(across({ '3:7,4': 0.25, '4:8,8': 0.5 }), { type: 'move', piece: 4, col: 8, row: 8 });

  // THE WALK IS COUNTED TO 20: the host's Rat at (6, 7), the regular's Mage at (6, 2) - in range at (6, 3) and (5, 4), walks of 20
  // (60), and at (6, 4), a walk of 19 (59.5), drawn highest
  const far = board([0], [128]);
  for (let c = 0; c < K.KG_COLS - 1; c++) far.tiles[K.cellIndex(c, 6)] = K.KG_TILE.water;
  at(far, 1, 6, 7); at(far, 3, 6, 2);
  assert.deepEqual(choose(far, SEASONED, drawn(far, { '3:6,4': 0.9, '3:6,3': 0.5 })), { type: 'move', piece: 3, col: 6, row: 3 });

  // THE BLOW'S 40 AT THE KING: the regular's Ancient Lich (42) at a host Daedra Lord, its Rat (2) at the host's king - 42 + u
  // against 2 + 40 + u: the draws decide, either way
  const blows = (named) => {
    const st = board([31], [33, 0]);
    at(st, 3, 3, 5); at(st, 1, 3, 6);
    at(st, 4, 10, 5); at(st, 0, 10, 6);
    return choose(st, SEASONED, [CLEAR, V(named.lich), V(named.rat)]);
  };
  assert.deepEqual(blows({ lich: 0.5, rat: 0.6 }), { type: 'attack', piece: 4, target: 0 });
  assert.deepEqual(blows({ lich: 0.6, rat: 0.5 }), { type: 'attack', piece: 3, target: 1 });
  // THE BLOW'S 30 FOR A KILL: the regular's Dreugh (32) at a host Daedra Lord, its Rat (2) at the host's Rat on 2 health
  const kills = (named) => {
    const st = board([31, 0], [41, 0]);
    at(st, 4, 3, 5); at(st, 1, 3, 6);
    at(st, 5, 10, 5); at(st, 2, 10, 6);
    K.pieceById(st, 2).hp = 2;
    return choose(st, SEASONED, [CLEAR, V(named.dreugh), V(named.rat)]);
  };
  assert.deepEqual(kills({ dreugh: 0.5, rat: 0.6 }), { type: 'attack', piece: 5, target: 2 });
  assert.deepEqual(kills({ dreugh: 0.6, rat: 0.5 }), { type: 'attack', piece: 4, target: 1 });
});

test('KG2 AT FLOAT32: every score is rounded as the C# keeps it, and the rounding decides - the king\'s 20 and the jitter\'s 0.1 included', () => {
  // A score is rounded to float32 once its jitter is added, so two cells of one score compare their draws on float32's
  // grid at that score's size - and a weight that moves the score across a power of two, or a jitter twice as large,
  // turns a tie (the first kept) into an order, or back (AUDIT KG B1: the record had called the king's 20 at 19 or 21,
  // and the jitter at 0.2, changes no choice could see).
  const drawn = (st, named) => [CLEAR, ...st.pieces.filter((p) => p.side === 1).flatMap((p) => K.reachable(st, p)
    .map(([c, r]) => named[`${p.id}:${c},${r}`] ?? 0))];
  // THE JITTER'S 0.1: three cells tie at 3 (the best move's board) - raw 2147483648 on (7, 4) and 2147484289 on (6, 5)
  // round to one score at 0.1, and (7, 4), the first, is kept; at 0.2 (exactly twice 0.1f) they part
  const three = board([0], [0]);
  at(three, 1, 7, 9);
  at(three, 3, 7, 3);
  lay(three, 7, 6, 'fire', false);
  lay(three, 7, 5, 'fire');
  assert.deepEqual(choose(three, SEASONED, drawn(three, { '3:7,4': 2147483648, '3:6,5': 2147484289 })), { type: 'move', piece: 3, col: 7, row: 4 });
  // THE KING'S 20: the host's king alone at (7, 9), the regular's Mage at (6, 5). Every cell the Mage reaches in range of
  // the king lies under a warning to `edge` steps off and an active hazard past it, so the best are the cells `edge` off
  // (62 + edge / 2). Their draws, raw 2147483648 and 2147532672, part at 63.5 and tie at 64 - so the second is taken at
  // three steps (the king's 21 would tie them, at 64.5) and the first at four (its 19 would part them, at 63)
  const mage = (edge) => {
    const st = board([0], [128]);
    st.pieces = st.pieces.filter((p) => p.id !== 1);
    at(st, 0, 7, 9);
    at(st, 3, 6, 5);
    const m = K.pieceById(st, 3), best = [];
    for (const [c, r] of K.reachable(st, m)) {
      if (!K.targetInRange(st, m, c, r, K.pieceById(st, 0))) continue;
      const d = K.distance(c, r, 7, 9);
      lay(st, c, r, 'spikes', d > edge);
      if (d === edge) best.push(`3:${c},${r}`);
    }
    return choose(st, SEASONED, drawn(st, { [best[0]]: 2147483648, [best[1]]: 2147532672 }));
  };
  assert.deepEqual(mage(3), { type: 'move', piece: 3, col: 6, row: 7 });
  assert.deepEqual(mage(4), { type: 'move', piece: 3, col: 7, row: 5 });
  // AN ESCAPE'S SCORE: the regular's king on spikes with 6 (no potion), two clear cells nine steps from the host's Rat -
  // raw 4212559656 and 4212586870 make one score at 9 (9.0980816), and (8, 3), the first, is kept
  const king = board([0], [0], { potions: [3, 0] });
  king.pieces = king.pieces.filter((p) => p.id !== 3);
  at(king, 1, 7, 11);
  at(king, 0, 0, 12);
  at(king, 2, 7, 5).hp = 6;
  lay(king, 7, 5, 'spikes');
  for (const [c, r] of K.reachable(king, K.pieceById(king, 2))) if (!(r === 3 && (c === 6 || c === 8))) lay(king, c, r, 'poison', false);
  assert.deepEqual(choose(king, SEASONED, [CLEAR, 4212559656, 4212586870]), { type: 'move', piece: 2, col: 8, row: 3 });
  // A BLOW'S SCORE: the regular's Dreugh (32) between two host Daedra Lords - 32.5 and 32 + 0.5 + 2^-20 are one float32
  const blow = board([31, 31], [41]);
  at(blow, 4, 5, 5); at(blow, 1, 4, 5); at(blow, 2, 6, 5); at(blow, 3, 7, 0);
  assert.deepEqual(choose(blow, SEASONED, [CLEAR, 2 ** 31, 2 ** 31 + 4096]), { type: 'attack', piece: 4, target: 1 });
});

test('KG2 A STEP (AiTurnRoutine without its clock): two actions, then the turn ending; none found ends it; not the regular\'s, nothing', () => {
  const st = board([0], [0]);
  at(st, 1, 7, 11);
  at(st, 3, 7, 10);
  // the regular's Rat strikes the host's twice (2, then 2 again - a Rat's blow at any roll); the turn is ending after
  const one = G.regularStep(st, 1, SEASONED, script([CLEAR, V(0)]), script([V(0)]));
  assert.deepEqual(one.cmd, { type: 'attack', piece: 3, target: 1 });
  assert.equal(one.state.actions, 1);
  const two = G.regularStep(one.state, 1, SEASONED, script([CLEAR, V(0)]), script([V(0)]));
  assert.deepEqual(two.cmd, { type: 'attack', piece: 3, target: 1 });
  assert.equal(two.state.ending, true);
  // not the regular's to take: no step, and no draw taken - from sources that would choose a blow if asked (a dry
  // source would answer null anyway, now that a broken source takes no step)
  for (const [state, side, why] of [[two.state, 1, 'the turn is ending'], [st, 0, 'not the regular\'s turn'], [{ ...st, over: { winner: 0, fallen: 1 } }, 1, 'the game over']]) {
    const src = script([CLEAR, V(0)]);
    assert.equal(G.regularStep(state, side, SEASONED, src, script([V(0)])), null, why);
    assert.equal(src.left(), 2, `${why}: no draw taken`);
  }
  // no action found: End turn
  const lone = board([0], [0]);
  lone.pieces = lone.pieces.filter((p) => p.id !== 3);
  const idle = G.regularStep(lone, 1, SEASONED, script([CLEAR, ...jitters(K.reachable(lone, K.pieceById(lone, 2)))]), script([]));
  assert.deepEqual(idle.cmd, { type: 'end' });
  assert.deepEqual(idle.events, [{ t: 'end', side: 1 }]);
  assert.equal(idle.state.ending, true);
  // a blow the law refuses (a broken source for its roll): End turn, nothing struck
  const broken = G.regularStep(st, 1, SEASONED, script([CLEAR, V(0)]), () => 1.5);
  assert.deepEqual(broken.cmd, { type: 'end' });
  assert.equal(K.pieceById(broken.state, 1).hp, 12);
  // A CHOICES' SOURCE THAT IS NO SOURCE TAKES NO STEP - never a turn passed in silence (AUDIT KG B8): a draw that is no
  // 32-bit draw, one that runs dry, and one stuck past the law's bound (a stuck source spun drawBelow for ever)
  assert.equal(G.regularStep(st, 1, SEASONED, () => 1.5, script([])), null);
  assert.equal(G.regularStep(st, 1, SEASONED, script([CLEAR]), script([])), null);
  let stuck = 0;
  const blunderer = board([0], [0]);
  assert.equal(G.regularStep(blunderer, 1, AMATEUR, () => (stuck++ ? 0xFFFFFFFF : V(0.3)), script([])), null);
  assert.ok(stuck <= K.KG_RAND_DRAWS_MAX + 1, 'refused at the bound');
  // A TIER THE PLAY CANNOT READ TAKES NO STEP (AUDIT KG B8): a key for a tier, a share that is no number - each would
  // have played a Grandmaster's game unseen (`x < NaN` is false)
  for (const tier of ['amateur', { blunder: NaN }, { blunder: '0.35' }, { blunder: 1.5 }, null]) {
    assert.equal(G.regularStep(st, 1, tier, script([CLEAR, V(0)]), script([V(0)])), null, JSON.stringify(tier));
    assert.equal(G.regularAction(st, 1, tier, script([CLEAR, V(0)])), null);
  }
});

test('KG2 MEASURED, in miniature (tools/kgMeasure.mjs): each tier against an Auto-filled 300 - the record\'s run, sixteen games a tier', () => {
  // the tallies, game for game the measure's own first sixteen: a change to the law or the play that moves a game
  // moves them (the record's 1,000-game figures are the same command's: section 12)
  const tallies = G.GAMBIT_TIERS.map((tier) => measureTier(tier, { games: 16, seed: 1 }));
  assert.deepEqual(tallies, [
    { regular: 1, player: 15, kings: 0, long: 0, rounds: 375, longest: 33 },
    { regular: 2, player: 12, kings: 2, long: 0, rounds: 398, longest: 43 },
    { regular: 10, player: 4, kings: 2, long: 0, rounds: 436, longest: 53 },
    { regular: 11, player: 1, kings: 2, long: 2, rounds: 363, longest: 48 },
  ]);
  const won = tallies.map((t) => t.regular);
  assert.ok(won.every((w, i) => i === 0 || w >= won[i - 1]), `a higher tier wins no less: ${won}`);
  // the same seed, the same game; a game undecided at the cap is counted by what stands - armies (the Grandmaster's
  // dance), or the two kings alone
  assert.deepEqual(playRegular(VETERAN, gameSeed(1, 3)), playRegular(VETERAN, gameSeed(1, 3)));
  assert.deepEqual(playRegular(GRANDMASTER, gameSeed(1, 0)), { end: 'long', rounds: 201 });
  assert.deepEqual(playRegular(SEASONED, gameSeed(1, 6)), { end: 'kings', rounds: 201 });
  // TWO KINGS ALONE ARE PLAYED ON (AUDIT KG B3): the kings stand alone from round 48, and the regular's blunders walk
  // its king to its fall at round 189 - a game the first measure had stopped at 48 and set apart
  assert.deepEqual(playRegular(SEASONED, gameSeed(1, 40)), { end: 'player', rounds: 189 });
  // the games' seeds mixed (AUDIT KG B5): neighbouring games' first draws no longer near one another
  const firsts = Array.from({ length: 2000 }, (_, g) => xorshift(gameSeed(1, g))() / 2 ** 32);
  const mean = firsts.reduce((a, b) => a + b) / firsts.length;
  let lag = 0, sq = 0;
  for (let g = 0; g < firsts.length; g++) { sq += (firsts[g] - mean) ** 2; if (g) lag += (firsts[g] - mean) * (firsts[g - 1] - mean); }
  assert.ok(Math.abs(lag / sq) < 0.1, `lag-1 correlation ${(lag / sq).toFixed(3)}`);
});
