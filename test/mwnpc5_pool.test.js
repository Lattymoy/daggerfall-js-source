// MWNPC5c (2026-10-09, the MW-NPC arc's fifth slice - bible/04-Characters/Morrowind-NPCs.md section 10c): THE ENCOUNTER
// POOL'S FOES IN THEIR BODIES. The dungeon context's law (section 10b) on the pool every other foe host draws
// (scenes/exteriorFoes.js - world.js's exterior, worldModes.js's interiors, exterior.js): batches() offers the class
// foes to the lane dressed as their billboards, drawBodies syncs it, marks each offered billboard cast-only where its
// body stands and draws the bodies; drawVeiledBodies draws the concealed. Pinned on the real pool with a recording lane,
// and the three hosts by source - each calls drawBodies after batches() and before those billboards draw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8 };

/** a lane that records what the pool asks of it; `standing` the ids it says stand */
function recordingLane() {
  const L = { calls: [], offered: [], standing: new Set(), destroyed: 0, offsets: [] };
  Object.assign(L, {
    begin() { L.offered.length = 0; L.calls.push('begin'); },
    stand(lane, actor, conceal, flash, fx) { L.offered.push({ lane, actor, conceal, flash, fx }); },
    end(dt, eye) { L.calls.push(['end', dt, eye]); },
    has(lane, id) { return L.standing.has(`${lane}:${id}`); },
    draw(_c, o) { L.calls.push(['draw', o.eye]); },
    drawVeiled() { L.calls.push('veiled'); },
    destroy() { L.destroyed++; },
    offsetAll(o) { L.offsets.push(o); },
  });
  return L;
}
const foe = (mobileType, feet, extra = {}) => ({
  mobileType, gender: 'male', dead: false, seq: extra.seq,
  entity: { health: 10, maxHealth: 10, items: [], activeEffects: [], isClass: mobileType >= 128 },
  ai: { feet: [...feet], yaw: 0.3, moving: false, isHostile: true, detected: false, height: 1.8, offsetOrigin(o) { this.feet[0] += o[0]; this.feet[1] += o[1]; this.feet[2] += o[2]; } },
  tex: stubTex, archive: ENEMY_BASICS[mobileType].maleTexture, batch: {}, _mout: { record: 0, frame: 0, flip: false },
  mobile: { basics: { behaviour: 'General' } },
  ...extra,
});

test('MWNPC5c the pool offers its class foes dressed, the dead from the kill, syncs, marks the cast-only after the sync, draws the bodies - and lets the lane go when it is not wanted', () => {
  let want = true;
  let lane = null, made = 0;
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => 0.5, heightAt: () => 0 }, fetchBytes: async () => { throw new Error('none'); }, getTexture: async () => stubTex,
    uploadRecordFrame: () => {}, currentMinute: () => 1000, playerEntity: { level: 1, items: [], stats: {} }, audio: null, onPlayerHurt: () => {},
    wantNpcBodies: () => want, makeNpcBodies: () => { made++; return (lane = recordingLane()); },
  });
  const knight = foe(130, [2, 0, 3], { seq: 7 });
  // PIN MOVED (MWNPC9, bible/04-Characters/Morrowind-NPCs.md section 14b): the rat has a Morrowind body now - the creature
  // left out is one Morrowind has no match for (a giant bat, a declared miss)
  const rat = foe(3, [4, 0, 5], { seq: 8 });
  const fallen = foe(131, [6, 0, 1], { seq: 9, dead: true, corpse: true, corpseMarker: { batch: {} } });
  knight._hfAt = performance.now() / 1000;   // struck this moment: the host's hit flash lights its billboard
  pool.foes.push(knight, rat, fallen);
  const out = pool.batches();
  assert.equal(made, 1, 'the lane made the first frame it is wanted');
  assert.ok(out.includes(knight.batch) && out.includes(rat.batch), 'every live billboard still in the pass (it casts either way)');
  // PIN MOVED (AUDIT MW-NPC B1): a body's id is the pool's own entry id (idOf, `uid`) - never `seq`, which a puppet
  // shares with its owner's foes
  assert.ok(knight.uid != null && fallen.uid != null && knight.uid !== fallen.uid);
  assert.deepEqual(lane.offered.map((o) => o.actor.id), [knight.uid, fallen.uid], 'the class foe and the dead class foe - never the unmatched creature');
  assert.ok(lane.offered[0].flash > 0.5 && lane.offered[0].flash === knight.batch.hitFlash, `dressed as its billboard is (${lane.offered[0].flash})`);
  assert.equal(lane.offered[0].actor.hits, 1, 'and the hit is a recoil');
  assert.equal(lane.offered[1].actor.dead > 0, true, 'the dead offered dead');
  assert.equal(knight.batch.castOnly, false, 'drawn until the lane says otherwise');
  lane.standing.add(`foe:${knight.uid}`); lane.standing.add(`foe:${fallen.uid}`);
  pool.drawBodies({}, null, null, [1, 2, 3], 1 / 60);
  assert.deepEqual(lane.calls.slice(1), [['end', 1 / 60, [1, 2, 3]], ['draw', [1, 2, 3]]], 'synced, then drawn with the host\'s eye');
  assert.equal(knight.batch.castOnly, true, 'its body stands: the billboard casts alone');
  assert.equal(fallen.corpseMarker.batch.castOnly, true, 'and the corpse flat under a body');
  assert.equal(rat.batch.castOnly, false, 'the creature\'s billboard draws');
  // the next frame the body is gone (past the cap, say): the billboard draws again from the offer on
  lane.standing.clear();
  pool.batches();
  assert.equal(knight.batch.castOnly, false, 'reset at the offer');
  pool.drawBodies({}, null, null, [1, 2, 3], 1 / 60);
  assert.equal(knight.batch.castOnly, false, 'and left drawn');
  const syncs = () => lane.calls.filter((c) => Array.isArray(c) && c[0] === 'end').length;
  const before = syncs();
  pool.drawBodies({}, null, null, [1, 2, 3], 1 / 60);
  assert.equal(syncs(), before, 'a second draw with nothing offered since syncs nothing (a frame the host drew no pool)');
  pool.drawVeiledBodies();
  assert.equal(lane.calls.at(-1), 'veiled');
  pool.offsetAll([10, 0, -5]);
  assert.deepEqual(lane.offsets, [[10, 0, -5]], 'the bodies follow the origin');
  // not wanted: the lane let go, nothing offered, every billboard drawn
  lane.standing.add(`foe:${knight.uid}`);
  pool.batches(); pool.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  assert.equal(knight.batch.castOnly, true);
  want = false;
  pool.batches();
  assert.equal(lane.destroyed, 1, 'let go the frame it is not wanted');
  assert.equal(knight.batch.castOnly, false, 'and the billboard drawn again');
  pool.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  assert.equal(knight.batch.castOnly, false, 'no lane, no marks');
  want = true;
  pool.batches();
  assert.equal(made, 2, 'wanted again: a new lane');
  pool.destroy();
  assert.equal(lane.destroyed, 1, 'and gone with the pool');
});

test('MWNPC5c the three hosts by source: each calls drawBodies after the pool\'s batches() and before those billboards draw, and draws the veiled beside the peers\'', () => {
  const sites = [
    ['src/scenes/world.js', 'livePersonBatches.push(...exteriorFoes.batches(), ...navalCrew.batches());', 'exteriorFoes.drawBodies(canvas, proj, view, mwv.eye, foeDt);', 'if (livePersonBatches.length) renderer.drawBillboards(livePersonBatches, camRight, bbUp);', 'exteriorFoes.drawVeiledBodies();'],
    ['src/scenes/worldModes.js', 'const _foeBatches = interiorFoes.batches();', 'interiorFoes.drawBodies(canvas, proj, view, mwv.eye, foeDt);', 'if (_foeBatches.length) renderer.drawBillboards(_foeBatches, camRight, UP_Y);', 'interiorFoes?.drawVeiledBodies();'],
    ['src/scenes/exterior.js', 'personBatches.push(...exteriorFoes.batches());', 'exteriorFoes.drawBodies(canvas, proj, view, eye, foeDt);', 'if (personBatches.length) renderer.drawBillboards(personBatches, camRight, UP_Y);', 'exteriorFoes.drawVeiledBodies();'],
  ];
  for (const [file, offer, draw, flats, veiled] of sites) {
    const s = rd(file);
    const a = s.indexOf(offer), b = s.indexOf(draw, a), c = s.indexOf(flats, b);
    assert.ok(a > 0 && b > a && c > b, `${file}: offered, drawn, and then the billboards`);
    assert.equal(s.split(draw).length, 2, `${file}: once`);
    assert.ok(s.includes(veiled), `${file}: the veiled`);
  }
  const pool = rd('src/scenes/exteriorFoes.js');
  assert.ok(pool.includes('_npcLane?.destroy(); _npcLane = null;   // MWNPC5c: the bodies with them'), 'the pool\'s destroy lets its lane go');
});
