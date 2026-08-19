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
} from './gmSynth.js';

/** How far ahead each wake-up schedules, and how often it wakes. The
 *  window must exceed the interval or notes fall through the gap. */
export const LOOKAHEAD_SECONDS = 0.25;
export const TICK_INTERVAL_MS = 100;

/** Master gain for music, under the sound effects so speech and swings
 *  stay legible over it. */
export const MUSIC_GAIN = 0.22;

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
  const out = [];
  for (const e of events) {
    if (e.tick >= toTick) break;          // events are tick-ordered
    if (e.tick >= fromTick) out.push(e);
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
  constructor(ctx, destination = null) {
    this.ctx = ctx;
    this.song = null;
    this.playing = false;
    this.loop = true;
    this._timer = null;
    this._voices = [];
    this._master = null;
    this._destination = destination;
  }

  _ensureMaster() {
    if (this._master || !this.ctx) return;
    this._master = this.ctx.createGain();
    this._master.gain.value = MUSIC_GAIN;
    this._master.connect(this._destination ?? this.ctx.destination);
  }

  /** Start a decoded song (hmiFile getSong result). Idempotent per song. */
  play(song) {
    if (!this.ctx || !song || !song.events?.length) return false;
    if (this.playing && this.song === song) return true;
    this.stop();
    this._ensureMaster();
    this.song = song;
    this.playing = true;
    this._state = freshChannelState();
    this._cursorTick = 0;
    // Everything is scheduled relative to this, so the whole song shares
    // one origin and cannot drift against the wall clock.
    this._originTime = this.ctx.currentTime + 0.06;
    this._pump();
    this._timer = setInterval(() => this._pump(), TICK_INTERVAL_MS);
    return true;
  }

  stop() {
    this.playing = false;
    if (this._timer !== null) { clearInterval(this._timer); this._timer = null; }
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
    const toTick = Math.min(nowTick + aheadTicks, durationTicks + 1);

    // AUDIT 19 F8: A STALLED TAB IS NOT A REASON TO PLAY THE PAST. A
    // background throttle can park this loop for a second or more; on the
    // next pump `nowTick` has jumped far ahead of `_cursorTick`, and every
    // note in between would be scheduled with a start time already gone -
    // WebAudio fires those IMMEDIATELY, so ~75 notes arrive as one burst.
    // Skip the gap instead: the song is a looping cue, and losing a beat
    // is better than detonating it.
    if (nowTick - this._cursorTick > aheadTicks) {
      this._cursorTick = nowTick;
      // Fold the skipped control events forward so the instruments and
      // volumes on the far side of the gap are still right.
      applyChannelEvents(this._state, eventsInWindow(events, 0, nowTick)
        .filter((e) => e.type !== 'noteOn'));
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
        if (e.type !== 'noteOn' || !e.velocity) continue;
        this._voice(e, this._originTime + e.tick * secondsPerTick,
          (e.duration || 0) * secondsPerTick);
      }
      this._cursorTick = toTick;
    }

    // Loop: songs are 4-44s cues, so ending in silence is wrong. Rewind
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
      this._cursorTick = 0;
      this._originTime = this.ctx.currentTime + LOOP_LEAD_SECONDS;
      this._pump();          // schedule the seam NOW, not on the next tick
      return;
    }
    // Drop finished voices so a long song does not grow an unbounded list.
    if (this._voices.length > 512) {
      this._voices = this._voices.filter((v) => v.endsAt > this.ctx.currentTime);
    }
  }

  /** Build and schedule ONE note. The only method that touches the graph. */
  _voice(e, when, durationSeconds) {
    const ctx = this.ctx;
    const ch = this._state[e.channel] ?? { program: 0, volume: 1, pan: 0, bend: 0 };
    const dur = Math.max(0.05, durationSeconds || 0.2);
    const amp = velocityGain(e.velocity) * ch.volume;
    if (amp <= 0) return;

    const gain = ctx.createGain();
    let node;
    let spec;

    if (e.channel === PERCUSSION_CHANNEL) {
      spec = percussionSpec(e.note);
      if (spec.kind === 'noise') {
        node = ctx.createBufferSource();
        node.buffer = this._noiseBuffer();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = spec.hz;
        bp.Q.value = 1.2;
        node.connect(bp);
        bp.connect(gain);
      } else {
        node = ctx.createOscillator();
        node.type = 'sine';
        node.frequency.setValueAtTime(spec.hz, when);
        // A drum's pitch drop is what makes it read as a drum.
        node.frequency.exponentialRampToValueAtTime(spec.hz * 0.5, when + spec.decay);
        node.connect(gain);
      }
      const peak = amp * spec.gain;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(peak, when + spec.attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + spec.attack + spec.decay);
      this._connect(gain, ch.pan);
      node.start(when);
      node.stop(when + spec.attack + spec.decay + 0.02);
      this._voices.push({ stop: () => node.stop(), endsAt: when + spec.attack + spec.decay });
      return;
    }

    // TWO-OPERATOR FM, the synthesis Daggerfall was scored for: a
    // modulator sine driving the carrier's FREQUENCY, not its amplitude.
    // The modulator's output is in Hz, so a gain of index*hz gives a
    // modulation depth of `index` multiples of the carrier - which is
    // what "brightness" means in FM.
    spec = fmSpec(ch.program);
    const hz = noteToHz(e.note);
    const t0 = when;
    const tA = t0 + spec.attack;
    const tD = tA + spec.decay;
    const tOff = Math.max(tD, t0 + dur);
    const end = tOff + spec.release;

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = hz * spec.car;
    if (ch.bend) carrier.detune.value = ch.bend;

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = hz * spec.mod;
    if (ch.bend) mod.detune.value = ch.bend;

    const modGain = ctx.createGain();
    // The index DECAYS: a real instrument's bright attack settles into a
    // duller sustain, and a fixed index is the "cheap FM" sound.
    const depth = Math.max(1, spec.index * hz);
    modGain.gain.setValueAtTime(depth, t0);
    modGain.gain.exponentialRampToValueAtTime(
      Math.max(1, depth * 0.12), t0 + Math.max(0.02, spec.idxDecay));
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(gain);

    const peak = amp * spec.gain;
    const sustain = Math.max(0.0001, peak * spec.sustain);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, peak), tA);
    gain.gain.exponentialRampToValueAtTime(sustain, tD);
    gain.gain.setValueAtTime(sustain, tOff);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    this._connect(gain, ch.pan);
    mod.start(t0); carrier.start(t0);
    mod.stop(end + 0.02); carrier.stop(end + 0.02);
    this._voices.push({ stop: () => { mod.stop(); carrier.stop(); }, endsAt: end });
  }

  _connect(gain, pan) {
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(p);
      p.connect(this._master);
      return;
    }
    gain.connect(this._master);
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
