import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { extractTracks, sampleTrack } from '../src/formats/mwAnim.js';
import { accumRootRef } from '../src/formats/mwSkin.js';
import { assembleFirstPersonArm, poseAssembly } from '../src/formats/mwFirstPerson.js';
import {
  packFpArm, fpSkeletonPath, buildFpArm, createFpArm,
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
  assert.ok(!/mirrorProjectionX/.test(src), 'and mirrorProjectionX appears nowhere in the arm');
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
  // wraps. The CHEST stays 02 - the fixture lists it first, and
  // first-in-file-order is the recorded law for every slot that is
  // not the face (AUDIT MW-A F2: D27's first cut sorted them all, and
  // this very line asserted the over-reach back at it).
  assert.deepEqual(at(0), { head: 'b_head_01', hair: 'b_hair_01', chest: 'b_chest_02' });
  assert.deepEqual(at(1), { head: 'b_head_02', hair: 'b_hair_02', chest: 'b_chest_02' });
  assert.deepEqual(at(2), { head: 'b_head_03', hair: 'b_hair_01', chest: 'b_chest_02' });
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
  assert.match(arm, /buildTpBody\(\{ race, female, beast, faceIndex,/,
    'buildFpArm no longer hands the face to the body build');
  assert.match(arm, /playerBodyRows\(parts, race, female, \{ beast, faceIndex \}\)/,
    'the body build no longer hands the face to the picker');
  const menu = readFileSync('src/ui/enhancedMenu.js', 'utf8');
  assert.match(menu, /faceIndex: playerEntity\.faceIndex \| 0/,
    'the live player\u2019s classic face no longer reaches the build');
});

// ═══ MW-D28: THE ITEM MAP ═══════════════════════════════════════════
import {
  DF_TO_MW_ARMOR_MATERIAL, DF_ARMOR_ROWS, DECLARED_SPRITE_WEAPONS,
  mwArmorRecords, itemMapCoverage, mwItemReport,
} from '../src/formats/mwItemMap.js';
import { armorRecords, raceBeastFlag, pickWeaponRecord } from '../src/formats/mwFirstPerson.js';
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
  // x 13 materials, so removing an enum entry cannot shrink the claim.
  assert.equal(cover.length, 19 * 10 + 11 * 13);
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
  assert.match(arm, /raceBeastFlag\(e\.bytes, race\)/, 'the RACE records are not consulted');
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
