// AUDIT WORLD-EVENTS L6-9 (bible/01-Overview/audits/Audit-World-Events.md): THE RAID'S PEOPLE ON THE WIRE, between two real
// pools (scenes/exteriorFoes.js - fb1012d_allyrace's rig). A raid's refugees and its leader were pinned at one end alone: the
// frame's `rf` was read by a regex and its emitter and the reader's two doors (the stand's `allied`, the stats judge's `ally`)
// by nothing, so a reader standing a raid's refugees as foes survived the suite; and a puppet raid leader - its owner's
// leader stood on my screen, its size and its name - had no test at all.

import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const { createExteriorFoes } = await import('../../src/scenes/exteriorFoes.js');
const { RAID_REFUGEE_KIND } = await import('../../src/scenes/raidSitesHost.js');
const { promoteEliteFoe, promoteRaidLeader } = await import('../../src/systems/eliteFoes.js');
const { raidLeaderNameOf } = await import('../../src/systems/raidKinds.js');

const settle = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
/** a pool as the hosts build one (fb1012d_allyrace's rig) */
const poolRig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async () => new Uint8Array(74),
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5,
});
const judged = [];
const netAs = (id, judge = false) => ({
  selfId: () => id, room: () => 'world:3,12', onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]],
  // the reader's grants: its stats judge records what it was told; every other door of the grant host answers nothing
  ...(judge ? { grants: new Proxy({ statsRefused: (_from, r, o) => { judged.push([r.i, o.ally]); return false; } }, { get: (g, k) => g[k] ?? (() => null) }) } : {}),
});
const KNIGHT = 145;   // a Knight-Captain's party (a class foe: the rig has the careers, not the monsters' BSA)

test('AUDIT WORLD-EVENTS L6-9 THE RAID\'S PEOPLE ON THE WIRE: my refugees are named in my frame (`rf`) and a reader stands them as its allies, its stats judge told so; my raid\'s leader stands on a reader\'s screen as the leader - elite, named, its two traits (mutants: the refugees unnamed; the reader\'s stand hostile; the judge told a foe; the puppet leader a plain elite)', async () => {
  const A = createExteriorFoes(poolRig()), B = createExteriorFoes(poolRig());
  A.setNet(netAs('mac-0001')); B.setNet(netAs('bob-0002', true));
  const ref = await A.spawnFoe(RAID_REFUGEE_KIND, [4, 0, 4], { allied: true, loose: true, transient: true, feetGiven: true });   // scenes/raidSitesHost.js standRefugee's stand
  ref.refugee = true;
  const raider = await A.spawnFoe(KNIGHT, [8, 0, 8], { feetGiven: true, loose: true });
  const lead = await A.spawnFoe(KNIGHT, [12, 0, 12], { feetGiven: true, loose: true });
  promoteRaidLeader(lead.entity, { name: raidLeaderNameOf(lead.mobileType) });   // systems/raidingParties.js's own promotion
  await settle();
  const fa = A.foesFrame(true);
  assert.deepEqual(fa.rf, [ref.seq], 'the refugee named, the raider not');
  assert.equal(fa.f.find((r) => r.i === lead.seq)?.rl, 1, 'the leader marked');
  B.applyFoes('mac-0001', fa); await settle();
  const at = (seq) => B.foes.find((f) => f.puppet === 'mac-0001' && f.seq === seq);
  assert.equal(at(ref.seq)?.entity?.team, 'PlayerAlly', 'my refugee stands as the reader\'s ally');
  assert.notEqual(at(raider.seq)?.entity?.team, 'PlayerAlly', 'a raider does not');
  assert.ok(judged.some(([i, ally]) => i === ref.seq && ally === true), 'the stats judge told it is an ally');
  assert.ok(judged.some(([i, ally]) => i === raider.seq && ally === false), 'and a raider not');
  const L = at(lead.seq);
  assert.ok(L?.entity?.eliteFoe, 'the leader an elite on the reader\'s screen');
  assert.equal(L.entity.raidLeader?.name, raidLeaderNameOf(KNIGHT), 'and the raid\'s leader, by its party\'s word');
  // a plain elite of mine stays a plain elite there
  const elite = await A.spawnFoe(KNIGHT, [16, 0, 16], { feetGiven: true, loose: true });
  promoteEliteFoe(elite.entity, { checkLevel: false });
  await settle();
  B.applyFoes('mac-0001', A.foesFrame(true)); await settle();
  assert.ok(at(elite.seq)?.entity?.eliteFoe && !at(elite.seq).entity.raidLeader, 'an elite, never a leader');
});
