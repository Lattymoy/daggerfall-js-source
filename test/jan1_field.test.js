// JAN1 (2026-09-18, Janome's play report, relayed by Mac) - the four field reports: the hand that switched sides on
// T-then-H, the fist under the torch on a dungeon exit, the townsfolk walking in the sky outside the city, and the
// lantern glare shining through an attic floor. See test/jan1_fixes.test.js for the three crashes.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keyEdges, noteKeyDown, noteKeyUp, beginInputFrame, released, setBindings } from '../src/ui/input.js';
import { createBindings, resetDefaults, DEFAULT_BINDINGS } from '../src/systems/inputActions.js';
import { SHORTCUT_TEXT } from '../src/systems/dialogShortcuts.js';
import { PlayerWeapon, weaponPoseOf, applyWeaponPose } from '../src/combat/playerWeapon.js';
import { weaponTypeForItem, WEAPON_TYPES } from '../src/combat/fpsWeapon.js';
import { blendLocationTerrain } from '../src/world/terrainTiles.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../src/world/terrainSampler.js';
import { tileWeight } from '../src/world/cityNavigation.js';
import { AIR_GLARE_SLACK } from '../src/render/airPass.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** The brace-matched literal after `opener` (comments and strings skipped) - mac1_playreport's literalBody. */
function literalBody(text, opener) {
  const i = text.indexOf(opener); assert.ok(i >= 0, opener);
  const open = text.indexOf('{', i + opener.length); let depth = 0;
  for (let k = open; k < text.length; k++) {
    const c = text[k];
    if (c === '/' && text[k + 1] === '/') { k = text.indexOf('\n', k); continue; }
    if (c === '/' && text[k + 1] === '*') { k = text.indexOf('*/', k) + 1; continue; }
    if (c === '\'' || c === '"' || c === '`') { const q = c; for (k++; k < text.length; k++) { if (text[k] === '\\') k++; else if (text[k] === q) break; } continue; }
    if (c === '{') depth++; else if (c === '}' && --depth === 0) return text.slice(open, k + 1);
  }
  assert.fail(`unclosed ${opener}`);
}
const defaults = () => { const b = createBindings(); resetDefaults(b); return b; };

test('JAN1 (hand): THE RING RELEASES ONLY WHAT IT CAPTURED - a key whose down a window ate (T opens the picker, its H accelerator picks the horse and closes it on the down edge) lands no up on the ring, so SwitchHand, the one action read off the up edge, does not fire; a real press does; a press taken under no window and released under one still lets go; the collision is the reference\'s own two tables', () => {
  setBindings(defaults());
  const keys = new Set();
  // the window ate the down: the up arrives alone
  let e = keyEdges();
  noteKeyUp(e, 'KeyH'); beginInputFrame(e);
  assert.equal(released(e, keys, 'SwitchHand'), false, 'an up with no down of its own is a window\'s, not the player\'s');
  // a real press: down, then up
  e = keyEdges();
  noteKeyDown(e, 'KeyH'); beginInputFrame(e); assert.equal(released(e, keys, 'SwitchHand'), false, 'the down alone releases nothing');
  noteKeyUp(e, 'KeyH'); beginInputFrame(e);
  assert.equal(released(e, keys, 'SwitchHand'), true, 'the player\'s own release fires');
  // a press with no window and a release under one still releases (the mouse's "a window opened mid-swing must still let go")
  e = keyEdges();
  noteKeyDown(e, 'KeyH'); beginInputFrame(e); beginInputFrame(e);
  noteKeyUp(e, 'KeyH'); beginInputFrame(e);
  assert.equal(released(e, keys, 'SwitchHand'), true, 'the down was the ring\'s, so the up is too, whatever is on screen now');
  // auto-repeat notes no down, and so owns no up... but the first down did
  e = keyEdges();
  noteKeyDown(e, 'KeyH'); noteKeyDown(e, 'KeyH', true); noteKeyDown(e, 'KeyH', true); beginInputFrame(e);
  noteKeyUp(e, 'KeyH'); beginInputFrame(e);
  assert.equal(released(e, keys, 'SwitchHand'), true, 'a held key\'s release lands once');
  noteKeyUp(e, 'KeyH'); beginInputFrame(e);
  assert.equal(released(e, keys, 'SwitchHand'), false, 'and a second up with nothing captured is nobody\'s');
  // the collision is DATA: DialogShortcuts.txt's TransportHorse and the default SwitchHand share the letter - the fix may never be "move the letter"
  assert.equal(SHORTCUT_TEXT.TransportHorse, 'H');
  assert.ok(DEFAULT_BINDINGS.some(([code, action]) => code === 'KeyH' && action === 'SwitchHand'), 'DFU\'s own SwitchHand default');
  // the cost of the spurious flip: an empty off-hand makes the weapon null, and a null weapon is WEAPON10.CIF, the fist
  const w = new PlayerWeapon({});
  const sword = { group: 'Weapons', templateIndex: 115, name: 'Longsword' };
  w.updateHands(sword, null); w.applyWeapon();
  assert.equal(w.weapon, sword);
  w.toggleHand({ apply: true });
  assert.equal(w.weapon, null, 'the left hand holds nothing'); assert.equal(weaponTypeForItem(null), WEAPON_TYPES.Melee, 'and nothing draws as the fist');
  const s = rd('src/ui/input.js');
  assert.ok(s.includes("export function noteKeyUp(edges, code) { if (!edges) return; if (edges.own && !edges.own.delete(code)) return; edges.up.add(code); }"), 'one home for the law');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) assert.ok(/noteKeyUp\(latch\.edge, e\.code\)/.test(rd(f)) || /noteKeyUp\(/.test(rd(f)), `${f}: the keyup reaches the ring through noteKeyUp alone`);
});

test('JAN1 (fist): THE POSE IS THE PLAYER\'S, NOT THE RIG\'S - the port has four PlayerWeapons against DFU\'s one WeaponManager; a rig frozen at a left hand with an empty left slot hands the screen back a null weapon (the fist) while the torch, read off the entity, is right; the pair crosses through HARD2c\'s one home, and EVERY door of the interior host carries it', () => {
  const sword = { group: 'Weapons', templateIndex: 115, name: 'Longsword' };
  const dungeon = new PlayerWeapon({}), exterior = new PlayerWeapon({});
  // underground: a fresh rig, the sword drawn in the right hand
  dungeon.updateHands(sword, null); dungeon.sheathed = false; dungeon.applyWeapon();
  assert.equal(dungeon.weapon, sword, 'the sword, drawn');
  // outside: the rig the player left with, frozen at a left hand from a spurious H (the hand report), drawn
  exterior.sheathed = false; exterior.usingRightHand = false;
  exterior.updateHands(sword, null); exterior.applyWeapon();
  assert.equal(exterior.weapon, null, 'the screenshot: a drawn rig with an empty left hand is a null weapon');
  assert.equal(weaponTypeForItem(exterior.weapon), WEAPON_TYPES.Melee, 'which draws WEAPON10.CIF, the fist, under the torch the entity holds');
  // the door: the pair crosses through the one home
  assert.equal(applyWeaponPose(exterior, weaponPoseOf(dungeon)), true);
  exterior.updateHands(sword, null); exterior.applyWeapon();
  assert.equal(exterior.weapon, sword, 'the sword again'); assert.equal(exterior.sheathed, false); assert.equal(exterior.usingRightHand, true);
  assert.equal(applyWeaponPose(exterior, null), false, 'no pose (a rig that was never built) moves nothing');
  // every door of the interior host carries the pair, derived from the host's own function names
  const wm = rd('src/scenes/worldModes.js');
  const body = (name, endAt) => { const i = wm.indexOf(name); assert.ok(i > 0, name); return wm.slice(i, wm.indexOf(endAt, i)); };
  assert.match(body("function tryExit(", "mwViewTransition('Exterior')"), /host\.applyWeaponPose\?\.\(weaponPoseOf\(interiorWeapon\.playerWeapon\)\)/, 'a building\'s exit hands the pair to the exterior rig');
  assert.match(body("function exitDungeonNow()", "mwViewTransition('Exterior')"), /const pose = dungeonPose\(\);[^\n]*\n\s*host\.onDungeonLeave\?\.\(\);[^\n]*\n\s*teardownDungeonQuestFlats\(\);[^\n]*\n\s*dungeonCtx\.destroy\(\);[\s\S]*?host\.applyWeaponPose\?\.\(pose\);/, 'a dungeon\'s exit reads the pair BEFORE the leave hook and the teardown (WORLD1 pins that triple) and hands it over after the mode');
  assert.match(body("forceExitToExterior({ cacheScene = true } = {}) {", "AUDIT 63r F30"), /const pose = mode === 'dungeon' \? dungeonPose\(\) : mode === 'interior' \? weaponPoseOf\(interiorWeapon\.playerWeapon\) : null;[\s\S]*?if \(pose\) host\.applyWeaponPose\?\.\(pose\);/, 'the forced exit (a load, a teleport) the same, from whichever rig is live');
  assert.match(wm, /setMode\('interior'\);\n\s*host\.unlockOn\?\.\(\);[^\n]*\n\s*mwViewTransition\('Interior'\);[^\n]*\n\s*setWeaponPose\(interiorWeapon\.playerWeapon, host\.weaponPose\?\.\(\) \?\? null\);/, 'a building\'s entry seeds the interior rig from the exterior\'s');
  assert.match(wm, /const dungeonPose = \(\) => weaponPoseOf\(dungeonCtx\?\.weaponRig\?\.\(\)\?\.playerWeapon \?\? null\);/, 'the dungeon rig\'s pair has one reader');
  assert.match(wm, /setMode\('dungeon'\);\n\s*host\.unlockOn\?\.\(\);[^\n]*\n\s*mwViewTransition\('Interior'\);[^\n]*\n\s*setWeaponPose\(dungeonCtx\?\.weaponRig\?\.\(\)\?\.playerWeapon \?\? null, host\.weaponPose\?\.\(\) \?\? null\);/, 'a dungeon\'s entry seeds the dungeon rig');
  // DISC8-E: the pair must sit in the bag worldModes READS them from - JAN1 parked them in the inventory window's
  // deps, a text match anywhere in the file passed, and no door ever handed the pose
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const bag = literalBody(rd(f), 'var modes = createWorldModes(');
    assert.match(bag, /\n\s*weaponPose: \(\) => weaponPoseOf\(weaponRig\.playerWeapon\),/, `${f}: host.weaponPose is the createWorldModes bag's`);
    assert.match(bag, /\n\s*applyWeaponPose: \(p\) => applyWeaponPose\(weaponRig\.playerWeapon, p\),/, `${f}: host.applyWeaponPose likewise`);
    const inv = literalBody(rd(f), 'const makeInventoryWindow = (extra = {}) => createInventoryWindow(');
    assert.doesNotMatch(inv, /\bweaponPose:/, `${f}: the inventory window reads no pose - a door parked there is dead`);
  }
  // the asymmetry that made the picture: the torch is read off the ENTITY, the sheath off the RIG
  const rig = rd('src/combat/weaponRig.js');
  assert.ok(rig.includes('fpArm.setTorch(isLitTorch(entity?.lightSource))'), 'the torch is the entity\'s');
  assert.ok(/playerWeapon\.sheathed/.test(rig), 'the sheath is the rig\'s - a door that carries one and not the other is exactly this bug');
});

test('JAN1 (sky): the streaming host grounds a walker on the TERRAIN, not the location\'s average - the navgrid is the block rect, the flattened rect is the stamped tiles plus a clearance and is smaller, and blendLocationTerrain only eases the band between toward the average: a walker there stood metres in the air', () => {
  // Daggerfall city\'s own numbers (terrain.test.js pins the rect at {11,116} over a navgrid of tiles 0..128)
  const rect = { xMin: 11, xMax: 116, yMin: 11, yMax: 116 };
  const hDim = HEIGHTMAP_DIMENSION, worldHeight = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
  const avg = 0.166147;
  const s = new Float32Array(hDim * hDim).fill(avg);
  for (let x = 0; x < hDim; x++) for (let y = 0; y < hDim; y++) s[x * hDim + y] = avg - 0.004443 * Math.max(0, (14 - x) / 14);   // the pixel's edge falls away, as the real one does
  blendLocationTerrain(s, avg, rect);
  assert.ok(Math.abs(s[64 * hDim + 64] - avg) < 1e-6, 'inside the rect the terrain IS the average');
  const drop = (avg - s[0 * hDim + 64]) * worldHeight;
  assert.ok(drop > 8, `tile 0 - inside the navgrid, outside the rect - lies ${drop.toFixed(1)} units below the average a walker was stood at`);
  assert.equal(tileWeight(56), 7); assert.equal(tileWeight(63), 7, 'an unstamped marker tile is walkable, which is how a walker reaches the band');
  const w = rd('src/scenes/world.js');
  assert.equal(/groundY: \(\) => locOrigin\[1\],/.test(w), false, 'no constant groundY for the wandering pool');
  assert.match(w, /groundY: \(x, z\) => \{\s*\n\s*const t = state\.pixelTranslation\(px, py\);\s*\n\s*const h = heightAt\(x \+ locOrigin\[0\] \+ t\[0\], z \+ locOrigin\[2\] \+ t\[2\]\);\s*\n\s*return Number\.isFinite\(h\) \? h - t\[1\] \+ 2\.0 \* 0\.025 : locOrigin\[1\];/, 'the terrain floor, out of the pixel\'s vertical frame, with locOrigin\'s own lift; a pixel not built answers the old constant');
  assert.match(rd('src/scenes/exterior.js'), /groundY: \(x, z\) => collider\.heightAt\(x, z\)/, 'both hosts on one law: the collider\'s floor');
});

test('JAN1 (glare): the lantern glare needs a flame under it AND nothing in front of it - EL7\'s presence rule stands (a city light sits at the top of its flat), and a surface nearer than the light at the light\'s own pixel is an occluder whatever the seven taps found (the half BUGS-5 F4\'s narrowing left)', () => {
  const a = rd('src/render/airPass.js');
  assert.match(a, /return abs\(viewDist\(depthAt\(uv\)\) - lantern\) <= \$\{glslFloat\(AIR_GLARE_SLACK\)\} \? 1\.0 : 0\.0;/, 'EL7: presence, at seven taps');
  assert.match(a, /vec2 cuv = ndc\.xy \* 0\.5 \+ 0\.5;\s*\n\s*if \(cuv == clamp\(cuv, vec2\(0\.0\), vec2\(1\.0\)\) && viewDist\(depthAt\(cuv\)\) < lantern - \$\{glslFloat\(AIR_GLARE_SLACK\)\}\) vis = 0\.0;/, 'and the veto at the light\'s own pixel, after the sum');
  assert.ok(a.indexOf('vec2 cuv = ndc.xy * 0.5 + 0.5;') > a.indexOf(') / 7.0;'), 'the veto reads the sum it zeroes');
  assert.equal(AIR_GLARE_SLACK, 0.25);
  // the geometry, in JS: a lamp 0.6 under an attic floor at 6 units, the eye 1.5 up, pitched down. The seven taps are
  // view-space offsets of +-s and +-2s about the light; an oblique floor sweeps a wide range of depths across them.
  const floorY = 0, lampY = -0.6, eyeY = 1.5, dist = 6, s = 0.25 * Math.sqrt(15) / 2;
  let anyTap = false, allVetoed = true;
  for (let pitchDeg = 5; pitchDeg <= 80; pitchDeg += 1) {
    const p = pitchDeg * Math.PI / 180, c = Math.cos(p), sn = Math.sin(p);
    // the eye at the origin pitched DOWN by p: forward f = (0, -sin, -cos), up u = (0, cos, -sin); GL view space has
    // the scene at negative z. A world point relative to the eye (Y, Z) reads vy = Y cos - Z sin, vz = Y sin + Z cos.
    const Y = lampY - eyeY, Z = -dist;
    const L = { vy: Y * c - Z * sn, vz: Y * sn + Z * c }; const lantern = -L.vz;
    // a view point (vx, vy, vz) is the world direction vx r + vy u + (-vz) f; the ray meets the floor plane
    // Y_rel = floorY - eyeY where its world-y component Dy = vy cos + vz sin is heading down; the planar depth of the
    // hit is t * lantern (view z scales with t). A ray that never comes down meets the sky.
    const floorDepthAt = (vy, vz) => { const Dy = vy * c + vz * sn; if (!(Dy < 0)) return Infinity; const t = (floorY - eyeY) / Dy; return t * (-vz); };
    const taps = [[0, 0], [0, s], [0, 2 * s], [0, -s], [0, -2 * s], [s, 0], [-s, 0]].map(([, dy]) => floorDepthAt(L.vy + dy, L.vz));
    const tapHits = taps.filter((d) => Number.isFinite(d) && Math.abs(d - lantern) <= AIR_GLARE_SLACK).length;
    if (tapHits > 0) { anyTap = true; if (!(taps[0] < lantern - AIR_GLARE_SLACK)) allVetoed = false; }
  }
  assert.ok(anyTap, 'some pitch lands a tap within the slack of the lamp\'s depth through the floor - the bug exists');
  assert.ok(allVetoed, 'and at every such pitch the floor at the light\'s own pixel is nearer than the light by more than the slack - the veto kills it');
});
