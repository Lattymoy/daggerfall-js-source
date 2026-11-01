// OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for everything") - COME SAIL AWAY'S ASSETS, OURS: the
// twelve prefabs, their meshes, materials and animation built by world/ships/ownBoats/ (no file of them in the tree),
// the pictures systems/comeSailAway/csaPictures.js paints and the five clips csaSynth/csaClips.js makes. Each is the
// same to the byte every time it is made; each hull walks as Come Sail Away's runtime reads it - its lanterns, sails by
// their names and order, triggers, effects - and nothing of Come Sail Away 2.1's author is left in the tree.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { buildOwnBoatFiles, ownBoatFiles, TRIGGER_PREFAB_IDS } from '../../../src/world/ships/ownBoats/ownBoatFiles.js';
import { OWN_BOAT_ARCHIVE, OWN_TEX, ownBoatArt } from '../../../src/world/ships/ownBoats/ownBoatArt.js';
import { comeSailAwayModels, decodeMeshGeometry } from '../../../src/systems/comeSailAway/comeSailAwayModels.js';
import { spawnBoat, Boat, AUDIO_CLIPS, TRIGGER_MODEL } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { windWidgetFrame, splashPicture, WIND_WIDGET_SIZE } from '../../../src/systems/comeSailAway/csaPictures.js';
import { windWidgetFrameCount } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { csaClip, CSA_CLIP_FORMAT } from '../../../src/systems/comeSailAway/csaSynth/csaClips.js';
import { CONTROLLERS } from '../../../src/world/ships/ownBoats/ownBoatAnimation.js';

const files = ownBoatFiles();
const models = comeSailAwayModels(files);
const ctx = { models, player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }) };
const walk = function* (n) { yield n; for (const c of n.children) yield* walk(c); };

test('OWN-WORK4: the boats\' files are made the same to the byte every time - prefabs, components, meshes, buffer, materials and animation (mutant: a seed or a order that wanders)', () => {
  const again = buildOwnBoatFiles();
  assert.deepEqual(Buffer.from(again.bin), Buffer.from(files.bin), 'the mesh buffer');
  for (const k of ['prefabs', 'meshes', 'materials', 'animation']) assert.equal(JSON.stringify(again[k]), JSON.stringify(files[k]), k);
  assert.ok(!existsSync(new URL('../../../vendor/come-sail-away', import.meta.url)), 'Come Sail Away 2.1\'s vendored files are retired');
});

test('OWN-WORK4: the twelve prefabs the runtime asks for - the seven trigger boxes, each a unit trigger, and the five hulls 112410-112414; every mesh decodes inside its box, every renderer wears our own pictures or none (a water mask, a switched-off helper)', () => {
  assert.deepEqual(Object.keys(files.prefabs.prefabs).map(Number).sort((a, b) => a - b), [...TRIGGER_PREFAB_IDS, 112410, 112411, 112412, 112413, 112414]);
  assert.deepEqual([...TRIGGER_PREFAB_IDS], Object.values(TRIGGER_MODEL));
  const C = files.prefabs.components;
  for (const id of TRIGGER_PREFAB_IDS) {
    const box = C[files.prefabs.prefabs[id].components[0]];
    assert.deepEqual([box.type, box.m_IsTrigger, box.m_Size], ['BoxCollider', true, { x: 1, y: 1, z: 1 }], `${id}`);
  }
  for (const [k, e] of Object.entries(files.meshes)) {
    const g = decodeMeshGeometry(e, files.bin);
    assert.ok(g.indices.every((i) => i < g.vertexCount), `${k}: its indices`);
    for (let i = 0; i < g.positions.length; i++) {
      const d = i % 3;
      assert.ok(Math.abs(g.positions[i] - e.aabb.center[d]) <= e.aabb.extent[d] + 1e-4, `${k}: inside its box`);
    }
  }
  let mine = 0;
  for (const c of C) {
    assert.notEqual(c.m_Script?.script, 'RuntimeMaterials', 'no renderer of ours reads a Daggerfall record');
    if (c.type === 'MeshRenderer' && c.materials) {
      mine++;
      assert.ok(c.materials.every((m) => m.archive === OWN_BOAT_ARCHIVE), 'our archive alone');
    }
  }
  assert.ok(mine > 50);
  assert.deepEqual(Object.keys(CONTROLLERS), ['Door Controller', 'Rudder Controller', 'Sail Controller', 'Staysail Controller', 'Rudder Wheel Controller']);
  assert.deepEqual(ownBoatArt().map(([r]) => r), Object.values(OWN_TEX).sort((a, b) => a - b), 'every record painted');
});

test('OWN-WORK4: each hull walks as Come Sail Away\'s runtime reads it - its lanterns, its sails by their names in their order, its booms, board and door triggers, oar and rudder effects, pennant and the triggers its crew carry (mutants: a sail renamed, a lantern dropped, an oar\'s effect lost)', () => {
  const row = (h, v) => {
    const b = spawnBoat(new Boat(h, v), ctx);
    return [b.Lights.length, b.Sails.map((s) => s.name), b.Booms.length, b.BoardTriggers.length, b.OarParticles.length, b.RudderEmitters.length, !!b.FlagObject, !!b.CargoTrigger, !!b.StatusTrigger, !!b.PositionTrigger, !!b.VariantTrigger];
  };
  assert.deepEqual(row(0, 0), [1, [], 0, 1, 2, 0, false, false, false, false, false], 'the rowboat');
  const skiff = [
    ['SkiffLargeLateenSail'],
    ['SkiffSmallGaffSail2', 'SkiffSmallStaySail'],
    ['SkiffSmallGaffSail2', 'SkiffLargeSquareSail', 'SkiffSmallStaySail'],
    ['SkiffSmallSquareSail', 'SkiffLargeLateenSail'],
    ['SkiffLargeStaySail (1)', 'SkiffSmallGaffSail1', 'SkiffSmallGaffSail2'],
    ['SkiffLargeGaffSail', 'SkiffSmallSquareSail', 'SkiffSmallStaySail'],
    ['SkiffLargeSquareSail', 'SkiffSmallSquareSail'],
  ];
  for (const [v, sails] of skiff.entries())
    assert.deepEqual(row(1, v), [2, sails, sails.filter((s) => !s.includes('Stay')).length - (v === 4 ? 1 : 0), 1, 0, 1, true, true, false, false, true], `the large boat's plan ${v}`);
  assert.deepEqual(row(2, 0), [18, ['GalleonLargeLateenSail', 'GalleonLargeLateen2Sail'], 2, 3, 0, 0, true, true, true, true, true], 'the small ship');
  assert.deepEqual(row(3, 0), [25, ["T'avaTriremeLargeSquareSail"], 1, 3, 108, 2, true, true, true, false, true], 'the large galley');
  assert.deepEqual(row(4, 0), [0, ['CarrackSmallSquareSail', 'CarrackLargeSquareSail1', 'CarrackLargeSquareSail', 'CarrackMediumSquareSail', 'CarrackMediumLateenSail1'], 5, 9, 0, 0, false, true, false, false, false], 'the carrack');
  // every sail's Animator over the Sail or Staysail Controller, its clips a sixth of a second
  const b = spawnBoat(new Boat(4, 0), ctx);
  for (const s of b.Sails) {
    const o = files.animation.overrides[s.getComponent('Animator').m_Controller.controller];
    assert.ok(o && /Sail Controller|Staysail Controller/.test(o.base), s.name);
    for (const [, clip] of o.clips) assert.equal(files.animation.clips[clip].stop, 1 / 6, clip);
  }
});

test('OWN-WORK4: the rowing clips carry the three oar events at Come Sail Away\'s times - the rowboat\'s second, the galley\'s two (mutant: an event moved)', () => {
  const ev = (k) => files.animation.clips[k].events.map((e) => [Math.round(e.time * 1e4) / 1e4, e.functionName]);
  for (const k of ['Forward', 'Backward', 'Left', 'Right']) {
    assert.deepEqual(ev(`own/rowboat/Rudder Rowing ${k}`), [[0.1667, 'OarEvent_Sweep'], [0.3333, 'OarEvent_Out'], [0.8667, 'OarEvent_In']]);
    assert.deepEqual(ev(`own/galley/Rudder Rowing ${k}`), [[0, 'OarEvent_In'], [0.5, 'OarEvent_Sweep'], [1.25, 'OarEvent_Out']]);
  }
  assert.equal(files.animation.clips['own/rowboat/Rudder Rowing Forward'].stop, 1);
  assert.equal(files.animation.clips['own/galley/Rudder Rowing Forward'].stop, 2);
});

test('OWN-WORK4: the pictures - the wind widget\'s arrow a frame a step, frame 0 pointing ahead and a quarter turn pointing right; the splash 52 x 41 - painted the same every time', () => {
  const n = windWidgetFrameCount();
  assert.equal(n, 24);
  const mass = (img) => {
    let up = 0, down = 0, left = 0, right = 0;
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) {
        const a = img.data[(y * img.width + x) * 4 + 3];
        if (y < img.height / 2) up += a; else down += a;
        if (x < img.width / 2) left += a; else right += a;
      }
    return { up, down, left, right };
  };
  const f0 = windWidgetFrame(0), f6 = windWidgetFrame(6);
  assert.deepEqual([f0.width, f0.height], [WIND_WIDGET_SIZE, WIND_WIDGET_SIZE]);
  const m0 = mass(f0), m6 = mass(f6);
  assert.ok(m0.up > m0.down && Math.abs(m0.left - m0.right) < m0.up * 0.05, 'frame 0: its head up, the arrow upright');
  assert.ok(m6.right > m6.left && Math.abs(m6.up - m6.down) < m6.right * 0.05, 'frame 6: its head to the right');
  assert.deepEqual(windWidgetFrame(13).data, windWidgetFrame(13).data);
  const s = splashPicture();
  assert.deepEqual([s.width, s.height], [52, 41]);
  let solid = 0;
  for (let i = 3; i < s.data.length; i += 4) if (s.data[i] >= 128) solid++;
  assert.ok(solid > 200 && solid < 52 * 41 * 0.8, `cut at a half, ragged (${solid})`);
});

test('OWN-WORK4: the five clips Start loads - each at its rate, the strokes as long as Come Sail Away\'s, the loops seamless; never silent, never clipped, the same every time', () => {
  assert.deepEqual(Object.keys(CSA_CLIP_FORMAT), [...AUDIO_CLIPS]);
  assert.deepEqual(['Oars_In', 'Oars_Sweep', 'Oars_Out'].map((k) => [CSA_CLIP_FORMAT[k].rate, CSA_CLIP_FORMAT[k].samples]), [[22050, 131982], [22050, 122865], [22050, 134314]]);
  for (const name of AUDIO_CLIPS) {
    const c = csaClip(name);
    assert.equal(c.rate, CSA_CLIP_FORMAT[name].rate);
    assert.equal(c.samples.length, CSA_CLIP_FORMAT[name].samples);
    let peak = 0, sum = 0;
    for (const v of c.samples) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
    assert.ok(peak > 0.5 && peak <= 0.8, `${name}: peak ${peak}`);
    assert.ok(Math.sqrt(sum / c.samples.length) > 0.01, `${name}: heard`);
    assert.equal(csaClip(name), c, 'made once');
  }
  for (const name of ['SmallShipAmbience', 'ShipExteriorAmbience2']) {
    const s = csaClip(name).samples;
    assert.ok(Math.abs(s[0] - s[s.length - 1]) < 0.08, `${name}: its end meets its start`);
  }
});
