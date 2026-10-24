// INTRO2: one source, from the first note through the menu.
// A user gesture unlocks AudioContext BEFORE any await. Playback starts only
// after every cinematic asset is ready. No silent wall-clock substitute.
// getOutputTimestamp maps the audio DEVICE clock onto performance.now():
// currentTime alone is ahead of what is heard by the output pipeline latency.
//
// INTRO3 (2026-10-14, Mac: "you do it and it's for both"): the source is the
// main theme WRITTEN AS NOTES (systems/introScore.js), played by the game's
// own song player and FM bank (systems/song/songPlayer.js) on this session's
// context - no recording is fetched or decoded. The player schedules the song
// on the context's clock from an origin it sets as it starts; that origin is
// the film's time zero, so time() reads the device clock against it exactly
// as it read the decoded buffer's start. The volume law is the player's own -
// MUSIC_GAIN under MusicVolume and the video mute, as every song plays - and
// this session's gain is the film's and the menu's level alone.
import { SongPlayer } from './song/songPlayer.js';
import { introThemeSong } from './introScore.js';
import { onSettingChange } from './settings/settings.js';
import { reverbImpulse } from './reverbPresets.js';

export const INTRO_THEME_GAIN = 0.82;
export const MENU_THEME_GAIN = 0.26;

/** INTRO3b (2026-10-23, the owner: "too flat"): THE HALL - the space the theme plays in. The recording is a reverberant
 *  orchestral mix (L/R correlation 0.59 over its body) and the dry render was all but mono (0.985), so the session puts
 *  a concert hall under the player's master: an impulse built from I3DL2 numbers the way the engine's reverb zones are
 *  (systems/reverbPresets.js) - a long pre-delay, a 2.6 s tail dark at the top, the early reflections low. */
export const INTRO_HALL = Object.freeze({ room: -1000, roomHF: 0, decayTime: 2.6, decayHFRatio: 1.1, reflections: -900, reflectionsDelay: 0.024, reverb: -150, reverbDelay: 0.034, HFReference: 4000, diffusion: 100, density: 100 });
/** How loud the hall is beside the dry sound (the wet gain). */
export const INTRO_WET = 1.6;

/** The hall under `into`: a send the player's master feeds (SongPlayer's third argument), through the convolver and the
 *  wet gain into the session's own gain - so the hall follows MusicVolume, the mute and the film's and the menu's levels
 *  as the dry sound does. A context with no convolver (a test's, an old browser's) has no hall, and the player is handed
 *  no send: the theme plays dry, as it did. */
export function introSpace(context, into) {
  if (!context || !into || typeof context.createConvolver !== 'function' || typeof context.createBuffer !== 'function') return null;
  const send = context.createGain(), convolver = context.createConvolver(), wet = context.createGain();
  convolver.normalize = false;
  convolver.buffer = reverbImpulse(context, INTRO_HALL);
  wet.gain.value = INTRO_WET;
  send.connect(convolver);
  convolver.connect(wet);
  wet.connect(into);
  return { send, convolver, wet };
}

/** Audio device time corresponding to a presentation time (milliseconds).
 * A zero timestamp before the device starts is not a usable clock. Fallback
 * subtracts reported output latency; it never substitutes a wall clock. */
export function audibleContextTime(context, presentationMs) {
  const stamp = context.getOutputTimestamp?.();
  if (stamp && stamp.performanceTime > 0 && Number.isFinite(stamp.contextTime)) {
    return stamp.contextTime + (presentationMs - stamp.performanceTime) / 1000;
  }
  return context.currentTime - Math.max(0, context.outputLatency ?? context.baseLatency ?? 0);
}

/** Session ownership belongs to the front door, NOT the cinematic DOM. */
export class IntroTheme {
  constructor({ makeContext, makePlayer = (context, destination, send) => new SongPlayer(context, destination, send), song = introThemeSong, subscribe = onSettingChange, now = () => performance.now() } = {}) {
    this.makeContext = makeContext ?? (() => {
      const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      return Ctor ? new Ctor({ latencyHint: 'interactive' }) : null;
    });
    this.makePlayer = makePlayer;
    this.makeSong = song;
    this.subscribe = subscribe;
    this.now = now;
    this.context = null;
    this.player = null;
    this.source = null;   // the player, once it plays: the front door reads it as "the score is sounding"
    this.gain = null;
    this.space = null;   // INTRO3b: the hall (introSpace), under the gain
    this.song = null;
    this.loading = null;
    this.startedAt = null;
    this.level = INTRO_THEME_GAIN;
    this.unsubscribe = null;
    this.disposed = false;
    this.lastTime = 0;
  }

  prepare() {
    if (this.loading) return this.loading;
    this.loading = this._prepare();
    return this.loading;
  }

  async _prepare() {
    try {
      if (this.disposed) return false;
      this.context = this.makeContext();
      if (!this.context) throw new Error('Web Audio is unavailable');
      this.gain = this.context.createGain();
      this.gain.gain.value = this.level;
      this.gain.connect(this.context.destination);
      this.space = introSpace(this.context, this.gain);
      this.player = this.makePlayer(this.context, this.gain, this.space?.send ?? null);
      this.unsubscribe = this.subscribe((section, key) => {
        if (section === 'Controls' && key === 'MusicVolume') this.player?.resyncGain();
      });
      this.song = this.makeSong();
      if (!this.song?.events?.length) throw new Error('the theme has no notes');
      return true;
    } catch (error) {
      if (!this.disposed) console.warn('[intro] music unavailable:', error.message);
      return false;
    }
  }

  /** Must be called directly from a trusted click/key handler. */
  unlock() {
    if (this.disposed) return Promise.resolve(false);
    this.prepare();
    try {
      return Promise.resolve(this.context?.resume()).then(() => this.context?.state === 'running').catch(() => false);
    } catch { return Promise.resolve(false); }
  }

  start() {
    if (this.disposed || !this.song || !this.player || this.context?.state !== 'running') return false;
    if (this.source) return true;
    if (!this.player.play(this.song)) return false;
    this.source = this.player;
    // The player's origin: where the song's tick 0 sits on the context clock (songPlayer.js play, 0.06 s on).
    this.startedAt = Number.isFinite(this.player._originTime) ? this.player._originTime : this.context.currentTime + 0.06;
    return true;
  }

  time(presentationMs = this.now()) {
    if (this.startedAt === null) return 0;
    if (!this.context) return this.lastTime;
    if (this.context.state !== 'running') return this.lastTime;
    const t = Math.max(0, audibleContextTime(this.context, presentationMs) - this.startedAt);
    this.lastTime = Math.max(this.lastTime, t);
    return this.lastTime;
  }

  setLevel(level, seconds = 0.9) {
    this.level = Math.max(0, Math.min(1, level));
    if (!this.gain || this.disposed) return;
    const param = this.gain.gain;
    const at = this.context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(at);
    else { const held = param.value; param.cancelScheduledValues(at); param.setValueAtTime(held, at); }
    param.linearRampToValueAtTime(this.level, at + Math.max(0.01, seconds));
  }

  async pause() {
    if (this.context?.state === 'running') {
      this.time();
      await this.context.suspend();
    }
  }

  /** Release the player and its notes, the graph, the context and the settings listener. */
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    const player = this.player;
    this.player = null;
    this.source = null;
    try { player?.stop(); } catch { /* nothing sounding */ }
    this.gain?.disconnect();
    for (const node of Object.values(this.space ?? {})) { try { node.disconnect(); } catch { /* gone with the context */ } }   // INTRO3b: the hall's nodes with it
    this.space = null;
    this.song = null;
    this.gain = null;
    const context = this.context;
    this.context = null;
    try { await context?.close(); } catch { /* already closed */ }
  }
}
