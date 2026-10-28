// LOOT-DOOR (AUDIT HORIZONTAL B7, 2026-10-27; bible/06-Systems/Professions-Arc.md 57.8): an older build's item law drops a
// Master's work it cannot read (a made Legendary of no record), so an older build in a room's seat said a container
// without it, and every peer landed that - the piece gone. A loot room's hello says the loot its build reads (net/wire.js
// LOOT_HELLO_LAW, `ll`), and while `lootDoor` is on the relay refuses one that says less or none - GRANT-DOOR's own law.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRooms } from '../fakeRoom.mjs';
import { LOOT_HELLO_LAW, LOOT_HELLO_LAW_WIRE_MAX, LOOT_OLD_REASON, GROUND_LAW, GRANT_HELLO_LAW, lootRoom, groundRoom, parseClient, CLOSE_POLICY, RELAY_VERSION } from '../../src/net/wire.js';
import { RELAY_CFG_KEYS, RELAY_CFG_VARS, RELAY_CFG_KEY_MIN, RELAY_INTERNAL_CFG, RELAY_CFG_TTL_MS, parseRelayCfgCommand, relayCfgSupported } from '../../src/net/relayCfg.js';
import { privateInteriorPrefix, privateInteriorRoom, privateBoatRoom } from '../../src/net/privateInterior.js';
import { siegeRoomKey, royalRoomKey } from '../../src/net/siege/siegeRef.js';
import { validRoomWord, roomState, roomWord, carriedBase, judgeRoomClaim } from '../../src/systems/roomLoot.js';
import { mintPiece } from '../../src/systems/smithItems.js';
import { MASTERWORK, recipeById } from '../../src/net/recipeLaw.js';
import { MINT_V_MASTER } from '../../src/net/productRecord.js';
import { rollMasterLines, masterRecordLines } from '../../src/net/masterLaw.js';
import { mintTrophy, TROPHY_BEASTS } from '../../src/systems/hunt/trophies.js';
import { OnlineSession } from '../../src/net/online.js';

const quiet = async (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; } };
/** Main's build (4c696da8d): it says its ground, its grants and its lease - and no loot law. */
const OLDER = { gl: GROUND_LAW, gv: GRANT_HELLO_LAW, ls: 1 };
const CURRENT = { ...OLDER, ll: LOOT_HELLO_LAW };
const prefix = await privateInteriorPrefix('acct-0001', 'char-0001');
const OWNED = [privateInteriorRoom(prefix, 123456, 7), privateBoatRoom(prefix, 9)];
const BATTLES = [siegeRoomKey(1234, 7), royalRoomKey(1234, 7)];

test('LOOT-DOOR THE WIRE: a hello says `ll` 1 to LOOT_HELLO_LAW_WIRE_MAX, any other value read as none (never refused for it); the loot rooms are a world room and a cell - not a battle, an owned room or a boat, which ride the ground but carry no shared list; the setting is `lootDoor`, a relay of world272 or later takes it - main\'s MASTER-THREE world271 does not; the reason fits a close (mutants: the field dropped; the range; the rooms)', () => {
  const hello = (ll) => parseClient(JSON.stringify({ t: 'hello', id: 'mac-0001', secret: 'secret-of-mac-0001', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: null, ...(ll === undefined ? {} : { ll }) }), { hasHello: false });
  assert.equal(hello(LOOT_HELLO_LAW).ll, LOOT_HELLO_LAW);
  assert.equal(hello(LOOT_HELLO_LAW_WIRE_MAX).ll, LOOT_HELLO_LAW_WIRE_MAX, 'a later build\'s number, read');
  for (const v of [undefined, 0, -1, 1.5, '1', null, LOOT_HELLO_LAW_WIRE_MAX + 1]) {
    const h = hello(v);
    assert.equal(h.t, 'hello', `ll ${v}: still a hello`);
    assert.equal('ll' in h, false, `ll ${v}: read as none`);
  }
  for (const k of ['world:9,9', 'world:-3,12', 'dungeon:m77', 'dungeon:m77.s', 'interior:m77.3']) assert.equal(lootRoom(k), true, k);
  for (const k of [...BATTLES, ...OWNED]) assert.deepEqual([groundRoom(k), lootRoom(k)], [true, false], `${k}: a ground room, no loot room`);
  for (const k of ['chat:world', 'party:abc', '', null]) assert.equal(lootRoom(k), false, String(k));
  assert.ok(new TextEncoder().encode(LOOT_OLD_REASON).length <= 123, 'a close reason past 123 bytes throws, and the socket is never closed');
  assert.ok(RELAY_CFG_KEYS.includes('lootDoor'));
  assert.equal(RELAY_CFG_VARS.lootDoor, 'LOOT_DOOR');
  assert.deepEqual(parseRelayCfgCommand('lootdoor on'), { cmd: 'relay', k: 'lootDoor', v: 'on' });
  assert.equal(RELAY_CFG_KEY_MIN.lootDoor, 273);   // world273: main's FIELD BUGS 2026-10-26r took world272 at the merge
  assert.deepEqual([relayCfgSupported('world272', 'lootDoor'), relayCfgSupported('world276', 'lootDoor'), relayCfgSupported(RELAY_VERSION, 'lootDoor')], [false, true, true]);   // PIN MOVED: world276, SHARED-HEALTH (the open zone, a duel and a siege referee the health of the player as a share - the vit frame; world270 on its branch, renumbered past later relay releases at the merges; NOT YET DEPLOYED); PIN MOVED: world275, SHARED-HEALTH (the open zone, a duel and a siege referee the health of the player as a share - the vit frame; world270, then world274, then world274, on its branch, renumbered past CHAT-POST, MASTER-THREE and RPT1026 at the merges; NOT YET DEPLOYED); PIN MOVED: world274, LADDER-CUT (systems/skillSoftcap.js, a file the bundle reaches; NOT YET DEPLOYED)
});

test('LOOT-DOOR THE NUMBER READS WHAT IT SAYS: 1 is a Master\'s work and a Mounted Trophy, each minted by its producer - both ride a room\'s stored word whole at this build, where main\'s law drops the one and cannot read the other', () => {
  const lines = masterRecordLines(rollMasterLines(recipeById('longsword:daedric'), ['damage', 'stat:strength', 'elemental:fire'], 4242));
  const work = mintPiece({ recipe: 'longsword:daedric', quality: MASTERWORK, seed: 4242, maker: 'Mac', marked: true, version: MINT_V_MASTER, lines }, 'a1b2c3d4e5f60718');
  const trophy = mintTrophy(TROPHY_BEASTS[0], { nameIndex: 0 });
  assert.equal(LOOT_HELLO_LAW, 1);
  const base = carriedBase([mintPiece({ recipe: 'dagger:iron', quality: 1, seed: 7 }, 'b1b2c3d4e5f60718')]);
  const st = roomState({ g: 1, lv: 10, n: 1, tm: 0, h: base.h });
  st.base = base;
  for (const [i, piece] of [work, trophy].entries()) assert.equal(judgeRoomClaim(st, 1, base.full, { id: `peer:s1:${i + 1}`, it: JSON.parse(JSON.stringify(piece)) }), 1);
  const heard = validRoomWord(JSON.parse(JSON.stringify(roomWord('container:7', st, base.h, { s: st.stored, si: st.ids }, null, [], base.records))));
  assert.deepEqual(heard.s.map((it) => [it.rarity ?? null, it.templateIndex]), [['legendary', work.templateIndex], [null, trophy.templateIndex]]);
});

test('LOOT-DOOR THE RELAY\'S DOOR, through real Rooms: off, the current build and main\'s are let in; a developer turns it on at the hub (on and off alone); the hub lets anyone in; a cold cell lets the current build in without asking, asks before its first older hello and refuses it with the words every build shows, nothing written - a dungeon\'s and a building\'s room too; a later build is let in; turned off, a cell lets it in again inside a TTL (mutants: the room unread; the law unread; the cold ask unawaited; the setting unread; the door not shut)', async () => {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const W = fakeRooms({ now: () => clock });
      const H = W.room('chat:world');
      const join = async (R, id, extra = {}) => { const ws = R.connect(); clock += 300; await R.hello(ws, id, null, extra); return ws; };
      const roster = (R) => R.sockets.filter((s) => s.att?.id).map((s) => s.att.id);
      const A = W.room('world:9,9');
      assert.equal((await join(A, 'new-0000', CURRENT)).closed, null, 'off: the current build stands in the cell');
      assert.equal((await join(A, 'old-0001', OLDER)).closed, null, 'off: and main\'s build beside it');
      const dev = await join(H, 'dev-0001', { glyphs: ['dev'] });
      const say = async (k, v) => { clock += 5000; await H.raw(dev, JSON.stringify({ t: 'cfg', k, v })); return dev.sent.filter((f) => f.t === 'cfg').at(-1); };
      assert.match((await say('lootDoor', 'yes')).error, /lootDoor is on .* or off/);
      assert.deepEqual(await say('lootDoor', 'on'), { t: 'cfg', k: 'lootDoor', v: 'on' });
      assert.equal((await join(H, 'old-0002')).closed, null, 'the hub holds no loot: anyone in');
      let asked = 0;
      const fetch0 = H.room.fetch.bind(H.room);
      H.room.fetch = (req) => { if (new URL(req.url).pathname === RELAY_INTERNAL_CFG) asked++; return fetch0(req); };
      const B = W.room('world:10,10');
      assert.equal((await join(B, 'new-0001', CURRENT)).closed, null, 'the current build is let in');
      assert.equal(asked, 0, 'and asks the hub nothing');
      const old = await join(B, 'old-0003', OLDER);
      assert.equal(asked, 1, 'the cold room asked before it answered');
      assert.deepEqual(old.closed, { code: CLOSE_POLICY, reason: LOOT_OLD_REASON });
      assert.equal(old.sent.at(-1).t, 'error');
      assert.match(old.sent.at(-1).m, /^This copy of the game is older than the world online\. Update it to play online/, 'GROUND-GATE\'s own words');
      assert.deepEqual(roster(B), ['new-0001'], 'nothing of the older hello written');
      assert.deepEqual((await join(B, 'old-0004', { ...OLDER, ll: 0 })).closed, { code: CLOSE_POLICY, reason: LOOT_OLD_REASON }, 'an `ll` the wire reads as none is none');
      assert.equal((await join(B, 'next-0001', { ...OLDER, ll: LOOT_HELLO_LAW + 1 })).closed, null, 'a later build is let in');
      for (const key of ['dungeon:m77', 'interior:m123456.7']) {
        assert.deepEqual((await join(W.room(key), `old-${key.length}`, OLDER)).closed, { code: CLOSE_POLICY, reason: LOOT_OLD_REASON }, `${key}: a world room holds containers`);
      }
      assert.deepEqual(await say('lootDoor', 'off'), { t: 'cfg', k: 'lootDoor', v: 'off' });
      clock += RELAY_CFG_TTL_MS;
      await join(B, 'old-0005', OLDER);   // asks again, unawaited - this hello rides the answer it holds
      await new Promise((r) => setImmediate(r));
      assert.equal((await join(B, 'old-0006', OLDER)).closed, null, 'off again: let in');
    });
  } finally { Date.now = realNow; }
});

test('LOOT-DOOR THE CLIENT: a hello to a loot room says the loot this build reads, to the room it goes to (a halo cell\'s too); the hub\'s, a battle\'s and an owned room\'s say none (mutants: the field dropped; the room read off the session)', () => {
  const s = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: class {}, now: () => 0 });
  s.room = 'chat:world';
  for (const k of ['world:9,9', 'dungeon:m77', 'interior:m77.3']) assert.equal(s._helloFrame(null, k).ll, LOOT_HELLO_LAW, `${k}: the room it goes to, not the session's`);
  for (const k of [undefined, ...BATTLES, ...OWNED]) assert.equal('ll' in s._helloFrame(null, k), false, `${k ?? 'the hub'}: none`);
  s.room = 'world:9,9';
  assert.equal(s._helloFrame(null).ll, LOOT_HELLO_LAW);
});
