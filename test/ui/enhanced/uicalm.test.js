// UI-CALM (2026-10-14, bible/10-UI/UI-Calm.md) - THE QUIET PASS. A player's report in six points: the first screen
// asks Online or Offline; character creation looked like a placeholder; the menus lacked hierarchy (the horse's coats
// were a wall of presses); the text was barely readable by default; a huge, unmovable horse and cart panel stood over the
// sky and the temperature belonged in the bottom-left corner; and every system added a panel - "Show information when it's
// relevant." One file, the laws each point turned into.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOME_OFFLINE, HOME_LINKS, offlineSection } from '../../../src/ui/enhanced/enhancedMenu.js';
import { saddleShown, saddleAlert, saddleNote, saddleHello, SADDLE_HELLO_MS, SADDLE_PANEL_MODES } from '../../../src/ui/enhanced/enhancedSaddle.js';
import { UI_CALM_CSS, P, CALM_INK } from '../../../src/ui/uiCalmStyle.js';
import { classWayOf, leadingAttributes, CLASS_WAYS, muteConstellation, untangleLabels } from '../../../src/ui/enhanced/enhancedChargen.js';
import { ChargenFlow } from '../../../src/ui/chargen.js';
import { audio } from '../../../src/systems/audio.js';
import { SOUND } from '../../../src/systems/soundClips.js';
import { FEATURES } from '../../../src/systems/features.js';
import { ACTIONS, PORT_ACTIONS, DEFAULT_BINDINGS } from '../../../src/systems/inputActions.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('UI-CALM the front door asks which world first: Online and Offline the two doors, Online first; Continue, New Game, Load Game and the Test Room behind Offline, each backing out to it; Settings and Overhauls plaques in the foot; the rail Online first, Offline\'s four under their word (mutants: UICALM-offline-escapes-to-top, UICALM-online-second)', () => {
  assert.deepEqual([...HOME_OFFLINE], ['Continue', 'New Game', 'Load Game', 'Test Room']);
  assert.deepEqual([...HOME_LINKS], ['Settings', 'Overhauls']);
  assert.deepEqual(['continue', 'new', 'load', 'test', 'online', 'settings', 'about'].map(offlineSection), [true, true, true, true, false, false, false]);
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  const doors = menu.slice(menu.indexOf('function drawDoors(menu) {'), menu.indexOf('/** PX1b: three-zone foot'));
  assert.ok(doors.indexOf("doorBtn('online'") > 0 && doors.indexOf("doorBtn('online'") < doors.indexOf("doorBtn('offline'"), 'Online first');
  assert.match(doors, /more\.append\(doorBtn\('back', t\('menu\.home\.back', 'Back'\), '', level\('top'\)\)\);/, 'a way back from the offline doors');
  assert.match(menu, /if \(offlineSection\(section\)\) homeLevel = 'offline';/, 'a game\'s pane backs out to the offline doors');
  // PIN MOVED (AUDIT UICALM-FIRM1 L3 L1): and the keyboard back on the door it came from
  assert.match(menu, /: homeLevel !== 'top' && twoQuestionDoor\(\) \? \(\) => \{ const from = homeLevel; homeLevel = 'top'; render\(\); focusDoor\(from\); \}/, 'Escape on the offline doors: the two questions');
  assert.match(menu, /homeLevel = 'top';   \/\/ UI-CALM: every visit asks which world first/);
  assert.match(menu, /const SECTIONS_BOOT = \['Online', 'Continue', 'New Game', 'Load Game', 'Test Room',/);
  assert.match(menu, /const twoQuestionDoor = \(\) => mode === 'boot' && sections === SECTIONS_BOOT;/, 'the enhanced front door alone: the classic skin keeps its list');
  // the way home, said: the shell rail's first row (a player: "here back to main menu is missing")
  assert.match(menu, /const homeRow = el\('button', 'railbtn railhome'\);\n  homeRow\.append\(el\('span', 'rk', mode === 'pause' \? t\('menu\.home\.back', 'Back'\) : t\('menu\.home\.aria', 'Main menu'\)\)\);\n  homeRow\.onclick = \(\) => go\('home'\);\n  rail\.append\(homeRow\);/);
  // and no dotted rule under a word the pointer is on, in either dress
  assert.doesNotMatch(rd('src/ui/grimoireDress.js'), /underline dotted/);
});

test('UI-CALM the saddle panel is a block in the bottom-right corner, up and away on its own key (F2 - a player: "we need a keybind to make it appear and disappear"); away, one line for what needs the rider (winded, short, hungry, a wagon rickety or failing, a load past its limit) and the horse\'s name and the key for the first seconds; a finger\'s plate a tap from it; the choice Always starts it up, Off keeps the lines away (mutants: UICALM-saddle-always-full, UICALM-no-note, UICALM-hello-forever, UICALM-no-key)', () => {
  const S = (o = {}) => ({ mode: 'Horse', name: 'Shadow', horse: { breath: 1, winded: false, hungerKey: 'fed' }, wagon: null, load: null, ...o });
  assert.deepEqual([...SADDLE_PANEL_MODES], ['auto', 'always', 'off']);
  assert.equal(saddleShown(S(), { since: SADDLE_HELLO_MS + 1 }), 'none', 'riding, the panel away, nothing wrong: nothing stands');
  assert.equal(saddleShown(S(), { since: 10 }), 'hello', 'the first seconds: the name and the key');
  assert.equal(saddleShown(S(), { open: true, since: 1e9 }), 'full', 'the key put it up');
  assert.equal(saddleShown(S(), { open: false, since: 1e9 }, 'always'), 'none', 'and away again, Always or not');
  assert.equal(saddleShown(S(), { since: 1e9 }, 'always'), 'full', 'Always: up until the key says otherwise');
  assert.equal(saddleShown(S({ horse: { breath: 0.1, winded: true, hungerKey: 'fed' } }), { since: 1e9 }, 'off'), 'none', 'Off: no lines');
  assert.equal(saddleShown(null, { open: true }), 'none');
  assert.equal(saddleShown(S(), { touch: true, since: 1e9 }), 'chip', 'a finger: the plate');
  assert.equal(saddleShown(S(), { touch: true, open: true }), 'full', 'tapped up');
  const winded = S({ horse: { breath: 0.1, winded: true, hungerKey: 'fed' } });
  assert.equal(saddleShown(winded, { since: 1e9 }), 'note');
  assert.deepEqual([saddleAlert(winded), saddleNote(winded)], ['breath', 'Winded. Ease off and let it breathe']);
  assert.deepEqual([saddleAlert(S({ horse: { breath: 0.2, hungerKey: 'fed' } })), saddleAlert(S({ horse: { breath: 1, hungerKey: 'hungry' } }))], ['breath', 'hunger']);
  assert.equal(saddleNote(S({ horse: { breath: 1, hungerKey: 'starving' } })), 'Starving. It will not gallop until it eats');
  const wagon = (stateKey) => S({ mode: 'Cart', horse: null, wagon: { name: 'Small Cart', stateKey } });
  assert.deepEqual(['sound', 'worn', 'rickety', 'failing'].map((k) => saddleAlert(wagon(k))), [null, null, 'wagon', 'wagon']);
  assert.equal(saddleAlert(S({ horse: null, load: { kg: 801, limit: 800 } })), 'load');
  assert.equal(saddleAlert(S({ horse: null, load: { kg: 800, limit: 800 } })), null, 'at its limit is not past it');
  assert.deepEqual([saddleHello(S(), 'F2'), saddleHello(S(), '')], ['F2: saddle panel', 'Saddle panel: give it a key in Controls']);
  // the key: a port action on F2, its press handed to the one glue by both hosts, which puts the panel up or away
  assert.equal(ACTIONS.at(-4), 'SaddlePanel');   // PIN MOVED (CARGO-ANYWHERE: ShipHold; SHOT-KINDS: ShotCycle; PARTY-PING: PartyPing)
  assert.ok(PORT_ACTIONS.includes('SaddlePanel') && DEFAULT_BINDINGS.some(([c, a]) => c === 'F2' && a === 'SaddlePanel'));
  assert.match(rd('src/scenes/saddleHost.js'), /if \(s && toggle && !covered\) toggleSaddlePanel\(\);/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(host), /toggle: show && hccActionPressed\('SaddlePanel'\),/, host);
  // the block in the bottom-right corner, lifted only over a hotbar or vitals it would meet
  const css = rd('src/ui/enhanced/enhancedSaddle.js');
  assert.match(css, /\.saddlepanel-bar \{ position: absolute; right: calc\(16px \+ env\(safe-area-inset-right, 0px\)\); bottom: var\(--sp-bottom\);/);
  assert.match(css, /\.saddlepanel-btns \{ display: grid; grid-template-columns: 1fr 1fr; gap: 6px; \}/);
  assert.match(css, /\.saddlepanel\[data-show="none"\] \{ display: none; \}/);
  assert.match(css, /if \(r && r\.width > 0 && r\.height > 0 && r\.right > me\.left - 8 && r\.left < me\.right \+ 8\) top = Math\.min\(top, r\.top\);/, 'lifted only over what it meets');
  // the player's choice, on the Horse care row
  const row = FEATURES.find((f) => f.id === 'horse-care');
  assert.deepEqual([row.control.also[0].key, row.control.also[0].initial, row.control.parts[0].tiers.map(([v]) => v)], ['saddlePanel', 'auto', ['auto', 'always', 'off']]);
});

test('UI-CALM the corner and the quiet HUD: the temperature plate the bottom-left caption\'s first word, its own piece inside the quick block, the glyph and the number alone while comfortable; the vitals rest while full and untouched (the Calm HUD row, on), never while the HUD is arranged (mutants: UICALM-plate-off-the-compass, UICALM-vitals-never-rest, UICALM-vitals-rest-hurt)', () => {
  const hud = rd('src/ui/enhanced/enhancedHud.js');
  assert.match(hud, /cap\.append\(temp, cornerWord, spellChip, readied\);/);
  assert.doesNotMatch(hud, /compass\.append\(temp\)/);
  assert.match(rd('src/ui/hud/hudLayout.js'), /\{ id: 'temp', sel: '\.hud \.hud-temp', name: 'Temperature', inside: 'quick' \}/);
  assert.match(UI_CALM_CSS, /\.hud \.hud-temp\[data-level="ok"\] \.hud-tempword, \.hud \.hud-temp\[data-level="ok"\] \.hud-tempscale \{ display: none; \}/);
  // PIN MOVED (AUDIT UICALM-FIRM1 L4 N1, M3): full short of no whole point; never at rest while the HUD is arranged
  assert.match(hud, /const allFull = rows\.every\(\(\[key, , now, max\]\) => \(key === 'magicka' && !\(Number\(vitals\.maxMagicka\) > 0\)\) \|\| now > max - 1\);/);
  assert.match(hud, /const calm = getPref\(HUD_CALM_PREF\) !== false && !hudArranging\(\) && allFull && !parts\.foe\?\.classList\?\.contains\?\.\('on'\);/);
  assert.match(hud, /const rest = calm && last\.calmFor >= VITALS_REST_S;/);
  assert.match(UI_CALM_CSS, /\.hud \.hud-bars\.rest:not\(\[data-hm-edit\]\) \{ opacity: 0;/);
  const row = FEATURES.find((f) => f.id === 'calm-hud');
  assert.deepEqual([row.group, row.control.key, row.control.initial, row.control.online], ['interface', 'hudCalm', true, 'player']);
});

test('UI-CALM the windows read: the quiet ink a step lighter and the type floor at 12px under Plus, every colour Plus\'s alone (DFO Grimoire inks its own pages); the sheet laid after Plus\'s; the Stable\'s look a selector, behind a small press; Begin your life the wizard\'s action bar\'s; the class list in Daggerfall\'s three ways with each class\'s profile (mutants: UICALM-sheet-not-laid, UICALM-coat-presses)', () => {
  assert.equal(P, ':root:not([data-plus-dress="grimoire"])');
  assert.match(UI_CALM_CSS, new RegExp(`\\${P.replace(/[[\]().]/g, (c) => `\\${c}`)} \\{ --dim: #b9b2a1; \\}`));
  assert.equal(CALM_INK.quiet, '#bdb4a0');
  // no colour rule under the sheet without Plus's prefix (a font-size, a gap, a width may stand for both dresses).
  // PIN MOVED (AUDIT UICALM-FIRM1 L5 L3): rule by rule, every colour - a background, a border, a shadow, a line a rule
  // runs on to - where the line-start `color:` it read let the class bars' dark and amber stand on the Grimoire's page
  const COLOUR = /(?:^|[;\s{])(?:color|background(?:-color)?|border(?:-[a-z]+)*|box-shadow|text-shadow|outline(?:-color)?|fill|stroke):[^;}]*(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(?:white|black)\b)/i;
  const rules = [...UI_CALM_CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.ok(rules.length > 100, 'the sheet read rule by rule');
  const bare = rules.filter(([, sel, body]) => COLOUR.test(body) && sel.split(',').some((s) => !s.trim().startsWith(P))).map(([, sel]) => sel.trim());
  assert.deepEqual(bare, [], 'a colour said for both dresses');
  assert.match(rd('src/ui/enhanced/enhancedStyle.js'), /applyPlusTheme\(doc\);   \/\/ PLUS2: the stored colour\n    injectUiCalmStyle\(doc\);/);
  const hold = rd('src/ui/holdingsPages.js');
  assert.match(hold, /const colours = choices\.map\(\(name\) => LOOK_SWATCHES\[name\] \?\? null\);\n  if \(colours\.every\(Boolean\)\) \{/);
  assert.match(hold, /if \(_lookOpen === 'horse'\) for \(const row of m\.look\.rows\) extra\.push\(choiceRow\(/);
  assert.match(rd('src/ui/enhanced/enhancedChargen.js'), /stagePrimary = \{ label: left > 0 \? `\$\{left\} left to spend` : 'Begin your life',/);
  assert.deepEqual(CLASS_WAYS.map(([w, names]) => [w, names.length]), [['Magic', 6], ['Stealth', 6], ['Combat', 6]]);
  assert.deepEqual(['Mage', 'Thief', 'Knight', 'Custom'].map(classWayOf), ['Magic', 'Stealth', 'Combat', null]);
  assert.deepEqual(leadingAttributes({ strength: 40, intelligence: 60, willpower: 72, agility: 48, endurance: 52, personality: 55, speed: 48, luck: 57 }), ['Willpower', 'Intelligence']);
  assert.deepEqual(leadingAttributes({ strength: 70, intelligence: 70 }), ['Strength', 'Intelligence'], 'a tie in the sheet\'s order');
  // a player: "when i randomly click around in the class selection i hear drums all the time" - under the enhanced
  // wizard a double click is two on ONE row, reading is quiet, and the drums sound for the choice; Start over the bar's
  const CAREER = { hitPointsPerLevel: 8, strength: 40, intelligence: 60, willpower: 72, agility: 48, endurance: 52, personality: 55, speed: 48, luck: 57, primarySkills: [0, 1, 2], majorSkills: [3, 4, 5], minorSkills: [6, 7, 8, 9, 10, 11] };
  const f = muteConstellation(new ChargenFlow(['Mage', 'Spellsword', 'Battlemage'].map((name) => ({ name, career: { ...CAREER, name } })), () => 0.5));
  f.describeClass = () => ['A line.'];
  const played = [], real = audio.playOneShot;
  audio.playOneShot = (id) => { played.push(id); return 0; };
  try {
    const seen = [0, 1, 2].map((row) => { f.clickClassRow(row, 1000 + row * 100); return f.classConfirm; });
    assert.deepEqual([seen, played], [[null, null, null], []], 'browsing three rows fast: no pick at any click, no drums');
    f.clickClassRow(2, 1250);
    assert.ok(f.classConfirm, 'two clicks on one row: the class read');
    assert.deepEqual(played, [], '...quietly');
    f.applyHit({ confirmClass: true });
    assert.deepEqual(played, [SOUND.SelectClassDrums], 'the drums for the choice');
  } finally { audio.playOneShot = real; }
  assert.match(rd('src/ui/enhanced/enhancedChargen.js'), /stageSecondary = \{ label: 'Start over',/);
});

test('UI-CALM II the walk polished (a player: "cheap letters, overlapping, dotted lines everywhere, the highlighting of words is bad, the summary board looks cut off"): the map\'s names are plates over it, moved off one another, the unchoosable one first; a confirm card scrolls its words and keeps its presses; no dotted rule left in DFO Grimoire; Settings and Overhauls in the foot\'s box; a refused Firmament read says so (mutants: UICALM-labels-stay-crossed, UICALM-inert-holds-its-place, UICALM-links-back-on-the-book, UICALM-firm-silent, UICALM-list-scrolls-again)', () => {
  // two names over one point: moved apart, up and down, the same way they lean, and inside the map
  const a = untangleLabels([{ x: 100, y: 50, w: 80, h: 20 }, { x: 110, y: 52, w: 80, h: 20 }], { width: 400, height: 200 });
  assert.ok(Math.abs(a[0].y - a[1].y) >= 24 - 1e-9, 'apart by their heights and the gap');
  assert.deepEqual([a[0].x, a[1].x], [100, 110], 'never across - a name stays over its own land');
  assert.ok(a[0].y < a[1].y, 'the lower one goes down');
  // the Imperial Province's name gives way alone
  const b = untangleLabels([{ x: 200, y: 100, w: 120, h: 20, inert: true }, { x: 210, y: 100, w: 90, h: 20 }], { width: 400, height: 200 });
  assert.deepEqual(b[1], { x: 210, y: 100 }, 'a homeland\'s name holds its place');
  assert.ok(Math.abs(b[0].y - 100) >= 24 - 1e-9, 'the inert one moved');
  // names apart already are left alone, and a name is kept inside the map
  assert.deepEqual(untangleLabels([{ x: 50, y: 50, w: 40, h: 20 }, { x: 300, y: 150, w: 40, h: 20 }], { width: 400, height: 200 }), [{ x: 50, y: 50 }, { x: 300, y: 150 }]);
  assert.deepEqual(untangleLabels([{ x: 2, y: 199, w: 40, h: 20 }], { width: 400, height: 200 }), [{ x: 20, y: 190 }]);
  const wiz = rd('src/ui/enhanced/enhancedChargen.js');
  assert.match(wiz, /const tag = el\(p\.inert \? 'span' : 'button', `maplabel/, 'the names are the page\'s plates');
  assert.doesNotMatch(wiz, /svg\('text'/, 'not words in map units inside the picture');
  assert.equal((wiz.match(/const body = el\('div', 'dscroll'\);/g) ?? []).length, 2, 'the race\'s and the class\'s cards scroll their words');
  const css = UI_CALM_CSS;
  assert.match(css, /\.wizard \.dcard\.confirm \.dscroll \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/);
  assert.match(css, /\.wizard \.dcard\.confirm \.acts \{ flex: none;/, 'the presses stand under the words');
  // the panels: one scroll (the stage's), the windows' frame, the chosen row a bar at its edge - never a box round it
  assert.match(css, /\.wizard \.stagebody > \.list \{ align-self: start; max-height: none; overflow: visible; \}/, 'no scroll bar of a list that fits');
  assert.match(css, /border: 2px solid transparent; border-image: url\("data:image\/svg\+xml,/, 'the list wears the windows\' frame under Plus');
  assert.match(css, /\.wizard \.list \.row\.on, \.wizard \.skillpane \.row\.on \{ outline: none; \}/);
  // DFO Grimoire: no dotted rule, and the heading's rule a plain line
  const grim = rd('src/ui/grimoireDress.js');
  assert.doesNotMatch(grim, /\dpx dotted |-style: dotted/, 'no dotted rule');
  assert.doesNotMatch(grim, /border-image: \$\{v\('rule'\)\}/, 'the stroke with dotted ends is not drawn');
  assert.doesNotMatch(rd('src/ui/firmamentWindow.js'), /dotted/, 'nor in the Firmament');
  // a way out that is also a warn press (the Firmament's Close) is the Exit plate: its yellow, no line, lit under the pointer
  assert.match(grim, /\$\{G\} \[data-grim-exit\]:is\(\$\{list\(R\.warn\)\}\), \$\{G\} \[data-grim-on="wood"\]\[data-grim-exit\]:is\(\$\{list\(R\.warn\)\}\) \{ color: \$\{T\.yellow\} !important; text-decoration: none !important; \}/);
  // Settings and Overhauls: the foot's box, beside Screenshots and About - not the book
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  const doors = menu.slice(menu.indexOf('function drawDoors(menu) {'), menu.indexOf('/** PX1b: three-zone foot'));
  assert.doesNotMatch(doors, /HOME_LINKS/, 'not on the book');
  assert.match(menu, /if \(twoQuestionDoor\(\)\) \{\n      for \(const label of HOME_LINKS\) \{/, 'in the foot');
  assert.match(menu, /right\.append\(shots, about\);/);
  // the Firmament: a read the service refused is said, never shown as "0 of 0"
  const firm = rd('src/ui/firmamentWindow.js');
  assert.match(firm, /const fail = readFailText\(book\.state\);\n    if \(fail\) say\(fail, true, true\);/);
  assert.match(firm, /if \(st\.status === 404\) return t\('firm\.readFail\.missing'/);
  assert.match(rd('src/net/firmament/firmamentBook.js'), /state\.status = Number\.isSafeInteger\(r\?\.status\) \? r\.status : null;/);
});
