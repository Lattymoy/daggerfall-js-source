// REST-SYNC (2026-09-26, Mac: "when resting in a dungeon it spawns enemys that are out of sync with others"; asked,
// "Sync them into the room"): a rest's encounter was spawned past the layout's run - the resting player's own foe,
// in no frame anyone received, hunting only its spawner. It is the ROOM's now: the host stands it SHARED (numbered by
// the room), streams it on the layout's own frame, and every joiner stands it as a puppet, strikes it through the
// host and loots its body as the room's container; a joiner's own rest ASKS the host for its encounter. Mounted, not
// matched: the statements are sliced out of the context's source (test/audit68_dungeonctx.test.js's harness) and run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { validFoeRecord, hitPoisonOf, FOE_HEALTH_MAX, FOE_LEVEL_MAX, FOES_FRAME_MAX, PARTY_MAX } from '../src/net/wire.js';
import { ELITE_FOE_MULTIPLIER } from '../src/world/spawnedDungeons.js';

const D = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const AST = acorn.parse(D, { ecmaVersion: 'latest', sourceType: 'module' });

function find(pred) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(AST);
  return hit;
}
const fnSrc = (name) => {
  const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name);
  assert.ok(n, `src has function ${name}`);
  return D.slice(n.start, n.end);
};
const declSrc = (name) => {
  const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name));
  assert.ok(n, `src declares ${name}`);
  return D.slice(n.start, n.end);
};
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const tick = () => new Promise((r) => setTimeout(r, 0));

const CONSTS = ['REST_ASK_WAIT_MS', 'REST_ASK_GAP_MS', 'REST_ASK_BAND_MAX', 'SHARED_FOES_MAX', 'HIT_POS_MAX', 'HIT_DMG_MAX', 'q2', 'q3'];
const consts = () => CONSTS.map(declSrc).join('\n');
const K = mount(`${consts()}\nreturn { ${CONSTS.join(', ')} };`, {});

/** A dungeon foe as the pool holds it, as far as these doors read it. */
const foe = (over = {}) => ({
  mobileType: 5, gender: 'male', dead: false, corpse: false, batch: { b: 1 },
  ai: { feet: [0, 0, 0], yaw: 0, moving: false, target: null, height: 1.8 },
  entity: { health: 30, maxHealth: 30, items: [] },
  ...over,
});
const HIT = { mobileType: 5, minDistance: 4, maxDistance: 20, lineOfSightCheck: true };

/** The rest's three doors - the encounter, its ask's latch and the host's answer - over a stub spawner. */
function restDoors(over = {}) {
  const spawned = [], asked = [];
  const state = {
    opts: { selfId: () => null, onActions: (d) => { asked.push(d); return true; } },
    _authority: true, lastPlayerFeet: [1.234, 2, 3.456], _motorYaw: 0.5, _locationKey: 'dungeon:7', _restAskAt: null,
    _askAt: new Map(), ENEMY_BASICS: { 5: {}, 9: {} }, clock: 1000,
    _spawnEncounter: (hit, o) => { spawned.push([hit, o]); return Promise.resolve(null); },
    ...over,
  };
  state.Date = { now: () => state.clock };
  const doors = mount(`
    ${consts()}
    ${declSrc('onlineRoom')}
    ${fnSrc('restEncounter')}
    ${fnSrc('roomEncounterComing')}
    ${fnSrc('roomEncounterAsked')}
    return { restEncounter, roomEncounterComing, roomEncounterAsked };
  `, state);
  return { ...doors, state, spawned, asked };
}

test('REST-SYNC: offline the rest\'s encounter is the player\'s own; the host stands it SHARED; a joiner ASKS the host and stands nothing of its own', () => {
  const off = restDoors();
  off.restEncounter(HIT);
  assert.deepEqual(off.spawned, [[HIT, undefined]], 'offline: DFU\'s own spawn, nothing shared');
  assert.deepEqual(off.asked, []);
  const host = restDoors({ opts: { selfId: () => 'me', onActions: () => assert.fail('the host asks nobody') } });
  host.restEncounter(HIT);
  assert.deepEqual(host.spawned, [[HIT, { shared: true }]], 'the host: the room\'s encounter');
  const j = restDoors({ _authority: false });
  j.state.opts.selfId = () => 'me';
  assert.equal(j.roomEncounterComing(), false, 'nothing asked, nothing coming');
  j.restEncounter(HIT);
  assert.deepEqual(j.spawned, [], 'a joiner stands no foe only it can see');
  assert.deepEqual(j.asked, [{ k: 'dungeon:7', rs: { t: 5, lo: 4, hi: 20, v: 1, f: [1.23, 2, 3.46], y: 0.5 } }], 'it asks the host, by its own feet and facing');
  assert.equal(j.roomEncounterComing(), true, 'the rest breaks at the hour\'s check, as DFU\'s does');
  assert.equal(j.roomEncounterComing(), false, 'once');
  j.restEncounter(HIT);
  j.state.clock += K.REST_ASK_WAIT_MS + 1;
  assert.equal(j.roomEncounterComing(), false, 'an ask older than the wait breaks nothing');
  const refused = restDoors({ _authority: false, opts: { selfId: () => 'me', onActions: () => false } });
  refused.restEncounter(HIT);
  assert.equal(refused.roomEncounterComing(), false, 'an ask the wire refused breaks nothing');
  assert.deepEqual(refused.spawned, [], 'and stands nothing - never the private foe of the report');
  const noFeet = restDoors({ _authority: false, lastPlayerFeet: null });
  noFeet.state.opts.selfId = () => 'me';
  noFeet.restEncounter(HIT);
  assert.deepEqual(noFeet.asked, [], 'no feet, no ask');
});

test('REST-SYNC: the host stands a joiner\'s ask by the JOINER\'s feet, shared - and refuses what no honest rest asks', () => {
  const ask = { t: 5, lo: 4, hi: 20, v: 1, f: [10, 1, -4], y: 0.25 };
  const h = restDoors({ opts: { selfId: () => 'host', onActions: () => true } });
  assert.equal(h.roomEncounterAsked('peerA', ask), true);
  assert.deepEqual(h.spawned, [[{ mobileType: 5, minDistance: 4, maxDistance: 20, lineOfSightCheck: true }, { feet: [10, 1, -4], yaw: 0.25, shared: true }]], 'by the asker\'s feet and facing, the room\'s');
  assert.equal(h.roomEncounterAsked('peerA', ask), false, 'one ask a player a gap');
  assert.equal(h.roomEncounterAsked('peerB', { ...ask, v: 0 }), true, 'another player\'s is its own');
  assert.equal(h.spawned[1][0].lineOfSightCheck, false);
  h.state.clock += K.REST_ASK_GAP_MS;
  assert.equal(h.roomEncounterAsked('peerA', ask), true, 'and the next rest\'s, past the gap');
  const bad = restDoors({ opts: { selfId: () => 'host', onActions: () => true } });
  for (const [why, rs] of [
    ['no species', { ...ask, t: 77 }], ['a species not whole', { ...ask, t: 5.5 }],
    ['a band past any rest', { ...ask, hi: K.REST_ASK_BAND_MAX + 1 }], ['a band upside down', { ...ask, lo: 21 }], ['a band below the feet', { ...ask, lo: -1 }],
    ['feet out of reach', { ...ask, f: [K.HIT_POS_MAX * 2, 0, 0] }], ['feet not numbers', { ...ask, f: [0, NaN, 0] }], ['two feet', { ...ask, f: [0, 0] }],
  ]) assert.equal(bad.roomEncounterAsked('peerC', rs), false, why);
  assert.equal(bad.roomEncounterAsked('peerC', [ask]), false, 'an array is no ask');
  assert.equal(bad.roomEncounterAsked(7, ask), false, 'nor a number anyone');
  assert.deepEqual(bad.spawned, [], 'nothing stood');
  assert.equal(bad.roomEncounterAsked('peerC', ask), true, 'and a refused ask spent nobody\'s gap');
  const joiner = restDoors({ _authority: false, opts: { selfId: () => 'me', onActions: () => true } });
  assert.equal(joiner.roomEncounterAsked('peerA', ask), false, 'a joiner answers no ask - the host stands the room\'s foes');
  assert.equal(restDoors().roomEncounterAsked('peerA', ask), false, 'offline there is no room');
});

/** One side of the room: the frame out (a host) and in (a joiner), the room's encounters and their puppets. */
function side({ authority, layout = [], shared = [], over = {} }) {
  const foes = [...layout, ...shared];
  const built = [], applied = [], destroyed = [], dropped = [];
  const state = {
    _authority: authority, _layoutFoes: layout.length, foes, _sharedById: new Map(shared.map((f) => [f._encId, f])),
    _sharedSeq: Math.max(0, ...shared.map((f) => f._encId)), _sharedPending: new Map(), _ctxDead: false,
    _foesSeq: 0, _foesSeqIn: -1, _foesFrom: null, _locationKey: 'dungeon:7', _keyMismatchSaid: false, _retypeFails: new Map(), RETYPE_TRIES: 3,
    FOE_HEALTH_MAX, FOE_LEVEL_MAX, validFoeRecord, GENDER_BIT: ['male', 'female'],
    fightN: () => 1, canStandFoe: () => true, retypeFoe: () => assert.fail('the layout agrees'),
    applyFoeRecord: (f, r) => { applied.push([f, r]); f.ai.feet = [...(r.f ?? f.ai.feet)]; if (r.d === 1) f.dead = true; },
    buildFoeAt: async (e) => { const f = foe({ mobileType: e.mobileType, gender: e.gender, ai: { feet: [e.x, e.y, e.z], yaw: 0 } }); built.push(f); foes.push(f); return f; },
    renderer: { destroyBillboardBatch: (b) => destroyed.push(b) }, freeCorpse: (f) => { f.corpse = false; }, dropCandidate: (f) => dropped.push(f),
    console: { warn() {}, error: (...a) => assert.fail(a.join(' ')) },
    FOES_FRAME_MAX,
    ...over,
  };
  const api = mount(`
    ${consts()}
    ${declSrc('isRoomFoe')}
    ${declSrc('FOES_FRAME_SLACK')}
    ${fnSrc('_sharedFoe')}
    ${fnSrc('foesFrame')}
    ${fnSrc('roomRecord')}
    ${fnSrc('applyFoesFrame')}
    ${fnSrc('applySharedRecords')}
    ${fnSrc('standSharedPuppet')}
    ${fnSrc('dropSharedFoe')}
    return { foesFrame, applyFoesFrame };
  `, state);
  return { ...api, state, foes, built, applied, destroyed, dropped };
}

test('REST-SYNC: the encounter rides the host\'s frame by the room\'s number; a joiner stands it as a puppet, poses it, and takes it down when a full frame no longer lists it', async () => {
  const enc = foe({ mobileType: 9, gender: 'female', _encId: 1, ai: { feet: [4, 0, 6], yaw: 1, moving: false, target: null } });
  const host = side({ authority: true, layout: [foe()], shared: [enc] });
  const full = host.foesFrame(true);
  assert.equal(full.f.length, 1, 'the layout\'s run, as before');
  assert.equal(full.xf, 1, 'a full frame says it lists the room\'s encounters whole');
  assert.equal(full.x.length, 1);
  assert.deepEqual([full.x[0].i, full.x[0].t, full.x[0].x, full.x[0].f], [1, 9, 1, [4, 0, 6]], 'by the room\'s number, its species, its sex and its feet');
  assert.equal(host.foesFrame(false), null, 'and a quiet room says nothing between');
  const joiner = side({ authority: false, layout: [foe()] });
  assert.equal(joiner.applyFoesFrame(full, 'host'), true);
  await tick();
  assert.equal(joiner.built.length, 1, 'a puppet stood from its first record');
  const pup = joiner.state._sharedById.get(1);
  assert.ok(pup && joiner.foes.includes(pup), 'in the joiner\'s pool, by the room\'s number');
  assert.deepEqual([pup.mobileType, pup.gender, pup._encId], [9, 'female', 1]);
  assert.ok(joiner.applied.some(([f, r]) => f === pup && r.i === 1), 'posed by the host\'s record');
  assert.equal(joiner.state._sharedSeq, 1, 'the room\'s count carries past every number seen - a joiner who takes the seat numbers after it');
  enc.ai.feet = [5, 0, 7];
  const moved = host.foesFrame(false);
  assert.deepEqual(moved.f, [], 'the layout said nothing new');
  assert.equal(moved.xf, undefined, 'a delta frame lists nothing whole');
  joiner.applyFoesFrame(moved, 'host');
  assert.deepEqual(pup.ai.feet, [5, 0, 7], 'the host\'s foe moves, the puppet follows');
  assert.equal(joiner.built.length, 1, 'no second puppet');
  joiner.applyFoesFrame({ k: 'dungeon:7', f: [], x: [] }, 'host');
  assert.ok(joiner.state._sharedById.has(1), 'a delta frame that does not name it takes nothing down');
  // the host's encounter Destroy()ed (a dispel, Wabbajack's replace - dead with no body): the room forgets it
  enc.dead = true;
  const pupBatch = pup.batch;
  const gone = host.foesFrame(true);
  assert.equal(gone.x, undefined, 'the room lists it no more');
  assert.equal(host.state._sharedById.size, 0);
  joiner.applyFoesFrame(gone, 'host');
  assert.equal(joiner.state._sharedById.size, 0, 'and the full frame took the puppet down');
  assert.ok(!joiner.foes.includes(pup), 'out of the pool');
  assert.deepEqual(joiner.destroyed, [pupBatch], 'its batch freed');
  assert.deepEqual(joiner.dropped, [pup], 'and the target machine forgot it');
  assert.equal(pup.dead, true);
});

test('REST-SYNC: a body the joiner never saw standing is never stood, a killed encounter stays the room\'s body, and a host with the room\'s encounters streams the standing first', async () => {
  const joiner = side({ authority: false, layout: [] });
  joiner.applyFoesFrame({ n: 1, k: 'dungeon:7', f: [], x: [{ i: 3, t: 9, f: [0, 0, 0], d: 1 }], xf: 1 }, 'host');
  await tick();
  assert.equal(joiner.built.length, 0, 'a body never seen standing is not raised from its record');
  assert.equal(joiner.state._sharedSeq, 3, 'but its number is counted');
  const killed = foe({ _encId: 2, dead: true, corpse: true });
  const host = side({ authority: true, shared: [killed] });
  const f = host.foesFrame(true);
  assert.equal(f.x[0].d, 1, 'a killed encounter is the room\'s BODY - its corpse, its loot');
  assert.equal(host.state._sharedById.size, 1);
  const many = Array.from({ length: K.SHARED_FOES_MAX + 3 }, (_, n) => foe({ _encId: n + 1, dead: n < K.SHARED_FOES_MAX, corpse: true }));
  const crowded = side({ authority: true, shared: many });
  const out = crowded.foesFrame(true).x;
  assert.equal(out.length, K.SHARED_FOES_MAX, 'a frame carries at most its cap');
  assert.deepEqual(out.slice(0, 3).map((r) => r.d), [0, 0, 0], 'the standing first - a body is what a crowded frame sheds');
});

test('REST-SYNC: the encounters ride only the room the layout leaves under the wire\'s one cap - the largest elite layout\'s worst case still goes, and a frame that sheds one does not say it lists them whole', () => {
  // test/elitepscale.test.js's worst case, stood as foes: every field at its widest, every record a class foe fought by a full party
  const wide = (i) => foe({ mobileType: 140 + (i % 10), gender: 'female', _atkA: 99, _castN: 99, _castIdx: 999,
    ai: { feet: [-1234.56, -123.45, -1234.56], yaw: 6.283, moving: true, target: { isPeer: true, id: 'k3j4h5g6f7d8' } },
    entity: { health: FOE_HEALTH_MAX, maxHealth: FOE_HEALTH_MAX, level: 30, items: [] } });
  const layout = Array.from({ length: 151 * ELITE_FOE_MULTIPLIER }, (_, i) => wide(i));
  const shared = Array.from({ length: K.SHARED_FOES_MAX }, (_, n) => Object.assign(wide(n), { _encId: 99960 + n }));
  const host = side({ authority: true, layout, shared, over: { fightN: () => PARTY_MAX, _foesSeq: 1e9 - 1, _locationKey: 'dungeon:4294967295' } });
  const frame = host.foesFrame(true);
  const bytes = JSON.stringify({ t: 'foes', data: frame }).length;
  assert.ok(bytes <= FOES_FRAME_MAX, `${bytes} of ${FOES_FRAME_MAX} bytes - the wire takes it`);
  assert.equal(frame.f.length, layout.length, 'the layout\'s run whole');
  assert.ok((frame.x?.length ?? 0) < shared.length, 'the encounters shed to fit');
  assert.equal(frame.xf, undefined, 'and the frame does not say it lists them whole - no joiner takes a shed one down');
  const shed = shared.slice(frame.x?.length ?? 0);
  assert.ok(shed.every((f) => f._sentKey === null), 'a shed record goes again, not skipped as sent');
  const roomy = side({ authority: true, layout: [foe()], shared: [Object.assign(foe(), { _encId: 1 })] }).foesFrame(true);
  assert.deepEqual([roomy.x.length, roomy.xf], [1, 1], 'with room, all of them, whole');
});

test('REST-SYNC: a joiner\'s blow at the room\'s encounter goes to the host by the room\'s number (`xs`), and the host lands it on that encounter - never on the foe its pool holds at that index', () => {
  const sent = [];
  const layout0 = foe(), pup = foe({ _encId: 7 });
  const j = {
    _authority: false, foes: [layout0, pup], _layoutFoes: 1, lastPlayerFeet: [1, 0, 1], _ecvT: 0,
    opts: { onFoeHit: (h) => sent.push(h) }, renownFoeStruck() {}, takeWholeBlow: () => false, markFoeStruck() {}, markConcealedHit() {},
  };
  const jd = mount(`${consts()}\n${declSrc('isRoomFoe')}\n${fnSrc('damageFoe')}\nreturn { damageFoe };`, j);
  jd.damageFoe(pup, 5, [2, 0, 3]);
  jd.damageFoe(layout0, 3, [2, 0, 3]);
  assert.deepEqual(sent, [{ i: 7, xs: 1, dmg: 5, kind: 'melee', p: [2, 0, 3] }, { i: 0, dmg: 3, kind: 'melee', p: [2, 0, 3] }], 'the encounter by the room\'s number, the layout by its index');
  assert.equal(pup.entity.health, 30, 'and the joiner landed nothing itself - the host\'s next record says');
  const landed = [];
  const own = foe(), enc = foe({ _encId: 2 });
  const h = {
    _authority: true, foes: [foe(), own, enc], _layoutFoes: 1, _sharedById: new Map([[2, enc]]),
    hitPoisonOf, audio: { play3d() {} }, hitSoundFor: () => 0, ENEMY_HIT_VOLUME: 1, hitEffects: null, enemyPainVoice: () => null,
    damageFoe: (f, dmg, at, dir, o) => landed.push([f, dmg, o.peerId]),
  };
  const hd = mount(`${consts()}\n${fnSrc('applyHit')}\n${fnSrc('landPeerBlow')}\nreturn { applyHit };`, h);   // QUEST-PARTY phase 3c: the blow's landing is one door, landPeerBlow
  assert.equal(hd.applyHit('peerA', { i: 2, xs: 1, dmg: 5, kind: 'melee' }), true);
  assert.deepEqual(landed, [[enc, 5, 'peerA']], 'on the room\'s encounter');
  assert.equal(hd.applyHit('peerA', { i: 2, dmg: 5, kind: 'melee' }), false, 'a layout blow past the layout\'s run lands on nobody - here, the encounter at pool index 2');
  assert.equal(hd.applyHit('peerA', { i: 1, xs: 1, dmg: 5, kind: 'melee' }), false, 'nor on an own foe: the room has no encounter 1');
  assert.equal(hd.applyHit('peerA', { i: 2, xs: 1, dmg: K.HIT_DMG_MAX + 1, kind: 'melee' }), false, 'the blow\'s bound holds for the encounter too');
  assert.equal(landed.length, 1);
});

test('REST-SYNC: a joiner\'s poison and zero blow at the encounter divert to the host as the layout\'s do; its own foe keeps them', () => {
  const poisoned = [], zero = [], woke = [];
  const pup = foe({ _encId: 4 }), own = foe();
  const s = {
    _authority: false, foes: [foe(), own, pup], _layoutFoes: 1,
    inflictPoison: (e) => { poisoned.push(e); return 'dosed'; }, classicMinutesRef: { value: 0 },
    damageFoe: (f, dmg, at, dir, o) => zero.push([f, dmg, o.kind]), handleAttackFromPlayer: (f) => woke.push(f),
  };
  const d = mount(`${declSrc('isRoomFoe')}\n${fnSrc('poisonFoe')}\n${fnSrc('attackFromPlayer')}\nreturn { poisonFoe, attackFromPlayer };`, s);
  assert.equal(d.poisonFoe(pup, 3), null);
  assert.equal(pup._divertPt, 3, 'the dose rides the blow to the host');
  assert.equal(d.poisonFoe(own, 3), 'dosed', 'my own foe is dosed here');
  assert.deepEqual(poisoned, [own.entity]);
  d.attackFromPlayer(pup, [0, 0, 0], 'arrow', 0);
  assert.deepEqual(zero, [[pup, 0, 'arrow']], 'a zero blow goes to the host');
  assert.deepEqual(woke, []);
  d.attackFromPlayer(own, [0, 0, 0], 'melee', 0);
  assert.deepEqual(woke, [own], 'my own foe wakes here');
});

test('REST-SYNC: the encounter is weighed by who fights it and hands over with the seat, as the layout\'s run is', () => {
  const layout0 = foe(), own = foe(), ally = foe({ _encId: 9, entity: { team: 'PlayerAlly', health: 1 } });
  const resumed = [];
  const enc = foe({
    _encId: 3, _pup: { feet: [5, 0, 5], yaw: 1 }, _sentKey: 'k', _castPending: true,
    ai: { feet: [0, 0, 0], yaw: 0, target: { id: 'p' }, resumeLive() { resumed.push(this); } },
    attack: { machine: { state: 'Swing', acc: 3 }, firedRanged: true, swingSeq: 4 }, mobile: { doMeleeDamage: true, shootArrow: true },
  });
  const s = { _authority: false, _foesSeqIn: 5, _foesFrom: 'old', foes: [layout0, own, enc, ally], _layoutFoes: 1, _sharedById: new Map([[3, enc], [9, ally]]), ownRides: () => false };   // PSCALE-OWN / SUMMON-SYNC: nothing of mine on the own lane here
  const d = mount(`${declSrc('isRoomFoe')}\n${fnSrc('_sharedFoe')}\n${fnSrc('setAuthority')}\nreturn { _sharedFoe, setAuthority };`, s);
  assert.equal(d._sharedFoe(enc), true, 'the room\'s encounter is weighed by its fighters');
  assert.equal(d._sharedFoe(layout0), true);
  assert.equal(d._sharedFoe(own), false, 'my own foe past the run is not');
  assert.equal(d._sharedFoe(ally), false, 'nor my summoned ally');
  d.setAuthority(true);
  assert.deepEqual([enc.ai.feet, enc.ai.yaw], [[5, 0, 5], 1], 'the handover: the puppet\'s pose stands');
  assert.deepEqual(resumed, [enc.ai], 'and the motor resumes live from it');
  assert.equal(enc.attack.machine.state, 'Idle');
  assert.deepEqual([enc.mobile.doMeleeDamage, enc.mobile.shootArrow, enc._castPending, enc._pup, enc._sentKey], [false, false, false, null, null], 'no phantom blow on the first live frame; streamed whole');
  d.setAuthority(false);
  assert.equal(enc.ai.target, null, 'and handed back, the target it hunted is forgotten (AUDIT WORLD3 D3)');
});

test('REST-SYNC: the encounter\'s body is the room\'s container - `enc:<id>` on every client, whatever its pool index', () => {
  const items = (n) => [{ name: n }];
  const body = (over) => foe({ dead: true, corpse: true, ...over });
  const layout0 = body({ entity: { items: items('layout') } }), own = body({ entity: { items: items('own') } });
  const pup = body({ _encId: 4, entity: { items: items('enc') } });
  const loot = (foes, layoutN, shared) => mount(`
    ${declSrc('LOOT_KEY_RE')}
    ${fnSrc('lootKeyOf')}
    ${fnSrc('lootableBody')}
    ${fnSrc('lootHolder')}
    ${fnSrc('roomLootKey')}
    return { lootKeyOf, lootHolder, roomLootKey };
  `, { foes, _layoutFoes: layoutN, _sharedById: new Map(shared.map((f) => [f._encId, f])), lootPiles: [] });
  const j = loot([layout0, own, pup], 1, [pup]);
  assert.equal(j.roomLootKey('corpse:0'), 'corpse:0', 'the layout\'s body, by its index');
  assert.equal(j.roomLootKey('corpse:1'), null, 'my own foe\'s body is mine alone');
  assert.equal(j.roomLootKey('corpse:2'), 'enc:4', 'the encounter\'s, by the room\'s number');
  assert.equal(j.lootHolder('enc:4'), pup.entity.items);
  assert.equal(j.lootKeyOf('enc:04'), null, 'one spelling');
  const hostCopy = body({ _encId: 4, entity: { items: items('host') } });
  const h = loot([layout0, hostCopy], 1, [hostCopy]);
  assert.equal(h.roomLootKey('corpse:1'), 'enc:4', 'the host\'s copy at ITS index is the same container');
  assert.equal(loot([layout0, foe({ _encId: 4 })], 1, [foe({ _encId: 4 })]).lootHolder('enc:4'), null, 'a standing encounter is no container');
});

test('REST-SYNC by source: the rest, the hour\'s check, the act door, the frame, the foe loop, the loot doors and world.js\'s sender', () => {
  assert.match(D, /if \(hit\) \{ restEncounter\(hit\); break; \}/, 'the rest\'s spawn is the room\'s');
  assert.match(D, /enemiesNearby: \(\) => roomEncounterComing\(\) \|\| areEnemiesNearby\(foes, \{ resting: true \}\),/, 'the asker\'s rest breaks at the hour');
  assert.match(D, /const asked = data\.rs != null && roomEncounterAsked\(id, data\.rs\);[^\n]*\n[^\n]*\n\s*return n > 0 \|\| asked;/, 'the host hears the ask');
  assert.match(D, /applySharedRecords\(Array\.isArray\(data\.x\) \? data\.x : \[\], data\.xf === 1\);/, 'the joiner hears the encounters');
  assert.match(D, /const _roomFoe = isRoomFoe\(f, _fi\);[^\n]*\n\s*const _puppet = \(!_authority && _roomFoe\) \|\| f\._ownFrom != null;/, 'a joiner\'s copy is a puppet (QUEST-PARTY phase 3c: and a party member\'s quest foe)');
  assert.match(D, /f\.ai\.update\(foeFrameDt\(dt\), _pf, _armed\(f, _senses, _roomFoe\), _fParalyzed, _fPaused\);/, 'and the host\'s hunts every player (FOE-CATCHUP re-aim: the frame at most three steps)');
  assert.equal((D.match(/= roomLootKey\(key\);   \/\/ REST-SYNC: the room's name for it/g) ?? []).length, 2, 'the quick take and the window say the room\'s name');
  const i = W.indexOf("if (data?.rs && !(data?.a?.length) && !(data?.l?.length)) return actFrameFits(data) ? online.sendAct(data) : false;");
  assert.ok(i > 0 && i < W.indexOf('const keys = [...((data?.a ?? []).map((r) => r.key))'), 'world.js sends the ask alone, before the door keys');
});
