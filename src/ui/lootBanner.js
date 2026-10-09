// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT-BANNER (2026-10-09, Mac: "a popup for when you obtain something of rarity including weapons, armor, the new
// cards, etc - something akin to a destiny loot popup notification"; bible/10-UI/Loot-Banner.md) - A BANNER AT THE
// RIGHT EDGE FOR EVERY RARE-OR-BETTER THING THAT ARRIVES IN THE PLAYER'S KEEPING.
//
// Mac's four answers: Rare and up (Common and Magic keep the small pickup feed under the crosshair); every way a piece
// can arrive (loot, spoils, a quest's reward, a craft, the Broker, a shop, a trade, the market, a card); at the right
// edge by the notices; and the three top tiers - Aetheric, Artifact, Gilded - a bigger banner with a fanfare.
//
// WHAT ARRIVED is the watcher's (systems/acquireWatch.js - the pack, the wagon and the Materials Bag read once a frame,
// a piece marked the first frame it stands there). This module is the FACE: the law of what stands and for how long
// (`createBannerQueue`, pure), and the stack the law is drawn into.
//
// A BANNER: the piece's picture in a well framed in its tier (a card's own face, painted - render/iliacCardFaces.js),
// a kicker in the tier's light (its label - "Exalted Legendary", "Perfect Rare", "Rare Card" - and its pips), the name in
// the tier's colour with a count where more than one came ("x3"), what it is under it ("Longsword", "Unit card"), and -
// the codex's first find of a Legendary record - "New to your codex". The tier's edge runs down its right side; a light
// sweeps it once as it lands. A BIG one stands taller, its picture larger, glowing, and holds longer.
//
// THE LAW: three standing at most, the newest on top; each holds LOOT_BANNER_HOLD_MS (a big one LOOT_BANNER_BIG_HOLD_MS)
// and slides out; what arrives while three stand waits, the best tier first, at most LOOT_BANNER_PENDING_MAX. A second
// card of a kind whose banner stands or waits adds to its count. Its clock is the frame's and takes the HUD's hide gate
// (ui/hud.js drawHud, beside the revenant's cards and the herald): under a window - the loot window, a shop's counter,
// the Broker's - it stands hidden and nothing ages, so a piece bought or taken there is announced when the window goes.
// A piece no longer held when its turn comes (a zone remains the room gave to another) never stands.
//
// ENHANCED PLUS ONLY. The classic skin is Daggerfall's: nothing here builds a node or a sheet there (AUDIT 39's law) - the
// watcher still reads and marks, so a skin switched later finds nothing stale. The HUD-MOVE layer moves the stack like
// any HUD piece (ui/hudLayout.js 'loot'); left where the sheet stands it, it steps below the notice stack rather than
// over it. Reduced motion: no slide, no sweep, no glow.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import { createAcquireWatch, setCodexFindPresenter, tierIsBig, tierRank, isAcquired, announces } from '../systems/acquireWatch.js';
import { tierLabel, RARITIES } from '../systems/lootRarity.js';
import { isIliacCard } from '../systems/iliacItems.js';
import { cardById } from '../net/iliacCards.js';
import { itemLongName } from '../systems/itemInfo.js';
import { inventoryItemImage, templateByIndex } from '../systems/itemTemplates.js';
import { paintIliacCard, ILIAC_CARD_ASPECT } from '../render/iliacCardFaces.js';
import { requestFittedIcon, fittedImg } from './textureCanvas.js';
import { screenDpr } from './iconFit.js';
import { PIXEL_STACK, PIXEL_FONT_CSS, PIXELIFY_FIVE_FACE, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';
import { rarityVarsCss } from './enhancedPlusStyle.js';
import { FRAME_TONES, PLUS_THEMES, hudVeil } from './enhancedFrame.js';
import { armDrawWatchdog, disarmDraw } from './drawWatchdog.js';
import { sweepHudLayout } from './hudLayout.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { enhancedSoundsOn } from '../systems/enhancedSounds.js';

export const LOOT_BANNER_STYLE_ID = 'loot-banner-css';
export const LOOT_BANNER_STACK_ID = 'loot-banners';
/** Three banners stand at most; the rest wait. */
export const LOOT_BANNERS_MAX = 3;
/** What waits behind them, at most - the lowest tiers go past it. */
export const LOOT_BANNER_PENDING_MAX = 12;
/** A banner's hold once it has landed, and a big one's. */
export const LOOT_BANNER_HOLD_MS = 4500;
export const LOOT_BANNER_BIG_HOLD_MS = 7000;
/** The slide in and out (the notices' own, ui/enhancedNotice.js NOTICE_SLIDE_MS). */
export const LOOT_BANNER_SLIDE_MS = 260;
/** The picture's box, CSS pixels, and a big banner's. */
export const LOOT_BANNER_ICON_BOX = 40;
export const LOOT_BANNER_BIG_ICON_BOX = 56;
/** The clear space kept between the stack and the notice stack, and under it at the window's foot, CSS pixels. */
export const LOOT_BANNER_GAP = 10;
const WATCHDOG_MS = 400;

// ── THE ENTRY ───────────────────────────────────────────────────────

let _uid = 0;
const _ids = new WeakMap();
const idOf = (item) => { let id = _ids.get(item); if (id == null) { id = ++_uid; _ids.set(item, id); } return id; };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/** The kicker's words: a card's tier and "Card"; any other piece the pack's own tier label (lootRarity.js tierLabel). */
export function bannerKicker(item, tier) {
  if (isIliacCard(item)) return `${RARITIES[tier]?.label ?? cap(tier)} Card`;
  try { return tierLabel(item); } catch { return RARITIES[tier]?.label ?? cap(tier); }
}
/** What it is, under the name: a card's kind ("Unit card"), any other piece its template's name ("Longsword"). */
export function bannerSub(item) {
  if (isIliacCard(item)) { const c = cardById(item.card); return c ? `${cap(c.kind)} card` : 'Card'; }
  return templateByIndex(item?.templateIndex)?.name ?? '';
}

/**
 * ONE ARRIVAL AS A BANNER'S DATA - snapshotted when it arrives (systems/acquireWatch.js `{ item, count, tier }`), so the
 * banner says what came even after the piece changes. Its KEY makes two arrivals one banner: a card is its card (a
 * second Wereboar adds to the first's count), any other piece itself.
 */
export function bannerEntry(arrival, identity = undefined) {
  const item = arrival?.item;
  const tier = arrival?.tier;
  if (!item || !RARITIES[tier]) return null;
  const count = Math.max(1, Math.trunc(Number(arrival.count) || 1));
  const card = isIliacCard(item) ? cardById(item.card) : null;
  let name = '';
  try { name = card ? card.name : itemLongName(item); } catch { name = ''; }
  return {
    key: card ? `card\u0002${item.card}` : `item\u0002${idOf(item)}`,
    item, card: card ? item.card : null,
    tier, name: name || item.name || 'Item', kicker: bannerKicker(item, tier), sub: bannerSub(item),
    exalted: tier === 'legendary' && item.exalted === true, big: tierIsBig(tier),
    count, codex: false, image: card ? null : imageOf(item, identity),
  };
}
function imageOf(item, identity) {
  try { return inventoryItemImage(item, identity) ?? null; } catch { return null; }
}

// ── THE LAW ─────────────────────────────────────────────────────────

/**
 * THE BANNERS' LAW, PURE: `push(entries)` what arrived, `tick(ms, { canEnter })` the frame's clock, `standing()` what
 * stands (the newest first), `pending()` what waits. `tick` answers `{ entered, gone }` - the banners that took a place
 * this tick and those whose slide out ended.
 *  - A pushed entry whose key matches a banner standing (not leaving) adds its count to it and restarts its hold; one
 *    matching a waiting entry adds to that. Otherwise it waits.
 *  - What waits is ordered by tier, the best first (a stable sort: one tier keeps its arrival order); past `pendingMax`
 *    the last go.
 *  - A banner holds its hold, then slides out over `slide`. While fewer than `max` stand that are not leaving, the next
 *    in waiting takes a place - unless `canEnter(entry)` says no (it is no longer held), and it is dropped.
 */
export function createBannerQueue({ max = LOOT_BANNERS_MAX, hold = LOOT_BANNER_HOLD_MS, bigHold = LOOT_BANNER_BIG_HOLD_MS, slide = LOOT_BANNER_SLIDE_MS, pendingMax = LOOT_BANNER_PENDING_MAX } = {}) {
  let seq = 0;
  /** @type {any[]} */
  let standing = [];
  /** @type {any[]} */
  let waiting = [];
  const holdOf = (e) => (e.big ? bigHold : hold);
  return {
    push(entries) {
      let added = false;
      for (const e of entries ?? []) {
        if (!e?.key || !(e.count > 0)) continue;
        const s = standing.find((c) => c.key === e.key && c.outMs == null);
        if (s) { s.count += e.count; s.leftMs = holdOf(s); s.bumps += 1; s.codex = s.codex || !!e.codex; added = true; continue; }
        const w = waiting.find((c) => c.key === e.key);
        if (w) { w.count += e.count; w.codex = w.codex || !!e.codex; added = true; continue; }
        waiting.push({ ...e, id: ++seq, bumps: 0, leftMs: 0, outMs: null });
        added = true;
      }
      waiting = waiting.map((e, i) => [e, i]).sort((a, b) => tierRank(b[0].tier) - tierRank(a[0].tier) || a[1] - b[1]).map(([e]) => e).slice(0, Math.max(0, pendingMax));
      return added;
    },
    /** @param {number} ms @param {{ canEnter?: (e: any) => boolean }} [o] */
    tick(ms, { canEnter = (_e) => true } = {}) {
      const step = Math.max(0, Number(ms) || 0);
      for (const c of standing) {
        if (c.outMs != null) { c.outMs -= step; continue; }
        c.leftMs -= step;
        if (c.leftMs <= 0) c.outMs = slide;
      }
      const gone = standing.filter((c) => c.outMs != null && c.outMs <= 0);
      standing = standing.filter((c) => !gone.includes(c));
      const entered = [];
      while (waiting.length && standing.filter((c) => c.outMs == null).length < Math.max(1, max)) {
        const e = waiting.shift();
        if (!canEnter(e)) continue;
        e.leftMs = holdOf(e);
        e.outMs = null;
        standing.unshift(e);
        entered.push(e);
      }
      return { entered, gone };
    },
    /** The entry standing or waiting for `item` (the codex's door), or null. */
    find(item) { return standing.find((c) => c.item === item && c.outMs == null) ?? waiting.find((c) => c.item === item) ?? null; },
    standing() { return standing.slice(); },
    pending() { return waiting.slice(); },
    get size() { return standing.length + waiting.length; },
    clear() { standing = []; waiting = []; },
  };
}

/** Whether `entity` still holds what an entry stands for - the record itself, or (a card) any record of its card. */
export function bannerStillHeld(entity, entry) {
  for (const list of [entity?.items, entity?.wagonItems, entity?.bagItems]) {
    if (!Array.isArray(list)) continue;
    for (const it of list) {
      if (it === entry.item) return true;
      if (entry.card && isIliacCard(it) && it.card === entry.card) return true;
    }
  }
  return false;
}

/**
 * WHERE THE STACK STANDS, pure, CSS pixels. Its top is `base` (the sheet's own, 60% down the window); a notice stack in
 * the way (`notice`: its top and bottom, or null) puts it under the notices; and the window's foot (`lower`) is never
 * passed - a band too short for every banner shows the newest (they come first). `heights` the banners' own, newest
 * first. Answers `{ top, shown }`; one banner always shows.
 * @param {{ base?: number, notice?: { top: number, bottom: number } | null, lower?: number, heights?: number[], gap?: number, cardGap?: number }} [o]
 */
export function bannerLayout({ base, notice = null, lower = Infinity, heights = [], gap = LOOT_BANNER_GAP, cardGap = 8 } = {}) {
  const total = (n) => { let h = 0; for (let i = 0; i < n; i++) h += heights[i] ?? 0; return n > 0 ? h + (n - 1) * cardGap : 0; };
  let top = Number.isFinite(base) ? base : 0;
  let shown = heights.length;
  if (notice && Number.isFinite(notice.top) && Number.isFinite(notice.bottom) && notice.bottom > notice.top) {
    if (top < notice.bottom + gap && top + total(shown) > notice.top - gap) top = notice.bottom + gap;
  }
  if (Number.isFinite(lower)) while (shown > 1 && top + total(shown) > lower) shown -= 1;
  return { top, shown };
}

// ── THE SHEET ───────────────────────────────────────────────────────
//
// The pickup feed's dress (ui/pickupFeed.js) - its veil, its stone bevel, its ring - so the two read as one family, at
// the notices' size; the tier colours are the RARITY-UI table's, scoped to the stack; each Plus theme tints the veil as
// it tints the feed's; and it scales with the HUD (--hud-scale, read off `.hud` as the feed reads it).
const T = FRAME_TONES;
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16)).join(',');
const THEME_TINTS = Object.entries(PLUS_THEMES).filter(([, th]) => /** @type {any} */ (th).panel)
  .map(([id, th]) => `:root[data-plus-theme="${id}"] .lootbanner { background-color: rgba(${rgbOf(hudVeil(th))}, 0.92); }`).join('\n');

export const LOOT_BANNER_CSS = `${PIXELIFY_FIVE_FACE}
/* LOOT-BANNER: a rare-or-better piece arrived (ui/lootBanner.js) */
.lootbanner-stack { position: fixed; right: calc(12px + var(--ui-pillar, 0px) + env(safe-area-inset-right, 0px)); top: var(--lb-top, 60vh);
  z-index: 31; pointer-events: none; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
  width: min(360px, calc((100vw - 24px) / var(--hud-scale, 1))); transform: scale(var(--hud-scale, 1)); transform-origin: top right;
  ${PIXEL_FONT_CSS} color: #d8cfae; text-shadow: ${PIXEL_TEXT_SHADOW}; }
.lootbanner-stack.lb-hidden { visibility: hidden; }
${rarityVarsCss('.lootbanner-stack ')}
.lootbanner { position: relative; box-sizing: border-box; width: 100%; overflow: hidden;
  display: grid; grid-template-columns: ${LOOT_BANNER_ICON_BOX + 6}px 1fr; gap: 10px; align-items: center; padding: 5px 12px 5px 5px;
  background-color: rgba(10,12,17,0.92); border: 2px solid; border-right-width: 5px;
  border-color: ${T.stoneLit} var(--rar, ${T.brass}) ${T.stoneDark} ${T.stoneMid};
  background-image: linear-gradient(270deg, rgba(var(--rar-rgb, 192,138,62),0.22), rgba(var(--rar-rgb, 192,138,62),0) 62%);
  box-shadow: 0 0 0 1px ${T.outline}, 2px 2px 0 1px rgba(0,0,0,0.25);
  transform: translateX(calc(100% + 24px)); opacity: 0;
  transition: transform ${LOOT_BANNER_SLIDE_MS}ms cubic-bezier(.2,.8,.2,1), opacity ${LOOT_BANNER_SLIDE_MS}ms ease-out; }
.lootbanner.lb-in { transform: none; opacity: 1; }
.lootbanner.lb-out { transform: translateX(calc(100% + 24px)); opacity: 0; }
.lootbanner.lb-over { display: none; }
/* the light that sweeps it once as it lands */
.lootbanner::after { content: ''; position: absolute; top: 0; bottom: 0; left: -40%; width: 30%; pointer-events: none;
  background: linear-gradient(100deg, transparent, rgba(var(--rar-rgb, 255,255,255),0.32), transparent); opacity: 0; }
.lootbanner.lb-in::after { animation: lb-sweep 900ms ease-out 120ms 1; }
.lb-icon { box-sizing: border-box; width: ${LOOT_BANNER_ICON_BOX + 6}px; height: ${LOOT_BANNER_ICON_BOX + 6}px;
  display: flex; align-items: center; justify-content: center; border: 2px solid;
  border-color: var(--rar-hi, ${T.stoneMid}) var(--rar-lo, ${T.stoneDark}) var(--rar-lo, ${T.stoneDark}) var(--rar-hi, ${T.stoneMid});
  background: radial-gradient(ellipse at 50% 115%, rgba(var(--rar-rgb, 0,0,0),0.45), transparent 70%), rgba(0,0,0,0.5); }
.lb-icon img { display: block; max-width: ${LOOT_BANNER_ICON_BOX}px; max-height: ${LOOT_BANNER_ICON_BOX}px; image-rendering: pixelated; }
.lb-icon canvas { display: block; height: ${LOOT_BANNER_ICON_BOX}px; width: auto; }
.lb-text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.lb-kicker { font-size: 10px; line-height: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--rar-hi, ${T.brassHi}); white-space: nowrap; }
.lb-kicker::after { content: var(--rar-pips, ''); margin-left: 6px; letter-spacing: 0.05em; color: var(--rar, ${T.brass}); }
.lb-name { font-size: 16px; line-height: 19px; color: var(--rar, #e9e4d9); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lb-count { margin-left: 6px; font-size: 12px; color: ${T.brassHi}; }
.lb-count:empty { display: none; }
.lb-count.bump-a { animation: lb-bump-a 180ms ease-out; }
.lb-count.bump-b { animation: lb-bump-b 180ms ease-out; }
.lb-sub { font-size: 11px; line-height: 13px; color: ${T.stoneHi}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb-sub:empty { display: none; }
.lb-codex { align-self: flex-start; margin-top: 2px; padding: 0 5px; font-size: 9px; line-height: 13px; letter-spacing: 0.12em; text-transform: uppercase;
  color: ${T.brassHi}; border: 1px solid ${T.brass}; }
.lb-codex[hidden] { display: none; }
.lb-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
/* THE TOP TIERS (Aetheric, Artifact, Gilded): taller, the picture larger, the edge wider, a glow that breathes twice */
.lootbanner.lb-big { grid-template-columns: ${LOOT_BANNER_BIG_ICON_BOX + 6}px 1fr; gap: 12px; padding: 8px 14px 8px 7px; border-right-width: 8px;
  box-shadow: 0 0 0 1px ${T.outline}, 0 0 18px rgba(var(--rar-rgb),0.55), inset 0 0 24px rgba(var(--rar-rgb),0.16); }
.lootbanner.lb-big.lb-in { animation: lb-glow 1600ms ease-in-out 280ms 2; }
.lootbanner.lb-big .lb-icon { width: ${LOOT_BANNER_BIG_ICON_BOX + 6}px; height: ${LOOT_BANNER_BIG_ICON_BOX + 6}px; }
.lootbanner.lb-big .lb-icon img { max-width: ${LOOT_BANNER_BIG_ICON_BOX}px; max-height: ${LOOT_BANNER_BIG_ICON_BOX}px; }
.lootbanner.lb-big .lb-icon canvas { height: ${LOOT_BANNER_BIG_ICON_BOX}px; }
.lootbanner.lb-big .lb-kicker { font-size: 11px; line-height: 14px; }
.lootbanner.lb-big .lb-name { font-size: 20px; line-height: 24px; }
@keyframes lb-sweep { from { left: -40%; opacity: 1; } to { left: 110%; opacity: 0.4; } }
@keyframes lb-glow { 0%, 100% { box-shadow: 0 0 0 1px ${T.outline}, 0 0 18px rgba(var(--rar-rgb),0.55), inset 0 0 24px rgba(var(--rar-rgb),0.16); }
  50% { box-shadow: 0 0 0 1px ${T.outline}, 0 0 34px rgba(var(--rar-rgb),0.9), inset 0 0 30px rgba(var(--rar-rgb),0.3); } }
@keyframes lb-bump-a { from { transform: scale(1.35); } to { transform: none; } }
@keyframes lb-bump-b { from { transform: scale(1.35); } to { transform: none; } }
.lb-count { display: inline-block; transform-origin: center; }
/* moved off the edge by HUD-MOVE, a banner fades where it stands (the notices' MOVED-NOTICE law) */
.lootbanner-stack[data-hm-moved] > .lootbanner { transform: none; }
@media (prefers-reduced-motion: reduce) {
  .lootbanner, .lootbanner.lb-out { transform: none; transition: opacity 1ms; }
  .lootbanner::after, .lootbanner.lb-big.lb-in, .lb-count { animation: none !important; } }
@media (max-width: 520px) { .lootbanner-stack { width: min(300px, calc((100vw - 24px) / var(--hud-scale, 1))); } .lb-name { font-size: 14px; } .lootbanner.lb-big .lb-name { font-size: 17px; } }
${THEME_TINTS}
/* font: ${PIXEL_STACK} */`;

// ── THE FACE ────────────────────────────────────────────────────────

const watch = createAcquireWatch();
const queue = createBannerQueue();
/** entry id -> { el, num, codex, bumps } - what is drawn */
const drawn = new Map();
let _stack = null;
let _watchdog = null;
let _entity = null;
let _faultSaid = false;
let _lastTop = null, _lastScale = null;
/** Pieces the codex announced before the watcher saw them (a take tells the codex inside the press): their banner
 *  says so. */
const _codexNew = new WeakSet();
let _icon = (image, box, onReady) => requestFittedIcon(image.archive, image.record, { box, dpr: screenDpr(), dye: image.dye, dyeTarget: image.dyeTarget, onReady });
let _play = (clip) => { try { audio.playOneShot?.(clip, 1); } catch { /* silence */ } };
let _wd = {};

/** Tests and the probe: the picture's door, the sound's, and the watchdog's timers. */
export function _setLootBannerForTests({ icon, play, schedule, cancel } = /** @type {any} */ ({})) {
  if (icon !== undefined) _icon = icon ?? ((image, box, onReady) => requestFittedIcon(image.archive, image.record, { box, dpr: screenDpr(), dye: image.dye, dyeTarget: image.dyeTarget, onReady }));
  if (play !== undefined) _play = play ?? ((clip) => { try { audio.playOneShot?.(clip, 1); } catch { /* silence */ } });
  if (schedule !== undefined || cancel !== undefined) _wd = { ...(schedule ? { schedule } : {}), ...(cancel ? { cancel } : {}) };
}

const docOf = () => (typeof document === 'undefined' ? null : document);

function ensureStyle(d) {
  if (!d.getElementById?.(LOOT_BANNER_STYLE_ID)) {
    const st = d.createElement('style');
    st.id = LOOT_BANNER_STYLE_ID;
    st.textContent = LOOT_BANNER_CSS;
    (d.head ?? d.body).append(st);
  }
}
/** The stack, made when a banner first needs it and taken down with the last (the revenant's cards' way); placed where
 *  the player moved it at once, not at the next sweep. */
function ensure(d) {
  if (_stack && _stack.isConnected !== false) return _stack;
  ensureStyle(d);
  _stack = d.createElement('div');
  _stack.id = LOOT_BANNER_STACK_ID;
  _stack.className = 'lootbanner-stack';
  _stack.setAttribute('aria-live', 'polite');
  _stack.setAttribute('role', 'log');
  d.body.append(_stack);
  _lastTop = null; _lastScale = null;
  try { sweepHudLayout(d); } catch { /* the sheet's own place */ }
  return _stack;
}
function takeDown() {
  disarmDraw(_watchdog); _watchdog = null;
  for (const c of drawn.values()) { try { c.el.remove(); } catch { /* gone */ } }
  drawn.clear();
  if (_stack) { try { _stack.remove(); } catch { /* gone */ } }
  _stack = null;
}

const el = (d, tag, cls, text = null) => { const n = d.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
const countText = (n) => (n > 1 ? `×${n}` : '');

function build(d, e) {
  const node = el(d, 'div', e.big ? 'lootbanner lb-big' : 'lootbanner');
  node.dataset.rarity = e.tier;
  if (e.exalted) node.dataset.exalted = '';
  const icon = el(d, 'div', 'lb-icon');
  icon.setAttribute('aria-hidden', 'true');
  const text = el(d, 'div', 'lb-text');
  text.setAttribute('aria-hidden', 'true');
  const kicker = el(d, 'div', 'lb-kicker', e.kicker);
  const name = el(d, 'div', 'lb-name', e.name);
  const num = el(d, 'span', 'lb-count', countText(e.count));
  name.append(num);
  const sub = el(d, 'div', 'lb-sub', e.sub);
  const codex = el(d, 'div', 'lb-codex', 'New to your codex');
  codex.hidden = !e.codex;
  text.append(kicker, name, sub, codex);
  const sr = el(d, 'span', 'lb-sr', `Acquired: ${e.kicker} ${e.name}${e.count > 1 ? `, ${e.count}` : ''}`);
  node.append(icon, text, sr);
  setPicture(icon, e);
  return { el: node, num, codex, bumps: 0, count: e.count };
}

/** The picture: a card's own face, painted; any other piece the pack's fitted icon now, or once it lands (a banner gone
 *  by then takes nothing). A piece with no picture stands on its words in an empty well. */
function setPicture(icon, e) {
  const box = e.big ? LOOT_BANNER_BIG_ICON_BOX : LOOT_BANNER_ICON_BOX;
  if (e.card) {
    try {
      const c = icon.ownerDocument?.createElement?.('canvas');
      const ctx = c?.getContext?.('2d');
      if (!ctx) return;
      const h = box * 2, w = Math.round(h * ILIAC_CARD_ASPECT);
      c.width = w; c.height = h;
      paintIliacCard(ctx, cardById(e.card), w, h);
      icon.append(c);
    } catch { /* the words stand */ }
    return;
  }
  if (!e.image || e.image.archive == null) return;
  const put = (pic) => {
    if (!pic?.src) return false;
    const img = fittedImg(pic);
    if (icon.replaceChildren) icon.replaceChildren(img); else icon.append(img);
    return true;
  };
  try { put(_icon(e.image, box, () => { if (icon.isConnected !== false) { try { put(_icon(e.image, box, null)); } catch { /* the words stand */ } } })); } catch { /* the words stand */ }
}

/** Where the stack stands this frame (see bannerLayout). Reads every rect, then writes - one layout. */
function place(d) {
  if (!_stack) return;
  const win = globalThis;
  const vh = Number(win.innerHeight) || 0;
  const scale = Number.parseFloat(d.querySelector?.('.hud')?.style?.getPropertyValue?.('--hud-scale')) || 1;
  const s = String(scale);
  if (s !== _lastScale) { _lastScale = s; _stack.style.setProperty('--hud-scale', s); }
  if (_stack.hasAttribute?.('data-hm-moved')) {   // HUD-MOVE put it somewhere: the sheet's place, moved - no dodging
    if (_lastTop !== '') { _lastTop = ''; _stack.style.removeProperty?.('--lb-top'); }
    return;
  }
  const rect = (n) => { const r = n?.getBoundingClientRect?.(); return r && r.height > 0 ? r : null; };
  let notice = null;
  for (const n of d.querySelectorAll?.('.notice-stack') ?? []) {
    if (n.hasAttribute?.('data-hm-ghost') || !n.children?.length) continue;
    const r = rect(n);
    if (r) notice = { top: r.top, bottom: r.bottom };
  }
  const kids = [..._stack.children ?? []];
  const heights = kids.map((k) => { const r = rect(k); if (r) k._lbH = r.height; return (r?.height ?? k._lbH ?? 0); });
  const { top, shown } = bannerLayout({ base: vh * 0.6, notice, lower: vh - LOOT_BANNER_GAP, heights, cardGap: 8 * scale });
  const t = `${top.toFixed(1)}px`;
  if (t !== _lastTop) { _lastTop = t; _stack.style.setProperty('--lb-top', t); }
  for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('lb-over', i >= shown);
}

/**
 * ONE FRAME (ui/hud.js drawHud, every host): read what arrived in `entity`'s keeping (the watcher marks what it reads,
 * on any skin), queue its banners (Enhanced Plus), and draw them - `hidden`, the HUD's hide gate, stands the stack
 * hidden with its clock still. Answers the banners standing and waiting.
 */
export function drawLootBanners({ entity = null, hidden = false, dt = 0, doc = docOf() } = {}) {
  try {
    if (entity) {
      _entity = entity;
      const arrivals = watch.observe(entity);
      if (arrivals.length && doc?.body && isEnhanced()) {   // the classic skin: read and marked, never queued
        const entries = arrivals.map((a) => bannerEntry(a, entity)).filter(Boolean);
        for (const e of entries) if (_codexNew.has(e.item)) { e.codex = true; _codexNew.delete(e.item); }
        queue.push(entries);
      }
    }
    if (!queue.size) { if (_stack) takeDown(); return 0; }
    if (!doc?.body) return queue.size;
    const stack = ensure(doc);
    stack.classList.toggle('lb-hidden', !!hidden);
    disarmDraw(_watchdog);
    _watchdog = armDrawWatchdog(WATCHDOG_MS, () => { _watchdog = null; if (_stack) _stack.classList.add('lb-hidden'); }, _wd);
    if (hidden) return queue.size;
    const held = _entity;
    const { entered, gone } = queue.tick(Math.max(0, Number(dt) || 0) * 1000, { canEnter: (e) => !held || bannerStillHeld(held, e) });
    paint(doc, entered, gone);
    sound(entered);
    if (!queue.size) { takeDown(); return 0; }
    place(doc);
    return queue.size;
  } catch (e) {
    if (!_faultSaid) { _faultSaid = true; console.warn(`[loot-banner] a frame failed; the banners are taken down: ${e?.message ?? e}`); }
    try { queue.clear(); takeDown(); } catch { /* gone */ }
    return 0;
  }
}

function paint(d, entered, gone) {
  for (const e of gone) { const c = drawn.get(e.id); if (c) { try { c.el.remove(); } catch { /* gone */ } drawn.delete(e.id); } }
  for (const e of entered) {
    const c = build(d, e);
    drawn.set(e.id, c);
    _stack.insertBefore(c.el, _stack.firstChild ?? null);
    void c.el.offsetWidth;   // the slide starts from off the edge
    c.el.classList.add('lb-in');
  }
  for (const e of queue.standing()) {
    const c = drawn.get(e.id);
    if (!c) continue;
    if (e.outMs != null && !c.el.classList.contains('lb-out')) { c.el.classList.remove('lb-in'); c.el.classList.add('lb-out'); }
    if (c.count !== e.count) { c.count = e.count; c.num.textContent = countText(e.count); }
    if (c.bumps !== e.bumps) { c.bumps = e.bumps; c.num.classList.remove('bump-a', 'bump-b'); c.num.classList.add(e.bumps % 2 ? 'bump-a' : 'bump-b'); }
    if (c.codex.hidden === !!e.codex) c.codex.hidden = !e.codex;
  }
}

/** One sound for a frame's landings: the top tiers' fanfare (the port's own sound - its switch, enhancedSounds.js), else
 *  the codex's own chime for a first find (lootCodex.js noteFind played it before the banner took its words). */
function sound(entered) {
  if (!entered.length) return;
  if (entered.some((e) => e.big) && enhancedSoundsOn()) { _play(SOUND.ArenaFanfareLevelUp); return; }
  if (entered.some((e) => e.codex)) _play(SOUND.LevelUp);
}

/** THE CODEX'S DOOR (systems/lootCodex.js noteFind, through systems/acquireWatch.js): a first find of a Legendary record
 *  is the banner's to say on Enhanced Plus - on the banner standing or waiting for it, or on the one the watcher will
 *  raise (the take told the codex before the frame read the pack). Declined - and the codex says its line - on the
 *  classic skin, for a piece already read whose banner has gone, and for one no frame will read (no host has drawn, or
 *  it is not in the keeping of the player the last frame read). */
export function bannerCodexFind(item) {
  if (!item || !isEnhanced() || !announces(item)) return false;
  const e = queue.find(item);
  if (e) { e.codex = true; const c = drawn.get(e.id); if (c) c.codex.hidden = false; return true; }
  // only a piece the watcher will read next frame: in the keeping of the player it last read, and not read yet
  if (isAcquired(item) || !_entity || !bannerStillHeld(_entity, { item, card: null })) return false;
  _codexNew.add(item);
  return true;
}
setCodexFindPresenter(bannerCodexFind);

/** Every banner down at once; the watcher keeps its baseline. */
export function clearLootBanners() { queue.clear(); takeDown(); }
/** Tests: what stands and waits, as the law reads it. */
export const _lootBanners = () => ({
  standing: queue.standing().map((e) => ({ name: e.name, tier: e.tier, kicker: e.kicker, count: e.count, big: e.big, codex: e.codex, out: e.outMs != null })),
  pending: queue.pending().map((e) => ({ name: e.name, tier: e.tier, count: e.count })),
});
export function _resetLootBannersForTests() { clearLootBanners(); watch.reset(); _entity = null; _faultSaid = false; }

/** HUD-MOVE's preview (ui/hudLayout.js): a banner standing where the real ones will, while the UI is unlocked. */
export function buildLootBannerPreview(doc) {
  ensureStyle(doc);
  const stack = doc.createElement('div');
  stack.className = 'lootbanner-stack';
  const { el: node } = build(doc, { tier: 'legendary', big: false, exalted: true, kicker: 'Exalted Legendary', name: 'Loot banners (preview)', sub: 'Longsword', count: 1, codex: false, image: null, card: null });
  node.classList.add('lb-in');
  stack.append(node);
  return stack;
}
