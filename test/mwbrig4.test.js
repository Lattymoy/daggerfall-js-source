// MW-BRIG4 (2026-10-09, Mac: "Also for the integrated brigadine chest piece, we need each of these textures
// implemented", nine paintings of the brigandine's unwrap; asked which metal wears which, he took the map offered - one
// per metal): EVERY METAL OF THE BRIGANDINE JERKIN WEARS THE BRIGANDINE, IN ITS OWN PAINTING.
//
// Roleplay & Realism Items' Jerkin is a Brigandine in every plate material, Iron to Daedric (rriItems.js lightWord);
// MW-BRIG1 dressed the Steel one alone. The one mesh is baked once and written once per metal, each NIF naming its
// metal's DDS, and each metal's row carries the Steel row's skin and fit. These pins hold the table to the mod's own
// word both ways, every metal's files to the bake byte for byte, and each painting to the metal Mac's map gave it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { decodeTextureImage } from '../src/formats/mwTexture.js';
import { composeWornArmor } from '../src/formats/mwItemMap.js';
import { collectArmTextures } from '../src/combat/fpArm.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { rriVariantWord } from '../src/systems/rriItems.js';
import { BRIGANDINE_METALS, OWN_MW_ARMOR, RRI_JERKIN_TEMPLATE, ownArmorModelFor, ownArmorModelPaths } from '../src/characters/ownArmorModels.js';
import { readPng } from '../tools/pngIO.mjs';
import { SOURCE_FBX, PAINTING, outFor, textureNameFor, bakeBrigandineMetals } from '../tools/bakeBrigandine.mjs';

const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const onDisk = (p) => new Uint8Array(raw(p));
const sha = (p) => createHash('sha256').update(raw(p)).digest('hex');
const jerkin = (material, message = 0) => ({ templateIndex: RRI_JERKIN_TEMPLATE, material, message });

test('MW-BRIG4: every metal the Jerkin is a brigandine in wears the brigandine, in its own painting - Iron to Daedric; the leather and the fur keep retail\'s cuirass', () => {
  assert.deepEqual(BRIGANDINE_METALS, ['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);
  // the table is the mod's own word, both ways: a jerkin wears the brigandine exactly when its name says Brigandine
  for (const [name, m] of Object.entries(ARMOR_MATERIAL)) {
    for (const message of [0, 1]) {
      const own = ownArmorModelFor(jerkin(m, message));
      assert.equal(Boolean(own), rriVariantWord(jerkin(m, message)) === 'Brigandine ', `${name} jerkin (message ${message})`);
    }
  }
  const steel = OWN_MW_ARMOR.find((a) => a.id === 'daggerfall_brigandine_steel');
  for (const metal of BRIGANDINE_METALS) {
    const own = ownArmorModelFor(jerkin(ARMOR_MATERIAL[metal]));
    const m = metal.toLowerCase();
    assert.deepEqual([own.id, own.name, own.material], [`daggerfall_brigandine_${m}`, `${metal} Brigandine`, ARMOR_MATERIAL[metal]]);
    // the one piece, skinned and fitted as the Steel one is (MW-BRIG2, MW-BRIG3)
    assert.deepEqual([...own.skinFrom], [...steel.skinFrom]);
    assert.deepEqual([...own.skinFrom], ['chest', 'groin', 'upperleg', 'knee']);
    assert.equal(own.fitTo, 'chest');
    const worn = composeWornArmor({ pieces: [jerkin(ARMOR_MATERIAL[metal])], armors: [], bodyPool: [] });
    assert.deepEqual(worn.notes, []);
    assert.deepEqual(worn.adds.map((a) => [a.partName, a.bones.join(), a.model, [...a.skinFrom].join(), a.fitTo]), [['cuirass', 'chest', `brigandine_${m}.nif`, 'chest,groin,upperleg,knee', 'chest']]);
    assert.deepEqual(worn.shadows, ['chest']);
    assert.ok(ownArmorModelPaths().includes(`meshes/brigandine_${m}.nif`), `the ${metal} brigandine's mesh is one the table asks for`);
  }
  assert.equal(ownArmorModelFor(jerkin(ARMOR_MATERIAL.Leather)), null, 'the leather jerkin keeps retail\'s');
  assert.equal(ownArmorModelFor(jerkin(ARMOR_MATERIAL.Leather, 1)), null, 'the fur jerkin keeps retail\'s');
});

test('MW-BRIG4: each metal\'s files are re-made from the committed sources byte for byte - the one mesh ten times, each naming its own painting, each DDS that painting; the paintings the ones Mac\'s map gave each metal', () => {
  const pngs = Object.fromEntries(Object.entries(PAINTING).map(([m, p]) => [m, raw(p)]));
  const baked = bakeBrigandineMetals(raw(SOURCE_FBX), pngs);
  assert.deepEqual(baked.metals.map((x) => x.metal), BRIGANDINE_METALS);
  const steel = flattenNif(parseNif(onDisk(outFor('Steel').mesh)));
  for (const x of baked.metals) {
    const out = outFor(x.metal);
    assert.equal(Buffer.compare(Buffer.from(x.nif), raw(out.mesh)), 0, `${out.mesh} is not what tools/bakeBrigandine.mjs makes - re-run it`);
    assert.equal(Buffer.compare(Buffer.from(x.dds), raw(out.texture)), 0, `${out.texture} is not what tools/bakeBrigandine.mjs makes`);
    const batches = flattenNif(parseNif(onDisk(out.mesh)));
    assert.equal(batches.length, 1);
    assert.equal(batches[0].material.textureFile, textureNameFor(x.metal), `${x.metal}: the NIF names its own painting`);
    assert.equal(batches[0].material.twoSided, true);
    for (const k of ['positions', 'uvs', 'indices']) assert.deepEqual(Array.from(batches[0][k]), Array.from(steel[0][k]), `${x.metal}: the Steel brigandine's ${k}`);
    // the texture resolves through the lane's own ladder, and the DDS is the painting
    const files = new Map([[`textures/${textureNameFor(x.metal)}`, onDisk(out.texture)]]);
    const entry = collectArmTextures(batches, [{ has: (p) => files.has(p), get: (p) => files.get(p) }]).get(textureNameFor(x.metal));
    assert.ok(entry?.ok, entry?.error);
    assert.deepEqual(Array.from(decodeTextureImage(out.texture, onDisk(out.texture)).mips[0].rgba), Array.from(readPng(raw(PAINTING[x.metal])).data), `${x.metal}: the DDS is the painting`);
    // its material named for its metal (AUDIT MW-BRIG4: every one said Steel)
    const mat = parseNif(onDisk(out.mesh)).records.find((r) => r?.type === 'NiMaterialProperty');
    assert.equal(mat.name, `${x.metal} BrigandineMaterial`);
  }
  // Mac's nine, as he sent them, each under the metal the map gave it (in the order attached: 1 Iron, 2 Adamantium,
  // 3 Mithril, 4 Daedric, 5 Orcish, 6 Elven, 7 Silver, 8 Ebony, 9 Dwarven); Steel's is MW-BRIG1's
  assert.deepEqual(Object.fromEntries(BRIGANDINE_METALS.map((m) => [m, sha(PAINTING[m])])), {
    Iron: 'cfdec61fadf5bbf002026404b9931969e68f0889d5faa14234fbf578e1c728b5',
    Steel: 'cde8d2b8870dbb35833329e39d43ac7914f45d60dbf1791309f81cc44159a51c',
    Silver: '9b0ea9a5c628a89641b0ac3f062bd5250610b9e61849df5a16ea4280093e6cfd',
    Elven: 'd7ce9642a12da3e2acc2bb829021ba4b95e8103a5ed49815d8e8c32b37960083',
    Dwarven: '389272cb60eb5bfe3c46c4759f31ec058c156c8418e8b3d8ea059dcfe1eba793',
    Mithril: 'a0650ce4be8212e136d6caf3e5c8d781bc9d838e6583404bc2438995b82375f4',
    Adamantium: 'c720a66f15843f9c261ebb1661507f276dcdc1dbb542ba640f9799dd0b72e147',
    Ebony: 'ba177a93fdad88520479f3fdfb93f3aac290a787fc313340dce7e82672423587',
    Orcish: 'aca5e4a0e760f4f5db2757fe54994dbf7f70b3374d4f2569ddd7725da819abdc',
    Daedric: 'ffafa117bcb22f98522e84b8c89f821c50ae672ade5892a29609341ff1feb772',
  });
  for (const m of BRIGANDINE_METALS) {
    const png = readPng(raw(PAINTING[m]));
    assert.deepEqual([png.width, png.height], m === 'Steel' ? [128, 128] : [256, 256], `${m}'s painting at its own size`);
  }
  assert.throws(() => bakeBrigandineMetals(raw(SOURCE_FBX), { ...pngs, Orcish: undefined }), /no painting for the Orcish brigandine \(src\/assets\/mw\/source\/Brigandine_Orcish\.png\)/);
});
