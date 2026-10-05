// SUPPORT1 (2026-10-05, Mac: "I want to add the kofi link in addition to the patron on the website" and "I also want
// to add the patron/kofi ingame on the main menu as 2 icons").
//
// The project asks for support at two doors - the website's corner (index.html, pinned in test/landing.test.js) and,
// new, the game's own front door: two icons top-left, Patreon's mark and Ko-fi's mug. One module holds the asks and
// their drawings (ui/supportAsks.js); the skin draws the game's icons from it and the site has the same rules injected.
// Here: the asks, the drawings pixel for pixel, the rules the drawings become, the door drawn by the REAL menu against
// the repo's fake document (boot and pause), and the corners' band - the door's stage starting below its corner marks
// wherever the wordmark reaches under either - derived from the marks' own numbers rather than restated, so a mark that
// grows without its band fails here; and DOOR-FIT (Mac: "Fix these now"), the door that never cuts itself off. In a
// real browser: tools/supportAsksProbe.mjs (the presses; the logo's own pixels under the marks, a caption at its bound
// among them; and DOOR-FIT's top, last row and centring, at 192 sizes on both skins).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './chargenDom.mjs';
import { SUPPORT_ASKS, SUPPORT_MARKS_CSS, MARK_PX, MARK_BODY_ROWS, markCss } from '../src/ui/supportAsks.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { FRAME_ROLES, OUTSET } from '../src/ui/enhancedFrame.js';
import { MOTION_WINDOWS } from '../src/ui/windowMotion.js';
import { mountEnhancedMenu } from '../src/ui/enhancedMenu.js';

console.warn = () => {};

/** A rule's body in the skin, by its exact selector at the start of a line (inside a media block or not). */
function rule(sel, css = ENHANCED_CSS) {
  const m = css.match(new RegExp(`(?:^|\\n)\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`));
  assert.ok(m, `${sel} is styled`);
  return m[1];
}
/** A length a rule declares, in px. */
function px(body, prop) {
  const m = body.match(new RegExp(`(?:^|[;{\\s])${prop}: (\\d+)px`));
  assert.ok(m, `${prop} is declared in px: ${body}`);
  return Number(m[1]);
}
/** The body of the one @media block whose condition is exactly `cond` and which holds `sel`. */
function mediaRule(cond, sel) {
  const blocks = [...ENHANCED_CSS.matchAll(/@media ([^{]+) \{\n([\s\S]*?)\n\}/g)].filter((m) => m[1] === cond && m[2].includes(`${sel} {`));
  assert.equal(blocks.length, 1, `one @media ${cond} block styles ${sel}`);
  return rule(sel, `\n${blocks[0][2]}`);
}

test('SUPPORT1: the asks are Patreon then Ko-fi, at Mac\'s two addresses - one home, both doors read it', () => {
  assert.deepEqual(SUPPORT_ASKS.map(({ id, name, label, url }) => ({ id, name, label, url })), [
    { id: 'patreon', name: 'Patreon', label: 'Support on Patreon', url: 'https://www.patreon.com/c/dfenhanced' },   // PATREON1's
    { id: 'kofi', name: 'Ko-fi', label: 'Support on Ko-fi', url: 'https://ko-fi.com/daggerfallonline' },   // SUPPORT1's - not U64's dfjs
  ]);
  assert.ok(Object.isFrozen(SUPPORT_ASKS) && SUPPORT_ASKS.every((a) => Object.isFrozen(a) && Object.isFrozen(a.art)), 'read by two doors, written by none');
});

test('SUPPORT1: the marks are the drawings - PATREON1\'s bar and disc, U64\'s cup with its handle a ring - each body five rows', () => {
  const [patreon, kofi] = SUPPORT_ASKS;
  // PATREON1's mark, the very pixels index.html carried as a box-shadow list: the bar in the dim, five tall; a column
  // of air; the disc in the brass, five across with its corners cut
  assert.deepEqual(patreon.art, [
    '+..###.',
    '+.#####',
    '+.#####',
    '+.#####',
    '+..###.',
  ]);
  // the mug: two wisps of steam in the dim, a row of air, the FILLED body (U64's lesson - a ring body read as an 'o')
  // and the handle a ring (the hole is what says mug rather than goblet, standing alone on the game's door)
  assert.deepEqual(kofi.art, [
    '.+.+..',
    '+.+...',
    '......',
    '####..',
    '######',
    '####.#',
    '######',
    '####..',
  ]);
  // every body is its last five rows, and nothing brass stands above one - so a door stands both on their feet and
  // their bodies centre together
  assert.equal(MARK_BODY_ROWS, 5);
  for (const a of SUPPORT_ASKS) {
    const above = a.art.slice(0, -MARK_BODY_ROWS), body = a.art.slice(-MARK_BODY_ROWS);
    assert.ok(above.every((r) => !r.includes('#')), `${a.id}: only steam rises above the body`);
    assert.ok(body[0].includes('#') && body.at(-1).includes('#'), `${a.id}: the body fills its five rows top to foot`);
    assert.ok(a.art.every((r) => /^[#+.]+$/.test(r) && r.length === a.art[0].length), `${a.id}: a rectangle of three inks`);
  }
});

test('SUPPORT1: markCss paints every pixel once, on the 4px grid, in the mark\'s two inks, and lays out the whole drawing', () => {
  assert.equal(MARK_PX, 4, 'the site\'s grid and the door\'s');
  for (const a of SUPPORT_ASKS) {
    const css = markCss(a);
    const box = css.match(new RegExp(`\\.supmark-${a.id} \\{ width: (\\d+)px; height: (\\d+)px; \\}`));
    assert.ok(box, `${a.id}: the box`);
    assert.deepEqual([Number(box[1]), Number(box[2])], [a.art[0].length * MARK_PX, a.art.length * MARK_PX], `${a.id}: the box is the WHOLE drawing - laying out less put the steam in the site's border`);
    const before = css.match(new RegExp(`\\.supmark-${a.id}::before \\{ background: ([^;]+); box-shadow: ([^;]+); \\}`));
    assert.ok(before, `${a.id}: the pixel and its shadows`);
    const ink = (ch) => (ch === '#' ? 'var(--mk-hi)' : ch === '+' ? 'var(--mk-lo)' : 'transparent');
    assert.equal(before[1], ink(a.art[0][0]), `${a.id}: the corner pixel is the ::before's own ground (a shadow there is clipped under it)`);
    const want = [];
    a.art.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && (x || y)) want.push(`${x * MARK_PX}px ${y * MARK_PX}px 0 ${ink(ch)}`); }));
    assert.deepEqual(before[2].split(', '), want, `${a.id}: every other pixel, once, where the art puts it`);
  }
  // the inks: brass and the dim at rest, the brass lit by the classic pair's gold while its link is under the pointer
  // or the keyboard - one rule, so a door lights a mark without restating it
  assert.match(SUPPORT_MARKS_CSS, /\.supmark \{ --mk-hi: var\(--brass\); --mk-lo: #7d7460; position: relative; display: block; flex: none; \}/);
  assert.match(SUPPORT_MARKS_CSS, /\.supmark::before \{ content: ''; position: absolute; left: 0; top: 0; width: 4px; height: 4px; \}/);
  assert.match(SUPPORT_MARKS_CSS, /\na:hover > \.supmark, a:focus-visible > \.supmark \{ --mk-hi: rgb\(243,239,44\); \}/);
  for (const a of SUPPORT_ASKS) assert.ok(SUPPORT_MARKS_CSS.includes(markCss(a)), `${a.id}: drawn by the shared block`);
});

test('SUPPORT1: the front door draws the asks top-left - links out of the game, named for a reader, the marks hidden from one - and the pause face draws none', () => {
  const host = globalThis.document.createElement('div');
  const menu = mountEnhancedMenu(host, { mode: 'boot', hooks: {}, onAction() {} });
  const navs = host.querySelectorAll('.px-support');
  assert.equal(navs.length, 1, 'one plaque of asks on the door');
  const nav = navs[0];
  assert.equal(nav.tagName, 'NAV');
  assert.equal(nav.getAttribute('aria-label'), 'Support');
  assert.equal(nav.parentNode, host.querySelector('.px-home'), 'on the home itself, beside the profile mark - not inside the stage that scrolls');
  const links = nav.children.map((a) => ({
    cls: a.className, href: a.href, target: a.target, rel: a.rel, title: a.title, label: a.getAttribute('aria-label'),
    marks: a.children.map((i) => [i.tagName, i.className, i.getAttribute('aria-hidden')]),
  }));
  assert.deepEqual(links, SUPPORT_ASKS.map((a) => ({
    cls: `px-supportlink px-support-${a.id}`, href: a.url,
    target: '_blank', rel: 'noopener',   // a new tab on the web; the system browser from the desktop app (app/main.cjs)
    title: a.label, label: a.label,
    marks: [['I', `supmark supmark-${a.id}`, 'true']],
  })));
  menu.unmount?.();

  const paused = globalThis.document.createElement('div');
  const pause = mountEnhancedMenu(paused, { mode: 'pause', hooks: {}, onAction() {} });
  assert.ok(paused.querySelector('.px-home'), 'the pause face mounted');
  assert.equal(paused.querySelectorAll('.px-support').length, 0, 'PX4: no foot and no asks over a game - the front door\'s alone');
  pause.unmount?.();
});

test('SUPPORT1: the skin carries the one drawing, the plaque in the corner the profile leaves, 44px icons, and the Plus frame and motion', () => {
  assert.ok(ENHANCED_CSS.includes(SUPPORT_MARKS_CSS), 'the door draws the marks the site has injected - one block, two doors');
  const plaque = rule('.px-support');
  assert.match(plaque, /position: absolute; top: 16px; left: 18px; z-index: 4;/, 'top-left, the profile mark\'s offsets mirrored (it stands top: 16px; right: 18px)');
  assert.match(rule('.px-profile'), /position: absolute; top: 16px; right: 18px; z-index: 4;/);
  assert.match(plaque, /background: rgba\(10,12,17,0\.55\); border: 2px solid #7d7460;/, 'the About plaque\'s own face (ACC1f)');
  assert.match(rule('.px-about'), /background: rgba\(10,12,17,0\.55\); border: 2px solid #7d7460;/);
  const icon = rule('.px-supportlink');
  assert.equal(px(icon, 'width'), 44, 'a 44px target');
  assert.equal(px(icon, 'height'), 44);
  // the marks stand on their feet, so the two five-row bodies centre in the cell side by side
  assert.match(icon, /align-items: flex-end;/);
  assert.equal(px(icon, 'padding-bottom'), (44 - MARK_BODY_ROWS * MARK_PX) / 2, 'the bodies centred, whatever rises above them');
  const tallest = Math.max(...SUPPORT_ASKS.map((a) => a.art.length)) * MARK_PX;
  assert.ok(tallest <= 44 - px(icon, 'padding-bottom'), 'and the tallest drawing, steam and all, inside its cell');
  // on a phone the mark mirrors the profile's 10px
  assert.match(mediaRule('(max-width: 480px)', '.px-support'), /top: 10px; left: 10px;/);
  assert.match(mediaRule('(max-width: 480px)', '.px-profile'), /top: 10px; right: 10px;/);
  // Plus: the kit's carved frame and the window motion, as About and the profile have
  for (const sel of ['.px-about', '.px-profile', '.px-support']) {
    assert.ok(FRAME_ROLES.window.includes(sel), `${sel}: the window role's frame`);
    assert.ok(MOTION_WINDOWS.includes(sel), `${sel}: unfolds with the door`);
  }
});

test('SUPPORT1: the corners\' band - the door\'s stage starts below its corner marks wherever the wordmark reaches under either, and every number is the marks\' own', () => {
  const stage = '.px-home:not(.px-over) > .px-stage:not(.px-acctstage)';
  // THE ASKS' reach from the left edge: their offset, the plaque (borders, padding, two cells and the gap), the Plus
  // frame's outset beyond it
  const plaque = rule('.px-support'), icon = rule('.px-supportlink');
  const border = 2 * Number(plaque.match(/border: (\d+)px solid/)[1]);
  const width = border + 2 * px(plaque, 'padding') + SUPPORT_ASKS.length * px(icon, 'width') + (SUPPORT_ASKS.length - 1) * px(plaque, 'gap');
  const height = border + 2 * px(plaque, 'padding') + px(icon, 'height');
  const asks = px(plaque, 'left') + width + OUTSET;
  assert.equal(asks, 122);
  // THE PROFILE'S from the right: its offset, the portrait, the gap, the caption at the door's bound, the outset. The
  // bound is in PIXELS: the caption's own 14ch and 22ch are the font's (158px in Pixelify Sans), and a reach that is
  // the font's cannot be the band's
  const profile = rule('.px-profile');
  const name = rule('.px-home:not(.px-over) .px-profilename').match(/max-width: min\(14ch, (\d+)px\);/);
  const line = rule('.px-home:not(.px-over) .px-profilesub').match(/max-width: min\(22ch, (\d+)px\);/);
  assert.ok(name && line, 'both caption lines are bounded in px on the door');
  const caption = Math.max(Number(name[1]), Number(line[1]));
  assert.equal(caption, 140, 'a new player\'s "No character yet" (123px) stands whole under it');
  const reach = Math.max(asks, px(profile, 'right') + px(rule('.px-portrait'), 'width') + px(profile, 'gap') + caption + OUTSET);
  assert.equal(reach, 234, 'the profile reaches further in than the asks');
  // the wordmark is min(540px, 84vw) wide and centred, so it reaches under a mark at every width under 540 + 2 * reach;
  // a 1024x768 door, which fits unscrolled, stays outside the band - the reason the bound is 140 and not 158
  assert.match(rule('.px-wordmark:has(.brand-logo)'), /width: min\(540px, 84vw\);/);
  const edge = 540 + 2 * reach - 1;
  assert.ok(edge < 1024, `the band ends at ${edge}px, short of 1024`);
  const band = mediaRule(`(min-width: 481px) and (max-width: ${edge}px)`, stage);
  // ...it starts below the taller mark - the asks' plaque, or the profile's portrait - with air
  const [, top, bottom] = band.match(/padding: (\d+)px 24px (\d+)px;/).map(Number);
  assert.ok(top > px(plaque, 'top') + height + OUTSET && top > px(profile, 'top') + px(rule('.px-portrait'), 'height') + OUTSET, `${top}px clears both marks`);
  assert.equal(top, 84);
  // ...and keeps the one-row foot's height at its foot, so a row the band pushed down scrolls clear of About and
  // Screenshots (DOOR-FIT, the next test, is what lets it scroll)
  const foot = 2 * px(rule('.px-foot'), 'padding') + px(rule('.px-about'), 'min-height');
  assert.ok(bottom >= foot, `${bottom}px holds the ${foot}px foot`);
  // on a phone the marks stand 10px in, the caption is hidden and the wordmark is 84vw - under them always: the band's
  // floor there
  assert.match(mediaRule('(max-width: 480px)', '.px-profiletext'), /display: none;/, 'a phone\'s profile is its portrait');
  const phone = mediaRule('(max-width: 480px)', stage).match(/padding-top: max\(7dvh, (\d+)px\);/);
  assert.ok(phone, 'the phone\'s stage keeps PX8\'s 7dvh, floored');
  const floor = Number(phone[1]);
  assert.ok(floor > 10 + height + OUTSET && floor > 10 + px(mediaRule('(max-width: 480px)', '.px-portrait'), 'height') + OUTSET, `${floor}px clears both marks on a phone`);
  assert.equal(floor, 72);
  // the band and the bound are the FRONT door's: the pause face (PX4, AUDIT TIMERS1 UI-2's own rule) and the account
  // window's stage keep theirs, and the pause face's caption its own 22ch
  assert.doesNotMatch(ENHANCED_CSS, /\n\s*\.px-stage \{[^}]*padding: 84px/, 'never every stage');
  assert.match(rule('.px-profilesub'), /max-width: 22ch;/, 'the caption\'s own bound, where no wordmark stands');
});

test('DOOR-FIT: the front door never cuts itself off - at every width the phone rule leaves it scrolls, and centres by auto margins where it fits (Mac: "Fix these now")', () => {
  // PX8's stage scrolled only under 560px tall, a threshold set before the door grew to eight rows: a desktop window
  // from 561 to about 690px tall (the eight-row door's own height) ran off BOTH ends with nothing to scroll - the
  // wordmark's top, and under about 620px the whole last row (1366x568). Now the door's stage is a scroller at every
  // width PX8's phone rule does not take...
  const stage = '.px-home:not(.px-over) > .px-stage:not(.px-acctstage)';
  assert.match(mediaRule('(min-width: 481px)', stage), /justify-content: flex-start; overflow-y: auto;/);
  // ...and centres by auto margins, which take the room that is left and none that is not: where the door fits it did
  // not move, and where it does not it starts at the top and every row can be scrolled to
  assert.match(mediaRule('(min-width: 481px)', `${stage} > :first-child`), /margin-top: auto;/);
  assert.match(mediaRule('(min-width: 481px)', `${stage} > :last-child`), /margin-bottom: auto;/);
  // the base stage still centres the old way - the pause face and the account window keep it; the rule above is the
  // front door's alone
  assert.match(rule('.px-stage'), /justify-content: center;/);
  // and a phone keeps PX8's door: from the top, never centred (the band floors its top)
  const phoneBlocks = [...ENHANCED_CSS.matchAll(/@media \(max-width: 480px\) \{\n([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(phoneBlocks, /:first-child \{ margin-top: auto; \}/, 'a phone\'s door is not centred');
  // in a browser: tools/supportAsksProbe.mjs - the wordmark's top on the screen and the last row whole and pressed,
  // scrolled to the end, at 192 sizes, and where the door fits the room over it equal to the room under it
});
