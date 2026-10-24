// STAFF-FOLLOW-UNLOCK (mob 2026-10-24: "follow needs a unlock button in game"): the follow's bar on the game's screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStaffFollowBar } from '../../src/ui/staffFollowBar.js';
import { staffFollowOnPage } from '../../src/scenes/staffFollowHost.js';

function fakeDoc() {
  const doc = { made: 0 };
  const node = (tag) => {
    const n = { tag, children: [], attrs: {}, on: {}, style: {}, textContent: '', removed: false, writes: 0 };
    n.append = (...cs) => n.children.push(...cs);
    n.setAttribute = (k, v) => { n.attrs[k] = v; };
    n.addEventListener = (k, f) => (n.on[k] ??= []).push(f);
    n.remove = () => { n.removed = true; };
    n.fire = (k) => { const e = { stopped: false, stopPropagation() { e.stopped = true; }, preventDefault() {} }; for (const f of n.on[k] ?? []) f(e); return e; };
    return n;
  };
  doc.createElement = (tag) => { doc.made++; return node(tag); };
  doc.body = node('body');
  return doc;
}
const btnOf = (doc, data) => doc.body.children[0].children.find((c) => c.attrs[data] != null);
const unlockOf = (doc) => btnOf(doc, 'data-staff-unlock');

test('STAFF-FOLLOW-UNLOCK + STAFF-HIDE-IN-GAME the bar: made once on the first show; Hidden or Shown with its toggle, Following with an Unlock; each press the bar\'s alone; hidden and shown without being made again', () => {
  const doc = fakeDoc();
  let unlocked = 0;
  const hides = [];
  const bar = createStaffFollowBar({ doc, onUnlock: () => { unlocked++; }, onHide: (on) => hides.push(on) });
  assert.equal(doc.made, 0, 'nothing made before it is shown');
  bar.show({ hidden: false });
  const root = doc.body.children[0];
  assert.equal(root.attrs['data-staff-follow-bar'], '');
  assert.equal(root.style.display, 'flex');
  assert.equal(root.children[0].textContent, 'Shown to players');
  assert.equal(btnOf(doc, 'data-staff-hide').textContent, 'Hide me');
  assert.equal(unlockOf(doc).style.display, 'none', 'no follow: no Unlock');
  btnOf(doc, 'data-staff-hide').fire('click');
  assert.deepEqual(hides, [true], 'shown: the press asks Hide me on');
  bar.show({ hidden: true, asking: true });
  assert.equal(btnOf(doc, 'data-staff-hide').textContent, '…', 'waiting on the panel');
  bar.show({ hidden: true, following: true, name: 'Bran' });
  assert.equal(root.children[0].textContent, 'Following Bran');
  assert.equal(btnOf(doc, 'data-staff-hide').textContent, 'Show myself');
  btnOf(doc, 'data-staff-hide').fire('click');
  assert.deepEqual(hides, [true, false], 'hidden: the press asks it off');
  assert.equal(unlockOf(doc).style.display, '');
  const made = doc.made;
  const e = unlockOf(doc).fire('click');
  assert.equal(unlocked, 1);
  assert.equal(e.stopped, true, 'the press is the bar\'s');
  assert.equal(unlockOf(doc).fire('mousedown').stopped, true);
  bar.hide();
  assert.equal(root.style.display, 'none');
  bar.show({ following: true });
  assert.equal(root.children[0].textContent, 'Following');
  bar.show({ following: true, name: 'Bran', seeing: false });
  assert.equal(root.children[0].textContent, 'Following - finding them…', 'FOLLOW-GROUND-HINT: locked, not yet seen - said, never a silent camera');
  assert.equal(unlockOf(doc).style.display, '', 'and Unlock still there');
  assert.equal(doc.made, made, 'shown again, never made again');
  assert.doesNotThrow(() => createStaffFollowBar({ doc: null, onUnlock() {} }).show(), 'no document: nothing');
});

test('STAFF-FOLLOW-UNLOCK + STAFF-HIDE-IN-GAME the page: no bar until a panel speaks; then Hide me asks the panel and the bar says hidden once it said yes; Unlock stands with a locked follow and lets go', async () => {
  const doc = fakeDoc();
  const listeners = [], posted = [];
  const win = { document: doc, location: { origin: 'https://game.test' }, addEventListener: (_k, f) => listeners.push(f), removeEventListener: (_k, f) => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }, postMessage: (m) => posted.push(m) };
  const say = (data) => { for (const f of [...listeners]) f({ source: win, origin: 'https://game.test', data }); };
  const page = staffFollowOnPage({ main: () => null, prepare: async () => {}, mode: () => 'exterior', pixel: () => ({ x: 1, y: 1 }), toScene: () => null, win, Session: class { tick() {} leave() {} } });
  page.frame();
  assert.equal(doc.made, 0, 'no panel: no bar');
  say({ dfoStaff: 'hook?' });
  page.frame();
  const root = doc.body.children[0];
  assert.equal(root.style.display, 'flex');
  assert.equal(root.children[0].textContent, 'Shown to players');
  btnOf(doc, 'data-staff-hide').fire('click');
  assert.deepEqual(posted.at(-1), { dfoStaff: 'hide', on: true });
  page.frame();
  assert.equal(btnOf(doc, 'data-staff-hide').textContent, '…');
  say({ dfoStaff: 'hide', on: true, ok: true });
  await new Promise((r) => setImmediate(r));
  page.frame();
  assert.equal(root.children[0].textContent, 'Hidden');
  assert.equal(btnOf(doc, 'data-staff-hide').textContent, 'Show myself');
  let locked = true, unlocks = 0;
  page.hook.locked = () => locked;
  page.hook.unlock = () => { unlocks++; locked = false; };
  page.hook.place = () => null; page.hook.view = () => null;
  page.frame();
  assert.equal(unlockOf(doc).style.display, '');
  unlockOf(doc).fire('click');
  assert.equal(unlocks, 1, 'Unlock lets go');
  page.frame();
  assert.equal(unlockOf(doc).style.display, 'none', 'let go: the Unlock goes, the bar stays');
});
