// ACC3c — THE EQUIP CONTROL, AND THE BADGE WHEREVER A NAME IS DRAWN.
//
// Mac (2026-09-22): "Players can tap the account icon to equip 1
// feature along with signing out."
//
// ACC3a proved the service derives the grants and stores the worn one;
// ACC3b drew the badge over a head. Until this, a player could HOLD
// two titles and had no way to pick between them, and the one list of
// names a player reads most - the chat roster - showed bare names
// while the same names wore titles in the world.
//
// ═══ WHAT THESE PINS ARE ACTUALLY FOR ══════════════════════════════
//
// THE CLIENT MUST NOT DECIDE WHAT IS HELD. The grant is derived at the
// service and can lapse between this card being drawn and the button
// being pressed - a developer taken off the config list is the real
// case - so the flow ASKS and takes the service's answer whole. A
// client that kept its own idea of the wardrobe is a client that can
// wear anything, which is the hole ACC1g shut one field over.
//
// AND THE CARD MUST NOT STYLE ITSELF. ACC1e's own pin forbids a colour
// in `ui/enhancedAccount.js`, and the first cut of this slice broke it
// by writing `style.color` from the badge table. The colour moved into
// the skin, WALKED out of the vocabulary, so the gold on the card and
// the gold over a head stay one fact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { AccountFlow } from '../src/ui/accountFlow.js';
import { SESSION_KEY, DEFAULT_ACCOUNT_SERVICE, REFUSALS, accountRefusalText } from '../src/net/accountClient.js';
import { GLYPH_LABEL } from '../src/ui/enhancedAccount.js';
import { TITLE_TEXT, TITLE_RGBA, GLYPH_RGBA, badgeCss, badgeClass, cssRgba } from '../src/ui/playerBadge.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { TITLES, GLYPHS } from '../src/net/identityToken.js';
import { rosterRows } from '../src/net/roster.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function fakeStorage(seed = null) {
  const m = new Map();
  if (seed) m.set(SESSION_KEY, JSON.stringify(seed));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}
function fakeFetch(script) {
  const calls = [];
  const fetch = async (url, init) => {
    const path = url.replace(DEFAULT_ACCOUNT_SERVICE, '').replace(/^https?:\/\/[^/]+/, '');
    calls.push({ path, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    const step = script[path];
    const answer = typeof step === 'function' ? step(calls.length) : step;
    if (!answer) throw new Error(`the fake service has no answer for ${path}`);
    if (answer.throws) throw new Error('network down');
    return { ok: answer.status ? answer.status < 400 : true, status: answer.status ?? 200, json: async () => answer.body };
  };
  return { fetch, calls };
}

const SESSION = { id: 'acct-aaaaaaaaaaaa', name: 'Mack', kind: 'linked', sessionId: 's1', secret: 'sec-one' };
const ACCOUNT = { id: 'acct-aaaaaaaaaaaa', name: 'Mack', kind: 'linked', handle: 'mack' };
const WARDROBE = { titles: ['founder', 'developer'], title: null, glyphs: ['dev'] };

const stand = (script, seed = SESSION) => {
  const { fetch, calls } = fakeFetch(script);
  const storage = fakeStorage(seed);
  return { flow: AccountFlow({ io: { fetch }, storage }), calls, storage };
};

// ── THE FLOW ────────────────────────────────────────────────────────

test('ACC3c: the wardrobe rides the account view, and a service too old to answer one leaves it NULL rather than empty', async () => {
  const { flow } = stand({ '/v1/account': { body: { account: ACCOUNT, wardrobe: WARDROBE, devices: [] } } });
  await flow.start();
  assert.equal(flow.stage, 'in');
  assert.deepEqual(flow.wardrobe, WARDROBE);
  // ITS OWN FIELD, not folded into the account: an account view is the
  // ROW, a wardrobe is the row read against the service's config and
  // clock, and only one of the two takes env.
  assert.equal(flow.account.titles, undefined, 'the wardrobe is not smuggled onto the account');

  // NULL, NOT `{titles:[]}`. The card reads null as "draw no picker"
  // and an empty list as "you hold nothing" - and a build talking to a
  // service from before ACC3 must get the first, or every player sees
  // an empty control that can never do anything.
  const { flow: old } = stand({ '/v1/account': { body: { account: ACCOUNT, devices: [] } } });
  await old.start();
  assert.equal(old.wardrobe, null);
});

test('ACC3c: equipping ASKS - the service answers the row after the write, and the flow takes it whole', async () => {
  // THE SERVICE'S ANSWER DIFFERS FROM WHAT A LOCAL PATCH WOULD MAKE,
  // deliberately, and that is the whole of this pin: the wardrobe was
  // `{founder, developer}` wearing nothing with a dev glyph, and the
  // answer says the developer grant has gone. That is the REAL case -
  // a handle taken off the config list, discovered at the moment of
  // the write - and a flow that patched its own copy would keep the
  // lapsed title in the picker and the dead glyph beside it. The
  // campaign caught this: the first cut of this fixture made the two
  // identical, so the mutant that patches locally survived.
  const { flow, calls } = stand({
    '/v1/account': { body: { account: ACCOUNT, wardrobe: WARDROBE, devices: [] } },
    '/v1/account/title': { body: { ok: true, titles: ['founder'], title: 'founder', glyphs: [] } },
  });
  await flow.start();
  assert.deepEqual(flow.wardrobe.titles, ['founder', 'developer'], 'the card was drawn holding two');
  assert.equal(await flow.equip('founder'), true);
  const put = calls.find((c) => c.path === '/v1/account/title');
  assert.deepEqual(put.body, { title: 'founder' });
  assert.equal(put.headers.authorization, `Bearer ${SESSION.secret}`, 'the credential is a header, never a URL (AUDIT-ACC F13)');
  // THE ANSWER IS THE TRUTH, WHOLE - it describes the row AFTER the
  // write, so nothing here guesses what took and nothing carries a
  // grant the service has stopped making.
  assert.deepEqual(flow.wardrobe, { titles: ['founder'], title: 'founder', glyphs: [] });
  assert.equal(flow.busy, false);
  assert.ok(flow.note, 'and the player is told');
});

test('ACC3c: pressing the title ALREADY WORN takes it off - a picker whose only way to wear nothing is another button is a button that does nothing most of the time', async () => {
  const { flow, calls } = stand({
    '/v1/account': { body: { account: ACCOUNT, wardrobe: { ...WARDROBE, title: 'developer' }, devices: [] } },
    '/v1/account/title': { body: { ok: true, titles: ['founder', 'developer'], title: null, glyphs: ['dev'] } },
  });
  await flow.start();
  await flow.equip('developer');
  assert.deepEqual(calls.find((c) => c.path === '/v1/account/title').body, { title: null }, 'the worn one, pressed again, is a removal');
  assert.equal(flow.wardrobe.title, null);
});

test('ACC3c: a title that LAPSED between the card and the press is the service\'s refusal, in words, with nothing written', async () => {
  // The real case: a developer taken off the config list while their
  // card is open. The grant is derived, so the card is stale and the
  // service is right - and the player is told what happened rather
  // than blamed for it.
  const { flow } = stand({
    '/v1/account': { body: { account: ACCOUNT, wardrobe: WARDROBE, devices: [] } },
    '/v1/account/title': { status: 403, body: { error: 'not-held' } },
  });
  await flow.start();
  assert.equal(await flow.equip('developer'), false);
  assert.equal(flow.error, REFUSALS['not-held']);
  assert.notEqual(REFUSALS['not-held'], REFUSALS['no-title'], 'two situations, two sentences: one is "not yours", the other is a build behind the service');
  assert.equal(flow.wardrobe.title, null, 'and NOTHING was written - a refusal that half-lands is worse than one that does not land');
  assert.equal(flow.busy, false, 'the card is usable again');
});

test('ACC3c: a dead credential signs out, a network failure does not, and neither throws', async () => {
  // `auth` is the ONE refusal that forgets a session, and it is
  // handled in the flow's single `ask` door rather than here - this is
  // the pin that says equipping really goes through it.
  const { flow, storage } = stand({
    '/v1/account': { body: { account: ACCOUNT, wardrobe: WARDROBE, devices: [] } },
    '/v1/account/title': { status: 401, body: { error: 'auth' } },
  });
  await flow.start();
  await flow.equip('founder');
  assert.equal(flow.stage, 'out');
  assert.equal(flow.wardrobe, null, 'a wardrobe outliving its account is a title drawn for nobody');
  assert.equal(storage.getItem(SESSION_KEY), null);

  // A THROW IS A REFUSAL (ONCRASH1: a throw out of a button handler
  // ends more than the button), and the session SURVIVES it - signing
  // somebody out over a bad second is an outage made permanent.
  const { flow: f2, storage: s2 } = stand({
    '/v1/account': { body: { account: ACCOUNT, wardrobe: WARDROBE, devices: [] } },
    '/v1/account/title': { throws: true },
  });
  await f2.start();
  await assert.doesNotReject(() => f2.equip('founder'));
  assert.equal(f2.stage, 'in');
  assert.equal(f2.error, accountRefusalText('offline'));
  assert.ok(s2.getItem(SESSION_KEY), 'the session is kept');
});

test('ACC3c: nothing equips while a call is in flight, and nothing equips off the signed-in stage', async () => {
  let release;
  const held = new Promise((r) => { release = r; });
  const { flow, calls } = stand({
    '/v1/account': { body: { account: ACCOUNT, wardrobe: WARDROBE, devices: [] } },
    '/v1/account/title': async () => { await held; return { body: { ok: true, titles: ['founder'], title: 'founder', glyphs: [] } }; },
  });
  await flow.start();
  const first = flow.equip('founder');
  assert.equal(await flow.equip('developer'), false, 'ONE PRESS IS ONE WRITE - the second is refused, not queued');
  release();
  await first;
  assert.equal(calls.filter((c) => c.path === '/v1/account/title').length, 1);

  // Signed out, there is nothing to equip and no credential to do it
  // with - so it does not reach the service at all.
  const { flow: out, calls: c2 } = stand({ '/v1/account': { body: { account: ACCOUNT, devices: [] } } }, null);
  await out.start();
  assert.equal(out.stage, 'out');
  assert.equal(await out.equip('founder'), false);
  assert.equal(c2.length, 0, 'no round trip is spent on behalf of nobody');
});

// ── THE CARD, AND THE RULE IT ALMOST BROKE ──────────────────────────

test('ACC3c: the card writes a CLASS and the skin carries the colour - walked out of the vocabulary, so a title added to the token cannot draw grey', () => {
  // ACC1e's pin forbids a colour in this file, and the first cut of
  // this slice broke it by setting `style.color` off the badge table.
  // That pin was right: two copies of a design language is how the
  // front door and the rooms behind it drift apart.
  const js = src('src/ui/enhancedAccount.js')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[ \t])\/\/[^\n]*/gm, '$1');
  assert.doesNotMatch(js, /\.style\./, 'the card styles itself again');
  assert.doesNotMatch(js, /#[0-9a-fA-F]{6}/);

  // ...and the rules really exist, one per member of the vocabulary,
  // in the colour ui/playerBadge.js holds.
  for (const t of TITLES) {
    const rule = new RegExp(`\\.card button\\.acttitle\\.${badgeClass('tl', t)} \\{ color: ${cssRgba(TITLE_RGBA[t])}; \\}`);
    assert.match(badgeCss(), rule, `${t} has no rule`);
    assert.match(ENHANCED_CSS, rule, `${t}'s rule never reached the skin`);
  }
  for (const g of GLYPHS) {
    assert.ok(ENHANCED_CSS.includes(`.card .acctglyph.${badgeClass('gl', g)} .acctglyphart { color: ${cssRgba(GLYPH_RGBA[g])}; }`), `${g} has no rule in the skin`);
  }
  // A GLYPH IS NAMED ON THIS CARD, because a wardrobe is a list of
  // things a player holds and a coloured shape with nothing beside it
  // is a list nobody can read. (Over a head it needs no word - there
  // it is a picture, and the room is the context.)
  for (const g of GLYPHS) assert.ok(GLYPH_LABEL[g], `${g} has no word on the card`);
  for (const t of TITLES) assert.ok(TITLE_TEXT[t], `${t} has no word`);
});

test('ACC3c: the glyphs are NOT buttons - a glyph is true of an account rather than chosen by one', () => {
  const js = src('src/ui/enhancedAccount.js');
  // The picker's own arm builds `button` elements; the glyph arm must
  // build a span and hang nothing clickable on it. Read off the source
  // because the difference is a promise to the player, not a detail.
  const wardrobe = js.slice(js.indexOf('function wardrobe()'), js.indexOf('function paint()'));
  assert.match(wardrobe, /el\('button', `acttitle/, 'a title is pressable');
  assert.match(wardrobe, /el\('span', `acctglyph/, 'a glyph is not an element you press');
  const glyphArm = wardrobe.slice(wardrobe.indexOf('acctglyph'));
  assert.doesNotMatch(glyphArm, /onclick|addEventListener/, 'a control that cannot be operated is worse than a fact that never offered');
});

// ── THE ROSTER ──────────────────────────────────────────────────────

test('ACC3c: the chat roster wears the badge, MY OWN ROW INCLUDED - the relay never sends me my own roster entry', () => {
  const session = {
    id: 'peer-0001', name: 'Mack', title: 'developer', glyphs: ['dev'],
    peers: new Map([
      ['peer-0002', { id: 'peer-0002', name: 'Ragnar', title: 'founder', glyphs: ['sprout'] }],
      ['peer-0003', { id: 'peer-0003', name: 'Zed' }],
    ]),
  };
  const { rows } = rosterRows(session);
  const by = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(by.Mack.title, 'developer', 'my own row - without this, the one name a player looks at most is the only one with no title on it');
  assert.deepEqual(by.Mack.glyphs, ['dev']);
  assert.equal(by.Ragnar.title, 'founder');
  assert.deepEqual(by.Zed.glyphs, [], 'and an unbadged peer gets the shape, not undefined');
  assert.equal(by.Zed.title, null);

  // IT GOES THROUGH THE WIRE'S OWN CHECKER, so a relay sending a title
  // nobody has heard of paints nothing here either.
  const liar = rosterRows({ id: 'peer-0009', name: 'Nobody', title: 'emperor', glyphs: ['crown'], peers: new Map() });
  assert.equal(liar.rows[0].title, null);
  assert.deepEqual(liar.rows[0].glyphs, []);
  assert.match(src('src/net/roster.js'), /readBadge\(from\)/, 'one reader, not a second spelling of the vocabulary check');
});

test('ACC3c / TITLE-R: the roster REPAINTS when a glyph changes - it is keyed, and a stale glyph would sit on screen until somebody else joined; it wears NO title (Mac: "Titles shouldnt show in the online panel. Only glyphs"), and the glyphs follow the name (mutants: the glyphs out of the key; the title back on the row)', () => {
  // SOC3 put the open menu in this key for exactly this reason. A
  // sprout that aged out changes nothing else about the row - so
  // without the glyphs in the key the list is correct and never redrawn.
  const panel = src('src/ui/chatPanel.js');
  const key = /const key = label \+ '\|' \+ total \+ '\|' \+ \(menuFor \?\? ''\) \+ '\|' \+ rows\.map\(\(r\) => [^\n]*\)\.join\(','\);/.exec(panel);   // CHAT-CHAN: the list's own word leads the key
  assert.ok(key, 'the roster key moved');
  assert.match(key[0], /r\.glyphs/, 'a glyph that changes must repaint the row it is on');
  assert.doesNotMatch(key[0], /r\.title/, 'TITLE-R: the row draws no title, so a title changing repaints nothing');
  const row = panel.slice(panel.indexOf("const line = el('div', 'dfchat-who-line');"), panel.indexOf("if (dup.has(r.name.toLowerCase()))"));
  assert.doesNotMatch(row, /titleBadge|who-title/, 'TITLE-R: no title on the roster row');
  // CHAT-FIT: they sit in the row's one nowrap LINE (`line`), not on the row itself
  assert.ok(row.indexOf('line.append(nameEl)') >= 0 && row.indexOf('line.append(nameEl)') < row.indexOf('dfchat-who-glyph'), 'the glyphs after the name');
  // the title stays where Mac kept it: over the name (ui/nameLayer.js, net/remotePlayers.js) and on a chat line
  assert.match(panel, /const badgeNodes = \(peer, prefix\) => \{\s*const badge = titleBadge\(peer\);/, 'a chat line still wears its author\'s title');
});
