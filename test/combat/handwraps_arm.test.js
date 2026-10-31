// HAND-WRAPS - the Morrowind hands (AUDIT HAND-WRAPS C1-C4; bible/05-Combat/Hand-Wraps.md). Held here on the rig the game
// builds (the fixture body; the port's own steel gauntlets off its shipped tree - not game data) and the real renderer
// on a logging GL: the fists' glow laid on the first- and third-person meshes while the fists are up, lit on the bare
// hands' ranges and on a gauntlet's; none on the stone, before a swap lands, or with a sheet held up; the sprite pass
// draws it over the hands' ranges alone.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as WG from '../../src/systems/weaponGlow.js';
import { createHandWraps } from '../../src/systems/handWraps.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { createFpArm } from '../../src/combat/fpArm.js';
import { Renderer, inGlowSlot } from '../../src/render/renderer.js';
import { composeWornArmor } from '../../src/formats/morrowind/mwItemMap.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { lookAt, perspective } from '../../src/world/mat4.js';
import { fixtureBodyDeps, retailBodyDeps, shippedArchive, countingRenderer } from '../fixtures/mw/bodyRig.mjs';

const canvas = { clientWidth: 800, clientHeight: 600, width: 800, height: 600 };
const SPEC = WG.glowSpec('fire', 2);
// a hang on a lip, as test/combat/twohands_mw.test.js holds one
const CLIMB = { feet: [0, 0, 0], yaw: 0, track: null, floorGap: Infinity, mode: 'hang', classic: false, normal: [0, 0, -1], lipY: 1.9, move: null, grip: 1, flight: null };

/** A rig on the retail skeleton, the wraps in hand, in steel gauntlets or bare; its first-person draws recorded. */
async function armOf({ gloved = false, climb = false } = {}) {
  const pieces = gloved ? [{ kind: 'armor', templateIndex: 103, material: ARMOR_MATERIAL.Steel }] : [];
  const models = composeWornArmor({ pieces, armors: [], bodyPool: [] }).adds.map((a) => `meshes/${a.model}`);
  const drawn = [];
  const renderer = { ...countingRenderer(), renderCharacterSprite: (mesh) => { drawn.push({ glow: mesh.handGlow, lit: mesh.ranges.filter((r) => inGlowSlot(r, 'hands') && !r.hidden).map((r) => r.slot) }); return { tex: {} }; } };
  const cam = () => ({ pos: [0, 1.6, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true }, climb: climb ? CLIMB : null });
  const rig = createFpArm(); rig.attach(renderer, cam);
  const res = await rig.build({ race: 'fprace', armor: pieces, weapon: createHandWraps(), deps: retailBodyDeps({ before: models.length ? [shippedArchive(models)] : [] }) });
  assert.equal(res.ok, true, res.error);
  rig.setSheathed(false);
  for (let i = 0; i < 200; i++) rig.update(0.05);
  rig.setHandGlow(SPEC);
  rig.update(0.05);
  return { rig, drawn };
}

test('HAND-WRAPS the arm, first person: the fists\' glow on the mesh it draws, lit on the bare hands and on both of a gauntlet\'s hand parts (mutants: the mesh\'s glow unset; a glove\'s ranges unmatched)', async () => {
  const bare = await armOf();
  bare.rig.draw(canvas);
  assert.equal(bare.drawn.at(-1).glow, SPEC);
  assert.ok(bare.drawn.at(-1).lit.length >= 1, `the hands lit: ${bare.drawn.at(-1).lit}`);
  const gloved = await armOf({ gloved: true });
  gloved.rig.draw(canvas);
  const lit = gloved.drawn.at(-1).lit;
  assert.equal(gloved.drawn.at(-1).glow, SPEC);
  assert.ok(lit.some((s) => s.startsWith('right hand (')) && lit.some((s) => s.startsWith('left hand (')), `both gauntlets' hands lit: ${lit}`);
});

test('HAND-WRAPS the arm, third person: the body\'s picture wears the fists\' glow, gloved too, and put away (WRAPS-AWAY) (mutants: the third-person mesh\'s glow unset; the fists glow put away in first person)', async () => {
  for (const gloved of [false, true]) {
    const { rig } = await armOf({ gloved });
    rig.setViewMode('third');
    for (let i = 0; i < 5; i++) rig.update(0.05, { pose: true });
    rig.drawThird(canvas, { proj: perspective(1.1, 4 / 3, 0.1, 500), view: lookAt([0, 1.6, 6], [0, 1, 0], [0, 1, 0]), eye: [0, 1.6, 6], feet: [0, 0, 0], yaw: 1.5 });
    const tm = rig.thirdMesh();
    assert.equal(tm.handGlow, SPEC, `gloved ${gloved}`);
    assert.ok(tm.ranges.some((r) => inGlowSlot(r, 'hands') && !r.hidden), `gloved ${gloved}: a hand lit`);
    // WRAPS-AWAY (as the owner asked): put away, the body still glows
    rig.setSheathed(true);
    for (let i = 0; i < 200; i++) rig.update(0.05, { pose: true });
    assert.equal(rig.handGlow(), SPEC, `gloved ${gloved}: put away, third person`);
    rig.setViewMode('first');
    assert.equal(rig.handGlow(), null, `gloved ${gloved}: put away, first person - no hands on screen`);
  }
});

test('HAND-WRAPS the arm lays no glow on the stone, before a swap to the wraps has landed, or with a sheet held up before the eye (mutants: the climb unread; the held key unread; the sheet unread)', async () => {
  const climbing = await armOf({ climb: true });
  for (let i = 0; i < 40; i++) climbing.rig.update(0.05);
  assert.equal(climbing.rig.handGlow(), null, 'on the stone');
  // a blade swapped for the wraps: the arm still holds the blade until its archives answer
  const cam = () => ({ pos: [0, 1.6, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });
  const rig = createFpArm(); rig.attach(countingRenderer(), cam);
  assert.equal((await rig.build({ race: 'fprace', deps: fixtureBodyDeps(), weapon: createWeapon(120, 0) })).ok, true);
  rig.setSheathed(false);
  for (let i = 0; i < 200; i++) rig.update(0.05);
  const swap = rig.setWeapon(createHandWraps());
  rig.setHandGlow(SPEC);
  assert.equal(rig.handGlow(), null, 'mid-swap: the blade still in hand');
  await swap; for (let i = 0; i < 40; i++) rig.update(0.05);
  assert.equal(rig.handGlow(), SPEC, 'the swap landed: the fists');
  assert.equal(rig.holdPaper(null, { aspect: 1.5 }), true);
  for (let i = 0; i < 40; i++) rig.update(0.05);
  assert.equal(rig.handGlow(), null, 'a sheet held up: the hands hold the paper');
});

function loggingRenderer() {
  const log = [];
  let id = 0;
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ uniform: name });
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'drawingBufferWidth') return 800;
      if (k === 'drawingBufferHeight') return 600;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  return { r: new Renderer({ getContext: () => stub, ...canvas }), log };
}
const I = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('HAND-WRAPS the renderer: a mesh with the fists\' glow alone is a glowing mesh in the sprite pass, its rings and charge over the hands\' shown ranges - the skin\'s and a glove\'s - and nothing else (mutants: the gate blind to the hands; the hands\' pass undrawn)', () => {
  const { r, log } = loggingRenderer();
  r.beginFrame(I(), I(), new Float32Array([0, 1, 0]));
  const ranges = [
    { first: 0, count: 30, slot: 'upperarm', tex: null },
    { first: 30, count: 12, slot: 'hand', tex: null },
    { first: 42, count: 6, slot: 'right hand (daggerfall_steel_gauntlets)', tex: null },
    { first: 48, count: 9, slot: 'left hand (daggerfall_steel_gauntlets)', tex: null, hidden: true },
  ];
  r.renderCharacterSprite({ vao: { id: 'arm' }, ranges, handGlow: SPEC }, I(), I(), I(), 800, 600);
  const instanced = log.filter((c) => c[0] === 'drawArraysInstanced').map((c) => [c[2], c[3]]);
  assert.deepEqual(instanced, [[30, 12], [42, 6]], 'the rings over the shown hands alone');
  const draws = log.filter((c) => c[0] === 'drawArrays').map((c) => [c[2], c[3]]);
  assert.deepEqual(draws, [[0, 30], [30, 12], [42, 6], [30, 12], [42, 6]], 'the body, then the hands\' charge');
});
