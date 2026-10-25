// STAFF-EVENT (2026-10-24, mob: "lets start making an event tool for staff to use / ... / mini boss need to be a single
// enlarges version of the mob spawns / instead of the blue elite glow lets make the mini boss have a yellow glow";
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
    standRaider: (mt, o) => { const f = foe(mt); f.o = o; if (o?.at) f.ai.feet = [...o.at]; log.raiders.push(f); return Promise.resolve(f); },
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
  // BOSS-CLEAR (mob 2026-10-25: "make sure all those mob are dead not spawned befor the bosss"; BOSS-CLEAR-CALL: "no
  // only the mini boss need to wait for everything to be dead"): three still stand - no boss until they are dead
  assert.ok((await run(3)).every((x) => x !== 'boss'));
  assert.ok(!log.said.some((l) => /A mighty/.test(l)), 'not said before it stands');
  for (const f of log.raiders.slice(3)) kill(f);
  assert.equal(frame(0.1), 'boss');
  await tick();
  const boss = log.raiders.at(-1);
  assert.equal(boss.mobileType, 24, 'staff\'s pick: an Orc Warlord');
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

test('BOSS-LOST and BOSS-HP (mob 2026-10-25: "boss seems to not spawn every time", "need be able to eneter a exact amount of healt"): a boss stand given up on is asked again; a boss gone without falling is stood again; one coming over is waited for; the exact health wins', async () => {
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
  at.puppets = [{ _pupRaid: KEY, dead: false, entity: {} }];
  raidRelayWord({ k: 'sev', sev: { k: 'st', id: EV.id, n: 6, bd: 1, bu: 0, bk: 0, fc: 2 } }, room);
  assert.notEqual(frame(0.1), 'boss');
  at.wall += STAFF_BOSS_CLEAR_MAX_MS - 1;
  assert.notEqual(frame(0.1), 'boss');
  at.wall += 1;
  assert.equal(frame(0.1), 'boss');
});

test('BOSS-UNSHAKEN (mob 2026-10-25: "he got stun locked lets stop him from getting stunned"): a mini boss\'s wind-up holds under any blow, an overreach too; its kind\'s takes no shove', async () => {
  const { windupStruck } = await import('../../src/ai/tactics.js');
  const ai = { _tac: { blow: { guard: 'plain', poise: 1, taken: 0 } } };
  assert.equal(windupStruck(ai, { staffBoss: { size: 2 } }, 1, 999), null, 'no wind-up open: nothing to break, never a stagger');
  assert.match(rd('src/ai/tactics.js'), /if \(ent\?\.staffBoss\) return overreachOpen\(ai\) \|\| windupHolds\(ai\) \? 'hold' : null;/);
  assert.match(rd('src/scenes/exteriorFoes.js'), /if \(knockDir && !f\.entity\?\.staffBoss && weaponKnockbackApplies\(/, 'no shove, so no Hurt: the boss is never stun-locked');
});

test('PACK-SPREAD (mob 2026-10-25: "evenly swap them between all player in a city"): each pack led from around the next player in the town in turn - me, then each peer in its rect', async () => {
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
  assert.ok(rd('src/scenes/world.js').includes('feet: at?.at ?? at?.near ?? enchantFeet()'), 'the host stands a leader around the player it was given');
});

test('PACK-SCALE (mob 2026-10-25: "they arnt spawn ing quick enough", card "Scale with players in town"): one player as ever; each more five more standing to forty, a quarter quicker to twice; the step stands to the scaled cap', async () => {
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

test('BOSS-SPOT (mob 2026-10-25: "spawn it on the highest lvl player", "or largewst groupoing"; card "Biggest group, ties by level"): the boss stands beside the biggest group, a tie to the higher level, then the lower id; beside me when it is me', () => {
  assert.equal(STAFF_BOSS_GROUP_M, 30);
  const P = (id, x, lv) => [id, [x, 0, 0], lv];
  assert.equal(staffBossSpot([P('me', 0, 50), P('a', 200, 5), P('b', 210, 5), P('c', 220, 5)])[0], 'a', 'three together beat one high level alone');
  assert.equal(staffBossSpot([P('a', 0, 5), P('b', 10, 5), P('c', 200, 40), P('d', 210, 3)])[0], 'c', 'two and two: the group with the level 40');
  assert.equal(staffBossSpot([P('b', 0, 7), P('a', 500, 7)])[0], 'a', 'all equal: the lower id');
  assert.equal(staffBossSpot([P('me', 0, 1), ['x', null, 99]])[0], 'me', 'no feet: left out');
  assert.equal(staffBossSpot([]), null);
  const src = rd('src/systems/raidingParties.js');
  assert.equal(src.split("spawn(raid, 'boss', raid.staff.b, staffBossPlace()); return 'boss'; }").length - 1, 2, 'the meter\'s boss and a lost one both');
  assert.match(src, /return at && at\[0\] !== me \? \{ near: at\[1\] \} : undefined;/);
  assert.ok(rd('src/scenes/world.js').includes("peerFeetInTown: () => [[online?.id ?? '', player.feetAt(), playerEntity.level ?? 1], ...(peersNear() ?? [])"), 'me first, with my level');
});

test('STAFF-EVENT PACKS: monsters stood in packs of 3-5 of any of the kinds picked, each led from anywhere around me, its pack around its leader, to the 25 cap in 20-45 s', async () => {
  const { at, log, h } = rig();
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [] });
  setSharedClock(() => at.now);
  let r = 0;
  const rolls = [0.99, 0.5, 0.1, 0.7, 0.3];
  h.random = () => rolls[r++ % rolls.length];
  raidRelayWord({ k: 'sev', sev: { k: 'ev', l: [{ ...EV, n: 100, mt: [7, 12, 21] }] } }, 'social');
  let secs = 0;
  while (log.raiders.length < MAX_RAID_ENEMIES && secs < 200) { frame(0.05); await tick(); secs += 0.05; }
  assert.ok(secs >= STAFF_PACK_FILL_MIN_S && secs <= STAFF_PACK_FILL_MAX_S + 2, `the 25 stood in 20-45 s (${secs.toFixed(1)} s, a frame a stand on top)`);
  assert.deepEqual([STAFF_PACK_FILL_MIN_S, STAFF_PACK_FILL_MAX_S], [20, 45]);
  for (const roll of [() => 0, () => 0.999]) {   // the pace's ends, a last pack either size: the gaps before it inside 20-45 s
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
  assert.ok(packs.some((p) => new Set(p.map((f) => f.mobileType)).size > 1), 'a pack of any of the kinds picked (mob: "not one kind")');
  assert.ok(packs.slice(0, -1).every((p) => p.length >= STAFF_PACK_MIN && p.length <= STAFF_PACK_MAX), packs.map((p) => p.length).join(','));
  // the host's placement: a town raid's the mod's just out of view
  assert.deepEqual(raidSpawnRange(undefined), { minDistance: RAID_SPAWN_MIN_DISTANCE, maxDistance: RAID_SPAWN_MAX_DISTANCE, lineOfSightCheck: true });
  assert.deepEqual(raidSpawnRange({ min: 1.5, max: 6, los: false }), { minDistance: 1.5, maxDistance: 6, lineOfSightCheck: false });
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
  assert.match(rd('src/scenes/world.js'), /onRaidReceipt: \(r, c\) => \{ \(c\?\.v \? grantStaffSpoils\(raidSpoils, spoilsLock, c, /, 'THE REWARD: an event\'s receipt rolls its spoils into the pack');
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
