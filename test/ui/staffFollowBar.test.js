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

test('BAR-NO-FOCUS (mob, 2026-10-24: "DONT LET THE HIDE BUTTON STAY LOCKED TO MY SPACE BAR"): the bar\'s buttons never hold the keyboard - out of the tab order, a press takes no focus, a click lets go of any (mutants: each of the three)', () => {
  const doc = fakeDoc();
  const bar = createStaffFollowBar({ doc, onUnlock: () => {}, onHide: () => {} });
  bar.show({ hidden: false, following: true });
  for (const data of ['data-staff-hide', 'data-staff-unlock']) {
    const b = btnOf(doc, data);
    assert.equal(b.tabIndex, -1, `${data}: out of the tab order`);
    for (const k of ['pointerdown', 'mousedown']) {
      let prevented = false;
      for (const f of b.on[k] ?? []) f({ stopPropagation() {}, preventDefault() { prevented = true; } });
      assert.equal(prevented, true, `${data}: a ${k} takes no focus`);
    }
    let blurred = 0;
    b.blur = () => { blurred++; };
    b.fire('click');
    assert.equal(blurred, 1, `${data}: a click lets go of the keyboard`);
  }
});

test('FOLLOW-INDOORS (mob, 2026-10-24: "dont lock to them in dungeon but tped inside"): the modes host\'s climb camera carries the follow\'s eye - a dungeon\'s frame puts the camera at the target\'s eyes before the climb\'s frame, the bar stops saying "finding them", and every other read and write is the climb camera\'s own (mutant: the eye left out)', async () => {
  const doc = fakeDoc();
  const win = { document: doc, location: { origin: 'https://game.test' }, addEventListener() {}, removeEventListener() {}, postMessage() {} };
  let mode = 'exterior';
  const page = staffFollowOnPage({ main: () => null, prepare: async () => { mode = 'dungeon'; }, mode: () => mode, pixel: () => ({ x: 100, y: 100 }), toScene: (p) => [p.x, p.y, p.z], win, Session: class { tick() {} leave() {} } });
  page.hook.locked = () => true;
  page.hook.place = () => ({ kind: 'dungeon', pixel: { x: 100, y: 100 }, mapId: 1234, whole: true, yaw: 0, pitch: 0, pos: null });
  page.hook.view = () => ({ x: 10, y: -2, z: 30, yaw: 0.5, pitch: 0.1, mv: 0 });
  page.hook.tick = () => {};
  const calls = [];
  const feel = { fx: null, frame(dt) { calls.push(['frame', dt, player.pos[0]]); }, view() { this.fx = { yaw: 1 }; }, fovRad() { return this.fx ? 1 : 0; } };
  const player = { pos: [0, 0, 0] }, cam = { pos: [0, 0, 0], yaw: 0, pitch: 0 };
  const modal = page.indoors(feel, player, cam);
  page.frame();
  await new Promise((r) => setImmediate(r));
  page.frame();
  assert.equal(mode, 'dungeon', 'entered as the TP host enters');
  modal.frame(0.016, false);
  assert.deepEqual(calls, [['frame', 0.016, 10]], 'the eye first, then the climb\'s own frame');
  assert.deepEqual(player.pos, [10, -2, 30], 'the body at the target');
  assert.equal(cam.yaw, 0.5);
  assert.equal(cam.pitch, 0.1);
  assert.equal(page.hook.view() && true, true);
  modal.view();
  assert.deepEqual(feel.fx, { yaw: 1 }, 'a write through the handle is the climb camera\'s own');
  assert.equal(modal.fovRad(), 1, 'and a read');
  page.hook.locked = () => false;
  const was = [...player.pos];
  modal.frame(0.016, false);
  assert.deepEqual(player.pos, was, 'no follow: the body is the motor\'s');
});
