// TITLE-DOOR (2026-10-27, the owner: "People really love the start game intro screen. I think instead of this leading to
// the online/offline options. We use the intro title screen as the landing pad itself with these options"; bible/10-UI/
// UI-Arc.md TITLE-DOOR). THE HELD TITLE IS THE FRONT DOOR: the film lands, steps under the menu, holds its last frame
// for the whole visit and is let go when a game is chosen; the menu's home stands on it - no sky, no masthead, the doors
// in a row under the mark where Tap to continue stood. Skip intro, Escape and Skip start video land on the title, not
// past it. Mutants: tools/mutants/titledoor.json.
import '../modsOff.js';
import '../chargenDom.mjs';   // the menu's half mounts under the shared minimal DOM (globals); the film's half on its own page
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runIntro, runCinematicFrontDoor, TITLE_HELD_TIME, DOORS_FADE_MS } from '../../src/ui/intro/introScreen.js';
import { titleHeld, holdTitle, TITLE_HELD } from '../../src/ui/intro/titleHeld.js';
import { TITLE_READY_TIME, MENU_FADE_SECONDS } from '../../src/ui/intro/introCue.js';
import { MENU_THEME_GAIN } from '../../src/systems/introTheme.js';
import { mountEnhancedMenu } from '../../src/ui/enhanced/enhancedMenu.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';
import { introPage, fakeTheme, settle } from '../introDom.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

test('TITLE-DOOR: the landed mark makes room for the doors - the band starts at the mark\'s foot, worked from the logo file\'s own size; the film steps under the menu (mutants: TITLEDOOR-band-at-the-centre, TITLEDOOR-film-over-the-menu, TITLEDOOR-host-ground-wins)', () => {
  const intro = read('src/ui/intro/introScreen.js');
  const sheet = /const STYLE = `[\s\S]*?`;/.exec(intro)[0];
  // the doors' band begins where the landed mark ends: its centre plus half its height - the file's own height over width,
  // halved, read off the PNG's IHDR so a new logo reddens this and not a layout
  const png = readFileSync(new URL('../../src/assets/branding/dfo-online.png', import.meta.url));
  const half = png.readUInt32BE(20) / png.readUInt32BE(16) / 2;
  const band = sheet.match(/--intro-doors-top:calc\(var\(--intro-title-y\) \+ var\(--intro-title-w\) \* ([\d.]+)\)/);
  assert.ok(band, 'the band is the landed mark\'s centre plus a share of its width');
  const k = Number(band[1]);
  assert.ok(k >= half && k < half + 0.01, `the share (${k}) is half the mark's height over its width (${half.toFixed(4)}), rounded up - never into the mark`);
  assert.match(sheet, /#intro\.intro-landed \.intro-title\{top:var\(--intro-title-y\);width:var\(--intro-title-w\);/, 'and the landed mark stands where the band was worked from');
  // the film over the menu while it plays, under it once landed: the menu's host stands at 12
  const menuZ = Number(read('src/ui/enhanced/enhancedMenu.js').match(/host\.style\.cssText = 'position:fixed;inset:0;z-index:(\d+);/)[1]);
  const filmZ = Number(sheet.match(/#intro\{position:fixed;inset:0;z-index:(\d+);/)[1]);
  const landedZ = Number(sheet.match(/#intro\.intro-landed\{z-index:(\d+)\}/)[1]);
  assert.ok(filmZ > menuZ && landedZ < menuZ, `the film at ${filmZ} over the menu's ${menuZ}, and at ${landedZ} under it once landed`);
  // the menu's sheet reads the band and goes see-through over the film
  assert.ok(ENHANCED_CSS.includes('#enhanced-menu[data-over-title] { background: transparent !important; }'), 'the host\'s own opaque ground (runEnhancedMenu\'s inline style) gives way');
  assert.ok(ENHANCED_CSS.includes('#enhanced-menu .px-home.px-title > .px-stage:not(.px-acctstage) { justify-content: center; padding-top: calc(var(--intro-doors-top, 62dvh) + 6px); }'), 'the doors stand in the band under the mark');
  // Tap to continue is retired, its node and its rules with it
  assert.doesNotMatch(intro, /intro-continue|tapContinue/, 'no node, no rule, no key left for the press the doors replaced');
});

test('TITLE-DOOR: the boot home on the held title draws no sky and no masthead and its host goes see-through; a section covers it with its own ground and comes home to it; the pause face and an unheld page never wear it (mutants: TITLEDOOR-sky-under-the-title, TITLEDOOR-host-stays-opaque, TITLEDOOR-pause-on-the-title)', () => {
  globalThis.document.documentElement ??= globalThis.document.createElement('html');
  const html = globalThis.document.documentElement;
  holdTitle(true);
  assert.equal(html.dataset.introTitle, TITLE_HELD);
  assert.equal(titleHeld(), true);
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const menu = quiet(() => mountEnhancedMenu(host, { mode: 'boot', hooks: {}, onAction() {} }));
  try {
    const home = () => host.querySelector('.px-home');
    assert.ok(home().className.split(' ').includes('px-title'), 'the home on the title');
    assert.equal(host.querySelectorAll('.px-ground').length, 0, 'no sky: the map is the ground');
    assert.equal(host.querySelectorAll('.px-wordmark').length + host.querySelectorAll('.px-vignette').length, 0, 'no masthead and no second vignette: the film\'s mark and its own');
    assert.ok(host.querySelectorAll('.doorbtn').length > 0, 'the doors stand on it');
    assert.equal(host.dataset.overTitle, '', 'the host see-through over the film');
    // a section: its own ground over the held film, and its way home is the title again
    quiet(() => host.querySelector('.door-settings').click());
    assert.equal(home(), null, 'the shell, not the home');
    assert.equal(host.dataset.overTitle, undefined, 'the host opaque again');
    assert.ok(host.querySelectorAll('.px-ground').length > 0, 'the shell keeps its sky');
    quiet(() => host.querySelector('.railhome').click());
    assert.ok(home().className.split(' ').includes('px-title'), 'home is the title');
    assert.equal(host.dataset.overTitle, '');
    // the film let go: the home draws its own sky and masthead again
    holdTitle(false);
    assert.equal(titleHeld(), false);
    quiet(() => host.querySelector('.door-settings').click());
    quiet(() => host.querySelector('.railhome').click());
    assert.ok(!home().className.split(' ').includes('px-title'));
    assert.ok(host.querySelectorAll('.px-ground').length > 0 && host.querySelectorAll('.px-wordmark').length === 1, 'the sky and the masthead back');
    assert.equal(host.dataset.overTitle, undefined);
  } finally { menu.unmount(); host.remove(); }
  // the pause face never stands on a title, held or not
  holdTitle(true);
  const paused = globalThis.document.createElement('div');
  globalThis.document.body.append(paused);
  const pause = quiet(() => mountEnhancedMenu(paused, { mode: 'pause', hooks: {}, onAction() {} }));
  try {
    assert.ok(!paused.querySelector('.px-home').className.split(' ').includes('px-title'), 'the pause face is the game\'s');
    assert.equal(paused.dataset.overTitle, undefined);
  } finally { pause.unmount(); paused.remove(); holdTitle(false); }
});

test('TITLE-DOOR: Skip start video opens on the held title at once - no gate, no film, nothing asked of the score - the menu over it inert while it fades in, then its first door focused; the release takes the film and the page\'s mark away (mutants: TITLEDOOR-landed-asks-the-score, TITLEDOOR-release-keeps-the-mark)', async () => {
  const page = introPage(), theme = fakeTheme();
  let opened = 0, menu = null;
  const done = runIntro({ theme, doc: page.doc, landed: true, onReveal: () => { opened++; menu = page.mountMenu(); } });
  assert.equal(opened, 1, 'the menu is up at once, on the title');
  const intro = page.doc.getElementById('intro');
  assert.ok(intro.classList.contains('intro-landed'), 'the film steps under the menu');
  assert.equal(intro.getAttribute('aria-hidden'), 'true', 'a picture under the menu: its words are the menu\'s');
  assert.equal(titleHeld(page.doc), true, 'the page says the title is held');
  assert.ok(intro.querySelector('.intro-gate').hidden && intro.querySelector('.intro-skip').hidden, 'no gate and no Skip on a title with no film');
  assert.equal(menu.inert, true, 'inert while it fades in');
  assert.deepEqual(menu.faded, [[{ opacity: 0 }, { opacity: 1 }], { duration: DOORS_FADE_MS, easing: 'ease-out' }], 'fading in');
  page.frame(); page.frame(); await settle();   // the film's setup: two frames, then its landscape (none here: no WebGL)
  assert.deepEqual(theme.calls, [], 'the score is the front door\'s first gesture\'s - the film asks nothing of it');
  page.timers();
  assert.equal(menu.inert, false, 'live once faded in');
  assert.equal(page.doc.activeElement, menu.querySelector('button'), 'its first door has the focus Tap to continue had');
  const release = await done;
  assert.equal(typeof release, 'function', 'the landing hands back the one call that lets the film go');
  release(); release();
  assert.equal(page.doc.getElementById('intro'), null, 'the film is gone');
  assert.equal(titleHeld(page.doc), false, 'and the page\'s mark with it');
});

test('TITLE-DOOR: Skip intro and Escape land on the title - the score at the menu\'s level, as the old Skip\'s menu had it - never past it to a menu on its own sky (mutants: TITLEDOOR-skip-passes-the-title, TITLEDOOR-escape-passes-the-title)', async () => {
  for (const how of ['skip', 'escape']) {
    const page = introPage(), theme = fakeTheme();
    let opened = 0;
    const done = runIntro({ theme, doc: page.doc, onReveal: () => { opened++; page.mountMenu(); } });
    assert.equal(opened, 0, `${how}: the gate first`);
    if (how === 'skip') page.doc.getElementById('intro').querySelector('.intro-skip').dispatch('click');
    else page.fire('keydown', { key: 'Escape' });
    assert.equal(opened, 1, `${how}: the menu up`);
    assert.equal(titleHeld(page.doc), true, `${how}: on the title`);
    await settle();
    const menuLevel = ['setLevel', MENU_THEME_GAIN, MENU_FADE_SECONDS];
    assert.deepEqual(theme.calls, ['unlock', 'prepare', menuLevel, menuLevel, 'start'], `${how}: unlocked in the press, the score asked to the menu's level at once and again as it starts`);
    const release = await done;
    release();
  }
});

test('TITLE-DOOR: the title the score carried in - the menu up on the mark\'s rest, the score kept until the first press and then ducked once; the held title draws only when something changes it (mutants: TITLEDOOR-no-duck, TITLEDOOR-ducked-at-once, TITLEDOOR-draws-every-frame)', async () => {
  const page = introPage(), theme = fakeTheme();
  let opened = 0;
  const done = runIntro({ theme, doc: page.doc, onReveal: () => { opened++; page.mountMenu(); } });
  page.doc.getElementById('intro').querySelector('.intro-begin').dispatch('click');   // the gate's press
  await settle();
  assert.ok(theme.calls.includes('start'), 'the film plays');
  theme.now = TITLE_READY_TIME - 0.5;
  page.frame();
  assert.equal(opened, 0, 'no menu before the mark is at rest');
  theme.now = TITLE_READY_TIME + 0.01;
  page.frame();
  assert.equal(opened, 1, 'the mark at rest: the doors stand on it');
  assert.equal(theme.calls.filter((c) => Array.isArray(c) && c[0] === 'setLevel').length, 0, 'the score kept at the title\'s level while the player looks');
  // the held title draws once more (its held frame) and then nothing - not every frame for as long as the player stands there
  assert.equal(page.frame(), 1, 'the held frame');
  assert.equal(page.pending, 0, 'and no frame after it');
  page.fire('resize');
  assert.equal(page.pending, 1, 'a resize draws it again');
  page.frame();
  assert.equal(page.pending, 0);
  page.fire('pointerdown');
  assert.deepEqual(theme.calls.filter((c) => Array.isArray(c) && c[0] === 'setLevel'), [['setLevel', MENU_THEME_GAIN, MENU_FADE_SECONDS]], 'the first press ducks the score to the menu\'s level');
  page.fire('keydown', { key: 'a' });
  assert.equal(theme.calls.filter((c) => Array.isArray(c) && c[0] === 'setLevel').length, 1, 'once');
  const release = await done;
  release();
  page.fire('resize');
  assert.equal(page.pending, 0, 'a film let go draws nothing more');
  assert.ok(TITLE_HELD_TIME > TITLE_READY_TIME && DOORS_FADE_MS > 0);
});

test('TITLE-DOOR: a film that breaks before it lands is let go - the score at the menu\'s level, the page unmarked - and the front door opens the menu on its own sky (mutants: TITLEDOOR-broken-film-kept)', async () => {
  const page = introPage(), theme = fakeTheme();
  let opened = 0;
  const done = runIntro({ theme, doc: page.doc, onReveal: () => { opened++; } });
  page.doc.getElementById('intro').querySelector('.intro-begin').dispatch('click');
  await settle();
  theme.time = () => { throw new Error('a frame that throws'); };
  quiet(() => page.frame());
  assert.equal(await Promise.race([done, settle().then(() => 'still waiting')]), null, 'no title to stand on - and the door is not left waiting on one');
  assert.equal(opened, 0, 'the film never revealed the menu');
  assert.equal(page.doc.getElementById('intro'), null);
  assert.equal(titleHeld(page.doc), false);
  assert.deepEqual(theme.calls.at(-1), ['setLevel', MENU_THEME_GAIN, MENU_FADE_SECONDS]);
});

test('TITLE-DOOR: the front door lets the title go with the menu - before the scene asks for the GPU - and ?nointro (no film, no title) still opens the menu on its own sky', async () => {
  const page = introPage(), theme = fakeTheme();
  let resolveMenu;
  const door = runCinematicFrontDoor(() => { page.mountMenu(); return new Promise((r) => { resolveMenu = r; }); }, { skip: true, menuMusic: true, doc: page.doc, theme });
  await settle();
  assert.equal(titleHeld(page.doc), true, 'Skip start video: on the title');
  resolveMenu('new');
  assert.equal(await door, 'new');
  assert.equal(page.doc.getElementById('intro'), null, 'the title went with the menu');
  assert.equal(titleHeld(page.doc), false);
  const bare = introPage();
  const plain = runCinematicFrontDoor(() => Promise.resolve('load'), { skip: true, doc: bare.doc, theme: fakeTheme() });
  assert.equal(await plain, 'load');
  assert.equal(bare.doc.getElementById('intro'), null, '?nointro: no film was ever built');
});
