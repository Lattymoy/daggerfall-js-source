// @ts-check
// APPEARANCES (2026-10-27; bible/04-Characters/Wardrobe.md, bible/10-UI/Collections.md section 9): THE APPEARANCES PART of
// the Collections page - every look there is (net/appearanceLaw.js ALL_LOOKS), grouped by kind as the Wardrobe matches
// them, each group under its divider with its count and the kit's meter; a look collected in its picture and name, one not
// yet collected dimmed (the wardrobe part's law). A row opened says how the look is had and where it is worn. The
// character's own (systems/appearances.js, in the save) - no account is read. Dressed by the kit's roles as the wardrobe's
// parts are: a filter a tile, a row a list line, a row opened a panel, a tag a chip.
import { t } from '../../systems/textManager.js';
import {
  lookGroups,
  looksCount,
  lookName,
  kindName,
  lookStub,
  wardrobeFee,
  wardrobePieces,
} from '../../systems/appearances.js';
import { appearanceOf, lookCode, lookVariant } from '../../net/appearanceLaw.js';
import { inventoryItemImage } from '../../systems/item/itemTemplates.js';
import { requestFittedIcon, fittedImg } from '../textureCanvas.js';
import { SLOT_BOX, screenDpr } from '../iconFit.js';
import { wordPair } from './wardrobeCatalogue.js';

/** The filters, in their row's order - the part opens on what is collected. */
export const LOOK_FILTERS = Object.freeze([
  wordPair('held', () => t('coll.filter.held', 'Held')),
  wordPair('all', () => t('coll.filter.all', 'All')),
  wordPair('missing', () => t('coll.filter.missing', 'Not held')),
]);
/** The part's words, each read when said. */
export const LOOK_WORDS = Object.freeze({
  how: () =>
    t(
      'coll.looks.how',
      'Every armour piece, shield and weapon you hold adds its look here. A Clothing Store, an Armorer or a Weaponsmith can give a piece you wear any look of its kind, for gold.',
    ),
  group: (/** @type {string} */ kind, /** @type {number} */ held, /** @type {number} */ total) =>
    t('coll.looks.group', '{kind} - {held} / {total}', { kind, held, total }),
  none: () => t('coll.looks.none', 'None collected yet.'),
  held: () => t('coll.looks.tag.held', 'Held'),
  worn: () => t('coll.looks.tag.worn', 'Worn'),
  howHead: () => t('coll.looks.howHead', 'How to get it'),
  // AUDIT HORIZONTAL E4: no article before a name that starts with a vowel or a material; past style 1 a shop's roll alone
  howGet: (/** @type {string} */ name) =>
    t('coll.looks.howGet', 'To collect {name}: buy it, find it or make it.', { name }),
  howBuy: (/** @type {string} */ name) => t('coll.looks.howBuy', 'To collect {name}: buy it at a shop.', { name }),
  wearHead: () => t('coll.looks.wearHead', 'Wearing it'),
  wearAt: (/** @type {string} */ kind, /** @type {number} */ gold) =>
    t(
      'coll.looks.wearAt',
      'Over any piece of its kind ({kind}), at a Clothing Store, an Armorer or a Weaponsmith, for {gold, number} gold.',
      { kind, gold },
    ),
  heldLine: () => t('coll.looks.heldLine', 'Collected.'),
});

let _filter = 'held';
let _open = /** @type {string|null} */ (null);
/** The part forgotten (a new visit): Held again, every row closed. */
export function resetAppearancesPart() {
  _filter = 'held';
  _open = null;
}

/** The part's count for its tile: `{ held, total }`. */
export const appearancesCount = (/** @type {any} */ player) => looksCount(player);

/** A look's picture - its classic icon - fitted, or null while it loads. */
function lookPicture(/** @type {any} */ look, /** @type {any} */ player, /** @type {() => void} */ onReady) {
  const img = inventoryItemImage(lookStub(look), player ?? undefined);
  return img?.archive
    ? requestFittedIcon(img.archive, img.record, {
        box: SLOT_BOX.row,
        dpr: screenDpr(),
        dye: img.dye,
        dyeTarget: img.dyeTarget,
        onReady,
      })
    : null;
}

/**
 * THE PART into `detail`: how a look is had, the filters, then each kind's group.
 * @param {any} detail @param {() => void} rerender
 * @param {{ el: Function, divider: Function, meter?: Function, player?: any, picture?: ((look: any) => any) | null }} kit
 *   `picture` a pin's own (null: none)
 */
export function drawAppearancesPart(detail, rerender, kit) {
  const { el, divider } = kit;
  const player = kit.player ?? null;
  detail.append(el('p', 'coll-acct coll-looks-how', LOOK_WORDS.how()));
  const filters = el('div', 'coll-filters');
  for (const [id, label] of LOOK_FILTERS) {
    const b = el('button', `coll-filter${id === _filter ? ' on' : ''}`, label());
    b.type = 'button';
    b.setAttribute('data-focus', `looks-filter-${id}`);
    b.setAttribute('aria-pressed', id === _filter ? 'true' : 'false');
    b.onclick = () => {
      _filter = id;
      rerender();
    };
    filters.append(b);
  }
  detail.append(filters);
  const worn = new Set(
    wardrobePieces(player)
      .map((p) => appearanceOf(p.item))
      .filter(Boolean),
  );
  const picture =
    kit.picture !== undefined
      ? (/** @type {any} */ look) => kit.picture?.(look) ?? null
      : (/** @type {any} */ look) => lookPicture(look, player, rerender);
  for (const g of lookGroups(player)) {
    const rows = g.looks.filter((l) => (_filter === 'held' ? l.held : _filter === 'missing' ? !l.held : true));
    if (_filter === 'held' && !rows.length) continue;
    detail.append(divider(LOOK_WORDS.group(kindName(g.kind), g.held, g.total)));
    if (typeof kit.meter === 'function') {
      const m = el('div', 'coll-looks-meter');
      m.append(kit.meter(g.held, g.total));
      detail.append(m);
    }
    const list = el('div', 'coll-list');
    for (const { look, held } of rows)
      list.append(...lookRow(el, look, held, worn.has(look), g.kind, picture, rerender));
    detail.append(list);
  }
  if (_filter === 'held' && !looksCount(player).held) detail.append(el('p', 'coll-acct', LOOK_WORDS.none()));
}

/** AUDIT HORIZONTAL E4: whether loot, a corpse and the smith make a look too - its style the one a piece minted with none
 *  draws (SetVariant's clamp of 0); any other style is a shop's roll (systems/shopStock.js randomizeArmorVariant). */
export const everyMintMakes = (/** @type {{ t: number, m: number, v: number }} */ look) =>
  look.v === lookVariant(look.t, look.m, 0);

/** One look's row, and - pressed - the look whole under it. */
function lookRow(
  /** @type {Function} */ el,
  /** @type {any} */ look,
  /** @type {boolean} */ held,
  /** @type {boolean} */ worn,
  /** @type {string} */ kind,
  /** @type {(look: any) => any} */ picture,
  /** @type {() => void} */ rerender,
) {
  const key = lookCode(look),
    open = _open === key,
    name = lookName(look);
  const row = el('button', `coll-row${held ? ' held' : ''}${open ? ' on' : ''}`);
  row.type = 'button';
  row.setAttribute('data-focus', `look-${key}`);
  row.setAttribute('aria-expanded', open ? 'true' : 'false');
  const prev = el('span', 'coll-prev');
  const pic = picture(look);
  if (pic && typeof pic === 'object') prev.append(fittedImg(pic));
  const tags = el('span', 'coll-tags');
  if (worn) tags.append(el('span', 'coll-tag is-worn', LOOK_WORDS.worn()));
  else if (held) tags.append(el('span', 'coll-tag is-held', LOOK_WORDS.held()));
  row.append(prev, el('span', 'coll-nm', name), tags);
  row.onclick = () => {
    _open = open ? null : key;
    rerender();
  };
  if (!open) return [row];
  const whole = el('div', 'coll-whole nopic');
  const text = el('div', 'coll-text');
  text.append(el('p', 'coll-bigword', name));
  text.append(
    el('h5', null, LOOK_WORDS.howHead()),
    el(
      'p',
      null,
      held ? LOOK_WORDS.heldLine() : everyMintMakes(look) ? LOOK_WORDS.howGet(name) : LOOK_WORDS.howBuy(name),
    ),
  );
  text.append(
    el('h5', null, LOOK_WORDS.wearHead()),
    el('p', null, LOOK_WORDS.wearAt(kindName(kind), wardrobeFee(look))),
  );
  whole.append(text);
  return [row, whole];
}

/** The part's sheet: geometry alone - the kit dresses the rest (Collections.md section 5). */
export const LOOKS_PART_CSS = `
.px-sys .coll-looks-meter { margin: -4px 0 6px; }
.px-sys .coll-looks-meter .px-meter { height: 6px; }
`;
