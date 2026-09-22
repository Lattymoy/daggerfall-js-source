// DEATHLOOP1 (2026-09-22). Two Discord reports, one law:
//
//   SquidKamer: "Respawn after poison and likely disease and other
//   things can cause a deathloop. Probably should do something about
//   that. Its basically permanent death for your character."
//
//   trashBattery: "Dying while falling with guards nearby to arrest you
//   will place you in a deathloop once your jail sentence ends. You
//   cannot access a menu while in this mode. The only way to stop the
//   game now is to force-kill the process."
//
// MAC-D3 fixed the ORDER of the revival - the heal moved to the top so
// no frame could see a dead player with no death screen. This is the
// other half: the health came back and THE CAUSE DID NOT GO AWAY. A
// poisoned character wakes at half health and the poison empties it
// again in seconds.
//
// THE LOOP IS WHAT IS DRIVEN HERE, not the wiring. A pin that read
// "reviveForPlay is called" would have passed against the shipped bug
// just as happily, because the shipped bug called a heal too. So the
// pins below run the revival and then TICK, and require the player to
// still be alive on the other side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviveForPlay, endLethalDrains, LETHAL_DRAINS, respawnHealth } from '../src/systems/deathRespawn.js';

const player = (over = {}) => ({ maxHealth: 40, health: 0, activeEffects: [], ...over });

test('DEATHLOOP1: a revival ends the drains that were emptying the bar', () => {
  const p = player({ activeEffects: [
    { kind: 'poison', poisonType: 3 },
    { kind: 'continuousDamage', magnitude: 5 },
    { kind: 'transferHealth', magnitude: 2 },
  ] });
  const out = reviveForPlay(p, { force: true });

  assert.equal(p.health, respawnHealth(40), 'the health comes back');
  assert.deepEqual(out.cleared.sort(), [...LETHAL_DRAINS].sort(), 'and every fast drain is named as cleared');
  assert.deepEqual(p.activeEffects, [], 'and actually gone from the entity');

  // THE LOOP ITSELF. Stand in for the round tick: every drain still on
  // the entity takes its bite. Before the fix this reached 0 and the
  // respawn would run again - for ever.
  let health = p.health;
  for (let round = 0; round < 12; round++) {
    for (const e of p.activeEffects) if (LETHAL_DRAINS.includes(e.kind)) health -= (e.magnitude ?? 5);
  }
  assert.ok(health > 0, 'and the player is still alive twelve rounds later');
});

test('DEATHLOOP1: a disease is KEPT - it is not what makes the loop, and curing it would be the cheapest cure in the game', () => {
  // Diseases fall once per CLASSIC DAY (systems/diseases.js, the HEA
  // column through `sinks.hurt`), so half of max health is days of
  // walking - enough to reach the temple that cures them. And
  // vampirism and lycanthropy are carried as `kind: 'disease'`
  // (systems/infection.js), so a blanket cure here would let a player
  // shake an infection by dying on purpose, for free, at a graveyard.
  const p = player({ activeEffects: [
    { kind: 'disease', disease: 7 },
    { kind: 'disease', disease: 30, infection: 'vampirism' },
    { kind: 'poison', poisonType: 3 },
  ] });
  const out = reviveForPlay(p, { force: true });

  assert.deepEqual(out.cleared, ['poison'], 'only the fast drain goes');
  assert.equal(p.activeEffects.length, 2, 'both diseases stay');
  assert.ok(p.activeEffects.every((e) => e.kind === 'disease'), 'and they are the diseases');
  assert.ok(p.activeEffects.some((e) => e.infection === 'vampirism'),
    'an infection survives a death - it is a timer, not a wound');

  // Paralysis is kept for the same reason: it drains nothing and wears
  // off, so it cannot be the thing that re-kills.
  assert.ok(!LETHAL_DRAINS.includes('paralyze'), 'paralysis is not a drain');
  assert.ok(!LETHAL_DRAINS.includes('disease'), 'nor is a disease');
});

test('DEATHLOOP1: the floor only lifts the dead - a revival is not a free heal', () => {
  // trashBattery's release takes this arm: online a served sentence
  // refills nothing (AUDIT WORLD5 C9), and C9 was right about the free
  // heal. What it must not do is let anybody out DEAD.
  const hurt = player({ health: 3 });
  const out = reviveForPlay(hurt);
  assert.equal(hurt.health, 3, 'a living player keeps the health they walked in with');
  assert.equal(out.revived, false, 'and is not reported as revived');

  const dead = player({ health: 0 });
  assert.equal(reviveForPlay(dead).revived, true, 'a dead one is lifted');
  assert.ok(dead.health > 0, 'to a living number');

  const negative = player({ health: -25 });   // a fall does this
  reviveForPlay(negative);
  assert.ok(negative.health > 0, 'however far below zero the blow took them');

  // MAC-D3's own lesson, still held: a health no comparison can satisfy
  // is neither alive nor dead.
  const broken = player({ maxHealth: undefined, health: 0 });
  reviveForPlay(broken);
  assert.ok(Number.isFinite(broken.health) && broken.health > 0, 'and never NaN');
});

test('DEATHLOOP1: EVERY path that puts a living player back in the world ends the drains', () => {
  // The fault was never one call site - it was four, each restoring
  // health on its own. This is the sweep that would have found them.
  const SITES = [
    ['src/scenes/world.js', 'the online respawn'],
    ['src/scenes/worldModes.js', "Privateer's Hold's in-place respawn"],
    ['src/systems/save.js', 'an online load of a dead save'],
    ['src/scenes/arrestFlow.js', 'the prison release'],
  ];
  for (const [file, what] of SITES) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(src, /reviveForPlay\(/, `${what} (${file}) revives through the one law`);
  }

  // ...and the bare heal is gone from the paths that had it, so a
  // revival cannot be written as a health assignment again by accident.
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(!/playerEntity\.health = respawnHealth\(/.test(world),
    'the online respawn no longer sets health behind the law');
  const modes = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.ok(!/playerEntity\.health = respawnHealth\(/.test(modes),
    "Privateer's Hold no longer sets health behind the law");

  // The prison release is the one trashBattery hit: offline still gets
  // the full refill, online gets the floor.
  const arrest = readFileSync(new URL('../src/scenes/arrestFlow.js', import.meta.url), 'utf8');
  assert.match(arrest, /if \(!sharedClockOn\(\)\) fillVitalSigns\(playerEntity\);\n\s*else reviveForPlay\(playerEntity\);/,
    'a served sentence online lets nobody out dead, and still is not a free heal');
});

test('DEATHLOOP1: endLethalDrains reports only what it actually removed', () => {
  const clean = player({ activeEffects: [{ kind: 'shield' }, { kind: 'regenerate' }] });
  assert.deepEqual(endLethalDrains(clean), [], 'nothing to clear says nothing');
  assert.equal(clean.activeEffects.length, 2, 'and clears nothing');
  assert.deepEqual(endLethalDrains({}), [], 'an entity with no effect list is not a throw');
  assert.deepEqual(endLethalDrains(null), [], 'nor is no entity at all');
});

// ── F11: THE SHELL MUST NOT SPEND A KEY THE GAME BINDS ───────────
//
// Janome, 2026-09-22: "noticed that in the exe version, F11 is the
// hotkey for full screen. this is an issue, because F11 is also the
// quickload hotkey, so instead of making the game full screen it just
// loaded my save."
//
// Filed with DEATHLOOP1 because it is the same shape as the reports
// above - a desktop-only collision the browser never sees - and
// because it is one line of shell config, not an arc of its own.
test('F11 BELONGS TO THE GAME: the desktop shell claims no key the default bindings spend', async () => {
  const { DEFAULT_BINDINGS } = await import('../src/systems/inputActions.js');
  const bound = new Map(DEFAULT_BINDINGS);
  // The two that made the report: DFU's own SetupDefaults.
  assert.equal(bound.get('F9'), 'QuickSave');
  assert.equal(bound.get('F11'), 'QuickLoad');

  const main = readFileSync(new URL('../app/main.cjs', import.meta.url), 'utf8');

  // Electron's `togglefullscreen` role carries F11 on Windows and
  // Linux. A BARE role here puts a menu accelerator on the game's
  // quickload key, so the row is the fault however the race resolves.
  assert.ok(!/\{ role: 'togglefullscreen' \},/.test(main),
    'a bare togglefullscreen role spends F11 on Windows and Linux');
  assert.match(main, /role: 'togglefullscreen', accelerator: 'Alt\+Enter'/,
    'the non-mac accelerator is named, and is not a key the game binds');

  // macOS keeps the role's own Ctrl+Cmd+F, which collides with nothing.
  assert.match(main, /process\.platform === 'darwin'\s*\n\s*\? \{ role: 'togglefullscreen' \}/,
    'mac keeps the role default');

  // AND THE LAW, not just this one row: no accelerator anywhere in the
  // shell menu may name a key the default bindings already spend.
  const accelerators = [...main.matchAll(/accelerator: '([^']+)'/g)].map((m) => m[1]);
  const collisions = accelerators.filter((a) => bound.has(a));
  assert.deepEqual(collisions, [],
    'a shell accelerator on a bound key is the F11 bug again under another name');
});
