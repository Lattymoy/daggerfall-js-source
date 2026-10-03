// WD3 (2026-10-01, Mac: "For anything missing I need you to curate, like textures") - THE PIECES THE TWO TOWN MODS
// BORROW, STOOD IN BY THE PORT (src/world/townStandIns.js, detStandIns.js, townPictures.js, standInSprites.js,
// flatFields.js; systems/detailedShips.js's shared pictures). Beautiful Villages and Beautiful Cities place pieces of five
// peer mods the port does not carry and eighteen beds whose prefabs point at nothing; DFU without the peers draws
// nothing there. Every stand-in is the port's own - a classic model under another blanket, a mesh built in code, a
// picture drawn in code or rebuilt from the player's own records - made for the places the author put it.
//
// Held here: the beds (the classic bed each id is, the six colours, the green recoloured and nothing else, opaque) and
// their aliases (Daggerfall's own bed, its bedclothes swapped; RR rests on it; nothing with the switch off); the
// paintings (sixty-two ids, each hung as its placements stand - its face's normal and its picture's top), Rosy's
// hangings and rugs, the RMB Resource Pack's rocks, hills, stalls, platform, foundation, domes and docks (every mesh
// sound - each face facing its normal, every index landing, Daggerfall's textures or the port's drawn cloth - and each
// the size it was measured); the drawn cloth (48 pictures, opaque) and sprites (a clear ground, binary alpha); the crop
// fields (the climate's plant, a grid of 484, the same every visit, sown only where a block's nature is known); the
// table clutter and the temple gardens (classic records); the install (once, every piece behind its switch, DET's and
// Cliffworms' shared with Detailed Ships by either switch); the pipeline's hole (a record no picture is for draws
// nothing, said once). With ARENA2_PATH: every model and flat the two packs place is Daggerfall's own, stood in, or one
// of a named few; every built-in flat a town's interior lays can be taken out of a house (BASE-HIDE's name); the alias
// beds built by the pipeline from the player's own ARCH3D.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import {
  TOWN_BED_FIRST, TOWN_BED_COUNT, TOWN_BED_ARCHIVE, TOWN_BED_MODELS, TOWN_BEDCLOTHS, TOWN_BED_COLOURS, townBedOf, bedclothRecord,
  isBedclothGreen, recolourBedcloth, CLASSIC_PAINTINGS, TOWN_PAINTINGS, paintingModel, ROSYS_PIECES, TOWN_CROP_FIELDS, RMBRP_ROCKS,
  RMBRP_HILLS, RMBRP_STALLS, RMBRP_DOCKS, DOCK_SCALE, RMBRP_PIECES, TOWN_CLUTTER, TOWN_CLUTTER_ARCHIVE, TOWN_GARDEN, TOWN_GARDEN_ARCHIVE,
  installTownStandIns, _resetTownStandIns,
} from '../src/world/townStandIns.js';
import { DET_TOWN_MODELS, DET_FLAT_STAND_INS, DET_FLAT_DRAWINGS, DET_TOWN_FLATS, DET_OLD_ARCHIVES, detStandInsOn, _resetDetStandIns } from '../src/world/detStandIns.js';
import { TOWN_PICTURE_ARCHIVE, TOWN_PICTURES, PICTURE, townPictureEntries } from '../src/world/townPictures.js';
import { STAND_IN_SPRITES } from '../src/world/standInSprites.js';
import { customModelFor, customAliasFor, aliasSubMeshes, classicModelIdOf, hasCustomModel, _resetCustomModels } from '../src/world/customModels.js';
import { flatFieldFor, cropRecordsFor, sowField, CROP_ARCHIVE, _resetFlatFields } from '../src/world/flatFields.js';
import { collectBlockFlats } from '../src/world/rmbFlats.js';
import { addVendorTextures, clearVendorTextures, hasTextureReplacement, setTextureDeriveContext, preloadTextureArchive, decodedTexture } from '../src/systems/textureReplacement.js';
import { installDetailedShipsArt, _resetDetailedShipsArt, detailedShipsArtOn, DETAILED_SHIPS_VENDOR } from '../src/systems/detailedShips.js';
import { billboardXmlScale, unregisterBillboardXml } from '../src/world/billboardXml.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { isBedModel } from '../src/systems/rrRealism.js';
import { DECOR_BASE_KEY_RE, decorBaseFlatKey, decorBaseModelKey } from '../src/net/decorLaw.js';
import { createDataPipeline, LAST_CLASSIC_TEXTURE_ARCHIVE } from '../src/scenes/dataPipeline.js';
import { color32Bytes } from '../src/render/renderer.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { classicRecordRgba } from '../src/formats/derivedTexture.js';
import { openWorldDataPack } from '../src/formats/worldDataPack.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { isNpcFlat } from '../src/world/rdbLayout.js';
import { trs, multiply } from '../src/world/mat4.js';
import { tinyRmb } from './wd3Fakes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['BLOCKS.BSA', 'MAPS.BSA', 'ARCH3D.BSA'].every((f) => existsSync(join(ARENA2, f)));
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const U = 0.025;

function resetAll() {
  _resetTownStandIns(); _resetDetStandIns(); _resetCustomModels(); _resetFlatFields(); clearVendorTextures();
  _resetDetailedShipsArt(); unregisterBillboardXml(DETAILED_SHIPS_VENDOR); setTextureDeriveContext(null); _resetModSettings();
}

/** A built model: every array the size its vertices say, the submeshes tiling the index list, every index landing, every
 *  face facing its normal (the port's front face), every texture Daggerfall's own or the port's drawn cloth. Answers
 *  its bounds and its textures. */
function soundMesh(id, m) {
  const nv = m.positions.length / 3;
  assert.ok(nv > 0, `${id}: has vertices`);
  assert.equal(m.normals.length, nv * 3, id); assert.equal(m.uvs.length, nv * 2, id); assert.deepEqual(m.doors, [], id);
  let covered = 0;
  const tex = new Set();
  for (const s of m.subMeshes) {
    assert.ok(s.textureArchive <= LAST_CLASSIC_TEXTURE_ARCHIVE || s.textureArchive === TOWN_PICTURE_ARCHIVE, `${id}: texture ${s.textureArchive}_${s.textureRecord}`);
    assert.equal(s.startIndex, covered, `${id}: submeshes tile the index list`);
    covered += s.primitiveCount * 3;
    tex.add(`${s.textureArchive}_${s.textureRecord}`);
  }
  assert.equal(covered, m.indices.length, id);
  const P = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
  for (let t = 0; t < m.indices.length; t += 3) {
    const [i0, i1, i2] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
    assert.ok(i0 < nv && i1 < nv && i2 < nv, `${id}: index in range`);
    const [a, b, c] = [P(i0), P(i1), P(i2)];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const n = [m.normals[i0 * 3], m.normals[i0 * 3 + 1], m.normals[i0 * 3 + 2]];
    assert.ok(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0, `${id}: triangle ${t / 3} faces its normal`);
  }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[i * 3 + k]); hi[k] = Math.max(hi[k], m.positions[i * 3 + k]); }
  return { lo, hi, tex };
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const hsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
};

// ---- the beds ---------------------------------------------------------------------------------------------------------
test('WD3 stand-ins, the beds: eighteen ids, Daggerfall\'s three beds six times over - 42069 + 3k a 41000, +1 a 41001, +2 a 41002 - under six colours of bedclothes, the green recoloured and nothing else, opaque', () => {
  assert.deepEqual([TOWN_BED_FIRST, TOWN_BED_COUNT, TOWN_BED_ARCHIVE], [42069, 18, 38201]);
  assert.deepEqual(TOWN_BED_MODELS, [41000, 41001, 41002]); assert.deepEqual(TOWN_BEDCLOTHS, [5, 6, 7]);
  assert.deepEqual(TOWN_BED_COLOURS.map((c) => c.name), ['blue', 'brown', 'grey', 'orange', 'purple', 'yellow'], 'the bundle\'s order: B, Br, G(rey), O, P, Y');
  for (let k = 0; k < 18; k++) assert.deepEqual(townBedOf(42069 + k), { model: TOWN_BED_MODELS[k % 3], colour: Math.floor(k / 3) }, String(42069 + k));
  for (const none of [42068, 42087, 41000, '42069x', null]) assert.equal(townBedOf(none), null, String(none));
  assert.equal(bedclothRecord(5, 2), 17); assert.equal(bedclothRecord(0, 0), 0);
  // the green Daggerfall's bedclothes are measured at (hue 114-118, saturation 0.32-0.37), and not the sheet's white or the frame's brown
  assert.equal(isBedclothGreen(116, 0.35), true);
  assert.equal(isBedclothGreen(116, 0.1), false, 'a grey-green sheet');
  assert.equal(isBedclothGreen(30, 0.5), false, 'the frame\'s brown');
  assert.equal(isBedclothGreen(200, 0.5), false);
  const green = [62, 96, 60], white = [230, 228, 220], brown = [96, 60, 30];
  const src0 = { width: 3, height: 1, data: new Uint8Array([...green, 255, ...white, 255, ...brown, 0]) };
  for (const c of TOWN_BED_COLOURS) {
    const out = recolourBedcloth(src0, c);
    assert.deepEqual([out.width, out.height], [3, 1]);
    const [h, s] = hsv(out.data[0], out.data[1], out.data[2]);
    if (c.sat > 0) assert.ok(Math.min(Math.abs(h - c.hue), 360 - Math.abs(h - c.hue)) < 4, `${c.name}: the cloth's hue ${h.toFixed(1)}`);
    else assert.ok(s < 0.02, 'grey: no hue left');
    assert.deepEqual([...out.data.slice(4, 7)], white, `${c.name}: the sheet kept`);
    assert.deepEqual([...out.data.slice(8, 11)], brown, `${c.name}: the frame kept`);
    assert.deepEqual([out.data[3], out.data[7], out.data[11]], [255, 255, 255], 'opaque - a mesh\'s material draws no cut-out');
  }
});

test('WD3 stand-ins, the aliases: each bed id IS Daggerfall\'s bed, its three bedclothes swapped for the colour\'s - Roleplay & Realism rests on it as on its own; with the switch off it is nothing of the kind', () => {
  resetAll();
  let on = true;
  installTownStandIns(() => on);
  for (let k = 0; k < 18; k++) {
    const id = 42069 + k, a = customAliasFor(id), colour = Math.floor(k / 3);
    assert.equal(a.model, TOWN_BED_MODELS[k % 3], String(id));
    assert.deepEqual(a.remap, { '90_5': [38201, colour * 3], '90_6': [38201, colour * 3 + 1], '90_7': [38201, colour * 3 + 2] }, String(id));
    assert.equal(classicModelIdOf(id), TOWN_BED_MODELS[k % 3]);
    assert.equal(isBedModel(classicModelIdOf(id)), true, `${id}: a bed to rest on`);
    assert.equal(customModelFor(id), null, 'an alias is no built mesh - the pipeline builds it from the player\'s own ARCH3D');
  }
  const subs = [{ textureArchive: 90, textureRecord: 5, startIndex: 0 }, { textureArchive: 90, textureRecord: 8, startIndex: 3 }, { textureArchive: 67, textureRecord: 1, startIndex: 6 }];
  assert.deepEqual(aliasSubMeshes(subs, customAliasFor(42078).remap).map((s) => [s.textureArchive, s.textureRecord, s.startIndex]), [[38201, 9, 0], [90, 8, 3], [67, 1, 6]], 'only the bedclothes');
  assert.equal(classicModelIdOf(41000), 41000);
  on = false;
  assert.equal(customAliasFor(42069), null);
  assert.equal(classicModelIdOf(42069), 42069);
  assert.equal(isBedModel(classicModelIdOf(42069)), false);
  assert.match(src('src/scenes/interiorContext.js'), /\} else if \(isBedModel\(classicModelIdOf\(p\.modelIdNum\)\)\) \{/);
  assert.match(src('src/scenes/dataPipeline.js'), /const alias = customAliasFor\(modelIdNum\);\n {4}if \(alias\) return buildAliasMesh\(modelIdNum, alias\);/);
  assert.match(src('src/scenes/dungeonContext.js'), /const alias = custom \? null : customAliasFor\(id\);/);
  resetAll();
});

// ---- the paintings ------------------------------------------------------------------------------------------------------
test('WD3 stand-ins, the paintings: Rosy\'s and New Paintings\' sixty-two ids as Daggerfall\'s six framed paintings on a dark board, each hung as its placements stand - upright facing +Z, on its side facing -X turned up by the author\'s X rotation, or lying face down - and two units deep', () => {
  assert.deepEqual(CLASSIC_PAINTINGS.map(([r]) => r), [0, 1, 2, 3, 4, 5]);
  const ids = Object.keys(TOWN_PAINTINGS).map(Number);
  assert.equal(ids.length, 62);
  const by = (h) => ids.filter((id) => TOWN_PAINTINGS[id].hang === h).length;
  assert.deepEqual([by('V'), by('Y'), by('Yup'), by('H')], [42, 11, 1, 8]);
  assert.ok(ids.every((id) => (id >= 69420 && id <= 69464) || (id >= 79010 && id <= 79030)), 'Rosy\'s 69420-69464, New Paintings 79010-79030');
  const sorted = [...ids].sort((a, b) => a - b);
  sorted.forEach((id, k) => assert.deepEqual({ ...TOWN_PAINTINGS[id] }, { hang: TOWN_PAINTINGS[id].hang, picture: k % 6, mirror: Math.floor(k / 6) % 2 === 1 }, String(id)));
  const NORMAL = { V: [0, 0, 1], Yup: [-1, 0, 0], Y: [-1, 0, 0], H: [0, -1, 0] };
  const TOP = { V: [0, 1, 0], Yup: [0, 1, 0], Y: [0, 0, 1], H: [0, 0, 1] };
  for (const hang of ['V', 'Yup', 'Y', 'H']) {
    for (const picture of [0, 5]) {
      for (const mirror of [false, true]) {
        const m = paintingModel({ hang, picture, mirror });
        const { lo, hi, tex } = soundMesh(`${hang}/${picture}`, m);
        assert.deepEqual([...tex].sort(), ['0_46', `48_${CLASSIC_PAINTINGS[picture][0]}`].sort());
        const face = m.subMeshes.find((s) => s.textureArchive === 48);
        const vs = [...m.indices.slice(face.startIndex, face.startIndex + face.primitiveCount * 3)];
        assert.deepEqual([...m.normals.slice(vs[0] * 3, vs[0] * 3 + 3)].map((x) => Math.round(x) || 0), NORMAL[hang], `${hang}: the face looks out`);
        const corners = (v) => [...new Map(vs.filter((i) => near(m.uvs[i * 2 + 1], v)).map((i) => { const p = [...m.positions.slice(i * 3, i * 3 + 3)]; return [p.join(','), i]; })).values()];
        const top = corners(0), bottom = corners(-1);
        assert.deepEqual([top.length, bottom.length], [2, 2], `${hang}: the picture's two top corners and two bottom ones`);
        const mean = (list, k) => list.reduce((s, i) => s + m.positions[i * 3 + k], 0) / list.length;
        const up = [0, 1, 2].map((k) => Math.sign(Math.round((mean(top, k) - mean(bottom, k)) * 1000)) || 0);
        assert.deepEqual(up, TOP[hang], `${hang}: the picture's top`);
        const axis = NORMAL[hang].findIndex((x) => x !== 0), sign = NORMAL[hang][axis];
        assert.ok(near(sign > 0 ? hi[axis] : -lo[axis], 0) && near(sign > 0 ? -lo[axis] : hi[axis], 2 * U), `${hang}: the face on the origin, the board two units behind`);
        const [, pw, ph] = CLASSIC_PAINTINGS[picture];
        const spans = [0, 1, 2].filter((k) => k !== axis).map((k) => +(hi[k] - lo[k]).toFixed(4)).sort((a, b) => a - b);
        assert.deepEqual(spans, [pw * U, ph * U].map((x) => +x.toFixed(4)).sort((a, b) => a - b), `${hang}: a pixel a unit`);
      }
    }
  }
});

// ---- the meshes ----------------------------------------------------------------------------------------------------------
test('WD3 stand-ins, every built piece is sound - Rosy\'s hangings and rugs, the RMB Resource Pack\'s rocks, hills, stalls, platform, foundation, domes and docks, DET\'s town pieces - and the size it was measured', () => {
  const all = { ...ROSYS_PIECES, ...RMBRP_PIECES, ...DET_TOWN_MODELS };
  assert.equal(Object.keys(ROSYS_PIECES).length, 5);
  assert.equal(Object.keys(RMBRP_PIECES).length, Object.keys(RMBRP_ROCKS).length + Object.keys(RMBRP_HILLS).length + Object.keys(RMBRP_STALLS).length + 3 + 2 + 3 + 2);
  assert.equal(Object.keys(RMBRP_PIECES).length, 73);
  assert.equal(Object.keys(DET_TOWN_MODELS).length, 52);
  const box = {};
  for (const [id, build] of Object.entries(all)) box[id] = soundMesh(id, build());
  // rocks: [width, height above the origin, depth below, length] - the boulder's rim pushed out by at most a tenth and in by a fifth
  for (const [id, [w, up, down, l]] of Object.entries(RMBRP_ROCKS)) {
    const { lo, hi, tex } = box[id];
    assert.deepEqual([...tex], ['302_3'], `${id}: the climate's rock`);
    assert.ok(near(hi[1], up) && near(lo[1], -Math.max(down, 0.05)), `${id}: ${up} up, ${down} down`);
    assert.ok(hi[0] - lo[0] <= w * 1.13 && hi[0] - lo[0] >= w * 0.75 && hi[2] - lo[2] <= l * 1.13 && hi[2] - lo[2] >= l * 0.75, `${id}: ${w} x ${l}`);
  }
  for (const [id, [r, h, surface]] of Object.entries(RMBRP_HILLS)) {
    const { lo, hi, tex } = box[id];
    assert.deepEqual([...tex], [surface === 'rock' ? '302_3' : '302_2'], id);
    assert.ok(near(hi[1], h - 0.3, 1e-5) && near(lo[1], -0.3, 1e-5) && near(hi[0], r, 1e-5) && near(lo[0], -r, 1e-5), `${id}: radius ${r}, ${h} high, sunk 0.3`);
  }
  for (const [id, [a, r]] of Object.entries(RMBRP_STALLS)) {
    const { lo, hi, tex } = box[id];
    assert.ok(tex.has(`${a}_${r}`) && tex.has('67_1'), `${id}: its awning, ${a}_${r}`);
    assert.ok(near(lo[0], -0.4, 1e-5) && near(hi[0], 2.75, 1e-5) && near(hi[1], 4.4, 1e-5) && near(lo[2], -2.4, 1e-5) && near(hi[2], 2.45, 1e-5), id);
  }
  // the docks: the deck's top on the origin, its piles 2.5 units below and half above, at the prefab's 2; x mirrored as Unity imports
  assert.equal(DOCK_SCALE, 2);
  for (const id of Object.keys(RMBRP_DOCKS)) {
    const { lo, hi, tex } = box[id];
    assert.deepEqual([...tex].sort(), ['67_2', '67_7']);
    assert.ok(near(lo[1], -5) && near(hi[1], 1), `${id}: piles from 5 m below the deck to 1 m above`);
  }
  assert.ok(near(box[53140].lo[2], 2 * 0.85, 0.02) && near(box[53140].hi[2], 2 * 5.15, 0.02), 'the short dock: its deck from 2 m out');
  assert.ok(near(box[53141].lo[2], -0.1, 0.02) && near(box[53141].hi[2], 10.3, 0.02), 'the long dock: ten metres');
  assert.ok(box[53142].hi[0] >= 7 && box[53142].lo[0] <= -7 && box[53142].hi[0] <= 7.31 && box[53142].lo[0] >= -7.31, 'the T-dock\'s wings, seven metres a side (and their piles)');
  const ramp = box[53143], steps = box[53144];
  assert.deepEqual([ramp.lo, ramp.hi].map((v) => v.map((x) => +x.toFixed(3))), [[0, -1.4, -4], [4, 0, 0]], 'the ramp: four metres square, falling one metre on its top, mirrored onto +x');
  assert.deepEqual([steps.lo, steps.hi].map((v) => v.map((x) => +x.toFixed(3))), [[0, -1.2, -4], [3, 0, 0]], 'the steps: five treads of 0.6 m, falling 0.2 m each');
  // the platform, the foundation, the domes
  assert.deepEqual([box[53160].lo, box[53160].hi], [[-2, -1, -2], [2, 1, 2]]);
  assert.deepEqual([box[53170].lo, box[53170].hi].map((v) => v.map((x) => +x.toFixed(3))), [[-8, -6.4, -8], [8, 1.6, 8]], 'the temples\' floor its top - their doors never walled up (AUDIT WD3 T1)');
  for (const id of [53182, 53187, 53194]) assert.ok(near(box[id].hi[1], 3.6, 1e-5) && near(box[id].lo[1], -1.2, 1e-5), id);
  // Rosy's: the small hangings hang from their rod, the rugs lie on the floor
  for (const id of [69467, 69468, 69469]) assert.ok(box[id].tex.has(`${TOWN_PICTURE_ARCHIVE}_${PICTURE.smallHanging(id - 69467)}`) && near(box[id].lo[1], -0.6, 1e-5), id);
  for (const id of [69471, 69472]) assert.ok(near(box[id].lo[1], 0) && near(box[id].hi[1], 0.012, 1e-5), id);
});

// ---- the pictures and the sprites ----------------------------------------------------------------------------------------
test('WD3 stand-ins, the drawn cloth: forty-eight pictures of archive 38202 - five regions\' tapestries and banners, the Eight\'s, fourteen patterns, four rugs, leaves, three small hangings - every one opaque, behind its switch', async () => {
  assert.equal(TOWN_PICTURE_ARCHIVE, 38202);
  assert.equal(TOWN_PICTURES.length, 48);
  const sizes = TOWN_PICTURES.map((p) => { const pic = p.draw(); return `${pic.width}x${pic.height}`; });
  assert.deepEqual([...new Set(sizes.slice(0, 5)), ...new Set(sizes.slice(5, 10)), ...new Set(sizes.slice(40, 44)), sizes[44], ...new Set(sizes.slice(45))], ['32x48', '24x64', '48x32', '16x16', '16x24']);
  for (const [k, p] of TOWN_PICTURES.entries()) {
    const pic = p.draw();
    assert.equal(pic.data.length, pic.width * pic.height * 4, p.name);
    for (let i = 3; i < pic.data.length; i += 4) assert.equal(pic.data[i], 255, `${k} ${p.name}: opaque`);
    assert.deepEqual([...pic.data], [...p.draw().data], `${p.name}: the same every time`);
  }
  assert.deepEqual([PICTURE.regionTapestry('Glenpoint'), PICTURE.regionBanner('Glenpoint'), PICTURE.divineTapestry('Kynareth'), PICTURE.divineBanner('Akatosh'), PICTURE.decorative(15), PICTURE.rug(5), PICTURE.leaves, PICTURE.smallHanging(4)], [0, 5, 10 + PICTURE.divineTapestry('Kynareth') - 10, 18 + PICTURE.divineBanner('Akatosh') - 18, 26 + 1, 41, 44, 46]);
  let on = true;
  const entries = townPictureEntries(() => on);
  assert.equal(entries.length, 48);
  assert.ok(entries.every((e, r) => e.archive === 38202 && e.record === r && e.standIn === true && e.gate() === true));
  on = false;
  assert.ok(entries.every((e) => e.gate() === false));
  assert.equal((await entries[3].build()).width, 32);
});

test('WD3 stand-ins, the drawn sprites: every one a clear ground and a drawn subject, binary alpha, small as Daggerfall\'s own; every name the DET tables point at is drawn', () => {
  const names = Object.keys(STAND_IN_SPRITES);
  assert.equal(names.length, 40);
  for (const n of names) {
    const pic = STAND_IN_SPRITES[n]();
    let clear = 0, solid = 0;
    for (let i = 3; i < pic.data.length; i += 4) { if (pic.data[i] === 0) clear++; else if (pic.data[i] === 255) solid++; else assert.fail(`${n}: a partial alpha`); }
    assert.ok(clear > 0 && solid > 0, `${n}: a subject on a clear ground`);
    assert.ok(pic.width <= 34 && pic.height <= 34, `${n}: ${pic.width}x${pic.height}`);
    const corner = (x, y) => pic.data[(y * pic.width + x) * 4 + 3];
    assert.ok([corner(0, 0), corner(pic.width - 1, 0)].includes(0), `${n}: a clear top corner`);
  }
  for (const recs of Object.values(DET_FLAT_DRAWINGS)) for (const [name] of Object.values(recs)) assert.ok(STAND_IN_SPRITES[name], name);
});

// ---- the crop fields ----------------------------------------------------------------------------------------------------
test('WD3 stand-ins, the crop fields: the four prefabs a grid of the climate\'s own crop billboards - a plant every 4 m, nudged up to half a metre, the same every visit - the woodlands\' wheat, the mountains\' corn, the desert\'s, the south\'s sunflowers, the swamp\'s vines, winter\'s stubble', () => {
  assert.deepEqual({ ...TOWN_CROP_FIELDS[53211] }, { rangeX: 85, rangeZ: 85, spacing: 4, noise: 0.5 });
  assert.deepEqual([53212, 53213, 53214].map((id) => [TOWN_CROP_FIELDS[id].rangeX, TOWN_CROP_FIELDS[id].rangeZ]), [[35, 85], [85, 35], [35, 35]]);
  assert.equal(CROP_ARCHIVE, 301);
  assert.deepEqual([500, 501, 502, 503, 504, 506, 508, 510].map(cropRecordsFor), [[301, [7, 8]], [301, [3, 4]], [301, [7, 8]], [301, [2]], [301, [19, 21]], [301, [19, 21]], [301, [19, 21]], [301, [0, 1]]]);
  for (const winter of [505, 507, 509, 511]) assert.deepEqual(cropRecordsFor(winter), [511, [22]], `${winter}: snowed stubble`);
  const spec = TOWN_CROP_FIELDS[53211];
  const field = sowField(spec, 504, 50, -0.3, 60, 0);
  assert.equal(field.length, 22 * 22, 'u and v from -42.5 to 41.5 in fours');
  assert.ok(field.every((f) => f.archive === 301 && [19, 21].includes(f.record) && f.y === -0.3));
  assert.ok(field.every((f) => Math.abs(f.x - 50) <= 42.5 + 0.5 + 1e-9 && Math.abs(f.z - 60) <= 42.5 + 0.5 + 1e-9), 'within the range and its nudge');
  assert.deepEqual(sowField(spec, 504, 50, -0.3, 60, 0), field, 'the same every visit');
  assert.notDeepEqual(sowField(spec, 504, 54, -0.3, 60, 0).map((f) => f.x - 4), field.map((f) => f.x), 'another spot, other nudges');
  // a field turned a quarter: the same plants, the grid turned about its spot
  const turned = sowField(spec, 504, 50, -0.3, 60, Math.PI / 2);
  assert.equal(turned.length, field.length);
  for (let i = 0; i < field.length; i++) assert.ok(near(Math.hypot(turned[i].x - 50, turned[i].z - 60), Math.hypot(field[i].x - 50, field[i].z - 60), 1e-9), 'distances kept');
  assert.equal(sowField(TOWN_CROP_FIELDS[53214], 511, 0, 0, 0).every((f) => f.archive === 511 && f.record === 22), true);
  assert.equal(sowField(TOWN_CROP_FIELDS[53214], 511, 0, 0, 0).length, 9 * 9);
  assert.equal(sowField({ ...spec, firstRecordOnly: true }, 504, 0, 0, 0).every((f) => f.record === 21), true);
});

test('WD3 stand-ins, a field sown in a block: rmbFlats lays a registered prefab\'s field among the block\'s flats, by its climate - and only where the block\'s nature is known and the field is on', () => {
  resetAll();
  let on = true;
  installTownStandIns(() => on);
  const b = tinyRmb(7, 'FARMBA01.RMB');
  for (const col of b.rmbBlock.fldHeader.groundData.groundScenery) for (const cell of col) cell.textureRecord = 0;   // no nature of the block's own in the count
  b.rmbBlock.misc3dObjectRecords = [{ modelId: '53214', modelIdNum: 53214, objectType: 3, xPos: 2048, yPos: 0, zPos: -2048, xRotation: 0, yRotation: 512, zRotation: 0 }];
  const crops = (nature) => collectBlockFlats(b, nature).filter((f) => f.archive === 301 || (f.archive === 511 && f.record === 22));
  assert.equal(crops(502).length, 81, 'the swamp\'s vines');
  assert.ok(crops(502).every((f) => [7, 8].includes(f.record)));
  assert.equal(crops(511).length, 81, 'winter: stubble');
  assert.equal(crops(undefined).length, 0, 'no climate, no field');
  on = false;
  assert.equal(crops(502).length, 0, 'switched off');
  assert.equal(flatFieldFor(53214), null);
  resetAll();
});

// ---- the install ----------------------------------------------------------------------------------------------------------
test('WD3 stand-ins, the install: once; every piece behind the town mods\' switch - beds, paintings, Rosy\'s, the pack\'s pieces, the fields, the bedclothes, the cloth, the clutter, the gardens - and DET\'s pieces and Cliffworms\' pictures shared with Detailed Ships, on while either is', async () => {
  resetAll();
  setModSetting(DETAILED_SHIPS_VENDOR, 'Enabled', false);
  let towns = true;
  assert.equal(installDetailedShipsArt({ fetchBytes: async () => new Uint8Array(0) }), 13);
  assert.equal(detailedShipsArtOn(), false, 'Detailed Ships off, no town mod yet');
  const n = installTownStandIns(() => towns);
  assert.equal(installTownStandIns(() => true), 0, 'once');
  assert.equal(n, 18 + 22 + 7, 'the bedclothes, the clutter and the gardens - DET\'s pictures were put on the door by Detailed Ships, and answer to both switches');
  for (const id of [...Object.keys(TOWN_PAINTINGS), ...Object.keys(ROSYS_PIECES), ...Object.keys(RMBRP_PIECES), ...Object.keys(DET_TOWN_MODELS)]) assert.equal(hasCustomModel(id), true, id);
  for (const id of Object.keys(TOWN_CROP_FIELDS)) assert.ok(flatFieldFor(id), id);
  const pictures = [
    ...TOWN_BED_COLOURS.flatMap((_, c) => [0, 1, 2].map((cloth) => [TOWN_BED_ARCHIVE, bedclothRecord(c, cloth)])),
    ...Object.keys(TOWN_CLUTTER).map((r) => [TOWN_CLUTTER_ARCHIVE, Number(r)]),
    ...Object.keys(TOWN_GARDEN).map((r) => [TOWN_GARDEN_ARCHIVE, Number(r)]),
    ...TOWN_PICTURES.map((_, r) => [TOWN_PICTURE_ARCHIVE, r]),
    ...Object.entries(DET_TOWN_FLATS).flatMap(([a, rs]) => Object.keys(rs).map((r) => [Number(a), Number(r)])),
    ...Object.entries(DET_FLAT_STAND_INS).flatMap(([a, rs]) => Object.keys(rs).map((r) => [Number(a), Number(r)])),
    ...Object.keys(DET_OLD_ARCHIVES).flatMap((a) => Object.keys(DET_FLAT_STAND_INS[DET_OLD_ARCHIVES[a]] ?? {}).map((r) => [Number(a), Number(r)])),
    [1210, 10], [1210, 11], [1210, 12], [1210, 17], [1210, 18], [1210, 19], [1210, 20],
  ];
  for (const [a, r] of pictures) assert.equal(hasTextureReplacement(a, r), true, `${a}_${r}`);
  assert.equal(detStandInsOn(), true); assert.equal(detailedShipsArtOn(), true, 'Cliffworms\' pictures shared with the towns');
  assert.deepEqual(billboardXmlScale(1210, 17), { x: 0.5, y: 0.5 }, 'and their scales');
  for (const [a, r] of Object.entries(TOWN_CLUTTER).concat(Object.entries(TOWN_GARDEN)).map(([, from]) => from)) assert.ok(a <= LAST_CLASSIC_TEXTURE_ARCHIVE && Number.isInteger(r), 'a classic record');
  towns = false;
  for (const [a, r] of pictures) assert.equal(hasTextureReplacement(a, r), false, `${a}_${r} off`);
  assert.equal(hasCustomModel(69424), false); assert.equal(flatFieldFor(53211), null); assert.equal(customAliasFor(42069), null);
  assert.equal(detailedShipsArtOn(), false); assert.equal(billboardXmlScale(1210, 17), null);
  setModSetting(DETAILED_SHIPS_VENDOR, 'Enabled', true);
  assert.equal(hasTextureReplacement(1210, 10), true, 'Detailed Ships\' own switch');
  assert.equal(hasCustomModel(45081), true, 'DET\'s timbers stand for its ships');
  assert.equal(hasCustomModel(69424), false, 'the towns\' own pieces do not');
  assert.match(src('src/world/townStandIns.js'), /let n = installDetStandIns\(isOn\);\n {2}shareDetailedShipsArt\(isOn\);/);
  resetAll();
});

// ---- the pipeline's hole ---------------------------------------------------------------------------------------------------
test('WD3 the pipeline: a record its stand-in archive has no picture for (1230_15, between the ones a mod supplies) uploads one clear pixel - its batch draws nothing, as in DFU - and is said once; it never throws the interior', async () => {
  resetAll();
  addVendorTextures([{ archive: 1230, record: 30, standIn: true, fileName: '1230_30-0', build: async () => ({ width: 2, height: 2, data: new Uint8Array(16).fill(255) }) }]);
  const renderer = {
    uploads: [], pixels: [],
    uploadTexture(a, r, c) { color32Bytes(c, `uploadTexture(${a}, ${r})`); this.uploads.push(`${a}_${r}`); this.pixels.push([c.width, c.height, [...c.colors]]); },
    uploadEmissionTexture() {}, createMesh: (m) => ({ mesh: m }),
  };
  const pipe = createDataPipeline({ renderer, arch: null, palette: null, fetch: async (n) => { throw new Error(`no ${n} here`); } });
  const warns = [];
  const warn = console.warn; console.warn = (...a) => warns.push(a.join(' '));
  try {
    const t = await pipe.getTexture(1230);
    assert.equal(t.recordCount, 31);
    pipe.uploadRecord(1230, 15);
    pipe.uploadRecord(1230, 15);
  } finally { console.warn = warn; }
  assert.deepEqual(renderer.uploads, ['1230_15', '1230_15']);
  assert.deepEqual(renderer.pixels[0], [1, 1, [0, 0, 0, 0]], 'one clear pixel');
  assert.equal(warns.filter((w) => /\[texture\] 1230_15: no mod picture and no stand-in - nothing drawn, as in DFU/.test(w)).length, 1, 'said once');
  resetAll();
});

// ---- with the player's own data -------------------------------------------------------------------------------------------
/** Every block file of both packs, rebuilt; `each(record, where)` for every model and flat they place. */
function packPlacements(blocks, maps, each) {
  for (const v of ['beautiful-villages', 'beautiful-cities']) {
    const p = openWorldDataPack(JSON.parse(zlib.gunzipSync(readFileSync(join(ROOT, `vendor/${v}/WorldDataPack/${v}.pack.json.gz`))).toString('utf8')), { blocks });
    for (const name of p.names()) {
      if (!name.endsWith('.RMB.json')) continue;
      const rmb = p.rebuild(name, maps).RmbBlock;
      for (const s of rmb.SubRecords) {
        for (const side of ['Exterior', 'Interior']) {
          const h = s[side];
          h.Block3dObjectRecords.forEach((m, i) => each({ kind: 'model', id: m.ModelIdNum, side, index: i }));
          h.BlockFlatObjectRecords.forEach((f, i) => each({ kind: 'flat', archive: f.TextureArchive, record: f.TextureRecord, side, index: i }));
          h.BlockPeopleRecords.forEach((f) => each({ kind: 'person', archive: f.TextureArchive, record: f.TextureRecord, side }));
        }
      }
      for (const m of rmb.Misc3dObjectRecords) each({ kind: 'model', id: m.ModelIdNum, side: 'Misc' });
      for (const f of rmb.MiscFlatObjectRecords) each({ kind: 'flat', archive: f.TextureArchive, record: f.TextureRecord, side: 'Misc' });
    }
    p.release();
  }
}
function loadArena2() {
  const blocks = new BlocksFile(); assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  const maps = new MapsFile(); assert.ok(maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK')))));
  const arch = new Arch3dFile(); assert.ok(arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA')))));
  const palette = new DFPalette(); palette.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))));
  const files = new Map();
  const texture = (archive) => {
    if (!files.has(archive)) {
      const name = `TEXTURE.${String(archive).padStart(3, '0')}`;
      const t = new TextureFile();
      files.set(archive, existsSync(join(ARENA2, name)) && t.load(new Uint8Array(readFileSync(join(ARENA2, name))), name, palette) ? t : null);
    }
    return files.get(archive);
  };
  return { blocks, maps, arch, palette, texture };
}

/** What neither the port nor Daggerfall stands, and why (bible/03-World/Beautiful-Towns.md, "Not stood in"). */
const NOT_STOOD_IN = Object.freeze({
  models: [43756, 45179, 45181, 45198, 45205, 45206, 52991, 53129, 53130, 53132, 53134, 53210, 69465],
  flats: ['10025_1', '1200_4', '1200_9', '1210_13', '1210_16', '1210_24', '1230_11', '1230_15', '1230_2', '1230_22', '1230_3', '1230_5', '1230_6', '1230_9'],
});

test('WD3 with ARENA2: every model and flat the two packs place is Daggerfall\'s own, stood in by the port, or one of the named few nothing stands (as DFU without the peers) - 2,014 models and 623 flats', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, () => {
  resetAll();
  setModSetting(DETAILED_SHIPS_VENDOR, 'Enabled', false);
  installDetailedShipsArt({ fetchBytes: async () => new Uint8Array(0) });
  installTownStandIns(() => true);
  const { blocks, maps, arch, texture } = loadArena2();
  const models = new Map(), flats = new Map();
  packPlacements(blocks, maps, (p) => {
    if (p.kind === 'model') models.set(p.id, (models.get(p.id) ?? 0) + 1);
    else { const k = `${p.archive}_${p.record}`; flats.set(k, (flats.get(k) ?? 0) + 1); }
  });
  const count = { classic: 0, standIn: 0 }, missing = [];
  for (const id of models.keys()) {
    if (customAliasFor(id) || customModelFor(id) || flatFieldFor(id)) count.standIn++;
    else if (arch.getRecordIndex(id) >= 0) count.classic++;
    else missing.push(id);
  }
  assert.deepEqual([models.size, count.classic, count.standIn], [2014, 1777, 224]);
  assert.deepEqual(missing.sort((a, b) => a - b), NOT_STOOD_IN.models);
  const fcount = { classic: 0, standIn: 0 }, fmissing = [];
  for (const k of flats.keys()) {
    const [a, r] = k.split('_').map(Number);
    if (hasTextureReplacement(a, r)) fcount.standIn++;
    else if (a <= LAST_CLASSIC_TEXTURE_ARCHIVE && texture(a) && r < texture(a).recordCount) fcount.classic++;
    else fmissing.push(k);
  }
  assert.deepEqual([flats.size, fcount.classic, fcount.standIn], [623, 503, 106]);
  assert.deepEqual(fmissing.sort(), [...NOT_STOOD_IN.flats].sort());
  // ...and every stand-in drawn from a classic record names one the player's data has
  const sources = [
    ...TOWN_BEDCLOTHS.map((r) => [90, r]), ...CLASSIC_PAINTINGS.map(([r]) => [48, r]), ...Object.values(TOWN_CLUTTER), ...Object.values(TOWN_GARDEN),
    ...Object.values(DET_FLAT_STAND_INS).flatMap((rs) => Object.values(rs)), ...Object.values(DET_TOWN_FLATS).flatMap((rs) => Object.values(rs).map(([a, r]) => [a, r])),
  ];
  for (const [a, r] of sources) assert.ok(texture(a) && r < texture(a).recordCount, `${a}_${r} is the player's`);
  for (const id of TOWN_BED_MODELS) assert.ok(arch.getRecordIndex(id) >= 0, `${id} in ARCH3D`);
  resetAll();
});

test('WD3 with ARENA2: HOUSING - every built-in piece a town\'s interior lays can be named, so its owner can take it out of the room: every flat\'s archive and record and every model\'s id fit BASE-HIDE\'s name', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, () => {
  const { blocks, maps } = loadArena2();
  const bad = new Set();
  let flats = 0, models = 0;
  packPlacements(blocks, maps, (p) => {
    if (p.side !== 'Interior') return;
    if (p.kind === 'flat') { flats++; const k = decorBaseFlatKey(9999, p.archive, p.record); if (!DECOR_BASE_KEY_RE.test(k)) bad.add(k); }
    if (p.kind === 'model') { models++; const k = decorBaseModelKey(9999, p.id); if (!DECOR_BASE_KEY_RE.test(k)) bad.add(k); }
  });
  assert.ok(flats > 50000 && models > 100000, `${flats} flats, ${models} models`);
  assert.deepEqual([...bad], [], 'a piece no name can name would be refused whole online and come back at the next load offline');
});

test('WD3 with ARENA2: no stand-in walls up a door - every exterior door of both packs\' towns, and the step in front of it, stands outside every piece the port stands in for a peer mod (AUDIT WD3 T1: the foundation under two temples)', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, () => {
  resetAll();
  installTownStandIns(() => true);
  const { blocks, maps, arch } = loadArena2();
  const G = 0.025, RD = 512 / 90;   // MeshReader.GlobalScale; Daggerfall's angle units a degree
  const doorsOf = new Map(), boxOf = new Map();
  const doors = (id) => {
    if (!doorsOf.has(id)) { const i = arch.getRecordIndex(id); doorsOf.set(id, i < 0 ? [] : (dfMeshToModel(arch.getMesh(i), () => ({ width: 64, height: 64 })).doors ?? [])); }
    return doorsOf.get(id);
  };
  const box = (id) => {
    if (!boxOf.has(id)) {
      const m = customModelFor(id);
      if (!m) boxOf.set(id, null);
      else { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[i + k]); hi[k] = Math.max(hi[k], m.positions[i + k]); } boxOf.set(id, { lo, hi }); }
    }
    return boxOf.get(id);
  };
  const at = (M, p) => [0, 1, 2].map((k) => M[k] * p[0] + M[4 + k] * p[1] + M[8 + k] * p[2] + M[12 + k]);
  const local = (M) => {   // the inverse of a TRS
    const a = [[M[0], M[4], M[8]], [M[1], M[5], M[9]], [M[2], M[6], M[10]]];
    const det = a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
    const co = (r, c) => { const m = [0, 1, 2].filter((x) => x !== r), n = [0, 1, 2].filter((x) => x !== c); return ((r + c) % 2 ? -1 : 1) * (a[m[0]][n[0]] * a[m[1]][n[1]] - a[m[0]][n[1]] * a[m[1]][n[0]]); };
    const I = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) I[c][r] = co(r, c) / det;
    return (p) => { const q = [p[0] - M[12], p[1] - M[13], p[2] - M[14]]; return [0, 1, 2].map((r) => I[r][0] * q[0] + I[r][1] * q[1] + I[r][2] * q[2]); };
  };
  const walled = [];
  let doorCount = 0;
  for (const v of ['beautiful-villages', 'beautiful-cities']) {
    const p = openWorldDataPack(JSON.parse(zlib.gunzipSync(readFileSync(join(ROOT, `vendor/${v}/WorldDataPack/${v}.pack.json.gz`))).toString()), { blocks });
    for (const name of p.names()) {
      if (!name.endsWith('.RMB.json')) continue;
      const rmb = p.rebuild(name, maps).RmbBlock;
      const ds = [], pieces = [];
      for (const [ri, sr] of rmb.SubRecords.entries()) {
        const S = trs(sr.XPos * G, 0, (4096 - sr.ZPos) * G, 0, -sr.YRotation / RD, 0);
        for (const m of sr.Exterior.Block3dObjectRecords) {
          const M = multiply(S, trs(m.XPos * G, -m.YPos * G, m.ZPos * G, -m.XRotation / RD, -m.YRotation / RD, -m.ZRotation / RD, m.XScale || 1, m.YScale || 1, m.ZScale || 1));
          for (const d of doors(m.ModelIdNum)) {
            const c = [(d.vert0.x + d.vert2.x) / 2, d.vert1.y + 1, (d.vert0.z + d.vert2.z) / 2];
            ds.push({ ri, id: m.ModelIdNum, pts: [at(M, c), at(M, [c[0] + d.normal.x, c[1], c[2] + d.normal.z])] });
          }
          if (box(m.ModelIdNum)) pieces.push({ id: m.ModelIdNum, M });
        }
      }
      for (const m of rmb.Misc3dObjectRecords) if (box(m.ModelIdNum)) pieces.push({ id: m.ModelIdNum, M: trs(m.XPos * G, (-m.YPos - 4) * G, (m.ZPos + 4096) * G, -m.XRotation / RD, -m.YRotation / RD, -m.ZRotation / RD, m.XScale || 1, m.YScale || 1, m.ZScale || 1) });
      doorCount += ds.length;
      for (const pc of pieces) {
        const b = box(pc.id), inv = local(pc.M);
        for (const d of ds) for (const pt of d.pts) if (inv(pt).every((x, i) => x > b.lo[i] + 0.02 && x < b.hi[i] - 0.02)) walled.push(`${v} ${name}: ${pc.id} at the door of record ${d.ri} (model ${d.id})`);
      }
    }
    p.release();
  }
  assert.ok(doorCount > 10000, `${doorCount} doors`);
  assert.deepEqual([...new Set(walled)], []);
  resetAll();
});

test('WD3 with ARENA2: the alias beds are built by the pipeline from the player\'s own ARCH3D - Daggerfall\'s bed, every vertex its own, its bedclothes the colour\'s recoloured pictures', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, async () => {
  resetAll();
  installTownStandIns(() => true);
  const { arch, palette, texture } = loadArena2();
  setTextureDeriveContext({ classicRgba: async (a, r) => { const t = texture(a); const bm = t?.getDFBitmap(r, 0); return bm?.width ? classicRecordRgba(bm, palette) : null; }, classicScale: async () => ({ width: 0, height: 0 }) });
  const renderer = { uploads: [], uploadTexture(a, r, c) { color32Bytes(c, 'upload'); this.uploads.push(`${a}_${r}`); }, uploadEmissionTexture() {}, createMesh: (m) => ({ mesh: m }) };
  const pipe = createDataPipeline({ renderer, arch, palette, fetch: async (n) => new Uint8Array(readFileSync(join(ARENA2, n))) });
  await preloadTextureArchive(TOWN_BED_ARCHIVE);
  for (const [id, model, colour] of [[42069, 41000, 0], [42073, 41001, 1], [42086, 41002, 5]]) {
    const gpu = await pipe.getGpuMesh(id);
    assert.ok(gpu, String(id));
    const classic = await pipe.getGpuMesh(model);
    const a = pipe.cpuModels.get(id), c = pipe.cpuModels.get(model);
    assert.deepEqual([...a.positions], [...c.positions], `${id}: Daggerfall's ${model}, vertex for vertex`);
    const want = c.subMeshes.map((s) => (s.textureArchive === 90 && TOWN_BEDCLOTHS.includes(s.textureRecord) ? [38201, colour * 3 + TOWN_BEDCLOTHS.indexOf(s.textureRecord)] : [s.textureArchive, s.textureRecord]));
    assert.deepEqual(a.subMeshes.map((s) => [s.textureArchive, s.textureRecord]), want, `${id}: its bedclothes the ${TOWN_BED_COLOURS[colour].name} ones`);
    assert.ok(a.subMeshes.some((s) => s.textureArchive === 38201), `${id}: wears them`);
    assert.ok(classic);
  }
  const blue = decodedTexture(38201, 0);
  assert.ok(blue && blue.width > 0, 'the blue cover built from TEXTURE.090 record 5');
  resetAll();
});

test('WD3 the towns\' scenery is never a person (AUDIT WD3 G1) - a street flat carries the trigger collider the ray meets only in a person archive (DaggerfallBillboard FlatTypes.NPC, RDBLayout.IsNPCFlat, the dungeons\' law); the mods\' lamps, food and animals carry faction ids and stay scenery', () => {
  const W = readFileSync(join(ROOT, 'src/scenes/worldModes.js'), 'utf8');
  assert.match(W, /if \(!pn\.width\) return;\n(?: {6}\/\/.*\n)+ {6}if \(pn\.textureArchive != null && !isNpcFlat\(pn\.textureArchive\)\) return;\n {6}targets\.push\(\{ key: `person:\$\{i\}`/);
  for (const a of [334, 346, 357, 175, 184]) assert.equal(isNpcFlat(a), true, String(a));
  for (const a of [210, 10021, 10024, 10010, 201, 1200]) assert.equal(isNpcFlat(a), false, String(a));
});

test('WD3 with ARENA2: the port\'s curation (AUDIT WD3 G2) - every one of the 274 roadside taverns laid out on Beautiful Villages\' TVRNAS00/06 stands Daggerfall\'s own block, a tavern in it; the 301 village cells laying them out stand the author\'s', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, async () => {
  const W = await import('../src/formats/worldDataReplacement.js');
  const LP = await import('../src/systems/layoutPins.js');
  const { setValue } = await import('../src/systems/settings.js');
  const { blocks, maps: _m } = loadArena2();
  W._resetWorldDataReplacement(); LP._resetLayoutPins();
  setValue('Enhancements', 'AssetInjection', 'True');
  W.installWorldDataReplacement(); W.bindWorldDataBlocks(blocks);
  for (const [v, pr] of [['beautiful-villages', 10], ['beautiful-cities', 20]]) {
    W.registerWorldDataPack(openWorldDataPack(JSON.parse(zlib.gunzipSync(readFileSync(join(ROOT, `vendor/${v}/WorldDataPack/${v}.pack.json.gz`))).toString()), { blocks }), () => true, { priority: pr });
  }
  W.quietLocationOverrides(true);
  const maps = new MapsFile(); maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
  const locOf = (k) => maps.getLocation(k % 100, Math.floor(k / 100));
  LP.configureLayoutPins({ vendorOn: () => true, gridOf: (k) => locOf(k)?.exterior?.exteriorData?.blockNames ?? null, locationTypeOf: (k) => locOf(k)?.mapTableData?.locationType ?? null });
  const log = console.log; console.log = () => {};
  let taverns = 0, withTavern = 0, villages = 0, authors = 0;
  try {
    for (let r = 0; r < maps.regionCount; r++) {
      const reg = maps.getRegion(r); if (!reg) continue;
      for (let l = 0; l < reg.locationCount; l++) {
        const loc = maps.getLocation(r, l);
        const names = loc.exterior?.exteriorData?.blockNames ?? [];
        const w = loc.exterior?.exteriorData?.width ?? 1;
        names.forEach((n, i) => {
          if (!/^TVRNAS0[06]\.RMB$/.test(n)) return;
          const name = maps.getRmbBlockName(loc, i % w, Math.floor(i / w));
          const served = W.getDFBlockReplacementData(blocks.getBlockIndex(name), name);
          const types = (served ?? blocks.getBlock(blocks.getBlockIndex(name))).rmbBlock.fldHeader.buildingDataList.map((b) => b.buildingType);
          if (loc.mapTableData.locationType === 6) { taverns++; if (!served && types.includes(15)) withTavern++; } else { villages++; if (served) authors++; }
        });
      }
    }
  } finally { console.log = log; }
  assert.deepEqual([taverns, withTavern, villages, authors], [274, 274, 301, 301]);
  W._resetWorldDataReplacement(); LP._resetLayoutPins();
});

test('WD3 a stand-in\'s clear placeholder is never its key\'s for good (AUDIT WD3 T3) - a picture asked under the key later (a fetch that failed, then landed) takes its place; a real picture is kept as ever, and a placeholder never displaces one', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  let made = 0, deleted = 0;
  const gl = new Proxy({}, { get: (_, k) => (k === 'createTexture' ? () => ({ id: ++made }) : k === 'deleteTexture' ? () => { deleted++; } : typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 1 : () => {}) });
  const r = Object.create(Renderer.prototype);
  Object.assign(r, { gl, textures: new Map(), _texKeysByBase: new Map(), _replacements: new Set(), _placeholders: new Set(), _texGen: 0, _retroMips: false });
  const clear = { width: 1, height: 1, colors: new Uint8ClampedArray(4) };
  const real = { width: 2, height: 2, colors: new Uint8ClampedArray(16) };
  const a = r.uploadTexture(1210, 13, clear, { opaque: true, replacement: true, placeholder: true });
  assert.equal(r.uploadTexture(1210, 13, clear, { opaque: true, replacement: true, placeholder: true }), a, 'a placeholder asked again is the same');
  const b = r.uploadTexture(1210, 13, real, { opaque: true, replacement: true });
  assert.notEqual(b, a, 'the picture takes its place');
  assert.equal(deleted, 1, 'the placeholder freed');
  assert.equal(r.uploadTexture(1210, 13, clear, { opaque: true, replacement: true, placeholder: true }), b, 'never displaced again');
  assert.equal(r.uploadTexture(1210, 13, real, { opaque: true, replacement: true }), b, 'a real picture kept as ever');
});

test('WD3 the town stand-ins YIELD to the player\'s own picture of the record (AUDIT WD3 T2) - a loose file or an attached mod (the real DET or RMB Resource Pack the stand-in only stands in for) answers first, with Replace Game Artwork on; without one, or with it off, the stand-in answers as before; a stand-in that does not yield (another mod\'s own art) keeps its place', async () => {
  const TR = await import('../src/systems/textureReplacement.js');
  const { setValue } = await import('../src/systems/settings.js');
  clearVendorTextures(); TR.setTextureReplacements([], null); TR.setBundleTextures([]);
  setValue('Enhancements', 'AssetInjection', 'True');
  setTextureDeriveContext({ classicRgba: async () => null, classicScale: async () => ({ width: 0, height: 0 }) });
  const pic = (w) => ({ width: w, height: 1, data: new Uint8ClampedArray(w * 4) });
  addVendorTextures([
    { archive: 10021, record: 3, fileName: 'stand-in', standIn: true, yields: true, build: async () => pic(2) },
    { archive: 1210, record: 10, fileName: 'ds-own', standIn: true, build: async () => pic(3) },
  ]);
  assert.equal((await TR.preloadTextureRecord(10021, 3))?.width, 2, 'the stand-in, with no pick of the player\'s');
  TR.setBundleTextures([{ archive: 10021, record: 3, fileName: 'det.dfmod:10021_3-0', image: async () => pic(5) }, { archive: 1210, record: 10, fileName: 'x.dfmod:1210_10-0', image: async () => pic(7) }]);
  assert.equal((await TR.preloadTextureRecord(10021, 3))?.width, 5, 'the attached mod\'s own picture answers first');
  assert.equal((await TR.preloadTextureRecord(1210, 10))?.width, 3, 'a stand-in that does not yield keeps its place');
  setValue('Enhancements', 'AssetInjection', 'False');
  assert.equal(TR.hasTextureReplacement(10021, 3), true, 'with Replace Game Artwork off the stand-in answers again');
  setValue('Enhancements', 'AssetInjection', 'True');
  TR.setBundleTextures([]); clearVendorTextures();
  assert.match(readFileSync(join(ROOT, 'src/world/detStandIns.js'), 'utf8'), /return addVendorTextures\(entries\.map\(\(e\) => \(\{ \.\.\.e, yields: true \}\)\)\);/);
  assert.match(readFileSync(join(ROOT, 'src/world/townStandIns.js'), 'utf8'), /n \+= addVendorTextures\(cloths\.map\(\(e\) => \(\{ \.\.\.e, yields: true \}\)\)\);/);
});
