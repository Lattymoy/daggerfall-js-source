import assert from 'node:assert/strict';
import {
  canonicalizePaperdollTexture,
  generateDirectionalViews,
} from '../src/tools/paperdoll/clothingTexture.js';

// Synthetic Daggerfall-like paperdoll source:
// - every row shears right as Y increases
// - the centre carries a front-only red detail
// - transparent holes emulate body-reveal cut-outs in the old paperdoll art
const width = 20, height = 12;
const data = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) {
  const shift = Math.floor(y / 3);
  const x0 = 2 + shift, x1 = 15 + shift;
  for (let x = x0; x <= x1 && x < width; x++) {
    const o = (y * width + x) * 4;
    const u = (x - x0) / Math.max(1, x1 - x0);
    if (u > 0.44 && u < 0.56) { data[o] = 230; data[o + 1] = 30; data[o + 2] = 30; }
    else if (u < 0.5) { data[o] = 40; data[o + 1] = 90; data[o + 2] = 190; }
    else { data[o] = 55; data[o + 1] = 145; data[o + 2] = 85; }
    data[o + 3] = 255;
  }
}
// Interior and boundary-connected paperdoll holes. A 3D surface must not inherit either.
for (const [x, y] of [[9,4],[10,4],[9,5],[10,5],[4,0],[5,0],[6,0],[6,1]]) {
  const o = (y * width + x) * 4;
  data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
}

const canonical = canonicalizePaperdollTexture({ width, height, data });
assert.equal(canonical.width, width);
assert.equal(canonical.height, height);
assert.equal(canonical.canonicalMeta.mode, 'paperdoll-surface-v2');
assert.equal(canonical.canonicalMeta.alphaOwner, 'geometry');
assert.ok(canonical.canonicalMeta.repairedPixels > 0, 'paperdoll holes must be repaired');
for (let o = 3; o < canonical.data.length; o += 4) {
  assert.equal(canonical.data[o], 255, 'canonical garment material must be opaque');
}

// Row registration must remove the source's rightward shear without scaling
// each row. The same authored material sample stays aligned top-to-bottom.
const rgb = (img, x, y) => {
  const o = (y * img.width + x) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2]];
};
assert.deepEqual(rgb(canonical, 1, 1), rgb(canonical, 1, 10));
assert.equal(canonical.canonicalMeta.widthPreserved, true);
assert.equal(canonical.canonicalMeta.registration, 'row-centre-translate');
assert.ok(canonical.canonicalMeta.shearPx >= 3, 'synthetic shear must be measured');

// A two-pixel red centre motif must remain roughly two pixels wide after
// registration; V1 row stretching expanded narrow details on narrow rows.
const redCount = (img, y) => {
  let n = 0;
  for (let x = 0; x < img.width; x++) {
    const [r,g,b] = rgb(img, x, y);
    if (r > 180 && g < 70 && b < 70) n++;
  }
  return n;
};
assert.ok(Math.abs(redCount(canonical, 2) - redCount(canonical, 9)) <= 1);

const views = generateDirectionalViews(canonical);
assert.equal(views.length, 8);
for (const view of views) {
  assert.equal(view.width, width);
  assert.equal(view.height, height);
  for (let o = 3; o < view.data.length; o += 4) assert.equal(view.data[o], 255);
}

// The generated back is sourced from side bands, not the centre-front detail.
const frontMid = rgb(views[0], Math.floor(width / 2), 6);
const backMid = rgb(views[4], Math.floor(width / 2), 6);
assert.notDeepEqual(backMid, frontMid, 'front-only detail must not stamp onto the back');

// A shirt whose crop is heavily right-biased around the REAL paperdoll body
// axis. This is the case row-centering alone cannot solve: it removes shear but
// still presents the near side as if it were a frontal texture.
const tw = 24, th = 10, td = new Uint8ClampedArray(tw * th * 4);
for (let y = 0; y < th; y++) {
  for (let x = 6; x <= 20; x++) {
    const o = (y * tw + x) * 4;
    if (y === 6) { td[o] = 220; td[o+1] = 45; td[o+2] = 35; } // belt band
    else {
      const d = Math.abs(x - 8);
      td[o] = 35 + d * 5; td[o+1] = 80 + d * 4; td[o+2] = 170 - d * 3;
    }
    td[o+3] = 255;
  }
}
const torso = canonicalizePaperdollTexture({
  width: tw, height: th, data: td,
  paperdollMeta: { axisX: 8 },
}, 'torso');
assert.equal(torso.canonicalMeta.mode, 'paperdoll-surface-v5');
assert.equal(torso.canonicalMeta.sourceAxis, 'paperdoll-offset');
assert.equal(torso.canonicalMeta.registration, 'paperdoll-axis-adaptive-front-reconstruct');
assert.ok(torso.canonicalMeta.analysisRowCount < th, 'torso orientation must ignore noisy top/bottom rows');
assert.equal(torso.canonicalMeta.frontReconstruction, 'dominant-half-mirror');
assert.equal(torso.canonicalMeta.dominantSide, 'right');
assert.ok(torso.canonicalMeta.sideBias > 1.65);
assert.ok(torso.canonicalMeta.frontRecovery > 0.985, 'strongly oblique torso must fully recover to a frontal surface');
// Equal distances from the reconstructed front centre must now see the same
// material progression instead of one side of the classic paperdoll sprite.
assert.deepEqual(rgb(torso, 3, 3), rgb(torso, tw - 1 - 3, 3));
// Horizontal belt evidence stays on its authored Y row and becomes a frontal
// band rather than a clue that the whole shirt is wrapped around one side.
for (let x = 0; x < tw; x++) {
  const [r,g,b] = rgb(torso, x, 6);
  assert.ok(r > 180 && g < 80 && b < 80, 'belt row must remain a frontal horizontal band');
}

// V5 regression: moderately oblique shirts must no longer remain in the old
// sideways split-perspective state until a hard threshold is crossed.
const mw = 24, mh = 10, md = new Uint8ClampedArray(mw * mh * 4);
for (let y = 0; y < mh; y++) for (let x = 5; x <= 19; x++) {
  const o = (y * mw + x) * 4;
  md[o] = 45 + x * 4; md[o+1] = 70 + x * 2; md[o+2] = 175 - x * 3; md[o+3] = 255;
}
const moderate = canonicalizePaperdollTexture({
  width: mw, height: mh, data: md,
  paperdollMeta: { axisX: 11 },
}, 'torso');
assert.equal(moderate.canonicalMeta.mode, 'paperdoll-surface-v5');
assert.equal(moderate.canonicalMeta.frontReconstruction, 'adaptive-perspective-blend');
assert.ok(moderate.canonicalMeta.frontRecovery > 0 && moderate.canonicalMeta.frontRecovery < 0.985,
  'moderately oblique torso must receive a graded frontal correction');

// Open torso garments deliberately keep more original asymmetry than closed
// shirts at the same paperdoll bias so an actual open-front design is not
// flattened into bilateral cloth too early.
const moderateOpen = canonicalizePaperdollTexture({
  width: mw, height: mh, data: md,
  paperdollMeta: { axisX: 11 },
}, 'open-torso');
assert.ok(moderateOpen.canonicalMeta.frontRecovery < moderate.canonicalMeta.frontRecovery,
  'open torso profile must preserve more authored asymmetry than a closed shirt');

console.log('clothing canonical probe: PASS');
