// ARENA2 (2026-10-02, Mac: "climb esclating tiers of opponents"; "Being a top rank PvE fighter comes with it's own
// title"): THE LADDER (systems/arenaLadder.js) - the ten tiers exactly as the design table has them, the purses on
// Daggerfall's scale, a climb from the Pit to the Grand Champion, a loss that costs only the purse, the save's shape
// (versioned, every older or broken shape read back to a whole ladder, the round trip through systems/save.js), the
// exhibitions on the hour of the game's clock (one hour, one bout, everywhere), and the fighters' names from
// Daggerfall's own generator (systems/arenaFighters.js) - the seed's, the stream put back as it stood.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LADDER_TIERS, BOUT_PURSE, CHAMPION_PURSE, EXHIBITION_PURSE, BOUTS_PER_TIER, ARENA_LADDER_VERSION, newArenaLadder,
  arenaLadderRestore, arenaLadderSnapshot, nextLadderBout, ladderAfter, ladderTitle, ladderTitles, exhibitionFor,
  nextExhibitionHour, hourIndexOf, arenaHash, seededRng, EXHIBITION_HOURS, EXHIBITION_START_MINUTES, ARENA_HOMES, BEAST_HOMES,
} from '../src/systems/arenaLadder.js';
import { fighterIdentity, boutMarks, boutGateOf, ARENA_BEASTS, MARK_APART_M, GATE_OUT_M } from '../src/systems/arenaFighters.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { getSeed, setSeed, rand } from '../src/formats/dfRandom.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const ids = (list) => list.map((o) => o.mobile);
const lv = (list) => list.map((o) => o.level);

test('ARENA2 ladder: the ten tiers are the design table\'s, row for row', () => {
  assert.equal(LADDER_TIERS.length, 10);
  assert.deepEqual(ARENA_TEXT.tiers, ['The Pit', 'Bloodied', 'Sworn', 'Gladiator', 'Myrmidon', 'Bloodsworn', 'Hero', 'Champion', 'Paragon', 'The Grand Melee']);
  const T = LADDER_TIERS;
  assert.deepEqual(T[0].bouts.map(ids), [[M.Thief], [M.Rogue], [M.Barbarian]]);
  assert.deepEqual(T[0].bouts.map(lv), [[1], [2], [3]], 'levels 1-3');
  assert.deepEqual(ids(T[0].champion), [M.Barbarian]);
  assert.deepEqual(T[1].bouts.map(ids), [[M.Warrior], [M.Monk], [M.Archer]]);
  assert.deepEqual(T[1].bouts.map(lv), [[3], [4], [5]]);
  assert.deepEqual(ids(T[1].champion), [M.Knight]);
  assert.deepEqual(T[2].bouts.map(ids), [[M.Spellsword], [M.Nightblade], [M.Ranger]]);
  assert.deepEqual(ids(T[2].champion), [M.Battlemage]);
  assert.deepEqual(T[3].bouts.map(ids), [[M.Knight], [M.Barbarian], [M.Healer]]);
  assert.deepEqual(T[3].bouts.map(lv), [[7], [8], [9]]);
  assert.deepEqual(ids(T[3].champion), [M.Assassin]);
  assert.deepEqual(T[4].bouts.map(ids), [[M.Battlemage], [M.Sorcerer], [M.Warrior]]);
  assert.deepEqual(ids(T[4].champion), [M.Warrior, M.Warrior], 'two Warriors at once');
  assert.deepEqual(T[5].bouts.map(ids), [[M.GrizzlyBear], [M.SabertoothTiger], [M.GiantScorpion]], 'the beasts');
  assert.deepEqual(T[5].bouts.map(lv), [[null], [null], [null]], 'a monster at its own level');
  assert.equal(T[5].beasts, true);
  assert.deepEqual(ids(T[5].champion), [M.Spriggan]);
  assert.deepEqual(T[6].bouts.map(ids), [[M.Knight], [M.Spellsword], [M.Nightblade]]);
  assert.deepEqual(T[6].bouts.map(lv), [[13], [14], [15]]);
  assert.deepEqual(ids(T[6].champion), [M.OrcWarlord]);
  assert.deepEqual(T[7].bouts.map(ids), [[M.Assassin], [M.Battlemage], [M.Monk]]);
  assert.deepEqual(ids(T[7].champion), [M.DaedraSeducer]);
  assert.deepEqual(T[8].bouts.map(ids), [[M.Knight, M.Healer], [M.Warrior, M.Mage], [M.Knight, M.Mage]], 'two against one');
  assert.deepEqual(T[8].bouts.map(lv), [[17, 17], [18, 18], [19, 19]]);
  assert.deepEqual(ids(T[8].champion), [M.Vampire]);
  assert.equal(T[9].free, true, 'the Grand Melee: every fighter for themselves');
  assert.ok(T[9].bouts.every((b) => b.length === 3));
  assert.ok(T[9].bouts.flat().every((o) => o.level === null || o.level >= 20), 'levels 20 and up');
  assert.deepEqual(ids(T[9].bouts[2]), [M.Vampire, M.DaedraSeducer, M.OrcWarlord], 'the champions\' survivors');
  assert.deepEqual(ids(T[9].champion), [M.IronAtronach], 'the Grand Champion');
  assert.ok(Object.isFrozen(T) && Object.isFrozen(T[0]) && Object.isFrozen(T[0].bouts[0]));
});

test('ARENA2 ladder: the purses - a tier-1 win 50 gold, the Grand Champion 10,000; every purse rising', () => {
  assert.equal(BOUT_PURSE[0], 50);
  assert.equal(CHAMPION_PURSE[9], 10000);
  assert.equal(BOUT_PURSE.length, 10);
  assert.equal(CHAMPION_PURSE.length, 10);
  for (let i = 1; i < 10; i++) { assert.ok(BOUT_PURSE[i] > BOUT_PURSE[i - 1]); assert.ok(CHAMPION_PURSE[i] > CHAMPION_PURSE[i - 1]); }
  for (let i = 0; i < 10; i++) assert.ok(CHAMPION_PURSE[i] > BOUT_PURSE[i], 'a champion pays more than a bout');
  assert.equal(EXHIBITION_PURSE, 100);
});

test('ARENA2 ladder: a climb - three bouts, the champion, the tier up and its title; a loss breaks the tier\'s run (AUDIT ARENA-LADDER)', () => {
  let L = newArenaLadder();
  assert.equal(L.v, ARENA_LADDER_VERSION);
  let n = nextLadderBout(L);
  assert.deepEqual([n.tier, n.bout, n.champion, n.grand, n.purse, n.label, n.tierName], [0, 0, false, false, 50, 'bout 1 of 3', 'The Pit']);
  let out = ladderAfter(L, { won: false, how: 'fall' });
  assert.deepEqual([out.ladder.tier, out.ladder.won], [0, 0], 'a loss moves nothing');
  assert.deepEqual([out.ladder.record.losses, out.ladder.record.falls], [1, 1]);
  L = out.ladder;
  const once = ladderAfter(L, { won: true, purse: 50 }).ladder;
  // AUDIT ARENA-LADDER (the owner's call, "Lose the tier's run"): a loss after a win sends the climb back to the tier's first bout
  const broken = ladderAfter(once, { won: false, how: 'fall' });
  assert.deepEqual([broken.ladder.tier, broken.ladder.won, broken.runLost], [0, 0, true], 'a loss after a win breaks the run');
  assert.equal(out.runLost, false, 'a loss with no run to break says none');
  for (const how of ['yield', 'ringout', 'judges']) { const o = ladderAfter(L, { won: false, how }); L = o.ladder; }
  assert.deepEqual([L.record.yields, L.record.ringouts, L.record.losses], [1, 1, 4]);
  for (let i = 0; i < BOUTS_PER_TIER; i++) { out = ladderAfter(L, { won: true, purse: 50 }); L = out.ladder; assert.equal(out.title, null); }
  n = nextLadderBout(L);
  assert.equal(n.champion, true);
  assert.equal(n.label, 'the Tier Champion');
  assert.equal(n.purse, 200);
  out = ladderAfter(L, { won: true, purse: 200 });
  assert.equal(out.tierUp, true);
  assert.equal(out.title, 'Pit Fighter');
  L = out.ladder;
  assert.deepEqual([L.tier, L.won, L.champs[0]], [1, 0, true]);
  assert.equal(L.record.wins, 4);
  assert.equal(L.record.purses, 350);
  assert.equal(L.record.best, 4);
  assert.equal(ladderTitle(L), 'Pit Fighter');
  assert.deepEqual(ladderTitles(L), ['Pit Fighter']);
  // to the top
  for (let t = 1; t < 10; t++) for (let i = 0; i <= BOUTS_PER_TIER; i++) { out = ladderAfter(L, { won: true, purse: 1 }); L = out.ladder; }
  assert.equal(out.grand, true);
  assert.equal(L.grand, true);
  assert.equal(ladderTitle(L), 'Grand Champion');
  assert.equal(nextLadderBout(L), null, 'nothing left on the ladder');
  assert.equal(ladderAfter(L, { won: true }).ladder.record.wins, L.record.wins, 'and nothing counts after it');
  assert.equal(ladderTitles(L).length, 10);
});

test('ARENA2 ladder: the grand bout is tier 10\'s champion; the Grand Melee\'s bouts are free; the beast tier says so', () => {
  const L = arenaLadderRestore({ tier: 9, won: 3 });
  const n = nextLadderBout(L);
  assert.equal(n.grand, true);
  assert.equal(n.label, 'the Grand Champion');
  assert.equal(n.purse, 10000);
  assert.equal(n.free, false, 'the Grand Champion stands alone');
  assert.equal(nextLadderBout({ tier: 9, won: 0 }).free, true);
  assert.equal(nextLadderBout({ tier: 5, won: 1 }).beasts, true);
});

test('ARENA2 ladder: THE SAVE - any shape back to a whole ladder; the snapshot a copy; the round trip through save.js', () => {
  const fresh = newArenaLadder();
  assert.deepEqual(arenaLadderRestore(undefined), fresh, 'a save from before ARENA2 climbs from the Pit');
  assert.deepEqual(arenaLadderRestore('junk'), fresh);
  const odd = arenaLadderRestore({ tier: 99, won: -4, champs: [true, 'yes', true], grand: 1, record: { wins: 3.7, losses: 'x', purses: 1e12 } });
  assert.deepEqual([odd.tier, odd.won, odd.champs.slice(0, 3), odd.grand], [9, 0, [true, false, true], false]);
  assert.deepEqual([odd.record.wins, odd.record.losses, odd.record.purses], [3, 0, 1e9]);
  const L = ladderAfter(fresh, { won: true, purse: 50 }).ladder;
  const s = arenaLadderSnapshot(L);
  assert.deepEqual(s, { v: 1, tier: 0, won: 1, paid: 1, champs: Array(10).fill(false), grand: false, record: { ...L.record } });   // AUDIT ARENA-LADDER 2: `paid`, the tier's bouts ever won
  s.champs[0] = true;
  assert.equal(L.champs[0], false, 'a copy, never the live ladder');
  // through the save's own envelope
  const entity = { name: 'Hero', items: [], arenaLadder: ladderAfter(L, { won: true, purse: 50 }).ladder };
  const snap = snapshotPlayer(entity, {});
  assert.equal(snap.arena.won, 2);
  assert.equal(snap.arena.v, ARENA_LADDER_VERSION, 'versioned inside its own shape');
  const back = {};
  restorePlayer(back, JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(back.arenaLadder, arenaLadderRestore(entity.arenaLadder));
  // an envelope from before ARENA2 carries no `arena`: the ladder is a fresh one
  const old = JSON.parse(JSON.stringify(snap));
  delete old.arena;
  const back2 = {};
  restorePlayer(back2, old);
  assert.deepEqual(back2.arenaLadder, newArenaLadder());
});

test('ARENA2 ladder: THE EXHIBITIONS - one bout an hour of the gates\' hours, the same hour the same bout; open twenty minutes', () => {
  assert.deepEqual(EXHIBITION_HOURS, [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
  assert.equal(EXHIBITION_START_MINUTES, 20);
  const day = 400 * 1440;
  assert.equal(exhibitionFor(day + 3 * 60), null, 'the gates are shut at three in the morning');
  assert.equal(exhibitionFor(day + 22 * 60 + 5), null);
  const ex = exhibitionFor(day + 12 * 60 + 5);
  assert.equal(ex.hour, hourIndexOf(day + 12 * 60));
  assert.equal(ex.open, true);
  assert.equal(ex.startsAt, ex.hour * 60);
  assert.equal(exhibitionFor(day + 12 * 60 + 25).open, false, 'twenty minutes in it may not begin');
  assert.deepEqual(exhibitionFor(day + 12 * 60 + 59), { ...ex, open: false }, 'the same hour, the same bout');
  assert.equal(ex.opponents.length, 2);
  assert.notEqual(ex.opponents[0], ex.opponents[1], 'two different fighters');
  assert.ok(ex.tier >= 0 && ex.tier < 8, 'out of the one-against-one tiers');
  const seen = new Set();
  for (let h = 8; h < 22; h++) seen.add(JSON.stringify(exhibitionFor(day + h * 60).opponents));
  assert.ok(seen.size > 4, 'the day\'s bouts are not all one');
  assert.equal(nextExhibitionHour(day + 12 * 60 + 30), '13:00');
  assert.equal(nextExhibitionHour(day + 21 * 60 + 30), '08:00');
  assert.equal(hourIndexOf(-5), 0);
  assert.equal(arenaHash(5, 1), arenaHash(5, 1));
  assert.notEqual(arenaHash(5, 1), arenaHash(5, 2));
  const r = seededRng(9), r2 = seededRng(9);
  for (let i = 0; i < 5; i++) { const v = r(); assert.equal(v, r2()); assert.ok(v >= 0 && v < 1); }
});

test('ARENA2 fighters: names from Daggerfall\'s own generator by home, the seed\'s; DFU\'s stream put back as it stood', () => {
  setSeed(12345);
  const before = getSeed();
  const a = fighterIdentity(777, 0, M.Barbarian);
  assert.equal(getSeed(), before, 'the shared DFRandom stream is untouched');
  assert.deepEqual(fighterIdentity(777, 0, M.Barbarian), a, 'one seed, one fighter');
  assert.notDeepEqual(fighterIdentity(778, 0, M.Barbarian).name, undefined);
  assert.ok(a.name.length > 1);
  assert.ok(ARENA_HOMES.some((h) => h.town === a.home));
  assert.ok(ARENA_TEXT.epithets.includes(a.epithet));
  assert.equal(a.billing, `${a.name} of ${a.home}, ${a.epithet}`);
  assert.ok(a.temper >= 0.2 && a.temper <= 0.9);
  const bear = fighterIdentity(1, 0, M.GrizzlyBear);
  assert.equal(bear.beast, true);
  assert.equal(bear.temper, 0, 'a beast never yields');
  assert.equal(bear.name, 'The Grizzly Bear');
  assert.ok(BEAST_HOMES.includes(bear.home));
  assert.equal(bear.billing, `The Grizzly Bear of ${bear.home}`);
  assert.equal(fighterIdentity(1, 0, M.OrcWarlord).home, 'Orsinium');
  const seducer = fighterIdentity(1, 0, M.DaedraSeducer);
  assert.equal(seducer.home, 'Oblivion');
  assert.equal(seducer.gender, 'female');
  assert.equal(seducer.temper, 0);
  assert.equal(fighterIdentity(1, 0, M.Vampire).temper, 0);
  for (const id of ARENA_BEASTS) assert.equal(fighterIdentity(3, 1, id).beast, true);
  rand();
});

test('ARENA2 fighters: the marks - two sides apart on the long axis, a side\'s fighters abreast; a melee round the ring', () => {
  assert.deepEqual(boutMarks(2, [1, 1]), [[[-MARK_APART_M, 0]], [[MARK_APART_M, 0]]]);
  const m = boutMarks(2, [1, 2]);
  assert.deepEqual(m[1], [[MARK_APART_M, -1.25], [MARK_APART_M, 1.25]]);
  const melee = boutMarks(4, [1, 1, 1, 1]);
  assert.ok(Math.abs(melee[0][0][0] + MARK_APART_M) < 1e-9, 'side 0 (the player) on the west mark, the ladder\'s arrival');
  for (const [[x, z]] of melee) assert.ok(Math.abs(Math.hypot(x, z) - MARK_APART_M) < 1e-9);
  assert.deepEqual(boutGateOf([-6, 1]), [-GATE_OUT_M, 1]);
  assert.deepEqual(boutGateOf([0, 1]), [GATE_OUT_M, 1]);
});
