// @ts-check
// COMPANION-ROSTER (2026-10-02, Mac: "Spare should allow you to free the enemy, which then adds them as a companion,
// which you could keep send them away or keep them with you ... Companion slots should still be limited and will need a
// new enhanced plus UI feature") - THE COMPANIONS PAGE on the Enhanced pause menu's Holdings rail (ui/enhancedMenu.js
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
// The acts are the companions' own (systems/revenantCompanions.js); the host hears them (setRetinueListener) and the
// companion layer carries them out the moment the menu closes - the portals, the words.
//
// Dressed by the stone-and-brass kit's roles (ui/enhancedFrame.js FRAME_ROLES): a row a tile, a portrait and a slot a
// well, the rank and the personality chips, the acts buttons (Release the warn) - this sheet writes geometry and the
// words' colours alone.

import { retinue, revenantsWithYou, revenantsAway, callRevenant, callRefusal, sendRevenantAway, releaseRevenant, restUntil, REVENANT_RETINUE_MAX } from '../systems/revenantCompanions.js';
import { companionsWithYou, companionRoster, COMPANION_SLOTS } from '../systems/companionSlots.js';
import { revenantPortrait, revenantRankNumeral } from '../systems/revenant.js';
import { PERSONALITIES } from '../systems/revenantPersonality.js';
import { loyaltyLabel } from '../systems/revenantFeud.js';   // RVN11 (bible/12-Enhanced-AI/Feud-Arc.md 22.4): its loyalty's word
import { ownMinutes } from '../systems/worldTick.js';
import { requestFittedIcon, fittedImg } from './textureCanvas.js';

export const COMPANION_PAGE_SECTIONS = Object.freeze([['companions', 'Companions']]);
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
:root[data-plus-theme="stone"] .px-sys .cmp-sub, :root[data-plus-theme="stone"] .px-sys .cmp-foot, :root[data-plus-theme="stone"] .px-sys .cmp-slotline { color: #e2d9c4; }
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
  return h <= 1 ? 'Recovering - within the hour' : `Recovering - ${h} hours`;
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

function row(el, r, { now, rerender, meter, here, kindName }) {
  const state = r.companion?.state ?? 'with';
  const item = el('div', `cmp-row is-${state}`);
  const f = picture(el, 'cmp-face', r, FACE_BOX, rerender);
  f.append(el('span', 'cmp-rank', revenantRankNumeral(r.rank)));
  const text = el('div', 'cmp-text');
  const head = el('div', 'cmp-head');
  head.append(el('span', 'cmp-name', r.name));
  head.append(el('span', `cmp-state${state === 'with' ? '' : ` is-${state}`}`, state === 'with' ? 'At your side' : state === 'resting' ? 'Recovering' : 'Away'));
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
  text.append(...loyaltyRow(el, r, meter));   // RVN11 (22.4): its loyalty, wherever it is
  if (_notice?.id === r.id) text.append(el('span', 'cmp-why', _notice.text));
  const acts = el('div', 'cmp-acts');
  if (_confirm === r.id) {
    const n = r.companion?.items?.length ?? 0;   // AUDIT (2026-10-02): its pack comes back to the player's - say so
    text.append(el('span', 'cmp-confirm', `Release ${r.name}? Its oath is given back - it leaves you for good${n ? `, and hands you back its pack (${n === 1 ? 'one item' : `${n} items`})` : ''}.`));
    const yes = el('button', 'act warn', 'Release');
    yes.onclick = () => { _confirm = null; _notice = null; releaseRevenant(r.id); rerender(); };
    const no = el('button', 'act', 'Keep');
    no.onclick = () => { _confirm = null; rerender(); };
    acts.append(yes, no);
  } else {
    if (state === 'with') {
      const away = el('button', 'act', 'Send away');
      away.title = 'It steps out through a portal and waits until you call it';
      away.onclick = () => { _notice = null; sendRevenantAway(r.id); rerender(); };
      acts.append(away);
    } else {
      const why = callRefusal(r, now);
      const call = el('button', `act${why ? '' : ' primary'}`, 'Call');
      call.title = why ?? 'It steps through a portal to your side';
      call.onclick = () => { const no = callRevenant(r.id, now); _notice = no ? { id: r.id, text: no } : null; rerender(); };
      acts.append(call);
    }
    const rel = el('button', 'act', 'Release');
    rel.onclick = () => { _confirm = r.id; _notice = null; rerender(); };
    acts.append(rel);
  }
  text.append(acts);
  item.append(f, text);
  return item;
}

/**
 * THE PAGE: `detail` the rail's detail pane; `kit` the menu's makers ({ el, divider, meter }), and `here(id)` - the
 * body a sworn one stands in now (its live health), if any.
 */
export function drawCompanionsPage(detail, rerender, { el, divider, meter = null, here = null, kindName = null } = /** @type {any} */ ({})) {
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
    : used >= COMPANION_SLOTS ? 'Every slot is taken - send one away to call another.' : 'Call a sworn companion to fill an open slot.'));
  // AT YOUR SIDE
  if (withYou.length) {
    detail.append(divider('At your side'));
    const list = el('div', 'cmp-list');
    for (const r of withYou) list.append(row(el, r, { now, rerender, meter, here, kindName }));
    detail.append(list);
  }
  // AWAY
  if (away.length) {
    detail.append(divider('Away'));
    const list = el('div', 'cmp-list');
    for (const r of away) list.append(row(el, r, { now, rerender, meter, here, kindName }));
    detail.append(list);
  }
  if (!withYou.length && !away.length) {
    detail.append(el('p', 'px-note', 'No revenant is sworn to you. Beat one of your revenants and it will yield - spare it, and it is yours.'));
  }
  const n = retinue().length;   // AUDIT (2026-10-02): the release's advice only where it is the way on
  if (n) detail.append(el('p', 'cmp-foot', `Sworn to you: ${n} of ${REVENANT_RETINUE_MAX}.${n >= REVENANT_RETINUE_MAX ? ' Release one to make room for another.' : ''}`));
}
/** A visit's asks forgotten (an armed Release, a refusal's words) - the pause menu's every mount (AUDIT 2026-10-02:
 *  an armed Release outlived the visit, as no armed press may). */
export function resetCompanionRoster() { _confirm = null; _notice = null; }
/** Tests: forget the page's asks. */
export const _resetCompanionRosterForTests = resetCompanionRoster;
