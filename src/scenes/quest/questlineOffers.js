// @ts-check
// QL-OFFERED (2026-10-25, Lord Rumpkin, "too many quests": "every town I enter there is some courier ramming
// quest letters into my hand ... Random quests like that should be picked up in the tavern, or notice board"; the owner:
// "No band aids", and his decision: A QUESTLINE IS TAKEN, NEVER SENT - bible/06-Systems/Questlines-Arc.md section 4, THE
// RUNNER). THE QUESTLINES' OFFERS: where a line on offer (systems/questlines/qlLineRunner.js - its gate holds, it is not
// begun) is posted, and the take that begins it. Made by the bridge over its layer (scenes/quest/questBridge.js - THE ONE
// CONSTRUCTION SEAM, every host's), so no host carries a line of it.
//
// DFU's rule, which this follows: a letter comes unasked only where the story is already the player's - the main
// quest's, a guild's invitation, a vampire clan's - and every other quest is a questor's to offer and the player's to
// accept or refuse (DaggerfallQuestOfferWindow, the guild popup's GetQuest - systems/quest/offerFlow.js). So a line's
// first step's letter - the giver's own words, its places and people drawn as a questor's offer draws them (the runner's
// offerQuest: parsed, never started) - IS the offer, and the letter read is the letter taken:
//   - THE NOTICE BOARD (ui/noticeWindow.js NOTICE1 - its Notices tab, "Help wanted"): the introductions (qlLines.js
//     `post: 'board'`), their givers townsfolk, each with its Take. The board is the port's own and stands online; offline
//     a rumour board is DFU's rumour box, and the Quests tab takes them.
//   - THE GIVERS' DOORS, through DFU's own offer (Yes/No): a Mages Guild hall's Get Quest for Ysolde Marnhel's lines
//     (`magery`), a temple's for the Prior's (`temple`), someone with work in a tavern for Corvane Tull's, Imrah
//     Bel-Tavir's and Hamid al-Rasheen's (`tavern`). A line refused there rests a day of the character's time at every
//     giver, so the next Get Quest draws the guild's own work; the board and the Quests tab still offer it.
//   - THE QUESTS TAB (ui/enhanced/enhancedMenu.js pauseQuests): every line on offer, its Take up (journalClean.takeLine).
// Whatever the door, the take says what it did in the HUD - the line taken, or why it could not be.
import { QL_LINES, lineById } from '../../systems/questlines/qlLines.js';
import { RETRY_GAP_S } from '../../systems/questlines/qlLineRunner.js';
import { GUILD_GROUPS } from '../../formats/factionFile.js';
import { t } from '../../systems/textManager.js';

/** The giver's door a guild's Get Quest is, by guild group - the posts (qlLines.js LinePost) a guild's questor offers. */
export const GUILD_POSTS = Object.freeze({ [GUILD_GROUPS.MagesGuild]: 'magery', [GUILD_GROUPS.HolyOrder]: 'temple' });

/** The take's words: the line taken, or why it could not be (qlLineRunner.js takeLine's reasons). */
export function takeWords(r, title) {
  if (r?.ok) return t('ql.offer.taken', 'You took up {title}. It is on the Quests tab of the pause menu.', { title });
  if (r?.reason === 'noplace') return t('ql.offer.noPlace', 'It cannot be taken up here. Try again in a town, or in another region.');
  return t('ql.offer.notOnOffer', 'That questline is not on offer now.');
}

/** A letter's rows as the board reads them: each paragraph's hard-wrapped lines joined, the paragraphs a blank line
 *  apart. */
export const letterText = (rows) => rows.map((r) => String(r ?? '').trim()).join('\n')
  .split(/\n{2,}/).map((p) => p.split('\n').filter(Boolean).join(' ')).filter(Boolean).join('\n\n');

/** The letter a line's first step opens with - its first letter Item's `used` message (every first step's `Item ...
 *  letter used 1011`) - as the quest's tokens, or null. */
export function firstLetterTokens(quest) {
  for (const r of quest?.resources?.values?.() ?? []) {
    if (!r?.isItem || r.itemName !== 'letter' || !(r.usedMessageID > 0)) continue;
    return quest.getMessage?.(r.usedMessageID)?.getTextTokens?.(-1, quest.rolls) ?? null;
  }
  return null;
}

/** QL-OFFERED: the notice board's source on this page - the bridge's offers (setLineBoard), read by the board's one door
 *  (ui/noticeDoor.js) as the acts' sink is read (qlActs.js setActSink): one bridge a page. */
let _board = null;
export function setLineBoard(fn) { _board = typeof fn === 'function' ? fn : null; }
/** One board's opening of the introductions on offer, or null where no bridge posts any. */
export const lineBoard = () => _board?.() ?? null;

/**
 * @param {{ machine: any, questlines: any, rowsOf: (tokens: any) => string[], ctx?: { say?: (text: string) => void,
 *   nowSeconds?: () => number, isPlayerInsideCastle?: () => boolean, removeNpcQuestor?: (seed: number) => void } }} deps
 *   `questlines` the layer (systems/questlines/qlLayer.js - its runner and takeLine); `rowsOf` the bridge's message rows
 *   (questBridge.js tokensToRows); `ctx.say` the host's HUD line; `nowSeconds` the character's clock (a refusal's day)
 */
export function createQuestlineOffers({ machine, questlines, rowsOf, ctx = {} }) {
  const runner = questlines.runner;
  /** A load's count: an offer parsed in the game a load replaced is not the loaded game's to start (QUEST-UID1). */
  let generation = 0;
  /** line id -> the character's second a giver's offer of it was refused: it rests RETRY_GAP_S at the givers. */
  const resting = new Map();
  const now = () => ctx.nowSeconds?.() ?? 0;
  const say = (text) => { if (text) ctx.say?.(text); };

  /** A line not begun and on offer, its first step parsed for its letter - `{ line, quest, tokens }` - or null. */
  function offerOf(l) {
    if (runner.lineState(l.id) || !runner.onOffer(l.id)) return null;
    const quest = runner.offerQuest(l.id);
    const tokens = quest ? firstLetterTokens(quest) : null;
    return tokens ? { line: l, quest, tokens } : null;
  }

  /** THE TAKE: the line begun with the quest its offer was read from (or by name), said in the HUD. */
  function take(id, quest = null) {
    const r = questlines.takeLine(id, quest ? { quest } : undefined);
    const text = takeWords(r, lineById(id)?.title() ?? id);
    say(text);
    return { ...r, text };
  }

  /** A giver's offer of the first line posted at `post` - DFU's offer step (offerFlow.js's shape: `offer`, then
   *  `accepted` or `refused`), the line's letter its prompt - or null for none. The questor whose quest is still open
   *  offers nothing new (IsLastNPCClickedAnActiveQuestor): null, and DFU's door says so. */
  function atPost(post, before = () => {}) {
    if (machine.lastNPCClickedQuestorOf?.()) return null;
    const s = now();
    for (const l of QL_LINES) {
      if (l.post !== post || (resting.get(l.id) ?? -Infinity) > s - RETRY_GAP_S) continue;
      const o = offerOf(l);
      if (!o) continue;
      before();
      const gen = generation;
      return {
        kind: 'offer', line: l.id,
        prompt: { tokens: o.tokens, buttons: 'YesNo', clickAnywhereToClose: false, allowCancel: false },
        respond: (yes) => {
          if (gen !== generation) return { kind: 'close' };   // QUEST-UID1: a load took the offer away under its popup
          if (!yes) { resting.set(l.id, now()); return { kind: 'refused', popup: null }; }
          const r = take(l.id, o.quest);
          return r.ok ? { kind: 'accepted', popup: null, quest: o.quest } : { kind: 'close' };
        },
      };
    }
    return null;
  }

  return {
    /**
     * THE NOTICE BOARD'S OPENING: the introductions on offer, each a card - `{ id, title, giver, text }`, its letter's
     * words - and `take(id)`, which begins the line with the very quest its card was read from. Answers `{ cards, take }`
     * (no cards: nothing on offer here).
     */
    board() {
      const offers = QL_LINES.filter((l) => l.post === 'board').map(offerOf).filter(Boolean);
      const gen = generation;
      return {
        cards: offers.map((o) => ({ id: o.line.id, title: o.line.title(), giver: o.line.giver(), text: letterText(rowsOf(o.tokens)) })),
        take: (id) => {
          const o = offers.find((x) => x.line.id === id);
          if (!o || gen !== generation) return { ok: false, line: id, reason: 'closed', text: takeWords(null) };
          return take(id, o.quest);
        },
      };
    },
    /** A guild's Get Quest (the bridge's offerGuildQuest): Ysolde's lines at a Mages Guild hall, the Prior's at a
     *  temple - the offer step, or null for the guild's own draw. */
    atGuild: (guildGroup) => (GUILD_POSTS[guildGroup] ? atPost(GUILD_POSTS[guildGroup]) : null),
    /** Someone with work in a tavern (the bridge's offerSocialQuest): Corvane's, Imrah's and Hamid's lines - the offer
     *  step, or null for DFU's own social draw. DFU's ctor half first, as offerSocialQuest's: the questor leaves the work
     *  pool, unless the player is inside a castle. */
    atTavern: (npcData) => atPost('tavern', () => { if (!ctx.isPlayerInsideCastle?.()) ctx.removeNpcQuestor?.(npcData?.nameSeed ?? 0); }),
    /** THE QUESTS TAB'S TAKE UP: the line on offer begun (or its first step, set aside in the journal, taken back).
     *  Answers `{ ok, reason?, text }`. */
    takeUp: (id) => take(id),
    /** A load: every offer in hand let go, and the givers' rests with them. */
    reset() { generation++; resting.clear(); },
  };
}
