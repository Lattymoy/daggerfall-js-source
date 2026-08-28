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
