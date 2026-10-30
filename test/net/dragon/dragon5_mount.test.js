// DRAGON5 (bible/11-Multiplayer/Dwarven-Dragon.md section 10): THE TAMED DRAGON AS A MOUNT - its item (systems/dragon/
// dragonMount.js) bound to the pack and held by the judge to its tame's row (server-account/src/judge.js judgeDragons); the
// third mount (systems/transport.js TRANSPORT_MODES.Dragon) ridden as a horse with no hooves; its flight on the real motor
// (systems/dragon/dragonFlight.js, player/dragonRide.js): jump held TAKEOFF_HOLD_S takes it up, 25 m/s where the rider
// looks, the ground lands it; its rows in both transport pickers; its pose; its tame bound into the pack. tools/mutants/dragon5.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DRAGON_MOUNT_TEMPLATE, DRAGON_MOUNT_ONLINE, newDragonMount, hasDragon, dragonMountOf, dragonLookOfItem, dragonMountWellFormed } from '../../../src/systems/dragon/dragonMount.js';
import { createDragonFlight, TAKEOFF_HOLD_S, DRAGON_FLY_SPEED, LEVITATE_PACE, DRAGON_LAND_AFTER_S, DRAGON_GLIDE_SINK } from '../../../src/systems/dragon/dragonFlight.js';
import { dragonAloft, onDragonFlight, _resetDragonFlight, DRAGON_CATCH_S, DRAGON_SET_DOWN_SINK } from '../../../src/player/dragonRide.js';
import { createDragonSaddle } from '../../../src/player/dragonSaddle.js';
import { TRANSPORT_MODES, isRiding, isHorseRide, toggleMount, rideBaseFor, DF_RIDE_BASE } from '../../../src/systems/transport.js';
import { PlayerMotor, LEVITATE_MOVE_SPEED, flySpeedMult } from '../../../src/player/motor.js';
import { Collider } from '../../../src/player/collider.js';
import { itemFindings, ITEM_LAW_VERSION, itemWorth } from '../../../src/systems/item/itemLaw.js';
import { templateByIndex } from '../../../src/systems/item/itemTemplates.js';
import { isBound, isPackOnly } from '../../../src/systems/item/itemBound.js';
import { TransportWindow, TRANSPORT_RECTS, transportPanelOrigin } from '../../../src/ui/transportWindow.js';
import { PORT_SPECS } from '../../../src/ui/enhanced/enhancedPorts.js';
import { RidingAnimator } from '../../../src/systems/riding.js';
import { createMountRig } from '../../../src/player/mountRig.js';
import { judgeSave, judgeDragons } from '../../../server-account/src/judge.js';
import { dragonPoseRide, noteDragonRelay, _resetDragonRide as _resetStaffRide, DRAGON_POSE_RIDE } from '../../../src/systems/staffDragon.js';
import { DRAGON_RIDE_RELAY_MIN } from '../../../src/net/wire.js';
import { d1 } from '../../accountDb.mjs';
import { createGuest } from '../../../server-account/src/accounts.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ID = 'dg0123456789abcdef';

test('DRAGON5 the item: a Transportation piece of its own template, bound to the pack and worth nothing to the measure; the law takes a tame\'s id and look on it alone and an item law of 15 (mutants: a dragon sellable; its id on a sword; a forged id lawful)', () => {
  const row = templateByIndex(DRAGON_MOUNT_TEMPLATE);
  assert.equal(row?.name, 'Dwarven Dragon');
  const it = newDragonMount({ id: ID, look: 1 });
  assert.deepEqual([it.group, it.templateIndex, it.dragonId, it.dragonLook], ['Transportation', DRAGON_MOUNT_TEMPLATE, ID, 1]);
  assert.equal(newDragonMount({ id: ID }).dragonLook, undefined, 'the brass carries no look');
  assert.equal(isBound(it), true);
  assert.equal(isPackOnly(it), true, 'not even the wagon or storage');
  assert.equal(itemWorth(it), 0);
  assert.deepEqual(itemFindings(it), []);
  assert.deepEqual(itemFindings({ ...it, dragonId: 'not-a-tame' }), ['dragon']);
  assert.deepEqual(itemFindings({ ...it, dragonLook: 2 }).includes('dragon') || itemFindings({ ...it, dragonLook: 2 }).includes('field'), true);
  assert.ok(itemFindings({ group: 'Weapons', templateIndex: 0, dragonId: ID }).includes('dragon'));
  assert.equal(ITEM_LAW_VERSION, 16);   // PIN MOVED (GILDED-MAKER): law 16 - the item maker's rows on a Gilded piece lawful (15 on its branch, renumbered past DRAGON5's 15 at the merge)
  assert.equal(dragonMountWellFormed(it), true);
  assert.equal(hasDragon([{ templateIndex: 94 }, it]), true);
  assert.equal(dragonMountOf([it]), it);
  assert.equal(dragonLookOfItem(it), 1);
  assert.equal(DRAGON_MOUNT_ONLINE, true, 'REST6: the release after the row shipped binds a tame online');   // PIN MOVED (DRAGON-ON)
});

test('DRAGON5 the third mount: Dragon is riding (the ride base, the door, no climb, no crouch) but no horse ride (no sprite, hooves or voices); a key mounts the horse first, the cart next, the dragon last (mutants: the dragon a horse ride; the key preferring the dragon)', () => {
  assert.equal(isRiding(TRANSPORT_MODES.Dragon), true);
  assert.equal(isHorseRide(TRANSPORT_MODES.Dragon), false);
  assert.equal(isHorseRide(TRANSPORT_MODES.Horse) && isHorseRide(TRANSPORT_MODES.Cart), true);
  assert.equal(rideBaseFor(TRANSPORT_MODES.Dragon), DF_RIDE_BASE, 'on the ground, ridden as a horse');
  const d = newDragonMount({ id: ID });
  assert.equal(toggleMount(TRANSPORT_MODES.Foot, [d]), TRANSPORT_MODES.Dragon);
  assert.equal(toggleMount(TRANSPORT_MODES.Foot, [d, { templateIndex: 94 }]), TRANSPORT_MODES.Horse);
  assert.equal(toggleMount(TRANSPORT_MODES.Dragon, [d]), TRANSPORT_MODES.Foot);
  const r = new RidingAnimator().update(1 / 60, { mode: TRANSPORT_MODES.Dragon });
  assert.equal(r.playing, false, 'no clop under a dragon');
  assert.match(src('src/systems/immersiveFootsteps.js'), /if \(isRiding\(m\.transportMode\)\) footstepTimer = 0;/, 'and no footsteps');
});

test('DRAGON5 the flight\'s law: jump held TAKEOFF_HOLD_S takes it up (a breath less does not, nor a winded dragon); aloft the pace is 25 m/s of the motor\'s levitation and the ground lands it after DRAGON_LAND_AFTER_S; a winded one sinks; off the dragon it lands (mutants: the hold; the winded takeoff; the landing at once; the pace)', () => {
  assert.equal(TAKEOFF_HOLD_S, 0.4);
  assert.equal(DRAGON_FLY_SPEED, 25);
  assert.equal(LEVITATE_PACE, LEVITATE_MOVE_SPEED, 'the law\'s pace is the motor\'s own');
  const f = createDragonFlight();
  const on = { mounted: true, jump: true, grounded: true };
  for (let i = 0; i < 39; i++) assert.equal(f.step(0.01, on), null);
  assert.equal(f.aloft(), false, 'a breath short of the hold');
  assert.equal(f.step(0.011, on), 'took-off');
  assert.equal(f.flyMult(), DRAGON_FLY_SPEED / LEVITATE_PACE);
  assert.equal(f.step(DRAGON_LAND_AFTER_S / 2, { mounted: true, jump: false, grounded: true }), null, 'the takeoff clears the ground it left');
  assert.equal(f.step(DRAGON_LAND_AFTER_S, { mounted: true, jump: false, grounded: true }), 'landed');
  assert.equal(f.flyMult(), 1);
  const w = createDragonFlight();
  for (let i = 0; i < 60; i++) w.step(0.01, { ...on, winded: true });
  assert.equal(w.aloft(), false, 'a winded dragon cannot take off');
  assert.equal(w.lift(), true);
  w.step(0.01, { mounted: true, jump: false, grounded: false, winded: true });
  assert.equal(w.sink(), DRAGON_GLIDE_SINK);
  assert.equal(w.step(0.01, { mounted: false, jump: false, grounded: false }), 'landed', 'a dismount lands it');
});

test('DRAGON5 the flight on the real motor: held jump up, 25 m/s forward aloft, a dive to the ground lands it, a cliff ridden off is caught (mutants: the ride step unheard; the pace unregistered; the catch)', () => {
  _resetDragonFlight();
  const heard = [];
  onDragonFlight((w) => heard.push(w));
  const m = new PlayerMotor(new Collider(() => 0));
  m.pos = [0, 0, 0]; m.grounded = true;
  m.setTransportMode(TRANSPORT_MODES.Dragon);
  const input = (o) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...o });
  const step = (n, o) => { for (let i = 0; i < n; i++) { m.levitating = dragonAloft(); m.update(1 / 60, input(o), 0, 0); } };
  step(10, {});
  step(30, { jump: true, up: true });
  assert.equal(dragonAloft(), true);
  assert.equal(flySpeedMult(), DRAGON_FLY_SPEED / LEVITATE_PACE);
  const z0 = m.pos[2];
  step(60, { forward: 1 });
  assert.ok(Math.abs(m.pos[2] - z0 - DRAGON_FLY_SPEED) < 0.01, `a second aloft: ${(m.pos[2] - z0).toFixed(2)} m`);
  step(300, { down: true });
  assert.equal(dragonAloft(), false, 'the ground met lands it');
  assert.deepEqual(heard, ['took-off', 'landed']);
  // a dragon caught falling spreads its wings
  const c = new PlayerMotor(new Collider(() => -1000));
  c.pos = [0, 0, 0]; c.grounded = false;
  c.setTransportMode(TRANSPORT_MODES.Dragon);
  for (let i = 0; i < Math.ceil(DRAGON_CATCH_S * 60) + 2; i++) { c.levitating = dragonAloft(); c.update(1 / 60, input({}), 0, 0); }
  assert.equal(dragonAloft(), true, 'caught');
  _resetDragonFlight();
  // AUDIT DRAGON: off it in the air (a flag's dismount, Foot picked) the rider is set down - never dropped - and jump
  // held slows the sink, never stops it
  const s = new PlayerMotor(new Collider(() => 0));
  s.pos = [0, 0, 0]; s.grounded = true;
  s.setTransportMode(TRANSPORT_MODES.Dragon);
  const fly = (n, o) => { for (let i = 0; i < n; i++) { s.levitating = dragonAloft(); s.update(1 / 60, input(o), 0, 0); } };
  fly(30, { jump: true, up: true }); fly(120, { up: true });
  const high = s.pos[1];
  assert.ok(high > 20, `up ${high.toFixed(1)} m`);
  s.setTransportMode(TRANSPORT_MODES.Foot);
  let worst = 0;
  const down = (o) => { s.levitating = dragonAloft(); s.update(1 / 60, input(o), 0, 0); worst = Math.max(worst, s.landedFallDistance || 0); };
  for (let i = 0; i < 1800 && !s.grounded; i++) down({ jump: true, up: true });
  assert.equal(s.grounded, true, 'set down, jump held or not');
  down({}); down({});   // the motor lands a fall the step after the ground meets it
  assert.equal(worst, 0, 'no fall');
  assert.equal(dragonAloft(), false, 'and on the ground, on foot');
  assert.equal(DRAGON_SET_DOWN_SINK, 2);
  _resetDragonFlight();
  assert.match(src('src/scenes/shared.js'), /\|\| staffFly\(\) \|\| freeFlight\(\) \|\| dragonAloft\(\);/, 'the hosts\' levitation term');
});

test('DRAGON5 the pickers: the classic window draws the Dragon row under its art for an owner alone and a click on it rides; the enhanced picker lists it; the rig rides no dragon it does not hold (mutants: the row for anyone; the click unheard; a save\'s Dragon with none held)', () => {
  const picked = [];
  const none = new TransportWindow({ hasHorse: false, hasCart: false, onMode: (m) => picked.push(m) });
  assert.equal(none.enabled.dragon, false);
  const o = transportPanelOrigin(null);
  const [x, y] = TRANSPORT_RECTS.dragon;
  none.click(o.x + x + 2, o.y + y + 2);
  assert.deepEqual(picked, [], 'no dragon, no row');
  const w = new TransportWindow({ hasHorse: false, hasCart: false, hasDragon: true, onMode: (m) => picked.push(m) });
  w.click(o.x + x + 2, o.y + y + 2);
  assert.deepEqual(picked, [TRANSPORT_MODES.Dragon]);
  const view = PORT_SPECS.transport.view({ enabled: { horse: false, cart: false, ship: false, dragon: true }, _pick: (m) => picked.push(m), input() {} });
  const row = view.blocks[0].items.find((i) => i.label === 'Dwarven Dragon');
  assert.ok(row);
  row.act();
  assert.equal(picked.at(-1), TRANSPORT_MODES.Dragon);
  assert.equal(PORT_SPECS.transport.view({ enabled: { dragon: false }, _pick() {}, input() {} }).blocks[0].items.length, 4);
  const calls = [];
  const player = { grounded: true, transportMode: TRANSPORT_MODES.Foot, standing: true, setTransportMode(m) { calls.push(m); this.transportMode = m; } };
  const entity = { items: [] };
  const rig = createMountRig({ renderer: {}, canvas: {}, fetchBytes: async () => { throw new Error('none'); }, palette: null, audio: { playOneShot() {}, setLoop() {} }, player, playerEntity: entity, showOverlay() {} });
  rig.setMode(TRANSPORT_MODES.Dragon);
  assert.deepEqual(calls, [TRANSPORT_MODES.Foot], 'none held: on foot');
  entity.items.push(newDragonMount({ id: ID }));
  rig.setMode(TRANSPORT_MODES.Dragon);
  assert.equal(player.transportMode, TRANSPORT_MODES.Dragon);
  assert.match(src('src/player/mountRig.js'), /hasDragon: hasDragon\(playerEntity\.items \?\? \[\]\),/);
});

test('DRAGON5 the saddle, one home: both pictures asked once, drawn as wide as the screen - its firing picture when asked - and the Admin\'s ride draws through it (mutants: the firing picture ignored; the staff host\'s own copy)', async () => {
  const asked = [], drawn = [];
  const renderer = { uploadTexture: (_k, name) => name, drawScreenQuad: (tex, rect) => drawn.push([tex, rect.w]), withUiTarget: undefined };
  const s = createDragonSaddle({ renderer, load: async (u) => { asked.push(u); return { width: 200, height: 50 }; } });
  s.loadArt(); s.loadArt();
  await new Promise((r) => setImmediate(r));
  assert.equal(asked.length, 2);
  assert.equal(s.loaded(), true);
  const canvas = { width: 640, height: 400 };
  s.draw(canvas, true);
  assert.equal(drawn.at(-1)?.[0], 'dragon:saddle-1');
  s.draw(canvas);
  assert.equal(drawn.at(-1)?.[0], 'dragon:saddle-0');
  // PIN MOVED (DRAGON-BLUE): the Admin's ride hands the saddle its look, the Aetherbright's colours (was: `{ renderer, load }`)
  assert.match(src('src/scenes/staffDragonHost.js'), /const saddle = createDragonSaddle\(\{ renderer, load, look: dragonRideLook \}\);/);
  assert.match(src('src/player/mountRig.js'), /if \(player\.transportMode === TRANSPORT_MODES\.Dragon && !ridePaused\) saddle\.draw\(canvas\);/);
});

test('DRAGON5 the judge: every dragon a save holds against the service\'s tames - its id drawn for this account and character in this look, held once (mutants: any id lawful; another character\'s tame; a second copy)', async () => {
  const db = d1();
  const { subtle } = globalThis.crypto;
  const acct = (await createGuest({ db, subtle, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: 1_800_000_000 }, { deviceLabel: null })).id;
  db._raw.prepare('INSERT INTO dragon_mounts (id, account, char_id, look, watch, at) VALUES (?, ?, ?, ?, ?, ?)').run(ID, acct, 'char-0001', 1, 500_004, 1);
  const save = { level: 10, items: [newDragonMount({ id: ID, look: 1 })] };
  const judged = judgeSave(save, null);
  assert.deepEqual(judged.dragons, [{ id: ID, look: 1 }]);
  assert.deepEqual(await judgeDragons(db, judged.dragons, acct, 'char-0001'), []);
  assert.equal((await judgeDragons(db, judged.dragons, acct, 'char-0002'))[0]?.code, 'dragon-tame', 'another character');
  assert.equal((await judgeDragons(db, [{ id: ID, look: 0 }], acct, 'char-0001')).length, 1, 'another look');
  assert.equal((await judgeDragons(db, [{ id: ID, look: 1 }, { id: ID, look: 1 }], acct, 'char-0001')).length, 1, 'held twice');
  assert.equal((await judgeDragons(db, [{ id: 'dgffffffffffffffff', look: 0 }], acct, 'char-0001')).length, 1, 'never drawn');
  assert.match(src('server-account/src/verdict.js'), /const tames = judged\.dragons\.length \? await judgeDragons\(db, judged\.dragons, player, char\) : \[\];/);
  assert.match(src('server-account/src/verdict.js'), /const law = judged\.count \+ products\.length \+ tames\.length \+ ledger\.forged\.length;/);
});

test('DRAGON5 the pose: a tamed dragon\'s rider is the wire\'s Dragon ride on a relay that keeps it, its look its own (mutants: the mount\'s ride unsent; the look the horse\'s)', () => {
  _resetStaffRide();
  assert.equal(dragonPoseRide('Dragon'), null, 'a relay before the gate');
  noteDragonRelay(`world${DRAGON_RIDE_RELAY_MIN}`);
  assert.equal(dragonPoseRide('Dragon'), DRAGON_POSE_RIDE);
  assert.equal(dragonPoseRide('Horse'), null);
  _resetStaffRide();
  const w = src('src/scenes/world.js');
  assert.ok(w.includes('rd: dragonPoseRide(riding ? player.transportMode : null) ??'));
  assert.ok(w.includes('rc: riding ? (player.transportMode === TRANSPORT_MODES.Dragon ? dragonLookOfItem(dragonMountOf(playerEntity.items)) : riddenHorseLook('));
});

test('DRAGON5 the bind: a tame the service drew becomes its character\'s Dwarven Dragon in the pack, said once and let go - one a character; another character\'s waits for its stand-up; with the online switch off it waits (mutants: bound with the switch off; a second dragon; another character\'s bound here)', async () => {
  const { createDragonRewards } = await import('../../../src/scenes/dragonRewards.js');
  const { playerEntity } = await import('../../../src/characters/playerEntity.js');
  const { DRAGON_CLAIM_TEXT } = await import('../../../src/systems/dragon/dragonWords.js');
  const storage = new Map();
  const rewardsStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  const said = [];
  const was = { items: playerEntity.items, id: playerEntity.characterId };
  playerEntity.items = []; playerEntity.characterId = 'char-0001';
  try {
    const host = { rewardsStorage, takeSpoil: (p) => p.item && playerEntity.items.push(p.item), relayNowS: () => 0, chatNotice: (t) => said.push(t), dragonAccount: { me: () => null, claim: async () => ({ ok: false, error: 'offline' }) } };
    const off = createDragonRewards({ ...host, dragonMountOnline: false });   // PIN MOVED (DRAGON-ON): the switch off by hand - it is on
    rewardsStorage.setItem('dragon4.tamed', JSON.stringify([{ id: ID, look: 1, character: 'char-0001', w: 1 }, { id: 'dg1111111111111111', look: 0, character: 'char-0002', w: 2 }]));
    assert.equal(off.bind('char-0001'), false, 'the switch off: it waits');
    assert.equal(playerEntity.items.length, 0);
    const on = createDragonRewards({ ...host, dragonMountOnline: true });
    assert.equal(on.bind('char-0002'), false, 'not the one standing');
    assert.equal(on.bind('char-0001'), true);
    assert.deepEqual(playerEntity.items.map((i) => [i.templateIndex, i.dragonId, i.dragonLook]), [[DRAGON_MOUNT_TEMPLATE, ID, 1]]);
    assert.deepEqual(on.tames().map((t) => t.id), ['dg1111111111111111'], 'its own let go, the other kept');
    assert.deepEqual(said, [DRAGON_CLAIM_TEXT.bound()]);
    assert.equal(on.bind('char-0001'), false, 'one a character');
    assert.equal(playerEntity.items.length, 1);
    rewardsStorage.setItem('dragon4.tamed', JSON.stringify([{ id: 'dg2222222222222222', look: 0, character: 'char-0001', w: 3 }]));
    assert.equal(on.bind('char-0001'), false, 'a second tame for a character that holds one: no second dragon');
    assert.equal(playerEntity.items.length, 1);
    assert.deepEqual(on.tames(), [], 'and it is let go');
  } finally { playerEntity.items = was.items; playerEntity.characterId = was.id; }
});

test('AUDIT DRAGON the rig hears the flight: its takeoff the dragon\'s roar an octave down, its landing the body\'s thud pitched down, on the mount\'s volume (mutants: the flight unheard)', () => {
  _resetDragonFlight();
  const shots = [];
  const player = { grounded: true, transportMode: TRANSPORT_MODES.Foot, standing: true, setTransportMode(m) { this.transportMode = m; } };
  createMountRig({ renderer: {}, canvas: {}, fetchBytes: async () => { throw new Error('none'); }, palette: null, audio: { playOneShot: (clip, vol, pitch) => shots.push([clip, pitch]), setLoop() {} }, player, playerEntity: { items: [] }, showOverlay() {} });
  const m = new PlayerMotor(new Collider(() => 0));
  m.pos = [0, 0, 0]; m.grounded = true;
  m.setTransportMode(TRANSPORT_MODES.Dragon);
  const input = (o) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...o });
  for (let i = 0; i < 40; i++) { m.levitating = dragonAloft(); m.update(1 / 60, input({ jump: true, up: true }), 0, 0); }
  for (let i = 0; i < 300; i++) { m.levitating = dragonAloft(); m.update(1 / 60, input({ down: true }), 0, 0); }
  assert.deepEqual(shots.map((s) => s[1]), [0.5, 0.6], 'the takeoff, then the landing');
  _resetDragonFlight();
});
