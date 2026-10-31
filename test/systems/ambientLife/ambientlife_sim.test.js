// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): the creatures' sim on a made town - gabled houses whose ridges
// stand 9 m up, a lake to the east - read through the same AmbientWorld a host lends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AmbientLife, AL_JUMP_M } from '../../../src/systems/ambientLife/ambientLife.js';
import { ambientCast, AL_KINDS, NO_CAST } from '../../../src/systems/ambientLife/ambientCast.js';
import { AL_INSTANCE_FLOATS, AL_MAX_INSTANCES } from '../../../src/systems/ambientLife/ambientBody.js';
import { BIRD, FLOCK, Flock, AL_FLIGHT, flushRadius } from '../../../src/systems/ambientLife/ambientFlight.js';
import { RUNNER } from '../../../src/systems/ambientLife/ambientGround.js';

const seeded = (seed) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
const RIDGE = 9, LAKE_X = 70;
/** Houses 10 x 8 m every 25 m, the ridge along x at RIDGE, the roof falling 0.75 m a metre to the eaves. */
function town() {
  const houses = [];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (i || j) houses.push([i * 25, j * 25]);
  const roofAt = (x, z) => { for (const [cx, cz] of houses) if (Math.abs(x - cx) <= 5 && Math.abs(z - cz) <= 4) return RIDGE - Math.abs(z - cz) * 0.75; return -Infinity; };
  let rays = 0;
  return {
    houses, roofAt, rays: () => rays,
    world: {
      ground: () => 0,
      wet: (x) => x > LAKE_X,
      roof: (x, z, top) => { rays++; const h = roofAt(x, z); return h <= top ? h : -Infinity; },
      boxes: () => houses.map(([cx, cz]) => ({ min: [cx - 5, 0, cz - 4], max: [cx + 5, RIDGE, cz + 4] })),
    },
  };
}
const castAt = (life, o = {}) => ambientCast({ minuteOfDay: 12 * 60, weather: 'sunny', climate: 231, town: life.town, coast: life.coast, ...o });
function run(life, seconds, feet, o = {}, step = 1 / 30) {
  for (let t = 0; t < seconds; t += step) life.step(step, typeof feet === 'function' ? feet(t) : feet, castAt(life, o));
}

test('AMBIENT-LIFE: the roofs fill with birds sitting on the ridges, facing across them', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(3) });
  run(life, 20, [0, 0, 0]);
  const perched = life.flight.birds.filter((b) => b.state === BIRD.perch);
  assert.ok(perched.length >= 8, `${perched.length} on the roofs`);
  for (const b of perched) {
    assert.ok(Math.abs(b.y - T.roofAt(b.x, b.z)) < 0.13, `on the roof: ${b.y} vs ${T.roofAt(b.x, b.z)}`);
    assert.ok(b.y > RIDGE - 0.2, `at the ridge: ${b.y}`);
    assert.ok(Math.abs(Math.cos(b.yaw)) > Math.cos(0.65), `looking about across the ridge, never along it (yaw ${b.yaw})`);
  }
  const across = life.flight.sites.filter((s) => Math.abs(Math.cos(s.yaw)) > 0.999).length;
  assert.ok(across >= life.flight.sites.length * 0.8, `${across} of ${life.flight.sites.length} perches face across their ridge`);
  assert.ok(life.town, 'the boxes say a town');
  assert.ok(life.flight.sites.length <= AL_FLIGHT.sitesMax);
});

test('AMBIENT-LIFE: a bird on a roof leaves as the player comes near, and its neighbours go a moment after it', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(5) });
  run(life, 20, [0, 0, 0]);
  const b = life.flight.birds.find((q) => q.state === BIRD.perch && life.flight.birds.some((n) => n !== q && n.state === BIRD.perch && Math.hypot(n.x - q.x, n.z - q.z) < AL_FLIGHT.flushNeighbour));
  assert.ok(b, 'two birds on one roof');
  const site = b.site;
  const near = [b.x + 3, b.y - 1, b.z];
  life.step(1 / 30, near, castAt(life));
  assert.equal(b.state, BIRD.pending);
  const neighbours = life.flight.birds.filter((n) => n !== b && n.state === BIRD.pending);
  assert.ok(neighbours.length >= 1, 'the neighbours are told');
  run(life, 1, near);
  assert.equal(b.state, BIRD.flee);
  assert.ok(b.y > site.y + 1, 'up and away');
  assert.equal(site.bird, null);
  assert.ok(site.rest > life.flight.clock, 'the perch rests before another lands');
  for (const n of neighbours) assert.notEqual(n.state, BIRD.perch);
});

test('AMBIENT-LIFE: a perch that goes (a ship sails, a town is rebuilt) takes its bird with it - no bird sits on air', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(13) });
  run(life, 20, [0, 0, 0]);
  const b = life.flight.birds.find((q) => q.state === BIRD.perch);
  const [cx, cz] = T.houses.find(([x, z]) => Math.abs(b.x - x) <= 5 && Math.abs(b.z - z) <= 4);
  T.houses.splice(T.houses.findIndex(([x, z]) => x === cx && z === cz), 1);
  run(life, 1.2, [0, 0, 0]);
  assert.notEqual(b.state, BIRD.perch);
  assert.ok(!life.flight.sites.some((s) => Math.abs(s.x - cx) <= 5 && Math.abs(s.z - cz) <= 4 && s.bird?.state === BIRD.perch), 'no perch left on the house that went');
});

test('AMBIENT-LIFE: night\'s roost lets the player nearer, a run sends them sooner', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(9) });
  run(life, 20, [0, 0, 0], { minuteOfDay: 0 });
  const b = life.flight.birds.find((q) => q.state === BIRD.perch);
  life.flight.birds = [b];   // alone on the roofs: no neighbour's flight takes it
  const day = { roost: false }, night = { roost: true };
  assert.equal(flushRadius(b, night, { fast: false }), b.kind.flush * AL_FLIGHT.roostFlush);
  assert.equal(flushRadius(b, day, { fast: true }), b.kind.flush * AL_FLIGHT.fastFlush);
  life.step(1 / 30, [b.x + b.kind.flush * 0.8, b.y - 1, b.z], castAt(life, { minuteOfDay: 0 }));
  assert.equal(b.state, BIRD.perch, 'a roosting bird stays at four fifths of its day\'s distance');
  life.step(1 / 30, [b.x + b.kind.flush * 0.5, b.y - 1, b.z], castAt(life, { minuteOfDay: 0 }));
  assert.equal(b.state, BIRD.pending, 'and goes at half');
});

test('AMBIENT-LIFE: runners keep off the water and out from under the roofs, and run from the player', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(11) });
  let worst = 0;
  for (let t = 0; t < 40; t += 1 / 30) {
    life.step(1 / 30, [50, 0, 12], castAt(life));
    for (const r of life.ground.runners) {
      assert.ok(r.x <= LAKE_X + 0.01, `a runner in the lake at ${r.x}`);
      assert.ok(!Number.isFinite(T.roofAt(r.x, r.z)), `a runner under a roof at ${r.x}, ${r.z}`);
      worst = Math.max(worst, r.state);
    }
  }
  assert.ok(life.ground.runners.length > 0);
  const r = life.ground.runners.find((q) => q.state === RUNNER.idle) ?? life.ground.runners[0];
  r.state = RUNNER.idle; r.t = 5;
  const feet = [r.x + 1, 0, r.z];
  const before = Math.hypot(r.x - feet[0], r.z - feet[2]);
  run(life, 1, feet);
  assert.ok(r.gone || r.state === RUNNER.burrow || Math.hypot(r.x - feet[0], r.z - feet[2]) > before + 2, 'it bolts, or slips into a crack');
});

test('AMBIENT-LIFE: a flock gathers out of scattered birds, and bursts up off the ground when the player comes', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(21) });
  const fl = life.flight;
  const flock = new Flock(fl, AL_KINDS.starling, [0, 0, 0]);
  flock.life = 1e9; fl.flocks.push(flock);
  const spread = () => {
    const m = flock.members, c = [0, 1, 2].map((k) => m.reduce((s, b) => s + [b.x, b.y, b.z][k], 0) / m.length);
    return m.reduce((s, b) => s + Math.hypot(b.x - c[0], b.y - c[1], b.z - c[2]), 0) / m.length;
  };
  const first = spread();
  run(life, 14, [0, 0, 0]);
  assert.ok(spread() < first * 0.5, `the flock draws together: ${first.toFixed(1)} -> ${spread().toFixed(1)}`);
  // down to feed in the open, past the houses
  flock.mode = FLOCK.land; flock.t = 25; flock.life = 1e9;
  const R = seeded(23);
  for (const b of flock.members) { b.tx = -40 + R(); b.tz = 40.5; b.ty = 0; }
  flock.ax = -40; flock.az = 40.5; flock.ay = 0;
  for (let t = 0; t < 30 && flock.mode !== FLOCK.ground; t += 1 / 30) life.step(1 / 30, [0, 0, 0], castAt(life));
  assert.equal(flock.mode, FLOCK.ground);
  assert.ok(flock.members.every((b) => b.state === 2 && b.y < 0.2), 'every bird on the ground');
  run(life, 1.5, [-35, 0, 40.5]);
  assert.equal(flock.mode, FLOCK.sky);
  assert.ok(flock.members.every((b) => b.state === 0 && b.y > 1), 'up all at once');
});

test('AMBIENT-LIFE: the floating origin moves every creature, perch and anchor with the land; a jump starts afresh', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(31) });
  run(life, 15, [0, 0, 0]);
  const o = [819.2, -3, -1638.4];
  const before = [...life.flight.bodies(), ...life.ground.runners].map((b) => [b.x, b.y, b.z]);
  const sites = life.flight.sites.map((s) => [s.x, s.y, s.z]);
  life.offset(o);
  const after = [...life.flight.bodies(), ...life.ground.runners].map((b) => [b.x, b.y, b.z]);
  after.forEach((p, i) => p.forEach((v, k) => assert.ok(Math.abs(v - before[i][k] - o[k]) < 1e-9)));
  life.flight.sites.forEach((s, i) => [s.x, s.y, s.z].forEach((v, k) => assert.ok(Math.abs(v - o[k] - sites[i][k]) < 1e-9)));
  life.step(1 / 30, o, castAt(life));
  assert.ok(life.live > 0, 'the shifted player is no jump');
  life.step(1 / 30, [o[0] + AL_JUMP_M + 1, o[1], o[2]], castAt(life));
  assert.equal(life.flight.birds.filter((b) => b.state === BIRD.perch).length, 0, 'a door or a travel clears the roofs');
  assert.equal(life.flight.sites.length, 0);
});

test('AMBIENT-LIFE: the instances - finite, the bodies before the lights, the lights only at night', () => {
  const T = town(), out = new Float32Array(AL_MAX_INSTANCES * AL_INSTANCE_FLOATS);
  const day = new AmbientLife(T.world, { random: seeded(41) });
  run(day, 20, [0, 0, 0]);
  const d = day.write(out);
  assert.ok(d.solid > 15 && d.glow === 0, JSON.stringify(d));
  for (let i = 0; i < d.solid * AL_INSTANCE_FLOATS; i++) assert.ok(Number.isFinite(out[i]), `float ${i}`);
  const night = new AmbientLife(T.world, { random: seeded(43) });
  run(night, 20, [-30, 0, 12], { minuteOfDay: 0 });
  const n = night.write(out);
  assert.ok(n.glow > 0, 'fireflies blinking');
  for (let i = n.solid; i < n.solid + n.glow; i++) assert.equal(out[i * AL_INSTANCE_FLOATS + 10], AL_KINDS.firefly.id);
  const none = new AmbientLife(T.world, { random: seeded(45) });
  none.step(1 / 30, [0, 0, 0], NO_CAST);
  assert.deepEqual(none.write(out), { solid: 0, glow: 0 });
});

test('AMBIENT-LIFE: the roofs are found for a handful of rays a frame', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(51) });
  run(life, 10, [0, 0, 0], {}, 1 / 60);
  assert.ok(T.rays() / 600 < 40, `${(T.rays() / 600).toFixed(1)} rays a frame`);
});
