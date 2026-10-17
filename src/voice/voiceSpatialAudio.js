// @ts-check
// Each remote voice gets its own gain/pan nodes on the engine's own AudioContext (passed in, never created here).
//
// A party voice runs through the same chain at gain 1, pan 0 - one code path for both channels.

/** The gain ramp's time constant (s) - a step in distance is heard as a glide, not a click. */
export const VOICE_RAMP_S = 0.05;

/**
 * @typedef {{ connect(dest: any): any, disconnect(): void, gain?: { value: number, setTargetAtTime(v: number, t: number, c: number): void }, pan?: { value: number, setTargetAtTime(v: number, t: number, c: number): void } }} VoiceNode
 * @typedef {{ createGain(): any, createStereoPanner?(): any, createMediaStreamSource(s: MediaStream): any, destination: any, currentTime: number }} VoiceContext
 */

export class VoiceSpatialAudio {
  /** @param {VoiceContext} ctx  @param {any} [destination]  where the voices' master goes (default the context's) */
  constructor(ctx, destination = null) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(destination ?? ctx.destination);
    /** @type {Map<string, { source: any, gain: any, pan: any|null, el: any|null, lastGain: number, lastPan: number }>} */
    this.voices = new Map();
  }

  /** The master's level - the player's volume setting. */
  setVolume(v) { this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, Number(v) || 0)), this.ctx.currentTime, VOICE_RAMP_S); }

  /**
   * A remote voice arrives: its MediaStream through gain and pan into the master. A muted <audio> element holds the
   * stream alive beside the graph - Chromium won't decode a remote WebRTC track that nothing plays.
   * @param {string} id  @param {MediaStream} stream  @param {{ el?: any, party?: boolean }} [o]
   */
  add(id, stream, { el = null, party = false } = {}) {
    this.drop(id);
    const source = this.ctx.createMediaStreamSource(stream);
    const gain = this.ctx.createGain();
    gain.gain.value = party ? 1 : 0;
    const pan = typeof this.ctx.createStereoPanner === 'function' ? this.ctx.createStereoPanner() : null;
    source.connect(gain);
    if (pan) { gain.connect(pan); pan.connect(this.master); } else gain.connect(this.master);
    if (el) { try { el.srcObject = stream; el.muted = true; el.play?.()?.catch?.(() => {}); } catch { /* a document without autoplay - the graph still plays */ } }
    // lastGain/lastPan start at NaN so the first place() always schedules - "unchanged from nothing" is not a thing.
    this.voices.set(id, { source, gain, pan, el, lastGain: NaN, lastPan: NaN });
  }

  /** The voice's level and side now - voiceProximity.js's voiceGainAt and panFor, ramped. A muted peer's is 0.
   *  Two players standing still ask for the same value every frame - skip the AudioParam schedule when it hasn't
   *  moved. Pan is irrelevant (never scheduled) when the context has no panner, so it never blocks the gain skip. */
  place(id, gain, pan = 0) {
    const v = this.voices.get(id);
    if (!v) return false;
    const g = Math.max(0, Math.min(1, Number(gain) || 0));
    const p = v.pan ? Math.max(-1, Math.min(1, Number(pan) || 0)) : v.lastPan;
    if (g === v.lastGain && p === v.lastPan) return true;
    const t = this.ctx.currentTime;
    if (g !== v.lastGain) v.gain.gain.setTargetAtTime(g, t, VOICE_RAMP_S);
    if (v.pan && p !== v.lastPan) v.pan.pan.setTargetAtTime(p, t, VOICE_RAMP_S);
    v.lastGain = g; v.lastPan = p;
    return true;
  }

  /** The voice leaves: its nodes disconnected, its element let go. */
  drop(id) {
    const v = this.voices.get(id);
    if (!v) return false;
    for (const n of [v.source, v.gain, v.pan]) { try { n?.disconnect(); } catch { /* already gone */ } }
    if (v.el) { try { v.el.pause?.(); v.el.srcObject = null; v.el.remove?.(); } catch { /* detached */ } }
    this.voices.delete(id);
    return true;
  }

  /** Every voice gone and the master off the graph. */
  destroy() {
    for (const id of [...this.voices.keys()]) this.drop(id);
    try { this.master.disconnect(); } catch { /* already gone */ }
  }
}
