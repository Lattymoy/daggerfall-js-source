// PUDDLE-RAIN (FIELD BUGS 2026-10-01 #1 - "When sinking into a puddle rain isnt shown and disappears from screen").
// The port swims wherever the drawn water is under the feet (MAC2), a puddle record's whole tile among it
// (WATER-PUDDLE kept the feet on DFU's whole tile), and a body on exterior water sinks; DW-D stood the rain, the snow
// and the sand down for any swimmer outdoors (Iliac Puddle No More's UpdateWeatherParticles, IsPlayerSwimming &&
// !IsWaterWalking) - so a body sunk in a puddle, its eye 0.2 m over the water, lost the rain while the rain loop
// played on. The real chain: exteriorSurfaces on a puddle record, exteriorSwimming over the sink, the sea's own
// fogPresentation for an eye inland; then the frame's gate, lifted off world.js and run: what falls is hidden by the
// water over the EYE alone - the distance fog's "under", as the wisps and the bolts already were.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exteriorSurfaces, exteriorSwimming, ON_EXTERIOR_WATER } from '../../src/player/exteriorSurface.js';
import { SWIM_EYE_HEIGHT } from '../../src/player/motor.js';
import { SHALLOW_WHOLE } from '../../src/world/water/waterCorners.js';
import { createDeepWatersPlayer } from '../../src/scenes/deepWater/deepWatersPlayer.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const OCEAN = 34;
/** The sea of dwc_fog's swimmer: x in [0, 100] a column 24 m deep, the rest dry land. */
function seaPlayer() {
  const col = (entry, lx) => (lx >= 0 && lx <= 100 ? { oceanY: OCEAN, seafloorY: 10, renderedSeafloorY: 10, depth: OCEAN - 10, entry } : null);
  const host = { waterColumn: col, rawWaterColumn: col };
  return createDeepWatersPlayer({
    host, locate: (x, z) => ({ entry: {}, lx: x, lz: z, baseY: 0 }), seaY: () => OCEAN, terrainGroundAt: () => -Infinity,
    collider: { raycastHit: () => null }, settings: () => ({ fogStrength: 0.5, fogDistance: 0.3 }),
  });
}
/** world.js's two gate lines, lifted and run over the frame's state. */
function frameGate() {
  const w = rd('src/scenes/world.js');
  const a = w.indexOf('    const _dwAirOff = ');
  const b = w.indexOf('\n', w.indexOf('    const _dwPrecipOff = ', a));
  assert.ok(a > 0 && b > a, 'the gate is where the rain draws');
  // eslint-disable-next-line no-new-func
  return new Function('_dwFogP', 'dwPlayer', 'walkMode', 'player', `${w.slice(a, b)}\nreturn { air: _dwAirOff, precip: _dwPrecipOff };`);
}

test('PUDDLE-RAIN: a body sunk in a puddle is a swimmer with its eye over the water - and the rain, the snow and the sand still fall for it (mutant: the swimmer\'s arm back in the gate)', () => {
  const ground = { hit: true, terrain: true };
  for (const record of SHALLOW_WHOLE) {
    // the feet anywhere on the puddle's tile - its whole tile is water to them (WATER-PUDDLE's "the feet keep DFU's whole tile")
    const s = exteriorSurfaces({ rawTile: record, feet: [0.1, 0.9], probe: ground });
    assert.equal(s.water, ON_EXTERIOR_WATER.Swimming, `record ${record}: the feet swim (MAC2)`);
  }
  assert.equal(exteriorSwimming({ sunk: true }), true, 'and a sunk body is IsPlayerSwimming');
  // the puddle 86 m over the sea, inland of every column: the eye SWIM_EYE_HEIGHT over the feet, which stand in the water's plane
  const puddleY = 120, feet = [400, puddleY, 0];
  const eye = [feet[0], puddleY + SWIM_EYE_HEIGHT, 0];
  const fogP = seaPlayer().fogPresentation({ camera: eye, centre: [feet[0], puddleY + 0.15, 0], swimming: true });
  assert.equal(fogP.under, false, 'the eye is over the water: the sea\'s own fog says so');
  const gate = frameGate();
  const swimmer = { isPlayerSwimming: true, waterWalking: false };
  const out = gate(fogP, {}, true, swimmer);
  assert.equal(out.precip, false, 'the rain falls on a swimmer whose eye is in the air');
  assert.equal(out.air, false);
  // a swimmer at sea with the head out is the same: the water over the eye is the whole test
  const seaEye = seaPlayer().fogPresentation({ camera: [50, OCEAN + 0.6, 0], centre: [50, OCEAN - 0.6, 0], swimming: true });
  assert.equal(seaEye.under, false);
  assert.equal(gate(seaEye, {}, true, swimmer).precip, false, 'a head out of the sea sees the rain');
});

test('PUDDLE-RAIN: under the water the falling weather is still hidden, swimmer or not - and both draws read the one gate (mutants: the gate off; the sand\'s or the rain\'s reader)', () => {
  const gate = frameGate();
  const under = seaPlayer().fogPresentation({ camera: [50, OCEAN - 3, 0], centre: [50, OCEAN - 3.5, 0], swimming: true });
  assert.equal(under.under, true, 'an eye three metres down');
  for (const player of [{ isPlayerSwimming: true, waterWalking: false }, { isPlayerSwimming: false, waterWalking: false }]) {
    const out = gate(under, {}, true, player);
    assert.equal(out.precip, true, 'nothing falls under the sea');
    assert.equal(out.air, true);
  }
  assert.equal(gate(null, null, true, { isPlayerSwimming: true }).precip, false, 'no sea mod: the classic gate never hid it');
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(sand && !_dwPrecipOff\) \{/, 'the sand reads it');
  assert.match(w, /if \((?:\(!_travelWeatherOff \|\| tvf\)|!_travelWeatherOff) && !_dwPrecipOff\) \{\s*\n\s*precip\.drawFall\(precipShown, proj, view/, 'the rain and the snow read it (PRECIP1: the fall at the air\'s snow share)');
  assert.doesNotMatch(w.slice(w.indexOf('    const _dwAirOff = '), w.indexOf('    const precipShown = ')), /isPlayerSwimming/, 'the swim is no part of it');
});

test('RAIN-OVER-GRASS + OW-RAIN (Mac: "it stops raining (you can still hear it) also the rain, rains behind the grass texture ... when you move on the overworld map"): what falls is drawn after the grass and the banners, and an Overworld journey keeps it falling (mutants: drawn before the grass; the journey\'s switch unexcepted)', () => {
  const w = rd('src/scenes/world.js');
  const fall = w.indexOf('    drawFalling();');
  assert.ok(fall > 0, 'called once the opaque world is whole');
  assert.ok(w.indexOf('labGrass.draw(proj, view') < fall, 'after the grass');
  assert.ok(w.indexOf('if (hallBanners || seatBanners) {') < fall, 'after the banners');
  assert.ok(fall < w.indexOf('    drawVeiledPeerBodies();'), 'before the translucent bodies');
  assert.ok(w.indexOf('const drawFalling = () => {') < w.indexOf('precip.drawFall(precipShown, proj, view'), 'the rain inside it');
  assert.match(w, /if \(\(!_travelWeatherOff \|\| tvf\) && !_dwPrecipOff\) \{/, 'the Overworld keeps it');
});
