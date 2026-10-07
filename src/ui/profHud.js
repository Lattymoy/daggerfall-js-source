// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "actual UI integration for life skills") -
// THE PROFESSIONS IN THE WORLD'S FACE (bible/06-Systems/
// Professions-Arc.md 8, 21, 22), each in the Enhanced Plus stone and
// brass (ui/enhancedPlusStyle.js PROF_CSS), scaled by the HUD's scale:
//
//   the PROMPT  - bottom centre above the hotbar: "[E] Pick Red Rose -
//                 Herbalism 34", or what the node needs;
//   the METER   - PROF-RETICLE: the act on the crosshair, no box
//                 (ui/profReticle.js: the rock's points where they stand
//                 on it, the ring round the crosshair, the hold's arc,
//                 the glint about it, the line laid on the body, the
//                 throw, the float and the haul's bar), the count and a
//                 hint that fades under it; still forms under reduced
//                 motion (the system's own - the port has no setting of
//                 its own);
//   the TOASTS  - on the right, four at most, three seconds each:
//                 "+3 Red Roses to your Stores", "+45 Herbalism XP",
//                 "Herbalism 34 -> 35";
//   the CHIP    - under the compass: "Herbalism 34 - 12 today" (the
//                 day's count - CAP-OFF: no "/ 60" after it);
//   the BANNER  - a rank's name at 25, 50, 75 and 100.
//
// The toasts' law is pure (`createToastQueue`); the rest is the DOM the
// host's frame feeds. One owner: the host builds it online and disposes
// it with the page.
// ═══════════════════════════════════════════════════════════════════
import { PROF_CSS } from './enhancedPlusStyle.js';
import { buildActReticle, marksOf, actCues, FOCAL_FALLBACK } from './profReticle.js';   // PROF-RETICLE: the act on the crosshair
import { profCue } from '../systems/profSounds.js';   // PROF-SCENES: every cue a sound too

/** The toasts: four at most, three seconds each (PROF0 8). */
export const PROF_TOASTS_MAX = 4;
export const PROF_TOAST_S = 3;
/** The rank's banner stands this long. */
export const PROF_BANNER_S = 4;

/** THE TOASTS' LAW: `push` a line (the oldest goes past four), `tick` ages them, `lines` what stands. GATHER-SAID: a line
 *  pushed `keep` (a harvest's goods) is passed over while an unkept one is older - an answer's XP, its rank's rise and a
 *  specialisation's hint went past four and took the goods' line with them, so a harvest looked as if it gave nothing. */
export function createToastQueue({ max = PROF_TOASTS_MAX, ttl = PROF_TOAST_S } = {}) {
  let seq = 0;
  /** @type {{ id: number, text: string, left: number, keep: boolean }[]} */
  let rows = [];
  return {
    /** @param {any} text  @param {{ keep?: boolean }|null} [o] */
    push(text, o = null) {
      const t = String(text ?? '').trim();
      if (!t) return;
      rows.push({ id: ++seq, text: t, left: ttl, keep: o?.keep === true });
      while (rows.length > max) {
        const i = rows.findIndex((r) => !r.keep);
        rows.splice(i < 0 ? 0 : i, 1);
      }
    },
    tick(dt) {
      const step = Math.max(0, Number(dt) || 0);
      for (const r of rows) r.left -= step;
      rows = rows.filter((r) => r.left > 0);
    },
    get lines() { return rows.slice(); },
    clear() { rows = []; },
  };
}

const STYLE_ID = 'prof-hud-style';

/**
 * @param {{ doc?: Document, anchor?: (() => ({ x: number, y: number, focal?: number } | null)) | null }} [o]
 */
export function createProfHud({ doc = globalThis.document, anchor = null } = {}) {
  if (!doc?.body) return null;
  if (!doc.getElementById(STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = PROF_CSS;
    (doc.head ?? doc.body).append(st);
  }
  const mk = (cls) => { const n = doc.createElement('div'); n.className = cls; return n; };
  const prompt = mk('prof-prompt');
  const meter = mk('prof-meter');
  meter.hidden = true;
  const toasts = mk('prof-toasts');
  const chip = mk('prof-chip');
  const banner = mk('prof-banner');
  doc.body.append(prompt, meter, toasts, banner);
  const queue = createToastQueue();
  /** PROF-RETICLE: the act's marks built, and the act they were built for */
  let panel = null;
  /** PROF-RETICLE: the crosshair's middle and the lens's focal length (ui/worldPlaque.js reticleAnchor) - the marks
   *  stand round the one and an angle off the look stands `focal * tan(angle)` from it */
  let seatX = null, seatY = null, focal = FOCAL_FALLBACK;
  const seat = () => {
    const a = anchor?.();
    if (!a) return;
    if (Number(a.focal) > 0) focal = a.focal;
    if (a.x === seatX && a.y === seatY) return;
    seatX = a.x; seatY = a.y;
    meter.style.setProperty?.('--rx', `${a.x.toFixed(1)}px`);
    meter.style.setProperty?.('--ry', `${a.y.toFixed(1)}px`);
  };
  let bannerLeft = 0;
  let lastPrompt = null, lastChip = null, drawnToasts = '';
  /** AUDIT 29 C10: the system's reduced motion, asked once a second at most - never twice a frame through an act */
  let _reduced = false, _reducedAt = -Infinity;
  const reduced = () => {
    const t = Date.now();
    if (t - _reducedAt > 1000) { _reducedAt = t; try { _reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { _reduced = false; } }
    return _reduced;
  };

  /** The chip rides the compass's column when the enhanced HUD stands, else stands on its own under the top edge. */
  function seatChip() {
    const top = doc.querySelector?.('.hud .hud-top');
    if (top && chip.parentNode !== top) top.append(chip);
    else if (!top && chip.parentNode !== doc.body) { doc.body.append(chip); chip.style.cssText = 'position:fixed;left:50%;top:52px;transform:translateX(-50%);z-index:12'; }
  }

  return {
    /** The prompt: `{ key, verb, rest }` ("[E]", "Pick Red Rose", "Herbalism 34"), or null to clear it. */
    setPrompt(p) {
      const text = p ? `${p.key ?? ''}|${p.verb ?? ''}|${p.rest ?? ''}|${p.alt ?? ''}` : '';
      if (text === lastPrompt) return;
      lastPrompt = text;
      prompt.replaceChildren();
      if (!p) return;
      const k = doc.createElement('kbd');
      k.textContent = `[${p.key}]`;
      prompt.append(k, doc.createTextNode(` ${p.verb}`));
      if (p.rest) { const d = doc.createElement('span'); d.className = 'dim'; d.textContent = ` - ${p.rest}`; prompt.append(d); }
      if (p.alt) { const d = doc.createElement('span'); d.className = 'dim prof-alt'; d.textContent = `   ${p.alt}`; prompt.append(d); }   // AUDIT 32 P9: its own line on a phone
    },
    /**
     * PROF-RETICLE: THE ACT ON THE CROSSHAIR (ui/profReticle.js) for an act, or null to take it down - built once an
     * act, moved every frame, round the crosshair's middle (`anchor`). `label` the act's words (the key it holds,
     * ACT-CLICK's press); `byUse` - TOUCH-HOLD: a tool's Use (or a press - PROF-MENU) holds the act, no key to name.
     * The node's name is the menu's and the plaque's; the act carries no title (`title` taken and set by). Every cue
     * its sound too.
     */
    setMeter(act, label = '', { byUse = false } = {}) {
      if (!act) { meter.hidden = true; meter.replaceChildren(); panel = null; return; }
      meter.hidden = false;
      seat();
      const st = act.state;
      const which = marksOf(act);
      if (!panel || panel.act !== act || panel.which !== which) { panel = { act, which, ui: buildActReticle(doc, meter, act), prev: {} }; actCues(panel.prev, st); }
      panel.ui.update(act, { label, byUse, reduced: reduced(), focal });
      for (const c of actCues(panel.prev, st)) profCue(c);
      // the act's flashes - a blow on the glint, a Clean Cut, a bruise, the tug - on the reticle itself, whole
      const flags = ['prof-meter', 'prof-reticle', `prof-kind-${which}`];
      if (st.bruised) flags.push('bruised');
      if (st.kind === 'mine' && st.last === 'glint' && act.swing > 0) flags.push('struck-glint');
      if (st.kind === 'chop' && st.last === 'clean' && act.swing > 0) flags.push('clean-cut');
      if (st.kind === 'fish' && st.phase === 'tug') flags.push('fish-tug');
      const c = flags.join(' ');
      if (meter.className !== c) meter.className = c;
    },
    /** PROF-SCENES: a cue said outright - an act's clean finish, which its last frame cannot see. */
    cue(name) { profCue(name); },
    /** A line on the right; `keep` (GATHER-SAID) outlasts the unkept past four. */
    toast(text, o) { queue.push(text, o); },
    /** The rank's banner. */
    banner(text) { banner.textContent = String(text ?? ''); bannerLeft = text ? PROF_BANNER_S : 0; },
    /** The chip under the compass, or null to take it away. */
    setChip(text) {
      const t = text ?? '';
      if (t === lastChip && chip.isConnected) return;   // AUDIT 29 C10: seated when it changes or has fallen out - not a query every frame
      seatChip();
      if (t === lastChip) return;
      lastChip = t;
      chip.textContent = t;
    },
    /** Every frame: the toasts and the banner age. */
    frame(dt) {
      queue.tick(dt);
      const lines = queue.lines;
      const key = lines.map((l) => l.id).join(',');
      if (key !== drawnToasts) {
        drawnToasts = key;
        toasts.replaceChildren(...lines.map((l) => { const n = mk('prof-toast'); n.textContent = l.text; return n; }));
      }
      const nodes = toasts.children;
      for (let i = 0; i < lines.length; i++) nodes[i]?.classList?.toggle('fade', lines[i].left < 0.4);
      if (bannerLeft > 0) { bannerLeft -= Math.max(0, Number(dt) || 0); if (bannerLeft <= 0) banner.textContent = ''; }
    },
    /** The HUD's lines, for the pins. */
    get toastLines() { return queue.lines.map((l) => l.text); },
    dispose() { prompt.remove(); meter.remove(); toasts.remove(); chip.remove(); banner.remove(); queue.clear(); panel = null; },
  };
}
