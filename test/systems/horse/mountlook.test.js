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
  pictureHide, isCoatPixel, isSpeckPixel, POINT_ABOVE, POINT_SAT, POINT_VAL, POINT_BELLY,
} from '../../../src/systems/horse/horseCoats.js';
import { GHOST_LEGS, FIRE_LEGS, HEART_UP } from '../../../src/systems/horse/mountPaint.js';
import { MOUNT_LOOKS } from '../../../src/net/effectLaw.js';
import { createHorseRig, HAIR_ROWS } from '../../../src/world/horseRig.js';
import { ownMountLook, peerMountLook } from '../../../src/systems/horse/mountLook.js';
import { createMountFx, MOUNT_FX_BEAT_S } from '../../../src/systems/horse/mountFx.js';
import { MOUNT_PREVIEW_BEAT, MOUNT_PREVIEW_FILE } from '../../../src/ui/mountPreview.js';
import { bindPeerEffects } from '../../../src/net/peer/peerEffects.js';
import { SESSION_KEY } from '../../../src/net/accountClient.js';
import { HORSE_LOOK_MAX } from '../../../src/net/wire.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const picture = (p) => { const raw = PNG.sync.read(readFileSync(new URL(`../../../vendor/${p}`, import.meta.url))); return { width: raw.width, height: raw.height, colors: new Uint8Array(raw.data) }; };
const side = () => picture(`horse-cart-and-cargo/Textures/${MOUNT_PREVIEW_FILE}`);
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
  // PIN MOVED (DRAGON5, DRAGON-BLUE, at the merges of main): a tamed dragon's own look while one is ridden, an Admin's ride's
  // off a horse; a horse's is still the coat alone
  assert.match(rd('src/scenes/world.js'), /rc: riding \? \(player\.transportMode === TRANSPORT_MODES\.Dragon \? dragonLookOfItem\(dragonMountOf\(playerEntity\.items\)\) : riddenHorseLook\(playerEntity\.items \?\? \[\]\)\) \|\| undefined : dragonRideLook\(\) \|\| undefined,/, 'nor the pose');
});

// AUDIT-STOREFRONT (2026-10-29): PIN MOVED - "nothing but the hide moved" left a ghost with a black mane and tail. A look
// now moves the hide and its points (horseCoats.js pointsOf); the saddle and the rider are still never touched.
/** The pixels of `img` a look moved off its coat alone, other than the hide's. */
const movedOff = (img, hidden, look, plain) => {
  const out = [];
  for (let i = 0; i < img.width * img.height; i++) if (!hidden.has(i) && (look.colors[i * 4] !== plain.colors[i * 4] || look.colors[i * 4 + 1] !== plain.colors[i * 4 + 1] || look.colors[i * 4 + 3] !== plain.colors[i * 4 + 3])) out.push(i);
  return out;
};
const src = (img, i) => [img.colors[i * 4], img.colors[i * 4 + 1], img.colors[i * 4 + 2]];

// AUDIT-STOREFRONT (2026-10-29, the owner: "the horse designs are awful"): PIN MOVED - the looks redrawn by the horse's
// own shape (mountPaint.js): no grid of holes, no scales or stripes laid flat over head and legs alike.
test('AUDIT-STOREFRONT the dye: each look its own ramp by the art\'s light and its marks by the horse\'s shape - the Spectral Steed a pale blue ghost, its rim lit and its legs dissolving from the hooves up; the Dawnfire Charger gold, its legs burning; the Daedric Warhorse obsidian, lit red from below; the Brass Automaton brass in seamed plates, an aetherium heart at its chest - the tack kept; the 3D horse the same looks, no holes in it (mutants: a look that dyes the saddle; holes over the ghost\'s body; the ghost\'s rim unlit; the charger\'s legs unburnt; the warhorse lit from above; the automaton\'s seams and heart gone)', () => {
  const img = side();
  const kept = pictureHide(img), hide = { ...kept, at: Array.from(kept.at) };   // an array: a typed one's map keeps numbers whole
  assert.ok(hide.at.length > 500);
  const hidden = new Set(hide.at), W = img.width;
  const coat = horseLookCode({ coat: 1, pattern: 0, legs: 0, seed: 777 });
  const top = { bottomFirst: false };   // the picture as mountPreview.js dyes it: row 0 its top
  const looks = Object.fromEntries(MOUNT_LOOKS.map((m) => [m, recolorHorse(img, withMountLook(coat, m), top)]));
  const plain = recolorHorse(img, coat, top);
  const hideH = hide.r1 - hide.r0 + 1, belly = POINT_BELLY * hideH;
  const upOf = (i) => 1 - ((i - (i % W)) / W - hide.r0) / hideH;
  for (const m of MOUNT_LOOKS) {
    for (const i of movedOff(img, hidden, looks[m], plain)) {
      const [h, s, v] = hsv(...src(img, i)), down = (i - (i % W)) / W - hide.r0;
      assert.ok(s < POINT_SAT || (down > belly && isCoatPixel(...src(img, i), false)) || isSpeckPixel(...src(img, i)), `${m}: ${i} (h ${h.toFixed(0)}, s ${s.toFixed(2)}, v ${v.toFixed(2)}) is no point - the tack never moves`);
    }
  }
  // THE VISUAL PASS: the art's rose sheen on the hooves and the poll is the look's in every look - none left the bay's pink
  const rose = [];
  for (let i = 0; i < W * img.height; i++) if (img.colors[i * 4 + 3] && !hidden.has(i) && isSpeckPixel(...src(img, i))) rose.push(i);
  assert.ok(rose.length >= 12, `the side view's sheen (${rose.length})`);
  for (const m of MOUNT_LOOKS) for (const i of rose) {
    const c = looks[m].colors, o = i * 4, pink = isSpeckPixel(c[o], c[o + 1], c[o + 2]) && hsv(c[o], c[o + 1], c[o + 2])[2] > 0.4;   // the obsidian's dark is purple-grey
    assert.ok(!c[o + 3] || !pink, `${m}: the sheen at ${i % W},${Math.floor(i / W)} left rose (${[...c.slice(o, o + 3)]})`);
  }
  const of = (m, at) => at.map((i) => hsv(...looks[m].colors.slice(i * 4, i * 4 + 3)));
  const mean = (a, k) => a.reduce((t, c) => t + c[k], 0) / a.length;
  const lit = (m) => hide.at.filter((i) => looks[m].colors[i * 4 + 3]);
  const rim = hide.at.filter((i) => [i - 1, i + 1, i - W, i + W].some((q) => !img.colors[q * 4 + 3]));
  const inner = hide.at.filter((i) => !rim.includes(i) && upOf(i) > 0.5);
  // the ghost: blue, its edge glowing, see-through only at its legs and only toward the hooves
  assert.ok(mean(of('spectral', lit('spectral')), 0) > 185 && mean(of('spectral', lit('spectral')), 0) < 215, 'a blue ghost');
  assert.ok(mean(of('spectral', rim), 2) > mean(of('spectral', inner), 2) + 0.08, 'its rim lit');
  const holes = hide.at.filter((i) => looks.spectral.colors[i * 4 + 3] === 0);
  assert.ok(holes.length > 20, `its legs dissolving (${holes.length})`);
  assert.ok(holes.every((i) => upOf(i) < GHOST_LEGS), 'never a hole over its body');
  // the charger: gold, its lower legs fire
  assert.ok(mean(of('dawnfire', inner), 0) > 30 && mean(of('dawnfire', inner), 0) < 50, 'gold');
  const hooves = hide.at.filter((i) => upOf(i) < FIRE_LEGS * 0.4);
  assert.ok(of('dawnfire', hooves).filter(([h, sat, v]) => h < 60 && sat < 0.45 && v > 0.9).length > hooves.length * 0.5, 'its legs burning white from the hooves');
  // the warhorse: dark, redder below than above
  assert.ok(mean(of('warhorse', hide.at), 2) < mean(of('dawnfire', hide.at), 2) * 0.5, 'obsidian, the charger bright');
  const red = (at) => at.reduce((t, i) => { const [r, g, b] = src(looks.warhorse, i); return t + r / (r + g + b + 1); }, 0) / at.length;
  assert.ok(red(hide.at.filter((i) => upOf(i) < 0.3)) > red(hide.at.filter((i) => upOf(i) > 0.7)) + 0.1, 'lit red from below');
  // the automaton: brass in plates, a riveted seam at the plates' line, its heart at its chest
  assert.ok(mean(of('automaton', inner), 0) > 30 && mean(of('automaton', inner), 0) < 50, 'brass');
  const seam = hide.at.filter((i) => Math.abs(upOf(i) - 0.62) < 0.006 && !rim.includes(i));
  assert.ok(of('automaton', seam).filter(([, , v]) => v < 0.25).length > seam.length * 0.4, 'its plates\' seam');
  const heart = of('automaton', hide.at).map((c, k) => [c, hide.at[k]]).filter(([[h, s]]) => h > 190 && h < 215 && s > 0.5).map(([, i]) => i);
  assert.ok(heart.length > 6, `its aetherium heart (${heart.length})`);
  assert.ok(heart.every((i) => Math.abs(upOf(i) - HEART_UP) < 0.08), 'at its chest\'s height');
  // the 3D horse: the same looks through its texels, its alpha its own
  const tex = { width: 4, height: 1, colors: new Uint8Array([150, 80, 40, 255, 150, 80, 40, 255, 150, 80, 40, 255, 150, 80, 40, 255]) };
  const map = { hide: new Uint8Array([1, 1, 1, 1]), planes: new Float32Array(36).map((_, i) => (i % 3 === 2 ? 1 : 0.3)), up: new Float32Array([0.05, 0.4, 0.6, 0.9]) };
  for (const m of MOUNT_LOOKS) {
    const out = recolorHorseTexels(tex, withMountLook(0, m), map);
    assert.notDeepEqual([...out.colors], [...tex.colors], `${m}: the 3D hide dyed`);
    assert.ok([3, 7, 11, 15].every((i) => out.colors[i] === 255), `${m}: no holes in the 3D horse`);
  }
});

// AUDIT-STOREFRONT (the owner: "the horse designs are awful"): PIN MOVED - the Warhorse's mane and tail burn now, and the
// charger's are fire, not the gold's shadow.
test('AUDIT-STOREFRONT the points: a look moves the horse\'s near-black too - the ghost\'s mane and tail a deep blue, see-through at their tips; the charger\'s and the Warhorse\'s fire; the automaton\'s steel - and never a rider\'s bow rising off the neck, nor a rein hanging in the air, in either row order (mutants: the points left black; a bow dyed; a rein dyed; the ghost\'s points its hide\'s light; the charger\'s points cold; the ghost\'s points never see-through; the charger\'s far legs unburnt; the Warhorse\'s mane left black)', () => {
  // a built horse: a bay hide, a tail off its croup, a bow rising off its withers, a rein hanging in the air
  const W = 60, Hh = 40, colors = new Uint8Array(W * Hh * 4);
  const put = (x, y, rgb) => { colors.set([...rgb, 255], (y * W + x) * 4); };
  for (let y = 10; y < 30; y++) for (let x = 15; x < 45; x++) put(x, y, [150, 80, 40]);
  for (let y = 10; y < 21; y++) for (let x = 45; x < 53; x++) put(x, y, [22, 20, 20]);
  for (let y = 0; y < 10; y++) for (let x = 20; x < 23; x++) put(x, y, [24, 22, 22]);
  for (let x = 5; x < 15; x++) put(x, 25, [20, 20, 22]);
  const built = { width: W, height: Hh, colors };
  const flipped = { width: W, height: Hh, colors: new Uint8Array(colors.length) };
  for (let y = 0; y < Hh; y++) flipped.colors.set(colors.subarray(y * W * 4, (y + 1) * W * 4), (Hh - 1 - y) * W * 4);
  const at = (img, x, y, flip) => { const o = ((flip ? Hh - 1 - y : y) * W + x) * 4; return [...img.colors.slice(o, o + 4)]; };
  for (const [img, flip] of [[built, false], [flipped, true]]) {
    const dyed = Object.fromEntries(MOUNT_LOOKS.map((m) => [m, recolorHorse(img, withMountLook(0, m), { bottomFirst: flip })]));
    const tail = [];
    for (let y = 10; y < 21; y++) for (let x = 46; x < 53; x++) tail.push([x, y]);   // its strands: the root column against the hide is its outline, the hide's shade
    const look = (m, x, y) => at(dyed[m], x, y, flip), was = (x, y) => at(img, x, y, flip);
    const hues = (m) => tail.map(([x, y]) => look(m, x, y)).filter((c) => c[3]).map((c) => hsv(c[0], c[1], c[2]));
    const mean = (a, k) => a.reduce((t, c) => t + c[k], 0) / a.length;
    assert.ok(mean(hues('spectral'), 0) > 190 && mean(hues('spectral'), 0) < 220, `the ghost's tail blue (${flip})`);
    const v = (x, y) => hsv(...look('spectral', x, y).slice(0, 3))[2];
    assert.ok(v(45, 15) < v(49, 15), 'its root deep against the hide, so the art\'s line still reads');
    assert.ok(v(46, 15) + 0.2 < v(50, 15), 'its strands paler out to their tips');
    assert.ok(tail.some(([x, y]) => look('spectral', x, y)[3] === 0), 'its tips dissolving');
    assert.ok(mean(hues('dawnfire'), 0) < 45 && mean(hues('dawnfire'), 1) > 0.5, 'the charger\'s fire');
    assert.ok(mean(hues('warhorse'), 0) < 40 && mean(hues('warhorse'), 1) > 0.6, 'the Warhorse\'s burning');
    assert.ok(mean(hues('automaton'), 0) > 200 && mean(hues('automaton'), 0) < 230 && mean(hues('automaton'), 1) < 0.45, 'the automaton\'s steel');
    for (const m of MOUNT_LOOKS) {
      for (let y = 0; y < 8; y++) for (let x = 20; x < 23; x++) assert.deepEqual(look(m, x, y), was(x, y), `${m}: the bow at ${x},${y} kept`);
      for (let x = 5; x < 14; x++) assert.deepEqual(look(m, x, 25), was(x, 25), `${m}: the rein at ${x} kept`);
    }
  }
  // the shop's horse and the riders' own pictures: nothing over the hide's crest moves (a helmet, a bow); the ghost's
  // points see-through as its hide is, the charger's burning at its legs
  for (const f of [`horse-cart-and-cargo/Textures/${MOUNT_PREVIEW_FILE}`, ...['1-0', '2-0', '3-0'].map((k) => `eye-of-the-beholder/Textures/112382/112382_${k}.png`)]) {
    const img = picture(f), hide = pictureHide(img), hidden = new Set(hide.at);
    const crest = hide.r0 - Math.ceil(POINT_ABOVE * (hide.r1 - hide.r0 + 1));
    const coat = horseLookCode({ coat: 2, pattern: 0, legs: 0, seed: 5 }), plain = recolorHorse(img, coat, { bottomFirst: false });
    for (const m of MOUNT_LOOKS) {
      const d = recolorHorse(img, withMountLook(coat, m), { bottomFirst: false }), moved = movedOff(img, hidden, d, plain);
      assert.ok(moved.length > 0, `${f} ${m}: its points dyed`);
      assert.ok(moved.every((i) => (i - (i % img.width)) / img.width >= crest), `${f} ${m}: nothing over the crest`);
      const lit = moved.filter((i) => d.colors[i * 4 + 3]).map((i) => hsv(d.colors[i * 4], d.colors[i * 4 + 1], d.colors[i * 4 + 2]));
      if (m === 'spectral') assert.ok(lit.length < moved.length, `${f}: the ghost's points see-through in places`);
      if (m === 'dawnfire') assert.ok(lit.some(([h, , v]) => h < 60 && v > 0.8), `${f}: the charger's far legs burning`);
    }
  }
});

test('AUDIT-STOREFRONT the 3D horse\'s mane and tail: a mount look shades the hair picture as the sprites\' points, HAIR_ROWS a frame and made once a look; a coat wears the art\'s, the Warhorse\'s burns (mutants: the 3D hair the art\'s on every look; a look\'s hair never asked; the Warhorse\'s hair the art\'s)', async () => {
  const made = [];
  const renderer = {
    createSkinnedCharacterMesh: (stream, o) => ({ vao: {}, vbo: {}, count: stream.length / o.floats, floats: o.floats, skin: { tex: {} } }),
    createSkinPalette: () => ({ tex: {} }), releaseCharacterSkin: () => {}, updateSkinPalette: () => {}, releaseCharacterTexture: () => {},
    createCharacterTexture: (mips) => { made.push(mips[0]); return { id: made.length }; },
  };
  const rig = createHorseRig({
    renderer,
    fetchJson: async () => JSON.parse(rd('src/assets/horse/courser.json')),
    fetchBytes: async (u) => new Uint8Array(readFileSync(new URL(u))),
    decode: async (b) => { const p = PNG.sync.read(Buffer.from(b)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; },
  });
  await rig.load();
  const art = made[1], h = rig.horse(1), hairAt = h.mesh.ranges.findIndex((r) => r.part === 'hair');
  assert.ok(hairAt >= 0 && h.mesh.ranges[hairAt].tex.id === 2, 'the art\'s hair, made at load');
  const wear = (look) => { rig.step(h, { feet: [0, 0, 0], yaw: 0, look }); return h.mesh.ranges[hairAt].tex; };
  const coatOnly = horseLookCode({ coat: 2, pattern: 0, legs: 0, seed: 3 });
  assert.equal(wear(coatOnly).id, 2);
  for (let f = 0; f < 16; f++) rig.tick();
  assert.equal(wear(coatOnly).id, 2, 'a coat keeps the art\'s black');   // PIN MOVED (AUDIT-STOREFRONT: the Warhorse's mane burns)
  const ghost = withMountLook(0, 'spectral');
  assert.equal(wear(ghost).id, 2, 'the art\'s until the shade is up');
  for (let f = 0; f < art.height / HAIR_ROWS; f++) rig.tick();
  const tex = wear(ghost);
  assert.notEqual(tex.id, 2, `up in ${art.height / HAIR_ROWS} frames`);
  const shaded = made[tex.id - 1].rgba;
  let n = 0, blue = 0;
  for (let o = 0; o < shaded.length; o += 4) {
    assert.equal(shaded[o + 3], art.rgba[o + 3], 'its alpha the art\'s');
    if (!art.rgba[o + 3]) continue;
    n++;
    const [hh, ss] = hsv(shaded[o], shaded[o + 1], shaded[o + 2]);
    if (hh > 195 && hh < 215 && ss > 0.4) blue++;
  }
  assert.ok(blue > n * 0.95, `the ghost's hair a deep blue (${blue} of ${n})`);
  const count = made.length;
  wear(withMountLook(horseLookCode({ coat: 4, pattern: 1, legs: 2, seed: 9 }), 'spectral'));
  for (let f = 0; f < 16; f++) rig.tick();
  assert.equal(wear(withMountLook(horseLookCode({ coat: 4, pattern: 1, legs: 2, seed: 9 }), 'spectral')).id, tex.id, 'one shade a look, whatever the coat under it');
  assert.ok(made.slice(count).every((m) => m.width !== art.width), 'and no second hair picture made');
  const fire = withMountLook(0, 'warhorse');
  wear(fire);
  for (let f = 0; f < art.height / HAIR_ROWS + 1; f++) rig.tick();
  const burnt = made[wear(fire).id - 1].rgba;
  let lit = 0, all = 0;
  for (let o = 0; o < burnt.length; o += 4) { if (!art.rgba[o + 3]) continue; all++; const [hh, ss] = hsv(burnt[o], burnt[o + 1], burnt[o + 2]); if (hh < 40 && ss > 0.6) lit++; }
  assert.ok(lit > all * 0.95, `the Warhorse's mane burns (${lit} of ${all})`);
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
  // PIN MOVED (the wire audit): each peer's horse with where it stands, for the Others' effects choice
  assert.match(rd('src/net/peer/peerRiders.js'), /horse: peerMountLook\(peer\.id, pose\.rc \| 0, feet\)/);
  assert.match(rd('src/net/peer/peerBodies.js'), /look: peerMountLook\(b\.id, shown\.rc \| 0, f\)/);
  assert.match(rd('src/scenes/horseCartPool.js'), /owner === '' \? ownMountLook\(horseLook\?\.\(\)\) : peerMountLook\(_peers\.get\(owner\)\?\.ownerId \?\? owner, _peers\.get\(owner\)\?\.horseLook \?\? 0, at\)/);
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
  assert.match(rd('src/net/peer/peerFx.js'), /const ridden =\n\s*pose\.rd === POSE_RIDE\.Horse && !pose\.wb && othersEffectShown\(feet\) \? effectWorn\(kit, 'mount'\) : null;/);   // PIN MOVED (the wire audit): by the Others' effects choice
});
