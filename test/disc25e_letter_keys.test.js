// DISC25-E (2026-09-25, Sir McMobdon on Discord, "Cant send letters": "Gmae still takes input making u jump and move
// and close the letter if u hit f").
//
// MAIL1's letter is written in the SOC3 social panel - real DOM fields, in a panel that is NOT a window in any host's
// slot (it stands open while the player walks). So no overlay gate stood between a typed letter and the world host's
// key ladder: world.js's listener added every key to the ring (W walked, space jumped) and ran the ladder, whose
// SocialInteract rung is F - which toggles the panel shut. dungeon.js had KB1's "a typed field's key joins no ring"
// gate; world.js and exterior.js never did. Now the panel stops its own fields' keys on its root (the chat's rule,
// after swallowing the browser's own F5/F11), and both hosts carry the gate for any field they did not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSocialPanel } from '../src/ui/socialPanel.js';
import { SocialState } from '../src/net/social.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(),
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    focus() { doc.activeElement = n; }, blur() {},
    remove() { n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const fakeWindow = () => ({ addEventListener() {}, removeEventListener() {} });
/** A keydown reaching the panel's ROOT on its way up from `target`, as the bubble phase delivers it. */
function bubble(root, code, target) {
  const ev = { type: 'keydown', code, key: code, target, prevented: false, stopped: false,
    preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; } };
  for (const fn of root.listeners.get('keydown') ?? []) fn(ev);
  return ev;
}

test('DISC25-E: a key typed into the social panel\'s fields is the field\'s - stopped at the panel, the browser\'s own keys swallowed first', () => {
  const social = new SocialState({ now: () => 0 });
  social.apply({ t: 'social', k: 'state', acct: 'a', name: 'Mac', friends: [], in: [], out: [], party: null, invites: [] });
  const panel = createSocialPanel({ social, send: () => true, canOpen: () => true, overlay: () => false, doc: fakeDocument(), win: fakeWindow() });
  const letter = { tagName: 'TEXTAREA' }, to = { tagName: 'INPUT' }, button = { tagName: 'BUTTON' };
  for (const code of ['KeyW', 'Space', 'KeyF', 'KeyM']) {
    const e = bubble(panel.root, code, letter);
    assert.equal(e.stopped, true, `${code} in the letter never reaches the world's ladder`);
    assert.equal(e.prevented, false, `${code} is still TYPED - the field keeps its character`);
  }
  assert.equal(bubble(panel.root, 'KeyF', to).stopped, true, 'the name field too');
  assert.equal(bubble(panel.root, 'F5', letter).prevented, true, 'F5 in a letter does not reload the page: the host that swallows it will not see it');
  const walk = bubble(panel.root, 'KeyW', button);
  assert.equal(walk.stopped, false, 'a key over the panel\'s BUTTONS still walks - the panel does not pause the game');
  assert.equal(walk.prevented, false);
});

test('DISC25-E: the hosts\' half - world.js and exterior.js carry dungeon.js\'s typed-field gate, below the browser swallow and above the ring', () => {
  const world = rd('src/scenes/world.js');
  const gate = /swallowBrowserKey\(e\);   \/\/ U47: F5\/F6\/F11 - one list, in ui\/input\.js\n(?:    \/\/[^\n]*\n)*    if \(isTextEntryTarget\(e\.target\)\) return;/;
  assert.match(world, gate);
  const at = world.search(gate), ring = world.indexOf('keys.add(e.code);', at);
  assert.ok(at > 0 && ring > at, 'the gate stands before the key joins the ring');
  const ext = rd('src/scenes/exterior.js');
  assert.match(ext, /swallowBrowserKey\(e\);   \/\/ U47: F5\/F6\/F11 - one list, in ui\/input\.js\n    if \(isTextEntryTarget\(e\.target\)\) return;/);
  assert.match(ext, /import \{[^}]*\bisTextEntryTarget\b[^}]*\} from '\.\.\/ui\/input\.js';/);
  // THE FOUR HOSTS (17e): the dungeon's own gate stands (KB1); the interior host routes through routeKey's, and the
  // dungeon context owns no keydown of its own
  assert.match(rd('src/scenes/dungeon.js'), /if \(isTextEntryTarget\(e\.target\)\) return;/);
  assert.match(rd('src/ui/input.js'), /isTextEntryTarget\(/);
  assert.doesNotMatch(rd('src/scenes/dungeonContext.js'), /addEventListener\('keydown'/);
});
