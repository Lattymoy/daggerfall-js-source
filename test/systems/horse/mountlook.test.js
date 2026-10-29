// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md section 7): THE MOUNT LOOKS - the account's look laid over the
// horse's coat (systems/horse/horseCoats.js, its fifth part), never on the wire's code; each look's dye on the side
// view and the 3D horse; mine off my token's kit and a peer's off its own (systems/horse/mountLook.js) wherever a horse is
// drawn; the beat in the world (systems/horse/mountFx.js) and on the shop's and profile's horse (ui/mountPreview.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

import {
  recolorHorse, recolorHorseTexels, horseLookCode, horseLookOfCode, withMountLook, wireHorseLook, HORSE_MOUNTS, HORSE_LOOK_CODE_MAX, HORSE_LOOK_WORN_MAX,
  pictureHide, SPECTRAL_HOLES, BARDING_BAND,
} from '../../../src/systems/horse/horseCoats.js';
import { MOUNT_LOOKS } from '../../../src/net/effectLaw.js';
import { ownMountLook, peerMountLook } from '../../../src/systems/horse/mountLook.js';
import { createMountFx, MOUNT_FX_BEAT_S } from '../../../src/systems/horse/mountFx.js';
import { MOUNT_PREVIEW_BEAT, MOUNT_PREVIEW_FILE } from '../../../src/ui/mountPreview.js';
import { bindPeerEffects } from '../../../src/net/peer/peerEffects.js';
import { SESSION_KEY } from '../../../src/net/accountClient.js';
import { HORSE_LOOK_MAX } from '../../../src/net/wire.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const side = () => { const raw = PNG.sync.read(readFileSync(new URL(`../../../vendor/horse-cart-and-cargo/Textures/${MOUNT_PREVIEW_FILE}`, import.meta.url))); return { width: raw.width, height: raw.height, colors: new Uint8Array(raw.data) }; };
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx / 255]; };

test('STOREFRONT the look\'s code: a mount look a fifth part, its highest factor, so every code the wire knew is the same horse; the wire never carries one (the token does), and a screen lays it on and takes it off (mutants: the mount on the wire; a look changing the coat\'s code)', () => {
  assert.deepEqual(HORSE_MOUNTS.slice(1), [...MOUNT_LOOKS]);
  assert.equal(HORSE_LOOK_MAX, HORSE_LOOK_CODE_MAX, 'the wire\'s bound is the coat\'s alone');
  const coat = horseLookCode({ coat: 3, pattern: 2, legs: 1, seed: 999 });
  const worn = withMountLook(coat, 'dawnfire');
  assert.ok(worn > HORSE_LOOK_CODE_MAX && worn <= HORSE_LOOK_WORN_MAX);
  assert.equal(wireHorseLook(worn), coat);
  assert.deepEqual(horseLookOfCode(worn), { coat: 3, pattern: 2, legs: 1, seed: 999, mount: 3 });
  assert.equal(withMountLook(worn, null), coat, 'taken off: the coat again');
  assert.match(rd('src/systems/horse/horseCartWire.js'), /const hc = wireHorseLook\(view\.look \?\? 0\);/, 'a parked team\'s word never says it');
  assert.match(rd('src/scenes/world.js'), /rc: riding \? riddenHorseLook\(playerEntity\.items \?\? \[\]\) \|\| undefined : undefined,/, 'nor the pose');
});

test('STOREFRONT the dye: each look moves the hide alone - the Daedric Warhorse dark under burning barding, the Spectral Steed a pale blue ghost with holes at its legs, the Dawnfire Charger gold with burning legs, the Brass Automaton brass with aetherium studs - the tack and the mane kept; the 3D horse takes the same looks (mutants: a look that dyes the saddle; the ghost\'s holes on the 3D horse)', () => {
  const img = side();
  const hide = pictureHide(img);
  assert.ok(hide.at.length > 500);
  const hidden = new Set(hide.at);
  const coat = horseLookCode({ coat: 1, pattern: 0, legs: 0, seed: 777 });
  const looks = Object.fromEntries(MOUNT_LOOKS.map((m) => [m, recolorHorse(img, withMountLook(coat, m))]));
  const plain = recolorHorse(img, coat);
  for (const m of MOUNT_LOOKS) {
    const c = looks[m].colors;
    let movedOut = 0;
    for (let i = 0; i < img.width * img.height; i++) if (!hidden.has(i) && (c[i * 4] !== plain.colors[i * 4] || c[i * 4 + 3] !== plain.colors[i * 4 + 3])) movedOut++;
    assert.equal(movedOut, 0, `${m}: nothing but the hide moved`);
  }
  const mean = (m, f) => { let a = 0; for (const i of hide.at) a += f(...looks[m].colors.slice(i * 4, i * 4 + 3)); return a / hide.at.length; };
  assert.ok(mean('warhorse', (r, g, b) => hsv(r, g, b)[2]) < mean('dawnfire', (r, g, b) => hsv(r, g, b)[2]), 'the warhorse dark, the charger bright');
  let burning = 0;
  for (const i of hide.at) { const [h, s, v] = hsv(...looks.warhorse.colors.slice(i * 4, i * 4 + 3)); if (h < 30 && s > 0.8 && v > 0.45) burning++; }
  assert.ok(burning > hide.at.length * 0.03, 'the barding\'s edges burn');
  assert.ok(mean('spectral', (r, g, b) => hsv(r, g, b)[0]) > 170 && mean('spectral', (r, g, b) => hsv(r, g, b)[0]) < 220, 'a blue ghost');
  const holes = hide.at.filter((i) => looks.spectral.colors[i * 4 + 3] === 0).length;
  assert.ok(holes > 0 && holes < hide.at.length * (SPECTRAL_HOLES + 0.25), `the ghost see-through in places (${holes})`);
  assert.ok(mean('automaton', (r, g, b) => hsv(r, g, b)[0]) > 30 && mean('automaton', (r, g, b) => hsv(r, g, b)[0]) < 60, 'brass');
  let studs = 0;
  for (const i of hide.at) { const [h, s] = hsv(...looks.automaton.colors.slice(i * 4, i * 4 + 3)); if (h > 185 && h < 215 && s > 0.6) studs++; }
  assert.ok(studs > 0, 'its aetherium studs');
  assert.ok(BARDING_BAND[0] < BARDING_BAND[1]);
  // the 3D horse: the same looks through its texels, its alpha its own
  const tex = { width: 4, height: 1, colors: new Uint8Array([150, 80, 40, 255, 150, 80, 40, 255, 150, 80, 40, 255, 150, 80, 40, 255]) };
  const map = { hide: new Uint8Array([1, 1, 1, 1]), planes: new Float32Array(36).map((_, i) => (i % 3 === 2 ? 1 : 0.3)), up: new Float32Array([0.05, 0.4, 0.6, 0.9]) };
  for (const m of MOUNT_LOOKS) {
    const out = recolorHorseTexels(tex, withMountLook(0, m), map);
    assert.notDeepEqual([...out.colors], [...tex.colors], `${m}: the 3D hide dyed`);
    assert.ok([3, 7, 11, 15].every((i) => out.colors[i] === 255), `${m}: no holes in the 3D horse`);
  }
});

test('STOREFRONT whose look: mine off my token\'s kit, a peer\'s off its own, on every horse the port draws - the riding view, the body\'s horse, the 3D horse, Eye of the Beholder\'s riders and the pool\'s standing horse; the wagon\'s team never (mutants: a peer\'s horse in my look; a host left out)', () => {
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'a1', name: 'Me', kind: 'linked', sessionId: 's', secret: 'x', effects: '00b' })]]);
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem() {}, removeItem() {}, length: 1, key: () => SESSION_KEY };
  assert.equal(horseLookOfCode(ownMountLook(0)).mount, 2, 'the Spectral Steed');
  bindPeerEffects((id) => (id === 'p2' ? '00a' : null));
  assert.equal(horseLookOfCode(peerMountLook('p2', 0)).mount, 1, 'its own warhorse');
  assert.equal(horseLookOfCode(peerMountLook('p3', 0)).mount, undefined, 'none worn');
  bindPeerEffects(null);
  delete globalThis.localStorage;
  assert.match(rd('src/player/mountRig.js'), /ridingLook\(mode, ownMountLook\(riddenHorseLook\(playerEntity\?\.items \?\? \[\]\)\)\)/);
  assert.match(rd('src/combat/weapon/weaponRig.js'), /horseLook: entity \? ownMountLook\(riddenHorseLook\(entity\.items \?\? \[\]\)\) : 0,/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(host), /look: ownMountLook\(riddenHorseLook\(playerEntity\.items \?\? \[\]\)\), slow: player\.slowRide/, host);
  assert.match(rd('src/net/peer/peerRiders.js'), /horse: peerMountLook\(peer\.id, pose\.rc \| 0\)/);
  assert.match(rd('src/net/peer/peerBodies.js'), /look: peerMountLook\(b\.id, shown\.rc \| 0\)/);
  assert.match(rd('src/scenes/horseCartPool.js'), /owner === '' \? ownMountLook\(horseLook\?\.\(\)\) : peerMountLook\(_peers\.get\(owner\)\?\.ownerId \?\? owner, _peers\.get\(owner\)\?\.horseLook \?\? 0\)/);
  assert.match(rd('src/world/wagonModels.js'), /horseLook: \(\) => riddenHorseLook\(items\(\)\),/, 'the wagon\'s team in its own coat');
});

test('STOREFRONT the beat: a horse in a look throws its beat through the running host\'s engine as an ambient burst - a stride\'s beat at a gallop, slower at a walk, a slow breath standing; its mane only where it is seen; a rider gone lets it go; the shop\'s and profile\'s horse draw a look each (mutants: a beat with no look; the mane in first person; a rider never let go)', () => {
  const beats = [];
  const fx = createMountFx({ door: () => ({ burst: (recipe, at, o) => { beats.push({ recipe, ...o }); return true; } }) });
  const run = (pace, mane = true, n = 100, dt = 0.02) => { beats.length = 0; fx.sweep(); fx.sweep(); for (let i = 0; i < n; i++) fx.step('r', 'dawnfire', [0, 0, 0], 0, pace, dt, { mane }); return beats.length; };
  assert.equal(run(2), Math.floor(2 / MOUNT_FX_BEAT_S[2]));
  assert.equal(run(2, true, 100, 0.03), Math.floor(3 / MOUNT_FX_BEAT_S[2]), 'a frame that does not divide the beat: it keeps its time');
  assert.ok(run(1) < run(2) && run(0) < run(1), 'a gallop\'s beat, a walk\'s, a breath');
  assert.ok(beats.every((b) => b.recipe === 'mount-dawnfire' && b.dir.length === 2));   // the horses' pool is the recipe's (render/killFx.js KFX_POOL_OF)
  run(2, false);
  assert.ok(beats.every((b) => b.mane === false), 'no mane from its own saddle');
  beats.length = 0;
  for (let i = 0; i < 100; i++) fx.step('r', null, [0, 0, 0], 0, 2, 0.02);
  assert.equal(beats.length, 0, 'no look, no beat');
  fx.step('gone', 'warhorse', [0, 0, 0], 0, 2, 0.02);
  fx.sweep(); fx.sweep();
  assert.equal(fx.size, 0, 'riders not seen let go');
  assert.deepEqual(Object.keys(MOUNT_PREVIEW_BEAT).sort(), [...MOUNT_LOOKS].sort());
  assert.match(rd('src/player/mountRig.js'), /mountFx\.step\('self', mounted \? effectWorn\(ownEffects\(\), 'mount'\) : null,/);
  assert.match(rd('src/net/peer/peerFx.js'), /const ridden = pose\.rd === POSE_RIDE\.Horse && !pose\.wb \? effectWorn\(kit, 'mount'\) : null;/);
});
