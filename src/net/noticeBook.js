// @ts-check
// ═══════════════════════════════════════════════════════════════════
// NOTICE1 (2026-09-28) — THIS DEVICE'S NOTICE BOARDS: each town's board as the account service last said it, read
// through a minute's cache (PROF0 19: "a slow service shows the last good board"), what this device has already read
// of it (the count over the board is what it has not), and a note pinned, taken down or reported. The service keeps
// every note (server-account/src/board.js); the law both ends read is src/net/boardLaw.js.
//
// ASYNC NEVER DROPS. A pin carries its own request id, kept until the service answers it; a lost answer is asked
// again with the SAME id, which the service answers with the note it already made (`repeat`), never a second one. A
// second press while one is in flight is the same press (the promise is shared). AUDIT 28 N5/N7: "until the service
// answers" means across presses - an id whose every try was lost stays with that note's words for the next press, and
// a developer's notice carries one the same way; the tries wait between them. A take-down or a remove asked again after
// a lost answer that finds the note gone was the first try's, and says so.
//
// Pure - the door, the storage and the clock are handed in - so the pins drive it without a network.
// ═══════════════════════════════════════════════════════════════════
import { BOARD_CACHE_MS, boardKeyOk, unseenCount, NOTE_ID_RE, NOTE_DAYS, noteReplySubject, GUILD_NOTES_LIVE_MAX } from './boardLaw.js';
import { accountRefusalText } from './accountClient.js';

/** A moderator's chat word (PROF0 20: "`/note remove <id>`"): `{ op: 'remove', id }`, `{ error }` in words, or null
 *  when the line is not /note. NEVER GUARDED HERE (RED1's law): whether this player may is the service's question. */
export const NOTE_USAGE = 'Usage: /note remove <note id> - the id a moderator sees on the note.';
export function parseNoteCommand(text) {
  const m = /^\/note(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const [op, id, ...more] = (m[1] ?? '').trim().split(/\s+/).filter(Boolean);
  if (String(op ?? '').toLowerCase() !== 'remove' || !id || more.length || !NOTE_ID_RE.test(id)) return { error: NOTE_USAGE };
  return { op: 'remove', id };
}

/** Where this device keeps what it has read: { [mapId]: unix seconds of the newest note seen }. */
export const NOTICE_SEEN_KEY = 'notice1.seen';
/** The towns remembered, newest first - a player who wanders the Bay does not grow the key for ever. */
export const NOTICE_SEEN_MAX = 200;
/** How many times one press asks before it gives the player the answer it has. */
export const NOTICE_TRIES = 3;
/** The answers a write is asked again after (the service did not say no): the network, the service's own fault. */
const RETRY = Object.freeze(['offline', 'server']);
/** How long each try waits before the next, ms (AUDIT 28 N5: three tries in the same millisecond were one outage). */
export const NOTICE_RETRY_MS = Object.freeze([400, 1500]);
/** AUDIT 28 N11: the answers that say the board is not open to THIS account now - it is DFU's own box again. */
const SHUT = Object.freeze(['board-closed', 'no-session', 'auth']);

/** The first words of a letter answering each button (a party's and a guild's way in is the author's invitation). */
export const NOTE_LETTER_START = Object.freeze({
  party: 'I would like to join your party.',
  guild: 'I would like to join your guild.',
  duel: 'I accept your challenge. Where shall we meet?',
});
/** What a letter that cannot open says once the minute is out (the host's pending letter). */
export const NOTE_LETTER_LOST = 'Your letters could not open. The note is still on the board.';

/**
 * AUDIT 28 N1/N16: HOW A NOTE'S BUTTON IS ANSWERED - one plan, the same shape from every exit (THE MODAL CONTRACT):
 * `{ kind: 'duel' }` where the author stands within a duel's reach, `{ kind: 'letter', draft }` for the host's pending
 * letter (the board closes first; the letters open the first frame the panel may stand - JOURNAL1's door, which a
 * direct open under the closing board never reached), or `{ kind: 'refuse', text }`.
 * @param {any} note @param {{ duelHere?: boolean, mail?: string|null, letters?: boolean, signedOutText?: string }} o
 */
export function planNoteAnswer(note, { duelHere = false, mail = null, letters = false, signedOutText = '' } = {}) {
  if (!note || typeof note.from !== 'string') return { kind: 'refuse', text: 'That note is too faded to answer.' };
  if (note.button === 'duel' && duelHere) return { kind: 'duel' };
  if (!letters || mail == null || mail === 'guest') return { kind: 'refuse', text: accountRefusalText('mail-needs-account') };
  if (mail === 'signed-out') return { kind: 'refuse', text: signedOutText || accountRefusalText('no-session') };
  return { kind: 'letter', draft: { to: note.from, subject: noteReplySubject(note.subject), body: NOTE_LETTER_START[note.button] ?? '' } };
}

/** GUILD1e: a guild board's own words for a refusal the town board's words would misname. */
export const GUILD_BOARD_WORDS = Object.freeze({
  'notes-full': `You have ${GUILD_NOTES_LIVE_MAX} notes up on your guild's board already. Take one down first.`,
  'no-note': 'That note is no longer on your guild\'s board.',
});
const guildRefusal = (e) => GUILD_BOARD_WORDS[e] ?? accountRefusalText(e);

/** A request id: `n` and fifteen of base 36, from the handed-in randomness (crypto's by default). */
export function mintNoticeRid(rand = (b) => globalThis.crypto.getRandomValues(b)) {
  const b = new Uint8Array(15);
  rand(b);
  return `n${[...b].map((x) => (x % 36).toString(36)).join('')}`;
}

/**
 * @param {{
 *   door: ReturnType<typeof import('./accountClient.js').accountBoard>,
 *   storage?: { getItem: (k: string) => (string|null), setItem: (k: string, v: string) => void }|null,
 *   nowMs?: () => number,
 *   rid?: () => string,
 *   sleep?: (ms: number) => Promise<void>,
 * }} deps `sleep` the wait between tries (a test hands in none)
 */
export function createNoticeBook({ door, storage = null, nowMs = () => Date.now(), rid = () => mintNoticeRid(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  /** mapId -> { board, at, error, pending } */
  const boards = new Map();
  /** whether the board is open to this account, as the last read said: true, false, or null not yet asked */
  let open = null;
  /** AUDIT 28 N12: the seen table, read from storage once and kept - the count over a board is asked every frame */
  let _seen = null;
  /** mapId -> { board, seen, n } - the count, recomputed only when the board or what was seen of it changes */
  const counts = new Map();

  const seenTable = () => {
    if (_seen) return _seen;
    _seen = {};
    try {
      const v = JSON.parse(storage?.getItem?.(NOTICE_SEEN_KEY) ?? 'null');
      if (v && typeof v === 'object' && !Array.isArray(v)) _seen = v;
    } catch { /* a bad key reads as none */ }
    return _seen;
  };
  const writeSeen = (t) => {
    const keep = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, NOTICE_SEEN_MAX);
    _seen = Object.fromEntries(keep);
    try { storage?.setItem?.(NOTICE_SEEN_KEY, JSON.stringify(_seen)); } catch { /* this page keeps it */ }
  };

  /** One act, asked up to NOTICE_TRIES times with a wait between. `gone`: the refusals that, after a try whose answer
   *  was lost, mean that try did it (a note already taken down) - answered as done. */
  async function ask(fn, { gone = [] } = {}) {
    let r = null, lost = false;
    for (let i = 0; i < NOTICE_TRIES; i++) {
      if (i > 0) await sleep(NOTICE_RETRY_MS[Math.min(i - 1, NOTICE_RETRY_MS.length - 1)]);
      try { r = await fn(); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok) return r;
      if (lost && gone.includes(r?.error)) return { ok: true, data: null, gone: true };
      if (!RETRY.includes(r?.error)) return r;
      lost = true;
    }
    return r;
  }

  /** The board of town `map`: the last answer inside a minute - a board or a refusal alike, so a town stood in at `dev`
   *  asks the service once a minute and not once a second - else the service's, the last good board kept when it fails. */
  function read(map, { force = false } = {}) {
    if (!boardKeyOk(map)) return Promise.resolve({ board: null, error: 'bad-board', stale: false });
    const e = boards.get(map) ?? { board: null, at: -Infinity, error: null, pending: null };
    boards.set(map, e);
    if (!force && nowMs() - e.at < BOARD_CACHE_MS) return Promise.resolve({ board: e.board, error: e.error, stale: !!(e.error && e.board) });
    // AUDIT 28 N10: a FORCED read (after a write) never takes one that set out before the write - it waits it out and asks
    if (e.pending) return force ? e.pending.then(() => read(map, { force: true })) : e.pending;
    e.pending = (async () => {
      const r = await ask(() => door.read(map));
      e.pending = null;
      if (r?.ok) {
        open = true; e.board = r.data; e.at = nowMs(); e.error = null;
        return { board: e.board, error: null, stale: false };
      }
      if (SHUT.includes(r?.error)) { open = false; e.board = null; }   // AUDIT 28 N11: not this account's now - DFU's box
      e.error = r?.error ?? 'server';
      e.at = nowMs();   // a refusal is an answer too: asked again after the minute, not on the next frame
      return { board: e.board, error: e.error, stale: !!e.board };
    })();
    return e.pending;
  }

  /**
   * SCALE4c: THE BOARD OF THE TOWN STOOD IN, AS A HEARTBEAT'S PART (net/heartbeat.js) - the read the host's frame asked
   * every second (a minute's cache, for the count that floats over the boards) carried by the tab's one heartbeat
   * instead of its own request. `townMap()` is the town the host says the player stands in, or null. Due when that
   * board's minute is up, as `read` asks it; riding a heartbeat that goes anyway when it would be due within `early` ms;
   * in flight it is the town's `pending` read, so a window's own read meanwhile waits for this answer rather than asking
   * twice; its answer taken as `read` takes its own - a refusal kept the minute too - with its minute counted from the
   * send (AUDIT SCALE B4: the heartbeat's parts count their clocks from the send, so a slow answer never pushes the
   * board's minute out of step with the box's three).
   * @param {() => (number|null)} townMap
   * @returns {import('./heartbeat.js').HeartbeatPart}
   */
  function heartbeatPart(townMap) {
    /** @type {{ map: number, e: any, settle: (v: any) => void, at: number } | null} */
    let asking = null;
    const ready = (/** @type {number} */ t, /** @type {number} */ early) => {
      if (asking) return false;
      const map = townMap();
      if (!boardKeyOk(map)) return false;
      const e = boards.get(map);
      return !e?.pending && (!e || t - e.at >= BOARD_CACHE_MS - early);
    };
    return {
      due: (t) => ready(t, 0),
      soon: (t, early) => ready(t, early),
      every: BOARD_CACHE_MS,
      body: () => {
        const map = townMap();
        if (!boardKeyOk(map)) return undefined;
        const e = boards.get(map) ?? { board: null, at: -Infinity, error: null, pending: null };
        boards.set(map, e);
        /** @type {(v: any) => void} */
        let settle = () => {};
        e.pending = new Promise((r) => { settle = r; });
        asking = { map, e, settle, at: nowMs() };
        return map;
      },
      take: (r) => {
        const a = asking;
        asking = null;
        if (!a) return;
        const { e } = a;
        e.pending = null;
        if (r?.ok) {
          open = true; e.board = r.data; e.at = a.at; e.error = null;
          a.settle({ board: e.board, error: null, stale: false });
          return;
        }
        if (SHUT.includes(r?.error)) { open = false; e.board = null; }   // AUDIT 28 N11's law, as `read` keeps it
        e.error = r?.error ?? 'server';
        e.at = a.at;
        a.settle({ board: e.board, error: e.error, stale: !!e.board });
      },
    };
  }

  /** What a read would show without asking: the cached board, or null. */
  const cached = (map) => boards.get(map)?.board ?? null;
  const forget = (map) => { const e = boards.get(map); if (e) e.at = -Infinity; };

  /** When this device last read town `map`'s board (unix seconds of its newest note then), or null. */
  const seenAt = (map) => { const v = seenTable()[String(map)]; return Number.isFinite(v) ? v : null; };
  /** The board read to its newest note: the count over it goes to nought. */
  function markSeen(map) {
    const b = cached(map);
    if (!b) return;
    const newest = Math.max(0, ...[...(b.notices ?? []), ...(b.notes ?? [])].map((x) => (Number.isFinite(x.at) ? x.at : 0)));
    const t = seenTable();
    if ((t[String(map)] ?? -1) >= newest) return;
    t[String(map)] = newest;
    writeSeen(t);
  }
  /** The count that floats over town `map`'s boards: what this device has not read - worked out again only when the
   *  board or what was seen of it changed (AUDIT 28 N12: it is asked every frame, for every board in range). */
  const unseen = (map) => {
    const b = cached(map);
    if (!b) return 0;
    const seen = seenAt(map);
    const c = counts.get(map);
    if (c && c.board === b && c.seen === seen) return c.n;
    const n = unseenCount(b, seen);
    counts.set(map, { board: b, seen, n });
    return n;
  };

  /** A write, then the board read again (the answer the window repaints from). */
  async function write(map, fn, okText, opts) {
    const r = await ask(fn, opts);
    if (r?.ok) { forget(map); await read(map, { force: true }); return { ok: true, data: r.data, text: okText }; }
    return { ok: false, error: r?.error ?? 'server', text: accountRefusalText(r?.error) };
  }

  /** AUDIT 28 N5/N7: a write that carries its own request id - the id kept with its words until the service ANSWERS
   *  (anything but a lost answer), so a press after three lost tries is the same note. Keyed by `key` + the words. */
  const kept = new Map();   // key -> { words, id, promise }
  function once(key, words, send, okText, map, after = null) {
    const w = JSON.stringify(words);
    let k = kept.get(key);
    if (k?.promise) return k.promise;
    if (!k || k.words !== w) kept.set(key, k = { words: w, id: rid(), promise: null });
    const id = k.id;
    const entry = k;
    entry.promise = (async () => {
      const r = await ask(() => send(id));
      entry.promise = null;
      if (!RETRY.includes(r?.error) && kept.get(key) === entry) kept.delete(key);   // answered: the id is spent
      if (r?.ok) {
        if (after) await after(); else { forget(map); await read(map, { force: true }); }
        return { ok: true, data: r.data, text: okText };
      }
      return { ok: false, error: r?.error ?? 'server', text: after ? guildRefusal(r?.error) : accountRefusalText(r?.error) };
    })();
    return entry.promise;
  }

  /** GUILD1e: EACH CHARACTER'S GUILD BOARD (the service's /v1/guilds/board) - the last answer inside a minute, as a
   *  town's; a refusal kept the minute too (a character in no guild asks once a minute, not every frame). */
  const guildBoards = new Map();   // character -> { data, at, error, pending }
  function readGuild(character, { force = false } = {}) {
    if (typeof character !== 'string' || !character) return Promise.resolve({ data: null, error: 'no-guild', stale: false });
    const e = guildBoards.get(character) ?? { data: null, at: -Infinity, error: null, pending: null };
    guildBoards.set(character, e);
    if (!force && nowMs() - e.at < BOARD_CACHE_MS) return Promise.resolve({ data: e.data, error: e.error, stale: !!(e.error && e.data) });
    if (e.pending) return force ? e.pending.then(() => readGuild(character, { force: true })) : e.pending;
    e.pending = (async () => {
      const r = await ask(() => door.guildRead(character));
      e.pending = null;
      e.at = nowMs();
      if (r?.ok) { e.data = r.data; e.error = null; return { data: e.data, error: null, stale: false }; }
      if (SHUT.includes(r?.error) || r?.error === 'no-guild') e.data = null;   // not this character's any more
      e.error = r?.error ?? 'server';
      return { data: e.data, error: e.error, stale: !!e.data };
    })();
    return e.pending;
  }
  const forgetGuild = (character) => { const e = guildBoards.get(character); if (e) e.at = -Infinity; };
  const guildDrafts = new Map();

  /** AUDIT 28 N13: the note being written for each town, and the developer's notice - kept for the session, so a stray
   *  tap outside the window or a second Escape throws nothing away. */
  const drafts = new Map();
  const noticeDraft = { subject: '', body: '', days: 3 };

  return {
    read, cached, markSeen, seenAt, unseen, heartbeatPart,
    /** Whether the board is open to this account, as the last read said (null before any). */
    get open() { return open; },
    /** The note being written for town `map` - the window's form writes into it. */
    draft(map) {
      let d = drafts.get(map);
      if (!d) drafts.set(map, d = { subject: '', body: '', days: NOTE_DAYS[NOTE_DAYS.length - 1], button: '' });
      return d;
    },
    /** The developer's notice being written. */
    noticeDraft: () => noticeDraft,
    /**
     * PIN A NOTE on town `map`'s board - its request id minted once and kept until the service answers it.
     * @param {number} map
     * @param {{ subject: string, body: string, days: number, button?: string|null, character?: string|null }} note
     */
    pin: (map, note) => once(`pin:${map}`, note, (id) => door.pin({ map, ...note }, id), 'Your note is pinned up.', map),
    takeDown: (map, id) => write(map, () => door.takeDown(id), 'Your note is taken down.', { gone: ['no-note'] }),
    /** The chat's `/note remove <id>`: a moderator's remove from anywhere - every cached board is read afresh after. */
    async modRemoveAnywhere(id) {
      const r = await ask(() => door.modRemove(id), { gone: ['no-note'] });
      for (const e of boards.values()) e.at = -Infinity;
      return r?.ok ? { ok: true, text: 'The note is removed.' } : { ok: false, error: r?.error ?? 'server', text: accountRefusalText(r?.error) };
    },
    report: (map, id) => write(map, () => door.report(id), 'Reported. You will not see that note again.'),
    modRemove: (map, id) => write(map, () => door.modRemove(id), 'The note is removed.', { gone: ['no-note'] }),
    modRestore: (map, id) => write(map, () => door.modRestore(id), 'The note is restored.'),
    notice: (map, n) => once('notice', n, (id) => door.notice(n, id), 'The notice is up on every board.', map),
    noticeRemove: (map, id) => write(map, () => door.noticeRemove(id), 'The notice is taken down.', { gone: ['no-notice'] }),
    /** GUILD1e: the guild's own board, as `character` is its member (read, cached, a refusal kept). */
    readGuild,
    /** GUILD1e: what a guild board read would show without asking. */
    cachedGuild: (character) => guildBoards.get(character)?.data ?? null,
    /** GUILD1e: the note being written for the guild's board - kept for the session, as a town's. */
    guildDraft(character) {
      let d = guildDrafts.get(character);
      if (!d) guildDrafts.set(character, d = { subject: '', body: '', days: NOTE_DAYS[NOTE_DAYS.length - 1] });
      return d;
    },
    /** GUILD1e: PIN A NOTE on the guild's board - its request id kept until the service answers, as a town's pin. */
    pinGuild: (character, note) => once(`gpin:${character}`, note, (id) => door.guildPin({ character, ...note }, id), 'Your note is up on the guild\'s board.', null,
      async () => { forgetGuild(character); await readGuild(character, { force: true }); }),
    /** GUILD1e: take a note down from the guild's board - one's own, or (an Officer's) anyone's. */
    async takeDownGuild(character, id) {
      const r = await ask(() => door.guildTakeDown(character, id), { gone: ['no-note'] });
      if (r?.ok) { forgetGuild(character); await readGuild(character, { force: true }); return { ok: true, text: 'The note is taken down.' }; }
      return { ok: false, error: r?.error ?? 'server', text: guildRefusal(r?.error) };
    },
    /** Test seam. */
    _entry: (map) => boards.get(map) ?? null,
  };
}
