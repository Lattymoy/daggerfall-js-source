// TERMS1 (2026-09-28) — THE TERMS OF SERVICE AND THE PRIVACY POLICY,
// AGREED TO BEFORE AN ACCOUNT EXISTS.
//
// "Here is our terms of service and privacy policy. I wanna make sure
// these need to be reviewed and checked off by players before creating
// an account". Answered: the name the documents use is Daggerfall Online,
// their contact is the Discord server, each box sits beside a link to its
// document, and new accounts only are asked.
//
// FOUR THINGS HOLD IT, pinned here end to end:
//   - the DOCUMENTS: terms/index.html and privacy/index.html, dated by
//     their versions and held to a hash of their words;
//   - the FORM: ui/accountFlow.js refuses to send anything until both
//     boxes are ticked, then sends the versions ticked;
//   - the CARD: ui/enhancedAccount.js draws each box unticked with its
//     document linked beside it;
//   - the SERVICE: the two routes that make an account refuse a request
//     that did not tick them, and the row records what was agreed and
//     when - driven through the real Worker on a real SQLite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { TERMS_VERSION, PRIVACY_VERSION, LEGAL_VERSION_RE, TERMS_URL, PRIVACY_URL, ACCEPTED } from '../src/net/legalLaw.js';
import { AccountFlow, STAGES, AGREEMENTS, AGREEMENT_SPEC, LOCAL_REFUSALS } from '../src/ui/accountFlow.js';
import { accountCard } from '../src/ui/enhancedAccount.js';
import { SESSION_KEY, DEFAULT_ACCOUNT_SERVICE, REFUSALS } from '../src/net/accountClient.js';
import { ENHANCED_TOKENS } from '../src/ui/enhancedStyle.js';
import { PIXELIFY_FIVE_FACE } from '../src/ui/pixelifyFive.js';
import { DOCUMENT_PATHS, DOCUMENT_CSS, transformDocument, landingHtml } from '../scripts/landingHtml.mjs';
import worker from '../server-account/src/index.js';
import { createGuest, register, legalRefusal } from '../server-account/src/accounts.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const DOCS = {
  terms: { file: 'terms/index.html', url: TERMS_URL, version: TERMS_VERSION, sections: 16, title: 'Terms of Service' },
  privacy: { file: 'privacy/index.html', url: PRIVACY_URL, version: PRIVACY_VERSION, sections: 18, title: 'Privacy Policy' },
};

/** A document's WORDS: its article with the markup taken off. */
const wordsOf = (html) => html.slice(html.indexOf('<article>'), html.indexOf('</article>'))
  .replace(/<[^>]+>/g, ' ').replaceAll('&amp;', '&').replace(/\s+/g, ' ').trim();

// ═══ THE DOCUMENTS ══════════════════════════════════════════════════

test('TERMS1: each document is dated by its version - the Last Updated a reader sees IS what an account records', () => {
  // The Terms mark a revision by their Last Updated date (section 15),
  // so that date is the version: the page, the form and the service can
  // only agree if the page's date and the law's constant are one fact.
  for (const [name, d] of Object.entries(DOCS)) {
    assert.match(d.version, LEGAL_VERSION_RE, `${name}: a version is a date`);
    const html = read(d.file);
    const dated = [...html.matchAll(/<time datetime="([^"]+)">([^<]+)<\/time>/g)];
    assert.equal(dated.length, 1, `${name}: one Last Updated, not ${dated.length}`);
    assert.equal(dated[0][1], d.version, `${name}: the page's date is not its version in src/net/legalLaw.js`);
    const [y, m, day] = d.version.split('-').map(Number);
    const shown = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
      .format(Date.UTC(y, m - 1, day));
    assert.equal(dated[0][2], shown, `${name}: the date a reader sees is not the date the machine reads`);
    assert.match(html, /<p><strong>Last Updated:<\/strong> <time /, `${name}: the date is the document's own Last Updated line`);
  }
});

test('TERMS1: the words are held to a hash - editing a document means deciding whether it is a new version (mutant: a word changed)', () => {
  // THE WORDS ARE THE PROJECT'S OWN, carried over whole with three things
  // filled in: the name, the date and the contact. An account records
  // WHICH version its player agreed to, so text that changes under a
  // version it keeps is an agreement to words the player never saw. When
  // this reddens: if the change is material, move the Last Updated date
  // and its version in src/net/legalLaw.js; either way, re-hash.
  const HASH = {
    terms: '35891b92a16330f33a5afb5244edde14e486efe3c46ab125aa92cc28b9048333',
    privacy: '0da7783fdaadbf718b0163c35de4542e51546f3e270f0770c7253d7782965c0e',
  };
  for (const [name, d] of Object.entries(DOCS)) {
    const words = wordsOf(read(d.file));
    assert.ok(words.split(' ').length > 1000, `${name}: the walk has stopped seeing the document`);
    assert.equal(createHash('sha256').update(words).digest('hex'), HASH[name], `${name}: the words changed - is this a new version?`);
  }
});

test('TERMS1: nothing of the draft is left unfilled - no placeholder, no old name, and the contact is the Discord the site links', () => {
  // The draft carried [DATE] and three [... EMAIL] placeholders, and the
  // project's name from before BR4. The answer to all three contacts was
  // the Discord server, so each is THE LANDING PAGE'S OWN INVITE - read
  // from it, so a new invite moves the documents with it or reddens here.
  const invite = /<a class="plaque" href="(https:\/\/discord\.gg\/[\w-]+)" rel="noopener">Discord<\/a>/.exec(read('index.html'))?.[1];
  assert.ok(invite, 'the landing page no longer carries its Discord plaque');
  const counts = { terms: 2, privacy: 2 };   // the IP contact and the contact block; the requests line and the contact block
  for (const [name, d] of Object.entries(DOCS)) {
    const html = read(d.file);
    const words = wordsOf(html);
    assert.doesNotMatch(words, /\[[A-Z][A-Z/ ]*\]/, `${name}: a placeholder survives`);
    // The old name as written is the BR1 sweep's (test/brand.test.js walks
    // every tracked file for it); its CAPITALS are this pin's, because the
    // sweep is case-sensitive and the draft's titles were all capitals.
    assert.doesNotMatch(html, /DAGGERFALLJS/, `${name}: the old name survives in a title`);
    assert.equal((words.match(/Daggerfall Online/g) ?? []).length > 10, true, `${name}: the documents speak of the project by its name`);
    const contacts = [...html.matchAll(/<a href="(https:\/\/discord\.gg\/[\w-]+)" rel="noopener">discord\.gg\/([\w-]+)<\/a>/g)];
    assert.equal(contacts.length, counts[name], `${name}: every contact is the Discord`);
    for (const [, href, text] of contacts) {
      assert.equal(href, invite, `${name}: a contact is not the invite the site links`);
      assert.equal(`https://discord.gg/${text}`, href, `${name}: the link says one invite and goes to another`);
    }
  }
});

test('TERMS1: each is a document in order - one heading, every section numbered and none skipped', () => {
  for (const [name, d] of Object.entries(DOCS)) {
    const html = read(d.file);
    assert.equal((html.match(/<h1>/g) ?? []).length, 1, `${name}: one title`);
    assert.match(html, new RegExp(`<h1>DAGGERFALL ONLINE MULTIPLAYER — ${d.title.toUpperCase()}</h1>`), `${name}: its own title`);
    assert.match(html, new RegExp(`<title>${d.title} - Daggerfall Online</title>`), `${name}: the tab says which document`);
    const sections = [...html.matchAll(/<h2 id="section-(\d+)">(\d+)\. [A-Z]/g)].map((m) => [Number(m[1]), Number(m[2])]);
    assert.deepEqual(sections.map(([id]) => id), Array.from({ length: d.sections }, (_, i) => i + 1), `${name}: the sections, in order`);
    for (const [id, n] of sections) assert.equal(id, n, `${name}: section ${n}'s anchor says ${id}`);
  }
});

test('TERMS1: the documents are DOCUMENTS - no script, no file and no style of their own; each links home and to the other (mutant: a script added)', () => {
  for (const [name, d] of Object.entries(DOCS)) {
    const html = read(d.file);
    assert.doesNotMatch(html, /<script/i, `${name}: runs no script`);
    assert.doesNotMatch(html, /<img|<link\b|<style/i, `${name}: references no file and brings no style - the skin is put in at build`);
    assert.match(html, /<a class="skip" href="#main">Skip to content<\/a>/, `${name}: a keyboard reader can skip the bar`);
    assert.match(html, /<main id="main" class="doc">/);
    assert.match(html, /<a class="home" href="\.\.\/">Daggerfall Online<\/a>/, `${name}: the way home is relative, as the site's links are`);
    for (const [other, o] of Object.entries(DOCS)) {
      const current = other === name ? ' aria-current="page"' : '';
      assert.ok(html.includes(`<a href="../${other}/"${current}>${o.title}</a>`), `${name}: its bar names ${other}${current ? ' as the page it is' : ''}`);
    }
  }
});

test('TERMS1: the documents ship - build inputs, served at the paths the form links, and the landing page links them (mutant: an input dropped)', async () => {
  const input = (await import('../vite.config.js')).default.build.rollupOptions.input;
  assert.equal(input.terms, DOCS.terms.file, 'terms/index.html works under npm run dev and never ships');
  assert.equal(input.privacy, DOCS.privacy.file, 'privacy/index.html works under npm run dev and never ships');
  // The form's links are ABSOLUTE (the desktop app's dagger:// cannot
  // reach the site relatively), on the site the README names, at the
  // directory each page is built into.
  const site = /Play it: (https:\/\/[^/\s]+\/)/.exec(read('README.md'))?.[1];
  assert.ok(site, 'the README no longer names the site');
  assert.equal(TERMS_URL, `${site}${DOCS.terms.file.replace('index.html', '')}`);
  assert.equal(PRIVACY_URL, `${site}${DOCS.privacy.file.replace('index.html', '')}`);
  // ...and the site itself links them, from its foot, relatively.
  const end = read('index.html').match(/<footer class="end">([\s\S]*?)<\/footer>/)?.[1] ?? '';
  assert.match(end, /<a href="\.\/terms\/">Terms<\/a>/, 'the landing page\'s foot links the Terms');
  assert.match(end, /<a href="\.\/privacy\/">Privacy<\/a>/, 'and the Privacy Policy');
});

test('TERMS1: the build seam dresses both documents in the skin - its tokens, the five, their one rule set, the fonts and the icon (mutant: a path dropped)', () => {
  assert.deepEqual([...DOCUMENT_PATHS], ['/terms/index.html', '/privacy/index.html']);
  const { handler } = landingHtml().transformIndexHtml;
  for (const path of DOCUMENT_PATHS) {
    const out = handler('<html><head></head><body></body></html>', { path });
    assert.deepEqual(out, transformDocument('<html><head></head><body></body></html>'), `${path} is not dressed as a document`);
  }
  assert.equal(handler('<p>x</p>', { path: '/viewer.html' }), '<p>x</p>', 'a lab page is still left alone');
  const { tags } = transformDocument('<html></html>');
  const byId = (id) => tags.find((t) => t.tag === 'style' && t.attrs?.id === id);
  assert.equal(byId('enhanced-tokens')?.children, ENHANCED_TOKENS, 'the skin\'s tokens, whole');
  assert.equal(byId('enhanced-tokens')?.injectTo, 'head-prepend', '...before anything reads them');
  const own = byId('document-style')?.children ?? '';
  assert.ok(own.startsWith(PIXELIFY_FIVE_FACE), 'the five from its home in the game, ahead of every rule that sets the face');
  assert.ok(own.endsWith(DOCUMENT_CSS), 'and the documents\' one rule set');
  assert.ok(tags.some((t) => t.tag === 'link' && t.attrs?.rel === 'stylesheet' && /fonts\.googleapis\.com\/css2\?family=/.test(t.attrs.href)), 'the skin\'s one fonts request');
  assert.ok(tags.some((t) => t.tag === 'link' && t.attrs?.rel === 'icon'), 'the tab\'s mark');
  assert.ok(tags.some((t) => t.tag === 'meta' && t.attrs?.name === 'theme-color'), 'the phone\'s address bar');
  assert.ok(!tags.some((t) => t.attrs?.id === 'pixel-ground'), 'no night sky behind a document read to the end');
});

test('TERMS1: the documents own no colour and read in the pixel face without its ligatures - the landing page\'s law', () => {
  const skin = read('src/ui/enhancedStyle.js');
  const norm = (c) => c.toLowerCase().replace(/\s+/g, '');
  const colours = (css) => [
    ...[...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => norm(m[0])),
    ...[...css.matchAll(/rgba?\([^)]*\)/g)].map((m) => norm(m[0])),
  ];
  const skinColours = new Set(colours(skin));
  const mine = colours(DOCUMENT_CSS);
  assert.ok(mine.length >= 6, 'the rules do draw in colour');
  assert.deepEqual([...new Set(mine)].filter((c) => !skinColours.has(c)), [], 'a colour the skin does not use');
  const declared = new Set([...ENHANCED_TOKENS.matchAll(/--([\w-]+):/g)].map((m) => m[1]));
  for (const [, t] of DOCUMENT_CSS.matchAll(/var\(--([\w-]+)\)/g)) assert.ok(declared.has(t), `var(--${t}) is no token of the skin's`);
  assert.match(DOCUMENT_CSS, /font-family: 'Pixelify Five', 'Pixelify Sans', monospace;/, 'the five first, as everywhere');
  assert.match(DOCUMENT_CSS, /font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0;/, 'U63: "files" is not "Ales"');
});

// ═══ THE FORM ═══════════════════════════════════════════════════════

function fakeStorage(seed = null) {
  const m = new Map();
  if (seed) m.set(SESSION_KEY, JSON.stringify(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

/** A fetch answering the real service's shapes, recording every call. */
function fakeFetch(script) {
  const calls = [];
  const fetch = async (url, init) => {
    const path = url.replace(DEFAULT_ACCOUNT_SERVICE, '');
    calls.push({ path, body: init.body ? JSON.parse(init.body) : null });
    const step = script[path];
    const answer = typeof step === 'function' ? step(calls.length) : step;
    if (!answer) throw new Error(`the fake service has no answer for ${path}`);
    return { ok: (answer.status ?? 200) < 400, status: answer.status ?? 200, json: async () => answer.body };
  };
  return { fetch, calls };
}

const GUEST = { id: 'acct-aaaaaaaaaaaa', name: 'Mithriil Stormaire', kind: 'guest', sessionId: 's1', secret: 'sec-one' };
const REGISTERED = { recoveryCode: 'CODE1-CODE2', handle: 'Nystul' };
const SERVICE = { '/v1/auth/guest': { body: GUEST }, '/v1/auth/register': { body: REGISTERED } };

const filled = (flow) => {
  flow.go('register');
  flow.set('handle', 'Nystul'); flow.set('password', 'a good long one'); flow.set('confirm', 'a good long one');
};

test('TERMS1: only registering asks, and every box it asks for names a document and where to read it (new accounts only)', () => {
  assert.deepEqual(AGREEMENTS.register, ['terms', 'privacy'], 'the Terms of Service, then the Privacy Policy');
  for (const [stage, keys] of Object.entries(AGREEMENTS)) {
    assert.ok(STAGES.includes(stage), `${stage} asks for boxes and is not a stage`);
    for (const k of keys) {
      assert.ok(AGREEMENT_SPEC[k]?.label, `${stage} asks for '${k}' and nothing names it`);
      assert.ok(LOCAL_REFUSALS[`${k}-unticked`], `'${k}' left unticked has no sentence`);
    }
  }
  assert.deepEqual(Object.keys(AGREEMENTS), ['register'], 'signing in, recovering and changing a password ask nothing - those accounts exist');
  assert.equal(AGREEMENT_SPEC.terms.url, TERMS_URL);
  assert.equal(AGREEMENT_SPEC.privacy.url, PRIVACY_URL);
  assert.equal(AGREEMENT_SPEC.terms.label, DOCS.terms.title);
  assert.equal(AGREEMENT_SPEC.privacy.label, DOCS.privacy.title);
  assert.deepEqual({ ...ACCEPTED }, { terms: TERMS_VERSION, privacy: PRIVACY_VERSION });
});

test('TERMS1: NOTHING LEAVES THE DEVICE until both boxes are ticked - not the guest row, not the name (mutants: the boxes unasked; privacy unasked)', async () => {
  for (const [ticks, want] of [[[], 'terms-unticked'], [['privacy'], 'terms-unticked'], [['terms'], 'privacy-unticked']]) {
    const { fetch, calls } = fakeFetch(SERVICE);
    const flow = AccountFlow({ io: { fetch }, storage: fakeStorage() });
    filled(flow);
    for (const k of ticks) flow.agree(k, true);
    assert.equal(await flow.submit(), false, `ticked [${ticks}] and it went through`);
    assert.equal(flow.error, LOCAL_REFUSALS[want], `ticked [${ticks}]: the sentence names the box`);
    assert.equal(calls.length, 0, `ticked [${ticks}]: a request left - the guest row it opens IS an account`);
    assert.equal(flow.stage, 'register');
    assert.equal(flow.values.handle, 'Nystul', 'what was typed survives the refusal');
  }
});

test('TERMS1: both ticked, the guest row and the name each carry the versions ticked (mutants: either request sent bare)', async () => {
  const { fetch, calls } = fakeFetch(SERVICE);
  const flow = AccountFlow({ io: { fetch }, storage: fakeStorage() });
  filled(flow);
  flow.agree('terms', true); flow.agree('privacy', true);
  assert.equal(await flow.submit(), true, flow.error);
  assert.deepEqual(calls.map((c) => c.path), ['/v1/auth/guest', '/v1/auth/register']);
  for (const c of calls) {
    assert.equal(c.body.terms, TERMS_VERSION, `${c.path}: the Terms version ticked`);
    assert.equal(c.body.privacy, PRIVACY_VERSION, `${c.path}: the Privacy Policy version ticked`);
  }
  assert.equal(flow.stage, 'code', 'and the account is made');
  // A guest from before the boxes, naming itself, is asked too - and
  // sends them with the one call it makes.
  const g = fakeFetch(SERVICE);
  const legacy = AccountFlow({ io: { fetch: g.fetch }, storage: fakeStorage(GUEST) });
  filled(legacy);
  assert.equal(await legacy.submit(), false, 'a guest named itself without ticking');
  assert.equal(g.calls.length, 0);
  legacy.agree('terms', true); legacy.agree('privacy', true);
  assert.equal(await legacy.submit(), true, legacy.error);
  assert.deepEqual(g.calls.map((c) => [c.path, c.body.terms, c.body.privacy]), [['/v1/auth/register', TERMS_VERSION, PRIVACY_VERSION]]);
});

test('TERMS1: a box is ticked by the player, on the stage in front of them - wiped by a move, kept through a refusal, and only `true` ticks (mutants: ticks carried across a move; truthy ticks)', async () => {
  let attempt = 0;
  const { fetch, calls } = fakeFetch({
    '/v1/auth/guest': { body: GUEST },
    '/v1/auth/register': () => (++attempt === 1 ? { status: 400, body: { error: 'handle-taken' } } : { body: REGISTERED }),
  });
  const flow = AccountFlow({ io: { fetch }, storage: fakeStorage() });
  filled(flow);
  flow.agree('terms', true); flow.agree('privacy', true);
  flow.go('out'); flow.go('register');
  assert.deepEqual(flow.agreed, {}, 'the boxes came back ticked on a stage the player had left');
  filled(flow);
  flow.agree('terms', 'yes'); flow.agree('privacy', 1);
  assert.equal(await flow.submit(), false, 'something merely truthy ticked a box');
  assert.equal(calls.length, 0);
  flow.agree('terms', true); flow.agree('privacy', true);
  assert.equal(await flow.submit(), false, 'the name was taken');
  assert.equal(flow.error, REFUSALS['handle-taken']);
  assert.deepEqual(flow.agreed, { terms: true, privacy: true }, 'a refused NAME did not untick the boxes');
  flow.set('handle', 'Nystul2');
  assert.equal(await flow.submit(), true, flow.error);
  assert.equal(calls.filter((c) => c.path === '/v1/auth/guest').length, 1, 'the retry opened a second row');
});

test('TERMS1: a tick clears the refusal under the boxes, as a keystroke does, and the service\'s two words have sentences', async () => {
  const flow = AccountFlow({ io: fakeFetch(SERVICE), storage: fakeStorage() });
  filled(flow);
  await flow.submit();
  assert.equal(flow.error, LOCAL_REFUSALS['terms-unticked']);
  flow.agree('terms', true);
  assert.equal(flow.error, '', 'the sentence outlived the tick that answered it');
  assert.match(REFUSALS['terms-unaccepted'], /Terms of Service and the Privacy Policy/);
  assert.match(REFUSALS['terms-stale'], /Reload/, 'a player holding old text is told to reload, not to tick again');
});

// ═══ THE CARD ═══════════════════════════════════════════════════════

/** The account card's DOM stub (test/enhancedaccount.test.js's shape). */
function fakeDoc() {
  const mk = (tag) => {
    const n = {
      tag, className: '', type: null, value: '', checked: false, href: null, target: null, rel: null, children: [],
      append: (...kids) => n.children.push(...kids.filter(Boolean)),
      get text() { return [n.textContent, ...n.children.map((c) => c.text)].filter(Boolean).join(' '); },
      get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
    };
    Object.defineProperty(n, 'textContent', {
      get() { return n._txt ?? null; },
      set(v) { n._txt = v; if (v === '') n.children.length = 0; },
    });
    return n;
  };
  return { createElement: mk };
}

test('TERMS1: the card draws each box UNTICKED, its document linked beside it and opened outside the game (mutants: a box drawn ticked; the link in the game\'s own tab)', () => {
  const flow = AccountFlow({ io: fakeFetch(SERVICE), storage: fakeStorage() });
  const card = accountCard(fakeDoc(), flow);
  flow.go('register'); card.paint();
  const rows = card.root.all.filter((n) => n.tag === 'label' && n.className === 'acctagree');
  assert.equal(rows.length, 2, 'two boxes');
  for (const [i, key] of AGREEMENTS.register.entries()) {
    const row = rows[i];
    const box = row.all.find((n) => n.tag === 'input');
    const link = row.all.find((n) => n.tag === 'a');
    assert.equal(box.type, 'checkbox');
    assert.equal(box.checked, false, `${key} arrived ticked - the player did not tick it`);
    assert.equal(link.textContent, AGREEMENT_SPEC[key].label);
    assert.equal(link.href, AGREEMENT_SPEC[key].url);
    assert.equal(link.target, '_blank', `${key}: reading it would leave the form`);
    assert.equal(link.rel, 'noopener');
    assert.match(row.text, new RegExp(`^I have read and agree to the\\s+${AGREEMENT_SPEC[key].label}$`));
    // the box speaks to the flow, and a repaint shows what the flow holds
    box.checked = true; box.onchange();
    assert.equal(flow.agreed[key], true, `${key}: the tick did not reach the flow`);
  }
  card.paint();
  const after = card.root.all.filter((n) => n.tag === 'input' && n.type === 'checkbox');
  assert.deepEqual(after.map((b) => b.checked), [true, true], 'a repaint lost the ticks');
  // The boxes sit under the fields and over the buttons.
  const kids = card.root.children;
  const lastField = kids.findLastIndex((n) => n.tag === 'label' && n.className === 'field');
  const firstBox = kids.findIndex((n) => n.className === 'acctagree');
  const acts = kids.findIndex((n) => n.className === 'acts');
  assert.ok(lastField < firstBox && firstBox < acts, 'the boxes are not between the fields and the button');
  // ...and no other stage draws one.
  for (const stage of STAGES.filter((s) => s !== 'register')) {
    flow.stage = stage;
    if (stage === 'code') flow.recoveryCode = 'A-B';
    if (stage === 'in') flow.account = { name: 'N', handle: 'N', kind: 'linked' };
    card.paint();
    assert.ok(!card.root.all.some((n) => n.type === 'checkbox'), `${stage} drew a box`);
  }
});

// ═══ THE SERVICE ════════════════════════════════════════════════════

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

/** A D1-shaped face over node:sqlite, every migration applied. */
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(read(`server-account/migrations/${f}`));
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

const service = () => {
  const env = { DB: d1(), ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json() };
  };
  const rows = () => env.DB._raw.prepare('SELECT * FROM players ORDER BY created_at').all();
  return { env, call, rows };
};
const nowS = () => Math.floor(Date.now() / 1000);

test('TERMS1: the migration adds what an agreement is - two versions and a moment, nothing else', () => {
  const sql = read('server-account/migrations/0023_terms.sql');
  const added = [...sql.matchAll(/^ALTER TABLE players ADD COLUMN (\w+) (\w+);$/gm)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(added, ['terms_version TEXT', 'privacy_version TEXT', 'legal_accepted_at INTEGER']);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /DEFAULT|NOT NULL|UPDATE /i,
    'every row made before it keeps NULL - those accounts were never asked, and no default invents that they were');
});

test('TERMS1: the guest route opens NO row for a request that has not ticked the current documents (mutant: the guest route unasked)', async () => {
  const { call, rows } = service();
  const cases = [
    [{}, 'not-found', 'AUDIT PRE-MERGE 0929 T1: neither document named - a game from before the boxes, told in a word it renders ("The game may need updating")'],
    [{ terms: TERMS_VERSION }, 'terms-unaccepted', 'the Privacy Policy unticked'],
    [{ privacy: PRIVACY_VERSION }, 'terms-unaccepted', 'the Terms unticked'],
    [{ terms: true, privacy: true }, 'terms-unaccepted', 'a tick is a version, not a flag'],
    [{ terms: '2000-01-01', privacy: '2000-01-01' }, 'terms-stale', 'text this service no longer holds'],
    [{ terms: TERMS_VERSION, privacy: '2000-01-01' }, 'terms-stale', 'one of the two out of date'],
  ];
  for (const [legal, word, why] of cases) {
    const r = await call('/v1/auth/guest', { label: 'x', ...legal });
    assert.equal(r.status, 400, `${why}: ${r.status}`);
    assert.deepEqual(r.body, { error: word }, why);
  }
  assert.equal(rows().length, 0, 'a refused request still wrote a row');
  const before = nowS();
  const made = await call('/v1/auth/guest', { label: 'x', ...ACCEPTED });
  assert.equal(made.status, 200);
  const [row] = rows();
  assert.equal(row.id, made.body.id);
  assert.equal(row.terms_version, TERMS_VERSION, 'the row forgot which Terms were ticked');
  assert.equal(row.privacy_version, PRIVACY_VERSION, 'the row forgot which Privacy Policy was ticked');
  assert.ok(row.legal_accepted_at >= before && row.legal_accepted_at <= nowS(), 'the row forgot when');
});

test('TERMS1: the register route names nobody who has not ticked, and records the agreement with the name (mutants: register unasked; the name recorded without it)', async () => {
  const { env, call, rows } = service();
  // A GUEST FROM BEFORE THE BOXES: a row with no agreement on it, made
  // the way the service made every row until today.
  const rand = (b) => crypto.getRandomValues(b);
  const ctx = { db: env.DB, subtle: crypto.subtle, rand, nowS: nowS() };
  const old = await createGuest(ctx, { deviceLabel: 'an old phone' });
  assert.equal(rows()[0].terms_version, null, 'a row made with nothing ticked claims an agreement');
  const bare = await call('/v1/auth/register', { handle: 'Nystul', password: 'a good long one' }, old.secret);
  assert.equal(bare.status, 400);
  assert.deepEqual(bare.body, { error: 'not-found' }, 'AUDIT PRE-MERGE 0929 T1: a game from before the boxes is told it may need updating');
  const half = await call('/v1/auth/register', { handle: 'Nystul', password: 'a good long one', terms: TERMS_VERSION }, old.secret);
  assert.deepEqual(half.body, { error: 'terms-unaccepted' });
  const stale = await call('/v1/auth/register', { handle: 'Nystul', password: 'a good long one', terms: '2000-01-01', privacy: '2000-01-01' }, old.secret);
  assert.deepEqual(stale.body, { error: 'terms-stale' });
  assert.equal(rows()[0].handle, null, 'a refused registration still named the account');
  const before = nowS();
  const ok = await call('/v1/auth/register', { handle: 'Nystul', password: 'a good long one', ...ACCEPTED }, old.secret);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const [row] = rows();
  assert.equal(row.handle, 'Nystul');
  assert.deepEqual([row.terms_version, row.privacy_version], [TERMS_VERSION, PRIVACY_VERSION], 'named, and the agreement unrecorded');
  assert.ok(row.legal_accepted_at >= before && row.legal_accepted_at <= nowS());
});

test('TERMS1: an account that exists signs in and recovers without being asked - new accounts only (mutant: login asks)', async () => {
  const { env, call } = service();
  const ctx = { db: env.DB, subtle: crypto.subtle, rand: (b) => crypto.getRandomValues(b), nowS: nowS() };
  // registered before TERMS1: no agreement on the row at all
  const g = await createGuest(ctx, {});
  const { recoveryCode } = await register(ctx, g.id, { handle: 'Elder', password: 'a good long one' });
  const login = await call('/v1/auth/login', { handle: 'Elder', password: 'a good long one' });
  assert.equal(login.status, 200, `an existing account was stopped at sign-in: ${JSON.stringify(login.body)}`);
  const back = await call('/v1/auth/recover', { handle: 'Elder', code: recoveryCode, password: 'another long one' });
  assert.equal(back.status, 200, `an existing account was stopped at recovery: ${JSON.stringify(back.body)}`);
});

test('TERMS1: a row records only an agreement to the CURRENT documents, and naming an account never erases one (mutants: any version written; the COALESCE dropped)', async () => {
  const { env, rows } = service();
  const ctx = { db: env.DB, subtle: crypto.subtle, rand: (b) => crypto.getRandomValues(b), nowS: nowS() };
  assert.equal(legalRefusal(ACCEPTED), null);
  assert.deepEqual(legalRefusal({ terms: '2000-01-01', privacy: PRIVACY_VERSION }), { error: 'terms-stale' });
  assert.deepEqual(legalRefusal(null), { error: 'not-found' }, 'AUDIT PRE-MERGE 0929 T1: a body naming neither document');
  assert.deepEqual(legalRefusal({ terms: null, privacy: PRIVACY_VERSION }), { error: 'terms-unaccepted' });
  await createGuest(ctx, { legal: { terms: '2000-01-01', privacy: '2000-01-01' } });
  assert.deepEqual([rows()[0].terms_version, rows()[0].legal_accepted_at], [null, null], 'a row recorded an agreement to text the service does not hold');
  const g = await createGuest({ ...ctx, nowS: ctx.nowS + 1 }, { legal: ACCEPTED });
  const at = rows().find((r) => r.id === g.id).legal_accepted_at;
  assert.equal(at, ctx.nowS + 1);
  await register({ ...ctx, nowS: ctx.nowS + 5 }, g.id, { handle: 'Keeper', password: 'a good long one' });
  const row = rows().find((r) => r.id === g.id);
  assert.equal(row.handle, 'Keeper');
  assert.deepEqual([row.terms_version, row.privacy_version, row.legal_accepted_at], [TERMS_VERSION, PRIVACY_VERSION, at],
    'naming the account without an agreement in hand erased the one its row already held');
});
