// WEATHER3 slice A (2026-09-22, Mac: "imagine a map, one location its
// sunny, one is cloudy, one has a rainstorm, etc"): THE WORLD WEATHER
// MAP - systems/weather/weatherMap.js. Weather as systems born on the land,
// drifting, growing and dying; the weather at a place a pure function of
// the place and the minute; the table's odds held by construction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  weatherAt, systemsNear, forecastAt, birthLaw, dayShares, exposure, targetShares, coverMeans,
  birthsIn, systemAt, bandAt, windAt, windPath, envelope, maxRadius, coreVolume, resetWeatherMap,
  SYSTEM_TYPES, PRIORITY, SAND_SHARE_OF_CLOUDY, CELL_OF, cellsOf, insideClip, radialOf, shapeFactor, searchReach,
} from '../../../src/systems/weather/weatherMap.js';
import { WEATHER_TABLE, weatherTableFor, rollWeather, WEATHER_ENUM } from '../../../src/systems/weather/weatherTable.js';
import * as sim from '../../../src/systems/weather/weatherSim.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { SEASONS } from '../../../src/systems/gameDate.js';
import { seededRng } from '../../../src/systems/wind/wind.js';

const YEAR = 405 * 360 * 1440;   // a classic minute in 3E 405
const SEASON_DAYS = { [SEASONS.Winter]: [0, 60], [SEASONS.Spring]: [60, 150], [SEASONS.Summer]: [150, 240], [SEASONS.Fall]: [240, 330] };
const ROW_ORDER = ['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'snow', 'thunder'];   // the table's compiled order
const TABLE_CLIMATES = { desert: CLIMATES.Desert, mountains: CLIMATES.Mountain, jungle: CLIMATES.Rainforest, swamp: CLIMATES.Swamp, subtropical: CLIMATES.Subtropical, woodlands: CLIMATES.Woodlands };
const everywhere = (climate) => () => climate;
const LATTICE_TYPES = PRIORITY.filter((t) => !SYSTEM_TYPES[t].parent);   // WEATHER3g: a cell type is born in its fronts
const nodeOf = (type) => SYSTEM_TYPES[type].node;

test('WEATHER3a: the table moved whole - the sim re-exports the SAME objects, and the roll is unchanged', () => {
  assert.equal(sim.WEATHER_TABLE, WEATHER_TABLE);
  assert.equal(sim.weatherTableFor, weatherTableFor);
  assert.equal(sim.rollWeather, rollWeather);
  assert.equal(sim.WEATHER_ENUM, WEATHER_ENUM);
  assert.equal(rollWeather(CLIMATES.Mountain, SEASONS.Winter, () => 0.99), WEATHER_ENUM.snow);
});

/** A solved law's shares of the day by the Cox law written out here, apart from the module's own (WEATHER3g): the
 *  fronts over a point Poisson(nu), the cells over it Poisson(c x the fronts), so no cell with chance exp(-nu (1 - e^-c)). */
function coxShares(core, rings, season) {
  const shares = Object.fromEntries(PRIORITY.map((w) => [w, 0]));
  const bins = exposure('rain', season).length;
  for (let i = 0; i < bins; i++) {
    const mu = Object.fromEntries(PRIORITY.map((w) => [w, 0]));
    for (const type of LATTICE_TYPES) {
      const m = core[type] * exposure(type, season)[i];
      const cell = CELL_OF[type];
      const cells = cell ? m * (1 - Math.exp(-core[cell] * exposure(cell, season)[i])) : 0;
      if (cell) mu[cell] += cells;
      mu[type] += m - cells;
      for (const [word, share] of rings[type]) mu[word] += m * share;
    }
    let free = 1;
    for (const w of PRIORITY) { shares[w] += (free * (1 - Math.exp(-mu[w]))) / bins; free *= Math.exp(-mu[w]); }
  }
  return shares;
}

test('WEATHER3a: THE LAW SOLVES THE TABLE - every climate and season, averaged over the day, is the Chronicles row as the map wears it, by the module\'s law and by the Cox law written out', () => {
  for (const [name, table] of Object.entries(WEATHER_TABLE)) {
    for (const season of Object.values(SEASONS)) {
      const law = birthLaw(TABLE_CLIMATES[name], season);
      // the covering mean a type's cores give: its weight (births per node) x its core's volume / the node's; a cell
      // type's weight is already per m^2 x minute of its fronts' cores (WEATHER3g), so its mean over a point in one
      const core = Object.fromEntries(PRIORITY.map((t) => [t, law.weight[t] * coreVolume(t) / (SYSTEM_TYPES[t].parent ? 1 : nodeOf(t)[0] ** 2 * nodeOf(t)[1])]));
      const got = dayShares({ core, rings: law.rings }, season);
      const want = targetShares(table, season);
      for (const w of PRIORITY) assert.ok(Math.abs(got[w] - want[w]) < 1e-4, `${name} season ${season} ${w}: ${got[w]} vs ${want[w]}`);
      // RAIN-HOURS (2026-10-13): the solve, made by the module's own law, must be the table by the real one - with the
      // storms halved, the sampled gate's 2.6 points no longer told a linear cell law (nu c for nu (1 - e^-c), the
      // solve then 1.5 points off) from the true one, and WEATHER3g-cells-linear survived it
      const cox = coxShares(core, law.rings, season);
      for (const w of PRIORITY) assert.ok(Math.abs(cox[w] - want[w]) < 1e-4, `${name} season ${season} ${w} by the Cox law: ${cox[w]} vs ${want[w]}`);
      for (const t of PRIORITY) {
        assert.ok(law.weight[t] >= 0, 'never a negative birth');
        law.rings[t].forEach(([word, share], i) => {
          assert.equal(word, SYSTEM_TYPES[t].rings[i][0], 'a ring keeps its word');
          assert.ok(share >= 0 && share <= SYSTEM_TYPES[t].rings[i][1] + 1e-12, 'a ring is thinned, never widened');
        });
      }
    }
  }
});

test('WEATHER3a: a tight row THINS the fronts\' rings instead of missing the table (the woodlands\' summer: a twentieth overcast; the desert: none)', () => {
  // RAIN-HOURS (2026-10-13) re-aimed this pin: the swamp's spring it named thinned nothing once WEATHER3g's fronts
  // stood - its rain front's cloud skirt read 0.9999999999999993 of its share, a rounding residue the pin passed on -
  // and with the falling words worn for half their odds the swamp has room for every ring. The rows that thin are the
  // ones whose deck is too thin for every front's ring of it.
  const overcast = (rings) => rings.find(([w]) => w === 'overcast')[1];
  const woodsSummer = birthLaw(CLIMATES.Woodlands, SEASONS.Summer);
  assert.ok(overcast(woodsSummer.rings.rain) < 0.9 * SYSTEM_TYPES.rain.rings[0][1], `the rain front's deck is thinner in the woodlands' summer (${overcast(woodsSummer.rings.rain).toFixed(3)})`);
  assert.equal(overcast(birthLaw(CLIMATES.Desert, SEASONS.Spring).rings.rain), 0, 'the desert has no deck: a front born there wears none');
  const swampSpring = birthLaw(CLIMATES.Swamp, SEASONS.Spring);
  assert.deepEqual(swampSpring.rings.rain, SYSTEM_TYPES.rain.rings, 'where the table has room, the front keeps its whole shape');
  assert.deepEqual(swampSpring.rings.thunder, [], 'a storm cell has no rings: it stands in its front');
  // the covering means read the table the priority down
  const mu = coverMeans({ thunder: 0.5, rain: 0.25 });
  assert.ok(Math.abs(mu.thunder - Math.log(2)) < 1e-12);
  assert.ok(Math.abs(mu.rain - Math.log(2)) < 1e-12, 'a quarter of the whole is half of what thunder left');
});

test('WEATHER3a: the sandstorm is born only on the desert table\'s land, a share of its cloudy', () => {
  for (const [name, climate] of Object.entries(TABLE_CLIMATES)) {
    for (const season of Object.values(SEASONS)) {
      const w = birthLaw(climate, season).weight.sandstorm;
      if (name === 'desert') assert.ok(w > 0, `the desert ${season} births sandstorms`);
      else assert.equal(w, 0, `${name} never does`);
    }
  }
  const t = targetShares(WEATHER_TABLE.desert, SEASONS.Summer);
  assert.ok(Math.abs(t.sandstorm - 0.15 * SAND_SHARE_OF_CLOUDY) < 1e-12 && Math.abs(t.sandstorm + t.cloudy - 0.15) < 1e-12);
  assert.equal(birthLaw(CLIMATES.Desert2, SEASONS.Summer), birthLaw(CLIMATES.Desert, SEASONS.Summer), 'Desert2 is the desert table');
  assert.equal(birthLaw(12345, SEASONS.Summer), null, 'an unknown climate births nothing (and warns nothing)');
});

// THE CALIBRATION GATE: the map SAMPLED - births, thinning, the envelope,
// the rings, the wind, the search - must give the table's shares. The rows
// are the ones that exercise every law: the daily swing at its strongest
// (subtropical summer thunder, the swamp's fog), thinned rings (the swamp
// spring), the sandstorm (desert spring), snow's ring (mountain winter).
// WEATHER3g: the samples run over the WHOLE map, edges included (off it is its edge's climate), and across twenty
// years of the season: a front is ~100 km and a day across, so one season's samples see only a few hundred
// independent systems and the noise alone would reach three points.
const GATE_ROWS = [['subtropical', SEASONS.Summer], ['swamp', SEASONS.Spring], ['swamp', SEASONS.Fall], ['desert', SEASONS.Spring], ['mountains', SEASONS.Winter], ['woodlands', SEASONS.Fall]];
test('WEATHER3a: THE CALIBRATION GATE - the sampled map holds each worn word to the Chronicles row as the map wears it', () => {
  const N = 3000;
  let sumAbs = 0, cells = 0;
  for (const [name, season] of GATE_ROWS) {
    const climate = TABLE_CLIMATES[name];
    const r = seededRng(0xCA11B + climate * 7 + season);
    const count = {};
    const [d0, d1] = SEASON_DAYS[season];
    for (let i = 0; i < N; i++) {
      const x = 20000 + r() * 780000, z = 20000 + r() * 370000;
      const m = YEAR + Math.floor(r() * 20) * 360 * 1440 + (d0 + 2 + r() * (d1 - d0 - 4)) * 1440;
      let w = weatherAt(x, z, m, everywhere(climate)).word;
      if (w === 'sandstorm') w = 'cloudy';   // the Chronicles' cloudy it was drawn from
      count[w] = (count[w] ?? 0) + 1;
    }
    // RAIN-HOURS (2026-10-13): the row as the map wears it - rain and thunder for WET_HOURS of their odds, the hours
    // they give up the dry words' (test/systems/weather/rainhours.test.js holds that law to the Chronicles' digits); clear air is the
    // share nothing paints, and a sandstorm counts as the cloudy it was drawn from
    const t = targetShares(WEATHER_TABLE[name], season);
    const worn = { ...t, cloudy: t.cloudy + t.sandstorm, sunny: 1 - PRIORITY.reduce((sum, w) => sum + t[w], 0) };
    const row = ROW_ORDER.map((w) => worn[w] * 100);
    ROW_ORDER.forEach((w, i) => {
      const got = ((count[w] ?? 0) / N) * 100;
      assert.ok(Math.abs(got - row[i]) < 2.6, `${name} season ${season} ${w}: ${got.toFixed(1)}% sampled, the row as worn says ${row[i].toFixed(1)}%`);
      sumAbs += Math.abs(got - row[i]); cells++;
    });
  }
  assert.ok(sumAbs / cells < 0.8, `the mean miss is sampling noise, not a bias (${(sumAbs / cells).toFixed(2)} points)`);
});

test('WEATHER3a: A MAP - one minute, different places, different skies; and a spot\'s sky turns through the hours', () => {
  const m = YEAR + 100 * 1440 + 13 * 60;
  const seen = new Set();
  for (let i = 0; i < 40; i++) for (let j = 0; j < 20; j++) seen.add(weatherAt(100000 + i * 12000, 60000 + j * 12000, m, everywhere(CLIMATES.Woodlands)).word);
  for (const w of ['sunny', 'cloudy', 'overcast', 'rain', 'thunder']) assert.ok(seen.has(w), `a spring afternoon over the woodlands has ${w} somewhere`);
  const words = new Set();
  for (let h = 0; h < 72; h++) words.add(weatherAt(400000, 200000, m + h * 60, everywhere(CLIMATES.Woodlands)).word);
  assert.ok(words.size >= 3, 'three days at one spot see its weather change');
});

test('WEATHER3a: PURE - the same place and minute is the same sky, whatever was asked before and after a reset', () => {
  const at = everywhere(CLIMATES.Swamp);
  const probes = Array.from({ length: 60 }, (_, i) => [150000 + i * 7919, 90000 + i * 4099, YEAR + 200 * 1440 + i * 97]);
  const first = probes.map(([x, z, m]) => weatherAt(x, z, m, at));
  resetWeatherMap();
  const again = [...probes].reverse().map(([x, z, m]) => weatherAt(x, z, m, at)).reverse();
  first.forEach((w, i) => { assert.equal(again[i].word, w.word); assert.equal(again[i].intensity, w.intensity); assert.equal(again[i].system?.id, w.system?.id); });
});

test('WEATHER3a: PERSISTENT - nothing is re-dealt at midnight (the day is no seed): a storm born at night still rains after it', () => {
  const at = everywhere(CLIMATES.Woodlands);
  const day = YEAR + 100 * 1440;
  let atMidnight = 0, atNoon = 0;
  for (let i = 0; i < 300; i++) {
    const x = 50000 + i * 2503, z = 60000 + (i % 37) * 8111;
    if (weatherAt(x, z, day + 1439, at).word !== weatherAt(x, z, day + 1440, at).word) atMidnight++;
    if (weatherAt(x, z, day + 719, at).word !== weatherAt(x, z, day + 720, at).word) atNoon++;
  }
  assert.ok(atMidnight <= 4 && atNoon <= 4, `a minute's change is rare either side of midnight (${atMidnight} at midnight, ${atNoon} at noon, of 300)`);
  // a system born before midnight stands after it
  let crossed = null;
  for (let gx = 2; gx < 12 && !crossed; gx++) {
    for (const b of birthsIn('rain', gx, 1, Math.floor((day + 1380) / nodeOf('rain')[1]), at)) {
      if (b.bornAt < day + 1440 && b.bornAt + b.life > day + 1440 + 120) { crossed = b; break; }
    }
  }
  assert.ok(crossed, 'a rain front born before midnight and living past two');
  const s = systemAt(crossed, day + 1440 + 60);
  assert.ok(['rain', 'thunder'].includes(weatherAt(s.x, s.z, day + 1440 + 60, at).word), 'its core still rains at one in the morning (only a storm outranks it)');
});

test('WEATHER3a: A SYSTEM\'S SHAPE - rain at the heart of a front, the deck around it, cloud at the edge, clear air beyond', () => {
  const b = { type: 'rain', id: 'r', bornX: 0, bornZ: 0, bornAt: 0, life: 1000, core: 40000, rings: SYSTEM_TYPES.rain.rings };
  const s = systemAt(b, 500);   // mid-life: full growth
  assert.equal(s.env, 1);
  const [core, deck, cloud] = s.bands.map(([r]) => r);
  assert.equal(core, 40000);
  assert.ok(Math.abs(deck - 40000 * Math.sqrt(2)) < 1e-6 && Math.abs(cloud - 40000 * Math.sqrt(3)) < 1e-6, 'each ring\'s area is its share of core areas');
  assert.equal(bandAt(s, 0).word, 'rain');
  assert.equal(bandAt(s, (core + deck) / 2).word, 'overcast');
  assert.equal(bandAt(s, (deck + cloud) / 2).word, 'cloudy');
  assert.equal(bandAt(s, cloud + 1), null);
  assert.equal(s.clip, null, 'a front paints its whole disc');
  assert.ok(bandAt(s, 0).intensity > bandAt(s, core * 0.9).intensity, 'the downpour at the heart, a drizzle toward the edge');
  // the envelope: born small, full grown, dying away
  assert.equal(envelope(SYSTEM_TYPES.rain, 0), 0);
  assert.equal(envelope(SYSTEM_TYPES.rain, 0.5), 1);
  assert.ok(systemAt(b, 30).bands[0][0] < core && systemAt(b, 990).bands[0][0] < core);
  assert.equal(systemAt(b, -1), null); assert.equal(systemAt(b, 1000), null, 'not before its birth, not after its death');
  // a thinned ring is no band at all
  const bare = systemAt({ ...b, rings: [['overcast', 0], ['cloudy', 1]] }, 500);
  assert.deepEqual(bare.bands.map(([, w]) => w), ['rain', 'cloudy']);
});

test('WEATHER3a: PRIORITY - where systems overlap the worn word is the highest, and the ground law runs first', () => {
  const at = everywhere(CLIMATES.Rainforest);
  let checked = 0;
  for (let i = 0; i < 400 && checked < 30; i++) {
    const x = 120000 + i * 1733, z = 80000 + i * 911, m = YEAR + 120 * 1440 + i * 37;
    // RAIN-HOURS (2026-10-13): each system read in its OWN measure (radialOf, WEATHER3h), as the law reads it - this
    // oracle read the centre's distance, a disc, and passed only while no probe fell where a shape turns a band; on the
    // map the calibration moved, five of its thirty probes did, and in each the shaped read agreed with the worn word
    const painted = systemsNear(x, z, m, at, 0).filter((s) => insideClip(s, x, z)).map((s) => bandAt(s, radialOf(s, x, z))).filter(Boolean);
    if (painted.length < 2) continue;
    const top = painted.map((p) => p.word).sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b))[0];
    assert.equal(weatherAt(x, z, m, at).word, top);
    checked++;
  }
  assert.ok(checked >= 10, 'overlaps exist and were checked');
  const snowGround = (w) => (w === 'rain' || w === 'thunder' ? 'snow' : w);
  // RAIN-HOURS (2026-10-13): only probes the map rains on can show the ground turning a drop - this line of 200 at one
  // minute fell under some rain while a jungle spring rained 52% of the time, and under none at 26%, and the ground law
  // dropped whole (WEATHER3a-ground-after-priority) survived it. Each probe is now a place the bare map rains on.
  let wet = 0;
  for (let i = 0; i < 2000 && wet < 40; i++) {
    const x = 100000 + i * 3001, z = 90000 + (i % 9) * 17000, m = YEAR + 90 * 1440 + (i % 13) * 97;
    const bare = weatherAt(x, z, m, at).word;
    if (bare !== 'rain' && bare !== 'thunder') continue;
    wet++;
    const w = weatherAt(x, z, m, at, { ground: snowGround }).word;
    assert.ok(w !== 'rain' && w !== 'thunder', 'the ground turned every drop');
  }
  assert.ok(wet >= 20, `the probes stood under rain and storms (${wet})`);
});

test('WEATHER3a: THE SEARCH MISSES NOTHING - every system over a point, against a brute walk of a far wider box', () => {
  const at = everywhere(CLIMATES.Swamp);
  const brute = (x, z, m) => {
    const want = new Set();
    const over = (b) => { const s = systemAt(b, m); if (s && radialOf(s, x, z) < s.r) want.add(s.id); };   // WEATHER3h: in its own shape's measure
    for (const type of LATTICE_TYPES) {
      const spec = SYSTEM_TYPES[type], [nm, nt] = spec.node;
      const gx = Math.floor(x / nm), gz = Math.floor(z / nm), gt = Math.floor(m / nt);
      for (let a = gx - 3; a <= gx + 3; a++) for (let c = gz - 3; c <= gz + 3; c++) for (let t = gt - Math.ceil(spec.life[1] / nt) - 2; t <= gt; t++) {
        for (const b of birthsIn(type, a, c, t, at)) { over(b); for (const cell of cellsOf(b, at)) over(cell); }   // every front's every cell, however far
      }
    }
    return [...want].sort();
  };
  const found = (x, z, m) => systemsNear(x, z, m, at, 0).filter((s) => radialOf(s, x, z) < s.r).map((s) => s.id).sort();
  // the hard places: the DOWNWIND edge of a system at the end of its full growth - as wide as it gets, and as
  // far from its birth as it gets while that wide
  let probes = 0;
  for (const type of LATTICE_TYPES) {
    for (let g = 0; g < 16; g++) {
      for (const b of birthsIn(type, 5 + (g % 8), 4 + (g >> 3), Math.floor((YEAR + 250 * 1440) / nodeOf(type)[1]) + g, at)) {
        const m = b.bornAt + b.life * (1 - SYSTEM_TYPES[type].decay) - 1, s = systemAt(b, m);
        const dx = s.x - b.bornX, dz = s.z - b.bornZ, len = Math.hypot(dx, dz) || 1;
        const edge = s.r * shapeFactor(s.shape, dx, dz) * 0.97;   // WEATHER3h: its shaped outline, that way
        const x = s.x + (dx / len) * edge, z = s.z + (dz / len) * edge;
        const got = found(x, z, m);
        assert.ok(got.includes(s.id), `${s.id}: its own downwind edge finds it`);
        assert.deepEqual(got, brute(x, z, m));
        probes++;
      }
    }
  }
  assert.ok(probes > 30, `${probes} edges probed`);
  // and the bound the walk covers: a system's furthest outline at full growth plus its longest ride (WEATHER3h: with
  // the shapes' stretch in the outline, no real draw rides past the outline's own bound any more - the ride is held
  // by the formula, the part of the bound only a system at every extreme at once would reach)
  for (const type of LATTICE_TYPES) {
    const spec = SYSTEM_TYPES[type];
    assert.ok(searchReach(type, 0) >= maxRadius(type) + spec.speed * spec.life[1], `${type}: the walk allows the whole ride`);
    assert.equal(searchReach(type, 5000) - searchReach(type, 0), 5000, 'and the range');
  }
  for (let i = 0; i < 8; i++) {
    const x = 200000 + i * 9973, z = 150000 + i * 7919, m = YEAR + 250 * 1440 + i * 211;
    assert.deepEqual(found(x, z, m), brute(x, z, m));
  }
  assert.ok(maxRadius('rain') > SYSTEM_TYPES.rain.core[1]);
  // and the storm cells: a point inside a front's core with its cells over it finds each of them
  let cells = 0;
  for (let g = 0; g < 40 && cells < 5; g++) {
    for (const b of birthsIn('rain', 3 + (g % 6), 2 + ((g / 6) | 0), Math.floor((YEAR + 250 * 1440) / nodeOf('rain')[1]) + g, at)) {
      const m = b.bornAt + b.life / 2;
      for (const c of cellsOf(b, at)) {
        const s = systemAt(c, m);
        if (!s || !insideClip(s, s.x, s.z)) continue;
        assert.ok(found(s.x, s.z, m).includes(s.id), `${s.id}: the cell over its own heart is found`);
        assert.deepEqual(found(s.x, s.z, m), brute(s.x, s.z, m));
        cells++; break;
      }
    }
  }
  assert.ok(cells >= 5, `${cells} cells probed`);
});

test('WEATHER3a: a candidate the land refuses moves no other - the births in one half of a node never hear of the other half\'s climate', () => {
  const gx = 2, gz = 1;
  const woods = everywhere(CLIMATES.Woodlands);
  let compared = 0;
  for (const type of ['rain', 'fog', 'overcast', 'cloudy']) {
    const NODE_M = nodeOf(type)[0];
    const split = (px) => (px * 819.2 < (gx + 0.5) * NODE_M ? CLIMATES.Woodlands : CLIMATES.Desert);
    for (let gt = 0; gt < 40; gt++) {
      const t = Math.floor((YEAR + 100 * 1440) / nodeOf(type)[1]) + gt;
      const west = (list) => list.filter((b) => b.bornX < (gx + 0.5) * NODE_M);
      const a = west(birthsIn(type, gx, gz, t, woods)), b = west(birthsIn(type, gx, gz, t, (px) => split(px)));
      assert.deepEqual(b, a, `${type} node ${gt}: the west half's births are the same whatever the east half is`);
      compared += a.length;
    }
  }
  assert.ok(compared > 20, `${compared} births compared`);
});

test('WEATHER3a: THE WIND - systems ride it, its path is its own integral, and storms outrun fog', () => {
  const [x, z, t0] = [300000, 200000, YEAR + 10 * 1440];
  // the closed-form path against a fine numerical integration of the wind at the birthplace
  let ix = 0, iz = 0;
  for (let t = t0; t < t0 + 600; t += 0.5) { const [vx, vz] = windAt(x, z, t + 0.25); ix += vx * 0.5; iz += vz * 0.5; }
  const [px, pz] = windPath(x, z, t0, t0 + 600);
  assert.ok(Math.abs(px - ix) < 0.05 && Math.abs(pz - iz) < 0.05, `closed form ${px},${pz} vs integrated ${ix},${iz}`);
  for (let i = 0; i < 50; i++) assert.ok(Math.hypot(...windAt(i * 17011, i * 9001, t0 + i * 999)) <= 1 + 1e-9, 'the field\'s own magnitude is at most 1');
  // the wind turns over the land and the days
  const here = windAt(x, z, t0), far = windAt(x + 400000, z, t0), later = windAt(x, z, t0 + 3 * 1440);
  assert.ok(Math.hypot(here[0] - far[0], here[1] - far[1]) > 0.05 && Math.hypot(here[0] - later[0], here[1] - later[1]) > 0.05);
  // a system moves: a front rides, fog barely - and no system drifts past tens of km in its longest life, so the table
  // stays each climate's (WEATHER3g: a front that rode hundreds carried one climate's weather deep into the next)
  const storm = { type: 'rain', id: 's', bornX: x, bornZ: z, bornAt: t0, life: 400, core: 40000, rings: [] };
  const fog = { ...storm, type: 'fog', id: 'f' };
  const moved = (b) => { const s = systemAt(b, t0 + 300); return Math.hypot(s.x - x, s.z - z); };
  assert.ok(moved(storm) > 1000, 'a front crosses kilometres in five hours');
  assert.ok(moved(fog) < moved(storm) / 4, 'a fog bank barely drifts');
  for (const t of LATTICE_TYPES) assert.ok(SYSTEM_TYPES[t].speed * SYSTEM_TYPES[t].life[1] <= 60000, `${t} drifts at most 60 km in its longest life`);
});

test('WEATHER3a: THE DAY - fog is born in the small hours and summer storms in the afternoon; the day mean stays 1', () => {
  const fog = exposure('fog', SEASONS.Spring);
  const at = (arr, hour) => arr[Math.floor((hour / 24) * arr.length)];
  assert.ok(at(fog, 6) > 1.3 && at(fog, 17) < 0.7, 'fog at dawn, none by late afternoon');
  const storm = exposure('thunder', SEASONS.Summer);
  assert.ok(at(storm, 18) > 1.3 && at(storm, 7) < 0.7, 'the summer storm stands in the evening, not the morning');
  for (const t of PRIORITY) for (const s of Object.values(SEASONS)) {
    const e = exposure(t, s);
    assert.ok(Math.abs(e.reduce((a, b) => a + b, 0) / e.length - 1) < 1e-9, `${t}: the swing moves weather through the day, never adds any`);
  }
  // and the map shows it: the swamp's fog, sampled at dawn and at teatime
  const count = (hour) => {
    let n = 0;
    for (let i = 0; i < 600; i++) if (weatherAt(60000 + i * 1201, 50000 + (i % 29) * 11003, YEAR + 250 * 1440 + (i % 40) * 1440 + hour * 60, everywhere(CLIMATES.Swamp)).word === 'fog') n++;
    return n;
  };
  assert.ok(count(6) > 2 * count(17), 'more fog at six in the morning than at five in the afternoon');
});

test('WEATHER3a: THE FORECAST reads the same law ahead', () => {
  const at = everywhere(CLIMATES.Woodlands);
  const m = YEAR + 100 * 1440 + 8 * 60;
  const f = forecastAt(400000, 200000, m, at, { hours: 12, step: 30 });
  assert.equal(f.steps.length, 24);
  assert.equal(f.now.word, weatherAt(400000, 200000, m, at).word);
  f.steps.forEach((s) => assert.equal(s.word, weatherAt(400000, 200000, s.at, at).word));
  if (f.next) {
    assert.notEqual(f.next.word, f.now.word);
    assert.ok(f.steps.filter((s) => s.at < f.next.at).every((s) => s.word === f.now.word), 'the first change, not a later one');
  } else assert.ok(f.steps.every((s) => s.word === f.now.word));
});

test('WEATHER3a: the land under a birth - off the map is its edge\'s climate, and each climate births its own weather', () => {
  const calls = [];
  const probe = (px, py) => { calls.push([px, py]); return CLIMATES.Desert; };
  weatherAt(-500000, -500000, YEAR, probe);
  assert.ok(calls.length > 0 && calls.every(([px, py]) => px >= 0 && py >= 0 && px < 1000 && py < 500), 'the map is never asked about a pixel it does not have');
  // WEATHER3g: past the edge is the edge's own climate - a system born there is the land's weather, not the sea's
  const edge = (px, py) => (px === 0 || py === 0 ? CLIMATES.Mountain : CLIMATES.Swamp);
  let snowed = 0;
  for (let i = 0; i < 200; i++) if (weatherAt(-200000 - i * 3001, -150000, YEAR + 20 * 1440 + i * 13, edge).word === 'snow') snowed++;
  assert.ok(snowed > 30, `past the mountains' edge it snows as the mountains do (${snowed} of 200)`);
  // a desert summer never rains; a mountain winter snows
  for (let i = 0; i < 200; i++) {
    assert.notEqual(weatherAt(100000 + i * 3001, 90000, YEAR + 190 * 1440 + i * 13, everywhere(CLIMATES.Desert)).word, 'rain');
  }
  let snow = 0;
  for (let i = 0; i < 200; i++) if (weatherAt(100000 + i * 3001, 90000, YEAR + i * 360 * 1440 + 20 * 1440 + i * 13, everywhere(CLIMATES.Mountain)).word === 'snow') snow++;   // a winter day in each of 200 years: a front is a day and 100 km wide, one day's line is one or two of them
  assert.ok(snow > 30, 'the mountain winter snows');
});
