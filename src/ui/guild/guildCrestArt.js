// @ts-check
// GUILD-SHOP and GUILD-LOGO (bible/11-Multiplayer/Guild-Shop.md): A GUILD'S ARMS AS A PICTURE, ITS LOGO WHERE IT HAS ONE -
// the shield the Insignia Armlet wears (render/armoryPass.js), the Guild Crest portrait (ui/profileIcons.js) and the sail
// (systems/naval/sailCloth.js), and a banner (the hall's street banners, its Heraldic Standard) are painted here. Arms with an approved logo draw it on their field in place of the device;
// arms without one are heraldryArt.js's own shield. The port's own art, drawn in code.
import { drawShield, drawBanner, SHIELD_CLOTH, SHIELD_BORDER_W, BANNER_DEVICE, divisionPath } from '../heraldryArt.js';
import { heraldryOf, heraldryColourOf } from '../../net/heraldryLaw.js';

/** The plain shield a wearer in no guild, or one with no arms yet, wears: Argent bordered Ash. */
const PLAIN = Object.freeze({ field: '#e6e6e6', border: '#8a8a8a' });
/** Where a logo stands on the shield's 100 x 104 box. */
const LOGO_BOX = Object.freeze({ x: 20, y: 14, w: 60, h: 60 });

/**
 * THE ARMS AS A SHIELD on a canvas at (`x`, `y`), `size` wide: the heraldry's field (its division), its border, and the
 * logo (`logo`, a decoded picture) on the field in place of the device - or heraldryArt.js drawShield where no logo is
 * drawn. With no heraldry, the plain shield. Whether it drew (no Path2D, nothing).
 * @param {CanvasRenderingContext2D} ctx @param {any} arms `{ heraldry, logo }` @param {number} x @param {number} y @param {number} size @param {any} [logo]
 */
export function drawArms(ctx, arms, x, y, size, logo = null) {
  const h = heraldryOf(arms?.heraldry);
  const P = globalThis.Path2D;
  if (typeof P !== 'function') return false;
  if (h && !logo) return drawShield(ctx, h, x, y, size);
  const field = h ? (heraldryColourOf(h.field)?.hex ?? PLAIN.field) : PLAIN.field;
  const border = h ? (heraldryColourOf(h.border)?.hex ?? PLAIN.border) : PLAIN.border;
  const shield = new P(SHIELD_CLOTH);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = field;
  ctx.fill(shield);
  ctx.save();
  ctx.clip(shield);
  if (h?.division) {
    ctx.fillStyle = heraldryColourOf(h.field2)?.hex ?? field;
    ctx.fill(new P(divisionPath(h.division, 100, 104)));
  }
  if (logo) ctx.drawImage(logo, LOGO_BOX.x, LOGO_BOX.y, LOGO_BOX.w, LOGO_BOX.h);
  ctx.strokeStyle = border;
  ctx.lineWidth = SHIELD_BORDER_W * 2;
  ctx.stroke(shield);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke(shield);
  ctx.restore();
  return true;
}

/** THE ARMS AS A BANNER, `w` wide and three tall: heraldryArt.js drawBanner, and an approved logo (`logo`, a decoded
 *  picture) over its device, on a square of its field. */
export function drawBannerArms(
  /** @type {CanvasRenderingContext2D} */ ctx,
  /** @type {any} */ heraldry,
  /** @type {number} */ w,
  /** @type {any} */ logo = null,
) {
  drawBanner(ctx, heraldry, w);
  if (!logo) return;
  const k = w / 100,
    side = 100 * BANNER_DEVICE.scale * k,
    x = BANNER_DEVICE.x * k,
    y = BANNER_DEVICE.y * k;
  const h = heraldryOf(heraldry);
  ctx.save();
  ctx.fillStyle = (h && heraldryColourOf(h.field)?.hex) || PLAIN.field;
  ctx.fillRect(x, y, side, side);
  ctx.drawImage(logo, x, y, side, side);
  ctx.restore();
}

/** The armlet's crest's side, pixels. */
export const CREST_PX = 128;
/**
 * THE INSIGNIA ARMLET'S CREST on a `CREST_PX` square canvas: a gilt frame - a shield of beaten gold a little larger, its
 * rim lit and its rivets struck - and the arms inset on it. Transparent round it. Whether it painted.
 * @param {CanvasRenderingContext2D} ctx @param {any} arms @param {any} [logo]
 */
export function paintCrest(ctx, arms, logo = null) {
  const P = globalThis.Path2D;
  if (typeof P !== 'function') return false;
  const S = CREST_PX,
    frame = S * 0.92,
    fx = (S - frame) / 2,
    fy = S * 0.02;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(frame / 100, frame / 100);
  const gold = ctx.createLinearGradient(0, 0, 100, 104);
  gold.addColorStop(0, '#fff0b0');
  gold.addColorStop(0.35, '#d9a632');
  gold.addColorStop(0.7, '#8a5a12');
  gold.addColorStop(1, '#e8bd55');
  ctx.fillStyle = gold;
  ctx.fill(new P(SHIELD_CLOTH));
  ctx.strokeStyle = '#4a2e06';
  ctx.lineWidth = 2.5;
  ctx.stroke(new P(SHIELD_CLOTH));
  // rivets round the rim, where a smith would strike them
  ctx.fillStyle = '#fff6cc';
  for (const [rx, ry] of [
    [14, 10],
    [86, 10],
    [10, 44],
    [90, 44],
    [26, 80],
    [74, 80],
    [50, 96],
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  const inset = frame * 0.8;
  drawArms(ctx, arms, (S - inset) / 2, fy + frame * 0.09, inset, logo);
  return true;
}
