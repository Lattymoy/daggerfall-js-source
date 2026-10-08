// @ts-check
// PI1 (2026-10-07, Mac: "This is the next mod I would like to integrate (permission has been granted). This should work
// for both morrowind and the sprite system, and should also included the rarity treatment (like we do for the world
// boss)"): PHYSICAL ITEMS 0.1.29 - demifiend000's items in the world as themselves. THE LAW, PURE: what the mod's
// assembly decides (vendor/physical-items/il/PhysicalItems.il.txt - every `[IL_xxxx]` below is an offset in it, the
// method named beside it), read off the IL because the bundle carries the build and not the sources. The scene half -
// the proxies, their pictures, their flight and their press - is scenes/physicalItemsLayer.js; the design is
// bible/06-Systems/Physical-Items.md.
//
// - THE CATEGORIES (GetItemCategory [IL_28e4]): sixteen, each item in exactly one; a corpse shows the categories the
//   settings leave on (ReconcileCorpseGroup [IL_4bcd]).
// - THE SIZE (GetWorldHeight [IL_2848], GetDefaultWorldHeight [IL_2a08], BuildVisual [IL_0982]): the longest side of the
//   picture's VISIBLE texels (GetVisibleArtworkUV [IL_0d39]: alpha 128 and over) is the category's metres, or a
//   weapon's or an armour piece's own override.
// - THE SCATTER AND THE THROW (RandomScatterOffset [IL_51d8], CreateCorpseProxy [IL_4f2e]): a body's items start 0.45 to
//   0.85 m round it, moved out of it against the walls (ConstrainItemMovement), thrown out and up at the death, scaled by
//   Impulse Strength.
// - THE SPIRAL (GetBatchSpreadCentre, GetBatchDropPosition [IL_4028]): a shift-drop's items 1.1 m ahead, on a golden-angle
//   spiral, 0.78 m a ring.
// - THE BODY (BuildVisual [IL_0c2d], CreatePresentationResources [IL_2b21], Update [IL_1da7], FixedUpdate [IL_1e94]):
//   Unity's rigidbody, restated as a fixed-step integrator (the port has no physics engine - the departure is the
//   page's): gravity, drag 0.9, the material's 0.35 bounce and 0.45 / 0.55 grip, settled after half a second under
//   0.05 m/s with the ground in reach; slow neighbours shouldered apart.
// - THE DROP'S REFUSALS (LocalItemLeftClickPrefix [IL_0528]): the pack's own ground guards, and a Transportation item's
//   "cannotRemoveItem".
//
// Not a DFU member: a vendored mod. Ledger A (PI).
import { RARITIES, rarityOf, lootRarityOn } from './lootRarity.js';
import { tierColour } from '../render/spoilsGlow.js';
import { modSetting } from './modSettings.js';
import { TEMPLATES, isPotion } from './useItem.js';
import { CANNOT_REMOVE_ITEM_TEXT } from './createItem.js';
import { insideUnitCircle } from '../world/passiveFish.js';   // Random.insideUnitCircle's one home
import { rangeFloat } from './unleveledLoot.js';   // Random.Range(float, float)'s
import { planStore, applyTransfer } from './itemTransfer.js';
import { lockRefuses, lockedText } from './itemLock.js';
import { boundRefusesPut, boundText, isPackOnly, packOnlyText } from './itemBound.js';
import { bagMayLeave } from './materialsBag.js';
import { itemLongName } from './itemInfo.js';

export const PHYSICAL_ITEMS_VENDOR = 'physical-items';

/** PhysicalItemManager.ItemCategories (.cctor [IL_7dac]) - the sixteen, in the mod's order (the settings' order). */
export const PI_CATEGORIES = Object.freeze(['Weapons', 'Arrows', 'Armor', 'Clothing', 'Ingredients', 'Gold', 'Potions', 'Books',
  'Gems', 'Jewellery', 'Maps', 'Magic Items', 'Religious Items', 'Quest Items', 'Transportation', 'Other Items']);

/** GetItemCategory's switch [IL_2905] over DFU's ItemGroups, by the port's group names (systems/loot.js). A group the
 *  switch does not name - Drugs, UselessItems1, Furniture, UselessItems2, Paintings, Deeds - is Other Items. */
export const PI_GROUP_CATEGORY = Object.freeze({
  Armor: 'Armor', Weapons: 'Weapons', MagicItems: 'Magic Items', Artifacts: 'Magic Items',
  MensClothing: 'Clothing', WomensClothing: 'Clothing', Books: 'Books', ReligiousItems: 'Religious Items', Maps: 'Maps',
  Gems: 'Gems', PlantIngredients1: 'Ingredients', PlantIngredients2: 'Ingredients', CreatureIngredients1: 'Ingredients',
  CreatureIngredients2: 'Ingredients', CreatureIngredients3: 'Ingredients', MiscellaneousIngredients1: 'Ingredients',
  MetalIngredients: 'Ingredients', MiscellaneousIngredients2: 'Ingredients', Transportation: 'Transportation',
  Jewellery: 'Jewellery', QuestItems: 'Quest Items', Currency: 'Gold',
});

/** GetItemCategory [IL_28e4]: null is Other Items; a potion is Potions before its group is read; a Weapons arrow (template
 *  131) is Arrows; a MiscItems map (template 287) is Maps. Pure. */
export function itemCategory(item) {
  if (!item) return 'Other Items';
  if (isPotion(item)) return 'Potions';
  if (item.group === 'Weapons') return item.templateIndex === TEMPLATES.Arrow ? 'Arrows' : 'Weapons';
  if (item.group === 'MiscItems') return item.templateIndex === TEMPLATES.Map ? 'Maps' : 'Other Items';
  return PI_GROUP_CATEGORY[item.group] ?? 'Other Items';
}

/** GetDefaultWorldHeight [IL_2a08]: weapons 0.8 m (an arrow 0.32), armour 0.65, clothing 0.52, everything else 0.4 - the
 *  settings' shipped Item Sizes. */
export const PI_DEFAULT_HEIGHT = Object.freeze({ weapon: 0.8, arrow: 0.32, armor: 0.65, clothing: 0.52, other: 0.4 });
export function defaultWorldHeight(item) {
  switch (itemCategory(item)) {
    case 'Weapons': return PI_DEFAULT_HEIGHT.weapon;
    case 'Arrows': return PI_DEFAULT_HEIGHT.arrow;
    case 'Armor': return PI_DEFAULT_HEIGHT.armor;
    case 'Clothing': return PI_DEFAULT_HEIGHT.clothing;
    default: return PI_DEFAULT_HEIGHT.other;
  }
}

/** ApplySettings [IL_2f73]: the Weapon Sizes and Armor Sizes keys are DFU's Weapons and Armor enum names with `_` read as
 *  a space, and both pauldrons answer to the one "Pauldrons" key. By template index (systems/loot.js's numbering). */
export const PI_WEAPON_SIZE_KEYS = Object.freeze({ 113: 'Dagger', 114: 'Tanto', 115: 'Staff', 116: 'Shortsword', 117: 'Wakazashi',
  118: 'Broadsword', 119: 'Saber', 120: 'Longsword', 121: 'Katana', 122: 'Claymore', 123: 'Dai Katana', 124: 'Mace',
  125: 'Flail', 126: 'Warhammer', 127: 'Battle Axe', 128: 'War Axe', 129: 'Short Bow', 130: 'Long Bow', 131: 'Arrow' });
export const PI_ARMOR_SIZE_KEYS = Object.freeze({ 102: 'Cuirass', 103: 'Gauntlets', 104: 'Greaves', 105: 'Pauldrons',
  106: 'Pauldrons', 107: 'Helm', 108: 'Boots', 109: 'Buckler', 110: 'Round Shield', 111: 'Kite Shield', 112: 'Tower Shield' });

/** ApplySettings' clamps: a category's size 0.1..1.5 m [IL_2f0e], an override the same when above 0 [IL_302a] (0
 *  inherits), Impulse Strength 0..400 percent [IL_2e73], a NaN or infinite read the shipped value. */
export const PI_SIZE_MIN = 0.1, PI_SIZE_MAX = 1.5, PI_IMPULSE_MAX_PCT = 400, PI_IMPULSE_DEFAULT = 2;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * The settings as the manager holds them after ApplySettings [IL_2e48]: `{ enemyDrops, impulse, disabled: Set,
 * heights: Map(category -> m), overrides: Map('Weapons:<key>'|'Armor:<key>' -> m) }`. `read(key)` answers a declared key
 * (modSetting's shape); the default reads this mod's switches. Pure over `read`.
 * @param {(key: string) => any} [read]
 */
export function readPhysicalItemsSettings(read = (key) => modSetting(PHYSICAL_ITEMS_VENDOR, key)) {
  const pct = read('Enemy Loot.Impulse Strength');
  // [IL_2e73]: clamped first (an infinity clamps to an end), and only a NaN reads the shipped 2 (AUDIT PI1 I10)
  const impulse = typeof pct === 'number' && !Number.isNaN(pct) ? clamp(pct, 0, PI_IMPULSE_MAX_PCT) / 100 : PI_IMPULSE_DEFAULT;
  const disabled = new Set();
  const heights = new Map();
  for (const c of PI_CATEGORIES) {
    if (read(`Enemy Categories.${c}`) === false) disabled.add(c);
    const h = read(`Item Sizes.${c}`);
    if (finite(h)) heights.set(c, clamp(h, PI_SIZE_MIN, PI_SIZE_MAX));
  }
  const overrides = new Map();
  for (const [section, group, table] of [['Weapon Sizes', 'Weapons', PI_WEAPON_SIZE_KEYS], ['Armor Sizes', 'Armor', PI_ARMOR_SIZE_KEYS]]) {
    for (const name of new Set(Object.values(table))) {
      const v = read(`${section}.${name}`);
      if (finite(v) && v > 0) overrides.set(`${group}:${name}`, clamp(v, PI_SIZE_MIN, PI_SIZE_MAX));
    }
  }
  return { enemyDrops: read('Enemy Loot.Physical Enemy Drops') !== false, impulse, disabled, heights, overrides };
}

/** GetWorldHeight [IL_2848]: a weapon's or an armour piece's own override, else its category's size, else the default. */
export function worldHeight(item, settings = null) {
  if (item && (item.group === 'Weapons' || item.group === 'Armor')) {
    const name = (item.group === 'Weapons' ? PI_WEAPON_SIZE_KEYS : PI_ARMOR_SIZE_KEYS)[item.templateIndex];
    const o = name ? settings?.overrides?.get(`${item.group}:${name}`) : undefined;
    if (finite(o)) return o;
  }
  const h = settings?.heights?.get(itemCategory(item));
  return finite(h) ? h : defaultWorldHeight(item);
}

/** Whether a body's item stands out of it - the switch, and its category left on (ReconcileCorpseGroup [IL_4bcd]). */
export const showsOnCorpse = (item, settings) => !!item && settings?.enemyDrops !== false && !settings?.disabled?.has(itemCategory(item));

/** GetVisibleArtworkUV [IL_0d39]: a texel is the item's at alpha 128 and over. */
export const PI_ALPHA_VISIBLE = 128;
/**
 * The picture's visible box, in texels - `{ x, y, w, h }` over its rows as given (either order: the box is the same
 * rows), or the whole picture when no texel is visible (the mod's `Rect(0, 0, 1, 1)` [IL_0dc9]). `colors` RGBA. Pure.
 * @param {ArrayLike<number>} colors @param {number} width @param {number} height
 */
export function visibleBox(colors, width, height) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (colors[(y * width + x) * 4 + 3] < PI_ALPHA_VISIBLE) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < x0 || y1 < y0) return { x: 0, y: 0, w: width, h: height };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/** AUDIT PI1 R7: whether any texel of a picture is the item's - an empty picture (a Morrowind render that came out clear)
 *  is no picture, and the pack's stands instead. Pure. */
export function hasVisible(colors) {
  for (let i = 3; i < colors.length; i += 4) if (colors[i] >= PI_ALPHA_VISIBLE) return true;
  return false;
}
/** The picture cut to that box (RGBA, the same row order). Pure. AUDIT PI1 L12: a typed array's rows by view. */
export function cropTo(colors, width, box) {
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  const view = typeof (/** @type {any} */ (colors)).subarray === 'function';
  for (let y = 0; y < box.h; y++) {
    const s = ((box.y + y) * width + box.x) * 4;
    out.set(view ? /** @type {any} */ (colors).subarray(s, s + box.w * 4) : Array.prototype.slice.call(colors, s, s + box.w * 4), y * box.w * 4);
  }
  return out;
}
/**
 * AUDIT PI1 R3: THE EDGE BLED - every texel the item does not own takes the colour of its owned neighbours, its alpha
 * untouched, `passes` rings out. Both sources hand a clear texel as black (a canvas's getImageData, the Morrowind
 * render's cleared background), and the mip chain a numeric archive builds averages that black into the item's edge: a
 * dark outline at a distance that Daggerfall's own flats (GetColor32 keeps the colour under a clear texel) never wear.
 * In place; answers the picture. Pure but for that.
 * @param {Uint8ClampedArray} c @param {number} w @param {number} h
 */
export function bleedEdges(c, w, h, passes = 2) {
  const owned = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) owned[i] = c[i * 4 + 3] >= PI_ALPHA_VISIBLE ? 1 : 0;
  for (let p = 0; p < passes; p++) {
    const fill = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (owned[y * w + x]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const X = x + dx, Y = y + dy;
            if ((dx || dy) && X >= 0 && Y >= 0 && X < w && Y < h && owned[Y * w + X]) { const j = (Y * w + X) * 4; r += c[j]; g += c[j + 1]; b += c[j + 2]; n++; }
          }
        }
        if (n) fill.push(y * w + x, r / n, g / n, b / n);
      }
    }
    if (!fill.length) break;
    for (let k = 0; k < fill.length; k += 4) { const i = fill[k]; c[i * 4] = fill[k + 1]; c[i * 4 + 1] = fill[k + 2]; c[i * 4 + 2] = fill[k + 3]; owned[i] = 1; }
  }
  return c;
}
/** BuildVisual [IL_09b8]: the scale that makes the longer visible side `worldH` metres, and the size it makes. */
export function artworkSize(visW, visH, worldH) {
  const k = worldH / Math.max(visW, visH);
  return { w: visW * k, h: visH * k };
}
/** GetColliderDepth [IL_1a21] for a billboard (the only placement the port stands): the box's depth is the width or 0.4
 *  of the height, whichever is more. */
export const colliderDepth = (w, h) => Math.max(w, h * 0.4);

// ---- the scatter, the throw and the spiral ---------------------------------------------------------------------------

/** RandomScatterOffset [IL_51d8]: a direction in the disc (right when it is all but zero), 0.45..0.85 m out, and 0.65 m
 *  up - where a body's item first stands, from the body. */
export const PI_SCATTER = Object.freeze({ min: 0.45, max: 0.85, up: 0.65 });
export function scatterOffset(rolls = Math.random) {
  let [x, y] = insideUnitCircle(rolls);
  if (x * x + y * y < 1e-4) { x = 1; y = 0; }
  const l = Math.hypot(x, y), r = rangeFloat(PI_SCATTER.min, PI_SCATTER.max, rolls);
  return [(x / l) * r, PI_SCATTER.up, (y / l) * r];
}
/**
 * CreateCorpseProxy's launch [IL_4fe6]: an item thrown out of a body - `fresh` the death itself (out 0.75..1 of 0.85 m/s
 * along its bearing from the body plus a tenth of a disc, up 0.7..1.1 m/s, times Impulse Strength), else the reconcile's
 * nudge (0.08 out and 0.08 up, unscaled). `rel` the item's place from the body. Answers the velocity [x, y, z]. Pure.
 * @param {number[]} rel @param {boolean} fresh @param {number} impulse @param {() => number} [rolls]
 */
export const PI_LAUNCH = Object.freeze({ reach: 0.85, nudge: 0.08, nearShare: 0.75, wobble: 0.1, up: Object.freeze({ min: 0.7, max: 1.1 }) });
export function proxyLaunch(rel, fresh, impulse, rolls = Math.random) {
  const r = fresh ? PI_LAUNCH.reach : PI_LAUNCH.nudge;
  let dx = rel[0], dz = rel[2];
  if (dx * dx + dz * dz < 1e-4) [dx, dz] = insideUnitCircle(rolls);
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  let hx = dx * r, hz = dz * r;
  if (fresh) {
    const s = rangeFloat(r * PI_LAUNCH.nearShare, r, rolls);
    const [wx, wz] = insideUnitCircle(rolls);
    hx = dx * s + wx * PI_LAUNCH.wobble; hz = dz * s + wz * PI_LAUNCH.wobble;
  }
  const up = fresh ? rangeFloat(PI_LAUNCH.up.min, PI_LAUNCH.up.max, rolls) : PI_LAUNCH.nudge;
  const k = fresh ? impulse : 1;
  return [hx * k, up * k, hz * k];
}
/** GetBatchSpreadCentre [IL_3fa4]: the spiral's centre stands this far ahead of the player (flat). GetBatchDropPosition
 *  [IL_4028]: ring i is 0.78 * sqrt(i) out at i * the golden angle, tried 256 times. */
export const PI_SPIRAL = Object.freeze({ ahead: 1.1, ring: 0.78, golden: 2.399963140487671, tries: 256, lift: 0.025, overlap: 0.1 });
/** AUDIT PI1 I3: a drop's footprint (FlushPendingDrops [IL_3b68]): `Mathf.Max(0.2, GetWorldHeight * 0.6)` - the radius
 *  each drop asks room for and leaves as its DropFootprint. */
export const PI_FOOTPRINT = Object.freeze({ min: 0.2, share: 0.6 });
export const dropRadius = (worldH) => Math.max(PI_FOOTPRINT.min, worldH * PI_FOOTPRINT.share);
/** AUDIT PI1 I5: TryProjectBatchPointToFloor [IL_4104] - a ray from 2 m above the anchor's height, 5 m down; of its
 *  hits, only a floor (normal.y 0.5 and over), the one nearest the anchor's height. HasClearBatchPath [IL_4248] - both
 *  ends lifted 0.2 m, and only a hit short of the whole way by more than 0.05 m blocks it. */
export const PI_FLOOR_PROBE = Object.freeze({ up: 2, len: 5, floorNormalY: 0.5 });
export const PI_PATH = Object.freeze({ lift: 0.2, skin: 0.05 });
/** The floor TryProjectBatchPointToFloor picks among `hits` (`{ y, ny }` - a hit's height and its normal's up), nearest
 *  `refY`; null for none. Pure. */
export function nearestFloor(hits, refY) {
  let best = null;
  for (const h of hits) {
    if (!(h.ny >= PI_FLOOR_PROBE.floorNormalY)) continue;
    if (best == null || Math.abs(h.y - refY) < Math.abs(best - refY)) best = h.y;
  }
  return best;
}
export const spiralPoint = (centre, i) => {
  const r = i ? PI_SPIRAL.ring * Math.sqrt(i) : 0, a = i * PI_SPIRAL.golden;
  return [centre[0] + Math.cos(a) * r, centre[1], centre[2] + Math.sin(a) * r];
};
/**
 * The spiral's next free point [IL_4028]: from index `next.i` on, the first point the floor takes (`floorAt(p)` answers
 * its height or null), whose way from `anchor` is clear (`clear(anchor, p)`), and that no placed drop overlaps
 * (OverlapsPlacedDrop [IL_4338]: nearer than the two footprints' radii and 0.1 m) - its foot on that floor. Past 256 tries, the
 * anchor itself. `next.i` advances past every point tried. Pure over its two probes.
 * @param {number[]} anchor @param {number[]} centre @param {number} radius
 * @param {{ i: number }} next @param {Array<{ pos: number[], r: number }>} placed
 * @param {(p: number[]) => (number|null)} floorAt @param {(a: number[], b: number[]) => boolean} [clear]
 */
export function spiralDrop(anchor, centre, radius, next, placed, floorAt, clear = () => true) {   // `radius` and each footprint's: dropRadius
  for (let t = 0; t < PI_SPIRAL.tries; t++) {
    const p = spiralPoint(centre, next.i++);
    const y = floorAt(p);
    if (!finite(y)) continue;
    const at = [p[0], /** @type {number} */ (y), p[2]];
    if (!clear(anchor, at)) continue;
    if (placed.some((d) => Math.hypot(at[0] - d.pos[0], at[2] - d.pos[2]) < radius + d.r + PI_SPIRAL.overlap)) continue;
    return at;
  }
  return [anchor[0], anchor[1], anchor[2]];
}

// ---- the body --------------------------------------------------------------------------------------------------------

/**
 * The rigidbody as the mod configures it: drag 0.9 (BuildVisual [IL_0c60]), rotation frozen (constraints 112), its
 * material's bounce 0.35 under Maximum and grip 0.45 dynamic / 0.55 static under Average (CreatePresentationResources
 * [IL_2b2c]) against Unity's default material (0.6 / 0.6, no bounce), PhysX's bounce threshold (2 m/s: a slower contact
 * does not bounce), Unity's gravity and fixed step. Settled once the ground is within reach and the speed has stayed
 * under 0.05 m/s (0.0025 squared) for half a second (Update [IL_1e0f], [IL_1e55]).
 */
export const PI_BODY = Object.freeze({
  gravity: 9.81, dt: 0.02, drag: 0.9, bounce: 0.35, bounceThreshold: 2,
  dynamicGrip: (0.45 + 0.6) / 2, staticGrip: (0.55 + 0.6) / 2,
  settleSq: 0.0025, settleS: 0.5, reach: 0.1, flightMaxS: 8,
});
/** FixedUpdate's shoulder [IL_1e94]: a body with the ground within its support and 0.15 m (TryFindGround [IL_1ed8]),
 *  slower than 0.65 m/s across and 0.5 m/s up or down, eases toward 0.45 m/s away from every item whose box its own
 *  (grown 0.08 m - OverlapBoxNonAlloc [IL_1f4a]) meets and lies within the two half-widths and 0.04 m across (x and z,
 *  [IL_2024]), at 1.5 m/s a second. */
export const PI_SEPARATION = Object.freeze({ maxAcross: 0.65, maxUpDown: 0.5, pad: 0.04, query: 0.08, ground: 0.15, speed: 0.45, ease: 1.5 });
/** AUDIT PI1 L6: the ground probe starts this far above the foot - a surface above the item is never its floor (a table
 *  the item lies under, a bench beside it). */
export const PI_PROBE_LIFT = 0.05;

/** A body: its foot, its velocity, its box's half-extents across (x, z) and its height, whether it has settled. */
export function makeBody(pos, vel = [0, 0, 0], half = [0.2, 0.2], h = 0.4) {
  return { pos: [...pos], vel: [...vel], half: [...half], h, settled: false, quietFor: 0, t: 0, acc: 0, grounded: false, nearGround: false };
}
/** Settle a body where it stands (StartSettled [IL_1cf8]). */
export function settleBody(b) { b.vel[0] = 0; b.vel[1] = 0; b.vel[2] = 0; b.settled = true; b.quietFor = 0; }

/**
 * One fixed step. `ground(x, y, z)` answers the floor's height under a point (or null) - asked from just above the foot,
 * so a surface above the item is never its floor (AUDIT PI1 L6) - and `wall(from, dir, len)` the first face's distance
 * along a ray (or null): across a level move, and up a rising one (a ceiling turns it back). Answers 'fly', 'bounce' or
 * 'rest'. Pure over the two probes.
 * @param {ReturnType<typeof makeBody>} b
 * @param {(x: number, y: number, z: number) => (number|null)} ground
 * @param {((from: number[], dir: number[], len: number) => (number|null))|null} [wall]
 */
export function stepBody(b, ground, wall = null) {
  if (b.settled) return 'rest';
  const B = PI_BODY, dt = B.dt;
  b.t += dt;
  b.vel[1] -= B.gravity * dt;
  const damp = 1 / (1 + B.drag * dt);
  b.vel[0] *= damp; b.vel[1] *= damp; b.vel[2] *= damp;
  let what = 'fly';
  // across: a wall stops the move and takes the speed into it back at the bounce
  const sx = b.vel[0] * dt, sz = b.vel[2] * dt, run = Math.hypot(sx, sz);
  if (run > 1e-9) {
    const dir = [sx / run, 0, sz / run];
    const hit = wall ? wall([b.pos[0], b.pos[1] + 0.1, b.pos[2]], dir, run + Math.max(b.half[0], b.half[1])) : null;
    if (finite(hit)) {
      const vn = b.vel[0] * dir[0] + b.vel[2] * dir[2];
      const back = vn >= B.bounceThreshold ? B.bounce * vn : 0;
      b.vel[0] -= dir[0] * (vn + back); b.vel[2] -= dir[2] * (vn + back);
      what = 'bounce';
    } else { b.pos[0] += sx; b.pos[2] += sz; }
  }
  // a ceiling over a rising item turns it back (AUDIT PI1 L6)
  if (b.vel[1] > 0 && wall) {
    const up = wall([b.pos[0], b.pos[1] + b.h, b.pos[2]], [0, 1, 0], b.vel[1] * dt);
    if (finite(up)) { const vn = b.vel[1]; b.vel[1] = vn >= B.bounceThreshold ? -B.bounce * vn : 0; what = 'bounce'; }
  }
  // up and down: the floor under the foot, asked from just above it
  const floor = ground(b.pos[0], b.pos[1] + PI_PROBE_LIFT, b.pos[2]);
  const ny = b.pos[1] + b.vel[1] * dt;
  b.grounded = false;
  if (finite(floor) && ny <= /** @type {number} */ (floor)) {
    const vn = -b.vel[1];
    b.pos[1] = /** @type {number} */ (floor);
    const back = vn >= B.bounceThreshold ? B.bounce * vn : 0;
    b.vel[1] = back;
    // the contact's friction impulse: the grip times the normal's change, never past standing still
    const across = Math.hypot(b.vel[0], b.vel[2]);
    if (across > 0) {
      const cut = Math.min(across, B.dynamicGrip * (vn + back));
      b.vel[0] *= (across - cut) / across; b.vel[2] *= (across - cut) / across;
    }
    if (back > 0) what = 'bounce';
    b.grounded = back === 0;
  } else b.pos[1] = ny;
  // resting contact: the impulse above is the sliding grip under its own weight; a slide the static grip holds stands
  if (b.grounded && Math.hypot(b.vel[0], b.vel[2]) <= B.staticGrip * B.gravity * dt) { b.vel[0] = 0; b.vel[2] = 0; }
  // Update's settle: the ground in reach and the speed quiet for half a second
  const near = finite(floor) && b.pos[1] - /** @type {number} */ (floor) <= B.reach;
  b.nearGround = finite(floor) && b.pos[1] - /** @type {number} */ (floor) <= PI_SEPARATION.ground;
  const sq = b.vel[0] * b.vel[0] + b.vel[1] * b.vel[1] + b.vel[2] * b.vel[2];
  if (near && sq <= B.settleSq) {
    b.quietFor += dt;
    if (b.quietFor >= B.settleS) { settleBody(b); return 'rest'; }
  } else b.quietFor = 0;
  if (b.t >= B.flightMaxS) { settleBody(b); return 'rest'; }   // the port's floor: a body still moving after 8 s stands (as the gate spew's SPEW_FLIGHT_MAX_S)
  return what;
}
/** Step a body through `dt` seconds of the fixed clock; answers 'rest' if it came to rest, 'bounce' if it bounced. */
export function flyBody(b, dt, ground, wall = null) {
  let what = 'fly';
  b.acc += Math.max(0, Math.min(0.25, dt));
  while (b.acc >= PI_BODY.dt && !b.settled) {
    b.acc -= PI_BODY.dt;
    const r = stepBody(b, ground, wall);
    if (r === 'rest') what = 'rest';
    else if (r === 'bounce' && what !== 'rest') what = 'bounce';
  }
  return what;
}
/**
 * FixedUpdate's shoulder [IL_1e94] over a set of bodies, one fixed step's worth of `dt`: each unsettled, slow body with
 * the ground in reach eases away from every item it overlaps - settled ones included, as the mod's overlap query finds
 * every item's box - and is never pushed itself once settled. Two at one spot part left and right, the earlier LEFT (the
 * mod's lower instance id [IL_207c]). It writes velocity alone: the settle's quiet clock is Update's (AUDIT PI1 I4 -
 * the port's first cut reset it here, and a crowd never settled before the 8 s floor). The neighbours are found by a
 * grid of cells a metre wide (AUDIT PI1 L3: a body's items, not every pair in the scene). Pure.
 * @param {Array<ReturnType<typeof makeBody>>} bodies @param {number} dt
 */
export function shoulder(bodies, dt) {
  const S = PI_SEPARATION;
  const cell = (v) => Math.floor(v);
  const grid = new Map();
  bodies.forEach((o, i) => {
    const k = `${cell(o.pos[0])},${cell(o.pos[2])}`;
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push(i);
  });
  bodies.forEach((b, bi) => {
    if (b.settled || !b.nearGround) return;
    if (Math.hypot(b.vel[0], b.vel[2]) > S.maxAcross || Math.abs(b.vel[1]) > S.maxUpDown) return;
    let px = 0, pz = 0;
    const cx = cell(b.pos[0]), cz = cell(b.pos[2]);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const oi of grid.get(`${gx},${gz}`) ?? []) {
          if (oi === bi) continue;
          const o = bodies[oi];
          if (Math.abs((b.pos[1] + b.h / 2) - (o.pos[1] + o.h / 2)) >= (b.h + o.h) / 2 + S.query) continue;
          let dx = b.pos[0] - o.pos[0], dz = b.pos[2] - o.pos[2];
          if (Math.abs(dx) >= b.half[0] + o.half[0] + S.pad || Math.abs(dz) >= b.half[1] + o.half[1] + S.pad) continue;
          if (dx * dx + dz * dz < 1e-4) { dx = bi < oi ? -1 : 1; dz = 0; }
          const l = Math.hypot(dx, dz);
          px += dx / l; pz += dz / l;
        }
      }
    }
    if (px * px + pz * pz < 1e-4) return;
    const l = Math.hypot(px, pz), tx = (px / l) * S.speed, tz = (pz / l) * S.speed;
    const ex = tx - b.vel[0], ez = tz - b.vel[2], el = Math.hypot(ex, ez), step = S.ease * dt;
    if (el <= step) { b.vel[0] = tx; b.vel[2] = tz; } else { b.vel[0] += (ex / el) * step; b.vel[2] += (ez / el) * step; }
  });
}

/**
 * AUDIT PI1 I1: ConstrainItemMovement [IL_6290] - a body's item is moved out of the body to its scatter point by a box
 * cast at 0.98 of its half-extents, stopped 0.01 m short of the first face that faces the move and slid along it, three
 * times at most. The port casts the box's middle as a ray (`rayHit(from, dir, len)` -> `{ dist, normal }` or null), the
 * box's half-width its skin. Answers where the item stands. Pure over the probe.
 * @param {number[]} from @param {number[]} to @param {number} halfW @param {number} h
 * @param {((from: number[], dir: number[], len: number) => ({ dist: number, normal?: number[] }|null))|null} rayHit
 */
export const PI_CONSTRAIN = Object.freeze({ share: 0.98, skin: 0.01, slides: 3 });
export function constrainMove(from, to, halfW, h, rayHit) {
  const at = [...from];
  if (!rayHit) return [...to];
  let rem = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const skin = halfW * PI_CONSTRAIN.share;
  for (let k = 0; k < PI_CONSTRAIN.slides; k++) {
    const len = Math.hypot(rem[0], rem[1], rem[2]);
    if (!(len * len > 1e-6)) break;
    const dir = [rem[0] / len, rem[1] / len, rem[2] / len];
    const hit = rayHit([at[0], at[1] + h / 2, at[2]], dir, len + skin);
    const n = hit?.normal ?? null;
    const facing = hit && Number.isFinite(hit.dist) && (!n || n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2] < -0.001);
    if (!facing) { at[0] += rem[0]; at[1] += rem[1]; at[2] += rem[2]; break; }
    const go = Math.max(0, hit.dist - skin - PI_CONSTRAIN.skin);
    at[0] += dir[0] * go; at[1] += dir[1] * go; at[2] += dir[2] * go;
    if (!n) break;
    const left = [to[0] - at[0], to[1] - at[1], to[2] - at[2]];
    const d = left[0] * n[0] + left[1] * n[1] + left[2] * n[2];
    rem = [left[0] - d * n[0], left[1] - d * n[1], left[2] - d * n[2]];
  }
  return at;
}

// ---- the rarity dress ------------------------------------------------------------------------------------------------

/** PI1 (Mac: "the rarity treatment (like we do for the world boss)"): the world boss's loot line rises out of a
 *  Rare-or-better item's own picture (scenes/lootLines.js, WBX3's form), and a Magic-or-better picture wears its tier's
 *  rim - the port's own, the foes' tell outline (systems/hitFlash.js setBatchGlint) in the tier's colour - stronger up
 *  the ladder. The body's own playRareDrop chimed at the kill; its items do not chime again. The mod draws no rarity. */
export const PI_RIM = Object.freeze({ magic: 0.3, rare: 0.45, legendary: 0.6, aetheric: 0.7, artifact: 0.7, gilded: 0.8 });
/** The rim an item wears - `[r, g, b, strength]` - or null (Common, or the rarity row off). */
export function rarityRim(item) {
  if (!lootRarityOn()) return null;
  const tier = rarityOf(item);
  const k = PI_RIM[tier];
  if (!k) return null;
  const c = tierColour(tier);
  return [c[0], c[1], c[2], k];
}
/** AUDIT PI1 L4: WHAT AN ITEM LOOKS LIKE - a body's list replaced with equal items (the dungeon room's word, a save's
 *  restore) hands each standing picture to its look-alike rather than throwing the lot again. */
export const itemLook = (item) => (item && typeof item === 'object'
  ? [item.group, item.templateIndex, item.stackCount ?? 1, item.nativeMaterialValue ?? '', item.dyeColor ?? '', item.rarity ?? '', item.artifact ? 1 : 0, item.name ?? ''].join('|')
  : '');
/** RaycastPhysicalItem's reach [IL_5b54]: an item is pressed from 3 m. */
export const PI_REACH = 3;
export const isRareOrBetter = (item) => lootRarityOn() && (RARITIES[rarityOf(item)]?.rank ?? 0) >= RARITIES.rare.rank;

// ---- what the world holds as itself ----------------------------------------------------------------------------------

/** The items a layer is presenting as themselves right now: a body's or a pile's line of light (scenes/lootLines.js)
 *  leaves them to their own. A WeakSet, so nothing here keeps an item alive. */
const _presented = new WeakSet();
export const presentItem = (item, on) => { if (item && typeof item === 'object') { if (on) _presented.add(item); else _presented.delete(item); } };
export const isPresented = (item) => !!item && typeof item === 'object' && _presented.has(item);

/** The deaths the layers are told of (OnEnemyDeath - HandleEnemyDeath [IL_4790]): an entity and when, so a body's items
 *  are thrown out of it only at its fall, and a body met later (a load, a return) has them lie where they landed. */
const _deaths = new WeakMap();
export const PI_FRESH_MS = 4000;
export const markDeath = (entity, at = Date.now()) => { if (entity && typeof entity === 'object') _deaths.set(entity, at); };
export const diedRecently = (entity, at = Date.now()) => { const t = entity && typeof entity === 'object' ? _deaths.get(entity) : undefined; return t !== undefined && at - t <= PI_FRESH_MS; };

// ---- the shift-drop's refusals ---------------------------------------------------------------------------------------

/** LocalItemLeftClickPrefix [IL_0565]: ItemGroups.Transportation (23) - DFU's "cannotRemoveItem" (its one home,
 *  systems/createItem.js). */
export const shiftDropRefusal = (item) => (item?.group === 'Transportation' ? { text: CANNOT_REMOVE_ITEM_TEXT } : null);

/**
 * THE SHIFT-DROP, ONE LAW FOR BOTH PACKS (ui/nativeInventory.js, ui/enhancedInventory.js): QueueInventoryPhysicalDrop
 * [IL_34b8] moves the item through DFU's own TransferItem onto a fresh container - so the pack's ground guards hold
 * exactly as a Remove onto the ground holds them: the Transportation refusal above (in the mod's words - planStore's own
 * says nothing), a locked piece (LOCK1), a pack-only piece (WALLET1), a bound piece (SS3 - the ground is "elsewhere"),
 * a loaded Materials Bag (BAG1), the floor's own word (HOUSE-DROP, `dropRefusal`), the quest arm. Then the whole stack
 * moves (a drop onto the ground always fits; TransferItem's split asks only when it would not, or under Control) into
 * a fresh list that `drop(list)` lays in the world. Answers `{ refusal }`, `{ map: true }` (the caller's use arm reads
 * it, as a Remove's does - F156), or `{ moved, sound }`.
 * @param {any} item
 * @param {{ items: any[], entity: any, getQuest?: any, dropRefusal?: (() => (string|null))|null, drop: (list: any[]) => any }} o
 */
export function shiftDrop(item, { items, entity, getQuest = null, dropRefusal = null, drop }) {
  const name = () => itemLongName(item, { getQuest });
  const no = shiftDropRefusal(item);
  if (no) return { refusal: no };
  if (lockRefuses(item, 'drop')) return { refusal: { text: lockedText(name()) } };
  if (isPackOnly(item)) return { refusal: { text: packOnlyText(name()) } };
  if (boundRefusesPut(item, 'elsewhere')) return { refusal: { text: boundText(name()) } };
  const dest = [];
  const plan = /** @type {any} */ (planStore(item, { remote: dest, getQuest, groundRefusal: dropRefusal?.() ?? null, bagLoaded: !bagMayLeave(entity) }));   // its map arm is not in its declared shape
  if (!plan.ok) return { refusal: plan.refusal };
  if (plan.map) return { map: true };
  applyTransfer(item, plan, items, dest, { entity, fromLocal: true });   // F157: a lit torch leaving the pack goes out
  if (dest.length) drop(dest);
  return { moved: dest, sound: plan.sound };
}
