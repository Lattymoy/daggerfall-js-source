// FIELD BUGS 2026-10-30b INDOOR-FLOOR (bible/01-Overview/bugs/Field-Bugs-2026-10-30b.md section 5): "Player models falling
// through floor" in Gothway Garden's Mages Guild, and peers "floating over them not via levitation but due to z-axis
// misalignment". The owner: "Room-relative height".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indoorFloorOf, withIndoorFloor, indoorSceneY, keepIndoorFloor } from '../../src/net/peer/indoorFloor.js';
import { validPose, validPartyPose, poseChanged } from '../../src/net/wire.js';
import { RemotePlayers } from '../../src/net/remotePlayers.js';
import { createPeerFxPlayer } from '../../src/net/peer/peerFx.js';
import { lerpPose, poseAlong } from '../../src/net/online.js';
import { trs, transformPoint } from '../../src/world/mat4.js';

/** An interior context as interiorContext.js stands one: its rooms on its door's matrix (`parentPt`). */
const roomAt = (x, y, z, yawDeg = 0) => { const m = trs(x, y, z, 0, yawDeg, 0); return { parentPt: (a, b, c) => transformPoint(m, a, b, c) }; };

test('INDOOR-FLOOR two copies whose town ground differs by 3 m draw each other on their own room\'s floor: a pose indoors carries its room\'s origin (`fy`), the wire keeps it, the eased pose keeps it, and a reader draws the peer as high over its own room as over the sender\'s - on the Bay and past it; outdoors, and from a sender without it, the wire\'s height as before (mutants: `fy` never said; the wire drops it; the ease drops it; the reader ignores it; the floating origin unshed)', () => {
  for (const [where, x, z] of [['Gothway Garden', 512, -2048], ['Torval, past the Bay', 1922 * 819.2, -1705 * 819.2]]) {
    const comp = 40;   // each client's floating origin sheds its own; the wire's frame is the world's
    const mine = roomAt(x, 57 + comp, z, 90), theirs = roomAt(x, 60 + comp, z, 90);   // their town 3 m higher than mine
    // they stand 0.2 m over their room's floor (its origin), sent as world.js sends it
    const sent = withIndoorFloor({ x: 1, y: 60.2, z: 2, yaw: 0, pitch: 0, mv: 0 }, theirs, comp);
    assert.equal(sent.fy, 60, `${where}: the room's floor said`);
    const wire = validPose(JSON.parse(JSON.stringify(sent)));
    assert.equal(wire.fy, 60, 'the wire keeps it');
    const shown = poseAlong([{ pose: wire, c: 0 }], 0);
    assert.equal(shown.fy, 60, 'the eased pose keeps it');
    assert.ok(Math.abs(indoorSceneY(shown, mine, comp) - (57.2 + comp)) < 1e-9, `${where}: drawn 0.2 m over my own floor, not 3 m over it`);
    assert.equal(indoorSceneY({ ...shown, fy: undefined }, mine, comp), 60.2 + comp, 'a sender without it: the wire\'s height');
    assert.equal(indoorSceneY(shown, null, comp), 60.2 + comp, 'a reader outdoors: the wire\'s height');
  }
  assert.equal('fy' in withIndoorFloor({ y: 1 }, null, 0), false, 'outdoors a pose says no floor');
  assert.equal(indoorFloorOf(roomAt(0, 12.5, 0), 2.5), 10);
  assert.equal(validPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fy: 1e9 })?.fy, undefined, 'bounded as y is');
  assert.equal(lerpPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fy: 4 }, { x: 0, y: 1, z: 0, yaw: 0, pitch: 0, fy: 5 }, 0.5).fy, 5, 'whole, never eased');
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const pose = withIndoorFloor\(nativeFrame\n/, 'the world host sends it');
  assert.equal((w.match(/indoorSceneY\(p, mode === 'interior' && modes\?\.interiorCtx, state\.compensation\[1\]\)/g) ?? []).length, 2, 'and reads it in both frames');
});

test('AUDIT FB1030 N1-N3: what a peer leaves indoors stands on the same floor as the peer - the body it falls as (its death pose, and the party pose\'s mark of it), the point its blow lands; and a floor said is news, so a peer standing still through a relay\'s redeploy takes it (mutants: the corpse drops it; the party mark drops it; the blow\'s point drops it; poseChanged blind to it)', () => {
  const rp = new RemotePlayers({ renderer: null, deps: null, compose: async () => null });
  rp.addCorpse({ id: 'p1', acct: 'a1' }, { x: 1, y: 60.2, z: 2, fy: 60, dd: 1 }, 'interior:m7.300', { quiet: true });
  assert.equal(rp._corpses.at(-1).pose.fy, 60, 'N1: the body keeps its room\'s floor');
  const party = validPartyPose({ px: 120, py: 140, h: 1, hm: 10, f: 1, fm: 10, m: 1, mm: 10, dd: { k: 'interior:m7.300', x: 1, y: 60.2, z: 2, fy: 60, at: 5 } });
  assert.equal(party?.dd?.fy, 60, 'N1: the party pose\'s mark of the body keeps it');
  assert.match(readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8'), /_deadMark = online\._pose \? keepIndoorFloor\(\{ k: online\.room, x: online\._pose\.x, y: online\._pose\.y, z: online\._pose\.z, at: Date\.now\(\) \}, online\._pose\) : null;/, 'and the host marks it');
  assert.deepEqual([keepIndoorFloor({ x: 1 }, { fy: 60 }), keepIndoorFloor({ x: 1 }, { y: 2 })], [{ x: 1, fy: 60 }, { x: 1 }]);
  const asked = [];
  const fx = createPeerFxPlayer({ play: () => {}, toScene: (p) => { asked.push(p); return [p.x, p.y, p.z]; }, now: () => 10 });
  fx.update('p1', { hk: 0, fy: 60 }, [0, 0, 0]);
  fx.frame?.();
  fx.update('p1', { hk: 1, hp: [1, 61, 2], hb: 0, hq: 10, fy: 60 }, [0, 0, 0]);
  assert.equal(asked.at(-1)?.fy, 60, 'N2: the blow\'s point read over the sender\'s floor');
  const still = { x: 1, y: 60.2, z: 2, yaw: 0, pitch: 0, mv: 0 };
  assert.equal(poseChanged(still, { ...still, fy: 60 }), true, 'N3: a floor said is news');
  assert.equal(poseChanged({ ...still, fy: 60 }, { ...still, fy: 60 }), false, 'and the same floor is none');
});
