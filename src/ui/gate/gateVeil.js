// @ts-check
// WB6c (2026-09-25, Mac: "the transition and the arena needs to be an oblivion masterpiece"): THE GATE'S VEIL ON THE
// PAGE - the canvas the step through an Oblivion gate is drawn on (render/gate/gateVeil.js: the law and the fire), its loop,
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
// EG-ZE (2026-10-12, bible/11-Multiplayer/Elite-Gates.md section 7): THE SPIRE'S STAIR - three themes more (`egFall`,
// `egVeil`, `egCut`), drawn by render/eliteGates/egStairPass.js on its own clock (world/eliteGates/egLights.js EG_STAIR_VEIL: the dither
// 0.8 s each way - the fire's law run at that pace), the fall held shut its least, the band's chime as it closes, and
// the hall it steps to held centred over it (a label of its own beside the canvas).
// EG-ZO (2026-10-12, Elite-Gates.md section 7): THE FALL PAST THE SPIRE'S UNDERSIDE - the full fall is a camera falling
// past a modelled underside (world/eliteGates/egUnderside.js), drawn on this canvas in its own pass (render/eliteGates/egStairPass.js): the
// underside and its four pictures made A SLICE A TICK from the fall's first frame (never in the tick the veil shuts in,
// whose end runs the step's own work - THE SWAP), uploaded as one more slice, and every GL allocation of it freed as the
// fall ends - the veil opened, a look that is not this fall taken, the veil destroyed. The canvas has a depth buffer for
// it; the other looks never test against it.
// Not a DFU member. Ledger A (WB).
import { audio as defaultAudio } from '../../systems/audio.js';
import { SOUND } from '../../systems/soundClips.js';
import { GateVeilRenderer, GATE_VEIL_PROGRAMS, veilAt, VEIL_CLOSE_S, VEIL_OPEN_S, VEIL_HOLD_MAX_S, VEIL_FRONT_IN, VEIL_FRONT_OUT } from '../../render/gate/gateVeil.js';
import { FIRE_CAST_ID } from '../../world/gate/gateBoss.js';
import { loseGlContext, onPageGone } from '../../render/glRelease.js';   // GL-LEAK: its context let go with it, and as the page goes
import { startPrograms } from '../../render/glProgram.js';   // SHADER-STALL: the warm starts the veil's program, the step takes it compiled
import { warmPrograms } from '../../render/warmPrograms.js';   // AUDIT SHADER-STALL: and builds it at an idle once it is done
import { SdVeilRenderer, SD_VEIL_MODE, sdVeilQuarters } from '../../render/superDungeon/sdVeil.js';
import { midiNote } from '../../systems/gate/gateScore.js';
import { HOUR_CHIME, HOUR_CHIME_MENDED } from '../../systems/superDungeon/sdScore.js';
import { EgStairRenderer, EG_STAIR_MODE } from '../../render/eliteGates/egStairPass.js';   // EG-ZE: THE SPIRE'S STAIR
import { EG_STAIR_VEIL } from '../../world/eliteGates/egLights.js';
import { egUndersideParts, egFallCamera } from '../../world/eliteGates/egUnderside.js';   // EG-ZO: THE FALL PAST THE SPIRE'S UNDERSIDE

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
 *  (render/gate/gateVeil.js `uTheme`); as it closes, the Orrery's toll (the ship's bell, low) over the Warp's deep wind; as it
 *  opens, a gear's clunk and the Concord's chime (scenes/superDungeon/sdHall.js SD_HALL_SOUNDS). The fire's stays the default. */
export const VEIL_THEMES = Object.freeze({ fire: 0, brass: 1, hourIn: 2, hourBack: 3, hourHome: 4, hourCast: 5, egFall: 6, egVeil: 7, egCut: 8 });
export const VEIL_BRASS_CUES = Object.freeze({
  close: Object.freeze([Object.freeze({ clip: 107, volume: 1.0, pitch: 0.5 }), Object.freeze({ clip: SOUND.AmbientWindMoanDeep, volume: 0.9, pitch: 0.45 })]),
  open: Object.freeze([Object.freeze({ clip: 433, volume: 1.0, pitch: 0.55 }), Object.freeze({ clip: 364, volume: 0.6, pitch: 0.7 })]),
});
const themeOf = (name) => VEIL_THEMES[name] ?? VEIL_THEMES.fire;
/** SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md section 3): THE HOUR'S OWN VEIL - the Hour's four
 *  themes drawn by render/superDungeon/sdVeil.js (twelve brass blades closing on the Rift into a dial; the brass whirl stays for a
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
 *  (systems/superDungeon/sdScore.js HOUR_CHIME, the fourth on its wrong F sharp) going in, the mended (HOUR_CHIME_MENDED) going
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
/** EG-ZE (2026-10-12, Elite-Gates.md section 7): THE SPIRE'S STAIR - its three themes drawn by render/eliteGates/egStairPass.js (the
 *  full fall past the Spire's underside at a band's first hall, the band's veil at every other step, the plain cut under
 *  reduced motion - world/eliteGates/egLook.js egStairOf), each its mode there; its canvas a third of the device's pixels, drawn
 *  pixelated (the Hour's pixel law); the least each stands shut (the fall's, long enough to be seen to fall - the swap's
 *  own work runs inside it); the band's chime as it closes and at a pull's flash (the Concord's chime, the step's own
 *  `chime` pitch - world/eliteGates/egLights.js egStairChime) and the deep wind under the fall; and the hall it steps to, held
 *  centred over it while the upload lands. */
export const VEIL_EG_MODE = Object.freeze({ [VEIL_THEMES.egFall]: EG_STAIR_MODE.fall, [VEIL_THEMES.egVeil]: EG_STAIR_MODE.veil, [VEIL_THEMES.egCut]: EG_STAIR_MODE.cut });
export const VEIL_EG_SCALE = 1 / 3;
export const VEIL_EG_HOLD_S = Object.freeze({ [EG_STAIR_MODE.fall]: EG_STAIR_VEIL.fallHold, [EG_STAIR_MODE.veil]: 0, [EG_STAIR_MODE.cut]: 0 });
export const VEIL_EG_CUES = Object.freeze({ chime: Object.freeze({ clip: 364, volume: 0.75 }), fall: Object.freeze({ clip: SOUND.AmbientWindMoanDeep, volume: 0.8, pitch: 0.42 }) });
export const VEIL_EG_LABEL_CSS = 'position:fixed;left:0;top:50%;width:100%;margin-top:-0.6em;text-align:center;z-index:4;pointer-events:none;'
  + "font:600 30px 'Cormorant', Georgia, serif;letter-spacing:0.14em;color:#e8c473;text-shadow:0 2px 0 rgba(0,0,0,0.85);display:none;";
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
/** Where an Hour's veil may pivot at the most from the screen's centre (screen radii): a Rift at the screen's edge, or
 *  behind the eye, still closes on the screen. */
export const VEIL_CENTRE_MAX = 0.6;
/** How fresh the host's aim must be to close on it (ms): older, the Rift is not on the screen - the screen's middle. */
export const VEIL_AIM_MS = 300;

/**
 * The veil. `doc` the page (a canvas is made in it once), `raf` the frame clock, `now` milliseconds, `engine` the
 * sounds' engine. Answers `{ phase, busy, cover(), reveal(), flash(), destroy() }`.
 */
export function createGateVeil({ doc = globalThis.document, raf = (f) => globalThis.requestAnimationFrame(f), now = () => performance.now(), engine = defaultAudio, win = globalThis } = {}) {
  let canvas = null, pass = null, broken = false;
  let veilGl = null, unseat = null;   // GL-LEAK: the context, and its seat for the page's going
  let veilReady = /** @type {(() => boolean)|null} */ (null);   // AUDIT SHADER-STALL: whether the veil's program is done (startPrograms)
  let phase = 'idle', at = 0, began = 0, from = VEIL_FRONT_IN, wait = 0, ticking = false;
  /** @type {number} */ let theme = VEIL_THEMES.fire;   // AUDIT SD II (L6 F8): the step's own - set as it closes or flashes
  // SD-LOOK: the Hour's veil - its program (built the first time an Hour's theme is drawn), the Rift on the screen, how
  // long it stood shut when it opened (its hand stays where it stopped), the cues struck, reduced motion
  let hourPass = null, hourBroken = false, centre = [0, 0], shutFor = 0, ratchets = 0, quarters = 0, reduce = false;
  let aimX = 0, aimY = 0, aimAt = -Infinity;   // where the host last saw the Rift on the screen, and when
  const hourMode = () => VEIL_HOUR_MODE[theme];
  // EG-ZE: the Spire's stair - its program (built the first time a stair is drawn), the band it falls into, the hall
  // held centred and its node, the band's chime's pitch
  let egPass = null, egBroken = false, egBand = 0, egLabel = '', egChime = 1, labelEl = null;
  const egMode = () => VEIL_EG_MODE[theme];
  /** EG-ZO: THE FALL'S OWN - the band it falls into, its underside's parts being made a slice a tick, the underside on
   *  the GPU once uploaded, and whether its upload failed (the void alone is drawn); the falling camera's arrays. */
  /** @type {null | { band: number, parts: ReturnType<typeof egUndersideParts>, under: any, failed: boolean }} */
  let fall = null;
  const fallCam = { eye: new Float32Array(3), view: new Float32Array(16), proj: new Float32Array(16) };
  /** EG-ZO: the fall's underside freed - the slot emptied before what was in it is told. Every exit comes here. */
  function fallFree() {
    const f = fall;
    fall = null;
    try { f?.under?.destroy(); } catch { /* the context went with the page */ }
  }
  /** EG-ZO: the look just taken: a fall into band `egBand` keeps (or starts) its own underside; any other look frees it. */
  function fallTake() {
    if (egMode() !== EG_STAIR_MODE.fall) { fallFree(); return; }
    if (fall?.band === egBand) return;
    fallFree();
    fall = { band: egBand, parts: egUndersideParts(egBand), under: null, failed: false };
  }
  /** EG-ZO: one slice of the fall's underside - a piece of its model or one of its pictures, or, all made, its upload.
   *  The fall's own pass must stand first (it is built as the stair is first drawn). */
  function fallSlice() {
    if (!fall || fall.under || fall.failed || !egPass) return;
    if (!fall.parts.done) { fall.parts.step(); return; }
    fall.under = egPass.upload(fall.parts);
    if (!fall.under) fall.failed = true;
  }
  /** EG-ZE: the veil's clock against its law's - the stair's 0.8 s each way where the fire takes VEIL_CLOSE_S and
   *  VEIL_OPEN_S (every law below reads the one clock, so the fire's curve is the stair's, faster); shut, the same. */
  const pace = () => (egMode() === undefined ? 1 : phase === 'closing' ? VEIL_CLOSE_S / EG_STAIR_VEIL.close : phase === 'opening' ? VEIL_OPEN_S / EG_STAIR_VEIL.open : 1);
  /** AUDIT WB D5: the frames the host has said it drew, and whether it says them at all; the count at the reveal */
  let drawnN = 0, hostCounts = false, drawnAt = 0;
  let waiters = [];
  const settle = (ok) => { const w = waiters; waiters = []; for (const f of w) f(ok); };
  const play = (clip, volume, pitch) => { try { engine.playOneShot(clip, volume, pitch); } catch { /* a sound is never the step */ } };
  const cue = (name) => {
    if (egMode() !== undefined) { egCue(name); return; }   // EG-ZE: the stair's own
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
  const seconds = (t) => ((t - at) / 1000) * pace();
  /** EG-ZE: the stair's sounds - the band's chime as it closes and at a pull's flash, the deep wind under the fall. */
  function egCue(name) {
    if (name !== 'close' && name !== 'cast') return;
    play(VEIL_EG_CUES.chime.clip, VEIL_EG_CUES.chime.volume, egChime);
    if (egMode() === EG_STAIR_MODE.fall) play(VEIL_EG_CUES.fall.clip, VEIL_EG_CUES.fall.volume, VEIL_EG_CUES.fall.pitch);
  }
  /** EG-ZE: the hall held centred over the stair, at `k` of its light (the veil's cover: it comes and goes with the
   *  dither) - none at nothing. Its node made the first time it is shown. */
  function labelShow(k) {
    if (!(k > 0) || !egLabel) { if (labelEl && labelEl.style.display !== 'none') labelEl.style.display = 'none'; return; }
    if (!labelEl) {
      if (!doc?.createElement || !doc.body) return;
      labelEl = doc.createElement('div');
      labelEl.style.cssText = VEIL_EG_LABEL_CSS;
      labelEl.setAttribute?.('aria-hidden', 'true');
      doc.body.appendChild(labelEl);
    }
    if (labelEl.textContent !== egLabel) labelEl.textContent = egLabel;
    const op = Math.min(1, k).toFixed(2);
    if (labelEl.style.opacity !== op) labelEl.style.opacity = op;
    if (labelEl.style.display !== 'block') labelEl.style.display = 'block';
  }
  /** EG-ZE: the Spire's stair drawn - its own program at a third of the pixels, pixelated, the hall held over it. False
   *  where its program would not build (the fire's draw stands in). */
  function egDraw(t) {
    if (!egPass && !egBroken) {
      try { egPass = new EgStairRenderer(veilGl); } catch (e) { console.warn('[eg] the stair would not build', e?.message ?? e); egBroken = true; }
    }
    if (!egPass) return false;
    const dpr = win.devicePixelRatio || 1;
    const w = Math.max(1, Math.round((win.innerWidth || 1280) * dpr * VEIL_EG_SCALE)), h = Math.max(1, Math.round((win.innerHeight || 720) * dpr * VEIL_EG_SCALE));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    if (canvas.style.imageRendering !== 'pixelated') canvas.style.imageRendering = 'pixelated';
    const v = current(t), s = (t - began) / 1000, m = egMode();
    // EG-ZO: the fall through its own camera, its underside over the void once it stands
    const cam = m === EG_STAIR_MODE.fall ? egFallCamera(s, w / h, fallCam) : null;
    try { egPass.draw(w, h, s, v, { mode: m, band: egBand, cam, under: fall?.under ?? null }); } catch { /* a veil is never the step */ }
    labelShow(v.cover);
    return true;
  }
  const current = (t) => veilAt(phase, seconds(t), from);
  /** The veil failed to build: said once, and no veil from then (the step goes on unveiled). */
  function fail(e) {
    console.warn('[gate] the veil would not build', e?.message ?? e);
    broken = true;
    canvas?.remove?.();
    canvas = null; pass = null;
  }
  /** SHADER-STALL (render/glProgram.js startPrograms): the canvas and its context made, and the veil's program STARTED -
   *  what `warm` does now, so the build at the step takes it compiled. AUDIT WB D5's warm built the pass whole at idle
   *  the first frame a gate stands, and that idle task waited the whole compile. */
  function begin() {
    if (broken || !doc?.createElement || !doc.body) return false;
    if (veilGl) return true;
    try {
      canvas = doc.createElement('canvas');
      canvas.style.cssText = `${VEIL_CSS}display:none;`;
      canvas.setAttribute?.('aria-hidden', 'true');
      doc.body.appendChild(canvas);
      const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: true, stencil: false });   // EG-ZO: the fall's underside is depth-tested
      if (!gl) throw new Error('no WebGL2');
      veilGl = gl;
      unseat = onPageGone(() => loseGlContext(gl));   // GL-LEAK
      veilReady = startPrograms(gl, GATE_VEIL_PROGRAMS);
      return true;
    } catch (e) { fail(e); return false; }
  }
  function build() {
    if (pass) return true;
    if (!begin()) return false;
    try { pass = new GateVeilRenderer(veilGl); return true; } catch (e) { fail(e); return false; }
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
    if (egMode() !== undefined && egDraw(t)) return;   // EG-ZE: the Spire's stair, its own pass
    labelShow(0);
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
    const shuts = phase === 'closing' && seconds(t) >= VEIL_CLOSE_S;
    if (!shuts) fallSlice();   // EG-ZO: a slice of the fall's underside a tick - never in the tick whose end runs the step's own work
    if (phase === 'closing' && seconds(t) >= VEIL_CLOSE_S) { phase = 'shut'; at = t; quarters = 0; cue('shut'); settle(true); }
    if (phase === 'shut') {
      // SD-LOOK: an Hour's veil stands shut its least before it opens (the way home's mend, the forced face read)
      const held = seconds(t) >= (VEIL_HOUR_HOLD_S[hourMode()] ?? VEIL_EG_HOLD_S[egMode()] ?? 0);
      if (wait > 0) {
        if (!hostCounts) drawnN++;   // a host that says no frames: the veil's own ticks count
        if (drawnN - drawnAt >= wait && held) { wait = 0; open(t, VEIL_FRONT_IN); }
        else if (seconds(t) >= VEIL_HOLD_MAX_S) { wait = 0; open(t, VEIL_FRONT_IN); }
      } else if (seconds(t) >= VEIL_HOLD_MAX_S) open(t, VEIL_FRONT_IN);   // a build that never answered: open on what stands
    }
    if (phase === 'opening' && seconds(t) >= VEIL_OPEN_S) phase = 'idle';
    if (phase === 'idle') labelShow(0);   // EG-ZE: the hall's label goes with the veil
    if (phase === 'idle') fallFree();   // EG-ZO: and the fall's underside with it
    if (phase === 'idle' || !canvas) { if (canvas) canvas.style.display = 'none'; return; }
    draw(t);
    kick();
  }
  function show(t) { began = t; canvas.style.display = 'block'; }
  /** SD-LOOK: a step's own look - its theme, where the Rift stands on the screen (screen radii, the corners at 1; held
   *  well inside them: `opts.centre`, else the host's fresh aim, else the middle - and a forced one always the middle),
   *  and whether the page asks for reduced motion. */
  function takeLook(look, opts) {
    theme = themeOf(look);
    egBand = Math.max(0, Math.min(3, (opts?.band ?? 0) | 0)); egLabel = typeof opts?.label === 'string' ? opts.label : ''; egChime = Number(opts?.chime) > 0 ? Number(opts.chime) : 1;   // EG-ZE: the stair's own
    fallTake();   // EG-ZO: a fall keeps or starts its underside; any other look frees it
    const fresh = now() - aimAt < VEIL_AIM_MS && theme !== VEIL_THEMES.hourCast;
    const c = opts?.centre ?? (fresh ? [aimX, aimY] : null), x = Number.isFinite(c?.[0]) ? c[0] : 0, y = Number.isFinite(c?.[1]) ? c[1] : 0, l = Math.hypot(x, y);
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
      if (phase === 'idle' || phase === 'opening') takeLook(look, opts);   // AUDIT EG III (lane4 #13): a cover asked while the last step's veil still opens closes in ITS OWN look - a closing or a shut veil keeps the one it closed with
      if (phase === 'shut') { wait = 0; return Promise.resolve(true); }
      if (phase === 'idle' || phase === 'opening') {
        // from where it stands: the closing's own clock set back to the moment its front was here
        const f = phase === 'opening' ? current(t).front : VEIL_FRONT_OUT;
        const u = Math.max(0, Math.min(1, (VEIL_FRONT_OUT - f) / (VEIL_FRONT_OUT - VEIL_FRONT_IN))) ** (1 / 1.6);
        if (phase === 'idle') show(t);
        phase = 'closing'; at = t - (u * VEIL_CLOSE_S * 1000) / pace();   // EG-ZE: at the stair's pace for a stair
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
    /** SD-LOOK: the host saw the Rift (or the Return) at (x, y) on the screen this frame (screen radii, the corners at
     *  1) - the next Hour's step closes on it while it is fresh. Nothing made. */
    aim(x, y) { if (Number.isFinite(x) && Number.isFinite(y)) { aimX = x; aimY = y; aimAt = now(); } },
    /** AUDIT WB D5: the host drew a frame of its place - the hold counts these, not the veil's own ticks. */
    frameDrawn() { hostCounts = true; drawnN++; },
    /** AUDIT WB D5: the canvas made and its program started now, ahead of the first step (the host's idle time) -
     *  SHADER-STALL: started, never waited on. AUDIT SHADER-STALL: and the pass BUILT at an idle once the driver says its
     *  program is done (render/warmPrograms.js's named step) - its link read, its uniforms found, its buffers made, as
     *  WB D5's warm built it whole, so the step's frame builds nothing; where the driver cannot say, at the next idle, as
     *  WB D5 had it. */
    warm() {
      if (!begin()) return false;
      void warmPrograms([{ start: () => veilReady ?? (() => true), run: () => { build(); }, need: () => !pass && !broken && !!veilGl }], { alive: () => !broken && !!veilGl });   // a veil destroyed meanwhile is never built again
      return true;
    },
    destroy() {
      settle(false);
      phase = 'idle';
      try { pass?.destroy(); } catch { /* the context went with the page */ }
      try { hourPass?.destroy(); } catch { /* the context went with the page */ }
      hourPass = null;
      fallFree();   // EG-ZO: the fall's underside before the pass that drew it
      try { egPass?.destroy(); } catch { /* the context went with the page */ }
      egPass = null; labelEl?.remove?.(); labelEl = null;   // EG-ZE
      loseGlContext(veilGl); unseat?.();   // GL-LEAK: the context let go with its canvas, not at the collector's leisure
      canvas?.remove?.();
      canvas = null; pass = null; veilGl = null; unseat = null; veilReady = null;
    },
  };
}
