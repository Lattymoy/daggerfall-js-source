// EG-ZH (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 11.7, 11.8, 15 and
// 27.8): THE BODY IN THE SPIRE. THE DEATH SAVES AT A REDOUBT (systems/loot/lootPowers.js, systems/sigil/sigilSetPowers.js): Divine
// Grace and the Ghost-King's Vigil spent in an Elite Breach held past their timers to the next Redoubt taken, their chips
// reading "Redoubt", the round silent; the Redoubt recovering both, held or not; out of the breach (or in another) their own
// timers. THE CAMERA IN ROCK (player/mwView.js): both lanes in at once against a wall, out again over 0.25 s at most, never
// past where their casts allow; nothing outside the Spire. THE FRAGMENT'S OWN CLAMP (world/eliteGates/egHall.js egFragZones,
// egFragKeep, egFragArena - the motor's arena): each passage's walls and each chamber's ring hold the feet, their open edges
// (mouths, alcove doorways, an open passage's sides, a ring's gaps) let them go, the ceiling holds the head; the breach
// client setting it while I stand in a fragment and never over another arena. TOUCH ON THE SPANS (ui/touch/touch.js): in the Spire
// a Jump press that keeps sliding looks, an upward flick jumps, and on the spans the stick runs at full throw - and out of
// it the layer is TI2's.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import * as LR from '../../../src/systems/loot/lootRarity.js';
import * as LP from '../../../src/systems/loot/lootPowers.js';
import { _resetSetPowersForTests, setSpireRecovery, spireRedoubtTaken, registerSpireRedoubt, spireRoomNow } from '../../../src/systems/sigil/sigilSetPowers.js';
import { _resetSigilSetsForTests } from '../../../src/systems/sigil/sigilSets.js';
import { hurtPlayer } from '../../../src/characters/playerEntity.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';
import { equipItem } from '../../../src/systems/equip.js';
import { mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { spireCameraEase, spireCameraFrame, setSpireCamera, SPIRE_CAMERA_EASE_S, SPIRE_EOTB_FULL_M } from '../../../src/player/mwView.js';
import { egFragZones, egFragZoneAt, egFragKeep, egFragArena, EG_CLAMP_SLACK_M, egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { PlayerMotor, CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../../../src/player/motor.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { attachTouch, setTouchSpire, egTouchFlick, egFullThrow, EG_FLICK_PX, EG_FLICK_MS } from '../../../src/ui/touch/touch.js';
import { setBindings } from '../../../src/ui/input.js';
import { createBindings, setBinding } from '../../../src/systems/inputActions.js';
import { TAP_PX } from '../../../src/ui/touch/touchGestures.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(77, [1]);
});

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

// ── the death saves ─────────────────────────────────────────────────────────────────────────────────────────────────
let T = 0;
LP._setLootPowersClockForTests(() => T);
const said = [];
const fresh = () => {
  _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); _resetSigilSetsForTests();
  setPlayerDoor(null); T = 0; said.length = 0; LP.setLootPowersVoice({ say: (l) => said.push(l) });
};
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 50, maxMagicka: 100, goldPieces: 0 });
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
function legendary(id) {
  const rec = LR.legendaryById(id);
  const t = rec.templates?.[0];
  const base = mintCondition({ group: rec.group, templateIndex: t ?? (rec.group === 'Armor' ? 102 : 135), material: rec.group === 'Armor' ? ARMOR_MATERIAL.Steel : undefined, flags: 0 });
  const it = LR.applyRarity(base, 'legendary', lcg(1), [rec]);
  it.isIdentified = true;
  return it;
}
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };

test('EG-ZH DIVINE GRACE AT A REDOUBT (section 15): spent in an Elite Breach it is held past its 180 s to the next Redoubt taken - the next killing blow kills, its chip reads "Redoubt", the round says nothing; the Redoubt recovers it (and one still on its timer) and the round says so; out of the breach, or in another, its own timer governs (mutants: the hold ignored; the Redoubt not recovering it; a hold outliving its breach; the chip on its timer)', () => {
  fresh();
  let room = 'breach-1';
  setSpireRecovery(() => room);
  const me = player(); wear(me, LR && legendary('amulet-of-the-nine'));
  hurtPlayer(me, 500);
  assert.equal(me.health, 26, 'saved: left at 1, healed a quarter');
  assert.equal(LP.lootSpireHeld('grace'), true, 'held to the Redoubt');
  T = 400;
  LP.lootRound(me);
  assert.ok(!said.includes('Divine Grace is ready again.'), 'held: nothing said');
  assert.deepEqual(LP.lootHudChips(me, 400).filter((c) => c.key === 'grace').map((c) => [c.state, c.text]), [['recovering', 'Redoubt']]);
  me.health = 50;
  hurtPlayer(me, 500);
  assert.equal(me.health, 0, 'past its timer, still held: a death');
  me.health = 50;
  spireRedoubtTaken();
  assert.equal(LP.lootSpireHeld('grace'), false);
  LP.lootRound(me);
  assert.deepEqual(said.slice(-1), ['Divine Grace is ready again.']);
  hurtPlayer(me, 500);
  assert.equal(me.health, 26, 'the Redoubt recovered it');
  T = 420;
  spireRedoubtTaken();
  me.health = 50; hurtPlayer(me, 500);
  assert.equal(me.health, 26, 'a Redoubt inside its timer recovers it too');
  // a hold is its breach's
  room = null;
  assert.equal(LP.lootSpireHeld('grace'), false, 'out of the breach the timer governs');
  assert.deepEqual(LP.lootHudChips(me, 420).filter((c) => c.key === 'grace').map((c) => c.text), ['3:00']);
  T = 700; me.health = 50; hurtPlayer(me, 500);
  assert.equal(me.health, 26, 'its timer ran out: ready again outside');
  assert.equal(LP.lootSpireHeld('grace'), false, 'spent outside: nothing holds it');
  room = 'breach-2'; T = 1000; me.health = 50; hurtPlayer(me, 500);
  assert.equal(me.health, 26);
  room = 'breach-3';
  assert.equal(LP.lootSpireHeld('grace'), false, 'another breach is not the one that holds it');
});

test('EG-ZH THE GHOST-KING\'S VIGIL AT A REDOUBT (section 15): its heal under a third spent in a breach is held past its 60 s to the next Redoubt - the next crossing heals nothing, its chip reads "Redoubt"; the Redoubt recovers it; registered at the sets\' door, the Redoubt\'s word reaching both files, a power\'s recovery that throws never stopping the others (mutants: the Vigil on its timer in the Spire; the door never called)', () => {
  fresh();
  setSpireRecovery(() => 'b');
  const me = player(); wear(me, legendary('lysandus-visor'));
  hurtPlayer(me, 70);
  assert.equal(me.health, 50, 'under a third: healed a fifth');
  T = 300;
  me.health = 100; hurtPlayer(me, 70);
  assert.equal(me.health, 30, 'past its timer, held: no heal');
  assert.deepEqual(LP.lootHudChips(me, 300).filter((c) => c.key === 'vigil').map((c) => c.text), ['Redoubt']);
  let other = 0;
  registerSpireRedoubt('egz-test-throws', () => { throw new Error('x'); });
  registerSpireRedoubt('egz-test-other', () => { other++; });
  spireRedoubtTaken();
  assert.equal(other, 1, 'every registered power told, past one that throws');
  me.health = 100; hurtPlayer(me, 70);
  assert.equal(me.health, 50, 'the Redoubt recovered it');
  registerSpireRedoubt('egz-test-throws', null); registerSpireRedoubt('egz-test-other', null);
  assert.equal(spireRoomNow(), 'b');
  setSpireRecovery(() => false);
  assert.equal(spireRoomNow(), null, 'a host answering false is in no breach');
  const SRC = rd('src/systems/loot/lootPowers.js');
  assert.match(SRC, /registerSpireRedoubt\(LOOT_POWERS, lootRedoubtTaken\);/);
  assert.deepEqual({ ...LP.LOOT_SPIRE_SAVES }, { grace: 'graceReady', vigil: 'vigilReady' });
});

// ── the camera in rock ──────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZH THE CAMERA IN ROCK (player/mwView.js): the ease pulls in at once and walks back out at most the free distance each 0.25 s, never past the lane\'s own distance, a cut taking the lane\'s; laid on a lane\'s eye only while the Spire holds the camera, along the line from the focal, first person a cut; both lanes pass through it (mutants: a snap back out; the ease on the way in; the ease past the cast; the Spire\'s ease everywhere)', () => {
  assert.equal(SPIRE_CAMERA_EASE_S, 0.25);
  assert.equal(SPIRE_EOTB_FULL_M, Math.hypot(0.5, 2));
  assert.equal(spireCameraEase(null, 3, 3, 0.016), 3, 'a cut');
  assert.equal(spireCameraEase(3, 1, 3, 0.016), 1, 'in at once');
  assert.ok(Math.abs(spireCameraEase(1, 3, 3, 0.05) - (1 + (3 * 0.05) / 0.25)) < 1e-12, 'out at the free distance a quarter second');
  assert.equal(spireCameraEase(1, 3, 3, 1), 3, 'never past the lane\'s own');
  assert.equal(spireCameraEase(1, 2, 3, 0), 1, 'no time, no step');
  let on = true;
  setSpireCamera(() => on);
  const eye = (d) => ({ eye: [0, 1, -d], focal: [0, 1, 0], distance: d, thirdPerson: true });
  spireCameraFrame(eye(3), 3, 0.016);
  const pinned = spireCameraFrame(eye(0.5), 3, 0.016);
  assert.deepEqual([pinned.distance, pinned.eye], [0.5, [0, 1, -0.5]], 'against the wall: in at once');
  const freed = spireCameraFrame(eye(3), 3, 0.05);
  assert.ok(Math.abs(freed.distance - (0.5 + 0.6)) < 1e-9, `the wall gone: eased, ${freed.distance}`);
  assert.ok(Math.abs(freed.eye[2] + freed.distance) < 1e-9 && freed.eye[1] === 1, 'along the line from the focal');
  for (let i = 0; i < 4; i++) spireCameraFrame(eye(3), 3, 0.05);
  assert.equal(spireCameraFrame(eye(3), 3, 0.05).distance, 3, 'back out within 0.25 s');
  spireCameraFrame(eye(0.5), 3, 0.016);
  spireCameraFrame({ eye: [0, 1, 0], focal: null, distance: 0, thirdPerson: false }, 3, 0.016);
  assert.equal(spireCameraFrame(eye(3), 3, 0.016).distance, 3, 'first person in between: a cut');
  spireCameraFrame(eye(0.5), 3, 0.016);
  on = false;
  assert.equal(spireCameraFrame(eye(3), 3, 0.016).distance, 3, 'out of the Spire: the lane\'s own, at once');
  setSpireCamera(() => { throw new Error('x'); });
  assert.equal(spireCameraFrame(eye(3), 3, 0.016).distance, 3, 'a host that throws holds nothing');
  setSpireCamera(null);
  const V = rd('src/player/mwView.js');
  assert.match(V, /const out = eotbCamera\.eye\(\{ fpEye, feet, yaw, pitch, raycast, pivotFloor, \.\.\.frame \}\);[^\n]*\n\s*spireCameraFrame\(out, SPIRE_EOTB_FULL_M, frame\.dt \?\? 0\);/, 'the sprite\'s lane');
  assert.match(V, /const eye = mwCamera\.eye\(\{ fpEye, feet, yaw, pitch, heightScale, raycast, spherecast, pivotFloor \}\);[^\n]*\n\s*spireCameraFrame\(eye, mwCamera\.baseDistance\(\) \/ MW_UNITS_PER_METER, state\.dt \?\? 0\);/, 'the Morrowind lane');
  assert.match(rd('src/scenes/eliteGates/egClient.js'), /setSpireCamera\(\(\) => inSpire\(\) && !witness\);/, 'the breach client says when');
});

// ── the fragment's clamp ────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZH THE FRAGMENT\'S OWN CLAMP (world/eliteGates/egHall.js, sections 11.7-11.8): a passage\'s zone its cave (its floor the lower, its ceiling the vault over the higher), a chamber\'s its fragment\'s ring (a trial\'s own walled floor none); a body is a zone\'s within its footprint and 1.5 m, from 3 m under to 3 m over; the walls put it back a capsule inside, its mouths, an alcove\'s doorway, an open passage\'s sides and a ring\'s gaps let it go (mutants: the open edges held; the slack gone; the doorway walled; a gap ringed; the ring\'s radius unread)', () => {
  assert.equal(EG_CLAMP_SLACK_M, 1.5);
  const spec = egHallOf(77, 2, 0), q = spec.caves[0];
  const Z = egFragZones(spec);
  assert.deepEqual(Z, [{ t: 'passage', x: q.x, z0: q.z0, z1: q.z1, halfW: q.halfW, y: Math.min(q.y, q.yB), ceil: Math.max(q.y, q.yB) + q.height, open: 0, shaft: 0, zB: q.zB, yB: q.yB }]);   // PIN MOVED (EG-ZN): a zone carries a shaft's mark, its foot and the foot's height (world/eliteGates/egHall.js egShaftLedgeAt)
  const P = Z[0], mid = (P.z0 + P.z1) / 2;
  assert.equal(egFragZoneAt(Z, P.x, P.y, mid), P);
  assert.equal(egFragZoneAt(Z, P.x + P.halfW + 1.4, P.y, mid), P, 'within the slack');
  assert.equal(egFragZoneAt(Z, P.x + P.halfW + 1.6, P.y, mid), null, 'past it');
  assert.equal(egFragZoneAt(Z, P.x, P.y, P.z0 - 0.1), null, 'short of the mouth');
  assert.equal(egFragZoneAt(Z, P.x, P.ceil + 3.5, mid), null, 'far over the vault');
  assert.equal(egFragZoneAt(Z, P.x, P.y - 3.5, mid), null, 'far under the floor');
  const r = CAPSULE_RADIUS;
  assert.equal(egFragKeep(P, P.x + 1, mid, r, spec), null, 'inside: where it stands');
  assert.deepEqual(egFragKeep(P, P.x + P.halfW + 0.2, mid, r, spec), [P.x + P.halfW - r, mid], 'into the wall: a capsule inside it');
  assert.deepEqual(egFragKeep(P, P.x - P.halfW - 0.2, mid, r, spec), [P.x - (P.halfW - r), mid], 'either wall');
  assert.equal(egFragKeep(P, P.x + P.halfW + 0.2, P.z0 - 0.5, r, spec), null, 'past its mouth the z is never held');
  assert.equal(egFragKeep({ ...P, open: 1 }, P.x + P.halfW + 0.5, mid, r, spec), null, 'an open passage\'s sides are open edges');
  // an alcove's doorway
  let al = null, aSpec = null;
  for (let seed = 1; seed < 80 && !al; seed++) for (let h = 1; h <= 10 && !al; h++) { const s = egHallOf(seed, h, 0); const a = (s.alcoves ?? []).find((x) => s.caves.some((c) => Math.abs(Math.abs(x.x - c.x) - c.halfW) < 3 && x.z > c.z0 && x.z < c.z1)); if (a) { al = a; aSpec = s; } }
  assert.ok(al, 'a passage with an alcove');
  const AZ = egFragZones(aSpec).find((z) => z.t === 'passage' && al.z > z.z0 && al.z < z.z1);
  const side = Math.sign(al.x - AZ.x);
  assert.equal(egFragKeep(AZ, AZ.x + side * (AZ.halfW + 0.5), al.z, r, aSpec), null, 'through its doorway: let go');
  assert.deepEqual(egFragKeep(AZ, AZ.x + side * (AZ.halfW + 0.5), al.z + 3, r, aSpec), [AZ.x + side * (AZ.halfW - r), al.z + 3], 'beside it: the wall');
  // a chamber's ring
  const cs = egHallOf(77, 6, 0), wall = cs.deco.find((d) => d.t === 'wall' && d.kit);
  const C = egFragZones(cs).find((z) => z.t === 'chamber');
  assert.deepEqual(C, { t: 'chamber', x: wall.x, z: wall.z, r: wall.r, y: wall.y ?? 0, ceil: (wall.y ?? 0) + wall.h });
  const out = egFragKeep(C, C.x + C.r + 0.3, C.z, r, cs);
  assert.ok(Math.abs(out[0] - (C.x + C.r - r)) < 1e-9 && Math.abs(out[1] - C.z) < 1e-9, 'into the ring: put back inside it');
  assert.equal(egFragKeep(C, C.x, C.z + C.r + 0.3, r, cs), null, 'the gap the course goes on through');
  assert.equal(egFragKeep(C, C.x, C.z - C.r - 0.3, r, cs), null, '...and the one it came in by');
  assert.equal(egFragKeep(C, C.x + 3, C.z + 3, r, cs), null);
  assert.equal(egFragKeep(C, C.x + C.r + 1.6, C.z, r, cs), null, 'past the rim\'s slack: out of the ring, let go');
  assert.equal(egFragKeep(P, P.x + P.halfW + 0.2, P.z1 + 0.5, r, spec), null, 'past the far mouth too');
  assert.equal(egFragZones(egHallOf(77, 1, 0)).length, 0, 'open ground: no zone');
  let trial = null;
  for (let seed = 1; seed < 60 && !trial; seed++) for (let h = 1; h <= 10 && !trial; h++) { const s = egHallOf(seed, h, 0); if ((s.deco ?? []).some((d) => d.t === 'wall' && !d.kit)) trial = s; }
  assert.ok(trial, 'a trial\'s own walled floor');
  assert.equal(egFragZones(trial).filter((z) => z.t === 'chamber').length, trial.deco.filter((d) => d.t === 'wall' && d.kit).length, 'a trial\'s walls are never a fragment\'s');
});

test('EG-ZH THE FRAGMENT\'S CLAMP ON THE MOTOR (egFragArena, player/motor.js _keepInArena): the arena\'s centre on its zone\'s floor, its ceiling less the body its `ceilAbove`, its clamp in the dungeon\'s frame - the motor\'s own keep holds the feet inside the walls, takes the outward air away and holds the head under the vault (mutants: the clamp in the hall\'s frame; the ceiling unheld)', () => {
  const spec = egHallOf(77, 2, 0), P = egFragZones(spec)[0], mid = (P.z0 + P.z1) / 2;
  const at = egToDungeon(spec, P.x + P.halfW + 0.3, P.y, mid);
  const A = egFragArena(spec, at);
  assert.equal(A.zone.t, 'passage');
  assert.deepEqual(A.centre, egToDungeon(spec, P.x, P.y, mid));
  assert.ok(Math.abs(A.ceilAbove - (P.ceil - P.y - CAPSULE_HEIGHT)) < 1e-9);
  assert.equal(A.radius, 1);
  assert.equal(egFragArena(spec, egToDungeon(spec, P.x, P.y, P.z0 - 20)), null, 'out of every zone: none');
  assert.equal(egFragArena(null, at), null);
  const body = { pos: [...at], velY: 2, _airVelX: 3, _airVelZ: 0, arena: A };
  body._putBack = PlayerMotor.prototype._putBack;
  PlayerMotor.prototype._keepInArena.call(body);
  const [rx, , rz] = dungeonToRealm(...body.pos);
  assert.ok(Math.abs(rx - spec.x0 - (P.x + P.halfW - CAPSULE_RADIUS)) < 1e-9 && Math.abs(rz - mid) < 1e-9, 'put back a capsule inside the wall');
  assert.equal(body._airVelX, 0, 'the outward air taken away');
  body.pos[1] = A.centre[1] + A.ceilAbove + 2; body.velY = 3;
  PlayerMotor.prototype._keepInArena.call(body);
  assert.ok(Math.abs(body.pos[1] - (A.centre[1] + A.ceilAbove)) < 1e-9 && body.velY === 0, 'the head under the vault');
});

test('EG-ZH THE CLAMP SET ON THIS SCREEN (scenes/eliteGates/egClient.js): standing in a fragment my motor\'s arena is its zone\'s; out of every zone none; never over another arena (a duel\'s ring, a court\'s floor); taken back on the way out, and only my own (mutants: the clamp never set; another\'s arena overwritten; left on the motor out of the breach)', () => {
  const T0 = 1_800_000_000_000, ME = 'acct-0';
  const clock = T0 + EG_SEALED_MS + 60_000;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.h = 2; B.sg = 'trial'; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 };
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: { strength: 50, endurance: 50 }, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, arena: null, collider: { move: () => {} } };
  let inside = true;
  const modes = { mode: 'dungeon', egHallBreach: () => (inside ? B.b : null), egHallCircle: () => 1, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, sendEg: () => true };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0] },
    say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {} });
  client.word(validEgOut(JSON.parse(JSON.stringify(egStateOf(B, clock)))));
  const spec = egHallOf(77, 2, 0), P = egFragZones(spec)[0], mid = (P.z0 + P.z1) / 2;
  player.pos = egToDungeon(spec, P.x, P.y, mid);
  client.frame();
  assert.equal(player.arena?.zone?.t, 'passage', 'in the Stacks: its clamp');
  const mine = player.arena;
  player.pos = egToDungeon(spec, spec.arrive.x, 0, spec.arrive.z); client.frame();
  assert.equal(player.arena, null, 'on the plate: none');
  const duel = { centre: [0, 0, 0], radius: 5 };
  player.arena = duel; player.pos = egToDungeon(spec, P.x, P.y, mid); client.frame();
  assert.equal(player.arena, duel, 'another arena is never mine to replace');
  player.arena = null; client.frame();
  assert.notEqual(player.arena, null);
  void mine;
  inside = false; client.frame();
  assert.equal(player.arena, null, 'out of the breach: taken back');
  player.arena = duel; client.frame();
  assert.equal(player.arena, duel, '...and only my own');
});

// ── touch on the spans ──────────────────────────────────────────────────────────────────────────────────────────────
function stubEl() {
  return {
    id: '', textContent: '', children: [], _l: new Map(), attrs: {}, style: { cssText: '' },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    setAttribute(k, v) { this.attrs[k] = v; }, remove() { this.removed = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  };
}
const tev = (type, touches, t) => ({ type, timeStamp: t, preventDefault() {}, stopPropagation() {}, changedTouches: touches.map(([identifier, clientX, clientY]) => ({ identifier, clientX, clientY })) });
async function withTouch(fn) {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent, raf: globalThis.requestAnimationFrame };
  const keys = [];
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => stubEl(), body: stubEl() };
  globalThis.window = { ontouchstart: null, dispatchEvent: (e) => { keys.push(e); return true; }, prompt: () => null };
  globalThis.requestAnimationFrame = undefined;
  const b = createBindings();
  for (const [c, a] of [['Escape', 'Escape'], ['KeyW', 'MoveForwards'], ['KeyS', 'MoveBackwards'], ['KeyA', 'MoveLeft'], ['KeyD', 'MoveRight'], ['Space', 'Jump'], ['ShiftLeft', 'Run'], ['KeyZ', 'ReadyWeapon']]) setBinding(b, c, a);
  setBindings(b);
  let h = null;
  try { await fn(keys, (canvas, hooks) => (h = attachTouch(canvas, hooks))); } finally {
    h?.dispose?.(); setTouchSpire(null);
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k; globalThis.requestAnimationFrame = prev.raf;
    _resetForTests();
  }
}
const codes = (keys, type) => keys.filter((e) => e.type === type).map((e) => e.code);

test('EG-ZH TOUCH, THE LAW (ui/touch/touch.js, section 27.8): an upward flick is 40 px or more up within 150 ms; full throw keeps the stick\'s direction at length 1 (mutants: a flick down; a slow drag a flick; the throw\'s direction lost)', () => {
  assert.deepEqual([EG_FLICK_PX, EG_FLICK_MS], [40, 150]);
  assert.equal(egTouchFlick(400, 0, 360, 100), true);
  assert.equal(egTouchFlick(400, 0, 361, 100), false, '39 px is no flick');
  assert.equal(egTouchFlick(400, 0, 300, 151), false, 'too slow');
  assert.equal(egTouchFlick(400, 0, 450, 50), false, 'down is no flick');
  assert.deepEqual(egFullThrow({ x: 0.3, y: 0.4 }), { x: 0.6, y: 0.8 });
  assert.deepEqual(egFullThrow({ x: 0, y: 0 }), { x: 0, y: 0 });
});

test('EG-ZH TOUCH IN THE SPIRE (ui/touch/touch.js): a Jump press that keeps sliding past the tap radius looks, the drag\'s gain on it, the jump held; an upward flick on the look half jumps (Jump down, then up), once a finger; out of the Spire neither, the button TI1\'s and the flick a look (mutants: the slide never looking; looking under a window; the flick out of the Spire; twice a finger)', () => withTouch(async (keys, attach) => {
  let spire = null, paused = false;
  setTouchSpire(() => spire);
  const looks = [];
  const canvas = stubEl();
  const h = attach(canvas, { look: (dx, dy) => looks.push([dx, dy]), attack() {}, paused: () => paused });
  const jump = h.el.children.find((c) => !c.removed && c.textContent === '↑↑');
  assert.ok(jump, 'the Jump slot');
  // out of the Spire: TI1's button
  jump.fire('touchstart', tev('touchstart', [[5, 900, 560]], 0));
  jump.fire('touchmove', tev('touchmove', [[5, 860, 540]], 20));
  assert.equal(looks.length, 0, 'out of the Spire the press never looks');
  jump.fire('touchend', tev('touchend', [[5, 860, 540]], 30));
  // in the Spire
  spire = { span: false };
  jump.fire('touchstart', tev('touchstart', [[6, 900, 560]], 100));
  assert.deepEqual(codes(keys, 'keydown').slice(-1), ['Space'], 'the jump pressed');
  jump.fire('touchmove', tev('touchmove', [[6, 905, 560]], 110));
  assert.equal(looks.length, 0, 'inside the tap radius: still a press');
  jump.fire('touchmove', tev('touchmove', [[6, 905 + TAP_PX, 560]], 120));
  assert.equal(looks.length, 1, 'past it: a look');
  jump.fire('touchmove', tev('touchmove', [[6, 945, 570]], 130));
  assert.equal(looks.length, 2);
  assert.ok(looks[1][0] > 0 && looks[1][1] > 0, 'the way the finger went');
  paused = true; jump.fire('touchmove', tev('touchmove', [[6, 985, 570]], 140)); paused = false;
  assert.equal(looks.length, 2, 'never under a window');
  jump.fire('touchend', tev('touchend', [[6, 985, 570]], 150));
  assert.equal(codes(keys, 'keyup').slice(-1)[0], 'Space', 'the jump let go with the finger');
  // the flick
  const before = codes(keys, 'keydown').length, upsBefore = codes(keys, 'keyup').length;
  canvas.fire('touchstart', tev('touchstart', [[7, 800, 400]], 1000));
  canvas.fire('touchmove', tev('touchmove', [[7, 800, 380]], 1040));
  canvas.fire('touchmove', tev('touchmove', [[7, 800, 355]], 1090));
  assert.deepEqual(codes(keys, 'keydown').slice(before), ['Space'], 'an upward flick jumps');
  assert.deepEqual(codes(keys, 'keyup').slice(upsBefore), ['Space'], 'and lets go');
  canvas.fire('touchmove', tev('touchmove', [[7, 800, 300]], 1120));
  assert.equal(codes(keys, 'keydown').length, before + 1, 'once a finger');
  canvas.fire('touchend', tev('touchend', [[7, 800, 300]], 1130));
  canvas.fire('touchstart', tev('touchstart', [[8, 800, 400]], 2000));
  canvas.fire('touchmove', tev('touchmove', [[8, 800, 340]], 2200));
  assert.equal(codes(keys, 'keydown').length, before + 1, 'too slow: a look');
  canvas.fire('touchend', tev('touchend', [[8, 800, 340]], 2210));
  spire = null;
  canvas.fire('touchstart', tev('touchstart', [[9, 800, 400]], 3000));
  canvas.fire('touchmove', tev('touchmove', [[9, 800, 340]], 3050));
  assert.equal(codes(keys, 'keydown').length, before + 1, 'out of the Spire a flick is a look');
  canvas.fire('touchend', tev('touchend', [[9, 800, 340]], 3060));
}));

test('EG-ZH TOUCH ON THE SPANS (ui/touch/touch.js): the stick runs at full throw - Run held at any push past the dead zone, the analog reading at length 1 - only on the Spire\'s spans; off them RUN_THROW\'s 80% as ever (mutants: the throw full everywhere; Run never held; the analog reading partial)', () => withTouch(async (keys, attach) => {
  setPref('touchAnalogStick', true);
  let spire = { span: true };
  setTouchSpire(() => spire);
  const canvas = stubEl();
  const h = attach(canvas, { look() {}, attack() {} });
  canvas.fire('touchstart', tev('touchstart', [[1, 200, 400]], 0));
  canvas.fire('touchmove', tev('touchmove', [[1, 200, 375]], 20));
  assert.ok(codes(keys, 'keydown').includes('ShiftLeft'), 'on a span: Run at a half push');
  assert.ok(codes(keys, 'keydown').includes('KeyW'));
  const a = h.axes();
  assert.ok(Math.abs(Math.hypot(a.x, a.y) - 1) < 1e-9 && a.y > 0, `full throw: ${JSON.stringify(a)}`);
  canvas.fire('touchend', tev('touchend', [[1, 200, 375]], 30));
  assert.ok(codes(keys, 'keyup').includes('ShiftLeft'));
  keys.length = 0;
  spire = { span: false };
  canvas.fire('touchstart', tev('touchstart', [[2, 200, 400]], 100));
  canvas.fire('touchmove', tev('touchmove', [[2, 200, 375]], 120));
  assert.ok(!codes(keys, 'keydown').includes('ShiftLeft'), 'off the spans: a half push walks');
  const b = h.axes();
  assert.ok(Math.hypot(b.x, b.y) < 0.9, 'and reads its own throw');
  canvas.fire('touchmove', tev('touchmove', [[2, 200, 340]], 140));
  assert.ok(codes(keys, 'keydown').includes('ShiftLeft'), 'past 80%: Run, TI1\'s');
  canvas.fire('touchend', tev('touchend', [[2, 200, 340]], 150));
  assert.match(rd('src/scenes/eliteGates/egClient.js'), /setTouchSpire\(\(\) => \(inSpire\(\) && !witness \? \{ span: api\.onTraverse\(\) \} : null\)\);/, 'the breach client\'s word: its traversal ground');
}));
