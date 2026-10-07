// TEXT-F1 (2026-10-07, Mac: "Any human input elements need filtering, including notes"): A PLAYER'S WORDS, FILTERED.
// NAME-F1's filter judged a NAME, read whole; a sentence read whole hides every word in it. net/nameFilter.js now reads a
// line word by word (maskText, textCaught) and the laws every player's words pass through star what it catches: a chat
// line, a red line and a narration (wire.js sanitizeChat - both ends and the relay's parse), a letter's lines, a note's,
// a guild note's and a journal page's (wire.js wordsLine - net/letterLaw.js, the board's law, the page law). Name-shaped
// words are judged instead: a rank's name refused naming the word, a custom class dropped from a look, a maker's mark left
// off, an item's typed name starred wherever it is named. The record: bible/06-Systems/Online-Arc.md TEXT-F1.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { maskText, textCaught, checkName, ANYWHERE, CRUDE, SLURS, listIsNormalised } from '../src/net/nameFilter.js';
import { sanitizeChat, wordsLine, parseClient, validLook, CHAT_MAX } from '../src/net/wire.js';
import { letterWords } from '../src/net/letterLaw.js';
import { noteWords } from '../src/net/boardLaw.js';
import { makerMark, makerName } from '../src/net/recipeLaw.js';
import { resolveItemName, shownItemName } from '../src/systems/itemInfo.js';
import { REFUSALS } from '../src/net/accountClient.js';
import { guildWordText } from '../src/ui/socialPanel.js';
import { standService } from './accountDb.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('TEXT-F1 the reader: a line read word by word - an insult in a sentence starred letter for letter, its spaces and its marks kept; the leet, the padded, the stretched, the spelled-out, the bracketed and the compound caught (mutants: the line read whole; the spelled-out let pass; a sentence mark starred with its word; the anywhere words read standing alone)', () => {
  const cases = [
    ['you are an ass', 'you are an ***'],
    ['f u c k this', '* * * * this'],
    ['f.u.c.k', '*.*.*.*'],
    ['go f u c k u', 'go * * * * u'],
    ['fuck!', '****!'],
    ['what?! shit!!', 'what?! ****!!'],
    ['(dick)', '(****)'],
    ['Sh!t happens', '**** happens'],
    ['a55 and @$$', '*** and ***'],
    ['xXfuckXx', '********'],
    ['fuuuuuck', '********'],
    ['what a motherfucker', 'what a ************'],
    ["an asshole's note", "an *******'s note"],
    ['Shitting', '********'],
  ];
  for (const [line, starred] of cases) assert.equal(maskText(line), starred, line);
  assert.equal(textCaught('you are an ass'), 'ass', 'the verdict names the word, as the list writes it');
  assert.equal(textCaught('fine words, then a slur: faggot'), 'faggot');
  assert.equal(textCaught('all fine'), null);
});

test('TEXT-F1 the innocent: a place, a person and the port\'s own words pass - Scunthorpe, Penistone, Cockburn, Dickens, the assassin, the arsenal, Titus, a cocoon; the server\'s own words in a sentence; a number; and every name the port carries reads unchanged (mutants: the server\'s words read; a number read)', async () => {
  const fine = ['Scunthorpe and Penistone near Cockburn', 'Charles Dickens', 'The Dark Brotherhood assassin passed the class',
    'Arsenal and arsenic', 'Titus the Titan', 'a cocoon in a raccoon nest', 'cumulative circumstance', 'swanky spice',
    'ask a mod, the server restarts at eight', 'Admin of the staff', '8008 gold, 455 arrows', 'I am a b c', 'assess the passage'];
  for (const line of fine) assert.equal(maskText(line), line, line);
  // every name the port quotes in its own source - an item, a place, a book, a monster - passes untouched
  const names = new Set();
  const { readdirSync, statSync } = await import('node:fs');
  const walk = (d) => { for (const f of readdirSync(new URL(`../${d}`, import.meta.url))) { const p = `${d}/${f}`; if (statSync(new URL(`../${p}`, import.meta.url)).isDirectory()) walk(p); else if (p.endsWith('.js')) for (const m of src(p).matchAll(/(?:name|title|Name|label): ['"]([A-Z][^'"]{2,48})['"]/g)) names.add(m[1]); } };
  walk('src');
  assert.ok(names.size > 500, `${names.size} names read`);
  assert.deepEqual([...names].filter((n) => maskText(n) !== n), [], 'no name the port carries is starred');
});

test('TEXT-F1 idempotent and bounded: a line starred twice reads as once, its length kept, so a bound measured before holds after; a starred word has nothing left to catch (mutants: none)', () => {
  for (const line of ['f u c k', 'fuck you, asshole!', 'a s s h o l e', 'Shitting on the xXfuckXx', 'fine']) {
    const once = maskText(line);
    assert.equal(maskText(once), once, line);
    assert.equal(once.length, line.length, line);
    assert.equal(sanitizeChat(sanitizeChat(line)), sanitizeChat(line));
    assert.equal(wordsLine(wordsLine(line)), wordsLine(line));
  }
  const long = `${'word '.repeat(60)}fuck`.slice(0, CHAT_MAX + 40);
  assert.ok(sanitizeChat(long).length <= CHAT_MAX);
});

test('TEXT-F1 names: the words no word hides innocently are caught anywhere in a name, the compounds a sentence reaches for are words of the lists, and the real places still pass; every list survives the normaliser (mutants: a name read for the anywhere words no more)', () => {
  assert.deepEqual([checkName('Motherfucker').ok, checkName('Motherfucker').word, checkName('Motherfucker').kind], [false, 'fuck', 'crude']);
  assert.deepEqual([checkName('xXfaggotlordXx').ok, checkName('xXfaggotlordXx').kind], [false, 'slur']);
  assert.equal(checkName('Asshole').ok, false);
  for (const real of ['Scunthorpe', 'Penistone', 'Cockburn', 'Shitterton', 'Dickens', 'Titus']) assert.equal(checkName(real).ok, true, real);
  for (const { words } of ANYWHERE) assert.ok(listIsNormalised(words));
  assert.ok(listIsNormalised(CRUDE) && listIsNormalised(SLURS));
  for (const w of ['asshole', 'arsehole', 'bullshit', 'dickhead', 'dipshit', 'dumbass', 'shithead']) assert.ok(CRUDE.includes(w), w);
  assert.ok(SLURS.includes('nigga'));
});

test('TEXT-F1 the wire: a chat line starred by sanitizeChat - and so by the relay\'s parse of a chat, a red line and a narration - a letter\'s, a note\'s and a page\'s lines by wordsLine; a custom class the filter catches is no class, a clean one stands (mutants: the chat unstarred; the words unstarred; the class kept)', () => {
  assert.equal(sanitizeChat('  you   ass  '), 'you ***');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: 'shut up, dickhead' }), { hasHello: true }), { t: 'chat', text: 'shut up, ********' });
  for (const t of ['say', 'narrate']) assert.equal(parseClient(JSON.stringify({ t, text: 'the bastard' }), { hasHello: true }).text, 'the *******', t);
  assert.equal(wordsLine('\tyou  twat '), 'you ****');
  assert.deepEqual(letterWords({ subject: 'Hello, dickhead', body: 'Line one.\nYou are a prick.' }), { subject: 'Hello, ********', body: 'Line one.\nYou are a *****.' });
  const note = noteWords({ subject: 'Party tonight', body: 'Bring potions, assholes.', days: 3 });
  assert.equal(note.body, 'Bring potions, ********.', 'a caught word starred whole, its plural with it');
  const page = parseClient(JSON.stringify({ t: 'page', data: { to: 'peer-0002', page: { head: 'For the cunt', lines: ['fine', 'shit'] } } }), { hasHello: true });
  assert.deepEqual(page.data?.page ?? page.page ?? null, { head: 'For the ****', lines: ['fine', '****'] });
  const look = (klass) => validLook({ race: 'Breton', gender: 'male', faceIndex: 0, class: klass, items: [] });
  assert.equal('class' in look('Shit Lord'), false, 'a caught class is no class at all');
  assert.equal(look('Spellsword').class, 'Spellsword');
  assert.equal(look('City Watch').class, 'City Watch');
});

test('TEXT-F1 a piece\'s names: a name a player typed starred wherever it is named, the port\'s own untouched; a maker\'s mark the filter catches is left off - the mint\'s and the card\'s (mutants: the typed name raw; the mark kept)', () => {
  const sword = { templateIndex: 115, group: 'Weapons', material: 1, identified: true, name: 'Fuck Cutter' };
  assert.equal(shownItemName(sword), '**** Cutter');
  assert.match(resolveItemName(sword), /\*\*\*\* Cutter/);
  assert.equal(shownItemName({ name: 'Ebony Blade' }), 'Ebony Blade');
  assert.equal(shownItemName({}), undefined);
  assert.deepEqual([makerMark('Silverthorn'), makerMark('Shithead'), makerMark('  ')], ['Silverthorn', null, null]);
  assert.equal(makerName('Shithead'), 'Shithead', 'the SHAPE law is unchanged - decorLaw reads it to tell a forged mark');
  for (const f of ['src/systems/itemInfo.js', 'src/systems/decorItems.js', 'src/systems/smithItems.js', 'src/systems/cookItems.js', 'server-account/src/professions.js']) {
    assert.match(src(f), /makerMark\(/, `${f} mints or shows the filtered mark`);
    assert.doesNotMatch(src(f), /\bmakerName\(/, `${f} never the bare shape`);
  }
});

test('TEXT-F1 the service: a note pinned with a caught word is kept starred, and read starred; a note kept before the filter is starred as the board is read; a guild note and a letter likewise (mutants: the board read raw; the notices read raw; the guild board read raw)', async () => {
  const svc = await standService({ BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const raw = svc.env.DB._raw;
  const ann = await svc.registered('Ann');
  const pin = await svc.call('/v1/board/pin', { map: 7, subject: 'Party, assholes', body: 'Heading out.\nNo dickheads.', days: 1, rid: 'rid-ann-0001' }, ann.secret);
  assert.equal(pin.status, 200, JSON.stringify(pin.body));
  const stored = raw.prepare('SELECT subject, body FROM board_notes').get();
  assert.deepEqual({ ...stored }, { subject: 'Party, ********', body: 'Heading out.\nNo *********.' }, 'kept starred');
  // a note kept before the filter - written straight into the row - reads starred
  raw.prepare('UPDATE board_notes SET subject = ?, body = ?').run('Old shit', 'An old fuck note');
  // and the server's notice, the developers' red seal, likewise
  const mac = await svc.registered('Mac');
  const posted = await svc.call('/v1/board/notice', { subject: 'Restart', body: 'At eight.', days: 1, rid: 'rid-mac-0001' }, mac.secret);
  assert.equal(posted.status, 200, JSON.stringify(posted.body));
  raw.prepare('UPDATE board_notices SET body = ?').run('At eight, cunts.');
  const read = await svc.call('/v1/board/read', { map: 7 }, ann.secret);
  assert.deepEqual(read.body.notes.map((n) => [n.subject, n.body]), [['Old ****', 'An old **** note']]);
  assert.deepEqual(read.body.notices.map((n) => n.body), ['At eight, *****.']);
  // the guild's own board: founded, pinned, read
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const gpin = await svc.call('/v1/guilds/board/pin', { character: gm.character, subject: 'Muster', body: 'Friday, you twats.', days: 3, rid: 'rid-gwen-0001' }, gm.secret);
  assert.equal(gpin.status, 200, JSON.stringify(gpin.body));
  raw.prepare('UPDATE guild_notes SET subject = ?').run('Muster, pricks');
  const gread = await svc.call('/v1/guilds/board', { character: gm.character }, gm.secret);
  assert.deepEqual(gread.body.notes.map((n) => [n.subject, n.body]), [['Muster, ******', 'Friday, you *****.']]);
  // a letter, kept starred
  const sent = await svc.call('/v1/mail/send', { to: 'Gwen', subject: 'Hey bitch', body: 'You heard me.' }, ann.secret);
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.equal(raw.prepare('SELECT subject FROM letters').get().subject, 'Hey *****');
});

test('TEXT-F1 the service: a rank\'s name with a caught word is refused, naming it (guild-rank-word) - said on the guild tab in a sentence of its own; a clean set is renamed (mutants: the rank\'s word let pass; the word unsaid)', async () => {
  const svc = await standService({});
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const ranks = (names) => svc.call('/v1/guilds/ranks', { character: gm.character, ranks: names }, gm.secret);
  const bad = await ranks(['Guildmaster', 'Officer', 'Member', 'Dickhead']);
  assert.deepEqual([bad.status, bad.body], [400, { error: 'guild-rank-word', why: 'dickhead' }]);
  const good = await ranks(['Guildmaster', 'Officer', 'Member', 'Recruit']);
  assert.equal(good.status, 200, JSON.stringify(good.body));
  assert.equal(guildWordText('guild-rank-word', { why: 'dickhead' }), 'A rank\'s name may not carry "dickhead" - a word the realm keeps out of names.');
  assert.ok(REFUSALS['guild-rank-word'], 'the service\'s word has its sentence');
});

test('TEXT-F1 the seams: every surface reads the one reader - the chat\'s and the words\' laws in wire.js, the look\'s class, the boards\' reads, the rank\'s refusal and its word through the route (mutants: none - each seam\'s own mutant is the behaviour pin above)', () => {
  const wire = src('src/net/wire.js');
  assert.match(wire, /return maskText\(s\.trim\(\)\);/);
  assert.match(wire, /export const wordsLine = \(line\) => maskText\(visibleText\(/);
  assert.match(wire, /&& !textCaught\(look\.class\) \? look\.class\.trim\(\) : null;/);
  assert.match(src('server-account/src/board.js'), /subject: maskText\(n\.subject\), body: maskText\(n\.body\),/);
  assert.match(src('server-account/src/board.js'), /subject: maskText\(x\.subject\), body: maskText\(x\.body\),/, 'the server\'s notices too');
  assert.match(src('server-account/src/guildBoard.js'), /subject: maskText\(n\.subject\), body: maskText\(n\.body\),/);
  assert.match(src('server-account/src/index.js'), /\(r\.error === 'guild-name-word' \|\| r\.error === 'guild-rank-word'\) && typeof r\.word === 'string'/);
  assert.equal((src('src/net/nameFilter.js').match(/^import /gm) ?? []).length, 0, 'the filter imports nothing - the relay\'s and the Worker\'s graphs stay flat');
});
