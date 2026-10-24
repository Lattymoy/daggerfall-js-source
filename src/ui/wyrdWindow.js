// @ts-check
// WITCH1 (2026-10-20, the owner: "A new vendor that stands outside of each tavern in which offers new seasonal items. A
// new armor set, a new weapon, a new title and aura, a brand new item (profile icon), new cards"; bible/06-Systems/
// Witches-Festival.md): THE WYRD SISTER'S WINDOW - the Witches' Festival's wares for Soul Cakes.
//
// Four parts, each a heading and its rows: THE INSIGNIA (the Witchwarden title, the Witchfire aura, three profile icons -
// the account's, bought once - and the two the festival gives: Hearthkeeper, for cakes given from an offering, and the
// Soul Cake icon, for cakes taken; and, AUDIT STAR8 T3, the Starwarden beside Hearthkeeper - The Thirteenth of
// Frostfall's title, Morwen's coven being the Wyrd's own: shown, never sold), THE WYRD'S RAIMENT (the set's nine
// pieces, the Athame its weapon), THE ILIAC HAND (the festival's six cards) and the HEARTH OFFERING. A row: its picture, its name and kind, its price, and one press - Buy,
// Wear or Take off - that says why it cannot when it cannot. A row pressed shows it whole beside the list: a piece's
// lines and its set, a card's rules, an insignia's sign large.
//
// THE BROKER'S HOUSE (ui/brokerWindow.js): its sheet and its classes, the festival's colours over them (`WYRD_CSS`), its
// door's shape (ui/wyrdDoor.js) - `mountWyrdWindow(host, deps)` answers `{ repaint, unmount }`; the back key and a tap on
// the scrim leave by `deps.onExit`. It draws and asks: what the account holds, the sale and the wearing are the host's
// (scenes/witchesHost.js, systems/festival/festivalClient.js). Every word is the text core's (festivalWords.js, `t`).
// Not a DFU member. Ledger A (THE WITCHES' FESTIVAL).
import { rarityLines, rarityAttr } from '../systems/loot/lootRarity.js';
import { inventoryItemImage } from '../systems/item/itemTemplates.js';
import { setCard } from './setCard.js';
import { requestFittedIcon, fittedImg } from './textureCanvas.js';
import { SLOT_BOX, screenDpr } from './iconFit.js';
import { closeOnOutsideTap } from './enhanced/enhancedOverlays.js';
import { overlayAction } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhanced/enhancedStyle.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { brokerSkinCss, BROKER_SKIN_STYLE_ID, refusePress } from './brokerWindow.js';
import { paintTitle, titleBadge, TITLE_TEXT, AURA_TEXT, WITCH_FIRE, WITCH_GLOW, WITCH_MOSS, WITCH_VIOLET } from './playerBadge.js';
import { profileIconNode, ICON_TEXT } from './profileIcons.js';
import { iliacCardLines } from '../systems/iliac/iliacItems.js';
import { SOUL_CAKE_TEXT } from '../systems/festival/soulCake.js';
import { cakesText, festivalName, vendorOffice, festivalNightText, festivalRefusalText, findsTodayText, findsTodayFullText } from '../systems/festival/festivalWords.js';
import { FESTIVAL_WARES, accountWare, HEARTHKEEPER_GIVEN, SOULCAKE_TAKEN } from '../net/festivalLaw.js';
import { t } from '../systems/textManager.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** The window's parts, in its order, and each part's heading and line. */
const PARTS = Object.freeze(['insignia', 'raiment', 'cards', 'offering']);
const PART_WORDS = Object.freeze({
  insignia: () => [t('festival.window.insignia', 'Insignia'), t('festival.window.insigniaSub', 'Account-wide. Kept for good.')],
  raiment: () => [t('festival.window.raiment', "The Wyrd's Raiment"), t('festival.window.raimentSub', 'An Aetheric set of nine. Bound to you.')],
  cards: () => [t('festival.window.cards', 'The Iliac Hand'), t('festival.window.cardsSub', 'Festival cards. Never in a pack.')],
  offering: () => [t('festival.window.offering', 'Hearth Offering'), t('festival.window.offeringSub', 'Set it out at your own door.')],
});
const partOf = (/** @type {{ kind: string }} */ w) => (accountWare(w) ? 'insignia' : w.kind === 'piece' ? 'raiment' : w.kind === 'card' ? 'cards' : 'offering');
/** What kind an insignia is, in a word. */
const KIND_WORD = Object.freeze({
  title: () => t('festival.window.kindTitle', 'Title'), aura: () => t('festival.window.kindAura', 'Aura'), icon: () => t('festival.window.kindIcon', 'Profile icon'),
});
/** An insignia's name, as the badge's own tables say it. */
const insigniaName = (/** @type {string} */ kind, /** @type {string} */ key) => (kind === 'title' ? TITLE_TEXT[/** @type {keyof typeof TITLE_TEXT} */ (key)] : kind === 'aura' ? AURA_TEXT[/** @type {keyof typeof AURA_TEXT} */ (key)] : ICON_TEXT[/** @type {keyof typeof ICON_TEXT} */ (key)]) ?? key;
/** What an insignia does, in a line, for its card. */
const INSIGNIA_WHAT = Object.freeze({
  title: () => t('festival.window.whatTitle', 'Worn over your name, for every player to see.'),
  aura: () => t('festival.window.whatAura', 'A ring of witchfire and candles at your feet.'),
  icon: () => t('festival.window.whatIcon', 'Shown in your portrait in place of your face.'),
});

/**
 * THE ROWS, off what the account holds: each ware (festivalLaw FESTIVAL_WARES) with its part and name, and the two the
 * festival gives (`earned` - their progress toward it in `progress`, `?` while the account's count is unheard). `owned`
 * an account ware the account holds, `worn` the one worn of its kind. AUDIT STAR8 T3: and the Starwarden, the Festival's
 * questline's title - held when the wardrobe's `titles` say so (the service lays it, net/questlineClaims.js), no count
 * to show. Pure.
 * @param {{ wares?: string[], given?: number|null, taken?: number|null }} state @param {{ title?: string|null, aura?: string|null, icon?: string|null, titles?: string[] } | null} worn
 * @param {(w: any) => any} itemOf the pack's piece a ware mints (its picture and its card), or null
 * @param {(item: any) => string} nameOf
 */
export function wyrdRows(state, worn, itemOf, nameOf) {
  const wares = state?.wares ?? [];
  const wearing = (/** @type {string} */ kind, /** @type {string} */ key) => (kind === 'title' ? worn?.title : kind === 'aura' ? worn?.aura : worn?.icon) === key;
  /** @type {Array<{ id: string, part: string, kind: string, key: string, price: number|null, item: any, name: string, owned: boolean, worn: boolean, earned: string|null, progress: string|null }>} */
  const rows = FESTIVAL_WARES.map((w) => {
    const item = accountWare(w) ? null : itemOf(w);
    return {
      id: w.id, part: partOf(w), kind: w.kind, key: w.key, price: w.price, item,
      name: accountWare(w) ? insigniaName(w.kind, w.key) : item ? nameOf(item) : w.key,
      owned: accountWare(w) && wares.includes(w.id), worn: accountWare(w) && wearing(w.kind, w.key), earned: null, progress: null,
    };
  });
  const gift = (/** @type {string} */ kind, /** @type {string} */ key, /** @type {number|null|undefined} */ have, /** @type {number} */ need, /** @type {string} */ how, counted = true) => {
    const heard = Number.isSafeInteger(have);
    return {
      id: `earned:${key}`, part: 'insignia', kind, key, price: null, item: null, name: insigniaName(kind, key),
      owned: heard && Number(have) >= need, worn: wearing(kind, key), earned: how,
      progress: counted ? `${heard ? Math.min(Number(have), need) : '?'}/${need}` : null,
    };
  };
  const at = rows.findIndex((r) => r.part !== 'insignia');
  rows.splice(at, 0,
    gift('title', 'hearthkeeper', state?.given, HEARTHKEEPER_GIVEN, t('festival.window.earnGiven', 'Earned when others take Soul Cakes from your offerings.')),
    gift('title', 'starwarden', worn?.titles?.includes('starwarden') ? 1 : 0, 1, t('festival.window.earnStarwarden', 'Earned on The Thirteenth of Frostfall.'), false),   // AUDIT STAR8 T3
    gift('icon', 'soulcake', state?.taken, SOULCAKE_TAKEN, t('festival.window.earnTaken', "Earned by taking Soul Cakes from others' offerings.")));
  return rows;
}

/** The press a row shows, and why it cannot be pressed (null when it can): `shut` why the festival is not played here
 *  (festivalClient festivalShut - a guest, offline, closed), or null. Pure. */
export function wyrdPress(/** @type {any} */ row, /** @type {{ cakes: number|null, shut: string|null, busy: boolean }} */ s) {
  if (row.worn) return { label: t('festival.window.takeOff', 'Take off'), why: null };
  if (row.owned) return { label: t('festival.window.wear', 'Wear'), why: null };
  if (row.earned) return { label: row.progress ?? t('festival.window.notYet', 'Not yet'), why: row.earned };   // AUDIT STAR8 T3: a title with no count
  const need = row.price - (s.cakes ?? 0);
  if (s.shut) return { label: t('festival.window.buy', 'Buy'), why: festivalRefusalText(s.shut) };
  if (s.cakes != null && need > 0) return { label: t('festival.window.need', '{n} more', { n: need }), why: festivalRefusalText('cakes') };
  return { label: t('festival.window.buy', 'Buy'), why: null };
}

/** How often an open window looks again at what no answer says (ms). */
export const WYRD_WATCH_MS = 2000;
/** THE FESTIVAL'S COLOURS over the Broker's sheet: the moss and the witchfire for the Deadlands' red, the icons' tiles,
 *  the Witchfire aura's ring (green fire and its candles' glow). */
export const WYRD_STYLE_ID = 'wyrd-style';
/** A badge colour (playerBadge.js's linear RGBA) as the sheet's hex. */
const hex = (/** @type {ReadonlyArray<number>} */ c) => `#${c.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
const [MOSS, FIRE, GLOW, VIOLET] = [WITCH_MOSS, WITCH_FIRE, WITCH_GLOW, WITCH_VIOLET].map(hex);
export const WYRD_CSS = `
.wyrd-shell .broker-title h2 { color: ${GLOW}; text-shadow: 2px 2px 0 #050608, 0 0 10px ${FIRE}55; }
.wyrd-shell .broker-purse { color: #f6e2b8; border-color: ${MOSS}; background: rgba(28,52,22,0.55); box-shadow: 0 0 8px ${FIRE}55; }
.wyrd-shell .broker-note.ok { color: ${GLOW}; }
.wyrd-shell .broker-price { color: #f6e2b8; }
.wyrd-shell .broker-insignia-title { color: ${FIRE}; text-shadow: 1px 1px 0 #050608, 0 0 8px ${FIRE}88; }
.wyrd-shell .broker-insig .broker-frame { border-color: ${FIRE} #10240c #10240c ${FIRE};
  background: radial-gradient(ellipse at 50% 62%, ${FIRE}55, transparent 70%), rgba(6,16,4,0.85); }
.wyrd-shell .wyrd-night { margin: 2px 0 0; font-size: 12px; color: ${VIOLET}; }
.wyrd-shell .wyrd-today { margin: 2px 0 0; font-size: 12px; color: #f6e2b8; }
.wyrd-shell .aura-ring.aura-witchfire { background: conic-gradient(from 0deg, ${FIRE}, ${MOSS}, ${GLOW}, ${FIRE}, ${MOSS}, ${GLOW}, ${FIRE});
  filter: drop-shadow(0 0 4px ${FIRE}); }
.wyrd-shell .insignia-sign.hero .aura-ring.aura-witchfire { filter: drop-shadow(0 0 12px ${FIRE}) drop-shadow(0 0 3px ${GLOW}); }
.wyrd-shell svg.wyrd-icon { display: block; }
.wyrd-shell .insignia-sign.hero svg.wyrd-icon { width: 110px; height: 110px; }
.wyrd-shell .broker-insig.earned:not(.owned) .broker-name { opacity: 0.7; }
.wyrd-shell .broker-card { position: sticky; top: 0; }
.wyrd-shell .broker-buy, .wyrd-shell .broker-price { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
function injectWyrdStyle(doc = document) {
  if (!isEnhancedPlus() && !doc.getElementById?.(BROKER_SKIN_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = BROKER_SKIN_STYLE_ID;
    st.textContent = brokerSkinCss();
    (doc.head ?? doc.body).append(st);
  }
  if (doc.getElementById?.(WYRD_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = WYRD_STYLE_ID;
  st.textContent = WYRD_CSS;
  (doc.head ?? doc.body).append(st);
}

/** An insignia's sign: the title's word in its colours (its first letter on a row), the aura's ring, the icon itself. */
function insigniaSign(/** @type {any} */ row, hero = false) {
  const sign = el('span', ['insignia-sign', `insig-${row.kind}`, ...(hero ? ['hero'] : [])].join(' '));
  if (row.kind === 'title') {
    const word = el('span', hero ? 'insignia-word' : 'insignia-word mono', hero ? row.name : [...row.name][0] ?? '');
    paintTitle(word, titleBadge({ title: row.key }));
    sign.append(word);
  } else if (row.kind === 'aura') sign.append(el('span', ['aura-ring', `aura-${row.key}`].join(' ')));
  else { const svg = profileIconNode(document, row.key, 'wyrd-icon', hero ? 110 : 36); if (svg) { svg.setAttribute('aria-hidden', 'true'); sign.append(svg); } }   // its name stands beside it
  return sign;
}

/**
 * Mount the window in the door's host.
 * @param {HTMLElement} host
 * @param {{
 *   state: () => { cakes: number|null, wares: string[], given: number|null, taken: number|null }, worn: () => any,
 *   shut: () => string|null, lastDay: () => string, night: () => boolean,
 *   itemOf: (w: any) => any, nameOf: (item: any) => string, wearer?: any,
 *   buy: (id: string) => Promise<{ ok: boolean, text: string }>, wear: (row: any) => Promise<{ ok: boolean, text: string }>,
 *   load?: () => Promise<any>, hear?: (fn: () => void) => () => void, onExit?: () => void,
 *   today?: () => { found: number|null, max: number, full: boolean, resetMs: number },
 * }} deps
 * @returns {{ repaint: () => void, unmount: () => void }}
 */
export function mountWyrdWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectWyrdStyle();
  const exit = () => deps.onExit?.();
  /** The minted pieces, once each - their pictures and cards. */
  const items = new Map();
  const itemOf = (/** @type {any} */ w) => { if (!items.has(w.id)) items.set(w.id, deps.itemOf(w)); return items.get(w.id); };
  let picked = null, pending = null, reveal = false;
  let note = /** @type {{ ok: boolean, text: string } | null} */ (null);
  const say = (/** @type {string} */ text, ok = false) => { note = text ? { ok, text } : null; render(); };
  const shell = el('div', 'broker-shell wyrd-shell');
  shell.id = 'wyrd-sister';
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', vendorOffice());
  const win = el('div', 'broker-win');
  shell.append(win);
  const head = el('header', 'broker-head');
  const title = el('div', 'broker-title');
  const sub = el('p', 'broker-sub');
  const night = el('p', 'wyrd-night');
  const todayLine = el('p', 'wyrd-today');   // CAKE-CAP-SAID: the day's finds, and when more are found once they are spent
  const noteLine = el('p', 'broker-note');
  noteLine.setAttribute('aria-live', 'polite');
  title.append(el('h2', null, vendorOffice()), sub, night, todayLine, noteLine);
  const purse = el('span', 'broker-purse');
  const close = el('button', 'act broker-close', t('festival.window.close', 'Close'));
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
  const pressable = (/** @type {HTMLElement} */ row, /** @type {() => void} */ pick) => {
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.onclick = pick;
    row.onkeydown = (e) => { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault?.(); pick(); } };
  };
  const tile = (/** @type {any} */ row) => {
    const frame = el('span', `broker-frame${row.part === 'insignia' ? ' insignia-frame' : ''}`);
    if (row.part === 'insignia') { frame.append(insigniaSign(row)); return frame; }
    const r = rarityAttr(row.item);
    if (r) frame.dataset.rarity = r;
    const img = row.item ? inventoryItemImage(row.item, deps.wearer ?? undefined) : null;
    const pic = img?.archive ? requestFittedIcon(img.archive, img.record, { box: SLOT_BOX.broker, dpr: screenDpr(), dye: img.dye, dyeTarget: img.dyeTarget, onReady: () => render() }) : null;
    const box = el('span', 'tile');
    if (pic && typeof pic === 'object') box.append(fittedImg(pic)); else box.textContent = String(row.name).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    frame.append(box);
    return frame;
  };
  const press = async (/** @type {any} */ row) => {
    if (pending) return;
    pending = row.id; picked = row.id;
    render();
    const done = await Promise.resolve().then(() => (row.owned || row.worn ? deps.wear(row) : deps.buy(row.id))).catch(() => null);
    pending = null;
    say(done?.ok ? (done.text || (row.owned || row.worn ? '' : t('festival.window.bought', 'Bought: {name}.', { name: row.name }))) : done?.text ?? t('festival.refusal.offline', 'The Wyrd cannot hear you right now.'), !!done?.ok);
  };
  const render = () => {
    if (!alive) return;
    const st = deps.state();
    const rows = wyrdRows(st, deps.worn(), itemOf, deps.nameOf);
    const s = { cakes: st.cakes, shut: deps.shut(), busy: pending != null };
    sub.textContent = t('festival.window.until', '{festival} - until {last}.', { festival: festivalName(), last: deps.lastDay() });
    night.textContent = deps.night() ? festivalNightText() : '';
    if (deps.night()) night.removeAttribute('hidden'); else night.setAttribute('hidden', '');
    // CAKE-CAP-SAID: the day's finds (systems/festival/festivalClient.js festivalFindsToday) - nothing while unheard
    const day = deps.today?.() ?? null;
    todayLine.textContent = day?.found == null ? '' : day.full ? findsTodayFullText(day.max, day.resetMs) : findsTodayText(day.found, day.max);
    if (todayLine.textContent) todayLine.removeAttribute('hidden'); else todayLine.setAttribute('hidden', '');
    // why nothing can be bought here, said before a press asks it - offline, a guest, the festival shut (AUDIT WITCH1 G2)
    const told = note ?? (s.shut ? { ok: false, text: festivalRefusalText(s.shut) } : null);
    noteLine.textContent = told ? told.text : '';
    noteLine.className = `broker-note${told?.ok ? ' ok' : ''}`;
    if (!told) noteLine.setAttribute('hidden', ''); else noteLine.removeAttribute('hidden');
    purse.textContent = st.cakes == null ? t('festival.window.cakesUnknown', 'Soul Cakes: ?') : cakesText(st.cakes);
    for (const c of [...list.children]) c.remove();
    for (const part of PARTS) {
      const [h, line] = PART_WORDS[part]();
      const hd = el('li', 'broker-insignia-head');
      hd.setAttribute('role', 'presentation');
      hd.append(el('span', 'broker-insignia-title', h), el('span', 'broker-set', line));
      list.append(hd);
      for (const row of rows.filter((r) => r.part === part)) {
        const li = el('li', `broker-offer${part === 'insignia' ? ' broker-insig' : ''}${picked === row.id ? ' on' : ''}${row.owned ? ' owned' : ''}${row.worn ? ' worn' : ''}${row.earned ? ' earned' : ''}`);
        li.dataset.ware = row.id;
        const r = rarityAttr(row.item);
        if (r) li.dataset.rarity = r;
        li.setAttribute('aria-pressed', picked === row.id ? 'true' : 'false');
        const text = el('div', 'broker-offer-body');
        // its kind in a word (an insignia's, a part's heading) - the bowl's own line, never its name twice
        const kind = part === 'insignia' ? KIND_WORD[/** @type {keyof typeof KIND_WORD} */ (row.kind)]() : part === 'offering' ? PART_WORDS.offering()[1] : PART_WORDS[part]()[0];
        text.append(el('span', 'broker-name', row.name), el('span', 'broker-set', kind));
        // an earned row's progress is its press's word, never said twice
        const price = el('span', 'broker-price', row.worn ? t('festival.window.worn', 'Worn') : row.owned ? t('festival.window.owned', 'Owned') : row.price != null ? cakesText(row.price) : '');
        const p = wyrdPress(row, s);
        const btn = el('button', 'act broker-buy', pending === row.id ? '...' : p.label);
        btn.setAttribute('type', 'button');
        btn.setAttribute('aria-label', `${p.label} - ${row.name}`);
        if (pending && pending !== row.id) btn.setAttribute('disabled', '');
        if (p.why) refusePress(btn, p.why, (reason) => say(reason));
        else btn.onclick = (e) => { e.stopPropagation(); void press(row); };
        li.append(tile(row), text, price, btn);
        pressable(li, () => { picked = row.id; reveal = true; render(); });
        list.append(li);
      }
    }
    // the row pressed, whole
    card?.remove();
    card = null;
    const row = rows.find((x) => x.id === picked) ?? null;
    if (!row) return;
    card = el('div', ['card', 'broker-card', ...(row.part === 'insignia' ? ['broker-insignia-card'] : [])].join(' '));
    if (row.part === 'insignia') {
      const hero = el('div', 'insignia-hero');
      hero.append(insigniaSign(row, true));
      card.append(hero, el('h3', null, row.name), el('p', 'insignia-what', INSIGNIA_WHAT[/** @type {keyof typeof INSIGNIA_WHAT} */ (row.kind)]()));
      card.append(el('p', 'insignia-kept', row.earned ?? t('festival.window.kept', 'One per account, kept for good.')));
    } else {
      const r = rarityAttr(row.item);
      if (r) card.dataset.rarity = r;
      card.append(el('h3', null, row.name));
      const lines = row.part === 'raiment' ? rarityLines(row.item, { sigil: false, set: false }) : row.part === 'cards' ? iliacCardLines(row.item) : SOUL_CAKE_TEXT.offering();
      if (lines.length) { const ul = el('ul', 'rarity'); for (const l of lines) ul.append(el('li', null, l)); card.append(ul); }
      const set = row.part === 'raiment' ? setCard(row.item, deps.wearer ?? null, deps.nameOf) : null;
      if (set) card.append(set);
    }
    body.append(card);
    // the Broker's reveal (U4): on a phone the card stands under the whole list - brought into view as it is pressed
    if (reveal && globalThis.matchMedia?.('(max-width: 720px)')?.matches) card.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    reveal = false;
  };
  render();
  host.append(shell);
  if (deps.load) Promise.resolve().then(() => deps.load?.()).catch(() => null).then(() => render());
  const unhear = deps.hear?.(() => render()) ?? (() => {});
  // what the festival's state is without an answer to say it - the relay back, the night come, the clock past a day
  // CAKE-CAP-SAID: and a UTC day turned (its day's finds open again) - no answer says that either
  const sig = () => `${deps.shut()}|${deps.night()}|${deps.today?.()?.resetMs}`;
  let was = sig();
  const watch = setInterval(() => { const now = sig(); if (now !== was) { was = now; render(); } }, WYRD_WATCH_MS);
  const onKey = (/** @type {KeyboardEvent} */ e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); exit(); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.broker-win', exit);
  return {
    repaint: () => render(),
    unmount() {
      if (!alive) return;
      alive = false;
      clearInterval(watch);
      unhear();
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      offOutside();
      shell.remove();
    },
  };
}
