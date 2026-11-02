// ROAD-GAPS (2026-10-26, the owner: "Take care of exclusions and gaps"; bible/06-Systems/Travel-View.md ROAD-GAPS) - A
// REGION'S NETWORKS JOINED WHERE THEY MEET. A region's build left pieces of its own network that no bit joins to the rest,
// within a pixel or three of it (on the freeware's Hammerfell, laid fresh: 52 pairs of pieces within three pixels), and
// the Overworld's planner, walking the roads as roads, went round. Now the build links them (world/road/roadGaps.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { linkGaps, LINK_GAP } from '../../../src/world/road/roadGaps.js';
import { DIR } from '../../../src/world/road/roadNetwork.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const W = 40, H = 20;
const grid = () => ({ roads: new Uint8Array(W * H), tracks: new Uint8Array(W * H) });
/** A run along row y from x0 to x1 (inclusive) of `kind`. */
const row = (net, y, x0, x1, kind = 'roads') => { for (let x = x0; x <= x1; x++) net[kind][y * W + x] |= (x > x0 ? DIR.W : 0) | (x < x1 ? DIR.E : 0); };
const open = { blocked: () => false, owns: () => true };
/** Are (ax, ay) and (bx, by) joined by the bits? */
function joined(net, ax, ay, bx, by) {
  const seen = new Set([ay * W + ax]), q = [[ax, ay]];
  const step = [[DIR.N, 0, -1, DIR.S], [DIR.NE, 1, -1, DIR.SW], [DIR.E, 1, 0, DIR.W], [DIR.SE, 1, 1, DIR.NW], [DIR.S, 0, 1, DIR.N], [DIR.SW, -1, 1, DIR.NE], [DIR.W, -1, 0, DIR.E], [DIR.NW, -1, -1, DIR.SE]];
  while (q.length) {
    const [x, y] = q.pop();
    if (x === bx && y === by) return true;
    const b = net.roads[y * W + x] | net.tracks[y * W + x];
    for (const [bit, dx, dy, back] of step) {
      const nx = x + dx, ny = y + dy, j = ny * W + nx;
      if (!(b & bit) || seen.has(j) || !((net.roads[j] | net.tracks[j]) & back)) continue;
      seen.add(j); q.push([nx, ny]);
    }
  }
  return false;
}

test('ROAD-GAPS the gap: two pieces within LINK_GAP (3) are linked by the straight way between their nearest pixels - a road where both are roads, a track else; four apart, none; one piece, none (mutants: the gap, the kind, the piece\'s test)', () => {
  assert.equal(LINK_GAP, 3);
  let net = grid();
  row(net, 5, 2, 10); row(net, 5, 13, 20);   // two roads, two pixels of field between their ends
  assert.equal(linkGaps(net, W, H, open), 1);
  assert.ok(joined(net, 2, 5, 20, 5), 'one road now');
  assert.ok(net.roads[5 * W + 11] && net.roads[5 * W + 12], 'laid as a road');
  net = grid();
  row(net, 5, 2, 10); row(net, 5, 13, 20, 'tracks');
  linkGaps(net, W, H, open);
  assert.ok(net.tracks[5 * W + 11] && !net.roads[5 * W + 11], 'a road to a track: a track');
  net = grid();
  row(net, 5, 2, 10); row(net, 5, 15, 20);   // four of field
  assert.equal(linkGaps(net, W, H, open), 0, 'past the gap: none');
  net = grid();
  row(net, 5, 2, 20); row(net, 7, 2, 20);
  for (let y = 5; y <= 7; y++) net.roads[y * W + 2] |= (y > 5 ? DIR.N : 0) | (y < 7 ? DIR.S : 0);   // the two rows joined at their west end
  assert.equal(linkGaps(net, W, H, open), 0, 'one piece: never a link beside itself');
});

test('ROAD-GAPS the way: never over the water the build refuses or a pixel it routes round, never through another path; only from the region\'s own core (mutants: the blocked, the core, the path between)', () => {
  let net = grid();
  row(net, 5, 2, 10); row(net, 5, 13, 20);
  assert.equal(linkGaps(net, W, H, { blocked: (u, v) => u === 12 && v === 5, owns: () => true }), 0, 'a pixel routed round on the straight way: no link');
  assert.ok(!net.roads[5 * W + 12] && !net.roads[5 * W + 11], 'nothing laid');
  net = grid();
  row(net, 5, 2, 10); row(net, 5, 13, 20); net.tracks[5 * W + 12] = DIR.N;   // a third path's pixel on the way
  net.tracks[4 * W + 12] = DIR.S;
  assert.equal(linkGaps(net, W, H, open), 2, 'never through the third path\'s pixel: each road linked to it instead');
  assert.ok(joined(net, 2, 5, 20, 5) && joined(net, 2, 5, 12, 4), 'the three one');
  net = grid();
  row(net, 5, 2, 10); row(net, 5, 13, 20);
  assert.equal(linkGaps(net, W, H, { blocked: (u) => u === 11 || u === 12, owns: () => true }), 0, 'a river across every way: none');
  net = grid();
  row(net, 5, 2, 10); row(net, 5, 13, 20);
  assert.equal(linkGaps(net, W, H, { blocked: () => false, owns: (u) => u > 30 }), 0, 'neither end the core\'s: none');
  const src = read('src/world/tamrielRoads.js');
  assert.match(src, /const linked = linkGaps\(net, MAP_W, MAP_H, \{\n\s+blocked: \(u, v\) => \(water\[v \* MAP_W \+ u\] === 1 && land\.ford\[v \* MAP_W \+ u\] === 0\) \|\| routedRound\.has\(v \* MAP_W \+ u\),\n\s+owns: \(u, v\) => inCore\(region, u \+ gx, v \+ gy\),/);
});
