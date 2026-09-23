// DEATH2 - THE ENHANCED DEATH SCREEN.
//
// Discord, 2026-09-23: "the death screen where you can press F11 and
// Enter needs touch up - make it enhanced style with You died and make
// it look deathly. Enhanced mode / online mode only."
//
// IT IS PAINT, NOT A SECOND DEATH. ui/deathScreen.js still owns the
// whole of PlayerDeath's sequence - the camera sink, the fade, the
// death clip, the three-second reset into the video (offline) or the
// respawn (online) - and every key still goes through the host's own
// ladder. This file draws what the classic canvas text drew, in the
// enhanced language, and nothing else. The classic skin never mounts it.
//
// THE LOOK. The world is already going black under the canvas fade; over
// it the edges close in first (a blood-dark vignette that tightens as
// the fade runs), then a black band opens across the middle and the
// words rise in it: YOU DIED, in the display serif, a dried-blood red,
// spaced wide and settling tighter as they come in. One line beneath,
// and the keys, last. One slow moment, nothing that loops. The world
// behind ends in solid black (DEATH4), and the screen does not end
// itself offline - it waits for Enter or F11; online it counts ten
// seconds to the respawn.
//
// IT HAS NO CLOSE OF ITS OWN, because the DeathScreen has none - hosts
// simply stop drawing it (the video takes the screen, the title menu
// mounts, the respawn clears the overlay). So a draw STAMPS, and a
// watchdog takes the layer down the first frame nobody stamped.
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { PIXEL_STACK } from './pixelifyFive.js';
import { isOnlinePage } from '../systems/onlineLane.js';

export const ENHANCED_DEATH_ID = 'enhanced-death';
const STALE_MS = 350;

let node = null;
let owner = null;
let stamp = 0;
let watch = 0;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** What the keys do, from the screen's own hint - a host with no
 *  quickload passes 'ENTER end' and gets no F11 plate (FIX-E's law: a
 *  hint that is a lie is worse than none). Online, Enter and F11 both
 *  RESPAWN (world.js D-ONLINE1), so one plate says so. */
export function deathKeys(hint, online) {
  if (online) return [{ key: 'Enter', word: 'Rise now', confirm: true }];
  const keys = [{ key: 'Enter', word: 'End the journey', confirm: true }];
  if (/F11/i.test(String(hint ?? ''))) keys.push({ key: 'F11', word: 'Load last save' });
  return keys;
}

function build(screen) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectDeathStyle();
  const online = isOnlinePage();
  const root = el('div', 'dth');
  root.id = ENHANCED_DEATH_ID;
  root.setAttribute('role', 'alert');
  root.append(el('i', 'dth-veil'), el('i', 'dth-edge'));
  const band = el('div', 'dth-band');
  const title = el('h1', 'dth-title', 'You Died');
  const rule = el('div', 'dth-rule');
  rule.append(el('i'), el('span', 'dth-gem'), el('i'));
  const line = el('p', 'dth-line', online
    ? 'Your body falls. The Bay is not done with you yet.'
    : 'Your tale in the Iliac Bay ends here.');
  const keys = el('div', 'dth-keys');
  for (const k of deathKeys(screen.hint, online)) {
    const b = el(k.confirm ? 'button' : 'span', 'dth-key');
    b.append(el('span', 'dth-cap', k.key), el('span', 'dth-word', k.word));
    // A phone has no Enter: the plate is the key, through the screen's
    // own input - the same door the keyboard's confirm takes.
    if (k.confirm) { b.type = 'button'; b.onclick = () => owner?.input?.('confirm'); }
    keys.append(b);
  }
  // DEATH4: online, the count to the respawn - offline there is none,
  // the screen waits for the player.
  const count = el('p', 'dth-count');
  count.style.display = online ? '' : 'none';
  band.append(title, rule, line, count, keys);
  root.append(band);
  document.body.append(root);
  return root;
}

/** One frame of the enhanced death screen - called from DeathScreen.draw
 *  in place of the canvas text. `fade` is the sequence's own 0..1. */
export function drawEnhancedDeath(screen, fade = 0) {
  if (typeof document === 'undefined') return;
  if (owner !== screen) { removeEnhancedDeath(); owner = screen; }
  if (!node) node = build(screen);
  node.style.setProperty('--dth-fade', String(Math.max(0, Math.min(1, fade)).toFixed(3)));
  const left = screen.respawnIn;
  if (left != null) {
    const c = node.querySelector('.dth-count');
    const text = `Rising in ${left}`;
    if (c && c.textContent !== text) c.textContent = text;
  }
  stamp = now();
  if (!watch) watch = setInterval(() => { if (now() - stamp > STALE_MS) removeEnhancedDeath(); }, 120);
}

export function removeEnhancedDeath() {
  clearInterval(watch); watch = 0;
  node?.remove(); node = null; owner = null;
}

const DEATH_STYLE_ID = 'enhanced-death-style';
function injectDeathStyle(doc = document) {
  if (doc.getElementById(DEATH_STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = DEATH_STYLE_ID;
  s.textContent = DEATH_CSS;
  doc.head.append(s);
}

export const DEATH_CSS = `
.dth { --dth-fade: 0; position: fixed; inset: 0; z-index: 18; pointer-events: none; overflow: hidden;
  display: grid; place-items: center; }
/* The world drains: a cold desaturating veil, and the edges closing in,
   both riding the sequence's own fade. */
/* DEATH4 ("the whole screen black in the background"): the veil goes to
   SOLID black as the sequence's fade runs out - the fall is seen through
   its first second, and then there is only the dark and the words. */
/* DEATH5 (Discord: "everything needs to fade black very fast"): the
   veil no longer rides the sequence's two-second fade - it goes to SOLID
   black on its own clock in under half a second, so nothing half-dark
   (the world, the canvas's own fade quad) is ever left showing. */
.dth-veil { position: absolute; inset: 0; background: #000; opacity: 1;
  animation: dth-black 450ms cubic-bezier(.4,0,.6,1) both; }
@keyframes dth-black { from { opacity: 0; } to { opacity: 1; } }
.dth-edge { position: absolute; inset: -10%;
  background: radial-gradient(ellipse at center, transparent calc(62% - var(--dth-fade) * 24%),
    rgba(40,4,4,0.72) calc(80% - var(--dth-fade) * 18%), #070202 100%);
  animation: dth-breathe 5.5s ease-in-out infinite alternate; }
@keyframes dth-breathe { from { transform: scale(1); } to { transform: scale(1.03); } }

/* The band: black across the middle, opening from a line. */
.dth-band { position: relative; width: 100%; padding: clamp(22px, 5vh, 46px) 16px;
  display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center;
  background: linear-gradient(90deg, transparent, rgba(0,0,0,0.82) 18%, rgba(0,0,0,0.88) 50%, rgba(0,0,0,0.82) 82%, transparent);
  animation: dth-band 900ms cubic-bezier(.2,.7,.2,1) both; }
.dth-band::before, .dth-band::after { content: ''; position: absolute; left: 12%; right: 12%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(138,26,20,0.7), transparent); }
.dth-band::before { top: 0; } .dth-band::after { bottom: 0; }
@keyframes dth-band { from { clip-path: inset(50% 0 50% 0); } to { clip-path: inset(0 0 0 0); } }

.dth-title { margin: 0; font-family: var(--display, 'Cormorant', Georgia, serif); font-weight: 500;
  font-size: clamp(44px, 9vw, 104px); line-height: 1; text-transform: uppercase;
  letter-spacing: 0.34em; text-indent: 0.34em; color: #8e1b14;
  text-shadow: 0 0 18px rgba(142,27,20,0.55), 0 0 60px rgba(90,8,4,0.6), 0 3px 0 #1a0302;
  animation: dth-rise 2200ms cubic-bezier(.16,.84,.3,1) 250ms both; }
@keyframes dth-rise {
  from { opacity: 0; letter-spacing: 0.62em; text-indent: 0.62em; filter: blur(6px); transform: scale(1.06); }
  to   { opacity: 1; letter-spacing: 0.34em; text-indent: 0.34em; filter: blur(0); transform: scale(1); } }

.dth-rule { display: flex; align-items: center; gap: 10px; width: min(420px, 70vw);
  animation: dth-in 900ms ease-out 1100ms both; }
.dth-rule i { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(192,138,62,0.45)); }
.dth-rule i:last-child { background: linear-gradient(90deg, rgba(192,138,62,0.45), transparent); }
.dth-gem { width: 7px; height: 7px; transform: rotate(45deg); background: #6b1510; box-shadow: 0 0 6px rgba(142,27,20,0.8); }

.dth-line { margin: 0; font-family: var(--display, 'Cormorant', Georgia, serif); font-style: italic;
  font-size: clamp(16px, 2.2vw, 21px); color: #b3a893; letter-spacing: 0.04em;
  animation: dth-in 900ms ease-out 1300ms both; }

.dth-count { margin: 2px 0 0; font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; font-size: 13px;
  letter-spacing: 0.18em; text-transform: uppercase; color: #7d6f5e; text-shadow: 2px 2px 0 #000;
  font-variant-numeric: tabular-nums; animation: dth-in 700ms ease-out 1500ms both; }
.dth-keys { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 26px; margin-top: 10px;
  animation: dth-in 700ms ease-out 1700ms both; }
.dth-key { display: inline-flex; align-items: center; gap: 9px; font-family: ${PIXEL_STACK};
  -webkit-font-smoothing: none; color: #9c917b; text-shadow: 2px 2px 0 #000; font-size: 13px;
  letter-spacing: 0.08em; background: none; border: 0; padding: 4px 2px; }
button.dth-key { pointer-events: auto; cursor: pointer; }
button.dth-key:hover .dth-word, button.dth-key:focus-visible .dth-word { color: #e0b7ac; }
button.dth-key:focus-visible { outline: 1px solid rgba(142,27,20,0.8); outline-offset: 3px; }
.dth-cap { padding: 2px 8px; border: 2px solid rgba(142,27,20,0.75); color: #d8cfae; background: rgba(20,4,3,0.8);
  font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; }
@keyframes dth-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .dth-veil, .dth-band, .dth-title, .dth-rule, .dth-line, .dth-count, .dth-keys, .dth-edge { animation: none; }
}
`;
