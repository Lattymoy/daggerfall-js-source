// THE 2026-09-04 CEILING BATS INCIDENT, pinned. Mac: "In the first
// dungeon I notice some bat enemies stuck in the ceiling." Three laws:
//
//   1. WHERE THE MARKER IS. RDBLayout.cs:1537 stands the enemy
//      TRANSFORM on the flat marker, and the mobile billboard hangs on
//      it with localPosition zero (DaggerfallMobileUnit.cs:407-410 for
//      a Flying/Aquatic unit): the marker is the sprite's CENTRE. The
//      port's motor keeps FEET and its shader bottom-anchors, so a bat
//      whose feet were put on the marker stood half a sprite too high -
//      into the ceiling. :1546-1548 ground-aligns everything else, so
//      only a FLYING unit takes the centre-to-feet drop (C12 had read
//      the motor's CanFly = Flying|Spectral here, and a ghost grounds).
//   2. THE CAPSULE. SetupDemoEnemy.cs:103-115 sizes the controller from
//      the idle sprite, halves a flyer's ("assume body is the lower
//      half", bottom-justified), and floors it at 1.6. Every foe wore
//      the player's 1.8, so the motor's ceiling and door probes were
//      the wrong height for a bat and a giant alike.
//   3. THE DRAW. A walker keeps its feet aligned across records
//      (:402-406); a flyer or swimmer keeps its centre. The draw origin
//      is feet for one and centre - recordH/2 for the other.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enemyControllerHeight, idleSpriteHeight, feetFromCentre, centreFromFeet, spriteOriginY, keepRebuiltSpawn } from '../src/characters/enemyAnchor.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { Collider } from '../src/player/collider.js';
import { CAPSULE_HEIGHT } from '../src/player/motor.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('bats 2: SetupDemoEnemy.cs:103-115 - sprite height, halved for a flyer, never under 1.6', () => {
  assert.equal(enemyControllerHeight(2.4, 'General'), 2.4, 'a walker wears its idle sprite');
  assert.equal(enemyControllerHeight(2.4, 'Flying'), 1.6, '2.4 halved is 1.2, floored to 1.6');
  assert.equal(enemyControllerHeight(4.0, 'Flying'), 2.0, 'a big flyer keeps half');
  assert.equal(enemyControllerHeight(0.9, 'General'), 1.6, 'a rat is not walked upon');
  assert.equal(enemyControllerHeight(2.4, 'Spectral'), 2.4, 'only Flying halves (:108)');
  assert.equal(enemyControllerHeight(2.4, 'Aquatic'), 2.4);
});

test('bats 1: the idle sprite height is record 0 scaled, and the flyer\'s feet sit half of it under the marker', () => {
  const t = { getSize: () => ({ width: 40, height: 60 }), getScale: () => ({ width: 0, height: 0 }) };
  const h = idleSpriteHeight(t);
  assert.ok(near(h, 60 * GLOBAL_SCALE), `record 0 at GlobalScale: ${h}`);
  assert.deepEqual(feetFromCentre([1, 10, 2], 2), [1, 9, 2]);
});

test('bats 3: a flyer or swimmer keeps its CENTRE across records; a walker its feet', () => {
  // idle 2.0 tall, a wing-beat record 2.4: the flyer's origin drops 0.2
  assert.ok(near(spriteOriginY(5, 2.0, 2.4, 'Flying'), 4.8));
  assert.ok(near(spriteOriginY(5, 2.0, 2.4, 'Aquatic'), 4.8));
  assert.ok(near(spriteOriginY(5, 2.0, 2.4, 'General'), 5), 'DaggerfallMobileUnit.cs:402-406: feet stay put');
  assert.ok(near(spriteOriginY(5, 2.0, 2.4, 'Spectral'), 5));
  assert.ok(near(spriteOriginY(5, 2.0, 2.0, 'Flying'), 5), 'the idle record itself sits on the feet');
});

test('bats 2: the motor hands the collider ITS capsule height, not the player\'s', () => {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const c = new Collider(() => -100);
  c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I);
  const heights = [];
  const realMove = c.move.bind(c);
  c.move = (feet, dx, dy, dz, height, snap) => { heights.push(height); return realMove(feet, dx, dy, dz, height, snap); };
  const ai = new EnemyAI(c, [0, 0.5, 0], 0, { liveSpeed: 50, height: 2.5 });
  assert.equal(ai.height, 2.5);
  ai.update(1 / 60, [0, 0, 30]);   // gravity alone moves a foe that has not yet grounded
  assert.ok(heights.length > 0, 'the step moved through the collider');
  assert.ok(heights.every((h) => h === 2.5), `every move carried 2.5, not ${CAPSULE_HEIGHT}: ${heights}`);
  // ...and the default is still the shared capsule for a caller that names none
  const d = new EnemyAI(c, [0, 0.5, 0], 0, { liveSpeed: 50 });
  assert.equal(d.height, CAPSULE_HEIGHT);
});

test('bats 2: every collider.move in both motors passes this.height', () => {
  for (const f of ['src/characters/enemyMotor.js', 'src/ai/enhancedMotor.js']) {
    const s = src(f);
    const sites = [...s.matchAll(/this\.collider\.move\(this\.feet,[^;]*\);/g)].map((m) => m[0]);
    assert.ok(sites.length >= 1, `${f} moves through the collider`);
    for (const site of sites) assert.match(site, /, this\.height\);$/, `${f}: ${site}`);
  }
  assert.equal([...src('src/characters/enemyMotor.js').matchAll(/this\.collider\.move\(/g)].length, 6, 'the six motor sites');
});

test('bats 1: both spawn hosts build the capsule from the idle sprite and drop a FLYER from centre to feet', () => {
  const d = src('src/scenes/dungeonContext.js');
  // the monster branch: only Flying skips the ground align (RDBLayout.cs:1546-1548)
  assert.match(d, /const pos = behaviour === 'Flying' \? feetFromCentre\(\[e\.x, e\.y, e\.z\], idleH\) : D\.floorLanding\(collider, \[e\.x, e\.y \+ 0\.2, e\.z\]\);/);
  assert.doesNotMatch(d, /const canFly = behaviour === 'Flying' \|\| behaviour === 'Spectral';/, 'a Spectral grounds at the layout');
  assert.equal([...d.matchAll(/height: enemyControllerHeight\(idleH, /g)].length, 2, 'the class and monster branches both size the capsule');
  assert.equal([...d.matchAll(/gender: e\.gender, idleH \}\);/g)].length, 2, 'both records carry the idle height for the draw');
  assert.match(d, /o\[1\] = spriteOriginY\(f\.ai\.feet\[1\], f\.idleH, sz\.h, _bh\);/, 'the dungeon draw pins a flyer\'s centre');
  const x = src('src/scenes/exteriorFoes.js');
  // REVIEW 2026-09-05: a DELTA on the live pending array (offsetAll may
  // have recentred it during the awaits), gated off for a restore whose
  // position already IS feet.
  assert.match(x, /const idleH = idleSpriteHeight\(tex\);\n(?:\s+\/\/[^\n]*\n)*\s+if \(behaviour === 'Flying' && !feetGiven\) pending\.feet\[1\] -= idleH \/ 2 \+ 0\.1;\n\s+const ai = new EnemyAI\(/,
    'the exterior pool reads the sprite BEFORE the AI stands, and drops a flyer from FinalizeFoe\'s lifted centre as a delta');
  assert.match(x, /spawnFoe\(sf\.mobileType, \[lx, sf\.y \+ yOffset, lz\], \{ gender: sf\.gender, feetGiven: true \}\)/, 'restoreWorld hands back FEET and says so - no second drop per load');
  assert.match(x, /height: enemyControllerHeight\(idleH, behaviour\),/);
  assert.match(x, /org\[1\] = spriteOriginY\(f\.ai\.feet\[1\], f\.idleH, sz\.h, _bh\);/, 'the exterior draw pins a flyer\'s centre');
  // the epoch guard still stands between the texture await and the AI
  const guard = x.indexOf('if (gen !== epoch) return null;');
  assert.ok(guard > x.indexOf('const tex = await getTexture(archive);') && guard < x.indexOf('const ai = new EnemyAI('),
    'AUDIT-39r: a sweep across the texture await still cancels the spawn before anything stands');
});

// ---------------------------------------------------------------------------
// REVIEW 2026-09-05 (the PR #55 adversarial round): the laws the first cut
// missed - DFU's TRANSFORM is the sprite centre, and every position the
// motor measures against it, every position a re-stand or a save hands
// back, and every capsule the player's hit laws test, must say so.
// ---------------------------------------------------------------------------

test('bats review: centreFromFeet is feetFromCentre\'s inverse; keepRebuiltSpawn recognises a pre-fix save', () => {
  assert.deepEqual(centreFromFeet([1, 9, 2], 2), [1, 10, 2]);
  assert.deepEqual(feetFromCentre(centreFromFeet([3, 4, 5], 2.4), 2.4), [3, 4, 5]);
  // an un-stamped Flying entry whose feet sit exactly at the old marker
  // (= the rebuilt feet + idleH/2): keep the rebuilt spawn
  assert.equal(keepRebuiltSpawn({ feet: [1, 11.2, 2] }, [1, 10, 2], 2.4, 'Flying'), true);
  assert.equal(keepRebuiltSpawn({ feet: [1, 11.2, 2], anchor: 1 }, [1, 10, 2], 2.4, 'Flying'), false, 'a stamped save restores verbatim');
  assert.equal(keepRebuiltSpawn({ feet: [1, 11.2, 2] }, [1, 10, 2], 2.4, 'General'), false, 'a walker restores verbatim');
  assert.equal(keepRebuiltSpawn({ feet: [1, 12, 2] }, [1, 10, 2], 2.4, 'Flying'), false, 'a flyer that had moved restores verbatim');
  assert.equal(keepRebuiltSpawn({ feet: [1, 11.2, 2] }, [1, 10, 2], undefined, 'Flying'), false, 'no idle height, no judgement');
});

test('bats review: the motor measures from DFU\'s transform (centreOffset), not half its capsule', () => {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const mk = () => { const c = new Collider(() => -100); c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I); return c; };
  // the default keeps every caller that names no sprite where it was
  const plain = new EnemyAI(mk(), [0, 0, 0], 0, { liveSpeed: 50 });
  assert.equal(plain.centreOffset, CAPSULE_HEIGHT / 2);
  assert.deepEqual(plain._centre(), [0, CAPSULE_HEIGHT / 2, 0]);
  // a big flyer: idle sprite 3.2, capsule halved to 1.6, transform 1.6 up
  const bat = new EnemyAI(mk(), [0, 0, 0], 0, { liveSpeed: 50, behaviour: 'Flying', height: enemyControllerHeight(3.2, 'Flying'), centreOffset: 1.6 });
  assert.equal(bat.height, 1.6);
  assert.deepEqual(bat._centre(), [0, 1.6, 0], 'transform.position sits at the sprite centre, not at 0.8');
  bat.inSight = true;
  bat.lastKnownTargetPos = [0, 0, 12];
  bat.predictedTargetPos = bat.lastKnownTargetPos;
  bat._getDestination([0, 0, 12]);
  // DFU: target transform (feet + 0.9) + targetController.height/2 (0.9)
  // = feet + 1.8, measured from this transform (feet + 1.6): +0.2 in
  // feet-space. The first cut aimed the bat's FEET at the player's head.
  assert.ok(near(bat.destination[1], 1.8 - 1.6), `a flyer's feet-space aim: ${bat.destination[1]}`);
  // a rat: idle sprite 0.9, capsule floored to 1.6, transform 0.45 up -
  // the grounded arm's (targetHeight - originalHeight)/2 is DFU's, in
  // transform-space: 0.9 - 0.1 - 0.45 = +0.35 (it aims a little up)
  const rat = new EnemyAI(mk(), [0, 0, 0], 0, { liveSpeed: 50, height: enemyControllerHeight(0.9, 'General'), centreOffset: 0.45 });
  rat.inSight = true;
  rat.lastKnownTargetPos = [0, 0, 12];
  rat.predictedTargetPos = rat.lastKnownTargetPos;
  rat._getDestination([0, 0, 12]);
  assert.ok(near(rat.destination[1], 0.9 - (1.8 - 1.6) / 2 - 0.45), `a rat's feet-space aim: ${rat.destination[1]}`);
  // a plain 1.8 walker still aims dead level (feet to feet)
  plain.inSight = true;
  plain.lastKnownTargetPos = [0, 0, 12];
  plain.predictedTargetPos = plain.lastKnownTargetPos;
  plain._getDestination([0, 0, 12]);
  assert.ok(near(plain.destination[1], 0), 'a walker aims at its own height');
});

test('bats review: every host passes centreOffset; the watch sizes its capsule too; re-stands hand the TRANSFORM; hit laws read the capsule', () => {
  const d = src('src/scenes/dungeonContext.js');
  const x = src('src/scenes/exteriorFoes.js');
  const g = src('src/scenes/cityGuards.js');
  assert.equal([...d.matchAll(/centreOffset: idleH \/ 2,/g)].length, 2, 'both dungeon branches');
  assert.match(x, /centreOffset: idleH \/ 2,/);
  assert.match(g, /height: enemyControllerHeight\(idleH, basics\.behaviour \?\? 'General'\),/, 'the watch wears its sprite (SetupDemoEnemy.cs:103-115)');
  assert.match(g, /centreOffset: idleH \/ 2,/);
  assert.match(g, /mobileType: GUARD_MOBILE_TYPE, idleH, dead: false,/, 'and carries idleH for the re-stand');
  const guardTex = g.indexOf('const tex = await getTexture(archive);');
  assert.ok(guardTex > 0 && guardTex < g.indexOf('const ai = new EnemyAI(') && g.indexOf('if (gen !== epoch) return null;') < g.indexOf('const ai = new EnemyAI('),
    'the guard texture is read before the AI stands, the epoch guard still ahead of any allocation');
  // WabbajackEffect.cs:90 hands the struck foe's transform.localPosition
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /const feet = f\.ai\?\.feet \? centreFromFeet\(f\.ai\.feet, f\.idleH \?\? f\.ai\.height\) : enchantFeet\(\);/, `${f}: the re-stand hands the transform`);
  }
  assert.match(d, /const at = f\.ai\?\.feet \? centreFromFeet\(f\.ai\.feet, f\.idleH \?\? f\.ai\.height\) : \(lastPlayerFeet \?\? \[0, 0, 0\]\);/);
  // the player's swing/arrow contact tests the FOE's capsule centre
  // (the audio.play3d origins keep their 0.9 - a sound source, not a hit law)
  for (const [f, n] of [['src/scenes/dungeonContext.js', 2], ['src/scenes/exteriorFoes.js', 1], ['src/scenes/cityGuards.js', 1], ['src/combat/arrowFlight.js', 1]]) {
    const s = src(f);
    assert.doesNotMatch(s, /const c = \[\w+\.ai\.feet\[0\], \w+\.ai\.feet\[1\] \+ 0\.9, /, `${f}: the swing's canSee reads no 0.9 (the player's half-capsule) on a foe`);
    assert.ok([...s.matchAll(/(?:[fg]\.ai|t\.ref\?\.ai\?)\.height \?\? (?:CAPSULE_HEIGHT|1\.8)\) \/ 2/g)].length >= n, `${f}: at least ${n} hit site(s) read the foe's capsule`);
  }
  // the dungeon save: stamped, and a pre-fix flyer entry judged
  assert.match(d, /feet: \[\.\.\.f\.ai\.feet\], yaw: f\.ai\.yaw, anchor: 1,/);
  assert.match(d, /if \(!keepRebuiltSpawn\(sf, f\.ai\.feet, f\.idleH, f\.mobile\?\.basics\?\.behaviour \?\? 'General'\)\) \{ f\.ai\.feet\[0\] = sf\.feet\[0\];/);
});
