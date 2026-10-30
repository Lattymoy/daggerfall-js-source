// @ts-check
// GUILD-SHOP (2026-10-30, the owner: "Redesign the guild menu and layout"; bible/11-Multiplayer/Guild-Shop.md): THE GUILD
// WINDOW'S LOOK - the head's crest (the guild's logo in a gilt ring, or its shield on a ring of its border's colour), its
// pages in three groups down the column (the guild, its wealth, its look), and the window's styles over GUILD-WINDOW's:
// the head washed in the guild's field, the tiles a ribbon, the sections' cards and the Shop's and the logo's rows.
// ui/socialPanel.js draws the window; this keeps what it looks like out of that file.
import { heraldryOf, heraldryColourOf } from '../../net/heraldryLaw.js';
import { guildLogoSrc } from '../../net/guild/guildArmsBook.js';
import { shieldSvg } from '../heraldryArt.js';
import { t } from '../../systems/textManager.js';

/** The pages in their groups, in the column's order - a page a guild does not show is passed over. */
export const GUILD_NAV_GROUPS = Object.freeze([
  Object.freeze({ id: 'guild', pages: Object.freeze(['overview', 'members', 'ranks']) }),   // GUILD-RANKS
  Object.freeze({ id: 'wealth', pages: Object.freeze(['treasury', 'vault', 'stores', 'shop']) }),
  Object.freeze({ id: 'look', pages: Object.freeze(['arms', 'settings']) }),
]);
/** A group's name. */
export const guildNavGroupName = (/** @type {string} */ id) => (id === 'guild' ? t('social.guild.group.guild', 'Guild')
  : id === 'wealth' ? t('social.guild.group.wealth', 'Wealth') : t('social.guild.group.look', 'Identity'));
/** The group a page opens, or null where it opens none (it is not its group's first shown). */
export function guildNavGroupAt(/** @type {string} */ page, /** @type {string[]} */ shown) {
  for (const g of GUILD_NAV_GROUPS) if (g.pages.find((p) => shown.includes(p)) === page) return g.id;
  return null;
}

/** The guild's field as a colour for the head's wash - grey where it has no arms. */
export const guildFieldHex = (/** @type {any} */ heraldry) => {
  const h = heraldryOf(heraldry);
  return (h && heraldryColourOf(h.field)?.hex) || '#5a5f68';
};

/** The crest as a picture of our own drawing: the shield on a ring of the border's colour. Pure SVG. */
export function guildCrestSvg(/** @type {any} */ heraldry, size = 76) {
  const h = heraldryOf(heraldry);
  const ring = (h && heraldryColourOf(h.border)?.hex) || '#c08a3e';
  const shield = shieldSvg(heraldry, { size: 52 });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img">`
    + `<rect x="4" y="4" width="92" height="92" rx="46" fill="#141a22" stroke="${ring}" stroke-width="5"/>`
    + `<rect x="10" y="10" width="80" height="80" rx="40" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>`
    + (shield ? `<g transform="translate(24 20)">${shield}</g>` : `<path d="M30 24 H70 V52 Q70 72 50 80 Q30 72 30 52 Z" fill="#8a8f99" stroke="#3a3f47" stroke-width="2"/>`)
    + '</svg>';
}

/**
 * THE HEAD'S CREST - the approved logo in a gilt ring (`img`, its own address), or the crest of our drawing.
 * @param {any} doc @param {(svg: string, w: number, h: number, alt: string) => any} picture @param {any} v the guild's view @param {string} alt
 */
export function guildCrestNode(doc, picture, v, alt) {
  const src = v?.logo ? guildLogoSrc(v.logo) : null;
  if (!src) { const img = picture(guildCrestSvg(v?.heraldry), 76, 76, alt); img.className = 'dfguild-crest'; return img; }
  const img = doc.createElement('img');
  img.className = 'dfguild-crest dfguild-crestlogo';
  img.src = src;
  img.setAttribute('width', '76'); img.setAttribute('height', '76'); img.setAttribute('alt', alt);
  return img;
}

/** THE WINDOW'S STYLES over GUILD-WINDOW's (ui/socialPanel.js SOCIAL_CSS ends with them, so they win at equal weight). */
export const GUILD_WINDOW_CSS = `
.dfsocial[data-mode="guild"] .dfsocial-guildhead { position: relative; gap: 18px; padding: 14px 20px;
  background: linear-gradient(100deg, color-mix(in srgb, var(--dfguild-field, #5a5f68) 34%, transparent), rgba(192, 138, 62, .05) 55%, rgba(0, 0, 0, 0));
  border-bottom: 1px solid rgba(192, 138, 62, .35); }
.dfsocial[data-mode="guild"] .dfsocial-guildhead .dfguild-crest { width: 76px; height: 76px; filter: drop-shadow(0 2px 6px rgba(0, 0, 0, .6)); }
.dfsocial[data-mode="guild"] .dfsocial-guildhead .dfguild-crestlogo { border-radius: 50%; border: 4px solid var(--brass, #c08a3e); background: #141a22; box-sizing: border-box; object-fit: cover; }
.dfsocial[data-mode="guild"] .dfsocial-guildhead .dfsocial-subject { font-size: 24px; letter-spacing: .04em; text-shadow: 0 1px 3px rgba(0, 0, 0, .7); }
.dfguild-motto { font-size: 12px; font-style: italic; color: #d9c49a; margin-top: 2px; }
.dfsocial[data-mode="guild"] .dfguild-stats { gap: 0; margin-top: 10px; align-self: flex-start; background: rgba(0, 0, 0, .32);
  border: 1px solid rgba(192, 138, 62, .3); border-radius: 6px; overflow: hidden; }
.dfsocial[data-mode="guild"] .dfguild-stat { min-width: 92px; padding: 6px 14px; background: none; border: 0; border-right: 1px solid rgba(255, 255, 255, .07); border-radius: 0; }
.dfsocial[data-mode="guild"] .dfguild-stat:last-child { border-right: 0; }
.dfsocial[data-mode="guild"] .dfguild-statlabel { color: var(--brass, #c08a3e); font-size: 10px; }
.dfguild-navgroup { padding: 12px 12px 4px; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--brass, #c08a3e); opacity: .85; }
.dfguild-navgroup:first-child { padding-top: 2px; }
.dfsocial[data-mode="guild"] .dfguild-nav .dfsocial-subtab.active { background: linear-gradient(90deg, rgba(192, 138, 62, .22), rgba(192, 138, 62, .04)); }
.dfsocial[data-mode="guild"] .dfguild-card { border-top: 2px solid rgba(192, 138, 62, .45); box-shadow: 0 2px 8px rgba(0, 0, 0, .25); }
.dfsocial[data-mode="guild"] .dfguild-card > .dfsocial-sec::before { content: "\\25C6"; margin-right: 8px; font-size: 9px; vertical-align: 2px; opacity: .8; }
.dfguild-purse { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 2px; }
.dfsocial[data-mode="guild"] .dfguild-purse .dfguild-stat { flex: none; min-width: 120px; padding: 6px 12px; background: rgba(0, 0, 0, .3); border: 1px solid var(--iron, #2b323b); border-radius: 4px; }
.dfguild-ware { display: grid; grid-template-columns: 64px 1fr auto; align-items: center; gap: 14px; padding: 10px 2px; border-bottom: 1px solid rgba(255, 255, 255, .05); }
.dfguild-ware:last-child { border-bottom: 0; }
.dfguild-ware > img { width: 56px; height: 56px; padding: 3px; background: radial-gradient(circle, rgba(192, 138, 62, .18), rgba(0, 0, 0, .35)); border: 1px solid rgba(192, 138, 62, .35); border-radius: 6px; }
.dfguild-warekind { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--brass, #c08a3e); opacity: .8; }
.dfguild-warename { font-size: 15px; color: var(--bone, #e9e4d9); }
.dfguild-warelook { font-size: 12px; line-height: 1.45; color: #cdbf9f; margin-top: 2px; }
.dfguild-warestate { font-size: 11px; line-height: 1.4; color: var(--dim, #9a9486); margin-top: 3px; }
.dfguild-wareside { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; text-align: right; min-width: 128px; }
.dfguild-wareprice { font-size: 15px; color: #e8d39a; }
.dfguild-warepayer { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: var(--dim, #9a9486); }
.dfguild-wareheld { margin-top: 2px; padding: 3px 10px; font-size: 12px; color: #9fe08a; border: 1px solid rgba(120, 200, 100, .45); border-radius: 10px; }
.dfguild-gridwrap { overflow-x: auto; max-width: 100%; }
.dfguild-grid { border-collapse: collapse; font-size: 12px; margin: 4px 0; }
.dfguild-grid th, .dfguild-grid td { padding: 4px 8px; border-bottom: 1px solid rgba(255, 255, 255, .06); text-align: center; }
.dfguild-grid tr > th:first-child { text-align: left; color: #cdbf9f; font-weight: normal; white-space: nowrap; position: sticky; left: 0; z-index: 1; background: #161b22; }
.dfguild-grid tr:first-child th { color: var(--brass, #c08a3e); font-size: 11px; font-weight: normal; min-width: 56px; overflow-wrap: anywhere; }
.dfguild-grid td { color: var(--dim, #9a9486); }
.dfguild-grid input { width: 16px; height: 16px; accent-color: var(--brass, #c08a3e); cursor: pointer; }
.dfsocial.touch .dfguild-grid input { width: 24px; height: 24px; }
.dfsocial.touch .dfguild-grid th, .dfsocial.touch .dfguild-grid td { padding: 6px 8px; }
.dfguild-ranklist { display: flex; flex-direction: column; gap: 2px; padding: 4px 0; font-size: 13px; color: var(--bone, #e9e4d9); }
.dfguild-logo { padding: 6px 0; }
.dfguild-logo > img { width: 96px; height: 96px; border-radius: 6px; border: 2px solid var(--brass, #c08a3e); background: #141a22; object-fit: contain; }
@media (max-width: 760px), (max-height: 520px) {
  .dfsocial[data-mode="guild"] .dfsocial-guildhead { padding: 8px 12px; gap: 10px; }
  .dfsocial[data-mode="guild"] .dfsocial-guildhead .dfguild-crest { width: 44px; height: 44px; }
  .dfsocial[data-mode="guild"] .dfsocial-guildhead .dfsocial-subject { font-size: 17px; }
  .dfguild-motto { display: none; }
  .dfsocial[data-mode="guild"] .dfguild-stat { min-width: 0; padding: 3px 8px; }
  .dfguild-navgroup { display: none; }
  .dfguild-ware { grid-template-columns: 48px 1fr; }
  .dfguild-ware > img { width: 44px; height: 44px; }
  .dfguild-wareside { grid-column: 1 / -1; flex-direction: row; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
}
`;
