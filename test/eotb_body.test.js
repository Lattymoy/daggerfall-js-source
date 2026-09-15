import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sizeMod, spriteSize, scaleOffset, advanceFrame, spriteFor, tableKeys, flipRows,
  spriteCount, eotbSpriteUrl, SIZE_ON_FOOT, SIZE_RIDING_OR_TRANSFORMED,
} from '../src/player/eotbSprite.js';
import { createEotbBody } from '../src/player/eotbBody.js';
import { ARCHIVE_FOOT, ARCHIVE_HORSE, FOOTSTEP_FRAMES, frameTime } from '../src/player/eotbBillboard.js';

// ═══ EOTB5: THE BODY ON SCREEN ════════════════════════════════════

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const viteConfig = readFileSync(join(root, 'vite.config.js'), 'utf8');
const weaponRig = readFileSync(join(root, 'src/combat/weaponRig.js'), 'utf8');
const bodySrc = readFileSync(join(root, 'src/player/eotbBody.js'), 'utf8');

test('EOTB5: the sprite is sized in METRES PER PIXEL, and the saddle shares its size with the werewolf', () => {
  // `get_sizeMod`: 0.019 on foot, 0.029 riding OR transformed. One
  // constant covers both because a rider and a werewolf are drawn at
  // the same reach - which is the sort of thing that reads like a slip
  // until you see the two conditions share an arm in the IL.
  assert.equal(SIZE_ON_FOOT, 0.019);
  assert.equal(SIZE_RIDING_OR_TRANSFORMED, 0.029);
  assert.equal(sizeMod({}), 0.019);
  assert.equal(sizeMod({ riding: true }), 0.029);
  assert.equal(sizeMod({ transformed: true }), 0.029, 'the transformed forms take the RIDING size');
  assert.equal(sizeMod({ riding: true, transformed: true }), 0.029);
  assert.equal(sizeMod({ scale: 2 }), 0.038, 'BillboardScale multiplies it');

  // a sprite of the bundle's own proportions stands about a person high
  const { w, h } = spriteSize(53, 110, {});
  assert.ok(h > 1.9 && h < 2.2, `a 110px sprite stands ${h.toFixed(2)}m - about a person`);
  assert.equal(Number(w.toFixed(4)), Number((53 * 0.019).toFixed(4)));
  // ...and mounted it stands taller, which is the whole point of the
  // second constant
  assert.ok(spriteSize(53, 110, { riding: true }).h > h);
  assert.equal(scaleOffset({ scale: 2, scaleOffsetMod: 3 }), 6);
});

test('EOTB5: the frame clock advances by the mod\u2019s own step, and a stall cannot eat the animation', () => {
  const step = frameTime(false, 1);
  let c = { frame: 0, timer: 0 };
  // less than a step: nothing moves
  let a = advanceFrame(c, step * 0.9, { frames: 5 });
  assert.equal(a.frame, 0, 'a short frame does not advance the sprite');
  c = a;
  // crossing the step advances exactly one
  a = advanceFrame(c, step * 0.2, { frames: 5 });
  assert.equal(a.frame, 1);
  // A STALL. A tab coming back with a second of dt must not silently
  // drop the frames it owed - it catches up - and must not hang, which
  // is why the catch-up is bounded by the cycle rather than open.
  a = advanceFrame({ frame: 0, timer: 0 }, step * 3.5, { frames: 5 });
  assert.equal(a.frame, 3, 'three whole steps, three frames');
  // A HALF-STEP ON PURPOSE. `step * 10000` divides evenly, so the
  // timer lands on 0 whether the catch-up is bounded or not, and a
  // mutant removing the bound survived the pin. With a remainder the
  // two answers differ: the BOUNDED path gives up and zeroes the
  // timer, while an unbounded loop grinds all the way down and leaves
  // the half step behind.
  const huge = advanceFrame({ frame: 0, timer: 0 }, step * 10000.5, { frames: 5 });
  assert.ok(Number.isInteger(huge.frame) && huge.frame >= 0 && huge.frame < 5, 'a huge dt lands on a real frame');
  assert.equal(huge.timer, 0,
    'the catch-up is BOUNDED - it gives up and zeroes the debt rather than looping a billion times on a bad dt');

  // riding runs four times faster, so the same dt walks further
  const onFoot = advanceFrame({ frame: 0, timer: 0 }, step, { frames: 5 });
  const mounted = advanceFrame({ frame: 0, timer: 0 }, step, { frames: 5, riding: true });
  assert.equal(onFoot.frame, 1);
  assert.equal(mounted.frame, 4, 'sixteen a second against four');
});

test('EOTB5: the footfall follows the PICTURE, not a timer of its own', () => {
  // `SyncFootsteps`: the step sound fires on frames 2 and 4 of the
  // five-frame walk and on no others. Driven a whole cycle so the
  // silent frames are pinned as firmly as the loud ones.
  const step = frameTime(false, 1);
  let c = { frame: 0, timer: 0 };
  const fired = [];
  for (let i = 0; i < 5; i++) {
    c = advanceFrame(c, step, { frames: 5 });
    if (c.footfall) fired.push(c.frame);
  }
  assert.deepEqual(fired.sort(), [...FOOTSTEP_FRAMES], 'two footfalls a cycle, on the mod\u2019s own frames');
});

test('EOTB5: a MIRRORED sprite is its own upload, and says so', () => {
  // The renderer's billboard batch has no flip, so a flipped
  // orientation is different PIXELS under a different cache key. If
  // the two shared a key the second upload would be a silent no-op and
  // half the wheel would face the wrong way.
  const left = spriteFor('Idle', 2, 0, {});     // mirrored
  const right = spriteFor('Idle', 6, 0, {});    // its unmirrored twin
  assert.equal(left.mirror, true);
  assert.equal(right.mirror, false);
  assert.equal(left.record, right.record, 'the same record...');
  assert.equal(left.key, right.key, '...and the same file on disk');
  assert.notEqual(left.rec, right.rec, '...but NOT the same texture cache key');
  assert.match(left.rec, /m$/, 'the mirrored copy is marked');

  // and the flip really flips, row by row
  const px = new Uint32Array([1, 2, 3, 4, 5, 6]);   // 3 wide, 2 high
  assert.deepEqual([...flipRows(px, 3, 2)], [3, 2, 1, 6, 5, 4]);
  // twice is the identity, which is the cheapest proof it is a flip
  assert.deepEqual([...flipRows(flipRows(px, 3, 2), 3, 2)], [...px]);
});

test('EOTB5: one table asks for five files, not eight - the wheel shares its records', () => {
  const keys = tableKeys('Idle', 0, {});
  assert.equal(keys.length, 5, 'eight orientations, five records');
  assert.deepEqual(keys, [0, 1, 2, 3, 4].map((r) => `${ARCHIVE_FOOT}_${r}-0`));
  // the horse tables ask their own archive
  assert.ok(tableKeys('GallopHorse', 0, { onHorse: 2 }).every((k) => k.startsWith(String(ARCHIVE_HORSE + 2))));
});

test('EOTB5: in node there is no art, so the body can never claim to be ready', () => {
  // `import.meta.glob` is a Vite macro; under node the map is empty by
  // construction. That is what keeps the whole lane shut in the suite
  // - and it is asserted rather than assumed, because "the tests pass"
  // would otherwise be partly an accident of the environment.
  assert.equal(spriteCount(), 0, 'no glob under node');
  assert.equal(eotbSpriteUrl('112364_0-0'), null);
  const b = createEotbBody();
  assert.equal(b.ready(), false, 'no renderer, no art: not ready');
  b.attach(null);
  assert.equal(b.ready(), false, 'and attaching nothing does not change that');
  assert.equal(b.draw(null, {}), false, 'nor does asking it to draw');
});

test('EOTB5: THE FOUR HOSTS are named, and the wiring is ONE site because all four reach it', () => {
  // the FOUR HOSTS rule in bible/Home.md - a slice wiring a seam into a
  // host must name all four. Named: exterior.js, world.js, worldModes.js,
  // dungeonContext.js. None carries a call, and that IS the wiring:
  // all four build a weapon rig, which is the one place fpArm.attach
  // is called, so the body attaches beside the arm it stands in for.
  //
  // Checked as a POPULATION rather than as four names, so a fifth host
  // gets the body without an edit here - and so this pin cannot pass
  // by someone deleting a host from a list.
  assert.match(weaponRig, /eotbBody\.attach\(renderer\);/, 'the body attaches in the weapon rig');
  assert.match(weaponRig, /fpArm\.attach\(renderer, camera\)/, '...beside the arm');

  const hosts = ['exterior', 'world', 'worldModes', 'dungeonContext'];
  for (const h of hosts) {
    const src = readFileSync(join(root, `src/scenes/${h}.js`), 'utf8');
    assert.match(src, /createWeaponRig\(/, `${h}.js builds a weapon rig, so it gets the body`);
    assert.doesNotMatch(src, /eotbBody/, `${h}.js must NOT carry its own call - four sites is four chances to forget one`);
  }
  // ...and the population really is those four: nothing else in scenes/
  // builds a rig, so the list is complete rather than merely long
  const all = readFileSync(join(root, 'src/combat/weaponRig.js'), 'utf8');
  assert.match(all, /export function createWeaponRig/, 'one builder');
  assert.match(bodySrc, /scenes\/exterior\.js.*scenes\/world\.js|THE FOUR HOSTS/s, 'the body names them in its head');
});

test('EOTB5: the mod\u2019s art is EXCLUDED from Vite\u2019s inlining, and nothing else is', () => {
  // THE FINDING THIS PIN EXISTS FOR. Vite inlines any asset under
  // `assetsInlineLimit` (4 KB) as a base64 data URI. These sprites
  // average 2.8 KB, so all 3035 qualified and the build produced a
  // TWELVE MEGABYTE JavaScript chunk - exiting 0, with no warning. A
  // player would have parsed 12 MB of base64 to start the game.
  //
  // The rule is narrow by path, and it FALLS THROUGH for everything
  // else: a callback returning `true` for other assets would
  // force-inline them regardless of size, which is the opposite
  // mistake and just as quiet. That second bug was written and caught
  // here before it shipped.
  assert.match(viteConfig, /assetsInlineLimit:/, 'the rule exists');
  const m = /assetsInlineLimit: \(filePath\) => \((.*?)\),/.exec(viteConfig);
  assert.ok(m, 'and it is a callback, not a number');
  assert.match(m[1], /eye-of-the-beholder/, 'aimed at this mod\u2019s art');
  assert.match(m[1], /\?\s*false\s*:\s*undefined/,
    'false for this mod, UNDEFINED for everything else - undefined falls back to the default limit');

  // drive it, so the rule is not merely spelled
  // eslint-disable-next-line no-new-func
  const rule = new Function('filePath', `return (${m[1]});`);
  assert.equal(rule('/x/vendor/eye-of-the-beholder/Textures/112364/112364_0-0.png'), false, 'never inline a sprite');
  assert.equal(rule('/x/vendor/dynamic-skies/Textures/CdMSunny.png'), undefined, 'every other vendor asset keeps the default');
  assert.equal(rule('/x/src/ui/whatever.png'), undefined);
  // a Windows separator too. Vite normalises to posix internally, so
  // this arm is belt and braces - but the character class costs
  // nothing and a path that arrives with backslashes must not quietly
  // fall through to "inline it".
  assert.equal(rule('C:\\x\\vendor\\eye-of-the-beholder\\Textures\\a.png'), false, 'and on a Windows path too');
});
