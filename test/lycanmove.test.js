// LM1 - THE TRANSFORMED MOVE SOUND (2026-08-29).
//
// LycanthropyEffect.cs:201-211 + :586-604, the last member of that
// effect the port had not carried - the ledger's own vampirism row
// named it as one of two STILL OPEN clauses, and lycanthropy.js
// carried the flag.
//
// While transformed, and only while transformed, a real-time timer
// counts down; on expiry the beast makes its move noise and the timer
// re-arms to a fresh Random.Range(4, 20) seconds. It is what makes
// walking around as a werewolf sound like anything at all - the port
// had the attack voices and the claws and nothing between them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLycanthropyCurse, morphSelf, lycanthropeMoveSound, liveLycanthropy,
  MOVE_SOUND_MIN_SECONDS, MOVE_SOUND_MAX_SECONDS,
} from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { SOUND } from '../src/systems/soundClips.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

/** The same player shape lycanthropy.test.js builds - morphSelf
 *  unequips both hands, so a hand-built stub without an equip table
 *  throws inside unequipSlot rather than testing anything. */
const P = () => ({
  isPlayer: true, level: 5, activeEffects: [],
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: {}, health: 60, maxHealth: 60, items: [], spells: [],
});
const beast = (type = LYCANTHROPY_TYPES.Werewolf, { transformed = true } = {}) => {
  const e = P();
  createLycanthropyCurse(e, type, { now: 0, rolls: () => 0 });   // armed at the 4s minimum
  // AUDIT 39: the morph RE-ARMS the timer (LycanthropyEffect.cs:521),
  // so every morphSelf in this file feeds it the roll it should draw -
  // an unfed one takes Math.random and the countdown stops being a pin.
  if (transformed) morphSelf(e, { force: true, nowMinutes: 0, rolls: () => 0 });
  return e;
};
/** Drive the loop and collect what it played over `seconds` of frames. */
function run(entity, seconds, dt, rolls) {
  const played = [];
  for (let t = 0; t < seconds; t += dt) {
    const c = lycanthropeMoveSound(entity, dt, rolls);
    if (c != null) played.push(+(t + dt).toFixed(3));
  }
  return played;
}

test('LM1: the clips are the werewolf/wereboar MOVE records, by infection type', () => {
  assert.equal(SOUND.EnemyWerewolfMove, 142, 'SoundClips.cs:213');
  assert.equal(SOUND.EnemyWereboarMove, 157, 'SoundClips.cs:233');
  // and they are NOT the attack voices the port already had
  assert.notEqual(SOUND.EnemyWerewolfMove, SOUND.EnemyWerewolfAttack);
  const wolf = beast(LYCANTHROPY_TYPES.Werewolf);
  const boar = beast(LYCANTHROPY_TYPES.Wereboar);
  // roll 0 arms the minimum band; one frame past it fires
  assert.equal(run(wolf, 5, 4.5, () => 0)[0], 4.5);
  // the timer is armed at the CURSE (Start), so the very first frame
  // already counts down - no frame is burned arming it
  assert.equal(lycanthropeMoveSound(beast(LYCANTHROPY_TYPES.Werewolf), 5, () => 0), SOUND.EnemyWerewolfMove,
    'a first frame longer than the armed wait fires on that frame');
  const wolfPlayed = [];
  for (let i = 0; i < 3; i++) { const c = lycanthropeMoveSound(wolf, 5, () => 0); if (c != null) wolfPlayed.push(c); }
  assert.deepEqual(wolfPlayed, [SOUND.EnemyWerewolfMove, SOUND.EnemyWerewolfMove, SOUND.EnemyWerewolfMove]);
  lycanthropeMoveSound(boar, 0, () => 0);
  assert.equal(lycanthropeMoveSound(boar, 5, () => 0), SOUND.EnemyWereboarMove, 'the boar has its own');
});

test('LM1: the wait is Random.Range(4, 20) and RE-ARMS every time', () => {
  assert.equal(MOVE_SOUND_MIN_SECONDS, 4);
  assert.equal(MOVE_SOUND_MAX_SECONDS, 20);
  // a scripted roll queue: 0 -> 4s, 1 -> 20s, 0.5 -> 12s
  const q = [0, 1, 0.5];
  let i = 0;
  const rolls = () => q[Math.min(i++, q.length - 1)];
  // the SAME queue arms the curse, the MORPH and every re-arm - Start's
  // draw is the first one, so a helper that armed with its own roll
  // would shift the whole sequence by one
  const e = P();
  createLycanthropyCurse(e, LYCANTHROPY_TYPES.Werewolf, { now: 0, rolls });
  morphSelf(e, { force: true, nowMinutes: 0, rolls });
  const fired = run(e, 40, 0.5, rolls);
  // AUDIT 39 moved this pin: MorphSelf's transform branch draws too
  // (LycanthropyEffect.cs:521), so the curse's 4 (roll 0) is thrown
  // away at the change and the countdown starts from the morph's 20
  // (roll 1). At 20.0 the timer is EXACTLY 0 and DFU's test is
  // `moveSoundTimer < 0`, not <=, so it waits one more frame: 20.5.
  // Re-armed to 12 (roll 0.5) there -> exactly 0 at 32.5, fires at 33.
  // The next 12 (the queue's last value repeats) would land at 45.5,
  // past the 40 seconds walked.
  assert.deepEqual(fired, [20.5, 33],
    'each wait is a fresh draw across the whole band, not a fixed cadence');
});

test('LM1: a timer landing EXACTLY on zero waits one more frame (`< 0`, not `<= 0`)', () => {
  const e = P();
  createLycanthropyCurse(e, LYCANTHROPY_TYPES.Werewolf, { now: 0, rolls: () => 0 });   // armed at 4
  morphSelf(e, { force: true, nowMinutes: 0, rolls: () => 0 });   // re-armed at 4 (:521)
  assert.equal(lycanthropeMoveSound(e, 4, () => 0), null, '4 seconds leaves the timer at 0, which is not yet');
  assert.equal(lycanthropeMoveSound(e, 0.001, () => 0), SOUND.EnemyWerewolfMove, 'and any further frame fires it');
});

// AUDIT 39 MOVED THIS PIN. It read "resumes where it left off", on the
// strength of a note in lycanthropy.js claiming DFU re-arms only at the
// curse. It does not: LycanthropyEffect.cs:519-521 calls
// InitMoveSoundTimer inside MorphSelf's `if (!isTransformed)` branch,
// right after the compound-race name swap - a third call site beside
// the constructor (:67) and the post-fire re-arm (:209). So a partial
// wait is never resumed across a change; every morph into beast form
// starts a fresh 4-20s.
test('LM1/AUDIT 39: an UNTRANSFORMED lycanthrope does not tick, and the morph RE-ARMS the wait', () => {
  const e = beast(LYCANTHROPY_TYPES.Werewolf);    // armed at 4 by the curse, re-armed at 4 by the morph
  assert.equal(lycanthropeMoveSound(e, 3, () => 0), null, '3s in, not yet');
  morphSelf(e, { force: true, nowMinutes: 0, rolls: () => 0 });   // back to human (no re-arm on that arm)
  // a minute of frames as a human moves the timer not at all
  for (let t = 0; t < 60; t += 0.5) {
    assert.equal(lycanthropeMoveSound(e, 0.5, () => 0), null, 'a human lycanthrope is silent');
  }
  morphSelf(e, { force: true, nowMinutes: 2000, rolls: () => 0.5 });   // beast again: a FRESH 12s draw
  assert.equal(lycanthropeMoveSound(e, 1.5, () => 0), null, 'the old wait had 1s left; this one has 12');
  assert.equal(lycanthropeMoveSound(e, 11, () => 0), SOUND.EnemyWerewolfMove, 'and it fires 12s after the change');
});

test('LM1: a non-lycanthrope is never asked for a sound', () => {
  assert.equal(lycanthropeMoveSound({ activeEffects: [] }, 5, () => 0), null);
  assert.equal(lycanthropeMoveSound(null, 5, () => 0), null);
  assert.equal(lycanthropeMoveSound(undefined, 5, () => 0), null);
});

test('LM1: the timer is armed at CURSE START, not at the first transform', () => {
  // InitMoveSoundTimer runs in Start (:67). The entry carries the
  // field from creation so the first howl after a morph is part-way
  // through its wait rather than a fresh 4-20s from the change.
  const e = P();
  const entry = createLycanthropyCurse(e, LYCANTHROPY_TYPES.Werewolf, { now: 0, rolls: () => 0 });
  assert.equal(entry.moveSoundTimer, MOVE_SOUND_MIN_SECONDS, 'ARMED at creation, not left null');
  const mid = createLycanthropyCurse(P(), LYCANTHROPY_TYPES.Werewolf, { now: 0, rolls: () => 0.5 });
  assert.equal(mid.moveSoundTimer, 12, 'and it is a real draw across the band');
  assert.match(read('src/systems/lycanthropy.js'), /InitMoveSoundTimer runs in Start \(:67\) - at the CURSE/);
  // a curse restored from a pre-LM1 save has no timer: arm it rather
  // than counting down from undefined for ever
  const old = beast();
  delete liveLycanthropy(old).moveSoundTimer;
  assert.equal(lycanthropeMoveSound(old, 999, () => 0), null, 'the restore path arms instead of firing');
  assert.equal(lycanthropeMoveSound(old, 5, () => 0), SOUND.EnemyWerewolfMove, 'and works from then on');
});

test('LM1: all four hosts tick it - the FOUR HOSTS RULE', () => {
  const call = /\{ const mv = lycanthropeMoveSound\(playerEntity, dt\); if \(mv != null\) audio\.playOneShot\(mv, 1\); \}/;
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js',
    'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) {
    const src = read(f);
    assert.match(src, call, `${f} ticks the loop`);
    assert.match(src, /lycanthropeMoveSound/, `${f} imports it`);
  }
  // worldModes' arm is the INTERIOR one and must not sit behind the
  // cast engine - the beast makes its noise whether or not one exists
  const wm = read('src/scenes/worldModes.js');
  const at = wm.indexOf('{ const mv = lycanthropeMoveSound');
  const before = wm.slice(Math.max(0, at - 400), at);
  assert.match(before, /\n {4}\}\n/, 'it sits after the `if (magic)` block closes, not inside it');
});

test('LM1: the flag is retired, and nothing still says the loop pends', () => {
  const src = read('src/systems/lycanthropy.js').replace(/"[^"]*"/g, '""');
  assert.equal(/the 4-20s real-time MOVE sound loop while transformed - the one/.test(src), false);
  assert.match(src, /LM1 SHIPPED THE LAST MEMBER/);
  // and the claim has no second home in the tree
  for (const f of ['src/systems/vampirism.js', 'src/systems/infection.js']) {
    assert.equal(/4-20s real-time MOVE sound loop/.test(read(f).replace(/"[^"]*"/g, '""')), false, `${f}`);
  }
});
