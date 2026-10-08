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
import { loseGlContext, onPageGone } from '../render/glRelease.js';   // GL-LEAK: its context let go with it, and as the page goes
import { SdVeilRenderer, SD_VEIL_MODE, sdVeilQuarters } from '../render/sdVeil.js';
import { midiNote } from '../systems/gateScore.js';
import { HOUR_CHIME, HOUR_CHIME_MENDED } from '../systems/sdScore.js';

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
/** AUDIT SD II (L6 F8): THE SHATTERED HOUR'S VEIL - every step into and out of the Hour was Dagon's fire and its roar
 *  (Mac, of the Hour: "not oblivion, something different"): the same whirl in brass, the Mantella's green its eye
 *  (render/gateVeil.js `uTheme`); as it closes, the Orrery's toll (the ship's bell, low) over the Warp's deep wind; as it
 *  opens, a gear's clunk and the Concord's chime (scenes/sdHall.js SD_HALL_SOUNDS). The fire's stays the default. */
export const VEIL_THEMES = Object.freeze({ fire: 0, brass: 1, hourIn: 2, hourBack: 3, hourHome: 4, hourCast: 5 });
export const VEIL_BRASS_CUES = Object.freeze({
  close: Object.freeze([Object.freeze({ clip: 107, volume: 1.0, pitch: 0.5 }), Object.freeze({ clip: SOUND.AmbientWindMoanDeep, volume: 0.9, pitch: 0.45 })]),
  open: Object.freeze([Object.freeze({ clip: 433, volume: 1.0, pitch: 0.55 }), Object.freeze({ clip: 364, volume: 0.6, pitch: 0.7 })]),
});
const themeOf = (name) => VEIL_THEMES[name] ?? VEIL_THEMES.fire;
/** SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md section 3): THE HOUR'S OWN VEIL - the Hour's four
 *  themes drawn by render/sdVeil.js (twelve brass blades closing on the Rift into a dial; the brass whirl stays for a
 *  caller that names 'brass'), each its mode there. Its canvas a third of the device's pixels, drawn pixelated - the
 *  Hour's pixel art. */
export const VEIL_HOUR_MODE = Object.freeze({ [VEIL_THEMES.hourIn]: SD_VEIL_MODE.in, [VEIL_THEMES.hourBack]: SD_VEIL_MODE.back, [VEIL_THEMES.hourHome]: SD_VEIL_MODE.home, [VEIL_THEMES.hourCast]: SD_VEIL_MODE.cast });
export const VEIL_HOUR_SCALE = 1 / 3;
/** The least an Hour's veil stands shut before it opens (seconds): the way home's long enough for its crack to mend
 *  (`VEIL_HOUR_MEND_S`), the forced one's for its red face to be read before it shatters; a step's, none - its own
 *  building is the wait. */
export const VEIL_HOUR_HOLD_S = Object.freeze({ [SD_VEIL_MODE.in]: 0, [SD_VEIL_MODE.back]: 0, [SD_VEIL_MODE.home]: 1.6, [SD_VEIL_MODE.cast]: 0.4 });
export const VEIL_HOUR_MEND_S = 1.2;
/** THE HOUR'S SOUNDS: the blades ratchet in (the Orrery's gear's clunk, struck at each third of the closing, rising),
 *  the bell tolls as they shut, a quarter strikes as the hand passes each quarter of its dial - the broken quarters
 *  (systems/sdScore.js HOUR_CHIME, the fourth on its wrong F sharp) going in, the mended (HOUR_CHIME_MENDED) going
 *  home - and the Concord's chime as it opens; forced, the bell and a shattering. */
const chimePitch = (note) => 0.7 * 2 ** ((midiNote(note) - midiNote('C5')) / 12);
export const VEIL_HOUR_CUES = Object.freeze({
  ratchet: Object.freeze({ clip: 433, volume: 0.9, pitches: Object.freeze([0.6, 0.7, 0.8]) }),
  shut: Object.freeze([Object.freeze({ clip: 107, volume: 1.0, pitch: 0.5 })]),
  open: Object.freeze([Object.freeze({ clip: 364, volume: 0.7, pitch: 0.7 })]),
  cast: Object.freeze([Object.freeze({ clip: 107, volume: 1.0, pitch: 0.42 }), Object.freeze({ clip: 433, volume: 1.0, pitch: 0.35 })]),
  quarters: Object.freeze(HOUR_CHIME.map((c) => chimePitch(c[3]))),
  mended: Object.freeze(HOUR_CHIME_MENDED.map((c) => chimePitch(c[3]))),
  chime: 364,
});
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
/** Where an Hour's veil may pivot at the most from the screen's centre (screen radii): a Rift at the screen's edge, or
 *  behind the eye, still closes on the screen. */
export const VEIL_CENTRE_MAX = 0.6;

/**
 * The veil. `doc` the page (a canvas is made in it once), `raf` the frame clock, `now` milliseconds, `engine` the
 * sounds' engine. Answers `{ phase, busy, cover(), reveal(), flash(), destroy() }`.
 */
export function createGateVeil({ doc = globalThis.document, raf = (f) => globalThis.requestAnimationFrame(f), now = () => performance.now(), engine = defaultAudio, win = globalThis } = {}) {
  let canvas = null, pass = null, broken = false;
  let veilGl = null, unseat = null;   // GL-LEAK: the context, and its seat for the page's going
  let phase = 'idle', at = 0, began = 0, from = VEIL_FRONT_IN, wait = 0, ticking = false;
  /** @type {number} */ let theme = VEIL_THEMES.fire;   // AUDIT SD II (L6 F8): the step's own - set as it closes or flashes
  // SD-LOOK: the Hour's veil - its program (built the first time an Hour's theme is drawn), the Rift on the screen, how
  // long it stood shut when it opened (its hand stays where it stopped), the cues struck, reduced motion
  let hourPass = null, hourBroken = false, centre = [0, 0], shutFor = 0, ratchets = 0, quarters = 0, reduce = false;
  const hourMode = () => VEIL_HOUR_MODE[theme];
  /** AUDIT WB D5: the frames the host has said it drew, and whether it says them at all; the count at the reveal */
  let drawnN = 0, hostCounts = false, drawnAt = 0;
  let waiters = [];
  const settle = (ok) => { const w = waiters; waiters = []; for (const f of w) f(ok); };
  const play = (clip, volume, pitch) => { try { engine.playOneShot(clip, volume, pitch); } catch { /* a sound is never the step */ } };
  const cue = (name) => {
    const m = hourMode();
    if (m !== undefined) {
      // SD-LOOK: the Hour's - the first ratchet as it begins to close (the rest struck by the tick), the toll as it
      // shuts, the chime as it opens; forced, the bell and the shattering at once
      const H = VEIL_HOUR_CUES;
      if (name === 'close') { ratchets = 1; play(H.ratchet.clip, H.ratchet.volume, H.ratchet.pitches[0]); }
      for (const c of (name === 'open' ? H.open : name === 'shut' ? H.shut : name === 'cast' ? (m === SD_VEIL_MODE.cast ? H.cast : H.shut) : [])) play(c.clip, c.volume, c.pitch);
      return;
    }
    if (name !== 'close' && name !== 'open') return;
    for (const c of (theme === VEIL_THEMES.brass ? VEIL_BRASS_CUES : VEIL_CUES)[name]) {
      try { const index = c.id != null ? engine.soundIndexForId(c.id) : c.clip; if (index >= 0) engine.playOneShot(index, c.volume, c.pitch); } catch { /* a sound is never the step */ }
    }
  };
  /** SD-LOOK: the cues the Hour's veil strikes as it stands - the ratchets at the closing's thirds, a quarter as its
   *  hand passes each quarter of the dial (into the Hour and back the broken quarters, home the mended). */
  const hourCues = (t) => {
    const m = hourMode(), H = VEIL_HOUR_CUES;
    if (phase === 'closing') {
      for (const want = Math.min(3, 1 + Math.floor((seconds(t) / VEIL_CLOSE_S) * 3)); ratchets < want; ratchets++) play(H.ratchet.clip, H.ratchet.volume, H.ratchet.pitches[ratchets]);
    } else if (phase === 'shut' && m !== SD_VEIL_MODE.cast && !reduce) {
      const notes = m === SD_VEIL_MODE.home ? H.mended : H.quarters;
      for (const want = sdVeilQuarters(seconds(t), m); quarters < want; quarters++) play(H.chime, 0.55, notes[quarters % notes.length]);
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
      veilGl = gl;
      unseat = onPageGone(() => loseGlContext(gl));   // GL-LEAK
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
  /** SD-LOOK: the Hour's program, built the first time it is drawn - none where it would not build (the brass whirl
   *  draws the Hour's veil instead). */
  function hourPassOf() {
    if (!hourPass && !hourBroken) {
      try { hourPass = new SdVeilRenderer(veilGl); } catch (e) { console.warn('[sd] the Hour\'s veil would not build', e?.message ?? e); hourBroken = true; }
    }
    return hourPass;
  }
  /** SD-LOOK: what the Hour's veil draws at `t` - its mode, the Rift on the screen, its hand's clock, its opening, the
   *  way home's mend and the forced shatter. */
  function hourLook(t, m) {
    const s = seconds(t), shut = phase === 'shut' ? s : phase === 'opening' ? shutFor : 0;
    const opening = phase === 'opening' ? Math.min(1, s / VEIL_OPEN_S) : 0;
    return {
      mode: m, centre, reduce, opening,
      shut: reduce ? 0 : shut,
      mend: m === SD_VEIL_MODE.home ? Math.min(1, shut / VEIL_HOUR_MEND_S) : 0,
      shatter: m === SD_VEIL_MODE.cast ? opening : 0,
    };
  }
  function draw(t) {
    const dpr = win.devicePixelRatio || 1;
    const m = hourMode(), hp = m !== undefined ? hourPassOf() : null;
    const k = hp ? VEIL_HOUR_SCALE : VEIL_SCALE;
    const w = Math.max(1, Math.round((win.innerWidth || 1280) * dpr * k)), h = Math.max(1, Math.round((win.innerHeight || 720) * dpr * k));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const px = hp ? 'pixelated' : '';
    if (canvas.style.imageRendering !== px) canvas.style.imageRendering = px;
    try {
      if (hp) hp.draw(w, h, (t - began) / 1000, current(t), hourLook(t, m));
      else pass.draw(w, h, (t - began) / 1000, current(t), m !== undefined ? VEIL_THEMES.brass : theme);
    } catch { /* a veil is never the step */ }
  }
  function kick() { if (!ticking) { ticking = true; raf(tick); } }
  function open(t, front) { shutFor = phase === 'shut' ? seconds(t) : 0; phase = 'opening'; at = t; from = front; wait = 0; cue('open'); }
  function tick() {
    ticking = false;
    const t = now();
    if (hourMode() !== undefined) hourCues(t);
    if (phase === 'closing' && seconds(t) >= VEIL_CLOSE_S) { phase = 'shut'; at = t; quarters = 0; cue('shut'); settle(true); }
    if (phase === 'shut') {
      // SD-LOOK: an Hour's veil stands shut its least before it opens (the way home's mend, the forced face read)
      const held = seconds(t) >= (VEIL_HOUR_HOLD_S[hourMode()] ?? 0);
      if (wait > 0) {
        if (!hostCounts) drawnN++;   // a host that says no frames: the veil's own ticks count
        if (drawnN - drawnAt >= wait && held) { wait = 0; open(t, VEIL_FRONT_IN); }
        else if (seconds(t) >= VEIL_HOLD_MAX_S) { wait = 0; open(t, VEIL_FRONT_IN); }
      } else if (seconds(t) >= VEIL_HOLD_MAX_S) open(t, VEIL_FRONT_IN);   // a build that never answered: open on what stands
    }
    if (phase === 'opening' && seconds(t) >= VEIL_OPEN_S) phase = 'idle';
    if (phase === 'idle' || !canvas) { if (canvas) canvas.style.display = 'none'; return; }
    draw(t);
    kick();
  }
  function show(t) { began = t; canvas.style.display = 'block'; }
  /** SD-LOOK: a step's own look - its theme, where the Rift stands on the screen (screen radii, the corners at 1; held
   *  well inside them), and whether the page asks for reduced motion. */
  function takeLook(look, opts) {
    theme = themeOf(look);
    const c = opts?.centre, x = Number.isFinite(c?.[0]) ? c[0] : 0, y = Number.isFinite(c?.[1]) ? c[1] : 0, l = Math.hypot(x, y);
    centre = l > VEIL_CENTRE_MAX ? [(x / l) * VEIL_CENTRE_MAX, (y / l) * VEIL_CENTRE_MAX] : [x, y];
    try { reduce = !!win.matchMedia?.(REDUCE_QUERY)?.matches; } catch { reduce = false; }
    ratchets = 0; quarters = 0; shutFor = 0;
  }
  return {
    get phase() { return phase; },
    get busy() { return phase !== 'idle'; },
    /** Close the fire over the screen: true once it has (at once, if it already stands shut), false where no veil can
     *  be made or it was opened before it shut. AUDIT SD II (L6 F8): `look` the veil's theme ('fire', 'brass'); SD-LOOK:
     *  or an Hour's ('hourIn', 'hourBack'), `opts.centre` where on the screen its blades pivot. */
    cover(look = 'fire', opts = undefined) {
      if (!build()) return Promise.resolve(false);
      const t = now();
      if (phase === 'idle') takeLook(look, opts);
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
    /** The fire at once, then open - a place taken by force. AUDIT SD II (L6 F8): `look` its theme; SD-LOOK: or an
     *  Hour's ('hourHome', 'hourCast'). */
    flash(look = 'fire', opts = undefined) {
      if (!build()) return;
      const t = now();
      takeLook(look, opts);
      if (phase === 'idle') show(t);
      phase = 'shut'; at = t; wait = VEIL_OPEN_WAIT_TICKS; drawnAt = drawnN;
      cue('cast');
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
      try { hourPass?.destroy(); } catch { /* the context went with the page */ }
      hourPass = null;
      loseGlContext(veilGl); unseat?.();   // GL-LEAK: the context let go with its canvas, not at the collector's leisure
      canvas?.remove?.();
      canvas = null; pass = null; veilGl = null; unseat = null;
    },
  };
}
