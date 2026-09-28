// FOE-SPACING (2026-09-26, SquidKamer on the Discord: "no collision on monsters"; Mac, asked: "Yes, add it"). DFU's foes
// are CharacterControllers, so one stops at another and a pack spreads round what it hunts; the port's foes are not in
// the collider, so a pack stood in one heap. Each pool now pushes apart every two of its bodies whose capsules overlap -
// softly, through the collider, never off an edge; not the dead, not a body another client poses. Driven over the real
// collider and a real encounter pool.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spaceFoes, spacingSkips, FOE_SPACING_SPEED, FOE_SPACING_GAP } from '../src/characters/foeSpacing.js';
import { Collider } from '../src/player/collider.js';
import { CAPSULE_RADIUS } from '../src/player/motor.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A quad from four corners, both windings. */
function quad(c, a, b, d, e) {
  c.addMesh('scene', new Float32Array([...a, ...b, ...d, ...e]), new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]), I);
}
const body = (x, z, over = {}) => ({ ai: { feet: [x, 0, z], height: 1.8, ...over }, dead: false });
const gap = (a, b) => Math.hypot(a.ai.feet[0] - b.ai.feet[0], a.ai.feet[2] - b.ai.feet[2]);
const frames = (foes, c, n, dt = 1 / 60) => { for (let i = 0; i < n; i++) spaceFoes(foes, c, dt); };

test('FOE-SPACING: two bodies in one spot part to a capsule\'s width, softly - at most the push speed a frame - and a body clear of them stands', () => {
  assert.equal(FOE_SPACING_GAP, 2 * CAPSULE_RADIUS);
  const ground = new Collider(() => 0);
  const a = body(0, 0), b = body(0, 0), far = body(6, 0);
  const was = [...far.ai.feet];
  const dt = 1 / 60;
  assert.equal(spaceFoes([a, b, far], ground, dt), 2, 'the two in one spot move, the one clear of them does not');
  assert.ok(Math.abs(gap(a, b) - 2 * FOE_SPACING_SPEED * dt) < 1e-9, 'a frame\'s push: each at the push speed, no more');
  frames([a, b, far], ground, 30);
  assert.ok(gap(a, b) >= FOE_SPACING_GAP - 1e-6, `apart (${gap(a, b).toFixed(3)})`);
  assert.ok(gap(a, b) < FOE_SPACING_GAP + 1e-6, 'and no further than touching - a push, not a scatter');
  assert.deepEqual(far.ai.feet, was);
  assert.equal(spaceFoes([a, b, far], ground, dt), 0, 'touching is not overlapping: nothing moves');
});

test('FOE-SPACING: a heap of eight spreads until no two overlap; a held frame (0) moves nothing', () => {
  const ground = new Collider(() => 0);
  const heap = Array.from({ length: 8 }, () => body(3, 3));
  assert.equal(spaceFoes(heap, ground, 0), 0, 'under a held frame nothing is pushed');
  assert.ok(heap.every((f) => f.ai.feet[0] === 3 && f.ai.feet[2] === 3));
  frames(heap, ground, 240);
  let worst = Infinity;
  for (let i = 0; i < heap.length; i++) for (let j = i + 1; j < heap.length; j++) worst = Math.min(worst, gap(heap[i], heap[j]));
  assert.ok(worst >= FOE_SPACING_GAP * 0.95, `the closest pair ${worst.toFixed(3)}`);
});

test('FOE-SPACING: the dead, a puppet and a body the caller skips neither push nor are pushed; one standing above another is no contact', () => {
  const ground = new Collider(() => 0);
  const live = body(0, 0), corpse = { ...body(0, 0), dead: true }, puppet = { ...body(0, 0), puppet: 'bob-0002' };
  assert.equal(spaceFoes([live, corpse, puppet], ground, 1 / 60), 0);
  assert.deepEqual([live.ai.feet, corpse.ai.feet, puppet.ai.feet], [[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  assert.equal(spacingSkips(corpse), true); assert.equal(spacingSkips(puppet), true); assert.equal(spacingSkips(live), false);
  const mine = body(0, 0), theirs = body(0, 0);
  assert.equal(spaceFoes([mine, theirs], ground, 1 / 60, (f, i) => i === 1), 0, 'the dungeon\'s own skip: a room foe this page does not own');
  const low = body(0, 0), high = { ai: { feet: [0.1, 2.0, 0], height: 1.8, flies: true }, dead: false };
  assert.equal(spaceFoes([low, high], ground, 1 / 60), 0, 'a flyer over a walker\'s head does not touch it');
});

test('FOE-SPACING: through the collider - a body is not pushed through a wall, nor a walker off an edge; a flyer is pushed where it hovers', () => {
  const room = new Collider();
  quad(room, [-5, 0, -5], [-5, 0, 5], [5, 0, 5], [5, 0, -5]);   // a floor that ends at x = 5
  quad(room, [0.4, 0, -5], [0.4, 3, -5], [0.4, 3, 5], [0.4, 0, 5]);   // a wall at x = 0.4
  const w1 = body(0, 0), w2 = body(-0.1, 0);
  frames([w1, w2], room, 60);
  assert.ok(w1.ai.feet[0] <= 0.4 - CAPSULE_RADIUS + 1e-3, `the one pushed at the wall stays this side of it (${w1.ai.feet[0].toFixed(3)})`);
  assert.ok(gap(w1, w2) >= FOE_SPACING_GAP - 1e-3, 'the other gives way');
  const ledge = new Collider();
  quad(ledge, [-5, 0, -5], [-5, 0, 5], [0, 0, 5], [0, 0, -5]);   // the floor ends at x = 0
  const edge = body(-0.1, 0), inner = body(-0.2, 0);
  frames([edge, inner], ledge, 60);
  assert.ok(edge.ai.feet[0] <= 0 + 1e-9, `the walker at the edge is never pushed over it (${edge.ai.feet[0].toFixed(3)})`);
  assert.ok(Math.abs(edge.ai.feet[1]) < 1e-6, 'and stands on the floor, not on the lip');
  assert.ok(gap(edge, inner) >= FOE_SPACING_GAP - 1e-3, 'the one behind it gives way instead');
  const bat = { ai: { feet: [0.2, 1, 0], height: 1, flies: true }, dead: false }, bat2 = { ai: { feet: [0.1, 1, 0], height: 1, flies: true }, dead: false };
  frames([bat, bat2], ledge, 60);
  assert.ok(bat.ai.feet[0] > 0.3, 'a flyer has no edge to keep');
  assert.ok(Math.abs(bat.ai.feet[1] - 1) < 1e-6, 'and keeps its height');
});

// the WORLD6b-ii rig: a synthetic MONSTER.BSA (a rat's career) on flat open ground, over the real collider
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
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });

test('FOE-SPACING executed: two rats the encounter pool stood in one spot stand a body apart after a second of frames', async () => {
  const pe = playerEntity();
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: new Collider(() => 0),
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  const a = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  const b = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  for (const f of [a, b]) { f.ai.isHostile = false; f.ai.detected = false; }
  const me = [60, 0, 60];
  for (let i = 0; i < 60; i++) pool.update(1 / 60, me, [me[0], 1.6, me[2]], senses(pe));
  assert.ok(gap(a, b) >= FOE_SPACING_GAP - 1e-3, `apart (${gap(a, b).toFixed(3)})`);
});

test('FOE-SPACING by source: the street\'s pool, the watch and the dungeon each push their bodies apart once a frame, on the frame they hand their foes, before the loop steps them', () => {
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /spaceFoes\(foes, collider, foeFrameDt\(dt\)\);[^\n]*\n\s*for \(const f of foes\) \{/, 'the street\'s encounter pool (and the interior pool, the same factory)');
  const g = rd('src/scenes/cityGuards.js');
  assert.match(g, /spaceFoes\(guards, collider, foeFrameDt\(dt\)\);[^\n]*\n\s*const out = \[\];\n\s*for \(const g of guards\) \{/, 'the watch (and the indoor watch)');
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /spaceFoes\(foes, collider, foeFrameDt\(dt\), \(f, i\) => spacingSkips\(f\) \|\| f\._ownFrom != null \|\| \(!_authority && isRoomFoe\(f, i\)\)\);[^\n]*\n\s*for \(const f of foes\) \{\n\s*_fi\+\+;/, 'the dungeon - never a room foe this page does not own');
  assert.match(rd('src/scenes/worldModes.js'), /return createExteriorFoes\(\{/, 'the interior pool is the street\'s factory');
  assert.match(rd('src/scenes/worldModes.js'), /return createCityGuards\(\{/, 'the indoor watch is the watch\'s');
});
