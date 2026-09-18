// INTRO2: one decoded source, from the first note through the menu.
// A user gesture unlocks AudioContext BEFORE any await. Playback starts only
// after every cinematic asset is ready. No silent wall-clock substitute.
// getOutputTimestamp maps the audio DEVICE clock onto performance.now():
// currentTime alone is ahead of what is heard by the output pipeline latency.
import { trackGain } from './songPlayer.js';
import { onSettingChange } from './settings.js';

export const THEME_URL = new URL('../assets/intro/theme.mp3', import.meta.url).href;
export const INTRO_THEME_GAIN = 0.82;
export const MENU_THEME_GAIN = 0.26;
export const THEME_LOAD_TIMEOUT_MS = 15000;

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
  constructor({ makeContext, fetcher = globalThis.fetch?.bind(globalThis), readVolume = trackGain, subscribe = onSettingChange, now = () => performance.now() } = {}) {
    this.makeContext = makeContext ?? (() => {
      const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      return Ctor ? new Ctor({ latencyHint: 'interactive' }) : null;
    });
    this.fetcher = fetcher;
    this.readVolume = readVolume;
    this.subscribe = subscribe;
    this.now = now;
    this.context = null;
    this.source = null;
    this.gain = null;
    this.buffer = null;
    this.loading = null;
    this.startedAt = null;
    this.level = INTRO_THEME_GAIN;
    this.unsubscribe = null;
    this.disposed = false;
    this.lastTime = 0;
    this.abort = new globalThis.AbortController();
    this.loadTimer = null;
  }

  prepare() {
    if (this.loading) return this.loading;
    this.loading = this._prepare();
    return this.loading;
  }

  async _prepare() {
    try {
      this.context = this.makeContext();
      if (!this.context) throw new Error('Web Audio is unavailable');
      this.gain = this.context.createGain();
      this.gain.gain.value = Math.max(0, this.readVolume()) * this.level;
      this.gain.connect(this.context.destination);
      this.unsubscribe = this.subscribe((section, key) => {
        if (section === 'Controls' && key === 'MusicVolume') this.setLevel(this.level, 0.12);
      });
      const context = this.context;
      const load = async () => {
        const response = await this.fetcher(THEME_URL, { signal: this.abort.signal });
        if (!response.ok) throw new Error(`Theme request failed (${response.status})`);
        const bytes = await response.arrayBuffer();
        if (this.disposed) return null;
        return context.decodeAudioData(bytes);
      };
      // Bound fetch AND decode. Aborting fetch alone cannot stop a decoder
      // that never settles, and the player's Begin button must not get stuck.
      this.buffer = await Promise.race([load(), new Promise((_, reject) => {
        this.loadTimer = setTimeout(() => { this.abort.abort(); reject(new Error('Theme loading timed out')); }, THEME_LOAD_TIMEOUT_MS);
      })]);
      if (this.disposed) { this.buffer = null; return false; }
      return true;
    } catch (error) {
      if (!this.disposed) console.warn('[intro] music unavailable:', error.message);
      return false;
    } finally {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
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
    if (this.disposed || !this.buffer || this.context?.state !== 'running') return false;
    if (this.source) return true;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = true;
    source.connect(this.gain);
    this.source = source;
    this.startedAt = this.context.currentTime + 0.06;
    source.start(this.startedAt);
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
    const value = this.level * Math.max(0, Math.min(1, this.readVolume()));
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(at);
    else { const held = param.value; param.cancelScheduledValues(at); param.setValueAtTime(held, at); }
    param.linearRampToValueAtTime(value, at + Math.max(0.01, seconds));
  }

  async pause() {
    if (this.context?.state === 'running') {
      this.time();
      await this.context.suspend();
    }
  }

  /** Release the graph, decode buffer, timer, fetch and settings listener. */
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    clearTimeout(this.loadTimer);
    this.unsubscribe?.();
    this.unsubscribe = null;
    const source = this.source;
    this.source = null;
    try { source?.stop(); } catch { /* a source can already have ended */ }
    source?.disconnect();
    this.gain?.disconnect();
    this.buffer = null;
    this.gain = null;
    const context = this.context;
    this.context = null;
    try { await context?.close(); } catch { /* already closed */ }
  }
}
