// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PVPDUNGEONS - THE ZONE'S OWN HALLS (the owner's tier rules, 2026-10-07/08).
//
// "Tier 1 has 10 dungeons evenly split in the tier 1 zone so you can reach a dungeon doesnt matter from where you approach
// the zone - Tier 2 8, tier 3 6, tier 4 4. All dungeons that are set are elite dungeons. Those dungeons positions change
// every 24h realtime hours and are shown on the map and zone map." / "as centered as possible not on the border to the
// other tier... dont override towns or other POIS." / "Cemeteries cannot be zone dungeons!"
//
// THE HALLS ARE SPAWNED, not chosen from the region's own dungeons: every one of the zone's real dungeons is sealed, and
// a hall is a clone of a real dungeon (world/spawnedDungeons.js synthesizeDungeonLocation, on its own salt lane -
// wire.js WDUN_SALT) standing on an EMPTY pixel - never a town's, never any place's, never beside one - so a tier always
// has its full count wherever its places are.
//
// WHERE: a ring is a band of the mask's depth (wildZone.js wildRingAt: ceil(depth / maxDepth * 4)), so a pixel's
// distance from its ring's MIDDLE depth is its distance from both of the ring's borders at once. Only the most-centred
// pixels of each ring are candidates; among them the halls are spread by a farthest-point walk (each next hall the
// candidate farthest from those already stood, one of the best few by the day's own roll), so the ring is covered all
// the way round and a player coming in from any side has one near.
//
// WHEN: by the DAY - the relay's (wire.js `wdun` `st.day`), never a client's clock, so every player sees the same halls.
// Pure: the mask, a pixel test and a day in; the halls out. The same on every client.
// ═══════════════════════════════════════════════════════════════════
import { WILD_RINGS, maskWorld, ringOfDepth } from './wildZone.js';
import { WATER_SPECIES } from '../../characters/dungeonEnemies.js'; // SLAUGHTER-BOX: RDBLayout's water species, one home
import { isClassEnemyId } from '../../characters/enemy/enemyBasics.js'; // DEX1: DFU's class test (DaggerfallEntity.IsClassEnemyId) - a mod's monster past 255 is no class

export const WILD_DUNGEONS_PER_RING = Object.freeze([10, 8, 6, 4]);
/** A hall keeps at least this many of the mask's cells from every other hall (they never crowd one valley). */
export const WILD_HALL_SPACING = 3;
/** WW-C2: the most cells of a band, a level or a ring `free` is asked of - the band thinned evenly to this many, by the
 *  day, so a province's tier (Cyrodiil's tens of thousands of cells) asks the host's dearest question a few hundred
 *  times, never all of them (WILD-FREE's law, at a province's size). */
export const WILD_HALL_POOL_MAX = 240;

/** A small seeded stream (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A cell's ring by its index, from the mask's depth (0 outside) - wildZone.js's own law (ringOfDepth). */
const ringOf = (mask, i) => ringOfDepth(mask, mask.depth?.[i] ?? 0);
/**
 * Each zone cell's distance, in cells, to the nearest cell of ANOTHER ring (or outside the zone) - a breadth-first walk
 * out from every cell that touches one. A hall stands where this is largest: the middle of its tier, off both borders.
 */
export function wildRingBorderDistance(mask) {
  const box = mask.box ?? { x0: 0, y0: 0, x1: mask.width - 1, y1: mask.height - 1 };
  const W = mask.width,
    dist = new Int16Array(mask.width * mask.height).fill(-1),
    queue = [];
  const N4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const i = y * W + x,
        r = ringOf(mask, i);
      if (!r) continue;
      for (const [dx, dy] of N4) {
        const nx = x + dx,
          ny = y + dy;
        const nr = nx >= 0 && ny >= 0 && nx < W && ny < mask.height ? ringOf(mask, ny * W + nx) : 0;
        if (nr !== r) {
          dist[i] = 1;
          queue.push(i);
          break;
        }
      }
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q],
      x = i % W,
      y = (i - x) / W,
      r = ringOf(mask, i);
    for (const [dx, dy] of N4) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= mask.height) continue;
      const j = ny * W + nx;
      if (dist[j] !== -1 || ringOf(mask, j) !== r) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  return dist;
}

const _bd = new WeakMap();
const borderDist = (mask) => {
  let d = _bd.get(mask);
  if (!d) _bd.set(mask, (d = wildRingBorderDistance(mask)));
  return d;
};

/** WW-C2: `list` thinned evenly to at most `max` of its entries, from an offset the day's `rand` draws - in its order. */
function thin(list, max, rand) {
  if (list.length <= max) return list;
  const step = list.length / max,
    off = rand() * step;
  return Array.from({ length: max }, (_, k) => list[Math.min(list.length - 1, Math.floor(off + k * step))]);
}

/**
 * THE DAY'S HALLS. `free(x, y)` says a world map pixel may hold one (land, dry, no place on it or beside it - the host's
 * map files answer); `day` the relay's day. Returns `[{ x, y, ring, key }]` - each hall on the middle pixel of its cell
 * (WW-C2: the mask's grid laid on the world, wildZone.js maskWorld) - the outer tier's first.
 *
 * WILD-FREE (2026-10-11, a player's load captured from the live client: 8.1 s of a 14.5 s frozen frame): `free` is the
 * host's dearest question (world.js wildHallFree - the spawns' plateau, a whole heightmap kernel summed for a pixel), and
 * it was asked of every pixel of every ring before the band was cut. It is asked where an answer is read, once a cell:
 * the deepest free level, the band and its widenings, the whole ring only when the band cannot hold the count - and
 * (WW-C2) of each of those thinned evenly by the day to WILD_HALL_POOL_MAX, a province's tier being tens of thousands of
 * cells. Every client's halls are the same: the thinning is the day's, the order the scan's.
 * @param {{ width:number, height:number, depth:ArrayLike<number>, maxDepth:number, box?:{x0:number,y0:number,x1:number,y1:number}, ox?:number, oy?:number, cell?:number }} mask
 * @param {(x:number, y:number) => boolean} free
 * @param {number} day
 * @param {{ poolMax?: number }} [o] the thinning's bound (Infinity: none - the law as it stood before WW-C2, the pins')
 */
export function wildHallPicks(mask, free, day, { poolMax = WILD_HALL_POOL_MAX } = {}) {
  if (!mask?.depth || !mask.maxDepth) return [];
  const box = mask.box ?? { x0: 0, y0: 0, x1: mask.width - 1, y1: mask.height - 1 };
  const bd = borderDist(mask);
  /** a cell's middle pixel on the world */
  const pixelOf = (cx, cy) => maskWorld(mask, cx + 0.5, cy + 0.5).map(Math.floor);
  // every ring's cells in the scan's order, `free` not yet asked - it is asked of a cell once, where the picks read it
  const byRing = Array.from({ length: WILD_RINGS + 1 }, () => []);
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const i = y * mask.width + x;
      const ring = ringOf(mask, i);
      if (ring) byRing[ring].push({ x, y, ring, bd: bd[i], free: /** @type {boolean|undefined} */ (undefined) });
    }
  }
  const isFree = (p) => {
    const [x, y] = pixelOf(p.x, p.y);
    return (p.free ??= !!free(x, y));
  };
  const halls = [];
  const far = (p, also) => {
    let m = Infinity;
    for (const q of halls) m = Math.min(m, Math.hypot(p.x - q.cx, p.y - q.cy));
    for (const q of also) m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y));
    return m;
  };
  for (let ring = 1; ring <= WILD_RINGS; ring++) {
    const want = WILD_DUNGEONS_PER_RING[ring - 1] ?? 0;
    const ring_ = byRing[ring];
    if (!want) continue;
    const rand = rng(Math.imul(day + 1, 0x9e3779b1) ^ Math.imul(ring, 0x85ebca6b));
    const sift = rng(Math.imul(day + 7, 0x7feb352d) ^ Math.imul(ring, 0x846ca68b)); // WW-C2: the day's thinning, its own stream
    // the ring's free cells at `min` and deeper, in the scan's order - the band thinned to the pool's most
    const freeFrom = (min) =>
      thin(
        ring_.filter((p) => p.bd >= min),
        poolMax,
        sift,
      ).filter(isFree);
    let _all = null;
    const all = () => (_all ??= thin(ring_, poolMax, sift).filter(isFree));
    // the deepest a free cell stands: asked a level at a time from the deepest down (each level thinned); none, an empty ring
    let deepest = -Infinity;
    for (const lv of [...new Set(ring_.map((p) => p.bd))].sort((a, b) => b - a))
      if (
        thin(
          ring_.filter((p) => p.bd === lv),
          poolMax,
          sift,
        ).some(isFree)
      ) {
        deepest = lv;
        break;
      }
    if (deepest === -Infinity) continue;
    // AS CENTRED AS THE RING ALLOWS: the deepest band of the ring that still holds room for its halls all the way round
    // (at least three candidates a hall), never a cell touching another tier when the ring has any other
    const maxBd = Math.max(1, deepest);
    let floor = Math.max(1, Math.ceil(maxBd * 0.6));
    let pool = freeFrom(floor);
    while (pool.length < want * 3 && floor > 2) {
      floor -= 1;
      pool = freeFrom(floor);
    }
    if (pool.length < want) {
      const two = freeFrom(2);
      pool = two.length >= want ? two : all();
    }
    const picked = [];
    // THE COUNT IS THE OWNER'S: the spacing is kept while the band allows it, then eased (two cells, then any free one),
    // then the band widened to the whole ring - never fewer halls than the tier is owed while it has free ground
    for (const [spacing, fromOf] of /** @type {Array<[number, () => any[]]>} */ ([
      [WILD_HALL_SPACING, () => pool],
      [2, () => pool],
      [1, () => pool],
      [2, all],
      [1, all],
    ])) {
      if (picked.length >= want) break;
      const from = fromOf(); // WILD-FREE: the whole ring's free cells asked only when the band could not hold the count
      if (!picked.length) {
        const first = from.filter((p) => far(p, []) >= spacing);
        if (!first.length) continue;
        picked.push(first[Math.floor(rand() * first.length)]); // the first: anywhere in the band, by the day
      }
      while (picked.length < want) {
        let best = [];
        for (const p of from) {
          if (picked.includes(p)) continue;
          const d = far(p, picked);
          if (d < spacing) continue;
          // farther from the halls already stood is better; deeper in the tier breaks a near tie
          best.push({ p, score: d * (0.85 + 0.15 * Math.min(1, p.bd / maxBd)) });
        }
        if (!best.length) break;
        best.sort((a, b) => b.score - a.score);
        best = best.slice(0, 3);
        picked.push(best[Math.floor(rand() * best.length)].p);
      }
    }
    for (const p of picked) {
      const [x, y] = pixelOf(p.x, p.y);
      halls.push({ x, y, ring, key: `${x},${y}`, cx: p.x, cy: p.y });
    }
  }
  return halls;
}

/** Is a hall of the day's at map pixel (x, y)? */
export const wildHallAt = (halls, x, y) => halls?.find((h) => h.x === x && h.y === y) ?? null;

/** A template a hall may clone: never a graveyard (LocationTypes 12 - "Cemeteries cannot be zone dungeons!"), nor a
 *  cemetery's own dungeon type (18). */
export const wildHallTemplateOk = (loc) =>
  loc?.mapTableData?.locationType !== 12 &&
  loc?.mapTableData?.dungeonType !== 18 &&
  !/cemetery|graveyard/i.test(String(loc?.name ?? ''));

// ── THE HALLS' FOES (the owner: "THE DUNGEONS IN THE ZONE HAVE TO HAVE ONLY HIGH TIER ENEMIES! NO RATS/BATS OR OTHER LOWTIER
// ENEMIES!") ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A hall's layout draws its foes from its template's own tables (characters/dungeonEnemies.js), which are rats and bats as
// often as not. Every monster of the low tiers is swapped for one of its ring's high tier - a pure pick by the hall's id
// and the foe's index, so every client builds the same hall. A water marker keeps a water foe (the Dreugh, the Lamia). The
// human classes (Mage .. Knight, 128+) are kept: they are drawn at the player's own level, never a low tier.
/** The monsters a hall may hold, by ring (the deeper, the worse); `water` for a water marker. */
export const WILD_HALL_FOES = Object.freeze({
  1: Object.freeze([9, 14, 19, 22, 24, 35, 36, 37, 38]), // Werewolf, Wereboar, Mummy, Gargoyle, Orc Warlord, the four Atronachs
  2: Object.freeze([9, 14, 19, 22, 23, 24, 25, 26, 27, 28, 36]), // + Wraith, Frost/Fire Daedra, Daedroth, Vampire
  3: Object.freeze([22, 23, 25, 26, 27, 28, 29, 30, 32]), // + Daedra Seducer, Vampire Ancient, Lich
  4: Object.freeze([25, 26, 27, 29, 30, 31, 32, 33]), // the heart: Daedra Lord, Ancient Lich among the Daedra and the undying
  water: Object.freeze([41, 42]), // Dreugh, Lamia
});
const HIGH = new Set(Object.values(WILD_HALL_FOES).flat());
/** Is this monster one of the high tiers a hall keeps as it is? (A human class always.) */
export const wildHallKeeps = (mobileType) => isClassEnemyId(mobileType) || HIGH.has(mobileType);
const mix = (a, b) => {
  let h = (a ^ Math.imul(b + 0x7f4a7c15, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
/**
 * A hall's foes with every low tier swapped for its ring's high tier: `enemies` the layout's records (each `{ mobileType }`),
 * `ring` the hall's tier, `seed` its id. Returns a new list (the records copied, a swapped one with `wildSwapped` set).
 */
export function wildHallFoes(enemies, ring, seed) {
  const pool = WILD_HALL_FOES[Math.max(1, Math.min(WILD_RINGS, ring | 0 || 1))];
  return (enemies ?? []).map((e, i) => {
    if (!e || wildHallKeeps(e.mobileType)) return e;
    const list = WATER_SPECIES.has(e.mobileType) ? WILD_HALL_FOES.water : pool;
    return { ...e, mobileType: list[mix(seed >>> 0, i) % list.length], gender: 'unspecified', wildSwapped: true };
  });
}
