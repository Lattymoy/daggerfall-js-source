// AUDIT RPT1026 (lane G, ITEMS) - the audit of FIELD BUGS 2026-10-26r's item fixes: the pins of what it found.
//
// G1 (BODY-CAP): past SHARED_FOES_MAX encounters a full frame names the standing and then the bodies OLDEST FIRST, so
// the body of a foe that has just fallen is the one the cap sheds. Its death rides a delta only - and when the frame
// after the death is the full one (FOES_FULL_MS, one frame in ten at FOES_MS), the joiner's puppet is still standing
// there, a standing puppet a capped frame does not name goes, and the death's record that follows names an encounter
// the joiner no longer holds: "a body never seen standing" stands nothing. The body vanished as its foe fell, on every
// joiner's screen, as the report had it. Mounted as the context's own statements (test/net/rpt1026_items_bodycap's
// harness), the death through the context's own corpse door (spawnCorpse - the stamp the frame orders by).
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
const CONSTS = ['SHARED_FOES_MAX', 'XF_WHOLE', 'q2', 'q3'];
const consts = () => CONSTS.map(declSrc).join('\n');
const { SHARED_FOES_MAX, XF_STANDING } = mount(`${consts()}\nreturn { SHARED_FOES_MAX, XF_STANDING };`, {});
const surplusSrc = () => ['FOE_SEQ_MAX_SURPLUS', '_surplus', '_surplusPending', '_hiddenFrom', '_layoutMismatchSaid'].map(declSrc).join('\n') + '\n'
  + ['sayLayoutMismatch', 'hideBeyondHostLayout', 'surplusRecord', 'dropSurplus', 'clearSurplus'].map(fnSrc).join('\n');

const foe = (over = {}) => ({
  mobileType: 5, gender: 'male', dead: false, corpse: false, batch: { b: 1 },
  ai: { feet: [0, 0, 0], yaw: 0, moving: false, target: null, height: 1.8 },
  entity: { health: 30, maxHealth: 30, level: 1, items: [] },
  ...over,
});
/** One side of the room over the dungeon context's own statements - the host's frame out and its corpse door (the stamp
 *  a death takes), a joiner's frame in. `clock` is the shared clock _wallNow reads. */
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
    clock: 1_000_000, _wallNow: () => state.clock, roomBodyBorn: () => {}, spawnCorpseNow: async () => {},
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
    ${fnSrc('spawnCorpse')}
    return { foesFrame, applyFoesFrame, spawnCorpse };
  `, state);
  /** A kill on the host, as damageFoe's death door has it: dead, then the corpse door (its stamp), the clock a minute on. */
  const kill = (f) => { state.clock += 60_000; f.dead = true; api.spawnCorpse(f); };
  return { ...api, state, dropped, kill };
}

test('G1 BODY-CAP: past the cap, a foe that falls just before the host\'s full frame lies on the joiner\'s screen too - the frame names the newest bodies first, so the cap never sheds a death no frame has told (mutant: the oldest bodies first)', async () => {
  // the room: 33 encounters killed one by one through the corpse door, then a fresh ambush of two on its feet - 35 in all
  const room = Array.from({ length: SHARED_FOES_MAX + 3 }, (_, n) => foe({ _encId: n + 1 }));
  const host = side({ authority: true, shared: room });
  for (const f of room.slice(0, SHARED_FOES_MAX + 1)) host.kill(f);
  // the joiner was told all of it as it happened: 33 bodies, two standing
  const joiner = side({ authority: false, shared: room.map((f) => foe({ _encId: f._encId, dead: f.dead, corpse: f.dead })) });
  assert.equal(host.foesFrame(true).xf, XF_STANDING, 'the room is past the cap');
  // the ambush's last foe falls, and the frame after its death is the full one
  const fallen = room.at(-1);
  host.kill(fallen);
  assert.equal(joiner.applyFoesFrame(host.foesFrame(true), 'host'), true);
  assert.equal(joiner.applyFoesFrame(host.foesFrame(false), 'host'), true);   // the delta after it
  const body = joiner.state._sharedById.get(fallen._encId);
  assert.ok(body, 'the fallen foe is still the room\'s on the joiner');
  assert.equal(body.dead, true, 'and lies there as a body');
  assert.deepEqual(joiner.dropped, [], 'nothing the host still has is taken down');
  // and the body the cap now sheds is an old one, which the joiner has long held dead and keeps
  for (let k = 0; k < 3; k++) joiner.applyFoesFrame(host.foesFrame(true), 'host');
  assert.equal(joiner.state._sharedById.size, room.length, 'every body stays');
});
