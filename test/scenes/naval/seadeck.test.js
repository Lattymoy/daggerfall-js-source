// SEA-DECK (FIELD BUGS 2026-10-23, the owner after DECK-POSE: "Do the not fixed items" - "Other players also slide when on
// board your ship/npc ships"): THE SEA'S OWN SHIPS CARRY WHOEVER STANDS ON THEIR DECKS (scenes/naval/seaDecks.js, wired by
// the naval host and the world's deck door). A merchantman under sail stood in the player's collider and moved nobody: she
// sailed out from under the body, her rail shoving it along, and every other screen drew it a play-out behind her. Now her
// deck's move - her root and the bob her deck rolls with - carries the one aboard after the sea poses her, the place
// rides the pose under her seed and class, and a reader stands the body on her deck a frame ahead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea } from '../../navalSea.mjs';
import { rig, raycastColliders, boardPlaceOf, SEA, IDLE, FIXED_DT } from '../../partyBoatTeleportRig.mjs';
import { createSeaDecks, seaDeckKey, isSeaDeckKey, SEA_DECK_JUMP_M } from '../../../src/scenes/naval/seaDecks.js';
import { deckPose, localOf, worldOf } from '../../../src/scenes/comeSailAway/comeSailAwayAboard.js';
import { validAboard } from '../../../src/net/wire.js';
import { Boat, HULL_NAMES } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { quatAngleAxis } from '../../../src/world/quat.js';
import { quatEuler } from '../../../src/world/unityAnimator.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const NAVAL = readFileSync(new URL('../../../src/scenes/naval/navalHost.js', import.meta.url), 'utf8');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The real sea fight over the real pool, on foot, a merchantman built beside me and sailing; the world's deck door stood
 *  in by `me` (its gate, its ground and its carry onto `view.feet`), my feet set on her deck at `L` in its frame. */
async function aboardHer(L = [0.5, 3, 2]) {
  const h = await sea({ hull: null });
  const id = h.host.spawnShip('merchantGalleon', { range: 40, bearing: 0.5 });
  const e = h.host._sea.get(id);
  for (let i = 0; i < 5 && !e.boat; i++) h.host.frame(1 / 60);
  assert.ok(e.boat, 'her boat built');
  e.ship.speed = 6;   // under way: the AI's own steps carry her on from here
  const me = { on: 'boat', ok: true, carried: 0 };
  h.deps.deck = {
    allowed: () => me.ok,
    ground: (b) => (b === e.boat ? me.on : null),
    carry: (d) => { me.carried++; h.view.feet = [h.view.feet[0] + d[0], h.view.feet[1] + d[1], h.view.feet[2] + d[2]]; },
  };
  h.view.feet = worldOf(deckPose(e.boat), L);
  return { h, e, me, L };
}

test('SEA-DECK ON HER DECK: a body standing on a ship of the sea\'s under way and rocking is carried by her deck\'s move - its place on her deck kept to the millimetre while she sails metres - and is aboard her; its place said under her seed and class, through the pose\'s door (mutants: no carry; the carry by her root alone, not her rolling deck; the place said under another key)', async () => {
  const { h, e, L } = await aboardHer();
  const from = [...e.boat.GameObject.position];
  let worst = 0;
  for (let i = 0; i < 180; i++) {
    h.host.frame(1 / 60);
    worst = Math.max(worst, dist(localOf(deckPose(e.boat), h.view.feet), L));
  }
  const sailed = dist(e.boat.GameObject.position, from);
  assert.ok(sailed > 5, `she sailed (${sailed.toFixed(2)} m)`);
  assert.ok(e.boat.MeshObject.localRotation[0] !== 0 || e.boat.MeshObject.localRotation[2] !== 0, 'and her deck rolls');
  assert.ok(worst < 0.002, `my place on her deck kept (${(worst * 1000).toFixed(2)} mm at worst)`);
  assert.equal(h.host.deckBoat(), e.boat, 'aboard her');
  const key = seaDeckKey(e);
  assert.equal(key, `~sea:${e.ship.seed >>> 0}:${e.ship.cls.id}`);
  assert.ok(isSeaDeckKey(key) && !isSeaDeckKey('mac-0001'));
  const w = h.host.deckWord(h.view.feet);
  assert.deepEqual(w.slice(0, 2), [key, 0]);
  w.slice(2).forEach((v, k) => assert.ok(Math.abs(v - L[k]) <= 0.006, `my feet in her deck's frame, to the cm (${v} vs ${L[k]})`));
  assert.deepEqual(validAboard(w), w, 'through the pose\'s door whole');
});

test('SEA-DECK A READER\'S SCREEN: the deck a body is stood on a frame ahead is where her deck stands once the sea has posed her - within a few millimetres, where the deck she stood on before the frame is her way times the frame off; no key of a ship of mine answers a player\'s (mutant: her way unled)', async () => {
  const { h, e, L } = await aboardHer();
  const key = seaDeckKey(e);
  for (let i = 0; i < 20; i++) h.host.frame(1 / 60);
  let led = 0, still = 0;
  for (let i = 0; i < 60; i++) {
    const dt = 1 / 60;
    const ahead = h.host.deckAhead(key, dt);
    const before = worldOf(deckPose(e.boat), L);
    h.host.frame(dt);
    const after = worldOf(deckPose(e.boat), L);
    led = Math.max(led, dist(worldOf(ahead, L), after));
    still = Math.max(still, dist(before, after));
  }
  assert.ok(still > 0.08, `un-led, a frame behind her (${still.toFixed(3)} m)`);
  assert.ok(led < 0.02, `led, on her deck (${(led * 1000).toFixed(1)} mm at worst)`);
  assert.equal(h.host.deckAhead('mac-0001', 1 / 60), null, 'a player\'s key: none of the sea\'s');
  assert.equal(h.host.deckAhead('~sea:1:nobody', 1 / 60), null, 'a ship not stood here: none');
});

test('SEA-DECK OFF: standing on something else, swimming, the host\'s gate shut, or her deck jumping (a copy snapped, a ship rebuilt) puts the body off her - carried no further; a deck under nothing of hers boards nobody (mutants: the ground unasked; the swim unasked; the gate unasked; the jump carried)', async () => {
  for (const [why, off] of [
    ['standing on something else', (x) => { x.me.on = 'other'; }],
    ['swimming', (x) => { x.h.deps.swimming = () => true; }],
    ['the gate shut', (x) => { x.me.ok = false; }],
    ['her deck jumped', (x) => { x.e.ship.pos = [x.e.ship.pos[0] + SEA_DECK_JUMP_M * 3, x.e.ship.pos[1], x.e.ship.pos[2]]; x.e.target = null; x.after = () => { x.me.on = null; }; }],   // the motor stands on nothing of hers once she is gone from under it
  ]) {
    const x = await aboardHer();
    for (let i = 0; i < 10; i++) x.h.host.frame(1 / 60);
    assert.equal(x.h.host.deckBoat(), x.e.boat, `${why}: aboard first`);
    off(x);
    x.h.host.frame(1 / 60);
    x.after?.();
    const n = x.me.carried, at = [...x.h.view.feet];
    if (why === 'her deck jumped') assert.ok(dist(at, worldOf(deckPose(x.e.boat), x.L)) > 10, 'not carried across the jump');
    for (let i = 0; i < 10; i++) x.h.host.frame(1 / 60);
    assert.equal(x.h.host.deckBoat(), null, `${why}: off her`);
    assert.equal(x.me.carried, n, `${why}: carried no further`);
    assert.equal(x.h.host.deckWord(x.h.view.feet), null, `${why}: no place said`);
  }
  const x = await aboardHer();
  x.me.on = null;   // in the air, and no floor of hers under the feet (the host's own standsOn)
  x.h.view.feet = [x.h.view.feet[0] + 300, x.h.view.feet[1], x.h.view.feet[2]];
  x.h.host.frame(1 / 60);
  assert.equal(x.h.host.deckBoat(), null, 'nothing of hers under me: not aboard');
});

test('SEA-DECK ON THE REAL MOTOR: standing on a Small Ship of the sea\'s sailing 6 m/s, turning and rolling, the body stands where it stood on her deck, on her own collider every frame - where without the carry she sailed out from under it (the report\'s jitter: her rail shoving it along) (mutant: no carry)', async () => {
  const run = async (carry) => {
    const r = await rig({ hull: HULL_NAMES.indexOf('Small Ship'), mine: false });
    const ship = r.pool.spawnNow(new Boat(HULL_NAMES.indexOf('Small Ship'), 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
    ship.GameObject.position = [80, SEA, 0];
    const entries = [{ boat: ship, ship: { seed: 77, cls: { id: 'merchant' }, yaw: 0, speed: 6 } }];
    const decks = createSeaDecks({ standsOn: () => false, feet: () => r.player.pos, swimming: () => !!r.player.isPlayerSwimming });
    const me = {
      allowed: () => true,
      ground: (b) => (!r.player.grounded ? null : String(r.player.groundKey).startsWith(r.keyOf(b)) ? 'boat' : 'other'),
      carry: (d, yawDeg) => { if (carry) { r.player.carryBy(d[0], d[1], d[2]); r.cam.yaw += (yawDeg * Math.PI) / 180; } },
    };
    r.w.sync();
    const at = boardPlaceOf(ship.BoardTriggers[0]);
    const deck = raycastColliders(ship.GameObject, [at.position[0], at.position[1] + 1, at.position[2]], [0, -1, 0], 6, { triggers: false, geometry: r.geometry });
    r.player.spawn(deck.point[0], deck.point[1] + 0.02, deck.point[2]);
    for (let i = 0; i < 5; i++) { r.player.update(FIXED_DT, IDLE, r.cam.yaw); r.w.sync(); }
    const place = localOf(deckPose(ship), r.player.pos);
    let worst = 0, onHer = 0, t = 0;
    for (let i = 0; i < 60 * 3; i++) {
      r.player.update(FIXED_DT, IDLE, r.cam.yaw); r.w.sync();
      decks.hold(entries);
      t += FIXED_DT;
      const yaw = (6 * t * Math.PI) / 180;
      entries[0].ship.yaw = yaw;
      const p = ship.GameObject.position;
      ship.GameObject.position = [p[0] + Math.sin(yaw) * 6 * FIXED_DT, SEA, p[2] + Math.cos(yaw) * 6 * FIXED_DT];   // 6 m/s along her heading
      ship.GameObject.rotation = quatAngleAxis((yaw * 180) / Math.PI, [0, 1, 0]);
      ship.MeshObject.localRotation = quatEuler(2 * Math.sin(t * 1.7), 0, 3 * Math.sin(t * 1.1));
      decks.frame(entries, me, 1);
      r.w.sync();
      worst = Math.max(worst, dist(localOf(deckPose(ship), r.player.pos), place));
      if (r.player.grounded && String(r.player.groundKey).startsWith(r.keyOf(ship))) onHer++;
    }
    return { worst, onHer, aboard: decks.boat === ship };
  };
  const carried = await run(true), left = await run(false);
  assert.ok(carried.worst < 0.03, `carried: my place on her deck kept (${(carried.worst * 100).toFixed(1)} cm at worst)`);
  assert.equal(carried.onHer, 180, 'on her own collider every frame');
  assert.ok(carried.aboard, 'aboard her');
  assert.ok(left.worst > 1, `uncarried she sails out from under me (${left.worst.toFixed(2)} m off my place)`);
});

test('SEA-DECK THE WIRING: the naval host holds each deck before it poses her and carries after, through the world\'s deck door - the gate, the ground and the carry CSA-K\'s own, the eye taken again; my place said on the pose after another\'s boat and my helm; a reader\'s place under a sea key stood a frame ahead; the sea\'s deck carries my moving bit (mutants: the hold after the poses; the door unwired; the word, the reader or the carrier unasked)', () => {
  assert.match(NAVAL, /shipDecks\.hold\(sea\.values\(\)\);[^\n]*\n\s+for \(const e of sea\.values\(\)\) poseShip\(e, total, seaY, eye\);\n\s+shipDecks\.frame\(sea\.values\(\), deps\.deck, dt > 0 \? total \/ dt : 1\);/);
  assert.match(WORLD, /deck: \{ allowed: deckMayCarry, ground: deckGround, carry: \(d, yawDeg\) => \{ deckCarry\(d, yawDeg\); cam\.pos = player\.eyeAt\(\); \} \},/);
  assert.match(WORLD, /const csaDeckWord = \(\) => \(csaOn\(\) \? \(csaAboard\.word\(player\.pos\) \?\? csaHelmWord\(\) \?\? naval\?\.deckWord\?\.\(player\.pos\) \?\? null\) : null\);/);
  assert.match(WORLD, /poseOf: \(o, i\) => csaPoseAhead\(o, i, dt\) \?\? naval\?\.deckAhead\?\.\(o, gamePaused\(\) \? 0 : dt \* worldTimeScale\(\)\) \?\? null,/);
  assert.match(WORLD, /const carrier = csaOn\(\) \? \(csaAboard\.aboard\?\.boat \?\? \(csaRuntime\?\.isSailing\(\) \? csaRuntime\.state\.CurrentBoat : null\) \?\? naval\?\.deckBoat\?\.\(\) \?\? null\) : null;/);
});
