// EG-ROAR (2026-10-18, Mac: "the music and ambience of the elite breach needs to be insanely better. Its way too tame";
// bible/11-Multiplayer/Elite-Gates.md section 26 and its EG-ROAR record): THE SCORE ROARS. A song's own voices
// (systems/song/songPlayer.js songVoices, songKit, unisonCents, the floor): a song MIDI.BSA holds names none and plays the
// bank's one pair a note; a made song's unison copies set off the note either side and as loud as the one pair, its sub
// an octave under, its spread copies laid either side of the channel, its drums' click and body, a bend keeping the
// spread, and the high-pass under a voiced song before its press. The Spire's songs (systems/eliteGates/egScore.js):
// every one voiced on all sixteen channels, the three new voices, the press letting the drums through; the halls
// climbing in four eights, the trial breaking and building, a braam at each phrase never on the brass, a swell landing on
// each downbeat, the shrieks the Kyn's half step high, the chant on the chord's root and fifth, the count's clock, nothing
// before the first bar.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SongPlayer, songVoices, songKit, unisonCents, VOICE_RANGE, KIT_RANGE, SONG_FLOOR_HZ,
} from '../../../src/systems/song/songPlayer.js';
import { noteToHz, percussionSpec } from '../../../src/systems/gmSynth.js';
import {
  spireScoreSongs, SPIRE_CHANNELS, SPIRE_PROGRAMS, SPIRE_VOICES, SPIRE_KIT, SPIRE_PRESS, SPIRE_SWELL_S, SPIRE_BAND_SONGS,
} from '../../../src/systems/eliteGates/egScore.js';
import { midiNote, SCORE_TPQ } from '../../../src/systems/gate/gateScore.js';

/** A recording AudioContext: every node made, its params' writes, its connections. */
function recCtx() {
  const made = { osc: [], gain: [], pan: [], src: [], biquad: [], comp: [], shaper: [] };
  const param = (v = 0) => { const p = { value: v, writes: [] }; for (const k of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime']) p[k] = (x, t) => { p.writes.push([k, x, t]); p.value = x; }; p.cancelScheduledValues = () => {}; return p; };
  const node = (kind, extra) => { const n = { kind, to: [], connect(d) { n.to.push(d); return d; }, disconnect() { n.to = []; }, start(t) { n.started = t; }, stop(t) { n.stopped = t; }, ...extra }; made[kind]?.push(n); return n; };
  const ctx = {
    currentTime: 0, sampleRate: 44100, destination: { kind: 'dest' }, made,
    createOscillator: () => node('osc', { type: '', frequency: param(), detune: param() }),
    createGain: () => node('gain', { gain: param(1) }),
    createStereoPanner: () => node('pan', { pan: param() }),
    createBufferSource: () => node('src', { buffer: null }),
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createBiquadFilter: () => node('biquad', { type: '', frequency: param(), Q: param() }),
    createDynamicsCompressor: () => node('comp', Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map((k) => [k, param()]))),
    createWaveShaper: () => node('shaper', { curve: null }),
  };
  return ctx;
}
/** One note through a fresh player: `voices`/`kit` the song's own (or none), `program` the channel's. */
function playOne({ channel = 0, note = 60, program = 61, voices, kit, pan = 64, bend = null } = {}) {
  const ctx = recCtx(), p = new SongPlayer(ctx);
  const events = [
    { tick: 0, type: 'programChange', channel, program },
    { tick: 0, type: 'controller', channel, controller: 10, value: pan },
    { tick: 0, type: 'noteOn', channel, note, velocity: 100, duration: 200 },
  ];
  if (bend != null) events.push({ tick: 50, type: 'pitchBend', channel, value: bend });
  p.play({ secondsPerTick: 0.001, durationTicks: 400, events, ...(voices ? { voices } : {}), ...(kit ? { kit } : {}), press: { out: 2 } });
  clearInterval(p._timer); p._timer = null;
  return { ctx, p };
}

test('EG-ROAR A SONG\'S OWN VOICES (songPlayer.js songVoices, songKit, unisonCents): a song that names none is null - the bank\'s own; each field held to its range, one that is not a number dropped, a unison a whole number of copies; the kit by GM key; a unison\'s copies spread evenly either side of the note, one copy on it (mutants: a field unheld; the copies all sharp)', () => {
  assert.equal(songVoices({ events: [] }), null, 'an HMI song names none');
  assert.equal(songVoices({ voices: 'x' }), null);
  assert.equal(songVoices({ voices: { 3: { colour: 'red' } } }), null, 'nothing it knows: none');
  const v = songVoices({ voices: { 3: { unison: 9.6, cents: -5, sub: 0.5, spread: 2, index: 'loud', attack: 0 } } });
  assert.equal(v.length, 16); assert.equal(v[0], null);
  assert.deepEqual(v[3], { attack: VOICE_RANGE.attack[0], unison: 4, cents: 0, sub: 0.5, spread: 1 }, 'held to its range, the word dropped');
  assert.equal(songVoices({ voices: { 2: { unison: 2.4 } } })[2].unison, 2, 'whole copies');
  assert.equal(songKit({ kit: { x: { hz: 50 } } }), null);
  const k = songKit({ kit: { 87: { hz: 5, decay: 9, click: 0.5, body: 120, colour: 1 }, 300: { hz: 60 } } });
  assert.deepEqual([...k.keys()], [87], 'a GM key alone');
  assert.deepEqual(k.get(87), { hz: KIT_RANGE.hz[0], decay: KIT_RANGE.decay[1], click: 0.5, body: 120 });
  assert.deepEqual(unisonCents(1, 12), [0]); assert.deepEqual(unisonCents(3, 0), [0]);
  assert.deepEqual(unisonCents(3, 12), [-12, 0, 12]);
  assert.deepEqual(unisonCents(2, 9), [-9, 9]);
  assert.deepEqual(unisonCents(4, 15), [-15, -5, 5, 15]);
});

test('EG-ROAR THE VOICE IN THE GRAPH (SongPlayer._voice): the bank\'s own note one pair, one envelope, no floor; a voiced note its unison\'s pairs each set off by its cents, as loud as the one pair (the peak over the square root of the copies), its sub an octave under, a spread laying its copies in two envelopes either side of the channel\'s place; a bend reaching every copy with its spread kept; a voiced drum\'s click and body over the kit\'s own; the voiced song high-passed at SONG_FLOOR_HZ before its press (mutants: the unison as loud as its copies; the spread one side; the sub on the note; the bend flattening the spread; the drum unvoiced; no floor)', () => {
  const plain = playOne();
  assert.equal(plain.ctx.made.osc.length, 2, 'the bank\'s one pair');
  assert.equal(plain.p._levelTo, plain.p._press.comp, 'no floor under an unvoiced song');
  const hz = noteToHz(60);
  const peakOf = (ctx) => Math.max(...ctx.made.gain.flatMap((g) => g.gain.writes.filter((w) => w[0] === 'linearRampToValueAtTime').map((w) => w[1])));
  const one = peakOf(plain.ctx);
  const { ctx, p } = playOne({ voices: { 0: { unison: 3, cents: 10, sub: 0.5, spread: 0.4 } }, bend: 12288, pan: 80 });
  const osc = ctx.made.osc;
  assert.equal(osc.length, 7, 'three pairs and a sub');
  const still = playOne({ voices: { 0: { unison: 3, cents: 10 } } }).ctx.made.osc;
  assert.deepEqual(still.map((o) => Math.round(o.detune.value)), [-10, -10, 0, 0, 10, 10], 'each pair set off by its cents, the modulator with its carrier');
  assert.ok(osc[6].frequency.value > hz * 0.49 && osc[6].frequency.value < hz * 0.51, 'the sub an octave under');
  assert.ok(Math.abs(peakOf(ctx) - one / Math.sqrt(3)) < 1e-9, 'as loud as the one pair');
  const pans = ctx.made.pan.map((q) => q.pan.value).sort((a, b) => a - b), at = (80 - 64) / 63;
  assert.deepEqual(pans.map((x) => +x.toFixed(6)), [+(at - 0.4).toFixed(6), +(at + 0.4).toFixed(6)], 'the copies either side of the channel');
  // the bend: every copy and the sub, the spread kept
  const bent = osc.slice(0, 6).filter((_, i) => i % 2 === 0).map((o) => o.detune.writes.at(-1)?.[1]);
  assert.deepEqual(bent.map((c) => Math.round(c - 100)), [-10, 0, 10], 'the bend keeps the spread');
  assert.equal(Math.round(osc[6].detune.writes.at(-1)[1]), 100, 'the sub bent with them');
  // the floor
  assert.equal(p._levelTo, p._floor, 'a voiced song high-passed');
  assert.equal(p._floor.type, 'highpass'); assert.equal(p._floor.frequency.value, SONG_FLOOR_HZ); assert.equal(p._floorTo, p._press.comp, 'before its press');
  // the drum
  const drum = playOne({ channel: 9, note: 87, program: 0, kit: { 87: { hz: 64, click: 0.5, body: 0 } } });
  assert.equal(drum.ctx.made.osc[0].frequency.writes[0][1], 64, 'the song\'s own tone');
  assert.equal(drum.ctx.made.src.length, 1, 'the beater\'s click');
  const snare = playOne({ channel: 9, note: 38, program: 0, kit: { 38: { body: 185, q: 0.7 } } });
  assert.equal(snare.ctx.made.biquad.find((b) => b.type === 'bandpass')?.Q.value, 0.7);
  assert.equal(snare.ctx.made.osc.length, 1, 'the skin under the crack');
  assert.equal(snare.ctx.made.osc[0].frequency.writes[0][1], 185);
  const bare = playOne({ channel: 9, note: 87, program: 0 });
  assert.equal(bare.ctx.made.osc[0].frequency.writes[0][1], percussionSpec(87).hz, 'the kit\'s own without one');
  assert.equal(bare.ctx.made.src.length, 0);
});

const notesOf = (song) => song.events.filter((e) => e.type === 'noteOn');
const inBars = (song, ch, b0, b1) => notesOf(song).filter((e) => e.channel === ch && e.tick >= b0 * 4 * SCORE_TPQ && e.tick < b1 * 4 * SCORE_TPQ);

test('EG-ROAR THE SPIRE\'S VOICES (egScore.js): every song carries its own voices on every channel but the kit\'s and its own kit, the tremolo strings, the reverse cymbal and the voices on GM\'s last three channels, the press letting a drum\'s first 12 ms through; nothing written before the first bar (mutants: the songs unvoiced; a swell before tick 0; the press clamping the drums)', () => {
  assert.deepEqual([SPIRE_CHANNELS.trem, SPIRE_CHANNELS.swell, SPIRE_CHANNELS.chant], [13, 14, 15]);
  assert.deepEqual([SPIRE_PROGRAMS.trem, SPIRE_PROGRAMS.swell, SPIRE_PROGRAMS.chant], [44, 119, 53]);
  for (const band of [0, 1, 2, 3]) {
    for (const [k, s] of Object.entries(spireScoreSongs({ band, motif: band * 3, valk: band * 3 + 3, seed: 4 }))) {
      const v = songVoices(s);
      assert.ok(v, `${k} voiced`);
      for (const [voice, ch] of Object.entries(SPIRE_CHANNELS)) if (voice !== 'kit') assert.deepEqual(v[ch], songVoices({ voices: { [ch]: SPIRE_VOICES[voice] } })[ch], `${k}: ${voice}'s own`);
      assert.equal(songKit(s)?.size, Object.keys(SPIRE_KIT).length, `${k}: its kit`);
      assert.ok(notesOf(s).every((e) => e.tick >= 0), `${k}: nothing before its first bar`);
      assert.equal(s.press.attack, 0.012); assert.equal(s.press.ratio, 3);
    }
  }
  assert.deepEqual({ ...SPIRE_PRESS.lord3 }, { threshold: -18, knee: 12, ratio: 3, attack: 0.012, release: 0.25, ceiling: -1, out: 5.8 });
});

test('EG-ROAR THE WRITING (egScore.js): the halls climb in four eights - the spiccato\'s eighths, then sixteenths from the gathering, the drums harder at the height - in every band and variant; a braam at each phrase on the low brass (E under the Kyn\'s F), never on the brass; a swell landing on each phrase\'s downbeat; the trial\'s break (the drums far off, no kick, no strings, the chant) and its build (the shrieks B5 over C6, the snare rolling up); the chant on the chord\'s root and fifth; the count\'s clock on every eighth (mutants: the halls flat; the break kept; a braam on the brass; the swells on the downbeat\'s far side)', () => {
  for (const band of [0, 1, 2, 3]) {
    const hall = spireScoreSongs({ band, seed: band }).hall;
    for (const b0 of [0, 32, 64]) {
      const per = (b) => inBars(hall, SPIRE_CHANNELS.pizz, b0 + b, b0 + b + 1).length;
      assert.equal(per(2), 8, `band ${band}: the descent in eighths`); assert.equal(per(17), 16, `band ${band}: the gathering in sixteenths`);
      assert.ok(inBars(hall, 9, b0 + 24, b0 + 32).length > inBars(hall, 9, b0, b0 + 8).length, `band ${band}: the height's drums`);
    }
    assert.equal(hall.name, SPIRE_BAND_SONGS[band]);
  }
  const S = spireScoreSongs({ band: 0, motif: 0, valk: 3, seed: 0 });
  // a braam: the low brass's cluster at a phrase's head, the Kyn's F over E
  const ost = inBars(S.lord1, SPIRE_CHANNELS.ostinato, 0, 1).filter((e) => e.tick === 0).map((e) => e.note).sort((a, b) => a - b);
  assert.deepEqual(ost, [28, 40, 47, 53], 'E1, E2, B2 and the Kyn\'s F3');
  assert.ok(inBars(S.lord1, SPIRE_CHANNELS.brass, 0, 1).every((e) => ![28, 40, 47, 53].includes(e.note) || e.duration < 2 * SCORE_TPQ), 'never on the brass');
  // the swells land on the downbeat
  for (const s of [S.yard, S.lord2, S.count]) {
    const sw = inBars(s, SPIRE_CHANNELS.swell, 0, 9999);
    assert.ok(sw.length >= 2, `${s.name}: swells`);
    const beats = (e) => (e.tick + e.duration) / SCORE_TPQ;
    for (const e of sw) assert.ok(Math.abs(beats(e) / 4 - Math.round(beats(e) / 4)) < 0.02, `${s.name}: a swell ends on a bar line`);
    assert.ok(sw.every((e) => Math.abs(e.duration / SCORE_TPQ - (SPIRE_SWELL_S * s.beatsPerMinute) / 60) < 0.05 || e.tick + e.duration === s.durationTicks), `${s.name}: ${SPIRE_SWELL_S} s each`);
  }
  // the trial's break and build
  const y = S.yard;
  assert.equal(inBars(y, 9, 16, 20).filter((e) => e.note === 36).length, 0, 'no kick in the break');
  assert.equal(inBars(y, SPIRE_CHANNELS.strings, 16, 20).length, 0, 'no strings in the break');
  assert.ok(inBars(y, SPIRE_CHANNELS.chant, 16, 20).length >= 16, 'the chant alone');
  assert.ok(inBars(y, 9, 8, 12).filter((e) => e.note === 36).length >= 24, 'the kick galloping in the drive');
  const shrieks = new Set(inBars(y, SPIRE_CHANNELS.trem, 20, 24).map((e) => e.note));
  assert.deepEqual([...shrieks].sort(), [midiNote('B5'), midiNote('C6')], 'the Kyn\'s half step high');
  const roll = inBars(y, 9, 22, 24).filter((e) => e.note === 38).sort((a, b) => a.tick - b.tick);
  assert.ok(roll.length >= 30 && roll.at(-1).velocity > roll[0].velocity + 40, 'the snare rolling up');
  // the chant: the root and the fifth
  for (const e of inBars(y, SPIRE_CHANNELS.chant, 16, 17)) assert.ok([midiNote('E4'), midiNote('B4')].includes(e.note), 'E4 and B4 over Em');
  // the count's clock
  const clock = inBars(S.count, 9, 3, 4).filter((e) => e.note === 76 || e.note === 77).map((e) => e.tick - 12 * SCORE_TPQ);
  assert.deepEqual(clock, [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i * SCORE_TPQ / 2), 'a tick every eighth');
});
