// PARTY-BUFFS (2026-09-27, Discord - Tabitha, who plays paladins, clerics and mages: "Allow us to see buff timers or
// SOME sort of indicator that we have placed a buff on a party teammate [preferably on their party portrait, maybe?]
// ... I'd also like floating Heal numbers").
//
// A PARTY MATE'S EFFECTS ARE THEIRS TO SAY: each member's party pose carries its own live spell effects (net/wire.js
// validPartyPose `fx`, composed by net/partyBuffs.js composePartyFx from the same bundles the HUD rows), and every
// other member's card draws them under the bars (ui/partyPanel.js). A heal a member gained between two poses floats
// "+N" off their card; a heal I took floats "+N" off my own reticle (ui/hitNumbers.js healNumberFor, drawn by the
// enhanced HUD). The pins drive the wire, the composer, the card over a fake document, and the HUD over a stub one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validPartyPose, PARTY_FX_MAX, PARTY_FX_NAME_MAX, PARTY_FX_ROUNDS_MAX, CAST_ICON_MAX } from '../src/net/wire.js';
import { composePartyFx, partyFxKey, partyFxAbbrev, partyHealOf } from '../src/net/partyBuffs.js';
import { SocialState } from '../src/net/social.js';
import { createPartyPanel, PARTY_CSS } from '../src/ui/partyPanel.js';
import { healNumberFor } from '../src/ui/hitNumbers.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── THE FAKE DOCUMENT (test/soc4_partyhud.test.js's shape, with its write and structure counters) ─────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, id: '', attrs: {}, listeners: new Map(), removed: false, src: '', alt: '',
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } doc.structure++; },
    replaceChildren(...cs) { for (const c of n.children) c.parent = null; n.children = []; for (const c of cs) { c.parent = n; n.children.push(c); } doc.structure++; },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    fire(t) { for (const fn of n.listeners.get(t) ?? []) fn(); },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); doc.writes++; } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); doc.writes++; } });
  n.style = new Proxy({}, { set(t, k, v) { t[k] = v; doc.writes++; return true; } });
  if (n.tagName === 'CANVAS') n.getContext = () => null;
  return n;
}
function fakeDocument() {
  const doc = { writes: 0, structure: 0 };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  doc.zero = () => { doc.writes = 0; doc.structure = 0; };
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };

const POSE = Object.freeze({ px: 100, py: 200, loc: 'Daggerfall', in: 0, h: 30, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2 });
const member = (n, over = {}) => ({ acct: `acct-${n}`, name: n, online: true, seen: 1e12, peers: [`peer-${n}`], p: null, ...over });
const stateFrame = (party) => ({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac', friends: [], in: [], out: [], party, invites: [] });

function stand({ fxIcon = () => null } = {}) {
  const doc = fakeDocument();
  const social = new SocialState({ now: () => 1e12 });
  social.apply(stateFrame({ id: 'q-party-1', leader: 'acct-me', members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran')] }));
  const panel = createPartyPanel({ social, doc, faceLoader: async () => null, touch: false, fxIcon });
  const pose = (over) => { social.applyParty('acct-Bran', validPartyPose({ ...POSE, ...over })); panel.render({}); };
  return { doc, social, panel, pose, card: () => panel.cardFor('acct-Bran') };
}

// A bundle's entries as the entity carries them (systems/mysticism.js liveBundles groups them by bundleId).
const fxEntity = (...bundles) => ({
  activeEffects: bundles.flatMap((b, k) => (b.rounds ?? [10]).map((r) => ({
    bundleId: k + 1, bundleName: b.name, bundleIcon: b.icon ?? 3, bundleType: b.type ?? 'Spell',
    bundleSelfCast: !!b.self, bundleAlly: !!b.ally, roundsRemaining: r, kind: b.kind ?? 'heal', ended: !!b.ended,
  }))),
});

// ── THE WIRE ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('PARTY-BUFFS the wire: a pose carries at most PARTY_FX_MAX effects, each {i, r, n, d?} - the icon within the spellbook\'s, the rounds floored and held under PARTY_FX_ROUNDS_MAX, the name a label of PARTY_FX_NAME_MAX, `d` only as 1; an entry out of bounds is dropped and an empty list omitted (mutants: the cap gone; a bad icon kept; the debuff flag coerced)', () => {
  assert.deepEqual([PARTY_FX_MAX, PARTY_FX_NAME_MAX, PARTY_FX_ROUNDS_MAX], [8, 24, 9999]);
  const fx = validPartyPose({ ...POSE, fx: [
    { i: 3, r: 40.7, n: 'Regenerate' },
    { i: CAST_ICON_MAX + 1, r: 5, n: 'No such icon' },
    { i: 2.5, r: 5, n: 'Half an icon' },
    { i: 4, r: -1, n: 'Negative rounds' },
    { i: 5, r: 7, n: 'Curse', d: 1 },
    { i: 6, r: 1e9, n: 'Fortify Strength and Endurance Forever', d: true },
    null, 'text', [1, 2],
  ] }).fx;
  assert.deepEqual(fx, [
    { i: 3, r: 40, n: 'Regenerate' },
    { i: 5, r: 7, n: 'Curse', d: 1 },
    { i: 6, r: PARTY_FX_ROUNDS_MAX, n: 'Fortify Strength and End' },
  ], 'the bad entries dropped, the rounds floored and held, the name cut, `d: true` read as no debuff');
  assert.equal('fx' in validPartyPose({ ...POSE, fx: [] }), false, 'an empty list is omitted');
  assert.equal('fx' in validPartyPose({ ...POSE, fx: 'Regenerate' }), false);
  assert.equal('fx' in validPartyPose({ ...POSE }), false, 'a pose from before this build reads as before');
  assert.equal(validPartyPose({ ...POSE, rs: 1 }).rs, 1, 'resting');
  assert.equal('rs' in validPartyPose({ ...POSE, rs: true }), false, 'only as 1');
  assert.equal('rs' in validPartyPose({ ...POSE }), false);
  const many = Array.from({ length: 20 }, (_, k) => ({ i: k, r: k, n: `Spell ${k}` }));
  assert.equal(validPartyPose({ ...POSE, fx: many }).fx.length, PARTY_FX_MAX, 'eight at most');
});

// ── THE COMPOSER ─────────────────────────────────────────────────────────────────────────────────────────────────

test('PARTY-BUFFS composePartyFx: my live effects as my HUD rows them - buffs (my casts and other players\' gifts) before debuffs, `d: 1` on a debuff, the rounds the bundle\'s MOST, the name without its leading "!", a held item\'s bundle and an icon-less one left off, eight at most - and what it composes the wire keeps whole (mutants: the held item kept; the order lost; the rounds the first entry\'s)', () => {
  const me = fxEntity(
    { name: 'Poison', icon: 7, rounds: [4] },
    { name: '!Regenerate', icon: 3, self: true, rounds: [12, 30, 5] },
    { name: 'Ring of Shielding', icon: 9, type: 'HeldMagicItem', rounds: [1] },
    { name: 'Open', icon: 1, self: true, kind: 'openArmed' },
    { name: 'Shield', icon: 11, ally: true, rounds: [20] },
    { name: 'Gone', icon: 12, self: true, ended: true },
  );
  const fx = composePartyFx(me);
  assert.deepEqual(fx, [
    { i: 3, r: 30, n: 'Regenerate' },
    { i: 11, r: 20, n: 'Shield' },
    { i: 7, r: 4, n: 'Poison', d: 1 },
  ]);
  assert.deepEqual(validPartyPose({ ...POSE, fx }).fx, fx, 'an honest pose is never trimmed by the wire');
  assert.deepEqual(composePartyFx({ activeEffects: [] }), []);
  assert.deepEqual(composePartyFx(null), []);
  const crowd = fxEntity(...Array.from({ length: 12 }, (_, k) => ({ name: `Buff ${k}`, icon: k, self: true })));
  assert.equal(composePartyFx(crowd).length, PARTY_FX_MAX);
  const odd = composePartyFx(fxEntity({ name: 'x'.repeat(40), icon: 400, self: true, rounds: [1e6] }))[0];
  assert.deepEqual(odd, { i: 0, r: PARTY_FX_ROUNDS_MAX, n: 'x'.repeat(PARTY_FX_NAME_MAX) }, 'composed within the wire\'s bounds');
});

test('PARTY-BUFFS the helpers: the key a card compares, the letters for an icon not yet in hand, and the heal a pose says (a rise alone - not a first pose, not a loss, not while resting)', () => {
  assert.equal(partyFxKey([{ i: 3, r: 30, n: 'Regenerate' }, { i: 7, r: 4, n: 'Poison', d: 1 }]), '3:30:0:Regenerate|7:4:1:Poison');
  assert.equal(partyFxKey(null), '');
  assert.notEqual(partyFxKey([{ i: 3, r: 30, n: 'A' }]), partyFxKey([{ i: 3, r: 29, n: 'A' }]), 'a round ticking is a change');
  assert.equal(partyFxAbbrev('Regenerate'), 'Reg');
  assert.equal(partyFxAbbrev('Fortify Strength'), 'FS');
  assert.equal(partyFxAbbrev('cure disease of the mind'), 'CDO');
  assert.equal(partyFxAbbrev(''), '?');
  assert.equal(partyHealOf(30, { h: 45 }), 15);
  assert.equal(partyHealOf(30, { h: 20 }), 0, 'a loss is no heal');
  assert.equal(partyHealOf(null, { h: 45 }), 0, 'a first pose is no heal');
  assert.equal(partyHealOf(30, { h: 45, rs: 1 }), 0, 'a night\'s climb is no heal anyone cast - their own, or one they follow');
  assert.equal(partyHealOf(30, { h: 45, rest: { mode: 0, hoursRemaining: 3, totalHours: 4, kind: null } }), 0, '...or the leader\'s session');
  assert.equal(partyHealOf(0, { h: 45 }), 0, 'a rise from death says itself');
  assert.equal(partyHealOf(30, { h: 'x' }), 0);
});

test('PARTY-BUFFS the host: my pose carries my effects, and only while there are any (mutants: the field never spread)', () => {
  const W = src('src/scenes/world.js');
  assert.match(W, /import \{ composePartyFx \} from '\.\.\/net\/partyBuffs\.js';/);
  assert.match(W, /\.\.\.partyFxField\(\),/);
  assert.match(W, /const partyFxField = \(\) => \{ const fx = composePartyFx\(playerEntity\); return fx\.length \? \{ fx \} : \{\}; \};/);
  assert.match(W, /\.\.\.\(playerEntity\.isResting \? \{ rs: 1 \} : \{\}\),/, 'resting, mine or followed (a rest window, real or mirrored, raises isResting - scenes/shared.js setResting)');
});

// ── THE CARD ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('PARTY-BUFFS the card: a member\'s effects are a row under their bars - the spell\'s icon (its letters until the art lands), the rounds over its corner, the name and rounds on its title, a debuff outlined - rewritten only when it moved, and gone with the last effect or the member going away (mutants: the row never drawn; the debuff class dropped; a rewrite per pose)', () => {
  let art = false;
  const { doc, social, pose, card, panel } = stand({ fxIcon: (i) => (art && i === 3 ? 'data:image/png;base64,icon3' : null) });
  pose({});
  const c = card();
  assert.equal(c.fx.className, 'dfparty-fx off', 'nothing on them: no row');
  assert.equal(c.fx.children.length, 0);
  pose({ fx: [{ i: 3, r: 30, n: 'Regenerate' }, { i: 7, r: 4, n: 'Poison', d: 1 }] });
  assert.equal(c.fx.className, 'dfparty-fx');
  const tiles = c.fx.children;
  assert.deepEqual(tiles.map((t) => t.className), ['dfparty-fxe', 'dfparty-fxe debuff']);
  assert.deepEqual(tiles.map((t) => t.children[0].textContent), ['Reg', 'Poi'], 'the letters while the icon is on its way');
  assert.deepEqual(tiles.map((t) => find(t, 'dfparty-fxr')[0].textContent), ['30', '4']);
  assert.deepEqual(tiles.map((t) => t.attrs.title), ['Regenerate - 30 rounds', 'Poison - 4 rounds (harmful)']);
  // the same effects again, and nothing else moved: not one write
  doc.zero();
  pose({ fx: [{ i: 3, r: 30, n: 'Regenerate' }, { i: 7, r: 4, n: 'Poison', d: 1 }] });
  assert.equal(doc.structure, 0, 'an unchanged row is not rebuilt');
  // the art lands: the next pose puts the icon where the letters were - even one that says nothing new
  art = true;
  pose({ fx: [{ i: 3, r: 30, n: 'Regenerate' }, { i: 7, r: 4, n: 'Poison', d: 1 }] });
  assert.equal(c.fx.children[0].children[0].tagName, 'IMG');
  assert.equal(c.fx.children[0].children[0].src, 'data:image/png;base64,icon3');
  assert.equal(c.fx.children[1].children[0].textContent, 'Poi', 'an icon still on its way keeps its letters');
  pose({ fx: [{ i: 3, r: 29, n: 'Regenerate' }, { i: 7, r: 3, n: 'Poison', d: 1 }] });
  assert.equal(find(c.fx.children[0], 'dfparty-fxr')[0].textContent, '29', 'the count follows their clock');
  // the last effect ends: the row goes
  pose({});
  assert.equal(c.fx.className, 'dfparty-fx off');
  assert.equal(c.fx.children.length, 0);
  // away: a stale pose's effects are not drawn
  pose({ fx: [{ i: 3, r: 10, n: 'Regenerate' }] });
  assert.equal(c.fx.className, 'dfparty-fx');
  social.apply({ t: 'social', k: 'party', party: { id: 'q-party-1', leader: 'acct-me', members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran', { online: false, seen: 1e12 - 60_000, peers: [], p: validPartyPose({ ...POSE, fx: [{ i: 3, r: 10, n: 'Regenerate' }] }) })] } });
  panel.render({});
  assert.equal(c.fx.className, 'dfparty-fx off', 'an away seat carries no effects');
  assert.match(PARTY_CSS, /\.dfparty-fx\.off \{ display: none; \}/);
  assert.match(PARTY_CSS, /\.dfparty-fxe\.debuff \{ box-shadow: 0 0 0 1px #e2554c; \}/);
});

test('PARTY-BUFFS the card\'s heal: health a member gained between two poses floats "+N" off their card and is gone when it has risen - never for a first pose, a wound, or a night\'s rest (mutants: the float never made; a float on a hit; the node left behind)', () => {
  const { pose, card } = stand();
  pose({ h: 30 });
  const heals = () => find(card().node, 'dfparty-heal');
  assert.equal(heals().length, 0, 'a first pose is no heal');
  pose({ h: 45 });
  assert.deepEqual(heals().map((n) => n.textContent), ['+15']);
  heals()[0].fire('animationend');
  assert.equal(heals().length, 0, 'gone when it has risen');
  pose({ h: 20 });
  assert.equal(heals().length, 0, 'a wound flares the bar, it floats nothing');
  pose({ h: 50, rs: 1 });
  assert.equal(heals().length, 0, 'the hours of a rest are no heal anyone cast');
  pose({ h: 58 });
  assert.deepEqual(heals().map((n) => n.textContent), ['+8']);
  assert.match(PARTY_CSS, /\.dfparty-card \{ position: relative;/, 'the float hangs off the card');
  assert.match(PARTY_CSS, /\.dfparty-heal \{ position: absolute;[^}]*animation: dfparty-heal 1\.2s ease-out forwards; pointer-events: none; \}/);
});

// ── MY OWN HEAL ──────────────────────────────────────────────────────────────────────────────────────────────────

test('PARTY-BUFFS healNumberFor: a heal I took is "+N" of the heal kind - a rise alone, from a frame the HUD saw (mutants: a first frame floated; a loss floated)', () => {
  assert.deepEqual(healNumberFor(30, 45), { kind: 'heal', text: '+15', tag: null });
  assert.equal(healNumberFor(null, 45), null, 'the first frame back from a window');
  assert.equal(healNumberFor(45, 30), null);
  assert.equal(healNumberFor(30, 30), null);
  assert.equal(healNumberFor(30, 30.4), null, 'a sliver that rounds to nothing');
  assert.equal(healNumberFor(30, NaN), null);
});

const mkEl = () => ({
  className: '', textContent: '', id: '', children: [], dataset: {},
  style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
  classList: {
    _s: new Set(),
    add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); },
    toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); },
  },
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
  removeAttribute(a) { delete this.attrs[a]; }, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
  replaceChildren(...c) { this.children = c; }, addEventListener() {},
});

test('PARTY-BUFFS the HUD: a heal I took rises as "+N" on the damage numbers\' layer - once per rise, never for a loss, and never for what a window restored (the frames under a rest, a level-up, a load or a death are hidden, and the first one back is a fresh reading) (mutants: the reading kept through a hidden frame; the float never shown)', async () => {
  const prev = globalThis.document;
  globalThis.document = { createElement: mkEl, createElementNS: () => mkEl(), getElementById: () => null, head: mkEl(), body: mkEl() };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../src/ui/enhancedHud.js');
  const { clearQuickslots } = await import('../src/systems/quickslots.js');
  clearQuickslots();
  const heals = () => document.body.children.flatMap((layer) => layer.children ?? []).filter((n) => n.className === 'hitnum hitnum-heal').map((n) => n.textContent);
  const me = { health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null };
  const frame = (opts = {}) => drawEnhancedHud(me, 0, 0, { weapon: null, weaponSheathed: true, ...opts });
  try {
    frame();
    assert.deepEqual(heals(), [], 'the first frame is a reading, not a heal');
    me.health = 52; frame();
    assert.deepEqual(heals(), ['+12']);
    frame();
    assert.deepEqual(heals(), ['+12'], 'once per rise');
    me.health = 30; frame();
    assert.deepEqual(heals(), ['+12'], 'a wound floats nothing here');
    frame({ hidden: true });
    me.health = 80; frame({ hidden: true });
    frame();
    assert.deepEqual(heals(), ['+12'], 'the night\'s rest under the window is not floated');
    me.health = 85; frame();
    assert.deepEqual(heals(), ['+12', '+5']);
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    globalThis.document = prev;
  }
  assert.match(src('src/ui/enhancedStyle.js'), /\.hitnum-heal \{ top: 50%; color: #8fe27f;/);
});

// ─── AUDIT (the batch's audit, agent B) ────────────────────────────────────────────────────────────────────────────

test('AUDIT PARTY-BUFFS B8: a card my window covers forgets what it saw - a mate\'s rest that ended under the window (its flag gone) floated "+40" the frame it closed; a heal seen after floats as ever (mutants: the covered card keeping its health)', () => {
  const { social, panel, pose, card } = stand();
  const heals = () => find(card().node, 'dfparty-heal');
  pose({ h: 20 });
  panel.render({ covered: true });                                                  // my rest window opens
  social.applyParty('acct-Bran', validPartyPose({ ...POSE, h: 60, hm: 60 }));       // Bran's night ends under it
  panel.render({ covered: true });
  panel.render({});                                                                 // the window closes
  assert.equal(heals().length, 0, 'what the window hid is no heal');
  pose({ h: 40, hm: 60 });
  pose({ h: 52, hm: 60 });
  assert.deepEqual(heals().map((n) => n.textContent), ['+12'], 'a heal seen floats as ever');
});
