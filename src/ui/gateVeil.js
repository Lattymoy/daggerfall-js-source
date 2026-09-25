// @ts-check
// WB6c (2026-09-25, Mac: "the transition and the arena needs to be an oblivion masterpiece"): THE GATE'S VEIL ON THE
// PAGE - the canvas the step through an Oblivion gate is drawn on (render/gateVeil.js: the law and the fire), its loop,
// and its sounds. Design: bible/11-Multiplayer/World-Bosses.md section 4 ("The step through").
//
// A CANVAS OF ITS OWN, over the game's, made the first time a gate is stepped through and kept: the fire needs nothing
// of the world's frame, so it rides no pass of the renderer's (no seam to mark, no state to hand back), and it keeps
// burning while the place beyond is built. Its loop runs only while the veil is up.
//
// THE STEP (`cover` then `reveal`): the fire closes over the screen and the promise answers when it has (true - or
// false at once where no veil can be made: the step goes on, unveiled); the host changes the place under it; then it
// opens, holding shut until the new place has DRAWN VEIL_OPEN_WAIT_TICKS frames (AUDIT WB D5: the host says each one -
// `frameDrawn`; its own ticks were not the world's frames, which a frame cap or a held frame skips), so its first
// frames (its programs built on first sight) do not eat the opening; a host that says none counts the veil's ticks.
// Asked to close while it opens, it closes from where it stands - no jump. A place taken from the player by force (the
// court coming apart, a death cast out) is `flash`: the fire at once - drawn in the call itself (AUDIT WB D6), never a
// frame of what it covers - then open. Shut past VEIL_HOLD_MAX_S it opens on whatever stands. `warm` builds it ahead,
// in the browser's idle time, so the first step does not pay for its program.
// Not a DFU member. Ledger A (WB).
import { audio as defaultAudio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { GateVeilRenderer, veilAt, VEIL_CLOSE_S, VEIL_OPEN_S, VEIL_HOLD_MAX_S, VEIL_FRONT_IN, VEIL_FRONT_OUT } from '../render/gateVeil.js';
import { FIRE_CAST_ID } from '../world/gateBoss.js';

/** Over the world and its HUD (z 4, appended after .hud, which it ties and follows - ui/nameLayer.js AUDIT NAME1 F4
 *  maps the page's layers), under the chat and the party (5): a word said as the fire closes is still read. No pointer. */
export const VEIL_CSS = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:4;pointer-events:none;';
/** The canvas's pixels against the page's: the fire is soft, and half of it is a quarter of the work. */
export const VEIL_SCALE = 0.5;
/** Ticks held shut after an opening is asked for, before its clock starts. */
export const VEIL_OPEN_WAIT_TICKS = 2;
/** THE SOUNDS: as it closes, the fire's cast pitched down to a roar and the deep wind; as it opens, a roll of thunder
 *  and the fire. `id` a sound ID (audio.soundIndexForId), `clip` a record index. */
export const VEIL_CUES = Object.freeze({
  close: Object.freeze([Object.freeze({ id: FIRE_CAST_ID, volume: 1.1, pitch: 0.5 }), Object.freeze({ clip: SOUND.AmbientWindMoanDeep, volume: 0.9, pitch: 0.55 })]),
  open: Object.freeze([Object.freeze({ clip: 350, volume: 0.8, pitch: 0.72 }), Object.freeze({ clip: SOUND.Burning, volume: 0.7, pitch: 0.45 })]),
});

/**
 * The veil. `doc` the page (a canvas is made in it once), `raf` the frame clock, `now` milliseconds, `engine` the
 * sounds' engine. Answers `{ phase, busy, cover(), reveal(), flash(), destroy() }`.
 */
export function createGateVeil({ doc = globalThis.document, raf = (f) => globalThis.requestAnimationFrame(f), now = () => performance.now(), engine = defaultAudio, win = globalThis } = {}) {
  let canvas = null, pass = null, broken = false;
  let phase = 'idle', at = 0, began = 0, from = VEIL_FRONT_IN, wait = 0, ticking = false;
  /** AUDIT WB D5: the frames the host has said it drew, and whether it says them at all; the count at the reveal */
  let drawnN = 0, hostCounts = false, drawnAt = 0;
  let waiters = [];
  const settle = (ok) => { const w = waiters; waiters = []; for (const f of w) f(ok); };
  const cue = (name) => {
    for (const c of VEIL_CUES[name]) {
      try { const index = c.id != null ? engine.soundIndexForId(c.id) : c.clip; if (index >= 0) engine.playOneShot(index, c.volume, c.pitch); } catch { /* a sound is never the step */ }
    }
  };
  const seconds = (t) => (t - at) / 1000;
  const current = (t) => veilAt(phase, seconds(t), from);
  function build() {
    if (pass) return true;
    if (broken || !doc?.createElement || !doc.body) return false;
    try {
      canvas = doc.createElement('canvas');
      canvas.style.cssText = `${VEIL_CSS}display:none;`;
      canvas.setAttribute?.('aria-hidden', 'true');
      doc.body.appendChild(canvas);
      const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
      if (!gl) throw new Error('no WebGL2');
      pass = new GateVeilRenderer(gl);
      return true;
    } catch (e) {
      console.warn('[gate] the veil would not build', e?.message ?? e);
      broken = true;
      canvas?.remove?.();
      canvas = null; pass = null;
      return false;
    }
  }
  function draw(t) {
    const dpr = win.devicePixelRatio || 1;
    const w = Math.max(1, Math.round((win.innerWidth || 1280) * dpr * VEIL_SCALE)), h = Math.max(1, Math.round((win.innerHeight || 720) * dpr * VEIL_SCALE));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    try { pass.draw(w, h, (t - began) / 1000, current(t)); } catch { /* a veil is never the step */ }
  }
  function kick() { if (!ticking) { ticking = true; raf(tick); } }
  function open(t, front) { phase = 'opening'; at = t; from = front; wait = 0; cue('open'); }
  function tick() {
    ticking = false;
    const t = now();
    if (phase === 'closing' && seconds(t) >= VEIL_CLOSE_S) { phase = 'shut'; at = t; settle(true); }
    if (phase === 'shut') {
      if (wait > 0) {
        if (!hostCounts) wait--;
        if (hostCounts ? drawnN - drawnAt >= wait : wait === 0) { wait = 0; open(t, VEIL_FRONT_IN); }
        else if (seconds(t) >= VEIL_HOLD_MAX_S) { wait = 0; open(t, VEIL_FRONT_IN); }
      } else if (seconds(t) >= VEIL_HOLD_MAX_S) open(t, VEIL_FRONT_IN);   // a build that never answered: open on what stands
    }
    if (phase === 'opening' && seconds(t) >= VEIL_OPEN_S) phase = 'idle';
    if (phase === 'idle' || !canvas) { if (canvas) canvas.style.display = 'none'; return; }
    draw(t);
    kick();
  }
  function show(t) { began = t; canvas.style.display = 'block'; }
  return {
    get phase() { return phase; },
    get busy() { return phase !== 'idle'; },
    /** Close the fire over the screen: true once it has (at once, if it already stands shut), false where no veil can
     *  be made or it was opened before it shut. */
    cover() {
      if (!build()) return Promise.resolve(false);
      const t = now();
      if (phase === 'shut') { wait = 0; return Promise.resolve(true); }
      if (phase === 'idle' || phase === 'opening') {
        // from where it stands: the closing's own clock set back to the moment its front was here
        const f = phase === 'opening' ? current(t).front : VEIL_FRONT_OUT;
        const u = Math.max(0, Math.min(1, (VEIL_FRONT_OUT - f) / (VEIL_FRONT_OUT - VEIL_FRONT_IN))) ** (1 / 1.6);
        if (phase === 'idle') show(t);
        phase = 'closing'; at = t - u * VEIL_CLOSE_S * 1000;
        cue('close');
        kick();
      }
      return new Promise((resolve) => waiters.push(resolve));
    },
    /** Open it: from shut after VEIL_OPEN_WAIT_TICKS ticks, from a closing where it stands. */
    reveal() {
      const t = now();
      if (phase === 'shut') { wait = VEIL_OPEN_WAIT_TICKS; drawnAt = drawnN; kick(); }
      else if (phase === 'closing') { open(t, current(t).front); settle(false); kick(); }
    },
    /** The fire at once, then open - a place taken by force. */
    flash() {
      if (!build()) return;
      const t = now();
      if (phase === 'idle') show(t);
      phase = 'shut'; at = t; wait = VEIL_OPEN_WAIT_TICKS; drawnAt = drawnN;
      settle(true);
      draw(t);   // AUDIT WB D6: the fire in this very call - the next tick is a frame late, and that frame showed what it covers
      kick();
    },
    /** AUDIT WB D5: the host drew a frame of its place - the hold counts these, not the veil's own ticks. */
    frameDrawn() { hostCounts = true; drawnN++; },
    /** AUDIT WB D5: build the canvas and its program now, ahead of the first step (the host's idle time). */
    warm() { return build(); },
    destroy() {
      settle(false);
      phase = 'idle';
      try { pass?.destroy(); } catch { /* the context went with the page */ }
      canvas?.remove?.();
      canvas = null; pass = null;
    },
  };
}
