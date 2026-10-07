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
  skyState, moonlightTerm, withMoonAmbient, phaseLitFraction, MOONLIGHT, moonRise, moonCloudiness,
} from '../src/render/enhancedSky.js';
import { dynamicMoonState, dynamicMoonlight } from '../src/render/dynamicSkiesBridge.js';   // AUDIT 65 MC-3: the mod's arm of moonlight(), and the state its own producer mints
import { MATERIAL_DEFAULTS } from '../src/systems/dynamicSkies.js';
import { LUNAR_PHASES } from '../src/systems/gameDate.js';

const midnight = (phases, weather = 'sunny') =>
  skyState({ minuteOfDay: 0, weather, phases });
const hexOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

test('EV5: phaseLitFraction - the phase ring folded at Full', () => {
  const expect = { 0: 0, 1: 0.25, 2: 0.5, 3: 0.75, 4: 1, 5: 0.75, 6: 0.5, 7: 0.25 };
  for (const [p, f] of Object.entries(expect)) assert.equal(phaseLitFraction(Number(p)), f);
  assert.equal(phaseLitFraction(LUNAR_PHASES.None), 0, 'the year<0 sentinel reads as unlit');
});

test('EV5: a full masser at midnight keys the night; the formula is the state\'s own numbers', () => {
  const s = midnight({ masser: LUNAR_PHASES.Full, secunda: LUNAR_PHASES.Full });
  const term = moonlightTerm(s);
  assert.ok(term, 'a clear full-moon night lights');
  // MOONLIT1: the twilight long gone, no lid under the sunny row's cumulus, and the moon far above the haze - so the
  // key is the lit fraction SQUARED times the dome's own visibility, nothing else
  assert.equal(moonRise(s), 1, 'midnight is the moon\'s');
  assert.equal(moonCloudiness(s.cloudCover), 0, 'a sunny sky is no lid');
  assert.ok(s.masser.dir[1] > MOONLIGHT.horizonY, 'and she is clear of the haze');
  assert.equal(term.scale, MOONLIGHT.masser * phaseLitFraction(s.masser.phase) ** MOONLIGHT.phasePower * s.masser.vis);
  assert.ok(term.scale > 0.4, 'a full clear masser is a real key light (MOONLIT1: EV5\'s was 0.22)');
  assert.equal(term.dir, s.masser.dir, 'the light points at the disc the dome draws');
  const silver = hexOf(MOONLIGHT.silver);
  assert.deepEqual(term.color, s.masser.color.map((c, i) => c + (silver[i] - c) * MOONLIGHT.silverMix), 'and wears her colour, leaned toward silver');
  // full moon opposite the sun: high in the midnight sky - MOONLIT1: and leaned south, off the zenith, so a wall facing
  // her is lit and a caster's shadow lies beside it rather than under it
  assert.ok(term.dir[1] > 0.9, 'the full moon rides high at midnight');
  assert.ok(term.dir[2] < -0.3, 'in the southern sky');
  // the moonlit sky: Masser's share in her key's colour, Secunda's in hers, each by its own phase and visibility
  const fillM = MOONLIGHT.skyFill * s.masser.vis, fillS = MOONLIGHT.secunda * s.secunda.vis;
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(term.ambient[i] - (term.color[i] * fillM + s.secunda.color[i] * fillS)) < 1e-12, `channel ${i}`);
  assert.ok(term.ambient[0] > 0.05, 'a full moonlit sky is a felt lift');
  assert.equal(term.casts, true, 'MOONLIT1: the world\'s moon may own the directional shadow map');
});

test('EV5: by day the sun owns the sky - the term is null even with both moons full', () => {
  // CLK3 review: the term rides the rig's daylight curve now, which is 0 at
  // the dawn minute itself and climbs from there - so "by day" is sampled a
  // quarter hour in (375), where the moon has faded out, not at 06:00 exactly
  for (const m of [375, 720, 1000]) {
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
  assert.ok(storm.scale < clear.scale * 0.15, 'a stormy sky takes the key - MOONLIT1: the lid diffuses it');
  assert.ok(storm.scale > 0, 'but the vis law is a dimmer, not a switch');
  // MOONLIT1: a share of what the lid takes off the key comes back down as fill - the storm's shade is lighter than
  // the clear night's, and its moonlight, key and fill together, is under half of it
  assert.ok(storm.ambient[1] > clear.ambient[1], 'the lid glows');
  const light = (t) => t.scale + 0.2126 * t.ambient[0] + 0.7152 * t.ambient[1] + 0.0722 * t.ambient[2];
  assert.ok(light(storm) < light(clear) * 0.5, `the storm's moon is dimmer whole (${light(storm).toFixed(3)} against ${light(clear).toFixed(3)})`);
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
  assert.equal((r.match(/uniform vec3 uMoonDir;/g) || []).length, 4);   // BLOOD AUDIT 5: and the decal, which reads its normal off its own derivatives and takes the moon by N.L (uDecalMoon * mdiff, not this program's colour * scale form)
  assert.equal((r.match(/uMoonColor \* \(uMoonScale \* mdiff\)/g) || []).length, 3);
  // the flats: the Lambert-average half, INSIDE the _clockLit latch -
  // clockless scenes keep their full-bright flats
  // ANCHORED INSIDE drawBillboards, which is what this pin has always
  // meant. It used to take `indexOf('if (this._clockLit)')` - the
  // FIRST one in the file - and that held only while the billboard
  // pass was the first thing to ask the latch. BLOOD1a's decal pass
  // asks it too, and legitimately (a mark on a dungeon floor is as
  // dark as the floor, and a clockless scene keeps it bright), which
  // stretched the slice from one branch to eighty-nine thousand
  // characters and swept up a second triple. The law is the FLATS'
  // half, so the slice is the flats' draw.
  const bbAt = r.indexOf('  drawBillboards(batches');
  assert.ok(bbAt > 0, 'the billboard pass');
  const litBranch = r.slice(r.indexOf('if (this._clockLit)', bbAt), r.indexOf('gl.uniform3f(this.bbUTint, 1, 1, 1)'));
  // MOONLIT1: the half rides the tint (mt) - or the key slot beside the sun's (mk) on a frame the moon owns the
  // directional map, where the lane reads her map for it once a quad
  assert.match(litBranch, /const mt = this\._moonMapNow \? 0 : this\._moonScale \* 0\.5, mk = this\._moonMapNow \? this\._moonScale \* 0\.5 : 0;/);
  assert.equal((litBranch.match(/am\[\d\] \+ mc\[\d\] \* mt/g) || []).length, 3);   // EL1: `mc` is _moonColor as the installed set wants it (_c3)
  assert.equal((litBranch.match(/sc\[\d\] \* this\._sunScale \* 0\.5 \+ mc\[\d\] \* mk/g) || []).length, 3);
  assert.match(litBranch, /mc = this\._c3\(this\._moonColor, this\._decB\)/);
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
  // DS1: the mod's moons feed the same term (dynamicMoons); the dome's
  // arm and the classic null are as they were.
  // AUDIT 65 MC-3: the mod's arm is the BRIDGE's own export now, not a
  // second copy of its body - dynamicMoonlight carries the null guard,
  // so the arm a future host forgets lives in one place.
  assert.match(shared, /moonlight\(\)\s*\{\s*if \(enhancedSky\?\.state\) return moonlightTerm\(enhancedSky\.state\);[\s\S]*?return dynamicMoonlight\(dynamicMoons\);/,
    'classic answers null - the 1:1 lane keeps the hard-off night');
  // and the export itself answers, rather than merely being named: the
  // null arm, and byte-for-byte moonlightTerm for a state the mod's own
  // producer mints (dynamicMoonState, the shape shared.js hands it).
  assert.equal(dynamicMoonlight(null), null, 'no mod moons, no term - the classic night');
  const dyn = {
    mat: { ...MATERIAL_DEFAULTS }, _sunDir: [0, -0.5, 0],
    phases: { masser: { phase: LUNAR_PHASES.Full }, secunda: { phase: LUNAR_PHASES.Full } },
    moonDirection: (w) => (w === 'Moon' ? [0, 0.7, 0.7] : [0, 0.5, 0.5]),
  };
  const modMoons = dynamicMoonState(dyn, 23 * 60, 0);
  assert.ok(moonlightTerm(modMoons), 'the fixture is a LIT mod night - a null-vs-null identity would pin nothing');
  assert.deepEqual(dynamicMoonlight(modMoons), moonlightTerm(modMoons), 'the bridge hands the world the dome\'s own term');
  // both exterior hosts drive it; no interior host ever does
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = readFileSync(host, 'utf8');
    assert.ok(src.includes('renderer.setMoonlight(moonNow)'), `${host} sets the key`);
    assert.ok(src.includes('withMoonAmbient(withNightFloor(exteriorAmbient('), `${host} folds the moonlit sky into the ambient, over the night sky's floor (MOONLIT1)`);
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
  // WB6a: the one exception, and it cannot leak - the Burning Court's key light (the vortex's fire behind the boss)
  // is set on the moon's term in the dungeon arm, in the SAME frame and right after that arm's own null clear, so the
  // next frame of any arm starts dark again (WB6b: a strike in the Deadlands' sky swings it for a moment - the same call)
  assert.equal((wm.match(/renderer\.setMoonlight\(/g) || []).length, 3, 'both modal arms clear the moon, and the court sets its key');
  assert.equal((wm.match(/renderer\.setMoonlight\(null\);/g) || []).length, 2, 'the clears to null');
  assert.match(wm, /      renderer\.setMoonlight\(null\);\n      renderer\.setIndirectLight\(NO_INDIRECT_POS, 0, NO_INDIRECT_COLOR\);\n      if \(isGateArena\(dungeonLoc\)\) \{ const _cl = courtLighting\(deadlandsFlash\(_deadS\)\);[^\n]*renderer\.setMoonlight\(_cl\.key\); \}/,
    'the court\'s key, in the court alone, straight after the dungeon arm\'s own clear');
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
