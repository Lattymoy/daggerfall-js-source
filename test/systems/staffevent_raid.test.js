// STAFF-EVENT (2026-10-24;
// bible/11-Multiplayer/Staff-Events.md) - THE GAME'S HALF: the hub's book held as raids (systems/staffEvents.js), run by
// systems/raidingParties.js as a town's raid is - the staff's monsters stood to the event's total, no defenders, the word
// to the place's cell, the mini boss stood when the cell calls it (promoted: yellow, its size, its health), its fall its
// own word and never a kill on the meter, the end routing the monsters - and the boss's looks (systems/eliteFoes.js,
// systems/hitFlash.js, systems/foeTitle.js), the raid wire's staff keys (world/raidShared.js), and the client's frame
// and word shapes (net/wire.js, net/online.js).
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  STAFF_PACK_MIN, STAFF_PACK_MAX, STAFF_PACK_FILL_MIN_S, STAFF_PACK_FILL_MAX_S, staffPackGapS, staffPackPaceS, STAFF_PACK_FAR_MIN, STAFF_PACK_FAR_MAX, STAFF_PACK_NEAR, MAX_RAID_ENEMIES, raidSpawnRange, RAID_SPAWN_MIN_DISTANCE, RAID_SPAWN_MAX_DISTANCE,
  raidFrame as frame, raidWireWord, raidRelayWord, setRaidingPartiesHost, restoreRaidSaveData, _resetRaidingParties,
  STAFF_RAID_TYPE, staffBossLine, staffEndLine, staffAttackLine, STAFF_BOSS_CLEAR_MAX_MS, staffBossSpot, STAFF_BOSS_GROUP_M, staffPackScale, STAFF_PACK_CAP_MAX, STAFF_PACK_CAP_PER,
} from '../../src/systems/raidingParties.js';
import { staffEventBook, staffRaids, staffRaidHere, staffRaidRoom, staffBossWanted, staffLedgerOf, _resetStaffEvents } from '../../src/systems/staffEvents.js';
import { validStaffEvent, staffEventKey } from '../../src/net/staffEvent/staffEventLaw.js';
import {
  promoteStaffBoss, STAFF_BOSS_MIN_METAL, STAFF_BOSS_ARMOR, isStaffBoss, eliteGlow, eliteSize, STAFF_BOSS_GLOW, STAFF_BOSS_HEALTH_MULT, ELITE_FOE_SIZE,
} from '../../src/systems/eliteFoes.js';
import { foeTitle } from '../../src/systems/foeTitle.js';
import { dropWeaponIfTargetImmune } from '../../src/combat/formulas.js';
import { isImmuneToParalysis } from '../../src/systems/effects.js';
import { validRaidWords, validRaidTags, validStaffBossTags } from '../../src/world/raidShared.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import { _resetModSettings, setModSetting } from '../../src/systems/modSettings.js';
import { parseClient } from '../../src/net/wire.js';
import { mintStaffReceipt } from '../../src/net/staffEvent/staffEventReceipt.js';
import { renownFoeStruck, _resetRenownKillsForTests } from '../../src/net/renownTracker.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));
const DAY = 400;
const EV = { id: 'ab12cd34ef', rg: 3, loc: 7, px: 200, py: 100, nm: 'Gothway Garden', ct: 1, mt: [7, 12], n: 6, m: 3, b: 24, bs: 250, bh: 20, at: 1_700_000_000_000, ue: 0, eb: 1, fb: 0, by: 'SirMcMobdon' };
const KEY = staffEventKey(EV.id);

function rig() {
  const at = { now: DAY * MINUTES_PER_DAY + 600, wall: 100000, me: 'mmm-0002', town: { regionIndex: 3, locationIndex: 7 }, outdoors: true, pixel: { x: 200, y: 100 }, roll: 0, own: [], puppets: [] };
  const log = { said: [], raiders: [], defenders: [], words: [] };
  let seq = 0;
  const foe = (mobileType) => ({ mobileType, dead: false, corpse: false, entity: { health: 40, maxHealth: 40, mobileType }, ai: { feet: [seq, 0, 0] }, uid: ++seq });
  const h = {
    now: () => at.now, random: () => at.roll, wallNow: () => at.wall, selfId: () => at.me, maps: () => null, picker: () => null,
    regionIndex: () => 3, regionName: (r) => `Region${r}`,
    townHere: (outdoors) => (outdoors ? at.outdoors : at.town), playerPixel: () => at.pixel,
    peersInTown: () => [], raidPuppets: () => at.puppets, ownRaidFoes: () => at.own, relayRaids: () => true,
    standRaider: (mt, o, boss) => { const f = foe(mt); f.o = o; f.asBoss = boss; if (o?.at) f.ai.feet = [...o.at]; log.raiders.push(f); return Promise.resolve(f); },
    standDefender: () => { const g = foe(146); log.defenders.push(g); return Promise.resolve(g); },
    defenderCount: () => 0, defendersAllowed: () => true, removeFoe: (f) => { f.dead = true; }, outOfSight: () => true,
    reputation: () => ({ player: { legalRep: {} }, store: { dict: new Map() } }), say: (line) => log.said.push(line),
    sendRaid: (w, room) => { log.words.push({ w, room }); return true; },
  };
  setRaidingPartiesHost(h);
  return { at, log, h };
}
const kill = (f) => { f.dead = true; f.corpse = true; f.entity.health = 0; };
/** Frames until the spawn clock comes round (a staff event's 0.5-2 s), each a tick for a stand to land. */
async function run(n, dt = 2.1) { const out = []; for (let i = 0; i < n; i++) { out.push(frame(dt)); await tick(); } return out; }

beforeEach(() => {
  _resetRaidingParties();
  _resetStaffEvents();
  _resetModSettings();
  setModSetting('world-events-raiding-parties', 'Enabled', true);
  setSharedClock(null);
});

test('STAFF-EVENT: the hub\'s book held as raids - a town\'s where I stand outdoors in its rect, an area\'s on its pixel outdoors; one the book drops is ended', () => {
  assert.equal(staffEventBook([EV, { ...EV, id: 'cc22dd33ee', loc: -1, px: 210, py: 101 }, { bad: 1 }]), 2);
  const [town, area] = staffRaids();
  assert.deepEqual([town.key, town.type, town.attackAmount, town.startMinute, town.endMinute], [KEY, STAFF_RAID_TYPE, 6, -Infinity, Infinity]);
  assert.equal(staffRaidHere({ regionIndex: 3, locationIndex: 7 }, { x: 0, y: 0 }, true), town);
  assert.equal(staffRaidHere(null, { x: 210, y: 101 }, true), area);
  assert.equal(staffRaidHere(null, { x: 210, y: 101 }, false), null, 'an area is outdoors alone');
  assert.equal(staffRaidRoom(town, 0, 25), true);
  assert.equal(staffRaidRoom(town, 6, 25), false, 'never more standing than its total');
  assert.equal(staffRaidRoom(town, 25, 25), false);
  staffEventBook([EV]);
  assert.equal(staffRaids().length, 1, 'the area\'s is over');
  staffEventBook([EV, { ...EV, id: 'cc22dd33ee', loc: -1 }]);
  assert.equal(staffRaids().length, 1, 'and never stood again by a late book');
});

test('STAFF-EVENT: RUN AS A RAID - its own monsters, mixed, up to its total; no defenders; my word to the place\'s cell; the boss stood when the cell calls it, yellow and large; its fall ends nothing on the meter; the board and my receipt', async () => {
  const { at, log, h } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [EV] } }, 'social');
  const raid = staffRaids()[0];
  await run(12);
  assert.equal(log.defenders.length, 0, 'no defenders: staff set the fight');
  assert.equal(log.raiders.length, 6, 'its total and no more');
  assert.deepEqual([...new Set(log.raiders.map((f) => f.mobileType))].sort(), [7], 'the roll picks its kinds (a roll of 0: the first)');
  assert.ok(log.raiders.every((f) => f.raidKey === KEY));
  at.roll = 0.99;
  assert.equal(log.raiders.length, 6);
  assert.match(log.said[0], /The city of Gothway Garden is under attack!/);
  // three deaths: my word says them, to the place's cell
  for (const f of log.raiders.slice(0, 3)) kill(f);
  await run(1);
  const w = log.words.at(-1);
  assert.deepEqual(w.w, { k: 'w', id: EV.id, px: 200, py: 100, n: 3, s: 0, bu: 0, bk: 0, fb: 0, h: 0 }, 'deaths I never struck: none mine on the board');
  assert.equal(w.room, 'world:' + w.room.split(':')[1], 'a cell room');
  // the cell calls the boss (the meter at 3): I run the event, so I stand it, before any raider
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 3, bd: 1, bu: 0, bk: 0, fc: 0 } }, w.room);
  assert.equal(staffLedgerOf(EV.id).bd, 1);
  assert.equal(raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 5, bd: 1, bu: 0, bk: 0, fc: 0 } }, 'social'), false, 'a ledger from the social room is no cell\'s');
  assert.equal(staffBossWanted(raid), 0);
  // BOSS-CLEAR (BOSS-CLEAR-CALL: only the mini boss
  // waits for everything to be dead): three still stand - no boss until they are dead
  assert.ok((await run(3)).every((x) => x !== 'boss'));
  assert.ok(!log.said.some((l) => /A mighty/.test(l)), 'not said before it stands');
  for (const f of log.raiders.slice(3)) kill(f);
  assert.equal(frame(0.1), 'boss');
  await tick();
  const boss = log.raiders.at(-1);
  assert.equal(boss.mobileType, 24, 'staff\'s pick: an Orc Warlord');
  assert.deepEqual([boss.asBoss, log.raiders.slice(0, -1).some((f) => f.asBoss)], [true, false], 'its stand asked as the boss\'s: an event\'s own from it, never a revenant (STAR-MASTER-FLED, AUDIT FB1029g STAR F4)');
  assert.ok(isStaffBoss(boss.entity));
  assert.equal(boss.entity.maxHealth, 40 * 20, 'staff\'s health pick: 20x');
  assert.equal(eliteSize(boss.entity), 2.5);
  assert.equal(raid.bossUp, 1);
  assert.equal(staffBossWanted(raid), -1, 'one boss a call');
  await run(1);
  assert.deepEqual([log.words.at(-1).w.bu, log.words.at(-1).w.bk], [1, 0]);
  assert.equal(await run(1).then((o) => o[0]), 'idle', 'it stands: the event\'s total stood already');
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 3, bd: 1, bu: 1, bk: 0, fc: 0 } }, w.room);
  frame(0.1);
  assert.ok(log.said.some((l) => /A mighty Orc Warlord has come to the city of Gothway Garden!/.test(l)), 'said once it stands, where I stand');
  // the boss falls: its own word, not a fourth kill
  kill(boss);
  await run(1);
  assert.deepEqual([log.words.at(-1).w.n, log.words.at(-1).w.bk], [6, 1], 'the six that fell before it, not a seventh');
  // THE REWARD: the board said once where it fell, the killing blow marked, a nameless row the reader's word; my
  // receipt handed to the host once (its spoils rolled there - scenes/world.js onRaidReceipt), a raid's never confused
  const top = [['Ana', 3, 1], ['', 2, 0]];
  assert.equal(raidRelayWord({ k: 'sev', sev: { k: 'bd', id: EV.id, top } }, w.room), true);
  assert.equal(log.said.at(-1), 'The top fighters: 1. Ana (3, the killing blow), 2. A fighter (2)');
  assert.equal(raidRelayWord({ k: 'sev', sev: { k: 'bd', id: EV.id, top } }, w.room), false, 'once');
  const rc = await mintStaffReceipt({ v: EV.id, s: 'acct-0001', c: 77, r: 1 }, null, { subtle: globalThis.crypto.subtle, nowS: 1_700_000_000 });
  const handed = [];
  h.onRaidReceipt = (r, c) => handed.push([r, c.v, c.r]);
  assert.equal(raidRelayWord({ k: 'sev', sev: { k: 'rc', id: EV.id, r: rc } }, w.room), true);
  assert.equal(raidRelayWord({ k: 'sev', sev: { k: 'rc', id: EV.id, r: rc } }, w.room), false, 'the same receipt again: no second roll');
  assert.equal(raidRelayWord({ k: 'sev', sev: { k: 'rc', id: EV.id, r: 'w1.x.' } }, w.room), false);
  assert.deepEqual(handed, [[rc, EV.id, 1]]);
  // the hub ends it: its monsters routed, the end said
  raidRelayWord({ k: 'sev', sev: { k: 'end', id: EV.id, why: 'boss' } }, 'social');
  frame(0.1);
  assert.match(log.said.at(-1), /The Orc Warlord has fallen\. The city of Gothway Garden is safe\./);
  assert.equal(staffRaids().length, 0);
  // a hand call is one more boss
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, id: 'dd33ee44ff' }] } }, 'social');
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: 'dd33ee44ff', n: 0, bd: 1, bu: 0, bk: 0, fc: 2 } }, w.room);
  assert.equal(staffBossWanted(staffRaids()[0]), 2);
});

test('BOSS-LOST and BOSS-HP: a boss stand given up on is asked again; a boss gone without falling is stood again; one coming over is waited for; the exact health wins', async () => {
  const { at, log, h } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, hp: 5000 }] } }, 'social');
  const raid = staffRaids()[0];
  await run(4);
  const room = log.words.at(-1)?.room ?? 'world:0';
  // the boss stand never answers: given up at the pending's timeout, then asked again
  const stand = h.standRaider;
  h.standRaider = () => new Promise(() => {});
  for (const f of log.raiders) kill(f);
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 3, bd: 1, bu: 0, bk: 0, fc: 0 } }, room);
  assert.equal(frame(0.1), 'boss');
  for (let i = 0; i < 9; i++) frame(1);
  assert.equal(raid.bossFc, -1, 'given up: the call stands unanswered');
  h.standRaider = stand;
  assert.equal(frame(0.1), 'boss', 'asked again');
  await tick();
  const boss = log.raiders.at(-1);
  assert.equal(boss.entity.maxHealth, 5000, 'BOSS-HP: the exact health, over the 20x');
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 3, bd: 1, bu: 1, bk: 0, fc: 0 } }, room);
  // a jump's sweep takes it without a fall: stood again for the same call, once the wait is out
  boss.dead = true;
  await run(1, 0.1);
  const n = log.raiders.length;
  at.wall += 7000;
  await run(1, 0.1);
  assert.equal(log.raiders.length, n, 'not yet: one coming over from a fallen runner may land');
  at.wall += 2000;
  assert.equal(frame(0.1), 'boss');
  await tick();
  assert.ok(isStaffBoss(log.raiders.at(-1).entity) && raid.bossFc === 0, 'the same call\'s boss, stood again');
  // a puppet of it standing at another's: nothing stood
  log.raiders.at(-1).dead = true;
  at.puppets = [{ _pupRaid: KEY, dead: false, entity: { staffBoss: { size: 2 } } }];
  await run(1, 0.1);
  at.wall += 20000;
  await run(2, 0.1);
  assert.ok(!isStaffBoss(log.raiders.at(-1).entity) || log.raiders.at(-1).dead, 'its puppet stands: no second boss');
  // one that fell, its word not yet heard: never stood again
  at.puppets = [];
  raid.bossDown = 1;
  at.wall += 20000;
  await run(2, 0.1);
  assert.ok(!log.raiders.slice(-2).some((f) => isStaffBoss(f.entity) && !f.dead), 'fallen: no second boss');
});

test('BOSS-CLEAR: Spawn mini boss now is at once, monsters standing or not; the meter\'s waits for the field that stood at its call to fall, a puppet of it too - BOSS-CLEAR-CALL: the packs come on all the while, and one stood since never holds it', async () => {
  const { at, log } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [EV] } }, 'social');
  await run(4);
  const room = log.words.at(-1)?.room ?? 'world:0';
  assert.ok(log.raiders.some((f) => !f.dead));
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, fb: 1 }] } }, 'social');
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 0, bd: 1, bu: 0, bk: 0, fc: 0 } }, room);
  assert.equal(frame(0.1), 'boss', 'by hand: at once');
  await tick();
  {
    // BOSS-CLEAR-CALL: while it stands, the packs come on
    raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, fb: 1, n: 100 }] } }, 'social');
    raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 0, bd: 1, bu: 1, bk: 0, fc: 0 } }, room);
    const before = log.raiders.length;
    await run(5);
    assert.ok(log.raiders.length > before, 'monsters stood while the boss stands');
  }
  // its fall, then the meter's next: waits for its last monster - and for a puppet of it at another's
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 3, bd: 1, bu: 1, bk: 1, fc: 0 } }, room);
  for (const f of log.raiders) kill(f);
  at.puppets = [{ _pupRaid: KEY, dead: false, entity: {} }];
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 6, bd: 1, bu: 0, bk: 0, fc: 1 } }, room);
  assert.notEqual(frame(0.1), 'boss', 'a puppet of it stands');
  await tick();
  const since = log.raiders.filter((f) => !f.dead).length;
  await run(3);
  assert.ok(log.raiders.filter((f) => !f.dead).length > since || since > 0, 'the packs come on while it waits');
  at.puppets[0].dead = true;
  assert.equal(frame(0.1), 'boss', 'the field of its call fell: monsters stood since hold nothing');
  await tick();
  // one nobody can reach never holds it back past two minutes
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 6, bd: 1, bu: 1, bk: 1, fc: 1 } }, room);
  for (const f of log.raiders) if (f.entity.staffBoss) kill(f);   // the call's boss fell (BOSS-ONE: one standing holds the next)
  at.puppets = [{ _pupRaid: KEY, dead: false, entity: {} }];
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 6, bd: 1, bu: 0, bk: 0, fc: 2 } }, room);
  assert.notEqual(frame(0.1), 'boss');
  at.wall += STAFF_BOSS_CLEAR_MAX_MS - 1;
  assert.notEqual(frame(0.1), 'boss');
  at.wall += 1;
  assert.equal(frame(0.1), 'boss');
});

test('BOSS-UNSHAKEN: a mini boss\'s wind-up holds under any blow, an overreach too; its kind\'s takes no shove', async () => {
  const { windupStruck } = await import('../../src/ai/tactics.js');
  const ai = { _tac: { blow: { guard: 'plain', poise: 1, taken: 0 } } };
  assert.equal(windupStruck(ai, { staffBoss: { size: 2 } }, 1, 999), null, 'no wind-up open: nothing to break, never a stagger');
  assert.match(rd('src/ai/tactics.js'), /if \(ent\?\.staffBoss\) return overreachOpen\(ai\) \|\| windupHolds\(ai\) \? 'hold' : null;/);
  assert.match(rd('src/scenes/exteriorFoes.js'), /if \(knockDir && !f\.entity\?\.staffBoss && weaponKnockbackApplies\(/, 'no shove, so no Hurt: the boss is never stun-locked');
});

test('PACK-SPREAD: each pack led from around the next player in the town in turn - me, then each peer in its rect', async () => {
  const { at, log, h } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  const ana = [100, 0, 100], bo = [-80, 0, 40];
  h.peerFeetInTown = () => [['zzz-0009', bo], ['aaa-0001', ana], ['mmm-0002', [9, 9, 9]], ['bad', null]];
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, n: 100 }] } }, 'social');
  let secs = 0;
  while (log.raiders.length < MAX_RAID_ENEMIES && secs < 200) { frame(0.05); await tick(); secs += 0.05; }
  const leaders = log.raiders.filter((f) => !f.o?.at);
  assert.ok(leaders.length >= 5);
  assert.deepEqual(leaders.slice(0, 6).map((f) => f.o.near ?? 'me'), [ana, 'me', bo, ana, 'me', bo], 'by id in turn: aaa, mmm (me, my own feet), zzz; a peer with no feet left out');
  assert.ok(leaders.every((f) => f.o.min === STAFF_PACK_FAR_MIN && f.o.max === STAFF_PACK_FAR_MAX));
  // alone: every pack around me
  _resetRaidingParties(); _resetStaffEvents();
  const solo = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => solo.at.now);
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, n: 100 }] } }, 'social');
  for (let i = 0; i < 200 && solo.log.raiders.length < 10; i++) { frame(0.05); await tick(); }
  assert.ok(solo.log.raiders.every((f) => f.o?.at || f.o?.near == null), 'my own feet');
  assert.ok(rd('src/scenes/raidHost.js').includes('feet: at?.at ?? at?.near ?? enchantFeet()'), 'the host stands a leader around the player it was given');   // PIN MOVED (WW6): the raids' host seams moved verbatim out of bootWorld to scenes/raidHost.js (HOST-SPLIT)
});

test('PACK-SCALE (card "Scale with players in town"): one player as ever; each more five more standing to forty, a quarter quicker to twice; the step stands to the scaled cap', async () => {
  assert.deepEqual([STAFF_PACK_CAP_MAX, STAFF_PACK_CAP_PER], [40, 5]);
  assert.deepEqual(staffPackScale(1), { cap: MAX_RAID_ENEMIES, speed: 1 }, 'alone: as ever');
  assert.deepEqual(staffPackScale(2), { cap: 30, speed: 1.25 });
  assert.deepEqual(staffPackScale(4), { cap: 40, speed: 1.75 });
  assert.deepEqual(staffPackScale(9), { cap: 40, speed: 2 }, 'at most forty, twice');
  assert.deepEqual(staffPackScale(0), staffPackScale(1));
  const { at, log, h } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  h.peerFeetInTown = () => [['me', [0, 0, 0], 1], ['p1', [50, 0, 0], 1], ['p2', [90, 0, 0], 1], ['p3', [130, 0, 0], 1]];
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, n: 100 }] } }, 'social');
  let secs = 0;
  while (log.raiders.length < 40 && secs < 120) { frame(0.05); await tick(); secs += 0.05; }
  assert.equal(log.raiders.length, 40, 'four players: forty standing');
  for (let i = 0; i < 40; i++) { frame(0.05); await tick(); }
  assert.equal(log.raiders.length, 40, 'and no more');
});

test('BOSS-SPOT (card "Biggest group, ties by level"): the boss stands beside the biggest group, a tie to the higher level, then the lower id; beside me when it is me', () => {
  assert.equal(STAFF_BOSS_GROUP_M, 30);
  const P = (id, x, lv) => [id, [x, 0, 0], lv];
  assert.equal(staffBossSpot([P('me', 0, 50), P('a', 200, 5), P('b', 210, 5), P('c', 220, 5)])[0], 'a', 'three together beat one high level alone');
  assert.equal(staffBossSpot([P('a', 0, 5), P('b', 10, 5), P('c', 200, 40), P('d', 210, 3)])[0], 'c', 'two and two: the group with the level 40');
  assert.equal(staffBossSpot([P('b', 0, 7), P('a', 500, 7)])[0], 'a', 'all equal: the lower id');
  assert.equal(staffBossSpot([P('me', 0, 1), ['x', null, 99]])[0], 'me', 'no feet: left out');
  assert.equal(staffBossSpot([]), null);
  const src = rd('src/systems/raidingParties.js');
  assert.equal(src.split("spawn(raid, 'boss', raid.staff.b, staffBossPlace(raid));\n      return 'boss';\n    }").length - 1, 2, 'the meter\'s boss and a lost one both');
  assert.match(src, /return at && at\[0\] !== me \? \{ near: at\[1\] \} : undefined;/);
  assert.ok(rd('src/scenes/raidHost.js').includes("peerFeetInTown: () => [[host.online?.id ?? '', player.feetAt(), playerEntity.level ?? 1], ...(host.peersNear() ?? [])"), 'me first, with my level');   // PIN MOVED (WW6): in scenes/raidHost.js, the host's live names as `host.<name>`
});

test('STAFF-EVENT PACKS: monsters stood in packs of 3-5 of any of the kinds picked, each led from anywhere around me, its pack around its leader, to the 25 cap in 7-15 s (PACK-FAST: was 20-45)', async () => {
  const { at, log, h } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  let r = 0;
  const rolls = [0.99, 0.5, 0.1, 0.7, 0.3];
  h.random = () => rolls[r++ % rolls.length];
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, n: 100, mt: [7, 12, 21] }] } }, 'social');
  let secs = 0;
  while (log.raiders.length < MAX_RAID_ENEMIES && secs < 200) { frame(0.05); await tick(); secs += 0.05; }
  assert.ok(secs >= STAFF_PACK_FILL_MIN_S && secs <= STAFF_PACK_FILL_MAX_S + 2, `the 25 stood in 7-15 s (${secs.toFixed(1)} s, a frame a stand on top)`);
  assert.deepEqual([STAFF_PACK_FILL_MIN_S, STAFF_PACK_FILL_MAX_S], [7, 15]);
  for (const roll of [() => 0, () => 0.999]) {   // the pace's ends, a last pack either size: the gaps before it inside 7-15 s
    const pace = staffPackPaceS(roll);
    for (const last of [1, STAFF_PACK_MIN, STAFF_PACK_MAX]) {   // the cap may cut the last pack to one
      const t = staffPackGapS(pace, MAX_RAID_ENEMIES - last);   // every pack's gap but the last's, summed
      assert.ok(t >= STAFF_PACK_FILL_MIN_S - 1e-9 && t <= STAFF_PACK_FILL_MAX_S + 1e-9, `a pace of ${pace.toFixed(1)} s, a last pack of ${last}: ${t.toFixed(1)} s`);
    }
  }
  assert.equal(log.raiders.length, MAX_RAID_ENEMIES);
  await run(5, 0.5);
  assert.equal(log.raiders.length, MAX_RAID_ENEMIES, 'never past the cap');
  // the packs: a leader sought far, any bearing; the rest at its feet, near; one kind a pack, 3-5 a pack
  const packs = [];
  for (const f of log.raiders) {
    if (!f.o?.at) packs.push([f]);
    else packs.at(-1).push(f);
  }
  for (const [lead, ...rest] of packs) {
    assert.deepEqual([lead.o.min, lead.o.max, lead.o.los], [STAFF_PACK_FAR_MIN, STAFF_PACK_FAR_MAX, false]);
    assert.ok(rest.every((f) => f.o.max === STAFF_PACK_NEAR && f.o.los === false && f.o.at[0] === lead.ai.feet[0]));
  }
  assert.ok(packs.some((p) => new Set(p.map((f) => f.mobileType)).size > 1), 'a pack of any of the kinds picked');
  assert.ok(packs.slice(0, -1).every((p) => p.length >= STAFF_PACK_MIN && p.length <= STAFF_PACK_MAX), packs.map((p) => p.length).join(','));
  // the host's placement: a town raid's the mod's just out of view
  assert.deepEqual(raidSpawnRange(undefined), { minDistance: RAID_SPAWN_MIN_DISTANCE, maxDistance: RAID_SPAWN_MAX_DISTANCE, lineOfSightCheck: true, open: true });   // PACK-OPEN
  assert.deepEqual(raidSpawnRange({ min: 1.5, max: 6, los: false }), { minDistance: 1.5, maxDistance: 6, lineOfSightCheck: false, open: true });
});

test('STAFF-EVENT PACKS: a leader with no spot far off is tried again nearer, the pack never lost', async () => {
  const { at, log, h } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  const asked = [];
  const stand = h.standRaider;
  h.standRaider = (mt, o) => { asked.push(o); return o?.min === STAFF_PACK_FAR_MIN ? Promise.resolve(null) : stand(mt, o); };
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [EV] } }, 'social');
  await run(20, 0.2);
  assert.deepEqual([asked[0].min, asked[1].min], [STAFF_PACK_FAR_MIN, RAID_SPAWN_MIN_DISTANCE], 'far, then nearer');
  assert.ok(log.raiders.length >= 2 && log.raiders[1].o.at, 'and its pack around it');
});

test('STAFF-EVENT THE REWARD: my kills on the board - a monster of mine I struck, a puppet of another\'s I struck that fell (once); a death I never struck is no kill of mine', async () => {
  _resetRenownKillsForTests();
  const { at, log } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [EV] } }, 'social');
  await run(12);
  const [a, b] = log.raiders;
  renownFoeStruck(a);
  kill(a);
  kill(b);
  const pup = { puppet: true, _pupRaid: KEY, dead: false, corpse: false, entity: { health: 5 } };
  const unstruck = { puppet: true, _pupRaid: KEY, dead: true, corpse: true, entity: { health: 0 } };
  at.puppets = [pup, unstruck];
  renownFoeStruck(pup);
  await run(1);
  assert.deepEqual([log.words.at(-1).w.n, log.words.at(-1).w.h], [2, 1], 'two deaths of mine stood, one of them my kill');
  Object.assign(pup, { dead: true, corpse: true });
  at.wall += 6000;
  await run(1);
  await run(1);
  assert.deepEqual([log.words.at(-1).w.n, log.words.at(-1).w.h], [2, 2], 'and the puppet I fought, once');
  _resetRenownKillsForTests();
});

test('STAFF-EVENT: an event\'s runner is elected by the raid\'s own words; a claim on a staff key rides the wire', async () => {
  const { at } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  staffEventBook([EV]);
  await run(2);
  const word = raidWireWord(at.wall);
  assert.equal(word[0][0], KEY);
  assert.deepEqual(validRaidWords(word).map((x) => x.key), [KEY], 'the wire takes a staff key');
  assert.deepEqual([...validRaidTags([[5, KEY], [6, 's.X']])], [[5, KEY]]);
  assert.deepEqual([...validStaffBossTags([[5, 250], [6, 200], [7, 99]])], [[5, 250]], 'one boss a frame, sized 1.5x-3x');
});

test('STAFF-EVENT: THE MINI BOSS\'S LOOKS - an elite, larger, its glow carried past the elite\'s band (the shader reads yellow), named Mighty', () => {
  const e = { health: 10, maxHealth: 10, mobileType: 7 };
  assert.ok(promoteStaffBoss(e, { sizePct: 300 }));
  assert.equal(e.maxHealth, 10 * STAFF_BOSS_HEALTH_MULT, 'unset: 10x');
  assert.ok(e.eliteFoe);
  assert.equal(eliteSize(e), 3);
  const g = eliteGlow(e, 1);
  assert.ok(g >= STAFF_BOSS_GLOW + 0.55 && g <= STAFF_BOSS_GLOW + 1, 'a boss\'s glow: 2.55-3');
  const plain = { health: 10, eliteFoe: true };
  assert.ok(eliteGlow(plain, 1) <= 1, 'an elite\'s stays 0.55-1');
  assert.equal(eliteSize(plain), ELITE_FOE_SIZE);
  const puppet = { health: 10, maxHealth: 10 };
  promoteStaffBoss(puppet, { own: false, sizePct: 200 });
  assert.equal(puppet.maxHealth, 10, 'a puppet\'s health is its owner\'s word');
  const capped = { health: 10, maxHealth: 10 };
  promoteStaffBoss(capped, { healthX: 1000 });
  assert.equal(capped.maxHealth, 1000, 'at most 100x');
  assert.equal(foeTitle(e, 'Orc'), 'Mighty Orc');
  const glsl = rd('src/systems/hitFlash.js');
  assert.match(glsl, /STAFF_BOSS_RIM = vec3\(1\.0, 0\.82, 0\.18\)/, 'yellow');
  assert.match(glsl, /boss \? STAFF_BOSS_RIM : ELITE_RIM/);
});

test('STAFF-EVENT BOSS-HARD: every mini boss - owner and puppet - asks Silver and wears a Troll\'s armour; BOSS-UNSHAKEN: never paralysed', () => {
  for (const own of [true, false]) {
    const e = { health: 50, maxHealth: 50, minMetalToHit: undefined, armor: 30, armorValues: [30, 5, 30, 30, 30, 30, 30] };
    assert.ok(!isImmuneToParalysis(e), 'a plain foe can be held');
    promoteStaffBoss(e, { own });
    assert.equal(e.minMetalToHit, STAFF_BOSS_MIN_METAL);
    assert.deepEqual(e.armorValues, [10, 5, 10, 10, 10, 10, 10], 'the Troll\'s 10, a better part kept');
    assert.equal(e.armor, STAFF_BOSS_ARMOR);
    assert.equal(dropWeaponIfTargetImmune({ material: 1 }, e), null, 'steel does nothing');
    assert.ok(dropWeaponIfTargetImmune({ material: 2 }, e), 'silver bites');
    assert.ok(isImmuneToParalysis(e), 'never held');
  }
  const daedra = { health: 50, maxHealth: 50, minMetalToHit: 5 };
  promoteStaffBoss(daedra);
  assert.equal(daedra.minMetalToHit, 5, 'a higher floor stays');
  assert.match(rd('src/scenes/hostCombat.js'), /target\.ai && !tEnt\?\.staffBoss && !windupHolds/, 'no foe shoves it');
  assert.match(rd('src/scenes/exteriorFoes.js'), /r\.h < p\.h && !f\.entity\.staffBoss\) p\.hurt = true/, 'its puppet plays no Hurt');
});

test('STAFF-EVENT: the client\'s word and the relay\'s frame - a staff word parsed by the relay\'s own parser; the game reads its frames off the raid door', () => {
  const m = parseClient(JSON.stringify({ t: 'sev', k: 'w', id: EV.id, px: 200, py: 100, n: 3, s: 1 }), { hasHello: true });
  assert.deepEqual(m, { t: 'sev', k: 'w', id: EV.id, px: 200, py: 100, n: 3, s: 1, bu: 0, bk: 0, fb: 0, h: 0 });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'sev', k: 'w', id: 'X', px: 200, py: 100, n: 3 }), { hasHello: true }), { error: 'bad sev' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'sev', k: 'w', id: EV.id, px: 200, py: 100, n: 3 })), { error: 'sev before hello' });
  const online = rd('src/net/online.js');
  assert.match(online, /m\.t === 'sev'/);
  assert.match(online, /relaySupportsStaffEvents/);
  assert.match(online, /r\.k === 'st' \|\| r\.k === 'bd' \|\| r\.k === 'rc' \? isCellRoom\(room\)/, 'THE REWARD: the board and my receipt from the place\'s cell alone');
  assert.match(rd('src/scenes/raidHost.js'), /onRaidReceipt: \(r, c, held\) => \{ \(c\?\.v \? grantStaffSpoils\(host\.raidSpoils, spoilsLock, c, /, 'THE REWARD: an event\'s receipt rolls its spoils into the pack');   // PIN MOVED (WW6): in scenes/raidHost.js (HOST-SPLIT)   // PIN MOVED (AUDIT WORLD-EVENTS L3-14): a raid's receipt carries whether its town was held
  assert.ok(validStaffEvent(EV));
  // mob 2026-10-24: a city said as a city, anything else as an area
  assert.equal(staffAttackLine({ locationIndex: -1, locationName: 'Road', regionIndex: 3, staff: { b: 7 } }), 'The area of Road is under attack!');
  assert.equal(staffBossLine({ locationIndex: -1, locationName: 'Road', regionIndex: 3, staff: { b: 130 } }), 'A mighty Battlemage has come to the area of Road!', 'a class named by its own name');
  assert.equal(staffEndLine({ locationIndex: -1, locationName: 'Road', regionIndex: 3, bossDown: 0, staff: { b: 7 } }), 'The attack on the area of Road is over.');
  const city = { locationIndex: 7, locationName: 'Gothway Garden', regionIndex: 3, staff: { b: 7, ct: 1 } };
  assert.equal(staffAttackLine(city), 'The city of Gothway Garden is under attack!');
  assert.match(staffBossLine(city), /^A mighty .+ has come to the city of Gothway Garden!$/);
  assert.match(staffEndLine({ ...city, bossDown: 1 }), /^The .+ has fallen\. The city of Gothway Garden is safe\.$/);
  assert.equal(staffEndLine({ ...city, bossDown: 0 }), 'The attack on the city of Gothway Garden is over.');
  assert.equal(staffAttackLine({ ...city, staff: { b: 7, ct: 0 } }), 'The area of Gothway Garden is under attack!', 'a named place that is no town (a dungeon, a temple) is an area');
});

test('PACK-OPEN: a spot held in a solid or under a roof is refused, and the loose stand tries again', async () => {
  const { raidSpotOpen, RAID_SPOT_ROOF_M } = await import('../../src/player/enterExit.js');
  const { standLooseFoe } = await import('../../src/scenes/hostEnchant.js');
  const col = (inside, roof) => ({ insideSolid: () => inside, raycast: (o, d) => (d[1] > 0 && roof ? 5 : Infinity) });
  assert.equal(raidSpotOpen(col(false, false), { x: 0, y: 0, z: 0 }), true, 'open street');
  assert.equal(raidSpotOpen(col(true, false), { x: 0, y: 0, z: 0 }), false, 'inside a closed shell');
  assert.equal(raidSpotOpen(col(false, true), { x: 0, y: 0, z: 0 }), false, 'a roof overhead');
  assert.equal(RAID_SPOT_ROOF_M, 30);
  assert.equal(raidSpawnRange(undefined).open, true, 'every raid and event stand asks it');
  assert.match(rd('src/scenes/hostEnchant.js'), /if \(spot && open && !raidSpotOpen\(collider, spot\)\) spot = null;/);
  assert.equal(typeof standLooseFoe, 'function');
});

test('PACK-EVERY: out of a town (an area event) the players on my map pixel share the packs, the scale and the boss - in a town, its rect as ever', async () => {
  const { peerInEventPlace } = await import('../../src/systems/raidingParties.js');
  const world = { worldCoords: (p) => ({ x: p[0], z: p[2] }) };
  assert.equal(peerInEventPlace([1, 0, 1], (f) => f.ai.feet[0] === 1, world, null), true, 'in a town: its rect');
  assert.equal(peerInEventPlace([2, 0, 1], (f) => f.ai.feet[0] === 1, world, null), false);
  const { worldCoordToMapPixel } = await import('../../src/world/streamingWorld.js');
  const me = worldCoordToMapPixel(10, 10);
  assert.equal(peerInEventPlace([10, 0, 10], null, world, me), true, 'an area: my pixel');
  assert.equal(peerInEventPlace([10 + 1e6, 0, 10], null, world, me), false, 'another pixel');
  assert.equal(peerInEventPlace(null, null, world, me), false);
  // PIN MOVED (the fifth merge of main into #1184): the raid host is scenes/raidHost.js (#1184's HOST-SPLIT) - `_musicLoc` read live
  assert.ok(rd('src/scenes/raidHost.js').includes('.filter((p) => raidPeerInPlace(p.feet, host._musicLoc ? _foeInTownRect : null, state, playerTravelPixel())).map('), 'the host asks it');
});

test('PACK-STALL: a leader with no spot about one player goes to the next after STAFF_PACK_LEADER_TRIES - the packs never stall on one', async () => {
  const { STAFF_PACK_LEADER_TRIES } = await import('../../src/systems/raidingParties.js');
  assert.equal(STAFF_PACK_LEADER_TRIES, 3);
  const { at, log, h } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  const stuck = [500, 0, 500], ok = [-80, 0, 40];
  h.peerFeetInTown = () => [['aaa-0001', stuck], ['zzz-0009', ok]];
  const stand = h.standRaider;
  let refused = 0;
  h.standRaider = (mt, o) => (o?.near === stuck && !o?.at ? (refused++, Promise.resolve(null)) : stand(mt, o));
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, n: 100 }] } }, 'social');
  let secs = 0;
  while (log.raiders.length < MAX_RAID_ENEMIES && secs < 200) { frame(0.05); await tick(); secs += 0.05; }
  assert.equal(log.raiders.length, MAX_RAID_ENEMIES, 'the cap stood although one player has no spot about them');
  assert.ok(refused >= STAFF_PACK_LEADER_TRIES, 'the stuck player was tried');
  const leaders = log.raiders.filter((f) => !f.o?.at);
  assert.ok(leaders.some((f) => f.o.near === ok) && leaders.some((f) => f.o.near == null), 'the others still had their packs');
});

test('BOSS-RETRY: a boss with no spot by its group keeps its call and stands about me after STAFF_PACK_LEADER_TRIES misses', async () => {
  const { STAFF_PACK_LEADER_TRIES } = await import('../../src/systems/raidingParties.js');
  const { at, log, h } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  const grp = [500, 0, 500];
  h.peerFeetInTown = () => [['mmm-0002', [0, 0, 0], 1], ['a', grp, 1], ['b', [505, 0, 500], 1], ['c', [510, 0, 500], 1]];
  const stand = h.standRaider;
  let misses = 0;
  h.standRaider = (mt, o) => (o?.near === grp && !o?.at ? (misses++, Promise.resolve(null)) : stand(mt, o));
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [EV] } }, 'social');
  await run(4);
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, fb: 1 }] } }, 'social');
  const { staffEventLedger } = await import('../../src/systems/staffEvents.js');
  assert.ok(staffEventLedger({ id: EV.id, n: 0, bd: 1, bu: 0, bk: 0, fc: 0 }), 'the cell calls the boss');
  for (let i = 0; i < 40 && !log.raiders.some((f) => f.entity.staffBoss); i++) { frame(0.1); await tick(); }
  const boss = log.raiders.find((f) => f.entity.staffBoss);
  assert.ok(boss, 'the boss stood');
  assert.ok(misses >= STAFF_PACK_LEADER_TRIES, 'tried by the group first');
  assert.equal(boss.o?.near, undefined, 'then about me');
  const src = rd('src/systems/raidingParties.js');
  assert.match(src, /raid\.bossUp = 1;\n\s*raid\.bossDown = 0;\n\s*raid\.clearSince = undefined;\n\s*raid\.clearWait = undefined;\n\s*if \(raid\.bossHand != null\) raid\.handSeen = raid\.bossHand;\n\s*_bossMisses = 0;\n\s*\}/, 'the field\'s wait and the by-hand word spent once it stands');
});

test('PACK-KEEP: a raid\'s monster stands past the runner\'s cull while any player is near it; one culled or let go is no kill, and its place is stood again in turn', () => {
  const src = rd('src/scenes/exteriorFoes.js');
  assert.ok(src.includes('const _raidKept = !!f.raidKey && playerNearFoe(f, ENCOUNTER_CULL_DISTANCE);') && src.includes('&& !_raidKept && !(_qTag(f) && partyNearFoe(f, _cullAt))'), 'the cull spares it while a player is near');
  assert.match(src, /const playerNearFoe = \(f, r\) => peerCandidates\(\)\.some\(\(c\) => Array\.isArray\(c\.feet\) && Math\.hypot\(/);
  const rp = rd('src/systems/raidingParties.js');
  assert.ok(rp.includes("if (!e.foe.corpse || !raid || !raidActive(raid, now)) continue; // removed, not killed"), 'a despawn is never a kill');
  assert.ok(rp.includes("if (fights) {\n        foe.raidKey = p.key;"), 'its raid tagged on the foe at its stand');
});

test('STAFF-PILOT (card "Take over the boss", no relay update): Play as boss takes the run off an older runner with the oldest claim the wire carries; the boss that stands is the pilot\'s; the claim age never passes the wire\'s bound', async () => {
  const { pilotStart, pilotStop, pilotKey, PILOT_CLAIM_AGE, resetPilot } = await import('../../src/systems/staffBossPilot.js');
  const { raidPeerWord, staffPilotBoss } = await import('../../src/systems/raidingParties.js');
  const { raidRunnerOf, RAID_CLAIM_AGE_MAX } = await import('../../src/world/raidShared.js');
  resetPilot();
  assert.equal(PILOT_CLAIM_AGE, RAID_CLAIM_AGE_MAX, 'the oldest claim the wire carries');
  const { at, log, h } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  h.peersInTown = () => ['aaa-0001'];
  h.peerFeetInTown = () => [['mmm-0002', [0, 0, 0], 1], ['a', [500, 0, 500], 1], ['b', [505, 0, 500], 1]];   // PILOT-ON-ME: a bigger group off me
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [EV] } }, 'social');
  raidPeerWord('aaa-0001', [[KEY, 0, 60_000]], at.wall);
  assert.equal(frame(2.1), 'standing-by', 'an older claim runs it');
  assert.equal(log.raiders.length, 0);
  assert.equal(pilotStart('bad id!', 0), false, 'a bad id is refused');
  assert.equal(pilotStart(EV.id, 0), true);
  assert.equal(pilotKey(), KEY);
  await run(3);
  assert.ok(log.raiders.length > 0, 'the run is mine');
  const word = raidWireWord(at.wall).find((w) => w[0] === KEY);
  assert.equal(word[2], RAID_CLAIM_AGE_MAX, 'my claim the oldest the wire takes');
  assert.equal(validRaidWords([word]).length, 1);
  assert.equal(raidRunnerOf({ me: 'aaa-0001', inTown: ['mmm-0002'], claims: [{ id: 'aaa-0001', age: 3_600_000 }, { id: 'mmm-0002', age: word[2] }] }), 'mmm-0002', 'the old runner\'s game - an old page\'s law too - hands it over');
  at.wall += RAID_CLAIM_AGE_MAX;
  assert.equal(raidWireWord(at.wall).find((w) => w[0] === KEY)[2], RAID_CLAIM_AGE_MAX, 'held to the bound, never dropped');
  assert.equal(staffPilotBoss(), null, 'no boss yet');
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, fb: 1 }] } }, 'social');
  const { staffEventLedger } = await import('../../src/systems/staffEvents.js');
  staffEventLedger({ id: EV.id, n: 0, bd: 1, bu: 0, bk: 0, fc: 0 });
  for (let i = 0; i < 40 && !staffPilotBoss(); i++) { frame(0.1); await tick(); }
  const boss = staffPilotBoss();
  assert.ok(boss?.entity?.staffBoss, 'Spawn mini boss now stands it on my machine - the boss I steer');
  assert.equal(boss.o?.near, undefined, 'PILOT-ON-ME: about me, never by the biggest group');
  // BOSS-ONE: a later call while a boss of the event stands stands no second one
  const bosses = () => log.raiders.filter((f) => f.entity.staffBoss).length;
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, fb: 2 }] } }, 'social');
  staffEventLedger({ id: EV.id, n: 0, bd: 1, bu: 0, bk: 0, fc: 1 });
  for (let i = 0; i < 20; i++) { frame(0.1); await tick(); }
  assert.equal(bosses(), 1, 'one boss while one stands');
  assert.equal(staffPilotBoss(), boss);
  pilotStop();
  assert.equal(staffPilotBoss(), null);
  resetPilot();
});

test('STAFF-PILOT: the boss stands where I stand and faces where I look; its own swings and casts held; a click its swing now at the player nearest my facing; my body no one\'s; the steering ends when it falls or none stands', async () => {
  const P = await import('../../src/systems/staffBossPilot.js');
  const { concealBits } = await import('../../src/systems/effects.js');
  const { peerDraw } = await import('../../src/systems/combatVisuals.js');
  P.resetPilot();
  const boss = { raidKey: KEY, dead: false, puppet: null, entity: { staffBoss: { size: 2 } }, ai: { feet: [0, 0, 0], yaw: 0 } };
  assert.equal(P.pilotFoe(boss), false, 'no pilot: no boss of mine is steered');
  assert.equal(P.pilotHolds(boss, 'swing', 0), false);
  P.pilotStart(EV.id, 1000);
  assert.equal(P.pilotFoe(boss), true);
  assert.equal(P.pilotFoe({ ...boss, puppet: 'aaa-0001' }), false, 'another\'s boss is theirs');
  assert.equal(P.pilotFoe({ ...boss, entity: {} }), false, 'a pack monster is not the boss');
  P.pilotYaw(Math.PI / 2);
  P.pilotSteer(boss, [10, 2, 5], [], 1000);
  assert.deepEqual([...boss.ai.feet, boss.ai.yaw, boss.ai.moving], [10, 2, 5, Math.PI / 2, true]);
  assert.equal(P.pilotHolds(boss, 'swing', 1000), true, 'no click: its swing held');
  assert.equal(P.pilotHolds(boss, 'cast', 1000), true);
  const ahead = { id: 'p1', feet: [14, 2, 5], health: 1 }, behind = { id: 'p2', feet: [7, 2, 5], health: 1 }, far = { id: 'p3', feet: [30, 2, 5], health: 1 };
  assert.equal(P.pilotTarget([10, 2, 5], Math.PI / 2, [behind, far, ahead]), ahead, 'the one my facing holds, in reach');
  assert.equal(P.pilotPress(0, 1100), true);
  P.pilotSteer(boss, [10, 2, 5], [behind, far, ahead], 1100);
  assert.equal(boss.ai.target, ahead);
  assert.equal(P.pilotHolds(boss, 'swing', 1100), false, 'a click: its swing now');
  assert.equal(boss.ai._blowSwing, true);
  assert.equal(P.pilotHolds(boss, 'swing', 1150), false, 'held open until the machine takes it');
  boss.ai._blowSwing = false;
  assert.equal(P.pilotHolds(boss, 'swing', 1150), true, 'one click one swing');
  P.pilotPress(2, 1200);
  assert.equal(P.pilotHolds(boss, 'cast', 1200 + P.PILOT_CAST_MS - 1), false, 'a right click: its spell decision runs');
  assert.equal(P.pilotHolds(boss, 'cast', 1201 + P.PILOT_CAST_MS), true);
  assert.equal(concealBits({ staffPilot: true }), P.PILOT_CONCEAL);
  assert.equal(peerDraw(P.PILOT_CONCEAL, true, 0, 'x').kind, 'hidden', 'drawn nowhere, the enhanced skin too');
  assert.equal(peerDraw(1, true, 0, 'x').kind, 'conceal', 'an invisible player shimmers as ever');
  assert.equal(P.pilotLost(boss, 2000), null);
  boss.dead = true;
  assert.equal(P.pilotLost(null, 2000), 'fell');
  P.pilotStart(EV.id, 0);
  assert.equal(P.pilotLost(null, 3_600_000), null, 'PILOT-ARM: none stood yet - armed, it waits for the meter\'s boss');
  assert.equal(P.piloting(), true);
  P.resetPilot();
});

test('STAFF-PILOT: the page\'s half - the panel\'s word starts and ends it, a hidden game is shown first, the end said back; the door passes `pilot`', async () => {
  const P = await import('../../src/systems/staffBossPilot.js');
  const { createStaffPilotHost } = await import('../../src/scenes/staffPilotHost.js');
  P.resetPilot();
  const posts = [], entity = {}, listeners = {};
  const win = { document: { pointerLockElement: {} }, addEventListener: (k, f) => { listeners[k] = f; } };
  let shown = 0, t = 0, boss = null;
  const host = createStaffPilotHost({ post: (m) => posts.push(m), win, entity, hidden: () => true, showMe: () => { shown++; }, bossOf: () => boss, now: () => t });
  host.word({ dfoStaff: 'pilot', on: true, ev: EV.id });
  assert.deepEqual(posts.at(-1), { dfoStaff: 'pilot', on: true, ev: EV.id, boss: false });
  assert.equal(shown, 1, 'Hide me off first');
  host.frame();
  assert.equal(entity.staffPilot, true);
  listeners.mousedown({ button: 0 });
  host.eye({ yaw: 1.25 });
  boss = { raidKey: KEY, dead: false, puppet: null, entity: { staffBoss: { size: 2 } }, ai: { feet: [0, 0, 0], yaw: 0 } };
  P.pilotSteer(boss, [1, 0, 1], [], 0);
  assert.equal(boss.ai.yaw, 1.25);
  host.frame();
  boss.dead = true;
  host.frame();
  assert.deepEqual(posts.at(-1), { dfoStaff: 'pilot', on: false, ev: EV.id, why: 'fell' });
  assert.equal(entity.staffPilot, false);
  host.word({ dfoStaff: 'pilot', on: true, ev: EV.id });
  host.word({ dfoStaff: 'pilot', on: false });
  assert.deepEqual(posts.at(-1), { dfoStaff: 'pilot', on: false, ev: EV.id, why: 'left' });
  host.word({ dfoStaff: 'pilot', on: true, ev: '../x' });
  assert.equal(posts.at(-1).why, 'bad');
  const door = rd('src/net/staffHook.js');
  assert.match(door, /m\.dfoStaff === 'pilot' && typeof m\.on === 'boolean' && !\('boss' in m\) && !\('why' in m\) && pilot\) \{\n\s*seen = true;\n\s*pilot\(m\);\n\s*\}/);
  const pool = rd('src/scenes/exteriorFoes.js');
  assert.match(pool, /f\.ai\.update\(foeFrameDt\(dt\), playerFeet, _armed\(f, senses\), _fParalyzed, _fPaused\);[^\n]*\n\s*f\.ai\._pilot = pilotFoe\(f\) \? pilotSteer\(f, playerFeet, peerCandidates\(\), performance\.now\(\)\) : null;/, 'steered after its motor, its holds on its brain');
  // the machines read the holds: the attack decides no swing of its own (a swing in flight still steps), the cast none
  const { EnemyAttack } = await import('../../src/characters/enemy/enemyAttack.js');
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 1, reflexes: 2, rolls: () => 0 });
  const brain = { feet: [0, 0, 0], yaw: 0, _dist: 1, inSight: true, detected: true, lastKnownTargetPos: [0, 0, 1], giveUpTimer: 5, canAct: true, _pilot: { swing: true, cast: true } };
  atk.update(2, brain, [0, 0, 1]);
  assert.equal(atk.swingSeq, 0, 'held: no swing of its own');
  brain._pilot = { swing: false, cast: true }; brain._blowSwing = true; brain._blowAt = null;
  atk.update(2, brain, [0, 0, 1]);
  assert.equal(atk.swingSeq, 1, 'a click: its swing');
  const { EnemyCaster } = await import('../../src/characters/enemy/enemyCasting.js');
  assert.equal(EnemyCaster.prototype.update.call({ entity: { spells: [{}] } }, 1, { _pilot: { cast: true } }, atk, [0, 0, 1], {}), null, 'no cast of its own');
  assert.match(pool, /if \(f\.dead \|\| !f\._mout\) continue;\n\s*if \(pilotFoe\(f\)\) continue;/, 'my copy not drawn');
  P.resetPilot();
});

test('BOSS-ONE (2026-10-28: "there was 20 mini bosses", "just only spawn once", card "Both"): a boss call while a boss of the event stands - a peer\'s puppet too - stands no second one; once it is gone the next call stands', async () => {
  const { at, log } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [EV] } }, 'social');
  await run(4);
  const room = log.words.at(-1)?.room ?? 'world:0';
  at.puppets = [{ _pupRaid: KEY, dead: false, entity: { staffBoss: { size: 2 } } }];
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, fb: 1 }] } }, 'social');
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 0, bd: 1, bu: 0, bk: 0, fc: 0 } }, room);
  assert.notEqual(frame(0.1), 'boss', 'a peer\'s boss stands: none of mine');
  await run(2);
  assert.equal(log.raiders.filter((f) => f.entity.staffBoss).length, 0);
  at.puppets[0].dead = true;
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, fb: 2 }] } }, 'social');
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 0, bd: 1, bu: 0, bk: 0, fc: 1 } }, room);
  assert.equal(frame(0.1), 'boss', 'it fell: the next call stands');
});

test('PILOT-BAR (2026-10-28: "let me see the bosses bar so i know when im hurt"): while I steer, my boss\'s health on the gate\'s boss bar - its name, its share, the numbers - and put away when it falls or I leave (mutants: the bar never drawn, never put away)', async () => {
  const P = await import('../../src/systems/staffBossPilot.js');
  const { createStaffPilotHost } = await import('../../src/scenes/staffPilotHost.js');
  const { pilotBarModel, PILOT_BAR_TEXT } = await import('../../src/ui/staffPilotBar.js');
  P.resetPilot();
  const drawn = [];
  let boss = null;
  const host = createStaffPilotHost({ post: () => {}, win: null, entity: {}, bossOf: () => boss, now: () => 5, drawBar: (m) => drawn.push(m) });
  host.frame();
  assert.equal(drawn.length, 0, 'not steering: nothing drawn');
  host.word({ dfoStaff: 'pilot', on: true, ev: EV.id });
  host.frame();
  assert.equal(drawn.length, 0, 'armed, no boss yet: no bar');
  boss = { raidKey: KEY, dead: false, puppet: null, mobileType: 17, entity: { staffBoss: { size: 2 }, health: 1500, maxHealth: 5000 }, ai: { feet: [0, 0, 0], yaw: 0 } };
  host.frame();
  const m = drawn.at(-1);
  assert.equal(m.frac, 0.3);
  assert.equal(m.title, PILOT_BAR_TEXT.title());
  assert.equal(m.fightersLine, 'Health 1500 / 5000');
  assert.deepEqual(m.spent, [true, false], 'past half, not yet a quarter');
  boss.entity.health = 500;
  host.frame();
  assert.equal(drawn.at(-1).low, true, 'under a fifth: low');
  boss.dead = true;
  host.frame();
  assert.equal(drawn.at(-1), null, 'it fell: the bar put away');
  const n = drawn.length;
  host.frame();
  assert.equal(drawn.length, n, 'put away once');
  assert.equal(pilotBarModel(null, 0), null);
  assert.equal(pilotBarModel({ dead: false, entity: { health: 10, maxHealth: 0 } }, 0).frac, 1, 'no max: whole, never a divide by nothing');
  P.resetPilot();
});
