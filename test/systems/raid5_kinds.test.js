// RAID5 (2026-10-25, the owner: "rework town raids to bring them up to par with other world events, implementing
// mechanics (not the puzzle), different types of structure like wave based, defend, escort, etc"; asked which:
// "Waves", "Defend", "Escort", "Classic skirmish"; bible/03-World/Raiding-Parties.md RAID5): A RAID'S KIND.
//
// Held here: the kind read off the raid's own tuple (no draw - every machine the same, the relay's roll untouched) and
// the mod's raid on a host with no sites; the assault's plan and where a count stands in it; the words; the objective's
// wire word and its validator; each kind driven through a recording host - the assault's waves, breathers and its
// traited leader, the standard's bearer, its fall and the town sacked, the exodus's refugees walked, saved and lost;
// a town held paid more and its thanks richer; a reader told by the runner's word; a runner that takes over taking up
// what was said; the board's words; the save; the sites host on a grid of its own; and the world host's wiring.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  raidFrame as frame, restoreRaidSaveData as restoreSaveData, getRaidSaveData as getSaveData, raidState, setRaidingPartiesHost,
  raidKey, kindOf, raidHeld, raidWasHeld, raidObjWord, raidObjPeerWord, raidPeerWord, raidTimerList, cleansedLine,
  RAID_HELD_REP, MAX_RAID_ENEMIES, ACTOR_SWEEP_S, _resetRaidingParties,
} from '../../src/systems/raidingParties.js';
import {
  RAID_KIND_ORDER, STAFF_KIND, raidKindOf, raidWavePlan, raidWaveAt, RAID_WAVES_FOR, RAID_WAVE_BREATHER_S, RAID_LEADER_TRAITS,
  raidLeaderOf, raidLeaderName, raidKindAsk, raidKindName, raidWaveLine, raidLeaderLine, raidBearerFellLine,
  raidRefugeeSafeLine, raidRefugeeLostLine, raidHeldLine, raidObjectiveDetail, alongWay, wayLength, RAID_REFUGEES,
  RAID_REFUGEE_PACE, RAID_REFUGEE_WAIT_M, RAID_BEARER_HEALTH_X, RAID_BEARER_LEASH_M, RAID_REFUGEE_HEALTH_X, RAID_AIM_TICKS,
} from '../../src/systems/raidKinds.js';
import { validRaidObjWords, RAID_WORDS_MAX } from '../../src/world/raidShared.js';
import { rollRaidSpoils, RAID_HELD_GOLD_X } from '../../src/systems/raidSpoils.js';
import { createRaidSites, RAID_REFUGEE_KIND } from '../../src/scenes/raidSitesHost.js';
import { NAV_CELL } from '../../src/world/city/cityNavigation.js';
import { eventBoardModel } from '../../src/systems/eventBoard.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import { renownFoeStruck, _resetRenownKillsForTests } from '../../src/net/renownTracker.js';
import { _resetModSettings } from '../../src/systems/modSettings.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));
const DAY = 400;
const AT = (min) => DAY * MINUTES_PER_DAY + min;
const KEY = `3:7:${DAY}`;
const TOWN = 'Gothway Garden';
const raidRec = (o = {}) => ({
  regionIndex: 3, locationIndex: 7, startDay: DAY, locationName: TOWN, type: 2,
  startMinute: AT(600), endMinute: AT(720), killed: 0, attackAmount: 20, cleansed: false,
  announced: true, struck: false, px: 200, py: 100, ...o,
});
/** The fixture raid of a kind: the first start from 10:00 whose tuple reads it. */
function raidOf(kind, o = {}) {
  for (let m = 600; m < 700; m++) { const r = raidRec({ startMinute: AT(m), ...o }); if (raidKindOf(r) === kind) return r; }
  throw new Error(`no ${kind} tuple`);
}
const SQUARE = [10, 0, 10];
const WAY = [[0, 0, 0], [30, 0, 0]];

/** RAID1's recording host, with the town's sites (scenes/raidSitesHost.js's shape) and the foes' aims logged. */
function rig({ sites = true, me = null } = {}) {
  const at = { now: AT(610), wall: 100000, me, inTown: [], town: { regionIndex: 3, locationIndex: 7 }, pixel: { x: 200, y: 100 }, roll: 0, allowed: false, square: SQUARE, way: WAY };
  const log = { said: [], raiders: [], defenders: [], bearers: [], refugees: [], aims: [], removed: [] };
  const player = { legalRep: {} };
  let seq = 0;
  const foe = (mobileType, feet = [seq, 0, 0]) => {
    const f = { mobileType, dead: false, corpse: false, entity: { health: 10, maxHealth: 10, level: 5 }, uid: ++seq };
    f.ai = { feet: [...feet], target: null, makeEnemyHostileToAttacker: (g, gf, ms) => { log.aims.push([f, g, ms]); f.ai.target = g; } };
    return f;
  };
  const h = {
    now: () => at.now, random: () => at.roll, wallNow: () => at.wall, selfId: () => at.me, peersInTown: () => at.inTown,
    regionIndex: () => 3, regionName: (r) => `Region${r}`, townHere: () => at.town, playerPixel: () => at.pixel,
    standRaider: (mt) => { const f = foe(mt); log.raiders.push(f); return Promise.resolve(f); },
    standDefender: () => { const g = foe(146); g.defender = true; log.defenders.push(g); return Promise.resolve(g); },
    defenderCount: () => log.defenders.filter((g) => !g.dead).length, defendersAllowed: () => at.allowed,
    removeFoe: (f) => { f.dead = true; log.removed.push(f); }, outOfSight: () => true,
    reputation: () => ({ player, store: { dict: new Map() } }), say: (line) => log.said.push(line),
  };
  if (sites) {
    h.sites = () => ({
      square: () => at.square, way: () => at.way,
      standBearer: (post) => { const g = foe(146, post); g.raidBearer = true; log.bearers.push(g); return Promise.resolve(g); },
      standRefugee: (p, follow) => { const f = foe(RAID_REFUGEE_KIND, p); f.refugee = true; f.ai.follow = follow; log.refugees.push(f); return Promise.resolve(f); },
    });
  }
  setRaidingPartiesHost(h);
  return { at, log, player, h };
}
/** Frames of `dt` seconds, each let land, until `until` (or `n` of them). */
async function run(n, dt = 1, until = () => false) {
  const out = [];
  for (let i = 0; i < n && !until(); i++) { out.push(frame(dt)); await tick(); }
  return out;
}
const kill = (f) => { f.dead = true; f.corpse = true; };
const alive = (list) => list.filter((f) => !f.dead);

beforeEach(() => {
  _resetRaidingParties();
  _resetRenownKillsForTests();
  _resetModSettings();
  setSharedClock(null);
});

test('RAID5 a raid\'s kind is read off its own tuple - its key, start, target and party - never a draw: every machine names the same; all four come; a staff event is its own; a host with no sites runs the mod\'s raid (mutants: a draw of the roll; a field left out of the tuple; the kind on a bare host)', () => {
  const real = Math.random;
  Math.random = () => { throw new Error('a draw'); };
  try {
    const r = raidRec();
    assert.equal(raidKindOf(r), raidKindOf({ ...r }), 'the same raid, the same kind');
    const seen = new Set();
    for (let m = 600; m < 640; m++) seen.add(raidKindOf(raidRec({ startMinute: AT(m) })));
    assert.deepEqual([...seen].sort(), [...RAID_KIND_ORDER].sort(), 'all four come');
    const kinds = (o) => Array.from({ length: 24 }, (_, i) => raidKindOf(raidRec({ startMinute: AT(600 + i), ...o }))).join();
    assert.notEqual(kinds({}), kinds({ attackAmount: 21 }), 'the target is read');
    assert.notEqual(kinds({}), kinds({ type: 1 }), 'the party is read');
    assert.notEqual(kinds({}), kinds({ locationIndex: 8 }), 'the town is read');
    assert.equal(raidKindOf({ staff: { b: 1 } }), STAFF_KIND);
  } finally { Math.random = real; }
  rig({ sites: false });
  assert.equal(kindOf(raidOf('waves')), 'classic', 'no sites: the mod\'s raid');
  rig();
  assert.equal(kindOf(raidOf('waves')), 'waves');
});

test('RAID5 THE ASSAULT\'S PLAN: three waves (four past twenty), the target less its leader shared out, the first the biggest; a count\'s wave and what it still needs; the leader the last death (mutants: the leader\'s one not taken; the shares uneven; the wave off by one)', () => {
  assert.equal(RAID_WAVES_FOR(20), 3);
  assert.equal(RAID_WAVES_FOR(21), 4);
  assert.deepEqual(raidWavePlan(20), { sizes: [7, 6, 6], ends: [7, 13, 19], leaderAt: 19 });
  assert.deepEqual(raidWavePlan(21), { sizes: [5, 5, 5, 5], ends: [5, 10, 15, 20], leaderAt: 20 });
  assert.deepEqual(raidWavePlan(15).sizes, [5, 5, 4]);
  const p = raidWavePlan(20);
  assert.deepEqual(raidWaveAt(p, 0), { wave: 0, left: 7 });
  assert.deepEqual(raidWaveAt(p, 6), { wave: 0, left: 1 });
  assert.deepEqual(raidWaveAt(p, 7), { wave: 1, left: 6 });
  assert.deepEqual(raidWaveAt(p, 18), { wave: 2, left: 1 });
  assert.deepEqual(raidWaveAt(p, 19), { wave: 3, left: 1 }, 'the leader\'s turn');
  assert.deepEqual(raidWaveAt(p, 20), { wave: 3, left: 0 });
  assert.equal(raidLeaderOf(0), 145);
  assert.equal(raidLeaderOf(1), 139);
  assert.equal(raidLeaderOf(2), 24);
  assert.equal(raidLeaderName(2), 'Orc Warlord');   // PIN MOVED (AUDIT WORLD-EVENTS L5-8): the line's article its own
});

test('RAID5 the ways and the words: a point along a way and its length; what each kind asks; the board\'s detail of each objective; the kinds\' names (mutants: the way\'s end not kept; a detail\'s count off by one)', () => {
  assert.deepEqual(alongWay(WAY, 12), [12, 0, 0]);
  assert.deepEqual(alongWay([[0, 0, 0], [3, 0, 4], [3, 0, 10]], 7), [3, 0, 6]);
  assert.deepEqual(alongWay(WAY, 99), [30, 0, 0], 'the end past it');
  assert.equal(alongWay([], 1), null);
  assert.equal(wayLength([[0, 0, 0], [3, 0, 4], [3, 0, 10]]), 11);
  assert.equal(raidKindAsk('waves', TOWN), 'They come in waves. Hold until their leader falls.');
  assert.equal(raidKindAsk('defend', TOWN), `Keep the Standard-Bearer of ${TOWN} alive in the square.`);
  assert.equal(raidKindAsk('escort', TOWN), `Refugees flee to the square of ${TOWN}. See them there safely.`);
  assert.equal(raidKindAsk('classic', TOWN), '');
  assert.equal(raidObjectiveDetail('waves', { wave: 0, of: 3 }), 'Wave 1 of 3');
  assert.equal(raidObjectiveDetail('waves', { wave: 3, of: 3 }), 'Their leader');
  assert.equal(raidObjectiveDetail('defend', { pct: 42.4 }), 'Standard 42%');
  assert.equal(raidObjectiveDetail('defend', { pct: 0, fallen: true }), 'Sacked');
  assert.equal(raidObjectiveDetail('escort', { safe: 1, lost: 1, of: 3 }), 'Refugees: 1 of 3 safe, 1 lost');   // PIN MOVED (AUDIT WORLD-EVENTS L5-13)
  assert.equal(raidObjectiveDetail('classic', { wave: 0 }), '');
  assert.deepEqual(['classic', 'waves', 'defend', 'escort', 'staff'].map(raidKindName), ['', 'Assault', 'Siege of the Standard', 'Exodus', '']);   // PIN MOVED (AUDIT WORLD-EVENTS L5-15): a classic raid and a staff event name no kind (their words were never shown)
});

test('RAID5 the objective\'s word (`ro`): [key, kind, a, b] - a kind of a raid with one (never the classic), counts 0..100, each raid once, at most four; junk dropped, never guessed at (mutants: the classic let through; a bound off by one; a duplicate kept)', () => {
  const w = validRaidObjWords([[KEY, 2, 40, 0], [KEY, 3, 1, 1], ['1:2:400', 0, 0, 0], ['1:3:400', 4, 0, 0], ['1:4:400', 1, 101, 0], ['1:5:400', 1, 0, -1], ['1:6:400', 1, 1.5, 0], ['bad', 1, 0, 0], ['1:7:400', 1, 0], ['1:8:400', 3, 100, 100]]);
  assert.deepEqual(w, [{ key: KEY, k: 2, a: 40, b: 0 }, { key: '1:8:400', k: 3, a: 100, b: 100 }]);
  assert.equal(validRaidObjWords(Array.from({ length: 9 }, (_, i) => [`${i}:1:400`, 1, 0, 0])).length, RAID_WORDS_MAX);
  assert.deepEqual(validRaidObjWords('nope'), []);
});

test('RAID5 THE ASSAULT, run: the first wave its size and no more, said with what the town asks; it falls and a breather holds the next; the last is the party\'s leader alone - an elite with two boss traits, said - and its fall cleanses the town HELD: the thanks more, said (mutants: the wave\'s size ignored; the breather skipped; the leader untraited; the held reputation unpaid)', async () => {
  const { at, log, player } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('waves')] });
  await run(40, 1, () => log.raiders.length >= 7);
  await run(20);
  assert.equal(log.raiders.length, 7, 'the first wave whole, no more');
  assert.ok(log.said.includes(raidKindAsk('waves', TOWN)), 'what the town asks');
  assert.equal(log.said.filter((l) => l === raidWaveLine(1, 3, TOWN)).length, 1, 'its wave said once');
  renownFoeStruck(log.raiders[0]);
  log.raiders.forEach(kill);
  await run(5);
  assert.equal(log.raiders.length, 7, 'the breather');
  for (const [wave, size] of [[2, 6], [3, 6]]) {
    at.wall += RAID_WAVE_BREATHER_S * 1000;
    const n = log.raiders.length;
    await run(40, 1, () => alive(log.raiders).length >= size);
    await run(10);
    assert.equal(log.raiders.length, n + size, `wave ${wave}: its size`);
    assert.ok(log.said.includes(raidWaveLine(wave, 3, TOWN)));
    alive(log.raiders).forEach(kill);
    await run(2);
  }
  assert.equal(raidState().raids[0].killed, 19);
  at.wall += RAID_WAVE_BREATHER_S * 1000;
  await run(20, 1, () => alive(log.raiders).length > 0);
  await run(10);
  const leader = alive(log.raiders);
  assert.equal(leader.length, 1, 'the leader alone');
  assert.equal(leader[0].mobileType, 24, 'the orcs\' Warlord');
  assert.equal(leader[0].entity.eliteFoe, true);
  assert.equal(leader[0].entity.raidLeader?.name, 'Orc Warlord');
  assert.equal(leader[0].entity.bossTraits.length, RAID_LEADER_TRAITS, 'two traits');
  assert.ok(log.said.includes(raidLeaderLine('Orc Warlord', TOWN)));
  assert.equal(raidLeaderLine('Orc Warlord', TOWN), `The Orc Warlord leads the last charge on ${TOWN}!`);   // PIN MOVED (AUDIT WORLD-EVENTS L5-8)
  kill(leader[0]);
  await run(1);
  const raid = raidState().raids[0];
  assert.equal(raid.cleansed, true);
  assert.deepEqual(log.said.slice(-2), [cleansedLine(TOWN, 'Region3', 2), raidHeldLine(TOWN)]);
  assert.equal(raidWasHeld(KEY), true);
  assert.equal(player.legalRep[3], 5 + RAID_HELD_REP, 'GrantReputation\'s five, and the held town\'s three');
});

test('RAID5 THE STANDARD, run: its bearer stands at the square first; the raiders come at him in packs and are sent at him; his health is the board\'s; KILLED he sacks the town - said once, none raised again, the town not held; a bearer walked off is raised again (mutants: the bearer unstood; the raiders unaimed; a walk-off a fall; the town held when sacked)', async () => {
  const { at, log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('defend')] });
  const out = await run(1);
  assert.deepEqual(out, ['bearer']);
  assert.deepEqual(log.bearers[0].ai.feet, SQUARE, 'at the square');
  await run(20, 1, () => log.raiders.length >= 2);
  assert.ok(log.raiders.length >= 2 && log.raiders.length <= 3, 'a pack');
  assert.ok(log.aims.every(([, g, ms]) => g === log.bearers[0] && ms === RAID_AIM_TICKS) && log.aims.length === log.raiders.length, 'each sent at the bearer');
  assert.ok(log.said.includes(raidKindAsk('defend', TOWN)));
  log.bearers[0].entity.health = 5;
  assert.deepEqual(raidTimerList(() => 0).map((r) => [r.kind, r.obj]), [['Siege of the Standard', 'Standard 50%']]);
  const raid = raidState().raids[0];
  assert.equal(raidHeld(raid), true, 'standing: held');
  log.bearers[0].dead = true;   // walked off - no corpse
  at.wall += 1;
  await run(ACTOR_SWEEP_S + 2);
  assert.equal(log.bearers.length, 2, 'a walk-off is no fall: another raised');
  assert.equal(raid.sacked, false);
  kill(log.bearers[1]);
  await run(ACTOR_SWEEP_S + 4);
  assert.equal(raid.sacked, true);
  assert.equal(log.said.filter((l) => l === raidBearerFellLine(TOWN)).length, 1, 'said once');
  assert.equal(log.bearers.length, 2, 'none raised again');
  assert.equal(raidHeld(raid), false);
  assert.deepEqual(raidTimerList(() => 0)[0].obj, 'Sacked');
  raid.killed = raid.attackAmount;
  await run(1);
  assert.equal(raid.cleansed, true);
  assert.ok(!log.said.includes(raidHeldLine(TOWN)) && !raidWasHeld(KEY), 'sacked: cleansed, not held');
});

test('RAID5 THE EXODUS, run: three refugees stood at the way\'s start; their guide walks while they keep up and waits for them; each arriving is saved and goes, each fallen lost - said; two saved hold the town; the exodus over, the mod\'s raid comes on (mutants: the guide never waits; a fall saved; the held count off by one; the raid stalled after it)', async () => {
  const { log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('escort')] });
  await run(10, 1, () => log.refugees.length >= RAID_REFUGEES);
  assert.equal(log.refugees.length, RAID_REFUGEES);
  assert.ok(log.refugees.every((f) => f.ai.feet[0] <= RAID_REFUGEE_WAIT_M), 'at the way\'s start, each a step behind its guide');
  assert.ok(log.said.includes(raidKindAsk('escort', TOWN)));
  const [a, b, c] = log.refugees;
  const g0 = a.ai.follow.feet()[0];
  await run(4);
  const lead = Math.max(...log.refugees.map((f) => f.ai.feet[0]));
  assert.ok(a.ai.follow.feet()[0] > g0 && a.ai.follow.feet()[0] <= lead + RAID_REFUGEE_WAIT_M + RAID_REFUGEE_PACE, 'it walks, then waits for them');
  const held = a.ai.follow.feet()[0];
  await run(4);
  assert.equal(a.ai.follow.feet()[0], held, 'they lag: it waits');
  assert.ok(a.ai.follow.stop < b.ai.follow.stop && b.ai.follow.stop < c.ai.follow.stop, 'each a step behind the one before');
  assert.deepEqual(a.ai.follow.trail().at(-1), a.ai.follow.feet(), 'the way walked so far, the guide last');
  await run(20, 1, () => log.raiders.length > 0);
  assert.ok(log.aims.length && log.aims.every(([, g]) => log.refugees.includes(g)), 'the raiders hunt the refugees');
  const raid = raidState().raids[0];
  a.ai.feet = [29, 0, 0];
  await run(2);   // counted, then said
  assert.equal(raid.safe, 1);
  assert.ok(log.said.includes(raidRefugeeSafeLine(1, RAID_REFUGEES)));
  kill(b);
  await run(2);
  assert.equal(raid.lost, 1);
  assert.ok(log.said.includes(raidRefugeeLostLine()));
  assert.equal(raidHeld(raid), false, 'one of three: not yet');
  c.ai.feet = [30, 0, 0];
  await run(1);
  assert.equal(raidHeld(raid), true, 'two: held');
  assert.equal(raidTimerList(() => 0)[0].obj, 'Refugees: 2 of 3 safe, 1 lost');   // PIN MOVED (AUDIT WORLD-EVENTS L5-13)
  await run(ACTOR_SWEEP_S + 1);
  assert.ok(log.removed.includes(a) && log.removed.includes(c), 'the saved go, out of sight');
  const n = log.raiders.length;
  await run(30);
  assert.ok(log.raiders.length > n, 'the mod\'s raid comes on');
  assert.equal(log.refugees.length, RAID_REFUGEES, 'and no refugee more');
});

test('RAID5 online: the runner says each objective it runs (`ro`) - mine alone, never a reader\'s; a reader is told by it - what the town asks, its lines once - and the board shows it; a runner that takes the raid over takes up what was said: the standard fallen stays fallen (mutants: a reader\'s word sent; the word unread; the takeover forgetting)', async () => {
  const { at, log } = rig({ me: 'aaa-0001' });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('defend')] });
  setSharedClock(() => at.now);
  await run(3);
  assert.deepEqual(raidObjWord(), [[KEY, 2, 100, 0]], 'mine: its standard whole');
  raidPeerWord('aaa-0000', [[KEY, 0, 600000]], at.wall);   // an older claim: it runs the raid, I stand by
  assert.equal(frame(1), 'standing-by');
  assert.equal(raidObjWord(), null, 'run no longer: my word goes with my claim');
  _resetRaidingParties();
  const r2 = rig({ me: 'mmm-0002' });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('defend')] });
  setSharedClock(() => r2.at.now);
  assert.equal(raidHeld(raidState().raids[0]), false, 'no word yet: no standard raised that I know of');
  raidPeerWord('aaa-0001', [[KEY, 0, 60000]], r2.at.wall, [[KEY, 2, 40, 0]]);
  assert.equal(frame(1), 'standing-by');
  assert.equal(raidObjWord(), null, 'a reader says none');
  assert.ok(r2.log.said.includes(raidKindAsk('defend', TOWN)), 'told what the town asks');
  assert.equal(raidTimerList(() => 0)[0].obj, 'Standard 40%');
  assert.equal(raidHeld(raidState().raids[0]), true, 'its runner\'s standard standing: held here too');
  raidPeerWord('aaa-0001', [[KEY, 0, 60000]], r2.at.wall, [[KEY, 2, 0, 1]]);
  frame(1); frame(1);
  assert.equal(r2.log.said.filter((l) => l === raidBearerFellLine(TOWN)).length, 1, 'its fall said once');
  assert.equal(r2.log.bearers.length, 0, 'a reader stands none');
  assert.equal(raidHeld(raidState().raids[0]), false, 'fallen: not held');
  assert.equal(raidObjPeerWord('', [[KEY, 2, 0, 0]]), 0, 'no one\'s word is none');
  r2.at.wall += 60 * 60000;   // the runner gone: I run it
  await run(10);
  assert.equal(raidState().raids[0].sacked, true, 'taken up');
  assert.equal(r2.log.bearers.length, 0, 'the fallen standard not raised again');
  assert.equal(log.bearers.length, 1);
});

test('RAID5 the save keeps an objective where it went - sacked, saved, lost - and the held towns for their thanks; a raid of the mod\'s saves as it did (mutants: a field unsaved; the held list lost)', () => {
  rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ sacked: true, safe: 2, lost: 1 }), raidRec({ locationIndex: 8 })], held: ['3:6:400'] });
  const s = getSaveData();
  assert.equal(s.raids[0].sacked, true);
  assert.equal(s.raids[0].safe, 2);
  assert.equal(s.raids[0].lost, 1);
  assert.ok(!('sacked' in s.raids[1]) && !('safe' in s.raids[1]) && !('lost' in s.raids[1]), 'the mod\'s record as it was');
  assert.deepEqual(s.held, ['3:6:400']);
  assert.equal(raidWasHeld('3:6:400'), true);
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ safe: -1, lost: 1.5 })], held: [7, 'x'] });
  assert.ok(!('safe' in getSaveData().raids[0]) && !('lost' in getSaveData().raids[0]), 'junk dropped');
  assert.deepEqual(getSaveData().held, ['x']);
});

test('RAID5 a town held, its thanks: the gold half again and one more Magic-or-better piece rolled LAST - every piece before it the same for its seed (mutants: the bonus unpaid; the extra piece rolled first)', () => {
  for (const seed of [1, 77, 4242]) {
    const plain = rollRaidSpoils(seed, 12, 2), held = rollRaidSpoils(seed, 12, 2, true);
    assert.equal(held.pieces.length, plain.pieces.length + 1);
    assert.deepEqual(held.pieces.slice(0, -1).map((p) => p.item.name), plain.pieces.map((p) => p.item.name), 'the rest its seed\'s');
    assert.ok(['magic', 'rare', 'epic', 'legendary'].includes(String(held.pieces.at(-1).tier).toLowerCase()), 'Magic or better');
    assert.ok(Math.abs(held.gold - plain.gold * RAID_HELD_GOLD_X) <= RAID_HELD_GOLD_X, 'half again');
  }
});

test('RAID5 the board: a live raid of a kind names it and its objective before the count; a classic raid its count alone (mutants: the detail dropped)', () => {
  const base = { name: TOWN, region: 'Region3', type: 'orcs', startMs: 0, endMs: 9e9, key: KEY, n: 3, tg: 20 };
  const row = (r) => eventBoardModel({ now: 1000, raids: [r] }).rows.find((x) => x.kind === 'raid');
  assert.equal(row({ ...base, kind: 'Siege of the Standard', obj: 'Standard 40%' }).detail, 'Standard 40% - Raiders down: 3 of 20');   // PIN MOVED (AUDIT WORLD-EVENTS L5-13): the kind in the title
  assert.equal(row({ ...base, kind: 'Siege of the Standard', obj: 'Standard 40%' }).title, `Siege of the Standard: ${TOWN}`);
  assert.equal(row({ ...base, kind: '', obj: '' }).detail, 'Raiders down: 3 of 20');
  assert.equal(row({ ...base, kind: '', obj: '' }).title, `Raid on ${TOWN}`);
});

test('RAID5 the sites host on a grid of its own: the square the walkable cell nearest the middle; a way from the side named to it along the streets; a bearer the watch\'s, eight times as hardy and leashed to his post; a refugee the street pool\'s ally, loose and transient, four times as hardy, walking behind its guide (mutants: the bearer unleashed; the refugee hostile; the way from the wrong side)', async () => {
  const W = 20, H = 20, blocked = new Set(['10,10']);
  const nav = { width: W, height: H, weightAt: (x, y) => (blocked.has(`${x},${y}`) ? 0 : 1) };
  const toScene = (u, v) => [u + 100, v + 200];
  const spawned = [];
  const sites = createRaidSites({
    townAt: () => ({ town: 1, nav, local: [0, 0], toScene }), feet: () => [0, 0, 0], groundAt: () => 5,
    standGuard: async (pos) => ({ entity: { maxHealth: 30, health: 12 }, ai: {}, pos }),
    spawnFoe: async (mt, pos, o) => { spawned.push([mt, pos, o]); return { entity: { maxHealth: 20, health: 20 }, ai: {} }; },
  });
  const sq = sites.square();
  assert.equal(sq[1], 5, 'on the ground');
  const cell = [Math.floor((sq[0] - 100) / NAV_CELL), Math.floor((sq[2] - 200) / NAV_CELL)];
  assert.ok(!blocked.has(cell.join()) && Math.max(Math.abs(cell[0] - 10), Math.abs(cell[1] - 10)) === 1, 'the nearest walkable to the middle');
  const north = sites.way(0), west = sites.way(3);
  assert.deepEqual(north.at(-1), sq, 'to the square');
  assert.ok(north[0][2] > sq[2] + 5 * NAV_CELL && Math.abs(north[0][0] - sq[0]) < 2 * NAV_CELL, 'from the north edge');   // PIN MOVED (AUDIT WORLD-EVENTS L4-9): north is +z, the grid's far rows - the near ones were called north
  assert.ok(west[0][0] < sq[0] - 5 * NAV_CELL, 'from the west');
  const g = await sites.standBearer(SQUARE);
  assert.equal(g.entity.maxHealth, 30 * RAID_BEARER_HEALTH_X);
  assert.equal(g.entity.health, g.entity.maxHealth);
  assert.equal(g.raidBearer, true);
  assert.deepEqual(g.ai.follow.feet(), SQUARE);
  assert.equal(g.ai.follow.leash, RAID_BEARER_LEASH_M);
  const follow = { feet: () => [1, 0, 1] };
  const f = await sites.standRefugee([1, 0, 1], follow);
  assert.deepEqual(spawned[0], [RAID_REFUGEE_KIND, [1, 0, 1], { allied: true, loose: true, transient: true, feetGiven: true }]);
  assert.equal(f.entity.maxHealth, 20 * RAID_REFUGEE_HEALTH_X);
  assert.equal(f.refugee, true);
  assert.equal(f.ai.follow, follow);
  const none = createRaidSites({ townAt: () => null, feet: () => [0, 0, 0], groundAt: () => 0, standGuard: async () => null, spawnFoe: async () => null });
  assert.equal(none.square(), null);
  assert.equal(none.way(0), null);
});

test('RAID5 the hosts by source: the world host hands the raids its sites - the town\'s, the watch\'s bearer, the pool\'s refugees - says the objective beside the raid\'s word and hears a peer\'s; the pool names its refugees to every reader as allies; the thanks of a town held are richer (mutants: the sites unwired; the word unsent; the refugees hostile at a reader; the held thanks unread)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const raidSites = createRaidSites\(\{ townAt: wardenTownAt, townAtPixel: \(px, py\) => wardenTownOfPixel\(built\.values\(\), \(x, y\) => state\.pixelTranslation\(x, y, _wardenT\), px, py\), feet: enchantFeet, groundAt: surfaceAt, standGuard: cityGuards\.standBearer, spawnFoe: exteriorFoes\.spawnFoe \}\);/);   // PIN MOVED (AUDIT WORLD-EVENTS L4-4): and the raid's own town, off its pixel
  const at = w.indexOf('  setRaidingPartiesHost({');
  assert.match(w.slice(at, w.indexOf('\n  });', at)), /sites: \(\) => raidSites,/);
  assert.match(w, /const rk = raidWireWord\(\), ro = raidObjWord\(\); if \(rk\) frame\.rk = rk; if \(ro\) frame\.ro = ro;/);
  assert.match(w, /exteriorFoes\.setOnRaids\(\(from, rk, at, ro\) => raidPeerWord\(from, rk, at, ro\)\);/);
  assert.match(w, /raidSpoilsList\(c\.c, level, c\.y, typeof entry\.hd === 'boolean' \? entry\.hd : raidWasHeld\(c\.w\)\)/);   // PIN MOVED (AUDIT WORLD-EVENTS L3-14): held as the receipt came, for the character that fought
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /if \(data\.rk !== undefined \|\| data\.ro !== undefined\) _onRaids\?\.\(from, data\.rk, _now\(\), data\.ro\);/);
  assert.match(x, /refugees = validAlliedIds\(data\.rf\)/);
  assert.match(rd('src/scenes/cityGuards.js'), /standBearer: \(pos, yaw = 0\) => spawnGuardAt\(\[\.\.\.pos\], yaw, null, \{ defender: true, bearer: true \}\)/);   // PIN MOVED (AUDIT WORLD-EVENTS L4-6): and the watch's lifecycle passes him by
  assert.ok(MAX_RAID_ENEMIES >= 3);
});
