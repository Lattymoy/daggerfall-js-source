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
import { createWeaponRig, envAttack } from '../src/combat/weaponRig.js';
import { SOUND } from '../src/systems/soundClips.js';

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

test('weaponRig: classic starts sheathed; DrawWeapon 78 on unsheathing a real weapon only', () => {
  const r = rig();
  assert.equal(r.playerWeapon.sheathed, true, 'classic starts sheathed');
  r.toggleSheath();   // unsheathe the INTERIM dagger (a real weapon)
  assert.deepEqual(r._audio.played, [SOUND.DrawWeapon]);
  r.toggleSheath();   // sheathing back is silent
  assert.deepEqual(r._audio.played, [SOUND.DrawWeapon]);
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

test('weaponRig: envAttack - Receive(Attack) fires on EVERY action hit, the door included, then the bash', () => {
  // AUDIT 26 (parity F182). WeaponManager.WeaponEnvDamage (:457-471)
  // is two separate ifs with no else between them:
  //     action = hit.GetComponent<DaggerfallAction>();
  //     if (action) action.Receive(player, TriggerTypes.Attack);
  //     actionDoor = hit.GetComponent<DaggerfallActionDoor>();
  //     if (actionDoor) { actionDoor.AttemptBash(true); return true; }
  // An action door is ONE GameObject carrying BOTH components, so a
  // weapon hit fires its record AND bashes it, in that order. The pin
  // that stood here asserted the port's door branch (bash, return,
  // never Receive), which left every Attack/MultiTrigger door record -
  // the Castle Wayrest DoorText trespass check among them - unable to
  // fire on a hit: the bash path's own _execOwnAction only offers the
  // 'Door' trigger, which those flags reject.
  const mkActions = (kind) => {
    const calls = { order: [], bashed: 0, received: [] };
    const o = { key: 'k', kind, aabb: { min: [-0.5, 0, 1], max: [0.5, 2, 1.5] } };
    return {
      calls,
      actions: {
        objects: new Map([['k', o]]),
        attemptBash: () => { calls.bashed++; calls.order.push('bash'); },
        receive: (obj, trig) => { calls.received.push(trig); calls.order.push(`receive:${trig}`); },
      },
    };
  };
  const clear = { raycast: () => Infinity };
  const eye = [0, 1, 0], dir = [0, 0, 1];
  // A door: Receive(Attack) FIRST, then bashed, swing consumed (true).
  const d = mkActions('door');
  assert.equal(envAttack(d.actions, clear, eye, dir), true);
  assert.deepEqual(d.calls.order, ['receive:Attack', 'bash']);
  // A lever: Receive(Attack), no bash, swing continues (false).
  const l = mkActions('model');
  assert.equal(envAttack(l.actions, clear, eye, dir), false);
  assert.deepEqual(l.calls.order, ['receive:Attack']);
  // A wall in front occludes - nothing fires at all.
  const w = mkActions('door');
  assert.equal(envAttack(w.actions, { raycast: () => 0.4 }, eye, dir), false);
  assert.deepEqual(w.calls.order, []);
});

test('weaponRig: the bow cooldown does not hide the weapon - ShowWeapons, verbatim legs', () => {
  // AUDIT 26 (parity F024). WeaponManager.Update's cooldown gate is
  // `if (Time.time < cooldownTime) return;` (:229-232) and it sits
  // ABOVE every ShowWeapons call, so the early return leaves
  // ScreenWeapon.ShowWeapon at the true set at :290 - DFU shows a
  // steady idle bow through the whole ((10*(100-speed)+800)/980 s)
  // cooldown. The port hid it, so every shot blinked the bow off the
  // screen and popped it back. Nothing in DFU hides a weapon for the
  // cooldown; the cooldown only refuses the next attack, which the
  // machine already does (weaponStates.js machineAttack).
  const r = rig();
  r.playerWeapon.weapon = { name: 'Long Bow', templateIndex: 130, material: 0 };
  assert.equal(r.shown(), false, 'sheathed hides it (:283-289)');
  r.toggleSheath();
  assert.equal(r.shown(), true, 'unsheathed shows it (:290)');
  r.frame(1 / 60);                 // the machine learns the screen weapon is a bow
  const m = r.playerWeapon.machine;
  assert.equal(m.isBow, true);
  m.cooldownUntil = m.now + 1.3;   // a fresh loose's GetBowCooldownTime
  assert.equal(r.shown(), true, 'and it STAYS shown for the whole bow cooldown');
  // The other two legs are unchanged: a readied spell hides it
  // (HasReadySpell / IsPlayingAnim, :247-263).
  const s = rig({ spellArmed: () => true });
  s.toggleSheath();
  assert.equal(s.shown(), false);
});
