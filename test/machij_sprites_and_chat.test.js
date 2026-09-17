// ---------------------------------------------------------------------------
// MAC-H + MAC-I + MAC-J - THREE NOTES ON THE CLASSIC LANE (2026-09-17).
//
// Mac:
//   1. "On the classic sprite, when a torch is unequipped, a random sprite is
//      shown on the left middle of the screen"
//   2. "The classic sprite should react to lighting (first person)"
//   3. "The online section where player's names are shown are too large and
//      shouldn't be large rectangles" - the chat window's roster column.
//
// MAC-H is a gate that was never written: the torch hand's OnGUI asked "is
// there a texture" and `currentTexture` is set once, to frame 0, the moment
// the sprites load - so a hand holding nothing drew a torch at the guard
// position, which is the left middle of the screen.
//
// MAC-I is a channel DFU declares and leaves white: `FPSWeapon.Tint`
// (FPSWeapon.cs:108) is handed to the draw (:182) and nothing in DFU core
// writes it - that is the First-Person Lighting mod's job. The port writes it
// from the light the room's own FLATS take.
//
// MAC-J is a CSS collision. The chat's roster marked a clickable name with a
// bare `act`, and `.act` is the enhanced skin's BUTTON - 12px/20px padding, a
// border and a 46px floor - which is loaded in every online game because
// online forces the enhanced lane. Every name a player could click was drawn
// as a button-sized rectangle; the one name that is never a door, your own,
// stayed 16px high beside them.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR } from '../src/systems/handheldTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { Renderer, FLAT_LIGHT_FLOOR, STUDIO_AMBIENT, STUDIO_KEY } from '../src/render/renderer.js';
import { fpLightingOn } from '../src/combat/fpsWeapon.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../src/systems/features.js';
import { CHAT_CSS } from '../src/ui/chatPanel.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { TEMPLATES } from '../src/systems/useItem.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** studioLight reads the view matrix's third row for the key's direction. */
const IDENTITY_VIEW = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// ---- MAC-H: the torch hand ------------------------------------------------

/** The mod's own shipped defaults, as ht6_offhand's harness takes them - a
 *  hand-written subset would be readTorchSettings reading undefined. */
const MOD_DEFAULTS = () => Object.fromEntries(
  Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default]));
/** The component, its sprites loaded, with a renderer that RECORDS its draws. */
async function torchRig() {
  const drawn = [];
  const renderer = {
    uploadTexture: (a, k) => ({ key: k }),
    drawScreenQuad: (tex, dst, src, color) => drawn.push({ tex, dst, src, color }),
  };
  const entity = { items: [], lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const h = createHandheldTorches({
    settings: () => readTorchSettings(() => ({ ...MOD_DEFAULTS(), 'Modules.Sprite': true })),
    audio: { playOneShot: () => {}, loop: () => ({ stop() {} }), play3d: () => {} },
    torches: () => null, handedness: () => false,
    // four torch frames and four lantern frames, as the mod ships
    loadSprite: async (record, frame) => (frame < 4 ? { width: 32, height: 32, colors: new Uint8Array(4) } : null),
  });
  const canvas = { width: 640, height: 400 };
  const ctx = {
    renderer, canvas, entity, machine: { state: 'Idle' }, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false,
    transformedLycanthrope: false, look: [0, 0], swingHeld: false, cursorActive: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] },
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, keyDown: () => false, sheathWeapons: () => {},
  };
  const frame = (dt = 0.016) => { h.update(dt, ctx); h.lateUpdate(dt, ctx); };
  frame();
  await new Promise((r) => setTimeout(r, 5));   // InitializeTextures is async, and it is what sets currentTexture
  frame();
  return { h, ctx, entity, renderer, canvas, drawn, frame };
}
const item = (templateIndex) => ({ templateIndex, group: 'UselessItems2', currentCondition: 20, maxCondition: 20 });

test('MAC-H: an empty hand draws NOTHING, and the sprites are loaded when it does not', async () => {
  const r = await torchRig();
  // the premise the bug rode on: the textures ARE there, and the component is
  // holding one as `currentTexture` - so "no texture" was never the gate.
  assert.ok(r.h._w.textures.length >= 8, 'the torch and lantern frames loaded');
  assert.ok(r.h._w.currentTexture?.tex, 'and one of them is the current texture, as it has been since the load');
  assert.equal(r.h.draw(r.renderer, r.canvas), false, 'nothing in the hand, nothing on the screen');
  assert.equal(r.drawn.length, 0);
});

test('MAC-H: a torch draws, a lantern draws, a CANDLE does not', async () => {
  const r = await torchRig();
  const torch = item(TEMPLATES.Torch);
  r.entity.items.push(torch); r.entity.lightSource = torch;
  r.frame();
  assert.equal(r.h.draw(r.renderer, r.canvas), true, 'a torch in the hand is a torch on the screen');
  assert.equal(r.drawn.length, 1);

  const lantern = item(TEMPLATES.Lantern);
  r.entity.lightSource = lantern;
  r.frame();
  assert.equal(r.h.draw(r.renderer, r.canvas), true);

  // A CANDLE is a light source with no frames - the mod ships sprites for the
  // torch (record 0) and the lantern (record 1) and for nothing else, which is
  // what `offsetFrame === -1` says in the frame law.
  const candle = item(TEMPLATES.Candle);
  r.entity.lightSource = candle;
  r.frame();
  assert.equal(r.h.draw(r.renderer, r.canvas), false, 'a candle has no sprite, so it draws none');
});

test('MAC-H: the sprite goes the moment the torch leaves the hand', async () => {
  const r = await torchRig();
  const torch = item(TEMPLATES.Torch);
  r.entity.items.push(torch); r.entity.lightSource = torch;
  r.frame();
  assert.equal(r.h.draw(r.renderer, r.canvas), true);
  r.entity.lightSource = null;   // unequipped - the whole of Mac's report
  assert.equal(r.h.draw(r.renderer, r.canvas), false, 'no frame in between: the draw asks the LIGHT, not a latch Update sets');
});

test('MAC-I: the torch hand takes the tint, and white when nobody hands one', async () => {
  const r = await torchRig();
  const torch = item(TEMPLATES.Torch);
  r.entity.items.push(torch); r.entity.lightSource = torch;
  r.frame();
  r.h.draw(r.renderer, r.canvas, [0.4, 0.3, 0.2]);
  assert.deepEqual(r.drawn.at(-1).color, [0.4, 0.3, 0.2]);
  r.h.draw(r.renderer, r.canvas);
  assert.equal(r.drawn.at(-1).color, undefined, 'no tint is the renderer’s own default, which is white');
});

// ---- MAC-I: the light a flat takes --------------------------------------

/** `flatLightAt` reads renderer STATE and nothing else, so it is driven here
 *  over a state object rather than a GL context - the same state a host sets
 *  through setLighting/setPointLights/setIndirectLight. The browser probe
 *  (tools/macfpLightProbe.mjs) drives the real Renderer and reads the pixel
 *  back; this pins the arithmetic. */
function lightState(over = {}) {
  return {
    _clockLit: true, _ambient: [0, 0, 0], _moonColor: [0, 0, 0], _moonScale: 0,
    _sunColor: [0, 0, 0], _sunScale: 0, _camPos: [0, 0, 0],
    _pointLights: new Float32Array(0), _pointColors: null, _pointColor: [1, 1, 1],
    _pointColorScratch: new Float32Array(48), _lane: null,
    _indirect: [0, 0, 0, 0], _indirectColor: [0, 0, 0],
    _pointColorData: Renderer.prototype._pointColorData,
    ...over,
  };
}
const lightAt = (state, pos) => Renderer.prototype.flatLightAt.call(state, pos);

test('MAC-I: the flat’s four terms, and no fifth', () => {
  // a scene with no clock draws its flats full bright, and so does the sprite
  assert.deepEqual(lightAt(lightState({ _clockLit: false }), [0, 0, 0]), [1, 1, 1]);

  // ambient + the sun's Lambert-average HALF + the moon's half - the billboard
  // program's own uTint/uBBSun composition
  const day = lightAt(lightState({ _ambient: [0.4, 0.4, 0.4], _sunColor: [0.6, 0.6, 0.6], _sunScale: 1 }), [0, 0, 0]);
  assert.deepEqual(day, [0.7, 0.7, 0.7]);
  const night = lightAt(lightState({ _ambient: [0.3, 0.3, 0.3], _moonColor: [0.2, 0.2, 0.2], _moonScale: 1 }), [0, 0, 0]);
  assert.deepEqual(night, [0.4, 0.4, 0.4]);

  // a point light with the SQUARED linear falloff the flats take: at half the
  // range it is a quarter of the colour
  const torch = lightState({
    _ambient: [0, 0, 0],
    _pointLights: new Float32Array([0, 0, 4, 8]), _pointColors: new Float32Array([1, 1, 1]),
  });
  assert.deepEqual(lightAt(torch, [0, 0, 0]), [0.25 + 0, 0.25, 0.25].map((v) => Math.max(v, FLAT_LIGHT_FLOOR)));
  assert.deepEqual(lightAt(torch, [0, 0, 8]), [FLAT_LIGHT_FLOOR, FLAT_LIGHT_FLOOR, FLAT_LIGHT_FLOOR], 'at the range it is not there at all');
  // AND BEYOND IT, which is the arm the clamp exists for: an unclamped
  // attenuation goes NEGATIVE past the range and the SQUARE makes it
  // positive again, so a lamp at twice its range would light the hand as
  // brightly as one at the wick.
  assert.deepEqual(lightAt(torch, [0, 0, 20]), [FLAT_LIGHT_FLOOR, FLAT_LIGHT_FLOOR, FLAT_LIGHT_FLOOR], 'and a long way past it, squared or not');

  // the indirect term rides the same shape
  const indirect = lightState({ _indirect: [0, 0, 0, 10], _indirectColor: [0.5, 0, 0] });
  assert.ok(lightAt(indirect, [0, 0, 0])[0] > lightAt(indirect, [0, 0, 0])[2]);

  // the colour is the LIGHT's: a turquoise lamp tints the hand turquoise
  const lamp = lightState({ _pointLights: new Float32Array([0, 0, 0, 8]), _pointColors: new Float32Array([0.68, 1, 0.94]) });
  const lit = lightAt(lamp, [0, 0, 0]);
  assert.ok(lit[1] > lit[0] && lit[2] > lit[0]);
});

test('MAC-I: the floor and the ceiling', () => {
  // A FLOOR, because a hand at zero is a hole in the middle of the screen and
  // the player cannot tell a drawn weapon from a sheathed one.
  assert.deepEqual(lightAt(lightState({ _ambient: [0, 0, 0] }), [0, 0, 0]),
    [FLAT_LIGHT_FLOOR, FLAT_LIGHT_FLOOR, FLAT_LIGHT_FLOOR]);
  assert.ok(FLAT_LIGHT_FLOOR > 0 && FLAT_LIGHT_FLOOR < 0.5);
  // ...and a caller may ask for none, which is what a test or a probe wants
  assert.deepEqual(Renderer.prototype.flatLightAt.call(lightState(), [0, 0, 0], 0), [0, 0, 0]);
  // A CEILING at 1: a tint is a multiplier on the sprite's own albedo, and
  // above 1 it stops being the room's light and starts being a bloom.
  const blazing = lightState({ _ambient: [3, 3, 3] });
  assert.deepEqual(lightAt(blazing, [0, 0, 0]), [1, 1, 1]);
  // the camera is the default point, because that is where a first-person sprite is
  const state = lightState({ _camPos: [0, 0, 0], _pointLights: new Float32Array([0, 0, 2, 8]), _pointColors: new Float32Array([1, 1, 1]) });
  assert.deepEqual(Renderer.prototype.flatLightAt.call(state), lightAt(state, [0, 0, 0]));
});

test('MAC-I: the switch, and every sprite in the seam wearing the tint', () => {
  // the switch is the port's own shape: a pref and a kill door
  assert.equal(fpLightingOn(''), true, 'on by default, because a hand that ignores the dark is what was reported');
  assert.equal(fpLightingOn('?fplight=off'), false);
  assert.equal(FEATURE_PREF_DEFAULTS.firstPersonLighting, true);
  const row = FEATURES.find((f) => f.id === 'first-person-lighting');
  assert.ok(row, 'and it is a row on the Features home, not a hidden constant');
  assert.equal(row.control.key, 'firstPersonLighting');
  assert.deepEqual([...row.kinds], ['enhanced', 'classic'], 'the CLASSIC skin draws this sprite too');

  const rig = read('src/combat/weaponRig.js');
  // ONE read a frame, above the draws, so the four sprites cannot disagree
  assert.match(rig, /const fpTint = fpLightingOn\(\) \? \(renderer\?\.flatLightAt\?\.\(\) \?\? null\) : null;/);
  assert.match(rig, /drawSpellCastHands\(renderer, c, spellArtFor\(fpsSpellCasting\.element\), fpsSpellCasting\.frameIndex, \{ tint: fpTint \}\)/);
  assert.match(rig, /handheld\.draw\(renderer, c, fpTint\)/);
  assert.match(rig, /widget\.draw\(renderer, c, fpTint\)/);
  assert.match(rig, /drawFpsWeapon\(renderer, c, art, playerWeapon\.machine\.state, playerWeapon\.machine\.frame, \{ tint: fpTint \}\)/);
  // and each draw passes it THROUGH to the quad rather than accepting and dropping it
  assert.match(read('src/combat/fpsWeapon.js'), /renderer\.drawScreenQuad\(tex, \{ x, y, w, h \}, src, tint \?\? undefined\);/);
  assert.match(read('src/combat/weaponWidget.js'), /renderer\.drawScreenQuad\(tex, getWeaponRect\(\), w\.curAnimRect, tint \?\? undefined\);/);
  assert.match(read('src/combat/fpsSpellCasting.js'), /renderer\.drawScreenQuad\(rec\.tex, right, RIGHT_HAND_UV, tint \?\? undefined\);/);
  // the Morrowind arms are a LIT MESH and are not in this seam at all
  const seam = rig.slice(rig.indexOf('const fpTint ='), rig.indexOf('drawFpsWeapon('));
  assert.doesNotMatch(seam, /fpArm\.draw\(c, fpTint\)/, 'the 3D arms take the world’s light already');
});

// ---- MAC-P: the Morrowind arm's own light -------------------------------

test('MAC-P: the viewmodel light is borrowed, installed and RETURNED', () => {
  // The arm is drawn at the ORIGIN of a camera-local space while the room's
  // point lights are in world space, so it has only ever had the ambient and
  // the sun - "consistently dark", which is exactly what a dungeon's ambient
  // is. The borrow installs the STUDIO's shape scaled by the room's own light
  // and puts every value back, the same shape PX23's UI studio has.
  const seen = [];
  const own = {
    lightDir: new Float32Array([0, 1, 0]), ambient: new Float32Array([0.02, 0.02, 0.02]),
    sunColor: new Float32Array([0.1, 0.1, 0.1]), pointLights: new Float32Array(8), indirect: new Float32Array(4),
  };
  const frame = {
    _lightDir: own.lightDir, _ambient: own.ambient, _sunScale: 3, _sunColor: own.sunColor,
    _pointLights: own.pointLights, _indirect: own.indirect, _moonScale: 7,
    _renderCharacterSprite(mesh, model, proj, view, pw, ph, opts) {
      seen.push({
        ambient: [...this._ambient], sunScale: this._sunScale, sunColor: [...this._sunColor],
        points: this._pointLights.length, moonScale: this._moonScale, lensLocal: opts.lensLocal,
      });
      return 'tex';
    },
  };
  const call = (light) => Renderer.prototype.renderCharacterSprite.call(
    frame, null, null, null, IDENTITY_VIEW, 32, 32, { lensLocal: true, viewmodelLight: light });
  const near = (a, b) => assert.ok(a.every((v, i) => Math.abs(v - b[i]) < 1e-6), `${a} vs ${b}`);

  assert.equal(call([1, 1, 1]), 'tex');
  const noon = seen.at(-1);
  near(noon.ambient, [STUDIO_AMBIENT, STUDIO_AMBIENT, STUDIO_AMBIENT]);   // at full light: the studio, byte for byte
  assert.equal(noon.sunScale, STUDIO_KEY);
  near(noon.sunColor, [1, 1, 1]);
  assert.equal(noon.points, 0, 'world-space lights have no meaning at this origin');
  assert.equal(noon.moonScale, 0);
  assert.equal(noon.lensLocal, true, 'and the flag the caller asked for is passed through');

  call([0.25, 0.25, 0.5]);
  const dark = seen.at(-1);
  near(dark.ambient, [STUDIO_AMBIENT * 0.25, STUDIO_AMBIENT * 0.25, STUDIO_AMBIENT * 0.5]);
  near(dark.sunColor, [0.25, 0.25, 0.5]);   // the KEY carries the room's colour, so a torch warms the arm

  // EVERY value back - the SAME objects, not copies of them
  assert.equal(frame._lightDir, own.lightDir);
  assert.equal(frame._ambient, own.ambient);
  assert.equal(frame._sunColor, own.sunColor);
  assert.equal(frame._pointLights, own.pointLights);
  assert.equal(frame._indirect, own.indirect);
  assert.equal(frame._sunScale, 3);
  assert.equal(frame._moonScale, 7);

  // and with no light nothing is installed at all: the frame's own state draws
  call(null);
  const off = seen.at(-1);
  near(off.ambient, [...own.ambient]);
  assert.equal(off.sunScale, 3);
  assert.equal(off.moonScale, 7);
});

test('MAC-P: the borrow survives a throw, because a leaked studio is permanent', () => {
  const frame = {
    _lightDir: 'd', _ambient: 'a', _sunScale: 1, _sunColor: 's', _pointLights: 'p', _indirect: 'i', _moonScale: 2,
    _renderCharacterSprite() { throw new Error('the mesh went'); },
  };
  assert.throws(() => Renderer.prototype.renderCharacterSprite.call(
    frame, null, null, null, IDENTITY_VIEW, 8, 8, { viewmodelLight: [1, 1, 1] }), /the mesh went/);
  assert.equal(frame._ambient, 'a');
  assert.equal(frame._sunColor, 's');
  assert.equal(frame._moonScale, 2);
});

test('MAC-P: the arm asks for the same light the sprites do, through the same switch', () => {
  const arm = read('src/combat/fpArm.js');
  assert.match(arm, /const vmLight = fpLightingOn\(\) \? \(renderer\.flatLightAt\?\.\(\) \?\? null\) : null;/);
  assert.match(arm, /renderCharacterSprite\(mesh, NIF_TO_PASS, proj, view, pw, ph, \{ lensLocal: true, viewmodelLight: vmLight \}\)/);
  assert.match(arm, /import \{ fpLightingOn \} from '\.\/fpsWeapon\.js';/,
    'one switch, not two - the sprite lane and the arm lane are the same setting');
  // the UI read-back keeps its OWN studio: a picture on a panel is not in the room
  const rend = read('src/render/renderer.js');
  assert.match(rend, /renderCharacterSpriteImage\(mesh, modelMatrix, proj, view, pw, ph, \{ studio = true \} = \{\}\)/);
  assert.match(rend, /this\.renderCharacterSprite\(mesh, modelMatrix, proj, view, pw, ph\);/,
    'and it goes through the wrapper with NO viewmodel light, so the two never compose');
});

// ---- MAC-J: a name is not a button --------------------------------------

test('MAC-J: no class this sheet writes is a bare selector in the enhanced sheet', () => {
  const src = read('src/ui/chatPanel.js');
  const used = new Set();
  for (const m of src.matchAll(/el\(\s*'[a-z0-9]+'\s*,\s*[`']([^`'$]*)[`']/g)) {
    for (const c of m[1].split(/\s+/)) if (c) used.add(c);
  }
  // the appended state fragments too - `' dfchat-act'`, `' me'`, `' mine'`
  for (const m of src.matchAll(/\+ \(\w[\w.?!=' ]*\? '([^']+)' : ''\)/g)) {
    for (const c of m[1].split(/\s+/)) if (c) used.add(c);
  }
  assert.ok(used.has('dfchat-act'), 'the roster’s door marker is in the set this pin walks');
  assert.ok(used.size > 10, `found ${used.size} classes`);

  const collide = [...used].filter((c) => new RegExp(`(^|[\\s,>])\\.${c}(?=[\\s,{:.\\[])`, 'm').test(ENHANCED_CSS));
  assert.deepEqual(collide, [],
    'a class this sheet writes is also a bare selector in the enhanced skin, which is loaded over it in every online game');
});

test('MAC-J: the roster row is a row, and the enhanced button is still a button', () => {
  // the marker carries the sheet's prefix...
  assert.match(read('src/ui/chatPanel.js'), /\(acts \? ' dfchat-act' : ''\)/);
  assert.match(CHAT_CSS, /\.dfchat-who-row\.dfchat-act \{ cursor: pointer; \}/);
  assert.doesNotMatch(CHAT_CSS, /\.dfchat-who-row\.act\b/);
  // ...and the thing it used to collide with is untouched: 46px, bordered, padded
  assert.match(ENHANCED_CSS, /\.act \{\s*padding: 12px 20px; border: 1px solid var\(--iron\); color: var\(--dim\);[\s\S]{0,80}min-height: 46px;/);
  // the FINGER's row keeps its 44px - a pixel face is not a reason to shrink a target (AUDIT SOC C8)
  assert.match(CHAT_CSS, /\.dfchat\.touch \.dfchat-who-row\.dfchat-act \{ min-height: 44px;/);
});

test('MAC-I + MAC-J: the claims a node test cannot make are the probes’', () => {
  // THE TINT REACHES THE SCREEN THROUGH ONE CHANNEL - drawScreenQuad's
  // `color` - and no source sweep can say whether that channel does anything.
  // tools/macfpLightProbe.mjs builds a REAL Renderer on a real canvas, lights
  // it the way a host does, draws a white texel under the tint and reads the
  // pixel back: a quarter tint is 64/255 on screen, and a torch's colour
  // arrives as colour.
  const light = read('tools/macfpLightProbe.mjs');
  assert.match(light, /new Renderer\(canvas\)/);
  assert.match(light, /gl\.readPixels/);
  assert.match(light, /a quarter tint really is a quarter on screen/);
  assert.match(light, /a black room lands on the floor, not on nothing/);
  // MAC-P is measured the same way, through the arm's own call: the defect
  // (5/255 in a dark room), the fix, and the frame's light surviving the borrow
  assert.match(light, /createCharacterMesh/);
  assert.match(light, /viewmodelLight: light/);
  assert.match(light, /the old path is nearly black in a dark room/);
  // and the chat panel's own measurement is a mounted panel in a browser
  const chat = read('tools/macjRosterProbe.mjs');
  assert.match(chat, /createChatPanel/);
  assert.match(chat, /getBoundingClientRect/);
  assert.match(chat, /injectEnhancedStyle/, 'the enhanced sheet is LOADED over it - without that sheet there is no collision to measure');
});

// ---- MAC-Q: the flame that is not there ---------------------------------

test('MAC-Q: the Morrowind mesh path draws TRIANGLES, and a particle flame is not one', () => {
  // Mac, same message: "and the torch doesn't emit fire". This is not a
  // torch bug and not a light bug - MW-TORCH placed the mesh and MW-D51
  // lights it. It is that THIS PORT HAS NEVER DRAWN A MORROWIND PARTICLE
  // SYSTEM, and a Morrowind torch's flame is one.
  //
  // The parser reads them whole - NiAutoNormalParticles, its data, and
  // NiParticleSystemController's emitter terms are all in mwNifFile.js - and
  // the flattener then walks NiBSParticleNode as a NODE and emits nothing
  // from it, because only NiTriShape and NiTriStrips are geometry. So the
  // flame is read off the disk, carried through the graph, and dropped.
  //
  // NOT FIXED HERE, and this pin is the record rather than a law anybody
  // should keep: what it would take is osgParticle's own shape - the
  // emitter off NiParticleSystemController (rate, lifetime, speed, the
  // emitter node's own frame), the modifier chain (grow/fade, colour,
  // gravity, collider), a billboarded quad per particle and a sorted
  // additive pass - and it cannot be verified in this container at all,
  // which has no Morrowind data on it. Guessing at a flame and shipping it
  // unverified is what MAC-B was refused for.
  const mesh = read('src/formats/mwNifMesh.js');
  assert.match(mesh, /const GEOMETRY_TYPES = new Set\(\['NiTriShape', 'NiTriStrips'\]\);/);
  assert.match(mesh, /'NiBSParticleNode',/, 'the particle node is recursed into as a node...');
  const file = read('src/formats/mwNifFile.js');
  assert.match(file, /NiAutoNormalParticles\(s, rec\)/, '...and its records are parsed in full');
  assert.match(file, /NiAutoNormalParticlesData: readParticlesData,/);
  // and the emission channel is NOT the gap: a flame authored as a TRIANGLE
  // with LightMode_Emissive has drawn correctly since MWT2
  assert.match(read('src/combat/fpArm.js'), /const \[er, eg, eb\] = emissiveAt\(mat, cols, idx\[i \+ k\]\);/);
});
