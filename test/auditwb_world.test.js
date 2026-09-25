// AUDIT WB (2026-09-25, Mac: "A proper audit on everything"): THE GATE IN THE WORLD's findings, pinned - the omen that
// spoke before it knew the world's clock (C4), the countdown over the step's fire and the held frame (C5), the membrane
// fogged into a black hole (C2), the vortex spun through turns as it opened (C6), and what every frame paid for (C7).
// C1/C3 (the sea sites, the border town's province) are pinned beside the site's own law (wb1_gate_omen.test.js).
// Design: bible/11-Multiplayer/World-Bosses.md section 11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGateOmen, OMEN_SETTLE_MS } from '../src/systems/gateOmen.js';
import { gateTimes, omenLine, riseLine, openLine, GATE_RISE_MS } from '../src/net/gateLaw.js';
import { gateScanner, scanGatePixels, findGateSite } from '../src/systems/gateSite.js';
import {
  GatePassRenderer, MEMBRANE_FS, MEMBRANE_TURN_SEALED_HZ, MEMBRANE_TURN_OPEN_HZ, gateSpinRate, gateSpinAt,
} from '../src/render/gatePass.js';
import { createGatePool } from '../src/scenes/gatePool.js';
import { gateArchProfile } from '../src/world/gateModel.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SITE = { place: 'Copperham, Wrothgarian Mountains', near: 'Copperham', px: 400, py: 200, spot: [409.6, 409.6], ring: { cx: 400.3, cy: 200.6, r: 2 } };

test('AUDIT WB C4 the omen waits for the world\'s clock: silent and standing nowhere until its host is ready, then a settle, then the ONE line for where the gate stands', () => {
  const t = gateTimes(640);
  const clock = { now: t.openAt + 30_000 };
  const lines = [];
  const host = { ready: false };
  const omen = createGateOmen({ now: () => clock.now, site: () => SITE, say: (s) => lines.push(s), localTime: (m) => `L${m}`, ready: () => host.ready, settleMs: OMEN_SETTLE_MS });
  assert.equal(omen.frame(), null, 'the machine\'s own clock is not the world\'s');
  assert.equal(omen.standing(), null, 'no gate stood on it');
  assert.equal(omen.mapMark(), null);
  host.ready = true;
  assert.equal(omen.frame(), null, 'ready, and still holding: the hub\'s word of a kill comes just behind its welcome');
  clock.now += OMEN_SETTLE_MS - 1;
  assert.equal(omen.frame(), null);
  assert.equal(lines.length, 0);
  clock.now += 1;
  assert.equal(omen.frame().phase, 'open');
  assert.deepEqual(lines, [openLine({ near: 'Copperham', at: `L${640 * 1440 + 1320}` })], 'the one line for now - no omen, no rise');
  assert.equal(omen.standing().phase, 'open');
  clock.now -= 60_000;   // a correction steps the relay's clock back: the settled omen is not silenced by it
  assert.equal(omen.frame()?.phase, 'sealed', 'the gate as the stepped clock has it - not nothing');
  assert.equal(lines.length, 1, 'and the rise behind the open is not said');
  clock.now += 60_000;
  // the link drops and comes back: silent again for the settle, and the line already said is not said twice
  host.ready = false;
  assert.equal(omen.frame(), null);
  host.ready = true;
  omen.frame();
  clock.now += OMEN_SETTLE_MS;
  omen.frame();
  assert.equal(lines.length, 1);
  assert.equal(OMEN_SETTLE_MS, 1500);
});

test('AUDIT WB C4 a link lost and found settles again: a kill the relay saw while this player was away is heard before the omen speaks', () => {
  const t = gateTimes(643);
  const clock = { now: t.riseAt + 1000 };
  const lines = [];
  const host = { ready: true };
  let fell = null;
  const omen = createGateOmen({ now: () => clock.now, site: () => SITE, say: (s) => lines.push(s), localTime: (m) => `L${m}`, fellAt: () => fell, ready: () => host.ready, settleMs: OMEN_SETTLE_MS });
  omen.frame(); clock.now += OMEN_SETTLE_MS; omen.frame();
  assert.equal(lines.length, 1, 'the rise');
  host.ready = false;
  clock.now = t.openAt + 120_000;   // away through the opening - and the Warden fell just before the return
  omen.frame();
  host.ready = true;
  omen.frame();
  assert.equal(lines.length, 1, 'back, and holding: the hub\'s word is on its way');
  fell = t.openAt + 115_000;
  clock.now += OMEN_SETTLE_MS;
  assert.equal(omen.frame().phase, 'collapsing');
  assert.equal(lines.length, 1, 'no "the gate is open" over a gate whose boss is dead');
});

test('AUDIT WB C4 a clock that steps BACK never says a line twice; a new day says its own from the start', () => {
  const t = gateTimes(641);
  const clock = { now: t.openAt + 1000 };
  const lines = [];
  const omen = createGateOmen({ now: () => clock.now, site: () => SITE, say: (s) => lines.push(s), localTime: (m) => `L${m}` });
  omen.frame();
  assert.equal(lines.length, 1);
  // the relay's offset lands: the world's clock is 6 minutes behind the machine's - back into the sealed wait
  clock.now = t.riseAt + GATE_RISE_MS + 30_000;
  omen.frame();
  assert.equal(omen.current().phase, 'sealed');
  clock.now = t.openAt + 5000;
  omen.frame();
  assert.deepEqual(lines, [openLine({ near: 'Copperham', at: `L${641 * 1440 + 1320}` })], 'no rise said behind the open, and no second open');
  // the next day's gate: its omen is said though it ranks below the open
  const u = gateTimes(642);
  clock.now = u.omenAt + 1000;
  omen.frame();
  assert.equal(lines[1], omenLine({ place: SITE.place, at: `L${642 * 1440 + 1200}` }));
  clock.now = u.riseAt + 1000;
  omen.frame();
  assert.equal(lines[2], riseLine({ near: 'Copperham', left: '4:59' }));
});

test('AUDIT WB C4 the seam: the world\'s omen is ready when the relay\'s clock is read and the hub has welcomed (or eight seconds on the relay\'s alone), and settles', () => {
  const world = read('src/scenes/world.js');
  const at = world.indexOf('const gateOmen = params.has(\'online\') ? createGateOmen(');
  const deps = world.slice(at, world.indexOf('}) : null;', at));
  assert.match(deps, /ready: \(\) => \{ if \(!online\?\.clockRead\) \{ _omenClockAt = null; return false; \}/);
  assert.match(deps, /return !!socialLink\(\)\?\.clockRead \|\| performance\.now\(\) - _omenClockAt > 8000; \},/);
  assert.match(deps, /settleMs: OMEN_SETTLE_MS,/);
});

test('AUDIT WB C5 the countdown is never over the step\'s fire, nor frozen over a held frame', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /banner: \(text\) => drawGateBanner\(text, \{ hidden: gamePaused\(\) \|\| !!townTalk\.hudHidden \|\| !!gateVeil\?\.busy \}\),/);
  assert.match(world, /if \(frameHeld\(\)\) \{ frameAbort\(\); hideWorldPlaque\(\); last = now; requestAnimationFrame\(frame\); drawGateBanner\(null\); return; \}/);
});

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, ONE_MINUS_SRC_ALPHA: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('AUDIT WB C2 a fogged membrane becomes the fog: premultiplied, the fog colour stands in for the fire\'s own and the alpha keeps hiding the world', () => {
  assert.match(MEMBRANE_FS, /uniform vec3 uFogColor;/);
  assert.match(MEMBRANE_FS, /o = vec4\(mix\(uFogColor \* alpha, col \* glow, f\) \* uFade, alpha \* uFade\);/);
  assert.doesNotMatch(MEMBRANE_FS, /col \* glow \* f/, 'not the colour faded to black under an alpha that still hides the fogged world');
  // the law in numbers: fully fogged (f = 0), the membrane over a fogged world IS the fog
  const fog = [0.5, 0.52, 0.55], alpha = 0.9;
  const out = fog.map((c) => c * alpha + (1 - alpha) * c);
  assert.deepEqual(out.map((v) => +v.toFixed(6)), fog);
  const { gl, calls } = fakeGl();
  const pass = new GatePassRenderer(gl, gateArchProfile());
  const g = { origin: [0, 0, 0], yaw: 0, open: 1, fade: 1 };
  calls.length = 0;
  pass.draw([g], I, I, [0, 0, 0], 1, { mode: 2, density: 0.01, range: [0, 1], color: new Float32Array(fog), camPos: [0, 0, 0] });
  assert.deepEqual(Array.from(calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uFogColor')[2]).map((v) => +v.toFixed(6)), fog, 'the frame\'s fog colour handed over');
  calls.length = 0;
  pass.draw([g], I, I, [0, 0, 0], 1);
  assert.deepEqual(Array.from(calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uFogColor')[2]), [0, 0, 0], 'no fog: unfogged, f = 1 takes none of it');
});

test('AUDIT WB C6 the vortex turns by an accumulated spin: easing open speeds it up, never flings it through turns at once', () => {
  assert.match(MEMBRANE_FS, /uniform float uSpin;/);
  assert.match(MEMBRANE_FS, /float ang = -uSpin \* 6\.283185307179586 \+ 2\.2 \/ \(0\.6 \+ r\);/);
  assert.doesNotMatch(MEMBRANE_FS, /uTime \* 6\.28|uTime \* mix\(/, 'never the clock times a rate that moves');
  assert.equal(gateSpinRate(0), MEMBRANE_TURN_SEALED_HZ);
  assert.equal(gateSpinRate(1), MEMBRANE_TURN_OPEN_HZ);
  assert.equal(gateSpinRate(-3), MEMBRANE_TURN_SEALED_HZ);
  assert.equal(gateSpinRate(9), MEMBRANE_TURN_OPEN_HZ);
  for (const t of [0, 0.4, 7.9, 119.99]) for (const o of [0, 0.5, 1]) { const s = gateSpinAt(t, o); assert.ok(s >= 0 && s < 1, `${t} ${o} ${s}`); }
  // the old law's jump: at t = 100 s the angle moved (0.25 - 0.05) * 100 turns while `open` eased over a second
  // the pool's law: over the open's whole ease, each frame's turn is its own rate x its own dt
  const { gl, calls } = fakeGl();
  const t = gateTimes(650);
  const clock = { now: t.openAt - 2000 };
  const pool = createGatePool({
    renderer: null, gl, collider: () => null,
    standing: () => ({ day: 650, px: 400, py: 200, spot: [409.6, 409.6], t, fellAt: null, near: 'Copperham', phase: clock.now < t.openAt ? 'sealed' : 'open' }),
    pixelTranslation: () => [0, 0, 0], heightAt: () => 12, now: () => clock.now,
  });
  const spins = [];
  for (let k = 0; k < 360; k++) {
    clock.now += 16;
    pool.frame(0.016);
    calls.length = 0;
    pool.drawPass(I, I, [0, 0, 0], 100 + k * 0.016);
    const c = calls.find((x) => x[0] === 'uniform1f' && x[1] === 'uSpin');
    assert.ok(c, 'the pool hands its spin over');
    spins.push(c[2]);
  }
  let most = 0;
  for (let k = 1; k < spins.length; k++) { let d = spins[k] - spins[k - 1]; if (d < -0.5) d += 1; most = Math.max(most, d); assert.ok(d >= 0, 'never back'); }
  assert.ok(most <= MEMBRANE_TURN_OPEN_HZ * 0.016 + 1e-9, `a frame turns at most the open's rate (${most})`);
  assert.ok(spins.at(-1) !== spins[0], 'and it turns');
});

/** A small world: land east of x = 100, three towns, some ruins - enough rows for slices to matter. */
function fakeMaps() {
  const regions = [0, 1].map(() => ({ mapTable: [], mapNames: [] }));
  let n = 0;
  for (let y = 20; y < 480; y += 37) for (let x = 130; x < 980; x += 41) {
    const r = x < 500 ? 0 : 1;
    regions[r].mapTable.push({ mapId: y * 1000 + x, locationType: n++ % 2 ? LOCATION_TYPES.TownVillage : LOCATION_TYPES.DungeonRuin });
    regions[r].mapNames.push(`P${n}`);
  }
  return {
    regionCount: 2, getRegion: (r) => regions[r],
    getClimateIndex: (x) => (x < 100 ? CLIMATES.Ocean : 231),
    getPoliticIndex: (x) => (x < 100 ? 0 : 128 + (x < 500 ? 0 : 1)),
    getRegionIndexAt: (x) => (x < 500 ? 0 : 1),
  };
}

test('AUDIT WB C7 the site\'s scan in slices IS the scan made at once, a row at least a step, nothing handed back until the last', () => {
  const maps = fakeMaps();
  const whole = scanGatePixels(maps, { heightAt: () => 90 });
  const sc = gateScanner(maps, { heightAt: () => 90 });
  assert.equal(sc.progress(), 0);
  let steps = 0, got = null;
  while (!(got = sc.step(() => false))) steps++;
  assert.equal(steps, 497, 'a row a step when there is never time: 498 rows, the last one answers');
  assert.equal(sc.progress(), 1);
  assert.equal(sc.step(), got, 'a finished scan is kept');
  assert.deepEqual([...got.byRegion.keys()], [...whole.byRegion.keys()]);
  for (const [r, list] of whole.byRegion) assert.deepEqual(Array.from(got.byRegion.get(r)), Array.from(list), `region ${r}`);
  assert.deepEqual(got.towns, whole.towns);
  assert.deepEqual(Array.from(got.townAt), Array.from(whole.townAt));
  for (const day of [800, 801, 802]) assert.deepEqual(findGateSite(day, got), findGateSite(day, whole));
  // a budget: rows while there is time
  const b = gateScanner(maps);
  let calls = 0;
  assert.equal(b.step(() => ++calls < 100), null);
  assert.ok(Math.abs(b.progress() - 100 / 498) < 1e-9, `${b.progress()}`);
});

test('AUDIT WB C7 the seams: the scan warmed in idle slices once the relay\'s clock is read; a site asked early finishes it; a scan that throws begins again', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /if \(_omenClockAt == null\) \{ _omenClockAt = performance\.now\(\); warmGateScan\(\); \}/);
  assert.match(world, /globalThis\.requestIdleCallback\(function slice\(deadline\) \{/);
  assert.match(world, /const until = performance\.now\(\) \+ \(deadline\.didTimeout \? 4 : 0\);/, 'a page never idle still gets there');
  assert.match(world, /if \(!gateScanOf\(\(\) => deadline\.timeRemaining\(\) > 2 \|\| performance\.now\(\) < until\)\) \{ globalThis\.requestIdleCallback\(slice, \{ timeout: 250 \}\); return; \}/);
  assert.match(world, /\}, \{ timeout: 4000 \}\);/);
  assert.match(world, /try \{ const scan = gateScanOf\(\); return scan \? findGateSite\(day, scan\) : null; \}/, 'the site finishes it there and then');
  assert.match(world, /\} catch \(e\) \{ _gateScanner = null; throw e; \}/);
  assert.doesNotMatch(world, /scanGatePixels\(/, 'no whole scan in a frame');
});

test('AUDIT WB C7 what a frame pays for: the stone\'s matrix only when it moves, no gate no garbage, the pass\'s arguments only while a gate stands', () => {
  const t = gateTimes(661);
  const clock = { now: t.omenAt };
  const pool = createGatePool({
    renderer: null, gl: null, collider: () => null,
    standing: () => (clock.now < t.riseAt ? null : { day: 661, px: 400, py: 200, spot: [409.6, 409.6], t, fellAt: null, near: 'C', phase: 'open' }),
    pixelTranslation: () => [0, 0, 0], heightAt: () => 12, now: () => clock.now,
  });
  pool.frame(0.016);
  assert.equal(pool.stands(), false);
  assert.equal(pool.lights(), pool.lights(), 'the same empty list, not a new one a frame');
  assert.ok(Object.isFrozen(pool.lights()) && pool.lights().length === 0);
  assert.equal(pool.targets(), pool.lights());
  clock.now = t.openAt;
  pool.frame(0.016);
  assert.equal(pool.stands(), false, 'no GL, no pass: nothing for the host to build arguments for');
  const world = read('src/scenes/world.js');
  assert.match(world, /if \(gatePool\?\.stands\(\) && gatePool\.drawPass\(proj, view, new Float32Array\(mwv\.eye\), now \/ 1000,/);
  const src = read('src/scenes/gatePool.js');
  assert.match(src, /if \(k !== _matKey\) \{ _matKey = k; _mat = trs\(/);
  assert.match(src, /aabb: fireBox\(place, profile, fireHalfW\)/);
});
