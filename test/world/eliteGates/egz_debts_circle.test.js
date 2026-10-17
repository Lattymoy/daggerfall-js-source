// EG-ZP (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 29 - EVERY ALLOCATION HAS AN OWNER:
// "every exit path ... frees the hall's meshes, colliders, riders, telegraph buffers and reverb buffers, its fragments'
// with them"): THE CIRCLE'S MESHES FREED. The mode machine's circle (scenes/worldModes.js - its stand, THE SWAP, the band
// dress and egCircleDown, its own source) stood into a context built of the dungeon host's own teardown lines
// (scenes/dungeonContext.js `_teardowns`, `addTeardown`, the run in destroy()), over a counting renderer and the real
// collider: the context's end - the one door every way out of the Spire goes through - lets the whole circle go, once,
// its slots emptied before anything is freed, before the band dress it wore; the next stand builds anew.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egCircleSpecs, egBandOfCircle, egSpecGive, EG_TEXT } from '../../../src/net/eliteGates/egLaw.js';
import { createEgSwap } from '../../../src/scenes/eliteGates/egSwap.js';
import { egCircleBuild, egCircleGates } from '../../../src/world/eliteGates/egCircleParts.js';
import { buildEgCircleModel, egCircleColliderTris, egCircleLights, egGateParts } from '../../../src/world/eliteGates/egHall.js';
import { realmArt } from '../../../src/world/superDungeon/sdRealmArt.js';
import { SD_REALM_ARCHIVE } from '../../../src/world/superDungeon/sdRealm.js';
import { identity } from '../../../src/world/mat4.js';
import { egBandArt, egBandArchive, EG_DRESS_RECORDS, EG_BAND_RECORDS } from '../../../src/world/eliteGates/egBandArt.js';
import { createEgOccluders } from '../../../src/scenes/eliteGates/egOcclude.js';
import { buildEgLookModel } from '../../../src/world/eliteGates/egLook.js';
import { Collider } from '../../../src/player/collider.js';
import { egBeatTellDown } from '../../../src/scenes/eliteGates/egSpan.js';   // AUDIT EG III (lane4 #4): the band dress's owner frees the Beats' pictures too
import { createEgGroundLook } from '../../../src/scenes/eliteGates/egGroundLook.js';   // EG-LOOK: the circle's ruin and its band's wreck, stood with it
import { buildEgVista } from '../../../src/world/eliteGates/egVista.js';
/** PIN MOVED (EG-LOOK THE WRECK - Elite-Gates-Look.md section 4, "one mesh a band ..., made once a band, freed with it"):
 *  the band's wreck (scenes/eliteGates/egWreckLook.js: its wings batched, the Spire's underside) outlives a circle of its band and goes
 *  with the band's dress at the breach's end (egBandsDown) - these meshes of it stay live after a context's end. */
const WRECK = ((v) => (v.wings.length ? 1 : 0) + (v.under ? 1 : 0))(buildEgVista(egBandOfCircle(4)));

const SEED = 12345;
const B = '0123456789abcdef';
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const WM = rd('src/scenes/worldModes.js');
const EC = rd('src/scenes/eliteGates/egCircleHost.js');   // PIN MOVED (HOST-SPLIT, EG-LOOK): the circle's own module, its mode machine's names read live through `wm`
const DC = rd('src/scenes/dungeonContext.js');
const between = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, `${a} .. ${b}`); return src.slice(i, j); };
const lineOf = (src, pred, what) => { const l = src.split('\n').find(pred); assert.ok(l, what); return l; };
// PIN MOVED (AUDIT EG V, e: L6-8, L6-9 - the worker's build is egCircleBuild: the parts, the circle's five specs, the band's
// dress when asked)
const syncWorker = () => {
  const w = { onmessage: null, onerror: null, postMessage(msg) { w.onmessage?.({ data: { t: 'built', id: msg.id, parts: egCircleBuild(msg) } }); }, terminate() {} };
  return w;
};

// the dungeon host's own lines: its teardowns' list, the door that takes one, and the run in its destroy()
const DESTROY = between(DC, '    destroy() {', '  }; placeHold?.settle();');
const TD_DECL = lineOf(DC, (l) => l.trim() === 'const _teardowns = [];', 'the teardowns\' list');
const TD_ADD = lineOf(DC, (l) => l.trim().startsWith('addTeardown(fn) {'), 'its door');
const TD_RUN = lineOf(DESTROY, (l) => l.includes('_teardowns.splice(0)'), 'the run, in destroy()');

/** A context as the dungeon host builds one, for what the circle reads of it: its draws, its collider, its namers, and
 *  its teardowns run by its own destroy(). */
const contextOf = () => new Function('Collider', 'console', `${TD_DECL}\nconst dynamicDraws = [], collider = new Collider(() => -Infinity);\nreturn { dynamicDraws, collider, addActivationNamer() {},\n${TD_ADD}\ndestroy() {\n${TD_RUN}\n} };`)(Collider, console);

/** The mode machine's circle, its own source, over a counting renderer that logs every free and upload in order and
 *  checks, at each free, that the circle's slots are already empty. */
function rig() {
  const src = between(EC, "  const EG_BUCKET = 'eg:hall';", '  // ── EG-H3 end');
  const live = new Set(), log = [];
  let made = 0, twice = 0, wm = null, heldAtFree = 0;
  const renderer = {
    createMesh: (m) => { const g = { m, n: ++made }; live.add(g); return g; },
    destroyMesh: (g) => { if (wm && (wm.mesh || wm.look || wm.gates.length)) heldAtFree++; if (live.delete(g)) log.push(['mesh', g.n]); else twice++; },
    uploadTexture: () => {}, uploadEmissionTexture: () => {},
    releaseTexture: (a, r) => { log.push(['tex', `${a}_${r}`]); return true; }, evictEmissionTexture: (k) => { log.push(['glow', k]); return true; },
  };
  const st = { loc: { egBreach: B, egSeed: SEED, egCircle: 4, egGeo: 0 } };
  wm = new Function('createEgGroundLook', 'host', 'renderer', 'isEgHall', 'createEgSwap', 'identity', 'realmArt', 'SD_REALM_ARCHIVE', 'buildEgCircleModel', 'egCircleColliderTris', 'egCircleLights', 'egCircleSpecs', 'egGateParts', 'EG_TEXT', 'egBandOfCircle', 'egBandArt', 'egBandArchive', 'buildEgLookModel', 'createEgOccluders', 'EG_BAND_RECORDS', 'egBeatTellDown', 'egSpecGive', 'st',
    `let mode = 'dungeon', dungeonLoc = st.loc, dungeonCtx = null;\nconst wm = { get mode() { return mode; }, get dungeonLoc() { return dungeonLoc; }, get dungeonCtx() { return dungeonCtx; } };\n${src.replace('const egSwap = createEgSwap();', 'const egSwap = createEgSwap({ workerFactory: st.worker });')}\nreturn { standEgHall, egPrebuild, egSwapCircle, egBandsDown, egCircleDown, egOcc, set ctx(c) { dungeonCtx = c; }, set mode(m) { mode = m; },
      get mesh() { return _egMesh; }, get look() { return _egLookMesh; }, get gates() { return _egGates; }, get lamps() { return _egLamps; }, get key() { return _egMeshKey; }, get draw() { return _egDraw; } };`)(
    createEgGroundLook, { egGateOpen: () => false }, renderer, (l) => !!l?.egBreach, createEgSwap, identity, realmArt, SD_REALM_ARCHIVE, buildEgCircleModel, egCircleColliderTris, egCircleLights, egCircleSpecs, egGateParts, EG_TEXT, egBandOfCircle, egBandArt, egBandArchive, buildEgLookModel, createEgOccluders, EG_BAND_RECORDS, egBeatTellDown, egSpecGive,   // PIN MOVED (AUDIT EG III lane4 #4): egBandsDown frees the Beats' pictures with the dress
    Object.assign(st, { worker: syncWorker }));
  return { wm, st, live, log, get made() { return made; }, get twice() { return twice; }, get heldAtFree() { return heldAtFree; } };
}
const eh = (c) => ({ b: B, seed: SEED, c, geo: 0 });
const circleBuckets = (ctx) => [...ctx.collider._buckets.keys()].filter((k) => k === 'eg:hall' || k.startsWith('eg:gate:')).sort();

test('EG-ZP THE CIRCLE LET GO WITH ITS CONTEXT (scenes/worldModes.js egCircleDown, handed to scenes/dungeonContext.js addTeardown; section 29): a circle stood - its mesh, its waystones\' mesh and each Rampart\'s portcullis, their draws and their buckets - is freed whole as the context it stands in is destroyed: every mesh once and no free twice, every draw of it gone, its floors\' and portcullises\' buckets off the collider, the dither pass holding nothing, its slots and lamps empty before the first free; a second end frees nothing; and only then the band dress it wore (mutants: the teardown never handed; the teardowns never run; the circle kept; the waystones kept; a portcullis kept; a draw of a freed mesh left; the floors left on the collider; the dither pass left holding it; a slot emptied after its free; the lamps kept)', () => {
  const R = rig(), ctx = contextOf();
  assert.equal(egCircleGates(SEED, 4).length, 2, 'circle 4 stands two Ramparts');
  R.wm.ctx = ctx;
  R.wm.standEgHall(ctx, eh(4));
  const meshes = [R.wm.mesh, R.wm.look, ...R.wm.gates.map((g) => g.gpu)];
  assert.equal(meshes.filter(Boolean).length, 4, 'its mesh, its waystones and two portcullises');
  assert.deepEqual(circleBuckets(ctx), ['eg:gate:' + egCircleGates(SEED, 4)[0].h, 'eg:gate:' + egCircleGates(SEED, 4)[1].h, 'eg:hall'].sort());
  assert.equal(ctx.dynamicDraws.filter((d) => meshes.includes(d.gpu)).length, 4, 'a draw each');
  assert.ok(R.wm.egOcc.stats().pieces > 0 && R.wm.lamps.length > 0, 'the dither pass holds it, its lamps lit');
  assert.equal(R.wm.egBandsDown(), 0, 'its band dress refused while it stands');
  // the context's end: every way out of the Spire destroys it, and the mode is the exterior's after
  ctx.destroy();
  R.wm.mode = 'exterior';
  assert.equal(R.live.size, WRECK, 'every mesh of the circle freed - only its band\'s wreck kept (PIN MOVED, EG-LOOK: the band\'s, freed with its dress)');
  assert.deepEqual([R.twice, R.heldAtFree], [0, 0], 'each once, its slots emptied before the first free');
  assert.deepEqual([R.wm.mesh, R.wm.look, R.wm.gates, R.wm.lamps, R.wm.key, R.wm.draw], [null, null, [], [], '', null], 'every slot empty');
  assert.equal(ctx.dynamicDraws.filter((d) => meshes.includes(d.gpu)).length, 0, 'no draw of it left');
  assert.deepEqual(circleBuckets(ctx), [], 'its buckets off the collider');
  assert.deepEqual([R.wm.egOcc.stats().pieces, R.wm.egOcc.stats().views], [0, 0], 'the dither pass holds nothing of it');
  const freed = R.log.length;
  ctx.destroy();
  assert.equal(R.wm.egCircleDown(ctx), 0, 'a second end, a second call: nothing');
  assert.equal(R.log.length, freed);
  // and only then the dress it wore
  const n = R.wm.egBandsDown();
  assert.equal(n, EG_BAND_RECORDS.length * 2, 'the band dress freed at the breach\'s end');
  assert.equal(R.live.size, 0, 'and its wreck with it (EG-LOOK)');
  const lastMesh = R.log.map((e) => e[0]).lastIndexOf('mesh'), firstTex = R.log.findIndex((e) => e[0] !== 'mesh');
  assert.ok(lastMesh >= 0 && firstTex > lastMesh, 'the circle before its dress');
});

test('EG-ZP THE NEXT STAND BUILDS ANEW, THE SWAP THROUGH THE SAME TEARDOWN (scenes/worldModes.js): after a context\'s end the same circle stood again (the way back) builds its meshes anew - never a freed one drawn; a swap in place lets the old circle go through egCircleDown and the new one, stood in the same context, goes with that context\'s end (mutants: the circle\'s key kept, a freed mesh stood again; the swap\'s old circle kept)', () => {
  const R = rig();
  const a = contextOf();
  R.wm.ctx = a; R.wm.standEgHall(a, eh(4));
  // PIN MOVED (EG-LOOK, Elite-Gates-Look.md section 3): the circle's four and its five halls' ruins (world/eliteGates/egRuin.js - a mesh a hall)
  assert.equal(R.wm.egCircleDown(a), 9, 'nine meshes let go');
  a.destroy();
  assert.equal(R.live.size, WRECK, 'and its context\'s end frees nothing more (its band\'s wreck kept - PIN MOVED, EG-LOOK)');
  const b = contextOf();
  R.wm.ctx = b; R.wm.mode = 'dungeon';
  const before = R.made;
  R.wm.standEgHall(b, eh(4));
  assert.ok(R.made >= before + 4, 'built anew');
  assert.ok(b.dynamicDraws.every((d) => R.live.has(d.gpu)), 'no freed mesh drawn');
  assert.equal(R.wm.egPrebuild(eh(5)), 'ready');
  const old = [R.wm.mesh, R.wm.look, ...R.wm.gates.map((g) => g.gpu)].filter(Boolean);
  assert.equal(R.wm.egSwapCircle(eh(5)), true, 'circle 5 swapped in place');
  assert.ok(old.every((g) => !R.live.has(g)), 'the old circle let go');
  assert.ok(b.dynamicDraws.every((d) => R.live.has(d.gpu)) && R.live.size > 0, 'the new one stands');
  b.destroy();
  R.wm.mode = 'exterior';
  assert.deepEqual([R.live.size, R.twice], [WRECK, 0], 'the swapped circle goes with its context, once (its band\'s wreck kept - PIN MOVED, EG-LOOK)');
});

test('EG-ZP EVERY WAY OUT ENDS THE CONTEXT (scenes/worldModes.js, scenes/dungeonContext.js, by source): the stand hands its context the circle\'s teardown; the context runs its teardowns in its own destroy(); and every road that ends the Spire\'s context destroys it - the exit (the way home, the tear, a fall\'s walk out, forsaking, a void), the forced exit (a load, a teleport, a respawn) and the two abandoned builds after the stand (mutants: the teardown unhanded; the run lost from destroy())', () => {
  const stand = between(EC, '  function standEgHall(ctx, eh) {', '  /** EG-PLAY: each Rampart\'s portcullis stood or sunk');
  assert.match(stand, /ctx\.addTeardown\?\.\(\(\) => egCircleDown\(ctx\)\);/, 'the stand hands it over');
  assert.match(DESTROY, /for \(const fn of _teardowns\.splice\(0\)\) \{ try \{ fn\(\); \}/, 'destroy() runs each, once');
  assert.match(DC, /addTeardown\(fn\) \{ if \(typeof fn === 'function'\) _teardowns\.push\(fn\); \},/);
  const exit = between(WM, '  function exitDungeonNow() {', '    dungeonLoc = null;');
  assert.match(exit, /dungeonCtx\.destroy\(\);/, 'the exit');
  const force = between(WM, '    forceExitToExterior({ cacheScene = true, load = false } = {}) {', 'AUDIT 63r F30');
  assert.match(force, /if \(dungeonCtx\) \{[\s\S]*?dungeonCtx\.destroy\(\); dungeonCtx = null; dungeonLoc = null;/, 'the forced exit');
  const s0 = WM.indexOf('      if (hit.egHall) standEgHall(ctx, hit.egHall);'), build = WM.slice(s0, WM.indexOf("        host.onFailedTransition?.('ToDungeonInterior');", s0));
  assert.ok(s0 > 0 && build.length > 0, 'the dungeon build after the stand');
  assert.equal((build.match(/abandonContext\(ctx\);/g) ?? []).length, 2, 'both abandoned builds after the stand');
  assert.match(WM, /function abandonContext\(ctx\) \{\s*destroyPeopleBehaviours\(ctx\.people\);\s*ctx\.destroy\(\);\s*\}/, 'and an abandon destroys');
});
