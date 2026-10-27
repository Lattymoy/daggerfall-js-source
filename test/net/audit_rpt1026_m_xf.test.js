// AUDIT RPT1026 M5 (the record lane of the audit of FIELD BUGS 2026-10-26r): THE FRAME'S KIND IS READ BY THE NAME IT IS
// SAID BY.
//
// The batch's CI pass named BODY-CAP's two frame kinds once (src/scenes/dungeonContext.js `XF_WHOLE`, `XF_STANDING`) so
// that the host carries no enum literal - and left the third reader of the kind, the joiner's own test of a capped frame
// in applySharedRecords, comparing against the literal 2. The value stands at 2 today, so play is the same; but the frame
// says the kind by its name and the joiner kept the number, so a change to the name's value would have the host say one
// kind and its own joiners hear another - every body a capped frame shed taken down again, the report's symptom back.
// Mounted, not matched: the frame and the joiner are the dungeon context's own statements (test/net/restsync.test.js's
// harness, as rpt1026_items_bodycap.test.js mounts them), with the kind's value moved off 2. Fails on 2dc8f31a2.
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

/** The kinds' one declaration, as the module writes it, with XF_STANDING's value moved off 2. */
const KINDS = declSrc('XF_WHOLE');
assert.match(KINDS, /XF_STANDING = 2\b/, 'the module declares the capped kind beside the whole one');
const MOVED = 7;
const consts = (kinds) => [declSrc('SHARED_FOES_MAX'), kinds, declSrc('q2'), declSrc('q3')].join('\n');
const { SHARED_FOES_MAX } = mount(`${consts(KINDS)}\nreturn { SHARED_FOES_MAX };`, {});
const surplusSrc = () => ['FOE_SEQ_MAX_SURPLUS', '_surplus', '_surplusPending', '_hiddenFrom', '_layoutMismatchSaid'].map(declSrc).join('\n') + '\n'
  + ['sayLayoutMismatch', 'hideBeyondHostLayout', 'surplusRecord', 'dropSurplus', 'clearSurplus'].map(fnSrc).join('\n');

const foe = (over = {}) => ({
  mobileType: 5, gender: 'male', dead: false, corpse: false, batch: { b: 1 },
  ai: { feet: [0, 0, 0], yaw: 0, moving: false, target: null, height: 1.8 },
  entity: { health: 30, maxHealth: 30, level: 1, items: [] },
  ...over,
});
/** One side of the room over the dungeon context's own statements, the kinds declared by `kinds`. */
function side({ authority, shared = [], kinds }) {
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
    ${consts(kinds)}
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
const roomOf = (standing, bodies) => [
  ...Array.from({ length: standing }, (_, n) => foe({ _encId: n + 1 })),
  ...Array.from({ length: bodies }, (_, n) => foe({ _encId: standing + n + 1, dead: true, corpse: true })),
];

test('AUDIT RPT1026 M5: the joiner hears a capped frame by the name the host says it by - its value moved, every body the cap shed stays (mutant: the joiner\'s literal 2)', () => {
  const kinds = KINDS.replace(/XF_STANDING = 2\b/, `XF_STANDING = ${MOVED}`);
  const frame = side({ authority: true, shared: roomOf(2, SHARED_FOES_MAX + 1), kinds }).foesFrame(true);
  assert.equal(frame.xf, MOVED, 'the host says the capped kind by its name');
  const joiner = side({ authority: false, shared: roomOf(2, SHARED_FOES_MAX + 1), kinds });
  const shed = [...joiner.state._sharedById.values()].slice(SHARED_FOES_MAX);
  assert.ok(shed.length === 3 && shed.every((f) => f.dead), 'the three the cap shed are bodies');
  assert.equal(joiner.applyFoesFrame(frame, 'host'), true);
  assert.deepEqual(joiner.dropped, [], 'no body the cap shed is taken down');
  assert.equal(joiner.state._sharedById.size, SHARED_FOES_MAX + 3, 'every body stays the room\'s on the joiner');
});

test('AUDIT RPT1026 M5: and with the module\'s own values the law is BODY-CAP\'s - a standing puppet the host no longer has still goes under a capped frame', () => {
  const frame = side({ authority: true, shared: roomOf(2, SHARED_FOES_MAX + 1), kinds: KINDS }).foesFrame(true);
  assert.equal(frame.xf, 2, 'the wire\'s value is 2, as older builds read it');
  const joiner = side({ authority: false, shared: [...roomOf(2, SHARED_FOES_MAX + 1), foe({ _encId: 99 })], kinds: KINDS });
  const ghost = joiner.state._sharedById.get(99);
  joiner.applyFoesFrame(frame, 'host');
  assert.deepEqual(joiner.dropped, [ghost], 'the ghost alone');
});
