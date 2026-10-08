// SD18c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD18c;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE ENDING'S LIGHT AND WORD - a Hollow's Remnant, its
// Echoes and its Reset's Hearts burn with the light of the Ending it keeps (world/sdRemnantArt.js, records 25-30: its
// colour and as much again its own light), its Hearts' and its stun's sparks in it; the taverns tell the omen its Ending
// sends, and its card on the held map says which Ending it keeps.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SD_REMNANT_ENDING_RECORD, endingLightArt, remnantArt, SD_ENDING_ART_SIZE, SD_REMNANT_GOLD_RECORD } from '../src/world/sdRemnantArt.js';
import { buildRemnantParts, buildRemnantModel, buildHeartModel, heartRecordOf, eyeRecordOf, SD_REMNANT_HEART_RECORD, SD_REMNANT_EYE_RECORD } from '../src/world/sdRemnantModel.js';
import { SD_ENDINGS, sdMarksOf, sdEndingOf } from '../src/net/sdMarks.js';
import { createSdRemnant } from '../src/scenes/sdRemnant.js';
import { createSdFx, sdHeartColorOf, SD_FX_COLOR, SD_FX_KINDS } from '../src/scenes/sdFx.js';
import { sdRumorLine, SD_ENDING_RUMOR } from '../src/systems/sdOmen.js';

const T0 = 1_800_000_000_000;
const recordsOf = (m) => new Set(m.subMeshes.map((x) => x.textureRecord));

test('SD18c THE ENDINGS\' LIGHTS: one record an Ending, after the Echoes\' metals - its colour, and as much again its own light', () => {
  assert.deepEqual(SD_ENDINGS.map((E) => SD_REMNANT_ENDING_RECORD[E.id]), [25, 26, 27, 28, 29, 30]);
  assert.equal(SD_REMNANT_ENDING_RECORD.daggerfall, SD_REMNANT_GOLD_RECORD + 2);
  const art = remnantArt();
  assert.deepEqual(art.map(([r]) => r).slice(2), [25, 26, 27, 28, 29, 30]);
  for (const E of SD_ENDINGS) {
    const a = art.find(([r]) => r === SD_REMNANT_ENDING_RECORD[E.id])[1];
    const want = E.light.map((v) => Math.round(v * 255));
    assert.equal(a.albedo.width, SD_ENDING_ART_SIZE);
    assert.deepEqual([...a.albedo.colors.slice(0, 4)], [...want, 255]);
    assert.deepEqual([...a.emission.colors.slice(-4)], [...want, 255], 'as much again its own light');
  }
  const flat = endingLightArt([1, 0.5, 0]);
  assert.ok(flat.albedo.colors.every((v, i) => v === [255, 128, 0, 255][i % 4]));
});

test('SD18c THE BODIES IN ITS LIGHT: the Remnant\'s heart and eyes, its Echoes\', the Reset\'s Hearts - each its Ending\'s; with none the Mantella\'s green and the brass\'s gold; the scene builds them by its Hollow\'s, the dungeon context hands it the slot\'s', () => {
  for (const E of SD_ENDINGS) {
    const rec = SD_REMNANT_ENDING_RECORD[E.id];
    const parts = buildRemnantParts('brass', E.id);
    assert.ok(recordsOf(parts[3]).has(rec) && !recordsOf(parts[3]).has(SD_REMNANT_HEART_RECORD), `${E.id}: its heart`);
    assert.ok(recordsOf(parts[4]).has(rec) && !recordsOf(parts[4]).has(SD_REMNANT_EYE_RECORD), `${E.id}: its eyes`);
    assert.ok(recordsOf(buildRemnantParts('gold', E.id)[3]).has(rec), 'the Echoes\' too');
    assert.ok(recordsOf(buildHeartModel(E.id)).has(rec), 'the Reset\'s Hearts');
    assert.ok(recordsOf(buildRemnantModel('silver', E.id)).has(rec));
  }
  assert.ok(recordsOf(buildRemnantParts('brass')[3]).has(SD_REMNANT_HEART_RECORD) && recordsOf(buildRemnantParts('brass')[4]).has(SD_REMNANT_EYE_RECORD));
  assert.ok(recordsOf(buildHeartModel()).has(SD_REMNANT_HEART_RECORD));
  assert.deepEqual([heartRecordOf('nowhere'), eyeRecordOf(null)], [SD_REMNANT_HEART_RECORD, SD_REMNANT_EYE_RECORD]);
  // the scene
  const made = [];
  const renderer = { createMesh: (m) => { made.push(m); return { id: made.length }; }, destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {} };
  createSdRemnant({ renderer, ending: 'sentinel' }).stand({ dynamicDraws: [] });
  const recs = new Set(made.flatMap((m) => m.subMeshes.map((x) => x.textureRecord)));
  assert.ok(recs.has(26) && !recs.has(SD_REMNANT_HEART_RECORD) && !recs.has(SD_REMNANT_EYE_RECORD), 'every heart, eye and Heart in Sunfall\'s light');
  const D = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(D, /alive: \(\) => playerEntity\.health > 0, ending: sdMarksOf\(dfLocation\.sdRealm\)\[0\] \}\)/);
});

test('SD18c ITS SPARKS IN ITS LIGHT: the Hearts risen and broken and the stun in its Ending\'s; with none the Mantella\'s', () => {
  assert.equal(sdHeartColorOf({ mk: ['orsinium', 'twin', 'short'] }), sdEndingOf(['orsinium']).light);
  assert.equal(sdHeartColorOf({}), SD_FX_COLOR.heart);
  let t = T0;
  const s = { fi: 2, ph: 3, op: T0 - 60_000, ou: 0, su: 0, h: 100, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: null, clk: null, cx: null, fell: null, lost: 0, mk: ['underking', 'twin', 'short'] };
  const fx = createSdFx({ link: { state: () => s, now: () => t } });
  fx.frame();
  s.cx = { i: 9, m: 50, c: [[6, 0, 50]] }; t += 16; fx.frame();
  s.su = t + 8000; s.cx = null; t += 16; fx.frame();
  const b = fx.bursts(t);
  assert.ok(b.some((q) => q.kind === SD_FX_KINDS.heartRise && q.color === sdEndingOf(s.mk).light));
  assert.ok(b.some((q) => q.kind === SD_FX_KINDS.stun && q.color === sdEndingOf(s.mk).light));
  assert.ok(b.some((q) => q.kind === SD_FX_KINDS.heartBreak && q.color === sdEndingOf(s.mk).light));
});

test('SD18c ITS WORD: the taverns tell the omen its Ending sends - six of them, the bell where none is kept; its card on the held map says which Ending it keeps', () => {
  assert.equal(Object.keys(SD_ENDING_RUMOR).length, 6);
  assert.deepEqual(Object.keys(SD_ENDING_RUMOR), SD_ENDINGS.map((E) => E.id));
  assert.equal(new Set(SD_ENDINGS.map((E) => sdRumorLine('Wayrest', E.id))).size, 6);
  assert.equal(sdRumorLine('Wayrest', 'wayrest'), 'They say the air goes brass-coloured past the walls of Wayrest at dusk, and the tide comes in where there is no sea.');
  assert.match(sdRumorLine('Wayrest'), /a bell rings where there is no bell\.$/);
  // the slot's own, through the taverns and the map (the map card's line pinned whole by test/sd2c_omen.test.js)
  const O = readFileSync(new URL('../src/systems/sdOmen.js', import.meta.url), 'utf8');
  assert.match(O, /return sdRumorLine\(hollow\.site\.cityName \|\| 'the city', sdMarksOf\(rec\.s\)\[0\]\);/);
  assert.match(O, /const E = sdEndingOf\(sdMarksOf\(rec\.s\)\);/);
  assert.match(O, /\.\.\.\(E \? \[`It keeps the Ending of \$\{E\.stone\}`\] : \[\]\)/);
});
