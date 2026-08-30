// U65 THE INTRO — the pins.
//
// The split this file exercises is the reason the intro was built in
// five modules instead of one: the map, the renderer, the cue sheet and
// the theme are all PURE, so almost everything that can be wrong about
// the intro is answerable here rather than in a browser. Only
// ui/introScreen.js needs a document, and it is thin on purpose.
//
// EVERY PIN BELOW WAS MUTATION-CHECKED. The law is Home.md's - "A PIN
// MUST FAIL: every assertion claiming to pin a law must fail under a
// one-character mutation of that law" - and the mutants are named in
// the arc doc beside the finding each one guards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIliac, seaDistance, capsuleDist, lcg, makeNoise, octaveNoise, ridged,
  SEA_LEVEL, INTRO_MAP_W, INTRO_MAP_H, INTRO_MAP_SEED, STROKES, BALFIERA,
} from '../src/ui/introMap.js';
import {
  prepareMap, mipFor, groundAt, clearedZ, projection, basis,
  edgeFade, EDGE_TAPER, OCEAN, DEFAULT_FOV,
  projectDirection, skyColour, posterise, drawFlyover, waveTable,
  WAVE_N, WAVE_SPECTRUM, CLEARANCE, SUN_BEARING, LEVELS, FOG_MAX,
} from '../src/ui/introFlyover.js';
import {
  BPM, BEAT, BAR, PHASE, barTime, DURATION, END_BAR, SPLASHES, PATH,
  MEASURED_ONSETS, MEASURED_BARS, cameraAt, splashOpacity, introState, ramp, EAST,
  ONSET_STRENGTH, MAP_BAR, SKY_PATH, skyCameraAt,
} from '../src/ui/introCue.js';
import {
  drawSkyMap, inCloud, makeClouds, CLOUD_BASE, CLOUD_TOP, CLOUD_H,
  MAX_SPAN, MAP_EDGE_TAPER, SHADOW_CAP, CLOUD_DRIFT_X, CLOUD_DRIFT_Y,
} from '../src/ui/introSkyMap.js';
import { themeTime, stopTheme, startTheme, _resetForTests, THEME_URL } from '../src/systems/introTheme.js';
import { SPLASH_URL, SPLASH_WIDTH, MAX_BUFFER_W } from '../src/ui/introScreen.js';

// ═══════════════════════════════════════════════════════════════════
// THE CUE SHEET — the grid is a claim about a recording, so it is
// checked against the recording's own measured onsets and not against
// my arithmetic restated.
// ═══════════════════════════════════════════════════════════════════

test('the beat grid lands on the measured onsets within 15 ms', () => {
  assert.equal(MEASURED_ONSETS.length, MEASURED_BARS.length);
  let worst = 0;
  for (let i = 0; i < MEASURED_ONSETS.length; i++) {
    const err = Math.abs(barTime(MEASURED_BARS[i]) - MEASURED_ONSETS[i]);
    worst = Math.max(worst, err);
  }
  // A third of a frame at 60 Hz. MUTANT: BPM 127.26 -> 127.0 pushes
  // this to 30 ms; PHASE 0.255 -> 0.25 pushes it to 18 ms. Both die.
  assert.ok(worst < 0.015, `worst grid error ${(worst * 1000).toFixed(1)} ms`);
});

test('the grid is self-consistent: bar 1 is the first bar', () => {
  assert.equal(barTime(1), PHASE);
  assert.ok(Math.abs(BAR - BEAT * 4) < 1e-12);
  assert.ok(Math.abs(BEAT - 60 / BPM) < 1e-12);
  // Bars are 1-based as a musician counts them. MUTANT: an off-by-one
  // in barTime (n instead of n-1) moves every cue by 1.886 s.
  assert.ok(Math.abs(barTime(11) - 19.114) < 0.002);
  // Same 15 ms law as the fit above, not a tighter one: bar 34's onset
  // sits 4.5 ms off the grid, and a 4 ms tolerance here was failing
  // correct data for being real.
  assert.ok(Math.abs(barTime(34) - 62.485) < 0.015);
});

test('the reveal sits on the LOUDEST onset, and that is checkable', () => {
  // The whole second half of the flight is built to arrive at bar 34,
  // and the reason has to be evidence rather than taste: bar 34 carries
  // the strongest onset in the opening by a wide margin. MUTANT: move
  // the last PATH key's bar to 30 and the reveal lands on an onset a
  // third weaker.
  const bars = Object.keys(ONSET_STRENGTH).map(Number);
  const loudest = bars.reduce((a2, b2) => (ONSET_STRENGTH[b2] > ONSET_STRENGTH[a2] ? b2 : a2));
  assert.equal(loudest, 34, 'bar 34 is not the loudest measured onset');
  assert.ok(ONSET_STRENGTH[34] > ONSET_STRENGTH[11] * 2, 'the reveal is not clearly bigger than the title cut');
  // And the camera path's widest, highest key is the one that lands on it.
  const widest = PATH.reduce((a2, b2) => (b2.fov > a2.fov ? b2 : a2));
  assert.ok(widest.bar >= 34, `the widest shot is at bar ${widest.bar}, not the reveal`);
});

test('the title CUTS in exactly on the reveal and not a frame later', () => {
  const title = SPLASHES.find((s) => s.key === 'title');
  assert.equal(title.in, 34.0);
  assert.equal(title.up, title.in, 'the title is a cut, not a fade');
  // THE PIN THAT CAUGHT THE REAL BUG. splashOpacity used `bar <= s.in`,
  // so at bar 11.0 exactly - the downbeat the whole sheet is built
  // around - it returned 0 and the title arrived a frame late.
  // MUTANT: restore `<=` and this fails.
  assert.equal(splashOpacity(title, 34.0), 1);
  assert.equal(splashOpacity(title, 33.999), 0);
});

test('the title lands WITH the reveal, and the sky is clear when it does', () => {
  // The point of the whole third act: the biggest onset, the widest
  // picture and the title on one beat. It used to cut at bar 11 and be
  // gone before the climax, which stranded it in the middle of a long
  // flight. MUTANT: put title.in back to 11 and this fails.
  const title = SPLASHES.find((s) => s.key === 'title');
  assert.equal(title.in, 34.0);
  assert.equal(introState(barTime(34)).view, 'map', 'the reveal is not up yet');
  // And the white-out must have CLEARED by then, or the title lands on
  // a white screen. MUTANT: raise CLOUD_TOP past the bar-34 altitude.
  assert.ok(introState(barTime(34)).whiteout < 0.02, 'the title lands inside the cloud');
});

test('the projection changes where the WHITE-OUT IS TOTAL', () => {
  // Two projections cannot be cross-faded - they disagree about where
  // everything is - so the cut has to happen where there is nothing on
  // screen to be discontinuous. MUTANT: move MAP_BAR to 32.0, where the
  // camera is still below CLOUD_BASE, and the cut happens in clear air.
  const at = introState(barTime(MAP_BAR));
  assert.equal(at.view, 'map');
  assert.ok(at.whiteout > 0.98, `the cut is not hidden (whiteout ${at.whiteout.toFixed(2)})`);
  // One frame earlier is still the ground renderer, and still white.
  const just = introState(barTime(MAP_BAR) - 0.02);
  assert.equal(just.view, 'ground');
  assert.ok(just.whiteout > 0.95, 'the frame before the cut is not white either');
  // And it switches ONCE. A test on altitude rather than bar would flip
  // back and forth on any path that dipped.
  let flips = 0, prev = null;
  for (let t = 0; t < DURATION; t += 0.05) {
    const v = introState(t).view;
    if (prev !== null && v !== prev) flips++;
    prev = v;
  }
  assert.equal(flips, 1, `the view changes ${flips} times`);
});

test('every move in the climb STARTS on a measured onset', () => {
  // A smooth ease from bar 24 to bar 34 puts the camera in the sky
  // without ever arriving anywhere - the move has no onset, so there is
  // nothing for the music to land on, and it reads as drift however
  // well the splash is timed. The climb rate has to be near zero going
  // into the beat and unmistakable coming out of it.
  // MUTANT: delete the bar-29 key and the ratio collapses to ~1.
  const rate = (bar, d = 0.35) => (cameraAt(bar + d).z - cameraAt(bar).z) / d;
  const before = rate(29 - 0.35), after = rate(29);
  assert.ok(before < 5, `the camera is already climbing at bar 29 (${before.toFixed(1)}/bar)`);
  assert.ok(after > 25, `bar 29 does not launch (${after.toFixed(1)}/bar)`);
  assert.ok(after / Math.max(0.1, before) > 8, 'bar 29 is not a change of pace');
  // And the second kick is a real acceleration, not a continuation.
  assert.ok(rate(31) > rate(31 - 0.35) * 2, 'bar 31 does not kick');
  // The climb ARRIVES at bar 34 rather than sailing through it.
  assert.ok(rate(34) < rate(34 - 0.35) * 0.2, 'the climb does not settle on the reveal');
});

test('the cloud bursts on the SAME FRAME the title lands', () => {
  // THE DEFECT THIS PIN EXISTS FOR. The deck used to thin from bar 33.2
  // onward, so the province was fully readable eighteen frames before
  // the title arrived: the reveal and the beat were two separate
  // events, and that is exactly what it looked like.
  // MUTANT: move the bar-33.85 key's z up to 440 and the gap returns.
  const FPS = 30;
  let clear = null, title = null;
  for (let f = Math.ceil(barTime(MAP_BAR) * FPS); f < barTime(END_BAR) * FPS; f++) {
    const st = introState(f / FPS);
    if (clear === null && st.whiteout < 0.10) clear = f;
    if (title === null && st.splashes.find((x) => x.key === 'title').opacity > 0) title = f;
  }
  assert.ok(clear !== null && title !== null, 'the cloud never clears or the title never lands');
  assert.ok(Math.abs(title - clear) <= 4,
    `the burst and the title are ${Math.abs(title - clear)} frames apart`);
  // And both sit on the measured onset, not merely near each other.
  assert.ok(Math.abs(title / FPS - 62.485) < 0.05, 'the title is not on the onset');
  // Still solidly white a tenth of a bar before it.
  assert.ok(introState(barTime(33.9)).whiteout > 0.7, 'the deck thins too early');
});

test('inCloud is a deck with a top and a bottom', () => {
  assert.equal(inCloud(CLOUD_BASE), 0);
  assert.equal(inCloud(CLOUD_TOP), 0);
  assert.equal(inCloud(0), 0);
  assert.equal(inCloud(99999), 0);
  assert.ok(Math.abs(inCloud(CLOUD_H) - 1) < 1e-9, 'the deck does not close over the middle');
  // Eased, not a triangle: entering and leaving must not corner.
  const q = inCloud(CLOUD_BASE + (CLOUD_TOP - CLOUD_BASE) * 0.25);
  assert.ok(q > 0.25, `the deck ramps linearly (${q.toFixed(2)})`);
  assert.ok(CLOUD_TOP > CLOUD_BASE);
});

test('the flight climbs THROUGH the deck, not up to it', () => {
  // MUTANT: cap the last PATH keys below CLOUD_TOP and the camera never
  // comes out the other side - the intro ends inside a white screen.
  const below = PATH.filter((k) => k.z < CLOUD_BASE).length;
  const above = PATH.filter((k) => k.z > CLOUD_TOP).length;
  assert.ok(below > 0, 'the flight never starts below the cloud');
  assert.ok(above > 0, 'the flight never gets above the cloud');
  assert.ok(cameraAt(END_BAR).z > CLOUD_TOP, 'the intro ends inside the deck');
});

test('the sky path opens to the WHOLE province and no further', () => {
  // MAX_SPAN is geometry, not taste: past 640 * 16/9 the frame shows
  // sky above and below the map as well as beside it, and every cell of
  // that is clamped edge. MUTANT: raise the last span past MAX_SPAN.
  for (let i = 1; i < SKY_PATH.length; i++) {
    assert.ok(SKY_PATH[i].bar > SKY_PATH[i - 1].bar, 'sky path keys must ascend');
    assert.ok(SKY_PATH[i].span >= SKY_PATH[i - 1].span, 'the reveal must not close again');
  }
  assert.ok(SKY_PATH[SKY_PATH.length - 1].span <= MAX_SPAN);
  assert.ok(MAX_SPAN <= (INTRO_MAP_H * 16) / 9 + 1, 'MAX_SPAN shows sky past the map');
  // It has to actually reach the whole thing by the end.
  assert.ok(skyCameraAt(END_BAR).span >= INTRO_MAP_W, 'the province is never seen whole');
  assert.deepEqual(skyCameraAt(-99), { ...SKY_PATH[0] });
  assert.deepEqual(skyCameraAt(1e6), { ...SKY_PATH[SKY_PATH.length - 1] });
});

test('the map view draws the province, opaque, with land AND sea', () => {
  const p = prepareMap(buildIliac({ w: 256, h: 160, seed: 42 }));
  const W = 128, H = 72;
  const b = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  drawSkyMap(b, p, { x: 128, y: 80, span: 280 }, 3);
  let blue = 0, green = 0;
  for (let i = 0; i < W * H; i++) {
    assert.equal(b.data[i * 4 + 3], 255, 'the map view left a transparent pixel');
    const r = b.data[i * 4], g = b.data[i * 4 + 1], bl = b.data[i * 4 + 2];
    if (bl > r + 10) blue++;
    if (g > r + 6 && g > bl) green++;
  }
  // A map with no sea, or no land, is not this map. MUTANT: drop the
  // water branch and the sea shades as land.
  assert.ok(blue > W * H * 0.10, `almost no water (${blue} px)`);
  assert.ok(green > W * H * 0.05, `almost no land (${green} px)`);
  // AND THE WATER MOVES. Finding the missing water branch took three
  // guesses and two of them were wrong: a blue-pixel count does not
  // catch it, because sea run through the land path is still blue; and
  // brightness barely catches it either - the predicted "a third
  // darker" was 6%, since water is FLAT and a flat surface takes the
  // lambert's maximum, not its minimum. What actually distinguishes
  // them is the RIPPLE, so that is what gets pinned, with the cloud
  // field stubbed out through drawSkyMap's own injection seam so the
  // only thing left varying with time is the water.
  const still = () => 0;
  const att = (t2) => {
    const c = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
    drawSkyMap(c, p, { x: 128, y: 80, span: 280 }, t2, still);
    return c.data.join(',');
  };
  assert.equal(att(0), att(0), 'the map view is not deterministic');
  assert.notEqual(att(0), att(2.0), 'the sea does not move - is the water branch there?');
  // Same camera twice is the same frame; a different span is not.
  const shot = (span) => {
    const c = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
    drawSkyMap(c, p, { x: 128, y: 80, span }, 3);
    return c.data.join(',');
  };
  assert.equal(shot(280), shot(280));
  assert.notEqual(shot(280), shot(500));
});

test('the map view uses its own edge taper, at its own scale', () => {
  // ONE LAW, TWO SCALES. The flyover meets the map's edge at four
  // hundred units through haze; looking straight down, 260 cells of
  // fade is most of the visible margin and the clamped edge row is
  // still seven tenths present when it leaves frame - which is how the
  // rims came back as horizontal smears of repeated mountain.
  // MUTANT: use EDGE_TAPER here and the smear returns.
  assert.ok(MAP_EDGE_TAPER < EDGE_TAPER / 3, 'the map taper is not sharper than the flyover s');
  assert.ok(MAP_EDGE_TAPER > 0);
  assert.ok(SHADOW_CAP > 0 && SHADOW_CAP < 0.5, 'a shadow that long decouples cloud from shadow');
});

test('the cloud field is seeded, bounded, and drifts', () => {
  const a2 = makeClouds(7), b2 = makeClouds(7), c2 = makeClouds(8);
  assert.equal(a2(100, 200, 0), b2(100, 200, 0));
  assert.notEqual(a2(100, 200, 0), c2(100, 200, 0));
  for (const [x, y, t] of [[0, 0, 0], [5000, -3000, 12], [-1e4, 1e4, 99]]) {
    const v = a2(x, y, t);
    assert.ok(v >= 0 && v <= 1, `cloud out of range at ${x},${y},${t}`);
  }
  // IT MUST DRIFT ON BOTH AXES, and the law is an exact identity: the
  // field at time t is the field at time 0, translated. Checking only
  // that "something changed" is not enough - dropping the X drift alone
  // leaves the Y drift moving the deck, and a mutant that did exactly
  // that walked through the first draft of this pin.
  const t = 17;
  for (let x = -500; x < 1500; x += 211) {
    for (let y = -200; y < 900; y += 173) {
      assert.ok(
        Math.abs(a2(x, y, t) - a2(x + CLOUD_DRIFT_X * t, y + CLOUD_DRIFT_Y * t, 0)) < 1e-9,
        `the deck does not translate at ${x},${y}`,
      );
    }
  }
  assert.notEqual(CLOUD_DRIFT_X, 0);
  assert.notEqual(CLOUD_DRIFT_Y, 0);
});

test('every splash reaches full opacity and returns to zero', () => {
  for (const s of SPLASHES) {
    assert.equal(splashOpacity(s, s.in - 0.01), 0, `${s.key} before`);
    assert.equal(splashOpacity(s, (s.up + s.out) / 2), 1, `${s.key} hold`);
    assert.equal(splashOpacity(s, s.gone), 0, `${s.key} after`);
    assert.ok(s.in <= s.up && s.up < s.out && s.out < s.gone, `${s.key} ordered`);
  }
});

test('the splashes never overlap', () => {
  // Three credits dissolving through each other is three credits
  // nobody read. MUTANT: move nexus.in to 6.0 and this fails.
  for (let i = 1; i < SPLASHES.length; i++) {
    assert.ok(SPLASHES[i].in >= SPLASHES[i - 1].gone,
      `${SPLASHES[i].key} starts before ${SPLASHES[i - 1].key} is gone`);
  }
});

test('every splash is over before the intro is', () => {
  for (const s of SPLASHES) assert.ok(s.gone <= END_BAR, `${s.key} outlives the intro`);
  assert.ok(Math.abs(DURATION - 71.925) < 0.008);
});

test('ramp eases and clamps at both ends', () => {
  assert.equal(ramp(0, 1, 2), 0);
  assert.equal(ramp(3, 1, 2), 1);
  assert.ok(Math.abs(ramp(1.5, 1, 2) - 0.5) < 1e-9);
  // Smoothstep, not linear: the quarter point must sit BELOW a line.
  // MUTANT: drop the smoothstep and ramp(1.25) becomes 0.25.
  assert.ok(ramp(1.25, 1, 2) < 0.25);
  // A zero-width ramp is a step, not a divide by zero.
  assert.equal(ramp(5, 5, 5), 1);
  assert.equal(ramp(4, 5, 5), 0);
});

test('introState is finite everywhere, including past the end and before the start', () => {
  for (const t of [-5, 0, 0.001, 7.8, 19.114, 30.4, 60, 1e6]) {
    const st = introState(t);
    for (const v of [st.bar, st.open, st.close, st.camera.x, st.camera.y,
      st.camera.z, st.camera.yaw, st.camera.horizon]) {
      assert.ok(Number.isFinite(v), `non-finite at t=${t}`);
    }
    for (const s of st.splashes) assert.ok(s.opacity >= 0 && s.opacity <= 1);
  }
  assert.equal(introState(DURATION).done, true);
  assert.equal(introState(DURATION - 0.1).done, false);
});

// ═══════════════════════════════════════════════════════════════════
// THE CAMERA PATH
// ═══════════════════════════════════════════════════════════════════

test('the path is ordered and clamps outside itself', () => {
  for (let i = 1; i < PATH.length; i++) {
    assert.ok(PATH[i].bar > PATH[i - 1].bar, 'path keys must ascend');
  }
  assert.deepEqual(cameraAt(-100), { ...PATH[0] });
  assert.deepEqual(cameraAt(1e6), { ...PATH[PATH.length - 1] });
});

test('the flight runs EAST, into the sun', () => {
  // basis() says forward is (-sin, -cos), so EAST is -PI/2 and the sun
  // at bearing 0.18 is just south of due east. If the path ever turned
  // its back on the sun the glitter path - the thing the water is
  // built around - would be behind the camera for the whole intro.
  // MUTANT: EAST -> +PI/2 and every dot product below goes negative.
  for (const key of PATH) {
    const { fx, fy } = basis(key.yaw);
    const toSun = fx * Math.cos(SUN_BEARING) + fy * Math.sin(SUN_BEARING);
    assert.ok(toSun > 0.9, `bar ${key.bar} is not facing the sun (${toSun.toFixed(2)})`);
  }
  assert.ok(Math.abs(EAST + Math.PI / 2) < 1e-12);
});

test('bar 11 is a LIFT, not a leap', () => {
  // The first sheet jumped the altitude fivefold in one bar and it read
  // as a jerk - the music's event at bar 11 is the rhythm ARRIVING, and
  // the title cutting is what lands on it. MUTANT: put z back to 105 at
  // bar 11 and this fails.
  const before = cameraAt(10.0), after = cameraAt(11.0), later = cameraAt(14.0);
  assert.ok(after.z > before.z, 'bar 11 does not lift at all');
  assert.ok(after.z < before.z * 1.6, `bar 11 leaps (${before.z} -> ${after.z})`);
  assert.ok(later.z > after.z, 'the rise does not continue past the lift');
});

test('the flight climbs the whole way and never descends', () => {
  // A flyover that sinks in the middle reads as a stall. MUTANT: lower
  // any key below the one before it.
  // FROM THE LIFT ONWARD. Act I deliberately settles a few units lower
  // as it runs in off the ocean - the pin was written as "never
  // descends" and caught that drift, which is design and not a stall.
  // What must not happen is the RISE faltering once it has begun.
  for (let i = 1; i < PATH.length; i++) {
    if (PATH[i].bar < 11) continue;
    assert.ok(PATH[i].z >= PATH[i - 1].z, `bar ${PATH[i].bar} descends`);
    assert.ok(PATH[i].fov >= PATH[i - 1].fov, `bar ${PATH[i].bar} narrows`);
  }
  // And Act I is level, not a dive.
  for (const k of PATH) if (k.bar < 11) assert.ok(Math.abs(k.z - PATH[0].z) < 6, 'Act I is not level');
});

test('the low run stays below the peaks; the reveal is a ZOOM, not a climb', () => {
  const { height } = buildIliac({ w: 128, h: 80, seed: INTRO_MAP_SEED });
  let peak = 0;
  for (const h of height) if (h > peak) peak = h;
  // ALTITUDE IS NOT DRAMA ON ITS OWN. Through the bay the camera has to
  // stay under the ranges that frame it, or the shot stops looking
  // along the water and starts looking down at haze.
  for (const key of PATH) {
    if (key.bar <= 24) assert.ok(key.z < peak, `bar ${key.bar} flies above the highest ground`);
  }
  // And the final reveal is bought with the ANGLE. Altitude alone
  // cannot show a province whole in a shear-pitched renderer - it
  // pushes the foreground off the bottom as fast as it pulls the
  // distance down from the top. MUTANT: hold fov at 0.62 throughout and
  // this fails.
  // And the reveal is bought with a CHANGE OF PROJECTION, not with the
  // angle. Widening alone was the old answer and it still only managed
  // a corridor: the shear projection's nearest visible ground sits
  // eye*scaleH/(H-horizonY) ahead however wide it opens, so the picture
  // is always a wedge to a vanishing point.
  const last = PATH[PATH.length - 1];
  assert.ok(last.z > CLOUD_TOP, 'the flight does not reach the deck');
  assert.equal(introState(barTime(END_BAR - 0.5)).view, 'map');
});

test('the flight stays over the province', () => {
  // The old sheet had to give ground westward to a hundred cells off
  // the coast, because a shear-pitched camera could only buy width with
  // distance. ui/introSkyMap.js draws the reveal now, so the flight has
  // no reason to leave - and out past the north, south and east edges
  // the clamp repeats LAND, which the edge taper exists to dissolve at
  // a distance, not to make a place to park.
  for (const key of PATH) {
    assert.ok(key.x < INTRO_MAP_W, `bar ${key.bar} is off the EAST edge`);
    assert.ok(key.y >= 0 && key.y < INTRO_MAP_H, `bar ${key.bar} is off the north/south edge`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// THE MAP
// ═══════════════════════════════════════════════════════════════════

test('the authored shape puts sea in the bay and land on both shores', () => {
  // Read as geography. These are the STROKES' own claims and they are
  // what makes the picture the Iliac Bay rather than a lake.
  // NORTH-WEST, not due west: at (0.05, 0.50) the mouth capsule's own
  // 0.23 radius already reaches, so that point is sea whatever the
  // ocean stroke does - the first draft of this pin proved nothing
  // about the Eltheric and a mutant that deleted the ocean walked
  // straight through it. (0.05, 0.10) is out of every capsule's reach
  // and is sea if and only if the meridian puts it there.
  assert.ok(seaDistance(0.05, 0.10) < 0, 'the Eltheric is not sea');
  assert.ok(seaDistance(0.05, 0.90) < 0, 'the southern Eltheric is not sea');
  assert.ok(seaDistance(0.05, 0.50) < 0, 'the bay mouth is not open to the sea');
  assert.ok(seaDistance(0.30, 0.48) < 0, 'the bay mouth is not sea');
  assert.ok(seaDistance(0.72, 0.44) < 0, 'the bay head is not sea');
  assert.ok(seaDistance(0.45, 0.05) > 0, 'High Rock is not land');
  assert.ok(seaDistance(0.45, 0.95) > 0, 'Hammerfell is not land');
  assert.ok(seaDistance(0.95, 0.50) > 0, 'the far east is not land');
});

test('Balfiera is an ISLAND - land, with sea all around it', () => {
  // The stroke goes back in AFTER every cut. MUTANT: drop the
  // subtraction and Balfiera stops existing entirely.
  assert.ok(seaDistance(BALFIERA.x, BALFIERA.y) > 0, 'Balfiera is not land');
  const r = BALFIERA.r * 1.6;
  for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
    assert.ok(seaDistance(BALFIERA.x + dx, BALFIERA.y + dy) < 0,
      `Balfiera is joined to the shore at ${dx},${dy}`);
  }
});

test('capsuleDist is exact at its ends and along its axis', () => {
  const c = { x0: 0, y0: 0, x1: 1, y1: 0, r0: 0.1, r1: 0.2 };
  assert.ok(Math.abs(capsuleDist(0, 0, c) - -0.1) < 1e-12);
  assert.ok(Math.abs(capsuleDist(1, 0, c) - -0.2) < 1e-12);
  // Halfway along, the radius is the mean - that is the taper, and it
  // is what makes the bay narrow toward its head. MUTANT: use r0
  // everywhere and this fails.
  assert.ok(Math.abs(capsuleDist(0.5, 0.15, c) - 0), 1e-12);
  assert.ok(Math.abs(capsuleDist(0.5, 0.15, c)) < 1e-9);
  // A degenerate capsule is a disc, not a divide by zero.
  const d = { x0: 0.5, y0: 0.5, x1: 0.5, y1: 0.5, r0: 0.1, r1: 0.1 };
  assert.ok(Number.isFinite(capsuleDist(0.5, 0.5, d)));
});

test('the map is deterministic in its seed alone', () => {
  const a = buildIliac({ w: 96, h: 60, seed: 1234 });
  const b = buildIliac({ w: 96, h: 60, seed: 1234 });
  const c = buildIliac({ w: 96, h: 60, seed: 1235 });
  assert.deepEqual([...a.height], [...b.height], 'same seed, different map');
  assert.notDeepEqual([...a.height], [...c.height], 'different seed, same map');
  // A boot, a screenshot and a probe must all see one province.
  assert.deepEqual([...a.colour], [...b.colour]);
});

test('the map has sea, land and mountains in believable proportion', () => {
  const m = buildIliac({ w: 256, h: 160 });
  let sea = 0, peak = 0;
  for (const h of m.height) { if (h <= SEA_LEVEL) sea++; if (h > peak) peak = h; }
  const frac = sea / m.height.length;
  // A third to a half water. MUTANT: drop the 'west' stroke and this
  // falls under 0.2; widen the mouth capsule past 0.4 and it passes 0.5.
  assert.ok(frac > 0.28 && frac < 0.50, `sea fraction ${frac.toFixed(3)}`);
  assert.ok(peak > SEA_LEVEL + 120, `no mountains: peak ${peak}`);
  assert.ok(peak <= 255);
});

test('water is a FLAT floor, never below it', () => {
  // The renderer decides water by `hgt <= SEA_LEVEL`, so a cell below
  // the floor would be water that draws at the wrong height.
  const m = buildIliac({ w: 128, h: 80 });
  for (const h of m.height) assert.ok(h >= SEA_LEVEL, `height ${h} below the sea floor`);
});

test('the noise lattice is seeded, smooth and bounded', () => {
  const n = makeNoise(7);
  const m = makeNoise(7), o = makeNoise(8);
  assert.equal(n(3.3, 4.4), m(3.3, 4.4));
  assert.notEqual(n(3.3, 4.4), o(3.3, 4.4));
  for (const [x, y] of [[0, 0], [1.5, 2.5], [-3.2, 9.9], [1e4, 1e4]]) {
    const v = n(x, y);
    assert.ok(v >= 0 && v <= 1, `noise out of range at ${x},${y}`);
  }
  // Smoothstep interpolation, not linear: a lattice interpolated
  // linearly creases along the diagonals and a coastline drawn on it
  // shows the grid.
  const step = Math.abs(n(0.5, 0) - n(0.25, 0));
  assert.ok(Number.isFinite(step));
  for (const oct of [1, 3, 5]) {
    const v = octaveNoise(n, 0.3, 0.7, oct);
    assert.ok(v >= 0 && v <= 1, `fbm out of range at ${oct} octaves`);
    const r = ridged(n, 0.3, 0.7, oct);
    assert.ok(r >= 0 && r <= 1, `ridged out of range at ${oct} octaves`);
  }
});

test('lcg cursors are independent', () => {
  // Two cursors on one seed produce one sequence, and advancing either
  // does not move the other. That independence is why makeNoise can
  // hand every field its own cursor without them interfering - a
  // shared cursor would make the coast depend on how many octaves the
  // hills happened to ask for.
  const a = lcg(5), b = lcg(5);
  const seq = [a(), a(), a()];
  assert.deepEqual(seq, [b(), b(), b()]);
  const c = lcg(5);
  a(); a(); a();                   // move `a` well past `c`
  assert.equal(c(), seq[0], 'a fresh cursor is not at the start');
  // Different seeds, different sequences.
  assert.notEqual(lcg(5)(), lcg(6)());
  // In range, always.
  const d = lcg(12345);
  for (let i = 0; i < 200; i++) { const v = d(); assert.ok(v >= 0 && v < 1); }
});

test('STROKES are readable geography, not a magic array', () => {
  const names = STROKES.map((s) => s.name);
  for (const n of ['eltheric', 'mouth', 'throat', 'head']) {
    assert.ok(names.includes(n), `the ${n} stroke is missing`);
  }
  for (const s of STROKES) {
    assert.ok(['west', 'capsule', 'disc'].includes(s.kind), `unknown stroke kind ${s.kind}`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// THE RENDERER
// ═══════════════════════════════════════════════════════════════════

const tinyMap = () => buildIliac({ w: 128, h: 80, seed: 42 });

test('the mip pyramid halves, and AVERAGES rather than maxes', () => {
  const p = prepareMap(tinyMap(), 4);
  assert.equal(p.levels.length, 4);
  for (let l = 1; l < 4; l++) {
    assert.equal(p.levels[l].w, p.levels[l - 1].w >> 1);
    assert.equal(p.levels[l].h, p.levels[l - 1].h >> 1);
  }
  // A MAX pyramid grows distant ridges - every level takes the tallest
  // peak in its cell, so a range gets TALLER the further away it is,
  // which is the picket fence wearing another face. An average
  // pyramid's peak can only fall. MUTANT: use Math.max in prepareMap
  // and this fails.
  // THE PEAK IS THE WRONG STATISTIC. Max pooling PRESERVES the maximum
  // exactly (max of maxes is the same max), so `peak(l) <= peak(l-1)`
  // holds for a max pyramid too and the first draft of this pin let
  // the mutant through. The MEAN is what separates them: averaging
  // conserves it, and maxing drags every cell up toward its local
  // peak.
  const meanOf = (m) => { let t = 0; for (const h of m.height) t += h; return t / m.height.length; };
  const base = meanOf(p.levels[0]);
  for (let l = 1; l < 4; l++) {
    assert.ok(Math.abs(meanOf(p.levels[l]) - base) < 2,
      `level ${l} mean ${meanOf(p.levels[l]).toFixed(1)} drifted from ${base.toFixed(1)}`);
  }
});

test('mipFor picks a coarser level as the step grows, and never overruns', () => {
  assert.equal(mipFor(0.5, 5), 0);
  assert.ok(mipFor(8, 5) > mipFor(1, 5));
  // MUTANT: drop the count-1 clamp and a long step indexes off the end.
  assert.equal(mipFor(1e9, 5), 4);
  assert.equal(mipFor(1e9, 1), 0);
});

test('the camera is held above the rock', () => {
  const p = prepareMap(tinyMap());
  // THE CURTAINS. A camera inside the terrain projects a cell one step
  // away across the whole screen. MUTANT: return cam.z directly and
  // this fails on any peak.
  let hx = 0, hy = 0, best = 0;
  for (let y = 0; y < p.levels[0].h; y++) {
    for (let x = 0; x < p.levels[0].w; x++) {
      const h = p.levels[0].height[y * p.levels[0].w + x];
      if (h > best) { best = h; hx = x; hy = y; }
    }
  }
  assert.equal(clearedZ(p, { x: hx, y: hy, z: 0 }), best + CLEARANCE);
  assert.equal(clearedZ(p, { x: hx, y: hy, z: 9999 }), 9999);
  assert.ok(clearedZ(p, { x: hx, y: hy, z: best }) > best);
});

test('groundAt CLAMPS outside the map and never wraps', () => {
  const p = prepareMap(tinyMap());
  const w = p.levels[0].w, h = p.levels[0].h;
  // THE WALL. Wrapping made a sample one step west of the west edge
  // read the EAST edge - inland mountain, one step from the eye,
  // filling the screen. A torus is the wrong topology for a coastline.
  // MUTANT: restore the modulo wrap and this fails.
  assert.equal(groundAt(p, -1000, 5), groundAt(p, 0, 5));
  assert.equal(groundAt(p, w + 1000, 5), groundAt(p, w - 1, 5));
  assert.equal(groundAt(p, 5, -1000), groundAt(p, 5, 0));
  assert.equal(groundAt(p, 5, h + 1000), groundAt(p, 5, h - 1));
});

test('basis and the ray walk share ONE convention', () => {
  // yaw 0 looks north (-y); -PI/2 looks east (+x). These are the ray
  // walk's own vectors, derived from its scanline midpoint.
  const n = basis(0);
  assert.ok(Math.abs(n.fx - 0) < 1e-12 && Math.abs(n.fy + 1) < 1e-12);
  const e = basis(-Math.PI / 2);
  assert.ok(Math.abs(e.fx - 1) < 1e-12 && Math.abs(e.fy - 0) < 1e-12);
  // Forward and right are perpendicular and unit, or the projection
  // shears.
  for (const yaw of [0, 0.4, -1.2, 3.0, -Math.PI / 2]) {
    const b = basis(yaw);
    assert.ok(Math.abs(b.fx * b.rx + b.fy * b.ry) < 1e-12, 'basis not orthogonal');
    assert.ok(Math.abs(Math.hypot(b.fx, b.fy) - 1) < 1e-12, 'forward not unit');
    assert.ok(Math.abs(Math.hypot(b.rx, b.ry) - 1) < 1e-12, 'right not unit');
  }
});

test('the drawn sun is the SAME sun the world is lit by', () => {
  // THE BUG THIS PIN EXISTS FOR. The first build placed the disc with
  // tan(yaw - SUN_BEARING), a different angle convention from the ray
  // walk's, so the sun in the picture and the sun the water and the
  // hillsides were lit by were tens of degrees apart - and every
  // glitter-path symptom chased before that was found was a symptom of
  // it. MUTANT: place the sun with `yaw - SUN_BEARING` again and the
  // centred case below lands off screen.
  const W = 400, scaleH = 300;
  const sx = Math.cos(SUN_BEARING), sy = Math.sin(SUN_BEARING);
  // Facing straight at the sun puts it dead centre.
  const facing = Math.atan2(-sx, -sy);
  const centred = projectDirection(sx, sy, facing, W, scaleH);
  assert.ok(centred !== null && Math.abs(centred - W / 2) < 1e-6, `sun at ${centred}`);
  // Facing away puts it nowhere.
  assert.equal(projectDirection(sx, sy, facing + Math.PI, W, scaleH), null);
  // Turning left moves it right, and by the same amount either way.
  const left = projectDirection(sx, sy, facing + 0.3, W, scaleH);
  const right = projectDirection(sx, sy, facing - 0.3, W, scaleH);
  assert.ok(left !== null && right !== null);
  assert.ok(Math.abs((left - W / 2) + (right - W / 2)) < 1e-6, 'sun placement is asymmetric');
});

test('the sky runs dark at the top to warm at the horizon, and clamps', () => {
  const top = skyColour(0), mid = skyColour(0.5), horizon = skyColour(1);
  assert.ok(top[2] > top[0], 'the top of a dawn sky is blue');
  assert.ok(horizon[0] > horizon[2], 'the horizon of a dawn sky is warm');
  assert.ok(mid[0] > top[0] && mid[0] < horizon[0], 'the ramp is not monotone in red');
  assert.deepEqual(skyColour(5), horizon, 'past the horizon must clamp');
  assert.deepEqual(skyColour(-5), top, 'above the top must clamp');
  // The warm band HUGS the horizon - cubed, not linear. MUTANT: drop
  // the cube and the whole upper sky washes warm, which reads as a
  // sunset instead of a dawn.
  // THE BOUND HAS TO BE TIGHT ENOUGH TO SEE THE CUBE. Three quarters
  // of the way down, a LINEAR ramp is already 34% warm and a cubed one
  // is 4% - and the first draft only asked for "less than halfway",
  // which linear passes comfortably. 12% sits between them.
  // MEASURED FROM THE KNEE, not from the midpoint. The ramp has two
  // segments and the warm one starts at 0.62, so skyColour(0.5) is on
  // the OTHER segment and using it as the reference made a correct
  // cubed ramp read as 0.13 warm - a pin failing the code for being
  // right, which is worse than one that passes the code for being
  // wrong because it looks like a real defect.
  const knee = skyColour(0.62);
  const three4 = skyColour(0.75);
  const warmth = (three4[0] - knee[0]) / (horizon[0] - knee[0]);
  assert.ok(warmth < 0.12, `the warm band is not hugging the horizon (${warmth.toFixed(2)})`);
});

test('the wave spectrum is DIAGONAL and tiles seamlessly', () => {
  // THE PLAID. sin(x)*cos(y) is a separable product, which is not a
  // wave, it is a checkerboard - and the sea came back a tablecloth
  // twice before that was read rather than re-tuned. A travelling wave
  // has both components non-zero. MUTANT: set any ky to 0 and this
  // fails.
  for (const c of WAVE_SPECTRUM) {
    assert.ok(c.kx !== 0 && c.ky !== 0, `component ${c.kx},${c.ky} is axis-aligned`);
    assert.ok(Number.isInteger(c.kx) && Number.isInteger(c.ky), 'non-integer k will not tile');
  }
  // It must WRAP, or a seam marches across the water. Every component
  // being an integer number of cycles across the tile is what buys it.
  const out = new Float32Array(WAVE_N * WAVE_N);
  waveTable(out, 1.234);
  const s = (2 * Math.PI) / WAVE_N;
  let norm = 0; for (const c of WAVE_SPECTRUM) norm += c.amp;
  for (let j = 0; j < WAVE_N; j += 17) {
    // The value one cell PAST the last column, computed directly, must
    // equal column 0.
    let v = 0;
    for (const c of WAVE_SPECTRUM) v += c.amp * Math.sin(c.kx * (WAVE_N * s) + c.ky * (j * s) - c.spd * 1.234);
    assert.ok(Math.abs(v / norm - out[j * WAVE_N]) < 1e-6, `seam at row ${j}`);
  }
});

test('posterise quantises to LEVELS and dithers by SCREEN position', () => {
  const W = 8, H = 8;
  const flat = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  for (let i = 0; i < W * H; i++) {
    flat.data[i * 4] = 130; flat.data[i * 4 + 1] = 130; flat.data[i * 4 + 2] = 130;
    flat.data[i * 4 + 3] = 255;
  }
  posterise(flat);
  const seen = new Set();
  for (let i = 0; i < W * H; i++) seen.add(flat.data[i * 4]);
  // DITHER THEN QUANTISE. A flat mid-grey must come out as at least two
  // levels straddling it, or the dither is doing nothing and the sky
  // will band. MUTANT: drop the Bayer term and every pixel is one value.
  assert.ok(seen.size >= 2, 'the dither is not straddling the boundary');
  // THE RAMP IS THE ROUNDED ONE. The buffer is a Uint8ClampedArray, so
  // a step of 255/10 = 25.5 lands as 128 and not 127.5 - and the first
  // draft of this pin asserted the exact arithmetic instead of what
  // the code can actually store, which made it a pin on my division
  // rather than on the posteriser.
  const q = 255 / (LEVELS - 1);
  const ramp8 = new Set();
  for (let i = 0; i < LEVELS; i++) ramp8.add(Math.round(i * q));
  for (const v of seen) assert.ok(ramp8.has(v), `${v} is not on the ramp`);
  // The pattern is keyed to screen position, so it repeats every 4 px.
  const at = (x, y) => flat.data[(y * W + x) * 4];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    assert.equal(at(x, y), at(x + 4, y), 'dither does not repeat on 4');
    assert.equal(at(x, y), at(x, y + 4), 'dither does not repeat on 4');
  }
});

test('a frame draws: opaque everywhere, sky above, ground below, no NaN', () => {
  const p = prepareMap(tinyMap());
  const W = 96, H = 54;
  const buf = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  const cam = { x: 20, y: 40, z: 60, yaw: EAST, horizon: 0.5 };
  drawFlyover(buf, p, cam, 2.0);
  for (let i = 0; i < W * H; i++) {
    assert.equal(buf.data[i * 4 + 3], 255, `pixel ${i} is not opaque`);
  }
  // The sky is drawn first and whole, so no pixel is ever left unset -
  // which is the fix for a column whose land never rises keeping the
  // PREVIOUS frame. MUTANT: skip the sky fill and a second draw over a
  // pre-poisoned buffer keeps the poison.
  const poisoned = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(7) };
  drawFlyover(poisoned, p, cam, 2.0);
  // ALPHA IS THE ONLY WITNESS. The posteriser runs last and rewrites
  // every RGB channel, so a pixel the sky pass skipped comes out with
  // its poison QUANTISED - 7 becomes 0 - and a test looking for the
  // literal 7 in red sees nothing. Alpha is not posterised, so it
  // still carries the fingerprint.
  let stale = 0;
  for (let i = 0; i < W * H; i++) if (poisoned.data[i * 4 + 3] !== 255) stale++;
  assert.equal(stale, 0, 'the frame left pixels from the previous one');
});

test('a frame over open sea is not a frame over mountains', () => {
  // Cheap proof the camera is actually driving the picture, which no
  // amount of "it drew something" catches.
  const p = prepareMap(tinyMap());
  const W = 64, H = 36;
  const shot = (cam) => {
    const b = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
    drawFlyover(b, p, cam, 0);
    return b.data.join(',');
  };
  const a = shot({ x: 4, y: 40, z: 60, yaw: EAST, horizon: 0.5 });
  const b = shot({ x: 100, y: 12, z: 60, yaw: EAST, horizon: 0.5 });
  assert.notEqual(a, b, 'the camera is not reaching the renderer');
  // And the same camera twice is the same frame: the land is static,
  // only the water moves with t.
  assert.equal(a, shot({ x: 4, y: 40, z: 60, yaw: EAST, horizon: 0.5 }));
});

test('the fog never closes completely', () => {
  // Haze carries DEPTH, which means the far ridge must still read as a
  // ridge. MUTANT: FOG_MAX = 1 and the second half of the flight is a
  // flat warm wash, which is exactly what the first build looked like.
  assert.ok(FOG_MAX > 0 && FOG_MAX < 1, `FOG_MAX ${FOG_MAX}`);
});

test('the onsets are MEASURED, not the grid times written back', () => {
  // The table's whole value is that it is data about the recording. If
  // the numbers were transcribed from the grid column of the analysis
  // instead of the onset column - which is exactly what happened to
  // three of the four later bars - then every fit test asserts my own
  // arithmetic back at me and passes forever. Real onsets JITTER around
  // a grid; a grid does not jitter around itself.
  // MUTANT: replace the onsets with barTime values and this fails.
  let sum = 0;
  for (let i = 0; i < MEASURED_ONSETS.length; i++) {
    const err = Math.abs(MEASURED_ONSETS[i] - barTime(MEASURED_BARS[i]));
    assert.notEqual(err, 0, `bar ${MEASURED_BARS[i]} sits exactly on the grid`);
    sum += err;
  }
  const mae = sum / MEASURED_ONSETS.length;
  assert.ok(mae > 0.0015, `onsets show no jitter (MAE ${(mae * 1000).toFixed(1)} ms) - are these grid times?`);
});

test('the camera FIELD OF VIEW reaches the renderer', () => {
  // Widening the angle IS the final reveal - altitude alone cannot show
  // the province whole. MUTANT: ignore cam.fov and use the default, and
  // the two frames below become identical.
  const p = prepareMap(tinyMap());
  const W = 96, H = 54;
  const shot = (fov) => {
    const b = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
    drawFlyover(b, p, { x: 20, y: 40, z: 90, yaw: EAST, horizon: 0.4, fov }, 0);
    return b.data.join(',');
  };
  assert.notEqual(shot(1.12), shot(0.62), 'cam.fov is not reaching the projection');
  // And no fov means the default, not a crash or a black frame.
  const b = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  drawFlyover(b, p, { x: 20, y: 40, z: 90, yaw: EAST, horizon: 0.4 }, 0);
  assert.equal(b.data.join(','), shot(DEFAULT_FOV));
});

test('edgeFade converts mip cells to WORLD units by dividing', () => {
  // THE STREAKS. At level 0 either arithmetic looks right, which is why
  // the bug survived a first fix and the bands came back identical - it
  // only shows at the COARSE levels, and those are exactly where the
  // distant edge samples are taken. MUTANT: multiply by sc instead.
  assert.equal(edgeFade(0, 1), 0);
  assert.equal(edgeFade(EDGE_TAPER, 1), 1);
  assert.ok(Math.abs(edgeFade(EDGE_TAPER / 2, 1) - 0.5) < 1e-9);
  // One taper's worth of WORLD units at mip level 3 is EDGE_TAPER/8
  // level-cells, and it must still be a full fade.
  assert.equal(edgeFade(EDGE_TAPER / 8, 1 / 8), 1);
  assert.ok(Math.abs(edgeFade(EDGE_TAPER / 16, 1 / 8) - 0.5) < 1e-9);
  assert.equal(edgeFade(1e9, 1 / 16), 1, 'the fade must saturate, not overshoot');
});

test('the world beyond the map is OPEN SEA, not a wall or a stripe', () => {
  // Everything the widest shot shows outside the province passes
  // through here, and three separate defects all landed in this one
  // region: the clamp repeating a mountain row as a horizontal BAND,
  // the height tapering while the COLOUR stayed mountain-coloured, and
  // the haze mixing toward a single warm horizon colour so the
  // Eltheric came back as a tan plane. One frame that can see nothing
  // BUT the outside catches all three.
  const p = prepareMap(buildIliac({ w: 256, h: 160, seed: 42 }));
  const W = 160, H = 90;
  const b = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  // Far off the north edge, looking further north: every sample is out.
  drawFlyover(b, p, { x: 128, y: -900, z: 200, yaw: 0, horizon: 0.35, fov: DEFAULT_FOV }, 0);
  let r = 0, g = 0, bl = 0, n = 0, maxLum = 0;
  for (let y = Math.round(H * 0.45); y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      r += b.data[o]; g += b.data[o + 1]; bl += b.data[o + 2]; n++;
      const l = (b.data[o] + b.data[o + 1] + b.data[o + 2]) / 3;
      if (l > maxLum) maxLum = l;
    }
  }
  r /= n; g /= n; bl /= n;
  // Sea is BLUE-dominant. Land colours out here are green or tan, and
  // the warm haze is tan; all of them put red at or above blue.
  assert.ok(bl > r + 15, `beyond the map is not sea (r=${r | 0} g=${g | 0} b=${bl | 0})`);
  // And nothing out there is bright. A repeated snow-capped edge row
  // reads as a white stripe long before it moves the mean.
  assert.ok(maxLum < 190, `something bright is out beyond the map (maxLum ${maxLum | 0})`);
  assert.ok(OCEAN[2] > OCEAN[0], 'the ocean constant is not blue');
});

test('projection derives the vertical scale from the WIDTH', () => {
  // Or the picture stretches when the window does - pixelGround's own
  // lesson, learned on a portrait phone.
  const wide = projection(800, 200), tall = projection(800, 900);
  assert.equal(wide.scaleH, tall.scaleH);
  assert.ok(projection(1600, 400).scaleH > wide.scaleH);
});

// ═══════════════════════════════════════════════════════════════════
// THE THEME, AND THE HOST'S CONSTANTS
// ═══════════════════════════════════════════════════════════════════

test('the theme never throws, and reports honestly when it cannot play', () => {
  _resetForTests();
  assert.equal(themeTime(), null, 'no element means no clock');
  stopTheme();                       // must be safe with nothing to stop
  assert.equal(themeTime(), null);
});

test('a theme that will not construct resolves rather than rejecting', async () => {
  _resetForTests();
  const r = await startTheme({ make: () => null });
  assert.equal(r.playing, false);
  assert.equal(r.element, null);
  // The intro's next move is the wall clock, and it must be able to
  // take it without a try/catch at every call site.
  assert.equal(themeTime(), null);
  _resetForTests();
});

test('a theme blocked by autoplay resolves playing:false, not an error', async () => {
  _resetForTests();
  const el = {
    readyState: 4, paused: true, volume: 1, currentTime: 0,
    play: () => Promise.reject(new Error('NotAllowedError')),
    pause() { this.paused = true; },
    addEventListener() {}, removeEventListener() {},
  };
  const r = await startTheme({ make: () => el, timeoutMs: 5 });
  // Expected on a cold load - the enhanced door is the FIRST screen, so
  // there has been no gesture. Not an error, and not worked around.
  assert.equal(r.playing, false);
  assert.equal(r.element, el);
  _resetForTests();
});

test('a playing theme is the clock; a paused one is not', async () => {
  _resetForTests();
  const el = {
    readyState: 4, paused: true, volume: 1, currentTime: 12.5,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
    addEventListener() {}, removeEventListener() {},
  };
  const r = await startTheme({ make: () => el, timeoutMs: 5 });
  assert.equal(r.playing, true);
  assert.equal(themeTime(), 12.5);
  el.paused = true;
  // MUTANT: drop the paused check and a stopped song reports a frozen
  // clock forever, which parks the intro on one frame.
  assert.equal(themeTime(), null);
  _resetForTests();
});

test('the theme reads MusicVolume rather than carrying its own', async () => {
  _resetForTests();
  const el = {
    readyState: 4, paused: true, volume: -1, currentTime: 0,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
    addEventListener() {}, removeEventListener() {},
  };
  await startTheme({ make: () => el, timeoutMs: 5 });
  // Whatever the setting says, it is a real gain in 0..1 and it came
  // from the store - not from a literal in this module.
  assert.ok(el.volume >= 0 && el.volume <= 1, `volume ${el.volume}`);
  _resetForTests();
});

test('every splash in the sheet has art and a width, and no orphans', () => {
  // A cue with no art draws nothing and a URL with no cue never loads:
  // both are silent, which is why they get a pin.
  for (const s of SPLASHES) {
    assert.ok(SPLASH_URL[s.key], `no art for ${s.key}`);
    assert.ok(SPLASH_WIDTH[s.key] > 0, `no width for ${s.key}`);
  }
  assert.deepEqual(Object.keys(SPLASH_URL).sort(), SPLASHES.map((s) => s.key).sort());
  assert.deepEqual(Object.keys(SPLASH_WIDTH).sort(), SPLASHES.map((s) => s.key).sort());
  assert.ok(THEME_URL.startsWith('intro/'));
  assert.ok(MAX_BUFFER_W >= 256 && MAX_BUFFER_W <= 1024);
});
