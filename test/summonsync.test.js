// SUMMON-SYNC (2026-09-27, Mac: "Finish the 2 gaps"). QUEST-PARTY phase 3c left one foe past a dungeon's layout run its
// player's alone: a LOOSE stand - a summon's foe (a SoulBound's release, the Sanguine Rose's Daedroth) or a Wabbajack's
// change - in no frame and blind to every other player (the ONLINE-DUNGEON-FOES flag's last half). It rides the room's
// own lane now, as a cell's loose stand rides its cell (WORLD6b): named in the frame's `lf`, stood by EVERY player in
// the room (CELL_LOOSE_PUPPETS an owner), struck through its owner by anyone there, hunting everyone there, weighed by
// who fights it, handed at a door out to the player nearest it, gone with an owner that left without a word. A shared
// quest's foe keeps the party's law; a private quest's stays its player's own. Mounted over the context's own statements
// (test/questparty3c.test.js's harness); the flag's retirement by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import './modsOff.js';
import { validFoeRecord, FOE_HEALTH_MAX, FOE_LEVEL_MAX, CELL_FRAME_RECORDS_MAX, CELL_LOOSE_PUPPETS, FOES_FRAME_MAX } from '../src/net/wire.js';
import { validQuestTags, questMarkerYields, QUEST_PUPPETS_MAX, validLooseSeqs, companionNames } from '../src/scenes/exteriorFoes.js';
import { isPrivateQuestFoe } from '../src/scenes/questFoeHost.js';   // CURSE-SYNC: the handovers' word for a quest's foe
import { PARTY_ME, noteFighter, foeFighters, partyFoeLoses, partyFoeHeals, partyFoeHits, _resetPartyScaleForTests } from '../src/systems/partyScale.js';
import { indexText } from './bibleIndex.mjs';

const D = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
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
const foe = (over = {}) => ({
  mobileType: 5, gender: 'male', dead: false, corpse: false, batch: { b: 1 },
  ai: { feet: [0, 0, 0], yaw: 0, moving: false, target: null, height: 1.8, resumeLive() { this.resumed = true; } },
  entity: { health: 30, maxHealth: 30, items: [] },
  ...over,
});
/** spawnLooseFoe's stand: a summon's foe, a Wabbajack's change */
const loose = (over = {}) => foe({ _loose: true, ...over });
const questFoe = (symbol = '_vampire_', over = {}) => foe({ questBehaviour: { questUID: 7, targetSymbol: { name: symbol } }, ...over });
const PARTY = new Set(['aaa-0001', 'mmm-0002']);

/** One player's dungeon: its layout run, its own foes past it, and the own lane's doors over stubs. */
function side(self, { layout = [], own = [], authority = true } = {}) {
  const foes = [...layout, ...own];
  const built = [], bound = [], landed = [], removed = [];
  const share = {
    tagOf: (f) => (f.questBehaviour?.targetSymbol?.name && !f.questBehaviour.private ? { q: QUEST, s: f.questBehaviour.targetSymbol.name } : null),
    accepts: (from) => PARTY.has(self) && PARTY.has(from),
    peerMayHit: (peerId) => PARTY.has(peerId),
    onPuppetHurt() {}, onPuppetDied() {},
    behaviourFor: (tag) => { const b = { questUID: 7, targetSymbol: { name: tag.s } }; bound.push(b); return b; },
    adoptsOrphan: () => false,
  };
  const state = {
    opts: { selfId: () => self, questShare: () => share },
    _layoutFoes: layout.length, foes, _authority: authority, _ctxDead: false, _locationKey: 'dungeon:7',
    _ownSeq: 0, _ownFrameSeq: 0, _ownGen: 0, _ownPups: new Map(), _ownPending: new Map(), _ownOwners: new Map(), _ownPendLoose: new Set(), _ownAdopted: new Map(), _ownKept: new Map(),
    FOE_HEALTH_MAX, FOE_LEVEL_MAX, CELL_FRAME_RECORDS_MAX, QUEST_PUPPETS_MAX, CELL_LOOSE_PUPPETS, HIT_DMG_MAX: 10000, FOES_FRAME_MAX,
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
    ${declSrc('ownRides')}
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
    return { ownFrame, applyOwnFrame, applyOwnHit, pruneOwnOwners, clearOwnPuppets, ownHandOverFrame, dropOwnHanded, ownLoose, ownRides };
  `, state);
  return { ...api, state, foes, built, bound, landed, removed, share };
}

test('SUMMON-SYNC: my loose stands past the run ride the own lane named in `lf` - a hostile one and my ally alike, a body as a body - beside a shared quest\'s in `qf`; the layout\'s, a private quest\'s and an unmarked foe never; a quest\'s foe rides by its quest\'s law even marked loose', () => {
  const summon = loose({ ai: { feet: [2, 0, 3], yaw: 0, moving: false, target: null } });
  const ally = loose({ entity: { health: 30, maxHealth: 30, items: [], team: 'PlayerAlly' } });
  const vamp = questFoe('_vampire_', { _loose: false });
  const marked = questFoe('_ghost_', { _loose: true });
  const secret = questFoe('_spy_'); secret.questBehaviour.private = true; secret._loose = true;
  const stray = foe();   // past the run with no mark: nobody's to stream
  const me = side('aaa-0001', { layout: [loose()], own: [summon, ally, vamp, marked, secret, stray] });
  const full = me.ownFrame(true);
  assert.deepEqual(full.f.map((r) => r.i), [summon._ownSeq, ally._ownSeq, vamp._ownSeq, marked._ownSeq], 'the loose two and the shared quest\'s two - never the layout\'s run (even marked), a private quest\'s or an unmarked foe');
  assert.deepEqual(full.lf, [summon._ownSeq, ally._ownSeq], 'the loose stands, by their numbers');
  assert.deepEqual(full.qf, [[vamp._ownSeq, QUEST, '_vampire_'], [marked._ownSeq, QUEST, '_ghost_']], 'a quest\'s foe by its quest\'s law, whatever its mark');
  assert.deepEqual([full.f[0].t, full.f[0].f, full.f[0].g], [5, [2, 0, 3], '.'], 'the layout\'s own record');
  assert.equal(me.ownFrame(false), null, 'quiet between');
  summon.dead = true; summon.corpse = true; summon.entity.health = 0;
  const body = me.ownFrame(false);
  assert.deepEqual([body.f.map((r) => [r.i, r.d]), body.lf, body.qf], [[[summon._ownSeq, 1]], [summon._ownSeq], undefined], 'its body rides as a body, still named loose');
  summon.corpse = false;
  const gone = me.ownFrame(true);
  assert.ok(!gone.f.some((r) => r.i === summon._ownSeq) && !gone.lf.includes(summon._ownSeq), 'no body: it rides no more, and the full frame takes it down');
  assert.equal(me.ownLoose(ally), true, 'my ally is my loose stand');
  assert.equal(me.ownLoose(vamp), false); assert.equal(me.ownLoose(me.foes[0]), false, 'the layout\'s run is the room\'s');
});

test('SUMMON-SYNC: anyone in the room stands my loose stands - a stranger to my party too - CELL_LOOSE_PUPPETS an owner, a quest\'s allowance apart; the party\'s quest stays the party\'s; a number named nowhere, or junk in `lf`, stands nothing; a full frame takes down what it no longer lists', async () => {
  const six = Array.from({ length: 6 }, (_, k) => loose({ ai: { feet: [k, 0, 1], yaw: 0, moving: false, target: null } }));
  const vamp = questFoe('_vampire_');
  const owner = side('aaa-0001', { own: [...six, vamp] });
  const frame = owner.ownFrame(true);
  const bob = side('bob-0005');   // no party of the owner's
  assert.equal(bob.applyOwnFrame('aaa-0001', frame), true);
  await tick();
  assert.equal(bob.built.length, CELL_LOOSE_PUPPETS, `four of the six - the cell's allowance (${CELL_LOOSE_PUPPETS})`);
  const pups = [...bob.state._ownPups.values()];
  assert.ok(pups.every((p) => p._pupLoose === true && p._pupQuest === null && p._ownFrom === 'aaa-0001'), 'loose puppets, the owner\'s');
  assert.ok(!pups.some((p) => p._ownI === vamp._ownSeq), 'and never the party\'s quest foe');
  const amy = side('mmm-0002');   // the owner's party: the quest foe first, then the loose ones
  amy.applyOwnFrame('aaa-0001', { n: 0, k: 'dungeon:7', full: 0, f: frame.f.filter((r) => r.i === vamp._ownSeq), qf: frame.qf });
  await tick();
  assert.equal(amy.built.length, 1, 'the quest foe stands');
  amy.applyOwnFrame('aaa-0001', frame);
  await tick();
  assert.equal(amy.built.length, CELL_LOOSE_PUPPETS + 1, 'and the loose four beside it - each kind its own allowance, a standing quest foe no loose stand\'s');
  // a record named BOTH a party's quest foe and a loose stand is the quest's - a stranger stands nothing of it
  const dual = side('bob-0005');
  dual.applyOwnFrame('aaa-0001', { ...owner.ownFrame(true), lf: [vamp._ownSeq] });
  await tick();
  assert.equal(dual.built.length, 0, 'the quest\'s law wins over a loose name');
  // named nowhere, or named by junk
  const bare = side('bob-0005');
  bare.applyOwnFrame('aaa-0001', { ...frame, n: frame.n, lf: undefined, qf: undefined });
  bare.applyOwnFrame('aaa-0001', { ...owner.ownFrame(true), lf: ['x', -1, 2 ** 40, null, 1.5] });
  await tick();
  assert.equal(bare.built.length, 0, 'a record no list names stands nothing');
  assert.deepEqual([...validLooseSeqs([3, 'x', -1, 2 ** 40, 7])], [3, 7], 'the list\'s own door');
  // the owner's summon goes (Destroy()ed): the next full frame takes it down
  const first = pups[0];
  six[six.findIndex((f) => f._ownSeq === first._ownI)].dead = true;
  bob.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  assert.ok(first._gone && !bob.foes.includes(first), 'a full frame that no longer lists it takes it down');
});

test('SUMMON-SYNC: anyone\'s blow in the room on my loose stand lands through the peer\'s door, whoever hosts; my quest foe keeps the party\'s law; another dungeon\'s, an unbounded or a dead one\'s does not', () => {
  const summon = loose(), vamp = questFoe('_vampire_');
  const me = side('aaa-0001', { own: [summon, vamp], authority: false });
  me.ownFrame(true);
  assert.equal(me.applyOwnHit('bob-0005', { own: 1, to: 'aaa-0001', k: 'dungeon:7', i: summon._ownSeq, dmg: 5, kind: 'melee' }), true, 'a stranger\'s blow on my summon lands');
  assert.deepEqual(me.landed.map(([f, id, d]) => [f === summon, id, d]), [[true, 'bob-0005', 5]]);
  assert.equal(me.applyOwnHit('bob-0005', { own: 1, i: vamp._ownSeq, dmg: 5 }), false, 'but my quest foe is the party\'s to strike');
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, i: vamp._ownSeq, dmg: 5 }), true, 'as it was');
  assert.equal(me.applyOwnHit('bob-0005', { own: 1, k: 'dungeon:8', i: summon._ownSeq, dmg: 5 }), false, 'another dungeon\'s');
  assert.equal(me.applyOwnHit('bob-0005', { own: 1, i: summon._ownSeq, dmg: 1e9 }), false, 'unbounded');
  summon.dead = true;
  assert.equal(me.applyOwnHit('bob-0005', { own: 1, i: summon._ownSeq, dmg: 5 }), false, 'dead');
  assert.equal(me.landed.length, 2);
});

test('SUMMON-SYNC: a departing owner hands a loose stand to the player it names - anyone in the room - who takes it as it stands (no quest bound) and streams it on; an owner gone without a word takes its loose stands with it, while its shared quest\'s orphan is still adopted', async () => {
  const summon = loose();
  const owner = side('aaa-0001', { own: [summon] });
  const bob = side('bob-0005');
  bob.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  await tick();
  const pup = bob.state._ownPups.get(`aaa-0001:${summon._ownSeq}`);
  const handed = owner.ownHandOverFrame(() => 'bob-0005');
  assert.deepEqual([handed.f[0].e, handed.lf], ['bob-0005', [summon._ownSeq]], 'the heir named, the stand named loose');
  bob.applyOwnFrame('aaa-0001', handed);
  assert.deepEqual([pup._ownFrom, pup._pupLoose, pup._loose], [null, false, true], 'the heir took it, and it is the heir\'s loose stand now');
  assert.equal(pup.questBehaviour, undefined, 'no quest bound');
  assert.equal(bob.bound.length, 0);
  assert.equal(pup.ai.resumed, true, 'its motor resumes from the pose');
  assert.deepEqual(bob.ownFrame(true).lf, [pup._ownSeq], 'and it rides the heir\'s lane to the room');
  assert.equal(owner.dropOwnHanded(), 1, 'the owner lets it go');
  // an owner gone without a word
  const s2 = loose(), q2 = questFoe('_vampire_');
  const o2 = side('aaa-0001', { own: [s2, q2] });
  const amy = side('mmm-0002');
  amy.applyOwnFrame('aaa-0001', o2.ownFrame(true));
  await tick();
  const lp = [...amy.state._ownPups.values()].find((p) => p._pupLoose), qp = [...amy.state._ownPups.values()].find((p) => p._pupQuest);
  assert.ok(lp && qp);
  let asked = 0;
  amy.share.adoptsOrphan = () => { asked++; return true; };
  amy.pruneOwnOwners(new Set(), 0, 0);
  assert.equal(qp._ownFrom, null, 'the shared quest\'s orphan: adopted by the one the law names');
  assert.ok(lp._gone && !amy.foes.includes(lp), 'the loose stand went with its owner, the cell\'s law');
  assert.equal(asked, 1, 'the orphan law is asked of the quest\'s foe alone');
});

test('SUMMON-SYNC: my loose stand hunts every player in the room - my quest foe its party, the layout\'s run every player while I hold the seat, an unmarked foe past the run nobody', () => {
  const at = D.indexOf('candidates: foeDeps ? (streamed = false, rec = null) =>');
  assert.ok(at > 0, 'the candidates seam');
  const line = D.slice(at, D.indexOf('\n', at));
  const arrow = line.slice(line.indexOf('(streamed = false'), line.lastIndexOf(' : null,'));
  const summon = loose(), vamp = questFoe('_vampire_'), stray = foe(), lay = foe();
  const share = { tagOf: (f) => (f.questBehaviour ? { q: QUEST, s: '_vampire_' } : null), peerMayHit: (id) => PARTY.has(id) };
  const peers = [{ id: 'mmm-0002' }, { id: 'bob-0005' }];
  const cands = mount(`${declSrc('isRoomFoe')}\n${declSrc('ownShare')}\n${declSrc('ownQuestTag')}\n${declSrc('ownLoose')}\nreturn ${arrow};`,
    { foes: [lay, summon, vamp, stray], _layoutFoes: 1, _authority: false, opts: { questShare: () => share }, peerCandidates: () => peers });
  const ids = (rec, streamed = false) => cands(streamed, rec).filter((c) => !c.ai).map((c) => c.id);
  assert.deepEqual(ids(summon), ['mmm-0002', 'bob-0005'], 'my loose stand: everyone in the room');
  assert.deepEqual(ids(vamp), ['mmm-0002'], 'my quest foe: its party');
  assert.deepEqual(ids(stray), [], 'an unmarked foe past the run: nobody');
  assert.deepEqual(ids(lay, true), [], 'the layout\'s run while another holds the seat: a puppet');
});

test('SUMMON-SYNC: my loose stand is weighed by who fights it, counted by me whoever holds the seat; another\'s loose puppet reads its owner\'s count; my allied summon never', () => {
  _resetPartyScaleForTests();
  const a = D.indexOf('function _sharedFoe(f) {'), b = D.indexOf('function damageFoe(foe, damage,', a);
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  const door = strip(D.slice(b, D.indexOf('if (foe.entity.health <= 0) {', b))).match(/foe\.entity\.health -=[^;]*;/g);
  const summon = loose({ entity: { health: 100, maxHealth: 200 } });
  const ally = loose({ entity: { health: 100, maxHealth: 200, team: 'PlayerAlly' } });
  const pup = foe({ _ownFrom: 'bob-0005', _ownI: 3, _pupLoose: true, _fightN: 3 });
  const d = mount(`${declSrc('isRoomFoe')}\n${declSrc('ownShare')}\n${declSrc('ownQuestTag')}\n${declSrc('ownLoose')}\n${declSrc('ownRides')}\n${strip(D.slice(a, b))}
    return { _sharedFoe, _runsFoe, fightN, _weighHit, door: (foe, healthDamage, bypassShield = false, _whole = false) => { ${door[0]} } };`,
  { foes: [foe(), summon, ally, pup], _layoutFoes: 1, _authority: false, opts: { questShare: () => ({ tagOf: () => null }) }, playerEntity: { maxHealth: 100 }, partyFoeLoses, partyFoeHits, partyFoeHeals, foeFighters, performance });
  const now = performance.now();
  for (const who of [PARTY_ME, 'bob-0005', 'carl-0003', 'dave-0004']) { noteFighter(summon, who, now); noteFighter(ally, who, now); noteFighter(pup, who, now); }
  assert.deepEqual([d._sharedFoe(summon), d._runsFoe(summon), d.fightN(summon)], [true, true, 4], 'mine: shared, run here, four fight it');
  d.door(summon, 5); assert.equal(summon.entity.health, 98, 'five at four fighters is two');
  assert.equal(d._weighHit(summon, 10), 13);
  assert.deepEqual([d._sharedFoe(pup), d._runsFoe(pup), d.fightN(pup)], [true, false, 3], 'another\'s: its owner\'s count');
  assert.equal(d._sharedFoe(ally), false, 'my ally: never');
  d.door(ally, 5); assert.equal(ally.entity.health, 95);
});

test('SUMMON-SYNC: the Wabbajack re-stands only what this copy runs - never a puppet of the seat\'s foe or of another\'s stand, whose change would ride the room beside the runner\'s foe', () => {
  const run = (authority, target) => {
    const removed = [], spawned = [];
    const r = mount(`${declSrc('isRoomFoe')}\n${fnSrc('replaceFoeInPool')}\nreturn replaceFoeInPool;`, {
      foes: [target.lay, target.mine, target.pup], _layoutFoes: 1, _authority: authority,
      questPoolOps: { removeFoe: (f) => { f.dead = true; removed.push(f); } },
      spawnLooseFoe: (mt) => { spawned.push(mt); return Promise.resolve(null); },
      centreFromFeet: (feet) => feet, lastPlayerFeet: [0, 0, 0], renownFoeCarry: () => {},
    });
    return { r, removed, spawned };
  };
  const make = () => ({ lay: foe(), mine: loose(), pup: foe({ _ownFrom: 'bob-0005', _ownI: 2 }) });
  for (const [authority, pick, moves] of [[false, 'lay', false], [false, 'pup', false], [true, 'pup', false], [true, 'lay', true], [false, 'mine', true]]) {
    const t = make();
    const { r, removed, spawned } = run(authority, t);
    r(t[pick].entity, 9);
    assert.equal(removed.length === 1 && spawned[0] === 9, moves, `${authority ? 'the seat' : 'a joiner'}, ${pick}: ${moves ? 'changed' : 'refused'}`);
  }
});

test('SUMMON-SYNC by source: every loose stand is marked, a quest\'s foe unmarked; the flag is retired at its site and off the board', () => {
  assert.match(D, /if \(yawRad != null && f\.ai\) f\.ai\.yaw = yawRad;\n\s*(?:if \(bout\) \{ f\.entity\.bout = bout; f\.entity\.items = \[\]; f\._bout = true; return f; \}\n\s*)?f\._loose = true;/, 'spawnLooseFoe marks its stand');   // ARENA2: an arena bout's fighter is the bout's, not a loose stand (offline; ARENA4 carries it online)   // merged beside OH-F C4: the alliance rides the build's record (buildFoeAt), so the mark follows the yaw
  assert.match(D, /const f = await spawnLooseFoe\(mobileType, position, \{ gender, yawRad(?:, questSpawn: true)? \}\);\n\s*if \(!f\) \{[^\n]*\}\n\s*f\._loose = false;/, 'a quest\'s foe rides by its quest\'s law');
  assert.match(D, /SUMMON-SYNC \(2026-09-27, Mac: "Finish the 2 gaps"\) paid the last/);
  assert.match(indexText(), /## Open flags/, 'the index still carries the open flags (a negative pin over a page that lost them would pass for ever - HARD5)');
  assert.doesNotMatch(indexText(), /`src\/scenes\/dungeonContext\.js:\d+` - REPORTS ARE THIS ONE LINE/, 'the open flags no longer carry it');
});

test('SUMMON-SYNC: an ALLY goes with its summoner - neither handover names an heir for it (its record carries no side, and an heir stood it as everyone\'s foe); a loose foe goes to the nearest player, a shared quest\'s to a party member', () => {
  const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const body = (head) => {
    const at = W.indexOf(head);
    assert.ok(at > 0, `world.js has ${head}`);
    let depth = 0;
    for (let i = W.indexOf('{', at); i < W.length; i++) {
      if (W[i] === '{') depth++;
      else if (W[i] === '}' && --depth === 0) return W.slice(W.indexOf('{', at), i + 1);
    }
    return assert.fail('unbalanced');
  };
  const ally = { entity: { team: 'PlayerAlly' }, ai: { feet: [1, 0, 1] } };
  const summon = { entity: {}, ai: { feet: [1, 0, 1] } };
  const vamp = { entity: {}, isQuestFoe: true, questBehaviour: { targetQuest: { questName: 'B0B00Y00' } }, ai: { feet: [1, 0, 1] } };   // CURSE-SYNC: a quest foe as the pool mints it - its behaviour is what the handover reads
  const near = [{ id: 'bob-0005', feet: [1, 0, 2] }, { id: 'mmm-0002', feet: [9, 0, 9] }];
  const social = { isPartyPeer: (id) => id === 'mmm-0002' };
  const sent = [];
  const room = new Function('modes', 'online', 'isWorldRoom', 'peersNear', 'social', 'isPrivateQuestFoe', `return () => ${body('const handOverRoomFoes = () =>')};`)(
    { mode: 'dungeon', ownHandOverFrame: (heirOf) => ({ f: [heirOf(ally), heirOf(summon), heirOf(vamp)] }), dropOwnHanded: () => 2 },
    { room: 'world:dungeon:7', ownOk: true, sendOwnFoes: (f) => { sent.push(f); return true; } }, () => true, () => near, social, isPrivateQuestFoe);
  assert.equal(room(), 2);
  assert.deepEqual(sent.at(-1).f, [null, 'bob-0005', 'mmm-0002'], 'the room\'s: no heir for my ally, the nearest for my summon, the party for my quest\'s');
  const cell = new Function('modes', 'online', 'isCellRoom', 'peersNear', 'social', 'exteriorFoes', 'isPrivateQuestFoe', `return () => ${body('const handOverFoes = () =>')};`)(
    { mode: 'exterior' }, { room: 'world:3,12', sendFoes: (f) => { sent.push(f); return true; } }, () => true, () => near, social,
    { handOverFrame: (heirOf) => ({ f: [heirOf(ally), heirOf(summon), heirOf(vamp)] }), dropOwnLive: () => 2 }, isPrivateQuestFoe);
  assert.equal(cell(), 2);
  assert.deepEqual(sent.at(-1).f, [null, 'bob-0005', 'mmm-0002'], 'and the cell\'s, by the same rule');
});

test('AUDIT pre-merge D6: my summoned ALLY rides the loose lane (the others see it fight) but takes no other player\'s blow - their puppet of it has no side to tell them, so the owner refuses; my foe on the same lane still takes the room\'s', () => {
  const ally = loose({ entity: { health: 30, maxHealth: 30, items: [], team: 'PlayerAlly' } });
  const summon = loose();
  const me = side('aaa-0001', { own: [ally, summon] });
  const fr = me.ownFrame(true);
  assert.deepEqual(fr.lf, [ally._ownSeq, summon._ownSeq], 'both ride to the room');
  assert.equal(me.applyOwnHit('bob-0005', { own: 1, i: ally._ownSeq, dmg: 5 }), false, 'a stranger\'s blow on my ally lands nothing');
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, i: ally._ownSeq, dmg: 5 }), false, 'nor a party member\'s');
  assert.equal(me.applyOwnHit('bob-0005', { own: 1, i: summon._ownSeq, dmg: 5 }), true, 'my loose foe takes the room\'s blows, as it did');
});
