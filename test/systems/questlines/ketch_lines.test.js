// AUDIT KETCH L5 (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 13): THE SKY-KETCH LINE'S WORDS AND PAY, run on
// the real bridge. A book handed with a letter or with the pay is `get item`, never `give pc` - a give is a quest's pay
// (systems/questlines/qlLayer.js reward): QLSK01's courier showed "Imrah counts _gold_ gold into your hand" at the letter
// and marked the step paid, QLSK02's table showed its pay box twice (L5-2). The Ketch keeps the real week, never the
// online calendar's Loredas, so no line names a day of Tamriel's week, and the screens' lines name the real one (L5-3).
// QLSK02 asks a cell each hand of a crew of eight can bank (L5-4). The lore promises nothing the game does not do and
// contradicts neither itself nor the canon (L5-7, L5-8). tools/mutants/ketch_lines.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { QUESTLINES_PREF, questlinesOn } from '../../../src/systems/questlines/qlLaw.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { questSource, loadTables } from '../../qlSources.mjs';

/** A step of the line on the real bridge, Imrah placed: its boxes as shown, the pack, the rewards offered. */
function stepOnBridge(name) {
  loadTables();
  setPref(QUESTLINES_PREF, true);
  const st = { s: 400 * 86400 + 12 * 3600, pack: [], rewards: [] };
  const bridge = createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => questSource(n, questlinesOn()) },
    classicSeconds: () => st.s, skySeconds: () => st.s, worldSeconds: () => st.s, isPlayerInTown: () => true, questlineService: null,
    playerEntity: { name: 'Hero', level: 20, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
    showChoice: () => {}, giveItemToPlayer: (item) => st.pack.push(item), carriesQuestItem: (r) => st.pack.includes(r?.daggerfallUnityItem),
    offerReward: (_q, item) => st.rewards.push(item), onQuestlineOffer: () => {},
    onQuestStarted: (q) => { for (const task of q.tasks.values()) for (const a of task.actions) if ((a.constructor?.typeName ?? a.typeName) === 'PlaceNpc') a.isComplete = true; },
  });
  const quest = bridge.machine.startQuestByName(name);
  const shown = [];
  const orig = quest.showMessagePopup.bind(quest);
  quest.showMessagePopup = (id, ...r) => { shown.push(id); return orig(id, ...r); };
  const tick = (n = 1) => { for (let i = 0; i < n; i++) bridge.machine.tick(); };
  const click = () => { for (const r of quest.resources.values()) if (r.isPerson && r.symbol?.name === 'imrah') r.setPlayerClicked(); };
  const item = (sym) => [...quest.resources.values()].find((r) => r.symbol?.name === sym)?.daggerfallUnityItem ?? null;
  const courier = () => { tick(2); for (let h = 0; h < 6; h++) { st.s += 3600; tick(300); } };
  return { bridge, quest, st, tick, click, item, shown, courier };
}

test('KETCH QLSK01\'S BOOK COMES WITH ITS LETTER, NEVER AS PAY: the courier shows the porter\'s box alone - no QuestComplete box, the step unpaid and unsettled - and the letter and the book are both in the pack; at her table the pay box once (AUDIT KETCH L5-2; mutants: the book given as pay)', () => {
  const S = stepOnBridge('QLSK01');
  S.courier();
  assert.deepEqual(S.shown, [1012], 'the porter alone');
  assert.equal(S.quest.questSuccess, false, 'nothing settled at the letter');
  assert.ok(!S.quest.ql?.paid, 'nothing paid at the letter');
  assert.equal(S.st.rewards.length, 0, 'no reward window');
  assert.ok(S.st.pack.includes(S.item('letter')) && S.st.pack.includes(S.item('guide')), 'the letter and her book in the pack');
  S.shown.length = 0;
  S.bridge.questlines.act('ketch-boarded', 1); S.tick(4); S.click(); S.tick(6);
  assert.deepEqual(S.shown.filter((id) => id === 1004), [1004], 'the pay box once');
  assert.ok(S.shown.includes(1013) && S.quest.questComplete, 'her table, and the step done');
});

test('KETCH QLSK02 ASKS ONE CELL AND PAYS ONCE: one cell of mine set settles the step; at her table her other book is handed over and the pay box shows once (AUDIT KETCH L5-2, L5-4; mutants: the book given as pay; three cells asked)', () => {
  const S = stepOnBridge('QLSK02');
  S.courier();
  S.shown.length = 0;
  S.bridge.questlines.act('ketch-cell-banked', 1); S.tick(4); S.click(); S.tick(6);
  assert.ok(S.shown.includes(1020), 'one cell set the step');
  assert.deepEqual(S.shown.filter((id) => id === 1004), [1004], 'the pay box once');
  assert.ok(S.st.pack.includes(S.item('thunder')), 'her other book in the pack');
  assert.ok(S.quest.questComplete);
});

test('KETCH A CELL EACH HAND OF EIGHT CAN BANK: QLSK02\'s count, every hand of a full crew\'s, within what one voyage that fells the Warden banks - the engine\'s appetite for eight and the four resonators its ward asks (AUDIT KETCH L5-4; mutants: three cells asked)', async () => {
  const { engineNeeds, KT_RESONATORS } = await import('../../../src/net/ketch/ketchDeck.js');
  const { KT_CREW_MAX } = await import('../../../src/net/ketch/ketchLaw.js');
  const src = readFileSync(new URL('../../../src/systems/questlines/quests/QLSK02.txt', import.meta.url), 'utf8');
  const n = Number(/ql act ketch-cell-banked (\d+)/.exec(src)?.[1]);
  const sheet = JSON.parse(readFileSync(new URL('../../../src/systems/questlines/sheets/questlines.json', import.meta.url), 'utf8'));
  const row = JSON.stringify(sheet).match(/"quest":"QLSK02".*?"done":\{"act":"ketch-cell-banked","n":(\d+)\}/);
  assert.equal(Number(row?.[1]), n, 'the sheet asks what the script waits on');
  assert.ok(n >= 1 && n * KT_CREW_MAX <= engineNeeds(KT_CREW_MAX) + KT_RESONATORS.length, `${n} a hand, ${KT_CREW_MAX} hands`);
  assert.doesNotMatch(src, /engine's sockets/, 'a resonator\'s bank counts too: the words say so');
});

test('KETCH NO LINE NAMES LOREDAS: the Ketch keeps the real week - the four steps, both books and every line of the screens name no day of Tamriel\'s week; the screens\' lines name the real Saturday, in UTC (AUDIT KETCH L5-3; mutants: "She comes again on Loredas")', async () => {
  const { KT_WORDS, KT_REFUSE_WORDS } = await import('../../../src/systems/ketch/ketchWords.js');
  const { PORT_BOOKS, KETCH_BOOK_ID, ROURKEN_THUNDER_ID } = await import('../../../src/systems/portBooks.js');
  const { lineById } = await import('../../../src/systems/questlines/qlLines.js');
  const days = /Morndas|Tirdas|Middas|Turdas|Fredas|Loredas|Sundas/;
  for (const q of ['QLSK01', 'QLSK02', 'QLSK03', 'QLSK04']) assert.doesNotMatch(readFileSync(new URL(`../../../src/systems/questlines/quests/${q}.txt`, import.meta.url), 'utf8').replace(/^--.*$/gm, ''), days, q);
  for (const id of [KETCH_BOOK_ID, ROURKEN_THUNDER_ID]) assert.doesNotMatch(PORT_BOOKS.get(id).pages.flat().map((r) => (typeof r === 'string' ? r : r.text)).join(' '), days, `book ${id}`);
  for (const w of [KT_WORDS.departed, KT_REFUSE_WORDS.away]) assert.match(w, /every ten hours/);   // PIN MOVED (KETCH-EVERY): she comes every ten hours, no longer on the real Saturday
  assert.match(lineById('skyKetch').lead(), /Every ten hours/);
  const tut = readFileSync(new URL('../../../src/systems/tutorialCatalogue.js', import.meta.url), 'utf8');
  for (const m of tut.matchAll(/t\('tutorials\.skyKetch\.[a-z0-9]+', '((?:[^'\\]|\\.)*)'\)/g)) assert.doesNotMatch(m[1], days, 'the tutorial');
});

test('KETCH THE LORE KEEPS ITS WORD: no gun\'s story promises constructs that lower their arms, the Sovereign\'s pistolet keeps no powder, the Echo is the Warden\'s, the charm\'s hum and the hammer\'s metal are no promise, Ysolde wrote the book on the Doors, and the Brass God pulled her once before (AUDIT KETCH L5-7, L5-8; mutants: the Word\'s constructs lowering their arms)', async () => {
  const { KETCHMASTERS_WORD, VOLENDRUNGS_ECHO, SOVEREIGN_PISTOLET_ERA } = await import('../../../src/systems/gilded.js');
  const { PORT_BOOKS, KETCH_BOOK_ID } = await import('../../../src/systems/portBooks.js');
  const book = PORT_BOOKS.get(KETCH_BOOK_ID).pages.flat().map((r) => (typeof r === 'string' ? r : r.text)).join(' ');
  for (const s of [KETCHMASTERS_WORD.lore, book]) assert.doesNotMatch(s, /lower their arms/);
  assert.doesNotMatch(SOVEREIGN_PISTOLET_ERA.lore, /powder/, 'a Dwemer gun holds no powder (GUN-LORE)');
  assert.match(VOLENDRUNGS_ECHO.lore, /steersman/, 'the Warden\'s, as the book and its drop say');
  assert.match(book, /Warden\\?'s own long gun is gilded/);
  const q4 = readFileSync(new URL('../../../src/systems/questlines/quests/QLSK04.txt', import.meta.url), 'utf8').replace(/^--.*$/gm, '');
  assert.doesNotMatch(q4, /hums when/, 'the charm is a plain amulet');
  assert.doesNotMatch(q4, /hammer of Dwemer brass/, 'its metal is the roll\'s');
  assert.doesNotMatch(q4, /She closed the Burning Doors/, 'the player closed them');
  assert.doesNotMatch(q4, /three thousand years there was nothing/, 'the Brass God walked five hundred years before');
});

test('KETCH A FALL IS CAUGHT, NEVER A WAKING: the nets\' line says they haul you back aboard - wherever the fall was, the bridge\'s ring or the Sailwalk - and the tutorial says only death wakes you in the fields (AUDIT KETCH L5-5; mutants: the fall said to wake you below)', async () => {
  const { KT_WORDS } = await import('../../../src/systems/ketch/ketchWords.js');
  assert.match(KT_WORDS.castBack, /back aboard/);
  assert.doesNotMatch(KT_WORDS.castBack, /last top/, 'a fall off the bridge\'s ring lands on its core, not a top');
  const tut = readFileSync(new URL('../../../src/systems/tutorialCatalogue.js', import.meta.url), 'utf8');
  const body2 = /t\('tutorials\.skyKetch\.body2', '((?:[^'\\]|\\.)*)'\)/.exec(tut)?.[1] ?? '';
  assert.doesNotMatch(body2, /A fall from her decks wakes you/);
  assert.match(body2, /only death wakes you/);
});

test('KETCH ONE WORD A THING IN EVERY LANGUAGE: Chinese names the crew\'s leader apart from the Ketchmaster (船长 / 船長 is his), and German counts the voyages sailed in one phrase on the card and the profile (AUDIT KETCH L5-12; mutants: the leader called the Ketchmaster)', () => {
  const row = (lang, key) => { const m = new RegExp(`^${key.replace(/\./g, '\\.')},"(.*)"$`, 'm').exec(readFileSync(new URL(`../../../locales/${lang}/Port_Strings.csv`, import.meta.url), 'utf8')); return m?.[1] ?? null; };
  for (const [lang, master] of [['zh-Hans', '船长'], ['zh-Hant', '船長']]) {
    assert.ok(row(lang, 'ketch.client.chest').includes(master), `${lang}: the Ketchmaster is ${master}`);
    assert.ok(!row(lang, 'ketch.refuse.crew').includes(master), `${lang}: the crew's leader is not`);
  }
  assert.equal(row('de', 'account.card.voyages'), row('de', 'ketch.card.profile').split(':')[0], 'one phrase for the count');
});
