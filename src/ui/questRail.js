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

import { isMainQuestName as isMainQuest } from '../systems/quest/questLists.js';   // AUDIT 68 S31-questshare-mainquest-dup: the share gates' own predicate, one home
import { dayNames, monthNames } from '../systems/gameDate.js';   // GUIDE3: the date header an entry opens with
import { localizedText } from '../systems/textManager.js';   // L10N3d: and the format it is written in

/** The token formattings that carry a printable line - questJournal's
 *  own counted set (`LINE_FORMATTINGS`). */
export const JOURNAL_LINE_FORMATTINGS = new Set(['text', 'newline', 'highlight', 'question', 'answer']);

/** One flattener for every journal source: message object or raw
 *  token array in, text lines out. */
export function journalLines(msgOrTokens) {
  const tokens = Array.isArray(msgOrTokens) ? msgOrTokens : (msgOrTokens?.getTextTokens?.() ?? []);
  return tokens.filter((t) => JOURNAL_LINE_FORMATTINGS.has(t?.formatting)).map((t) => String(t?.text ?? ''));
}

/** GUIDE3: the date header a log entry opens with - DFU's corpus writes
 *  `%qdt:` on an entry's first line, and %qdt is DateString
 *  (systems/gameDate.js dateString: "Sundas the 1st of Morning Star"),
 *  built here from the same two name tables so the header cannot be
 *  mistaken for a sentence and a sentence cannot be taken for it. */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** L10N3d: the header is written in the language of the moment (dateString reads dateFormatString and the name lists
 *  through the text core), so it is read off that language's own format and names - built when asked, never frozen
 *  at module load, and kept while they stand. English builds exactly "<day> the <n><st|nd|rd|th> of <month>". */
let _dateHeader = null, _dateHeaderOf = null;
function dateHeaderRe() {
  const fmt = localizedText('dateFormatString', '{0} the {1}{2} of {3:00}');
  const days = dayNames(), months = monthNames();
  const of = [fmt, ...days, ...months].join('\u0000');
  if (of !== _dateHeaderOf) {
    const arms = [`(?:${days.map(escapeRe).join('|')})`, '\\d{1,2}', '(?:st|nd|rd|th)', `(?:${months.map(escapeRe).join('|')})`];
    const body = fmt.split(/(\{\d+(?::0+)?\})/).map((p) => {
      const m = /^\{(\d+)(?::0+)?\}$/.exec(p);
      return m ? (arms[Number(m[1])] ?? '.*?') : escapeRe(p);
    }).join('');
    _dateHeader = new RegExp(`^\\s*${body}:?\\s*$`);
    _dateHeaderOf = of;
  }
  return _dateHeader;
}
const DATE_HEADER = { test: (line) => dateHeaderRe().test(line) };

/** A cut never ends on one of these: an article, a preposition, a conjunction or a possessive says nothing before an
 *  ellipsis. */
const TRAILING_SMALL_WORD = /\s+(?:a|an|the|of|to|in|on|at|for|and|or|but|with|by|from|as|his|her|its|their|my|your)$/i;

/** AUDIT GUIDE W4: a sentence's end - its stops, any closing quote or bracket after them, then a space and a capital
 *  in any script (an opening quote or bracket before it allowed), or the text's own end. */
const SENTENCE_END = /[.!?]+["'\u201d\u2019)\]]*(?=\s+["'\u201c\u2018(\[]*\p{Lu}|$)/gu;
/** ...and a full stop that ends no sentence: a title's abbreviation, or an initial. */
const NOT_AN_END = /(?:^|\s)(?:St|Mr|Mrs|Ms|Dr|Mt|Sr|Jr|Lt|Sgt|Capt|Gen|Col|Prof|Rev|\p{Lu})\.$/u;

/** The cap on an opening, in characters: three short lines of a notice.
 *  Of the corpus's 408 logged entries it cuts 56 (100 cut 159: a
 *  Daggerfall journal's first sentence is long - test/guide3_herald.test.js
 *  pins the count). */
export const OPENING_MAX = 140;

/**
 * GUIDE3: AN ENTRY'S OPENING - what a face can say of a journal entry in
 * one breath (the herald's notice; GUIDE4's tracker reads the same
 * words). Here, beside journalLines, and not in the lens: the HUD draws
 * the herald, and a face the HUD imports must not pull the quest machine
 * into the HUD's import graph (the cycle place.js -> ... -> save.js ->
 * hud.js that GUIDE3 met on its first full run - test/guide3_herald.test.js
 * walks the graph). The lines are the quest author's own, hard-wrapped for a 1996
 * logbook under a date header: the opening drops the header, joins the
 * wrap, keeps the first sentence and, past `max`, cuts it at a word with
 * an ellipsis. '' for an entry with no words (or none read).
 */
export function entryOpening(lines, max = OPENING_MAX) {
  const all = (lines ?? []).map((l) => String(l ?? ''));
  const head = all.findIndex((l) => l.trim());   // AUDIT GUIDE W4: the header is the first line with words
  const body = all.filter((l, i) => !(i === head && DATE_HEADER.test(l)));
  const text = body.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  // a stop before a capital: "Hmm... he said." is one sentence - AUDIT GUIDE W4: a closing quote or bracket after the
  // stop still ends it, a capital in any script starts the next, and a lone full stop after a title's abbreviation or
  // an initial ("St. Delyn", "Jolin D. Ferrow") ends nothing
  let first = text;
  for (const m of text.matchAll(SENTENCE_END)) {
    const through = text.slice(0, m.index + 1);
    if (/^\.["'\u201d\u2019)\]]*$/.test(m[0]) && NOT_AN_END.test(through)) continue;
    first = text.slice(0, m.index + m[0].length);
    break;
  }
  if (first.length <= max) return first;
  const cut = first.lastIndexOf(' ', max - 1);
  const edge = (t) => t.replace(/[\s,;:-]+$/, '');
  let kept = edge(first.slice(0, cut > max / 2 ? cut : max - 1));
  // ...and never on a small word: "kill a..." says less than "kill..." (seen on the tracker's card in Chromium)
  while (TRAILING_SMALL_WORD.test(kept)) kept = edge(kept.replace(TRAILING_SMALL_WORD, ''));
  return `${kept}\u2026`;
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

/** PX5 / QT-LIVE1: under a game day a quest's clock is URGENT - the
 *  pause window's timer goes gold, and the quest lens (GUIDE1,
 *  ui/questLens.js) says so once when a clock crosses it. One number,
 *  one home. */
export const QUEST_URGENT_SECONDS = 86400;

/** PX5: remaining game seconds as words - days+hours above a day,
 *  hours+minutes below it, minutes alone under an hour. GUIDE2: moved here
 *  from the pause window, so the chronicle's deadline - the window the L
 *  key opens - reads exactly as the pause tab's does. */
export function remainWords(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m2 = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} day${d === 1 ? '' : 's'}${h ? ` ${h} hour${h === 1 ? '' : 's'}` : ''}`;
  if (h > 0) return `${h} hour${h === 1 ? '' : 's'}${m2 ? ` ${m2} min` : ''}`;
  return `${Math.max(1, m2)} min`;
}

/** GUIDE3-GUIDE5: the time left as the quest faces say it - remainWords' own count and one word ("2 days 3 hours
 *  left"): the herald's line, the tracker's card and a map mark's card, one phrase. */
export const timeLeftWords = (s) => `${remainWords(s)} left`;

/** GUIDE1: the order a row's entries were WRITTEN, as indices into its
 *  `messages`. The machine keeps its log in a Map keyed by step and
 *  `addLogStep` re-sets an existing step IN PLACE (quest.js addLogStep;
 *  C#'s Remove-then-Add lands in the freed slot too), so the walk's
 *  order is the order each step was FIRST logged: a quest that re-logs
 *  step 0 after step 1 still lists step 0 first, and every face that
 *  reads "the last entry is the latest" - the pause window's
 *  description (PX4), the chronicle's newest-first card - showed a
 *  superseded entry as the state of the quest. The bridge hands each
 *  message the time its step was written (`steps`, aligned with
 *  `messages`); the sort is by that time and STABLE, so two steps
 *  written in one tick keep the walk's order, and a row with no aligned
 *  steps (a host that sends none) keeps the walk's order whole. */
export function writtenOrder(q) {
  const messages = q?.messages ?? [];
  const order = messages.map((_, i) => i);
  const steps = q?.steps;
  if (!Array.isArray(steps) || steps.length !== messages.length) return order;
  const at = (i) => (Number.isFinite(steps[i]?.time) ? steps[i].time : -Infinity);
  return order.sort((a, b) => (at(a) === at(b) ? a - b : at(a) < at(b) ? -1 : 1));
}

/**
 * THE WALK. `{active, finished}` off a host's `questLog()` in, the two
 * lists every face draws out.
 *
 * An active quest with no entries is DROPPED, and that is the machine's
 * own law rather than a tidy-up: `Quest.getLogMessages` returns null
 * once a quest completes and empty until its first `log` action runs,
 * so a quest that has written nothing has nothing to say yet.
 *
 * GUIDE1: `readLines(message, step, row)` is the reader, and it is the
 * journal's own (journalLines, a LOUD read - DFU's logbook reads the
 * same way) unless a caller hands another; the quest lens hands its
 * quiet one, so both faces keep ONE law for which quests and which
 * entries, in which order. `written` is the same entries with the
 * step each was written at and its message, for a face that needs
 * more than the lines.
 */
export function questRail(log, readLines = journalLines) {
  const active = (log?.active ?? []).map((q, i) => {
    // READ in the walk's order - the order DFU's logbook reads in, and a
    // loud read latches the quest's last-referenced resource and place
    // for the next entry's pronouns - and only then put them in the
    // order they were written.
    const read = (q.messages ?? []).map((message, j) => ({ step: q.steps?.[j] ?? null, message, lines: readLines(message, q.steps?.[j] ?? null, q) ?? [] }));
    const written = writtenOrder(q).map((j) => read[j]).filter((e) => e.lines.length);
    return {
      key: `a:${q.id ?? i}`,
      // QUEST1: the raw id, kept alongside `key` rather than folded only
      // into that composite string - a consumer wanting to ACT on this
      // quest (not just render/fold it) needs the id on its own, and
      // `key`'s "a:" prefix makes it unusable as one without parsing the
      // string back apart.
      id: q.id ?? null,
      name: q.name || `Quest ${i + 1}`,
      questName: q.questName ?? '',
      main: isMainQuest(q.questName),
      clockSeconds: Number.isFinite(q.clockSeconds) ? q.clockSeconds : null,
      entries: written.map((e) => e.lines),
      written,
    };
  }).filter((q) => q.entries.length);
  const finished = (log?.finished ?? []).map(parseFinished).filter((q) => q.lines.length || q.name);
  // JOURNAL-CLEAN (2026-09-30, Discord: "...clean both finished and unfinished quests from your journal"): a quest
  // the player HID (the walk's `hidden` uids, the notebook's list) leaves `active` for `hidden` - the journal faces
  // draw `active`, and the pause tab's "Show hidden" draws `hidden`. A log with no `hidden` (the lens hands none)
  // hides nothing.
  const hiddenIds = new Set((log?.hidden ?? []).map(String));
  if (!hiddenIds.size) return { active, finished, hidden: [] };
  const isHidden = (q) => q.id != null && hiddenIds.has(String(q.id));
  return { active: active.filter((q) => !isHidden(q)), finished, hidden: active.filter(isHidden) };
}
