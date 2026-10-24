// RVN-OWNERS-CHOICE (FIELD BUGS 2026-10-16b, bible/01-Overview/bugs/Field-Bugs-2026-10-16b.md; the Discord's "I erased a
// Revenant fro[m]..." thread: "I've been using a 3x disintegrate as my main spell lately ... I believe it bypasses the
// kill/spare on revenants. And it seems it does this to other players' revenants, too ... It probably shouldn't be doable
// to other peoples revs"; the screenshot "Sekrath the Undying (dead)", "Isn't he supposed to give you a choice?").
// A Disintegrate is a WHOLE blow (effects.js: `sinks.hurt(left, { whole: true })`), and both damage doors passed every
// whole blow over a revenant's last stand, its will and its kneel - Revenants.md's "a Disintegrate kills it outright",
// the owner's own rule. But a blow on another player's revenant goes to its owner, a kill as a kill (`z`, AUDIT PSCALE1
// DOORS-1), and the owner's door applied it as whole: anyone's Disintegrate closed anyone's revenant, record and all, and
// its owner never chose. Now a whole blow closes one only as its OWNER's (revenantFate.js ownersWholeKill): the
// player's own, never a peer's; anyone else's - a party member's `z`, a foe's, a round's that names nobody (a stat
// drained to zero) - is a killing blow like any other, and the choice is the owner's (Revenants.md section 15).
// Pinned over the REAL street pools - the striker's (its puppet, the real Disintegrate through the host's sink, the
// divert's word) and the owner's (that word applied at its door, the frame back) - and the dungeon's door mounted from
// its own source over the real law.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};
const N = await import('../../../src/systems/revenant/revenant.js');
const FT = await import('../../../src/systems/revenant/revenantFate.js');
const RC = await import('../../../src/systems/revenant/revenantCompanions.js');
const S = await import('../../../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../../../src/systems/playerDoor.js');
const { setRevenantPresenter } = await import('../../../src/systems/revenant/revenantVoice.js');
const { setTacticsClock, resetTactics } = await import('../../../src/ai/tactics.js');
const { resetBlows } = await import('../../../src/ai/foeBlows.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { _resetPartyScaleForTests } = await import('../../../src/systems/party/partyScale.js');
const { killIfAnyLiveStatZero } = await import('../../../src/systems/statMods.js');
const { applySpell } = await import('../../../src/systems/effects.js');
const { buildCustomSpell, blankEffectSettings } = await import('../../../src/systems/spell/spellMaker.js');
const { createExteriorFoes } = await import('../../../src/scenes/exteriorFoes.js');
const { Collider } = await import('../../../src/player/collider.js');

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const player = (id, name) => ({
  isPlayer: true, name, characterId: id, level: 10, reflexes: 2, skills: new Array(40).fill(40), skillUses: new Array(40).fill(0), career: {}, items: [],
  activeEffects: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, crimeCommitted: 4,
  health: 100, maxHealth: 100,
});
let T = 0;
setTacticsClock(() => T);
beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true); setPref('enhancedAI', false);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear(); _resetPartyScaleForTests();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  setPlayerDoor(null); setWorldMinutes(1440 + 120); T = 0; resetTactics(); resetBlows();
  setRevenantPresenter(() => true);
});

/** A record as a special foe's flight makes it (revenant_fate.test.js's). */
function revenantOf(p, rank = 1) {
  for (const x of N.livingRevenants().slice(0, Math.max(0, N.livingRevenants().length - N.REVENANT_MAX + 1))) N.revenantSlain(p, { revenant: { id: x.id } });   // UNQUIET (Revenants.md section 46): none rises while three hunt me - room made
  const r = N.revenantDeed(p, { mobileType: 2, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: 2, rolls: () => 0 });
  r.rank = rank;
  return r;
}

// ── the crafted world (revenant_fate.test.js's): one monster career, a texture stub ─────────────────────────────────
const careers = (() => {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  const NAME_FIELD = 14, ENTRY = 18, out = new Uint8Array(4 + b.length + ENTRY), dv = new DataView(out.buffer);
  dv.setInt16(0, 1, true); dv.setUint16(2, 0x0100, true); out.set(b, 4);
  const name = 'ENEMY002.CFG';
  for (let i = 0; i < name.length; i++) out[4 + b.length + i] = name.charCodeAt(i);
  dv.setInt32(4 + b.length + NAME_FIELD, b.length, true);
  return out;
})();
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20, getFrameCount: () => 5 };
/** One client's street pool (the streaming world's: `fates` on), on the cell's net - `hits` every word it sends. */
function client(me, self) {
  const hits = [];
  const pool = createExteriorFoes({
    renderer: {
      createBillboardBatch: (archive, record, size) => ({ archive, record, size, conceal: undefined, dissolve: undefined, origin: null }),
      destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map(), uploadTexture: () => ({}), uploadEmissionTexture: () => ({}),
    },
    collider: new Collider(() => 0),   // a real, empty collider (rvn4_stand.test.js's): the foes walk and the brain thinks
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return careers; throw new Error(`no ${n} here`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 1000, currentPixelKey: () => '3,12', inLocation: () => true,
    playerEntity: me, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
    fates: true, dropLoot: () => {}, shake: () => {},
  });
  pool.setNet({ selfId: () => self, room: () => 'world:3,12', inRoom: () => true, peers: () => [], now: () => 0, staleMs: 1e9,
    onPeerHit: (h) => { hits.push(h); return true; }, toWire: (p) => [p[0], p[1], p[2]], toScene: (p) => [p[0], p[1], p[2]] });
  return { pool, hits, me };
}
const settle = () => new Promise((res) => setTimeout(res, 20));
const step = (pool) => { T += 0.016; pool.update(0.016, [0, 0, 3], [0, 1.6, 3]); };

/** THE DISINTEGRATE - the real spell (5,255, chance 100) through the real cast engine, cast by `caster` on `g` through the
 *  streaming world's own spell sink (world.js foeSinks' hurt: the player's provenance, `whole` as the engine says). */
function disintegrate(c, g) {
  const spell = buildCustomSpell({ slots: [{ type: 5, subType: 255, settings: { ...blankEffectSettings(), chanceBase: 100 } }], rangeType: 2 });
  const sinks = { hurt: (n, o) => { const fp = o?.fromPlayer ?? true; if (n > 0) c.pool.damageFoe(g, n, [0, 0, 3], null, { fromPlayer: fp, kind: 'spell', whole: !!o?.whole, round: !!o?.round, element: o?.element ?? null }); } };
  return applySpell(spell, c.me.level, g.entity, sinks, () => 0.5, { level: c.me.level, entity: c.me }, {});
}
/** Ann (the owner) stands her revenant; Bob (a party member) stands its puppet from her frame. */
async function twoClients(rank = 1) {
  const ann = client(player('char-ann', 'Ann'), 'ann-0001');
  const bob = client(player('char-bob', 'Bob'), 'bob-0002');
  const r = revenantOf(ann.me, rank);
  const rev = await ann.pool.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: r });
  step(ann.pool);
  bob.pool.applyFoes('ann-0001', ann.pool.foesFrame(true));
  await settle();
  const pup = bob.pool.foes.find((f) => f.puppet === 'ann-0001' && f.seq === rev.seq);
  assert.ok(rev.entity.revenant?.id === r.id && pup, 'Ann\'s revenant, and Bob\'s puppet of it');
  return { ann, bob, r, rev, pup };
}
/** Bob's Disintegrate on his puppet of Ann's revenant: the word his divert sends, then applied at Ann's door. */
function bobDisintegrates({ ann, bob, rev, pup }) {
  bob.hits.length = 0;
  const out = disintegrate(bob, pup);
  assert.equal(out.disintegrated, 1, 'the spell landed');
  const hit = bob.hits.find((h) => h.to === 'ann-0001' && h.i === rev.seq);
  assert.ok(hit, 'the blow went to its owner');
  assert.equal(hit.z, 1, 'as a kill (AUDIT PSCALE1 DOORS-1: the striker\'s divert mints `z`)');
  ann.hits.length = 0;
  assert.equal(ann.pool.applyHit('bob-0002', hit), true, 'the owner\'s door takes it');
  return hit;
}

test('RVN-OWNERS-CHOICE THE LAW: a whole blow closes one of my revenants outright only as its owner\'s - the player\'s own; a peer\'s, a foe\'s, a round\'s that names nobody, and any blow that is not whole, do not (mutants: a peer\'s whole kills; a foe\'s whole kills; any whole kills; a blow not whole kills)', () => {
  assert.equal(FT.ownersWholeKill(true, { fromPlayer: true, peer: false }), true, 'my Disintegrate, my Razor');
  assert.equal(FT.ownersWholeKill(true, { fromPlayer: true, peer: true }), false, 'a party member\'s, applied at my door');
  assert.equal(FT.ownersWholeKill(true, { fromPlayer: false, peer: false }), false, 'a foe\'s spell, a companion\'s, a stat drained to zero (nobody\'s tick)');
  assert.equal(FT.ownersWholeKill(true, {}), false, 'a blow that names nobody');
  assert.equal(FT.ownersWholeKill(false, { fromPlayer: true, peer: false }), false, 'my blow, not whole: a killing blow, which kneels it');
});

test('RVN-OWNERS-CHOICE THE REPORT, on the real street pools: a party member\'s Disintegrate on my revenant - the real spell, through his divert, its `z` applied at my door - KNEELS it: alive at 1, its record open, no `slain` back to him; my next frame kneels his puppet; the choice opens on my side alone, and I spare it (mutants: the yield passed over for a peer\'s whole blow; the gate back to any whole)', async () => {
  const two = await twoClients(1);
  const { ann, bob, r, rev, pup } = two;
  bobDisintegrates(two);
  assert.equal(pup.dead, false, 'his copy takes no blow of its own - it went to me');
  assert.equal(rev.dead, false, 'not deleted');
  assert.ok(rev.yielded, 'it kneels');
  assert.equal(rev.entity.health, 1);
  assert.equal(N.revenantById(r.id).defeated, false, 'its record open');
  assert.equal(N.revenantById(r.id).history.at(-1).deed, 'yielded');
  assert.equal(ann.hits.some((h) => h.slain === 1), false, 'no kill said back to the striker');
  // my frame carries the kneel, and his puppet kneels from it
  const rec = ann.pool.foesFrame(true).f.find((x) => x.i === rev.seq);
  assert.equal(rec.yd, 1);
  bob.pool.applyFoes('ann-0001', ann.pool.foesFrame(true));
  await settle();
  assert.equal(pup._pupYield, true, 'his copy kneels');
  assert.equal(bob.pool.fateFor(pup), null, 'the choice is not his');
  const m = ann.pool.fateFor(rev);
  assert.deepEqual(m.options.map((o) => o.id), ['kill', 'spare'], 'the choice is mine');
  assert.equal(ann.pool.chooseFate(rev, 'spare'), true);
  assert.equal(N.revenantById(r.id).sworn, true, 'and what I chose stands');
});

// PIN MOVED (RVN-OWN-KNEEL, FIELD BUGS 2026-10-17g - "Disintegrate just outright kills your rev with no option to hire"):
// my own Disintegrate passes the stand and the will and KNEELS it; it no longer closes the record (fb1017g_rvnownkneel).
test('RVN-OWNERS-CHOICE MY OWN Disintegrate (the same spell, my own door) kneels my revenant - its record open, past the last stand at rank 3; a stat drained to zero (a round\'s, nobody\'s) kneels it too (mutants: my whole kill withheld; nobody\'s whole kills)', async () => {
  const ann = client(player('char-ann', 'Ann'), 'ann-0001');
  const r = revenantOf(ann.me, 1);
  const rev = await ann.pool.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: r });
  step(ann.pool);
  assert.equal(disintegrate(ann, rev).disintegrated, 1);
  assert.equal(rev.dead, false, 'my Disintegrate no longer deletes it');
  assert.ok(rev.yielded, 'it kneels - the kill-or-spare mine');
  assert.equal(N.revenantById(r.id).defeated, false, 'its record open');
  const r3 = revenantOf(ann.me, 3);
  const three = await ann.pool.spawnFoe(2, [4, 0, 0], { feetGiven: true, level: 6, revenant: r3 });
  step(ann.pool);
  disintegrate(ann, three);
  assert.equal(three.roaring, undefined, 'no last stand against it (Revenants.md section 20)');
  assert.ok(three.yielded, 'rank 3: to its knees all the same');
  assert.equal(N.revenantById(r3.id).defeated, false);
  // a stat drained to zero: the engine's own kill (statMods.js), through the pool's own foe sinks - a round names nobody
  const r2 = revenantOf(ann.me, 1);
  const g = await ann.pool.spawnFoe(2, [2, 0, 0], { feetGiven: true, level: 6, revenant: r2 });
  step(ann.pool);
  g.entity.stats.strength = 0;
  const nobodys = { hurt: (n, o) => ann.pool.damageFoe(g, n, null, null, { fromPlayer: false, kind: 'spell', whole: !!o?.whole, round: !!o?.round, element: o?.element ?? null }) };   // exteriorFoes.js foeSinks' hurt
  assert.equal(killIfAnyLiveStatZero(g.entity, nobodys, 10), true, 'the drain\'s kill');
  assert.equal(g.dead, false);
  assert.ok(g.yielded, 'it kneels - the choice still mine');
  assert.equal(N.revenantById(r2.id).defeated, false);
  assert.match(read('src/scenes/exteriorFoes.js'), /hurt: \(n, o\) => damageFoe\(f, n, null, null, \{ fromPlayer: false, kind: 'spell', whole: !!o\?\.whole, round: !!o\?\.round, element: o\?\.element \?\? null \}\),/, 'the pool\'s own foe sink, as mounted');
  assert.match(read('src/scenes/world.js'), /hurt: \(n, o\) => \{ const fp = o\?\.fromPlayer \?\? fromPlayer; if \(n > 0\) \(g\._encounter \? exteriorFoes\.damageFoe\(g, n, player\.pos, null, \{ fromPlayer: fp, kind: 'spell', whole: !!o\?\.whole, round: !!o\?\.round, element: o\?\.element \?\? null \}\)/, 'the streaming world\'s spell sink, as cast through');
});

test('RVN-OWNERS-CHOICE RANK 3: a party member\'s Disintegrate brings its LAST STAND, as any killing blow does; the next, its will unbroken, it TEARS AWAY - never closed by his hand (mutants: the stand passed over for a peer\'s whole blow)', async () => {
  const two = await twoClients(3);
  const { ann, r, rev } = two;
  bobDisintegrates(two);
  assert.equal(rev.dead, false);
  assert.ok(rev.roaring, 'its last stand');
  assert.equal(rev.entity.health, Math.round(rev.entity.maxHealth * 0.3));
  assert.equal(N.revenantById(r.id).history.at(-1).deed, 'laststand');
  rev.roaring.until -= 5000;
  step(ann.pool);
  assert.equal(rev.roaring, null, 'the roar spent');
  two.bob.pool.applyFoes('ann-0001', ann.pool.foesFrame(true));
  await settle();
  bobDisintegrates(two);
  assert.equal(rev.dead, false);
  assert.ok(rev.leaving, 'unbroken, it tears away');
  assert.equal(N.revenantById(r.id).defeated, false, 'its record open');
});

// ── underground: the dungeon's door, mounted from its own source over the real law ─────────────────────────────────
const D = read('src/scenes/dungeonContext.js');
/** dungeonContext.js damageFoe's death arm, from the floor to the soul trap: the bout, the companion, the stand, the
 *  will and the kneel - mounted with the real revenantFate.js, its own hooks recorded. */
function dungeonDeathArm(scope) {
  const a = D.indexOf('  function damageFoe(foe, damage, playerFeet = null, knockDir = null,');
  const b = D.indexOf('    if (foe.entity.health <= 0) {', a);
  const c = D.indexOf('      const _peerTrap = peerSoulTrapOf(foe.entity);', b);
  assert.ok(a > 0 && b > a && c > b, 'the dungeon\'s door and its death arm are found');
  const arm = D.slice(b, c);
  assert.match(arm, /lastStandDungeonFoe\(foe\); return; \}/);
  assert.match(arm, /yieldDungeonFoe\(foe\); return; \}/);
  const k = Object.keys(scope);
  return new Function(...k, `return (foe, _whole, fromPlayer, peer, bout = null, striker = null) => {\n${arm}\n      return 'dies';\n    }\n    return 'alive';\n  };`)(...k.map((x) => scope[x]));
}

// PIN MOVED (RVN-OWN-KNEEL, FIELD BUGS 2026-10-17g): my own whole blow kneels it underground too.
test('RVN-OWNERS-CHOICE UNDERGROUND (the dungeon\'s door, its lair\'s stand online - a loose foe of mine): my own whole blow kneels; a party member\'s (applyOwnHit\'s `z`) kneels it, stands it at rank 3, and tears it away once stood; a foe\'s kneels it; a room\'s shared foe online dies as ever (mutants: the dungeon\'s stand or kneel passed over for a peer\'s whole blow; my whole kill withheld underground)', async () => {
  const ann = client(player('char-ann', 'Ann'), 'ann-0001');
  const seen = [];
  const scope = {
    ownersWholeKill: FT.ownersWholeKill, revenantLastStandDue: FT.revenantLastStandDue, revenantMayYield: FT.revenantMayYield, revenantWillHolds: FT.revenantWillHolds,
    lastStandDungeonFoe: (f) => { seen.push('stand'); f._lastStood = true; }, tearAwayDungeonFoe: () => seen.push('tear'), yieldDungeonFoe: () => seen.push('kneel'),
    onlineRoom: () => true, isRoomFoe: (f) => !!f._room, opts: { fates: true },
  };
  const arm = dungeonDeathArm(scope);
  // the revenant as a pool stands it (applyRevenant's stamp), at the floor
  const stand = async (rank, extra = {}) => { const f = await ann.pool.spawnFoe(2, [0, 0, 0], { feetGiven: true, level: 6, revenant: revenantOf(ann.me, rank) }); f.entity.health = 0; return Object.assign(f, extra); };
  const run = (f, whole, fromPlayer, peer) => { seen.length = 0; const out = arm(f, whole, fromPlayer, peer); return seen[0] ?? out; };
  assert.equal(run(await stand(1), true, true, false), 'kneel', 'my own Disintegrate kneels it');
  assert.equal(run(await stand(1), true, true, true), 'kneel', 'a party member\'s kneels it');
  assert.equal(run(await stand(1), true, false, false), 'kneel', 'a foe\'s, nobody\'s, kneels it');
  assert.equal(run(await stand(1), false, true, true), 'kneel', 'a party member\'s ordinary killing blow, as ever');
  const three = await stand(3);
  assert.equal(run(three, true, true, true), 'stand', 'rank 3: its last stand');
  assert.equal(run(three, true, true, true), 'tear', 'once stood, unbroken: it tears away');
  assert.equal(run(await stand(3), true, true, false), 'kneel', 'my own kneels it at rank 3, past its stand');
  assert.equal(run(await stand(1, { _room: true }), true, true, true), 'dies', 'a room\'s shared foe online: no fate (REVENANT-DUNGEON\'s gate, unchanged)');
  // the word that reaches it: a party member's blow on my loose stand lands through landPeerBlow as a PEER's, its `z` whole
  assert.match(D, /const landed = landPeerBlow\(f, id, data, dmg\);/);
  assert.match(D, /damageFoe\(f, dmg, at, dir, \{ fromPlayer: true, peer: true, kind, peerId: id, whole: data\.z === 1,/);
});
