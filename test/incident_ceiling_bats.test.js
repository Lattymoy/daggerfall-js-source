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
import { enemyControllerHeight, idleSpriteHeight, feetFromCentre, spriteOriginY } from '../src/characters/enemyAnchor.js';
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
  assert.match(x, /const idleH = idleSpriteHeight\(tex\);\n\s+if \(behaviour === 'Flying'\) pending\.feet\[1\] = pos\[1\] - idleH \/ 2;\n\s+const ai = new EnemyAI\(/,
    'the exterior pool reads the sprite BEFORE the AI stands, and drops a flyer from FinalizeFoe\'s lifted centre');
  assert.match(x, /height: enemyControllerHeight\(idleH, behaviour\),/);
  assert.match(x, /org\[1\] = spriteOriginY\(f\.ai\.feet\[1\], f\.idleH, sz\.h, _bh\);/, 'the exterior draw pins a flyer\'s centre');
  // the epoch guard still stands between the texture await and the AI
  const guard = x.indexOf('if (gen !== epoch) return null;');
  assert.ok(guard > x.indexOf('const tex = await getTexture(archive);') && guard < x.indexOf('const ai = new EnemyAI('),
    'AUDIT-39r: a sweep across the texture await still cancels the spawn before anything stands');
});
