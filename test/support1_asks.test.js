// SUPPORT1 (2026-10-05, Mac: "I want to add the kofi link in addition to the patron on the website" and "I also want
// to add the patron/kofi ingame on the main menu as 2 icons").
//
// The project asks for support at two doors - the website's corner (index.html, pinned in test/landing.test.js) and,
// new, the game's own front door: two icons top-left, Patreon's mark and Ko-fi's mug. One module holds the asks and
// their drawings (ui/supportAsks.js); the skin draws the game's icons from it and the site has the same rules injected.
// Here: the asks, the drawings pixel for pixel, the rules the drawings become, the door drawn by the REAL menu against
// the repo's fake document (boot and pause), and the corners' band - the door's stage starting below its corner marks
// wherever the wordmark reaches under them - derived from the marks' own numbers rather than restated, so a plaque that
// grows without its band fails here. In a real browser: tools/supportAsksProbe.mjs (the presses, and the logo's own
// pixels under the marks at 176 sizes).
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

test('SUPPORT1: the corners\' band - the door\'s stage starts below its corner marks wherever the wordmark reaches under the asks, and every number is the marks\' own', () => {
  // the asks' reach from the left edge: their offset, the plaque (borders, padding, two cells and the gap), the Plus
  // frame's outset beyond it
  const plaque = rule('.px-support'), icon = rule('.px-supportlink');
  const border = 2 * Number(plaque.match(/border: (\d+)px solid/)[1]);
  const width = border + 2 * px(plaque, 'padding') + SUPPORT_ASKS.length * px(icon, 'width') + (SUPPORT_ASKS.length - 1) * px(plaque, 'gap');
  const height = border + 2 * px(plaque, 'padding') + px(icon, 'height');
  const reach = px(plaque, 'left') + width + OUTSET;
  assert.equal(reach, 122);
  // the wordmark is min(540px, 84vw) wide and centred, so it reaches under the asks at every width under 540 + 2 * reach
  assert.match(rule('.px-wordmark:has(.brand-logo)'), /width: min\(540px, 84vw\);/);
  const stage = '.px-home:not(.px-over) > .px-stage:not(.px-acctstage)';
  const band = mediaRule(`(min-width: 481px) and (max-width: ${540 + 2 * reach - 1}px)`, stage);
  // ...it starts below the taller of the two marks there - the asks, or the profile's 58px portrait - with air
  const portrait = px(rule('.px-portrait'), 'height');
  const top = Number(band.match(/padding: (\d+)px 24px (\d+)px;/)[1]);
  assert.ok(top > px(plaque, 'top') + height + OUTSET && top > px(rule('.px-profile'), 'top') + portrait + OUTSET, `${top}px clears both marks`);
  assert.equal(top, 84);
  // ...it keeps the one-row foot's height at its foot, so a row the band pushed down can be scrolled clear of it, and
  // it scrolls rather than cutting a row off (PX8's law)
  const bottom = Number(band.match(/padding: (\d+)px 24px (\d+)px;/)[2]);
  const foot = 2 * px(rule('.px-foot'), 'padding') + px(rule('.px-about'), 'min-height');
  assert.ok(bottom >= foot, `${bottom}px holds the ${foot}px foot`);
  assert.match(band, /justify-content: flex-start; overflow-y: auto;/);
  // ...and it still centres where it fits: auto margins take the room left and none that is not
  assert.match(mediaRule(`(min-width: 481px) and (max-width: ${540 + 2 * reach - 1}px)`, `${stage} > :first-child`), /margin-top: auto;/);
  assert.match(mediaRule(`(min-width: 481px) and (max-width: ${540 + 2 * reach - 1}px)`, `${stage} > :last-child`), /margin-bottom: auto;/);
  // on a phone the marks stand 10px in and the wordmark is 84vw - under them always: the band's floor there
  const phone = mediaRule('(max-width: 480px)', stage).match(/padding-top: max\(7dvh, (\d+)px\);/);
  assert.ok(phone, 'the phone\'s stage keeps PX8\'s 7dvh, floored');
  const floor = Number(phone[1]);
  assert.ok(floor > 10 + height + OUTSET && floor > 10 + px(mediaRule('(max-width: 480px)', '.px-portrait'), 'height') + OUTSET, `${floor}px clears both marks on a phone`);
  assert.equal(floor, 72);
  // the band is the FRONT door's: the pause face (PX4, AUDIT TIMERS1 UI-2's own rule) and the account window's stage
  // keep theirs
  assert.doesNotMatch(ENHANCED_CSS, /\n\s*\.px-stage \{[^}]*padding: 84px/, 'never every stage');
});
