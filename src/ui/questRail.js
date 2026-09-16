// MAC-K2 - THE QUEST RAIL, ONE HOME.
//
// Mac, 2026-09-15: "Logbook not reflecting quests."
//
// It was not. The L key (`LogBook`) opens the CHRONICLE, and the
// chronicle had three sections - Notes, Messages, History - none of
// which is a quest. `chronicleDoor.js` was handed `questMessages` by
// all four hosts and `chronicleModel` never read it: the dep went in
// and nothing came out. The player's quests existed only on the pause
// window's Quests tab, which is a different key and a different
// window, and the one door named after the job showed the notebook
// instead.
//
// THE FIX IS NOT A SECOND WALK. The pause window (`ui/enhancedMenu.js`
// pauseQuests) already turns the machine's `{active, finished}` log
// into rows, and copying that walk into the chronicle would be two
// laws the day one of them moves - the thing HARD2c exists to stop.
// So the WALK lives here and both faces import it; what differs is
// the drawing, which is legitimately per-face (the pause window is a
// two-pane journal, the chronicle is a list of entries), and what does
// not differ is which quests, which entries and in what order.
//
// It also cannot live in `enhancedMenu.js`: that module is the whole
// pause menu and both are LAZY CHUNKS (ui/enhancedChunk.js). Importing
// it from the chronicle would pull the pause menu into the chronicle's
// chunk for four functions.

/** The token formattings that carry a printable line - questJournal's
 *  own counted set (`LINE_FORMATTINGS`). */
export const JOURNAL_LINE_FORMATTINGS = new Set(['text', 'newline', 'highlight', 'question', 'answer']);

/** One flattener for every journal source: message object or raw
 *  token array in, text lines out. */
export function journalLines(msgOrTokens) {
  const tokens = Array.isArray(msgOrTokens) ? msgOrTokens : (msgOrTokens?.getTextTokens?.() ?? []);
  return tokens.filter((t) => JOURNAL_LINE_FORMATTINGS.has(t?.formatting)).map((t) => String(t?.text ?? ''));
}

// PX22: a quest is FILED under its kind, not TITLED by it. The kind
// and the noun may be joined, spaced or hyphenated; the LABEL still
// needs its own trailing separator, which is what keeps "Main Quest
// Backbone" a name.
const QUEST_KIND_LABEL = /^\s*(?:the\s+)?(?:main|side|guild|daedric|faction|misc(?:ellaneous)?|holiday|class|racial)[\s\-–]*(?:quest|quests|questline|storyline|story)\s*[:–—|\-•]\s*/i;

/** The display name with any "Main Quest:" style label cut off. */
export function questTitleOf(name) {
  const raw = String(name ?? '').trim();
  const cut = raw.replace(QUEST_KIND_LABEL, '').trim();
  return cut || raw;
}

/** The main quest is S0000* plus _BRISIEN, by its QUEST NAME - never
 *  by its display name, which a quest may spell however it likes. */
export const isMainQuest = (questName) => /^S0000/.test(questName ?? '') || questName === '_BRISIEN';

/** One filed (finished) notebook entry, parsed back into its parts.
 *  The notebook keeps only a header line and the log it filed, so the
 *  kind is gone by then - which is why the archive is not split. */
export function parseFinished(entry, index) {
  const head = entry?.[0];
  const header = head?.formatting === 'highlight' ? String(head.text ?? '') : null;
  const m = header ? /^(.*?) (completed|ended) at (.*?):?$/.exec(header) : null;
  return {
    key: `f:${index}`,
    name: m ? m[1] : (header ?? 'Quest record'),
    success: m ? m[2] === 'completed' : null,
    when: m ? m[3] : null,
    lines: journalLines(header ? entry.slice(1) : entry).filter((l, i, a) => l !== '' || a[i - 1] !== ''),
  };
}

/**
 * THE WALK. `{active, finished}` off a host's `questLog()` in, the two
 * lists every face draws out.
 *
 * An active quest with no entries is DROPPED, and that is the machine's
 * own law rather than a tidy-up: `Quest.getLogMessages` returns null
 * once a quest completes and empty until its first `log` action runs,
 * so a quest that has written nothing has nothing to say yet.
 */
export function questRail(log) {
  const active = (log?.active ?? []).map((q, i) => ({
    key: `a:${q.id ?? i}`,
    name: q.name || `Quest ${i + 1}`,
    questName: q.questName ?? '',
    main: isMainQuest(q.questName),
    clockSeconds: Number.isFinite(q.clockSeconds) ? q.clockSeconds : null,
    entries: (q.messages ?? []).map(journalLines).filter((ls) => ls.length),
  })).filter((q) => q.entries.length);
  const finished = (log?.finished ?? []).map(parseFinished).filter((q) => q.lines.length || q.name);
  return { active, finished };
}
