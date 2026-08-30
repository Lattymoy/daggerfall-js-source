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
  assert.match(src, /const active = \(\) => !!\(built && built\.ok && mesh && renderer && camera && \(actionState \|\| idleState\)\);/,
    'built, built.ok, mesh, renderer, camera AND a clip - all six');
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

test('MW-D9: the arm rides the SAME handedness mirror as the world it is composited over', async () => {
  const { perspective, lookAt, mirrorProjectionX, multiply } = await import('../src/world/mat4.js');
  const src = readFileSync(new URL('../src/combat/fpArm.js', import.meta.url), 'utf8');

  // THE DEFECT THIS PINS, found by rendering the arm and looking at it.
  // mat4's law: a right-handed lookAt puts world +x on screen-LEFT, and
  // the port shipped that mirror image until M1 - towns flipped
  // east-west, signs backwards. The fix is ONE mirror at the projection
  // and EVERY world pass rides it. The viewmodel pass this technique was
  // borrowed from does NOT, with the reason recorded as "its pass never
  // culls" - which is why it was SAFE to leave, not why it was right.
  //
  // For an arm it is the whole thing: unmirrored, the player's sword
  // hand draws on the wrong side of the screen, against a world drawn
  // the other way round. An arm looks like an arm either way, so no
  // picture and no symmetry score can see it - only this can.
  const eye = [0, 1.6, 0];
  const view = lookAt(eye, [eye[0], eye[1] - 0.2, eye[2] + 1], [0, 1, 0]);
  const ndcX = (proj, p) => {
    const m = multiply(proj, view);
    return (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12])
      / (m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]);
  };
  const P = [1, 1.32, 0.62];                       // one metre to the player's right
  const lens = () => perspective(Math.PI / 3, 4 / 3, 0.05, 12);
  const worldSide = Math.sign(ndcX(mirrorProjectionX(lens()), P));
  const bareSide = Math.sign(ndcX(lens(), P));
  assert.equal(worldSide, 1, 'a world pass puts the player\'s right on SCREEN RIGHT');
  assert.equal(bareSide, -1, 'and an unmirrored lens puts it on screen LEFT - the two disagree');

  // So the arm's own pass must take the mirror, and the source says so.
  assert.match(src, /const proj = mirrorProjectionX\(\s*\n\s*perspective\(FP_FIELD_OF_VIEW, pw \/ ph,/,
    'the arm\'s projection rides mat4\'s one mirror, like every other world pass');
  // and rule 29's 60 degrees survives the mirror, which changes only x.
  assert.ok(Math.abs(mirrorProjectionX(lens())[5] - lens()[5]) < 1e-9,
    'the mirror negates x alone - the field of view is untouched');
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
  assert.match(src, /const ready = \(\) => !!\(built && built\.ok && \(actionState \|\| idleState\) && renderer\);/,
    'ready() is update()\'s own requirements - no mesh term, no camera term');
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
