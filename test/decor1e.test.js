// DECOR1e (2026-09-25, Mac: decor "Gold per placement", priced "By size", opened from "A UI element that can be clicked
// to open the decorate panel. Allows free cam mode for placement and an intuitive scrolling menu with filters", and
// "kept in the save" offline): THE ROOM'S OWN PIECES. The panel's "In this room" view (ui/decorPanel.js); a placed
// piece moved by the free camera, lit or put out, made to hold things or not, removed for half its cost
// (scenes/decorTool.js) - offline into the room's pool, online through the account service first; the sale that takes
// a room's pieces with it (the client's registry, the scene's record, the host's hooks); and the touch screen's
// flight - the stick, the bar's Fly up and Fly down, no tap or swipe under it (the tool, worldModes.js, world.js). The
// service's own sum is pinned with the service (decor1.test.js). `06-Systems/Online-Arc.md` DECOR1e.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDecorPanel, DECOR_HOLDS_LINE, decorPlacedSub, decorRefundText } from '../src/ui/decorPanel.js';
import {
  stickMove, decorEditPrice, decorEditText, DECOR_DEFAULT_LIGHT, DECOR_FLY_SPEED, DECOR_EYE_REACH, eyePoint,
} from '../src/scenes/decorTool.js';
import { DECOR_CAP, decorPrice, decorRefund, decorSaleBack, decorLightOf } from '../src/net/decorLaw.js';
import { createOnlineHomes, sellOnlineHome, homeRefund, homeSoldLine, homeSaleLines } from '../src/systems/onlineHomes.js';
import { createSceneCache, cacheScene, takeSceneDecor } from '../src/systems/sceneCache.js';
import { settle, near, fakeDoc, fakeWin, all, one, chipNamed, catalogue, rows, toolRig, placeFrom } from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const panelOf = (rig) => rig.doc.body.children.find((c) => c.className === 'dfdecor');
const barOf = (rig) => rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-bar'));
const btn = (root, label) => all(root, 'dfdecor-btn').find((b) => (typeof label === 'string' ? b.textContent === label : label.test(b.textContent)));
const roomTab = (root) => all(root, 'dfdecor-chip').find((c) => /^In this room/.test(c.textContent));
const pick = (root) => ['dfdecor-pick-name', 'dfdecor-pick-line', 'dfdecor-pick-price', 'dfdecor-pick-why'].map((c) => one(root, c).textContent);
const eyeAt = (rig) => { rig.frame(); rig.tool.cameraOverride(rig.cam); return [...rig.cam.pos]; };

/** A piece placed from the catalogue and paid for; the flight ended back at the panel. */
async function placedOne(rig, key = 'm41000', before = () => {}) {
  await placeFrom(rig, key);
  before();
  rig.frame();
  assert.equal(await rig.tool.commit(), true);
  rig.tool.back();
  return rig.standing.at(-1);
}
/** From the panel's room view: choose `id`, press `label`. */
function roomPress(rig, id, label) {
  const root = panelOf(rig);
  if (one(root, 'dfdecor-card').dataset.mode !== 'room') roomTab(root).fire('click');
  rows(root).find((r) => r.dataset.key === id).fire('click');
  btn(root, label).fire('click');
}
/** Move `id`: the room view's Move, and the flight's first frames. */
async function moving(rig, id) {
  roomPress(rig, id, 'Move');
  rig.frame();
  await settle();
  rig.frame();
}
const key = (rig, code) => rig.win.fire('keydown', { code, target: rig.doc.body });

// ─── THE PANEL'S ROOM VIEW ───────────────────────────────────────────────────────────────────────────────────────────

test('DECOR1e the panel\'s room view: two tabs - the catalogue and "In this room" with its count; the room\'s pieces listed with what each cost, holds and gives, and half back; nothing chosen, the four changes stand idle; a piece chosen shows its line and its four changes - Move (the panel goes first), Light and Holds things (each saying which it is now), Remove; a piece that holds anything is never removed nor made to stop holding, and says why - it may still move; what the host changes shows (lit, emptied, gone); showRoom chooses a piece in the room view; a piece whose catalogue entry is unread shows its own shape (mutants: a full piece removed, a full piece made to stop holding, Move under the panel, the light unread by the list, the refund whole, the count unsaid, the room view drawing the catalogue, the chosen piece unchosen, the shape lost)', () => {
  const entries = catalogue();
  const eOf = (k) => entries.find((e) => e.key === k);
  const chair = { id: 'c1', model: 41000, flat: null, pos: [1, 0, 1], rot: [30, 0, 0], scale: 1, light: null, storage: false, paid: 120 };
  const chest = { id: 'k1', model: 41811, flat: null, pos: [2, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: true, paid: 200 };
  const doc = fakeDoc();
  const win = fakeWin();
  const calls = [];
  let closed = 0;
  const pointed = [];
  const panel = createDecorPanel({
    doc, win, onPlace: () => calls.push(['place']), onClose: () => { closed++; }, onPoint: (e) => pointed.push(e?.key ?? null),
    onMove: (p) => calls.push(['move', p.id]), onRemove: (p) => calls.push(['remove', p.id]), onToggle: (p, w) => calls.push([w, p.id]),
    thumbOf: async (e) => `data:${e.key}`,
  });
  let placed = [
    { piece: chair, name: 'Chair', entry: eOf('m41000'), holds: false },
    { piece: chest, name: 'Chest', entry: eOf('m41811'), holds: true },
  ];
  const view = () => ({
    where: 'Your house', entries, progress: 1, ready: true, gold: 1000, count: placed.length, cap: DECOR_CAP,
    radiusOf: () => 0.5, priceOf: () => 75, placed,
  });
  panel.open(view());
  const root = panel.root;
  const card = one(root, 'dfdecor-card');
  const tabs = () => all(one(root, 'dfdecor-tabs'), 'dfdecor-chip').map((t) => [t.textContent, t.getAttribute('aria-pressed')]);
  assert.equal(panel.mode(), 'catalogue');
  assert.deepEqual(tabs(), [['Catalogue', 'true'], ['In this room (2)', 'false']]);
  roomTab(root).fire('click');
  assert.deepEqual([panel.mode(), card.dataset.mode], ['room', 'room'], 'the card wears the view (the filters and Place hidden by it)');
  assert.deepEqual(tabs(), [['Catalogue', 'false'], ['In this room (2)', 'true']]);
  const line = (r) => [one(r, 'dfdecor-row-name').textContent, one(r, 'dfdecor-row-sub').textContent, one(r, 'dfdecor-row-price').textContent];
  assert.deepEqual(rows(root).map((r) => r.dataset.key), ['c1', 'k1'], 'the room\'s pieces, not the catalogue');
  assert.deepEqual(rows(root).map(line), [
    ['Chair', 'placed for 120 gold', '60 gold back'],
    ['Chest', 'placed for 200 gold - holds things (not empty)', '100 gold back'],
  ]);
  const four = () => ['Move', /^Light/, /^Holds things/, 'Remove'].map((l) => btn(root, l).disabled);
  assert.equal(pick(root)[0], 'Choose a placed piece');
  assert.deepEqual(four(), [true, true, true, true], 'nothing chosen, nothing to change');
  // the chair
  rows(root)[0].fire('click');
  assert.deepEqual(pick(root), ['Chair', 'placed for 120 gold', 'Remove: 60 gold back', '']);
  assert.deepEqual(four(), [false, false, false, false]);
  assert.deepEqual([btn(root, /^Light/).textContent, btn(root, /^Holds things/).textContent], ['Light: off', 'Holds things: no']);
  assert.equal(panel.pointed()?.key, 'm41000', 'the preview shows the chosen piece - its model turning');
  assert.equal(pointed.at(-1), 'm41000', 'and the host is told');
  btn(root, 'Light: off').fire('click');
  btn(root, 'Holds things: no').fire('click');
  btn(root, 'Remove').fire('click');
  assert.deepEqual(calls, [['light', 'c1'], ['storage', 'c1'], ['remove', 'c1']]);
  // the full chest
  calls.length = 0;
  rows(root)[1].fire('click');
  assert.deepEqual(pick(root), ['Chest', 'placed for 200 gold - holds things (not empty)', 'Remove: 100 gold back', DECOR_HOLDS_LINE]);
  assert.deepEqual(four(), [false, false, true, true], 'it moves and lights - it is never removed, nor made to stop holding, out from under what it holds');
  btn(root, 'Remove').fire('click');
  btn(root, 'Holds things: yes').fire('click');
  assert.deepEqual(calls, [], 'the idle buttons do nothing');
  btn(root, 'Move').fire('click');
  assert.deepEqual([closed, panel.isOpen(), calls], [1, false, [['move', 'k1']]], 'the panel goes, then the move begins');
  // what the host changes shows - each alone
  panel.open(view());
  assert.deepEqual([panel.mode(), pick(root)[0]], ['room', 'Chest'], 'opened again where it was');
  placed = [{ ...placed[0], piece: { ...chair, light: { color: [1, 1, 1], range: 5, intensity: 1 } } }, placed[1]];
  panel.update(view());
  assert.deepEqual(line(rows(root)[0]), ['Chair', 'placed for 120 gold - gives light', '60 gold back'], 'lit');
  placed = [placed[0], { ...placed[1], holds: false }];
  panel.update(view());
  assert.deepEqual(line(rows(root)[1]), ['Chest', 'placed for 200 gold - holds things', '100 gold back'], 'emptied');
  assert.deepEqual([four(), pick(root)[3]], [[false, false, false, false], '']);
  placed = [placed[0]];
  panel.update(view());
  assert.deepEqual([rows(root).length, pick(root)[0], tabs()[1][0]], [1, 'Choose a placed piece', 'In this room (1)'], 'the chosen piece gone');
  // showRoom, from the catalogue's view
  chipNamed(root, 'Catalogue').fire('click');
  assert.equal(panel.mode(), 'catalogue');
  panel.showRoom('c1');
  assert.deepEqual([panel.mode(), pick(root)[0], rows(root)[0].getAttribute('aria-selected')], ['room', 'Chair', 'true']);
  // a piece the catalogue has not been read for: its own shape
  placed = [{ piece: chair, name: 'Furniture 3', entry: null, holds: false }];
  panel.update(view());
  assert.deepEqual([panel.pointed()?.key, panel.pointed()?.model], ['placed:c1', 41000], 'its own model in the preview');
  // nothing placed
  placed = [];
  panel.update(view());
  assert.deepEqual([one(root, 'dfdecor-empty')?.textContent, pick(root)[0]], ['Nothing placed in this room yet.', 'Nothing placed in this room yet.']);
  // the words
  assert.equal(decorRefundText(181), '90 gold', 'the law\'s half, truncated');
  assert.equal(decorPlacedSub({ piece: { ...chest, light: { color: [1, 1, 1], range: 5, intensity: 1 } }, holds: false }), 'placed for 200 gold - holds things - gives light');
  panel.destroy();
});

// ─── A PLACED PIECE CHANGED ──────────────────────────────────────────────────────────────────────────────────────────

test('DECOR1e moving a placed piece offline: the room view\'s Move flies the same camera from the piece\'s own turn and scale, its ghost the piece itself (its id), the eye looking through the piece\'s own collider; the bar says what the change costs - free, a resize\'s difference, or half a shrink\'s back; placed, it stands in its own place (never a second piece), paid or given back, and the panel is the room view again with it chosen; short of the gold a resize asks, nothing changes and the bar says why; Back leaves it as it stood (mutants: the move from the default turn, a move a new piece, a move paid in full, the resize unpaid, the shrink not given back, the eye stopped by the piece itself, the bar\'s whole price)', async () => {
  const rig = toolRig({ gold: 1000 });
  const name = rig.entries.find((e) => e.key === 'm41000').name;
  const turned = await placedOne(rig, 'm41000', () => { key(rig, 'ArrowLeft'); key(rig, 'ArrowLeft'); key(rig, 'Equal'); });
  assert.deepEqual([turned.rot[0], turned.scale, turned.paid], [-30, 1.1, decorPrice(0.8, 1.1)]);
  assert.equal(rig.rays.at(-1), null, 'a new piece: the eye looks through nothing');
  const paidAtFirst = [...rig.w.paid];
  await moving(rig, turned.id);
  assert.equal(rig.tool.flying(), true);
  assert.deepEqual([rig.tool.placer().state().yaw, rig.tool.placer().state().scale], [-30, 1.1], 'from its own turn and scale');
  assert.equal(rig.tool.ghost().id, turned.id, 'the ghost is the piece itself');
  assert.deepEqual(rig.rays.at(-1), { skip: [`decor:${turned.id}`] }, 'a moved piece is no surface for itself');
  const what = () => one(barOf(rig), 'dfdecor-bar-what').textContent;
  assert.equal(what(), `Moving ${name} - free`);
  key(rig, 'ArrowRight');
  rig.frame();
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual(rig.standing.map((p) => [p.id, p.rot[0], p.scale, p.paid]), [[turned.id, -15, 1.1, turned.paid]], 'in its own place, turned');
  assert.deepEqual([rig.w.paid, rig.w.credited], [paidAtFirst, []], 'a move is free');
  assert.equal(rig.tool.flying(), false);
  const root = panelOf(rig);
  assert.deepEqual([one(root, 'dfdecor-card').dataset.mode, pick(root)[0], rows(root)[0].getAttribute('aria-selected')], ['room', name, 'true'], 'the room view again, the piece chosen');
  // grown: the difference paid
  await moving(rig, turned.id);
  key(rig, 'Equal');
  rig.frame();
  const grow = decorEditPrice(0.8, { paid: turned.paid }, 1.21);
  assert.ok(grow.pay > 0);
  assert.equal(what(), `Moving ${name} - ${decorEditText(grow)}`);
  assert.equal(decorEditText(grow), `${grow.pay} gold`);
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([rig.w.paid, rig.standing[0].paid, rig.standing[0].scale], [[...paidAtFirst, grow.pay], grow.paid, 1.21]);
  // shrunk: half the difference back
  await moving(rig, turned.id);
  for (let i = 0; i < 3; i++) key(rig, 'Minus');
  rig.frame();
  const shrink = decorEditPrice(0.8, { paid: grow.paid }, 0.909);
  assert.ok(shrink.refund > 0 && shrink.pay === 0);
  assert.equal(what(), `Moving ${name} - ${shrink.refund} gold back`);
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([rig.w.credited, rig.standing[0].paid], [[shrink.refund], shrink.paid]);
  // short of a resize's gold
  await moving(rig, turned.id);
  rig.w.gold = 0;
  key(rig, 'Equal');
  rig.frame();
  const before = { ...rig.standing[0] };
  assert.match(rig.tool.why(), /^You need \d+ more gold\.$/);
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([rig.standing, rig.w.paid.length], [[before], 2], 'nothing changes');
  // Back: as it stood
  key(rig, 'Escape');
  assert.deepEqual([rig.tool.flying(), rig.standing], [false, [before]]);
  assert.deepEqual([one(panelOf(rig), 'dfdecor-card').dataset.mode, pick(panelOf(rig))[0]], ['room', name], 'back to the room view, the piece still chosen');
  // the eye's ray, filtered
  const seen = [];
  eyePoint({ raycastHit: (e, d, max, f) => { seen.push([max, f]); return { dist: 1 }; } }, [0, 0, 0], [0, 0, 1], ['decor:x']);
  assert.deepEqual(seen, [[DECOR_EYE_REACH, { skip: ['decor:x'] }]]);
});

test('DECOR1e lighting, holding and removing offline: a piece lit takes its catalogue piece\'s own light (Daggerfall\'s), else a warm lamp\'s, and is put out again; made to hold things and not; removed, half of what it cost comes back to the purse and it stands no more; one that holds anything is neither removed nor made to stop holding, even asked (mutants: the lamp for every piece, removing a full piece, un-holding a full piece, the refund whole, the removal unstood)', async () => {
  const rig = toolRig({ gold: 1000 });
  const candle = await placedOne(rig, 'f210.3');
  const own = decorLightOf(rig.entries.find((e) => e.key === 'f210.3').light);
  assert.ok(own, 'a candle carries Daggerfall\'s own light');
  assert.deepEqual(candle.light, own, 'placed lit');
  rig.frame();
  roomPress(rig, candle.id, 'Light: on');
  await settle();
  assert.equal(rig.standing[0].light, null, 'put out');
  rig.frame();
  roomPress(rig, candle.id, 'Light: off');
  await settle();
  assert.deepEqual(rig.standing[0].light, own, 'lit again - its own light, not a lamp\'s');
  // a chair has none of its own: a warm lamp's
  rig.frame();
  chipNamed(panelOf(rig), 'Catalogue').fire('click');
  rows(panelOf(rig)).find((r) => r.dataset.key === 'm41000').fire('click');
  btn(panelOf(rig), 'Place').fire('click');
  rig.frame();
  await settle();
  rig.frame();
  assert.equal(await rig.tool.commit(), true);
  rig.tool.back();
  const chair = rig.standing[1];
  rig.frame();
  roomPress(rig, chair.id, 'Light: off');
  await settle();
  assert.deepEqual(rig.standing[1].light, decorLightOf(DECOR_DEFAULT_LIGHT), 'a warm lamp\'s');
  // holding things
  rig.frame();
  roomPress(rig, chair.id, 'Holds things: no');
  await settle();
  assert.equal(rig.standing[1].storage, true);
  rig.holds.add(chair.id);
  rig.frame();
  const root = panelOf(rig);
  assert.deepEqual([btn(root, 'Remove').disabled, btn(root, 'Holds things: yes').disabled, pick(root)[3]], [true, true, DECOR_HOLDS_LINE]);
  // asked anyway (the panel drawn before the chair was filled): the tool itself says no
  rig.holds.delete(chair.id);
  rig.frame();
  rig.holds.add(chair.id);
  btn(root, 'Remove').fire('click');
  btn(root, 'Holds things: yes').fire('click');
  await settle();
  assert.deepEqual([rig.standing.length, rig.standing[1].storage, rig.w.credited], [2, true, []], 'what it holds would go with it');
  // emptied: made to stop holding, then removed
  rig.holds.delete(chair.id);
  rig.frame();
  roomPress(rig, chair.id, 'Holds things: yes');
  await settle();
  assert.equal(rig.standing[1].storage, false);
  rig.frame();
  roomPress(rig, chair.id, 'Remove');
  await settle();
  assert.deepEqual([rig.standing.map((p) => p.id), rig.w.credited], [[candle.id], [decorRefund(chair.paid)]]);
  assert.equal(rig.said.at(-1), `${rig.entries.find((e) => e.key === 'm41000').name} removed - ${decorRefund(chair.paid)} gold back.`);
  assert.ok(decorRefund(chair.paid) < chair.paid);
});

test('DECOR1e an online home\'s pieces changed: the account service first - a move, a resize, a light, each written as the piece\'s whole place (where, turn, scale, light, storage, cost) by the owner\'s character - and the service\'s answer is what stands, paid after; refused, the service\'s word and nothing changes; short of the gold before the write, the service is never asked; short once the answer came, the old place is written back and nothing paid; a removal is the service\'s first, and half of what the SERVICE says it cost comes back; refused, it stays; a room left before an answer stands nothing, though a removal the service made is paid back (mutants: the write skipped, the old place never written back, the local cost refunded, a refused removal taken)', async () => {
  const calls = [];
  const svc = {
    moveAnswer: null,
    removeAnswer: null,
    async place(a) { calls.push(['place', a]); return { ok: true, data: { piece: a.piece } }; },
    async move(a) { calls.push(['move', a]); return svc.moveAnswer ? svc.moveAnswer(a) : { ok: true, data: { piece: { ...stood(a.id), ...a.place, pos: [9, 9, 9] } } }; },
    async remove(a) { calls.push(['remove', a]); return svc.removeAnswer ? svc.removeAnswer(a) : { ok: true, data: { piece: { ...stood(a.id), paid: 200 } } }; },
  };
  const rig = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 77, buildingKey: 9 }, homeDecor: svc, gold: 1000 });
  const stood = (id) => rig.standing.find((p) => p.id === id);
  const at = { mapId: 77, buildingKey: 9, character: 'char-me' };
  const chair = await placedOne(rig);
  const placeOf = (p) => ({ pos: p.pos, rot: p.rot, scale: p.scale, light: p.light, storage: p.storage, paid: p.paid });
  // a resize: written, then paid, the service's answer standing
  await moving(rig, chair.id);
  key(rig, 'Equal');
  rig.frame();
  const ghost = rig.tool.ghost();
  const grow = decorEditPrice(0.8, chair, 1.1);
  calls.length = 0;
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual(calls, [['move', { ...at, id: chair.id, place: placeOf({ ...ghost, paid: grow.paid }) }]]);
  assert.deepEqual([rig.standing[0].pos, rig.standing[0].paid, rig.w.paid.at(-1)], [[9, 9, 9], grow.paid, grow.pay], 'the service\'s piece stands, paid after');
  // refused
  const moved = { ...rig.standing[0] };
  svc.moveAnswer = () => ({ ok: false, error: 'decor-rate' });
  await moving(rig, chair.id);
  key(rig, 'ArrowLeft');
  rig.frame();
  const paidCount = rig.w.paid.length;
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([rig.said.at(-1), rig.standing, rig.w.paid.length], ['refused: decor-rate', [moved], paidCount]);
  // short before the write: never asked
  svc.moveAnswer = null;
  rig.w.gold = 0;
  key(rig, 'Equal');
  rig.frame();
  calls.length = 0;
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([calls, rig.standing], [[], [moved]], 'the service is not asked for what cannot be paid');
  // short once the answer came: written back
  rig.w.gold = 1000;
  svc.moveAnswer = (a) => { rig.w.gold = 0; return { ok: true, data: { piece: { ...moved, ...a.place } } }; };
  calls.length = 0;
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual(calls.map((c) => c[1].place.scale), [1.21, moved.scale], 'the change, then the piece as it was');
  assert.deepEqual(calls[1], ['move', { ...at, id: chair.id, place: placeOf(moved) }]);
  assert.deepEqual([rig.standing, rig.w.paid.length], [[moved], paidCount], 'nothing paid, nothing moved');
  key(rig, 'Escape');
  // a light, through the service
  rig.w.gold = 1000;
  svc.moveAnswer = null;
  rig.frame();
  calls.length = 0;
  roomPress(rig, chair.id, 'Light: off');
  await settle();
  assert.deepEqual(calls[0][1].place.light, decorLightOf(DECOR_DEFAULT_LIGHT));
  assert.ok(rig.standing[0].light, 'lit');
  // a room left before a move's answer: written and paid for, stood nowhere
  const lit = { ...rig.standing[0] };
  svc.moveAnswer = (a) => { rig.setVisit(3); return { ok: true, data: { piece: { ...stood(a.id), ...a.place, pos: [7, 7, 7] } } }; };
  rig.frame();
  await moving(rig, chair.id);
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual(rig.standing, [lit], 'the room it would have stood in is gone');
  rig.setVisit(1);
  svc.moveAnswer = null;
  // a removal refused
  svc.removeAnswer = () => ({ ok: false, error: 'no-decor' });
  rig.frame();
  roomPress(rig, chair.id, 'Remove');
  await settle();
  assert.deepEqual([rig.said.at(-1), rig.standing.length, rig.w.credited], ['refused: no-decor', 1, []]);
  // a removal: the service's cost, halved
  svc.removeAnswer = null;
  rig.frame();
  roomPress(rig, chair.id, 'Remove');
  await settle();
  assert.deepEqual(calls.at(-1), ['remove', { ...at, id: chair.id }]);
  assert.deepEqual([rig.standing.length, rig.w.credited], [0, [100]], 'half of the 200 the service says it cost - not the client\'s word');
  // a room left before an answer
  const second = await (async () => {
    chipNamed(panelOf(rig), 'Catalogue').fire('click');
    rows(panelOf(rig)).find((r) => r.dataset.key === 'm41000').fire('click');
    btn(panelOf(rig), 'Place').fire('click');
    rig.frame();
    await settle();
    rig.frame();
    await rig.tool.commit();
    rig.tool.back();
    return rig.standing.at(-1);
  })();
  svc.removeAnswer = (a) => { rig.setVisit(2); return { ok: true, data: { piece: { ...stood(a.id), paid: 50 } } }; };
  rig.frame();
  roomPress(rig, second.id, 'Remove');
  await settle();
  assert.deepEqual([rig.standing.length, rig.w.credited.at(-1)], [1, 25], 'the service took it: paid back - the room it stood in is gone, so nothing there is touched');
});

test('DECOR1e a piece whose size the catalogue has not read yet is moved at what it was priced at: still, it costs nothing; resized, the law\'s difference from that size (mutant: the unread piece unmovable)', async () => {
  const rig = toolRig({ radius: () => null });
  const old = { id: 'old1', model: 41000, flat: null, pos: [1, 0, 1], rot: [45, 0, 0], scale: 1.25, light: null, storage: false, paid: 150 };
  rig.standing.push(old);
  rig.frame();
  assert.equal(rig.tool.openPanel(), true);
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  await moving(rig, 'old1');
  assert.ok(rig.tool.ghost(), 'it stands where the eye meets the room - priced by its own cost');
  assert.equal(one(barOf(rig), 'dfdecor-bar-what').textContent.endsWith(' - free'), true);
  key(rig, 'Equal');
  rig.frame();
  const grow = decorEditPrice(150 / (150 * 1.25), old, 1.375);
  assert.deepEqual([rig.tool.ghost().paid, grow.pay], [grow.paid, grow.paid - 150]);
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([rig.w.paid, rig.standing[0].paid], [[grow.pay], grow.paid]);
});

// ─── THE TOUCH SCREEN ────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR1e the touch screen\'s flight: the stick flies the eye - its throw the pace, read over the walk keys it presses too, and with no stick in hand the keys; the bar\'s Fly up and Fly down are held as Jump and Crouch are, let go when the finger lifts or is taken or a window takes the bar; the bar says so, and a keyboard\'s bar has neither; a tap\'s mouse press never places (mutants: the stick unread, forward and sideways crossed, the throw unbounded, the hold never let go, a window keeping it held, the buttons on every bar)', async () => {
  assert.equal(stickMove(null), null);
  assert.deepEqual(stickMove({ x: 2, y: -3 }), { forward: -1, strafe: 1 }, 'each within one');
  assert.deepEqual(stickMove({ x: Number.NaN, y: 0.25 }), { forward: 0.25, strafe: 0 });
  const rig = toolRig({ touch: true });
  await placeFrom(rig, 'm41000');
  const bar = barOf(rig);
  assert.match(bar.className, /\btouch\b/, 'a finger\'s bar - at the top, clear of the stick and the layer\'s buttons');
  assert.match(one(bar, 'dfdecor-bar-keys').textContent, /the stick, and hold Fly up or Fly down/);
  const desk = toolRig();
  await placeFrom(desk, 'm41000');
  assert.deepEqual([chipNamed(barOf(desk), 'Fly up'), chipNamed(barOf(desk), 'Fly down')], [undefined, undefined], 'a keyboard has Jump and Crouch');
  const step = DECOR_FLY_SPEED * 0.1;
  // the stick
  const p0 = eyeAt(rig);
  rig.hand.stick = { x: 0, y: 1 };
  const p1 = eyeAt(rig);
  assert.ok(near(p1[2], p0[2] + step) && near(p1[0], p0[0]), 'full forward: the pace');
  rig.hand.stick = { x: 0.5, y: 0 };
  const p2 = eyeAt(rig);
  assert.ok(near(p2[0], p1[0] + step / 2) && near(p2[2], p1[2]), 'half a throw right: half the pace, to the right');
  rig.hand.stick = { x: 0, y: 0 };
  rig.win.fire('keydown', { code: 'KeyW', target: rig.doc.body });
  assert.deepEqual(eyeAt(rig), p2, 'a stick at rest in hand holds it, whatever keys it pressed');
  rig.hand.stick = null;
  const p3 = eyeAt(rig);
  assert.ok(near(p3[2], p2[2] + step), 'no stick in hand: the walk keys');
  rig.win.fire('keyup', { code: 'KeyW', target: rig.doc.body });
  // Fly up, held
  const up = chipNamed(bar, 'Fly up');
  const down = chipNamed(bar, 'Fly down');
  const y0 = eyeAt(rig)[1];
  up.fire('pointerdown', { pointerId: 1 });
  assert.ok(near(eyeAt(rig)[1], y0 + step), 'held: up');
  assert.ok(near(eyeAt(rig)[1], y0 + 2 * step), 'still held: still up');
  up.fire('pointerup', { pointerId: 1 });
  assert.ok(near(eyeAt(rig)[1], y0 + 2 * step), 'let go: it stays');
  down.fire('pointerdown', { pointerId: 1 });
  assert.ok(near(eyeAt(rig)[1], y0 + step), 'Fly down');
  down.fire('pointercancel', { pointerId: 1 });
  assert.ok(near(eyeAt(rig)[1], y0 + step), 'a finger taken lets go');
  down.fire('pointerdown', { pointerId: 1 });
  rig.frame({ overlayUp: true });
  assert.ok(near(eyeAt(rig)[1], y0 + step), 'a window over the flight took the bar, and the hold with it');
  down.fire('pointerdown', { pointerId: 1 });
  down.fire('lostpointercapture', { pointerId: 1 });
  assert.ok(near(eyeAt(rig)[1], y0 + step));
  // a tap's mouse press
  const seen = rig.win.fire('mousedown', { button: 0 });
  await settle();
  assert.deepEqual([seen.stopped, rig.standing.length], [false, 0], 'a finger places with the bar\'s Place alone');
  btn(bar, 'Place').fire('click');
  await settle();
  assert.equal(rig.standing.length, 1, 'the bar\'s Place places');
});

test('DECOR1e the touch screen\'s flight in the host (worldModes.js, world.js) by source: the tool reads the host\'s stick; the body is handed no stick while the camera flies (after the TI2 read the pins keep); a swipe or a pad\'s trigger swings nothing under it - its release still goes through; the hosts\' finger tap presses nothing under it; the flight is the modes\' to say (mutants: the body walking with the eye, a swing under the flight, a tap activating)', () => {
  const m = src('src/scenes/worldModes.js');
  const w = src('src/scenes/world.js');
  assert.match(m, /stick: \(\) => host\.stickAxes\?\.\(\) \?\? null,/, 'the tool\'s stick is the host\'s');
  assert.match(m, /mv\.analog = host\.stickAxes\?\.\(\) \?\? null;[^\n]*\n\s*if \(decorTool\.flying\(\)\) mv\.analog = null;/, 'the body\'s stick nulled under the flight, right after the read');
  assert.match(m, /attackInput\(dx, dy, held\) \{ if \(held && decorTool\.flying\(\)\) return; modalAttackSink\(\)\?\.\(dx, dy, held\); \},/);
  assert.match(m, /decorFlying: \(\) => decorTool\.flying\(\),/);
  assert.match(w, /tap: \(x, y, opts = null\) => \{\n\s*if \(modes\?\.decorFlying\?\.\(\)\) return;/, 'the first thing a tap asks');
});

// ─── A ROOM SOLD ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR1e a room sold takes its placed pieces: online, the service\'s count and half-sum come back with the release (a word the law would not say is none), one credit pays the home\'s share and the pieces\' half together, and the sale says both; the offer says the pieces go too; offline, the house\'s or ship\'s pieces are taken out of its scene once (never paid back twice), what they held staying with the scene, and each one\'s half goes into the account the sale pays - the house\'s region\'s, the ship\'s bank\'s - before the scene is dropped; the purse is what a removal or a shrink pays back into (mutants: the pieces\' half never credited, a bad word believed, the sale\'s line the home\'s alone, a sold scene\'s pieces left to pay again, the half whole, the hooks unwired)', async () => {
  const api = {
    answer: null,
    async town(mapId) { return { ok: true, data: { mapId, homes: [] } }; },
    async release() { return api.answer; },
  };
  const homes = createOnlineHomes({ api, character: () => 'char-me' });
  api.answer = { ok: true, data: { ok: true, price: 42000, decorCount: 3, decorBack: 120 } };
  assert.deepEqual(await homes.release(5, 9), { ok: true, price: 42000, decorCount: 3, decorBack: 120 });
  api.answer = { ok: true, data: { ok: true, price: 42000, decorCount: -2, decorBack: 1.5 } };
  assert.deepEqual(await homes.release(5, 9), { ok: true, price: 42000, decorCount: 0, decorBack: 0 }, 'a word the law would not say is none');
  api.answer = { ok: true, data: { ok: true, price: 42000, decorCount: 3, decorBack: 120 } };
  const credited = [];
  assert.deepEqual(await sellOnlineHome(homes, { mapId: 5, buildingKey: 9, credit: (n) => credited.push(n) }), { ok: true, refund: homeRefund(42000), decorBack: 120 });
  assert.deepEqual(credited, [homeRefund(42000) + 120], 'one credit, the home\'s share and the pieces\' half');
  assert.equal(homeSoldLine(25500, 120), 'You sold your home. 25620 gold went to this region\'s bank account, 120 of it for its placed pieces.');
  assert.equal(homeSoldLine(25500), 'You sold your home. 25500 gold went to this region\'s bank account.', 'none placed: the sentence it always was');
  assert.equal(homeSaleLines(25500)[2], 'Its placed pieces go too, for half of what they cost.');
  // offline: the scene's pieces, taken once
  const p = (id, paid) => ({ id, model: 41000, flat: null, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: true, paid });
  const cache = createSceneCache();
  cacheScene(cache, 'House', { decor: [p('a', 181), p('b', 41)], decorItems: { a: [{ name: 'Ruby' }] } });
  const taken = takeSceneDecor(cache, 'House');
  assert.deepEqual([taken.map((x) => x.id), decorSaleBack(taken)], [['a', 'b'], 90 + 20], 'each one\'s half, truncated a piece at a time');
  assert.deepEqual(takeSceneDecor(cache, 'House'), [], 'never paid back twice');
  assert.deepEqual(cache.scenes.get('House').decorItems, { a: [{ name: 'Ruby' }] }, 'what they held stays with the scene, and goes with it');
  assert.deepEqual([takeSceneDecor(cache, 'Nowhere'), decorSaleBack(null), decorSaleBack([{ paid: -4 }, {}])], [[], 0, 0]);
  // the host's hooks
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /function decorSold\(sceneName, region\) \{\n\s*const pieces = takeSceneDecor\(sceneCache\(\), sceneName\);\n\s*if \(!pieces\.length\) return 0;\n\s*const back = decorSaleBack\(pieces\);\n\s*const account = homeAccount\(region\);\n\s*if \(account && back > 0\) account\.accountGold \+= back;/);
  assert.match(m, /removePermanentScene: \(mapId, k\) => \{ decorSold\(interiorSceneName\(mapId, k\), region\); removePermanentScene\(sceneCache\(\), interiorSceneName\(mapId, k\)\); \},/, 'the house: its pieces\' half before its scene is dropped');
  assert.match(m, /removePermanentScene: \(ship\) => \{\n\s*decorSold\(interiorSceneName\(SHIP_INTERIOR_MAP_IDS\[ship\], BUILDING_KEY_0\), bankRegion\(\)\);/, 'the ship: its interior\'s');
  assert.match(m, /townTalk\?\.say\?\.\(homeSoldLine\(r\.refund, r\.decorBack\)\);/, 'the online sale says both');
  assert.match(m, /credit: \(n\) => \{ purse\.addGold\(n\); \},/, 'a removal\'s or a shrink\'s half into the purse');
});
