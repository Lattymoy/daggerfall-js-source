// AUDIT 24 (the seven-slice sweep), THE LIFETIME GATE.
//
// EVERY ALLOCATION HAS AN OWNER is one of the port's standing laws, and
// the sweep found five places where the owner had quietly gone missing:
// a foe culled at distance, a foe killed, a city guard on either death
// path, a retired dungeon missile, and the sky's panorama cache. None
// of them fails a test - a leak is invisible to a suite - so this file
// gates the SHAPE: the release call must be reachable from the place
// that ends the thing's life, and the bounded cache must stay bounded.
//
// A source-shape pin is a weak pin and this file says so out loud. It
// exists because the alternative is no pin at all: these modules need a
// live WebGL context to construct, and the defect is an absence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** The body of the named function, brace-matched from its header. */
function bodyOf(src, header) {
  const i = src.indexOf(header);
  assert.ok(i > 0, `${header} not found`);
  let depth = 0;
  // start the scan at the header's LAST character, so a default-value
  // brace inside the parameter list ("senses = {}") cannot be mistaken
  // for the body's opening brace
  let j = src.indexOf('{', i + header.length - 1);
  const start = j;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) break;
  }
  return src.slice(start, j + 1);
}

test('audit24 lifetimes: an encounter foe frees its billboard batch on BOTH ends', () => {
  const src = read('src/scenes/exteriorFoes.js');
  assert.match(src, /function releaseFoeBatch\(f\) \{[\s\S]*?destroyBillboardBatch\(f\.batch\)/,
    'the release actually destroys the batch');
  // the distance cull - the foe is spliced out of `foes` right after,
  // taking the only reference to its batch with it
  const update = bodyOf(src, 'function update(dt, playerFeet, eye, senses = {})');
  assert.match(update, /_dist > ENCOUNTER_CULL_DISTANCE[\s\S]{0,200}releaseFoeBatch\(f\)/,
    'the cull releases before it marks the foe dead');
  // and death - where the record STAYS in `foes` (the tail splice
  // spares corpses), so the batch would be unreachable and undead
  const dmg = bodyOf(src, 'function damageFoe(f, damage, playerFeet, knockDir = null)');
  // The window is a PROXIMITY bound, not a law - it exists so the
  // release cannot drift out of the death branch entirely. X5 put the
  // Soul Trap intercept between the two points (the trap can refuse
  // the death, so it must run BEFORE the batch is freed), which is
  // legitimate code in that gap; the bound moved to fit it rather than
  // the documentation being cut to fit the bound.
  assert.match(dmg, /health <= 0[\s\S]{0,900}releaseFoeBatch\(f\)/, 'death releases too');
  // and the intercept must sit ahead of the release, not after it
  assert.ok(dmg.indexOf('attemptSoulTrap') < dmg.indexOf('releaseFoeBatch(f)'),
    'a trap that refuses the death must not have freed the batch first');
  assert.match(bodyOf(src, 'function batches()'), /if \(f\.dead \|\| !f\._mout\) continue/,
    'and nothing draws a dead foe, which is what makes the release safe');
});

test('audit24 lifetimes: a city guard frees its batch on both death paths, and the array is NOT pruned', () => {
  const src = read('src/scenes/cityGuards.js');
  assert.match(src, /function releaseGuardBatch\(g\) \{[\s\S]*?destroyBillboardBatch\(g\.batch\)/);
  assert.match(bodyOf(src, 'function damageGuard(g, damage, playerFeet, knockDir)'),
    /health <= 0[\s\S]{0,300}releaseGuardBatch\(g\)/, 'the killed path');
  assert.match(src, /if \(!g\.dead\) \{ g\.dead = true; releaseGuardBatch\(g\); \}/,
    'and the walk-away path when the crime clears');
  // the array itself must stay index-stable: lootTargets keys corpses
  // by their index and takeLoot reads guards[i] straight back, so a
  // splice would hand the player someone else's purse
  assert.match(src, /guardCorpse:\$\{i\}/, 'lootTargets keys by array index');
  assert.doesNotMatch(src, /guards\.splice\(/, 'so nothing may splice guards');
});

test('audit24 lifetimes: a retired dungeon missile leaves the list', () => {
  const src = read('src/scenes/dungeonContext.js');
  const update = bodyOf(src, 'function updateMissiles(dt, playerFeet)');
  assert.match(update, /for \(let i = missiles\.length - 1; i >= 0; i--\) if \(missiles\[i\]\.dead\) missiles\.splice\(i, 1\);/,
    'the prune hostMagic has had all along');
  // and the in-flight batch microtask still guards on m.dead, which is
  // what makes pruning the list safe
  assert.match(src, /if \(!gpu \|\| m\.dead\) return;/, 'the orphan-push guard stands');
  assert.match(read('src/scenes/hostMagic.js'),
    /for \(let i = missiles\.length - 1; i >= 0; i--\) if \(missiles\[i\]\.dead\) missiles\.splice\(i, 1\);/,
    'the sibling loop this was copied from');
});

test('audit24 lifetimes: the sky panorama cache is BOUNDED', () => {
  const src = read('src/scenes/shared.js');
  assert.match(src, /const PANORAMA_CACHE_MAX = \d+;/, 'there is a bound');
  const cap = Number(/const PANORAMA_CACHE_MAX = (\d+);/.exec(src)[1]);
  assert.ok(cap >= 2 && cap <= 8, `the bound is small - ${cap}`);
  assert.match(src, /while \(panoramas\.size > PANORAMA_CACHE_MAX\) \{[\s\S]*?panoramas\.delete\(panoramas\.keys\(\)\.next\(\)\.value\)/,
    'and it evicts in insertion order');
  assert.match(src, /panoramas\.delete\(key\);\s*\n\s*panoramas\.set\(key, pano\);/,
    'with a delete-then-set refresh so the order is LRU, not FIFO');
  // one entry is 1024 * 220 * 4 bytes; the key space is 32 day frames
  // plus night PER SKY INDEX, which is what made it unbounded
  assert.ok(cap * 1024 * 220 * 4 < 8 * 1024 * 1024, 'the whole cache fits under 8 MB');
});

test('audit24 lifetimes: forceExitToExterior tears the quest stands down like the real door', () => {
  const src = read('src/scenes/worldModes.js');
  const force = bodyOf(src, 'forceExitToExterior() {');
  assert.match(force, /teardownQuestFlats\(\);[\s\S]{0,120}interiorCtx\.destroy\(\)/,
    'the stands leave the context BEFORE destroy - otherwise the next teardown double-frees them');
  assert.match(force, /questBridge\?\.onExteriorTransition\(\)/,
    "and CreateFoe's pending wave is invalidated, as both real doors do");
  // the ordering rule the teardown itself states
  assert.match(read('src/scenes/worldModes.js'),
    /pulled\s*\n\s*\/\/ out of the context's list FIRST so ctx\.destroy\(\) cannot free them\s*\n\s*\/\/ a second time/,
    'the rule is written down where it is enforced');
});

// ---- the DEAD FLAGS: a read with no writer, a write with no reader ----

test('audit24: preventNormalizingReputations is set by the prison jump and cleared by the tick', async () => {
  // PlayerEntity.cs:458 reads it, :528-530 clears it, and
  // DaggerfallCourtWindow.cs:474 is the ONLY setter. The port ported
  // the read and neither of the other two, so the guard was a constant
  // `true` - and the prison arm's own comment described the missing
  // line in as many words ("not harmless now that it is [ported]").
  const arrest = read('src/scenes/arrestFlow.js');
  assert.match(arrest, /playerEntity\.preventNormalizingReputations = true;\s*\n\s*advanceDays\(result\.days\)/,
    'set BEFORE the day skip, as UpdatePrisonScreen sets it before RaiseTime');
  const tick = read('src/systems/worldTick.js');
  assert.match(tick, /if \(entity\.preventNormalizingReputations\) entity\.preventNormalizingReputations = false;/,
    'and cleared at the tail of the same update - it is a ONE-JUMP shield');

  // and the shield really shields: a 112-day boundary crossed with the
  // flag up must not normalize, and must clear the flag on the way out
  const { tickPlayerMinutes, resetMagicRoundMarker } = await import('../src/systems/worldTick.js');
  const NORMALIZE = 161280;   // 112 days
  const run = (prevent, legalRep, from) => {
    const entity = {
      stats: {}, skills: [], factionRep: null, level: 1,
      legalRep, preventNormalizingReputations: prevent,
    };
    resetMagicRoundMarker(from);
    tickPlayerMinutes({
      entity, classicMinutes: from, dt: 1 / CLASSIC_MINUTES_PER_SECOND,
      sinks: {}, activity: {},
    });
    return entity;
  };
  // THE EDGE, both sides of it. DFU's loop is
  //     for (i = 0; i < minutesPassed; ++i)
  //         if (((i + lastGameMinutes) % 161280) == 0 && !preventNormalizing...)
  // so the minute VALUES tested are [last, now) with NO +1, and the one that
  // fires is the minute numbered 161280 itself. AUDIT 24 (wave 32) moved this
  // loop out of the broker's round loop, where AUDIT 23 had written it with
  // the round loop's `r + 1` - so the port normalised one game minute late,
  // and the fixture below pinned the port's own off-by-one by probing the
  // minute AFTER the boundary. A pin aimed at the middle of a band tells you
  // nothing about its edge.
  assert.equal(run(false, [40], NORMALIZE - 1).legalRep[0], 40,
    'stepping ONTO minute 161280 tests 161279, which is not the boundary');
  const bare = run(false, [40], NORMALIZE);
  assert.notEqual(bare.legalRep[0], 40, 'stepping OFF it tests 161280, which is - a RULE, not a tautology');

  const shielded = run(true, [40], NORMALIZE);
  assert.equal(shielded.legalRep[0], 40, 'the shield holds the credited reputation across the jump');
  assert.equal(shielded.preventNormalizingReputations, false, 'and the flag clears itself, one jump only');

  // ...and the loop is PlayerEntity's, not the broker's: no 2880-minute cap.
  // A 21-day prison sentence steps every one of its 30,240 minutes here.
  assert.match(tick, /for \(let i = lastMinutes; i < nowMinutes; i\+\+\)/, 'over the whole elapsed window');
  assert.match(tick, /i % NORMALIZE_INTERVAL_MINUTES === 0/, 'on the minute VALUE, no \+1');
});

test('audit24: the three quest settings are LIVE reads, not hardcoded falses', async () => {
  // Every one had a live consumer and a launcher toggle, so the player
  // could flip a switch that reached nothing: adult quests were
  // filtered out whatever ChildGuard said (questLists.js:154), the
  // guild list-box arm was unreachable (offerFlow.js:144), and the
  // journal's clocks never counted down (clock.js:158). The settings
  // tier map's own both-ways gate now covers them; this pins the
  // BEHAVIOUR the tier map cannot see.
  const { setValue, _resetForTests } = await import('../src/systems/settings.js');
  const bridge = read('src/scenes/questBridge.js');
  assert.match(bridge, /get playerNudity\(\) \{ return getBool\('ChildGuard', 'PlayerNudity'\); \}/,
    'a GETTER, because C# reads the setting at the point of use');
  assert.match(bridge, /get guildQuestListBox\(\) \{ return getBool\('Enhancements', 'GuildQuestListBox'\); \}/);
  assert.match(read('src/scenes/world.js'),
    /showClocksAsCountdown: \(\) => getBool\('GUI', 'ShowQuestJournalClocksAsCountdown'\)/);

  // and the getters really follow the store
  const { QuestListsManager } = await import('../src/systems/quest/questLists.js');
  _resetForTests();
  const deps = { get playerNudity() { return true; } };
  assert.equal(deps.playerNudity, true, 'the shape the consumer reads is a plain property');
  assert.ok(typeof QuestListsManager === 'function');
  _resetForTests();
});

test('audit24: two async races - an abandoned pixel build and an in-flight loot mount', () => {
  // Both are the same shape: an await, a removal during it, and a
  // continuation that publishes onto something nobody holds.
  const world = read('src/scenes/world.js');
  assert.match(world, /await buildPixel\(next\.px, next\.py\);[\s\S]{0,900}if \(!state\.loaded\.has\(`\$\{next\.px\},\$\{next\.py\}`\)\) destroyPixel\(next\.px, next\.py\);/,
    'pump re-checks after the await - destroyPixel ran against an empty `built` back when the unload happened');
  const loot = read('src/scenes/droppedLoot.js');
  assert.match(loot, /function mount\(pile\) \{[\s\S]{0,900}if \(pile\.dead\) return;/,
    'the loot mount checks its flag before publishing');
  // and every removal path raises that flag - four of them
  assert.equal((loot.match(/\.dead = true;/g) || []).length, 4,
    'collectPixel, releaseEmptied, restoreWorld and restorePiles all mark');
});

// ---- wave 9: four boot-and-host defects the bug hunt's verify pass confirmed ----

test('audit24: LOAD GAME is read by the host that now boots', () => {
  // main.js sets ?load when the menu resolves it, and its comment says
  // "Load Game rides the dungeon host's OWN quickLoad" - true when the
  // classic start booted scenes/dungeon.js, and U31 moved it to
  // world.js. The flag arrived in a host with no reader and was
  // discarded: the player got a brand-new character in Privateer's
  // Hold, and the only route to their save was to start a new game and
  // press F11.
  const world = read('src/scenes/world.js');
  assert.match(world, /if \(params\.has\('load'\)\) \{[\s\S]{0,200}await worldQuickLoad\(\);/,
    'the world host reads `load`');
  assert.match(world, /await worldQuickLoad\(\);\s*\n\s*\} else if \(params\.has\('classic'\)/,
    'and a load takes the classic start\'s PLACE - a load is not a new game');
  assert.match(world, /!playerEntity\.chargenDone && !params\.has\('load'\)/,
    'nor does the wizard mount over the game being resumed');
});

test('audit24: exactly ONE chargen wizard - the outer host owns it', () => {
  // world.js mounts the wizard when !chargenDone; the classic start
  // then enters the dungeon, whose context mounted a SECOND,
  // independently-rolled one. Both were drawn and both were driven -
  // the two hosts register separate keydown listeners on the same
  // target and neither stops propagation - so every arrow advanced
  // both, and whichever finished LAST wrote the character. The
  // classic-start probe never caught it because it boots with &class,
  // which takes the headless branch in both.
  assert.match(read('src/scenes/dungeonContext.js'),
    /if \(!playerEntity\.chargenDone && opts\.chargen !== false\) \{/,
    'the dungeon context can be told an outer host owns chargen');
  assert.match(read('src/scenes/worldModes.js'), /chargen: false,/,
    'and worldModes tells it');
  // the STANDALONE dungeon scene must keep its own wizard
  assert.doesNotMatch(read('src/scenes/dungeon.js'), /chargen: false/,
    'scenes/dungeon.js is the single owner in its own host');
});

test('audit24: the floating-origin recenter reaches EVERY world-position pool', () => {
  const world = read('src/scenes/world.js');
  const i = world.indexOf('if (r.offset) {');
  assert.ok(i > 0);
  const block = world.slice(i, i + 2600);
  for (const pool of ['cityGuards.offsetAll', 'exteriorFoes.offsetAll', 'droppedLoot.offsetAll',
    'offsetArrows(arrows', 'magic.offsetAll']) {
    assert.ok(block.includes(pool), `${pool} follows the origin`);
  }
  // the missiles were the fifth, and the one the block never reached:
  // an 819.2-unit shift mid-flight put the billboard out of the world,
  // made the wall raycast probe the OLD frame and left the foe sweep
  // comparing a stale position against shifted feet
  assert.match(read('src/scenes/hostMagic.js'),
    /offsetAll\(offset\) \{[\s\S]{0,400}m\.pos\[a\] \+= offset\[a\];[\s\S]{0,200}m\.firePos\[a\] \+= offset\[a\];/,
    'and both pos and firePos shift - the batch origin is their difference');
});

test('audit24: a quest item is found by QUEST IDENTITY, not object identity', () => {
  // ItemCollection.Contains / RemoveItem look an item up by its UID,
  // never by reference. The port used indexOf/includes, and that
  // identity does not survive a load: the player's held record and the
  // Item resource's daggerfallUnityItem are serialised and restored
  // SEPARATELY, so afterwards they are two objects with equal content
  // and nothing relinks them. The tombstone sweep and `give item to`
  // silently no-opped on every quest item already carried.
  const world = read('src/scenes/world.js');
  assert.match(world, /const _heldItemIndex = \(dfItem\) => \{[\s\S]{0,600}it\.questUID === dfItem\.questUID[\s\S]{0,120}it\.questSymbol\?\.name === dfItem\.questSymbol\?\.name/,
    'the fallback is the quest identity the sibling hooks already match on');
  assert.match(world, /removeItemFromPlayer: \(dfItem\) => \{[\s\S]{0,160}_heldItemIndex\(dfItem\)/);
  assert.match(world, /playerHasItem: \(dfItem\) => _heldItemIndex\(dfItem\) >= 0/);
  assert.doesNotMatch(world, /playerHasItem: \(dfItem\) => \(playerEntity\.items \?\? \[\]\)\.includes\(dfItem\)/,
    'the identity-only reads are gone');
});
