// C9: the FP-weapon host rig - the surface every non-dungeon host
// mounts (interior mode + both exterior walk hosts). Pins mirror the
// AUDITED dungeon laws: classic starts sheathed, DrawWeapon 78 only
// on unsheathing a real weapon, no attack processing while sheathed,
// the drag-to-swing strike with its swing-sound edge, the zero-arrow
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

test('weaponRig: sheathed = no attack processing; a drag swings with the sound edge and reaches the hit frame', () => {
  const r = rig();
  // Sheathed: the buffered drag must never start a strike.
  r.attackInput(900, 0, true);
  r.frame(1 / 60);
  assert.equal(r.playerWeapon.machine.state, 'Idle');
  // Unsheathed: a right-drag past the threshold enters a Strike state
  // and the entering edge plays the pitch-matched swing sound.
  r.toggleSheath();
  r.attackInput(900, 0, true);
  r.frame(1 / 60);
  assert.ok(r.playerWeapon.machine.state.startsWith('Strike'), `state ${r.playerWeapon.machine.state}`);
  assert.equal(r._audio.played.length, 2, 'DrawWeapon + the swing sound');
  // The machine reaches its hit frame within the strike.
  let hit = false;
  for (let f = 0; f < 120 && !hit; f++) hit = r.frame(1 / 60).includes('hit');
  assert.ok(hit, 'the strike frame fires');
  // Paralysis holds the machine (no events, no gesture consume).
  assert.deepEqual(r.frame(1 / 60, { paralyzed: true }), []);
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
  // A door: bashed, swing consumed (true).
  const d = mkActions('door');
  assert.equal(envAttack(d.actions, clear, eye, dir), true);
  assert.equal(d.calls.bashed, 1);
  // A lever: Receive(Attack), swing continues (false).
  const l = mkActions('model');
  assert.equal(envAttack(l.actions, clear, eye, dir), false);
  assert.deepEqual(l.calls.received, ['Attack']);
  // A wall in front occludes - nothing fires.
  const w = mkActions('door');
  assert.equal(envAttack(w.actions, { raycast: () => 0.4 }, eye, dir), false);
  assert.equal(w.calls.bashed, 0);
});
