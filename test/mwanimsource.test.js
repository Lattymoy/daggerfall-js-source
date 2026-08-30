import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { correctActorModelPath } from '../src/formats/mwTexture.js';
import {
  FP_BASE_MODEL, animSourceName, fpAnimSources, pickAnimSource, anySourceHasGroup,
} from '../src/formats/mwFirstPerson.js';
import { resetClip } from '../src/formats/mwAnim.js';
import { buildFpArm, createFpArm, fpSkeletonPath, UPPER_BODY } from '../src/combat/fpArm.js';
import { poseAssembly, armPieceRows } from '../src/formats/mwFirstPerson.js';
import { sampleTrack } from '../src/formats/mwAnim.js';

// MW-D14: RULE 18 AND THE SOURCE LIST, which is not one file.
//
// The port loaded exactly one .kf and used the settings' skeleton name
// verbatim. Both are right FOR A MALE and wrong for everyone else, which
// is the shape of every defect in this arc: correct on the case the
// author tested, silently wrong on the rest of the data.

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));

test('MW-D14 rule 18: the x-form is used ONLY when its .kf exists', () => {
  //   insert 'x' before the FILENAME, swap .nif for .kf, and use the
  //   x-form only if that KF exists - otherwise keep the original.
  const has = (set) => (p) => set.has(p);
  const female = 'meshes/base_anim_female.1st.nif';

  assert.equal(correctActorModelPath(female, has(new Set(['meshes/xbase_anim_female.1st.kf']))),
    'meshes/xbase_anim_female.1st.nif', 'promoted when the kf is there');
  assert.equal(correctActorModelPath(female, has(new Set())), female,
    'and NOT promoted when it is not - the original stands');
  // The probe is the .KF, never the .nif: an archive carrying only the
  // x-form MESH must not promote.
  assert.equal(correctActorModelPath(female, has(new Set(['meshes/xbase_anim_female.1st.nif']))), female);

  // THE MALE CASE, which is why a port tested on one character sees
  // nothing wrong: the settings entry is ALREADY x-form, so the insert
  // yields "xx" and nothing can exist under that name.
  assert.equal(correctActorModelPath('meshes/xbase_anim.1st.nif',
    has(new Set(['meshes/xxbase_anim.1st.kf']))), 'meshes/xxbase_anim.1st.nif',
  'the rule has no special case for it - it just never fires on real data');
  assert.equal(correctActorModelPath('meshes/xbase_anim.1st.nif', has(new Set())),
    'meshes/xbase_anim.1st.nif');

  // The 'x' goes before the FILENAME, not the path.
  assert.equal(correctActorModelPath('a/b/c.nif', has(new Set(['a/b/xc.kf']))), 'a/b/xc.nif');
  assert.equal(correctActorModelPath('c.nif', has(new Set(['xc.kf']))), 'xc.nif');
  // A non-.nif extension is probed AS ITSELF - the swap is conditional.
  assert.equal(correctActorModelPath('a/b/c.dat', has(new Set(['a/b/xc.dat']))), 'a/b/xc.dat');
  assert.equal(correctActorModelPath('a/b/c.dat', has(new Set(['a/b/xc.kf']))), 'a/b/c.dat');
});

test('MW-D14: the source list is base FIRST, the actor skeleton SECOND', () => {
  // addAnimSource(base) then, only if different, addAnimSource(default).
  // Push order matters because the search runs in reverse.
  const all = new Set(['meshes/xbase_anim.1st.kf', 'meshes/xbase_anim_female.1st.kf']);
  assert.deepEqual(fpAnimSources('meshes/xbase_anim_female.1st.nif', (p) => all.has(p)),
    ['meshes/xbase_anim.1st.kf', 'meshes/xbase_anim_female.1st.kf']);
  // A male's two names collapse to one source.
  assert.deepEqual(fpAnimSources(FP_BASE_MODEL, (p) => all.has(p)), ['meshes/xbase_anim.1st.kf']);
  // A source the archive lacks is DROPPED, not refused
  // (addSingleAnimSource returns nullptr).
  assert.deepEqual(fpAnimSources('meshes/base_animkna.1st.nif', (p) => all.has(p)),
    ['meshes/xbase_anim.1st.kf']);
  assert.deepEqual(fpAnimSources(FP_BASE_MODEL, () => false), []);
  // The .kf swap is conditional on a .nif extension.
  assert.equal(animSourceName('meshes/Xbase_Anim.1st.NIF'), 'meshes/xbase_anim.1st.kf');
  assert.equal(animSourceName('meshes/thing.kf'), 'meshes/thing.kf');
  // Anything that is not .nif is left ALONE - the swap does not simply
  // replace whatever extension is there.
  assert.equal(animSourceName('meshes/thing.dat'), 'meshes/thing.dat');
  assert.equal(animSourceName('meshes/noext'), 'meshes/noext');
});

test('MW-D14: the search is REVERSE, and a failed reset passes the source over', () => {
  const sources = [
    { name: 'base', groupSet: new Set(['idle', 'weapononehand']), keys: [
      { time: 0, text: 'idle: start' }, { time: 1, text: 'idle: stop' },
      { time: 2, text: 'weapononehand: start' }, { time: 3, text: 'weapononehand: stop' },
    ] },
    { name: 'own', groupSet: new Set(['idle', 'halfgroup']), keys: [
      { time: 10, text: 'idle: start' }, { time: 11, text: 'idle: stop' },
      { time: 12, text: 'halfgroup: start' },
    ] },
  ];
  // Both name "idle"; the LAST-INSERTED wins.
  assert.equal(pickAnimSource(sources, 'idle', resetClip).source.name, 'own');
  assert.equal(pickAnimSource(sources, 'idle', resetClip).state.startTime, 10);
  // Only the base names this one, so the search falls through to it.
  assert.equal(pickAnimSource(sources, 'weapononehand', resetClip).source.name, 'base');
  // "halfgroup" has a start key and no stop key. The whole of reset()
  // must succeed, so this source is passed OVER rather than refused -
  // and with no other source naming it, the answer is null.
  assert.equal(pickAnimSource(sources, 'halfgroup', resetClip), null);
  assert.equal(pickAnimSource(sources, 'nothing', resetClip), null);
  assert.equal(pickAnimSource([], 'idle', resetClip), null);
  // hasAnimation is ANY source, which is a different question.
  assert.equal(anySourceHasGroup(sources, 'halfgroup'), true);
  assert.equal(anySourceHasGroup(sources, 'weapononehand'), true);
  assert.equal(anySourceHasGroup(sources, 'nothing'), false);
});

// --- the whole thing, through a real build ---------------------------------

/** A female actor whose archive carries the x-form female .kf, so rule
 *  18 promotes and there really are two sources. armfpidle.kf and
 *  armfpweapon.kf name DIFFERENT groups, so which source won is
 *  observable rather than merely asserted. */
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

function femaleDeps({ withFemaleKf = true, swapSources = false, weapon = false } = {}) {
  const files = new Map([
    ['meshes/base_anim_female.1st.nif', f('armfp.nif')],
    ['meshes/xbase_anim_female.1st.nif', f('armfp.nif')],
    ['meshes/xbase_anim.1st.kf', f(swapSources ? 'armidle.kf' : 'armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/blade.nif', f('weapon.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  // armidle.kf, not armfpidle.kf, and the choice is the pin: against
  // armfp's skeleton its tracks include "bip01", so this source's ACCUM
  // ROOT (rule 56) is a different bone from the base source's. Tracks
  // and accum root both differ, which is what makes "posed from the
  // winning source" a measurable claim instead of a stated one.
  if (withFemaleKf) files.set('meshes/xbase_anim_female.1st.kf', f(swapSources ? 'armfpweapon.kf' : 'armidle.kf'));
  const weap = wpdtRec('iron longsword', 'w/blade.nif', 1);
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => (weapon ? ['armfp.esm', 'weap.esm'] : ['armfp.esm']),
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
  };
}

test('MW-D14: a female actor gets TWO sources and the later one wins her idle', async () => {
  const res = await buildFpArm({ race: 'fprace', female: true, deps: femaleDeps() });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  assert.equal(res.settingsSkeleton, 'meshes/base_anim_female.1st.nif', 'rule 6 names this');
  assert.equal(res.skeletonPath, 'meshes/xbase_anim_female.1st.nif', 'and rule 18 promotes it');
  assert.deepEqual(res.sourcePaths,
    ['meshes/xbase_anim.1st.kf', 'meshes/xbase_anim_female.1st.kf']);

  // armfpweapon.kf carries the weapon groups; armfpidle.kf does not.
  // Both carry "idle", so the reverse search must take the female file
  // for the idle and fall through to the base for the weapon.
  assert.ok(res.groups.includes('weapononehand'), 'hasAnimation sees BOTH sources');
  // "soundgen" is armfpidle.kf's alone - a group the base file has no
  // key of, so its presence is proof the second source was read at all.
  assert.ok(res.groups.includes('soundgen'), 'including the female file\'s own groups');
  assert.equal(res.sources.length, 2);
  const idle = pickAnimSource(res.sources, 'idle', resetClip, { loopFallback: true });
  assert.equal(idle.source.name, 'meshes/xbase_anim_female.1st.kf');
  // The weapon group has no bare start/stop - its windows are named
  // sections - so the ask carries the section, which is also how the arm
  // asks for it.
  const swing = pickAnimSource(res.sources, 'weapononehand', resetClip,
    { start: 'equip start', stop: 'equip stop' });
  assert.equal(swing.source.name, 'meshes/xbase_anim.1st.kf');
});

test('MW-D14: with no female .kf there is ONE source and the name is not promoted', async () => {
  const res = await buildFpArm({ race: 'fprace', female: true, deps: femaleDeps({ withFemaleKf: false }) });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  assert.equal(res.skeletonPath, 'meshes/base_anim_female.1st.nif', 'the original stands');
  assert.deepEqual(res.sourcePaths, ['meshes/xbase_anim.1st.kf']);
  assert.equal(res.sources.length, 1);
  assert.ok(!res.groups.includes('soundgen'), 'and the female file\'s groups are simply not there');
});

test('MW-D14: the arm poses from the source that WON, not from the first one', async () => {
  const arm = createFpArm();
  arm.attach({
    gl: null,
    createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: () => 1,
  }, () => ({ pitch: 0 }));
  const res = await arm.build({ race: 'fprace', female: true, deps: femaleDeps() });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  arm.update(0.05);
  const st = arm.status();
  assert.equal(st.idleSource, 'meshes/xbase_anim_female.1st.kf',
    'the idle came from the female file');
  // A clip and the tracks that pose it must come from the SAME file:
  // posing one source's clip with another's tracks is a bind pose with
  // no error anywhere.
  assert.deepEqual(st.sources, ['meshes/xbase_anim.1st.kf', 'meshes/xbase_anim_female.1st.kf']);
  const posed = arm.rows().map((r) => r.bounds.minY);
  assert.ok(posed.length, 'and the arm really is posed');

  // THE PIN THE FIELD ALONE CANNOT MAKE. Re-pose the SAME assembly at the
  // SAME time with the base source's tracks and accum root, and the arm
  // must land somewhere else - otherwise "it used the right source" is a
  // claim about a variable, not about the picture.
  const built = arm.built();
  const base = built.sources[0];
  const own = built.sources[1];
  // RULE 56's STICKINESS, which is the opposite of what a per-source
  // field would do: `if (!mAccumRoot)` means the FIRST source to resolve
  // one wins for the life of the rig. Here the base .kf keys nothing on
  // bip01 and the female one does, so the female source supplies it -
  // and BOTH sources then use it.
  assert.equal(base.wouldAccumRoot, null, 'the base file would choose nothing');
  assert.ok(own.wouldAccumRoot !== null, 'the female file drives bip01');
  assert.equal(built.accumRoot, own.wouldAccumRoot);
  assert.equal(base.accumRoot, built.accumRoot, 'and it is ONE value for the whole rig');
  assert.equal(own.accumRoot, built.accumRoot);
  const repose = (tracks, accumRoot, time) => {
    poseAssembly(built.arm, { tracks, sampleTrack, time, accumRoot });
    return armPieceRows(built.arm.pieces).map((r) => r.bounds.minY);
  };
  const now = arm.status().time;
  assert.deepEqual(posed.map((v) => +v.toFixed(5)),
    repose(own.trackMap, own.accumRoot, now).map((v) => +v.toFixed(5)),
    'the live arm matches the source it said it used');

  // THE TRACKS MATTER. At a time both files key, the two sources put the
  // arm in different places - so "which source won" is a claim about the
  // picture, not about a variable.
  const T = 2.0;
  const withOwn = repose(own.trackMap, own.accumRoot, T);
  const withBase = repose(base.trackMap, base.accumRoot, T);
  assert.ok(withOwn.some((v, i) => Math.abs(v - withBase[i]) > 1e-4),
    'the two sources pose the arm differently at the same time');

});

test('MW-D14 rule 6: the settings names are unchanged - rule 18 is applied ON TOP', () => {
  // fpSkeletonPath is still the table rule 6 states, and the promotion
  // happens at build time against the player's archive. Folding the two
  // together would make rule 6 untestable without an archive.
  assert.equal(fpSkeletonPath({}), 'meshes/xbase_anim.1st.nif');
  assert.equal(fpSkeletonPath({ female: true }), 'meshes/base_anim_female.1st.nif');
  assert.equal(fpSkeletonPath({ beast: true }), 'meshes/base_animkna.1st.nif');
  assert.equal(FP_BASE_MODEL, 'meshes/xbase_anim.1st.nif',
    'and the BASE source is the male first-person model, for every actor');
});

test('MW-D14 rule 56: the FIRST source to resolve an accum root wins, not the last', () => {
  // The stickiness has to be measured in the direction that can fail.
  // With the files swapped the BASE drives bip01 and the female one does
  // not, so "first non-null" and "last source" give different answers -
  // and the arrangement above cannot tell them apart, because there the
  // only source with an accum root is already the last.
  return buildFpArm({ race: 'fprace', female: true, deps: femaleDeps({ swapSources: true }) })
    .then((res) => {
      assert.ok(res.ok, `${res.stage}: ${res.error}`);
      const [base, own] = res.sources;
      assert.ok(base.wouldAccumRoot !== null, 'the base file drives bip01 now');
      assert.equal(own.wouldAccumRoot, null, 'and the female one drives nothing');
      assert.equal(res.accumRoot, base.wouldAccumRoot,
        'so the accum root is the BASE\'s - the later source does not re-pick it, and does not clear it');
    });
});

test('MW-D14: an ATTACK poses from ITS source, which is not the idle\'s', async () => {
  // The idle and the swing can be won by DIFFERENT files, and the tracks
  // must follow each clip separately. While idling this is invisible -
  // the idle's source is also the build's default - so the pin has to
  // swing.
  const arm = createFpArm();
  arm.attach({
    gl: null,
    createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: () => 1,
  }, () => ({ pitch: 0 }));
  const res = await arm.build({
    race: 'fprace', female: true, weapon: { templateIndex: 120 },
    deps: femaleDeps({ weapon: true }),
  });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  arm.setSheathed(false);
  arm.update(0.05);
  assert.equal(arm.status().idleSource, 'meshes/xbase_anim_female.1st.kf');
  assert.equal(arm.status().actionSource, 'meshes/xbase_anim.1st.kf',
    'the equip section came from the OTHER file');
  for (let i = 0; i < 60 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.WeaponEquipped);
  // The slot is empty between sections, which is why the source is read
  // while something is playing and not after.
  assert.equal(arm.status().actionSource, null);

  assert.equal(arm.attack('StrikeDown'), 'chop');
  arm.update(0.05);
  assert.equal(arm.status().actionSource, 'meshes/xbase_anim.1st.kf');
  const built = arm.built();
  const [base, own] = built.sources;
  const posed = arm.rows().map((r) => +r.bounds.minY.toFixed(5));
  const repose = (source) => {
    poseAssembly(built.arm, {
      tracks: source.trackMap, sampleTrack, time: arm.status().time, accumRoot: built.accumRoot,
    });
    return armPieceRows(built.arm.pieces).map((r) => +r.bounds.minY.toFixed(5));
  };
  const withBase = repose(base);
  const withOwn = repose(own);
  assert.notDeepEqual(withBase, withOwn, 'the two files really do pose it differently here');
  assert.deepEqual(posed, withBase, 'and the swing is posed by the file the swing came from');
});

// --- rule 32(a): the sneak sink -------------------------------------------

test('MW-D15 rule 32(a): the GMST is READ, and a missing one is null not zero', async () => {
  const { gmstValue, GMST_SNEAK_DELTA, sneakOffset } = await import('../src/formats/mwFirstPerson.js');
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const rec = (subs) => [...A('GMST'), ...U(subs.length), ...U(0), ...U(0), ...subs];
  const gmst = (id, intv) => rec([...sub('NAME', Z(id)), ...sub('INTV', U(intv))]);
  const esm = Uint8Array.from([
    ...gmst('iOther', 3),
    ...gmst('i1stPersonSneakDelta', 10),
  ]);
  assert.equal(gmstValue(esm, GMST_SNEAK_DELTA), 10, 'and the lookup is case-insensitive');
  assert.equal(gmstValue(esm, 'iother'), 3);
  // A GMST the file does not carry is NULL, not 0: zero is a legal sneak
  // delta and "absent" has to be distinguishable from "flat".
  assert.equal(gmstValue(esm, 'inosuchthing'), null);
  assert.equal(GMST_SNEAK_DELTA, 'i1stpersonsneakdelta');

  // Vec3f(0, 0, -offset) while sneaking, the zero vector otherwise.
  assert.deepEqual(sneakOffset(true, 10), [0, 0, -10]);
  assert.deepEqual(sneakOffset(false, 10), [0, 0, 0]);
  assert.deepEqual(sneakOffset(true, null), [0, 0, 0], 'no GMST, no sink');
  assert.deepEqual(sneakOffset(true, 0), [0, 0, 0]);
});

test('MW-D15 rule 32(a): the sink moves the arm, through the NECK', async () => {
  const { assembleFirstPersonArm, applyFirstPersonNeck } = await import('../src/formats/mwFirstPerson.js');
  const { parseNif } = await import('../src/formats/mwNifFile.js');
  const { poseSkeleton, skeletonSpaceMatrices } = await import('../src/formats/mwSkin.js');
  const arm = await assembleFirstPersonArm({
    skeletonBytes: f('armfp.nif'),
    parts: [{ slot: 'hand', bytes: f('armfphand.nif') }],
  });
  assert.ok(arm.ok, arm.error);
  const skelMats = (sk, pose, root) => skeletonSpaceMatrices(sk, pose, root);
  const neckAt = (offset, pitch) => {
    const pose = poseSkeleton(arm.skeleton, null, null, 0, {});
    applyFirstPersonNeck(arm.skeleton, pose, arm.rootRef, skelMats, pitch, 0, offset);
    return pose.get(arm.skeleton.byName.get('bip01 neck')).translation;
  };
  const rest = neckAt(null, 0);
  const sunk = neckAt([0, 0, -10], 0);
  assert.notDeepEqual([...sunk], [...rest], 'the sink moves the neck with NO pitch at all');
  // Vec3f(0,0,-10) in the object root's space, and this rig's neck is
  // axis-aligned to it, so the whole of it lands on z.
  assert.ok(Math.abs((sunk[2] - rest[2]) + 10) < 1e-4, `moved ${sunk[2] - rest[2]} in z`);
  assert.ok(Math.abs(sunk[0] - rest[0]) < 1e-4, 'and nothing in x');

  // The two channels are independent: a pitch with no offset still only
  // rotates, and an offset with a pitch does both.
  assert.deepEqual([...neckAt(null, 0.4)], [...rest], 'pitch alone leaves the translation alone');
  const both = neckAt([0, 0, -10], 0.4);
  assert.ok(Math.abs((both[2] - rest[2]) + 10) < 1e-4);
});

test('MW-D15 rule 32(a): the arm reads the stance off the camera dep, in all four hosts', () => {
  const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  // THE FOUR HOSTS RULE, again. The pitch proved the camera dep is the
  // seam every host has; the stance is the same question about the same
  // body and rides the same dep rather than a fifth channel.
  // MW-D26 widened the dep with the movement report; the stance still
  // rides it, so the regex asks for the field, not the closing brace.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    assert.match(rd(host), /camera: \(\) => \(\{[^)]*sneaking: !!player\.isSneaking,/,
      `${host} passes the live sneak stance`);
  }
  // The dungeon context latches it with the eye and the pitch, one frame
  // at a time, for the reason the pitch is latched there.
  assert.match(rd('src/scenes/dungeonContext.js'), /_fpSneaking = !!playerSneaking;/);
  assert.match(rd('src/scenes/dungeonContext.js'), /sneaking: _fpSneaking, move: _fpMove \}/);
  for (const host of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    assert.match(rd(host), /drawFoes\([^;]*!!player\.isSneaking,/, `${host} hands it to the context`);
  }
  // And the arm takes it from there and nowhere else - no second source
  // of truth for a stance.
  const src = rd('src/combat/fpArm.js');
  assert.match(src, /sneaking = !!\(cam && cam\.sneaking\);/);
  assert.ok(!/entity\.sneaking/.test(rd('src/combat/weaponRig.js')));
});

test('MW-D15 rule 32(a): the LIVE arm sinks when the camera dep says sneak', async () => {
  // The field alone is not the pin: a sneakDelta read from the .esm and
  // never applied draws exactly what MW-D14 drew.
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const body = [...sub('NAME', Z('i1stPersonSneakDelta')), ...sub('INTV', U(10))];
  const gmstEsm = Uint8Array.from([...A('GMST'), ...U(body.length), ...U(0), ...U(0), ...body]);

  const files = new Map([
    ['meshes/xbase_anim.1st.nif', f('armfp.nif')],
    ['meshes/xbase_anim.1st.kf', f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  let sneaking = false;
  const arm = createFpArm();
  arm.attach({
    gl: null,
    createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: () => 1,
  }, () => ({ pitch: 0, sneaking }));
  const res = await arm.build({
    race: 'fprace',
    deps: {
      loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
      storedMorrowindNames: async () => ['armfp.esm', 'gmst.esm'],
      loadMorrowindFile: async (n) => (n === 'gmst.esm' ? gmstEsm : f('armfp.esm')),
    },
  });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  assert.equal(res.sneakDelta, 10, 'the GMST reached the build');

  arm.update(0.05);
  const standing = arm.rows().map((r) => +r.bounds.minZ.toFixed(4));
  assert.equal(arm.status().sneaking, false);
  sneaking = true;
  arm.update(0.05);
  assert.equal(arm.status().sneaking, true);
  const sunk = arm.rows().map((r) => +r.bounds.minZ.toFixed(4));
  assert.ok(standing.some((v, i) => Math.abs(v - sunk[i]) > 1) , 'the whole body moved');
  // It is a SINK, and by the GMST's own amount - a step change with no
  // smoothing, so one frame is the whole of it.
  for (let i = 0; i < standing.length; i++) {
    // 1e-2, because the whole chain is float32 through a pyffi-authored
    // rest pose: the residue is the fixture's, not the arithmetic's.
    assert.ok(Math.abs((sunk[i] - standing[i]) + 10) < 1e-2,
      `piece ${i} moved ${sunk[i] - standing[i]}, not -10`);
  }
  // And it comes straight back - measured as the sink UNDONE rather than
  // as a return to the first reading, because the idle clock has moved
  // on between the two and the arm is not meant to be frozen.
  sneaking = false;
  arm.update(0.05);
  const back = arm.rows().map((r) => +r.bounds.minZ.toFixed(4));
  for (let i = 0; i < back.length; i++) {
    assert.ok(Math.abs((back[i] - sunk[i]) - 10) < 1e-2,
      `piece ${i} rose ${back[i] - sunk[i]}, not 10`);
  }
});

test('MW-D15: the neck controller uses the ROTATION, with the scale divided out', async () => {
  const { applyFirstPersonNeck, FP_NECK_BONE } = await import('../src/formats/mwFirstPerson.js');
  // RotateController takes `worldMat.getRotate()`, not the matrix. The
  // skeleton-space 3x3 this module works in is rotation TIMES SCALE
  // (rule 55 folds a NIF's uniform scale in), so conjugating with it
  // gives s^2 * (R rot R^T) and translating with its transpose gives
  // s * offset. Both are silently right at s = 1 - which every fixture
  // is, and which is why this needs a rig built by hand.
  const REF = 1;
  const ident = () => Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const rig = (s) => ({
    skeleton: {
      byName: new Map([[FP_NECK_BONE, REF]]),
      nodes: new Map([[REF, { rest: { rotation: ident(), translation: [0, 0, 0], scale: 1 } }]]),
    },
    // The neck's world 3x3, scaled - what skeletonSpaceMatrices really
    // hands back for a rig with a scaled chain.
    mats: new Map([[REF, { a: Float32Array.from(ident()).map((v) => v * s), t: [0, 0, 0] }]]),
  });
  const run = (s, pitch, offset) => {
    const { skeleton, mats } = rig(s);
    const pose = new Map();
    applyFirstPersonNeck(skeleton, pose, 0, () => mats, pitch, 0, offset);
    return pose.get(REF);
  };
  const one = run(1, 0.5, [0, 0, -10]);
  const four = run(4, 0.5, [0, 0, -10]);
  // The offset must land the same however the chain is scaled: it is a
  // vector in the OBJECT ROOT's space either way.
  assert.ok(Math.abs(four.translation[2] - one.translation[2]) < 1e-5,
    `scaled rig translated ${four.translation[2]}, unscaled ${one.translation[2]}`);
  // And so must the rotation - s^2 would put 16x the pitch on it.
  for (let i = 0; i < 9; i++) {
    assert.ok(Math.abs(four.rotation[i] - one.rotation[i]) < 1e-5,
      `rotation element ${i}: ${four.rotation[i]} vs ${one.rotation[i]}`);
  }
});
