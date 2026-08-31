import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { extractTracks, sampleTrack } from '../src/formats/mwAnim.js';
import { accumRootRef } from '../src/formats/mwSkin.js';
import { PART_BONES } from '../src/formats/mwNpc.js';
import { portraitFeatures, headFeatures, hairFeatures, matchFace } from '../src/formats/mwFaceMatch.js';
import { assembleFirstPersonArm, poseAssembly } from '../src/formats/mwFirstPerson.js';
import {
  packFpArm, fpSkeletonPath, buildFpArm, createFpArm, wornVerdicts, wornEquipKeyOf,
  FP_CLIP_PATH, NIF_TO_PASS, FP_FIELD_OF_VIEW, firstPersonEye, FP_FLOATS,
  collectArmTextures,
} from '../src/combat/fpArm.js';
import { firstPersonCameraRef, FP_NECK_ROTATE_FACTOR } from '../src/formats/mwFirstPerson.js';

// MW-D8: THE ARM IN THE GAME.
//
// What these pins can and cannot see, stated up front. The GL path - the
// offscreen first-person pass, the composite, where the arm lands on
// screen - is measured by tools/mwArmProbe.mjs in a real browser against
// a real WebGL2 context, because a node test cannot see a pixel. What is
// here is the arithmetic and the structure underneath it, plus the source
// laws whose failure a picture would not show.

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The MW-D10 first-person rig: an eye, arms forward of and below it,
 *  and a quiet sway - the shape rule 54 needs and no earlier fixture had. */
async function fpFixtureBuild() {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    // The meshes name "tx_fixture.TGA"; the archive has only the .dds,
    // which is the retail arrangement rule 36 exists for.
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  return buildFpArm({
    race: 'fprace',
    deps: {
      loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
      storedMorrowindNames: async () => ['armfp.esm'],
      loadMorrowindFile: async () => f('armfp.esm'),
    },
  });
}

async function fixtureArm() {
  const arm = await assembleFirstPersonArm({
    skeletonBytes: f('armskel.nif'),
    parts: [{ slot: 'hand', bytes: f('armhand.nif') }, { slot: 'upperarm', bytes: f('armcuff.nif') }],
  });
  const tracks = extractTracks(parseNif(f('armidle.kf')));
  poseAssembly(arm, { tracks, sampleTrack, time: 2.0, accumRoot: accumRootRef(arm.skeleton, tracks) });
  return arm;
}

test('MW-D8 rule 6: the skeleton is chosen by SEX and BEAST, and the reverted name is not among them', () => {
  assert.equal(fpSkeletonPath({}), 'meshes/xbase_anim.1st.nif');
  assert.equal(fpSkeletonPath({ female: true }), 'meshes/base_anim_female.1st.nif');
  assert.equal(fpSkeletonPath({ beast: true }), 'meshes/base_animkna.1st.nif');
  // Beast wins over sex: a female Khajiit takes the beast skeleton.
  assert.equal(fpSkeletonPath({ female: true, beast: true }), 'meshes/base_animkna.1st.nif');
  // THE NAME THE REVERTED RIG HARDCODED. base_anim.nif is the THIRD-person
  // skeleton and appears nowhere in rule 6's table; a rig asking for it
  // found nothing and fell back to the sprite for ever, silently.
  for (const k of [{}, { female: true }, { beast: true }]) {
    assert.ok(!fpSkeletonPath(k).includes('base_anim.1st.nif')
      || fpSkeletonPath(k).includes('xbase_anim') || fpSkeletonPath(k).includes('female'),
    'no arm resolves to the bare base_anim.1st.nif');
  }
  assert.equal(FP_CLIP_PATH, 'meshes/xbase_anim.1st.kf', 'and the clip sits beside it (rule 6)');
});

test('MW-D8: packFpArm expands indexed triangles into the character vertex stream', async () => {
  const arm = await fixtureArm();
  const tris = arm.pieces.reduce((n, p) => n + p.indices.length / 3, 0);
  const { packed, ranges } = packFpArm(arm.pieces);
  // drawCharacter issues drawArrays, not drawElements (renderer.js), so
  // the stream is NON-INDEXED: three vertices per triangle, ELEVEN floats
  // each since MW-D11 put the UV pair on the end.
  assert.equal(packed.length, tris * 3 * FP_FLOATS);
  for (let i = 0; i < packed.length; i += FP_FLOATS) {
    const n = Math.hypot(packed[i + 6], packed[i + 7], packed[i + 8]);
    assert.ok(Math.abs(n - 1) < 1e-3, 'every face normal is unit length');
  }
  // ONE RANGE PER PIECE, covering the stream exactly - a Morrowind arm is
  // several meshes with several textures and this path issues drawArrays,
  // so the ranges ARE the piece list.
  assert.equal(ranges.length, arm.pieces.filter((p) => p.positions && p.indices).length);
  let at = 0;
  for (const r of ranges) {
    assert.equal(r.first, at, 'the ranges are contiguous and in piece order');
    at += r.count;
  }
  assert.equal(at, packed.length / FP_FLOATS, 'and together they cover every vertex');

  // The buffer is REUSED when it already fits - the frame path must not
  // allocate a megabyte per frame.
  const again = packFpArm(arm.pieces, { packed, ranges });
  assert.equal(again.packed, packed, 'a correctly-sized buffer is written in place, not replaced');
});

test('MW-D8 rule 13: a mirrored piece has its face normals negated, or it lights inside-out', async () => {
  const arm = await fixtureArm();
  const L = arm.pieces.find((p) => p.bone === 'left upper arm');
  const R = arm.pieces.find((p) => p.bone === 'right upper arm');
  assert.equal(L.mirrored, true);
  assert.equal(R.mirrored, false);
  // `+ 0` normalises IEEE negative zero, which deepEqual treats as
  // distinct from zero and which a rounded normal component hits often.
  const n0 = (piece) => [...packFpArm([piece]).packed.slice(6, 9)].map((x) => Math.round(x) + 0);
  // Rule 13 negates X, which REVERSES the triangle winding, which flips
  // the computed face normal inward. Negating it back is what makes the
  // two sides agree - and agreeing is the correct answer: both arms are
  // lit the same way by the same sun.
  assert.deepEqual(n0(L), n0(R), 'the mirrored side lights the same way as its twin');
  // The mutation, stated: drop the negate and they oppose.
  const notMirrored = n0({ ...L, mirrored: false });
  assert.notDeepEqual(notMirrored, n0(L),
    'and without the negate they do not - which is what the pin is for');
});

test('MW-D10 rule 54: the camera is a NODE OF THE RIG - Camera, then Head, then nothing', () => {
  // camera.cpp:346-357, verbatim:
  //   mTrackingNode = mAnimation->getNode("Camera");
  //   if (!mTrackingNode) mTrackingNode = mAnimation->getNode("Head");
  // There is no third fallback, and inventing one is what the retired
  // port mapper did - it fitted the arm's clip bounds into a fixed span
  // and pushed it a constant distance in front of the eye, which is the
  // arrangement in Mac's screenshot: forearms adrift at the horizon.
  const skel = (names) => ({ byName: new Map(names.map((n, i) => [n, i + 1])) });
  assert.equal(firstPersonCameraRef(skel(['bip01', 'camera', 'head'])), 2, 'Camera wins');
  assert.equal(firstPersonCameraRef(skel(['bip01', 'head'])), 2, 'Head is the fallback');
  assert.equal(firstPersonCameraRef(skel(['bip01', 'bip01 neck'])), -1, 'and nothing else is');
  assert.equal(firstPersonCameraRef(null), -1);
});

test('MW-D10: a rig with neither node REFUSES, naming the stage', async () => {
  // armskel deliberately carries no Camera and no Head (MW-D4 asserts a
  // skeleton that lacks a bone SAYS so), which makes it exactly the
  // refusal case rule 54 needs.
  const files = new Map([
    [fpSkeletonPath({}), f('armskel.nif')],
    [FP_CLIP_PATH, f('armidle.kf')],
    ['meshes/fixture/armhand.nif', f('armhand.nif')],
    ['meshes/fixture/armcuff.nif', f('armcuff.nif')],
  ]);
  const built = await buildFpArm({
    race: 'armrace',
    deps: {
      loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
      storedMorrowindNames: async () => ['armparts.esm'],
      loadMorrowindFile: async () => f('armparts.esm'),
    },
  });
  assert.equal(built.ok, false);
  assert.equal(built.stage, 'camera');
  assert.match(built.error, /no "Camera" bone and no "Head" bone/);
});

test('MW-D10: the Z-up rig turns into a Y-up pass - the conversion nothing in the chain made', async () => {
  // A Morrowind NIF is Z-UP with +Y forward; this renderer is Y-UP with
  // -Z forward. No reader, flattener, assembly or pass converted between
  // them, so the rig was drawn lying on its side and pointing away from
  // the viewer - the two end-on forearms in the report. Every existing
  // assertion was in MODEL space, which cannot see the frame it is drawn
  // in, so 38 mutants and three probes all passed.
  const { transformPoint } = await import('../src/world/mat4.js');
  const p = (x, y, z) => Array.from(transformPoint(NIF_TO_PASS, x, y, z)).map((v) => Math.round(v * 1e6) / 1e6 + 0);
  assert.deepEqual(p(0, 0, 1), [0, 1, 0], 'Morrowind UP becomes the pass UP');
  assert.deepEqual(p(0, 1, 0), [0, 0, -1], 'and Morrowind FORWARD becomes into the screen');
  assert.deepEqual(p(1, 0, 0), [1, 0, 0], 'while right stays right');

  // firstPersonEye reads the camera node's translation THROUGH the same
  // change, or the eye and the geometry end up in different spaces.
  const mats = new Map([[7, { t: [1, 2, 3] }]]);
  assert.deepEqual(firstPersonEye(mats, 7), [1, 3, -2]);
  assert.equal(firstPersonEye(mats, 9), null, 'and a missing node is not an eye at the origin');
});

test('MW-D10: the neck takes 0.75 of the look, and the port pitches the OTHER WAY', async () => {
  const built = await fpFixtureBuild();
  assert.equal(built.ok, true, built.error);
  const eyeAt = (neckPitch) => {
    poseAssembly(built.arm, {
      tracks: built.tracks, sampleTrack, time: built.clip.startTime, accumRoot: built.accumRoot, neckPitch,
    });
    return firstPersonEye(built.arm.mats, built.cameraRef);
  };
  const level = eyeAt(0);
  const down = eyeAt(0.4);        // Morrowind's rot[0] counts DOWNWARD
  assert.ok(down[2] < level[2], 'a positive neck pitch tips the eye forward, as rot[0] does');
  const up = eyeAt(-0.4);
  assert.ok(up[2] > level[2], 'and a negative one tips it back');
  assert.ok(Math.abs(down[1] - level[1]) > 1e-4, 'the eye MOVES with the neck - it is not a lens tilt');

  // 0.75, from npcanimation.cpp:719 `0.75f + 0.25f * mAimingFactor`,
  // with the aiming factor at its resting zero.
  assert.equal(FP_NECK_ROTATE_FACTOR, 0.75);
  // files/settings-default.cfg: `first person field of view = 60.0`.
  // Nothing in a picture says the lens is wrong - a narrower one just
  // makes the arms bigger - so the number is pinned against the file it
  // comes from.
  assert.equal(FP_FIELD_OF_VIEW, Math.PI / 3);

  // AND THE CONJUGATION. The controller expresses the pitch in the
  // OBJECT ROOT's frame and conjugates it into the node's own; with an
  // axis-aligned neck that is the identity, so armfp.nif TURNS its neck
  // 8 degrees and a port that rotates in the local frame moves the eye
  // somewhere else.
  const src2 = rd('src/formats/mwFirstPerson.js');
  assert.match(src2, /mul33\(mul33\(mul33\(w, rotate\), transpose33\(w\)\), local\.rotation\)/,
    'worldOrient * rotate * worldOrient^-1 * localRot, in that order');

  // AND THE SIGN CONVERSION. Morrowind counts pitch downward; this port
  // counts it upward (world.js SUBTRACTS the mouse's y delta). Passed
  // straight through, the neck rotates the arms the wrong way and
  // DOUBLES the loss - measured, a 0.25 look-up put every vertex out of
  // frame instead of sliding them a tenth of the way down it.
  const src = rd('src/combat/fpArm.js');
  assert.match(src, /neckPitch: cam \? -\(cam\.pitch \|\| 0\) : 0,/,
    'the port\'s upward pitch is negated into Morrowind\'s downward one');
});

test('MW-D10: the draw is rule 54 and nothing else - no framing, no offsets, no invented scale', () => {
  const src = rd('src/combat/fpArm.js');
  const draw = src.slice(src.indexOf('    draw(canvas)'), src.indexOf('    status()'));
  assert.match(draw, /const eye = firstPersonEye\(built\.arm\.mats, built\.cameraRef\);/,
    'the eye is the camera node, read fresh from the pose');
  assert.match(draw, /renderCharacterSprite\(mesh, NIF_TO_PASS, proj, view, pw, ph\)/,
    'and the model matrix is the basis change alone - no placement, no scale');
  assert.match(draw, /perspective\(FP_FIELD_OF_VIEW, pw \/ ph,/, 'rule 29\'s own field of view');
  // THE RETIRED MECHANISM, and the sentence goes with it: none of the
  // mapper's constants may come back, in the draw or anywhere else.
  for (const gone of ['ARM_FORWARD', 'ARM_DROP', 'ARM_CAST', 'ARM_TARGET_SPAN', 'armFraming', 'armModelPoint']) {
    assert.ok(!new RegExp(`\\\\b${gone}\\\\b`).test(src.replace(/^ \* .*$/gm, '')),
      `${gone} is retired, and code must not reach for it again`);
  }
  // The planes come off the arm's own reach, in RIG units, because the
  // file need not be authored in metres.
  assert.match(draw, /Math\.max\(built\.reach \/ 200, 1e-4\), built\.reach \* 4/);
});

test('MW-D8: a build that cannot reach its data REFUSES with a stage, and never throws', async () => {
  const none = await buildFpArm({ race: 'nord', deps: { loadMorrowindArchives: async () => [] } });
  assert.equal(none.ok, false);
  assert.equal(none.stage, 'data');
  assert.match(none.error, /no Morrowind \.bsa/);
  // A thrown reader is a named stage too, not a stack trace in the console.
  const boom = await buildFpArm({ race: 'nord', deps: { loadMorrowindArchives: async () => { throw new Error('kaboom'); } } });
  assert.equal(boom.ok, false);
  assert.equal(boom.stage, 'build');
  assert.equal(boom.error, 'kaboom');
  // An .esm is required and is named separately from the .bsa, because
  // they are attached separately and "it does not work" is not a reason.
  const noEsm = await buildFpArm({
    race: 'nord',
    deps: {
      loadMorrowindArchives: async () => [{ has: () => true, get: () => new Uint8Array(4) }],
      storedMorrowindNames: async () => ['Morrowind.bsa'],
    },
  });
  assert.equal(noEsm.ok, false);
  assert.match(noEsm.error, /\.esm/);
});

test('MW-D8: active() is false unless EVERY term holds - a frozen arm is not a reachable state', () => {
  const arm = createFpArm();
  assert.equal(arm.active(), false, 'unbuilt');
  assert.equal(arm.draw({ clientWidth: 100, clientHeight: 100 }), false, 'and draws nothing');
  arm.attach({}, () => ({ pos: [0, 0, 0], yaw: 0 }));
  assert.equal(arm.active(), false, 'a renderer and a camera alone are not an arm');
  // MWFIX2's failure: active() stayed true when the group lookup returned
  // null, so the player got a frozen bind-pose arm where the sprite had
  // been correct. Every term below independently prevents that.
  const src = rd('src/combat/fpArm.js');
  // MW-D12 split `state` into two slots. The term is now "SOME clip is
  // playing", which is the same guarantee: an arm with neither an idle
  // nor an action to pose from is the frozen bind pose, and the sprite
  // is the correct picture instead.
  // MW-D24 added the SEVENTH term: the first-person overlay is a
  // first-person predicate, and in third person it answers false by
  // design (the reference masks the whole FP root out of the scene,
  // Mask_FirstPerson on view change) - so weaponRig's fallthrough is
  // gated by the THIRD predicate at its own call site, never by this
  // one going quietly stale.
  // MW-D26 widened the clip term: SOME slot playing - action, movement
  // or idle - is the same guarantee (a rig with none is the frozen bind
  // pose, and the sprite is the correct picture).
  assert.match(src, /const active = \(\) => !!\(built && built\.ok && mesh && renderer && camera && \(actionState \|\| movementState \|\| idleState\)\s*&& viewMode === 'first'\);/,
    'built, built.ok, mesh, renderer, camera, a clip AND the first-person view - all seven');
});

test('MW-D8: the frame path is synchronous - no await, no dynamic import, in update or draw', () => {
  const src = rd('src/combat/fpArm.js');
  const body = src.slice(src.indexOf('    update(dt) {'), src.indexOf('    status()'));
  assert.ok(!/\bawait\b/.test(body), 'no await in the per-frame path');
  assert.ok(!/\bimport\s*\(/.test(body), 'and no dynamic import - a promise per frame is a stutter you cannot profile');
});

test('MW-D8: the arm IMPORTS the assembly law, it does not carry a second copy of it', () => {
  const src = rd('src/combat/fpArm.js');
  assert.match(src, /from '\.\.\/formats\/mwFirstPerson\.js'/, 'the law comes from its one home');
  for (const fn of ['assembleFirstPersonArm', 'poseAssembly', 'armPieceRows', 'clipReport']) {
    assert.ok(src.includes(fn), `${fn} is used`);
    assert.ok(!new RegExp(`function ${fn}\\b`).test(src), `and ${fn} is NOT redefined here`);
  }
  // MW7 died of two ports of one rule drifting apart. The tools-side
  // inspector re-exports the same module rather than owning a copy.
  assert.match(rd('src/tools/mwInspect.js'), /export \* from '\.\.\/formats\/mwFirstPerson\.js';/,
    'and the diagnostic page reads the same home through a shim');
});

// --- MW-D9: THE WEAPON ------------------------------------------------------

const wpdtRec = (id, model, type, name = 'W', { short = false, enchanted = false } = {}) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(short ? 16 : 32);
  new DataView(w.buffer).setInt16(8, type, true);   // MW-D22: mType is at byte 8 (loadweap.hpp) - 10 was the shared guess
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z(name)),
    ...(enchanted ? sub('ENAM', Z('ench')) : []), ...sub('WPDT', [...w])];
  return [...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d];
};

test('MW-D9: WPDT is read at a CITED offset, and a short record is refused not read past', async () => {
  const { weaponRecords, MW_WEAPON_TYPE } = await import('../src/formats/mwFirstPerson.js');
  // The layout is components/esm3/loadweap.hpp:71, quoted in the rules
  // doc: float mWeight; int32 mValue; int16 mType; ... - so mType is at
  // byte 10, and 4 + 4 + 2 is the whole derivation.
  const good = weaponRecords(Uint8Array.from(wpdtRec('iron longsword', 'w/x.nif', MW_WEAPON_TYPE.LongBladeOneHand)));
  assert.equal(good.length, 1);
  assert.equal(good[0].type, MW_WEAPON_TYPE.LongBladeOneHand);
  assert.equal(good[0].model, 'w/x.nif', 'and the MODL is lowercased with its slashes normalised');

  // THE BRANCH NO FIXTURE REACHES, which is why it is pinned here: a
  // truncated WPDT must leave the type at None rather than reading two
  // bytes of whatever follows. A wrong type is not a visible failure -
  // it is a sword drawn on the bow's bone, in the wrong hand, with
  // nothing on screen to say so.
  const short = weaponRecords(Uint8Array.from(wpdtRec('bad', 'w/x.nif', 9, 'W', { short: true })));
  assert.equal(short.length, 1, 'the record is still listed');
  assert.equal(short[0].type, MW_WEAPON_TYPE.None, 'with NO type, rather than a plausible one');
});

test('MW-D9 rules 8 + 17: the attach bone is a table, and the bow is why', async () => {
  const { weaponAttachBone, MW_WEAPON_TYPE, DEFAULT_WEAPON_BONE } = await import('../src/formats/mwFirstPerson.js');
  // Rule 8's column, read out. The reverted arc had FOUR weapon classes
  // and one bone; the bow is the only weapon that changes hands.
  assert.equal(weaponAttachBone(MW_WEAPON_TYPE.MarksmanBow), 'Weapon Bone Left');
  assert.equal(weaponAttachBone(MW_WEAPON_TYPE.Arrow), 'Bip01 Arrow');
  assert.equal(weaponAttachBone(MW_WEAPON_TYPE.Bolt), 'ArrowBone');
  for (const t of ['ShortBladeOneHand', 'LongBladeOneHand', 'LongBladeTwoHand', 'BluntOneHand',
    'BluntTwoClose', 'BluntTwoWide', 'SpearTwoWide', 'AxeOneHand', 'AxeTwoHand',
    'MarksmanCrossbow', 'MarksmanThrown']) {
    assert.equal(weaponAttachBone(MW_WEAPON_TYPE[t]), DEFAULT_WEAPON_BONE, `${t} takes the generic bone`);
  }
  // A crossbow is NOT a bow for this purpose, which is the row a
  // four-class taxonomy gets wrong by construction.
  assert.notEqual(weaponAttachBone(MW_WEAPON_TYPE.MarksmanCrossbow),
    weaponAttachBone(MW_WEAPON_TYPE.MarksmanBow));
});

test('MW-D9: the Daggerfall->Morrowind mapping is DECLARED, complete, and keyed by template', async () => {
  const { DF_TO_MW_WEAPON, dfWeaponToMw, MW_WEAPON_TYPE } = await import('../src/formats/mwFirstPerson.js');
  const { WEAPONS } = await import('../src/characters/weapons.js');
  // Every wieldable Daggerfall weapon template has a row. Arrow is
  // ammunition, not a wielded weapon, and is the only omission.
  const wieldable = Object.keys(WEAPONS).filter((k) => k !== 'Arrow');
  for (const k of wieldable) {
    assert.ok(k in DF_TO_MW_WEAPON, `${k} has a declared mapping`);
  }
  assert.equal(Object.keys(DF_TO_MW_WEAPON).length, wieldable.length, 'and no row maps a template that does not exist');

  // The rows that are JUDGEMENT, pinned so a change to them is a visible
  // change to a recorded divergence rather than a quiet edit.
  assert.equal(DF_TO_MW_WEAPON.Claymore, MW_WEAPON_TYPE.LongBladeTwoHand, 'a Claymore is TWO-handed in Morrowind');
  assert.equal(DF_TO_MW_WEAPON.Longsword, MW_WEAPON_TYPE.LongBladeOneHand, 'a Longsword is not');
  assert.equal(DF_TO_MW_WEAPON.Flail, MW_WEAPON_TYPE.BluntOneHand, 'Morrowind has no flail - this row is the fudge');
  assert.equal(DF_TO_MW_WEAPON.War_Axe, MW_WEAPON_TYPE.AxeOneHand);
  assert.equal(DF_TO_MW_WEAPON.Battle_Axe, MW_WEAPON_TYPE.AxeTwoHand);
  assert.equal(DF_TO_MW_WEAPON.Long_Bow, MW_WEAPON_TYPE.MarksmanBow);
  // MW-D21, after the retail report "the staff registers as a sword":
  // the ROW was never the problem - BluntTwoWide IS Morrowind's own
  // staff class, so this pin plus "never substitutes a type" below
  // makes a blade in a staff hand impossible from the mapping side.
  // What Mac saw was the pre-MW-D19 snapshot: an arm built holding a
  // sword kept it whatever the hand later held.
  assert.equal(DF_TO_MW_WEAPON.Staff, MW_WEAPON_TYPE.BluntTwoWide,
    "a Staff is Morrowind's own staff class");
  assert.equal(dfWeaponToMw({ templateIndex: WEAPONS.Staff }, WEAPONS), MW_WEAPON_TYPE.BluntTwoWide);

  // The resolver keys on templateIndex, NOT the sprite layer's
  // WEAPON_TYPES - which folds Claymore and Longsword into one class and
  // so cannot tell a one-hander from a two-hander.
  assert.equal(dfWeaponToMw({ templateIndex: WEAPONS.Claymore }, WEAPONS), MW_WEAPON_TYPE.LongBladeTwoHand);
  assert.equal(dfWeaponToMw({ templateIndex: WEAPONS.Longsword }, WEAPONS), MW_WEAPON_TYPE.LongBladeOneHand);
  // and NONE means no weapon is drawn, which is the honest answer.
  assert.equal(dfWeaponToMw(null, WEAPONS), MW_WEAPON_TYPE.None, 'unarmed');
  assert.equal(dfWeaponToMw({ werecreatureClaws: true }, WEAPONS), MW_WEAPON_TYPE.None, 'wereclaws');
  assert.equal(dfWeaponToMw({ templateIndex: WEAPONS.Arrow }, WEAPONS), MW_WEAPON_TYPE.None, 'ammunition');
  assert.equal(dfWeaponToMw({ templateIndex: 9999 }, WEAPONS), MW_WEAPON_TYPE.None, 'a torch');
});

test('MW-D9: picking a record prefers the material, avoids the enchanted, and never substitutes a type', async () => {
  const { weaponRecords, pickWeaponRecord, MW_WEAPON_TYPE } = await import('../src/formats/mwFirstPerson.js');
  const recs = weaponRecords(Uint8Array.from([
    ...wpdtRec('iron longsword', 'w/i.nif', MW_WEAPON_TYPE.LongBladeOneHand),
    ...wpdtRec('daedric longsword', 'w/d.nif', MW_WEAPON_TYPE.LongBladeOneHand),
    ...wpdtRec('ebony longsword of fire', 'w/e.nif', MW_WEAPON_TYPE.LongBladeOneHand, 'W', { enchanted: true }),
    ...wpdtRec('long bow', 'w/b.nif', MW_WEAPON_TYPE.MarksmanBow),
  ]));
  assert.equal(recs.length, 4);
  assert.equal(pickWeaponRecord(recs, MW_WEAPON_TYPE.LongBladeOneHand, 'Daedric').id, 'daedric longsword');
  assert.equal(pickWeaponRecord(recs, MW_WEAPON_TYPE.LongBladeOneHand, 'Iron').id, 'iron longsword');
  // Adamantium and Orcish both map onto ebony, whose only record here is
  // enchanted - so the fallback is another record of the RIGHT TYPE.
  assert.equal(pickWeaponRecord(recs, MW_WEAPON_TYPE.LongBladeOneHand, 'Orcish').enchanted, false,
    'an enchanted record is never taken: it carries a glow this slice does not draw');
  // THE REFUSAL. A longsword standing in for a bow would hang on the
  // wrong bone, in the wrong hand, and look entirely deliberate.
  assert.equal(pickWeaponRecord(recs, MW_WEAPON_TYPE.AxeTwoHand), null,
    'a type your archives do not carry is EMPTY HANDS, not a different weapon');
  // MW-D21, the staff end to end: with a sword IN the archives, a staff
  // hand picks the STAFF or nothing - never the blade.
  const withStaff = weaponRecords(Uint8Array.from([
    ...wpdtRec('iron longsword', 'w/i.nif', MW_WEAPON_TYPE.LongBladeOneHand),
    ...wpdtRec('wooden staff', 'w/s.nif', MW_WEAPON_TYPE.BluntTwoWide),
  ]));
  assert.equal(pickWeaponRecord(withStaff, MW_WEAPON_TYPE.BluntTwoWide).id, 'wooden staff');
  assert.equal(pickWeaponRecord(withStaff.filter((r) => r.type !== MW_WEAPON_TYPE.BluntTwoWide),
    MW_WEAPON_TYPE.BluntTwoWide), null, 'no staff in the archives is EMPTY HANDS, never the sword');
});

test('MW-D23: the actor\'s RIGHT lands SCREEN-RIGHT through the pass\'s OWN composition - no mirror', async () => {
  const { perspective, lookAt } = await import('../src/world/mat4.js');
  const src = readFileSync(new URL('../src/combat/fpArm.js', import.meta.url), 'utf8');

  // THE PIN MW-D9 SHIPPED HERE MANUFACTURED ITS LAW WITH A BACKWARDS
  // CAMERA: its probe view looked toward +Z while the real pass looks
  // toward -Z, so its "one metre to the player's right" test point was
  // on the player's LEFT, and the mirror it then demanded flipped a
  // correct pass - Mac's sword in the left hand, undetectable by hands
  // because a mirrored PAIR of hands looks like a correct pair. This
  // pin uses THE PASS'S OWN pieces: NIF_TO_PASS, the -Z-facing lookAt,
  // the unmirrored perspective, the same column-major multiply the
  // shader runs (uProj * uView * world), and asserts all three axes.
  const mul = (m, v) => [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ];
  const eye = [0, 15, 0];                         // camera node at MW (0,0,15)
  const view = lookAt(eye, [eye[0], eye[1], eye[2] - 1], [0, 1, 0]);
  const proj = perspective(FP_FIELD_OF_VIEW, 1.5, 0.01, 100);
  const ndc = (pmw) => {
    const clip = mul(proj, mul(view, mul(NIF_TO_PASS, [...pmw, 1])));
    return [clip[0] / clip[3], clip[1] / clip[3]];
  };
  // Morrowind's basis: actors face +Y with +Z up, so the actor's right
  // is +X (right = forward x up). One unit right, one forward, at eye
  // height:
  assert.ok(ndc([1, 1, 15])[0] > 0, 'the actor\'s RIGHT (+X) lands at positive NDC x - SCREEN-RIGHT');
  assert.ok(ndc([-1, 1, 15])[0] < 0, 'the actor\'s LEFT (-X) lands screen-left');
  assert.ok(ndc([0, 1, 16])[1] > 0, 'and UP (+Z) lands screen-UP - the basis turn is the right way round');
  assert.ok(ndc([0, 1, 14])[1] < 0, 'below the eye lands screen-down');

  // The source must NOT mirror this pass: the world's mirror belongs to
  // the world's own composition, and borrowing it across compositions
  // is how MW-D9's fix became MW-D23's bug.
  assert.match(src, /const proj = perspective\(FP_FIELD_OF_VIEW, pw \/ ph,/,
    'the arm\'s projection is the bare 60-degree lens');
  // MW-D34 loosened this from "the word appears nowhere" to "is never
  // imported or called": drawThird's comment now NAMES the world's
  // mirror to explain the -u chirality flip, and a comment is not a
  // lens. The FP pass still must not USE it.
  assert.ok(!/import[^;]*mirrorProjectionX/.test(src) && !/mirrorProjectionX\(/.test(src),
    'and mirrorProjectionX is never imported or called in the arm');
});

test('MW-D9c: EVERY .esm is read, not the first - an expansion first must not empty the arms', async () => {
  const { esmDiagnosis } = await import('../src/combat/fpArm.js');
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const PARTS = ['head', 'hair', 'neck', 'chest', 'groin', 'hand', 'wrist', 'forearm', 'upperarm'];
  const bodyRec = (id, race, part, model) => {
    const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z(race)),
      ...sub('BYDT', [PARTS.indexOf(part), 0, 0, 0])];
    return [...A('BODY'), ...U(d.length), ...U(0), ...U(0), ...d];
  };
  const bytes = (...recs) => Uint8Array.from(recs.flat());

  // THE DEFECT, reported live by Mac with three archives attached: the
  // build took the FIRST .esm the store listed. An expansion carries no
  // base-race BODY records, so with Bloodmoon.esm ahead of
  // Morrowind.esm every arm slot answered "no record for this actor" -
  // and the card had nothing more to say than that.
  const expansion = bytes(bodyRec('b_n_nord_m_hands.1st_x', 'nord', 'chest', 'b/x.nif'));
  const morrowind = bytes(bodyRec('b_n_breton_m_hands.1st', 'breton', 'hand', 'b/h.nif'));

  const { bodyParts, armReport, armMeshPaths } = await import('../src/formats/mwFirstPerson.js');
  const firstOnly = bodyParts(expansion);                                   // the old behaviour
  const allOfThem = [...bodyParts(expansion), ...bodyParts(morrowind)];     // the new one

  assert.equal(armMeshPaths(armReport(firstOnly, 'breton', false)).filter((r) => r.path).length, 0,
    'reading only the expansion resolves NO arm mesh - the reported failure, reproduced');
  assert.equal(armMeshPaths(armReport(allOfThem, 'breton', false)).filter((r) => r.path).length, 1,
    'and reading every .esm finds the hand, whatever order the store listed them in');

  // THE DIAGNOSIS. A slot with no record is not information; the race
  // asked for, beside the races the data actually carries, is.
  const bad = esmDiagnosis(['Bloodmoon.esm'], firstOnly, 'breton');
  assert.equal(bad.raceIsThere, false);
  assert.deepEqual(bad.racesFound, ['nord'], 'it names what IS there');
  assert.equal(bad.bodyRecords, 1);
  assert.deepEqual(bad.files, ['Bloodmoon.esm'], 'and which file it read');
  const good = esmDiagnosis(['Bloodmoon.esm', 'Morrowind.esm'], allOfThem, 'breton');
  assert.equal(good.raceIsThere, true);
  assert.deepEqual(good.racesFound, ['breton', 'nord']);
});

test('MW-D9f: a built arm reaches the screen - the update gate is not the draw gate', async () => {
  // THE DEFECT, reported by Mac as "still not seeing it ingame even
  // though it's built", and it was never about his data.
  //
  //   active() = built && ok && MESH && renderer && camera && state
  //   mesh is created by update(), on its first run
  //   the rig ran update ONLY when active()
  //
  // No mesh, so not active; not active, so never updated; never updated,
  // so no mesh. A perfectly built arm sat at frames 0 for the life of the
  // tab and the classic sprite drew in its place. Every existing pin
  // drove update() directly and the browser probe drove its own loop, so
  // all of them ran the ENGINE and none of them ran the SEAM.
  //
  // This one builds a real arm through the real build path (fixture
  // archives, fixture .esm) and then runs THE RIG'S OWN CONDITION.
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ]);
  const deps = {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => f('armfp.esm'),
  };
  let made = 0;
  let sprites = 0; let composites = 0;
  const renderer = {
    gl: null,
    createCharacterMesh: () => { made++; return { vao: {}, buffers: [] }; },
    updateCharacterMesh: () => {},
    renderCharacterSprite: () => { sprites++; return { tex: {} }; },
    drawScreenOverlayQuad: () => { composites++; },
    createCharacterTexture: (mips) => ({ mips }),
  };
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: 0 }));

  const built = await arm.build({ race: 'fprace', deps });
  assert.equal(built.ok, true, built.ok ? '' : `${built.stage}: ${built.error}`);
  // Rule 3's missing-slot arm stays exercised: this .esm has hand and
  // upper arm only.
  assert.deepEqual(built.notes.filter((n) => /no record/.test(n)),
    ['wrist: no record for this actor', 'upperarm: no record for this actor']);

  // A built arm is NOT yet drawable - there is no GPU mesh until a frame
  // runs, and drawing without one is the frozen-arm failure.
  assert.equal(arm.active(), false, 'built is not drawable');
  assert.equal(arm.frames, 0);
  assert.equal(made, 0);
  // ...but it IS ready to be stepped, which is the distinction the rig
  // collapsed.
  assert.equal(arm.ready(), true, 'and a built arm is ready to step');

  // THE RIG'S PER-FRAME LINE, run as the rig runs it.
  for (let i = 0; i < 3; i++) if (arm.ready()) arm.update(1 / 60);
  assert.equal(arm.frames, 3, 'the rig gate must actually step the arm');
  assert.equal(made, 1, 'and the mesh is created once, then updated in place');
  assert.equal(arm.active(), true, 'so the very next draw call has something to draw');
  assert.notEqual(arm.draw({ clientWidth: 320, clientHeight: 200 }), false,
    'and draw() no longer refuses');
  assert.equal(sprites, 1, 'the offscreen first-person pass ran');
  assert.equal(composites, 1, 'and it was composited over the scene');
  assert.ok(arm.status().pieces > 0);
});

test('MW-D9f: the rig gates the step on ready() and the draw on active()', () => {
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /if \(!paralyzed && fpArm\.ready\(\)\) \{/,
    'the per-frame step rides ready()');
  assert.match(rig, /fpArm\.update\(dt\);/, 'and update is what it gates');
  assert.ok(!/fpArm\.active\(\)\) fpArm\.update/.test(rig),
    'and never active(), which cannot be true until update has already run');
  assert.match(rig, /if \(fpArm\.active\(\)\) \{ fpArm\.draw\(c\); return; \}/,
    'while the draw still rides active() - the mesh term is a DRAW term');

  // ready() must not require the mesh, or the deadlock comes straight back.
  const src = rd('src/combat/fpArm.js');
  assert.match(src, /const ready = \(\) => !!\(built && built\.ok && \(actionState \|\| movementState \|\| idleState\) && renderer\);/,
    'ready() is update()\'s own requirements - no mesh term, no camera term (MW-D26 widened the clip term)');
});

test('MW-D11 rule 36: the texture path is FOUR PROBES over a re-rooted, extension-swapped name', async () => {
  const { correctTexturePath, normalizeVfsPath, findDirectory, changeExtension } =
    await import('../src/formats/mwTexture.js');

  // THE REASON THE LAW EXISTS, in one line: Bethesda converted the BSA
  // textures from TGA to DDS and left every reference saying .tga
  // (resourcehelpers.cpp:133-135). A mesh asks for a file the archive
  // does not have under that name.
  const archive = new Set(['textures/tx_hand.dds']);
  const has = (p) => archive.has(p);
  assert.equal(correctTexturePath('tx_hand.tga', has), 'textures/tx_hand.dds');
  assert.equal(correctTexturePath('TX_Hand.TGA', has), 'textures/tx_hand.dds', 'and it lowercases');
  assert.equal(correctTexturePath('textures\\tx_hand.tga', has), 'textures/tx_hand.dds',
    'backslashes are separators');

  // RE-ROOTING: everything before the matched component is DISCARDED,
  // which is how an absolute authoring path resolves. The SUBDIRECTORY
  // has to survive the re-root, or the basename fallback silently
  // rescues the easy case and hides a prefix-test that never re-roots at
  // all - which is exactly what a mutant proved.
  assert.equal(correctTexturePath('D:\\Bethesda\\Data Files\\Textures\\tx_hand.tga', has),
    'textures/tx_hand.dds');
  const deep = (p) => p === 'textures/deep/tx_sub.dds';
  assert.equal(correctTexturePath('D:\\Morrowind\\Data Files\\Textures\\deep\\tx_sub.tga', deep),
    'textures/deep/tx_sub.dds', 'the path BELOW the matched component is kept');
  // ...but only on a WHOLE component that is not the LAST one.
  assert.equal(findDirectory('mytextures/x.tga', 'textures'), -1, 'not a partial component');
  assert.equal(findDirectory('foo/textures', 'textures'), -1, 'and not the final component');
  assert.equal(findDirectory('x/textures/y/z.tga', 'textures'), 2, 'the inner component matches');
  assert.equal(correctTexturePath('foo/textures', has), 'textures/foo/textures',
    'so a trailing "textures" gets the prefix instead of being re-rooted');

  // THE FOUR PROBES, each one reachable.
  assert.equal(correctTexturePath('tx_a.tga', (p) => p === 'textures/tx_a.dds'),
    'textures/tx_a.dds', '1: the swapped path');
  assert.equal(correctTexturePath('tx_b.tga', (p) => p === 'textures/tx_b.tga'),
    'textures/tx_b.tga', '2: the original extension');
  assert.equal(correctTexturePath('deep/dir/tx_c.tga', (p) => p === 'textures/tx_c.dds'),
    'textures/tx_c.dds', '3: the basename under the FRONT directory, swapped');
  assert.equal(correctTexturePath('deep/dir/tx_d.tga', (p) => p === 'textures/tx_d.tga'),
    'textures/tx_d.tga', '4: the basename under the front directory, original extension');
  // ALL FOUR MISS -> the .dds candidate, NOT the authored name. The
  // caller then fails to open it and gets the warning image, which is
  // what makes a missing texture visible.
  // ...and the candidate KEEPS the re-rooted directory; only the two
  // basename fallbacks flatten it.
  assert.equal(correctTexturePath('nope/tx_e.tga', () => false), 'textures/nope/tx_e.dds');

  // bookart is the second top-level directory, and its MISSES fall back
  // under textures/ - the fallbacks use the FRONT of the list, never the
  // directory that matched.
  assert.equal(correctTexturePath('bookart/cover.tga', (p) => p === 'bookart/cover.dds'),
    'bookart/cover.dds');
  assert.equal(correctTexturePath('bookart/cover.tga', (p) => p === 'textures/cover.dds'),
    'textures/cover.dds');

  // changeExtension refuses when there is no '.' after the last '/', and
  // that refusal DISABLES probes 2 and 4 - so an extensionless name is
  // two probes, not four.
  assert.deepEqual(changeExtension('textures/tx_hand', 'dds'), { path: 'textures/tx_hand', changed: false });
  assert.deepEqual(changeExtension('a.b/c.tga', 'dds'), { path: 'a.b/c.dds', changed: true });
  const probed = [];
  correctTexturePath('tx_noext', (p) => { probed.push(p); return false; });
  assert.deepEqual(probed, ['textures/tx_noext', 'textures/tx_noext'],
    'two probes, because there is no extension to swap back to');

  // Normalization: duplicate separators collapse and ONE leading
  // separator is stripped, because the archive index is built that way.
  assert.equal(normalizeVfsPath('\\\\Textures\\\\\\\\tx.TGA'), 'textures/tx.tga');
});

test('MW-D11: the clamp bits are the other way round, and a miss is magenta', async () => {
  const { wrapModes, warningImage, GL_REPEAT, GL_CLAMP_TO_EDGE } =
    await import('../src/formats/mwTexture.js');
  // property.hpp:70-71 - wrapT is bit 0 and wrapS is bit 1, which is the
  // reverse of what the names suggest.
  // The GL enums by VALUE, not by symbol: asserting wrapModes against
  // the module's own constants passes even when the constant is wrong.
  assert.equal(GL_REPEAT, 0x2901);
  assert.equal(GL_CLAMP_TO_EDGE, 0x812f);
  assert.deepEqual(wrapModes(3), { wrapS: 0x2901, wrapT: 0x2901 }, 'the common value repeats both');
  assert.deepEqual(wrapModes(0), { wrapS: 0x812f, wrapT: 0x812f },
    'and a clear bit is CLAMP_TO_EDGE, not GL_CLAMP and not REPEAT');
  assert.deepEqual(wrapModes(1), { wrapS: 0x812f, wrapT: 0x2901 }, 'bit 0 is T');
  assert.deepEqual(wrapModes(2), { wrapS: 0x2901, wrapT: 0x812f }, 'bit 1 is S');

  // imagemanager.cpp:28-43. A MISSING TEXTURE IS NOT A REFUSAL - it is
  // an 8x8 solid magenta that says so on the model.
  const w = warningImage();
  assert.equal(w.width, 8);
  assert.equal(w.height, 8);
  assert.deepEqual([...w.mips[0].rgba.slice(0, 4)], [255, 0, 255, 255]);
  assert.equal(w.mips[0].rgba.length, 8 * 8 * 4);
});

test('MW-D11: the arm resolves, decodes and de-duplicates the textures its meshes name', async () => {
  const built = await fpFixtureBuild();
  assert.equal(built.ok, true, built.error);

  // The fixture meshes name "tx_fixture.TGA" and the archive carries it
  // as textures/tx_fixture.dds - the swap, end to end, on real bytes.
  assert.equal(built.textures.size, 1, 'four pieces, two meshes, ONE decode');
  const entry = built.textures.get('tx_fixture.tga');
  assert.ok(entry, 'keyed by the name the mesh authored');
  assert.equal(entry.ok, true, entry.error);
  assert.equal(entry.path, 'textures/tx_fixture.dds');
  assert.equal(entry.image.width, 8);
  assert.equal(entry.image.height, 8);

  // Every piece carries its material through to the pack, INCLUDING the
  // rigid one - which used to keep only its positions, so its texture
  // never reached the draw at all.
  const rigid = built.arm.pieces.filter((p) => p.kind === 'rigid');
  assert.ok(rigid.length > 0, 'the fixture has a rigid piece');
  for (const p of built.arm.pieces) {
    assert.equal(p.material.textureFile, 'tx_fixture.tga', `${p.kind} piece kept its material`);
    assert.ok(p.uvs && p.uvs.length, `${p.kind} piece kept its UVs`);
  }

  // And the pack hands the draw one range per piece, each naming its own
  // texture, with WHITE in the colour channel - the reference's material
  // default, so texel * colour is the texel.
  const { packed, ranges } = packFpArm(built.arm.pieces);
  assert.ok(ranges.every((r) => r.textureFile === 'tx_fixture.tga'));
  assert.deepEqual([...packed.slice(3, 6)], [1, 1, 1], 'no invented skin tone survives');
  // The UV pair is the last two floats of each vertex.
  const uvsSeen = new Set();
  for (let i = 0; i < packed.length; i += FP_FLOATS) {
    uvsSeen.add(`${packed[i + 9]},${packed[i + 10]}`);
  }
  assert.ok(uvsSeen.size > 1, 'the UVs vary across the mesh - they are not all zero');
});

test('MW-D11: a texture the archives do not carry becomes the warning image, not a refusal', async () => {
  const { warningImage } = await import('../src/formats/mwTexture.js');
  const pieces = [{ material: { textureFile: 'tx_absent.tga' } }];
  const empty = collectArmTextures(pieces, [{ has: () => false, get: () => null }]);
  const entry = empty.get('tx_absent.tga');
  assert.equal(entry.ok, false);
  assert.equal(entry.path, 'textures/tx_absent.dds', 'the .dds candidate is what it tried to open');
  assert.deepEqual(entry.image.mips[0].rgba.slice(0, 4), warningImage().mips[0].rgba.slice(0, 4));

  // A DECODE failure is the same answer - the arm still builds.
  const junk = collectArmTextures(pieces, [{
    has: (p) => p === 'textures/tx_absent.dds',
    get: () => new Uint8Array(200),
  }]);
  assert.equal(junk.get('tx_absent.tga').ok, false);
  assert.match(junk.get('tx_absent.tga').error, /DDS/);
});

// --- MW-D18: A MISSING HAND IS A SENTENCE, NOT A HOLE ----------------------
//
// Mac's report from retail: "hands are missing". Two doors could eat a
// hand without a word: bindPart THREW on one absent weighted bone (rule
// 40 says the reference skips it and draws), and a shape that fails rule
// 15's filter on every bone bound nothing and said nothing. Both are
// exercised through the REAL assembly on a byte-patched armhand - the
// left bone (and with it the left shape) renamed to a name armskel has
// never carried, same byte length, so the file stays valid.

test('MW-D18 rules 40+15: the assembly binds what it can and NAMES what it cannot', async () => {
  const patched = Buffer.from(f('armhand.nif'));
  for (let i; (i = patched.indexOf('Left Hand')) >= 0;) patched.write('Left Xand', i);
  const arm = await assembleFirstPersonArm({
    skeletonBytes: f('armskel.nif'),
    parts: [{ slot: 'hand', bytes: new Uint8Array(patched) }],
  });
  assert.ok(arm.ok, 'one side still binds - the part is not dropped whole');
  const hands = arm.pieces.filter((p) => p.slot === 'hand');
  assert.equal(hands.length, 1, 'the right hand made it');
  assert.equal(hands[0].bone, 'right hand');
  assert.ok(arm.notes.some((n) => /hand: this skeleton has no bone "left xand" - those influences are skipped \(rule 40\)/.test(n)),
    `rule 40 names the skipped bone (notes: ${arm.notes.join(' | ')})`);
  assert.ok(arm.notes.some((n) => /hand @ left hand: no shape matched - the mesh offers "Tri Right Hand", "Tri Left Xand"/.test(n)),
    `rule 15's miss lists what the file offered (notes: ${arm.notes.join(' | ')})`);
});

test('MW-D18: a healthy part still binds both sides with NO notes', async () => {
  // The guard on the guard: notes must appear only when something is
  // actually wrong, or the card cries wolf and Mac stops reading it.
  const arm = await assembleFirstPersonArm({
    skeletonBytes: f('armskel.nif'),
    parts: [{ slot: 'hand', bytes: f('armhand.nif') }],
  });
  assert.equal(arm.pieces.filter((p) => p.slot === 'hand').length, 2);
  assert.deepEqual(arm.notes, []);
});

// --- MW-D20: ONE SPACE - THE HOSTILE RIG -----------------------------------
//
// armskelx's root is "Bip01" AT (2,0,10) - a transform rule 34 KEEPS -
// with "Spine" (0,0,5) between it and the hands. armhandx declares its
// skin root at that mid-chain "Spine", carries a skin transform of
// z+0.5, and its LEFT shape carries its OWN z+0.25. armcuffx is rigid
// with a BoneOffset of (0.5,0,0). Under the retired law (matrices
// relative to the DECLARED root for skinned pieces, to the FILE root
// for rigid ones, shape transforms ignored) every one of these terms
// lands somewhere else; under the reference's one graph space the
// numbers below fall out by hand:
//
//   Left Hand graph rest  = (2,0,10)+(0,0,5)+( 1,0,0) = (3,0,15)
//   Right Hand graph rest = (2,0,10)+(0,0,5)+(-1,0,0) = (1,0,15)
//   invBinds are the negations, so the blend is identity at rest and a
//   skinned vert lands at authored + skinT(z+.5) [+ own z+.25 on the left]
//   rigid: bone o boneOffset o mirror, every term nonzero.

test('MW-D20: skinned pieces land in GRAPH space - declared roots and shape transforms included', async () => {
  const arm = await assembleFirstPersonArm({
    skeletonBytes: f('armskelx.nif'),
    parts: [{ slot: 'hand', bytes: f('armhandx.nif') }],
  });
  assert.ok(arm.ok, arm.error);
  const left = arm.pieces.find((p) => p.bone === 'left hand');
  const right = arm.pieces.find((p) => p.bone === 'right hand');
  assert.ok(left && right, 'both sides bind');
  // Left, in the reference's order blend -> skinTransform -> shape's own
  // transform (an Rz90 WITH translation, so the order cannot commute):
  //   v0 (3.2,0,15.2) +skinT(0.3,0,0.5) = (3.5,0,15.7)
  //      Rz90 (x'=-y, y'=x)             = (0,3.5,15.7)
  //      +own t(0,0,0.25)               = (0,3.5,15.95)
  assert.deepEqual(
    [...left.positions].map((x) => +x.toFixed(4) + 0),
    [0, 3.5, 15.95, 0, 4.1, 15.95, 0, 3.8, 16.55]);
  // Right: authored + (0,0,0.5), no own transform.
  assert.deepEqual(
    [...right.positions].map((x) => +x.toFixed(4)),
    [0.7, 0, 15.7, 1.3, 0, 15.7, 1.0, 0, 16.3]);
});

test('MW-D20: rigid pieces ride the SAME space - bone o boneOffset o mirror, every term live', async () => {
  const arm = await assembleFirstPersonArm({
    skeletonBytes: f('armskelx.nif'),
    parts: [
      { slot: 'hand', bytes: f('armhandx.nif') },
      { slot: 'cuff', bones: ['Left Hand'], bytes: f('armcuffx.nif') },
    ],
  });
  assert.ok(arm.ok, arm.error);
  const cuff = arm.pieces.find((p) => p.slot === 'cuff');
  assert.ok(cuff && cuff.kind === 'rigid' && cuff.mirrored, 'rigid, on the left, mirrored');
  assert.deepEqual(cuff.boneOffset, [0.5, 0, 0], 'rule 14 found the offset');
  // world = LeftHand(3,0,15) + offset(0.5,0,0) + mirror(v):
  //   (0.2,0,0.1) -> (-0.2,0,0.1) -> (3.3, 0, 15.1)
  assert.deepEqual(
    [...cuff.positions].map((x) => +x.toFixed(4)),
    [3.3, 0, 15.1, 3.1, 0, 15.1, 3.2, 0, 15.3]);
  // One space is not asserted by proximity here - the left shape's own
  // Rz90 rotates its geometry away on purpose - it is asserted by the
  // EXACT values: the cuff's (3,0,15) anchor and the skinned pins above
  // are both the same graph rest of the same bones, derived by hand.
});

test('MW-D20: the camera bone reads from the same space (rule 54 stays coherent)', async () => {
  const arm = await assembleFirstPersonArm({
    skeletonBytes: f('armskelx.nif'),
    parts: [{ slot: 'hand', bytes: f('armhandx.nif') }],
  });
  const camRef = firstPersonCameraRef(arm.skeleton);
  assert.ok(camRef >= 0);
  const eye = firstPersonEye(arm.mats, camRef);
  // Camera graph rest = (2,0,10)+(0,0,5)+(0,0,7) = (2,0,22); the eye is
  // that point through rule 54's Z-up -> Y-up basis, [x, z, -y]. The old
  // law answered (0,12,0) - the root's kept transform never reached it.
  assert.deepEqual([...eye].map((x) => +x.toFixed(4) + 0), [2, 22, 0]);
});

test('MW-D20: the neck conjugates in the OBJECT ROOT frame - the file root\'s rotation is inside it', async () => {
  // armneckx's root is Bip01 rotated Rz90 (kept by rule 34). The
  // reference's RotateController conjugates by the orientation relative
  // to mObjectRoot, which sits ABOVE the file root - so W includes that
  // Rz90 and pitching the neck becomes a rotation about the GRAPH's Y:
  //   W = Rz90;  W . Rx(-t) . W^T = Ry(-t)
  //   rows: [c,0,-s],[0,1,0],[s,0,c]  with t = pitch * (0.75+0.25*aim)
  // Under the retired root-relative frame W was identity and the answer
  // stayed Rx(-t) - a neck that pitches about the wrong axis the moment
  // a retail root carries rotation.
  const { poseSkeleton, buildSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } =
    await import('../src/formats/mwSkin.js');
  const { applyFirstPersonNeck } = await import('../src/formats/mwFirstPerson.js');
  const { sampleTrack: st } = await import('../src/formats/mwAnim.js');
  const skel = buildSkeleton(parseNif(f('armneckx.nif')));
  // Through poseAssembly - the REAL call site - so a caller that hands
  // the conjugation a root-relative frame dies here, not only a direct
  // call with the right argument.
  void applyFirstPersonNeck; void GRAPH_ROOT;
  const rootRef = [...skel.nodes.entries()].find(([, n]) => n.parent < 0)[0];
  const assembly = {
    fns: { poseSkeleton, skelMats: skeletonSpaceMatrices },
    skeleton: skel, rootRef, pieces: [],
  };
  poseAssembly(assembly, { sampleTrack: st, neckPitch: 0.4, neckAim: 1 });
  const rot = [...assembly.pose.get(skel.byName.get('bip01 neck')).rotation];
  const c = Math.cos(0.4); const s = Math.sin(0.4);
  const want = [c, 0, -s, 0, 1, 0, s, 0, c];
  for (let i = 0; i < 9; i++) {
    assert.ok(Math.abs(rot[i] - want[i]) < 1e-5,
      `element ${i}: ${rot[i]} vs Ry(-0.4)'s ${want[i]}`);
  }
});

test('MW-D22: mType reads from byte EIGHT, pinned against a layout the writer cannot share', async () => {
  const { weaponRecords, MW_WEAPON_TYPE } = await import('../src/formats/mwFirstPerson.js');
  // Every WPDT field planted with a DISTINCT value, laid out by hand
  // from loadweap.hpp's struct - NOT through wpdtRec, which was authored
  // from the same guess as the reader and so proved nothing for two
  // slices: reader at 10, writer at 10, retail at 8. weight 1.5f,
  // value 7, TYPE 5 at [8..9], health 999 at [10..11] - a reader still
  // on byte 10 answers 999 and dies here.
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  const dv = new DataView(w.buffer);
  dv.setFloat32(0, 1.5, true);      // mWeight
  dv.setInt32(4, 7, true);          // mValue
  dv.setInt16(8, 5, true);          // mType = BluntTwoWide
  dv.setUint16(10, 999, true);      // mHealth - the byte the old reader took
  dv.setFloat32(12, 1.25, true);    // mSpeed
  dv.setFloat32(16, 1.0, true);     // mReach
  const d = [...sub('NAME', Z('wooden staff')), ...sub('MODL', Z('w/staff.nif')),
    ...sub('FNAM', Z('Wooden Staff')), ...sub('WPDT', [...w])];
  const esm = Uint8Array.from([...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d]);
  const recs = weaponRecords(esm);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].type, MW_WEAPON_TYPE.BluntTwoWide,
    'the type is the int16 at offset 8 - not mHealth at 10, which retail play read for two slices');
});

// ── MW-D24: THE THIRD-PERSON BODY, TWO RIGS AND ONE MACHINE ─────────

import { tpSkeletonPath } from '../src/combat/fpArm.js';
import { tpAnimSources, playerBodyRows, TP_BASE_MODEL } from '../src/formats/mwFirstPerson.js';

test('MW-D24 rule 6: the third-person skeleton column (actorutil.cpp:504-513)', () => {
  assert.equal(tpSkeletonPath({}), 'meshes/base_anim.nif');
  assert.equal(tpSkeletonPath({ female: true }), 'meshes/base_anim_female.nif');
  assert.equal(tpSkeletonPath({ beast: true }), 'meshes/base_animkna.nif');
  // beast wins over sex, exactly as the reference's if-ladder orders it
  assert.equal(tpSkeletonPath({ female: true, beast: true }), 'meshes/base_animkna.nif');
});

test('MW-D24: the third-person anim sources - base first, own second, extension swap ONLY', () => {
  // npcanimation.cpp:534-538 (base then defaultSkeleton) and
  // animation.cpp:651-654 (the kf name is the model with .nif -> .kf,
  // NO "x" inserted - base_anim.nif looks for base_anim.kf).
  assert.equal(TP_BASE_MODEL, 'meshes/xbase_anim.nif');
  const all = new Set(['meshes/xbase_anim.kf', 'meshes/base_anim.kf']);
  assert.deepEqual(tpAnimSources('meshes/base_anim.nif', (p) => all.has(p)),
    ['meshes/xbase_anim.kf', 'meshes/base_anim.kf']);
  // retail has no base_anim.kf: the base alone serves
  const baseOnly = new Set(['meshes/xbase_anim.kf']);
  assert.deepEqual(tpAnimSources('meshes/base_anim.nif', (p) => baseOnly.has(p)),
    ['meshes/xbase_anim.kf']);
  // and a female skeleton adds ITS own kf when present, no x inserted
  const fem = new Set(['meshes/xbase_anim.kf', 'meshes/base_anim_female.kf']);
  assert.deepEqual(tpAnimSources('meshes/base_anim_female.nif', (p) => fem.has(p)),
    ['meshes/xbase_anim.kf', 'meshes/base_anim_female.kf']);
});

test('MW-D24: playerBodyRows - third-person records, sex fallback, no 1st, tails only on beasts', () => {
  const P = (id, slot, { race = 'fprace', female = false, skin = true, playable = true } = {}) => ({
    id, slot, race, female, skin, playable, firstPerson: id.toLowerCase().endsWith('1st'),
    model: `fixture/${id}.nif`,
  });
  const parts = [
    P('b_hand_m', 'hand'), P('b_hand_f', 'hand', { female: true }),
    P('b_chest_m', 'chest'),
    P('b_hands.1st', 'hand'),                       // rule 1: never the visible body
    P('b_head_01', 'head'), P('b_head_02', 'head'),  // first in file order wins
    P('b_other', 'hand', { race: 'otherrace' }),
  ];
  const male = playerBodyRows(parts, 'fprace', false);
  const bySlot = new Map(male.map((r) => [r.slot, r]));
  assert.equal(bySlot.get('hand').record.id, 'b_hand_m');
  assert.equal(bySlot.get('chest').record.id, 'b_chest_m');
  assert.equal(bySlot.get('head').record.id, 'b_head_01', 'faceIndex 0 lands on the id-sorted first');
  assert.equal(bySlot.has('tail'), false, 'a missing tail on a non-beast race is the data being right');
  const female = playerBodyRows(parts, 'fprace', true);
  const fBySlot = new Map(female.map((r) => [r.slot, r]));
  assert.equal(fBySlot.get('hand').record.id, 'b_hand_f', 'sex-matched when a female record exists');
  assert.equal(fBySlot.get('chest').record.id, 'b_chest_m', 'male fallback when it does not');
  // a beast race REPORTS its missing tail rather than skipping it
  const beast = playerBodyRows(parts, 'fprace', false, { beast: true });
  assert.equal(beast.find((r) => r.slot === 'tail').verdict, 'NOTHING for this slot');
});

test('MW-D27: the face is DERIVED - classic faceIndex picks the head and hair, and nothing else moves', () => {
  // Mac's call: chargen stays byte-for-byte classic; the Morrowind face
  // is a pure function of what the save already carries. faceIndex
  // walks the race-and-sex's own head and hair pools, modulo, over an
  // ID-SORTED order - file order is a property of the load, not the
  // character, and two archive arrangements must not give one save two
  // faces. MUTANT: drop the sort and the shuffled fixture fails; index
  // the chest and its assert fails; forget the modulo and index 10
  // throws or lands nowhere.
  const P = (id, slot, { female = false } = {}) => ({
    id, slot, race: 'fprace', female, skin: true, playable: true, firstPerson: false,
    model: `fixture/${id}.nif`,
  });
  // DELIBERATELY SHUFFLED file order; sorted order is 01,02,03.
  const parts = [
    P('b_head_02', 'head'), P('b_head_03', 'head'), P('b_head_01', 'head'),
    P('b_hair_02', 'hair'), P('b_hair_01', 'hair'),
    P('b_chest_02', 'chest'), P('b_chest_01', 'chest'),
    P('b_head_f1', 'head', { female: true }), P('b_head_f2', 'head', { female: true }),
  ];
  const at = (i, female = false) => {
    const rows = playerBodyRows(parts, 'fprace', female, { faceIndex: i });
    const m = new Map(rows.map((r) => [r.slot, r.record?.id]));
    return { head: m.get('head'), hair: m.get('hair'), chest: m.get('chest') };
  };
  // The walk, sorted: heads 01,02,03 then wraps; hairs 01,02 then
  // wraps. The CHEST stays 01 - the fixture lists it LAST, and the
  // reference's sweep OVERWRITES on every proper match, so the last
  // record in load order wins (getBodyParts, npcanimation.cpp:1286-1293
  // - how an expansion overrides a base-game body). The parity audit
  // caught this pin asserting first-wins; the face law (MW-A F2's
  // id-sort + index) is untouched, because head and hair are not in
  // the sweep at all.
  assert.deepEqual(at(0), { head: 'b_head_01', hair: 'b_hair_01', chest: 'b_chest_01' });
  assert.deepEqual(at(1), { head: 'b_head_02', hair: 'b_hair_02', chest: 'b_chest_01' });
  assert.deepEqual(at(2), { head: 'b_head_03', hair: 'b_hair_01', chest: 'b_chest_01' });
  assert.equal(at(3).head, 'b_head_01', 'the index wraps by modulo');
  assert.equal(at(9).hair, 'b_hair_02', 'classic\u2019s full 0..9 range resolves');
  // Sex pools stay separate: a female walks HER two heads, never his three.
  assert.equal(at(0, true).head, 'b_head_f1');
  assert.equal(at(1, true).head, 'b_head_f2');
  assert.equal(at(2, true).head, 'b_head_f1', 'the female pool wraps at ITS count');
  // The default is index 0 - every existing caller keeps its face.
  const plain = playerBodyRows(parts, 'fprace', false);
  assert.equal(new Map(plain.map((r) => [r.slot, r.record?.id])).get('head'), 'b_head_01');
});

/** A minimal TES3 BODY record, laid out by hand (record = name[4] +
 *  size + 8 header bytes + subrecords; each sub = name[4] + size +
 *  data) - so no writer shares the reader's guess. */
function bodyRec(id, model, race, part, { female = false } = {}) {
  const sub = (name, data) => {
    const b = new Uint8Array(8 + data.length);
    b.set([...name].map((c) => c.charCodeAt(0)), 0);
    new DataView(b.buffer).setUint32(4, data.length, true);
    b.set(data, 8);
    return b;
  };
  const z = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)).concat(0));
  const bydt = new Uint8Array(4);
  bydt[0] = part; bydt[2] = female ? 1 : 0; bydt[3] = 0;   // BPF_Female=1; MT_Skin=0
  const subs = [sub('NAME', z(id)), sub('MODL', z(model)), sub('FNAM', z(race)), sub('BYDT', bydt)];
  const size = subs.reduce((a, s) => a + s.length, 0);
  const rec = new Uint8Array(16 + size);
  rec.set([..."BODY"].map((c) => c.charCodeAt(0)), 0);
  new DataView(rec.buffer).setUint32(4, size, true);
  let o = 16;
  for (const s of subs) { rec.set(s, o); o += s.length; }
  return rec;
}

async function fpFixtureBuildWithBody() {
  // The FP fixture build, PLUS the third-person names: the same rig
  // bytes serve as base_anim.nif (the 3P build asks no camera of it)
  // and the same idle .kf as xbase_anim.kf - what is under test is the
  // PATH LAW and the two-rig machine, not new geometry.
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
    // RULE 18 x-swaps the settings name when the x-form's kf exists -
    // which retail HAS (xbase_anim.nif + xbase_anim.kf), so the fixture
    // carries the retail arrangement and the 3P root resolves to the
    // x-model exactly as OpenMW's does.
    ['meshes/xbase_anim.nif', f('armfp.nif')],
    ['meshes/xbase_anim.kf', f('armfpidle.kf')],
  ]);
  // hand=5, upperarm=8 in MW_BODY_PARTS order (loadbody.hpp MeshPart)
  const esm = f('armfp.esm');
  const extra = [
    bodyRec('b_fprace_m_hand', 'fixture\\armfphand.nif', 'fprace', 5),
    bodyRec('b_fprace_m_upperarm', 'fixture\\armfparm.nif', 'fprace', 8),
  ];
  const all = new Uint8Array(esm.length + extra.reduce((a, r) => a + r.length, 0));
  all.set(esm, 0);
  let o = esm.length;
  for (const r of extra) { all.set(r, o); o += r.length; }
  return {
    files,
    deps: {
      loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
      storedMorrowindNames: async () => ['armfp.esm'],
      loadMorrowindFile: async () => all,
    },
  };
}

test('MW-D24: the build carries the third-person body, through the same doors', async () => {
  const fx = await fpFixtureBuildWithBody();
  const res = await buildFpArm({ race: 'fprace', deps: fx.deps });
  assert.equal(res.ok, true, `the arm still builds (${res.stage}: ${res.error})`);
  const t = res.third;
  assert.ok(t, 'the third-person body rode the build');
  assert.equal(t.ok, true, `and it BUILT (${t && t.stage}: ${t && t.error})`);
  assert.equal(t.skeletonPath, 'meshes/xbase_anim.nif',
    'rule 6\'s other column through rule 18\'s x-swap - the retail 3P root IS the x-model');
  assert.deepEqual(t.sourcePaths, ['meshes/xbase_anim.kf'], 'the base kf serves, extension-swapped, no x inserted');
  // hand binds both sides (skinned pair), upperarm both sides (rigid
  // pair with the mirror) - four pieces, exactly the arm fixture's own
  // count through the SAME one assembly door.
  assert.equal(t.pieces, 4, `both slots bound both sides (${t.pieces})`);
  assert.ok(t.groupSet.has('idle'), 'the 3P kf names the idle the machine will resolve');
});

test('MW-D24: one machine, two rigs - the view switch re-resolves the stance on the OTHER kf', async () => {
  const fx = await fpFixtureBuildWithBody();
  const arm = createFpArm();
  arm.attach({}, () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0 }));
  const res = await arm.build({ race: 'fprace', deps: fx.deps });
  assert.equal(res.ok, true);
  assert.equal(arm.status().viewMode, 'first', 'the machine boots in first person (camera.cpp:58)');
  assert.equal(arm.canThirdPerson(), true, 'and the wheel has somewhere to go');
  assert.equal(arm.upperBodyReady(), true, 'a rested stance crosses immediately');
  // THE SWITCH: npcanimation.cpp:295-317's rebuild expressed as a
  // re-resolution - the idle re-picks from the 3P sources.
  assert.equal(arm.setViewMode('third'), true);
  const st = arm.status();
  assert.equal(st.viewMode, 'third');
  assert.equal(st.idleSource, 'meshes/xbase_anim.kf', 'the idle now plays from the THIRD-person kf');
  assert.equal(arm.active(), false, 'the FP overlay predicate answers false in third person - the seventh term');
  // and back: the same machine re-resolves on the first-person sources
  assert.equal(arm.setViewMode('first'), true);
  assert.equal(arm.status().idleSource, FP_CLIP_PATH, 'and back onto the first-person kf');
});

test('MW-D24: a body that cannot build REFUSES the wheel, never the arm', async () => {
  // The plain FP fixture has no third-person records at all: the arm
  // builds, the body reports its refusal, and setViewMode says no.
  const res = await fpFixtureBuild();
  assert.equal(res.ok, true, 'the arm is untouched by the body\'s refusal');
  assert.ok(res.third && res.third.ok === false, 'the body refusal is CARRIED, not silent');
  assert.equal(res.third.stage, 'skeleton', `and named (${res.third.stage}: ${res.third.error})`);
  const arm = createFpArm();
  arm.attach({}, () => ({ pos: [0, 0, 0], yaw: 0 }));
  await arm.build({ race: 'fprace', deps: (await (async () => {
    const files = new Map([
      [fpSkeletonPath({}), f('armfp.nif')],
      [FP_CLIP_PATH, f('armfpidle.kf')],
      ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
      ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
      ['textures/tx_fixture.dds', f('fixture.dds')],
    ]);
    return {
      loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
      storedMorrowindNames: async () => ['armfp.esm'],
      loadMorrowindFile: async () => f('armfp.esm'),
    };
  })()) });
  assert.equal(arm.canThirdPerson(), false);
  assert.equal(arm.setViewMode('third'), false, 'the switch refuses');
  assert.equal(arm.status().viewMode, 'first', 'and the machine stays in the view that exists');
});

test('MW-D24: in third person NOTHING first-person draws - the rig\'s one seam is double-gated', () => {
  // weaponRig.draw: the classic sprite is the fallthrough when the arm
  // is inactive - and active() is now view-gated, so without its own
  // gate the sprite would paste a floating weapon overlay over the
  // player's back. Morrowind's third person has no viewmodel.
  const src = rd('src/combat/weaponRig.js');
  const drawAt = src.indexOf('if (fpArm.thirdActive()) return;');
  const armAt = src.indexOf('if (fpArm.active()) { fpArm.draw(c); return; }');
  assert.ok(drawAt !== -1, 'the third-person gate exists');
  assert.ok(armAt !== -1 && drawAt < armAt, 'and it stands BEFORE the arm-or-sprite seam');
});

// ── MW-D26: MOVEMENT - THE THIRD SLOT ───────────────────────────────

import {
  movementAnimState, composeMovementGroup, MOVEMENT_FALLBACK_SPEED, MOVEMENT_SPEED_CAP,
  turnAnimSpeed, MW_UNITS_PER_METER, MW_WEAPON_TYPE,
} from '../src/formats/mwFirstPerson.js';
import { animVelocity } from '../src/formats/mwAnim.js';

test('MW-D26: the movestate ladder is the reference\'s own nest (character.cpp:2085, 2297-2330)', () => {
  // sneak beats run beats walk, exactly as the ternaries order them
  assert.equal(movementAnimState({ forward: 1 }), 'walkforward');
  assert.equal(movementAnimState({ forward: 1, running: true }), 'runforward');
  assert.equal(movementAnimState({ forward: 1, running: true, sneaking: true }), 'sneakforward');
  assert.equal(movementAnimState({ forward: -1 }), 'walkback');
  // the strafe test is 2:1, not a preference: equal parts go FORWARD
  assert.equal(movementAnimState({ forward: 1, strafe: 1 }), 'walkforward');
  assert.equal(movementAnimState({ forward: 0.4, strafe: 1 }), 'walkright');
  assert.equal(movementAnimState({ forward: 0.5, strafe: 1 }), 'walkforward', 'exactly 2:1 is NOT strafing (strict >)');
  assert.equal(movementAnimState({ strafe: -1, running: true }), 'runleft');
  // turning: third person only, never sneaking (character.cpp:2321-2329)
  assert.equal(movementAnimState({ turning: 1, thirdPerson: true }), 'turnright');
  assert.equal(movementAnimState({ turning: -1, thirdPerson: true }), 'turnleft');
  assert.equal(movementAnimState({ turning: 1, thirdPerson: false }), null, 'no turn anims in first person');
  assert.equal(movementAnimState({ turning: 1, thirdPerson: true, sneaking: true }), null, 'nor sneaking');
  assert.equal(movementAnimState({}), null, 'standing still is no state');
});

test('MW-D26: the movement group composes the weapon suffix through the ONE ladder, then run->walk', () => {
  // suffix ladder = composeStanceGroup's (asked short, 2c/1h fallback,
  // bare base - character.cpp:674-693); then the run->walk swap
  // (:697-699); then null, never a substitute (:701-707).
  const has = (set) => (n) => set.has(n);
  const T = MW_WEAPON_TYPE.LongBladeOneHand;
  assert.deepEqual(composeMovementGroup('runforward', T, has(new Set(['runforward1h']))),
    { group: 'runforward1h', walked: false });
  assert.deepEqual(composeMovementGroup('runforward', T, has(new Set(['runforward']))),
    { group: 'runforward', walked: false }, 'bare-base tail of the suffix ladder');
  assert.deepEqual(composeMovementGroup('runforward', T, has(new Set(['walkforward']))),
    { group: 'walkforward', walked: true }, 'the run->walk swap');
  assert.deepEqual(composeMovementGroup('runforward', T, has(new Set(['idle']))),
    { group: null, walked: false }, 'nothing serves: RESET, never a wrong clip');
  // no weapon: no suffix step at all (character.cpp:674's gate)
  assert.deepEqual(composeMovementGroup('walkforward', MW_WEAPON_TYPE.None, has(new Set(['walkforward']))),
    { group: 'walkforward', walked: false });
});

test('MW-D26: animVelocity is calcAnimVelocity - last keys in reverse, horizontal mask', () => {
  // animation.cpp:180-224. The doubled Loop Stop is the reference's own
  // AshVampire quirk: the reverse scan takes the LAST one.
  const keys = [
    { time: 1.0, text: 'walkforward: start' },
    { time: 1.2, text: 'walkforward: loop start' },
    { time: 1.8, text: 'walkforward: loop stop' },   // the broken early one
    { time: 2.2, text: 'walkforward: loop stop' },   // the one the LAW takes
    { time: 2.4, text: 'walkforward: stop' },
  ];
  const track = { translations: { keys: [
    { time: 1.2, value: [0, 0, 0] },
    { time: 2.2, value: [0, 2.0, 5.0] },
  ] } };
  // starttime = the LAST start/loop-start (1.2); stoptime = the LAST
  // loop stop (2.2); displacement = |(0,2)| - the 5 units of MW z are
  // MASKED by accumulate (1,1,0), character.cpp:925.
  const v = animVelocity(keys, track, 'walkforward');
  assert.ok(Math.abs(v - 2.0) < 1e-9, `2.0 units/s horizontal, vertical masked (${v})`);
  assert.equal(animVelocity(keys, track, 'runforward'), 0, 'an absent group has no velocity');
});

test('MW-D26: the reference\'s own fallback speeds and caps', () => {
  // character.cpp:750-752, :2403, :2396
  assert.deepEqual(MOVEMENT_FALLBACK_SPEED, { sneak: 33.5452, run: 222.857, walk: 154.064 });
  assert.equal(MOVEMENT_SPEED_CAP, 10);
  assert.ok(Math.abs(turnAnimSpeed(Math.PI) - 1) < 1e-12, '|rot|/dt/pi');
  assert.equal(turnAnimSpeed(100), 1.5, 'capped at 1.5');
});

/** A machine driven by a LIVE movement report - the caller's own shape. */
function moveDriver() {
  const cam = { pos: [0, 1.6, 0], yaw: 0, pitch: 0, sneaking: false, move: { forward: 0, strafe: 0, running: false, speed: 0 } };
  const renderer = {
    gl: null,
    createCharacterMesh: () => ({ vao: {}, buffers: [] }),
    updateCharacterMesh: () => {},
    renderCharacterSprite: () => ({}),
    drawScreenOverlayQuad: () => {},
    createCharacterTexture: (mips) => ({ mips }),
  };
  const arm = createFpArm();
  arm.attach(renderer, () => cam);
  return { cam, arm };
}

test('MW-D26: the machine WALKS - the slot plays the group at the clip\'s own speed ratio', async () => {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpmove.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ]);
  const deps = {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => f('armfp.esm'),
  };
  const { cam, arm } = moveDriver();
  const built = await arm.build({ race: 'fprace', deps });
  assert.equal(built.ok, true, built.ok ? '' : `${built.stage}: ${built.error}`);
  arm.update(1 / 60);
  assert.equal(arm.status().movementGroup, null, 'standing still, no movement state');
  // WALK at exactly the clip's own pace: the fixture's accum root
  // travels 2.0 MW units/s, so a player at 2.0 MW units/s (through the
  // one bridge) plays the clip at rate 1.
  cam.move.forward = 1;
  cam.move.speed = 2.0 / MW_UNITS_PER_METER;
  arm.update(1 / 60);
  let st = arm.status();
  assert.equal(st.movementGroup, 'walkforward');
  assert.ok(Math.abs(st.movementRate - 1) < 1e-6, `speed/animSpeed with a real accum velocity (${st.movementRate})`);
  // RUN asks for runforward, which the fixture lacks: the run->walk
  // swap serves, and the rate scales UP with the speed.
  cam.move.running = true;
  cam.move.speed = 8.0 / MW_UNITS_PER_METER;
  arm.update(1 / 60);
  st = arm.status();
  assert.equal(st.movementGroup, 'walkforward', 'the run->walk swap in the LIVE machine');
  assert.ok(Math.abs(st.movementRate - 4) < 1e-6, `the played speed follows the actor (${st.movementRate})`);
  // the cap (character.cpp:2403)
  cam.move.speed = 1000;
  arm.update(1 / 60);
  assert.equal(arm.status().movementRate, MOVEMENT_SPEED_CAP, 'vanilla caps the played speed at 10');
  // and stopping RESETS the slot
  cam.move.forward = 0; cam.move.running = false; cam.move.speed = 0;
  arm.update(1 / 60);
  assert.equal(arm.status().movementGroup, null, 'standing still again resets the slot');
});

test('MW-D26: a kf with NO movement groups moves nothing - the idle keeps the pose, no substitute', async () => {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ]);
  const deps = {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => f('armfp.esm'),
  };
  const { cam, arm } = moveDriver();
  const built = await arm.build({ race: 'fprace', deps });
  assert.equal(built.ok, true);
  cam.move.forward = 1; cam.move.speed = 1;
  arm.update(1 / 60);
  const st = arm.status();
  assert.equal(st.movementGroup, null, 'no walkforward in this file: the slot stays empty (character.cpp:701-707)');
  assert.ok(st.idleGroup, 'and the idle still owns the pose');
});

test('MW-D26: turning plays turnleft/turnright in THIRD person only, at the turn\'s own speed law', async () => {
  const fx = await fpFixtureBuildWithBody();
  // swap both kfs for the movement fixture so the 3P rig carries the turn groups
  fx.files.set(FP_CLIP_PATH, f('armfpmove.kf'));
  fx.files.set('meshes/xbase_anim.kf', f('armfpmove.kf'));
  const { cam, arm } = moveDriver();
  const built = await arm.build({ race: 'fprace', deps: fx.deps });
  assert.equal(built.ok, true, built.ok ? '' : `${built.stage}: ${built.error}`);
  // FIRST PERSON: yaw spins, no turn state (character.cpp:2323's gate)
  cam.yaw = 0;
  arm.update(1 / 60);
  cam.yaw = 0.3;
  arm.update(1 / 60);
  assert.equal(arm.status().movementGroup, null, 'no turn anims in first person');
  // THIRD PERSON: the same spin picks the turn group and the rate is
  // min(1.5, |rot|/dt/pi) (character.cpp:2396)
  assert.equal(arm.setViewMode('third'), true);
  arm.update(1 / 60);   // settle lastYaw on the new frame
  cam.yaw += 0.3;
  arm.update(1 / 60);
  let st = arm.status();
  assert.equal(st.movementGroup, 'turnright', 'yaw increasing = turning right');
  assert.equal(st.movementRate, 1.5, 'a fast spin pins the turn clip at 1.5');
  cam.yaw -= 0.001;
  arm.update(1 / 60);
  st = arm.status();
  assert.equal(st.movementGroup, 'turnleft', 'and the sign flips the side');
  assert.ok(st.movementRate < 1.5, `a slow turn plays slower (${st.movementRate})`);
});

test('MW-D26: movement WINS the pose over the idle - measured on the piece, not the label', async () => {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpmove.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ]);
  const deps = {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => f('armfp.esm'),
  };
  const { cam, arm } = moveDriver();
  const built = await arm.build({ race: 'fprace', deps });
  assert.equal(built.ok, true);
  // settle the idle pose and take the arm's bounds
  for (let i = 0; i < 3; i++) arm.update(0.05);
  const idleBounds = arm.rows().find((r) => r.bone === 'right forearm').bounds;
  // walk: the fixture's walkforward turns the right upper arm where the
  // idle holds it still - and the forearm hangs off it, so the bound
  // piece's bounds MUST move - a winner
  // ladder that lets the idle keep the pose dies here, whatever the
  // status labels say.
  cam.move.forward = 1;
  cam.move.speed = 2.0 / MW_UNITS_PER_METER;
  // step into the clip's swing (walkforward loop 1.2..2.2, keys at 1.7)
  for (let i = 0; i < 10; i++) arm.update(0.05);
  assert.equal(arm.status().movementGroup, 'walkforward');
  const walkBounds = arm.rows().find((r) => r.bone === 'right forearm').bounds;
  const moved = Math.abs(walkBounds.maxX - idleBounds.maxX) + Math.abs(walkBounds.minZ - idleBounds.minZ);
  assert.ok(moved > 1e-3, `the piece is posed by the MOVEMENT clip (moved ${moved.toFixed(5)})`);
});

test('MW-D27: the faceIndex THREAD is unbroken, swept at the source', () => {
  // m5 of the derivation campaign cut faceIndex between buildFpArm and
  // playerBodyRows and every behaviour pin stayed green, because they
  // all test the picker directly - proving the thread live end-to-end
  // needs a third-person fixture build this suite does not yet own. So
  // the wiring is swept the way AUDIT 17i sweeps chargen construction:
  // at the source, all three links, so a refactor cannot quietly strand
  // the classic face at the door.
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(arm, /buildTpBody\(\{ race, female, beast, faceIndex, faceMatch,/,
    'buildFpArm no longer hands the face to the body build');
  assert.match(arm, /playerBodyRows\(parts, race, female, \{ beast, faceIndex, faceMatch \}\)/,
    'the body build no longer hands the face to the picker');
  // TR2: the menu's inline opts moved into weaponRig's ONE HOME - the
  // sweep follows the thread there (menu -> buildArmsFor ->
  // armBuildOptsOf -> fpArm.build), because a sweep of a door that no
  // longer carries the wire proves nothing.
  const menu = readFileSync('src/ui/enhancedMenu.js', 'utf8');
  assert.match(menu, /buildArmsFor\(playerEntity\)/,
    'the card no longer routes the live player through the one home');
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /faceIndex: entity\.faceIndex \| 0/,
    'the live player\u2019s classic face no longer reaches the build');
  assert.match(rig, /return fpArm\.build\(armBuildOptsOf\(entity\)\)/,
    'buildArmsFor no longer feeds the opts home to the build');
});

// ═══ MW-D28: THE ITEM MAP ═══════════════════════════════════════════
import {
  DF_TO_MW_ARMOR_MATERIAL, DF_ARMOR_ROWS, DECLARED_SPRITE_WEAPONS,
  mwArmorRecords, itemMapCoverage, mwItemReport,
  ARMO_PART, composeWornArmor, shadowSkinRows, dfWornArmor, dfWornEquipment,
  MW_CLOTHING_TYPE, DF_CLOTHING_ROWS, mwClothingRecord, fpWornAdds,
} from '../src/formats/mwItemMap.js';
import { armorRecords, clothingRecords, raceBeastFlag, pickWeaponRecord, facePools } from '../src/formats/mwFirstPerson.js';
import { ARMOR_ENUM } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';

test('MW-D28: the map is TOTAL - every DF equippable x material answers, or the build fails', () => {
  // Mac's brief as a pin: nothing may fall through silently. A row is
  // allowed to keep the classic sprite, but it must SAY it. MUTANT:
  // delete any weapon row, armor row or material row and the space
  // names the hole.
  const cover = itemMapCoverage();
  const holes = cover.filter((c) => c.kind === 'UNMAPPED');
  assert.deepEqual(holes, [], `unmapped item/material combinations:\n${holes.map((h) => `${h.material} ${h.item}`).join('\n')}`);
  // The space is the REAL space: 19 weapons x 10 materials + 11 armors
  // x 13 materials + 76 wearable garment indices (MW-D30), so removing
  // an enum entry cannot shrink the claim.
  assert.equal(cover.length, 19 * 10 + 11 * 13 + 76);
  // Declared sprites are present, named, and reasoned.
  const sprites = cover.filter((c) => c.kind === 'sprite');
  assert.ok(sprites.length >= 10, 'the Arrow rows are not declared');
  assert.ok(sprites.every((s2) => s2.reason && s2.reason.length > 10), 'a sprite row without a reason is a lie');
});

test('MW-D28: armor resolves by token, in order, sided, and honestly empty', () => {
  const R = (id) => ({ id, model: `m/${id}.nif`, name: id, enchanted: false });
  const recs = [
    R('iron_cuirass'), R('steel_cuirass'), R('netch_leather_cuirass'),
    R('netch_leather_bracer_left'), R('netch_leather_bracer_right'),
    // fictional on retail, load-bearing here: if a mod DID add netch
    // gauntlets, the FIRST token must win - which is what "in order"
    // means, and what a pooled filter cannot promise.
    R('netch_leather_gauntlet_left'), R('netch_leather_gauntlet_right'),
    R('iron_gauntlet_left'), R('iron_gauntlet_right'),
    R('iron_pauldron_left'), R('iron_pauldron_right'),
    R('iron_shield'), R('iron_towershield'), R('iron_helmet'),
  ];
  const one = (t, m) => mwArmorRecords(recs, t, m);
  // material picks among families
  assert.equal(one(ARMOR_ENUM.Cuirass, ARMOR_MATERIAL.Iron).records[0].id, 'iron_cuirass');
  assert.equal(one(ARMOR_ENUM.Cuirass, ARMOR_MATERIAL.Leather).records[0].id, 'netch_leather_cuirass');
  // SILVER IS A JUDGEMENT ROW: steel stands in, and the map says so.
  assert.equal(one(ARMOR_ENUM.Cuirass, ARMOR_MATERIAL.Silver).records[0].id, 'steel_cuirass');
  // token order: netch hands are BRACERS - the second token, found
  // because the first matched nothing. MUTANT: try tokens as one pool
  // and iron gauntlets shadow them.
  const netchHands = one(ARMOR_ENUM.Gauntlets, ARMOR_MATERIAL.Leather);
  assert.deepEqual(netchHands.records.map((r) => r.id),
    ['netch_leather_gauntlet_left', 'netch_leather_gauntlet_right'],
    'the first token wins when both exist; bracers are the FALLBACK');
  const bracerOnly = mwArmorRecords(recs.filter((r) => !r.id.includes('netch_leather_gauntlet')),
    ARMOR_ENUM.Gauntlets, ARMOR_MATERIAL.Leather);
  assert.deepEqual(bracerOnly.records.map((r) => r.id), ['netch_leather_bracer_left', 'netch_leather_bracer_right']);
  // sides: a pauldron template takes ITS side only.
  assert.deepEqual(one(ARMOR_ENUM.Left_Pauldron, ARMOR_MATERIAL.Iron).records.map((r) => r.id), ['iron_pauldron_left']);
  assert.deepEqual(one(ARMOR_ENUM.Right_Pauldron, ARMOR_MATERIAL.Iron).records.map((r) => r.id), ['iron_pauldron_right']);
  // the shield split: three DF sizes on the plain shield, the tower on
  // the tower - and the plain row must NOT swallow the towershield.
  assert.equal(one(ARMOR_ENUM.Round_Shield, ARMOR_MATERIAL.Iron).records[0].id, 'iron_shield');
  assert.equal(one(ARMOR_ENUM.Tower_Shield, ARMOR_MATERIAL.Iron).records[0].id, 'iron_towershield');
  // honest emptiness: chain greaves in an archive with no chain KEEP
  // THE SPRITE and the note says why. MUTANT: substitute another
  // material here and this fails.
  // an archive holding ONLY a towershield must NOT hand it to the
  // plain-shield sizes - the sprite stands. MUTANT: drop the
  // not-clause and the tower leaks.
  const towerOnly = mwArmorRecords([R('daedric_towershield')], ARMOR_ENUM.Kite_Shield, ARMOR_MATERIAL.Daedric);
  assert.equal(towerOnly.records.length, 0, 'the towershield leaked into a plain shield row');
  const miss = one(ARMOR_ENUM.Greaves, ARMOR_MATERIAL.Chain);
  assert.equal(miss.records.length, 0);
  assert.match(miss.note, /classic sprite stands/);
});

test('MW-D28: the ARMO reader reads the WEAP way, and the report prints every row', () => {
  // A tiny hand-built ESM: header + two ARMO records + one WEAP that
  // must NOT leak into the armor list.
  const enc = (str) => Array.from(str, (c) => c.charCodeAt(0));
  const sub = (name, payload) => [...enc(name), payload.length, 0, 0, 0, ...payload];
  const rec = (type, subs) => { const body = subs.flat(); return [...enc(type), body.length & 255, (body.length >> 8) & 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...body]; };
  const z = (s2) => [...enc(s2), 0];
  const bytes = new Uint8Array([
    ...rec('TES3', [sub('HEDR', new Array(300).fill(0))]),
    // the backslash is a BYTE (0x5c), so the fixture cannot lose an
    // escape fight between the shell, python and JS - it already did
    // once, and the reader was innocent both times.
    ...rec('ARMO', [sub('NAME', z('Iron_Cuirass')), sub('MODL', [...enc('a'), 0x5c, ...z('ir_cuirass.nif')]), sub('FNAM', z('Iron Cuirass'))]),
    ...rec('ARMO', [sub('NAME', z('glass_helmet')), sub('MODL', [...enc('a'), 0x5c, ...z('glass_helm.nif')]), sub('ENAM', z('x'))]),
    ...rec('WEAP', [sub('NAME', z('iron_dagger')), sub('MODL', [...enc('w'), 0x5c, ...z('dag.nif')])]),
  ]);
  const armo = armorRecords(bytes);
  assert.deepEqual(armo.map((a) => a.id), ['iron_cuirass', 'glass_helmet'], 'lowercased ids, WEAP excluded');
  assert.equal(armo[0].model, 'a/ir_cuirass.nif', 'backslashes forward, lowercased');
  assert.equal(armo[1].enchanted, true);
  // The report covers the whole grid - 11 pieces x 12 materials (chain
  // reported once) - and every line carries words, found or not.
  const report = mwItemReport(armo);
  assert.equal(report.length, 11 * 12);
  assert.ok(report.every((r) => r.note && r.note.length > 5));
  const hit = report.find((r) => r.item === 'Iron Cuirass');
  assert.deepEqual(hit.found, ['iron_cuirass']);
});

// ═══ AUDIT MW-A (Audit 29): the findings, pinned ════════════════════
test('AUDIT 29 F1: raceBeastFlag reads the RACE record\u2019s own RADT bit, last esm wins', () => {
  const enc = (str) => Array.from(str, (c) => c.charCodeAt(0));
  const sub = (name, payload) => [...enc(name), payload.length & 255, (payload.length >> 8) & 255, 0, 0, ...payload];
  const rec = (type, subs) => { const body = subs.flat(); return [...enc(type), body.length & 255, (body.length >> 8) & 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...body]; };
  const z = (s2) => [...enc(s2), 0];
  const radt = (flags) => { const b = new Array(140).fill(0); b[136] = flags & 255; return b; };
  const bytes = new Uint8Array([
    ...rec('RACE', [sub('NAME', z('Argonian')), sub('RADT', radt(3))]),   // playable + BEAST
    ...rec('RACE', [sub('NAME', z('nord')), sub('RADT', radt(1))]),       // playable, not beast
  ]);
  assert.equal(raceBeastFlag(bytes, 'argonian'), true, 'the beast bit did not read');
  assert.equal(raceBeastFlag(bytes, 'ARGONIAN'), true, 'the id compare is not case-blind');
  assert.equal(raceBeastFlag(bytes, 'nord'), false);
  assert.equal(raceBeastFlag(bytes, 'fprace'), null, 'an unknown race must answer null, not false');
  // last esm wins: a later RACE with the same id overrides.
  const override = new Uint8Array([...bytes, ...rec('RACE', [sub('NAME', z('nord')), sub('RADT', radt(3))])]);
  assert.equal(raceBeastFlag(override, 'nord'), true, 'the load order does not override');
  // a RADT of the wrong size is refused, not read past (the byte-eight law).
  const bad = new Uint8Array([...rec('RACE', [sub('NAME', z('x')), sub('RADT', new Array(20).fill(255))])]);
  assert.equal(raceBeastFlag(bad, 'x'), null);
});

test('AUDIT 29 F1: the derivation is WIRED - beast defaults to the data, the option still overrides', () => {
  // The defect: fpSkeletonPath/tpSkeletonPath switch on beast, the
  // tail row hides on !beast, and no production caller ever set it -
  // an Argonian player built on base_anim with the tail skipped.
  // Swept at the source like the faceIndex thread, because a live
  // proof needs a RACE-bearing fixture esm the harness does not own.
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(arm, /beast = null, faceIndex/, 'the option no longer defaults to unresolved');
  assert.match(arm, /if \(beast === null\) \{/, 'the derivation gate is gone');
  // IG2 routed the race scan through the esm walk memo; the rule is
  // raceBeastFlag's own, read off the memoised map.
  assert.match(arm, /walk\(e, 'races', raceRecords\)\.get\(raceKey\)/, 'the RACE records are not consulted');
  assert.match(arm, /if \(rrec && rrec\.radt\) beast = rrec\.beast;/, 'the RADT rule is gone');
  // and the skeleton must resolve AFTER the answer exists.
  const gate = arm.indexOf('if (beast === null) {');
  const skel = arm.indexOf('settingsSkeleton = fpSkeletonPath({ female, beast })');
  assert.ok(gate > 0 && skel > gate, 'the skeleton is chosen before the data can say beast');
});

test('AUDIT 29 F3: the weapon pick is id-sorted - the archive\u2019s listing order cannot choose the sword', () => {
  const R = (id, type) => ({ id, model: `w/${id}.nif`, name: id, type, enchanted: false });
  // DELIBERATELY listed backwards; sorted, chitin comes first.
  const recs = [R('iron_dagger', 0), R('daedric_dagger', 0), R('chitin_dagger', 0)];
  assert.equal(pickWeaponRecord(recs, 0).id, 'chitin_dagger', 'the fallback follows the listing, not the id');
  assert.equal(pickWeaponRecord(recs, 0, 'Daedric').id, 'daedric_dagger', 'the material hit still wins');
  assert.equal(pickWeaponRecord(recs.slice().reverse(), 0).id, 'chitin_dagger', 'two listings, one sword');
});

// ═══ MW-D29: WORN ARMOR ═════════════════════════════════════════════
test('MW-D29: the ARMO part references read - INDX opens, BNAM/CNAM name, MODL stays ground', () => {
  const enc = (str) => Array.from(str, (c) => c.charCodeAt(0));
  const sub = (name, payload) => [...enc(name), payload.length & 255, (payload.length >> 8) & 255, 0, 0, ...payload];
  const rec = (type, subs) => { const body = subs.flat(); return [...enc(type), body.length & 255, (body.length >> 8) & 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...body]; };
  const z = (s2) => [...enc(s2), 0];
  const bytes = new Uint8Array([
    ...rec('ARMO', [
      sub('NAME', z('iron_gauntlet_right')), sub('MODL', [...enc('a'), 0x5c, ...z('ground.nif')]),
      sub('INDX', [6]), sub('BNAM', z('B_Iron_GR')), sub('CNAM', z('b_iron_gr_f')),
      sub('INDX', [8]), sub('BNAM', z('b_iron_wr')),
    ]),
  ]);
  const [a] = armorRecords(bytes);
  assert.equal(a.model, 'a/ground.nif', 'MODL is still the ground mesh');
  assert.deepEqual(a.parts, [
    { part: 6, male: 'b_iron_gr', female: 'b_iron_gr_f' },
    { part: 8, male: 'b_iron_wr', female: null },
  ], 'the reference list did not read (ids lowercased, CNAM optional)');
});

test('MW-D29: the INDX enum is the SIDED 27, not the unsided 15 - spot rows pinned', () => {
  // Confusing the two enums is this slice\u2019s byte-eight trap.
  assert.equal(ARMO_PART.length, 27);
  assert.deepEqual(ARMO_PART[3], { name: 'cuirass', bones: ['chest'], shadows: 'chest' });
  assert.deepEqual(ARMO_PART[6], { name: 'right hand', bones: ['right hand'], shadows: 'hand:right' });
  assert.deepEqual(ARMO_PART[23], { name: 'right pauldron', bones: ['right clavicle'], shadows: null });
  assert.deepEqual(ARMO_PART[10], { name: 'shield', bones: ['shield bone'], shadows: null });
  assert.equal(ARMO_PART[26].name, 'tail');
  assert.deepEqual(ARMO_PART[25], { name: 'weapon', bones: [], shadows: null }, 'the weapon row belongs to the weapon door');
  // every bone this table names for a sided slot is one PART_BONES
  // already carries - one spelling, or the attach silently misses.
  for (const row of ARMO_PART) {
    for (const b of row.bones) {
      if (b === 'shield bone') continue;
      assert.ok(Object.values(PART_BONES).some((pair) => pair.includes(b)), `${row.name}: bone "${b}" is not a PART_BONES spelling`);
    }
  }
});

test('MW-D29: the composer dresses, shadows, sexes, and never traps', () => {
  const armors = [{
    id: 'iron_gauntlet_right', model: 'g.nif', name: '', enchanted: false,
    parts: [{ part: 6, male: 'b_gr', female: 'b_gr_f' }, { part: 8, male: 'b_wr', female: null }],
  }, {
    id: 'iron_cuirass', model: 'c.nif', name: '', enchanted: false,
    parts: [{ part: 3, male: 'b_cu', female: null }, { part: 99, male: 'b_zz', female: null }, { part: 13, male: 'b_missing', female: null }],
  }];
  const bodyPool = [
    { id: 'b_gr', model: 'm/gr.nif' }, { id: 'b_gr_f', model: 'm/gr_f.nif' },
    { id: 'b_wr', model: 'm/wr.nif' }, { id: 'b_cu', model: 'm/cu.nif' },
  ];
  const pieces = [{ templateIndex: ARMOR_ENUM.Gauntlets, material: ARMOR_MATERIAL.Iron },
    { templateIndex: ARMOR_ENUM.Cuirass, material: ARMOR_MATERIAL.Iron }];
  const male = composeWornArmor({ pieces, armors, bodyPool, female: false });
  // the right gauntlet's ref is sided; the WRIST ref rides the same
  // record; the cuirass adds and shadows the chest whole.
  // adds emerge in PRT-slot order since the composer became an
  // arbitration (MW-D30); the LAW is which parts win, not the array's
  // order, so the pin compares sorted.
  assert.deepEqual(male.adds.map((a) => a.recordId).sort(), ['b_cu', 'b_gr', 'b_wr']);
  assert.deepEqual(male.adds.find((a) => a.recordId === 'b_gr').bones, ['right hand']);
  assert.deepEqual([...male.shadows].sort(), ['chest', 'hand:right', 'wrist:right']);
  // never-traps, said in words: the out-of-enum INDX and the missing
  // BODY id are notes, not throws, and the skin stands for them.
  assert.ok(male.notes.some((n) => /INDX 99/.test(n)));
  assert.ok(male.notes.some((n) => /b_missing/.test(n)));
  // the female pick takes CNAM when it exists, BNAM when it does not.
  const fem = composeWornArmor({ pieces, armors, bodyPool, female: true });
  assert.deepEqual(fem.adds.map((a) => a.recordId).sort(), ['b_cu', 'b_gr_f', 'b_wr']);
  // a piece with no MW record at all is one note, no adds.
  const none = composeWornArmor({ pieces: [{ templateIndex: ARMOR_ENUM.Helm, material: ARMOR_MATERIAL.Chain }], armors, bodyPool, female: false });
  assert.equal(none.adds.length, 0);
  assert.match(none.notes[0], /classic sprite stands/);
});

test('MW-D29: shadows trim the skin - whole slots gone, single sides kept on the other bone', () => {
  const rows = [
    { slot: 'chest', bones: ['chest'], model: 'chest.nif' },
    { slot: 'hand', bones: ['left hand', 'right hand'], model: 'hand.nif' },
    { slot: 'foot', bones: ['left foot', 'right foot'], model: 'foot.nif' },
  ];
  const out = shadowSkinRows(rows, ['chest', 'hand:right']);
  assert.deepEqual(out.map((r) => r.slot), ['hand', 'foot'], 'the cuirass did not hide the chest skin');
  assert.deepEqual(out[0].bones, ['left hand'], 'the right gauntlet did not trim the right skin hand');
  assert.deepEqual(out[1].bones, ['left foot', 'right foot'], 'an unshadowed slot changed');
  // both sides shadowed = the row is gone entirely.
  assert.deepEqual(shadowSkinRows(rows, ['hand:right', 'hand:left']).map((r) => r.slot), ['chest', 'foot']);
  // and the input was not mutated.
  assert.deepEqual(rows[1].bones, ['left hand', 'right hand']);
});

test('MW-D29: the thread is unbroken - the menu reads the equip table, the build wears it', () => {
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(arm, /composeWornArmor\(\{ pieces: armor \?\? \[\], armors: armors \?\? \[\], clothes: clothes \?\? \[\], bodyPool: parts, female, colourOf \}\)/);
  assert.match(arm, /const armors = esmBytes\.flatMap\(\(e\) => walk\(e, 'armors', armorRecords\)\);/);
  assert.match(arm, /const clothes = esmBytes\.flatMap\(\(e\) => walk\(e, 'clothes', clothingRecords\)\);/);
  // MW-D31: ONE composition serves both rigs - buildFpArm composes,
  // the third person receives verdicts, the fp build filters and
  // shadows from the same result.
  assert.match(arm, /buildTpBody\(\{ race, female, beast, faceIndex, faceMatch, weapon, hasAmmo, worn,/);
  assert.match(arm, /for \(const add of fpWornAdds\(worn\.adds\)\)/, 'the fp build does not wear the filtered adds');
  assert.match(arm, /shadowSkinRows\(\n      wanted\.filter/, 'the fp skin does not take the shadows');
  // TR2: the worn read lives in weaponRig's opts home now; the menu
  // reaches it through buildArmsFor (swept in the MW-D27 pin above).
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /armor: dfWornEquipment\(equipTableOf\(entity\), EQUIP_SLOTS, ARMOR_ENUM\)/);
  // and the readout itself: armor slots in, shields from hands, a
  // sword in a hand refused.
  const slots = []; slots[12] = { templateIndex: ARMOR_ENUM.Helm, material: 2 };
  slots[19] = { templateIndex: 115, material: 3 };
  slots[21] = { templateIndex: ARMOR_ENUM.Kite_Shield, material: 4 };
  const worn = dfWornArmor(slots, { Head: 12, RightArm: 13, LeftArm: 15, ChestArmor: 18, Gloves: 20, LegsArmor: 23, Feet: 26, RightHand: 19, LeftHand: 21 }, ARMOR_ENUM);
  assert.deepEqual(worn, [
    { templateIndex: ARMOR_ENUM.Helm, material: 2 },
    { templateIndex: ARMOR_ENUM.Kite_Shield, material: 4 },
  ]);
});

test('AUDIT 30 F1: a helmet hides the hair - the engine rule, not a part reference', () => {
  // npcanimation.cpp:615 removes PRT_Hair the moment the helmet SLOT
  // equips, before the armor's refs say anything - so a helm whose
  // refs cover only the head still never shows hair through the
  // shell. MUTANT: key the rule off the refs and the head-only helm
  // leaks hair.
  const armors = [{
    id: 'iron_helmet', model: 'g.nif', name: '', enchanted: false,
    parts: [{ part: 0, male: 'b_helm', female: null }],   // HEAD only, no hair ref
  }];
  const bodyPool = [{ id: 'b_helm', model: 'm/helm.nif' }];
  const worn = composeWornArmor({
    pieces: [{ templateIndex: ARMOR_ENUM.Helm, material: ARMOR_MATERIAL.Iron }],
    armors, bodyPool, female: false,
  });
  assert.ok(worn.shadows.includes('hair'), 'the hair floats through the helm');
  assert.ok(worn.shadows.includes('head'), 'the head ref itself still shadows');
  // and a cuirass does NOT invoke the helmet rule.
  const cuir = composeWornArmor({
    pieces: [{ templateIndex: ARMOR_ENUM.Cuirass, material: ARMOR_MATERIAL.Iron }],
    armors: [{ id: 'iron_cuirass', model: 'g.nif', name: '', enchanted: false, parts: [{ part: 3, male: 'b_helm', female: null }] }],
    bodyPool, female: false,
  });
  assert.ok(!cuir.shadows.includes('hair'));
});

// ═══ MW-D30: CLOTHING ═══════════════════════════════════════════════
test('MW-D30: the CLOT reader - type from CTDT, refs like armor, ground mesh stays ground', () => {
  const enc = (str) => Array.from(str, (c) => c.charCodeAt(0));
  const sub = (name, payload) => [...enc(name), payload.length & 255, (payload.length >> 8) & 255, 0, 0, ...payload];
  const rec = (type, subs) => { const body = subs.flat(); return [...enc(type), body.length & 255, (body.length >> 8) & 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...body]; };
  const z = (s2) => [...enc(s2), 0];
  const ctdt = (t) => { const b = new Array(12).fill(0); b[0] = t; return b; };
  const bytes = new Uint8Array([
    // type 7 and type 0 on purpose: a reader that hardcodes the common
    // case (shirt, 2) instead of reading CTDT dies here.
    ...rec('CLOT', [sub('NAME', z('common_skirt_01')), sub('MODL', [...enc('c'), 0x5c, ...z('skirt.nif')]),
      sub('CTDT', ctdt(7)), sub('INDX', [5]), sub('BNAM', z('c_m_skirt'))]),
    ...rec('CLOT', [sub('NAME', z('common_pants_01')), sub('MODL', [...enc('c'), 0x5c, ...z('pants.nif')]),
      sub('CTDT', ctdt(0)), sub('INDX', [21]), sub('BNAM', z('c_m_pants_ul'))]),
  ]);
  const [c, c2] = clothingRecords(bytes);
  assert.equal(c.type, 7, 'CTDT type did not read');
  assert.equal(c2.type, 0);
  assert.equal(c.model, 'c/skirt.nif');
  assert.deepEqual(c.parts.map((p) => p.part), [5]);
});

test('MW-D30: garments resolve BY TYPE, id-sorted - the commons dress the street', () => {
  const C = (id, type) => ({ id, model: `${id}.nif`, name: '', type, enchanted: false, parts: [{ part: 3, male: 'x', female: null }] });
  const clothes = [C('expensive_shirt_02', 2), C('common_shirt_02', 2), C('common_pants_01', 0), C('exquisite_shirt_01', 2)];
  assert.equal(mwClothingRecord(clothes, 'Short Shirt').record.id, 'common_shirt_02', 'the id sort did not put common first');
  assert.equal(mwClothingRecord(clothes, 'Casual Pants').record.id, 'common_pants_01');
  assert.match(mwClothingRecord([], 'Vest').note, /classic sprite stands/);
  assert.equal(mwClothingRecord(clothes, 'Plate Mail').record, null, 'a non-garment resolved');
  // every wearable index the DB mints has a row - the coverage pin
  // holds the totality; this holds the judgement calls by name.
  assert.equal(DF_CLOTHING_ROWS['Casual Cloak'].type, MW_CLOTHING_TYPE.Robe, 'cloaks wear robes - the recorded judgement');
  assert.equal(DF_CLOTHING_ROWS['Sash'].type, MW_CLOTHING_TYPE.Belt);
});

test('MW-D30: the priority law - armor beats clothing, the robe beats the cuirass, ties go later', () => {
  const bodyPool = [
    { id: 'b_shirt', model: 'm/s.nif' }, { id: 'b_cu', model: 'm/c.nif' },
    { id: 'b_robe', model: 'm/r.nif' }, { id: 'b_glove', model: 'm/g.nif' },
  ];
  const clothes = [
    { id: 'common_shirt_01', model: 's.nif', name: '', type: 2, enchanted: false, parts: [{ part: 3, male: 'b_shirt', female: null }] },
    { id: 'common_robe_01', model: 'r.nif', name: '', type: 4, enchanted: false, parts: [{ part: 3, male: 'b_robe', female: null }] },
  ];
  const armors = [
    { id: 'iron_cuirass', model: 'c.nif', name: '', enchanted: false, parts: [{ part: 3, male: 'b_cu', female: null }] },
  ];
  const shirt = { kind: 'clothing', templateIndex: 165, name: 'Short Shirt' };
  const cuirass = { kind: 'armor', templateIndex: ARMOR_ENUM.Cuirass, material: ARMOR_MATERIAL.Iron };
  const robe = { kind: 'clothing', templateIndex: 163, name: 'Plain Robes' };
  // armor beats clothing on the same slot: prio 3 over 2.
  const a = composeWornArmor({ pieces: [shirt, cuirass], armors, clothes, bodyPool, female: false });
  assert.deepEqual(a.adds.map((x) => x.recordId), ['b_cu'], 'the cuirass did not beat the shirt');
  // the robe's base 11 beats the cuirass's 0: prio 24 over 3 - and its
  // RESERVES hide the legs and arms skin with no refs at all.
  const b = composeWornArmor({ pieces: [robe, cuirass], armors, clothes, bodyPool, female: false });
  assert.deepEqual(b.adds.map((x) => x.recordId), ['b_robe'], 'the robe did not beat the cuirass');
  assert.ok(b.shadows.includes('upperleg:right') && b.shadows.includes('forearm:left'),
    'the robe reserve did not hide the limbs');
  // ties go to the LATER piece in the reference order: two garments of
  // one type cannot happen from DF slots, so prove it with the pieces
  // that CAN tie - nothing does at different bases - by symmetry:
  // shirt alone still dresses.
  const c = composeWornArmor({ pieces: [shirt], armors, clothes, bodyPool, female: false });
  assert.deepEqual(c.adds.map((x) => x.recordId), ['b_shirt']);
  // THE +1 ITSELF, swept at the source: in the reference's own walk
  // order armor always precedes the generic garments, so with a
  // first-claimant tie rule the armor bit never flips an outcome this
  // fixture can stage - an equivalent mutant. It stays because it is
  // the reference's formula (npcanimation.cpp:625-630), and the sweep
  // keeps a refactor from quietly flattening it into "equivalent
  // today, wrong the day a garment walks first".
  const src = readFileSync('src/formats/mwItemMap.js', 'utf8');
  assert.match(src, /\(\(0 \+ 1\) << 1\) \+ 1;/, 'armor lost its +1');
  assert.match(src, /\(\(base \+ 1\) << 1\) \+ 0;/, 'clothing lost its +0 formula');
});

test('MW-D30: the skirt reserve and the readout - garments ride the equip table', () => {
  const bodyPool = [{ id: 'b_skirt', model: 'm/sk.nif' }, { id: 'b_pants', model: 'm/p.nif' }];
  const clothes = [
    { id: 'common_skirt_01', model: 'k.nif', name: '', type: 7, enchanted: false, parts: [{ part: 5, male: 'b_skirt', female: null }] },
    { id: 'common_pants_01', model: 'p.nif', name: '', type: 0, enchanted: false, parts: [{ part: 21, male: 'b_pants', female: null }] },
  ];
  const skirt = { kind: 'clothing', templateIndex: 153, name: 'Short Skirt' };
  const pants = { kind: 'clothing', templateIndex: 151, name: 'Casual Pants' };
  // the skirt's base 3 (prio 8) beats pants' 0 (prio 2) on the leg it
  // reserves: the pants' upper-leg ref loses, the skirt's own part
  // dresses, and the groin+legs skin hides.
  const w = composeWornArmor({ pieces: [pants, skirt], armors: [], clothes, bodyPool, female: false });
  assert.deepEqual(w.adds.map((x) => x.recordId), ['b_skirt'], 'the skirt reserve did not beat the pants');
  assert.ok(w.shadows.includes('groin') && w.shadows.includes('upperleg:left'));
  // the readout: clothing slots in, with names; armor unchanged.
  const slots = []; slots[17] = { templateIndex: 165 }; slots[14] = { templateIndex: 154 };
  slots[12] = { templateIndex: ARMOR_ENUM.Helm, material: 1 };
  const worn = dfWornEquipment(slots, { Head: 12, RightArm: 13, LeftArm: 15, ChestArmor: 18, Gloves: 20, LegsArmor: 23, Feet: 26, RightHand: 19, LeftHand: 21, ChestClothes: 17, LegsClothes: 24, Cloak1: 14, Cloak2: 16 }, ARMOR_ENUM);
  assert.deepEqual(worn, [
    { templateIndex: ARMOR_ENUM.Helm, material: 1, kind: 'armor' },
    { kind: 'clothing', templateIndex: 165, name: 'Short Shirt', dye: 0 },
    { kind: 'clothing', templateIndex: 154, name: 'Casual Cloak', dye: 0 },
  ]);
});

test('MW-D31: the first person wears gauntlets, sleeves and the shield - never a helmet in your face', () => {
  const adds = [
    { slot: 'right hand (iron_gauntlet)', bones: ['right hand'], model: 'g.nif', recordId: 'b_gr' },
    { slot: 'left upper arm (shirt)', bones: ['left upper arm'], model: 's.nif', recordId: 'b_ua' },
    { slot: 'shield (iron_shield)', bones: ['shield bone'], model: 'sh.nif', recordId: 'b_sh' },
    { slot: 'head (iron_helmet)', bones: ['head'], model: 'h.nif', recordId: 'b_h' },
    { slot: 'cuirass (iron_cuirass)', bones: ['chest'], model: 'c.nif', recordId: 'b_c' },
    { slot: 'left foot (boots)', bones: ['left foot'], model: 'b.nif', recordId: 'b_f' },
  ];
  assert.deepEqual(fpWornAdds(adds).map((a) => a.recordId), ['b_gr', 'b_ua', 'b_sh'],
    'the fp filter is not the reference\u2019s visible set');
  assert.deepEqual(fpWornAdds([]), []);
});

// ═══ MW-D32: THE BODY FOLLOWS THE EQUIP TABLE ═══════════════════════
test('MW-D32: setWorn is one key compare per frame, and a change rebuilds through the same door', async () => {
  // Mac's report: clothing does not show on the character. It did not
  // - D29-D31 dressed the BUILD, and the build ran once, when the card
  // was pressed. Equipping a cloak afterwards changed nothing on the
  // rig. The body follows the equip table now, exactly as the weapon
  // does (MW-D19): weaponRig hands the rig its worn list every frame,
  // setWorn compares one key, and a change rebuilds with the pieces.
  assert.equal(wornEquipKeyOf([]), '');
  assert.equal(wornEquipKeyOf([{ kind: 'armor', templateIndex: 102, material: 3 }, { kind: 'clothing', templateIndex: 154 }]),
    'armor:102:3:|clothing:154::');
  // MW-D37: a re-dyed garment is a different Morrowind garment, so it is a change.
  assert.notEqual(
    wornEquipKeyOf([{ kind: 'clothing', templateIndex: 165, dye: 2 }]),
    wornEquipKeyOf([{ kind: 'clothing', templateIndex: 165, dye: 9 }]),
    'a re-dye must rebuild');
  assert.notEqual(wornEquipKeyOf([{ templateIndex: 102, material: 3 }]), wornEquipKeyOf([{ templateIndex: 102, material: 4 }]),
    'a material change must be a key change');
  // The instance: before a build, setWorn is a no-op that returns
  // false (nothing to re-dress); after a build, the same list is a
  // no-op and a NEW list re-enters build() with the pieces.
  const inst = createFpArm();
  assert.equal(inst.setWorn([{ kind: 'armor', templateIndex: 102, material: 1 }]), false, 'dressed a rig that was never built');
  const calls = [];
  const deps = {
    loadMorrowindArchives: async () => [],   // refuses at 'data' - the cheapest real build
    storedMorrowindNames: async () => [],
    loadMorrowindFile: async () => new Uint8Array(0),
  };
  await inst.build({ race: 'nord', armor: [], deps });
  // a refused build (no archives) is not `built.ok`, so setWorn stays
  // a no-op - the rig has nothing on it to re-dress. That is the
  // never-traps shape: no rebuild storm against missing data.
  assert.equal(inst.setWorn([{ kind: 'armor', templateIndex: 102, material: 1 }]), false);
  void calls;
});

test('MW-D32: the per-frame read in weaponRig hands the rig its worn list', () => {
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /fpArm\.setWorn\(dfWornEquipment\(equipTableOf\(entity\), EQUIP_SLOTS, ARMOR_ENUM\)\)/,
    'the game no longer dresses the rig from the equip table');
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(arm, /return this\.build\(\{ \.\.\.lastBuildOpts, armor: pieces, weapon: lastBuildOpts\.weapon \}\);/,
    'setWorn no longer rebuilds through build()');
  assert.match(arm, /if \(key === wornEquipKey\) return false;/, 'the fast path is gone - every frame would rebuild');
});

// ═══ MW-D33: the verdicts on the card, the curation table ═══════════
test('MW-D33: a curated face wins, a missing curated id falls back, and the verdict says which', () => {
  const P = (id, slot, { female = false } = {}) => ({
    id, slot, race: 'fprace', female, skin: true, playable: true, firstPerson: false, model: `f/${id}.nif`,
  });
  const parts = [P('b_head_01', 'head'), P('b_head_02', 'head'), P('b_head_03', 'head'), P('b_hair_01', 'hair'), P('b_hair_02', 'hair')];
  const table = { fprace: { male: { 0: { head: 'b_head_03', hair: 'b_hair_02' }, 1: { head: 'b_head_99', hair: 'b_hair_01' } } } };
  const at = (i, t = table) => {
    const rows = playerBodyRows(parts, 'fprace', false, { faceIndex: i, faceTable: t });
    const m = new Map(rows.map((r) => [r.slot, r]));
    return { head: m.get('head').record.id, hair: m.get('hair').record.id, hv: m.get('head').verdict };
  };
  // curated wins over the walk (the walk would give 01/01 at index 0).
  assert.deepEqual([at(0).head, at(0).hair], ['b_head_03', 'b_hair_02'], 'the curated pair did not win');
  assert.match(at(0).hv, /curated/);
  // an id the archives lack falls back to the walk, and SAYS so.
  assert.equal(at(1).head, 'b_head_02', 'a missing curated id did not fall back to the walk');
  assert.match(at(1).hv, /derived \(curated "b_head_99" is not in these archives\)/);
  assert.equal(at(1).hair, 'b_hair_01', 'the valid half of a pair must still apply');
  // no table entry: the walk, labelled derived.
  assert.equal(at(2).head, 'b_head_03');
  assert.match(at(2).hv, /derived$/);
  // the shipped table is valid JSON and an object (empty until curated).
  assert.equal(typeof at(0, undefined).head, 'string');
});

test('MW-D33: the worn verdicts reach the card - one line per piece, dressed or reasoned', () => {
  const pieces = [
    { kind: 'armor', templateIndex: ARMOR_ENUM.Cuirass, material: ARMOR_MATERIAL.Iron },
    { kind: 'clothing', templateIndex: 165, name: 'Short Shirt' },
  ];
  const worn = {
    adds: [{ slot: 'cuirass (iron_cuirass)', bones: ['chest'], model: 'c.nif', recordId: 'b_cu', piece: pieces[0] }],
    shadows: ['chest'],
    notes: ['Short Shirt: no MW clothing of type 2 in these archives - the classic sprite stands'],
  };
  const v = wornVerdicts(pieces, worn);
  assert.equal(v.length, 2);
  assert.deepEqual(v[0].dressed, ['cuirass (iron_cuirass)']);
  assert.equal(v[0].reason, null);
  assert.deepEqual(v[1].dressed, []);
  assert.match(v[1].reason, /classic sprite stands/);
  // and the wiring: the build carries them, status exposes them, the
  // card prints them.
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(arm, /worn: wornVerdicts\(armor \?\? \[\], worn\),/);
  assert.match(arm, /worn: built && built\.ok \? built\.worn : null,/);
  const menu = readFileSync('src/ui/enhancedMenu.js', 'utf8');
  assert.match(menu, /armState\.worn/);
});

// ═══ MW-D35: the face is MATCHED, not walked ════════════════════════
test('MW-D35: portraitFeatures reads skin, hair, length, beard and baldness off an indexed bitmap', () => {
  // a synthetic 20x30 portrait: index 0 background, 1 = skin, 2 = hair.
  // Hair fills the top band and the right side down to the chin; the
  // chin centre is skin -> long hair, no beard.
  const W = 20; const H = 30;
  const data = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < 3 || x > 16 || y > 27) continue;               // background frame
    const hairTop = y < 6; const hairSide = (x < 6 || x > 13) && y < 26;   // both sides, to the jaw
    data[y * W + x] = (hairTop || hairSide) ? 2 : 1;
  }
  const pal = { get: (i) => [{ r: 0, g: 0, b: 0 }, { r: 200, g: 150, b: 120 }, { r: 40, g: 20, b: 10 }][i] };
  const f = portraitFeatures({ width: W, height: H, data }, pal);
  assert.deepEqual(f.skin.map((v) => Math.round(v * 255)), [200, 150, 120], 'skin is the face centre');
  // the top band is a MEAN over hair and forehead - what the matcher
  // needs is that it lands nearer the hair than the skin.
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  assert.ok(d(f.hair, [40 / 255, 20 / 255, 10 / 255]) < d(f.hair, f.skin), 'the top band did not read as hair');
  assert.equal(f.bald, false);
  assert.ok(f.length > 0.3, `long side hair must register as length (${f.length})`);
  assert.ok(f.beard < 0.15, `a skin chin must not read as a beard (${f.beard})`);
  // bald: the top band is skin-coloured -> bald, length 0, no beard.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[y * W + x] === 2) data[y * W + x] = 1;
  const b = portraitFeatures({ width: W, height: H, data }, pal);
  assert.equal(b.bald, true);
  assert.equal(b.length, 0);
});

test('MW-D35: head and hair features, and the match picks by measured likeness', () => {
  const tex = (w, h, rgb, opts = {}) => {
    const rgba = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      let c = rgb;
      if (opts.chinDark && y >= h * 0.66 && y < h * 0.9 && x >= w * 0.3 && x < w * 0.7) c = [rgb[0] * 0.3, rgb[1] * 0.3, rgb[2] * 0.3];
      rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = opts.alpha ?? 255;
    }
    return rgba;
  };
  const pale = headFeatures(tex(32, 32, [220, 180, 160]), 32, 32);
  const dark = headFeatures(tex(32, 32, [90, 60, 40]), 32, 32);
  const bearded = headFeatures(tex(32, 32, [220, 180, 160], { chinDark: true }), 32, 32);
  assert.ok(pale.beard < 0.05 && bearded.beard > 0.6, `beard reads off the chin band (${pale.beard} / ${bearded.beard})`);
  const blondLong = hairFeatures(tex(16, 16, [210, 180, 90]), 16, 16, 30);
  const blackShort = hairFeatures(tex(16, 16, [20, 20, 25]), 16, 16, 12);
  const redMid = hairFeatures(tex(16, 16, [120, 40, 20]), 16, 16, 20);
  assert.deepEqual(blondLong.colour.map((v) => Math.round(v * 255)), [210, 180, 90]);
  // a dark, bearded, long-black-haired portrait picks the dark bearded head and the black hair.
  const portrait = { skin: [90 / 255, 60 / 255, 40 / 255], hair: [20 / 255, 20 / 255, 25 / 255], bald: false, length: 0.0, beard: 0.9 };
  const heads = [{ id: 'pale', f: pale }, { id: 'dark', f: dark }, { id: 'bearded_pale', f: bearded }, { id: 'unmeasured', f: null }];
  const hairs = [{ id: 'blond_long', f: blondLong }, { id: 'black_short', f: blackShort }, { id: 'red_mid', f: redMid }];
  const m = matchFace(portrait, heads, hairs, { female: false });
  assert.equal(m.head, 'dark', 'skin tone must dominate the head pick');
  assert.equal(m.hair, 'black_short', 'colour and shortness must pick the black short hair');
  assert.ok(m.reasons.some((r) => /unmeasured: no texture/.test(r)), 'an unmeasured candidate is named');
  // the female flag drops the beard term: a beardless portrait no longer prefers the beardless pale head over its own tone.
  const fem = matchFace({ ...portrait, beard: 0 }, heads, hairs, { female: true });
  assert.equal(fem.head, 'dark');
  // a bald portrait takes the shortest hair regardless of colour.
  const bald = matchFace({ ...portrait, bald: true, length: 0 }, heads, hairs);
  assert.equal(bald.hair, 'black_short');
  // nothing measurable -> nulls, and the walk stands.
  assert.deepEqual(matchFace(null, heads, hairs).head, null);
});

test('MW-D35: precedence - curated over matched over the walk, and the wiring', () => {
  const P = (id, slot) => ({ id, slot, race: 'fprace', female: false, skin: true, playable: true, firstPerson: false, model: `f/${id}.nif` });
  const parts = [P('b_head_01', 'head'), P('b_head_02', 'head'), P('b_head_03', 'head'), P('b_hair_01', 'hair'), P('b_hair_02', 'hair')];
  const rows = (o) => new Map(playerBodyRows(parts, 'fprace', false, { faceIndex: 0, faceTable: {}, ...o }).map((r) => [r.slot, r]));
  const m = rows({ faceMatch: { head: 'b_head_02', hair: 'b_hair_02' } });
  assert.equal(m.get('head').record.id, 'b_head_02', 'the match did not beat the walk');
  assert.match(m.get('head').verdict, /matched to the portrait/);
  const c = rows({ faceMatch: { head: 'b_head_02', hair: 'b_hair_02' }, faceTable: { fprace: { male: { 0: { head: 'b_head_03' } } } } });
  assert.equal(c.get('head').record.id, 'b_head_03', 'curation did not beat the match');
  assert.equal(c.get('hair').record.id, 'b_hair_02', 'the unmatched-by-table half still takes the match');
  const half = rows({ faceMatch: { head: null, hair: 'b_hair_99' } });
  assert.equal(half.get('head').record.id, 'b_head_01', 'a null half must walk');
  assert.equal(half.get('hair').record.id, 'b_hair_01', 'a matched id the archives lack must walk');
  // facePools is the same law the walk uses.
  assert.deepEqual(facePools(parts, 'fprace', false).heads.map((p) => p.id), ['b_head_01', 'b_head_02', 'b_head_03']);
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(arm, /await matchFaceFor\(\{ race, female, faceIndex, parts, archives, deps: d \}\)/);
  assert.match(arm, /face: faceMatch,/);
  assert.match(readFileSync('src/scenes/dataSource.js', 'utf8'), /export const fetchArena2Bytes/);
});

// ── MW-D31: SKINNING BROUGHT TO 1:1 ─────────────────────────────────

import { skinBatch, buildSkeleton as bSkel } from '../src/formats/mwSkin.js';

test('MW-D31: the skin transform applies ONCE, after the blend - unnormalised weights prove it', () => {
  // riggeometry.cpp:172-204: resultMat sums ONLY invBind*boneInSkel
  // (W column pinned), then `resultMat *= transform` once. Folding the
  // transform into each bone term multiplies its translation by the
  // WEIGHT SUM - and rule 39 forbids renormalising, so a half-weighted
  // vertex slid halfway to the origin.
  const batch = {
    positions: new Float32Array([0, 0, 0]),
    normals: null,
    skin: {
      transform: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [2, 0, 0], scale: 1 },
      shapeTransform: null,
      skeletonRoot: -1,
      rootBone: -1,
      bones: [{ ref: 7, indices: new Uint16Array([0]), weights: new Float32Array([0.5]),
        invBind: { a: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] } }],
    },
  };
  const skelMats = { get: () => ({ a: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }) };
  const out = new Float32Array(3);
  skinBatch(batch, null, null, skelMats, out, null);
  // reference: v' = transform.a * (0.5*I * v) + transform.t = (2,0,0).
  // the folded-per-bone wrong answer is 0.5*(2,0,0) = (1,0,0).
  assert.ok(Math.abs(out[0] - 2) < 1e-6, `translation applied once, not weight-scaled (${out[0]})`);
});

test('MW-D31: the hair slot filters geometry on "hair", not on its attach bone', async () => {
  // npcanimation.cpp:801 - `bonefilter = (type == PRT_Hair) ? "hair" :
  // bonename`. Byte-patch armhand's "Tri Left Hand" to the same-length
  // "Tri Hairstyle": the hair slot must take it AT a bone whose name
  // matches nothing in the file.
  const bytes = f('armhand.nif');
  const from = [...'Tri Left Hand'].map((c) => c.charCodeAt(0));
  const to = [...'Tri Hairstyle'].map((c) => c.charCodeAt(0));
  const patched = bytes.slice();
  outer: for (let i = 0; i < patched.length - from.length; i++) {
    for (let j = 0; j < from.length; j++) if (patched[i + j] !== from[j]) continue outer;
    patched.set(to, i);
    break;
  }
  const asm = await assembleFirstPersonArm({
    skeletonBytes: f('armskel.nif'),
    parts: [{ slot: 'hair', bones: ['left hand'], bytes: patched }],
  });
  const hair = asm.pieces.filter((p) => p.slot === 'hair');
  assert.equal(hair.length, 1, `the "hair"-named shape bound at the head-stand-in bone (${hair.length})`);
  // and the same file under a NON-hair slot at the same bone binds
  // NOTHING - the bone-name filter matches neither remaining shape.
  const asm2 = await assembleFirstPersonArm({
    skeletonBytes: f('armskel.nif'),
    parts: [{ slot: 'chest', bones: ['left hand'], bytes: patched }],
  });
  assert.equal(asm2.pieces.filter((p) => p.slot === 'chest' && p.kind === 'skinned').length, 0,
    'every other slot still filters on its bone name');
});

test('MW-D31: one skinned shape makes the FILE a rig - its unskinned shapes never take the rigid path', async () => {
  // node.cpp:275-276 (one skin sets mUseSkinning for the file) and
  // attach.cpp:42-46 (CopyRigVisitor seeds ONLY RigGeometry - `if
  // (!isRig) return;`). armmixed.nif is the mixed file: a skinned hand
  // plus an unskinned "Trim".
  const asm = await assembleFirstPersonArm({
    skeletonBytes: f('armskel.nif'),
    parts: [{ slot: 'hand', bones: ['right hand'], bytes: f('armmixed.nif') }],
  });
  assert.equal(asm.pieces.filter((p) => p.kind === 'rigid').length, 0,
    'no rigid piece out of a RIG file');
  assert.ok(asm.notes.some((n) => /RIG file are not/.test(n)),
    `the drop is a NOTE, not a silence (${asm.notes.join(' | ')})`);
  assert.equal(asm.pieces.filter((p) => p.kind === 'skinned').length, 1, 'the skinned hand still binds');
});

test('MW-D31 rule 13: the mirror reads the RESOLVED node\'s own name, case-sensitively', async () => {
  // attach.cpp:166 - `attachNode->getName().find("Left") != npos` on the
  // node the skeleton actually carries, not the requested lowercase
  // table entry. Byte-patch armskel's "Left Hand" to "LEFT HAND": the
  // reference does NOT mirror there.
  const skel = f('armskel.nif');
  const from = [...'Left Hand'].map((c) => c.charCodeAt(0));
  const to = [...'LEFT HAND'].map((c) => c.charCodeAt(0));
  const patched = skel.slice();
  outer: for (let i = 0; i < patched.length - from.length; i++) {
    for (let j = 0; j < from.length; j++) if (patched[i + j] !== from[j]) continue outer;
    patched.set(to, i);
    break;
  }
  const asm = await assembleFirstPersonArm({
    skeletonBytes: patched,
    parts: [{ slot: 'upperarm', bones: ['left hand'], bytes: f('armcuff.nif') }],
  });
  const rigid = asm.pieces.find((p) => p.kind === 'rigid');
  assert.ok(rigid, 'the rigid cuff bound at the all-caps bone');
  assert.equal(rigid.mirrored, false,
    '"LEFT HAND" does not contain "Left" - the reference\'s test is case-sensitive on the node name');
  // and the unpatched skeleton still mirrors
  const asm2 = await assembleFirstPersonArm({
    skeletonBytes: skel,
    parts: [{ slot: 'upperarm', bones: ['left hand'], bytes: f('armcuff.nif') }],
  });
  assert.equal(asm2.pieces.find((p) => p.kind === 'rigid').mirrored, true, 'the real "Left Hand" node mirrors');
});

// ── MW-D32: BODY-PART RESOLUTION BROUGHT TO GETBODYPARTS-WHOLE ──────

import { resolveBodyParts, raceRecords } from '../src/formats/mwFirstPerson.js';
import { indexSkins, assembleNpc } from '../src/formats/mwNpc.js';
import { resolveWeaponParts } from '../src/combat/fpArm.js';

test('MW-D32: the sweep is getBodyParts whole - last wins, filters exact, FP hand ladder', () => {
  const P = (id, slot, o = {}) => ({ id, slot, race: 'fprace', female: false, skin: true,
    playable: true, firstPerson: /1st$/.test(id), model: `f/${id}.nif`, ...o });
  const parts = [
    P('b_chest_base', 'chest'),
    P('b_chest_expansion', 'chest'),          // LAST in load order WINS (:1286-1293)
    P('b_chest_np', 'chest', { playable: false }),   // BPF_NotPlayable skipped (:1208)
    P('b_chest_cloth', 'chest', { skin: false }),    // MT_Skin only (:1210)
    P('b_neck_m', 'neck'),
    P('b_clav', 'clavicle'),                   // sBodyPartMap never maps it
    P('b_hand_m3p', 'hand'),
    P('b_hand_f3p', 'hand', { female: true }),
  ];
  const tp = resolveBodyParts(parts, 'fprace', false, { firstPerson: false });
  assert.equal(tp.get('chest').id, 'b_chest_expansion', 'the LAST proper record wins - expansions override');
  assert.equal(tp.get('clavicle'), undefined, 'clavicle never resolves');
  // female: her record wins where it exists, male fills where not (:1261-1280)
  const tpF = resolveBodyParts(parts, 'fprace', true, { firstPerson: false });
  assert.equal(tpF.get('hand').id, 'b_hand_f3p');
  assert.equal(tpF.get('neck').id, 'b_neck_m', 'male fallback fills an empty female slot');
  // FIRST PERSON: a hand slot without a .1st record falls back to the
  // 3P skin (:1232-1254); a NON-hand slot does not (:1258).
  const fp = resolveBodyParts(parts, 'fprace', false, { firstPerson: true });
  assert.equal(fp.get('hand').id, 'b_hand_m3p', 'the arm slots fall back to third-person skins');
  assert.equal(fp.get('chest'), undefined, 'a non-hand slot takes its own view only');
});

test('MW-D32: indexSkins filters playable, NOT vampire - the reference sweep never had a vampire test', () => {
  // getBodyParts (npcanimation.cpp:1206-1214) filters BPF_NotPlayable
  // and MT_Skin; there is no vampire condition in the sweep.
  const B = (id, part, o = {}) => [id, { id, kind: 0, vampire: 0, part, female: false, playable: true, race: 'r', model: `${id}.nif`, ...o }];
  const bodies = new Map([
    B('chest_vamp', 3, { vampire: 1 }),
    B('chest_np', 3, { playable: false }),
  ]);
  const idx = indexSkins(bodies);
  const slots = idx.get('r');
  assert.ok(slots && slots.get(3), 'the vampire-flagged skin IS swept');
  assert.equal(slots.get(3).male.id, 'chest_vamp');
  // and the not-playable one is not
  assert.ok(!Object.values(slots.get(3)).some((b) => b && b.id === 'chest_np'), 'NotPlayable is filtered');
});

test('MW-D32: assembleNpc picks the FEMALE skeleton column', () => {
  // getActorSkeleton (actorutil.cpp): beast > female > male, and the
  // female column was silently missing.
  const esm = {
    npcs: new Map([['f', { id: 'f', name: 'F', race: 'r', female: true, head: null, hair: null, model: null }],
      ['m', { id: 'm', name: 'M', race: 'r', female: false, head: null, hair: null, model: null }]]),
    races: new Map([['r', { name: 'R', beast: false }]]),
    bodies: new Map(),
  };
  assert.equal(assembleNpc(esm, 'f').animFile, 'meshes\\base_anim_female.nif');
  assert.equal(assembleNpc(esm, 'm').animFile, 'meshes\\base_anim.nif');
});

test('MW-D32: the typed weapon bone is used only when the rig CARRIES it', async () => {
  // npcanimation.cpp:787-795 - bonename starts as sPartList's "Weapon
  // Bone" and becomes mAttachBone only `if (found != nodeMap.end())`.
  const skel = f('armfp.nif');
  const from = [...'Weapon Bone Left'].map((c) => c.charCodeAt(0));
  const to = [...'Weapon Bone XLft'].map((c) => c.charCodeAt(0));
  const patched = skel.slice();
  outer: for (let i = 0; i < patched.length - from.length; i++) {
    for (let j = 0; j < from.length; j++) if (patched[i + j] !== from[j]) continue outer;
    patched.set(to, i);
    break;
  }
  const blade = f('weapon.nif');
  const find = () => ({ get: () => blade });
  const bowRec = { id: 'bow', name: 'Bow', model: 'w/b.nif', type: 9, enchanted: false, speed: 1 };
  // MarksmanBow (9) types to "Weapon Bone Left"; the patched rig lacks
  // it, so the resolve lands on the generic bone instead of dropping.
  const r = resolveWeaponParts({ weapon: { templateIndex: 130 }, allWeapons: [bowRec], find, skeletonBytes: patched });
  assert.ok(r.weaponInfo, 'the bow still resolves');
  assert.equal(r.weaponInfo.bone, 'Weapon Bone', 'fallback to the generic bone the rig has');
  // and the unpatched rig keeps the typed bone
  const r2 = resolveWeaponParts({ weapon: { templateIndex: 130 }, allWeapons: [bowRec], find, skeletonBytes: skel });
  assert.equal(r2.weaponInfo.bone, 'Weapon Bone Left');
});

test('MW-D32: raceRecords reads RADT by hand-laid offsets - heights at 120, flags at 136', () => {
  // loadrace.hpp:50-70. Values planted distinct so an off-by-four
  // reader answers the wrong field and dies.
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const radt = new Uint8Array(140);
  const dv = new DataView(radt.buffer);
  dv.setFloat32(120, 1.05, true);   // male height
  dv.setFloat32(124, 0.95, true);   // female height
  dv.setFloat32(128, 1.1, true);    // male weight
  dv.setFloat32(132, 0.9, true);    // female weight
  dv.setInt32(136, 3, true);        // playable | beast
  const d = [...sub('NAME', Z('argonian')), ...sub('RADT', [...radt])];
  const rec = Uint8Array.from([...A('RACE'), ...U(d.length), ...U(0), ...U(0), ...d]);
  const races = raceRecords(rec);
  const r = races.get('argonian');
  assert.ok(r && r.beast && r.playable);
  assert.ok(Math.abs(r.height[0] - 1.05) < 1e-6 && Math.abs(r.height[1] - 0.95) < 1e-6);
  assert.ok(Math.abs(r.weight[0] - 1.1) < 1e-6 && Math.abs(r.weight[1] - 0.9) < 1e-6);
});

// --- MW-D34: render and scale ----------------------------------------------

test('MW-D34: the third-person model matrix carries the measured chirality flip and adjustScale', () => {
  // MEASURED through the real composite (mwArmProbe L5b): the 3P body
  // rides drawRigSpriteBox into the world's mirrorProjectionX lens, and
  // the port's world convention is left-handed (motor.js:573 - the
  // player's right is +X at yaw 0), so a right-handed NIF actor placed
  // with a pure rotation reads MIRRORED on screen. The -u on the local
  // side axis is the same basis adaptation the mirror gives every
  // Daggerfall asset; rs is adjustScale (npc.cpp:1124-1135) - x,y take
  // WEIGHT, z HEIGHT, and in this frame local y is the MW vertical.
  const src = readFileSync(new URL('../src/combat/fpArm.js', import.meta.url), 'utf8');
  assert.match(src, /trs\(feet\[0\], feet\[1\], feet\[2\], 0, yawDeg, 0, -u \* rs\.weight, u \* rs\.height, u \* rs\.weight\)/,
    'the flip and the scale live in the model matrix');
  assert.match(src, /halfH = \(\(maxZ - minZ\) \* u \* rs\.height\) \/ 2/,
    'the sprite box grows with the height');
  assert.match(src, /halfW = \(Math\.hypot\(maxX - minX, maxY - minY\) \* u \* rs\.weight\) \/ 2/,
    'and with the weight');
});

test('MW-D34: textures decode BY EXTENSION - a TGA is not a failed DDS', async () => {
  const { decodeTga, decodeBmp, decodeTextureImage } = await import('../src/formats/mwTexture.js');
  // The ladder legitimately answers the AUTHORED .tga/.bmp when the
  // .dds probe misses (resourcehelpers.cpp:112-114), and the reference
  // decodes that path by its extension with the non-standard "targa"
  // aliased to "tga" (imagemanager.cpp:104-110).
  //
  // A 2x1 uncompressed 24-bit TGA, TOP-origin (descriptor bit 5):
  // red then blue, stored BGR.
  const tgaTop = Uint8Array.from([
    0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1, 0, 24, 0x20,
    0, 0, 255, /* red */ 255, 0, 0, /* blue */
  ]);
  const top = decodeTga(tgaTop);
  assert.deepEqual([top.width, top.height], [2, 1]);
  assert.deepEqual([...top.mips[0].rgba], [255, 0, 0, 255, 0, 0, 255, 255], 'BGR swizzled, top row first');
  // The SAME pixels 1x2 BOTTOM-origin (descriptor 0): the file's first
  // row is the image's BOTTOM row, so red ends up at y=1.
  const tgaBottom = Uint8Array.from([
    0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 0, 24, 0x00,
    0, 0, 255, 255, 0, 0,
  ]);
  const bot = decodeTga(tgaBottom);
  assert.deepEqual([...bot.mips[0].rgba], [0, 0, 255, 255, 255, 0, 0, 255],
    'bottom-up storage flips: file-first red lands on the BOTTOM row, so blue reads back first');
  // RLE (type 10): one run packet covers both pixels.
  const tgaRle = Uint8Array.from([
    0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1, 0, 24, 0x20,
    0x81, 0, 255, 0, /* run of 2, green */
  ]);
  assert.deepEqual([...decodeTga(tgaRle).mips[0].rgba], [0, 255, 0, 255, 0, 255, 0, 255]);
  // BMP: 1x2 24-bit, positive height = bottom-up, rows padded to 4
  // bytes (3 -> 4). File rows: green (bottom), then red (top).
  const bmp = Uint8Array.from([
    0x42, 0x4d, ...[62, 0, 0, 0], 0, 0, 0, 0, ...[54, 0, 0, 0],
    ...[40, 0, 0, 0], ...[1, 0, 0, 0], ...[2, 0, 0, 0], 1, 0, 24, 0,
    ...[0, 0, 0, 0], ...new Array(20).fill(0),
    0, 255, 0, 0, /* green + pad */ 0, 0, 255, 0, /* red + pad */
  ]);
  const b = decodeBmp(bmp);
  assert.deepEqual([b.width, b.height], [1, 2]);
  assert.deepEqual([...b.mips[0].rgba], [255, 0, 0, 255, 0, 255, 0, 255],
    'bottom-up: the file\'s SECOND row (red) is the image\'s top');
  // The router: extension picks the decoder, "targa" aliases, unknown
  // extensions refuse (the caller turns that into the warning image).
  assert.deepEqual(decodeTextureImage('textures/a.TGA', tgaTop).mips[0].rgba.length, 8);
  assert.deepEqual(decodeTextureImage('textures/a.targa', tgaTop).mips[0].rgba.length, 8);
  assert.throws(() => decodeTextureImage('textures/a.dds', tgaTop), /decodeDds/,
    'a .dds path takes the DDS decoder, which refuses these bytes as its own error');
  assert.throws(() => decodeTextureImage('textures/a.gif', tgaTop), /no decoder/);
});

// ═══ AUDIT 32: the deep audit's findings, pinned ════════════════════
test('AUDIT 32 F1: the head is sampled through its own mesh - the texture layout is never assumed', () => {
  // A texture whose CENTRE band is dark (hair, say) and whose skin
  // lives in the top-left quarter - a layout the band read gets wrong.
  const w = 32; const h = 32; const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    const skin = x < 8 && y < 8;                // a corner the band never reads
    const c = skin ? [210, 160, 130] : [30, 20, 15];
    rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255;
  }
  // A head mesh: front vertices (high y) at cheek height point their UVs
  // into the skin quarter; back vertices point into the dark region.
  const pos = []; const uvs = [];
  const put = (x, y, z, u, v) => { pos.push(x, y, z); uvs.push(u, v); };
  for (let i = 0; i < 20; i++) {
    put(0, 10, 5 + (i % 5), 0.1, 0.1);        // front cheeks -> skin texels
    put(0, -10, 5 + (i % 5), 0.75, 0.75);     // back of the skull -> dark texels
  }
  put(0, 10, 0, 0.75, 0.75); put(0, 10, 0.5, 0.75, 0.75);   // chin, front, dark -> bearded
  const geom = [{ positions: Float32Array.from(pos), uvs: Float32Array.from(uvs) }];
  const f = headFeatures(rgba, w, h, geom);
  assert.equal(f.via, 'mesh');
  assert.deepEqual(f.skin.map((v) => Math.round(v * 255)), [210, 160, 130], 'the face was not sampled through the front UVs');
  assert.ok(f.beard > 0.6, `a dark chin must read as a beard (${f.beard})`);
  // the band read would have called the skin dark - and it is what
  // stands when a mesh carries no UVs, named as such.
  const b = headFeatures(rgba, w, h, [{ positions: Float32Array.from(pos), uvs: null }]);
  assert.equal(b.via, 'band');
  assert.ok(b.skin[0] < 0.3, 'the band read on this layout must be wrong - that is the point');
});

test('AUDIT 32 F2/F3: the match is memoised per identity and generation, and a miss is not', () => {
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(arm, /const fkey = `\$\{gen\}:\$\{race\}:\$\{female \? 'f' : 'm'\}:\$\{faceIndex \| 0\}`;/,
    'the face cache key lost the identity or the generation');
  assert.match(arm, /faceMatch = FACE_MATCH_CACHE\.get\(fkey\);/);
  assert.match(arm, /if \(faceMatch\.head \|\| faceMatch\.hair\) FACE_MATCH_CACHE\.set\(fkey, faceMatch\);/,
    'a missed portrait must not be memoised for the session');
  assert.match(arm, /headFeatures\(m0\.rgba, m0\.width, m0\.height, batches\.map/,
    'the head is not measured through its mesh');
});

// ═══ MW-D36: the model stands where the doll stood (enhanced only) ══
test('MW-D36: figure() is null without a body, subscribe() fires on settlement and unsubscribes', async () => {
  const arm = createFpArm();
  assert.equal(arm.figure(), null, 'no body, no figure - the classic doll stands');
  let fired = 0;
  const off = arm.subscribe(() => { fired++; });
  // a refused build settles too: the deps door answers no archives.
  await arm.build({ race: 'nord', deps: { loadMorrowindArchives: async () => [] } });
  assert.equal(fired, 1, 'a settled build must notify the panel');
  arm.unload();
  assert.equal(fired, 2, 'an unload must notify the panel');
  off();
  arm.unload();
  assert.equal(fired, 2, 'unsubscribed listeners must not fire');
});

test('MW-D36: the pack takes the model only when it stands, and never lets the model unequip', () => {
  const pack = readFileSync('src/ui/enhancedInventory.js', 'utf8');
  assert.match(pack, /const figureUrl = modelFigureUrl\(\);/);
  assert.match(pack, /const dollUrl = figureUrl \|\| paperDollDataUrl\(paperDollPixels\(\), \{ scale: 4 \}\);/,
    'the classic doll must remain the fallback');
  assert.match(pack, /if \(figureUrl\) attachFigureTurn\(img\);/, 'the model must turn by drag');
  // display only: the model's image gets NO click-to-unequip handler.
  const turn = pack.slice(pack.indexOf('function attachFigureTurn'), pack.indexOf('function attachFigureTurn') + 900);
  assert.ok(!/takeOff|slotAtPaperDoll|onclick/.test(turn), 'the model must not unequip on click (Mac: unequip stays with the list)');
  assert.match(pack, /_unsubscribeFigure = d\.fpArm\.subscribe\(/, 'the pack must repaint when a build settles');
  assert.match(pack, /_unsubscribeFigure\?\.\(\); _unsubscribeFigure = null;/, 'the subscription must have an owner');
  // enhanced only: the door that hands over the arm module is the enhanced door.
  const door = readFileSync('src/ui/inventoryDoor.js', 'utf8');
  assert.match(door, /fpArm: armMod\?\.fpArm \?\? null/);
  const classic = readFileSync('src/ui/nativeInventory.js', 'utf8');
  assert.ok(!/fpArm|figure\(/.test(classic), 'the classic inventory must not know the model exists');
  const rend = readFileSync('src/render/renderer.js', 'utf8');
  assert.match(rend, /renderCharacterSpriteImage\(mesh, modelMatrix, proj, view, pw, ph, \{ studio = true \} = \{\}\)/);
  assert.match(rend, /out\.set\(raw\.subarray\(y \* pw \* 4, \(y \+ 1\) \* pw \* 4\), \(ph - 1 - y\) \* pw \* 4\);/, 'GL rows must flip on the way out');
});

test('AUDIT 33: the figure stands in ANY view, through the one upload, at a quantised yaw', () => {
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  const fig = arm.slice(arm.indexOf('    figure({ yaw = 0, height = 384 } = {}) {'), arm.indexOf('    figure({ yaw = 0, height = 384 } = {}) {') + 1400);
  // F1: the inventory opens from first person; the figure must not
  // demand the wheel's view mode or a mesh only the wheel uploads.
  assert.ok(!/thirdActive\(\)/.test(fig), 'the figure gates on the wheel being active');
  assert.match(fig, /if \(!\(built && built\.ok && thirdBuilt && thirdBuilt\.ok && renderer\)\) return null;/);
  assert.match(fig, /uploadThirdMesh\(t\);/, 'the figure does not upload through the one helper');
  // one upload for both consumers: the wheel's update path uses the same helper.
  assert.equal((arm.match(/uploadThirdMesh\(t\);/g) || []).length, 2, 'the upload has two callers and one body');
  assert.equal((arm.match(/renderer\.createCharacterMesh\(thirdPacked\.packed/g) || []).length, 1, 'a second third-mesh upload is growing');
  // F2: the pack quantises the yaw before it asks.
  const pack = readFileSync('src/ui/enhancedInventory.js', 'utf8');
  assert.match(pack, /const yaw = Math\.round\(_figureYaw \/ 0\.1\) \* 0\.1;/);
  assert.match(pack, /armMod\.figure\(\{ yaw, height: 384 \}\)/);
});

// ═══ IG1-IG3: MAC'S IN-GAME NOTES (2026-08-31) ══════════════════════

test('IG3: the SHIELD wears getShieldMesh\'s whole ladder - body part, hard refusal, ground fallback', () => {
  // actoranimation.cpp:108-139. A shield is the ONE worn piece whose
  // ladder may end at the item's own ground mesh; the composer's
  // generic "the ground mesh is not a body" refusal is right for every
  // other slot and was exactly why no equipped shield ever appeared.
  const bodyPool = [
    { id: 'b_shield_arm', model: 'a/sh.nif', bodyKind: 2 },
    { id: 'b_shield_cloth', model: 'a/shc.nif', bodyKind: 1 },
    { id: 'b_shield_f', model: 'a/shf.nif', bodyKind: 2 },
  ];
  const worn = (armo, female = false) => composeWornArmor({
    pieces: [{ templateIndex: ARMOR_ENUM.Kite_Shield, material: ARMOR_MATERIAL.Iron }],
    armors: [armo], bodyPool, female,
  });
  // 1. A PRT_Shield ref naming an MT_Armor body: the body's model wins.
  const viaBody = worn({ id: 'iron_shield', model: 'g/ground.nif', name: '', enchanted: false,
    parts: [{ part: 10, male: 'b_shield_arm', female: null }] });
  assert.equal(viaBody.adds.length, 1);
  assert.equal(viaBody.adds[0].model, 'a/sh.nif');
  assert.deepEqual(viaBody.adds[0].bones, ['shield bone']);
  // 2. NO shield ref at all: the GROUND MODEL - the reference's own
  //    fallback (`return shield.getClass().getCorrectedModel(shield)`).
  const viaGround = worn({ id: 'iron_shield', model: 'g/ground.nif', name: '', enchanted: false, parts: [] });
  assert.equal(viaGround.adds.length, 1);
  assert.equal(viaGround.adds[0].model, 'g/ground.nif');
  assert.match(viaGround.adds[0].slot, /ground mesh/, 'and the row says so');
  // 3. THE HARD GATE: a NAMED body that is missing, or not MT_Armor,
  //    answers EMPTY - the slot reserves INVISIBLE by law, never the
  //    ground mesh (getShieldMesh returns an empty path there).
  const missing = worn({ id: 'iron_shield', model: 'g/ground.nif', name: '', enchanted: false,
    parts: [{ part: 10, male: 'b_gone', female: null }] });
  assert.equal(missing.adds.length, 0, 'missing body: reserved empty, NOT the ground fallback');
  assert.ok(missing.notes.some((n) => /reserves EMPTY/.test(n)));
  const wrongKind = worn({ id: 'iron_shield', model: 'g/ground.nif', name: '', enchanted: false,
    parts: [{ part: 10, male: 'b_shield_cloth', female: null }] });
  assert.equal(wrongKind.adds.length, 0, 'a non-armor body part is the same refusal');
  // 4. THE SEXED PICK has NO male-to-female fallback (`female &&
  //    !mFemale.empty() ? mFemale : mMale`): a male facing a female-only
  //    ref has NO name, and an unnamed ref walks on to the ground.
  const femOnly = { id: 'iron_shield', model: 'g/ground.nif', name: '', enchanted: false,
    parts: [{ part: 10, male: null, female: 'b_shield_f' }] };
  assert.equal(worn(femOnly, false).adds[0].model, 'g/ground.nif', 'a man ignores the female-only ref');
  assert.equal(worn(femOnly, true).adds[0].model, 'a/shf.nif', 'a woman takes it');
});

test('IG1: the first-person offset hits the lens twice and the neck once, and the bob rides it', () => {
  // calculateFirstPersonPosition adds the offset ON TOP of the tracked
  // camera bone (camera.cpp:149-157), which already moved once with
  // the neck (npcanimation.cpp:723) - that double-vs-single is why the
  // arms visibly sink when you sneak and bob when you walk
  // (head_bobbing.lua:57 drives the same setFirstPersonOffset channel).
  // The moving picture is mwArmProbe L5c/L5d; these sweep the wiring.
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(arm, /eye\[0\] \+= fpOffset\[0\];\s*\n\s*eye\[1\] \+= fpOffset\[2\];\s*\n\s*eye\[2\] -= fpOffset\[1\];/,
    'the lens takes the offset again, MW z to pass up');
  assert.match(arm, /const bobZ = cam && cam\.bob \? \(cam\.bob\[1\] \|\| 0\) \* MW_UNITS_PER_METER : 0;/,
    'the bob\'s vertical joins the channel in MW units');
  assert.match(arm, /fpOffset = \[sneak\[0\], sneak\[1\], sneak\[2\] \+ bobZ\];/,
    'sneak and bob compose into the ONE vector the neck takes');
  // ...and every bobbing host feeds the dep (the four-hosts law).
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    assert.match(readFileSync(host, 'utf8'), /bob: \[0, player\.bobOffset \? player\.bobOffset\[1\] : 0\]/,
      `${host} hands the bob's vertical to the arm`);
  }
  assert.match(readFileSync('src/scenes/dungeonContext.js', 'utf8'), /bob: \[0, _fpBobY\]/,
    'the dungeon context latches it with the eye and the pitch');
});

test('IG2: the swap caches - archives resident per generation, the memos gated on a REAL generation', () => {
  // Every equip change rebuilds the arms; every rebuild used to re-read
  // and re-index every .bsa out of IndexedDB - seconds per swap.
  const ds = readFileSync('src/scenes/dataSource.js', 'utf8');
  assert.match(ds, /if \(_mwArchiveCache && _mwArchiveCache\.gen === _mwGeneration\) return _mwArchiveCache\.archives;/,
    'the mapped archives are the generation cache');
  assert.match(ds, /_mwArchiveCache = \{ gen: _mwGeneration, archives \};/);
  assert.match(ds, /_mwGeneration\+\+; _mwEsm = undefined; _mwArchiveCache = null; _mwFileCache = null;/,
    'a new attach drops the old set');
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.ok(!/archives\.length = 0;/.test(arm),
    'the build no longer guts the cached archive array - that truncation was the seconds');
  // The memos stand DOWN without a real generation: a test\'s fixtures
  // can share a name and a byte length while differing in content -
  // the mSpeed pin proved it the day the weapon walk joined the memo.
  assert.match(arm, /if \(gen === null\) return fn\(e\.bytes\);/, 'the esm walk memo is gated');
  assert.match(arm, /if \(gen === null \|\| gen === undefined\) return clipReport\(/, 'the kf parse memo is gated');
  assert.match(arm, /const gen = typeof d\.morrowindDataGeneration === 'function' \? d\.morrowindDataGeneration\(\) : null;/,
    'and only the real store\'s stamp turns them on');
});

test('IG4/IG5: the arms TILT WITH the look by default - the owner\'s picked behavior over the reference\'s lag', () => {
  // Mac rejected the reference's quarter-lag (arms move AGAINST the
  // look; measured at 0.26 vs the law's 0.25, so the port WAS the
  // reference) and then rejected rigid glue as "stay in position"; what
  // he picked: looking down visibly dips the weapon/arms, looking up
  // raises them. Built as aim-glue in the pose (neckAim 1, offset
  // zeroed) plus an under-rotated draw lens - the picture rotates WITH
  // the look about the eye, pure tilt, no drift - saturating at
  // FOLLOW_TILT_MAX so a clamp-hard look keeps ink in frame (measured:
  // uncapped, 1.4 rad down left ZERO texels). The moving picture is
  // probe L5e; these sweep the wiring.
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  // DA1 (the merge after the seam landed): the read goes through
  // appStorage() - localStorage in a browser, the desktop shell's file
  // store in the app, null in bare Node, and the ?? 'true' default
  // holds in all three. The seam's own pin (filestorage.test.js)
  // forbids a bare globalThis.localStorage here.
  assert.match(arm, /\(appStorage\(\)\?\.getItem\(FOLLOW_CAMERA_KEY\) \?\? 'true'\) !== 'false'/,
    'an untouched store answers TRUE - tilt is the default, the law is the toggle');
  assert.match(arm, /let followCam = readFollowCamera\(\);/, 'the live arm reads it at construction');
  assert.match(arm, /neckAim: followCam \? 1 : aimFactor,/,
    'tilting arms hold aim 1 in the POSE; the law path still passes the decaying state');
  assert.match(arm, /if \(followCam\) \{ fpOffset\[0\] = 0; fpOffset\[1\] = 0; fpOffset\[2\] = 0; return null; \}/,
    'and the offset zeroes at its ONE source, upstream of both applications');
  // The lens half: a saturated half-tilt given back, law path untouched.
  assert.match(arm, /export const FOLLOW_LENS_FACTOR = 0\.5;/);
  assert.match(arm, /export const FOLLOW_TILT_MAX = 0\.25;/);
  assert.match(arm, /Math\.max\(-FOLLOW_TILT_MAX, Math\.min\(FOLLOW_TILT_MAX, look \* \(1 - FOLLOW_LENS_FACTOR\)\)\)/,
    'the tilt is half the look, saturated');
  assert.match(arm, /const pitch = look - tilt;/, 'and the lens gives exactly the tilt back');
  // The toggle is live and persistent - the pause card flips it.
  const inst = createFpArm();
  assert.equal(inst.followCamera(), true, 'a bare Node context (no storage) still defaults ON');
  assert.equal(inst.setFollowCamera(false), false);
  assert.equal(inst.followCamera(), false);
  inst.setFollowCamera(true);
  // ...and the card offers it, labelled by CURRENT mode.
  const menu = readFileSync('src/ui/enhancedMenu.js', 'utf8');
  assert.match(menu, /fpArm\.followCamera\(\)\s*\n?\s*\? \{ label: 'Arms: tilt with the look', onClick: \(\) => \{ fpArm\.setFollowCamera\(false\); render\(\); \} \}\s*\n?\s*: \{ label: 'Arms: Morrowind look-lag', onClick: \(\) => \{ fpArm\.setFollowCamera\(true\); render\(\); \} \}/,
    'the pause card names the mode you are IN and one click flips it');
  // The probe measures BOTH modes: the law layers with the flag off,
  // the shipped tilt with it on (REVERSED cy ordering plus the hard-look
  // frame-survival gate).
  const probe = readFileSync('tools/mwArmProbe.mjs', 'utf8');
  assert.match(probe, /window\.__arm\.setFollowCamera\(false\);/, 'L5c/L5d measure the LAW with the flag off');
  assert.match(probe, /window\.__arm\.setFollowCamera\(true\); \}\);/, 'L5e measures the shipped tilt');
  assert.match(probe, /tiltUp\.cy > tiltLevel\.cy \+ 0\.03 && tiltDown\.cy < tiltLevel\.cy - 0\.03/,
    'and its ordering is WITH the look - the reverse of the law layer');
});

// ═══ MW-D37: the materials are colour truth; the dye picks the garment ═
test('MW-D37: the material chains follow Daggerfall\u2019s own palette, and walk in order', async () => {
  const { DF_TO_MW_MATERIAL, pickWeaponRecord: pick } = await import('../src/formats/mwFirstPerson.js');
  const { DF_TO_MW_ARMOR_MATERIAL, DF_MATERIAL_RGB, mwArmorRecords } = await import('../src/formats/mwItemMap.js');
  // colour truth: Elven is silver-white in ART_PAL, so it wears silver
  // (weapons) / steel (armor) - never green glass.
  assert.deepEqual(DF_TO_MW_MATERIAL.Elven, ['silver', 'steel']);
  assert.deepEqual(DF_TO_MW_ARMOR_MATERIAL.Elven, ['steel']);
  assert.ok(!Object.values(DF_TO_MW_MATERIAL).flat().includes('glass') || DF_TO_MW_MATERIAL.Orcish[0] === 'glass',
    'glass is orcish\u2019s green and nobody else\u2019s');
  // every DF material has its measured swatch
  for (const m of Object.keys(DF_TO_MW_MATERIAL)) assert.ok(DF_MATERIAL_RGB[m], `${m} has no measured colour`);
  // Adamantium walks the chain: Tribunal's own first, ebony when absent.
  const W = (id, type) => ({ id, model: `${id}.nif`, name: '', type, enchanted: false });
  assert.equal(pick([W('ebony_dagger', 0), W('adamantium_dagger', 0)], 0, 'Adamantium').id, 'adamantium_dagger');
  assert.equal(pick([W('ebony_dagger', 0), W('iron_dagger', 0)], 0, 'Adamantium').id, 'ebony_dagger');
  const R = (id) => ({ id, model: 'm.nif', name: '', enchanted: false, parts: [] });
  assert.equal(mwArmorRecords([R('ebony_cuirass'), R('adamantium_cuirass')], ARMOR_ENUM.Cuirass, ARMOR_MATERIAL.Adamantium).records[0].id, 'adamantium_cuirass');
  assert.equal(mwArmorRecords([R('ebony_cuirass'), R('steel_cuirass')], ARMOR_ENUM.Cuirass, ARMOR_MATERIAL.Adamantium).records[0].id, 'ebony_cuirass');
  assert.equal(mwArmorRecords([R('steel_cuirass'), R('glass_cuirass')], ARMOR_ENUM.Cuirass, ARMOR_MATERIAL.Elven).records[0].id, 'steel_cuirass', 'elven armor is steel, not glass');
});

test('MW-D37: the dye picks the nearest-coloured garment, and falls back to the id sort', () => {
  const C = (id, type) => ({ id, model: `${id}.nif`, name: '', type, enchanted: false, parts: [] });
  const clothes = [C('common_shirt_01', 2), C('common_shirt_02', 2), C('common_shirt_03', 2)];
  const colours = { common_shirt_01: [120, 120, 130], common_shirt_02: [140, 40, 20], common_shirt_03: [70, 110, 160] };
  const colourOf = (c) => colours[c.id] ?? null;
  // Red (dye 2, #832c10) -> the red shirt; Blue (dye 0, #4d6f9b) -> the blue one.
  assert.equal(mwClothingRecord(clothes, 'Short Shirt', { dye: 2, colourOf }).record.id, 'common_shirt_02');
  assert.equal(mwClothingRecord(clothes, 'Short Shirt', { dye: 0, colourOf }).record.id, 'common_shirt_03');
  assert.match(mwClothingRecord(clothes, 'Short Shirt', { dye: 2, colourOf }).note, /resolved by dye/);
  // no sampler: the id sort, as before; a sampler that measures nothing: the same.
  assert.equal(mwClothingRecord(clothes, 'Short Shirt', { dye: 2 }).record.id, 'common_shirt_01');
  assert.equal(mwClothingRecord(clothes, 'Short Shirt', { dye: 2, colourOf: () => null }).record.id, 'common_shirt_01');
  // the composer hands the piece's dye through.
  const bodyPool = [{ id: 'b_s2', model: 'm2.nif' }];
  const withParts = clothes.map((c) => ({ ...c, parts: [{ part: 3, male: c.id === 'common_shirt_02' ? 'b_s2' : 'b_none', female: null }] }));
  const w = composeWornArmor({ pieces: [{ kind: 'clothing', templateIndex: 165, name: 'Short Shirt', dye: 2 }], armors: [], clothes: withParts, bodyPool, female: false, colourOf });
  assert.deepEqual(w.adds.map((a) => a.recordId), ['b_s2'], 'the red shirt\u2019s own part must dress');
  // the report carries both swatches per row
  const rep = mwItemReport([], { clothes: withParts, colourOf, weapons: [], pickWeapon: () => null });
  const red = rep.find((r) => r.item === 'Red Short Shirt');
  assert.equal(red.dfColour, '#832c10');
  assert.equal(red.mwColour, '#8c2814');
});

// ═══ MW-D38: the item icons are the Morrowind ground meshes ═════════
test('MW-D38: the weapon\u2019s material is READ - a daedric sword is not the type\u2019s first record', async () => {
  const { fpWeaponKey } = await import('../src/combat/fpArm.js');
  // the field no item ever carried is gone; itemInfo's materialName is the door
  const iron = { group: 'Weapons', templateIndex: 115, material: 0 };
  const daedric = { group: 'Weapons', templateIndex: 115, material: 9 };
  assert.notEqual(fpWeaponKey(iron, false), fpWeaponKey(daedric, false), 'two materials of one type must be two keys');
  assert.match(fpWeaponKey(daedric, false), /:Daedric:/);
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(arm, /pickWeaponRecord\(allWeapons, mwType, weapon \? materialName\(weapon\) : null\)/,
    'the hand\u2019s weapon is not resolved by its material');
  const code = arm.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(!/weapon\.materialName|item\.materialName/.test(code), 'the phantom field is still read somewhere');
});

test('MW-D38: iconFrame fits every corner of the bounds under a three-quarter ortho', async () => {
  const { iconFrame } = await import('../src/combat/fpArm.js');
  const b = { minX: -1, minY: -0.1, minZ: -0.3, maxX: 1, maxY: 0.1, maxZ: 0.3 };   // a sword lying flat
  const f = iconFrame(b);
  assert.ok(f.view && f.proj && f.eye, 'a frame has a view, a projection and an eye');
  // every corner projects inside the clip box
  const { multiply, transformPoint } = await import('../src/world/mat4.js');
  const pv = multiply(f.proj, f.view);
  for (const x of [b.minX, b.maxX]) for (const y of [b.minY, b.maxY]) for (const z of [b.minZ, b.maxZ]) {
    const p = transformPoint(pv, x, y, z);
    assert.ok(Math.abs(p[0]) <= 1 && Math.abs(p[1]) <= 1, `corner ${x},${y},${z} projects outside the icon (${p[0].toFixed(2)}, ${p[1].toFixed(2)})`);
  }
  // and not wastefully small: the longest extent nearly fills one axis
  let maxAbs = 0;
  for (const x of [b.minX, b.maxX]) for (const y of [b.minY, b.maxY]) for (const z of [b.minZ, b.maxZ]) {
    const p = transformPoint(pv, x, y, z);
    maxAbs = Math.max(maxAbs, Math.abs(p[0]), Math.abs(p[1]));
  }
  assert.ok(maxAbs > 0.8, `the icon leaves too much air (${maxAbs.toFixed(2)})`);
  // the eye looks from above and in front: positive y and z components.
  assert.ok(f.eye[1] > 0 && f.eye[2] > 0);
});

test('MW-D38: itemIcon is null without a build; the pack takes the model icon first and the classic second', () => {
  const arm = createFpArm();
  assert.equal(arm.itemIcon({ group: 'Weapons', templateIndex: 115, material: 0 }), null);
  const pack = readFileSync('src/ui/enhancedInventory.js', 'utf8');
  assert.match(pack, /const src = modelIconUrl\(line\.item, 96\)\n    \|\| \(line\.image/, 'the tile does not try the model icon first');
  assert.match(pack, /const big = modelIconUrl\(line\.item, 192\)\n    \|\| \(line\.image/, 'the detail does not try the model icon first');
  assert.match(pack, /item,   \/\/ MW-D38/, 'the line no longer carries its item');
  const classic = readFileSync('src/ui/nativeInventory.js', 'utf8');
  assert.ok(!/itemIcon|modelIconUrl/.test(classic), 'the classic inventory must not know the model icons exist');
  const src = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(src, /const catalog = \{ archives, parts, armors, clothes, weapons: allWeapons, gen \};/, 'the build keeps no catalog for the icons');
  assert.match(src, /finally \{ releaseGpu\(mesh\); \}/, 'the icon mesh must leave the GPU');
});

// ═══ AUDIT 34: PX22 and the item-sprite integration ═════════════════
test('AUDIT 34 F1/F2: garment colour is lazy and shared; the weapon note reads the weapon chain', async () => {
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  // F1: no pre-pass over every CLOT record; one door for the build and the icon
  assert.ok(!/clothingColourSampler/.test(arm), 'the eager sampler is back');
  assert.match(arm, /const colourOf = \(c\) => clothingColourOf\(c, parts, archives, gen\);/, 'the build does not measure lazily');
  assert.match(arm, /const colourOf = \(c\) => clothingColourOf\(c, cat\.parts, cat\.archives, cat\.gen\);/, 'the icon measures through a different door than the build');
  assert.equal((arm.match(/function clothingColourOf\(/g) || []).length, 1);
  // F2: an elven weapon resolved to silver is 'resolved', not a fallback
  const { mwItemReport } = await import('../src/formats/mwItemMap.js');
  const { pickWeaponRecord: pick } = await import('../src/formats/mwFirstPerson.js');
  const W = (id, type) => ({ id, model: `${id}.nif`, name: '', type, enchanted: false });
  const rep = mwItemReport([], { weapons: [W('silver_dagger', 0), W('iron_dagger', 0)], clothes: [], pickWeapon: pick });
  const elven = rep.find((r) => r.item === 'Elven Dagger');
  assert.deepEqual(elven.found, ['silver_dagger']);
  assert.equal(elven.note, 'resolved', 'elven-on-silver must read as resolved (the armor table said steel)');
  const orcish = rep.find((r) => r.item === 'Orcish Dagger');
  assert.match(orcish.note, /no glass\/ebony of this type/, 'a real fallback names the chain it walked');
});

// ═══ PX23: the UI read-back is lit by a studio, not by the world ═════
test('PX23: studioLight puts the key light at the eye and nothing from the world in the frame', async () => {
  const { studioLight, STUDIO_AMBIENT, STUDIO_KEY } = await import('../src/render/renderer.js');
  const { lookAt } = await import('../src/world/mat4.js');
  // a camera on +Z looking at the origin: the light must point toward +Z
  const st = studioLight(lookAt([0, 0, 4], [0, 0, 0], [0, 1, 0]));
  assert.ok(st.lightDir[2] > 0.99, `the key light is not at the eye (${[...st.lightDir]})`);
  // a camera on -X: the light points toward -X
  assert.ok(studioLight(lookAt([-4, 0, 0], [0, 0, 0], [0, 1, 0])).lightDir[0] < -0.99);
  assert.deepEqual([...st.ambient].map((v) => Math.round(v * 100) / 100), [STUDIO_AMBIENT, STUDIO_AMBIENT, STUDIO_AMBIENT]);
  assert.equal(st.sunScale, STUDIO_KEY);
  assert.equal(st.pointLights.length, 0, 'a dungeon torch must not light the panel');
  assert.deepEqual([...st.indirect], [0, 0, 0, 0]);
  // brighter than the world's own defaults, and not blown out
  assert.ok(STUDIO_AMBIENT > 0.45 && STUDIO_AMBIENT + STUDIO_KEY <= 1.4);
  // borrowed and RETURNED: the read-back restores the frame's light state
  const src = readFileSync('src/render/renderer.js', 'utf8');
  const body = src.slice(src.indexOf('renderCharacterSpriteImage('), src.indexOf('renderCharacterSpriteImage(') + 2200);
  assert.match(body, /const st = studioLight\(view\);/);
  assert.match(body, /finally \{\n      if \(saved\) \{\n        this\._lightDir = saved\.lightDir;/, 'the frame light must be returned in a finally');
});
