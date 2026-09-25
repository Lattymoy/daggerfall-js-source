// PROFILE1 (2026-09-25, Mac: "I kinda wanna make the menu profile icon more relevant, more like a profile icon less
// like a button"; asked what its picture should be: the LAST CHARACTER'S FACE).
//
// The door's top-right mark was a bordered box holding a gem and a word - one more button. It is a portrait now: the
// face of the character last played (TILE1's loadFace, the save tiles' one home), in a round rimmed frame, with the
// account's name and that character's line beside it, and the signed-in gem on the rim.
//
// Driven through the real badge (ui/profileBadge.js) against a fake document; the frame's cascade is read off the
// real ENHANCED_CSS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { profileBadge, portraitSave, characterLine } from '../src/ui/profileBadge.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';

function fakeEl(tag) {
  let text = '';
  const n = {
    tag, children: [], className: '', attrs: {}, type: '',
    get textContent() { return text; },
    set textContent(v) { text = v; n.children.length = 0; },
    append(...cs) { for (const c of cs) { n.children.push(c); c.parent = n; } },
    remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
const doc = { createElement: fakeEl };
const find = (n, cls, out = []) => {
  if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n);
  for (const c of n.children ?? []) find(c, cls, out);
  return out;
};
const one = (n, cls) => find(n, cls)[0];
const settle = () => new Promise((r) => setTimeout(r, 0));
const MITH = { name: 'Mithriil', level: 5, race: 'HighElf', gender: 'female', faceIndex: 3, chargenDone: true };

test('PROFILE1: the picture is the LAST FINISHED character - not a half-made one, not a save from before faces were kept', () => {
  const mid = { name: 'Half', race: 'Nord', chargenDone: false };
  const old = { name: 'Old', race: null, chargenDone: true };
  assert.equal(portraitSave([MITH, mid]), MITH, 'the most recent, when it is finished');
  assert.equal(portraitSave([mid, old, MITH]), MITH, 'past a save still in chargen and one with no race - loadFace would draw a Breton stranger for it');
  assert.equal(portraitSave([mid, old]), null, 'nobody to draw: the silhouette');
  assert.equal(portraitSave([]), null);
  assert.equal(characterLine(MITH), 'Mithriil · level 5');
  assert.equal(characterLine(null), 'No character yet');
});

test('PROFILE1: signed in, with a character - the face replaces the silhouette when it lands, the gem is filled, the caption says who', async () => {
  let opened = 0;
  const canvas = fakeEl('canvas');
  let land;
  const face = new Promise((r) => { land = r; });
  const b = profileBadge(doc, { session: { name: 'Lattymoy' }, save: MITH, face, onOpen: () => opened++ });
  assert.equal(b.tag, 'button');
  const frame = one(b, 'px-portrait');
  assert.equal(frame.attrs['aria-hidden'], 'true', 'the picture is decoration; the label speaks');
  assert.ok(one(frame, 'px-silhouette'), 'on screen before the face: a list never waits on a CIF read');
  land(canvas);
  await settle();
  assert.ok(!one(frame, 'px-silhouette'), 'the silhouette gives way');
  assert.ok(frame.children.includes(canvas), 'to the face');
  assert.ok(frame.className.includes('has-face'));
  const gem = one(b, 'px-profilegem');
  assert.equal(gem.textContent, '◆'); assert.ok(gem.className.includes('on'), 'FILLED with a session');
  assert.equal(one(b, 'px-profilename').textContent, 'Lattymoy');
  assert.equal(one(b, 'px-profilesub').textContent, 'Mithriil · level 5');
  assert.equal(b.attrs['aria-label'], 'Profile: Lattymoy, playing Mithriil · level 5');
  b.onclick();
  assert.equal(opened, 1, 'it opens the profile window');
});

test('PROFILE1: signed out and no character - the hooded silhouette, a hollow gem, and the way in', async () => {
  const b = profileBadge(doc, { session: null, save: null, face: null });
  assert.ok(one(b, 'px-silhouette'));
  const gem = one(b, 'px-profilegem');
  assert.equal(gem.textContent, '◇'); assert.ok(!gem.className.includes('on'), 'HOLLOW without a session');
  assert.equal(one(b, 'px-profilename').textContent, 'Sign in');
  assert.equal(one(b, 'px-profilesub').textContent, 'No character yet');
  assert.equal(b.attrs['aria-label'], 'Sign in or create an account');
  // a face that would not draw (no game data): loadFace answers null, and the silhouette stays
  const c = profileBadge(doc, { session: { name: 'x' }, save: MITH, face: Promise.resolve(null) });
  await settle();
  assert.ok(one(c, 'px-silhouette'), 'never an empty ring');
  const d = profileBadge(doc, { session: { name: 'x' }, save: MITH, face: Promise.reject(new Error('no CIF')) });
  await settle();
  assert.ok(one(d, 'px-silhouette'), 'nor a throw');
});

test('PROFILE1: it is drawn as a portrait, not a button - no box, a round rimmed well, the face at its own pixels', () => {
  const rule = (sel) => {
    const m = ENHANCED_CSS.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`));
    assert.ok(m, `${sel} is styled`);
    return m[1];
  };
  const mark = rule('.px-profile');
  assert.match(mark, /background: none;/, 'no panel behind it');
  assert.match(mark, /border: 0;/, 'and no box around it');
  const frame = rule('.px-portrait');
  assert.match(frame, /border-radius: 50%;/, 'a round portrait');
  assert.match(frame, /border: 3px solid var\(--brass\);/, 'rimmed in brass');
  assert.match(frame, /width: 58px; height: 58px;/);
  assert.match(rule('.px-portrait canvas'), /image-rendering: pixelated;/, 'the save tiles\' law: Daggerfall\'s pixels as they are');
  assert.match(rule('.px-profilegem.on'), /color: var\(--brass\);/);
  // the door hands it the store's session, the newest finished character and that character's face - a COPY,
  // because the Continue pane's tile may draw the same face on the same screen
  const menu = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  const door = menu.slice(menu.indexOf('function profileMark()'), menu.indexOf('function profileMark()') + 500);
  assert.match(door, /const save = portraitSave\(savedGames\(\)\);/);
  assert.match(door, /face: save \? loadFace\(save, \{ scale: 2, copy: true \}\) : null,/);
});
