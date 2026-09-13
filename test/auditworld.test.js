// AUDIT WORLD (Mac, 2026-09-12: "Lets audit everything so far") - four
// opus lenses over MAC6, MAC7, OD1 and WORLD1 (the relay and the wire;
// the client's world half; the peer's arm and the doll; the pins and
// the record), every finding refuted twice and fixed on the PR. THE
// FIXES EXECUTE: the relay over the one fake (a large frame answered
// before any parse and metered - A1; the prefix admits the size and
// the type keeps the cap - A2; a world room is a map id's and its
// memory is forgotten WORLD_TTL_MS after the last drain unless someone
// is in - A3; a reconnect keeps the host's seat - A4 - and the floor is
// the room's stamp in storage - A5; the farewell admitted once inside
// the floor - B5; the put and the tail's delete one write - A6); the
// session (the farewell's mark, worlds minted at birth - D12); the
// peer's body over an ordered fake rig (the doors in order - D3; a
// refused strike kept PENDING_FRAMES and played once - C3; the loose
// after a held draw is release alone, a redraw in the same pose after
// it - C4; the arrow waits for a quiet arm and lands as the rig took it
// - C5/C6; a body out of range or lingering replays nothing - C7); the
// hosts by source (the stamp and the once - B1/B7; the layout's run -
// B2; the drops the save's alone - B3; the species - B4; the dungeon's
// death farewell - B6; the room hold - B8; the refusal said once - B9;
// the boot's one "Game loaded." - B10; the mode's rig for the arm -
// C1; the sheathed cast - C2) and the record's struck sentences (D2,
// D6, D7, D8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseClient, isWorldRoom, WORLD_PREFIX, WORLD_TTL_MS, MAX_FRAME_BYTES, PIXEL_UNITS, CLOSE_REPLACED } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';
import { PeerBodies, PENDING_FRAMES, BODY_RANGE } from '../src/net/peerBodies.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const welcomeOf = (ws) => ofType(ws, 'welcome')[0];
const stored = (r) => { const meta = r.store.get('world:meta'); return meta ? JSON.parse(Array.from({ length: meta.chunks }, (_, i) => r.store.get('world:' + i)).join('')) : null; };

test('AUDIT WORLD A: the relay - a large frame is the host\'s memory or nothing, refused with no hello, ignored UNPARSED for anyone else and metered like a pose (A1); the prefix admits the size and the type keeps the cap (A2); a world room is a map id\'s, and its memory is forgotten WORLD_TTL_MS after the last drain unless someone is in (A3); a reconnect keeps the host\'s seat (A4) and the floor is the room\'s stamp (A5); the farewell is admitted once inside the floor, the host\'s alone (B5); the put and the tail\'s delete are one write (A6)', async () => {
  // A2 at the wire: JSON's last duplicate key wins, so the prefix alone was a 512 KiB pass for every type
  const bypass = '{"t":"world","pad":"' + 'x'.repeat(MAX_FRAME_BYTES * 2) + '","t":"pose","p":{"x":0,"y":0,"z":0,"yaw":0,"pitch":0}}';
  assert.ok(bypass.startsWith(WORLD_PREFIX) && JSON.parse(bypass).t === 'pose', 'the mutant frame');
  assert.deepEqual(parseClient(bypass, { hasHello: true }), { error: 'frame too large' }, 'A2: the type keeps the cap');
  for (const t of ['chat', 'hello', 'ping']) assert.deepEqual(parseClient('{"t":"world","pad":"' + 'x'.repeat(MAX_FRAME_BYTES * 2) + '","t":"' + t + '"}', { hasHello: true }), { error: 'frame too large' }, t);
  // A3: the key is a map id's
  assert.equal(isWorldRoom('dungeon:m187'), true); assert.equal(isWorldRoom('dungeon:m12345678'), true);
  for (const k of ['dungeon:187', 'dungeon:m', 'dungeon:m123456789', 'dungeon:smoke', 'dungeon:3.privateers-hold', 'dungeon:m187x', 'dungeon:M187', 'dungeon:m187/x']) assert.equal(isWorldRoom(k), false, k);
  assert.equal(relay.WORLD_TTL_MS, WORLD_TTL_MS, 'one home'); assert.equal(WORLD_TTL_MS, 30 * 24 * 3600 * 1000);
  // A1: the door before the parse
  const r = fakeRoom('dungeon:m187');
  const a = r.connect(), b = r.connect(), cold = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1)); await r.hello(b, 'bbbb-0002', at(1, 1));
  await r.raw(cold, WORLD_PREFIX + 'x'.repeat(MAX_FRAME_BYTES));
  assert.deepEqual(cold.sent.at(-1), { t: 'error', m: 'world before hello' }, 'no hello: refused'); assert.equal(cold.closed?.code, 1008);
  await r.raw(b, WORLD_PREFIX + 'x'.repeat(MAX_FRAME_BYTES));
  assert.equal(b.closed, null, 'a non-host\'s large frame: ignored'); assert.equal(ofType(b, 'error').length, 0, 'and never parsed - the junk after the prefix never errs');
  assert.ok(b.att.bucket, 'but metered: the pose bucket was spent on it');
  let n = 0; while (!b.closed && n++ < 400) await r.raw(b, WORLD_PREFIX + 'x'.repeat(100));
  assert.deepEqual(b.sent.at(-1), { t: 'error', m: 'too many poses' }, 'A1: a stream of them strikes the socket out like a pose flood');
  await r.raw(a, WORLD_PREFIX + 'x'.repeat(100));
  assert.deepEqual(a.sent.at(-1), { t: 'error', m: 'not JSON' }, 'the host\'s own is parsed - and its junk is terminal');
  // B5, A4, A5: a fresh room
  const r2 = fakeRoom('dungeon:m9');
  const h = r2.connect(), j = r2.connect();
  await r2.hello(h, 'host-0001', at(1, 1)); await r2.hello(j, 'join-0002', at(1, 1));
  const w = (n) => ({ locationKey: 'dungeon:1', world: { foes: Array.from({ length: n }, (_, i) => ({ health: i })) } });
  await r2.world(h, w(1)); assert.deepEqual(stored(r2), w(1));
  await r2.world(h, w(2)); assert.deepEqual(stored(r2), w(1), 'inside the floor: dropped');
  await r2.world(h, w(2), { final: true }); assert.deepEqual(stored(r2), w(2), 'B5: the farewell is admitted inside the floor');
  await r2.world(h, w(3), { final: true }); assert.deepEqual(stored(r2), w(2), 'once per socket');
  await r2.world(j, w(3), { final: true }); assert.deepEqual(stored(r2), w(2), 'and never a non-host\'s');
  const since = h.att.since;
  const h2 = r2.connect(); await r2.hello(h2, 'host-0001', at(1, 1));
  assert.equal(h.closed?.code, CLOSE_REPLACED, 'replaced'); assert.equal(h2.att.since, since, 'A4: the first hello\'s stamp rides the reconnect');
  assert.equal(welcomeOf(h2).host, 'host-0001', 'the seat kept'); assert.equal(ofType(j, 'host').length, 0, 'and nothing said to the peer: nothing changed');
  await r2.world(h2, w(3)); assert.deepEqual(stored(r2), w(2), 'A5: still inside the floor - the stamp is the room\'s, a reconnect resets nothing');
  await r2.world(h2, w(3), { final: true }); assert.deepEqual(stored(r2), w(3), 'a new socket has its own farewell');
  // A3: the drain arms the alarm; it fires into an empty room and forgets, into a room with someone in and keeps
  await r2.drop(j); assert.equal(r2.alarm.at, null, 'not the last out: no alarm');
  const t0 = Date.now(); await r2.drop(h2);
  assert.ok(r2.alarm.at >= t0 + WORLD_TTL_MS && r2.alarm.at <= Date.now() + WORLD_TTL_MS, 'the last out arms WORLD_TTL_MS');
  const back = r2.connect(); await r2.hello(back, 'back-0003', at(1, 1));
  assert.deepEqual(welcomeOf(back).world, w(3), 'the memory stands');
  await r2.fire(); assert.equal(r2.store.has('world:meta'), true, 'the alarm finds someone in: the world kept');
  await r2.drop(back); r2.wake(); await r2.fire();
  assert.equal([...r2.store.keys()].some((k) => k.startsWith('world:')), false, 'the alarm finds the room empty: the memory forgotten');
  const town = fakeRoom('town:m9'); const t = town.connect(); await town.hello(t, 'town-0001', at(1, 1)); await town.drop(t);
  assert.equal(town.alarm.at, null, 'a town arms nothing');
  // A1 and A6 by source
  const room = rd('server/src/index.js');
  assert.match(room, /if \(typeof message === 'string' && \(message\.length > MAX_FRAME_BYTES \|\| message\.startsWith\(WORLD_PREFIX\) \|\| message\.startsWith\(FOES_PREFIX\)\)\) \{\s*const foesLike = message\.startsWith\(FOES_PREFIX\);\s*if \(!a\.id\) \{ this\._refuse\(ws, foesLike \? 'foes before hello' : 'world before hello'\); return; \}[\s\S]*?if \(!isWorldRoom\(a\.key\) && message\.length > MAX_FRAME_BYTES\) \{ this\._refuse\(ws, 'frame too large'\); return; \}\s*a = foesLike \? this\._meterFoes\(ws, a, Date\.now\(\)\) : this\._meter\(ws, a, Date\.now\(\)\);\s*if \(!a\) return;\s*if \(!isWorldRoom\(a\.key\) \|\| a\.id !== this\._hostOf\(\)\) \{[\s\S]*?const junk = \(a\.junk \?\? 0\) \+ 1;[\s\S]*?if \(junk > DROP_STRIKES_MAX\) this\._refuse\(ws, 'too many frames'\);\s*return;\s*\}\s*doored = foesLike \? 'foes' : 'world';\s*\}\s*const m = parseClient\(/, 'A1: the door before the parse (WORLD2: the foes frame through it on its own bucket; AUDIT WORLD2 A3/A4/A7: the prefix remembered, a large frame refused outside a world room, a non-host\'s stream struck out, the refusal named right)');
  assert.match(room, /const ops = \[this\.state\.storage\.put\(puts\)\];\s*if \(old && old\.chunks > chunks\) ops\.push\(this\.state\.storage\.delete\(/, 'A6: the put and the tail\'s delete issued together');
  assert.match(room, /await Promise\.all\(ops\);/, 'and awaited together');
  assert.doesNotMatch(room, /worldAt/, 'A5: no stamp on the socket');
});


test('AUDIT WORLD: the session - a farewell rides sendWorld as final, t first (the relay\'s door reads the prefix), and an ordinary publish carries no mark (B5); worlds is minted at birth (D12)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  assert.equal(s.stats.worlds, 0, 'D12: declared, not lazily minted');
  s.join('dungeon:m187', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', world: null });
  assert.equal(s.sendWorld({ a: 1 }), true);
  assert.equal(ws.sent.at(-1), '{"t":"world","data":{"a":1}}', 'no mark');
  assert.equal(s.sendWorld({ a: 2 }, { final: true }), true);
  assert.equal(ws.sent.at(-1), '{"t":"world","data":{"a":2},"final":true}', 'the farewell, t first');
  assert.ok(ws.sent.at(-1).startsWith(WORLD_PREFIX));
  assert.equal(s.stats.worlds, 2);
});

/** MWBODY1's fake rig with every door in ONE ordered log (AUDIT WORLD D3), refusals and readiness on tap. */
function rigFactory(log) {
  return () => {
    const r = { cam: null, mode: 'first', updates: [], calls: [], refuse: 0, ready: true, weaponOk: true, sheathedNow: undefined, spellNow: undefined, unloaded: false,
      attach(renderer, cam) { r.cam = cam; },
      async build(opts) { r.opts = opts; log.builds++; return { ok: true }; },
      canThirdPerson: () => true,
      setViewMode(m) { r.mode = m; return true; },
      thirdActive: () => r.mode === 'third' && r.updates.length > 0,
      update(dt) { r.updates.push(dt); },
      drawThird() { return r.thirdActive(); },
      unload() { r.unloaded = true; },
      raceHeightScale: () => 1,
      setSheathed(v) { if (r.sheathedNow === v) return false; r.sheathedNow = v; r.calls.push(['sheathed', v]); return true; },
      attack(strike, { hold = false } = {}) { r.calls.push(['attack', strike, hold]); if (r.refuse > 0) { r.refuse--; return null; } return 'chop'; },
      release() { r.calls.push(['release']); return false; },
      setWeapon(item, { hasAmmo = false } = {}) { r.calls.push(['weapon', hasAmmo]); return r.weaponOk; },
      readySpell(v) { if (r.spellNow === v) return false; r.spellNow = v; r.calls.push(['spell', v]); return true; },
      castSpell(rangeType) { r.calls.push(['cast', rangeType]); return true; },
      upperBodyReady: () => r.ready,
    };
    log.rigs.push(r);
    return r;
  };
}
const ARM0 = { wd: 0, an: 0, as: 0, am: 0, sr: 0, cn: 0, cr: 0 };
const shown = (x, arm = {}) => ({ x, y: 0, z: -10, yaw: 0, pitch: 0, mv: 0, ...ARM0, ...arm });
const BOW = { templateIndex: 4, group: 'Weapons', material: 1, equipSlot: EQUIP_SLOTS.RightHand };
const peer = (id, s, items = [BOW]) => ({ id, name: id, look: { race: 'Nord', gender: 'male', faceIndex: 0, items }, shown: s });
const toScene = (p) => [p.x, p.y, p.z];
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
const attacks = (r) => r.calls.filter((c) => c[0] === 'attack');

test('AUDIT WORLD C: the peer\'s body - the doors in ORDER, sheathed before the strike before the release (D3); a strike the rig refuses is kept PENDING_FRAMES and played once when it takes, then dropped (C3); the count after a held draw is its loose - release plays it, nothing is queued, and a redraw in the same pose follows the release (C4); the arrow waits for a quiet arm and lands only as the rig took it (C5/C6); a body out of range or lingering re-latches its counts and replays nothing on waking (C7)', async () => {
  const log = { builds: 0, rigs: [] };
  let now = 1000;
  const pb = new PeerBodies({ renderer: {}, createRig: rigFactory(log), now: () => now, warn: () => {} });
  const near = [0, 0, 0];
  const p = peer('p1', shown(3));
  pb.sync([p], toScene, 0.016, near); await settle(); pb.sync([p], toScene, 0.016, near);
  const r = log.rigs[0]; assert.equal(r.mode, 'third');
  // D3: draw AND swing in one pose - the sheath opens first, the strike follows, the release comes last
  r.calls.length = 0;
  p.shown = shown(3, { wd: 1, an: 1, as: 3 }); pb.sync([p], toScene, 0.016, near);
  const names = r.calls.map((c) => c[0]);
  assert.ok(names.indexOf('sheathed') >= 0 && names.indexOf('sheathed') < names.indexOf('attack') && names.indexOf('attack') < names.indexOf('release'), `D3: sheathed, then the strike, then release - got ${names.join(',')}`);
  assert.deepEqual(r.calls.filter((c) => c[0] === 'sheathed'), [['sheathed', false]]);
  assert.deepEqual(attacks(r), [['attack', 'StrikeLeft', false]]);
  // C3: refused three frames (the equip in flight), taken on the fourth, then quiet
  r.calls.length = 0; r.refuse = 3;
  p.shown = shown(3, { wd: 1, an: 2, as: 3 });
  for (let i = 0; i < 6; i++) pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(attacks(r), Array(4).fill(['attack', 'StrikeLeft', false]), 'C3: asked until taken - three refusals, one strike, then nothing');
  r.calls.length = 0; r.refuse = 1e9;
  p.shown = shown(3, { wd: 1, an: 3, as: 3 });
  for (let i = 0; i < PENDING_FRAMES + 20; i++) pb.sync([p], toScene, 0.016, near);
  assert.equal(attacks(r).length, PENDING_FRAMES, 'refused for ever: PENDING_FRAMES asks and no more');
  r.refuse = 0;
  // C4: the bow - a held draw; a loose AND a redraw in one pose; the loose alone
  r.calls.length = 0;
  p.shown = shown(3, { wd: 2, an: 4, as: 6 }); pb.sync([p], toScene, 0.016, near);   // as 6: StrikeUp, the draw
  assert.deepEqual(r.calls, [['attack', 'StrikeUp', true]], 'held: the draw, and no release while wd is 2');
  r.calls.length = 0;
  p.shown = shown(3, { wd: 2, an: 5, as: 6 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.calls, [['release'], ['attack', 'StrikeUp', true]], 'C4: the loose let go, THEN the next draw - in one pose');
  r.calls.length = 0;
  p.shown = shown(3, { wd: 1, an: 6, as: 1 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.calls, [['release']], 'the loose alone: release plays the shot and nothing is queued (a queued strike shot twice once the arm came back)');
  pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.calls, [['release'], ['release']], 'and the next frame asks no strike');
  // C5/C6: the arrow
  r.calls.length = 0; r.ready = false;
  p.shown = shown(3, { wd: 1, an: 6, as: 1, am: 1 }); pb.sync([p], toScene, 0.016, near);
  assert.equal(r.calls.some((c) => c[0] === 'weapon'), false, 'C5: the arm is busy - the arrow waits');
  r.ready = true; r.weaponOk = false; pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.calls.filter((c) => c[0] === 'weapon'), [['weapon', true]], 'quiet: asked');
  pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.calls.filter((c) => c[0] === 'weapon'), [['weapon', true], ['weapon', true]], 'C6: refused - asked again, not committed');
  r.weaponOk = true; pb.sync([p], toScene, 0.016, near); pb.sync([p], toScene, 0.016, near);
  assert.equal(r.calls.filter((c) => c[0] === 'weapon').length, 3, 'taken - and not again');
  // C7: out of range the counts move on; back in range nothing is replayed
  r.calls.length = 0;
  const far = [BODY_RANGE * 3, 0, 0];
  p.shown = shown(3, { wd: 1, an: 9, as: 1, am: 1 }); pb.sync([p], toScene, 0.016, far);
  p.shown = shown(3, { wd: 1, an: 10, as: 1, am: 1 }); pb.sync([p], toScene, 0.016, far);
  pb.sync([p], toScene, 0.016, near);
  assert.equal(attacks(r).length, 0, 'C7: what happened out of sight is not replayed');
  pb.sync([], toScene, 0.016, near); now += 1000; pb.sync([], toScene, 0.016, near);   // gone from the room, lingering
  p.shown = shown(3, { wd: 1, an: 12, as: 1, am: 1 }); pb.sync([p], toScene, 0.016, near); pb.sync([p], toScene, 0.016, near);
  assert.equal(attacks(r).length, 0, 'a body that lingered re-latches on the way back');
  p.shown = shown(3, { wd: 1, an: 13, as: 1, am: 1 }); pb.sync([p], toScene, 0.016, near);
  assert.equal(attacks(r).length, 1, 'and the next real count swings');
});

test('AUDIT WORLD: the hosts by source - the dungeon host stamps its memory and applies one once (B1/B7), carries and reads the species (B4), keeps the drops the save\'s alone (B3), says its death and its rig (B6/C1) and its one "Game loaded." (B10); the mode machine names the live rig and the death screen (C1/B6); the world host publishes into a world room alone as a farewell when forced and says a refusal once (B5/B8/B9) and gates the dead on the mode\'s slot (B6); the arm casts sheathed (C2); the body re-latches on the linger (C7); the record\'s false sentences are gone (D2/D6/D7/D8)', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /const _sharedStamp = Math\.random\(\)\.toString\(36\)\.slice\(2\);/, 'B1: the stamp'); assert.match(d, /let _sharedApplied = false;/, 'B7: the once');
  assert.match(d, /mobileType: f\.mobileType,\s*gender: f\.gender,[^\n]*\n\s*maxHealth: f\.entity\.maxHealth,/, 'B4: the record carries the species (WORLD3: and the gender)');
  assert.match(d, /if \(!f\) return;\s*if \(sf\.mobileType != null && sf\.mobileType !== f\.mobileType\) \{[^\n]*\n\s*(?:\/\/[^\n]*\n\s*)*retypeFoe\(i, sf\.mobileType, sf\.gender \?\? null\)[^\n]*\n\s*return;/, 'B4: another species at the index is never patched blind (WORLD3: rebuilt as the record\'s own, on both paths since AUDIT WORLD3 E1)');
  assert.match(d, /if \(truncate\) droppedLoot\.restorePiles\(w\.droppedLoot\);/, 'B3: the clearing restore is the save\'s alone');
  assert.match(d, /deathUp: \(\) => activeOverlay instanceof DeathScreen,/, 'B6: the dungeon says its death');
  assert.match(d, /restoreSaved\(extras, setPlayerPos, \{ session = true, announce = session \} = \{\}\) \{/, 'B10'); assert.match(d, /if \(announce\) hudText\.add\('Game loaded\.'\);/, 'B10: once');
  assert.match(d, /weaponRig: \(\) => weaponRig,/, 'C1: the dungeon\'s rig at the API');
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /liveArm\(\) \{\s*const rig = mode === 'interior' \? interiorWeapon : mode === 'dungeon' \? \(dungeonCtx\?\.weaponRig\?\.\(\) \?\? null\) : null;\s*if \(!rig\) return null;\s*return \{ rig, armed: !!\(mode === 'dungeon' \? dungeonCtx\?\.spellArmed\?\.\(\) : magic\?\.spellArmed\(\)\) \};\s*\},/, 'C1: the mode names the live rig and the stance');
  assert.match(m, /deathUp\(\) \{ return mode === 'dungeon' \? !!dungeonCtx\?\.deathUp\?\.\(\) : interiorOverlay instanceof DeathScreen; \},/, 'B6: the mode names the death screen');
  const w = rd('src/scenes/world.js');
  assert.match(w, /instanceof DeathScreen \|\| modes\?\.deathUp\?\.\(\)\) \{ if \(online\.room\) \{ worldPublish\(now, true\); online\.leave\(\); \}/, 'B6: the dungeon\'s death farewell');
  assert.match(w, /online\.status !== 'open' \|\| !isWorldRoom\(online\.room\)\) return false;/, 'B8: a world room alone');
  assert.match(w, /if \(!shared\) return false;\s*_worldPublishedAt = now;\s*const ok = online\.sendWorld\(shared, \{ final: force \}\);\s*if \(!ok\) console\.warn\(/, 'B5/B9: forced is the farewell; the clock stamped before the send');
  const o = rd('src/net/online.js');
  assert.match(o, /reconnects: 0, chats: 0, worlds: 0, foes: 0, hits: 0, acts: 0 \};/, 'D12 (WORLD3: and the acts)'); assert.doesNotMatch(o, /nothing is shared but presence/, 'D2: the module\'s head');
  const fp = rd('src/combat/fpArm.js');
  assert.match(fp, /if \(upper !== UPPER_BODY\.WeaponEquipped && upper !== UPPER_BODY\.Casting && !\(upper === UPPER_BODY\.None && sheathed\)\) return false;/, 'C2: the sheathed arm casts');
  assert.match(fp, /case UPPER_BODY\.Casting:[\s\S]*?upper = sheathed \? UPPER_BODY\.None : UPPER_BODY\.WeaponEquipped;/, 'C2: and comes back to None');
  assert.match(fp, /const from = upper;[^\n]*\n\s*upper = UPPER_BODY\.Casting;[\s\S]*?upper = from;/, 'C2: a range the group cannot answer stands where it came from');
  assert.match(fp, /if \(!want && upper === UPPER_BODY\.Casting\) \{ actionState = null; actionSource = null; upper = sheathed \? UPPER_BODY\.None : UPPER_BODY\.WeaponEquipped; \}/, 'C2: an un-ready mid-cast too');
  const pb = rd('src/net/peerBodies.js');
  assert.doesNotMatch(pb, /a peer's drawn bow shows no arrow/, 'D7: the build doc');
  assert.match(pb, /if \(b\.goneAt == null\) \{ b\.goneAt = now; b\.swing = null; b\.pending = null; \}/, 'C7: the linger re-latches');
  assert.match(pb, /\} else if \(b\.swing != null\) \{ b\.swing = peer\.shown\.an \| 0; b\.cast = peer\.shown\.cn \| 0; b\.pending = null; \}/, 'C7: out of range the counts follow');
  const wire = rd('src/net/wire.js');
  assert.match(wire, /A pose is \{x, y, z, yaw, pitch, mv, wd, an, as, am, sr, cn, cr\}/, 'D11');
  // the record
  const arc = rd('bible/06-Systems/Online-Arc.md');
  assert.doesNotMatch(arc, /the only thing shared is presence/, 'D2: the arc\'s head'); assert.doesNotMatch(arc, /none of the\nsharing/, 'D2');
  assert.doesNotMatch(arc, /a peer's arrows never show/, 'D7'); assert.match(arc, /`test\/online\.test\.js` \(9\)/, 'D8');
  assert.match(arc, /## AUDIT WORLD \(2026-09-12\)/, 'the section');
  const mp = rd('bible/11-Multiplayer/Multiplayer.md');
  assert.doesNotMatch(mp, /It holds no game\s+state beyond the roster/, 'D6'); assert.doesNotMatch(mp, /Host migration is a\s+later slice/, 'D6');
  assert.doesNotMatch(mp, /Host migration \(a client becomes host when the host drops\)\. Later\./, 'D6'); assert.doesNotMatch(mp, /Sessions are ephemeral;/, 'D6');
  assert.doesNotMatch(rd('bible/Home.md'), /shipped presence alone/, 'D2'); assert.doesNotMatch(rd('bible/Home.md'), /nothing stored/, 'D2');
  assert.doesNotMatch(rd('bible/01-Overview/Port-Ledger.md'), /only PRESENCE is shared/, 'D2');
  assert.doesNotMatch(rd('server/wrangler.toml'), /It stores nothing past\n# the connection/, 'the worker\'s own head');
});
