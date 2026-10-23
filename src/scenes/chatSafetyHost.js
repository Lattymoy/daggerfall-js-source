// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SAFE1-SAFE7 (2026-10-17, Mac: "Lets do every single thing here. I want a full fledged future proof system"; the chat
// safety plan, bible/11-Multiplayer/Chat-Safety-Arc.md): THE CHAT'S SAFETY, AS THE PLAYER MEETS IT - a module the
// streaming host wires (scenes/world.js bootWorld; fishHost.js is the shape - HOST-SPLIT: the host does not grow).
//
//   - SAFE1 BLOCK: the account's block list, read from the service at the chat's start and kept there; a blocked
//     account's lines never reach the log (ChatLog.hears - so no tab, peek, bubble or search shows them), its lines
//     already heard are taken back (ChatLog.forgetSpeaker), and its friend requests, party invites and notes never land
//     (SocialState.hears) - nor, AUDIT SAFE CLIENT-7, its trade, duel, wedding, card or page requests (OnlineSession.hears).
//     /block <name>, /unblock <name>, /blocked, and Block on a line's own menu.
//   - SAFE3 REPORT: a line's own menu (the speaker's name pressed - ui/chatPanel.js lineActions) reports that line and
//     the lines before it; /report <name> [reason][: note] reports everything that player said that this page heard.
//     Only lines the relay stamped can be carried (ChatLog.reportLines), and the service checks every stamp. A report
//     that mutes (three credible reporters) hands back the order, carried to every room this page holds (MOD1's carrier).
//   - SAFE4 THE RELAY'S WORD: a mute or ban the service pushed to the hub (`law`) is carried on to every room; a ban
//     (`banned`) is said, and the page leaves every room and stays out (AUDIT SAFE CLIENT-2) - the service will mint it
//     no token to come back on. A moderator's /ban, /unban and /strikes ask the service, which decides; a ban's order is
//     carried as a mute's is. AUDIT SAFE DOC-4: and the reports' queue read in the game - /cases, /case, /dismiss.
//   - SAFE6: a new voice's line refused for its pace (`slowed`) is said, once in a while, never on every press - and the
//     line goes back in the field (AUDIT SAFE CLIENT-12), so nothing typed is lost.
//   - SAFE7 THE CODE OF CONDUCT: before the first line this account sends (and again when the code changes - the
//     mint's `conduct`), the card (ui/conductCard.js); the line stays in the field until the player agrees and sends it.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A, the ONLINE row's CHAT SAFETY bracket (AUDIT SAFE DOC-15: this
// said "Ledger A row (CHAT SAFETY)", and there is no such row - the arc is a bracket inside ONLINE's).
import { parseSafetyCommand, reportReasonLabel, orderKindOf, REPORT_REASONS, REPORT_LINES_MAX, untilText, modHelpLines } from '../net/safety/safetyLaw.js';
import { CONDUCT_VERSION } from '../net/safety/conduct.js';
import { PUBLIC_TABS } from '../net/safety/chatStamp.js';   // AUDIT SAFE CLIENT-12: the tabs a new voice is paced on
import { sanitizeName } from '../net/wire.js';   // AUDIT SAFE CLIENT-3: a name compared as MOD1 compares one
import { ID_RE } from '../net/identityToken.js';   // AUDIT SAFE DOC-4: an account named by its id (`#id`)
import { parseChatLine, expandShortcodes } from '../net/chatCommands.js';
import { safetyBlocks, safetyBlock, safetyUnblock, safetyReport, safetyConduct, modBan, modUnban, modStrikes, modCases, modCase, modDismiss, accountRefusalText, storedSession, serviceBase } from '../net/accountClient.js';
import { appStorage } from '../systems/appStorage.js';
import { createConductCard } from '../ui/conductCard.js';
import { registerOverlay } from '../ui/enhanced/enhancedOverlays.js';
import { t, intlLocale } from '../systems/textManager.js';
import { isTouchDevice } from '../ui/touch/touch.js';

/** The kinds of chat line that reach other players - what the code of conduct gates (net/chatCommands.js parseChatLine). */
const SAID_KINDS = Object.freeze(['say', 'me', 'rp', 'channel', 'emote']);
/** How often a new voice is told it is being slowed, ms - one line, not one a press. */
const SLOWED_SAY_MS = 15_000;
/** AUDIT SAFE CLIENT-12: a public line sent this recently is the one a `slowed` answers, ms - the relay answers at once. */
export const SLOWED_KEEP_MS = 10_000;
/** AUDIT SAFE CLIENT-8: a block list's read that failed is asked again after this, doubling to BLOCKS_RETRY_MAX_MS, ms. */
export const BLOCKS_RETRY_MS = 5_000;
export const BLOCKS_RETRY_MAX_MS = 5 * 60_000;
/** AUDIT SAFE CLIENT-8: a reconnect reads the list again, but no oftener than this, ms - a relay deploy reconnects every
 *  room this page holds at once, and that is one read. */
export const BLOCKS_REREAD_MS = 30_000;

/**
 * AUDIT SAFE CLIENT-3 / DOC-6 + CLIENT-13 (2026-10-17): A NAME THAT NAMES NOBODY, OR MORE THAN ONE, IN EACH COMMAND'S OWN
 * WORDS. These read MOD1's ("Nobody was muted") for a block and a report; a moderator's look falls through to the
 * service by the name (it decides), except where the name is two accounts here - then the account is named by its id.
 */
const NAMED = Object.freeze({
  block: {
    many: (count, name) => t('net.safety.manyBlock', '{count} players are called {name}. Nobody was blocked. Click the name on one of their chat lines to block that player.', { count, name }),
    none: (name) => t('net.safety.noneBlock', 'Nobody called {name} is here or said anything in your chat. Nobody was blocked.', { name }),
  },
  report: {
    many: (count, name) => t('net.safety.manyReport', '{count} players are called {name}. Nothing was reported. Click the name on one of their chat lines to report that player.', { count, name }),
    none: (name) => t('net.safety.noneReport', 'Nobody called {name} said anything in your chat. Nothing was reported.', { name }),
  },
  mod: {
    many: (count, name) => t('net.safety.manyMod', '{count} players are called {name}. Nothing was done. Use the account id instead: #id (/cases shows it).', { count, name }),
    none: () => '',
  },
});
/** AUDIT SAFE CLIENT-13: a record's act in the player's language - a mute's and a ban's with their end. */
const actText = (/** @type {any} */ h) => {
  const until = untilText(Number(h?.until) || 0);
  switch (h?.kind) {
    case 'mute': return t('net.safety.actMute', 'muted {until}', { until });
    case 'unmute': return t('net.safety.actUnmute', 'unmuted');
    case 'ban': return t('net.safety.actBan', 'banned {until}', { until });
    case 'unban': return t('net.safety.actUnban', 'unbanned');
    case 'dismiss': return t('net.safety.actDismiss', 'a case dismissed');
    default: return String(h?.kind ?? '');
  }
};
/** AUDIT SAFE CLIENT-13: a day in the player's language (the text core's, never the browser's). @param {number} s */
const dayText = (s) => new Date(s * 1000).toLocaleDateString(intlLocale());
/** AUDIT SAFE DOC-4: a case line's moment, in the player's language. @param {number} ms */
const momentText = (ms) => new Date(ms).toLocaleString(intlLocale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
/** AUDIT SAFE DOC-4: a case's reasons in the player's language - or, for a case the reviewer opened, that it did. */
const reasonsText = (/** @type {unknown} */ reasons) => {
  const said = (Array.isArray(reasons) ? reasons : []).map((x) => reportReasonLabel(String(x)));
  return said.length ? said.join(', ') : t('net.safety.byReviewer', 'opened by the reviewer');
};
/** AUDIT SAFE DOC-4: the reviewer's word on a case, or ''. @param {any} ai */
const verdictText = (ai) => (ai && typeof ai === 'object'
  ? `${t('net.safety.caseVerdict', 'The reviewer says {category}, severity {severity}, confidence {confidence}.', { category: reportReasonLabel(String(ai.category ?? '')), severity: Number(ai.severity) || 0, confidence: `${Math.round((Number(ai.confidence) || 0) * 100)}%` })}${ai.mode === 'shadow' ? ` ${t('net.safety.shadow', '(shadow mode: no action taken)')}` : ''}`
  : '');

/**
 * @param {object} o
 * @param {() => any} o.log  the chat log (net/chat.js ChatLog), or null before the chat starts
 * @param {() => any[]} o.links  every room this page holds - the chat's links and the presence session
 * @param {() => any} [o.social]  the hub's social picture (net/social.js SocialState), or null
 * @param {() => any} [o.minter]  AUDIT SAFE CLIENT-2: the page's token minter (accountClient.js accountTokenMinter), or null
 * @param {() => any} [o.panel]  AUDIT SAFE CLIENT-12: the chat panel (ui/chatPanel.js), or null
 * @param {boolean} [o.touch]
 * @param {Document} [o.doc]
 * @param {any} [o.win]  the window the code's card reads its Escape on
 * @param {(close: () => void) => () => void} [o.register]  the overlay stack's door, for the code's card
 * @param {(u: string, i: any) => Promise<Response>} [o.fetch]
 * @param {any} [o.storage]  the device's storage (systems/appStorage.js)
 * @param {() => number} [o.now]  epoch ms
 * @param {(fn: () => void, ms: number) => any} [o.setTimer]  AUDIT SAFE CLIENT-8: the block list's retry clock
 * @param {(h: any) => void} [o.clearTimer]
 */
export function createChatSafetyHost({ log, links, social = () => null, minter = () => null, panel = () => null, touch = isTouchDevice(), doc = globalThis.document, win = globalThis, register = registerOverlay,
  fetch = (u, i) => globalThis.fetch(u, i), storage = null, now = () => Date.now(), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (h) => clearTimeout(h) }) {
  /** @type {Map<string, string>} sub -> the name it was blocked under (the service's: the account's own) */
  const blocked = new Map();
  /** AUDIT SAFE CLIENT-9: sub -> the name the line SHOWED when it was blocked on this page - NAME-AS: a room reads a
   *  character's name and the list keeps the account's, so "/unblock <the name they saw>" found nobody. Either answers. */
  const shownAs = new Map();
  /** Whether this account has agreed to the code as it stands - null until the mint says (an older service never does: heard as yes). */
  let agreed = null;
  /** AUDIT SAFE CLIENT-1: agreed on THIS page - a mint already in flight when the player agreed answers the service's old
   *  word, and is never let take it back. */
  let agreedHere = false;
  let card = null;
  let slowedSaid = 0;
  /** AUDIT SAFE CLIENT-12: the last public line that went - `{ text, at }`, what a `slowed` hands back to the field. */
  let lastPublic = null;
  /** AUDIT SAFE CLIENT-2: the ban this page holds out for (epoch seconds; 0 none) - every room it holds, and every room it
   *  opens after, stays shut until the relay says it was lifted, or a reload. And the last word said of it. */
  let bannedUntil = 0;
  let banSaid = '';
  /** AUDIT SAFE CLIENT-13: the rooms the host makes after the chat starts (the arena's hall, its watching sockets) -
   *  wired as the chat's own are, carried to and left on a ban. */
  const extra = new Set();
  /** AUDIT SAFE CLIENT-8: the block list's read - in flight, when it last answered, its failures in a row, its retry. */
  let reading = null, readAt = -Infinity, readFails = 0, retry = null;
  const store = () => storage ?? appStorage();
  const io = () => { const s = storedSession(store()); return s ? { fetch, base: serviceBase(store()), secret: s.secret } : null; };
  const say = (tabId, text) => log()?.push(tabId ?? log()?.active, { text, system: true });
  const sayActive = (text) => say(log()?.active, text);
  const hears = (sub) => !blocked.has(sub);
  /** Every room this page holds: the host's, and the ones made since that were handed in (`adoptLink`) and still stand. */
  const allLinks = () => {
    for (const l of extra) if (!l?.barred && !l?.room && l?.status !== 'connecting') extra.delete(l);   // let go: nothing to carry to
    return [...new Set([...links(), ...extra])];
  };
  /** Carry a signed order to every room this page holds - its kind's door (MOD1's carrier). */
  const carry = (order) => {
    const kind = orderKindOf(order);
    if (!kind) return 0;
    let n = 0;
    for (const l of allLinks()) if (kind === 'ban' ? l?.sendBanOrder?.(order) : l?.sendMuteOrder?.(order)) n++;
    return n;
  };
  const adoptList = (list) => {
    const was = new Set(blocked.keys());
    blocked.clear();
    for (const b of Array.isArray(list) ? list : []) if (typeof b?.sub === 'string') blocked.set(b.sub, String(b.name ?? ''));
    for (const sub of blocked.keys()) if (!was.has(sub)) log()?.forgetSpeaker?.(sub);
    for (const sub of [...shownAs.keys()]) if (!blocked.has(sub)) shownAs.delete(sub);
    social()?.refilter?.();   // AUDIT SAFE CLIENT-11: a request or an invite that already stood goes with the block
  };
  /** The name a blocked account goes by in a line: the account's, and the one its lines showed where that differs. */
  const blockedLabel = (sub) => {
    const handle = blocked.get(sub) ?? '', shown = shownAs.get(sub) ?? '';
    return shown && handle && sanitizeName(shown).toLowerCase() !== sanitizeName(handle).toLowerCase() ? `${handle} (${shown})` : (handle || shown);
  };

  /**
   * A NAME TO THE ONE ACCOUNT IT NAMES. AUDIT SAFE CLIENT-3 / DOC-6 (2026-10-17): the players this page holds AND the
   * lines it heard, together - the rooms' peers were asked first and one match there won at once, so "/block Bob" blocked
   * the Bob standing in my region and not the Bob who said it on World; and past a peers' ambiguity the heard lines picked
   * one. Two accounts of one name, anywhere this page can see, is a refusal - never a guess (section 2's own law).
   * `{ sub, name }`, or `{ error, why }` - why 'many', 'none' or 'unaccounted' (a peer whose account the room did not say).
   * @param {string} name @param {'block'|'report'|'mod'} op
   */
  const accountOf = (name, op) => {
    const want = sanitizeName(name).toLowerCase();
    /** @type {Map<string, string>} */
    const found = new Map();
    let unaccounted = false;
    for (const l of allLinks()) {
      for (const p of l?.peers?.values?.() ?? []) {
        if (sanitizeName(p?.name ?? '').toLowerCase() !== want) continue;
        if (typeof p.sub === 'string' && p.sub) found.set(p.sub, String(p.name)); else unaccounted = true;
      }
    }
    for (const tab of log()?.tabs ?? []) for (const l of tab.messages) if (l.sub && !l.mine && !l.system && !found.has(l.sub) && sanitizeName(l.name).toLowerCase() === want) found.set(l.sub, String(l.name));
    if (found.size === 1) { const [[sub, shown]] = [...found]; return { sub, name: shown }; }
    if (found.size > 1) return { error: NAMED[op].many(found.size, name), why: 'many' };
    if (unaccounted) return { error: t('net.safety.unaccounted', '{name} cannot be named from here yet. Try again in a moment.', { name }), why: 'unaccounted' };
    return { error: NAMED[op].none(name), why: 'none' };
  };

  const block = async (sub, name) => {
    const a = io();
    if (!a) { sayActive(accountRefusalText('auth')); return; }
    const r = await safetyBlock(a, sub);
    if (!r.ok) { sayActive(accountRefusalText(r.error)); return; }
    shownAs.set(sub, name);   // AUDIT SAFE CLIENT-9: the name the line showed, beside the account's
    adoptList(r.data?.blocks);
    // AUDIT SAFE CLIENT-3: the ACCOUNT named, where the list's name is not the one the line showed (NAME-AS)
    const account = blocked.get(sub) ?? '';
    sayActive(account && sanitizeName(account).toLowerCase() !== sanitizeName(name).toLowerCase()
      ? t('net.safety.blockedAs', 'You blocked {name} (account {account}). You will not see their lines, invites or requests. /unblock {name} undoes it.', { name, account })
      : t('net.safety.blocked', 'You blocked {name}. You will not see their lines, invites or requests. /unblock {name} undoes it.', { name }));
  };
  const unblock = async (sub, name) => {
    const a = io();
    if (!a) { sayActive(accountRefusalText('auth')); return; }
    const r = await safetyUnblock(a, sub);
    if (!r.ok) { sayActive(accountRefusalText(r.error)); return; }
    adoptList(r.data?.blocks);
    sayActive(t('net.safety.unblocked', 'You unblocked {name}.', { name }));
  };
  const report = async (sub, name, reason, lines, note = '') => {
    // AUDIT SAFE CLIENT-5: nothing to carry - their stamped lines all out of their day (the service's own word for it), or none
    const heard = () => (log()?.tabs ?? []).some((tab) => tab.messages.some((l) => l.sub === sub && l.sg));
    if (!lines.length) { sayActive(accountRefusalText(heard() ? 'report-stale' : 'report-no-line')); return; }
    const a = io();
    if (!a) { sayActive(accountRefusalText('auth')); return; }
    const r = await safetyReport(a, { target: sub, reason, note, lines });   // AUDIT SAFE DOC-13: the reporter's note
    if (!r.ok) { sayActive(accountRefusalText(r.error)); return; }
    if (r.data?.order) carry(r.data.order);
    sayActive(r.data?.repeat
      ? t('net.safety.reportedAgain', 'You already reported {name}; their newest lines were added for the moderators.', { name })
      : t('net.safety.reported', 'Reported {name}. The moderators will see it. /block {name} hides them from you now.', { name }));
  };

  /** AUDIT SAFE CLIENT-8 (2026-10-17): THE BLOCK LIST, READ - and read again. A read that failed at the chat's start (the
   *  service's bad minute) was never asked again, so every account the player had blocked was heard for the rest of the
   *  page. A failure asks again after BLOCKS_RETRY_MS, doubling to BLOCKS_RETRY_MAX_MS; a room welcomed again reads it
   *  again (`onWelcomed` - another device may have blocked since), no oftener than BLOCKS_REREAD_MS. One read at a time.
   *  Never for a missing sign-in, nor for one the service refused ('auth', 'banned'): signing in is the way back. */
  const readBlocks = () => {
    if (reading) return reading;
    const a = io();
    if (!a) return Promise.resolve(false);
    if (retry != null) { clearTimer(retry); retry = null; }
    reading = (async () => {
      let r;
      try { r = await safetyBlocks(a); } catch { r = { ok: false, error: 'offline' }; }
      reading = null;
      if (r.ok) { adoptList(r.data?.blocks); readAt = now(); readFails = 0; return true; }
      if (r.error === 'auth' || r.error === 'banned') return false;
      readFails++;
      retry = setTimer(() => { retry = null; void readBlocks(); }, Math.min(BLOCKS_RETRY_MAX_MS, BLOCKS_RETRY_MS * 2 ** (readFails - 1)));
      return false;
    })();
    return reading;
  };

  /** AUDIT SAFE CLIENT-2 (2026-10-17): THE PAGE IS BANNED - every room it holds left and LATCHED (OnlineSession.bar: no
   *  join, rejoin or retry - world.js chatFrame's rejoin brought every channel straight back on CHAT_REJOIN_MS), the token
   *  the minter holds let go (a token minted a moment before the ban opened every room a rejoin asked for), and the ban
   *  said ONCE however many sockets say it. The relay sends the ban's order (`law`) first, so it is carried before this
   *  leaves. A lifted ban (until 0) unlatches them. */
  const banned = (until) => {
    if (until === 0) {
      bannedUntil = 0;
      for (const l of allLinks()) l?.unbar?.();
      if (banSaid !== 'lifted') { banSaid = 'lifted'; sayActive(t('net.safety.unbannedSelf', 'Your ban was lifted.')); }
      return;
    }
    if (!(until > now() / 1000)) return;   // a word about a ban already over
    bannedUntil = until;
    try { minter()?.forget?.(); } catch { /* the latch holds without it */ }
    for (const l of allLinks()) { if (typeof l?.bar === 'function') l.bar(); else l?.leave?.(); }
    if (banSaid !== `until:${until}`) { banSaid = `until:${until}`; sayActive(t('net.safety.bannedSelf', 'This account is banned {until}. You have left the online world.', { until: untilText(until) })); }
  };

  /** Each link's word on my own chat (SAFE4, SAFE6), and its ear (AUDIT SAFE CLIENT-7), and its welcome (CLIENT-8). */
  const wire = (link) => {
    if (!link) return;
    link.hears = hears;
    link.mayChat = mayChat;
    link.onLaw = ({ order }) => carry(order);
    link.onLease = (l) => { for (const x of allLinks()) x?.sendLease?.(l); };   // LEASE1 (net/roomLease.js): my hub's lease, handed to every room I hold
    link.onBanned = ({ until }) => banned(until);
    link.onWelcomed = () => {
      if (reading || now() - readAt < BLOCKS_REREAD_MS) return;
      void readBlocks();
    };
    link.onSlowed = ({ ms }) => {
      const at = now();
      // AUDIT SAFE CLIENT-12: the refused line back in the field - the field was cleared as it went, and inside the quiet
      // window below nothing was said, so the line was simply gone
      if (lastPublic && at - lastPublic.at <= SLOWED_KEEP_MS && panel()?.restore?.(lastPublic.text) === true) lastPublic = null;
      if (at - slowedSaid < SLOWED_SAY_MS) return;
      slowedSaid = at;
      sayActive(t('net.safety.slowed', 'New players can send one line every few seconds in public channels. Try again in {s} s.', { s: Math.ceil(ms / 1000) }));
    };
    if (bannedUntil && typeof link.bar === 'function') link.bar();   // a room made after the ban stays shut
  };

  /** The code's card, standing - one for the page. */
  const showCard = (tabId) => {
    if (!card) card = createConductCard({ agree: () => { void host.agree(tabId); }, later: () => {}, touch, doc, win, register });
    card.show();
  };
  /** SAFE7: a line held for the code - the card stands and the line stays where it is. True when held. */
  const heldForCode = (tabId, text) => {
    const said = parseChatLine(expandShortcodes(text));
    if (!SAID_KINDS.includes(said.kind)) return false;
    showCard(tabId);
    return true;
  };
  /** AUDIT SAFE CLIENT-13 (2026-10-17): EVERY LINE A ROOM IS ASKED TO CARRY PASSES THE CODE OF CONDUCT'S GATE - each
   *  session asks before it sends (OnlineSession.mayChat), so an item posted from the pack (CHAT-POST, world.js
   *  postItemInChat - it went straight to the tab's session, and a player who had never agreed posted to World) is held
   *  as a typed line is: the card stands and nothing goes. A typed line was held before it got here (onSend). */
  const mayChat = () => {
    if (agreed !== false) return true;
    showCard(null);
    return false;
  };
  /** AUDIT SAFE CLIENT-12: a line that goes out on a public tab - what a `slowed` hands back. */
  const notePublic = (tabId, text) => { lastPublic = PUBLIC_TABS.includes(tabId) ? { text, at: now() } : lastPublic; };
  /** The service's door for a moderator's command: `{ target }` for `#id` or the one account this page can name, else
   *  `{ name }` for the service to find - or `{ error }` when the name is two accounts here. */
  const modTarget = (name) => {
    const typed = String(name ?? '').trim();
    if (typed.startsWith('#') && ID_RE.test(typed.slice(1))) return { target: typed.slice(1) };
    const named = accountOf(typed, 'mod');
    if (!('error' in named)) return { target: named.sub };
    return named.why === 'many' ? { error: named.error } : { name: typed };
  };

  const host = {
    hears,
    /** The chat started: the log hears through the block list, every room's word is wired, and the list is read. */
    async start() {
      const l = log();
      if (l) l.hears = hears;
      for (const link of allLinks()) wire(link);
      await readBlocks();
    },
    /** AUDIT SAFE CLIENT-13: a room the host made after the chat started (the arena's hall and its watching sockets,
     *  scenes/arena/arenaOnline.js through world.js makeHall) - wired, carried to and left on a ban as the chat's own are.
     *  Answers the link. */
    adoptLink(link) {
      if (!link) return link;
      extra.add(link);
      wire(link);
      return link;
    },
    /** The social picture started: it hears through the block list too. */
    adoptSocial() { const s = social(); if (s) s.hears = hears; },
    /** The mint's word: whether the code as it stands is agreed (`conduct`; absent from an older service - heard as yes).
     *  AUDIT SAFE CLIENT-1: never a no over a yes this page was given - a mint in flight as the player agreed. */
    adopt(issued) {
      if (!issued || typeof issued.conduct !== 'boolean') return;
      if (agreedHere && !issued.conduct) return;
      agreed = issued.conduct;
    },
    /** A spoken line's menu: Report it (a reason each) and Block or Unblock its speaker. */
    lineActions(line) {
      if (!line?.sub || line.mine || line.system) return [];
      const name = String(line.name ?? '');
      const rows = REPORT_REASONS.map((reason) => ({
        label: t('net.safety.reportAs', 'Report: {reason}', { reason: reportReasonLabel(reason) }),
        run: () => { void report(line.sub, name, reason, log()?.reportLines?.(line.sub, { seq: line.seq }) ?? []); },
      }));
      rows.push(blocked.has(line.sub)
        ? { label: t('net.safety.unblockLabel', 'Unblock'), run: () => { void unblock(line.sub, name); } }
        : { label: t('net.safety.blockLabel', 'Block'), run: () => { void block(line.sub, name); } });
      return rows;
    },
    /**
     * A line the player sent - answered as the chat panel's onSend is: true, a safety command done (the field clears);
     * false, the line held for the code of conduct (it stays in the field); null, not this module's.
     * @param {string} tabId @param {string} text
     */
    onSend(tabId, text) {
      const cmd = parseSafetyCommand(text);
      if (cmd) { void host.command(tabId, cmd); return true; }
      notePublic(tabId, text);
      if (agreed !== false) return null;
      return heldForCode(tabId, text) ? false : null;
    },
    /** The code agreed: kept on the account, and the player told the line can go. */
    async agree(tabId) {
      const a = io();
      if (!a) { say(tabId, accountRefusalText('auth')); return; }
      const r = await safetyConduct(a, CONDUCT_VERSION);
      if (!r.ok) { say(tabId, accountRefusalText(r.error)); return; }
      agreed = true;
      agreedHere = true;   // AUDIT SAFE CLIENT-1
      say(tabId, t('net.safety.agreed', 'Thank you. Press Enter to send your message.'));
    },
    /** One parsed safety command, run. @param {string} tabId @param {any} cmd */
    async command(tabId, cmd) {
      if ('error' in cmd) { say(tabId, cmd.error); return; }
      if (cmd.op === 'conduct') { showCard(tabId); return; }
      if (cmd.op === 'blocked') {
        const names = [...blocked.keys()].map(blockedLabel).filter(Boolean);
        say(tabId, names.length ? t('net.safety.blockedList', 'Blocked: {names}', { names: names.join(', ') }) : t('net.safety.blockedNone', 'You have blocked nobody.'));
        return;
      }
      if (cmd.op === 'modhelp') { for (const line of modHelpLines()) say(tabId, line); return; }
      if (cmd.op === 'unblock') {
        // AUDIT SAFE CLIENT-9: by either name - the account's (the list's) or the one its lines showed - and, for a block
        // made on another device, by the account a name here names, when that account is on the list
        const want = sanitizeName(cmd.name).toLowerCase();
        let sub = [...blocked.keys()].find((s) => sanitizeName(blocked.get(s) ?? '').toLowerCase() === want || sanitizeName(shownAs.get(s) ?? '').toLowerCase() === want) ?? null;
        if (!sub) { const who = accountOf(cmd.name, 'block'); if (!('error' in who) && blocked.has(who.sub)) sub = who.sub; }
        if (!sub) { say(tabId, t('net.safety.notBlocked', 'You have not blocked anyone called {name}. /blocked lists them.', { name: cmd.name })); return; }
        await unblock(sub, cmd.name.trim());
        return;
      }
      if (cmd.op === 'block' || cmd.op === 'report') {
        const who = accountOf(cmd.name, cmd.op);
        if ('error' in who) { say(tabId, who.error); return; }
        if (cmd.op === 'block') await block(who.sub, who.name);
        else await report(who.sub, who.name, cmd.reason, log()?.reportLines?.(who.sub, { max: REPORT_LINES_MAX }) ?? [], cmd.note ?? '');
        return;
      }
      // a moderator's: the service decides, by the account this page can name or else by the name itself
      const a = io();
      if (!a) { say(tabId, accountRefusalText('auth')); return; }
      if (cmd.op === 'cases') { await listCases(tabId, a); return; }
      const target = modTarget(cmd.name);
      if ('error' in target) { say(tabId, target.error); return; }
      const r = cmd.op === 'ban' ? await modBan(a, target, cmd.days, cmd.reason ?? '') : cmd.op === 'unban' ? await modUnban(a, target)
        : cmd.op === 'case' ? await modCase(a, target) : cmd.op === 'dismiss' ? await modDismiss(a, target) : await modStrikes(a, target);
      if (!r.ok) {
        // AUDIT SAFE CLIENT-13: a moderator is never banned - said as a ban, not as MOD1's mute
        say(tabId, cmd.op === 'ban' && r.error === 'protected' ? t('net.safety.protectedBan', 'Moderators cannot be banned.') : accountRefusalText(r.error));
        return;
      }
      const d = r.data ?? {};
      if (d.order) carry(d.order);
      if (cmd.op === 'ban') say(tabId, t('net.safety.didBan', '{name} is banned {until}.', { name: d.name, until: untilText(d.until) }));
      else if (cmd.op === 'unban') say(tabId, t('net.safety.didUnban', '{name} is unbanned.', { name: d.name }));
      else if (cmd.op === 'case') showCase(tabId, d.case);
      else if (cmd.op === 'dismiss') {
        say(tabId, `${t('net.safety.dismissed', 'The case on {name} is dismissed.', { name: d.name })}${d.order ? ` ${t('net.safety.dismissedUnmuted', 'The automatic mute it caused is lifted.')}` : ''}`);
      } else showStrikes(tabId, d);
    },
  };

  /** /strikes: the count and the next rung - AUDIT SAFE DOC-10: what stands NOW (muted until, banned until and why) - and
   *  the last acts, each in the player's language (AUDIT SAFE CLIENT-13: the kinds and the dates were the record's raw
   *  words and the browser's own date). */
  function showStrikes(tabId, d) {
    say(tabId, t('net.safety.strikes', '{name}: {strikes, plural, one {# strike} other {# strikes}} in 90 days. Next: {next}.', {
      name: d.name, strikes: d.strikes, next: d.next === 'ban' ? t('net.safety.nextBan', 'a ban') : t('net.safety.nextMute', 'a {minutes}-minute mute', { minutes: d.next }),
    }));
    const bannedNow = Number(d.bannedUntil) > 0, mutedNow = Number(d.mutedUntil) > 0;
    if (bannedNow) {
      say(tabId, typeof d.banReason === 'string' && d.banReason
        ? t('net.safety.standingBannedWhy', 'Now: banned {until}. Reason: {reason}', { until: untilText(d.bannedUntil), reason: d.banReason })
        : t('net.safety.standingBanned', 'Now: banned {until}.', { until: untilText(d.bannedUntil) }));
    }
    if (mutedNow) say(tabId, t('net.safety.standingMuted', 'Now: muted {until}.', { until: untilText(d.mutedUntil) }));
    if (!bannedNow && !mutedNow) say(tabId, t('net.safety.standingNone', 'Now: neither muted nor banned.'));
    for (const h of (Array.isArray(d.history) ? d.history : []).slice(0, 5)) {
      const row = h.by ? t('net.safety.historyBy', '- {date}: {act}, by {by}', { date: dayText(h.at), act: actText(h), by: h.by }) : t('net.safety.history', '- {date}: {act}', { date: dayText(h.at), act: actText(h) });
      say(tabId, `${row}${h.reason ? ` - ${h.reason}` : ''}${h.voided ? ` ${t('net.safety.voided', '(voided)')}` : ''}`);
    }
  }
  /** AUDIT SAFE DOC-4: /cases - the open cases, the most credible first, each with the account's id to name it by. */
  async function listCases(tabId, a) {
    const r = await modCases(a);
    if (!r.ok) { say(tabId, accountRefusalText(r.error)); return; }
    const cases = Array.isArray(r.data?.cases) ? r.data.cases : [];
    if (!cases.length) { say(tabId, t('net.safety.casesNone', 'No case is open.')); return; }
    say(tabId, t('net.safety.casesHead', '{count, plural, one {# open case} other {# open cases}}, the most credible first:', { count: cases.length }));
    for (const c of cases) {
      const row = t('net.safety.caseRow', '{name} (#{account}): {reports, plural, one {# report} other {# reports}}, {credible} credible - {reasons}.', { name: c.name, account: c.target, reports: Number(c.reports) || 0, credible: Number(c.credible) || 0, reasons: reasonsText(c.reasons) });
      const ai = verdictText(c.ai);
      say(tabId, `${row}${ai ? ` ${ai}` : ''}${c.auto ? ` ${t('net.safety.caseAuto', 'Muted automatically.')}` : ''}`);
    }
  }
  /** AUDIT SAFE DOC-4: /case <name> - the case's lines (the account's marked >, the line the reviewer flagged !), its
   *  reasons and notes, and the reviewer's verdict. */
  function showCase(tabId, c) {
    if (!c || typeof c !== 'object') return;
    say(tabId, t('net.safety.caseHead', 'The case on {name} (#{account}): {reports, plural, one {# report} other {# reports}}, {credible} credible. Why: {reasons}.', { name: c.name, account: c.target, reports: Number(c.reports) || 0, credible: Number(c.credible) || 0, reasons: reasonsText(c.reasons) }));
    for (const note of Array.isArray(c.notes) ? c.notes : []) say(tabId, t('net.safety.caseNote', 'Note: {note}', { note: String(note) }));
    const ai = verdictText(c.ai);
    if (ai) say(tabId, `${ai}${c.ai?.reason ? ` ${String(c.ai.reason)}` : ''}`);
    if (c.auto) say(tabId, t('net.safety.caseAuto', 'Muted automatically.'));
    const lines = Array.isArray(c.lines) ? c.lines : [];
    if (!lines.length) { say(tabId, t('net.safety.caseNoLines', 'No lines are kept on this case.')); return; }
    const flagged = c.ai?.line ?? null;
    for (const l of lines) {
      const mark = flagged && flagged.at === l.at && flagged.sub === l.sub ? '!' : l.sub === c.target ? '>' : '-';
      say(tabId, `${mark} ${momentText(l.at)} ${l.name}: ${l.text}`);
    }
  }
  return host;
}
