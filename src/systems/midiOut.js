// MIDI-OUT1 (2026-10-11, a player asking for MIDI out): THE SONGS ON A MIDI DEVICE - a hardware synth on a cable, a
// software one on a virtual port - in place of the port's FM bank.
//
// NO DFU SOURCE. DaggerfallSongPlayer renders its .mid files with its vendored synth and a SoundFont and has no
// output to a device; the original game reached one through HMI's sound driver (a General MIDI card or a Roland on
// the MPU-401 port), which is the sound Daggerfall was scored for beside the FM arrangements. So this is ours, a
// recorded departure (Port-Ledger A): the DATA path is the same one the synth plays - hmiFile's event stream,
// songManager's tables, SongPlayer's lookahead pump - and only the voice changes. MidiOutSongPlayer IS a SongPlayer:
// it overrides the methods that touch the audio graph (`_voice`, `_control`, the gains) and hands the device the
// event instead, timestamped on the Web MIDI clock, so the loop, the seam, the stall skip and the song's own
// channel state are the one scheduler's, not a second copy of it.
//
// WHAT THE DEVICE IS SENT. Every channel event in the stream, as its bytes: note-on, controllers, program changes,
// pitch bend, the two pressures. Not sent: HMI's own events and the meta events (they are the driver's, not MIDI's),
// and system exclusive (asking for sysex makes the browser ask the player a second, scarier question, and nothing the
// songs need is in it). THE NOTE-OFFS ARE THE PLAYER'S: it releases each note at the length the synth gives it
// (songPlayer.js noteSeconds over sustainedDuration), because a song made in code (systems/gate/gateScore.js) carries
// lengths and no note-offs, and because a release queued seconds ahead cannot be taken back - Chrome has never had
// MIDIOutput.clear() - and would cut the next song's note. Releases are queued a window at a time like everything
// else. The sustain pedal (CC64) is sent as well; it releases nothing the length has not already released.
//
// THE VOLUME IS CC7. A device has no gain node, so the player's MusicVolume, the video mute (trackGain - the setting
// alone, as a replacement pack has it: MUSIC_GAIN is the FM bank's trim), a song's own level (songLevel) and the
// switch's fade (DISC20-B) are all multiplied into every channel's CC7, and re-sent when one of them moves - each
// pump through a fade, at once for the slider. The press (WB10a) is the synth's and is not applied.
//
// A CLEAN DEVICE PER SONG. A song starts as freshChannelState starts the synth - program 0, volume full, pan centre,
// bend centre, controllers reset (CC121) - so nothing of the last song (or another program's) carries over; a stop
// releases every note it struck and sends the pedal up and all-notes-off on every channel, and the next song starts
// after the last message the stopped one queued.

import {
  SongPlayer, eventsInWindow, noteSeconds, songLevel, trackGain,
} from './song/songPlayer.js';
import { getPref, setPref } from './uiPrefs.js';

/** The shelf's key: the output's name, '' for none (systems/uiPrefs.js). */
export const MIDI_OUT_PREF = 'midiOut';

/** A millisecond: the gap that keeps two messages the device must take in order from sharing a timestamp. */
export const MIDI_GAP_S = 0.001;

const clamp7 = (v) => Math.max(0, Math.min(127, Math.trunc(Number(v) || 0)));

/**
 * One channel event as the bytes a MIDI device takes, or null for an event that is not sent (HMI's own, meta, sysex,
 * an event with no channel). Pure. Note-offs are made by the player (above), but read here too, so one table holds the
 * vocabulary. Out-of-range values CLAMP: the reader hands through what the bytes said and a song made in code adds
 * accents to its velocities, and a data byte with bit 7 set is a status byte to the device.
 */
export function midiMessage(e) {
  const ch = e?.channel;
  if (!Number.isInteger(ch) || ch < 0 || ch > 15) return null;
  switch (e.type) {
    case 'noteOn': return [0x90 | ch, clamp7(e.note), clamp7(e.velocity)];
    case 'noteOff': return [0x80 | ch, clamp7(e.note), clamp7(e.velocity)];
    case 'polyPressure': return [0xa0 | ch, clamp7(e.note), clamp7(e.pressure)];
    case 'controller': return [0xb0 | ch, clamp7(e.controller), clamp7(e.value)];
    case 'programChange': return [0xc0 | ch, clamp7(e.program)];
    case 'channelPressure': return [0xd0 | ch, clamp7(e.pressure)];
    case 'pitchBend': {
      const v = Math.max(0, Math.min(16383, Math.trunc(Number(e.value) || 0)));
      return [0xe0 | ch, v & 0x7f, v >> 7];
    }
    default: return null;
  }
}

/** A song's CC7 under the player's volume, its own level and the fade - a GAIN, so it is applied under the square
 *  root. AUDIT MIDI-OUT1: General MIDI's CC7 law is 40 log10(v/127) dB - amplitude (v/127)^2, the square the synth's
 *  own volumeGain is (gmSynth.js) - so CC7 x g sounds g^2, and a linear scale played the default volume at a quarter
 *  (-12 dB, not -6) and ran every fade along the square. CC7 x sqrt(g) sounds g. Pure; never past 127, never under 0:
 *  a device has no headroom over 127, so a song's level past 1 tops out once volume x level passes 1. */
export function scaledVolume(raw, scale) {
  const g = Number.isFinite(scale) && scale > 0 ? scale : 0;
  return Math.max(0, Math.min(127, Math.round(clamp7(raw) * Math.sqrt(g))));
}

/** What a channel is told as a song begins - freshChannelState's own (program 0, pan centre, bend centre), after
 *  CC121 resets the controllers the song may not set. The volume follows, scaled (MidiOutSongPlayer._volume). */
export function channelResetMessages(ch) {
  return [[0xb0 | ch, 121, 0], [0xc0 | ch, 0], [0xb0 | ch, 10, 64], [0xe0 | ch, 0, 64]];
}

/** What a channel is told when a song stops: the pedal up, then all notes off. */
export function channelQuietMessages(ch) {
  return [[0xb0 | ch, 64, 0], [0xb0 | ch, 123, 0]];
}

/** The key a control event's LAST value is kept under, for the stall skip; null for an event that is not state
 *  (a note, the channel-mode controllers 120-127 - a reset re-sent would undo what follows it). */
export function stateKey(e) {
  if (!Number.isInteger(e?.channel)) return null;
  if (e.type === 'controller') return e.controller >= 120 ? null : `c${e.channel}:${e.controller}`;
  if (e.type === 'programChange' || e.type === 'pitchBend' || e.type === 'channelPressure') return `${e.type}${e.channel}`;
  return null;
}

/** Web MIDI's clock: a timestamp is performance.now()'s milliseconds, so the player keeps its time in those seconds. */
export const PERFORMANCE_CLOCK = Object.freeze({ get currentTime() { return globalThis.performance.now() / 1000; } });

/** The song player whose voice is a MIDI device (see the header). `output` is a MIDIOutput - anything with
 *  `send(bytes, timestampMs)`. */
export class MidiOutSongPlayer extends SongPlayer {
  constructor(output, clock = PERFORMANCE_CLOCK) {
    super(clock, null, null);
    this.output = output;
    this._notes = [];                          // { channel, note, on, off } - struck, not yet released
    this._raw7 = new Array(16).fill(127);      // the song's own CC7, per channel, before the scale
    this._sent7 = new Array(16).fill(-1);      // the CC7 the device ends up at, per channel
    this._at7 = new Array(16).fill(-Infinity); // when that CC7 is due - a re-level never lands under it
    this._fade = { from: 1, to: 1, t0: 0, t1: 0 };
    this._sentUntil = -Infinity;               // the latest timestamp handed the device
    this._quietAt = -Infinity;                 // a stopped song's last message: the next begins after it
    this._refused = false;
  }

  _send(bytes, when) {
    if (!bytes) return;
    if (when > this._sentUntil) this._sentUntil = when;
    try { this.output.send(bytes, when * 1000); } catch (e) {
      // A pulled cable throws on every send; say so once, not at every note
      if (!this._refused) { this._refused = true; console.warn('[midi-out] the device refused a message:', e?.message ?? e); }
    }
  }

  /** The fade (DISC20-B) at time t: linear, as the synth's fader ramps. */
  _fadeAt(t) {
    const { from, to, t0, t1 } = this._fade;
    if (t >= t1) return to;
    if (t <= t0) return from;
    return from + (to - from) * ((t - t0) / (t1 - t0));
  }

  _scale(t) { return trackGain() * songLevel(this.song) * this._fadeAt(t); }

  /** A channel's CC7, scaled, at `when` - or after the last one queued for it, never under it. */
  _volume(ch, when) {
    const at = Math.max(when, this._at7[ch]);
    const v = scaledVolume(this._raw7[ch], this._scale(at));
    this._send([0xb0 | ch, 7, v], at);
    this._sent7[ch] = v;
    this._at7[ch] = at;
  }

  /** The volume, the mute, the level or the fade moved: re-send each channel's CC7 that it changed. */
  _relevel(now) {
    if (!this.playing) return;
    for (let ch = 0; ch < 16; ch++) {
      const at = Math.max(now, this._at7[ch] + MIDI_GAP_S);
      if (scaledVolume(this._raw7[ch], this._scale(at)) !== this._sent7[ch]) this._volume(ch, at);
    }
  }

  /** Release every note due by `until`, at its own time. */
  _release(until) {
    if (!this._notes.length) return;
    const keep = [];
    for (const n of this._notes) {
      if (n.off <= until) this._send([0x80 | n.channel, n.note, 0], n.off);
      else keep.push(n);
    }
    this._notes = keep;
  }

  // ── the graph's methods, answered by the device ──
  _ensureMaster() {}
  _routePress() {}
  _resyncChannelGains() {}
  _cancelChannelGains() {}

  /** A song (or a loop's next pass) begins after the last message a stopped one queued, on a clean device. */
  _origin(lead) {
    const t = Math.max(this.ctx.currentTime + lead, this._quietAt + 2 * MIDI_GAP_S);
    const at = t - MIDI_GAP_S;
    for (let ch = 0; ch < 16; ch++) {
      for (const m of channelResetMessages(ch)) this._send(m, at);
      this._raw7[ch] = 127;
      this._at7[ch] = -Infinity;
      this._volume(ch, at);
    }
    return t;
  }

  /** The stall skip: the state the gap moved, told to the device now (each control's last value). */
  _skip(toTick) {
    super._skip(toTick);
    const last = new Map();
    for (const e of eventsInWindow(this.song.events, 0, toTick)) {
      const k = stateKey(e);
      if (k) { last.delete(k); last.set(k, e); }   // AUDIT: in the order of each LAST value - a bank select before its program
    }
    const now = this.ctx.currentTime;
    for (const e of last.values()) this._control(e, now);
  }

  _voice(e, when, durationSeconds) {
    // A key struck again while it still sounds - or on its own release's tick, which origin + tick + length can round
    // a hair past - is released first, at the strike: a note-off ends whichever note holds the key, so the earlier
    // note's own release would cut this one (AUDIT). Its pending release goes with it.
    const key = clamp7(e.note);
    if (this._notes.some((n) => n.channel === e.channel && n.note === key)) {
      this._notes = this._notes.filter((n) => {
        if (n.channel !== e.channel || n.note !== key) return true;
        this._send([0x80 | n.channel, n.note, 0], when);
        return false;
      });
    }
    this._send(midiMessage(e), when);
    this._notes.push({ channel: e.channel, note: clamp7(e.note), on: when, off: when + noteSeconds(durationSeconds) });
  }

  _control(e, when) {
    if (e.type === 'noteOff') return;   // the player's own (_voice, _release)
    if (e.type === 'controller' && e.controller === 7 && Number.isInteger(e.channel)) {
      this._raw7[e.channel] = clamp7(e.value);
      this._volume(e.channel, when);
      return;
    }
    this._send(midiMessage(e), when);
  }

  _pump() {
    super._pump();
    if (!this.playing || !this.song) return;
    this._release(this._originTime + this._cursorTick * this.song.secondsPerTick);   // the releases inside the window
    this._relevel(this.ctx.currentTime);
  }

  fadeTo(level, seconds) {
    const now = this.ctx.currentTime;
    const to = Math.max(0, Number(level) || 0);
    this._fade = { from: this._fadeAt(now), to, t0: now, t1: now + (seconds > 0 ? seconds : 0) };
    this._relevel(now);
  }

  resyncGain() { this._relevel(this.ctx.currentTime); }

  stop() {
    // AUDIT: a player already quiet - never played, or stopped and not played since - has nothing to silence
    const quietAlready = !this.playing && !this._notes.length && this._quietAt >= this._sentUntil;
    super.stop();
    if (quietAlready) return;
    const now = this.ctx.currentTime;
    const quiet = Math.max(now, this._sentUntil) + MIDI_GAP_S;
    try { this.output.clear?.(); } catch { /* not every engine has it */ }
    // every note struck and not released - a note-on still queued is answered just after it
    for (const n of this._notes) this._send([0x80 | n.channel, n.note, 0], Math.max(now, n.on + MIDI_GAP_S));
    this._notes = [];
    for (let ch = 0; ch < 16; ch++) {
      for (const m of channelQuietMessages(ch)) {
        this._send(m, now);
        if (quiet > now + MIDI_GAP_S) this._send(m, quiet);   // and again after anything the window had queued
      }
    }
    this._quietAt = quiet;
  }
}

// ── the device ──

let _access = null;     // the promise of the MIDIAccess, once asked
let _denied = null;     // why it was refused, when it was
const _listeners = new Set();

/** Can this browser reach a MIDI device at all? (Safari cannot.) */
export const midiOutSupported = (nav = globalThis.navigator) => typeof nav?.requestMIDIAccess === 'function';

/** Why the last ask was refused, or null. */
export const midiOutDenied = () => _denied;

/** The picked output's name, '' for none. */
export const midiOutName = () => String(getPref(MIDI_OUT_PREF) ?? '');

/** Hear a pick, or a device plugged in or pulled out. Returns the unsubscribe. */
export function onMidiOutChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function publish() {
  for (const fn of [..._listeners]) {
    try { fn(midiOutName()); } catch (e) { console.warn('[midi-out] a listener threw:', e?.message ?? e); }
  }
}

/** The row's next pick after `current` among the connected `outputs`: the next device, then Off ('').
 *  AUDIT: by DISTINCT name - two devices sharing one (two "USB MIDI Interface"s) trapped a by-index walk on the second,
 *  and a pick is kept by name, so only the first of them can be reached. A pick that is not connected (pulled out)
 *  steps to the first device that is, not to Off. Pure. */
export function nextMidiOut(current, outputs) {
  const names = ['', ...new Set((outputs ?? []).map((o) => o.name))];
  const at = names.indexOf(String(current ?? ''));
  if (at < 0) return names[Math.min(1, names.length - 1)];
  return names[(at + 1) % names.length];
}

/** Pick an output by name ('' for none): the shelf keeps it, and the music moves to it. */
export function setMidiOut(name) {
  setPref(MIDI_OUT_PREF, String(name ?? ''));
  publish();
}

/** The MIDIAccess, asked once (the browser may ask the player). A refusal answers null and may be asked again. */
export function midiAccess(nav = globalThis.navigator) {
  if (!midiOutSupported(nav)) return Promise.resolve(null);
  _access ??= nav.requestMIDIAccess({ sysex: false }).then((a) => {
    _denied = null;
    a.onstatechange = (ev) => { if (!ev?.port || ev.port.type === 'output') publish(); };
    return a;
  }, (e) => {
    _denied = e?.message ?? String(e);
    _access = null;
    return null;
  });
  return _access;
}

/** The outputs connected now, as { id, name }. */
export async function midiOutputs(nav) {
  const a = await midiAccess(nav);
  if (!a) return [];
  return [...a.outputs.values()].filter((o) => o.state !== 'disconnected').map((o) => ({ id: o.id, name: o.name }));
}

/** The connected output with this name, or null - none picked, none connected, or no access. */
export async function findMidiOutput(name, nav) {
  if (!name) return null;
  const a = await midiAccess(nav);
  if (!a) return null;
  for (const o of a.outputs.values()) if (o.name === name && o.state !== 'disconnected') return o;
  return null;
}

/** Tests only: forget the access, so the next ask is a fresh one. */
export function _resetMidiOutForTests() { _access = null; _denied = null; }
