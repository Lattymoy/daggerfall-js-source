// M5: the cast engine's HOST WIRING. hostmagic.test.js pins the
// engine's laws behaviorally; these pin that every host actually
// drives it - mount, click seam, frame, draw, and the mode facades.
// (The four-mounts sweep itself lives in mysticism.test.js S27.)
// Source pins, because the hosts need a browser to import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, 'src/scenes', f), 'utf8');
const HOSTS = ['exterior.js', 'world.js'];

test('M5: an armed cast eats the attack click in every host (WeaponManager defers to the ready spell)', () => {
  // EntityEffectManager: a readied spell consumes the next click.
  // The engine's interceptAttack is that seam; each host must ask it
  // BEFORE handing the click to the weapon rig.
  for (const f of HOSTS) {
    const s = src(f);
    assert.ok(/if \(magic\.interceptAttack\(true\)\) return; weaponRig\.attackInput/.test(s),
      `${f}: the drag/press arms test the latch first`);
    assert.ok((s.match(/magic\.interceptAttack\(true\)/g) ?? []).length >= 3,
      `${f}: mousemove, mousedown and the touch arm all intercept`);
  }
  assert.ok(src('worldModes.js').includes('if (held && magic?.interceptAttack(true)) return; interiorWeapon.attackInput'),
    'the interior attack route is wrapped');
  assert.ok(src('dungeonContext.js').includes('if (magic.interceptAttack(held)) return;'),
    'the dungeon playerAttackInput defers too');
});

test('M5: every host frame drives the engine - firePending, update, and the missile draw', () => {
  for (const f of [...HOSTS, 'worldModes.js', 'dungeonContext.js']) {
    const s = src(f);
    assert.ok(s.includes('magic.firePending('), `${f}: the armed click fires on the frame`);
    assert.ok(/magic\.update\(dt,/.test(s), `${f}: missiles fly`);
    assert.ok(/magic\.batches\(\)/.test(s), `${f}: and draw`);
  }
});

test('M5: the exterior pages cast through MODE FACADES - collider, foes and absorb context follow the door', () => {
  // One engine per page; walking through an interior door must not
  // leave spells colliding with the town outside.
  for (const f of HOSTS) {
    const s = src(f);
    // wave 37: every `modes` deref above the declaration is `modes?.`
    // now, short-circuit-safe ones included - see audit24_wave37.
    assert.ok(s.includes("(modes?.mode === 'interior' && modes?.interiorCollider) ? modes?.interiorCollider : collider"),
      `${f}: missiles hit the walls of the mode the player is in`);
    assert.ok(/foes: \(\) => \(modes\?\.mode \?\? 'exterior'\) === 'exterior' \? (cityGuards\.guards|\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\]) : \[\]/.test(s),
      `${f}: guards (and, in the world host, the X-slice encounter pool) are targets only outside`);
    const i = s.indexOf('absorbCtx: () =>');
    const arm = s.slice(i, i + 300);
    assert.ok(arm.includes("=== 'exterior'") && arm.includes('inside: false') && arm.includes('inside: true'),
      `${f}: absorption's darkness/light law follows the mode`);
  }
  assert.ok(src('worldModes.js').includes('get interiorCollider() { return interiorCtx?.collider ?? null; }'),
    'worldModes exposes the interior collider for the facade');
});

test('M5: spell damage reaches guards through the ONE damage door', () => {
  // cityGuards.damageGuard owns corpse + Murder on kill; the engine's
  // foe sinks must route there, not mint a second bookkeeping path.
  assert.ok(src('cityGuards.js').includes('hurtGuard: (g, dmg, playerFeet) => damageGuard(g, dmg, playerFeet, null)'),
    'cityGuards exports the door');
  for (const f of HOSTS) {
    assert.ok(/hurt: \(n\) => \{ if \(n > 0\) (cityGuards\.hurtGuard\(g, n, player\.pos\)|\(g\._encounter \? exteriorFoes\.damageFoe\(g, n, player\.pos\) : cityGuards\.hurtGuard\(g, n, player\.pos\)\))/.test(src(f)),
      `${f}: the engine sink routes through the pool's own damage door`);
  }
});

test('M5: SPELLS.STD rides into the interior arm, and the dungeon save seam survives', () => {
  for (const f of HOSTS) {
    assert.ok(src(f).includes('magic, spellsByIndex: () => spellsByIndex'),
      `${f}: the engine and the index reach worldModes`);
  }
  assert.ok(src('worldModes.js').includes("typeof spellsByIndex === 'function' ? spellsByIndex() : spellsByIndex"),
    'the interior spellbook reads the live getter');
  const dc = src('dungeonContext.js');
  assert.ok(dc.includes('readiedSpellIndex: magic.readiedIndex()'), 'the save writes the readied index');
  assert.ok(dc.includes('magic.setReadiedByIndex(extras.readiedSpellIndex ?? null, spellsByIndex)'),
    'and the load restores it through the engine');
});
