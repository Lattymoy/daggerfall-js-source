// TESA-LANDS (bible/03-World/Tamriel-Lands.md) - THE LANDS' LANDMARKS: their meshes (world/lands/landPropMesh.js), their
// pictures (render/landPropArt.js), their law (world/lands/landProps.js - where each stands, what it is, its bodies) and
// their host (scenes/landPropsHost.js - the GPU on the slice clock, the frame on the fourth tree slot, the casters), and
// the wiring from the terrain's kernel through the pixel's build to the trees' host. No game data is read here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAND_KINDS, LAND_VARIANTS, LAND_LODS, LAND_SUBS, VINE_SPAN, LAND_CHEST, landPropMesh, landSeed } from '../../src/world/lands/landPropMesh.js';
import {
  LAND_PROP_FLOATS, LAND_KIND_LAW, LAND_LOOKS, LAND_LOOK_NAMES, LAND_FOOT_RECORDS, WATER_RECORDS, VINE_BLOCK, PATCH_BLOCK, FLAT_CLEAR, HIST_ROOTS,
  landSites, landMeasures, landLodOf, flatsOffProps, landPropBodies, standLandProps,
} from '../../src/world/lands/landProps.js';
import { LAND_ART, LAND_KIND_ART, landPicture, pictureMean } from '../../src/render/landPropArt.js';
import { createLandPropsHost, LAND_PROPS_SLOT, LAND_DRAW, landMeshIndex, lookTint } from '../../src/scenes/landPropsHost.js';
import { createLookupTable } from '../../src/world/terrain/terrainTiles.js';
import { LANDS } from '../../src/world/tamriel/tamrielLands.js';
import { seatFlora, warmFlora } from '../../src/scenes/floraSeat.js';
import { walkGroundAt, drawnGroundAt } from '../../src/world/terrain/terrainSurface.js';
import { HEIGHTMAP_DIMENSION as HD, MAX_TERRAIN_HEIGHT, SCALED_BEACH_ELEVATION } from '../../src/world/terrain/terrainSampler.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const li = (n) => LAND_LOOK_NAMES.indexOf(n), ki = (k) => LAND_KINDS.indexOf(k);

const ONE_AXIS = { parasol: [0, 2], spire: [0, 1, 3, 4], hist: [0, 1, 2], grove: [0, 1, 2] };

test('TESA-LANDS THE MESHES: every kind\'s every variant at every LOD made, finite, in three submeshes, no vertex count past a u16 run, each LOD no finer than the one before, the same every make; its faces wound out of the body (mutants: a face wound in; a LOD finer than its nearer; the seed unread)', () => {
  assert.deepEqual(LAND_KINDS, ['parasol', 'spire', 'hist', 'reeds', 'vines', 'grove']);
  assert.deepEqual(LAND_SUBS, ['body', 'crown', 'detail']);
  for (const kind of LAND_KINDS) {
    for (let v = 0; v < LAND_VARIANTS[kind]; v++) {
      let last = Infinity;
      for (let l = 0; l < LAND_LODS; l++) {
        const m = landPropMesh(kind, v, l), n = m.positions.length / 3;
        assert.ok(n > 0 && n < 65535 && n % 3 === 0, `${kind} ${v} LOD ${l}: ${n} vertices`);
        assert.equal(m.subs.length, 3);
        assert.equal(m.subs.reduce((a, [, c]) => a + c, 0), n);
        assert.ok(m.positions.every(Number.isFinite) && m.normals.every(Number.isFinite) && m.uvs.every(Number.isFinite), `${kind} ${v} ${l} finite`);
        assert.ok(n <= last, `${kind} ${v}: LOD ${l} no finer than its nearer (${n} > ${last})`);
        last = n;
        assert.ok(m.top > 0 && m.reach > 0 && m.stalk >= 0);
        // the body's faces look away from its axis on the whole (its sides out, its caps up) - a variant of one axis (the
        // parasols' grove of three and the crag's lumps stand about axes of their own)
        if (ONE_AXIS[kind]?.includes(v) && l === 0) {
          let out = 0, all = 0;
          const [b0, bc] = m.subs[0];
          for (let i = b0; i < b0 + bc; i += 3) {
            const cx = (m.positions[i * 3] + m.positions[i * 3 + 3] + m.positions[i * 3 + 6]) / 3, cz = (m.positions[i * 3 + 2] + m.positions[i * 3 + 5] + m.positions[i * 3 + 8]) / 3;
            const d = m.normals[i * 3] * cx + m.normals[i * 3 + 2] * cz + Math.max(0, m.normals[i * 3 + 1]) * 0.5;
            all++; if (d > 0) out++;
          }
          assert.ok(out / all > 0.7, `${kind} ${v}: its body's faces wound out (${out}/${all})`);
        }
      }
    }
  }
  const a = landPropMesh('hist', 1, 0), b = landPropMesh('hist', 1, 0);
  assert.deepEqual(Array.from(a.positions), Array.from(b.positions), 'a variant the same every make');
  assert.notDeepEqual(Array.from(landPropMesh('spire', 0, 1).positions.slice(0, 30)), Array.from(landPropMesh('spire', 1, 1).positions.slice(0, 30)), 'its own seed a variant');
  assert.notEqual(landSeed('spire', 0), landSeed('spire', 1));
  assert.throws(() => landPropMesh('dragon', 0, 0));
  // a vineyard's row spans a tile, so the next tile's row meets it
  assert.ok(Math.abs(landPropMesh('vines', 0, 0).reach - VINE_SPAN / 2 * 1.05) < 1e-6);
});

test('TESA-LANDS THE PICTURES: every picture its size, a power of two; the grey ones grey (their look colours them), their mean the share a look\'s colour is laid over; a card cut whole (alpha 0 or 255); every kind\'s three named; the same every paint (mutants: a grey picture coloured; a card\'s alpha half)', () => {
  for (const [name, a] of Object.entries(LAND_ART)) {
    const p = landPicture(name);
    assert.equal(p.width, a.w); assert.equal(p.height, a.h);
    assert.ok((a.w & (a.w - 1)) === 0 && (a.h & (a.h - 1)) === 0, `${name} a power of two`);
    assert.equal(p.data.length, a.w * a.h * 4);
    let opaque = 0;
    for (let o = 0; o < p.data.length; o += 4) {
      assert.ok(p.data[o + 3] === 0 || p.data[o + 3] === 255, `${name}: cut whole`);
      if (!p.data[o + 3]) continue;
      opaque++;
      if (a.grey) assert.ok(p.data[o] === p.data[o + 1] && p.data[o + 1] === p.data[o + 2], `${name}: grey`);
    }
    assert.ok(opaque > p.data.length / 4 * 0.05, `${name}: a picture`);
    const m = pictureMean(p);
    if (a.grey) assert.ok(m[0] > 0.5 && m[0] < 0.95, `${name}: its mean (${m[0].toFixed(2)})`);
    assert.deepEqual(Array.from(landPicture(name).data), Array.from(p.data), `${name} the same every paint`);
  }
  for (const kind of LAND_KINDS) assert.ok(LAND_KIND_ART[kind].length === 3 && LAND_KIND_ART[kind].every((n) => LAND_ART[n]), kind);
  assert.ok(['spray', 'moss', 'reeds', 'grapes'].every((n) => landPicture(n).data.some((v, i) => i % 4 === 3 && v === 0)), 'the cards are cut');
  assert.throws(() => landPicture('nothing'));
  // a look's colour over a grey picture's mean: the picture's whole at the look's colour
  assert.deepEqual(lookTint('#808080', 'cap', [0.5, 0.5, 0.5]).map((v) => +v.toFixed(4)), [1.0039, 1.0039, 1.0039]);
  assert.deepEqual(lookTint('#ff0000', 'reeds', [0.5, 0.5, 0.5]), [1, 1, 1], 'a picture in its own colours is white');
  assert.deepEqual(lookTint(null, 'cap', [0.5, 0.5, 0.5]), [1, 1, 1]);
});

test('TESA-LANDS THE LOOKS AND THE LAWS: every look a kind\'s, its variants the kind\'s, its scale a range, its colours hex; every kind a law - its cell a power of two dividing a pixel, its inset inside its cell, its LODs\' reaches rising; the tile records a foot stands on the land\'s and no water\'s (mutants: a variant past its kind\'s; a cell that straddles a pixel; the water a foot)', () => {
  const HEX = /^#[0-9a-f]{6}$/i;
  for (const [name, l] of Object.entries(LAND_LOOKS)) {
    assert.ok(LAND_KINDS.includes(l.kind), name);
    assert.ok(l.variants.length && l.variants.every((v) => Number.isInteger(v) && v >= 0 && v < LAND_VARIANTS[l.kind]), `${name}'s variants`);
    assert.ok(l.scale[0] > 0 && l.scale[1] >= l.scale[0], `${name}'s scale`);
    for (const c of [l.body, l.crown, l.detail]) if (c != null) assert.match(c, HEX);
  }
  assert.equal(LAND_LOOKS.vine.scale[0], 1); assert.equal(LAND_LOOKS.vine.scale[1], 1);
  for (const kind of LAND_KINDS) {
    const law = LAND_KIND_LAW[kind];
    assert.ok(law.cell >= 1 && 128 % law.cell === 0 && (law.cell & (law.cell - 1)) === 0, `${kind}'s cell`);
    assert.ok(law.inset[0] >= 0 && law.inset[1] <= 1 && law.inset[0] <= law.inset[1]);
    assert.ok(law.lod[0] < law.lod[1] && law.far > 0 && law.steep > 0 && law.steep < 90);
    assert.equal(landLodOf(kind, law.lod[0] - 1), 0); assert.equal(landLodOf(kind, law.lod[0] + 1), 1); assert.equal(landLodOf(kind, law.lod[1] + 1), 2);
  }
  assert.equal(128 % VINE_BLOCK, 0); assert.equal(128 % PATCH_BLOCK, 0);
  // every record the lookup lays: a land ring a foot, a record with water the reeds' edge alone
  const all = [...new Set(Array.from(createLookupTable(), (v) => v & 0x3f))].sort((a, b) => a - b);
  assert.deepEqual([...LAND_FOOT_RECORDS, ...WATER_RECORDS].sort((a, b) => a - b), all);
  assert.equal(landMeasures('hist', 0).sink, HIST_ROOTS, 'the Hist sought its lowest ground round its roots');
  assert.equal(landMeasures('spire', 2), landMeasures('spire', 2), 'made once');
});

/** A flat pixel of land (grass), no road, no place: `tiles` x `tiles`, the dice a hash. */
function field(over = {}) {
  const tiles = 128, tileM = 6.4;
  const draw = (wx, wz, s) => { let h = Math.imul(wx | 0, 0x9e3779b1) ^ Math.imul(wz | 0, 0x85ebca77) ^ Math.imul(s | 0, 0xc2b2ae3d); h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  return { ox: 1000 * 128, oz: -200 * 128, tiles, tileM, owners: () => null, wood: () => 0.5, tile: () => 2, clear: () => false, steep: () => 2, beach: () => false, ground: () => 10, draw, ...over };
}
const each = (p, fn) => { for (let i = 0; i < p.length; i += LAND_PROP_FLOATS) fn(i); };

test('TESA-LANDS WHERE A LANDMARK STANDS: a site a cell of its kind, in its inset, by its rate and its woods or plains; never on a road, water, a steep face or under the beach (the reeds alone at the water\'s edge); at the lowest ground under its foot, sunk; the larger first and the smaller off them; the vines two rows a tile along x, a vineyard a block whole; a patch\'s blocks; the same every run (mutants: the inset off; the rate ignored; a road stood on; floating; the reeds on open water; the vines\' rows apart)', () => {
  const props = (list, over = {}) => landSites(field({ owners: () => list, ...over }));
  // the spires: a cell of 8 tiles, every site at `any` with a rate of one
  const spires = props([{ kind: 'spire', looks: ['basalt'], rate: 1, where: 'any' }]);
  const n = spires.length / LAND_PROP_FLOATS;
  assert.ok(n > 200 && n <= 256, `${n} of 256 cells`);
  each(spires, (i) => {
    const law = LAND_KIND_LAW.spire, cx = (spires[i] / 6.4) % law.cell / law.cell, cz = (spires[i + 2] / 6.4) % law.cell / law.cell;
    assert.ok(cx >= law.inset[0] - 1e-6 && cx <= law.inset[1] + 1e-6 && cz >= law.inset[0] - 1e-6 && cz <= law.inset[1] + 1e-6, 'in its inset');
    assert.equal(spires[i + 5], ki('spire')); assert.equal(spires[i + 7], li('basalt'));
    assert.ok(LAND_LOOKS.basalt.variants.includes(spires[i + 6]));
    assert.ok(Math.abs(spires[i + 1] - (10 - law.sink * spires[i + 4])) < 1e-4, 'at the ground, sunk by its scale');
  });
  assert.deepEqual(Array.from(props([{ kind: 'spire', looks: ['basalt'], rate: 1, where: 'any' }])), Array.from(spires), 'the same every run');
  // the rate, and the woods and the plains
  const half = props([{ kind: 'spire', looks: ['basalt'], rate: 0.5, where: 'any' }]).length / LAND_PROP_FLOATS;
  assert.ok(half > n * 0.35 && half < n * 0.65, `the rate (${half})`);
  const quarter = props([{ kind: 'spire', looks: ['basalt'], rate: 0.5, where: 'woods' }], { wood: () => 0.5 }).length / LAND_PROP_FLOATS;
  assert.ok(quarter > n * 0.15 && quarter < n * 0.35, `the rate times the woods' share (${quarter})`);
  assert.equal(props([{ kind: 'spire', looks: ['basalt'], rate: 1, where: 'woods' }], { wood: () => 0 }).length, 0, 'no woods, none in them');
  assert.equal(props([{ kind: 'spire', looks: ['basalt'], rate: 1, where: 'plains' }], { wood: () => 1 }).length, 0, 'all woods, none on the plains');
  // never on a road, water, a steep face or under the beach
  assert.equal(props([{ kind: 'spire', looks: ['basalt'], rate: 1, where: 'any' }], { clear: () => true }).length, 0, 'a road or a place');
  assert.equal(props([{ kind: 'spire', looks: ['basalt'], rate: 1, where: 'any' }], { tile: () => 0 }).length, 0, 'water');
  assert.equal(props([{ kind: 'spire', looks: ['basalt'], rate: 1, where: 'any' }], { steep: () => 60 }).length, 0, 'a face past its steepest');
  assert.equal(props([{ kind: 'spire', looks: ['basalt'], rate: 1, where: 'any' }], { beach: () => true }).length, 0, 'under the beach');
  // the lowest ground under its foot: a slope rising east, the foot's west side under its middle
  const slope = props([{ kind: 'spire', looks: ['basalt'], rate: 1, where: 'any' }], { ground: (x) => x * 0.1 });
  each(slope, (i) => {
    const sinkR = landMeasures('spire', slope[i + 6]).sink * slope[i + 4];
    assert.ok(slope[i + 1] <= (slope[i] - sinkR) * 0.1 - LAND_KIND_LAW.spire.sink * slope[i + 4] + 1e-3, 'never floating over the downhill side');
  });
  // the reeds: the water's edge (a tile touching water), never open water
  const lake = (ti) => { const x = ti % 128; return x < 64 ? 0 : x === 64 ? 5 : 2; };
  const reeds = props([{ kind: 'reeds', looks: ['reed'], rate: 1, where: 'wet' }], { tile: lake });
  assert.ok(reeds.length > 0);
  each(reeds, (i) => { const tx = Math.floor(reeds[i] / 6.4); assert.ok(tx >= 64 && tx <= 65, `at the edge (${tx})`); });
  // the vines: a block of 8 x 8 tiles whole, two rows a tile, along x, at scale 1
  const vines = props([{ kind: 'vines', looks: ['vine'], rate: 1, where: 'plains' }], { wood: () => 0 });
  assert.equal(vines.length / LAND_PROP_FLOATS, 128 * 128 * 2, 'every tile, two rows');
  each(vines, (i) => {
    assert.equal(vines[i + 3], 0); assert.equal(vines[i + 4], 1);
    assert.ok(Math.abs((vines[i] / 6.4) % 1 - 0.5) < 1e-4, 'the row\'s middle the tile\'s');
    const f = (vines[i + 2] / 6.4) % 1;
    assert.ok(Math.abs(f - 0.25) < 1e-4 || Math.abs(f - 0.75) < 1e-4, 'its rows a quarter in');
  });
  // the second audit (lane D): a row its whole length - at the lowest of its middle and its ends, never past the vines'
  // slope, and off a grove's foot anywhere along it
  assert.equal(LAND_KIND_LAW.vines.steep, 6);
  assert.equal(props([{ kind: 'vines', looks: ['vine'], rate: 1, where: 'plains' }], { wood: () => 0, steep: () => 8 }).length, 0, 'past the vines\' slope');
  const tilted = props([{ kind: 'vines', looks: ['vine'], rate: 1, where: 'plains' }], { wood: () => 0, steep: () => 5, ground: (x) => -x * 0.08 });
  assert.ok(tilted.length > 0);
  each(tilted, (i) => assert.ok(Math.abs(tilted[i + 1] - (-(tilted[i] + VINE_SPAN / 2) * 0.08 - LAND_KIND_LAW.vines.sink)) < 1e-3, 'its downhill end\'s ground, never floating'));
  const orchard = (ti) => { const x = ti % 128, z = Math.floor(ti / 128); return x >= 60 && x < 68 && z >= 60 && z < 68 && (x + z) % 3 === 0; };
  const rowsAndTrees = landSites(field({ owners: (ti) => (orchard(ti) ? [{ kind: 'grove', looks: ['maple'], rate: 1, where: 'any' }] : [{ kind: 'vines', looks: ['vine'], rate: 1, where: 'plains' }]), wood: () => 0 }));
  const orchardGroves = [], rows = [];
  each(rowsAndTrees, (i) => (rowsAndTrees[i + 5] === ki('grove') ? orchardGroves : rows).push(i));
  assert.ok(orchardGroves.length > 2 && rows.length > 1000, `the groves among the vines (${orchardGroves.length})`);
  let near = 0;
  for (const g of orchardGroves) {
    const gr = landMeasures('grove', rowsAndTrees[g + 6]).foot * rowsAndTrees[g + 4];
    for (const i of rows) {
      // the nearest point of the row's length to the grove's foot
      const dx = Math.max(0, Math.abs(rowsAndTrees[i] - rowsAndTrees[g]) - VINE_SPAN / 2), dz = rowsAndTrees[i + 2] - rowsAndTrees[g + 2];
      if (Math.hypot(dx, dz) < 6) near++;
      assert.ok(Math.hypot(dx, dz) >= gr - 1e-3, 'no row through a grove\'s foot');
    }
  }
  assert.ok(near > 0, 'rows stand by the groves');
  const someVines = props([{ kind: 'vines', looks: ['vine'], rate: 0.3, where: 'plains' }], { wood: () => 0 });
  const blocks = new Map();
  each(someVines, (i) => { const k = `${Math.floor(someVines[i] / 6.4 / VINE_BLOCK)},${Math.floor(someVines[i + 2] / 6.4 / VINE_BLOCK)}`; blocks.set(k, (blocks.get(k) ?? 0) + 1); });
  assert.ok(blocks.size > 20 && blocks.size < 256 * 0.5, `${blocks.size} vineyards`);
  assert.ok([...blocks.values()].every((c) => c === VINE_BLOCK * VINE_BLOCK * 2), 'each vineyard whole');
  // a patch: its sites gathered in blocks
  const stands = props([{ kind: 'grove', looks: ['aspen'], rate: 1, where: 'any', patch: 0.3 }]);
  const pb = new Set();
  each(stands, (i) => pb.add(`${Math.floor(stands[i] / 6.4 / PATCH_BLOCK)},${Math.floor(stands[i + 2] / 6.4 / PATCH_BLOCK)}`));
  assert.ok(pb.size > 3 && pb.size < 64 * 0.55, `${pb.size} stands of 64 blocks`);
  // the larger first, the smaller off them: no grove's foot inside a Hist's roots
  const mixed = props([{ kind: 'hist', looks: ['hist'], rate: 1, where: 'any' }, { kind: 'grove', looks: ['maple'], rate: 1, where: 'any' }]);
  const hists = [], groves = [];
  each(mixed, (i) => (mixed[i + 5] === ki('hist') ? hists : groves).push(i));
  assert.ok(hists.length && groves.length);
  for (const g of groves) for (const h of hists) {
    const d = Math.hypot(mixed[g] - mixed[h], mixed[g + 2] - mixed[h + 2]);
    assert.ok(d >= landMeasures('hist', mixed[h + 6]).foot * mixed[h + 4] + landMeasures('grove', mixed[g + 6]).foot * mixed[g + 4] - 1e-3, 'off the Hist\'s roots');
  }
  // the larger stand as they would alone: a parasol (first in LAND_KINDS) never takes a Hist's site
  const histsAlone = props([{ kind: 'hist', looks: ['hist'], rate: 1, where: 'any' }]);
  const withParasols = props([{ kind: 'parasol', looks: ['ascadian'], rate: 1, where: 'any' }, { kind: 'hist', looks: ['hist'], rate: 1, where: 'any' }]);
  const histsOf = (q) => { const o = []; each(q, (i) => { if (q[i + 5] === ki('hist')) o.push(q[i], q[i + 2]); }); return o; };
  assert.deepEqual(histsOf(withParasols), histsOf(histsAlone), 'the Hists first, the parasols off them');
  // its owner's: a tile whose owner has none stands none
  assert.equal(landSites(field({ owners: () => null })).length, 0);
});

test('TESA-LANDS THE FLATS OFF THE FEET AND THE BODIES: the flats within a bodied landmark\'s foot and FLAT_CLEAR, or in a vineyard\'s tile, taken out in place; a body a stalk, a column or a trunk, none for the reeds or the vines; a pixel\'s landmarks stood whole by the keep (mutants: the clearance; the reeds bodied; the keep ignored)', () => {
  const props = Float32Array.from([100, 0, 100, 0, 1, ki('spire'), 0, li('basalt'), 300, 0, 300.5, 0, 1, ki('vines'), 0, li('vine'), 500, 0, 500, 0, 1, ki('reeds'), 0, li('reed')]);
  const foot = landMeasures('spire', 0).foot + FLAT_CLEAR;
  const flats = [{ x: 100 + foot - 0.1, z: 100 }, { x: 100 + foot + 0.1, z: 100 }, { x: 300, z: 299 }, { x: 300, z: 310 }, { x: 500, z: 500 }];
  const same = flatsOffProps(flats, props, 6.4);
  assert.equal(same, flats, 'in place');
  assert.deepEqual(flats.map((f) => [f.x, f.z]), [[100 + foot + 0.1, 100], [300, 310], [500, 500]], 'the foot\'s and the vineyard\'s taken, the reeds\' kept');
  assert.equal(landPropBodies(props, 0).length, 1);
  const b = landPropBodies(props, 0)[0];
  assert.deepEqual(b.c, [100, 0, 100]); assert.ok(b.body && b.r > 1 && b.h > 5);
  assert.equal(landPropBodies(props, 8).length, 0, 'the vines none'); assert.equal(landPropBodies(props, 16).length, 0, 'the reeds none');
  assert.equal(standLandProps(1, 2, new Float32Array(0)), null);
  const st = standLandProps(1, 2, props, (x) => x !== 300);
  assert.equal(st.set.props.length, 2 * LAND_PROP_FLOATS, 'the keep refused one whole');
  assert.deepEqual([st.set.px, st.set.py], [1, 2]);
  assert.equal(st.bodies.length, 1);
});

test('TESA-LANDS THE ROCK IS THE BODY (the second audit, lane D): a landmark\'s foot is its mesh\'s widest to LAND_CHEST and a body each solid part - a crag\'s three lumps, a grove of three\'s three stalks, the xylaria\'s cluster - turned by the yaw the draw turns its mesh by, so every rock and stalk face a man\'s height up stands inside a body; the Hist\'s trunk its trunk\'s, its roots the foot\'s; the lowest ground sought as it was (mutants: one body a landmark; the parts unturned; the foot the stalk\'s; the Hist\'s trunk the stalk\'s)', () => {
  assert.equal(LAND_CHEST, 2);
  const crag = landMeasures('spire', 2), grove3 = landMeasures('parasol', 1);
  assert.equal(crag.parts.length, 3); assert.ok(crag.foot > 8.5 && crag.foot > crag.stalk * 1.5, `the crag's foot its lumps' (${crag.foot})`);
  assert.equal(grove3.parts.length, 3); assert.ok(grove3.foot > 3, `a grove of three's its outer stalks' (${grove3.foot})`);
  assert.equal(crag.sink, Math.max(0.5, crag.stalk), 'its lowest ground sought round its middle, as it was');
  for (let v = 0; v < 3; v++) { const h = landMeasures('hist', v); assert.equal(h.parts.length, 1); assert.ok(h.parts[0].r > 3.5 && h.parts[0].r < 4.6, `the Hist's trunk (${h.parts[0].r})`); assert.ok(h.foot > 8.5, 'its roots its foot'); }
  assert.deepEqual(landMeasures('reeds', 0).parts, []); assert.deepEqual(landMeasures('vines', 0).parts, []);
  // turned and stood as the draw stands them: every body or crown vertex to LAND_CHEST inside a body
  for (const [kind, variants] of [['spire', [0, 1, 2, 3, 4]], ['parasol', [0, 1, 2, 3]]]) {
    for (const v of variants) {
      for (const [yaw, scale] of [[0, 1], [1.1, 1.3], [4, 0.8]]) {
        const props = Float32Array.from([40, 7, 60, yaw, scale, ki(kind), v, 0]), bodies = landPropBodies(props, 0);
        assert.equal(bodies.length, landMeasures(kind, v).parts.length);
        const mesh = landPropMesh(kind, v, 0), c = Math.cos(yaw), sn = Math.sin(yaw), P = mesh.positions;
        const [b0, bn] = [mesh.subs[0][0], mesh.subs[1][0] + mesh.subs[1][1]];
        let outside = 0;
        for (let k = b0; k < bn; k++) {
          const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
          if (y > LAND_CHEST) continue;
          const wx = 40 + (c * x + sn * z) * scale, wz = 60 + (-sn * x + c * z) * scale;
          if (!bodies.some((b) => Math.hypot(wx - b.c[0], wz - b.c[2]) <= b.r + 1e-4)) outside++;
        }
        assert.equal(outside, 0, `${kind} ${v} at yaw ${yaw}: its rock within its bodies`);
        for (const b of bodies) assert.ok(b.c[1] === 7 && b.h > 0 && b.body);
      }
    }
  }
});

test('TESA-LANDS THE LANDMARKS ON THE GROUND THEIR PIXEL DRAWS (the merge with FLORA-GROUND): stood on the walk floor by the kernel, as every plant is, and drawn on the ground their pixel draws - the seat gives the set each root\'s lift at its ring and over its bed, made ahead for the far ring, none on the near ring\'s walk floor; their place, their bodies and their feet the walk floor\'s (mutants: the set unseated; the kernel on the bilinear)', () => {
  const hm = new Float32Array(HD * HD), beach = SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT;
  for (let a = 0; a < HD; a++) for (let b = 0; b < HD; b++) hm[a * HD + b] = beach * 1.6 + 0.003 * Math.sin(a / 2.3) * Math.sin(b / 2.9);
  const roots = [[120.4, 300.2], [500.9, 77.7], [700.1, 650.3], [333.3, 444.4]];
  const props = Float32Array.from(roots.flatMap(([x, z]) => [x, walkGroundAt(hm, x, z) - 0.6, z, 0, 1, ki('spire'), 0, li('basalt')]));
  const p = { samples: hm, _stride: 4, _bed: null, forest: { groups: new Map() }, landProps: { px: 1, py: 2, props } };
  seatFlora(p, { moveBillboardBatch: () => true });
  assert.ok(p.landProps.lift, 'the far ring lifts the set');
  roots.forEach(([x, z], k) => assert.ok(Math.abs(p.landProps.lift[k] - (drawnGroundAt(hm, x, z, 4, null) - walkGroundAt(hm, x, z))) < 1e-4, `landmark ${k} on the far ring's ground`));
  assert.ok(roots.some(([x, z]) => Math.abs(drawnGroundAt(hm, x, z, 4, null) - walkGroundAt(hm, x, z)) > 0.25), 'the field parts the two grounds');
  p._stride = 1;
  seatFlora(p, { moveBillboardBatch: () => true });
  assert.equal(p.landProps.lift, null, 'near: the walk floor');
  // a set built near makes its far ring's ahead, and the crossing takes them
  const q = { samples: hm, _stride: 1, _bed: null, forest: { groups: new Map() }, landProps: { px: 1, py: 2, props: props.slice() } };
  seatFlora(q, { moveBillboardBatch: () => true });
  warmFlora(q, 4);
  const ahead = q.landProps._ringLift?.lift;
  assert.ok(ahead instanceof Float32Array && q.landProps.lift === null, 'the far ring\'s made ahead, nothing moved by it');
  q._stride = 4;
  seatFlora(q, { moveBillboardBatch: () => true });
  assert.equal(q.landProps.lift, ahead, 'the crossing takes them');
  // the kernel stands them, and the zones' flats, on the walk floor - FLORA-GROUND's one law
  const tn = read('src/world/terrain/terrainNature.js');
  assert.match(tn, /ground: \(mx, mz\) => walkGroundAt\(heightmapData, Math\.min\(TERRAIN_SIZE/);
  assert.match(tn, /return \{ record: pool\.records\[i\], x: mx, y: walkGroundAt\(heightmapData, mx, mz\) - slope \/ SLOPE_SINK_RATIO, z: mz, wood, archive: pool\.archives\[i\] \};/);
  assert.match(read('src/scenes/landPropsHost.js'), /y = pr\[i \+ 1\] \+ t\[1\] \+ \(lift \? lift\[i \/ LAND_PROP_FLOATS\] : 0\)/);
});

/** A renderer that records what it is asked - the GPU's calls through a GL that answers anything (graht1's). */
function fakeRenderer(over = {}) {
  const calls = [];
  const gl = new Proxy({}, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? k : (...a) => { calls.push([k, ...a]); return {}; }) });
  return {
    gl, calls, slots: [], made: [], freed: [], cast: [], _casting: true, _fogMode: 0, _fogRange: [0, 0],
    setLowPolyTrees(f, s) { this.slots[s] = f; },
    createAtlasTexture(w, h, n) { const t = { w, h, n }; this.made.push(t); return t; }, uploadAtlasRows() {},
    releaseAtlasTexture(t) { this.freed.push(t); },
    createMesh(m) { const mesh = { vao: {}, model: m }; this.made.push(mesh); return mesh; }, destroyMesh(m) { this.freed.push(m); },
    recordShadowMesh(mesh, M) { this.cast.push([mesh, Float32Array.from(M)]); },
    ...over,
  };
}

test('TESA-LANDS THE HOST: nothing made until a landmark is framed, then made on the slice clock (a mesh a breath, a picture a breath); a run a look\'s variant and LOD, its submeshes\' pictures and colours; the frame buckets every visible landmark on the fourth slot, culled by the view, the fog and its kind\'s farthest, a set past them all passed whole; the nearest bodied cast; destroy gives it all back (mutants: the slot; the kind\'s farthest; the set\'s box; a reed cast)', async () => {
  const r = fakeRenderer();
  let breaths = 0;
  const host = createLandPropsHost({ renderer: r, breathe: async () => { breaths++; } });
  assert.equal(LAND_PROPS_SLOT, 3);
  assert.equal(r.made.length, 0, 'nothing made at its making');
  const raw = Float32Array.from([
    100, 0, 100, 0, 1, ki('parasol'), 0, li('ascadian'),
    300, 0, 100, 1, 1.2, ki('spire'), 2, li('basalt'),
    120, 0, 120, 0, 1, ki('reeds'), 0, li('reed'),
    150, 0, 160, 0, 1, ki('vines'), 1, li('vine'),
    2400, 0, 100, 0, 1, ki('grove'), 2, li('maple'),   // past a grove's farthest
  ]);
  const st = standLandProps(0, 0, raw);
  const p = { landProps: st.set, _t: [0, 0, 0] };
  host.frame([p], [100, 2, 60], null);
  assert.ok(!r.slots[LAND_PROPS_SLOT], 'framed before it is made: nothing yet');
  await host.prepare();
  const meshes = LAND_KINDS.reduce((a, k) => a + LAND_VARIANTS[k] * LAND_LODS, 0);
  assert.equal(breaths, meshes + 1 + Object.keys(LAND_ART).length, 'a mesh a breath, the pack, a picture a breath');
  assert.equal(r.made.filter((m) => m.w).length, Object.keys(LAND_ART).length, 'every picture, its chain');
  const bodied = LAND_KINDS.filter((k) => LAND_KIND_LAW[k].body).reduce((a, k) => a + LAND_VARIANTS[k], 0);
  assert.equal(r.made.filter((m) => m.model).length, bodied, 'a caster a bodied kind\'s variant');
  const runs = LAND_LOOK_NAMES.reduce((a, n) => a + new Set(LAND_LOOKS[n].variants).size * LAND_LODS, 0);
  assert.equal(host._runs.length, runs, 'a run a look\'s variant and LOD');
  host.frame([p], [100, 2, 60], null);
  const f = r.slots[LAND_PROPS_SLOT];
  assert.ok(f && f.gpu === host._gpu && f.radius > 1e8 && f.sunLift === LAND_DRAW.sunLift, 'the fourth slot, every landmark whole');
  assert.deepEqual(host.stats.lod, [1, 3, 0], 'the parasol 40 m off at LOD 0; the spire (170 m over its scale), the reeds (63 m) and the vines (112 m) past their LOD 0s');
  assert.equal(host.stats.drawn, 4, 'the grove past its farthest');
  // a run's submeshes: the reeds' cards cut and two-sided, the parasol's solid and culled, each its look's colour
  const MAXV = Math.max(...Object.values(LAND_VARIANTS)), bucket = (look, v, lod) => (li(look) * MAXV + v) * LAND_LODS + lod;
  const reedRun = f.runs.find((x) => x.bucket === bucket('reed', 0, 1));
  assert.ok(reedRun && reedRun.subs.every((s) => s.alpha === 1 && s.cull === 0) && reedRun.sway === LAND_KIND_LAW.reeds.sway);
  const parasolRun = f.runs.find((x) => x.bucket === bucket('ascadian', 0, 0));
  assert.ok(parasolRun.subs.every((s) => s.alpha === 0 && s.cull === 2), 'the parasol solid, its gills too');
  assert.ok(parasolRun.subs[1].color[0] > parasolRun.subs[1].color[2] * 1.5, 'its cap the look\'s olive-brown');
  // the instances as uploaded: [x, y, z, yaw, scale] at the pixel's translation
  const up = r.calls.filter((c) => c[0] === 'bufferSubData').at(-1)[3];
  assert.deepEqual(Array.from(up.subarray(parasolRun.drawStart * 5, parasolRun.drawStart * 5 + 5)), [100, 0, 100, 0, 1]);
  // the casters: the bodied alone (no reed, no vine), nearest first
  assert.equal(r.cast.length, 2, 'the parasol and the spire cast');
  assert.ok(r.cast[0][1][12] === 100, 'the nearest first');
  // FLORA-GROUND (the merge): drawn on the ground its pixel draws - the seat's lift, its caster with it (scenes/floraSeat.js)
  p.landProps.lift = new Float32Array(p.landProps.props.length / LAND_PROP_FLOATS).fill(2.5);
  r.cast.length = 0;
  host.frame([p], [100, 2, 60], null);
  assert.equal(r.calls.filter((c) => c[0] === 'bufferSubData').at(-1)[3][parasolRun.drawStart * 5 + 1], 2.5, 'its y its ring\'s ground');
  assert.equal(r.cast[0][1][13], 2.5, 'its caster with it');
  p.landProps.lift = null;
  // culled: the view, the fog; a set past its farthest passed whole
  r.cast.length = 0;
  host.frame([p], [100, 2, 60], new Float32Array([0, 0, 1, -5000, 0, 0, 1, 1e6, 0, 0, 1, 1e6, 0, 0, 1, 1e6, 0, 0, 1, 1e6, 0, 0, 1, 1e6]));
  assert.equal(host.stats.drawn, 0, 'the view culls');
  assert.equal(r.slots[LAND_PROPS_SLOT], null);
  r._fogMode = 1; r._fogRange = [0, 150];
  host.frame([p], [100, 2, 60], null);
  assert.equal(host.stats.drawn, 3, 'the fog\'s reach culls the spire');
  r._fogMode = 0;
  host.frame([{ landProps: standLandProps(0, 0, raw.slice(24, 32)).set, _t: [0, 0, 0] }], [100, 2, 60], null);
  assert.equal(host.stats.skipped, 0, 'a vineyard within its farthest framed');
  // a kind's farthest, a landmark at a time: a run whose box a near grove holds, its second grove 1.5 km off culled alone
  const groves = Float32Array.from([200, 0, 100, 0, 1, ki('grove'), 2, li('maple'), 1600, 0, 100, 0, 1, ki('grove'), 2, li('maple')]);
  host.frame([{ landProps: standLandProps(0, 0, groves).set, _t: [0, 0, 0] }], [100, 2, 60], null);
  assert.equal(host.stats.skipped, 0, 'the groves\' run framed');
  assert.equal(host.stats.drawn, 1, 'the grove past its kind\'s farthest culled, its neighbour drawn');
  host.frame([{ landProps: standLandProps(0, 0, raw.slice(16, 24)).set, _t: [5000, 0, 0] }], [100, 2, 60], null);
  assert.equal(host.stats.skipped, 1, 'a set of reeds 5 km off passed whole');
  assert.equal(host.stats.props, 0, 'and no scratch sized for it (the second audit, lane D: every built pixel\'s every landmark had sized it)');
  host.frame([], [0, 0, 0], null);
  assert.equal(r.slots[LAND_PROPS_SLOT], null);
  host.destroy();
  assert.equal(r.freed.length, Object.keys(LAND_ART).length + bodied, 'the pictures and the casters given back');
  assert.equal(host._gpu, null);
  // torn down while it is made: nothing made after
  const r2 = fakeRenderer(), h2 = createLandPropsHost({ renderer: r2 });
  h2.prepare();
  h2.destroy();
  await new Promise((go) => setTimeout(go, 0));
  assert.equal(r2.made.length, 0, 'a host torn down while its GPU was made makes none');
  assert.equal(landMeshIndex(0, 0, 0), 0);
  assert.equal(landMeshIndex(1, 0, 0), LAND_VARIANTS.parasol * LAND_LODS);
});

test('TESA-LANDS THE WIRING: the kernel lays the landmarks past the Bay and keeps the flats off them and hands them out (the worker transfers them); the pixel\'s build stands them off the gate and the rocks and files their bodies, the pixel carries them; the trees\' host makes their host with the row and frames it before its return (THE FOUR HOSTS: world.js wires the trees\' host and the pixel\'s build as before - no line of its own; exterior.js, worldModes.js and dungeonContext.js stand no wilderness past the Bay - FLAGGED in scenes/landPropsHost.js) (mutants: the landmarks unlaid; the flats on their feet; the bodies unfiled; the host unframed)', () => {
  const tg = read('src/world/terrain/terrainGen.js');
  assert.match(tg, /const landProps = natureOpts\.lands \? layoutLandProps\(samples, tilemap, natureOpts\) : new Float32Array\(0\);/);
  assert.doesNotMatch(tg, /flatsOffProps|landFeetOff/, 'the kernel clears no flat: the build keeps them off the landmarks it stands');
  assert.match(tg, /\n\s+landProps,   \/\/ TESA-LANDS/);
  assert.match(read('src/world/terrain/terrainGenWorker.js'), /if \(out\.landProps\?\.length\) transfer\.push\(out\.landProps\.buffer\);/);
  const pb = read('src/scenes/pixelBuild.js');
  assert.match(pb, /nature, withRoads, paths, landProps, wodAverages,/);
  // PIN MOVED (LAVA-CLEAR): the landmarks stood off the fire's clearing first (scenes/ghostfenceBuild.js clearedLandProps)
  assert.match(pb, /const landStood = lands \? standLandProps\(px, py, fire \? clearedLandProps\(fire, landProps\) : landProps, \(x, z\) => !pointNearGate\(gateClear, px, py, x, z, WOD_FLAT_GATE_CLEAR_M\) && !insideRocks\(pixelRocks, x, z\)\) : null;\n\s+const offLand = landFeetOff\(landStood\?\.set\.props, TERRAIN_SIZE \/ WORLD_MAP_TILE_DIM\);\n\s+for \(const f of nature\) \{/, 'stood before the flats, which keep off the kept ones\' feet');
  assert.match(pb, /\n\s+if \(offLand\?\.\(f\.x, f\.z\)\) continue;/);
  assert.match(pb, /\n\s+if \(landStood\) coverItems\.push\(\.\.\.landStood\.bodies\);/);
  assert.match(pb, /landProps: landStood\?\.set \?\? null,/);
  const th = read('src/scenes/treesHost.js');
  assert.match(th, /const landProps = landsOn \? createLandPropsHost\(\{ renderer, breathe \}\) : null;/);
  assert.match(th, /landsOn = tamrielLandsOn\(\) \}\)/);
  assert.match(th, /landProps\?\.frame\(pixels, eye, planes\);[^\n]*\n\s+if \(!lowPolyTrees && !jungleDoor\) return;/);
  const tn = read('src/world/terrain/terrainNature.js');
  assert.match(tn, /owners: \(ti\) => nine\[ownerOf\(ti\)\]\?\.props \?\? null,/);
  // THE FOUR HOSTS: the world host names no landmark; the others stand none
  const world = read('src/scenes/world.js');
  assert.doesNotMatch(world, /landProps|createLandPropsHost/);
  for (const host of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(read(host), /landProps|standLandProps|createLandPropsHost/, `${host} stands none`);
  assert.match(read('src/scenes/landPropsHost.js'), /THE FOUR HOSTS/);
  // the probes' read behind the shot gate
  assert.match(read('src/scenes/landPropsHost.js'), /if \(pageHas\('shot'\)\) globalThis\.__landProps = probe;/);
  // every zone's landmarks the table's (LANDS' props, the kernel's owners)
  assert.ok(Object.values(LANDS).some((l) => l.props.length));
});
