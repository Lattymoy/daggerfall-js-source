// BLD (2026-10-26, the owner, having walked the Imperial City: "The new building layouts in the city look like some
// windows are upside down, clip into the ground and into the roofs, no doors/interiors, and no lighting sources like the
// original layouts"; bible/03-World/Arena-Provinces.md IC-GRAND, BLD) - THE FABRIC'S BUILDINGS AS THE GL DRAWS THEM,
// pinned: every wall's picture right side up on every facing, as the GL samples it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fabricCell, STOREY } from '../../src/world/imperialFabric.js';
import { fabricCellModel } from '../../src/world/imperialFabricModels.js';
import { IMPERIAL_CELLS, IMPERIAL_SECTORS, polar, imperialCell } from '../../src/world/imperialCity.js';
import { CAPITAL_ART, CAPITAL_ARCHIVE } from '../../src/world/capitalShapes.js';
import { capitalArt } from '../../src/world/capitalModels.js';
import { toColor32Order } from '../../src/formats/color32Order.js';
import { BLOCK_M } from '../../src/world/spawnedDungeons.js';

const B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;
/** A cell of the city's own near a point with at least `n` buildings. */
function sampleCell(x, z, n = 8) {
  const r0 = Math.floor(z / B + HALF), c0 = Math.floor(x / B + HALF);
  for (let k = 0; k < 6; k++) for (let r = r0 - k; r <= r0 + k; r++) for (let c = c0 - k; c <= c0 + k; c++) {
    if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== k || !/^I/.test(imperialCell(r, c) ?? '')) continue;
    const L = fabricCell(r, c);
    if (L.plots.length >= n) return L;
  }
  return null;
}
/** A cell in each district (its grid, its rings and spokes, its warped lanes, its docks): each sector's middle at two
 *  rings, and the Waterfront's. */
const CELLS = [...IMPERIAL_SECTORS.flatMap(([, b]) => [[b + 22.5, 3000], [b + 37.5, 5300]]), [170, 7300]].map(([b, r]) => sampleCell(...polar(b, r))).filter(Boolean);
const FACADES = new Set(['facadeOchre', 'facadeBrick', 'facadeWhite', 'facadeStone', 'facadeTimber', 'groundShop', 'groundArcade'].map((k) => CAPITAL_ART[k]));
/** Every vertical facade triangle of a model: its corners, their uvs, its record and its facing. */
function facadeFaces(m) {
  const out = [];
  for (const sm of m.subMeshes) {
    if (sm.textureArchive !== CAPITAL_ARCHIVE || !FACADES.has(sm.textureRecord)) continue;
    for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
      const ix = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
      const n = [m.normals[ix[0] * 3], m.normals[ix[0] * 3 + 1], m.normals[ix[0] * 3 + 2]];
      if (Math.abs(n[1]) > 1e-6) continue;
      out.push({ record: sm.textureRecord, n, p: ix.map((i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]), uv: ix.map((i) => [m.uvs[i * 2], m.uvs[i * 2 + 1]]) });
    }
  }
  return out;
}
const MODELS = CELLS.map((L) => fabricCellModel(L.r, L.c));

test('BLD WINDOWS RIGHT SIDE UP - every facade face of the fabric, on every facing, lays its picture\'s top row at its top as the GL samples it: v RISING up the wall (Daggerfall\'s own models\' law, world/meshReader.js v = -(row / height)), because every picture reaches the GL bottom-up (formats/color32Order.js, the stand-in door\'s toColor32); a point a hand under a storey\'s top samples the picture\'s top rows, a point a hand over the ground the shopfront\'s or the arcade\'s foot (mutant: v laid falling up the wall, a top-down raster\'s rows)', () => {
  assert.ok(CELLS.length >= 12, 'a cell in every district');
  const octants = new Set();
  let faces = 0;
  for (const m of MODELS) for (const f of facadeFaces(m)) {
    // v's rise per metre up the face, off the triangle's corners at two heights
    const [i, j] = [[0, 1], [0, 2], [1, 2]].find(([a, b]) => Math.abs(f.p[a][1] - f.p[b][1]) > 0.05) ?? [];
    if (i === undefined) continue;
    const rise = (f.uv[i][1] - f.uv[j][1]) / (f.p[i][1] - f.p[j][1]);
    assert.ok(rise > 0, `a face facing (${f.n[0].toFixed(2)}, ${f.n[2].toFixed(2)}) lays its picture upside down (dv/dy ${rise})`);
    octants.add(Math.round(((Math.atan2(f.n[2], f.n[0]) / Math.PI) * 4 + 8)) % 8);
    faces++;
  }
  assert.ok(faces > 1000, `the faces read (${faces})`);
  assert.equal(octants.size, 8, 'every facing of the compass among them');
  // the GL's own sampling of one face: an arcade's (its arch's crown up, its loggia's shadow at its foot)
  const art = capitalArt(), H = 128;
  const arcade = MODELS.flatMap(facadeFaces).find((f) => f.record === CAPITAL_ART.groundArcade && Math.min(...f.p.map((q) => q[1])) <= 1e-6 && Math.max(...f.p.map((q) => q[1])) >= STOREY - 1e-6);
  assert.ok(arcade, 'an arcade on a street front');
  const gl = toColor32Order(art.get(CAPITAL_ART.groundArcade));
  /** The picture's row (counted from its top, as painted) the GL samples at height y on the face. */
  const rowAt = (y) => {
    const [a, b] = [0, 1, 2].filter((k) => k < 3).sort((p, q) => arcade.p[p][1] - arcade.p[q][1]).filter((k, n, all) => n === 0 || n === all.length - 1);
    const t = (y - arcade.p[a][1]) / (arcade.p[b][1] - arcade.p[a][1]), v = arcade.uv[a][1] + (arcade.uv[b][1] - arcade.uv[a][1]) * t;
    const bufferRow = Math.min(H - 1, Math.floor((v - Math.floor(v)) * H));
    assert.equal(gl.width * H * 4, gl.data.length);
    return H - 1 - bufferRow;
  };
  assert.equal(rowAt(STOREY - 0.1), 4, 'a hand under the arcade\'s top: the picture\'s top rows (its impost and voussoirs)');
  assert.equal(rowAt(0.1), 124, 'a hand over the street: the picture\'s foot');
});

