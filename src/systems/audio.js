// A1: runtime sound playback over the shipped DAGGER.SND reader.
// DFU plays SoundClips (enum values = DAGGER.SND record indices)
// through Unity AudioSources; the WebAudio engine here is the
// approved engine-side departure (Port-Ledger A) - the DATA path
// (indices, per-weapon/per-enemy clip selection, volumes) stays 1:1
// with the DFU call sites it serves.
//
// Mobile discipline: an AudioContext starts suspended until a user
// gesture - resume() rides the first pointer/key/touch event, and
// every play call is a silent no-op until the context runs. Records
// decode lazily (8-bit unsigned mono 11025 Hz -> Float32 AudioBuffer,
// (byte - 128) / 128) and cache by index.

import { SndFile, SAMPLE_RATE } from '../formats/sndFile.js';
import { getFloat } from './settings/settings.js';   // SETT: SoundVolume
import { REVERB_PRESET, reverbImpulse } from './reverbPresets.js';   // BA1: AudioReverbZone's presets and the impulse built from them
import { setEquipSoundSink } from './equip.js';   // ES2: the equip moment's one audio door
import { SOUND_REPLACEMENTS, soundBufferKey, fetchReplacement, soundSilenced, soundReplacementGen } from './soundReplacer.js';   // SNDREP1: a player's loose WAVs over classic clips, and the two night-sound switches

/** The ArrayBuffer decodeAudioData is allowed to detach: THE VIEW'S OWN
 *  RANGE, not the whole backing store.
 *
 *  AUDIT 39: this was `bytes.buffer.slice(0)`, which ignores byteOffset
 *  and byteLength - a clip served out of an archive as a zero-copy
 *  subarray (mwBsaFile.get) handed the decoder the ENTIRE .bsa, so the
 *  decode failed on the archive header, the clip silently never
 *  registered, and a full copy of the archive was allocated per attempt.
 *  A plain ArrayBuffer argument passes through untouched (decodeAudioData
 *  detaches it, which is why a view is copied at all). */
export function decodableCopy(bytes) {
  if (!bytes?.buffer) return bytes;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/** Unsigned 8-bit PCM -> Float32 samples, verbatim (b - 128) / 128. */
export function pcm8ToFloat32(bytes) {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = (bytes[i] - 128) / 128;
  return out;
}

/**
 * 3D-AUDIO (Discord, 2026-09-23: "it always sounds like the opposite or directly in front of you while the mob is
 * behind"): THE HANDEDNESS LAW, AT THE AUDIO DOOR. The scene is Daggerfall Unity's LEFT-handed frame - x east, y up,
 * z north, so facing +Z the right hand is +X. The renderer turns it once (world/mat4.js mirrorProjectionX); the
 * audio never did, and WebAudio is RIGHT-handed - its listener's right is forward x up, which facing +Z is -X. Every
 * positional sound in the port played on the mirrored side. The turn is here, once, for the listener and every
 * source alike (negating z: a reflection, so directions, distances and the listener's up are kept), and every caller
 * keeps speaking scene coordinates.
 */
export const audioFrame = (p) => [p[0], p[1], -p[2]];
/** Place a PannerNode at a scene point. */
export function placeAudio(pan, p) {
  const [x, y, z] = audioFrame(p);
  pan.positionX.value = x; pan.positionY.value = y; pan.positionZ.value = z;
}
/** RAIN-LEAK: a stopped loop lets go of EVERY node it built - its source, gain, panner and low-pass. Disconnecting the
 *  source alone left the rest wired into the bus, which a browser may keep alive for the page's life: a gain and a
 *  filter per rain shower. Null nodes are skipped; a node already gone is no fault. */
export function releaseNodes(...nodes) {
  for (const n of nodes) { if (n) { try { n.disconnect(); } catch { /* gone */ } } }
}
/** The panning model every positional source takes (see AudioEngine._panner). */
export const PANNING_MODEL = 'HRTF';
/** AUDIT GATHER-FEEL F7: how long a voice taken back (play3dVoice's `stop`) takes to fade to nothing (s) - a stop at its
 *  level pops. */
export const VOICE_FADE_S = 0.08;

/** PEERFX1: one observer of every one-shot (index, volume) - the online layer hears "a blow landed on me" here
 *  (net/peer/peerFx.js isHurtClip). Null offline. */
let _oneShotObserver = null;
export function setOneShotObserver(fn) { _oneShotObserver = typeof fn === 'function' ? fn : null; }

/** AUDIT SD III (A3): how long a named bed (AudioEngine.setBed) takes to rise as it begins and to fade as it is let go
 *  (s) - the arena's crowd bed's (systems/arena/arenaSound.js BED_FADE_S). */
const BED_FADE_S = 0.4;

/** GATE-MIX (2026-10-20, the owner: "in oblivion gates ... the game hitches, audio becomes super loud and even
 *  distorts"): THE LIMITER - the last stage before the speakers, every bus through it. Nothing stood there: the boss's
 *  clips peak at full scale in DAGGER.SND (his bark, his attack, a body's fall, the fire's cast - measured), his cues
 *  play them at up to 2.2 times that, several land in one frame, and the court's score is pressed to a decibel under
 *  the clip - so the sum went past 1 and the browser cut it square. Unity's mixer clips the same way; this is the
 *  port's own stage, not a DFU member. A compressor run as a limiter (a hard ratio over LIMITER.threshold, fast to take
 *  hold, quick to let go) holds a loud moment down cleanly, and a soft ceiling after it (`limiterCurve`) rounds off
 *  what its attack lets through, so nothing reaches past LIMIT_CEILING by construction. Below the threshold the stage
 *  is unity: the compressor's own make-up gain (the Web Audio spec's, `limiterTrim`) is taken back out. */
export const LIMITER = Object.freeze({ threshold: -3, knee: 0, ratio: 20, attack: 0.001, release: 0.12 });
/** The soft ceiling: straight up to LIMIT_LINEAR, then a tangent's shoulder to LIMIT_CEILING (both full-scale
 *  amplitudes); the curve reaches LIMIT_RANGE times full scale (12 dB over it) - past that, its end. */
export const LIMIT_LINEAR = 0.75;
export const LIMIT_CEILING = 0.98;
export const LIMIT_RANGE = 4;
/** The ceiling at a signal amplitude `s`: itself to LIMIT_LINEAR, then bent to approach LIMIT_CEILING (its slope 1
 *  where the bend begins, so the knee is not heard). Odd. Pure. */
export function limitAmplitude(s) {
  const a = Math.abs(s);
  if (a <= LIMIT_LINEAR) return s;
  const room = LIMIT_CEILING - LIMIT_LINEAR;
  return Math.sign(s) * (LIMIT_LINEAR + room * Math.tanh((a - LIMIT_LINEAR) / room));
}
let _limiterCurve = null;
/** The ceiling over the WaveShaper's [-1, 1] - its input is the signal over LIMIT_RANGE (the trim's gain carries it
 *  there), its output the signal's own amplitude. Made once. */
export function limiterCurve(n = 4097) {
  if (_limiterCurve && _limiterCurve.length === n) return _limiterCurve;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = limitAmplitude(LIMIT_RANGE * ((2 * i) / (n - 1) - 1));
  return (_limiterCurve = c);
}
/** The gain that takes a DynamicsCompressorNode's make-up back out: the spec's make-up is (1 / full-range gain)^0.6,
 *  the full-range gain the curve's answer at full scale - with no knee, threshold + (0 - threshold) / ratio dB. */
export const limiterTrim = ({ threshold, ratio } = LIMITER) => 10 ** ((0.6 * threshold * (1 - 1 / ratio)) / 20);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.snd = null;
    this.buffers = new Map();   // index -> AudioBuffer
    this.enabled = false;
    // NT1 (F215): null, not false - the ??= boot latch below rejects a
    // false (music.js:"this._booted = null" learned this at AUDIT 19).
    this._booted = null;
    this._listener = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1 };
    this._master = null;   // SETT: the SoundVolume bus (see _out)
    // EG-ZH (Elite-Gates.md section 26, THE SPIRE MIX): the gain every one-shot made inside `scaled` is played at (1 out of it)
    this._scale = 1;
    // EG-ZH (section 11.9): THE HELD ZONE - who holds the reverb (null: nobody, and Better Ambience's setReverb rules), its
    // two convolvers, and each preset's impulse made once for the hold
    this._reverbOwner = null;
    this._zone = null;
    this._reverbBuffers = null;
  }

  /** SETT-slice: the master bus. DFU scales every clip by
   *  DaggerfallUnity.Settings.SoundVolume (DaggerfallAudioSource sets
   *  AudioSource.volume from it); a WebAudio graph does it once with
   *  a gain node every source connects through, so the setting is one
   *  multiply rather than one per call site. Re-read on each
   *  connection so a launcher change lands on the next sound. */
  _out() {
    if (!this.ctx) return null;
    // minted once per context (a re-created context invalidates it)
    if (!this._master || this._master.context !== this.ctx) {
      // DW-D: THE LISTENER - the last node before the speakers, every bus through it (this master, the reverb's
      // wet, the music's master): what Unity hangs on the AudioListener takes the whole mix (setListenerLowPass)
      this._listenerIn = this.ctx.createGain();
      this._sink = this._limiter();   // GATE-MIX: the limiter's input - the speakers themselves on a context without one
      this._listenerIn.connect(this._sink);
      this._listenerFilter = null; this._listenerCut = 0;
      this._master = this.ctx.createGain();
      this._master.connect(this._listenerIn);
      // BA1 / AUDIT-BA F4: THE REVERB SEND. Unity's zone takes every AudioSource the listener stands near at its
      // reverbZoneMix (1 by default) - the music's included. The port's music runs its own master on the same
      // context (systems/song/songPlayer.js), so the zone is a SEND node both masters feed; setReverb hangs the
      // convolver off it, and nothing is downstream of it while no zone is on.
      this._reverbIn = this.ctx.createGain();
      this._master.connect(this._reverbIn);
      this._reverb = null;   // a new context is a new bus; the zone is re-armed by its next setReverb
    }
    this._master.gain.value = getFloat('Controls', 'SoundVolume', 0, 1);
    return this._master;
  }

  /** GATE-MIX: the limiter (LIMITER, limiterCurve) built on this context and wired to the speakers - its compressor
   *  answered as the stage's input. A context with no compressor or no shaper (an old engine, a test's) answers the
   *  speakers: the mix plays as it did. */
  _limiter() {
    const ctx = this.ctx;
    if (typeof ctx.createDynamicsCompressor !== 'function' || typeof ctx.createWaveShaper !== 'function') return ctx.destination;
    const comp = ctx.createDynamicsCompressor(), trim = ctx.createGain(), ceiling = ctx.createWaveShaper();
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) comp[k].value = LIMITER[k];
    trim.gain.value = limiterTrim() / LIMIT_RANGE;   // the make-up taken back out, and the signal into the curve's [-1, 1]
    ceiling.curve = limiterCurve();
    ceiling.oversample = 'none';   // a straight curve under the shoulder is exact unsampled: the everyday mix untouched
    comp.connect(trim);
    trim.connect(ceiling);
    ceiling.connect(ctx.destination);
    this._limiterNodes = { comp, trim, ceiling };
    return comp;
  }

  /** BA1: AudioLowPassFilter - a biquad low-pass at `cutoffHz` (Unity's default resonance Q 1). DW-D: a Web Audio
   *  low-pass reads its Q in DECIBELS (the spec's alpha = sin w0 / (2 * 10^(Q/20))), so Unity's linear 1 is 0 here -
   *  the 1 this held was a 1 dB peak at the cutoff. */
  _lowpass(cutoffHz) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoffHz;
    f.Q.value = 0;
    return f;
  }

  /** BA1: AudioReverbZone (ReverbMod.cs) - Unity's zone sits on the player with min and max distance 1000, so
   *  the listener is always at its centre and EVERY source (2D and 3D alike, reverbZoneMix 1) is sent through
   *  the preset's reverb and heard wet beside its dry self. The port's bus is one master gain, so the zone is a
   *  convolver hung off it: master -> destination (dry) and master -> convolver -> wet -> destination. The
   *  impulse is SYNTHESISED from the preset's I3DL2 numbers (systems/reverbPresets.js) - the decay time, its
   *  high-frequency ratio, the reflections and reverb levels and delays - not FMOD's algorithm; the shape is
   *  the preset's, the exact tail is not. `preset` null takes the zone off. */
  setReverb(preset) {
    if (this._reverbOwner != null) return false;   // EG-ZH: the zone is held (holdReverb) - its holder's alone until it lets go
    this._ensureCtx();
    if (!this.ctx) return false;
    this._out();
    const send = this._reverbIn;
    if (this._reverb) { try { send.disconnect(); this._reverb.wet.disconnect(); } catch { /* gone */ } this._reverb = null; }
    if (!preset) return true;
    const p = typeof preset === 'string' ? REVERB_PRESET[preset] : preset;
    if (!p) return false;
    const conv = this.ctx.createConvolver();
    conv.normalize = false;
    conv.buffer = reverbImpulse(this.ctx, p);
    const wet = this.ctx.createGain();
    wet.gain.value = 1;
    send.connect(conv).connect(wet).connect(this._listenerIn);   // DW-D: through the listener, as every bus
    this._reverb = { conv, wet, preset: typeof preset === 'string' ? preset : 'custom' };
    return true;
  }
  get reverbPreset() { return this._reverb?.preset ?? null; }

  /** EG-ZH (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 11.9): THE HALL'S
   *  REVERB, HELD. setReverb builds a new ConvolverNode and synthesises its impulse on every call (Cave: 25-41 ms on a
   *  desktop, AUDIT EG II L4-21), so a place that changes its reverb as the player walks HOLDS the zone instead: Better
   *  Ambience (whose own wish re-asserts its preset against its `reverbOn` cache) yields while it is held, and its cache is
   *  forgotten, so its next frame after the release asserts its preset again. Holding takes whatever zone stood off the
   *  send; releasing frees the held zone's convolvers and every impulse made for the hold. Answers whether it holds. */
  holdReverb(owner) {
    if (owner == null) return false;
    if (this._reverbOwner === owner) return true;
    if (this._reverb) { try { this._reverbIn?.disconnect(); this._reverb.wet.disconnect(); } catch { /* gone */ } this._reverb = null; }
    this._reverbOwner = owner;
    return true;
  }
  /** EG-ZH: the hold let go by its holder (another's word lets nothing go) - the held zone off the send, its impulses freed.
   *  Answers whether it let go. */
  releaseReverb(owner) {
    if (owner == null || this._reverbOwner !== owner) return false;
    this._reverbOwner = null;
    this._dropZone();
    this._reverbBuffers = null;
    return true;
  }
  /** EG-ZH: who holds the zone, or null. */
  reverbHeld() { return this._reverbOwner; }
  /** EG-ZH: a preset's impulse, made once for the hold (`name` one of systems/reverbPresets.js REVERB_PRESET's). */
  _heldImpulse(name) {
    const p = REVERB_PRESET[name];
    if (!p) return null;
    this._reverbBuffers ??= new Map();
    if (!this._reverbBuffers.has(name)) this._reverbBuffers.set(name, reverbImpulse(this.ctx, p));
    return this._reverbBuffers.get(name);
  }
  /** EG-ZH: one slot of the held zone - its convolver off the send and its wet gain into the listener, `gain` at once. */
  _zoneSlot(name, gain) {
    const buf = name ? this._heldImpulse(name) : null;
    if (!buf) return { preset: null, conv: null, wet: null };
    const conv = this.ctx.createConvolver();
    conv.normalize = false;
    conv.buffer = buf;
    const wet = this.ctx.createGain();
    wet.gain.value = gain;
    this._reverbIn.connect(conv);
    conv.connect(wet).connect(this._listenerIn);
    return { preset: name, conv, wet };
  }
  _dropSlot(slot) {
    if (!slot?.conv) return;
    try { this._reverbIn?.disconnect(slot.conv); } catch { /* gone */ }
    try { slot.conv.disconnect(); slot.wet.disconnect(); } catch { /* gone */ }
  }
  _dropZone() {
    if (!this._zone) return;
    for (const slot of this._zone.slots) this._dropSlot(slot);
    this._zone = null;
  }
  /** EG-ZH: THE HELD ZONE MADE (at a hall's swap or pull, behind the veil): two convolvers off the send - `live` heard whole,
   *  `idle` at nothing, ready for the crossfade - each preset's impulse made once for the hold, and a slot already holding
   *  its preset kept as it is. Only while held. Answers whether the zone stands. */
  reverbZone(live, idle = null) {
    if (this._reverbOwner == null) return false;
    this._ensureCtx();
    if (!this.ctx || !this._out()) return false;
    const was = this._zone?.slots ?? [];
    const keep = (name, gain) => {
      const i = was.findIndex((q) => q && q.preset === name && name != null);
      if (i < 0) return this._zoneSlot(name, gain);
      const slot = was[i];
      was[i] = null;
      try { slot.wet.gain.cancelScheduledValues?.(this.ctx.currentTime); } catch { /* none */ }
      slot.wet.gain.value = gain;
      return slot;
    };
    const a = keep(live, 1), b = idle != null && idle !== live ? keep(idle, 0) : { preset: null, conv: null, wet: null };
    for (const slot of was) this._dropSlot(slot);
    this._zone = { slots: [a, b], live: 0 };
    return true;
  }
  /** EG-ZH: THE CROSSFADE (within a hall, at a fragment's mouth): the zone turned to `preset` over `seconds` - the idle
   *  convolver rising as the live one falls. A preset neither slot holds takes the idle slot (a new convolver on the
   *  hold's impulse - nothing synthesised). Answers whether it turned. */
  reverbFade(preset, seconds = 0.4) {
    const z = this._zone;
    if (!z || !preset) return false;
    if (z.slots[z.live].preset === preset) return false;
    const to = 1 - z.live;
    if (z.slots[to].preset !== preset) { this._dropSlot(z.slots[to]); z.slots[to] = this._zoneSlot(preset, 0); }
    if (!z.slots[to].wet) return false;
    const t = this.ctx.currentTime, s = Math.max(0, seconds);
    const ramp = (g, v) => { try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + s); } catch { g.value = v; } };
    ramp(z.slots[to].wet.gain, 1);
    if (z.slots[z.live].wet) ramp(z.slots[z.live].wet.gain, 0);
    z.live = to;
    return true;
  }
  /** EG-ZH: the held zone as it stands (tests, the lab): each slot's preset, and which is heard. */
  reverbZoneState() { return this._zone ? { presets: this._zone.slots.map((q) => q.preset), live: this._zone.live } : null; }

  /** EG-ZH (Elite-Gates.md section 26, THE SPIRE MIX): every one-shot `fn` makes (playOneShot, play3d) at `gain` times its
   *  own volume - the peers' sounds 4 dB down in the Spire (net/peer/peerFx.js peerHeard). Synchronous, and nested scopes
   *  multiply. Answers what `fn` answers. */
  scaled(gain, fn) {
    const was = this._scale;
    this._scale = was * (Number.isFinite(gain) && gain >= 0 ? gain : 1);
    try { return fn(); } finally { this._scale = was; }
  }
  /** AUDIT-BA F4: the zone's send, for a bus that is not this master (the music's). Null with no context. */
  reverbSend() { return this._out() ? this._reverbIn : null; }
  /** DW-D: the listener's input, for a bus that is not this master (the music's). Null with no context. */
  listenerBus() { return this._out() ? this._listenerIn : null; }

  /** DW-D: an AudioLowPassFilter on the AudioListener (Iliac Puddle No More's UnderwaterPresentationEffects: 1000 Hz
   *  while the presentation is under the sea) - the whole mix muffled; 0 takes it off. Idempotent per cutoff. */
  setListenerLowPass(cutoffHz) {
    this._ensureCtx();
    if (!this._out()) return;
    const want = cutoffHz > 0 ? cutoffHz : 0;
    if (want === this._listenerCut) return;
    const bus = this._listenerIn;
    try { bus.disconnect(); } catch { /* none */ }
    if (this._listenerFilter) { try { this._listenerFilter.disconnect(); } catch { /* gone */ } this._listenerFilter = null; }
    const sink = this._sink ?? this.ctx.destination;   // GATE-MIX: the limiter is still the last stage
    if (want) { this._listenerFilter = this._lowpass(want); bus.connect(this._listenerFilter).connect(sink); }
    else bus.connect(sink);
    this._listenerCut = want;
  }
  get listenerLowPass() { return this._listenerCut ?? 0; }

  /** AUDIT 18 F6: the one bootstrap every host calls.
   *
   *  AudioEngine is a module singleton and `enabled` is only ever set
   *  inside init(), so until some host called it every playOneShot /
   *  play3d / loop3d returned silently. Only buildDungeonContext did -
   *  which meant ?world and ?exterior were ENTIRELY SILENT (swings,
   *  fall damage, the A3 ambient effects, the A4 animal ambience, city
   *  guards, rain) until the player happened to enter a dungeon, after
   *  which the singleton stayed booted and the exterior gained sound
   *  on the way back out. DFU has no per-scene sound bootstrap at all:
   *  DaggerfallAudioSource/SoundReader are global singletons and
   *  AmbientEffectsPlayer.Start (:77-88) runs on the exterior prefab,
   *  so the exterior is audible from frame one.
   *
   *  Idempotent by construction, so every host entry point can call it
   *  unconditionally - which is the point: a host that forgets is the
   *  bug this replaces. */
  ensure(fetchBytes) {
    // ES2: the equip sound rings through this engine wherever it is
    // booted - registered HERE because every host's boot passes
    // through ensure, so no host can forget the wire (the FOUR HOSTS
    // RULE's structural arm). DaggerfallUI.PlayOneShot is a global
    // reach in C# for the same reason.
    setEquipSoundSink((clip) => this.playOneShot(clip));
    // NT1 (F215): the flag IS the promise - the sibling MusicService's
    // AUDIT 19 law ("a guard set before its own async work is not
    // idempotence, it is a race with a flag on it", music.js:"The flag is now the").
    // The boolean version returned to a concurrent second caller BEFORE
    // init finished, so that caller's immediate one-shots dropped while
    // `enabled` was still false. Every caller now awaits the same boot.
    return (this._booted ??= this._boot(fetchBytes));
  }

  async _boot(fetchBytes) {
    if (typeof window !== 'undefined') {
      // AUDIT 19 F2(vid): create the context EAGERLY, suspended. A browser
      // will not let it RUN before a gesture, but it will let it exist -
      // and code that resolves `audio.ctx` once at construction (the video
      // player does, deliberately, so its clock cannot move mid-stream)
      // needs it to exist by then or it plays silently forever. The
      // gesture still gates audibility; this only gates existence.
      //
      // BEFORE the await, deliberately: the context needs no archive, and
      // sitting behind the DAGGER.SND fetch meant a caller had to await
      // the whole load to get a clock - which parked the boot splash on a
      // black screen while the sound and music archives read in. The sync
      // prefix hands the context to an un-awaited caller immediately -
      // an async body runs synchronously to its first await, and _boot
      // is entered synchronously from ensure's ??=.
      this._ensureCtx();
      this.attachGestureResume();
    }
    await this.init(fetchBytes);
  }

  /** Load DAGGER.SND through the data seam. Safe to call before any
   *  gesture; the context itself is created lazily on resume. */
  async init(fetchBytes) {
    try {
      const f = new SndFile();
      f.load(await fetchBytes('DAGGER.SND'));
      this.snd = f;
      this.enabled = true;
    } catch (e) {
      console.warn('DAGGER.SND unavailable - sound disabled:', e?.message ?? e);
      this.enabled = false;
    }
  }

  /** Hook the first-gesture resume. Call once after init; idempotent. */
  attachGestureResume(target = window) {
    const resume = () => {
      this._ensureCtx();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      target.addEventListener(ev, resume, { passive: true });
    }
  }

  /** AUDIT 19: the context is NOT gated on `enabled`. `enabled` means
   *  DAGGER.SND loaded, which is what SOUND EFFECTS need - music and the
   *  video player need only a clock, and gating the context on a sound
   *  archive neither of them reads meant a missing DAGGER.SND silenced
   *  them too. Only the absence of the AudioContext API disables sound. */
  _ensureCtx() {
    if (this.ctx) return;
    if (typeof window === 'undefined') { this.enabled = false; return; }   // headless: the UI windows call playOneShot in node tests
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
  }

  /** SNDREP1: the decoded replacement from the player's attached sound pack for a classic index, or null - the
   *  first ask starts its load (once per attach), so until it has decoded the classic record answers, and with no
   *  pack (or a file that will not decode) the classic clip stays. */
  _replacement(index) {
    const name = SOUND_REPLACEMENTS[index];
    if (!name) return null;
    const gen = soundReplacementGen();
    const key = `${soundBufferKey(name)}#${gen}`;   // a re-attached pack is a new key, so the new file is read
    const b = this.buffers.get(key);
    if (b) return b;
    this._repLoads ??= new Set();
    if (!this._repLoads.has(key)) {
      this._repLoads.add(key);
      fetchReplacement(name).then((bytes) => (bytes ? this.registerSound(key, bytes) : false)).catch(() => false);
    }
    return null;
  }

  /** SNDREP1: start every replacement's load now, so the first night's crickets are already the new ones. */
  preloadReplacements() {
    for (const i of Object.keys(SOUND_REPLACEMENTS)) this._replacement(Number(i));
  }

  /** DISC11: a clip's RMS level over its whole buffer, measured once. Two recordings of one sound (DAGGER.SND's rain
   *  and Better Ambience's AmbientRaining.wav) are not equally loud at equal gain; this is how a caller matches them.
   *  Null while the clip is not decoded. */
  clipLevel(index) {
    const buf = this._buffer(index);
    if (!buf) return null;
    const cache = (this._levels ??= new WeakMap());
    let rms = cache.get(buf);
    if (rms === undefined) {
      let sum = 0, n = 0;
      for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) sum += d[i] * d[i]; n += d.length; }
      rms = n ? Math.sqrt(sum / n) : 0;
      cache.set(buf, rms);
    }
    return rms;
  }

  _buffer(index) {
    if (typeof index === 'number') {
      if (soundSilenced(index)) return null;   // SNDREP1: the player switched this sound off - it plays as a missing clip does: not at all
      const r = this._replacement?.(index); if (r) return r;   // a loose WAV from the attached pack wins once decoded
    }
    let b = this.buffers.get(index);
    if (b !== undefined) return b;
    // MW-D40: a REGISTERED buffer (a mod's own WAV, decoded through
    // registerSound below) answers by string key; only the classic
    // integer indexes fall through to DAGGERFALL.SND. An unregistered
    // string is null - the callers' own missing-clip shape.
    if (typeof index === 'string' || !this.snd) return null;
    const rec = this.snd.getSound(index);
    if (!rec || !rec.waveData?.length) { this.buffers.set(index, null); return null; }
    const samples = pcm8ToFloat32(rec.waveData);
    b = this.ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    b.getChannelData(0).set(samples);
    this.buffers.set(index, b);
    return b;
  }

  /** MW-D40: the external-sound door. Decodes a user-supplied clip
   *  (a mod's WAV - the music module has decoded attached files this
   *  way since MU1) and registers it under a string key that every
   *  existing entry point (playOneShot, setLoop, loop3d...) then takes
   *  in place of a DAGGERFALL.SND index - setLoop's swap semantics
   *  included. Answers false and registers nothing on a clip the
   *  decoder rejects: the caller keeps its classic fallback. */
  async registerSound(key, bytes) {
    try {
      this._ensureCtx();
      if (!this.ctx || this.buffers.has(key)) return this.buffers.get(key) != null;
      const buf = await this.ctx.decodeAudioData(decodableCopy(bytes));
      this.buffers.set(key, buf);
      return true;
    } catch {
      return false;
    }
  }

  /** FIELD-WIND1: a sound the port MAKES rather than decodes - mono `samples` at `sampleRate` - registered under a
   *  string key as registerSound registers a decoded WAV, so every entry point takes it in place of an index (the
   *  wind's bed rides `loop`). True once it stands; false with no context to make it on yet (the caller asks again). */
  registerSamples(key, samples, sampleRate) {
    this._ensureCtx();
    if (!this.ctx) return false;
    if (this.buffers.get(key)) return true;
    const b = this.ctx.createBuffer(1, samples.length, sampleRate);
    b.getChannelData(0).set(samples);
    this.buffers.set(key, b);
    return true;
  }

  /** ARENA2: a DAGGER.SND record's samples (mono, SAMPLE_RATE) - the raw voices a made sound is built from
   *  (systems/arena/arenaSound.js: the crowd's cheer and boo out of AmbientPeople1-10). Read off the player's own archive,
   *  no context needed; null with no archive or no such record. Never a replacement's: the made sound is Daggerfall's. */
  samplesOf(index) {
    const rec = this.snd?.getSound?.(index);
    return rec?.waveData?.length ? pcm8ToFloat32(rec.waveData) : null;
  }

  _ready() {
    this._ensureCtx();
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  /** DFU PlayOneShot(clip, _, volumeScale): flat (non-positional).
   *  Returns the clip duration in seconds (A3's exclusive ambient
   *  channel tracks busy time with it), or undefined when not ready.
   *
   *  AUDIT 58: `pitch` is Unity's AudioSource.pitch, which WebAudio
   *  spells playbackRate - the same resampling, and the same 1.0
   *  default. DFU's three combat-voice sites raise it for exactly one
   *  shot and put it back (EnemySounds.cs:172-175, FPSWeapon.cs:316
   *  -319, PlayerFootsteps.cs:359-362); a WebAudio source is born per
   *  shot and dies with it, so setting it here IS the save/restore. */
  playOneShot(index, volume = 1, pitch = 1) {
    if (_oneShotObserver) { try { _oneShotObserver(index, volume); } catch { /* an observer never stops a sound */ } }   // PEERFX1
    // SND1: the stamp the UI's generic click reads, so a press whose own
    // handler already sounded (an equip, a drink, the gold) does not ALSO
    // click. Stamped on the REQUEST, ready or not - it is "someone chose a
    // sound for this", not "a sound played". AUDIT CONTRIB U1: and only a
    // sound chosen INSIDE an input event's dispatch (`window.event` is set
    // for exactly that span) - the frame loop's own one-shots (a hit, the
    // ambience, a foe's cry: the world runs under an open window online)
    // were stamped too, and each swallowed the click of any press near it.
    if (globalThis.event && typeof globalThis.event.type === 'string') this.lastOneShotAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!this._ready()) return undefined;
    const buf = this._buffer(index);
    if (!buf) return undefined;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const gain = this.ctx.createGain();
    gain.gain.value = volume * this._scale;   // EG-ZH: a scope's gain (scaled) - 1 outside one
    src.connect(gain).connect(this._out());
    src.start();
    return buf.duration;
  }

  /** AUDIT 58 - THE ID DOOR. SoundReader.GetSoundIndex (SoundReader.cs
   *  :152-158) is `soundFile.GetRecordIndex(soundID)`: a DAGGER.SND
   *  record ID resolved to that record's INDEX in the archive. The two
   *  spaces are UNRELATED - the archive's directory numbers the records
   *  independently of their order (index 0 carries id 3, id 6 sits at
   *  index 3), and SoundClips.cs:79-82 says so outright ("these are IDs
   *  267 through 286 in the sound file").
   *
   *  That is why DaggerfallAudioSource carries TWO overloads of every
   *  entry point - `PlayOneShot(int soundIndex, ...)` (:186-198) taking
   *  an index and `PlayOneShot(uint soundID, ...)` (:232-238) taking an
   *  ID and resolving it first - and why a caller's `(uint)` cast is a
   *  LOAD-BEARING choice, not a widening. Everything named `...SoundID`
   *  in DFU comes through this door; everything typed SoundClips does
   *  not. -1 (no archive, or no such id) plays nothing, exactly as
   *  GetAudioClip(-1) answers null and the index overload drops the
   *  shot. */
  soundIndexForId(id) {
    return this.snd?.getRecordIndex(id) ?? -1;
  }

  /** PlayOneShot(uint soundID, ...) - DaggerfallAudioSource.cs:232-238. */
  playOneShotId(id, volume = 1) {
    const index = this.soundIndexForId(id);
    return index >= 0 ? this.playOneShot(index, volume) : undefined;
  }

  /** The positional twin. DFU reaches a 3D source's ID through
   *  SetSound(uint soundID, ...) (:170-181), which resolves ONCE and
   *  leaves the source holding an index; the port has no persistent
   *  source object at these call sites, so it resolves per shot. */
  play3dId(id, pos, volume = 1, opts = undefined) {
    const index = this.soundIndexForId(id);
    return index >= 0 ? this.play3d(index, pos, volume, opts) : undefined;
  }

  /** Non-positional looping source (A3: the rain/crickets ambience
   *  loops - DFU spatialBlend 0). Returns a stop handle or null. */
  loop(index, volume = 1, { lowpass = 0 } = {}) {
    if (!this._ready()) return null;
    const buf = this._buffer(index);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    // BA1: Unity's AudioLowPassFilter on the source's object (InteriorAmbientSoundSource.cs:26-27) - a biquad
    // low-pass at its cutoff, between the gain and the bus; 0 is no filter.
    const tail = lowpass > 0 ? this._lowpass(lowpass) : null;
    if (tail) src.connect(gain).connect(tail).connect(this._out()); else src.connect(gain).connect(this._out());
    src.start();
    const release = () => releaseNodes(src, gain, tail);   // RAIN-LEAK: the whole chain, not the source alone
    return {
      stop() {
        try { src.stop(); } catch { /* already stopped */ }
        release();
      },
      /** WX2: the loop's gain, live - the rain loop fades with the front. */
      setVolume(v) { gain.gain.value = Math.max(0, Math.min(1, v)); },
      /** HOTFIX 1003 (live: "audio crackling after a match ends"): an ending, not a cut - the gain ramps to nothing
       *  over `seconds`, then the source stops. A loop stopped at its level pops; a crowd's bed of noise pops loudly. */
      fadeStop(seconds = 0.4) {
        try {
          const t = src.context.currentTime;
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(gain.gain.value, t);
          gain.gain.linearRampToValueAtTime(0, t + seconds);
          src.stop(t + seconds + 0.05);
          src.onended = release;
        } catch {
          try { src.stop(); } catch { /* already stopped */ }
          release();
        }
      },
      /** FIELD-WIND1: the loop's pitch, live (Unity's AudioSource.pitch, WebAudio's playbackRate) - the wind's bed
       *  brightens as the wind gets up. */
      setPitch(p) { src.playbackRate.value = p; },
    };
  }

  /**
   * TR2: a NAMED loop with live volume and pitch - Unity's
   * `ridingAudioSource`, which TransportManager keeps as a field and
   * re-points at a different clip mid-ride (the clop swap) while
   * setting `.volume` and `.pitch` every frame. `clip` null stops it.
   * Re-pointing at the same clip does NOT restart the source, which is
   * what makes the half-speed swap audible rather than a stutter.
   */
  setLoop(name, clip, { volume = 1, pitch = 1 } = {}) {
    this._loops ??= new Map();
    const ch = this._loops.get(name);
    if (clip == null) {
      if (ch) { ch.stop(); this._loops.delete(name); }
      return null;
    }
    if (ch) {
      // TR-AUDIT F-F3: the clip is SWAPPED, not restarted. DFU's
      // ridingAudioSource has `loop = false` (:190) and Update only
      // calls Play() when it is not already playing (:273-276), so
      // assigning `.clip` mid-clop takes effect when the CURRENT one
      // ends. Restarting on the swap chops the hoofbeat in half.
      ch.want = clip;
      ch.rearm?.();   // AUDIT DISC7 B7
      ch.setVolume(volume);
      ch.setPitch(pitch);
      return ch;
    }
    const made = this._makeRetriggerLoop(clip, volume, pitch);
    if (!made) return null;
    this._loops.set(name, made);
    return made;
  }

  /** DFU's shape: a NON-looping source re-armed when it ends, which is
   *  what `if (!isPlaying) Play()` on a `loop = false` source does. */
  _makeRetriggerLoop(index, volume, pitch, out = null) {
    if (!this._ready()) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    gain.connect(out ?? this._out());
    const ch = { want: index, playing: null, rate: pitch, stopped: false,
      setVolume: (v) => { gain.gain.value = v; },
      setPitch: (p) => { ch.rate = p; if (ch.playing) ch.playing.playbackRate.value = p; },
      stop() {
        ch.stopped = true;
        if (ch.playing) { try { ch.playing.stop(); } catch { /* already stopped */ } ch.playing = null; }
        gain.disconnect();
      } };
    const arm = () => {
      if (ch.stopped) return;
      const buf = this._buffer(ch.want);
      if (!buf) { ch.playing = null; return; }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = ch.rate;
      src.connect(gain);
      src.onended = () => { if (ch.playing === src) { ch.playing = null; arm(); } };
      src.start();
      ch.playing = src;
    };
    // AUDIT DISC7 B7: a channel whose swapped-to clip could not play (switched off, not loaded) stood dead - `arm` left
    // `playing` null and nothing called it again. The owner's next set re-arms it (setLoop / setLoop3d).
    ch.rearm = () => { if (!ch.stopped && !ch.playing) arm(); };
    arm();
    if (!ch.playing) { gain.disconnect(); return null; }
    return ch;
  }

  /**
   * WINDFALL1: A PLAIN UNITY AudioSource, KEPT - a 2D source a mod holds for the session (Windfall's
   * WindEnvironmentEffects.CreateAudioSource: spatialBlend 0, no loop) and plays one-shots on. What a fire-and-forget
   * playOneShot cannot give is the source's own state: `volume` is LIVE (Unity scales every one-shot still playing on
   * the source by it - the mod fades a passage out indoors by lowering it), `pitch` likewise, `isPlaying` holds while
   * any shot it started runs, and `stop()` ends them all. One gain node on the bus (SoundVolume is the bus's, as
   * everywhere), made on the first shot a running context can play; a shot that cannot start (no context yet, no such
   * clip) leaves the source idle, as a null clip does. `volume` clamps to 0..1 as Unity's does.
   */
  source() {
    const engine = this;
    let gain = null, vol = 1, rate = 1;
    const live = new Set();
    const node = () => {
      if (!engine._ready()) return null;
      if (!gain || gain.context !== engine.ctx) { gain = engine.ctx.createGain(); gain.connect(engine._out()); }
      gain.gain.value = vol;
      return gain;
    };
    return {
      get volume() { return vol; },
      set volume(v) { vol = Math.max(0, Math.min(1, Number(v) || 0)); if (gain) gain.gain.value = vol; },
      get pitch() { return rate; },
      set pitch(p) { rate = Number(p) || 1; for (const s of live) s.playbackRate.value = rate; },
      get isPlaying() { return live.size > 0; },
      /** PlayOneShot(clip): answers the clip's duration at this pitch, or undefined when nothing started. */
      playOneShot(key) {
        const g = node();
        const buf = g ? engine._buffer(key) : null;
        if (!buf) return undefined;
        const s = engine.ctx.createBufferSource();
        s.buffer = buf;
        s.playbackRate.value = rate;
        s.connect(g);
        s.onended = () => { live.delete(s); try { s.disconnect(); } catch { /* gone */ } };
        s.start();
        live.add(s);
        return buf.duration / rate;
      },
      stop() {
        for (const s of live) { try { s.stop(); } catch { /* already stopped */ } try { s.disconnect(); } catch { /* gone */ } }
        live.clear();
      },
      /** EVERY ALLOCATION HAS AN OWNER: the shots and the gain node, for the owner's teardown. */
      dispose() { this.stop(); if (gain) { try { gain.disconnect(); } catch { /* gone */ } gain = null; } },
    };
  }

  /** Positional one-shot: a PannerNode standing in for Unity's 3D
   *  AudioSource. The default profile is the DaggerfallAudioSource
   *  shape (min 1 / max 500, logarithmic - WebAudio 'inverse' is the
   *  analog); per-source callers override maxDistance, e.g. enemy
   *  sources clamp at AttractRadius 16 (2026-08-14 audit AU2). */
  /** AUDIT 24 (wave 41): `distanceModel` is a parameter now. DFU sets
   *  it per source and EnemySounds sets `LinearRolloff = true` with
   *  `maxDistance = AttractRadius` (:57-60), with its own reason -
   *  loop3d already carried that note for torches. Inverse stays the
   *  default so no existing caller changes. */
  /** AUDIT 58: `pitch` rides the options bag here (AudioSource.pitch /
   *  playbackRate), because every 3D combat voice DFU plays is
   *  pitch-lifted - EnemySounds.cs:172-175 raises the SOURCE's pitch
   *  around PlayOneShot and restores it after. */
  /** DISC17-B (2026-09-24, Mac: "Sometimes thunder ends abruptly"): `far` - A SOUND FROM FAR OFF KEEPS ITS PLACE
   *  FROM THE EAR. A distant storm's thunder is kilometres away, and the hosts play it from a stand-in
   *  THUNDER_SOURCE_M from the ear at that one-shot's reference distance (systems/distantStorms.js), so it comes from
   *  the storm's side at the level its distance gave it. A panner stays where it was put and the ear does not: every
   *  metre walked under a rolling clip was a metre off a 13 m reference, and a floating-origin recentre
   *  (streamingWorld.js, 819.2 m at every map pixel crossed) moved the ear over 800 m from the stand-in in one
   *  frame - the thunder fell 35 dB mid-roll, which is the abrupt end. A `far` shot keeps its offset from the listener
   *  (setListener moves it) until its clip has run out, so its distance and its bearing hold, as they do for a
   *  sound kilometres off. AUDIT SD IV (A5): `far` a name - the place's that played it, which fadeFar lets go.
   *  @param {number} index @param {number[]} pos @param {number} [volume]
   *  @param {{ refDistance?: number, maxDistance?: number, distanceModel?: string, pitch?: number, far?: boolean | string }} [opts] */
  play3d(index, pos, volume = 1, { refDistance = 1, maxDistance = 500, distanceModel = 'inverse', pitch = 1, far = false } = {}) {
    if (!this._ready()) return undefined;
    const buf = this._buffer(index);
    if (!buf) return undefined;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const pan = this._panner(pos, { refDistance, maxDistance, distanceModel });
    const gain = this.ctx.createGain();
    gain.gain.value = volume * this._scale;   // EG-ZH: a scope's gain (scaled) - 1 outside one
    src.connect(gain).connect(pan).connect(this._out());
    src.start();
    if (far) {   // DISC17-B: its offset from the ear, held until the clip has run out
      const L = this._listener;
      (this._far ??= []).push({ pan, off: [pos[0] - L.x, pos[1] - L.y, pos[2] - L.z], until: this.ctx.currentTime + buf.duration / pitch, src, gain, tag: far === true ? null : far });
    }
    return buf.duration;   // A3: the ambient channel's busy clock
  }

  /** AUDIT GATHER-FEEL F7: A POSITIONAL SHOT A SCENE CAN TAKE BACK - play3d's own, answering a handle (null where it
   *  plays nothing): `stop(seconds)` fades it to nothing over `seconds` (a stop at its level pops) and lets its chain go;
   *  `onEnd` is told when it has ended, run out or stopped. A felled tree a refused harvest stands again was heard
   *  falling on for two seconds and more, its ground struck under it standing (systems/gatherSounds.js `hush`).
   *  @param {number|string} index @param {number[]} pos @param {number} [volume]
   *  @param {{ refDistance?: number, maxDistance?: number, distanceModel?: string, pitch?: number, onEnd?: () => void }} [opts] */
  play3dVoice(index, pos, volume = 1, { refDistance = 1, maxDistance = 500, distanceModel = 'inverse', pitch = 1, onEnd = null } = {}) {
    if (!this._ready()) return null;
    const buf = this._buffer(index);
    if (!buf) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const pan = this._panner(pos, { refDistance, maxDistance, distanceModel });
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(pan).connect(this._out());
    let ended = false;
    src.onended = () => { if (ended) return; ended = true; releaseNodes(src, gain, pan); onEnd?.(); };
    src.start();
    return {
      stop(seconds = VOICE_FADE_S) {
        if (ended) return;
        try {
          const t = ctx.currentTime;
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(gain.gain.value, t);
          gain.gain.linearRampToValueAtTime(0, t + seconds);
          src.stop(t + seconds + 0.02);
        } catch {
          try { src.stop(); } catch { /* already stopped */ }
        }
      },
    };
  }

  /** AUDIT SD IV (A5): A PLACE'S FAR SHOTS LET GO WITH IT - each `far` one-shot played under `tag` and still sounding
   *  fades to nothing over `seconds` (its beds' fade) and stops, and the ear lets it go. The Hour's air let its beds
   *  go as it was left, and a moan or a bell sounding then rang on at the ear in the street for seconds. A shot with no
   *  name (a distant storm's thunder) is never touched. */
  fadeFar(tag, seconds = BED_FADE_S) {
    const far = this._far;
    if (!tag || !far?.length) return;
    let n = 0;
    for (const f of far) {
      if (f.tag !== tag) { far[n++] = f; continue; }
      try {
        const t = this.ctx.currentTime;
        f.gain.gain.cancelScheduledValues(t);
        f.gain.gain.setValueAtTime(f.gain.gain.value, t);
        f.gain.gain.linearRampToValueAtTime(0, t + seconds);
        f.src.stop(t + seconds + 0.05);
      } catch {
        try { f.src.stop(); } catch { /* already stopped */ }
      }
    }
    far.length = n;
  }

  /** Looping positional source (A2 torches: DFU AddTorchAudioSource -
   *  LINEAR rolloff "or the burning sound is audible almost
   *  everywhere"). The caller gates range (LoopIfPlayerNear disables
   *  the source outside maxDistance); returns a stop handle or null
   *  when the context/record is not ready. */
  /** WM4c: `distanceModel` is a parameter here too, LINEAR by default so
   *  the torches do not move. A DaggerfallAudioSource left at Unity's
   *  defaults (Kamer's Spin_Up adds one and sets only the clip and
   *  LoopOnAwake) is LOGARITHMIC, min 1, max 500 - play3d's profile -
   *  and the mill's loop asks for exactly that. The handle also MOVES:
   *  the streaming world shifts its origin under a built pixel, and a
   *  source that stayed at the old numbers would drift away from the
   *  mill it belongs to. */
  /** CSA-G: `rolloffFactor` 0 is a panner that places and never attenuates - for a caller that works Unity's own
   *  rolloff out itself (Come Sail Away's loops: logarithmic, which stops attenuating at maxDistance, as no WebAudio
   *  model does) and sets the gain each frame through the handle's `setVolume`. */
  loop3d(index, pos, volume = 1, { refDistance = 1, maxDistance = 5, distanceModel = 'linear', lowpass = 0, rolloffFactor = 1 } = {}) {
    if (!this._ready()) return null;
    const buf = this._buffer(index);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const pan = this._panner(pos, { refDistance, maxDistance, distanceModel, rolloffFactor });
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    const tail = lowpass > 0 ? this._lowpass(lowpass) : null;   // BA1: AudioLowPassFilter, as loop() has it
    if (tail) src.connect(gain).connect(pan).connect(tail).connect(this._out()); else src.connect(gain).connect(pan).connect(this._out());
    src.start();
    const release = () => releaseNodes(src, gain, pan, tail);   // RAIN-LEAK: loop()'s
    return {
      move(p) { placeAudio(pan, p); },
      /** CSA-G: the loop's gain, live (a Unity AudioSource's `volume`). */
      setVolume(v) { gain.gain.value = Math.max(0, v); },
      stop() {
        try { src.stop(); } catch { /* already stopped */ }
        release();
      },
      /** AUDIT SD III (A7): an ending, not a cut - `loop`'s (HOTFIX 1003): the gain to nothing over `seconds`, then the
       *  source stopped. The Rift's bell was cut at its level as its dungeon was left. */
      fadeStop(seconds = BED_FADE_S) {
        try {
          const t = src.context.currentTime;
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(gain.gain.value, t);
          gain.gain.linearRampToValueAtTime(0, t + seconds);
          src.stop(t + seconds + 0.05);
          src.onended = release;
        } catch {
          try { src.stop(); } catch { /* already stopped */ }
          release();
        }
      },
    };
  }

  /** CSA-G: where the ears stand (the last setListener's position, scene coordinates) - for a caller that works a
   *  source's rolloff out itself. */
  listenerPosition() { const L = this._listener; return [L.x, L.y, L.z]; }

  /** Per-frame listener sync from the camera (position + forward), in SCENE coordinates - `_listener` keeps them so;
   *  the handedness is turned at the one door into WebAudio (audioFrame). */
  /** SOUNDSCAPE: where the ear stands and faces, as the host's last setListener put it - the scene's frame (a module
   *  that places its sounds about the listener reads it here rather than being handed it again). */
  listenerPose() {
    const L = this._listener;
    return { pos: [L.x, L.y, L.z], fwd: [L.fx, L.fy, L.fz] };
  }

  setListener(pos, forward) {
    const L = this._listener;
    [L.x, L.y, L.z] = pos; [L.fx, L.fy, L.fz] = forward;
    if (!this._ready()) return;
    const l = this.ctx.listener;
    const [x, y, z] = audioFrame(pos), [fx, fy, fz] = audioFrame(forward);
    if (l.positionX) {
      l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z;
      l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(x, y, z);                    // Safari fallback
      l.setOrientation(fx, fy, fz, 0, 1, 0);
    }
    // DISC17-B: the far one-shots move with the ear, and a clip that has run out is let go
    const far = this._far;
    if (far?.length) {
      const now = this.ctx.currentTime;
      let n = 0;
      for (const f of far) {
        if (f.until <= now) continue;
        placeAudio(f.pan, [pos[0] + f.off[0], pos[1] + f.off[1], pos[2] + f.off[2]]);
        far[n++] = f;
      }
      far.length = n;
    }
  }

  /** 3D-AUDIO (Discord, 2026-09-23: "it doesnt matter where enemies are it always sounds like the opposite or
   *  directly in front of you while the mob is behind"): THE ONE PANNER every positional source is born with.
   *  HRTF, not equal-power: equal-power folds every azimuth past 90 degrees onto the front, so a foe behind sounded
   *  exactly like one ahead. Unity's own stereo panner has no front/back cue either - this is the port going past
   *  DFU on purpose, at the player's ask; the left/right law is DFU's (a source on the right plays on the right). */
  _panner(pos, { refDistance = 1, maxDistance = 500, distanceModel = 'inverse', rolloffFactor = 1 } = {}) {
    const pan = this.ctx.createPanner();
    pan.panningModel = PANNING_MODEL;
    pan.distanceModel = distanceModel;
    pan.refDistance = refDistance;
    pan.maxDistance = maxDistance;
    pan.rolloffFactor = rolloffFactor;
    placeAudio(pan, pos);
    return pan;
  }

  /**
   * RIDE-SOUND: a NAMED positional loop with live volume, pitch and place - `setLoop`'s retriggered clip (DFU's
   * ridingAudioSource shape: the clip swapped when the current one ends, never restarted) through a panner. For
   * another player's riding loop, which moves with them. `clip` null stops it.
   */
  setLoop3d(name, clip, pos, { volume = 1, pitch = 1, refDistance = 1, maxDistance = 500, distanceModel = 'inverse' } = {}) {
    this._loops3d ??= new Map();
    const ch = this._loops3d.get(name);
    if (clip == null) {
      if (ch) { ch.stop(); this._loops3d.delete(name); }
      return null;
    }
    if (ch) { ch.want = clip; ch.rearm?.(); ch.setVolume(volume); ch.setPitch(pitch); ch.move(pos); return ch; }   // AUDIT DISC7 B7: a dead channel comes back with its clip
    if (!this._ready()) return null;
    if (!this._buffer(clip)) return null;   // AUDIT DISC7 B7: a clip that cannot play builds no panner (it was a panner and a gain a frame, thrown away)
    const pan = this._panner(pos, { refDistance, maxDistance, distanceModel });
    pan.connect(this._out());
    const made = this._makeRetriggerLoop(clip, volume, pitch, pan);
    if (!made) { pan.disconnect(); return null; }
    made.move = (p) => placeAudio(pan, p);
    const stop = made.stop;
    made.stop = () => { stop(); pan.disconnect(); };
    this._loops3d.set(name, made);
    return made;
  }

  /** AUDIT DISC7 B6: move a named positional loop, if one stands (the floating origin's recentre). */
  moveLoop3d(name, pos) { this._loops3d?.get(name)?.move?.(pos); }

  /**
   * AUDIT SD III (A3): A NAMED BED - a sound under a place that never stops between its passes: one buffer looping in
   * the engine itself (`src.loop`), its volume and pitch live, where setLoop's channel re-arms a one-shot as each pass
   * ends (DFU's riding clop - right for a hoofbeat's swap, and at every pass of a bed a gap of the main thread's
   * dispatch: the Hour's void stuttered every 5.8 s, its works every 2). It rises from nothing as it begins and fades
   * to nothing as it is let go (`clip` null) or swapped for another clip, over BED_FADE_S - a bed cut at its level
   * pops. The same call each frame keeps it; `setBed3d` stands one at `pos` (moved each call).
   */
  setBed(name, clip, { volume = 1, pitch = 1 } = {}) { return this._bed(this._beds ??= new Map(), name, clip, null, { volume, pitch }); }
  setBed3d(name, clip, pos, { volume = 1, pitch = 1, refDistance = 1, maxDistance = 500, distanceModel = 'inverse' } = {}) {
    return this._bed(this._beds3d ??= new Map(), name, clip, pos, { volume, pitch, refDistance, maxDistance, distanceModel });
  }
  _bed(beds, name, clip, pos, o) {
    const was = beds.get(name);
    if (was && was.clip === clip && clip != null) { was.setVolume(o.volume); was.setPitch(o.pitch); if (pos) was.move(pos); return was; }
    if (was) { beds.delete(name); was.fadeStop(); }
    if (clip == null || !this._ready()) return null;
    const buf = this._buffer(clip);
    if (!buf) return null;
    const ctx = this.ctx, src = ctx.createBufferSource(), gain = ctx.createGain(), fade = ctx.createGain();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = o.pitch;
    gain.gain.value = Math.max(0, o.volume);
    const t = ctx.currentTime;
    fade.gain.setValueAtTime(0, t);
    fade.gain.linearRampToValueAtTime(1, t + BED_FADE_S);
    const pan = pos ? this._panner(pos, o) : null;
    src.connect(gain).connect(fade);
    if (pan) fade.connect(pan).connect(this._out()); else fade.connect(this._out());
    src.start();
    let gone = false;
    const bed = {
      clip,
      setVolume(v) { gain.gain.value = Math.max(0, v); },
      setPitch(p) { src.playbackRate.value = p; },
      move(p) { if (pan) placeAudio(pan, p); },
      fadeStop(seconds = BED_FADE_S) {
        if (gone) return;
        gone = true;
        try {
          const now = ctx.currentTime;
          fade.gain.cancelScheduledValues(now);
          fade.gain.setValueAtTime(fade.gain.value, now);
          fade.gain.linearRampToValueAtTime(0, now + seconds);
          src.stop(now + seconds + 0.05);
          src.onended = () => { try { src.disconnect(); fade.disconnect(); pan?.disconnect(); } catch { /* gone */ } };
        } catch {
          try { src.stop(); } catch { /* already stopped */ }
          try { src.disconnect(); fade.disconnect(); pan?.disconnect(); } catch { /* gone */ }
        }
      },
    };
    beds.set(name, bed);
    return bed;
  }
}

export const audio = new AudioEngine();

/** CSA-G: AudioRolloffMode.Logarithmic - Unity's (FMOD's inverse) rolloff: full inside minDistance, minDistance over
 *  the distance past it, and no quieter past maxDistance, where it stops attenuating. The panner's own inverse model
 *  never stops, so a caller holding Unity's curve works it out here and hands the panner a rolloff factor of 0. */
export const logarithmicRolloff = (d, min, max) => (d <= min ? 1 : min / Math.min(d, max));
/** CSA-G: A PLAIN UNITY AudioSource ON THE ONE BUS. The bus carries DaggerfallUnity.Settings.SoundVolume (`_out`) - the
 *  multiply DaggerfallAudioSource makes at every play - and a plain AudioSource never reads the setting, so its own
 *  volume is handed over the bus with SoundVolume divided out; a bus at nought is silence (the one case the bus
 *  cannot give back). */
export const plainSourceGain = (v, soundVolume) => (soundVolume > 0 ? v / soundVolume : 0);

/**
 * E6: DaggerfallAudioSource, as much of it as the QUEST MACHINE's own
 * component needs - `QuestMachine.Instance.GetComponent<
 * DaggerfallAudioSource>()`, the one source every PlaySound quest
 * action in every running quest shares (PlaySound.cs:110-116).
 *
 * Two methods, both verbatim:
 *  - PlayOneShot (DaggerfallAudioSource.cs:188-199).
 *  - IsPlaying (:244-247) - `audioSource.isPlaying`, which is what
 *    PlaySound's busy-skip reads. A WebAudio one-shot is a fire-and-
 *    forget BufferSource with no `isPlaying` of its own, so the source
 *    keeps the END TIME of the clip it last started: the engine's
 *    playOneShot already answers the clip's duration (it has since A3's
 *    exclusive ambient channel), so "busy" is "the clip that started
 *    has not run out yet".
 *
 * The clock is real time, which is the clock Unity's isPlaying runs on
 * - not the game clock PlaySound's interval is measured in. A clip
 * that never started (no archive, no gesture yet, no such index) leaves
 * the source idle, exactly as Unity's does when GetAudioClip answers
 * null.
 */
export class QuestAudioSource {
  constructor(engine = audio, clock = defaultAudioClock) {
    this._audio = engine;
    this._clock = clock;
    this._endsAt = -Infinity;
  }

  /** IsPlaying (:244-247). */
  isPlaying() { return this._clock() < this._endsAt; }

  /** PlayOneShot (:188-199). Answers the duration the engine reported,
   *  or undefined when nothing started. */
  playOneShot(index, volume = 1) {
    const dur = this._audio.playOneShot(index, volume);
    if (typeof dur === 'number' && dur > 0) this._endsAt = this._clock() + dur;
    return dur;
  }

  /** AUDIT 58: the ID-space twin, for the ONE caller that has an id
   *  rather than an index - the quest `play sound` action, whose value
   *  comes from the Quests-Sounds table's `id` column. PlaySound.cs:74
   *  -75 resolves it at CREATE (`GetSoundIndex(soundID)`) and :112
   *  plays the INT overload; the port resolves SND host-side behind
   *  this hook (Port-Ledger A, "PlaySound's SND RESOLUTION"), so the
   *  conversion happens here instead - the same table id, the same
   *  record, one tick later. The busy stamp is unchanged: it lands
   *  whenever a clip started, and a table id with no record in the
   *  archive starts nothing, exactly as a null AudioClip does. */
  playOneShotId(id, volume = 1) {
    const dur = this._audio.playOneShotId(id, volume);
    if (typeof dur === 'number' && dur > 0) this._endsAt = this._clock() + dur;
    return dur;
  }

  /** The quest machine's `playSound` hook, whole - the ONE body both hosts that own a machine call (world.js,
   *  exterior.js). PlaySound.cs:110-116's busy skip (busy: false, nothing stamped, the action tries again next tick;
   *  idle: played through the ID door and true), and QUIET-VENGEANCE: a sound on QUIET_QUEST_SOUNDS plays at its
   *  volume and no sooner than its gap (real seconds) after its last play - inside the gap it answers false exactly
   *  as a busy source does, so the action keeps its interval due and plays the moment the gap is out. */
  playQuestSound(id) {
    if (this.isPlaying()) return false;
    const quiet = QUIET_QUEST_SOUNDS[id] ?? null;
    if (quiet) {
      const now = this._clock();
      if (now < (this._quietUntil?.get(id) ?? -Infinity)) return false;
      (this._quietUntil ??= new Map()).set(id, now + quiet.gapS);
    }
    this.playOneShotId(id, quiet ? quiet.volume : 1);
    return true;
  }
}

/** QUIET-VENGEANCE (FIELD BUGS 2026-10-04b, Mac: "Reduce Lysandus VENGENANCE audio"): the quest sounds the port plays
 *  softer and sparser than DFU, by Quests-Sounds id. `386, vengence` is S0000977's `play sound vengence 5 0` - King
 *  Lysandus' ghost in Daggerfall at night, every five game minutes for as long as the player is there (about every 25
 *  real seconds at the classic time scale), at full volume and with no position. Here at 0.4 of it, and once a minute
 *  at most. Port-Ledger A. */
export const QUIET_QUEST_SOUNDS = Object.freeze({
  386: Object.freeze({ volume: 0.4, gapS: 60 }),
});

/** Real seconds, monotonic - `performance.now()` where there is one. */
export function defaultAudioClock() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now() / 1000
    : Date.now() / 1000;
}
