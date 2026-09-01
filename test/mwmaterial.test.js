import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { sampleTrack } from '../src/formats/mwAnim.js';
import {
  flattenNif, diffuseAt, VERTEX_COLOR_MODE, VERT_MODE, LIGHT_MODE, DRAW_MODE,
  hasMarkerFlag, skipGeometryName,
} from '../src/formats/mwNifMesh.js';
import { boneOffsetOf, bindPart } from '../src/formats/mwCharacter.js';
import { buildSkeleton } from '../src/formats/mwSkin.js';
import { placeAtBone, aimingFactor, neckRotateFactor, FP_NECK_ROTATE_FACTOR } from '../src/formats/mwFirstPerson.js';
import {
  accurateAiming, UPPER_BODY, packFpArm, FP_FLOATS, createFpArm, fpSkeletonPath, FP_CLIP_PATH,
  buildFpArm,
} from '../src/combat/fpArm.js';
import { assembleFirstPersonArm, poseAssembly, armPieceRows } from '../src/formats/mwFirstPerson.js';

// MW-D13: THE RULES THE ARM WAS STILL DRAWING WITHOUT.
//
// Every pin here is a rule the port had read and not implemented, found
// by walking the arc doc's own numbered list against the tree rather than
// by looking at the screen - which is the point: none of these has a
// picture that says it is wrong. A mesh tinted twice looks like a dark
// mesh. A weapon at its bone's bare origin looks like a weapon.

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const byName = (batches, name) => batches.find((b) => b.name === name);

// --- rules 63/64/66: the material chain and the colour mode ----------------

test('MW-D13 rule 64: with no NiMaterialProperty the defaults are WHITE, not black', () => {
  const plain = byName(flattenNif(parseNif(f('matprops.nif'))), 'Plain');
  assert.deepEqual(plain.material.diffuse, [1, 1, 1]);
  assert.deepEqual(plain.material.ambient, [1, 1, 1]);
  assert.deepEqual(plain.material.emissive, [0, 0, 0]);
  // "NIF material defaults don't match OpenGL defaults" - the loader
  // re-sets both to white before the property loop, so an unmaterialled
  // shape is lit, not unlit.
  assert.equal(plain.material.vertexColorMode, VERTEX_COLOR_MODE.None,
    'and with no colour array the mode is None');
});

test('MW-D13 rule 37: a material on an ANCESTOR NiNode reaches the shape', () => {
  // The common Morrowind authoring pattern, and a port that reads only
  // the shape's own properties drops it silently.
  const inherited = byName(flattenNif(parseNif(f('matprops.nif'))), 'Inherited');
  assert.deepEqual(inherited.material.diffuse.map((n) => +n.toFixed(3)), [1, 0.5, 0.25]);
  assert.equal(+inherited.material.alpha.toFixed(3), 0.75, 'mAlpha rides through as diffuse.a');
});

test('MW-D13 rule 66: the light mode OUTLIVES the property that set it', () => {
  // THE PIN A PER-TYPE MAP CANNOT PASS. "Scoped" has an ancestor
  // NiVertexColorProperty (SrcAmbDif + LightMode_Emissive) and its own
  // (SrcEmissive + EmiAmbDif). `lightmode` is assigned ONLY in the
  // SrcAmbDif branch (nifloader.cpp:2805), so the nearer property picks
  // the MODE and the farther one still triggers the BLACKOUT.
  const scoped = byName(flattenNif(parseNif(f('matprops.nif'))), 'Scoped');
  assert.equal(scoped.material.vertexColorMode, VERTEX_COLOR_MODE.Emission,
    'the NEARER property picks the mode');
  assert.deepEqual(scoped.material.diffuse, [0, 0, 0],
    'and the FARTHER one blacks the diffuse out, though it no longer owns the mode');
  assert.deepEqual(scoped.material.ambient, [0, 0, 0]);
  // The material's own yellow diffuse is gone - lit only by emissive.
  assert.notDeepEqual(scoped.material.diffuse, [1, 1, 0]);
});

test('MW-D13 rule 64: a colour mode on a COLOURLESS mesh yields white, never black', () => {
  const nc = byName(flattenNif(parseNif(f('matprops.nif'))), 'NoColors');
  assert.equal(nc.material.vertexColorMode, VERTEX_COLOR_MODE.None, 'the mode is undone');
  // ":2907-2926" - the named channel is written WHITE. The material's own
  // (0.1, 0.2, 0.3) is discarded, which is the reference's "use a default
  // color instead" and reads as surprising until you see the guard.
  assert.deepEqual(nc.material.diffuse, [1, 1, 1]);
  assert.deepEqual(nc.material.ambient, [1, 1, 1]);
});

test('MW-D13 rule 66: Morrowind specular is parsed and THROWN AWAY', () => {
  // "for any NIF at or below VER_MW specular is unconditionally zeroed
  // ... a port should not implement Morrowind specular at all". The
  // fixture's material carries glossiness 42 and a bright specular.
  for (const b of flattenNif(parseNif(f('matprops.nif')))) {
    assert.equal(b.material.glossiness, 0, `${b.name} keeps no glossiness`);
    assert.ok(!('specular' in b.material), `${b.name} carries no specular channel at all`);
  }
});

test('MW-D13 rule 65: only DrawMode 3 is two-sided, and Default is NOT', () => {
  const b = flattenNif(parseNif(f('matprops.nif')));
  assert.equal(byName(b, 'Inherited').material.twoSided, true, 'DrawMode 3 (Both)');
  assert.equal(byName(b, 'NoColors').material.clockwise, true, 'DrawMode 2 (Clockwise)');
  assert.equal(byName(b, 'NoColors').material.twoSided, false, 'which is NOT two-sided');
  assert.equal(byName(b, 'Plain').material.twoSided, false, 'and Default is CCW WITH culling');
  assert.equal(byName(b, 'Plain').material.clockwise, false);
  assert.deepEqual({ ...DRAW_MODE }, { Default: 0, CounterClockwise: 1, Clockwise: 2, Both: 3 });
});

test('MW-D13 rule 63: the vertex colour REPLACES the diffuse - it never multiplies it', () => {
  // "This is the single most likely place for a port to be silently
  // wrong." The mode decides, not the presence of colours.
  const colors = Float32Array.from([0.25, 0.5, 0.75, 1]);
  const mat = { diffuse: [1, 0, 0], vertexColorMode: VERTEX_COLOR_MODE.AmbientAndDiffuse };
  assert.deepEqual(diffuseAt(mat, colors, 0), [0.25, 0.5, 0.75],
    'AmbientAndDiffuse takes the vertex colour WHOLE - the red material diffuse is discarded');
  assert.deepEqual(diffuseAt({ ...mat, vertexColorMode: VERTEX_COLOR_MODE.Diffuse }, colors, 0),
    [0.25, 0.5, 0.75]);
  // The modes that do NOT name diffuse keep the material's, colours or no.
  for (const m of ['None', 'Emission', 'Ambient', 'Specular']) {
    assert.deepEqual(diffuseAt({ ...mat, vertexColorMode: VERTEX_COLOR_MODE[m] }, colors, 0), [1, 0, 0],
      `${m} leaves the material diffuse alone`);
  }
  // No colour array at all: the material's diffuse, never white.
  assert.deepEqual(diffuseAt(mat, null, 0), [1, 0, 0]);
  // The numbers reach a shader in the reference, so they are pinned as
  // numbers rather than as this module's own names.
  assert.deepEqual({ ...VERTEX_COLOR_MODE },
    { None: 0, Emission: 1, AmbientAndDiffuse: 2, Ambient: 3, Diffuse: 4, Specular: 5 });
  assert.deepEqual({ ...VERT_MODE }, { SrcIgnore: 0, SrcEmissive: 1, SrcAmbDif: 2 });
  assert.deepEqual({ ...LIGHT_MODE }, { Emissive: 0, EmiAmbDif: 1 });
});

// --- rule 14: BoneOffset ---------------------------------------------------

test('MW-D13 rule 14: BoneOffset is the FIRST non-drawable node, matched case-insensitively', () => {
  const nif = parseNif(f('boneoffset.nif'));
  // The fixture puts a SHAPE named "boneoffset" first in pre-order and a
  // second node named "BONEOFFSET" after the real one, so three separate
  // mistakes each yield a different answer.
  assert.deepEqual(boneOffsetOf(nif), [3, -4, 5]);
  const shapes = flattenNif(nif).map((b) => b.name).sort();
  assert.deepEqual(shapes, ['Blade', 'boneoffset'],
    'and the decoy really IS a drawable, so the skip is exercised');
});

test('MW-D13 rule 14: a part with no such node answers null, not a zero offset', () => {
  // null and [0,0,0] would draw identically. They are not the same
  // answer, and the one the caller gets decides whether "no offset" can
  // ever be confused with "an offset of zero" in a report.
  assert.equal(boneOffsetOf(parseNif(f('weapon.nif'))), null);
});

test('MW-D13 rule 14: the offset rides the mirror, in the bone\'s space, AFTER the scale', () => {
  // OSG inserts one PositionAttitudeTransform carrying BOTH, and a PAT is
  // T(position) * R(attitude) * S(scale) - so the mirror negates x and
  // the offset is added to the result. Adding it first would negate the
  // offset's x on every left-hand part, the bow among them.
  const at = { a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [10, 20, 30] };
  const src = Float32Array.from([2, 0, 0]);
  assert.deepEqual([...placeAtBone(src, at, false, undefined, [3, -4, 5])], [15, 16, 35]);
  assert.deepEqual([...placeAtBone(src, at, true, undefined, [3, -4, 5])], [11, 16, 35],
    'mirrored: -2 + 3 = 1, NOT -(2 + 3) = -5');
  // No offset is the old behaviour, unchanged.
  assert.deepEqual([...placeAtBone(src, at, false, undefined, null)], [12, 20, 30]);
});

test('MW-D13 rule 14: bindPart resolves the offset for RIGID parts only', () => {
  const skeleton = buildSkeleton(parseNif(f('armskelw.nif')));
  const part = parseNif(f('boneoffset.nif'));
  const bound = bindPart(skeleton, part, { attachBone: 'Weapon Bone' });
  assert.ok(bound.attached.length, 'the fixture is rigid');
  assert.deepEqual(bound.boneOffset, [3, -4, 5]);
  // A part with no rigid batches never runs the visitor - the skinned
  // branch of attach() returns before it, because a skinned part is
  // placed by its own bones and has no attach node to offset from.
  const skinned = bindPart(skeleton, parseNif(f('armhand.nif')), {});
  assert.equal(skinned.boneOffset, null);
});

// --- rule 30: the aiming factor -------------------------------------------

test('MW-D13 rule 30: the neck factor is 0.75 at REST and 1.0 while aiming', () => {
  // `float rotateFactor = 0.75f + 0.25f * mAimingFactor` - the port
  // shipped the constant 0.75, which is the resting half of a two-valued
  // rule. The arms lag the look by a quarter of it normally and follow it
  // EXACTLY while you swing, which is what makes a blow land where you
  // are looking.
  assert.equal(neckRotateFactor(0), FP_NECK_ROTATE_FACTOR);
  assert.equal(neckRotateFactor(0), 0.75);
  assert.equal(neckRotateFactor(1), 1);
  assert.equal(neckRotateFactor(0.5), 0.875);
});

test('MW-D13 rule 30: aiming SNAPS on and RAMPS off at 0.5 a second', () => {
  assert.equal(aimingFactor(0, true, 999), 1, 'the rise is instant and dt-independent');
  assert.equal(aimingFactor(1, true, 0.016), 1);
  // The fall is per SECOND, so it must be frame-rate independent: two
  // half-steps and one whole step land in the same place.
  assert.ok(Math.abs(aimingFactor(aimingFactor(1, false, 0.5), false, 0.5) - aimingFactor(1, false, 1)) < 1e-9);
  assert.equal(aimingFactor(1, false, 1), 0.5);
  assert.equal(aimingFactor(1, false, 2), 0, 'two seconds to fall all the way');
  assert.equal(aimingFactor(0.1, false, 10), 0, 'clamped at zero, never negative');
});

test('MW-D13 rule 30: accurate aiming is an ORDER comparison on the upper-body enum', () => {
  // `setAccurateAiming(mUpperBodyState > UpperBodyState::WeaponEquipped)`
  // (character.cpp:1894). It is a comparison, which is why the enum is
  // numbered in character.hpp's own order and not a set of strings.
  assert.equal(accurateAiming(UPPER_BODY.None), false);
  assert.equal(accurateAiming(UPPER_BODY.Equipping), false);
  assert.equal(accurateAiming(UPPER_BODY.Unequipping), false);
  assert.equal(accurateAiming(UPPER_BODY.WeaponEquipped), false, 'merely holding a weapon is not aiming');
  assert.equal(accurateAiming(UPPER_BODY.AttackWindUp), true);
  assert.equal(accurateAiming(UPPER_BODY.AttackRelease), true);
  assert.equal(accurateAiming(UPPER_BODY.AttackEnd), true, 'the follow-through still aims');
  // MW-D39: Casting is the reference's own last member (character.hpp:
  // 107-117), so the comparison makes a cast aim too - which is the
  // reference's behaviour, not an accident of appending.
  assert.equal(accurateAiming(UPPER_BODY.Casting), true);
  // The order itself, which is what the comparison rests on.
  assert.deepEqual(Object.values(UPPER_BODY), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('MW-D13 rule 64: a colour array ALONE selects AmbientAndDiffuse', () => {
  // The one non-default thing set before the property loop (:2737-2738).
  // "Colored" has vertex colours and a RED material and no
  // NiVertexColorProperty at all, so the material's diffuse is discarded
  // in favour of the vertex colour purely because the array exists.
  const c = byName(flattenNif(parseNif(f('matprops.nif'))), 'Colored');
  assert.equal(c.material.vertexColorMode, VERTEX_COLOR_MODE.AmbientAndDiffuse);
  assert.deepEqual(c.material.diffuse.map((n) => +n.toFixed(3)), [1, 0, 0], 'the material is still red');
  const [r, g, b] = diffuseAt(c.material, c.colors, 0).map((n) => +n.toFixed(3));
  assert.deepEqual([r, g, b], [0.2, 0.4, 0.6], 'and the vertex colour is what the surface takes');
});

test('MW-D13 rule 63: packFpArm writes the RESOLVED diffuse, not the raw colour', () => {
  // The seam the rule actually lands on. Same colours, same positions,
  // two modes - and the packed stream must differ.
  const positions = Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const indices = Uint16Array.from([0, 1, 2]);
  const colors = Float32Array.from([0.2, 0.4, 0.6, 1, 0.2, 0.4, 0.6, 1, 0.2, 0.4, 0.6, 1]);
  const piece = (mode) => ({
    positions, indices, colors, uvs: null,
    material: { diffuse: [1, 0, 0], vertexColorMode: mode, textureFile: null },
  });
  const colourAt = (packed, v) => [...packed.slice(v * FP_FLOATS + 3, v * FP_FLOATS + 6)].map((n) => +n.toFixed(3));
  const on = packFpArm([piece(VERTEX_COLOR_MODE.AmbientAndDiffuse)]);
  assert.deepEqual(colourAt(on.packed, 0), [0.2, 0.4, 0.6], 'the mode names diffuse, so the colour replaces it');
  const off = packFpArm([piece(VERTEX_COLOR_MODE.None)]);
  assert.deepEqual(colourAt(off.packed, 0), [1, 0, 0],
    'mode None keeps the MATERIAL diffuse even though the colours are right there');
  // And it is a replacement, never a product: 0.2 * 1 = 0.2 would pass
  // the first case, so the green and blue channels are what tell them
  // apart - 0.4 * 0 and 0.6 * 0 would both be black.
  const mult = packFpArm([piece(VERTEX_COLOR_MODE.Diffuse)]);
  assert.notDeepEqual(colourAt(mult.packed, 0), [0.2, 0, 0]);
});

// --- the live rig: rules 14 and 30 through the assembly --------------------

const fpFiles = (skelFile = 'armfp.nif') => new Map([
  [fpSkeletonPath({}), f(skelFile)],
  [FP_CLIP_PATH, f('armfpweapon.kf')],
  ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
  ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ['meshes/w/blade.nif', f('boneoffset.nif')],
  ['textures/tx_fixture.dds', f('fixture.dds')],
]);

const wpdtRec = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);   // MW-D22: mType is at byte 8 (loadweap.hpp) - 10 was the shared guess
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return Uint8Array.from([...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d]);
};

async function armWithOffsetWeapon() {
  const files = fpFiles();
  const weap = wpdtRec('iron longsword', 'w/blade.nif', 1);
  const arm = createFpArm();
  arm.attach({
    gl: null,
    createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: () => 1,
  }, () => ({ pitch: 0.4 }));
  const res = await arm.build({
    race: 'fprace',
    weapon: { templateIndex: 120 },
    deps: {
      loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
      storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
      loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
    },
  });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  return arm;
}

test('MW-D13 rule 14: the weapon\'s BoneOffset moves it, live, through the whole chain', async () => {
  const arm = await armWithOffsetWeapon();
  arm.update(0.05);
  const rows = arm.rows();
  const weapon = rows.find((r) => r.slot === 'weapon');
  assert.ok(weapon, 'the weapon is in the assembly');
  assert.deepEqual(weapon.boneOffset, [3, -4, 5], 'and the card names its offset');
  // The offset is IN the vertices, not merely reported: the weapon's
  // bounds must sit a fixed distance from where they would be without it.
  // Its own geometry spans x 0..2 and the offset adds 3 (before the bone
  // transform, which for this rig is a translation).
  assert.ok(weapon.bounds.maxX - weapon.bounds.minX > 1, 'the blade has width');

  // AND IT IS IN THE VERTICES. The report is not the pin: a `boneOffset`
  // field that the placement never reads draws exactly what MW-D12 drew.
  // So pose once with the offset, once with it removed, and measure how
  // far the blade moved. A bone transform is a rotation and a
  // translation, so the distance must be the offset's own LENGTH -
  // sqrt(9 + 16 + 25) - whatever the bone's orientation happens to be.
  const built = arm.built();
  const piece = built.arm.pieces.find((pc) => pc.slot === 'weapon');
  const posed = () => {
    poseAssembly(built.arm, {
      tracks: built.tracks, sampleTrack, time: built.clip.startTime, accumRoot: built.accumRoot,
    });
    return armPieceRows(built.arm.pieces).find((r) => r.slot === 'weapon').bounds;
  };
  const withOffset = posed();
  piece.boneOffset = null;
  const without = posed();
  piece.boneOffset = [3, -4, 5];
  const moved = Math.hypot(withOffset.minX - without.minX,
    withOffset.minY - without.minY, withOffset.minZ - without.minZ);
  assert.ok(Math.abs(moved - Math.hypot(3, -4, 5)) < 1e-4,
    `the blade moved ${moved}, which is not the offset's length`);

  const armRows = rows.filter((r) => r.slot !== 'weapon');
  assert.ok(armRows.length, 'and the arm pieces are there too');
  assert.ok(armRows.every((r) => r.boneOffset === null),
    'none of which carry an offset - the meshes have no such node');
});

test('MW-D13 rule 30: the neck factor really moves the arm, and aiming moves it further', async () => {
  const arm = await armWithOffsetWeapon();
  const built = arm.built();
  const poseAt = (aim) => {
    poseAssembly(built.arm, {
      tracks: built.tracks, sampleTrack, time: built.clip.startTime,
      accumRoot: built.accumRoot, neckPitch: 0.4, neckAim: aim,
    });
    return armPieceRows(built.arm.pieces).map((r) => r.bounds.minY);
  };
  const rest = poseAt(0);
  const aiming = poseAt(1);
  assert.equal(rest.length, aiming.length);
  assert.ok(rest.some((v, i) => Math.abs(v - aiming[i]) > 1e-4),
    'a factor of 0.75 and one of 1.0 do NOT put the arm in the same place');
  // And the aiming pose is FURTHER along the same arc, not somewhere else.
  const half = poseAt(0.5);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]; const b = half[i]; const c = aiming[i];
    if (Math.abs(a - c) < 1e-4) continue;
    assert.ok((b - a) * (c - b) >= -1e-6, `piece ${i} moves monotonically with the aim`);
  }
});

test('MW-D13 rule 30: the live arm raises its aim on a swing and lets it fall', async () => {
  const arm = await armWithOffsetWeapon();
  arm.setSheathed(false);
  for (let i = 0; i < 40 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.WeaponEquipped);
  arm.update(0.05);
  assert.equal(arm.status().aimFactor, 0, 'holding a weapon is not aiming');

  assert.equal(arm.attack('StrikeDown'), 'chop');
  arm.update(0.016);
  assert.equal(arm.status().aimFactor, 1, 'and the rise is INSTANT, in one short frame');

  // Run the blow out, then let the ramp work.
  for (let i = 0; i < 200 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  const before = arm.status().aimFactor;
  arm.update(0.5);
  const after = arm.status().aimFactor;
  assert.ok(after < before, 'and it falls once the blow is over');
  assert.ok(Math.abs((before - after) - 0.25) < 1e-6, 'by 0.5 a SECOND, so 0.25 in half of one');
  for (let i = 0; i < 20; i++) arm.update(0.5);
  assert.equal(arm.status().aimFactor, 0, 'down to zero and no further');
});

// --- rules 58 + 59: the names the loader refuses to draw ------------------

const names = (n) => flattenNif(parseNif(f(n))).map((b) => b.name);

test('MW-D13 rule 59: TWO of the three skips are UNCONDITIONAL, one is gated', () => {
  // markers.nif and nomarkers.nif differ ONLY in the root's "MRK" string
  // extra data. A single file cannot tell a gated skip from an
  // unconditional one, and a port that gates all three passes every test
  // one file could hold - while drawing every shadow-caster mesh in the
  // game as a solid slab under the model.
  assert.deepEqual(names('markers.nif'), ['Keep'],
    'with MRK the editor marker goes too');
  assert.deepEqual(names('nomarkers.nif'), ['Tri EditorMarker01', 'Keep'],
    'without it the editor marker STAYS - but the shadows are gone either way');
  // AND THE TWO DECOYS nomarkers.nif carries, each of which draws the
  // marker away under a different wrong reading: its ROOT says "mrk" in
  // lower case (== is not ciEqual), and a NON-ROOT node under it says a
  // correct "MRK" (the check is `args.mRootNode == node`). Both are in
  // that one assertion above - this names them so a future reader knows
  // the fixture is doing three jobs and not one.
  assert.equal(skipGeometryName('Shadow Plane', false), true);
  assert.equal(skipGeometryName('Tri Shadow', false), true);
  assert.equal(skipGeometryName('tri editormarker01', false), false);
  assert.equal(skipGeometryName('tri editormarker01', true), true);
  // ciStartsWith, not equality: these are PREFIX tests.
  assert.equal(skipGeometryName('SHADOWFOOT', false), true);
  assert.equal(skipGeometryName('Keep', true), false);
  assert.equal(skipGeometryName('', true), false);
});

test('MW-D13 rule 59: the MRK payload is EXACT and CASE-SENSITIVE', () => {
  // `sd->mData == "MRK"` - an == against a std::string, not ciEqual.
  const nif = parseNif(f('markers.nif'));
  assert.equal(hasMarkerFlag(nif, nif.records[nif.roots[0]]), true);
  const plain = parseNif(f('nomarkers.nif'));
  assert.equal(hasMarkerFlag(plain, plain.records[plain.roots[0]]), false,
    'its root says "mrk" in lower case, which == does not match');
  // And the non-root node that DOES say MRK really is in the file, so
  // the root-scoping is exercised rather than merely stated.
  const deep = plain.records.find((r) => r && r.name === 'DeepMarkerHolder');
  assert.ok(deep, 'the deep holder is there');
  assert.equal(hasMarkerFlag(plain, deep), true, 'and it really does carry MRK');
  // A node with no extra chain at all answers false rather than throwing.
  assert.equal(hasMarkerFlag(nif, { extra: -1 }), false);
  assert.equal(hasMarkerFlag(nif, null), false);
});

test('MW-D13 rule 58: "Bounding Box" takes its whole SUBTREE with it', () => {
  // The node and everything under it never enter the scene graph. The
  // fixture puts a real shape beneath it, so a port that skips only the
  // node still draws the shape.
  assert.ok(!names('markers.nif').includes('Inside Box'));
  assert.ok(!names('nomarkers.nif').includes('Inside Box'));
});

test('MW-D13 rule 58: a NIF whose ROOT is "Bounding Box" is NOT skipped', () => {
  // `if (args.mRootNode && ciEqual(...))` and mRootNode is null on the
  // first call. It reads like an oversight and it is load-bearing: such
  // a file would otherwise load as nothing at all.
  assert.deepEqual(names('boxroot.nif'), ['Tri EditorMarker01', 'Keep']);
});

// --- MW-D34: adjustScale's factors reach the build -------------------------

test('MW-D34: RADT weight/height reach the build, per gender column, defaulting to 1', async () => {
  // Npc::adjustScale (npc.cpp:1102-1136): the rendered body scales x,y
  // by the race's WEIGHT and z by its HEIGHT, per gender - male reads
  // mMaleWeight/mMaleHeight, female the female pair (:1124-1135). The
  // RADT floats sit at 120/124 (heights) and 128/132 (weights), male
  // first (loadrace.hpp) - the same layout MW-D32's raceRecords pinned.
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const radt = new Uint8Array(140);
  const dv = new DataView(radt.buffer);
  dv.setFloat32(120, 1.1, true);   // male height
  dv.setFloat32(124, 1.3, true);   // female height
  dv.setFloat32(128, 1.2, true);   // male weight
  dv.setFloat32(132, 0.9, true);   // female weight
  dv.setInt32(136, 1, true);       // playable
  const raceRec = (() => {
    const d = [...sub('NAME', Z('fprace')), ...sub('RADT', [...radt])];
    return [...A('RACE'), ...U(d.length), ...U(0), ...U(0), ...d];
  })();
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [fpSkeletonPath({ female: true }), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  const deps = (withRace) => ({
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => (withRace
      ? Uint8Array.from([...f('armfp.esm'), ...raceRec]) : f('armfp.esm')),
  });
  const male = await buildFpArm({ race: 'fprace', deps: deps(true) });
  assert.ok(male.ok, `${male.stage}: ${male.error}`);
  assert.deepEqual(male.raceScale, { weight: 1.2000000476837158, height: 1.100000023841858 },
    'male reads the male columns (float32 round-trips and all)');
  const female = await buildFpArm({ race: 'fprace', female: true, deps: deps(true) });
  assert.ok(female.ok, `${female.stage}: ${female.error}`);
  assert.ok(Math.abs(female.raceScale.weight - 0.9) < 1e-6 && Math.abs(female.raceScale.height - 1.3) < 1e-6,
    'female reads the FEMALE columns - the port that reads index 0 for everyone dies here');
  // No RADT anywhere: the factors stay 1 - a scale of 0 would collapse
  // the body, and "absent" is not "zero".
  const plain = await buildFpArm({ race: 'fprace', deps: deps(false) });
  assert.ok(plain.ok);
  assert.deepEqual(plain.raceScale, { weight: 1, height: 1 });
});
