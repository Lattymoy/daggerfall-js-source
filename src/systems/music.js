// A5: the music service - one archive, one player, one place hosts call.
//
// AUDIT 18 F6's lesson, applied ahead of the bug rather than after it:
// AudioEngine was a module singleton whose `enabled` flag only ever got
// set inside a bootstrap that ONE host called, so two whole scene types
// were silent until the player wandered into a dungeon. Music has the
// same shape and the same trap, so it gets the same answer - `ensure` is
// idempotent by construction and every host calls it unconditionally.
//
// It rides the EXISTING AudioContext from systems/audio.js rather than
// making a second one. Browsers cap how many a page may have, they are
// expensive, and two contexts have two clocks - a song scheduled on one
// and a sound effect on the other cannot be reasoned about together.
//
// MIDI.BSA is 1.2MB and already survives the ingest diet (the .BSA arm),
// so there is nothing to add to KEEP for this.

import { audio, decodableCopy } from './audio.js';   // AUDIT 39: one decode door, one slice law
import { MidiBsaFile } from '../formats/hmiFile.js';
import { selectSong } from './songManager.js';
import { SongPlayer, AudioSongPlayer, setMusicMuted, isMusicMuted } from './songPlayer.js';   // M-EXT: the replacement's player shares the volume law
import { hasReplacement, replacementBytes } from './musicReplacement.js';   // M-EXT: SoundReplacement.TryImportSong
import { onSettingChange } from './settings.js';   // 2026-08-27: MusicVolume applies live

/** DISC19-B (2026-09-24, Mac: "Sometimes when music tracks switch, its very abrupt instead of seamlessly fading in
 *  between tracks"): A SWITCH FADES. DFU cuts - DaggerfallSongPlayer.Play calls Stop first, and Stop is
 *  audioSource.Stop() or midiSequencer.Stop() with NoteOffAll: the old song goes mid-note and the next starts at full
 *  level - and so did every switch the port makes (a weather ring crossed, dawn, a door, a new location, a quest's
 *  PlaySong). A recorded departure (Port-Ledger A), at the owner's word: the song sounding fades out over
 *  MUSIC_FADE_OUT_S under its fader (songPlayer.js rampFader), then the next starts with its fader at nothing and
 *  fades in over MUSIC_FADE_IN_S. One synth voices one song, so the two play in turn, never on top of one another (a
 *  pack's decode gap sits between them, as before). The latest request during a fade is the one that plays; the song
 *  fading out, asked for again, turns round from where its fade stands. `playing` stays up through the fade, so the
 *  director never reads it as a song that ended. */
export const MUSIC_FADE_OUT_S = 1.5;
export const MUSIC_FADE_IN_S = 1.0;

export class MusicService {
  constructor() {
    this.archive = null;
    this.player = null;
    this._audio = null;   // M-EXT: the replacement player, built lazily like `player`
    this.enabled = false;
    // null, NOT false: `ensure` memoises with `??=`, which assigns only
    // over null/undefined. A `false` here is neither, so _boot was never
    // called at all and ensure() returned the boolean - which Promise.all
    // accepts happily, so every host thought music had booted. Caught by a
    // live boot probe, not by the suite (AUDIT 19).
    this._booted = null;
    this._current = null;
    this._switch = null;   // DISC19-B: { from, to, timer } while a song fades out before the next
    this._later = (fn, ms) => setTimeout(fn, ms);   // DISC19-B: the fade's clock, a seam for the tests
    this._cancelLater = (id) => clearTimeout(id);
    // 2026-08-27: the MusicVolume setting is LIVE in fact, not just in
    // tier - both players this service owns re-level the moment it is
    // written, so the slider is heard mid-song, not at the next one.
    this._unsubscribe = onSettingChange((section, key) => {
      if (section === 'Controls' && key === 'MusicVolume') this.resyncGain();
    });
  }

  /** Re-level whatever is sounding to the MusicVolume setting. */
  resyncGain() {
    this.player?.resyncGain?.();
    this._audio?.resyncGain?.();
  }

  /** AUDIT 64 F41: DaggerfallSongPlayer's two video handlers
   *  (DaggerfallSongPlayer.cs:356-362 and :364-369, subscribed at
   *  :76-77 to DaggerfallVidPlayerWindow's OnVideoStart/OnVideoEnd).
   *  The flag lives beside the gain accessors both players read, so
   *  every write path honours it - `_ensureMaster`, `resyncGain` and
   *  AudioSongPlayer's per-start `trackGain()` - exactly as DFU's
   *  Update re-asserts `IsMuted ? 0f : MusicVolume` at :106. The
   *  resync below is what makes a SOUNDING song drop at once.
   *
   *  NOT `stop()`: that clears `_current`/`_pending`, so the song
   *  would restart from the top when the video ends. DFU restores the
   *  gain on a song that never stopped advancing. */
  setMuted(v) {
    setMusicMuted(v);
    this.resyncGain();
  }

  get muted() { return isMusicMuted(); }

  /** The one bootstrap. Safe to call from every host, every entry.
   *
   *  AUDIT 19 F1/F11: this used to set `_booted` and return, which made
   *  the SECOND caller resolve IMMEDIATELY - before the archive had
   *  loaded, so `enabled` was still false. A host that did
   *  `music.ensure(f).then(play)` then played into a disabled service,
   *  and playSong dropped the request WITHOUT arming `_pending` because
   *  arming is itself gated on `enabled`. The exterior host was silent
   *  forever, and only because it happened to call second.
   *
   *  The flag is now the PROMISE, so every caller awaits the same load.
   *  A guard set before its own async work is not idempotence, it is a
   *  race with a flag on it. */
  ensure(fetchBytes) {
    return (this._booted ??= this._boot(fetchBytes));
  }

  async _boot(fetchBytes) {
    try {
      const bsa = new MidiBsaFile();
      bsa.load(await fetchBytes('MIDI.BSA'));
      this.archive = bsa;
      this.enabled = true;
    } catch (e) {
      // NEVER TRAPS: no archive is no music, not a failed boot.
      console.warn('[music] MIDI.BSA unavailable - music disabled:', e?.message ?? e);
      this.enabled = false;
      // Kept, not just logged: a host that boots silently gives no other
      // way to ask WHY from outside, and "music is off" was indistinguishable
      // from "music never started" during AUDIT 19.
      this.bootError = e?.message ?? String(e);
    }
    if (typeof window !== 'undefined') this.attachGestureStart();
  }

  /** A host asks for a song while the page is still silent - there is no
   *  AudioContext before a gesture, so the request is REMEMBERED and
   *  replayed on the first one. Without this the dungeon host's single
   *  play call at context-build time is simply lost and music never
   *  starts at all, which is the shape a warn-and-skip hides. */
  attachGestureStart(target = window) {
    if (this._gestureHooked) return;
    this._gestureHooked = true;
    const start = () => {
      if (!this._pending) return;
      // audio.js resumes the context on the same events; it may not have
      // run yet, so retry on the next frame rather than racing it.
      const tryStart = () => {
        if (!this._pending) return;
        if (this.playSong(this._pending)) this._pending = null;
      };
      tryStart();
      if (this._pending && typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(tryStart);
      }
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      target.addEventListener(ev, start, { passive: true });
    }
  }

  /** The context only exists after a gesture, so the player is built
   *  lazily on the first play that finds one. */
  _ensurePlayer() {
    if (!this.enabled) return null;
    if (this.player) return this.player;
    if (!audio.ctx) return null;
    this.player = new SongPlayer(audio.ctx, null, audio.reverbSend?.() ?? null);
    return this.player;
  }

  /** Play one song BY ARCHIVE NAME. Returns false when there is no
   *  archive, no context yet, or no such song - never throws. */
  playSong(name) {
    const player = this._ensurePlayer();
    if (!player) {
      // No context yet: remember it for the gesture hook rather than
      // dropping it. AUDIT 19: this used to be gated on `enabled`, which
      // made it the SECOND casualty of the ensure() race - a request
      // arriving before the archive finished loading was neither played
      // nor remembered. Arm unconditionally; the retry re-checks
      // everything, and arming with no archive costs one no-op.
      this._pending = name;
      return false;
    }
    // DISC19-B: a switch under way lands on the latest request, and the song fading out, asked for again, comes back
    // up from where its fade stands
    if (this._switch) {
      if (name === this._switch.from) { this._cancelSwitch(); this._current = name; this._fadeSounding(1, MUSIC_FADE_IN_S); return true; }
      this._switch.to = name;
      this._current = name;
      return true;
    }
    if (this._current === name && this.playing) return true;
    if (this.playing && this._current !== null) { this._beginSwitch(name); return true; }   // DISC19-B: out, then in
    return this._start(name);
  }

  /** The start: a replacement or the built-in song, rising from nothing under its fader (DISC19-B).
   *  M-EXT: a user-supplied track OVERRIDES the built-in song
   *  (SoundReplacement.TryImportSong, and DFU asks before it reaches
   *  its own data too). The lookup is synchronous - a Map hit behind
   *  the AssetInjection gate - but loading and decoding are not, so
   *  the commit happens here and the sound arrives a beat later. */
  _start(name) {
    if (hasReplacement(name)) {
      this._current = name;
      this._startReplacement(name);
      return true;
    }
    return this._playBuiltIn(name);
  }

  /** DISC19-B: fade what sounds out, and start the next when the fade is done. */
  _beginSwitch(name) {
    const sw = { from: this._current, to: name, timer: null };
    this._current = name;
    this._switch = sw;
    this._fadeSounding(0, MUSIC_FADE_OUT_S);
    sw.timer = this._later(() => {
      if (this._switch !== sw) return;
      this._switch = null;
      this.player?.stop();
      this._audio?.stop();
      if (!this._start(sw.to) && this._current === sw.to) this._current = null;   // a song that will not start leaves nothing claimed
    }, MUSIC_FADE_OUT_S * 1000);
  }

  _cancelSwitch() {
    if (!this._switch) return;
    this._cancelLater(this._switch.timer);
    this._switch = null;
  }

  /** DISC19-B: ramp whichever player sounds. */
  _fadeSounding(level, seconds) {
    if (this.player?.playing) this.player.fadeTo?.(level, seconds);
    if (this._audio?.playing) this._audio.fadeTo?.(level, seconds);
  }

  /** The MIDI.BSA path - what playSong did before replacements existed,
   *  and still the fallback for every song a pick does not cover. */
  _playBuiltIn(name) {
    const player = this._ensurePlayer();
    if (!player) return false;
    this._audio?.stop();   // a replacement must not sound underneath
    const index = this.archive.getSongIndex(name);
    if (index === null || index === undefined || index < 0) {
      console.warn(`[music] no song named ${name} in MIDI.BSA`);
      return false;
    }
    let song;
    try {
      song = this.archive.getSong(index);
    } catch (e) {
      // The reader throws with song and offset on anything it cannot
      // decode. One bad song must not take the music layer down.
      console.warn(`[music] ${name} would not decode:`, e?.message ?? e);
      return false;
    }
    this._current = name;
    const fresh = !(player.playing && player.song === song);
    const ok = player.play(song);
    if (ok && fresh) { player.fadeTo?.(0, 0); player.fadeTo?.(1, MUSIC_FADE_IN_S); }   // DISC19-B: it rises in
    return ok;
  }

  _ensureAudioPlayer() {
    if (this._audio) return this._audio;
    if (!audio.ctx) return null;
    this._audio = new AudioSongPlayer(audio.ctx, null, audio.reverbSend?.() ?? null);
    return this._audio;
  }

  /**
   * Load, decode and start a replacement. Fire-and-forget by design:
   * playSong has already committed and returned true.
   *
   * THE PLAYING FLAG IS RAISED BEFORE THE AWAIT. createMusicDirector
   * re-evaluates every frame on `songEnded: !isPlaying()`, so a decode
   * gap with the flag down reads as "the song finished" and re-requests
   * the same song on every frame until it lands - a request storm that
   * also restarts the decode each time.
   *
   * NEVER TRAPS: anything that goes wrong falls back to the built-in
   * song, which is DFU's own behaviour when TryImportSong answers false.
   */
  async _startReplacement(name) {
    const player = this._ensureAudioPlayer();
    if (!player) return;
    this.player?.stop();          // the MIDI player must not sound underneath
    player.playing = true;        // commit BEFORE the await - see above
    let buffer = null;
    try {
      const bytes = await replacementBytes(name);
      // A mode change can overtake a decode. Whatever this was for is
      // no longer what the game wants, so drop it rather than talking
      // over the song that replaced it.
      if (this._current !== name) return;
      if (bytes) buffer = await audio.ctx.decodeAudioData(decodableCopy(bytes));
    } catch (e) {
      console.warn(`[music] replacement for ${name} would not decode:`, e?.message ?? e);
    }
    if (this._current !== name) return;
    if (!buffer) { player.playing = false; this._playBuiltIn(name); return; }
    if (player.play(buffer)) { player.fadeTo?.(0, 0); player.fadeTo?.(1, MUSIC_FADE_IN_S); }   // DISC19-B: it rises in
  }

  /** Pick from one of songManager's verbatim playlists and play it. */
  playFrom(playlist, opts = {}) {
    const picked = selectSong(playlist, opts);
    if (!picked) return false;
    return this.playSong(picked.name);
  }

  /** Is a song sounding right now? The director asks each frame - it is
   *  the port's stand-in for DFU's `songPlayer.IsPlaying`, which drives
   *  both the re-evaluation and the replay in UpdateSong. */
  get playing() { return Boolean(this.player?.playing || this._audio?.playing); }

  stop() {
    // AUDIT 19 F12: clear the PENDING request too. `_pending` is what the
    // gesture hook replays, so a stop that left it armed meant the next
    // click restarted the song that had just been stopped - the one thing
    // stop() exists to prevent.
    this._current = null;
    this._pending = null;
    this.player?.stop();
    this._audio?.stop();   // M-EXT: both players, or a replacement outlives the stop
    this._cancelSwitch();   // DISC19-B: a stop mid-fade starts nothing after it
  }

  get current() { return this._current; }
}

export const music = new MusicService();
