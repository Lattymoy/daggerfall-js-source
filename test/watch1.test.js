// WATCH1 (Mac, 2026-09-17: "Guards first" - the paused online arc's first stop, "guards on a shared crime"): THE
// CRIMINAL'S WATCH RIDES THE CELL. A crime is its criminal's alone (Multiplayer.md's lock: every player runs their
// own world), and until now so was the city watch it summoned - a peer standing beside a murderer saw the killer
// swing at nothing while five watchmen chased them. The smaller reading lands: the watch stays the criminal's (its
// spawn, its hunt, its despawn on the crime's clearing), and it RIDES the criminal's own cell `foes` frames as
// `t: 146` records - Knight_CityWatch, whose ENEMY_BASICS row every client holds - so every peer in range stands
// them as puppets through the one spawn chain, exactly as a rat of mine is stood. A peer's blow on a watch puppet
// goes to its owner as a hit, by the number the watchman rode under (one counter with the foes), and lands through
// cityGuards' OWN door as NOT the owner's blow: no aggro turn, no Murder for a watchman a peer killed. No relay
// change - a record is a record to the wire and the Room - so RELAY_VERSION stands.
//
// Recorded and NOT carried: a peer who strikes my watch commits nothing (the striker's door is the encounter
// pool's, which has no crime machinery); my murder marks no crime on a peer; the townspeople each client converts
// into watchmen are each client's own roll.
//
// AUDIT WATCH1 (three opus lenses over the first cut) paid here: the watch has its OWN puppet allowance at a reader
// (under one cap of eight the foes spent it first and a busy criminal's watch never stood); a watchman's swing is
// read off his TARGET, not his target's feet (the '.' arm was dead code); a watch body advertises no pile (the take
// arm never reached it, so a peer clicked it for ever and heard nothing); a peer's blow on my watch must come from a
// peer the hunt sees within the player's own reach (five hit frames from anywhere in the cell ended the crime's
// response); a 146 puppet stands at EXACTLY the streamed level (the City Watch bonus was rolled twice); a peer's kill
// speaks no notice, reveals nothing and leaves no pile at the owner; a watch body is stamped for the frame's trim
// and a record the trim drops is unsent.
//
// These pins EXECUTE: a real city watch pool on a synthetic CLASS18.CFG (the un-gated G3 shape) and a real
// encounter pool on a crafted MONSTER.BSA, the net installed between them as world.js installs it.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { validFoeRecord, CELL_PUPPETS_MAX, CELL_WATCH_PUPPETS_MAX, CELL_FRAME_RECORDS_MAX } from '../src/net/wire.js';
import { PLAYER_TARGET } from '../src/characters/enemyTargets.js';
import { WEAPON_REACH } from '../src/combat/playerWeapon.js';
import { MAX_RANGED_DISTANCE } from '../src/characters/enemyMotor.js';
import { FOES_MS } from '../src/net/online.js';
const PUPPET_LAG_SLACK = 2 + 12 * (FOES_MS / 1000);   // the pose slack plus the fastest watchman's stride in one foes interval - past this no blow can be honest

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ---- the crafted data: a rat's career and the watch's class ----------------------------------------------------
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
/** The 74-byte CLASS18.CFG record ClassFile.load walks (cityguards.test.js's synthetic career): hit points per
 *  level at 52, the eight u16 stats at 58..73. */
function stubClassCfg() {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; if (n === 'CLASS18.CFG') return stubClassCfg(); throw new Error(`no ${n} in this pin`); };
const player = () => ({ level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 }, crimeCommitted: 4 });   // Assault - a crime that holds the watch standing and is NOT Murder
const rig = (playerEntity, said) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: (t) => said.push(t),
});
/** One client: its watch pool and its encounter pool, netted as world.js nets them (identity converters: the pin's
 *  scene IS the world frame). `hits` collects the blows this client sends to a peer; `peers` is the roster the hunt
 *  sees (a peer's id and feet); `said` the HUD lines. */
async function client(id, { withWatch = true } = {}) {
  const pe = player();
  const said = [];
  const guards = createCityGuards(rig(pe, said));
  const pool = createExteriorFoes(rig(pe, said));
  const hits = [], hurt = [], peers = [], clock = { ms: 1000 };
  pool.setNet({
    selfId: () => id, room: () => 'world:3,12', peers: () => peers, now: () => clock.ms, onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; },
    toWire: (feet) => [feet[0], feet[1], feet[2]], toScene: (p) => [p[0], p[1], p[2]],
    ...(withWatch ? { watch: { list: () => guards.guards, hurt: (g, dmg, at, dir) => { hurt.push([g, dmg, at, dir]); guards.hurtGuard(g, dmg, at, dir, { fromPlayer: false, peer: true }); } } } : {}),
  });
  return { pe, guards, pool, hits, hurt, peers, said, clock };
}
const summon = (c, at = [5, 0, 5]) => c.guards.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [{ pos: at, fwdYaw: 0, guard: true, disable: () => {} }] });
const puppets = (pool) => pool.foes.filter((f) => !!f.puppet);
const watchPuppets = (pool) => puppets(pool).filter((f) => f.mobileType === GUARD_MOBILE_TYPE);
const step = (c) => { c.pool.update(0.016, [0, 0, 0], [0, 1.6, 0]); };   // the roster is re-read once a frame
/** A watchman's attack machine leaves Idle this frame with the player selected (MT-ii) - the strike edge. */
const strikeAt = (c, g, target) => { g.ai.target = target; g.attack.update = () => { g.attack.machine.state = 'Strike'; return []; }; c.guards.update(0.016, [0, 0, 1], [0, 1.7, 1]); };

test('WATCH1: the criminal STREAMS its watch - a watchman rides the cell frame behind the foes as a `t: 146` record in the foes\' own shape, numbered off the one counter the first time he rides, the wire\'s own projection admitting it; his swing rides with its count and its recipient read off his TARGET; nothing rides twice unchanged; a killed watchman rides dead with NO pile, a walk-away or a removed one rides no more; a net without a watch streams the foes alone', async () => {
  const mac = await client('mac-0001');
  const rat = await mac.pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  assert.equal(rat.seq, 1, 'the rat is one');
  await summon(mac);
  assert.equal(mac.guards.guards.length, 1, 'one watchman off the synthetic CLASS18.CFG');
  const g = mac.guards.guards[0];
  assert.equal(g.seq, null, 'unnumbered until he rides');
  const f1 = mac.pool.foesFrame(false);
  assert.deepEqual(f1.f.map((r) => [r.i, r.t]), [[1, 0], [2, GUARD_MOBILE_TYPE]], 'the rat then the watchman, numbered two off the foes\' own counter');
  assert.equal(g.seq, 2, 'and the number is his now');
  const w = f1.f[1];
  assert.deepEqual(validFoeRecord(w), w, 'the record is the wire\'s own (validFoeRecord admits it whole)');
  assert.equal(w.x, 0, 'the watch is male art'); assert.equal(w.d, 0); assert.equal(w.h, g.entity.health); assert.equal(w.l, g.entity.level | 0);
  assert.deepEqual([w.a, w.b], [0, ''], 'no swing yet');
  assert.ok(w.g === '.' || w.g === '', `a watchman hunts me or my foes, never a peer: ${JSON.stringify(w.g)}`);
  assert.ok(Array.isArray(w.w) && w.w.length === 2, 'the watch spawns armed - its right hand rides as the foes\' does');
  assert.equal(mac.pool.foesFrame(false), null, 'nothing changed: nothing rides');
  // AUDIT WATCH1 A2: the swing - its count in the high bits, the ranged bit low, and whom it was at read off the TARGET
  strikeAt(mac, g, PLAYER_TARGET);
  assert.deepEqual([g._atkA, g._atkB], [2, '.'], 'one swing, at me');
  const sw = mac.pool.foesFrame(false).f.find((r) => r.i === g.seq);
  assert.deepEqual([sw.a, sw.b], [2, '.'], 'the swing rides: count two (the ranged bit low - the watch never shoots), at its owner');
  const bear = await mac.pool.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  assert.equal(bear.seq, 3, 'the next foe is three - the watchman took two');
  // AUDIT WATCH1 (pins lens G1): a watchman the cross-pool remover ended - dead, no body, still in the list until the
  // pool's next update - rides no more between frames
  mac.guards.removeGuard(g);
  assert.ok(mac.guards.guards.includes(g), 'still listed until the prune');
  assert.deepEqual(mac.pool.foesFrame(true).f.map((r) => r.i), [1, 3], 'a full frame no longer names him');
  // a walk-away: the crime clears, the watch goes home, the record leaves the roll (the readers\' full frame sweeps him)
  await summon(mac, [7, 0, 7]);
  const g1 = mac.guards.guards.find((x) => !x.dead);
  mac.pool.foesFrame(true);
  mac.pe.crimeCommitted = 0;
  mac.guards.update(0.016, [0, 0, 0], [0, 1.7, 0]);
  assert.equal(g1.dead, true); assert.equal(!!g1.corpse, false, 'a walk-away leaves no body');
  assert.deepEqual(mac.pool.foesFrame(true).f.map((r) => r.i), [1, 3], 'gone from the roll');
  // a killed watchman rides dead - and with NO pile (AUDIT WATCH1 A3: a watch body is its owner's alone to open)
  mac.pe.crimeCommitted = 4;
  await summon(mac, [6, 0, 6]);
  const g2 = mac.guards.guards.find((x) => !x.dead);
  assert.ok(g2, 'a second watchman');
  mac.pool.foesFrame(false);
  g2.entity.items = [{ name: 'Gold', group: 'Currency', stackCount: 7 }, { name: 'Longsword', group: 'Weapons' }];
  mac.guards._damage(mac.guards.guards.indexOf(g2), 9999);
  assert.equal(g2.corpse, true); assert.equal(g2.entity.items.length, 2, 'my own kill keeps its kit for me');
  const dead = mac.pool.foesFrame(false).f.find((r) => r.i === g2.seq);
  assert.deepEqual([dead.d, dead.o, dead.h], [1, 0, 0], 'dead, NO pile on the wire, no health');
  assert.ok(g2._diedAt != null, 'AUDIT WATCH1 A6: the body is stamped when it first rides, on the pool\'s clock');
  // no watch in the net: the foes alone (exterior.js\'s guard-only host, the dungeon)
  const solo = await client('sol-0001', { withWatch: false });
  await summon(solo);
  await solo.pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  assert.deepEqual(solo.pool.foesFrame(true).f.map((r) => r.t), [0], 'a net without a watch streams no watchman');
  assert.equal(solo.guards.guards[0].seq, null, 'and numbers none');
});

test('WATCH1 (AUDIT A6/B6): the frame\'s trim - past CELL_FRAME_RECORDS_MAX the live ride first and then the NEWEST bodies of BOTH pools (a watch body sorts by its own stamp, not as the oldest), and a record the trim dropped is unsent: it rides the next delta again', async () => {
  const mac = await client('mac-0001');
  await summon(mac);
  const g = mac.guards.guards[0];
  mac.pool.foesFrame(true);
  mac.guards._damage(0, 9999);
  assert.equal(g.corpse, true);
  // sixty-six old bodies of the encounter pool's (the shape a record needs, stamped long ago)
  for (let i = 0; i < CELL_FRAME_RECORDS_MAX + 2; i++) mac.pool.foes.push({ mobileType: 0, dead: true, corpse: true, _diedAt: 1 + i, seq: 1000 + i, ai: { feet: [i, 0, i], yaw: 0, moving: false, target: null }, entity: { health: 0, level: 1, items: [], weapon: null } });
  const fr = mac.pool.foesFrame(true);
  assert.equal(fr.f.length, CELL_FRAME_RECORDS_MAX, 'the sender obeys the bound');
  assert.ok(fr.f.some((r) => r.i === g.seq), 'the watch body - the newest - rides');
  const dropped = [1000, 1001].filter((i) => !fr.f.some((r) => r.i === i));
  assert.deepEqual(dropped, [1000, 1001], 'the two oldest bodies left the roll');
  const again = mac.pool.foesFrame(false);
  assert.ok(again && again.f.some((r) => r.i === 1000 || r.i === 1001), 'a dropped record is unsent - it rides the next delta');
});

test('WATCH1: a PEER stands the watchman as a puppet - through the one spawn chain (Knight_CityWatch, at the streamed feet and at EXACTLY the streamed level, no loot, outside my cap and under the watch\'s OWN allowance beside the foes\'), hunting its owner and never me; my blow on it goes to the OWNER as a hit by the watchman\'s number and marks NO crime of mine; a dead watchman\'s body offers me nothing to take; a full frame that stops naming him takes him down', async () => {
  const mac = await client('mac-0001');
  await summon(mac);
  const g = mac.guards.guards[0];
  const frame = mac.pool.foesFrame(true);
  const bob = await client('bob-0002');
  assert.equal(bob.pool.applyFoes('mac-0001', frame), true, 'Mac\'s frame is the world at Bob');
  await settle();
  const p = puppets(bob.pool);
  assert.equal(p.length, 1, 'one puppet: Mac\'s watchman'); const pup = p[0];
  assert.equal(pup.mobileType, GUARD_MOBILE_TYPE); assert.equal(pup.puppet, 'mac-0001'); assert.equal(pup.seq, g.seq);
  assert.equal(ENEMY_BASICS[pup.mobileType].team, 'CityWatch', 'the row every client holds');
  assert.deepEqual(pup.ai.feet, [g.ai.feet[0], g.ai.feet[1], g.ai.feet[2]].map((v) => Math.round(v * 100) / 100), 'at the streamed feet');
  assert.equal(pup.builtLevel, g.entity.level | 0, 'built at the owner\'s watchman\'s level (AUDIT WORLD6b-ii B2)');
  assert.equal(pup.entity.level, g.entity.level, 'AUDIT WATCH1 A5: and STANDING at it - the City Watch bonus is in the owner\'s word already, not rolled again');
  assert.deepEqual(pup.entity.items, [], 'a puppet carries no loot of mine (AUDIT WORLD6b B14)');
  assert.equal(bob.pool.activeCount(), 0, 'not my cap\'s');
  assert.equal(bob.guards.guards.length, 0, 'and NOT in my watch pool: Mac\'s watch is Mac\'s');
  step(bob);
  assert.equal(pup._pupMine, false, 'the watchman hunts its owner (\'.\'), so it lands nothing on me');
  // my blow: diverted to Mac by the watchman\'s number, and no crime of mine
  bob.pe.crimeCommitted = 0;
  bob.pool.damageFoe(pup, 6, [1, 0, 1], [0, 0, 1], { kind: 'melee' });
  assert.equal(bob.hits.length, 1, 'one blow out');
  assert.equal(bob.hits[0].to, 'mac-0001'); assert.equal(bob.hits[0].i, g.seq); assert.equal(bob.hits[0].dmg, 6); assert.equal(bob.hits[0].k, 'world:3,12');
  assert.equal(pup.entity.health, g.entity.health, 'the puppet takes no damage here - the owner\'s next frame says');
  assert.equal(bob.pe.crimeCommitted, 0, 'a corollary: the pool has no crime machinery (pinned by source below), so striking another\'s watch is not my crime');
  assert.equal(bob.hurt.length, 0, 'and nothing went through MY watch\'s door');
  // AUDIT WATCH1 A3: Mac\'s watchman dies; the body at Bob offers nothing (no `o`), so no take is ever asked
  mac.guards._damage(0, 9999);
  assert.equal(bob.pool.applyFoes('mac-0001', mac.pool.foesFrame(false)), true);
  assert.equal(pup.dead, true);
  assert.deepEqual(bob.pool.lootTargets().map((t) => t.key), [], 'a watch body is not a loot target at a peer');
  assert.equal(mac.pool.applyHit('bob-0002', { k: 'world:3,12', i: g.seq, take: 1 }), true, 'and a take asked anyway is answered with silence');
  assert.equal(mac.hits.length, 0, 'no grant');
  // the sweep: Mac\'s crime clears - a KILLED body stays while its corpse does (the watch\'s own law, G3), so it still
  // rides; once the streamer collects the pixel\'s bodies the prune splices him and the next full frame names no one
  mac.pe.crimeCommitted = 0;
  mac.guards.update(0.016, [0, 0, 0], [0, 1.7, 0]);
  assert.deepEqual(mac.pool.foesFrame(true).f.map((x) => [x.i, x.d]), [[g.seq, 1]], 'the body still rides after the crime clears');
  await settle();
  mac.guards.collectPixel('3,12');
  mac.guards.update(0.016, [0, 0, 0], [0, 1.7, 0]);
  const gone = mac.pool.foesFrame(true);
  assert.deepEqual(gone.f, [], 'Mac streams an empty full frame');
  assert.equal(bob.pool.applyFoes('mac-0001', gone), true);
  assert.equal(puppets(bob.pool).length, 0, 'the body went at Bob too');
  // AUDIT WATCH1 A1: THE WATCH\'S OWN ALLOWANCE - a criminal carrying a full encounter roll AND a watch
  const busy = await client('eve-0003');
  const recs = [];
  for (let i = 0; i < CELL_PUPPETS_MAX; i++) recs.push({ i: 1 + i, t: 0, x: 0, f: [10 + i, 0, 10], y: 0, h: 5, d: 0, a: 0, m: 0 });
  assert.equal(busy.pool.applyFoes('mac-0001', { n: 1, k: 'world:3,12', full: 1, f: recs }), true);
  await settle();
  assert.equal(puppets(busy.pool).length, CELL_PUPPETS_MAX, 'the encounter roll stands, full');
  for (let i = 0; i < CELL_WATCH_PUPPETS_MAX + 1; i++) recs.push({ i: 100 + i, t: GUARD_MOBILE_TYPE, x: 0, f: [20 + i, 0, 20], y: 0, h: 30, d: 0, a: 0, m: 0, l: 5 });
  assert.equal(busy.pool.applyFoes('mac-0001', { n: 2, k: 'world:3,12', full: 1, f: recs }), true, 'then the crime: the watch rides behind the standing foes');
  await settle();
  assert.equal(puppets(busy.pool).length - watchPuppets(busy.pool).length, CELL_PUPPETS_MAX, 'the foes fill their cap');
  assert.equal(watchPuppets(busy.pool).length, CELL_WATCH_PUPPETS_MAX, 'and the watch stands beside them, under its own allowance - the eleventh refused');
});

test('WATCH1: the OWNER lands a peer\'s blow on its watchman through the watch\'s OWN door as NOT its blow - from a peer the hunt sees within the player\'s own reach alone (AUDIT WATCH1 B2: a stranger, a far peer, a melee blow from bowshot are nothing); the health drops, the shove goes the way the blow went, a lethal blow kills and lays a body that rides the next frame with no notice said, nothing revealed and no pile (A3/A4), and the crime stays what it was; a blow naming a dead watchman, or a number nobody rode under, is refused; a host with no door refuses', async () => {
  const mac = await client('mac-0001');
  await summon(mac);
  const g = mac.guards.guards[0];
  assert.equal(mac.pool.applyHit('bob-0002', { k: 'world:3,12', i: 77, dmg: 3, kind: 'melee' }), false, 'a number nobody rode under: refused');
  mac.pool.foesFrame(true);   // he rides, he is numbered
  const hp = g.entity.health;
  const near = [g.ai.feet[0] + 1, g.ai.feet[1], g.ai.feet[2]];
  const blow = (extra = {}) => { mac.clock.ms += 1000; return mac.pool.applyHit('bob-0002', { k: 'world:3,12', i: g.seq, dmg: 3, kind: 'melee', p: near, d: [0, 0, 1], ...extra }); };   // a second apart: the owner's blow budget (AUDIT WORLD6b-ii) is not this pin's subject
  assert.equal(blow(), false, 'a striker the hunt does not see (no roster): nothing');
  mac.peers.push({ id: 'bob-0002', feet: [g.ai.feet[0] + WEAPON_REACH + PUPPET_LAG_SLACK + 1, g.ai.feet[1], g.ai.feet[2]], height: 1.8 }); step(mac);
  assert.equal(blow(), false, 'a peer standing past the player\'s own reach and the stream\'s lag: nothing, whatever `p` says');
  mac.peers[0].feet = [g.ai.feet[0] + WEAPON_REACH + 2 + g.ai.speed * (FOES_MS / 1000) - 0.05, g.ai.feet[1], g.ai.feet[2]]; step(mac);   // past the static envelope (the pose slack is 2), inside the stride
  assert.equal(blow(), true, 'AUDIT ALL B2: and lands from where the watchman could have walked since the frame the striker swung at (one foes interval at his speed, plus the pose slack)');
  assert.equal(g.entity.health, hp - 3); mac.hurt.length = 0;
  mac.peers[0].feet = [g.ai.feet[0] + WEAPON_REACH + PUPPET_LAG_SLACK + 1, g.ai.feet[1], g.ai.feet[2]]; step(mac);
  assert.equal(blow({ kind: 'arrow' }), true, 'a shaft from there lands (bowshot is the ranged band)');
  assert.equal(g.entity.health, hp - 6); mac.hurt.length = 0;
  mac.peers[0].feet = [g.ai.feet[0] + MAX_RANGED_DISTANCE + PUPPET_LAG_SLACK + 1, g.ai.feet[1], g.ai.feet[2]]; step(mac);
  assert.equal(blow({ kind: 'arrow' }), false, 'and not from past the ranged band');
  assert.equal(blow({ kind: 'spell' }), false);
  mac.peers[0].feet = near; step(mac);
  const hp2 = g.entity.health;
  assert.equal(blow(), true, 'Bob\'s blow lands from beside him');
  assert.equal(g.entity.health, hp2 - 3, 'through the watch\'s door');
  assert.equal(mac.hurt.length, 1); assert.deepEqual(mac.hurt[0].slice(1, 4), [3, near, [0, 0, 1]], 'the blow\'s number, the striker\'s feet, its direction');
  assert.deepEqual(g.ai.knockbackDir, [0, 0, 1], 'the shove goes the way the blow went (C15, the gate is knockDir\'s)');
  assert.ok(g.ai.knockbackSpeed > 0);
  assert.equal(mac.pe.crimeCommitted, 4, 'Assault stands as it was: a blow on my watch by a peer is nothing of mine');
  // the kill: a body, no Murder, no notice, no pile
  g.entity.items = [{ name: 'Gold', group: 'Currency', stackCount: 7 }, { name: 'Longsword', group: 'Weapons' }];
  mac.said.length = 0;
  assert.equal(blow({ dmg: 9999 }), true);
  assert.equal(g.dead, true); assert.equal(g.corpse, true, 'killed, not walked away - a body lies');
  assert.equal(mac.pe.crimeCommitted, 4, 'and the crime is STILL Assault - never Murder (F035\'s law: DaggerfallEntityBehaviour.cs:203\'s player gate, which a peer is outside)');
  assert.deepEqual(mac.said, [], 'AUDIT WATCH1 A4: no kill notice of mine for a peer\'s kill (AUDIT WORLD6b B2\'s law, as the foes\' door keeps it)');
  assert.deepEqual(g.entity.items, [], 'AUDIT WATCH1 A3: a body another hand felled carries nothing for me');
  const r = mac.pool.foesFrame(false).f.find((x) => x.i === g.seq);
  assert.deepEqual([r.d, r.h, r.o], [1, 0, 0], 'the body rides the next frame');
  assert.equal(blow(), false, 'a dead watchman takes nothing');
  // the foes\' door is untouched by the watch\'s: a blow on my rat still lands on the rat, from anywhere (its own law)
  const rat = await mac.pool.spawnFoe(0, [40, 0, 40], { feetGiven: true });
  mac.pool.foesFrame(true);
  const rhp = rat.entity.health;
  assert.equal(mac.pool.applyHit('bob-0002', { k: 'world:3,12', i: rat.seq, dmg: 2, kind: 'melee' }), true);
  assert.equal(rat.entity.health, rhp - 2); assert.equal(mac.hurt.length, 2, 'the watch\'s door was not asked again');
  // a host whose net lists a watch but opens no door refuses the blow rather than throwing on a peer\'s frame
  const half = await client('hal-0004');
  await summon(half);
  half.pool.setNet({ selfId: () => 'hal-0004', room: () => 'world:3,12', peers: () => [{ id: 'bob-0002', feet: half.guards.guards[0].ai.feet, height: 1.8 }], onPeerHit: () => true, toWire: (f) => f, toScene: (p) => p, watch: { list: () => half.guards.guards } });
  half.pool.foesFrame(true);
  assert.equal(half.pool.applyHit('bob-0002', { k: 'world:3,12', i: half.guards.guards[0].seq, dmg: 3, kind: 'melee' }), false, 'no door: refused');
});

test('WATCH1 by source: world.js hands the pool the watch (the guards list, hurtGuard with fromPlayer false and peer true); the strike edge latches the attack count and its recipient through the ONE home; the striker\'s melee door routes a puppet past the watch\'s crime arms; the pool has no crime machinery; the wire is unchanged', () => {
  const w = rd('src/scenes/world.js'), cg = rd('src/scenes/cityGuards.js'), ef = rd('src/scenes/exteriorFoes.js');
  assert.ok(w.includes("watch: { list: () => cityGuards.guards, hurt: (g, dmg, at, dir) => cityGuards.hurtGuard(g, dmg, at, dir, { fromPlayer: false, peer: true }) },"), 'the net carries the watch, and a peer\'s blow is not this player\'s - and is a peer\'s');
  assert.ok(cg.includes("if (strikeEdge) { g._atkA = bumpAtkCount(g._atkA, false); g._atkB = wireRecipient(g.ai.target); }"), 'the count on the wire, the ranged bit low, the recipient off the TARGET through the one home');
  assert.ok(ef.includes("if (strikeEdge) { f._atkA = bumpAtkCount(f._atkA, f.attack.firedRanged); f._atkB = wireRecipient(f.ai.target); }"), 'the foes\' own strike edge through the same home');
  assert.equal(/const recipientOf =/.test(ef), false, 'the pool\'s private copy of the spelling is gone');
  assert.ok(cg.includes("seq: null, _atkA: 0, _atkB: '',"), 'the record\'s three wire fields, null and zero until he rides');
  assert.ok(ef.includes("for (const [f, onWatch] of [...foes.map((f) => [f, false]), ...watchList().map((g) => [g, true])]) {"), 'the watch rides behind the foes');
  assert.ok(ef.includes("if (f.seq == null) f.seq = _nextSeq++;"), 'numbered off the one counter');
  assert.ok(ef.includes("if (onWatch) _net.watch.hurt(f, dmg, at, dir);"), 'the owner\'s door for a watchman');
  // the striker\'s melee door: a guard of MINE goes through the watch\'s crime arms, anything else (a puppet) the pool\'s
  assert.match(w, /dealDamage: \(f, d\) => \(cityGuards\.guards\.includes\(f\)/, 'by pool membership, never by species - a 146 puppet is the encounter pool\'s');
  assert.match(w, /onAttackFromPlayer: \(f\) => \(cityGuards\.guards\.includes\(f\)/);
  assert.equal(ef.includes('crimeCommitted'), false, 'the striker\'s pool has no crime machinery (exteriorfoes.test.js\'s sweep, still true)');
  assert.ok(rd('src/net/wire.js').includes("export const RELAY_VERSION = 'world91'"), 'no wire SHAPE change (a record is a record) - the version moved because wire.js gained a reader constant, CELL_WATCH_PUPPETS_MAX (world81), and again at the main merge for a moved comment line (world84): the relay bundle\'s bytes are its law (SLAM8)');
});

test('AUDIT ALL (the audit of AUDIT WATCH1): a pending build\'s species is fixed at the build - a peer re-wording a pending watch without `t` neither escapes the watch\'s count nor stands a foe (the cap held); the frame\'s trim reserves the watch\'s live share behind a full encounter roll; a peer\'s killing shaft puts no Arrow into the body it emptied; a restore keeps a watchman\'s level', async () => {
  // A1: the species of a pending build
  const bob = await client('bob-0002');
  const watchRecs = (n, i0) => Array.from({ length: n }, (_, k) => ({ i: i0 + k, t: GUARD_MOBILE_TYPE, x: 0, f: [20 + k, 0, 20], y: 0, h: 30, d: 0, a: 0, m: 0, l: 5 }));
  assert.equal(bob.pool.applyFoes('mac-0001', { n: 1, k: 'world:3,12', full: 0, f: watchRecs(CELL_WATCH_PUPPETS_MAX, 100) }), true);
  // the same keys again, before a build settles, with no species - then ten fresh watchmen
  assert.equal(bob.pool.applyFoes('mac-0001', { n: 2, k: 'world:3,12', full: 0, f: watchRecs(CELL_WATCH_PUPPETS_MAX, 100).map(({ t, ...r }) => r) }), true);
  assert.equal(bob.pool.applyFoes('mac-0001', { n: 3, k: 'world:3,12', full: 0, f: watchRecs(CELL_WATCH_PUPPETS_MAX, 200) }), true);
  await settle();
  assert.equal(watchPuppets(bob.pool).length, CELL_WATCH_PUPPETS_MAX, 'ten watchmen and not one more: the re-worded builds kept their class');
  assert.equal(puppets(bob.pool).length, CELL_WATCH_PUPPETS_MAX, 'and none of them stood as a foe');
  // a foe re-worded as a watchman mid-build stays a foe: the foes\' cap holds too
  const eve = await client('eve-0003');
  const foeRecs = (n, i0) => Array.from({ length: n }, (_, k) => ({ i: i0 + k, t: 0, x: 0, f: [10 + k, 0, 10], y: 0, h: 5, d: 0, a: 0, m: 0 }));
  for (let round = 0; round < 3; round++) {   // the same eight numbers, re-worded as watchmen while their builds are out, three times over
    assert.equal(eve.pool.applyFoes('mac-0001', { n: 10 + round * 2, k: 'world:3,12', full: 0, f: foeRecs(CELL_PUPPETS_MAX, 1000) }), true);
    assert.equal(eve.pool.applyFoes('mac-0001', { n: 11 + round * 2, k: 'world:3,12', full: 0, f: foeRecs(CELL_PUPPETS_MAX, 1000).map((r) => ({ ...r, t: GUARD_MOBILE_TYPE })) }), true);
  }
  await settle();
  assert.equal(puppets(eve.pool).length - watchPuppets(eve.pool).length, CELL_PUPPETS_MAX, 'eight foes, three rounds of re-wording notwithstanding');
  assert.equal(watchPuppets(eve.pool).length, 0, 'and no watchman minted off a foe\'s word');
  // A3: the trim reserves the watch\'s live share
  const mac = await client('mac-0001');
  await summon(mac);
  const g = mac.guards.guards[0];
  for (let i = 0; i < CELL_FRAME_RECORDS_MAX + 4; i++) mac.pool.foes.push({ mobileType: 0, dead: false, corpse: false, seq: 2000 + i, ai: { feet: [i, 0, i], yaw: 0, moving: false, target: null }, entity: { health: 5, level: 1, items: [], weapon: null } });
  const fr = mac.pool.foesFrame(true);
  assert.equal(fr.f.length, CELL_FRAME_RECORDS_MAX);
  assert.ok(fr.f.some((r) => r.i === g.seq), 'the watchman rides behind a full roll of live foes - his share is reserved');
  // A4: a killing shaft puts no Arrow into the emptied body
  const mac2 = await client('mac-0004');
  await summon(mac2);
  const g2 = mac2.guards.guards[0];
  mac2.pool.foesFrame(true);
  mac2.peers.push({ id: 'bob-0002', feet: [g2.ai.feet[0] + 1, g2.ai.feet[1], g2.ai.feet[2]], height: 1.8 }); step(mac2);
  g2.entity.items = [{ name: 'Gold', group: 'Currency', stackCount: 3 }];
  assert.equal(mac2.pool.applyHit('bob-0002', { k: 'world:3,12', i: g2.seq, dmg: 9999, kind: 'arrow', ar: 1 }), true);
  assert.equal(g2.dead, true); assert.deepEqual(g2.entity.items, [], 'a body another hand felled carries nothing - not even the shaft');
  // A6: a restore keeps the level the bonus was rolled into
  const mac3 = await client('mac-0005');
  await summon(mac3);
  const lvl = mac3.guards.guards[0].entity.level;
  const snap = mac3.guards.snapshotWorld((feet) => ({ x: feet[0], z: feet[2] }));
  assert.equal(snap[0].level, lvl, 'the snapshot carries the level');
  const back = await client('mac-0006');
  back.guards.restoreWorld(snap, (x, z) => [x, z]);
  await settle();
  assert.equal(back.guards.guards.length, 1); assert.equal(back.guards.guards[0].entity.level, lvl, 'restored at exactly that level - the Range(3,7) bonus is not rolled again');
});
