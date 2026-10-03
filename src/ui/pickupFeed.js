// PICKUP-FEED (2026-10-01, Mac: "a better center screen notification for pickups") - WHAT A PRESS PUT IN THE PACK, AS
// CARDS AT THE CENTRE OF THE SCREEN, ON THE ENHANCED SKIN.
//
// A quick-loot take was SAID: "You take the Longsword.", "You take 3 items." - DaggerfallHUD's line, through whatever
// say the host hands the take (the HUD's popup line in the three outdoor and interior hosts, the mid-screen label in the
// dungeon). A line says THAT something moved; it does not say WHAT, in what tier, or how many - a take-all of a body
// said one count and named nothing. So on the enhanced skin each thing that moved is a CARD under the crosshair: its
// icon, "+" and its name in its rarity's colour, a count when there is more than one ("x24"), gold as "+120 Gold".
//
// WHAT IT IS NOT, AND WHY:
//   - NOT the classic skin's. The classic skin is Daggerfall's, and Daggerfall says the line - `showPickups` answers
//     false there, the take says its words exactly as before, and nothing here touches the classic page's DOM (no
//     node, no sheet: AUDIT 39's law, the plaque's own).
//   - NOT a refusal. "You cannot carry any more stuff." is a sentence about the PRESS, not a thing in the pack, and it
//     is still said where it always was - a take-all that took two rows and refused the third shows two cards AND says
//     the refusal (systems/quickLoot.js quickLootTake).
//   - NOT the loot window's. A row dragged out of the big window is seen moving in the window; the feed is for the
//     takes that have no window to show them.
//
// THE LAW IS PURE (`createPickupQueue`): push a press's pickups, tick the clock, read the lines. The same thing taken
// again while its card still stands BUMPS that card's count rather than adding a second; four cards at most; each
// holds PICKUP_FEED_HOLD_MS, then fades over PICKUP_FEED_FADE_MS; the newest stands nearest the centre - a press's own
// pickups in the pile's order, the first row nearest, as the plaque listed them.
//
// THE FACE IS ONE NODE, UPDATED ON CHANGE (the plaque's own rule - a per-frame rebuild of a DOM list is the entrance-
// replay bug): a card is built once, its count rewritten on a bump, its node removed when it expires. It keeps its
// OWN clock - an animation-frame ticker that runs only while a card stands - because a pickup is told once, by the
// take, and no host draws it a frame at a time; and a draw watchdog over that ticker (ui/drawWatchdog.js, the plaque's
// DISC29-D law) takes it down if the ticker ever stops drawing, so a card can never be stranded over the game. One
// owner: freed with the host that raised it, through the plaque's teardown every host already calls
// (ui/worldPlaque.js destroyWorldPlaque, beside quick loot's own reset).
//
// WHERE IT STANDS: on the mid-screen label's own line (the classic label's top edge, ui/enhancedHudText.js
// midTextTopPx), centred - in the BAND between what stands under the crosshair and what stands at the foot. Above it:
// the plaque (which is still listing the pile the press took from), its stat panel, the profession act's panel, and the
// mid-screen line itself while it says something (a refusal said beside the cards). Below it: the HUD's bottom block
// (the vitals and the hotbar), a profession's prompt, a docked large HUD. A stack too tall for the room under the line
// rises toward the crosshair; a band too short for every card shows the newest (pickupFeedLayout). Measured each frame
// a card stands, so a plaque that grows or shrinks as the player looks along a pile carries the feed with it rather
// than covering it. tools/pickupFeedProbe.mjs photographed the first cut's fourth card under the hotbar at 1280x800.
import { isEnhanced } from '../systems/uiSkin.js';
import { itemNameParts } from '../systems/itemInfo.js';   // RF6: the long name's name part - the word the plaque's row and the take's line both wear
import { rarityAttr } from '../systems/lootRarity.js';   // LR1: the tier the plaque's row wears
import { isGoldPieces } from '../systems/inventory.js';
import { inventoryItemImage } from '../systems/itemTemplates.js';
import { requestFittedIcon, fittedImg } from './textureCanvas.js';   // UI1: the pack's own fitted, cached icon door - decoded once, never per frame
import { screenDpr } from './iconFit.js';
import { PIXEL_STACK, PIXEL_FONT_CSS, PIXELIFY_FIVE_FACE, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';
import { rarityVarsCss } from './enhancedPlusStyle.js';   // RARITY-UI: the tiers' colours, the one table
import { FRAME_TONES, PLUS_THEMES } from './enhancedFrame.js';
import { midScreenText } from './midScreenText.js';
import { ENHANCED_MID_TEXT_ID, midTextTopPx } from './enhancedHudText.js';
import { crosshairCentreY, CROSSHAIR_ARM } from './hudCrosshair.js';
import { hudReticle } from './hud.js';   // the reticle's own two terms, from their home (the plaque's anchor reads the same)
import { armDrawWatchdog, disarmDraw } from './drawWatchdog.js';
import { haulWords, HAUL_ICON_BOX, LODE_ICON_BOX } from './haulCards.js';   // HAUL-CARDS: a gather's, a strike's and a claim's cards - their words

/** Four cards at most (the oldest goes past four). */
export const PICKUP_FEED_MAX = 4;
/** A card stands this long at full strength after its last pickup... */
export const PICKUP_FEED_HOLD_MS = 2500;
/** ...then fades over this long, and is gone. A pickup of the same thing while its card stands (fading or not) bumps it. */
export const PICKUP_FEED_FADE_MS = 400;
/** The clear space kept between the feed and anything standing above or below it, CSS pixels at HUD scale 1. */
export const PICKUP_FEED_GAP = 8;
/** The clear space kept under the feed at the window's foot. */
export const PICKUP_FEED_MARGIN = 8;
/** The clearance under the cross's lower arm - the plaque's own (ui/worldPlaque.js PLAQUE_GAP): with nothing under the
 *  crosshair, the feed may rise no nearer it than a plaque would hang. */
export const PICKUP_CROSS_GAP = 18;
/** The space between two cards, CSS pixels at HUD scale 1 (the sheet's `gap`, and the layout's arithmetic). */
export const PICKUP_CARD_GAP = 3;
/** An icon's box, CSS pixels (the card's picture, fitted by ui/iconFit.js). */
export const PICKUP_ICON_BOX = 20;
/** The plaque's own watchdog constant (ui/worldPlaque.js PLAQUE_WATCHDOG_MS): long enough that no honest frame rate
 *  trips it, short enough that a stranded card is a blink. */
export const PICKUP_WATCHDOG_MS = 400;

export const PICKUP_FEED_ID = 'enhanced-pickupfeed';
export const PICKUP_FEED_STYLE_ID = 'enhanced-pickupfeed-style';

/** WHAT STANDS UNDER THE CROSSHAIR, which the feed stands below rather than over: the plaque (ui/worldPlaque.js
 *  `.wplaque`, `.on` while it shows) and its stat panel (absolutely placed, so it can reach past the plaque's own foot),
 *  and the profession act's panel (ui/profHud.js `.prof-meter`, hidden between acts). The mid-screen label is the
 *  fourth, while it says something - measured by its id below. */
export const PICKUP_KEEP_ABOVE = Object.freeze(['.wplaque.on', '.wplaque.on .wplaque-stats', '.prof-meter:not([hidden])']);
/** WHAT STANDS AT THE FOOT, which the feed stands above: the HUD's bottom block (ui/enhancedHud.js `.hud-bottom` - the
 *  vitals and the hotbar) and a profession's prompt over it (ui/profHud.js `.prof-prompt`, empty between nodes). A
 *  docked large HUD's bar is the third, read off the reticle's own terms (ui/hud.js hudReticle). */
export const PICKUP_KEEP_BELOW = Object.freeze(['.hud .hud-bottom', '.prof-prompt']);

/** The words a card says for one pickup, whole. Gold is "+N Gold"; anything else is "+" and its name, the count beside it. */
export const pickupCardText = (line) => (line.gold ? `+${line.count} Gold` : `+${line.name}`);
/** The count a card shows - "x3" when more than one, nothing for one (or for gold, whose count is its words). */
export const pickupCountText = (line) => (!line.gold && line.count > 1 ? `×${line.count}` : '');
/** The card's name span: an item's name (the "+" is its own brass mark before it), or gold's whole words. */
const nameText = (line) => (line.gold ? pickupCardText(line) : line.name);

/**
 * ONE PICKUP, AS A CARD'S DATA - snapshotted when it is taken, so a card says what was taken even after the item
 * changes in the pack. `item` is the record that arrived, `count` how many moved (a split stack's half, the pieces of
 * gold), `identity` the wearer whose morphology the pack draws armour in (inventoryItemImage's own second argument).
 * The KEY is what makes two pickups one card: all gold is one purse; an item is its name and its tier, the two things
 * the card shows of it.
 */
export function pickupEntry(item, count = 1, identity = undefined) {
  if (!item) return null;
  const n = Math.max(0, Math.trunc(Number(count) || 0));
  if (!n) return null;
  if (isGoldPieces(item)) return { key: 'gold', name: 'Gold', rarity: null, exalted: false, gold: true, count: n, image: imageOf(item, identity) };
  let name = '';
  try { name = itemNameParts(item).name; } catch { name = ''; }
  name = name || item.name || 'Item';
  const rarity = rarityAttr(item);
  return { key: `item\u0002${name}\u0002${rarity ?? ''}`, name, rarity, exalted: rarity === 'legendary' && item.exalted === true, gold: false, count: n, image: imageOf(item, identity) };
}
function imageOf(item, identity) {
  try { return inventoryItemImage(item, identity) ?? null; } catch { return null; }
}

/**
 * THE FEED'S LAW, PURE: `push(entries, now)` a press's pickups, `tick(now)` the clock, `standing(now)` what stands - the
 * newest first (nearest the centre), each with `fading` once its hold is spent.
 *
 *  - A pickup whose key matches a card still standing BUMPS it: the count adds, its clock restarts, and it moves to
 *    the front (it is the newest thing that happened). Two of one thing inside one press are one card.
 *  - A press's pickups go in as a block, in the order they were taken (the pile's order), the first nearest the
 *    centre.
 *  - Past `max`, the oldest go.
 */
export function createPickupQueue({ max = PICKUP_FEED_MAX, hold = PICKUP_FEED_HOLD_MS, fade = PICKUP_FEED_FADE_MS } = {}) {
  // HAUL-CARDS: a card may carry its own hold (a gather's says more than a pickup's)
  const holdOf = (c) => (Number.isFinite(c.hold) && c.hold > 0 ? c.hold : hold);
  let seq = 0;
  /** @type {any[]} */
  let cards = [];
  const tick = (now) => {
    const before = cards.length;
    cards = cards.filter((c) => now - c.at < holdOf(c) + fade);
    return cards.length !== before;
  };
  /** HAUL-CARDS: a bump's other fields - `adds` summed (a gather's XP with its goods), `latest` the newest's (the
   *  Stores' count after it, the balance, the day's combat silver). A pickup's count alone moves, as it always did. */
  const merge = (c, e) => {
    for (const f of e.adds ?? []) if (f !== 'count') c[f] = (Number(c[f]) || 0) + (Number(e[f]) || 0);
    for (const f of e.latest ?? []) if (e[f] !== undefined) c[f] = e[f];
  };
  return {
    push(entries, now) {
      tick(now);
      const block = [];
      for (const e of entries ?? []) {
        if (!e || !(e.count > 0) || !e.key) continue;
        const mine = block.find((c) => c.key === e.key);
        if (mine) { mine.count += e.count; merge(mine, e); continue; }
        const i = cards.findIndex((c) => c.key === e.key);
        if (i >= 0) {
          const c = cards.splice(i, 1)[0];
          c.count += e.count;
          merge(c, e);
          c.at = now;
          c.bumps += 1;
          block.push(c);
          continue;
        }
        block.push({ ...e, id: ++seq, at: now, born: now, bumps: 0 });
      }
      if (!block.length) return false;
      cards = [...block, ...cards].slice(0, Math.max(1, max));
      return true;
    },
    tick,
    standing(now) { return cards.map((c) => ({ ...c, fading: now - c.at >= holdOf(c) })); },
    get size() { return cards.length; },
    clear() { cards = []; },
  };
}

/**
 * WHERE THE FEED STANDS, AND HOW MANY OF ITS CARDS, pure. The feed lives in a BAND: below `upper` (the lowest edge of
 * what stands under the crosshair, its clearance already added) and above `lower` (the highest edge of what stands at
 * the foot, likewise). Its top edge is `base` - the mid-screen label's line - when the band allows; a stack too tall
 * for the room under that line rises toward `upper` rather than running into the HUD; and a band too short for every
 * card shows the newest ones (they come first) and lets the oldest - the next to fade anyway - wait unseen. One card
 * always shows. `cardH` and `cardGap` are one card's height and the space between two, as drawn. CSS pixels.
 */
export function pickupFeedLayout({ base, upper = 0, lower = Infinity, cardH = 0, cardGap = 0, count = 0, heights = null } = {}) {
  // HAUL-CARDS: a gather's card stands taller than a pickup's - each card its own height where the face measured them
  // (`heights`, newest first), else every card the first's
  const hOf = (i) => (Array.isArray(heights) && Number.isFinite(heights[i]) ? heights[i] : cardH);
  const height = (n) => { let h = 0; for (let i = 0; i < n; i++) h += hOf(i); return n > 0 ? h + (n - 1) * cardGap : 0; };
  const up = Number.isFinite(upper) ? upper : 0;
  let top = Math.max(Number.isFinite(base) ? base : up, up);
  let shown = Math.max(0, Math.trunc(count) || 0);
  if (Number.isFinite(lower)) {
    if (top + height(shown) > lower) top = Math.max(up, lower - height(shown));
    while (shown > 1 && top + height(shown) > lower) shown -= 1;
  }
  return { top, shown };
}

// ── THE SHEET ───────────────────────────────────────────────────────────────────────────────────────────────────────
//
// Its own <style>, injected once on the first card (never on a classic page): the card wears the plaque's dress - its
// veil, its stone bevel, its ring - so the two read as one surface family; the tier colours are the RARITY-UI table's,
// scoped to the feed; the face is the skin's pixel face; and it scales with the HUD (--hud-scale, read off `.hud` as the
// journey bar and the quest tracker read it). Each Plus theme tints the veil as it tints the plaque's.
const T = FRAME_TONES;
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16)).join(',');
/** AUDIT HAUL-CARDS C4: a colour's relative luminance (WCAG) - a theme whose panel is light veils the feed in its ink. */
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** AUDIT HAUL-CARDS C4: the feed is words over the world, in brass, parchment and the tiers' colours - a veil lighter than
 *  this (Stone's panel, 0.10) dropped them to 2:1; such a theme's feed wears its ink, the rest their panel as before. */
export const PICKUP_VEIL_LIGHT = 0.06;
const veilOf = (th) => (th.ink && luminance(th.panel) > PICKUP_VEIL_LIGHT ? th.ink : th.panel);
const THEME_TINTS = Object.entries(PLUS_THEMES).filter(([, th]) => th.panel)
  .map(([id, th]) => `:root[data-plus-theme="${id}"] .pickfeed-card { background-color: rgba(${rgbOf(veilOf(th))}, 0.9); }`).join('\n');

export const PICKUP_FEED_CSS = `${PIXELIFY_FIVE_FACE}
/* PICKUP-FEED: what a press put in the pack, under the crosshair (ui/pickupFeed.js) */
.pickfeed { position: fixed; left: 50%; top: var(--pf-top, 73%); z-index: 4; pointer-events: none;
  transform: translateX(-50%) scale(var(--hud-scale, 1)); transform-origin: top center;
  display: flex; flex-direction: column; align-items: stretch; gap: ${PICKUP_CARD_GAP}px; width: max-content; min-width: 168px; max-width: calc(92vw / var(--hud-scale, 1));
  ${PIXEL_FONT_CSS} }
.pickfeed:empty { display: none; }
.pickfeed-card.pf-over { display: none; }
.pickfeed-card { display: flex; align-items: center; gap: 6px; box-sizing: border-box; max-width: min(440px, calc(88vw / var(--hud-scale, 1)));
  padding: 2px 10px 2px 2px; font-size: 14px; line-height: 20px; white-space: nowrap; color: #d8cfae;
  background-color: rgba(10,12,17,0.9); border: 2px solid;
  border-color: ${T.stoneLit} ${T.stoneDim} ${T.stoneDark} ${T.stoneMid};
  box-shadow: 0 0 0 1px ${T.outline}, inset 2px 0 0 var(--pf-edge, transparent), 2px 2px 0 1px rgba(0,0,0,0.25);
  text-shadow: ${PIXEL_TEXT_SHADOW};
  animation: pickfeed-in 150ms ease-out; transition: opacity ${PICKUP_FEED_FADE_MS}ms linear; }
.pickfeed-card.fading { opacity: 0; }
.pickfeed-card.no-icon { padding-left: 10px; }
.pickfeed-icon { flex: 0 0 auto; box-sizing: border-box; width: ${PICKUP_ICON_BOX + 2}px; height: ${PICKUP_ICON_BOX + 2}px;
  display: inline-flex; align-items: center; justify-content: center; border: 1px solid;
  border-color: ${T.stoneMid} ${T.stoneDark} ${T.stoneDark} ${T.stoneMid}; background: rgba(0,0,0,0.45); }
.pickfeed-icon img { display: block; max-width: ${PICKUP_ICON_BOX}px; max-height: ${PICKUP_ICON_BOX}px; image-rendering: pixelated; }
.pickfeed-plus { color: ${T.brassHi}; margin-right: -2px; }
.pickfeed-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.pickfeed-count { color: ${T.brass}; font-size: 12px; margin-left: auto; padding-left: 6px; }
.pickfeed-count:empty { display: none; }
/* the tier: the name in its colour, the icon framed in it (lit top-left, shaded bottom-right) with its glow sunk inside,
   and its edge down the card's left side - never by colour alone: the name is the item's own word */
${rarityVarsCss('.pickfeed ')}
.pickfeed-card[data-rarity] { --pf-edge: var(--rar); }
.pickfeed-card[data-rarity] .pickfeed-name { color: var(--rar); }
.pickfeed-card[data-rarity] .pickfeed-icon { border-color: var(--rar-hi) var(--rar-lo) var(--rar-lo) var(--rar-hi);
  background: radial-gradient(ellipse at 50% 115%, rgba(var(--rar-rgb),0.4), transparent 70%), rgba(0,0,0,0.45); }
.pickfeed-card.is-gold { --pf-edge: ${T.brass}; }
.pickfeed-card.is-gold .pickfeed-name { color: ${T.brassHi}; }
/* a bump: the count says so (two names, so a second bump restarts it) */
.pickfeed-count.bump-a { animation: pickfeed-bump-a 180ms ease-out; }
.pickfeed-count.bump-b { animation: pickfeed-bump-b 180ms ease-out; }
.pickfeed-card.is-gold .pickfeed-name.bump-a { animation: pickfeed-bump-a 180ms ease-out; }
.pickfeed-card.is-gold .pickfeed-name.bump-b { animation: pickfeed-bump-b 180ms ease-out; }
@keyframes pickfeed-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }
@keyframes pickfeed-bump-a { from { color: ${T.brassHi}; transform: scale(1.3); } to { transform: none; } }
@keyframes pickfeed-bump-b { from { color: ${T.brassHi}; transform: scale(1.3); } to { transform: none; } }
.pickfeed-count, .pickfeed-name { display: inline-block; transform-origin: center; }
/* HAUL-CARDS (ui/haulCards.js): a gather's goods, a strike's silver, a claim's deed and contracts - the card's family, two
   lines: a head over the line where there is one, the XP or the day's combat silver a bar under it */
.pickfeed-card.haul { align-items: center; line-height: 18px; padding-top: 3px; padding-bottom: 3px; }
.pickfeed-card.haul .pickfeed-icon { width: 36px; height: 36px; }
.pickfeed-card.haul .pickfeed-icon img { max-width: 32px; max-height: 32px; }
.haul-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1px; }
.haul-head { font-size: 11px; line-height: 12px; letter-spacing: 1px; text-transform: uppercase; color: ${T.brass}; }
.haul-head:empty { display: none; }
.haul-line { display: flex; align-items: baseline; gap: 5px; white-space: nowrap; min-width: 0; }
.pickfeed-card.haul .pickfeed-plus { margin-right: 0; }
.haul-sub { flex: 0 1000 auto; min-width: 0; font-size: 11px; color: ${T.stoneHi}; overflow: hidden; text-overflow: ellipsis; }   /* AUDIT HAUL-CARDS C3/C5: the sub gives way first */
.pickfeed-card.haul .pickfeed-name { flex: 0 1 auto; }
.pickfeed-card.haul.is-silver .pickfeed-name, .pickfeed-card.haul.is-treasury .pickfeed-name { flex-shrink: 0; }
.haul-sub:empty, .haul-end:empty, .haul-tag:empty { display: none; }
.haul-tag { margin-left: auto; padding: 0 4px; font-size: 11px; line-height: 14px; letter-spacing: 1px; text-transform: uppercase;
  color: ${T.stoneHi}; border: 1px solid ${T.stoneLit}; }
.haul-end { margin-left: auto; padding-left: 6px; font-size: 11px; color: ${T.stoneHi}; }
.haul-row { display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 14px; color: ${T.stoneHi}; }
.haul-row[hidden] { display: none; }
.haul-bar { flex: 1 1 auto; min-width: 36px; height: 4px; background: rgba(5,6,8,0.9); box-shadow: 0 0 0 1px ${T.outline}; }
.haul-fill { display: block; height: 4px; width: 0; background: ${T.brass}; transition: width 300ms ease-out; }
.haul-coin { flex: 0 0 auto; display: inline-block; box-sizing: border-box; width: 18px; height: 18px; border-radius: 50%;
  background: #c9d1d9; box-shadow: inset 0 0 0 3px #8d97a1, 0 0 0 1px ${T.outline}; }
.haul-row .haul-coin { width: 10px; height: 10px; box-shadow: inset 0 0 0 2px #8d97a1, 0 0 0 1px ${T.outline}; }
.haul-chest { flex: 0 0 auto; display: inline-block; width: 18px; height: 14px; background: ${T.brass};
  box-shadow: inset 0 4px 0 ${T.brassHi}, inset 0 -2px 0 ${T.brassLo}, 0 0 0 1px ${T.outline}; }
.pickfeed-card.haul.is-silver { --pf-edge: #c9d1d9; }
.pickfeed-card.haul.is-silver .pickfeed-name, .pickfeed-card.haul.is-silver .pickfeed-plus { color: #eef2f5; }
.pickfeed-card.haul.is-silver .haul-fill { background: #c9d1d9; }
.pickfeed-card.haul.is-treasury { --pf-edge: ${T.brass}; }
.pickfeed-card.haul.is-treasury .pickfeed-name { color: ${T.brassHi}; }
.pickfeed-card.haul.is-note { color: ${T.stoneHi}; font-size: 13px; padding-left: 10px; white-space: normal; }   /* AUDIT HAUL-CARDS A2/C1: it wraps (59 letters ran 96 px past a phone's card); A5: its veil the theme's */
.haul-note { min-width: 0; }
.pickfeed-card.haul.is-lode { padding-top: 5px; padding-bottom: 5px;
  box-shadow: 0 0 0 1px ${T.outline}, inset 3px 0 0 var(--pf-edge, transparent), 0 0 14px rgba(var(--rar-rgb, 192,138,62),0.4); }
.pickfeed-card.haul.is-lode .haul-head { color: var(--rar-hi, ${T.brassHi}); }
.pickfeed-card.haul.is-lode .pickfeed-icon { width: 42px; height: 42px; }
.pickfeed-card.haul.is-lode .pickfeed-icon img { max-width: 38px; max-height: 38px; }
.haul-lode .haul-silver { color: #eef2f5; }
.haul-lode .haul-coin[hidden] { display: none; }   /* AUDIT HAUL-CARDS A5: no silver struck, no coin */
.pickfeed-card.haul .pickfeed-plus { display: inline-block; transform-origin: center; }
.pickfeed-card.haul .pickfeed-plus.bump-a { animation: pickfeed-bump-a 180ms ease-out; }
.pickfeed-card.haul .pickfeed-plus.bump-b { animation: pickfeed-bump-b 180ms ease-out; }
/* no slide, no pop, no fade under reduced motion: a card is there, and then it is not */
@media (prefers-reduced-motion: reduce) {
  .pickfeed-card, .pickfeed-count, .pickfeed-name, .pickfeed-plus, .haul-fill { animation: none !important; transition: none !important; } }
@media (max-width: 720px) { .pickfeed-card { font-size: 13px; max-width: calc(88vw / var(--hud-scale, 1)); } }   /* AUDIT HAUL-CARDS C2: the width before the HUD's scale, so a scaled card keeps to the screen */
${THEME_TINTS}
/* font: ${PIXEL_STACK} */`;

// ── THE FACE ────────────────────────────────────────────────────────────────────────────────────────────────────────

const queue = createPickupQueue();
let node = null;
/** card id -> { el, name, count, bumps, fading } - what is drawn, so a still card costs nothing */
const drawn = new Map();
let shownOrder = '';
let lastTop = null, lastScale = null;
let _watchdog = null;
let _ticking = false;
/** The ticker's generation: a frame asked for before a teardown (or a test's new frame source) is not this ticker's,
 *  and runs nothing - or a pending frame and a fresh request would run two chains a frame for as long as a card stood. */
let _tickGen = 0;
let _faultSaid = false;
let _now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
let _raf = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : null);
let _schedule = (fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null);
let _cancel = (t) => { if (t != null && typeof clearTimeout === 'function') clearTimeout(t); };
/** An icon's picture for a card: `{ src, w, h, smooth }` or null while it is made (`onReady` fires once when it lands)
 *  and for a thing with no picture. The pack's own door (textureCanvas.requestFittedIcon over inventoryItemImage's
 *  address) - cached by its name, decoded once. */
let _icon = (line, onReady) => {
  const img = line.image;
  if (!img || img.archive == null) return null;
  const box = line.lode ? LODE_ICON_BOX : line.haul ? HAUL_ICON_BOX : PICKUP_ICON_BOX;   // HAUL-CARDS: fitted to the card's own box
  return requestFittedIcon(img.archive, img.record, { box, dpr: screenDpr(), dye: img.dye, dyeTarget: img.dyeTarget, onReady });
};

/** Tests and the probe: the clock, the frame source, the watchdog's timers and the icon door. */
export function _setPickupFeedForTests({ now, raf, schedule, cancel, icon } = {}) {
  if (now !== undefined) _now = now ?? (() => Date.now());
  if (raf !== undefined) { _raf = raf ?? (() => null); _ticking = false; _tickGen += 1; }
  if (schedule !== undefined) _schedule = schedule;
  if (cancel !== undefined) _cancel = cancel;
  if (icon !== undefined) _icon = icon;
}
/** Tests: what stands, as the law reads it now. */
export const _pickupFeedLines = () => queue.standing(_now());

const doc = () => (typeof document === 'undefined' ? null : document);

function ensure(d) {
  if (node) return node;
  if (!d.getElementById?.(PICKUP_FEED_STYLE_ID)) {
    const st = d.createElement('style');
    st.id = PICKUP_FEED_STYLE_ID;
    st.textContent = PICKUP_FEED_CSS;
    (d.head ?? d.body).append(st);
  }
  node = d.createElement('div');
  node.id = PICKUP_FEED_ID;
  node.className = 'pickfeed';
  node.setAttribute('aria-hidden', 'true');   // the HUD's text surfaces are not a reading order (the mid-screen label's own)
  d.body.append(node);
  return node;
}

/**
 * THE TAKE'S HOOK - what `quickLootTake` is handed as `took` by each of the four hosts. `moved` is what one press put in
 * the pack (`[{ item, count }]`, in the order it moved), `identity` the player whose pack it went into. Answers TRUE when
 * the cards are up (the enhanced skin), and the take then does not say its line; FALSE on the classic skin, off a
 * document, or for nothing at all, and the take says its words exactly as it always has.
 */
export function showPickups(moved, identity = undefined) {
  try {
    if (!isEnhanced()) return false;
    const d = doc();
    if (!d?.body || !d.createElement) return false;
    const entries = (moved ?? []).map((m) => pickupEntry(m?.item, m?.count, identity)).filter(Boolean);
    if (!entries.length) return false;
    if (!queue.push(entries, _now())) return false;
    ensure(d);
    draw();
    return true;
  } catch (e) {
    // A face that cannot draw shows nothing, and the take says its line: a pickup is never lost to a draw.
    if (!_faultSaid) { _faultSaid = true; console.warn(`[pickup-feed] the cards could not be drawn; the line is said instead: ${e?.message ?? e}`); }
    return false;
  }
}

/**
 * HAUL-CARDS: A GATHER'S, A STRIKE'S OR A CLAIM'S CARDS (ui/haulCards.js builds them from the answer) - the same feed,
 * law and band as a pickup's. Answers TRUE when they are up (the enhanced skin), and the caller then does not say the
 * lines they stand for; FALSE on the classic skin, off a document, for nothing, or a face that cannot draw - and the
 * lines are said exactly as before.
 * @param {any[]} entries
 */
export function showHaul(entries) {
  try {
    if (!isEnhanced()) return false;
    const d = doc();
    if (!d?.body || !d.createElement) return false;
    const list = (entries ?? []).filter((e) => e && e.key && e.haul && e.count > 0);
    if (!list.length) return false;
    if (!queue.push(list, _now())) return false;
    ensure(d);
    draw();
    return true;
  } catch (e) {
    if (!_faultSaid) { _faultSaid = true; console.warn(`[pickup-feed] the haul's cards could not be drawn; the lines are said instead: ${e?.message ?? e}`); }
    return false;
  }
}

/** One frame of the face: age the cards, draw what changed, stand the feed where it fits, and keep the ticker (and its
 *  watchdog) going while a card stands. */
function draw() {
  if (!node) return;
  const now = _now();
  queue.tick(now);
  const lines = queue.standing(now);
  paint(lines);
  disarmDraw(_watchdog);
  _watchdog = null;
  if (!lines.length) return;
  place(lines.length);
  _watchdog = armDrawWatchdog(PICKUP_WATCHDOG_MS, () => { _watchdog = null; clearPickupFeed(); }, { schedule: _schedule, cancel: _cancel });
  if (!_ticking) { const gen = _tickGen; _ticking = _raf(() => frame(gen)) != null; }
}
function frame(gen) {
  if (gen !== _tickGen) return;
  _ticking = false;
  try { draw(); } catch (e) {
    if (!_faultSaid) { _faultSaid = true; console.warn(`[pickup-feed] a frame failed; the watchdog takes the cards down: ${e?.message ?? e}`); }
  }
}

function paint(lines) {
  const d = doc();
  if (!d) return;
  const live = new Set(lines.map((l) => l.id));
  for (const [id, c] of drawn) if (!live.has(id)) { try { c.el.remove(); } catch { /* already gone */ } drawn.delete(id); }
  for (const l of lines) {
    let c = drawn.get(l.id);
    if (!c) { c = build(d, l); drawn.set(l.id, c); }
    if (c.haul) {
      // HAUL-CARDS: a bump rewrites the card's words (its count, its Stores, its XP and the bar), the "+N" pops
      if (c.bumps !== l.bumps) { c.bumps = l.bumps; c.count = l.count; sayHaul(c, l); pop(c.plus, l.bumps); }
    } else if (c.count !== l.count) {
      c.count = l.count;
      c.name.textContent = nameText(l);
      c.num.textContent = pickupCountText(l);
    }
    if (!c.haul && c.bumps !== l.bumps) {
      c.bumps = l.bumps;
      const target = l.gold ? c.name : c.num;
      target.classList.remove('bump-a', 'bump-b');
      target.classList.add(l.bumps % 2 ? 'bump-a' : 'bump-b');
    }
    if (c.fading !== l.fading) { c.fading = l.fading; c.el.classList.toggle('fading', l.fading); }
  }
  // the order: newest first. Rewritten only when it changed - a still feed moves no node (a moved node restarts its
  // entrance in some engines).
  const order = lines.map((l) => l.id).join(',');
  if (order !== shownOrder) {
    shownOrder = order;
    for (let i = 0; i < lines.length; i++) {
      const el = drawn.get(lines[i].id).el;
      if (node.children[i] !== el) node.insertBefore(el, node.children[i] ?? null);
    }
  }
}

const pop = (target, bumps) => { if (!target) return; target.classList.remove('bump-a', 'bump-b'); target.classList.add(bumps % 2 ? 'bump-a' : 'bump-b'); };
const span = (d, cls, text = '') => { const s = d.createElement('span'); s.className = cls; s.textContent = text; return s; };
/** HAUL-CARDS: a gather's, a strike's or a claim's card, built once - its words written by sayHaul, now and at a bump. */
function buildHaul(d, l) {
  const el = d.createElement('div');
  el.className = `pickfeed-card haul is-${l.lode ? 'lode' : l.haul === 'note' ? 'note' : l.tone === 'treasury' ? 'treasury' : l.haul === 'silver' ? 'silver' : 'stores'}`;
  if (l.rarity) el.dataset.rarity = l.rarity;
  const c = { el, haul: true, count: l.count, bumps: l.bumps, fading: false };
  if (l.haul === 'note') { c.note = span(d, 'haul-note'); el.append(c.note); sayHaul(c, l); return c; }
  c.icon = span(d, 'pickfeed-icon');
  if (l.haul === 'silver') c.icon.append(span(d, l.tone === 'treasury' ? 'haul-chest' : 'haul-coin'));
  const body = d.createElement('div');
  body.className = 'haul-body';
  c.head = d.createElement('div'); c.head.className = 'haul-head';
  const line = d.createElement('div'); line.className = 'haul-line';
  c.plus = span(d, 'pickfeed-plus'); c.name = span(d, 'pickfeed-name'); c.sub = span(d, 'haul-sub'); c.tag = span(d, 'haul-tag'); c.end = span(d, 'haul-end');
  line.append(c.plus, c.name, c.sub, c.tag, c.end);
  c.row = d.createElement('div'); c.row.className = 'haul-row';
  c.rowText = span(d, 'haul-text'); c.bar = span(d, 'haul-bar'); c.fill = span(d, 'haul-fill'); c.rowEnd = span(d, 'haul-rank');
  c.bar.append(c.fill);
  c.row.append(c.rowText, c.bar, c.rowEnd);
  body.append(c.head, line, c.row);
  if (l.lode) {
    c.lode = d.createElement('div'); c.lode.className = 'haul-row haul-lode';
    c.lodeSilver = span(d, 'haul-silver'); c.lodeHeld = span(d, 'haul-sub'); c.miners = span(d, 'haul-end');   // AUDIT HAUL-CARDS B4: the purse beside the silver
    c.lodeCoin = span(d, 'haul-coin');
    c.lode.append(c.lodeCoin, c.lodeSilver, c.lodeHeld, c.miners);
    body.append(c.lode);
  }
  el.append(c.icon, body);
  sayHaul(c, l);
  if (l.haul === 'stores') setIcon(c, l);
  return c;
}
/** A haul card's words, written (haulCards.js haulWords - the pins read the same words). */
function sayHaul(c, l) {
  const w = haulWords(l);
  if (c.note) { c.note.textContent = w.note; return; }
  c.head.textContent = w.head ?? '';
  c.plus.textContent = w.plus;
  c.name.textContent = w.name;
  c.sub.textContent = w.sub ?? '';
  c.tag.textContent = w.tag ?? '';
  c.end.textContent = w.end ?? '';
  c.row.hidden = !w.row;
  if (w.row) {
    c.rowText.textContent = w.row.text;
    c.fill.style.width = `${Math.round(w.row.fill * 100)}%`;
    c.rowEnd.textContent = w.row.end ?? '';
  }
  if (c.lode && w.lode) { c.lodeSilver.textContent = w.lode.silver; c.lodeHeld.textContent = w.lode.held ?? ''; c.miners.textContent = w.lode.miners; c.lodeCoin.hidden = !w.lode.silver; }
}

function build(d, l) {
  if (l.haul) return buildHaul(d, l);   // HAUL-CARDS
  const el = d.createElement('div');
  el.className = 'pickfeed-card';
  if (l.gold) el.classList.add('is-gold');
  if (l.rarity) el.dataset.rarity = l.rarity;
  if (l.exalted) el.dataset.exalted = '';
  const icon = d.createElement('span');
  icon.className = 'pickfeed-icon';
  const name = d.createElement('span');
  name.className = 'pickfeed-name';
  const num = d.createElement('span');
  num.className = 'pickfeed-count';
  // an item's "+" is its own brass mark before the name; gold's words carry theirs ("+120 Gold")
  name.textContent = nameText(l);
  num.textContent = pickupCountText(l);
  const c = { el, icon, name, num, count: l.count, bumps: l.bumps, fading: false };
  el.append(icon);
  if (!l.gold) {
    const plus = d.createElement('span');
    plus.className = 'pickfeed-plus';
    plus.textContent = '+';
    el.append(plus);
  }
  el.append(name, num);
  setIcon(c, l);
  return c;
}
/** The card's picture: the cached one now, or - while it is made - once it lands into the frame already standing
 *  (a card that has gone by then takes nothing). A thing with no picture at all has no frame: the card stands on its
 *  words. */
function setIcon(c, l) {
  const put = (pic) => {
    if (!pic?.src) return false;
    const img = fittedImg(pic);
    if (c.icon.replaceChildren) c.icon.replaceChildren(img);
    else c.icon.append(img);
    return true;
  };
  let pic = null;
  try { pic = _icon(l, () => { if (drawn.get(l.id) === c) { try { put(_icon(l, null)); } catch { /* the words stand */ } } }); } catch { pic = null; }
  let shown = false;
  try { shown = put(pic); } catch { shown = false; }
  if (!shown && !l.image) { c.icon.remove(); c.el.classList.add('no-icon'); }
}

/** Where the feed stands this frame, and how many cards fit (see the header and pickupFeedLayout). Reads every rect it
 *  needs, THEN writes - one layout, no thrash. */
function place(count) {
  const d = doc();
  if (!d || !node) return;
  const win = globalThis;
  const vw = Number(win.innerWidth) || 0, vh = Number(win.innerHeight) || 0;
  const scale = Number.parseFloat(d.querySelector?.('.hud')?.style?.getPropertyValue?.('--hud-scale')) || 1;
  // the game's canvas is the window's whole size (play/index.html #c), so the native fit is the window's: the classic
  // label's top edge off the same floored arithmetic it is drawn by, at its own native y (a docked large HUD lifts it),
  // and the reticle off its own two terms
  const dpr = Number(win.devicePixelRatio) || 1;
  const canvas = { width: Math.round(vw * dpr), height: Math.round(vh * dpr), clientWidth: vw };
  const px = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
  const base = midTextTopPx(canvas, midScreenText.y) ?? vh * 0.73;
  const { scale: reticle, largeHudHeight } = hudReticle(canvas);
  const gap = PICKUP_FEED_GAP * scale;
  let upper = (crosshairCentreY(canvas.height, largeHudHeight) + CROSSHAIR_ARM * reticle) / px + PICKUP_CROSS_GAP;
  const rect = (n) => { const r = n?.getBoundingClientRect?.(); return r && r.height > 0 ? r : null; };
  for (const sel of PICKUP_KEEP_ABOVE) { const r = rect(d.querySelector?.(sel)); if (r) upper = Math.max(upper, r.bottom + gap); }
  const mid = d.getElementById?.(ENHANCED_MID_TEXT_ID);
  if (mid && mid.style?.display !== 'none' && mid.textContent) { const r = rect(mid); if (r) upper = Math.max(upper, r.bottom + gap); }
  let lower = vh - PICKUP_FEED_MARGIN;
  if (largeHudHeight > 0) lower = Math.min(lower, (canvas.height - largeHudHeight) / px - gap);
  for (const sel of PICKUP_KEEP_BELOW) {
    const n = d.querySelector?.(sel);
    const r = n?.textContent ? rect(n) : null;   // an empty prompt holds no room
    if (r) lower = Math.min(lower, r.top - gap);
  }
  const first = rect(node.firstElementChild);
  // HAUL-CARDS: a gather's card is taller than a pickup's - each card's own height, newest first. AUDIT HAUL-CARDS A1: a
  // card the band put out measures nothing, so each keeps its last height seen (`_pfH`) - read as the first's, a tall
  // card out of the band fitted the next frame, stood, and went again, a flicker the whole of its hold
  const heights = [];
  for (let i = 0; i < count && i < (node.children?.length ?? 0); i++) {
    const kid = node.children[i], r = rect(kid);
    if (r) kid._pfH = r.height;
    heights.push(r?.height ?? kid._pfH ?? first?.height ?? 0);
  }
  const { top, shown } = pickupFeedLayout({ base, upper, lower, cardH: first?.height ?? 0, cardGap: PICKUP_CARD_GAP * scale, count, heights });
  const t = `${top.toFixed(1)}px`;
  if (t !== lastTop) { lastTop = t; node.style.setProperty('--pf-top', t); }
  const s = String(scale);
  if (s !== lastScale) { lastScale = s; node.style.setProperty('--hud-scale', s); }
  // the oldest wait unseen when the band is short (they are the next to fade): a class, so the sheet owns the look
  const kids = node.children ?? [];
  for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('pf-over', i >= shown);
}

/** Every card down, now - the watchdog's release, and a host's door if one ever needs it. The node stays for the next. */
export function clearPickupFeed() {
  disarmDraw(_watchdog);
  _watchdog = null;
  queue.clear();
  for (const c of drawn.values()) { try { c.el.remove(); } catch { /* already gone */ } }
  drawn.clear();
  shownOrder = '';
}

/** Freed with the host that raised it (ui/worldPlaque.js destroyWorldPlaque calls this beside quick loot's reset): the
 *  cards, the node, the watchdog. The sheet stays, as every injected sheet in the skin does. */
export function destroyPickupFeed() {
  clearPickupFeed();
  try { node?.remove(); } catch { /* already gone */ }
  node = null;
  lastTop = null;
  lastScale = null;
  _ticking = false;
  _tickGen += 1;
  _faultSaid = false;
}
