import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { extractTracks, sampleTrack } from '../src/formats/mwAnim.js';
import { accumRootRef } from '../src/formats/mwSkin.js';
import { assembleFirstPersonArm, poseAssembly } from '../src/formats/mwFirstPerson.js';
import {
  packFpArm, armFraming, armModelPoint, fpSkeletonPath, buildFpArm, createFpArm,
  ARM_FORWARD, ARM_DROP, ARM_TARGET_SPAN, FP_CLIP_PATH,
} from '../src/combat/fpArm.js';

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
  const packed = packFpArm(arm.pieces);
  // drawCharacter issues drawArrays, not drawElements (renderer.js), so
  // the stream is NON-INDEXED: three vertices per triangle, 9 floats each.
  assert.equal(packed.length, tris * 3 * 9);
  for (let i = 0; i < packed.length; i += 9) {
    const n = Math.hypot(packed[i + 6], packed[i + 7], packed[i + 8]);
    assert.ok(Math.abs(n - 1) < 1e-3, 'every face normal is unit length');
  }
  // The buffer is REUSED when it already fits - the frame path must not
  // allocate a megabyte per frame.
  const again = packFpArm(arm.pieces, packed);
  assert.equal(again, packed, 'a correctly-sized buffer is written in place, not replaced');
});

test('MW-D8 rule 13: a mirrored piece has its face normals negated, or it lights inside-out', async () => {
  const arm = await fixtureArm();
  const L = arm.pieces.find((p) => p.bone === 'left upper arm');
  const R = arm.pieces.find((p) => p.bone === 'right upper arm');
  assert.equal(L.mirrored, true);
  assert.equal(R.mirrored, false);
  // `+ 0` normalises IEEE negative zero, which deepEqual treats as
  // distinct from zero and which a rounded normal component hits often.
  const n0 = (piece) => [...packFpArm([piece]).slice(6, 9)].map((x) => Math.round(x) + 0);
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

test('MW-D8: the port mapper is solved ONCE, from the clip union, and says it is a port decision', async () => {
  const arm = await fixtureArm();
  const wide = armFraming({ minX: -3, maxX: 3, minY: 0, maxY: 0, minZ: 0, maxZ: 1 });
  assert.ok(Math.abs(wide.scale * 6 - ARM_TARGET_SPAN) < 1e-6,
    'the scale maps the LONGEST axis onto the target span');
  assert.deepEqual(wide.centre, [0, 0, 0.5], 'and the centre is the bounds centre, not the authoring origin');
  assert.equal(armFraming(null), null, 'no bounds, no framing - rather than a default that looks right');

  // THE PIN THE PIXELS CANNOT CARRY. A mapper recomputed per frame from
  // the live bounds renormalises the picture every time the arm moves and
  // cancels out exactly the motion it exists to show. The probe cannot
  // separate that from a correct player (measured: the mutant survives
  // every pixel layer), so the law is pinned on the SOURCE instead.
  const src = rd('src/combat/fpArm.js');
  const draw = src.slice(src.indexOf('    draw(canvas)'), src.indexOf('    status()'));
  assert.ok(draw.includes('built.framing'), 'the draw reads the framing solved at build');
  assert.ok(!/\barm\.bounds\b|\bbuilt\.arm\.bounds\b/.test(draw),
    'and never the live per-frame bounds');
});

test('MW-D8: the placement rotates the centre offset, or the arm swings as you turn', () => {
  const framing = { scale: 0.1, span: 7, centre: [0, 0, 2] };
  const eye = [0, 1.6, 0];
  // At every heading the arm must sit the SAME distance and direction
  // from the eye, in the eye's own frame. The model matrix spins the mesh
  // about its origin, so the centre offset has to be rotated before it is
  // backed out - measured live: without it the arm drew 60 texels facing
  // one way and 20 facing another with the pose held still.
  const rel = (yaw) => {
    const p = armModelPoint(framing, eye, yaw);
    const c = Math.cos(-yaw); const s = Math.sin(-yaw);
    const dx = p[0] - eye[0]; const dz = p[2] - eye[2];
    // rotate the offset back into the eye's frame
    return [c * dx + s * dz, p[1] - eye[1], -s * dx + c * dz].map((v) => +v.toFixed(6) + 0);
  };
  const at0 = rel(0);
  for (const yaw of [Math.PI / 2, Math.PI, -Math.PI / 2, 1.234]) {
    assert.deepEqual(rel(yaw), at0, `the arm sits identically relative to the eye at yaw ${yaw}`);
  }
  // and it is IN FRONT of and BELOW the eye, which is the other half of
  // the same lesson: the voxel viewmodel pushes its rig BACKWARD because
  // it is a whole body hiding its own head, and this assembly is arms
  // only, so the same push puts every triangle behind the lens.
  assert.ok(ARM_FORWARD > 0, 'forward, not back');
  assert.ok(ARM_DROP < 0, 'and below the view axis');
  assert.ok(at0[2] > 0, 'so the arm centre lands in front of the eye');
  assert.ok(at0[1] < 0, 'and under it');
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
  assert.match(src, /const active = \(\) => !!\(built && built\.ok && mesh && renderer && camera && state\);/,
    'built, built.ok, mesh, renderer, camera AND state - all five');
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
