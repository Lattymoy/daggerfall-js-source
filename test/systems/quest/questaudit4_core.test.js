// QUEST-AUDIT IV (2026-10-30, bible/01-Overview/audits/Quest-Audit-IV.md): THE MACHINE'S SAVE. CORE-1: an Item's
// declared name rode no envelope, so after a load, a reclaim or a share a questline's letter read as its pay - the step
// marked paid, the outcome's gold factor lost. CORE-2: a load inside EndQuest's grace re-entered the whole of it, one tick
// of tasks the game never runs. CORE-4: a reclaim, a receipt and a resync named a translated quest in English. Where
// ARENA2_PATH names the freeware, the real bridge on its world (qa4Bridge.mjs). Mutants: tools/mutants/questaudit4_core.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { packMachine, loadTables } from '../../qlSources.mjs';
import { Item } from '../../../src/systems/quest/item.js';
import { PAY_PROFILES } from '../../../src/systems/questlines/qlRewards.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'WOODS.WLD', 'FACTION.TXT', 'TEXT.RSC', 'TAMRIEL2.IMG'].every((f) => existsSync(join(ARENA2, f)));
const SKIP = HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
const rig = HAVE ? await import('./qa4Bridge.mjs') : null;

test('QUEST-AUDIT IV CORE-1 an Item\'s declared name rides its envelope, and an older envelope\'s letter is known by the items table\'s mint - another item is no letter (mutants: the name unsaved; unread; the older letter unread)', () => {
  loadTables();
  const m = packMachine();
  // `parchment` is no letter: another of class 9's templates (Quests-Items.txt), the letter's own group
  const quest = m.parseQuestForLists(['Quest: __QA4ITEM', 'QRC:', '', 'QBN:', 'Item _letter_ letter', 'Item _gem_ gem', 'Item _note_ item class 9 subclass 4', ''], 0, { headless: true });
  const letter = quest.resources.get('letter'), gem = quest.resources.get('gem'), note = quest.resources.get('note');
  assert.equal(note.daggerfallUnityItem.group, letter.daggerfallUnityItem.group, 'the fixture: the letter\'s own group');
  assert.equal(letter.itemName, 'letter');
  const back = (r, edit = (d) => d) => { const it = new Item(quest); it.restoreSaveData(edit(structuredClone(r.getSaveData()))); return it.itemName; };
  assert.equal(back(letter), 'letter', 'saved and restored');
  assert.equal(back(gem), 'gem');
  const older = (d) => { delete d.itemName; return d; };
  assert.equal(back(letter, older), 'letter', 'an older envelope\'s letter, by its mint');
  assert.equal(back(gem, older), '', 'another item is no letter');
  assert.equal(back(note, older), '', 'nor another of its group');
});

test('QUEST-AUDIT IV CORE-1 QLBD02 saved and loaded, or set aside and taken up again, before its courier: the letter is no pay, and the greater ending pays the script\'s gold x1.25 as an unbroken run does (mutant: the name unsaved)', { skip: SKIP, timeout: 600_000 }, async () => {
  const w = await rig.world();
  const at = rig.locationOf(w, 'Daggerfall', 'Daggerfall');
  const run = ({ load = false, reclaim = false } = {}) => {
    const A = rig.quiet(() => rig.makeBridge(w, at));
    A.machine.setLastNPCClicked({ hash: 11, mapID: at.location.mapTableData.mapId, nameSeed: 7, buildingKey: 0, factionID: 0, gender: 0 });
    let q = rig.quiet(() => A.machine.startQuestByName('QLBD02'));
    rig.quiet(() => { for (let i = 0; i < 3; i++) A.machine.tick(); });
    let X = A;
    if (load) {
      const snap = JSON.parse(JSON.stringify(rig.quiet(() => A.bridge.snapshot())));
      X = rig.quiet(() => rig.makeBridge(w, at));
      X.st.s = A.st.s;
      rig.quiet(() => X.bridge.restore(snap));
      q = X.machine.getQuest(q.uid);
    }
    if (reclaim) {
      assert.equal(X.machine.shelveQuest(q.uid).ok, true);
      X.st.s += 3600;
      assert.equal(X.machine.reclaimQuest(q.uid).ok, true);
    }
    X.st.s += 4 * 3600;   // the courier's clock runs out, by day in town
    rig.quiet(() => { for (let i = 0; i < 700; i++) X.machine.tick(); });
    const paidAtLetter = q.ql.paid;
    const gold = q.resources.get('gold').daggerfallUnityItem.stackCount;
    q.getTask({ name: 'readit' }).start();   // the book read, then handed to Ysolde: `read`, the greater pay
    q.getTask({ name: 'handed' }).start();
    rig.quiet(() => { for (let i = 0; i < 6; i++) X.machine.tick(); });
    const reward = X.st.rewards.find((r) => r?.stackCount != null)?.stackCount ?? null;
    return { paidAtLetter, gold, reward, outcome: q.ql.outcome };
  };
  for (const way of [{}, { load: true }, { reclaim: true }]) {
    const r = run(way);
    assert.equal(r.paidAtLetter, false, `${JSON.stringify(way)}: the letter is no pay`);
    assert.equal(r.outcome, 'read');
    assert.equal(r.reward, Math.max(1, Math.round(r.gold * PAY_PROFILES.greater.gold)), `${JSON.stringify(way)}: the greater ending's gold`);   // qlRewards.js scaleGold
  }
});

test('QUEST-AUDIT IV CORE-2 N0B21Y14 saved in its end\'s last tick of grace completes on the next tick after the load, its other ending (_S.06_) never run (mutants: the grace unsaved; re-armed whole)', { skip: SKIP, timeout: 600_000 }, async () => {
  const w = await rig.world();
  const at = rig.locationOf(w, 'Daggerfall', 'Daggerfall');
  const A = rig.quiet(() => rig.makeBridge(w, at));
  A.machine.setLastNPCClicked({ hash: 11, mapID: at.location.mapTableData.mapId, nameSeed: 7, buildingKey: 0, factionID: 0, gender: 0 });
  const q = rig.quiet(() => A.machine.startQuestByName('N0B21Y14'));
  const tick = (X) => rig.quiet(() => X.machine.tick());
  for (let i = 0; i < 3; i++) tick(A);
  A.st.s += 3600;
  for (let i = 0; i < 3; i++) tick(A);
  for (const r of q.resources.values()) if ((r.isPerson || r.isItem) && r.setPlayerClicked) r.setPlayerClicked();
  for (let i = 1; i <= 5; i++) { tick(A); if (i === 2) A.st.s += 6 * 3600; }
  assert.equal(q.ticksToEnd, 1, 'saved in the grace\'s last tick');
  const B = rig.quiet(() => rig.makeBridge(w, at));
  B.st.s = A.st.s;
  rig.quiet(() => B.bridge.restore(JSON.parse(JSON.stringify(rig.quiet(() => A.bridge.snapshot())))));
  const qb = B.machine.getQuest(q.uid);
  assert.equal(qb.ticksToEnd, 1, 'the grace it had left');
  tick(B);
  assert.equal(qb.questComplete, true, 'ends on the next tick');
  for (let i = 0; i < 3; i++) tick(B);
  assert.equal(qb.getTask({ name: 'S.06' }).triggered, false, 'the other ending never ran');
  assert.equal(B.st.gold + B.st.rewards.filter((r) => r?.stackCount != null).length, 0, 'nothing paid');
});

test('QUEST-AUDIT IV CORE-4 a quest begun in French keeps its French title through a reclaim, a receipt and a load, its envelope holding its own name (mutant: a reclaim\'s restore unnamed)', { skip: SKIP, timeout: 600_000 }, async () => {
  const tm = await import('../../../src/systems/textManager.js');
  const { QUEST_DOCUMENT } = await import('../../../src/systems/quest/localizedQuest.js');
  const w = await rig.world();
  const at = rig.locationOf(w, 'Daggerfall', 'Daggerfall');
  tm._resetTextManagerForTests();
  tm.setLocaleDocuments('fr', [[`${QUEST_DOCUMENT}:M0B00Y07`, ['Quest: M0B00Y07', 'DisplayName: Le Grizzly', 'QRC:', '', 'QuestorOffer:  [1000]', 'Un ours terrorise la region.', ''].join('\n')]]);
  tm.setLocale('fr');
  try {
    const A = rig.quiet(() => rig.makeBridge(w, at));
    A.machine.setLastNPCClicked({ hash: 11, mapID: at.location.mapTableData.mapId, nameSeed: 7, buildingKey: 0, factionID: 0, gender: 0 });
    const q = rig.quiet(() => A.machine.startQuestByName('M0B00Y07'));
    rig.quiet(() => { for (let i = 0; i < 3; i++) A.machine.tick(); });
    assert.equal(q.displayName, 'Le Grizzly');
    assert.equal(A.machine.shelveQuest(q.uid).ok, true);
    A.st.s += 60;
    assert.equal(A.machine.reclaimQuest(q.uid).ok, true);
    assert.equal(q.displayName, 'Le Grizzly', 'taken up again');
    const env = A.machine.getShareableQuestData(q.uid);
    assert.notEqual(env.displayName, 'Le Grizzly', 'the envelope holds its own name');
    const C = rig.quiet(() => rig.makeBridge(w, at));
    C.st.s = A.st.s;
    assert.equal(rig.quiet(() => C.machine.receiveSharedQuest(env))?.displayName, 'Le Grizzly', 'a partner\'s copy');
  } finally {
    tm._resetTextManagerForTests();
  }
});
