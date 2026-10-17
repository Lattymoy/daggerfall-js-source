// @ts-check
// EG-F (2026-10-12, the Elite Gates arc, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section
// 6.4): THE CALL - how a company scattered across the Bay comes to one breach. EG-PLAY said the call in chat and on the
// tracker, and `/breach` was the door (its departure 1). Now, on each member's screen:
//
//   THE HORN - one call of a war horn when the call first comes (`buildEgHorn`: made here, in code, a brass voice of the
//     port's own - nothing of ARENA2's), and the one chat line, "<opener> opens an Elite Breach."
//   THE PROMPT - "Answer the call - 4:12" (`egCallPromptModel`): it stands from the call until the member answers or the
//     window ends, says when the arch opens while it is sealed, reads "Answer from open ground." indoors, and goes under
//     any window that comes over it and comes back when that window closes. Enter, the pad's A or a tap answers it
//     (`createEgCallPrompt` - a strip at the top of the screen, the duel's challenge's own shape, ui/duelPrompt.js).
//   THE PORTAL - answering asks `/v1/eg/admit`; the order in hand, the Portal Stone's own portal tears open at the member's
//     feet for PORTAL_OPEN_MS (scenes/portalGates.js, drawn with scenes/portalFx.js's vortex - `createEgCallPortal`), and
//     STEPPING INTO IT is the admission: the member steps under the veil into the breach. Where they answered is their
//     LANDING. A portal that closes unused leaves the prompt to stand again while the window lasts.
//
// The prompt's model, the horn and the portal's law are pure or headless: the tests drive them without a host. Not a DFU
// member. Ledger A (ELITE-GATES).
import { egTimes, egPhase, egCountText, EG_TEXT } from '../../net/eliteGates/egLaw.js';
import { createPortalGates } from '../portalGates.js';
import { portalPlace, PORTAL_OPEN_MS } from '../../systems/portalStone.js';
import { level } from '../../systems/arena/arenaSound.js';

// ── the horn ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** The made sound's key on the engine (systems/audio.js registerSamples), its rate, its length and its level (RMS). */
export const EG_HORN_KEY = 'eg:horn';
export const EG_HORN_RATE = 22050;
export const EG_HORN_SECONDS = 2.4;
export const EG_HORN_RMS = 0.09;
/** The call: two notes a fourth apart (Hz), the second held - a war horn's rising call - and where the second begins (s). */
export const EG_HORN_NOTES = Object.freeze([196, 261.63]);
export const EG_HORN_STEP_S = 0.7;
/** A horn's voice: its partials' strengths (a brass bell's, the odd ones strong), its vibrato (Hz, depth as a ratio). */
const HORN_PARTIALS = Object.freeze([1, 0.62, 0.48, 0.3, 0.22, 0.14, 0.09]);
const HORN_VIBRATO = Object.freeze({ hz: 5.2, depth: 0.006 });

/**
 * THE HORN'S CALL, synthesised: `seconds` at `rate` - the first note swelling in, the second rising out of it and held,
 * fading at the last; a slow vibrato on both. Deterministic and pure (no noise), so every screen sounds the same call.
 */
export function buildEgHorn({ rate = EG_HORN_RATE, seconds = EG_HORN_SECONDS } = {}) {
  const n = Math.round(rate * seconds), out = new Float32Array(n);
  let cycles = 0;   // the horn's phase, in turns (ONCRASH1 C2: no angle here is stepped by a whole turn)
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const glide = Math.min(1, Math.max(0, (t - EG_HORN_STEP_S) / 0.06));   // the step up, a lip's slur rather than a cut
    const f = (EG_HORN_NOTES[0] + (EG_HORN_NOTES[1] - EG_HORN_NOTES[0]) * glide) * (1 + HORN_VIBRATO.depth * Math.sin(2 * Math.PI * HORN_VIBRATO.hz * t));
    cycles += f / rate;
    let v = 0;
    const angle = cycles * 2 * Math.PI;
    for (let k = 0; k < HORN_PARTIALS.length; k++) v += HORN_PARTIALS[k] * Math.sin((k + 1) * angle);
    const attack = Math.min(1, t / 0.12), release = Math.min(1, (seconds - t) / 0.5);
    const breath = t < EG_HORN_STEP_S ? 0.8 : 1;
    out[i] = v * attack * release * breath;
  }
  return level(out, EG_HORN_RMS);
}
const _hornMade = new WeakSet();
/** The horn, sounded once (registered on the engine the first time). Answers whether it sounded. Never throws. */
export function soundEgHorn(audio) {
  try {
    if (!audio?.registerSamples || !audio?.playOneShot) return false;
    if (!_hornMade.has(audio)) { if (!audio.registerSamples(EG_HORN_KEY, buildEgHorn(), EG_HORN_RATE)) return false; _hornMade.add(audio); }
    audio.playOneShot(EG_HORN_KEY, 1);
    return true;
  } catch { return false; }   // a horn that cannot sound never costs the call
}

// ── the prompt ───────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE PROMPT'S MODEL - what the strip says, and whether a press answers - or null when it stands for nothing: no call
 * naming me, already in the Spire, my answer in hand (`answered` - the portal open, or the step under way), the window
 * over, or a window over the screen (`windowUp`: it goes under it and comes back when it closes). Pure.
 * @param {{ call: any, me: string|null, now: number, inSpire?: boolean, answered?: boolean, exterior?: boolean, windowUp?: boolean, wk?: number }} o
 * @returns {{ text: string, answerable: boolean, left: number } | null}
 */
export function egCallPromptModel({ call, me, now, inSpire = false, answered = false, exterior = true, windowUp = false, wk = 0 }) {
  if (!call || !me || !call.co?.some?.((r) => r[0] === me) || inSpire || answered || windowUp) return null;
  const T = egTimes({ openedAt: call.op }), phase = egPhase({ openedAt: call.op, wokeAt: wk }, now);
  if (phase === 'rising' || phase === 'sealed') return { text: EG_TEXT.sealed(egCountText(T.openAt - now)), answerable: false, left: T.openAt - now };
  if (phase !== 'open') return null;
  const left = T.admitUntil - now;
  return exterior ? { text: EG_TEXT.answer(egCountText(left)), answerable: true, left } : { text: EG_TEXT.indoors, answerable: false, left };
}
/** The keys that answer it: Enter, and the pad's A (ui/gamepadInput.js: a button is the Unity name's key). */
export const EG_CALL_KEYS = Object.freeze(['Enter', 'NumpadEnter', 'JoystickButton0']);

export const EG_CALL_PROMPT_STYLE_ID = 'dagger-eg-call-style';
export const EG_CALL_PROMPT_CSS = `
.dfegcall { position: fixed; left: 50%; transform: translateX(-50%); top: calc(8px + env(safe-area-inset-top, 0px));
  z-index: 8; display: none; align-items: center; gap: 10px; padding: 8px 12px; pointer-events: none;
  background: rgba(20, 18, 12, .94); border: 1px solid #b8913a; border-radius: 6px; color: #f1e7cf;
  font-family: inherit; max-width: calc(100vw - 24px); box-sizing: border-box; }
.dfegcall[data-up="1"] { display: flex; }
.dfegcall-line { font-size: 14px; line-height: 1.3; overflow-wrap: anywhere; }
.dfegcall-btn { pointer-events: auto; min-height: 32px; padding: 4px 12px; border-radius: 3px; border: 1px solid #b8913a;
  background: #3a3020; color: #f1e7cf; font: inherit; font-size: 13px; cursor: pointer; }
.dfegcall-btn[hidden] { display: none; }
.dfegcall-btn:hover { background: #d8b04a; color: #0e1013; }
.dfegcall.touch .dfegcall-btn { min-height: 44px; padding: 8px 12px; }
`;
/**
 * THE STRIP: the prompt's line and its Answer button (a tap) at the top of the screen, gold-edged - the duel's challenge's
 * own shape (ui/duelPrompt.js). It takes no pointer but its button, so it never stands between the player and the world.
 * `draw(model)` each frame (null hides it). Handed the document so the pins drive it headless.
 * @param {{ onAnswer: () => void, doc?: Document, touch?: boolean }} o
 */
export function createEgCallPrompt({ onAnswer, doc = globalThis.document, touch = false }) {
  if (!doc?.createElement) return { draw() {}, destroy() {}, root: null };
  if (doc.getElementById && !doc.getElementById(EG_CALL_PROMPT_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = EG_CALL_PROMPT_STYLE_ID;
    st.textContent = EG_CALL_PROMPT_CSS;
    (doc.head ?? doc.body)?.append(st);
  }
  const el = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const root = el('div', `dfegcall${touch ? ' touch' : ''}`);
  root.dataset.up = '0';
  const line = el('div', 'dfegcall-line');
  const btn = el('button', 'dfegcall-btn', 'Answer'); /** @type {any} */ (btn).type = 'button';
  root.append(line, btn);
  doc.body?.append(root);
  const swallow = (e) => e.stopPropagation();   // a press on the strip is the strip's - never a swing
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) root.addEventListener(t, swallow);
  btn.addEventListener('click', () => { try { onAnswer(); } catch { /* the answer's own refusals are said */ } });
  let alive = true;
  return {
    root,
    /** @param {{ text: string, answerable: boolean, button?: string } | null} m - EG-ZD: `button` the button's own word (the way
     *  back's *Return* - scenes/eliteGates/egClient.js EG_BACK_TEXT), *Answer* when it says none */
    draw(m) {
      if (!alive) return;
      const up = !!m;
      if (root.dataset.up !== (up ? '1' : '0')) root.dataset.up = up ? '1' : '0';
      if (!up) return;
      if (line.textContent !== m.text) line.textContent = m.text;
      if (btn.hidden !== !m.answerable) btn.hidden = !m.answerable;
      const word = m.button ?? 'Answer';
      if (btn.textContent !== word) btn.textContent = word;
    },
    destroy() { if (!alive) return; alive = false; root.remove?.(); },
  };
}

// ── the portal ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The portal's destination as the Portal Stone's pool keeps one (never said on the wire - this portal is never told). */
export const EG_CALL_DEST = Object.freeze({ pixel: Object.freeze({ x: 0, y: 0 }), name: 'the Spire' });
/**
 * THE CALL'S PORTAL: the Portal Stone's own pool (scenes/portalGates.js) holding one portal at a time, opened ahead of the
 * member's feet (portalPlace - short of a wall, on the ground) for PORTAL_OPEN_MS; the first step into it is `onEnter`,
 * unless the host's `hold()` keeps it shut (the Portal Stone's holds). Its batches are drawn with the street's flats.
 * @param {{ renderer?: any, audio?: any, now?: () => number, toScene?: (p: number[]) => number[], toWire?: (p: number[]) => number[],
 *   groundAt?: ((p: number[]) => number|null)|null, onEnter?: () => void, onRefused?: (hold: string) => void, hold?: () => (string|null) }} deps
 *   `hold` the host's portalHold word on a step (the Portal Stone's holds keep this portal shut too).
 */
export function createEgCallPortal({ renderer = null, audio = null, now = () => performance.now(), toScene = (p) => p, toWire = (p) => p, groundAt = null, onEnter = () => {}, onRefused = () => {}, hold = () => null } = {}) {
  const pool = createPortalGates({ renderer, audio, now, toScene, toWire, groundAt, onEnter: () => onEnter(), onRefused: (hold) => onRefused(hold) });
  return {
    /** A portal torn open ahead of `feet` facing `yaw` (the host's two probes - portalPlace's); answers its place, or
     *  `{ refused }` ('room' | 'ground'). */
    open(feet, yaw, probes = {}) {
      const p = portalPlace(feet, yaw, probes);
      if (!p.at) return { refused: p.refused };
      pool.open(p.at, EG_CALL_DEST);
      return { at: p.at };
    },
    /** Whether my portal still stands. */
    standing: () => !!pool.mine(),
    /** One frame: the feet (the scene's, or null - not walking the open world) step in, or not. */
    tick: (feet) => pool.tick(feet, { hold }),
    batches: () => pool.batches(),
    /** The portal closed (the step taken, a window ended, the host away). */
    clear: () => pool.clear(),
    /** For the tests. */
    get gates() { return pool.gates; },
    /** How long a call's portal stands (the Portal Stone's PORTAL_OPEN_MS). */
    life: PORTAL_OPEN_MS,
  };
}
