// AUDIT 28 (2026-09-28, Mac: "let's audit everything we have so far before we continue") - BOUNTY1's and DEATH-PENALTY's
// findings, each pinned on the host driven headless (scenes/bountyHost.js), the law (systems/bountyBoard.js), the wire
// (net/wire.js), the farm pool (scenes/bountyFarms.js), the board's window on the minimal DOM, and the death penalty's
// one statement - each failing on the code before the fix. bible/06-Systems/Bounty-Boards.md (AUDIT 28).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { byClass } from './chargenDom.mjs';
import {
  bountySites, boardPostings, bountyHuntKey, bountyPackOwner, bountyPoseField, bountyPartyKills, bountyClearPays, bountyIdAtLevel,
  newBountyLedger, takeBounty, dropBounty, payBounty, readBountyLedger, parseBountyId,
} from '../src/systems/bountyBoard.js';
import { createBountyHost, BOUNTY_REFUSALS } from '../src/scenes/bountyHost.js';
import { createBountyFarms } from '../src/scenes/bountyFarms.js';
import { mountBountyBoard } from '../src/ui/bountyWindow.js';
import { validPartyPose, RELAY_VERSION } from '../src/net/wire.js';
import { applyDeathPenalty, stateDeathLoss, statedDeathLoss } from '../src/systems/deathPenalty.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const allLand = () => true;
const TOWN = { px: 300, py: 200, name: 'Daggerfall' };
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

/** A host on day 900 at level 5, with a mate (`mates` rows mutable) and a pool the packs stand into. */
function hostOf({ level = 5, now = () => 900 * 1440 + 60, here = () => null, social = null, standPack = null } = {}) {
  const entity = { goldPieces: 0, items: [] };
  const pool = [];
  const said = [];
  let board = null;
  const stood = [];
  const host = createBountyHost({
    now, level: () => level, entity: () => entity, townName: () => 'Daggerfall', siteOk: allLand,
    playerPixel: here, canStand: () => true,
    standPack: standPack ?? (({ count }) => {
      const foes = Array.from({ length: count }, () => ({ dead: false, corpse: false, entity: { health: 10 } }));
      pool.push(...foes);
      stood.push(count);
      return { foes: Promise.resolve(foes), dx: 0, dz: 80 };
    }),
    foePool: () => pool, say: (l) => said.push(l), showNotice: () => true,
    openBoardWindow: (d) => { board = d; }, social, rolls: () => 0.3,
  });
  host.openBoard(TOWN);
  return { host, entity, pool, said, stood, board: () => board };
}
/** A posting on day 900 of one group (under six), and the day it is on. */
function smallPosting(level = 5) {
  const sites = bountySites(TOWN.px, TOWN.py, allLand);
  for (let day = 900; day < 1000; day++) {
    const p = boardPostings({ day, ...TOWN, level, sites }).find((q) => q.count < 6 && q.kind !== 'dungeon');
    if (p) return { p, day };
  }
  throw new Error('no small posting');
}

test('AUDIT 28 B1: a hunt a mate already cleared cannot be taken - and a clear pays only a bounty held before it', () => {
  const { p, day } = smallPosting();
  let rows = [];
  const mates = [{ acct: 'x', name: 'Aldric', p: { px: 0, py: 0, in: 0, get bq() { return rows; } } }];
  const { host, entity, board } = hostOf({ now: () => day * 1440 + 60, social: () => ({ acct: 'me', inParty: true, mates }) });
  rows = [{ i: p.id, c: 1, t: day * 1440 + 30 }];
  const t = board().take(p.id);
  assert.deepEqual(t, { ok: false, text: BOUNTY_REFUSALS.party }, 'the hunt is done for the party');
  host.tick(1);
  assert.equal(entity.goldPieces, 0, 'and nothing is paid');
  // held before the clear: paid
  rows = [];
  assert.equal(board().take(p.id).ok, true);
  rows = [{ i: p.id, c: 1, t: day * 1440 + 30 }];
  host.tick(1);
  assert.equal(host.held().length, 1, 'a clear from before I took it pays nothing');
  rows = [{ i: p.id, c: 1, t: day * 1440 + 90 }];
  host.tick(1);
  assert.equal(host.held().length, 0);
  assert.equal(entity.goldPieces, p.gold);
  assert.deepEqual([bountyClearPays({ c: 1, t: 10 }, 10), bountyClearPays({ c: 1, t: 9 }, 10), bountyClearPays({ c: 1 }, 10)], [true, false, false]);
});

test('AUDIT 28 B2: a bounty given up and taken again goes on from its kills, and its live beasts are the hunt\'s again - never a fresh pack', async () => {
  const { p, day } = smallPosting();
  const { host, pool, stood, board } = hostOf({ now: () => day * 1440 + 60, here: () => ({ x: p.target.px, y: p.target.py }) });
  board().take(p.id);
  host.tick(1); await flush();
  assert.deepEqual(stood, [p.count]);
  pool[0].dead = true; pool[0].corpse = true; pool[0].entity.health = 0;
  host.tick(1);
  assert.equal(host.held()[0].killed, 1);
  board().drop(p.id);
  assert.equal(board().take(p.id).ok, true);
  assert.equal(host.held()[0].killed, 1, 'the kill kept');
  host.tick(1); await flush();
  assert.deepEqual(stood, [p.count], 'the beasts still standing are the hunt\'s - none stood again');
  const l = newBountyLedger();
  takeBounty(l, p.id, 0); l.held[0].killed = 3; dropBounty(l, p.id);
  assert.equal(readBountyLedger(JSON.parse(JSON.stringify(l))).droppedKilled[parseBountyId(p.id).slotKey], 3, 'and the save keeps them');
});

test('AUDIT 28 B3: one pack a party - whoever\'s pack already stands owns the hunt, wherever they are; the gone and the dead own nothing', () => {
  const id = '900.300.200.1.5';
  const hunt = bountyHuntKey(id);
  const at = { px: 301, py: 201 };
  const on = (acct, extra = {}, rowExtra = {}) => ({ acct, p: { px: 301, py: 201, in: 0, h: 10, bq: [{ i: id, ...rowExtra }], ...extra } });
  assert.equal(bountyPackOwner('b-9', [on('b-5', { px: 50, py: 50 }, { a: 1 }), on('a-1')], hunt, at), 'b-5', 'standing, it owns it off the pixel too');
  assert.equal(bountyPackOwner('b-9', [on('a-1')], hunt, at), 'a-1', 'nobody standing: the lowest on the pixel');
  assert.equal(bountyPackOwner('b-9', [{ ...on('a-1'), online: false }], hunt, at), 'b-9', 'gone offline: owns nothing');
  assert.equal(bountyPackOwner('b-9', [on('a-1', { h: 0 })], hunt, at), 'b-9', 'dead: owns nothing');
  const l = newBountyLedger();
  takeBounty(l, id, 0);
  assert.deepEqual(bountyPoseField(l, new Map(), { standing: () => true }).bq, [{ i: id, a: 1 }], 'my row says my pack stands');
});

test('AUDIT 28 B4: the hunt\'s kills are the party\'s - a holder takes the most any mate reports, so a hunt part done is handed on part done', () => {
  const { p, day } = smallPosting();
  let k = 0;
  const mates = [{ acct: 'x', name: 'Aldric', p: { px: 0, py: 0, in: 0, get bq() { return [{ i: p.id, k }]; } } }];
  const { host, board } = hostOf({ now: () => day * 1440 + 60, social: () => ({ acct: 'me', inParty: true, mates }) });
  board().take(p.id);
  k = 2;
  host.tick(1);
  assert.equal(host.held()[0].killed, 2);
  assert.deepEqual(host.poseField().bq[0], { i: p.id, k: 2 }, 'and says it on');
  assert.equal(bountyPartyKills([{ p: { bq: [{ i: p.id, k: 9 }, { i: p.id, c: 1, k: 50 }] } }], bountyHuntKey(p.id)), 9, 'a cleared row\'s count is no hunt\'s');
});

test('AUDIT 28 B5: the respawn takes what the death screen said, capped at the purse; a Resurrect takes nothing and says so; hosts that never respawn online show no loss', () => {
  const me = { goldPieces: 100 };
  stateDeathLoss(25);
  me.goldPieces = 300;   // a mate's bounty clear paid me while I lay dead
  assert.equal(applyDeathPenalty(me), 25, 'the screen\'s 25, not a tenth of 300');
  assert.equal(me.goldPieces, 275);
  assert.equal(statedDeathLoss(), null, 'spent');
  stateDeathLoss(80);
  const poor = { goldPieces: 30 };
  assert.equal(applyDeathPenalty(poor), 30, 'never more than the purse');
  assert.equal(applyDeathPenalty({ goldPieces: 40 }), 4, 'no word: a tenth of the purse');
  const w = src('src/scenes/world.js');
  const rez = w.slice(w.indexOf('function resurrectInPlace(rez) {'), w.indexOf('\n  }', w.indexOf('function resurrectInPlace(rez) {')));
  assert.match(rez, /stateDeathLoss\(null\);/, 'a rescue withdraws the loss');
  assert.match(rez, /if \(spared > 0\) townTalk\.say\(RESURRECT_TEXT\.spared\(spared\)\);/);
  assert.match(src('src/ui/deathScreen.js'), /this\.online = online \?\? isOnlinePage\(\);/);
  assert.match(src('src/ui/deathScreen.js'), /if \(this\.online\) stateDeathLoss\(this\.goldLoss\);/);
  assert.match(src('src/scenes/exterior.js'), /hint: 'ENTER end', online: false \}/, 'the fixed city');
  assert.match(src('src/scenes/dungeonContext.js'), /\.\.\.\(opts\.onlineRespawn \? \{\} : \{ online: false \}\)/, 'the standalone dungeon');
});

test('AUDIT 28 B6/B9: a load that still holds a bounty keeps its standing pack, and the ways named are named again', async () => {
  const { p, day } = smallPosting();
  const { host, stood, board } = hostOf({ now: () => day * 1440 + 60, here: () => ({ x: p.target.px, y: p.target.py }) });
  board().take(p.id);
  host.tick(1); await flush();
  assert.equal(host.poseField().bq[0].a, 1, 'my pose says my pack stands (AUDIT 28 B3)');
  const rec = JSON.parse(JSON.stringify({ ...host._ledger(), paidIds: [] }));
  host._reset(rec);   // a same-dungeon quickload: the beasts were in the save and stand patched in place
  host.tick(1); await flush();
  assert.deepEqual(stood, [p.count], 'no second pack beside them');
  assert.ok(src('src/scenes/bountyHost.js').includes('clues.clear(); toldOwner.clear(); tierRefused.clear();'));
});

test('AUDIT 28 B7: the pose sends the NEWEST cleared rows first - today\'s never cut for yesterday\'s', () => {
  const l = newBountyLedger();
  const paid = new Map();
  for (let k = 0; k < 8; k++) {
    const id = `${899 + (k >= 4 ? 1 : 0)}.300.200.${k % 4}.5`;
    takeBounty(l, id, k * 10); payBounty(l, id, k * 10);
    paid.set(parseBountyId(id).slotKey, id);
  }
  takeBounty(l, '900.301.200.0.5', 100);
  const bq = bountyPoseField(l, paid).bq;
  assert.equal(bq.length, 8);
  assert.deepEqual(bq.slice(1, 3).map((r) => r.t), [70, 60], 'the latest first');
});

test('AUDIT 28 B8/B10: the owner is asked on the pixel the poses say, and a bounty taken on another clock runs from now', async () => {
  assert.match(src('src/scenes/world.js'), /posePixel: \(\) => playerTravelPixel\(\),/);
  // underground the dungeon's map-table pixel (the host's target) and the pose's pixel differ: a mate below me in the
  // same dungeon (their pose on MY pose's pixel) with a lower account stands the pack, not I
  const { p, day } = smallPosting();
  const stood = [];
  const mates = [{ acct: 'a-0', name: 'Aldric', p: { px: 7, py: 7, in: 0, h: 10, bq: [{ i: p.id }] } }];
  const host = createBountyHost({
    now: () => day * 1440 + 60, level: () => 5, entity: () => ({ goldPieces: 0, items: [] }), townName: () => 'X', siteOk: allLand,
    playerPixel: () => ({ x: p.target.px, y: p.target.py }), posePixel: () => ({ x: 7, y: 7 }), canStand: () => true,
    standPack: ({ count }) => { stood.push(count); return { foes: Promise.resolve([]), dx: 0, dz: 0 }; },
    say: () => {}, showNotice: () => true, openBoardWindow: () => {},
    social: () => ({ acct: 'b-9', inParty: true, mates }),
  });
  assert.equal(host.take(p.id).ok, true);
  host.tick(1); await flush();
  assert.deepEqual(stood, [], 'the mate on my pose\'s pixel owns it');
  const late = smallPosting();
  let now = late.day * 1440 + 60;
  const clocked = hostOf({ now: () => now });
  now = late.day * 1440 + 10_000;   // an offline save's clock, ahead
  clocked.board().take(late.p.id);
  now = late.day * 1440 + 60;       // played online, on the shared clock
  clocked.host.tick(1);
  assert.equal(clocked.host.held()[0].left, 24 * 60, 'a full day from now, never days');
});

test('AUDIT 28 B11: the board keeps the keyboard\'s place through its repaint, and an armed Abandon never outlives its visit', () => {
  const { p } = smallPosting();
  const host = document.createElement('div');
  const rows = [{ posting: p, state: 'open', mates: [], held: null }, { posting: { ...p, id: `${p.id}x`, title: 'Other' }, state: 'open', mates: [], held: null }];
  const view = mountBountyBoard(host, { town: { name: 'Daggerfall' }, rows: () => rows, held: () => [], nextDayIn: () => 60, inParty: () => false, take: () => ({ ok: true }), drop: () => ({ ok: true }), share: () => ({ ok: true }) });
  const before = byClass(host, 'bounty-post-i1')[0];
  before.focus();
  view.repaint();
  const after = byClass(host, 'bounty-post-i1')[0];
  assert.notEqual(after, before, 'the row was rebuilt');
  assert.equal(document.activeElement, after, 'and the rebuilt row has the focus');
  view.unmount();
  assert.match(src('src/ui/enhancedMenu.js'), /bountyAbandonArmed = null;   \/\/ AUDIT 28 B11/);
  assert.match(src('src/ui/enhancedChronicle.js'), /bountyArmed = null;   \/\/ AUDIT 28 B11/);
});

test('AUDIT 28 B12: a mate\'s copy taken up is mine - rebuilt at my level where its tier is mine', () => {
  assert.equal(bountyIdAtLevel('900.300.200.2.4', 5), '900.300.200.2.5');
  assert.equal(bountyHuntKey('900.300.200.2.4'), bountyHuntKey('900.300.200.2.5'), 'the same hunt');
  const { host } = hostOf({ level: 5 });
  assert.equal(host.take('900.300.200.2.4').ok, true);
  assert.equal(host.held()[0].id, '900.300.200.2.5');
});

test('AUDIT 28 B13: a second farm never stands on one that stands', async () => {
  const collider = { heightAt: () => 0, addMesh() {}, removeBucket() {} };
  const farms = createBountyFarms({
    collider: () => collider, pixelTranslation: () => [0, 0, 0], pixelBuilt: () => ({}),
    farmBlockNear: () => ({ models: [{ modelIdNum: 1, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }], side: 100000 }),
    getGpuMesh: async () => ({}), cpuModel: () => ({ positions: [0, 0, 0, 1, 0, 1], indices: [0] }), prepare: async () => {},
    spotOk: () => true, feet: () => [0, 0, 0], mode: () => 'exterior',
  });
  farms.sync([{ id: 'a.1', px: 5, py: 5 }]);
  await flush(); await flush();
  assert.deepEqual(farms.standing(), ['a.1']);
  farms.sync([{ id: 'a.1', px: 5, py: 5 }, { id: 'b.2', px: 5, py: 5 }]);
  await flush(); await flush();
  assert.equal(farms.failed('b.2'), true, 'every spot is on the first farm: the second stands none (its pack stands as any other)');
  assert.equal(farms.occupied(0, 0), true);
});

test('AUDIT 28 the wire: a bounty row carries `k`, `a` and a cleared row\'s `t` - world123 on the branch, world125 since the merge of main', () => {
  const base = { px: 1, py: 1, in: 0, loc: '', h: 1, hm: 1, f: 1, fm: 1, m: 1, mm: 1 };
  const out = validPartyPose({ ...base, bq: [{ i: '900.300.200.1.5', k: 3, a: 1, t: 50 }, { i: '900.300.200.2.5', c: 1, t: 1296060 }, { i: '900.300.200.3.5', k: -1, a: 2 }] });
  assert.deepEqual(out.bq, [{ i: '900.300.200.1.5', k: 3, a: 1 }, { i: '900.300.200.2.5', c: 1, t: 1296060 }, { i: '900.300.200.3.5' }], 'a held row\'s `t` and every value out of its law dropped');
  assert.equal(RELAY_VERSION, 'world169');   // world123 on the branch; main's OVERWORLD NAMES, THE MERGE and TV8 took world122-world124 first, then world125 at THE MERGE; MERGE 2 took it past main's REALM-DOOR (world130); STRIKE-SHARED moved it on after (world132), SOFTCAP1 (world133), then PARTY-MAP (world134), then WB9 (world135), then GATE-UX (world136), then KEPT-KILL (world137), then HERALD (world138), then LOOT7 (world139), then WB11 (world140), then CLIMB5 and CLIMB6 (world141), then FRIENDS-SYNC (world142), then ELITE FOES (world143), then SEAT1b (world144), then SEAT1c (world145), then PVP-REF (world146), then SEAT2a (world147), then CROWN1 part two (world148), then SEASON1 part two, the banner ribbon (world149), then SEAT2b part two (b) (world150), then WB12 (world151), then GLYPH-WEAR (world152), then REVENANT-WIRE (world153), then BROKER-CAGE (world154), then ARENA4 (world155 - world142 on its branch, renumbered past main's FRIENDS-SYNC to BROKER-CAGE at the merge), then AEGIS (world160), then GUILD2 (world161), then PRIMARCH (world162), then SUNBABY1 (world163), then PARTY-LEAD (world164), then SERPENT1 (world165 - world162 on its branch), then SERPENT2 (world166), then SHADOW-CLOAK (world167 - world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges), then SERAPH-WINGS (world168), then AUDIT ARENA-LADDER (world169 - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges)
});
