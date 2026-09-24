// FIELD-GUN-MW2: THE PORT'S OWN WEAPON IN THE MORROWIND ARM, PINNED.
//
// The defect: in Morrowind first person the Dwarven Thunderlock drew
// EMPTY HANDS, and the port said so in as many words - `weapon:
// Morrowind has no weapon type for what you are holding` - because the
// lane resolves every mesh out of the player's own install and
// Morrowind has no firearm.
//
// The fix ships a real Morrowind NIF and a real DDS, baked from Mac's
// Blender export, and mounts them in the archive list. So these pins
// drive THE SHIPPED BYTES through THE PORT'S OWN READERS, end to end:
// `parseNif` parses the file that is committed, `flattenNif` flattens
// it, `bindPart` binds it to a fixture skeleton's weapon bone, and
// `collectArmTextures` decodes the texture through rule 36's own path
// ladder. Nothing here is a fixture standing in for the asset - if the
// committed file is wrong, this reddens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif, MW_NIF_VERSION } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { buildSkeleton } from '../src/formats/mwSkin.js';
import { bindPart } from '../src/formats/mwCharacter.js';
import { resolveWeaponParts, weaponPartPaths, archiveHas, collectArmTextures } from '../src/combat/fpArm.js';
import {
  dfWeaponToMw, MW_WEAPON_TYPE, MW_UNITS_PER_METER,
  composeWeaponGroup, shootsRatherThanSwings, reloadsItself, ammoTypeFor,
} from '../src/formats/mwFirstPerson.js';
import { animWeaponType } from '../src/combat/fpArm.js';
import { MW_UNITS_PER_METRE, THUNDERLOCK_METRES, SETTINGS, OUT, SOURCE_FBX, bakeThunderlock } from '../tools/bakeThunderlock.mjs';
import { WEAPONS } from '../src/characters/weapons.js';
import { THUNDERLOCK_TEMPLATE } from '../src/characters/thunderlockIds.js';
import { OWN_MW_MODELS, ownWeaponModelFor, ownWeaponModelPaths } from '../src/characters/ownWeaponModels.js';
import { ownMwDataPath, ownMwArchive } from '../src/systems/ownMwAssets.js';
import { makeVendoredArchive } from '../src/systems/urlArchive.js';

const source = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const fixture = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const shipped = (p) => new Uint8Array(readFileSync(new URL(`../src/assets/mw/${p}`, import.meta.url)));

/** The archive the game mounts, built here out of the committed files
 *  rather than out of anything this test invented. */
function shippedArchive() {
  const files = new Map();
  for (const own of Object.values(OWN_MW_MODELS)) files.set(`meshes/${own.model}`, shipped(`meshes/${own.model}`));
  files.set('textures/thunderlock.dds', shipped('textures/thunderlock.dds'));
  return { has: (p) => files.has(p), get: (p) => files.get(p) };
}
const GUN = { templateIndex: THUNDERLOCK_TEMPLATE };

test('FIELD-GUN-MW2: the defect is real - Morrowind has no type, and no record, for this weapon', () => {
  // The pin is the CAUSE, not the symptom, so it keeps meaning
  // something after the fix: the day somebody adds the Thunderlock to
  // DFU's frozen table (which would be wrong for other reasons) this
  // says the own-model door is no longer the thing keeping it drawn.
  assert.equal(dfWeaponToMw(GUN, WEAPONS), MW_WEAPON_TYPE.None,
    'template 560 is minted at runtime and is not in DFU\'s frozen WEAPONS');
  assert.equal(Object.values(WEAPONS).includes(THUNDERLOCK_TEMPLATE), false);
});

test('FIELD-GUN-MW2: the SHIPPED nif parses with the port\'s own reader, and flattens two-sided', () => {
  const bytes = shipped('meshes/thunderlock.nif');
  const nif = parseNif(bytes);
  assert.equal(nif.version, MW_NIF_VERSION, 'Morrowind 4.0.0.2, the only version this reader takes');
  assert.deepEqual(nif.roots, [0]);
  // A 4.0.0.2 stream carries NO record sizes, so the reader's own
  // trailing-byte check is the writer's proof: one byte wrong anywhere
  // and parseNif either throws mid-record or refuses the footer. That
  // this call returned at all is most of the assertion.
  assert.equal(nif.records[0].type, 'NiNode');

  const batches = flattenNif(nif);
  assert.equal(batches.length, 1, 'one shape');
  const b = batches[0];
  assert.equal(b.skinned, false, 'a rigid part: it hangs on a bone, it is not skinned to a rig');
  assert.ok(b.positions.length / 3 > 100 && b.indices.length / 3 > 100, 'it carries real geometry');
  assert.equal(b.indices.length % 3, 0, 'a triangle list');
  assert.equal(Math.max(...b.indices) < b.positions.length / 3, true, 'every index is in range');
  assert.ok(b.uvs && b.uvs.length / 2 === b.positions.length / 3, 'one uv per vertex');
  assert.ok(b.normals && b.normals.length === b.positions.length, 'one normal per vertex');
  // RULE 65's only two-sided value, and it is not decoration: the mesh
  // is an open shell (65 of its edges are shared by a single face), so
  // with backface culling the player sees through it.
  assert.equal(b.material.twoSided, true, 'DrawMode Both - the model is an open shell');
  assert.equal(b.material.textureFile, 'thunderlock.dds');
  // White, because the TEXTURE carries the colour. A tint here would be
  // a second place to change it.
  assert.deepEqual(b.material.diffuse, [1, 1, 1]);
  assert.equal(b.material.alphaBlend, false, 'opaque - a weapon is not a decal');
});

test('FIELD-GUN-MW2: the shipped unwrap does not overlap, which the FBX\'s own did', () => {
  // The finding this whole slice turns on, asked of the COMMITTED file
  // rather than of an intermediate: Mac's export carried Blender's
  // factory cylinder UVs - 45 distinct coordinates, the atlas covered
  // 8.49 times over - so every part of the gun sampled the same pixels
  // and no texture could ever distinguish barrel from grip.
  const b = flattenNif(parseNif(shipped('meshes/thunderlock.nif')))[0];
  let coverage = 0;
  for (let t = 0; t < b.indices.length; t += 3) {
    const p = [0, 1, 2].map((k) => [b.uvs[b.indices[t + k] * 2], b.uvs[b.indices[t + k] * 2 + 1]]);
    coverage += Math.abs((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1])) / 2;
  }
  // 1.0 is an atlas filled exactly once. Above 1.3 means islands are
  // stacked; the factory unwrap scored 8.49.
  assert.ok(coverage > 0.2 && coverage < 1.3,
    `the islands overlap: the triangles' UV areas total ${coverage.toFixed(2)}`);
  const distinct = new Set();
  for (let i = 0; i < b.uvs.length; i += 2) distinct.add(`${b.uvs[i].toFixed(4)},${b.uvs[i + 1].toFixed(4)}`);
  assert.ok(distinct.size > b.positions.length / 3 / 2,
    `${distinct.size} distinct UVs over ${b.positions.length / 3} vertices - the factory mapping had 45`);
  for (let i = 0; i < b.uvs.length; i++) {
    assert.ok(b.uvs[i] >= -1e-6 && b.uvs[i] <= 1 + 1e-6, 'every UV is inside the atlas');
  }
});

test('FIELD-GUN-MW2: the resolve hands the arm a weapon part, on a bone the skeleton has', () => {
  const arc = shippedArchive();
  const find = (p) => (arc.has(p) ? arc : null);
  const res = resolveWeaponParts({
    weapon: GUN, hasAmmo: true, allWeapons: [], find,
    skeletonBytes: fixture('armfp.nif'), has: archiveHas([arc]),
  });
  assert.deepEqual(res.notes, [], `the resolve complained: ${res.notes.join('; ')}`);
  const weapon = res.parts.filter((p) => p.slot === 'weapon');
  assert.equal(weapon.length, 1, 'exactly one weapon part - the arm drew NOTHING before this');
  assert.deepEqual(weapon[0].bones, ['Weapon Bone'],
    'the reference\'s own untyped fallback (MW-D32), which every rig carries');
  assert.ok(res.weaponInfo && res.weaponInfo.own === true, 'the card says it is the port\'s own');
  assert.equal(res.weaponInfo.name, 'Dwarven Thunderlock');
  // AND NO ARROW. It spends ammunition, but Morrowind has no record to
  // instance on the arrow bone, and `hasAmmo: true` above is what makes
  // this a question rather than a coincidence.
  assert.equal(res.arrowInfo, null);
  assert.equal(res.parts.filter((p) => p.slot === 'arrow').length, 0);
});

test('FIELD-GUN-MW2: the preload names exactly what the read opens', () => {
  // MW-LOAD's standing law: a synchronous read is preceded by the load
  // that brings its bytes in, and a path the preload misses is a defect
  // in fpArm.js that `findLoaded` names at runtime. Two doors, one
  // question - so they are asked together.
  const arc = shippedArchive();
  const paths = weaponPartPaths({ weapon: GUN, hasAmmo: true, allWeapons: [], has: archiveHas([arc]) });
  const res = resolveWeaponParts({
    weapon: GUN, hasAmmo: true, allWeapons: [], find: (p) => (arc.has(p) ? arc : null),
    skeletonBytes: fixture('armfp.nif'), has: archiveHas([arc]),
  });
  assert.deepEqual(paths, ownWeaponModelPaths(), 'the preload asks the table, not a second copy of it');
  assert.equal(paths.length, res.parts.length, 'one path preloaded per part read');
  for (const p of paths) assert.ok(arc.has(p), `${p} is not in the shipped archive`);
});

test('FIELD-GUN-MW2: it BINDS - the shipped mesh reaches the arm\'s weapon bone', () => {
  const arc = shippedArchive();
  const res = resolveWeaponParts({
    weapon: GUN, allWeapons: [], find: (p) => (arc.has(p) ? arc : null),
    skeletonBytes: fixture('armfp.nif'), has: archiveHas([arc]),
  });
  const skeleton = buildSkeleton(parseNif(fixture('armfp.nif')));
  const part = res.parts[0];
  const bound = bindPart(skeleton, parseNif(part.bytes), { attachBone: part.bones[0] });
  assert.equal(bound.attached.length, 1, 'one rigid batch');
  assert.equal(bound.skinned.length, 0, 'nothing skinned - there are no bones in this mesh');
  assert.deepEqual(bound.missingBones, []);
  assert.ok(bound.attachRef >= 0, 'the attach node resolved on the real skeleton');
  assert.equal(bound.attached[0].material.twoSided, true, 'the open shell stays two-sided through the bind');
});

test('FIELD-GUN-MW2: the texture resolves through rule 36\'s own ladder, and is not the magenta warning', () => {
  const arc = shippedArchive();
  const b = flattenNif(parseNif(shipped('meshes/thunderlock.nif')))[0];
  const textures = collectArmTextures([b], [arc]);
  const entry = textures.get('thunderlock.dds');
  assert.ok(entry, 'the collector was asked for it at all');
  // `ok: false` is the 8x8 magenta warning image - a texture the
  // archives do not carry - which is EXACTLY what this asset was before
  // it shipped, and looks like a bug in the model rather than a
  // missing file.
  assert.equal(entry.ok, true, `the texture did not decode: ${entry.error}`);
  assert.equal(entry.path, 'textures/thunderlock.dds',
    'correctTexturePath re-roots a bare name under textures/ - the archive must key by what the LADDER lands on');
  assert.ok(entry.image.mips.length > 1, 'a mip chain: this is a first-person weapon at a few hundred pixels');
  assert.equal(entry.image.width, entry.image.mips[0].width);

  // IT IS BRONZE, not a flat fill: the bake's whole point is that the
  // parts differ. Asked as a behavioural question - is the image varied
  // and warm - rather than by pinning bytes, which would redden on
  // every retune.
  const top = entry.image.mips[0];
  let r = 0; let g = 0; let bl = 0; let n = 0;
  let lo = 255; let hi = 0;
  for (let i = 0; i < top.rgba.length; i += 4) {
    r += top.rgba[i]; g += top.rgba[i + 1]; bl += top.rgba[i + 2]; n++;
    const lum = top.rgba[i] * 0.3 + top.rgba[i + 1] * 0.6 + top.rgba[i + 2] * 0.1;
    if (lum < lo) lo = lum; if (lum > hi) hi = lum;
  }
  assert.ok(r / n > g / n && g / n > bl / n, `warm metal, R > G > B: got ${Math.round(r / n)},${Math.round(g / n)},${Math.round(bl / n)}`);
  assert.ok(hi - lo > 40, `the atlas varies - a flat fill would be the factory-unwrap failure all over again (range ${Math.round(hi - lo)})`);
});

test('FIELD-GUN-MW2: the own-model door answers ONLY for the port\'s own', () => {
  assert.equal(ownWeaponModelFor(GUN)?.model, 'thunderlock.nif');
  // Every weapon Daggerfall has must fall through, or this door would
  // shadow a Morrowind weapon that resolves perfectly well.
  for (const [name, index] of Object.entries(WEAPONS)) {
    assert.equal(ownWeaponModelFor({ templateIndex: index }), null, `${name} must resolve through Morrowind's own records`);
  }
  assert.equal(ownWeaponModelFor(null), null);
  assert.equal(ownWeaponModelFor({}), null);
  assert.equal(ownWeaponModelFor({ templateIndex: undefined }), null);
  // ...and every row it DOES answer names a file that is actually here,
  // walked off the table so a row added without its mesh reddens.
  for (const own of Object.values(OWN_MW_MODELS)) {
    assert.doesNotThrow(() => shipped(`meshes/${own.model}`), `meshes/${own.model} is named by the table and not committed`);
    assert.ok(own.bone && own.id && own.name, 'a row carries the bone and the names the card prints');
  }
});

test('FIELD-GUN-MW2: the assets mount as an archive the Morrowind lane already speaks', () => {
  // The path mapping IS the mount: a file under src/assets/mw/ is
  // keyed by its data-files path and by nothing else, so adding one
  // needs no entry anywhere.
  assert.equal(ownMwDataPath('/repo/src/assets/mw/meshes/thunderlock.nif'), 'meshes/thunderlock.nif');
  assert.equal(ownMwDataPath('../assets/mw/Textures/Thunderlock.DDS'), 'textures/thunderlock.dds', 'lower-cased, as every path in this lane is');
  assert.equal(ownMwDataPath('somewhere/else/x.nif'), 'x.nif', 'an unexpected match costs one file, not the archive');

  // In node there is no window, so the glob is empty and the archive
  // answers false for everything - the same shape WS1's has carried
  // since it shipped. That is what keeps dataSource.js importable here.
  assert.equal(ownMwArchive().has('meshes/thunderlock.nif'), false);
  assert.equal(ownMwArchive(), ownMwArchive(), 'one archive per page, not one per call');

  // The PURE half is what the suite can drive, and it is the same
  // function the vendored archive uses - ONE HOME, BOTH ENDS.
  const arc = makeVendoredArchive({ 'Meshes/Thunderlock.nif': 'u' }, async () => new Uint8Array([1, 2, 3]));
  assert.equal(arc.has('meshes/thunderlock.nif'), true, 'keys are normalised on both sides');
  assert.equal(arc.loaded('meshes/thunderlock.nif'), false, 'lazy until loaded, which is what MW-LOAD\'s preload is for');
});

test('FIELD-GUN-MW2: a missing shipped file SAYS it is the build\'s fault', () => {
  // The failure mode that matters: our asset is shipped, so a miss here
  // is never the player's data. A note blaming their archives would
  // send somebody hunting through a Morrowind install for a file that
  // was never going to be in one.
  const empty = { has: () => false, get: () => null };
  const res = resolveWeaponParts({
    weapon: GUN, allWeapons: [], find: () => null,
    skeletonBytes: fixture('armfp.nif'), has: archiveHas([empty]),
  });
  assert.equal(res.parts.length, 0);
  assert.equal(res.notes.length, 1);
  assert.match(res.notes[0], /ships with the port/);
  assert.doesNotMatch(res.notes[0], /your archives/, 'it is not the player\'s data that is missing');

  // And a skeleton without the bone says THAT, rather than throwing
  // three frames down inside bindPart.
  const arc = shippedArchive();
  const boneless = resolveWeaponParts({
    weapon: GUN, allWeapons: [], find: (p) => (arc.has(p) ? arc : null),
    skeletonBytes: fixture('mesh.nif'), has: archiveHas([arc]),
  });
  assert.equal(boneless.parts.length, 0);
  assert.match(boneless.notes.join(' '), /no "Weapon Bone" bone/);
});

test('FIELD-GUN-MW2: the archive is MOUNTED, and in the rank that lets Mac override it', () => {
  // The one seam node cannot execute: `import.meta.glob` is a Vite
  // macro and this archive is empty here by construction, so a mount
  // that was deleted would break nothing any other pin can see - the
  // gun would simply stop drawing, in the browser, silently. Read the
  // host instead.
  const host = source('src/scenes/dataSource.js');
  const at = host.indexOf('ownMwArchive()');
  assert.ok(at > 0, 'dataSource.js no longer mounts the port\'s own archive - the gun draws nothing in the browser');
  assert.match(host.slice(Math.max(0, at - 400), at + 40), /archives\.push\(own\.ownMwArchive\(\)\)/,
    'it is pushed into the archive list, not merely imported');

  // THE RANK IS THE DESIGN. Loose files first (MW-D40's
  // data-files-over-BSA law) so a texture Mac drops in REPLACES ours
  // without a rebuild; then the vendored and own archives; then every
  // .bsa. Asked as ORDER IN THE SOURCE, because that is the order the
  // list is built in.
  const loose = host.indexOf('archives.push(makeLooseArchive(loose))');
  const bsa = host.indexOf('archives.push(await MwBsaFile.open(blob))');
  assert.ok(loose > 0 && bsa > 0, 'the two ranks this sits between are still here');
  assert.ok(loose < at, 'the player\'s own loose files rank AHEAD of ours, so they can override the gun');
  assert.ok(at < bsa, 'and ours ranks ahead of every .bsa, which carries none of these names');
});

test('FIELD-GUN-MW2: the gun is MORROWIND-SIZED, and pivoted on the grip', () => {
  // RIGGING, not bookkeeping, and the first bake got both wrong. It
  // normalised the mesh to a longest axis of 1 - a tidy number for a
  // MESH and a meaningless one for a WEAPON, because Morrowind is
  // seventy units to the metre and 1 unit is a gun one and a half
  // CENTIMETRES long.
  const b = flattenNif(parseNif(shipped('meshes/thunderlock.nif')))[0];
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < b.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.positions[i + k]); max[k] = Math.max(max[k], b.positions[i + k]); }
  }
  // THE BAKE'S CONSTANT IS THE PORT'S. It is restated in the tool
  // rather than imported (a bake must not drag the first-person module
  // in behind it), so it is held against the real one here - a number
  // with a pin on it cannot drift from the name it stands for.
  assert.ok(Math.abs(MW_UNITS_PER_METRE - MW_UNITS_PER_METER) < 1e-6,
    `the bake thinks a metre is ${MW_UNITS_PER_METRE} units and the port thinks it is ${MW_UNITS_PER_METER}`);

  const lengthUnits = max[1] - min[1];
  const metres = lengthUnits / MW_UNITS_PER_METER;
  assert.ok(Math.abs(metres - THUNDERLOCK_METRES) < 0.02,
    `the gun is ${metres.toFixed(2)} m; the bake says it should be ${THUNDERLOCK_METRES} m`);
  // A BAND rather than the exact number, so a deliberate retune of the
  // length does not redden this - but a return to the old normalise-to-1
  // does, by three orders of magnitude.
  assert.ok(lengthUnits > 20 && lengthUnits < 90,
    `${lengthUnits.toFixed(1)} units is not a weapon a hand could hold`);

  // THE PIVOT IS THE GRIP. Centred on its bounds - the first bake's
  // default - puts the MIDDLE of the receiver in the fist. The bone
  // this hangs on is a HAND, so the origin has to be where a hand goes:
  // near the butt, far from the muzzle.
  assert.equal(SETTINGS.origin, 'grip');
  assert.ok(max[1] > 0 && min[1] < 0, 'the origin is inside the weapon');
  assert.ok(max[1] > -min[1] * 4,
    `the origin sits ${(-min[1]).toFixed(1)} behind and ${max[1].toFixed(1)} ahead - that is the middle of the gun, not its grip`);
});

test('FIELD-GUN-MW2: it ANIMATES as a crossbow, or the arms punch while holding it', () => {
  // The gap that "it attaches to the right bone" hides. `animWeaponType`
  // turns MW_WEAPON_TYPE.None into HandToHand (fpArm.js:288) - right
  // for empty hands, absurd for a man holding a dwemer firearm - so
  // returning None from the resolve left the rig playing unarmed
  // stances with a gun along for the ride.
  const arc = shippedArchive();
  const res = resolveWeaponParts({
    weapon: GUN, hasAmmo: true, allWeapons: [], find: (p) => (arc.has(p) ? arc : null),
    skeletonBytes: fixture('armfp.nif'), has: archiveHas([arc]),
  });
  assert.equal(res.mwType, MW_WEAPON_TYPE.MarksmanCrossbow,
    'the row carries the number 10; it must BE MarksmanCrossbow, or the leaf has drifted from the name it stands for');
  assert.notEqual(animWeaponType(res.mwType, false), MW_WEAPON_TYPE.HandToHand);
  assert.equal(animWeaponType(res.mwType, false), MW_WEAPON_TYPE.MarksmanCrossbow, 'drawn, it is a crossbow');
  assert.equal(animWeaponType(res.mwType, true), MW_WEAPON_TYPE.None, 'sheathed, it is nothing - the stance law is untouched');

  // The four things the borrow buys, asked of the reference's own
  // functions rather than of the number.
  assert.deepEqual(composeWeaponGroup(res.mwType, () => true), { group: 'crossbow', fallback: null },
    'a real animation group, where None resolved to no group at all');
  assert.equal(shootsRatherThanSwings(res.mwType), true, 'the attack keys are "shoot", not a chop\'s follow-through');
  assert.equal(reloadsItself(res.mwType), true, 'and it has a reload in the cycle, which the lab found and only the crossbow has');

  // ...AND THE AMMUNITION IS NOT BORROWED. ammoTypeFor(crossbow) is
  // Bolt, and the arm would instance a Morrowind quarrel on the arrow
  // bone. The early return is what stops it, and `hasAmmo: true` above
  // is what makes this a question rather than a coincidence.
  assert.equal(ammoTypeFor(res.mwType), MW_WEAPON_TYPE.Bolt, 'the type it borrows DOES carry ammunition');
  assert.equal(res.arrowInfo, null, 'and we take none of it');
  assert.equal(res.parts.filter((p) => p.slot === 'arrow').length, 0);
});

test('FIELD-GUN-MW2: the shipped assets are REPRODUCED from the committed source, byte for byte', () => {
  // THE PIN THAT MAKES EVERY OTHER TOOL PIN LOAD-BEARING.
  //
  // A mutation campaign over the bake chain left SIX survivors, and
  // they had one cause between them: the committed .nif and .dds are
  // the output of a run that already happened, so changing the tool
  // that made them changes nothing any pin can see. Islands could go
  // back to growing against the neighbour, the scale back to a
  // normalised 1, the pivot back to the bounds centre - and the suite
  // stayed green, because it was reading an artefact rather than a
  // derivation.
  //
  // The allow-list row for these files says "re-run the chain on the
  // same .fbx and the same bytes come out". This is that sentence as a
  // test. It is also the whole reason the .fbx is committed: a
  // derivation you cannot re-run is a claim you cannot check.
  const source = readFileSync(new URL(`../${SOURCE_FBX}`, import.meta.url));
  const r = bakeThunderlock(source);
  const onDisk = (p) => readFileSync(new URL(`../${p}`, import.meta.url));

  const nif = onDisk(OUT.mesh);
  assert.equal(r.nif.length, nif.length, `the baked mesh is ${r.nif.length} bytes and ${OUT.mesh} is ${nif.length}`);
  assert.equal(Buffer.compare(Buffer.from(r.nif), Buffer.from(nif)), 0,
    `${OUT.mesh} is not what tools/bakeThunderlock.mjs produces from ${SOURCE_FBX} - re-run it`);

  const dds = onDisk(OUT.texture);
  assert.equal(r.dds.length, dds.length, `the baked texture is ${r.dds.length} bytes and ${OUT.texture} is ${dds.length}`);
  assert.equal(Buffer.compare(Buffer.from(r.dds), Buffer.from(dds)), 0,
    `${OUT.texture} is not what tools/bakeThunderlock.mjs produces from ${SOURCE_FBX} - re-run it`);

  // And the bake is DETERMINISTIC, which is the property the sentence
  // above rests on: a second run of the same input is the same bytes.
  // Without this, "matches the committed file" could be luck.
  const again = bakeThunderlock(source);
  assert.equal(Buffer.compare(Buffer.from(r.nif), Buffer.from(again.nif)), 0, 'two runs, one mesh');
  assert.equal(Buffer.compare(Buffer.from(r.dds), Buffer.from(again.dds)), 0, 'two runs, one texture');

  // The source is what it claims to be, so a swapped file is a red
  // suite rather than a silently different gun.
  assert.equal(r.before.overlapping, true, 'the committed FBX still carries the factory cylinder mapping this chain exists to replace');
});
