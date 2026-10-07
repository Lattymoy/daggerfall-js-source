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
// - THE SCATTER AND THE THROW (RandomScatterOffset [IL_51d8], CreateCorpseProxy [IL_4f2e]): a body's items land 0.45 to
//   0.85 m round it, thrown out and up at the death, scaled by Impulse Strength.
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
  const impulse = finite(pct) ? clamp(pct, 0, PI_IMPULSE_MAX_PCT) / 100 : PI_IMPULSE_DEFAULT;
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
/** The picture cut to that box (RGBA, the same row order). Pure. */
export function cropTo(colors, width, box) {
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const s = ((box.y + y) * width + box.x) * 4;
    out.set(Array.prototype.slice.call(colors, s, s + box.w * 4), y * box.w * 4);
  }
  return out;
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
export const spiralPoint = (centre, i) => {
  const r = i ? PI_SPIRAL.ring * Math.sqrt(i) : 0, a = i * PI_SPIRAL.golden;
  return [centre[0] + Math.cos(a) * r, centre[1], centre[2] + Math.sin(a) * r];
};
/**
 * The spiral's next free point [IL_4028]: from index `next.i` on, the first point the floor takes (`floorAt(p)` answers
 * its height or null), whose way from `anchor` is clear (`clear(anchor, p)`), and that no placed drop overlaps
 * (OverlapsPlacedDrop [IL_4338]: nearer than the two radii and 0.1 m) - its foot on that floor. Past 256 tries, the
 * anchor itself. `next.i` advances past every point tried. Pure over its two probes.
 * @param {number[]} anchor @param {number[]} centre @param {number} radius
 * @param {{ i: number }} next @param {Array<{ pos: number[], r: number }>} placed
 * @param {(p: number[]) => (number|null)} floorAt @param {(a: number[], b: number[]) => boolean} [clear]
 */
export function spiralDrop(anchor, centre, radius, next, placed, floorAt, clear = () => true) {
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
/** FixedUpdate's shoulder [IL_1e94]: a body slower than 0.65 m/s across and 0.5 m/s up or down eases toward 0.45 m/s away
 *  from every neighbour its box (grown 0.04 m) overlaps, at 1.5 m/s a second. */
export const PI_SEPARATION = Object.freeze({ maxAcross: 0.65, maxUpDown: 0.5, pad: 0.04, speed: 0.45, ease: 1.5 });

/** A body: its foot, its velocity, its box's half-extents across (x, z), whether it has settled. */
export function makeBody(pos, vel = [0, 0, 0], half = [0.2, 0.2]) {
  return { pos: [...pos], vel: [...vel], half: [...half], settled: false, quietFor: 0, t: 0, acc: 0, grounded: false };
}
/** Settle a body where it stands (StartSettled [IL_1cf8]). */
export function settleBody(b) { b.vel[0] = 0; b.vel[1] = 0; b.vel[2] = 0; b.settled = true; b.quietFor = 0; }

/**
 * One fixed step. `ground(x, y, z)` answers the floor's height under a point within reach below it (or null), `wall(from,
 * dir, len)` the first wall's distance along a level move (or null). Answers 'fly', 'bounce' or 'rest'. Pure over the
 * two probes.
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
  // up and down: the floor under the foot
  const floor = ground(b.pos[0], b.pos[1] + Math.max(0, b.vel[1] * dt) + 0.5, b.pos[2]);
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
  const sq = b.vel[0] * b.vel[0] + b.vel[1] * b.vel[1] + b.vel[2] * b.vel[2];
  if (near && sq <= B.settleSq) {
    b.quietFor += dt;
    if (b.quietFor >= B.settleS) { settleBody(b); return 'rest'; }
  } else b.quietFor = 0;
  if (b.t >= B.flightMaxS) { settleBody(b); return 'rest'; }   // the port's floor: a body that never found ground stands
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
/** FixedUpdate's shoulder [IL_1e94] over a set of bodies, one fixed step's worth of `dt`: each unsettled slow body eases
 *  away from the boxes it overlaps (two at one spot part right and left by their order). Pure. */
export function shoulder(bodies, dt) {
  const S = PI_SEPARATION;
  for (const b of bodies) {
    if (b.settled) continue;
    if (Math.hypot(b.vel[0], b.vel[2]) > S.maxAcross || Math.abs(b.vel[1]) > S.maxUpDown) continue;
    let px = 0, pz = 0;
    for (const o of bodies) {
      if (o === b) continue;
      let dx = b.pos[0] - o.pos[0], dz = b.pos[2] - o.pos[2];
      if (Math.abs(dx) >= b.half[0] + o.half[0] + S.pad || Math.abs(dz) >= b.half[1] + o.half[1] + S.pad) continue;
      if (dx * dx + dz * dz < 1e-4) { dx = bodies.indexOf(b) < bodies.indexOf(o) ? 1 : -1; dz = 0; }
      const l = Math.hypot(dx, dz);
      px += dx / l; pz += dz / l;
    }
    if (px * px + pz * pz < 1e-4) continue;
    const l = Math.hypot(px, pz), tx = (px / l) * S.speed, tz = (pz / l) * S.speed;
    const ex = tx - b.vel[0], ez = tz - b.vel[2], el = Math.hypot(ex, ez), step = S.ease * dt;
    if (el <= step) { b.vel[0] = tx; b.vel[2] = tz; } else { b.vel[0] += (ex / el) * step; b.vel[2] += (ez / el) * step; }
    b.quietFor = 0;
  }
}

// ---- the rarity dress ------------------------------------------------------------------------------------------------

/** PI1 (Mac: "the rarity treatment (like we do for the world boss)"): a Magic-or-better item's picture wears its tier's
 *  rim (systems/hitFlash.js setBatchGlint - the outline's own texel test), stronger up the ladder; the world boss's loot
 *  line rises out of a Rare-or-better one (scenes/lootLines.js), and it chimes as it lands (corpseMarker.js
 *  playRareDrop). The port's own: the mod draws no rarity. */
export const PI_RIM = Object.freeze({ magic: 0.3, rare: 0.45, legendary: 0.6, aetheric: 0.7, artifact: 0.7 });
/** The rim an item wears - `[r, g, b, strength]` - or null (Common, or the rarity row off). */
export function rarityRim(item) {
  if (!lootRarityOn()) return null;
  const tier = rarityOf(item);
  const k = PI_RIM[tier];
  if (!k) return null;
  const c = tierColour(tier);
  return [c[0], c[1], c[2], k];
}
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
