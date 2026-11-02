// SAFE1-SAFE7 (2026-10-17, bible/11-Multiplayer/Chat-Safety-Arc.md): THE LAW BOTH ENDS AGREE ON, PURE - the relay's
// stamp on a line and the account service's check of it, the reviewer's feed batch, a report's shape, the chat commands,
// the strike ladder and the ban order. Every signature here is a REAL Ed25519 one: a stamp that verified anything would
// make every report evidence of nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mintStamp, verifyStamp, stampTabOf, stampBytes, STAMP_TABS, PUBLIC_TABS, STAMP_RE, STAMP_V } from '../../../src/net/safety/chatStamp.js';
import { sealFeed, openFeed, feedValid, FEED_V, FEED_LINES_MAX, FEED_AGE_MAX_MS } from '../../../src/net/safety/chatFeed.js';
import {
  reportShape, parseSafetyCommand, ladderMinutes, banUntil, LADDER_MIN, BAN_FOREVER, BAN_DAYS_DEFAULT, REPORT_LINES_MAX,
  REPORT_LINE_AGE_MS, REPORT_REASONS, SAFETY_COMMANDS,
} from '../../../src/net/safety/safetyLaw.js';
import { CONDUCT_VERSION, CONDUCT_VERSION_RE, conductRules } from '../../../src/net/safety/conduct.js';
import { CHAT_TABS } from '../../../src/net/chat.js';
import { HOST_COMMANDS } from '../../../src/net/chatCommands.js';
import { mintBanOrder, mintOrder, verifyOrder, orderValid, mintToken, verifyToken } from '../../../src/net/identityToken.js';
import { chatHubRoom, regionShardRoom } from '../../../src/net/hubShards.js';
// AUDIT SAFE (the client lane): the module whole, so a pin of a member the old law lacked fails on its own assertion
import * as law from '../../../src/net/safety/safetyLaw.js';
import { parseStringTableCsv } from '../../../src/systems/textManager.js';
import { readFileSync } from 'node:fs';

const subtle = globalThis.crypto.subtle;
const pair = () => subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const LINE = Object.freeze({ tab: 'world', sub: 'p_troll001', name: 'Troll', at: 1_760_000_000_000, text: 'attention *****' });

test('SAFE2 A STAMP HOLDS FOR THE LINE IT WAS MINTED ON AND NO OTHER: every field is signed - the tab, the account, the name, the time and the words - and another key, a stamp of another line, or a stamp of the wrong shape is refused (mutants: a field left out of the signed bytes; the verify answering true)', async () => {
  const kp = await pair();
  const sg = await mintStamp(LINE, kp.privateKey, { subtle });
  assert.match(sg, STAMP_RE);
  assert.equal(await verifyStamp(LINE, sg, kp.publicKey, { subtle }), true);
  for (const [field, value] of [['tab', 'party'], ['sub', 'p_other0001'], ['name', 'Someone'], ['at', LINE.at + 1], ['text', 'attention please']]) {
    assert.equal(await verifyStamp({ ...LINE, [field]: value }, sg, kp.publicKey, { subtle }), false, `${field} is signed`);
  }
  const other = await pair();
  assert.equal(await verifyStamp(LINE, sg, other.publicKey, { subtle }), false, 'another key');
  assert.equal(await verifyStamp(LINE, sg.slice(1), kp.publicKey, { subtle }), false, 'a stamp of the wrong shape');
  assert.equal(await verifyStamp(LINE, 'x'.repeat(86), kp.publicKey, { subtle }), false, 'a forged stamp');
  assert.equal(await mintStamp(LINE, null, { subtle }), '', 'no key, no stamp');
  assert.equal(await mintStamp({ ...LINE, tab: 'nowhere' }, kp.privateKey, { subtle }), '', 'a line no tab hears is not stamped');
});

test('SAFE2 A STAMP CAN NEVER BE LIFTED ONTO A TOKEN OR AN ORDER: its signed bytes begin with its own version line (STAMP_V and a newline), which no token\'s, order\'s or receipt\'s do, so the same key signing both cannot make one pass as the other (mutant: the version line dropped)', async () => {
  // AUDIT SAFE (the client lane): read off STAMP_V, the relay lane's to name (RELAY-13c moved it off the card receipt's `c1`)
  const bytes = new TextDecoder().decode(stampBytes(LINE));
  assert.ok(STAMP_V && bytes.startsWith(`${STAMP_V}\n`));
  assert.deepEqual(JSON.parse(bytes.slice(STAMP_V.length + 1)), [LINE.tab, LINE.sub, LINE.name, LINE.at, LINE.text]);
});

test('SAFE2 THE TAB A LINE IS HEARD ON is the chat log\'s own tab id - the hub and its shards are World, a region\'s bus and shards Region, a language Lang, Trade, LFG, the hub\'s party and guild lines their own, and any place its Local (mutants: a shard read as a place; party read as World)', () => {
  assert.deepEqual([...STAMP_TABS], CHAT_TABS.map((t) => t.id), 'the stamp\'s tabs are the chat log\'s');
  assert.deepEqual([...PUBLIC_TABS], ['world', 'region', 'lang', 'trade', 'lfg']);
  assert.equal(stampTabOf('chat:world'), 'world');
  assert.equal(stampTabOf(chatHubRoom(7)), 'world');
  assert.equal(stampTabOf('chat:world', 'party'), 'party');
  assert.equal(stampTabOf(chatHubRoom(3), 'guild'), 'guild');
  assert.equal(stampTabOf('chat:region.12'), 'region');
  assert.equal(stampTabOf(regionShardRoom(12, 2)), 'region');
  assert.equal(stampTabOf('chat:lang.fr'), 'lang');
  assert.equal(stampTabOf('chat:trade'), 'trade');
  assert.equal(stampTabOf('chat:lfg'), 'lfg');
  assert.equal(stampTabOf('cell:1:2'), 'local');
  assert.equal(stampTabOf('interior:abc'), 'local');
});

test('SAFE5 THE FEED IS SIGNED AND YOUNG AND PUBLIC: a batch the relay sealed opens with its public half; another key, a byte changed, an old batch, a party line or an empty batch is refused (mutants: the signature unchecked; the age unchecked; a private tab let through)', async () => {
  const kp = await pair();
  const now = 1_760_000_000_000;
  const lines = [LINE, { ...LINE, at: LINE.at + 5, text: 'lol' }];
  const sealed = await sealFeed({ id: '0123456789abcdef', at: now, lines }, kp.privateKey, { subtle });
  const opened = await openFeed(sealed.body, sealed.sig, kp.publicKey, { subtle, nowMs: now });
  assert.equal(opened.ok, true);
  assert.equal(opened.batch.v, FEED_V);
  assert.deepEqual(opened.batch.lines, lines);
  const other = await pair();
  assert.deepEqual(await openFeed(sealed.body, sealed.sig, other.publicKey, { subtle, nowMs: now }), { error: 'feed-signature' });
  const bent = new Uint8Array(sealed.body); bent[bent.length - 3] ^= 1;
  assert.deepEqual(await openFeed(bent, sealed.sig, kp.publicKey, { subtle, nowMs: now }), { error: 'feed-signature' });
  assert.deepEqual(await openFeed(sealed.body, sealed.sig, kp.publicKey, { subtle, nowMs: now + FEED_AGE_MAX_MS + 1 }), { error: 'feed-stale' });
  assert.equal(await sealFeed({ id: '0123456789abcdef', at: now, lines: [{ ...LINE, tab: 'party' }] }, kp.privateKey, { subtle }), null, 'a party line never rides the feed');
  assert.equal(await sealFeed({ id: '0123456789abcdef', at: now, lines: [] }, kp.privateKey, { subtle }), null);
  assert.equal(await sealFeed({ id: '0123456789abcdef', at: now, lines }, null, { subtle }), null, 'no key, no feed');
  assert.equal(feedValid({ v: FEED_V, id: '0123456789abcdef', at: now, lines: Array.from({ length: FEED_LINES_MAX + 1 }, () => LINE) }), false);
});

test('SAFE3 A REPORT\'S SHAPE: an account, a known reason, stamped lines no older than a day and at least one of them the reported account\'s - the same line twice is one, and the lines come back in the order they were said (mutants: a report with none of the target\'s lines; a stale line taken)', () => {
  const now = LINE.at + 60_000;
  const sg = 'A'.repeat(86);
  const said = { ...LINE, sg };
  const before = { ...LINE, sub: 'p_victim01', name: 'Sylvia', at: LINE.at - 1000, text: 'hi all', sg };
  const r = reportShape({ target: LINE.sub, reason: 'hate', note: '  again  ', lines: [said, before, said] }, now);
  assert.deepEqual(r, { target: LINE.sub, reason: 'hate', note: 'again', lines: [before, said] });
  assert.deepEqual(reportShape({ target: LINE.sub, reason: 'hate', lines: [before] }, now), { error: 'report-no-line' });
  assert.deepEqual(reportShape({ target: LINE.sub, reason: 'rude', lines: [said] }, now), { error: 'report-reason' });
  assert.deepEqual(reportShape({ target: 'x', reason: 'hate', lines: [said] }, now), { error: 'no-player' });
  assert.deepEqual(reportShape({ target: LINE.sub, reason: 'hate', lines: [said] }, LINE.at + REPORT_LINE_AGE_MS + 1), { error: 'report-stale' });
  assert.deepEqual(reportShape({ target: LINE.sub, reason: 'hate', lines: [{ ...said, sg: 'short' }] }, now), { error: 'report-shape' });
  assert.deepEqual(reportShape({ target: LINE.sub, reason: 'hate', lines: Array.from({ length: REPORT_LINES_MAX + 1 }, (_, i) => ({ ...said, at: said.at - i })) }, now), { error: 'report-shape' });
  assert.ok(REPORT_REASONS.includes('other'));
});

test('SAFE1-SAFE4 THE COMMANDS: /block, /unblock, /blocked, /report with its reason as the last word, /conduct and /rules, /ban with its days or perm as the last word, /unban and /strikes - a name may hold a space; a word that is no reason is part of the name; every command is the host\'s, before the chat parser (mutants: the reason read from the first word; a ban past its bound taken)', () => {
  assert.deepEqual(parseSafetyCommand('/block Brave Wolf'), { op: 'block', name: 'Brave Wolf' });
  assert.deepEqual(parseSafetyCommand('/unblock Troll'), { op: 'unblock', name: 'Troll' });
  assert.deepEqual(parseSafetyCommand('/blocked'), { op: 'blocked' });
  assert.deepEqual(parseSafetyCommand('/rules'), { op: 'conduct' });
  assert.deepEqual(parseSafetyCommand('/conduct'), { op: 'conduct' });
  assert.deepEqual(parseSafetyCommand('/report Brave Wolf hate'), { op: 'report', name: 'Brave Wolf', reason: 'hate' });
  assert.deepEqual(parseSafetyCommand('/report Brave Wolf'), { op: 'report', name: 'Brave Wolf', reason: 'other' });
  assert.deepEqual(parseSafetyCommand('/REPORT troll SPAM'), { op: 'report', name: 'troll', reason: 'spam' });
  assert.deepEqual(parseSafetyCommand('/ban Troll 7'), { op: 'ban', name: 'Troll', days: 7 });
  assert.deepEqual(parseSafetyCommand('/ban Troll perm'), { op: 'ban', name: 'Troll', days: 0 });
  assert.deepEqual(parseSafetyCommand('/ban Brave Wolf'), { op: 'ban', name: 'Brave Wolf', days: BAN_DAYS_DEFAULT });
  assert.ok('error' in parseSafetyCommand('/ban Troll 400'));
  assert.ok('error' in parseSafetyCommand('/ban Troll 0'));
  assert.ok('error' in parseSafetyCommand('/block'));
  assert.deepEqual(parseSafetyCommand('/unban Troll'), { op: 'unban', name: 'Troll' });
  assert.deepEqual(parseSafetyCommand('/strikes Troll'), { op: 'strikes', name: 'Troll' });
  assert.equal(parseSafetyCommand('/blocky'), null);
  assert.equal(parseSafetyCommand('hello'), null);
  for (const c of SAFETY_COMMANDS) assert.ok(HOST_COMMANDS.includes(c), `/${c} is the host's`);
});

test('SAFE4 THE LADDER: half an hour, a day, a week - then the ladder holds at its top (a ban is a moderator\'s to give); a ban\'s end is its days on, or the last second of 9999 for good (mutants: the ladder read off by one; a ban for good that ends)', () => {
  assert.deepEqual([...LADDER_MIN], [30, 1440, 10080]);
  assert.deepEqual([0, 1, 2, 3, 9, -1].map(ladderMinutes), [30, 1440, 10080, 10080, 10080, 30]);
  assert.equal(banUntil(7, 1000), 1000 + 7 * 86400);
  assert.equal(banUntil(0, 1000), BAN_FOREVER);
  assert.equal(new Date(BAN_FOREVER * 1000).toISOString(), '9999-12-31T23:59:59.000Z');
});

test('SAFE4 THE BAN ORDER carries its end and nothing else: its own kind at the relay\'s door, never a mute\'s, and never a field of another kind - an identity can never pass as one, nor one as an identity (mutants: a ban order read as a mute; a mute carrying `bn`)', async () => {
  const kp = await pair();
  const nowS = 1_760_000_000;
  const order = await mintBanOrder({ s: 'p_troll001', bn: nowS + 86400 }, kp.privateKey, { subtle, nowS });
  const r = await verifyOrder(order, kp.publicKey, { subtle, nowS, kind: 'ban' });
  assert.equal(r.ok, true);
  assert.equal(r.claims.bn, nowS + 86400);
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS, kind: 'mute' })).ok, false, 'a ban is never a mute');
  const mute = await mintOrder({ s: 'p_troll001', mu: nowS + 60 }, kp.privateKey, { subtle, nowS });
  assert.equal((await verifyOrder(mute, kp.publicKey, { subtle, nowS, kind: 'ban' })).ok, false, 'a mute is never a ban');
  assert.equal(orderValid({ o: 'ban', s: 'p_troll001', bn: nowS + 1, i: nowS, e: nowS + 60 }), true);
  assert.equal(orderValid({ o: 'ban', s: 'p_troll001', bn: 0, i: nowS, e: nowS + 60 }), true, 'a ban lifted');
  assert.equal(orderValid({ o: 'ban', s: 'p_troll001', bn: nowS + 1, mu: nowS + 1, i: nowS, e: nowS + 60 }), false);
  assert.equal(orderValid({ o: 'mute', s: 'p_troll001', mu: nowS + 1, bn: nowS + 1, i: nowS, e: nowS + 60 }), false);
  assert.equal(orderValid({ o: 'ban', s: 'p_troll001', bn: -1, i: nowS, e: nowS + 60 }), false);
  assert.equal(orderValid({ o: 'ban', s: 'p_troll001', i: nowS, e: nowS + 60 }), false);
  assert.equal((await verifyToken(order, kp.publicKey, { subtle, nowS })).ok, false, 'an order is never an identity');
  const tok = await mintToken({ s: 'p_troll001', n: 'Troll', k: 'guest' }, kp.privateKey, { subtle, nowS });
  assert.equal((await verifyOrder(tok, kp.publicKey, { subtle, nowS, kind: 'ban' })).ok, false, 'an identity is never a ban');
});

test('SAFE7 THE CODE OF CONDUCT is versioned by its date and names what it forbids - the joke included, and asexuality by name (mutant: the hate rule losing its "joke")', () => {
  assert.match(CONDUCT_VERSION, CONDUCT_VERSION_RE);
  const rules = conductRules();
  assert.equal(rules.length, 6);
  assert.ok(rules.some((r) => /not even as a joke/.test(r) && /asexuality/.test(r)));
});

/* ═══ AUDIT SAFE - THE CLIENT LANE (2026-10-17) ═══════════════════════════════════════════════════════════════════════
 * The law's half of the audit's client findings: a report's lines out of their day dropped rather than the report
 * refused, a ban's own sentence, a report's note and a ban's reason in the commands, a moderator's look at the reports,
 * and a ban said as a ban in every language. Each pin failed on the arc as it merged. */

test('AUDIT SAFE CLIENT-5 / DOC-7 / DOC-17 A LINE OUT OF ITS DAY IS DROPPED, NOT THE REPORT: a context line older than a day, or stamped more than a minute ahead (DOC-17), is left out and the rest goes; `report-stale` only when the account\'s own lines were all out of their day, `report-no-line` when none was theirs (mutants: a stale line refusing the whole report; a future line kept; stale said as no-line)', () => {
  const now = LINE.at + 60_000;
  const sg = 'A'.repeat(86);
  const said = { ...LINE, sg };
  const yesterday = { ...LINE, sub: 'p_victim01', name: 'Sylvia', at: now - REPORT_LINE_AGE_MS - 1, text: 'night all', sg };
  const ahead = { ...LINE, sub: 'p_victim01', name: 'Sylvia', at: now + law.REPORT_LINE_AHEAD_MS + 1, text: 'from tomorrow', sg };
  const justAhead = { ...LINE, sub: 'p_victim01', name: 'Sylvia', at: now + law.REPORT_LINE_AHEAD_MS, text: 'a clock a minute on', sg };
  assert.deepEqual(reportShape({ target: LINE.sub, reason: 'hate', lines: [yesterday, said] }, now), { target: LINE.sub, reason: 'hate', note: '', lines: [said] }, 'yesterday\'s context left out, the report goes');
  assert.deepEqual(reportShape({ target: LINE.sub, reason: 'hate', lines: [ahead, said, justAhead] }, now).lines, [said, justAhead], 'a line from the future left out (DOC-17); a minute on is the clocks\' drift, kept');
  assert.equal(law.REPORT_LINE_AHEAD_MS, 60_000);
  assert.deepEqual(reportShape({ target: LINE.sub, reason: 'hate', lines: [{ ...said, at: now - REPORT_LINE_AGE_MS - 1 }, yesterday] }, now), { error: 'report-stale' }, 'theirs, every one out of its day');
  assert.deepEqual(reportShape({ target: LINE.sub, reason: 'hate', lines: [{ ...said, at: now + law.REPORT_LINE_AHEAD_MS + 1 }] }, now), { error: 'report-stale' });
  assert.deepEqual(reportShape({ target: LINE.sub, reason: 'hate', lines: [yesterday] }, now), { error: 'report-no-line' }, 'none of theirs at all');
});

test('AUDIT SAFE DOC-13 + SERVICE-10 + DOC-4 THE COMMANDS: a report\'s note and a ban\'s reason are the words after the first colon (a note past REPORT_NOTE_MAX refused), the name and the reason or the days before it; /cases, /case <name>, /dismiss <name> and /modhelp are the host\'s, before the chat parser (mutants: the note left in the name; a ban\'s reason read as its length; /dismiss unread)', () => {
  assert.deepEqual(parseSafetyCommand('/report Brave Wolf hate: he called them freaks'), { op: 'report', name: 'Brave Wolf', reason: 'hate', note: 'he called them freaks' });
  assert.deepEqual(parseSafetyCommand('/report Troll: again   and again'), { op: 'report', name: 'Troll', reason: 'other', note: 'again and again' });
  assert.deepEqual(parseSafetyCommand('/report Troll spam:'), { op: 'report', name: 'Troll', reason: 'spam' });
  assert.ok('error' in parseSafetyCommand(`/report Troll: ${'x'.repeat(law.REPORT_NOTE_MAX + 1)}`));
  assert.ok('error' in parseSafetyCommand('/report : a note and no name'));
  assert.deepEqual(parseSafetyCommand('/ban Brave Wolf 7: slurs in World chat'), { op: 'ban', name: 'Brave Wolf', days: 7, reason: 'slurs in World chat' });
  assert.deepEqual(parseSafetyCommand('/ban Troll perm: threats'), { op: 'ban', name: 'Troll', days: 0, reason: 'threats' });
  assert.deepEqual(parseSafetyCommand('/ban Troll: spam'), { op: 'ban', name: 'Troll', days: BAN_DAYS_DEFAULT, reason: 'spam' });
  assert.ok('error' in parseSafetyCommand('/ban Troll 400: too long'));
  assert.deepEqual(parseSafetyCommand('/unban A: B'), { op: 'unban', name: 'A: B' }, 'only a report and a ban read a colon');
  assert.deepEqual(parseSafetyCommand('/cases'), { op: 'cases' });
  assert.deepEqual(parseSafetyCommand('/case Brave Wolf'), { op: 'case', name: 'Brave Wolf' });
  assert.deepEqual(parseSafetyCommand('/dismiss #p_troll001'), { op: 'dismiss', name: '#p_troll001' });
  assert.ok('error' in parseSafetyCommand('/dismiss'));
  assert.ok('error' in parseSafetyCommand('/case'));
  assert.deepEqual(parseSafetyCommand('/modhelp'), { op: 'modhelp' });
  for (const c of ['cases', 'case', 'dismiss', 'modhelp']) assert.ok(SAFETY_COMMANDS.includes(c) && HOST_COMMANDS.includes(c), `/${c} is the host's`);
  const help = law.modHelpLines();
  for (const c of ['/mute', '/unmute', '/ban', '/unban', '/strikes', '/cases', '/case', '/dismiss']) assert.ok(help.some((l) => l.includes(c)), `the moderators' lines name ${c}`);
});

test('AUDIT SAFE CLIENT-2 A BAN\'S OWN SENTENCE, one home for the game\'s word and the sign-in\'s refusal: its end (a date, or for good) and the moderator\'s reason where there is one (mutant: the reason dropped)', () => {
  assert.match(law.bannedText(2_000_000_000, 'Slurs in World chat'), /^This account is banned until .+\. Reason: Slurs in World chat$/);
  assert.equal(law.bannedText(BAN_FOREVER), 'This account is banned for good.');
  assert.equal(law.bannedText(BAN_FOREVER, '   '), 'This account is banned for good.');
  assert.equal(law.untilText(BAN_FOREVER), 'for good');
});

test('AUDIT SAFE DOC-16 A BAN IS A BAN IN EVERY LANGUAGE - never a suspension (a ban may be for good): Spanish, Italian, Romanian and Indonesian said "suspended" in the code\'s consequence and every ban line; and German names race as the rest of its locale does (Rasse), not skin colour (mutant: a suspension\'s word back)', () => {
  const rows = (code) => new Map(parseStringTableCsv(readFileSync(new URL(`../../../locales/${code}/Port_Strings.csv`, import.meta.url), 'utf8')));
  const BAN_KEYS = ['net.conduct.consequence', 'account.refusal.banned', 'net.safety.bannedSelf', 'net.safety.bannedAccount', 'net.safety.bannedWhy', 'net.safety.didBan', 'net.safety.nextBan', 'net.online.banned'];
  const SUSPENSION = { es: /suspen/i, it: /sospe/i, ro: /suspend/i, id: /tangguh/i };
  for (const [code, word] of Object.entries(SUSPENSION)) {
    const map = rows(code);
    for (const k of BAN_KEYS) {
      assert.ok(map.has(k), `${code} ${k}`);
      assert.doesNotMatch(map.get(k), word, `${code} ${k} says a suspension: ${map.get(k)}`);
    }
  }
  const de = rows('de').get('net.conduct.hate');
  assert.doesNotMatch(de, /Hautfarbe/);
  assert.match(de, /Rasse/);
  assert.equal(rows('de').get('pause.specials.race'), 'Rasse', 'the locale\'s own word for race');
});
