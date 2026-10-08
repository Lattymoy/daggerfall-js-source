// AUDIT 28 (2026-09-28, Mac: "let's audit everything we have so far before we continue") - Foraging's findings and the
// hosts' seams: the online wait (scenes/foragingWait.js), a switched-off mod's console command
// (systems/consoleCommands.js), a DOM window's button keys (scenes/townTalk.js), the bounty notice kept until read
// (ui/bountyDoor.js, scenes/bountyHost.js) - each failing on the code before the fix. (H7, the hunt page's Escape, retired
// with the text hunt, 2026-10-04: the wait page that remains takes no key at all.)
// bible/06-Systems/Foraging.md 13 (AUDIT 28).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createForagingWait, FORAGING_WAIT_MAX_SECONDS, FORAGING_WAIT_HELD_MAX, saneWait } from '../src/scenes/foragingWait.js';
import { consoleCommands, hasConsoleCommand, executeConsoleCommand } from '../src/systems/consoleCommands.js';
import { installForaging, _resetForagingInstall } from '../src/systems/foragingInstall.js';
import { FORAGING_COMMAND } from '../src/systems/foragingLaw.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { isDomControlTarget } from '../src/ui/input.js';
import { createBountyHost } from '../src/scenes/bountyHost.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The host's slot as townTalk keeps it: a window that ends stays in the slot until the next frame drains it. */
function slot() {
  const s = { win: null };
  s.show = (w) => { const out = s.win; s.win = w; if (out && out !== w && !out.done) out.dispose?.(); };
  s.active = () => !!s.win;   // an ended window still holds the slot until the frame drains it
  s.drain = () => { if (s.win?.done) s.win = null; };
  return s;
}
function rig() {
  const entity = { foragingWait: null };
  const s = slot();
  const revived = [];
  const wait = createForagingWait({ entity, showOverlay: s.show, overlayActive: () => s.active(), online: () => true, revive: (k) => revived.push(k) });
  return { entity, s, wait, revived };
}

test('AUDIT 28 F1: waits joined in play are their SUM - twenty uses cost twenty waits; only a SAVED record is cut to the max', () => {
  const { wait, entity } = rig();
  for (let i = 0; i < 20; i++) wait.add(5400, 'Chop and Gather Wood');   // twenty Wood-Axe uses behind the pack
  assert.equal(entity.foragingWait.seconds, 240, '20 x 12 s');
  for (let i = 0; i < 5; i++) wait.tick();
  assert.equal(entity.foragingWait.seconds, 240, 'never re-cut on a read');
  const loaded = rig();
  loaded.entity.foragingWait = { seconds: 1e9, label: 'x' };
  assert.equal(loaded.wait.tick().remaining, FORAGING_WAIT_MAX_SECONDS, 'a save edited to a day is cut');
});

test('AUDIT 28 F6: the boxes held behind the wait ride the save - a reload gives them back, in order, once the page is done', () => {
  const a = rig();
  a.wait.add(3600, 'Forage for some Food');
  a.wait.hold(() => {}, { box: { rows: ['You find a bird\'s nest.'] } });
  a.wait.hold(() => {}, { reward: { templateIndex: 1609 } });
  a.wait.hold(() => {});   // a prompt's answer - this page's alone
  assert.deepEqual(a.entity.foragingWait.held, [{ box: { rows: ['You find a bird\'s nest.'] } }, { reward: { templateIndex: 1609 } }]);
  // the page reloads: the save's record, on a fresh page
  const b = rig();
  b.entity.foragingWait = JSON.parse(JSON.stringify(a.entity.foragingWait));
  const page = b.wait.tick();
  assert.ok(page, 'the page reopens');
  assert.deepEqual(b.revived, [], 'held behind it');
  page.tick(99);
  b.wait.tick();   // the finished page still holds the slot this frame
  assert.deepEqual(b.revived, [], 'never under the page (AUDIT 28 H6)');
  b.s.drain();
  b.wait.tick();
  assert.deepEqual(b.revived, [{ box: { rows: ['You find a bird\'s nest.'] } }, { reward: { templateIndex: 1609 } }]);
  assert.equal(b.entity.foragingWait, null, 'and the record is gone with them');
  assert.equal(saneWait({ seconds: 0, held: Array.from({ length: 40 }, () => ({ box: {} })) }).held.length, FORAGING_WAIT_HELD_MAX);
});

test('AUDIT 28 H6: a box held behind the page is shown only once the finished page has left the slot', () => {
  const { wait, s } = rig();
  const shown = [];
  wait.add(3600);
  wait.hold(() => { shown.push('bonus'); s.show({ done: false, dispose() {} }); });
  const page = wait.tick();
  page.tick(99);
  assert.equal(s.win, page, 'ended, still in the slot');
  wait.tick();
  assert.deepEqual(shown, []);
  s.drain();
  wait.tick();
  assert.deepEqual(shown, ['bonus'], 'the box has the slot to itself');
});

test('AUDIT 28 F2: the wait ticks in every mode - the modal frame ticks it too', () => {
  const w = src('src/scenes/world.js');
  const modal = w.slice(w.indexOf("try { bountyHost?.tick(dt); } catch (e) { console.warn('[bounty] tick', e); }\n      try { gatherHost?.tick(dt); }"), w.indexOf('// AUDIT F2-I1: the modal frame RETURNS'));   // PROF1: the herbs tick beside the bounties (PROF2: every gathering, one host)
  assert.match(modal, /\n\s*foragingWait\.tick\(\);/, 'a live call, not a word about one');
});

test('AUDIT 28 F7: a switched-off mod has no console command - no HELP line, no HasCommand, "not found" to its name', () => {
  _resetModSettings();
  installForaging({ fetchBytes: async () => new Uint8Array() });
  const name = FORAGING_COMMAND.name;
  assert.equal(hasConsoleCommand(name), true);
  setModSetting('foraging', 'Enabled', false);
  assert.equal(hasConsoleCommand(name), false);
  assert.ok(!consoleCommands().some((c) => c.name === name), 'no HELP line');
  assert.equal(executeConsoleCommand(name), `Command ${name.toUpperCase()} not found.`);
  _resetModSettings();
  assert.equal(hasConsoleCommand(name), true, 'on again, there again');
  _resetForagingInstall();
});

test('AUDIT 28 F4: Foraging\'s Features row says when each half takes effect', () => {
  assert.match(src('src/systems/features.js'), /modFeature\('foraging', 'Takes effect at once; its quests when the game next loads\.', 'world'\)/);
});

test('AUDIT 28 H11: Enter and Space on a DOM window\'s own button are the browser\'s press - never prevented', () => {
  assert.deepEqual(['BUTTON', 'SELECT', 'SUMMARY', 'DIV', 'CANVAS'].map((tagName) => isDomControlTarget({ tagName })), [true, true, true, false, false]);
  assert.equal(isDomControlTarget({ tagName: 'A', href: 'x' }), true);
  assert.equal(isDomControlTarget(null), false);
  const t = src('src/scenes/townTalk.js');
  const at = t.indexOf("if ((e.key === 'Enter' || e.key === ' ') && isDomControlTarget(e.target)) return true;");
  assert.ok(at > 0 && at < t.indexOf('e.preventDefault();', t.indexOf('if (isTextEntryTarget(e.target)) return true;')), 'asked before the prevent');
});

test('AUDIT 28 H12: a payday notice taken down unread goes back in the queue - never dropped; a death in the mode\'s slot takes the street\'s DOM windows down', () => {
  const shown = [];
  let up = true;
  const host = createBountyHost({
    now: () => 0, level: () => 5, entity: () => ({ goldPieces: 0, items: [] }), townName: () => 'X', siteOk: () => true,
    playerPixel: () => null, canStand: () => false, standPack: () => null, say: () => {},
    showNotice: (n) => { if (!up) return false; shown.push(n); return true; }, openBoardWindow: () => {},
  });
  const notice = { title: 'Bounty fulfilled', heading: 'Rats' };
  host.requeue(notice);
  host.tick(0.01);
  assert.deepEqual(shown, [notice]);
  host.requeue(notice);   // taken down under the reader
  host.requeue(notice);   // ...and never twice in the queue
  assert.equal(host.pendingNotices(), 1);
  const door = src('src/ui/bountyDoor.js');
  assert.match(door, /onExit: \(\) => close\(true\)/);
  assert.match(door, /deps\.onClose\?\.\(read\);/);
  assert.match(door, /registerOverlay\(\(\) => close\(true\)\)/, 'the stack\'s Escape is the player\'s own dismissal');
  const w = src('src/scenes/world.js');
  assert.match(w, /createBountyOverlay\('notice', \{ notice, onClose: \(read\) => \{ if \(!read\) bountyHost\?\.requeue\(notice\); \} \}\)/);
  assert.match(w, /if \(modes\?\.deathUp\?\.\(\) && \(bountyDoorOpen\(\) \|\| noticeDoorOpen\(\)\)\) \{ closeBountyDoor\(\); closeNoticeDoor\(\); \}/);
  assert.match(w, /\|\| \(modes\?\.deathUp\?\.\(\) \?\? false\)\) return false;/, 'and no notice is raised over a death');
  up = false;
});

test('AUDIT 28 H8: a built pixel\'s bounty boards are worked out once, not every frame', () => {
  const w = src('src/scenes/world.js');
  // PIN MOVED (GOTHWAY-BOARDS): the split is still memoised on the pixel (`??=`), its one questBoardIndices call over the
  // town's own boards; every board a town stands of its own (`extra` - Gothway Garden's) is a bounty board always
  assert.match(w, /const boardSplitOf = \(p\) => \(p\._boardSplit \?\?= \(\(\) => \{\n\s*const all = p\.boards \?\? \[\];\n\s*const split = questBoardIndices\(all\.filter\(\(b\) => !b\.extra\)\);\n\s*all\.forEach\(\(b, i\) => \{ if \(b\.extra\) split\.add\(i\); \}\);\n\s*return split;\n\s*\}\)\(\)\);/);
  assert.equal((w.match(/questBoardIndices\(/g) ?? []).length, 1, 'the one call, memoised');
});
