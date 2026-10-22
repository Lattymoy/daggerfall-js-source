// GRANT3-GRANT4 (2026-10-18, Mac: "Do all slices"; bible/11-Multiplayer/Spawn-Grants.md sections 13 and 14): THE POOL
// STANDS ON GRANTS AND READS THEM - over FOE-FORGE's rig (two real encounter pools), each with its own grants' host
// (scenes/grantHost.js) and a fake relay that signs real grants with a test key: a turn's stands of a kind are one ask;
// the grant's marks stand in place of the street's rolls; a record names its grant and member, a frame carries the grant
// once and again when signed again; a member's end frees its grant at the last; renewed, carried into the next cell,
// handed on to an heir; and a reader checks every new foe's grant - the signature, the sender, the member once, the marks,
// the species and the level - tallying what it would refuse, and standing it down while the law enforces.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WILD_GIANT } from '../../src/systems/wild/wildZone.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createGrantHost, grantSpeciesOf } from '../../src/scenes/grantHost.js';
import { signGrant, grantMarksFor, grantMarksAllow, grantKindOf, validGrant, GRANT_TTL_MS, GRANT_TALLY_MS, GRANT_RENEW_LEAD_MS, GRANT_KINDS, GRANT_MARKLESS, GRANT_OPEN_KINDS } from '../../src/net/grantLaw.js';

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
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], [`ENEMY${String(WILD_GIANT).padStart(3, '0')}.CFG`, craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const playerEntity = () => ({ level: 9, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(100) });
const CELL = 'world:3,12', NEXT = 'world:4,12', OWNER = 'aaa-0001', READER = 'mmm-0002', HEIR = 'hhh-0003';

/** A fake relay: answers each ask as the relay would, its grants signed with the test's key; every ask kept. */
async function relay() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  let n = 100, clock = 1_800_000_000_000;
  const sessions = new Map();
  const ctl = { hold: false, held: [] };   // the heirs' answers held back while `hold`
  const sign = async (g) => ({ ...g, sg: await signGrant(g, kp.privateKey, { subtle }) });
  const session = (id, { mode = 'measure' } = {}) => {
    const s = { id, room: CELL, status: 'open', grantMode: mode, asks: [], host: null, sendGrant(ask) { s.asks.push(ask); void reply(s, ask); return true; } };
    sessions.set(id, s);
    return s;
  };
  async function reply(s, ask) {
    let out = null;
    if (ask.k === 'mint') {
      const seed = (n * 2654435761) >>> 0, gr = { g: ++n, o: s.id, q: s.room, a: `acct-${s.id}`, k: ask.kind, p: [3, 12], m: 9, l: 9, r: 7, n: ask.n, s: seed, ...(s.marks ?? grantMarksFor(ask.kind, seed, ask.n, 7)), h: -1, x: clock + GRANT_TTL_MS };
      out = { k: 'ok', id: ask.id, gr: await sign(gr) };
    } else if (ask.k === 'renew') out = { k: 'renew', id: ask.id, grs: await Promise.all(ask.grs.filter((g) => s.live.some((x) => x.g === g.g)).map((g) => sign({ ...strip(g), x: clock + GRANT_TTL_MS }))) };
    else if (ask.k === 'carry') out = { k: 'carry', id: ask.id, grs: await Promise.all(ask.grs.map((g) => sign({ ...strip(g), g: ++n, q: s.room, x: clock + GRANT_TTL_MS }))) };
    else if (ask.k === 'heir') {
      for (const x of ask.hs) {
        const h = sessions.get(x.to), go = async () => h?.host?.answer({ k: 'heir', id: ask.id, gr: await sign({ ...strip(x.gr), g: ++n, o: x.to, h: x.i, x: clock + GRANT_TTL_MS }) });
        if (ctl.hold) ctl.held.push(go);
        else { await settle(1); await go(); }
      }
      return;
    }
    if (out) { await settle(1); s.host?.answer(out); }
  }
  const strip = (g) => { const { sg, ...rest } = g; void sg; return rest; };
  return { kp, session, sign, ctl, tick: (ms) => { clock += ms; }, get now() { return clock; } };
}

function pool(self, grants) {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, m) => [feet[0] + m[0], feet[1] + m[1], feet[2] + m[2]] },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12', inLocation: () => false,
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => grants.session?.room ?? CELL, selfId: () => self, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]], grants: grants.host });
  return p;
}
async function player(R, id, { mode, climate = () => 231 } = {}) {
  const session = R.session(id, { mode });
  const host = createGrantHost({ session: () => session, climateAt: climate, now: () => R.now, fetchKey: async () => R.kp.publicKey, wait: 500 });
  session.host = host;
  Object.defineProperty(session, 'live', { get: () => host.live() });
  const g = { session, host };
  return { ...g, pool: pool(id, g) };
}

test('GRANT4 THE KINDS: a stand\'s kind is its caller\'s word or its own shape - an ally, a quest\'s foe, a Greater Giant, a revenant, marks its caller decided, the deep\'s or the Living World\'s, a loose stand or Wabbajack\'s change, a marker\'s, else a capped stand\'s; no kind stands more than 24 a grant; a quest\'s foe, an ally, a revenant, the watch and a kept stand roll no marks, and a reader believes theirs (mutants: an ally granted marks; the shape\'s order; a markless kind\'s marks judged)', () => {
  assert.deepEqual(Object.keys(GRANT_KINDS), ['enc', 'camp', 'band', 'bounty', 'loose', 'site', 'managed', 'giant', 'rev', 'quest', 'ally', 'watch', 'kept', 'encr', 'star']);   // STAR-TUNE: a fallen star's coven, its own kind
  assert.ok(GRANT_OPEN_KINDS.includes('star'), 'STAR-TUNE: a star falls in the open country alone - a world room refuses its kind');
  assert.ok(Object.values(GRANT_KINDS).every((k) => k.max >= 1 && k.max <= 24));
  assert.equal(GRANT_KINDS.ally.hostile, false);
  assert.deepEqual([{ allied: true, questBehaviour: 1 }, { questBehaviour: 1, revenant: {} }, { zoneGiant: 3 }, { revenant: {} }, { revenant: {}, managed: true }, { kept: true, managed: true }, { revenant: {}, kept: true }, { managed: true, loose: true }, { loose: true }, { replacing: true }, { site: 's', placed: true }, { placed: true }, {}].map(grantKindOf),
    ['ally', 'quest', 'giant', 'rev', 'rev', 'kept', 'rev', 'managed', 'loose', 'loose', 'site', 'site', 'band']);
  assert.deepEqual(GRANT_MARKLESS, ['quest', 'ally', 'rev', 'watch', 'kept']);
  for (const k of GRANT_MARKLESS) assert.deepEqual(grantMarksFor(k, 58, 4, 7), { e: 0, c: [-1, -1, -1, -1] });
  const g = { k: 'kept', e: 0, c: [-1, -1] };
  assert.ok(grantMarksAllow(g, 0, { z: 1 }) && grantMarksAllow({ ...g, k: 'rev' }, 1, { cp: 3 }), 'a markless kind\'s marks its own law\'s');
  assert.ok(!grantMarksAllow({ ...g, k: 'enc' }, 0, { z: 1 }) && !grantMarksAllow({ ...g, k: 'loose' }, 1, { cp: 3 }), 'any other\'s only as its grant\'s');
  assert.notDeepEqual(grantMarksFor('enc', 58, 4, 7), { e: 0, c: [-1, -1, -1, -1] }, 'seed 58 rolls an elite and a champion for an encounter');
  assert.ok(grantSpeciesOf(231).has(0) && !grantSpeciesOf(232).has(0), 'a rat in 231\'s tables, none in 232\'s');
  assert.equal(grantSpeciesOf(-5), null);
});

test('GRANT3 THE OWNER: a turn\'s stands of a kind are one ask; each stands as its member - the grant\'s marks, through the street\'s gates; a record names its grant and member and a frame carries the grant once, again when signed again; a member\'s end frees the grant at the last; a grant near its end is renewed; one carried into the next cell is signed for it (mutants: a stand per ask; the grant\'s champion ignored; the last member\'s free never asked)', async () => {
  const R = await relay();
  const O = await player(R, OWNER);
  const stands = [0, 1, 2].map((k) => O.pool.spawnFoe(0, [100 + k, 0, 100], { grantKind: 'enc' }));
  const foes = await Promise.all(stands);
  await settle();
  const mints = O.session.asks.filter((a) => a.k === 'mint');
  assert.deepEqual(mints.map((a) => [a.kind, a.n]), [['enc', 3]], 'one ask for the turn\'s three');
  const gr = foes[0]._grant;
  assert.ok(gr && foes.every((f, i) => f._grant === gr && f._grantI === i), 'each its member');
  assert.equal(gr._members, 3);
  // the grant's marks: its champion's trait where the grant names one (seed of g 101), none where it names none
  for (const [i, f] of foes.entries()) {
    const want = gr.c[i] >= 0 && !((gr.e >>> i) & 1) && (f.entity.level | 0) >= 3 ? gr.c[i] : null;
    assert.equal(f.entity.champion ? ['mighty', 'stalwart', 'swift', 'vampiric', 'thorned'].indexOf(f.entity.champion) : null, want, `member ${i}`);
  }
  const full = O.pool.foesFrame(true);
  assert.deepEqual(full.f.map((r) => r.gr), [[gr.g, 0], [gr.g, 1], [gr.g, 2]]);
  assert.equal(full.gs.length, 1);
  assert.ok(validGrant(full.gs[0]) && full.gs[0].sg === gr.sg && !('_members' in full.gs[0]), 'its wire form, its bookkeeping home');
  foes[0].ai.feet[0] += 1;
  const delta = O.pool.foesFrame(false);
  assert.equal(delta?.gs, undefined, 'a delta carries a grant already said');
  // renewed near its end - the next delta says it again
  R.tick(GRANT_TTL_MS - GRANT_RENEW_LEAD_MS + 1);
  O.pool.foesFrame(false);
  await settle();
  const renewSg = O.session.asks.find((a) => a.k === 'renew')?.grs?.[0]?.sg;
  assert.deepEqual(O.session.asks.filter((a) => a.k === 'renew').map((a) => a.grs.map((g) => g.g)), [[gr.g]]);
  assert.ok(typeof renewSg === 'string' && renewSg !== gr.sg, 'renewed whole, its old signature with it (AUDIT GRANT A8) - and signed anew');
  assert.equal(gr.x, R.now + GRANT_TTL_MS, 'its expiry moved in place');
  foes[1].ai.feet[0] += 1;
  assert.equal(O.pool.foesFrame(false)?.gs?.[0]?.sg, gr.sg, 'signed again: said again');
  // carried into the next cell
  O.session.room = NEXT;
  O.pool.foesFrame(false);
  await settle();
  const carry = O.session.asks.filter((a) => a.k === 'carry');
  assert.equal(carry.length, 1);
  assert.equal(gr.q, NEXT, 'signed for the cell I stand in, in place');
  assert.deepEqual(O.pool.foesFrame(true).f.map((r) => r.gr[0]), [gr.g, gr.g, gr.g], 'its new number on every record');
  // the members end: the last frees it
  for (const f of foes.slice(0, 2)) O.pool.removeFoe(f);
  assert.equal(O.session.asks.filter((a) => a.k === 'free').length, 0, 'two of three gone: still mine');
  O.pool.removeFoe(foes[2]);
  await settle(1);   // AUDIT GRANT A7: a turn's frees, one ask at its end
  assert.deepEqual(O.session.asks.filter((a) => a.k === 'free').map((a) => a.gs), [[gr.g]]);
  // a grant naming its champions: each member stands as its grant says, never as the street's own roll would
  O.session.marks = { e: 0, c: [4, 4] };
  const marked = await Promise.all([0, 1].map((k) => O.pool.spawnFoe(WILD_GIANT, [140 + k, 0, 100], { grantKind: 'enc' })));
  assert.ok(marked.every((f) => (f.entity.level | 0) >= 3), 'a foe a trait may stand on');
  assert.deepEqual(marked.map((f) => f.entity.champion), ['thorned', 'thorned']);
});

test('GRANT3 THE READER: an honest owner\'s foes stand untallied; a forged elite, a species its pixel\'s tables do not hold, a class foe over the owner\'s level, a member standing twice, a grant under another\'s name, a record with none from an owner that carries them - each tallied by sender and reason, and handed to the cell; while the law enforces a forged grant or none stands down, never to be rebuilt on that grant, and a species off its tables stands (mutants: the marks unchecked; the species unchecked; the sender unchecked; the tally never handed on; every refusal stood down; a stood-down record rebuilt)', async () => {
  const R = await relay();
  const O = await player(R, OWNER);
  const foes = await Promise.all([0, 1].map((k) => O.pool.spawnFoe(0, [100 + k, 0, 100], { grantKind: 'enc' })));
  await settle();
  const honest = O.pool.foesFrame(true);
  const D = await player(R, READER, { climate: (x, y) => (x === 3 && y === 12 ? 231 : 232) });
  D.pool.applyFoes(OWNER, JSON.parse(JSON.stringify(honest)));
  await settle(12);
  assert.equal(D.pool.foes.filter((f) => f.puppet === OWNER).length, 2);
  assert.deepEqual([...D.host.tallied()], [], 'an honest owner\'s foes: nothing to refuse');
  const gr = foes[0]._grant;
  const forged = (recs, gs = honest.gs, n = 50) => ({ n, k: CELL, full: 0, f: recs, gs });
  const plainMember = [0, 1].find((i) => !((gr.e >>> i) & 1));
  D.pool.applyFoes(OWNER, forged([{ ...honest.f[plainMember], i: 900, gr: [gr.g, plainMember], z: 1 }], honest.gs, 60));   // an elite the grant never rolled, on a member it did
  await settle(12);
  D.pool.applyFoes(OWNER, forged([{ ...honest.f[0], i: 901, gr: [gr.g, 0] }], honest.gs, 61));   // member 0 a second time
  await settle(12);
  const { gr: _named, ...bare } = honest.f[0];
  void _named;
  D.pool.applyFoes(OWNER, forged([{ ...bare, i: 903 }], undefined, 63));   // no grant at all, from an owner that carries them
  await settle(12);
  D.pool.applyFoes('zzz-0009', forged([{ ...honest.f[0], i: 904 }], honest.gs, 1));   // another's grant under my name
  await settle(12);
  const t = D.host.tallied();
  assert.equal(t.get(`${OWNER}|marks`), 1, 'a forged elite');
  assert.equal(t.get(`${OWNER}|twice`), 1, 'a member standing twice');
  assert.equal(t.get(`${OWNER}|ungranted`), 1);
  assert.equal(t.get('zzz-0009|sender'), 1);
  assert.equal(t.size, 4, 'nothing else');
  // the species: the same grant read where its pixel's climate is 232 - no rat there
  const S = await player(R, 'sss-0004', { climate: () => 232 });
  S.pool.applyFoes(OWNER, JSON.parse(JSON.stringify(honest)));
  await settle(12);
  assert.equal(S.host.tallied().get(`${OWNER}|dice`), 2, 'a rat where its pixel\'s tables hold none, each');
  // the tally handed to the cell
  R.tick(GRANT_TALLY_MS);
  D.pool.foesFrame(false);
  const tally = D.session.asks.filter((a) => a.k === 'tally');
  assert.equal(tally.length, 1);
  assert.deepEqual(new Set(tally[0].rows.map((r) => `${r.o}|${r.r}`)), new Set([...t.keys()]));
  // GRANT6, enforcing: a forged grant or none stands down; what an honest client's timing or tables can give stands
  const E = await player(R, 'eee-0005', { mode: 'enforce', climate: () => 232 });
  E.pool.applyFoes(OWNER, JSON.parse(JSON.stringify(honest)));
  await settle(16);
  assert.equal(E.pool.foes.filter((f) => f.puppet === OWNER && !f.dead).length, 2, '`dice` is the measure\'s: both stand');
  E.pool.applyFoes(OWNER, forged([{ ...honest.f[plainMember], i: 900, gr: [gr.g, plainMember], z: 1 }], honest.gs, 60));
  await settle(16);
  E.pool.applyFoes(OWNER, forged([{ ...bare, i: 903 }], undefined, 63));
  await settle(16);
  assert.deepEqual([900, 903].map((i) => E.pool.foes.some((f) => f.puppet === OWNER && f.seq === i && !f.dead)), [false, false], 'a forged elite and a record with no grant never stand');
  assert.equal(E.pool.foes.filter((f) => f.puppet === OWNER && !f.dead).length, 2);
  // AUDIT GRANT A11: the same record again - never rebuilt, checked or tallied a second time
  const built = E.pool.foes.length, marks = E.host.tallied().get(`${OWNER}|marks`), check = E.host.check;
  let checks = 0;
  E.host.check = (...a) => { checks++; return check(...a); };
  E.pool.applyFoes(OWNER, forged([{ ...honest.f[plainMember], i: 900, gr: [gr.g, plainMember], z: 1 }], honest.gs, 64));
  await settle(16);
  E.host.check = check;
  assert.deepEqual([checks, E.pool.foes.length, E.host.tallied().get(`${OWNER}|marks`)], [0, built, marks], 'stood down once, on this grant: never built or checked again');
});

test('GRANT3 THE HEIR: a foe handed on at a death or a door asks the relay to sign its member to the heir, and the heir\'s game ties the grant to the foe it took - before or after the foe lands; the owner\'s member ends with it (mutants: the heir ask never sent; the heir\'s grant never tied)', async () => {
  const R = await relay();
  const O = await player(R, OWNER), H = await player(R, HEIR);
  const [f] = await Promise.all([O.pool.spawnFoe(0, [100, 0, 100], { grantKind: 'enc' })]);
  await settle();
  const gr = f._grant;
  H.pool.applyFoes(OWNER, JSON.parse(JSON.stringify(O.pool.foesFrame(true))));
  await settle(12);
  assert.equal(H.pool.foes.filter((x) => x.puppet === OWNER).length, 1);
  let handed = null;
  O.pool.handOver(() => HEIR, (batch) => { handed = batch; return true; });
  await settle(12);
  const heirAsk = O.session.asks.find((a) => a.k === 'heir')?.hs?.[0];
  assert.deepEqual([heirAsk?.to, heirAsk?.i, heirAsk?.gr.g], [HEIR, 0, gr.g]);
  assert.ok(O.session.asks.findIndex((a) => a.k === 'heir') < O.session.asks.findIndex((a) => a.k === 'free'), 'AUDIT GRANT A7: the heir asked before its grant is freed');
  assert.equal(gr._members, 0, 'the owner\'s member is gone');
  H.pool.applyFoes(OWNER, JSON.parse(JSON.stringify(handed)));
  await settle(12);
  const took = H.pool.foes.find((x) => !x.puppet && !x.dead);
  assert.ok(took, 'the heir took it');
  assert.ok(took._grant && took._grant.o === HEIR && took._grant.h === 0 && took._grant.s === gr.s, 'its member, signed to the heir');
  assert.deepEqual(H.pool.foesFrame(true).f.find((r) => r.i === took.seq)?.gr, [took._grant.g, 0]);
  // the foe lands before its grant: the heir's game waits on the grant, and ties it when it comes
  const [f2] = await Promise.all([O.pool.spawnFoe(0, [110, 0, 100], { grantKind: 'enc' })]);
  await settle();
  H.pool.applyFoes(OWNER, JSON.parse(JSON.stringify(O.pool.foesFrame(true))));
  await settle(12);
  const s2 = f2._grant.s;
  R.ctl.hold = true;
  O.pool.handOver(() => HEIR, (batch) => { handed = batch; return true; });
  await settle(12);
  H.pool.applyFoes(OWNER, JSON.parse(JSON.stringify(handed)));
  await settle(12);
  const took2 = H.pool.foes.find((x) => !x.puppet && !x.dead && x !== took);
  assert.ok(took2 && !took2._grant, 'the heir took it, its grant not come');
  for (const go of R.ctl.held) await go();
  await settle();
  assert.ok(took2._grant && took2._grant.s === s2 && took2._grant.h === 0 && took2._grant.o === HEIR, 'tied when it came');
});

test('GRANT3 THE LEVEL AND THE KEY: an encounter\'s class foe over the owner\'s signed level is refused `dice`, at it or under it stands, a guest\'s 0 says none; a grant read while the relay\'s key cannot be had is judged by nobody, and asked again after GRANT_KEY_RETRY_MS (mutants: the level law off; a missing key read as a forgery)', async () => {
  const R = await relay();
  const gr = await R.sign({ g: 7, o: OWNER, q: CELL, a: 'acct-x', k: 'enc', p: [3, 12], m: 9, l: 9, r: 7, n: 2, s: 5, e: 0, c: [-1, -1], h: -1, x: R.now + GRANT_TTL_MS });
  let calls = 0, keyed = false;
  const host = createGrantHost({ session: () => null, climateAt: () => 231, now: () => R.now, fetchKey: async () => { calls++; return keyed ? R.kp.publicKey : null; } });
  host.heard(OWNER, [gr]);
  assert.equal(await host.check(OWNER, CELL, { i: 1, t: 135, l: 20, gr: [7, 0] }), null, 'no key: judged by nobody');
  keyed = true;
  const g8 = await R.sign({ ...gr, g: 8, sg: undefined });
  host.heard(OWNER, [g8]);
  assert.equal(await host.check(OWNER, CELL, { i: 2, t: 135, l: 20, gr: [8, 0] }), null, 'inside the retry window: still none');
  assert.equal(calls, 1);
  R.tick(5 * 60_000);
  const g9 = await R.sign({ ...gr, g: 9, sg: undefined, x: R.now + GRANT_TTL_MS });
  host.heard(OWNER, [g9]);
  assert.equal(await host.check(OWNER, CELL, { i: 3, t: 135, l: 20, gr: [9, 0] }), 'dice', 'a class foe at 20 on a level-9 grant');
  assert.equal(calls, 2, 'the key asked again after the window');
  assert.equal(await host.check(OWNER, CELL, { i: 4, t: 135, l: 9, gr: [9, 1] }), null, 'at the owner\'s level');
  const guest = await R.sign({ ...gr, g: 10, l: 0, sg: undefined, x: R.now + GRANT_TTL_MS });
  host.heard(OWNER, [guest]);
  assert.equal(await host.check(OWNER, CELL, { i: 5, t: 135, l: 40, gr: [10, 0] }), null, 'a guest\'s grant says no level');
});
