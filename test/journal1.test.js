// JOURNAL1 (2026-09-23, the community arc - Addison Knox: "Player journals ... shared in-world for storytelling"): THE
// JOURNAL, SHARED, DRIVEN. The notebook takes whatever a player can type (breakableNote - the composer's crash, at its
// root), cutting between the characters a reader counts (systems/graphemes.js - EMOTE1's law, one home now); the page on
// the wire (the letter's line law, every bound, the widest page under the relay's door); the relay over the real Room
// (routed to the one socket `to` names, stamped, a place room's alone, never from a muted writer, the cast arm's
// per-sender funnel shared - its meter measured with every other arm's in test/auditattach.test.js); the session (only
// a relay that routes it, gated both ways, delivered only when addressed to me); a note as the page it would be shown
// as, and a page or a letter kept, over the real notebook; the pages held out to me; the reader's window, the F-menu's
// row, the chronicle's Share and the Letters tab's Keep over fake documents; and the host by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PlayerNotebook, breakableNote, wrapLinesIntoNote, MAX_LINE_LENGTH } from '../src/systems/notebook.js';
import { graphemesOf } from '../src/systems/graphemes.js';
import { graphemeCut } from '../src/ui/nameLayer.js';
import {
  parseClient, pageLaw, validPage, validPageData, wordsLine, foldBlankLines, relaySupportsPage, PAGE_RELAY_MIN, PAGE_HEAD_MAX,
  PAGE_LINE_MAX, PAGE_LINES_MAX, PAGE_FRAME_MAX, PAGE_HZ_MAX, PAGE_IN_HZ_MAX, MAX_FRAME_BYTES, CAST_HZ_MAX, DROP_STRIKES_MAX,
  RELAY_VERSION,
} from '../src/net/wire.js';
import { cleanBody, letterWords, LETTER_BODY_MAX } from '../src/net/letterLaw.js';
import { OnlineSession } from '../src/net/online.js';
import {
  pageOfNote, pageRefusalText, keptPageTokens, keptLetterTokens, letterOfPage, PAGE_LETTER_SUBJECT, PageOffers, PAGE_HOLD_MS,
  PAGE_NOTICE_MS, PAGE_OFFERS_MAX, pageOfferText, pageShownText, pageTooFarText,
} from '../src/net/journalPage.js';
import { createPageWindow, pageView, PAGE_CSS, PAGE_KEEP_TEXT, PAGE_KEPT_TEXT, PAGE_CLOSE_TEXT } from '../src/ui/pageWindow.js';
import { socialMenuRows, socialPlaqueRows, plaqueRowFor } from '../src/ui/socialMenu.js';
import { createSocialPanel, LETTER_KEPT_NOTE, LETTER_KEEP_FAILED_TEXT } from '../src/ui/socialPanel.js';
import { mountEnhancedChronicle } from '../src/ui/enhancedChronicle.js';
import { SocialState } from '../src/net/social.js';
import { MailBox } from '../src/net/mail.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { HEAL_SPELL } from './placeWidest.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const ch = (...cps) => String.fromCodePoint(...cps);
const FAMILY = ch(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
const FACE = ch(0x1f600);
const RLO = ch(0x202e), ZWSP = ch(0x200b), LSEP = ch(0x2028), NBSP = ch(0xa0), BEL = ch(7), BACKSLASH = ch(92);
const isHighHalf = (s) => { const c = s.charCodeAt(s.length - 1); return c >= 0xd800 && c <= 0xdbff; };
const noteLines = (entry) => entry.filter((t) => t.formatting === 'text').map((t) => t.text);

// ─── THE NOTEBOOK TAKES WHAT A PLAYER CAN TYPE ──────────────────────────────────────────────────────────────────

test('JOURNAL1 the notebook takes what a player can type - the chronicle\'s composer takes 200 characters and DFU\'s wrap throws on 71 with no space in them (DFU\'s own box stops at 70, so DFU never met it); breakableNote cuts a run past the line at the wrap\'s own break, a SPACE - a tab or a no-break space is part of the run - and leaves every other text as it was (mutants: a run of spaces cut as a word; a tab taken for a break; the cut a unit short)', () => {
  const word = 'W'.repeat(200);
  assert.throws(() => new PlayerNotebook().addNote(word), RangeError, 'the wrap is DFU\'s, and throws where C# does - the port kept it');
  const nb = new PlayerNotebook({ dateTimeString: () => 'Morndas', cityName: () => 'Daggerfall' });
  nb.addNote(breakableNote(`see ${word} ok`));
  const lines = noteLines(nb.getNote(0));
  assert.deepEqual(lines.map((l) => l.length), [4, 71, 71, 64], 'filed, each line the wrap\'s width with DFU\'s leading space');
  assert.equal(lines.map((l) => l.slice(1)).join(' ').replace(/ /g, ''), `see${word}ok`, 'nothing lost but the breaks');
  for (const s of ['a plain note', 'x'.repeat(MAX_LINE_LENGTH), `${'y'.repeat(40)} ${'z'.repeat(MAX_LINE_LENGTH)}`, '', 'a  b', ' lead', `a${' '.repeat(100)}b`]) {
    assert.equal(breakableNote(s), s, `untouched: ${JSON.stringify(s.slice(0, 20))}`);
  }
  assert.equal(breakableNote('x'.repeat(MAX_LINE_LENGTH + 1)), `${'x'.repeat(MAX_LINE_LENGTH)} x`, 'one past the line: cut AT the line');
  assert.equal(breakableNote('x'.repeat(2 * MAX_LINE_LENGTH + 5)).split(' ').map((p) => p.length).join(), `${MAX_LINE_LENGTH},${MAX_LINE_LENGTH},5`);
  for (const sep of ['\t', NBSP]) {
    const run = 'a'.repeat(40) + sep + 'b'.repeat(40);
    assert.throws(() => wrapLinesIntoNote([], run, 'text'), RangeError, 'the wrap breaks on a space and on nothing else');
    const b = breakableNote(run);
    assert.equal(b.replace(/ /g, ''), run, 'the separator kept, inside its run');
    assert.doesNotThrow(() => wrapLinesIntoNote([], b, 'text'));
  }
  assert.equal(breakableNote(null), '');
});

test('JOURNAL1 the cut falls between the characters a reader counts - EMOTE1\'s law (systems/graphemes.js), which the chat bubble\'s cut reads too: a joined family never parted, a face never halved, a character wider than a line taken by its code points so no text is refused; whole code points where the runtime has no segmenter (mutants: the segmenter\'s answer ignored; the pair split on the fallback)', () => {
  assert.deepEqual(graphemesOf(`a${FAMILY}b`), ['a', FAMILY, 'b'], 'a family is one character');
  assert.equal(graphemesOf(`${FAMILY}${FACE}x`).join(''), `${FAMILY}${FACE}x`, 'joined, the text again');
  const fams = breakableNote(FAMILY.repeat(12)).split(' ');
  assert.ok(fams.length > 1 && fams.every((p) => p.length <= MAX_LINE_LENGTH && p.split(FAMILY).every((x) => x === '')), 'every piece whole families');
  assert.deepEqual(breakableNote(FACE.repeat(50)).split(' ').map((p) => p.length), [70, 30]);
  assert.deepEqual(breakableNote(`${'a'.repeat(69)}${FACE}b`).split(' '), ['a'.repeat(69), `${FACE}b`], 'a face that would straddle the line goes whole onto the next');
  const zalgo = `e${ch(0x301).repeat(100)}x`;
  assert.doesNotThrow(() => wrapLinesIntoNote([], breakableNote(zalgo), 'text'), 'one character past the line: by its code points');
  const Seg = Intl.Segmenter;
  try {
    Intl.Segmenter = undefined;
    assert.deepEqual(graphemesOf(`${FACE}a`), [FACE, 'a'], 'whole code points');
    assert.ok(breakableNote(`${'a'.repeat(69)}${FACE.repeat(3)}`).split(' ').every((p) => !isHighHalf(p)), 'the high half goes with its low half');
    assert.equal(graphemeCut(`a${FAMILY}`, 3), `a${ch(0x1f468)}`, 'the bubble\'s cut reads the same law');
  } finally { Intl.Segmenter = Seg; }
  assert.equal(graphemeCut(`a${FAMILY}`, 3), 'a', 'with the segmenter a family is one - and does not fit');
  assert.match(rd('src/ui/nameLayer.js'), /for \(const g of graphemesOf\(text\)\) \{ if \(out\.length \+ g\.length > max\) break; out \+= g; \}/, 'the bubble reads the one law');
  assert.match(rd('src/systems/notebook.js'), /for \(const g of graphemesOf\(run\)\) \{/, 'and so does the notebook');
});

// ─── THE PAGE ON THE WIRE ───────────────────────────────────────────────────────────────────────────────────────

test('JOURNAL1 wire: a page is a player\'s words with their lines - the letter\'s line law, one home in wire.js now (controls, overrides and zero widths gone, tabs and runs of space one space, a line separator a space, blank runs one, none at the ends) - and a page past a bound is REFUSED, never cut; the widest page the law takes fits the relay\'s door; world102 the first relay that routes one (mutants: a bound off by one; the blank runs kept; a page cut to fit; the head uncleaned)', () => {
  const r = pageLaw({ head: `  Morndas${ZWSP} in  Daggerfall: `, lines: ['', `  ${RLO}I owe${BEL} you\t20 gold. `, '', ' ', '', `Signed${LSEP}Ann`, '', ''] });
  assert.deepEqual(r, { page: { head: 'Morndas in Daggerfall:', lines: ['I owe you 20 gold.', '', 'Signed Ann'] } });
  assert.deepEqual(validPage(r.page), r.page, 'idempotent: what the relay forwards is what the law takes again');
  // one law with the letter's
  const raw = `a\n\n\n${RLO}b \t c\n`;
  assert.equal(cleanBody(raw), foldBlankLines(raw.split('\n').map(wordsLine)).join('\n'), 'the letter\'s body is these two, composed');
  assert.equal(wordsLine(`x${RLO}\ty  `), 'x y');
  assert.deepEqual(foldBlankLines(['', 'a', '', '', 'b', '']), ['a', '', 'b']);
  // the bounds: at them, taken; one past, refused whole
  const at = { head: 'h'.repeat(PAGE_HEAD_MAX), lines: Array(PAGE_LINES_MAX).fill('l'.repeat(PAGE_LINE_MAX)) };
  assert.deepEqual(validPage(at), at);
  assert.deepEqual(pageLaw({ ...at, head: 'h'.repeat(PAGE_HEAD_MAX + 1) }), { error: 'head-long' });
  assert.deepEqual(pageLaw({ ...at, lines: [...at.lines.slice(1), 'l'.repeat(PAGE_LINE_MAX + 1)] }), { error: 'line-long' });
  assert.deepEqual(pageLaw({ ...at, lines: [...at.lines, 'one more'] }), { error: 'page-long' });
  assert.equal(pageLaw({ head: '', lines: [...Array(PAGE_LINES_MAX).fill('a'), '', ' '] }).page.lines.length, PAGE_LINES_MAX, 'the blank lines at its foot go before it is counted');
  assert.deepEqual(pageLaw({ head: 'h', lines: ['', ' ', ZWSP] }), { error: 'no-words' });
  for (const bad of [null, [], 'page', { head: 1, lines: ['a'] }, { head: '', lines: 'a' }, { head: '', lines: ['a', 2] }, { lines: ['a'] }]) {
    assert.deepEqual(pageLaw(bad), { error: 'no-page' }, JSON.stringify(bad));
  }
  // the frame's data: to a peer, the page projected
  assert.deepEqual(validPageData({ to: 'peer-0002', page: { head: '', lines: [' a '] } }), { to: 'peer-0002', page: { head: '', lines: ['a'] } });
  for (const bad of [{ page: at }, { to: 'x', page: at }, { to: 'peer-0002' }, { to: 'peer-0002', page: { head: '', lines: [] } }, null, []]) {
    assert.equal(validPageData(bad), null, JSON.stringify(bad)?.slice(0, 60));
  }
  // the parser
  const frame = (d) => JSON.stringify({ t: 'page', data: d });
  const ok = { to: 'peer-0002', page: { head: '', lines: ['a'] } };
  assert.deepEqual(parseClient(frame(ok), { hasHello: true }), { t: 'page', data: ok });
  assert.deepEqual(parseClient(frame(ok)), { error: 'page before hello' });
  assert.deepEqual(parseClient(frame({ ...ok, page: { head: '', lines: [] } }), { hasHello: true }), { error: 'bad page' });
  assert.deepEqual(parseClient(frame({ ...ok, pad: 'x'.repeat(PAGE_FRAME_MAX) }), { hasHello: true }), { error: 'frame too large' });
  // the widest page the law takes, every character one JSON escapes, is a frame under the relay's door
  const widest = JSON.stringify({ t: 'page', data: { to: 'p'.repeat(40), page: { head: '"'.repeat(PAGE_HEAD_MAX), lines: Array(PAGE_LINES_MAX).fill(BACKSLASH.repeat(PAGE_LINE_MAX)) } } });
  assert.ok(validPage(JSON.parse(widest).data.page), 'the widest page is a page');
  assert.ok(widest.length <= PAGE_FRAME_MAX, `and its frame fits: ${widest.length} of ${PAGE_FRAME_MAX}`);
  assert.ok(PAGE_FRAME_MAX < MAX_FRAME_BYTES);
  assert.ok(PAGE_LINE_MAX >= MAX_LINE_LENGTH + 1, 'a notebook line, with DFU\'s leading space, is a page line - the relay imports no game module, so this pin holds the two apart');
  assert.equal(RELAY_VERSION, 'world108');   // ADV1's level (world108); DUEL1's duel frame (world107); DISC23-B's look (world106); AUDIT 68's relay law (world105); TITLE-N's dm frame (world104); the contributor's dd/rz moved it past the arc's world102; the page frame stays gated at 102
  assert.equal(PAGE_RELAY_MIN, 102);
  assert.equal(relaySupportsPage('world102'), true);
  assert.equal(relaySupportsPage('world101'), false);
  assert.equal(relaySupportsPage(undefined), false);
});

// ─── THE RELAY ──────────────────────────────────────────────────────────────────────────────────────────────────

async function withRoom(key, fn) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try { await fn({ r, tick: (ms = 1000) => { clock += ms; } }); } finally { Date.now = realNow; }
}
const pages = (ws) => ws.sent.filter((m) => m.t === 'page');
const PAGE = { head: 'Morndas in Daggerfall:', lines: ['Meet me', '', 'at the Relic.'] };

test('JOURNAL1 relay: a page reaches the one player it names, stamped with its writer\'s id, its words as the law cleaned them; nobody else sees it; a channel or the hub is nowhere to hold one out; a page at myself is junk; a reader gone is nothing; a MUTED writer\'s page goes nowhere and they are told until when (mutants: the page fanned to the room; the stamp missing; the mute skipped; a channel carrying it)', () => withRoom('world:3,12', async ({ r, tick }) => {
  const a = r.connect(); await r.hello(a, 'peer-0001');
  const b = r.connect(); await r.hello(b, 'peer-0002');
  const c = r.connect(); await r.hello(c, 'peer-0003');
  for (const ws of [a, b, c]) ws.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'page', data: { to: 'peer-0002', page: { head: ' Morndas in Daggerfall: ', lines: [`${RLO}Meet me`, '', '', 'at the Relic.'] } } }));
  assert.deepEqual(pages(b), [{ t: 'page', id: 'peer-0001', data: { to: 'peer-0002', page: PAGE } }]);
  assert.equal(pages(a).length + pages(c).length, 0, 'the writer and a bystander see nothing');
  assert.equal(a.meters.junk ?? 0, 0);
  tick(1000);   // a page a second (PAGE_HZ_MAX): the next is the meter's to pass, so the arm behind it is what is read
  await r.raw(a, JSON.stringify({ t: 'page', data: { to: 'peer-0001', page: PAGE } }));
  assert.equal(a.meters.junk, 1, 'a page at my own id is junk');
  await r.raw(b, JSON.stringify({ t: 'page', data: { to: 'peer-0099', page: PAGE } }));
  assert.equal(b.meters.junk ?? 0, 0, 'a leave races a frame - not junk');
  assert.equal(pages(a).length + pages(b).length + pages(c).length, 1);
  // a muted writer
  const until = Math.floor(Date.now() / 1000) + 600;
  const m = r.connect(); await r.hello(m, 'peer-0004', null, { mu: until });
  b.sent.length = 0; m.sent.length = 0;
  await r.raw(m, JSON.stringify({ t: 'page', data: { to: 'peer-0002', page: PAGE } }));
  assert.equal(pages(b).length, 0, 'a mute that stopped a line and let a page through would be no mute');
  assert.deepEqual(m.sent.filter((x) => x.t === 'muted'), [{ t: 'muted', until }], 'told why, and until when');
  assert.equal(a.closed ?? b.closed ?? c.closed ?? m.closed, null);
}).then(() => withRoom('chat:world', async ({ r }) => {
  const a = r.connect(); await r.hello(a, 'peer-0001');
  const b = r.connect(); await r.hello(b, 'peer-0002');
  b.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'page', data: { to: 'peer-0002', page: PAGE } }));
  assert.equal(pages(b).length, 0, 'a channel - and the hub, which is the world channel\'s room - is nowhere to stand beside someone');
})));

test('JOURNAL1 relay: a page rides the cast arm\'s per-sender funnel onto its reader - one writer, one reader, one bucket with the spells and the cards - and the writer\'s own meter holds it to PAGE_HZ_MAX a second, striking a flood out in its own words (mutants: a funnel of its own; the funnel skipped; the meter unstruck)', () => withRoom('world:3,12', async ({ r, tick }) => {
  const me = r.connect(); await r.hello(me, 'peer-0001');
  const s = r.connect(); await r.hello(s, 'peer-0002');
  const o = r.connect(); await r.hello(o, 'peer-0003');
  tick(5000);
  me.sent.length = 0;
  for (let k = 0; k < CAST_HZ_MAX; k++) await r.raw(s, JSON.stringify({ t: 'cast', data: { to: 'peer-0001', level: 5, spell: HEAL_SPELL } }));
  assert.equal(me.sent.filter((m) => m.t === 'cast').length, CAST_HZ_MAX, 'the sender\'s bucket onto me, spent on spells');
  const page = JSON.stringify({ t: 'page', data: { to: 'peer-0001', page: PAGE } });
  await r.raw(s, page);
  assert.equal(pages(me).length, 0, 'the page waits on the bucket its writer\'s spells spent');
  await r.raw(o, page);
  assert.equal(pages(me).length, 1, 'another writer\'s slot is its own');
  tick(5000);
  me.sent.length = 0;
  for (let k = 0; k < PAGE_HZ_MAX + DROP_STRIKES_MAX; k++) await r.raw(s, page);
  assert.equal(s.closed, null, 'the strikes at the bound, not past it');
  assert.equal(s.meters.pageDrops, DROP_STRIKES_MAX);
  assert.equal(pages(me).length, PAGE_HZ_MAX, 'a second\'s worth reached me');
  await r.raw(s, page);
  assert.equal(s.closed?.reason, 'too many page frames', 'one past it, closed in its own words');
}));

// ─── THE SESSION ────────────────────────────────────────────────────────────────────────────────────────────────

function linkRig(relayV = RELAY_VERSION) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const got = []; s.onPage = (id, d) => got.push({ id, d });
  quiet(() => s.join('dungeon:m187', { x: 1, y: 0, z: 1, yaw: 0 }));
  const ws = sockets[0]; ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [{ id: 'peer-0002', name: 'Bran', p: { x: 2, y: 0, z: 1, yaw: 0 } }], host: 'aaaa-0001', world: null, v: relayV }));
  const out = () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'page');
  return { s, ws, got, out, tick: (ms) => { t += ms; } };
}

test('JOURNAL1 session: a page goes only to a relay that routes it (an older one would close the socket), through the page law first, to a peer some socket reports, PAGE_HZ_MAX a second; one in is delivered only when a peer\'s, addressed to ME and a page by the law, PAGE_IN_HZ_MAX a second per writer (mutants: the version door dropped; the law skipped on the way out; a page for someone else delivered)', () => {
  const old = linkRig('world100');
  assert.equal(old.s.pageOk, false);
  assert.equal(old.s.sendPage({ to: 'peer-0002', page: PAGE }), false);
  assert.equal(old.out().length, 0, 'nothing on the wire of a relay that would close the socket for it');
  const { s, got, out, ws, tick } = linkRig();
  assert.equal(s.pageOk, true);
  assert.equal(s.sendPage({ to: 'peer-0002', page: { head: ' h ', lines: [' a ', '', ''] } }), true);
  assert.deepEqual(out().at(-1), { t: 'page', data: { to: 'peer-0002', page: { head: 'h', lines: ['a'] } } }, 'the page as the law cleaned it');
  tick(1000);
  assert.equal(s.sendPage({ to: 'aaaa-0001', page: PAGE }), false, 'never at myself');
  assert.equal(s.sendPage({ to: 'peer-0009', page: PAGE }), false, 'nobody reports peer-0009');
  assert.equal(s.sendPage({ to: 'peer-0002', page: { head: '', lines: [] } }), false, 'a page the law refuses never leaves');
  assert.equal(s.sendPage({ to: 'peer-0002', page: PAGE }), true);
  assert.equal(s.sendPage({ to: 'peer-0002', page: PAGE }), false, 'PAGE_HZ_MAX a second');
  tick(1000);
  assert.equal(s.sendPage({ to: 'peer-0002', page: PAGE }), true);
  ws.receive({ t: 'page', id: 'peer-0002', data: { to: 'aaaa-0001', page: PAGE } });
  ws.receive({ t: 'page', id: 'peer-0002', data: { to: 'peer-0003', page: PAGE } });
  ws.receive({ t: 'page', id: 'aaaa-0001', data: { to: 'aaaa-0001', page: PAGE } });
  ws.receive({ t: 'page', data: { to: 'aaaa-0001', page: PAGE } });
  ws.receive({ t: 'page', id: 'peer-0003', data: { to: 'aaaa-0001', page: { head: '', lines: ['x'.repeat(PAGE_LINE_MAX + 1)] } } });
  assert.deepEqual(got, [{ id: 'peer-0002', d: { to: 'aaaa-0001', page: PAGE } }], 'someone else\'s, my own back, an unstamped frame, a page past the law: nothing');
  got.length = 0;
  tick(1000);
  for (let i = 0; i < PAGE_IN_HZ_MAX + 3; i++) quiet(() => ws.receive({ t: 'page', id: 'peer-0002', data: { to: 'aaaa-0001', page: PAGE } }));
  assert.equal(got.length, PAGE_IN_HZ_MAX, 'the inbound gate per writer, a second');
  ws.receive({ t: 'page', id: 'peer-0004', data: { to: 'aaaa-0001', page: PAGE } });
  assert.equal(got.at(-1).id, 'peer-0004', 'another writer has a bucket of its own');
});

// ─── A NOTE AS A PAGE, AND A PAGE KEPT ──────────────────────────────────────────────────────────────────────────

test('JOURNAL1 a note as the page it would be shown as - its dated head, its lines as the notebook laid them out (DFU\'s leading space gone), a filed break a blank line, through the page law - the same after a save; KEPT, a page is a note in the reader\'s own journal, dated where and when it was kept and saying whose it was, through the notebook\'s own AddNote(tokens) with every line takeable; a letter the same (mutants: the head read as a line; the break dropped; a kept line handed to the wrap raw)', () => {
  const nb = new PlayerNotebook({ dateTimeString: () => 'Morndas, 4th of Morning Star, 3E 405', cityName: () => 'Daggerfall' });
  nb.addNote('I met a strange man in the tavern who told me of a cave to the north where the wind howls like a wolf.');
  nb.addNoteTokens([{ formatting: 'question', text: 'Where is the Guild?' }, { formatting: 'answer', text: 'Past the fountain.' }, { formatting: 'text', text: '' }, { formatting: 'text', text: 'Remember.' }]);
  const first = pageOfNote(nb.getNote(0));
  assert.deepEqual(first, { page: { head: 'Morndas, 4th of Morning Star, 3E 405 in Daggerfall:', lines: ['I met a strange man in the tavern who told me of a cave to the north', 'where the wind howls like a wolf.'] } });
  assert.deepEqual(pageOfNote(nb.getNote(1)).page.lines, ['Where is the Guild?', 'Past the fountain.', '', 'Remember.'], 'a talk\'s filing, its break a blank line');
  assert.deepEqual(pageOfNote([{ formatting: 'text', text: ' ...and the rest.' }, { formatting: 'nothing', text: '' }]), { page: { head: '', lines: ['...and the rest.'] } }, 'a continuation, headless as the notebook files it');
  assert.deepEqual(pageOfNote(null), { error: 'no-words' });
  const back = new PlayerNotebook();
  back.restoreSaveData(nb.getSaveData());
  assert.deepEqual(pageOfNote(back.getNote(0)), first, 'a note restored from a save is the page it was');
  const long = [{ formatting: 'highlight', text: 'h' }, ...Array.from({ length: PAGE_LINES_MAX + 1 }, (_, i) => ({ formatting: 'text', text: `line ${i}` }))];
  assert.deepEqual(pageOfNote(long), { error: 'page-long' });
  assert.match(pageRefusalText('page-long'), new RegExp(`${PAGE_LINES_MAX} lines at most\\.$`));
  for (const e of ['no-words', 'line-long', 'head-long', 'no-page', 'anything']) assert.ok(pageRefusalText(e).endsWith('.'), e);
  // KEPT
  const mine = new PlayerNotebook({ dateTimeString: () => 'Tirdas, 5th of Morning Star, 3E 405', cityName: () => 'Wayrest' });
  mine.addNoteTokens(keptPageTokens('Ann', first.page));
  assert.equal(mine.getNote(0)[0].text, 'Tirdas, 5th of Morning Star, 3E 405 in Wayrest:', 'dated where and when it was kept - the notebook\'s own header');
  assert.deepEqual(pageOfNote(mine.getNote(0)).page.lines, ['From the journal of Ann - Morndas, 4th of Morning Star, 3E 405 in', 'Daggerfall:', '', ...first.page.lines]);
  assert.equal(keptPageTokens(null, { head: '', lines: ['x'] })[0].text, 'From the journal of someone:');
  assert.doesNotThrow(() => mine.addNoteTokens(keptPageTokens('Ann', { head: '', lines: ['W'.repeat(PAGE_LINE_MAX)] })), 'a page carries what the wrap throws on - kept anyway');
  const letter = { from: 'Bob', subject: 'Terms', body: `Dear Ann,\n\n${'X'.repeat(LETTER_BODY_MAX - 20)}` };
  const tokens = keptLetterTokens(letter);
  assert.deepEqual(tokens.slice(0, 4).map((t) => t.text), ['A letter from Bob: Terms', '', 'Dear Ann,', '']);
  const before = mine.getNotes().length;
  assert.doesNotThrow(() => mine.addNoteTokens(tokens), 'a letter of one word its whole length - kept');
  assert.ok(mine.getNotes().length > before);
  assert.ok(mine.getNotes().slice(before).flatMap(noteLines).every((l) => l.length <= MAX_LINE_LENGTH + 1));
});

test('JOURNAL1 a page as a letter: the draft MAIL1\'s form opens on - "A page from my journal", its head, a blank line, the page - which the service takes as it is; a page longer than a letter is refused in the form, never cut (mutants: the head dropped; the page cut to fit)', () => {
  assert.deepEqual(letterOfPage(PAGE), { subject: PAGE_LETTER_SUBJECT, body: 'Morndas in Daggerfall:\n\nMeet me\n\nat the Relic.' });
  assert.deepEqual(letterWords(letterOfPage(PAGE)), letterOfPage(PAGE), 'the service takes it as it is');
  assert.equal(letterOfPage({ head: '', lines: ['x'] }).body, 'x', 'a headless page: the page');
  const big = { head: 'h', lines: Array(PAGE_LINES_MAX).fill('l'.repeat(PAGE_LINE_MAX)) };
  assert.deepEqual(letterWords(letterOfPage(big)), { error: 'body-long' }, 'refused whole - the form keeps the draft to be cut down by its writer');
});

test('JOURNAL1 the pages held out to me: one per writer - the newest replacing their last, not kept yet - waiting PAGE_HOLD_MS; said once in PAGE_NOTICE_MS per writer, however many they hold out; PAGE_OFFERS_MAX writers at once, the stalest going; a writer who leaves takes theirs (mutants: every page said; the hold never ending; the kept mark surviving a new page)', () => {
  let t = 0;
  const o = new PageOffers({ now: () => t });
  const p1 = { head: '', lines: ['one'] }, p2 = { head: '', lines: ['two'] };
  assert.equal(o.offer('a', p1, 'Ann'), true, 'the first is said');
  assert.deepEqual(o.get('a'), { page: p1, name: 'Ann', kept: false });
  o.markKept('a', p2);
  assert.equal(o.get('a').kept, false, 'keeping a page they no longer hold out keeps nothing of the one they do');
  o.markKept('a', p1);
  assert.equal(o.get('a').kept, true);
  t = PAGE_NOTICE_MS - 1;
  assert.equal(o.offer('a', p2, 'Ann'), false, 'a second inside the notice is held, not said');
  assert.deepEqual(o.get('a'), { page: p2, name: 'Ann', kept: false }, 'the newest replaces the last, and is not kept yet');
  t = PAGE_NOTICE_MS;
  assert.equal(o.offer('a', p1, 'Ann'), true, 'said again once the notice is out');
  t += PAGE_HOLD_MS;
  assert.ok(o.get('a'), 'held to the hold');
  t += 1;
  assert.equal(o.get('a'), null, 'and gone past it');
  for (let i = 0; i <= PAGE_OFFERS_MAX; i++) o.offer(`w${i}`, p1);
  assert.equal(o.held.size, PAGE_OFFERS_MAX);
  assert.equal(o.get('w0'), null, 'the stalest writer\'s page went');
  assert.ok(o.get(`w${PAGE_OFFERS_MAX}`));
  o.keepOnly(new Map([['w3', {}]]));
  assert.deepEqual([...o.held.keys()], ['w3'], 'the writers who left took theirs - the session\'s own peer map asked, with no copy');
  o.clear();
  assert.equal(o.held.size, 0);
  assert.equal(pageOfferText('Ann', 'press F on them'), 'Ann holds out a page of their journal - press F on them to read it.');
  assert.equal(pageOfferText(null), 'Someone holds out a page of their journal - turn to them to read it.');
  assert.equal(pageShownText('Bran'), 'You hold out the page to Bran.');
  assert.equal(pageTooFarText('Bran'), 'Bran is not near enough any more.');
  assert.equal(pageTooFarText(null), 'They are not near enough any more.');
});

// ─── THE READER'S WINDOW AND THE F-MENU'S ROW ───────────────────────────────────────────────────────────────────

function fakeNode(tag, doc, ns = null) {
  const n = {
    tag, ns, doc, children: [], attrs: {}, style: {}, dataset: {}, listeners: {}, className: '', textContent: '', id: '',
    append(...cs) { for (const c of cs) if (c) n.children.push(c); },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return n.attrs[k] ?? null; },
    addEventListener(t, fn) { (n.listeners[t] ??= []).push(fn); },
    fire(t, ev = {}) { for (const fn of n.listeners[t] ?? []) fn({ stopPropagation() {}, preventDefault() {}, ...ev }); },
    focus() { doc.focused = n; }, remove() { n.removed = true; },
  };
  return n;
}
function fakeDoc() {
  const doc = {};
  doc.createElement = (t) => fakeNode(t, doc);
  doc.createElementNS = (ns, t) => fakeNode(t, doc, ns);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = (id) => doc.head.children.find((c) => c.id === id) ?? null;
  return doc;
}
function fakeWin() {
  const ls = [];
  return { addEventListener(t, fn, cap) { ls.push({ t, fn, cap }); }, removeEventListener(t, fn) { const i = ls.findIndex((l) => l.fn === fn); if (i >= 0) ls.splice(i, 1); },
    key(code, target = null) { const ev = { type: 'keydown', code, target, stopped: false, preventDefault() {}, stopImmediatePropagation() { ev.stopped = true; } }; for (const l of ls.filter((x) => x.t === 'keydown')) l.fn(ev); return ev; }, count: () => ls.length };
}
const all = (n, cls, out = []) => { if (`${n.className ?? ''}`.split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) all(c, cls, out); return out; };
const text = (n) => (n.textContent || '') + (n.children ?? []).map(text).join('');

test('JOURNAL1 the reader\'s window: whose journal, the date they wrote it, the page as they laid it out (a blank line keeping its height); Keep files the page the card SHOWS under the name it shows, once, and says so; a host with no journal draws no Keep; Put it away, Escape and a window over the HUD take it down and hand the pointer back once; a surface above keeps its Escape (mutants: Keep twice; a refused keep drawn as kept; Escape eaten under a surface above)', () => {
  const doc = fakeDoc(), win = fakeWin();
  let opened = 0, closed = 0, over = false, keepOk = false;
  const keeps = [];
  const w = createPageWindow({ doc, win, onOpen: () => opened++, onClose: () => closed++, onKeep: (id, v) => { keeps.push([id, v.name, v.page]); return keepOk; }, above: () => over });
  assert.ok(doc.getElementById('dagger-page-style'), 'its sheet, injected once');
  assert.equal(w.show('peer-0002', pageView({ name: 'Ann', page: PAGE })), true);
  assert.equal(opened, 1);
  const card = () => w.root.children[0];
  const btns = () => all(card(), 'dfpage-btn');
  assert.equal(text(all(card(), 'dfpage-title')[0]), 'Ann\'s journal');
  assert.equal(text(all(card(), 'dfpage-when')[0]), 'Morndas in Daggerfall:');
  assert.deepEqual(all(card(), 'dfpage-line').map(text), ['Meet me', '', 'at the Relic.']);
  assert.deepEqual(btns().map(text), [PAGE_KEEP_TEXT, PAGE_CLOSE_TEXT]);
  btns()[0].fire('click');
  assert.equal(btns()[0].disabled, false, 'a keep the host refused is not drawn as kept');
  keepOk = true;
  btns()[0].fire('click');
  assert.deepEqual(keeps.at(-1), ['peer-0002', 'Ann', PAGE], 'the page the card shows, under the name it shows');
  assert.equal(text(btns()[0]), PAGE_KEPT_TEXT);
  assert.equal(btns()[0].disabled, true);
  assert.equal(text(all(card(), 'dfpage-note')[0]), 'A copy is in your journal, under Notes.');
  btns()[0].fire('click');
  assert.equal(keeps.length, 2, 'kept once');
  w.show('peer-0003', pageView({ name: 'Cid', page: PAGE, canKeep: false }));
  assert.deepEqual(btns().map(text), [PAGE_CLOSE_TEXT], 'no journal, no Keep');
  assert.equal(opened, 1, 'a second page over the first frees nothing twice');
  over = true;
  const kept = win.key('Escape');
  assert.equal(w.isOpen(), true); assert.equal(kept.stopped, false);
  over = false;
  const shut = win.key('Escape');
  assert.equal(w.isOpen(), false); assert.equal(shut.stopped, true, 'the key is spent - no pause door under it');
  assert.equal(closed, 1);
  w.show('peer-0002', pageView({ name: 'Ann', page: PAGE, kept: true }));
  assert.equal(text(btns()[0]), PAGE_KEPT_TEXT, 'a page already kept says so when read again');
  btns().at(-1).fire('click');
  assert.equal(w.isOpen(), false); assert.equal(closed, 2);
  w.show('peer-0002', pageView({ name: 'Ann', page: PAGE }));
  w.render({ covered: true });
  assert.equal(w.isOpen(), false); assert.equal(closed, 3);
  const gated = createPageWindow({ doc, win, canOpen: () => false });
  assert.equal(gated.show('peer-0002', pageView({ page: PAGE })), false);
  const before = win.count();
  w.destroy(); gated.destroy();
  assert.equal(win.count(), before - 2, 'each took its one listener with it');
  assert.deepEqual([pageView({}).title, pageView({}).lines], ['Someone\'s journal', []]);
  assert.match(PAGE_CSS, /\.dfpage-line \{[^}]*overflow-wrap: anywhere;[^}]*min-height: 1\.5em;/, 'a word too long breaks inside the card; a blank line keeps its height');
  assert.match(PAGE_CSS, /\.dfpage-leaf \{[^}]*min-height: 0; overflow-y: auto;/, 'the page scrolls inside the card, so its buttons stand');
  assert.match(PAGE_CSS, /\.dfpage-btn \{[^}]*min-height: 44px;/, 'a button a thumb can press');
});

test('JOURNAL1 the F-menu\'s row: "Read their page" only while a page they hold out waits - after the look, before the rest - acting `page.read` on that peer; the World Tooltips plaque lists it and presses it through the same act, and a page gone is a row gone (mutants: the row always drawn; the row drawn on false; the act\'s kind)', () => {
  assert.deepEqual(socialMenuRows({ peerId: 'p', canInspect: true, canReadPage: true }).map((r) => r.key), ['inspect', 'page', 'friend', 'invite', 'cancel']);
  assert.deepEqual(socialMenuRows({ peerId: 'p', canInspect: true, canReadPage: false }).map((r) => r.key), ['inspect', 'friend', 'invite', 'cancel']);
  assert.deepEqual(socialMenuRows({ peerId: 'p' }).map((r) => r.key), ['friend', 'invite', 'cancel'], 'a host that says nothing gets the menu it always had');
  assert.deepEqual(socialMenuRows({ peerId: 'p', canReadPage: true }).find((r) => r.key === 'page'), { key: 'page', label: 'Read their page', enabled: true, why: null, act: { k: 'page.read', peer: 'p' } });
  assert.deepEqual(socialPlaqueRows('p', { canInspect: true, canReadPage: true }).slice(0, 2), [{ id: 'inspect', label: 'Inspect' }, { id: 'page', label: 'Read their page' }]);
  assert.deepEqual(plaqueRowFor('page', 'p', { canReadPage: true }), { act: { k: 'page.read', peer: 'p' }, refusal: null });
  assert.equal(plaqueRowFor('page', 'p', { canReadPage: false }), null, 'a page gone, a row gone');
});

// ─── THE CHRONICLE'S SHARE ──────────────────────────────────────────────────────────────────────────────────────

/** The enhanced chronicle over a fake document: it draws with the global `document` and listens on the global
 *  `window`, so both are stood in for the mount and put back. A node's `innerHTML = ''` empties it, as the window's
 *  render relies on; `onclick` is a property, pressed by calling it. */
function chronicleRig(deps) {
  const node = (tag) => {
    const n = { tag, children: [], attrs: {}, style: {}, dataset: {}, className: '', textContent: '', listeners: {},
      classList: { add(c) { n.className = `${n.className} ${c}`.trim(); } },
      append(...cs) { for (const c of cs) if (c) n.children.push(c); },
      setAttribute(k, v) { n.attrs[k] = String(v); },
      addEventListener(t, fn) { (n.listeners[t] ??= []).push(fn); }, removeEventListener() {},
      remove() { n.removed = true; } };
    Object.defineProperty(n, 'innerHTML', { set() { n.children = []; }, get() { return ''; } });
    return n;
  };
  const doc = { createElement: node, createTextNode: (t) => ({ textContent: t, children: [] }) };
  doc.head = node('head'); doc.body = node('body');
  doc.getElementById = (id) => doc.head.children.find((c) => c.id === id) ?? null;
  const prev = { document: globalThis.document, window: globalThis.window };
  globalThis.document = doc;
  globalThis.window = fakeWin();
  const host = node('div');
  const view = mountEnhancedChronicle(host, deps);
  return { host, restore() { view.destroy(); globalThis.document = prev.document; globalThis.window = prev.window; } };
}
const press = (root, cls, label) => { const b = all(root, cls).find((x) => text(x) === label); assert.ok(b, `a "${label}" to press`); b.onclick(); };

test('JOURNAL1 the chronicle\'s Share: a NOTE offers to be shown or sent where the host can share at all; its strip names the players near enough to talk to, holds the page out to the one pressed and says what happened - or says why nobody can be shown it; the letter closes the chronicle so the letters can open on the page, or says why not; a page the law refuses says why; the composer takes 200 characters with no space; and a note\'s share and remove act on the note the card DRAWS, whatever an empty entry did to the list (mutants: Share on every section; the strip on every note; the card\'s place taken for the note\'s; the letter left standing)', () => {
  const nb = new PlayerNotebook({ dateTimeString: () => 'Morndas', cityName: () => 'Daggerfall' });
  nb.addNote('The first note.');
  nb.notes.push([]);   // an empty entry - dropped from the drawing, as a hand-edited save's would be
  nb.addNote('The third note, which the second card draws.');
  const shown = [];
  let letterAnswer = 'Letters need a registered account.', exited = 0;
  const share = {
    readers: [{ id: 'peer-0002', name: 'Bran' }], why: null,
    show: (id, page) => { shown.push([id, page]); return pageShownText('Bran'); },
    letter: (page) => { shown.push(['letter', page]); return letterAnswer; },
  };
  const rig = chronicleRig({ notebook: () => nb, section: 'notes', pageShare: () => share, onExit: () => exited++ });
  try {
    const shares = () => all(rig.host, 'cr-share');
    assert.equal(shares().length, 2, 'a Share on each note the chronicle draws');
    assert.equal(all(rig.host, 'cr-sharebox').length, 0, 'no strip until one is asked for');
    shares()[1].onclick();
    assert.equal(all(rig.host, 'cr-sharebox').length, 1, 'one strip, under the note that asked');
    assert.equal(shares()[1].attrs['aria-expanded'], 'true');
    press(rig.host, 'act', 'Bran');
    assert.deepEqual(shown[0], ['peer-0002', { head: 'Morndas in Daggerfall:', lines: ['The third note, which the second card draws.'] }], 'the page of the note the card draws - its place in the notebook, not in the list');
    assert.ok(text(rig.host).includes('You hold out the page to Bran.'), 'what happened, said under it');
    press(rig.host, 'act', 'Send as a letter');
    assert.equal(exited, 0);
    assert.ok(text(rig.host).includes('Letters need a registered account.'), 'a letter that cannot go says why, and the chronicle stands');
    letterAnswer = true;
    press(rig.host, 'act', 'Send as a letter');
    assert.equal(exited, 1, 'the chronicle comes down, so the letters can open on the page');
    share.readers = []; share.why = 'No one is near enough to show it to.';
    shares()[1].onclick(); shares()[1].onclick();
    assert.ok(text(rig.host).includes('No one is near enough to show it to.'), 'the host\'s word in the readers\' place');
    // the composer: two hundred characters with no space in them - DFU's wrap throws on seventy-one
    const input = all(rig.host, 'cr-compose')[0].children[0];
    input.value = 'Q'.repeat(200);
    input.oninput();
    all(rig.host, 'cr-compose')[0].onsubmit({ preventDefault() {} });
    assert.equal(nb.getNotes().length, 4, 'the note is filed - it threw out of the handler before');
    assert.ok(noteLines(nb.getNote(3)).every((l) => l.length <= MAX_LINE_LENGTH + 1));
    // the remove: the note the second card draws is the notebook's third
    const removes = all(rig.host, 'cr-rm').filter((b) => !b.className.includes('cr-share'));
    removes[1].onclick();
    assert.deepEqual(nb.getNotes().map((n) => noteLines(n)[0] ?? null), [' The first note.', null, ` ${'Q'.repeat(70)}`], 'the third note went - the empty entry and the others stand');
  } finally { rig.restore(); }
  // a page the law refuses says why, in place of the readers
  const longNb = new PlayerNotebook();
  longNb.addNoteTokens(Array.from({ length: 30 }, (_, i) => ({ formatting: 'text', text: `line ${i}` })));
  longNb.notes[0].push(...Array.from({ length: PAGE_LINES_MAX }, () => [{ formatting: 'text', text: ' more' }, { formatting: 'nothing', text: '' }]).flat());
  const refused = chronicleRig({ notebook: () => longNb, section: 'notes', pageShare: () => share });
  try {
    all(refused.host, 'cr-share')[0].onclick();
    assert.ok(text(refused.host).includes(pageRefusalText('page-long')));
    assert.equal(all(refused.host, 'act').filter((b) => text(b) === 'Send as a letter').length, 0, 'and offers nothing it cannot do');
  } finally { refused.restore(); }
  // no word from the host - no online layer - no Share; and never on a message
  const bare = chronicleRig({ notebook: () => nb, section: 'notes' });
  try { assert.equal(all(bare.host, 'cr-share').length, 0); } finally { bare.restore(); }
  nb.addMessage('A message.');
  const msgs = chronicleRig({ notebook: () => nb, section: 'messages', pageShare: () => share });
  try { assert.equal(all(msgs.host, 'cr-share').length, 0, 'a message is what I was told, not my journal'); } finally { msgs.restore(); }
  // THE SHEET (tools/journalProbe.mjs measures it): a word too long for the column breaks inside the card - the probe
  // found a note's seventy-column run of one word running out of it and the section scrolling sideways - and a reader's
  // name at its bound breaks inside its button; on a finger's device the strip's buttons are a finger's
  const css = rd('src/ui/enhancedStyle.js');
  assert.match(css, /\.cr-shell \.cr-prose p, \.cr-shell \.cr-entry p \{[^}]*overflow-wrap: anywhere;/);
  assert.match(css, /\.cr-shell \.cr-sharebox \.act \{ max-width: 100%; overflow-wrap: anywhere;/);
  assert.match(css, /@media \(pointer: coarse\) \{ \.cr-shell \.cr-sharebox \.act \{ min-height: 44px; \} \}/);
});

// ─── THE LETTERS TAB ────────────────────────────────────────────────────────────────────────────────────────────

function panelDoc() {
  const doc = { activeElement: null };
  const node = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '',
      style: {}, dataset: {}, attrs: {}, listeners: new Map(),
      append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
      replaceChildren(...cs) { n.children = []; n.append(...cs); },
      setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
      removeEventListener() {},
      fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
      focus() { doc.activeElement = n; },
      remove() { n.removed = true; },
    };
    return n;
  };
  doc.createElement = node;
  doc.head = node('head'); doc.body = node('body');
  doc.getElementById = () => null;
  return doc;
}
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const btnNamed = (root, label) => all(root, 'dfsocial-btn').find((b) => b.children.length ? text(b).startsWith(label) : b.textContent === label);

test('JOURNAL1 the Letters tab: a page sent as a letter opens the form on it - its subject and body, to anyone the player names; a letter read offers Keep in my journal - once, said, and refused in words where the journal cannot take it; a host with no journal draws no Keep (mutants: the draft dropped; Keep twice; a refused keep drawn as kept)', async () => {
  const now = Math.floor(Date.now() / 1000);
  const head = { id: 'letter00000000000001', from: 'Ann', title: null, glyphs: [], subject: 'Terms', sentAt: now, read: false };
  const answer = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
  const fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path === '/v1/mail/inbox') return answer({ letters: [head], unread: 1, max: 50 });
    if (path === '/v1/mail/read') return answer({ letter: { ...head, body: 'Twenty gold.\n\nPaid.', readAt: now, read: true } });
    return answer({ ok: true });
  };
  const rig = (keepLetter) => {
    const box = new MailBox({ ioOf: () => ({ fetch, base: 'https://svc', secret: 's'.repeat(43) }) });
    const panel = createSocialPanel({ social: new SocialState({ acct: 'acct-bob' }), mail: box, keepLetter, doc: panelDoc(), win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
    return { box, panel };
  };
  // the page as a letter
  const { panel } = rig(null);
  assert.equal(panel.openLetters({ draft: letterOfPage(PAGE) }), true);
  panel.render();
  assert.equal(panel.lettersView(), 'write');
  const [to, subject, body] = all(panel.root, 'dfsocial-field');
  assert.deepEqual([to.value, subject.value, body.value], ['', PAGE_LETTER_SUBJECT, 'Morndas in Daggerfall:\n\nMeet me\n\nat the Relic.'], 'to anyone - the page in the form');
  // a letter read, and kept
  const kept = [];
  let keepOk = false;
  const withKeep = rig((l) => { kept.push(l); return keepOk; });
  withKeep.panel.openLetters();
  await settle(); withKeep.panel.render();
  all(withKeep.panel.root, 'dfsocial-letter')[0].fire('click');
  await settle(); withKeep.panel.render();
  assert.equal(withKeep.panel.lettersView(), 'read');
  btnNamed(withKeep.panel.root, 'Keep in my journal').fire('click');
  withKeep.panel.render();
  assert.equal(kept.length, 1);
  assert.ok(text(withKeep.panel.root).includes(LETTER_KEEP_FAILED_TEXT), 'a journal that cannot take it says so');
  assert.ok(btnNamed(withKeep.panel.root, 'Keep in my journal'), 'and Keep stands to be pressed again');
  keepOk = true;
  btnNamed(withKeep.panel.root, 'Keep in my journal').fire('click');
  withKeep.panel.render();
  assert.equal(kept.length, 2);
  assert.deepEqual([kept[1].id, kept[1].from, kept[1].subject, kept[1].body], [head.id, 'Ann', 'Terms', 'Twenty gold.\n\nPaid.'], 'the letter as it was read');
  const done = btnNamed(withKeep.panel.root, 'Kept in your journal');
  assert.ok(done && done.disabled, 'kept, and said on the button');
  assert.ok(text(withKeep.panel.root).includes(LETTER_KEPT_NOTE));
  assert.ok(!text(withKeep.panel.root).includes(LETTER_KEEP_FAILED_TEXT), 'the refusal gone with the keep');
  // no journal handed in: no Keep
  const bare = rig(null);
  bare.panel.openLetters();
  await settle(); bare.panel.render();
  all(bare.panel.root, 'dfsocial-letter')[0].fire('click');
  await settle(); bare.panel.render();
  assert.equal(bare.panel.lettersView(), 'read');
  assert.equal(btnNamed(bare.panel.root, 'Keep in my journal'), undefined);
});

// ─── THE HOST ───────────────────────────────────────────────────────────────────────────────────────────────────

test('JOURNAL1 host by source: a page held out to me is HELD with its writer\'s name and said with how to read it - never opened on its own; it is read from the F-menu (the one bag), put away by F, taken with a window over the HUD, swept when its writer leaves; the chronicle\'s Share names who stands within the reach a talk has and measures again at the press; the letter waits for the chronicle to come down; kept pages and letters are the notebook\'s own AddNote(tokens); the Share reaches the dungeon\'s chronicle too; the relay\'s arm is the card\'s with the chat\'s mute (mutants: a page opened on arrival; the reach off the trade\'s; the press unmeasured; the letter opened under the chronicle)', () => {
  const w = rd('src/scenes/world.js');
  const onPage = w.slice(w.indexOf('online.onPage = (id, d) => {'), w.indexOf('online.onAct = '));
  assert.match(onPage, /if \(!socialMenu \|\| !pageWin \|\| !d\?\.page\) return;\s*\n\s*if \(!pageOffers\.offer\(id, d\.page, peerName\(id\)\)\) return;\s*\n\s*tradeSay\(pageOfferText\(peerName\(id\), pageReadHow\(\)\)\);/);
  assert.doesNotMatch(onPage, /pageWin\.show|readPage/, 'nothing opens over the reader\'s game on its own');
  const block = w.slice(w.indexOf('const pageReadHow = () => {'), w.indexOf('const pageFrame = () => {'));
  assert.match(block, /if \(isTouchDevice\(\)\) return 'face them and press /, 'on a phone, the social button - ui/touch.js\'s own F');
  assert.match(block, /const tag = quickslotTag\('SocialInteract', \{ bindings: bindings\(\) \}\);\s*\n\s*return tag\?\.kind === 'key' \? `press \$\{tag\.text\} on them` : null;/, 'the F-menu\'s own key, off the live bindings');
  assert.match(w, /canInspect: true, canReadPage: !!pageOffers\.get\(peerId\), \.\.\.duelActionsFor\(peerId\) \}\);/, 'the one bag');
  assert.match(w, /if \(act\.k === 'page\.read'\) \{ readPage\(act\.peer\); return; \}/);
  assert.match(block, /const o = pageOffers\.get\(peerId\);\s*\n\s*if \(!o \|\| !pageWin\) \{ tradeSay\(PAGE_GONE_TEXT\); return false; \}\s*\n\s*return pageWin\.show\(peerId, pageView\(\{ name: o\.name \?\? peerName\(peerId\), page: o\.page, kept: o\.kept, canKeep: !!questBridge\?\.notebook \}\)\);/);
  assert.match(w, /if \(pageWin\?\.isOpen\(\)\) \{ pageWin\.hide\(\); return true; \}/, 'F again puts it away');
  assert.match(w, /pageWin\?\.render\(\{ covered: townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\) \|\| gamePaused\(\) \}\);/);
  assert.match(w, /profileFrame\(\);[^\n]*\n\s*pageFrame\(\);/, 'swept each frame, before the dead return');
  assert.match(w.slice(w.indexOf('const pageFrame = () => {'), w.indexOf('const pageFrame = () => {') + 300), /pageOffers\.keepOnly\(online\.peers\);/, 'nothing made on a frame');
  assert.match(w, /pageWin = createPageWindow\(\{\s*doc: document, win: globalThis,\s*canOpen: socialMenuCanOpen,\s*onOpen: \(\) => surfaceOpen\('page'\),\s*onClose: \(\) => surfaceClose\('page'\),\s*onKeep: \(peerId, view\) => keepPage\(peerId, view\),/, 'a counted pointer surface, under the F-menu\'s own gate');
  assert.match(block, /d: tradeDistance\(me, p\.feet\)/, 'metres between two bodies - the trade\'s one measure');
  assert.match(block, /\.filter\(\(p\) => p\.d <= SOCIAL_REACH && online\.reachesPeer\(p\.id\)\)\s*\n\s*\.sort\(\(a, b\) => a\.d - b\.d\)/, 'within the reach a talk has, a socket of mine reporting them, nearest first');
  assert.match(block, /if \(!pageReaders\(\)\.some\(\(p\) => p\.id === id\)\) return pageTooFarText\(name\);\s*\n\s*return online\.sendPage\(\{ to: id, page \}\) \? pageShownText\(name\) : `\$\{TRY_AGAIN_TEXT\}\.`;/, 'measured again at the press');
  assert.match(block, /_letterPending = \{ draft: letterOfPage\(page\), at: performance\.now\(\) \};\s*\n\s*return true;/);
  assert.match(w, /if \(socialPanel\?\.openLetters\(\{ draft: _letterPending\.draft \}\)\) _letterPending = null;\s*\n\s*else if \(performance\.now\(\) - _letterPending\.at > LETTER_PENDING_MS\)/, 'the letters open the first frame the panel may stand, or it is said they could not');
  assert.match(block, /nb\.addNoteTokens\(keptPageTokens\(view\.name, view\.page\)\);\s*\n\s*pageOffers\.markKept\(peerId, view\.page\);/, 'the page the window SHOWS marked kept, and no newer one');
  assert.match(block, /nb\.addNoteTokens\(keptLetterTokens\(letter\)\);/);
  assert.match(w, /keepLetter: \(letter\) => keepLetterInJournal\(letter\),/);
  assert.match(w, /shareQuest: shareQuestWithParty,\s*\n\s*\/\/ JOURNAL1[^\n]*\n\s*pageShare: \(\) => pageShareHere\(\),/, 'the world\'s chronicle and the interiors\' (makeJournal)');
  assert.match(w, /pageShare: \(\) => pageShareHere\(\),   \/\/ JOURNAL1: a note's Share, delegated/, 'the modes\' own delegation');
  assert.match(rd('src/scenes/worldModes.js'), /pageShare: \(\) => host\.pageShare\?\.\(\) \?\? null,/);
  assert.match(rd('src/scenes/dungeonContext.js'), /pageShare: \(\) => opts\.pageShare\?\.\(\) \?\? null,/, 'the dungeon\'s chronicle');
  const relay = rd('server/src/index.js');
  const arm = relay.slice(relay.indexOf("if (m.t === 'page') {"), relay.indexOf("if (m.t === 'park') {"));
  assert.match(arm, /a = this\._meterPage\(ws, a, now\); if \(!a\) return;\s*\n\s*if \(a\.mu && a\.mu > Math\.floor\(now \/ 1000\)\) \{ this\._send\(ws, JSON\.stringify\(\{ t: 'muted', until: a\.mu \}\)\); return; \}\s*\n\s*if \(isChatRoom\(a\.key\) \|\| isSocialRoom\(a\.key\)\) return;/, 'its meter, then the mute, then a place room alone');
  assert.match(arm, /if \(!this\._senderFunnel\(tws, a\.id, now\)\) return;\s*\n\s*this\._send\(tws, JSON\.stringify\(\{ t: 'page', id: a\.id, data: m\.data \}\)\);/, 'the funnel shared');
  assert.match(relay, /_meterPage\(ws, a, now\) \{ return this\._spend\(ws, now, pageGate, 'pageBucket', 'pageDrops', 'too many page frames'\) \? a : null; \}/);
});
