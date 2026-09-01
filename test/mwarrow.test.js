import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { nodeTransformOf, findNodeByName } from '../src/formats/mwCharacter.js';
import {
  MW_WEAPON_TYPE, WEAPON_AMMO_TYPE, ammoTypeFor, arrowAttachBone, ARROW_FALLBACK_NODE,
  assembleFirstPersonArm,
} from '../src/formats/mwFirstPerson.js';
import { buildFpArm, createFpArm, fpSkeletonPath, FP_CLIP_PATH, UPPER_BODY } from '../src/combat/fpArm.js';

// MW-D16: THE BOW'S ARROW, which the port drew none of.
//
// Rule 24's "shoot attach" / "shoot follow attach" / "shoot release" keys
// attach and loose a held round, and a drawn bow with nothing on the
// string is what MW-D15 shipped. Rule 8's attach-bone table already knew
// where an Arrow and a Bolt go; what was missing was reading the AMMO
// TYPE column, resolving the record, and getArrowBone's second branch.

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));

const wpdt = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);   // MW-D22: mType is at byte 8 (loadweap.hpp) - 10 was the shared guess
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return [...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d];
};

const LONG_BOW = { templateIndex: 130 };
function bowDeps({ skeleton = 'armfp.nif', ammo = true, esm = null, ammoFixture = 'arrow.nif' } = {}) {
  const files = new Map([
    [fpSkeletonPath({}), f(skeleton)],
    [FP_CLIP_PATH, f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/bowmesh.nif', f('bowmesh.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  if (ammo) files.set('meshes/w/arrow.nif', f(ammoFixture));
  const weap = esm || Uint8Array.from([
    ...wpdt('long bow', 'w/bowmesh.nif', MW_WEAPON_TYPE.MarksmanBow),
    ...wpdt('iron arrow', 'w/arrow.nif', MW_WEAPON_TYPE.Arrow),
  ]);
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
  };
}

// --- rule 8's last column --------------------------------------------------

test('MW-D16 rule 8: only the two MARKSMAN types have an ammo type', () => {
  // MarksmanThrown does NOT: a thrown weapon IS its own ammunition,
  // which is why attachArrow's Thrown branch shows the weapon again
  // rather than adding a node.
  assert.equal(ammoTypeFor(MW_WEAPON_TYPE.MarksmanBow), MW_WEAPON_TYPE.Arrow);
  assert.equal(ammoTypeFor(MW_WEAPON_TYPE.MarksmanCrossbow), MW_WEAPON_TYPE.Bolt);
  assert.equal(ammoTypeFor(MW_WEAPON_TYPE.MarksmanThrown), MW_WEAPON_TYPE.None);
  assert.equal(Object.keys(WEAPON_AMMO_TYPE).length, 2, 'and nothing else has one at all');
  for (const t of ['LongBladeOneHand', 'HandToHand', 'None', 'Arrow', 'Bolt', 'Spell']) {
    assert.equal(ammoTypeFor(MW_WEAPON_TYPE[t]), MW_WEAPON_TYPE.None, t);
  }
  // The bone is the AMMO's, not the weapon's - rule 8's table, read one
  // column across.
  assert.equal(arrowAttachBone(MW_WEAPON_TYPE.MarksmanBow), 'Bip01 Arrow');
  assert.equal(arrowAttachBone(MW_WEAPON_TYPE.MarksmanCrossbow), 'ArrowBone');
  assert.equal(arrowAttachBone(MW_WEAPON_TYPE.LongBladeOneHand), null);
  assert.equal(arrowAttachBone(MW_WEAPON_TYPE.MarksmanThrown), null);
});

test('MW-D16: the fallback node transform ACCUMULATES, it is not a leaf\'s own', () => {
  // getArrowBone's second branch instances the arrow UNDER a node inside
  // the weapon's mesh, so the whole chain to that node applies. The
  // fixture nests ArrowBone one level down and rotates it, so a port that
  // reads only the node's own translation gets a different answer.
  const t = nodeTransformOf(parseNif(f('bowmesh.nif')), ARROW_FALLBACK_NODE);
  assert.ok(t);
  assert.deepEqual(t.t.map((v) => +v.toFixed(4)), [1, 6, 0], 'the parent\'s x AND the node\'s y');
  assert.deepEqual([...t.a].map((v) => +v.toFixed(4)), [0, 1, 0, -1, 0, 0, 0, 0, 1],
    'and the node\'s own rotation');
  assert.equal(nodeTransformOf(parseNif(f('weapon.nif')), ARROW_FALLBACK_NODE), null,
    'a weapon with no such node answers null');
  // The lookup is the same visitor rule 14 uses - case-insensitive,
  // pre-order, drawables skipped.
  assert.ok(findNodeByName(parseNif(f('bowmesh.nif')), 'arrowBONE'));
});

// --- getArrowBone's two branches, through a real build ---------------------

test('MW-D16: with no "Bip01 Arrow" bone the arrow rides the WEAPON MESH', async () => {
  // Which is the branch retail data takes: Morrowind's bows carry an
  // ArrowBone node and most skeletons do not carry Bip01 Arrow.
  const res = await buildFpArm({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: bowDeps() });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  assert.equal(res.weapon.type, MW_WEAPON_TYPE.MarksmanBow);
  assert.equal(res.weapon.bone, 'Weapon Bone Left', 'rule 8: the bow is the one that changes hands');
  assert.ok(res.arrow, 'and the arrow resolved');
  assert.equal(res.arrow.type, MW_WEAPON_TYPE.Arrow);
  assert.equal(res.arrow.viaWeaponMesh, true);
  assert.equal(res.arrow.bone, 'Weapon Bone Left',
    'so it hangs on the WEAPON\'s bone, with the mesh chain baked in');
});

test('MW-D16: a skeleton that HAS the bone takes the first branch instead', async () => {
  const res = await buildFpArm({
    race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: bowDeps({ skeleton: 'armfparrow.nif' }),
  });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  assert.equal(res.arrow.viaWeaponMesh, false);
  assert.equal(res.arrow.bone, 'Bip01 Arrow', 'the ACTOR\'s own bone wins');
});

test('MW-D16: the mesh chain is BAKED, so the two branches put it in different places', async () => {
  const viaMesh = await buildFpArm({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: bowDeps() });
  const viaBone = await buildFpArm({
    race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: bowDeps({ skeleton: 'armfparrow.nif' }),
  });
  const arrowOf = (res) => res.arm.pieces.find((p) => p.slot === 'arrow');
  assert.ok(arrowOf(viaMesh) && arrowOf(viaBone));
  // The fallback bakes a (1, 6, 0) translation and a 90-degree turn into
  // the AUTHORED vertices; the skeleton branch bakes nothing. Same mesh,
  // two different source arrays.
  assert.notDeepEqual([...arrowOf(viaMesh).source], [...arrowOf(viaBone).source]);
  assert.deepEqual([...arrowOf(viaBone).source].map((v) => +v.toFixed(4)),
    [0, 0, 0, 2, 0, 0, 2, 1, 0, 0, 1, 0],
    'the skeleton branch keeps the arrow\'s authored vertices');
  // AND IT INHERITS THE BOW'S MIRROR. A bow hangs on "Weapon Bone Left",
  // so rule 13 negates its X - and the reference instances the arrow
  // under a node that is already inside that mirrored subtree.
  assert.equal(arrowOf(viaMesh).mirrored, true, 'the arrow is mirrored with the bow');
});

test('MW-D16: no ammunition means no arrow, and that is not a refusal', async () => {
  const none = await buildFpArm({ race: 'fprace', weapon: LONG_BOW, hasAmmo: false, deps: bowDeps() });
  assert.ok(none.ok, 'the arm still builds');
  assert.equal(none.arrow, null);
  assert.ok(!none.notes.some((n) => n.startsWith('arrow:')),
    'and says nothing about it - an empty quiver is not a data problem');

  // An archive with the record but not the MESH says so, and still builds.
  const noMesh = await buildFpArm({
    race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: bowDeps({ ammo: false }),
  });
  assert.ok(noMesh.ok);
  assert.equal(noMesh.arrow, null);
  assert.ok(noMesh.notes.some((n) => n.startsWith('arrow:') && n.includes('not in your archives')),
    `expected an arrow note, got ${JSON.stringify(noMesh.notes)}`);

  // A weapon with no ammo type at all never even asks.
  const sword = await buildFpArm({
    race: 'fprace', weapon: { templateIndex: 120 }, hasAmmo: true,
    deps: bowDeps({ esm: Uint8Array.from([...wpdt('longsword', 'w/bowmesh.nif', MW_WEAPON_TYPE.LongBladeOneHand)]) }),
  });
  assert.ok(sword.ok);
  assert.equal(sword.arrow, null);
  assert.ok(!sword.notes.some((n) => n.startsWith('arrow:')));
});

test('MW-D34: ammunition never takes its own BoneOffset - attachArrow is a bare getInstance', async () => {
  // weaponanimation.cpp:87-93: the reference attaches the round with
  // `getInstance(model, parent)` directly - it never goes through
  // SceneUtil::attach, so the ammo mesh's own "BoneOffset" node is
  // never searched for (attach.cpp:147-159 runs only for attach()) and
  // never applied. The port's generic part path read it. Fixture: the
  // arrow's bytes are boneoffset.nif, whose BoneOffset is (3,-4,5).
  const res = await buildFpArm({
    race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: bowDeps({ ammoFixture: 'boneoffset.nif' }),
  });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  const arrow = res.arm.pieces.find((p) => p.slot === 'arrow');
  assert.ok(arrow, 'the arrow bound');
  assert.equal(arrow.boneOffset, null, 'and its own BoneOffset is IGNORED');
  // The control, same bytes through the GENERIC path: a sword whose
  // model is that very mesh takes the offset (rule 14) - so this pin
  // cannot pass by the fixture losing its node.
  const sword = await buildFpArm({
    race: 'fprace', weapon: { templateIndex: 120 }, hasAmmo: false,
    deps: bowDeps({
      ammoFixture: 'boneoffset.nif',
      esm: Uint8Array.from([...wpdt('offset sword', 'w/arrow.nif', MW_WEAPON_TYPE.LongBladeOneHand)]),
    }),
  });
  assert.ok(sword.ok, `${sword.stage}: ${sword.error}`);
  const wp = sword.arm.pieces.find((p) => p.slot === 'weapon');
  assert.deepEqual(wp.boneOffset, [3, -4, 5], 'the weapon still takes rule 14');
});

// --- rule 24's keys --------------------------------------------------------

function liveArm(deps) {
  const arm = createFpArm();
  arm.attach({
    gl: null,
    createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: () => 1,
  }, () => ({ pitch: 0 }));
  return arm;
}

test('MW-D16 rule 24: a drawn BOW is empty until the shoot attach key', async () => {
  const arm = liveArm();
  const res = await arm.build({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: bowDeps() });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  arm.update(0.05);
  assert.equal(arm.status().arrowShown, false, 'nothing on the string at build');

  arm.setSheathed(false);
  for (let i = 0; i < 80 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.WeaponEquipped);
  assert.equal(arm.status().weaponShown, true, 'the bow is in hand');
  // THE SURPRISE, and it is the reference's: only a CROSSBOW reloads
  // itself at the end of a section. A bow waits for the next draw.
  assert.equal(arm.status().arrowShown, false, 'and still no arrow');

  assert.equal(arm.attack('StrikeDown'), 'shoot');
  // shoot start 5.8, shoot attach 5.9.
  for (let i = 0; i < 20 && !arm.status().arrowShown; i++) arm.update(0.05);
  assert.equal(arm.status().arrowShown, true, 'the "shoot attach" key nocks it');

  // shoot max attack 6.2 -> shoot release 6.4: the release LOOSES it.
  for (let i = 0; i < 40 && arm.status().arrowShown; i++) arm.update(0.05);
  assert.equal(arm.status().arrowShown, false, 'and "shoot release" looses it');

  // shoot follow attach 6.6, inside the follow section - the round that
  // goes back on the string before the animation has finished.
  for (let i = 0; i < 40 && !arm.status().arrowShown; i++) arm.update(0.05);
  assert.equal(arm.status().arrowShown, true, 'and "shoot follow attach" nocks the next one');
});

test('MW-D16: only a CROSSBOW reloads itself, and DAGGERFALL HAS NONE', async () => {
  const { reloadsItself, DF_TO_MW_WEAPON } = await import('../src/formats/mwFirstPerson.js');
  // The condition is pinned as a condition, because the branch it guards
  // cannot be reached from the played game: no row of DF_TO_MW_WEAPON is
  // MarksmanCrossbow, since Daggerfall has no crossbow. A branch that
  // cannot be exercised is not pinned; the condition that would reach it
  // is, so a crossbow row added later reloads correctly with nothing to
  // change.
  assert.equal(reloadsItself(MW_WEAPON_TYPE.MarksmanCrossbow), true);
  assert.equal(reloadsItself(MW_WEAPON_TYPE.MarksmanBow), false, 'a BOW waits for the key');
  assert.equal(reloadsItself(MW_WEAPON_TYPE.MarksmanThrown), false);
  assert.equal(reloadsItself(MW_WEAPON_TYPE.LongBladeOneHand), false);
  assert.ok(!Object.values(DF_TO_MW_WEAPON).includes(MW_WEAPON_TYPE.MarksmanCrossbow),
    'and no Daggerfall weapon maps to one - which is why this is a function and not a build');
  // Both of Daggerfall's bows DO map, so the bow half of the rule is
  // live rather than theoretical.
  assert.equal(DF_TO_MW_WEAPON.Long_Bow, MW_WEAPON_TYPE.MarksmanBow);
  assert.equal(DF_TO_MW_WEAPON.Short_Bow, MW_WEAPON_TYPE.MarksmanBow);

  // The same shape, for the same reason: "shoot" is a CLASS test, and a
  // THROWN weapon shoots without being a bow - the case the port's own
  // machine.isBow would have missed. Daggerfall has no thrown row today
  // either, so it too is pinned as a condition.
  const { shootsRatherThanSwings } = await import('../src/formats/mwFirstPerson.js');
  assert.equal(shootsRatherThanSwings(MW_WEAPON_TYPE.MarksmanBow), true);
  assert.equal(shootsRatherThanSwings(MW_WEAPON_TYPE.MarksmanCrossbow), true);
  assert.equal(shootsRatherThanSwings(MW_WEAPON_TYPE.MarksmanThrown), true, 'THROWN shoots too');
  assert.equal(shootsRatherThanSwings(MW_WEAPON_TYPE.LongBladeOneHand), false);
  assert.equal(shootsRatherThanSwings(MW_WEAPON_TYPE.HandToHand), false);
  assert.equal(shootsRatherThanSwings(MW_WEAPON_TYPE.None), false);
  assert.ok(!Object.values(DF_TO_MW_WEAPON).includes(MW_WEAPON_TYPE.MarksmanThrown));
});

test('MW-D16: sheathing DETACHES the arrow, at the section start', async () => {
  const arm = liveArm();
  await arm.build({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: bowDeps() });
  arm.setSheathed(false);
  for (let i = 0; i < 80 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  arm.attack('StrikeDown');
  for (let i = 0; i < 20 && !arm.status().arrowShown; i++) arm.update(0.05);
  assert.equal(arm.status().arrowShown, true);

  // detachArrow() fires as the unequip section STARTS - not at its
  // "unequip detach" key, which is the weapon's.
  arm.setSheathed(true);
  assert.equal(arm.status().arrowShown, false);
});

test('MW-D16: the arrow is a HIDDEN RANGE, like the weapon', async () => {
  const arm = liveArm();
  await arm.build({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: bowDeps() });
  arm.update(0.05);
  const ranges = arm.mesh().ranges;
  const arrow = ranges.filter((r) => r.slot === 'arrow');
  assert.equal(arrow.length, 1, 'one range, in the same mesh as everything else');
  assert.equal(arrow[0].hidden, true);
  const before = ranges.length;
  arm.setSheathed(false);
  for (let i = 0; i < 80 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  arm.attack('StrikeDown');
  for (let i = 0; i < 20 && !arm.status().arrowShown; i++) arm.update(0.05);
  arm.update(0.05);
  assert.equal(arm.mesh().ranges.length, before, 'the range list never changes length');
  assert.equal(arm.mesh().ranges.filter((r) => r.slot === 'arrow')[0].hidden, false);
});

// MW-D42: THE NOCK HAS A FLOOR AT THE DRAW (Mac: the arrow is not shown
// on the bow during the animation). Rule 24's "shoot attach" still
// drives the nock wherever the data carries it - the test above pins
// that - but the arrow may no longer DEPEND on that key existing. It is
// a text key inside the user's own .kf, and when it is absent or named
// otherwise the bow drew empty through the whole shot with nothing
// saying why. THE FIXTURES ALL CARRY THE KEY, which is exactly why this
// pin cannot be written with a clip: it asserts the state BEFORE any
// update() steps the playhead to 5.9, where only the floor can have set
// it. Remove the floor and this dies while every other arrow test stays
// green - which is what a fixture-shaped blind spot looks like.
test('MW-D42: the arrow is on the string the moment the draw BEGINS, key or no key', async () => {
  const arm = liveArm();
  const res = await arm.build({ race: 'fprace', weapon: LONG_BOW, hasAmmo: true, deps: bowDeps() });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  arm.setSheathed(false);
  for (let i = 0; i < 80 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  // MW-D16's surprise still holds: a bow at REST is empty-handed.
  assert.equal(arm.status().arrowShown, false, 'a bow at rest carries nothing');

  assert.equal(arm.attack('StrikeDown'), 'shoot');
  // NOT ONE update() - the playhead has not reached "shoot attach" at
  // 5.9 yet, so a true here can only be the floor.
  assert.equal(arm.status().arrowShown, true,
    'attack() IS the beginning of the draw, and that is where MW-D16 says the round goes on');
});

// AND THE FLOOR IS A FLOOR, NOT A BLANKET. It is gated on the shoot
// class AND on the arm actually having an arrow part, so an empty
// quiver still draws an empty bow - MW-D16's law, which the floor must
// not quietly overturn by conjuring a round from a weapon class test.
test('MW-D42: an empty quiver still draws an EMPTY bow', async () => {
  const arm = liveArm();
  const res = await arm.build({ race: 'fprace', weapon: LONG_BOW, hasAmmo: false, deps: bowDeps() });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  assert.equal(res.arrow, null, 'no ammunition, no arrow part');
  arm.setSheathed(false);
  for (let i = 0; i < 80 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  arm.attack('StrikeDown');
  assert.equal(arm.status().arrowShown, false, 'the draw cannot nock what was never built');
});

// --- MW-D44 + MW-D49: WHERE THE ROUND SITS BEFORE IT FLIES ----------------
//
// THE REFERENCE'S WHOLE ATTACH LAW FOR A HELD ARROW, read rather than
// assumed, because "1:1" was asserted off a search snippet once already
// and it was wrong:
//
//   character.cpp:1153-1165  "shoot attach" (and "shoot follow attach")
//       call attachArrow(); "shoot release" calls releaseArrow(). Those
//       keys are the whole life of the held round.
//   npcanimation.cpp:1077-1102 / creatureanimation.cpp:220-247
//       getArrowBone(): the AMMO type's own attach bone on the actor
//       ("Bip01 Arrow", weapontype.cpp:316) FIRST, and failing that a
//       node named "ArrowBone" found inside the WEAPON PART's node.
//   weaponanimation.cpp:80-94
//       the Ranged branch: `getInstance(model, parent)` and nothing
//       more, where parent is that bone.
//   scenemanager.cpp:1100-1110
//       and getInstance(path, parentNode) is attachTo, which is
//       `parentNode->addChild(instance)`. IDENTITY. The arrow has no
//       transform of its own at all - no offset, no attitude, no
//       mirror. Everything it wears, it wears because its PARENT does.
//
// So on the fallback branch the round's parent is a node deep inside the
// weapon's live graph, and the weapon got there through
// SceneUtil::attach (attach.cpp:145-198), which inserts ONE
// PositionAttitudeTransform between the actor's bone and the weapon
// mesh carrying the weapon's BoneOffset POSITION (:158-159) and rule
// 13's mirror scale (:166-179). The arrow inherits that PAT. Its world
// place is therefore
//
//   bone x T(weaponBoneOffset) x S(mirror) x chain(root..ArrowBone) x v
//
// which is exactly placeAtBone's `bone x (offset + mirror(v))` over
// applyPre'd vertices - a PAT's matrix being T(position) R(attitude)
// S(scale). MW-D48 left open whether a 90-degree rotation was also
// owed; it is not. :159 reads only getTrans(), and the only rotation
// attach() can apply is the caller's `attitude` (:181-186), which
// ActorAnimation::attach passes for isLight ALONE
// (actoranimation.cpp:98-103) and never for a weapon (:104-105).
//
// PINNED BEHAVIOURALLY, which is what MW-D44 named as its honest next
// step and could not do: it needs a rigid part carrying a BoneOffset
// standing in for the bow, and armskelx + boneoffset.nif are exactly
// that pair. A bow-shaped fixture (an ArrowBone AND a BoneOffset in one
// mesh) is still owed to generate.py for the resolveWeaponParts half;
// this pins the BINDER's half, which is where the offset is spent.
test('MW-D44: the held round inherits the WEAPON\'s BoneOffset, and only that', async () => {
  const PRE = { a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [0, 2, 0] };
  const armWith = await assembleFirstPersonArm({
    skeletonBytes: f('armskelx.nif'),
    parts: [
      { slot: 'weapon', bones: ['Left Hand'], bytes: f('boneoffset.nif') },
      { slot: 'arrow', bones: ['Left Hand'], bytes: f('armcuff.nif'), ammo: true, preTransform: PRE },
    ],
  });
  assert.ok(armWith.ok, armWith.error);
  const withWeapon = armWith.pieces.find((p) => p.slot === 'arrow');
  assert.deepEqual(withWeapon.boneOffset, [3, -4, 5], 'the weapon\'s offset reached the round');

  // THE CONTROL, and it is the measurement: the SAME round with no
  // weapon in the list. Every vertex must differ by exactly (3,-4,5) -
  // the displacement Mac was looking at, now applied on purpose.
  const armAlone = await assembleFirstPersonArm({
    skeletonBytes: f('armskelx.nif'),
    parts: [{ slot: 'arrow', bones: ['Left Hand'], bytes: f('armcuff.nif'), ammo: true, preTransform: PRE }],
  });
  const alone = armAlone.pieces.find((p) => p.slot === 'arrow');
  assert.equal(alone.boneOffset, null);
  assert.equal(withWeapon.positions.length, alone.positions.length);
  assert.ok(alone.positions.length >= 3, 'there are vertices to compare');
  for (let v = 0; v < alone.positions.length; v += 3) {
    assert.ok(Math.abs((withWeapon.positions[v] - alone.positions[v]) - 3) < 1e-4,
      `x: ${withWeapon.positions[v]} vs ${alone.positions[v]}`);
    assert.ok(Math.abs((withWeapon.positions[v + 1] - alone.positions[v + 1]) + 4) < 1e-4,
      `y: ${withWeapon.positions[v + 1]} vs ${alone.positions[v + 1]}`);
    assert.ok(Math.abs((withWeapon.positions[v + 2] - alone.positions[v + 2]) - 5) < 1e-4,
      `z: ${withWeapon.positions[v + 2]} vs ${alone.positions[v + 2]}`);
  }
  // AND THE OFFSET IS NOT MIRRORED. The round is on "Left Hand", so its
  // vertices ARE mirrored - but the shift above is +3 in x, not -3,
  // because the PAT is T(position) x S(scale) and the offset sits
  // outside the scale. Adding it before the mirror would negate its x
  // on every left-hand part, the bow among them.
  assert.equal(withWeapon.mirrored, true, 'the round is on the left, like the bow');
});

test('MW-D44: only the WEAPON lends it, and only on the weapon-mesh branch', async () => {
  const PRE = { a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [0, 2, 0] };
  const arrow = (parts) => assembleFirstPersonArm({ skeletonBytes: f('armskelx.nif'), parts })
    .then((a) => a.pieces.find((p) => p.slot === 'arrow'));

  // getArrowBone's FIRST branch: the ACTOR's skeleton carries the bone,
  // the parent is that bone, and the weapon is not in the chain at all.
  // preTransform is set in exactly the other case, so it IS the branch
  // test - inheriting the weapon's offset here would be the same
  // mistake pointing the other way.
  const onActor = await arrow([
    { slot: 'weapon', bones: ['Left Hand'], bytes: f('boneoffset.nif') },
    { slot: 'arrow', bones: ['Left Hand'], bytes: f('armcuff.nif'), ammo: true },
  ]);
  assert.equal(onActor.boneOffset, null, 'the quiver branch inherits nothing from the bow');

  // A SHIELD LENDS THE ARROW NOTHING. The reference reads the
  // CarriedRight slot's part (npcanimation.cpp:1078-1086); any other
  // rigid part carrying a BoneOffset is a bystander.
  const withShield = await arrow([
    { slot: 'shield', bones: ['Left Hand'], bytes: f('boneoffset.nif') },
    { slot: 'arrow', bones: ['Left Hand'], bytes: f('armcuff.nif'), ammo: true, preTransform: PRE },
  ]);
  assert.equal(withShield.boneOffset, null, 'a shield is not the weapon');

  // MW-D34 STILL STANDS, and it is this fix's control: the ammunition
  // mesh's OWN BoneOffset is never searched for, because attachArrow
  // does not go through SceneUtil::attach. armcuffx carries one of
  // (0.5,0,0); the round wears the weapon's (3,-4,5) and not the sum.
  const ownOffset = await arrow([
    { slot: 'weapon', bones: ['Left Hand'], bytes: f('boneoffset.nif') },
    { slot: 'arrow', bones: ['Left Hand'], bytes: f('armcuffx.nif'), ammo: true, preTransform: PRE },
  ]);
  assert.deepEqual(ownOffset.boneOffset, [3, -4, 5],
    'the weapon\'s offset, never the round\'s own and never both');

  // AND THE CARRY IS PER-CALL. A body built without a weapon cannot
  // pick up the last one's offset.
  const stale = await arrow([
    { slot: 'arrow', bones: ['Left Hand'], bytes: f('armcuff.nif'), ammo: true, preTransform: PRE },
  ]);
  assert.equal(stale.boneOffset, null, 'no weapon in this list, no offset');
});

// MW-D48: THE TWO COMPOSITIONS AGREE, PROVEN BY EXECUTION. The arrow is
// the ONLY part whose placement goes through nodeTransformOf/mulAffine
// (affineOf folds scale into the 3x3); every other part is placed by
// flattenNif's composeTransform, which carries scale as its own field
// and applies it to the child's translation separately. Two different
// shapes of arithmetic for the same job, and the arrow is the one that
// is mispositioned - so it reads like the fault and it is NOT. Pinned
// by RUNNING both over a chain with rotations AND scales, because
// reading them side by side is exactly how this was called a bug once
// already. If someone ever changes one, this says the other must move
// with it.
test('MW-D48: nodeTransformOf composes the same chain flattenNif does', () => {
  // A hand-built NIF shape: root (rule 34 zeroes it), a scaled+rotated
  // parent, then the named node - the shape of a real weapon chain.
  const R = [0, -1, 0, 1, 0, 0, 0, 0, 1];
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const nif = {
    roots: [0],
    records: [
      { type: 'NiNode', name: 'root', rotation: I3, translation: [0, 0, 0], scale: 1, children: [1] },
      { type: 'NiNode', name: 'mid', rotation: R, translation: [3, 1, 0], scale: 2, children: [2] },
      { type: 'NiNode', name: 'ArrowBone', rotation: R, translation: [10, 4, 2], scale: 1.5, children: [] },
    ],
  };
  const pre = nodeTransformOf(nif, 'ArrowBone');
  assert.ok(pre, 'the node resolves');
  // composeTransform's arithmetic, written out: translation accumulates
  // through the PARENT's rotation with the PARENT's scale applied to the
  // child's translation, and scale multiplies down the chain.
  const m33 = (A, B) => {
    const o = new Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    }
    return o;
  };
  const ap = (m, x, y, z) => [
    m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z,
  ];
  let w = { rotation: I3, translation: [0, 0, 0], scale: 1 };
  for (const nd of nif.records) {
    const t = ap(w.rotation, nd.translation[0] * w.scale, nd.translation[1] * w.scale, nd.translation[2] * w.scale);
    w = {
      rotation: m33(w.rotation, nd.rotation),
      translation: [w.translation[0] + t[0], w.translation[1] + t[1], w.translation[2] + t[2]],
      scale: w.scale * nd.scale,
    };
  }
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(pre.t[i] - w.translation[i]) < 1e-6,
      `translation ${i}: ${pre.t[i]} vs ${w.translation[i]} - the round would land off the string by the difference`);
  }
  // And the folded scale is the chain's product, so applyPre scales the
  // arrow's vertices by exactly what flattenNif scales the bow's by.
  const folded = Math.hypot(pre.a[0], pre.a[3], pre.a[6]);
  assert.ok(Math.abs(folded - w.scale) < 1e-6, `${folded} vs ${w.scale}`);
});

// MW-D49: THE NAME SEARCH READS THE TREE THE LOADER WOULD BUILD.
// FindByNameVisitor is an osg::NodeVisitor (visitor.cpp:38-49) walking
// the BUILT SCENE, and by then the loader has dropped Bounding Box
// subtrees and RootCollisionNode subtrees and masked hidden nodes.
// findNodeByName reads the RAW PARSED NIF, where all of it is still
// there - so without rule 58's filters it can answer with a node the
// reference's search cannot see. flattenNif has applied these three all
// along; the search that places the ARROW had none of them, and a
// different node answering to "ArrowBone" is a different preTransform,
// which is the round in a different place while it stays on the same
// bone.
test('MW-D49: findNodeByName honours rule 58, like the scene the reference searches', () => {
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const n = (name, extra = {}) => ({
    type: 'NiNode', name, rotation: I3, translation: [0, 0, 0], scale: 1, children: [], flags: 0, ...extra,
  });
  // A decoy ArrowBone inside collision, and the real one outside it.
  const nif = {
    roots: [0],
    records: [
      { ...n('root'), children: [1, 3] },
      { ...n('collision'), type: 'RootCollisionNode', children: [2] },
      { ...n('ArrowBone'), translation: [999, 999, 999] },
      { ...n('ArrowBone'), translation: [1, 2, 3] },
    ],
  };
  const hit = findNodeByName(nif, 'ArrowBone');
  assert.ok(hit, 'the real one is found');
  assert.deepEqual([...hit.rec.translation], [1, 2, 3],
    'the collision subtree is not searched - the reference never sees it');

  // A "Bounding Box" subtree is dropped by the loader too.
  const bb = {
    roots: [0],
    records: [
      { ...n('root'), children: [1, 3] },
      { ...n('Bounding Box'), children: [2] },
      { ...n('ArrowBone'), translation: [999, 999, 999] },
      { ...n('ArrowBone'), translation: [7, 8, 9] },
    ],
  };
  assert.deepEqual([...findNodeByName(bb, 'ArrowBone').rec.translation], [7, 8, 9],
    'a Bounding Box subtree is not searched either');

  // A hidden node is masked out of the built scene, so it cannot answer.
  const hidden = {
    roots: [0],
    records: [{ ...n('root'), children: [1] }, { ...n('ArrowBone'), flags: 0x0001 }],
  };
  assert.equal(findNodeByName(hidden, 'ArrowBone'), null, 'a hidden node is not in the scene');

  // But a ROOT named "Bounding Box" is NOT skipped - the reference's
  // guard is `args.mRootNode && ...` and mRootNode is null on the first
  // call. flattenNif reproduces that oversight and so must this.
  const bbRoot = {
    roots: [0],
    records: [{ ...n('Bounding Box'), children: [1] }, { ...n('ArrowBone'), translation: [4, 5, 6] }],
  };
  assert.ok(findNodeByName(bbRoot, 'ArrowBone'), 'a Bounding Box ROOT is load-bearing, not skipped');
});
