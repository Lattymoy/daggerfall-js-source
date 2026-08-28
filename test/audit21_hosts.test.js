// AUDIT 21 - the HOSTS lane. The six scene hosts (world, exterior, dungeon,
// dungeonContext, interior, worldModes) have ZERO node execution coverage, and
// that is the single most repeated bug shape in this project: a feature lands
// in one host and not its siblings, and every test stays green.
//
// So these are RULES over the host sources, plus behavioural pins on the
// shared machinery underneath them. A rule is weaker than driving the code -
// AUDIT 21 said so about source regexes repeatedly - so each one is written
// against the SHAPE that has to hold, not a word that happens to appear.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlayerTicker } from '../src/scenes/shared.js';
import { setWorldMinutes, worldMinutes, resetMagicRoundMarker, CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { LevelUpScreen } from '../src/ui/charsheet.js';
import { raiseSkills } from '../src/systems/advancement.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (p) => readFileSync(join(SRC, p), 'utf8');
/** Source with comments stripped. A rule that greps raw text matches the
 *  PROSE explaining the rule - AUDIT 21's F7 mutation caught exactly that:
 *  removing the drawHud CALL left the word in the comment above it and the
 *  rule passed. */
const code = (p) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

/** The hosts that build a player ticker - i.e. that can level a character. */
const TICKER_HOSTS = ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js'];

test('AUDIT 21 hosts F3: every ticker host passes onLevelUp', () => {
  // Without it advancement.js takes its HEADLESS arm:
  //     if (!onLevelUp) applyLevelUp(entity, (stats, pool) =>
  //         spendPoolLowest(stats, Object.keys(stats), pool), rolls);
  // - no message, no screen, and every attribute point dumped into your
  // LOWEST stats. The dungeon host has passed one since U3; these three
  // passed only `say`, so the SAME XP built a different character depending
  // on where you were standing when you crossed the threshold.
  const missing = [];
  for (const h of TICKER_HOSTS) {
    const text = code(h);
    for (const m of text.matchAll(/createPlayerTicker\((.*?)\n\s*\}\);/gs)) {
      if (!/onLevelUp\s*:/.test(m[1])) missing.push(h);
    }
    // a single-line call cannot carry the key at all
    for (const m of text.matchAll(/createPlayerTicker\([^\n]*\);/g)) {
      if (!/onLevelUp\s*:/.test(m[0])) missing.push(`${h} (one-liner)`);
    }
  }
  assert.deepEqual(missing, [],
    `these hosts build a player ticker with no onLevelUp, so a level-up there\n`
    + `silently auto-spends into the lowest stats:\n${missing.join('\n')}`);

  // and each one must open the SCREEN, not just log
  for (const h of TICKER_HOSTS) {
    assert.match(code(h), /new LevelUpScreen\(playerEntity\)/,
      `${h} must open the level-up screen, not merely announce the level`);
  }
});

test('AUDIT 21 hosts F3: onLevelUp really suppresses the headless auto-spend', () => {
  // The behavioural half, on the shared machinery the rule guards. If this
  // ever stops being true, the rule above is guarding nothing - and the first
  // draft of this pin WAS vacuous (its fixture never levelled at all, so both
  // arms trivially matched), which is the exact shape this audit keeps
  // finding. The assertions below fail if no level-up fires.
  const N = 40;
  const career = { advancementMultiplier: 0.3, primarySkills: [0, 1, 2],
    majorSkills: [3, 4], minorSkills: [5, 6, 7, 8, 9, 10] };
  const mk = () => ({
    level: 1, health: 100, maxHealth: 100, fatigue: 10000, magicka: 100,
    chargenDone: true, reflexes: 2, lastSkillCheckTime: 0, career,
    stats: { strength: 40, intelligence: 30, willpower: 35, agility: 45,
      endurance: 50, personality: 25, speed: 55, luck: 20 },
    skills: Array.from({ length: N }, () => 50),
    skillUses: Array.from({ length: N }, () => 20000),
    startingLevelUpSkillSum: 0, currentLevelUpSkillSum: 0,
  });
  const base = mk().stats;

  const headless = mk();
  const raisedH = raiseSkills(headless, 400, () => 0.5, null);
  assert.ok(raisedH.length > 0, 'the fixture must actually raise skills');
  assert.ok(headless.level > 1, 'and actually LEVEL - otherwise this pin proves nothing');
  assert.notDeepEqual(headless.stats, base,
    'the headless arm SPENDS the pool - into the lowest stats, unasked');

  let opened = 0;
  const hooked = mk();
  raiseSkills(hooked, 400, () => 0.5, () => { opened++; });
  assert.equal(opened, 1, 'onLevelUp fires exactly once');
  assert.deepEqual(hooked.stats, base,
    'with onLevelUp the stats are NOT auto-spent - the screen decides');
  assert.ok(hooked.readyToLevelUp && hooked.pendingLevel > 1,
    'the level is PENDING, waiting for the screen');
  assert.notDeepEqual(headless.stats, hooked.stats,
    'the two arms really do differ - which is the whole finding');
});

test('AUDIT 21 hosts F3: a non-ChoiceWindow overlay gets the FULL action map', () => {
  // A LevelUpScreen needs up/down to move the cursor and plus/minus to spend
  // the pool. townTalk understood Escape and Enter/E and nothing else, and
  // worldModes passed the raw key CODE - so even once the screen opened above
  // ground it could not be driven. Both now route through overlayAction, the
  // same map routeKey feeds the dungeon host.
  // townTalk owns its own seam and calls the map directly.
  assert.match(code('scenes/townTalk.js'), /overlayAction\(e\)/,
    'scenes/townTalk.js must use the shared action map');
  assert.match(code('scenes/townTalk.js'), /isChoiceWindow/,
    'scenes/townTalk.js must still pass raw codes to a ChoiceWindow');
  // U43: worldModes' interior arm satisfies the same law THROUGH
  // routeKey, whose overlay branch makes exactly this choice (raw code
  // for a "native" window, overlayAction for anything else). It used
  // to re-implement the fork beside it, which is the duplication this
  // pin was written about - so what it must show now is that it
  // answers routeKey's question and forwards, and does NOT map again.
  const modes = code('scenes/worldModes.js');
  assert.match(modes, /get overlayIsNative\(\) \{ return !!interiorOverlay\?\.isChoiceWindow; \}/,
    'worldModes must answer routeKey\'s native question from the window itself');
  assert.equal(/overlayAction\(/.test(modes), false,
    'worldModes must not map the action a second time - routeKey already did');
  assert.match(code('ui/input.js'), /if \(ctx\.overlayIsNative\) \{ ctx\.overlayInput\(e\.code, e\); return true; \}/,
    'and routeKey is where that fork lives');
  // and the screen really does want those actions
  const s = new LevelUpScreen({ stats: { strength: 40, intelligence: 30, willpower: 35,
    agility: 45, endurance: 50, personality: 25, speed: 55, luck: 20 }, pendingLevel: 2 }, () => 0.5);
  const cursor0 = s.cursor;
  s.input('down');
  assert.notEqual(s.cursor, cursor0, "'down' moves the cursor - a raw key code would not");
  const pool0 = s.pool;
  s.input('plus');
  assert.equal(s.pool, pool0 - 1, "'plus' spends from the pool");
});

test('AUDIT 21 hosts F4: every host that renders a 3D scene moves the LISTENER', () => {
  // The listener was set by world, exterior and dungeonContext and by nothing
  // in worldModes, so in INTERIOR mode it stayed parked at the town's world
  // position while interiorContext played door sounds at interior-LOCAL
  // coordinates - against a linear model with a finite maxDistance, so out of
  // range entirely.
  const hosts = ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js', 'scenes/worldModes.js'];
  const deaf = hosts.filter((h) => !/audio\.setListener\(/.test(code(h)));
  assert.deepEqual(deaf, [],
    `these hosts render a 3D scene and never move the audio listener, so every\n`
    + `positional sound they play is measured from wherever another host left it:\n${deaf.join('\n')}`);
  // in worldModes it must be in the MODAL frame, before the mode branches -
  // one call covering both interior and dungeon
  const modes = code('scenes/worldModes.js');
  const atFrame = modes.indexOf('audio.setListener(');
  const atDungeonBranch = modes.indexOf("if (mode === 'dungeon' && dungeonCtx)");
  assert.ok(atFrame > 0 && atFrame < atDungeonBranch,
    'the listener must move before the mode branches, so INTERIOR mode is covered too');
});

test('AUDIT 21 hosts: the ticker carriers still agree on the ONE world clock', () => {
  // AUDIT 21 F2's law, re-asserted from the hosts lane's side: adding
  // onLevelUp must not have reintroduced a private accumulator.
  const before = worldMinutes();
  try {
    const entity = { health: 500, maxHealth: 500, fatigue: 10000, magicka: 200, level: 1, skills: {} };
    const a = createPlayerTicker(entity, {});
    const b = createPlayerTicker(entity, { onLevelUp: () => {} });
    setWorldMinutes(0);
    a.tick(60 / CLASSIC_MINUTES_PER_SECOND);
    assert.equal(b.classicMinutes, a.classicMinutes);
    assert.equal(worldMinutes(), a.classicMinutes);
  } finally {
    setWorldMinutes(before);
  }
});

test('AUDIT 21 hosts F6: there is ONE damage door, and it checks for death', async () => {
  // DYING OUTSIDE A DUNGEON DID NOTHING AT ALL. A guard beat you to 0 HP in
  // the street and the game carried on - you kept walking, kept swinging, and
  // the guards kept hitting a corpse. Four paths wrote player health and
  // exactly one of them (the dungeon's) checked. So the check moved to the
  // write, and the PRESENTER is registered by whichever host is live.
  const { hurtPlayer, setDeathPresenter } = await import('../src/characters/playerEntity.js');
  const prev = setDeathPresenter(null);
  try {
    let died = 0;
    setDeathPresenter(() => { died++; });

    const e = { health: 10, maxHealth: 10 };
    assert.equal(hurtPlayer(e, 3), false, 'a survivable blow does not fire the presenter');
    assert.equal(e.health, 7);
    assert.equal(died, 0);

    assert.equal(hurtPlayer(e, 99), true, 'the killing blow returns true');
    assert.equal(e.health, 0, 'and health FLOORS at 0 - it never goes negative');
    assert.equal(died, 1);

    // zero and negative damage are no-ops, including for death
    const alive = { health: 5, maxHealth: 5 };
    assert.equal(hurtPlayer(alive, 0), false);
    assert.equal(hurtPlayer(alive, -3), false);
    assert.equal(alive.health, 5);
    assert.equal(died, 1, 'a heal-shaped call must not present a death');
  } finally {
    setDeathPresenter(prev);
  }
});

test('AUDIT 21 hosts F6: the fall and ticker paths go through the door too', async () => {
  const { setDeathPresenter } = await import('../src/characters/playerEntity.js');
  const { applyFallLanding } = await import('../src/scenes/shared.js');
  const prev = setDeathPresenter(null);
  const before = worldMinutes();
  try {
    let died = 0;
    setDeathPresenter(() => { died++; });

    // FALL DAMAGE, the no-`hurt` arm - used by all three hosts.
    const faller = { health: 4, maxHealth: 50 };
    applyFallLanding(faller, 400);
    assert.equal(faller.health, 0, 'a long fall kills');
    assert.equal(died, 1, 'and raises the death screen, which it never used to');

    // and an explicit `hurt` sink still wins, so a host that wants its own
    // routing is not overridden
    let routed = 0;
    const other = { health: 50, maxHealth: 50 };
    applyFallLanding(other, 400, { hurt: () => { routed++; } });
    assert.equal(routed, 1);
    assert.equal(other.health, 50, 'the sink took it, not the door');

    // THE TICKER's hurt sink - disease, poison and continuous damage. Driven
    // for real: a lethal continuous-damage effect run through the ticker's own
    // rounds, because the sink is where the effect damage lands.
    const before2 = died;
    const sick = {
      health: 2, maxHealth: 100, fatigue: 100000, magicka: 50, level: 1, skills: {},
      activeEffects: [{
        kind: 'continuousDamage', roundsRemaining: 60, casterLevel: 1, saveScaled: false,
        effect: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0,
          magnitudeLevelHigh: 0, magnitudePerLevel: 1 },
      }],
    };
    const ticker = createPlayerTicker(sick, {});
    setWorldMinutes(0);
    resetMagicRoundMarker(0);
    ticker.tick(0);                                   // establish the marker
    setWorldMinutes(5);                               // five classic minutes of effect rounds
    ticker.tick(0);
    assert.equal(sick.health, 0, 'a continuous-damage effect can kill');
    assert.equal(died, before2 + 1,
      "and the ticker's hurt sink raises the death screen - it used to write health raw");
  } finally {
    setDeathPresenter(prev);
    setWorldMinutes(before);
  }
});

test('AUDIT 21 hosts F6: no host writes player health raw any more', () => {
  // The rule that keeps the door the ONLY door. `playerEntity.health =
  // Math.max(0, ...)` appearing in a host is the shape that made this
  // possible: four writers, one of which remembered to check.
  const HOSTS = ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js',
    'scenes/dungeonContext.js', 'scenes/interior.js', 'scenes/dungeon.js', 'scenes/shared.js'];
  const raw = [];
  for (const h of HOSTS) {
    const text = code(h);
    for (const m of text.matchAll(/^\s*\w*[Ee]ntity\.health\s*=\s*Math\.max\(0[^\n]*/gm)) {
      raw.push(`${h}: ${m[0].trim()}`);
    }
  }
  assert.deepEqual(raw, [],
    'these take player health without going through the one damage door, so a\n'
    + 'killing blow there leaves the player walking around at 0 HP:\n' + raw.join('\n'));

  // and every gameplay host registers a presenter, or the door has nobody to call
  for (const h of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js']) {
    assert.match(code(h), /(?<![\w$])setDeathPresenter\(/, `${h} must register a death presenter`);
    assert.match(code(h), /new DeathScreen\(/, `${h} must actually raise the screen`);
    // D1: raising it is half the law - the run has to END, or death is
    // a screen you sit on for ever. Every host hands the screen the
    // one shared onReset (the death video, then the title menu).
    // DC1 grew the constructor: every host now leads with the LIVE
    // eyeHeight/capsuleHeight pair (playerdeath.test.js pins each
    // host's exact form); this pin keeps holding the onReset tail.
    assert.match(code(h), /new DeathScreen\(\{ eyeHeight: [^\n]*, onReset: \(\) => endRunToTitleMenu\(renderer\) \}\)/,
      `${h} must wire the death screen to the shared end-of-run seam`);
  }
});

test('AUDIT 21 hosts F8: a swing costs fatigue in EVERY host that mounts a weapon rig', () => {
  // WeaponManager.cs:419-436 drains the swing's fatigue whatever it hits, then
  // takes the tally arm. The dungeon does both and the city guards do; the
  // INTERIOR rig did neither, so a shop was a free, fatigue-less place to
  // swing a longsword. AUDIT 18 pinned this into dungeonContext and
  // cityGuards - the interior rig was not in that list, which is the host-gap
  // shape all over again.
  const RIG_HOSTS = ['scenes/dungeonContext.js', 'scenes/worldModes.js'];
  for (const h of RIG_HOSTS) {
    const text = code(h);
    assert.match(text, /SWING_WEAPON_FATIGUE_LOSS/,
      `${h} mounts a weapon rig and must charge the swing`);
    assert.match(text, /tallySwingSkills\(/,
      `${h} must take the tally arm - Archery AND CriticalStrike for a bow`);
  }
  // and the interior arm must charge on BOTH paths - the bow arm used to
  // tally one skill and drain nothing, disagreeing with the dungeon's own
  const modes = code('scenes/worldModes.js');
  const drains = [...modes.matchAll(/drainInteriorFatigue\(SWING_WEAPON_FATIGUE_LOSS\)/g)];
  assert.equal(drains.length, 2, 'the bow arm and the melee arm each charge the swing');
  assert.doesNotMatch(modes, /tallySkill\(playerEntity, SKILLS\.Archery\)/,
    'the bow arm takes tallySwingSkills, not a single hand-picked skill');

  // the constant is the shared one, not a re-typed literal
  assert.match(code('scenes/hostCombat.js'), /SWING_WEAPON_FATIGUE_LOSS = 11/);
});

test('AUDIT 21 hosts F7: every gameplay host draws the HUD', () => {
  // ?world and ?exterior drew no status bar at all - no health, no fatigue, no
  // magicka, no compass. Guards hurt you there, falls hurt you, fatigue drains
  // every classic minute and diseases drain attributes, and you could see none
  // of it. Walk into the dungeon and the whole classic HUD appears; walk out
  // and it vanishes. Inside a BUILDING it vanished too, because drawHud lived
  // inside dungeonContext.drawFoes, which the interior arm never calls.
  //
  // ui/hud.js was already host-agnostic. This is a rule because the hosts have
  // no node coverage; tools/hudProbe.mjs is the other half - it boots both
  // exterior hosts for real and counts saturated pixels where the bars belong,
  // calibrated by mutation (1600/1799 with the draw, 438 without).
  const GAMEPLAY_HOSTS = ['scenes/world.js', 'scenes/exterior.js',
    'scenes/worldModes.js', 'scenes/dungeonContext.js'];
  const blind = GAMEPLAY_HOSTS.filter((h) => !/drawHud\(/.test(code(h)));
  assert.deepEqual(blind, [],
    'these hosts run gameplay and draw no status bar, so the player cannot see\n'
    + `health, fatigue, magicka or a compass while in them:\n${blind.join('\n')}`);

  // each must also LOAD the art - a drawHud call with nothing to draw is a
  // no-op, which is exactly how this would look fixed and not be
  for (const h of GAMEPLAY_HOSTS) {
    assert.match(code(h), /loadHud\(/, `${h} must load the HUD art it draws`);
  }

  // and drawHud must no-op rather than throw when the art is missing, which is
  // what lets a host without ARENA2 still boot
  assert.match(code('ui/hud.js'), /if \(!art\) return;/,
    'drawHud tolerates missing art - a missing file costs a HUD, never a boot');
});
