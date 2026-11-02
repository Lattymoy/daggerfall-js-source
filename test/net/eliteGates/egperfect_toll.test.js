// EG-PERFECT (2026-10-18, Mac: "I want to ensure the boss attacks, the design of the halls, and everything is absolutely
// perfect. Traversing between sections should present a challenge, platforming should be detailed"; bible/11-Multiplayer/
// Elite-Gates.md section 10.6, THE PULL'S TOLL): THE TOLL'S NEW GROUND KEYED BY ITS HERO. The toll is waived for a member who
// reached new ground in its last 15 s (net/eliteGates/egBrain.js egTollOf - the fair trail's `fnew`, net/eliteGates/egFair.js groundAt's
// keys). A hero's floor was keyed by its index within its own hero, `h<i>` - and LAW 9 lays a hero a room, so floor 0 of every
// room after the first had been "seen" already: the member who ran on into the next room was tolled as if idle. From spec law 9
// the key is `h<hero>:<floor>`; laws 4-8 keep `h<i>`. Fixtures from the producers: the law's own halls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egSpecForget, EG_TOLL_WAIVE_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egFairNew, egFairPose, egSupportAt, EG_HOLD } from '../../../src/net/eliteGates/egFair.js';
import { egTollOf } from '../../../src/net/eliteGates/egBrain.js';
import { egPolyIn } from '../../../src/net/eliteGates/egShape.js';

/** Points on hero `q`'s floor `i` (its law's polygon, at its height) that no plate, island or court of the spec holds - the
 *  support law reads the hero's floors there - nearest its first corner first. */
function* floorPoints(spec, q, i = 0) {
  const f = q.floors[i], xs = f.poly.map((p) => p[0]), zs = f.poly.map((p) => p[1]);
  for (let x = Math.min(...xs) + 0.6; x < Math.max(...xs); x += 0.5) for (let z = Math.min(...zs) + 0.6; z < Math.max(...zs); z += 0.5) {
    if (!egPolyIn(f.poly, x, z) || spec.discs.some((d) => Math.hypot(x - d.x, z - d.z) <= d.r + 0.5)) continue;
    if (egSupportAt(spec, x, f.y, z, 100, false, 0) === EG_HOLD.island) yield [x, f.y, z];
  }
}

test('EG-PERFECT THE TOLL\'S NEW GROUND IS EACH ROOM\'S OWN (section 10.6; spec law 9): seed 1 hall 2 lays two rooms, a Tower and a Stair Hall - a member who stands on the Tower\'s floor and then, five minutes on, on the Stair Hall\'s floor has reached new ground there (`h0:0`, then `h1:0`), so a pull a second later tolls it nothing, and one past the waiver tolls the road still ahead of it - where floor 0 of the second room had been floor 0 of the first, "seen" (mutant: the key by the floor alone)', () => {
  egSpecForget();
  const spec = egHallOf(1, 2, 0, 9);   // PIN MOVED (EG-PERFECT, spec law 10 - 2026-10-18): law 9's rooms, named (law 10 lays seed 1's anew)
  assert.equal(spec.law, 9);
  const rooms = spec.heroes.map((q, k) => ({ q, k })).filter(({ q }) => q.room);
  assert.deepEqual(rooms.map(({ q }) => q.id), ['room:tower', 'room:stair']);
  const A = egFairNew(2, 0);
  let t = 1_000_000;
  egFairPose(A, spec, { x: spec.arrive.x, y: spec.arrive.y ?? 0, z: spec.arrive.z }, t);
  const want = [];
  for (const { q, k } of rooms) {
    const p = floorPoints(spec, q).next().value;
    assert.ok(p, `${q.id}: a point of its floor 0`);
    t += 300_000;
    egFairPose(A, spec, { x: p[0], y: p[1], z: p[2] }, t);
    want.push(`h${k}:0`);
    assert.deepEqual(A.seen, want, `${q.id}: its floor new ground of its own`);
    assert.equal(A.fnew, t, `${q.id}: new at this pose`);
  }
  assert.equal(egTollOf(spec, {}, A, 2, t + 1000), 0, 'pulled a second after reaching the Stair Hall: no toll');
  assert.ok(egTollOf(spec, {}, A, 2, t + EG_TOLL_WAIVE_MS + 1000) > 0, 'past the waiver: the road still ahead is tolled');
  egSpecForget();
});

test('EG-PERFECT THE TOLL\'S KEYS UNDER THE LAWS BEFORE (section 10.6; spec laws 4-8 byte for byte): a hero fragment\'s floor stood on in a law 8 hall is new ground keyed `h<i>`, as it always was (mutant: law 8 keyed by its hero)', () => {
  egSpecForget();
  let found = null;
  for (let seed = 1; seed <= 40 && !found; seed++) for (let h = 1; h <= 100 && !found; h++) {
    const spec = egHallOf(seed, h, 0, 8);
    for (const q of spec.heroes ?? []) for (const p of floorPoints(spec, q)) {
      const A = egFairNew(h, 0);
      egFairPose(A, spec, { x: spec.arrive.x, y: spec.arrive.y ?? 0, z: spec.arrive.z }, 1000);   // a blind stretch on: the speed law judges none
      egFairPose(A, spec, { x: p[0], y: p[1], z: p[2] }, 600_000);
      const g = A.seen[A.seen.length - 1];
      if (g && g.startsWith('h')) { found = { seed, h, g }; break; }
    }
  }
  assert.ok(found, 'a law 8 hall with a hero floor stood on');
  assert.match(found.g, /^h\d+$/, `seed ${found.seed} hall ${found.h}: keyed ${found.g}`);
  egSpecForget();
});
