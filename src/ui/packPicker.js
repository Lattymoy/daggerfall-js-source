// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PACK-PICK (2026-10-26; the owner, of a #feature-feedback thread: "This needs a comprehensive detailed overhaul") -
// THE PACK, PICTURED, WHERE A PIECE IS CHOSEN TO SELL.
//
// Cl3arSky, "SELLING ITEMS ON THE MARKET IS A PAIN!": "When selling items from backpack for GOLD, you get a dropdown
// with just the name of the item.. no description or icon, you gotta memorize the item names before you wanna sell ...
// you gotta open backpack, then open the notice board, go through all the menus, already forgotten the item names by
// then". The Market's List form chose a piece from the pack (MARKET-ANY), a crafted piece and a Masterwork to auction
// (PROF5, PROF5b) from a <select> of names, and so did a trader's "Put up a piece from your pack" (HOME-VENDOR).
//
// ONE PICKER FOR ALL FOUR (bible/Home.md, THE ONE CONSTRUCTION SEAM):
//   - THE PIECES AS TILES - each its picture (the host's, ui/menu/menuPicture.js, as the market's rows are), its name,
//     and a line under it the caller writes (its tier, its quality, its wear, where it lies); its frame its tier's colour
//     (RARITY-UI's data-rarity, the pack's own mark). A press chooses it; nothing is chosen until one is pressed - a sale
//     takes the piece out of the pack, so it is never the first piece by default.
//   - SIFTED AS THE PACK'S OWN STORES ARE (ui/storeFilter.js - WAGON-FILTER, LOOT-BULK, MAT-FILTER): a search of the
//     names, and the pack's pages, the tiers and the metals the pieces hold, each with its count - one law for where a
//     piece lives. The tiles refill in place: the field typed in is never redrawn under the keys, and a composed word is
//     read once it is whole (ui/workSift.js typedField).
//   - WHAT MAY NOT GO, FOLDED under the tiles, each piece pictured with why - the List form said the first eight in one
//     sentence and "and N more".
//   - THE PIECE CHOSEN, LOOKED AT (`packCardNode`): its picture, its name in its tier's colour and the look panel's rows
//     and magic (systems/item/itemLook.js) - what the pack's own card says, so nobody leaves the board to read it.
//
// Not a DFU window: Daggerfall has no market. Drawn in the Notice Board's Plus dress (enhancedPlusStyle.js PROF_CSS).
// ═══════════════════════════════════════════════════════════════════
import {
  storeFilterAccepts,
  storeRarityAccepts,
  storeMaterialAccepts,
  storeQuery,
  storeFilterOptions,
  storeRarityOptions,
  storeMaterialOptions,
} from './storeFilter.js';
import { RARITIES, rarityAttr, lootRarityOn } from '../systems/loot/lootRarity.js';
import { pictureNode } from './menu/menuGlyphs.js';
import { SLOT_BOX } from './iconFit.js';
import { typedField } from './workSift.js';
import { t } from '../systems/textManager.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
/** A read of a piece that may throw on a shape the laws do not know (a test's word for an item, a peer's odd record). */
const safe = (/** @type {() => any} */ f, /** @type {any} */ or = null) => {
  try {
    return f();
  } catch {
    return or;
  }
};

/** The sift a picker opens on - the search, the page, the tier, the metal, whether the refused are unfolded, and how far
 *  its tiles and the refused are scrolled (`top`, `offTop`). */
export const freshPackSift = () => ({
  query: '',
  cat: 'all',
  rarity: 'all',
  material: 'all',
  refusedOpen: false,
  top: 0,
  offTop: 0,
});
/** @typedef {ReturnType<typeof freshPackSift>} PackSift */
/** @typedef {{ key?: string|null, item: any, name: string, sub?: string|null, why?: string|null }} PackEntry */

/** Whether a sift leaves every piece in. */
const siftIsAll = (/** @type {PackSift} */ s) =>
  !storeQuery(s.query) && s.cat === 'all' && s.rarity === 'all' && s.material === 'all';
/** The entries a sift shows, in their own order: the pack's page, tier and metal (storeFilter.js), and the search over the
 *  name the tile wears. */
export function siftEntries(/** @type {PackEntry[]} */ entries, /** @type {PackSift} */ s) {
  if (siftIsAll(s)) return entries;
  const q = storeQuery(s.query);
  return entries.filter(
    (e) =>
      safe(
        () =>
          storeFilterAccepts(e.item, s.cat) &&
          storeRarityAccepts(e.item, s.rarity) &&
          storeMaterialAccepts(e.item, s.material),
        false,
      ) &&
      (!q ||
        String(e.name ?? '')
          .toLowerCase()
          .includes(q)),
  );
}

/** A piece's tier in words for its tile's line - "Rare" - while the loot ladder is on; null for Common. */
export const packTierWord = (/** @type {any} */ item) => {
  const r = safe(() => rarityAttr(item));
  return r ? (RARITIES[/** @type {keyof typeof RARITIES} */ (r)]?.label ?? null) : null;
};

/** A node marked with the piece's tier (the sheet colours its frame by it). */
const marked = (/** @type {HTMLElement} */ n, /** @type {any} */ item) => {
  const r = safe(() => rarityAttr(item));
  if (r) n.setAttribute('data-rarity', r);
  return n;
};

/** A picture of the piece in a frame of `box` - the host's, fitted to that box (AUDIT PACK-PICK A10: the card's was the
 *  tile's stretched twice over a whole-number fit, UI1) and drawn at its own size, as the market's rows draw theirs - or
 *  the frame empty while it is made or when `ask` is false (the tiles line up meanwhile). */
function picOf(/** @type {any} */ item, /** @type {any} */ o, /** @type {number} */ box = SLOT_BOX.row, ask = true) {
  const frame = el('span', `packpick-pic${box === SLOT_BOX.row ? '' : ' packpick-bigpic'}`);
  const pic = ask ? safe(() => o.picture?.(item, o.wake ?? (() => {}), box) ?? null) : null;
  const img = pictureNode(pic, el, 'packpick-img');
  if (img) frame.append(img);
  else frame.className += ' packpick-nopic';
  return frame;
}
/** AUDIT PACK-PICK A8: each tile's focus key - the caller's, or its name and which of that name it is, so a piece that
 *  comes into the pack ahead of it never hands its focus to another piece. */
function focusKeys(/** @type {PackEntry[]} */ entries) {
  const seen = new Map();
  return new Map(
    entries.map((e) => {
      const n = (seen.get(e.name) ?? 0) + 1;
      seen.set(e.name, n);
      return [e, e.key ?? `${e.name}#${n}`];
    }),
  );
}
/** A tile's name and the line under it. */
function wordsOf(/** @type {PackEntry} */ e, why = false) {
  const w = el('span', 'packpick-words');
  w.append(el('span', 'packpick-name', e.name));
  if (e.sub) w.append(el('span', 'packpick-sub', e.sub));
  if (why && e.why) w.append(el('span', 'packpick-why', e.why));
  return w;
}

/**
 * THE PICKER: the sift's bar, the tiles of what may go, and what may not, folded.
 * @param {{
 *   entries: PackEntry[], chosen: any, sift: PackSift, pick: (item: any) => void,
 *   picture?: ((item: any, wake: () => void, box?: number) => ({ src: string, w: number, h: number }|null)) | null, wake?: () => void,
 *   label: string, focus: string, empty: string, refusedWhat: string, redraw: () => void,
 *   words?: { find?: string, findLabel?: string, none?: string },
 * }} o `entries` in the pack's order, each with why it may not go (null: it may); `chosen` the chosen entry's item;
 *   `sift` the caller's, kept across its redraws; `label` the picker's name; `focus` the prefix of its fields' focus keys;
 *   `empty` the words when nothing may go; `refusedWhat` the fold's name ("Not for the market"); `redraw` the window's;
 *   `words` the search's and a search's nothing (AUDIT PACK-PICK B6: the pack's, unless the pieces are not all the pack's)
 */
export function packPickerNode(o) {
  const { sift } = o;
  const ok = o.entries.filter((e) => !e.why),
    refused = o.entries.filter((e) => e.why);
  const keys = focusKeys(o.entries);
  const box = el('div', 'packpick');
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', o.label);
  const grid = el('div', 'packpick-grid');
  const count = el('span', 'packpick-count');
  count.setAttribute('aria-live', 'polite');
  const offList = el('div', 'packpick-grid packpick-offgrid');
  // AUDIT PACK-PICK B2: THE TILES ONE STOP OF THE TAB KEY - the chosen tile's, or the first's - and the arrows walk them
  // (a row across, a column down, Home and End); a hundred and forty Tabs stood between the search and List
  const tilesShown = () => /** @type {HTMLElement[]} */ ([...grid.children].filter((n) => n.tagName === 'BUTTON'));
  const across = () =>
    Math.max(
      1,
      safe(() => globalThis.getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length, 1) || 1,
    );
  const walk = (/** @type {HTMLElement} */ from, /** @type {string} */ key) => {
    const all = tilesShown(),
      i = all.indexOf(from);
    const to =
      key === 'Home'
        ? 0
        : key === 'End'
          ? all.length - 1
          : Math.max(
              0,
              Math.min(
                all.length - 1,
                i + ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: across(), ArrowUp: -across() }[key] ?? 0),
              ),
            );
    if (i < 0 || to === i) return;
    from.setAttribute('tabindex', '-1');
    all[to].setAttribute('tabindex', '0');
    all[to].focus?.();
  };
  const tile = (/** @type {PackEntry} */ e) => {
    const b = /** @type {HTMLButtonElement} */ (
      marked(el('button', `packpick-tile${e.item === o.chosen ? ' on' : ''}`), e.item)
    );
    b.setAttribute('type', 'button');
    b.setAttribute('tabindex', '-1');
    b.onkeydown = (ev) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(ev.key)) return;
      ev.preventDefault?.();
      ev.stopPropagation?.();
      walk(b, ev.key);
    };
    b.setAttribute('aria-pressed', e.item === o.chosen ? 'true' : 'false');
    b.setAttribute('data-focus', `${o.focus}|${keys.get(e)}`);
    b.setAttribute('title', e.name);
    b.append(picOf(e.item, o), wordsOf(e));
    // AUDIT PACK-PICK A4: a double press is one - its second lands on the tile the first redrew, and let the piece go
    b.onclick = (ev) => {
      ev?.stopPropagation?.();
      if ((ev?.detail ?? 0) > 1) return;
      o.pick(e.item);
    };
    return b;
  };
  // AUDIT PACK-PICK A1: the folded are pictured only once unfolded - each picture landing redraws the window
  const offTile = (/** @type {PackEntry} */ e) => {
    const d = marked(el('div', 'packpick-tile off'), e.item);
    d.setAttribute('aria-disabled', 'true');
    d.append(picOf(e.item, o, SLOT_BOX.row, sift.refusedOpen === true), wordsOf(e, true));
    return d;
  };
  const none = () => {
    const p = el(
      'p',
      'notice-tip packpick-none',
      o.words?.none ?? t('pack.pick.none', 'Nothing in your pack matches.'),
    );
    const all = el('button', 'act packpick-all', t('pack.pick.all', 'Show everything'));
    all.setAttribute('type', 'button');
    all.setAttribute('data-focus', `${o.focus}|all`);
    all.onclick = (ev) => {
      ev?.stopPropagation?.();
      Object.assign(sift, { ...freshPackSift(), refusedOpen: sift.refusedOpen });
      o.redraw();
    };
    p.append(' ', all);
    return p;
  };
  // THE TILES KEEP THEIR SCROLL: a press redraws the window, which gives its body's scroll back and not a list's inside it
  // - the 20th piece pressed threw the tiles back to the first. Kept in the sift, given back once the window is drawn
  // (a node scrolls only in the document), and let go when the sift changes what the tiles are.
  grid.addEventListener?.('scroll', () => {
    sift.top = grid.scrollTop;
  });
  offList.addEventListener?.('scroll', () => {
    sift.offTop = offList.scrollTop;
  }); // AUDIT PACK-PICK B: the folded scroll too
  // AUDIT PACK-PICK A3: the folded are sifted only while the bar that sifts them stands (a sift left over from a pack that
  // had a piece to sell hid them, with no field to clear it), and the fold counts what it holds
  const offShown = () => (ok.length ? siftEntries(refused, sift) : refused);
  const said = el('summary', null);
  said.setAttribute('data-focus', `${o.focus}|refused`);
  const fillOff = () => {
    const off = offShown();
    offList.replaceChildren(...off.map(offTile));
    said.textContent = t('pack.pick.refused', '{what} ({n, number})', { what: o.refusedWhat, n: off.length });
  };
  const refill = (/** @type {boolean} */ moved = true) => {
    if (moved) {
      sift.top = 0;
      grid.scrollTop = 0;
      sift.offTop = 0;
      offList.scrollTop = 0;
    }
    const shown = siftEntries(ok, sift);
    grid.replaceChildren(...(shown.length ? shown.map(tile) : [none()]));
    const stop = tilesShown().find((n) => n.getAttribute('aria-pressed') === 'true') ?? tilesShown()[0];
    stop?.setAttribute('tabindex', '0');
    count.textContent = siftIsAll(sift)
      ? t('pack.pick.many', '{n, plural, one {# piece} other {# pieces}}', { n: ok.length })
      : t('pack.pick.some', '{shown, number} of {n, number}', { shown: shown.length, n: ok.length });
    fillOff();
  };
  if (!ok.length) box.append(el('p', 'notice-tip packpick-empty', o.empty));
  else {
    box.append(
      siftBar(
        o,
        ok.map((e) => e.item),
        refill,
        count,
      ),
    );
    box.append(grid);
  }
  if (refused.length) {
    const fold = /** @type {any} */ (el('details', 'packpick-refused'));
    fold.open = sift.refusedOpen === true;
    fold.addEventListener?.('toggle', () => {
      const opened = !!fold.open && sift.refusedOpen !== true;
      sift.refusedOpen = !!fold.open;
      if (opened) fillOff(); // now pictured
    });
    fold.append(said, offList);
    box.append(fold);
  }
  const top = sift.top,
    offTop = sift.offTop ?? 0;
  refill(false);
  if (top > 0 || offTop > 0)
    Promise.resolve().then(() => {
      grid.scrollTop = top;
      offList.scrollTop = offTop;
    }); // once the window has drawn it (marketTab.js toTop's way)
  return box;
}

/** THE SIFT'S BAR: the search, then each menu that has a choice to make - the pages the pieces lie on, their tiers while
 *  the loot ladder is on, and their metals - each entry with its count over the pieces that may go. */
function siftBar(
  /** @type {any} */ o,
  /** @type {any[]} */ items,
  /** @type {() => void} */ refill,
  /** @type {HTMLElement} */ count,
) {
  const { sift } = o;
  const bar = el('div', 'packpick-bar');
  const find = /** @type {HTMLInputElement} */ (el('input', 'notice-input packpick-find'));
  find.type = 'search';
  find.maxLength = 40;
  find.placeholder = o.words?.find ?? t('pack.pick.find', 'Search your pack');
  find.setAttribute('aria-label', o.words?.findLabel ?? t('pack.pick.findLabel', 'Search your pack by name'));
  find.setAttribute('data-focus', `${o.focus}|find`);
  find.value = sift.query;
  const typed = typedField(find, 120, refill);
  find.oninput = () => {
    sift.query = find.value;
    typed();
  };
  bar.append(find);
  const menu = (
    /** @type {Array<{ id: string, label: string, count: number }>} */ options,
    /** @type {'cat'|'rarity'|'material'} */ key,
    /** @type {string} */ label,
  ) => {
    const s = /** @type {HTMLSelectElement} */ (el('select', 'notice-select packpick-menu'));
    s.setAttribute('aria-label', label);
    s.setAttribute('data-focus', `${o.focus}|${key}`);
    for (const c of options) {
      const opt = /** @type {HTMLOptionElement} */ (
        el('option', null, c.id === 'all' ? c.label : `${c.label} (${c.count})`)
      );
      opt.value = c.id;
      if (c.id === sift[key]) opt.selected = true;
      s.append(opt);
    }
    s.value = sift[key];
    // AUDIT PACK-PICK A2: the choice made - a window that holds its redraw while a list is open (marketTab.js redraw) lets
    // this one go
    s.onchange = () => {
      s.setAttribute('data-chosen', '1');
      sift[key] = s.value;
      refill();
    };
    bar.append(s);
  };
  const pages = safe(() => storeFilterOptions(items, sift.cat), []);
  if (pages.length > 2 || sift.cat !== 'all') menu(pages, 'cat', t('pack.pick.page', 'Kind of piece'));
  const tiers = lootRarityOn() ? safe(() => storeRarityOptions(items, sift.rarity), []) : [];
  if (tiers.length > 2 || sift.rarity !== 'all') menu(tiers, 'rarity', t('pack.pick.tier', 'Rarity'));
  const metals = safe(() => storeMaterialOptions(items, sift.material), []);
  if (metals.length > 1) menu(metals, 'material', t('pack.pick.metal', 'Material'));
  bar.append(count);
  return bar;
}

/**
 * THE PIECE CHOSEN, LOOKED AT: its picture at the pack grid's size, its name in its tier's colour and its tile's line, then the
 * look's rows and its magic. `none` stands in its place while nothing is chosen.
 * @param {PackEntry|null} e
 * @param {{ picture?: any, wake?: () => void, look?: ((item: any) => ({ rows: string[], magic: string[] }|null)) | null, none: string }} o
 */
export function packCardNode(e, o) {
  if (!e) return el('p', 'notice-tip packpick-cardnone', o.none);
  const card = marked(el('div', 'packpick-card'), e.item);
  const head = el('div', 'packpick-cardhead');
  const words = el('div', 'packpick-words');
  words.append(el('b', 'packpick-name', e.name));
  if (e.sub) words.append(el('span', 'packpick-sub', e.sub));
  head.append(picOf(e.item, o, SLOT_BOX.grid), words);
  card.append(head);
  const look = safe(() => o.look?.(e.item) ?? null);
  if (look?.rows?.length) {
    const rows = el('div', 'packpick-stats');
    for (const r of look.rows) rows.append(el('span', 'packpick-stat', r));
    card.append(rows);
  }
  if (look?.magic?.length) {
    const ul = el('ul', 'packpick-magic');
    for (const m of look.magic) ul.append(el('li', null, m));
    card.append(ul);
  }
  return card;
}
