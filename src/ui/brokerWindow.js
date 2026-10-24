// @ts-check
// SET7 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md section 7; Mac: "Sigil stones become a currency to
// trade for daily reset sigil items at a new NPC vendor that stands outside the oblivion gate"): THE BROKER'S WINDOW.
//
// The day's six offers (systems/sigil/sigilBroker.js brokerStock), each a row: the piece's picture in its tier's frame with its
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
// THE HOUSE'S SHAPE, as the tavern's (ui/enhanced/enhancedTavern.js): a lazy chunk the door (ui/brokerDoor.js) mounts in its own
// host - `mountBrokerWindow(host, deps)` answers `{ repaint, unmount }` - the back key (overlayAction's 'back': Escape,
// or a pad's) and a tap on the scrim leave through the door's own close (`deps.onExit`), never around it. Everything the
// window needs from the world is handed in: the stock and the day, the purse and the record, the sale (the host takes
// the stones, gives the piece and marks it - in that order), and the wearer whose sets the set block reads - so this
// file draws and asks, and never touches a pack.
import { rarityLines, rarityAttr, RARITIES } from '../systems/loot/lootRarity.js';
import { brokerOfferState, BROKER_REFUSALS, offerSetName, brokerTurnsIn, stonesText } from '../systems/sigil/sigilBroker.js';
import { inventoryItemImage } from '../systems/item/itemTemplates.js';
import { sigilCard } from './sigilCard.js';
import { setCard, markSetFrame } from './setCard.js';
import { requestFittedIcon, fittedImg } from './textureCanvas.js';
import { SLOT_BOX, screenDpr } from './iconFit.js';   // UI1: the offer's picture box
import { closeOnOutsideTap } from './enhanced/enhancedOverlays.js';
import { overlayAction } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhanced/enhancedStyle.js';
import { rarityVarsCss, SIGIL_VARS_CSS, SIGIL_KEYFRAMES_CSS, SIGIL_BLOCK_CSS, SET_BLOCK_CSS, BROKER_CSS } from './enhanced/enhancedPlusStyle.js';
import { frameCss, scopeRules } from './enhanced/enhancedFrame.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { isBound, BOUND_LINE } from '../systems/item/itemBound.js';   // SS4: the wares are bound, and the card says so
import { paintTitle, titleBadge } from './playerBadge.js';   // WB9g: the Gatebreaker's word, in its own fire
import { EG_SINK_EMBERS, EG_PANOPLY_IDS } from '../net/eliteGates/egPay.js';   // EG-E1: the Panoply sink's price and its nine pieces

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
export { stonesText };   // SS5: the law's own words now (systems/sigil/sigilBroker.js) - the dismantle says them too
/** The purse's words: the stones a sale may take, and the locked ones it may not ("3 Sigil Stones · 1 locked"). */
export const purseText = (have, locked = 0) => (locked > 0 ? `${stonesText(have)} · ${locked} locked` : stonesText(have));
/** The last word of a press: the piece bought, or why not (the law's refusals and the host's own). */
export const BROKER_SOLD = (name, price) => `Bought: ${name}, for ${stonesText(price)}.`;   // AUDIT SET U6: no article of its own - a Legendary's name brings one ("The Warden"), a Regalia piece's is a possessive
/** How often the window re-reads the world while it stands: the turn's clock, and a stone won or dropped meanwhile. */
export const BROKER_REPAINT_MS = 30_000;
/** WB9g (2026-09-30, Mac: "Add a brand new title to the broker and a new addition (the aura) ... These items should be
 *  expensive and sought after"): THE INSIGNIA'S WORDS - its heading, each piece's line, and its card. */
export const INSIGNIA_HEAD = 'Insignia';
export const INSIGNIA_SUB = 'Account-wide. Bought once.';   // WB13b: each line says one thing
export const INSIGNIA_LINE = Object.freeze({
  title: 'A title worn over your name',   // WB12a
  aura: 'A ring of Dagon\'s fire at your feet',
});
export const INSIGNIA_CARD = Object.freeze({
  title: ['Gatebreaker', 'Worn over your name in the breach\'s fire.', 'Paid from your account\'s embers. Wear it here or on your account card.'],   // AUDIT WB12d (A4): a broken rite's ember is the account's too, and closes no breach
  aura: ['Dagon\'s Fire', 'A ring of Dagon\'s fire at your feet, seen by every player near you.', 'Paid from your account\'s embers. Wear it here or on your account card.'],
});
/** WB9g: an insignia row's button word - why not, or what a press will do. */
export function insigniaLabel(row, { have, busy, pending }) {
  if (pending) return row.owned ? 'A moment...' : 'Buying...';
  if (row.owned) return row.worn ? 'Take off' : 'Wear';
  if (busy) return 'Buy';
  return have >= row.price ? 'Buy' : `Need ${row.price - have} more`;
}
/** EG-E1 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, THE SINK): THE
 *  BATTLEMAGE'S PANOPLY AT THE BROKER - one piece of the buyer's choosing, once an account a week, for 20 embers (the
 *  account service's - server-account/src/egEconomy.js egSink). Its heading, each piece's name and kind (section 19's
 *  table), its card, and the words of its states. */
export const PANOPLY_HEAD = 'The Battlemage\'s Panoply';
export const PANOPLY_SUB = 'One a week.';
export const PANOPLY_NAMES = Object.freeze({
  'panoply-warhelm': 'The Battlemage\'s Warhelm', 'panoply-right-pauldron': 'The Battlemage\'s Right Pauldron',
  'panoply-left-pauldron': 'The Battlemage\'s Left Pauldron', 'panoply-cuirass': 'The Battlemage\'s Cuirass',
  'panoply-gauntlets': 'The Battlemage\'s Gauntlets', 'panoply-greaves': 'The Battlemage\'s Greaves', 'panoply-boots': 'The Battlemage\'s Boots',
  'panoply-shield': 'The Spire-Shield', 'panoply-saber': 'The Spire-Saber',
});
export const PANOPLY_KINDS = Object.freeze({
  'panoply-warhelm': 'Helm', 'panoply-right-pauldron': 'Pauldron', 'panoply-left-pauldron': 'Pauldron', 'panoply-cuirass': 'Cuirass',
  'panoply-gauntlets': 'Gauntlets', 'panoply-greaves': 'Greaves', 'panoply-boots': 'Boots', 'panoply-shield': 'Kite Shield', 'panoply-saber': 'Saber',
});
export const PANOPLY_CARD = Object.freeze([
  'The war-gear the Imperial Battlemages wore in the Spire, taken by the Kyn. A Sigil Set of Mithril.',
  'Paid from your account\'s embers. One piece a week, of your choosing.',
]);
/** EG-E1: the nine rows the window draws, off the week's sale (`/v1/eg/keys`' `sink` - `{ week, piece }`; null while it is
 *  unknown): each piece's id, name and kind, whether it is this week's piece (`bought`) and whether this week's is taken
 *  (`spent`). Pure. @param {{ piece?: string|null }|null} sink */
export function panoplyRows(sink) {
  const piece = typeof sink?.piece === 'string' ? sink.piece : null;
  return EG_PANOPLY_IDS.map((id) => ({ id, name: PANOPLY_NAMES[id], kind: PANOPLY_KINDS[id], bought: piece === id, spent: piece !== null }));
}
/** EG-E1: a Panoply row's button word - what a press does, or why not. */
export function panoplyLabel(row, { have, pending }) {
  if (pending) return 'Buying...';
  if (row.bought) return 'Bought';
  if (row.spent) return 'Next week';
  return have >= EG_SINK_EMBERS ? 'Buy' : `Need ${EG_SINK_EMBERS - have} more`;
}
/** EG-E1: a Panoply row's whole reason, where its button cannot buy. */
export function panoplyWhy(row, have) {
  if (row.bought) return 'Bought this week';
  if (row.spent) return 'One a week. This week\'s is bought';
  return have >= EG_SINK_EMBERS ? '' : BROKER_REFUSALS.stones;
}

/** The Buy's own word - "Buy", or why not in a word or two that fits the button ("Need 3 more", "Bought"); the whole
 *  reason (the law's BROKER_REFUSALS) rides its title. A sentence on the button starved the name beside it to "Ruh...". */
export function buyLabel(s) {
  if (s.ok) return 'Buy';
  if (s.reason === 'stones') return `Need ${s.price - s.have} more`;
  if (s.reason === 'bought') return 'Bought';
  return 'Gone';
}

/** MENU-ORDER (bible/10-UI/Menu-Order.md; bible/10-UI/Plain-Words.md law 5, A FINGER HAS NO HOVER): A REFUSED PRESS SAYS
 *  WHY WHEN PRESSED. Never `disabled` - a disabled button takes no tap, and its whole reason stood in the hover (`title`)
 *  alone, which a finger never sees. It reads refused (`aria-disabled`, BROKER_CSS's grey), keeps the title for the
 *  pointer, and a press of it hands the reason to `tell` - the window's note line - and does nothing else: it replaces
 *  the press's own `onclick`, so it is set after it. The Broker's and the Reforge's (ui/reforgeWindow.js) alike.
 *  @param {any} btn @param {string} reason @param {(reason: string) => void} tell */
export function refusePress(btn, reason, tell) {
  btn.setAttribute('aria-disabled', 'true');
  btn.setAttribute('title', reason);
  // AUDIT MENU-ORDER U15: its name starts with the word it shows (WCAG's label in name - "Need 5 more", then whose and why)
  const word = String(btn.textContent ?? '').trim();
  const said = btn.getAttribute('aria-label') || reason;
  if (word && !said.startsWith(word)) btn.setAttribute('aria-label', `${word} - ${said}`);
  btn.onclick = (e) => {
    e?.stopPropagation?.();
    // AUDIT MENU-ORDER U4: the keys stay where the press was - a window that draws again on the word finds it by its name
    const doc = btn.ownerDocument, held = !!doc && doc.activeElement === btn, name = btn.getAttribute('aria-label'), win = btn.closest?.('.broker-win');
    tell(reason);
    if (held && btn.isConnected === false && win && name) [...(win.querySelectorAll?.('[aria-disabled="true"]') ?? [])].find((b) => b.getAttribute('aria-label') === name)?.focus?.();
  };
}

/** The kit's rules cut to a surface's own selectors - the kit's module holds it now (NAV-F: the naval readout lays its
 *  share too, and a HUD in the main bundle must not import this lazy chunk for it); said here still for its callers. */
export { scopeRules };

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

/** WB9g: a piece of the insignia's sign - the title's word in its own fire, or the aura's ring turning - the row's small
 *  one, or the card's large (`hero`). AUDIT WB9 (the shots): the row's sign is 36 px and the whole word ~55 px at its
 *  8 px, so a row read "tebreak" - the row's sign is the word's first letter, large, and the row's name beside it says
 *  the word. */
function insigniaSign(g, hero = false) {
  const sign = el('span', `insignia-sign insig-${g.kind}${hero ? ' hero' : ''}`);
  if (g.kind === 'title') {
    const word = el('span', hero ? 'insignia-word' : 'insignia-word mono', hero ? g.name : [...g.name][0] ?? '');
    paintTitle(word, titleBadge({ title: g.key }));
    sign.append(word);
  } else sign.append(el('span', `aura-ring aura-${g.key}`));
  return sign;
}

/**
 * Mount the window in the door's host.
 * @param {HTMLElement} host
 * @param {{
 *   stock: () => any[], day: () => number, now: () => number, items: () => any[], bought: () => string[],
 *   buy: (offer: any) => { ok: boolean, reason?: string|null, text?: string|null },
 *   locked?: (() => number) | null, picture?: ((item: any) => { src: string, w: number, h: number, smooth?: boolean }|string|null) | null,
 *   wearer?: any, nameOf?: (item: any) => string, onExit?: (() => void) | null,
 *   insignia?: (() => Array<{ id: string, kind: string, key: string, price: number, name: string, owned: boolean, worn: boolean }>) | null,
 *   insigniaLoad?: (() => Promise<void>) | null, buyInsignia?: ((row: any) => Promise<{ ok: boolean, text?: string|null }>) | null,
 *   wearInsignia?: ((row: any) => Promise<{ ok: boolean, text?: string|null }>) | null, insigniaBusy?: (() => boolean) | null,
 *   panoply?: { rows: () => Array<{ id: string, name: string, kind?: string, bought: boolean, spent: boolean }>,
 *     buy: (id: string) => Promise<{ ok: boolean, text?: string|null }>, load?: (() => Promise<void>) | null, busy?: (() => boolean) | null } | null,
 * }} deps
 *   WB9g: `insignia` the Broker's insignia as the account holds them (net/insignia.js - the host's rows, the service's word),
 *   `insigniaLoad` asked once as the window opens (the account's wardrobe), `buyInsignia` and `wearInsignia` the account's
 *   sale and its wearing - each a promise; the window says "Buying..." until it answers.
 *   EG-E1: `panoply` the Broker's Panoply sink - its nine rows (panoplyRows off the week's sale), the sale (`buy` - the
 *   host's systems/sigil/sigilBroker.js panoplySale), `load` asked once as the window opens (the week's sale), `busy` the host's
 *   own hold. Absent, the window is as it was.
 * @returns {{ repaint: () => void, unmount: () => void }}
 */
export function mountBrokerWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectBrokerSkinStyle();
  const nameOf = deps.nameOf ?? ((it) => String(it?.name ?? ''));
  const exit = () => deps.onExit?.();
  let pickedSlot = 0;
  /** WB9g: the insignia row pressed (its card shown in place of a ware's), and the one whose press is in flight */
  let pickedInsig = null, pendingInsig = null;
  /** EG-E1: the Panoply row pressed (its card shown - while no ware's row (`pickedSlot` -1) nor insignia's is), and the one
   *  whose sale is in flight; a Panoply sale holds every other sale, as an insignia's does (AUDIT WB9 F2) */
  let pickedPan = null, pendingPan = null;
  const outer = deps;
  deps = { ...outer, insigniaBusy: () => !!outer.insigniaBusy?.() || pendingPan !== null || !!outer.panoply?.busy?.() };
  /** The last press's word, and whether it was a sale (a refusal is read in the refusal's colour). */
  let note = null;
  /** MENU-ORDER: a refused press's reason, said in the note (refusePress) - the note alone drawn again (AUDIT MENU-ORDER
   *  U4: the whole list drawn again took the keys' focus off the press) */
  const refused = (reason) => {
    note = { ok: false, text: reason };
    noteLine.textContent = reason;
    noteLine.className = 'broker-note';
    noteLine.removeAttribute?.('hidden');
  };
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
  /** U10: A ROW IS A CONTROL - the pad's d-pad and the keyboard reach it, as the mouse always could; a key pressed on the
   *  row picks it, and one pressed on its button is the button's. WB9g: the wares' rows and the insignia's alike. */
  const pressable = (row, pick) => {
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.onclick = pick;
    row.onkeydown = (e) => { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault?.(); pick(); } };
  };
  /** @param {{ reveal?: boolean }} [opts] reveal: a row was pressed - the card brought into view where it stands below the list */
  const render = ({ reveal = false } = {}) => {
    if (!alive) return;
    const offers = deps.stock();
    const state = { items: deps.items(), bought: deps.bought(), day: deps.day() };
    const picture = deps.picture !== undefined ? deps.picture : (it) => classicPicture(it, deps.wearer, () => render());
    sub.textContent = `New stock in ${brokerTurnText(brokerTurnsIn(deps.now()))}`;   // WB12a; WB13b: the prices say Embers
    noteLine.textContent = note ? note.text : '';
    noteLine.className = `broker-note${note?.ok ? ' ok' : ''}`;
    if (!note) noteLine.setAttribute('hidden', ''); else noteLine.removeAttribute?.('hidden');
    purse.textContent = purseText(brokerOfferState(null, state).have, deps.locked?.() ?? 0);
    for (const c of [...list.children]) c.remove();
    for (const o of offers) {
      const s = brokerOfferState(o, state);
      const row = el('li', `broker-offer${o.slot === pickedSlot && !pickedInsig ? ' on' : ''}${s.ok ? '' : ` no-${s.reason}`}`);
      row.dataset.slot = String(o.slot);
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
      if (s.ok && (pendingInsig || deps.insigniaBusy?.())) buy.setAttribute('disabled', '');   // AUDIT WB9 (insignia F2): nothing else sold while a piece of the insignia is
      buy.onclick = (e) => {
        e.stopPropagation();
        if (pendingInsig || deps.insigniaBusy?.()) return;
        const done = deps.buy(o);
        note = done?.ok ? { ok: true, text: BROKER_SOLD(nameOf(o.item), o.price) } : { ok: false, text: done?.text ?? BROKER_REFUSALS[done?.reason] ?? 'The Broker will not sell that.' };
        pickedSlot = o.slot;
        render();
      };
      if (!s.ok) refusePress(buy, BROKER_REFUSALS[s.reason] ?? '', refused);   // MENU-ORDER: pressed, it says why
      row.append(frame, text, price, buy);
      pressable(row, () => { pickedSlot = o.slot; pickedInsig = null; render({ reveal: true }); });   // U10
      list.append(row);
    }
    // WB9g: THE INSIGNIA, under the day's stock - its heading, then a row a piece in the wares' own grid
    const insig = deps.insignia?.() ?? [];
    if (insig.length) {
      const head = el('li', 'broker-insignia-head');
      head.setAttribute('role', 'presentation');
      head.append(el('span', 'broker-insignia-title', INSIGNIA_HEAD), el('span', 'broker-set', INSIGNIA_SUB));
      list.append(head);
      const have = brokerOfferState(null, state).have, busy = !!deps.insigniaBusy?.();
      for (const g of insig) {
        const row = el('li', `broker-offer broker-insig${pickedInsig === g.id ? ' on' : ''}${g.owned ? ' owned' : ''}${g.worn ? ' worn' : ''}`);
        row.dataset.insignia = g.id;
        row.setAttribute('aria-pressed', pickedInsig === g.id ? 'true' : 'false');
        row.setAttribute('aria-label', `${g.name}, ${g.kind === 'title' ? 'a title' : 'an aura'}, ${stonesText(g.price)}${g.owned ? ', owned' : ''}${g.worn ? ', worn' : ''}`);
        const frame = el('span', 'broker-frame insignia-frame');
        frame.append(insigniaSign(g));
        const text = el('div', 'broker-offer-body');
        text.append(el('span', 'broker-name', g.name), el('span', 'broker-set', INSIGNIA_LINE[g.kind] ?? ''));
        const price = el('span', 'broker-price', g.owned ? (g.worn ? 'Worn' : 'Owned') : stonesText(g.price));
        const btn = el('button', 'act broker-buy', insigniaLabel(g, { have, busy, pending: pendingInsig === g.id }));
        btn.setAttribute('type', 'button');
        const can = g.owned || have >= g.price;
        if (busy || pendingInsig) btn.setAttribute('disabled', '');   // in flight: nothing pressable, and nothing to say
        btn.onclick = (e) => {
          e.stopPropagation();
          const act = g.owned ? deps.wearInsignia : deps.buyInsignia;
          if (!act || pendingInsig) return;
          pendingInsig = g.id; pickedInsig = g.id;
          render();
          Promise.resolve().then(() => act(g)).then((done) => {
            note = done?.ok ? { ok: true, text: done.text ?? '' } : { ok: false, text: done?.text ?? 'The Broker will not sell that.' };
          }, () => { note = { ok: false, text: 'The Broker will not sell that.' }; }).finally(() => { pendingInsig = null; render(); });
        };
        if (!can && !busy && !pendingInsig) refusePress(btn, BROKER_REFUSALS.stones, refused);   // MENU-ORDER: pressed, it says why
        row.append(frame, text, price, btn);
        pressable(row, () => { pickedInsig = g.id; render({ reveal: true }); });
        list.append(row);
      }
    }
    // EG-E1: THE BATTLEMAGE'S PANOPLY, under the insignia - its heading and price, then a row a piece in the wares' own grid
    const panRows = deps.panoply?.rows;   // the sink's nine rows (EG-E1) - the host's, never a TEXT.RSC read
    const pan = typeof panRows === 'function' ? panRows() : [];
    const panPick = pickedPan && pickedSlot === -1 && !pickedInsig ? pan.find((x) => x.id === pickedPan) ?? null : null;
    if (pan.length) {
      const head = el('li', 'broker-insignia-head broker-panoply-head');
      head.setAttribute('role', 'presentation');
      head.append(el('span', 'broker-insignia-title', PANOPLY_HEAD), el('span', 'broker-set', `${stonesText(EG_SINK_EMBERS)}. ${PANOPLY_SUB}`));
      list.append(head);
      const have = brokerOfferState(null, state).have, busy = !!pendingInsig || !!deps.insigniaBusy?.();
      for (const p of pan) {
        const row = el('li', `broker-offer broker-panoply${panPick?.id === p.id ? ' on' : ''}${p.bought ? ' owned' : ''}`);
        row.dataset.panoply = p.id;
        row.setAttribute('aria-pressed', panPick?.id === p.id ? 'true' : 'false');
        row.setAttribute('aria-label', `${p.name}, ${stonesText(EG_SINK_EMBERS)}${p.bought ? ', bought this week' : ''}`);
        // the piece's kind in its tile, as a ware with no picture is drawn (its records are the host's, never this window's)
        const frame = el('span', 'broker-frame');
        frame.append(el('span', 'tile', String(p.kind ?? p.name).split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase()));
        const text = el('div', 'broker-offer-body');
        text.append(el('span', 'broker-name', p.name), el('span', 'broker-set', p.kind ?? ''));
        const price = el('span', 'broker-price', p.bought ? 'Bought' : stonesText(EG_SINK_EMBERS));
        const btn = el('button', 'act broker-buy', panoplyLabel(p, { have, pending: pendingPan === p.id }));
        btn.setAttribute('type', 'button');
        const why = panoplyWhy(p, have);
        if (why || busy) btn.setAttribute('disabled', '');
        if (why) btn.setAttribute('title', why);
        btn.onclick = (e) => {
          e.stopPropagation();
          if (why || pendingPan || pendingInsig || deps.insigniaBusy?.() || !deps.panoply?.buy) return;
          pendingPan = p.id; pickedPan = p.id; pickedSlot = -1; pickedInsig = null;
          render();
          Promise.resolve().then(() => deps.panoply?.buy(p.id)).then((done) => {
            note = done?.ok ? { ok: true, text: done.text ?? BROKER_SOLD(p.name, EG_SINK_EMBERS) } : { ok: false, text: done?.text ?? 'The Broker will not sell that.' };
          }, () => { note = { ok: false, text: 'The Broker will not sell that.' }; }).finally(() => { pendingPan = null; render(); });
        };
        row.append(frame, text, price, btn);
        pressable(row, () => { pickedPan = p.id; pickedSlot = -1; pickedInsig = null; render({ reveal: true }); });
        list.append(row);
      }
    }
    // the piece, whole: its tier's lines, its sigil, its set
    card?.remove();
    card = null;
    const pickedG = pickedInsig ? insig.find((x) => x.id === pickedInsig) : null;
    if (pickedG) {
      // WB9g: a piece of the insignia, whole - its sign large, its name, what it is and how it is kept
      card = el('div', 'card broker-card broker-insignia-card');
      const hero = el('div', 'insignia-hero');
      hero.append(insigniaSign(pickedG, true));
      const [name, what, kept] = INSIGNIA_CARD[pickedG.kind] ?? [pickedG.name, '', ''];
      card.append(hero, el('h3', null, name), el('p', 'insignia-what', what), el('p', 'insignia-kept', kept));
      card.append(el('p', 'boundline', pickedG.owned ? (pickedG.worn ? 'Owned and worn.' : 'Owned.') : `${stonesText(pickedG.price)}. One per account.`));   // WB13b
      body.append(card);
      if (reveal && globalThis.matchMedia?.('(max-width: 720px)')?.matches) card.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      return;
    }
    if (panPick) {
      // EG-E1: a Panoply piece, whole - its name, what the set is, how it is paid, and the week's state
      card = el('div', 'card broker-card broker-panoply-card');
      card.append(el('h3', null, panPick.name), el('p', 'insignia-what', PANOPLY_CARD[0]), el('p', 'insignia-kept', PANOPLY_CARD[1]));
      card.append(el('p', 'boundline', panPick.bought ? 'Bought this week.' : panPick.spent ? 'This week\'s piece is bought. Come back next week.' : `${stonesText(EG_SINK_EMBERS)}. One a week.`));
      body.append(card);
      if (reveal && globalThis.matchMedia?.('(max-width: 720px)')?.matches) card.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      return;
    }
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
  // WB9g: the account's insignia asked once as the window opens - the rows say "Buy" until it answers, then the truth
  if (deps.insigniaLoad) Promise.resolve().then(() => deps.insigniaLoad()).catch(() => null).then(() => render());
  // EG-E1: the week's Panoply sale asked once as the window opens - the rows say "Buy" until it answers
  if (deps.panoply?.load) Promise.resolve().then(() => deps.panoply?.load?.()).catch(() => null).then(() => render());
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
