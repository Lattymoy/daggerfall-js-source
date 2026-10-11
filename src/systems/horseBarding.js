// @ts-check
// BARD1 (2026-10-11, the owner: "can you do sprite armor for the 2d sprites and 3d armor for the horse"; asked, "Look +
// light trade-off" and all four - leather, chain and plate barding and a cloth caparison): HORSE BARDING, ITS LAW
// (bible/06-Systems/Horse-Barding.md). Pure: no DOM, no GL, no clock.
//
//  - WHAT A HORSE WEARS: two fields on DFU's one Horse item (systems/itemFields.js) - `horseBarding` (1 leather, 2
//    chain, 3 plate; absent, none) and `horseCaparison` (one of CAPARISON_COLOURS; absent, none). They ride the horse's
//    look (systems/horseCoats.js horseLookCode's high digits), so every picture of it - the sprites, the 3D horse, a
//    peer's, a parked team's - is drawn in them, and the wire says them as it says the coat.
//  - WHAT IT DOES: astride, the rider's every part is BARDING_ARMOR the better armoured (systems/upkeepRuntime.js's
//    fold - a horse struck is a rider's legs struck, and the port's horses take no blow of their own); the weight
//    costs the horse its pace (bardingPace - a strong horse carries it lighter) and its breath at the gallop
//    (bardingBreath).
//  - HOW IT IS HAD: four items (systems/upkeepItemRows.js BARDING_ITEM), sold at the Stable, fitted and taken off on the
//    Stable page (fitBarding, fitCaparison) - the old piece back in the pack, so a fitting loses nothing; a caparison
//    fitted is dyed again free.
//  - HOW IT IS DRAWN: on a sprite, painted over the hide (bardingPixel - recolorHorse's pass, the hide's own light its
//    shading); on the 3D horse, shells over its body (world/horseModel.js bardingShells) in pictures made here
//    (bardingTexels, caparisonTexels).
//
// Not a DFU member: Daggerfall's horse wears nothing. Ledger A (BARD1).
import { TRANSPORT_HORSE, setItemFields, mintCondition } from './itemTemplates.js';
import { BARDING_ITEM, UPKEEP_ITEM_GROUP, newBardingItem } from './upkeepItemRows.js';

/** The barding a horse wears, `horseBarding`'s values (0 none). */
export const BARDING_KINDS = Object.freeze(['none', 'leather', 'chain', 'plate']);
export const BARDING_MAX = BARDING_KINDS.length - 1;
/** The caparison's colours, `horseCaparison`'s values (0 none). */
export const CAPARISON_COLOURS = Object.freeze(['none', 'crimson', 'azure', 'forest', 'gold', 'sable', 'ivory', 'purple', 'orange']);
export const CAPARISON_MAX = CAPARISON_COLOURS.length - 1;
export const BARDING_NAMES = Object.freeze({ none: 'None', leather: 'Leather', chain: 'Chain', plate: 'Plate' });
export const CAPARISON_NAMES = Object.freeze({ none: 'None', crimson: 'Crimson', azure: 'Azure', forest: 'Forest', gold: 'Gold', sable: 'Sable', ivory: 'Ivory', purple: 'Purple', orange: 'Orange' });
/** Each colour's cloth, and the hem's trim - gold, but on a gold cloth sable. */
export const CAPARISON_RGB = Object.freeze({
  crimson: Object.freeze([150, 26, 34]), azure: Object.freeze([38, 74, 164]), forest: Object.freeze([32, 98, 50]), gold: Object.freeze([200, 154, 44]),
  sable: Object.freeze([36, 34, 40]), ivory: Object.freeze([224, 216, 192]), purple: Object.freeze([98, 42, 132]), orange: Object.freeze([206, 106, 32]),
});
export const CAPARISON_TRIM = Object.freeze([214, 174, 66]);
export const CAPARISON_TRIM_ON_GOLD = Object.freeze([44, 32, 26]);
/** Points off a blow's chance to land on each of the rider's parts, astride (entityMods.js armorParts) - leather the
 *  worth of a leather cuirass's step, plate of steel's. */
export const BARDING_ARMOR = Object.freeze({ none: 0, leather: 2, chain: 4, plate: 6 });
/** Each piece's burden on a horse - a share of its pace lost at Strength nought, less as its Strength rises. */
export const BARDING_LOAD = Object.freeze({ none: 0, leather: 0.03, chain: 0.06, plate: 0.1 });
export const CAPARISON_LOAD = 0.01;
/** The burden's share a Strength of 100 still feels: 1.2 - strength / 100 (Strength 50: 0.7; plate 7% slower). */
export const STRENGTH_EASE = 1.2;
/** How much faster a burdened horse tires at the gallop: 1 + BREATH_BURDEN x its load (plate: 30%). */
export const BREATH_BURDEN = 3;
/** The item each kind is, and the caparison's. */
export const BARDING_ITEM_OF = Object.freeze({ leather: BARDING_ITEM.Leather, chain: BARDING_ITEM.Chain, plate: BARDING_ITEM.Plate });

const index = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isHorse = (item) => item?.templateIndex === TRANSPORT_HORSE;

/** What a horse item wears: `{ barding, caparison }`, each its index (0 none) - none for anything not a horse. */
export const horseBardingOf = (item) => (isHorse(item) ? { barding: index(item.horseBarding, BARDING_MAX), caparison: index(item.horseCaparison, CAPARISON_MAX) } : { barding: 0, caparison: 0 });
/** The burden of what a horse wears (a look, or anything with `barding` and `caparison`). */
export const bardingLoad = (w) => (BARDING_LOAD[BARDING_KINDS[index(w?.barding, BARDING_MAX)]] ?? 0) + (index(w?.caparison, CAPARISON_MAX) ? CAPARISON_LOAD : 0);
/** The pace a horse keeps in it, its Strength `strength` (0-100): 1 bare. */
export const bardingPace = (w, strength = 50) => 1 - bardingLoad(w) * (STRENGTH_EASE - clamp(Number.isFinite(strength) ? strength : 50, 0, 100) / 100);
/** How much faster it tires at the gallop: 1 bare. */
export const bardingBreath = (w) => 1 + BREATH_BURDEN * bardingLoad(w);
/** The rider's armour points astride a horse in it. */
export const riderArmor = (w) => BARDING_ARMOR[BARDING_KINDS[index(w?.barding, BARDING_MAX)]] ?? 0;
/** What it wears in words - "plate barding under a crimson caparison", "chain barding", "an azure caparison" - '' bare. */
export function describeBarding(w) {
  const b = BARDING_KINDS[index(w?.barding, BARDING_MAX)], c = CAPARISON_COLOURS[index(w?.caparison, CAPARISON_MAX)];
  const cap = c === 'none' ? '' : `${/^[aeiou]/.test(c) ? 'an' : 'a'} ${c} caparison`;
  if (b === 'none') return cap;
  return cap ? `${b} barding under ${cap}` : `${b} barding`;
}
/** The costs and the gain in a line, its Strength `strength`: "Rider armour +6 · Speed -7% · Gallop tires 30% faster". */
export function bardingEffects(w, strength = 50) {
  const armor = riderArmor(w), pace = Math.round((1 - bardingPace(w, strength)) * 100), breath = Math.round((bardingBreath(w) - 1) * 100);
  return { armor, pace, breath, text: bardingLoad(w) ? [armor ? `Rider armour +${armor}` : null, `Speed -${pace}%`, `Gallop tires ${breath}% faster`].filter(Boolean).join(' · ') : 'Unarmoured: no burden.' };
}

// ── the fitting ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const BARDING_TEXT = Object.freeze({
  noHorse: 'You do not own a horse.',
  need: (name) => `You carry no ${name} to fit. The Stable sells it.`,
  fitted: (name) => `Your horse is fitted with ${name}.`,
  off: (name) => `The ${name} comes off your horse, into your pack.`,
  dyed: (colour) => `Your horse's caparison is ${colour} now.`,
  wears: 'Your horse wears that already.',
  bare: 'Your horse wears none.',
});
const itemName = (templateIndex) => setItemFields({ group: UPKEEP_ITEM_GROUP, templateIndex }).name ?? 'barding';
/** One of `templateIndex` out of the pack (a stack less one) - never a quest's. Answers whether one was there. */
function takeOne(items, templateIndex) {
  const i = items.findIndex((it) => it?.group === UPKEEP_ITEM_GROUP && it.templateIndex === templateIndex && !it.questItem);
  if (i < 0) return false;
  const it = items[i];
  if ((it.stackCount ?? 1) > 1) it.stackCount--;
  else items.splice(i, 1);
  return true;
}
/** How many of `templateIndex` the pack holds. */
export const bardingCarried = (items, templateIndex) => (Array.isArray(items) ? items.reduce((n, it) => n + (it?.group === UPKEEP_ITEM_GROUP && it.templateIndex === templateIndex && !it.questItem ? (it.stackCount ?? 1) : 0), 0) : 0);
/** The horse in `items` given `field` `v` (absent for 0) - a new object in the old one's place, as a restyle's. */
function setHorse(items, horse, field, v) {
  const { [field]: _drop, ...rest } = horse;
  items[items.indexOf(horse)] = v ? { ...rest, [field]: v } : rest;
}
/**
 * THE BARDING FITTED: the horse a player rides (the pack's first) put in kind `k` (an index of BARDING_KINDS; 0 takes
 * it off) - the kind's item out of the pack, the old kind's back into it. `{ ok, text }`, what the Stable says.
 */
export function fitBarding(items, k) {
  const horse = Array.isArray(items) ? items.find(isHorse) : null;
  if (!horse) return { ok: false, text: BARDING_TEXT.noHorse };
  const want = index(k, BARDING_MAX), cur = horseBardingOf(horse).barding;
  if (want === cur) return { ok: false, text: want ? BARDING_TEXT.wears : BARDING_TEXT.bare };
  const wantItem = want ? BARDING_ITEM_OF[BARDING_KINDS[want]] : 0, curItem = cur ? BARDING_ITEM_OF[BARDING_KINDS[cur]] : 0;
  if (wantItem && !takeOne(items, wantItem)) return { ok: false, text: BARDING_TEXT.need(itemName(wantItem)) };
  if (curItem) items.push(mintCondition(setItemFields(newBardingItem(curItem))));
  setHorse(items, horse, 'horseBarding', want);
  return { ok: true, text: want ? BARDING_TEXT.fitted(itemName(wantItem)) : BARDING_TEXT.off(itemName(curItem)) };
}
/**
 * THE CAPARISON: the ridden horse's put in colour `c` (an index of CAPARISON_COLOURS; 0 takes it off, into the pack) -
 * one fitted is dyed again free; a bare horse takes one out of the pack.
 */
export function fitCaparison(items, c) {
  const horse = Array.isArray(items) ? items.find(isHorse) : null;
  if (!horse) return { ok: false, text: BARDING_TEXT.noHorse };
  const want = index(c, CAPARISON_MAX), cur = horseBardingOf(horse).caparison;
  if (want === cur) return { ok: false, text: want ? BARDING_TEXT.wears : BARDING_TEXT.bare };
  if (want && !cur && !takeOne(items, BARDING_ITEM.Caparison)) return { ok: false, text: BARDING_TEXT.need(itemName(BARDING_ITEM.Caparison)) };
  if (!want) items.push(mintCondition(setItemFields(newBardingItem(BARDING_ITEM.Caparison))));
  setHorse(items, horse, 'horseCaparison', want);
  return { ok: true, text: !want ? BARDING_TEXT.off('caparison') : cur ? BARDING_TEXT.dyed(CAPARISON_COLOURS[want]) : BARDING_TEXT.fitted(`${/^[aeiou]/.test(CAPARISON_COLOURS[want]) ? 'an' : 'a'} ${CAPARISON_COLOURS[want]} caparison`) };
}
/**
 * The ridden horse's barding as the Stable lists it: its words and the costs, and a row a piece - its choices' names,
 * the one worn, and which may be chosen (the worn, none, and what the pack carries; a fitted caparison any colour).
 * Null with no horse. `strength` the horse's (systems/steedCare.js), for the costs' line.
 */
export function bardingRows(items, strength = 50) {
  const horse = Array.isArray(items) ? items.find(isHorse) : null;
  if (!horse) return null;
  const w = horseBardingOf(horse);
  const capHave = w.caparison > 0 || bardingCarried(items, BARDING_ITEM.Caparison) > 0;
  return {
    desc: describeBarding(w), effects: bardingEffects(w, strength).text,
    rows: [
      { part: 'barding', name: 'Barding', choices: BARDING_KINDS.map((k) => BARDING_NAMES[k]), current: w.barding,
        open: BARDING_KINDS.map((k, i) => i === 0 || i === w.barding || bardingCarried(items, BARDING_ITEM_OF[k]) > 0) },
      { part: 'caparison', name: 'Caparison', choices: CAPARISON_COLOURS.map((k) => CAPARISON_NAMES[k]), current: w.caparison,
        open: CAPARISON_COLOURS.map((_, i) => i === 0 || capHave) },
    ],
  };
}

// ── the sprite's paint ───────────────────────────────────────────────────────────────────────────────────────────────

/** The armour's line on a whole horse's picture, as a share of the hide's height from the hooves: above the knees. */
export const BARDING_KNEE = 0.45;
/** Leather leaves the head bare: above this share it is the hide's. */
export const LEATHER_HEAD = 0.8;
/** The riding sprite's neck (no hooves drawn): leather covers its base, up to this share. */
export const LEATHER_NECK = 0.5;
/** The caparison's skirt, its hem and its top: shares of the hide's height; the hem's trim this deep. */
export const CAPARISON_BAND = Object.freeze([0.3, 0.74]);
export const CAPARISON_HEM = 0.05;
const STEEL = [180, 186, 196], MAIL = [134, 140, 150], HIDE_LEATHER = [78, 46, 26], STITCH = [210, 186, 136], BRASS = [214, 170, 74];
const shadeRgb = (c, k) => [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)];

/**
 * A hide pixel under what the horse wears, or null where it shows: `w` its barding and caparison; `shade` the hide's
 * own light there over its region's (the picture's shading, kept); `fy` its height from the hooves as a share of the
 * hide's; `px`, `py` its column and its height in pixels (the patterns' grid); `legs` a whole horse (false: the riding
 * sprite's head and neck - the armour from its lower edge, no skirt).
 * @param {{ barding?: number, caparison?: number }} w
 * @param {{ shade: number, fy: number, px: number, py: number, legs?: boolean }} at
 * @returns {number[] | null}
 */
export function bardingPixel(w, { shade, fy, px, py, legs = true }) {
  const kind = BARDING_KINDS[index(w?.barding, BARDING_MAX)], cap = CAPARISON_COLOURS[index(w?.caparison, CAPARISON_MAX)];
  const s = clamp(Number.isFinite(shade) ? shade : 1, 0.4, 1.45);
  if (cap !== 'none' && legs && fy >= CAPARISON_BAND[0] && fy <= CAPARISON_BAND[1]) {
    const hem = fy < CAPARISON_BAND[0] + CAPARISON_HEM || fy > CAPARISON_BAND[1] - CAPARISON_HEM / 2;
    const cloth = hem ? (cap === 'gold' ? CAPARISON_TRIM_ON_GOLD : CAPARISON_TRIM) : CAPARISON_RGB[cap];
    return shadeRgb(cloth, s * (0.9 + 0.1 * Math.sin(px * 0.9)));   // the cloth's folds, hanging
  }
  if (kind === 'none' || (legs && fy < BARDING_KNEE)) return null;
  if (kind === 'leather' && (legs ? fy > LEATHER_HEAD : fy > LEATHER_NECK)) return null;
  const y = Math.max(0, Math.floor(py)), x = Math.max(0, Math.floor(px));
  if (kind === 'plate') {   // lames: a seam, a lit edge under it, a rivet along it
    const r = y % 7;
    const k = r === 0 ? 0.55 : r === 1 ? 1.25 : r === 2 && x % 6 === 0 ? 1.5 : 1;
    return shadeRgb(STEEL, s * s * k);   // steel's light is harder than a hide's
  }
  if (kind === 'chain') return shadeRgb(MAIL, s * ((x + ((y >> 1) & 1)) % 2 === 0 && y % 2 === 0 ? 0.62 : 1));
  // leather: its quilting's stitches, its brass studs, and a darker edge at its hem
  if (y % 8 === 0 && x % 3 !== 2) return shadeRgb(STITCH, s);
  if (y % 8 === 4 && x % 6 === 3) return shadeRgb(BRASS, s * 1.2);
  return shadeRgb(HIDE_LEATHER, s * (legs && fy < BARDING_KNEE + 0.025 ? 0.7 : 1));
}

// ── the 3D horse's pictures ──────────────────────────────────────────────────────────────────────────────────────────

/** The barding's pictures' side, texels (a tile repeated over the shell - BARDING_TILE metres a tile). */
export const BARDING_TEXELS = 64;
export const BARDING_TILE = 0.32;
const hash = (x, y, k) => { let h = Math.imul(x * 374761393 + y * 668265263 + k * 2147483647, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** A barding kind's picture (`leather`, `chain`, `plate`): BARDING_TEXELS square, RGBA, rows top first, tiling. */
export function bardingTexels(kind, n = BARDING_TEXELS) {
  const out = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let c;
    if (kind === 'plate') {
      const r = y % 16;
      const k = r === 0 ? 0.45 : r <= 3 ? 1.25 - r * 0.05 : 1.08 - (r - 4) * 0.02;
      c = shadeRgb(STEEL, (r === 4 && x % 16 === 8) || (r === 5 && x % 16 === 8) ? 1.4 : k);
    } else if (kind === 'chain') {
      const cy = Math.floor(y / 4) * 4 + 2, cx = Math.floor((x + (Math.floor(y / 4) % 2) * 2) / 4) * 4 + 2 - (Math.floor(y / 4) % 2) * 2;
      const d = Math.hypot(x - cx, y - cy);
      c = shadeRgb(MAIL, d < 0.9 ? 0.35 : d < 2.1 ? 1.2 - (d - 0.9) * 0.2 : 0.7);
    } else {
      const r = y % 16, stud = Math.hypot((x % 16) - 8, r - 8) < 1.6;
      const stitch = (r === 2 || r === 13) && x % 4 < 2;
      c = stud ? shadeRgb(BRASS, 1.15) : stitch ? shadeRgb(STITCH, 1) : shadeRgb(HIDE_LEATHER, (r === 0 || r === 15 ? 0.62 : 1) * (0.92 + 0.16 * hash(x, y, 3)));
    }
    const o = (y * n + x) * 4;
    out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
  }
  return out;
}
/** A caparison's picture in colour `c` (an index of CAPARISON_COLOURS, 1 up): its cloth tiling across, its height
 *  the skirt's top (row 0) to its hem (the last) - the trim along the hem. */
export function caparisonTexels(c, n = BARDING_TEXELS) {
  const name = CAPARISON_COLOURS[index(c, CAPARISON_MAX)] === 'none' ? 'crimson' : CAPARISON_COLOURS[index(c, CAPARISON_MAX)];
  const cloth = CAPARISON_RGB[name], trim = name === 'gold' ? CAPARISON_TRIM_ON_GOLD : CAPARISON_TRIM;
  const out = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const hem = y >= n - Math.round(n * 0.1);
    const col = hem ? shadeRgb(trim, 0.95 + 0.1 * hash(x, y, 7)) : shadeRgb(cloth, (0.9 + 0.1 * Math.sin((x / n) * Math.PI * 8)) * (0.95 + 0.08 * hash(x, y, 5)));
    const o = (y * n + x) * 4;
    out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2]; out[o + 3] = 255;
  }
  return out;
}
