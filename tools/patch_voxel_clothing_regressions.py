from pathlib import Path

# 1) Close the neutral rig's shoulder roof WITHOUT changing face count.
p = Path('src/characters/neutralBody.js')
s = p.read_text()
old = """  const TRAP = [
    { y: 1.66, rx: 0.086, rz: 0.058, p: 0.5, cx: 0.00 }, // at the neck
    { y: 1.64, rx: 0.150, rz: 0.070, p: 0.5, cx: 0.00 }, // sloping out
    { y: 1.61, rx: 0.215, rz: 0.082, p: 0.5, cx: 0.00 }, // shoulder shelf
  ];
"""
new = """  const TRAP = [
    // The old y=1.66/r=.086 end ring was an OPEN loft boundary. From an
    // elevated camera it exposed the hollow torso between the neck and both
    // shoulders. Keep the same three rows (and therefore the same face count),
    // but terminate the roof on the neck's y=1.68 ring instead. Duplicate
    // vertices are fine; the two surfaces coincide visually and the skin UV
    // face order stays untouched.
    { y: 1.68, rx: 0.070, rz: 0.072, p: 0.8, cx: 0.00, cz: -0.01 }, // closes into neck column
    { y: 1.64, rx: 0.150, rz: 0.070, p: 0.5, cx: 0.00 }, // sloping out
    { y: 1.61, rx: 0.215, rz: 0.082, p: 0.5, cx: 0.00 }, // shoulder shelf
  ];
"""
assert old in s, 'TRAP block drifted'
s = s.replace(old, new, 1)
old = """  const DELT = [
    { y: 1.64, rx: 0.070, rz: 0.072, p: 0.55 }, // top, tucks under the trap shelf
    { y: 1.60, rx: 0.090, rz: 0.082, p: 0.55 }, // deltoid belly (planar)
"""
new = """  const DELT = [
    // loft() intentionally carries no cap faces. A full-radius top row here
    // therefore rendered as two circular holes when the camera looked down at
    // the shoulders. Pinch the EXISTING end ring nearly shut instead of adding
    // cap faces: same topology / face indices, closed-looking voxel shoulder.
    { y: 1.655, rx: 0.010, rz: 0.012, p: 0.7 }, // near-point shoulder cap
    { y: 1.60, rx: 0.090, rz: 0.082, p: 0.55 }, // deltoid belly (planar)
"""
assert old in s, 'DELT block drifted'
s = s.replace(old, new, 1)
p.write_text(s)

# 2) Classic clothing deltas must own garment geometry only. AO is recomputed
# globally after displacement, so villagerDelta's recolour-only semantics can
# accidentally include nearby SKIN/HEAD faces even though the garment never
# touched them. The skin compositor correctly treats a head colour delta as an
# unsafe wrapped-head override and falls back to vertex colours -- which looked
# like selecting an outfit deleted every texture. Produce a moved-only delta for
# classic body clothing.
p = Path('src/characters/paperdollPayload.js')
s = p.read_text()
old = """  const clothingPacks = CLOTHING_CATALOG.map((item) => {
    if (item.kind === 'drape') {
      return {
        ...item,
        drape: { name: item.drape, fit: measureDrapeFit(faces, item.drape) },
        idx: [], P: [], C: [],
      };
    }
    const cf = buildNeutralBody(
      { ...ramps, cloth: CLOTH_RAMP },
      { face, clothZones: clothingZones(item.index), cloth: CLOTH_RAMP },
    );
    return { ...item, drape: null, ...villagerDelta(faces, cf) };
  });
"""
new = """  // Classic clothing ownership is GEOMETRIC, not a full shaded-body diff.
  // buildNeutralBody recomputes AO after a garment displaces its faces, which
  // can recolour nearby skin (including the head) without moving it. Shipping
  // those AO-only neighbours as clothing deltas makes the texture compositor
  // see a head override and deliberately fall back to vertex colours. That is
  // why some outfit clicks appeared to remove every sprite texture.
  //
  // Every body-fitted clothing zone has positive thickness, so an owned face is
  // exactly a face whose corners moved. Carry its final cloth colour with it;
  // ignore recolour-only AO collateral.
  const clothingSurfaceDelta = (baseFaces, clothedFaces) => {
    const idx = [], P = [], C = [];
    for (let i = 0; i < clothedFaces.length; i++) {
      const a = clothedFaces[i], b = baseFaces[i];
      let moved = false;
      for (let k = 0; k < 12; k++) {
        if (Math.abs(a.p[k] - b.p[k]) > 1e-6) { moved = true; break; }
      }
      if (!moved) continue;
      idx.push(i);
      for (let k = 0; k < 12; k++) P.push(Math.round(a.p[k] * 1000));
      C.push(a.c[0], a.c[1], a.c[2]);
    }
    return { idx, P, C };
  };
  const clothingPacks = CLOTHING_CATALOG.map((item) => {
    if (item.kind === 'drape') {
      return {
        ...item,
        drape: { name: item.drape, fit: measureDrapeFit(faces, item.drape) },
        idx: [], P: [], C: [],
      };
    }
    const cf = buildNeutralBody(
      { ...ramps, cloth: CLOTH_RAMP },
      { face, clothZones: clothingZones(item.index), cloth: CLOTH_RAMP },
    );
    return { ...item, drape: null, ...clothingSurfaceDelta(faces, cf) };
  });
"""
assert old in s, 'classic clothing pack block drifted'
s = s.replace(old, new, 1)
p.write_text(s)

# 3) Consumer-side invariant: even a future producer regression must never let a
# classic body garment write wrapped head colours and force the full-body texture
# fallback. Producer remains the authority; this is a cheap last-line guard.
p = Path('src/tools/paperdollViewer.js')
s = p.read_text()
old = """    for (let k = 0; k < c.idx.length; k++) {
      const f = c.idx[k], pb = k * 12, cb = k * 3;
      const r = c.C[cb] / 255, g = c.C[cb + 1] / 255, b = c.C[cb + 2] / 255;
"""
new = """    for (let k = 0; k < c.idx.length; k++) {
      const f = c.idx[k], pb = k * 12, cb = k * 3;
      // Classic body clothing never owns the wrapped head arc. If stale or
      // malformed payload data ever says otherwise, skip it rather than making
      // skin.js correctly abandon the atlas for a head colour override.
      if ((D.G ? D.G[f] : 0) === 1) continue;
      const r = c.C[cb] / 255, g = c.C[cb + 1] / 255, b = c.C[cb + 2] / 255;
"""
assert old in s, 'classic clothing apply loop drifted'
s = s.replace(old, new, 1)
p.write_text(s)

# 4) Permanent probe (not *.test.js: avoid changing the repository's exact test
# manifest count). It pins both regressions without needing ARENA2.
p = Path('tools/voxelClothingRegressionProbe.mjs')
p.write_text("""import assert from 'node:assert/strict';
import { buildNeutralBody, ARM_X } from '../src/characters/neutralBody.js';
import { buildPaperdollPayload } from '../src/characters/paperdollPayload.js';

const ramps = {
  skin: [[48,38,30],[96,72,54],[160,120,88],[220,180,140]],
  boot: [[30,24,20],[80,60,44],[130,100,72]],
};
const base = buildNeutralBody(ramps);
assert.equal(base.length, 2136, 'shoulder closure must preserve the 2136-face UV topology');

// The highest arm vertices are the deltoid end rings. They used to have a
// ~0.07 radius open circle; they must now be a near-point cap while preserving
// the same faces.
for (const [group, cx] of [['armL', -ARM_X], ['armR', ARM_X]]) {
  const fs = base.filter((f) => f.g === group);
  const maxY = Math.max(...fs.flatMap((f) => [f.p[1],f.p[4],f.p[7],f.p[10]]));
  const top = [];
  for (const f of fs) for (let i = 0; i < 4; i++) {
    const x = f.p[i*3], y = f.p[i*3+1], z = f.p[i*3+2];
    if (Math.abs(y - maxY) < 1e-7) top.push(Math.hypot(x - cx, z));
  }
  assert.ok(top.length > 0, `${group} must have a top ring`);
  assert.ok(Math.max(...top) < 0.02, `${group} shoulder top must be pinched closed`);
}

const D = buildPaperdollPayload(null, null, null);
assert.equal(D.n, base.length);
for (const c of D.clothing.filter((x) => x.kind === 'body')) {
  assert.ok(c.idx.length > 0, `${c.name} must own at least one body face`);
  for (let k = 0; k < c.idx.length; k++) {
    const f = c.idx[k];
    assert.notEqual(base[f].g, 'head', `${c.name} must never own a head face`);
    let moved = false;
    for (let j = 0; j < 12; j++) {
      if (Math.round(base[f].p[j] * 1000) !== c.P[k*12 + j]) { moved = true; break; }
    }
    assert.ok(moved, `${c.name} face ${f} must be a geometric garment face, not AO-only colour collateral`);
  }
}
console.log('voxel clothing regression probe: PASS');
""")
