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
import { getFloat } from './settings.js';   // SETT: SoundVolume
import { setEquipSoundSink } from './equip.js';   // ES2: the equip moment's one audio door

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

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.snd = null;
    this.buffers = new Map();   // index -> AudioBuffer
    this.enabled = false;
    // NT1 (F215): null, not false - the ??= boot latch below rejects a
    // false (music.js:36 learned this at AUDIT 19).
    this._booted = null;
    this._listener = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1 };
    this._master = null;   // SETT: the SoundVolume bus (see _out)
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
      this._master = this.ctx.createGain();
      this._master.connect(this.ctx.destination);
    }
    this._master.gain.value = getFloat('Controls', 'SoundVolume', 0, 1);
    return this._master;
  }

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
    // idempotence, it is a race with a flag on it", music.js:62-67).
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

  _buffer(index) {
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

  _ready() {
    this._ensureCtx();
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  /** DFU PlayOneShot(clip, _, volumeScale): flat (non-positional).
   *  Returns the clip duration in seconds (A3's exclusive ambient
   *  channel tracks busy time with it), or undefined when not ready.
   *
   *  AUDIT 54: `pitch` is Unity's AudioSource.pitch, which WebAudio
   *  spells playbackRate - the same resampling, and the same 1.0
   *  default. DFU's three combat-voice sites raise it for exactly one
   *  shot and put it back (EnemySounds.cs:172-175, FPSWeapon.cs:316
   *  -319, PlayerFootsteps.cs:359-362); a WebAudio source is born per
   *  shot and dies with it, so setting it here IS the save/restore. */
  playOneShot(index, volume = 1, pitch = 1) {
    if (!this._ready()) return undefined;
    const buf = this._buffer(index);
    if (!buf) return undefined;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this._out());
    src.start();
    return buf.duration;
  }

  /** AUDIT 54 - THE ID DOOR. SoundReader.GetSoundIndex (SoundReader.cs
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
  loop(index, volume = 1) {
    if (!this._ready()) return null;
    const buf = this._buffer(index);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this._out());
    src.start();
    return {
      stop() {
        try { src.stop(); } catch { /* already stopped */ }
        src.disconnect();
      },
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
  _makeRetriggerLoop(index, volume, pitch) {
    if (!this._ready()) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    gain.connect(this._out());
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
    arm();
    if (!ch.playing) { gain.disconnect(); return null; }
    return ch;
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
  /** AUDIT 54: `pitch` rides the options bag here (AudioSource.pitch /
   *  playbackRate), because every 3D combat voice DFU plays is
   *  pitch-lifted - EnemySounds.cs:172-175 raises the SOURCE's pitch
   *  around PlayOneShot and restores it after. */
  play3d(index, pos, volume = 1, { refDistance = 1, maxDistance = 500, distanceModel = 'inverse', pitch = 1 } = {}) {
    if (!this._ready()) return undefined;
    const buf = this._buffer(index);
    if (!buf) return undefined;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const pan = this.ctx.createPanner();
    pan.panningModel = 'equalpower';
    pan.distanceModel = distanceModel;
    pan.refDistance = refDistance;
    pan.maxDistance = maxDistance;
    pan.positionX.value = pos[0]; pan.positionY.value = pos[1]; pan.positionZ.value = pos[2];
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(pan).connect(this._out());
    src.start();
    return buf.duration;   // A3: the ambient channel's busy clock
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
  loop3d(index, pos, volume = 1, { refDistance = 1, maxDistance = 5, distanceModel = 'linear' } = {}) {
    if (!this._ready()) return null;
    const buf = this._buffer(index);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const pan = this.ctx.createPanner();
    pan.panningModel = 'equalpower';
    pan.distanceModel = distanceModel;
    pan.refDistance = refDistance;
    pan.maxDistance = maxDistance;
    pan.positionX.value = pos[0]; pan.positionY.value = pos[1]; pan.positionZ.value = pos[2];
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(pan).connect(this._out());
    src.start();
    return {
      move(p) {
        pan.positionX.value = p[0]; pan.positionY.value = p[1]; pan.positionZ.value = p[2];
      },
      stop() {
        try { src.stop(); } catch { /* already stopped */ }
        src.disconnect();
      },
    };
  }

  /** Per-frame listener sync from the camera (position + forward). */
  setListener(pos, forward) {
    const L = this._listener;
    [L.x, L.y, L.z] = pos; [L.fx, L.fy, L.fz] = forward;
    if (!this._ready()) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = L.x; l.positionY.value = L.y; l.positionZ.value = L.z;
      l.forwardX.value = L.fx; l.forwardY.value = L.fy; l.forwardZ.value = L.fz;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(L.x, L.y, L.z);                    // Safari fallback
      l.setOrientation(L.fx, L.fy, L.fz, 0, 1, 0);
    }
  }
}

export const audio = new AudioEngine();

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

  /** AUDIT 54: the ID-space twin, for the ONE caller that has an id
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
}

/** Real seconds, monotonic - `performance.now()` where there is one. */
export function defaultAudioClock() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now() / 1000
    : Date.now() / 1000;
}
