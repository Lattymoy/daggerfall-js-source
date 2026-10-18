// @ts-check
// CAPTAIN-TREE (2026-10-17, the owner: "A firmament styled captain skill tree along with making improvements to the ship
// upgrade system"; bible/03-World/Naval-Refit.md CAPTAIN-TREE) - THE CAPTAIN'S STARS, DRAWN: the Firmament's own sky
// (ui/firmamentWindow.js - its sheet, its two palettes, its stars' sizes) over the whole screen, for the captain's sky of
// systems/naval/captainTree.js. Opened from the Captain page (ui/captainPage.js) through the sea's window door
// (ui/naval/navalPlunderDoor.js createCaptainStarsOverlay), over the world, which stands still under it.
//
// WHAT A CAPTAIN DOES HERE - the Firmament's ways, kept:
//   - HOVERS a star to read it, and sees the shortest way to it from what they hold, lit;
//   - PRESSES it to set that whole way, while the captain's points (a level's one, past the first) pay for it;
//   - RIGHT-PRESSES (or long-presses) a star held to take it back, with every star joined to the Helm only through it;
//   - ACCEPTS: a change is pending until then, free to try; accepted, the ledger keeps it (captainLedger.js setTree) and
//     every ship of theirs sails on it from her next reading. A star is free to take back - no gold, no silver.
//   Drag pans, the wheel (or a pinch) zooms, H finds the Helm.
//
// THE TWO HALVES: THE MASTER, to the left, in the Firmament's life ring's verdigris; THE COMMANDER, to the right, in its
// battle ring's brass. Nothing here decides what may be set - the law is captainTree.js, and the ledger asks it again.

import { t } from '../systems/textManager.js';
import {
  CAPTAIN_STARS, CAPTAIN_EDGES, CAPTAIN_STATS, starOf, heldStars, wayTo, takesBack, starStats, captainOf,
} from '../systems/naval/captainTree.js';
import { PLUS_SKY, GRIM_SKY, NODE_R, FIRM_CSS, FIRM_STYLE_ID } from './firmamentWindow.js';
import { GRIM_TONES, GRIMOIRE_STACK } from './grimoireDress.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhanced/enhancedStyle.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

const G = GRIM_TONES;
/** The sky's own edge: the outer keystones and the halves' names. */
export const CAPTAIN_SKY_EDGE = 720;

// ─── THE WORDS (pure) ───────────────────────────────────────────────

/** Each star's name. */
const NAMES = Object.freeze({
  helm: () => t('captain.star.helm', 'The Helm'),
  m_way1: () => t('captain.star.mWay1', 'Trimmed Sheets'), m_way2: () => t('captain.star.mWay2', 'Full and By'),
  m_clean: () => t('captain.star.mClean', 'Clean Bottom'), m_way3: () => t('captain.star.mWay3', 'Studding Sails'),
  m_wind: () => t('captain.star.mWind', 'Master of the Wind'),
  m_oar1: () => t('captain.star.mOar1', 'Stroke Oar'), m_turn1: () => t('captain.star.mTurn1', 'Lee Helm'),
  m_quick: () => t('captain.star.mQuick', 'Quick in Stays'), m_oar2: () => t('captain.star.mOar2', 'Double-Banked Oars'),
  m_hold1: () => t('captain.star.mHold1', 'Tight Stowage'), m_hold2: () => t('captain.star.mHold2', 'Dunnage and Ballast'),
  m_deep: () => t('captain.star.mDeep', 'Deep Hold'), m_trade1: () => t('captain.star.mTrade1', 'Harbour Bargains'),
  m_prince: () => t('captain.star.mPrince', 'Merchant Prince'),
  m_hull1: () => t('captain.star.mHull1', 'Doubled Planking'), m_rep1: () => t('captain.star.mRep1', 'Carpenter\'s Mate'),
  m_oak: () => t('captain.star.mOak', 'Heart of Oak'), m_hull2: () => t('captain.star.mHull2', 'Copper Sheathing'),
  m_iron: () => t('captain.star.mIron', 'Ironsides'),
  c_rel1: () => t('captain.star.cRel1', 'Gun Drill'), c_rel2: () => t('captain.star.cRel2', 'Powder Monkeys'),
  c_drill: () => t('captain.star.cDrill', 'Smart Gun Crews'), c_harm1: () => t('captain.star.cHarm1', 'Double-Shotted'),
  c_line: () => t('captain.star.cLine', 'Ship of the Line'),
  c_aim1: () => t('captain.star.cAim1', 'Gun Captain'), c_aim2: () => t('captain.star.cAim2', 'Quoin and Handspike'),
  c_long: () => t('captain.star.cLong', 'Long Shot'), c_harm2: () => t('captain.star.cHarm2', 'Between Wind and Water'),
  c_shot1: () => t('captain.star.cShot1', 'The Shot Locker'), c_grape: () => t('captain.star.cGrape', 'Canister and Grape'),
  c_chain: () => t('captain.star.cChain', 'Bar and Chain'), c_hot: () => t('captain.star.cHot', 'Hot Shot Furnace'),
  c_board1: () => t('captain.star.cBoard1', 'Boarding Pikes'), c_ram1: () => t('captain.star.cRam1', 'Iron Beak'),
  c_irons: () => t('captain.star.cIrons', 'Grappling Irons'), c_board2: () => t('captain.star.cBoard2', 'Cutlass Drill'),
  c_creed: () => t('captain.star.cCreed', 'Boarders Away'),
});
/** A star's name - its id where none is written. */
export const starName = (id) => NAMES[id]?.() ?? id;
/** What a star is, as its card says it: "The Master · notable". */
export function starKindWords(star) {
  if (!star) return '';
  if (star.kind === 'start') return t('captain.kind.start', 'Starting star');
  const half = star.sec === 'master' ? t('captain.half.master', 'The Master') : t('captain.half.commander', 'The Commander');
  const kind = star.kind === 'keystone' ? t('captain.kind.keystone', 'keystone') : star.kind === 'notable' ? t('captain.kind.notable', 'notable') : t('captain.kind.small', 'star');
  return `${half} · ${kind}`;
}
/** Each stat's label. */
const LABELS = Object.freeze({
  way: () => t('captain.stat.way', 'Speed under sail'), oars: () => t('captain.stat.oars', 'Speed under oars'),
  turn: () => t('captain.stat.turn', 'Turning speed'), cargo: () => t('captain.stat.cargo', 'Cargo capacity'),
  hull: () => t('captain.stat.hull', 'Hull and sail strength'), repair: () => t('captain.stat.repair', 'Crew repair speed'),
  trade: () => t('captain.stat.trade', 'Better exchange prices'), harm: () => t('captain.stat.harm', 'Gun damage'),
  reload: () => t('captain.stat.reload', 'Gun reload speed'), aim: () => t('captain.stat.aim', 'Gun accuracy'),
  grape: () => t('captain.stat.grape', 'Grapeshot crew damage'), chain: () => t('captain.stat.chain', 'Chain shot sail damage'),
  heated: () => t('captain.stat.heated', 'Heated shot fire chance'), boarders: () => t('captain.stat.boarders', 'Boarding party size'),
  ram: () => t('captain.stat.ram', 'Ram damage'), foul: () => t('captain.stat.foul', 'Time a rammed ship stays fouled'),
});
/** A stat's line: "Way under sail +6%" - hands a count, the foul seconds, the reload quicker (a share off it). */
export function starStatWords(key, v) {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  const a = Math.abs(v);
  const n = key === 'boarders' ? `${sign}${Math.round(a)}` : key === 'foul' ? `${sign}${Math.round(a)} s` : `${sign}${Math.round(a * 100)}%`;
  if (key === 'reload') return v >= 0 ? t('captain.stat.reloadQuick', 'Guns reload {n} faster', { n: `${Math.round(a * 100)}%` }) : t('captain.stat.reloadSlow', 'Guns reload {n} slower', { n: `${Math.round(a * 100)}%` });
  return `${LABELS[key]?.() ?? key} ${n}`;
}
/** A star's lines: its stats in words, a price (a stat under 0) marked. */
export const starLines = (star) => Object.entries(star?.stats ?? {}).map(([k, v]) => ({ text: starStatWords(k, v), neg: v < 0 }));
/** The sky's sums as the side panel says them, in CAPTAIN_STATS' order: `[{ key, text, neg }]`. */
export function skySummary(held) {
  const s = starStats(held);
  return CAPTAIN_STATS.filter((k) => s[k]).map((k) => ({ key: k, text: starStatWords(k, s[k]), neg: s[k] < 0 }));
}
/** Why `id` cannot be set now, in words - null when it can (the law's way to it, the points left). Pure. */
export function starRefusal(held, id, points) {
  if (!starOf(id)) return t('captain.no.unknown', 'Unknown star.');
  const h = heldStars(held);
  if (h.includes(id)) return null;
  const way = wayTo(h, id);
  if (!way?.length) return t('captain.no.way', 'This star isn\'t connected to any of your stars.');
  const left = points - (h.length - 1);
  if (way.length > left) return t('captain.no.points', 'Reaching this star costs {need} {need, plural, one {point} other {points}}. You have {left}. You get one point per captain level.', { need: way.length, left: Math.max(0, left) });
  return null;
}

// ─── THE WINDOW ─────────────────────────────────────────────────────

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
 * Mount the captain's stars over `host`. `ledger` the captain's (systems/naval/captainLedger.js: `captain()`, `tree()`,
 * `setTree(ids)`); `changed` once a sky is accepted (the save's word); `onExit` when it closes.
 * @param {HTMLElement} host
 * @param {{ ledger: { captain: () => { xp: number, level: number, points: number, next: number|null }, tree: () => string[], setTree: (ids: string[]) => string[] },
 *   changed?: () => void, onExit?: (reason?: string) => void, doc?: Document }} deps
 */
export function mountCaptainTreeWindow(host, { ledger, changed = () => {}, onExit = () => {}, doc = document }) {
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
  const font = (() => {
    if (grim) return GRIMOIRE_STACK;
    try { return globalThis.getComputedStyle(doc.documentElement).getPropertyValue('--display').trim() || 'Georgia, serif'; } catch { return 'Georgia, serif'; }
  })();
  const still = typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── the captain and the sky ──
  const captain = () => ledger.captain?.() ?? captainOf(null);
  let committed = heldStars(ledger.tree?.() ?? ['helm']);
  let pending = committed.slice();

  // ── the frame: the Firmament's own roles ──
  const root = el('div', 'fmt-root');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', t('captain.sky.title', 'The Captain\'s Stars'));
  const canvas = /** @type {HTMLCanvasElement} */ (el('canvas', 'fmt-sky'));
  canvas.setAttribute('aria-hidden', 'true');
  const bar = el('div', 'fmt-bar');
  bar.setAttribute('data-grim', 'wood');
  const title = el('h2', null, t('captain.sky.title', 'The Captain\'s Stars'));
  const levelChip = el('span', 'fmt-purse');
  const pointsChip = el('span', 'fmt-purse life');
  const btn = (label, cls, fn, aria = null) => {
    const b = /** @type {HTMLButtonElement} */ (el('button', `fmt-btn ${cls}`.trim(), label));
    b.type = 'button';
    if (aria) b.setAttribute('aria-label', aria);
    b.onclick = (e) => { e.stopPropagation(); fn(); };
    return b;
  };
  const undoBtn = btn(t('captain.sky.forget', 'Discard changes'), '', () => { pending = committed.slice(); refresh(); say(t('captain.sky.forgot', 'Changes discarded.')); });
  const goBtn = btn(t('captain.sky.accept', 'Accept'), 'fmt-go', () => accept());
  const sideBtn = btn(t('captain.sky.summary', 'Summary'), '', () => { side.classList.toggle('shut'); dirty = true; });
  const helmBtn = btn(t('captain.sky.helmBtn', 'Helm'), '', () => fit(), t('captain.sky.helmAria', 'Centre on the Helm'));
  const exitBtn = btn(t('captain.sky.close', 'Close'), 'fmt-exit', () => tryClose());
  bar.append(title, levelChip, pointsChip, helmBtn, sideBtn, undoBtn, goBtn, exitBtn);
  const side = el('div', 'fmt-side');
  side.setAttribute('data-grim', 'ink');
  if ((globalThis.innerWidth ?? 1280) < 760) side.classList.add('shut');
  const tip = el('div', 'fmt-tip');
  tip.setAttribute('data-grim', 'ink');
  const coarse = !!globalThis.matchMedia?.('(pointer: coarse)')?.matches;
  const hint = el('div', 'fmt-hint', coarse ? t('captain.sky.hintTouch', 'Tap a star to see it, tap again to take it · Hold a star to remove it · Drag to pan · Pinch to zoom')
    : t('captain.sky.hint', 'Click a star to take it and the stars on the way to it · Right-click to remove · Drag to pan · Scroll to zoom · H: back to the Helm'));
  hint.setAttribute('data-grim', 'ink');
  const sayBox = el('div', 'fmt-say');
  sayBox.setAttribute('data-grim', 'ink');
  sayBox.setAttribute('role', 'status');
  root.append(canvas, bar, side, tip, hint, sayBox);
  host.append(root);

  // ── the view ──
  const view = { x: 0, y: 0, z: 0.5 };
  const vw = () => root.clientWidth || globalThis.innerWidth || 1280;
  const vh = () => root.clientHeight || globalThis.innerHeight || 720;
  const room = () => (side.classList.contains('shut') ? vw() : Math.max(320, vw() - 320));
  const zFloor = () => Math.max(0.2, Math.min(room(), vh() - 200) / (CAPTAIN_SKY_EDGE * 2 + 60));
  const Z_CEIL = 2.5;
  const hold = () => {
    view.z = Math.max(zFloor(), Math.min(Z_CEIL, view.z));
    // as far as the sky's middle may stand from the screen's - and at the least as far as the summary pushes it aside
    const reach = Math.max(200 * view.z, (vw() - room()) / 2 + 40, CAPTAIN_SKY_EDGE * view.z - 0.35 * Math.min(vw(), vh()));
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

  const rnd = seeded(17101);
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
  const heldSet = () => new Set(pending);
  const isMaster = (s) => s?.sec === 'master';

  function say(text, refused = false, stay = false) {
    sayBox.textContent = text;
    sayBox.style.top = `${Math.round((bar.getBoundingClientRect?.().bottom ?? 66) + 10)}px`;
    sayBox.classList.add('on');
    sayBox.classList.toggle('no', refused);
    clearTimeout(sayTimer);
    if (!stay) sayTimer = /** @type {any} */ (setTimeout(() => sayBox.classList.remove('on'), refused ? 3200 : 2200));
  }
  /** What the window holds that the ledger does not: `{ added, removed }`. */
  function changes() {
    const c = new Set(committed), p = new Set(pending);
    return { added: pending.filter((id) => !c.has(id)).length, removed: committed.filter((id) => !p.has(id)).length };
  }
  const unaccepted = () => { const c = changes(); return !!(c.added || c.removed); };

  function refresh() {
    const c = captain();
    const left = c.points - (pending.length - 1);
    levelChip.replaceChildren(el('span', null, t('captain.sky.level', 'Level')), el('b', null, String(c.level)),
      el('span', 'of', c.next == null ? t('captain.sky.top', 'the highest') : t('captain.sky.xp', '{xp} of {next} XP', { xp: c.xp.toLocaleString('en-US'), next: c.next.toLocaleString('en-US') })));
    levelChip.title = t('captain.sky.levelTip', 'Captain XP comes from sinking and capturing ships, beating off boarders, claiming prizes, finishing contracts, distance sailed, treasure charts, charting isles and selling goods at the exchange.');
    pointsChip.replaceChildren(el('span', null, '★'), el('b', null, String(Math.max(0, left))), el('span', 'of', t('captain.sky.of', 'of {n}', { n: c.points })));
    pointsChip.title = t('captain.sky.pointsTip', 'One point per level after the first.');
    const ch = changes(), n = ch.added + ch.removed;
    goBtn.textContent = n ? t('captain.sky.acceptN', 'Accept ({n})', { n }) : t('captain.sky.accept', 'Accept');
    goBtn.disabled = !n;
    undoBtn.disabled = !n;
    drawSide();
    dirty = true;
  }
  function drawSide() {
    const c = captain();
    const parts = [el('h3', null, t('captain.sky.sumHead', 'What your stars do'))];
    const ul = el('ul');
    const lines = skySummary(pending);
    if (!lines.length) ul.append(el('li', 'none', t('captain.sky.none', 'No stars taken yet. Start next to the Helm.')));
    for (const l of lines) ul.append(el('li', l.neg ? 'neg' : null, l.text));
    parts.push(ul);
    parts.push(el('h3', null, t('captain.half.master', 'The Master')), el('p', 'fmt-sign', t('captain.sky.masterLore', 'Seamanship: sails, oars, steering, cargo, trade and repairs.')));
    parts.push(el('h3', null, t('captain.half.commander', 'The Commander')), el('p', 'fmt-sign', t('captain.sky.commanderLore', 'Combat: gun reload and accuracy, grapeshot, chain shot and heated shot, boarding and ramming.')));
    parts.push(el('p', 'fmt-note', t('captain.sky.note', 'Stars apply to all of your ships. Removing or changing stars is free.')));
    if (c.level < 3) parts.push(el('p', 'fmt-note', t('captain.sky.oreNote', 'From level 3, shipwrights can refit a ship past tier III with Steel. Each later metal, up to Daedric, needs a higher level.')));
    side.replaceChildren(...parts);
  }

  // ── the tip ──
  function showTip(id, sx, sy) {
    const s = starOf(id);
    if (!s) { tip.classList.remove('on'); return; }
    const parts = [el('div', `nm${isMaster(s) ? ' life' : ''}`, starName(id)), el('div', 'kd', starKindWords(s))];
    const ul = el('ul');
    for (const l of starLines(s)) ul.append(el('li', l.neg ? 'neg' : null, l.text));
    parts.push(ul);
    let foot = null, no = false;
    const H = heldSet();
    if (id === 'helm') foot = t('captain.tip.helm', 'Everyone starts with the Helm. Take a star next to it.');
    else if (H.has(id)) {
      const n = takesBack(pending, id).length;
      foot = n > 1 ? t('captain.tip.backMany', 'Right-click to remove it and the {n} stars after it.', { n: n - 1 }) : t('captain.tip.back', 'Right-click to remove.');
    } else {
      const why = starRefusal(pending, id, captain().points);
      if (why) { foot = why; no = true; } else {
        const n = wayTo(pending, id)?.length ?? 0;
        foot = t('captain.tip.take', 'Click to take: {n} {n, plural, one {point} other {points}}.', { n });
      }
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
    const why = starRefusal(pending, id, captain().points);
    if (why) { say(why, true); return; }
    const w = wayTo(pending, id) ?? [];
    pending = heldStars([...pending, ...w], captain().points);
    for (const k of w) burst(k);
    refresh();
  }
  function giveBack(id) {
    const gone = new Set(takesBack(pending, id));
    if (!gone.size) return;
    pending = pending.filter((k) => !gone.has(k));
    refresh();
  }
  function burst(id) { if (!still) bursts.push({ id, t0: globalThis.performance?.now?.() ?? 0 }); }
  function accept() {
    if (!unaccepted()) return;
    const added = pending.filter((id) => !committed.includes(id));
    committed = heldStars(ledger.setTree(pending));
    pending = committed.slice();
    for (const k of added) burst(k);
    try { changed(); } catch { /* the save's word is the host's */ }
    say(t('captain.sky.set', 'Stars saved. They apply to all of your ships.'));
    refresh();
  }

  // ── the pointer: the Firmament's ──
  function pick(sx, sy) {
    const at = toSky(sx, sy);
    let best = null, bestD = Infinity;
    for (const s of CAPTAIN_STARS) {
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
        if (heldSet().has(id)) backs = new Set(takesBack(pending, id));
        else way = new Set(wayTo(pending, id) ?? []);
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
    if (dead) return;
    let used = true;
    switch (e.key) {
      case 'Escape': tryClose(); break;
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
  /** Closing with a change not accepted asks first - once; the second close lets it go. */
  function tryClose() {
    if (unaccepted() && !armedClose) { armedClose = true; say(t('captain.sky.unaccepted', 'You have changes that aren\'t accepted. Close again to discard them.'), true); return false; }
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
    dirty = true;
  }
  resize();
  const onResize = () => resize();
  globalThis.addEventListener?.('resize', onResize);

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

  /** THE HALVES' NAMES, faint over their stars - the Firmament's figures. */
  function halves() {
    ctx.font = `600 ${44}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = P.figure;
    ctx.fillText(t('captain.half.masterCaps', 'THE MASTER'), -440, -660);
    ctx.fillText(t('captain.half.commanderCaps', 'THE COMMANDER'), 440, -660);
  }
  function edges() {
    const H = heldSet();
    const lists = { dim: [], dimM: [], lit: [], litM: [], way: [], back: [] };
    for (const [a, b] of CAPTAIN_EDGES) {
      const master = isMaster(starOf(a)) || isMaster(starOf(b));
      const ha = H.has(a), hb = H.has(b);
      if (ha && hb) (backs.has(a) || backs.has(b) ? lists.back : master ? lists.litM : lists.lit).push([a, b]);
      else if ((ha || way.has(a)) && (hb || way.has(b)) && (way.has(a) || way.has(b))) lists.way.push([a, b]);
      else (master ? lists.dimM : lists.dim).push([a, b]);
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
    stroke(lists.dim, P.edge, 2.2);
    stroke(lists.dimM, P.edgeLife, 2.2);
    stroke(lists.lit, P.edgeLit, 4.2, P.glow);
    stroke(lists.litM, P.edgeLifeLit, 4.2, P.glowLife);
    stroke(lists.way, P.edgePath, 3.4);
    stroke(lists.back, P.edge, 2.2);
  }
  function stars() {
    const H = heldSet();
    for (const s of CAPTAIN_STARS) {
      const [x, y] = s.pos;
      const r = NODE_R[s.kind];
      const isHeld = H.has(s.id), isWay = way.has(s.id), isBack = backs.has(s.id) && s.id !== 'helm';
      const m = isMaster(s);
      const fill = isHeld ? (m ? P.litLife : P.lit) : P.node;
      const rim = isHeld ? (m ? P.litRimLife : P.litRim) : (m ? P.rimLife : P.rim);
      if ((isHeld || isWay) && !grim) { ctx.shadowColor = m ? P.glowLife : P.glow; ctx.shadowBlur = (s.kind === 'small' ? 10 : 22) * dpr; }
      ctx.beginPath();
      if (s.kind === 'keystone') {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r * 0.78 : r * 1.12;
          const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
      } else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isWay ? (m ? P.edgeLifeLit : P.edgePath) : fill;
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
      if (s.kind === 'start') {
        // THE HELM: a ship's wheel - eight spokes through its rim, a hub in the middle
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25);
          ctx.lineTo(x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9));
        }
        ctx.lineWidth = line(3);
        ctx.strokeStyle = rim;
        ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.lineWidth = line(2); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.fillStyle = rim; ctx.fill();
      }
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
    const want = CAPTAIN_STARS.filter((s) => s.kind === 'keystone' || s.kind === 'notable').sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'keystone' ? -1 : 1));
    /** What the box covers of the stars: a great star's whole (10), a small one's a little (4) - a name may lie over a
     *  small star before it goes unsaid. */
    const hitsStar = (r) => CAPTAIN_STARS.reduce((n, m) => {
      const cx = Math.max(r.x0, Math.min(m.pos[0], r.x1)), cy = Math.max(r.y0, Math.min(m.pos[1], r.y1));
      return Math.max(n, Math.hypot(m.pos[0] - cx, m.pos[1] - cy) < NODE_R[m.kind] + 4 / z ? (m.kind === 'small' ? 4 : 10) : 0);
    }, 0);
    /** Whether a line of the sky runs through the box (its middle and its quarters tried). */
    const hitsLine = (r) => CAPTAIN_EDGES.some(([a, b]) => {
      const p = starOf(a).pos, q = starOf(b).pos;
      return [0.25, 0.5, 0.75].some((u) => { const x = p[0] + (q[0] - p[0]) * u, y = p[1] + (q[1] - p[1]) * u; return x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1; });
    });
    const hitsName = (r) => placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
    for (const s of want) {
      const px = (s.kind === 'keystone' ? 17 : 14) / Math.max(0.6, z);
      const face = `${s.kind === 'keystone' ? '600 ' : ''}${px}px ${font}`;
      ctx.font = face;
      const text = starName(s.id);
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
      ctx.strokeStyle = isMaster(s) ? P.edgeLifeLit : P.edgeLit;
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
    halves();
    edges();
    stars();
    sparks(time);
  }
  raf = rAF(frame);

  refresh();
  fit();
  hold();
  if (captain().points === 0) say(t('captain.sky.noPoints', 'You get one point per captain level. Earn XP at sea: sink or capture a ship, finish a contract, or just sail.'), false, true);
  goBtn.focus?.({ preventScroll: true });

  /** Down, and nothing said - the door's own dispose (it is the one closing). */
  function teardown() {
    if (dead) return false;
    dead = true;
    cAF(raf);
    clearTimeout(sayTimer);
    globalThis.removeEventListener?.('keydown', onKey, true);
    globalThis.removeEventListener?.('resize', onResize);
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
    hoverAt: (id) => { const s = starOf(id); if (!s) return; const p = toScreen(s.pos[0], s.pos[1]); setHover(id, p.x, p.y); },
  };
}
