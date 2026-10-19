// GRANT4, GRANT6, GRANT8 (2026-10-18, Mac: "Do all slices"; bible/11-Multiplayer/Spawn-Grants.md sections 14-16): THE
// CLIENT'S SIDE OF THE LAST SLICES, over FOE-FORGE's rig (real encounter pools, each with its own grants' host and a fake
// relay signing real grants): the watch rides on its grant; marks a caller decided ask `kept`; a room's grants stay its
// own; while the law enforces an owner stands nothing without a grant and a reader stands down only a forged grant or
// none; a stand waits on a welcome still owed and a reader on a grant not yet heard; a class foe a level or two over its
// owner's checkpoint stands; an `encr` member stands its seed's species, and a reader holds it to it. And the wiring of the
// building's pool and the dungeon's own lane, by source.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createGrantHost, grantSpecies, GRANT_VERDICT_WAIT_MS, GRANT_LEVEL_SLACK } from '../../src/scenes/grantHost.js';
import { signGrant, grantMarksFor, GRANT_TTL_MS, GRANT_CASE_REASONS, GRANT_STANDDOWN_REASONS, GRANT_READER_REFUSALS } from '../../src/net/grantLaw.js';

const { subtle } = globalThis.crypto;
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
const bsa = craftMonsterBsa(Array.from({ length: 43 }, (_, i) => [`ENEMY${String(i).padStart(3, '0')}.CFG`, craftCfg()]));   // every monster
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const playerEntity = () => ({ level: 9, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(100) });
const CELL = 'world:3,12', NEXT = 'world:4,12', ROOM = 'interior:m123456.7', OWNER = 'aaa-0001', READER = 'mmm-0002';

/** A fake relay: each ask answered as the relay would (`refuse` answers a mint `no`, `silent` answers none, `roll` makes
 *  an encounter's grant `encr`, `seed` fixes the next seed), its grants signed with the test's key; every ask kept. */
async function relay() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  let n = 100, clock = 1_800_000_000_000;
  const sign = async (g) => ({ ...g, sg: await signGrant(g, kp.privateKey, { subtle }) });
  const session = (id, { mode = 'measure', room = CELL } = {}) => {
    const s = { id, room, status: 'open', grantMode: mode, asks: [], host: null, refuse: false, silent: false, roll: false, seed: null, sendGrant(ask) { if (!s.grantMode || s.grantMode === 'off') return false; s.asks.push(ask); void reply(s, ask); return true; } };
    return s;
  };
  async function reply(s, ask) {
    if (s.silent) return;
    let out = null;
    if (ask.k === 'mint') {
      if (s.refuse) out = { k: 'no', id: ask.id, r: 'bucket' };
      else {
        const seed = s.seed ?? ((n * 2654435761) >>> 0), k = s.roll && ask.kind === 'enc' ? 'encr' : ask.kind;
        const gr = { g: ++n, o: s.id, q: s.room, a: `acct-${s.id}`, k, p: [3, 12], m: 9, l: 9, r: 7, n: ask.n, s: seed, ...grantMarksFor(k, seed, ask.n, 7), h: -1, x: clock + GRANT_TTL_MS };
        out = { k: 'ok', id: ask.id, gr: await sign(gr) };
      }
    } else if (ask.k === 'carry') out = { k: 'carry', id: ask.id, grs: await Promise.all(ask.grs.map((g) => sign({ ...g, sg: undefined, g: ++n, q: s.room, x: clock + GRANT_TTL_MS }))) };
    if (out) { await settle(1); s.host?.answer(out); }
  }
  return { kp, session, sign, tick: (ms) => { clock += ms; }, get now() { return clock; } };
}

function pool(self, g, watch = null) {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, m) => [feet[0] + m[0], feet[1] + m[1], feet[2] + m[2]] },
    fetchBytes: async (name) => { if (name === 'MONSTER.BSA') return bsa; throw new Error(`no ${name} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12', inLocation: () => false,
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => g.session.room, selfId: () => self, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]], grants: g.host, ...(watch ? { watch: { list: () => watch, hurt: () => {} } } : {}) });
  return p;
}
async function player(R, id, { mode, room, climate = () => 231, wait = 300, verdictWait, watch = null } = {}) {
  const session = R.session(id, { mode, room });
  const host = createGrantHost({ session: () => session, climateAt: climate, now: () => R.now, fetchKey: async () => R.kp.publicKey, wait, ...(verdictWait ? { verdictWait } : {}) });
  session.host = host;
  const g = { session, host };
  return { ...g, pool: pool(id, g, watch) };
}
const watchman = () => ({ mobileType: 146, gender: 'male', ai: { feet: [5, 0, 5], yaw: 0, target: null, moving: false }, entity: { health: 30, maxHealth: 30, level: 9, items: [] }, dead: false });

test('GRANT6 THE LAW\'S WORDS: a case\'s reasons are what only a changed client gives - a grant never signed, another\'s, a member past it, marks past it, a member twice; an enforcing reader stands those down and a record with none; the rest (a record that beat its carry or renewal, a level since its checkpoint, a species off its tables) are the measure\'s (mutants: a timing word counted against a sender)', () => {
  assert.deepEqual(GRANT_CASE_REASONS, ['unsigned', 'sender', 'member', 'marks', 'twice', 'stats']);   // PIN MOVED (FOE-BOUNDS, Spawn-Grants section 19): a health past every builder's worst is no timing and no setting
  assert.deepEqual(GRANT_STANDDOWN_REASONS, [...GRANT_CASE_REASONS, 'ungranted']);
  assert.ok([...GRANT_STANDDOWN_REASONS].every((r) => GRANT_READER_REFUSALS.includes(r)));
  assert.deepEqual(GRANT_READER_REFUSALS.filter((r) => !GRANT_STANDDOWN_REASONS.includes(r)), ['cell', 'expired', 'dice']);
});

test('GRANT6 THE OWNER WHILE THE LAW ENFORCES: a stand the relay refuses, or whose grant never comes, never stands; while it measures the same stand stands ungranted; a stand made while its socket\'s welcome is owed waits for the law, and asks once it is said (mutants: a refused stand stood; the welcome not waited on)', async () => {
  const R = await relay();
  const E = await player(R, OWNER, { mode: 'enforce' });
  E.session.refuse = true;
  assert.equal(await E.pool.spawnFoe(0, [100, 0, 100], { grantKind: 'enc' }), null, 'refused: nothing stands');
  E.session.refuse = false; E.session.silent = true;
  assert.equal(await E.pool.spawnFoe(0, [101, 0, 100], { grantKind: 'enc' }), null, 'no answer: nothing stands');
  const M = await player(R, READER, { mode: 'measure' });
  M.session.silent = true;
  const f = await M.pool.spawnFoe(0, [100, 0, 100], { grantKind: 'enc' });
  assert.ok(f && !f._grant, 'measuring: it stands, ungranted');
  // the welcome owed: the stand waits, and asks once the law is said
  const W = await player(R, 'www-0004', { mode: null, wait: 2000 });
  const standing = W.pool.spawnFoe(0, [100, 0, 100], { grantKind: 'enc' });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(W.session.asks.length, 0, 'nothing asked of a law unsaid');
  W.session.grantMode = 'measure';
  const g = await standing;
  assert.deepEqual(W.session.asks.map((a) => [a.k, a.kind]), [['mint', 'enc']]);
  assert.ok(g?._grant, 'it stood on the grant the said law gave');
  // a socket that is not open waits on nothing
  const C = await player(R, 'ccc-0005', { mode: null });
  C.session.status = 'connecting';
  const t0 = Date.now();
  assert.ok(await C.pool.spawnFoe(0, [100, 0, 100], { grantKind: 'enc' }));
  assert.ok(Date.now() - t0 < 250, 'stood at once');
});

test('GRANT6 THE READER WAITS FOR A GRANT IT HAS NOT HEARD, AND A LEVEL OR TWO: a record naming a grant this reader came in after is judged once a frame carries it; one never carried is unheard after GRANT_VERDICT_WAIT_MS (`ungranted`, GRANT-UNHEARD: no forgery\'s reason); a class foe GRANT_LEVEL_SLACK over its owner\'s signed level stands, one more is `dice` (mutants: the wait skipped; the slack dropped)', async () => {
  const R = await relay();
  assert.equal(GRANT_VERDICT_WAIT_MS, 6000, 'three full frames (AUDIT GRANT A2)');
  assert.equal(GRANT_LEVEL_SLACK, 2);
  const host = createGrantHost({ session: () => null, climateAt: () => 231, now: () => R.now, fetchKey: async () => R.kp.publicKey, verdictWait: 200 });
  const gr = await R.sign({ g: 7, o: OWNER, q: CELL, a: 'acct-x', k: 'enc', p: [3, 12], m: 9, l: 9, r: 7, n: 4, s: 5, e: 0, c: [-1, -1, -1, -1], h: -1, x: R.now + GRANT_TTL_MS });
  const late = host.check(OWNER, CELL, { i: 1, t: 0, gr: [7, 0] });
  await new Promise((r) => setTimeout(r, 50));
  host.heard(OWNER, [gr]);
  assert.equal(await late, null, 'heard inside the wait: judged, and honest');
  assert.equal(await host.check(OWNER, CELL, { i: 2, t: 0, gr: [8, 0] }), 'ungranted', 'never carried');   // PIN MOVED (GRANT-UNHEARD): unheard, never `unsigned`
  assert.equal(await host.check(OWNER, CELL, { i: 3, t: 135, l: 9 + GRANT_LEVEL_SLACK, gr: [7, 1] }), null, 'a level or two since its checkpoint');
  assert.equal(await host.check(OWNER, CELL, { i: 4, t: 135, l: 10 + GRANT_LEVEL_SLACK, gr: [7, 2] }), 'dice');
});

test('GRANT4 THE WATCH RIDES ON ITS GRANT: a watchman\'s record waits for his grant (asked as the pool first streams him), then names it; one gone frees it; a reader holds a watch grant to the watch (mutants: the watch ungranted; a watch grant standing a monster)', async () => {
  const R = await relay();
  const guards = [watchman(), watchman()];
  const O = await player(R, OWNER, { watch: guards });
  assert.equal(O.pool.foesFrame(true)?.f?.length ?? 0, 0, 'held while their grant is asked');
  assert.equal(O.pool.foesFrame(true)?.f?.length ?? 0, 0, 'and while it has not come');
  await settle();
  const full = O.pool.foesFrame(true);
  const gr = guards[0]._grant;
  assert.deepEqual([O.session.asks.filter((a) => a.k === 'mint').map((a) => [a.kind, a.n]), full.f.map((r) => r.gr)], [[['watch', 2]], [[gr.g, 0], [gr.g, 1]]]);
  assert.deepEqual([gr.k, gr.e, gr.c], ['watch', 0, [-1, -1]], 'a watch grant rolls no marks');
  guards.length = 0;
  O.pool.foesFrame(false);
  await settle(1);
  assert.deepEqual(O.session.asks.filter((a) => a.k === 'free').map((a) => a.gs), [[gr.g]], 'both gone: freed');
  const D = await player(R, READER);
  D.host.heard(OWNER, full.gs);
  assert.equal(await D.host.check(OWNER, CELL, { ...full.f[0] }), null);
  assert.equal(await D.host.check(OWNER, CELL, { ...full.f[1], i: 77, t: 0 }), 'dice', 'a rat on a watch grant');
});

test('GRANT4 MARKS A CALLER DECIDED ASK `kept`; A ROOM\'S GRANTS STAY ITS OWN: a saved elite or a set champion asks a markless kind its reader believes; a grant is carried cell to cell, never into a world room; a free goes to the room that holds it; an expired grant is no longer mine (mutants: a carry into a room; a free into another room)', async () => {
  const R = await relay();
  const O = await player(R, OWNER);
  const kept = await O.pool.spawnFoe(0, [100, 0, 100], { eliteFoe: true });
  await settle();
  assert.equal(O.session.asks.at(-1).kind, 'kept');
  assert.equal(kept._grant?.k, 'kept', 'a saved elite stands on a kept grant');
  const D = await player(R, READER);
  const fr = O.pool.foesFrame(true);
  D.host.heard(OWNER, fr.gs);
  assert.equal(await D.host.check(OWNER, CELL, { ...fr.f.find((r) => r.i === kept.seq), z: 1, cp: 2 }), null, 'its marks believed - its caller\'s law');
  // into a world room: no carry; back into the next cell: carried
  O.session.room = ROOM;
  O.pool.foesFrame(false);
  await settle();
  assert.equal(O.session.asks.filter((a) => a.k === 'carry').length, 0, 'a cell\'s grant never goes into a room');
  O.pool.removeFoe(kept);
  await settle(1);   // a turn's frees go at its end (AUDIT GRANT A7)
  assert.equal(O.session.asks.filter((a) => a.k === 'free').length, 0, 'freed only to the cell that holds it');
  const live = await O.pool.spawnFoe(0, [101, 0, 100], { grantKind: 'loose' });
  await settle();
  assert.equal(live._grant.q, ROOM);
  O.session.room = NEXT;
  O.pool.foesFrame(false);
  await settle();
  assert.equal(O.session.asks.filter((a) => a.k === 'carry').length, 0, 'a room\'s grant never comes out');
  R.tick(GRANT_TTL_MS + 61_000);
  O.pool.foesFrame(false);
  assert.ok(!O.host.live().includes(live._grant), 'expired: no longer mine to renew or free');
});

test('GRANT8 AN `encr` MEMBER STANDS ITS SEED\'S SPECIES: the owner\'s encounter stands what its grant\'s seed rolls at the pixel\'s climate, not what its own roll chose; a reader rebuilds it - in a location\'s rect or out - and refuses any other `dice` (mutants: the owner\'s own roll kept; the reader unchecked)', async () => {
  const R = await relay();
  const O = await player(R, OWNER);
  O.session.roll = true;
  let seed = 1;
  const gr0 = (s) => ({ s, m: 9, l: 9 });
  while (!((t) => t >= 0 && t < 43 && t !== 0)(grantSpecies(gr0(seed), 0, 231, false))) seed++;
  O.session.seed = seed;
  const want = grantSpecies(gr0(seed), 0, 231, false);
  const f = await O.pool.spawnFoe(0, [100, 0, 100], { grantKind: 'enc' });
  assert.ok(f, 'it stood');
  assert.deepEqual([f._grant.k, f.mobileType], ['encr', want], 'the seed\'s species, not the rat its caller rolled');
  const D = await player(R, READER);
  const fr = O.pool.foesFrame(true);
  D.host.heard(OWNER, fr.gs);
  assert.equal(await D.host.check(OWNER, CELL, fr.f[0]), null);
  assert.equal(await D.host.check(OWNER, CELL, { ...fr.f[0], i: 50, t: want === 1 ? 2 : 1, gr: [f._grant.g, 0] }), 'dice');
});

test('GRANT4 THE BUILDING\'S POOL AND THE DUNGEON\'S OWN LANE ARE WIRED: world.js hands the grants\' host to the building\'s pool and to the dungeon; the dungeon\'s own lane asks before it builds a stand, carries the grant on its record and frame, checks a new puppet\'s, ends a member gone, hands one on to its heir, ties an adopted one, and keeps the clock (by source; mutants: the dungeon\'s ask dropped; its frame\'s grants dropped)', () => {
  const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  const M = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const D = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(W, /\n\s+grants,\s+\/\/ GRANT4: the building's own stands/);
  assert.match(W, /grants: \(\) => \(online \? grants : null\),/);
  assert.match(M, /grants: \(\) => host\.grants\?\.\(\) \?\? null,/);
  assert.match(D, /const ask = bout \? null : grants\?\.\(\)\?\.memberFor\(grantKindOf\(\{ allied, questBehaviour: questSpawn, revenant, loose: true \}\)\) \?\? null/);
  assert.match(D, /if \(ask && !gm && grants\?\.\(\)\?\.enforcing\(\)\) return null;\n\s+const f = await buildFoeAt\(e, false\);/);
  assert.match(D, /if \(seeded && f\._grant && !f\._grant\._dead\) r\.gr = \[f\._grant\.g, f\._grantI\];/);
  assert.match(D, /\.\.\.\(gs\.length \? \{ gs \} : \{\}\)/);
  assert.match(D, /grants\?\.\(\)\?\.heard\(from, data\.gs\);/);
  assert.match(D, /standOwnPuppet\(from, r, qt, o\.gen, lo, grants\?\.\(\)\?\.check\(from, null, r\) \?\? null\)/);
  assert.match(D, /grants\?\.\(\)\?\.handed\(f, heir\);/);
  assert.match(D, /grants\?\.\(\)\?\.adopted\(from, f, f\._ownI\);/);
  assert.match(D, /grants\?\.\(\)\?\.tick\(\);/);
});
