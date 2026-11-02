// FIELD BUGS 2026-10-29f REST-GUEST (#feature-feedback, "Housing feedback & suggestions after 20 hours of decorating",
// item 8: "Allow friends and guild members to rest in your house - Sleepovers...?"). The owner says who besides them may
// rest - Me, Friends, Party, Guild - from the decorator's bar in their own online home, written to the home's own row on
// the account service; a guest the row names is told so with the room's grants, and rests there as in their own home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { noteDecorGrants, decorMayRest } from '../../../src/systems/decor/decorGrants.js';
import { DECOR_REST_ID } from '../../../src/net/decorLaw.js';
import { toolRig, chipNamed } from '../../decorFakes.mjs';

const settle = () => new Promise((r) => setTimeout(r, 0));
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('REST-GUEST the grants: the room the service said I may rest in, and no other - asked again for another room, nothing until it answers (mutants: RESTGUEST-grant-unread, RESTGUEST-any-room)', async () => {
  let answer = { ok: true, data: { storage: [], station: [], bin: [], rest: true } };
  const homeDecor = { use: async () => answer };
  noteDecorGrants(homeDecor, 5, 6, 'char');
  assert.equal(decorMayRest(5, 6), false, 'nothing until it answers');
  await settle();
  assert.equal(decorMayRest(5, 6), true);
  assert.equal(decorMayRest(5, 7), false, 'another home');
  answer = { ok: true, data: { storage: [], station: [], bin: [] } };
  noteDecorGrants(homeDecor, 5, 7, 'char');
  await settle();
  assert.equal(decorMayRest(5, 6), false, 'left behind with its room');
  assert.equal(decorMayRest(5, 7), false, 'not said');
});

test('REST-GUEST the host: the rest\'s bag stands a guest the service named where an owner\'s bed stands - inside an online home alone - and the grants are asked whatever the room shows, so a home I hid still lets me rest (mutants: RESTGUEST-host-unread, RESTGUEST-grants-after-hidden)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /homeBed: homeBedIsMine\(interiorHome, [^\n]*\|\| \(!!interiorHome && decorMayRest\(Number\(homeTownOf\(b\)\) >>> 0, b\?\.buildingKey\)\)/);
  const asked = m.indexOf('noteDecorGrants(host.homeDecor, Number(homeTownOf(b)) >>> 0');
  const gate = m.indexOf("if (!shown) { interiorCtx?.base?.setHidden([]); return; }");
  assert.ok(asked > 0 && gate > asked, 'asked before the shunned room returns');
});

test('REST-GUEST the owner\'s bar: browsing their own online home a chip says who may rest and a press moves it on - written to the home\'s row at once, put back on a refusal; never in a hall or a house offline (mutants: RESTGUEST-chip-hidden, RESTGUEST-write-wrong, RESTGUEST-refusal-kept)', async () => {
  const sent = [];
  let answer = { ok: true, data: { mode: 'friends' } };
  const homeDecor = { use: async (b) => { sent.push(b); return b.op === 'grants' ? { ok: true, data: { storage: [], station: [], bin: [], use: [] } } : answer; }, hidden: async () => ({ ok: true }) };
  const rig = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 5, buildingKey: 6 }, homeDecor });
  rig.frame();
  rig.doc.body.children.find((c) => c.className === 'dfdecor-open').fire('click');
  rig.frame();
  await settle();
  rig.frame();
  const bar = rig.doc.body.children.find((c) => String(c.className).includes('dfdecor-bar'));
  const chip = chipNamed(bar, 'Who may rest: Me');
  assert.ok(chip && !chip.hidden, 'the chip, its word');
  assert.equal(chip.dataset.dficon, 'bed');
  chip.fire('click');
  await settle();
  const set = sent.find((b) => b.op === 'set');
  assert.deepEqual([set.id, set.kind, set.mode, set.mapId, set.buildingKey], [DECOR_REST_ID, 'rest', 'friends', 5, 6]);
  rig.frame();
  assert.ok(chipNamed(bar, 'Who may rest: Friends'), 'it says what was kept');
  answer = { ok: false, error: 'no-home' };
  chipNamed(bar, 'Who may rest: Friends').fire('click');
  await settle();
  rig.frame();
  assert.ok(chipNamed(bar, 'Who may rest: Friends'), 'refused: as it was');
  for (const room of [{ kind: 'home', where: 'Hall', mapId: 5, buildingKey: 6, hall: true }, { kind: 'house', where: 'Your house' }]) {
    const other = toolRig({ room, homeDecor });
    other.frame();
    other.doc.body.children.find((c) => c.className === 'dfdecor-open').fire('click');
    other.frame();
    const b = other.doc.body.children.find((c) => String(c.className).includes('dfdecor-bar'));
    assert.ok(!chipNamed(b, 'Who may rest: Me') || chipNamed(b, 'Who may rest: Me').hidden, `${room.where}: none`);
  }
});

test('AUDIT FB1029f A5: the rest row\'s id is never a piece\'s - a piece named so is refused, so dropping it cannot take the home\'s rest row with it (mutant: AUDITFB1029F-A5-rest-a-piece)', async () => {
  const { decorPieceOf } = await import('../../../src/net/decorLaw.js');
  const piece = { model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 20 };
  assert.ok(decorPieceOf({ ...piece, id: 'p1' }));
  assert.equal(decorPieceOf({ ...piece, id: DECOR_REST_ID }), null);
});

test('AUDIT FB1029f C7 by source: the rest chip\'s answer is its own room\'s - an answer landing after the owner opened another home\'s decorator leaves that one\'s chip - and a press on a chest while the row is written is not dropped (mutants: AUDITFB1029F-C7-any-room, AUDITFB1029F-C7-busy-held)', () => {
  const tool = src('src/scenes/decor/decorTool.js');
  const rest = tool.slice(tool.indexOf('  async function cycleRest() {'), tool.indexOf('  function holdDecorEscape() {'));
  assert.match(rest, /const here = \(\) => \{ const n = deps\.room\?\.\(\); return !!n && n\.mapId === r\.mapId && n\.buildingKey === r\.buildingKey; \};/);
  assert.match(rest, /useBusy = false;[^\n]*\n\s*const res = await deps\.homeDecor\.use\(/);
  assert.match(rest, /if \(!here\(\)\) return !!res\?\.ok;/);
});
