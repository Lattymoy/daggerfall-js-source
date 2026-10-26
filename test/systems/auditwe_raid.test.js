// AUDIT WORLD-EVENTS (2026-10-25, the owner: "Audit this. Ensure perfection", of EVENT-RULES, BOSS-TRAITS and RAID5;
// bible/01-Overview/audits/Audit-World-Events.md) - THE RAID KINDS' FINDINGS, each pinned where it was found: the motor
// that froze a follower whose leader is not the player (L4-1); the refugees culled and counted lost, stood on one point,
// harmed by the player and kept by a runner gone (L4-2, L4-5, L4-9); the way no city ever found and the square in a
// pocket (L4-3, L4-8); the site read once off the player's feet (L4-4); the bearer the watch dismissed and healed by a
// walk-off (L4-6); the points the floating origin left behind (L4-7); the takeover that forgot, the leader taken over
// as a raider, the held races, the late-comer's packs, the runner stepped out, a word of another kind, a stalled wave,
// the lines again after a load, the pause, the stale word, the held thanks (L3-4 to L3-14); the aim the target machine
// undid (L6-5).
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  raidFrame as frame, restoreRaidSaveData as restoreSaveData, getRaidSaveData as getSaveData, raidState, setRaidingPartiesHost,
  raidHeld, raidWasHeld, raidHeldFor, raidObjWord, raidObjPeerWord, raidPeerWord, raidTimerList, raidRelayWord, raidOffsetAll,
  RAID_STANDARD_FRESH_MS, _resetRaidingParties,
} from '../../src/systems/raidingParties.js';
import {
  raidKindOf, raidKindAsk, raidWaveLine, raidRefugeeSafeLine, RAID_REFUGEES, RAID_WAVE_STALL_S, RAID_SITE_AGAIN_S, RAID_REFUGEE_GAP_M,
} from '../../src/systems/raidKinds.js';
import { RAID_WORD_STALE_MS } from '../../src/world/raidShared.js';
import { raidSig } from '../../src/net/raid/raidLaw.js';
import { createRaidSites, gridStreets, streetEdgeCell, RAID_REFUGEE_KIND } from '../../src/scenes/raidSitesHost.js';
import { NAV_CELL } from '../../src/world/city/cityNavigation.js';
import { sparedByPlayer, sparedBySwing, isRefugee } from '../../src/combat/friendlyFire.js';
import { EnemyAI } from '../../src/characters/enemy/enemyMotor.js';
import { getTargets, RAID_GOAL_PRIORITY, PLAYER_TARGET } from '../../src/characters/enemy/enemyTargets.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import { _resetRenownKillsForTests } from '../../src/net/renownTracker.js';
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
function raidOf(kind, o = {}) {
  for (let m = 600; m < 700; m++) { const r = raidRec({ startMinute: AT(m), ...o }); if (raidKindOf(r) === kind) return r; }
  throw new Error(`no ${kind} tuple`);
}
const sigOf = (r) => raidSig({ st: r.startMinute, tg: r.attackAmount, ty: r.type, px: r.px, py: r.py });

/** raid5_kinds.test.js's recording host, its sites' points its own (an origin's shift moves them in place). */
function rig({ me = null, relay = false } = {}) {
  const at = { now: AT(610), wall: 100000, me, inTown: [], town: { regionIndex: 3, locationIndex: 7 }, pixel: { x: 200, y: 100 }, roll: 0, allowed: false, square: [10, 0, 10], way: [[0, 0, 0], [30, 0, 0]], own: [] };
  const log = { said: [], raiders: [], defenders: [], bearers: [], refugees: [], aims: [], removed: [], released: [], asked: [] };
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
    ownRaidFoes: () => at.own.filter((f) => !f.dead), relayRaids: () => relay, sendRaid: () => true,
    sites: () => ({
      square: (raid) => { log.asked.push(['square', raid]); return at.square; }, way: (side, raid) => { log.asked.push(['way', raid]); return at.way; },
      standBearer: (post) => { const g = foe(146, post); g.raidBearer = true; log.bearers.push(g); return Promise.resolve(g); },
      standRefugee: (p, follow) => { const f = foe(RAID_REFUGEE_KIND, p); f.refugee = true; f.ai.follow = follow; log.refugees.push(f); return Promise.resolve(f); },
      releaseBearer: (g) => { log.released.push(g); },
    }),
  };
  setRaidingPartiesHost(h);
  return { at, log, player, h, foe };
}
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

test('AUDIT WORLD-EVENTS L4-1: a follower whose leader is not the player walks to it - the pursuit tick no longer turns it back at the player it detects (mutants: the pursuit tick run while following)', () => {
  const walk = { raycast: (o, d) => (d[1] < -0.5 ? Math.max(0, o[1]) + 0.5 : Infinity), capsuleCast: () => ({ dist: Infinity, key: null }), move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true }; } };
  const ai = new EnemyAI(walk, [0, 0, 0], 0);
  ai.isHostile = true;   // an ally of the player's is hostile to his foes: it senses him
  const guide = [0, 0, -12], player = [0, 0, 10];
  ai.follow = { feet: () => guide, stop: 1.2, leash: 3 };
  for (let t = 0; t < 8; t += 1 / 60) ai.update(1 / 60, player, { gameMinutes: 0, playerStealth: 0, rolls: () => 0.5 });
  assert.equal(ai.detected, true, 'the player sensed all the while');
  assert.ok(Math.hypot(ai.feet[0] - guide[0], ai.feet[2] - guide[2]) < 2, `at its guide (${Math.hypot(ai.feet[0] - guide[0], ai.feet[2] - guide[2]).toFixed(2)} m; frozen at 12 before)`);
});

test('AUDIT WORLD-EVENTS L4-2/L4-9/L3-12: the exodus - no refugee stood on a paused frame; each a pace behind the one before; one let go with no body (the pool\'s sweep) is no loss and is stood again, one KILLED is lost (mutants: a loss without a corpse; all on one point; stood at dt 0)', async () => {
  const { log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('escort')] });
  await run(6, 0);
  assert.equal(log.refugees.length, 0, 'a paused frame stands none');
  await run(10, 1, () => log.refugees.length >= RAID_REFUGEES);
  const xs = log.refugees.map((f) => f.ai.feet[0]);
  assert.equal(new Set(xs).size, RAID_REFUGEES, 'never on one point');
  assert.ok(Math.abs(Math.abs(xs[0] - xs[1]) - RAID_REFUGEE_GAP_M) < 1e-9, 'a pace apart');
  const raid = raidState().raids[0];
  log.refugees[0].dead = true;   // the pool let it go: no body
  await run(3);
  assert.equal(raid.lost, 0, 'no loss');
  assert.equal(alive(log.refugees).length, RAID_REFUGEES, 'stood again');
  kill(log.refugees[1]);
  await run(2);
  assert.equal(raid.lost, 1, 'a killed one is lost');
  // the pool spares a raid's refugee its relevance cull, and the player's own harm passes one by
  assert.match(rd('src/scenes/exteriorFoes.js'), /if \(!f\.placed && !f\.managed && !f\.refugee && _playerDist > _cullAt &&/);
  const ref = { refugee: true, dead: false, entity: { team: 'PlayerAlly' } };
  assert.equal(isRefugee(ref), true);
  assert.equal(sparedByPlayer(ref), true, 'the shaft, the spell, the torch');
  assert.equal(sparedBySwing(ref), true, 'the swing');
  assert.equal(sparedBySwing({ ...ref, entity: { team: 'PlayerEnemy' } }), false, 'one turned is no refugee');
  assert.match(rd('src/scenes/exteriorFoes.js'), /if \(f\.dead \|\| \(fromPlayer && !peer && sparedBySwing\(f\)\)\) return;/);
  assert.match(rd('src/scenes/exteriorFoes.js'), /const live = dropFateHeld\(foes\.filter\(\(f\) => !f\.dead && !sparedBySwing\(f\)\)\);/);
});

test('AUDIT WORLD-EVENTS L4-4: the standard\'s square not found is asked again RAID_SITE_AGAIN_S on, never kept null for the raid - the raid\'s own asked of (mutants: the null kept)', async () => {
  const { at, log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('defend')] });
  at.square = null;
  await run(2);
  assert.equal(log.bearers.length, 0);
  assert.equal(log.asked[0][1], raidState().raids[0], 'the raid\'s own town asked of');
  at.square = [10, 0, 10];
  await run(RAID_SITE_AGAIN_S + 1, 1, () => log.bearers.length > 0);
  assert.equal(log.bearers.length, 1, 'found, and the standard raised');
});

test('AUDIT WORLD-EVENTS L4-3/L4-8: the town\'s streets off its grid - a walled town\'s, past a pocket at its middle and the larger fields beyond its wall; its way from a side\'s street cell to its square, found (mutants: the edge\'s raw cell; the pocket taken for the square)', () => {
  const W = 60, H = 60;
  const wall = (x, y) => (Math.max(Math.abs(x - 29.5), Math.abs(y - 29.5)) === 20.5);   // a ring of wall, no gate
  const pocket = (x, y) => Math.max(Math.abs(x - 30), Math.abs(y - 30)) === 1;   // a yard boxed in about the middle
  const nav = { width: W, height: H, weightAt: (x, y) => (wall(x, y) || pocket(x, y) ? 0 : 1) };
  const s = gridStreets(nav);
  const sq = s.square;
  assert.ok(Math.max(Math.abs(sq[0] - 30), Math.abs(sq[1] - 30)) === 2, `the square off the pocket, on the streets (${sq})`);
  const north = streetEdgeCell(nav, s.label, s.id, 0);
  assert.equal(north[1], 49, 'north: the far rows, inside the wall');
  assert.equal(streetEdgeCell(nav, s.label, s.id, 2)[1], 10, 'south');
  assert.equal(streetEdgeCell(nav, s.label, s.id, 1)[0], 49, 'east');
  assert.equal(streetEdgeCell(nav, s.label, s.id, 3)[0], 10, 'west');
  const sites = createRaidSites({ townAt: () => ({ town: 1, nav, toScene: (u, v) => [u, v] }), feet: () => [0, 0, 0], groundAt: () => 0, standGuard: async () => null, spawnFoe: async () => null });
  for (const side of [0, 1, 2, 3]) {
    const w = sites.way(side);
    assert.ok(w && w.length >= 2, `a way from side ${side}`);
    const c0 = [Math.floor(w[0][0] / NAV_CELL), Math.floor(w[0][2] / NAV_CELL)];
    assert.equal(s.label[c0[1] * W + c0[0]], s.id, 'from the streets, not the fields');
  }
  // the living town's places first: its square and its exits
  const places = { net: s.label, netId: s.id, square: { cell: [20, 20] }, exits: [{ side: 'n', cell: [30, 40] }] };
  const lived = createRaidSites({ townAt: () => ({ town: 1, nav, places, toScene: (u, v) => [u, v] }), feet: () => [0, 0, 0], groundAt: () => 0, standGuard: async () => null, spawnFoe: async () => null });
  assert.deepEqual(lived.square(), [20.5 * NAV_CELL, 0, 20.5 * NAV_CELL]);
  const w0 = lived.way(0)[0];
  assert.ok(Math.abs(w0[0] - 30.5 * NAV_CELL) < 1e-9 && Math.abs(w0[2] - 40.5 * NAV_CELL) < 1e-9, 'from its north exit');
  // the raid's own town, off its pixel, before the player's feet
  const byPixel = createRaidSites({ townAt: () => null, townAtPixel: (px, py) => (px === 200 && py === 100 ? { town: 1, nav, toScene: (u, v) => [u, v] } : null), feet: () => [0, 0, 0], groundAt: () => 0, standGuard: async () => null, spawnFoe: async () => null });
  assert.equal(byPixel.square(), null, 'no raid, no pixel: the feet\'s, none');
  assert.ok(byPixel.square({ px: 200, py: 100 }), 'the raid\'s pixel\'s');
});

test('AUDIT WORLD-EVENTS L4-6: the Standard-Bearer is no part of the watch\'s comings and goings - never dismissed in a lull, never counted a defender, never enlisted by a crime - and one let go is raised again as he was (mutants: the dismissal; the count; the walk-off a whole standard)', async () => {
  const cg = rd('src/scenes/cityGuards.js');
  assert.match(cg, /if \(g\.dead \|\| !g\.defender \|\| g\.leaving \|\| g\.raidBearer\) continue;/);
  assert.match(cg, /const defenderCount = \(\) => guards\.filter\(\(g\) => !g\.dead && g\.defender && !g\.leaving && !g\.raidBearer\)\.length \+ spawning\.filter\(\(p\) => p\.defender && !p\.bearer\)\.length/);
  assert.match(cg, /function enlistDefender\(g, playerFeet\) \{\n\s*if \(g\.raidBearer\) return;/);
  assert.match(cg, /raidBearer: !!bearer,/);
  const { log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('defend')] });
  await run(2);
  log.bearers[0].entity.health = 4;
  await run(12, 1, () => log.raiders.length > 0);
  log.raiders[0].entity.health = 5;
  await run(1);
  assert.equal(log.raiders[0].raidTurned, true, 'L6-5: a raider struck is turned (it fights who struck it)');
  log.bearers[0].dead = true;   // walked off, no body
  await run(6);
  assert.equal(log.bearers.length, 2);
  assert.equal(log.bearers[1].entity.health, 4, 'raised at the share he was let go at');
  assert.equal(log.bearers[1].raidGoal, raidState().raids[0].key ?? `3:7:${DAY}`, 'his raid\'s raiders\' goal');
});

test('AUDIT WORLD-EVENTS L4-7: an origin\'s shift moves the square and the way a raid\'s kind holds (mutants: the shift unheard)', async () => {
  const { at } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('defend'), raidOf('escort', { locationIndex: 8 })] });
  await run(2);
  const o = raidState().raids[0].obj;
  assert.deepEqual(o.post, [10, 0, 10]);
  raidOffsetAll([819.2, 0, -819.2]);
  assert.deepEqual(o.post, [829.2, 0, -809.2]);
  assert.equal(at.square, o.post, 'in place (the bearer\'s post is read off it)');
  assert.match(rd('src/scenes/world.js'), /exteriorFoes\.offsetAll\(r\.offset\); raidOffsetAll\(r\.offset\);/);
});

test('AUDIT WORLD-EVENTS L3-10/L3-12: the assault - a wave whose count has not moved in RAID_WAVE_STALL_S stands past the raider it cannot reach; its breather runs on the frame\'s time, never through a pause (mutants: the stall never timed; the breather on the wall clock)', async () => {
  const { at, log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('waves')] });
  await run(40, 1, () => log.raiders.length >= 7);
  await run(10);
  assert.equal(log.raiders.length, 7);
  log.raiders.slice(1).forEach(kill);   // one stands where none can reach it
  await run(RAID_WAVE_STALL_S - 10);
  assert.equal(log.raiders.length, 7, 'within the stall: held');
  await run(20);
  assert.equal(log.raiders.length, 8, 'past it: one more for the count');
  kill(log.raiders[0]); kill(log.raiders[7]);
  await run(1);
  at.wall += 60 * 60000;   // an hour behind an open menu
  await run(30, 0);
  assert.equal(log.raiders.length, 8, 'a pause stands nothing');
  assert.ok(!log.said.includes(raidWaveLine(2, 3, TOWN)), 'nor says the next wave');
  await run(5);
  assert.ok(!log.said.includes(raidWaveLine(2, 3, TOWN)), 'the breather still holds - the hour behind the menu spent none of it');
  await run(20, 1, () => log.raiders.length > 8);
  await run(2);
  assert.ok(log.said.includes(raidWaveLine(2, 3, TOWN)), 'the breather run out on the game\'s time');
});

test('AUDIT WORLD-EVENTS L3-7: at a raid relay the assault stands nothing before the town\'s ledger is heard (mutants: a late-comer\'s packs off its own count)', async () => {
  const { at, log } = rig({ me: 'aaa-0001', relay: true });
  const r = raidOf('waves');
  restoreSaveData({ lastSelectedDay: DAY, raids: [r] });
  setSharedClock(() => at.now);
  await run(15);
  assert.equal(log.raiders.length, 0, 'no ledger, no pack');
  assert.equal(raidRelayWord({ k: 'st', key: KEY, g: sigOf(r), n: 7, tg: 20, c: 0 }), true);
  await run(20, 1, () => log.raiders.length > 0);
  assert.ok(log.raiders.length > 0, 'the ledger heard: the second wave');
  await run(2);
  assert.ok(log.said.includes(raidWaveLine(2, 3, TOWN)), 'its count the town\'s');
});

test('AUDIT WORLD-EVENTS L3-5/L3-6: a leader taken over is the leader - no second stood, its fall the town held; a reader whose last word reached the leader\'s charge is held at the cleanse (mutants: the takeover a raider; the reader\'s word unfolded)', async () => {
  const { at, log, foe } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('waves', { killed: 19 })] });
  const lead = foe(24); lead.raidKey = KEY; lead.entity.eliteFoe = true; lead.entity.raidLeader = { name: 'Orc Warlord' };
  at.own.push(lead);
  await run(RAID_WAVE_STALL_S + 20);
  assert.equal(log.raiders.length, 0, 'none stood beside it, however long it stands');
  kill(lead);
  await run(1);
  assert.equal(raidState().raids[0].ld, true, 'its fall the leader\'s');
  assert.equal(raidState().raids[0].cleansed, true);
  assert.equal(raidWasHeld(KEY), true, 'held');
  _resetRaidingParties();
  const r2 = rig({ me: 'mmm-0002', relay: true });
  const r = raidOf('waves');
  restoreSaveData({ lastSelectedDay: DAY, raids: [r] });
  setSharedClock(() => r2.at.now);
  raidPeerWord('aaa-0001', [[KEY, 0, 60000]], r2.at.wall, [[KEY, 1, 3, 0]]);   // the leader's charge said; its fall not yet
  frame(1);
  raidRelayWord({ k: 'cl', key: KEY, g: sigOf(r), top: [], n: 1 }, 'world:200,100');
  assert.equal(raidState().raids[0].cleansed, true);
  assert.equal(raidWasHeld(KEY), true, 'held here as at its runner');
});

test('AUDIT WORLD-EVENTS L3-4/L3-9: a runner\'s word is folded into the raid as it is heard - a runner that ran it before and takes it again raises no fallen standard; a word of another kind is no word of the raid (mutants: the fold dropped; the kind unchecked)', async () => {
  const { at, log } = rig({ me: 'mmm-0002' });
  const d = raidOf('defend');
  restoreSaveData({ lastSelectedDay: DAY, raids: [d] });
  setSharedClock(() => at.now);
  await run(3);
  assert.equal(log.bearers.length, 1, 'mine first');
  raidPeerWord('aaa-0001', [[KEY, 0, 600000]], at.wall, [[KEY, 2, 0, 1]]);   // an older claim, and its standard fallen
  assert.equal(frame(1), 'standing-by');
  assert.deepEqual(log.released, [log.bearers[0]], 'L4-9: mine stands down with my claim');
  assert.equal(raidState().raids[0].sacked, true, 'folded as heard');
  at.wall += 60 * 60000;   // its runner gone: mine again
  await run(10);
  assert.equal(log.bearers.length, 1, 'the fallen standard not raised again');
  assert.deepEqual(raidObjWord(), [[KEY, 2, 0, 1]]);
  _resetRaidingParties();
  const r2 = rig({ me: 'mmm-0002' });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('classic')] });
  setSharedClock(() => r2.at.now);
  assert.equal(raidObjPeerWord('aaa-0001', [[raidState().raids[0].key ?? KEY, 2, 40, 1]]), 0, 'a standard\'s word of a classic raid');
  raidPeerWord('aaa-0001', [[KEY, 0, 60000]], r2.at.wall);
  frame(1);
  assert.ok(!r2.log.said.includes(raidKindAsk('defend', TOWN)), 'nothing asked of it');
  assert.equal(raidState().raids[0].sacked, false);
});

test('AUDIT WORLD-EVENTS L3-8: a standard seen standing holds the town at its cleanse for RAID_STANDARD_FRESH_MS - the runner stepped into a tavern as the relay\'s cleanse came (mutants: held off the word in hand alone)', async () => {
  const { at, log } = rig({ me: 'aaa-0001' });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('defend')] });
  setSharedClock(() => at.now);
  await run(3);
  assert.equal(log.bearers.length, 1);
  at.town = null;   // stepped out
  assert.equal(frame(1), 'idle');
  const raid = raidState().raids[0];
  assert.equal(raidHeld(raid), true, 'still held');
  at.wall += RAID_STANDARD_FRESH_MS + 1;
  assert.equal(raidHeld(raid), false, 'not for an hour unseen');
});

test('AUDIT WORLD-EVENTS L3-11/L3-13: what was said is saved and said once - a load says no ask or wave again; two runners\' words crossing say a refugee saved once; a stale word leaves the board (mutants: `asked` unsaved; the lines off the last word, not the most)', async () => {
  const { at, log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('waves')] });
  await run(5);
  assert.equal(log.said.filter((l) => l === raidKindAsk('waves', TOWN)).length, 1);
  const s = getSaveData();
  assert.equal(s.raids[0].asked, true);
  assert.deepEqual(s.raids[0].ow, [1, 0, 0]);
  restoreSaveData(s);
  await run(5);
  assert.equal(log.said.filter((l) => l === raidKindAsk('waves', TOWN)).length, 1, 'no ask again');
  assert.equal(log.said.filter((l) => l === raidWaveLine(1, 3, TOWN)).length, 1, 'no wave again');
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ ld: true, wv: 2, asked: true, ow: [1, 2, 1] })] });
  const back = getSaveData().raids[0];
  assert.deepEqual([back.ld, back.wv, back.asked, back.ow], [true, 2, true, [1, 2, 1]], 'round-trips');
  _resetRaidingParties();
  const r2 = rig({ me: 'mmm-0002' });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('escort')] });
  setSharedClock(() => r2.at.now);
  for (const ro of [[[KEY, 3, 1, 0]], [[KEY, 3, 0, 0]], [[KEY, 3, 1, 0]]]) { raidPeerWord('aaa-0001', [[KEY, 0, 60000]], r2.at.wall, ro); frame(1); }
  assert.equal(r2.log.said.filter((l) => l === raidRefugeeSafeLine(1, RAID_REFUGEES)).length, 1, 'said once');
  assert.equal(raidTimerList(() => 0)[0].obj, 'Refugees: 1 of 3 safe, 0 lost');
  r2.at.wall += RAID_WORD_STALE_MS + 1;
  assert.equal(raidTimerList(() => 0)[0].obj ?? '', '', 'a word from a runner gone leaves the board');
});

test('AUDIT WORLD-EVENTS L3-14: whether a town is held as its receipt comes - the cleanse\'s word, or its objective as it stands - goes with the receipt to the character that fought (mutants: the receipt\'s held unread)', () => {
  rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('escort', { safe: 2 }), raidOf('escort', { locationIndex: 8 })], held: ['9:9:9'] });
  assert.equal(raidHeldFor(KEY), true, 'two saved: held before its cleanse');
  assert.equal(raidHeldFor(`3:8:${DAY}`), false);
  assert.equal(raidHeldFor('9:9:9'), true, 'a cleanse held');
  assert.match(rd('src/systems/raidingParties.js'), /host\(\)\.onRaidReceipt\?\.\(f\.r, c, raidHeldFor\(c\.w\)\);/);
  assert.match(rd('src/net/raid/raidClaims.js'), /keep\(\[\.\.\.list, \{ r, ch: character, nm: typeof name === 'string' \? name : null, lv, cid: cid\(\), hd: held === true \}\]/);
});

test('AUDIT WORLD-EVENTS L6-5: a raid\'s goal is its raiders\' quarry first whatever infighting reads - the bearer over the player beside him, infighting off - until a blow turns the raider (mutants: the goal through the infighting chain; no priority)', () => {
  const walk = { raycast: () => Infinity, capsuleCast: () => ({ dist: Infinity, key: null }), move: () => ({ grounded: true }) };
  const body = (feet, team, o = {}) => { const ai = new EnemyAI(walk, feet, 0); ai.isHostile = true; return { ai, entity: { team, mobileTeam: team, health: 20, maxHealth: 20, basics: { team } }, ...o }; };
  const raider = body([0, 0, 0], 'Orcs', { raidKey: KEY });
  const bearer = body([0, 0, 6], 'PlayerAlly', { raidGoal: KEY });
  bearer.ai.target = {};   // he fights already: no idle target's edge - his goal's priority alone puts him first
  const other = body([0, 0, 4], 'PlayerAlly', { raidGoal: '1:1:1' });
  const pick = () => getTargets(raider, [raider, bearer, other, PLAYER_TARGET], [0, 0, 3], { infighting: false }).target;
  assert.equal(pick(), bearer, 'the raid\'s own goal, past the player nearer');
  assert.ok(RAID_GOAL_PRIORITY > 0);
  raider.raidTurned = true;
  assert.notEqual(pick(), bearer, 'turned: the ordinary chain');
  const stranger = body([0, 0, 0], 'Orcs');
  assert.notEqual(getTargets(stranger, [stranger, bearer, PLAYER_TARGET], [0, 0, 3], { infighting: false }).target, bearer, 'another\'s raider: no goal of his');
});
