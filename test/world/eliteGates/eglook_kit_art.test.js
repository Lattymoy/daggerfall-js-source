// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md sections 1
// and 8): THE KIT'S PICTURES AND THE GROUND REPAINTED (world/eliteGates/egBandArt.js) - every band paints the academy in its realm's
// own forms: the kit's thirteen records (shaft, moulding, voussoir, relief, banner, coffer, statue, fixture, found, wreck,
// crystal, inlay, chain) painted for the first time, each worn as its builders are told (EG_KIT_MAP), and the ground's
// eight repainted. The laws, not the pixels: each picture the size its map names and about 32 texels a metre where it
// tiles; light only where it means something (the fixtures' flame, the Cairn's soul-gems and court hairlines, the
// Wellhead's molten seams), each capped; the cutouts' holes where the cloth is torn and the fire licks, never in a sigil or
// a body; the four bands told apart in every picture; the ground the academy's (no Hour brass in the marble; the court
// the quietest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egBandArt, egBandArtOf, egLuma, EG_BAND_RAMPS, EG_KIT_MAP, EG_CUTOUT_RECORDS, EG_MOLTEN_LUMA_MAX, EG_MOLTEN_GLOW, EG_SEAM_LUMA_MAX, EG_DRESS } from '../../../src/world/eliteGates/egBandArt.js';
import { EG_KIT_RECORD, EG_KIT_RECORDS, EG_KIT_STYLE } from '../../../src/world/eliteGates/egKit.js';
import { EG_ATMOS } from '../../../src/world/eliteGates/egAtmos.js';

const K = EG_KIT_RECORD;
const px = (img, x, y) => { const i = (y * img.width + x) * 4; return [img.colors[i], img.colors[i + 1], img.colors[i + 2], img.colors[i + 3]]; };
const keyOf = (c) => `${c[0]},${c[1]},${c[2]}`;
const setOf = (...ramps) => new Set(ramps.flat().map(keyOf));
const rows = (img, y0, y1, fn) => { for (let y = y0; y < y1; y++) for (let x = 0; x < img.width; x++) fn(px(img, x, y), x, y); };
const share = (img, set, y0 = 0, y1 = img.height) => { let n = 0, all = 0; rows(img, y0, y1, (c) => { if (c[3] < 128) return; all++; if (set.has(keyOf(c))) n++; }); return n / Math.max(1, all); };
const spread = (img) => { const L = []; rows(img, 0, img.height, (c) => L.push(egLuma(c))); const m = L.reduce((a, b) => a + b, 0) / L.length; return Math.sqrt(L.reduce((a, b) => a + (b - m) ** 2, 0) / L.length); };

test('EG-LOOK THE KIT\'S PICTURES WORN (Elite-Gates-Look.md section 8, world/eliteGates/egBandArt.js EG_KIT_MAP): every kit record has its map and every band\'s picture of it is the map\'s size; where it tiles it lays 24-40 texels a metre (SD-LOOK\'s ~32) - the found\'s strata, the chain\'s bands and the wreck\'s far stone (4 a metre, for the haze\'s distance) its three named departures; its v runs up or down; its bands lie in [0, 1] in order, none overlapping; the shaft\'s repeats round a column make its band\'s column whole - the Galleries\' 16 flutes, the Shade\'s octagon, the Wellhead\'s hexagon, counted in the picture\'s arrises (mutants: a picture painted off its map\'s size; the hexagon two repeats round; a flute lost)', () => {
  assert.deepEqual(Object.keys(EG_KIT_MAP).map(Number).sort((a, b) => a - b), [...EG_KIT_RECORDS].sort((a, b) => a - b), 'a map a kit record');
  for (const rec of EG_KIT_RECORDS) {
    const m = EG_KIT_MAP[rec];
    assert.ok(m.v === 'up' || m.v === 'down', `record ${rec}: its v's way`);
    if (rec === K.found || rec === K.chain) assert.equal(m.mU, 0, `record ${rec}: laid by its own builder's rule (the Hour's root, the Hour's chain)`);
    else if (rec === K.wreck) assert.equal(m.w / m.mU, 4, 'the wreck: four texels a metre');
    else for (const tpm of [m.w / m.mU, m.h / m.mV]) assert.ok(tpm >= 24 && tpm <= 40, `record ${rec}: ${tpm} texels a metre`);
    if (m.bands) { const b = Object.values(m.bands).sort((p, q) => p[0] - q[0]); for (let i = 0; i < b.length; i++) { assert.ok(b[i][0] >= 0 && b[i][1] <= 1 && b[i][0] < b[i][1], `record ${rec}: a band in [0, 1]`); if (i) assert.ok(b[i][0] >= b[i - 1][1], `record ${rec}: its bands apart`); } }
    for (let band = 0; band < 4; band++) { const { albedo } = egBandArtOf(band, rec)[1]; assert.deepEqual([albedo.width, albedo.height], [m.w, m.h], `band ${band} record ${rec}: its map's size`); }
  }
  // the shaft whole round its column: arrises a repeat x repeats round = the column's sides (world/eliteGates/egKit.js EG_KIT_STYLE)
  const around = EG_KIT_MAP[K.shaft].around, R = EG_BAND_RAMPS;
  const arrises = (band, set) => { const { albedo } = egBandArtOf(band, K.shaft)[1]; let n = 0; for (let x = 0; x < albedo.width; x++) { let hit = 0; for (let y = 0; y < albedo.height; y++) if (set.has(keyOf(px(albedo, x, y)))) hit++; if (hit >= albedo.height * 0.75) n++; } return n; };
  assert.deepEqual(EG_KIT_STYLE.map((s) => s.column), ['fluted', 'bone', 'glass', 'basalt']);
  assert.equal(arrises(0, setOf(R[0].metal, [R[0].stone[4]])) * around[0], 16, 'the Galleries\' fluted shaft: 16 flutes, their fillets gilded');
  assert.equal(arrises(2, setOf([R[2].metal[1]])) * around[2], 8, 'the Shade\'s: an octagon\'s eight facets, their arrises silver');
  assert.equal(arrises(3, setOf([R[3].stone[4]])) * around[3], 6, 'the Wellhead\'s: a hexagon\'s six faces');
  assert.ok(around.every((n) => Number.isInteger(n) && n >= 1), 'whole repeats round');
});

test('EG-LOOK THE LIGHT THE KIT MEANS (SD-LOOK: structure does not glow; Elite-Gates-Look.md section 1): every kit picture dark but the fixture\'s light (its flame half alone - every band\'s lamp a fixture you see), the Cairn\'s soul-gem crystal (its own light) and the Wellhead\'s molten seams (its crystal\'s and its mosaic\'s); each lit texel its own albedo at one share, no more than EG_MOLTEN_GLOW, its brightest at or under its cap - EG_MOLTEN_LUMA_MAX, and EG_SEAM_LUMA_MAX for the mosaic laid in a fight floor - and bright enough to read; the cloth, the stone and the metal never lit (mutants: the fixture\'s body lit; the soul-gem past its cap; a banner glowing; the Wellhead\'s mosaic past the seam\'s cap; the Galleries\' quartz lit)', () => {
  for (let band = 0; band < 4; band++) for (const rec of EG_KIT_RECORDS) {
    const { albedo, emission } = egBandArtOf(band, rec)[1];
    const lit = [];
    rows(emission, 0, emission.height, (e, x, y) => { if (e[0] || e[1] || e[2]) lit.push([x, y, e]); });
    // where light means something: the flame half's light (its colours, never the moon-lamp's silver finial), the soul-gem
    // whole, the Wellhead's molten alone (its crystal's seams, its mosaic's grout in the accent's band)
    const R = EG_BAND_RAMPS[band], flame = setOf(R.flame), soul = setOf(R.accent), molten = setOf(R.liquid);
    const where = rec === K.fixture ? (x, y, a) => y < 32 && flame.has(keyOf(a)) : rec === K.crystal && band === 1 ? (x, y, a) => soul.has(keyOf(a)) : rec === K.crystal && band === 3 ? (x, y, a) => molten.has(keyOf(a)) : rec === K.inlay && band === 3 ? (x, y, a) => y < 64 && molten.has(keyOf(a)) : null;
    if (!where) { assert.equal(lit.length, 0, `band ${band} record ${rec}: dark`); continue; }
    assert.ok(lit.length > 0, `band ${band} record ${rec}: its light`);
    const cap = rec === K.inlay ? EG_SEAM_LUMA_MAX : EG_MOLTEN_LUMA_MAX;
    let top = 0;
    for (const [x, y, e] of lit) {
      const a = px(albedo, x, y);
      assert.ok(where(x, y, a), `band ${band} record ${rec}: lit at (${x}, ${y}), where nothing means light`);
      assert.equal(a[3], 255, 'a hole is dark');
      top = Math.max(top, egLuma(e));
      for (let c = 0; c < 3; c++) assert.ok(e[c] <= Math.round(a[c] * EG_MOLTEN_GLOW) + 1, 'its own colour, at most EG_MOLTEN_GLOW of it');
    }
    assert.ok(top <= cap, `band ${band} record ${rec}: its brightest ${top.toFixed(3)} at or under ${cap}`);
    assert.ok(top > (rec === K.inlay ? 0.18 : 0.25), `band ${band} record ${rec}: bright enough to read (${top.toFixed(3)})`);
  }
  // the fixture's every band: its light in each of its four cells
  for (let band = 0; band < 4; band++) { const { emission } = egBandArtOf(band, K.fixture)[1]; for (let cell = 0; cell < 4; cell++) { let n = 0; rows(emission, 0, 32, (e, x) => { if (x >> 4 === cell && (e[0] || e[1] || e[2])) n++; }); assert.ok(n >= 20, `band ${band}: a light in cell ${cell}`); } }
});

test('EG-LOOK THE CUTOUTS (the renderer\'s RW1 holes - renderer.js uploadTexture { cutout: true }): the banner and the fixture alone carry `cutout`; the banner\'s holes in its torn foot and its lower half alone - its hem, its sigil and its upper half whole, and torn more in the Cairn\'s shroud than anywhere; the fixture\'s about each light in its flame cells and between its grille\'s bars alone - its body whole; the host and the lab ask the renderer for the holes (mutants: a hole in the banner\'s sigil; the fixture\'s body cut; the host\'s upload losing its cutout)', () => {
  assert.deepEqual([...EG_CUTOUT_RECORDS].sort(), [K.banner, K.fixture].sort());
  for (let band = 0; band < 4; band++) {
    const arts = new Map(egBandArt(band));
    for (const [rec, art] of arts) assert.equal(!!art.cutout, EG_CUTOUT_RECORDS.includes(rec), `band ${band} record ${rec}: its cutout flag`);
    const banner = arts.get(K.banner).albedo, fix = arts.get(K.fixture).albedo;
    const holes = (img, y0, y1) => { let n = 0; rows(img, y0, y1, (c) => { if (c[3] === 0) n++; }); return n; };
    assert.equal(holes(banner, 0, 56), 0, `band ${band}: the banner's upper half whole`);
    assert.ok(holes(banner, 96, 128) > 64 * 32 * 0.1, `band ${band}: its foot torn away`);
    for (let y = 14; y < 63; y++) for (let x = 14; x < 50; x++) assert.equal(px(banner, x, y)[3], 255, `band ${band}: its sigil whole`);
    assert.equal(holes(fix, 32, 48), 0, `band ${band}: the fixture's body whole`);
    assert.ok(holes(fix, 0, 32) > 64 * 32 * 0.3 && holes(fix, 48, 64) > 64 * 16 * 0.3, `band ${band}: about its lights and between its bars`);
  }
  const torn = (band) => { const b = egBandArtOf(band, K.banner)[1].albedo; let n = 0; rows(b, 0, 128, (c) => { if (c[3] === 0) n++; }); return n; };
  assert.ok(torn(1) > Math.max(torn(0), torn(2), torn(3)), 'the Cairn\'s shroud the most torn');
  const host = readFileSync(new URL('../../../src/scenes/eliteGates/egCircleHost.js', import.meta.url), 'utf8'), lab = readFileSync(new URL('../../../src/tools/spireLab.js', import.meta.url), 'utf8');
  assert.match(host, /renderer\.uploadTexture\(egBandArchive\(band\), rec, art\.albedo, art\.cutout \? \{ cutout: true \} : undefined\)/, 'the host asks for the holes');
  assert.match(lab, /renderer\.uploadTexture\(egBandArchive\(BAND\), rec, art\.albedo, art\.cutout \? \{ cutout: true \} : \{\}\)/, 'the lab, the host\'s way');
});

test('EG-LOOK THE BANDS TOLD APART IN THE KIT (Elite-Gates-Look.md section 1): no two bands paint a kit picture alike, nor a motif in one form (its light\'s pattern its own); the banner\'s cloth Battlemage blue in the Galleries, the shroud\'s grey in the Cairn, near-black in the Shade, war red in the Wellhead, each with its sigil - the gold star, the soul-gem, the silver crescent, Dagon\'s sign edged in iron; the strata (found and root) from the band\'s own stone at the top to the band\'s own fog at the tips (world/eliteGates/egAtmos.js), each band\'s new ramps five steps dark to light (mutants: two bands sharing a frieze\'s form; the Galleries\' banner red; the haze not the band\'s fog; the strata\'s tips left stone)', () => {
  const arts = [0, 1, 2, 3].map((b) => new Map(egBandArt(b)));
  for (const rec of EG_KIT_RECORDS) for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) assert.notDeepEqual(arts[a].get(rec).albedo.colors, arts[b].get(rec).albedo.colors, `record ${rec}: bands ${a} and ${b} differ`);
  // and in its own FORMS, not one form in four colours: the pictures each band shapes its own way (section 1's columns,
  // cornices, friezes, banners, figures, crystals, flags and walks) share no pattern of light - their texels' luminance
  // correlates under 0.8 between any two bands (the chain's links, the coffers' grid and the mosaics' tesserae are one
  // form in every band, on purpose)
  const luma = (img) => { const o = []; rows(img, 0, img.height, (c) => o.push(c[3] < 128 ? 0 : egLuma(c))); return o; };
  const corr = (p, q) => { const n = p.length, mp = p.reduce((s, v) => s + v, 0) / n, mq = q.reduce((s, v) => s + v, 0) / n; let c = 0, vp = 0, vq = 0; for (let i = 0; i < n; i++) { c += (p[i] - mp) * (q[i] - mq); vp += (p[i] - mp) ** 2; vq += (q[i] - mq) ** 2; } return c / Math.sqrt(vp * vq || 1); };
  for (const rec of [K.shaft, K.moulding, K.relief, K.banner, K.statue, K.crystal, EG_DRESS.floor, EG_DRESS.cobble]) {
    const L = arts.map((m) => luma(m.get(rec).albedo));
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) assert.ok(corr(L[a], L[b]) < 0.8, `record ${rec}: bands ${a} and ${b} in their own forms (${corr(L[a], L[b]).toFixed(2)})`);
  }
  const mean = (img, x0, x1, y0, y1) => { const s = [0, 0, 0]; let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = px(img, x, y); if (c[3] < 128) continue; s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; n++; } return s.map((v) => v / n); };
  const cloth = arts.map((m) => mean(m.get(K.banner).albedo, 18, 46, 70, 86));
  assert.ok(cloth[0][2] > cloth[0][0] * 1.6, `the Galleries' Battlemage blue (${cloth[0].map(Math.round)})`);
  assert.ok(Math.abs(cloth[1][0] - cloth[1][2]) < 20 && egLuma(cloth[1]) > 0.2, `the Cairn's grey shroud (${cloth[1].map(Math.round)})`);
  assert.ok(egLuma(cloth[2]) < 0.15, `the Shade's black (${cloth[2].map(Math.round)})`);
  assert.ok(cloth[3][0] > cloth[3][1] * 2.5, `the Wellhead's war red (${cloth[3].map(Math.round)})`);
  const sigilIn = (band, ramp) => { const img = arts[band].get(K.banner).albedo, S = setOf(ramp); let n = 0; rows(img, 14, 66, (c, x) => { if (x > 12 && x < 52 && S.has(keyOf(c))) n++; }); return n; };
  assert.ok(sigilIn(0, EG_BAND_RAMPS[0].metal) > 150, 'the gold star');
  assert.ok(sigilIn(1, EG_BAND_RAMPS[1].accent) > 80, 'the soul-gem');
  assert.ok(sigilIn(2, EG_BAND_RAMPS[2].metal) > 100, 'the silver crescent');
  assert.ok(sigilIn(3, EG_BAND_RAMPS[3].metal) > 60, 'Dagon\'s sign edged in iron');
  for (let band = 0; band < 4; band++) {
    const R = EG_BAND_RAMPS[band];
    for (const key of ['cloth', 'deep', 'fix', 'flame', 'tile', 'haze']) { assert.ok(R[key]?.length >= 5, `band ${band} ${key}: five steps`); for (let i = 1; i < R[key].length; i++) assert.ok(egLuma(R[key][i]) >= egLuma(R[key][i - 1]), `band ${band} ${key}: dark to light`); }
    assert.deepEqual([...R.haze[2]], EG_ATMOS[band].fog.color.map((c) => Math.round(c * 255)), `band ${band}: its haze its own fog`);
    for (const rec of [K.found, EG_DRESS.root]) {
      const img = arts[band].get(rec).albedo;
      assert.ok(share(img, setOf(R.stone), 0, 1) > 0.9, `band ${band} record ${rec}: its slab the band's stone`);
      assert.ok(share(img, setOf(R.haze), img.height - 6, img.height) > 0.6, `band ${band} record ${rec}: its tips the band's fog`);
    }
  }
});

test('EG-LOOK THE GROUND REPAINTED AS THE ACADEMY (Elite-Gates-Look.md section 1): the Galleries\' floor white marble veined grey with no gold in it (no Hour brass), the Cairn\'s slate with bone where its joints meet, the Shade\'s black glass split by silver, the Wellhead\'s basalt bound in iron; each court the quietest of its band\'s floors (its light\'s spread under the flags\'); the Galleries\' walks small blue-grey tesserae; each wall\'s string course the band\'s metal (mutants: gold back in the Galleries\' floor; the court louder than its floor; the walks\' tesserae lost to the marble; the string course left stone)', () => {
  const R = EG_BAND_RAMPS, art = [0, 1, 2, 3].map((b) => new Map(egBandArt(b)));
  const floor = (b) => art[b].get(EG_DRESS.floor).albedo;
  assert.equal(share(floor(0), setOf(R[0].metal)), 0, 'no gold in the marble');
  assert.ok(share(floor(0), setOf([R[0].vein[4]])) > 0.01, 'the marble veined grey');
  assert.ok(share(floor(1), setOf(R[1].metal)) > 0.01, 'bone in the slate');
  assert.ok(share(floor(2), setOf(R[2].accent)) > 0.02, 'the glass split by silver');
  assert.ok(share(floor(3), setOf(R[3].metal)) > 0.05, 'the basalt bound in iron');
  for (let b = 0; b < 4; b++) assert.ok(spread(art[b].get(EG_DRESS.arena).albedo) < spread(floor(b)), `band ${b}: the court the quietest`);
  const walk = art[0].get(EG_DRESS.cobble).albedo;
  assert.ok(share(walk, setOf(R[0].tile)) > 0.5, 'the Galleries\' walks blue-grey tesserae');
  for (let b = 0; b < 4; b++) assert.ok(share(art[b].get(EG_DRESS.pillar).albedo, setOf(R[b].metal), 56, 64) > 0.1, `band ${b}: the string course the band's metal`);
});
