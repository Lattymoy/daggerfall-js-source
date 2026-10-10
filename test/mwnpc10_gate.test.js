// MWNPC10a (2026-10-09, the MW-NPC arc's tenth slice - bible/04-Characters/Morrowind-NPCs.md section 15a): THE GATE'S
// BOSS AND HIS HOST IN THEIR MORROWIND BODIES. They are no foe pool's - the relay drives them - so their actors keep
// their own counts (characters/rosterBodies.js rosterActor: a swing each time the relay's attack time changes, a recoil
// each time a blow met them) and wear their creature (creatureBodies.js); the court offers each shown body on a lane of
// its own with the billboard it is drawn by - him three times a man, the fallen dead - and the dungeon pass draws them
// before his billboards. Pinned on a real court (the WB11 test's stub sprites) over a recording lane, and by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rosterActor } from '../src/characters/rosterBodies.js';
import { createGateCourt } from '../src/scenes/gateCourt.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { HOST, profileOf } from '../src/net/gateBrain.js';
import { HOST_FALL_MS, BOSS_LOOKS } from '../src/world/gateBoss.js';
import { courtToDungeon } from '../src/world/gateArena.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const LEGION = Object.freeze(['burning', 'legion', 'echoing']);
const stOf = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', phase: 1, hp: 800, max: 1000, fighters: 3, wrathAt: 10_000_000, md: LEGION, lg: { ads: [], gone: [] }, ...over });
const ad = (o) => ({ i: 1, k: HOST.harrier, h: 45, m: 45, x: 0, z: 6, mv: null, atk: null, rose: -Infinity, yaw: 0, ...o });

test('MWNPC10a-1 rosterActor: one actor a record; a swing each time the swing key changes to a value, a recoil each time the hit key does - a held key, a NaN or none counts nothing; dead and scale as given', () => {
  const rec = {};
  const o = (k = {}) => rosterActor(rec, { id: 'x', look: { creature: ['rat'] }, feet: [1, 2, 3], yaw: 0.5, ...k });
  const a = o();
  assert.equal(o(), a, 'one object');
  assert.deepEqual([a.swings, a.hits, a.dead, a.scale, a.drawn], [0, 0, 0, 1, true]);
  o({ swingKey: 1000 }); o({ swingKey: 1000 });
  assert.equal(a.swings, 1, 'a key held is one swing');
  o({ swingKey: NaN }); o({ swingKey: NaN });
  assert.equal(a.swings, 1, 'NaN is no key, and never a swing a frame');
  o({ swingKey: 2000 });
  assert.equal(a.swings, 2);
  assert.equal(a.strike, 3, 'its strike off the count, as a foe\'s');
  o({ hitKey: -Infinity });
  assert.equal(a.hits, 0, 'never struck');
  o({ hitKey: 50 }); o({ hitKey: 50 }); o({ hitKey: 70 });
  assert.equal(a.hits, 2);
  o({ dead: 2, scale: 3, moving: true, running: true });
  assert.deepEqual([a.dead, a.scale, a.moving, a.running], [2, 3, true, true]);
  o({ running: true });
  assert.equal(a.running, false, 'no run standing still');
});

function recordingLane() {
  const L = { offered: [], calls: [], standing: new Set(), destroyed: 0 };
  Object.assign(L, {
    begin() { L.offered.length = 0; },
    stand(lane, actor) { L.offered.push({ lane, id: actor.id, look: actor.look, dead: actor.dead, scale: actor.scale, swings: actor.swings, hits: actor.hits, feet: actor.feet }); },
    end() {}, has(lane, id) { return L.standing.has(`${lane}:${id}`); },
    draw() { L.calls.push('draw'); }, drawVeiled() {}, destroy() { L.destroyed++; }, offsetAll() {},
  });
  return L;
}

test('MWNPC10a-2 the court offers him and his host their creatures, each on the billboard it is drawn by - him three times a man; a body standing casts alone; one fallen offered dead; one with no match keeps its sprite; leaving lets the lane go', async () => {
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 60 }), getScale: () => ({ width: 0, height: 0 }) };
  const renderer = {
    textures: new Set(),
    createBillboardBatch: (archive, rkey) => ({ archive, record: rkey, size: null, bounds: [0, 0, 0, 0], origin: null }),
    destroyBillboardBatch: () => {},
  };
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  let lane = null;
  const c = createGateCourt({
    renderer, gl: null, audio: null, link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), feet: () => courtToDungeon(0, 0, 4), player: () => ({ health: 100, maxHealth: 100 }),
    getTexture: async () => tex, uploadRecordFrame: (a, r, f) => renderer.textures.add(`${a}_${r}#${f}`),
    wantBodies: () => true, makeBodies: () => (lane = recordingLane()),
  });
  const frame = (t, st) => { if (st) link.st = st; clock.t = t; c.frame(); };
  // PIN MOVED (AUDIT MW-NPC D4): a Daedroth (a bearer under venom - matched), a Flesh Atronach (a sapper under venom - no
  // match) and an Imp (a harrier - no match now: Daggerfall's imp flies, Morrowind's scamp walks)
  const st = stOf({ md: ['venom', 'legion', 'echoing'], lg: { ads: [ad({ i: 1, k: HOST.bearer, x: 20, z: 6 }), ad({ i: 2, k: HOST.sapper, x: -20, z: 6 }), ad({ i: 3, x: 0, z: 12 })], gone: [] } });
  frame(1000, st);
  await new Promise((r) => setTimeout(r, 0));
  frame(1016);
  c.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  const ids = lane.offered.map((o) => o.id);
  assert.ok(ids.includes('boss') && ids.includes('host:1'), `him and the Daedroth (${ids})`);
  assert.ok(!ids.includes('host:2'), 'the Flesh Atronach keeps its sprite (a declared miss)');
  assert.ok(!ids.includes('host:3'), 'and the Imp, a flyer (a declared miss)');
  const boss = lane.offered.find((o) => o.id === 'boss'), imp = lane.offered.find((o) => o.id === 'host:1');
  assert.deepEqual(boss.look, { creature: ['dremora_lord'] }, 'the Daedra Lord, as the match has him');
  assert.deepEqual(imp.look, { creature: ['daedroth'] });
  assert.ok(Math.abs(boss.scale - BOSS_LOOKS.ruhn.scale * profileOf(st).size) < 1e-9 && boss.scale >= 3, `three times a man, as his sprite is (${boss.scale})`);
  assert.equal(imp.scale, 1);
  const bossBatch = c.batches().find((b) => b.origin === boss.feet);
  assert.ok(bossBatch, 'his feet are his billboard\'s');
  // his body standing: his billboard casts alone; the Daedroth's not standing draws
  lane.standing.add('gate:boss');
  const impBatch = c.batches().find((b) => b.origin === imp.feet);
  c.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  assert.equal(bossBatch.castOnly, true);
  assert.equal(impBatch.castOnly, false);
  // a blow of the relay's on the Daedroth: a swing; mine on it: a recoil
  frame(1100, stOf({ md: ['venom', 'legion', 'echoing'], lg: { ads: [ad({ i: 1, k: HOST.bearer, x: 20, z: 6, atk: { at: 1900, x: 0, z: 5 } }), ad({ i: 2, k: HOST.sapper, x: -20, z: 6 })], gone: [] } }));
  c.hostHit({ i: 1, d: 10, r: 0 }, 1100);
  c.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  const imp2 = lane.offered.find((o) => o.id === 'host:1');
  assert.ok(imp2.swings >= 1 && imp2.hits >= 1, `swung and struck (${imp2.swings}, ${imp2.hits})`);
  // the Daedroth falls: offered dead while it falls, then gone
  frame(2000, stOf({ md: ['venom', 'legion', 'echoing'], lg: { ads: [ad({ i: 2, k: HOST.sapper, x: -20, z: 6 })], gone: [{ i: 1, k: 0, x: 20, z: 6, w: 0, n: 'Ann', at: 1990 }] } }));
  c.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  assert.ok(lane.offered.find((o) => o.id === 'host:1')?.dead > 0, 'falling: dead');
  frame(1990 + HOST_FALL_MS + 10);
  c.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  assert.ok(!lane.offered.some((o) => o.id === 'host:1'), 'gone: no longer offered');
  c.leave();
  assert.equal(lane.destroyed, 1, 'leaving lets the lane go');
});

test('MWNPC10a-3 by source: the dungeon pass draws the court\'s bodies before the billboards their batches ride; the broker keeps her mortal guise', () => {
  const m = rd('src/scenes/worldModes.js');
  const bodies = m.indexOf('if (isGateArena(dungeonLoc)) host.drawGateBodies?.(canvas, proj, view, mwv.eye, dt);');
  const flats = m.indexOf('renderer.drawBillboards([...dungeonCtx.billboardBatches,', bodies);
  assert.ok(bodies > 0 && flats > bodies, 'before the dungeon\'s billboards (extraBillboards carries the court\'s)');
  assert.ok(rd('src/scenes/world.js').includes('drawGateBodies: (canvas, proj, view, eye, dt) => { gateCourt?.drawBodies(canvas, proj, view, eye, dt); },'));
  assert.ok(!/rosterActor|offer\(/.test(rd('src/scenes/sigilBrokerPool.js')), 'the Seducer in her mortal guise stays her sprite (section 15)');
});

test('MWNPC10a-4 an actor\'s scale reaches its body: drawn that many times its size about its feet (drawThird\'s grow), its head that much higher; an actor with none at its own size', async () => {
  const { createNpcBodies } = await import('../src/characters/npcBodies.js');
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const grows = new Map();
  const rig = () => {
    const r = { mode: 'first', skinned: false,
      attach() {}, async build() { await flush(); return { ok: true }; },
      canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; },
      thirdActive: () => r.mode === 'third' && r.skinned, update(dt, o) { if (o?.pose !== false) r.skinned = true; },
      drawThird(_c, o) { grows.set(r, o.grow); return r.thirdActive(); }, unload() {}, setSheathed() {}, revive() {} };
    return r;
  };
  const lane = createNpcBodies({ renderer: {}, tier: () => 'near', createRig: rig, now: () => 1000 });
  const look = { creature: ['dremora_lord'] };
  const actors = [{ id: 'boss', look, feet: [0, 0, -3], scale: 3 }, { id: 'imp', look: { creature: ['scamp'] }, feet: [1, 0, -3] }];
  for (let i = 0; i < 10; i++) { lane.begin(); for (const a of actors) lane.stand('gate', a); lane.end(1 / 60, [0, 0, 0]); for (let k = 0; k < 4; k++) await flush(); }
  lane.draw({}, { proj: null, view: null, eye: [0, 0, 0] });
  assert.deepEqual([...grows.values()].sort(), [1, 3], 'him three times, the Imp once');
  lane.destroy();
  const pb = rd('src/net/peerBodies.js');
  assert.ok(pb.includes('* this._scaleOf(b) : 0; }'), 'and his head (the name\'s height) three times as high');
});
