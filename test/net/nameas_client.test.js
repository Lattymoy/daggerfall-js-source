// NAME-AS (2026-10-12, Mac: "I want to add an option to the profile menu where players can toggle to use their account
// name or character name for ingame use"): THE CLIENT'S HALF. The profile card's toggle asks the service (the choice is
// the account row's, and the mint signs it), and the device keeps the two names apart: its stored session is the
// ACCOUNT's picture (the profile mark's name), the live sessions take the name the ROOM reads. A choice made here is
// stamped on the stored session, and the world host says hello again when the stamp moves, so the room reads the new
// name at once; a chosen character's name that stood aside is said once, in words. tools/mutants/nameas.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  accountTokenMinter, adoptIdentity, keepSession, storedSession, chooseNameAs, nameWhyText, NAME_WHY_TEXT,
  SESSION_KEY, DEFAULT_ACCOUNT_SERVICE, REFUSALS,
} from '../../src/net/accountClient.js';
import { AccountFlow, NAME_AS_NOTE } from '../../src/ui/accountFlow.js';
import { accountCard, NAME_AS_CHOICES } from '../../src/ui/enhanced/enhancedAccount.js';
import { ownNameAsAt } from '../../src/systems/ownGlyphs.js';
import { MailBox } from '../../src/net/mail.js';
import { NAME_MAX } from '../../src/net/wire.js';
import { wornNameRefusal, NAME_AS } from '../../server-account/src/accounts.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
/** A source with its comments taken out - a pin reads what the code does, never what a note beside it says. */
const code = (p) => rd(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

function fakeStorage(seed = null) {
  const m = new Map();
  if (seed) m.set(SESSION_KEY, JSON.stringify(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _map: m };
}
function fakeFetch(script) {
  const calls = [];
  const fetch = async (url, init) => {
    const path = url.replace(DEFAULT_ACCOUNT_SERVICE, '').replace(/^https?:\/\/[^/]+/, '');
    calls.push({ path, body: init.body ? JSON.parse(init.body) : null });
    const step = script[path];
    const answer = typeof step === 'function' ? step(calls.length) : step;
    if (!answer) throw new Error(`the fake service has no answer for ${path}`);
    return { ok: answer.status ? answer.status < 400 : true, status: answer.status ?? 200, json: async () => answer.body };
  };
  return { fetch, calls };
}
const SESSION = { id: 'acct-aaaaaaaaaaaa', name: 'Lattymoy', kind: 'linked', sessionId: 's1', secret: 'sec-one' };
const ACCOUNT = { id: 'acct-aaaaaaaaaaaa', name: 'Lattymoy', kind: 'linked', handle: 'Lattymoy', nameAs: 'account' };

test('NAME-AS the minter: the stored session keeps the ACCOUNT\'s name - the profile mark\'s - while the host is handed the name the room reads, with the choice and why a chosen character\'s name stood aside; a service before acct122 is adopted as it always was (mutants: the store given the room\'s name; the host given the account\'s; the reason dropped)', async () => {
  const st = fakeStorage(SESSION);
  const { fetch } = fakeFetch({ '/v1/auth/token': { body: { token: 'v1.a.b', name: 'Mithriil', accountName: 'Lattymoy', nameAs: 'character', kind: 'linked', title: null, glyphs: [], expiresAt: 1 } } });
  const seen = [];
  assert.equal(await accountTokenMinter({ fetch, storage: st, onIssued: (w) => seen.push(w) })(), 'v1.a.b', 'still the token alone');
  assert.equal(storedSession(st).name, 'Lattymoy', 'the account\'s picture keeps the account\'s name');
  assert.deepEqual([seen[0].name, seen[0].accountName, seen[0].nameAs, 'nameWhy' in seen[0]], ['Mithriil', 'Lattymoy', 'character', false], 'the room\'s name to the live sessions');
  // the reason, when the character's stood aside
  const st2 = fakeStorage(SESSION);
  const f2 = fakeFetch({ '/v1/auth/token': { body: { token: 'v1.a.b', name: 'Lattymoy', accountName: 'Lattymoy', nameAs: 'character', nameWhy: 'refused', nameWord: 'cum', kind: 'linked', title: null, glyphs: [], expiresAt: 1 } } });
  const seen2 = [];
  await accountTokenMinter({ fetch: f2.fetch, storage: st2, onIssued: (w) => seen2.push(w) })();
  assert.deepEqual([seen2[0].nameWhy, seen2[0].nameWord], ['refused', 'cum']);
  // a service from before acct122: `name` was the account's, and it is adopted as before
  const st3 = fakeStorage({ ...SESSION, name: 'Old Guest' });
  const f3 = fakeFetch({ '/v1/auth/token': { body: { token: 'v1.a.b', name: 'Lattymoy', kind: 'linked', title: null, glyphs: [], expiresAt: 1 } } });
  const seen3 = [];
  await accountTokenMinter({ fetch: f3.fetch, storage: st3, onIssued: (w) => seen3.push(w) })();
  assert.equal(storedSession(st3).name, 'Lattymoy');
  assert.deepEqual(['accountName' in seen3[0], 'nameAs' in seen3[0]], [false, false], 'nothing said, nothing invented');
});

test('NAME-AS the reason in words: one sentence for every reason the mint can give - the filter\'s naming the word it caught - and the name others see in its place, the one the room reads; none where nothing stood aside (mutants: a reason with no sentence; the caught word dropped)', () => {
  assert.equal(nameWhyText({ name: 'Lattymoy' }), null);
  assert.equal(nameWhyText(null), null);
  // every reason the service can give - its own law driven, and `taken` from wornNameOf - has its sentence
  const given = new Set(['taken']);
  for (const n of ['A'.repeat(NAME_MAX + 1), 'Ysöldé', 'C0ck', 'ysolde@mail.com', '___']) given.add(wornNameRefusal(n).why);
  assert.deepEqual([...given].sort(), Object.keys(NAME_WHY_TEXT).sort(), 'the table and the service\'s reasons are one set');
  for (const why of given) {
    const t = nameWhyText({ name: 'Lattymoy', accountName: 'Lattymoy', nameWhy: why });
    assert.ok(t.includes(NAME_WHY_TEXT[why]) && t.endsWith('Others see you as Lattymoy.'), `${why}: ${t}`);
  }
  assert.ok(NAME_WHY_TEXT.long.includes(String(NAME_MAX)), 'the bound named as the wire holds it');
  assert.equal(nameWhyText({ name: 'Lattymoy', accountName: 'Lattymoy', nameWhy: 'refused', nameWord: 'cum' }),
    'Your character\'s name cannot be shown online: the name filter reads it as "cum". Others see you as Lattymoy.', 'NAME-F: the refusal names the word');
  assert.equal(nameWhyText({ name: 'Hrothgar Larethbinder', nameWhy: 'taken' }), 'Your character\'s name cannot be shown online: it is another player\'s username. Others see you as Hrothgar Larethbinder.', 'a guest: the generated name the room reads');
});

test('NAME-AS the stamp: a choice the service took is stamped on the stored session, forward only - an older stamp is no news - kept by keepSession, read per frame by ownNameAsAt, and only into the session that asked (mutants: the stamp moved backward; keepSession dropping it; another session stamped)', () => {
  const st = fakeStorage();
  keepSession(st, SESSION);
  assert.equal(ownNameAsAt(st), null, 'none chosen here');
  assert.equal(adoptIdentity(st, { nameAsAt: 1000, secret: SESSION.secret }), true);
  assert.equal(storedSession(st).nameAsAt, 1000);
  assert.equal(ownNameAsAt(st), 1000);
  assert.equal(adoptIdentity(st, { nameAsAt: 900, secret: SESSION.secret }), false, 'an older stamp is no news');
  assert.equal(adoptIdentity(st, { nameAsAt: 1000, secret: SESSION.secret }), false, 'nor the same one - no write, no storage event');
  assert.equal(adoptIdentity(st, { nameAsAt: 2000, secret: 'another' }), false, 'AUDIT B4: never into a session that did not ask');
  assert.equal(adoptIdentity(st, { nameAsAt: 2000, secret: SESSION.secret }), true);
  assert.equal(ownNameAsAt(st), 2000);
  keepSession(st, storedSession(st));
  assert.equal(storedSession(st).nameAsAt, 2000, 'keepSession keeps it');
  adoptIdentity(st, { name: 'Lattymoy', glyphs: ['dev'], secret: SESSION.secret });
  assert.deepEqual([storedSession(st).glyphs, storedSession(st).nameAsAt], [['dev'], 2000], 'a wear\'s adoption writes its glyphs and leaves the stamp');
});

test('NAME-AS the flow: the toggle ASKS - the service\'s answer is the choice, the card says so, and the stored session is stamped forward; the one already chosen asks nothing; a refusal keeps the choice and stamps nothing; one press at a time (mutants: the choice decided locally; the same choice asked again; a refusal stamped; the stamp not forward)', async () => {
  let t = 5000;
  const { fetch, calls } = fakeFetch({
    '/v1/account': { body: { account: ACCOUNT, wardrobe: null, devices: [] } },
    '/v1/account/name': (n) => (n === 4 ? { status: 400, body: { error: 'no-name-as' } } : { body: { ok: true, nameAs: calls[calls.length - 1].body.as } }),
  });
  const storage = fakeStorage(SESSION);
  const flow = AccountFlow({ io: { fetch }, storage, now: () => t });
  await flow.start();
  assert.equal(flow.account.nameAs, 'account');
  assert.equal(await flow.chooseName('account'), false, 'the one chosen asks nothing');
  assert.equal(calls.filter((c) => c.path === '/v1/account/name').length, 0);
  const p = flow.chooseName('character');
  assert.equal(flow.busy, true);
  assert.equal(await flow.chooseName('account'), false, 'one press at a time');
  assert.equal(await p, true);
  assert.deepEqual(calls.find((c) => c.path === '/v1/account/name').body, { as: 'character' });
  assert.equal(flow.account.nameAs, 'character', 'the service\'s answer');
  assert.equal(flow.note, NAME_AS_NOTE.character);
  assert.equal(storedSession(storage).nameAsAt, 5000, 'stamped');
  assert.equal(await flow.chooseName('account'), true, 'the same millisecond');
  assert.equal(storedSession(storage).nameAsAt, 5001, 'and still forward');
  assert.equal(flow.note, NAME_AS_NOTE.account);
  t = 9000;
  assert.equal(await flow.chooseName('character'), false, 'refused');
  assert.equal(flow.error, REFUSALS['no-name-as']);
  assert.equal(flow.account.nameAs, 'account', 'the choice as the service last said it');
  assert.equal(storedSession(storage).nameAsAt, 5001, 'a refusal stamps nothing');
  // the service's word IS the choice - one that is no choice reads as the account's, as the service's own nameAsOf reads it
  const odd = fakeFetch({ '/v1/account': { body: { account: ACCOUNT, wardrobe: null, devices: [] } }, '/v1/account/name': { body: { ok: true, nameAs: 'bogus' } } });
  const flow2 = AccountFlow({ io: { fetch: odd.fetch }, storage: fakeStorage(SESSION), now: () => t });
  await flow2.start();
  assert.equal(await flow2.chooseName('character'), true);
  assert.equal(flow2.account.nameAs, 'account', 'never the choice asked for, where the service said otherwise');
  assert.equal(chooseNameAs.length, 2);
  assert.deepEqual(NAME_AS_CHOICES.map(([as]) => as), NAME_AS, 'the toggle draws the service\'s two, in order');
});

/** The smallest document the signed-in card needs. */
function cardDoc() {
  const mk = (tag) => {
    const n = {
      tag, className: '', type: null, value: '', disabled: false, children: [], attrs: {}, isConnected: true,
      append: (...k) => n.children.push(...k.filter(Boolean)),
      setAttribute(k, v) { n.attrs[k] = String(v); },
      get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
      get text() { return [n.textContent, ...n.children.map((c) => c.text)].filter(Boolean).join(' '); },
    };
    Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
    return n;
  };
  return { createElement: mk };
}

test('NAME-AS the card: the Account section draws the name-in-game toggle - both choices, the chosen one pressed and worn, a press asking the flow - and one line saying what others see, the account\'s name by name; busy, neither presses; a service from before NAME-AS draws none (mutants: the toggle unwired; the pressed state inverted; drawn for an old service)', () => {
  const draw = (account, busy = false) => {
    const asked = [];
    const flow = { stage: 'in', account, wardrobe: null, patreon: null, busy, error: '', note: '', values: {}, agreed: {}, chooseName: (as) => { asked.push(as); return Promise.resolve(true); } };
    const card = accountCard(cardDoc(), /** @type {any} */ (flow));
    card.paint();
    const box = card.root.all.find((n) => String(n.className).split(/\s+/).includes('acctnameas'));
    return { card, box, asked, buttons: box ? box.all.filter((n) => n.tag === 'button') : [] };
  };
  let { box, buttons, asked } = draw(ACCOUNT);
  assert.ok(box, 'the toggle is drawn');
  const section = /** @type {any} */ (box);
  assert.ok(section.all.some((n) => n.className === 'fieldlabel' && n.textContent === 'Name in game'));
  assert.deepEqual(buttons.map((b) => b.text), ['Account name', 'Character name']);
  assert.deepEqual(buttons.map((b) => [b.attrs['aria-pressed'], b.className.includes('worn')]), [['true', true], ['false', false]], 'the account\'s pressed');
  assert.match(section.text, /Others see Lattymoy over your head and in chat\./);
  buttons[1].onclick();
  assert.deepEqual(asked, ['character'], 'a press asks the flow');
  ({ box, buttons } = draw({ ...ACCOUNT, nameAs: 'character' }));
  assert.deepEqual(buttons.map((b) => b.attrs['aria-pressed']), ['false', 'true']);
  assert.match(/** @type {any} */ (box).text, /the character you play online, or Lattymoy where it cannot be shown/);
  ({ buttons } = draw(ACCOUNT, true));
  assert.deepEqual(buttons.map((b) => b.disabled), [true, true], 'busy: neither presses');
  ({ box } = draw({ ...ACCOUNT, nameAs: undefined }));
  assert.equal(box, undefined, 'a service from before NAME-AS: no toggle');
  // in the ACCOUNT's own section, beside the name it goes by - not the wardrobe's, which draws nothing where nothing is held
  const card = draw(ACCOUNT).card;
  const sections = card.root.all.filter((n) => n.tag === 'section');
  const account = sections.find((s) => s.children[0]?.textContent === 'Account');
  assert.ok(account?.all.some((n) => String(n.className).split(/\s+/).includes('acctnameas')), 'under the Account head');
});

test('NAME-AS the host by source: a mint\'s reason said ONCE in the chat until it changes; a stamp this page has not acted on says hello again in every room I hold - the presence session and every chat channel - from the online frame before the dead return, a stamp from before the page no news; and a board note\'s duel finds its author by ACCOUNT (mutants: the reason said every mint; the channels not re-hello\'d; the first stamp read as news; the duel joined by name)', () => {
  const w = code('src/scenes/world.js');
  const issued = w.slice(w.indexOf('const adoptIssued = (who) => {'), w.indexOf('const staffGlyphs = () => _staffGlyphs;'));
  assert.match(issued, /const said = nameWhyText\(who\);\s*if \(said == null\) _nameWhySaid = null;\s*else if \(said !== _nameWhySaid && chatLog\) \{ _nameWhySaid = said; chatNotice\(said\); \}/, 'said once, until the reason changes or goes');
  assert.match(issued, /let _nameAsAtSeen;\s*const nameAsFrame = \(\) => \{\s*const at = ownNameAsAt\(\);\s*if \(at === _nameAsAtSeen\) return;\s*const first = _nameAsAtSeen === undefined;\s*_nameAsAtSeen = at;\s*if \(first \|\| !online\) return;\s*online\.rehello\?\.\(\);\s*for \(const link of chatLinks\?\.values\?\.\(\) \?\? \[\]\) link\.rehello\?\.\(\);\s*\};/);
  const frame = w.slice(w.indexOf('const onlineFrame = (now, dt) => {'), w.indexOf('if (seatOut()) {', w.indexOf('const onlineFrame = (now, dt) => {')));
  assert.match(frame, /\n\s*peerFxFrame\(\);\s*\n\s*nameAsFrame\(\);\s*\n/, 'every online frame, after the others\' blows - before the realm door\'s return, the seat\'s and the dead\'s');
  assert.match(w, /\[\.\.\.\(online\?\.peers\?\.values\?\.\(\) \?\? \[\]\)\]\.find\(\(q\) => \(typeof note\.by === 'string' && note\.by \? q\?\.sub === note\.by : q\?\.name === note\.from\)\)/, 'the author by account, the name only where a service says no `by`');
  // the friends panel's letter goes to the account
  const panel = code('src/ui/socialPanel.js');
  assert.match(panel, /if \(mail\) acts\.append\(btn\('Letter', \{ run: \(\) => \{ tab = 'letters'; writeTo\(r\.name, '', r\.acct\); \} \}\)\);/);
  assert.match(panel, /to\.addEventListener\('input', \(\) => \{ d\.to = to\.value; d\.account = null; \}\);/, 'a name typed is a username again');
  assert.match(panel, /mail\.send\(\{ to: d\.to, account: d\.account, subject: d\.subject, body: d\.body \}\)/);
});

test('NAME-AS a friend\'s letter asks for the ACCOUNT and names the friend beside it - a service from before NAME-AS reads the name alone, and every name it signed was an account\'s, the username the friend\'s row shows; a name typed asks no account, and an account of no id\'s shape is none (mutants: the name not sent beside the account; the account never asked for)', async () => {
  const { fetch, calls } = fakeFetch({ '/v1/mail/send': { body: { ok: true, id: 'l1', to: 'Ysolde' } } });
  const box = new MailBox({ ioOf: () => ({ fetch, secret: 'sec-one' }) });
  const words = { subject: 'Hello', body: 'Meet me at the gate.' };
  assert.deepEqual(await box.send({ to: 'Ysolde', account: 'acct-bbbbbbbbbbbb', ...words }), { ok: true, to: 'Ysolde' });
  assert.deepEqual(calls.at(-1), { path: '/v1/mail/send', body: { to: 'Ysolde', toAccount: 'acct-bbbbbbbbbbbb', ...words } }, 'the account, and the name beside it');
  // a friend whose row shows a character's two words: no username's shape is asked of the name when the account goes
  assert.equal((await box.send({ to: 'Lysandus Tell', account: 'acct-cccccccccccc', ...words })).ok, true);
  assert.deepEqual(calls.at(-1).body, { to: 'Lysandus Tell', toAccount: 'acct-cccccccccccc', ...words });
  // typed: the username alone
  await box.send({ to: '  Ysolde ', ...words });
  assert.deepEqual(calls.at(-1).body, { to: 'Ysolde', ...words }, 'a name typed asks no account');
  // an account of no id's shape is none, and the name is a username again - a phrase is no reader before any call
  const before = calls.length;
  assert.deepEqual(await box.send({ to: 'Lysandus Tell', account: 'not an id!', ...words }), { ok: false, error: 'no-reader' });
  assert.equal(calls.length, before, 'nothing asked');
});
