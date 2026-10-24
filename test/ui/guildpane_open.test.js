// GUILD-PANE OPEN (2026-10-24, Travis: "go ahead and add that open in pack button and lets see how it functions"): THE
// GUILD WINDOW'S VAULT PAGE OPENS THE PACK WITH THE VAULT BESIDE IT. The button speaks the input language, as the
// level-up row does (ui/levelUp/levelUpOpener.js): it closes the window and presses the Inventory action's key - which
// opens the pack in every host, in its own slot - and leaves word for that pack to open on the vault
// (ui/guildVaultOpener.js). No host learns anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUILD_RANK_NAMES } from '../../src/net/guild/guildLaw.js';
import { GuildBook } from '../../src/net/guild/guildBook.js';
import { createSocialPanel } from '../../src/ui/socialPanel.js';
import { SocialState } from '../../src/net/social.js';
import { codeForAction, loadOrCreateBindings } from '../../src/systems/inputActions.js';
import { setPref, getPref } from '../../src/systems/uiPrefs.js';

const opener = async () => {
  const m = await import('../../src/ui/guildVaultOpener.js').catch(() => null);
  assert.ok(m && typeof m.openVaultInPack === 'function', 'src/ui/guildVaultOpener.js exports openVaultInPack');
  return m;
};
/** The page's key presses, caught: a KeyboardEvent the test can read, and the window's dispatch. */
function catchKeys() {
  const sent = [];
  const realKE = globalThis.KeyboardEvent;
  globalThis.KeyboardEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  const win = { dispatchEvent: (e) => { sent.push(e); return true; } };
  return { sent, win, restore: () => { globalThis.KeyboardEvent = realKE; } };
}
const settle = () => new Promise((r) => setImmediate(r));
const tick = () => new Promise((r) => setTimeout(r, 0));

test('GUILD-PANE OPEN THE OPENER: a tap of the Inventory key, down then up, and the word left for the pack - taken once, and only while fresh (mutants: no word left; the word taken twice; a stale word honoured; the key unpressed)', async () => {
  const m = await opener();
  const k = catchKeys();
  try {
    const key = codeForAction(loadOrCreateBindings(), 'Inventory');
    assert.ok(key, 'the default build binds the pack (guard)');
    assert.equal(m.vaultPaneBound(), true);
    let t = 1000;
    assert.equal(m.openVaultInPack({ defer: false, win: k.win, now: () => t }), true);
    assert.deepEqual(k.sent.map((e) => [e.type, e.code]), [['keydown', key], ['keyup', key]], 'one tap of the pack key');
    assert.equal(k.sent[0].bubbles, true);
    assert.equal(m.takeVaultPaneWanted(t + 10), true, 'the pack that opens finds the word');
    assert.equal(m.takeVaultPaneWanted(t + 20), false, 'once: the next pack opens as it always did');
    m.openVaultInPack({ defer: false, win: k.win, now: () => t });
    assert.equal(m.takeVaultPaneWanted(t + m.VAULT_PANE_WANT_MS + 1), false, 'a word older than the window is let go - a pack opened later by hand is not the vault\'s');
    assert.equal(m.takeVaultPaneWanted(t + 1), false, 'and it was let go, not kept');
    // deferred: the press waits a task (the window closes first, as the level-up row's does)
    k.sent.length = 0;
    m.openVaultInPack({ win: k.win, now: () => t });
    assert.equal(k.sent.length, 0, 'not in the same call');
    await tick();
    assert.deepEqual(k.sent.map((e) => e.type), ['keydown', 'keyup'], 'pressed on the next task');
    m.takeVaultPaneWanted(t);
  } finally { k.restore(); }
});

// ─── the guild window's Vault page ────────────────────────────────────────────────────────
function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false,
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    getAttribute(k) { return n.attrs[k]; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { n.focused = true; doc.activeElement = n; },
    remove() { n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const buttonOf = (root, label) => find(root, 'dfsocial-btn').find((b) => b.textContent === label || b.children[0]?.textContent === label);
const guildView = () => ({
  id: 'g0123456789', name: 'The Hand', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 0, hallGold: 0, foundedAt: 1, rank: 0,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, vault: { level: 'withdraw', limit: 0, granted: false } }],
  invites: [], ledger: [], hall: null, heraldry: null, renamedAt: null, renameAt: null,
  vault: { used: 0, max: 50, me: { level: 'withdraw', limit: 0, granted: false, taken: 0 } },
});
async function vaultPage() {
  const guild = guildView();
  const door = {
    mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }),
    vault: async () => ({ ok: true, data: { vault: { max: 50, items: [], log: [], me: guild.vault.me } } }),
  };
  const book = new GuildBook({ door, character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }),
    pack: { items: () => [], add() {}, changed() {}, reach: () => true } });
  const panel = createSocialPanel({ social: new SocialState({ acct: 'a' }), guild: book, doc: fakeDocument(), win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
  panel.openGuild('vault');
  for (let i = 0; i < 6; i++) { await settle(); panel.render(); }
  return panel;
}

test('GUILD-PANE OPEN THE BUTTON: the guild window\'s Vault page carries "Open in pack" on the enhanced skin; it closes the window, presses the pack key and leaves the pack its word to open on the vault; the classic skin, whose pack has no vault, shows none (mutants: no button; the window left up; the key unpressed; no word left; the button on the classic skin)', async () => {
  const m = await opener();
  const k = catchKeys();
  const realDispatch = globalThis.dispatchEvent;
  globalThis.dispatchEvent = k.win.dispatchEvent;
  const skin = getPref('skin');
  try {
    const panel = await vaultPage();
    assert.equal(panel.root.dataset.open, '1', 'the guild window is up (guard)');
    const b = buttonOf(panel.root, 'Open in pack');
    assert.ok(b, 'the Vault page offers Open in pack');
    b.fire('click');
    assert.equal(panel.root.dataset.open, '0', 'the window goes down first');
    await tick();
    const key = codeForAction(loadOrCreateBindings(), 'Inventory');
    assert.deepEqual(k.sent.map((e) => [e.type, e.code]), [['keydown', key], ['keyup', key]], 'then the pack key, once');
    assert.equal(m.takeVaultPaneWanted(), true, 'and the pack that opens is told to open on the vault');

    setPref('skin', 'classic');
    const classic = await vaultPage();
    assert.equal(buttonOf(classic.root, 'Open in pack'), undefined, 'the classic skin\'s pack has no vault: no button');
  } finally {
    setPref('skin', skin ?? 'enhanced');
    k.restore();
    if (realDispatch) globalThis.dispatchEvent = realDispatch; else delete globalThis.dispatchEvent;
    m.takeVaultPaneWanted();
  }
});
