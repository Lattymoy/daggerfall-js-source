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
  SongPlayer, songVoices, songKit, songTone, heldBody, unisonCents, VOICE_RANGE, KIT_RANGE, SONG_FLOOR_HZ,
} from '../../../src/systems/song/songPlayer.js';
import { noteToHz, percussionSpec } from '../../../src/systems/gmSynth.js';
import {
  spireScoreSongs, SPIRE_CHANNELS, SPIRE_PROGRAMS, SPIRE_VOICES, SPIRE_KIT, SPIRE_PRESS, SPIRE_SWELL_S, SPIRE_BAND_SONGS,
} from '../../../src/systems/eliteGates/egScore.js';
import { midiNote, SCORE_TPQ } from '../../../src/systems/gate/gateScore.js';

/** A recording AudioContext: every node made, its params' writes, its connections. */
function recCtx() {
  const made = { osc: [], gain: [], pan: [], src: [], biquad: [], comp: [], shaper: [], delay: [] };
  const param = (v = 0) => { const p = { value: v, writes: [] }; for (const k of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime']) p[k] = (x, t) => { p.writes.push([k, x, t]); p.value = x; }; p.cancelScheduledValues = () => {}; return p; };
  const node = (kind, extra) => { const n = { kind, to: [], connect(d) { n.to.push(d); return d; }, disconnect() { n.to = []; }, start(t) { n.started = t; }, stop(t) { n.stopped = t; }, ...extra }; made[kind]?.push(n); return n; };
  const ctx = {
    currentTime: 0, sampleRate: 44100, destination: { kind: 'dest' }, made,
    createOscillator: () => node('osc', { type: '', frequency: param(), detune: param() }),
    createGain: () => node('gain', { gain: param(1) }),
    createStereoPanner: () => node('pan', { pan: param() }),
    createBufferSource: () => node('src', { buffer: null }),
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createBiquadFilter: () => node('biquad', { type: '', frequency: param(), Q: param(), gain: param() }),
    createDynamicsCompressor: () => node('comp', Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map((k) => [k, param()]))),
    createWaveShaper: () => node('shaper', { curve: null }),
    createDelay: () => node('delay', { delayTime: param() }),   // INTRO3c: the ensemble's
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

test('INTRO3c THE VIBRATO (songPlayer.js _vibrato, VOICE_RANGE): a voice with `vibrato` runs a sine LFO per copy into the pair’s detune - carrier and modulator both - at `vibRate` with each copy 6% faster than the last, the depth setting in from nothing over the attack and a quarter second; one without runs none; the fields held to their ranges', () => {
  const plain = playOne({ voices: { 0: { unison: 2, cents: 4 } } });
  assert.equal(plain.ctx.made.osc.length, 4, 'two pairs, no LFO');
  const { ctx } = playOne({ voices: { 0: { unison: 2, cents: 4, attack: 0.1, vibrato: 12, vibRate: 5 } } });
  const lfos = ctx.made.osc.filter((o) => o.frequency.value < 20);
  assert.equal(ctx.made.osc.length, 6, 'two pairs and an LFO each');
  assert.deepEqual(lfos.map((o) => +o.frequency.value.toFixed(3)).sort((a, b) => a - b), [4.85, 5.15], 'each copy’s rate its own, 6% a step about vibRate');
  for (const lfo of lfos) {
    assert.equal(lfo.type, 'sine');
    assert.equal(lfo.to.length, 1, 'through one depth gain');
    const depth = lfo.to[0];
    const detunes = ctx.made.osc.filter((o) => o !== lfo && o.frequency.value >= 20).map((o) => o.detune);
    assert.equal(depth.to.length, 2, 'into the carrier’s detune and the modulator’s');
    assert.ok(depth.to.every((d) => detunes.includes(d)), 'the detunes of a pair');
    const [set, ramp] = depth.gain.writes;
    assert.deepEqual(set.slice(0, 2), ['setValueAtTime', 0], 'from nothing');
    assert.equal(ramp[0], 'linearRampToValueAtTime'); assert.equal(ramp[1], 12, 'to the depth in cents');
    assert.ok(Math.abs((ramp[2] - set[2]) - (0.1 + 0.25)) < 1e-9, 'over the attack and a quarter second');
    assert.ok(Number.isFinite(lfo.started) && Number.isFinite(lfo.stopped), 'started with the note, stopped with it');
  }
  const held = songVoices({ voices: { 0: { vibrato: 90, vibRate: 0.1 }, 1: { vibrato: -3 } } });
  assert.deepEqual(held[0], { vibrato: 50, vibRate: 0.5 }); assert.deepEqual(held[1], { vibrato: 0 });
});

test('INTRO3c THE BITE (songPlayer.js _breath, VOICE_RANGE): a voice with `noise` runs the player’s noise, looped, through a wide band-pass two and a half times up from the note (600 Hz to 5 kHz) into what the copies play into, at that share AS THE NOTE STARTS and fading to a sixteenth over the attack and 0.3 s - a bow’s start, not a hiss under the note; one without runs none', () => {
  const plain = playOne({ voices: { 0: { unison: 2, cents: 4 } } });
  assert.equal(plain.ctx.made.src.length, 0, 'no noise under a plain voice');
  const { ctx } = playOne({ note: 69, voices: { 0: { unison: 2, cents: 4, spread: 0.5, attack: 0.1, noise: 0.3 } } });
  assert.equal(ctx.made.src.length, 1, 'one band of noise a note, not a copy');
  const [src] = ctx.made.src;
  assert.equal(src.loop, true, 'looped: the buffer is a second long, a note is not');
  const [bp] = src.to; assert.equal(bp.kind, 'biquad'); assert.equal(bp.type, 'bandpass'); assert.equal(bp.frequency.value, 1100, 'A4 440 x 2.5'); assert.equal(bp.Q.value, 0.6);
  const [g] = bp.to;
  const [set, fade] = g.gain.writes;
  assert.deepEqual(set.slice(0, 2), ['setValueAtTime', 0.3], 'at the share as the note starts');
  assert.equal(fade[0], 'exponentialRampToValueAtTime'); assert.ok(Math.abs(fade[1] - 0.3 / 16) < 1e-12, 'to a sixteenth');
  assert.ok(Math.abs((fade[2] - set[2]) - (0.1 + 0.3)) < 1e-9, 'over the attack and 0.3 s');
  const sides = ctx.made.gain.filter((n) => n.gain.writes.some(([k, v]) => k === 'exponentialRampToValueAtTime' && v === 0.0001));
  assert.equal(g.to.length, 2, 'into both envelope sides of a spread FM unison');
  assert.ok(g.to.every((side) => sides.includes(side)), 'the envelope sides, not the output');
  assert.ok(Number.isFinite(src.started) && Number.isFinite(src.stopped), 'started with the note, stopped with it');
  const low = playOne({ note: 36, voices: { 0: { noise: 0.2 } } }).ctx.made.src[0].to[0].frequency.value, high = playOne({ note: 108, voices: { 0: { noise: 0.2 } } }).ctx.made.src[0].to[0].frequency.value;
  assert.equal(low, 600); assert.equal(high, 5000);
  assert.deepEqual(songVoices({ voices: { 0: { noise: 3 } } })[0], { noise: 1 });
  // a bowed voice's bite plays into its low-pass, coloured as the copies are
  const bowed = playOne({ note: 69, voices: { 0: { saw: 1, unison: 2, cents: 4, spread: 0.5, noise: 0.2 } } });
  const lows = bowed.ctx.made.biquad.filter((b) => b.type === 'lowpass');
  assert.equal(bowed.ctx.made.src[0].to[0].to[0].to.length, 2); assert.ok(bowed.ctx.made.src[0].to[0].to[0].to.every((n) => lows.includes(n)), 'into the two low-passes');
});

test('INTRO3c THE BOWED VOICE (songPlayer.js _bow, VOICE_RANGE): a voice with `saw` plays sawtooth copies - no modulator, no index - into a low-pass a side whose cutoff is `cutoff` times the note at full velocity and seven tenths of that at none, opening from half over the attack and 80 ms and settling to 85% through the decay, `cutQ` its resonance; the vibrato moves the one oscillator; a bend’s map still counts two detunes a copy; an FM voice is as it was', () => {
  const { ctx, p } = playOne({ note: 69, voices: { 0: { saw: 1, cutoff: 8, cutQ: 1.2, unison: 2, cents: 4, spread: 0.5, attack: 0.1, decay: 0.2, vibrato: 10 } } });
  const saws = ctx.made.osc.filter((o) => o.type === 'sawtooth'), sines = ctx.made.osc.filter((o) => o.type === 'sine');
  assert.equal(saws.length, 2, 'a sawtooth a copy'); assert.equal(sines.length, 2, 'the two vibrato LFOs and no modulators');
  const lows = ctx.made.biquad.filter((b) => b.type === 'lowpass');
  assert.equal(lows.length, 2, 'a low-pass a side');
  for (const lp of lows) {
    assert.equal(lp.Q.value, 1.2);
    const fc = 440 * 8 * (0.7 + 0.3 * 100 / 127);
    const [set, open, settle] = lp.frequency.writes;
    assert.deepEqual([set[0], open[0], settle[0]], ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime']);
    assert.ok(Math.abs(set[1] - fc * 0.5) < 1e-9 && Math.abs(open[1] - fc) < 1e-9 && Math.abs(settle[1] - fc * 0.85) < 1e-9, 'half, the cutoff, 85%');
    assert.ok(Math.abs((open[2] - set[2]) - 0.18) < 1e-9, 'open over the attack and 80 ms');
    assert.ok(Math.abs((settle[2] - set[2]) - 0.3) < 1e-9, 'settled through the decay');
    assert.equal(lp.to.length, 1); assert.equal(lp.to[0].kind, 'gain', 'into an envelope side');
  }
  for (const saw of saws) assert.ok(lows.includes(saw.to[0]), 'each copy into a low-pass');
  for (const lfo of sines) assert.equal(lfo.to[0].to.length, 1, 'the vibrato into the one oscillator’s detune');
  const v = p._voices.at(-1); assert.equal(v.detunes.length, 4, 'two detunes a copy'); assert.deepEqual(v.offs, [-4, -4, 4, 4]);
  const soft = playOne({ note: 69, voices: { 0: { saw: 1, cutoff: 8 } } }); soft.p.stop();
  const quiet = (() => { const ctx2 = (() => { const r = playOne({ voices: { 0: { saw: 1, cutoff: 8 } } }); return r.ctx; })(); return ctx2; })();
  assert.ok(quiet.made.biquad.some((b) => b.type === 'lowpass'), 'a bowed voice with no cutQ still bows (Q 0.8 unnamed)');
  assert.equal(quiet.made.biquad.find((b) => b.type === 'lowpass').Q.value, 0.8);
  const fm = playOne({ voices: { 0: { unison: 2, cents: 4 } } });
  assert.equal(fm.ctx.made.osc.filter((o) => o.type === 'sine').length, 4, 'an FM voice: two pairs'); assert.equal(fm.ctx.made.biquad.filter((b) => b.type === 'lowpass').length, 0, 'and no low-pass');
  assert.deepEqual(songVoices({ voices: { 0: { saw: 2, cutoff: 100, cutQ: 0.1 } } })[0], { saw: 1, cutoff: 64, cutQ: 0.3 }, 'held to their ranges');
});

test('INTRO3c THE INDEX FLOOR (songPlayer.js, VOICE_RANGE): an FM voice’s index settles to `idxFloor` of itself - a horn holds its brightness - and to 12% unnamed, as the bank always did', () => {
  const depthOf = (voices) => { const { ctx } = playOne({ note: 60, voices }); const g = ctx.made.gain.find((n) => n.gain.writes[0]?.[1] > 100 && n.gain.writes[1]?.[0] === 'exponentialRampToValueAtTime'); return [g.gain.writes[0][1], g.gain.writes[1][1]]; };
  const hz = 440 * Math.pow(2, (60 - 69) / 12);
  const [d0, floor] = depthOf({ 0: { index: 3, idxDecay: 1, idxFloor: 0.5 } });
  assert.ok(Math.abs(d0 - 3 * hz) < 1e-9 && Math.abs(floor - 1.5 * hz) < 1e-9, 'half of itself');
  const [, plain] = depthOf({ 0: { index: 3, idxDecay: 1 } });
  assert.ok(Math.abs(plain - 0.36 * hz) < 1e-9, '12% unnamed');
  assert.deepEqual(songVoices({ voices: { 0: { idxFloor: 2 } } })[0], { idxFloor: 1 });
});

test('INTRO3c THE BODY, THE AIR AND THE ENSEMBLE (songPlayer.js _insert, heldBody): a voiced channel plays through its body’s resonances in turn, its air shelf at 5 kHz and three slow-swept delays beside the dry sound, into the song’s level; built once a song a channel and dropped for the next song, whose plain channel goes straight to the level; the body held to its ranges, the bad entries dropped', () => {
  const { ctx, p } = playOne({ voices: { 0: { body: [[450, 7, 0.8], [2700, 8, 1]], air: -8, ensemble: 0.45, ensembleRate: 0.7, ensembleMs: 12 } } });
  const chGain = p._chGains[0];
  const chain = []; let n = chGain.to[0]; while (n && n.kind === 'biquad') { chain.push([n.type, n.frequency.value, n.gain.value, n.Q.value]); n = n.to[0]; }
  assert.deepEqual(chain, [['peaking', 450, 7, 0.8], ['peaking', 2700, 8, 1], ['highshelf', 5000, -8, 0]], 'the body in turn, then the air');
  const dry = n; assert.equal(dry.kind, 'gain'); assert.ok(Math.abs(dry.gain.value - (1 - 0.35 * 0.45)) < 1e-12, 'the dry share');
  const out = dry.to[0]; assert.equal(out, p._chInserts[0].last);
  assert.equal(out.to[0], p._level, 'into the song’s level');
  const delays = ctx.made.delay; assert.equal(delays.length, 3);
  assert.deepEqual(delays.map((d) => +d.delayTime.value.toFixed(5)), [0.012, +(0.012 * 1.37).toFixed(5), +(0.012 * 1.83).toFixed(5)], 'the three lengths');
  const lfos = p._chInserts[0].lfos; assert.equal(lfos.length, 3);
  assert.deepEqual(lfos.map((o) => +o.frequency.value.toFixed(4)), [0.7, +(0.7 * 0.79).toFixed(4), +(0.7 * 1.31).toFixed(4)], 'the three rates');
  lfos.forEach((lfo, i) => { const sweep = lfo.to[0]; assert.ok(Math.abs(sweep.gain.value - delays[i].delayTime.value * 0.2) < 1e-12, 'a fifth of the length'); assert.equal(sweep.to[0], delays[i].delayTime); assert.ok(Number.isFinite(lfo.started)); });
  for (const d of delays) { const wet = d.to[0]; assert.ok(Math.abs(wet.gain.value - 0.28 * 0.45) < 1e-12); assert.equal(wet.to[0], out); }
  // the next song, plain: the chains dropped, its channel straight to the level
  p.play({ secondsPerTick: 0.001, durationTicks: 400, events: [{ tick: 0, type: 'programChange', channel: 0, program: 61 }, { tick: 0, type: 'noteOn', channel: 0, note: 60, velocity: 100, duration: 200 }] });
  clearInterval(p._timer); p._timer = null;
  assert.ok(lfos.every((o) => Number.isFinite(o.stopped)), 'the sweeps stopped');
  assert.equal(p._chInserts, null); assert.equal(p._chGains[0].to[0], p._level, 'straight to the level');
  assert.deepEqual(heldBody([[450, 7, 0.8], [20, 30, 0.1], 'x', [600, 3, 1, 'extra'], [1, 2]]), [[450, 7, 0.8], [40, 24, 0.3], [600, 3, 1]], 'held, the bad dropped, the first four read');
  assert.equal(heldBody([]), null); assert.equal(heldBody('x'), null);
  assert.deepEqual(songVoices({ voices: { 0: { body: [[450, 7, 0.8]] } } })[0], { body: [[450, 7, 0.8]] }, 'a body alone is a voice');
  assert.deepEqual(songVoices({ voices: { 0: { air: -40, ensemble: 2, ensembleRate: 9, ensembleMs: 0 } } })[0], { air: -30, ensemble: 1, ensembleRate: 4, ensembleMs: 1 });
});

test('INTRO3c THE TONE (songPlayer.js _routeTone, songTone): a song with `tone` plays its fader through a low shelf, its bands in turn and a high shelf into the master; the next song without one plays straight in again; a song that names none is untouched; the shelves and the bands held', () => {
  const song = (tone) => ({ secondsPerTick: 0.001, durationTicks: 400, events: [{ tick: 0, type: 'programChange', channel: 0, program: 61 }, { tick: 0, type: 'noteOn', channel: 0, note: 60, velocity: 100, duration: 200 }], ...(tone ? { tone } : {}) });
  const ctx = recCtx(), p = new SongPlayer(ctx);
  p.play(song(null)); clearInterval(p._timer); p._timer = null;
  assert.equal(p._tone, null); assert.deepEqual(p._fader.to, [p._master], 'a song without a tone: the graph as it always was');
  p.play(song({ low: [60, -2], bands: [[100, 5, 1.2], [3150, 4, 0.9]], high: [5000, 4] })); clearInterval(p._timer); p._timer = null;
  const chain = []; let n = p._fader.to[0]; while (n && n.kind === 'biquad') { chain.push([n.type, n.frequency.value, n.gain.value, n.Q.value]); n = n.to[0]; }
  assert.deepEqual(chain, [['lowshelf', 60, -2, 0], ['peaking', 100, 5, 1.2], ['peaking', 3150, 4, 0.9], ['highshelf', 5000, 4, 0]]);
  assert.equal(n, p._master, 'into the master'); assert.equal(p._tone.length, 4);
  const was = p._tone;
  p.play(song(null)); clearInterval(p._timer); p._timer = null;
  assert.equal(p._tone, null); assert.deepEqual(p._fader.to, [p._master], 'straight in again'); assert.ok(was.every((f) => f.to.length === 0), 'the old chain let go');
  assert.equal(songTone({}), null); assert.equal(songTone({ tone: { bands: 'x', low: [1] } }), null);
  assert.deepEqual(songTone({ tone: { low: [5, -40], high: [30000, 40], bands: [[100, 5, 1.2]] } }), { bands: [[100, 5, 1.2]], low: [20, -24], high: [16000, 24] });
});

test('INTRO3c THE BOW’S ARC AND THE SWAY (songPlayer.js, VOICE_RANGE): a held note with `arc` dips after the attack, swells to its sustain at 55% of its length and eases before the release; a note too short for one holds as before; a voice with `sway` runs a slow sine per copy into the copy’s own gain about 1, each copy a fifth faster a step; the fields held', () => {
  // a long note: duration 1200 ticks x 0.001 s = 1.2 s; attack 0.1, decay 0.2, sustain 0.5 (fmSpec's)
  const long = (voices, duration = 1200) => { const ctx = recCtx(), p = new SongPlayer(ctx); p.play({ secondsPerTick: 0.001, durationTicks: 2000, events: [{ tick: 0, type: 'programChange', channel: 0, program: 48 }, { tick: 0, type: 'noteOn', channel: 0, note: 60, velocity: 100, duration }], voices, press: { out: 2 } }); clearInterval(p._timer); p._timer = null; return { ctx, p }; };
  const env = (ctx) => ctx.made.gain.find((n) => n.gain.writes.length >= 5 && n.gain.writes[0][0] === 'setValueAtTime' && n.gain.writes[0][1] === 0.0001).gain.writes;
  const arced = env(long({ 0: { attack: 0.1, decay: 0.2, sustain: 0.5, arc: 0.5 } }).ctx);
  assert.equal(arced.length, 6, 'set, attack, dip, crest, ease, release');
  const [, atk, dip, crest, ease, rel] = arced;
  const peak = atk[1], sustain = peak * 0.5;
  assert.ok(Math.abs(dip[1] - sustain * 0.8) < 1e-9 && dip[0] === 'exponentialRampToValueAtTime', 'dips to 1 - 0.4 arc after the attack');
  assert.ok(Math.abs(crest[1] - sustain) < 1e-9 && Math.abs(crest[2] - (arced[0][2] + 0.55 * 1.2)) < 1e-9, 'the crest at 55% of the note');
  assert.ok(Math.abs(ease[1] - sustain * 0.7) < 1e-9 && Math.abs(ease[2] - (arced[0][2] + 1.2)) < 1e-9, 'eases to 1 - 0.6 arc by the release');
  assert.equal(rel[1], 0.0001);
  const plain = env(long({ 0: { attack: 0.1, decay: 0.2, sustain: 0.5 } }).ctx);
  assert.equal(plain.length, 5); assert.deepEqual([plain[2][1], plain[3][0], plain[3][1]], [sustain, 'setValueAtTime', sustain], 'no arc: the sustain holds');
  const short = env(long({ 0: { attack: 0.1, decay: 0.2, sustain: 0.5, arc: 0.5 } }, 400).ctx);
  assert.equal(short.length, 5, 'a note too short for an arc (its sustain under a quarter second) holds');
  // the sway
  const { ctx, p } = long({ 0: { unison: 2, cents: 4, sway: 0.5, swayRate: 0.4 } });
  const lfos = ctx.made.osc.filter((o) => o.frequency.value < 20);
  assert.deepEqual(lfos.map((o) => +o.frequency.value.toFixed(4)).sort((a, b) => a - b), [+(0.4 * 0.895).toFixed(4), +(0.4 * 1.105).toFixed(4)], 'a copy’s own rate, a fifth a step');
  for (const lfo of lfos) {
    const depth = lfo.to[0]; assert.ok(Math.abs(depth.gain.value - 0.15) < 1e-12, '0.3 x sway');
    const copyGain = ctx.made.gain.find((g) => g.gain === depth.to[0]); assert.ok(copyGain, 'into a copy’s own gain'); assert.equal(copyGain.gain.value, 1);
    assert.ok(ctx.made.osc.some((o) => o.frequency.value >= 20 && o.to[0] === copyGain), 'the copy plays through it');
    assert.ok(Number.isFinite(lfo.started));
  }
  assert.equal(ctx.made.osc.length, 6, 'two pairs and a sway each');
  assert.ok(lfos.every((o) => Number.isFinite(o.stopped)), 'stopped with the note'); p.stop();
  assert.deepEqual(songVoices({ voices: { 0: { arc: 2, sway: -1, swayRate: 9 } } })[0], { arc: 1, sway: 0, swayRate: 2 });
});
