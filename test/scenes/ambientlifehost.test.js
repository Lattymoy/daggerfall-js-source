// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): the creatures in a host - the switch and its door, the world a
// streaming host lends them, and THE FOUR HOSTS RULE's wiring: both exterior hosts build, step, draw and carry it.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { FEATURES } from '../../src/systems/features.js';
import { wildlifeDoor, wildlifeDensity, createAmbientLifeHost, streamedWorld, colliderRoof, builtBoxes } from '../../src/scenes/ambientLifeHost.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (p) => readFileSync(join(root, p), 'utf8');
afterEach(() => _resetForTests());
const seeded = (seed) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
const FLAT = { ground: () => 0, wet: () => false, roof: () => -Infinity, boxes: () => [] };

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

test('AMBIENT-LIFE: the host steps the creatures on an outdoor frame and lets them go when switched off', () => {
  let d = 1;
  const host = createAmbientLifeHost({ world: FLAT, random: seeded(1), density: () => d });
  for (let i = 0; i < 300; i++) host.frame(1 / 30, [0, 0, 0], 12 * 60, 'sunny', 231, false);
  assert.ok(host.drawn > 5, `${host.drawn} drawn`);
  assert.equal(host.cast.wanderers, 5);
  assert.equal(host.draw({}, [], [], [1, 1, 1]), false, 'no context, nothing drawn');
  d = 0;
  host.frame(1 / 30, [0, 0, 0], 12 * 60, 'sunny', 231, false);
  assert.equal(host.drawn, 0);
  assert.equal(host.life.live, 0);
});

test('AMBIENT-LIFE: the next host built lets the one before it go (a boot kills the loop that would)', () => {
  const first = createAmbientLifeHost({ world: FLAT, random: seeded(3), density: () => 1 });
  for (let i = 0; i < 60; i++) first.frame(1 / 30, [0, 0, 0], 12 * 60, 'sunny', 231, false);
  assert.ok(first.drawn > 0);
  createAmbientLifeHost({ world: FLAT, random: seeded(4), density: () => 1 });
  assert.equal(first.drawn, 0);
  first.frame(1 / 30, [0, 0, 0], 12 * 60, 'sunny', 231, false);
  assert.equal(first.drawn, 0, 'and it stands nothing again');
});

test('AMBIENT-LIFE: a frame that throws stops the creatures, never the host', () => {
  const host = createAmbientLifeHost({ world: { ...FLAT, ground: () => { throw new Error('no ground'); } }, random: seeded(2), density: () => 1 });
  const warn = console.warn; console.warn = () => {};
  try { for (let i = 0; i < 60; i++) host.frame(1 / 30, [0, 0, 0], 12 * 60, 'sunny', 231, false); } finally { console.warn = warn; }
  assert.equal(host.drawn, 0);
});

test('AMBIENT-LIFE: the streaming host\'s world - the sea, the lakes and the unbuilt ground are wet; the roofs are the collider\'s; the buildings move with their pixels', () => {
  const sea = 10;
  const heightAt = (x) => (x < 0 ? -Infinity : x < 100 ? 20 : 5);
  const tiles = { 50: 0, 60: 999 };
  const groundSampleAt = ([x]) => (x in tiles ? { tile: tiles[x] } : null);
  const rays = [];
  const collider = { raycast: (o, d, reach) => { rays.push([...o, ...d, reach]); return o[0] === 30 ? o[1] - 12 : Infinity; } };
  const built = new Map([['1,2', { px: 1, py: 2, buildings: [{ aabb: { min: [0, 0, 0], max: [4, 9, 6] } }] }], ['3,4', { px: 3, py: 4 }]]);
  const state = { pixelTranslation: (px, py, out) => { out[0] = px * 100; out[1] = 1; out[2] = py * 100; return out; } };
  const w = streamedWorld(heightAt, () => sea, groundSampleAt, collider, built, state);
  assert.equal(w.ground(50, 0), 20);
  assert.equal(w.wet(-5, 0), true, 'unbuilt');
  assert.equal(w.wet(150, 0), true, 'under the sea');
  assert.equal(w.wet(50, 0), true, 'a water tile');   // terrainSurface.js isOutdoorWaterTile: tile 0's index is water's
  assert.equal(w.wet(60, 0), false);
  assert.equal(w.wet(70, 0), false, 'no tile read: dry');
  assert.equal(w.roof(30, 0, 40), 12);
  assert.equal(w.roof(31, 0, 40), -Infinity);
  assert.deepEqual(rays[0], [30, 40, 0, 0, -1, 0, 160]);
  assert.deepEqual(w.boxes(), [{ min: [100, 1, 200], max: [104, 10, 206] }]);
  assert.equal(colliderRoof(collider, 5)(30, 0, 20), 12);
  assert.equal(rays.at(-1)[6], 5, 'its reach');
  assert.deepEqual(builtBoxes(() => [], () => {})(), []);
});

test('AMBIENT-LIFE: THE FOUR HOSTS RULE - both exterior hosts build it, step it, draw it with the opaque world; the floating origin carries it', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(host);
    assert.match(s, /const ambientLife = createAmbientLifeHost\(/, `${host} builds it`);
    assert.match(s, /ambientLife\.frame\(gamePaused\(\) \? 0 : dt \* \w+\(\), [^;]*ambientWord, /, `${host} steps it on the game's seconds, on the word DFU's ambience hears`);
    assert.match(s, /if \([^)]*ambientLife\.draw\(renderer, proj, view, renderer\.flatLightAt\([^;]*\)\) renderer\.markForeignPass\(\);/, `${host} draws it and marks the pass`);
  }
  const world = src('src/scenes/world.js');
  assert.match(world, /ambientLife\.offsetOrigin\(state\.initOffset\);/, 'a new world\'s origin');
  assert.match(world, /ambientLife\.offsetOrigin\(r\.offset\);/, 'a recentre');
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(src(host), /ambientLife/, `${host} stands none - no sky indoors`);
  assert.match(src('src/scenes/ambientLifeHost.js'), /worldModes\.js \(the interiors\) and\n\/\/ dungeonContext\.js \(the\s+dungeons\) build none/, 'and says so');
});
