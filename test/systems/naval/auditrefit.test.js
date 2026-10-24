// AUDIT NAVAL-REFIT (2026-10-17, the owner: "Lets do a comprehensive audit and ensure perfection"; bible/03-World/
// Naval-Refit.md AUDIT) - what the audit of the refit found, each on the real module it lives in: a near miss searched
// only past her bounding sphere's reach; a ship another player stands going down blows her magazine on my screen as on
// hers (her seed's), and is heard going; the flag's cloth remembers a flag that will not paint; a ram on a ship another
// stands says its foul to her stander; a classic record read for its picture through one door, guarded alike for the paint
// shop and the cabin. tools/mutants/auditrefit.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createShotField, NEAR_MISS_M } from '../../../src/systems/naval/navalShots.js';
import { navalWireRecord } from '../../../src/systems/naval/navalWire.js';
import { magazineOf, MAGAZINE_DELAY } from '../../../src/scenes/naval/navalFeel.js';
import { NAVAL_SFX, NAVAL_CLASSIC } from '../../../src/systems/naval/navalSounds.js';
import { ShipFlagRenderer, FLAG_REPAINT_S } from '../../../src/render/shipFlagPass.js';
import { BANNER_TEXTURE_IDLE_S } from '../../../src/render/bannerPass.js';
import { HULL } from '../../../src/systems/naval/navalShips.js';
import { classicPictureOf } from '../../../src/formats/derivedTexture.js';
import { sea, freshPool } from '../../navalSea.mjs';

// ── NEAR-MISS: the sphere's reject ─────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAVAL-REFIT NEAR-MISS: a ball\'s flight is searched for a near miss only within her bounding sphere and NEAR_MISS_M - one passing NEAR_MISS_M off her far end is heard still (the sphere is her half-diagonal, never her beam), one well off her never searched (mutants: the reach dropped from the sphere, the sphere dropped)', () => {
  const LONG = { c: [0, 0, 0], ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h: [1, 1, 12] };   // a long hull, bow at z 12
  const run = (p0, v0) => {
    const events = [];
    const f = createShotField({ seaY: () => -50, targets: () => [{ id: 'mine', box: LONG, ear: true }], onEvent: (e) => events.push(e), random: () => 0.5 });
    f.fireVolley({ id: 'v', shooter: 'pirate:1', launches: [{ gun: 'long', p0, v0, delay: 0 }] });
    for (let i = 0; i < 12; i++) f.step(0.1);
    return events.filter((e) => e.type === 'pass');
  };
  const off = 12 + NEAR_MISS_M - 1;   // across her bow, NEAR_MISS_M - 1 past its end: past her sphere's radius (12.08), within its reach
  const heard = run([-60, 0, off], [200, 0, 0]);
  assert.equal(heard.length, 1, 'heard off her far end');
  assert.ok(Math.abs(heard[0].gap - (NEAR_MISS_M - 1)) < 0.2, `at its nearest: ${heard[0].gap}`);
  assert.equal(run([-60, 0, 12 + NEAR_MISS_M + 2], [200, 0, 0]).length, 0, 'past NEAR_MISS_M: unheard');
});

// ── MAGAZINE: a ship another stands ────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAVAL-REFIT MAGAZINE online: a ship another player stands, said going down afire, is heard going down and blows her magazine on my screen as her stander\'s does - her seed\'s, once; one said going down with no fire never (mutants: the sinking unheard, the magazine unlit, her fire unread)', async () => {
  let seed = 1;
  while (magazineOf(seed) == null) seed++;
  let cold = seed + 1;
  while (magazineOf(cold) == null) cold++;
  const h = await sea({ hull: HULL.SmallShip, online: { id: () => 'b-player', peers: () => [], sendHit: () => true }, pool: await freshPool(), settings: { ShipsAtSea: 'off', Boarders: false } });
  const word = (state, fire) => navalWireRecord({ ships: [
    { n: 1, classId: 'pirateBrig', variant: 0, pos: [0, 0, 120], yaw: 0, speed: 0, sails: 0, hull: state === 'afloat' ? 0.5 : 0, sail: 1, crew: 1, state, heel: 0, seed, fire, gen: 0, region: 17 },
    { n: 2, classId: 'pirateBrig', variant: 0, pos: [0, 0, -120], yaw: 0, speed: 0, sails: 0, hull: state === 'afloat' ? 0.5 : 0, sail: 1, crew: 1, state, heel: 0, seed: cold, fire: false, gen: 0, region: 17 },
  ] });
  assert.equal(h.host.applyWord('a-player', word('afloat', true), (p) => p), true);
  h.run(0.2);
  h.log.sounds.length = 0;
  for (let t = 0; t < MAGAZINE_DELAY[1] + 1; t += 0.5) { h.host.applyWord('a-player', word('sinking', true), (p) => p); h.run(0.5); }
  const said = (k) => h.log.sounds.filter(([key]) => key === k).length;
  assert.equal(said(NAVAL_CLASSIC.bubbles), 2, 'each heard going down, once');
  assert.equal(said(NAVAL_SFX.blast), 1, 'her magazine up, once - the cold one never');
});

// ── the flag's cloth ───────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAVAL-REFIT the flag\'s cloth: a flag that will not paint is remembered so - painted again FLAG_REPAINT_S on, never every frame - and given back with the rest once idle; a painted one kept while it is drawn (mutants: the failure forgotten, the repaint\'s span, the idle prune of a failure)', () => {
  const gl = {
    TEXTURE_2D: 1, created: 0, deleted: 0,
    createTexture() { this.created++; return { id: this.created }; }, deleteTexture() { this.deleted++; },
    bindTexture() {}, pixelStorei() {}, texImage2D() {}, generateMipmap() {}, texParameteri() {},
  };
  let paints = 0, can = false;
  const pass = Object.assign(Object.create(ShipFlagRenderer.prototype), { gl, textures: new Map(), paint: () => { paints++; return can ? {} : null; } });
  assert.equal(pass.textureOf('a', {}, 0), null);
  for (let s = 0.1; s < FLAG_REPAINT_S - 0.05; s += 0.1) pass.textureOf('a', {}, s);
  assert.equal(paints, 1, 'remembered: not painted again every frame');
  can = true;
  const tex = pass.textureOf('a', {}, FLAG_REPAINT_S + 0.01);
  assert.ok(tex, 'asked again once FLAG_REPAINT_S has run');
  assert.deepEqual([paints, gl.created], [2, 1]);
  assert.equal(pass.textureOf('a', {}, FLAG_REPAINT_S + 1), tex, 'painted: kept');
  can = false;
  pass.textureOf('b', {}, FLAG_REPAINT_S + 1);
  pass.prune(FLAG_REPAINT_S + 1 + BANNER_TEXTURE_IDLE_S + 1);
  assert.deepEqual([pass.textures.size, gl.deleted], [0, 1], 'idle: both let go, the one texture given back');
});

// ── RAM-BOARD: the rammer's word ───────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAVAL-REFIT RAM-BOARD the rammer\'s side: a ram on a ship another player stands sends her stander its blow and its foul together - the seconds it holds her (mutants: the foul unsaid)', async () => {
  const sent = [];
  const h = await sea({ hull: HULL.SmallShip, online: { id: () => 'a-player', peers: () => [], sendHit: (d) => { sent.push(d); return true; } }, pool: await freshPool(), settings: { ShipsAtSea: 'off', Boarders: false } });
  const w = (pos) => navalWireRecord({ ships: [{ n: 4, classId: 'merchantGalleon', variant: 0, pos, yaw: Math.PI / 2, speed: 0, sails: 0, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 99, fire: false, gen: 0, region: 17 }] });
  h.host.applyWord('b-player', w([0, 0, 200]), (p) => p);
  h.run(0.3);
  const e = h.host._sea.get('b-player:4');
  assert.ok(e?.boat, 'her copy stands, a hull of her own');
  // my way on, then her side under my stem - her stander's word holding her there
  h.runtime.state.velocityCurrent = [0, 0, 6];
  h.host.applyWord('b-player', w([0, 0, 40]), (p) => p);
  h.run(0.3);
  for (let z = 24; z >= 4 && !sent.length; z -= 1) {
    h.host.applyWord('b-player', w([0, 0, z]), (p) => p);
    e.ship.pos = [0, 0, z]; e.target = { ...e.target, pos: [0, 0, z], speed: 0 };
    h.host.frame(0.1);
  }
  const blow = sent.find((d) => d?.nv && d.to === 'b-player');
  assert.ok(blow, 'her blow sent to her stander');
  assert.ok(blow.nv.u >= 19 && blow.nv.u <= 20, `and its foul: ${blow.nv.u} s`);
});

// ── one read of a classic record ───────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAVAL-REFIT a classic record read for its picture, the one door the paint shop and the cabin share: the player\'s own art in its palette, index 0 clear - none for no archive, a mod\'s own, a record past the file\'s count (the paint shop\'s copy read it), or an empty one (mutants: each guard)', async () => {
  const bitmap = { width: 2, height: 1, data: new Uint8Array([0, 5]) };
  const file = { recordCount: 2, getDFBitmap: (r) => (r === 1 ? { width: 0 } : bitmap) };
  const palette = { getRed: (i) => i * 10, getGreen: (i) => i * 8, getBlue: (i) => i * 6 };
  const of = (t, record) => classicPictureOf(async () => t, palette, 50, record);
  const pic = await of(file, 0);
  assert.deepEqual([pic.width, pic.height, [...pic.data]], [2, 1, [0, 0, 0, 0, 50, 40, 30, 255]]);
  assert.equal(await of(null, 0), null, 'no archive');
  assert.equal(await of({ ...file, vendor: true }, 0), null, 'a mod\'s own');
  assert.equal(await of(file, 2), null, 'past the file\'s records');
  assert.equal(await of(file, 1), null, 'an empty record');
});
