// AUDIT SD IV, SD26 (2026-10-08, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md "AUDIT SD IV"): THE
// HOUR HEARD, AUDITED A FOURTH TIME - the audio lens's findings, each reproduced and pinned here: the Remnant's grunt
// outside time (A1); the Hearts a page away missed (A2).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSdRemnantVoice, SD_VOICE_CUES, SD_HURT_GAP_MS, SD_VOICE_AWAY_MS } from '../src/scenes/sdRemnantVoice.js';
import { createSdRemnantBlows } from '../src/scenes/sdRemnantBlows.js';
import { SD_BLOWS, SD_BODY } from '../src/net/sdRemnant.js';
import { BOSS_CUES } from '../src/world/gateBoss.js';

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

/** The blows on a fight the test turns: what they play, by clip and pitch. */
function blowsRig(over = {}) {
  let t = T0;
  const s = { fi: 2, ph: 3, op: T0 - 600_000, ou: 0, su: 0, stunAt: 0, h: 500, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: null, clk: null, cx: null, fell: null, lost: 0, ...over };
  const plays = [];
  const audio = { play3d: (clip, at, volume, o) => { plays.push({ t, clip, pitch: o?.pitch }); return 1; } };
  const b = createSdRemnantBlows({ audio, link: { state: () => s, now: () => t, counted: () => false }, feet: () => null, player: () => null });
  b.frame();
  return { s, plays, b, at: () => t, step: (ms = 16) => { t += ms; b.frame(); } };
}

test('SD26 THE HEARTS A PAGE AWAY MISSED ARE NOT HEARD AT ONCE (A2): AUDIT SD III A6 took a fight unheard SD_VOICE_AWAY_MS again as it stands, in silence - and the Hearts never got the law: a tab put away through a Reset heard, on its first frame back, a shatter and a ring for every Heart broken meanwhile, up to sixteen at one instant. The gap is the blows\' own (they are framed every frame); away, the Hearts are taken as they stand - standing, or gone with the stun - and their next blow heard as it lands; a hitch shorter than the law still hears its breaks (mutants: the standing heard; the stun\'s shatters heard; the rise heard late; every hitch silent)', () => {
  const crystal = (p) => p.clip === BOSS_CUES.crystalBreak.clip || p.clip === BOSS_CUES.crystalHit.clip || p.clip === BOSS_CUES.crystalRise.clip;
  const hits = (r) => r.plays.filter((p) => p.clip === BOSS_CUES.crystalHit.clip && p.pitch === BOSS_CUES.crystalHit.pitch).length;
  const breaks = (r) => r.plays.filter((p) => p.clip === BOSS_CUES.crystalBreak.clip).length;
  const reset = (i, called) => ({ k: 'atk', b: SD_BODY.remnant, i, a: SD_BLOWS.reset.id, at: called + SD_BLOWS.reset.windup, x: 0, z: 0, yw: 0, tg: [] });
  const eight = () => Array.from({ length: 8 }, (_, k) => [6 * Math.cos(k), 6 * Math.sin(k), 50]);
  // away six seconds through a Reset: five of eight broken, the rest struck - nothing at once; the next blow heard
  const r = blowsRig();
  r.s.rem.atk = reset(7, r.at()); r.s.cx = { i: 7, m: 400, c: eight() };
  r.step();
  assert.equal(r.plays.filter((p) => p.clip === BOSS_CUES.crystalRise.clip).length, 8, 'the rise, live');
  r.plays.length = 0;
  r.s.cx = { i: 7, m: 400, c: eight().map((q, k) => [q[0], q[1], k < 5 ? 0 : 30]) };
  r.step(SD_VOICE_AWAY_MS + 2000);
  assert.deepEqual(r.plays.filter(crystal), [], 'what it passed, unheard');
  r.s.cx = { i: 7, m: 400, c: r.s.cx.c.map((q, k) => [q[0], q[1], k === 6 ? 10 : q[2]]) };
  r.step();
  assert.equal(hits(r), 1, 'taken as they stand: the next blow heard');
  // away while the last broke and the stun took them: the stun still running on the return - nothing
  const z = blowsRig();
  z.s.rem.atk = reset(8, z.at()); z.s.cx = { i: 8, m: 400, c: eight() };
  z.step();
  z.plays.length = 0;
  z.s.cx = null; z.s.rem.atk = null; z.s.stunAt = z.at() + 3000; z.s.su = z.at() + 3000 + 8000;
  z.step(SD_VOICE_AWAY_MS + 2000);
  assert.deepEqual(z.plays.filter(crystal), [], 'sixteen at one instant, unheard');
  // away, and a fresh Reset called a second before the return: taken as it stands - its rise was not heard live
  const f = blowsRig();
  f.s.rem.atk = reset(9, f.at() + SD_VOICE_AWAY_MS + 1000); f.s.cx = { i: 9, m: 400, c: eight() };
  f.step(SD_VOICE_AWAY_MS + 2000);
  assert.deepEqual(f.plays.filter(crystal), [], 'no rise heard late');
  // a hitch under the law: the breaks it passed, heard
  const h = blowsRig();
  h.s.rem.atk = reset(10, h.at()); h.s.cx = { i: 10, m: 400, c: eight() };
  h.step();
  h.plays.length = 0;
  h.s.cx = { i: 10, m: 400, c: eight().map((q, k) => [q[0], q[1], k < 2 ? 0 : 50]) };
  h.step(SD_VOICE_AWAY_MS - 1000);
  assert.equal(breaks(h), 2, 'a hitch: heard');
});
