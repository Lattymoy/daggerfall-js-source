// WILD-FREE (2026-10-11, a player's load captured from the live client: 8.1 s of a 14.5 s frozen frame; bible/
// 11-Multiplayer/Wild-Zone.md section 12, THE COST) - THE DAY'S HALLS, ASKING `free` ONLY WHERE AN ANSWER IS READ.
// wildHallPicks asked the host's dearest question (world.js wildHallFree: the spawns' plateau, a heightmap kernel summed)
// of every pixel of every ring before it cut the band; it asks now where the picks read the answer, once a pixel. Every
// client must stand the same halls, so the old law is restated here whole and the two compared - over zones of several
// shapes, `free` tests from open ground to all but closed (which drives every widening: the band lowered, the two-pixel
// band, the whole ring), a centre closed (the deepest free level below the deepest), and many days.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWildMask, WILD_RINGS } from '../../../src/systems/wild/wildZone.js';
import { wildHallPicks, wildRingBorderDistance, WILD_DUNGEONS_PER_RING, WILD_HALL_SPACING, WILD_HALL_POOL_MAX } from '../../../src/systems/wild/wildDungeons.js';

/** The picks as they stood before WILD-FREE (wildDungeons.js), `free` asked of every ring pixel first. */
function picksAsTheyWere(mask, free, day) {
  if (!mask?.depth || !mask.maxDepth) return [];
  const ringOf = (i) => { const d = mask.depth?.[i] ?? 0; if (!d || !mask.maxDepth) return 0; return Math.max(1, Math.min(WILD_RINGS, Math.ceil((d / mask.maxDepth) * WILD_RINGS))); };
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const box = mask.box ?? { x0: 0, y0: 0, x1: mask.width - 1, y1: mask.height - 1 };
  const bd = wildRingBorderDistance(mask);
  const byRing = Array.from({ length: WILD_RINGS + 1 }, () => []);
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) { const i = y * mask.width + x, ring = ringOf(i); if (ring && free(x, y)) byRing[ring].push({ x, y, ring, bd: bd[i] }); }
  const halls = [];
  const far = (p, also) => { let m = Infinity; for (const q of halls) m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)); for (const q of also) m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)); return m; };
  for (let ring = 1; ring <= WILD_RINGS; ring++) {
    const want = WILD_DUNGEONS_PER_RING[ring - 1] ?? 0;
    const all = byRing[ring];
    if (!all.length || !want) continue;
    const maxBd = all.reduce((m, p) => Math.max(m, p.bd), 1);
    let floor = Math.max(1, Math.ceil(maxBd * 0.6));
    let pool = all.filter((p) => p.bd >= floor);
    while (pool.length < want * 3 && floor > 2) { floor -= 1; pool = all.filter((p) => p.bd >= floor); }
    if (pool.length < want) pool = all.filter((p) => p.bd >= 2).length >= want ? all.filter((p) => p.bd >= 2) : all;
    const rand = rng(Math.imul(day + 1, 0x9e3779b1) ^ Math.imul(ring, 0x85ebca6b));
    const picked = [];
    for (const [spacing, from] of [[WILD_HALL_SPACING, pool], [2, pool], [1, pool], [2, all], [1, all]]) {
      if (picked.length >= want) break;
      if (!picked.length) { const first = from.filter((p) => far(p, []) >= spacing); if (!first.length) continue; picked.push(first[Math.floor(rand() * first.length)]); }
      while (picked.length < want) {
        let best = [];
        for (const p of from) { if (picked.includes(p)) continue; const d = far(p, picked); if (d < spacing) continue; best.push({ p, score: d * (0.85 + 0.15 * Math.min(1, p.bd / maxBd)) }); }
        if (!best.length) break;
        best.sort((a, b) => b.score - a.score); best = best.slice(0, 3);
        picked.push(best[Math.floor(rand() * best.length)].p);
      }
    }
    for (const p of picked) halls.push({ x: p.x, y: p.y, ring, key: `${p.x},${p.y}` });
  }
  return halls;
}

const hash = (x, y, s) => { let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(s, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
/** Zones of three shapes, as buildWildMask cuts them (WW-C2: a cell a pixel). */
const ZONES = [
  ['an oval', (x, y) => { const dx = (x - 520) / 38, dy = (y - 110) / 24; return dx * dx + dy * dy + 0.15 * Math.sin(x / 5) < 1; }],
  ['a long ridge', (x, y) => Math.abs(y - 200 - 6 * Math.sin(x / 9)) < 7 && x > 300 && x < 420],
  ['a crescent', (x, y) => { const a = Math.hypot(x - 700, y - 300), b = Math.hypot(x - 712, y - 300); return a < 30 && b > 22; }],
].map(([name, inside]) => [name, buildWildMask({ width: 1000, height: 500, inZone: inside })]);
/** `free` tests from open to all but closed, a closed centre among them; each counts its asks. */
const FREES = [
  ['open ground', () => true],
  ['a scatter of places', (x, y) => hash(x, y, 1) > 0.3],
  ['mostly closed', (x, y) => hash(x, y, 2) > 0.8],
  ['all but closed', (x, y) => hash(x, y, 3) > 0.985],
  ['the centre closed', (x, y, mask, bd) => bd[y * mask.width + x] < 4],
  ['nothing free', () => false],
];

test('WILD-FREE the day\'s halls are the halls they were - every zone shape, every free test (open ground to nothing free, the centre closed), twelve days each (mutants: the deepest level read without free, the band unasked, the whole ring for the two-pixel band, the band in the whole ring\'s place)', () => {
  let compared = 0, halls = 0;
  for (const [zn, mask] of ZONES) {
    const bd = wildRingBorderDistance(mask);
    for (const [fn, f] of FREES) {
      const free = (x, y) => f(x, y, mask, bd);
      for (let day = 20360; day < 20372; day++) {
        // PIN MOVED (WW-C2, bible/03-World/World-Wide.md WW-C): the law with its thinning off (a province's pool, below) is
        // the law as it was - each hall now carries its cell beside its pixel (a cell a pixel here)
        const now = wildHallPicks(mask, free, day, { poolMax: Infinity }).map(({ cx, cy, ...h }) => (assert.deepEqual([cx, cy], [h.x, h.y]), h)), was = picksAsTheyWere(mask, free, day);
        assert.deepEqual(now, was, `${zn}, ${fn}, day ${day}`);
        compared++; halls += was.length;
      }
    }
  }
  assert.equal(compared, ZONES.length * FREES.length * 12);
  assert.ok(halls > 500, `halls were stood (${halls})`);
});

test('WILD-FREE free is asked once a pixel, and only where an answer is read - a band of the zone on open ground, the whole ring only where the band cannot hold the count (mutants: asked again, asked of every pixel first)', () => {
  const [, mask] = ZONES[0];
  const bd = wildRingBorderDistance(mask);
  let ringPixels = 0;
  const box = mask.box;
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) if (mask.depth[y * mask.width + x]) ringPixels++;
  const count = (f) => { const asked = new Map(); wildHallPicks(mask, (x, y) => { const k = `${x},${y}`; asked.set(k, (asked.get(k) ?? 0) + 1); return f(x, y, mask, bd); }, 20369); return asked; };
  const open = count(FREES[1][1]);
  assert.ok([...open.values()].every((n) => n === 1), 'never twice');
  assert.ok(open.size < ringPixels / 2, `a scatter of places: ${open.size} of ${ringPixels} asked`);
  const closed = count(FREES[3][1]);
  assert.ok([...closed.values()].every((n) => n === 1), 'never twice, the whole ring read');
  assert.ok(closed.size > open.size * 1.5, `all but closed: the widenings read more (${closed.size})`);
});

test('WW-C2 A PROVINCE\'S POOL: free is asked of the band, a level and the ring each thinned by the day to WILD_HALL_POOL_MAX - a tier of thousands of cells asks a few hundred; the count still the owner\'s, every hall on its tier, every client\'s the same (mutants: the band unthinned; the thinning not the day\'s)', () => {
  // a province-sized zone: an oval of thousands of cells a tier (Cyrodiil's tiers are tens of thousands of four-pixel cells)
  const big = buildWildMask({ width: 400, height: 260, inZone: (x, y) => { const dx = (x - 200) / 190, dy = (y - 130) / 120; return dx * dx + dy * dy < 1; } });
  const asked = new Set();
  const halls = wildHallPicks(big, (x, y) => { asked.add(`${x},${y}`); return hash(x, y, 9) > 0.2; }, 20400);
  assert.deepEqual([1, 2, 3, 4].map((r) => halls.filter((h) => h.ring === r).length), [...WILD_DUNGEONS_PER_RING], 'every tier its count');
  assert.ok(asked.size <= WILD_RINGS * WILD_HALL_POOL_MAX * 3, `a few hundred asks a tier (${asked.size})`);
  let cells = 0;
  for (let i = 0; i < big.width * big.height; i++) cells += big.inside[i];
  assert.ok(asked.size < cells / 20, `never the zone's cells (${asked.size} of ${cells})`);
  assert.deepEqual(wildHallPicks(big, (x, y) => hash(x, y, 9) > 0.2, 20400), halls, 'the same halls for every asker');
  assert.notDeepEqual(wildHallPicks(big, (x, y) => hash(x, y, 9) > 0.2, 20401), halls, 'a new day, new halls');
});

