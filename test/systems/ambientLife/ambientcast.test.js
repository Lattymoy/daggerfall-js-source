// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): who stands - the cast by hour, weather, season and climate, on
// DFU's AmbientEffectsPlayer presets (the birds seen fly when the birds are heard), in every province's climates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambientCast, climatePalette, AL_KINDS, AL_KIND_LIST, AL_BASE, AL_SHAPE, NO_CAST } from '../../../src/systems/ambientLife/ambientCast.js';
import { presetForExterior } from '../../../src/systems/ambientEffects.js';
import { CLIMATES } from '../../../src/formats/mapsTables.js';
import { BIOMES } from '../../../src/world/tamriel/tamrielBiomes.js';

const NOON = 12 * 60, MIDNIGHT = 0, DUSK_EVE = 17 * 60 + 30;
const cast = (o) => ambientCast({ minuteOfDay: NOON, weather: 'sunny', climate: CLIMATES.Woodlands, ...o });

test('AMBIENT-LIFE: a clear day in the woods, whole', () => {
  assert.deepEqual(cast({}), {
    flocks: 1, flockKind: 'starling', wanderers: 5, wanderKind: 'sparrow', perched: 8, perchKind: 'pigeon',
    soarers: 2, soarKind: 'hawk', bats: 0, runners: 5, runnerKind: 'squirrel', butterflies: 8, fireflies: 0, roost: false,
  });
});

test('AMBIENT-LIFE: a clear night in the woods - the bats and the fireflies, the roofs\' birds roosting, nothing else aloft', () => {
  assert.deepEqual(cast({ minuteOfDay: MIDNIGHT }), {
    flocks: 0, flockKind: 'starling', wanderers: 0, wanderKind: 'sparrow', perched: 4, perchKind: 'pigeon',
    soarers: 0, soarKind: 'hawk', bats: 4, runners: 5, runnerKind: 'squirrel', butterflies: 0, fireflies: 22, roost: true,
  });
});

test('AMBIENT-LIFE: the birds fly when DFU\'s ambience hears them - rain and storm put every flier down', () => {
  for (const weather of ['rain', 'thunder']) {
    assert.notEqual(presetForExterior(weather, false), 'sunnyDay', 'the reference: no bird calls in the rain');
    const c = cast({ weather });
    assert.deepEqual([c.flocks, c.wanderers, c.soarers, c.bats, c.butterflies, c.fireflies, c.runners], [0, 0, 0, 0, 0, 0, 0], weather);
    assert.equal(c.perched, 4, `${weather}: half the roofs' birds sit it out`);
  }
  for (const weather of ['sandstorm', 'ashfall']) assert.equal(cast({ weather }).wanderers, 0, `${weather}: the port's own falls ground them too`);
  // what DFU folds into a clear day still thins the air here
  assert.equal(cast({ weather: 'snow' }).wanderers, 3);
  assert.equal(cast({ weather: 'snow' }).runners, 0);
  assert.equal(cast({ weather: 'fog' }).butterflies, 0);
  assert.equal(cast({ weather: 'overcast' }).wanderers, AL_BASE.wanderers);
});

test('AMBIENT-LIFE: the bats come out the hour before dusk', () => {
  assert.equal(cast({ minuteOfDay: DUSK_EVE }).bats, 4);
  assert.equal(cast({ minuteOfDay: 16 * 60 }).bats, 0);
});

test('AMBIENT-LIFE: winter takes the insects and thins the runners and the soarers', () => {
  const w = cast({ winter: true });
  assert.deepEqual([w.butterflies, w.runners, w.soarers], [0, 2, 1]);
  assert.equal(cast({ minuteOfDay: MIDNIGHT, winter: true }).fireflies, 0);
});

test('AMBIENT-LIFE: each climate its own creatures', () => {
  const d = cast({ climate: CLIMATES.Desert });
  assert.deepEqual([d.flocks, d.soarKind, d.runnerKind, d.butterflies, d.perchKind], [0, 'vulture', 'lizard', 0, 'crow']);
  assert.deepEqual(climatePalette(CLIMATES.Desert2), climatePalette(CLIMATES.Desert));
  const o = cast({ climate: CLIMATES.Ocean });
  assert.deepEqual([o.flockKind, o.wanderKind, o.runnerKind], ['gull', 'gull', 'crab']);
  const h = cast({ climate: CLIMATES.HauntedWoodlands, minuteOfDay: MIDNIGHT });
  assert.deepEqual([h.bats, h.fireflies, h.runnerKind], [7, 0, 'rat']);
  assert.equal(cast({ climate: CLIMATES.Rainforest }).flockKind, 'parrot');
  assert.equal(cast({ climate: CLIMATES.Swamp, minuteOfDay: MIDNIGHT }).fireflies, 36);
  assert.equal(climatePalette(999), climatePalette(CLIMATES.Woodlands), 'an index no palette holds reads as the woods');
});

test('AMBIENT-LIFE: a town puts pigeons on its roofs and rats in its streets at night; water near brings gulls', () => {
  const t = cast({ town: true });
  assert.deepEqual([t.perched, t.perchKind], [12, 'pigeon']);
  assert.equal(cast({ town: true, climate: CLIMATES.HauntedWoodlands }).perchKind, 'crow', 'the haunted woods keep their crows');
  const n = cast({ town: true, minuteOfDay: MIDNIGHT });
  assert.deepEqual([n.runners, n.runnerKind], [7, 'rat']);
  const c = cast({ coast: true });
  assert.deepEqual([c.wanderKind, c.soarKind, c.perchKind], ['gull', 'gull', 'gull']);
  assert.equal(cast({ coast: true, town: true }).perchKind, 'pigeon', 'a port\'s roofs are the pigeons\'');
});

test('AMBIENT-LIFE: the player\'s density scales the cast, 0 stands nothing', () => {
  const z = cast({ density: 0 });
  for (const k of ['flocks', 'wanderers', 'perched', 'soarers', 'bats', 'runners', 'butterflies', 'fireflies']) assert.equal(z[k], 0, k);
  assert.equal(cast({ density: 2 }).wanderers, 10);
  assert.equal(cast({ density: 9 }).wanderers, 10, 'held to 2');
  assert.equal(cast({ density: NaN }).wanderers, 5, 'a bad number reads as 1');
  for (const k of ['flocks', 'wanderers', 'perched', 'runners', 'fireflies']) assert.equal(NO_CAST[k], 0, k);
});

test('AMBIENT-LIFE: past the Bay - every zone of every province reads a climate a palette holds, and its day has birds', () => {
  const provinces = new Set();
  for (const b of BIOMES) {
    provinces.add(b.province);
    assert.ok(Object.values(CLIMATES).includes(b.climate), `${b.province}: climate ${b.climate}`);
    assert.ok(b.climate === CLIMATES.Woodlands || climatePalette(b.climate) !== climatePalette(CLIMATES.Woodlands), `${b.province}'s ${b.climate} has its own palette`);
    const c = cast({ climate: b.climate });
    assert.ok(c.wanderers > 0 && c.perched > 0 && c.runners > 0, `${b.province}'s ${b.climate}: a day with birds and runners`);
  }
  assert.deepEqual([...provinces].sort(), ['BlackMarsh', 'Elsweyr', 'Hammerfell', 'HighRock', 'Imperial', 'Morrowind', 'Skyrim', 'Sumurset', 'Valenwood']);
  // the Bay's own woods and Skyrim's mountains, side by side
  assert.equal(cast({ climate: CLIMATES.Mountain }).soarKind, 'hawk');
  assert.equal(cast({ climate: CLIMATES.Mountain }).flockKind, 'crow');
});

test('AMBIENT-LIFE: the kinds - one id each, under the pass\'s sixteen, every name a key and every palette\'s kind real', () => {
  const ids = AL_KIND_LIST.map((k) => k.id);
  assert.deepEqual(ids, [...ids.keys()], 'ids 0..n-1, in order');
  assert.ok(ids.length <= 16);
  for (const [name, k] of Object.entries(AL_KINDS)) {
    assert.equal(k.name, name);
    assert.equal(k.a.length, 4); assert.equal(k.b.length, 4);
    assert.ok(k.colors.length > 0 && k.colors.every((c) => c.length === 3));
  }
  for (const c of Object.values(CLIMATES)) {
    const p = climatePalette(c);
    for (const name of [p.flock, p.wander, p.perch, p.soar, p.runner]) if (name) assert.ok(AL_KINDS[name], `${c}: ${name}`);
    assert.equal(AL_KINDS[p.runner].shape, AL_SHAPE.ground);
    assert.equal(AL_KINDS[p.wander].shape, AL_SHAPE.wing);
  }
});

// ---- AUDIT AMBIENT-LIFE: the cast's numbers held whole --------------------------------------------------------------
test('AUDIT AMBIENT-LIFE (A8, C3): a town\'s roofs are the climate\'s own town bird - pigeons, the rainforest\'s parrots, the haunted woods\' crows, the sea\'s gulls', () => {
  const at = Object.fromEntries(Object.entries(CLIMATES).map(([name, c]) => [name, cast({ climate: c, town: true }).perchKind]));
  assert.deepEqual(at, { Ocean: 'gull', Desert: 'pigeon', Desert2: 'pigeon', Mountain: 'pigeon', Rainforest: 'parrot', Swamp: 'pigeon', Subtropical: 'pigeon',
    MountainWoods: 'pigeon', Woodlands: 'pigeon', HauntedWoodlands: 'crow' });
  assert.equal(cast({ climate: CLIMATES.Mountain }).perchKind, 'crow', 'out of town the climate\'s own');
});

test('AUDIT AMBIENT-LIFE (A7, C7): snow, fog, a rainy night, a winter night and a doubled density, whole', () => {
  assert.deepEqual(cast({ weather: 'snow' }), { flocks: 1, flockKind: 'starling', wanderers: 3, wanderKind: 'sparrow', perched: 8, perchKind: 'pigeon',
    soarers: 1, soarKind: 'hawk', bats: 0, runners: 0, runnerKind: 'squirrel', butterflies: 0, fireflies: 0, roost: false });
  assert.deepEqual(cast({ weather: 'fog' }), { flocks: 1, flockKind: 'starling', wanderers: 3, wanderKind: 'sparrow', perched: 8, perchKind: 'pigeon',
    soarers: 1, soarKind: 'hawk', bats: 0, runners: 5, runnerKind: 'squirrel', butterflies: 0, fireflies: 0, roost: false });
  assert.deepEqual(cast({ weather: 'rain', minuteOfDay: MIDNIGHT }), { flocks: 0, flockKind: 'starling', wanderers: 0, wanderKind: 'sparrow', perched: 4,
    perchKind: 'pigeon', soarers: 0, soarKind: 'hawk', bats: 0, runners: 0, runnerKind: 'squirrel', butterflies: 0, fireflies: 0, roost: true });
  const wn = cast({ minuteOfDay: MIDNIGHT, winter: true });
  assert.deepEqual([wn.bats, wn.fireflies, wn.runners], [1, 0, 2]);
  const two = cast({ density: 2 });
  assert.deepEqual([two.flocks, two.wanderers, two.soarers, two.butterflies], [1, 10, 4, 16], 'one flock at most');
  assert.equal(cast({ climate: CLIMATES.Ocean, minuteOfDay: MIDNIGHT }).bats, 2, 'the sea\'s half the bats');
});

test('AUDIT AMBIENT-LIFE (C2): the cast\'s base counts and flock sizes are the record\'s', async () => {
  const { AL_FLOCK_SIZE } = await import('../../../src/systems/ambientLife/ambientCast.js');
  assert.deepEqual({ ...AL_BASE }, { flocks: 1, wanderers: 5, perched: 8, soarers: 2, bats: 4, runners: 5, butterflies: 8, fireflies: 28 });
  assert.deepEqual(JSON.parse(JSON.stringify(AL_FLOCK_SIZE)), { starling: [14, 26], crow: [6, 14], gull: [5, 10], parrot: [6, 12] });
  assert.deepEqual(Object.fromEntries(Object.entries(AL_KINDS).map(([n, k]) => [n, k.flush])),
    { sparrow: 9, starling: 14, crow: 14, pigeon: 8, gull: 12, parrot: 11, hawk: 25, vulture: 30, bat: 3, butterfly: 1.2, rat: 4.5, lizard: 4, squirrel: 5.5, crab: 3, firefly: 0 });
});
