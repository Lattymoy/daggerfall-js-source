// VALENWOOD-CANOPY (2026-10-24, bible/03-World/Tamriel-Biomes.md "Valenwood's closed canopy"; the owner: "i want
// valenwood to have no sky like the trees will cover it up") - Valenwood's forest stands the jungle under a closed canopy:
// the zones, the canopy's law (world/jungle/jungleCanopy.js), the jungle's host's frame, and the wiring of the water's
// sky and the world host's light. GRAHT1 (bible/03-World/Graht-Oaks.md) retired the ceiling of leaves (render/canopySky.js)
// for the graht-oaks themselves - their pins are test/world/graht1_oaks.test.js; the ceiling's two tests went with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIOMES, tamrielBiomeAt } from '../../src/world/tamriel/tamrielBiomes.js';
import { CITIES } from '../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay } from '../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import {
  JUNGLE_CANOPY, canopyShare, canopyUnder, createCanopyState, stepCanopy, canopyLight, canopyKey, canopyMoon, canopyFog,
  canopyLeaves, canopyWaterSky,
} from '../../src/world/jungle/jungleCanopy.js';
import { createJungleHost } from '../../src/scenes/jungleHost.js';
import { TERRAIN_SIZE as PIXEL_M } from '../../src/world/terrain/terrainSampler.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const pixelOf = (name) => pictureToBay(...CITIES.find((c) => c.name === name).at).map(Math.floor);

test('VALENWOOD-CANOPY: Valenwood\'s forest - Grahtwood, Malabal Tor, Greenshade - stands the jungle under a closed canopy; Reaper\'s March and every other zone keep the sky', () => {
  const canopy = BIOMES.filter((b) => b.canopy).map((b) => b.key).sort();
  assert.deepEqual(canopy, ['valenwoodGrahtwood', 'valenwoodGreenshade', 'valenwoodMalabal']);
  for (const b of BIOMES) if (b.canopy) assert.equal(b.jungle, true, `${b.key}: the canopy is the jungle's crowns`);
  const march = BIOMES.find((b) => b.key === 'valenwoodReapersMarch');
  assert.ok(!march.canopy && !march.jungle, 'the forest gives way to the plains');
  setTamrielTrace(null);
  assert.equal(tamrielBiomeAt(...pixelOf('Elden Root'))?.canopy, true, 'Elden Root under the leaves');
  assert.equal(tamrielBiomeAt(...pixelOf('Woodhearth'))?.canopy, true, 'and Woodhearth\'s mangroves');
  assert.ok(!tamrielBiomeAt(...pixelOf('Arenthia'))?.canopy, 'Arenthia under the sky');
  assert.ok(!tamrielBiomeAt(...pixelOf('Leyawiin'))?.canopy, 'Cyrodiil\'s jungle under the sky');
});

test('VALENWOOD-CANOPY: the law - the share across the line, under the crowns\' underside to their tops, eased and snapped; the light, the moon, the fog and the water under it', () => {
  // PIN MOVED (GRAHT1): the canopy's top is the graht-oaks' - their crowns' underside (80 m) to their tops (190 m); it was
  // the emergents' 34 and 18 over them
  assert.deepEqual([JUNGLE_CANOPY.edge.out, JUNGLE_CANOPY.edge.in, JUNGLE_CANOPY.height, JUNGLE_CANOPY.above], [0, 600, 80, 110]);
  assert.deepEqual([canopyShare(-10), canopyShare(0), canopyShare(300), canopyShare(600), canopyShare(5000)], [0, 0, 0.5, 1, 1]);
  assert.deepEqual([canopyUnder(1.7), canopyUnder(80), canopyUnder(135), canopyUnder(190), canopyUnder(448), canopyUnder(NaN)], [1, 1, 0.5, 0, 0, 1]);
  const s = createCanopyState();
  stepCanopy(s, { dt: 0.016, eye: [0, 0, 0], target: 1 });
  assert.equal(s.w, 1, 'the first frame snaps');
  stepCanopy(s, { dt: JUNGLE_CANOPY.lag, eye: [5, 0, 0], target: 0 });
  assert.ok(Math.abs(s.w - Math.exp(-1)) < 1e-12, 'one lag: 1/e of the way left');
  stepCanopy(s, { dt: 0.016, eye: [5 + JUNGLE_CANOPY.jump + 1, 0, 0], target: 1 });
  assert.equal(s.w, 1, 'a jump snaps');
  stepCanopy(s, { dt: 30, eye: [300, 0, 0], target: 0 });   // 44 m on: a walk, not a jump
  assert.equal(s.w, 0, 'a fade\'s tail is none, not a ceiling drawn at a millionth');
  // the light
  const amb = new Float32Array([0.5, 0.6, 0.7]);
  assert.equal(canopyLight(amb, 0), amb, 'no canopy: the same light');
  assert.equal(canopyLight(amb, undefined), amb, 'no jungle host: the same light');
  const under = canopyLight(amb, 1);
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(under[c] - amb[c] * (1 - JUNGLE_CANOPY.ambient) * JUNGLE_CANOPY.tint[c]) < 1e-6);
  assert.ok(under[1] > under[0] * (amb[1] / amb[0]) - 1e-6, 'leaned green');
  assert.equal(canopyKey(0), 1);
  assert.ok(Math.abs(canopyKey(1) - (1 - JUNGLE_CANOPY.key)) < 1e-12, 'the sun\'s key taken');
  assert.equal(canopyKey(undefined), 1);
  const moon = { scale: 0.4, dir: [0, 1, 0], color: new Float32Array([0.6, 0.7, 0.9]) };
  assert.equal(canopyMoon(moon, 0), moon);
  assert.equal(canopyMoon(null, 1), null);
  const m = canopyMoon(moon, 1);
  assert.ok(Math.abs(m.scale - 0.4 * (1 - JUNGLE_CANOPY.key)) < 1e-12 && m.dir === moon.dir, 'the moon\'s key with the sun\'s');
  assert.ok(Math.abs(m.color[0] - 0.6 * JUNGLE_CANOPY.tint[0]) < 1e-6, 'its colour leaned, not dimmed twice');
  const fog = canopyFog([0.8, 0.8, 0.8], 1);
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(fog[c] - 0.8 * (1 - JUNGLE_CANOPY.fog) * JUNGLE_CANOPY.tint[c]) < 1e-6, 'the air under the leaves');
  // PIN MOVED (GRAHT1): the leaves the water mirrors (canopyLeaves) - the ceiling's eight uniforms (its eye's place, its
  // height, its open share) retired with it: the leaves lit by the fog, the weight
  const u = canopyLeaves(0.7, [0.5, 0.5, 0.5]);
  assert.equal(u.length, 4);
  assert.ok(Math.abs(u[0] - 0.5 * JUNGLE_CANOPY.leaf[0]) < 1e-6 && Math.abs(u[3] - 0.7) < 1e-6);
  assert.equal(canopyLeaves(3, [9, 9, 9])[3], 1, 'the weight held to 1');
  // the water's sky
  const ws = { zenith: [0.3, 0.5, 0.9], horizon: [0.7, 0.8, 0.9] };
  assert.equal(canopyWaterSky(ws, null), ws);
  assert.equal(canopyWaterSky(ws, canopyLeaves(0, [1, 1, 1])), ws);
  const wsu = canopyWaterSky(ws, canopyLeaves(1, [1, 1, 1]));
  assert.deepEqual(wsu.zenith.map((v) => +v.toFixed(5)), JUNGLE_CANOPY.leaf.map((v) => +v.toFixed(5)), 'the zenith the leaves\'');
});

test('VALENWOOD-CANOPY: the jungle\'s host - the share at the camera\'s eye off the canopy zones, under the crowns; the leaves sent for the water, the fog dimmed, taken back where it has gone, with the haze off too', () => {
  const zone = (x, y) => (x >= 20 && x < 60 && y >= 20 && y < 60 ? { jungle: true, canopy: true } : x >= 60 && x < 80 && y >= 20 && y < 60 ? { jungle: true } : null);
  const sent = [];
  const sky = { setCanopy: (v) => sent.push(v ? Array.from(v) : null), setHazeSky() {} };
  let stamp = 1, moved = false;
  const zoneNow = (x, y) => (moved && x < 40 ? null : zone(x, y));
  const mk = (haze, zoneAt = zone) => createJungleHost({ renderer: { _focus: new Float32Array(4), setJungleHaze() {} }, maps: {}, insideAt: () => false, mapWidth: 4, mapHeight: 4,
    stateOf: () => ({ mapOrigin: { x: 0, y: 0 }, compensation: [0, 0, 0], pixelTranslation: (px, py, o = [0, 0, 0]) => { o[0] = px * PIXEL_M; o[1] = 0; o[2] = -py * PIXEL_M; return o; } }),
    builtOf: () => new Map(), heightAt: () => 0, haze, trees: { door: true }, zoneAt, version: () => stamp });
  const eyeAt = (px, py, y = 1.7) => [(px + 0.5) * PIXEL_M, y, -(py - 0.5) * PIXEL_M];
  const frame = (h, eye, dt = 0.016) => h.haze({ fogColor: new Float32Array([0.8, 0.8, 0.8]), fogRow: null, eye, dt, minute: 720, weather: 'sunny', sky });
  const host = mk(true);
  assert.ok(host.job(40, 40) && host.job(70, 40), 'Valenwood\'s zones and the jungle beside them stand the trees');
  const c = frame(host, eyeAt(40, 40));
  assert.equal(host.canopy, 1, 'deep in it, on the ground: whole');
  const last = sent.at(-1);
  assert.equal(last.length, 4, 'PIN MOVED (GRAHT1): the leaves alone - no ceiling\'s uniforms');
  assert.equal(last[3], 1, 'the leaves\' weight sent');
  assert.ok(c[0] < 0.8 * (1 - JUNGLE_CANOPY.fog) + 0.05 && c[1] > c[0], 'the fog dimmed and greened under the leaves');
  assert.ok(Math.abs(last[1] / c[1] - JUNGLE_CANOPY.leaf[1]) < 1e-5, 'the leaves lit by that air');
  frame(host, eyeAt(70, 40), 1e6);
  assert.equal(host.canopy, 0, 'the jungle with no canopy: the sky');
  assert.equal(sent.at(-1), null, 'the leaves taken back');
  frame(host, eyeAt(40, 40), 0.016);
  frame(host, eyeAt(40, 40), 1e6);
  assert.equal(host.canopy, 1);
  frame(host, eyeAt(40, 40, 60), 1e6);
  assert.equal(host.canopy, 1, 'PIN MOVED (GRAHT1): an eye 60 m up stands under the graht-oaks\' crowns');
  frame(host, eyeAt(40, 40, 200), 1e6);
  assert.equal(host.canopy, 0, 'an eye over the crowns - the travel view\'s - looks down on them under the sky');
  const bare = mk(false);
  frame(bare, eyeAt(40, 40));
  assert.equal(bare.canopy, 1, 'the haze off (?junglehaze=off): the canopy is the trees\', not the air\'s');
  assert.equal(sent.at(-1)[3], 1);
  frame(bare, eyeAt(200, 200), 1e6);
  assert.equal(bare.canopy, 0);
  assert.equal(sent.at(-1), null);
  // the canopy's field is made again when the zones' stamp moves (the trace landing, a fit), as the jungle's is
  const land = mk(true, zoneNow);
  frame(land, eyeAt(22, 40), 1e6);
  assert.ok(land.canopy > 0.9, 'on the land as it was: under it');
  moved = true;
  frame(land, eyeAt(22, 40), 1e6);
  assert.ok(land.canopy > 0.9, 'the stamp unmoved: the field kept');
  stamp++;
  frame(land, eyeAt(22, 40), 1e6);
  assert.equal(land.canopy, 0, 'the stamp moved: the canopy read off the land as it is');
});

test('VALENWOOD-CANOPY: the wiring - the sky controller keeps the leaves for the water, which mirrors them, and draws no ceiling; the world host leans its light by the canopy and hands the jungle\'s host the zones', () => {
  const sh = read('src/scenes/shared.js');
  // PIN MOVED (GRAHT1): no ceiling drawn over any sky - the graht-oaks' crowns stand in the world
  assert.doesNotMatch(sh, /canopySky|CanopySkyRenderer|canopyPass/, 'the ceiling retired');
  assert.match(sh, /if \(sunbabyW > 0\) sunbabySky\?\.draw\(yaw, pitch, fovY, aspect\);[^\n]*\n\s+meter\?\.mark\('world'\);/, 'the sun baby\'s sky the last over the dome');
  assert.match(sh, /const leaved = \(ws\) => canopyWaterSky\(ws, canopyLeaves\);/, 'the water\'s sky');
  assert.equal(sh.match(/return leaved\(dreaded\(\{/g)?.length, 2, 'on either lane');
  assert.match(sh, /setCanopy\(v\) \{\n\s+if \(v && v\[3\] > 0\) canopyLeaves\.set\(v\);\n\s+else canopyLeaves\[3\] = 0;/, 'the host\'s leaves kept, and taken back');
  const w = read('src/scenes/world.js');
  assert.match(w, /canopyLight\(etherLight\(sdBrassLight\(sunbabyLight\(/, 'the ambient');
  assert.match(w, /\* \(1 - DREAD_KEY_DIM \* skyDreadW\) \* canopyKey\(jungle\?\.canopy\),/, 'the key');
  assert.match(w, /canopyLight\(etherLight\(sdBrassLight\(sunbabyKey\([^\n]*jungle\?\.canopy, 0\)\);/, 'the key\'s colour');
  assert.match(w, /renderer\.setMoonlight\(canopyMoon\(/, 'the moon');
  assert.match(w, /zoneAt: tamrielLand \? tamrielBiomeAt : null,/, 'the zones');
});
