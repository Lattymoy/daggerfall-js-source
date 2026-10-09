// MWNPC5b (2026-10-09, the MW-NPC arc's fifth slice - bible/04-Characters/Morrowind-NPCs.md section 10b): THE DUNGEON'S
// FOES IN THEIR BODIES. The dungeon context (both dungeon hosts' one frame function) stands its class foes in the NPC
// lane each frame - alive dressed as their billboards are (concealed, flashing, their tells), dead from the kill until
// the corpse is freed - syncs it, draws the bodies in one bind, and turns every offered foe's billboard CAST-ONLY where
// its body stands: the billboard records its shadow (the body casts none - MWNPC1's skinned path) and draws nothing.
// Pinned: the renderer's cast-only billboard; the lane carrying a host's dressing to each body (and the living first);
// the switch (`mwNpcBodies`: Off / Near / All, the Features row); the context's wiring by source; and THE HOSTS,
// ENUMERATED - every module that dresses a foe's billboard (setBatchHitFlash off foeHitFlash) is named here, wired or
// flagged with the slice that wires it, so a foe host cannot be forgotten (the lesson of the reverted arc's NPC4b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Renderer } from '../src/render/renderer.js';
import { billboardKey } from '../src/render/billboardKey.js';
import { createNpcBodies, NPC_BODY_TIERS, NPC_BODIES_DEFAULT } from '../src/characters/npcBodies.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../src/systems/features.js';
import { lookAt, perspective } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await flush(); };

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'checkFramebufferStatus') return () => 36053;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 640, clientHeight: 480, width: 640, height: 480 } };
}
const PROJ = perspective(1.1, 640 / 480, 0.1, 500);
const VIEW = lookAt([0, 1.6, 6], [0, 1, 0], [0, 1, 0]);

test('MWNPC5b-a a CAST-ONLY billboard records its shadow and draws nothing - in neither phase, nor in the bloom', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]));
  const recorded = [];
  Object.defineProperty(r, '_casting', { get: () => true });   // the shadow lane casting this frame
  r._shadows = { recordBillboards: (bs) => recorded.push(...bs) };
  const bb = (id, extra = {}) => { const b = { archive: 400, record: 0, frame: 0, vao: { id }, indexCount: 6, size: { w: 1, h: 2 }, origin: [0, 0, 0], ...extra }; r.textures.set(billboardKey(b), { id: `t${id}` }); return b; };
  const shown = bb('shown'), body = bb('body', { castOnly: true }), veiled = bb('veiled', { castOnly: true, conceal: { mode: 1, alpha: 0.5, t: 0, phase: 0 } });
  calls.length = 0;
  r.drawBillboards([shown, body, veiled], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  const drawn = calls.filter((c) => c[0] === 'bindVertexArray').map((c) => c[1]?.id).filter(Boolean);
  assert.ok(drawn.includes('shown'), 'the plain billboard draws');
  assert.ok(!drawn.includes('body') && !drawn.includes('veiled'), 'a cast-only one does not - opaque or concealed');
  assert.deepEqual(recorded.map((b) => b.vao.id), ['shown', 'body', 'veiled'], 'and every one casts');
  const air = rd('src/render/airPass.js');
  assert.ok(air.includes('if (!b?.vao || b._dead || b.conceal || b.castOnly || b.emissionOff) continue;'), 'the bloom replay skips it too');
});

/** a rig that records how it is drawn */
const drawing = (rigs) => () => {
  const r = { mode: 'first', skinned: false, draws: [],
    attach() {}, async build() { await flush(); return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1,
    setViewMode(m) { r.mode = m; return true; }, thirdActive: () => r.mode === 'third' && r.skinned,
    update(dt, o) { if (o?.pose !== false) r.skinned = true; }, unload() {},
    drawThird(_c, o) { r.draws.push({ hitFlash: o.hitFlash, conceal: o.conceal, fx: o.fx }); return true; },
    setSheathed() {}, revive() {}, die() {}, hurt() {} };
  rigs.push(r);
  return r;
};
const look = { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };

test('MWNPC5b-b the lane carries a host\'s dressing to each body - the concealment, the hit flash, the tells - and stands the living before the dead', async () => {
  const rigs = [];
  const lane = createNpcBodies({ renderer: {}, createRig: drawing(rigs), now: () => 1000, tier: () => 'near' });
  const veil = { mode: 1, alpha: 0.4, t: 0, phase: 0 };
  const fx = { glint: [1, 0, 0, 1], elite: 0, time: 0, dissolve: null };
  const frame = async (dress = true) => {
    lane.begin();
    lane.stand('foe', { id: 1, look, feet: [0, 0, -3] }, null, dress ? 0.7 : 0, dress ? fx : null);
    lane.stand('foe', { id: 2, look, feet: [1, 0, -3] }, dress ? veil : null);
    lane.end(1 / 60, [0, 0, 0]);
    await settle();
  };
  for (let i = 0; i < 6; i++) await frame();
  const eye = [0, 1.6, 2], view = lookAt(eye, [0, 1, -3], [0, 1, 0]);
  for (const r of rigs) r.draws.length = 0;
  lane.draw({}, { proj: PROJ, view, eye });
  lane.drawVeiled();
  const all = rigs.flatMap((r) => r.draws);
  assert.ok(all.some((d) => d.hitFlash === 0.7 && d.fx === fx && d.conceal == null), 'the first: flashing, glinting, open');
  assert.ok(all.some((d) => d.conceal === veil && d.hitFlash === 0 && d.fx == null), 'the second: concealed, drawn veiled');
  await frame(false);
  for (const r of rigs) r.draws.length = 0;
  lane.draw({}, { proj: PROJ, view, eye });
  lane.drawVeiled();
  assert.ok(rigs.flatMap((r) => r.draws).every((d) => !d.hitFlash && d.fx == null && d.conceal == null), 'undressed the next frame: nothing kept from the last');
  // the living first: a lane of one body (a tier table of its own), a dead foe nearer than a living one
  const rigs2 = [];
  const one = createNpcBodies({ renderer: {}, createRig: drawing(rigs2), now: () => 1000, tier: () => 'near', tiers: { near: { max: 1, range: 30, skinBudget: 1, spareMax: 0 } } });
  for (let i = 0; i < 6; i++) {
    one.begin();
    one.stand('foe', { id: 'dead', look, feet: [0, 0, -2], dead: 1 });
    one.stand('foe', { id: 'alive', look, feet: [0, 0, -9] });
    one.end(1 / 60, [0, 0, 0]);
    await settle();
  }
  assert.equal(one.has('foe', 'alive'), true, 'the living stand, though farther');
  assert.equal(one.has('foe', 'dead'), false, 'the dead give way');
});

test('MWNPC5b-c the switch: the Features row `mwNpcBodies` - Off, Near, All, the viewer\'s own, Near by default - and the lane\'s tiers are its tiers', () => {
  const row = FEATURES.find((f) => f.id === 'mw-npc-bodies');
  assert.ok(row, 'the row');
  assert.deepEqual([row.group, row.kinds, row.control.store, row.control.key, row.control.initial, row.control.online], ['world', ['enhanced'], 'prefs', 'mwNpcBodies', NPC_BODIES_DEFAULT, 'player']);
  assert.deepEqual(row.control.tiers.map(([v]) => v), Object.keys(NPC_BODY_TIERS), 'every tier the lane has, and no other');
  assert.equal(FEATURE_PREF_DEFAULTS.mwNpcBodies, NPC_BODIES_DEFAULT);
  const lane = rd('src/characters/npcBodies.js');
  assert.ok(lane.includes("return isEnhanced() && morrowindDataCount() > 0 && getPref('mwNpcBodies') !== 'off';"), 'the lane wanted: the enhanced skin, the data, and not Off');
});

test('MWNPC5b-d the dungeon context by source: the lane a frame (none while unwanted, the old one let go), the class foes offered dressed, the dead from the kill, the sync before the cast-only, one bind, the veiled after the last flat, and the lane gone with the context', () => {
  const c = rd('src/scenes/dungeonContext.js');
  const at = (s) => { const i = c.indexOf(s); assert.ok(i > 0, `present: ${s.slice(0, 70)}`); return i; };
  const lane = at('const npcLane = npcBodiesOn() ? (_npcLane ??= createHostNpcBodies({ renderer, collider: () => collider })) : null;');
  at('if (!npcLane && _npcLane) { _npcLane.destroy(); _npcLane = null; }');
  const begin = at('npcLane?.begin();');
  const loop = at('    for (const f of foes) {\n      _fi++;\n      if (f.dead) continue;');
  assert.ok(lane < begin && begin < loop, 'begun before the foes are walked');
  const reset = at('        f.batch.castOnly = false;\n        if (npcLane && isClassFoe(f)) { npcLane.stand(\'foe\', foeActor(f), f.batch.conceal ?? null, f.batch.hitFlash || 0, foeFx(f)); _npcStood.push(f); }\n        _mobileBatches.push(f.batch);');
  const dead = at("if (npcLane && f.dead && f.corpse && isClassFoe(f) && f.ai) { npcLane.stand('foe', foeActor(f), null, 0, foeFx(f, f.corpseBatch)); _npcStood.push(f); }");
  const sync = at('npcLane.end(dt, eye);');
  const cast = at("for (const f of _npcStood) { const b = f.dead ? f.corpseBatch : f.batch; if (b) b.castOnly = npcLane.has('foe', foeId(f)); }");
  const bind = at('try { npcLane.draw(canvas, { proj, view, eye }); } finally { renderer.flushCharacterSpriteBatch?.(); }');
  const flats = at('renderer.drawBillboards([..._mobileBatches, ..._dropBatches, ..._spellBatches],');
  assert.ok(reset < dead && dead < sync && sync < cast && cast < bind && bind < flats, 'offered, synced, cast-only, drawn - and the billboards after');
  assert.ok(at('if (f.corpseBatch) f.corpseBatch.castOnly = false;') < sync, 'every corpse drawn again unless its body stands this frame');
  assert.ok(at('_npcLane?.drawVeiled();') < at('    opts.lateWorldDraw?.();'), 'the veiled after the last opaque flat, beside the peers\'');
  at('_npcLane?.destroy(); _npcLane = null;   // MWNPC5b');
});

test('MWNPC5b-e THE FOE HOSTS, ENUMERATED: every module that dresses a foe\'s billboard is named - wired, or flagged with the slice that wires it', () => {
  const HOSTS = {
    'src/scenes/dungeonContext.js': 'wired',   // MWNPC5b: both dungeon hosts' one frame function
    'src/scenes/exteriorFoes.js': 'wired',     // MWNPC5c: the encounter pool - world.js's exterior, worldModes.js's interiors, exterior.js (mwnpc5_pool.test.js)
    'src/scenes/cityGuards.js': 'MWNPC6',      // the watch
  };
  const found = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.js') && /setBatchHitFlash\([^)]*foeHitFlash\(/.test(rd(p))) found.push(p);
    }
  };
  walk('src');
  assert.deepEqual(found.sort(), Object.keys(HOSTS).sort(), 'a new foe host is named here, wired or flagged');
  for (const [p, state] of Object.entries(HOSTS)) {
    const wired = rd(p).includes("stand('foe', foeActor(f)");
    assert.equal(wired, state === 'wired', `${p}: ${state}`);
  }
});
