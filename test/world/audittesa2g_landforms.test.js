// AUDIT TESA II Z8 (AUDIT TESA-BIOME Z8, OWED): the landforms' hills past the Bay wear their zone's land - a node off the
// Bay's map past its seam band reads the continent's climate (world/tamriel/tamrielGround.js tamrielClimateAt), where every
// one had been held to the nearest edge pixel's (86% of the land past the Bay wore another land's hills); the Bay and its
// seam band keep the table's own, to the bit. bible/03-World/Tamriel-Biomes.md, bible/01-Overview/audits/Audit-Tesa-Biome.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hillsAt, groundTopOf } from '../../src/world/landforms.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { tamrielClimateAt, SEAM_PX } from '../../src/world/tamriel/tamrielGround.js';
import { veilhaven } from '../../src/world/ethericSea.js';

const SPAN = 128, MAP_H = 500;
const table = (c) => new Uint8Array(1000 * 500).fill(c);
/** a map pixel's centre in the hills' samples (x east, y north) */
const at = (px, py) => [(px + 0.5) * SPAN, (MAP_H - py) * SPAN];
const hills = (px, py, climates) => hillsAt(...at(px, py), 600, 500, null, climates, null, SPAN);

test('AUDIT TESA II Z8: a sample past the Bay\'s seam band wears its zone\'s land - whatever the Bay\'s edge pixels are - while the Bay and its seam band wear the table\'s; the air\'s ceiling reads the same (mutants: the clamp back; the seam band the zone\'s)', () => {
  setTamrielTrace(null); setTamrielFit(null);
  const mountain = table(CLIMATES.Mountain), desert = table(CLIMATES.Desert);
  // past the seam: Valenwood's rain forest and Cyrodiil's valley, the same over a Bay of mountains and a Bay of desert
  for (const [px, py] of [[1247, 1449], [2069, 658], [1000 + SEAM_PX + 2, 250]]) {
    assert.ok(tamrielClimateAt(px, py) !== CLIMATES.Mountain && tamrielClimateAt(px, py) !== CLIMATES.Desert, `${px}, ${py} a zone of its own land`);
    assert.equal(hills(px, py, mountain), hills(px, py, desert), `${px}, ${py}: its zone's hills, not the Bay's edge's`);
  }
  // on the Bay and in the seam band the table's own: a Bay of mountains and one of desert stand other hills
  for (const [px, py] of [[500, 250], [999, 250], [1000, 250]]) assert.notEqual(hills(px, py, mountain), hills(px, py, desert), `${px}, ${py}: the table's`);
  // the air's ceiling (groundTopOf, the snowpack's) bounds the zone's tallest hill there, not the edge's: a stub of flat bytes
  const flat = { getHeightMapValuesRange1Dim: (x, y, d) => new Uint8Array(d * d).fill(40), getLargeHeightMapValuesRange: (x, y, d) => new Uint8Array(81).fill(0) };
  assert.equal(groundTopOf(flat, 1247, 1449, true, mountain), groundTopOf(flat, 1247, 1449, true, desert), 'past the seam the zone\'s');
  assert.notEqual(groundTopOf(flat, 999, 250, true, mountain), groundTopOf(flat, 999, 250, true, desert), 'on the Bay the table\'s');
  // and an isle of the Eltheric Ocean past the map its own climate's land (AUDIT CAPTAIN'S SEA G3's law arm), never the sea's
  // the zones past the seam would give it: its ceiling the one a Bay pixel of its climate stands under
  const v = veilhaven();
  assert.equal(groundTopOf(flat, v.px, v.py, true, mountain), groundTopOf(flat, 500, 250, true, table(v.climate)), `${v.name}: its own ${v.climate}'s land`);
  assert.notEqual(groundTopOf(flat, v.px, v.py, true, mountain), groundTopOf(flat, 500, 250, true, table(CLIMATES.Ocean)), 'not the sea\'s');
});

test('AUDIT TESA II Z8 by source: the nodes off the map read nodeLand - the seam band held to the edge, the zones past it', () => {
  const src = readFileSync(new URL('../../src/world/landforms.js', import.meta.url), 'utf8');
  assert.match(src, /if \(bayEdgeDistance\(x, y\) > SEAM_PX\) return LAND_OF_CLIMATE\[tamrielClimateAt\(x, y\)\];/);
  assert.match(src, /function etherLandAt\(x, y, climates\) \{\n\s+if \(!inEtherLaw\(x, y\)\) return nodeLand\(x, y, climates\);/);
});
