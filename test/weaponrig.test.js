// C9: the FP-weapon host rig - the surface every non-dungeon host
// mounts (interior mode + both exterior walk hosts). Pins mirror the
// AUDITED dungeon laws: classic starts sheathed, DrawWeapon 78 only
// on unsheathing a real weapon, no attack processing while sheathed,
// the drag-to-swing strike (soundless at entry - AUDIT 23 C9 moved
// the whoosh to the hosts' no-enemy hit frame, WeaponManager.cs:423),
// the zero-arrow
// bow auto-sheathe, and the WeaponEnvDamage ray (doors bash and
// consume, other action objects Receive(Attack)).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWeaponRig, envAttack } from '../src/combat/weaponRig.js';
import { SOUND } from '../src/systems/soundClips.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { equipSoundFor } from '../src/characters/weapons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const stubAudio = () => {
  const a = { played: [], playOneShot(id) { a.played.push(id); } };
  return a;
};
const CANVAS = { clientWidth: 1000, clientHeight: 800 };
const rig = (over = {}) => {
  const audio = stubAudio();
  const r = createWeaponRig({
    renderer: {}, canvas: CANVAS, fetchBytes: () => { throw new Error('no art in tests'); },
    palette: null,   // artFor returns null - draw stays inert headlessly
    audio, entity: { items: [] }, ...over,
  });
  r._audio = audio;
  return r;
};

test('weaponRig: classic starts sheathed; the WEAPON\'S OWN equip sound on unsheathing (F023)', () => {
  // AUDIT 26 F023: FPSWeapon plays DrawWeaponSound, which
  // WeaponManager.SetWeapon (:780) overwrites with the item's
  // GetEquipSound on every applied weapon - so the declared 78
  // default never survives a real weapon, and this pin used to hold
  // the port's single clip rather than DFU's eight.
  const r = rig();
  assert.equal(r.playerWeapon.sheathed, true, 'classic starts sheathed');
  r.toggleSheath();   // unsheathe the INTERIM dagger (a real weapon)
  assert.deepEqual(r._audio.played, [SOUND.EquipShortBlade], 'a dagger is a SHORT blade');
  r.toggleSheath();   // sheathing back is silent
  assert.deepEqual(r._audio.played, [SOUND.EquipShortBlade]);
});

test('weaponRig F023: the clip follows the weapon TYPE, and falls back for the typeless', () => {
  const worn = (templateIndex) => ({
    items: [], equip: { slots: { [EQUIP_SLOTS.RightHand]: { templateIndex } } },
  });
  const drawOf = (templateIndex) => {
    const r = rig({ entity: worn(templateIndex) });
    r.toggleSheath();
    return r._audio.played;
  };
  assert.deepEqual(drawOf(122), [SOUND.EquipTwoHandedBlade], 'a Claymore is TWO-HANDED - not the long blade its swing groups with');
  assert.deepEqual(drawOf(120), [SOUND.EquipLongBlade], 'a Longsword is a long blade');
  assert.deepEqual(drawOf(127), [SOUND.EquipAxe], 'a Battle Axe');
  assert.deepEqual(drawOf(125), [SOUND.EquipFlail], 'a Flail has its own clip');
  assert.deepEqual(drawOf(126), [SOUND.EquipMaceOrHammer], 'a Warhammer shares the mace clip');
  assert.deepEqual(drawOf(115), [SOUND.EquipStaff], 'a Staff');
  assert.deepEqual(drawOf(130), [SOUND.EquipBow], 'a Long Bow');
  // SoundClips.None at the LAW's level: an Arrow is in the Weapons
  // group but hits GetEquipSound's `default:`. It cannot be observed
  // through the rig - toggleSheath's real-weapon gate never draws one
  // - so the fallback is pinned where it lives.
  assert.equal(equipSoundFor({ templateIndex: 131 }), null, 'an Arrow has no equip clip of its own');
  assert.equal(equipSoundFor(null), null);
  assert.equal(equipSoundFor({ werecreatureClaws: true }), null, 'the claws draw silently (V4)');
});

test('weaponRig: sheathed = no attack processing; a drag swings SILENTLY and reaches the hit frame', () => {
  const r = rig();
  // Sheathed: the buffered drag must never start a strike.
  r.attackInput(900, 0, true);
  r.frame(1 / 60);
  assert.equal(r.playerWeapon.machine.state, 'Idle');
  // Unsheathed: a right-drag past the threshold enters a Strike state.
  // AUDIT 23 (C9): entry plays NOTHING - DFU's swing sound fires at
  // the hit frame of a no-enemy swing, which is the HOST's arm, not
  // the rig's.
  r.toggleSheath();
  r.attackInput(900, 0, true);
  r.frame(1 / 60);
  assert.ok(r.playerWeapon.machine.state.startsWith('Strike'), `state ${r.playerWeapon.machine.state}`);
  assert.equal(r._audio.played.length, 1, 'DrawWeapon only - no strike-entry whoosh');
  // The machine reaches its hit frame within the strike.
  let hit = false;
  for (let f = 0; f < 120 && !hit; f++) hit = r.frame(1 / 60).includes('hit');
  assert.ok(hit, 'the strike frame fires');
  // Paralysis holds the machine (no events, no gesture consume).
  assert.deepEqual(r.frame(1 / 60, { paralyzed: true }), []);
});

test('weaponRig: clickAttack carries the sheathed gate (the C10 fold fix - the inline touch tap bypassed it)', () => {
  const r = rig();
  r.clickAttack();
  assert.equal(r.playerWeapon.machine.state, 'Idle', 'a sheathed tap never swings');
  r.toggleSheath();
  r.clickAttack();
  assert.ok(r.playerWeapon.machine.state.startsWith('Strike'), 'the unsheathed tap swings in a random direction');
});

test('weaponRig: an unsheathed bow with zero arrows auto-sheathes with the classic line', () => {
  const lines = [];
  const r = rig({ say: (l) => lines.push(l) });
  r.playerWeapon.weapon = { name: 'Short Bow', templateIndex: 129, material: 0 };
  r.toggleSheath();
  assert.equal(r.playerWeapon.sheathed, false);
  r.draw();   // the guard runs from the draw path
  assert.equal(r.playerWeapon.sheathed, true);
  assert.deepEqual(lines, ['You have no arrows.']);
});

test('weaponRig: envAttack - a door in reach bashes and consumes; others Receive(Attack); walls occlude', () => {
  const mkActions = (kind) => {
    const calls = { bashed: 0, received: [] };
    const o = { key: 'k', kind, aabb: { min: [-0.5, 0, 1], max: [0.5, 2, 1.5] } };
    return {
      calls,
      actions: {
        objects: new Map([['k', o]]),
        attemptBash: () => { calls.bashed++; },
        receive: (obj, trig) => { calls.received.push(trig); },
      },
    };
  };
  const clear = { raycast: () => Infinity };
  const eye = [0, 1, 0], dir = [0, 0, 1];
  // A door: Receive(Attack) FIRST, then bashed, swing consumed (true).
  // FX1 (F182): DFU's WeaponEnvDamage fires Receive on ANY struck
  // action object before the door check (:458-472) - an action door
  // is one GameObject with both components - so an Attack- or
  // MultiTrigger-flagged door record fires on every weapon hit.
  const d = mkActions('door');
  assert.equal(envAttack(d.actions, clear, eye, dir), true);
  assert.equal(d.calls.bashed, 1);
  assert.deepEqual(d.calls.received, ['Attack'], 'the door record hears the Attack trigger too');
  // A lever: Receive(Attack), swing continues (false).
  const l = mkActions('model');
  assert.equal(envAttack(l.actions, clear, eye, dir), false);
  assert.deepEqual(l.calls.received, ['Attack']);
  // A wall in front occludes - nothing fires.
  const w = mkActions('door');
  assert.equal(envAttack(w.actions, { raycast: () => 0.4 }, eye, dir), false);
  assert.equal(w.calls.bashed, 0);
  assert.deepEqual(w.calls.received, []);
});

test('FX1 (F024/F025): the show clocks - the bow cooldown FREEZES the state, an equip countdown shows empty hands', () => {
  const rig = readFileSync(join(ROOT, 'src', 'combat', 'weaponRig.js'), 'utf8');
  // F024: WeaponManager.Update RETURNS EARLY on cooldown (:230-233),
  // leaving ShowWeapon at its prior value - the latch is that value.
  // The old code hid the bow through the ~1.3s cooldown (blink).
  assert.match(rig, /if \(m\.isBow && m\.now < m\.cooldownUntil\) return _lastShown;/);
  assert.match(rig, /let _lastShown = false;/);
  // F025: a running equip countdown shows EMPTY HANDS (:275-281) -
  // the port drew the new weapon while refusing attacks.
  assert.match(rig, /else if \(\(entity\?\.equipCountdown \?\? 0\) > 0\) v = false;/);
  // and the latch records every non-cooldown answer
  assert.match(rig, /_lastShown = v;\n\s+return v;/);
});

// ── THE BOW'S PATH INTO THE MORROWIND ARM ────────────────────────────
//
// Mac: "the arrow doesn't show on the weapon being readied and fired,
// instead the shot shoots like classic dagger and doesn't follow the
// animation." Chasing it found the seam UNPINNED at both ends:
// mwarrow.test.js drives arm.attack() DIRECTLY, and this file pinned
// the machine without ever asking what the arm was handed. So a bow
// could swing on the melee path and every suite stayed green.
//
// AND THE FIRST DIAGNOSIS OFF THIS HARNESS WAS WRONG, which is the
// reason the idle loop below is not decoration. Attacking on the very
// first frame reads machine.isBow ONE FRAME STALE - update() is what
// sets it (playerWeapon.js:258, "read per step"), and update() runs
// AFTER gesture() inside frame(). The bow swings StrikeRight on the
// melee clock, and it looks exactly like the reported bug. It is not
// the bug: real play has frames between drawing and shooting. The pin
// holds BOTH readings so the distinction cannot be lost again - the
// stale one as the artifact it is, the settled one as the law.
test('the drawn bow reaches the Morrowind arm as a SHOOT, on the bow clock', async () => {
  const { fpArm } = await import('../src/combat/fpArm.js');
  const LONG_BOW = { name: 'Long Bow', templateIndex: 130, material: 0 };
  const ARROWS = { name: 'Arrow', templateIndex: 131, stackCount: 20 };
  const calls = [];
  const saved = { ready: fpArm.ready, attack: fpArm.attack };
  // The arm's own nock cycle is pinned in mwarrow.test.js against real
  // key times; what is NOT pinned anywhere is that the rig ever calls
  // it for a bow, so the stand-in only has to be READY and record.
  fpArm.ready = () => true;
  fpArm.attack = (strike, opts) => { calls.push({ strike, opts }); return 'shoot'; };
  try {
    const r = rig({ entity: { items: [ARROWS], equip: { slots: { [EQUIP_SLOTS.RightHand]: LONG_BOW } } } });
    r.toggleSheath();
    assert.equal(r.playerWeapon.machine.isBow, false,
      'isBow is not set until a step runs - update() owns it, per step');

    // THE ARTIFACT, pinned as one: attacking before any step has run
    // reads that stale false and takes the MELEE gesture.
    r.attackInput(900, 0, true);
    r.frame(1 / 60);
    assert.equal(calls[0].strike, 'StrikeRight',
      'a same-frame attack swings the bow on the melee path - the harness artifact, not the bug');

    // THE LAW: let the rig step, the way play does between drawing and
    // shooting, and the bow takes its own branch.
    const r2 = rig({ entity: { items: [ARROWS], equip: { slots: { [EQUIP_SLOTS.RightHand]: LONG_BOW } } } });
    r2.toggleSheath();
    for (let i = 0; i < 30; i++) r2.frame(1 / 60);
    assert.equal(r2.playerWeapon.machine.isBow, true, 'a step settles it');

    calls.length = 0;
    const evs = [];
    r2.attackInput(900, 0, true);
    for (let i = 0; i < 60; i++) {
      for (const e of r2.frame(1 / 60)) evs.push(e);
      if (i === 0) r2.attackInput(900, 0, false);
    }
    // WeaponManager.cs:355-358 - a bow never tracks a swing; the input
    // fires forced to StrikeDown. `hold` stays false because the port's
    // bow is DFU's BowDrawback-OFF instant shot.
    assert.equal(calls.length, 1, 'the arm is told once');
    assert.equal(calls[0].strike, 'StrikeDown', 'forced to StrikeDown, not the drag direction');
    assert.equal(calls[0].opts.hold, false, 'BowDrawback-off does not hold at full draw');
    // AUDIT 23 (combat-2): the bow's OWN clock - bowSound at frame 4,
    // hit at frame 5. A bow on the melee clock has no bowSound at all,
    // which is what makes this the check that separates them.
    assert.ok(evs.includes('bowSound'), 'the bow clock ran, not the melee one');
    assert.ok(evs.includes('hit'), 'and it reached the loose');
  } finally {
    fpArm.ready = saved.ready;
    fpArm.attack = saved.attack;
  }
});

// MW-D42: THE LOOSE WAITS FOR THE ARM (Mac: the 3D Morrowind bow
// "damages on click instead of following the bow animation"). The
// machine's 'hit' for a bow is frame 5 of the classic release, which
// has nothing to do with the animation the player is watching. It is
// HELD now and let go at rule 24's "shoot release" - but only for a
// bow, only while the arm is active, and never swallowed.
test('MW-D42: the bow\'s hit is held for the arm\'s release, and never swallowed', async () => {
  const { fpArm } = await import('../src/combat/fpArm.js');
  const LONG_BOW = { name: 'Long Bow', templateIndex: 130, material: 0 };
  const ARROWS = { name: 'Arrow', templateIndex: 131, stackCount: 20 };
  const saved = {
    ready: fpArm.ready, attack: fpArm.attack, active: fpArm.active, thirdActive: fpArm.thirdActive,
    take: fpArm.takeShootRelease, update: fpArm.update, release: fpArm.release,
    setWeapon: fpArm.setWeapon, setSheathed: fpArm.setSheathed, setWorn: fpArm.setWorn,
    readySpell: fpArm.readySpell,
  };
  let released = false;
  let armActive = true;
  let thirdActive = false;
  fpArm.ready = () => true;
  fpArm.active = () => armActive;
  fpArm.thirdActive = () => thirdActive;
  fpArm.attack = () => 'shoot';
  fpArm.takeShootRelease = () => { if (!released) return false; released = false; return true; };
  for (const k of ['update', 'release', 'setSheathed', 'setWorn', 'readySpell']) fpArm[k] = () => {};
  fpArm.setWeapon = () => true;
  const bowRig = () => {
    const r = rig({ entity: { items: [ARROWS], equip: { slots: { [EQUIP_SLOTS.RightHand]: LONG_BOW } } } });
    r.toggleSheath();
    for (let i = 0; i < 30; i++) r.frame(1 / 60);
    return r;
  };
  const shoot = (r, frames, onFrame = () => {}) => {
    const evs = [];
    r.attackInput(900, 0, true);
    for (let i = 0; i < frames; i++) {
      for (const e of r.frame(1 / 60)) evs.push(e);
      if (i === 0) r.attackInput(900, 0, false);
      onFrame(i);
    }
    return evs;
  };
  try {
    // THE LAW: no hit while the arm is still drawing.
    const r = bowRig();
    const early = shoot(r, 40);
    assert.ok(!early.includes('hit'), 'the classic frame-5 hit is HELD, not fired on the click');
    // MW-D42d: AND SO IS ITS SOUND. bowSound is frame 4 and the hit is
    // frame 5 - one 0.0625 tick apart, the same instant to an ear.
    // MW-D42 held the hit and let the sound through, so the string was
    // heard before the arrow left by the whole length of the draw.
    assert.ok(!early.includes('bowSound'), 'the loose SOUND is held with the loose');
    // ...and it lands the moment the arm looses.
    released = true;
    const evs = [];
    for (const e of r.frame(1 / 60)) evs.push(e);
    assert.ok(evs.includes('hit'), 'the arm\'s "shoot release" lets the hit go');
    assert.ok(evs.includes('bowSound'), 'and the sound goes with it, not before it');
    assert.ok(evs.indexOf('bowSound') < evs.indexOf('hit'),
      'sound then hit - the machine\'s own frame 4 / frame 5 order, preserved');
    // ONCE. takeShootRelease consumes, so a held flag cannot fire twice.
    const after = [];
    for (let i = 0; i < 20; i++) for (const e of r.frame(1 / 60)) after.push(e);
    assert.ok(!after.includes('hit'), 'and exactly once');

    // NEVER-TRAPS: an arm that never signals still gets its shot off,
    // late rather than never. This is the whole reason the ceiling
    // exists - a .kf without rule 24's release key must not delete
    // archery from the game.
    released = false;
    const r2 = bowRig();
    const silent = shoot(r2, 200);
    assert.ok(silent.includes('hit'), 'a silent arm falls through to the ceiling rather than swallowing the shot');

    // AND THE CLASSIC PATH IS UNTOUCHED. With no arm active the hit
    // rides the machine exactly as it always has - this is the check
    // that stops the fix leaking onto the 2D skin.
    armActive = false;
    const r3 = bowRig();
    const classic = shoot(r3, 40);
    assert.ok(classic.includes('hit'), 'no arm, no hold - the classic bow is exactly as it was');
    assert.ok(classic.includes('bowSound'), 'and its sound rides the machine\'s own frame 4');

    // MW-D42c: AND THE WHEEL DOES NOT CHANGE THE LAW (Mac: "in third
    // person, clicking instantly triggers the attack, unlike the
    // changes we made to first person"). active() is the FIRST-person
    // predicate by construction, so the hold silently switched off the
    // moment the view turned and the click fired the classic frame-5
    // hit again. The question is whether the ARM is animating, not
    // which pass draws it. armActive is still false here, so this is
    // the third-person branch ALONE.
    thirdActive = true;
    released = false;
    const r4 = bowRig();
    const third = shoot(r4, 40);
    assert.ok(!third.includes('hit'), 'third person holds the hit exactly as first person does');
    assert.ok(!third.includes('bowSound'), 'and holds its sound with it');
    released = true;
    const landed = [];
    for (const e of r4.frame(1 / 60)) landed.push(e);
    assert.ok(landed.includes('hit'), 'and the release lets it go in that view too');
    thirdActive = false;
  } finally {
    Object.assign(fpArm, saved);
  }
});
