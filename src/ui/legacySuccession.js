// @ts-check
// LEGACY3 (2026-10-05, bible/06-Systems/Legacy-Arc.md sections 6 and 11): THE SUCCESSION - who carries the line on.
//
// Project Legacy's death said one of two lines in a message box ("You died. Your descendant will take your place." /
// "You died without a descendant") and chose for the player: a random new child, every time. The port asks: at a
// final death (a Bloodline's, an Enduring elder's last, a passing of the mantle) the window names the fallen and
// offers EVERY living member of the blood - played before or not - and, when the heir answer allows, a newborn heir of
// the fallen. A line with nobody left ends, and the window says so.
//
// The same window answers a DEAD LOAD: a Bloodline member's older save loaded after their death is the past, and the
// window offers the line's living instead. LEGACY-HOME: and it is where the one played MEETS one of the line in the
// world (ui/legacyDoor.js createKinOverlay) - the member's card, their greeting, Play as, Talk, Goodbye.
//
// THE HOUSE'S SHAPE (the Bounty board's, ui/bountyWindow.js): a lazy chunk the door (ui/legacyDoor.js) mounts in its
// own host - `mountSuccession(host, deps)` answers `{ repaint, unmount }`. It wears the Enhanced Plus stone and brass on
// either skin (its own sheet, the kit's rules cut to its selectors, when the skin is classic). There is no back key:
// a death has to be answered.
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { frameCss } from './enhancedFrame.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { scopeRules } from './brokerWindow.js';

export const SUCCESSION_STYLE_ID = 'legacy-succession-css';
export const SUCCESSION_CSS = `
.lgs-shell { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(4,4,6,0.72); z-index: 14; }
.lgs-win { width: min(720px, 94vw); max-height: 90vh; overflow-y: auto; box-sizing: border-box; padding: 18px 22px 20px; display: flex; flex-direction: column; gap: 10px; text-align: left; }
.lgs-win h2 { margin: 0; font-size: 22px; color: #f3cf86; overflow-wrap: anywhere; }
.lgs-line { margin: 0; font-size: 14px; color: #e2d9c4; line-height: 1.45; }
.lgs-line.dim { color: #b8b0a0; font-size: 13px; }
.lgs-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.lgs-card { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 7px 10px; box-sizing: border-box; border-width: 2px; border-style: solid; }
.lgs-face { width: 52px; height: 56px; display: flex; align-items: center; justify-content: center; overflow: hidden; border-width: 2px; border-style: solid; box-sizing: border-box; }
.lgs-face canvas { image-rendering: pixelated; max-width: 100%; max-height: 100%; }
.lgs-face span { font-size: 22px; color: #8b8578; }
.lgs-name { font-size: 15px; color: #f3cf86; overflow-wrap: anywhere; }
.lgs-sub { font-size: 12px; color: #b8b0a0; }
.lgs-acts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 6px; }
.lgs-why { color: #e08a7a; font-size: 13px; margin: 0; }
.lgs-sub.lgs-shut { color: #e08a7a; }
.lgs-go[aria-disabled="true"] { opacity: 0.55; cursor: default; }
@media (max-width: 520px) { .lgs-card { grid-template-columns: 52px minmax(0, 1fr); } .lgs-card .lgs-go { grid-column: 1 / -1; } }
`;
const kitCss = () => [SUCCESSION_CSS, scopeRules(frameCss(), (sel) => sel.includes('lgs-'))].join('\n');
function injectSkin(doc = document) {
  if (doc.getElementById?.(SUCCESSION_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = SUCCESSION_STYLE_ID;
  // Enhanced Plus wears the kit's rules already (FRAME_ROLES names .lgs-*); the classic skins take them cut to ours
  st.textContent = isEnhancedPlus() ? SUCCESSION_CSS : kitCss();
  (doc.head ?? doc.body).append(st);
}

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const button = (cls, text, onPress) => {
  const b = el('button', `act ${cls}`, text);
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e.stopPropagation(); onPress(); };
  return b;
};

function face(faces, who) {
  const box = el('div', 'lgs-face');
  const glyph = el('span', null, who?.gender === 'female' ? '♀' : '♂');
  box.append(glyph);
  if (faces && who) {
    faces({ race: who.race, gender: who.gender, face: who.face }).then((img) => {
      if (!img?.width || img.colors?.byteLength !== img.width * img.height * 4) return;
      const cv = /** @type {HTMLCanvasElement} */ (el('canvas'));
      const ctx = cv.getContext?.('2d');
      if (!ctx?.createImageData) return;
      cv.width = img.width; cv.height = img.height;
      const d = ctx.createImageData(img.width, img.height);
      d.data.set(new Uint8ClampedArray(img.colors.buffer, img.colors.byteOffset, img.colors.byteLength));
      ctx.putImageData(d, 0, 0);
      glyph.remove();
      box.append(cv);
    }).catch(() => {});
  }
  return box;
}

/**
 * @param {HTMLElement} host
 * @param {{ title:string, lines:string[], choices:Array<{ key:string, name:string, sub:string, who:any, act:string, why?:string|null, confirm?:string }>,
 *   faces?:any, choose:(key:string) => {ok:boolean, why?:string}, end?:{ label:string, ask:string, act:() => void }|null,
 *   acts?:Array<{ key:string, label:string, act:() => void }>, lit?:string }} deps - LEGACY-HOME: `acts` the window's other
 *   buttons (the kin met in the world: Talk, Goodbye), each closing it; a choice's `why` says beforehand why it is refused
 *   (the reason under the card - AUDIT LEGACY II U14: its button stays in the walk, `aria-disabled` and described by it,
 *   so a keyboard hears why); `confirm` - AUDIT LEGACY II U2: the choice is asked twice, the second press saying this;
 *   `lit` the button lit first (a class: `lgs-act-talk`), else the first open choice
 */
export function mountSuccession(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectSkin();
  const shell = el('div', 'lgs-shell');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-modal', 'true');   // AUDIT LEGACY U10
  shell.setAttribute('aria-label', deps.title);
  const win = el('div', 'lgs-win');
  shell.append(win);
  host.append(shell);
  let busy = false;
  let why = null;
  let endArmed = false;
  let armed = null;   // the choice asked once (AUDIT LEGACY II U2)
  // AUDIT LEGACY II U1: a HELD key presses nothing - the browser clicks a focused button at every repeat of Enter or
  // Space, and an arm-then-confirm act (the line's end) armed and confirmed on one held press
  win.addEventListener?.('keydown', (e) => {
    if (e.repeat && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  const draw = () => {
    for (const c of [...win.children]) c.remove();
    win.append(el('h2', null, deps.title));
    deps.lines.forEach((l, i) => win.append(el('p', `lgs-line${i ? ' dim' : ''}`, l)));
    if (deps.choices.length) {
      const list = el('div', 'lgs-list');
      for (const c of deps.choices) {
        const card = el('div', 'lgs-card');
        const words = el('div');
        words.append(el('div', 'lgs-name', c.name), el('div', 'lgs-sub', c.sub));
        const asked = armed === c.key && c.confirm;
        const go = button(`primary lgs-go lgs-go-${c.key}`, asked ? c.confirm : c.act, () => {
          if (busy || c.why) return;
          if (c.confirm && armed !== c.key) { armed = c.key; draw(); return; }
          armed = null;
          const r = deps.choose(c.key);
          if (r?.ok) { busy = true; why = null; } else why = r?.why ?? 'Not now.';
          draw();
        });
        if (busy) /** @type {HTMLButtonElement} */ (go).disabled = true;
        if (c.why) {
          const shut = el('div', 'lgs-sub lgs-shut', c.why);
          shut.id = `lgs-why-${c.key}`;
          words.append(shut);
          go.setAttribute('aria-disabled', 'true');
          go.setAttribute('aria-describedby', shut.id);
        }
        card.append(face(deps.faces, c.who), words, go);
        list.append(card);
      }
      win.append(list);
    }
    if (why) { const w = el('p', 'lgs-why', why); w.setAttribute('role', 'status'); w.setAttribute('aria-live', 'polite'); win.append(w); }
    if (deps.acts?.length) {
      const acts = el('div', 'lgs-acts');
      for (const a of deps.acts) acts.append(button(`lgs-act lgs-act-${a.key}`, a.label, () => { if (!busy) { busy = true; armed = null; a.act(); } }));
      win.append(acts);
    }
    if (deps.end) {
      const acts = el('div', 'lgs-acts');
      const b = button(`lgs-end${endArmed ? ' primary' : ''}`, endArmed ? deps.end.ask : deps.end.label, () => {
        if (busy) return;
        if (deps.choices.length && !endArmed) { endArmed = true; draw(); return; }
        busy = true;
        deps.end.act();
      });
      acts.append(b);
      win.append(acts);
    }
    // AUDIT LEGACY U3: the lit button kept across a redraw (the same act's button again), else the first heir - or, with
    // no one to choose, the line's end: a window with nothing lit left a keyboard player no press at all
    const lit = focusKey ?? deps.lit ?? null;
    setTimeout(() => /** @type {HTMLElement|null} */ ((lit && win.querySelector?.(`.${lit}`)) || win.querySelector?.('.lgs-go:not([disabled]):not([aria-disabled="true"])') || win.querySelector?.('.lgs-act') || win.querySelector?.('.lgs-end'))?.focus?.(), 0);
  };
  let focusKey = null;
  win.addEventListener?.('focusin', (e) => { const t = /** @type {any} */ (e.target); focusKey = [...(t?.classList ?? [])].find((c) => c.startsWith('lgs-go-') || c.startsWith('lgs-act-') || c === 'lgs-end') ?? null; });
  draw();
  return { repaint: draw, unmount: () => shell.remove() };
}
