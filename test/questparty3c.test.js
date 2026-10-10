// QUEST-PARTY phase 3c (2026-09-26, Mac: "Dungeons and buildings"). A quest foe past a dungeon's layout run was every
// client's private object - in no frame (the ONLINE-DUNGEON-FOES flag's NOT SYNCED) and blind to every peer (its NOT
// REACTIVE) - so two party members on one dungeon quest each fought their own copy of the vampire, and neither could
// strike the other's. A quest the party SHARES now streams its foes on the room's own lane (OWN1) to the party alone,
// whoever hosts the room: the foe is its spawner's, a party member stands it as a puppet through the layout's own record
// door, strikes it through its owner, counts on its own copy what it sees, takes it over when its owner goes, and a
// marker's foe stands once for the party. Mounted, not matched: the statements are sliced out of the context's source
// (test/restsync.test.js's harness) and run; the hosts' wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { validFoeRecord, FOE_HEALTH_MAX, FOE_LEVEL_MAX, CELL_FRAME_RECORDS_MAX, CELL_LOOSE_PUPPETS, FOES_FRAME_MAX } from '../src/net/wire.js';
import { validQuestTags, questMarkerYields, QUEST_PUPPETS_MAX, validLooseSeqs, companionNames } from '../src/scenes/exteriorFoes.js';
import { foeSeed, applyWireLook } from '../src/characters/foeBodies.js';   // AUDIT MW-NPC II K3: the dungeon context's look seed, in the mounted scope

const D = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const WM = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
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

const QUEST = 'M0B00Y16';
/** A dungeon foe as the pool holds it, as far as these doors read it. */
const foe = (over = {}) => ({
  mobileType: 5, gender: 'male', dead: false, corpse: false, batch: { b: 1 },
  ai: { feet: [0, 0, 0], yaw: 0, moving: false, target: null, height: 1.8, resumeLive() { this.resumed = true; } },
  entity: { health: 30, maxHealth: 30, items: [] },
  ...over,
});
const questFoe = (symbol = '_vampire_', over = {}) => foe({ questBehaviour: { questUID: 7, targetSymbol: { name: symbol } }, ...over });
const PARTY = new Set(['aaa-0001', 'mmm-0002', 'zzz-0009']);

/** One player's dungeon: its layout run, its own foes past it, and the own lane's doors over stubs. */
function side(self, { layout = [], own = [] } = {}) {
  const foes = [...layout, ...own];
  const built = [], bound = [], credit = { hurt: [], died: [] }, landed = [], removed = [];
  // the world host's own shape (world.js questShareSeam): `linked` is sharedQuestFoe's answer - a puppet stands for a
  // LINKED copy (DISC28-J) and binds to it (behaviourFor); an heir's taking and a kept foe's blow ask the party alone
  // (partyPeer, AUDIT DISC28 QS-J)
  const share = {
    linked: true,
    tagOf: (f) => (f.questBehaviour?.targetSymbol?.name && !f.questBehaviour.private ? { q: QUEST, s: f.questBehaviour.targetSymbol.name } : null),
    accepts: (from) => PARTY.has(self) && PARTY.has(from) && share.linked,
    partyPeer: (id) => PARTY.has(self) && PARTY.has(id),
    peerMayHit: (peerId) => PARTY.has(peerId),
    onPuppetHurt: (tag) => credit.hurt.push(tag.s), onPuppetDied: (tag) => credit.died.push(tag.s),
    behaviourFor: (tag) => { if (!share.linked) return null; const b = { questUID: 7, targetSymbol: { name: tag.s } }; bound.push(b); return b; },
    adoptsOrphan: () => false,
  };
  const state = {
    foeSeed, applyWireLook,   // AUDIT MW-NPC II K3: the records' look seed (roomRecord, applyFoeRecord, the puppets' stands)
    opts: { selfId: () => self, questShare: () => share },
    _layoutFoes: layout.length, foes, _authority: true, _encId: undefined, _ctxDead: false, _locationKey: 'dungeon:7',
    _ownSeq: 0, _ownFrameSeq: 0, _ownGen: 0, _ownPups: new Map(), _ownPending: new Map(), _ownOwners: new Map(), _ownPendLoose: new Set(), _ownAdopted: new Map(), _ownKept: new Map(),
    FOE_HEALTH_MAX, FOE_LEVEL_MAX, CELL_FRAME_RECORDS_MAX, QUEST_PUPPETS_MAX, CELL_LOOSE_PUPPETS, LOOSE_PUPPETS_MAX: 24, HIT_DMG_MAX: 10000, FOES_FRAME_MAX,
    validFoeRecord, validQuestTags, validLooseSeqs, companionNames, questMarkerYields, GENDER_BIT: ['male', 'female'],   // PIN MOVED (AUDIT WK-U3, 2026-10-01): the own lane reads companions' names beside their places
    _sharedFoe: () => false, fightN: () => 1, canStandFoe: () => true,
    applyFoeRecord: (f, r) => { if (r.f) f.ai.feet = [...r.f]; if (Number.isFinite(r.h)) f.entity.health = r.h; if (r.d === 1) f.dead = true; f._pup = { feet: [...(r.f ?? f.ai.feet)], yaw: r.y ?? 0 }; },
    buildFoeAt: async (e) => { const f = foe({ mobileType: e.mobileType, gender: e.gender, ai: { feet: [e.x, e.y, e.z], yaw: 0, resumeLive() { this.resumed = true; } } }); built.push(f); foes.push(f); return f; },
    renderer: { destroyBillboardBatch: () => {} }, freeCorpse: (f) => { f.corpse = false; }, dropCandidate: () => {},
    bindQuestFoeHost: (f, b) => { f.questBehaviour = b; },
    questPoolOps: { removeFoe: (f) => { f.dead = true; removed.push(f); } },
    landPeerBlow: (f, id, data, dmg) => { landed.push([f, id, dmg]); return true; },
    console: { info() {}, warn() {}, error: (...a) => assert.fail(a.join(' ')) },
  };
  const api = mount(`
    const q2 = (v) => Math.round(v * 100) / 100;
    const q3 = (v) => Math.round(v * 1000) / 1000;
    ${declSrc('isRoomFoe')}
    ${declSrc('ownPupKey')}
    ${declSrc('ownShare')}
    ${declSrc('ownQuestTag')}
    ${declSrc('ownLoose')}
    ${declSrc('questTouched')}
    ${declSrc('ownHeirIsMe')}
    ${declSrc('ownHeirElse')}
    ${declSrc('FOES_FRAME_SLACK')}
    ${declSrc('FOE_MAX_PER_FRAME')}
    ${declSrc('_maxLeft')}
    ${declSrc('foeMaxOf')}
    ${fnSrc('fitMaxima')}
    ${fnSrc('roomRecord')}
    ${fnSrc('ownFrame')}
    ${fnSrc('applyOwnFrame')}
    ${fnSrc('ownPuppetsOf')}
    ${fnSrc('standOwnPuppet')}
    ${fnSrc('keepOwnRecord')}
    ${fnSrc('applyOwnRecord')}
    ${fnSrc('dropOwnPuppet')}
    ${fnSrc('clearOwnPuppets')}
    ${fnSrc('pruneOwnOwners')}
    ${fnSrc('adoptOwn')}
    ${fnSrc('ownHandOverFrame')}
    ${fnSrc('dropOwnHanded')}
    ${fnSrc('letGoOwn')}
    ${fnSrc('standDownMarkerCopies')}
    ${declSrc('ownPeerMayHit')}
    ${fnSrc('applyOwnHit')}
    ${fnSrc('lootableBody')}
    return { ownFrame, applyOwnFrame, applyOwnHit, pruneOwnOwners, clearOwnPuppets, ownHandOverFrame, dropOwnHanded, lootableBody };
  `, state);
  return { ...api, state, foes, built, bound, credit, landed, removed, share };
}

test('QUEST-PARTY 3c: my shared quest\'s foes past the layout ride the own lane with their words - never the layout\'s, never a private quest\'s; a marker\'s flagged 1, touched 3; a quiet dungeon says nothing between full frames', () => {
  const vamp = questFoe('_vampire_', { _questMarker: true, ai: { feet: [4, 0, 6], yaw: 1, moving: false, target: null } });
  const wave = questFoe('_thrall_');
  const secret = questFoe('_spy_'); secret.questBehaviour.private = true;
  const layoutQuest = questFoe('_layout_');
  const me = side('aaa-0001', { layout: [layoutQuest], own: [vamp, wave, secret] });
  const full = me.ownFrame(true);
  assert.equal(full.k, 'dungeon:7', 'keyed to this dungeon');
  assert.equal(full.full, 1);
  assert.deepEqual(full.f.map((r) => r.i), [vamp._ownSeq, wave._ownSeq], 'my shared quest\'s two - not the layout\'s run, not a private quest\'s');
  assert.deepEqual(full.qf, [[vamp._ownSeq, QUEST, '_vampire_', 1], [wave._ownSeq, QUEST, '_thrall_']]);
  assert.deepEqual([full.f[0].t, full.f[0].f, full.f[0].g], [5, [4, 0, 6], '.'], 'the layout\'s own record - its target \'.\' the owner');
  assert.equal(me.ownFrame(false), null, 'quiet');
  vamp.entity.health = 12;
  const hurt = me.ownFrame(false);
  assert.deepEqual(hurt.qf, [[vamp._ownSeq, QUEST, '_vampire_', 3]], 'touched');
  assert.equal(hurt.full, 0);
  const empty = side('aaa-0001').ownFrame(true);
  assert.deepEqual([empty.f, empty.full, empty.qf], [[], 1, undefined], 'a full frame goes with nothing in it - the readers take down what it no longer lists');
});

test('AUDIT SETS M1: MY OWN LANE PAYS ITS FOES\' MAXIMA BY THE LAYOUT\'S LAW - a whole frame (a full one, or a handover) pays each foe\'s, a delta the owed alone and at most twelve, and a record past the relay\'s bound owes its again (mutants: a handover paying none; the delta\'s budget unbounded; a record past the bound kept as paid)', () => {
  const own = Array.from({ length: CELL_FRAME_RECORDS_MAX + 2 }, (_, n) => questFoe(`_q${n}_`, { entity: { health: 10, maxHealth: 40 + n, items: [] } }));
  const me = side('aaa-0001', { own });
  const full = me.ownFrame(true);
  assert.equal(full.f.length, CELL_FRAME_RECORDS_MAX);
  assert.ok(full.f.every((r, n) => r.k === 40 + n), 'a full frame pays each foe\'s maximum');
  assert.deepEqual(me.ownFrame(false).f.map((r) => r.k), [40 + CELL_FRAME_RECORDS_MAX, 41 + CELL_FRAME_RECORDS_MAX], 'the two past the relay\'s bound next, their maxima with them');
  assert.equal(me.ownFrame(false), null, 'then quiet');
  for (const f of own.slice(0, 14)) f.entity.maxHealth += 100;
  assert.equal(me.ownFrame(false).f.length, 12, 'a delta pays twelve owed');
  assert.deepEqual(me.ownFrame(false).f.map((r) => r.k), [152, 153], 'and the rest the next');
  const handed = me.ownFrame(false, () => 'mmm-0002');
  assert.ok(handed.f.every((r) => r.k !== undefined), 'a handover pays each - its heir learns them at once');
  me.ownFrame(false);
  // a delta past the relay's bound: the two shed carried the only maxima owed
  for (const f of own) f.ai.feet = [1, 0, 1];
  own[CELL_FRAME_RECORDS_MAX].entity.maxHealth = 500; own[CELL_FRAME_RECORDS_MAX + 1].entity.maxHealth = 501;
  assert.equal(me.ownFrame(false).f.length, CELL_FRAME_RECORDS_MAX, 'the bound holds');
  assert.deepEqual(me.ownFrame(false).f.map((r) => r.k), [500, 501], 'the shed go next and still owe their maxima');
});

test('QUEST-PARTY 3c: a party member stands my shared quest\'s foes as puppets and follows them; a stranger stands none; another dungeon\'s or an older frame is not the world; a full frame takes down what it no longer lists', async () => {
  const vamp = questFoe('_vampire_', { ai: { feet: [4, 0, 6], yaw: 1, moving: false, target: null } });
  const owner = side('aaa-0001', { own: [vamp] });
  const frame = owner.ownFrame(true);
  const amy = side('mmm-0002');
  assert.equal(amy.applyOwnFrame('aaa-0001', frame), true);
  await tick();
  assert.equal(amy.built.length, 1, 'a puppet stood from its first record');
  const pup = amy.state._ownPups.get(`aaa-0001:${vamp._ownSeq}`);
  assert.ok(pup && amy.foes.includes(pup), 'in the member\'s pool, by the owner and its number');
  assert.deepEqual([pup._ownFrom, pup._ownI, pup._pupQuest.s], ['aaa-0001', vamp._ownSeq, '_vampire_']);
  assert.deepEqual(pup.ai.feet, [4, 0, 6]);
  assert.equal(amy.lootableBody({ ...pup, dead: true, corpse: true }), false, 'its body is its owner\'s - a quest\'s loot stays its host\'s');
  assert.equal(amy.lootableBody({ dead: true, corpse: true }), true);
  vamp.ai.feet = [5, 0, 7];
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(false));
  assert.deepEqual(pup.ai.feet, [5, 0, 7], 'the owner\'s foe moves, the puppet follows');
  assert.equal(amy.applyOwnFrame('aaa-0001', { ...owner.ownFrame(true), n: 1 }), false, 'an older frame is stale');
  assert.equal(amy.applyOwnFrame('aaa-0001', { ...owner.ownFrame(true), k: 'dungeon:8' }), false, 'another dungeon\'s is not the world');
  const bob = side('bob-0005');
  bob.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  await tick();
  assert.equal(bob.built.length, 0, 'a stranger never sees the party\'s quest');
  vamp.dead = true;   // Destroy()ed - no body
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  assert.equal(amy.state._ownPups.size, 0, 'a full frame that no longer lists it takes it down');
  assert.ok(!amy.foes.includes(pup), 'out of the pool');
});

test('QUEST-PARTY 3c: my copy counts what it sees on a party member\'s quest foe - the first blow the injury, once; the fall the kill', async () => {
  const vamp = questFoe('_vampire_');
  const owner = side('aaa-0001', { own: [vamp] });
  const amy = side('mmm-0002');
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  await tick();
  vamp.entity.health = 20; amy.applyOwnFrame('aaa-0001', owner.ownFrame(false));
  vamp.entity.health = 10; amy.applyOwnFrame('aaa-0001', owner.ownFrame(false));
  assert.deepEqual(amy.credit.hurt, ['_vampire_'], 'the injury once');
  vamp.dead = true; vamp.corpse = true; vamp.entity.health = 0;
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(false));
  assert.deepEqual(amy.credit.died, ['_vampire_'], 'and the kill');
});

test('QUEST-PARTY 3c: a party member\'s blow on my shared quest foe lands through the peer\'s door, whoever hosts; a stranger\'s, a private quest\'s, another dungeon\'s and an unbounded one do not', () => {
  const vamp = questFoe('_vampire_');
  const secret = questFoe('_spy_'); secret.questBehaviour.private = true;
  const me = side('aaa-0001', { own: [vamp, secret] });
  me.state._authority = false;   // another hosts the room - my quest foe is still mine
  me.ownFrame(true);
  secret._ownSeq = 99;
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, to: 'aaa-0001', k: 'dungeon:7', i: vamp._ownSeq, dmg: 7, kind: 'melee' }), true);
  assert.deepEqual(me.landed.map(([f, id, d]) => [f === vamp, id, d]), [[true, 'mmm-0002', 7]], 'a party member\'s blow lands');
  assert.equal(me.applyOwnHit('bob-0005', { own: 1, i: vamp._ownSeq, dmg: 7 }), false, 'a stranger\'s does not');
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, i: 99, dmg: 7 }), false, 'nor on a private quest\'s foe');
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, k: 'dungeon:8', i: vamp._ownSeq, dmg: 7 }), false, 'nor keyed to another dungeon');
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, i: vamp._ownSeq, dmg: 1e9 }), false, 'nor unbounded');
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, i: vamp._ownSeq + 50, dmg: 7 }), false, 'nor a number I never gave');
  assert.equal(me.landed.length, 1);
});

test('QUEST-PARTY 3c: a departing owner names a party heir - the heir takes it bound to its own copy and its motor resumes; the owner lets it go; an owner gone without a word leaves it to the one the law names, else it goes', async () => {
  const vamp = questFoe('_vampire_');
  const owner = side('aaa-0001', { own: [vamp] });
  const amy = side('mmm-0002');
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  await tick();
  const pup = amy.state._ownPups.get(`aaa-0001:${vamp._ownSeq}`);
  const handed = owner.ownHandOverFrame(() => 'mmm-0002');
  assert.equal(handed.f[0].e, 'mmm-0002', 'the heir named on the frame');
  amy.applyOwnFrame('aaa-0001', handed);
  assert.equal(pup._ownFrom, null, 'the heir took it');
  assert.equal(amy.state._ownPups.size, 0);
  assert.equal(amy.bound.length, 1, 'bound to the heir\'s own copy of the quest');
  assert.equal(pup.questBehaviour, amy.bound[0]);
  assert.equal(pup.ai.resumed, true, 'its motor resumes from the pose');
  assert.equal(amy.ownFrame(true).qf?.[0]?.[2], '_vampire_', 'and it rides to the party as the heir\'s');
  assert.equal(owner.dropOwnHanded(), 1, 'the owner lets it go');
  assert.ok(!owner.foes.includes(vamp));
  // an owner gone without a handover
  const v2 = questFoe('_vampire_');
  const o2 = side('aaa-0001', { own: [v2] });
  const cat = side('zzz-0009');
  cat.applyOwnFrame('aaa-0001', o2.ownFrame(true));
  await tick();
  const p2 = cat.state._ownPups.get(`aaa-0001:${v2._ownSeq}`);
  cat.share.adoptsOrphan = () => true;
  cat.pruneOwnOwners(new Set(), 0, 0);
  assert.equal(p2._ownFrom, null, 'the one the law names takes the orphan');
  const dog = side('mmm-0002');
  dog.applyOwnFrame('aaa-0001', o2.ownFrame(true));
  await tick();
  dog.pruneOwnOwners(new Set(['aaa-0001']), 0, 0);
  assert.equal(dog.state._ownPups.size, 1, 'an owner still in the room keeps its foes');
  dog.pruneOwnOwners(new Set(), 0, 0);
  assert.equal(dog.state._ownPups.size, 0, 'another member lets them go');
  const eel = side('mmm-0002');
  eel.applyOwnFrame('aaa-0001', o2.ownFrame(true));
  await tick();
  eel.state._ownOwners.get('aaa-0001').at = 0;
  eel.pruneOwnOwners(new Set(['aaa-0001']), 10000, 6000);
  assert.equal(eel.state._ownPups.size, 0, 'an owner silent past the stale window goes as one gone');
});

test('QUEST-PARTY 3c: a marker\'s foe stands once for the party in a dungeon too - the higher id\'s untouched copy stands down; the room clears', async () => {
  const a = side('aaa-0001', { own: [questFoe('_vampire_', { _questMarker: true })] });
  const mine = questFoe('_vampire_', { _questMarker: true });
  const m = side('mmm-0002', { own: [mine] });
  m.applyOwnFrame('aaa-0001', a.ownFrame(true));
  await tick();
  assert.equal(mine.dead, true, 'mine stood down');
  assert.deepEqual(m.removed, [mine], 'as the cull takes one');
  assert.equal(m.state._ownPups.size, 1, 'and the lower id\'s stands here');
  // a party member's marker foe of ANOTHER symbol stands nothing down
  const ghostSide = side('aaa-0001', { own: [questFoe('_ghost_', { _questMarker: true })] });
  const keep = questFoe('_vampire_', { _questMarker: true });
  const k = side('mmm-0002', { own: [keep] });
  k.applyOwnFrame('aaa-0001', ghostSide.ownFrame(true));
  await tick();
  assert.equal(keep.dead, false, 'the ghost is not the vampire');
  m.clearOwnPuppets();
  assert.equal(m.state._ownPups.size, 0, 'a room change takes the lane\'s puppets down');
  assert.equal(m.state._ownOwners.size, 0);
});

test('QUEST-PARTY 3c by source: the blow on a party member\'s quest foe goes to its owner; the loop steps it as a puppet of its owner; my shared quest foe hunts its party; the save holds none of theirs; the marker\'s stand is flagged; the hosts wire the lane', () => {
  assert.match(D, /if \(foe\._ownFrom != null\) \{\n\s*if \(fromPlayer && damage >= 0\) \{[\s\S]*?opts\.onFoeHit\?\.\(\{ own: 1, to: foe\._ownFrom, k: _locationKey, i: foe\._ownI, dmg: damage, kind,[\s\S]*?\}\s*return;\n\s*\}\n\s*if \(!_authority\) \{/, 'the owner\'s to apply, before the host\'s divert');
  assert.match(D, /const _puppet = isPuppetFoe\(f, _fi\);/);   // AUDIT PRE-MERGE 0928 O6: the frame's test has one home, which the host asks too
  assert.match(D, /const isPuppetFoe = \(f, i = foes\.indexOf\(f\)\) => f != null && \(\(!_authority && isRoomFoe\(f, i\)\) \|\| f\._ownFrom != null\);/);
  assert.match(D, /f\._pupTarget = p\.target === '\.' \? \(f\._ownFrom \?\? _foesFrom\) : \(p\.target \|\| null\);/);
  assert.match(D, /candidates: foeDeps \? \(streamed = false, rec = null\) => \[\.\.\.foes\.filter\(\(f\) => !f\.dead && f\.ai\), \.\.\.\(\(_authority && streamed\) \|\| ownLoose\(rec\) \? peerCandidates\(\) : \(ownQuestTag\(rec\) \? peerCandidates\(\)\.filter\(\(c\) => ownShare\(\)\?\.peerMayHit\?\.\(c\.id, rec\)\) : \[\]\)\)\] : null,/, 'the party alone');
  assert.match(D, /foeDeps\.runTargetMachine\(rec, sn\.candidates\(streamed, rec\), pf, cdt, \{/);
  assert.match(D, /foes: foes\.filter\(\(f\) => f\._ownFrom == null && f\.companion == null\)\.map\(\(f\) => \(\{/, 'the save holds none of theirs (CREW-COMPANIONS: nor my companions, the party\'s)');
  assert.match(D, /if \(truncate\) clearOwnPuppets\(\);/, 'and a load takes them down first, so its indices are this pool\'s');
  assert.match(D, /if \(\(!_authority && isRoomFoe\(f, pi\)\) \|\| f\._ownFrom != null\) \{ f\._divertPt = pt; return null; \}/, 'the dose rides the blow to the owner');
  assert.match(D, /if \(marker\) f\._questMarker = true;/);
  assert.match(WM, /position: \[position\.x, position\.y, position\.z\], behaviour,\n\s*marker: true,/, 'the dungeon marker\'s stand is flagged');
  assert.match(WM, /questShare: \(\) => host\.foesQuestShare\?\.\(\) \?\? null,/, 'the party\'s law into the dungeon');
  assert.match(WM, /ownFoesFrame\(full = false\) \{ return mode === 'interior' && interiorFoes \? interiorFoes\.foesFrame\(full\) : mode === 'dungeon' && dungeonCtx \? \(dungeonCtx\.ownFrame\?\.\(full\) \?\? null\) : null; \},/);
  assert.match(WM, /applyOwnFoes\(id, data\) \{ return mode === 'interior' && interiorFoes \? interiorFoes\.applyFoes\(id, data\) : mode === 'dungeon' && dungeonCtx \? !!dungeonCtx\.applyOwnFrame\?\.\(id, data\) : false; \},/);
  assert.match(WM, /applyOwnHit\(id, data\) \{ return mode === 'interior' && interiorFoes \? interiorFoes\.applyHit\(id, data\) : mode === 'dungeon' && dungeonCtx \? !!dungeonCtx\.applyOwnHit\?\.\(id, data\) : false; \},/);
  assert.match(WM, /clearOwnPuppets\(\) \{ interiorFoes\?\.clearPuppets\(\); dungeonCtx\?\.clearOwnPuppets\?\.\(\); \},/);
  assert.match(W, /const m = modes\?\.mode \?\? 'exterior';\n\s*if \(m !== 'interior' && m !== 'dungeon'\) return false;/, 'the own lane streams from a dungeon too');
  assert.match(W, /onDungeonLeave: \(\) => \{ if \(_wdunInside\) wdunLeft\(false\); const n = handOverRoomFoes\(\);/, 'the dungeon\'s door hands my shared quest\'s foes to the party who stay');   // PVPDUNGEONS: a zone hall's leaving said first (wdunLeft - its lock and its word, nothing of the room's)
  assert.match(W, /const near = online\?\.room && isWorldRoom\(online\.room\) && online\.ownOk && \(m === 'interior' \|\| m === 'dungeon'\) \? \(peersNear\(\) \?\? \[\]\) : \[\];/);
  assert.match(W, /if \(ids\) modes\?\.pruneOwnOwners\?\.\(ids, now, FOES_STALE_MS\); \}/);
});

// ---- AUDIT (the pre-merge audit, 2026-09-27, Mac: "Audit before we merge"): the own lane's findings, each executed
// over the same mounted statements.

test('AUDIT pre-merge D2: a handover names ONE heir - a member it did not name lets the owner\'s foe go when the owner leaves, never adopts it too; an owner gone quiet keeps what it stands; a foe I took is its owner\'s again when the owner streams it alive', async () => {
  const vamp = questFoe('_vampire_');
  const owner = side('aaa-0001', { own: [vamp] });
  const heir = side('zzz-0009'), low = side('mmm-0002');
  for (const s of [heir, low]) s.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  await tick();
  low.share.adoptsOrphan = () => true;   // the lower id near the foe - the orphan law's pick
  const handed = owner.ownHandOverFrame(() => 'zzz-0009');
  heir.applyOwnFrame('aaa-0001', handed); low.applyOwnFrame('aaa-0001', handed);
  assert.equal(heir.foes.filter((f) => f._ownFrom == null && !f.dead).length, 1, 'the heir takes it');
  const lowPup = low.state._ownPups.get(`aaa-0001:${vamp._ownSeq}`);
  assert.equal(lowPup._heirElse, true, 'the other member reads that another was named');
  low.pruneOwnOwners(new Set(), 0, 0);
  assert.equal(low.foes.filter((f) => f._ownFrom == null && !f.dead).length, 0, 'and adopts nothing when the owner leaves - one owner streams it, not two');
  // an owner gone QUIET (a hidden tab) but still in the room: its puppets go, none adopted
  const v2 = questFoe('_vampire_');
  const o2 = side('aaa-0001', { own: [v2] });
  const m = side('mmm-0002');
  m.share.adoptsOrphan = () => true;
  m.applyOwnFrame('aaa-0001', o2.ownFrame(true));
  await tick();
  m.state._ownOwners.get('aaa-0001').at = 0;
  m.pruneOwnOwners(new Set(['aaa-0001']), 10000, 6000);
  assert.equal(m.foes.filter((f) => f._ownFrom == null && !f.dead).length, 0, 'the stale sweep adopts nothing - its owner still stands it');
  assert.equal(m.state._ownPups.size, 0, 'its puppets go, as a quiet owner\'s always did');
  m.applyOwnFrame('aaa-0001', { ...o2.ownFrame(true), n: 999 });
  await tick();
  assert.equal(m.state._ownPups.size, 1, 'and stand again when it wakes');
  // an owner that LEFT (its foe adopted) comes back under the same id and streams it alive
  const v3 = questFoe('_vampire_');
  const o3 = side('aaa-0001', { own: [v3] });
  const t = side('mmm-0002');
  t.share.adoptsOrphan = () => true;
  t.applyOwnFrame('aaa-0001', o3.ownFrame(true));
  await tick();
  t.pruneOwnOwners(new Set(), 0, 0);
  const took = t.foes.find((f) => f._ownFrom == null && !f.dead);
  assert.ok(took, 'the orphan taken');
  t.applyOwnFrame('aaa-0001', o3.ownFrame(true));
  await tick();
  assert.equal(took.dead && took._gone, true, 'mine let go - no death, no body');
  assert.ok(!t.foes.includes(took), 'out of my pool');
  assert.equal(t.state._ownPups.size, 1, 'and theirs stands here as their puppet: one foe, one owner');
});

test('AUDIT pre-merge F3: an heir whose puppet was still building when its owner\'s leave pruned it takes the foe on landing - a room change still ends it', async () => {
  const vamp = questFoe('_vampire_');
  const owner = side('aaa-0001', { own: [vamp] });
  owner.ownFrame(true);
  const heir = side('mmm-0002');
  heir.applyOwnFrame('aaa-0001', owner.ownHandOverFrame(() => 'mmm-0002'));   // the handover is the first word it hears
  heir.pruneOwnOwners(new Set(), 0, 0);   // the owner's leave lands before the build does
  await tick();
  const mine = heir.foes.filter((f) => f._ownFrom == null && !f.dead);
  assert.equal(mine.length, 1, 'the heir took it on landing - the owner had already let it go');
  assert.equal(mine[0].questBehaviour, heir.bound[0], 'bound to its own copy');
  const v2 = questFoe('_vampire_');
  const o2 = side('aaa-0001', { own: [v2] });
  o2.ownFrame(true);
  const gone = side('mmm-0002');
  gone.applyOwnFrame('aaa-0001', o2.ownHandOverFrame(() => 'mmm-0002'));
  gone.clearOwnPuppets();   // a room change
  await tick();
  assert.equal(gone.foes.filter((f) => !f.dead).length, 0, 'a build a room change overtook still ends on arrival');
});

test('AUDIT pre-merge D3: the first sight of a partner\'s untouched quest foe is no injury - my copy\'s own roll is not the owner\'s health; a real drop is, once', async () => {
  const vamp = questFoe('_vampire_');
  const owner = side('aaa-0001', { own: [vamp] });
  const amy = side('mmm-0002');
  const build = amy.state.buildFoeAt;
  amy.state.buildFoeAt = async (e) => { const f = await build(e); f.entity.health = 45; f.entity.maxHealth = 45; return f; };   // a class foe rolled at MY level
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  await tick();
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  assert.deepEqual(amy.credit.hurt, [], 'no blow has landed - no injury');
  vamp.entity.health = 22; amy.applyOwnFrame('aaa-0001', owner.ownFrame(false));
  vamp.entity.health = 12; amy.applyOwnFrame('aaa-0001', owner.ownFrame(false));
  assert.deepEqual(amy.credit.hurt, ['_vampire_'], 'the first real drop is, once');
});

test('AUDIT pre-merge D5 + Q3: a marker\'s foe taken keeps its flag in the heir\'s frame; an heir whose copy holds no such quest takes it keeping the partner\'s word - it rides as the quest\'s, a party member\'s blow lands, a stranger\'s does not', async () => {
  // D5, by an heir whose copy is linked: it stood the puppet, so the handover's record lands on it at once - and a
  // HANDED record marks nothing (the heir's id sorts above the owner's, so a mark would stand the heir's new foe down)
  const mark = questFoe('_vampire_', { _questMarker: true });
  const o0 = side('aaa-0001', { own: [mark] });
  const linkedHeir = side('mmm-0002');
  linkedHeir.applyOwnFrame('aaa-0001', o0.ownFrame(true));
  await tick();
  linkedHeir.applyOwnFrame('aaa-0001', o0.ownHandOverFrame(() => 'mmm-0002'));
  const took0 = linkedHeir.foes.find((f) => f._ownFrom == null && !f.dead);
  assert.ok(took0, 'taken, and not stood down by its own handover');
  assert.equal(took0._questMarker, true, 'still a marker\'s foe');
  assert.deepEqual(linkedHeir.ownFrame(true).qf, [[took0._ownSeq, QUEST, '_vampire_', 1]], 'it rides as the quest\'s marker foe');
  // Q3, by an heir whose copy holds no such quest
  const vamp = questFoe('_vampire_', { _questMarker: true });
  const owner = side('aaa-0001', { own: [vamp] });
  const heir = side('mmm-0002');
  heir.share.linked = false;   // this copy holds no such quest (AUDIT DISC28 QS-J: so it stands none of its puppets - the handover is the first it takes)
  const build = heir.state.buildFoeAt;
  heir.state.buildFoeAt = async (e) => { const f = await build(e); f.entity.maxHealth = 45; return f; };   // my own roll of the species, above the owner's whole 30
  heir.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  await tick();
  assert.equal(heir.foes.length, 0, 'DISC28-J: a copy with no link stands none of the quest\'s puppets');
  heir.applyOwnFrame('aaa-0001', owner.ownHandOverFrame(() => 'mmm-0002'));
  await tick();   // AUDIT DISC28 QS-J: the handover is the first it takes - stood on its record, taken on landing
  const took = heir.foes.find((f) => f._ownFrom == null && !f.dead);
  assert.ok(took, 'taken, not refused (the owner had let it go)');
  assert.deepEqual(took._keptTag, { q: QUEST, s: '_vampire_' }, 'the partner\'s word kept');
  assert.equal(took._questMarker, true, 'still a marker\'s foe');
  const fr = heir.ownFrame(true);
  assert.deepEqual(fr.qf, [[took._ownSeq, QUEST, '_vampire_', 1]], 'it rides to the party as the quest\'s marker foe - untouched, as its owner said (my roll of its maximum is not a blow)');
  const v2 = questFoe('_vampire_');
  const o2 = side('aaa-0001', { own: [v2] });
  v2.entity.health = 20;   // struck at its owner's
  const h2 = side('mmm-0002');
  h2.applyOwnFrame('aaa-0001', o2.ownFrame(true));
  await tick();
  h2.applyOwnFrame('aaa-0001', o2.ownHandOverFrame(() => 'mmm-0002'));
  const t2 = h2.foes.find((f) => f._ownFrom == null && !f.dead);
  h2.state.foes.forEach((f) => { if (f === t2) f.entity.maxHealth = 20; });   // whatever my maximum reads, the owner's word stands
  assert.deepEqual(h2.ownFrame(true).qf, [[t2._ownSeq, QUEST, '_vampire_', 2]], 'a touched one stays touched');
  assert.equal(fr.lf, undefined, 'never as a loose stand');
  assert.equal(heir.applyOwnHit('zzz-0009', { own: 1, i: took._ownSeq, dmg: 5 }), true, 'a party member\'s blow lands');
  assert.equal(heir.applyOwnHit('bob-0005', { own: 1, i: took._ownSeq, dmg: 5 }), true, 'DESYNC-ZERO: a stranger\'s lands too - the foe stands for the room, the credit stays the party\'s');
});

test('AUDIT pre-merge D1: the removal door (Dispel\'s, a quest\'s) refuses a puppet - a party member\'s own foe, a room foe while another holds the seat - and takes my own', () => {
  const removed = [];
  const layout = foe(), pup = foe({ _ownFrom: 'aaa-0001', _ownI: 3 }), mine = foe({ questBehaviour: { notifyDestroyed() { removed.push('quest'); } } });
  const state = {
    foeSeed, applyWireLook,   // AUDIT MW-NPC II K3: the records' look seed (roomRecord, applyFoeRecord, the puppets' stands)
    foes: [layout, pup, mine], _layoutFoes: 1, _authority: false, _encId: undefined, _wallNow: () => 5,
    renderer: { destroyBillboardBatch: () => removed.push('batch') }, dropCandidate: () => {}, damageFoe: () => {},
  };
  const ops = mount(`${declSrc('isRoomFoe')}\n${declSrc('questPoolOps')}\nreturn questPoolOps;`, state);
  ops.removeFoe(pup);
  assert.equal(pup.dead, false, 'a party member\'s foe stays - it was the batch-less corpse its owner\'s next record stood up, and the draw threw');
  assert.deepEqual(pup.batch, { b: 1 });
  ops.removeFoe(layout);
  assert.equal(layout.dead, false, 'a room foe while another holds the seat stays');
  ops.removeFoe(mine);
  assert.equal(mine.dead, true, 'my own goes');
  assert.deepEqual(removed, ['batch', 'quest']);
  state._authority = true;
  ops.removeFoe(layout);
  assert.equal(layout.dead, true, 'the seat\'s own room foe goes');
});

test('AUDIT pre-merge D8: what I take is bounded - a peer naming me heir on fresh records every frame stood real foes without end (a taken foe leaves the owner\'s puppet count); past the owners\' own allowances nothing more is taken', async () => {
  const me = side('mmm-0002');
  me.share.behaviourFor = () => null;
  let seq = 0;
  for (let round = 0; round < 6; round++) {
    const f = [], qf = [];
    for (let k = 0; k < 10; k++) { const i = ++seq; f.push({ i, t: 5, x: 0, f: [i, 0, 0], y: 0, h: 30, d: 0, a: 0, m: 0, e: 'mmm-0002' }); qf.push([i, QUEST, '_vampire_']); }
    me.applyOwnFrame('aaa-0001', { n: round + 1, k: 'dungeon:7', full: 0, f, qf });
    await tick();
  }
  const taken = me.foes.filter((x) => x._ownFrom == null && !x.dead).length;
  assert.equal(taken, QUEST_PUPPETS_MAX + 24, `bounded at the owners' allowances (${taken} of 60 offered) - DESYNC-ZERO: the room's loose allowance is LOOSE_PUPPETS_MAX (24)`);
});

test('AUDIT DISC28 QS-J: the orphan law\'s pick whose copy holds no such quest takes the orphan from the record it kept - it stands for the party; a kept record goes as a stood one goes, bounded as one is, and never stands, credits a kill, or outlives its owner\'s return', async () => {
  const vamp = questFoe('_vampire_');
  const owner = side('aaa-0001', { own: [vamp] });
  const low = side('mmm-0002'), high = side('zzz-0009');
  low.share.linked = false;   // DISC28-J: it stands none of the quest's puppets
  low.share.adoptsOrphan = () => true;   // the lowest id near the foe - the law's pick
  for (const s of [low, high]) s.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  await tick();
  assert.equal(low.foes.length, 0, 'DISC28-J stands: nothing stood, drawn or struck');
  assert.equal(high.state._ownPups.size, 1, 'the linked member stands it');
  low.pruneOwnOwners(new Set(), 0, 0); high.pruneOwnOwners(new Set(), 0, 0);   // the owner gone without a word
  await tick();
  const took = low.foes.find((f) => f._ownFrom == null && !f.dead);
  assert.ok(took, 'the law\'s pick took it, from the record it kept');
  assert.deepEqual(took._keptTag, { q: QUEST, s: '_vampire_' }, 'on the partner\'s word');
  assert.equal(high.foes.filter((f) => !f.dead).length, 0, 'the member the law did not name let its puppet go');
  high.applyOwnFrame('mmm-0002', low.ownFrame(true));
  await tick();
  assert.equal(high.state._ownPups.size, 1, 'it stands for the party');
  /** A party member with no linked copy that heard `from`'s frame (then `drop`), and the owner then gone: what it took. */
  const kept = async (drop = () => {}, { from = 'aaa-0001', elected = true } = {}) => {
    const v = questFoe('_vampire_');
    const o = side(from, { own: [v] });
    const s = side('mmm-0002');
    s.share.linked = false; s.share.adoptsOrphan = () => elected;
    const fr = o.ownFrame(true);
    s.applyOwnFrame(from, fr);
    await tick();
    assert.equal(s.foes.length, 0, 'kept, never stood');
    await drop(s, fr);
    s.pruneOwnOwners(new Set(), 10000, 0);
    await tick();
    assert.deepEqual(s.credit.died, [], 'a kept record credits no kill');
    return s.foes.filter((f) => !f.dead);
  };
  const word = (s, fr, over) => s.applyOwnFrame('aaa-0001', { ...fr, n: fr.n + 1, ...over });
  assert.equal((await kept()).length, 1, 'kept, then taken (the control)');
  const merged = await kept((s, fr) => word(s, fr, { full: 0, f: [{ i: fr.f[0].i, h: 7 }] }));
  assert.equal(merged.length, 1, 'a record that carries only what changed is merged over the last word');
  assert.equal(merged[0].entity.health, 7, 'and taken as it stood last');
  assert.equal((await kept((s, fr) => word(s, fr, { f: [], qf: [] }))).length, 0, 'a full frame that no longer lists it');
  assert.equal((await kept((s, fr) => word(s, fr, { full: 0, f: [{ ...fr.f[0], d: 1 }] }))).length, 0, 'its death');
  assert.equal((await kept((s, fr) => word(s, fr, { full: 0, f: [{ ...fr.f[0], e: 'zzz-0009' }] }))).length, 0, 'a handover naming another heir - that one takes it');
  assert.equal((await kept((s) => { s.state._ownOwners.get('aaa-0001').at = 0; s.pruneOwnOwners(new Set(['aaa-0001']), 10000, 6000); })).length, 0, 'an owner gone quiet (the stale sweep keeps nothing, adopts nothing)');
  assert.equal((await kept((s, fr) => { s.clearOwnPuppets(); word(s, fr, { full: 0, f: [], qf: [] }); })).length, 0, 'a room change - the owner heard again in the new room, naming nothing');
  assert.equal((await kept(() => {}, { from: 'bob-0005' })).length, 0, 'a stranger\'s');
  assert.equal((await kept(() => {}, { elected: false })).length, 0, 'a member the law did not name');
  const once = await kept(async (s, fr) => { s.share.linked = true; word(s, fr, {}); await tick(); });   // a copy linked since stands it
  assert.equal(once.length, 1, 'the law takes that one, and that one alone - not a second out of the record it kept before');
  assert.equal(once[0]._keptTag, undefined, 'bound to its own copy now');
  // no more of an owner's than a stood copy's allowance (QUEST_PUPPETS_MAX)
  {
    const o = side('aaa-0001', { own: [questFoe('_vampire_')] });
    const s = side('mmm-0002');
    s.share.linked = false; s.share.adoptsOrphan = () => true;
    const fr = o.ownFrame(true);
    const f = Array.from({ length: QUEST_PUPPETS_MAX + 2 }, (_, k) => ({ ...fr.f[0], i: 100 + k }));
    s.applyOwnFrame('aaa-0001', { ...fr, f, qf: f.map((r) => [r.i, QUEST, '_vampire_']) });
    s.pruneOwnOwners(new Set(), 0, 0);
    await tick();
    assert.equal(s.foes.filter((x) => !x.dead).length, QUEST_PUPPETS_MAX, 'bounded as a stood copy is');
  }
  // its owner back under the same id, streaming it alive: a build still out ends on arrival; a taken one is theirs again
  {
    const o = side('aaa-0001', { own: [questFoe('_vampire_')] });
    const s = side('mmm-0002');
    s.share.linked = false; s.share.adoptsOrphan = () => true;
    s.applyOwnFrame('aaa-0001', o.ownFrame(true));
    await tick();
    s.pruneOwnOwners(new Set(), 0, 0);   // the build out...
    s.applyOwnFrame('aaa-0001', o.ownFrame(true));   // ...and its owner back
    await tick();
    assert.equal(s.foes.filter((x) => !x.dead).length, 0, 'a build its owner\'s return overtook ends on arrival');
    s.pruneOwnOwners(new Set(), 0, 0);
    await tick();
    const t = s.foes.find((x) => x._ownFrom == null && !x.dead);
    assert.ok(t, 'the record, kept again, is the law\'s when its owner goes again');
    s.applyOwnFrame('aaa-0001', o.ownFrame(true));
    assert.equal(t.dead && t._gone, true, 'theirs again (AUDIT pre-merge D2) - mine let go, no death, no body');
    assert.equal(s.foes.filter((x) => !x.dead).length, 0, 'and not stood by a copy with no link');
  }
});
