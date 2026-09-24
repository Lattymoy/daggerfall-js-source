// WEATHER3i (2026-09-23, Mac on WEATHER3h's render: "Let's make this more subtle and push the detail further";
// the detail chosen: "Strength inside a region"): THE STRENGTH OF WHAT FALLS, on the map and under the sky. The law's
// intensity now tapers across the CORE, where the system's word falls - a drizzle at the rain's edge, the downpour at
// its heart - where before it tapered across the whole outline and a grown front's rain never fell below 0.73. The
// travel map draws it: each region that falls closes its hatch up a step where the fall is moderate and again where it
// is heavy, one law with the words the hover reads and the rain the player feels; and every weather's hand is a third
// lighter than WEATHER3h's. AUDIT-3i (three lenses, before it shipped) found the steps rounded past their regions, the
// dots set in rows, the steps drawn under their own light hatch on the sheet, the player's strength read before the
// ground law and the hover at another minute than the hatch - and pins that a wrong painter, host or hatch passed.
// Each is paid and pinned here by execution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bandAt, EDGE_INTENSITY, wornAmong, systemsNear, weatherAt, forecastAt, PRIORITY,
} from '../src/systems/weatherMap.js';
import {
  strengthOf, STRENGTH_STEPS, strengthShifts, weatherPhrase, weatherField, fieldRegions, fieldStrength, FIELD_WORDS,
  paintWeatherRegions, paintWeatherLegend, strengthPattern, hatchPattern, HATCH, HATCH_TILE, OUTLINE_PX,
  LEGEND_STRENGTH_TEXT, LEGEND_STRENGTH_WORD, LEGEND_ROWS, WEATHER_NAMES, fieldOfMapPixel, forecastText, WEATHER_FORECAST_HOURS,
} from '../src/ui/weatherLayer.js';
import {
  resetWeatherSim, setWeatherFieldLaw, setWeatherMapLaw, setSnowGroundLaw, sampleWeatherField, currentWeather,
  currentWeatherRaw, currentWeatherIntensity, currentFieldCell, mapGround,
} from '../src/systems/weatherSim.js';
import { HeldMapWindow } from '../src/ui/heldMap.js';
import { TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { MAX_MAP_PIXEL_Y, CLIMATES } from '../src/formats/mapsFile.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const YEAR = 405 * 360 * 1440;
const WINTER = YEAR + 20 * 1440;
const FALLS = ['rain', 'thunder', 'snow', 'sandstorm'];
const WOODS = CLIMATES.Woodlands;
const woods = () => WOODS;
function lane() { resetWeatherSim(); setWeatherFieldLaw(true); setWeatherMapLaw(true); setSnowGroundLaw(true); }

test('WEATHER3i: THE LAW - the intensity tapers across the core, a drizzle at the rain\'s edge and the downpour at its heart; the rings hold the edge\'s', () => {
  // WEATHER3a's own range, the whole envelope at the heart and a fifth at the edge, moved from the outline to the core
  assert.ok(Math.abs(EDGE_INTENSITY - (1 - 0.8)) < 1e-12, `the edge ${EDGE_INTENSITY}, WEATHER3a's own`);
  const core = 40000, env = 0.8;
  const front = { r: core * Math.sqrt(3), env, bands: [[core, 'rain'], [core * Math.sqrt(2), 'overcast'], [core * Math.sqrt(3), 'cloudy']] };
  assert.equal(bandAt(front, 0).intensity, env, 'the whole envelope at the heart');
  assert.ok(Math.abs(bandAt(front, core - 1e-6).intensity - env * EDGE_INTENSITY) < 1e-9, 'a fifth of it at the rain\'s edge');
  assert.ok(Math.abs(bandAt(front, core * 1.2).intensity - env * EDGE_INTENSITY) < 1e-12 && Math.abs(bandAt(front, core * 1.7).intensity - env * EDGE_INTENSITY) < 1e-12, 'the rings hold the edge\'s');
  for (let d = 0; d < core; d += core / 50) assert.ok(bandAt(front, d).intensity >= bandAt(front, d + core / 50).intensity, 'never rising outward');
  // over the core's AREA the intensity is uniform on [edge, 1] x env: a grown core is 19% light, 44% moderate and
  // 37% heavy (the record's numbers), where before it was heavy to its edge
  const grown = { ...front, env: 1 };
  const n = 20000, count = [0, 0, 0];
  for (let i = 0; i < n; i++) count[strengthOf('rain', bandAt(grown, core * Math.sqrt((i + 0.5) / n)).intensity)]++;
  [0.1875, 0.4375, 0.375].forEach((want, k) => assert.ok(Math.abs(count[k] / n - want) < 1e-3, `step ${k}: ${(count[k] / n).toFixed(4)} of a grown core, ${want} by the law`));
  // a storm cell has no rings: its core is its outline, as before
  const cell = { r: 8000, env: 1, bands: [[8000, 'thunder']] };
  assert.ok(Math.abs(bandAt(cell, 4000).intensity - (1 - (1 - EDGE_INTENSITY) * 0.25)) < 1e-12);
  // a core of no size is all edge, never NaN
  assert.ok(Math.abs(bandAt({ r: 5, env: 1, bands: [[0, 'rain'], [5, 'overcast']] }, 0).intensity - EDGE_INTENSITY) < 1e-12);
});

test('WEATHER3i: ONE STRENGTH LAW - the words a hover reads and the steps the map draws; only what falls has one', () => {
  // the hover's words as WEATHER3e shipped them (its forecast reads "Rain, heavy" at 0.9 and the name alone at 0.5)
  assert.deepEqual([...STRENGTH_STEPS], [0.35, 0.7]);
  for (const w of FALLS) {
    for (let i = 0; i <= 1000; i++) {
      const v = i / 1000, k = strengthOf(w, v), phrase = weatherPhrase(w, v);
      assert.equal(k, (v >= STRENGTH_STEPS[0]) + (v >= STRENGTH_STEPS[1]));
      assert.equal(phrase, k === 2 ? `${WEATHER_NAMES[w]}, heavy` : k === 0 ? `${WEATHER_NAMES[w]}, light` : WEATHER_NAMES[w], `${w} at ${v}`);
    }
  }
  for (const w of ['sunny', 'cloudy', 'overcast', 'fog']) assert.equal(strengthOf(w, 1), 0, `${w} does not fall`);
});

// a sheet over the heart of the bay: its pixel (0, 0) at the bay's (400, 200), the systems moved into its frame
function sheet(days, { width = 120, height = 70, hour = 15 } = {}) {
  const ground = mapGround(woods);
  for (const day of days) {
    const m = YEAR + day * 1440 + hour * 60;
    const [cx, cz] = fieldOfMapPixel(400 + width / 2, 200 + height / 2);
    const systems = systemsNear(cx, cz, m, woods, Math.hypot(width, height) * TERRAIN_SIZE)
      .map((s) => ({ ...s, x: s.x - 400 * TERRAIN_SIZE, z: s.z + 200 * TERRAIN_SIZE, clip: s.clip && [s.clip[0] - 400 * TERRAIN_SIZE, s.clip[1] + 200 * TERRAIN_SIZE, s.clip[2], s.clip[3]] }));
    const g = (w, x, z) => ground(w, x + 400 * TERRAIN_SIZE, z - 200 * TERRAIN_SIZE, m);
    const field = weatherField(systems, { width, height, ground: g });
    if (field.strength.includes(2) && field.strength.includes(1)) return { field, systems, ground: g, m };
  }
  throw new Error('no minute with a fall of every strength');
}

test('WEATHER3i: THE FIELD CARRIES THE STRENGTH - every cell the step of the worn word\'s intensity there through the ground law, summer and winter', () => {
  lane();
  for (const days of [[170, 100, 290, 250], [20, 10, 30, 350, 5]]) {
    const { field, systems, ground } = sheet(days);
    const { cols, rows, cell, words, strength } = field;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const x = (gx + 0.5) * cell * TERRAIN_SIZE, z = (MAX_MAP_PIXEL_Y - (gy + 0.5) * cell) * TERRAIN_SIZE;
        const worn = wornAmong(systems, x, z, ground);
        assert.equal(FIELD_WORDS[words[gy * cols + gx]], worn.word);
        assert.equal(strength[gy * cols + gx], strengthOf(worn.word, worn.intensity), `cell ${gx},${gy}`);
      }
    }
  }
});

test('WEATHER3i: THE PLAYER FEELS WHAT THE MAP DRAWS - the sim wears the strongest of what falls AFTER the ground law, and keeps the storm\'s own word', () => {
  // on winter ground a rain front under a snow front is snow: the strongest snow there is what falls. Read raw, the
  // sim wore the rain front's intensity (rain outranks snow) where the map drew the snow front's
  lane();
  const ground = mapGround(woods);
  let differs = 0, checked = 0;
  for (let i = 0; i < 20000 && differs < 6; i++) {
    const x = 60000 + (i % 157) * 5003, z = 60000 + Math.floor(i / 157) * 4001, m = WINTER + (i % 31) * 1440 + (i % 7) * 180;
    const g = (w, gx, gz) => ground(w, gx, gz, m);
    const near = systemsNear(x, z, m, woods, 0);
    const worn = wornAmong(near, x, z, g), raw = wornAmong(near, x, z);
    if (!FALLS.includes(worn.word)) continue;
    const bite = strengthOf(worn.word, worn.intensity) !== strengthOf(worn.word, raw.intensity);
    if (!bite && checked > 20) continue;
    lane();
    sampleWeatherField(m, WOODS, [x, z], woods, 'jump');
    assert.equal(currentWeather(), worn.word);
    assert.equal(currentWeatherIntensity(), worn.intensity, 'the strength the player feels is the one the map draws there');
    assert.equal(currentWeatherRaw(), worn.raw, 'the painting storm\'s own word, for the sky\'s violence');
    assert.equal(worn.intensity, weatherAt(x, z, m, woods, { ground }).intensity, 'and the hover\'s');
    // the cloud overhead is the worn word's - a winter rain front's cell is a snow cloud, as the word is
    if (currentFieldCell()) assert.equal(currentFieldCell().word, worn.word);
    checked++;
    if (bite) differs++;
  }
  assert.ok(differs >= 3, `${differs} places where reading raw would have worn another strength`);
});

// the signed area of loops (nonzero: outer shores one way, holes the other), and a winding test
const area = (loops) => loops.reduce((a, { pts }) => a + pts.reduce((s, p, i) => (i ? s + (pts[i - 1].x * p.y - p.x * pts[i - 1].y) / 2 : 0), 0), 0);
function winding(loops, x, y) {
  let w = 0;
  for (const { pts } of loops) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const cross = (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y);
      if (a.y <= y && b.y > y && cross > 0) w++;
      else if (a.y > y && b.y <= y && cross < 0) w--;
    }
  }
  return w;
}

test('WEATHER3i: THE STRENGTH NESTS - heavy within moderate within the word\'s own region, whole (no holes), rounded, only for what falls', () => {
  // a made field: a rain block, moderate in its middle and heavy at its heart; an overcast block beside it, and a
  // storm cell, moderate through, below it - a step is its own word's, never its neighbour's
  const cols = 60, rows = 40, words = new Uint8Array(cols * rows), strength = new Uint8Array(cols * rows);
  const RAIN = FIELD_WORDS.indexOf('rain'), OVER = FIELD_WORDS.indexOf('overcast'), STORM = FIELD_WORDS.indexOf('thunder');
  for (let gy = 30; gy < 36; gy++) for (let gx = 40; gx < 50; gx++) { words[gy * cols + gx] = STORM; strength[gy * cols + gx] = 1; }
  for (let gy = 5; gy < 25; gy++) {
    for (let gx = 5; gx < 25; gx++) {
      words[gy * cols + gx] = RAIN;
      const d = Math.max(Math.abs(gx - 14.5), Math.abs(gy - 14.5));
      strength[gy * cols + gx] = d < 3 ? 2 : d < 7 ? 1 : 0;
    }
    for (let gx = 35; gx < 55; gx++) { words[gy * cols + gx] = OVER; strength[gy * cols + gx] = 0; }
  }
  const field = { cols, rows, cell: 2, words, strength };
  const regions = fieldRegions(field), st = fieldStrength(field);
  assert.deepEqual(Object.keys(st).sort(), ['rain', 'thunder'], 'overcast does not fall');
  assert.equal(st.thunder[0].length, 1, 'the storm\'s own moderate loop');
  assert.equal(st.thunder[1].length, 0, 'and no heavy one');
  const [moderate, heavy] = st.rain;
  const a = [area(regions.rain), area(moderate), area(heavy)].map(Math.abs);
  assert.ok(a[0] > a[1] && a[1] > a[2] && a[2] > 0, `the steps nest: ${a.map((v) => v.toFixed(0))}`);
  // at least moderate means the heavy heart too: the heart's middle is inside the moderate loops, not a hole in them
  assert.equal(winding(moderate, 15 * 2, 15 * 2), winding(regions.rain, 15 * 2, 15 * 2));
  assert.notEqual(winding(heavy, 15 * 2, 15 * 2), 0);
  assert.equal(winding(moderate, 45 * 2, 33 * 2), 0, 'the storm\'s cells are not the rain\'s step');
  // rounded in the coast's hand as the regions are: no leg turns as sharply as a staircase's corner
  for (const loops of [moderate, heavy, st.thunder[0]]) {
    for (const { pts } of loops) {
      for (let i = 1; i < pts.length - 1; i++) {
        const [p, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
        const t = Math.abs(Math.atan2((b.x - p.x) * (c.y - b.y) - (b.y - p.y) * (c.x - b.x), (b.x - p.x) * (c.x - b.x) + (b.y - p.y) * (c.y - b.y)));
        assert.ok(t < (70 * Math.PI) / 180, `a turn of ${(t * 180 / Math.PI).toFixed(0)} degrees`);
      }
    }
  }
});

// a canvas whose patterns say what was drawn on their tile
function patternCanvas() {
  globalThis.document = {
    createElement: () => {
      const calls = [];
      const t = new Proxy({}, { get: (_, k) => (...a) => calls.push({ fn: k, a }), set: (_, k, v) => { calls.push({ fn: `=${k}`, v }); return true; } });
      return { calls, getContext: () => t };
    },
  };
}
const T = HATCH_TILE;
const wrap = (v) => ((v % T) + T) % T;
const torus = (a, b) => { const dx = Math.min(wrap(a[0] - b[0]), wrap(b[0] - a[0])), dy = Math.min(wrap(a[1] - b[1]), wrap(b[1] - a[1])); return Math.hypot(dx, dy); };
const minSpacing = (pts) => { let m = Infinity; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, torus(pts[i], pts[j])); return m; };
const placed = (marks, shifts) => shifts.flatMap(([sx, sy]) => marks.map(([x, y]) => [wrap(x + sx), wrap(y + sy)]));

test('WEATHER3i: THE HAND - each step the word\'s own marks, whole, at its shifts and around the tile; no tint of its own', () => {
  patternCanvas();
  try {
    const ctx = { createPattern: (tile) => ({ tile }) };
    for (const w of FALLS) {
      const h = HATCH[w];
      assert.ok(hatchPattern(ctx, w).tile.calls.some((c) => c.fn === 'fillRect'), `${w}: the light hatch carries the word's tint`);
      for (const m of [...(h.lines ?? []).flat(), ...(h.dots ?? []).flat()]) assert.ok(m >= 0 && m <= T, `${w}: its marks on the ${T} px tile`);
      for (let k = 0; k <= STRENGTH_STEPS.length; k++) {
        const p = k ? strengthPattern(ctx, w, k) : hatchPattern(ctx, w);
        if (k) assert.ok(!p.tile.calls.some((c) => c.fn === 'fillRect'), `${w} step ${k}: no tint of its own - the step is the hatch closing up`);
        for (const [sx, sy] of strengthShifts(w, k)) assert.ok(Number.isInteger(sx) && Number.isInteger(sy) && sx >= 0 && sx < T && sy >= 0 && sy < T);
        // every mark drawn is one of the word's marks at one of the step's shifts, in the tile or one around it - whole
        const around = strengthShifts(w, k).flatMap(([sx, sy]) => [-T, 0, T].flatMap((ox) => [-T, 0, T].map((oy) => [sx + ox, sy + oy])));
        const key = (v) => v.map((n) => n.toFixed(6)).join(',');
        if (h.lines) {
          const drawn = [];
          p.tile.calls.forEach((c, i) => { if (c.fn === 'moveTo') { const l = p.tile.calls[i + 1]; assert.equal(l.fn, 'lineTo'); drawn.push(key([...c.a, ...l.a])); } });
          const want = around.flatMap(([u, v]) => h.lines.map(([a, b, c, d]) => key([a + u, b + v, c + u, d + v])));
          assert.deepEqual(drawn.sort(), want.sort(), `${w} step ${k}: the word's own lines, end to end`);
        } else {
          const drawn = p.tile.calls.filter((c) => c.fn === 'arc').map((c) => key([c.a[0], c.a[1]]));
          const want = around.flatMap(([u, v]) => h.dots.map(([x, y]) => key([x + u, y + v])));
          assert.deepEqual(drawn.sort(), want.sort(), `${w} step ${k}: the word's own dots, where the step sets them`);
        }
      }
    }
  } finally { delete globalThis.document; }
});

test('WEATHER3i: EACH STEP DOUBLES THE MARKS, EVENLY - lines twice as close each step, dots as even as their count allows (proven by search)', () => {
  const steps = STRENGTH_STEPS.length;
  // lines: every family's lines across their own direction, evenly spaced, twice as close each step
  for (const w of ['rain', 'thunder']) {
    for (const [a, b, c, d] of HATCH[w].lines) {
      const nx = -(d - b), ny = c - a, len = Math.hypot(nx, ny);   // the family's normal
      let offsets = [];
      for (let k = 0; k <= steps; k++) {
        offsets = [...offsets, ...strengthShifts(w, k).map(([sx, sy]) => (a + sx) * nx / len + (b + sy) * ny / len)];
        const period = (T * Math.max(Math.abs(nx), Math.abs(ny))) / len;   // a tile's repeat, across the family
        const o = offsets.map((v) => ((v % period) + period) % period).sort((p, q) => p - q);
        const gaps = o.map((v, i) => (i ? v - o[i - 1] : v + period - o.at(-1)));
        for (const g of gaps) assert.ok(Math.abs(g - period / 2 ** k) < 1e-9, `${w} step ${k}: lines ${(period / 2 ** k).toFixed(2)} apart, found ${g.toFixed(2)}`);
      }
    }
  }
  // dots: each step's shifts leave the most room any shift could - found by trying them all
  const cands = []; for (let x = 0; x < T; x++) for (let y = 0; y < T; y++) if (x || y) cands.push([x, y]);
  for (const w of ['snow', 'sandstorm']) {
    const base = HATCH[w].dots;
    const mod = [...base, ...placed(base, strengthShifts(w, 1))];
    let best1 = 0; for (const s of cands) best1 = Math.max(best1, minSpacing([...base, ...placed(base, [s])]));
    assert.ok(Math.abs(minSpacing(mod) - best1) < 1e-9, `${w} moderate: ${minSpacing(mod).toFixed(2)} apart, the best is ${best1.toFixed(2)}`);
    let best2 = 0;
    for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) best2 = Math.max(best2, minSpacing([...mod, ...placed(base, [cands[i], cands[j]])]));
    const heavy = [...mod, ...placed(base, strengthShifts(w, 2))];
    assert.ok(Math.abs(minSpacing(heavy) - best2) < 1e-9, `${w} heavy: ${minSpacing(heavy).toFixed(2)} apart, the best is ${best2.toFixed(2)}`);
    assert.equal(heavy.length, base.length * 4, 'twice the marks each step');
    assert.ok(minSpacing(heavy) > 2 * 1.1 + 1, `${w}: the heaviest dots never touch`);
  }
  // snow's reach the perfect lattices: 8 px square, then its stagger 5.66 px
  assert.equal(minSpacing([...HATCH.snow.dots, ...placed(HATCH.snow.dots, strengthShifts('snow', 1))]), T / 2);
  assert.ok(Math.abs(minSpacing([...HATCH.snow.dots, ...placed(HATCH.snow.dots, [...strengthShifts('snow', 1), ...strengthShifts('snow', 2)])]) - T / 2 / Math.SQRT2) < 1e-9);
});

test('WEATHER3i: A LIGHTER HAND - every tint, hatch and outline a third lighter than WEATHER3h\'s, the outline a hairline', () => {
  // WEATHER3h's hand, the one Mac found still too heavy
  const was = {
    cloudy: { tint: 0.08, outline: 0 }, overcast: { tint: 0.13, outline: 0.18 }, fog: { tint: 0.22, alpha: 0.3, outline: 0.22 },
    rain: { tint: 0.12, alpha: 0.38, outline: 0.42 }, thunder: { tint: 0.18, alpha: 0.42, outline: 0.5 },
    snow: { tint: 0.26, alpha: 0.55, outline: 0.4 }, sandstorm: { tint: 0.16, alpha: 0.45, outline: 0.42 },
  };
  for (const w of PRIORITY) {
    for (const k of ['tint', 'alpha', 'outline']) {
      if (!(was[w][k] > 0)) { assert.ok(!(HATCH[w][k] > 0), `${w} ${k}: none, as before`); continue; }
      const r = HATCH[w][k] / was[w][k];
      assert.ok(r > 0.6 && r < 0.72, `${w} ${k}: ${HATCH[w][k]} is ${(r * 100).toFixed(0)}% of ${was[w][k]}`);
    }
  }
  assert.ok(OUTLINE_PX < 0.9 * 0.8, 'the outline thinner than WEATHER3h\'s');
  assert.ok(T > 12, 'the light hatch sparser than WEATHER3h\'s 12-pixel tile');
});

// a context that records every stroke: its style, the path it was made on, and the clips it was made inside
function strokeCtx() {
  const strokes = [];
  let path = [], clips = [], stack = [];
  const state = {};
  const ctx = new Proxy({}, {
    get: (_, k) => {
      if (k === 'strokes') return strokes;
      if (k === 'createPattern') return (tile) => ({ tile });
      if (k in state) return state[k];
      return (...a) => {
        if (k === 'beginPath') path = [];
        else if (k === 'moveTo') path.push(`${a[0]},${a[1]}`);
        else if (k === 'clip') clips = [...clips, path.join(' ')];
        else if (k === 'save') stack.push(clips);
        else if (k === 'restore') clips = stack.pop();
        else if (k === 'fill' || k === 'stroke') strokes.push({ kind: k, style: k === 'fill' ? state.fillStyle : state.strokeStyle, path: path.join(' '), clips: [...clips], op: state.globalCompositeOperation });
      };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
  return ctx;
}

test('WEATHER3i: THE PAINTER - each step on its own loops, clipped inside its region and the steps below it; under the pen, the same picture stroke for stroke', () => {
  patternCanvas();
  try {
    const loop = (x) => ({ pts: [{ x, y: 1 }, { x: x + 4, y: 1 }, { x: x + 4, y: 5 }, { x, y: 1 }], box: [x, 1, x + 4, 5] });
    const regions = { rain: [loop(1)], thunder: [loop(10)], overcast: [loop(20)] };
    const strength = { rain: [[loop(2)], [loop(3)]], thunder: [[loop(11)], []] };
    const view = { ox: 0, oy: 0, scale: 10 }, opts = { paperW: 400, paperH: 300, strength };
    const at = (l) => `${(l.pts[0].x - view.ox) * view.scale},${(l.pts[0].y - view.oy) * view.scale}`;
    const ctx = strokeCtx();
    paintWeatherRegions(ctx, view, regions, opts);
    const want = [
      { kind: 'fill', style: hatchPattern(ctx, 'overcast'), path: at(regions.overcast[0]), clips: [] },
      { kind: 'fill', style: hatchPattern(ctx, 'rain'), path: at(regions.rain[0]), clips: [] },
      { kind: 'fill', style: strengthPattern(ctx, 'rain', 1), path: at(strength.rain[0][0]), clips: [at(regions.rain[0])] },
      { kind: 'fill', style: strengthPattern(ctx, 'rain', 2), path: at(strength.rain[1][0]), clips: [at(regions.rain[0]), at(strength.rain[0][0])] },
      { kind: 'fill', style: hatchPattern(ctx, 'thunder'), path: at(regions.thunder[0]), clips: [] },
      { kind: 'fill', style: strengthPattern(ctx, 'thunder', 1), path: at(strength.thunder[0][0]), clips: [at(regions.thunder[0])] },
      { kind: 'stroke', path: at(regions.overcast[0]), clips: [] },
      { kind: 'stroke', path: at(regions.rain[0]), clips: [] },
      { kind: 'stroke', path: at(regions.thunder[0]), clips: [] },
    ];
    const got = ctx.strokes.map(({ kind, style, path, clips }) => (kind === 'fill' ? { kind, style, path, clips } : { kind, path, clips }));
    assert.deepEqual(got, want, 'lowest priority first, each word then its steps inside it, the outlines over all; an empty step not drawn');
    // under the pen every stroke goes beneath the last: the same strokes, the other way round
    const under = strokeCtx();
    paintWeatherRegions(under, view, regions, { ...opts, under: true });
    assert.deepEqual(under.strokes.map(({ kind, style, path, clips }) => (kind === 'fill' ? { kind, style, path, clips } : { kind, path, clips })), [...want].reverse());
    // and with no strength, the words alone
    const bare = strokeCtx();
    paintWeatherRegions(bare, view, regions, { paperW: 400, paperH: 300 });
    assert.equal(bare.strokes.filter((s) => s.kind === 'fill').length, 3);
  } finally { delete globalThis.document; }
});

function heldMap(minutes, size = { width: 400, height: 250 }) {
  _resetForTests(); globalThis.location = { search: '?skin=enhanced' };
  const node = () => { const n = { children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} }, append(...k) { n.children.push(...k); }, remove() {}, addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [] }; return n; };
  globalThis.document = { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
  const clock = { m: minutes };
  const win = new HeldMapWindow({ getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: woods, woods: { heightMapBuffer: new Uint8Array(size.width * size.height).fill(10) }, mapSize: size, weather: { on: () => true, minutes: () => clock.m } });
  return { win, clock };
}

test('WEATHER3i: THE SHEET - the strength read with the regions through the ground law once a refresh, drawn inside them under the pen', () => {
  lane();
  try {
    for (const [minutes, word] of [[YEAR + 170 * 1440 + 15 * 60, 'rain'], [WINTER + 15 * 60, 'snow']]) {
      const { win, clock } = heldMap(minutes);
      const wx = win._weatherLayer();
      const ctx = strokeCtx();
      win._paintWeather(ctx, { view: { ox: 0, oy: 0, scale: 2 }, paperW: 800, paperH: 500, dpr: 1 }, wx);
      // the strength is the regions' own words' (the ground law's: a winter front is snow, and its steps are snow's)
      for (const w of Object.keys(wx.strength)) assert.ok(FALLS.includes(w) && wx.regions[w], `${w}: a step only of a region there`);
      assert.ok(wx.strength[word]?.some((l) => l.length), `${word}: steps on the sheet`);
      // drawn: a clipped stroke for every step there is, each under the pen
      const steps = Object.values(wx.strength).flat().filter((l) => l.length).length;
      const clipped = ctx.strokes.filter((s) => s.clips.length);
      assert.equal(clipped.length, steps, 'every step drawn, inside its region');
      assert.ok(clipped.every((s) => s.op === 'destination-over'));
      // under the pen the strokes run backwards: the outlines, which read over everything, go down first
      const outlined = Object.keys(wx.regions).filter((w) => HATCH[w].outline > 0 && wx.regions[w].length).length;
      const firstFill = ctx.strokes.findIndex((s) => s.kind === 'fill');
      assert.ok(outlined > 0 && firstFill === outlined && ctx.strokes.slice(0, firstFill).every((s) => s.kind === 'stroke'), 'the sheet paints the weather under the pen in the reverse order');
      // a pan reads nothing again; the next refresh reads it anew
      const kept = wx.strength;
      win._paintWeather(strokeCtx(), { view: { ox: 5, oy: 0, scale: 2 }, paperW: 800, paperH: 500, dpr: 1 }, wx);
      assert.equal(wx.strength, kept);
      clock.m += 10;
      assert.equal(win._weatherLayer().strength, null);
    }
  } finally { delete globalThis.document; }
});

test('WEATHER3i: THE HOVER NAMES WHAT IS DRAWN - read at the refresh\'s minute, the one the hatch under it was read at', () => {
  lane();
  try {
    const start = YEAR + 170 * 1440 + 15 * 60;
    const { win, clock } = heldMap(start);
    const wx = win._weatherLayer();
    clock.m = wx.minutes + 9;   // nine minutes into the refresh
    assert.equal(win._weatherLayer(), wx, 'the same refresh');
    let told = 0;
    for (let py = 5; py < 250 && told < 3; py += 7) {
      for (let px = 5; px < 400 && told < 3; px += 7) {
        const [fx, fz] = fieldOfMapPixel(px, py);
        const at = (m) => forecastText(forecastAt(fx, fz, m, woods, { hours: WEATHER_FORECAST_HOURS, step: 30, ground: wx.ground }), WEATHER_FORECAST_HOURS);
        const drawn = at(wx.minutes), live = at(clock.m);
        if (drawn === live) continue;
        wx.forecasts.clear();
        assert.equal(win._withWeather('', px, py), drawn, `${px},${py}: "${drawn}", not the live minute's "${live}"`);
        told++;
      }
    }
    assert.ok(told >= 3, `${told} pixels whose weather moved within the refresh`);
  } finally { delete globalThis.document; }
});

test('WEATHER3i: THE KEY - the falling words\' swatches a moderate fall, a last row the rain\'s hatch light to heavy, all inside the box', async () => {
  patternCanvas();
  try {
    const fills = [], texts = [], boxes = [];
    const state = {};
    const lg = new Proxy({}, {
      get: (_, k) => (k === 'createPattern' ? (tile) => ({ tile }) : k === 'measureText' ? (t) => ({ width: t.length * 7 }) : k in state ? state[k] : (...a) => {
        if (k === 'fillRect') fills.push({ style: state.fillStyle, x: a[0], y: a[1], w: a[2], h: a[3] });
        if (k === 'fillText') texts.push({ t: a[0], x: a[1], y: a[2] });
        if (k === 'strokeRect') boxes.push(a);
      }),
      set: (_, k, v) => { state[k] = v; return true; },
    });
    const [bx, by, bw, bh] = paintWeatherLegend(lg, { paperW: 800 });
    // every word and the strength's row inside the box, with room
    for (const { t, x, y } of texts) {
      assert.ok(x >= bx && x + t.length * 7 <= bx + bw - 4, `"${t}" inside the box`);
      assert.ok(y - 6 >= by && y + 6 <= by + bh, `"${t}" within its height`);
    }
    for (const f of fills.slice(1)) assert.ok(f.x >= bx && f.x + f.w <= bx + bw && f.y >= by && f.y + f.h <= by + bh, 'every swatch inside the box');
    assert.deepEqual(texts.map((t) => t.t), [...LEGEND_ROWS.map((w) => WEATHER_NAMES[w]), LEGEND_STRENGTH_TEXT]);
    // a falling word's swatch is its light hatch and its moderate step over it
    const row = (i) => fills.filter((f) => Math.abs(f.y + 5 - texts[i].y) < 1e-9);
    for (const w of LEGEND_ROWS.filter((w) => FALLS.includes(w))) {
      assert.deepEqual(row(LEGEND_ROWS.indexOf(w)).map((f) => f.style), [hatchPattern(lg, w), strengthPattern(lg, w, 1)], `${w}: a moderate fall`);
    }
    // the ramp: the rain's hatch at each step, light to heavy, left to right
    const ramp = row(texts.length - 1);
    const byX = [...new Set(ramp.map((f) => f.x))].sort((a, b) => a - b);
    assert.equal(byX.length, STRENGTH_STEPS.length + 1);
    byX.forEach((x, k) => assert.deepEqual(ramp.filter((f) => f.x === x).map((f) => f.style), [hatchPattern(lg, LEGEND_STRENGTH_WORD), ...[1, 2].slice(0, k).map((s) => strengthPattern(lg, LEGEND_STRENGTH_WORD, s))], `step ${k}`));
  } finally { delete globalThis.document; }
  // with no canvas to cut a pattern on, the ramp still reads light to heavy: each step a half tint more, as the
  // regions' own painter falls back - read from a fresh copy of the module, whose pattern cache has never held one
  const { paintWeatherLegend: freshLegend } = await import('../src/ui/weatherLayer.js?no-canvas');
  const bare = [];
  const st = {};
  const plain = new Proxy({}, { get: (_, k) => (k in st ? st[k] : (...a) => { if (k === 'fillRect') bare.push({ style: st.fillStyle, y: a[1], x: a[0] }); }), set: (_, k, v) => { st[k] = v; return true; } });
  freshLegend(plain, { paperW: 800 });
  const lastY = Math.max(...bare.map((f) => f.y));
  const steps = [...new Set(bare.filter((f) => f.y === lastY).map((f) => f.x))].map((x) => bare.filter((f) => f.y === lastY && f.x === x).length);
  assert.deepEqual(steps, [1, 2, 3], 'light, then a half tint more, then another');
});
