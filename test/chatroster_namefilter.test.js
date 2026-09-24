import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rosterRows, rosterTitle, ROSTER_ROWS_MAX } from '../src/net/roster.js';
import {
  checkName, nameAllowed, normaliseName, collapseRuns, standsAlone,
  listIsNormalised, entryVerdict, CRUDE, SLURS, IMPERSONATION,
} from '../src/net/nameFilter.js';
import { sanitizeName, FALLBACK_NAME, NAME_MAX } from '../src/net/wire.js';
import { tagOf } from '../src/net/chat.js';
import { CHAT_CSS } from '../src/ui/chatPanel.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

// ═══ CHAT-R1: WHO IS HERE, AND IN WHAT ORDER ══════════════════════

const session = (id, name, peers) => ({ id, name, peers: new Map(peers.map((p) => [p.id, p])) });

test('CHAT-R1: the roster is alphabetical, case- and number-blind, and ME is in it rather than on top of it', () => {
  // Mac: "showing all currently online players in alphabetical order".
  const r = rosterRows(session('me', 'Medora', [
    { id: 'a', name: 'zara' }, { id: 'b', name: 'Alfred' }, { id: 'c', name: 'Zara' },
    { id: 'd', name: 'Player10' }, { id: 'e', name: 'Player9' }, { id: 'f', name: 'edmund' },
  ]));
  assert.deepEqual(r.rows.map((x) => x.name),
    ['Alfred', 'edmund', 'Medora', 'Player9', 'Player10', 'Zara', 'zara']);
  assert.equal(r.total, 7);

  // ...and the reasons each clause is there, one at a time:
  // `zara` sits WITH `Zara` (sensitivity: base) rather than after every
  // capital - and note what settles which of the two comes first: they
  // compare EQUAL, so the tag does, exactly as it does for two players
  // who really share a name. There is no case rule here and there does
  // not need to be; what matters is that the answer is the same every
  // time, which the next test drives.
  assert.equal(Math.abs(r.rows.findIndex((x) => x.name === 'zara') - r.rows.findIndex((x) => x.name === 'Zara')), 1);
  // `Player10` sits AFTER `Player9` (numeric), not between 1 and 2
  assert.ok(r.rows.findIndex((x) => x.name === 'Player9') < r.rows.findIndex((x) => x.name === 'Player10'));
  // a lowercase name sits among the capitals rather than after them all
  assert.equal(r.rows[1].name, 'edmund');
  // I am marked and NOT hoisted - a roster that pins you to the top is
  // one you cannot find yourself in by reading
  const me = r.rows.find((x) => x.me);
  assert.equal(me.name, 'Medora');
  assert.equal(r.rows.indexOf(me), 2);
  assert.equal(r.rows.filter((x) => x.me).length, 1);
});

test('CHAT-R1: the ASCII law is wire.js\u2019s and the roster inherits it, accents and all', () => {
  // A NOTE RATHER THAN A CHOICE. `sanitizeName` has dropped every
  // non-ASCII character since ONLINE1 - "printable ASCII, trimmed,
  // bounded" - so a peer called \u00c4sa is shown as `sa`, in the chat
  // line and over their head as well as here. The roster does not fix
  // that and does not make it worse; it is pinned here so the next
  // reader of this column knows the mangling is the wire's and not the
  // panel's, and knows where to go if it is ever widened.
  assert.equal(sanitizeName('\u00c4sa'), 'sa');
  const r = rosterRows(session('me', 'Ann', [{ id: 'x', name: '\u00c4sa' }]));
  assert.deepEqual(r.rows.map((x) => x.name), ['Ann', 'sa'], 'the same answer the rest of the port gives');
});

test('CHAT-R1: two players with ONE name keep a stable order, which is the whole reason the tag is the tiebreak', () => {
  // The panel shows `#tag` beside a name for exactly this case. Without
  // the second sort clause the two would swap places whenever a pose
  // arrived and re-ordered the Map - a list that reshuffles under a
  // reader's cursor.
  const peers = [{ id: 'bob-one', name: 'Bob' }, { id: 'bob-two', name: 'Bob' }, { id: 'bob-three', name: 'Bob' }];
  const first = rosterRows(session('me', 'Ann', peers)).rows.map((x) => x.id);
  // the same peers, arriving in a different order
  const second = rosterRows(session('me', 'Ann', [peers[2], peers[0], peers[1]])).rows.map((x) => x.id);
  assert.deepEqual(first, second, 'the Map’s order must not reach the list');
  const tags = rosterRows(session('me', 'Ann', peers)).rows.filter((x) => x.name === 'Bob').map((x) => x.tag);
  assert.deepEqual([...tags], [...tags].sort(), 'and the tie is broken BY the tag the panel draws');
  for (const p of peers) assert.equal(tags.includes(tagOf(p.id)), true);
});

test('CHAT-R1: a session that is not open yet is a roster of ONE, and a nameless peer is still a row', () => {
  // Before the socket opens there are no peers and the player is still
  // in the room - a panel that showed nothing there would read as
  // broken rather than as empty.
  const alone = rosterRows(session('me', 'Medora', []));
  assert.deepEqual(alone.rows.map((x) => x.name), ['Medora']);
  assert.equal(alone.total, 1);
  assert.equal(rosterTitle(1), 'Online — 1', 'a roster of one is still a number');
  // CHAT-CHAN: a composed list names what it is of - "Party - 2", "Nearby - 1" - and a source that says nothing is "Online"
  assert.equal(alone.label, 'Online');
  assert.equal(rosterRows({ ...session('me', 'Medora', []), label: 'Party' }).label, 'Party');
  assert.equal(rosterTitle(2, 'Party'), 'Party — 2');

  // no session at all: not a crash, an empty list
  assert.deepEqual(rosterRows(null), { rows: [], total: 0, shown: 0, label: 'Online' });
  assert.deepEqual(rosterRows({}), { rows: [], total: 0, shown: 0, label: 'Online' });

  // a peer whose name never arrived takes sanitizeName's default rather
  // than drawing an empty row
  const odd = rosterRows(session('me', 'Ann', [{ id: 'x', name: '' }, { id: 'y', name: '   ' }]));
  assert.deepEqual(odd.rows.map((x) => x.name), ['Ann', FALLBACK_NAME, FALLBACK_NAME]);
  // ...and a duplicate id is one row, not two
  assert.equal(rosterRows(session('me', 'Ann', [{ id: 'me', name: 'Impostor' }])).total, 1);
});

test('CHAT-R1: the list is CAPPED and says so, so a crowded room cannot make the column unbounded', () => {
  const many = Array.from({ length: ROSTER_ROWS_MAX + 25 }, (_, i) => ({ id: `p${i}`, name: `Player${i}` }));
  const r = rosterRows(session('me', 'Ann', many));
  assert.equal(r.rows.length, ROSTER_ROWS_MAX);
  assert.equal(r.total, ROSTER_ROWS_MAX + 26, 'the COUNT still tells the truth');
  assert.equal(r.shown, ROSTER_ROWS_MAX);
  assert.ok(r.total > r.shown, 'so the panel can say how many it did not draw');
});

test('CHAT-R2: a CUT roster says how many it did not draw, in the panel', async () => {
  // The model's half is above; this is the panel actually printing it.
  // A column that silently stopped at 200 would under-report a busy
  // room and nothing would say so - which is the shape of lie this
  // port keeps finding in its own records.
  const many = new Map(Array.from({ length: ROSTER_ROWS_MAX + 7 }, (_, i) => [`p${i}`, { id: `p${i}`, name: `Player${i}` }]));
  const { panel, root } = await panelFor(() => ({ id: 'me', name: 'Me', peers: many }));
  panel.open();
  assert.equal(find(root, 'dfchat-who-row').length, ROSTER_ROWS_MAX, 'the column is bounded');
  assert.equal(one(root, 'dfchat-whohead').textContent, rosterTitle(ROSTER_ROWS_MAX + 8), 'the heading counts everyone');
  assert.equal(one(root, 'dfchat-who-more').textContent, '+8 more', 'and the cut is SAID');

  // ...and a roster that fits says nothing extra
  const few = new Map([['a', { id: 'a', name: 'Ann' }]]);
  const small = await panelFor(() => ({ id: 'me', name: 'Me', peers: few }));
  small.panel.open();
  assert.equal(one(small.root, 'dfchat-who-more').textContent, '');
});

test('CHAT-R1: a name the filter refuses never reaches the roster either', () => {
  // The roster runs sanitizeName like every other reader of a peer
  // name, so the panel cannot become the one surface that shows what
  // the relay replaced.
  const r = rosterRows(session('me', 'Ann', [{ id: 'x', name: 'Cum' }, { id: 'y', name: 'xXcumXx' }]));
  assert.deepEqual(r.rows.map((x) => x.name).sort(), ['Ann', FALLBACK_NAME, FALLBACK_NAME]);
});

// ═══ NAME-F1: THE FILTER ══════════════════════════════════════════

test('NAME-F1: the words Mac reported are caught, however they are spelled', () => {
  // Mac, 2026-09-16: "Im seeing a lot of names like 'Cum'".
  for (const [name, word] of [
    ['Cum', 'cum'], ['CUM', 'cum'], ['xXcumXx', 'cum'], ['TheCum', 'cum'], ['cuuuum', 'cum'],
    ['C0ck', 'cock'], ['cccoooock', 'cock'], ['D1CK', 'dick'], ['sh1t', 'shit'],
    ['f_u_c_k', 'fuck'], ['Fucker', 'fuck'], ['a s s', 'ass'], ['4ss', 'ass'], ['@ss', 'ass'],
    ['Tits', 'tit'], ['b00bs', 'boob'], ['Wanker', 'wank'], ['jizz', 'jizz'], ['Pussy', 'pussy'],
  ]) {
    const v = checkName(name);
    assert.equal(v.ok, false, `${name} must be refused`);
    assert.equal(v.word, word, `${name} should read as "${word}"`);
    assert.ok(v.reason.includes(word), 'and the refusal SAYS which word, so a real name knows what to change');
  }
  // the accented dodge, and the slur list
  assert.equal(nameAllowed('Çüm'), false);
  assert.equal(checkName('n1gger').kind, 'slur');
  assert.equal(checkName('FAGGOT').kind, 'slur');
  // impersonation is its own kind, and its own sentence
  const imp = checkName('admin');
  assert.equal(imp.kind, 'impersonation');
  assert.match(imp.reason, /reserved/);
});

test('NAME-F1: THE SCUNTHORPE PROBLEM - real names and real places are not refused', () => {
  // The half that makes this worth shipping. Mac picked the word-aware
  // reading precisely so these pass; if this test ever has to be
  // weakened, the filter has stopped being the one he asked for.
  const real = [
    'Cumberland', 'Cumbria', 'Scunthorpe', 'Penistone', 'Shitterton', 'Lightwater',
    'Cockburn', 'Cockermouth', 'Hancock', 'Babcock', 'Dickens', 'Dickinson',
    'Assisi', 'Assassin', 'Cassandra', 'Bass', 'Mass', 'Class', 'Glass', 'Pass', 'Sassy',
    'Titan', 'Titus', 'Titchfield', 'Sussex', 'Essex', 'Middlesex', 'Massachusetts',
    'Nigel', 'Nigella', 'Night', 'Con', 'Connor', 'Consider', 'Cooper', 'Asa', 'Tardis',
    'Analysis', 'Documents', 'Classic', 'Grasshopper', 'Bittern', 'Pissarro', 'Cummings',
    // ...and the game's own cast, which a filter that broke them would be useless for
    'Lysandus', 'Gothryd', 'Medora', 'Nulfaga', 'Cyndassa', 'Barenziah', 'Helseth', 'Elysana',
    'Daggerfall', 'Wayrest', 'Sentinel', 'Orsinium', 'Betony', 'Mynisera',
  ];
  for (const name of real) {
    const v = checkName(name);
    assert.equal(v.ok, true, `${name} is a real name and must pass (refused as "${v.word}")`);
  }
});

test('NAME-F1: the TWO readings, and why neither can do the other’s job', () => {
  // THE BUG THIS PIN EXISTS FOR, twice over.
  //
  // First cut: the collapse lived inside normaliseName, so the list had
  // to be written collapsed - and `ass`, `jizz`, `pussy` and `coon`
  // could never match anything, because a doubled letter cannot
  // survive to be found. Four dead entries in a list that read as
  // complete.
  //
  // Second cut: matching the collapsed form against a collapsed WORD
  // merged words that are not the same - `coon` and `con` both land on
  // `con`, and anyone called Con was refused as a slur.
  assert.equal(normaliseName('cccoooock'), 'cccoooock', 'the plain reading keeps the runs');
  assert.equal(collapseRuns('cccoooock'), 'cock', 'the stretched reading is a SECOND form');
  assert.equal(normaliseName('C0ck'), 'cock');
  assert.equal(normaliseName('f_u_c_k'), 'fuck', 'separators are dropped, not collapsed');
  // the accented dodge, DRIVEN rather than read off a line: NFKD
  // splits the letter from its mark and the a-z filter drops the mark.
  // An explicit strip stood beside it and a mutant showed it changed
  // nothing - so what is pinned is the ANSWER, which no amount of
  // rearranging that normaliser may alter.
  assert.equal(normaliseName('\u00c7\u00fcm'), 'cum');
  assert.equal(normaliseName('n\u00efg'), 'nig');
  assert.equal(nameAllowed('\u00c7\u00fcm'), false);

  // every entry survives normalisation unchanged, or it can never
  // match. DERIVED by running the normaliser over the list rather than
  // by reading it - which is the only way a fifth dead entry cannot be
  // added quietly.
  for (const [label, list] of [['CRUDE', CRUDE], ['SLURS', SLURS], ['IMPERSONATION', IMPERSONATION]]) {
    assert.equal(listIsNormalised(list), true, `${label} has an entry normalisation would change`);
    for (const w of list) {
      assert.equal(normaliseName(w), w, `${label}: "${w}" can never match - normalise it or drop it`);
      assert.ok(w.length >= 3, `${label}: "${w}" is too short to be safe at a word boundary`);
    }
    assert.equal(new Set(list).size, list.length, `${label} lists a word twice`);
  }
  // ...and the word handed to the stretched reading is the word AS
  // WRITTEN, never a collapsed copy - which is what keeps Con.
  //
  // The guard that was first written beside this turned out to be
  // INERT and a mutant proved it: the stretched haystack has no
  // doubled letters by construction, so a word that has one can never
  // be found there whatever a flag says. Driven directly rather than
  // asserted about, because "it cannot happen" is the claim that was
  // wrong the first time.
  assert.equal(standsAlone(collapseRuns('con'), 'coon'), false,
    'a word with a run cannot be found in a haystack that has none - this IS the guard');
  assert.equal(nameAllowed('Con'), true, 'so Con is a name');
  assert.equal(nameAllowed('Cooper'), true);
  assert.equal(nameAllowed('COONS'), false, 'and coon itself is still caught, on the plain reading');
  // COMMENTS STRIPPED - the note above names the flag to say what it
  // replaced, and the first cut of this assertion reddened on its own
  // prose. The third time this port has made that exact mistake, so it
  // is written down here too.
  const filterCode = rd('src/net/nameFilter.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/stretchable/.test(filterCode), 'the dead flag is gone rather than left to read as a guard');
});

test('NAME-F1: standsAlone is the word-boundary law, driven directly', () => {
  assert.equal(standsAlone('cum', 'cum'), true, 'bare');
  assert.equal(standsAlone('xxcumxx', 'cum'), true, 'x padding');
  assert.equal(standsAlone('thecum', 'cum'), true, 'a leading "the" is padding a player reaches for');
  assert.equal(standsAlone('cum123', 'cum'), true, 'digits');
  assert.equal(standsAlone('cumberland', 'cum'), false, 'berland is not padding');
  assert.equal(standsAlone('scunthorpe', 'cunt'), false);
  assert.equal(standsAlone('tits', 'tit'), true, 'a plural is the word');
  assert.equal(standsAlone('titus', 'tit'), false, '...and "us" is not a plural');
  assert.equal(standsAlone('titan', 'tit'), false);
  assert.equal(standsAlone('wanker', 'wank'), true, 'an agent is the word');
  assert.equal(standsAlone('', 'cum'), false);
});

test('NAME-F1: a name with no letters AT ALL is refused - and the leet map decides what a letter is', () => {
  // Refused: nothing survives normalisation, so there is no name in
  // there to read.
  for (const n of ['___', '   ', '', '...', '-=-']) {
    const v = checkName(n);
    assert.equal(v.ok, false, `${JSON.stringify(n)} is not a name`);
    assert.equal(v.kind, 'empty');
  }
  // ALLOWED, and deliberately: the leet map is what turns `4` into `a`,
  // so `1234` normalises to `iea` and has letters in it. That is the
  // same map that catches `C0ck`, and it cannot be aggressive in one
  // direction only. A numeric name is ugly, not offensive - and the
  // line this check draws is "no name in there", not "a name I like".
  assert.equal(normaliseName('1234'), 'iea');
  assert.equal(nameAllowed('1234'), true);
  assert.equal(normaliseName('@@@'), 'aaa');
  assert.equal(nameAllowed('@@@'), true);
});

// ═══ NAME-F2: THE RELAY IS THE AUTHORITY ══════════════════════════

test('NAME-F2: sanitizeName replaces a refused name, so a modified client cannot publish one', () => {
  // THE HALF THAT HOLDS. The pane refuses at entry with a reason and
  // that is what a player sees; this is what happens when the client
  // is not ours. A check that only lived in the UI is a check a
  // devtools console removes.
  assert.equal(sanitizeName('Cum'), FALLBACK_NAME);
  assert.equal(sanitizeName('xXcumXx'), FALLBACK_NAME);
  assert.equal(sanitizeName('admin'), FALLBACK_NAME);
  assert.equal(sanitizeName('Lysandus'), 'Lysandus', 'and a real name is untouched');
  assert.equal(sanitizeName('Cumberland'), 'Cumberland');

  // the older laws still hold beside it
  assert.equal(sanitizeName(''), FALLBACK_NAME);
  assert.equal(sanitizeName('  Ann  '), 'Ann', 'trimmed');
  assert.equal(sanitizeName('A'.repeat(NAME_MAX + 10)).length, NAME_MAX, 'bounded');
  assert.equal(sanitizeName('Anéé'), 'An', 'non-ASCII dropped, as it always was');

  // IDEMPOTENT, as every law in wire.js is: what the client sends the
  // relay takes, and running it twice changes nothing.
  for (const n of ['Cum', 'Lysandus', '', 'admin', '  Bob  ']) {
    assert.equal(sanitizeName(sanitizeName(n)), sanitizeName(n), `${JSON.stringify(n)} is not idempotent`);
  }
});

test('NAME-F2: the filter is in the RELAY’s graph, and the entry pane is the other half', () => {
  // server/src/relay.js re-exports wire.js whole, so the filter reaches
  // the worker by being INSIDE sanitizeName rather than beside it. It
  // imports nothing, which is what keeps that graph flat - the same
  // reason mat4.js is the only other thing wire.js takes.
  assert.match(rd('server/src/relay.js'), /export \* from '\.\.\/\.\.\/src\/net\/wire\.js';/);
  assert.match(rd('src/net/wire.js'), /import \{ nameAllowed \} from '\.\/nameFilter\.js';/);
  assert.equal((rd('src/net/nameFilter.js').match(/^import /gm) ?? []).length, 0,
    'nameFilter.js must import nothing, or the relay’s bundle grows a graph');

  // ACC1g MOVED THE ENTRY HALF, and did not drop it. The filter that
  // refused `Cum` at a text field in the Online pane now refuses it at
  // REGISTRATION, where a name is chosen ONCE instead of re-judged on
  // every press: `server-account/src/accounts.js handleRefusal` ends in
  // `nameIsIssuable`, which is `sanitizeName(h) === h`, which is the
  // very function carrying `nameAllowed`. One filter, one home, asked
  // earlier and asked once - and the pane has no name to judge, because
  // a player cannot type one any more.
  const acct = rd('server-account/src/accounts.js');
  assert.match(acct, /export function handleRefusal\(handle\) \{/);
  assert.match(acct, /if \(!nameIsIssuable\(h\)\) return 'refused';/, 'NAME-F1/F2, at the one entry there is');
  assert.match(rd('src/net/identityToken.js'), /&& sanitizeName\(name\) === name;/,
    "and `nameIsIssuable` IS sanitizeName - so a handle goes through the relay's own filter");
  const menu = rd('src/ui/enhancedMenu.js');
  assert.doesNotMatch(menu, /entryVerdict|onlineName/,
    'the typed name, its field and its entry-side verdict are gone from the menu entirely');

  // AUDIT-CHATR F2: ONE SUBJECT. The painted line and the pressed
  // button must ask about the SAME save, and the only way to be sure of
  // that is that there is one function and it takes the save. The pane
  // walked the ladder twice - `saves[0]` for the paint, the card's own
  // save for the press - so a refused second character got a dead
  // button and a blank reason.
  // AUDIT-CHATR F2's finding was that the pane walked the ladder TWICE
  // with two different subjects. ACC1g removed the ladder from this
  // pane altogether, so the way that bug cannot come back is that there
  // is nothing here to have a subject: the pane shows WHO YOU ARE and
  // the button is dead without a session.
  const pane = menu.slice(menu.indexOf('function paneOnline('), menu.indexOf('function paneLoad('));
  const code = pane.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');   // its own prose is not its wiring
  assert.equal((code.match(/entryVerdict\(/g) ?? []).length, 0, 'the ladder is not walked here at all');
  assert.match(code, /const who = storedSession\(appStorage\(\)\);/, 'what the pane reads is the SESSION');
  assert.match(code, /disabled: !who,/, 'and signed out is a dead button, not a warning beside a live one');
});

test('AUDIT-CHATR F6: the Online pane\u2019s copy says what sanitizeName actually does', () => {
  // A promise to a player is a claim about the code, and this one was
  // false: "24 plain letters and digits; anything else is dropped".
  // DRIVEN, not read - the line is checked against the function it
  // describes rather than against a reading of it.
  assert.equal(sanitizeName('Bob Smith'), 'Bob Smith', 'a SPACE survives - the old line said it would not');
  assert.equal(sanitizeName('Bob!!!'), 'Bob!!!', 'and so does punctuation');
  assert.equal(sanitizeName('\u00c4sa'), 'sa', 'what really goes is everything outside printable ASCII');
  assert.equal(sanitizeName('x'.repeat(NAME_MAX + 9)).length, NAME_MAX, 'and the 24 is real');

  const menu = rd('src/ui/enhancedMenu.js');
  // ACC1g: THE LINE IS GONE WITH THE FIELD IT DESCRIBED. F6's law was
  // that a promise to a player is a claim about the code; the strongest
  // form of that law is that the pane makes no promise about a name the
  // player cannot type. `sanitizeName` still holds the wire (the four
  // assertions above), and the pane says who you ARE instead.
  assert.doesNotMatch(menu, /Up to 24 characters/, 'the line describing the typed-name field outlived the field');
  assert.doesNotMatch(menu, /letters and digits/, 'and the false promise it replaced is still gone');
  const pane2 = menu.slice(menu.indexOf('function paneOnline('), menu.indexOf('function paneLoad('));
  assert.match(pane2, /Online needs an account, so a name over a head is one nobody else can wear\./,
    'what stands there now says why, and says the guest way in is one press');
});

test('AUDIT-CHATR F2/F3: one ladder, one subject - and an empty ladder is Traveller, not a refusal', () => {
  // F2, the bug this function exists to make impossible. Two saves; the
  // field is empty, so each card's press falls through to ITS OWN
  // character's name. A verdict about the first save says nothing about
  // the second.
  assert.equal(entryVerdict('', 'Alfred').ok, true);
  assert.equal(entryVerdict('', 'Cum').ok, false, 'the SECOND save is judged on its own name');
  assert.equal(entryVerdict('', 'Cum').reason.length > 0, true, 'and the refusal carries a reason to paint');
  // the field WINS the ladder wherever it has something, for every save
  assert.equal(entryVerdict('Medora', 'Cum').ok, true, 'a clean field covers a rude character name');
  assert.equal(entryVerdict('Cum', 'Alfred').ok, false, 'and a rude field is not saved by a clean character');
  assert.equal(entryVerdict('  Alfred  ', 'Cum').ok, true, 'the rung is TRIMMED before it counts as filled');
  // A FIELD OF SPACES IS NOT A RUNG. This is the trim's real work, and
  // the first cut of this pin could not see it: without the trim the
  // spaces count as a filled field, and `checkName` - which trims for
  // itself - answers `empty`, so the pane refuses a player for what is
  // still an untouched field. Both readings answer `ok: false` here, so
  // the pin has to ask WHICH refusal it got.
  assert.equal(entryVerdict('   ', 'Alfred').ok, true, 'spaces fall through to the character\u2019s own name');
  assert.equal(entryVerdict('   ', 'Cum').word, 'cum', 'and the refusal that remains is the CHARACTER\u2019s, not the whitespace\u2019s');

  // F3, the false alarm. An EMPTY ladder is not a refusal: the copy
  // beside the field promises "an empty name shows as Traveller" and
  // sanitizeName really does hand it the fallback, so a pane that
  // refused it would refuse what the relay allows - and it did, on a
  // browser with no saves at all.
  assert.equal(entryVerdict('', '').ok, true);
  assert.equal(entryVerdict(undefined, undefined).ok, true, 'no field and no saves: nothing to complain about yet');
  assert.equal(entryVerdict().reason, '', 'and nothing painted under the field');
  assert.equal(sanitizeName(''), FALLBACK_NAME, 'which is exactly what the relay would have done with it');
  assert.equal(checkName('').ok, false, 'checkName still answers `empty` - that is the right answer to ITS question');
  assert.equal(checkName('').kind, 'empty');

  // ...but a name that was TYPED and came to nothing is still refused,
  // because silently renaming someone who tried is worse than saying so.
  assert.equal(entryVerdict('___', 'Alfred').ok, false, 'typed, and no letters in it');
  assert.equal(entryVerdict('___', 'Alfred').kind, 'empty');
  // AUDIT-CHATR F8: and `1234` is NOT one of those, though the comment
  // above checkName said it was for as long as the file existed. The
  // leet map reads it as `iea` - letters, so it passes. Driven, because
  // a claim about the filter is worth exactly what running it says.
  assert.equal(normaliseName('1234'), 'iea');
  assert.equal(entryVerdict('1234', 'Alfred').ok, true, 'a daft name is not a rude one');
  assert.equal(normaliseName('---'), '', 'what really comes to nothing is the separators');
  assert.equal(entryVerdict('---', 'Alfred').kind, 'empty');
});

// ═══ CHAT-R2: THE PANEL, DRIVEN ═══════════════════════════════════
//
// The roster and the hide button are DOM, so they are driven through
// the same fake document `test/chat1.test.js` uses rather than read out
// of the source. A pin that greps for a class name cannot tell a
// column that draws from one that is built and never filled - which is
// the lesson AUDIT-MACK spent a day on.

function fakeNode(tag, doc) {
  const n = {
    tagName: String(tag).toUpperCase(), className: '', children: [], parent: null, attrs: {}, dataset: {}, style: {},
    listeners: {}, _text: '', type: '', value: '', focused: false, scrollTop: 0, scrollHeight: 0, clientHeight: 0,
    set textContent(v) { n._text = String(v ?? ''); n.children.length = 0; },
    get textContent() { return n.children.length ? n.children.map((c) => c.textContent).join('') : n._text; },
    append(...kids) { for (const k of kids) { k.parent = n; n.children.push(k); } },
    replaceChildren(...kids) { n.children.length = 0; n.append(...kids); },
    setAttribute(k, v) { n.attrs[k] = String(v); },
    addEventListener(t, fn) { (n.listeners[t] ??= []).push(fn); },
    click() { for (const fn of n.listeners.click ?? []) fn({ preventDefault() {}, stopPropagation() {} }); },
    querySelector() { return null; },
    focus() { n.focused = true; doc.activeElement = n; },
    blur() { n.focused = false; if (doc.activeElement === n) doc.activeElement = null; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
    classList: { toggle() {}, add() {}, remove() {} },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
function fakeWindow() {
  const listeners = [];
  return {
    listeners,
    addEventListener(t, fn, capture) { listeners.push({ t, fn, capture: capture === true || capture?.capture === true }); },
    removeEventListener(t, fn) { const i = listeners.findIndex((l) => l.t === t && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
    key(code, e = {}) {
      const ev = { type: 'keydown', code, target: null, isTrusted: true, prevented: false, stopped: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e };
      for (const l of listeners) if (l.t === 'keydown' && l.capture) l.fn(ev);
      if (!ev.stopped) for (const l of listeners) if (l.t === 'keydown' && !l.capture) l.fn(ev);
      return ev;
    },
  };
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
const defaultAction = (e) => (e.code === 'Enter' ? 'ActivateCursor' : null);

async function panelFor(roster) {
  const { ChatLog } = await import('../src/net/chat.js');
  const { createChatPanel } = await import('../src/ui/chatPanel.js');
  const { setPref } = await import('../src/systems/uiPrefs.js');
  setPref('chatHidden', false);
  const doc = fakeDocument(), win = fakeWindow();
  const log = new ChatLog({ now: () => 50_000 });
  const panel = createChatPanel({ log, onSend: () => true, roster, action: defaultAction, doc, win, touch: false });
  return { panel, log, doc, win, root: doc.body.children[0] };
}

test('CHAT-R2: the roster column FILLS, in the model’s order, and scrolls on its own', async () => {
  const peers = new Map([['a', { id: 'a', name: 'zara' }], ['b', { id: 'b', name: 'Alfred' }]]);
  const { panel, root } = await panelFor(() => ({ id: 'me', name: 'Medora', peers }));
  panel.open();
  const rows = find(root, 'dfchat-who-row');
  assert.equal(rows.length, 3, 'a row per player, mine among them');
  assert.deepEqual(rows.map((r) => one(r, 'dfchat-who-name').textContent), ['Alfred', 'Medora', 'zara'],
    'net/roster.js’s order, not the Map’s');
  assert.equal(one(root, 'dfchat-whohead').textContent, rosterTitle(3));
  assert.ok(rows.find((r) => String(r.className).includes('me')), 'my own row is marked');
  // ROSTER-G (Mac: "the roster naming itself seems hardcoded"): the #tag is the tie-breaker for a SHARED name and
  // is drawn only there - a name nobody else has stands alone
  assert.equal(find(rows[0], 'dfchat-who-tag').length, 0, 'Alfred is the only Alfred: no tag');

  // the column is its own scroller, not the box's - a long roster must
  // not push the conversation off the screen
  assert.match(CHAT_CSS, /\.dfchat-wholist \{[^}]*overflow-y: auto/);
  assert.match(CHAT_CSS, /\.dfchat-who \{[^}]*flex: none/);
  assert.match(CHAT_CSS, /\.dfchat-main \{[^}]*flex: 1/);
});

test('CHAT-R2: an unchanged roster repaints NOTHING, because a pose arrives sixty times a second', async () => {
  // A peer's pose changes constantly and `render` runs every frame. If
  // the column rebuilt on each one, a reader's scroll in it would be
  // fighting the rebuild - the same defect AUDIT CHAT C8 fixed for the
  // message list, which is why it is pinned here before it ships.
  const peers = new Map([['a', { id: 'a', name: 'Ann', pose: { x: 0 } }]]);
  const { panel, root } = await panelFor(() => ({ id: 'me', name: 'Me', peers }));
  panel.open();
  const before = find(root, 'dfchat-who-row');
  peers.get('a').pose = { x: 99 };                  // moved, not renamed
  for (let i = 0; i < 5; i++) panel.render({});
  const after = find(root, 'dfchat-who-row');
  assert.equal(after.length, before.length);
  for (let i = 0; i < after.length; i++) assert.equal(after[i], before[i], 'the SAME nodes - nothing was rebuilt');

  // ...and a real change does repaint
  peers.set('b', { id: 'b', name: 'Bob' });
  panel.render({});
  assert.equal(find(root, 'dfchat-who-row').length, 3, 'a peer that JOINS lands without a line being said (me, Ann, Bob)');
});

test('CHAT-R2: HIDE puts everything away, keeps the log running, and the open key stands down', async () => {
  // Mac: "a hide chat button".
  const { panel, log, root, win } = await panelFor(() => ({ id: 'me', name: 'Me', peers: new Map() }));
  assert.equal(panel.isHidden(), false);

  panel.open();
  assert.equal(panel.isOpen(), true);
  one(root, 'dfchat-hide').click();
  assert.equal(panel.isHidden(), true);
  assert.equal(panel.isOpen(), false, 'hiding closes an open box rather than leaving it under a display rule');
  assert.equal(root.dataset.hidden, '1', 'and the sheet is told');

  // THE LOG KEEPS RUNNING. A player who hid the chat has not left the
  // room: the lines still arrive and the badge is waiting when they
  // bring it back.
  log.push('world', { id: 'x', name: 'Bob', text: 'still here', at: 50_000 });
  assert.ok(log.unreadTotal() > 0, 'the log filled while hidden');

  // THE OPEN KEY STANDS DOWN. Enter is ActivateCursor - a key the game
  // itself wants - so a hidden panel must not pull the box back up on
  // the next press.
  const ev = win.key('Enter');
  assert.equal(panel.isOpen(), false, 'Enter does not reopen a hidden panel');
  assert.equal(ev.prevented, false, 'and the key is left for the game');

  // and the one control that brings it back does
  one(root, 'dfchat-show').click();
  assert.equal(panel.isHidden(), false);
  assert.equal(panel.isOpen(), true, 'showing opens it, because that is what the press asked for');
});

test('AUDIT-CHATR F1: the frame does not UNDO the hide - the host\u2019s covered word is not the player\u2019s', async () => {
  // THE F-SING LESSON AGAIN, and the sharpest cut of it yet: a pin on
  // the unit is not a pin on the wiring. Every CHAT-R2 pin above drives
  // `setHidden` and reads `paint`'s dataset - and `render` is what
  // actually runs, sixty times a second, with the HOST's word.
  //
  // Those two words are DIFFERENT. `covered` is "a window is over the
  // HUD right now"; `hidden` is "the player pressed Hide". The frame
  // must not write the first into the second's dataset, or the button
  // is undone before the player's finger is off it.
  const { panel, root } = await panelFor(() => ({ id: 'me', name: 'Me', peers: new Map() }));
  one(root, 'dfchat-hide').click();
  assert.equal(root.dataset.hidden, '1');

  panel.render({ covered: false, status: null });   // an ordinary frame: no window over the HUD
  assert.equal(panel.isHidden(), true, 'a frame does not un-hide the panel');
  assert.equal(root.dataset.hidden, '1', 'and the sheet is still told - this is the line the CSS reads');
  assert.equal(root.style.display, '', 'the panel is still IN the page: hidden is a sheet state, not a teardown');

  // and the host's own word still works, on its own axis
  panel.render({ covered: true, status: null });
  assert.equal(root.style.display, 'none', 'a window over the HUD takes the whole panel away');
  assert.equal(panel.isHidden(), true, 'without touching what the player asked for');
  panel.setHidden(false);
});

test('CHAT-R2: hidden is REMEMBERED, and the CSS hides every drawn part rather than the root', async () => {
  const { setPref, getPref } = await import('../src/systems/uiPrefs.js');
  const { panel, root } = await panelFor(() => ({ id: 'me', name: 'Me', peers: new Map() }));
  one(root, 'dfchat-hide').click();
  assert.equal(getPref('chatHidden'), true, 'the pref is written, so the next launch opens hidden');

  // a fresh panel with the pref set comes up hidden
  const again = await (async () => {
    setPref('chatHidden', true);
    const { ChatLog } = await import('../src/net/chat.js');
    const { createChatPanel } = await import('../src/ui/chatPanel.js');
    const doc = fakeDocument(), win = fakeWindow();
    return createChatPanel({ log: new ChatLog(), onSend: () => true, action: defaultAction, doc, win, touch: false });
  })();
  assert.equal(again.isHidden(), true, 'the pref is read at build, not assumed false');
  again.setHidden(false);
  setPref('chatHidden', false);
  panel.setHidden(false);

  // EVERY drawn part, and the root is NOT display:none - the panel
  // keeps its listeners and its log while hidden.
  const hiddenRule = CHAT_CSS.slice(CHAT_CSS.indexOf('.dfchat[data-hidden="1"]'), CHAT_CSS.indexOf('.dfchat-show { display: inline-flex'));
  assert.ok(hiddenRule.length > 40, 'the hidden rule exists');
  for (const part of ['dfchat-peek', 'dfchat-hint', 'dfchat-open', 'dfchat-status', 'dfchat-box']) {
    assert.ok(hiddenRule.includes(`.${part},`) || hiddenRule.includes(`.${part} {`) || hiddenRule.includes(`.${part}\n`),
      `${part} must go away when hidden`);
  }
  assert.ok(!/\.dfchat \{[^}]*display: none/.test(CHAT_CSS), 'the ROOT is never display:none - the listeners and the log stay');
  assert.match(CHAT_CSS, /\.dfchat\[data-hidden="1"\] \.dfchat-show \{ display: inline-flex; \}/);
});

test('CHAT-R2/ROSTER-G: the roster is the ACTIVE CHANNEL’s - everyone online, not the player’s own cell - and a host that has none draws no column', async () => {
  // THE WIRING. CHAT-R1 handed the panel `online`, the presence session,
  // because a channel held no peers then - and the presence session is
  // the player's own map CELL, so a friend two towns over never showed
  // (Mac: "Players dont show in online"). ROSTER-G gives the channel a
  // roster at the relay, and the panel reads the tab's own link; the
  // presence session stands in only until that link exists.
  const world = rd('src/scenes/world.js');
  // CHAT-CHAN: through the tab's own roster - a channel tab's link (the World's, the Region's), the presence session only
  // as the stand-in, and the Party and Local tabs their composed lists (test/chatchan.test.js drives those)
  assert.match(world, /roster: \(\) => chatRosterOf\(chatLog\?\.active\),/);
  assert.match(world, /const chatSessionOf = \(tabId\) => \(tabId === 'local' \? online : tabId === 'party' \? chatLinks\?\.get\('world'\) : chatLinks\?\.get\(tabId\)\) \?\? online \?\? null;/);
  assert.match(world, /const s = chatSessionOf\(tabId\);/, 'the World and Region tabs read the session of their own channel');
  assert.match(world, /new OnlineSession\(\{ url: online\.url[^)]*presence: false \}\)/,
    'the chat links really are presence-less, which is why the roster cannot come from them');

  // a panel built WITHOUT a roster hides the column rather than drawing an empty one
  const { panel, root } = await panelFor(null);
  panel.open();
  assert.equal(one(root, 'dfchat-who').style.display, 'none');
  assert.equal(find(root, 'dfchat-who-row').length, 0);
});
