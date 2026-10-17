// WB10a (2026-09-30, Mac: "improve the boss music, make it more loud, just feel like its too quite, and I feel like the
// music is too jolly"): THE WARDEN'S SCORE, PRESSED AND DARKENED. Louder: a song may carry its own PRESS
// (systems/song/songPlayer.js songPress - a compressor, its drive, a soft ceiling a decibel under the clip at the highest
// MusicVolume), and the court's four do (systems/gate/gateScore.js SCORE_PRESS); every song MIDI.BSA holds carries none and
// plays through the graph it always did. Less jolly: the pizzicato, the high bell, the hi-hat and the tambourine gone; the
// villain's harmony (D minor to B-flat MINOR, no C major); a pedal ostinato on low brass, never an arpeggio; stabs and
// pads in open fifths; the brass never climbing to a fanfare. What it SOUNDS like - the loudness, the peaks under the
// ceiling, one player through the whole fight - is measured through the real player by tools/gateScoreProbe.mjs.
// Design: bible/11-Multiplayer/World-Bosses.md section 15.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateScoreSongs, SCORE_PRESS, SCORE_PROGRAMS, SCORE_CHANNELS, SCORE_TPQ, midiNote } from '../../../src/systems/gate/gateScore.js';
import {
  SongPlayer, songPress, PRESS_RANGE, PRESS_OUT_MAX, PRESS_CEILING_MIN, CEILING_DRIVE, ceilingCurve, ceilingAmplitude, MUSIC_GAIN,
} from '../../../src/systems/song/songPlayer.js';
import { fmSpec } from '../../../src/systems/gmSynth.js';

const BAR = 4 * SCORE_TPQ;
const WARS = ['war1', 'war2', 'war3'];
const notes = (song, ch) => song.events.filter((e) => e.type === 'noteOn' && e.channel === ch);
const inBar = (list, bar) => list.filter((e) => e.tick >= bar * BAR && e.tick < (bar + 1) * BAR);
const pc = (n) => ((n % 12) + 12) % 12;

test('WB10a a song\'s press: none for a song without one (every song MIDI.BSA holds) or one that is not an object; each field held to its range, a missing one its default, the ceiling the clip itself when none is named (mutants: a song without a press read as pressed; the ceiling past the clip)', () => {
  assert.equal(songPress(undefined), null);
  assert.equal(songPress({}), null, 'MIDI.BSA\'s songs carry none');
  for (const bad of [null, 0, 'loud', true]) assert.equal(songPress({ press: bad }), null, `${bad}: no press`);
  const d = songPress({ press: {} });
  for (const [k, [, , dflt]] of Object.entries(PRESS_RANGE)) assert.equal(d[k], dflt, `${k}: its default`);
  assert.equal(d.ceiling, 0, 'no ceiling named: the clip itself');
  const hi = songPress({ press: { threshold: 9, knee: 99, ratio: 99, attack: 5, release: 5, out: 99, ceiling: 6 } });
  assert.deepEqual(hi, { threshold: 0, knee: 40, ratio: 20, attack: 1, release: 1, out: PRESS_OUT_MAX, ceiling: 0 }, 'never past the most');
  const lo = songPress({ press: { threshold: -500, knee: -1, ratio: 0, attack: -1, release: -1, out: -3, ceiling: -99 } });
  assert.deepEqual(lo, { threshold: -100, knee: 0, ratio: 1, attack: 0, release: 0, out: PRESS_RANGE.out[2], ceiling: PRESS_CEILING_MIN }, 'never under the least; an out of nothing is the default, not silence');
  assert.equal(songPress({ press: { out: NaN, ceiling: Infinity } }).ceiling, 0);
});

/** A context that records the graph: every node's connections, disconnects, and each AudioParam's value. */
function graphCtx({ compressor = true, shaper = true } = {}) {
  let n = 0;
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {}, cancelScheduledValues() {}, cancelAndHoldAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = (kind, extra = {}) => ({ kind, id: n++, to: [], connect(x) { this.to.push(x); return x; }, disconnect() { this.to = []; }, ...extra });
  const made = [];
  const ctx = {
    currentTime: 5, destination: node('destination'), made,
    createGain() { const g = node('gain', { gain: param() }); made.push(g); return g; },
  };
  if (compressor) ctx.createDynamicsCompressor = () => { const c = node('compressor', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); made.push(c); return c; };
  if (shaper) {
    ctx.createWaveShaper = () => {
      const s = node('shaper', { sets: 0, _curve: null, oversample: 'none' });
      Object.defineProperty(s, 'curve', { get() { return this._curve; }, set(v) { this.sets++; this._curve = v; } });
      made.push(s);
      return s;
    };
  }
  return ctx;
}
const song = (press) => ({ events: [{ tick: 0, type: 'controller', channel: 0, controller: 7, value: 100 }], secondsPerTick: 0.01, durationTicks: 100, ...(press === undefined ? {} : { press }) });

test('WB10a the press in the player\'s graph: a pressed song runs the level through the compressor, its drive, the ceiling\'s soft clip and the ceiling\'s amplitude to the fader; the next song without one runs the level straight to the fader again, as before WB10a; the press is built once and its curve set once; a context without a compressor plays it unpressed (mutants: the press never routed; a plain song left on the press; the press rebuilt each song; the drive not carried into the curve)', () => {
  const ctx = graphCtx();
  const p = new SongPlayer(ctx);
  p._ensureMaster();
  assert.deepEqual(p._level.to, [p._fader], 'before a pressed song: the level to the fader');
  const press = { threshold: -18, knee: 12, ratio: 4, attack: 0.003, release: 0.25, out: 5, ceiling: -1 };
  try {
    p.play(song(press));
    const { comp, out, shaper, top } = p._press;
    assert.deepEqual(p._level.to, [comp], 'the level into the compressor');
    assert.deepEqual(comp.to, [out]); assert.deepEqual(out.to, [shaper]); assert.deepEqual(shaper.to, [top]); assert.deepEqual(top.to, [p._fader], 'and on to the fader - the fades stay the fader\'s');
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) assert.equal(comp[k].value, press[k], `the compressor's ${k}`);
    const C = ceilingAmplitude(-1);
    assert.ok(Math.abs(out.gain.value - 5 / (C * CEILING_DRIVE)) < 1e-12, 'the drive, carried into the curve\'s [-1, 1]');
    assert.ok(Math.abs(top.gain.value - C) < 1e-12, 'out of it at the ceiling\'s amplitude');
    assert.equal(shaper.curve, ceilingCurve());
    assert.equal(shaper.oversample, '4x');
    p.stop();
    p.play(song(undefined));
    assert.deepEqual(p._level.to, [p._fader], 'a song without one: straight to the fader');
    p.stop();
    const before = ctx.made.length;
    p.play(song({ ...press, out: 3, ceiling: -3 }));
    assert.equal(ctx.made.length, before, 'the press built once');
    assert.equal(p._press.shaper.sets, 1, 'its curve set once');
    assert.deepEqual(p._level.to, [p._press.comp]);
    assert.ok(Math.abs(p._press.top.gain.value - ceilingAmplitude(-3)) < 1e-12, 'the next press\'s own ceiling');
    p.stop();
    p.play(song(press));
    assert.equal(p._level.to.length, 1, 'never connected twice');
  } finally { p.stop(); }
  for (const lack of [{ compressor: false }, { shaper: false }]) {
    const q = new SongPlayer(graphCtx(lack));
    try {
      assert.equal(q.play(song(press)), true, 'it plays');
      assert.deepEqual(q._level.to, [q._fader], `no ${Object.keys(lack)[0]}: unpressed`);
    } finally { q.stop(); }
  }
});

test('WB10a the ceiling, by construction: the curve odd and rising with its ends at +-tanh(CEILING_DRIVE); through the drive, the curve (whose input stops at its ends) and the ceiling\'s amplitude no signal however loud leaves above the ceiling at the highest MusicVolume, and one at half the ceiling comes out within a decibel of itself (mutants: the curve\'s drive dropped; the ceiling not over MUSIC_GAIN)', () => {
  const c = ceilingCurve();
  const m = c.length - 1;
  assert.equal(c.length % 2, 1, 'a middle sample at zero');
  assert.ok(Math.abs(c[m / 2]) < 1e-7);
  for (let i = 0; i < c.length; i++) assert.ok(Math.abs(c[i] + c[m - i]) < 1e-6, `odd at ${i}`);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] > c[i - 1], `rising at ${i}`);
  assert.ok(Math.abs(c[m] - Math.tanh(CEILING_DRIVE)) < 1e-6 && c[m] > 0.99 && c[m] < 1);
  assert.equal(ceilingCurve(), c, 'made once');
  // the chain as the WaveShaper runs it: its input held to [-1, 1], read off the curve
  const shape = (u) => { const x = (Math.max(-1, Math.min(1, u)) + 1) / 2 * m, i = Math.min(m - 1, Math.floor(x)); return c[i] + (c[i + 1] - c[i]) * (x - i); };
  for (const ceiling of [-1, -6, 0]) {
    const C = ceilingAmplitude(ceiling), drive = 1 / (C * CEILING_DRIVE);
    assert.ok(Math.abs(C * MUSIC_GAIN - 10 ** (ceiling / 20)) < 1e-12, 'the ceiling at the speakers at the highest MusicVolume');
    for (const x of [0.01, 1, C / 2, C, 3 * C, 1e6]) {
      const y = C * shape(x * drive);
      assert.ok(y * MUSIC_GAIN <= 10 ** (ceiling / 20) + 1e-9, `${ceiling} dBFS: ${x} never past it`);
      if (x <= C / 2) assert.ok(20 * Math.log10(x / y) < 1, `${x}: within a decibel of itself`);
    }
  }
});

test('WB10a the score carries its press: each of the four its own, in range as it asks (nothing clamped), one compressor shared, the ceiling a decibel under the clip (mutants: a song without its press; the ceiling at the clip)', () => {
  const s = gateScoreSongs();
  for (const key of [...WARS, 'fell']) {
    assert.equal(s[key].press, SCORE_PRESS[key], `${key}: its own press`);
    assert.deepEqual(songPress(s[key]), { ...SCORE_PRESS[key] }, `${key}: the player takes it as it is written`);
    assert.equal(SCORE_PRESS[key].ceiling, -1, `${key}: a decibel under the clip`);
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) assert.equal(SCORE_PRESS[key][k], SCORE_PRESS.war1[k], `${key}: the one compressor`);
    assert.ok(SCORE_PRESS[key].out > 1, `${key}: driven over its own`);
  }
});

test('WB10a less jolly - the voices: no pizzicato (the ostinato a sustained brass voice), no hi-hat, tambourine or bright hand percussion (only drums, toms and the crash and chinese cymbals), the bell tolled low, the brass never climbing to a fanfare (mutants: the pizzicato back; the hi-hat back; the bell rung high; the theme an octave up)', () => {
  const s = gateScoreSongs();
  assert.notEqual(SCORE_PROGRAMS.ostinato, 45, 'not the pizzicato');
  const ost = fmSpec(SCORE_PROGRAMS.ostinato);
  assert.equal(ost.family, 'brass');
  assert.ok(ost.sustain > 0.5, 'held through the note, not plucked away');
  const drums = new Set([35, 36, 38, 41, 43, 45, 47, 48, 49, 52, 57, 86, 87]);
  for (const key of WARS) {
    const kit = new Set(notes(s[key], SCORE_CHANNELS.kit).map((e) => e.note));
    for (const k of kit) assert.ok(drums.has(k), `${key}: kit key ${k} is a drum, a tom or a crash`);
    for (const e of notes(s[key], SCORE_CHANNELS.bells)) assert.ok(e.note <= midiNote('D3'), `${key}: the bell tolled low, not ${e.note}`);
    assert.ok(notes(s[key], SCORE_CHANNELS.bells).length > 0, `${key}: tolled`);
    const top = Math.max(...notes(s[key], SCORE_CHANNELS.brass).map((e) => e.note));
    assert.ok(top <= midiNote('Bb4'), `${key}: the brass tops out at ${top} - no fanfare`);
  }
});

test('WB10a less jolly - the writing: the ostinato a pedal on each bar\'s root (never an arpeggio up the chord); the stabs and the pads in open fifths, no third to brighten them; the war before his wrath on D, B-flat, G and A alone (the C major gone), its B-flat bars MINOR (D-flat held over them, never D); the fall\'s D major untouched (mutants: the arpeggio back; a third in the stab; the major B-flat back; the Neapolitan before his wrath)', () => {
  const s = gateScoreSongs();
  for (const key of WARS) {
    const war = s[key];
    for (let bar = 0; bar < 32; bar++) {
      const o = inBar(notes(war, SCORE_CHANNELS.ostinato), bar);
      const root = inBar(notes(war, SCORE_CHANNELS.bass), bar)[0].note;
      const onRoot = o.filter((e) => pc(e.note) === pc(root)).length;
      assert.ok(onRoot >= 0.75 * o.length, `${key} bar ${bar}: ${onRoot} of ${o.length} on the pedal`);
      assert.ok(new Set(o.map((e) => e.note)).size <= 3, `${key} bar ${bar}: the pedal and its sigh, not an arpeggio`);
      const organ = new Set(inBar(notes(war, SCORE_CHANNELS.organ), bar).map((e) => pc(e.note)));
      assert.deepEqual([...organ].sort(), [pc(root), pc(root + 7)].sort(), `${key} bar ${bar}: the pad a root and its fifth`);
      const hit = new Set(inBar(notes(war, SCORE_CHANNELS.hit), bar).map((e) => pc(e.note)));
      for (const p of hit) assert.ok(p === pc(root) || p === pc(root + 7), `${key} bar ${bar}: the hit in open fifths`);
    }
  }
  // war1's first eight bars: the brass is the stabs alone (the theme comes in at the ninth)
  for (let bar = 0; bar < 8; bar++) {
    const root = inBar(notes(s.war1, SCORE_CHANNELS.bass), bar)[0].note;
    for (const e of inBar(notes(s.war1, SCORE_CHANNELS.brass), bar)) assert.ok([pc(root), pc(root + 7)].includes(pc(e.note)), `war1 bar ${bar}: a stab in open fifths`);
  }
  for (const key of ['war1', 'war2']) {
    assert.deepEqual([...new Set(notes(s[key], SCORE_CHANNELS.bass).map((e) => pc(e.note)))].sort((a, b) => a - b), [2, 7, 9, 10], `${key}: D, G, A and B-flat - no C`);
    for (let bar = 0; bar < 32; bar++) {
      if (pc(inBar(notes(s[key], SCORE_CHANNELS.bass), bar)[0].note) !== 10) continue;
      const held = new Set(inBar(notes(s[key], SCORE_CHANNELS.strings), bar).filter((e) => e.tick === bar * BAR && e.duration === BAR).map((e) => pc(e.note)));
      assert.ok(held.has(1) && !held.has(2), `${key} bar ${bar}: B-flat MINOR - D-flat, never D`);
    }
  }
  const fall = new Set(s.fell.events.filter((e) => e.type === 'noteOn' && e.channel !== 9).map((e) => pc(e.note)));
  assert.ok(fall.has(6) && !fall.has(5), 'the fall still turns to D major');
});
