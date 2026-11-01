// TRUNK-FOES (FIELD FEEDBACK 2026-10-31, #feature-feedback: "Jungle trees need better or more collision, enemies just
// hide in them it sucks."). A foe in a NATURE body - a tree's trunk, a rock, Valenwood's graht-oak, Black Marsh's Hist -
// is put at its edge in the frame its pool spaces its foes, a lone foe too (characters/foeSpacing.js keepFoesOffBodies);
// a made thing's body (a barrel) holds no foe. And a missile is never stopped short by cover a body its line strikes
// stands in (ai/cover.js `holds`, systems/spellcast.js struckPoints) - one in a crown is shot in it as it shoots out.
// bible/03-World/Player-Arc.md TRUNK-FOES.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spaceFoes, keepFoesOffBodies } from '../../src/characters/foeSpacing.js';
import { Collider } from '../../src/player/collider.js';
import { CAPSULE_RADIUS } from '../../src/player/motor.js';
import { createCoverIndex, coverDistance } from '../../src/ai/cover.js';
import { flatBody, jungleBody } from '../../src/world/propBodies.js';
import { jungleCover } from '../../src/world/jungle/jungleModels.js';
import { grahtBodies } from '../../src/world/jungle/grahtOaks.js';
import { landPropBodies } from '../../src/world/lands/landProps.js';
import { LAND_KINDS } from '../../src/world/lands/landPropMesh.js';
import { ArrowFlight } from '../../src/combat/arrowFlight.js';
import { flightStop } from '../../src/scenes/hostMagic.js';
import { flightBodies, struckPoints, missileReach, MISSILE_COLLIDER_RADIUS } from '../../src/systems/spellcast.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** open ground with a cover index holding `items` (the set's frame `t`) */
function field(items, t = null, ground = new Collider(() => 0)) {
  ground.cover = createCoverIndex({ enabled: () => true });
  ground.cover.add('pixel', items, t);
  return ground;
}
const foe = (x, z, over = {}) => ({ ai: { feet: [x, 0, z], height: 1.8, ...over }, dead: false });
const from = (f, c) => Math.hypot(f.ai.feet[0] - c[0], f.ai.feet[2] - c[2]);
const pic = { getDFBitmap: () => ({ width: 10, height: 20, data: new Uint8Array(200).fill(7) }) };

test('TRUNK-FOES a foe in a jungle trunk is at its edge after one frame - alone, or one of a pack; a flyer over it, the dead and a puppet stay where they are (mutants: the call gone; a lone foe skipped; the reach without the foe\'s radius; the span unread; the jungle\'s trunk no nature)', () => {
  const c = [0, 0, 10], trunk = jungleBody(c, 0, 1.2);   // a banyan at 1.2: a 1.73 m trunk to 3.6 m
  const R = trunk.r + CAPSULE_RADIUS;
  const lone = foe(0.3, 10.2);
  spaceFoes([lone], field([trunk]), 1 / 60);
  assert.ok(Math.abs(from(lone, c) - R) < 1e-6, `the lone foe at the trunk's edge (${from(lone, c).toFixed(3)} of ${R.toFixed(3)})`);
  assert.equal(lone.ai.feet[1], 0, 'on its own ground');
  const pack = [foe(-0.4, 9.7), foe(30, 30)];
  spaceFoes(pack, field([trunk]), 1 / 60);
  assert.ok(from(pack[0], c) >= R - 1e-6, 'one of a pack too');
  const bat = foe(0.3, 10.2, { flies: true }), dead = { ...foe(0.3, 10.2), dead: true }, puppet = { ...foe(0.3, 10.2), puppet: true };
  bat.ai.feet[1] = trunk.h + 0.1;
  for (const f of [bat, dead, puppet]) {
    const was = [...f.ai.feet];
    spaceFoes([f], field([trunk]), 1 / 60);
    assert.deepEqual(f.ai.feet, was);
  }
  const held = foe(0.3, 10.2);
  spaceFoes([held], field([trunk]), 0);
  assert.deepEqual(held.ai.feet, [0.3, 0, 10.2], 'a held frame moves nobody');
});

test('TRUNK-FOES every nature body, the Bay\'s and past it - a tree\'s, a rock\'s, Valenwood\'s graht-oak trunk, Black Marsh\'s Hist; never a made thing\'s, a barrel or a statue; a set\'s frame read (mutants: a tree flat no nature; a still record no nature; a prop nature; the graht-oak no nature; the landmark no nature; the nature unread; the box unfilled; the box read the wrong way)', () => {
  const at = (b) => [b.c[0], b.c[1], b.c[2]];
  const tree = flatBody([0, 0, 0], pic, 504, 13, { w: 3.9, h: 7.4 }, { tree: true });
  const rock = flatBody([0, 0, 0], pic, 504, 5, { w: 2, h: 3 });
  const graht = grahtBodies([0, 0, 0, 0, 1.1, 1], 0)[0];
  const hist = landPropBodies(Float32Array.from([0, 0, 0, 0, 1, LAND_KINDS.indexOf('hist'), 0, 0]), 0)[0];
  for (const [name, b] of [['a temperate tree', tree], ['a rock', rock], ['a Valenwood graht-oak', graht], ['a Black Marsh Hist', hist]]) {
    assert.equal(b.nature, true, name);
    const f = foe(b.c[0] + 0.1, b.c[2] + 0.05);
    keepFoesOffBodies([f], field([b]));
    assert.ok(Math.abs(from(f, at(b)) - (b.r + CAPSULE_RADIUS)) < 1e-6, `${name}: out of it (${from(f, at(b)).toFixed(3)})`);
  }
  for (const [archive, name] of [[205, 'a barrel'], [202, 'a statue']]) {
    const b = flatBody([0, 0, 0], pic, archive, 0, { w: 2, h: 3 });
    assert.equal(b.nature, false, name);
    const f = foe(0.1, 0.05);
    assert.equal(keepFoesOffBodies([f], field([b])), 0, `${name} holds no foe`);
    assert.deepEqual(f.ai.feet, [0.1, 0, 0.05]);
  }
  // a pixel's frame: the trunk where its frame puts it, and none where it stood
  const framed = jungleBody([0, 0, 0], 3, 1);
  const f = foe(100.1, 50), g = foe(0.1, 0);
  keepFoesOffBodies([f, g], field([framed], () => [100, 0, 50]));
  assert.ok(Math.abs(Math.hypot(f.ai.feet[0] - 100, f.ai.feet[2] - 50) - (framed.r + CAPSULE_RADIUS)) < 1e-6, 'the framed trunk');
  assert.deepEqual(g.ai.feet, [0.1, 0, 0], 'nothing at the frame\'s origin');
});

test('TRUNK-FOES through the collider - a wall stops the push, and a walker is never pushed off an edge (mutants: the push past the edge rule)', () => {
  const ledge = new Collider();
  ledge.addMesh('scene', new Float32Array([-5, 0, -5, -5, 0, 5, 0, 0, 5, 0, 0, -5]), new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]), I);   // the floor ends at x = 0
  const edge = foe(-0.1, 0);
  keepFoesOffBodies([edge], field([jungleBody([-0.3, 0, 0], 3, 1)], null, ledge));
  assert.deepEqual(edge.ai.feet, [-0.1, 0, 0], 'pushed toward the drop, it stays');
  const inner = foe(-0.5, 0);
  keepFoesOffBodies([inner], field([jungleBody([-0.3, 0, 0], 3, 1)], null, ledge));
  assert.ok(inner.ai.feet[0] < -0.5, 'pushed onto the floor, it goes');
});

// the WORLD6b-ii rig (test/scenes/foespacing.test.js): a synthetic MONSTER.BSA, a rat, on open ground
function craftCfg() {
  const b = new Uint8Array(74), v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  [40, 50, 50, 85, 50, 50, 90, 55].forEach((a, i) => v.setUint16(58 + i * 2, a, true));
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18, dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length), v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}

test('TRUNK-FOES executed: a rat the encounter pool stood inside a banyan\'s trunk stands outside it two frames on - the street\'s pool, the interior\'s and the watch through spaceFoes, the dungeon\'s too', async () => {
  const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
  const pe = { level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) };
  const c = [10, 0, 10], trunk = jungleBody(c, 0, 1);
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: field([trunk]),
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => ({ getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 }),
    uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  const rat = await pool.spawnFoe(0, [10.2, 0, 10.1], { feetGiven: true });
  rat.ai.isHostile = false; rat.ai.detected = false;
  assert.ok(from(rat, c) < trunk.r, 'stood inside it');
  const me = [60, 0, 60];
  for (let i = 0; i < 2; i++) pool.update(1 / 60, me, [me[0], 1.6, me[2]], { candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
  assert.ok(from(rat, c) >= trunk.r + CAPSULE_RADIUS - 0.1, `outside it (${from(rat, c).toFixed(3)} m from its middle, the trunk ${trunk.r} m)`);
  assert.match(rd('src/characters/foeSpacing.js'), /const n = foes\?\.length \?\? 0;\n\s*if \(n && dt > 0 && collider\?\.move\) keepFoesOffBodies\(foes, collider, skip\);[^\n]*\n\s*if \(n < 2 /, 'before the pair loop\'s early return');
});

// ─── THE MISSILE ─────────────────────────────────────────────────────

/** a shot of the player's along +z at 1.4 m from z = 0; whether it struck `target` and where it ended */
function shoot(col, target) {
  const f = new ArrowFlight({ getGpuMesh: () => null, collider: col });
  const roll = Math.random;
  Math.random = () => 0;   // BOW-BLOOM's spread at its centre: shots in quick succession bloom, and this one flies true
  try { f.fire([0, 1.4, 0], [0, 0, 1], { fromPlayer: true }); } finally { Math.random = roll; }
  let struck = null;
  for (let i = 0; i < 120 && !f.arrows[0].dead; i++) {
    f.update(1 / 60, { foeTargets: target ? [{ feet: target.ai.feet, ref: target }] : [], onPlayerArrowHitFoe: (m, t) => { struck = t; } });
  }
  return { struck, z: f.arrows[0].pos[2] };
}

test('TRUNK-FOES the player\'s arrow reaches a foe pressed against a trunk, and one standing in a young banyan\'s crown (from 1.08 m) - where the crown holds nobody the shaft is lost on it, and a trunk in front of a foe still shields it (mutants: the holds unread; their frame unread; coverDistance drops them; the arrow\'s holds none; a body struck off the line; the body\'s middle, not the line\'s height)', () => {
  const c = [0, 0, 20], trunk = jungleBody(c, 0, 1);
  const pressed = foe(0, 20 - trunk.r - CAPSULE_RADIUS);
  assert.equal(shoot(field([trunk, ...jungleCover(c, 0, 1)]), pressed).struck, pressed, 'pressed against the trunk');
  const young = [0, 0, 20], cover = [jungleBody(young, 0, 0.36), ...jungleCover(young, 0, 0.36)];
  assert.ok(Math.abs(cover[2].lift - 1.08) < 1e-9 && cover[2].r > 2, 'the young crown: from 1.08 m, over 2 m out');
  const under = foe(0, 18.6);
  assert.equal(shoot(field(cover), under).struck, under, 'in the crown');
  const shifted = cover.map((p) => ({ ...p, c: [p.c[0] - 50, p.c[1], p.c[2]] }));
  assert.equal(shoot(field(shifted, () => [50, 0, 0]), under).struck, under, 'in a pixel\'s frame too');
  const empty = shoot(field(cover), null);
  assert.ok(empty.z < 20 - cover[2].r, `no one in it: lost on the crown (z ${empty.z.toFixed(2)})`);
  const aside = foe(1.6, 19);   // in the crown, off the shot's line
  const past = shoot(field(cover), aside);
  assert.equal(past.struck, null);
  assert.ok(past.z < 20 - cover[2].r, 'a body in the crown off the line opens nothing');
  const behind = foe(0, 20 + trunk.r + 0.6);
  assert.equal(shoot(field([trunk, ...jungleCover(c, 0, 1)]), behind).struck, null, 'behind the trunk: shielded');
});

test('TRUNK-FOES the bolts: the one flight law is never stopped short by cover a body its line strikes stands in - a foe\'s or, for a foe\'s bolt, the player\'s (mutants: flightStop\'s holds none; the player no body)', () => {
  const young = [0, 0, 20], col = field([jungleBody(young, 0, 0.36), ...jungleCover(young, 0, 0.36)]);
  const crownEdge = 20 - jungleCover(young, 0, 0.36)[1].r;
  const step = 0.5, { unit, reach } = missileReach([0, 0, 1], step);
  const pos = [0, 1.4, crownEdge - MISSILE_COLLIDER_RADIUS];   // touching the crown
  assert.ok(Number.isFinite(flightStop(col, pos, unit, reach, step).stop), 'nobody in it: the bolt bursts on it');
  assert.ok(Number.isFinite(flightStop(col, pos, unit, reach, step, false, flightBodies([], null, 1.8)).stop), 'no bodies: the same');
  const inIt = foe(0, 18.6);
  assert.equal(flightStop(col, pos, unit, reach, step, false, flightBodies([inIt], null, 1.8)).stop, Infinity, 'a foe in it: the bolt flies on');
  assert.equal(flightStop(col, pos, unit, reach, step, false, flightBodies([{ ...inIt, dead: true }], null, 1.8)).stop < Infinity, true, 'a corpse opens nothing');
  assert.equal(flightStop(col, pos, unit, reach, step, false, flightBodies([], [0, 0, 18.6], 1.8)).stop, Infinity, 'the player in it, a foe\'s bolt flies on');
  // the points: the body's axis at the line's height, a body the line misses none
  assert.deepEqual(struckPoints([0, 1.4, 0], [0, 0, 1], [{ feet: [0.3, 0, 10], height: 1.8 }, { feet: [3, 0, 10], height: 1.8 }]), [0.3, 1.4, 10]);
  assert.equal(coverDistance(col, pos, unit, reach, false, [0, 1.4, 18.6]), Infinity, 'coverDistance hands them on');
});
