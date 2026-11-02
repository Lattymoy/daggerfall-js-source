// RPT1026-EVENTS CROWD-KIN (a private report: the Players shown at once count left other players' revenants standing): A
// PLAYER'S OWN FOES GO WITH THEM. A peer the crowd's count leaves undrawn
// (net/gate/gateCrowd.js, the world host's one crowd) takes their revenants, their revenants' bands and their companions
// with them on this screen - no sprite, no body, nothing for the ray - unless one is on ME; the world's foes their screen
// runs stand as ever. Driven over the real open-world foe pool (scenes/exteriorFoes.js) and the real crowd, the records the
// owner's own wire would carry; a dungeon's (scenes/dungeonContext.js) by its records' shape and the one draw question it
// asks (systems/combatVisuals.js foeDraw) and the ray's box (player/activate.js foeAabb). tools/mutants/rpt1026_events.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createGateCrowd, crowdCutsPeer, crowdKinHidden } from '../../src/net/gate/gateCrowd.js';
import { foeDraw } from '../../src/systems/combatVisuals.js';
import { foeAabb } from '../../src/player/activate.js';

function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
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
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const ME = 'mmm-0001', FAR = 'far-0009';
const crowdOf = (n) => Array.from({ length: n }, (_, k) => ({ id: `near-${String(k).padStart(2, '0')}`, feet: [2 + k * 0.1, 0, 0] }));

function rig() {
  const peers = [{ id: FAR, feet: [60, 0, 0] }, ...crowdOf(13)];
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map(), uploadTexture: () => ({}), uploadEmissionTexture: () => ({}) },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  pool.setNet({ room: () => 'world:3,12', selfId: () => ME, peers: () => peers, now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  const crowd = createGateCrowd();
  /** The world host's cut: the card's twelve, the far owner the thirteenth nearest-but-one (cut) or `everyone`. */
  const cut = (max = 12) => crowd.cut(peers, { on: true, me: [0, 0, 0], at: (p) => p.feet, max });
  return { pool, crowd, cut, peers };
}
/** The far owner's foes, as its foes frame says them: a revenant, a follower of its band, a companion, a plain encounter foe. */
const records = (extra = {}) => [
  { i: 1, t: 0, x: 0, f: [58, 0, 2], y: 0, h: 10, k: 10, d: 0, nm: 'Grushnak the Unbroken', ...(extra[1] ?? {}) },
  { i: 2, t: 0, x: 0, f: [58, 0, 4], y: 0, h: 10, k: 10, d: 0, rt: 1, ...(extra[2] ?? {}) },
  { i: 3, t: 0, x: 0, f: [61, 0, 1], y: 0, h: 10, k: 10, d: 0, ...(extra[3] ?? {}) },
  { i: 4, t: 0, x: 0, f: [62, 0, 6], y: 0, h: 10, k: 10, d: 0, ...(extra[4] ?? {}) },
];
let n = 0;
const send = async (pool, from, f, more = {}) => { pool.applyFoes(from, { n: ++n, f, cw: [3], cp: [3], cn: [[3, 'Hild']], ...more }); await settle(); };
const bySeq = (pool, i) => pool.foes.find((f) => f.puppet === FAR && f.seq === i);
const step = (pool) => pool.update(0.016, [0, 0, 0], [0, 1.6, 0]);

test('RPT1026-EVENTS CROWD-KIN THE CROWD\'S WORD: the host\'s crowd answers who its last cut left out by the count - nobody while it cuts nobody, the far one once a crowd is past the card\'s count, nobody again under everyone (mutants: the crowd never said)', () => {
  const { cut } = rig();
  cut(0);
  assert.equal(crowdCutsPeer(FAR), false, 'everyone: nobody cut');
  cut(12);
  assert.equal(crowdCutsPeer(FAR), true, 'twelve of fourteen: the farthest cut');
  assert.equal(crowdCutsPeer('near-00'), false);
  assert.equal(crowdCutsPeer(null), false);
  cut(24);
  assert.equal(crowdCutsPeer(FAR), false, 'twenty-four: drawn again');
});

test('RPT1026-EVENTS CROWD-KIN THE POOL: a cut owner\'s revenant, its band and its companion draw nothing here and offer the ray nothing, while its plain foe stands; drawn again the moment the owner is; a revenant of theirs on ME is always drawn (mutants: the cut owner\'s own drawn; the ray offered them; one on me hidden)', async () => {
  const { pool, cut } = rig();
  cut(0);
  await send(pool, FAR, records());
  step(pool); step(pool);
  const [rev, band, comp, plain] = [1, 2, 3, 4].map((i) => bySeq(pool, i));
  assert.ok(rev && band && comp && plain, 'all four stood');
  assert.ok(rev.entity.revenant, 'the revenant, by its owner\'s word');
  assert.ok(band.entity.bandName, 'its band\'s follower, named for it');
  assert.equal(comp.companion, `peer:${FAR}:3`, 'the owner\'s companion');
  const drawn = () => new Set(pool.batches());
  const offered = () => new Set(pool.liveTargets().map((t) => t.key));
  const keyOf = (f) => pool.liveTargets().find((t) => t.aabb && Math.abs((t.aabb.min[0] + t.aabb.max[0]) / 2 - f.ai.feet[0]) < 0.01 && Math.abs((t.aabb.min[2] + t.aabb.max[2]) / 2 - f.ai.feet[2]) < 0.01)?.key;
  const keys = new Map([rev, band, comp, plain].map((f) => [f, keyOf(f)]));
  for (const f of [rev, band, comp, plain]) { assert.ok(drawn().has(f.batch), 'everyone: all drawn'); assert.ok(keys.get(f) && offered().has(keys.get(f))); }
  cut(12);
  step(pool);
  const d = drawn(), o = offered();
  for (const f of [rev, band, comp]) {
    assert.equal(crowdKinHidden(f), true);
    assert.equal(d.has(f.batch), false, 'a cut owner\'s own: nothing drawn');
    assert.equal(o.has(keys.get(f)), false, 'and nothing for the ray');
  }
  assert.ok(d.has(plain.batch) && o.has(keys.get(plain)), 'the world\'s foe their screen runs: everyone\'s, drawn');
  // their revenant turns on ME: drawn, whatever the count
  await send(pool, FAR, records({ 1: { g: ME } }));
  step(pool);
  assert.equal(rev._pupMine, true, 'on me');
  assert.ok(drawn().has(rev.batch), 'one on me stands to be seen');
  cut(24);
  step(pool);
  for (const f of [band, comp]) assert.ok(drawn().has(f.batch), 'the owner drawn again: theirs with them');
});

test('RPT1026-EVENTS CROWD-KIN A DUNGEON\'S: a peer\'s companion stood in a dungeon (its owner `_ownFrom`, `companion` as the dungeon\'s companionPuppet writes it) goes with its cut owner, one on me stays, a room\'s foe stays; the dungeon\'s draw asks it beside the concealed (mutants: the dungeon\'s owner unread; the draw unasked; the box kept)', () => {
  const { cut } = rig();
  cut(12);
  const comp = { _ownFrom: FAR, _ownI: 3, companion: `peer:${FAR}:3`, shipmate: true, entity: { team: 'PlayerAlly' } };
  assert.equal(crowdKinHidden(comp), true, 'a cut owner\'s companion: not drawn');
  assert.equal(crowdKinHidden({ ...comp, _pupMine: true }), false, 'on me: drawn');
  assert.equal(crowdKinHidden({ _ownFrom: FAR, _ownI: 4, companion: null, entity: {} }), false, 'a foe of theirs the room shares: drawn');
  assert.equal(crowdKinHidden({ ...comp, _ownFrom: 'near-00' }), false, 'a drawn owner\'s: drawn');
  assert.equal(crowdKinHidden({ companion: 'mine', entity: {} }), false, 'my own companion: no owner, drawn');
  cut(0);
  assert.equal(crowdKinHidden(comp), false, 'everyone: drawn');
  cut(12);
  assert.deepEqual(foeDraw({ ...comp, ai: { feet: [0, 0, 0] } }, true, 0), { kind: 'hidden' }, 'the one draw question every pool asks: not drawn');
  assert.equal(foeAabb({ ...comp, ai: { feet: [0, 0, 0] } }), null, 'and no box for either sweep of the ray');
  assert.ok(foeAabb({ ...comp, _pupMine: true, ai: { feet: [0, 0, 0] } }), 'on me: a box');
  const DC = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(DC, /const ecv = foeDraw\(f, ecvOn, _ecvT\);\n\s*if \(ecv\.kind === 'hidden'\) continue;/, 'the dungeon\'s draw asks foeDraw and skips what it hides');
  assert.match(DC, /f\.companion = `peer:\$\{f\._ownFrom\}:\$\{f\._ownI\}`;/, 'the companion\'s mark as the law reads it');
});
