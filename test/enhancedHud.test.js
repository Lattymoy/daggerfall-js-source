// PX30 - THE GAMEPLAY HUD, in the pixel language.
//
// Mac's reference is ESO's Clean UI: a compass across the top, the
// target named beneath it, three vitals along the bottom and the
// effects under those.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compassPlace, COMPASS_POINTS, COMPASS_SPAN } from '../src/ui/enhancedHud.js';
import { markFoeStruck, foeTarget, tickFoeTarget, clearFoeTarget, FOE_TARGET_SECONDS } from '../src/ui/hudFoeTarget.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PX30 compass: the shortest way round, and off the strip is HIDDEN', () => {
  // A point at 0.98 is just LEFT of a player facing 0.02, not most of
  // a turn to the right - the wrap is the whole geometry here.
  assert.ok(Math.abs(compassPlace(0, 0.02) - 0.42) < 0.01, 'north sits just left of centre');
  assert.equal(compassPlace(0.02, 0.02), 0.5, 'dead ahead is the middle');
  assert.ok(Math.abs(compassPlace(0.98, 0.02) - 0.34) < 0.01, 'and 0.98 is LEFT, not right');
  // Off the visible span is NULL, never clamped: a marker pinned to the
  // rim says "north is exactly there", which is a lie.
  assert.equal(compassPlace(0.5, 0.02), null, 'south is behind you and not drawn');
  assert.equal(compassPlace(0.25, 0), null, 'east, a quarter turn away, is off a quarter-turn strip');
  // The edges are inclusive and symmetric.
  assert.equal(compassPlace(COMPASS_SPAN / 2, 0), 1);
  assert.equal(compassPlace(-COMPASS_SPAN / 2, 0), 0);
  assert.equal(COMPASS_POINTS.length, 8, 'eight points, the circle a player turns through');
  assert.deepEqual(COMPASS_POINTS.map(([l]) => l), ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
});

test('PX30 target: the blow you landed, and it FADES', () => {
  // Daggerfall tells you nothing about a foe's health, ever - this is a
  // DEPARTURE, and its source is the strike rather than the reticle,
  // because a reticle target wants a foe raycast every frame for an
  // answer the player only wants while fighting.
  clearFoeTarget();
  assert.equal(foeTarget(), null);
  const foe = { entity: { name: 'Grizzly Bear', health: 30, maxHealth: 50 } };
  markFoeStruck(foe, { fromPlayer: false });
  assert.equal(foeTarget(), null, 'a foe hitting ANOTHER foe is not your target');
  markFoeStruck(foe, { fromPlayer: true });
  assert.deepEqual({ ...foeTarget(), fade: 1 }, { name: 'Grizzly Bear', health: 30, maxHealth: 50, fade: 1 });
  // It goes. A bar that never leaves is furniture.
  tickFoeTarget(FOE_TARGET_SECONDS - 1);
  assert.ok(foeTarget(), 'still there a second before its time');
  assert.ok(foeTarget().fade < 1, 'and fading');
  tickFoeTarget(2);
  assert.equal(foeTarget(), null);
  // A dead thing has no health to report.
  markFoeStruck(foe, { fromPlayer: true });
  foe.dead = true;
  assert.equal(foeTarget(), null);
  clearFoeTarget();
});

test('PX30: the HUD rides the ONE host-agnostic call, and the classic keeps its own', () => {
  const hud = read('src/ui/hud.js');
  // drawHud is what all four hosts already make, "last, over the
  // viewmodel" - the same reasoning the damage flash rides.
  // PX30b gave the call the two hands; the shape it guards is
  // unchanged - one branch, on the skin, and it RETURNS.
  assert.match(hud, /if \(isEnhanced\(\) && typeof document !== 'undefined'\) \{\s*\n\s*drawEnhancedHud\(vitals, heading01, dt, \{/);
  const branch = hud.slice(hud.indexOf('if (isEnhanced() && typeof document'));
  assert.ok(branch.indexOf('return;') < branch.indexOf('if (!art) return;'), 'the enhanced branch returns');
  // ABOVE the `!art` return, like the flash: the enhanced HUD reads no
  // ARENA2, and a player whose HUD art failed still has vitals.
  assert.ok(hud.indexOf('drawEnhancedHud(') < hud.indexOf('if (!art) return;'), 'above the art gate');
  // ...and it RETURNS, so the classic bars, compass and icons do not
  // draw underneath it. Two HUDs at once is not a skin.
  const classic = hud.slice(hud.indexOf('if (!art) return;'));
  assert.ok(classic.includes('vitalsSkin(art)'), 'the classic HUD is still all there, below');
  // Both damage paths mark the target, and neither was asked for
  // anything new: `fromPlayer` is the flag each already took.
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']) {
    assert.match(read(f), /markFoeStruck\((foe|f), \{ fromPlayer \}\);/, `${f} marks the struck foe`);
  }
});

test('PX30: it is a READOUT, and it is updated rather than rebuilt', () => {
  const src = read('src/ui/enhancedHud.js');
  const css = read('src/ui/enhancedStyle.js');
  // Nothing is pressed, nothing registers with the overlay stack, and
  // Tab does not close it - it is the game's own face.
  assert.match(css, /\.hud \{ position: fixed; inset: 0; z-index: 4; pointer-events: none;/);
  assert.match(src, /setAttribute\('aria-hidden', 'true'\)/);
  assert.doesNotMatch(src, /registerOverlay|addEventListener/, 'a readout listens to nothing');
  // UPDATED, NOT REBUILT: a per-frame innerHTML is PX19k's entrance
  // replay at sixty times a second. Every write is guarded.
  assert.match(src, /const put = \(node, key, value\) => \{\s*\n\s*if \(last\[key\] === value\) return;/);
  assert.match(src, /const width = \(node, key, pct\) => \{[\s\S]{0,160}if \(last\[key\] === v\) return;/);
  assert.match(src, /if \(last\.effects !== key\) \{/, 'the effect row is rebuilt only when the SET changes');
  // THE ONE BUNDLE WALK. The first draft invented a second one that
  // read a shape nothing produces, and the row came back empty.
  assert.match(src, /import \{ liveBundles \} from '\.\.\/systems\/mysticism\.js'/);
  assert.doesNotMatch(src, /entity\?\.effects\?\.bundles/, 'no second walk');
  assert.match(read('src/ui/hudActiveSpells.js'), /import \{ liveBundles \} from '\.\.\/systems\/mysticism\.js'/,
    'the same one the classic icons read');
});

test('PX30b: the breath bar and the two hands - each only when there is one', () => {
  const src = read('src/ui/enhancedHud.js');
  const css = read('src/ui/enhancedStyle.js');
  // THE BREATH is DFU's own two laws, imported rather than restated:
  // drawn only while holding breath (Amount 0 draws nothing) and RED
  // below (endurance >> 3) + 4.
  assert.match(src, /const showBreath = held > 0;/);
  assert.match(src, /breathShortThreshold\(liveStat\(vitals, 'endurance'\)\) > held/);
  // AUDIT 39 F133 widened this import (compassMarkerLerp +
  // DETECT_MARKER_RGB for the Detect markers); the law pinned here is
  // that the threshold comes from the classic HUD rather than being
  // restated, so the pin asks for the name, not the whole list.
  assert.match(src, /import \{ compassScroll, breathShortThreshold[^}]*\} from '\.\/hud\.js'/,
    'the threshold is the classic HUD\'s own');
  assert.match(read('src/ui/hud.js'), /export const breathShortThreshold = \(liveEndurance\) => \(liveEndurance >> 3\) \+ 4;/);
  assert.match(src, /maxBreath\(vitals\) \|\| 1/, 'and the ceiling is statMods\', not a number typed here');
  assert.match(css, /\.hud-breath \{ display: none;[\s\S]{0,80}\.hud-breath\.on \{ display: flex; \}/);
  // THE HANDS. The reference's ability bar has no Daggerfall
  // equivalent - there are no hotkeyed abilities - but the two things
  // it would hold do exist. Each plaque draws only when filled: an
  // empty one is PX14's drawn door, and a HUD is the worst place for
  // furniture that says nothing.
  assert.match(src, /parts\.readied\.classList\.toggle\('on', !!readyName\);/);
  assert.match(src, /parts\.weapon\.classList\.toggle\('on', !!weaponName\);/);
  assert.match(css, /\.hud-hand \{ display: none;/);
  assert.match(css, /\.hud-hand\.on \{ display: flex; \}/);
  // The host hands them over through drawHud's own options bag, so a
  // host that knows neither passes neither.
  // AUDIT 28 W2a re-aimed from the literal bag-tail: the bag grew
  // weaponSheathed after these two, and the law is that both are there.
  assert.match(read('src/ui/hud.js'), /readied = null, weapon = null(, [^}]*)? \} = \{\}\)/);
  assert.match(read('src/ui/hud.js'), /readied: readied \?\? null,\s*\n\s*weapon: weapon \?\? null,/);
  // ...and both are still GUARDED writes, like everything else here.
  assert.match(src, /if \(last\.readied !== readyName\) \{/);
  assert.match(src, /if \(last\.weapon !== weaponName\) \{/);
});

test('AUDIT 39: every host that draws a HUD fills the two hands', () => {
  // "A host that knows neither passes neither" was true of all FOUR of
  // them: PX30b built the plaques, hud.js forwarded the keys, and no
  // drawHud call site ever supplied one - so both were permanently
  // display:none in the played game, which is a drawn door with a
  // stylesheet block behind it. Every host had both values one
  // argument over from the weaponSheathed it already passed.
  const hosts = {
    'src/scenes/world.js': 'weaponRig.playerWeapon.weapon',
    'src/scenes/exterior.js': 'weaponRig.playerWeapon.weapon',
    'src/scenes/worldModes.js': 'interiorWeapon.playerWeapon.weapon',
    'src/scenes/dungeonContext.js': 'playerWeapon.weapon',
  };
  for (const [f, rig] of Object.entries(hosts)) {
    const src = read(f);
    const at = src.indexOf('drawHud(renderer, canvas, hudArt');
    assert.ok(at > 0, `${f} draws no HUD`);
    // the bag ends at the call's own closing brace
    const bag = src.slice(at, src.indexOf('});', at));
    assert.match(bag, /readied: magic[?.]*\.readied[?.]*\(\) \?\? null,/, `${f} hands over no readied spell`);
    assert.ok(bag.includes(`weapon: ${rig} ?? null,`), `${f} hands over no held weapon`);
    // and the rig it reads is the SAME one weaponSheathed comes off,
    // which is what stops a host reading two different weapons.
    assert.ok(bag.includes(`${rig.replace(/\.weapon$/, '')}.sheathed`), `${f} reads two rigs`);
  }
});

test('PX30c: the HUD scales from a SETTING, and the percentage lives in the bar', () => {
  const src = read('src/ui/enhancedHud.js');
  const css = read('src/ui/enhancedStyle.js');
  // THE SCALE is a setting beside DFU's own LargeHUDUndockedScale and
  // read the same way, so it lands in the catalog the enhanced screens
  // already render and is saved with everything else - no new
  // machinery for a number a player wants to change.
  // IT IS NOT A DFU SETTING, and two pins said so before I listened:
  // settingsDefaults.js is BAKED from DFU's vendored ini and nothing
  // hand-edits it (AUDIT 17e F9), and the tier map's own law is that
  // every key in it "is a real DFU setting". So it lives in the PORT'S
  // OWN PREFS, beside the other things only this port has.
  assert.doesNotMatch(read('src/systems/settingsDefaults.js'), /hudScale|EnhancedHUDScale/);
  assert.doesNotMatch(read('src/systems/settings.js'), /EnhancedHUDScale/);
  assert.match(read('src/systems/uiPrefs.js'), /^\s*hudScale: 1,$/m);
  assert.match(src, /getPref\('hudScale'\)/);
  assert.match(read('src/ui/enhancedMenu.js'), /setPref\('hudScale', next\);/);
  assert.match(read('src/ui/enhancedMenu.js'), /'Gameplay HUD scale'/);
  // NAMED apart from the classic HUD's own `hudScale(canvas)` - the
  // one-home pin caught that collision on the first full run.
  assert.match(src, /export const enhancedHudScale = \(\) => \{/);
  assert.doesNotMatch(src, /export const hudScale\b/);
  assert.match(read('src/ui/hud.js'), /hudScale\(/, 'the classic one keeps its name');
  // CLAMPED: a HUD is not a place to let a typo hide the game.
  assert.match(src, /export const HUD_SCALE_MIN = 0\.5;/);
  assert.match(src, /export const HUD_SCALE_MAX = 2;/);
  assert.match(src, /Math\.max\(HUD_SCALE_MIN, Math\.min\(HUD_SCALE_MAX, v\)\)/);
  assert.match(src, /if \(!Number\.isFinite\(v\) \|\| v <= 0\) return 1;/, 'and an absent or broken value is 1, not 0');
  // ONE VARIABLE the whole sheet reads, so a change moves every bar,
  // chip and letter together rather than thirty rules drifting.
  assert.match(css, /--hud-scale: 1; \}/);
  assert.match(css, /\.hud-top \{[\s\S]{0,140}scale\(var\(--hud-scale\)\)/);
  assert.match(css, /\.hud-bottom \{[\s\S]{0,140}scale\(var\(--hud-scale\)\)/);
  assert.match(src, /host\.style\.setProperty\('--hud-scale', String\(scale\)\);/);
  assert.match(src, /if \(last\.scale !== scale\) \{/, 'guarded, like every other write here');
  // THE PERCENTAGE IS IN THE BAR, with the label beside it - a figure
  // outside is a second thing to look at, and a colour alone is
  // something a player has to learn.
  assert.match(src, /track\.append\(fill, el\('span', 'hud-vlabel', label\), num\);/);
  assert.match(css, /\.hud-vital \.hud-fill \{ position: absolute; inset: 0;/, 'the fill is behind them');
  assert.match(css, /\.hud-vlabel \{ position: relative; z-index: 1;/);
  assert.match(css, /\.hud-num \{ position: relative; z-index: 1;/);
  // NEVER 0% WHILE ANYTHING IS LEFT - the quest timer's "never 0 min"
  // law, on a bar this time.
  // (PX30d added the upper clamp beside this floor - see its pin.)
  assert.match(src, /const shown = now > 0 \? Math\.max\(1, Math\.min\(100, Math\.round\(pct\)\)\) : 0;/);
  assert.match(src, /`\$\{shown\}%`/);
});

test('PX30d: fatigue has no FIELD, it has a LAW - and the bar said 576000%', () => {
  // Mac: "the stamina percentage is a super large percentage." DFU
  // stores fatigue x64 and computes its ceiling as (Str + End) x 64;
  // there is no `maxFatigue` on the entity at all. Reading
  // `vitals.maxFatigue || 1` therefore divided by ONE, and a real
  // player - 90 fatigue at 50/50 - read 576000%.
  //
  // The CLASSIC HUD never had this bug because it composes a snapshot
  // with maxFatigue(vitals) in it, and this branch returns BEFORE that
  // snapshot is built: it was reading the raw entity while the classic
  // read the law. Same law, same module, is the fix.
  const src = read('src/ui/enhancedHud.js');
  assert.match(src, /import \{ maxBreath, maxFatigue, liveStat \} from '\.\.\/systems\/statMods\.js'/);
  assert.match(src, /\['fatigue', parts\.fatigue, vitals\.fatigue \?\? 0, maxFatigue\(vitals\) \|\| vitals\.maxFatigue \|\| 1\]/);
  assert.match(read('src/systems/statMods.js'),
    /export function maxFatigue\(entity\) \{\s*\n\s*return \(liveStat\(entity, 'strength'\) \+ liveStat\(entity, 'endurance'\)\) \* FATIGUE_MULTIPLIER;/);
  // ...and it is the SAME line the classic HUD's own snapshot uses.
  assert.match(read('src/ui/hud.js'), /maxFatigue: maxFatigue\(vitals\) \|\| 1,/);
  // Health and magicka DO have fields, and are left reading them.
  assert.match(src, /\['health', parts\.health, vitals\.health \?\? 0, vitals\.maxHealth \|\| 1\]/);
  assert.match(src, /\['magicka', parts\.magicka, vitals\.magicka \?\? 0, vitals\.maxMagicka \|\| 1\]/);
  // CLAMPED AT BOTH ENDS: a bar cannot be more than full, and a number
  // that says otherwise is a bug wearing a percent sign. The floor at
  // 1 stays - never 0% while anything is left.
  assert.match(src, /const shown = now > 0 \? Math\.max\(1, Math\.min\(100, Math\.round\(pct\)\)\) : 0;/);
});
