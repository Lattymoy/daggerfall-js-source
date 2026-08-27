// ENHANCED MUSIC - the track player: Mac's full tracks, STREAMED and
// CROSSFADED. (EM2a, EM2c, 2026-08-27.)
//
// An <audio> element into the music bus through a MediaElementSource,
// rather than a decoded buffer: project-final's stem arc decoded every
// track to PCM at boot and paid 240-509 MB and a six-second freeze for
// it; a three-minute theme decoded is 60 MB of float that a phone does
// not need to hold. The element streams and decodes as it goes.
//
// TWO GAINS. Every play gets its own LAYER gain (the fade in, the fade
// out, the record's own level) into ONE MASTER gain (the MusicVolume
// setting). A cue change fades the old layer out while the new one
// fades in - a crossfade - and the setting moves the master alone, so
// re-levelling never fights a fade. Fades ride AudioParams
// (setValueAtTime + linearRamp), never the element's volume and never a
// curve that can throw over itself.
//
// The browser's gesture rule applies to the element exactly as to the
// context: play() may reject before the first pointer or key, and the
// service's gesture hook replays the request then. Never traps: a file
// that will not load costs the track, not the game.

export const DEFAULT_FADE_SECONDS = 3;

export class TrackPlayer {
  /**
   * @param {AudioContext} ctx
   * @param {object} [opts]
   * @param {AudioNode} [opts.destination]   defaults to ctx.destination
   * @param {() => number} [opts.gain]       the music setting, read at play and on resync
   * @param {(src: string) => HTMLAudioElement} [opts.createElement]   injectable for tests
   * @param {(fn: Function, ms: number) => any} [opts.schedule]        injectable for tests (setTimeout)
   */
  constructor(ctx, { destination = null, gain = () => 1, createElement = null, schedule = null } = {}) {
    this.ctx = ctx;
    this._destination = destination;
    this._gain = gain;
    this._create = createElement ?? ((src) => { const el = globalThis.document.createElement('audio'); el.src = src; el.preload = 'auto'; return el; });
    this._schedule = schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.element = null;   // the CURRENT track's element
    this.layer = null;     // ...and its layer gain
    this.node = null;      // ...and its media source
    this.master = null;
    this.track = null;
    this.playing = false;
    this.retiring = 0;     // layers still fading out
  }

  _ensureMaster() {
    if (this.master || !this.ctx) return;
    this.master = this.ctx.createGain();
    this.master.gain.value = this._gain();
    this.master.connect(this._destination ?? this.ctx.destination);
  }

  /** Start a track, crossfading from whatever is playing. Idempotent per
   *  track. Resolves true when the element is playing, false when the
   *  browser refused (the element stays armed), never throws. */
  async play(track, { fadeIn = DEFAULT_FADE_SECONDS } = {}) {
    if (!this.ctx || !track?.file) return false;
    if (this.playing && this.track?.id === track.id) return true;
    this._ensureMaster();
    if (this.element) this.fadeOut(this.playing ? DEFAULT_FADE_SECONDS : 0);   // the old layer goes on its own way
    const el = this._create(track.file);
    el.loop = Boolean(track.loop);
    let node, layer;
    try {
      node = this.ctx.createMediaElementSource(el);
      layer = this.ctx.createGain();
      node.connect(layer);
      layer.connect(this.master);
    } catch (e) {
      console.warn('[enhanced music] track source failed:', e?.message ?? e);
      return false;
    }
    this.element = el; this.node = node; this.layer = layer; this.track = track;
    const now = this.ctx.currentTime;
    layer.gain.setValueAtTime(0, now);
    layer.gain.linearRampToValueAtTime(track.gain ?? 1, now + Math.max(0.01, fadeIn));
    try {
      await el.play();
    } catch (e) {
      this.playing = false;   // the gesture rule, most likely; the service replays on the first gesture
      return false;
    }
    this.playing = true;
    return true;
  }

  /** Fade the current track to silence over `seconds`, then pause and
   *  release it. The player is free for a new track at once; the old
   *  layer finishes on its own timer (no event marks a ramp's end). */
  fadeOut(seconds = DEFAULT_FADE_SECONDS) {
    if (!this.element) return;
    const el = this.element, node = this.node, layer = this.layer;
    const now = this.ctx.currentTime;
    layer.gain.cancelScheduledValues(now);
    layer.gain.setValueAtTime(layer.gain.value, now);
    layer.gain.linearRampToValueAtTime(0, now + Math.max(0.01, seconds));
    this.element = null; this.node = null; this.layer = null; this.track = null;
    this.playing = false;
    const done = () => {
      this.retiring--;
      try { el.pause(); el.src = ''; } catch { /* already gone */ }
      try { node.disconnect(); layer.disconnect(); } catch { /* ditto */ }
    };
    this.retiring++;
    if (seconds <= 0) done(); else this._schedule(done, seconds * 1000 + 50);
  }

  stop(seconds = 0) { this.fadeOut(seconds); }

  /** The music setting moved: the master follows, the fades are untouched. */
  resyncGain() {
    if (!this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(this._gain(), now + 0.05);
  }
}
