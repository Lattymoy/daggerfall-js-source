// AUDIT SD IV, SD26 (2026-10-08, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md "AUDIT SD IV"): THE
// HOUR HEARD, AUDITED A FOURTH TIME - the audio lens's findings, each reproduced and pinned here: the Remnant's grunt
// outside time (A1).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSdRemnantVoice, SD_VOICE_CUES, SD_HURT_GAP_MS } from '../src/scenes/sdRemnantVoice.js';

const T0 = 1_800_000_000_000;

/** A fight the test turns, a clock it moves, an engine that hears (sd14a's rig). */
function voiceRig(over = {}) {
  let t = T0;
  const s = { fi: 2, ph: 1, op: T0 - 60_000, ou: 0, su: 0, h: 1000, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: null, clk: null, cx: null, fell: null, lost: 0, ...over };
  const heard = [];
  const audio = { play3d: (clip, at, volume, o) => heard.push({ clip, at, volume, pitch: o.pitch, t }) };
  const v = createSdRemnantVoice({ audio, link: { state: () => s, now: () => t }, feet: () => null });
  return { s, heard, v, step: (ms = 16) => { t += ms; v.frame(); }, at: () => t };
}
const is = (h, c) => h.clip === c.clip && h.pitch === c.pitch;
const count = (heard, c) => heard.filter((h) => is(h, c)).length;

test('SD26 NO GRUNT FROM OUTSIDE TIME (A1): in the Dragon Break every blow on an Echo comes off the whole too (net/sdRemnant.js applyEchoHit), and the voice read each fall of the whole as the Remnant hurt - its bark at the empty place it left, every SD_HURT_GAP_MS, over each Echo\'s own grunt. Outside time (the Break, and its return\'s window) it grunts at nothing; the count follows the whole, so no grunt is banked for its return, and a blow after it is heard (mutants: a grunt outside time; the count banked)', () => {
  const echo = (x) => ({ h: 100, m: 100, x, z: 0, mv: null, atk: null });
  const r = voiceRig({ ph: 2, h: 600, ec: [echo(-6), echo(6)] });
  r.v.frame();
  for (let i = 0; i < 12; i++) { r.s.ec[0].h -= 4; r.s.h -= 4; r.step(SD_HURT_GAP_MS); }   // gold struck, the whole with it
  assert.equal(count(r.heard, SD_VOICE_CUES.echoHurt[0]), 12, 'gold grunts at each blow');
  assert.equal(count(r.heard, SD_VOICE_CUES.hurt), 0, 'the Remnant, outside time, does not');
  // its return: the Last Moment, outside time for its window - the clamp's fall is no blow
  r.s.ph = 3; r.s.ou = r.at() + 2500; r.s.h = 500; r.step();
  assert.equal(count(r.heard, SD_VOICE_CUES.back), 1);
  r.step(1500); r.step(1500);
  assert.equal(count(r.heard, SD_VOICE_CUES.hurt), 0, 'back in time: nothing banked');
  r.s.h -= 10; r.step(SD_HURT_GAP_MS);
  assert.equal(count(r.heard, SD_VOICE_CUES.hurt), 1, 'struck again: heard');
});
