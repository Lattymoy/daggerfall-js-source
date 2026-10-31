// @ts-check
// GUILD-SHOP (bible/11-Multiplayer/Guild-Shop.md): THE GUILD SHOP'S PICTURES - each ware drawn small for its row on the
// Shop page, in the guild's own colours where it carries them (the field, the border, the shield - ui/heraldryArt.js
// shieldSvg). Our own drawing, shown as a picture and never as markup (SOC3). Pure.
import { heraldryOf, heraldryColourOf } from '../../net/heraldryLaw.js';
import { shieldSvg } from '../heraldryArt.js';

/** The guild's two colours for a picture - its field and its border, or a plain grey and brass. */
function coloursOf(/** @type {any} */ heraldry) {
  const h = heraldryOf(heraldry);
  return {
    field: (h && heraldryColourOf(h.field)?.hex) || '#6b6f78',
    border: (h && heraldryColourOf(h.border)?.hex) || '#c08a3e',
  };
}
/** The guild's shield, `size` across, set at (`x`, `y`) - a plain one where the guild has no arms. */
function shieldAt(
  /** @type {any} */ heraldry,
  /** @type {number} */ x,
  /** @type {number} */ y,
  /** @type {number} */ size,
) {
  const s = shieldSvg(heraldry, { size });
  const plain = `<path d="M0 0 H${size} V${size * 0.55} Q${size} ${size * 0.9} ${size / 2} ${size * 1.04} Q0 ${size * 0.9} 0 ${size * 0.55} Z" fill="#8a8f99" stroke="#3a3f47" stroke-width="1.5"/>`;
  return `<g transform="translate(${x} ${y})">${s || plain}</g>`;
}

/**
 * A ware's picture: an SVG 64 x 64, drawn `size` across. '' for a key no ware's.
 * @param {string} key @param {any} heraldry the guild's arms (or null) @param {number} [size]
 */
export function guildWareSvg(key, heraldry, size = 56) {
  const { field, border } = coloursOf(heraldry);
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img">`;
  switch (key) {
    case 'insigniaarmlet':
      return (
        `${open}<path d="M18 4 C26 4 34 6 40 12 L52 56 C46 60 34 61 26 58 L14 16 C13 9 14 5 18 4 Z" fill="#b98a6a" stroke="#5a3d2c" stroke-width="1.5"/>` +
        `<path d="M17 24 L44 21 L47 31 L19 35 Z" fill="${field}" stroke="#e8c050" stroke-width="2.5"/>${shieldAt(heraldry, 25, 19, 16)}</svg>`
      );
    case 'guildcrest':
      return `${open}<rect x="6" y="6" width="52" height="52" rx="26" fill="#2c4f86" stroke="#e8c050" stroke-width="4"/>${shieldAt(heraldry, 18, 15, 28)}</svg>`;
    case 'guildsails':
      return (
        `${open}<rect x="30" y="4" width="4" height="50" fill="#5c3f26"/><path d="M36 8 L58 12 L56 44 L36 46 Z" fill="${field}" stroke="#3a2a1a"/>` +
        `<path d="M36 8 L44 9.5 L42 45.2 L36 46 Z" fill="${border}"/>${shieldAt(heraldry, 42, 18, 12)}<path d="M4 50 L60 50 L54 60 L10 60 Z" fill="#6a4a2c" stroke="#2a1a10"/></svg>`
      );
    case 'banker':
      return (
        `${open}<rect x="6" y="30" width="52" height="28" fill="#6a4a2c" stroke="#2a1a10" stroke-width="1.5"/><rect x="4" y="26" width="56" height="6" fill="#8a6038"/>` +
        `<rect x="10" y="36" width="44" height="6" fill="${field}"/><rect x="16" y="16" width="10" height="10" rx="2" fill="#e8c050" stroke="#8a6a20"/><rect x="18" y="12" width="10" height="6" rx="2" fill="#f0d070" stroke="#8a6a20"/>` +
        `<path d="M40 8 V26 M33 14 H47 M33 14 L30 22 H36 Z M47 14 L44 22 H50 Z" fill="#c8a040" stroke="#7a5a20" stroke-width="1.2"/></svg>`
      );
    case 'standard':
      return (
        `${open}<rect x="30" y="2" width="4" height="58" fill="#5c3f26"/><rect x="22" y="6" width="20" height="3" fill="#e8c050"/>` +
        `<path d="M23 9 H41 V44 L32 38 L23 44 Z" fill="${field}" stroke="${border}" stroke-width="2"/>${shieldAt(heraldry, 26, 15, 12)}<rect x="24" y="58" width="16" height="4" fill="#3a2a1a"/></svg>`
      );
    case 'crestplaque':
      return `${open}<path d="M8 6 H56 V30 Q56 50 32 60 Q8 50 8 30 Z" fill="#6a4a2c" stroke="#2a1a10" stroke-width="2"/>${shieldAt(heraldry, 17, 12, 30)}</svg>`;
    case 'throne':
      return (
        `${open}<rect x="14" y="4" width="36" height="40" rx="3" fill="#4a3020" stroke="#e8c050" stroke-width="2"/><rect x="18" y="8" width="28" height="30" fill="${field}"/>` +
        `${shieldAt(heraldry, 24, 12, 16)}<rect x="10" y="40" width="44" height="8" fill="#6a4a2c" stroke="#2a1a10"/><rect x="12" y="48" width="5" height="12" fill="#4a3020"/><rect x="47" y="48" width="5" height="12" fill="#4a3020"/></svg>`
      );
    case 'wartable':
      return (
        `${open}<rect x="4" y="22" width="56" height="8" fill="#6a4a2c" stroke="#2a1a10"/><rect x="8" y="30" width="5" height="28" fill="#4a3020"/><rect x="51" y="30" width="5" height="28" fill="#4a3020"/>` +
        `<path d="M8 12 L56 12 L58 24 L6 24 Z" fill="#c8b48a" stroke="#6a5a3a"/><path d="M14 16 Q24 13 30 18 T50 17" fill="none" stroke="#5a7a50" stroke-width="2"/>` +
        `<rect x="22" y="14" width="3" height="5" fill="${field}"/><rect x="40" y="16" width="3" height="5" fill="${border}"/></svg>`
      );
    case 'weaponrack':
      return (
        `${open}<rect x="6" y="50" width="52" height="6" fill="#6a4a2c" stroke="#2a1a10"/><rect x="6" y="20" width="52" height="5" fill="#6a4a2c" stroke="#2a1a10"/>` +
        `<path d="M14 6 V50 M24 4 V50 M40 10 V50 M50 8 V50" stroke="#b8c0c8" stroke-width="3"/><path d="M11 12 H17 M37 16 H43" stroke="#8a6a20" stroke-width="3"/><path d="M24 2 L21 8 H27 Z M50 4 L47 10 H53 Z" fill="#d8dde2"/>${shieldAt(heraldry, 26, 26, 12)}</svg>`
      );
    case 'brazier':
      return (
        `${open}<path d="M14 34 H50 L44 46 H20 Z" fill="#3a3a40" stroke="#1a1a1e" stroke-width="1.5"/><path d="M22 46 L16 60 M42 46 L48 60 M32 46 V60" stroke="#3a3a40" stroke-width="3"/>` +
        `<path d="M20 34 Q18 22 26 16 Q26 26 32 22 Q30 10 38 4 Q38 18 44 22 Q48 28 44 34 Z" fill="#f08a30"/><path d="M26 34 Q26 26 32 24 Q34 30 38 28 Q40 32 38 34 Z" fill="#ffd060"/></svg>`
      );
    default:
      return '';
  }
}
