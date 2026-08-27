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

import { audio } from './audio.js';
import { MidiBsaFile } from '../formats/hmiFile.js';
import { selectSong } from './songManager.js';
import { SongPlayer, AudioSongPlayer } from './songPlayer.js';   // M-EXT: the replacement's player shares the volume law
import { hasReplacement, replacementBytes } from './musicReplacement.js';   // M-EXT: SoundReplacement.TryImportSong
import { TrackPlayer } from './enhancedMusic/trackPlayer.js';   // EM2a: Mac's own tracks, streamed
import { trackGain } from './songPlayer.js';   // EM2b: the setting alone - no synth trim on a mastered track
import { UNDERSCORE_TRIM } from './enhancedMusic/scores.js';   // EM2c: how far under a track the composed piece sits
import { DangerMeter, dangerRaw } from './enhancedMusic/danger.js';   // EM4
import { layerMix } from './enhancedMusic/palettes.js';   // EM4b: the danger level as a per-layer gain
import { onSettingChange } from './settings.js';

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
    // EM2b: the MusicVolume setting is LIVE in fact, not just in tier -
    // every player this service owns re-levels the moment it is written,
    // so the slider is heard on the menu theme and mid-song alike.
    this._unsubscribe = onSettingChange((section, key) => {
      if (section === 'Controls' && key === 'MusicVolume') this.resyncGain();
    });
  }

  /** Re-level whatever is sounding to the MusicVolume setting. */
  resyncGain() {
    this.player?.resyncGain?.();
    this._audio?.resyncGain?.();
    this._track?.resyncGain?.();
  }

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
        const p = this._pending;
        // A name is an archive song, a song object a composed piece, and
        // a record with a file one of Mac's tracks (EM2a).
        if (typeof p === 'string') { if (this.playSong(p)) this._pending = null; return; }
        if (p.file) { this.playTrack(p).then((ok) => { if (ok && this._pending === p) this._pending = null; }); return; }
        if (this.playScore(p)) this._pending = null;
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
  _ensurePlayer({ needsArchive = true } = {}) {
    if (needsArchive && !this.enabled) return null;
    if (this.player) return this.player;
    if (!audio.ctx) return null;
    this.player = new SongPlayer(audio.ctx);
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
    if (this._current === name && this.playing) return true;
    // M-EXT: a user-supplied track OVERRIDES the built-in song
    // (SoundReplacement.TryImportSong, and DFU asks before it reaches
    // its own data too). The lookup is synchronous - a Map hit behind
    // the AssetInjection gate - but loading and decoding are not, so
    // the commit happens here and the sound arrives a beat later.
    if (hasReplacement(name)) {
      this._current = name;
      this._startReplacement(name);
      return true;
    }
    return this._playBuiltIn(name);
  }

  /** EM2a: play one of Mac's own TRACKS (a scores.js record), streamed.
   *  Needs a clock and nothing else - no archive, no folder pick - so
   *  the enhanced front door can call it before any data exists. The
   *  browser's gesture rule may refuse the first play; then it is
   *  pended and the gesture hook replays it. Resolves true when sound
   *  is moving. Never throws. */
  async playTrack(track) {
    if (!track?.file) return false;
    if (this._track?.playing && this._track.track?.id === track.id) return true;
    const ctx = audio.ensureClock();
    if (!ctx) return false;
    this.attachGestureStart();
    this._track ??= new TrackPlayer(ctx, { gain: trackGain });
    this._audio?.stop();    // a replacement must not sound underneath (the scheduler may: the underscore, EM2c)
    this._currentTrack = track.id;
    const ok = await this._track.play(track);
    if (!ok && this._currentTrack === track.id) this._pending = track;   // the gesture rule: replayed on the first gesture
    return ok;
  }

  /** The game's own music taking over from a track: fade it under,
   *  never cut it. EM2a's one rule for the other three doors. */
  _fadeTrackUnder() { if (this._track?.playing) this._track.fadeOut(); }

  /** EM4: the hosts report their foes every frame (the dungeon's
   *  drawFoes, the exterior's pools) and the meter decides, slowly,
   *  whether the enemies have you. When they do, the place's track
   *  crossfades into the danger track and the composed underscore -
   *  in the place's key, not danger's - fades out under it; when they
   *  lose you, the place's own track comes back. Nothing happens under
   *  the classic skin or in a place the enhanced side is not scoring:
   *  there is no place score to return to. Returns the meter's state. */
  reportDanger(dt, foes) {
    if (!this._placeScore?.song || !this._placeScore.palette) return false;
    this._dangerMeter ??= new DangerMeter();
    const meter = this._dangerMeter;
    meter.update(dt, dangerRaw(foes));
    this._danger = meter.active;
    // EM4b: the LEVEL, continuous and slewed, becomes the piece's layer
    // mix - the tension layers come up from silence, the motif thins,
    // the bed darkens - through the scheduler's change-guarded door.
    this.player?.setLayerMix?.(layerMix(this._placeScore.palette, meter.level));
    return meter.active;
  }

  get inDanger() { return Boolean(this._danger); }
  get dangerLevel() { return this._dangerMeter?.level ?? 0; }

  /** EM2c: play the enhanced side's answer for a cue - `{ track, song }`
   *  from enhancedMusic.enhancedScore. A track crossfades from whatever
   *  track played before; the composed piece plays UNDER it, trimmed,
   *  or alone at full level when the place has no track. Both halves
   *  are idempotent, so the director may call this every frame it
   *  would have called play. Returns true when something is sounding
   *  or pending for the gesture. */
  playEnhanced(score) {
    if (!score) return false;
    const { track, song } = score;
    // EM4: a new cue is the PLACE's score again; whatever danger the
    // last place was in does not follow the player through the door.
    this._placeScore = score;
    this._danger = false;
    this._dangerMeter?.reset();
    this.player?.resetLayerMix?.();   // EM4b: a new place starts at rest
    let any = false;
    if (track) { this.playTrack(track); any = true; }
    if (song) {
      // Under a track: the piece is trimmed and the track stays. Alone:
      // playScore's own door fades any track under and resets the trim.
      const player = this._ensurePlayer({ needsArchive: false });
      if (player) {
        if (track) player.setTrim?.(UNDERSCORE_TRIM);
        if (this.playScore(song, { under: Boolean(track) })) any = true;
      } else { this._pending = song; }
    } else {
      if (!track && this._track?.playing) this._track.fadeOut();   // nothing at all: fade whatever track is up
      this.player?.stop();
    }
    return any;
  }

  /** EM1: play a COMPOSED song - the enhanced side's piece for a cue,
   *  in the reader's own shape - through the same scheduler and bank.
   *  Idempotent per piece, like playSong per name. Pending like playSong
   *  when the page has no context yet: the gesture hook replays it. */
  playScore(song, { under = false } = {}) {
    if (!song?.events?.length) return false;
    const player = this._ensurePlayer({ needsArchive: false });   // composed: MIDI.BSA is not consulted
    if (!player) { this._pending = song; return false; }
    if (this._current === song.name && player.playing) return true;
    this._audio?.stop();   // a replacement must not sound underneath
    if (!under) { this._fadeTrackUnder(); player.setTrim?.(1); }   // EM2c: under a track, the track stays and the piece is trimmed
    this._current = song.name;
    return player.play(song);
  }

  /** The MIDI.BSA path - what playSong did before replacements existed,
   *  and still the fallback for every song a pick does not cover. */
  _playBuiltIn(name) {
    const player = this._ensurePlayer();
    if (!player) return false;
    this._audio?.stop();   // a replacement must not sound underneath
    this._fadeTrackUnder();
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
    return player.play(song);
  }

  _ensureAudioPlayer() {
    if (this._audio) return this._audio;
    if (!audio.ctx) return null;
    this._audio = new AudioSongPlayer(audio.ctx);
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
    this._fadeTrackUnder();
    player.playing = true;        // commit BEFORE the await - see above
    let buffer = null;
    try {
      const bytes = await replacementBytes(name);
      // A mode change can overtake a decode. Whatever this was for is
      // no longer what the game wants, so drop it rather than talking
      // over the song that replaced it.
      if (this._current !== name) return;
      if (bytes) buffer = await audio.ctx.decodeAudioData(bytes.buffer ? bytes.buffer.slice(0) : bytes);
    } catch (e) {
      console.warn(`[music] replacement for ${name} would not decode:`, e?.message ?? e);
    }
    if (this._current !== name) return;
    if (!buffer) { player.playing = false; this._playBuiltIn(name); return; }
    player.play(buffer);
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
  get playing() { return Boolean(this.player?.playing || this._audio?.playing || this._track?.playing); }

  stop() {
    // AUDIT 19 F12: clear the PENDING request too. `_pending` is what the
    // gesture hook replays, so a stop that left it armed meant the next
    // click restarted the song that had just been stopped - the one thing
    // stop() exists to prevent.
    this._current = null;
    this._pending = null;
    this.player?.stop();
    this._audio?.stop();   // M-EXT: both players, or a replacement outlives the stop
    this._track?.stop();   // EM2a: and the track
  }

  get current() { return this._current; }
}

export const music = new MusicService();
