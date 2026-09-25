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

test('DEATHLOOP1: a disease is KEPT - curing it would be the cheapest cure in the game (its stat hold is eased: DISC24-D)', () => {
  // Diseases fall once per CLASSIC DAY (systems/diseases.js, the HEA
  // column through `sinks.hurt`), so half of max health is days of
  // walking - enough to reach the temple that cures them. (Their STAT
  // damage can hold a stat at zero, which kills every 0.2 seconds -
  // that one DID loop, and the revival eases it: test/disc24d_stat_
  // zero_loop.test.js. The entry itself stays, as here.) And
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

// ── DEATH-BODY1: A REVIVED PLAYER IS NOT A CORPSE ────────────────
//
// Muriel: "Using the linux appimage, if you die in the tutorial
// dungeon and press F11 to load, you load the game but are visually a
// corpse. You can act normally, but are a corpse." kurkku saw the same
// ("It just goes away on its own, must be some bug with Eye of the
// Beholder"). trashBattery confirmed it on Arch and named the cause:
// "zooming into first person and then back out into 3rd person fixes
// it. looks like loading the game after a death doesn't update the
// character model state."
//
// Filed with DEATHLOOP1 because it is the same family - a revival the
// port has and the reference does not - and it is the OTHER half of a
// death that the player survives.
test('DEATH-BODY1: coming back to life lowers the death latch, wherever the life came from', async () => {
  const { eotbBody } = await import('../src/player/eotbBody.js');
  const src = readFileSync(new URL('../src/player/eotbBody.js', import.meta.url), 'utf8');

  // The latch is read at the top of LateUpdate and it is the ENTITY's
  // state that lowers it - not a toggle, not a load hook, not any one
  // caller remembering to reach in.
  const late = src.slice(src.indexOf('function lateUpdate('));
  const body = late.slice(0, late.indexOf('\n  }\n'))
    .split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  assert.match(body, /if \(died\) \{\s*\n\s*if \(last\.died\) return;\s*\n\s*initialize\(\);/,
    'a live player with the latch up re-initializes instead of staying frozen');

  // AND IT IS NOT A LOAD HOOK. A fix bolted onto the load path would
  // have left the online respawn and the prison release still frozen,
  // because neither of those is a load - so the pin refuses that shape
  // outright rather than only checking the one report's route.
  assert.ok(!/function onLoad|restoreFromSave|onQuickLoad/.test(src),
    'the body follows the entity; it does not subscribe to one caller');

  // The module instance is what makes this possible to get wrong: it
  // survives every revival the port has, where the mod's object does
  // not survive a death at all.
  assert.match(src, /export const eotbBody = createEotbBody\(\);/,
    'one module-level body, which is why a latch on it outlives a death');
  assert.equal(typeof eotbBody.state, 'function');
});

// ── DEATHLOOP2: THE WAILING IS THE DEATH SOUND, ONE PER LOOP ─────
//
// DragynDance on Discord (2026-09-22): "do you know why my game keeps
// spamming a wailing sound at me?", alongside "I almost died in
// privateers hold due to freezing to death" and "as soon as I stepped
// outside my health bar started draaaaining".
//
// PlayerDeathSequence plays the character's own Pain3 in its
// CONSTRUCTOR, and every host builds a fresh DeathScreen each time
// death is raised. All four hosts are already guarded against STACKING
// one screen over another, so the repeat is not that - it is the loop
// turning, once per wail, with the survival notices behind it.
//
// DEATHLOOP1 closed the effect half and stopped there. The cold is not
// an effect: it is computed fresh each tick from climate, month, hour,
// weather, clothing, WETNESS and race, and its harm is deliberately
// lethal. That lethality stays. The loop does not.
test('DEATHLOOP2: a revival clears the exposure that would re-kill on the next tick', async () => {
  const { reviveForPlay, endLethalExposure, REVIVED_SURVIVAL_RESET } = await import('../src/systems/deathRespawn.js');

  const frozen = { maxHealth: 40, health: 0, activeEffects: [{ kind: 'poison' }],
    survival: { exposure: 600, wet: 300, thirst: 120, sleepDebt: 400, lastAte: -900 } };
  const out = reviveForPlay(frozen, { force: true });

  assert.deepEqual(out.cleared, ['poison'], 'the effect half still runs');
  assert.deepEqual(out.exposure.sort(), ['exposure', 'wet'], 'and the exposure half is reported');
  assert.equal(frozen.survival.exposure, 0, 'the accumulated cold is off the character');
  assert.equal(frozen.survival.wet, 0, 'and so is the soaking that was defeating the clothes');

  // THE NEEDS THEMSELVES SURVIVE. This is not a free meal, a free
  // drink or a night's sleep - a revived character is still hungry,
  // thirsty and tired, and has to deal with that. Only the two fields
  // that carry the KILLING TICK across the revival are reset.
  assert.equal(frozen.survival.thirst, 120, 'still thirsty');
  assert.equal(frozen.survival.sleepDebt, 400, 'still short of sleep');
  assert.equal(frozen.survival.lastAte, -900, 'still hungry');
  assert.deepEqual(Object.keys(REVIVED_SURVIVAL_RESET).sort(), ['exposure', 'wet'],
    'and the reset list is those two and nothing else');

  // ...and it reports what it CHANGED, not what it looked at. A
  // character who was dry and unexposed when something else killed
  // them has no exposure to clear, and saying otherwise would put the
  // cold in a report it had nothing to do with.
  const dry = { maxHealth: 40, health: 0, activeEffects: [], survival: { exposure: 0, wet: 0, thirst: 10 } };
  assert.deepEqual(endLethalExposure(dry), [], 'nothing to clear reports nothing');
  const damp = { maxHealth: 40, health: 0, activeEffects: [], survival: { exposure: 0, wet: 120 } };
  assert.deepEqual(endLethalExposure(damp), ['wet'], 'and only the field that moved');
  assert.deepEqual(endLethalExposure({}), [], 'an entity with no record is not a throw');
  assert.deepEqual(endLethalExposure(null), [], 'nor is no entity');
});

test('DEATHLOOP2: the wail is one per DeathScreen, and no host may stack a second over a live one', () => {
  // The sound is played from the SEQUENCE'S CONSTRUCTOR, so the number
  // of wails is exactly the number of screens built. That is why the
  // guard below is the law and not a nicety.
  const death = readFileSync(new URL('../src/systems/playerDeath.js', import.meta.url), 'utf8');
  assert.match(death, /playSound\?\.\(this\.deathSound\);/, 'the clip rides construction');

  const HOSTS = ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/exterior.js'];
  for (const file of HOSTS) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const at = src.indexOf('new DeathScreen(');
    assert.ok(at > 0, `${file} presents a death`);
    // the guard sits within the arm just above the construction
    const before = src.slice(Math.max(0, at - 1400), at);
    assert.match(before, /instanceof DeathScreen/,
      `${file}: a second screen over a live one is a second wail`);
  }
});

test('DEATHLOOP2: survival exposure is left LETHAL - the design is not what was wrong', async () => {
  // needs.js withholds the health floor from the temperature harm on
  // purpose ("the bare-skin harms leave the last five points BECAUSE
  // they are not meant to kill, and this one is"). A future reader
  // fixing the deathloop by making the cold survivable would be
  // undoing the system rather than the bug, so the intent is pinned
  // where they will see it.
  const needs = readFileSync(new URL('../src/systems/survival/needs.js', import.meta.url), 'utf8');
  // SURV-TIERS: in the tier that wounds (Hard) - Casual's cold costs stamina alone, BY ITS TIER (survival/difficulty.js),
  // never by making Hard's cold survivable
  // AUDIT SURV-TIERS (the second pass): unfloored in the minute the player STANDS in; a REPLAYED minute (a jump) is
  // floored, SURV-THIRST1's law for the other harm that kills - so a fast travel cannot arrive dead, and the next
  // live minute in the heat or the cold still can
  assert.match(needs, /if \(rules\.health && abs > NEED\.DAMAGE_AT && !sleeping && harmTick\) \{\n\s*const bite = Math\.max\(1, Math\.trunc\(\(abs - 40\) \/ 10\)\);\n\s*if \(!replay\) sinks\.hurt\?\.\(bite\);/,
    'the temperature harm reaches sinks.hurt unfloored, as designed');
  assert.match(needs, /they are not meant to kill, and this one is/,
    'and the departure is stated where it is taken');
  // the floored helper is still used by the harms that are NOT meant to kill
  assert.match(needs, /hurtFloored\(1\)/, 'the bare-skin harms keep their floor');
});
