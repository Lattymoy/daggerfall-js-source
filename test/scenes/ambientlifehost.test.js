// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): the creatures in a host - the switch, its door and its lane, the
// word the creatures read, the worlds the two hosts lend them, and THE FOUR HOSTS RULE's wiring.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { FEATURES } from '../../src/systems/features.js';
import { soundWeather } from '../../src/systems/weather/weatherFront.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { wildlifeDoor, wildlifeDensity, wildlifeWord, createAmbientLifeHost, streamedWorld, benchWorld, colliderRoof, builtBoxes } from '../../src/scenes/ambientLifeHost.js';
import { fakeGl } from '../render/fakeGl.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (p) => readFileSync(join(root, p), 'utf8');
afterEach(() => _resetForTests());
const seeded = (seed) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
const FLAT = { ground: () => 0, wet: () => false, roof: () => -Infinity, boxes: () => [] };
const NOON = 12 * 60;
const host = (o = {}) => createAmbientLifeHost({ enhanced: true, world: FLAT, random: seeded(1), density: () => 1, ...o });
const frames = (h, n, heard = 'sunny', weather = heard, climate = CLIMATES.Woodlands, minute = NOON) => {
  for (let i = 0; i < n; i++) h.frame(1 / 30, [0, 0, 0], minute, heard, weather, climate, false);
};

test('AMBIENT-LIFE: the door and the switch - on by default, the player\'s own online, `?wildlife=` over it', () => {
  assert.equal(wildlifeDoor(null), null);
  assert.equal(wildlifeDoor('off'), 'off');
  assert.equal(wildlifeDoor('on'), 1);
  assert.equal(wildlifeDoor('0.5'), 0.5);
  assert.equal(wildlifeDoor('7'), 2);
  assert.equal(wildlifeDoor('bees'), null);
  const row = FEATURES.find((f) => f.id === 'wildlife');
  assert.deepEqual({ ...row.control }, { store: 'prefs', key: 'ambientLife', initial: true, online: 'player' });
  assert.equal(wildlifeDensity(''), 1);
  setPref('ambientLife', false);
  assert.equal(wildlifeDensity(''), 0);
  assert.equal(wildlifeDensity('?wildlife=1.5'), 1.5, 'the door stands it whatever the switch');
  setPref('ambientLife', true);
  assert.equal(wildlifeDensity('?wildlife=off'), 0);
});

test('AMBIENT-LIFE: the host steps the creatures on the enhanced lane alone, and lets them go when switched off', () => {
  let d = 1;
  const h = host({ density: () => d });
  frames(h, 300);
  assert.ok(h.drawn > 5, `${h.drawn} drawn`);
  assert.equal(h.cast.wanderers, 5);
  assert.equal(h.draw({}, [], [], [0, 0, 0]), false, 'no context, nothing drawn');
  d = 0;
  frames(h, 1);
  assert.equal(h.drawn, 0);
  assert.equal(h.life.live, 0);
  const classic = host({ enhanced: false });
  frames(classic, 300);
  assert.equal(classic.life.live, 0, 'the classic lane stands none, as Windfall\'s');
});

test('AMBIENT-LIFE (AUDIT A1, B2, C1): a sandstorm and an ashfall ground the fliers though the ear hears a cloudy day', () => {
  // the producer: the front's ear turns the dry falls into a cloudy day
  assert.equal(soundWeather({ rain: 0, shown: 'sand' }, 'sandstorm'), 'cloudy');
  assert.equal(soundWeather({ rain: 0, shown: 'ash' }, 'ashfall'), 'cloudy');
  assert.equal(wildlifeWord('cloudy', 'sandstorm'), 'sandstorm');
  assert.equal(wildlifeWord('cloudy', 'ashfall'), 'ashfall');
  assert.equal(wildlifeWord('rain', 'cloudy'), 'rain', 'the ear\'s word otherwise: a rain still falling under the front');
  for (const weather of ['sandstorm', 'ashfall']) {
    const h = host();
    frames(h, 60, 'cloudy', weather, CLIMATES.Desert);
    assert.deepEqual([h.cast.wanderers, h.cast.soarers, h.cast.runners], [0, 0, 0], weather);
  }
  const clear = host();
  frames(clear, 60, 'cloudy', 'cloudy', CLIMATES.Desert);
  assert.ok(clear.cast.wanderers > 0, 'and a cloudy day is a day');
});

test('AMBIENT-LIFE: the next host built lets the one before it go (a boot kills the loop that would)', () => {
  const first = host({ random: seeded(3) });
  frames(first, 60);
  assert.ok(first.drawn > 0);
  host({ random: seeded(4) });
  assert.equal(first.drawn, 0);
  frames(first, 1);
  assert.equal(first.drawn, 0, 'and it stands nothing again');
  assert.match(src('src/scenes/ambientLifeHost.js'), /else if \(gl\) releasePrograms\(gl, AMBIENT_LIFE_PROGRAMS\);/, 'a compile started and never taken is let go');
});

test('AMBIENT-LIFE: a frame or a draw that throws stops the creatures, never the host', () => {
  const warn = console.warn; console.warn = () => {};
  try {
    const h = host({ world: { ...FLAT, ground: () => { throw new Error('no ground'); } } });
    frames(h, 60);
    assert.equal(h.drawn, 0);
    const gl = fakeGl(), d = host({ gl });
    frames(d, 120);
    const r = { _camPos: [0, 0, 0], _fogColor: [0, 0, 0], flatLightAt: () => { throw new Error('no light'); }, worldViewportPx: [0, 0, 100, 100] };
    for (let i = 0; i < 4 && !d.draw(r, new Float32Array(16), new Float32Array(16), [0, 0, 0]); i++);   // the pass compiles at its first ask
    assert.equal(d.drawn, 0, 'broken: it stands nothing more');
  } finally { console.warn = warn; }
});

test('AMBIENT-LIFE: the streaming host\'s world - the sea, the lakes and the unbuilt ground are wet, the fliers\' ground over the carved sea is the sea\'s top, the roofs are the collider\'s, the buildings move with their pixels', () => {
  const sea = 10;
  const heightAt = (x) => (x < 0 ? -Infinity : x < 100 ? 20 : -40);   // past 100 m Deep Waters' seafloor, 50 m under the sea
  const tiles = { 50: 0, 60: 999 };
  const groundSampleAt = ([x]) => (x in tiles ? { tile: tiles[x] } : null);
  const rays = [];
  const collider = { raycastHit: (o, d, reach, filter, out) => { rays.push([...o, ...d, reach, filter, out]); out.dist = o[0] === 30 ? o[1] - 12 : Infinity; return out; } };
  const built = new Map([['1,2', { px: 1, py: 2, buildings: [{ aabb: { min: [0, 0, 0], max: [4, 9, 6] } }] }], ['3,4', { px: 3, py: 4 }]]);
  const state = { pixelTranslation: (px, py, out) => { out[0] = px * 100; out[1] = 1; out[2] = py * 100; return out; } };
  const w = streamedWorld(heightAt, () => sea, groundSampleAt, collider, built, state);
  assert.equal(w.ground(50, 0), 20);
  assert.equal(w.ground(150, 0), sea, 'over the carved sea a flier flies over the water, never under it');
  assert.equal(w.ground(-5, 0), -Infinity, 'and unbuilt ground stays unbuilt');
  assert.equal(w.wet(-5, 0), true, 'unbuilt');
  assert.equal(w.wet(150, 0), true, 'under the sea');
  assert.equal(w.wet(50, 0), true, 'a water tile');   // terrainSurface.js isOutdoorWaterTile: tile 0's index is water's
  assert.equal(w.wet(60, 0), false);
  assert.equal(w.wet(70, 0), false, 'no tile read: dry');
  assert.equal(w.roof(30, 0, 40), 12);
  assert.equal(w.roof(31, 0, 40), -Infinity);
  assert.deepEqual(rays[0].slice(0, 8), [30, 40, 0, 0, -1, 0, 160, null]);
  assert.equal(rays[0][8], rays[1][8], 'one ray answer, kept and written over');
  assert.deepEqual(w.boxes(), [{ min: [100, 1, 200], max: [104, 10, 206] }]);
  assert.equal(colliderRoof(collider, 5)(30, 0, 20), 12);
  assert.equal(rays.at(-1)[6], 5, 'its reach');
  assert.deepEqual(builtBoxes(() => [], () => {})(), []);
});

test('AMBIENT-LIFE (AUDIT C15): the fixed city\'s world reads its tilemap\'s water', () => {
  const b = benchWorld(() => 0, (x) => (x < 0 ? null : x < 10 ? 0 : 999), { raycastHit: (o, d, r, f, out) => { out.dist = Infinity; return out; } }, () => []);
  assert.equal(b.wet(5, 0), true);
  assert.equal(b.wet(15, 0), false);
  assert.equal(b.wet(-5, 0), false, 'off the town: no tile, no water');
  const e = src('src/scenes/exterior.js');
  assert.match(e, /world: benchWorld\(\(x, z\) => collider\.heightAt\(x, z\), \(x, z\) => tileUnder\(x, z\), collider, /);
  assert.match(e, /return tx < 0 \|\| ty < 0 \|\| tx >= tilemapDim \|\| ty >= tilemapDim \? null : locationTilemap\[tx \+ ty \* tilemapDim\];/);
});

test('AMBIENT-LIFE: THE FOUR HOSTS RULE - both exterior hosts build it on the enhanced lane, step it, draw it; the world host never under the travel view, its lights after the blended passes, and the floating origin carries it', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(h);
    assert.match(s, /const ambientLife = createAmbientLifeHost\(\{ gl: renderer\.gl, enhanced: !!sky\.enhanced, world: /, `${h} builds it on the enhanced lane`);
    assert.match(s, /ambientLife\.frame\(gamePaused\(\) \? 0 : dt \* \w+\(\), [^;]*ambientWord, weather, /, `${h} steps it on the game's seconds, the ear's word and the world's`);
  }
  const world = src('src/scenes/world.js');
  assert.match(world, /if \(!tvf\) ambientLife\.frame\(/, 'the world host steps none under the travel view');
  assert.match(world, /if \(!tvf && ambientLife\.draw\(renderer, proj, view, walkMode && playerSpawned \? player\.pos : cam\.pos, false\)\) renderer\.markForeignPass\(\);/, 'nor draws its bodies there, and holds back the lights');
  const lights = world.indexOf('if (!tvf && ambientLife.drawLights(renderer, proj, view)) renderer.markForeignPass();');
  assert.ok(lights > world.indexOf('renderer.drawHeld(camRight, bbUp);') && lights > world.indexOf('drawVeiledPeerBodies();   // INVIS-LOOK'), 'the lights after the blended flats and the veiled bodies');
  assert.ok(world.indexOf('ambientLife.draw(renderer') < world.indexOf('if (hz.visible && !tvf && hazeGl.draw('), 'the bodies before the haze bends the opaque world');
  assert.match(src('src/scenes/exterior.js'), /if \(ambientLife\.draw\(renderer, proj, view, walkMode \? player\.pos : cam\.pos\)\) renderer\.markForeignPass\(\);/, 'the bench draws bodies and lights at once, after its people');
  assert.match(world, /ambientLife\.offsetOrigin\(state\.initOffset\);/, 'a new world\'s origin');
  assert.match(world, /ambientLife\.offsetOrigin\(r\.offset\);/, 'a recentre');
  for (const h of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(src(h), /ambientLife/, `${h} stands none`);
  assert.match(src('src/scenes/ambientLifeHost.js'), /worldModes\.js \(the\n\/\/ interiors and the made levels\) and dungeonContext\.js \(the dungeons\) build none/, 'and says so');
});

test('AUDIT AMBIENT-LIFE (A13): the host reads the town before the first cast - a town\'s roofs from its first frame', () => {
  const houses = [];
  for (let i = -2; i <= 2; i++) houses.push({ min: [i * 25 - 5, 0, -4], max: [i * 25 + 5, 9, 4] });
  const h = host({ world: { ...FLAT, boxes: () => houses } });
  frames(h, 1);
  assert.deepEqual([h.cast.perched, h.cast.perchKind], [12, 'pigeon']);
});
