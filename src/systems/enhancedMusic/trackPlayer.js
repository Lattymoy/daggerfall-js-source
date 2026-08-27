// ENHANCED MUSIC - the track player: one of Mac's full tracks, STREAMED.
// (EM2a, 2026-08-27.)
//
// An <audio> element into the music bus through a MediaElementSource,
// rather than a decoded buffer: project-final's stem arc decoded every
// track to PCM at boot and paid 240-509 MB and a six-second freeze for
// it; a three-minute theme decoded is 60 MB of float that a phone does
// not need to hold. The element streams and decodes as it goes.
//
// The browser's gesture rule applies to the element exactly as to the
// context: play() may reject before the first pointer or key, and the
// service's gesture hook replays the request then. Never traps: a file
// that will not load costs the theme, not the game.
//
// Fades ride the gain node, never the element's volume: setValueAtTime +
// linearRamp on an AudioParam is sample-accurate and cannot throw over
// itself the way the reverted arc's overlapping curves did.

export const DEFAULT_FADE_SECONDS = 3;

export class TrackPlayer {
  /**
   * @param {AudioContext} ctx
   * @param {object} [opts]
   * @param {AudioNode} [opts.destination]   defaults to ctx.destination
   * @param {() => number} [opts.gain]       the music gain (the setting), read at play
   * @param {(src: string) => HTMLAudioElement} [opts.createElement]   injectable for tests
   */
  constructor(ctx, { destination = null, gain = () => 1, createElement = null } = {}) {
    this.ctx = ctx;
    this._destination = destination;
    this._gain = gain;
    this._create = createElement ?? ((src) => { const el = globalThis.document.createElement('audio'); el.src = src; el.preload = 'auto'; return el; });
    this.element = null;
    this.node = null;
    this.master = null;
    this.track = null;
    this.playing = false;
  }

  _ensureMaster() {
    if (this.master || !this.ctx) return;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this._destination ?? this.ctx.destination);
  }

  /** Start a track. Idempotent per track. Resolves when the element is
   *  playing, or when the browser refused (returns false), never throws. */
  async play(track, { fadeIn = 1 } = {}) {
    if (!this.ctx || !track?.file) return false;
    if (this.playing && this.track?.id === track.id) return true;
    this.stop(0);
    this._ensureMaster();
    const el = this._create(track.file);
    el.loop = Boolean(track.loop);
    this.element = el;
    this.track = track;
    try {
      this.node = this.ctx.createMediaElementSource(el);
      this.node.connect(this.master);
    } catch (e) {
      // A second source on the same element throws; a missing API means no bus.
      console.warn('[enhanced music] track source failed:', e?.message ?? e);
      this.element = null; this.track = null;
      return false;
    }
    const level = this._gain() * (track.gain ?? 1);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0, now);
    this.master.gain.linearRampToValueAtTime(level, now + Math.max(0.01, fadeIn));
    try {
      await el.play();
    } catch (e) {
      // The gesture rule, most likely. Leave the element armed: the
      // service's gesture hook calls play() again on the first gesture.
      this.playing = false;
      return false;
    }
    this.playing = true;
    return true;
  }

  /** Fade to silence over `seconds`, then pause and release. The
   *  element is torn down on a timer, not on the ramp's completion:
   *  there is no event for an AudioParam ramp ending. */
  fadeOut(seconds = DEFAULT_FADE_SECONDS) {
    if (!this.element) return;
    const el = this.element;
    const now = this.ctx.currentTime;
    if (this.master) {
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + Math.max(0.01, seconds));
    }
    this.playing = false;
    this.track = null;
    this.element = null;
    const node = this.node; this.node = null;
    const done = () => { try { el.pause(); el.src = ''; } catch { /* already gone */ } try { node?.disconnect(); } catch { /* ditto */ } };
    if (seconds <= 0) done(); else setTimeout(done, seconds * 1000 + 50);
  }

  stop(seconds = 0) { this.fadeOut(seconds); }

  /** The music setting moved: follow it on the live track. */
  resyncGain() {
    if (!this.master || !this.track) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(this._gain() * (this.track.gain ?? 1), now + 0.05);
  }
}
