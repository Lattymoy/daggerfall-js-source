// QUEST-AUDIT IV (bible/01-Overview/audits/Quest-Audit-IV.md): ONE QUESTLINE STEP ON THE REAL QUEST BRIDGE - the pack's own
// source, the player's pack (a quest item given is carried), the town and the sky's hour the host's - with the moves a
// pin needs: a clock advanced, a Person clicked, an act said, an answer given. ql12_lines.test.js stepOnBridge's shape,
// widened; the world's own part (an NPC or foe stood at a place) is done by hand.
import { createQuestBridge } from '../src/scenes/quest/questBridge.js';
import { questSource, loadTables } from './qlSources.mjs';
import { questlinesOn, QUESTLINES_PREF } from '../src/systems/questlines/qlLaw.js';
import { setPref } from '../src/systems/uiPrefs.js';

const bare = (s) => String(s).replace(/^_+|_+$/g, '');

/** `name` started on a fresh bridge with the questlines on (`on`). */
export function stepRig(name, { level = 20, entity = null, on = true } = {}) {
  loadTables();
  setPref(QUESTLINES_PREF, on);
  const st = { s: 400 * 86400 + 12 * 3600, pack: new Set(), asked: [], offers: [], popups: [] };
  const typeOf = (a) => a.constructor?.typeName ?? a.typeName;
  const bridge = createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => questSource(n, questlinesOn()) },
    classicSeconds: () => st.s, skySeconds: () => st.s, worldSeconds: () => st.s, isPlayerInTown: () => true, questlineService: null,
    playerEntity: entity ?? { name: 'Hero', level, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
    showChoice: (_q, message, choices, respond) => st.asked.push({ message, choices, respond }),
    giveItemToPlayer: (item) => st.pack.add(item),
    removeItemFromPlayer: (item) => st.pack.delete(item),
    carriesQuestItem: (res) => !!res && [...st.pack].some((it) => it.questItem && it.questUID === res.parentQuest?.uid && it.questSymbol?.name === res.symbol?.name),
    offerReward: () => {},
    onQuestlineOffer: (o) => st.offers.push(o),
    showPopup: (_q, tokens) => st.popups.push((tokens ?? []).map((x) => x.text).join(' ').replace(/\s+/g, ' ').trim()),
    onQuestStarted: (q) => { for (const task of q.tasks.values()) for (const a of task.actions) if (typeOf(a) === 'PlaceNpc' || typeOf(a) === 'PlaceFoe') a.isComplete = true; },
  });
  const warn = console.warn;
  console.warn = () => {};
  let quest;
  try { quest = bridge.machine.startQuestByName(name); } finally { console.warn = warn; }
  const R = {
    bridge, st, quest,
    tick(n = 1) { const w = console.warn; console.warn = () => {}; try { for (let i = 0; i < n; i++) { bridge.machine.tick(); bridge.questlines.look(); } } finally { console.warn = w; } },
    advance(sec, ticks = 4) { st.s += sec; R.tick(ticks); },
    click(sym) { for (const r of quest.resources.values()) if (r.isPerson && r.symbol?.name === bare(sym)) { r.setPlayerClicked(); return; } throw new Error(`no person ${sym}`); },
    act: (kind, n = 1) => bridge.questlines.act(kind, n),
    answer: (i) => st.asked.at(-1).respond(i),
    set: (sym) => !!quest.getTask({ name: bare(sym) })?.getTriggerValue?.(),
    log: () => [...quest.activeLogMessages.values()].map((l) => [l.stepID, l.messageID]).sort((a, b) => a[0] - b[0]),
  };
  return R;
}
