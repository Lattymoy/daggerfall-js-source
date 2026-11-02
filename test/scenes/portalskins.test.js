// STOREFRONT (2026-10-29, the owner: "Portal effects would influence both companion and portal stone portals";
// bible/06-Systems/Storefront.md section 5). The portal skins: each skin's art (its vortex's frames and the pieces about it,
// rows from the bottom up), where each piece stands as a portal opens, holds and seals; a skinned portal opened by the
// pool's own set with its pieces, its burst, its breath and its sound, and every batch let go when it seals; MY portals
// in the skin I wear (my companions', my spared revenant's, my gate), a PEER's gate and spared revenant in its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PORTAL_SKIN_KEYS, PORTAL_SKIN, portalSkinOf, dressPlace } from '../../src/scenes/portalSkins.js';
import { createPortalSet, portalLife, portalBasis, PORTAL_SIZE, PORTAL_BACK } from '../../src/scenes/portalFx.js';
import { lookAt } from '../../src/world/mat4.js';
import { createPortalGates } from '../../src/scenes/portalGates.js';
import { PORTAL_SKINS } from '../../src/net/effectLaw.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import { bindPeerEffects } from '../../src/net/peer/peerEffects.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { STOREFRONT_SFX } from '../../src/systems/storefrontSounds.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A renderer's billboard doors, counted. */
function fakeRenderer() {
  const made = [], freed = [], up = new Set();
  return {
    made, freed, up,
    uploadTexture: (a, r) => up.add(`${a}/${r}`), uploadEmissionTexture() {},
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, origin: [0, 0, 0] }; made.push(b); return b; },
    destroyBillboardBatch: (b) => freed.push(b),
  };
}
/** My session, with the effects kit worn. */
function wearing(kit) {
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'a1', name: 'Me', kind: 'linked', sessionId: 's', secret: 'x', ...(kit ? { effects: kit } : {}) })]]);
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null };
}

test('STOREFRONT the skins\' art: a skin each portal skin of the law, each frame whole (its size, clear outside its shape, lit within), its pieces\' frames too, the burst it opens in and the sound it rings; none for no skin (mutants: a skin missing; a frame of the wrong size)', () => {
  assert.deepEqual([...PORTAL_SKIN_KEYS], [...PORTAL_SKINS]);
  for (const key of PORTAL_SKIN_KEYS) {
    const look = portalSkinOf(key);
    assert.ok(look, key);
    for (const [paint, n, tex] of [[look.paint, look.frames, look.tex], ...look.dress.map((d) => [d.paint, d.frames, d.tex])]) {
      for (let k = 0; k < n; k++) {
        const f = paint(k, n, tex.w, tex.h);
        assert.deepEqual([f.width, f.height, f.colors.length], [tex.w, tex.h, tex.w * tex.h * 4], `${key} frame ${k}`);
        let lit = 0, clear = 0;
        for (let i = 3; i < f.colors.length; i += 4) { if (f.colors[i] > 0) lit++; else clear++; }
        assert.ok(lit > tex.w * tex.h * 0.08 && clear > 0, `${key} frame ${k}: lit within, clear without`);
      }
    }
    assert.ok(Object.hasOwn(STOREFRONT_SFX, look.sound), `${key}: its sound`);
  }
  assert.equal(portalSkinOf(null), null);
  assert.equal(portalSkinOf('violet'), null);
  assert.deepEqual(PORTAL_SKIN.daedric.dress.map((d) => d.place), ['arch']);
  assert.deepEqual(PORTAL_SKIN.aetheric.dress.map((d) => d.place), ['orbit']);
  assert.deepEqual(PORTAL_SKIN.brass.dress.map((d) => d.place), ['rim']);
  // THE VISUAL PASS: the Daedric iron reads on a dark ground - its arch's and its rim's unlit pixels (not a vein's or a
  // rune's fire) as light as the Runic Stone's darkest grey; near black, the arch vanished at night
  const ironLight = (/** @type {any} */ f, /** @type {(i: number) => boolean} */ keep) => {
    let sum = 0, n = 0;
    for (let i = 0; i < f.width * f.height; i++) {
      const o = i * 4, [r, g, b, a] = [f.colors[o], f.colors[o + 1], f.colors[o + 2], f.colors[o + 3]];
      if (!a || r > 140 || !keep(i)) continue;   // the vein's and the runes' fire are bright red and orange
      sum += Math.max(r, g, b); n++;
    }
    return sum / Math.max(1, n);
  };
  const arch = PORTAL_SKIN.daedric.dress[0], archF = arch.paint(0, arch.frames, arch.tex.w, arch.tex.h);
  assert.ok(ironLight(archF, () => true) >= 45, `the arch's iron at ${ironLight(archF, () => true).toFixed(0)}`);
  const { w: VW, h: VH } = PORTAL_SKIN.daedric.tex, vortex = PORTAL_SKIN.daedric.paint(0, PORTAL_SKIN.daedric.frames, VW, VH);
  const rim = (/** @type {number} */ i) => Math.hypot(((i % VW) + 0.5) / VW * 2 - 1, (Math.floor(i / VW) + 0.5) / VH * 2 - 1) > 0.86;
  assert.ok(ironLight(vortex, rim) >= 45, `the vortex's iron rim at ${ironLight(vortex, rim).toFixed(0)}`);
});

test('STOREFRONT where the pieces stand: the arch thrusts up out of the ground as the portal opens and sinks as it seals; the shards rise off the ground and gather into a ring about it; the cogs sit on its rim in its plane, each turning the other way from the last (mutants: the arch standing before it opens; the cogs all one way)', () => {
  const mid = [0, 1.25, 0], right = [1, 0, 0];
  const arch = PORTAL_SKIN.daedric.dress[0];
  const shut = dressPlace(arch, 0, 0, 0, mid, right, false), open = dressPlace(arch, 0, 1, 1, mid, right, false);
  assert.ok(shut.scale < 0.1 && open.scale >= 1, 'it rises with the portal');
  assert.ok(open.at[1] > shut.at[1]);
  const shard = PORTAL_SKIN.aetheric.dress[0];
  const low = dressPlace(shard, 0, 0, 0.05, mid, right, false), ring = dressPlace(shard, 0, 2, 1, mid, right, false);
  assert.ok(low.at[1] < ring.at[1], 'off the ground, up into the ring');
  assert.ok(Math.abs(Math.hypot(ring.at[0] - mid[0], ring.at[2] - mid[2]) - 1.15) < 0.01, 'a ring about it');
  const cog = PORTAL_SKIN.brass.dress[0];
  const spins = Array.from({ length: cog.count }, (_, i) => dressPlace(cog, i, 0, 1, mid, right, false).spin);
  assert.deepEqual(spins, spins.map((_, i) => (i % 2 ? -1 : 1)));
  assert.ok(Array.from({ length: cog.count }, (_, i) => dressPlace(cog, i, 0, 1, mid, right, false).at[2]).every((z) => Math.abs(z) < 1e-9), 'in the portal\'s plane');
});

test('STOREFRONT a skinned portal: opened in its skin\'s frames with its pieces, its burst and its sound - the violet vortex and nothing else with none; every batch let go when it seals, or when it is taken out (mutants: the pieces never freed; the skin\'s sound never rung)', () => {
  const r = fakeRenderer(), bursts = [], rang = [];
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, burst: (recipe) => { bursts.push(recipe); return true; } });
  const audio = { play3d: (key) => rang.push(key), play3dId: (id) => rang.push(id), buffers: new Map([['storefront:portal-aetheric', {}]]) };
  let t = 0;
  const set = createPortalSet({ renderer: r, audio, now: () => t });
  const p = set.open([0, 0, 0], { skin: 'aetheric' });
  assert.equal(p.batch.archive, 'fxportal_aetheric');
  assert.equal(set.batches().length, 1 + PORTAL_SKIN.aetheric.dress[0].count, 'the vortex and its shards');
  assert.deepEqual(bursts, ['portal-aetheric-open']);
  assert.deepEqual(rang, ['storefront:portal-aetheric'], 'its own sound, never the violet one beside it');
  for (t = 0; t <= portalLife() + 20; t += 16) set.tick([0, 1.6, -5]);
  assert.ok(bursts.includes('portal-aetheric-motes'), 'it breathes while it stands');
  assert.equal(set.count, 0);
  assert.equal(r.freed.length, r.made.length, 'every batch let go');
  const plain = set.open([0, 0, 0]);
  assert.equal(plain.batch.archive, 'fxportal');
  assert.equal(set.batches().length, 1);
  set.remove(plain);
  assert.equal(r.freed.length, r.made.length);
  setPlayerDoor(null);
});

test('STOREFRONT whose skin: my portals in the one I wear - my companions\' and my spared revenant\'s (openMine), my gate; a peer\'s gate and its spared revenant\'s rise in its token\'s; the violet vortex with none (mutants: a peer\'s gate in my skin; my companions\' never skinned)', () => {
  wearing('0d0');
  const r = fakeRenderer();
  const set = createPortalSet({ renderer: r, now: () => 0 });
  assert.equal(set.openMine([0, 0, 0]).batch.archive, 'fxportal_brass');
  bindPeerEffects((id) => (id === 'peer1' ? '0b0' : null));
  let t = 0;
  const gates = createPortalGates({ renderer: r, now: () => t, destOf: () => ({ pixel: { x: 1, y: 1 }, name: 'There' }), eventGround: false });
  const mine = gates.open([0, 0, 0], { pixel: { x: 1, y: 1 }, name: 'There' });
  assert.equal(mine.fx.batch.archive, 'fxportal_brass', 'my gate in my skin');
  const src = rd('src/scenes/portalGates.js');
  assert.match(src, /const skinOf = \(g\) => \(g\.owner === null \? ownPortalSkin\(\) : peerEffectWorn\(g\.owner, 'portal'\)\);/, 'a peer\'s gate in its own');
  wearing(null);
  assert.equal(set.openMine([0, 0, 0]).batch.archive, 'fxportal', 'none worn: the violet vortex');
  bindPeerEffects(null);
  for (const host of ['src/scenes/exteriorFoes.js', 'src/scenes/dungeonContext.js']) {
    const s = rd(host);
    const fx = s.slice(s.indexOf('const companionFx = {'), s.indexOf('\n  };\n', s.indexOf('const companionFx = {')));
    assert.equal((fx.match(/portals\.openMine\(/g) ?? []).length, 4, `${host}: my companions' arrivals, leavings and catch-ups`);
    assert.equal((fx.match(/portals\.open\(/g) ?? []).length, 0);
    assert.match(s, /portals\.openMine\(at\);   \/\/ STOREFRONT: my spared revenant's portal/);
  }
  assert.match(rd('src/scenes/exteriorFoes.js'), /portals\.open\(f\.ai\.feet, \{ quiet: true, skin: peerEffectWorn\(f\.puppet, 'portal'\) \}\)/, 'a peer\'s spared revenant in its owner\'s');
  delete globalThis.localStorage;
});

test('STOREFRONT A SKINNED PORTAL FACES THE FRAME\'S CAMERA, WHOEVER TICKS IT (AUDIT STOREFRONT RENDER L1): the basis is read off the renderer\'s own view - so the Portal Stone\'s gate (its pool ticked with no eye), the Elite Breach call\'s, the companions\' and the peers\' all stand their cogs across the view and their arch behind the vortex from any side; and a skin\'s opening and breath carry its facing to the burst (mutants: the view unread; the basis off world X; the arch toward the eye; the burst with no facing)', () => {
  const mid = [0, PORTAL_SIZE.h * 0.5, 0], out = () => ({ right: [0, 0, 0], back: [0, 0, 0] });
  for (const eye of [[20, 1.6, 0], [-20, 1.6, 0], [0, 1.6, 20], [0, 1.6, -20], [14, 1.6, 14], [-3, 9, 4]]) {
    const L = Math.hypot(mid[0] - eye[0], mid[2] - eye[2]), back = [(mid[0] - eye[0]) / L, 0, (mid[2] - eye[2]) / L], right = [back[2], 0, -back[0]];
    for (const b of [portalBasis(lookAt(eye, mid, [0, 1, 0]), null, mid, out()), portalBasis(null, eye, mid, out())]) {
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(b.back[i] - back[i]) < 1e-6 && Math.abs(b.right[i] - right[i]) < 1e-6, `from ${eye}: away from the eye, across the view (${b.back}, ${b.right})`);
    }
  }
  const none = portalBasis(null, null, mid, out());
  assert.ok([...none.right, ...none.back].every((v, i) => v === [1, 0, 0, 0, 0, 1][i]), 'before any frame: world X');
  // the gate's pool, ticked as world.js ticks it (no eye, indoors no feet), seen from 20 m east
  wearing('0d0');
  const bursts = [];
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, burst: (recipe, at, o) => { bursts.push({ recipe, dir: o.dir }); return true; } });
  const eye = [20, 1.6, 0], r = Object.assign(fakeRenderer(), { _view: lookAt(eye, [0, 1.25, 0], [0, 1, 0]), _camPos: new Float32Array(eye) });
  let t = 0;
  const gates = createPortalGates({ renderer: r, now: () => t, destOf: () => ({ pixel: { x: 1, y: 1 }, name: 'There' }), eventGround: false });
  gates.open([0, 0, 0], { pixel: { x: 1, y: 1 }, name: 'There' });
  t = 1500; gates.tick(null);
  const cogs = r.made.filter((b) => b.archive === 'fxportal_brass_cog');
  assert.equal(cogs.length, 6);
  const zs = cogs.map((b) => b.origin[2]);
  assert.ok(cogs.every((b) => Math.abs(b.origin[0]) < 1e-9) && Math.max(...zs) - Math.min(...zs) > 1.2, `the cogs round the rim across the view (${zs.map((z) => z.toFixed(2))})`);
  assert.ok(bursts.length && bursts.every((b) => Math.abs(b.dir[0] + 1) < 1e-9 && Math.abs(b.dir[1]) < 1e-9), `its opening and breath face away from the eye (${JSON.stringify(bursts)})`);
  // the Daedric arch behind its vortex, away from the eye
  const set = createPortalSet({ renderer: r, now: () => t });
  set.open([5, 0, 0], { fixed: true, skin: 'daedric', holdMs: 5000 });
  t += 900; set.tick();
  const arch = r.made.find((b) => b.archive === 'fxportal_daedric_arch');
  assert.ok(arch.origin[0] < 5 - 0.07 && Math.abs(arch.origin[2]) < 1e-9, `the arch behind it (${arch.origin.map((v) => v.toFixed(2))})`);
  // a companion's, its pool handing no eye: it still stands a step behind its body, away from the frame's camera
  const behind = set.open([2, 0, 3]);
  t += 100; set.tick();
  assert.ok(Math.abs(behind.origin[0] - (2 - PORTAL_BACK * 18 / Math.hypot(18, 3))) < 1e-9 && behind.origin[2] > 3, `behind its body (${behind.origin.map((v) => v.toFixed(2))})`);
  setPlayerDoor(null);
  delete globalThis.localStorage;
});
