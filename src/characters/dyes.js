// Dye and material tint tables (Characters C5b).
// 1:1 from DFU ImageProcessing (MIT, Daggerfall Workshop) - the
// classic tint mechanism itself, the engine under every clothing
// variant and armor material:
//   - ChangeDye swaps a 16-index band: clothing sprites author in
//     0x60-0x6F, weapons/armor in 0x70-0x7F; the band remaps to the
//     dye's table, every other index passes through.
//   - Clothing tables are pure range shifts (Blue 0x60 identity, Grey
//     0x50, Red 0xEF, DarkBrown 0x20, Purple 0x30, LightBrown 0x40,
//     White 0x70, Aquamarine 0x80, Yellow 0x90, Green 0xA0).
//   - Metal tables are the explicit 16-byte sequences below,
//     EXTRACTION-GENERATED from GetMetalColorTable (never hand-copied).
// C6's voxel pieces consume these directly: author a piece's colors as
// band indices, resolve through applyDyeToIndex + ART_PAL at build.

export const DYE_COLORS = Object.freeze({
  Blue: 0, Grey: 1, Red: 2, DarkBrown: 3, Purple: 4, LightBrown: 5,
  White: 6, Aquamarine: 7, Yellow: 8, Green: 9,
  Iron: 15, Steel: 16, Chain: 18, Unchanged: 18, SilverOrElven: 18,
  Silver: 18, Elven: 19, Dwarven: 20, Mithril: 21, Adamantium: 22,
  Ebony: 23, Orcish: 24, Daedric: 25,
});
export const DYE_TARGETS = Object.freeze({ Clothing: 0, WeaponsAndArmor: 1 });
export const CLOTHING_DYES = Object.freeze([
  DYE_COLORS.Blue, DYE_COLORS.Grey, DYE_COLORS.Red, DYE_COLORS.DarkBrown,
  DYE_COLORS.Purple, DYE_COLORS.LightBrown, DYE_COLORS.White,
  DYE_COLORS.Aquamarine, DYE_COLORS.Yellow, DYE_COLORS.Green,
]);

const CLOTHING_STARTS = { 0: 0x60, 1: 0x50, 2: 0xef, 3: 0x20, 4: 0x30, 5: 0x40, 6: 0x70, 7: 0x80, 8: 0x90, 9: 0xa0 };
export const METAL_TABLES = Object.freeze({
 "Iron": [
  119,
  120,
  87,
  121,
  88,
  89,
  122,
  90,
  123,
  91,
  124,
  92,
  125,
  93,
  94,
  95
 ],
 "Steel": [
  112,
  113,
  114,
  115,
  116,
  117,
  118,
  119,
  120,
  121,
  122,
  123,
  124,
  125,
  126,
  127
 ],
 "Silver": [
  224,
  112,
  80,
  113,
  81,
  114,
  115,
  82,
  116,
  83,
  117,
  84,
  85,
  86,
  87,
  88
 ],
 "Elven": [
  224,
  112,
  80,
  113,
  81,
  114,
  115,
  82,
  116,
  83,
  117,
  84,
  118,
  86,
  119,
  120
 ],
 "Dwarven": [
  144,
  145,
  146,
  147,
  148,
  149,
  150,
  151,
  152,
  153,
  154,
  155,
  156,
  157,
  158,
  159
 ],
 "Mithril": [
  103,
  104,
  105,
  106,
  107,
  108,
  109,
  110,
  111,
  216,
  217,
  218,
  219,
  220,
  221,
  222
 ],
 "Adamantium": [
  90,
  91,
  124,
  92,
  125,
  93,
  126,
  94,
  127,
  216,
  217,
  218,
  219,
  220,
  221,
  222
 ],
 "Ebony": [
  119,
  120,
  121,
  122,
  123,
  124,
  125,
  126,
  127,
  216,
  217,
  218,
  219,
  220,
  221,
  222
 ],
 "Orcish": [
  198,
  199,
  200,
  201,
  202,
  203,
  204,
  205,
  206,
  207,
  216,
  217,
  218,
  219,
  220,
  221
 ],
 "Daedric": [
  239,
  240,
  241,
  242,
  243,
  244,
  245,
  246,
  247,
  248,
  249,
  250,
  251,
  252,
  253,
  254
 ],
 "None": [
  112,
  113,
  114,
  115,
  116,
  117,
  118,
  119,
  120,
  121,
  122,
  123,
  124,
  125,
  126,
  127
 ]
});

const METAL_BY_DYE = { 15: 'Iron', 16: 'Steel', 18: 'Silver', 19: 'Elven', 20: 'Dwarven', 21: 'Mithril', 22: 'Adamantium', 23: 'Ebony', 24: 'Orcish', 25: 'Daedric' };

/** Verbatim GetDyeColorTable. */
export function getDyeColorTable(dye, target) {
  if (target === DYE_TARGETS.Clothing) {
    const start = CLOTHING_STARTS[dye] ?? 0x60;
    return Array.from({ length: 16 }, (_, i) => start + i);
  }
  if (target === DYE_TARGETS.WeaponsAndArmor) {
    return METAL_TABLES[METAL_BY_DYE[dye] ?? 'None'];
  }
  return null;
}

/** Verbatim ChangeDye on a single palette index. */
export function applyDyeToIndex(index, dye, target) {
  const start = target === DYE_TARGETS.Clothing ? 0x60 : 0x70;
  if (index >= start && index <= start + 0x0f) {
    return getDyeColorTable(dye, target)[index - start];
  }
  return index;
}
