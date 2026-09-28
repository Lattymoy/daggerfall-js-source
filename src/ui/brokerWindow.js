// @ts-check
// SET7 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md section 7; Mac: "Sigil stones become a currency to
// trade for daily reset sigil items at a new NPC vendor that stands outside the oblivion gate"): THE BROKER'S WINDOW.
//
// The day's six offers (systems/sigilBroker.js brokerStock), each a row: the piece's picture in its tier's frame with its
// set's rune (the pack's own markItemFrame), its name in its tier's colour, its set and tier, its price in Sigil Stones,
// and a Buy that says why it cannot when it cannot ("Bought", "Need 3 more" - the whole reason in its title). A row pressed shows the
// piece whole beside the list - its tier's lines, its sigil's block and its set's (the pack card's own blocks), so a
// player reads what a Dagon cuirass would do for their build before paying for it. The purse (how many stones, and how
// many of them are locked out of it) and the time to the turn of the day stand in the header, and the last word of a
// sale - bought, or why not - under them. ONLINE ONLY - and on EITHER skin (AUDIT SET U1, 2026-09-27): the skin is the
// player's choice online too since OVH3 (systems/uiSkin.js), and every rule this window wears lived in the Plus sheet,
// which the classic skin never lays - a classic player's Broker was a bare list running off the screen. So on the
// classic skin the window lays its OWN sheet (`brokerSkinCss`): its layout, the tiers' colours scoped to it, the
// sigil's and the set's blocks, and the stone-and-brass kit's rules cut to its own selectors (`scopeRules`).
//
// THE HOUSE'S SHAPE, as the tavern's (ui/enhancedTavern.js): a lazy chunk the door (ui/brokerDoor.js) mounts in its own
// host - `mountBrokerWindow(host, deps)` answers `{ repaint, unmount }` - the back key (overlayAction's 'back': Escape,
// or a pad's) and a tap on the scrim leave through the door's own close (`deps.onExit`), never around it. Everything the
// window needs from the world is handed in: the stock and the day, the purse and the record, the sale (the host takes
// the stones, gives the piece and marks it - in that order), and the wearer whose sets the set block reads - so this
// file draws and asks, and never touches a pack.
import { rarityLines, rarityAttr, RARITIES } from '../systems/lootRarity.js';
import { brokerOfferState, BROKER_REFUSALS, offerSetName, brokerTurnsIn, stonesText } from '../systems/sigilBroker.js';
import { inventoryItemImage } from '../systems/itemTemplates.js';
import { sigilCard } from './sigilCard.js';
import { setCard, markSetFrame } from './setCard.js';
import { requestFittedIcon, fittedImg } from './textureCanvas.js';
import { SLOT_BOX, screenDpr } from './iconFit.js';   // UI1: the offer's picture box
import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { rarityVarsCss, SIGIL_VARS_CSS, SIGIL_KEYFRAMES_CSS, SIGIL_BLOCK_CSS, SET_BLOCK_CSS, BROKER_CSS } from './enhancedPlusStyle.js';
import { frameCss } from './enhancedFrame.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { isBound, BOUND_LINE } from '../systems/itemBound.js';   // SS4: the wares are bound, and the card says so

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
/** "5h 12m", "38m" - the time to the turn of the day. */
export function brokerTurnText(ms) {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}
/** "1 Sigil Stone", "3 Sigil Stones". */
export { stonesText };   // SS5: the law's own words now (systems/sigilBroker.js) - the dismantle says them too
/** The purse's words: the stones a sale may take, and the locked ones it may not ("3 Sigil Stones · 1 locked"). */
export const purseText = (have, locked = 0) => (locked > 0 ? `${stonesText(have)} · ${locked} locked` : stonesText(have));
/** The last word of a press: the piece bought, or why not (the law's refusals and the host's own). */
export const BROKER_SOLD = (name, price) => `Bought: ${name}, for ${stonesText(price)}.`;   // AUDIT SET U6: no article of its own - a Legendary's name brings one ("The Warden"), a Regalia piece's is a possessive
/** How often the window re-reads the world while it stands: the turn's clock, and a stone won or dropped meanwhile. */
export const BROKER_REPAINT_MS = 30_000;
/** The Buy's own word - "Buy", or why not in a word or two that fits the button ("Need 3 more", "Bought"); the whole
 *  reason (the law's BROKER_REFUSALS) rides its title. A sentence on the button starved the name beside it to "Ruh...". */
export function buyLabel(s) {
  if (s.ok) return 'Buy';
  if (s.reason === 'stones') return `Need ${s.price - s.have} more`;
  if (s.reason === 'bought') return 'Bought';
  return 'Gone';
}

/** A selector list split at its top-level commas (never inside `:is(...)`/`:not(...)`). */
function splitSelectors(prelude) {
  const out = [];
  let depth = 0, at = 0;
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i];
    if (c === '(') depth++; else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { out.push(prelude.slice(at, i).trim()); at = i + 1; }
  }
  out.push(prelude.slice(at).trim());
  return out.filter(Boolean);
}
/** A sheet's rules cut to the selectors `keep` answers yes for - each rule's list cut, a rule left with none dropped,
 *  an @media kept round what it keeps, a @keyframes kept whole (it dresses nothing by itself). The kit is written for
 *  every surface, its roles and its hand-set rules alike (the hotbar's sockets, the dividers); the classic skin's
 *  Broker lays its own window's share of it and nothing else. */
export function scopeRules(css, keep) {
  const text = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '', i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const prelude = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    const inner = text.slice(open + 1, j - 1);
    if (/^@(media|supports)\b/.test(prelude)) { const kept = scopeRules(inner, keep); if (kept) out += `${prelude} {\n${kept}}\n`; }
    else if (prelude.startsWith('@')) out += `${prelude} {${inner}}\n`;
    else { const sels = splitSelectors(prelude).filter(keep); if (sels.length) out += `${sels.join(',\n')} {${inner}}\n`; }
    i = j;
  }
  return out;
}

/** AUDIT SET U1: THE WINDOW'S OWN SHEET, for the classic skin - everything it wears, scoped to it, and nothing that
 *  would dress another surface: its layout, the tiers' colours under its shell, the sigil's and the set's blocks (their
 *  own classes, which only this window draws on that skin), the tier word's colour on its card, and the kit's rules cut
 *  to the window's own selectors. On Enhanced Plus the Plus sheet already carries all of it. */
export const BROKER_SKIN_STYLE_ID = 'broker-skin-style';
export function brokerSkinCss() {
  return [
    rarityVarsCss('.broker-shell '), SIGIL_VARS_CSS, SIGIL_KEYFRAMES_CSS, SIGIL_BLOCK_CSS, SET_BLOCK_CSS, BROKER_CSS,
    '.broker-card[data-rarity] > ul.rarity > li:first-child { color: var(--rar); letter-spacing: 0.18em; }',
    scopeRules(frameCss(), (sel) => sel.includes('broker')),
  ].join('\n');
}
function injectBrokerSkinStyle(doc = document) {
  if (isEnhancedPlus() || doc.getElementById?.(BROKER_SKIN_STYLE_ID) || [...(doc.head?.children ?? [])].some((c) => c.id === BROKER_SKIN_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = BROKER_SKIN_STYLE_ID;
  st.textContent = brokerSkinCss();
  (doc.head ?? doc.body).append(st);
}

/** An item's classic picture fitted to the offer's box (UI1), or null while it loads (`onReady` repaints when it lands)
 *  - the pack's own door, for its own WEARER (AUDIT FINAL F4: a cuirass is drawn for a race and a gender - the pack's
 *  and the shop's rows ask for the player, and the offer was drawn for nobody's, a Breton man's). */
function classicPicture(item, wearer, onReady) {
  const img = item ? inventoryItemImage(item, wearer ?? undefined) : null;
  return img?.archive ? requestFittedIcon(img.archive, img.record, { box: SLOT_BOX.broker, dpr: screenDpr(), dye: img.dye, dyeTarget: img.dyeTarget, onReady }) : null;
}

/**
 * Mount the window in the door's host.
 * @param {HTMLElement} host
 * @param {{
 *   stock: () => any[], day: () => number, now: () => number, items: () => any[], bought: () => string[],
 *   buy: (offer: any) => { ok: boolean, reason?: string|null, text?: string|null },
 *   locked?: (() => number) | null, picture?: ((item: any) => { src: string, w: number, h: number, smooth?: boolean }|string|null) | null,
 *   wearer?: any, nameOf?: (item: any) => string, onExit?: (() => void) | null,
 * }} deps
 * @returns {{ repaint: () => void, unmount: () => void }}
 */
export function mountBrokerWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectBrokerSkinStyle();
  const nameOf = deps.nameOf ?? ((it) => String(it?.name ?? ''));
  const exit = () => deps.onExit?.();
  let pickedSlot = 0;
  /** The last press's word, and whether it was a sale (a refusal is read in the refusal's colour). */
  let note = null;
  const shell = el('div', 'broker-shell');
  shell.id = 'sigil-broker';
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', 'The Sigil Broker');
  const win = el('div', 'broker-win');
  shell.append(win);
  // AUDIT SET U4: THE WINDOW'S BONES STAND; ONLY WHAT THEY HOLD IS DRAWN AGAIN. Every repaint (a row pressed, a Buy, an
  // icon landing, the turn's clock) threw the whole window away and built a new scroll container, so the list jumped to
  // its top under a phone's thumb - the pack and both trade windows keep theirs. The header's word is a live region
  // standing the whole time (U14), so a screen reader hears a sale said.
  const head = el('header', 'broker-head');
  const title = el('div', 'broker-title');
  const sub = el('p', 'broker-sub');
  const noteLine = el('p', 'broker-note');
  noteLine.setAttribute('aria-live', 'polite');
  title.append(el('h2', null, 'The Sigil Broker'), sub, noteLine);
  const purse = el('span', 'broker-purse');
  const close = el('button', 'act broker-close', 'Close');
  close.setAttribute('type', 'button');
  close.onclick = (e) => { e.stopPropagation(); exit(); };
  head.append(title, purse, close);
  const body = el('div', 'broker-body');
  const list = el('ul', 'broker-offers');
  list.setAttribute('role', 'list');
  body.append(list);
  win.append(head, body);
  let card = null;
  let alive = true;
  /** @param {{ reveal?: boolean }} [opts] reveal: a row was pressed - the card brought into view where it stands below the list */
  const render = ({ reveal = false } = {}) => {
    if (!alive) return;
    const offers = deps.stock();
    const state = { items: deps.items(), bought: deps.bought(), day: deps.day() };
    const picture = deps.picture !== undefined ? deps.picture : (it) => classicPicture(it, deps.wearer, () => render());
    sub.textContent = `Sigil Stones buy the day's stock · it turns in ${brokerTurnText(brokerTurnsIn(deps.now()))}`;
    noteLine.textContent = note ? note.text : '';
    noteLine.className = `broker-note${note?.ok ? ' ok' : ''}`;
    if (!note) noteLine.setAttribute('hidden', ''); else noteLine.removeAttribute?.('hidden');
    purse.textContent = purseText(brokerOfferState(null, state).have, deps.locked?.() ?? 0);
    for (const c of [...list.children]) c.remove();
    for (const o of offers) {
      const s = brokerOfferState(o, state);
      const row = el('li', `broker-offer${o.slot === pickedSlot ? ' on' : ''}${s.ok ? '' : ` no-${s.reason}`}`);
      row.dataset.slot = String(o.slot);
      // U10: a row is a control - the pad's d-pad and the keyboard reach it, as the mouse always could
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-pressed', o.slot === pickedSlot ? 'true' : 'false');
      row.setAttribute('aria-label', `${nameOf(o.item)}, ${offerSetName(o)}, ${stonesText(o.price)}`);
      const r = rarityAttr(o.item);
      if (r) row.dataset.rarity = r;
      const tile = el('span', 'tile');
      const pic = picture?.(o.item) ?? null;
      // UI1: a fitted picture carries its own size; a seam's bare URL is drawn as the sheet sizes it
      if (pic && typeof pic === 'object') tile.append(fittedImg(pic));
      else if (pic) { const img = el('img'); img.setAttribute('src', pic); img.setAttribute('alt', ''); tile.append(img); } else tile.textContent = nameOf(o.item).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const frame = el('span', 'broker-frame');
      if (r) frame.dataset.rarity = r;
      markSetFrame(frame, o.item);
      frame.dataset.sigil = '';
      frame.append(tile);
      const text = el('div', 'broker-offer-body');
      text.append(el('span', 'broker-name', nameOf(o.item)), el('span', 'broker-set', `${offerSetName(o)} · ${RARITIES[r ?? 'common']?.label ?? ''}`));
      const price = el('span', 'broker-price', stonesText(o.price));
      const buy = el('button', 'act broker-buy', buyLabel(s));
      buy.setAttribute('type', 'button');
      buy.setAttribute('aria-label', s.ok ? `Buy ${nameOf(o.item)} for ${stonesText(o.price)}` : `${nameOf(o.item)}: ${BROKER_REFUSALS[s.reason] ?? ''}`);   // U14: the button says whose
      if (!s.ok) { buy.setAttribute('disabled', ''); buy.setAttribute('title', BROKER_REFUSALS[s.reason] ?? ''); }
      buy.onclick = (e) => {
        e.stopPropagation();
        const done = deps.buy(o);
        note = done?.ok ? { ok: true, text: BROKER_SOLD(nameOf(o.item), o.price) } : { ok: false, text: done?.text ?? BROKER_REFUSALS[done?.reason] ?? 'The Broker will not sell that.' };
        pickedSlot = o.slot;
        render();
      };
      const pick = () => { pickedSlot = o.slot; render({ reveal: true }); };
      row.append(frame, text, price, buy);
      row.onclick = pick;
      row.onkeydown = (e) => { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault?.(); pick(); } };
      list.append(row);
    }
    // the piece, whole: its tier's lines, its sigil, its set
    card?.remove();
    card = null;
    const o = offers.find((x) => x.slot === pickedSlot) ?? offers[0];
    if (o) {
      card = el('div', 'card broker-card');
      const r = rarityAttr(o.item);
      if (r) card.dataset.rarity = r;
      card.append(el('h3', null, nameOf(o.item)));
      const lines = rarityLines(o.item, { sigil: false, set: false });
      if (lines.length) { const ul = el('ul', 'rarity'); for (const l of lines) ul.append(el('li', null, l)); card.append(ul); }
      const sb = sigilCard(o.item);
      if (sb) card.append(sb);
      const set = setCard(o.item, deps.wearer ?? null, nameOf);
      if (set) card.append(set);
      if (isBound(o.item)) card.append(el('p', 'boundline', BOUND_LINE));   // SS4: what the stones buy stays with its buyer - said before the sale
      body.append(card);
      // U4: on a phone the card stands under the six rows - a press brings it up, rather than leaving it off the screen
      if (reveal && globalThis.matchMedia?.('(max-width: 720px)')?.matches) card.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    }
  };
  render();
  host.append(shell);
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); exit(); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.broker-win', exit);
  const tick = setInterval(() => render(), BROKER_REPAINT_MS);
  /** @type {any} */ (tick)?.unref?.();   // a page never waits on it (node's timers would hold a process open)
  return {
    repaint: () => render(),
    unmount() {
      if (!alive) return;
      alive = false;
      clearInterval(tick);
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      offOutside();
      shell.remove();
    },
  };
}
