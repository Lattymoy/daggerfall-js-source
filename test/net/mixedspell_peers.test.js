// AUDIT MIXED-PAIR L4-3 / AUDIT SPELL-HAND L4-2 (bible/01-Overview/audits/Audit-Mixed-Pair-Spell-Hand.md; bible/05-Combat/
// Two-Hands.md, "Peers on the wire"): THE OTHERS SEE THE HANDS. A peer's body held the lead hand's one weapon - a
// blade-and-Pistolet pair's shot played as a sword blow, a blade's as a shot - and a spell beside a weapon stood the body
// in the Spell stance with the weapon out of the hand and played none of its blows. The look carries both hands; the pose
// carries `ah` (world251), the hand a pair's last strike was; the peer reads both by the local rig's own laws
// (net/peer/peerBodies.js peerHandsOf).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validPose, poseChanged } from '../../src/net/wire.js';
import { lerpPose } from '../../src/net/online.js';
import { peerHandsOf, peerBuildOpts, PeerBodies } from '../../src/net/peer/peerBodies.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { PISTOLET_TEMPLATE } from '../../src/characters/thunderlockIds.js';

const P = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
const sword = { templateIndex: 120, group: 'Weapons', material: 0, equipSlot: EQUIP_SLOTS.RightHand };
const gunL = { templateIndex: PISTOLET_TEMPLATE, group: 'Weapons', material: 4, equipSlot: EQUIP_SLOTS.LeftHand };
const buckler = { templateIndex: 109, group: 'Armor', material: 0, equipSlot: EQUIP_SLOTS.LeftHand };
const look = (items) => ({ race: 'Breton', gender: 'male', faceIndex: 0, items });

test('AUDIT MIXED-PAIR L4-3 THE WIRE: `ah` - a pair\'s left hand struck last - survives the door and the ease, and is OMITTED at 0 (a pose with no left blow keeps its bytes) (mutants: the field dropped at the door; dropped by the ease)', () => {
  const base = validPose(P);
  assert.equal('ah' in base, false);
  assert.equal(JSON.stringify(validPose({ ...P, ah: 0 })), JSON.stringify(base), 'zero serializes to the old bytes');
  assert.equal(validPose({ ...P, ah: 1 }).ah, 1);
  assert.equal(validPose({ ...P, ah: 7 }).ah, 1, 'clamped');
  assert.equal(lerpPose(validPose(P), validPose({ ...P, ah: 1 }), 0.5).ah, 1);
  assert.equal('ah' in lerpPose(validPose(P), validPose(P), 0.5), false);
  assert.ok(poseChanged(validPose({ ...P, an: 1 }), validPose({ ...P, an: 2, ah: 1 })), 'it rides the swing\'s own edge');
});

test('AUDIT MIXED-PAIR L4-3 / SPELL-HAND L4-2 THE PEER\'S HANDS (peerHandsOf): a blade and a Pistolet are a pair (both hands, the lead off `lh`); one weapon with the other hand empty and a spell readied and drawn is the spell hand; a shield, a light in hand, a sheathed weapon or no spell are not (mutants: the pair read off one hand; the spell hand blind to the light)', () => {
  const mixed = look([sword, gunL]);
  assert.deepEqual(peerHandsOf(mixed, { lh: 1 }), { dual: true, lead: 'L', right: sword, left: gunL, spellHand: false });
  const one = look([sword]);
  assert.equal(peerHandsOf(one, { wd: 1, sr: 1 }).spellHand, true, 'a spell beside the drawn sword');
  assert.equal(peerHandsOf(one, { wd: 0, sr: 1 }).spellHand, false, 'sheathed: DFU\'s two hands');
  assert.equal(peerHandsOf(one, { wd: 1, sr: 0 }).spellHand, false, 'no spell');
  assert.equal(peerHandsOf(one, { wd: 1, sr: 1, lt: 9 }).spellHand, false, 'a lit light in the free hand');
  assert.equal(peerHandsOf(one, { wd: 1, sr: 1, lt: 9, hl: 1 }).spellHand, true, 'a lantern at the waist is in no hand');
  assert.equal(peerHandsOf(look([sword, buckler]), { wd: 1, sr: 1 }).spellHand, false, 'a shield');
  assert.equal(peerHandsOf(look([sword, buckler]), {}).dual, false, 'a sword and a shield: one hand');
});

test('AUDIT MIXED-PAIR L4-3 / SPELL-HAND L4-2 THE PEER\'S BODY (PeerBodies._arm, the rig\'s own doors): a pair held in both hands - the right hand\'s weapon, the left mirrored, the lead - and each strike played with the hand the pose says (`ah`); a spell beside a weapon told to the rig BEFORE its stance (mutants: the hands never told; the strike\'s hand dropped; the spell hand untold)', () => {
  const calls = [];
  const rig = {
    setSheathed() {}, release() {}, upperBodyReady: () => true,
    setWeapon: (w) => { calls.push(['weapon', w?.templateIndex ?? null]); return true; },
    setOffWeapon: (w) => { calls.push(['off', w?.templateIndex ?? null]); },
    setHands: (h) => { calls.push(['hands', `${h.mode}:${h.lead}`]); },
    setSpellHand: (on) => { calls.push(['spellHand', on]); },
    readySpell: (on) => { calls.push(['ready', on]); },
    attack: (strike, o) => { calls.push(['attack', o.hand]); return true; },
  };
  const pb = new PeerBodies({ renderer: {}, createRig: () => ({}), buildOpts: peerBuildOpts });
  const mixed = look([sword, gunL]);
  const b = { weapon: null, ammo: 0, held: false, swing: null, cast: null, rig };
  pb._arm(b, { wd: 1, an: 0, cn: 0 }, mixed);
  assert.deepEqual(calls.filter(([k]) => k === 'weapon' || k === 'off' || k === 'hands').slice(0, 3), [['weapon', 120], ['hands', 'dual:R'], ['off', PISTOLET_TEMPLATE]]);
  calls.length = 0;
  pb._arm(b, { wd: 1, an: 1, cn: 0, ah: 1 }, mixed);
  assert.deepEqual(calls.filter(([k]) => k === 'attack'), [['attack', 'L']], 'the left hand\'s shot, as the left\'s');
  calls.length = 0;
  pb._arm(b, { wd: 1, an: 2, cn: 0 }, mixed);
  assert.deepEqual(calls.filter(([k]) => k === 'attack'), [['attack', 'R']], 'the right hand\'s blow');
  // one weapon: no hand on the strike (the arm draws it in its right hand), and the spell hand told before the stance
  calls.length = 0;
  const one = { weapon: null, ammo: 0, held: false, swing: null, cast: null, rig };
  pb._arm(one, { wd: 1, an: 0, cn: 0, sr: 1 }, look([sword]));
  const order = calls.filter(([k]) => k === 'spellHand' || k === 'ready');
  assert.deepEqual(order, [['spellHand', true], ['ready', true]], 'the spell in the free hand, then the stance');
  calls.length = 0;
  pb._arm(one, { wd: 1, an: 1, cn: 0, sr: 1 }, look([sword]));
  assert.deepEqual(calls.filter(([k]) => k === 'attack'), [['attack', null]], 'a single hand\'s blow names no hand');
});
