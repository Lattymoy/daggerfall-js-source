// SAIL-FREE (2026-10-05, Mac: "Currently its too hard to sail against the wind, ships need more speed"; his calls: "No
// tacking, Black Flag" and "nothing that breaks immersion") - the responsive helm's way under sail (systems/helmWay.js
// SAIL-FREE; systems/comeSailAway.js canvasPull and sailDrive), driven on Come Sail Away's real runtime over the vendored
// hulls (test/csaScene.mjs): the point of sail's curve and its no-tack law, the sea's bounded wind, her canvas at its
// crest kind for kind, her drive up into the wind's eye and never astern, her sails drawing there (none luffing, none
// stowed by the assist), every hull's polar alike on either tack and bettered by no tack, her way's figures, the
// Overworld journey sailing straight for a mark to windward. The captains keep their own (navalAI.js windFactor).
// tools/mutants/sailfree.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SAIL_FREE, POINT_OF_SAIL, WIND_RATED, WIND_SHARE, pointOfSail, seaWind, windShare } from '../src/systems/helmWay.js';
import * as AI from '../src/systems/naval/navalAI.js';
import { SAIL_CREST_DEG } from '../src/systems/comeSailAway.js';
import { animatorOf } from '../src/systems/comeSailAwayBoat.js';
import { seaHelmStep, createSeaHelm, SEA_HELM } from '../src/systems/seaHelm.js';
import { quatRotate } from '../src/world/quat.js';
import { scene } from './csaScene.mjs';

const HULL = Object.freeze({ LargeBoat: 1, SmallShip: 2, LargeGalley: 3, Carrack: 4 });
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b} (±${eps})`);
const rad = (d) => (d * Math.PI) / 180;
/** An angle folded into [-180, 180). */
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');

/** A helm on `hull` under `handling`, her sails raised with the wind `off` degrees off her bow's eye (0 dead ahead,
 *  plus to starboard) at `len` m/s, held there each quarter-second frame. Her bow is +z. */
function helmOn(hull, { handling = 'responsive', off = 90, len = 1.5 } = {}) {
  const s = scene();
  s.deps.handling = () => handling;
  const boat = s.helm(s.place(hull, 0));
  const w = [-len * Math.sin(rad(off)), 0, -len * Math.cos(rad(off))];   // where it blows TO
  const hold = () => { s.rt.state.windVectorCurrent = [...w]; s.rt.state.windVectorTarget = [...w]; };
  hold();
  s.rt.RaiseSails();
  const run = (secs) => { for (let t = 0; t < secs - 1e-9; t += 0.25) { hold(); s.frame(); } };
  const way = () => s.rt.state.MoveVectorCurrent[2];
  const top = () => Math.hypot(...s.rt.state.velocityTarget);
  /** Degrees between her bow and where the wind blows to (0 running dead before it). */
  const offRun = () => {
    const fw = quatRotate(boat.GameObject.rotation, [0, 0, 1]);
    return (Math.acos(Math.max(-1, Math.min(1, (fw[0] * w[0] + fw[2] * w[2]) / (Math.hypot(fw[0], fw[2]) * Math.hypot(w[0], w[2]))))) * 180) / Math.PI;
  };
  return { s, boat, run, way, top, offRun };
}

/** Each kind's crest in the mod's own GetSailPower - a lateen and a gaff whole at 135 degrees, a staysail 0.8 there, a
 *  square sail whole running before it - and its size: a small gaff x0.5, a small staysail x0.3, any other small sail
 *  x0.4, a large one x1.5. Read off the mod's curves here, never off the port's code. */
const CREST = { lateen: 1, gaff: 1, stay: 0.8, square: 1 };
const kindOf = (b, sail) => (b.SailsLateen.includes(sail) ? 'lateen' : b.SailsGaff.includes(sail) ? 'gaff' : b.SailsStay.includes(sail) ? 'stay' : 'square');
const sizeOf = (b, sail, kind) => (b.SailsSmall.includes(sail) ? ({ gaff: 0.5, stay: 0.3 })[kind] ?? 0.4 : b.SailsLarge.includes(sail) ? 1.5 : 1);
const canvasOf = (b) => b.Sails.reduce((n, sail) => { const k = kindOf(b, sail); return n + CREST[k] * sizeOf(b, sail, k); }, 0);

/** Two legs, `t1` and `t2` degrees off the wind's eye about a mark `b` off it (t1 < b < t2), at speeds r(t1) and r(t2):
 *  the way they make good toward the mark, sailed so they end on its line. */
const twoLegs = (r, b, t1, t2) => {
  const v1 = r(t1), v2 = r(t2);
  return (v1 * v2 * Math.sin(rad(t2 - t1))) / (v1 * Math.sin(rad(b - t1)) + v2 * Math.sin(rad(t2 - b)));
};

test('SAIL-FREE the point of sail: POINT_OF_SAIL.run running dead before the wind, her best with it on her quarter, eased down to POINT_OF_SAIL.head in the wind\'s eye - never nothing, never astern; either hand alike (mutants: the head, the run, the quarter)', () => {
  assert.deepEqual({ ...POINT_OF_SAIL }, { run: 0.9, quarter: 45, head: 0.55 });
  near(pointOfSail(0), 0.9, 1e-12, 'running dead before it');
  near(pointOfSail(45), 1, 1e-12, 'the wind on her quarter: her best');
  near(pointOfSail(90), 0.8875, 1e-12, 'on her beam');   // 0.55 + 0.45 x (1 + cos 60) / 2
  near(pointOfSail(135), 0.6625, 1e-12, 'close-hauled, 45 off the eye');   // 0.55 + 0.45 x (1 + cos 120) / 2
  near(pointOfSail(180), 0.55, 1e-12, 'dead into the wind: about half');
  for (let d = 0; d < 180; d += 0.5) {
    if (d < 45) assert.ok(pointOfSail(d + 0.5) > pointOfSail(d), `rising to the quarter at ${d}`);
    else assert.ok(pointOfSail(d + 0.5) < pointOfSail(d), `falling to the eye at ${d}`);
    assert.ok(pointOfSail(d) >= 0.55, 'never under half - never nothing, never astern');
  }
  assert.equal(pointOfSail(-60), pointOfSail(60), 'either hand');
  assert.equal(pointOfSail(NaN), pointOfSail(0));
});

test('SAIL-FREE no tack (Mac: "No tacking, Black Flag"): sailing straight for a mark makes the most of her way on every bearing - no two legs ever make more toward it, dead to windward or anywhere; dead to windward and dead to leeward straight is her best way made good (mutants: a straight fall, the head, the run)', () => {
  const r = (th) => pointOfSail(180 - Math.abs(wrap(th)));   // `th` her heading off the wind's eye
  let worst = 0, at = null;
  for (let b = 0; b <= 180; b += 2) {
    for (let t1 = b - 178; t1 < b; t1 += 2) {
      for (let t2 = b + 2; t2 - t1 < 180; t2 += 2) {
        const gain = twoLegs(r, b, t1, t2) / r(b) - 1;
        if (gain > worst) { worst = gain; at = [b, t1, t2]; }
      }
    }
  }
  assert.ok(worst <= 1e-9, `two legs make ${(worst * 100).toFixed(3)}% more toward a mark ${at?.[0]} off the eye (legs ${at?.[1]}, ${at?.[2]})`);
  let up = 0, down = 0;
  for (let th = 0; th <= 180; th += 0.25) { up = Math.max(up, r(th) * Math.cos(rad(th))); down = Math.max(down, -r(th) * Math.cos(rad(th))); }
  near(up, r(0), 1e-12, 'to windward: straight up');
  near(down, r(180), 1e-12, 'to leeward: straight down');
});

test('SAIL-FREE the sea\'s wind: the captains\' bounded share of the rated wind - a fog\'s tenth no longer lays her becalmed (0.3 of her way), a storm drives her at most twice; none where none blows (UpdateWind lays no wind indoors); one home - the captains\' WIND_RATED, WIND_SHARE and windShare are helmWay.js\'s own (mutants: the raw wind, the indoors\' wind)', () => {
  assert.equal(WIND_RATED, 1.5);
  assert.deepEqual([...WIND_SHARE], [0.3, 2]);
  near(seaWind(1.5), 1.5, 1e-12, 'the rated wind');
  near(seaWind(0.15), 0.45, 1e-12, 'a fog\'s tenth: 0.3 of the rated');
  // AUDIT SHIPS D8 (2026-10-06): UpdateWind's strongest is a thunderstorm's 4 m/s (1-2 in sun, x1.5 in rain, x2 in thunder)
  near(seaWind(2), 2, 1e-12, 'a fair day\'s strongest: itself');
  near(seaWind(4), 3, 1e-12, 'a thunderstorm\'s strongest: twice the rated');
  near(seaWind(9), 3, 1e-12, 'twice the rated at most');
  assert.equal(seaWind(0), 0, 'indoors: none');
  assert.equal(AI.WIND_RATED, WIND_RATED);
  assert.equal(AI.WIND_SHARE, WIND_SHARE);
  assert.equal(AI.windShare, windShare);
});

test('SAIL-FREE her drive on the real runtime: every sail she has set at the crest of its own curve (a lateen, a gaff and a staysail at SAIL_CREST_DEG, a square sail running), by the point of sail, in the sea\'s wind, at her pace - on every hull and every heading; a lateen on either tack alike; her way comes on in the sea\'s wind too, a fog\'s tenth 0.3 of the rated rate (mutants: the crest, square sails at the fore-and-aft crest, the canvas asked at the wind, the lateen\'s bad tack, the mod\'s drive, the pace, the raw wind, the raw wind in the rate)', () => {
  assert.equal(SAIL_CREST_DEG, 135);
  assert.deepEqual({ ...SAIL_FREE }, { pace: 1.2, gain: 1.643 });
  const canvas = {};
  for (const hull of Object.values(HULL)) {
    for (const off of [0, 30, -30, 60, 90, -90, 135, -135, 180]) {
      for (const len of [1.5, 0.15]) {
        const h = helmOn(hull, { off, len });
        h.run(0.25);
        canvas[hull] = canvasOf(h.boat);
        const want = canvas[hull] * pointOfSail(h.offRun()) * seaWind(len) * 1.2;
        near(h.s.rt.state.MoveVectorTarget[2], want, 2e-5 * Math.max(1, want), `hull ${hull}, the wind ${off} off her bow at ${len}`);
      }
    }
    const rate = (len) => helmOn(hull, { len }).s.rt.properties.moveAccel();
    near(rate(0.15) / rate(1.5), 0.3, 1e-6, `hull ${hull}: her way comes on in the sea's wind`);
  }
  assert.deepEqual(canvas, { 1: 1.5, 2: 4.5, 3: 1.5, 4: 5.4 }, 'her canvas: the Large Boat\'s lateen, the galleon\'s five, the galley\'s square, the Carrack\'s five');
});

test('SAIL-FREE the galleon\'s way, measured (a rated wind, waves off): 8.91 m/s dead into the wind - where the mod\'s own took her astern - 14.38 on her beam (the mod\'s 8.75), 16.2 with the wind on her quarter; and a Carrack, a Large Galley and a Large Boat up into the wind\'s eye (mutants: the pace, the mod\'s drive, the head)', () => {
  const fullAt = (hull, off, handling = 'responsive') => { const h = helmOn(hull, { off, handling }); h.run(40); return h; };
  const up = fullAt(HULL.SmallShip, 0);
  near(up.top(), 8.91, 0.01, 'dead into the wind');
  near(up.way(), up.top(), 0.01, 'and making it');
  near(fullAt(HULL.SmallShip, 90).top(), 14.38, 0.01, 'on her beam');
  near(fullAt(HULL.SmallShip, 135).top(), 16.2, 0.01, 'the wind on her quarter');
  const mods = fullAt(HULL.SmallShip, 0, 'classic');
  assert.ok(mods.way() < 0, `the mod's own: astern (${mods.way()})`);
  for (const hull of [HULL.LargeBoat, HULL.LargeGalley, HULL.Carrack]) {
    const h = fullAt(hull, 0);
    assert.ok(h.way() > 2, `hull ${hull}: up into the wind's eye (${h.way()} m/s)`);
  }
});

test('SAIL-FREE her sails draw on every heading under the responsive helm: head to wind none luffs, no square sail is laid aback, and the square-sail assist (its default, on) stows none upwind, raised there or brought there; under the mod\'s own the fore-and-aft flap and the assist stows the square (mutants: the luff, the square aback, the assist\'s stow, the raise\'s stow)', () => {
  for (const handling of ['responsive', 'classic']) {
    const h = helmOn(HULL.SmallShip, { handling, off: 0 });   // raised head to wind
    h.run(4);
    const b = h.boat;
    const square = b.Sails.filter((x) => b.SailsSquare.includes(x));
    const fore = b.Sails.filter((x) => !b.SailsSquare.includes(x));
    assert.ok(square.length === 3 && fore.length === 2, 'the galleon: three square, a gaff and a staysail');
    if (handling === 'responsive') {
      for (const sail of square) {
        assert.equal(animatorOf(sail).GetBool('Stowed'), false, 'raised head to wind: set');
        near(animatorOf(sail).GetFloat('Wind'), 1.5, 1e-5, 'a square sail drawing: the wind\'s own, never aback');
      }
      for (const sail of fore) near(Math.abs(animatorOf(sail).GetFloat('Wind')), 1.5, 1e-5, 'a fore-and-aft sail full, not luffing');
    } else {
      for (const sail of square) assert.equal(animatorOf(sail).GetBool('Stowed'), true, 'the mod\'s assist: stowed upwind');
      for (const sail of fore) assert.ok(Math.abs(animatorOf(sail).GetFloat('Wind')) <= 0.25 + 1e-6, 'the mod\'s: luffing in the eye');
    }
  }
  // raised off the wind, then brought head to wind: still set
  const h = helmOn(HULL.SmallShip, { off: 90 });
  h.run(2);
  h.s.rt.state.windVectorCurrent = [0, 0, -1.5];
  for (let i = 0; i < 16; i++) { h.s.rt.state.windVectorCurrent = [0, 0, -1.5]; h.s.rt.state.windVectorTarget = [0, 0, -1.5]; h.s.frame(); }
  for (const sail of h.boat.SailsSquare) assert.equal(animatorOf(sail).GetBool('Stowed'), false, 'brought head to wind: set');
});

test('SAIL-FREE every hull\'s polar on the real runtime is the same on either tack, and no tack betters sailing straight for any mark (the Large Boat\'s lone lateen was 15% short on one tack - two legs made 10% more toward a mark 10 degrees off the eye) (mutants: the lateen\'s bad tack, a straight fall)', () => {
  for (const hull of Object.values(HULL)) {
    const polar = new Map();
    for (let th = -180; th <= 180; th += 15) { const h = helmOn(hull, { off: th }); h.run(0.25); polar.set(th, h.top()); }
    for (let th = 15; th <= 165; th += 15) near(polar.get(th), polar.get(-th), 1e-4, `hull ${hull}: ${th} off the eye, either hand`);
    const r = (th) => polar.get(wrap(th) === -180 ? 180 : wrap(th));
    let worst = 0;
    for (let b = -165; b <= 180; b += 15) {
      for (let t1 = b - 165; t1 < b; t1 += 15) for (let t2 = b + 15; t2 - t1 < 180; t2 += 15) worst = Math.max(worst, twoLegs(r, b, t1, t2) / r(b) - 1);
    }
    assert.ok(worst <= 1e-4, `hull ${hull}: two legs make ${(worst * 100).toFixed(2)}% more`);
  }
});

test('SAIL-FREE the Overworld journey sails her straight for a mark to windward: under the responsive helm (`free`) no cone and no tack - the course is the mark\'s bearing, dead into the wind\'s eye too; under the mod\'s own she beats up a lane as she did; the world tells the journey which helm she has (mutants: the journey tacks, the world never tells)', () => {
  const q = (free, bearing, squareOnly = false) => ({ heading: bearing, bearing, wind: [0, -1.5], hasSails: true, squareOnly, sailsUp: true, canSail: true, way: 5, dt: 0.25, free });   // the wind from the north
  for (const bearing of [0, 10, -20, 34]) {
    for (const squareOnly of [false, true]) {
      const free = seaHelmStep(createSeaHelm(), q(true, bearing, squareOnly));
      assert.equal(free.course, bearing, `free: straight for a mark ${bearing} off the eye`);
      assert.equal(free.sails, null);
      assert.equal(free.row, false, 'under sail');
      const mods = seaHelmStep(createSeaHelm(), q(false, bearing, squareOnly));
      assert.equal(Math.abs(mods.course), squareOnly ? SEA_HELM.noGoSquare : SEA_HELM.noGoFore, `the mod's: a tack ${bearing} off the eye`);
    }
  }
  // AUDIT SHIPS D7 (2026-10-06): and the mod's lane - her tack held while the mark's bearing swings within laneDeg past the
  // wind's eye, about past it; under `free` no tack is ever held
  const st = createSeaHelm(), fr = createSeaHelm();
  assert.equal(seaHelmStep(st, q(false, 10)).course, SEA_HELM.noGoFore, 'her tack to the mark\'s side');
  assert.equal(seaHelmStep(st, q(false, -(SEA_HELM.laneDeg - 1))).course, SEA_HELM.noGoFore, 'within the lane: held');
  assert.equal(seaHelmStep(st, q(false, -(SEA_HELM.laneDeg + 1))).course, -SEA_HELM.noGoFore, 'past it: about');
  for (const b of [10, -(SEA_HELM.laneDeg - 1), -(SEA_HELM.laneDeg + 1)]) { assert.equal(seaHelmStep(fr, q(true, b)).course, b); assert.equal(fr.tack, 0, 'free: no tack held'); }
  const i = WORLD.indexOf('sailWay: CSA_HANDLING.moveSpeedSail');
  assert.ok(i >= 0, 'the world asks the journey');
  assert.match(WORLD.slice(i, WORLD.indexOf('\n', i)), /, free: !!csaRuntime\.helmResponsive\(\),/, 'and tells it the helm she has');
});
