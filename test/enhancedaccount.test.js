// ACC1e — THE ACCOUNT CARD, DRIVEN.
//
// node cannot draw, but it CAN make the renderer run, and AUDIT-ACC's
// hardest lesson was that importability is not deployability: the
// account Worker's suite was green over a Worker that could not boot,
// because the pins proved the exports existed and nothing asked the
// runtime to start. So these do not read enhancedAccount.js - they
// BUILD the card on a DOM stub, at every stage, and read back what
// came out.
//
// The stub is test/menu1_enhanced_chunk.test.js's, which is the shape
// this suite already uses for a DOM it does not have.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { accountCard, STAGE_COPY, STAGE_ACTS } from '../src/ui/enhancedAccount.js';
import { AccountFlow, STAGES, FIELDS, FIELD_SPEC } from '../src/ui/accountFlow.js';
import { SESSION_KEY } from '../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The smallest document the card needs. */
function fakeDoc() {
  const mk = (tag) => {
    const n = {
      tag, className: '', textContent: null, type: null, value: '', maxLength: 0,
      autocomplete: null, autocapitalize: null, spellcheck: null, disabled: false,
      children: [],
      append: (...kids) => n.children.push(...kids.filter(Boolean)),
      get text() {
        return [n.textContent, ...n.children.map((c) => c.text)].filter(Boolean).join(' ');
      },
      get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
    };
    // `root.textContent = ''` is how paint() clears; the real DOM drops
    // the children with it, so the stub must too or every repaint would
    // stack on the last one and every assertion below would be a lie.
    Object.defineProperty(n, 'textContent', {
      get() { return n._txt ?? null; },
      set(v) { n._txt = v; if (v === '') n.children.length = 0; },
    });
    return n;
  };
  return { createElement: mk };
}

const storage = (seed = null) => {
  const m = new Map();
  if (seed) m.set(SESSION_KEY, JSON.stringify(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

const build = (seed = null, fetch = async () => { throw new Error('no network in this test'); }) => {
  const flow = AccountFlow({ io: { fetch }, storage: storage(seed) });
  const card = accountCard(fakeDoc(), flow);
  return { flow, card };
};

const classesOf = (card) => card.root.all.map((n) => n.className).filter(Boolean);
const tagsOf = (card) => card.root.all.map((n) => n.tag);

test('ACC1e: EVERY stage draws - a card with a heading, words, and something to press', () => {
  // The failure this catches is a stage added to accountFlow.js without
  // copy or actions here: the card would render a heading of
  // `undefined` and no way off it, and nothing else in the suite looks.
  for (const stage of STAGES) {
    const { flow, card } = build();
    flow.stage = stage;
    if (stage === 'code') flow.recoveryCode = 'AAAAA-BBBBB-CCCCC-DDDDD';
    if (stage === 'in') flow.account = { name: 'Nystul', handle: 'Nystul', kind: 'linked' };
    card.paint();

    const text = card.root.text;
    assert.ok(STAGE_COPY[stage], `${stage} has no copy`);
    assert.ok(text.includes(STAGE_COPY[stage].tag), `${stage} drew no tag`);
    assert.doesNotMatch(text, /undefined|null|\[object/, `${stage} drew a hole in its own copy: ${text.slice(0, 120)}`);

    // every stage but `loading` must offer a way onward
    const buttons = card.root.all.filter((n) => n.tag === 'button');
    if (stage === 'loading') assert.equal(buttons.length, 0, 'nothing is pressable while the service is being asked');
    else assert.ok(buttons.length > 0, `${stage} is a dead end - nothing to press`);

    // ...and exactly one of them leads, never two and never none
    const primary = buttons.filter((b) => b.className.includes('primary'));
    if (stage !== 'loading' && stage !== 'in') {
      assert.equal(primary.length, 1, `${stage} has ${primary.length} primary buttons`);
    }
  }
});

test('ACC1e: every field the flow asks for is DRAWN, with the right kind of box', () => {
  for (const [stage, fields] of Object.entries(FIELDS)) {
    const { flow, card } = build();
    flow.stage = stage;
    card.paint();
    const inputs = card.root.all.filter((n) => n.tag === 'input');
    assert.equal(inputs.length, fields.length, `${stage} asks for ${fields.length} fields and drew ${inputs.length}`);
    fields.forEach((key, i) => {
      const spec = FIELD_SPEC[key];
      assert.equal(inputs[i].type, spec.secret ? 'password' : 'text', `${stage}.${key} is drawn in the wrong kind of box`);
      assert.equal(inputs[i].maxLength, spec.max, `${stage}.${key} does not carry the service's own cap`);
      assert.ok(card.root.text.includes(spec.label), `${stage}.${key} has no label`);
    });
  }
});

test('ACC1e: a password box is never told to autofill the WRONG password', () => {
  // A manager told nothing guesses, and a guess that puts the current
  // password in the NEW password box locks a player out of their own
  // account with their own tooling.
  const want = {
    register: { password: 'new-password', confirm: 'new-password' },
    login: { password: 'current-password' },
    recover: { password: 'new-password', confirm: 'new-password' },
    password: { oldPassword: 'current-password', password: 'new-password', confirm: 'new-password' },
  };
  for (const [stage, fields] of Object.entries(FIELDS)) {
    const { flow, card } = build();
    flow.stage = stage;
    card.paint();
    const inputs = card.root.all.filter((n) => n.tag === 'input');
    fields.forEach((key, i) => {
      if (want[stage]?.[key]) assert.equal(inputs[i].autocomplete, want[stage][key], `${stage}.${key} autocomplete`);
      if (key === 'handle') assert.equal(inputs[i].autocomplete, 'username');
    });
  }
});

test('ACC1e: the recovery code is drawn on its plaque, and the ONLY way off that stage acknowledges it', () => {
  const { flow, card } = build();
  flow.stage = 'code';
  flow.recoveryCode = '7GEPQ-47BS9-AYK70-QMWYW';
  card.paint();

  assert.ok(classesOf(card).includes('acctcode'), 'the code was drawn as ordinary text, not as the plaque');
  assert.ok(card.root.text.includes('7GEPQ-47BS9-AYK70-QMWYW'), 'the code is not on the card at all');
  assert.ok(tagsOf(card).includes('code'), 'the code is not in a <code> element');
  // the strongest sentence on the card has to actually be there
  assert.match(card.root.text, /only time/i, 'the card does not say this is the only time the code is shown');

  const buttons = card.root.all.filter((n) => n.tag === 'button');
  assert.equal(buttons.length, 1, 'the code stage offers a second way off, so the code can be lost by taking it');
  assert.match(buttons[0].textContent, /written it down/i);
});

test('ACC1e: a GUEST is offered a username, not nagged with an empty one', () => {
  const { flow, card } = build();
  flow.stage = 'in';
  flow.account = { name: 'Mithriil Stormaire', guestName: 'Mithriil Stormaire', handle: null, kind: 'guest' };
  card.paint();
  const text = card.root.text;
  assert.ok(text.includes('Mithriil Stormaire'), 'a guest is not told what it is called');
  assert.match(text, /guest/i);
  // ACC0: registering is an upgrade in place and migrates nothing - the
  // card must say that rather than implying a fresh start
  assert.match(text, /keeps everything it already has/i);
  const labels = card.root.all.filter((n) => n.tag === 'button').map((b) => b.textContent);
  assert.ok(labels.some((l) => /username/i.test(l)), 'a guest is offered no way to take a name');
  assert.ok(!labels.some((l) => /change password/i.test(l)), 'a guest with no password was offered to change it');
});

test('ACC1e: while a submission is in flight, nothing is pressable', () => {
  const { flow, card } = build();
  flow.stage = 'register';
  flow.busy = true;
  card.paint();
  const buttons = card.root.all.filter((n) => n.tag === 'button');
  assert.ok(buttons.length > 0);
  for (const b of buttons) assert.equal(b.disabled, true, `'${b.textContent}' can be pressed during a submission`);
  assert.match(card.root.text, /Working/, 'nothing tells the player the press landed');
});

test('ACC1e: a refusal and a confirmation are drawn as different facts', () => {
  {
    const { flow, card } = build();
    flow.stage = 'login'; flow.error = 'That username and password do not match.';
    card.paint();
    assert.ok(classesOf(card).some((c) => c.includes('acctwhy') && c.includes('bad')));
  }
  {
    const { flow, card } = build();
    flow.stage = 'in'; flow.account = { name: 'N', handle: 'N', kind: 'linked' }; flow.note = 'Your password was changed.';
    card.paint();
    assert.ok(classesOf(card).some((c) => c.includes('acctwhy') && c.includes('good')));
  }
});

test('ACC1e: an unknown stage falls back to `out` rather than drawing nothing', () => {
  // A card that renders empty is a player with no way to sign in and
  // nothing to report; `out` is always a safe place to be.
  const { flow, card } = build();
  flow.stage = 'somewhere-nobody-wrote';
  card.paint();
  assert.ok(card.root.text.includes(STAGE_COPY.out.tag));
  assert.ok(card.root.all.some((n) => n.tag === 'button'));
});

test('ACC1e: repainting REPLACES the card rather than stacking on it', () => {
  const { flow, card } = build();
  flow.stage = 'login';
  card.paint();
  const once = card.root.all.filter((n) => n.tag === 'input').length;
  card.paint(); card.paint();
  assert.equal(card.root.all.filter((n) => n.tag === 'input').length, once,
    'every repaint added another copy of the form');
});

// ── THE SKIN ────────────────────────────────────────────────────────

test('ACC1e: every class the card wears is one the enhanced skin defines', () => {
  // The failure this catches is a class typed here and never styled:
  // it draws as unstyled text in the middle of the enhanced skin and
  // looks like a broken page rather than a missing rule.
  const css = src('src/ui/enhancedStyle.js');
  const worn = new Set();
  for (const stage of STAGES) {
    const { flow, card } = build();
    flow.stage = stage;
    if (stage === 'code') flow.recoveryCode = 'A-B';
    if (stage === 'in') flow.account = { name: 'N', handle: null, guestName: 'A B', kind: 'guest' };
    card.paint();
    for (const c of classesOf(card)) for (const one of c.split(/\s+/)) if (one) worn.add(one);
  }
  assert.ok(worn.size >= 8, `the walk found only ${worn.size} classes - it has stopped seeing its subject`);
  const missing = [...worn].filter((c) => !css.includes(`.${c}`));
  assert.deepEqual(missing, [], 'the card wears a class the enhanced skin has no rule for');
});

test('ACC1e F1: no rule in the enhanced skin reads a token nothing declares', () => {
  // This is the pin for the bug ACC1e walked into: `.fieldlabel` said
  // `color: var(--ash)` and NOTHING has ever declared --ash, so the
  // property was invalid at computed-value time and every field label
  // in the skin - ONLINE1's two, the save slot's, and this arc's -
  // inherited --bone instead of a quiet label colour.
  //
  // DERIVED BOTH WAYS: the uses are walked and the declarations are
  // walked, so a token added without a use and a use added without a
  // token both reach this line.
  const css = src('src/ui/enhancedStyle.js')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');       // the note above quotes the bug; it is not a rule
  const declared = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)(?:\s*,[^)]*)?\)/g)].map((m) => m[1]));
  assert.ok(used.size >= 8 && declared.size >= 8, 'the token walk has stopped seeing its subject');
  // A use with a FALLBACK is fine - `var(--x, #fff)` is a deliberate
  // default. Only a bare use of an undeclared token is the bug.
  const bare = new Set([...css.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));
  const ghosts = [...bare].filter((t) => !declared.has(t));
  assert.deepEqual(ghosts, [], 'a rule reads a custom property nothing in the skin declares');
});

test('ACC1e: the card brings no design language of its own', () => {
  // enhancedStyle.js's own header: two copies of a design language is
  // how the front door and the rooms behind it drift apart. So the
  // renderer may not carry a <style>, a styleSheet, or inline colour.
  const js = src('src/ui/enhancedAccount.js')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[ \t])\/\/[^\n]*/gm, '$1');
  for (const smell of [/createElement\(\s*'style'/, /\.style\./, /cssText/, /#[0-9a-fA-F]{6}/]) {
    assert.doesNotMatch(js, smell, `the account card styles itself instead of wearing the skin (${smell})`);
  }
  // ...and every stage's copy and actions are tables, not call sites
  for (const stage of Object.keys(STAGE_ACTS)) assert.ok(STAGES.includes(stage));
});
