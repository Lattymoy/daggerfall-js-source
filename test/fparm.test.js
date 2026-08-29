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

// --- MW-D9: THE WEAPON ------------------------------------------------------

const wpdtRec = (id, model, type, name = 'W', { short = false, enchanted = false } = {}) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(short ? 16 : 32);
  new DataView(w.buffer).setInt16(10, type, true);
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
  assert.match(src, /const proj = mirrorProjectionX\(perspective\(Math\.PI \/ 3, pw \/ ph, 0\.05, 12\)\);/,
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
