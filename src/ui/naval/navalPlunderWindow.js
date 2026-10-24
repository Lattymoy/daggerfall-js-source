// @ts-check
// NAV-F (2026-09-28, Mac: "actual sailing ships to the world that players can encounter and pillage ... All UI elements
// should follow enhanced plus UI. This task is to be extremely detailed, authentic and easy to use") - THE PLUNDER
// WINDOW: a taken ship, laid open. Black Flag's moment after the boarding - her cargo, the one thing you take from her
// for your own ship, and what becomes of her - in Daggerfall's words and the stone-and-brass kit.
//
// THREE PARTS, top to bottom, the order a captain decides in:
//   HER HOLD    what she carries (drawn once through DFU's own loot tables - systems/naval/navalPlunder.js drawHold -
//               so whoever opens her again finds what is left): the first rows by name, TAKE ALL into your own ship's
//               hold (Come Sail Away's cargo - its weight slows her, as the mod weighs it) or, with no ship of yours
//               alongside, into your pack as far as it carries; OPEN HER HOLD lays it in the pack's own loot window, to
//               pick through a piece at a time, and this window comes back when that one shuts
//   TAKE FROM HER - one (a prize, with a ship of yours to take it to): her timber and cordage (your hull and canvas
//               mended), her powder and shot (every gun loaded, the fire barrels filled), her crew pressed to your
//               guns, or - AUDIT NAV1 (B13), Black Flag's "lower your wanted level" - her papers burned (a pirate's:
//               her crew handed to the crown), your notoriety in her crown's waters down - each tile saying what it
//               would make good NOW, greyed with why when it would make nothing good; two by two
//   HER FATE    scuttle her (the press that costs something: the warn role's blood edge) or cast her adrift; shut the
//               window without either and she lies taken where she is - Activate opens her again. AUDIT NAV1 (B11):
//               LEAVE HER is its own way out ('leave') - she lies taken as she is, and the host puts the captor back
//               at their own helm; the back key or the scrim only shut the window, her deck still underfoot.
//               SHIP-CLAIM (2026-10-01, Mac: "Claim captured prizes - Keep a ship you take by boarding as your own
//               boat, instead of scuttling her or casting her adrift"): CLAIM HER, the third - while the host offers it
//               (`claimOffer`: a prize of mine Come Sail Away can place), its line under the three saying what she
//               becomes; the press asks the host again, and a refusal stays with a word instead of leaving.
// A RAID'S PRIZE (Warm Ashes' voyage ambush beaten: scenes/naval/navalHost.js leaveShipGate) has a hold and no choice, and
// its one way on is SAIL ON - the voyage waits on this window, so shutting it sails on too (the door's host says so).
//
// THE HOUSE'S SHAPE is the Sigil Broker's (ui/brokerWindow.js): a lazy chunk the door (ui/naval/navalPlunderDoor.js) mounts
// in its own host - `mountNavalPlunderWindow(host, deps)` answers `{ repaint, unmount }` - the back key (overlayAction's
// 'back') and a tap on the scrim leave through the door's own close (`deps.onExit`). On either skin: the window lays
// its own sheet, and on the classic skin the kit's rules cut to the naval surfaces (ui/naval/navalHud.js injectNavalKit).
//
// deps = { model, nameOf(item) -> string, onExit(reason) } - `model` the host's (navalHost.js openPrize /
// leaveShipGate): { name, captain, classLine, faction, raid, items (the live hold), mine() -> { name, hull, sail,
// crew } | null, offers() -> [{ id, title, detail, useful }], takeAll() -> { taken, left, where }, chosen() -> id |
// null, fated() -> string | null, choose(id) -> bool, fate(which) -> bool (SHIP-CLAIM: false - refused), leave()?,
// claimOffer()? -> { detail } | null }.
import { closeOnOutsideTap } from '../enhanced/enhancedOverlays.js';
import { overlayAction } from '../input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from '../enhanced/enhancedStyle.js';
import { PIXEL_FONT_CSS } from '../pixelifyFive.js';
import { FRAME_TONES } from '../enhanced/enhancedFrame.js';
import { injectNavalKit } from './navalHud.js';

export const NAVAL_PLUNDER_STYLE_ID = 'dagger-naval-plunder-style';
/** How many of the hold's pieces the window names before "and N more". */
export const HOLD_ROWS = 8;
const T = FRAME_TONES;

export const NAVAL_PLUNDER_CSS = `
.dfnaval-shell { position: fixed; inset: 0; z-index: 39; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: rgba(4,5,7,0.42); ${PIXEL_FONT_CSS} color: #d8cfae; }
.dfnaval-win { width: min(660px, 96vw); max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; border: 2px solid ${T.stoneLit};
  background: ${T.ground}; }
.dfnaval-winhead { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-bottom: 2px solid rgba(5,6,8,0.6); }
.dfnaval-flag { flex: 0 0 auto; width: 30px; height: 20px; margin-top: 3px; box-shadow: 0 0 0 1px #050608, 2px 2px 0 1px rgba(0,0,0,0.45); }
.dfnaval-flag.pirate { background: linear-gradient(45deg, transparent 44%, #e9e4d9 44% 56%, transparent 56%), linear-gradient(-45deg, transparent 44%, #e9e4d9 44% 56%, transparent 56%), #121010; }
.dfnaval-flag.merchant { background: linear-gradient(180deg, #e9c860 0 35%, #2c4f8a 35% 65%, #e9c860 65%); }
.dfnaval-flag.navy { background: linear-gradient(90deg, #9e1a16 0 38%, #f3cf86 38% 62%, #9e1a16 62%); }
.dfnaval-wintitle { flex: 1 1 auto; min-width: 0; }
.dfnaval-wintitle h2 { margin: 0; font-size: 20px; font-weight: normal; letter-spacing: 0.12em; text-transform: uppercase; color: #efe0b8; text-shadow: 2px 2px 0 #050608;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dfnaval-winsub { margin: 2px 0 0; font-size: 12px; color: #b9ab93; }
.dfnaval-note { margin: 5px 0 0; font-size: 12px; color: ${T.brassHi}; text-shadow: 1px 1px 0 #050608; }
.dfnaval-note.warn { color: #e59a8e; }
.dfnaval-note[hidden] { display: none; }
.dfnaval-claim[hidden], .dfnaval-claimnote[hidden] { display: none; }
.dfnaval-winbody { display: flex; flex-direction: column; gap: 14px; padding: 12px 16px 16px; min-height: 0; overflow: auto; }
.dfnaval-sec { display: flex; flex-direction: column; gap: 8px; }
.dfnaval-sechead { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 0; padding-bottom: 4px;
  border-bottom: 2px solid rgba(5,6,8,0.6); font-size: 13px; font-weight: normal; letter-spacing: 0.14em; text-transform: uppercase; color: #efe8d6; text-shadow: 1px 1px 0 #050608; }
.dfnaval-count { font-size: 11px; letter-spacing: 0.06em; color: #b3a684; text-transform: none; }
.dfnaval-holdlist { list-style: none; margin: 0; padding: 4px 10px; max-height: 176px; overflow: auto; border: 2px solid; background: rgba(4,5,7,0.55); }
.dfnaval-item { padding: 4px 0; font-size: 13px; color: #e6dccb; border-bottom: 1px solid; text-shadow: 1px 1px 0 #050608; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dfnaval-item:last-child { border-bottom-color: transparent; }
.dfnaval-item.more { color: #9a8e7c; }
.dfnaval-lede { margin: 0; font-size: 12px; color: #b9ab93; text-align: center; }
.dfnaval-acts { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.dfnaval-btn { min-width: 136px; padding: 6px 14px; font: inherit; font-size: 14px; letter-spacing: 0.06em; color: #e9e4d9; border: 2px solid; cursor: pointer; text-shadow: 1px 1px 0 #050608; }
.dfnaval-btn:disabled { cursor: default; color: #9c937d; }
.dfnaval-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.dfnaval-choice { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 8px 9px; font: inherit; text-align: center; color: #e9e4d9;
  border: 2px solid; background-color: ${T.groundButton}; cursor: pointer; }
.dfnaval-choice b { font-weight: normal; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #efe8d6; text-shadow: 1px 1px 0 #050608; }
.dfnaval-choice span { font-size: 11px; color: #b9ab93; }
/* AUDIT NAV1 (the presentation): a refused tile says WHY - greyed by its title and edge, never by fading the whole tile
   (its reason read 2.3:1, 3.2 even on Slate) */
.dfnaval-choice:disabled { cursor: default; background-color: rgba(8,9,12,0.6); }
.dfnaval-choice:disabled b { color: #8f8670; text-shadow: 1px 1px 0 #050608; }
.dfnaval-choice:disabled span { color: #c9bfa4; }
.dfnaval-choice.on { opacity: 1; }
.dfnaval-choice.on b { color: ${T.gold}; text-shadow: 1px 1px 0 rgb(93,77,12); }
@media (max-width: 560px) {
  .dfnaval-shell { padding: 8px; }
  .dfnaval-winhead { padding: 10px 12px; }
  .dfnaval-wintitle h2 { font-size: 17px; letter-spacing: 0.08em; }
  .dfnaval-winbody { padding: 10px 12px 12px; }
  .dfnaval-choices { grid-template-columns: 1fr; }
  .dfnaval-btn { flex: 1 1 100%; }
}
`;

/** "1 thing", "12 things". */
export const thingsText = (n) => `${n} ${n === 1 ? 'thing' : 'things'}`;
/** What a Take All did, in a line: where the goods went, and what would not go. */
export function takenText(r, shipName = null) {
  if (!r || r.taken <= 0) return r?.left > 0 ? `You cannot carry any of it. ${thingsText(r.left)} stay in the hold.` : 'The hold is empty.';
  const to = r.where === 'hold' ? `to your ${shipName ?? 'ship'}'s hold` : 'into your pack';
  return r.left > 0 ? `${thingsText(r.taken)} moved ${to}. ${thingsText(r.left)} will not fit and stay in the hold.` : `${thingsText(r.taken)} moved ${to}.`;
}
/** The window's standing words for a model - pure, the pins' reading. */
export function plunderText(model, nameOf = (it) => String(it?.name ?? '')) {
  const items = model.items ?? [];
  const mine = model.mine?.() ?? null;
  const shown = items.slice(0, HOLD_ROWS).map((it) => nameOf(it));
  return {
    title: model.name,
    sub: [model.classLine, model.captain ? `Captain ${model.captain}` : null].filter(Boolean).join(' - '),
    lede: model.raid ? 'The raiders are beaten. Their ship is alongside and its hold is open to you.' : `The ship is yours.${mine ? '' : ' None of your ships is alongside to load anything onto.'}`,
    count: items.length ? thingsText(items.length) : 'empty',
    rows: items.length > HOLD_ROWS ? [...shown, `and ${items.length - HOLD_ROWS} more`] : shown,
    more: items.length > HOLD_ROWS,
    take: model.raid || !mine ? 'Take all into your pack' : `Take all to your ${mine.name}`,
    /** SHIP-CLAIM: what claiming her makes of her, while the host offers it - never a raid's. */
    claim: model.raid ? null : model.claimOffer?.()?.detail ?? null,
  };
}

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
/** @param {string} text @param {string} cls @param {() => void} onPress */
const button = (text, cls, onPress) => {
  const b = /** @type {HTMLButtonElement} */ (el('button', cls, text));
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e.stopPropagation(); if (!b.disabled) onPress(); };
  return b;
};

/** The sea fight's windows' own sheet, once (AUDIT NAV1: the shipwright's window lays it too - ui/naval/navalYardWindow.js). */
export function injectNavalWindowStyle(doc = document) {
  if (doc.getElementById?.(NAVAL_PLUNDER_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = NAVAL_PLUNDER_STYLE_ID;
  st.textContent = NAVAL_PLUNDER_CSS;
  (doc.head ?? doc.body).append(st);
}

/**
 * Mount the window in the door's host.
 * @param {HTMLElement} host
 * @param {{ model: any, nameOf?: (item: any) => string, prepareHold?: () => string | null, onExit?: ((reason?: string) => void) | null }} deps
 * @returns {{ repaint: () => void, unmount: () => void }}
 */
export function mountNavalPlunderWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectNavalWindowStyle();
  injectNavalKit(document);
  const m = deps.model;
  const nameOf = deps.nameOf ?? ((it) => String(it?.name ?? ''));
  const exit = (reason = 'close') => deps.onExit?.(reason);
  /** The last press's word. */
  let note = null;
  const shell = el('div', 'dfnaval-shell');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', `${m.name} - plunder`);
  const win = el('div', 'dfnaval-win');
  shell.append(win);
  // the head: her colours, her name, her class and captain, the last word
  const head = el('header', 'dfnaval-winhead');
  const flag = el('i', `dfnaval-flag ${m.faction ?? 'pirate'}`);
  flag.setAttribute('aria-hidden', 'true');
  const title = el('div', 'dfnaval-wintitle');
  const h2 = el('h2');
  const sub = el('p', 'dfnaval-winsub');
  const noteLine = el('p', 'dfnaval-note');
  noteLine.setAttribute('aria-live', 'polite');
  title.append(h2, sub, noteLine);
  const close = button(m.raid ? 'Close' : 'Leave', 'dfnaval-btn dfnaval-close', () => exit(m.raid ? 'close' : 'leave'));
  close.style.minWidth = '0';
  head.append(flag, title, close);
  const body = el('div', 'dfnaval-winbody');
  const lede = el('p', 'dfnaval-lede');
  // her hold
  const holdSec = el('section', 'dfnaval-sec');
  const holdHead = el('h3', 'dfnaval-sechead');
  const holdCount = el('span', 'dfnaval-count');
  holdHead.append(el('span', null, 'Hold'), holdCount);
  const holdList = el('ul', 'dfnaval-holdlist');
  const holdActs = el('div', 'dfnaval-acts');
  const takeAll = button('Take all', 'dfnaval-btn dfnaval-take', () => {
    const r = m.takeAll?.();
    note = { text: takenText(r, m.mine?.()?.name ?? null), warn: !r || r.left > 0 };
    render();
  });
  const openHold = button('Open hold', 'dfnaval-btn dfnaval-open', () => {
    const refusal = deps.prepareHold?.();
    if (refusal) { note = { text: refusal, warn: true }; render(); return; }
    exit('hold');
  });
  holdActs.append(takeAll, openHold);
  holdSec.append(holdHead, holdList, holdActs);
  const settle = (fate) => {
    if (m.fate?.(fate) === false) { note = { text: 'No safe return deck is available. Stay here or claim the ship first.', warn: true }; render(); return; }
    exit('fate');
  };
  // the choice
  const choiceSec = el('section', 'dfnaval-sec');
  const choiceHead = el('h3', 'dfnaval-sechead');
  choiceHead.append(el('span', null, 'Take'), el('span', 'dfnaval-count', 'one, for your own ship'));
  const choices = el('div', 'dfnaval-choices');
  choiceSec.append(choiceHead, choices);
  // her fate
  const fateSec = el('section', 'dfnaval-sec');
  const fateHead = el('h3', 'dfnaval-sechead');
  fateHead.append(el('span', null, m.raid ? 'The voyage' : 'The ship'));
  const fateActs = el('div', 'dfnaval-acts');
  const sail = m.raid ? button('Sail on', 'dfnaval-btn dfnaval-take dfnaval-sail', () => { m.fate?.('sail'); exit('fate'); }) : null;
  if (sail) fateActs.append(sail);
  else {
    fateActs.append(
      button('Scuttle', 'dfnaval-btn dfnaval-scuttle', () => settle('scuttle')),
      button('Cast adrift', 'dfnaval-btn dfnaval-adrift', () => settle('adrift')),
    );
  }
  // SHIP-CLAIM: the third beside them - never a raid's (its one way on is Sail on). The host's answer decides it: a
  // refusal stays, with a word, where the other two leave
  const claim = sail ? null : button('Claim', 'dfnaval-btn dfnaval-claim', () => {
    if (m.fate?.('claim') === false) { note = { text: 'This ship can\'t be claimed.', warn: true }; render(); return; }
    exit('fate');
  });
  if (claim) fateActs.append(claim);
  const claimNote = el('p', 'dfnaval-lede dfnaval-claimnote');
  fateSec.append(fateHead, fateActs, claimNote);
  body.append(lede, holdSec, choiceSec, fateSec);
  win.append(head, body);

  let alive = true;
  const render = () => {
    if (!alive) return;
    const t = plunderText(m, nameOf);
    h2.textContent = t.title;
    sub.textContent = t.sub;
    lede.textContent = t.lede;
    noteLine.textContent = note ? note.text : '';
    noteLine.className = `dfnaval-note${note?.warn ? ' warn' : ''}`;
    if (note) noteLine.removeAttribute?.('hidden'); else noteLine.setAttribute('hidden', '');
    holdCount.textContent = t.count;
    for (const c of [...holdList.children]) c.remove();
    if (!t.rows.length) holdList.append(el('li', 'dfnaval-item more', 'Nothing left in the hold.'));
    t.rows.forEach((row, i) => holdList.append(el('li', `dfnaval-item${t.more && i === t.rows.length - 1 ? ' more' : ''}`, row)));
    takeAll.textContent = t.take;
    const empty = !(m.items?.length > 0);
    if (empty) { takeAll.setAttribute('disabled', ''); openHold.setAttribute('disabled', ''); } else { takeAll.removeAttribute('disabled'); openHold.removeAttribute('disabled'); }
    // SHIP-CLAIM: the claim stands while the host offers it, read at every paint, its line under the three
    for (const n of [claim, claimNote]) if (n) { if (t.claim) n.removeAttribute('hidden'); else n.setAttribute('hidden', ''); }
    claimNote.textContent = t.claim ?? '';
    if (claim && t.claim) claim.setAttribute('title', t.claim);
    // the choice: the tiles, once one is taken the rest shut
    const offers = m.offers?.() ?? [];
    choiceSec.style.display = !m.raid && offers.length ? '' : 'none';
    const chosen = m.chosen?.() ?? null;
    for (const c of [...choices.children]) c.remove();
    for (const o of offers) {
      const tile = button('', `dfnaval-choice${chosen === o.id ? ' on' : ''}`, () => {
        if (m.choose?.(o.id)) note = { text: `${o.title}: taken.`, warn: false };
        render();
      });
      tile.dataset.choice = o.id;
      tile.setAttribute('aria-pressed', chosen === o.id ? 'true' : 'false');
      tile.append(el('b', null, o.title), el('span', null, chosen === o.id ? 'Taken' : o.detail));
      if (chosen || !o.useful) tile.setAttribute('disabled', '');
      if (!o.useful && !chosen) tile.setAttribute('title', o.detail);
      choices.append(tile);
    }
  };
  render();
  host.append(shell);
  // a pad or a keyboard lands on the press the window is for
  (sail ?? (takeAll.disabled ? close : takeAll)).focus?.({ preventScroll: true });
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); exit('close'); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.dfnaval-win', () => exit('close'));
  return {
    repaint: () => render(),
    unmount() {
      if (!alive) return;
      alive = false;
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      offOutside();
      shell.remove();
    },
  };
}
