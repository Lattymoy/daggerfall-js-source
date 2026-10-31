// AUDIT AMBIENT-LIFE (bible/01-Overview/audits/Audit-Ambient-Life.md): the sim's findings, each pinned on the producer's
// own path - a made town of gabled houses, slopes, a lake, the unbuilt edge of the world - and the record's numbers held
// whole, so a mutant of any of them dies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AmbientLife, AL_JUMP_M, AL_FAST, AL_RUN_MAX, AL_COAST_RINGS, AL_COAST_EVERY } from '../../../src/systems/ambientLife/ambientLife.js';
import { ambientCast, AL_KINDS } from '../../../src/systems/ambientLife/ambientCast.js';
import { AL_INSTANCE_FLOATS, AL_MAX_INSTANCES, AL_REACH, AL_EDGE, makeCreature } from '../../../src/systems/ambientLife/ambientBody.js';
import { BIRD, FLOCK, Flock, AL_FLIGHT } from '../../../src/systems/ambientLife/ambientFlight.js';
import { RUNNER, AL_GROUND } from '../../../src/systems/ambientLife/ambientGround.js';

const seeded = (seed) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
const RIDGE = 9;
/** Gabled houses 10 x 8 m every 25 m (`alongZ`: turned a quarter, the ridge north to south); `ground`, `wet` the land's. */
function town({ alongZ = false, ground = () => 0, wet = () => false, from = -3, to = 3 } = {}) {
  const houses = [];
  for (let i = from; i <= to; i++) for (let j = from; j <= to; j++) if (i || j) houses.push([i * 25, j * 25]);
  const [hx, hz] = alongZ ? [4, 5] : [5, 4];
  const roofAt = (x, z) => {
    for (const [cx, cz] of houses) if (Math.abs(x - cx) <= hx && Math.abs(z - cz) <= hz) return ground(cx, cz) + RIDGE - (alongZ ? Math.abs(x - cx) : Math.abs(z - cz)) * 0.75;
    return -Infinity;
  };
  let rays = 0, most = 0, frame = 0;
  return {
    houses, roofAt,
    rays: () => rays, most: () => most, tick() { most = Math.max(most, frame); frame = 0; },
    world: {
      ground, wet,
      roof: (x, z, top) => { rays++; frame++; const h = roofAt(x, z); return h <= top ? h : -Infinity; },
      boxes: () => houses.map(([cx, cz]) => ({ min: [cx - hx, ground(cx, cz), cz - hz], max: [cx + hx, ground(cx, cz) + RIDGE, cz + hz] })),
    },
  };
}
const castAt = (life, o = {}) => ambientCast({ minuteOfDay: 12 * 60, weather: 'sunny', climate: 231, town: life.town, coast: life.coast, ...o });
function run(life, seconds, feet, o = {}, step = 1 / 30, each = null) {
  for (let t = 0; t < seconds; t += step) {
    const f = typeof feet === 'function' ? feet(t) : feet;
    life.survey(f);
    life.step(step, f, castAt(life, o));
    each?.(t, f);
  }
}
const flat = (d) => Math.hypot(d[0], d[2]);

test('AUDIT AMBIENT-LIFE (C2): the sim\'s distances, times and thresholds are the record\'s', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(AL_FLIGHT)), {
    wanderRing: [35, 60], wanderAlt: [8, 28], townLift: 6, wanderLeave: 95, fleeLeave: 85, fleeOn: 60,
    perchRing: [6, 75], perchKeep: 100, sitesMax: 28, siteGap: 1, siteTall: 2.5, siteRest: [20, 45], perchSpawnFrom: 30,
    perchMisses: 12, perchLookEvery: 0.5, flushNeighbour: 6, flushDelay: [0.08, 0.6], roostFlush: 0.6, fastFlush: 1.6,
    soarAlt: [45, 95], soarRadius: [25, 65], soarDrift: 120, soarLeave: 180, soarFollow: 6, batRing: 26, batAlt: [3, 16], batLeave: 78,
    flockRing: [70, 110], flockAlt: [25, 48], flockScatter: 35, flockLife: [70, 140], flockForm: 10,
    flockLandRing: [28, 60], flockGroundFor: [15, 35], flockStartle: 16, flockLeave: 220, fadeIn: 0.8, boxesEvery: 2, avoidEvery: 0.5, perchCheck: 1,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(AL_GROUND)), {
    runnerRing: [9, 30], runnerLeave: 42, idle: [0.4, 2.5], dart: [0.8, 4], fleeRun: [6, 9], burrow: 0.5, slope: 0.35, fadeIn: 0.35,
    butterflyRing: [3, 18], butterflyLeave: 30, butterflyHome: 4, butterflyAlt: [0.4, 1.8], fireflyRing: [2, 22], fireflyLeave: 30, fireflyAlt: [0.3, 2.8],
  });
  assert.deepEqual([AL_JUMP_M, AL_FAST, AL_RUN_MAX, [...AL_COAST_RINGS], AL_COAST_EVERY, AL_REACH, AL_EDGE, AL_MAX_INSTANCES], [150, 6.6, 30, [15, 30, 45, 60], 2, 85, 15, 320]);
});

test('AUDIT AMBIENT-LIFE (A7): a jump starts afresh on its own - a flock 151 m behind is gone at once, though it would leave only at 220', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(3) });
  life.flight.flocks.push(new Flock(life.flight, AL_KINDS.starling, [0, 0, 0]));
  run(life, 1, [0, 0, 0]);
  assert.equal(life.flight.flocks.length, 1);
  life.step(1 / 30, [151, 0, 0], castAt(life));
  assert.equal(life.flight.flocks.length, 0, 'cleared by the jump, not by any distance');
  assert.deepEqual(life.last, [151, 0, 0]);
  const near = new AmbientLife(T.world, { random: seeded(3) });
  near.flight.flocks.push(new Flock(near.flight, AL_KINDS.starling, [0, 0, 0]));
  run(near, 1, [0, 0, 0]);
  near.step(1 / 30, [140, 0, 0], castAt(near));
  assert.equal(near.flight.flocks.length, 1, '140 m is no jump');
});

test('AUDIT AMBIENT-LIFE (A7): the perches are let go on their own as the player walks away - no jump in it', () => {
  const T = town({ from: -2, to: 2 }), life = new AmbientLife(T.world, { random: seeded(5) });
  run(life, 20, [0, 0, 0]);
  const perched = life.flight.birds.filter((b) => b.state === BIRD.perch);
  assert.ok(perched.length > 4);
  run(life, 60, (t) => [t * 3, 0, 0]);   // 180 m at a walk
  for (const b of perched) assert.ok(b.gone || !life.flight.birds.includes(b), 'a perch 100 m behind takes its bird');
  for (const s of life.flight.sites) assert.ok(Math.hypot(s.x - 180, s.z) <= AL_FLIGHT.perchKeep + 5);
  assert.ok(life.speed > 2 && life.speed < 4, `walked, not jumped: ${life.speed}`);
});

test('AUDIT AMBIENT-LIFE (A7, C16): the floating origin moves everything that stands on the land - the bodies\' every place, the flocks\' anchors and goals, the insects, the player\'s last place - and keeps the town', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(7) });
  life.flight.flocks.push(new Flock(life.flight, AL_KINDS.starling, [0, 0, 0]));
  run(life, 15, [0, 0, 0]);
  run(life, 6, [0, 0, 0], { minuteOfDay: 0 });   // the night's fireflies and bats beside the day's
  const o = [819.2, -3, -1638.4];
  const fields = (b) => [b.x, b.y, b.z, b.tx, b.ty, b.tz, b.cx, b.cz];
  const all = () => [...life.flight.bodies(), ...life.ground.runners, ...life.ground.butterflies, ...life.ground.fireflies];
  const before = all().map(fields), fl = life.flight.flocks.map((f) => [f.ax, f.ay, f.az, f.gx, f.gy, f.gz]);
  const kinds = new Set(all().map((b) => b.kind.name));
  assert.ok(kinds.has('firefly') && kinds.has('bat') && kinds.has('starling'), [...kinds].join());
  const shift = [o[0], o[1], o[2], o[0], o[1], o[2], o[0], o[2]];
  life.offset(o);
  all().map(fields).forEach((p, i) => p.forEach((v, k) => assert.ok(Math.abs(v - before[i][k] - shift[k]) < 1e-6, `field ${k}`)));
  life.flight.flocks.forEach((f, i) => [f.ax, f.ay, f.az, f.gx, f.gy, f.gz].forEach((v, k) => assert.ok(Math.abs(v - fl[i][k] - o[k % 3]) < 1e-6)));
  assert.ok(life.town, 'the town held across the move');
  const kept = life.flight.birds.filter((b) => b.state === BIRD.perch);
  life.step(1 / 30, o, castAt(life, { minuteOfDay: 0 }));
  for (const b of kept) assert.ok(life.flight.birds.includes(b), 'the same birds on the same roofs');
  assert.ok(life.speed < 1, `no run read into the move: ${life.speed}`);
});

test('AUDIT AMBIENT-LIFE (A9, A10): a walk is not a run, a long frame is not a sprint, a run is', () => {
  const T = town(), go = (speed, frameS = 1 / 30, seconds = 3) => {
    const life = new AmbientLife(T.world, { random: seeded(9) });
    let x = 0;
    for (let t = 0; t < seconds; t += frameS) { x += speed * frameS; life.step(frameS, [x, 0, 0], castAt(life)); }
    return life;
  };
  assert.equal(go(6.33).ctx.fast, false, 'the fastest walk (SPD 100)');
  assert.equal(go(6.84).ctx.fast, true, 'the slowest run');
  const hitch = new AmbientLife(T.world, { random: seeded(9) });
  let x = 0;
  for (let i = 0; i < 90; i++) { x += 4 / 30; hitch.step(1 / 30, [x, 0, 0], castAt(hitch)); }
  x += 4 * 0.5; hitch.step(0.5, [x, 0, 0], castAt(hitch));   // one half-second frame at the same walk
  assert.ok(hitch.speed < 5, `a hitch reads as the walk it was: ${hitch.speed}`);
});

test('AUDIT AMBIENT-LIFE (A12, B8): water near is a coast; ground still streaming is not', () => {
  const lake = new AmbientLife({ ground: () => 0, wet: (x) => x > 50, roof: () => -Infinity }, { random: seeded(1) });
  lake.survey([0, 0, 0]);
  assert.equal(lake.coast, true, 'a lake 50 m off');
  const edge = new AmbientLife({ ground: (x) => (x > 50 ? -Infinity : 0), wet: (x, z) => !(x <= 50), roof: () => -Infinity }, { random: seeded(1) });
  edge.survey([0, 0, 0]);
  assert.equal(edge.coast, false, 'the unbuilt edge 50 m off is no sea');
  const pond = new AmbientLife({ ground: () => 0, wet: (x, z) => Math.hypot(x, z - 45) < 4, roof: () => -Infinity }, { random: seeded(1) });
  pond.survey([0, 0, 0]);
  assert.equal(pond.coast, true, 'a pond between the old rings');
  const host = ambientCast({ minuteOfDay: 720, weather: 'sunny', climate: 231, coast: edge.coast });
  assert.equal(host.wanderKind, 'sparrow', 'no gulls in the woods for a pixel streaming in');
});

test('AUDIT AMBIENT-LIFE (A2): the soarers follow a runner up a slope and never sink into it; a soarer left behind leaves', () => {
  const slope = (x) => x * 0.25, T = town({ ground: slope, from: 0, to: 0 });
  const life = new AmbientLife(T.world, { random: seeded(11) });
  run(life, 240, (t) => [t * 8, slope(t * 8), 0], {}, 1 / 30, (t, f) => {
    for (const b of life.flight.birds) {
      if (b.state !== BIRD.soar) continue;
      assert.ok(b.y > slope(b.x) + 15, `a soarer under the hill at t=${t.toFixed(1)}: ${b.y.toFixed(1)} over ${slope(b.x).toFixed(1)}`);
      assert.ok(Math.hypot(b.cx - f[0], b.cz - f[2]) <= AL_FLIGHT.soarLeave + 1, 'held within its leave');
    }
  });
  assert.ok(life.flight.birds.filter((b) => b.state === BIRD.soar).every((b) => Math.hypot(b.x - 240 * 8, b.z) < 260), 'the soarers are the runner\'s');
});

test('AUDIT AMBIENT-LIFE (A3): bats outrun are let go, and new ones come to the runner', () => {
  const T = town({ from: 0, to: 0 }), life = new AmbientLife(T.world, { random: seeded(13) });
  run(life, 120, (t) => [t * 9, 0, 0], { minuteOfDay: 0 }, 1 / 30, (t, f) => {
    for (const b of life.flight.birds) if (b.state === BIRD.bat) assert.ok(Math.hypot(b.x - f[0], b.z - f[2]) <= AL_FLIGHT.batLeave + 1);
  });
  assert.ok(life.flight.birds.filter((b) => b.state === BIRD.bat).length >= 3);
});

test('AUDIT AMBIENT-LIFE (A4): a flushed bird the player follows keeps flying - it never hangs where it was going', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(15) });
  run(life, 20, [0, 0, 0]);
  const b = life.flight.birds.find((q) => q.state === BIRD.perch);
  life.flight.flush(b, [0, 0, 0], false);
  run(life, 1, [0, 0, 0]);
  assert.equal(b.state, BIRD.flee);
  let slowest = Infinity;
  run(life, 60, () => [b.x - 30, 0, b.z], {}, 1 / 30, (t) => { if (t > 3) slowest = Math.min(slowest, Math.hypot(b.vx, b.vz)); });   // 30 m behind it, all the way
  assert.ok(slowest > 3, `the slowest it flew: ${slowest.toFixed(2)} m/s`);
});

test('AUDIT AMBIENT-LIFE (A5, A6): no feeding bird, butterfly or firefly stands under a roof or on water', () => {
  const T = town({ wet: (x) => x > 60 }), life = new AmbientLife(T.world, { random: seeded(17) });
  const flock = new Flock(life.flight, AL_KINDS.starling, [0, 0, 0]);
  flock.life = 1e9; life.flight.flocks.push(flock);
  let fed = 0;
  const check = (b, what) => {
    assert.ok(!Number.isFinite(T.roofAt(b.x, b.z)), `${what} under a roof at ${b.x.toFixed(1)}, ${b.z.toFixed(1)}`);
    assert.ok(b.x <= 60, `${what} on the water`);
  };
  for (const minute of [12 * 60, 0]) {
    run(life, 120, [0, 0, 0], { minuteOfDay: minute }, 1 / 30, () => {
      if (flock.mode === FLOCK.sky && flock.t > 0.5 && flock.formed > AL_FLIGHT.flockForm) { flock.t = 0; flock.landed = -Infinity; }   // ask it down often
      for (const b of flock.members) if (b.state === 2) { fed++; check(b, 'a feeding bird'); }
      for (const b of life.ground.butterflies) check(b, 'a butterfly');
      for (const b of life.ground.fireflies) check(b, 'a firefly');
    });
  }
  assert.ok(fed > 100, `the flock fed (${fed} bird-frames on the ground)`);
});

test('AUDIT AMBIENT-LIFE (C2, C16): a startled flock goes up nearest first, and its neighbours on the roofs follow within the flush delay', () => {
  const T = town({ from: 0, to: 0 }), life = new AmbientLife(T.world, { random: seeded(19) });
  const flock = new Flock(life.flight, AL_KINDS.crow, [0, 0, 0]);
  flock.life = 1e9; life.flight.flocks.push(flock);
  flock.mode = FLOCK.ground; flock.groundFor = 1e9;
  flock.members.forEach((b, i) => { b.state = 2; b.x = -40 - i * 2; b.z = 30; b.y = 0; b.tx = b.x; b.tz = b.z; b.ty = 0; b.t = 10; });
  const went = new Map();
  run(life, 3, [-40 + AL_FLIGHT.flockStartle - 1, 0, 30], {}, 1 / 60, (t) => { for (const b of flock.members) if (b.state === 0 && !went.has(b)) went.set(b, t); });
  assert.equal(went.size, flock.members.length, 'all went up');
  const order = flock.members.map((b) => went.get(b)), third = Math.max(1, Math.floor(order.length / 3));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(mean(order.slice(0, third)) < mean(order.slice(-third)), `nearest first: ${order.map((v) => v.toFixed(2))}`);
  // the roofs: two birds a metre apart, the near one put up - the other goes within the flush delay's top and the first's
  const roofs = new AmbientLife(T.world, { random: seeded(21) });
  const a = makeCreature(AL_KINDS.pigeon, seeded(1)), b = makeCreature(AL_KINDS.pigeon, seeded(2));
  for (const [q, x] of [[a, 0], [b, 1]]) { q.x = x; q.y = RIDGE; q.z = 0; q.state = BIRD.perch; q.spread = 0; q.fade = 1; roofs.flight.birds.push(q); }
  let left = null;
  run(roofs, 1, (t) => (t < 0.05 ? [100, 0, 100] : [-3, RIDGE - 1, 0]), {}, 1 / 60, (t) => { if (left === null && b.state === BIRD.flee) left = t; });
  assert.ok(left !== null && left - 0.05 <= AL_FLIGHT.flushDelay[1] + 0.12 + 1 / 30, `the neighbour went ${left?.toFixed(2)} s in`);
});

test('AUDIT AMBIENT-LIFE (C2): perches across a ridge running north to south face east and west', () => {
  const T = town({ alongZ: true }), life = new AmbientLife(T.world, { random: seeded(23) });
  run(life, 20, [0, 0, 0]);
  const across = life.flight.sites.filter((s) => Math.abs(Math.sin(s.yaw)) > 0.999).length;
  assert.ok(across >= life.flight.sites.length * 0.8, `${across} of ${life.flight.sites.length}`);
});

test('AUDIT AMBIENT-LIFE (C2): no runner stands on a slope steeper than 0.35 m in 0.4 m', () => {
  const steep = (x, z) => (Math.sin(x * 0.4) + Math.sin(z * 0.3)) * 6;   // hills whose sides pass the limit twice over
  const T = town({ ground: steep, from: 0, to: 0 }), life = new AmbientLife(T.world, { random: seeded(25) });
  let seen = 0;
  run(life, 60, [0, 0, 0], {}, 1 / 30, () => {
    for (const r of life.ground.runners) {
      if (r.state !== RUNNER.idle) continue;
      const g = steep(r.x, r.z);
      assert.ok(Math.abs(steep(r.x + 0.4, r.z) - g) <= AL_GROUND.slope + 1e-9 && Math.abs(steep(r.x, r.z + 0.4) - g) <= AL_GROUND.slope + 1e-9, 'a runner at rest on a steep side');
      seen++;
    }
  });
  assert.ok(seen > 100);
});

test('AUDIT AMBIENT-LIFE (C2): a lone bird climbs a hill it can, turns back from a cliff or a tower it cannot, and is never inside either', () => {
  const fly = (ground, roof = () => -Infinity) => {
    const life = new AmbientLife({ ground, wet: () => false, roof }, { random: seeded(27) });
    const b = makeCreature(AL_KINDS.crow, seeded(3));
    Object.assign(b, { x: 0, y: 10, z: 0, vx: 8, vz: 0, tx: 300, ty: 10, tz: 0, t: 1e9, state: BIRD.wander, fade: 1 });
    life.flight.birds.push(b);
    let far = 0;
    // a clear day: the bird is one of the day's lone birds, kept on its way (the player rides beside it)
    run(life, 8, () => [b.x, 0, b.z + 20], {}, 1 / 30, () => {
      const top = Math.max(ground(b.x, b.z), roof(b.x, b.z, 1e9));
      assert.ok(b.y >= top + 0.99, `inside at x ${b.x.toFixed(1)}: y ${b.y.toFixed(1)} under ${top.toFixed(1)}`);
      far = Math.max(far, b.x);
    });
    assert.equal(b.state, BIRD.wander);
    return far;
  };
  assert.ok(fly((x) => Math.max(0, Math.min(10, (x - 20) / 3))) > 40, 'a hill of 10 m over 30 m: up and over it');
  assert.ok(fly((x) => (x > 20 ? 40 : 0)) < 20, 'a cliff of 40 m: turned back short of it');
  assert.ok(fly(() => 0, (x, z, top) => (x > 20 && x < 30 && 40 <= top ? 40 : -Infinity)) < 20, 'a tower 30 m over it: turned back');
});

test('AUDIT AMBIENT-LIFE (A11): a perch pruned and gone in one frame takes no other perch with it', () => {
  const T = town(), life = new AmbientLife(T.world, { random: seeded(29) });
  run(life, 20, [0, 0, 0]);
  const fl = life.flight, b = fl.birds.find((q) => q.state === BIRD.perch), s = b.site;
  fl.sites.splice(fl.sites.indexOf(s), 1);   // pruned already this frame
  b.gone = false; b.look = 0;
  const others = [...fl.sites];
  T.houses.length = 0;   // and every roof gone
  fl.perch(b, 1 / 30, [0, 0, 0], castAt(life), life.ctx);
  assert.deepEqual(fl.sites, others, 'the list untouched');
});

test('AUDIT AMBIENT-LIFE (A15): a hamlet\'s few roofs stop costing rays once its perches are found', () => {
  const T = town({ from: 0, to: 1 }), life = new AmbientLife(T.world, { random: seeded(31) });
  let late = 0, frames = 0;
  run(life, 60, [0, 0, 0], {}, 1 / 60, (t) => { T.tick(); if (t > 20) { frames++; } });
  const before = T.rays();
  run(life, 20, [0, 0, 0], {}, 1 / 60, () => T.tick());
  late = (T.rays() - before) / (20 * 60);
  assert.ok(life.flight.sites.length < AL_FLIGHT.sitesMax, 'fewer perches than the cap');
  assert.ok(late < 3, `${late.toFixed(2)} rays a frame once the roofs are known`);
  assert.ok(T.most() <= 29 + 20, `the most in one frame: ${T.most()} (the perches' 29 and a dart's footing)`);
  assert.ok(frames > 0);
});

test('AUDIT AMBIENT-LIFE (A18): a creature fades out toward its reach, so none is lost at full size', () => {
  const life = new AmbientLife({ ground: () => 0, wet: () => false, roof: () => -Infinity }, { random: seeded(33) });
  const at = (d) => {
    const b = makeCreature(AL_KINDS.crow, seeded(5));
    Object.assign(b, { x: d, y: 20, z: 0, fade: 1, scale: 1, state: BIRD.wander });
    life.flight.birds = [b]; life.last = [0, 0, 0];
    const out = new Float32Array(AL_MAX_INSTANCES * AL_INSTANCE_FLOATS);
    return life.write(out).solid ? out[3] : 0;
  };
  assert.equal(at(20), 1);
  assert.ok(Math.abs(at(AL_REACH - AL_EDGE / 2) - 0.5) < 1e-6);
  assert.equal(at(AL_REACH + 1), 0, 'past its reach it is not drawn');
});

test('AUDIT AMBIENT-LIFE (A13): the town is known on the frame the cast is read, and the coast is forgotten with a clear', () => {
  const T = town(), life = new AmbientLife({ ...T.world, wet: (x) => x > 50 }, { random: seeded(35) });
  life.survey([0, 0, 0]);
  assert.equal(life.town, true, 'before any step');
  assert.equal(life.coast, true);
  life.clear();
  assert.deepEqual([life.town, life.coast], [false, false]);
});

test('AUDIT AMBIENT-LIFE: a half-built world - the ground ending at 40 m - stands nothing past its edge and draws nothing that is not a number', () => {
  const life = new AmbientLife({ ground: (x) => (x > 40 ? -Infinity : 0), wet: (x) => x > 40, roof: () => -Infinity }, { random: seeded(37) });
  const out = new Float32Array(AL_MAX_INSTANCES * AL_INSTANCE_FLOATS);
  for (const minute of [720, 0]) {
    run(life, 40, [0, 0, 0], { minuteOfDay: minute }, 1 / 30, () => {
      for (const b of [...life.ground.runners, ...life.ground.butterflies, ...life.ground.fireflies]) assert.ok(b.x <= 40.5, `${b.kind.name} off the world`);
    });
    const { solid, glow } = life.write(out);
    for (let i = 0; i < (solid + glow) * AL_INSTANCE_FLOATS; i++) assert.ok(Number.isFinite(out[i]));
  }
});

test('AUDIT AMBIENT-LIFE (A16): a body\'s angles are written wrapped, so hours of wingbeats keep a float\'s precision', async () => {
  const { writeBody } = await import('../../../src/systems/ambientLife/ambientBody.js');
  const b = makeCreature(AL_KINDS.bat, seeded(1));
  b.yaw = 1e6 + 0.25; b.phase = 4e7 + 0.5; b.fade = 1;
  const out = new Float32Array(AL_INSTANCE_FLOATS);
  writeBody(b, out, 0);
  assert.ok(Math.abs(out[4]) < Math.PI * 2 && Math.abs(out[7]) < Math.PI * 2);
  assert.ok(Math.abs(out[4] - ((1e6 + 0.25) % (Math.PI * 2))) < 1e-4, 'the same angle');
});
