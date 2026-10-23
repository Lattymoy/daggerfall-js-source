// MAIL1 - LETTERS (2026-09-23).
//
// Addison Knox, on Discord: "An in-game mail system where players can send messages to offline players (e.g. notes,
// contracts, invitations)."
//
// ═══ WHAT THESE PINS ARE FOR ═══════════════════════════════════════
//
// A letter is words one player leaves for another who is NOT here, so every guarantee lives in the ACCOUNT SERVICE,
// and every pin below that is about the service drives the REAL worker (server-account/src/index.js) over a real
// SQLite through the migrations the deploy applies - never a stub of it. The client's box is driven against that same
// worker through a fetch that reaches it, so "the panel shows what the service keeps" is one chain, end to end. The
// panel is driven headless over a fake document; the host by its source.
//
// The claims, in the order they are pinned:
//   - THE LAW (net/letterLaw.js): the characters are the chat's (wire.js visibleText, one law), the lines are kept,
//     a letter past its bound is refused and never cut, and a maximal letter always fits the service's body cap.
//   - WHO: registered to registered, by handle; never a guest, never oneself, never while muted.
//   - HOW MUCH: an hour's letters to anyone, and to one reader; a full box refuses the SENDER, atomically.
//   - WHOSE: a reader's letters are theirs alone - listed, opened (read once), thrown away - and `no-letter` is the
//     one word for somebody else's and for nobody's.
//   - THE BOX (net/mail.js): states, the notices, a letter opened once, a refusal given before the network, `auth`
//     forgetting the session, and the poll's cadence.
//   - THE TAB (ui/socialPanel.js): the three views, the draft that no repaint can lose, the friend's Letter button.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../server-account/src/index.js';
import { openSession } from '../../server-account/src/accounts.js';
import { sendLetter } from '../../server-account/src/letters.js';
import { ROUTES, OPEN_ROUTES, MAX_BODY_BYTES, ACCOUNT_VERSION } from '../../server-account/src/service.js';
import {
  letterWords, cleanBody, cleanSubject, LETTER_SUBJECT_MAX, LETTER_BODY_MAX, LETTER_LINES_MAX, LETTERS_INBOX_MAX,
  LETTERS_SENT_MAX, LETTERS_PAIR_MAX, LETTER_ID_RE,
} from '../../src/net/letterLaw.js';
import { visibleText, sanitizeChat, CHAT_MAX } from '../../src/net/wire.js';
import { HANDLE_MAX_LEN, REFUSALS, accountRefusalText, keepSession, SESSION_KEY } from '../../src/net/accountClient.js';
import {
  MailBox, MAIL_POLL_MS, letterHead, letterWhole, letterAgeText, replySubject, mailNoticeText,
} from '../../src/net/mail.js';
import {
  createSocialPanel, NO_LETTERS_TEXT, LETTERS_SIGNED_OUT_TEXT, LETTERS_LOOKING_TEXT,
} from '../../src/ui/socialPanel.js';
import { SocialState } from '../../src/net/social.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);

// ── THE HARNESS: the real account worker over node:sqlite ──────────────────────────────────────────────────────────

const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return api;
    },
  };
}

/** The service, a fetch that reaches it, and players made the way the service makes them (a row, a session). */
async function service({ env = {} } = {}) {
  const db = d1();
  const e = { DB: db, ...env };
  let calls = 0;
  const fetch = async (url, init = {}) => { calls++; return worker.fetch(new Request(url, init), e); };
  const nowS = Math.floor(Date.now() / 1000);
  const player = async (id, handle, { created = nowS } = {}) => {
    db._raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, handle, handle?.toLowerCase() ?? null, `Guest ${id.slice(0, 4)}`, created, created, handle ? created : null);
    const s = await openSession({ db, subtle, rand, nowS }, id);
    return { id, handle, secret: s.secret };
  };
  const call = async (who, path, body = null, method = null) => {
    const res = await fetch(`https://svc${path}`, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json() };
  };
  const send = (who, to, subject = 'A note', body = 'Meet me at the Rusty Relic.') => call(who, '/v1/mail/send', { to, subject, body });
  return { db, env: e, fetch, player, call, send, calls: () => calls };
}

/** A storage the host's own shape: getItem/setItem/removeItem. */
const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
/** A box over the real service, its io read from a store as the host reads it. */
function boxFor(svc, who, { now = () => Date.now(), onLetter = null } = {}) {
  const storage = memStore();
  if (who) keepSession(storage, { id: who.id, name: who.handle, kind: 'linked', sessionId: 's', secret: who.secret });
  const ioOf = () => {
    const raw = storage.getItem(SESSION_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s?.secret ? { fetch: svc.fetch, base: 'https://svc', secret: s.secret, storage } : null;
  };
  return { box: new MailBox({ ioOf, now, onLetter }), storage };
}

// ── THE LAW ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('MAIL1 law: a letter carries the chat\'s characters (visibleText - one law) and keeps its lines - controls, bidi overrides and zero widths gone, a mark stack cut, the emoji joiner kept; spaces folded; a run of blank lines one; none at either end; idempotent (mutants: the lines collapsed; blank runs kept; the bidi override kept)', () => {
  const raw = '\n\n  Dear Bob,\t\r\n\r\n\r\n\u202eI owe you\u200b 20 gold.  \u2028Signed\u2029\n\n\nAnn \u{1F468}\u200d\u{1F469}\u200d\u{1F467} e\u0301\u0301\u0301\u0301\u0301\n\n';
  const b = cleanBody(raw);
  assert.equal(b, 'Dear Bob,\n\nI owe you 20 gold.\nSigned\n\nAnn \u{1F468}\u200d\u{1F469}\u200d\u{1F467} e\u0301\u0301\u0301');
  assert.equal(cleanBody(b), b, 'idempotent: what the form shows after a send is what the reader gets');
  assert.equal(cleanSubject('  A\ncontract\r\nfor\u202e you  '), 'A contract for you', 'a subject is one line');
  // THE CHAT'S LAW, NOT A COPY: sanitizeChat is visibleText, folded to one line and bounded
  for (const s of [raw, 'a\u200db', '\u{1F468}\u200d\u{1F469}', 'x'.repeat(CHAT_MAX + 9), 'a\u0300\u0300\u0300\u0300b', '\ud800lone']) {
    assert.equal(sanitizeChat(s), visibleText(s).replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX).replace(/[\uD800-\uDBFF]$/, '').trim());
  }
  const wire = src('src/net/wire.js');
  assert.match(wire, /export function sanitizeChat\(text\) \{\n  let s = visibleText\(text\)\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)\.slice\(0, CHAT_MAX\);/, 'the chat line is visibleText, folded and bounded');
  // JOURNAL1 moved the letter's line law into wire.js beside visibleText (wordsLine, foldBlankLines), where the journal
  // page reads it too - one law for a player's lines, and that law is still visibleText's
  assert.match(src('src/net/letterLaw.js'), /import \{ wordsLine, foldBlankLines \} from '\.\/wire\.js';/, 'the letter reads the same law');
  // PIN MOVED (TEXT-F1): still visibleText's, its words starred (net/nameFilter.js maskText)
  assert.match(wire, /export const wordsLine = \(line\) => maskText\(visibleText\(String\(line \?\? ''\)/, 'and a line of it is visibleText\'s, its words starred');
});

test('MAIL1 law: a letter past its bound is REFUSED, never cut - one word each (the service returns them verbatim, and every one has a sentence); and the widest letter a player can type always fits the service\'s 4 KiB body (mutants: a bound off by one; a letter trimmed to fit)', () => {
  assert.deepEqual(letterWords({ subject: 'Hi', body: 'There' }), { subject: 'Hi', body: 'There' });
  assert.deepEqual(letterWords({ subject: '  ', body: 'x' }), { error: 'no-subject' });
  assert.deepEqual(letterWords({ subject: 5, body: 'x' }), { error: 'no-subject' });
  assert.deepEqual(letterWords({ subject: 's', body: '\u200b\n\n' }), { error: 'no-body' });
  assert.deepEqual(letterWords({ subject: 's', body: null }), { error: 'no-body' });
  assert.deepEqual(letterWords({ subject: 's'.repeat(LETTER_SUBJECT_MAX), body: 'b' }).subject.length, LETTER_SUBJECT_MAX);
  assert.deepEqual(letterWords({ subject: 's'.repeat(LETTER_SUBJECT_MAX + 1), body: 'b' }), { error: 'subject-long' });
  assert.equal(letterWords({ subject: 's', body: 'b'.repeat(LETTER_BODY_MAX) }).body.length, LETTER_BODY_MAX);
  assert.deepEqual(letterWords({ subject: 's', body: 'b'.repeat(LETTER_BODY_MAX + 1) }), { error: 'body-long' });
  assert.equal(letterWords({ subject: 's', body: Array(LETTER_LINES_MAX).fill('l').join('\n') }).body.split('\n').length, LETTER_LINES_MAX);
  assert.deepEqual(letterWords({ subject: 's', body: Array(LETTER_LINES_MAX + 1).fill('l').join('\n') }), { error: 'body-lines' });
  assert.equal(letterWords({ subject: 's', body: Array(LETTER_LINES_MAX + 30).fill('l').join('\n\n\n') }).error, 'body-lines', 'blank runs fold to ONE blank line, which is still a line');
  for (const w of ['no-subject', 'subject-long', 'no-body', 'body-long', 'body-lines', 'mail-needs-account', 'muted', 'no-reader', 'to-self', 'inbox-full', 'no-letter', 'mail-rate']) {
    assert.ok(w in REFUSALS && accountRefusalText(w) !== REFUSALS.server, `a sentence for ${w}`);
  }
  // THE ARITHMETIC: the widest request our form can make - every unit of the body the costliest UTF-8 a unit can be
  // (three bytes), the subject the same, the longest handle - is under MAX_BODY_BYTES, so a letter the form lets a
  // player type is never refused as 'body' by the size cap.
  const widest = JSON.stringify({ to: 'h'.repeat(HANDLE_MAX_LEN), subject: '€'.repeat(LETTER_SUBJECT_MAX), body: '€'.repeat(LETTER_BODY_MAX) });
  assert.ok(Buffer.byteLength(widest) < MAX_BODY_BYTES, `${Buffer.byteLength(widest)} bytes`);
  const quotes = JSON.stringify({ to: 'h'.repeat(HANDLE_MAX_LEN), subject: '"'.repeat(LETTER_SUBJECT_MAX), body: '"\n'.repeat(LETTER_BODY_MAX / 2) });
  assert.ok(Buffer.byteLength(quotes) < MAX_BODY_BYTES, 'and the escapes JSON adds (a quote, a newline) too');
});

// ── THE SERVICE ────────────────────────────────────────────────────────────────────────────────────────────────────

test('MAIL1 service: four routes behind a session, none open; acct6; a GUEST can neither read nor write (mail-needs-account, 403) and cannot be written to; the wrong method is refused (mutants: the wall dropped; a route opened to strangers)', async () => {
  for (const r of ['/v1/mail/inbox', '/v1/mail/send', '/v1/mail/read', '/v1/mail/delete']) { assert.ok(ROUTES.has(r), r); assert.ok(!OPEN_ROUTES.has(r)); }
  assert.equal(ACCOUNT_VERSION, 'acct176');   // PIN MOVED: acct176, STAFF-PANEL-SPEED (the staff panel pages answer in fewer database round trips: reads and the audit row folded together, two indexes; migrations 0161-0162); PIN MOVED: acct175, STAFF-PANEL5 (the staff panel relay half: follow tokens, Message on screen, the staff feeds, hidden staff, freeze and staff chat; acct174 on its branch, renumbered past STAFF-PANEL2-6 at its merge; migrations 0157-0160); PIN MOVED: acct174, STAFF-PANEL2-6 (the staff panel server side: reports and claims, Mute and Ban from the panel, notes, watchlist, settings, server notice, players, trade holds, item removals, economy, census, status tiles and Home; acct171 on its branch, then acct172, renumbered past AUDIT COLLECTIONS-II, SEA VENTURES and LOST-SPOILS at the merges; migrations 0149-0156); PIN MOVED: acct173, LOST-SPOILS (a boss's floor's leftovers to the post from the Lost and Found - /v1/post/lost; acct168 on its branch, renumbered past STAFF-PANEL1, CRAFT-PAYS, PISTOLET, AUDIT COLLECTIONS-II and SEA VENTURES at the merge; no migration); PIN MOVED: acct172, SEA VENTURES (acct168 on its branch, then acct169, renumbered past STAFF-PANEL1, CRAFT-PAYS, PISTOLET and AUDIT COLLECTIONS-II at the merges - the Eltheric Ocean ventures, one release: item law 11 and the nine records of the Eltheric Tidemail; the season boards of the sea, its bounties and the prizes of its wrecks; migrations from 0146); PIN MOVED: acct171, AUDIT COLLECTIONS-II (the glyph and icon doors answer the honours and the titles of a Charter; acct169 on its branch, renumbered past CRAFT-PAYS and PISTOLET at the merge); PIN MOVED: acct170, PISTOLET (the item law moved to 10 - the Dwarven Pistolet known to the judge, the Sunken Sovereign lawful as a gilded Pistolet and as the saber minted before; acct168 on its branch, renumbered past STAFF-PANEL1 and CRAFT-PAYS at the merge); PIN MOVED: acct169, CRAFT-PAYS and CRAFT-WRITS, one release (a Novice brew answers two potions; the crafting writs - craftWrits.js, /v1/writs/craft, migration 0145; acct168 and migration 0144 on its branch, renumbered past STAFF-PANEL1 at the merge); PIN MOVED: acct168, STAFF-PANEL1 (the staff panel sign-in - a password, a key only the Staff Panel extension holds and the role lists; staff keys, invites, sessions and an append-only audit, migration 0144); PIN MOVED: acct167, CAKE-CAP-SAID (a festival find answers the cakes found that day, and capped once they are all found; the account festival answers them too; acct166 on its branch, renumbered past ESSENCE-LOOSE and SOUL-LAW at the merge); PIN MOVED: acct166, ESSENCE-LOOSE (Arcane Essence of a piece made of loose goods is loose, never gold, and the Reforge spends it; migration 0142) and SOUL-LAW (item law 9 - a soul of the Enemy Expansion fifty lawful in a Soul Gem or Azura Star; migration 0143 lifts the holds law 8 laid on one), one release; PIN MOVED: acct165, WITCH1 (the Witches Festival - Soul Cakes, the Wyrd Sister sales, the Hearth Offerings, the profile icon) and STAR7 (the fallen stars held - /v1/star/claim, the star_spoils and stars_held of migration 0141, the star under the combat cap), one release; PIN MOVED: acct164, LEAN-READS (LEAN-WITNESS, YARD-SNAP, VENDOR-BOARD, WRIT-BOARD, ARENA-BOARD and SLOW-SHED - a hall's and a seat's late answers read no more, a town's yards, a region's traders and a season's arena board each one row, the writs by owner, a slow database shed as an overloaded one; migrations 0135-0139; acct159, acct160, acct161, acct162 then acct163 and 0133-0137 then 0134-0138 on its branch, renumbered past QL12, WB14, JUNGLE-WOODS, NAME-WORDS and PURSE-MEND at the merges); PIN MOVED: acct163, PURSE-MEND and COMPANION-DROP (staff mend a purse below nothing - realm-mend, the hold it made lifted - and a death in the zone takes the packs at the side off the record, a tab that never says it reads them refused; acct162 on its branch, renumbered past the acct162 of NAME-WORDS at the merge); PIN MOVED: acct162, NAME-WORDS (the name filter reads two more words anywhere - a handle holding either is refused; migration 0134 renames the account that held them); PIN MOVED: acct161, JUNGLE-WOODS (a jungle pixel stands 48 trees a day, every slot a tree, the service counting them as the law does; acct159 then acct160 on its branch, renumbered past QL12 and WB14 at the merges); PIN MOVED: acct160, WB14g (a kill receipt says its night portents, and a portent receipt rolls the Weir Key at the rite odds; acct159 on its branch, renumbered past the acct159 of QL12 at the merge); PIN MOVED: acct159, QL12 (the questlines claim - /v1/ql/claim, the five titles and the Covens Hoard key on the row; migration 0133; acct157 on its branch, renumbered past PLAN-1000 and FOE-BOUNDS, acct157 and acct158, at the merge); PIN MOVED: acct158, FOE-BOUNDS (cases from the relay count - records it stripped, asks past a budget; one line an account a batch; the Discord card says the spawn grants opened it); PIN MOVED: acct157, PLAN-1000 (PRIMARY-FOLD - the door reads in one statement, the spend one step over its row, a week kept, a chapter claim reads in one batch - and SESSION-SIGN, a pass on the hot routes; no migration; acct155 on its branch, renumbered past GRANT2 and TOWN-ECON TE2 at the merge); PIN MOVED: acct156, TOWN-ECON TE2 (the town economy share - /v1/towns/*, migration 0132; LAW-3 counterPaid in the item law); PIN MOVED: acct155, GRANT2 (the spawn grant measure kept - /v1/mod/grant-feed, /v1/mod/realm-grants; migration 0131); PIN MOVED: acct154, PRIVATE-REPORT (the private reports - /v1/report/*, a reader count on the post box; migration 0129 - acct152 then acct153, and 0126 then 0127, on its branch, renumbered past SAFE and INT16-INT19 at the merges); PIN MOVED: acct153, INT16-INT19 (the progression claims' seat and play line, the legacy record's law, a crafted piece out of its seller's record; migrations 0127 and 0128 - acct151 then acct152, and 0125 then 0126 and 0127, on its branch, renumbered past KEY-LAW and SAFE at the merges); PIN MOVED: acct152, SAFE (the chat safety arc and its audit - blocks, reports and cases, bans, the reviewer, Discord; migration 0126 - acct150 and 0125 on its branch, renumbered past WIKIMAID and KEY-LAW at the merge); PIN MOVED: acct151, KEY-LAW (item law 7 - the Weir Key's row known to the service's law, so a key holds no trade; migration 0125 - acct150 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: acct150, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren granted by name - titles.js WIKIMAID_HANDLES, no migration); PIN MOVED: acct149, EG-PLAY (the Elite Breach's Weir Keys, open, admission and claims, migration 0124 - 0112, 0113, 0114, 0116, 0117, 0119, 0120, 0121 then 0123 on its branch, renumbered past SEAT-FACTS' 0112, LAMP-KEEPER II's 0113, FIRMAMENT-ON's 0114, KG6's 0115, POI-1's 0116, SUMMON-REPAIR's 0117, PVP-ESCROW's 0118, SERPENT5's 0119, AUTO-HOLD's 0120, FIELD BUGS 2026-10-16b's 0121 and 0122 and MAKER-KEPT's 0123; acct119 on its branch, renumbered past GATHER-SPEED + MARKET-SPEED, D1-LOAD, BAL9, NAME-AS, HACKED-GOLD, ETHER-NODES, AUDIT ETHER-OW, MINE-PERKS, HOMES-SHED, BUSY-GATE, CRAFT-PROCS, SCHOOLS5, RECOVERY-SET, REVIVE, LAMP-KEEPER II, KG6, POI-1 and SUMMON-REPAIR + PVP-ESCROW + QUEST-HOME at the merges; acct141 at the fifth merge, renumbered past AUTO-HOLD, DECOR-BATCH, BOOKMARK-SPIRAL, BUSY-HEART and SHED-LONG at the sixth, then acct146, renumbered past STOLEN-GOODS AUDIT and REZ-BLOODLINE AUDIT R1 at the seventh, then acct148, renumbered past MAKER-KEPT at the eighth); PIN MOVED: acct148, MAKER-KEPT (item law 6 - a maker-era Aetheric piece keeps its maker's rows; migration 0123); PIN MOVED: acct147, REZ-BLOODLINE AUDIT R1 (the realm holds a Bloodline fall for a Resurrect of the party - the hold of realmDie, the new /v1/realm/raise and the rez-holds close each minute, legacy.js; migration 0121; acct141 on its branch, acct142 at the first merge, renumbered past the SHED-LONG acct145 of main at the second); PIN MOVED: acct146, STOLEN-GOODS AUDIT (a patron of a town takes no stolen piece off a hired trader - net/patronLaw.js patronTakes; no migration); PIN MOVED: acct145, SHED-LONG (BOOKMARK-SPIRAL rolled back, the shed 10 s - service.js, busyLaw.js; no migration); PIN MOVED: acct144, BUSY-HEART (the heartbeat and the motherlodes stand back while the database is overloaded - busyLaw.js; no migration); PIN MOVED: acct143, BOOKMARK-SPIRAL (the polled display reads with no bookmark off any instance, a missed session lookup asks the primary - service.js, accounts.js; no migration); PIN MOVED: acct142, DECOR-BATCH (a home room one request, a shunned home shop one more - decor.js; no migration); PIN MOVED: acct141, AUTO-HOLD (a copy locks its piece, never the character; the third law hold is timed - migration 0120; acct139 on its branch, renumbered past PRIMARY-TRIPS and AUDIT GUILD-WORDS at the merge); PIN MOVED: acct140, AUDIT GUILD-WORDS (a new membership recorded off the standing before a claim loss or after it, and every Roll answer saying what it paid of what was owed - npcRoll.js, no migration; acct139 on its branch, renumbered past PRIMARY-TRIPS acct139 at the merge); PIN MOVED: acct139, PRIMARY-TRIPS (the account primary round trips cut - the seats list, a checkpoint and a badge honours each one batch, the yards off a replica, a heartbeat reads before its beat, a hall bump off its own key rows; no migration); PIN MOVED: acct138, CART-AWAY (a wagon away from a death in the zone keeps its cargo - wild.js, no migration); PIN MOVED: acct137, SERPENT5 (Coilbreaker and The Maelstrom rolled on a dealing ship serpent kill first write - serpents.js, migration 0119; acct135 on its branch, renumbered past POI-1 acct135 and SUMMON-REPAIR acct136 of main at the merge); PIN MOVED: acct136, SUMMON-REPAIR + PVP-ESCROW + QUEST-HOME (staff mend one realm character - a FactionFile flag bit cleared and gold given back as a letter of credit, once a ticket; bible/06-Systems/Integrity-Arc.md INT6; migration 0117, 0113 on its branch and 0114 on the integration; a killer worn piece held in escrow until collected - wild_escrow and three wild routes; bible/11-Multiplayer/Wild-Zone.md section 4; migration 0118, 0113 on its branch and 0115 on the integration; the layouts read names every home by its building, so no quest picks a player home in a town never walked into; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; no migration; acct133 on each branch, one bump past LAMP-KEEPER II at the merge, acct134 on the integration, renumbered past KG6 acct134 and POI-1 acct135 at the merge of main); PIN MOVED: acct135, POI-1 + POI-4b + AUDIT POI (the POI store and the library's shelf - builders draft, an approver decides, the feed is live revisions only; bible/06-Systems/POI-Editor-Arc.md; migration 0116 - acct133, then acct134, and 0113, then 0114, on its branch, renumbered past LAMP-KEEPER II's and KG6's at the merges); PIN MOVED: acct134, KG6 (The King's Gambit's season board and its Grandmaster - gambit.js, the escrow's King's Gambit arm in cards.js; migration 0115 (0114 on its branch, renumbered past main's FIRMAMENT-ON 0114 at the merge); acct133 on its branch, renumbered past LAMP-KEEPER II's acct133 at the merge); PIN MOVED: acct133, LAMP-KEEPER II (I Love Lamp laid on the row) - before it acct132, REVIVE (a death taken back holds - putLineage takes the stored copy revived stamps into every copy sent; bible/06-Systems/Legacy-Arc.md REVIVE; no migration); PIN MOVED: acct131, RECOVERY-SET (eight recovery codes, each spent alone, and a new set from the profile behind the password and one current code - /v1/account/recovery-codes, recoveryLeft on the account view; bible/06-Systems/Accounts-And-Cloud-Saves-Arc.md RECOVERY-SET; no migration, the same column); PIN MOVED: acct130, SCHOOLS5 (the specialisation a save carries judged - a path the table holds, both its schools mastered; bible/06-Systems/Arcane-Specialisations.md section 7; no migration; acct127 on its branch, renumbered past HOMES-SHED, BUSY-GATE and CRAFT-PROCS at the merge); PIN MOVED: acct129, CRAFT-PROCS (a crafted piece record carries its mint version - stamped at the craft, kept by a temper, read by the market piece; no migration; acct126, acct127, then acct128, on its branch - renumbered past MINE-PERKS, HOMES-SHED and BUSY-GATE at the merges); PIN MOVED: acct128, BUSY-GATE (the reads busyLaw names stand back while the database is overloaded - the client holds them, the isolate sheds them a moment, every overload answer says its Retry-After; no migration); PIN MOVED: acct127, HOMES-SHED (the homes of a town and its Open Gates one request to the database where they were two; the siege blackout question answering a throw as every route does - an overload a 503; no migration); PIN MOVED: acct126, MINE-PERKS (a Surveyor's own surface veins and their gem on unwitnessed ground, the Deep Delver's x2 - bible/06-Systems/Professions-Arc.md 43; no migration); PIN MOVED: acct125, AUDIT ETHER-OW (C2-1: a Motherlode site is a pixel a Watch receipt can name - never past the Veil, where none is minted; no migration); PIN MOVED: acct124, ETHER-NODES (an Eltheric isle's node, a haul and its pixels' witnesses taken - the nodes' ground the Eltheric Ocean's box beside the Bay's map; no migration); PIN MOVED: acct123, HACKED-GOLD (a purse, a letter of credit or a coin pile past one DFU int a law finding; staff read who gained past the bucket and whom a character traded with; no migration; acct121 then acct122 on its branch, renumbered past BAL9 and NAME-AS at the merges); PIN MOVED: acct122, NAME-AS (the account name or the played realm character name as the name the room reads, chosen on the profile card, migration 0111; a letter to a friend and a board note author found by account; acct121 on its branch, renumbered past BAL9 at the merge); PIN MOVED: acct121, BAL9 (item law 3 - the potency and wellspring lines and the arcane three lawful; no migration); PIN MOVED: acct120, D1-LOAD (the seat registry read from the kept rows of the isolate by every caller, the lease read before it is written; no migration; acct119 on its branch, renumbered past GATHER-SPEED + MARKET-SPEED at the merge); PIN MOVED: acct119, GATHER-SPEED + MARKET-SPEED (a harvest's, the professions' state's and a market read's reads batched into a few round trips; the seats' places off the isolate's kept rows for a Levy, a Tithe and a board's listings; no migration; acct118 on its branch, renumbered past SEAT-LEASE at the merge); PIN MOVED: acct118, SEAT-LEASE (the Turning settled by one request at a time under a lease, migration 0110); PIN MOVED: acct117, YARD-SWEEP + HANDLE-EMAIL (the yard pieces above the height cap swept, migration 0109, and none served; a username never an email address, one chosen before read as its guest name); PIN MOVED: acct116, CRAFT-HOLD (the exploit audit: the INT3 hold follows a crafted piece, a held character with crafts at the account neither deleted nor depositing nor supplying, and the CRAFT-WORTH patron worth; no migration; acct115 on its branch, renumbered past BR5 at the merge); PIN MOVED: acct115, BR5 (the Patreon link page titled by the product name; acct113 on its branch, renumbered past GUILD-SEEN and GUILD3 at the merge); PIN MOVED: acct114, GUILD3 (the guilds made plain: the silver lines by kind and way, the whole list of holds, the Failing fall, the High Master by the band; no migration; acct112 then acct113 on its branch, renumbered past SCALE4f-h and GUILD-SEEN at the merges); PIN MOVED: acct113, GUILD-SEEN (the guild roster says when each member was last online); PIN MOVED: acct112, SCALE4f + SCALE4g + SCALE4h (acct111 on its branch, renumbered past HOME-VOTE at the merge); PIN MOVED: acct111, HOME-VOTE (a town's votes on its homes, migration 0108 - acct109, then acct110, on its branch, renumbered past PATRON-LOAD and PATRON-LOAD II at the merges); PIN MOVED: acct110, PATRON-LOAD II (the region's traders read by its own indexes - D1 overloaded; migration 0107); PIN MOVED: acct109, PATRON-LOAD (the region's traders read reckons no patrons - D1 overloaded; no migration); PIN MOVED: acct108, TECH1 (the item law's version 2 - a weapon's technique line, after LW15 took acct107; bible/05-Combat/Weapon-Techniques.md); PIN MOVED: acct107, LW15 (THE PATRONS, migration 0106 - acct105, then acct106, on its branch, renumbered past INT11-INT14 and SCALE4d at the merges); PIN MOVED: acct106, SCALE4d (the token's mint on a D1 session, no migration); PIN MOVED: acct105, INT11-INT14 (the INTEGRITY arc's lane 3, migration 0105); CHAP1-CHAP7b moved it on last (acct103: the Chapters - the Roll, the halls and their writs, the receipts, Merit, Strength, the seats, their titles and their Focus, the hall's roll, the Seasons and the patrons; migrations 0098-0103; acct93 to acct102 on their branch, renumbered past CRAFT2-CRAFT5, SD9b, SCALE4, TAVERN CARDS, SERVER-POST, PERMADEATH-HOUSES, CARDS9-CARDS10, INT1-INT6, BAG-CRAFT and UNWITNESSED-ORE at the merges); UNWITNESSED-ORE moved it on (acct102: a vein on ground no witnesses vouched for drawn to the third tier, no migration); BAG-CRAFT moved it on (acct101: a station's put-in from the pack kept loose, migration 0097_loose_origin); INT1-INT6 moved it on (acct100: every realm checkpoint judged - bible/06-Systems/Integrity-Arc.md, migration 0096_integrity); CARDS9 and CARDS10 moved it on (acct99: Iliac Hand's season board, migration 0095_iliac_ladder); PERMADEATH-HOUSES moved it on (acct98: a fallen permadeath character's home to the heir of its line); SERVER-POST and HOURS-FIRST moved it on (acct97: the server's post and Hour's First, migrations 0093 and 0094); TAVERN CARDS moved it on (acct96: a gold table's stake order, migration 0092_card_stakes); SCALE4a, SCALE4b and SCALE4c before it (acct95: a session and its player one statement, the service's own clock, one heartbeat - acct94 on their branch, renumbered past SD9b at the merge); before them SD9b (acct94: the Hours broken - /v1/sd/claim and migration 0090, Hourbreaker and The Turning Hour rolled on a Brass Remnant's kill's first write; acct91 on its branch, renumbered past main's CAP-OFF, FOUNDER5 and CRAFT2-CRAFT5 at the merges); before it CRAFT2-CRAFT5's (acct93: a first make a pattern's at a tier, five crafts of eight and 0088's merge, the temper and the Reforge with Essence and 0089's tables, a Repair Kit's quality); before it FOUNDER5's (acct92: Founder to the end of 24 September on any clock, and by name); CAP-OFF before it (acct91: a harvest refused for the day's count no more - the day's cap gone, the unvouched dungeon's four veins and the three rare hides kept); TEXT-F1 moved it on (acct90: the words a player types starred as notes, guild notes and letters are kept and read, a rank name refused for a word the filter catches, a maker mark it catches left off); STORM-SHED 2 moved it on (acct89: the arena's reads on every token - the season's #1 kept, an account's own bouts, a Grand Champion's row - and the towns' layouts read again only once a home moved, migration 0086); STORM-SHED moved it on (acct88: the second overload, 2026-10-06 - a character's harvests today read off its own rows, migration 0085; the seats' witness rows kept a minute by one isolate); LEGACY7 moved it on (acct87 - acct84 on its branch, renumbered past SERPENT-SET's acct84, YARD-SHED's acct85 and YARD-HEIGHT's acct86 at the merges: the Project Legacy lines and the tombstone, migration 0084); YARD-HEIGHT moved it on (acct86 - a yard's piece placed or moved past 4 m over the ground refused); YARD-SHED moved it on (acct85 - every town yards kept per isolate and answered before a session, the 2026-10-06 outage); SERPENT-SET and SILVER-FINDS moved it on (acct84 - acct83 on its branch, renumbered past CRYSTAL-FIST at the merge: migration 0083 - a serpent's embers on its row, which the insignia's purse counts with a breach's; a serpent's silver under the day's combat cap; a gathering's find in the harvest's batch and /v1/marks/find, a loot find); CRYSTAL-FIST moved it on (acct83: CRYSTAL_FIST_HANDLES grants the Crystal Fist's title, its glyph and the Crystal Resonance together); AUDIT ARENA-LADDER moved it on (acct82: /v1/arena/attempt and migration 0082, the ladder attempt ticket - acct79 on its branch, renumbered past GLOBAL-MARKET, SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (acct81: DEVELOPER_HANDLES grants the Seraph Wings - DEVELOPER_AURA); SHADOW-CLOAK moved it on (acct80: SHADOW_FANG_HANDLES grants the Holo Shadow Cloak with the title - acct78 on its branch, renumbered past SERPENT1 and GLOBAL-MARKET at the merges); GLOBAL-MARKET moved it on (acct79: buy orders the Bay's - the Orders view reads every board's, and a fill from another region pays its courier out of its pay; no migration); SERPENT1 moved it on (acct78: /v1/serpent/claim and the serpents slain on the cards, migration 0081 - acct75, acct76 then acct77 on its branch, renumbered past HOME-PRICE (acct75), PRIMARCH and FOUNDER4 (acct76) and KNIGHT-HOUSE (acct77) at the merges); FIELD BUGS 2026-10-04d KNIGHT-HOUSE moved it on (acct77: a deed the realm gave, held off the record - /v1/homes/deed and the release of a hold, migration 0079); PRIMARCH and FOUNDER4 moved it on (acct76: PRIMARCH_HANDLES grants the Primarch's title, glyph and aura; migration 0078 links an account to a row it shares a character with, for Founder - acct75 on its branch, which HOME-PRICE took first); HOME-PRICE moved it on (acct75: a home's price held to the online range, the town's sale refund; before it, BAG1 and GUILD2's acct74: the Materials Bag carried count and /v1/stores/deposit, migration 0076; a guild new name and its vault, /v1/guilds/rename and /v1/guilds/vault*, migration 0077); AEGIS moved it on (acct73: AEGIS_HANDLES grants the Aegis of Oblivion's title, glyph and aura); ARENA4, ARENA4b and WD3 moved it on (acct72 - acct66 on the arena branch, renumbered past PROF-541's acct70 and SILVER-WAYS' acct71 at its merges onto main: the arena records and the online homes it displaced - migrations 0074 and 0075 - and the layout a home was bought in - 0073); SILVER-WAYS and PROF2b before it (acct71: a raid's silver under the day's combat cap, guild deeds and guild contracts, the Motherlodes - migrations 0071 and 0072 - acct66 on its branch, renumbered past PROF-541's acct66-acct70 at the merge); AUDIT PROF-541 before it (acct70: the Alchemy audit's fixes, the hall door set by rank alone - hallEntry; a jewel's first craft its piece and base's; no migration); PROF12 before it (acct69: Alchemy's brew, the Apothecaries' counter, a Transmuter's transmutations, Disenchanting, the Apothecary opened; migration 0070); PROF10 before it (acct68: the jeweller's bench's pieces and the jeweller's hand, a Lapidary's cracked gem; no migration); PROF9 before it (acct67: the fire's dishes and a dish's cook's hand, migration 0069; acct67 past another branch's acct66); GUILD-YARD before it (acct65: a guild hall's outside and yard, its keepers'; no migration); AUDIT 529 before it (acct64: SIEGE-VOID's route and migration 0067, STANDING-TREND's standing rows, the void's audit); GLYPH-WEAR before it (acct63: a player shows or hides each glyph, migration 0068); WB12d moved it on (acct62: a receipt's rite and the rite's own receipt, the rows' embers - migration 0066 - main's part four and the Seats arc took acct46-acct61 first); before it SEAT2b part two moved it on (acct61: the works at peace); AUDIT-SEATS, PROF11 and SEAT2b before it (acct60: the audit, Masonry and the works - the Seats arc's fourteen renumbered past main's PATREON-LINK and part four (acct45, acct46) at the merge); SEASON1 part three before it (acct59: the Hall of Records); SEASON1 part two, the banner ribbon before it (acct58: the banner ribbon); SEASON1 part two, the client's before it (acct57: the Orc Raids and the stormy sea); SEASON1 part two, the economy before it (acct56: the economy's Tides); SEASON1 part two before it (acct55: the Tides); SEASON1 part one before it (acct54: the Seasons); CROWN2 before it (acct53: fealty and Pacts); CROWN1 part two before it (acct52: the Royal Tourney); CROWN1 before it (acct51: the crown Edicts); SEAT2a part three before it (acct50: the siege's pass and result); SEAT2a before it (acct49: the battles' week - the holder's window, the schedule, the sides and their Sellswords; migration 0052); SEAT1d before it (acct48: holding a seat - the upkeep, the Tithe, the Edicts; migration 0051); GUILD1d, GUILD1e and SEAT1a before it (acct47: the guild hall, its heraldry, the guild's own board and the seats' registry - migrations 0046, 0047 and 0048; acct42, then acct43, then acct44, then acct45, on their branch, renumbered past main's REALM-GZIP, SCALE1, MARKET-ANY and PATREON-LINK at the merges); FIELD BUGS 2026-10-01 part four before it (acct46: ANY-HOUR and HERB-XP - no hour refused, a herb at the rank's tier; acct45 on its branch, past PATREON-LINK at the merge); PATREON-LINK before it (acct45: a patron's own Patreon linked, its tier's title held by the pledge - migration 0045); MARKET-ANY before it (acct44: FIELD BUGS 2026-10-01 - a piece from the pack listed for gold, migration 0044); SCALE1 before it (acct43: the scaling audit's service half - metrics, indexes, fewer writes); REALM-GZIP before it (acct42: a realm save rides gzipped); PROF8 before it (acct41: Fishing with the net - migration 0042); GOLD-MARKET before it (acct40: the market in gold or Drakes - migration 0041); PINE-SHARE before it (acct39: Pine in every forest); WB9g before it (acct38: the Broker's insignia - a title and an aura bought, recorded on the row (0040) and paid for by the account's closed gates; the aura worn and signed (`au`)); HOUSING before it (acct37: HOME-RENT's rooms, HOME-LOOK's outside, HOME-YARD's yards - migrations 0037-0039); the PROF7 merge before it (acct36: past main's FIELD BUGS 2026-09-30, acct33, and the branch's acct33-acct35 never deployed); AUDIT 32 S1 before it (acct35: the Weavers' cloth alone lays on no first-craft XP); AUDIT 32 before it (acct34); PROF7 before it (acct33: Hunting, the Skinning Knife and Outfitting); PROF-DELETE before it (acct32: a deleted character's professions go with it); before it RENOWN-CHAR moved it on (acct31: Renown a character's again, migration 0035); before it MERGE 2 moved it on (acct30: the professions branch - Marks, the Notice Board, the professions, the market and its auctions, the guild writs - acct22 to acct29 on its branch, never deployed, its migrations 0025-0034 behind main's 0018-0024); before it HOUSE-LOSS and RESTORE moved it on (acct23 - acct20, then acct21 and acct22, on their branch, which TERMS1, PENITENT and REALM-DOOR took first); before it REALM-DOOR and CUSTOMS-PASS moved it on (acct22: the mint signs whether the named character is the realm's, and a developer's customs pass); before it PENITENT's title and glyph and a fifth Disciple (acct21); before it TERMS1's agreement moved it on (acct20 - acct17, then acct19, on its branch, never deployed, renumbered past RAID4, AUDIT RAID and THE MERGE's REALM at the merges); before it THE MERGE moved it on (acct19: REALM P1-P2.2b and AUDIT REALM - acct17 on its branch, never deployed, renumbered past RAID4 (acct17) and AUDIT RAID (acct18); its migrations 0016-0018 are 0018-0020); AUDIT RAID before it (acct18: a town's thanks once a raid and account, a raid's Renown the hour's); before it RAID4 (acct17: the towns defended - a raid's receipt counted and paid in Renown); before it HOME-STATIONS (acct16 - acct15 on its branch, renumbered past FOUNDER3 at the merge: a decor place's station); FOUNDER3's first contact moved it on (acct15); SHADOW-FANG's title and glyph moved it on (acct14 - acct12 on its branch); RENOWN4's total in the mint's answer and GUILD1c's guild on the token and its orders moved it on (acct13 - acct11, then acct12, on their branch; main's WB5b took acct11 first and BASE-HIDE acct12); BASE-HIDE's taken-out furniture moved it on (acct12); acct6 was MAIL1's letters; TITLE-N's Dungeon Master and Patreon tiers moved it on (acct7); DUEL1's duelling record (acct8), FOUNDER2's cutoff again (acct9); RENOWN1's Renown, HOME1's homes, DECOR1's decor and GUILD1's guilds (acct10); WB5b's gates closed (acct11 - acct10 on its branch)
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const guest = await svc.player('p_gst_0000000001', null);
  for (const [path, body] of [['/v1/mail/inbox', null], ['/v1/mail/send', { to: 'Ann', subject: 's', body: 'b' }], ['/v1/mail/read', { id: 'x'.repeat(24) }], ['/v1/mail/delete', { id: 'x'.repeat(24) }]]) {
    const r = await svc.call(guest, path, body);
    assert.deepEqual([r.status, r.data], [403, { error: 'mail-needs-account' }], path);
  }
  assert.deepEqual((await svc.send(ann, 'Guest p_gs')).data, { error: 'no-reader' }, 'a guest\'s generated name is not an address');
  assert.equal((await svc.call(ann, '/v1/mail/inbox', { x: 1 })).status, 405, 'the box is a GET');
  // ...and the function asks again: a wall its caller forgot is not a wall it lacks
  const guestRow = svc.db._raw.prepare('SELECT * FROM players WHERE id = ?').get(guest.id);
  assert.deepEqual(await sendLetter({ db: svc.db, rand, nowS: Math.floor(Date.now() / 1000) }, { ...guestRow }, { to: 'Ann', subject: 's', body: 'b' }), { error: 'mail-needs-account' });
  assert.equal((await svc.call(ann, '/v1/mail/send', null, 'GET')).status, 405);
  const noAuth = await svc.fetch('https://svc/v1/mail/inbox');
  assert.equal(noAuth.status, 401);
});

test('MAIL1 service: a letter goes registered to registered BY HANDLE (any case), cleaned, from the sender\'s own name - and lands in the reader\'s box as a head (no body), newest first, unread, with the sender\'s badge as the service would sign it now (mutants: the name taken from the frame; the body in the list; the order)', async () => {
  const svc = await service({ env: { DEVELOPER_HANDLES: 'Ann' } });
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  const old = await svc.player('p_cid_0000000001', 'Cid', { created: Math.floor(Date.now() / 1000) - 40 * 86400 });
  const r1 = await svc.call(ann, '/v1/mail/send', { to: 'bOB', subject: '  A\u202e contract ', body: 'Line one\n\n\n\nLine two', from: 'Mallory' });
  assert.equal(r1.status, 200);
  assert.equal(r1.data.to, 'Bob', 'the reader\'s handle as THEY spell it');
  assert.match(r1.data.id, LETTER_ID_RE);
  // a later second - newest first is by the SERVICE's clock, so the service's clock is moved rather than waited for
  const realNow = Date.now;
  Date.now = () => realNow() + 5000;
  try { assert.equal((await svc.send(old, 'Bob', 'Later', 'Second letter')).status, 200); } finally { Date.now = realNow; }
  const box = await svc.call(bob, '/v1/mail/inbox');
  assert.equal(box.status, 200);
  assert.equal(box.data.unread, 2);
  assert.equal(box.data.max, LETTERS_INBOX_MAX);
  assert.deepEqual(box.data.letters.map((l) => l.subject), ['Later', 'A contract'], 'newest first');
  const [later, first] = box.data.letters;
  assert.equal(first.from, 'Ann', 'the SENDER\'s own name - a `from` in the body is read by nobody');
  assert.deepEqual(first.glyphs, ['sprout', 'dev'], 'the badge as a token would carry it: a new account\'s sprout, the developer list\'s mark');
  assert.deepEqual(later.glyphs, [], 'an account past its fortnight wears no sprout');
  assert.equal(first.read, false);
  assert.equal('body' in first, false, 'a head, never a body');
  const row = svc.db._raw.prepare('SELECT * FROM letters WHERE id = ?').get(r1.data.id);
  assert.equal(row.body, 'Line one\n\nLine two', 'kept as cleaned');
  assert.equal(row.from_name, 'Ann');
  assert.deepEqual((await svc.call(ann, '/v1/mail/inbox')).data.letters, [], 'the sender\'s own box holds nothing of it');
});

test('MAIL1 service: the refusals - nobody by that name, oneself, a mute (403), each word of the law (400) - and none of them writes a letter (mutants: a muted sender heard; a letter to oneself kept)', async () => {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  await svc.player('p_bob_0000000001', 'Bob');
  const cases = [
    [{ to: 'Zed', subject: 's', body: 'b' }, 404, 'no-reader'],
    [{ to: 'no spaces allowed', subject: 's', body: 'b' }, 404, 'no-reader'],   // not a handle's shape: refused before any rate is spent (below)
    [{ to: 'ann', subject: 's', body: 'b' }, 400, 'to-self'],
    [{ to: 'Bob', subject: '', body: 'b' }, 400, 'no-subject'],
    [{ to: 'Bob', subject: 's'.repeat(LETTER_SUBJECT_MAX + 1), body: 'b' }, 400, 'subject-long'],
    [{ to: 'Bob', subject: 's', body: '' }, 400, 'no-body'],
    [{ to: 'Bob', subject: 's', body: 'b'.repeat(LETTER_BODY_MAX + 1) }, 400, 'body-long'],
  ];
  for (const [body, status, error] of cases) {
    const r = await svc.call(ann, '/v1/mail/send', body);
    assert.deepEqual([r.status, r.data], [status, { error }], error);
  }
  assert.equal(svc.db._raw.prepare("SELECT count FROM rate_limits WHERE key = 'mail:p_ann_0000000001'").get().count, 2, 'the sender\'s rate spent on the two that reached a lookup (Zed, and herself) - not on a shape no handle has, nor on words the law refused');
  svc.db._raw.prepare('UPDATE players SET muted_until = ? WHERE id = ?').run(Math.floor(Date.now() / 1000) + 600, 'p_ann_0000000001');
  assert.deepEqual((await svc.send(ann, 'Bob')).data, { error: 'muted' });
  assert.equal((await svc.send(ann, 'Bob')).status, 403);
  assert.equal(svc.db._raw.prepare('SELECT COUNT(*) AS n FROM letters').get().n, 0, 'not one letter written');
  svc.db._raw.prepare('UPDATE players SET muted_until = ? WHERE id = ?').run(Math.floor(Date.now() / 1000) - 1, 'p_ann_0000000001');
  assert.equal((await svc.send(ann, 'Bob')).status, 200, 'a mute that has ended stops nothing');
});

test('MAIL1 service: an hour\'s letters - LETTERS_PAIR_MAX to one reader, LETTERS_SENT_MAX to anyone, `mail-rate` (429) past either; the sender\'s rate is spent BEFORE the reader is looked up, so the lookup cannot be ground (mutants: the pair rate dropped; the sender rate dropped; the lookup first)', async () => {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const readers = [];
  for (let i = 0; i < 6; i++) readers.push(await svc.player(`p_r${i}_000000000${i}`, `Reader${i}`));
  for (let k = 0; k < LETTERS_PAIR_MAX; k++) assert.equal((await svc.send(ann, 'Reader0')).status, 200);
  assert.deepEqual((await svc.send(ann, 'Reader0')).data, { error: 'mail-rate' }, 'one reader\'s share spent');
  assert.equal((await svc.send(ann, 'Reader1')).status, 200, 'another reader is another pair');
  let sent = LETTERS_PAIR_MAX + 1, n = 1;
  for (let i = 1; sent < LETTERS_SENT_MAX; i = (i % 5) + 1) { if ((await svc.send(ann, `Reader${i}`)).status === 200) sent++; if (++n > 60) break; }
  const past = await svc.send(ann, 'Reader5');
  assert.deepEqual([past.status, past.data], [429, { error: 'mail-rate' }], 'an hour\'s letters to anyone');
  // the sender's rate is spent on a lookup that finds nobody, too - a handle cannot be probed for free
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  for (let k = 0; k < LETTERS_SENT_MAX; k++) await svc.send(bob, `Nobody${k}`);
  assert.deepEqual((await svc.send(bob, 'Reader0')).data, { error: 'mail-rate' });
  const code = src('server-account/src/letters.js');
  assert.ok(code.indexOf('`mail:${sender.id}`') < code.indexOf("SELECT id, handle FROM players WHERE handle_lc = ?"), 'the rate before the lookup');
});

test('MAIL1 service: a FULL box refuses the sender (inbox-full, 409) and keeps every letter the reader has - its oldest is never thrown away for a stranger\'s newest - and two letters racing for the last place land ONE (mutants: the bound dropped; the check apart from the write)', async () => {
  const svc = await service();
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  const senders = [];
  for (let i = 0; i < 3; i++) senders.push(await svc.player(`p_s${i}_000000000${i}`, `Sender${i}`));
  const ins = svc.db._raw.prepare('INSERT INTO letters (id, to_id, from_id, from_name, subject, body, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < LETTERS_INBOX_MAX - 1; i++) ins.run(`seed${String(i).padStart(20, '0')}`, bob.id, 'p_x', 'Someone', `Old ${i}`, 'b', 1000 + i);
  // two at once for the last place: the bound is IN the write, so exactly one lands
  const [a, b] = await Promise.all([svc.send(senders[0], 'Bob'), svc.send(senders[1], 'Bob')]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409], 'one landed, one was told the box is full');
  assert.equal(svc.db._raw.prepare('SELECT COUNT(*) AS n FROM letters WHERE to_id = ?').get(bob.id).n, LETTERS_INBOX_MAX);
  const full = await svc.send(senders[2], 'Bob');
  assert.deepEqual([full.status, full.data], [409, { error: 'inbox-full' }]);
  assert.ok(svc.db._raw.prepare("SELECT 1 FROM letters WHERE id = 'seed00000000000000000000'").get(), 'the oldest letter is still the reader\'s');
  assert.match(src('server-account/src/letters.js'), /SELECT \?, \?, \?, \?, \?, \?, \? WHERE \(SELECT COUNT\(\*\) FROM letters WHERE to_id = \?\) < \?/, 'one statement');
});

test('MAIL1 service: a reader\'s letters are theirs alone - opened (the whole letter, read ONCE: the first opening\'s time kept), thrown away, and `no-letter` (404) for another\'s letter exactly as for none; and a reader who is gone takes their letters with them (mutants: the reader not in the WHERE; the read time rewritten; the cascade)', async () => {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  const { data: { id } } = await svc.send(ann, 'Bob', 'Terms', 'Twenty gold, paid at the Rusty Relic.');
  for (const who of [ann, bob]) {
    const peek = await svc.call(who, '/v1/mail/read', { id: who === bob ? 'y'.repeat(24) : id });
    assert.deepEqual([peek.status, peek.data], [404, { error: 'no-letter' }], 'somebody else\'s, and nobody\'s: one word');
  }
  assert.deepEqual((await svc.call(bob, '/v1/mail/read', { id: '../etc' })).data, { error: 'no-letter' });
  const r = await svc.call(bob, '/v1/mail/read', { id });
  assert.equal(r.status, 200);
  assert.deepEqual({ ...r.data.letter, sentAt: 0, readAt: 0 }, { id, from: 'Ann', title: null, glyphs: ['sprout'], subject: 'Terms', body: 'Twenty gold, paid at the Rusty Relic.', sentAt: 0, readAt: 0 });
  const readAt = svc.db._raw.prepare('SELECT read_at FROM letters WHERE id = ?').get(id).read_at;
  assert.ok(readAt > 0);
  svc.db._raw.prepare('UPDATE letters SET read_at = 5 WHERE id = ?').run(id);
  assert.equal((await svc.call(bob, '/v1/mail/read', { id })).data.letter.readAt, 5, 'read ONCE: a second opening is not news');
  assert.deepEqual((await svc.call(bob, '/v1/mail/inbox')).data.unread, 0);
  assert.deepEqual((await svc.call(ann, '/v1/mail/delete', { id })).data, { error: 'no-letter' }, 'the sender cannot take it back');
  assert.deepEqual((await svc.call(bob, '/v1/mail/delete', { id })).data, { ok: true, id });
  assert.deepEqual((await svc.call(bob, '/v1/mail/delete', { id })).data, { error: 'no-letter' }, 'gone is gone');
  // the cascade: a reader's row taken away takes the reader's box; a sender's does not take what they sent
  const second = (await svc.send(ann, 'Bob', 'Again', 'Still here?')).data.id;
  svc.db._raw.prepare('DELETE FROM sessions WHERE player_id = ?').run(ann.id);
  svc.db._raw.prepare('DELETE FROM players WHERE id = ?').run(ann.id);
  const kept = (await svc.call(bob, '/v1/mail/inbox')).data.letters;
  assert.deepEqual(kept.map((l) => [l.id, l.from, l.glyphs]), [[second, 'Ann', []]], 'a sender who is gone: their letter stands, by the name it was sent under, with no badge');
  svc.db._raw.prepare('DELETE FROM sessions WHERE player_id = ?').run(bob.id);
  svc.db._raw.prepare('DELETE FROM players WHERE id = ?').run(bob.id);
  assert.equal(svc.db._raw.prepare('SELECT COUNT(*) AS n FROM letters').get().n, 0, 'and a reader who is gone takes the box');
});

// ── THE BOX ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('MAIL1 box: its states over the real service - signed out (no call made), a guest, ready - and `auth` forgets the session the service stopped honouring (mutants: a call with no session; auth kept)', async () => {
  const svc = await service();
  const { box: none } = boxFor(svc, null);
  await none.refresh();
  assert.equal(none.state, 'signed-out');
  assert.equal(svc.calls(), 0, 'no session, no call');
  const guest = await svc.player('p_gst_0000000001', null);
  const { box: g } = boxFor(svc, guest);
  await g.refresh();
  assert.deepEqual([g.state, g.error], ['guest', 'mail-needs-account']);
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  const { box, storage } = boxFor(svc, bob);
  await box.refresh();
  assert.deepEqual([box.state, box.letters, box.unread, box.max], ['ready', [], 0, LETTERS_INBOX_MAX]);
  svc.db._raw.prepare('DELETE FROM sessions WHERE player_id = ?').run(bob.id);
  await box.refresh();
  assert.equal(box.state, 'signed-out');
  assert.equal(storage.getItem(SESSION_KEY), null, 'a secret the far end stopped honouring is not a session');
});

test('MAIL1 box: a look that finds letters says so ONCE - "waiting" on the first look of a sitting, "new" for each letter after it that was not there - and opening one reads it once (the service marks it; the box keeps its copy; the badge falls) (mutants: every look announces; a letter re-fetched)', async () => {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  await svc.send(ann, 'Bob', 'First', 'One');
  const heard = [];
  const { box } = boxFor(svc, bob, { onLetter: (e) => heard.push(e) });
  await box.refresh();
  assert.deepEqual(heard.map((e) => e.kind), ['waiting']);
  assert.equal(heard[0].count, 1);
  assert.equal(mailNoticeText(heard[0]), 'You have 1 unread letter. Open Social, then Letters.');
  await box.refresh();
  assert.equal(heard.length, 1, 'the same box again is not news');
  await svc.send(ann, 'Bob', 'Second', 'Two');
  await box.refresh();
  assert.equal(heard.length, 2);
  assert.equal(heard[1].kind, 'new');
  assert.equal(mailNoticeText(heard[1]), 'A letter from Ann: "Second". Open Social, then Letters.');
  const v = box.version;
  const id = box.letters.find((l) => l.subject === 'Second').id;   // one second can hold both: find it by what it says
  const before = svc.calls();
  const r = await box.open(id);
  assert.equal(r.ok, true);
  assert.equal(r.letter.body, 'Two');
  assert.equal(box.unread, 1);
  assert.ok(box.version > v);
  await box.open(id);
  assert.equal(svc.calls(), before + 1, 'opened twice, fetched once');
  await box.refresh();
  assert.equal(box.letters.find((l) => l.id === id).read, true, 'and the service agrees it was read');
});

test('MAIL1 box: a send is checked by the letter\'s own law BEFORE the network (no call for a letter the service would refuse), the service\'s refusal is passed on, and a letter thrown away leaves the box - also when it was already gone (mutants: the local check dropped; a stale letter kept)', async () => {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  await svc.player('p_bob_0000000001', 'Bob');
  const { box } = boxFor(svc, ann);
  const n = svc.calls();
  assert.deepEqual(await box.send({ to: 'Bob', subject: '', body: 'b' }), { ok: false, error: 'no-subject' });
  assert.deepEqual(await box.send({ to: 'not a handle', subject: 's', body: 'b' }), { ok: false, error: 'no-reader' });
  assert.deepEqual(await box.send({ to: 'Bob', subject: 's', body: 'b'.repeat(LETTER_BODY_MAX + 1) }), { ok: false, error: 'body-long' });
  assert.equal(svc.calls(), n, 'not one call');
  assert.deepEqual(await box.send({ to: 'Zed', subject: 's', body: 'b' }), { ok: false, error: 'no-reader' }, 'the service\'s own word');
  assert.deepEqual(await box.send({ to: ' bob ', subject: ' Terms ', body: 'b' }), { ok: true, to: 'Bob' });
  const bobSession = await openSession({ db: svc.db, subtle, rand, nowS: Math.floor(Date.now() / 1000) }, 'p_bob_0000000001');
  const { box: bobBox } = boxFor(svc, { id: 'p_bob_0000000001', handle: 'Bob', secret: bobSession.secret });
  await bobBox.refresh();
  const id = bobBox.letters[0].id;
  svc.db._raw.prepare('DELETE FROM letters WHERE id = ?').run(id);   // thrown away on another device
  assert.deepEqual(await bobBox.remove(id), { ok: true });
  assert.deepEqual(bobBox.letters, []);
});

test('MAIL1 box: what the service says is checked before it is kept - a head that is not a letter\'s shape is dropped; the ages read like the friends list; a reply\'s subject is "Re:" once; the poll is due every MAIL_POLL_MS and a signed-out look is stamped, so no frame reads the store twice (mutants: an id unchecked; Re: stacked; the stamp after the session check)', async () => {
  const good = { id: 'a'.repeat(24), from: 'Ann', title: null, glyphs: ['sprout', 7], subject: 'Hi', sentAt: 1_800_000_000, read: false };
  assert.deepEqual(letterHead(good), { ...good, glyphs: ['sprout'] });
  for (const bad of [null, { ...good, id: '<img>' }, { ...good, from: 5 }, { ...good, subject: 's'.repeat(LETTER_SUBJECT_MAX + 1) }, { ...good, sentAt: 'soon' }]) assert.equal(letterHead(bad), null);
  assert.equal(letterWhole({ ...good, body: 'x'.repeat(LETTER_BODY_MAX + 1) }), null);
  assert.equal(letterWhole({ ...good, body: 'ok' }).read, true);
  const at = 1_800_000_000;
  assert.deepEqual([30, 5 * 60, 3 * 3600, 30 * 3600, 5 * 86400, 20 * 86400, 400 * 86400].map((s) => letterAgeText(at, (at + s) * 1000)),
    ['just now', '5 min ago', '3 h ago', 'yesterday', '5 days ago', '2 weeks ago', 'long ago']);
  assert.equal(replySubject('Re: RE: re:A deal'), 'Re: A deal');
  assert.equal(replySubject('x'.repeat(LETTER_SUBJECT_MAX)).length, LETTER_SUBJECT_MAX);
  let t = 1000, reads = 0;
  const box = new MailBox({ ioOf: () => { reads++; return null; }, now: () => t });
  assert.equal(box.due(), true);
  await box.refresh();
  assert.equal(box.due(), false, 'a look with no session is still a look');
  for (let f = 0; f < 60; f++) { t += 16; box.poll(); }
  assert.equal(reads, 1, 'sixty frames, one read of the store');
  t += MAIL_POLL_MS;
  assert.equal(box.due(), true);
});

// ── THE TAB ────────────────────────────────────────────────────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false,
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { n.focused = true; doc.activeElement = n; },
    remove() { n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const fakeWin = () => ({ addEventListener() {}, removeEventListener() {} });
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
const button = (root, label) => find(root, 'dfsocial-btn').find((b) => b.textContent === label);

async function tabRig({ signedIn = true, handle = 'Bob' } = {}) {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const bob = handle ? await svc.player('p_bob_0000000001', handle) : await svc.player('p_bob_0000000001', null);
  const { box } = boxFor(svc, signedIn ? bob : null);
  // WAIT ON THE WORK, NOT ON THE CLOCK. The service resolves a session through crypto.subtle, which finishes on the
  // thread pool and not in a countable number of turns - so every call the box makes is tracked, and a frame waits for
  // all of them (and the panel's own `.then`s, attached first, run first).
  const pending = new Set();
  for (const k of ['refresh', 'open', 'send', 'remove']) {
    const f = box[k].bind(box);
    box[k] = (...a) => { const p = f(...a); pending.add(p); p.finally(() => pending.delete(p)); return p; };
  }
  const settle = async () => { while (pending.size) await Promise.allSettled([...pending]); await new Promise((r) => setImmediate(r)); };
  const social = new SocialState({ acct: 'acct-bob-1' });
  const doc = fakeDocument();
  const panel = createSocialPanel({ social, mail: box, doc, win: fakeWin(), overlay: () => false, touch: false });
  const frame = async () => { await settle(); panel.render(); };
  return { svc, ann, bob, box, social, panel, doc, frame };
}

test('MAIL1 tab: a third tab only where the host hands a letterbox; its badge is the unread count; the box, newest first, a brass dot on the unopened, the fill beside its name - and the sentences for a box nobody can have yet (mutants: the tab always drawn; the badge not the box\'s)', async () => {
  const bare = createSocialPanel({ social: new SocialState({ acct: 'a' }), doc: fakeDocument(), win: fakeWin(), overlay: () => false, touch: false });
  assert.deepEqual(find(bare.root, 'dfsocial-tab').map((t) => t.dataset.tab), ['friends', 'party'], 'no box, no tab');
  const { svc, ann, panel, frame } = await tabRig();
  assert.deepEqual(find(panel.root, 'dfsocial-tab').map((t) => t.dataset.tab), ['friends', 'party', 'letters']);
  await svc.send(ann, 'Bob', 'A contract', 'Terms');
  assert.equal(panel.openLetters(), true);
  assert.equal(panel.tab(), 'letters');
  await frame(); await frame();
  const tab = find(panel.root, 'dfsocial-tab').find((t) => t.dataset.tab === 'letters');
  assert.equal(one(tab, 'dfsocial-badge').textContent, '1', 'the unread count');
  const rows = find(panel.root, 'dfsocial-letter');
  assert.equal(rows.length, 1);
  assert.ok(one(rows[0], 'unread'), 'the brass dot');
  assert.deepEqual(texts(rows[0]), ['Ann', 'A contract', 'just now'], 'who, what about, how long ago');
  assert.ok(texts(panel.root).includes(`Letters (1/${LETTERS_INBOX_MAX})`), 'the fill');
  const out = await tabRig({ signedIn: false });
  out.panel.openLetters(); await out.frame(); await out.frame();
  assert.ok(texts(out.panel.root).includes(LETTERS_SIGNED_OUT_TEXT));
  const guest = await tabRig({ handle: null });
  guest.panel.openLetters(); await guest.frame(); await guest.frame();
  assert.ok(texts(guest.panel.root).includes(REFUSALS['mail-needs-account']));
  const empty = await tabRig();
  empty.panel.openLetters(); empty.panel.render();
  assert.ok(texts(empty.panel.root).includes(LETTERS_LOOKING_TEXT), 'before the first look lands');
  await empty.frame(); await empty.frame();
  assert.ok(texts(empty.panel.root).includes(NO_LETTERS_TEXT));
});

test('MAIL1 tab: a row opens the letter - its words as TEXT, its lines kept - and it is read now; Reply writes back to the handle it came from with "Re:"; Delete arms, and the second press throws it away (mutants: Delete on one press; the reply to the wrong name)', async () => {
  const { svc, ann, box, panel, frame } = await tabRig();
  await svc.send(ann, 'Bob', 'Terms', 'Twenty gold.\n\n<b>Paid</b> at the Relic.');
  panel.openLetters(); await frame(); await frame();
  one(panel.root, 'dfsocial-letter').fire('click');
  await frame(); await frame();
  assert.equal(panel.lettersView(), 'read');
  assert.equal(one(panel.root, 'dfsocial-subject').textContent, 'Terms');
  assert.equal(one(panel.root, 'dfsocial-lettertext').textContent, 'Twenty gold.\n\n<b>Paid</b> at the Relic.', 'text, never markup - and its lines');
  assert.equal(box.unread, 0);
  button(panel.root, 'Reply').fire('click');
  panel.render();
  assert.equal(panel.lettersView(), 'write');
  const [to, subject] = find(panel.root, 'dfsocial-field');
  assert.deepEqual([to.value, subject.value], ['Ann', 'Re: Terms']);
  button(panel.root, 'Cancel').fire('click');
  one(panel.root, 'dfsocial-letter').fire('click');
  await frame(); await frame();
  button(panel.root, 'Delete').fire('click');
  panel.render();
  assert.equal(box.letters.length, 1, 'one press only arms it');
  button(panel.root, 'Sure?').fire('click');
  await frame(); await frame();
  assert.deepEqual(box.letters, []);
  assert.equal(panel.lettersView(), 'list');
  assert.equal(svc.db._raw.prepare('SELECT COUNT(*) AS n FROM letters').get().n, 0);
});

test('MAIL1 tab: THE FORM - its caps are the service\'s bounds; what is typed is kept on every keystroke and NO repaint rebuilds it (a presence frame, a look landing); Send carries the draft, a refusal is said in the service\'s words and the draft stays, a letter sent says so and clears it (mutants: the form rebuilt by a frame; the draft lost on a refusal)', async () => {
  const { svc, ann, box, social, panel, frame } = await tabRig();
  panel.openLetters({ to: 'Ann' });
  panel.render();
  assert.equal(panel.lettersView(), 'write');
  const [to, subject, body] = find(panel.root, 'dfsocial-field');
  assert.deepEqual([to.maxLength, subject.maxLength, body.maxLength], [HANDLE_MAX_LEN, LETTER_SUBJECT_MAX, LETTER_BODY_MAX]);
  assert.equal(to.value, 'Ann');
  subject.value = 'Terms'; subject.fire('input');
  body.value = 'x'.repeat(10); body.fire('input');
  assert.equal(one(panel.root, 'dfsocial-count').textContent, `10/${LETTER_BODY_MAX}`);
  // a presence frame and a look landing: the SAME nodes stand
  social.version++; box.version++;
  panel.render();
  assert.equal(find(panel.root, 'dfsocial-field')[2], body, 'not rebuilt under the caret');
  to.value = 'Zed'; to.fire('input');
  button(panel.root, 'Send').fire('click');
  await frame(); await frame();
  assert.ok(texts(panel.root).includes(REFUSALS['no-reader']), 'the service\'s own sentence');
  assert.deepEqual(find(panel.root, 'dfsocial-field').map((f) => f.value), ['Zed', 'Terms', 'x'.repeat(10)], 'and the draft stands');
  const [to2] = find(panel.root, 'dfsocial-field');
  to2.value = 'Ann'; to2.fire('input');
  button(panel.root, 'Send').fire('click');
  await frame(); await frame();
  assert.equal(panel.lettersView(), 'list');
  assert.ok(texts(panel.root).includes('Your letter to Ann is on its way.'));
  const kept = svc.db._raw.prepare('SELECT subject, body, from_name FROM letters').get();
  assert.deepEqual({ ...kept }, { subject: 'Terms', body: 'x'.repeat(10), from_name: 'Bob' });
  panel.openLetters({ to: 'Cid' });
  panel.render();
  assert.equal(find(panel.root, 'dfsocial-field')[1].value, '', 'a fresh letter after one sent');
  void ann;
});

test('MAIL1 / NAME-AS tab: a friend\'s row writes them a letter BY ACCOUNT - the name on the row is the one the room reads (since NAME-AS, perhaps a character\'s two words, or another account\'s username), so every friend\'s row offers it, the letter reaches that friend\'s account, a guest friend is refused in the service\'s own words, and a name typed over the friend\'s goes by username again (mutants: a friend\'s letter sent by the name on the row; the account kept past a typed name; a guest\'s row taken as a reader)', async () => {
  const { svc, social, panel, frame } = await tabRig();
  const ann = await svc.player('p_annc_000000001', 'Annwyn');
  const imp = await svc.player('p_imp_0000000001', 'Ysolde');   // somebody ELSE whose username is the word on Ann's row
  const guest = await svc.player('p_gst_0000000001', null);
  // the hub's rows: Ann wears her character's name (one word, and another account's username); the guest its generated one
  social.apply({ t: 'social', k: 'state', acct: 'acct-bob-1', name: 'Bob', peers: [], friends: [{ acct: ann.id, name: 'Ysolde', online: false, seen: null, peers: [] }, { acct: guest.id, name: 'Lysandus Tell', online: false, seen: null, peers: [] }], in: [], out: [], party: null, invites: [] });
  panel.open();
  panel.render();
  const letterFor = (name) => find(panel.root, 'dfsocial-btn').filter((b) => b.textContent.startsWith('Letter')).find((b) => texts(b.parent.parent).includes(name));
  assert.equal(find(panel.root, 'dfsocial-btn').filter((b) => b.textContent.startsWith('Letter')).length, 2, 'every friend\'s row');
  const [annBtn, guestBtn] = [letterFor('Ysolde'), letterFor('Lysandus Tell')];
  assert.ok(annBtn && guestBtn);
  assert.equal(!!guestBtn.disabled, false, 'the name\'s shape says nothing of a username any more - the service does');
  annBtn.fire('click');
  panel.render();
  assert.equal(panel.tab(), 'letters');
  assert.equal(panel.lettersView(), 'write');
  const [to, subject, body] = find(panel.root, 'dfsocial-field');
  assert.equal(to.value, 'Ysolde', 'the friend, by the name they are shown by');
  subject.value = 'Hello'; subject.fire('input'); body.value = 'Meet me at the gate.'; body.fire('input');
  button(panel.root, 'Send').fire('click');
  await frame(); await frame();
  const count = (id) => svc.db._raw.prepare('SELECT COUNT(*) AS n FROM letters WHERE to_id = ?').get(id).n;
  assert.deepEqual([count(ann.id), count(imp.id)], [1, 0], 'the letter reached the friend\'s ACCOUNT - never the account whose username the row\'s word is');
  assert.ok(texts(panel.root).includes('Your letter to Annwyn is on its way.'), 'named back as the world reads their account');
  // a guest friend: the service's own sentence
  find(panel.root, 'dfsocial-tab').find((t) => t.dataset.tab === 'friends').fire('click');
  panel.render();
  letterFor('Lysandus Tell').fire('click');
  panel.render();
  const [, s2, b2] = find(panel.root, 'dfsocial-field');
  s2.value = 'Hello'; s2.fire('input'); b2.value = 'Hi.'; b2.fire('input');
  button(panel.root, 'Send').fire('click');
  await frame(); await frame();
  assert.ok(texts(panel.root).includes(accountRefusalText('reader-guest')), 'a guest has no letterbox, said so');
  assert.equal(count(guest.id), 0);
  // a name typed over the friend's is a username again
  const [to3, s3, b3] = find(panel.root, 'dfsocial-field');
  to3.value = 'Ysolde'; to3.fire('input'); s3.value = 'Hello'; s3.fire('input'); b3.value = 'Typed.'; b3.fire('input');
  button(panel.root, 'Send').fire('click');
  await frame(); await frame();
  assert.equal(count(imp.id), 1, 'typed, the word is the username it names');
});

// ── THE HOST, BY SOURCE ────────────────────────────────────────────────────────────────────────────────────────────

test('MAIL1 host by source: the box is made with the panel over the ACCOUNT SERVICE - its io read from the store at each call - handed to the panel, polled from the online frame before the dead return, and a look that finds letters says so on the world tab (mutants: the box never polled; the notice dropped; the io captured once)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /import \{ MailBox, mailNoticeText \} from '\.\.\/net\/mail\.js';/);
  const made = w.slice(w.indexOf('mail = new MailBox({'), w.indexOf('socialPanel = createSocialPanel({'));
  assert.match(made, /ioOf: \(\) => \{\s*const st = appStorage\(\);\s*const s = storedSession\(st\);\s*return s \? \{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), base: serviceBase\(st\), secret: s\.secret, storage: st \} : null;\s*\},/);
  assert.match(made, /onLetter: \(event\) => \{ chatLog\.push\(tab\.id, \{ text: mailNoticeText\(event\), system: true \}\); \},/);
  assert.match(w, /socialPanel = createSocialPanel\(\{\s*social,\s*mail,/);
  // PIN MOVED (SCALE4c): the lane no longer looks itself - it stamps that it runs, before the dead return, and the box's
  // looks ride the tab's one heartbeat while it does (net/heartbeat.js whileLive)
  assert.match(w, /const onlineFrame = \(now, dt\) => \{[\s\S]{0,1200}?\n\s*_mailFrameAt = performance\.now\(\);[^\n]*\n[\s\S]{0,2600}?if \(townTalk\.overlay instanceof DeathScreen/, 'stamped before the dead return');   // 1200 (WILD1: the zone's wildFrame() line between); 2100: WB1's gateFrame and RENOWN1's tick both stand between, and ONE-SEAT's branch (a tab out of the seat keeps its letterbox); PIN MOVED (2300, the merge of main past SD9b: SD2b's Hollow frame and CHAP1's Roll tick both stand between too); PIN MOVED (2600, the merge of main past NAME-AS: EG-PLAY's egFrame and NAME-AS's nameAsFrame both stand between - 2395 measured)
  assert.match(w, /heartbeat\.add\('mail', whileLive\(mail\.heartbeatPart\(\), \(\) => performance\.now\(\) - _mailFrameAt < FRAME_LIVE_MS\)\);/);
});
