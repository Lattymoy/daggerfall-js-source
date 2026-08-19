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
import { SongPlayer } from './songPlayer.js';
import { selectSong } from './songManager.js';

export class MusicService {
  constructor() {
    this.archive = null;
    this.player = null;
    this.enabled = false;
    // null, NOT false: `ensure` memoises with `??=`, which assigns only
    // over null/undefined. A `false` here is neither, so _boot was never
    // called at all and ensure() returned the boolean - which Promise.all
    // accepts happily, so every host thought music had booted. Caught by a
    // live boot probe, not by the suite (AUDIT 19).
    this._booted = null;
    this._current = null;
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
    if (this._current === name && player.playing) return true;
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

  /** Pick from one of songManager's verbatim playlists and play it. */
  playFrom(playlist, opts = {}) {
    const picked = selectSong(playlist, opts);
    if (!picked) return false;
    return this.playSong(picked.name);
  }

  stop() {
    this._current = null;
    this.player?.stop();
  }

  get current() { return this._current; }
}

export const music = new MusicService();
