// RPT1026-ITEMS BODY-CAP - a private report of bodies that disappear as their foes die. A dungeon room's encounters (a
// rest's ambush, stood shared by the host - REST-SYNC) ride the host's foes frame by the room's number, at most
// SHARED_FOES_MAX a frame, the standing first; every body stays the room's while its corpse lies there. A FULL frame said
// it listed them whole (`xf`) even when that cap had cut the list, and a joiner takes down every puppet a whole frame
// does not name - so in a room past 32 encounters (a party that rests often in one dungeon), each newly dead one fell to
// the back of the list and vanished from every joiner's screen at the next full frame. Mounted, not matched: the frame's
// statements are sliced out of the dungeon context's source (test/net/restsync.test.js's harness) and run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { validFoeRecord, FOE_HEALTH_MAX, FOE_LEVEL_MAX, FOES_FRAME_MAX } from '../../src/net/wire.js';
import { foeSeed, applyWireLook } from '../../src/characters/foeBodies.js';
import { isClassEnemyId, enemyEntityType } from '../../src/characters/enemy/enemyBasics.js';
import { bossClockS } from '../../src/systems/bossTraits.js';
import { strikeTraits, traitWire, traitWireKey, readTraitWire, traitsAuthority, traitsFrame } from '../../src/scenes/foeTraitsHost.js';

const D = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
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
const fnSrc = (name) => { const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name); assert.ok(n, name); return D.slice(n.start, n.end); };
const declSrc = (name) => { const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)); assert.ok(n, name); return D.slice(n.start, n.end); };
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const CONSTS = ['SHARED_FOES_MAX', 'XF_WHOLE', 'q2', 'q3'];   // XF_WHOLE's declaration names XF_STANDING too
const consts = () => CONSTS.map(declSrc).join('\n');
const { SHARED_FOES_MAX } = mount(`${consts()}\nreturn { SHARED_FOES_MAX };`, {});
const surplusSrc = () => ['FOE_SEQ_MAX_SURPLUS', '_surplus', '_surplusPending', '_hiddenFrom', '_layoutMismatchSaid'].map(declSrc).join('\n') + '\n'
  + ['sayLayoutMismatch', 'hideBeyondHostLayout', 'surplusRecord', 'dropSurplus', 'clearSurplus'].map(fnSrc).join('\n');

const foe = (over = {}) => ({
  mobileType: 5, gender: 'male', dead: false, corpse: false, batch: { b: 1 },
  ai: { feet: [0, 0, 0], yaw: 0, moving: false, target: null, height: 1.8 },
  entity: { health: 30, maxHealth: 30, level: 1, items: [] },
  ...over,
});
/** One side of the room - the host's frame out, a joiner's in - over the dungeon context's own statements. */
function side({ authority, shared = [] }) {
  const foes = [...shared];
  const dropped = [];
  const state = {
    foeSeed, applyWireLook, strikeTraits, traitWire, traitWireKey, readTraitWire, traitsAuthority, traitsFrame, bossClockS,
    _authority: authority, _layoutFoes: 0, foes, _sharedById: new Map(shared.map((f) => [f._encId, f])),
    _sharedSeq: Math.max(0, ...shared.map((f) => f._encId)), _sharedPending: new Map(), _ctxDead: false,
    _foesSeq: 0, _foesSeqIn: -1, _foesFrom: null, _locationKey: 'dungeon:7', _keyMismatchSaid: false, _retypeFails: new Map(), RETYPE_TRIES: 3,
    isClassEnemyId, enemyEntityType, FOE_HEALTH_MAX, FOE_LEVEL_MAX, validFoeRecord, GENDER_BIT: ['male', 'female'],
    fightN: () => 1, canStandFoe: () => true, retypeFoe: () => assert.fail('no layout here'),
    applyFoeRecord: (f, r) => { if (r.d === 1) f.dead = true; },
    buildFoeAt: async (e) => { const f = foe({ mobileType: e.mobileType }); foes.push(f); return f; },
    renderer: { destroyBillboardBatch: () => {} }, freeCorpse: (f) => { f.corpse = false; }, dropCandidate: (f) => dropped.push(f),
    console: { warn() {}, error: (...a) => assert.fail(a.join(' ')) },
    FOES_FRAME_MAX,
  };
  const api = mount(`
    ${consts()}
    ${declSrc('isRoomFoe')}
    ${declSrc('FOES_FRAME_SLACK')}
    ${declSrc('FOE_MAX_PER_FRAME')}
    ${declSrc('_maxLeft')}
    ${declSrc('foeMaxOf')}
    ${fnSrc('fitMaxima')}
    ${fnSrc('_sharedFoe')}
    ${fnSrc('foesFrame')}
    ${fnSrc('roomRecord')}
    ${fnSrc('applyFoesFrame')}
    ${surplusSrc()}
    ${fnSrc('applySharedRecords')}
    ${fnSrc('standSharedPuppet')}
    ${fnSrc('dropSharedFoe')}
    return { foesFrame, applyFoesFrame };
  `, state);
  return { ...api, state, dropped };
}
/** The room past the cap: `standing` encounters on their feet and `bodies` killed ones, numbered 1.. as the room numbers them. */
const roomOf = (standing, bodies) => [
  ...Array.from({ length: standing }, (_, n) => foe({ _encId: n + 1 })),
  ...Array.from({ length: bodies }, (_, n) => foe({ _encId: standing + n + 1, dead: true, corpse: true })),
];

test('BODY-CAP: past SHARED_FOES_MAX encounters, a full frame says it is whole for the standing alone (2), and a joiner keeps every body it does not name - the newest dead are never taken down (mutant: the cap frame whole)', () => {
  const host = side({ authority: true, shared: roomOf(2, SHARED_FOES_MAX + 1) });
  const frame = host.foesFrame(true);
  assert.equal(frame.x.length, SHARED_FOES_MAX, 'the frame carries its cap');
  assert.deepEqual(frame.x.slice(0, 2).map((r) => r.d), [0, 0], 'the standing first');
  assert.equal(frame.xf, 2, 'whole for the standing, never for the bodies the cap shed');
  // the joiner holds every one of the room's encounters as a puppet (the earlier frames stood them, the deaths landed)
  const joiner = side({ authority: false, shared: roomOf(2, SHARED_FOES_MAX + 1) });
  const shed = [...joiner.state._sharedById.values()].slice(SHARED_FOES_MAX);
  assert.ok(shed.length === 3 && shed.every((f) => f.dead), 'the three the cap shed are bodies');
  assert.equal(joiner.applyFoesFrame(frame, 'host'), true);
  assert.equal(joiner.state._sharedById.size, SHARED_FOES_MAX + 3, 'every body stays the room\'s on the joiner');
  assert.deepEqual(joiner.dropped, [], 'none taken down');
  assert.ok(shed.every((f) => f.corpse), 'their corpses still lie there');
});

test('BODY-CAP: a frame within the cap is whole as before (1), and a standing encounter a capped frame does not name still goes (mutant: a capped frame takes nothing down)', () => {
  const roomy = side({ authority: true, shared: roomOf(1, 3) }).foesFrame(true);
  assert.deepEqual([roomy.x.length, roomy.xf], [4, 1], 'within the cap: every one, whole');
  // the host's encounter number 99 is gone (Destroy()ed - no body) and the room is past the cap: the joiner's standing puppet of it goes
  const host = side({ authority: true, shared: roomOf(2, SHARED_FOES_MAX + 1) });
  const frame = host.foesFrame(true);
  assert.equal(frame.xf, 2);
  const joiner = side({ authority: false, shared: [...roomOf(2, SHARED_FOES_MAX + 1), foe({ _encId: 99 })] });
  const ghost = joiner.state._sharedById.get(99);
  joiner.applyFoesFrame(frame, 'host');
  assert.equal(joiner.state._sharedById.has(99), false, 'a standing puppet the host no longer has is taken down');
  assert.deepEqual(joiner.dropped, [ghost], 'that one alone');
  // and a word this build does not know (a newer build's) takes nothing down - AUDIT RPT1026 G6: this is no older
  // build's reading (an older build reads `xf === 1` alone, so 2 is no whole list there either - its own code, not here)
  const old = side({ authority: false, shared: roomOf(2, SHARED_FOES_MAX + 1) });
  old.applyFoesFrame({ ...frame, xf: 3 }, 'host');
  assert.deepEqual(old.dropped, [], 'a word it does not know is no whole list');
});
