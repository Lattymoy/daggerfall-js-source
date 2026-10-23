// @ts-check
// COMPANION-ROSTER (2026-10-02, Mac: "Spare should allow you to free the enemy, which then adds them as a companion,
// which you could keep send them away or keep them with you ... Companion slots should still be limited and will need a
// new enhanced plus UI feature") - THE COMPANIONS PAGE on the Enhanced pause menu's Holdings rail (ui/enhanced/enhancedMenu.js
// pauseHoldings - HOLDINGS moved it off the Stats rail, 2026-10-03), beside the Revenants page.
//
//  - THE SLOTS: a strip of COMPANION_SLOTS wells (systems/companionSlots.js) - each filled one shows who stands in it (a
//    sworn revenant's portrait, a hand of the crew by name), each open one says so - so the limit is a thing the player
//    SEES, not a refusal they meet.
//  - AT YOUR SIDE: each sworn revenant walking with the player - its portrait, rank and personality, its health, and
//    two acts: SEND AWAY (it steps out through its portal and waits) and RELEASE (its oath given back - asked twice).
//  - AWAY: each sworn one waiting, or recovering from a fall (how long yet) - CALL (it steps through a portal to the
//    player's side; refused, and saying why, while the slots are full or it is still hurt) and RELEASE.
//  - The retinue's own bound (REVENANT_RETINUE_MAX), and how one is gained, at its foot.
//  - RVN11 (bible/12-Enhanced-AI/Feud-Arc.md 22.4): each sworn one's LOYALTY - a bar under its health, and its word
//    (Devoted, Loyal, Wavering, Restless).
//  - RVN-GEAR (bible/06-Systems/Revenants.md section 40): ITS KIT - GEAR opens a sheet: a well a slot (what it wears,
//    TAKE BACK), and the pieces of the player's pack it could wear (GIVE - refused, and saying why, past its rank).
//  - RVN-ARTS (section 41): its art, for the player, in a line.
//  - RVN-ERRAND (section 42): MISSION opens a sheet - a venture, and Tamriel's nine provinces with their days, their
//    danger and its odds (SEND); one ABROAD says where and when it is back, and may be RECALLED, empty-handed.
//  - RVN-STARS (section 44): its level and the stars it has to set, in a line, and STARS - its sky (ui/revenantStarsWindow.js),
//    laid over the pause window by the door that drew this page (`stars(id)` - ui/firmamentOver.js revenantStarsOver).
// The acts are the companions' own (systems/revenant/revenantCompanions.js); the host hears them (setRetinueListener) and the
// companion layer carries them out the moment the menu closes - the portals, the words.
//
// Dressed by the stone-and-brass kit's roles (ui/enhanced/enhancedFrame.js FRAME_ROLES): a row a tile, a portrait and a slot a
// well, the rank and the personality chips, the acts buttons (Release the warn) - this sheet writes geometry and the
// words' colours alone.

import { retinue, revenantsWithYou, revenantsAway, callRevenant, callRefusal, sendRevenantAway, leaveRefusal, releaseRevenant, restUntil, REVENANT_RETINUE_MAX } from '../systems/revenant/revenantCompanions.js';
import { companionsWithYou, companionRoster, COMPANION_SLOTS } from '../systems/companionSlots.js';
import { revenantPortrait, revenantRankNumeral } from '../systems/revenant/revenant.js';
import { PERSONALITIES } from '../systems/revenant/revenantPersonality.js';
import { loyaltyLabel } from '../systems/revenant/revenantFeud.js';   // RVN11 (bible/12-Enhanced-AI/Feud-Arc.md 22.4): its loyalty's word
import { ownMinutes, sharedClockOn } from '../systems/worldTick.js';
import { requestFittedIcon, fittedImg } from './textureCanvas.js';
import { giftablePieces, giveSwornGear, takeSwornGear, sendOnErrand, recallFromErrand, errandRefusal, abroadWords } from '../systems/revenant/revenantCompanions.js';   // RVN-GEAR, RVN-ERRAND
import { GEAR_SLOTS, GEAR_KEYS, GEAR, metalName, tierWord, armedKind, gearKeyOf, gearRefusal, gearLabel, gearPower, gearTier, gearItems, wornGear, brokenPiece } from '../systems/revenant/revenantGear.js';
import { ERRAND, ERRAND_PLACES, VENTURES, VENTURE_KEYS, errandOdds, oddsWord, oddsKind, errandMinutes, ERRAND_REAL_HOURS_A_DAY } from '../systems/revenant/revenantErrands.js';
import { rvnStarsOf } from '../systems/revenant/revenantStars.js';   // RVN-STARS: its level and its stars to set
import { MINUTES_PER_DAY } from '../systems/gameDate.js';
import { t } from '../systems/textManager.js';   // L10N4: RVN-GEAR's and RVN-ERRAND's words through the text core
import { artWords } from '../systems/revenant/revenantArts.js';   // RVN-ARTS: its art, for me
import { itemLongName } from '../systems/item/itemInfo.js';
import { itemValueOf } from '../systems/item/itemTemplates.js';
import { rarityOf, RARITIES } from '../systems/loot/lootRarity.js';

/** The rail's row, its word read when it is read (AUDIT RVN-STARS S23: a level reached names "the Companions page" in the
 *  player's language - the rail said it in English). */
export const COMPANION_PAGE_SECTIONS = Object.freeze([(() => { const row = ['companions']; Object.defineProperty(row, 1, { enumerable: true, get: () => t('rvn.roster.rail', 'Companions') }); return Object.freeze(row); })()]);
export const COMPANION_PAGE_STYLE_ID = 'companion-roster-css';
const FACE_BOX = 48;
const SLOT_BOX = 40;
let _icon = (p, box, onReady) => requestFittedIcon(p.archive, p.record, { box, dpr: Number(globalThis.devicePixelRatio) || 1, cap: 8, onReady });
/** Tests: the portrait source. */
export function _setCompanionRosterIconForTests(fn) { _icon = fn ?? ((p, box, onReady) => requestFittedIcon(p.archive, p.record, { box, dpr: Number(globalThis.devicePixelRatio) || 1, cap: 8, onReady })); }

/** The rail shows the page while anyone is sworn to the player, or anyone walks at its side. */
export const companionPageShown = () => retinue().length > 0 || companionsWithYou() > 0;

export const COMPANION_PAGE_CSS = `
.px-sys .cmp-slots { display: flex; gap: 8px; margin: 6px 0 4px; }
.px-sys .cmp-slot { position: relative; box-sizing: border-box; width: ${SLOT_BOX + 8}px; height: ${SLOT_BOX + 8}px; border-width: 2px; border-style: solid;
  display: flex; align-items: center; justify-content: center; overflow: hidden; }
.px-sys .cmp-slot.is-open { border-style: dashed; opacity: 0.7; }
.px-sys .cmp-slot img.fit { image-rendering: pixelated; }
.px-sys .cmp-slot .cmp-glyph { font-size: 18px; color: #8b8578; }
.px-sys .cmp-slot .cmp-initial { font-size: 18px; color: #c9b98f; }
.px-sys .cmp-slotline { font-size: 11px; color: #b8b0a0; margin: 0 0 8px; }
.px-sys .cmp-list { display: flex; flex-direction: column; gap: 8px; margin: 6px 0 10px; }
.px-sys .cmp-row { display: grid; grid-template-columns: ${FACE_BOX + 8}px 1fr; gap: 10px; padding: 7px 10px 8px 7px; border-width: 2px; border-style: solid; box-sizing: border-box; text-align: left; }
.px-sys .cmp-face { position: relative; box-sizing: border-box; width: ${FACE_BOX + 8}px; height: ${FACE_BOX + 8}px; border-width: 2px; border-style: solid;
  display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
.px-sys .cmp-face img.fit { image-rendering: pixelated; }
.px-sys .cmp-face .cmp-glyph { margin: auto; font-size: 22px; color: #8b8578; }
.px-sys .cmp-rank { position: absolute; right: 2px; bottom: 2px; z-index: 1; min-width: 18px; padding: 0 3px; box-sizing: border-box; border-width: 1px; border-style: solid; font-size: 10px; line-height: 1.3; text-align: center; color: #f3cf86; }
.px-sys .cmp-text { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.px-sys .cmp-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.px-sys .cmp-name { font-size: 15px; color: #f3cf86; overflow-wrap: anywhere; }
.px-sys .cmp-state { flex: none; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #8fc7a0; }
.px-sys .cmp-state.is-away { color: #b8b0a0; }
.px-sys .cmp-state.is-resting { color: #e0a54a; }
.px-sys .cmp-sub { font-size: 11px; color: #8b8578; }
.px-sys .cmp-hp { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; max-width: 260px; }
.px-sys .cmp-hpn { font-size: 11px; color: #b8b0a0; font-variant-numeric: tabular-nums; }
.px-sys .cmp-loyw { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
.px-sys .cmp-loyw.is-devoted { color: #8fc7a0; }
.px-sys .cmp-loyw.is-wavering { color: #e0a54a; }
.px-sys .cmp-loyw.is-restless { color: #ff8a78; }
.px-sys .cmp-mood { display: inline-block; margin-right: 6px; padding: 0 5px; border-width: 1px; border-style: solid; font-size: 9px; line-height: 1.5; letter-spacing: 0.12em; text-transform: uppercase; color: #e9c46a; vertical-align: 1px; }
.px-sys .cmp-why { font-size: 11px; color: #e0a54a; }
.px-sys .cmp-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.px-sys .cmp-acts .act { min-width: 0; padding-left: 10px; padding-right: 10px; }
.px-sys .cmp-acts .act.warn { color: #ff8a78; }
.px-sys .cmp-confirm { font-size: 12px; color: #e9e4d9; margin-top: 4px; }
.px-sys .cmp-foot { font-size: 11px; color: #8b8578; margin: 4px 0 0; }
.px-sys .cmp-state.is-errand { color: #9fc2e8; }
.px-sys .cmp-art { font-size: 11px; color: #c9b98f; }
.px-sys .cmp-stars { font-size: 11px; color: #b8b0a0; }
.px-sys .cmp-stars.is-left { color: #e9c46a; }
.px-sys .cmp-sheet { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; padding: 8px 10px; border-width: 2px; border-style: solid; box-sizing: border-box; }
.px-sys .cmp-sheethead { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #e9c46a; }
.px-sys .cmp-gear { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }
.px-sys .cmp-gslot { display: flex; flex-direction: column; gap: 3px; padding: 5px 6px; border-width: 2px; border-style: solid; box-sizing: border-box; min-width: 0; }
.px-sys .cmp-gslot.is-open { border-style: dashed; }
.px-sys .cmp-glabel { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #8b8578; }
.px-sys .cmp-gname { font-size: 12px; overflow-wrap: anywhere; }
.px-sys .cmp-gname.is-none { color: #8b8578; font-style: italic; }
.px-sys .cmp-gname.is-broken { text-decoration: line-through; }
.px-sys .cmp-gcond { font-size: 10px; color: #8b8578; }
.px-sys .cmp-gcond.is-off { color: #ff8a78; }
.px-sys .cmp-picks, .px-sys .cmp-dests { display: flex; flex-direction: column; gap: 4px; }
.px-sys .cmp-pick, .px-sys .cmp-dest { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 4px 8px; }
.px-sys .cmp-pickname, .px-sys .cmp-destname { font-size: 12px; overflow-wrap: anywhere; }
.px-sys .cmp-vents { display: flex; flex-wrap: wrap; gap: 6px; }
.px-sys .cmp-vent { padding: 2px 10px; border-width: 2px; border-style: solid; font-size: 12px; }
.px-sys .cmp-odds { display: inline-block; margin-left: 6px; padding: 0 5px; border-width: 1px; border-style: solid; font-size: 9px; line-height: 1.5; letter-spacing: 0.08em; text-transform: uppercase; }
.px-sys .cmp-odds.is-good { color: #8fc7a0; }
.px-sys .cmp-odds.is-fair { color: #e9c46a; }
.px-sys .cmp-odds.is-grim { color: #ff8a78; }
:root[data-plus-theme="stone"] .px-sys .cmp-sub, :root[data-plus-theme="stone"] .px-sys .cmp-foot, :root[data-plus-theme="stone"] .px-sys .cmp-slotline, :root[data-plus-theme="stone"] .px-sys .cmp-glabel, :root[data-plus-theme="stone"] .px-sys .cmp-gname.is-none, :root[data-plus-theme="stone"] .px-sys .cmp-gcond { color: #e2d9c4; }
:root[data-plus-theme="stone"] .px-sys .cmp-gcond.is-off { color: #ff9b84; }
:root[data-plus-theme="stone"] .px-sys .cmp-stars { color: #e2d9c4; }
:root[data-plus-theme="stone"] .px-sys .cmp-stars.is-left { color: #f3cf86; }
`;
function ensureStyle(doc) {
  if (!doc?.getElementById || doc.getElementById(COMPANION_PAGE_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = COMPANION_PAGE_STYLE_ID;
  st.textContent = COMPANION_PAGE_CSS;
  (doc.head ?? doc.body)?.append(st);
}

/** A revenant's picture into a well (its glyph while the picture loads, or for a kind with none). */
function picture(el, cls, r, box, rerender) {
  const f = el('div', cls);
  f.setAttribute('aria-hidden', 'true');
  const p = revenantPortrait(r);
  let shown = false;
  if (p) {
    try {
      const pic = _icon(p, box, () => { if (f.isConnected !== false) rerender?.(); });
      if (pic?.src) { f.append(fittedImg(pic)); shown = true; }
    } catch { shown = false; }
  }
  if (!shown) f.append(el('span', 'cmp-glyph', '✦'));
  return f;
}
/** How long yet, in the words a roster uses. */
export function restWords(until, now) {
  const h = Math.ceil(Math.max(0, until - now) / 60);
  return h <= 1 ? 'Recovering. Back within the hour' : `Recovering - ${h} hours`;
}

/** RVN11 (bible/12-Enhanced-AI/Feud-Arc.md 22.4): its loyalty - a bar (the kit's bone tone) and its word, the number on
 *  the bar's title; nothing for a record without one. */
export function loyaltyRow(el, r, meter) {
  const v = r?.companion?.loyalty;
  if (!Number.isFinite(v)) return [];
  const word = loyaltyLabel(v);
  const lb = el('div', 'cmp-hp cmp-loy');
  lb.title = `Loyalty ${v} of 100`;
  lb.append(...(typeof meter === 'function' ? [meter(v, 100, '')] : []), el('span', `cmp-loyw is-${word.toLowerCase()}`, word));
  return [lb];
}

let _confirm = null;   // the sworn one whose release is being asked (its id)
let _notice = null;    // the last refusal, said under its row ({ id, text })
let _sheet = null;     // RVN-GEAR / RVN-ERRAND: the sheet open under a row ({ id, kind: 'gear'|'errand' })
let _venture = 'plunder';   // RVN-ERRAND: the venture the mission sheet would send it on
let _recall = null;    // AUDIT RVN D9: the one abroad whose recall is being asked (its id) - a recall forfeits its haul
let _allPieces = null;   // AUDIT RVN G1: the row whose kit sheet lists every piece, not the first GIFT_ROWS
/** RVN-GEAR: how many of the pack's pieces the kit sheet lists at first - those it can wear before those it cannot, each
 *  slot in order, the dearest first; the rest a press away (AUDIT RVN G1). */
export const GIFT_ROWS = 12;
/** AUDIT RVN D9: a button's key, so a redraw gives the focus back to the same one (ui/domRepaint.js). */
const keyed = (n, k) => { n.setAttribute?.('data-focus', k); return n; };
const ROMAN = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V']);
/** RVN-ERRAND: an odds chip's classes, by its kind. */
const ODDS_CLASS = Object.freeze({ good: 'cmp-odds is-good', fair: 'cmp-odds is-fair', grim: 'cmp-odds is-grim' });
const tone = (it) => RARITIES[rarityOf(it)]?.colour ?? null;
/** RVN-GEAR (Revenants.md section 40): ITS KIT - a well a slot it may fill, and the player's pieces it could wear. */
function gearSheet(el, r, rerender, kindName) {
  const box = el('div', 'cmp-sheet');
  box.setAttribute?.('aria-label', t('rvn.roster.kit', 'Its kit'));   // AUDIT RVN D15
  box.append(el('span', 'cmp-sheethead', t('rvn.roster.kit', 'Its kit')));
  const armed = armedKind(r.mobileType), rank = Math.max(1, Math.min(5, r.rank | 0));
  const kind = kindName?.(r.mobileType) ?? t('rvn.gear.itsKind', 'Its kind');
  box.append(el('span', 'cmp-sub', armed
    ? t('rvn.roster.kitCaps', 'At Rank {rank} it can wear up to {metal} and {tier} pieces. An empty slot keeps its own gear.', { rank: ROMAN[rank], metal: metalName(GEAR.METAL_CAP[rank]), tier: tierWord(GEAR.RARITY_CAP[rank]) })
    : t('rvn.roster.kitCharm', '{kind} can\'t use weapons or armor, but it can wear a charm.', { kind })));
  const grid = el('div', 'cmp-gear');
  const worn = new Set(wornGear(r).map(([, it]) => it));
  for (const s of GEAR_SLOTS) {
    if (!armed && s.key !== 'charm') continue;
    const it = r.companion?.gear?.[s.key] ?? null;
    const cell = el('div', `cmp-gslot${it ? '' : ' is-open'}`);
    cell.append(el('span', 'cmp-glabel', s.label));
    if (it) {
      const broken = brokenPiece(it);
      const nm = el('span', `cmp-gname${broken ? ' is-broken' : ''}`, itemLongName(it));
      const c = tone(it); if (c && nm.style) nm.style.color = c;
      // AUDIT RVN G7: what it wears wears out - its condition, and a piece it holds off said so (broken; a shield with no
      // whole one-handed weapon beside it)
      const cur = Number(it.currentCondition), max = Number(it.maxCondition);
      const state = broken ? t('rvn.roster.broken', 'Broken: not worn until repaired')
        : !worn.has(it) ? t('rvn.roster.heldOff', 'Not worn: it needs an unbroken one-handed weapon')
          : max > 0 && Number.isFinite(cur) ? t('rvn.roster.condition', 'Condition {pct}%', { pct: Math.max(0, Math.min(100, Math.round(cur / max * 100))) }) : null;
      const back = keyed(el('button', 'act', t('rvn.roster.takeBack', 'Take back')), `cmp-${r.id}-take-${s.key}`);
      back.title = s.key === 'weapon' && r.companion.gear.shield ? t('rvn.roster.takeBackShield', 'Its shield comes back with it') : t('rvn.roster.takeBackTip', 'Back to your pack');
      back.onclick = () => { takeSwornGear(r.id, s.key); _notice = null; rerender(); };
      cell.append(nm);
      if (state) cell.append(el('span', `cmp-gcond${worn.has(it) ? '' : ' is-off'}`, state));
      cell.append(back);
    } else cell.append(el('span', 'cmp-gname is-none', s.key === 'charm' ? t('rvn.roster.none', 'None') : t('rvn.roster.itsOwn', 'Its own')));
    grid.append(cell);
  }
  box.append(grid);
  box.append(el('span', 'cmp-sub', t('rvn.roster.kitOdds', 'On a mission, its gear adds {pct}% to its odds (up to {max}%).', { pct: Math.round(gearPower(r) * ERRAND.ODDS.PER * 100), max: Math.round(GEAR.POWER_MAX * ERRAND.ODDS.PER * 100) })));   // AUDIT RVN D13: in the odds' own terms
  // AUDIT RVN G1: the pieces it can wear first (a looter's twelve blades above its rank hid every helm and charm), each slot
  // in order, the dearest first; a piece nobody but the player may hold (a quest's, a summoned one, one past Legendary)
  // never listed; the rest a press away
  const order = (it) => GEAR_KEYS.indexOf(gearKeyOf(it));
  const all = giftablePieces().filter((it) => (armed || gearKeyOf(it) === 'charm') && !it.questItem && (it.timeForItemToDisappear ?? 0) === 0 && gearTier(it) <= 3)
    .map((it) => ({ it, why: gearRefusal(r, it, { kindName: kind }) }))
    .sort((a, b) => Number(!!a.why) - Number(!!b.why) || order(a.it) - order(b.it) || itemValueOf(b.it) - itemValueOf(a.it));
  if (!all.length) { box.append(el('span', 'cmp-sub', t('rvn.roster.nothingToGive', 'Nothing in your pack that it could wear.'))); return box; }
  const pieces = _allPieces === r.id ? all : all.slice(0, GIFT_ROWS);
  box.append(el('span', 'cmp-sheethead', t('rvn.roster.fromPack', 'From your pack')));
  const list = el('div', 'cmp-picks');
  pieces.forEach(({ it, why }, i) => {
    const line = el('div', 'cmp-pick');
    const nm = el('span', 'cmp-pickname', t('rvn.roster.pick', '{item} - {slot}', { item: itemLongName(it), slot: gearLabel(gearKeyOf(it)) }));
    const c = tone(it); if (c && nm.style) nm.style.color = c;
    const give = keyed(el('button', `act${why ? '' : ' primary'}`, t('rvn.roster.give', 'Give')), `cmp-${r.id}-give-${i}`);
    give.title = why ?? t('rvn.roster.giveTip', 'It wears this from now on. You can take it back at any time.');
    give.onclick = () => { const no = giveSwornGear(r.id, it, { kindName: kind }); _notice = no ? { id: r.id, text: no } : null; rerender(); };
    line.append(nm, give);
    list.append(line);
  });
  box.append(list);
  if (all.length > pieces.length) {
    const more = keyed(el('button', 'act', t('rvn.roster.morePieces', 'Show {n} more', { n: all.length - pieces.length })), `cmp-${r.id}-more`);
    more.onclick = () => { _allPieces = r.id; rerender(); };
    box.append(more);
  }
  return box;
}
/** RVN-STARS (Revenants.md section 44): its level and the stars it has to set - a line on its row (AUDIT RVN-STARS S28: none
 *  yet said so, never "0 of 0"). */
export function starsLine(r) {
  const s = rvnStarsOf(r), left = Math.max(0, s.points - s.set);
  if (!s.points) return t('rvn.roster.starsNone', 'Level {level} · no stars to set yet', { level: s.level });
  return left ? t('rvn.roster.starsLeft', 'Level {level} · {n, plural, one {a star} other {# stars}} to set', { level: s.level, n: left })
    : t('rvn.roster.starsSet', 'Level {level} · {set} of {points} stars set', { level: s.level, set: s.set, points: s.points });
}
/** RVN-ERRAND (Revenants.md section 42): SEND IT ABROAD - a venture, and the nine provinces with their days, danger and odds. */
function errandSheet(el, r, rerender, now) {
  const box = el('div', 'cmp-sheet');
  box.setAttribute?.('aria-label', t('rvn.roster.abroadHead', 'Send it abroad'));   // AUDIT RVN D15
  box.append(el('span', 'cmp-sheethead', t('rvn.roster.abroadHead', 'Send it abroad')));
  const why = errandRefusal(r, now);
  if (why) box.append(el('span', 'cmp-why', why));
  const vents = el('div', 'cmp-vents');
  for (const k of VENTURE_KEYS) {
    const b = keyed(el('button', `cmp-vent${_venture === k ? ' on' : ''}`, VENTURES[k].label), `cmp-${r.id}-vent-${k}`);
    b.title = VENTURES[k].blurb;
    b.setAttribute?.('aria-pressed', _venture === k ? 'true' : 'false');
    b.onclick = () => { _venture = k; rerender(); };
    vents.append(b);
  }
  box.append(vents, el('span', 'cmp-sub', t('rvn.roster.ventureLine', '{label}: {blurb}.', { label: VENTURES[_venture].label, blurb: VENTURES[_venture].blurb })));
  const list = el('div', 'cmp-dests');
  for (const p of ERRAND_PLACES) {
    const odds = errandOdds(r, p);
    const line = el('div', 'cmp-dest');
    const mins = errandMinutes(r, p);   // RVN-STARS: its road - a share off the days
    const name = el('span', 'cmp-destname', mins % MINUTES_PER_DAY === 0
      ? t('rvn.roster.dest', '{place} - {days, plural, one {a day} other {# days}}, danger {danger}', { place: p.name, days: mins / MINUTES_PER_DAY, danger: ROMAN[p.danger] })
      : t('rvn.roster.destHours', '{place} - {hours} hours, danger {danger}', { place: p.name, hours: Math.round(mins / 60), danger: ROMAN[p.danger] }));
    name.append(el('span', ODDS_CLASS[oddsKind(odds)], t('rvn.roster.odds', '{word} {pct}%', { word: oddsWord(odds), pct: Math.round(odds * 100) })));
    const go = keyed(el('button', `act${why ? '' : ' primary'}`, t('rvn.roster.send', 'Send')), `cmp-${r.id}-send-${p.key}`);
    go.title = why ?? t('rvn.roster.sendTip', 'It leaves for {place} on a {venture} errand', { place: p.name, venture: VENTURES[_venture].label });
    go.onclick = () => { const no = sendOnErrand(r.id, p.key, _venture); _notice = no && no !== why ? { id: r.id, text: no } : null; if (!no) _sheet = null; rerender(); };   // AUDIT RVN D14: a refusal the sheet already says is not said twice
    line.append(name, go);
    list.append(line);
  }
  box.append(list);
  // AUDIT RVN D13: every number its constant's; F1: online, what carries it on
  box.append(el('span', 'cmp-foot', t('rvn.roster.abroadLaw', 'Danger runs from I to V. Its rank and gear improve its odds. Its haul goes to your purse, your pack and your Materials Bag. A hard-won mission brings back {pct}% of the haul, and it must rest after. Up to {n} can be abroad at once.', { pct: Math.round(ERRAND.HARD_SHARE * 100), n: ERRAND.MAX })));
  // OFFLINE-ROAD (FIELD BUGS 2026-10-21): online an errand keeps the world's time, away or not - a day abroad its real hours
  // read off the wire's rate (AUDIT FB1021 L3-5: never typed - AUDIT RVN D13's rule)
  if (sharedClockOn()) box.append(el('span', 'cmp-foot', t('rvn.roster.abroadLived', 'Online, a mission keeps real time: it goes on while you\'re away, {h, plural, one {# real hour} other {# real hours}} for each day abroad. Resting, waiting or traveling doesn\'t speed it up.', { h: ERRAND_REAL_HOURS_A_DAY })));
  return box;
}

function row(el, r, { now, rerender, meter, here, kindName, stars }) {
  const state = r.companion?.state ?? 'with';
  const item = el('div', `cmp-row is-${state}`);
  const f = picture(el, 'cmp-face', r, FACE_BOX, rerender);
  f.append(el('span', 'cmp-rank', revenantRankNumeral(r.rank)));
  const text = el('div', 'cmp-text');
  const head = el('div', 'cmp-head');
  head.append(el('span', 'cmp-name', r.name));
  head.append(el('span', `cmp-state${state === 'with' ? '' : ` is-${state}`}`, state === 'with' ? 'At your side' : state === 'resting' ? 'Recovering' : state === 'errand' ? t('rvn.errand.abroad', 'Abroad') : 'Away'));   // RVN-ERRAND
  text.append(head);
  const P = PERSONALITIES[r.personality];
  // AUDIT (2026-10-02): its chip says who it is - the blurb is a foe's ("...your death included"), never an ally's row's
  const sub = el('span', 'cmp-sub', [`Rank ${revenantRankNumeral(r.rank)}`, kindName?.(r.mobileType) ?? null].filter(Boolean).join(' · '));
  if (P) sub.insertBefore(el('span', 'cmp-mood', P.label), sub.firstChild ?? null);
  text.append(sub);
  if (state === 'with') {
    const body = here?.(r.id);
    const hm = body?.maxHealth ?? r.companion?.maxHealth ?? null, h = body?.health ?? r.companion?.health ?? hm;
    if (hm > 0 && typeof meter === 'function') {   // AUDIT (2026-10-02): the green of the bar over its head, with its numbers (a tone the kit has)
      const hp = el('div', 'cmp-hp');
      hp.append(meter(Math.max(0, Math.round(h)), Math.round(hm), 'verdigris'), el('span', 'cmp-hpn', `${Math.max(0, Math.round(h))} / ${Math.round(hm)}`));
      text.append(hp);
    }
  } else if (state === 'resting') text.append(el('span', 'cmp-sub', restWords(restUntil(r, now), now)));
  else if (state === 'errand') text.append(el('span', 'cmp-sub', abroadWords(r, now) ?? t('rvn.errand.abroad', 'Abroad')));   // RVN-ERRAND: where, and when it is back
  text.append(...loyaltyRow(el, r, meter));   // RVN11 (22.4): its loyalty, wherever it is
  const art = artWords(r, { sworn: true });   // RVN-ARTS: its art, for me
  if (art) text.append(el('span', 'cmp-art', art));
  text.append(el('span', `cmp-stars${state !== 'errand' && rvnStarsOf(r).points > rvnStarsOf(r).set ? ' is-left' : ''}`, starsLine(r)));   // RVN-STARS - AUDIT RVN-STARS S28: gold only where its Stars can set them
  if (_notice?.id === r.id) text.append(el('span', 'cmp-why', _notice.text));
  const acts = el('div', 'cmp-acts');
  if (_confirm === r.id) {
    const n = (r.companion?.items?.length ?? 0) + gearItems(r.companion?.gear).length;   // AUDIT (2026-10-02): its pack comes back to the player's - say so; AUDIT RVN G6: and its kit
    text.append(el('span', 'cmp-confirm', `Release ${r.name}? It is freed from its oath and leaves you for good${n ? `, giving back what it carries (${n === 1 ? 'one item' : `${n} items`})` : ''}.`));
    const yes = el('button', 'act warn', 'Release');
    yes.onclick = () => { _confirm = null; _notice = null; releaseRevenant(r.id); rerender(); };
    const no = el('button', 'act', 'Keep');
    no.onclick = () => { _confirm = null; rerender(); };
    acts.append(yes, no);
  } else if (state === 'errand' && _recall === r.id) {   // AUDIT RVN D9: a recall forfeits its haul - asked, as a release is
    text.append(el('span', 'cmp-confirm', t('rvn.roster.recallAsk', 'Recall {name}? It returns now with nothing and must rest.', { name: r.name })));
    const yes = keyed(el('button', 'act warn', t('rvn.roster.recall', 'Recall')), `cmp-${r.id}-recall-yes`);
    yes.onclick = () => { _recall = null; _notice = null; recallFromErrand(r.id); rerender(); };
    const no = keyed(el('button', 'act', t('rvn.roster.recallKeep', 'Let it go on')), `cmp-${r.id}-recall-no`);
    no.onclick = () => { _recall = null; rerender(); };
    acts.append(yes, no);
  } else if (state === 'errand') {   // RVN-ERRAND: abroad - recalled, empty-handed; its oath is given back to its face
    const back = keyed(el('button', 'act', t('rvn.roster.recall', 'Recall')), `cmp-${r.id}-recall`);
    back.onclick = () => { _notice = null; _recall = r.id; rerender(); };
    acts.append(back);
  } else {
    if (state === 'with') {
      const away = el('button', 'act', 'Send away');
      away.title = 'It steps out through a portal and waits until you call it';
      away.onclick = () => { const no = leaveRefusal(r); _notice = no ? { id: r.id, text: no } : null; if (!no) sendRevenantAway(r.id); rerender(); };   // COMPANION-DROP: never from my side inside the open zone - said
      acts.append(away);
    } else {
      const why = callRefusal(r, now);
      const call = el('button', `act${why ? '' : ' primary'}`, 'Call');
      call.title = why ?? 'It steps through a portal to your side';
      call.onclick = () => { const no = callRevenant(r.id, now); _notice = no ? { id: r.id, text: no } : null; rerender(); };
      acts.append(call);
    }
    for (const [kind, label, tip] of [['gear', t('rvn.roster.gear', 'Gear'), t('rvn.roster.gearTip', 'Give it a weapon, armor or a charm from your pack')], ['errand', t('rvn.roster.mission', 'Mission'), t('rvn.roster.missionTip', 'Send it abroad and it comes back with a haul')]]) {   // RVN-GEAR, RVN-ERRAND
      const open = _sheet?.id === r.id && _sheet.kind === kind;
      const b = keyed(el('button', `act${open ? ' on' : ''}`, label), `cmp-${r.id}-sheet-${kind}`);
      b.setAttribute?.('aria-expanded', open ? 'true' : 'false');   // AUDIT RVN D15
      b.title = tip;
      b.onclick = () => { _sheet = _sheet?.id === r.id && _sheet.kind === kind ? null : { id: r.id, kind }; _notice = null; rerender(); };
      acts.append(b);
    }
    if (typeof stars === 'function') {   // RVN-STARS: its sky, over this window
      const b = keyed(el('button', `act${rvnStarsOf(r).points > rvnStarsOf(r).set ? ' primary' : ''}`, t('rvn.roster.stars', 'Stars')), `cmp-${r.id}-stars`);
      b.title = t('rvn.roster.starsTip', 'Spend its star points on health, damage, its art and missions');
      b.onclick = () => { _notice = null; stars(r.id); };
      acts.append(b);
    }
    const rel = el('button', 'act', 'Release');
    rel.onclick = () => { _confirm = r.id; _notice = null; rerender(); };
    acts.append(rel);
  }
  text.append(acts);
  if (_sheet?.id === r.id && state !== 'errand' && _confirm !== r.id) text.append(_sheet.kind === 'gear' ? gearSheet(el, r, rerender, kindName) : errandSheet(el, r, rerender, now));
  item.append(f, text);
  return item;
}

/**
 * THE PAGE: `detail` the rail's detail pane; `kit` the menu's makers ({ el, divider, meter }), and `here(id)` - the
 * body a sworn one stands in now (its live health), if any; `stars(id)` (RVN-STARS) the door's - a sworn one's sky over the
 * window (none: no Stars button).
 */
export function drawCompanionsPage(detail, rerender, { el, divider, meter = null, here = null, kindName = null, stars = null } = /** @type {any} */ ({})) {
  ensureStyle(typeof document === 'undefined' ? null : document);
  const now = Math.floor(ownMinutes());
  const withYou = revenantsWithYou();
  const away = revenantsAway();
  const crew = companionRoster('revenant');
  const used = companionsWithYou();
  // THE SLOTS
  detail.append(divider(`Companions (${used} of ${COMPANION_SLOTS} at your side)`));
  const strip = el('div', 'cmp-slots');
  strip.setAttribute('aria-label', `${used} of ${COMPANION_SLOTS} companion slots taken`);
  /** @type {Array<{ r?: any, c?: any }>} */
  const filled = [...withYou.map((r) => ({ r })), ...crew.map((c) => ({ c }))];
  for (let i = 0; i < COMPANION_SLOTS; i++) {
    const s = filled[i];
    if (s?.r) { const w = picture(el, 'cmp-slot', s.r, SLOT_BOX, rerender); w.title = s.r.name; strip.append(w); }
    else if (s?.c) { const w = el('div', 'cmp-slot'); w.append(el('span', 'cmp-initial', s.c.name.charAt(0).toUpperCase())); w.title = `${s.c.name}${s.c.role ? ` (${s.c.role})` : ''}`; strip.append(w); }
    else { const w = el('div', 'cmp-slot is-open'); w.append(el('span', 'cmp-glyph', '+')); w.title = 'An open slot'; strip.append(w); }
  }
  detail.append(strip);
  detail.append(el('p', 'cmp-slotline', crew.length
    ? `Your crew ashore take ${crew.length === 1 ? 'a slot' : `${crew.length} slots`} too: ${crew.map((c) => c.name).join(', ')}.`
    : used >= COMPANION_SLOTS ? 'Every slot is taken. Send one away to call another.' : 'Call a sworn companion to fill an open slot.'));
  // AT YOUR SIDE
  if (withYou.length) {
    detail.append(divider('At your side'));
    const list = el('div', 'cmp-list');
    for (const r of withYou) list.append(row(el, r, { now, rerender, meter, here, kindName, stars }));
    detail.append(list);
  }
  // AWAY
  if (away.length) {
    detail.append(divider('Away'));
    const list = el('div', 'cmp-list');
    for (const r of away) list.append(row(el, r, { now, rerender, meter, here, kindName, stars }));
    detail.append(list);
  }
  if (!withYou.length && !away.length) {
    detail.append(el('p', 'px-note', 'No revenant is sworn to you. Defeat one of your revenants and it will yield. Spare it, and it is yours.'));
  }
  const n = retinue().length;   // AUDIT (2026-10-02): the release's advice only where it is the way on
  if (n) detail.append(el('p', 'cmp-foot', `Sworn to you: ${n} of ${REVENANT_RETINUE_MAX}.${n >= REVENANT_RETINUE_MAX ? ' Release one to make room for another.' : ''}`));
}
/** A visit's asks forgotten (an armed Release, a refusal's words) - the pause menu's every mount (AUDIT 2026-10-02:
 *  an armed Release outlived the visit, as no armed press may). */
export function resetCompanionRoster() { _confirm = null; _notice = null; _sheet = null; _venture = 'plunder'; _recall = null; _allPieces = null; }
/** Tests: forget the page's asks. */
export const _resetCompanionRosterForTests = resetCompanionRoster;
