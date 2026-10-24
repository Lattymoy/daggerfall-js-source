// EG-LOOK (2026-10-16, Elite-Gates-Look.md section 7): THE BANDS' AIR AND LIGHT - each band's own (world/eliteGates/egAtmos.js), read
// by the dungeon arm through world/eliteGates/egHall.js egHallFog, egHallLighting and egHallGrade. The law pinned here is the one the
// lab found broken: a band's stone turned away from its key light still reads - its ambient (the trilight's equator, at
// the lane's dungeon share) times its stone's middle step stays over a floor in every band, so the halls' architecture
// never vanishes into the void (the Shade's black glass and the Wellhead's basalt were near-black before).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EG_ATMOS, egAtmosOf } from '../../../src/world/eliteGates/egAtmos.js';
import { EG_BAND_RAMPS, egLuma } from '../../../src/world/eliteGates/egBandArt.js';
import { egHallFog, egHallLighting, egHallGrade } from '../../../src/world/eliteGates/egHall.js';
import { egBandOfCircle } from '../../../src/net/eliteGates/egLaw.js';
import { EL_DUNGEON_AMBIENT_SCALE } from '../../../src/render/enhancedLighting.js';

/** sRGB 0-255 to linear 0-1 (a texel's albedo the light multiplies). */
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linLuma = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
/** The floor a shaded face of a band's middle stone keeps on the lane (linear radiance at the eye's widest opening) - the
 *  Wellhead's basalt the lowest (0.0135), the Shade's glass 0.016, the Galleries' marble 0.039; the old air left the Shade's at
 *  under a fiftieth of it. */
export const EG_SHADE_READ_MIN = 0.012;

test('EG-LOOK THE SHADED FACE READS (Elite-Gates-Look.md section 7): in every band a face of its stone turned away from the key - lit by the trilight\'s equator alone, at the lane\'s dungeon share, the eye at its band\'s widest (the grade\'s adaptMax) - stays over EG_SHADE_READ_MIN; the darkest band\'s stone is still its darkest (mutants: a band\'s ambient cut back to the void\'s)', () => {
  const read = EG_ATMOS.map((a, b) => lum(a.tri.equator) * EL_DUNGEON_AMBIENT_SCALE * linLuma(EG_BAND_RAMPS[b].stone[2]) * a.grade.adaptMax);
  for (const [b, r] of read.entries()) assert.ok(r >= EG_SHADE_READ_MIN, `band ${b}: a shaded face ${r.toFixed(4)}`);
  assert.ok(EG_BAND_RAMPS.every((R, b) => b === 2 || egLuma(R.stone[2]) > egLuma(EG_BAND_RAMPS[2].stone[2])), 'the Shade\'s glass the darkest stone');
});

test('EG-LOOK EACH CIRCLE BREATHES ITS BAND\'S AIR (section 7): the dungeon arm\'s fog, light and grade for a circle are its band\'s own table rows, the Galleries\' with no circle; four bands, four airs (mutants: a circle read as the Galleries\'; two bands sharing a fog)', () => {
  for (const c of [1, 5, 6, 10, 11, 15, 16, 20]) {
    const A = egAtmosOf(egBandOfCircle(c));
    assert.equal(egHallFog(c), A.fog);
    assert.equal(egHallGrade(c), A.grade);
    assert.equal(egHallLighting(c).tri, A.tri);
    assert.equal(egHallLighting(c).key, A.key);
  }
  assert.equal(egHallFog(undefined), egAtmosOf(0).fog);
  assert.equal(new Set(EG_ATMOS.map((a) => a.fog.color.join())).size, 4);
  assert.equal(new Set(EG_ATMOS.map((a) => a.tri.equator.join())).size, 4);
});
