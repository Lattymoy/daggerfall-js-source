// @ts-check
// GUILD-SHOP (2026-10-30; bible/11-Multiplayer/Guild-Shop.md): THE GUILD FURNITURE'S PICTURES - the port's own, made in code
// under a pseudo-archive (merchantYardArt.js's law: pixels and numbers, nothing of Daggerfall's read). Eight materials
// every hall shares, and two pictures of the hall's own arms - its banner and its shield - painted again whenever the hall
// stood is another guild's or its arms change (wearGuildArt, asked by the decor room each frame a guild piece stands).
import { YARD_ART_KIT } from './merchantYards/merchantYardArt.js';
import { heraldryOf, heraldryColourOf, heraldryInk } from '../net/heraldryLaw.js';
import { armsKey } from '../net/guild/guildArmsBook.js';
import { drawArms, drawBannerArms } from '../ui/guild/guildCrestArt.js';
import { logoImage, logoVersion } from '../ui/guild/guildLogoImages.js';

const { rng, noiseField, image, put, mix } = YARD_ART_KIT;

/** The pseudo-archive the guild furniture's pictures stand under (world/eliteGates/pseudoArchives.js registers it). AUDIT
 *  GUILD-SHOP R2: it took 38241, the Spire's Broken Galleries - both drew each other's dress. */
export const GUILD_ART_ARCHIVE = 38341;
/** Its records: the shared materials, then the hall's arms. */
export const GUILD_ART_REC = Object.freeze({
  oak: 0,
  darkwood: 1,
  gilt: 2,
  iron: 3,
  velvet: 4,
  map: 5,
  coals: 6,
  leather: 7,
  banner: 8,
  shield: 9,
});
/** A material's side, and the arms' pictures' sizes (texels). */
export const GUILD_ART_SIZE = 64;
export const GUILD_BANNER_W = 64;
export const GUILD_SHIELD_PX = 128;

/** Planks: grain along u, a seam every quarter, its tone between `dark` and `light`. */
function planks(seed, dark, light) {
  const S = GUILD_ART_SIZE,
    img = image(S),
    n = noiseField(seed, 4, S, S, 16),
    r = rng(seed + 1);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let c = mix(dark, light, 0.25 + 0.6 * n(x, y));
      if (y % 16 === 0) c = mix(c, [20, 12, 6], 0.6);
      if (r() < 0.004) c = mix(c, [30, 18, 8], 0.8); // a knot's fleck
      put(img, x, y, c);
    }
  return img;
}
/** Beaten gold: warm, a soft hammered light across it. */
function gilt(seed = 0x6117) {
  const S = GUILD_ART_SIZE,
    img = image(S),
    n = noiseField(seed, 6, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) put(img, x, y, mix([150, 104, 26], [255, 222, 120], 0.3 + 0.7 * n(x, y)));
  return img;
}
function iron(seed = 0x1a07) {
  const S = GUILD_ART_SIZE,
    img = image(S),
    n = noiseField(seed, 5, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) put(img, x, y, mix([34, 33, 34], [88, 86, 84], 0.25 + 0.55 * n(x, y)));
  return img;
}
function velvet(seed = 0x7e17) {
  const S = GUILD_ART_SIZE,
    img = image(S),
    n = noiseField(seed, 8, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) put(img, x, y, mix([70, 10, 18], [150, 28, 40], 0.3 + 0.6 * n(x, y)));
  return img;
}
/** THE WAR TABLE'S MAP: parchment, a continent's shape out of its noise, its provinces' lines, a compass rose. */
function warMap(seed = 0x7a31) {
  const S = 128,
    img = image(S),
    land = noiseField(seed, 5, S),
    grain = noiseField(seed + 9, 16, S),
    r = rng(seed + 2);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = (x - S / 2) / (S / 2),
        dy = (y - S / 2) / (S / 2),
        fall = 1 - Math.hypot(dx * 0.9, dy * 1.1);
      const h = land(x, y) * 0.6 + fall * 0.7;
      let c = mix([214, 190, 140], [236, 214, 168], grain(x, y));
      if (h > 0.62) c = mix([168, 150, 104], [190, 168, 116], grain(x, y)); // land, inked darker
      if (Math.abs(h - 0.62) < 0.012) c = [92, 60, 32]; // the coast
      if (h > 0.66 && (x % 32 === 0 || y % 40 === 0) && r() < 0.7) c = mix(c, [120, 40, 30], 0.5); // the provinces' lines
      if (x < 3 || y < 3 || x > S - 4 || y > S - 4) c = [96, 64, 34];
      put(img, x, y, c);
    }
  for (let k = 0; k < 10; k++) {
    put(img, 112 + k - 5, 112, [60, 36, 20]);
    put(img, 112, 112 + k - 5, [60, 36, 20]);
  } // the compass
  return img;
}
function coals(seed = 0xc0a1) {
  const S = GUILD_ART_SIZE,
    img = image(S),
    n = noiseField(seed, 7, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = n(x, y);
      put(
        img,
        x,
        y,
        v > 0.55 ? mix([255, 140, 30], [255, 230, 140], (v - 0.55) * 2.2) : mix([30, 12, 8], [140, 40, 10], v * 1.8),
      );
    }
  return img;
}
function leather(seed = 0x1ea7) {
  const S = GUILD_ART_SIZE,
    img = image(S),
    n = noiseField(seed, 10, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) put(img, x, y, mix([60, 30, 16], [118, 66, 34], 0.3 + 0.6 * n(x, y)));
  return img;
}

/** Every shared material, by record - uploaded once a renderer. */
export const guildMaterialArt = () => [
  [GUILD_ART_REC.oak, planks(0x0a4, [96, 62, 34], [168, 118, 70])],
  [GUILD_ART_REC.darkwood, planks(0xd4c, [34, 20, 12], [86, 54, 30])],
  [GUILD_ART_REC.gilt, gilt()],
  [GUILD_ART_REC.iron, iron()],
  [GUILD_ART_REC.velvet, velvet()],
  [GUILD_ART_REC.map, warMap()],
  [GUILD_ART_REC.coals, coals()],
  [GUILD_ART_REC.leather, leather()],
];

/** A canvas painted `w` by `h`, read back as the yards' picture shape - or null where no canvas can be made (a pin). */
function canvasArt(
  /** @type {number} */ w,
  /** @type {number} */ h,
  /** @type {(ctx: CanvasRenderingContext2D) => boolean} */ paint,
) {
  const doc = /** @type {any} */ (globalThis).document;
  const c = doc?.createElement?.('canvas'),
    ctx = c?.getContext?.('2d');
  if (!ctx) return null;
  c.width = w;
  c.height = h;
  if (!paint(ctx)) return null;
  const d = ctx.getImageData(0, 0, w, h).data,
    img = image(w, h);
  img.colors.set(d);
  return img;
}
/** The arms' colours alone, where no canvas is: its field, a band of its ink. */
function plainArms(/** @type {any} */ arms, /** @type {number} */ w, /** @type {number} */ h) {
  const hr = heraldryOf(arms?.heraldry),
    hex = (/** @type {string|undefined} */ x, /** @type {number[]} */ d) =>
      x ? [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)) : d;
  const field = hex(hr ? heraldryColourOf(hr.field)?.hex : undefined, [230, 230, 230]),
    ink = hex(hr ? heraldryColourOf(heraldryInk(hr))?.hex : undefined, [138, 138, 138]);
  const img = image(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(img, x, y, Math.abs(y - h / 2) < h / 10 ? ink : field);
  return img;
}
/** THE HALL'S ARMS AS ITS TWO PICTURES - its banner (`GUILD_BANNER_W` by three of it) and its shield (guildCrestArt.js
 *  drawBannerArms and drawArms, its logo where it has one approved). Pure but for the canvas. */
export function guildArmsArt(/** @type {any} */ arms) {
  const logo = logoImage(arms?.logo);
  const banner =
    canvasArt(GUILD_BANNER_W, GUILD_BANNER_W * 3, (ctx) => {
      ctx.fillStyle = '#5a3e22';
      ctx.fillRect(0, 0, GUILD_BANNER_W, GUILD_BANNER_W * 3);
      drawBannerArms(ctx, arms?.heraldry ?? null, GUILD_BANNER_W, logo);
      return true;
    }) ?? plainArms(arms, GUILD_BANNER_W, GUILD_BANNER_W * 3);
  const shield =
    canvasArt(GUILD_SHIELD_PX, GUILD_SHIELD_PX, (ctx) => {
      ctx.fillStyle = '#2a1a0c';
      ctx.fillRect(0, 0, GUILD_SHIELD_PX, GUILD_SHIELD_PX);
      return drawArms(ctx, arms, 6, 2, GUILD_SHIELD_PX - 12, logo);
    }) ?? plainArms(arms, GUILD_SHIELD_PX, GUILD_SHIELD_PX);
  return [
    [GUILD_ART_REC.banner, banner],
    [GUILD_ART_REC.shield, shield],
  ];
}

/** @type {WeakMap<any, { materials: boolean, arms: string|null, armsObj: any, logoV: number }>} */
const _worn = new WeakMap();
/**
 * THE GUILD FURNITURE'S PICTURES ON `renderer` - its materials once, and the hall's arms (`arms`, `{ heraldry, logo }`)
 * whenever they are other than the ones it wears (an arms' picture is let go first: the renderer keeps the first picture
 * a key is given). Answers whether it painted anything this call. EVERY ALLOCATION HAS AN OWNER: the renderer's own
 * texture cache keeps them, as it keeps the yards'.
 * @param {any} renderer @param {any} arms
 */
export function wearGuildArt(renderer, arms) {
  if (!renderer?.uploadTexture) return false;
  let w = _worn.get(renderer);
  if (!w) _worn.set(renderer, (w = { materials: false, arms: null, armsObj: undefined, logoV: -1 }));
  let did = false;
  // AUDIT GUILD-SHOP R1: under the opaque key the decor room's meshes ask (their upload's stand-in placeholder replaced)
  if (!w.materials) {
    for (const [rec, pic] of guildMaterialArt()) renderer.uploadTexture(GUILD_ART_ARCHIVE, rec, pic, { opaque: true });
    w.materials = true;
    did = true;
  }
  // AUDIT GUILD-SHOP: asked each frame - the same arms object and no logo come in since is no string made
  if (w.armsObj === arms && w.logoV === logoVersion()) return did;
  w.armsObj = arms;
  w.logoV = logoVersion();
  const key = `${armsKey(arms)}|${arms?.logo && logoImage(arms.logo) ? 1 : 0}`;
  if (w.arms !== key) {
    for (const [rec, pic] of guildArmsArt(arms)) {
      renderer.releaseTexture?.(GUILD_ART_ARCHIVE, rec);
      renderer.uploadTexture(GUILD_ART_ARCHIVE, rec, pic, { opaque: true });
    }
    w.arms = key;
    did = true;
  }
  return did;
}
