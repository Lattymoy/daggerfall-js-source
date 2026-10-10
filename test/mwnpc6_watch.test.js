// MWNPC6 (2026-10-09, the MW-NPC arc's sixth slice - bible/04-Characters/Morrowind-NPCs.md section 11): THE WATCH IN
// ITS BODIES. The encounter pool's law (section 10c) on the city watch (scenes/cityGuards.js - world.js's street,
// worldModes.js's buildings, exterior.js), on a lane of its own under smaller caps (WATCH_BODY_TIERS - the same switch,
// a third of the foes' bodies): every watchman offered dressed as his billboard by his POOL id (his wire number comes
// late, and a body must not change hands when it does), the dead from the kill until the corpse is collected,
// drawBodies syncing and marking the cast-only before the host draws the batches update() returned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';
import { NPC_BODY_TIERS, WATCH_BODY_TIERS } from '../src/characters/npcBodies.js';
import { foeActor, foeSeed, applyWireLook } from '../src/characters/foeBodies.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };

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

test('MWNPC6a the watch\'s own caps: the same switch\'s tiers, a third of the foes\' bodies and half their skins; a watchman\'s seed and id his pool\'s', () => {
  assert.deepEqual(Object.keys(WATCH_BODY_TIERS), Object.keys(NPC_BODY_TIERS), 'the one switch');
  assert.equal(WATCH_BODY_TIERS.off, null);
  for (const t of ['near', 'all']) {
    assert.equal(WATCH_BODY_TIERS[t].max * 3, NPC_BODY_TIERS[t].max, `${t}: a third of the bodies`);
    assert.equal(WATCH_BODY_TIERS[t].skinBudget * 2, NPC_BODY_TIERS[t].skinBudget, `${t}: half the skins`);
    assert.equal(WATCH_BODY_TIERS[t].range, NPC_BODY_TIERS[t].range, `${t}: the same reach`);
  }
  const man = (id) => ({ id, seq: null, mobileType: GUARD_MOBILE_TYPE, entity: { isClass: true, items: [] }, ai: { feet: [0, 0, 0], yaw: 0 } });
  assert.notEqual(foeSeed(man(3)), foeSeed(man(4)), 'two watchmen, two people (no layout point, no wire number: the pool\'s id)');
  const m = man(3);
  assert.equal(foeActor(m, m.id).id, 3, 'the actor by the id the population names');
  const s = foeSeed(m);
  // PIN MOVED (AUDIT MW-NPC C5): his wire number, once it arrives, is his seed - the number every puppet of him carries,
  // so each machine draws one man (MWNPC5b's law). Kept off his local id, his owner drew one man and every peer another.
  // PIN MOVED again (AUDIT MW-NPC II K3/K4): the seed is MINTED ONCE and rides the wire (the record's `ls`) - his number
  // arriving changes nothing, and his puppets take the very seed (mwnpc_audit2.test.js K4)
  m.seq = 41;
  assert.equal(foeSeed(m), s, 'his number arrived: he is the same man - the seed his puppets are handed');
  const puppet = { id: 99, seq: 41, mobileType: GUARD_MOBILE_TYPE, entity: { isClass: true, items: [] }, ai: { feet: [5, 0, 5], yaw: 0 } };
  applyWireLook(puppet, { ls: foeSeed(m) });   // the record's `ls` (exteriorFoes.js foesFrame, applyPuppetRecord)
  assert.equal(foeSeed(m), foeSeed(puppet), 'the man his owner draws is the man a peer draws');
  // AUDIT MW-NPC II P7: "and kept" compared the seed with itself - kept as he walks is the law
  m.ai.feet = [40, 0, -12];
  assert.equal(foeSeed(m), s, 'and kept wherever he walks');
});

test('MWNPC6b the pool: a dead watchman offered dead from the kill, under the watch\'s lane name, the corpse flat cast-only under his body after the sync; the lane gone with clearLive, the origin followed', () => {
  let want = true, lane = null;
  const g = createCityGuards({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { heightAt: () => 0, raycast: () => Infinity }, fetchBytes: async () => { throw new Error('none'); }, getTexture: async () => stubTex,
    uploadRecordFrame: () => {}, currentMinute: () => 523530, playerEntity: { level: 1, reflexes: 2, skills: 30, stats: {} }, audio: null, onPlayerHurt: () => {},
    wantNpcBodies: () => want, makeNpcBodies: () => (lane = recordingLane()),
  });
  const corpse = { batch: {} };
  const fallen = { id: 12, seq: null, mobileType: GUARD_MOBILE_TYPE, gender: 'male', dead: true, corpse: true, corpseMarker: corpse,
    entity: { isClass: true, items: [], activeEffects: [], health: 0, maxHealth: 10 }, ai: { feet: [3, 0, 4], yaw: 0, offsetOrigin() {} },
    tex: stubTex, archive: ENEMY_BASICS[GUARD_MOBILE_TYPE].maleTexture, batch: null };
  g.guards.push(fallen);
  g.update(0, [0, 0, 0], [0, 1.7, 0], {});
  assert.ok(lane, 'the lane made the first frame it is wanted');
  assert.deepEqual(lane.offered.map((o) => [o.lane, o.actor.id, o.actor.dead > 0]), [['watch', 12, true]], 'offered dead, on the watch\'s lane, by his pool id');
  lane.standing.add('watch:12');
  g.drawBodies({}, null, null, [1, 2, 3], 1 / 60);
  assert.deepEqual(lane.calls.slice(1), [['end', 1 / 60, [1, 2, 3]], ['draw', [1, 2, 3]]], 'synced, then drawn');
  assert.equal(corpse.batch.castOnly, true, 'the corpse flat casts alone under his body');
  const syncs = lane.calls.length;
  g.drawBodies({}, null, null, [1, 2, 3], 1 / 60);
  assert.equal(lane.calls.length, syncs, 'nothing offered since: nothing synced');
  g.drawVeiledBodies();
  assert.equal(lane.calls.at(-1), 'veiled');
  g.offsetAll([4, 0, -2]);
  assert.deepEqual(lane.offsets, [[4, 0, -2]], 'the bodies follow the origin');
  want = false;
  g.update(0, [0, 0, 0], [0, 1.7, 0], {});
  assert.equal(lane.destroyed, 1, 'not wanted: let go');
  want = true;
  g.update(0, [0, 0, 0], [0, 1.7, 0], {});
  const second = lane;
  g.clearLive();
  assert.equal(second.destroyed, 1, 'and gone with the watch (an interior\'s teardown)');
});

test('MWNPC6c by source: the live watchman offered dressed, his billboard reset at the offer; the three hosts draw the watch\'s bodies before its batches draw, and the veiled beside the foes\'', () => {
  const c = rd('src/scenes/cityGuards.js');
  assert.ok(c.includes("      g.batch.castOnly = false;   // MWNPC6: drawn until drawBodies says his body stands\n      if (npcLane && isClassFoe(g)) { npcLane.stand('watch', foeActor(g, g.id), g.batch.conceal ?? null, g.batch.hitFlash || 0, foeFx(g)); _npcStood.push(g); }\n      out.push(g.batch);"), 'the live offer');
  assert.ok(c.includes('createHostNpcBodies({ renderer, collider: () => collider, tiers: WATCH_BODY_TIERS })'), 'under the watch\'s caps');
  const sites = [
    ['src/scenes/world.js', 'livePersonBatches.push(...cityGuards.update(foeDt,', 'cityGuards.drawBodies(canvas, proj, view, mwv.eye, foeDt);', 'if (livePersonBatches.length) renderer.drawBillboards(livePersonBatches, camRight, bbUp);', 'cityGuards.drawVeiledBodies();'],
    ['src/scenes/worldModes.js', 'const _guardBatches = interiorGuards.update(foeDt,', 'interiorGuards.drawBodies(canvas, proj, view, mwv.eye, foeDt);', 'if (_guardBatches.length) renderer.drawBillboards(_guardBatches, camRight, UP_Y);', 'interiorGuards?.drawVeiledBodies();'],
    ['src/scenes/exterior.js', 'const guardBatches = cityGuards.update(foeDt,', 'cityGuards.drawBodies(canvas, proj, view, eye, foeDt);', 'if (personBatches.length) renderer.drawBillboards(personBatches, camRight, UP_Y);', 'cityGuards.drawVeiledBodies();'],
  ];
  for (const [file, offer, draw, flats, veiled] of sites) {
    const s = rd(file);
    const a = s.indexOf(offer), b = s.indexOf(draw, a), f = s.indexOf(flats, b);
    assert.ok(a > 0 && b > a && f > b, `${file}: offered, drawn, then the billboards`);
    assert.equal(s.split(draw).length, 2, `${file}: once`);
    assert.ok(s.includes(veiled), `${file}: the veiled`);
  }
});
