// MWNPC13 (2026-10-10, the MW-NPC arc's thirteenth slice - bible/04-Characters/Morrowind-NPCs.md section 18): THE
// SPECTRAL DEAD IN THEIR BODIES. The ghost and the wraith were declared misses because a body's textures are alpha-
// tested - but every foe host already draws a CONCEALED body translucent after its opaque world (INVIS-LOOK). So they
// stand as Morrowind's ancestor ghost under a standing veil at the opacity Daggerfall's own spectral sprite is drawn,
// the veil riding the look (characters/creatureBodies.js SPECTRAL_VEIL) so every lane veils it; a named spectral in an
// archive of his own (Lysandus) keeps his sprite; the roads' lane draws its veiled ones too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creatureLook, SPECTRAL_VEIL, CREATURE_MATCH } from '../src/characters/creatureBodies.js';
import { foeActor, isBodyFoe } from '../src/characters/foeBodies.js';
import { createNpcBodies } from '../src/characters/npcBodies.js';
import { createTravellerSprites } from '../src/world/travellerSprites.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { BaseImageFile } from '../src/formats/baseImageFile.js';
import { createEquipTable } from '../src/characters/equipTable.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));

test('MWNPC13-1 the ghost and the wraith are Morrowind\'s ancestor ghost, veiled at the spectral sprite\'s own opacity; Lysandus in his own archive keeps his sprite; a ghost foe is a body foe in that look', () => {
  assert.deepEqual({ ...SPECTRAL_VEIL }, { mode: 3, alpha: BaseImageFile.SPECTRAL_ALPHA / 255, t: 0, phase: 0 });
  assert.equal(Math.round(SPECTRAL_VEIL.alpha * 255), 180, 'seen through as the spectral sprite is (dataPipeline.js)');
  for (const [t, stock] of [[M.Ghost, 273], [M.Wraith, 278]]) {
    assert.deepEqual(CREATURE_MATCH[t].creature, ['ancestor_ghost']);
    const look = creatureLook({ mobileType: t });
    assert.deepEqual(look.creature, ['ancestor_ghost']);
    assert.equal(look.veil, SPECTRAL_VEIL);
    assert.equal(creatureLook({ mobileType: t, mobileArchive: stock }), look, 'the dungeon\'s, in its stock archive');
    assert.equal(creatureLook({ mobileType: t, archive: stock }), look, 'the encounter pool\'s');
    assert.equal(creatureLook({ mobileType: t, mobileArchive: 473 }), null, 'a named one keeps his sprite');
    assert.equal(creatureLook({ mobileType: t, archive: 473 }), null);
  }
  assert.equal(creatureLook({ mobileType: M.Rat }).veil, undefined, 'the living unveiled');
  assert.equal(creatureLook({ mobileType: M.Rat, mobileArchive: 999 })?.creature[0], 'rat', 'only a spectral reads its archive');
  const ghost = { mobileType: M.Ghost, mobileArchive: 273, marker: [1, 0, 1], gender: 'male', entity: { isClass: false, equip: createEquipTable(), items: [] }, ai: { feet: [0, 0, 0], yaw: 0, moving: false, giveUpTimer: 0 } };
  assert.equal(isBodyFoe(ghost), true);
  assert.equal(foeActor(ghost).look.veil, SPECTRAL_VEIL);
});

test('MWNPC13-2 the lane veils what its look veils: the ghost drawn in the veiled pass (translucent, after the opaque world), never the open one; a host\'s own concealment first; the living open', async () => {
  const draws = [];
  const rig = () => { const r = { mode: 'first', skinned: false, attach() {}, async build() { await flush(); return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; }, thirdActive: () => r.mode === 'third' && r.skinned, update(dt, o) { if (o?.pose !== false) r.skinned = true; }, drawThird(_c, o) { draws.push({ id: r.id, conceal: o.conceal }); return true; }, unload() {}, setSheathed() {}, revive() {} }; return r; };
  let n = 0;
  const lane = createNpcBodies({ renderer: {}, tier: () => 'near', createRig: () => Object.assign(rig(), { id: n++ }), now: () => 1000 });
  const ghost = { id: 'g', look: creatureLook({ mobileType: M.Ghost }), feet: [0, 0, -3], yaw: 0 };
  const rat = { id: 'r', look: creatureLook({ mobileType: M.Rat }), feet: [1, 0, -3], yaw: 0 };
  const shade = { id: 's', look: creatureLook({ mobileType: M.Wraith }), feet: [2, 0, -3], yaw: 0 };
  const hostConceal = { mode: 2, alpha: 0.3, t: 0, phase: 0 };
  for (let i = 0; i < 12; i++) { lane.begin(); lane.stand('foe', ghost); lane.stand('foe', rat); lane.stand('foe', shade, hostConceal); lane.end(1 / 60, [0, 0, 0]); await flush(); await flush(); }
  draws.length = 0;
  lane.draw({}, { proj: null, view: null, eye: [0, 0, 0] });
  const open = draws.map((d) => d.conceal);
  assert.equal(open.length, 1, 'the open pass: the rat alone');
  assert.equal(open[0], null);
  draws.length = 0;
  lane.drawVeiled();
  const veiled = draws.map((d) => d.conceal);
  assert.equal(veiled.length, 2, 'the veiled pass: the ghost and the wraith');
  assert.ok(veiled.includes(SPECTRAL_VEIL), 'the ghost under its own veil');
  assert.ok(veiled.includes(hostConceal), 'a host\'s concealment (a wraith turned invisible) first');
  lane.destroy();
});

test('MWNPC13-3 a ghost besetting a party on the road is veiled: the road\'s sprites draw their veiled bodies, and the world asks them after its opaque world', async () => {
  const L = { veiled: 0 };
  const lane = { begin() {}, stand() {}, end() {}, has: () => false, draw() {}, drawVeiled() { L.veiled++; }, destroy() {}, offsetAll() {} };
  const sp = createTravellerSprites({ renderer: { textures: new Map(), createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch() {} }, getTexture: async () => ({ getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) }), uploadRecordFrame() {}, wantBodies: () => true, makeBodies: () => lane });
  sp.drawBodies({}, null, null, [0, 0, 0], 0);
  sp.drawVeiledBodies();
  assert.equal(L.veiled, 1);
  assert.ok(rd('src/scenes/livingRoads.js').includes('drawVeiledBodies() { deps.sprites.drawVeiledBodies?.(); },'));
  const w = rd('src/scenes/world.js');
  const i = w.indexOf('livingRoads?.drawVeiledBodies();'), j = w.indexOf('drawVeiledPeerBodies();   // INVIS-LOOK: the concealed peers\' bodies, translucent - after the opaque world');
  assert.ok(i > 0 && j > i && w.lastIndexOf('exteriorFoes.drawVeiledBodies();', i) > 0 && i - w.lastIndexOf('exteriorFoes.drawVeiledBodies();', i) < 400, 'in the veiled block, beside the foes\'');
});
