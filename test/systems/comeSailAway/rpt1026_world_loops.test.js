// RPT1026-WORLD LOOP-AWAKE (a private report, 2026-10-25: every volume slider at 10%, a caravan parked by the shipwright,
// in and out of it - and the boats roared over the sliders): A BOAT'S LOOP COMES BACK AS IT WENT. The real Come Sail Away runtime
// over the vendored hulls (test/csaScene.mjs), its loops heard through the world host's own law for a plain AudioSource
// on the one bus (systems/audio.js plainSourceGain - the bus carries Sound Volume, the source's own volume over it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene } from '../../csaScene.mjs';
import { plainSourceGain } from '../../../src/systems/audio.js';

const f = Math.fround;
/** A scene whose loops are heard: the plays and stops in order, and the game's Sound Volume at `sv`. */
function heardScene(sv) {
  const s = scene();
  const audio = [];
  s.deps.audio = { play: (src) => audio.push(['play', src.clip]), stop: (src) => audio.push(['stop', src.clip]) };
  s.deps.soundVolume = () => sv;
  return { ...s, audio };
}
/** What reaches the speakers of a loop playing at `v` on the bus at Sound Volume `sv` (world.js csaAudioFrame's
 *  gain at the source's own spot - its rolloff 1 - times the bus's master). */
const heard = (v, sv) => plainSourceGain(v, sv) * sv;
/** The player steps into a building (the caravan's room is one) and back out: the outdoor boats go, and come back. */
function inAndOut(s) {
  s.world.inside = true;
  s.rt.UpdateBoatVisibility();
  s.world.inside = false;
  s.rt.UpdateBoatVisibility();
}

test('LOOP-AWAKE: a moored boat at Sound Volume 10% - in a building and back out, her slow loop plays again at the level it had and her wake\'s loop stays silent; nothing of hers is heard past the slider (mutant: Unity\'s playOnAwake woke the fast loop at its first volume, 1 - heard at full)', () => {
  const sv = 0.1;
  const s = heardScene(sv);
  const boat = s.place(1);
  for (let i = 0; i < 5; i++) s.rt.endOfFrame();   // the placement's fade run out (PlaySlow)
  const slow = boat.AudioSourceSlow, fast = boat.AudioSourceFast;
  assert.deepEqual([slow.isPlaying, fast.isPlaying], [true, false], 'placed: her slow loop alone');
  const level = slow.volume;
  assert.ok(level > 0 && level <= f(sv), `the slow loop under the slider (${level})`);
  const plays = slow.plays;
  inAndOut(s);
  assert.equal(boat.GameObject.activeSelf, true, 'she stands again');
  assert.deepEqual([slow.isPlaying, fast.isPlaying], [true, false], 'the slow loop back, the wake\'s loop never woken');
  assert.equal(slow.plays, plays + 1, 'a Play: from the clip\'s start');
  assert.equal(slow.volume, level, 'at the level it had');
  for (const src of [slow, fast]) if (src.isPlaying) assert.ok(heard(src.volume, sv) <= sv + 1e-9, `${src.clip} heard at ${heard(src.volume, sv)} past the slider's ${sv}`);
  assert.deepEqual(s.audio.slice(-2), [['stop', slow.clip], ['play', slow.clip]], 'the one loop stopped as she went, and played as she came back');
});

test('LOOP-AWAKE: a loop that played as its boat went plays again, one that did not stays down - her wake\'s loop under way comes back, the slow one the crossfade had stopped does not (mutant: both woken)', () => {
  const s = heardScene(1);
  const boat = s.place(1);
  for (let i = 0; i < 5; i++) s.rt.endOfFrame();
  s.rt.StartSailing(boat);
  s.rt.state.MoveVectorCurrent = [0, 0, 1];
  s.rt.update();   // past the wake's threshold: the crossfade to the fast loop (csa_effects.test.js's wake arm)
  for (let i = 0; i < 9; i++) s.rt.endOfFrame();   // its two seconds: the slow loop stopped
  const slow = boat.AudioSourceSlow, fast = boat.AudioSourceFast;
  assert.deepEqual([slow.isPlaying, fast.isPlaying], [false, true], 'under way: the wake\'s loop alone');
  const level = fast.volume;
  inAndOut(s);
  assert.deepEqual([slow.isPlaying, fast.isPlaying], [false, true], 'as she went');
  assert.equal(fast.volume, level, 'the wake\'s loop at the level it had');
});
