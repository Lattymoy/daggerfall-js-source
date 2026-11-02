// SKY-ARC (2026-10-19, a player's screenshot, Discord "BY THE RING"; bible/07-Rendering/Volumetric-Clouds-Arc.md SKY-ARC): ONE HARD, SMOOTH ARC ACROSS A DUSK SKY - the
// player's own deck warm on one side of it and blue-grey on the other, sweeping from high overhead down to the horizon.
//
// Reproduced in the game (5 Morning Star 3E405 17:20 at Daggerfall, the map's word cloudy, facing north) and in the sky
// lab with that minute's map cells: the line is the BOUNDING CYLINDER of a cell whose own cloud stands 13 km away (the
// eastern system's overcast ring, SLAB-SPAN's reach 85.0 km, its wall 0.73 km west of the eye). Remove that one cell and
// the line goes; it carries no cloud where the line is drawn.
//
// THE CAUSE. The march faded every sample toward the horizon colour by the START OF THE SPAN holding it (SLAB-SPAN:
// `fade = 1 - exp(-spanA[span] / 14000)`). Span starts are bookkeeping - where the walk may skip air - and they jump
// where spans merge or split: a ray that leaves the cell's column below the zone's base keeps the zone's deck in a
// span of its own (faded by uBase / dir.y); one that leaves it above merges the column (from the cell's lower base) with
// the zone (the same deck faded by the column's start, a.x / dir.y). The locus between them is the cylinder's wall at
// the zone's base - a horizontal circle, so a smooth conic on the sky, and a hard one, since the fade steps across it.
//
// THE LAW. Aerial perspective is a property of the light's path from the eye to the point that scattered it: each
// sample is faded by its OWN distance. The spans decide where the march walks, never what colour it finds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellOf } from '../../src/render/volumetricClouds.js';
import { marchFns } from '../cloudSky.mjs';

const DEG = Math.PI / 180;
// the eye 700 m inside an overcast cell's bounding cylinder, its centre due east (a circle: its reach is its radius)
const R = 71000, GAP = 700;
const cell = cellOf('overcast', R - GAP, 0, R);
// a full deck in the zone: the textures a flat 0.5, the cover whole - so the only structure in the sky is the spans'
const over = { uCover: 1, uDensity: 0.8, uFlat: 0.9, uVary: 0, uHorizonColor: [1, 0, 0], uMapSize: [1, 1] };
const colourAt = (azDeg, elDeg, cells) => {
  const f = marchFns(cells, { ...over, gl_FragCoord: [azDeg / 360, elDeg / 90, 0, 1] });
  f.main();
  return f.globals.outColor;
};
const diff = (a, b) => Math.max(...[0, 1, 2, 3].map((i) => Math.abs(a[i] - b[i])));

test('SKY-ARC: the march is continuous across a span merge - the wall of a cell that brings no cloud draws no line', () => {
  // due west the ray meets the wall at 700 m out; it leaves the column at the zone's base (uBase) at this elevation
  const elWall = Math.atan2(over.uBase ?? 1400, GAP) / DEG;
  const step = 0.4;
  const across = diff(colourAt(270, elWall - step, [cell]), colourAt(270, elWall + step, [cell]));
  // the same two-texel step a few degrees away, where nothing merges: the sky's own gradient
  const beside = diff(colourAt(270, elWall - 6 - step, [cell]), colourAt(270, elWall - 6 + step, [cell]));
  assert.ok(across < 3 * beside + 2e-3, `across the merge ${across.toFixed(5)}, the sky's own step beside it ${beside.toFixed(5)}`);
});

test('SKY-ARC: a cell whose cloud a ray never meets leaves that ray as the zone alone would draw it', () => {
  // the ray climbs out of the column below the cell's own deck and meets only the zone's deck - the cell's wall,
  // its lower base and its span change where the march walks, never the colour it finds there
  for (const el of [40, 55, 63, 70]) {
    const withCell = colourAt(270, el, [cell]), alone = colourAt(270, el, []);
    assert.ok(diff(withCell, alone) < 0.005, `el ${el}: ${withCell.map((v) => v.toFixed(3))} against ${alone.map((v) => v.toFixed(3))}`);
  }
});
