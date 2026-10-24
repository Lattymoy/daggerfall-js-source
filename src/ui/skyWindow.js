// @ts-check
// RVN-STARS (2026-10-17; bible/06-Systems/Revenants.md section 44) - A SKY OF STARS, DRAWN: the one window every sky the
// port grows past the Firmament is drawn in - CAPTAIN-TREE's captain's stars (ui/captainTreeWindow.js, bible/03-World/
// Naval-Refit.md) and RVN-STARS' sworn revenant's (ui/revenantStarsWindow.js). Taken out of the captain's window whole when
// the second sky came (one home, never two copies that drift): the Firmament's own sky (ui/firmamentWindow.js - its sheet,
// its two palettes, its stars' sizes) over the whole screen.
//
// WHAT A PLAYER DOES HERE - the Firmament's ways, kept:
//   - HOVERS a star to read it, and sees the shortest way to it from what is held, lit;
//   - PRESSES it to set that whole way, while the sky's points pay for it;
//   - RIGHT-PRESSES (or long-presses) a star held to take it back, with every star joined to the start only through it;
//   - ACCEPTS: a change is pending until then, free to try; accepted, the sky's keeper has it (`sky.commit` - which may
//     refuse, and says why).
//   Drag pans, the wheel (or a pinch) zooms, H finds the start.
//
// Nothing here decides what may be set - the law is each sky's (`sky.held`, `sky.wayTo`, `sky.takesBack`), and its keeper
// asks it again. A sky is a descriptor (below): its stars and lines, its law, its purse, its words, its tones, its start's
// picture.

import { PLUS_SKY, GRIM_SKY, NODE_R, FIRM_CSS, FIRM_STYLE_ID } from './firmamentWindow.js';
import { GRIM_TONES, GRIMOIRE_STACK } from './grimoireDress.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhanced/enhancedStyle.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

const G = GRIM_TONES;
/** A star's colours in a dress: its line dim and lit, its way's fill, its rim dim and lit, its fill lit, its glow.
 *  @typedef {{ edge: string, edgeLit: string, path: string, rim: string, lit: string, litRim: string, glow: string }} SkyTone */
/** The Firmament's two tones in a palette: `main` its battle ring's brass, `life` its life ring's verdigris. */
const baseTones = (P) => ({
  main: { edge: P.edge, edgeLit: P.edgeLit, path: P.edgePath, rim: P.rim, lit: P.lit, litRim: P.litRim, glow: P.glow },
  life: { edge: P.edgeLife, edgeLit: P.edgeLifeLit, path: P.edgeLifeLit, rim: P.rimLife, lit: P.litLife, litRim: P.litRimLife, glow: P.glowLife },
});

/**
 * A SKY, as the window draws it:
 * @typedef {Object} SkyDesc
 * @property {string} label   the window's name (its heading and its dialog's)
 * @property {ReadonlyArray<{ id: string, sec: string, kind: string, stats: any, pos: ReadonlyArray<number> }>} stars
 * @property {ReadonlyArray<ReadonlyArray<string>>} edges   every line, `[a, b]` once each
 * @property {number} edge   the sky's reach from its middle (its outer keystones and its figures)
 * @property {number} seed   its dust's dice
 * @property {string} start   the start star's id (held by all)
 * @property {(ids: any, points?: number) => string[]} held   the law's door
 * @property {(held: string[], id: string) => string[] | null} wayTo
 * @property {(held: string[], id: string) => string[]} takesBack
 * @property {() => number} points   the purse
 * @property {() => string[]} committed   the keeper's sky
 * @property {(ids: string[]) => string[] | string} commit   the keeper given a sky - the sky it holds, or why not
 * @property {(id: string) => string} name
 * @property {(star: any) => string} kindWords
 * @property {(star: any) => Array<{ text: string, neg: boolean }>} statLines   a star's stats in words (never `lines` - MACRO-7's TEXT.RSC read-site gate reads `.lines(` as one)
 * @property {(held: string[]) => Array<{ text: string, neg: boolean }>} summary
 * @property {(held: string[], id: string, points: number) => string | null} refusal
 * @property {(star: any) => string} tone   'main', 'life', or a key of `tones`
 * @property {Record<string, { plus: SkyTone, grim: SkyTone }>} [tones]   a sky's own tones past the Firmament's two
 * @property {(el: Function, pending: string[]) => Node[]} chips   the bar's purses (the points left of the sky pending), made again each change
 * @property {(el: Function, pending: string[]) => Node[]} side   the summary panel
 * @property {ReadonlyArray<{ text: () => string, x: number, y: number }>} figures   the aspects' names, faint over their stars
 * @property {(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rim: string, line: (w: number) => number) => void} drawStart
 * @property {{ forget: string, forgot: string, accept: string, acceptN: (n: number) => string, summary: string, home: string,
 *   homeAria: string, close: string, hint: string, hintTouch: string, unaccepted: string, set: string, startTip: string,
 *   backMany: (n: number) => string, back: string, take: (n: number) => string, noPoints: string | null, unacceptedEsc?: string }} words
 *   `unacceptedEsc` the ask in the Growth tab (GROWTH3's `embed`), whatever press would leave the sky
 */

const el = (tag, cls = null, text = null) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const grimoireWorn = (doc) => doc?.documentElement?.dataset?.plusDress === 'grimoire';
/** A tiny seeded dice, so the sky's dust is the same every opening. */
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/**
 * Mount a sky over `host`. `changed` once a sky is accepted (the save's word); `onExit` when it closes.
 * GROWTH3 (bible/10-UI/Growth.md section 6): `embed` draws it in the pause window's Growth tab - the Firmament's own
 * embedding (ui/firmamentWindow.js): the stage's size, no Close and no Escape of its own; the window asks `back()`.
 * @param {HTMLElement} host @param {SkyDesc} sky
 * @param {{ changed?: () => void, onExit?: (reason?: string) => void, doc?: Document, embed?: boolean }} [deps]
 */
export function mountSkyWindow(host, sky, { changed = () => {}, onExit = () => {}, doc = document, embed = false } = {}) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  if (doc.getElementById && !doc.getElementById(FIRM_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = FIRM_STYLE_ID;
    st.textContent = FIRM_CSS;
    doc.head?.appendChild(st);
  }
  const grim = grimoireWorn(doc);
  const P = grim ? GRIM_SKY : PLUS_SKY;
  /** @type {Record<string, SkyTone>} */
  const TONES = { ...baseTones(P), ...Object.fromEntries(Object.entries(sky.tones ?? {}).map(([k, v]) => [k, grim ? v.grim : v.plus])) };
  const toneOf = (s) => TONES[sky.tone(s)] ?? TONES.main;
  const font = (() => {
    if (grim) return GRIMOIRE_STACK;
    try { return globalThis.getComputedStyle(doc.documentElement).getPropertyValue('--display').trim() || 'Georgia, serif'; } catch { return 'Georgia, serif'; }
  })();
  const still = typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = sky.words;
  const starOf = (id) => sky.stars.find((s) => s.id === id) ?? null;

  // ── the sky held ──
  let committed = sky.held(sky.committed() ?? [sky.start]);
  let pending = committed.slice();

  // ── the frame: the Firmament's own roles ──
  const root = el('div', 'fmt-root');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', sky.label);
  const canvas = /** @type {HTMLCanvasElement} */ (el('canvas', 'fmt-sky'));
  canvas.setAttribute('aria-hidden', 'true');
  const bar = el('div', 'fmt-bar');
  bar.setAttribute('data-grim', 'wood');
  const title = el('h2', null, sky.label);
  const chips = el('span', 'fmt-chips');
  chips.style.display = 'contents';
  const btn = (label, cls, fn, aria = null) => {
    const b = /** @type {HTMLButtonElement} */ (el('button', `fmt-btn ${cls}`.trim(), label));
    b.type = 'button';
    if (aria) b.setAttribute('aria-label', aria);
    b.onclick = (e) => { e.stopPropagation(); fn(); };
    return b;
  };
  const undoBtn = btn(W.forget, '', () => { pending = committed.slice(); refresh(); say(W.forgot); });
  const goBtn = btn(W.accept, 'fmt-go', () => accept());
  const sideBtn = btn(W.summary, '', () => { side.classList.toggle('shut'); dirty = true; });
  const homeBtn = btn(W.home, '', () => fit(), W.homeAria);
  const exitBtn = btn(W.close, 'fmt-exit', () => tryClose());
  bar.append(title, chips, homeBtn, sideBtn, undoBtn, goBtn, exitBtn);
  const side = el('div', 'fmt-side');
  side.setAttribute('data-grim', 'ink');
  if ((globalThis.innerWidth ?? 1280) < 760) side.classList.add('shut');
  const tip = el('div', 'fmt-tip');
  tip.setAttribute('data-grim', 'ink');
  const coarse = !!globalThis.matchMedia?.('(pointer: coarse)')?.matches;
  const hint = el('div', 'fmt-hint', coarse ? W.hintTouch : W.hint);
  hint.setAttribute('data-grim', 'ink');
  const sayBox = el('div', 'fmt-say');
  sayBox.setAttribute('data-grim', 'ink');
  sayBox.setAttribute('role', 'status');
  root.append(canvas, bar, side, tip, hint, sayBox);
  if (embed) { root.classList.add('fmt-embed'); root.setAttribute('aria-modal', 'false'); exitBtn.hidden = true; }   // GROWTH3
  host.append(root);

  // ── the view ──
  const view = { x: 0, y: 0, z: 0.5 };
  const vw = () => root.clientWidth || globalThis.innerWidth || 1280;
  const vh = () => root.clientHeight || globalThis.innerHeight || 720;
  const room = () => (side.classList.contains('shut') ? vw() : Math.max(320, vw() - 320));
  const zFloor = () => Math.max(0.2, Math.min(room(), vh() - 200) / (sky.edge * 2 + 60));
  const Z_CEIL = 2.5;
  const hold = () => {
    view.z = Math.max(zFloor(), Math.min(Z_CEIL, view.z));
    // as far as the sky's middle may stand from the screen's - and at the least as far as the summary pushes it aside
    const reach = Math.max(200 * view.z, (vw() - room()) / 2 + 40, sky.edge * view.z - 0.35 * Math.min(vw(), vh()));
    view.x = Math.max(-reach, Math.min(reach, view.x));
    view.y = Math.max(-reach, Math.min(reach, view.y));
  };
  const barFoot = () => { try { const r = bar.getBoundingClientRect(), o = root.getBoundingClientRect(); return Math.max(0, r.bottom - o.top); } catch { return 0; } };
  function fit() {
    view.z = zFloor();
    view.x = (room() - vw()) / 2;
    view.y = Math.max(20, barFoot() / 2);
    dirty = true;
  }
  const toSky = (sx, sy) => ({ x: (sx - vw() / 2 - view.x) / view.z, y: (sy - vh() / 2 - view.y) / view.z });
  const toScreen = (x, y) => ({ x: vw() / 2 + view.x + x * view.z, y: vh() / 2 + view.y + y * view.z });

  const rnd = seeded(sky.seed);
  const dust = Array.from({ length: 520 }, () => ({ x: (rnd() - 0.5) * 2200, y: (rnd() - 0.5) * 2200, r: 0.6 + rnd() * 1.6, a: 0.15 + rnd() * 0.5, p: rnd() * Math.PI * 2 }));

  // ── the state the frame reads ──
  let hover = /** @type {string|null} */ (null);
  let way = /** @type {Set<string>} */ (new Set());
  let backs = /** @type {Set<string>} */ (new Set());
  /** @type {{ id: string, t0: number }[]} */
  let bursts = [];
  let dead = false;
  let dirty = true;
  let sayTimer = 0;
  let armedClose = false;
  // AUDIT GROWTH LANE3-8: the ask is for the stars it named - one taken or given back since, and the next leave asks again
  let armedAt = '';
  const rearm = () => { if (armedClose && armedAt !== pending.join()) armedClose = false; };
  const arm = () => { armedClose = true; armedAt = pending.join(); };
  const heldSet = () => new Set(pending);

  /** AUDIT GROWTH LANE2-6: the line under the bar, in the root's own frame - in the tab the root is not at the screen's
   *  top (it stood 200 px low, or off a short stage), and again whenever the window is resized (a phone's face measured
   *  while it waited, detached, for its door). */
  const placeSay = () => { sayBox.style.top = `${Math.round((barFoot() || 66) + 10)}px`; };
  function say(text, refused = false, stay = false) {
    sayBox.textContent = text;
    placeSay();
    sayBox.classList.add('on');
    sayBox.classList.toggle('no', refused);
    clearTimeout(sayTimer);
    if (!stay) sayTimer = /** @type {any} */ (setTimeout(() => sayBox.classList.remove('on'), refused ? 3200 : 2200));
  }
  /** What the window holds that the keeper does not: `{ added, removed }`. */
  function changes() {
    const c = new Set(committed), p = new Set(pending);
    return { added: pending.filter((id) => !c.has(id)).length, removed: committed.filter((id) => !p.has(id)).length };
  }
  const unaccepted = () => { const c = changes(); return !!(c.added || c.removed); };

  function refresh() {
    chips.replaceChildren(...sky.chips(el, pending));
    const ch = changes(), n = ch.added + ch.removed;
    goBtn.textContent = n ? W.acceptN(n) : W.accept;
    goBtn.disabled = !n;
    undoBtn.disabled = !n;
    side.replaceChildren(...sky.side(el, pending));
    placeSide();
    dirty = true;
  }
  /** AUDIT RVN-STARS S22: the summary under the bar wherever the bar ends - a long name wraps it past the sheet's 74px. */
  function placeSide() { side.style.top = `${Math.max(74, Math.round(barFoot() + 8))}px`; }

  // ── the tip ──
  function showTip(id, sx, sy) {
    const s = starOf(id);
    if (!s) { tip.classList.remove('on'); return; }
    const tone = sky.tone(s);
    const nm = el('div', `nm${tone === 'life' ? ' life' : ''}`, sky.name(id));
    if (tone !== 'main' && tone !== 'life') {   // a sky's own tone, in either dress (AUDIT RVN-STARS S19: Grimoire's `.nm.life` inked it the Road's green)
      if (typeof nm.style.setProperty === 'function') nm.style.setProperty('color', toneOf(s).lit, 'important'); else nm.style.color = toneOf(s).lit;
    }
    const parts = [nm, el('div', 'kd', sky.kindWords(s))];
    const ul = el('ul');
    for (const l of sky.statLines(s)) ul.append(el('li', l.neg ? 'neg' : null, l.text));
    parts.push(ul);
    let foot = null, no = false;
    const H = heldSet();
    if (id === sky.start) foot = W.startTip;
    else if (H.has(id)) {
      const n = sky.takesBack(pending, id).length;
      foot = n > 1 ? W.backMany(n - 1) : W.back;
    } else {
      const why = sky.refusal(pending, id, sky.points());
      if (why) { foot = why; no = true; } else foot = W.take(sky.wayTo(pending, id)?.length ?? 0);
    }
    parts.push(el('p', `ft${no ? ' no' : ''}`, foot));
    tip.replaceChildren(...parts);
    tip.classList.add('on');
    const w = tip.offsetWidth || 260, h = tip.offsetHeight || 140;
    let x = sx + 18, y = sy + 18;
    if (x + w > vw() - 8) x = sx - w - 18;
    if (y + h > vh() - 8) y = Math.max(8, vh() - h - 8);
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, y)}px`;
  }

  // ── setting and taking back ──
  const click = () => { try { if (audio.enabled) audio.playOneShot(SOUND.ButtonClick, 1); } catch { /* a sound is not the sky's problem */ } };
  function take(id) {
    if (!starOf(id) || heldSet().has(id)) return;
    const why = sky.refusal(pending, id, sky.points());
    if (why) { say(why, true); return; }
    const w = sky.wayTo(pending, id) ?? [];
    pending = sky.held([...pending, ...w], sky.points());
    for (const k of w) burst(k);
    refresh();
  }
  function giveBack(id) {
    const gone = new Set(sky.takesBack(pending, id));
    if (!gone.size) return;
    pending = pending.filter((k) => !gone.has(k));
    refresh();
  }
  function burst(id) { if (!still) bursts.push({ id, t0: globalThis.performance?.now?.() ?? 0 }); }
  function accept() {
    if (!unaccepted()) return;
    const added = pending.filter((id) => !committed.includes(id));
    const got = sky.commit(pending);
    if (typeof got === 'string') { say(got, true); return; }   // the keeper refused - the sky stays pending
    committed = sky.held(got);
    pending = committed.slice();
    for (const k of added) burst(k);
    try { changed(); } catch { /* the save's word is the host's */ }
    say(W.set);
    refresh();
  }

  // ── the pointer: the Firmament's ──
  function pick(sx, sy) {
    const at = toSky(sx, sy);
    let best = null, bestD = Infinity;
    for (const s of sky.stars) {
      const d = Math.hypot(s.pos[0] - at.x, s.pos[1] - at.y);
      if (d < NODE_R[s.kind] + 6 / view.z && d < bestD) { best = s.id; bestD = d; }
    }
    return best;
  }
  function setHover(id, sx, sy) {
    if (id !== hover) {
      hover = id;
      way = new Set();
      backs = new Set();
      if (id) {
        if (heldSet().has(id)) backs = new Set(sky.takesBack(pending, id));
        else way = new Set(sky.wayTo(pending, id) ?? []);
      }
      canvas.classList.toggle('over', !!id);
      dirty = true;
    }
    if (id) showTip(id, sx, sy); else tip.classList.remove('on');
  }
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let longPress = 0;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z };
      drag = null;
      clearTimeout(longPress);
      return;
    }
    drag = { x: p.x, y: p.y, vx: view.x, vy: view.y, moved: false, button: e.button };
    if (e.pointerType === 'touch') {
      const id = pick(p.x, p.y);
      longPress = /** @type {any} */ (setTimeout(() => { if (drag && !drag.moved && id) { drag.moved = true; click(); giveBack(id); setHover(null, 0, 0); } }, 550));
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.z * (d / Math.max(1, pinch.d))) / view.z);
      return;
    }
    if (drag) {
      const dx = p.x - drag.x, dy = p.y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; clearTimeout(longPress); canvas.classList.add('drag'); }
      if (drag.moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; hold(); dirty = true; setHover(null, 0, 0); return; }
    }
    setHover(pick(p.x, p.y), p.x, p.y);
  });
  canvas.addEventListener('pointerup', (e) => {
    const p = local(e);
    pointers.delete(e.pointerId);
    clearTimeout(longPress);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    const d = drag;
    drag = null;
    canvas.classList.remove('drag');
    if (!d || d.moved) return;
    const id = pick(p.x, p.y);
    if (!id) return;
    if (e.pointerType === 'touch' && d.button !== 2 && hover !== id) { setHover(id, p.x, p.y); return; }   // a finger's first tap reads it
    click();
    if (d.button === 2) giveBack(id); else take(id);
    hover = null;
    setHover(pick(p.x, p.y), p.x, p.y);
  });
  canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; pinch = null; clearTimeout(longPress); canvas.classList.remove('drag'); });
  canvas.addEventListener('pointerleave', (e) => { if (!drag && e.pointerType !== 'touch') setHover(null, 0, 0); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  function zoomAt(sx, sy, factor) {
    const before = toSky(sx, sy);
    view.z = Math.max(zFloor(), Math.min(Z_CEIL, view.z * factor));
    const after = toScreen(before.x, before.y);
    view.x += sx - after.x;
    view.y += sy - after.y;
    hold();
    dirty = true;
  }
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const p = local(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

  // ── the keys: a modal window owns its input ──
  function onKey(e) {
    if (dead || (embed && !root.isConnected)) return;   // GROWTH3: a stage between two draws of its page hears nothing
    if (embed && root.closest?.('[inert]')) return;   // AUDIT GROWTH LANE2-1: and nothing while a window over the pause window holds it inert (the account window's fields)
    let used = true;
    switch (e.key) {
      case 'Escape': if (embed) { used = false; break; } tryClose(); break;   // GROWTH3: the window's back stack asks back()
      case 'Enter': if (e.target?.tagName === 'BUTTON') { used = false; break; } click(); accept(); break;
      case 'h': case 'H': click(); fit(); break;
      case '+': case '=': zoomAt(vw() / 2, vh() / 2, 1.25); break;
      case '-': case '_': zoomAt(vw() / 2, vh() / 2, 0.8); break;
      case 'ArrowLeft': view.x += 60; hold(); dirty = true; break;
      case 'ArrowRight': view.x -= 60; hold(); dirty = true; break;
      case 'ArrowUp': view.y += 60; hold(); dirty = true; break;
      case 'ArrowDown': view.y -= 60; hold(); dirty = true; break;
      case 'Tab': used = false; break;
      default: used = false;
    }
    if (used && e.key !== 'Escape') armedClose = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }
  globalThis.addEventListener?.('keydown', onKey, true);
  /** GROWTH3: the pause window's back stack, in the tab - unaccepted stars asked about once; whether it took the press. */
  function back() {
    rearm();
    if (dead || !unaccepted() || armedClose) return false;
    arm();
    say(W.unacceptedEsc ?? W.unaccepted, true);
    return true;
  }
  /** Closing with a change not accepted asks first - once; the second close lets it go. */
  function tryClose() {
    rearm();
    if (unaccepted() && !armedClose) { arm(); say(W.unaccepted, true); return false; }
    close();
    return true;
  }

  // ── the drawing ──
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  let dpr = 1;
  function resize() {
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(vw() * dpr));
    canvas.height = Math.max(1, Math.round(vh() * dpr));
    hold();
    placeSide();
    dirty = true;
    placeSay();   // LANE2-6
  }
  resize();
  const onResize = () => resize();
  globalThis.addEventListener?.('resize', onResize);
  // GROWTH3: in the tab the stage moves under the sky - it is watched
  let watch = null;
  if (embed) try { watch = new globalThis.ResizeObserver(() => { if (!dead) resize(); }); watch.observe(root); } catch { watch = null; }

  function background(time) {
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createRadialGradient(w / 2 + view.x * dpr * 0.15, h / 2 + view.y * dpr * 0.15, 10, w / 2, h / 2, Math.max(w, h) * 0.8);
    g.addColorStop(0, P.ground0);
    if (grim) g.addColorStop(0.75, G.page);
    g.addColorStop(1, P.ground1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = view.x * 0.35, py = view.y * 0.35, z = 0.35 + view.z * 0.25;
    for (const d of dust) {
      const x = vw() / 2 + px + d.x * z, y = vh() / 2 + py + d.y * z;
      if (x < -4 || y < -4 || x > vw() + 4 || y > vh() + 4) continue;
      ctx.globalAlpha = grim ? d.a * 0.45 : d.a * (still ? 1 : 0.65 + 0.35 * Math.sin(time / 900 + d.p));
      ctx.fillStyle = P.star;
      if (grim) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      else { ctx.beginPath(); ctx.arc(x, y, d.r * 0.6, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  const toWorld = () => ctx.setTransform(dpr * view.z, 0, 0, dpr * view.z, dpr * (vw() / 2 + view.x), dpr * (vh() / 2 + view.y));
  const line = (w) => Math.max(w / view.z, 1.2 / view.z);

  /** THE ASPECTS' NAMES, faint over their stars - the Firmament's figures. */
  function figures() {
    ctx.font = `600 ${44}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = P.figure;
    for (const f of sky.figures) ctx.fillText(f.text(), f.x, f.y);
  }
  /** A line's tone: a start's line wears its other end's. */
  const lineTone = (a, b) => { const sa = starOf(a), sb = starOf(b); return sky.tone(sa?.kind === 'start' ? sb : sa); };
  function edges() {
    const H = heldSet();
    /** @type {Record<string, { dim: string[][], lit: string[][] }>} */
    const byTone = {};
    const wayList = [], backList = [];
    for (const [a, b] of sky.edges) {
      const k = lineTone(a, b);
      const L = (byTone[k] ??= { dim: [], lit: [] });
      const ha = H.has(a), hb = H.has(b);
      if (ha && hb) (backs.has(a) || backs.has(b) ? backList : L.lit).push([a, b]);
      else if ((ha || way.has(a)) && (hb || way.has(b)) && (way.has(a) || way.has(b))) wayList.push([a, b]);
      else L.dim.push([a, b]);
    }
    const stroke = (list, colour, width, glow = null) => {
      if (!list.length) return;
      ctx.beginPath();
      for (const [a, b] of list) { const p = starOf(a).pos, q = starOf(b).pos; ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
      ctx.strokeStyle = colour;
      ctx.lineWidth = line(width);
      if (glow && !grim) { ctx.shadowColor = glow; ctx.shadowBlur = 14 * dpr; }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    for (const [k, L] of Object.entries(byTone)) stroke(L.dim, (TONES[k] ?? TONES.main).edge, 2.2);
    for (const [k, L] of Object.entries(byTone)) { const T = TONES[k] ?? TONES.main; stroke(L.lit, T.edgeLit, 4.2, T.glow); }
    stroke(wayList, P.edgePath, 3.4);
    stroke(backList, P.edge, 2.2);
  }
  function stars() {
    const H = heldSet();
    for (const s of sky.stars) {
      const [x, y] = s.pos;
      const r = NODE_R[s.kind];
      const isHeld = H.has(s.id), isWay = way.has(s.id), isBack = backs.has(s.id) && s.id !== sky.start;
      const T = toneOf(s);
      const fill = isHeld ? T.lit : P.node;
      const rim = isHeld ? T.litRim : T.rim;
      if ((isHeld || isWay) && !grim) { ctx.shadowColor = T.glow; ctx.shadowBlur = (s.kind === 'small' ? 10 : 22) * dpr; }
      ctx.beginPath();
      if (s.kind === 'keystone') {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r * 0.78 : r * 1.12;
          const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
      } else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isWay ? T.path : fill;
      ctx.globalAlpha = isWay ? 0.55 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.lineWidth = line(s.kind === 'small' ? 1.6 : 2.6);
      ctx.strokeStyle = isBack ? P.refuse : rim;
      ctx.stroke();
      if (s.kind === 'notable') {
        ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.lineWidth = line(1.4); ctx.strokeStyle = rim; ctx.stroke();
      }
      if (s.kind === 'start') sky.drawStart(ctx, x, y, r, rim, line);
      if (s.id === hover) { ctx.beginPath(); ctx.arc(x, y, r + 8, 0, Math.PI * 2); ctx.lineWidth = line(2); ctx.strokeStyle = P.textLit; ctx.stroke(); }
    }
    // the keystones' and the notables' names, each where it covers no star and no other name, on a halo of the ground
    ctx.lineJoin = 'round';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const L of labelLayout()) {
      ctx.font = L.font;
      ctx.lineWidth = 5 / view.z;
      ctx.strokeStyle = P.halo;
      ctx.strokeText(L.text, L.x, L.y);
      ctx.fillStyle = H.has(L.id) ? P.textLit : L.kind === 'notable' ? P.textDim : P.text;
      ctx.fillText(L.text, L.x, L.y);
    }
  }
  /** THE NAMES' PLACES (the Firmament's labelLayout): tried round each star - outward, below, above, beside, further
   *  out - the first that covers no star, no line and no name placed; keystones first. Laid out once a zoom. */
  let _labels = { z: -1, list: /** @type {any[]} */ ([]) };
  function labelLayout() {
    if (_labels.z === view.z) return _labels.list;
    const z = view.z, pad = 3 / z;
    const placed = [], out = [];
    const want = sky.stars.filter((s) => s.kind === 'keystone' || s.kind === 'notable').sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'keystone' ? -1 : 1));
    /** What the box covers of the stars: a great star's whole (10), a small one's a little (4) - a name may lie over a
     *  small star before it goes unsaid. */
    const hitsStar = (r) => sky.stars.reduce((n, m) => {
      const cx = Math.max(r.x0, Math.min(m.pos[0], r.x1)), cy = Math.max(r.y0, Math.min(m.pos[1], r.y1));
      return Math.max(n, Math.hypot(m.pos[0] - cx, m.pos[1] - cy) < NODE_R[m.kind] + 4 / z ? (m.kind === 'small' ? 4 : 10) : 0);
    }, 0);
    /** Whether a line of the sky runs through the box (its middle and its quarters tried). */
    const hitsLine = (r) => sky.edges.some(([a, b]) => {
      const p = starOf(a).pos, q = starOf(b).pos;
      return [0.25, 0.5, 0.75].some((u) => { const x = p[0] + (q[0] - p[0]) * u, y = p[1] + (q[1] - p[1]) * u; return x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1; });
    });
    const hitsName = (r) => placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
    for (const s of want) {
      const px = (s.kind === 'keystone' ? 17 : 14) / Math.max(0.6, z);
      const face = `${s.kind === 'keystone' ? '600 ' : ''}${px}px ${font}`;
      ctx.font = face;
      const text = sky.name(s.id);
      const w = ctx.measureText(text).width, h = px * 1.1;
      const gap = NODE_R[s.kind] + 6 / z;
      const [x, y] = s.pos, len = Math.hypot(x, y) || 1, ux = x / len, uy = y / len;
      const reach = Math.abs(ux) * (w / 2) + Math.abs(uy) * (h / 2);
      const spots = [
        [ux * (gap + reach), uy * (gap + reach)], [0, gap + h / 2], [0, -gap - h / 2], [gap + w / 2, 0], [-gap - w / 2, 0],
        [gap + w / 2, gap + h / 2], [-gap - w / 2, gap + h / 2], [gap + w / 2, -gap - h / 2], [-gap - w / 2, -gap - h / 2],
        [0, gap * 2 + h / 2], [0, -gap * 2 - h / 2], [ux * (gap * 2 + reach), uy * (gap * 2 + reach)],
      ];
      let best = null, bestCost = Infinity;
      for (const [dx, dy] of spots) {
        const lx = x + dx, ly = y + dy;
        const r = { x0: lx - w / 2 - pad, x1: lx + w / 2 + pad, y0: ly - h / 2 - pad, y1: ly + h / 2 + pad };
        const cost = hitsStar(r) + (hitsName(r) ? 10 : 0) + (hitsLine(r) ? 3 : 0);
        if (cost < bestCost) { best = { x: lx, y: ly, r }; bestCost = cost; }
        if (!cost) break;
      }
      if (!best || (bestCost >= 10 && s.kind !== 'keystone')) continue;   // a crowded notable stays unnamed until the view comes closer (its card names it)
      placed.push(best.r);
      out.push({ id: s.id, kind: s.kind, text, font: face, x: best.x, y: best.y });
    }
    _labels = { z, list: out };
    return out;
  }
  function sparks(time) {
    if (!bursts.length) return;
    const life = 900;
    bursts = bursts.filter((b) => time - b.t0 < life);
    for (const b of bursts) {
      const s = starOf(b.id);
      if (!s) continue;
      const u = Math.max(0, (time - b.t0) / life);
      ctx.beginPath();
      ctx.arc(s.pos[0], s.pos[1], NODE_R[s.kind] + u * 60, 0, Math.PI * 2);
      ctx.strokeStyle = toneOf(s).edgeLit;
      ctx.globalAlpha = 1 - u;
      ctx.lineWidth = line(3 * (1 - u) + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    dirty = true;
  }
  let raf = 0, lastPaint = 0;
  const rAF = globalThis.requestAnimationFrame ?? ((fn) => /** @type {any} */ (setTimeout(() => fn(Date.now()), 33)));
  const cAF = globalThis.cancelAnimationFrame ?? ((id) => clearTimeout(id));
  function frame(time) {
    if (dead) return;
    raf = rAF(frame);
    const moving = !still && bursts.length > 0;
    if (!dirty && !(moving && time - lastPaint > 33)) return;
    lastPaint = time;
    dirty = false;
    if (!ctx) return;
    background(time);
    toWorld();
    figures();
    edges();
    stars();
    sparks(time);
  }
  raf = rAF(frame);

  refresh();
  fit();
  hold();
  if (sky.points() === 0 && W.noPoints) say(W.noPoints, false, true);
  if (!embed) (goBtn.disabled ? homeBtn : goBtn).focus?.({ preventScroll: true });   // GROWTH3: in the tab the window's own focus stands   // AUDIT RVN-STARS S21: a disabled Accept takes no focus - the dialog's first press does

  /** Down, and nothing said - the door's own dispose (it is the one closing). */
  function teardown() {
    if (dead) return false;
    dead = true;
    cAF(raf);
    clearTimeout(sayTimer);
    globalThis.removeEventListener?.('keydown', onKey, true);
    globalThis.removeEventListener?.('resize', onResize);
    watch?.disconnect?.();
    root.remove();
    return true;
  }
  /** Down by the window's own press (Close, Escape): the door told, so it drops its slot. */
  function close() {
    if (teardown()) try { onExit('close'); } catch { /* the host's */ }
  }

  return {
    unmount: teardown,
    destroy: close,
    repaint: () => { refresh(); },
    /** Test and probe seam: what the window holds now. */
    model: () => ({ committed: committed.slice(), pending: pending.slice(), changes: changes(), view: { ...view }, hover }),
    /** Probe seams: press a star, take one back, accept, close as the Escape key does - as a player would. */
    take, giveBack, accept, tryClose,
    /** GROWTH3: the tab's Escape (above), and the stage's word that it moved (refit: its first true size). */
    back,
    resize: (refit = false) => { if (dead) return; if (refit && embed && vw() < 980) side.classList.add('shut'); resize(); if (refit) { fit(); hold(); } },   // a narrow stage starts with the summary shut
    close,
    hoverAt: (id) => { const s = starOf(id); if (!s) return; const p = toScreen(s.pos[0], s.pos[1]); setHover(id, p.x, p.y); },
  };
}
