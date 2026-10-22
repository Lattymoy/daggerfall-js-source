// A5: the song player - hmiFile's event stream onto the WebAudio clock.
//
// DaggerfallSongPlayer hands a .mid to a vendored synth and lets it run.
// We have neither, so this is ours (Port-Ledger A) - but the shape is
// forced by the data rather than chosen: one tempo per song, no tempo
// meta events anywhere in the archive, so secondsPerTick is CONSTANT and
// tick -> time is a multiply. That is why there is no tempo map here.
//
// LOOKAHEAD, not per-event timers. setTimeout jitter is tens of
// milliseconds and would be audible on every note; WebAudio's own clock
// is sample-accurate, so the loop wakes on a coarse timer, schedules
// everything falling inside the next window with exact start times, and
// goes back to sleep. This is the standard WebAudio scheduling shape and
// the reason a browser tab that stalls for 200ms does not stutter.
//
// THE SCHEDULING MATH IS PURE and lives in eventsInWindow/channelStateAt,
// so it is pinned without an AudioContext. Only `_voice` touches the
// audio graph.
//
// CHANNEL STATE IS NOT REPLAYED FROM ZERO on every window. Program
// changes and CC7 volume arrive at tick 0 and then rarely; a scheduler
// that only looked at the current window would play the first second on
// the wrong instrument at the wrong volume. State is folded forward as
// the windows advance, which is what a MIDI sequencer does.

import {
  noteToHz, fmSpec, percussionSpec, velocityGain, volumeGain,
  panPosition, bendCents, PERCUSSION_CHANNEL,
} from '../gmSynth.js';
import { getFloat } from '../settings/settings.js';   // SETT: MusicVolume

/** How far ahead each wake-up schedules, and how often it wakes. The
 *  window must exceed the interval or notes fall through the gap. */
export const LOOKAHEAD_SECONDS = 0.25;
export const TICK_INTERVAL_MS = 100;

/** Master gain for music, under the sound effects so speech and
 *  swings stay legible over it. SETT: DFU's MusicVolume scales it
 *  (DaggerfallSongPlayer sets AudioSource.volume from the setting);
 *  MUSIC_GAIN stays the port's own headroom against the effects bus,
 *  which DFU gets from Unity's mixer and we do not have. */
export const MUSIC_GAIN = 0.22;

/** AUDIT 64 F41: DaggerfallSongPlayer's video mute.
 *  DaggerfallVidPlayerWindow raises OnVideoStart/OnVideoEnd (:93, :112
 *  / :134, :150) and DaggerfallSongPlayer.cs:76-77 subscribes both:
 *  :356-362 `oldGain = Gain; Gain = 0; IsMuted = true;` and :364-369
 *  `Gain = oldGain; IsMuted = false;`. The song KEEPS RUNNING and
 *  keeps advancing - only its level goes to zero, so the video ends
 *  mid-song rather than at the top of one.
 *
 *  It is a FLAG rather than a one-shot ramp because DFU re-asserts it
 *  every Update (:106 `audioSource.volume = IsMuted ? 0f :
 *  MusicVolume`), and the port has three independent writers that
 *  would each undo a ramp - `_ensureMaster`, `resyncGain`, and
 *  AudioSongPlayer's per-start `trackGain()`. Reading it inside the
 *  two gain accessors covers all of them, including a song STARTED
 *  while the video runs. DFU's saved `oldGain` needs no port: the
 *  level is recomputed from the setting on unmute either way. */
let musicMuted = false;
export const isMusicMuted = () => musicMuted;
export const setMusicMuted = (v) => { musicMuted = Boolean(v); };

export const musicGain = () => (musicMuted ? 0 : MUSIC_GAIN * getFloat('Controls', 'MusicVolume', 0, 1));

/** DISC20-B (2026-09-24, Mac: "Sometimes when music tracks switch, its very abrupt instead of seamlessly fading in
 *  between tracks"): THE FADER - a gain between a player's song and its master that only the transitions write. The
 *  master is the VOLUME (MusicVolume and the video mute), with three writers that would each undo a ramp (see above);
 *  the fader is the fade alone, so neither cancels the other. A ramp starts from wherever the fader stands, so a fade
 *  turned round half way turns round where it is; a zero length sets it at once. */
export function rampFader(ctx, fader, level, seconds) {
  if (!fader || !ctx) return;
  const g = fader.gain, now = ctx.currentTime;
  if (!(seconds > 0)) { g.cancelScheduledValues(now); g.setValueAtTime(level, now); g.value = level; return; }
  if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(now);
  else { const v = g.value; g.cancelScheduledValues(now); g.setValueAtTime(v, now); }
  g.linearRampToValueAtTime(level, now + seconds);
}

/** THE SETTING ALONE, no synth trim (2026-08-27, Mac: "fix it also").
 *  MUSIC_GAIN exists because the FM bank's raw oscillators sum hot and
 *  the classic songs are mixed under it; a REPLACEMENT is a mastered
 *  file with its own headroom, and under the trim a user's music pack
 *  played at a fifth of itself (0.22 x the 0.5 default). */
export const trackGain = () => (musicMuted ? 0 : getFloat('Controls', 'MusicVolume', 0, 1));

/** WBX9 (2026-09-26, Mac: "The music needs to be louder and more intense"): A SONG'S OWN LEVEL - a song may carry
 *  `level`, how far over the player's own it is played (systems/gate/gateScore.js: the boss fight's score, over the dungeon
 *  tracks it stands in for). One gain between the channels and the fader, set as the song starts; every song MIDI.BSA
 *  holds carries none and plays at exactly 1, as it always has. Clamped to (0, SONG_LEVEL_MAX]. Pure. */
export const SONG_LEVEL_MAX = 4;
/** EG-G2: how long a duck takes to come back up (s - SongPlayer.duck). */
export const EG_DUCK_BACK_S = 0.12;
export const songLevel = (song) => (Number.isFinite(song?.level) && song.level > 0 ? Math.min(SONG_LEVEL_MAX, song.level) : 1);

/** WB10a (2026-09-30, Mac: "make it more loud, just feel like its too quite"): A SONG'S OWN PRESS - a song may carry
 *  `press`, a compressor it is played through, and how far its output is carried after it (`out`). The level alone
 *  had gone as far as it could: WBX9's score stood a decibel under the clip at the highest MusicVolume, its drums'
 *  peaks 15 dB over its body, so a louder song had to be a PRESSED one - its peaks held down and the whole of it raised
 *  (systems/gate/gateScore.js SCORE_PRESS; tools/gateScoreProbe.mjs measures both). The chain: the song's level (the drive
 *  into the press), the compressor, `out`, the press's CEILING, the fader. Every song MIDI.BSA holds carries none and
 *  never meets one. Each field is held to its range - the Web Audio compressor's for threshold (dB), knee (dB), ratio,
 *  attack and release (seconds); `out` to (0, PRESS_OUT_MAX]; the ceiling to [PRESS_CEILING_MIN, 0] dBFS, the clip
 *  itself when none is named. A song with none, or with a press that is not an object, is null. Pure. */
export const PRESS_OUT_MAX = 8;
export const PRESS_CEILING_MIN = -24;
export const PRESS_RANGE = Object.freeze({
  threshold: [-100, 0, -24], knee: [0, 40, 6], ratio: [1, 20, 8], attack: [0, 1, 0.003], release: [0, 1, 0.25], out: [0, PRESS_OUT_MAX, 1],
  ceiling: [PRESS_CEILING_MIN, 0, 0],
});
/** WB10a: THE CEILING - the most a pressed song can reach at the speakers at the HIGHEST MusicVolume, in dBFS: a soft
 *  clip (`ceilingCurve`, the hyperbolic tangent) whose top stands there, so a compressor's overshoot on a drum's first
 *  milliseconds rounds off under it rather than clipping - never past the ceiling by construction, not by measurement
 *  alone. What reaches it at half the ceiling comes out within a decibel of itself. How far the curve's input reaches,
 *  in the tangent's own units: tanh(3) is 0.995, so the curve's ends are the ceiling. */
export const CEILING_DRIVE = 3;
export function songPress(song) {
  const p = song?.press;
  if (!p || typeof p !== 'object') return null;
  const out = {};
  for (const [k, [lo, hi, dflt]] of Object.entries(PRESS_RANGE)) out[k] = Number.isFinite(p[k]) ? Math.min(hi, Math.max(lo, p[k])) : dflt;
  if (!(out.out > 0)) out.out = PRESS_RANGE.out[2];
  return out;
}
/** EG-ROAR (2026-10-18, Mac: "the music and ambience of the elite breach needs to be insanely better. Its way too
 *  tame"): A SONG'S OWN VOICES - a made song may carry `voices`, its channels' instruments past the FM bank's one
 *  oscillator pair a note (gmSynth.js fmSpec's fields, each held to its range, over the program's own), and `kit`, its
 *  drums past percussionSpec's one sine or band of noise a hit. A voice may be a UNISON (`unison` copies, `cents` apart
 *  either side of the note - an ensemble, where one pair is one player) with a SUB (`sub`, a sine an octave under at that
 *  share), its copies laid in turn either side of the channel's place (`spread`, a share of the pan's whole); a drum
 *  may carry a CLICK (`click`, the beater's noise over a skin's tone) and a BODY (`body` Hz, a skin's tone under a
 *  noise's crack). Every song MIDI.BSA holds carries neither and plays the bank exactly as it always has. A field out
 *  of its range is held to it, one that is not a number is dropped. Pure. */
export const VOICE_RANGE = Object.freeze({
  car: [0.25, 8], mod: [0.25, 12], index: [0, 12], idxDecay: [0.01, 4], attack: [0.001, 2], decay: [0.01, 4], sustain: [0, 1], release: [0.01, 4], gain: [0, 1.5],
  unison: [1, 4], cents: [0, 40], sub: [0, 1], spread: [0, 1],
});
export const KIT_RANGE = Object.freeze({ hz: [20, 12000], attack: [0.001, 0.2], decay: [0.01, 3], gain: [0, 1.5], drop: [0.1, 1], q: [0.2, 12], click: [0, 1], body: [0, 400] });
const held = (o, range) => {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  for (const [k, [lo, hi]] of Object.entries(range)) if (Number.isFinite(o[k])) out[k] = Math.min(hi, Math.max(lo, o[k]));
  return Object.keys(out).length ? out : null;
};
/** EG-ROAR: a song's channels' voices, `[16]` (null where the bank's own plays), or null for a song that names none. */
export function songVoices(song) {
  const v = song?.voices;
  if (!v || typeof v !== 'object') return null;
  const out = new Array(16).fill(null);
  for (let c = 0; c < 16; c++) {
    const s = held(v[c], VOICE_RANGE);
    if (s && 'unison' in s) s.unison = Math.round(s.unison);
    out[c] = s;
  }
  return out.some(Boolean) ? out : null;
}
/** EG-ROAR: a song's drums' voices by GM key (a Map), or null for a song that names none. */
export function songKit(song) {
  const k = song?.kit;
  if (!k || typeof k !== 'object') return null;
  const out = new Map();
  for (const [key, o] of Object.entries(k)) { const n = Number(key), s = held(o, KIT_RANGE); if (Number.isInteger(n) && n >= 0 && n <= 127 && s) out.set(n, s); }
  return out.size ? out : null;
}
/** EG-ROAR: THE FLOOR under a song with its own voices (Hz - SongPlayer._routePress). */
export const SONG_FLOOR_HZ = 30;
/** EG-ROAR: the cents each of a unison's `n` copies is set off the note by - `cents` either side, spread evenly, the
 *  middle one on it. Pure. */
export function unisonCents(n, cents) {
  if (!(n > 1) || !(cents > 0)) return [0];
  return Array.from({ length: n }, (_, i) => -cents + (2 * cents * i) / (n - 1));
}

/** WB10a: the ceiling in the song's own amplitude (before the music's master, MUSIC_GAIN at the highest MusicVolume). */
export const ceilingAmplitude = (dbfs) => Math.pow(10, dbfs / 20) / MUSIC_GAIN;
let _ceilingCurve = null;
/** WB10a: the soft clip's curve, over the WaveShaper's [-1, 1]: tanh(CEILING_DRIVE u), odd, rising, its ends at
 *  +-tanh(CEILING_DRIVE). Made once. */
export function ceilingCurve(n = 2049) {
  if (_ceilingCurve && _ceilingCurve.length === n) return _ceilingCurve;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = Math.tanh(CEILING_DRIVE * ((2 * i) / (n - 1) - 1));
  return (_ceilingCurve = c);
}

/** Lead given to a loop's new origin. It must be SMALLER than the
 *  lookahead: the re-pump schedules [now, now + lookahead), so a lead of a
 *  full lookahead makes that window exactly empty and the repeat starts a
 *  beat late. Small and non-zero is what we want - far enough ahead that
 *  nothing lands in the past, near enough that the seam is inaudible. */
export const LOOP_LEAD_SECONDS = 0.02;

/**
 * The events falling in [fromTick, toTick). Pure, and the half-open
 * interval matters: a closed one would schedule a note twice when it
 * landed exactly on a window boundary, which at 480 PPQN is every beat.
 */
export function eventsInWindow(events, fromTick, toTick) {
  // OW-HITCH (2026-10-21, the owner: "Theres still a lot of hitching in the overworld"): the window's first event found by
  // halving - the events are tick-ordered - where every pump walked the song from its first event (a long cue late in
  // its play: thousands of events a pump, a pump every few frames, in the real game's journey profile). The same events.
  let lo = 0, hi = events.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (events[mid].tick < fromTick) lo = mid + 1; else hi = mid; }
  const out = [];
  for (let i = lo; i < events.length; i++) {
    const e = events[i];
    if (e.tick >= toTick) break;          // events are tick-ordered
    out.push(e);
  }
  return out;
}

/** Fold controller/program/bend events onto per-channel state. Pure, and
 *  it MUTATES the state passed in - the caller carries one state object
 *  across windows so tick-0 setup survives into second three. */
export function applyChannelEvents(state, events) {
  for (const e of events) {
    if (e.channel === null || e.channel === undefined) continue;
    const ch = state[e.channel] ?? (state[e.channel] = { program: 0, volume: 1, pan: 0, bend: 0 });
    if (e.type === 'programChange') ch.program = e.program;
    else if (e.type === 'pitchBend') ch.bend = bendCents(e.value);
    else if (e.type === 'controller') {
      if (e.controller === 7) ch.volume = volumeGain(e.value);
      else if (e.controller === 10) ch.pan = panPosition(e.value);
    }
  }
  return state;
}

/**
 * CC64 SUSTAIN PEDAL - the per-channel intervals the pedal is DOWN.
 *
 * AUDIT (2026-08-25): 593 pedal events across the archive were being
 * dropped, so every note released on its own duration and nothing ever
 * rang on. It is the only ignored controller that changes what you
 * hear: CC123/CC121 matter to a MIDI device that must be told to stop,
 * and this scheduler cannot hang a note in the first place, because an
 * HMI note-on carries its own duration and the voice is given an
 * explicit stop time.
 *
 * Pure, and computed from the WHOLE event list rather than a live flag,
 * because the scheduler works a lookahead window at a time: a note
 * scheduled now may need to ring past the end of the window, and only
 * the full stream knows when the pedal comes up.
 *
 * MIDI's threshold is 64 - below is up, 64 and above is down. A pedal
 * left down at the end of the song closes at `endTick`, so the last
 * chord rings to the loop rather than being cut by a missing up.
 *
 * AUDIT 39: `endTick` is the song's own durationTicks and it is not
 * optional decoration. The open pedal used to close at Infinity, and
 * sustainedDuration then returned Infinity for the hanging chord - a
 * non-finite time into AudioParam.setValueAtTime, whose WebIDL argument
 * is a RESTRICTED double, throws TypeError out of the pump before the
 * cursor advances, so the window was re-voiced until the stall-skip
 * jumped past it and the chord never sounded at all. The default stays
 * Infinity for the pure callers that pass no song length.
 */
export function sustainIntervals(events, endTick = Infinity) {
  const byChannel = new Map();
  const open = new Map();
  for (const e of events ?? []) {
    if (e.type !== 'controller' || e.controller !== 64 || e.channel == null) continue;
    const down = e.value >= 64;
    if (down) {
      if (!open.has(e.channel)) open.set(e.channel, e.tick);
    } else if (open.has(e.channel)) {
      if (!byChannel.has(e.channel)) byChannel.set(e.channel, []);
      byChannel.get(e.channel).push([open.get(e.channel), e.tick]);
      open.delete(e.channel);
    }
  }
  for (const [ch, tick] of open) {
    if (!byChannel.has(ch)) byChannel.set(ch, []);
    byChannel.get(ch).push([tick, Math.max(tick, endTick)]);
  }
  return byChannel;
}

/**
 * How long a note actually sounds, in TICKS, given the pedal.
 *
 * A note whose own end falls while the pedal is down rings until the
 * pedal lifts. A note that ends before the pedal goes down, or after it
 * lifts, is untouched - the pedal never SHORTENS anything.
 */
export function sustainedDuration(startTick, durationTicks, intervals) {
  const end = startTick + durationTicks;
  for (const [down, up] of intervals ?? []) {
    // No Math.max here, and it is not an oversight: the guard `end < up`
    // IS `startTick + durationTicks < up`, so `up - startTick` is
    // already strictly greater than durationTicks whenever this branch
    // is taken. A max() would be dead code - it was there, a mutation
    // proved it could never fire, and it is gone rather than left
    // looking like a safeguard. The pedal cannot shorten a note because
    // a note ending outside the interval never reaches this line.
    if (end >= down && end < up) return up - startTick;
  }
  return durationTicks;
}

/** How long a note is held, in seconds, from the length the pump hands `_voice`.
 *  AUDIT 39: EVERY time a voice hands the graph must be finite.
 *  AudioParam.setValueAtTime and stop() take WebIDL restricted
 *  doubles, so one non-finite duration throws out of the pump and
 *  strands the cursor - a note with no usable length gets the same
 *  0.2s a missing one gets rather than taking the scheduler down.
 *  MIDI-OUT1: exported, because the MIDI-out player's note-off keeps the same length. */
export function noteSeconds(durationSeconds) {
  const rawDur = durationSeconds || 0.2;
  return Math.max(0.05, Number.isFinite(rawDur) ? rawDur : 0.2);
}

/** A fresh 16-channel state. CC7 defaults to full: a song that never
 *  sends a volume must not be silent. */
export function freshChannelState() {
  const s = {};
  for (let c = 0; c < 16; c++) s[c] = { program: 0, volume: 1, pan: 0, bend: 0 };
  return s;
}

export class SongPlayer {
  /**
   * @param {AudioContext} ctx
   * @param {AudioNode} [destination]  defaults to ctx.destination
   */
  constructor(ctx, destination = null, reverbSend = null) {
    this.ctx = ctx;
    this._reverbSend = reverbSend;   // AUDIT-BA F4: the audio engine's reverb send - Unity's zone takes the music's AudioSource at reverbZoneMix 1 like every other
    this.song = null;
    this.playing = false;
    this.loop = true;
    this._timer = null;
    this._voices = [];
    this._master = null;
    this._fader = null;   // DISC20-B: built with the master
    this._level = null;   // WBX9: built with the master
    this._press = null;   // WB10a: built the first time a song asks for one
    this._levelTo = null;   // WB10a: where the level runs - the fader, or the press
    this._destination = destination;
  }

  _ensureMaster() {
    if (this._master || !this.ctx) return;
    this._master = this.ctx.createGain();
    this._master.gain.value = musicGain();
    this._master.connect(this._destination ?? this.ctx.destination);
    if (this._reverbSend) this._master.connect(this._reverbSend);   // AUDIT-BA F4
    this._fader = this.ctx.createGain();   // DISC20-B: the transition's own gain, under the volume
    this._fader.gain.value = 1;
    this._fader.connect(this._master);
    this._level = this.ctx.createGain();   // WBX9: the song's own level, under the fader
    this._level.gain.value = 1;
    this._level.connect(this._fader);
    this._levelTo = this._fader;
  }

  /** WB10a: the level through the song's press (songPress), or straight to the fader - rewired only when that changes,
   *  so a song without one plays through exactly the graph it always did. The press: the compressor, `out` (its gain
   *  carrying the signal into the curve's [-1, 1] as well), the ceiling's soft clip, the ceiling's amplitude, the fader.
   *  The press is built once, its curve with it (every press shares the one), and only its settings move song by song.
   *  A context with no compressor or no shaper plays the song unpressed. */
  _routePress(press) {
    if (!this._level) return;
    let to = this._fader;
    if (press && typeof this.ctx.createDynamicsCompressor === 'function' && typeof this.ctx.createWaveShaper === 'function') {
      if (!this._press) {
        const comp = this.ctx.createDynamicsCompressor(), out = this.ctx.createGain(), shaper = this.ctx.createWaveShaper(), top = this.ctx.createGain();
        shaper.curve = ceilingCurve();
        shaper.oversample = '4x';   // the clip's harmonics folded back under the audible band, not into it
        comp.connect(out);
        out.connect(shaper);
        shaper.connect(top);
        top.connect(this._fader);
        this._press = { comp, out, shaper, top };
      }
      const { comp, out, shaper, top } = this._press;
      for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) comp[k].value = press[k];
      const ceil = ceilingAmplitude(press.ceiling);
      out.gain.value = press.out / (ceil * CEILING_DRIVE);
      top.gain.value = ceil;
      to = comp;
    }
    // EG-ROAR: THE FLOOR - a song that carries its own voices is high-passed at SONG_FLOOR_HZ before its press: a 1:1 FM
    // voice's first lower sideband lands on 0 Hz, an offset no speaker plays that the press would answer by pressing
    // the whole song (measured - a quarter of the spiccato's energy under 40 Hz)
    const hp = this._songVoices && typeof this.ctx.createBiquadFilter === 'function' ? (this._floor ??= this._makeFloor()) : null;
    if (hp) {
      if (this._floorTo !== to) { try { hp.disconnect(); } catch { /* nothing connected */ } hp.connect(to); this._floorTo = to; }
      to = hp;
    }
    if (this._levelTo === to) return;
    try { this._level.disconnect(); } catch { /* nothing connected */ }
    this._level.connect(to);
    this._levelTo = to;
  }

  /** EG-ROAR: the floor's high-pass, made once. */
  _makeFloor() {
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = SONG_FLOOR_HZ; f.Q.value = Math.SQRT1_2;
    return f;
  }

  /** EG-G2 (bible/11-Multiplayer/Elite-Gates.md section 26, THE SPIRE MIX): THE DUCK - the song's own level (WBX9's
   *  node) dipped `db` decibels in 20 ms, held to `seconds`, and back over EG_DUCK_BACK_S; the fader (DISC20-B's fades)
   *  and the volume are never touched, so a duck and a fade never fight. */
  duck(db, seconds) {
    const g = this._level?.gain;
    if (!g || !this.ctx || !(db > 0)) return;
    const now = this.ctx.currentTime, base = songLevel(this.song), low = base * 10 ** (-db / 20), hold = Math.max(0.02, seconds);
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(low, now + 0.02);
    g.setValueAtTime(low, now + hold);
    g.linearRampToValueAtTime(base, now + hold + EG_DUCK_BACK_S);
  }

  /** DISC20-B: ramp the fader to `level` over `seconds` (see rampFader). */
  fadeTo(level, seconds) { rampFader(this.ctx, this._fader, level, seconds); }

  /** The MusicVolume setting moved (2026-08-27): follow it now, not at
   *  the next song. A short ramp, so a slider drag is not a zipper. */
  resyncGain() {
    if (!this._master) return;
    const now = this.ctx.currentTime;
    this._master.gain.cancelScheduledValues(now);
    this._master.gain.setValueAtTime(this._master.gain.value, now);
    this._master.gain.linearRampToValueAtTime(musicGain(), now + 0.05);
  }

  /** Start a decoded song (hmiFile getSong result). Idempotent per song. */
  play(song) {
    if (!this.ctx || !song || !song.events?.length) return false;
    if (this.playing && this.song === song) return true;
    this.stop();
    this._ensureMaster();
    if (this._level) this._level.gain.value = songLevel(song);   // WBX9: the song's own level - 1 for every song but the ones that carry one
    this._songVoices = songVoices(song); this._songKit = songKit(song);   // EG-ROAR: its own voices - none for every song but the ones that carry them (and the floor under them, _routePress)
    this._routePress(songPress(song));   // WB10a: and its press - none for every song but the ones that carry one
    this.song = song;
    // Computed once per song, not per window: the pedal map is a pure
    // function of the event list and the scheduler re-enters constantly.
    this._sustain = sustainIntervals(song.events,
      Number.isFinite(song.durationTicks) ? song.durationTicks : Infinity);
    this.playing = true;
    this._state = freshChannelState();
    this._resyncChannelGains();   // audio-4: a new song starts at full channel volume
    this._cursorTick = 0;
    // Everything is scheduled relative to this, so the whole song shares
    // one origin and cannot drift against the wall clock.
    this._originTime = this._origin(0.06);
    this._pump();
    this._timer = setInterval(() => this._pump(), TICK_INTERVAL_MS);
    return true;
  }

  stop() {
    this.playing = false;
    if (this._timer !== null) { clearInterval(this._timer); this._timer = null; }
    this._cancelChannelGains();
    for (const v of this._voices) {
      try { v.stop(); } catch { /* already stopped */ }
    }
    this._voices = [];
    this.song = null;
  }

  /** Schedule everything inside the next lookahead window. */
  _pump() {
    if (!this.playing || !this.song) return;
    const { secondsPerTick, durationTicks, events } = this.song;
    const aheadTicks = LOOKAHEAD_SECONDS / secondsPerTick;
    const nowTick = (this.ctx.currentTime - this._originTime) / secondsPerTick;
    // AUDIT WB D4: a SEAMLESS song (written as whole bars - systems/gate/gateScore.js) loops on its bar line: its window stops
    // at its end, and the next pass is scheduled from there below
    const seamless = !!this.song.seamless && this.loop && durationTicks > 0;
    const toTick = Math.min(nowTick + aheadTicks, seamless ? durationTicks : durationTicks + 1);

    // AUDIT 19 F8: A STALLED TAB IS NOT A REASON TO PLAY THE PAST. A
    // background throttle can park this loop for a second or more; on the
    // next pump `nowTick` has jumped far ahead of `_cursorTick`, and every
    // note in between would be scheduled with a start time already gone -
    // WebAudio fires those IMMEDIATELY, so ~75 notes arrive as one burst.
    // Skip the gap instead: the song is a looping cue, and losing a beat
    // is better than detonating it.
    if (nowTick - this._cursorTick > aheadTicks) {
      this._cursorTick = nowTick;
      this._skip(nowTick);
    }

    if (this._cursorTick < toTick) {
      const window = eventsInWindow(events, this._cursorTick, toTick);
      // AUDIT 19 F6: INTERLEAVED, not fold-then-voice. This used to apply
      // every control event in the window and THEN voice its notes, so a
      // program change or CC7 late in the window reached back and changed
      // notes earlier in the same window - 20,808 notes across the
      // shipped archive were voiced with state from their own future. The
      // window is a scheduling convenience, not a unit of time: inside it
      // the stream is still ordered, and it has to be played that way.
      for (const e of window) {
        applyChannelEvents(this._state, [e]);
        // AUDIT 19: control events are also SCHEDULED, not just folded into
        // state. Folding alone means only the NEXT note hears them, and the
        // archive puts 15,017 of them inside notes that are already sounding.
        if (e.type !== 'noteOn') this._control(e, this._originTime + e.tick * secondsPerTick);
        if (e.type !== 'noteOn' || !e.velocity) continue;
        this._voice(e, this._originTime + e.tick * secondsPerTick,
          sustainedDuration(e.tick, e.duration || 0, this._sustain?.get(e.channel)) * secondsPerTick);
      }
      this._cursorTick = toTick;
    }

    // AUDIT WB D4: the next pass of a seamless song begins where this one ends, to the tick - scheduled a lookahead
    // ahead like any window; its tick-0 controls are scheduled at the new origin, so no gain is reset under the tail
    if (seamless && this._cursorTick >= durationTicks) {
      this._originTime += durationTicks * secondsPerTick;
      this._cursorTick = 0;
      this._state = freshChannelState();
      this._pump();
      return;
    }
    // Loop: DFU replays the song when its context has not moved
    // (SongManager.UpdateSong:229), so ending in silence is wrong. Rewind
    // once the last note has had time to ring out.
    //
    // AUDIT 19 F7: the rewind used to take 0.02s of lead against a 0.1s
    // pump interval and then wait for the NEXT pump, so by the time the
    // first window was scheduled its notes were already ~0.08s in the
    // past - eight of them squashed into one instant on every repeat. The
    // new origin gets a full lookahead of lead, and we pump IMMEDIATELY
    // rather than waiting, so the loop seam is scheduled ahead like any
    // other window.
    if (nowTick > durationTicks + 1 / secondsPerTick) {
      if (!this.loop) { this.stop(); return; }
      this._state = freshChannelState();
      this._resyncChannelGains();   // audio-4: the seam carries no stale CC7
      this._cursorTick = 0;
      this._originTime = this._origin(LOOP_LEAD_SECONDS);
      this._pump();          // schedule the seam NOW, not on the next tick
      return;
    }
    // Drop finished voices so a long song does not grow an unbounded list.
    if (this._voices.length > 512) {
      this._voices = this._voices.filter((v) => v.endsAt > this.ctx.currentTime);
    }
  }

  /** MIDI-OUT1: where a song (or a loop's next pass) begins, `lead` seconds from now. Its own method so the MIDI-out
   *  player (systems/midiOut.js) can start a song after a stopped one's last message, and reset the device there. */
  _origin(lead) {
    return this.ctx.currentTime + lead;
  }

  /** The stall skip (AUDIT 19 F8): fold the skipped control events forward so the instruments and volumes on the far
   *  side of the gap are still right. MIDI-OUT1: its own method, so the MIDI-out player can tell the device too. */
  _skip(toTick) {
    applyChannelEvents(this._state, eventsInWindow(this.song.events, 0, toTick)
      .filter((e) => e.type !== 'noteOn'));
  }

  /** Build and schedule ONE note. The only method that touches the graph. */
  _voice(e, when, durationSeconds) {
    const ctx = this.ctx;
    const ch = this._state[e.channel] ?? { program: 0, volume: 1, pan: 0, bend: 0 };
    const dur = noteSeconds(durationSeconds);
    // NOT multiplied by ch.volume any more - the channel's gain node owns
    // that, so a CC7 during a held note is audible (AUDIT 19).
    const amp = velocityGain(e.velocity);
    if (amp <= 0) return;

    const gain = ctx.createGain();
    let node;
    let spec;

    if (e.channel === PERCUSSION_CHANNEL) {
      const own = this._songKit?.get(e.note) ?? null;   // EG-ROAR: the song's own drum, over the kit's
      spec = own ? { ...percussionSpec(e.note), ...own } : percussionSpec(e.note);
      if (spec.kind === 'noise') {
        node = ctx.createBufferSource();
        node.buffer = this._noiseBuffer();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = spec.hz;
        bp.Q.value = spec.q ?? 1.2;
        node.connect(bp);
        bp.connect(gain);
      } else {
        node = ctx.createOscillator();
        node.type = 'sine';
        node.frequency.setValueAtTime(spec.hz, when);
        // A drum's pitch drop is what makes it read as a drum - and
        // holding pitch is what makes a triangle, cowbell, claves or
        // agogo read as ITSELF. `drop` is the multiple the pitch falls
        // to over the decay; 1 holds. exponentialRamp cannot take an
        // equal value without warning on some engines, so a held pitch
        // simply schedules nothing further.
        if (spec.drop !== 1) {
          node.frequency.exponentialRampToValueAtTime(spec.hz * spec.drop, when + spec.decay);
        }
        node.connect(gain);
      }
      const peak = amp * spec.gain;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(peak, when + spec.attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + spec.attack + spec.decay);
      this._connect(gain, ch.pan, e.channel);
      node.start(when);
      node.stop(when + spec.attack + spec.decay + 0.02);
      const extra = own ? this._drumLayers(spec, when, peak, ch.pan, e.channel) : null;   // EG-ROAR: its click and its body
      this._voices.push({ stop: () => { node.stop(); extra?.forEach((x) => x.stop()); }, endsAt: when + spec.attack + spec.decay });
      return;
    }

    // TWO-OPERATOR FM, the synthesis Daggerfall was scored for: a
    // modulator sine driving the carrier's FREQUENCY, not its amplitude.
    // The modulator's output is in Hz, so a gain of index*hz gives a
    // modulation depth of `index` multiples of the carrier - which is
    // what "brightness" means in FM.
    const own = this._songVoices?.[e.channel] ?? null;   // EG-ROAR: the song's own voice, over the program's
    spec = own ? { ...fmSpec(ch.program), ...own } : fmSpec(ch.program);
    const hz = noteToHz(e.note);
    const t0 = when;
    const tA = t0 + spec.attack;
    const tD = tA + spec.decay;
    const tOff = Math.max(tD, t0 + dur);
    const end = tOff + spec.release;

    // EG-ROAR: a unison is `unison` pairs, each set off the note by its cents (unisonCents) and begun a share of a
    // period apart so the copies do not all start in phase; one pair is the bank's own note. A `spread` unison lays its
    // copies in turn either side of the channel's place, each side its own envelope; the sub stands between them
    const offs = unisonCents(own?.unison ?? 1, own?.cents ?? 0), oscs = [], detunes = [];
    const peak = (amp * spec.gain) / Math.sqrt(offs.length);   // a unison as loud as the one pair it stands for
    const sustain = Math.max(0.0001, peak * spec.sustain);
    const sides = own?.spread > 0 && offs.length > 1 ? [gain, ctx.createGain()] : [gain];
    for (let u = 0; u < offs.length; u++) {
      const at = t0 + (u * 0.29) / hz;
      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = hz * spec.car;
      if (ch.bend || offs[u]) carrier.detune.value = ch.bend + offs[u];

      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = hz * spec.mod;
      if (ch.bend || offs[u]) mod.detune.value = ch.bend + offs[u];

      const modGain = ctx.createGain();
      // The index DECAYS: a real instrument's bright attack settles into a
      // duller sustain, and a fixed index is the "cheap FM" sound.
      const depth = Math.max(1, spec.index * hz);
      modGain.gain.setValueAtTime(depth, t0);
      modGain.gain.exponentialRampToValueAtTime(
        Math.max(1, depth * 0.12), t0 + Math.max(0.02, spec.idxDecay));
      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(sides[u % sides.length]);
      mod.start(at); carrier.start(at);
      oscs.push(mod, carrier); detunes.push(carrier.detune, mod.detune);
    }
    const subN = own?.sub > 0 ? ctx.createOscillator() : null;   // EG-ROAR: the sub, an octave under, inside the note's own envelope
    if (subN) {
      const subG = ctx.createGain();
      subN.type = 'sine';
      subN.frequency.value = (hz * spec.car) / 2;
      if (ch.bend) subN.detune.value = ch.bend;
      subG.gain.value = (own.sub * Math.sqrt(offs.length)) / sides.length;
      subN.connect(subG);
      for (const g of sides) subG.connect(g);
      subN.start(t0);
      oscs.push(subN); detunes.push(subN.detune);
    }

    for (const g of sides) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(Math.max(0.0001, peak), tA);
      g.gain.exponentialRampToValueAtTime(sustain, tD);
      g.gain.setValueAtTime(sustain, tOff);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
    }

    if (sides.length > 1) { const p0 = ch.pan ?? 0, s = own.spread; this._connect(sides[0], Math.max(-1, p0 - s), e.channel); this._connect(sides[1], Math.min(1, p0 + s), e.channel); }
    else this._connect(gain, ch.pan, e.channel);
    for (const o of oscs) o.stop(end + 0.02);
    this._voices.push({
      stop: () => { for (const o of oscs) o.stop(); }, endsAt: end,
      channel: e.channel, detunes, offs: oscs.length > 2 ? [...offs.flatMap((c) => [c, c]), ...(subN ? [0] : [])] : null,
    });
  }

  /** EG-ROAR: a song's own drum's layers over its tone or its noise (songKit) - `click`, the beater's noise, 2-5 kHz and
   *  gone in 15 ms; `body`, a skin's tone under a noise's crack, falling a third over the first of the decay. Each its
   *  own nodes, stopped with the hit. */
  _drumLayers(spec, when, peak, pan, channel) {
    const ctx = this.ctx, out = [];
    if (spec.click > 0) {
      const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      n.buffer = this._noiseBuffer();
      bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.8;
      g.gain.setValueAtTime(peak * spec.click, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.015);
      n.connect(bp); bp.connect(g);
      this._connect(g, pan, channel);
      n.start(when); n.stop(when + 0.03);
      out.push(n);
    }
    if (spec.body > 0) {
      const o = ctx.createOscillator(), g = ctx.createGain(), len = Math.max(0.03, spec.decay * 0.6);
      o.type = 'sine';
      o.frequency.setValueAtTime(spec.body, when);
      o.frequency.exponentialRampToValueAtTime(spec.body * 0.66, when + len);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(peak * 0.7, when + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, when + len);
      o.connect(g);
      this._connect(g, pan, channel);
      o.start(when); o.stop(when + len + 0.02);
      out.push(o);
    }
    return out;
  }

  /** AUDIT 19: each channel owns a GAIN NODE, and CC7 writes to it.
   *  Channel volume used to be folded into a note's amplitude at the
   *  moment it started, so a volume change mid-note did nothing - the
   *  archive has 15,017 controller events landing inside a sounding note.
   *  A channel node also cannot fight the per-note envelope, which is what
   *  modulating the voice's own gain would have done. */
  /** AUDIT 23 (audio-4): the per-channel gain nodes outlive _state -
   *  play() and the loop rewind reset the STATE to volume 1 but the
   *  NODES kept the last song's (or last pass's) CC7 values, so any
   *  channel whose first CC7 lands late played at the stale gain. */
  /** AUDIT 39: and the reset must CANCEL first, as resyncGain:189 does
   *  on the master. _control schedules CC7 at absolute future times up
   *  to a full lookahead ahead; setValueAtTime only inserts an event, it
   *  does not clear later ones - so a CC7 from the song being left
   *  behind fired after the new song's tick-0 CC7 and, because HMI songs
   *  send CC7 at tick 0 and then rarely, held that channel at the old
   *  song's volume for the rest of the track. */
  _resyncChannelGains() {
    if (!this._chGains) return;
    for (const [ch, g] of Object.entries(this._chGains)) {
      const now = this.ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(this._state[ch]?.volume ?? 1, now);
    }
  }

  /** A stopped song leaves no automation on the graph either: the nodes
   *  outlive the song, and stop() is reachable without a play() after it
   *  (the mute, the loop's last pass). */
  _cancelChannelGains() {
    if (!this._chGains || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (const g of Object.values(this._chGains)) g.gain.cancelScheduledValues(now);
  }

  _channelGain(channel) {
    this._chGains ??= {};
    let g = this._chGains[channel];
    if (!g) {
      g = this.ctx.createGain();
      g.gain.value = this._state[channel]?.volume ?? 1;
      g.connect(this._level ?? this._fader ?? this._master);   // DISC20-B: through the fader; WBX9: and the song's own level before it
      this._chGains[channel] = g;
    }
    return g;
  }

  _connect(gain, pan, channel = 0) {
    const dest = this._channelGain(channel);
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(p);
      p.connect(dest);
      return;
    }
    gain.connect(dest);
  }

  /** Schedule a CONTROL event on the sounding graph, at its own time.
   *  These used to be applied to channel STATE only, which the next note
   *  read - so nothing already sounding ever heard them. */
  _control(e, when) {
    if (e.type === 'pitchBend') {
      const cents = bendCents(e.value);
      for (const v of this._voices) {
        if (v.channel !== e.channel || v.endsAt <= when) continue;
        v.detunes.forEach((d, i) => {
          try { d.setValueAtTime(cents + (v.offs?.[i] ?? 0), when); } catch { /* param already past */ }   // EG-ROAR: a unison's copies keep their spread
        });
      }
      return;
    }
    if (e.type === 'controller' && e.controller === 7) {
      const g = this._channelGain(e.channel);
      try { g.gain.setValueAtTime(volumeGain(e.value), when); } catch { /* ignore */ }
    }
  }

  /** One second of white noise, made once and reused by every drum. */
  _noiseBuffer() {
    if (this._noise) return this._noise;
    const n = Math.floor(this.ctx.sampleRate);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }
}

/**
 * M-EXT - the player for a USER-SUPPLIED song.
 *
 * DFU's SoundReplacement hands Unity an AudioClip and the same
 * AudioSource plays it, so replacement and built-in music share one
 * volume and one "is something playing" answer. That sharing is the
 * part worth keeping, and it is why this lives beside SongPlayer
 * rather than in the replacement module. THE LEVEL LAW SPLIT ON
 * 2026-08-27 (Mac: "fix it also"): MUSIC_GAIN is the FM bank's trim -
 * raw oscillators sum hot - and a user's replacement is a MASTERED file
 * with its own headroom, so it played at a fifth of itself under the
 * trim. This player reads `trackGain()` now - Controls/MusicVolume
 * alone - beside SongPlayer's `musicGain()`; one setting still moves
 * both, through the service's resync, so the mixer cannot drift.
 *
 * LOOPS BY DEFAULT, because Daggerfall's songs do. A replacement track
 * that has been cut with its own fade still loops - DFU's clips loop
 * too, and a one-shot would leave silence until the environment
 * changed, which is worse than a seam.
 */
export class AudioSongPlayer {
  /**
   * @param {AudioContext} ctx
   * @param {AudioNode} [destination]  defaults to ctx.destination
   */
  constructor(ctx, destination = null, reverbSend = null) {
    this.ctx = ctx;
    this._reverbSend = reverbSend;   // AUDIT-BA F4: the audio engine's reverb send - Unity's zone takes the music's AudioSource at reverbZoneMix 1 like every other
    this.playing = false;
    this.loop = true;
    this._source = null;
    this._master = null;
    this._fader = null;   // DISC20-B: built with the master
    this._destination = destination;
  }

  _ensureMaster() {
    if (this._master || !this.ctx) return;
    this._master = this.ctx.createGain();
    this._master.gain.value = trackGain();   // the setting alone: a mastered pack needs no FM trim
    this._master.connect(this._destination ?? this.ctx.destination);
    if (this._reverbSend) this._master.connect(this._reverbSend);   // AUDIT-BA F4
    this._fader = this.ctx.createGain();   // DISC20-B: the transition's own gain, under the volume
    this._fader.gain.value = 1;
    this._fader.connect(this._master);
  }

  /** DISC20-B: ramp the fader to `level` over `seconds` (see rampFader). */
  fadeTo(level, seconds) { rampFader(this.ctx, this._fader, level, seconds); }

  /** Follow the setting now (see SongPlayer.resyncGain). */
  resyncGain() {
    if (!this._master) return;
    const now = this.ctx.currentTime;
    this._master.gain.cancelScheduledValues(now);
    this._master.gain.setValueAtTime(this._master.gain.value, now);
    this._master.gain.linearRampToValueAtTime(trackGain(), now + 0.05);
  }

  /** Start a decoded AudioBuffer. Returns false rather than throwing on
   *  anything missing, the same contract SongPlayer.play answers to. */
  play(buffer) {
    if (!this.ctx || !buffer) return false;
    this.stop();
    this._ensureMaster();
    // The gain is re-read on every start, not just on the first: a
    // player who moves the music slider between songs expects the next
    // one to obey it, and the node is built once.
    this._master.gain.value = trackGain();   // the setting alone, on every start too
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = this.loop;
    src.connect(this._fader ?? this._master);   // DISC20-B: through the fader
    // A non-looping clip has to clear `playing`, or the director reads
    // a song that is still sounding forever and never re-evaluates.
    src.onended = () => { if (this._source === src) { this.playing = false; this._source = null; } };
    src.start();
    this._source = src;
    this.playing = true;
    return true;
  }

  stop() {
    this.playing = false;
    const src = this._source;
    this._source = null;
    if (src) {
      src.onended = null;   // stop() must not look like a track ending
      try { src.stop(); } catch { /* already stopped */ }
    }
  }
}
