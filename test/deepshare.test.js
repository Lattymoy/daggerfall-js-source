// DEEP-SHARE (2026-09-26, Mac: "Yes" - one player standing the sea's creatures for everyone near). Online, every
// client stood its own Iliac Puddle No More deep, and a reader stood at most CELL_PUPPETS_MAX (twelve) of another
// player's foes, the deep's among them - so two players at sea together saw two different seas. Now the players within the mod's populate
// radius of each other stand ONE deep (the lowest id, the camps' election), the deep's foes ride named in the frame's
// `dz` and stand under an allowance of their own, and a spawner's cap counts the deep foes others stand near it. Driven
// over the rule, the frame and two real encounter pools - an owner and a reader.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standsTheDeep, deepWatersEnemySettingsNear, DEEP_SHARE_RADIUS, DEEP_WATERS_VENDOR, DEEP_SHARE_HYSTERESIS } from '../src/scenes/deepWatersHost.js';
import { POPULATE_RADIUS, createEnemySpawner } from '../src/scenes/deepWatersEncounters.js';
import { CELL_PUPPETS_MAX, CELL_LOOSE_PUPPETS, CELL_WATCH_PUPPETS_MAX, CELL_FRAME_RECORDS_MAX } from '../src/net/wire.js';
import { ONLINE_ROOM_MOD_KEYS } from '../src/systems/onlineLane.js';
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { createExteriorFoes, MAX_ACTIVE_ENCOUNTER_FOES, DEEP_PUPPETS_MAX } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const K = 'General.MaxLiveEnemies';

test('DEEP-SHARE: the players within the populate radius stand one deep - the lowest id; offline, alone or out of reach, a player stands its own', () => {
  assert.equal(DEEP_SHARE_RADIUS, POPULATE_RADIUS, 'a player that near the one standing is inside a pixel it populates');
  const me = [0, 0, 0];
  assert.equal(standsTheDeep(null, me, [{ id: 'aaa-0001', feet: [5, 0, 0] }]), true, 'offline');
  assert.equal(standsTheDeep('mmm-0002', me, []), true, 'alone');
  assert.equal(standsTheDeep('mmm-0002', me, [{ id: 'aaa-0001', feet: [150, 0, 0] }]), false, 'a lower id within reach stands it');
  assert.equal(standsTheDeep('aaa-0001', me, [{ id: 'mmm-0002', feet: [150, 0, 0] }]), true, 'and it is the lower id');
  assert.equal(standsTheDeep('mmm-0002', me, [{ id: 'aaa-0001', feet: [DEEP_SHARE_RADIUS + 50, 0, 0] }]), true, 'out of reach, each its own');
});

test('DEEP-SHARE: the spawner\'s cap is the setting less the deep foes others stand near - never below none', () => {
  _resetModSettings();
  try {
    assert.equal(deepWatersEnemySettingsNear(0).maxLive, 32);
    assert.equal(deepWatersEnemySettingsNear(20).maxLive, 12, 'a handover\'s leftovers count: the sea round a player holds one cap');
    assert.equal(deepWatersEnemySettingsNear(40).maxLive, 0);
    setModSetting(DEEP_WATERS_VENDOR, K, 100);
    assert.equal(deepWatersEnemySettingsNear(30).maxLive, 70, 'offline, the raised setting less what stands near');
  } finally { _resetModSettings(); }
});

test('DEEP-SHARE: the tag rides the frame, not the record - the record\'s law and the relay untouched; the deep\'s allowance is the room\'s forced cap, and a whole owner still fits one frame', () => {
  assert.equal(DEEP_PUPPETS_MAX, ONLINE_ROOM_MOD_KEYS[DEEP_WATERS_VENDOR][K], 'no owner stands more than the room forces');
  assert.ok(MOD_SETTINGS[DEEP_WATERS_VENDOR].keys[K].default <= DEEP_PUPPETS_MAX);
  assert.ok(MAX_ACTIVE_ENCOUNTER_FOES + CELL_LOOSE_PUPPETS + CELL_WATCH_PUPPETS_MAX + DEEP_PUPPETS_MAX <= CELL_FRAME_RECORDS_MAX, 'every live foe an owner may stand rides one frame');
  assert.doesNotMatch(rd('server/src/index.js'), /\bdz\b/, 'the relay reads nothing inside a foes frame - no relay change, no version bump');
  assert.doesNotMatch(rd('src/net/wire.js'), /DEEP-SHARE|DEEP_PUPPETS/, 'nor does the record\'s law change');
});

// the WORLD6b-ii rig: a synthetic MONSTER.BSA on flat open ground, with a net
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const pool = (self) => {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'world:3,12', selfId: () => self, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  return p;
};

test('DEEP-SHARE executed: an owner\'s twenty deep foes ride named and a reader stands all twenty (it stood twelve); forty stand the allowance; a junk name, or a loose foe that is not the deep\'s, is held to the old allowance', async () => {
  const owner = pool('aaa-0001'), reader = pool('mmm-0002');
  for (let i = 0; i < 20; i++) await owner.spawnFoe(0, [100 + i, 0, 100], { feetGiven: true, loose: true, transient: true, managed: true });
  const frame = owner.foesFrame(true);
  assert.equal(frame.f.length, 20);
  assert.deepEqual([...frame.dz].sort((a, b) => a - b), frame.f.map((r) => r.i).sort((a, b) => a - b), 'the frame names every one of the deep\'s foes');
  reader.applyFoes('aaa-0001', frame);
  for (let i = 0; i < 5; i++) await settle();
  const deep = reader.foes.filter((f) => f.puppet === 'aaa-0001' && !f.dead);
  assert.equal(deep.length, 20, 'all of the owner\'s sea stands here');
  assert.ok(deep.every((f) => f._pupDeep));
  assert.equal(reader.deepPuppetsNear([100, 0, 100], DEEP_SHARE_RADIUS), 20, 'and counts against a spawner here');
  assert.equal(reader.deepPuppetsNear([100 + DEEP_SHARE_RADIUS + 60, 0, 100], DEEP_SHARE_RADIUS), 0, 'but not against one out of reach');
  const big = pool('bbb-0004'), reader3 = pool('mmm-0002');
  for (let i = 0; i < 40; i++) await big.spawnFoe(0, [100 + i, 0, 100], { feetGiven: true, loose: true, transient: true, managed: true });
  const bigFrame = big.foesFrame(true);
  reader3.applyFoes('bbb-0004', bigFrame);
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(reader3.foes.filter((f) => f.puppet === 'bbb-0004' && !f.dead).length, DEEP_PUPPETS_MAX, 'the deep\'s allowance holds: an owner past the room\'s cap stands no more than it here');
  const reader4 = pool('mmm-0002');
  reader4.applyFoes('bbb-0004', { ...bigFrame, dz: ['1', -1, 1.5, null, { i: 2 }] });
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(reader4.foes.filter((f) => f.puppet === 'bbb-0004' && !f.dead).length, CELL_PUPPETS_MAX, 'a `dz` that names nothing is none: the old allowance');
  assert.equal(reader4.deepPuppetsNear([100, 0, 100], DEEP_SHARE_RADIUS), 0);
  const other = pool('ccc-0003'), reader2 = pool('mmm-0002');
  for (let i = 0; i < 20; i++) await other.spawnFoe(0, [100 + i, 0, 100], { feetGiven: true, loose: true, transient: true });
  const plain = other.foesFrame(true);
  assert.equal(plain.dz, undefined, 'a loose stand that is not the deep\'s is not named');
  reader2.applyFoes('ccc-0003', plain);
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(reader2.foes.filter((f) => f.puppet === 'ccc-0003' && !f.dead).length, CELL_PUPPETS_MAX, 'held to the owner\'s old allowance');
  assert.equal(reader2.deepPuppetsNear([100, 0, 100], DEEP_SHARE_RADIUS), 0);
});

test('DEEP-SHARE by source: only the one standing the deep populates a pixel, and its cap counts the deep foes others stand near it', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const now = standsTheDeep\(online\?\.id \?\? null, player\.feetAt\(\), peersNear\(\), _deepStanding\);/, 'the camps\' inputs: my id, my feet, the peers I can place (AUDIT pre-merge P2: and whether I stand it now)');
  assert.match(w, /settings: \(\) => deepWatersEnemySettingsNear\(exteriorFoes\.deepPuppetsNear\(player\.feetAt\(\), DEEP_SHARE_RADIUS\)\),/);
  assert.match(w, /get attempts\(\) \{ return _standsTheDeep\(\) \? ENEMY_ATTEMPTS_PER_PIXEL_PER_TICK : 0; \}/, 'the lane stays on - a player who stops being the one keeps what it stood until it dies or its pixel is left');
  assert.match(rd('src/scenes/exteriorFoes.js'), /const dz = out\.filter\(\(r\) => src\.get\(r\)\?\.managed\)\.map\(\(r\) => r\.i\);/, 'the sender names the deep\'s own foes (managed: its spawner owns its life)');
});

// ---- AUDIT (the pre-merge audit, 2026-09-27, Mac: "Audit before we merge"): the sea's findings.
test('AUDIT pre-merge P2: the election holds - one standing the deep keeps it until a lower id comes within the radius; one not standing it takes it only past DEEP_SHARE_HYSTERESIS radii (pose noise at the edge flipped it every tick)', () => {
  const me = [0, 0, 0];
  const at = (d) => [{ id: 'aaa-0001', feet: [d, 0, 0] }];
  assert.equal(DEEP_SHARE_HYSTERESIS, 1.25);
  const edge = DEEP_SHARE_RADIUS * 1.1;   // past the radius, inside the hysteresis
  assert.equal(standsTheDeep('mmm-0002', me, at(edge), true), true, 'standing: kept - no lower id within the radius');
  assert.equal(standsTheDeep('mmm-0002', me, at(edge), false), false, 'not standing: not taken - a lower id within 1.25 radii');
  assert.equal(standsTheDeep('mmm-0002', me, at(DEEP_SHARE_RADIUS * 1.3), false), true, 'past it, taken');
  assert.equal(standsTheDeep('mmm-0002', me, at(DEEP_SHARE_RADIUS * 0.9), true), false, 'a lower id within the radius takes it from one standing it');
  assert.equal(standsTheDeep('mmm-0002', me, at(edge)), true, 'the default is the stander\'s own law - the radius, as before');
});

test('AUDIT pre-merge P2 executed: a lost election gives back the reservations not yet stood - the pump stands nothing after it, and the counts are whole again', () => {
  const settings = { on: true, frequency: 0.5, maxLive: 128, waterDepth: 200 };
  const stood = [];
  const spawner = createEnemySpawner({ settings: () => settings, pixelOrigin: () => [0, 0, 0], spawnEnemy: (req) => { const o = { ...req, destroyed: () => false, position: () => req.pos, destroy() {}, hide() {} }; stood.push(o); return o; } });
  const sea = { time: 0, dt: 0.1, frame: 0, roll: () => 0.5, playerPos: [0, 0, 0], column: () => ({ oceanY: 34, seafloorY: -26, depth: 60, entry: {} }), renderedSeafloorY: (c) => c.seafloorY, visibleDistance: 70, raycast: () => null };
  spawner.tickPopulate(sea, {}, 'p', { n: 4 });
  assert.equal(spawner.pendingCount, 4);
  assert.equal(spawner.liveCount, 4);
  spawner.dropPending();
  assert.equal(spawner.pendingCount, 0, 'the reservations go');
  assert.equal(spawner.liveCount, 0, 'their count given back');
  assert.equal(spawner.groupOf('p').liveOrPending, 0, 'and the pixel\'s');
  spawner.pumpPendingSpawns();
  assert.equal(stood.length, 0, 'nothing stands after the election was lost');
});

test('AUDIT pre-merge P1 + P2 + P4 by source: the deep\'s foes are never handed (they stay their stander\'s); the host keeps the election\'s last answer and gives back its reservations when it loses; no camp stands over the deep\'s water', () => {
  const w = rd('src/scenes/world.js');
  const hand = w.slice(w.indexOf('const handOverFoes = () => {'), w.indexOf('const handOverRoomFoes = () => {'));
  assert.match(hand, /const heirOf = \(f\) => \{ if \(f\.entity\?\.team === 'PlayerAlly' \|\| f\.managed\) return null;/, 'the open air\'s handover refuses the deep\'s');
  assert.match(w, /let _deepStanding = true;\n\s*const _standsTheDeep = \(\) => \{\n\s*const now = standsTheDeep\(online\?\.id \?\? null, player\.feetAt\(\), peersNear\(\), _deepStanding\);\n\s*if \(_deepStanding && !now\) dwEnemies\?\.dropPending\?\.\(\);\n\s*_deepStanding = now;/);
  assert.match(w, /const _overDeepWater = \(x, z\) => \{ const c = dwPlayer\?\.rawColumnAt\?\.\(x, z\); return !!c && c\.depth >= 0\.25; \};/);
  assert.match(w, /if \(anchor && _overDeepWater\(anchor\.x, anchor\.z\)\) anchor = null;/, 'the anchor');
  assert.match(w, /if \(spot && _overDeepWater\(spot\.x, spot\.z\)\) spot = null;/, 'and each member');
});
