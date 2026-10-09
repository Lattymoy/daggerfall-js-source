// AUDIT SD IV, SD26 (2026-10-08, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md "AUDIT SD IV"): THE
// HOUR HEARD, AUDITED A FOURTH TIME - the audio lens's findings, each reproduced and pinned here: the Remnant's grunt
// outside time (A1); the Hearts a page away missed (A2); the Brass of Numidium's powers through the index door (A3).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSdRemnantVoice, SD_VOICE_CUES, SD_HURT_GAP_MS, SD_VOICE_AWAY_MS } from '../src/scenes/sdRemnantVoice.js';
import { createSdRemnantBlows } from '../src/scenes/sdRemnantBlows.js';
import { SD_BLOWS, SD_BODY } from '../src/net/sdRemnant.js';
import { BOSS_CUES } from '../src/world/gateBoss.js';
import { AudioEngine } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { SPELL_CAST_SOUND } from '../src/systems/enemySpells.js';
import { SD_HALL_SOUNDS } from '../src/scenes/sdHall.js';
import { createSdAir, SD_AIR_FAR } from '../src/scenes/sdAir.js';
import { createDeadlandsAir, AIR_FAR } from '../src/scenes/deadlandsAir.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = read('src/scenes/world.js');
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

test('SD26 THE BRASS\'S POWERS SOUND THE HALL\'S OWN RECORDS (A3): SD_HALL_SOUNDS are DAGGER.SND record INDEXES - the hall, the brass veil, the Rift\'s bell and the Remnant\'s voice all play them so, and Unbroken one line above plays 433 so - but the set voice sent Gearward\'s clunk and The Hour Turns\' toll through the ID door, which plays whatever record carries that ID (AUDIT 58: the two are unrelated) or nothing. world.js\'s own voice, run on the engine over an archive whose IDs are not its indexes: each power plays the hall\'s record (mutants: the clunk by ID; the toll by ID)', () => {
  const at = W.indexOf('  setSetPowersVoice({ sound: (name) => {');
  assert.ok(at > 0);
  const text = W.slice(at, W.indexOf('\n  } });\n', at) + 8);
  const e = new AudioEngine(), played = [];
  e.snd = { getRecordIndex: (id) => id - 3 };   // index 0 carries ID 3 (audio.js soundIndexForId)
  e.playOneShot = (index) => { played.push(index); };
  let voice = null;
  new Function('setSetPowersVoice', 'audio', 'SOUND', 'SPELL_CAST_SOUND', 'SD_HALL_SOUNDS', text)((v) => { voice = v; }, e, SOUND, SPELL_CAST_SOUND, SD_HALL_SOUNDS);
  const heard = (name) => { played.length = 0; voice.sound(name); return played.slice(); };
  assert.deepEqual(heard('unbroken'), [SOUND.Parry6]);
  assert.deepEqual(heard('gear'), [SD_HALL_SOUNDS.clunk], 'Gearward: the Orrery\'s own clunk');
  assert.deepEqual(heard('hour'), [SD_HALL_SOUNDS.toll], 'The Hour Turns: the Hour\'s bell');
  assert.deepEqual(heard('wrath'), [SPELL_CAST_SOUND[0] - 3], 'a spell\'s cast sound is an ID, and stays one');
});

test('SD26 A STOMP LANDS AS ONE THUD (A4): on a Stomp\'s landing frame the blows played its landing (BODY_FALL at 0.28) and the voice its quake (BODY_FALL at 0.30) - one clip started twice in the same frame, 1.2 semitones apart, a louder phasing smear; and the quake\'s End arm was dead (the End is the Hour\'s clock blow, never the Remnant\'s). The ground\'s shock is the landing: the voice and the blows over one Stomp start the thud once (mutants: the quake back)', () => {
  let t = T0;
  const s = { fi: 2, ph: 1, op: T0 - 60_000, ou: 0, su: 0, stunAt: 0, h: 1000, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: null, clk: null, cx: null, fell: null, lost: 0 };
  const plays = [];
  const audio = { play3d: (clip, at, volume, o) => { plays.push({ t, clip, pitch: o?.pitch }); return 1; } };
  const link = { state: () => s, now: () => t, counted: () => false };
  const voice = createSdRemnantVoice({ audio, link, feet: () => null });
  const blows = createSdRemnantBlows({ audio, link, feet: () => null, player: () => null });
  const step = (ms) => { t += ms; voice.frame(); blows.frame(); };
  step(0);
  const lands = T0 + 2000;
  s.rem.atk = { k: 'atk', b: SD_BODY.remnant, i: 7, a: SD_BLOWS.stomp.id, at: lands, x: 0, z: 0, yw: 0, tg: [] };
  while (t < lands + 600) step(16);
  const thuds = plays.filter((p) => p.clip === BOSS_CUES.quake.clip && p.t >= lands && p.t < lands + 400);
  assert.equal(thuds.length, 1, `the landing, once: ${JSON.stringify(thuds)}`);
  assert.ok(plays.some((p) => p.clip === BOSS_CUES.quake.clip && p.t < lands), 'its wind-up and release still heard');
});

/** A context that keeps what it is asked (sd20d's), with an ear. */
function fakeContext() {
  const made = { sources: [], gains: [], panners: [] };
  let now = 0;
  const param = (v = 0) => ({ value: v, events: [], setValueAtTime(x, t) { this.events.push(['set', x, t]); this.value = x; }, linearRampToValueAtTime(x, t) { this.events.push(['ramp', x, t]); }, cancelScheduledValues(t) { this.events.push(['cancel', t]); } });
  const node = (o = {}) => ({ connect(n) { return n; }, disconnect() { this.gone = true; }, ...o });
  const ctx = {
    state: 'running', destination: node(), listener: { setPosition() {}, setOrientation() {} }, get currentTime() { return now; }, set time(t) { now = t; },
    createBufferSource() { const s = node({ context: ctx, loop: false, playbackRate: param(1), started: null, stopAt: null, start(w) { this.started = w ?? now; }, stop(w) { this.stopAt = w ?? now; } }); made.sources.push(s); return s; },
    createGain() { const g = node({ gain: param(1), context: ctx }); made.gains.push(g); return g; },
    createPanner() { const p = node({ positionX: param(), positionY: param(), positionZ: param() }); made.panners.push(p); return p; },
    createBuffer(ch, len, rate) { const d = new Float32Array(len); return { numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, getChannelData: () => d }; },
  };
  return { ctx, made };
}

test('SD26 THE HOUR\'S FAR EVENTS LET GO WITH IT (A5): the Hour\'s air let its four beds go as it was left, and a moan or a bell already sounding (played `far`, held at its offset from the ear until its clip ran out) rang on at the ear in the street for seconds - the Deadlands\' the same. A far shot played under a place\'s name fades with that place: audio.js fadeFar ramps each still sounding to nothing over the beds\' fade, stops it and lets the ear go of it; the distant storm\'s thunder (no name) is never touched; the Hour\'s and the court\'s stop() fade their own (mutants: the Hour\'s events kept; the court\'s events kept; nothing faded; the thunder faded; the faded still held at the ear)', () => {
  const { ctx, made } = fakeContext(), e = new AudioEngine();
  e.ctx = ctx; e.enabled = true;
  e.registerSamples('moan', new Float32Array(22050 * 3), 22050);
  e.setListener([0, 0, 0], [0, 0, -1]);
  const shot = (pos, far, pitch = 1) => { const g = made.gains.length; e.play3d('moan', pos, 1, { refDistance: 13, pitch, far }); return made.gains[g]; };
  const moanGain = shot([20, 0, 0], 'sdAir', 0.55), thunderGain = shot([0, 0, 20], true);   // a storm's thunder
  shot([0, 0, -20], 'deadlandsAir');
  const [moan, thunder, court] = made.sources;
  ctx.time = 1;
  e.fadeFar('sdAir');
  const ramp = moanGain.gain.events.find((v) => v[0] === 'ramp');
  assert.ok(ramp && ramp[1] === 0 && ramp[2] > 1 && ramp[2] <= 2, `faded to nothing over the beds' fade: ${JSON.stringify(ramp)}`);
  assert.ok(moan.stopAt >= ramp[2], 'then stopped');
  assert.equal(thunder.stopAt, null, 'the thunder sounds on'); assert.equal(court.stopAt, null, 'another place\'s too');
  assert.ok(!thunderGain.gain.events.some((v) => v[0] === 'ramp'));
  const placed = (src) => made.panners[made.sources.indexOf(src)].positionX.value;
  const [m0, t0] = [placed(moan), placed(thunder)];
  e.setListener([5, 0, 5], [0, 0, -1]);
  assert.equal(placed(moan), m0, 'the faded one let go by the ear'); assert.notEqual(placed(thunder), t0, 'the thunder still held at its bearing');
  e.fadeFar('deadlandsAir');
  assert.ok(court.stopAt != null);
  // the Hour's and the court's stop() fade their own, by name
  for (const [make, name] of [[createSdAir, SD_AIR_FAR], [createDeadlandsAir, AIR_FAR]]) {
    const faded = [];
    const fake = { setBed() {}, setBed3d() {}, play3d() {}, registerSamples: () => true, samplesOf: () => new Float32Array(4000), fadeFar: (tag) => faded.push(tag) };
    const air = make(fake);
    air.frame(10, [0, 1, 0]);
    air.stop();
    assert.deepEqual(faded, [name], `${name}: its events let go with its beds`);
  }
});
