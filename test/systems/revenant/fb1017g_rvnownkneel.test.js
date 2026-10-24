// RVN-OWN-KNEEL (FIELD BUGS 2026-10-17g, bible/01-Overview/bugs/Field-Bugs-2026-10-17g.md; the Discord's #general,
// Dude7ox: "Disintegrate just outright kills your rev with no option to hire", the screenshot "REVENANT SLAIN - Skulthor,
// Psytha's Shadow - Rank 9 - Vampire - Elite ... Has fallen. Your revenant is no more."; the owner: "Hmm thought I fixed
// this"). RVN-OWNERS-CHOICE (2026-10-16b) took the delete away from everyone else's Disintegrate and kept it for the
// owner's own (revenantFate.js ownersWholeKill passed the owner's whole blow over the stand, the will AND the kneel).
// Now the owner's own whole blow passes the stand and the will - the Disintegrate's edge, Revenants.md 19 and 20 - and
// still kneels it: the kill-or-spare is never skipped. A host with no fates (exterior.js) lets it die as before.
// Pinned over the REAL street pool (the real Disintegrate through the host's sink, the pool's own choice) and the
// dungeon's door mounted from its own source over the real law.
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
const { applySpell } = await import('../../../src/systems/effects.js');
const { buildCustomSpell, blankEffectSettings } = await import('../../../src/systems/spell/spellMaker.js');
const { createExteriorFoes } = await import('../../../src/scenes/exteriorFoes.js');
const { Collider } = await import('../../../src/player/collider.js');

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const player = () => ({
  isPlayer: true, name: 'Ann', characterId: 'char-ann', level: 10, reflexes: 2, skills: new Array(40).fill(40), skillUses: new Array(40).fill(0), career: {}, items: [],
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

// ── the crafted world (fb1016b_rvnownerschoice.test.js's): one monster career, a texture stub ───────────────────────
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
/** The owner's street pool - the streaming world's (`fates` on), or exterior.js's (`fates` off). */
function client(fates = true) {
  const drops = [];
  const me = player();
  const pool = createExteriorFoes({
    renderer: {
      createBillboardBatch: (archive, record, size) => ({ archive, record, size, conceal: undefined, dissolve: undefined, origin: null }),
      destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map(), uploadTexture: () => ({}), uploadEmissionTexture: () => ({}),
    },
    collider: new Collider(() => 0),
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return careers; throw new Error(`no ${n} here`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 1000, currentPixelKey: () => '3,12', inLocation: () => true,
    playerEntity: me, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
    fates, dropLoot: (items, feet) => drops.push({ items, feet }), shake: () => {},
  });
  return { pool, me, drops };
}
const step = (pool, dt = 0.016) => { T += dt; pool.update(dt, [0, 0, 3], [0, 1.6, 3]); };
/** THE DISINTEGRATE - the real spell (5,255, chance 100) through the real cast engine, cast by the owner through the
 *  streaming world's own spell sink (world.js foeSinks' hurt: the player's provenance, `whole` as the engine says). */
function disintegrate(c, g) {
  const spell = buildCustomSpell({ slots: [{ type: 5, subType: 255, settings: { ...blankEffectSettings(), chanceBase: 100 } }], rangeType: 2 });
  const sinks = { hurt: (n, o) => { const fp = o?.fromPlayer ?? true; if (n > 0) c.pool.damageFoe(g, n, [0, 0, 3], null, { fromPlayer: fp, kind: 'spell', whole: !!o?.whole, round: !!o?.round, element: o?.element ?? null }); } };
  const out = applySpell(spell, c.me.level, g.entity, sinks, () => 0.5, { level: c.me.level, entity: c.me }, {});
  assert.equal(out.disintegrated, 1, 'the spell landed');
}
async function stand(c, rank, at = [0, 0, 0]) {
  const r = revenantOf(c.me, rank);
  const f = await c.pool.spawnFoe(2, at, { feetGiven: true, level: 6, revenant: r });
  step(c.pool);
  assert.equal(f.entity.revenant?.id, r.id);
  return { r, f };
}

test('RVN-OWN-KNEEL THE REPORT, on the real street pool: MY OWN Disintegrate on my revenant KNEELS it - alive at 1, its record open, the choice offered (Kill, Spare); Spare swears it to me, the "option to hire" (mutants: my kill dies as before; any whole blow skips the kneel)', async () => {
  const c = client();
  const { r, f } = await stand(c, 1);
  disintegrate(c, f);
  assert.equal(f.dead, false, 'not deleted');
  assert.ok(f.yielded, 'it kneels');
  assert.equal(f.entity.health, 1);
  const rec = N.revenantById(r.id);
  assert.equal(rec.defeated, false, 'its record open');
  assert.equal(rec.history.at(-1).deed, 'yielded');
  const m = c.pool.fateFor(f);
  assert.deepEqual(m.options.map((o) => o.id), ['kill', 'spare'], 'the choice is offered');
  assert.equal(c.pool.chooseFate(f, 'spare'), true);
  assert.equal(N.revenantById(r.id).sworn, true, 'spared: sworn to me, a companion');
});

test('RVN-OWN-KNEEL RANK 3, its will unbroken: my own Disintegrate passes its last stand AND its will - the Disintegrate\'s edge, Revenants.md 19 and 20 - and kneels it; Kill then executes it, the record closed as executed, its trophy in the pile (mutants: my kill asks the will; my kill brings the stand; my kill dies as before)', async () => {
  const c = client();
  const { r, f } = await stand(c, 3);
  assert.equal(FT.revenantWillHolds(f), true, 'its will unbroken - any other killing blow would stand it, then lose it to the smoke');
  disintegrate(c, f);
  assert.equal(f.roaring, undefined, 'no last stand');
  assert.equal(f.leaving, undefined, 'no tearing away');
  assert.equal(f.dead, false);
  assert.ok(f.yielded, 'it kneels');
  const trophy = f.trophy;
  assert.ok(trophy, 'its trophy rolled at the kneel');
  assert.equal(c.pool.chooseFate(f, 'kill'), true);
  assert.ok(f.executing, 'the execution begun');
  step(c.pool);   // revenant_fate.test.js's KILL: the burst, then the end
  f.executing.at -= FT.EXECUTION_MS.burst + 10;
  step(c.pool);
  f.executing.at -= FT.EXECUTION_MS.end;
  step(c.pool);
  assert.equal(f.dead, true); assert.equal(f.executed, true);
  const rec = N.revenantById(r.id);
  assert.equal(rec.defeated, true); assert.equal(rec.fate, 'executed', 'closed by my choice, not by the spell');
  assert.equal(c.drops.length, 1, 'one pile');
  assert.ok(c.drops[0].items.includes(trophy), 'its trophy in it');
});

test('RVN-OWN-KNEEL A HOST WITH NO FATES (exterior.js\'s pool): my own Disintegrate kills it as before - nothing there can open the choice, so nothing kneels it (mutants: the street\'s fates gate dropped)', async () => {
  const c = client(false);
  const { r, f } = await stand(c, 1);
  disintegrate(c, f);
  assert.equal(f.yielded, undefined, 'no kneel where no choice can open');
  assert.equal(f.dead, true);
  assert.equal(N.revenantById(r.id).defeated, true);
  const X = read('src/scenes/exterior.js');
  const built = X.slice(X.indexOf('  const exteriorFoes = createExteriorFoes({'), X.indexOf('\n  });', X.indexOf('  const exteriorFoes = createExteriorFoes({')));
  assert.ok(built.length > 100, 'exterior.js builds the pool');
  assert.doesNotMatch(built, /\bfates\b/, '...with no fates');
});

// ── underground: the dungeon's door, mounted from its own source over the real law ─────────────────────────────────
const D = read('src/scenes/dungeonContext.js');
/** dungeonContext.js damageFoe's death arm, from the floor to the soul trap (fb1016b_rvnownerschoice.test.js's mount). */
function dungeonDeathArm(scope) {
  const a = D.indexOf('  function damageFoe(foe, damage, playerFeet = null, knockDir = null,');
  const b = D.indexOf('    if (foe.entity.health <= 0) {', a);
  const c = D.indexOf('      const _peerTrap = peerSoulTrapOf(foe.entity);', b);
  assert.ok(a > 0 && b > a && c > b, 'the dungeon\'s door and its death arm are found');
  const arm = D.slice(b, c);
  const k = Object.keys(scope);
  return new Function(...k, `return (foe, _whole, fromPlayer, peer, bout = null, striker = null) => {\n${arm}\n      return 'dies';\n    }\n    return 'alive';\n  };`)(...k.map((x) => scope[x]));
}

test('RVN-OWN-KNEEL UNDERGROUND (the dungeon\'s door): my own whole blow kneels my revenant - at rank 1, at rank 3 past its stand, and once stood past its unbroken will; a party member\'s still stands it and tears it away; a room\'s shared foe online and a door with no fates let it die (mutants: the dungeon\'s my kill dies as before; the dungeon asks the will of my kill; the dungeon\'s fates gate dropped)', async () => {
  const c = client();
  const seen = [];
  const fates = { fates: true };
  const scope = {
    ownersWholeKill: FT.ownersWholeKill, revenantLastStandDue: FT.revenantLastStandDue, revenantMayYield: FT.revenantMayYield, revenantWillHolds: FT.revenantWillHolds,
    lastStandDungeonFoe: (f) => { seen.push('stand'); f._lastStood = true; }, tearAwayDungeonFoe: () => seen.push('tear'), yieldDungeonFoe: () => seen.push('kneel'),
    onlineRoom: () => true, isRoomFoe: (f) => !!f._room, opts: fates,
  };
  const arm = dungeonDeathArm(scope);
  const at = async (rank, extra = {}) => { const { f } = await stand(c, rank); f.entity.health = 0; return Object.assign(f, extra); };
  const run = (f, whole, fromPlayer, peer) => { seen.length = 0; const out = arm(f, whole, fromPlayer, peer); return seen[0] ?? out; };
  assert.equal(run(await at(1), true, true, false), 'kneel', 'my own Disintegrate kneels it');
  assert.equal(run(await at(3), true, true, false), 'kneel', 'rank 3: past its stand, to its knees');
  const stood = await at(3, { _lastStood: true });
  assert.equal(FT.revenantWillHolds(stood), true);
  assert.equal(run(stood, true, true, false), 'kneel', 'stood, its will unbroken: my kill still kneels it');
  const theirs = await at(3);
  assert.equal(run(theirs, true, true, true), 'stand', 'a party member\'s: its last stand, as ever');
  assert.equal(run(theirs, true, true, true), 'tear', '...then, unbroken, it tears away');
  assert.equal(run(await at(1, { _room: true }), true, true, false), 'dies', 'a room\'s shared foe online: no fate (REVENANT-DUNGEON\'s gate, unchanged)');
  fates.fates = false;
  assert.equal(run(await at(1), true, true, false), 'dies', 'a door with no fates: it dies as before');
});
