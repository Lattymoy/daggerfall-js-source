import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { nodeTransformOf, findNodeByName } from '../src/formats/mwCharacter.js';
import {
  MW_WEAPON_TYPE, WEAPON_AMMO_TYPE, ammoTypeFor, arrowAttachBone, ARROW_FALLBACK_NODE,
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
function bowDeps({ skeleton = 'armfp.nif', ammo = true, esm = null } = {}) {
  const files = new Map([
    [fpSkeletonPath({}), f(skeleton)],
    [FP_CLIP_PATH, f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/bowmesh.nif', f('bowmesh.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  if (ammo) files.set('meshes/w/arrow.nif', f('arrow.nif'));
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
