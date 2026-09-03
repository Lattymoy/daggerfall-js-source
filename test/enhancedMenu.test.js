// THE ENHANCED FRONT DOOR, pinned.
//
// These are SOURCE SWEEPS and say so. The screen is DOM and the boot
// is a host, neither of which node can drive; the behaviour is proven
// in a real browser by tools/enhancedMenuProbe.mjs, which boots the
// game with no ARENA2 at all. What a sweep CAN hold is the structure
// the browser check would not notice going wrong: a second copy of the
// design, a data gate that drifts back in front of the door, or an
// exit where there should not be one.
import { test } from 'node:test';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const exists = (p) => { try { read(p); return true; } catch { return false; } };

// THE ENHANCED BRANCH ALONE. Two of the first pins here SURVIVED their
// mutations because they searched the whole of main.js and matched the
// CLASSIC branch's identical lines instead - main.js carries a data
// gate and a `params.delete('load')` on both paths, so a sweep that
// does not scope reads the wrong one and reports the right answer for
// the wrong reason. Every assertion about the enhanced door is made
// against this slice only.
function enhancedBranch() {
  const src = read('src/main.js');
  const from = src.indexOf('if (isEnhanced()) {');
  assert.ok(from > 0, 'main.js lost its enhanced front door');
  const to = src.indexOf('\n  }', from);
  assert.ok(to > from, 'the enhanced branch is unclosed');
  return src.slice(from, to);
}

// ── ONE IMPLEMENTATION, TWO HOSTS ────────────────────────────────
// The prototype at /menu.html and the game mount the SAME module. A
// prototype carrying its own copy of the design is a prototype arguing
// about a screen the player will never see, and the divergence would
// be invisible until someone opened both at once.
test('the prototype page carries no design of its own', () => {
  const html = read('menu.html');
  assert.ok(!/--brass|--verdigris|\.railbtn|\.subbtn/.test(html),
    'menu.html must not hold tokens or layout - they live in src/ui/enhancedStyle.js');
  assert.match(html, /src\/tools\/enhancedMenu\.js/);
});

test('the prototype host is a mount and nothing else', () => {
  const src = read('src/tools/enhancedMenu.js');
  assert.match(src, /from '\.\.\/ui\/enhancedMenu\.js'/, 'it must mount the shipping module');
  // if this host ever grows a screen of its own it stops being a
  // prototype OF anything
  assert.ok(src.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length < 12,
    'the prototype host should stay a few lines - the screen is not its job');
});

test('the style module writes nothing at import time', () => {
  const src = read('src/ui/enhancedStyle.js');
  const top = src.split('export function')[0];
  assert.ok(!/document\.(head|body)\.append|appendChild/.test(top),
    'a module that touches the document when merely IMPORTED cannot be imported by a test');
  assert.match(src, /export function injectEnhancedStyle/);
  assert.match(src, /getElementById\(STYLE_ID\)\) return/, 'injection must be idempotent');
});

// ── THE DATA GATE SITS BEHIND THE DOOR, AND ONLY THERE ───────────
test('every path but the enhanced door gates ARENA2 first', () => {
  const src = read('src/main.js');
  // the dev scenes and the probe path each gate before they boot
  for (const scene of ['bootInterior', 'bootExterior']) {
    assert.match(src, new RegExp(`await ensureData\\(\\); return ${scene}\\(`),
      `${scene} must still gate the data before it boots`);
  }
  assert.match(src, /params\.has\('shot'\) \|\| params\.has\('nomenu'\)\) \{ await ensureData\(\)/,
    'the 25 probes in tools/ drive ?shot and must keep their data gate');
  // and the enhanced door runs BEFORE any of it
  const branch = enhancedBranch();
  const doorAt = branch.indexOf('runEnhancedMenu()');
  const gateAt = branch.indexOf('await ensureData();');
  assert.ok(doorAt > 0, 'the enhanced branch must open the menu');
  assert.ok(gateAt > doorAt,
    'the folder pick must come AFTER the menu resolves, or the door needs data it does not use');
});

test('the classic door still gates its data first', () => {
  const src = read('src/main.js');
  const doorAt = src.indexOf('runMenu(canvas');
  const gateAt = src.lastIndexOf('await ensureData();', doorAt);
  assert.ok(gateAt > 0 && gateAt < doorAt,
    'PICK03I0, its palette and FONT0003 are read before the classic menu draws a word');
});

// ── WHAT DOES AND DOES NOT LEAVE THE MENU ────────────────────────
// The law here has never been the COUNT; it is that the three shared
// destinations - settings, mods, about - are places inside this screen
// and not exits from it. U51 added the three in-game exits (resume,
// save, exit) and the pin now states both halves rather than a number
// that has to be edited every time the rail grows.
test('only game actions resolve the door - never a destination', () => {
  const src = read('src/ui/enhancedMenu.js');
  const calls = [...new Set([...src.matchAll(/onAction\('([a-z]+)'\)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(calls, ['continue', 'exit', 'load', 'new', 'resume', 'save'],
    'boot resolves continue/new/load; pause resolves resume/save/exit');
  for (const dest of ['settings', 'mods', 'about']) {
    assert.ok(!calls.includes(dest),
      `${dest} is a destination INSIDE this screen, not an exit from it`);
  }
});

// U51: and the two rails carry the two questions. Continue and New
// Game ask "which game", which is settled by the time the pause door
// mounts; Resume, Save and Exit ask "what now", which is the only
// thing a running game has left to ask.
test('the two rails differ only where the question does', () => {
  const src = read('src/ui/enhancedMenu.js');
  const list = (name) => {
    const m = new RegExp(`const ${name} = \\[([^\\]]*)\\]`).exec(src);
    assert.ok(m, `${name} is gone`);
    return m[1].split(',').map((s2) => s2.trim().replace(/^'|'$/g, '')).filter(Boolean);
  };
  const boot = list('SECTIONS_BOOT');
  const pause = list('SECTIONS_PAUSE');
  const shared = ['Load Game', 'Settings', 'Mods', 'About'];
  for (const s2 of shared) {
    assert.ok(boot.includes(s2), `${s2} must stay on the front door`);
    assert.ok(pause.includes(s2), `${s2} must reach the pause door too`);
  }
  // ENHANCED IS BOOT-ONLY, and that is the question it answers rather
  // than an omission: "how much of this is still Daggerfall" is
  // settled before a game starts, and two of its switches (the skin,
  // the road bake) cannot take effect without a reload anyway. A row
  // on the pause rail that quietly needed a restart would be the dead
  // affordance this project keeps finding.
  // TR3: Test Room joins the boot-only set - like Continue and New
  // Game it answers "which game", settled once one is running.
  assert.deepEqual(boot.filter((x) => !shared.includes(x)),
    ['Continue', 'New Game', 'Test Room', 'Enhanced']);
  assert.ok(!pause.includes('Test Room'), 'the room is a front door, not a pause row');
  assert.ok(!pause.includes('Enhanced'), 'and it must NOT reach the pause door');
  assert.deepEqual(pause.filter((x) => !shared.includes(x)), ['Resume', 'Save Game', 'Exit']);
  // SETTINGS IS THE POINT. U49's own record says settings were
  // reachable only at boot; a pause rail without them would have left
  // that true on the skin built to fix it.
  assert.ok(pause.includes('Settings'),
    'the whole reason this door exists is that settings were reachable only at boot');
});

test('R7: the Enhanced section has a pane, and it is wired to the rail', () => {
  // A rail entry with no pane throws on the click - the dispatch is a
  // lookup, so a missing key is `undefined(body)`.
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /function paneEnhanced\(body\)/, 'the pane must exist');
  assert.match(src, /enhanced: paneEnhanced/, 'and the boot dispatch must know it');
  // idOf('Enhanced') is what the dispatch keys on
  assert.match(src, /const idOf = \(label\) => label\.toLowerCase\(\)/);
});

test('R7: every switch on the Enhanced pane is REAL, and the rest say why not', () => {
  // The pane's own law, and the rail's: an enhancement that does not
  // exist is listed with its reason rather than dropped, because a list
  // with a hole teaches the player the hole is permanent - but it must
  // NEVER be drawn as a control. A button that looks live and does
  // nothing is the dead affordance AUDIT F4 found on Delete.
  const src = read('src/ui/enhancedMenu.js');
  const from = src.indexOf('function paneEnhanced(body)');
  const pane = src.slice(from, src.indexOf('\n}', from));

  // the live half toggles keys that actually exist in the prefs store
  const prefs = read('src/systems/uiPrefs.js');
  for (const m of pane.matchAll(/prefRow\('(\w+)'/g)) {
    assert.match(prefs, new RegExp(`\\n\\s*${m[1]}:`),
      `the pane toggles '${m[1]}', which is not a uiPrefs key`);
  }
  // Roads was the switch this arc built, and it went with the road
  // system (2026-08-29, Mac's call). The pane must still carry a REAL
  // one, or the law above ("every switch is real") is vacuous on an
  // empty list - the procedural sky is it.
  // EE1: the sky switch became ENHANCED ENVIRONMENTS, which contains it.
  assert.match(pane, /prefRow\('enhancedEnvironments'/, 'the pane carries no live switch at all');
  assert.doesNotMatch(pane, /prefRow\('roads'/, 'the roads switch is back without its system');
  assert.match(pane, /skinRow\(\)/, 'and the skin switch comes home here');

  // the inert half carries a reason and NO control
  assert.match(pane, /inertRow\(/, 'unbuilt enhancements must still be listed');
  const inert = read('src/ui/enhancedMenu.js');
  const iFrom = inert.indexOf('function inertRow(');
  const inertFn = inert.slice(iFrom, inert.indexOf('\n}', iFrom));
  assert.ok(!/onclick/.test(inertFn), 'an inert row must not be clickable');
  assert.ok(!/el\('button'/.test(inertFn), 'nor drawn as a button');
});

test('R7: the pane does not claim a feature the tree does not have', () => {
  // Enhanced Music and the Morrowind 3D layer were both built and
  // REVERTED WHOLE. Listing either as a live switch would be the
  // screen lying about the build. (The sky came OFF this list
  // with RA1: ES1 shipped a procedural sky and the pane still said
  // "not built" - the same lie with the sign flipped.)
  const src = read('src/ui/enhancedMenu.js');
  const from = src.indexOf('function paneEnhanced(body)');
  const pane = src.slice(from, src.indexOf('\n}', from));
  for (const gone of ['music', 'mwfp']) {
    assert.ok(!new RegExp(`prefRow\\('${gone}`).test(pane),
      `${gone} has no engine in this tree and must not be a switch`);
  }
  // RA1: the sky IS built (render/enhancedSky.js, on by default), so
  // the pane must offer the switch and must no longer call it a hole.
  // EE1: that switch is ENHANCED ENVIRONMENTS now, which contains the
  // sky and everything the arc adds after it.
  assert.match(pane, /prefRow\('enhancedEnvironments'/, 'the ES1 sky must be a real switch');
  assert.ok(!/not built/.test(pane) || !/[Pp]rocedural sky[^]*not built/.test(pane),
    'the pane must not still label the shipped sky "not built"');
  assert.ok(!/Nothing procedural is built yet/.test(pane),
    'the stale ES1 denial sentence must be gone');

  // MW-D8 EXTENDS THIS PIN RATHER THAN NEGOTIATING WITH IT. The bans
  // above are the whole of what R7 could see - a `prefRow` that exists -
  // so a CARD that describes a feature was invisible to it in both
  // directions: it could not stop a lying card, and it could not notice
  // a truthful one. The Morrowind card now names the first-person arms,
  // so the claim has to be backed by a module the game actually imports.
  if (/first-person arm/i.test(pane)) {
    assert.ok(exists('src/combat/fpArm.js'),
      'the pane names the arms, so the engine must exist');
    assert.match(read('src/combat/weaponRig.js'), /import \{ fpArm(?:, [\w$, ]+)? \} from '\.\/fpArm\.js';/,
      'and the weapon rig must actually import it - a card is not a feature');
    // TR2: the button rides the ONE HOME for the build opts
    // (weaponRig.buildArmsFor) - the inline fpArm.build copy it
    // replaces carried the `!!gender` bug that built the female
    // skeleton for everyone.
    assert.match(pane, /buildArmsFor\(playerEntity\)/, 'and the button must call the real build through the one home');
  }
  // The stale denial, retired the way RA1 retired the sky's: the card
  // said the layer "is NOT built - it was removed", and that sentence
  // stopped being true the moment the arm shipped.
  assert.ok(!/first-person layer is NOT built/.test(pane),
    'the pre-MW-D8 denial sentence must go when the arm lands, exactly as the sky\'s did');
});

// AUDIT F3/F4: two destructive actions shipped without a confirm -
// Reset wiped every override on one press where the CLASSIC screen has
// always asked, and Delete did nothing at all while drawn undimmed and
// operable-looking. Delete is wired now; both go through one ask().
test('the destructive actions ask first', () => {
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /const ask = \(title, body, label, onYes\)/, 'one confirm, not two');
  const resetAt = src.indexOf('Reset everything to defaults');
  assert.match(src.slice(resetAt, resetAt + 400), /b\.onclick = \(\) => ask\(/,
    'Reset must ask - the classic screen does');
  const delAt = src.indexOf("label: 'Delete'");
  assert.match(src.slice(delAt, delAt + 400), /onClick: \(\) => ask\(/,
    'Delete must ask');
  assert.match(src.slice(delAt, delAt + 500), /deleteSave\(save\.key\)/,
    'and it must actually delete - a button that does nothing is the lie the anti-lie law forbids');
});

// ── U51: THE PHONE RAIL WRAPS RATHER THAN SCROLLS ────────────────
// Found by looking at the pause door on a Pixel 5. The rail is a flex
// ROW on a phone with overflow-x: auto and its scrollbar hidden, so
// everything past the fold was off-screen with no affordance at all -
// four of seven destinations, Settings and Exit among them. That is
// the AUDIT 24 shape exactly: a control that is drawn, exists, and
// cannot be reached on the device that needs it most. Six did not fit
// either, so the front door carried the same bug and nobody had
// noticed, because the entry it hid was About rather than Exit.
//
// The live killer is tools/enhancedPauseProbe.mjs, which measures
// every rail button against the viewport and names the ones outside
// it. This holds the rule so it cannot be deleted as dead CSS.
test('U51: the phone rail wraps, and the wizard rail does not', () => {
  const css = read('src/ui/enhancedStyle.js');
  const phone = css.slice(css.indexOf('@media (max-width: 860px)'),
    css.indexOf('@media (prefers-reduced-motion'));
  assert.ok(phone.length > 0, 'the phone media query is gone');
  assert.match(phone, /\.rail \{ flex-wrap: wrap; overflow-x: visible; \}/,
    'every destination must be ON the screen, not merely in the DOM');
  // The wizard borrows this rail whole, and its rail is a WALK through
  // ten stages in order - it shows where you ARE, not where you may
  // go, and a walk that wraps stops reading as a line.
  assert.match(phone, /\.wizard \.rail \{ flex-wrap: nowrap; overflow-x: auto; \}/,
    'the wizard keeps its scroller');
  assert.ok(phone.indexOf('.wizard .rail') > phone.indexOf('.rail { flex-wrap: wrap'),
    'the wizard override has to come after the rule it overrides');
});

// ── U51: A READING COLUMN ────────────────────────────────────────
// The body had no width, so a card carrying three lines stretched the
// full width of a desktop pane and every screen but Settings - which
// owns its own three columns - read as mostly empty.
test('U51: the body is a column, and the flush body is not', () => {
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.body \{ padding: [^}]*max-width: 720px; \}/);
  assert.match(css, /\.body\.flush \{ padding: 0; max-width: none; \}/,
    'the settings pane owns its own columns and must not be capped');
});

// ── U51: ONE SLOT, DRAWN ONE WAY ─────────────────────────────────
// Four panes now render the same single quicksave - Continue, Load,
// Save and Exit. Four hand-rolled copies of "career, level, date,
// time" is how they come to disagree about which of those a player is
// shown before overwriting or discarding a game.
test('U51: the saved game is rendered from one place', () => {
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /^const saveLine = \(save\) =>/m);
  assert.match(src, /^const saveStats = \(save\) =>/m);
  const joins = [...src.matchAll(/level \$\{save\.level\}/g)];
  assert.equal(joins.length, 1, 'the character line is written once');
  const health = [...src.matchAll(/save\.maxHealth \? /g)];
  assert.equal(health.length, 1, 'and so are the numbers');
  // ...and the panes that need it read through them
  for (const pane of ['paneContinue', 'paneSave']) {
    const at = src.indexOf(`function ${pane}(body)`);
    const body = src.slice(at, src.indexOf('\n}', at));
    assert.match(body, /saveLine\(save\)/, `${pane} must draw the shared line`);
    assert.match(body, /saveStats\(save\)/, `${pane} must draw the shared numbers`);
  }
});

// AUDIT F8, found by the live check rather than by reading: on a PHONE
// the detail pane is a sheet that only rises when a ROW is tapped, so
// the category card - and the Reset button inside it - could not be
// reached at all. A second tap on the ACTIVE category opens it, which
// is settingsWindow's own second-tap-acts gesture one level up.
test('the category card is reachable on a phone', () => {
  const src = read('src/ui/enhancedMenu.js');
  const at = src.indexOf('const rail = el(\'div\', \'subrail\')');
  const arm = src.slice(at, at + 1600);
  assert.match(arm, /if \(on\) \{[^}]*sheetOpen = true;/,
    'a second tap on the active category must raise the sheet');
  assert.match(arm, /more-dot/, 'and the gesture needs a visible affordance');
  const css = read('src/ui/enhancedStyle.js');
  const phone = css.slice(css.indexOf('@media (max-width: 860px)'));
  assert.match(phone, /\.subbtn\.on \.more-dot \{[\s\S]{0,140}display: inline-block/,
    'the dot shows on the phone, where the gesture is the only way in');
});

// AUDIT F5: colour rows drew a value with no control and no reason,
// which reads as broken rather than as unbuilt.
test('colour settings have an editor, and it keeps the alpha byte', () => {
  const src = read('src/ui/enhancedMenu.js');
  const at = src.indexOf("widget === 'colour'");
  const arm = src.slice(at, at + 900);
  assert.match(arm, /sw\.type = 'color'/, 'the browser gives us the right widget - use it');
  assert.match(arm, /sw\.value\.slice\(1\) \+ String\(raw \?\? ''\)\.slice\(6\)/,
    'DFU colour keys are RGBA8 and the picker owns RGB: the stored alpha must survive '
    + '(ToolTipBackgroundColor ships D2 and means it)');
  assert.match(arm, /write\(key,/, 'and it writes through the same door every other row uses');
});

// AUDIT F7: this read the whole 171-key store once PER ROW.
test('the settings pane reads the store once, not once per row', () => {
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /_eff \?\?= effectiveSettings\(\)/);
  // count CALLS, not mentions: the import has no parentheses and the
  // comment explaining the fix names the function it is about.
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.equal((code.match(/effectiveSettings\(\)/g) || []).length, 1,
    'exactly one call site - a second one is a second store read per row');
  // and every path that can change the store drops the cache
  const writes = ['_eff = null;   // the store changed', 'resetToDefaults(); _eff = null;'];
  for (const w of writes) assert.ok(src.includes(w), `the cache must be dropped by: ${w}`);
});

// AUDIT F2: the version test belongs to the RESTORER, so both front
// doors ask the restorer's own question. readQuicksave parses; it does
// not judge, and restorePlayer refuses AFTER the world has booted.
test('both front doors test the save VERSION, through one predicate', () => {
  // SAV4: the predicate moved with the slots. restorableSlot gates
  // v === SAVE_VERSION and mostRecentRestorable walks recency through
  // it; both menus ask THAT, never the raw envelope.
  assert.match(read('src/systems/saveSlots.js'),
    /export function restorableSlot[\s\S]{0,220}snap\.v === SAVE_VERSION/);
  for (const f of ['src/ui/enhancedMenu.js', 'src/scenes/menu.js']) {
    const src = read(f);
    assert.match(src, /mostRecentRestorable/, `${f} must ask whether a save is RESTORABLE`);
    assert.ok(!/[^a-zA-Z]readQuicksave\(/.test(src),
      `${f} must not read the envelope without testing its version`);
  }
});

test('main.js maps the actions to the load flag, both ways', () => {
  const branch = enhancedBranch();
  assert.match(branch, /choice === 'continue' \|\| choice === 'load'\) params\.set\('load', '1'\)/);
  assert.match(branch, /else params\.delete\('load'\)/,
    'AUDIT 19 F12: a URL already carrying ?load must not make New Game restore the save');
  assert.match(branch, /params\.set\('classic', '1'\)/);
  assert.match(branch, /return bootWorld\(/, 'U31: the classic start is the WORLD host');
});

// AUDIT 19 F3 made structurally impossible rather than guarded: the
// classic menu draws Load unconditionally and had to check for a save
// at press time (it fell through and started a NEW game instead). The
// enhanced panes are built from the save, so a button that loads
// nothing cannot be drawn in the first place.
test('Load and Continue are only drawn when there IS a save', () => {
  const src = read('src/ui/enhancedMenu.js');
  const cont = src.slice(src.indexOf('function paneContinue'), src.indexOf('// ── NEW GAME'));
  assert.match(cont, /if \(!save\) \{/, 'Continue answers the empty case before it draws a button');
  assert.ok(cont.indexOf("onAction('continue')") > cont.indexOf('if (!save)'),
    'the Continue button is inside the has-a-save arm');
  const load = src.slice(src.indexOf('function paneLoad'), src.indexOf('// ── SETTINGS'));
  assert.match(load, /if \(save\) \{/, 'Load draws its slot only when the slot is there');
});

// ── AUDIT UI (2026-08-27): A THUMB IS NOT A SCREEN WIDTH ──────────
// Mac: "a comprehensive audit on all of our enhanced UI work so far".
// The live sweep across every enhanced surface, at desktop, phone and
// TABLET, found one real fault and one cause worth naming.
test('AUDIT UI: the 44px law follows the POINTER, not the viewport width', () => {
  const css = read('src/ui/enhancedStyle.js');
  // Every 44px rule hung off `max-width: 860px`, which is a PROXY for
  // touch - and it fails on the device the proxy stands in for.
  // Measured on an iPad in landscape: 1080px wide, pointer:coarse true,
  // and the skin switch drew 28px, the steppers 34px, the value
  // buttons 38px. The width query STAYS (a narrow window wants the
  // roomier layout whatever is pointing at it); coarse joins it.
  assert.match(css, /@media \(max-width: 860px\), \(pointer: coarse\) \{/);
  assert.match(css, /@media \(pointer: coarse\) \{\s*\n\s*\.step \{ width: 44px; height: 44px; \}\s*\n\s*\.rowact, \.ctl \.act \{ min-height: 44px; \}/);
  // AND THE CAUSE. The value button was sized INLINE in three places -
  // `b.style.minHeight = '38px'` - and an inline style is unreachable
  // by a media query, so the coarse rule could not have raised it
  // however it was written. The size lives in the sheet now.
  const menu = read('src/ui/enhancedMenu.js');
  assert.doesNotMatch(menu, /style\.minHeight/, 'no control sizes itself inline');
  assert.doesNotMatch(menu, /b\.style\.padding = '8px 16px'/);
  assert.equal((menu.match(/classList\.add\('rowact'\)/g) ?? []).length, 3, 'all three sites take the class');
  assert.match(css, /\.rowact \{ min-height: 38px; padding: 8px 16px; \}/, 'the compact size a mouse keeps');
});

// ═══ EE1: Enhanced Environments replaces the procedural sky switch ═══
test('EE1: one switch for the whole outdoors, migrated once from the old sky answer', () => {
  const prefs = read('src/systems/uiPrefs.js');
  assert.match(prefs, /enhancedEnvironments: true,/, 'the new key defaults ON');
  assert.match(prefs, /proceduralSky: true,\s+\/\/ LEGACY: read only by the migration in loadPrefs/,
    'the old key stays only for the migration');
  assert.match(prefs, /if \(p\.enhancedEnvironments === undefined && p\.proceduralSky !== undefined\) \{\s*\n\s*_prefs\.enhancedEnvironments = !!p\.proceduralSky;/,
    'a player who switched the sky off must not be surprised by a lit world');
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /prefRow\('enhancedEnvironments', 'Enhanced environments',/);
  assert.ok(!/prefRow\('proceduralSky'/.test(menu), 'the old row must be gone, not doubled');
  assert.match(menu, /a procedural sky with the sun, both moons/, 'the row claims what the tree has: the sky and the weather');
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /params\.get\('sky'\) !== 'classic' && getPref\('enhancedEnvironments'\)/);
  // nothing outside uiPrefs reads the retired key at runtime - src AND tools
  const hits = execSync("grep -rl \"getPref('proceduralSky')\" src/ tools/ || true", { encoding: 'utf8' }).trim();
  assert.equal(hits, '', `still reading the retired pref: ${hits}`);
});

test('EE1: the migration, exercised - stale OFF comes up OFF, an explicit answer is never overwritten', async () => {
  // a throwaway localStorage, so loadPrefs reads what this test wrote
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; },
  };
  const m = await import('../src/systems/uiPrefs.js');
  const KEY = 'dagger.ui.v1';
  store[KEY] = JSON.stringify({ proceduralSky: false, textScale: 0 });
  m.loadPrefs();
  assert.equal(m.getPref('enhancedEnvironments'), false, 'a player who turned the sky off gets environments off');
  store[KEY] = JSON.stringify({ proceduralSky: false, enhancedEnvironments: true });
  m.loadPrefs();
  assert.equal(m.getPref('enhancedEnvironments'), true, 'an explicit answer beats the old one');
  store[KEY] = JSON.stringify({ textScale: 1 });
  m.loadPrefs();
  assert.equal(m.getPref('enhancedEnvironments'), true, 'no old answer: the default');
  delete globalThis.localStorage;
});

// ═══ EE13: a season test door - drop into a random town ═════════════
test('EE13: the Enhanced pane offers a season/weather test that spawns in a random town, and stores nothing', () => {
  const menu = read('src/ui/enhancedMenu.js');
  const from = menu.indexOf('function paneEnhanced(body)');
  const pane = menu.slice(from, menu.indexOf('\n}', from));
  assert.match(pane, /el\('div', 'row-name', 'Test the outdoors'\)/, 'the row exists');
  // EE14: a season is both an archive and a day - the game has three
  // archive seasons and the field has a calendar, and 'spring' as a bare
  // name was a pin that ignored it
  assert.match(pane, /for \(const \[label, , day\] of SEASONS\)/, 'the four seasons, each an archive and a day');
  assert.match(pane, /for \(const wn of \['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow'\]\)/, 'the seven weathers the sim has');
  assert.match(pane, /\['world', ''\], \['spawn', 'random'\], \['season', archive\], \['day', String\(day\)\], \['weather', weatherSel\.value\], \['class', '1'\], \['novideo', ''\]/,
    'it navigates through the world\u2019s own doors, archive and day both');
  assert.ok(!/setPref\(.*season|setPref\(.*weather/.test(pane), 'a test door stores nothing');
  // and the world honours the door: any town, named in the console
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(!startLoc && params\.get\('spawn'\) === 'random'\) \{/);
  assert.match(w, /\[0, 1, 2\]\.includes\(l\.mapTableData\?\.locationType\)/, 'a city, a hamlet or a village - a place with ground and people');
  assert.match(w, /console\.info\(`\[world\] random spawn: /, 'the town is named, so a good one can be found again');
});

// ── AUDIT 54: THE SAVE CARD'S GOLD ROW ───────────────────────────
//
// E4 moved the purse off the item list and onto the GoldPieces counter
// (`data.playerEntity.goldPieces = entity.GoldPieces`,
// SerializablePlayer.cs:133): snapshotPlayer writes snap.goldPieces
// beside the collections, and restorePlayer SPLICES every Currency row
// out of a pre-E4 envelope. The front door kept scanning snap.items
// for a "Gold Pieces" row, which no post-E4 envelope has - so
// save.gold was always null, and stats() drops a null value outright
// rather than drawing it blank. Both cards that show the numbers -
// Continue and Save - silently lost their whole Gold row.
test('A54: the save card reads the purse off the COUNTER, not the item list', () => {
  const src = read('src/ui/enhancedMenu.js');
  const at = src.indexOf('function savedGame()');
  const body = src.slice(at, src.indexOf('\n}', at));
  assert.match(body, /gold: snap\.goldPieces \?\? null,/, 'the envelope\'s own counter');
  assert.doesNotMatch(body, /Gold Pieces/, 'and never a scan of snap.items');
  assert.doesNotMatch(src, /Gold Pieces/,
    'nowhere else in the door either - the name of an item row is not a purse');
});

test('A54: and the envelope really does carry it there (E4)', async () => {
  const { snapshotPlayer } = await import('../src/systems/save.js');
  const entity = {
    name: 'Uthar', level: 3, health: 20, maxHealth: 20,
    goldPieces: 1234, items: [{ group: 'Weapons', templateIndex: 113, name: 'Dagger' }],
    stats: {}, skills: [],
  };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(entity, {})));
  assert.equal(snap.goldPieces, 1234, 'SerializablePlayer.cs:133');
  assert.equal((snap.items ?? []).find((i) => i?.name === 'Gold Pieces'), undefined,
    'no Currency row - which is exactly why the old find() never matched');
  // the reading the card makes, spelled out
  assert.equal(snap.goldPieces ?? null, 1234);
  // ...and a pre-E4 envelope with no field still draws the card
  const old = { ...snap };
  delete old.goldPieces;
  assert.equal(old.goldPieces ?? null, null, 'null, not a bogus 0');
});
