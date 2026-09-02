// EV5 - MOONLIGHT, pinned with no GL and no game data: the phase-lit
// fraction, the term derived from skyState's own moon output (masser
// keys, secunda lifts the ambient), the day/cloud/phase gates, the
// in-place ambient fold, and the wiring shape - three lit shaders take
// the second N.L term, the flats take its Lambert-average half INSIDE
// the _clockLit latch, the studio zeroes it, and only the two exterior
// hosts ever turn it on (classic, interiors and dungeons keep DFU's
// hard-off night by never calling setMoonlight at all).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  skyState, moonlightTerm, withMoonAmbient, phaseLitFraction, MOONLIGHT,
} from '../src/render/enhancedSky.js';
import { LUNAR_PHASES } from '../src/systems/gameDate.js';

const midnight = (phases, weather = 'sunny') =>
  skyState({ minuteOfDay: 0, weather, phases });

test('EV5: phaseLitFraction - the phase ring folded at Full', () => {
  const expect = { 0: 0, 1: 0.25, 2: 0.5, 3: 0.75, 4: 1, 5: 0.75, 6: 0.5, 7: 0.25 };
  for (const [p, f] of Object.entries(expect)) assert.equal(phaseLitFraction(Number(p)), f);
  assert.equal(phaseLitFraction(LUNAR_PHASES.None), 0, 'the year<0 sentinel reads as unlit');
});

test('EV5: a full masser at midnight keys the night; the formula is the state\'s own numbers', () => {
  const s = midnight({ masser: LUNAR_PHASES.Full, secunda: LUNAR_PHASES.Full });
  const term = moonlightTerm(s);
  assert.ok(term, 'a clear full-moon night lights');
  assert.equal(term.scale, MOONLIGHT.masser * phaseLitFraction(s.masser.phase) * s.masser.vis);
  assert.ok(term.scale > 0.2, 'a full clear masser is a real key light');
  assert.equal(term.dir, s.masser.dir, 'the light points at the disc the dome draws');
  assert.deepEqual(term.color, s.masser.color, 'and wears its colour');
  // full moon opposite the sun: high in the midnight sky
  assert.ok(term.dir[1] > 0.9, 'the full moon rides the zenith at midnight');
  // secunda's lift is her colour scaled by her own phase and visibility
  const lift = MOONLIGHT.secunda * phaseLitFraction(s.secunda.phase) * s.secunda.vis;
  assert.ok(Math.abs(term.ambient[0] - s.secunda.color[0] * lift) < 1e-12);
  assert.ok(term.ambient[0] > 0.03, 'a full secunda is a felt floor');
});

test('EV5: by day the sun owns the sky - the term is null even with both moons full', () => {
  for (const m of [360, 720, 1000]) {
    const s = skyState({ minuteOfDay: m, weather: 'sunny', phases: { masser: 4, secunda: 4 } });
    assert.equal(moonlightTerm(s), null, `no moon term at minute ${m}`);
  }
});

test('EV5: new moons light nothing; a lone secunda lifts the floor without a key', () => {
  assert.equal(moonlightTerm(midnight({ masser: 0, secunda: 0 })), null, 'two new moons are a dark night');
  const t = moonlightTerm(midnight({ masser: 0, secunda: LUNAR_PHASES.Full }));
  assert.ok(t, 'secunda alone still answers');
  assert.equal(t.scale, 0, 'no directional key from her');
  assert.ok(t.ambient[0] > 0, 'only the ambient lift');
});

test('EV5: the clouds dim the moon - the same eased cover the dome is drawn with', () => {
  const clear = moonlightTerm(midnight({ masser: 4, secunda: 4 }, 'sunny'));
  const storm = moonlightTerm(midnight({ masser: 4, secunda: 4 }, 'thunder'));
  assert.ok(storm.scale < clear.scale, 'a stormy sky mutes the key');
  assert.ok(storm.ambient[0] < clear.ambient[0], 'and the lift');
  assert.ok(storm.scale > 0, 'but the vis law is a dimmer, not a switch');
});

test('EV5: withMoonAmbient folds in place; null is a no-op', () => {
  const amb = new Float32Array([0.25, 0.25, 0.25]);
  assert.equal(withMoonAmbient(amb, null), amb);
  assert.deepEqual([...amb], [0.25, 0.25, 0.25], 'null touches nothing');
  const out = withMoonAmbient(amb, { ambient: [0.05, 0.04, 0.03] });
  assert.equal(out, amb, 'the same array back - no second allocation');
  assert.ok(Math.abs(amb[0] - 0.3) < 1e-6 && Math.abs(amb[2] - 0.28) < 1e-6);
});

test('EV5: the wiring - three lit shaders, the latched flat tint, the studio, the hosts', () => {
  const r = readFileSync('src/render/renderer.js', 'utf8');
  // the second directional term in exactly the three normal-bearing
  // programs (mesh, character, terrain) - the billboard program has no
  // normals and takes no uMoonDir
  assert.equal((r.match(/uniform vec3 uMoonDir;/g) || []).length, 3);
  assert.equal((r.match(/uMoonColor \* \(uMoonScale \* mdiff\)/g) || []).length, 3);
  // the flats: the Lambert-average half, INSIDE the _clockLit latch -
  // clockless scenes keep their full-bright flats
  const litBranch = r.slice(r.indexOf('if (this._clockLit)'), r.indexOf('gl.uniform3f(this.bbUTint, 1, 1, 1)'));
  assert.equal((litBranch.match(/this\._moonColor\[\d\] \* this\._moonScale \* 0\.5/g) || []).length, 3);
  // the studio borrow zeroes the moon and returns it - no moonlight on
  // a UI read-back panel
  const borrowStart = r.indexOf('const saved = studio');
  const borrow = r.slice(borrowStart, r.indexOf('const cs = this._charSpriteRT()', borrowStart));
  assert.ok(borrow.includes('moonScale: this._moonScale') && borrow.includes('this._moonScale = 0;')
    && borrow.includes('this._moonScale = saved.moonScale;'), 'borrow, zero, return');
  // the default is OFF - scale 0 until a host says otherwise
  assert.ok(r.includes('this._moonScale = 0;\n    this._moonColor'), 'constructor default is no moon');
  // the seam: only the enhanced sky has moon state to answer with
  const shared = readFileSync('src/scenes/shared.js', 'utf8');
  assert.match(shared, /moonlight\(\)\s*\{\s*return enhancedSky\?\.state \? moonlightTerm\(enhancedSky\.state\) : null;/,
    'classic answers null - the 1:1 lane keeps the hard-off night');
  // both exterior hosts drive it; no interior host ever does
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = readFileSync(host, 'utf8');
    assert.ok(src.includes('renderer.setMoonlight(moonNow)'), `${host} sets the key`);
    assert.ok(src.includes('withMoonAmbient(exteriorAmbient('), `${host} folds secunda into the ambient`);
  }
  for (const host of ['src/scenes/interior.js', 'src/scenes/dungeon.js']) {
    assert.ok(!readFileSync(host, 'utf8').includes('setMoonlight'),
      `${host} never calls setMoonlight - a fresh renderer's scale is already 0`);
  }
  // AUDIT EV F-R1: on the ONE shared renderer, "never calls" was the
  // leak - the exterior's per-frame moon froze at whatever the last
  // outdoor frame set, and a tavern entered on a full-Masser night
  // stayed moonlit for the visit (the F001 windowEmission bug class,
  // one field over). The modal frames now go dark EXPLICITLY: the
  // only setMoonlight calls in worldModes and the automap are the
  // null form, one per modal arm.
  const wm = readFileSync('src/scenes/worldModes.js', 'utf8');
  assert.equal((wm.match(/renderer\.setMoonlight\(/g) || []).length, 2, 'both modal arms clear the moon');
  assert.equal((wm.match(/renderer\.setMoonlight\(null\);/g) || []).length, 2, 'and only ever to null');
  assert.equal((wm.match(/renderer\.setIndirectLight\(NO_INDIRECT_POS, 0, NO_INDIRECT_COLOR\);/g) || []).length, 2,
    'the stale exterior indirect goes dark with it (the same leak family)');
  const am = readFileSync('src/ui/automapWindow.js', 'utf8');
  assert.equal((am.match(/renderer\.setMoonlight\(null\);/g) || []).length, 2,
    'the map pass clears it too - in the bracket setup, and again when the beacon group hands the unlit state back');
  // ROAD-C c2 flight 2: the ONE non-null call in the window is not
  // moonlight at all. DFU lights its automap BEACONS with three
  // directional lights (Automap.cs:2025-2076) where the mesh shader
  // carries two plus a third slot, so the FILL light rides the moon
  // slot for that one never-sliced group and is cleared the moment the
  // group is done - which is why the count above is two and not one.
  assert.equal((am.match(/renderer\.setMoonlight\(/g) || []).length, 3, 'and there is exactly one non-null call');
  assert.match(am, /renderer\.setMoonlight\(\{ scale: beacon\.fill, dir: BEACON_FILL_DIR, color: WHITE3 \}\);/,
    'the automap fill light (:2039-2044, intensity :2074), not a moon');
});
