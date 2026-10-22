// FOE-BOUNDS and GRANT-DOOR (2026-10-19, Mac: the hand-off spec "LATTY: REJECT AND REMOVE INVALID ENEMY HANDOFFS; DO NOT
// RESCALE", then "Spec + B + A"; bible/11-Multiplayer/Spawn-Grants.md sections 19 and 20): THE READER'S HALF, over two real
// street pools (scenes/exteriorFoes.js) each with its own grants' host (scenes/grantHost.js) - a record no builder could
// give is never built, never updated and never ADOPTED: a hand-off of it is refused before it is mine, its copy taken
// down silently (no death, no body, no loot), tallied once against its SENDER and never against me; an ally is
// unverified; the staff's `off` switch judges nothing; a relay before world223 is never handed `stats`; and a sender the
// relay vouched stands on grants is held to them from its first frame.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createGrantHost } from '../../src/scenes/grantHost.js';
import { foeHealthBound } from '../../src/net/foeBounds.js';
import { signGrant, grantMarksFor, GRANT_TTL_MS, GRANT_TALLY_MS } from '../../src/net/grantLaw.js';

const { subtle } = globalThis.crypto;
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const CELL = 'world:3,12', OWNER = 'aaa-0001', READER = 'mmm-0002';
const cfg = () => { const b = new Uint8Array(74); const v = new DataView(b.buffer); v.setUint16(52, 4, true); [40, 50, 50, 85, 50, 50, 90, 55].forEach((x, i) => v.setUint16(58 + i * 2, x, true)); return b; };
const bsa = (() => {
  const recs = [['ENEMY000.CFG', cfg()]], NAME = 14, ENTRY = 18, len = recs.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + len + ENTRY * recs.length), v = new DataView(out.buffer);
  v.setInt16(0, recs.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, b] of recs) { out.set(b, pos); pos += b.length; }
  for (const [name, b] of recs) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME, b.length, true); pos += ENTRY; }
  return out;
})();
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const playerEntity = () => ({ level: 9, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 }, gold: 0 });

async function relay() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  let n = 100;
  const session = (id, { mode = 'measure', statsOk = true } = {}) => {
    const s = { id, room: CELL, status: 'open', grantMode: mode, grantStatsOk: statsOk, grantSenders: new Set(), asks: [], host: null, sendGrant(ask) { s.asks.push(ask); void reply(s, ask); return true; } };
    return s;
  };
  async function reply(s, ask) {
    if (ask.k !== 'mint') return;
    const seed = 7, gr = { g: ++n, o: s.id, q: s.room, a: `acct-${s.id}`, k: ask.kind, p: [3, 12], m: 9, l: 9, r: 7, n: ask.n, s: seed, ...grantMarksFor('quest', seed, ask.n, 7), h: -1, x: Date.now() + GRANT_TTL_MS };
    await settle(1);
    s.host?.answer({ k: 'ok', id: ask.id, gr: { ...gr, sg: await signGrant(gr, kp.privateKey, { subtle }) } });
  }
  return { kp, session };
}
function pool(self, g) {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }) },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12', inLocation: () => false,
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => CELL, selfId: () => self, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]], grants: g.host });
  return p;
}
async function player(R, id, opts = {}) {
  const session = R.session(id, opts);
  const host = createGrantHost({ session: () => session, climateAt: () => 231, fetchKey: async () => R.kp.publicKey, wait: 500 });
  session.host = host;
  const g = { session, host };
  return { ...g, pool: pool(id, g) };
}
/** The owner's two rats - an honest full frame - and a reader that stood them. */
async function stood(readerOpts = {}) {
  const R = await relay();
  const O = await player(R, OWNER);
  await Promise.all([0, 1].map((k) => O.pool.spawnFoe(0, [100 + k, 0, 100], { grantKind: 'quest' })));
  await settle();
  const honest = JSON.parse(JSON.stringify(O.pool.foesFrame(true)));
  const D = await player(R, READER, readerOpts);
  D.pool.applyFoes(OWNER, honest);
  await settle();
  return { R, O, D, honest };
}
const puppets = (D) => D.pool.foes.filter((f) => f.puppet === OWNER && !f._gone);

test('FOE-BOUNDS A HAND-OFF NO BUILDER COULD GIVE IS REFUSED BEFORE IT IS MINE: an owner hands me a rat of 99,999 health - never adopted (nothing of it rides as mine), its copy taken down without a death, a body or its loot, tallied once against its SENDER and never against me, however often it is said; its honest twin and the maximum itself stand (mutants: the check left out of the street pool; a hand-off adopted before the check; tallied every frame)', async () => {
  const { D, honest } = await stood();
  assert.equal(puppets(D).length, 2, 'the honest pair stands');
  const mx = foeHealthBound({ t: 0 }, { wild: true, camp: false });   // STAR-TUNE: its frame tags no camp (unknown, a fallen star's coven's x2 is the worst)
  const atMax = { ...honest, n: 40, full: 0, f: [{ ...honest.f[1], k: mx, h: mx }] };
  D.pool.applyFoes(OWNER, atMax);
  await settle();
  assert.equal(puppets(D).find((f) => f.seq === honest.f[1].i)?.entity.maxHealth, mx, 'the maximum itself stands');
  const handed = { ...honest, n: 41, full: 0, f: [{ ...honest.f[0], k: 99_999, h: 99_999, e: READER, it: [] }] };
  for (let n = 41; n < 44; n++) { D.pool.applyFoes(OWNER, { ...handed, n }); await settle(); }
  assert.equal(puppets(D).length, 1, 'its copy taken down');
  assert.equal(D.pool.foes.filter((f) => !f.puppet && !f._gone && !f.dead).length, 0, 'never adopted - nothing of it is mine');
  const gone = D.pool.foes.find((f) => f.seq === honest.f[0].i || f._pupKey === `${OWNER}:${honest.f[0].i}`);
  assert.ok(!gone || (gone._gone && !gone.corpse && !gone.corpseMarker), 'no body, no pile');
  assert.equal(D.pool.foesFrame(true)?.f?.length ?? 0, 0, 'nothing of it rides as mine');
  assert.deepEqual([...D.host.tallied()], [[`${OWNER}|stats`, 1]], 'once, against its sender - never against me');
});

test('FOE-BOUNDS A RECORD NO BUILDER COULD GIVE IS NEVER BUILT: a new number at 50,000 stands nothing; a forged watchman\'s elite neither; an ally, a companion or a crewman is unverified (mutants: an ally refused; the record built first)', async () => {
  const { D, honest } = await stood();
  D.pool.applyFoes(OWNER, { ...honest, n: 50, full: 0, f: [{ ...honest.f[0], i: 700, k: 50_000, h: 50_000 }] });
  await settle();
  assert.equal(puppets(D).length, 2, 'never built');
  D.pool.applyFoes(OWNER, { ...honest, n: 51, full: 0, f: [{ ...honest.f[0], i: 701, k: 50_000, h: 50_000 }], cp: [701], cn: ['Sworn'] });
  await settle();
  assert.equal(puppets(D).length, 3, 'a companion: unverified, stood');
  assert.equal(D.host.tallied().get(`${OWNER}|stats`), 1, 'the companion tallied nothing');
});

test('FOE-BOUNDS THE STAFF\'S SWITCH, AND AN OLDER RELAY: while the law is `off` nothing is judged; a relay before world223 is never handed `stats` - the rest of the tally goes (mutants: judged with the law off; `stats` to an older relay)', async () => {
  const { D, honest } = await stood();
  D.session.grantMode = 'off';
  D.pool.applyFoes(OWNER, { ...honest, n: 60, full: 0, f: [{ ...honest.f[0], i: 800, k: 50_000, h: 50_000 }] });
  await settle();
  assert.equal(puppets(D).length, 3, 'off: stood as it ever was');
  assert.equal(D.host.tallied().get(`${OWNER}|stats`), undefined, 'and no `stats` tallied');
  const { D: E, honest: h2 } = await stood({ statsOk: false });
  E.pool.applyFoes(OWNER, { ...h2, n: 61, full: 0, f: [{ ...h2.f[0], i: 801, k: 50_000, h: 50_000 }, { ...h2.f[0], i: 802, gr: undefined }] });
  await settle();
  assert.deepEqual([...E.host.tallied()].map(([k]) => k).sort(), [`${OWNER}|stats`, `${OWNER}|ungranted`]);
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + GRANT_TALLY_MS + 1000;
    E.host.tick();
  } finally { Date.now = realNow; }
  const tally = E.session.asks.filter((a) => a.k === 'tally');
  assert.deepEqual(tally.map((a) => a.rows.map((r) => r.r)), [['ungranted']], 'an older relay: no `stats`');
});

test('GRANT-DOOR A SENDER THE RELAY VOUCHES STANDS ON GRANTS IS HELD TO THEM FROM ITS FIRST FRAME: a record with no grant from a peer whose frames came vouched (net/online.js grantSenders) is `ungranted`, though it never carried one; from one never vouched and never seen with a grant, nothing (mutants: the vouch unread)', async () => {
  const R = await relay();
  const D = await player(R, READER);
  const bare = { n: 1, k: CELL, full: 1, f: [{ i: 1, t: 0, x: 0, f: [100, 0, 100], y: 0, h: 20, k: 20, l: 1 }] };
  D.pool.applyFoes('zzz-0001', JSON.parse(JSON.stringify(bare)));
  await settle();
  assert.equal(D.host.tallied().size, 0, 'an old build\'s foe: never held to a grant');
  D.session.grantSenders.add('zzz-0002');
  D.pool.applyFoes('zzz-0002', JSON.parse(JSON.stringify(bare)));
  await settle();
  assert.equal(D.host.tallied().get('zzz-0002|ungranted'), 1, 'vouched: held to them');
});

test('FOE-BOUNDS THE FOUR HOSTS: the street\'s pool and a building\'s (one createExteriorFoes) refuse in their record loop; the dungeon refuses in its own lane\'s loop and on the host\'s stream (applyFoeRecord); scenes/exterior.js streams no foe (mutants: the dungeon\'s lanes unchecked)', () => {
  const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  const dc = rd('src/scenes/dungeonContext.js');
  assert.ok(dc.includes("if (grants?.()?.statsRefused?.(from, r, { lane: 'dungeon', ally: lo && comp.has(r.i) })) { if (f) dropOwnPuppet(key, f); _ownPending.delete(key); continue; }"), 'the own lane');
  assert.ok(dc.includes("if (!r) return;\n    if (grants?.()?.statsRefused?.(f._ownFrom ?? _foesFrom, { ...r, t: r.t ?? f.mobileType, l: r.l ?? f.streamedLevel }, { lane: 'dungeon' })) return;"), 'the host\'s stream');
  assert.ok(rd('src/scenes/worldModes.js').includes('createExteriorFoes'), 'a building\'s pool is the street\'s');
  assert.ok(!rd('src/scenes/exterior.js').includes('applyFoes'), 'the old exterior streams none');
});
