// WORLD6b-iii(e) (Mac, 2026-09-14: "Continue" after WORLD6b-iii(d)): THE STRIKER'S RIDER AND THE ROSTER'S BOUND - the two
// residuals AUDIT WORLD6b recorded and did not pay. (1) The striker's POISON: FormulaHelper inflicts a poisoned blade's
// or shaft's dose INSIDE the damage calc and clears it from the weapon either way (formulas.js:682-686), so at a puppet
// the dose ran on the local shadow's entity and the owner's foe never felt it. Now the pool has ONE poison door
// (`poisonFoe`): mine dosed here, a puppet's set aside and spent by the blow's divert (`pt` on the hit, the wire's
// bound), landed at the owner as FormulaHelper lands it - inside a damaging blow, before the health moves, the foe's
// own saving throw rolled where the foe is real; the dungeon's twin the same. The shaft too: the exterior's arrow
// blow said `kind: 'melee'` and the puppet's local copy took the Arrow - now the kind rides and the owner's copy
// lands it (`ar`, WORLD3's spelling). The DISEASE rider is the MONSTER's alone (onMonsterHit, `!attacker.isPlayer`):
// a player's blow carries none - pinned by source, the record's "disease" was over-broad. (2) ROSTER_MAX bounds the
// WELCOME (the nearest, AUDIT ONLINE A5), not the room (SOCKETS_MAX): a member beyond it was unseen for good - its
// poses dropped (no peer), its foes refused (AUDIT WORLD6b A8/C6), its blow's striker unknown. Now a frame from an id I
// hold in no room ASKS the relay for it by name (`who`, once per WHO_RETRY_MS per id, WHO_HZ_MAX a second at home and
// at the relay on its own bucket with the same strikes), and the relay answers the asker alone with the member's JOIN
// (its hello's name and look, its latest pose) - the frame the session already reads; a name that is no socket in the
// room answers nothing and is junk.
//
// These pins EXECUTE two pools over a crafted MONSTER.BSA (the owner's and the striker's), the session over the fake
// socket, and the real Room over the fake state.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hitPoisonOf, HIT_POISON_MIN, HIT_POISON_MAX, whoIdOf, WHO_HZ_MAX, WHO_RETRY_MS, whoGate, ROSTER_MAX, SOCKETS_MAX, PIXEL_UNITS, validPose } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { RELAY_VERSION } from '../server/src/index.js';
import { POISON_START_VALUE, TOTAL_POISON_VARIANTS, POISONS } from '../src/systems/poisons.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 4, true); const attrs = [40, 50, 50, 85, 50, 50, 90, 55]; for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true); return b; }
function craftMonsterBsa(records) { const NAME_FIELD = 14, ENTRY = 18; const dataLen = records.reduce((a, [, b]) => a + b.length, 0); const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer); v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true); let pos = 4; for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; } for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; } return out; }
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], goldPieces: 0, activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const poolFor = (pe, said) => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n}`); }, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 120, currentPixelKey: () => '3,12', playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5, spellsByIndex: () => null, say: (l) => said.push(l),
});
const netFor = (me, hits, peers) => ({ room: () => 'world:3,12', inRoom: () => false, selfId: () => me, peers: () => peers, now: () => 0, staleMs: 0, onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const poisonsOf = (e) => (e.activeEffects ?? []).filter((a) => a.kind === 'poison').map((a) => a.poison);
const arrowsOf = (e) => (e.items ?? []).filter((it) => it.name === 'Arrow').reduce((n, it) => n + (it.stackCount ?? 1), 0);

test('WORLD6b-iii(e): the wire - pt is a whole number inside ItemEnums.Poisons (128..139, poisons.js\'s own bound, pinned equal), else nothing; who names an id by the wire\'s id law; the asks\' gate and retry; one home at both ends', () => {
  assert.equal(HIT_POISON_MIN, POISON_START_VALUE); assert.equal(HIT_POISON_MAX, POISON_START_VALUE + TOTAL_POISON_VARIANTS - 1);
  assert.equal(HIT_POISON_MIN, POISONS.Nux_Vomica); assert.equal(HIT_POISON_MAX, POISONS.Aegrotat);
  for (const pt of [128, 130, 135, 139]) assert.equal(hitPoisonOf({ pt }), pt);
  for (const d of [{ pt: 127 }, { pt: 140 }, { pt: -1 }, { pt: 130.5 }, { pt: '130' }, { pt: null }, {}, null, undefined, { pt: POISONS.None }]) assert.equal(hitPoisonOf(d), null, JSON.stringify(d));
  assert.equal(whoIdOf({ t: 'who', id: 'bbbb-0002' }), 'bbbb-0002'); assert.equal(whoIdOf({ id: 'x'.repeat(40) }), 'x'.repeat(40));
  for (const m of [{ id: '' }, { id: 'a' }, { id: 'x'.repeat(41) }, { id: 'bbbb 0002' }, { id: 7 }, {}, null, undefined]) assert.equal(whoIdOf(m), null, JSON.stringify(m));
  assert.equal(WHO_HZ_MAX, 5); assert.equal(WHO_RETRY_MS, 10_000);   // AUDIT WORLD6b-iii(e) B5: five a second, so a halo let go re-learns its peers in seconds
  let b = null, passed = 0; for (let i = 0; i < 9; i++) { const g = whoGate(b, 1000); b = g.bucket; if (g.pass) passed++; }
  assert.equal(passed, WHO_HZ_MAX, 'WHO_HZ_MAX asks a second, the rest refused');
  assert.equal(ROSTER_MAX, 64); assert.ok(SOCKETS_MAX > ROSTER_MAX, 'the room holds more than the welcome names - the gap the ask closes');
  assert.equal(relay.hitPoisonOf, hitPoisonOf); assert.equal(relay.whoIdOf, whoIdOf); assert.equal(relay.whoGate, whoGate);
  assert.equal(RELAY_VERSION, 'world66', 'the relay says which one it is');
});

test('WORLD6b-iii(e): the pools - the striker\'s dose at a PUPPET does not run on the shadow: it rides the blow (pt, with the arrow\'s kind and shaft) to the owner, who doses its foe once inside a damaging blow and lands the Arrow; a second blow carries no dose (spent); a dose outside the enum, or on a blow of no damage, lands nothing; the owner\'s own dose at its own foe lands directly', async () => {
  const bobE = playerEntity(), macE = playerEntity();
  const bobSaid = [], macSaid = [];
  const bob = poolFor(bobE, bobSaid), mac = poolFor(macE, macSaid);
  const bobHits = [], macHits = [];
  const roster = [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }];
  bob.setNet(netFor('bob-0002', bobHits, roster)); mac.setNet(netFor('mac-0001', macHits, roster));
  const rat = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  rat.entity.level = 5;   // inflictPoison's `target.level !== 1` gate - the dose is for a foe past first level (DFU's)
  rat.entity.health = rat.entity.maxHealth = 500;   // the crafted rat has four hit points a level; the blows below must leave it standing
  const f = bob.foesFrame(true).f[0];
  mac.applyFoes('bob-0002', { n: 1, k: 'world:3,12', full: 1, f: [f] }); await settle();
  mac.update(0.05, [10, 0, 10], [10, 1.6, 10], senses(macE));
  const pup = mac.foes.find((x) => x.puppet === 'bob-0002');
  assert.ok(pup, 'the puppet stands');
  // the striker's poisoned shaft at the puppet: the calc's hook, then the damage door (playerArrowHitFoe's order)
  assert.equal(mac.poisonFoe(pup, POISONS.Moonseed), null, 'nothing dosed here');
  assert.deepEqual(poisonsOf(pup.entity), [], 'the shadow\'s entity is not dosed');
  mac.damageFoe(pup, 5, [10, 0, 10], [1, 0, 0], { kind: 'arrow' });
  assert.equal(macHits.length, 1);
  const hit = macHits[0];
  assert.equal(hit.to, 'bob-0002'); assert.equal(hit.i, rat.seq); assert.equal(hit.dmg, 5); assert.equal(hit.kind, 'arrow');
  assert.equal(hit.pt, POISONS.Moonseed, 'the dose rides the hit'); assert.equal(hit.ar, 1, 'and the shaft');
  assert.equal(pup._divertPt, null, 'spent');
  mac.damageFoe(pup, 3, [10, 0, 10], [1, 0, 0]);
  assert.equal(macHits.length, 2); assert.equal(macHits[1].pt, undefined, 'a second blow carries no dose'); assert.equal(macHits[1].ar, undefined, 'a melee blow carries no shaft'); assert.equal(macHits[1].kind, 'melee');
  // the owner lands it
  assert.deepEqual(poisonsOf(rat.entity), []); assert.equal(arrowsOf(rat.entity), 0);
  const hp = rat.entity.health;
  assert.equal(bob.applyHit('mac-0001', hit), true);
  assert.deepEqual(poisonsOf(rat.entity), [POISONS.Moonseed], 'the owner\'s foe is dosed'); assert.equal(arrowsOf(rat.entity), 1, 'the Arrow is in the owner\'s copy');
  assert.ok(rat.entity.health < hp, 'and the blow landed');
  assert.equal(bob.applyHit('mac-0001', { ...hit, pt: POISONS.Arsenic, dmg: 0 }), true);
  assert.deepEqual(poisonsOf(rat.entity), [POISONS.Moonseed, POISONS.Arsenic], 'a blow of no damage doses too - the dose is the CALC\'s word (AUDIT WORLD6b-iii(e) A3: FormulaHelper dosed before the Strikes payload could zero the number)');
  assert.equal(arrowsOf(rat.entity), 2, 'and a shaft that CONNECTED lands its Arrow, damage or none (BowDamage\'s :145-147 is outside the damage fork - the dungeon\'s law since WORLD3)');
  for (const pt of [127, 140, 130.5, '130']) { assert.equal(bob.applyHit('mac-0001', { ...hit, pt, ar: undefined }), true); assert.deepEqual(poisonsOf(rat.entity), [POISONS.Moonseed, POISONS.Arsenic], `pt ${JSON.stringify(pt)} is nothing`); }
  assert.equal(bob.applyHit('mac-0001', { ...hit, pt: POISONS.Drothweed, ar: undefined, kind: 'melee' }), true);
  assert.deepEqual(poisonsOf(rat.entity), [POISONS.Moonseed, POISONS.Arsenic, POISONS.Drothweed], 'another poison lands beside them');
  assert.equal(arrowsOf(rat.entity), 2, 'the melee-spelled blows landed no shaft');
  // the owner's own dose at its own foe: the door lands it directly
  const own = bob.poisonFoe(rat, POISONS.Somnalius);
  assert.ok(own && own.kind === 'poison' && own.poison === POISONS.Somnalius, 'dosed here, the entry back');
  assert.match(rd('src/scenes/exteriorFoes.js'), /return inflictPoison\(f\.entity, pt, false, \{ rolls, currentMinute: Math\.floor\(currentMinute\(\)\) \}\);/, 'the pool\'s own uniform seam rolls the saving throw (ENGINE-PRNG RULE), so the pin is not a coin');
  assert.equal(rat._divertPt, undefined, 'nothing set aside on a foe of mine');
  // the pool's doors, by source: the melee chain through poisonFoe; the divert's spend; the owner's landing order
  const e = rd('src/scenes/exteriorFoes.js');
  assert.match(e, /\(f, pt\) => poisonFoe\(f, pt\)\)\) \{\s+\/\/ C2-slice \(combat-11\); WORLD6b-iii\(e\)/, 'resolvePlayerHit\'s poison through the one door');
  assert.match(e, /const _pt = f\._divertPt \?\? null; f\._divertPt = null;/, 'spent by the divert, once');
  assert.match(e, /\.\.\.\(_pt != null \? \{ pt: _pt \} : \{\}\),[^\n]*\n\s*\.\.\.\(kind === 'arrow' \? \{ ar: 1 \} : \{\}\) \}\);/, 'the dose on the blow (the calc\'s word), the shaft on an arrow');
  assert.match(e, /if \(pt != null\) inflictPoison\(f\.entity, pt, false, \{ rolls, currentMinute: Math\.floor\(currentMinute\(\)\) \}\);[^\n]*\n\s*damageFoe\(f, dmg, at, dir, \{ fromPlayer: true, kind, peer: true, peerId: from \}\);\s*\n\s*(?:\/\/[^\n]*\n\s*)*if \(data\.ar === 1 && kind === 'arrow' && arrowsIn\(f\.entity\.items \?\?= \[\]\) < HIT_ARROWS_MAX\) addItem\(f\.entity\.items, \{ group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 \}\);/, 'the owner: the dose before the health moves, the shaft after (BowDamage\'s order), bounded');
});

test('WORLD6b-iii(e): the hosts and the dungeon twin, by source - the exterior\'s arrow blow says its kind and routes its poison through the pool\'s door (the watch dosed here); the interior host splits by pool; the dungeon has the same door, the same divert and the same landing; the disease rider is the monster\'s alone', () => {
  for (const [p, ticker] of [['src/scenes/world.js', 'playerTicker'], ['src/scenes/exterior.js', 'playerTicker']]) {
    const s = rd(p);
    assert.match(s, /: exteriorFoes\.damageFoe\(f, d, player\.pos, m\.dir, \{ kind: 'arrow' \}\)\),/, `${p}: the shaft's kind rides`);
    assert.match(s, new RegExp(`onInflictPoison: \\(att, tgt, pt\\) => \\(cityGuards\\.guards\\.includes\\(t\\) \\? inflictPoison\\(tgt, pt, false, \\{ currentMinute: Math\\.floor\\(${ticker}\\.classicMinutes\\) \\}\\) : exteriorFoes\\.poisonFoe\\(t, pt\\)\\),`), `${p}: the pool's one poison door, the watch its own`);
  }
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /\? interiorFoes\?\.damageFoe\(f, d, player\.pos, m\.dir, \{ kind: 'arrow' \}\)/);
  assert.match(m, /onInflictPoison: \(att, tgt, pt\) => \(t\._encounter \? interiorFoes\?\.poisonFoe\(t, pt\) : inflictPoison\(tgt, pt, false, \{ currentMinute: Math\.floor\(interiorTicker\.classicMinutes\) \}\)\),/);
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /function poisonFoe\(f, pt\) \{\s*\n\s*if \(!f\) return null;\s*\n\s*const pi = foes\.indexOf\(f\);\s*\n\s*if \(!_authority && pi >= 0 && pi < _layoutFoes\) \{ f\._divertPt = pt; return null; \}\s*\n\s*return inflictPoison\(f\.entity, pt, false, \{ currentMinute: Math\.floor\(classicMinutesRef\.value\) \}\);/, 'the dungeon\'s door: a layout foe while another hosts is a puppet');
  assert.match(d, /\(f, pt\) => poisonFoe\(f, pt\)\)\) \{\s+\/\/ C2-slice \(combat-11\)/, 'the melee chain'); assert.match(d, /onInflictPoison: \(att, tgt, pt\) => poisonFoe\(f, pt\),/, 'the shaft');
  assert.match(d, /const _pt = fromPlayer \? \(foe\._divertPt \?\? null\) : null; if \(fromPlayer\) foe\._divertPt = null;/); assert.match(d, /\.\.\.\(_pt != null \? \{ pt: _pt \} : \{\}\),[^\n]*\n\s*\.\.\.\(kind === 'arrow' \? \{ ar: 1 \} : \{\}\) \}\);/);
  assert.match(d, /const pt = hitPoisonOf\(data\);/); assert.match(d, /if \(pt != null\) inflictPoison\(f\.entity, pt, false, \{ currentMinute: Math\.floor\(classicMinutesRef\.value\) \}\);[^\n]*\n\s*damageFoe\(f, dmg, at, dir, \{ fromPlayer: true, peer: true, kind, peerId: id \}\);/, 'the host lands the dose before the health moves');
  // the disease rider: FormulaHelper.OnMonsterHit rides the MONSTER's weaponless loop alone - a player's blow carries none
  const fm = rd('src/combat/formulas.js');
  assert.match(fm, /if \(!attacker\.isPlayer && attacker\.isClass === false && attacker\.basics\) \{[\s\S]{0,2000}if \(hitDamage > 0 && onMonsterHit\) onMonsterHit\(attacker, target, hitDamage\);/, 'the disease rider is inside the monster arm');
  assert.equal((fm.match(/onMonsterHit\(attacker, target, hitDamage\)/g) ?? []).length, 1, 'and nowhere else');
  assert.match(fm, /if \(weapon && damage > 0 && \(weapon\.poisonType \?\? -1\) !== -1\) \{\s*\n\s*if \(onInflictPoison\) onInflictPoison\(attacker, target, weapon\.poisonType\);\s*\n\s*weapon\.poisonType = -1;/, 'the poison is the one rider a player\'s blow carries: inside a damaging hit, cleared from the weapon either way');
});

test('WORLD6b-iii(e): the session - a stranger\'s pose, foes or blow (an id held in no room) asks the relay who it is, through the socket the frame came on, once per WHO_RETRY_MS per id and WHO_HZ_MAX a second; a peer, my own id and a stranger already asked are not asked; the join answer makes it a peer - its next pose is placed and its foes are heard; a refused ask (the gate, no open socket) is not marked and the next frame asks', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const foesIn = [], hitsIn = [];
  s.onFoes = (id, data) => foesIn.push(id); s.onHit = (id, data) => hitsIn.push(id);
  const info = console.info; console.info = () => {};
  try {
    const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
    const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
    s.join('world:3,12', pose);
    const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', look, pose }], host: null, world: null });
    const whos = () => ws.sent.filter((x) => x.startsWith('{"t":"who"')).map((x) => JSON.parse(x).id);
    // a stranger's pose: not placed, asked for
    ws.receive({ t: 'pose', id: 'eve-0003', p: { ...pose, x: 9 } });
    assert.equal(s.peers.has('eve-0003'), false); assert.deepEqual(whos(), ['eve-0003'], 'asked once');
    ws.receive({ t: 'pose', id: 'eve-0003', p: { ...pose, x: 10 } });
    ws.receive({ t: 'foes', id: 'eve-0003', data: { n: 1, k: 'world:3,12', full: 1, f: [] } });
    assert.deepEqual(whos(), ['eve-0003'], 'not asked again inside the retry'); assert.deepEqual(foesIn, [], 'a stranger\'s foes are not the world (AUDIT WORLD6b A8/C6 holds)');
    // a peer's frames, my own, ask nothing
    ws.receive({ t: 'pose', id: 'bob-0002', p: pose }); ws.receive({ t: 'pose', id: 'mac-0001', p: pose }); ws.receive({ t: 'foes', id: 'bob-0002', data: [1] });
    assert.deepEqual(whos(), ['eve-0003']);
    // a stranger's blow at my foe lands (the relay routed it) and the striker is asked for
    ws.receive({ t: 'hit', id: 'ned-0004', data: { to: 'mac-0001', i: 1, dmg: 2, kind: 'melee' } });
    assert.deepEqual(hitsIn, ['ned-0004'], 'the blow lands'); assert.deepEqual(whos(), ['eve-0003', 'ned-0004']);
    // the gate at home: WHO_HZ_MAX a second - the sixth stranger this second is not asked and not marked
    for (const id of ['oli-0005', 'pam-0008', 'quin-0009']) ws.receive({ t: 'pose', id, p: pose });
    assert.deepEqual(whos(), ['eve-0003', 'ned-0004', 'oli-0005', 'pam-0008', 'quin-0009'], 'five this second');
    ws.receive({ t: 'pose', id: 'rob-0010', p: pose });
    assert.deepEqual(whos().length, 5, 'the gate refused the sixth'); assert.equal(s._who.has('rob-0010'), false, 'and did not mark it');
    now += 1000;
    ws.receive({ t: 'pose', id: 'rob-0010', p: pose });
    assert.deepEqual(whos().at(-1), 'rob-0010', 'asked on the next frame once the gate lets it');
    // the relay's answer: a join to me alone - the frame the session already reads
    ws.receive({ t: 'join', id: 'eve-0003', name: 'Eve', look, pose: { ...pose, x: 10 } });
    assert.equal(s.peers.has('eve-0003'), true, 'a peer now'); assert.equal(s.peers.get('eve-0003').name, 'Eve');
    ws.receive({ t: 'pose', id: 'eve-0003', p: { ...pose, x: 11 } });
    assert.equal(s.peers.get('eve-0003').pose.x, 11, 'her pose is placed');
    ws.receive({ t: 'foes', id: 'eve-0003', data: { n: 2, k: 'world:3,12', full: 1, f: [] } });
    assert.deepEqual(foesIn, ['eve-0003'], 'her foes are heard');
    assert.equal(whos().length, 6, 'a peer is never asked');
    // past the retry a stranger still unknown is asked again
    now += WHO_RETRY_MS;
    ws.receive({ t: 'pose', id: 'ned-0004', p: pose });
    assert.deepEqual(whos().at(-1), 'ned-0004'); assert.equal(whos().length, 7);
    // through a halo: the ask goes on the halo's socket, the one the frame came on
    s.setHalo(['world:2,12']); const hw = sockets[1]; hw.open();
    hw.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
    now += 1000;
    hw.receive({ t: 'pose', id: 'pat-0006', p: pose });
    assert.deepEqual(hw.sent.filter((x) => x.startsWith('{"t":"who"')), [JSON.stringify({ t: 'who', id: 'pat-0006' })], 'asked where it was heard');
    assert.equal(whos().includes('pat-0006'), false, 'not through my own cell');
    // no open socket: not asked, not marked
    now += 1000;
    hw.drop();
    hw.receive({ t: 'pose', id: 'quinn-0007', p: pose });
    assert.equal(s._who.has('quinn-0007'), false, 'a dead socket asks nothing and marks nothing');
  } finally { console.info = info; }
});

test('WORLD6b-iii(e): the Room - who answers the asker alone with the member\'s join (its hello\'s name and look, its latest pose); a name that is no socket in the room, or the asker\'s own, answers nothing and is junk; a channel answers nothing; the asks\' own bucket (WHO_HZ_MAX) with the same strikes; a socket not hello\'d is refused as every frame is', async () => {
  const r = fakeRoom('world:3,12');
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1)); await r.hello(b, 'bbbb-0002', at(1, 1)); await r.hello(c, 'cccc-0003', at(1, 1));
  await r.pose(b, at(2, 2));
  const who = (ws, id) => r.raw(ws, JSON.stringify({ t: 'who', id }));
  await who(c, 'bbbb-0002');
  assert.deepEqual(ofType(c, 'join').filter((m) => m.id === 'bbbb-0002').at(-1), { t: 'join', id: 'bbbb-0002', name: 'bbbb-0002', look: r.look, pose: validPose(at(2, 2)) }, 'the member\'s join, its latest pose (as the relay keeps it)');
  assert.equal(ofType(a, 'join').filter((m) => m.id === 'bbbb-0002').length, 1, 'the asker alone hears it (a\'s one is the hello\'s own join)');
  assert.equal(ofType(b, 'join').filter((m) => m.id === 'bbbb-0002').length, 0);
  assert.equal(c.att.junk ?? 0, 0);
  await who(c, 'zzzz-0009'); assert.equal(c.att.junk ?? 0, 0, 'nobody: no answer and NO junk (AUDIT WORLD6b-iii(e) B3: the honest race with a leave)');
  assert.equal(ofType(c, 'join').length, 1, 'the one answer - nothing more (c heard no hello after its own)');
  const e = r.connect(); await r.hello(e, 'eeee-0005', at(1, 1));   // its own bucket
  await who(e, 'eeee-0005'); assert.equal(e.att.junk, 1, 'my own name: junk');
  assert.equal(ofType(e, 'join').length, 0, 'nothing answered'); assert.equal(e.closed, null);
  await who(e, ''); assert.ok(e.closed, 'no name: the parser\'s error, the socket closed (B6: what the relay refuses the client never sends)');
  // the asks' own bucket: WHO_HZ_MAX in one instant, the rest dropped and counted; the strikes close the socket
  const d = r.connect(); await r.hello(d, 'dddd-0004', at(1, 1));
  for (let i = 0; i < 8; i++) await who(d, 'aaaa-0001');
  assert.equal(ofType(d, 'join').filter((m) => m.id === 'aaaa-0001').length, WHO_HZ_MAX, `WHO_HZ_MAX answers (${ofType(d, 'join').length}; a's join predates d, its welcome carried a)`);
  assert.equal(d.att.wdrops, 8 - WHO_HZ_MAX, 'the rest dropped'); assert.equal(d.closed, null);
  assert.equal(d.att.drops ?? 0, 0, 'the pose bucket untouched');
  // a channel: no roster, no answer
  const ch = fakeRoom('chat:world'); const x = ch.connect(), y = ch.connect();
  await ch.hello(x, 'xxxx-0001'); await ch.hello(y, 'yyyy-0002');
  await ch.raw(y, JSON.stringify({ t: 'who', id: 'xxxx-0001' }));
  assert.equal(ofType(y, 'join').length, 0, 'a channel answers nothing');
  // not hello'd: refused as every frame is
  const n = r.connect(); await who(n, 'aaaa-0001');
  assert.equal(ofType(n, 'join').length, 0);
  const s = rd('server/src/index.js');
  assert.match(s, /if \(m\.t === 'who'\) \{[\s\S]{0,1200}a = this\._meterWho\(ws, a, now\); if \(!a\) return;\s*\n\s*if \(isChatRoom\(a\.key\)\) return;/, 'the ask\'s own meter, then the channel refusal');
  assert.match(s, /this\._send\(ws, JSON\.stringify\(\{ t: 'join', id: b\.id, name: b\.name, look, pose: inRange\(a\.key \?\? '', a\.pose, b\.pose\) \? \(b\.pose \?\? null\) : null \}\)\);/, 'the answer: the asker alone, the pose within range (AUDIT WORLD6b-iii(e) B2)');
});
