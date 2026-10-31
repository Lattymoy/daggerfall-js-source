// STOREFRONT, THE WIRE AUDIT (2026-10-29; bible/06-Systems/Storefront.md section 10): the worn effects on the wire, read
// cold. A peer could place a kill anywhere; a peer stood again from memory wore no effects; the Others' choice said it
// covered mount looks and did not; a kill rode every pose for the session; a kill my screen did not draw was never told;
// a relay rollback had no floor; GLYPHS' order became a contract nothing held; my glyphs stood in another order than the
// room's; two pages named the pose's kill fields wrong; and the attachment's widest was never the widest. A pin each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createPeerFxPlayer, noteMyKill, poseFx, _resetPeerFxForTests, KILL_FX_SAY_M, KILL_FX_PEER_M, PEER_POSE_EASE_M, BLOW_PEER_M,
  KILL_FX_RIDE_S,
} from '../../src/net/peer/peerFx.js';
import { bindPeerEffects, othersEffectShown, KILL_FX_NEAR_M } from '../../src/net/peer/peerEffects.js';
import { peerMountLook } from '../../src/systems/horse/mountLook.js';
import { horseLookOfCode } from '../../src/systems/horse/horseCoats.js';
import { KFX_FAR_M } from '../../src/render/killFx.js';
import { PORTAL_PEER_REACH, PORTAL_SAY_REACH } from '../../src/systems/portalStone.js';
import { ARROW_FLIGHT_SPEED, MISSILE_LIFESPAN_S } from '../../src/systems/spellcast.js';
import { TECHNIQUES } from '../../src/combat/technique/techniqueRoster.js';
import { OnlineSession, GAP_MAX_MS } from '../../src/net/online.js';
import { validPose, slimPose, POSE_BOUND, POSE_Y_BOUND, RELAY_VERSION } from '../../src/net/wire.js';
import { GLYPHS, glyphsInOrder, glyphBitsOf, glyphsOfBits } from '../../src/net/identityToken.js';
import { glyphsOf } from '../../server-account/src/titles.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { reportPlayerKill } from '../../src/systems/playerKills.js';
import '../../src/systems/killEffects.js';   // my kill effect's listener, as the game registers it
import { SESSION_KEY } from '../../src/net/accountClient.js';
import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const quiet = (/** @type {() => any} */ fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const toScene = (p) => [p.x, p.y, p.z];
const door = (o = {}) => setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, ...o });

test('THE WIRE AUDIT 1: a peer\'s kill plays only where it could have told it - within its own draw\'s reach of its drawn feet and a portal\'s ease; a blow only within its farthest shaft; no feet, neither - and a griefer 700 m off puts not one pyre in my face (mutants: the kill\'s reach unread; the blow\'s; the reach from a fresh number)', () => {
  assert.equal(KILL_FX_SAY_M, KFX_FAR_M, 'told as far as the killer\'s own screen draws a kill effect');
  assert.equal(PEER_POSE_EASE_M, PORTAL_PEER_REACH - PORTAL_SAY_REACH, 'the pose\'s ease a peer\'s portal has');
  assert.equal(KILL_FX_PEER_M, KFX_FAR_M + PEER_POSE_EASE_M);
  assert.equal(BLOW_PEER_M, ARROW_FLIGHT_SPEED * MISSILE_LIFESPAN_S * TECHNIQUES.pierce.speed + PEER_POSE_EASE_M, 'a Piercing Shot\'s whole flight');
  let t = 0;
  const played = [], blows = [];
  door({ killFx: (look, at) => played.push({ look, at }), eye: () => [500, 1.6, 500] });
  const fx = createPeerFxPlayer({ toScene, now: () => t, play: { blow: ({ at }) => blows.push(at) } });
  // the audit's killspam: a peer at the origin says a new kill at my face, 700 m off, on every pose for ten seconds
  for (let i = 0; i < 200; i++) {
    fx.update('grief', validPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, xk: i + 1, xp: [500, 0, 501], xh: 120, hk: i + 1, hp: [500, 1, 501] }), [0, 0, 0], 1.8, 'c00');
    fx.frame(); t += 0.05;
  }
  assert.deepEqual([played.length, blows.length], [0, 0], 'no pyre, no blood, at a stranger\'s face');
  const kill = (n, xp, feet) => {
    const pose = validPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, xk: n, xp, hk: n, hp: xp });
    fx.update('p1', pose, feet, 1.8, 'c00'); fx.frame(); t += 1;
    fx.update('p1', pose, feet, 1.8, 'c00'); fx.frame(); t += 1;   // seen on every frame, as the host's walk does - and its due play played
  };
  kill(1, [0, 0, 0], [0, 0, 0]);   // first sight: nothing
  kill(2, [KILL_FX_PEER_M - 0.5, 0, 0], [0, 0, 0]);
  assert.equal(played.length, 1, 'at the reach\'s edge, it plays');
  kill(3, [KILL_FX_PEER_M + 0.5, 0, 0], [0, 0, 0]);
  assert.equal(played.length, 1, 'just past it, refused');
  kill(4, [1, 0, 0], null);
  assert.equal(played.length, 1, 'no feet to measure from: refused');
  assert.equal(blows.length, 2, 'the blows at the kill\'s edge and past it land - inside the shaft\'s reach');
  kill(5, [BLOW_PEER_M + 0.5, 0, 0], [0, 0, 0]);
  assert.equal(blows.length, 2, 'a blow past the farthest shaft, refused');
  setPlayerDoor(null);
});

test('THE WIRE AUDIT 2: a peer\'s effects kit is kept with its id, as its armory kit is - read of an id no room holds, and worn by the peer stood again from memory (mutants: the memory losing it; the re-stood peer bare)', () => quiet(() => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
  s.join('world:2,12', pose); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'peer-0002', name: 'Ember', ak: 'aaaa0', fx: 'c0a', pose }], host: null, world: null });
  assert.equal(s.effectsOf('peer-0002'), 'c0a', 'off the introduction');
  sockets[0].receive({ t: 'leave', id: 'peer-0002' });
  assert.equal(s.peers.has('peer-0002'), false);
  assert.equal(s.effectsOf('peer-0002'), 'c0a', 'an introduction is a fact about an id, kept - a gate\'s owner gone from the room still wears its skin');
  sockets[0].receive({ t: 'pose', id: 'peer-0002', p: { ...pose, x: 4 } });
  assert.equal(s.peers.get('peer-0002')?.fx, 'c0a', 'the memory carries it onto the re-stood peer');
}));

test('THE WIRE AUDIT 3: the Others\' effects choice covers a peer\'s mount look as its note says - its horse\'s dye and its beat; none shows neither, near only within its reach of my eye, a horse it cannot place never (mutants: the dye ungated; the beat ungated; near with no place shown)', () => {
  bindPeerEffects((id) => (id === 'p2' ? '00a' : null));
  door({ eye: () => [0, 1.6, 0] });
  const look = (at) => horseLookOfCode(peerMountLook('p2', 0, at)).mount;
  assert.equal(look([3, 0, 0]), 1, 'all: the warhorse');
  setPref('killFxOthers', 'none');
  assert.equal(look([3, 0, 0]), undefined, 'none: its coat alone');
  setPref('killFxOthers', 'near');
  assert.equal(look([KILL_FX_NEAR_M - 1, 0, 0]), 1, 'near: one close');
  assert.equal(look([KILL_FX_NEAR_M + 2, 0, 0]), undefined, 'near: not one past it');
  assert.equal(look(null), undefined, 'near: not one it cannot place');
  assert.equal(othersEffectShown([0, 0, 0]), true);
  let t = 0;
  const beats = [];
  door({ eye: () => [0, 1.6, 0], burst: (recipe) => { beats.push(recipe); return true; } });
  const fx = createPeerFxPlayer({ toScene, now: () => t });
  const ride = (feet) => { for (let i = 0; i < 40; i++) { fx.update('r1', { x: 0, y: 0, z: 0, rd: 1, mv: 2, yaw: 0 }, feet, 1.8, '00a'); fx.frame(); t += 0.05; } };
  ride([KILL_FX_NEAR_M + 5, 0, 0]);
  assert.equal(beats.length, 0, 'near: no beat under a far rider');
  ride([2, 0, 0]);
  assert.ok(beats.length > 0, 'near: a close rider\'s beat');
  setPref('killFxOthers', 'none');
  beats.length = 0;
  ride([2, 0, 0]);
  assert.equal(beats.length, 0, 'none: no beat');
  setPref('killFxOthers', 'all');
  bindPeerEffects(null);
  setPlayerDoor(null);
  assert.match(rd('src/systems/features.js'), /'Whose kill effects and mount looks are shown\. Near shows the players close to you\. Your own always show\.'/, 'the note says what is done');
});

test('THE WIRE AUDIT 4: a kill rides one far listener\'s wait of poses and then leaves them - a pose at rest is the bytes it was - and the second wire rounds its place and a blow\'s as the pose\'s own, in the room\'s units (mutants: a kill that rides for ever; a place unrounded)', () => {
  assert.equal(KILL_FX_RIDE_S, GAP_MAX_MS / 1000, 'the longest a listener waits for a moving peer\'s pose');
  _resetPeerFxForTests();
  const toWire = (q) => q;
  assert.equal(noteMyKill([10, 0, 10], 1.8, [0, 0, 0], 100), true);
  assert.equal(poseFx(toWire, 100).xk, 1);
  assert.equal(poseFx(toWire, 100 + KILL_FX_RIDE_S).xk, 1, 'still riding at the window\'s end');
  assert.deepEqual(poseFx(toWire, 100 + KILL_FX_RIDE_S + 0.01), {}, 'then gone: the pose at rest carries nothing');
  noteMyKill([10, 0, 10], 1.8, [0, 0, 0], 200);
  assert.equal(poseFx(toWire, 200.5).xk, 2, 'the next kill is a new count');
  _resetPeerFxForTests();
  const far = (b) => -(b - 0.012345678901234);
  const at = [far(POSE_BOUND), far(POSE_Y_BOUND), far(POSE_BOUND)];
  const p = validPose({ x: 1, y: 2, z: 3, yaw: 0, pitch: 0, xk: 65535, xp: at, xh: 120, hk: 65535, hp: at, hb: 1, hq: 1 });
  const scene = slimPose(p, 'dungeon:m187'), native = slimPose(p, 'world:2,12');
  for (const k of ['xp', 'hp']) {
    assert.deepEqual(scene[k], [slimPose({ x: at[0] }, 'dungeon:m187').x, slimPose({ y: at[1] }).y, slimPose({ z: at[2] }, 'dungeon:m187').z], `${k}: to the centimetre, as a scene's x, y and z`);
    assert.deepEqual(native[k], [Math.round(at[0]), Math.round(at[1] * 100) / 100, Math.round(at[2])], `${k}: whole world units across, the centimetre up, as a cell's`);
    assert.deepEqual(validPose({ ...p, [k]: native[k] })[k], native[k], `${k}: what a reader takes back`);
  }
});

test('THE WIRE AUDIT 5: my kill is told by the wire\'s own reach from my feet, whatever my screen drew - a draw refused still tells it; one past the reach no peer would play is not told (mutants: told only when drawn; told from anywhere)', () => {
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'a1', name: 'Me', kind: 'linked', sessionId: 's', secret: 'x', effects: 'c00' })]]);
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem() {}, removeItem() {}, length: 1, key: () => SESSION_KEY };
  _resetPeerFxForTests();
  const drawn = [];
  door({ feet: () => [0, 0, 0], killFx: (look, at) => { drawn.push(look); return false; } });   // my screen draws none (too far from my eye)
  reportPlayerKill({}, { kind: 'arrow', fx: { at: [KILL_FX_SAY_M - 1, 0, 0], h: 1.8, w: 0.8, batch: null } });
  assert.deepEqual(drawn, ['pyre'], 'my draw was asked');
  assert.equal(poseFx((q) => q).xk, 1, 'and the others are told though it drew nothing');
  reportPlayerKill({}, { kind: 'arrow', fx: { at: [KILL_FX_SAY_M + 1, 0, 0], h: 1.8, w: 0.8, batch: null } });
  assert.equal(poseFx((q) => q).xk, 1, 'past the reach no peer believes: not told');
  door({ feet: () => null, killFx: () => true });
  reportPlayerKill({}, { kind: 'melee', fx: { at: [1, 0, 0], h: 1.8, w: 0.8, batch: null } });
  assert.equal(poseFx((q) => q).xk, 1, 'no feet of mine to tell it from: not told');
  setPlayerDoor(null);
  _resetPeerFxForTests();
  delete globalThis.localStorage;
});

test('THE WIRE AUDIT 6 and 9: the relay\'s rollback floor is written where a deploy reads it, and the pose\'s kill fields are named as the code names them - `xk`, `xp`, `xh` (mutants: the floor unsaid)', () => {
  const version = rd('src/net/wire.js').split('\n').find((l) => l.startsWith('export const RELAY_VERSION = '));
  assert.equal(RELAY_VERSION, 'world298');   // PIN MOVED: world298, LEGIBLE (the relay files formatted - the same program, new bytes); PIN MOVED: world297, STOREFRONT (world295 on its branch, renumbered past GUILD-SHOP and FIELD BUGS 2026-10-30b at the merge of main at 82d76daff); PIN MOVED: world295, STOREFRONT (world283, world286, world288, world289, world290, world291, world293 then world294 on its branch, renumbered past FB1029 GROUND, FRONTS, DRAGON, HAND-WRAPS, PVP-LINGER, GILDED-GLOW, DELVE II, PVP-VITALS, WYRM-RIDER and DRAGON-HARDER at the merges of main); PIN MOVED: world288, STOREFRONT (world283 then world286 on its branch, renumbered past FB1029 GROUND and FRONTS at the merge of main at 05cf1838d); PIN MOVED: world286, STOREFRONT (world283 on its branch, renumbered past PVP-SAFE-HIT, AUDIT TAMRIEL-WIDE and CAPE-TOGGLE at the merge)
  assert.match(version, /ROLLBACK FLOOR: world297 while acct230 or later mints `gb`/);
  const storefront = rd('src/net/wire.js').split('\n').find((l) => l.startsWith('// world297: STOREFRONT'));   // PIN MOVED: world298, LEGIBLE - world297's note is a history line under the version now
  assert.match(storefront, /a pose's kill \(`xk`, `xp`, `xh`\)/);
  const page = rd('bible/06-Systems/Storefront.md');
  assert.match(page, /\*\*Deploy, and the rollback floor\.\*\*/);
  assert.match(page, /world297 is the relay's floor while acct230 or later mints/);
  assert.match(page, /\(`xk`,\n`xp`, `xh`\)/, 'section 4 names them as section 10 does');
  for (const [where, text] of [['wire.js', version], ['wire.js world297', storefront], ['Storefront.md', page], ['relayversion.test.js', rd('test/net/relayversion.test.js')]]) assert.doesNotMatch(text, /`kc`, `kp`, `ks`/, `${where}: \`kc\` is a sea receipt's killer (world246), never the pose's kill`);
});

/** The glyphs the token's mask was first signed over (STOREFRONT, world286) - their places are the mask's meaning. */
const MASKED = Object.freeze(['sprout', 'dev', 'mod', 'dm', 'disciple', 'apostle', 'hierophant', 'shadowfang', 'penitent', 'herald', 'tower', 'crownDF', 'crownWR', 'crownSN', 'laurel', 'aegis', 'primarch', 'crystalfist', 'wikimaid', 'nirnrootsage', 'crownSK', 'crownMW', 'crownSU', 'crownVW', 'crownEW', 'crownBM', 'crownCY', 'origin', 'oblivion', 'gatesigil', 'gearcrown', 'tonalfork', 'cog']);

test('THE WIRE AUDIT 7: GLYPHS is appended, never reordered - the places the token\'s `gb` mask was first signed over are frozen (mutants: a glyph inserted mid-list)', () => {
  assert.deepEqual(GLYPHS.slice(0, MASKED.length), [...MASKED],
    'GLYPHS IS APPENDED, NEVER REORDERED. A token\'s `gb` mask (identityToken.js glyphBitsOf) and every socket\'s packed attachment read a glyph by its PLACE in this list, so a glyph inserted or moved hands every outstanding token, for the whole relay-first deploy, other glyphs - `dev`, `mod` and `dm` among them. Add a new glyph at the end.');
  assert.equal(glyphBitsOf(['dev', 'mod']), '6', 'the developer\'s and the moderator\'s bits');
  assert.deepEqual(glyphsOfBits('6'), ['dev', 'mod']);
});

test('THE WIRE AUDIT 8: my own glyphs stand in the order, and once each, the mask gives the room - the service\'s glyphs in GLYPHS\' order, and the token\'s with the seat\'s appended ordered and deduped (mutants: the service\'s own order; the seat\'s appended as they come)', () => {
  assert.deepEqual(glyphsInOrder(['tower', 'origin', 'dev', 'tower', 'nope', 'laurel']), ['dev', 'tower', 'laurel', 'origin'], 'GLYPHS\' order, each once, an unknown word dropped as the mask drops it');
  const nowS = 1_800_000_000;
  const player = { handle: 'mack', created_at: nowS, arena: { grand: false, champion: true } };   // arena.js's shape for the season's #1
  const mine = glyphsOf(player, { MODERATOR_HANDLES: 'mack', AEGIS_HANDLES: 'mack' }, nowS);   // PIN MOVED (ADMIN-ALL): a moderator, not an Admin - an Admin holds every paint glyph
  assert.deepEqual(mine, ['sprout', 'mod', 'laurel', 'aegis'], 'the laurel before the Aegis, as the room reads them');
  assert.deepEqual(mine, glyphsOfBits(glyphBitsOf(mine)), 'what I see is what the mask hands the room');
  assert.match(rd('server-account/src/index.js'), /g: glyphsInOrder\(\[\.\.\.glyphsOf\(who\.player, env, nowS\), \.\.\.\(seatBadge\?\.glyphs \?\? \[\]\)\]\),/, 'the token\'s list, the seat\'s glyphs among it in their places');
});

test('THE WIRE AUDIT 10: a peer\'s effects kit reaches my row from its hello - on the welcome, on a join, and on the welcome a woken room gives (mutants: the kit never attached; never badged)', async () => {
  const r = fakeRoom('town:m9');
  const a = r.connect();
  await r.hello(a, 'peer-0001', { x: 1, y: 0, z: 1, yaw: 0, pitch: 0 }, { name: 'Owner', fx: 'c0a', ak: 'aaaaa' });
  assert.equal(a.closed, null);
  const b = r.connect();
  await r.hello(b, 'peer-0002', { x: 2, y: 0, z: 1, yaw: 0, pitch: 0 });
  const row = b.sent.find((m) => m.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.deepEqual([row.fx, row.ak], ['c0a', 'aaaaa'], 'the welcome\'s row wears both kits');
  const c = r.connect();
  await r.hello(c, 'peer-0003', { x: 3, y: 0, z: 1, yaw: 0, pitch: 0 }, { name: 'Cee', fx: '0d0' });
  assert.equal(b.sent.find((m) => m.t === 'join' && m.id === 'peer-0003')?.fx, '0d0', 'a join wears it');
  r.wake();
  const d = r.connect();
  await r.hello(d, 'peer-0004', { x: 4, y: 0, z: 1, yaw: 0, pitch: 0 });
  const woke = d.sent.find((m) => m.t === 'welcome').peers;
  assert.deepEqual([woke.find((p) => p.id === 'peer-0001')?.fx, woke.find((p) => p.id === 'peer-0003')?.fx], ['c0a', '0d0'], 'and a woken room\'s welcome');
  const none = r.connect();
  await r.hello(none, 'peer-0005', { x: 5, y: 0, z: 1, yaw: 0, pitch: 0 });
  assert.equal('fx' in (d.sent.find((m) => m.t === 'join' && m.id === 'peer-0005') ?? {}), false, 'none worn: no field');
});
