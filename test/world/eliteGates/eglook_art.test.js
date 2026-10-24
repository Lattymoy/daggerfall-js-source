// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7 and 25.1, and layer
// three's "the band art is EG-G's"): THE BAND ART (world/eliteGates/egBandArt.js) - each band's own dress painted in code under its own
// pseudo-archive, and THE DRESS laid on the halls (world/eliteGates/egHall.js) and the pieces (scenes/eliteGates/egSpan.js). The art: the page's
// ramps (five steps or more, their ends the page's), every band's eight records, the same pixels every call, every texel in
// the band's palette, structure that does not glow (the metal's rubbed rows alone, at the Hour's share), the liquid lit
// and never past 0.45; the four bands told apart. The dress: every circle of every band built in its band's archive and
// none in the Hour's, the magma in the liquid's record, a Rampart's portcullis dressed, the Steps' own faces left the
// Hour's; the host uploads each band's art under its archive (its text).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egBandArt, egBandPalette, egBandArchive, egBandDress, egLuma, egMoltenGlow, EG_BAND_RAMPS, EG_DRESS, EG_DRESS_RECORDS, EG_MOLTEN_GLOW, EG_MOLTEN_LUMA_MAX, EG_BAND_RECORDS, EG_CUTOUT_RECORDS, EG_SEAM_LUMA_MAX } from '../../../src/world/eliteGates/egBandArt.js';
import { EG_BAND_ARCHIVES } from '../../../src/world/eliteGates/pseudoArchives.js';
import { offPalette } from '../../../src/world/superDungeon/sdPixelKit.js';
import { SD_RAMP } from '../../../src/world/superDungeon/sdLook.js';
import { SD_BRASS_EDGE_GLOW, SD_EDGE_GLOW } from '../../../src/world/superDungeon/sdRealmArt.js';
import { SD_REALM_ARCHIVE, SD_REALM_FLOOR_RECORD, SD_REALM_BRASS_RECORD, SD_REALM_ROOT_RECORD, SD_REALM_ARENA_RECORD, SD_REALM_COBBLE_RECORD, SD_REALM_EDGE_RECORD, SD_REALM_PILLAR_RECORD } from '../../../src/world/superDungeon/sdRealm.js';
import { buildEgCircleModel, egGateParts } from '../../../src/world/eliteGates/egHall.js';
import { egCircleSpecs, egBandOfCircle } from '../../../src/net/eliteGates/egLaw.js';
import { createEgSpan } from '../../../src/scenes/eliteGates/egSpan.js';
import { buildStepModel } from '../../../src/world/superDungeon/sdStepsModel.js';

const texels = (img) => { const out = []; for (let i = 0; i < img.colors.length; i += 4) out.push([img.colors[i], img.colors[i + 1], img.colors[i + 2], img.colors[i + 3]]); return out; };
const mean = (img) => { const t = texels(img); return egLuma([t.reduce((a, c) => a + c[0], 0) / t.length, t.reduce((a, c) => a + c[1], 0) / t.length, t.reduce((a, c) => a + c[2], 0) / t.length]); };

test('EG-G2 THE BANDS\' RAMPS (section 25.1): five steps or more each, dark to light, their ends the page\'s - marble and gold leaf and Battlemage blue in the Galleries, slate violet and soul-light in the Cairn, the dark and moon-silver in the Shade, SD-LOOK\'s basalt and the molten orange in the Wellhead; the records are the Hour\'s own numbers and the liquid\'s new 33 (mutants: a ramp\'s end moved; a record renumbered)', () => {
  const lum = (c) => egLuma(c);
  for (const R of EG_BAND_RAMPS) for (const [k, r] of Object.entries(R)) {
    assert.ok(r.length >= 5, `${k}: five steps`);
    for (let i = 1; i < r.length; i++) assert.ok(lum(r[i]) >= lum(r[i - 1]), `${k}: dark to light`);
  }
  const [G, C, S, W] = EG_BAND_RAMPS;
  assert.deepEqual([G.stone[0], G.stone.at(-1)], [[150, 146, 138], [214, 210, 200]], 'marble');
  assert.deepEqual([G.metal[0], G.metal.at(-1)], [[140, 98, 40], [246, 206, 120]], 'gold leaf - the Hour\'s brass');
  assert.ok(G.metal.some((c) => c.join() === SD_RAMP.brass[3].join()), 'the Hour\'s brass, reused');
  assert.deepEqual([G.accent[0], G.accent.at(-1)], [[36, 52, 96], [92, 124, 196]], 'Battlemage blue');
  // PIN MOVED (EG-LOOK, Elite-Gates.md section 25.1): the three dark bands' stone a step lighter - lit by their realms they read
  // as dark stone and glass, never as the void (34,28,44-120,108,140; 6,6,10-60,64,80; SD-LOOK's basalt before)
  assert.deepEqual([C.stone[0], C.stone.at(-1)], [[44, 37, 56], [134, 121, 158]], 'slate violet');
  assert.ok(C.accent.some((c) => c.join() === '120,200,230'), 'soul-light');
  assert.deepEqual([S.stone[0], S.stone.at(-1)], [[18, 18, 28], [86, 90, 112]], 'the Shade\'s dark');
  assert.deepEqual([S.metal[0], S.metal.at(-1)], [[160, 166, 176], [214, 220, 228]], 'moon-silver');
  assert.deepEqual([W.stone[0], W.stone.at(-1)], [[26, 22, 20], [94, 85, 76]], 'basalt, warmed');
  assert.ok(W.stone.every((c, i) => egLuma(c) > egLuma(SD_RAMP.basalt[i])), 'a step over SD-LOOK\'s basalt');
  assert.ok(W.liquid.some((c) => c.join() === '255,120,30'), 'molten');
  assert.deepEqual({ ...EG_DRESS }, { floor: SD_REALM_FLOOR_RECORD, brass: SD_REALM_BRASS_RECORD, root: SD_REALM_ROOT_RECORD, arena: SD_REALM_ARENA_RECORD, cobble: SD_REALM_COBBLE_RECORD, edge: SD_REALM_EDGE_RECORD, molten: 33, pillar: SD_REALM_PILLAR_RECORD });
  assert.deepEqual([0, 1, 2, 3].map(egBandArchive), [...EG_BAND_ARCHIVES]);
});

test('EG-G2 THE ART, PAINTED (Port-Doctrine: painted in code, never a render of game data): every band paints its twenty-one records - the ground\'s eight and the kit\'s thirteen (EG-LOOK, PIN MOVED), the same pixels every call, opaque but the cutouts (EG-LOOK, PIN MOVED: the banner and the fixture, their holes 1-bit), every albedo texel in the band\'s own palette; structure does not glow - the floor, the undersides, the walks and the walls black, the courts black but the Cairn\'s soul-light hairlines (EG-LOOK, PIN MOVED: its own light in their joints, under EG_SEAM_LUMA_MAX), the metal lit on its rubbed rows alone at the Hour\'s share, the edge line at the Hour\'s; the liquid lit, its every texel at or under 0.45 (mutants: a texel painted off the palette; the floor glowing; the liquid past its cap)', () => {
  for (let b = 0; b < 4; b++) {
    const art = egBandArt(b), again = egBandArt(b), pal = egBandPalette(b);
    assert.deepEqual(art.map(([r]) => r), [...EG_BAND_RECORDS], `band ${b}: its twenty-one records - the ground\'s eight and the kit\'s thirteen (EG-LOOK, PIN MOVED)`);
    for (const [k, [rec, { albedo, emission, cutout }]] of art.entries()) {
      assert.deepEqual(albedo.colors, again[k][1].albedo.colors, `band ${b} record ${rec}: the same pixels`);
      assert.deepEqual(emission.colors, again[k][1].emission.colors);
      assert.equal(albedo.colors.length, albedo.width * albedo.height * 4);
      assert.equal(emission.width, albedo.width); assert.equal(emission.height, albedo.height);
      assert.equal(offPalette(albedo, pal), 0, `band ${b} record ${rec}: in its palette`);
      // PIN MOVED (EG-LOOK, Elite-Gates-Look.md section 8): the banner's torn foot and the fixture's flames are cutouts -
      // their holes 1-bit (the renderer's RW1 rule), and every other picture as opaque as it was
      if (EG_CUTOUT_RECORDS.includes(rec)) { assert.equal(cutout, true, `band ${b} record ${rec}: a cutout`); assert.ok(texels(albedo).every((t) => t[3] === 255 || t[3] === 0), 'its holes 1-bit'); assert.ok(texels(albedo).some((t) => t[3] === 0), 'it has holes'); }
      else { assert.ok(!cutout, `band ${b} record ${rec}: no cutout`); assert.ok(texels(albedo).every((t) => t[3] === 255), 'opaque'); }
      const lit = texels(emission).filter((t) => t[0] || t[1] || t[2]);
      if ([EG_DRESS.floor, EG_DRESS.root, EG_DRESS.cobble, EG_DRESS.pillar].includes(rec)) assert.equal(lit.length, 0, `band ${b} record ${rec}: structure does not glow`);
      // PIN MOVED (EG-LOOK, section 1.2: "soul-light hairlines in the joints of the courts (the band's own light, L2)"):
      // the courts dark but the Cairn's, whose seams alone are lit, under the fight floor's cap
      if (rec === EG_DRESS.arena) {
        if (b !== 1) assert.equal(lit.length, 0, `band ${b}: its court does not glow`);
        else { assert.ok(lit.length > 0 && lit.length <= albedo.width * 2, 'the Cairn\'s court: its hairlines alone'); assert.ok(lit.every((t) => egLuma(t) <= EG_SEAM_LUMA_MAX), 'under the seam\'s cap'); }
      }
      if (rec === EG_DRESS.brass) {
        assert.ok(lit.length > 0 && lit.length <= albedo.width * 4, 'the metal: its rubbed rows alone');
        const A = texels(albedo), E = texels(emission);
        for (let i = 0; i < E.length; i++) if (E[i][0] || E[i][1] || E[i][2]) for (let c = 0; c < 3; c++) assert.ok(Math.abs(E[i][c] - A[i][c] * SD_BRASS_EDGE_GLOW) <= 1, 'at the Hour\'s share');
      }
      if (rec === EG_DRESS.edge) { const A = texels(albedo), E = texels(emission); for (let i = 0; i < E.length; i++) for (let c = 0; c < 3; c++) assert.ok(Math.abs(E[i][c] - A[i][c] * SD_EDGE_GLOW) <= 1, 'the edge line at the Hour\'s glow'); }
      if (rec === EG_DRESS.molten) {
        assert.ok(lit.length === texels(emission).length, 'the liquid is lit through');
        const A = texels(albedo), E = texels(emission);
        assert.ok(egMoltenGlow(b) <= EG_MOLTEN_GLOW && egMoltenGlow(b) > 0.4, `band ${b}: its glow ${egMoltenGlow(b).toFixed(3)}`);
        for (let i = 0; i < E.length; i++) { assert.ok(egLuma(E[i]) <= EG_MOLTEN_LUMA_MAX, `band ${b}: the liquid at or under 0.45`); for (let c = 0; c < 3; c++) assert.ok(Math.abs(E[i][c] - A[i][c] * egMoltenGlow(b)) <= 1); }
        assert.ok(Math.max(...E.map((e) => egLuma(e))) > 0.3, `band ${b}: its brightest near the cap`);
      }
    }
  }
});

test('EG-G2 THE FOUR LOOKS TOLD APART (section 7\'s band table): white marble the brightest floor, the Shade\'s black glass the darkest; each band\'s floor, metal and walls its own pixels; the edge line the same gold in every band (gold means it holds); the liquid molten orange where magma runs, soul-light in the Cairn, quicksilver in the Shade (mutants: two bands sharing a ramp; the edge line tinted by its band)', () => {
  const arts = [0, 1, 2, 3].map((b) => new Map(egBandArt(b)));
  const floors = arts.map((a) => mean(a.get(EG_DRESS.floor).albedo));
  assert.ok(floors[0] > 0.6, `the marble: ${floors[0].toFixed(2)}`);
  assert.ok(floors[2] < 0.22, `the black glass: ${floors[2].toFixed(2)}`);   // PIN MOVED (EG-LOOK, section 25.1): the glass lifted a step, 0.16 before - still the darkest floor (below)
  assert.ok(floors[0] > floors[1] && floors[1] > floors[2] && floors[3] > floors[2], 'marble, slate, glass; basalt over glass');
  for (const rec of [EG_DRESS.floor, EG_DRESS.brass, EG_DRESS.pillar, EG_DRESS.arena]) for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) assert.notDeepEqual(arts[a].get(rec).albedo.colors, arts[b].get(rec).albedo.colors, `record ${rec}: bands ${a} and ${b} differ`);
  for (let b = 1; b < 4; b++) assert.deepEqual(arts[b].get(EG_DRESS.edge).albedo.colors, arts[0].get(EG_DRESS.edge).albedo.colors, 'one gold');
  const hue = (img) => { const t = texels(img); const s = t.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]); return s; };
  const [mg, mc, ms, mw] = arts.map((a) => hue(a.get(EG_DRESS.molten).albedo));
  assert.ok(mg[0] > mg[2] * 3 && mw[0] > mw[2] * 3, 'molten orange in the Galleries and the Wellhead');
  assert.ok(mc[2] > mc[0], 'soul-light blue in the Cairn');
  assert.ok(Math.abs(ms[0] - ms[2]) < ms[2] * 0.25, 'quicksilver grey in the Shade');
});

test('EG-G2 THE DRESS (layer three\'s "the dress is the Hour\'s records"): every circle in every band builds in its band\'s archive - no sub-mesh left in the Hour\'s - its magma and fire channels in the liquid\'s record; a Rampart\'s portcullis dressed; the dress moves only the Hour\'s records it paints (the Steps\' own faces and another archive\'s left alone); the spans\' pieces dressed as they are made; the host uploads each band\'s art under its archive, once a session a band (mutants: the dress forgotten; a Step\'s dial dressed; the art uploaded under the Hour\'s archive)', () => {
  let molten = 0;
  for (const c of [1, 3, 6, 9, 11, 14, 16, 19]) {
    const m = buildEgCircleModel(7, c, 0), A = EG_BAND_ARCHIVES[egBandOfCircle(c)];
    assert.ok(m.subMeshes.length > 3);
    // PIN MOVED (EG-LOOK HALLS, Elite-Gates-Look.md section 2): the ground wears the kit's shaft, moulding, voussoir and inlay too
    // (world/eliteGates/egGround.js EG_GROUND_RECORDS), packed under the band's archive - never the Hour's, whose 60-78 are the Steps'
    for (const sm of m.subMeshes) { assert.equal(sm.textureArchive, A, `circle ${c} record ${sm.textureRecord}: the band's archive`); assert.ok(EG_BAND_RECORDS.includes(sm.textureRecord)); }
    if (m.subMeshes.some((sm) => sm.textureRecord === EG_DRESS.molten)) molten++;
    const ramp = egCircleSpecs(7, c, 0).find((s) => s.gate);
    if (ramp) assert.ok(egGateParts(ramp).model.subMeshes.every((sm) => sm.textureArchive === A), 'the portcullis dressed');
  }
  assert.ok(molten >= 1, 'magma in the liquid\'s record');
  // both sites: Grath's magma floor (circle 1's Court) and a Caverns passage's fire channels (circle 2's span)
  const moltenYs = (c) => { const m = buildEgCircleModel(7, c, 0), sm = m.subMeshes.find((q) => q.textureRecord === EG_DRESS.molten); const ys = new Set(); if (sm) for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i++) ys.add(Math.round(m.positions[m.indices[i] * 3 + 1] * 100) / 100); return ys; };
  const grath = egCircleSpecs(7, 1, 0).find((s) => (s.deco ?? []).some((d) => d.t === 'magma')), magmaY = grath.deco.find((d) => d.t === 'magma').y;
  assert.ok(moltenYs(1).has(magmaY), 'Grath\'s magma in the liquid');
  const cav = egCircleSpecs(7, 2, 0).flatMap((s) => s.caves).find((q) => q.kit === 'caverns');
  assert.ok(moltenYs(2).has(Math.round(cav.y * 100) / 100), 'the Caverns\' fire channels in the liquid');   // PIN MOVED (EG-LOOK HALLS): cut IN the floor's plane, no longer a centimetre over it
  // only the Hour's painted records move
  const step = buildStepModel('drift'), recs = step.subMeshes.map((sm) => [sm.textureArchive, sm.textureRecord]);
  egBandDress(step, 2);
  assert.deepEqual(step.subMeshes.map((sm) => [sm.textureArchive, sm.textureRecord]), recs, 'a Drift\'s dial is the Hour\'s');
  const other = egBandDress({ subMeshes: [{ textureArchive: 38101, textureRecord: 0 }, { textureArchive: SD_REALM_ARCHIVE, textureRecord: 0 }] }, 1);
  assert.deepEqual(other.subMeshes.map((sm) => sm.textureArchive), [38101, EG_BAND_ARCHIVES[1]]);
  // the spans: every made piece's dress
  const made = [];
  const span = createEgSpan({ renderer: { createMesh: (m) => { made.push(m); return { m }; }, destroyMesh: () => {} }, seed: 7, c: 11 });
  span.stand({ dynamicDraws: [], collider: null });
  const slabs = made.filter((m) => m.subMeshes.some((sm) => sm.textureRecord === EG_DRESS.floor));
  assert.ok(slabs.length > 0 && slabs.every((m) => m.subMeshes.filter((sm) => EG_DRESS_RECORDS.includes(sm.textureRecord)).every((sm) => sm.textureArchive === EG_BAND_ARCHIVES[2])), 'the Shade\'s pieces in the Shade\'s dress');
  const W = readFileSync(new URL('../../../src/scenes/eliteGates/egCircleHost.js', import.meta.url), 'utf8');   // PIN MOVED (HOST-SPLIT, EG-LOOK): the circle's own module
  // PIN MOVED (merged with EG-H3's swap): one helper, its stand's and the swap's
  // PIN MOVED (AUDIT EG V, e: L6-9 - a band's dress goes up a record at a time, the swap's worker painting it: the helper
  // paints only a band not whole, and each record goes up once under the band's archive - egBandRec)
  assert.match(W, /if \(egBandWhole\(band\) \|\| !renderer\?\.uploadTexture\) return;\n    try \{ for \(const \[rec, art\] of egBandArt\(band\)\) egBandRec\(band, rec, art\);/, 'the host paints a band not whole');
  // PIN MOVED (EG-LOOK, section 8): and a cutout picture (the banner, the fixture) asks the renderer for its holes
  assert.match(W, /if \(up\.has\(rec\) \|\| !renderer\?\.uploadTexture\) return;\n    _egBands\.add\(band\); up\.add\(rec\);\n    try \{ renderer\.uploadTexture\(egBandArchive\(band\), rec, art\.albedo, art\.cutout \? \{ cutout: true \} : undefined\); renderer\.uploadEmissionTexture\?\.\(egBandArchive\(band\), rec, art\.emission, \{ white: true \}\);/, 'the host uploads the band\'s art under its archive, once a band, a cutout as one');
});
