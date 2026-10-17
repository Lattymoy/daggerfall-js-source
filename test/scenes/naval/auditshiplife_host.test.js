// AUDIT SHIP-LIFE (2026-09-30, the pre-merge audit of PR #478) - the naval host's lens: the harbours and their moored
// ships online and across the sea's comings and goings (scenes/naval/navalHost.js harbourFrame). The real hosts, alone
// (test/navalSea.mjs) and two in a room (test/navalRoom.mjs).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from '../../navalSea.mjs';
import { room } from '../../navalRoom.mjs';
import { OWNER_SWEEP_S, HARBOUR_RETRY_S, HARBOUR_LEAVE, SHIP_FADE_S } from '../../../src/scenes/naval/navalHost.js';

const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const PORT = { key: 'port:1', rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 } };
const all = (h) => [...h.host._sea.values()];
const moored = (h) => all(h).filter((e) => e.ship.errand?.kind === 'moored');

test('AUDIT SHIP-LIFE B1: ANOTHER PLAYER\'S MOORED SHIPS ARE NOT THE SEA\'S TRAFFIC - a lower id ashore stands the port\'s ships, and the player sailing out still meets the traffic she would alone; before, their moored ships filled her density and she met none (mutants: another\'s berthed unread)', async () => {
  const run = async (withA) => {
    const specs = [{ id: 'b', hull: 2, water: coast, settings: { ShipsAtSea: 'few' } }];
    if (withA) specs.unshift({ id: 'a', hull: null, water: coast, settings: { ShipsAtSea: 'few' } });
    const r = await room(specs);
    const B = r.get('b');
    B.s.view.feet = [0, 0, -150]; B.s.boat.GameObject.position = [0, 0, -150]; B.s.deps.harbourNear = () => PORT;
    if (withA) { const A = r.get('a'); A.s.view.feet = [0, 0, 300]; A.s.deps.harbourNear = () => PORT; }
    r.run(90, 0.1);   // inside the least dwell: every harbour ship still at her berth
    return { launched: B.s.host.directorState.count, theirs: all(B.s).filter((e) => e.owner).length };
  };
  const alone = await run(false), shared = await run(true);
  assert.ok(alone.launched > 0, 'alone, the sea\'s traffic');
  assert.ok(shared.theirs > 0, 'a\'s moored ships in b\'s sea');
  assert.ok(shared.launched >= alone.launched, `b launches no fewer than she would alone (${shared.launched} of ${alone.launched})`);
});

test('AUDIT SHIP-LIFE B2: A HARBOUR\'S MOORED SHIPS ARE THE HARBOUR\'S TO DROP - sailed 2 km off (past the director\'s despawn, inside HARBOUR_LEAVE) and back, they lie at their berths still; past HARBOUR_LEAVE they go and come again; before, the director dropped them and the harbour never stood them again (mutants: the moored ship unengaged)', async () => {
  const w = await sea({ hull: 2, water: coast, settings: { ShipsAtSea: 'off' } });
  w.deps.harbourNear = () => PORT;
  const at = (p) => { w.view.feet = p; w.boat.GameObject.position = p; };
  at([0, 0, -150]); w.run(1);
  const n = moored(w).length;
  assert.ok(n > 0);
  at([0, 0, -2150]); w.run(1);
  at([0, 0, -150]); w.run(2);
  assert.equal(moored(w).length, n, 'there still');
  at([0, 0, -150 - HARBOUR_LEAVE - 600]); w.run(1 + SHIP_FADE_S);   // SHIP-FADE (2026-10-02) PIN MOVED: they fade as they go
  assert.equal(moored(w).length, 0, 'gone past HARBOUR_LEAVE');
  at([0, 0, -150]); w.run(1);
  assert.equal(moored(w).length, n, 'and stood again');
});

test('AUDIT SHIP-LIFE B3: A PORT\'S SHIPS ARE THE PORT\'S, WHATEVER THE PLAYER\'S LEVEL - the same seeds, classes and berths at level 1 and 20; two players of those levels in one port see one ship a berth; before, the level drew another fleet and a stander\'s change put two hulls in one berth (mutants: the player\'s level, the seed deduped by class)', async () => {
  const fleet = async (level) => { const h = await sea({ hull: null, water: coast, level }); h.view.feet = [0, 0, 300]; h.deps.harbourNear = () => PORT; h.run(1); return all(h).map((e) => `${e.ship.seed}:${e.ship.cls.id}:${e.ship.errand?.berth}`).sort().join('|'); };
  assert.equal(await fleet(1), await fleet(20));
  const r = await room([{ id: 'a', hull: null, water: coast, level: 1 }, { id: 'b', hull: null, water: coast, level: 20 }]);
  const A = r.get('a'), B = r.get('b');
  for (const c of [A, B]) { c.s.view.feet = [0, 0, 300]; c.s.deps.harbourNear = () => PORT; }
  r.run(3);
  A.s.view.feet = [0, 0, 1900];   // a inland, still inside HARBOUR_LEAVE - b stands the harbour now
  r.run(3);
  const byBerth = new Map();
  for (const e of all(B.s)) { const k = e.ship.pos.map((v) => Math.round(v)).join(','); byBerth.set(k, (byBerth.get(k) ?? 0) + 1); }
  assert.ok([...byBerth.values()].every((c) => c === 1), `one ship a berth: ${JSON.stringify([...byBerth])}`);
});

test('AUDIT SHIP-LIFE B4 / B5: THE PORT\'S ROLLER IS ELECTED NEAR ITS MOUTH, AND AN HEIR KEEPS ITS SHIPS AS THE HARBOUR\'S - a lower id out of the port\'s reach no longer bars the one in it; a moored ship taken over is dropped past HARBOUR_LEAVE as its roller\'s was (mutants: the election near me, the heir\'s ship unmarked)', async () => {
  const r = await room([{ id: 'a', hull: null, water: coast }, { id: 'b', hull: null, water: coast }]);
  const A = r.get('a'), B = r.get('b');
  A.s.view.feet = [0, 0, 1400]; B.s.view.feet = [0, 0, 300];
  for (const c of [A, B]) c.s.deps.harbourNear = () => PORT;
  r.run(10);
  assert.ok(moored(B.s).length > 0, 'b, in the port, stood its ships');
  const q = await room([{ id: 'a', hull: null, water: coast }, { id: 'b', hull: null, water: coast }]);
  const QA = q.get('a'), QB = q.get('b');
  for (const c of [QA, QB]) { c.s.view.feet = [0, 0, 300]; c.s.deps.harbourNear = () => PORT; }
  q.run(3);
  // two at the mouth at once, before either's word reaches the other: the lower id rolls, the other none
  const z = await room([{ id: 'a', hull: null, water: coast }, { id: 'b', hull: null, water: coast }], { latency: 5 });
  for (const c of [z.get('a'), z.get('b')]) { c.s.view.feet = [0, 0, 300]; c.s.deps.harbourNear = () => PORT; }
  z.run(1);
  assert.ok(all(z.get('a').s).some((e) => !e.owner), 'a, the lower id at the mouth, rolled');
  assert.equal(all(z.get('b').s).filter((e) => !e.owner).length, 0, 'b beside it rolled none of its own');
  QA.present = false;
  q.run(OWNER_SWEEP_S + 1);
  const mine = () => all(QB.s).filter((e) => !e.owner);
  assert.ok(mine().length > 0 && mine().every((e) => e.fromHarbour === PORT.key), 'taken over, the harbour\'s');
  QB.s.view.feet = [0, 0, 300 + HARBOUR_LEAVE + 800];
  q.run(5);
  assert.equal(mine().length, 0, 'dropped past HARBOUR_LEAVE');
});

test('AUDIT SHIP-LIFE B6 / B7: A SHIP THAT SAILED TODAY IS NOT MOORED AGAIN AFTER A DOOR, AND A PORT SOUNDED BEFORE ITS WATER WAS BUILT IS SOUNDED AGAIN - the day\'s sailings kept across the sea\'s clear; a harbour that came back null tried again after HARBOUR_RETRY_S (mutants: the sailings lost with the clear, the null kept)', async () => {
  const w = await sea({ hull: null, water: coast });
  w.view.feet = [0, 0, 300]; w.deps.harbourNear = () => PORT;
  w.run(1);
  const e = moored(w)[0];
  const seed = e.ship.seed;
  e.ship.errand.until = 0;   // her dwell over
  for (let t = 0; t < 60 && e.ship.errand?.kind === 'moored'; t += 0.1) w.run(0.1);
  assert.notEqual(e.ship.errand?.kind, 'moored', 'she sails');
  w.run(1);
  w.host.clear();   // a door
  w.run(1);
  assert.ok(!moored(w).some((x) => x.ship.seed === seed), 'not moored at her berth again today');
  // unbuilt water on arrival: no harbour; built, sounded again
  let built = false;
  const u = await sea({ hull: null, water: (x, z) => built && coast(x, z) });
  u.view.feet = [0, 0, 300]; u.deps.harbourNear = () => PORT;
  u.run(1);
  assert.equal(moored(u).length, 0, 'no harbour on unbuilt water');
  built = true;
  u.run(HARBOUR_RETRY_S + 1);
  assert.ok(moored(u).length > 0, 'sounded again, and its ships stood');
});
