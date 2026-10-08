// THUNDERLOCK-ART (2026-10-07, AUDIT SD III's companion; bible/05-Combat/Dwarven-Thunderlock.md "THUNDERLOCK-ART"; Mac:
// "overhauling the thunderlock in general including the morrowinds gun model ... The thunderlock/ammo also doesnt
// recieve proper artwork in slots like the hotbar or inventory"). The laws pinned:
//   - A STAND-IN TAKES NO DYE: the port's own art is one truecolor picture with no dyed forms, so a record registered
//     undyed as a stand-in answers every dye with itself - the reason every slot drew the gun's initials; a dyed set
//     still answers by its dyes alone, and one record of a real archive is untouched.
//   - THE GUN'S PICTURES BY JOB: a list draws the WHOLE gun (record 1), the doll its own layer (record 0), through the
//     one door each asks; a classic weapon is DFU's ladder as before.
//   - THE PICTURES ARE DERIVED: tools/gunIcons.mjs over the committed doll layer IS the committed PNGs, pixel for pixel;
//     the healed gun is one piece where the doll layer is two; the gold keeps every alpha. The pellet is Mac's own
//     12px ball, untouched - its slots failed on the dye, never on the picture.
//   - THE MESH IS CLOSED: tools/meshCap.mjs caps every hole so its winding agrees with the faces round it; the shipped
//     gun and its gold twin have no boundary left.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addVendorTextures, clearVendorTextures, hasTextureReplacement, vendorRecordCount, isVendorArchive, textureReplacementRect,
} from '../src/systems/textureReplacement.js';
import { DYE_COLORS } from '../src/characters/dyes.js';
import {
  createThunderlock, createPellets, installThunderlockIcons, ICON_FILES, ART_RECORDS, ART, PAPERDOLL_OFFSET,
} from '../src/systems/thunderlock.js';
import { inventoryItemImage, ownItemImage } from '../src/systems/itemTemplates.js';
import { itemDyeColor } from '../src/systems/itemDye.js';
import { paperdollItemImage } from '../src/ui/paperDoll.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { readPng } from '../tools/pngIO.mjs';
import { gunIcons, parts, gild, SOURCE, OUT } from '../tools/gunIcons.mjs';
import { mintHourlock } from '../src/systems/gilded.js';
import { setHotbarSlot, hotbarEntryForItem, hotbarView, clearHotbar } from '../src/systems/quickslots.js';
import { equipItem } from '../src/systems/equip.js';
import { boundaryLoops, capHoles } from '../tools/meshCap.mjs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';

const bytesOf = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const png = (p) => readPng(bytesOf(p));
const fake = async () => new Uint8Array([1]);

test('THUNDERLOCK-ART A STAND-IN TAKES NO DYE: a record registered undyed as a stand-in answers any dye with itself - the gun asked by its Dwarven dye, its pellet by Iron, both answer; a dyed set answers by its own dyes alone; one record of a real archive asked by a dye is the classic\'s, as before (mutants: the dye kept; every record undyed)', () => {
  clearVendorTextures();
  try {
    addVendorTextures([{ archive: 9301, record: 0, load: fake, standIn: true }]);
    assert.equal(hasTextureReplacement(9301, 0, 0, 'Albedo', DYE_COLORS.Iron), true, 'asked by Iron: itself');
    assert.equal(hasTextureReplacement(9301, 0, 0, 'Albedo', 'Daedric'), true, 'by a name too');
    assert.equal(hasTextureReplacement(9301, 0, 0, 'Albedo', null), true, 'and by none');
    addVendorTextures([{ archive: 9302, record: 0, dye: 'Iron', load: fake, standIn: true }, { archive: 9302, record: 0, load: fake, standIn: true }]);
    assert.equal(hasTextureReplacement(9302, 0, 0, 'Albedo', 'Iron'), true);
    assert.equal(hasTextureReplacement(9302, 0, 0, 'Albedo', 'Steel'), false, 'a dyed set answers by its dyes alone');
    addVendorTextures([{ archive: 50, record: 7, load: fake }]);
    assert.equal(hasTextureReplacement(50, 7, 0, 'Albedo', null), true);
    assert.equal(hasTextureReplacement(50, 7, 0, 'Albedo', 'Iron'), false, 'one record of a real archive: no stand-in, no change');
    // the gun and its pellet, through the doors the slots ask
    clearVendorTextures();
    assert.equal(installThunderlockIcons({ fetchBytes: fake }), ICON_FILES.length);
    const gun = createThunderlock(), pellets = createPellets(10);
    for (const it of [gun, pellets]) {
      const img = inventoryItemImage(it);
      assert.ok(img.dye != null && img.dye !== DYE_COLORS.Unchanged, `${it.templateIndex}: asked by a dye (${img.dye})`);
      assert.equal(hasTextureReplacement(img.archive, img.record, 0, 'Albedo', img.dye), true, `${it.templateIndex}: and answered - never the initials`);
    }
    const doll = paperdollItemImage({ ...gun, equipSlot: 1 });
    assert.equal(hasTextureReplacement(doll.archive, doll.record, 0, 'Albedo', doll.dye), true, 'the doll\'s ask too');
    assert.deepEqual(textureReplacementRect(doll.archive, doll.record, 0, 'Albedo', doll.dye), null, 'a vendored record has no bundle rect');
  } finally { clearVendorTextures(); }
});

test('THUNDERLOCK-ART THE GUN\'S PICTURES BY JOB: five registered stand-ins (the doll layer, the whole gun, their gold twins, the pellets\' heap), each archive the art\'s own; a list draws record 1 and the doll record 0, through the one door each asks; a hotbar slot of shot its count and no wear bar; a classic weapon\'s ask is DFU\'s ladder (mutants: the doll layer in a list; the doll\'s own door bypassed; a bar under the shot\'s count)', () => {
  clearVendorTextures();
  try {
    installThunderlockIcons({ fetchBytes: fake });
    assert.deepEqual(ICON_FILES.map((f) => [f.archive, f.record, f.file]), [
      [ART.weaponArchive, 0, 'gun-paperdoll.png'], [ART.weaponArchive, 1, 'gun-icon.png'],
      [ART.weaponArchive, 2, 'gun-paperdoll-gilded.png'], [ART.weaponArchive, 3, 'gun-icon-gilded.png'], [ART.ammoArchive, 0, 'gun-ammo.png'],
    ]);
    assert.deepEqual(ICON_FILES.filter((f) => f.offset).map((f) => f.record), [ART_RECORDS.doll, ART_RECORDS.gildedDoll], 'a doll layer carries its place on the doll');
    for (const f of ICON_FILES.filter((x) => x.offset)) assert.equal(f.offset, PAPERDOLL_OFFSET);
    assert.equal(vendorRecordCount(ART.weaponArchive), 4);
    assert.equal(vendorRecordCount(ART.ammoArchive), 1);
    assert.ok(isVendorArchive(ART.weaponArchive) && isVendorArchive(ART.ammoArchive), 'archives that exist only as this art');
    const gun = createThunderlock();
    assert.deepEqual([inventoryItemImage(gun).archive, inventoryItemImage(gun).record], [ART.weaponArchive, ART_RECORDS.icon], 'a list: the whole gun');
    assert.equal(inventoryItemImage(gun).dye, itemDyeColor(gun));
    assert.deepEqual([paperdollItemImage({ ...gun, equipSlot: 1 }).archive, paperdollItemImage({ ...gun, equipSlot: 1 }).record], [ART.weaponArchive, ART_RECORDS.doll], 'the doll: its layer');
    assert.deepEqual([paperdollItemImage({ ...mintHourlock(), equipSlot: 1 }).archive, paperdollItemImage({ ...mintHourlock(), equipSlot: 1 }).record], [ART.weaponArchive, ART_RECORDS.gildedDoll], 'the Hourlock\'s gold layer - the own door\'s, which the template\'s record could never name');
    assert.deepEqual(ownItemImage(gun), { archive: ART.weaponArchive, record: ART_RECORDS.icon });
    const pellets = createPellets(5);
    assert.deepEqual([inventoryItemImage(pellets).archive, inventoryItemImage(pellets).record], [ART.ammoArchive, 0]);
    assert.equal(ownItemImage(pellets), null, 'the pellet\'s one picture is its template\'s own');
    // the hotbar: a stack of shot shows its count and no wear bar - the pack's own law ("an arrow is spent, not worn");
    // the gun beside it shows its wear
    const me = { isPlayer: true, items: [gun, pellets], spells: [], equip: null };
    equipItem(me, gun);
    clearHotbar();
    try {
      setHotbarSlot(0, hotbarEntryForItem(gun)); setHotbarSlot(1, hotbarEntryForItem(pellets));
      const [g, p] = hotbarView(me);
      assert.ok(Number.isFinite(g.condition), 'the gun wears');
      assert.deepEqual([p.count, p.condition], [5, null], 'the pellets: their count, no bar under it');
    } finally { clearHotbar(); }
    const sword = createWeapon(120, 1);
    assert.equal(ownItemImage(sword), null);
    assert.notEqual(inventoryItemImage(sword).archive, ART.weaponArchive, 'a classic weapon: DFU\'s ladder');
  } finally { clearVendorTextures(); }
});

test('THUNDERLOCK-ART THE PICTURES ARE DERIVED: tools/gunIcons.mjs over the committed doll layer is the committed PNGs pixel for pixel; the doll layer is a gun in two (the fist\'s gap), its list picture one piece; the gold twins keep every alpha and lean gold; the pellet left Mac\'s 12px ball (mutants: the gap left; the gold\'s alpha)', () => {
  const doll = png(SOURCE);
  const r = gunIcons(doll);
  for (const [k, path] of Object.entries(OUT)) {
    const disk = png(path);
    assert.deepEqual([disk.width, disk.height], [r[k].width, r[k].height], `${path}: its size`);
    assert.ok(Buffer.from(disk.data).equals(Buffer.from(r[k].data)), `${path} is not what tools/gunIcons.mjs makes from ${SOURCE} - re-run it`);
  }
  assert.ok(parts(doll).length >= 2, 'the doll layer: the gun broken by the fist\'s gap');
  assert.equal(parts(r.icon).length, 1, 'the list picture: one gun');
  for (const [gold, plain] of [[r.iconGilded, r.icon], [r.dollGilded, doll]]) {
    assert.deepEqual([gold.width, gold.height], [plain.width, plain.height]);
    let lean = 0, n = 0;
    for (let i = 0; i < plain.width * plain.height; i++) {
      assert.equal(gold.data[i * 4 + 3], plain.data[i * 4 + 3], 'every alpha kept');
      if (plain.data[i * 4 + 3] > 40) { lean += gold.data[i * 4 + 1] - gold.data[i * 4 + 2]; n++; }
    }
    assert.ok(lean / n > 40, `gold leans yellow over blue (${(lean / n).toFixed(1)})`);
  }
  const soft = { width: 2, height: 1, data: Uint8ClampedArray.from([200, 150, 80, 128, 100, 80, 40, 255]) };
  assert.deepEqual([...gild(soft).data].filter((_, i) => i % 4 === 3), [128, 255], 'a soft edge stays soft');
  // the pellet is Mac's own 12px ball, at Mac's own size (FIELD-GUN16/18 - gunLab.test.js pins it): no tool redraws it
  assert.equal(Object.values(OUT).includes('public/art/gun-ammo.png'), false);
  assert.deepEqual([png('public/art/gun-ammo.png').width, png('public/art/gun-ammo.png').height], [12, 12]);
});

/** A unit cube with its top (+z) face missing: five faces, outward-wound. */
function openCube() {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const o = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  quad([0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]);   // bottom, -z
  quad([0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]);   // -y
  quad([1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]);   // +x
  quad([1, 1, 0], [0, 1, 0], [0, 1, 1], [1, 1, 1]);   // +y
  quad([0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]);   // -x
  return { positions: P, normals: P.map(() => 0), uvs: new Array((P.length / 3) * 2).fill(0), indices: I };
}

test('THUNDERLOCK-ART THE MESH IS CLOSED: a hole is walked as its own faces run and capped from its centroid with each edge taken back, so the cap faces OUT (an open cube\'s missing top is capped facing +z) and is a hard edge of its own; the shipped gun and its gold twin have no boundary left (mutants: the cap wound in; a loop left open)', () => {
  const cube = openCube();
  const loops = boundaryLoops(cube);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 4);
  const capped = capHoles(cube);
  assert.deepEqual(capped.bake.capped, { loops: 1, triangles: 4 });
  assert.deepEqual(boundaryLoops(capped), [], 'closed');
  const at = cube.positions.length / 3;   // the cap's centroid, then its loop
  assert.deepEqual(capped.positions.slice(at * 3, at * 3 + 3), [0.5, 0.5, 1], 'the fan from the hole\'s centre');
  assert.deepEqual(capped.normals.slice(at * 3, at * 3 + 3), [0, 0, 1], 'its one flat normal, facing out of the hole');
  for (let t = cube.indices.length; t < capped.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => capped.indices[t + k]).map((v) => capped.positions.slice(v * 3, v * 3 + 3));
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    assert.ok(u[0] * w[1] - u[1] * w[0] > 0, 'each cap triangle wound out (+z), as the faces round it are');
  }
  assert.equal(capped.uvs.length / 2, capped.positions.length / 3, 'a uv a vertex, for the unwrap after');
  assert.equal(capHoles(capped).bake.capped.loops, 0, 'a closed mesh: nothing to do');
  for (const file of ['src/assets/mw/meshes/thunderlock.nif', 'src/assets/mw/meshes/thunderlock_gilded.nif']) {
    const b = flattenNif(parseNif(bytesOf(file)))[0];
    assert.deepEqual(boundaryLoops({ positions: [...b.positions], indices: [...b.indices] }), [], `${file}: no hole an eye can see through`);
  }
});
