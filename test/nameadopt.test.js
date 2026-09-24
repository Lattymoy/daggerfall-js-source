// NAME-ADOPT (2026-09-22) — THE CLIENT LEARNS WHO IT IS FROM THE SERVICE.
//
// Mac, the first hour the account arc was live:
//   1. "The top right corner button doesnt update with name"
//   2. "Ingame your name shows for other people but you still see your
//       character name in the chat menu"
//
// ONE CAUSE, TWO SYMPTOMS. The account service ISSUES a name, and the
// relay takes it out of the token for everybody ELSE. This device never
// took it in for itself:
//
//   - `register` answers the handle and a recovery code, NOT a session,
//     so the stored session kept the GUEST's name it was written with -
//     and the top-right button reads the stored session.
//   - the online session was built from the CHARACTER's name, under a
//     comment that said it "is carried no further". It was carried
//     further: into the session's own `name`, which the chat roster
//     draws MY row from.
//
// So everybody in the room read `Lattymoy`, and the one person who did
// not was Lattymoy. And the minter was throwing the answer away the
// whole time - it kept `token` and dropped `name`, `kind`, `title` and
// `glyphs` lying right beside it.
//
// Each pin below REPRODUCES a symptom first and then shows it gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adoptIdentity, accountTokenMinter, storedSession, SESSION_KEY, DEFAULT_ACCOUNT_SERVICE,
} from '../src/net/accountClient.js';
import { AccountFlow } from '../src/ui/accountFlow.js';
import { OnlineSession } from '../src/net/online.js';
import { rosterRows } from '../src/net/roster.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function fakeStorage(seed = null) {
  const m = new Map();
  if (seed) m.set(SESSION_KEY, JSON.stringify(seed));
  let writes = 0;
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { writes++; m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
    get writes() { return writes; },
    _map: m,
  };
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

const GUEST = { id: 'acct-aaaaaaaaaaaa', name: 'Mordyval Hawkwing', kind: 'guest', sessionId: 's1', secret: 'sec-one' };

// ── THE DOOR ────────────────────────────────────────────────────────

test('NAME-ADOPT: the adopt door corrects the name and kind of a session that EXISTS, and nothing else', () => {
  const st = fakeStorage(GUEST);
  assert.equal(adoptIdentity(st, { name: 'Lattymoy', kind: 'linked' }), true);
  const now = storedSession(st);
  assert.equal(now.name, 'Lattymoy');
  assert.equal(now.kind, 'linked');
  // THE CREDENTIAL IS UNTOUCHED. This door corrects what is DRAWN; it
  // has no business near what signs a request.
  assert.equal(now.secret, GUEST.secret);
  assert.equal(now.id, GUEST.id);
  assert.equal(now.sessionId, GUEST.sessionId);

  // IT NEVER CREATES A SESSION. An answer that lands after a sign-out
  // must not resurrect one - that would be a signed-out player signed
  // back in by a network race.
  const empty = fakeStorage();
  assert.equal(adoptIdentity(empty, { name: 'Lattymoy', kind: 'linked' }), false);
  assert.equal(storedSession(empty), null);

  // NOTHING TO SAY IS NOTHING WRITTEN. A write is a storage event every
  // open tab hears, and a mint happens on every connect.
  const same = fakeStorage({ ...GUEST, name: 'Lattymoy', kind: 'linked' });
  assert.equal(adoptIdentity(same, { name: 'Lattymoy', kind: 'linked' }), false);
  assert.equal(same.writes, 0);

  // A kind the service does not issue is not adopted; neither is a blank.
  const odd = fakeStorage(GUEST);
  adoptIdentity(odd, { name: '', kind: 'emperor' });
  assert.equal(storedSession(odd).name, GUEST.name);
  assert.equal(storedSession(odd).kind, 'guest');
});

// ── BUG 1: THE TOP-RIGHT BUTTON ─────────────────────────────────────

test('NAME-ADOPT bug 1: a guest who REGISTERS used to keep the guest name in the store the top-right button reads', async () => {
  // Driven through the real flow, the way Mac did it: Continue as guest,
  // then Create account. `register` answers the handle and a recovery
  // code - not a session - which is why the name never moved.
  const st = fakeStorage();
  const { fetch } = fakeFetch({
    '/v1/auth/guest': { body: { id: GUEST.id, name: GUEST.name, kind: 'guest', sessionId: GUEST.sessionId, secret: GUEST.secret } },
    '/v1/auth/register': { body: { recoveryCode: 'TJY8S-KEWD8-R12W3-TZTAX', handle: 'Lattymoy' } },
    '/v1/account': { body: { account: { id: GUEST.id, name: 'Lattymoy', kind: 'linked', handle: 'Lattymoy' }, wardrobe: { titles: ['developer'], title: null, glyphs: ['sprout', 'dev'] }, devices: [] } },
  });
  const flow = AccountFlow({ io: { fetch }, storage: st });
  await flow.start();
  flow.go('register');
  flow.set('handle', 'Lattymoy');
  flow.set('password', 'a-long-enough-password');
  flow.set('confirm', 'a-long-enough-password');
  await flow.submit();
  assert.equal(flow.stage, 'code');

  // THE SYMPTOM, reproduced: between the register and the code being
  // acknowledged, the store still says the guest. This is the state the
  // button was stuck in - and before this slice, it stayed there.
  assert.equal(storedSession(st).name, GUEST.name, 'the register answer carries no session, so nothing has moved yet');

  // ...and acknowledging the code lands on `start()`, which reads the
  // account and ADOPTS what it says.
  await flow.acknowledgeCode();
  assert.equal(flow.stage, 'in');
  assert.equal(storedSession(st).name, 'Lattymoy', 'the top-right button reads this, and it now says the handle');
  assert.equal(storedSession(st).kind, 'linked');
  assert.equal(storedSession(st).secret, GUEST.secret, 'the same session, corrected - not a new one');
});

test('NAME-ADOPT bug 1: and the button reads the store, so the store is the thing that had to be right', () => {
  // Held off the source: `profileMark` draws `who.name` from
  // storedSession. If a later slice moves that read somewhere the adopt
  // door does not reach, this is where it is noticed.
  const menu = rd('src/ui/enhancedMenu.js');
  const mark = menu.slice(menu.indexOf('function profileMark()'), menu.indexOf('function profileMark()') + 700);
  assert.match(mark, /const who = storedSession\(appStorage\(\)\);/);
  assert.match(mark, /who\?\.name \?\? 'Sign in'/);
});

// ── THE MINTER ──────────────────────────────────────────────────────

test('NAME-ADOPT: every mint ADOPTS what the answer says and hands it to the host - and still returns the token alone', async () => {
  const st = fakeStorage(GUEST);
  const { fetch } = fakeFetch({
    '/v1/auth/token': { body: { token: 'v1.abc.def', name: 'Lattymoy', kind: 'linked', title: 'developer', glyphs: ['dev'], expiresAt: 1 } },
  });
  const seen = [];
  const tok = await accountTokenMinter({ fetch, storage: st, onIssued: (who) => seen.push(who) })();
  // THE CONTRACT IS UNCHANGED: the session's deal with this function is
  // a string, and acc1dclient.test.js holds it.
  assert.equal(tok, 'v1.abc.def');
  // ...but the answer is no longer thrown away.
  assert.equal(storedSession(st).name, 'Lattymoy', 'the store learned it');
  assert.deepEqual(seen, [{ name: 'Lattymoy', kind: 'linked', title: 'developer', glyphs: ['dev'], level: null }], 'and so did the host (ADV1: with the level the token was signed with - none from a mint that named no character)');

  // A HOST THAT THROWS DOES NOT COST THE HELLO ITS WORD. The token is
  // good and the connection is what matters; a display seam that breaks
  // must not take the name away from everybody else as well.
  const st2 = fakeStorage(GUEST);
  const t2 = await accountTokenMinter({ fetch, storage: st2, onIssued: () => { throw new Error('a broken host'); } })();
  assert.equal(t2, 'v1.abc.def');

  // A refusal adopts NOTHING - a 503 is not a statement about who I am.
  const st3 = fakeStorage(GUEST);
  const bad = fakeFetch({ '/v1/auth/token': { status: 503, body: { error: 'no-signing-key' } } });
  const heard = [];
  assert.equal(await accountTokenMinter({ fetch: bad.fetch, storage: st3, onIssued: (w) => heard.push(w) })(), null);
  assert.equal(storedSession(st3).name, GUEST.name);
  assert.deepEqual(heard, []);
});

// ── BUG 2: MY OWN ROW IN THE CHAT ROSTER ───────────────────────────

test('NAME-ADOPT bug 2: my own roster row used to show my CHARACTER\'s name while everybody else saw my handle', () => {
  // THE SYMPTOM, reproduced: a session built the way the host built it,
  // from the character. The relay would show everybody else the handle;
  // this is what the player saw of themselves.
  const s = new OnlineSession({ url: 'wss://relay.invalid', name: 'Brother Aldous', WebSocketImpl: class {} });
  const before = rosterRows(s).rows.find((r) => r.me);
  assert.equal(before.name, 'Brother Aldous', 'the bug: the character, in the one row the player reads as themselves');
  assert.equal(before.title, null);

  // THE ANSWER ARRIVES and the session takes it in.
  assert.equal(s.adoptIdentity({ name: 'Lattymoy', title: 'developer', glyphs: ['dev'] }), true);
  const after = rosterRows(s).rows.find((r) => r.me);
  assert.equal(after.name, 'Lattymoy');
  // AND MY OWN BADGE, which had the same bug and nobody had reported
  // yet: ACC3c built my row from the session, and nothing had ever put
  // a title on the session.
  assert.equal(after.title, 'developer');
  assert.deepEqual(after.glyphs, ['dev']);

  // Unchanged is unchanged - no repaint for a mint that says the same.
  assert.equal(s.adoptIdentity({ name: 'Lattymoy', title: 'developer', glyphs: ['dev'] }), false);
});

test('NAME-ADOPT: the session takes its own name through the wire\'s laws, as it takes a stranger\'s', () => {
  // The service is trusted, but a name this side would refuse to draw
  // for a stranger should not be drawn for me either - and a badge this
  // build has never heard of paints nothing, mine included.
  const s = new OnlineSession({ url: 'wss://relay.invalid', name: 'X', WebSocketImpl: class {} });
  s.adoptIdentity({ name: 'Lattymoy', title: 'emperor', glyphs: ['crown', 'dev', 'dev'] });
  assert.equal(s.title, null, 'a title outside the vocabulary is not worn');
  assert.deepEqual(s.glyphs, ['dev'], 'unknown glyphs dropped, duplicates collapsed - readBadge, not a second spelling');
  s.adoptIdentity({});
  assert.equal(s.name, 'Lattymoy', 'an answer with no name leaves the name alone');
});

// ── THE HOST ────────────────────────────────────────────────────────

test('NAME-ADOPT: the host starts from the ISSUED name and every mint corrects every live session', () => {
  const w = rd('src/scenes/world.js');
  // FROM THE FIRST FRAME, not after the first mint: the store already
  // holds the issued name, so the roster is right before any answer
  // arrives. The character is only the last resort.
  assert.match(w, /name: storedSession\(appStorage\(\)\)\?\.name \|\| playerEntity\.name \|\| 'Traveller',/);
  // ...and the comment that CAUSED this is gone. It said the name "is
  // carried no further", which was exactly the wrong belief.
  assert.doesNotMatch(w, /is carried no further\. ACC1g-b takes the/);

  // EVERY live session, read at the moment of the answer - the chat
  // links are built after the minter and rebuilt on a rejoin, so a
  // captured list would go stale on the first reconnect.
  const adopt = w.slice(w.indexOf('const adoptIssued = (who) => {'), w.indexOf('const identityMinter ='));
  assert.match(adopt, /online\?\.adoptIdentity\?\.\(who\);/, 'the presence session');
  assert.match(adopt, /for \(const link of chatLinks\?\.values\?\.\(\) \?\? \[\]\) link\.adoptIdentity\?\.\(who\);/, 'and every chat link - the roster draws my row from whichever link its tab holds');
  assert.match(w, /accountTokenMinter\(\{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), storage: appStorage\(\), onIssued: adoptIssued,\s+character: /);   // ADV1: and the character coming online
});
