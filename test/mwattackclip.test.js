import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFpArm, createFpArm, fpSkeletonPath, FP_CLIP_PATH, FP_IDLE_BASE, FP_IDLE_LOOPS,
  animWeaponType, clipCompletion, releaseSkip, UPPER_BODY,
} from '../src/combat/fpArm.js';
import {
  MW_WEAPON_TYPE, MW_WEAPON_CLASS, WEAPON_CLASS, WEAPON_FLAGS, MW_TWO_HANDED, MW_HAS_HEALTH,
  isRealWeapon, isTwoHandedMelee, composeStanceGroup, composeWeaponGroup,
  weaponShortGroup, weaponLongGroup, mwAttackType, attackKeys, calculateWindUp,
  releaseStartPoint, EQUIP_KEYS, UNEQUIP_KEYS, DF_STRIKE_TO_MW_ATTACK,
  allWeaponShortGroups,
} from '../src/formats/mwFirstPerson.js';
import { getTextKeyTime, getStartTime, resetClip, advanceClip } from '../src/formats/mwAnim.js';

// MW-D12: THE WEAPON AND ATTACK GROUPS.
//
// MW-D11 shipped an arm that held a longsword and played a BARE-HANDED
// idle for ever - one hardcoded group, no equip, no swing, no sheathe.
// These pins are rules 8, 9, 10 and 11 as the reference states them, plus
// the machine that sequences them, run against a fixture .kf authored to
// make every fallback in those rules reachable.
//
// What they cannot see: what the arm LOOKS like. That stays with
// tools/mwArmProbe.mjs and tools/mwRigProbe.mjs against real WebGL2. What
// is here is the group arithmetic, the key names, and the state machine -
// none of which a picture would show to be wrong.

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));

/** A WEAP record, byte-shaped as loadweap.hpp:71 says. */
const wpdtRec = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(10, type, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return Uint8Array.from([...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d]);
};

/** The MW-D12 rig: MW-D10's first-person arm with armfpweapon.kf's
 *  groups behind it, and optionally a Daggerfall weapon in hand. */
function fpDeps(weapEsm = null) {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/blade.nif', f('weapon.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  const names = weapEsm ? ['armfp.esm', 'weap.esm'] : ['armfp.esm'];
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => names,
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weapEsm : f('armfp.esm')),
  };
}

const fakeRenderer = () => ({
  gl: null,
  createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }),
  updateCharacterMesh: () => {},
  createCharacterTexture: () => 1,
});

/** The Daggerfall longsword, template 120 - DF_TO_MW_WEAPON maps it to
 *  LongBladeOneHand, whose long group "weapononehand" the fixture has. */
const LONGSWORD = { templateIndex: 120 };

async function drawnArm() {
  const arm = createFpArm();
  arm.attach(fakeRenderer(), () => ({ pitch: 0 }));
  const res = await arm.build({
    race: 'fprace',
    weapon: LONGSWORD,
    deps: fpDeps(wpdtRec('iron longsword', 'w/blade.nif', MW_WEAPON_TYPE.LongBladeOneHand)),
  });
  assert.ok(res.ok, `build: ${res.stage} ${res.error}`);
  return arm;
}

/** Run the arm until `done()` or the step budget runs out. */
function run(arm, done, { dt = 0.05, steps = 400 } = {}) {
  for (let i = 0; i < steps; i++) {
    if (done(arm.status())) return i;
    arm.update(dt);
  }
  return done(arm.status()) ? steps : -1;
}

// --- rule 8: the table's other two columns ----------------------------------

test('MW-D12 rule 8: isRealWeapon is a THREE-name test, and PickProbe is not one of them', () => {
  // character.cpp:316-320 verbatim. PickProbe is the entry everybody
  // guesses wrong: a lockpick IS a real weapon by this test and takes
  // the sword fallbacks, where bare fists do not.
  assert.equal(isRealWeapon(MW_WEAPON_TYPE.HandToHand), false);
  assert.equal(isRealWeapon(MW_WEAPON_TYPE.Spell), false);
  assert.equal(isRealWeapon(MW_WEAPON_TYPE.None), false);
  assert.equal(isRealWeapon(MW_WEAPON_TYPE.PickProbe), true);
  for (const t of ['ShortBladeOneHand', 'LongBladeOneHand', 'MarksmanBow', 'MarksmanThrown']) {
    assert.equal(isRealWeapon(MW_WEAPON_TYPE[t]), true, t);
  }
});

test('MW-D12 rule 8: two-handed is TWO tests, and the flag alone gets three types wrong', () => {
  // `mFlags & TwoHanded && mWeaponClass == Melee` (character.cpp:584).
  // Spell and HandToHand carry the TwoHanded flag and bows are TwoHanded
  // AND Ranged, so a port that tests the flag alone sends all three down
  // the two-handed ladder.
  assert.ok(WEAPON_FLAGS[MW_WEAPON_TYPE.HandToHand] & MW_TWO_HANDED, 'fists ARE flagged two-handed');
  assert.ok(WEAPON_FLAGS[MW_WEAPON_TYPE.Spell] & MW_TWO_HANDED, 'so is a readied spell');
  assert.ok(WEAPON_FLAGS[MW_WEAPON_TYPE.MarksmanBow] & MW_TWO_HANDED, 'and a bow');
  assert.equal(isTwoHandedMelee(MW_WEAPON_TYPE.MarksmanBow), false, 'but a bow is RANGED');
  assert.equal(WEAPON_CLASS[MW_WEAPON_TYPE.MarksmanThrown], MW_WEAPON_CLASS.Thrown);
  assert.equal(WEAPON_CLASS[MW_WEAPON_TYPE.Arrow], MW_WEAPON_CLASS.Ammo);
  for (const t of ['LongBladeTwoHand', 'AxeTwoHand', 'BluntTwoClose', 'BluntTwoWide', 'SpearTwoWide']) {
    assert.equal(isTwoHandedMelee(MW_WEAPON_TYPE[t]), true, t);
  }
  for (const t of ['ShortBladeOneHand', 'LongBladeOneHand', 'BluntOneHand', 'AxeOneHand', 'PickProbe']) {
    assert.equal(isTwoHandedMelee(MW_WEAPON_TYPE[t]), false, t);
  }
  // HasHealth is transcribed too, and it separates the two types that
  // share every other column from the ones that do not.
  assert.ok(WEAPON_FLAGS[MW_WEAPON_TYPE.LongBladeOneHand] & MW_HAS_HEALTH);
  assert.equal(WEAPON_FLAGS[MW_WEAPON_TYPE.MarksmanThrown] & MW_HAS_HEALTH, 0);
});

// --- rule 9: the two ladders ------------------------------------------------

test('MW-D12 rule 9: a NON-real weapon skips the ladder and goes straight to the bare base', () => {
  // fallbackShortWeaponGroup's first branch (character.cpp:604-611).
  // The fixture has idle1h and NOT idlehh, which is exactly the retail
  // shape this branch exists for.
  const has = (n) => ['idle', 'idle1h', 'idle2c', 'idlebow'].includes(n);
  assert.equal(weaponShortGroup(MW_WEAPON_TYPE.HandToHand), 'hh');
  const fists = composeStanceGroup(FP_IDLE_BASE, MW_WEAPON_TYPE.HandToHand, has);
  assert.deepEqual(fists, { group: 'idle', fallback: 'bare' },
    'bare fists idle PLAINLY - never in the one-handed SWORD stance');
  // And a real weapon in the same file does take the ladder.
  const axe = composeStanceGroup(FP_IDLE_BASE, MW_WEAPON_TYPE.AxeTwoHand, has);
  assert.deepEqual(axe, { group: 'idle2c', fallback: 'short' },
    'a two-handed axe with no idle2b falls to the two-handed SWORD stance');
  const spear = composeStanceGroup(FP_IDLE_BASE, MW_WEAPON_TYPE.SpearTwoWide, has);
  assert.equal(spear.group, 'idle2c', 'and so does a spear');
  const dagger = composeStanceGroup(FP_IDLE_BASE, MW_WEAPON_TYPE.ShortBladeOneHand, has);
  assert.deepEqual(dagger, { group: 'idle1h', fallback: 'short' });
  // The asked group, when present, wins with no fallback recorded.
  assert.deepEqual(composeStanceGroup(FP_IDLE_BASE, MW_WEAPON_TYPE.MarksmanBow, has),
    { group: 'idlebow', fallback: null });
  // And the tail: a file with NOTHING refuses rather than inventing.
  assert.deepEqual(composeStanceGroup(FP_IDLE_BASE, MW_WEAPON_TYPE.AxeTwoHand, () => false),
    { group: null, fallback: null });
});

test('MW-D12 rule 9: the LONG ladder is gated the same way, so fists never mime a sword', () => {
  // getWeaponAnimation (character.cpp:573-592).
  const has = (n) => ['weapononehand', 'weapontwohand', 'bowandarrow'].includes(n);
  assert.equal(weaponLongGroup(MW_WEAPON_TYPE.HandToHand), 'handtohand');
  assert.deepEqual(composeWeaponGroup(MW_WEAPON_TYPE.HandToHand, has), { group: null, fallback: null },
    'no handtohand group means NO weapon animation - not a sword one');
  assert.deepEqual(composeWeaponGroup(MW_WEAPON_TYPE.AxeTwoHand, has), { group: 'weapontwohand', fallback: 'long' });
  assert.deepEqual(composeWeaponGroup(MW_WEAPON_TYPE.BluntOneHand, has), { group: 'weapononehand', fallback: 'long' });
  assert.deepEqual(composeWeaponGroup(MW_WEAPON_TYPE.MarksmanBow, has), { group: 'bowandarrow', fallback: null });
  // A BOW is TwoHanded but Ranged, so its ladder is the ONE-handed group.
  assert.deepEqual(composeWeaponGroup(MW_WEAPON_TYPE.MarksmanCrossbow, has),
    { group: 'weapononehand', fallback: 'long' });
});

test('MW-D12 rule 8: the animation weapon type is the STANCE, not the item', () => {
  // Sheathed is None whatever is in the pack; drawn empty hands are
  // HandToHand. Same hand, two animation states.
  assert.equal(animWeaponType(MW_WEAPON_TYPE.LongBladeOneHand, true), MW_WEAPON_TYPE.None);
  assert.equal(animWeaponType(MW_WEAPON_TYPE.None, false), MW_WEAPON_TYPE.HandToHand);
  assert.equal(animWeaponType(MW_WEAPON_TYPE.None, true), MW_WEAPON_TYPE.None);
  assert.equal(animWeaponType(MW_WEAPON_TYPE.MarksmanBow, false), MW_WEAPON_TYPE.MarksmanBow);
  // And that is what makes the sheathed stance the BARE idle: type None
  // has no short group at all.
  assert.equal(weaponShortGroup(MW_WEAPON_TYPE.None), '');
});

test('MW-D17 rule 8: getAllWeaponTypeShortGroups is the ELEVEN, deduplicated and sorted', () => {
  // weapontype.cpp:422-434 - every type First(-4)..Last(13), non-empty
  // short groups "via a set to eliminate duplicates", and std::set also
  // SORTS. The literal is typed from the reference's per-type values:
  // dropping the dedupe doubles 1h/1b/2b/2w, dropping the non-empty
  // test admits None/Arrow/Bolt's '', and starting the walk at 0 loses
  // the four pseudo-types' 1h/spell/hh.
  assert.deepEqual(allWeaponShortGroups(),
    ['1b', '1h', '1s', '1t', '2b', '2c', '2w', 'bow', 'crossbow', 'hh', 'spell']);
});

// --- rule 10: the idle loop count -------------------------------------------

test('MW-D12 rule 10: the dice are 1 + rollDice(4), which is 1..4 WRAPS and 2..5 plays', () => {
  // `numLoops = 1 + Misc::Rng::rollDice(4, prng)` with rollDice(max) in
  // [0, max-1]. A port that reads the comment's "2 to 5" as the loop
  // count idles half again as long as Morrowind does.
  const seen = new Set();
  for (let i = 0; i < 4000; i++) seen.add(FP_IDLE_LOOPS());
  assert.deepEqual([...seen].sort((a, b) => a - b), [1, 2, 3, 4]);
});

test('MW-D12 rule 10: the loop count is CONDITIONAL on a short group, and the idle really wraps', async () => {
  const arm = await drawnArm();
  // Sheathed: weapon type None, no short group, so numLoops stays at its
  // uint32-max default and the idle never runs to its stop key.
  assert.equal(arm.status().idleGroup, 'idle');
  assert.equal(arm.status().loopsLeft, null, 'a sheathed idle loops without end');

  arm.setSheathed(false);
  assert.ok(run(arm, (s) => s.upper === UPPER_BODY.WeaponEquipped) >= 0, 'the draw finishes');
  assert.equal(arm.status().idleGroup, 'idle1h');
  const loops = arm.status().loopsLeft;
  assert.ok(loops >= 1 && loops <= 4, `a drawn idle gets 1..4 wraps, got ${loops}`);

  // THE WRAP ITSELF. idle1h's window is [0.6, 1.6] with loop start 0.8
  // and loop stop 1.4, so a playhead that has passed 1.4 and come back
  // below it has wrapped - which is the behaviour a single loopFallback
  // flag decides and which MW-D11 did not have.
  let sawPast = false;
  let wrapped = false;
  for (let i = 0; i < 200 && !wrapped; i++) {
    arm.update(0.05);
    const t = arm.status().time;
    if (t >= 1.35) sawPast = true;
    else if (sawPast && t <= 0.85) wrapped = true;
  }
  assert.ok(wrapped, 'the drawn idle loops back to its "loop start" key');
});

// --- rule 11: the key names -------------------------------------------------

test('MW-D12 rule 11: the attack type is a KEY PREFIX, never part of the group', () => {
  const k = attackKeys('chop', 1);
  assert.deepEqual(k.windUp, { start: 'chop start', stop: 'chop max attack' });
  assert.deepEqual(k.release, { start: 'chop max attack', stop: 'chop hit' });
  assert.deepEqual(k.follow, { start: 'chop large follow start', stop: 'chop large follow stop' });
  assert.equal(k.minAttack, 'chop min attack');
  assert.equal(k.minHit, 'chop min hit');
  // A SHOT has no strength word and its hit key is "release".
  const s = attackKeys('shoot', 0.1);
  assert.deepEqual(s.follow, { start: 'shoot follow start', stop: 'shoot follow stop' });
  assert.equal(s.hitKey, 'shoot release');
  // The three strength words and their exact boundaries (:1800-1802).
  assert.equal(attackKeys('chop', 0.32).follow.start, 'chop small follow start');
  assert.equal(attackKeys('chop', 0.33).follow.start, 'chop medium follow start');
  assert.equal(attackKeys('chop', 0.65).follow.start, 'chop medium follow start');
  assert.equal(attackKeys('chop', 0.66).follow.start, 'chop large follow start');
});

test('MW-D12 rule 11: the six Daggerfall strikes map onto three Morrowind types by SHAPE', () => {
  assert.equal(mwAttackType('StrikeDown'), 'chop');
  assert.equal(mwAttackType('StrikeDownLeft'), 'chop');
  assert.equal(mwAttackType('StrikeDownRight'), 'chop');
  assert.equal(mwAttackType('StrikeLeft'), 'slash');
  assert.equal(mwAttackType('StrikeRight'), 'slash');
  assert.equal(mwAttackType('StrikeUp'), 'thrust');
  // Every DFU strike has a row - a swing with no type would be a swing
  // the arm silently refuses.
  assert.equal(Object.keys(DF_STRIKE_TO_MW_ATTACK).length, 6);
  // A bow's swing is "shoot" whatever direction produced it.
  assert.equal(mwAttackType('StrikeLeft', { bow: true }), 'shoot');
  assert.equal(mwAttackType('nonsense'), null, 'and an unknown strike is refused, not defaulted');
});

test('MW-D12 rule 11: calculateWindUp is a RATIO with a -1 sentinel, not a zero', () => {
  assert.equal(calculateWindUp(2.9, 2.7, 2.9), 1);
  assert.equal(calculateWindUp(2.7, 2.7, 2.9), 0);
  assert.ok(Math.abs(calculateWindUp(2.8, 2.7, 2.9) - 0.5) < 1e-9);
  assert.equal(calculateWindUp(3.5, 2.7, 2.9), 1, 'clamped high');
  assert.equal(calculateWindUp(2.0, 2.7, 2.9), 0, 'clamped low');
  // The two refusals, and BOTH are -1 rather than 0 - prepareHit
  // replaces -1 with a random blow, and would replace 0 with nothing.
  assert.equal(calculateWindUp(1, -1, 2.9), -1, 'no "min attack" key at all');
  assert.equal(calculateWindUp(1, 3.0, 2.9), -1, 'a window that runs backwards');
  assert.equal(calculateWindUp(1, 2.9, 2.9), -1, 'and a window of zero width');
});

test('MW-D12 rule 11: the release SKIP is ordering-tested, never sentinel-tested', () => {
  // character.cpp:1774-1784. Every guard is an ordering comparison, which
  // is what makes a missing key (-1) fall out on its own - rule 46's
  // recorded caveat, applied.
  const full = { minAttackTime: 2.7, maxAttackTime: 2.9, minHitTime: 3.1, hitTime: 3.3 };
  // strength 1 -> no skip at all, whatever the rescale would be.
  assert.equal(releaseStartPoint(1, full), 0);
  // strength 0.5 -> half, rescaled by (3.1-2.9)/(3.3-2.9) = 0.5.
  assert.ok(Math.abs(releaseStartPoint(0.5, full) - 0.25) < 1e-9);
  // No "min hit" key: the rescale is skipped, the raw 1-strength stands.
  assert.ok(Math.abs(releaseStartPoint(0.5, { ...full, minHitTime: -1 }) - 0.5) < 1e-9);
  // No wind-up window at all: no skip.
  assert.equal(releaseStartPoint(0.5, { ...full, minAttackTime: -1 }), 0);
  assert.equal(releaseStartPoint(0.5, { ...full, minAttackTime: 3.0 }), 0);
});

test('MW-D12 rule 46: getTextKeyTime is a PREFIX match and answers -1, not null', () => {
  const keys = [
    { time: 0.5, text: 'weapononehand: chop start' },
    { time: 1.5, text: 'weapononehand: chop min attack' },
    { time: 2.5, text: 'weapononehand: chop max attack' },
  ];
  assert.equal(getTextKeyTime(keys, 'weapononehand: chop min attack'), 1.5);
  assert.equal(getTextKeyTime(keys, 'weapononehand: chop min'), 1.5, 'a PREFIX matches');
  assert.equal(getTextKeyTime(keys, 'weapononehand: thrust hit'), -1);
  assert.equal(getStartTime(keys, 'weapononehand'), 0.5, 'the group\'s FIRST key, whatever its action');
  assert.equal(getStartTime(keys, 'weapon'), -1, 'and the ": " test stops a partial group name matching');
  // -1, because the callers do arithmetic on it. null would coerce to 0
  // and make "the key is at time zero" indistinguishable from "absent".
  assert.notEqual(getTextKeyTime(keys, 'nope'), null);
});

test('MW-D12: the release start point is resolved against the FILE, and the fixture proves it', () => {
  // armfpweapon.kf: chop min attack 2.7, max 2.9, min hit 3.1, hit 3.3.
  const keys = [
    { time: 2.7, text: 'weapononehand: chop min attack' },
    { time: 2.9, text: 'weapononehand: chop max attack' },
    { time: 3.1, text: 'weapononehand: chop min hit' },
    { time: 3.3, text: 'weapononehand: chop hit' },
  ];
  assert.equal(releaseSkip(keys, 'weapononehand', 'chop', 1), 0);
  assert.ok(Math.abs(releaseSkip(keys, 'weapononehand', 'chop', 0.5) - 0.25) < 1e-9);
  // A group the file does not carry gets no skip rather than a NaN.
  assert.equal(releaseSkip(keys, 'blunttwohand', 'chop', 0.5), 0);
});

// --- the machine ------------------------------------------------------------

test('MW-D12: drawing plays the equip section and the weapon appears at "equip attach"', async () => {
  const arm = await drawnArm();
  assert.equal(arm.status().weapon.type, MW_WEAPON_TYPE.LongBladeOneHand, 'the longsword resolved');
  assert.equal(arm.status().weaponShown, false, 'a sheathed weapon is NOT in shot');
  assert.equal(arm.status().upper, UPPER_BODY.None);

  assert.equal(arm.setSheathed(false), true);
  assert.equal(arm.status().upper, UPPER_BODY.Equipping);
  assert.equal(arm.status().weaponGroup, 'weapononehand');
  assert.equal(arm.status().idleGroup, 'idle1h', 'drawing changes the stance AT ONCE (:1495)');
  assert.equal(arm.status().weaponShown, false,
    'and the blade is still hidden - the file HAS an "equip attach" key, so it decides');

  // equip start 2.0, attach 2.2, stop 2.4.
  assert.ok(run(arm, (s) => s.weaponShown) >= 0, 'the attach key fires');
  assert.ok(arm.status().time >= 2.2 && arm.status().upper === UPPER_BODY.Equipping);
  assert.ok(run(arm, (s) => s.upper === UPPER_BODY.WeaponEquipped) >= 0, 'and the section ends');
  assert.equal(arm.status().weaponShown, true);
  assert.deepEqual(arm.status().clipNotes, [], 'with no refusals along the way');
});

test('MW-D12: a blow runs wind-up -> release -> follow and lands back at WeaponEquipped', async () => {
  const arm = await drawnArm();
  arm.setSheathed(false);
  run(arm, (s) => s.upper === UPPER_BODY.WeaponEquipped);

  assert.equal(arm.attack('StrikeDownLeft'), 'chop', 'the DOWN-LEFT drag is a chop');
  assert.equal(arm.status().upper, UPPER_BODY.AttackWindUp);
  assert.ok(Math.abs(arm.status().time - 2.5) < 1e-6, 'and it starts at "chop start"');

  const phases = [];
  for (let i = 0; i < 200; i++) {
    const s = arm.status();
    if (!phases.length || phases[phases.length - 1][0] !== s.upper) phases.push([s.upper, s.time]);
    if (s.upper === UPPER_BODY.WeaponEquipped && phases.length > 1) break;
    arm.update(0.05);
  }
  assert.deepEqual(phases.map((p) => p[0]), [
    UPPER_BODY.AttackWindUp, UPPER_BODY.AttackRelease, UPPER_BODY.AttackEnd, UPPER_BODY.WeaponEquipped,
  ], 'all three sections, in the reference\'s order');
  // The release starts at "chop max attack" (2.9) and the follow at
  // "chop LARGE follow start" (3.8) - large because a Daggerfall swing is
  // uncharged, so the wind-up runs to its end and strength is 1.
  assert.ok(Math.abs(phases[1][1] - 2.9) < 1e-5, `release at ${phases[1][1]}`);
  assert.ok(Math.abs(phases[2][1] - 3.8) < 1e-5, `follow at ${phases[2][1]}`);
  assert.equal(arm.status().attackType, null, 'and the blow is over');
  assert.equal(arm.status().idleGroup, 'idle1h', 'the stance survives it');
});

test('MW-D12: the attack type picks a DIFFERENT section of the same group', async () => {
  const arm = await drawnArm();
  arm.setSheathed(false);
  run(arm, (s) => s.upper === UPPER_BODY.WeaponEquipped);
  assert.equal(arm.attack('StrikeUp'), 'thrust');
  // thrust start is 4.6 in the fixture, chop start 2.5 - the group is the
  // same "weapononehand" both times, which is rule 11's whole point.
  assert.ok(Math.abs(arm.status().time - 4.6) < 1e-6);
  assert.equal(arm.status().weaponGroup, 'weapononehand');
});

test('MW-D12: a swing is REFUSED while equipping, mid-blow, and while sheathed', async () => {
  const arm = await drawnArm();
  assert.equal(arm.attack('StrikeDown'), null, 'sheathed hands do not swing');
  arm.setSheathed(false);
  assert.equal(arm.status().upper, UPPER_BODY.Equipping);
  assert.equal(arm.attack('StrikeDown'), null, 'nor do hands still drawing the weapon');
  run(arm, (s) => s.upper === UPPER_BODY.WeaponEquipped);
  assert.equal(arm.attack('StrikeDown'), 'chop');
  assert.equal(arm.attack('StrikeLeft'), null, 'and a blow in progress is not restarted');
  assert.equal(arm.status().attackType, 'chop');
});

test('MW-D12: sheathing keeps the stance until the unequip section ENDS', async () => {
  const arm = await drawnArm();
  arm.setSheathed(false);
  run(arm, (s) => s.upper === UPPER_BODY.WeaponEquipped);

  assert.equal(arm.setSheathed(true), true);
  assert.equal(arm.status().upper, UPPER_BODY.Unequipping);
  // THE ASYMMETRY. Drawing flips the type as the animation starts;
  // sheathing does not flip it until the animation finishes
  // (character.cpp:1857-1859) - otherwise the unequip section would be
  // looked for in the bare-handed group and the weapon would blink out.
  assert.equal(arm.status().idleGroup, 'idle1h', 'the drawn stance is held through the put-away');
  assert.equal(arm.status().weaponGroup, 'weapononehand');
  assert.equal(arm.status().weaponShown, true, 'and the blade is still in shot');

  // The per-frame sync must not restart the section it is already playing.
  arm.update(0.05);
  const t = arm.status().time;
  assert.equal(arm.setSheathed(true), false, 'a repeat ask is a no-op');
  assert.equal(arm.status().time, t, 'and does NOT rewind the unequip');

  assert.ok(run(arm, (s) => !s.weaponShown) >= 0, 'the "unequip detach" key hides the blade');
  assert.ok(run(arm, (s) => s.upper === UPPER_BODY.None) >= 0);
  assert.equal(arm.status().idleGroup, 'idle', 'and NOW the stance drops to the bare idle');
  assert.equal(arm.status().loopsLeft, null, 'which loops without end again');
});

test('MW-D12: the drawn arm poses from the WEAPON clip, not the idle', async () => {
  const arm = await drawnArm();
  arm.setSheathed(false);
  run(arm, (s) => s.upper === UPPER_BODY.WeaponEquipped);
  const idleTime = arm.status().time;
  assert.ok(idleTime >= 0.6 && idleTime <= 1.6, 'idling inside idle1h\'s window');
  arm.attack('StrikeDown');
  arm.update(0.05);
  const atkTime = arm.status().time;
  assert.ok(atkTime >= 2.5, 'and the attack clip takes the playhead');
  // Two slots, one winner: the idle did not stop, it was outvoted. When
  // the blow ends the playhead is back inside the idle's window.
  run(arm, (s) => s.upper === UPPER_BODY.WeaponEquipped);
  assert.ok(arm.status().time <= 1.6, 'the idle was still running underneath');
});

test('MW-D12: bare hands with no "handtohand" group idle plainly and REFUSE to swing', async () => {
  // The fixture deliberately has neither idlehh nor handtohand, which is
  // rule 9's not-a-real-weapon branch reached end to end. The arm must
  // not mime a sword swing with empty hands.
  const arm = createFpArm();
  arm.attach(fakeRenderer(), () => ({ pitch: 0 }));
  const res = await arm.build({ race: 'fprace', deps: fpDeps() });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  arm.setSheathed(false);
  assert.equal(arm.status().idleGroup, 'idle', 'the BARE idle, not idle1h');
  assert.equal(arm.status().weaponGroup, null);
  assert.equal(arm.status().upper, UPPER_BODY.WeaponEquipped, 'with no equip section to play');
  assert.equal(arm.attack('StrikeDown'), null, 'and no swing it could honestly draw');
  arm.update(0.05);
  assert.ok(arm.status().time <= 0.5, 'while the bare idle keeps running');
});

test('MW-D12: a HELD wind-up waits for release, and an unheld one does not', async () => {
  const arm = await drawnArm();
  arm.setSheathed(false);
  run(arm, (s) => s.upper === UPPER_BODY.WeaponEquipped);
  arm.attack('StrikeDown', { hold: true });
  // chop start 2.5 -> max attack 2.9. Run well past it.
  for (let i = 0; i < 40; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.AttackWindUp, 'held at full draw');
  assert.ok(Math.abs(arm.status().time - 2.9) < 1e-5, 'parked on "chop max attack"');
  assert.equal(arm.release(), true);
  arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.AttackRelease, 'and the release runs on the ask');
  assert.equal(arm.release(), false, 'a second release is a no-op');
});

test('MW-D12: clipCompletion is the window fraction the idle restart feeds back', () => {
  assert.equal(clipCompletion(null), 0);
  assert.equal(clipCompletion({ startTime: 0.6, stopTime: 1.6, time: 0.6 }), 0);
  assert.equal(clipCompletion({ startTime: 0.6, stopTime: 1.6, time: 1.6 }), 1);
  assert.ok(Math.abs(clipCompletion({ startTime: 0.6, stopTime: 1.6, time: 1.1 }) - 0.5) < 1e-9);
  assert.equal(clipCompletion({ startTime: 1, stopTime: 1, time: 1 }), 0, 'a zero-width window is 0, not NaN');
  assert.equal(clipCompletion({ startTime: 0.6, stopTime: 1.6, time: 9 }), 1, 'clamped');
});

test('MW-D12 rule 10: equip and unequip key names are the group\'s own, and are stated once', () => {
  assert.deepEqual(EQUIP_KEYS, { start: 'equip start', stop: 'equip stop', attach: 'equip attach' });
  assert.deepEqual(UNEQUIP_KEYS, { start: 'unequip start', stop: 'unequip stop', detach: 'unequip detach' });
  // And they really do reset against the fixture's weapon group.
  const keys = [
    { time: 2.0, text: 'weapononehand: equip start' },
    { time: 2.4, text: 'weapononehand: equip stop' },
  ];
  const s = resetClip(keys, 'weapononehand', { start: EQUIP_KEYS.start, stop: EQUIP_KEYS.stop });
  assert.equal(s.ok, true);
  assert.equal(s.startTime, 2.0);
  assert.equal(s.stopTime, 2.4);
  advanceClip(s, keys, 1.0, null);
  assert.equal(s.playing, false, 'and the equip section plays ONCE - no loopFallback');
});

test('MW-D12: weaponRig hands the strike to the arm instead of dropping it', () => {
  const rig = readFileSync(new URL('../src/combat/weaponRig.js', import.meta.url), 'utf8');
  // The two call sites that used to discard their return value.
  assert.match(rig, /const strike = !paralyzed && c\s*\n\s*\? playerWeapon\.gesture\(/,
    'the gesture result is kept');
  assert.match(rig, /const strike = playerWeapon\.clickAttack\(\);/, 'and so is the click\'s');
  assert.ok(rig.includes('fpArm.setSheathed(playerWeapon.sheathed)'),
    'and the stance is synced from the live flag every frame');
  // ONE HOME: the rig applies rules, it does not restate them.
  assert.ok(!/mwAttackType|composeStanceGroup|attackKeys/.test(rig),
    'the rig names no animation rule of its own');
});

test('MW-D12: the weapon RANGE is hidden, not repacked away', async () => {
  // showWeapons hides the node (rule 57's own distinction). Repacking
  // without the weapon would change the vertex buffer's length every
  // time you drew or sheathed, orphaning the ranges the textures hang
  // on - so the range stays and carries a flag the draw loop skips.
  const arm = await drawnArm();
  arm.update(0.05);
  const ranges = arm.mesh().ranges;
  const weapon = ranges.filter((r) => r.slot === 'weapon');
  assert.equal(weapon.length, 1, 'the weapon is one range of the same mesh');
  assert.equal(weapon[0].hidden, true, 'hidden while sheathed');
  const before = ranges.length;
  arm.setSheathed(false);
  run(arm, (s) => s.weaponShown);
  arm.update(0.05);
  assert.equal(arm.mesh().ranges.length, before, 'the range list never changes length');
  assert.equal(arm.mesh().ranges.filter((r) => r.slot === 'weapon')[0].hidden, false,
    'and the SAME range is shown again');
  assert.ok(ranges.some((r) => r.slot !== 'weapon' && r.hidden === false),
    'while the arm\'s own pieces are never hidden');
});

test('MW-D12: the renderer SKIPS a hidden range rather than drawing it', () => {
  const src = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  assert.match(src, /for \(const r of mesh\.ranges\) \{\n\s*\/\/[\s\S]*?if \(r\.hidden\) continue;/,
    'the skip is the FIRST thing in the range loop, before the texture bind');
});
