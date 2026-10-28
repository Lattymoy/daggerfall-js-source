// RPT1026-WORLD (2026-10-27), the decorator's two private reports, driven through the real decorator (scenes/decor/
// decorTool.js), its real bar and panel (ui/decorPanel.js) over the rig's DOM, and the real hover seam (ui/worldPlaque.js
// worldHoverFrame, systems/quickLoot.js) - the input path a mouse click takes:
//   - CONFIRM-REREAD: a home's room read that went unanswered as the draft opened left every Confirm of the visit
//     refused; Confirm reads the room again, and keeps only the room the draft began from.
//   - CONFIRM-ONCE: a second click on Confirm while the first is on its way sent the batch twice and paid twice.
//   - DECOR-VERBS: where no plaque is drawn (a touch screen, the classic skin with quick loot off) and with World
//     Tooltips off, a press on a placed piece never reached Move.
// bible/06-Systems/Online-Arc.md, RPT1026-WORLD CONFIRM-REREAD, CONFIRM-ONCE, DECOR-VERBS, has the account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toolRig, settle, all, rows, placeFrom } from '../../decorFakes.mjs';
import { worldHoverFrame, destroyWorldPlaque, worldPlaqueOn, classicPlaqueOn } from '../../../src/ui/worldPlaque.js';
import { plaqueActionFor, quickLootWheel, resetQuickLoot, plaqueVerbsWanted } from '../../../src/systems/quickLoot.js';
import { setUiSkin } from '../../../src/systems/uiSkin.js';
import { setPref, _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';
import { decorPlaque, decorVerbKey, decorPressFrame } from '../../../src/systems/decor/decorLook.js';

const HOME = { kind: 'home', where: 'Your home', mapId: 11, buildingKey: 22 };
const CARAVAN = { kind: 'caravan', where: 'Your caravan' };
const barOf = (rig) => rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-bar'));
const button = (root, label) => all(root, 'dfdecor-btn').concat(all(root, 'dfdecor-chip')).find((b) => b.textContent === label);
const piece = (extra = {}) => ({ id: 'p1abcdefgh12', model: 41000, flat: null, pos: [0, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 180, ...extra });

/** A piece placed from the catalogue and kept in the draft by the left click a placement takes (the look locked). */
async function placedInDraft(rig) {
  const key = rig.entries.find((e) => e.model != null && e.kind !== 'door').key;
  await placeFrom(rig, key);
  rig.win.fire('mousedown', { button: 0, target: rig.doc.body });
  for (let i = 0; i < 3; i++) { await settle(); rig.frame(); }
  assert.equal(rig.standing.length, 1, 'the piece stands in the draft');
  assert.equal(!!rig.tool.ghost(), false, 'back in the flight, where the bar holds Confirm');
}
/** The bar's Confirm, clicked as a mouse does it - the cursor freed first (the decorator's capture leaves an unlocked
 *  press to the page), its mousedown, mouseup and click. */
async function clickConfirm(rig) {
  rig.state.locked = false;
  rig.frame();
  const confirm = button(barOf(rig), 'Confirm');
  assert.ok(confirm && !confirm.hidden, 'the bar shows Confirm');
  for (const t of ['mousedown', 'mouseup']) rig.win.fire(t, { button: 0, target: confirm });
  confirm.fire('click');
}
const drain = async (n = 6) => { for (let i = 0; i < n; i++) await settle(); };

test('RPT1026-WORLD CONFIRM-REREAD: a home whose room read went unanswered as the draft opened is read again at Confirm - and kept (mutants: the old refusal for the visit, the revision never taken)', async () => {
  const sent = [];
  let lists = 0;
  const rig = toolRig({
    room: HOME, gold: 5000,
    homeDecor: {
      list: async () => { lists++; return lists === 1 ? { ok: false, error: 'offline' } : { ok: true, data: { rev: 7, pieces: [] } }; },   // accountClient.js DECOR_LIST_WAIT_MS: a stalled read answers 'offline'
      batch: async (b) => { sent.push(b); return { ok: true, data: { rev: b.rev + 1, gold: 0 } }; },
    },
  });
  await placedInDraft(rig);
  await clickConfirm(rig);
  await drain();
  assert.equal(lists, 2, 'Confirm asked the room again');
  assert.equal(sent.length, 1, 'and the batch went - before, nothing went for the rest of the visit');
  assert.equal(sent[0].rev, 7, 'at the revision the second read answered');
  assert.equal(sent[0].put.length, 1);
  assert.ok(rig.said.includes('The room is kept.'), JSON.stringify(rig.said));
  assert.ok(!rig.said.includes('The room could not be read.'));
  rig.tool.destroy();
});

test('RPT1026-WORLD CONFIRM-REREAD: the revision is taken only for the room the draft began from - a room another hand changed since is the stale-revision refusal; a read that fails again says so (mutants: the room taken unread, any revision taken)', async () => {
  for (const [second, word] of [
    [{ ok: true, data: { rev: 9, pieces: [piece({ id: 'theirs123456' })] } }, 'refused: decor-rev'],
    [{ ok: false, error: 'offline' }, 'The room could not be read.'],
    [{ ok: true, data: { pieces: [] } }, 'The room could not be read.'],
  ]) {
    const sent = [];
    let lists = 0;
    const rig = toolRig({
      room: HOME, gold: 5000,
      homeDecor: {
        list: async () => { lists++; return lists === 1 ? { ok: false, error: 'offline' } : second; },
        batch: async (b) => { sent.push(b); return { ok: true, data: { rev: b.rev + 1, gold: 0 } }; },
      },
    });
    await placedInDraft(rig);
    await clickConfirm(rig);
    await drain();
    assert.equal(sent.length, 0, `nothing written over: ${word}`);
    assert.ok(rig.said.includes(word), `${word}: ${JSON.stringify(rig.said)}`);
    assert.equal(rig.standing.length, 1, 'the draft stands as it was, to Confirm again or Discard');
    assert.equal(rig.w.paid.length, 0, 'and nothing was paid');
    rig.tool.destroy();
  }
});

test('RPT1026-WORLD CONFIRM-ONCE: a second click on Confirm while the first is on its way sends nothing and pays nothing again (mutants: the guard gone, never let go)', async () => {
  const sent = [];
  let release = null;
  const rig = toolRig({
    room: HOME, gold: 5000,
    homeDecor: {
      list: async () => ({ ok: true, data: { rev: 1, pieces: [] } }),
      batch: (b) => { sent.push(b); return new Promise((r) => { release = () => r({ ok: true, data: { rev: b.rev + 1, gold: 0 } }); }); },
    },
  });
  await placedInDraft(rig);
  await clickConfirm(rig);
  await drain(2);
  await clickConfirm(rig);
  await drain(2);
  assert.equal(sent.length, 1, 'one batch for one room - before, the second click sent it again');
  release();
  await drain();
  assert.equal(rig.w.paid.length, 1, 'paid once - before, twice for one piece');
  assert.equal(rig.w.gold, 5000 - rig.w.paid[0]);
  // the guard is let go: the room changed again is confirmed again
  rig.state.locked = true;
  const key = rig.entries.find((e) => e.model != null && e.kind !== 'door').key;
  rig.win.fire('keydown', { code: 'Tab', repeat: false });
  for (let i = 0; i < 4; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
  rows(root).find((r) => r.dataset.key === key).fire('click');
  all(root, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  rig.frame(); await settle(); rig.frame();
  rig.win.fire('mousedown', { button: 0, target: rig.doc.body });
  for (let i = 0; i < 3; i++) { await settle(); rig.frame(); }
  await clickConfirm(rig);
  await drain(2);
  assert.equal(sent.length, 2, 'a later Confirm goes');
  release();
  await drain();
  rig.tool.destroy();
});

/** The interior host's hover for a placed piece while decorating - worldModes.js's namer arm (decorPlaque over the
 *  piece), through the real seam. */
const hoverPiece = (rig, p) => worldHoverFrame({
  eye: [0, 1.6, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity },
  pick: () => ({ key: `decor:${p.id}`, distance: 1, reach: 3.2 }),
  name: (key) => (key === `decor:${p.id}` && rig.tool.flying() && !rig.tool.ghost() ? decorPlaque(null, { piece: p, holds: false, mayEdit: true, name: 'Bed' }) : null),
  contents: () => null,
});

test('RPT1026-WORLD DECOR-VERBS: on the classic skin with quick loot off no plaque is drawn - a press on a placed piece in the caravan still moves it, and the next click sets it down (mutants: the decorator never asks, the seam stands down, the whole list folded)', async () => {
  resetPrefs(); resetQuickLoot();
  setUiSkin('classic');
  setPref('quickLoot', false);
  try {
    assert.equal(worldPlaqueOn(), false);
    assert.equal(classicPlaqueOn(), false, 'no plaque of either skin');
    const rig = toolRig({ room: CARAVAN, gold: 5000 });
    const p = piece();
    rig.standing.push(p);
    rig.frame();
    rig.doc.body.children.find((c) => c.className === 'dfdecor-open').fire('click');   // Decorate: the flight
    for (let i = 0; i < 3; i++) { rig.frame(); await settle(); }
    assert.equal(rig.tool.flying() && !rig.tool.ghost(), true, 'browsing');
    assert.equal(plaqueVerbsWanted(), true);
    const f = hoverPiece(rig, p);
    assert.ok(f, 'the frame is resolved - before, the seam stood down and nothing was');
    const key = `decor:${p.id}`;
    assert.equal(plaqueActionFor(key), 'move', 'the press on it is Move, the plaque\'s first row');
    assert.equal(quickLootWheel(1), false, 'and no wheel steps a list nobody sees');
    // tryExit's decor arm: decorating, the lit row's verb, else the piece's own use
    assert.equal(rig.tool.act(plaqueActionFor(key), p.id), true);
    rig.cam.yaw = 0.7;
    for (let i = 0; i < 4; i++) { rig.frame(); await settle(); }
    assert.ok(rig.tool.ghost(), 'the piece is in hand');
    rig.win.fire('mousedown', { button: 0, target: rig.doc.body });
    for (let i = 0; i < 4; i++) { await settle(); rig.frame(); }
    assert.notDeepEqual(rig.standing[0].pos, [0, 0, 2], 'and stands where it was set down');
    assert.equal(rig.standing.length, 1);
    // out of the flight, nothing of the decorator's is folded
    assert.equal(rig.tool.discardDraft(), true);
    rig.win.fire('keydown', { code: 'Escape', repeat: false });
    rig.frame();
    assert.equal(rig.tool.flying(), false, 'out of the flight');
    assert.equal(plaqueVerbsWanted(), false, 'the decorator asks only while it browses');
    assert.equal(hoverPiece(rig, p), null);
    assert.equal(plaqueActionFor(key), null);
    rig.tool.destroy();
  } finally {
    destroyWorldPlaque(); resetPrefs(); resetQuickLoot();
  }
});

test('RPT1026-WORLD DECOR-VERBS: the law - the decorator\'s keys, and its frame folded with its first verb alone; nothing else (mutants: a key dropped, any frame folded, an unlit list lit)', () => {
  for (const k of ['decor:abc', 'base:12', 'container:3', 'shelf:1', 'chair:0', 'bed:2', 'door:4', 'act:decor:xyz']) assert.equal(decorVerbKey(k), true, k);
  for (const k of ['exit:0', 'act:lever', 'person:3', 'loot:7', 'droppedLoot:1', 'peer:9', null, 3]) assert.equal(decorVerbKey(k), false, String(k));
  const rows3 = [{ id: 'move' }, { id: 'duplicate' }, { id: 'remove' }];
  assert.deepEqual(decorPressFrame({ key: 'decor:a', kind: 'actions', rows: rows3 }).rows, [{ id: 'move' }]);
  assert.equal(decorPressFrame({ key: 'peer:1', kind: 'actions', rows: rows3 }), null, 'a player\'s verbs are never the decorator\'s');
  assert.equal(decorPressFrame({ key: 'decor:a', kind: 'items', rows: rows3 }), null, 'a chest\'s goods are no verbs');
  assert.equal(decorPressFrame({ key: 'decor:a', kind: 'actions', rows: rows3, startUnlit: true }), null);
  assert.equal(decorPressFrame({ key: 'decor:a', kind: 'actions', rows: [] }), null);
  assert.equal(decorPressFrame(null), null);
});

test('RPT1026-WORLD DECOR-VERBS: with World Tooltips off the interior host\'s namer still answers the decorator\'s keys while it browses - and nothing else (by source: the one gate; the host grows by nothing)', () => {
  const wm = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.ok(wm.includes("if (!worldTooltipsOn() && !(decorVerbKey(key) && decorTool.flying() && !decorTool.ghost())) return null;"), 'the gate lets the decorator\'s keys through while it browses');
  assert.ok(!wm.includes('      if (!worldTooltipsOn()) return null;\n      const hide = hideInteractTooltip();'), 'the bare gate is gone from the interior namer');
  const plaque = readFileSync(new URL('../../../src/ui/worldPlaque.js', import.meta.url), 'utf8');
  assert.ok(plaque.includes('foldQuickLoot(verbs ? decorPressFrame(frame) : frame);'));
});

test('RPT1026-WORLD guard: the decorator\'s Move in the caravan, the ship and the house - by the plaque\'s row and by the panel\'s In this room - stands the piece where the click sets it down (the decorator itself was never the fault)', async () => {
  for (const room of [CARAVAN, { kind: 'ship', where: 'Your ship' }, { kind: 'house', where: 'Your house' }]) {
    for (const door of ['plaque', 'panel']) {
      const rig = toolRig({ room, gold: 5000 });
      rig.standing.push(piece());
      rig.frame();
      rig.doc.body.children.find((c) => c.className === 'dfdecor-open').fire('click');
      for (let i = 0; i < 3; i++) { rig.frame(); await settle(); }
      if (door === 'plaque') assert.equal(rig.tool.act('move', piece().id), true);
      else {
        rig.win.fire('keydown', { code: 'Tab', repeat: false });
        for (let i = 0; i < 4; i++) { rig.frame({ overlayUp: true }); await settle(); }
        const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
        all(root, 'dfdecor-chip').find((c) => String(c.textContent).startsWith('In this room')).fire('click');
        rig.frame({ overlayUp: true }); await settle();
        rows(root)[0].fire('click');
        rig.frame({ overlayUp: true }); await settle();
        all(root, 'dfdecor-btn').find((b) => b.textContent === 'Move').fire('click');
      }
      rig.cam.yaw = 0.7;
      for (let i = 0; i < 4; i++) { rig.frame(); await settle(); }
      rig.win.fire('mousedown', { button: 0, target: rig.doc.body });
      for (let i = 0; i < 4; i++) { await settle(); rig.frame(); }
      assert.notDeepEqual(rig.standing[0].pos, [0, 0, 2], `${room.kind} by the ${door}`);
      assert.equal(rig.tool.flying() && !rig.tool.ghost(), true, `${room.kind} by the ${door}: back in the flight`);
      rig.tool.destroy();
    }
  }
});
