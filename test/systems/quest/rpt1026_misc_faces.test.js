// RPT1026-MISC FACE-ORPHAN (a private report: three escort portraits stood on the HUD, and neither finishing nor abandoning
// quests cleared them). The escort faces (ui/hud/hudEscortFaces.js, DFU's
// HUDEscortingNPCFaces) leave by DropFace or by the quest-end sweep, nothing else - so a face whose quest left the machine
// without ending stood for good, with no quest left to end it. The producer here is the load's own: a quest the machine
// cannot restore is skipped with DFU's warning (machine.js restoreSaveData, "This is expected after removing a mod with
// custom quest actions") while the faces envelope is restored whole beside it (save.js restoreSessionState). Driven
// through the real bridge (questBridge.js, which wires the panel to its machine), the real machine's save and load, and
// the real panel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  initEscortFaces, addEscortFace, clearEscortFaces, getEscortFacesSaveData, restoreEscortFacesSaveData, _escortFaces,
  drawEscortFaces, setEscortQuestAway, setEscortQuestGone,
} from '../../../src/ui/hud/hudEscortFaces.js';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';

console.warn = () => {};
const read = (p) => readFileSync(p, 'utf8');
const tables = new URL('../../../vendor/dfu-quests/Tables/', import.meta.url);
loadQuestTables(Object.fromEntries(readdirSync(tables).filter((f) => f.endsWith('.txt'))
  .map((f) => [f.replace('.txt', ''), read(new URL(f, tables)).replace(/^﻿/, '')])));

test('RPT1026-MISC FACE-ORPHAN: a face whose quest a load could not restore is never drawn and leaves with the next save; a face of a quest that stands stays (mutants: rpt1026-misc-face-gone-drawn, rpt1026-misc-face-gone-saved, rpt1026-misc-face-gone-unwired)', async () => {
  const bridge = createQuestBridge({ data: { readListTable: () => null, getQuestSourceLines: () => null } });
  const m = bridge.machine;
  const lines = (name) => [`Quest: ${name}`, 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Clock _c_ 2.00:00', '', ' start timer _c_'];
  const lost = m.scheduleQuest(lines('__RFA'));
  const kept = m.scheduleQuest(lines('__RFB'));
  m.tick(); m.tick();
  initEscortFaces({ fetchBytes: async () => new Uint8Array(64 * 64), palette: null, renderer: { uploadTexture: (kind, key) => key }, getFactionData: () => ({ face: 0 }) });
  const fixed = (quest, symbol) => ({ parentQuest: quest, symbol: { original: symbol }, isIndividualNPC: true, factionData: { id: 100 }, race: 0, gender: 0, faceIndex: 0 });
  addEscortFace(fixed(lost, '_prisoner_'));
  addEscortFace(fixed(kept, '_pilgrim_'));
  await new Promise((resolve) => setTimeout(resolve, 0));   // the art lands
  const drawn = () => {
    const quads = [];
    drawEscortFaces({ drawScreenQuad: (tex, at) => quads.push(at.y) }, { width: 320, height: 200 });
    return quads;
  };
  assert.deepEqual(drawn(), [36, 86], 'both escorts\' faces stand');
  // the save, then the load - one quest's script no longer restores (a removed mod's action, DFU's own arm)
  const quests = JSON.parse(JSON.stringify(m.getSaveData()));
  const faces = getEscortFacesSaveData();
  const broken = quests.quests.find((q) => q.uid === lost.uid);
  for (const t of broken.tasks ?? []) for (const a of t.actions ?? []) a.type = 'RemovedModAction';
  m.clearState();
  m.restoreSaveData(quests);
  restoreEscortFacesSaveData(faces);
  assert.equal(m.getQuest(lost.uid), null, 'the machine skipped the quest it could not restore');
  assert.ok(m.getQuest(kept.uid), 'and restored the other');
  assert.equal(_escortFaces().length, 2, 'the faces envelope came back whole');
  assert.deepEqual(drawn(), [36], 'the orphan is not drawn - the standing escort closes up to the top');
  assert.deepEqual(getEscortFacesSaveData().map((f) => f.targetPerson), ['_pilgrim_'], 'and the next save leaves it out');
  setEscortQuestAway(null);
  setEscortQuestGone(null);
  clearEscortFaces();
});
