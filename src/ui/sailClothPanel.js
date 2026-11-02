// @ts-check
// GUILD-SHOP (bible/11-Multiplayer/Guild-Shop.md): THE SAILCLOTH IN THE FLEET'S PAINT PANEL (ui/fleetPage.js paintPanel) -
// its pattern, the pattern's second paint and the guild's arms on the sail, and the cloth on the panel's picture. Shut,
// with the ware's name, until the account holds the Guild Sailcloth (net/guild/guildStock.js guildWareHeld).
import { SAIL_PATTERNS, sailSecond, sailClothOf } from '../systems/naval/sailCloth.js';
import { heraldryOf } from '../net/heraldryLaw.js';
import { shieldSvg } from './heraldryArt.js';
import { t } from '../systems/textManager.js';

/** What the paint panel and the fleet's act say where the Guild Sailcloth is not held. */
export const SAILCLOTH_SHUT = () =>
  t(
    'naval.cloth.shut',
    "Buy the Guild Sailcloth on your guild's Shop page to use sail patterns and your guild's arms.",
  );

/** @type {Record<string, () => string>} */
const PATTERN_WORDS = {
  plain: () => t('naval.cloth.p.plain', 'Plain'),
  stripes: () => t('naval.cloth.p.stripes', 'Stripes'),
  bands: () => t('naval.cloth.p.bands', 'Bands'),
  quartered: () => t('naval.cloth.p.quartered', 'Quartered'),
  chevron: () => t('naval.cloth.p.chevron', 'Chevron'),
  cross: () => t('naval.cloth.p.cross', 'Cross'),
  border: () => t('naval.cloth.p.border', 'Border'),
  saltire: () => t('naval.cloth.p.saltire', 'Saltire'),
};
/** A pattern's name. */
export const sailPatternName = (/** @type {string} */ p) => PATTERN_WORDS[p]?.() ?? '';

/** The panel's sail (fleetPage.js paintSvg's `M78 14 L118 20 L114 62 L78 64 Z`), its box. */
const SAIL = Object.freeze({ x: 78, y: 14, w: 40, h: 50 });
/** Whether a point lies on the panel's sail - inside its four edges. */
const onSail = (/** @type {number} */ x, /** @type {number} */ y) =>
  x >= 78 && y >= 14 + ((x - 78) * 6) / 40 && y <= 64 - ((x - 78) * 2) / 36 && x <= 118 - ((y - 20) * 4) / 42;

/**
 * The cloth on the panel's sail, as SVG laid over paintSvg's sail: the pattern's second paint (`secondHex`) in cells
 * whose middles lie on the sail, and the arms' shield (`heraldry`) where the cloth flies them. '' for no cloth.
 * @param {any} cloth @param {string} secondHex @param {any} heraldry
 */
export function clothSvg(cloth, secondHex, heraldry) {
  const c = sailClothOf(cloth);
  if (!c) return '';
  const cols = 10,
    rows = 12,
    cw = SAIL.w / cols,
    ch = SAIL.h / rows;
  let cells = '';
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = SAIL.x + i * cw,
        y = SAIL.y + j * ch;
      if (sailSecond(c.pattern, (i + 0.5) / cols, (j + 0.5) / rows) && onSail(x + cw / 2, y + ch / 2))
        cells += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(cw + 0.2).toFixed(1)}" height="${(ch + 0.2).toFixed(1)}"/>`;
    }
  const shield = c.arms && heraldryOf(heraldry) ? shieldSvg(heraldry, { size: 18 }) : '';
  return (
    (cells ? `<g class="hld-cloth" fill="${secondHex}">${cells}</g>` : '') +
    (shield ? `<g class="hld-cloth" transform="translate(${SAIL.x + 11} ${SAIL.y + 9})">${shield}</g>` : '')
  );
}

/**
 * THE SAILCLOTH'S ROWS: a button a pattern, a row of paints for its second (`swatches`, the panel's own), and "Fly my
 * guild's arms" (`armed` - the guild has arms). `held` true opens them; false or null (unread) shows why they are shut.
 * `choose(cloth)` sets the cloth chosen.
 * @param {(tag: string, cls?: string, text?: string) => any} el @param {any} cloth @param {(c: any) => void} choose
 * @param {{ held: boolean | null, armed: boolean, swatches: Function, button: Function }} o
 */
export function sailClothRows(el, cloth, choose, { held, armed, swatches, button }) {
  const box = el('div', 'hld-text hld-cloth');
  box.append(el('span', 'hld-picklabel', t('naval.cloth.title', 'Guild Sailcloth')));
  if (held !== true) {
    box.append(
      el('span', 'hld-sub', held == null ? t('naval.cloth.reading', 'Reading your guild wares.') : SAILCLOTH_SHUT()),
    );
    return box;
  }
  const c = sailClothOf(cloth) ?? { pattern: 'plain', second: 0, arms: false };
  const put = (/** @type {string} */ k, /** @type {any} */ v) => choose({ ...c, [k]: v });
  const row = el('div', 'hld-acts');
  row.setAttribute?.('role', 'radiogroup');
  row.setAttribute?.('aria-label', t('naval.cloth.pattern', 'Pattern'));
  for (const p of SAIL_PATTERNS)
    row.append(button(el, sailPatternName(p), null, () => put('pattern', p), p === c.pattern ? 'act primary' : 'act'));
  box.append(row);
  if (c.pattern !== 'plain')
    box.append(
      swatches(el, t('naval.cloth.second', 'Second color'), c.second, (/** @type {number} */ v) => put('second', v)),
    );
  // AUDIT GUILD-SHOP N5: arms set under a guild before can always be taken down; only putting them up needs arms
  box.append(
    button(
      el,
      c.arms
        ? t('naval.cloth.armsOn', "Your guild's arms on the sails")
        : t('naval.cloth.armsOff', "Put my guild's arms on the sails"),
      armed || c.arms ? null : t('naval.flag.noArms', "Your guild has no arms, or you're not in a guild."),
      () => {
        if (armed || c.arms) put('arms', !c.arms);
      },
      c.arms ? 'act primary' : 'act',
    ),
  );
  return box;
}
