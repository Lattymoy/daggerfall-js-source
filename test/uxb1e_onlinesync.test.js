// UXB1-E (2026-09-25, the UX backlog: "Add a 'sync from server' option so players can ensure their offline play
// matches the host they prefer to play on if they want.").
//
// Online, the switches the room owns read the room's values and the player's store is never written (onlineLane.js);
// offline the player's own stand again. There is no host to ask - a relay publishes no rules; they are the lane's,
// this build's, the same in every room - so the sync copies the LANE into the offline stores, keeps what it replaced,
// and Undo writes that back. Pinned against the lane's own tables, so a rule added there is a rule the sync copies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const { onlineSyncPlan, applyOnlineSync, undoOnlineSync, lastOnlineSync, ONLINE_SYNC_STORE_KEY, ONLINE_SYNC_SKIPPED_PREFS, ONLINE_LAYOUT_SETTINGS } = await import('../src/systems/onlineSync.js');
const { ONLINE_FORCED_PREFS, ONLINE_FORCED_SETTINGS, ONLINE_ROOM_MOD_KEYS } = await import('../src/systems/onlineLane.js');
const { getPref, setPref, _resetForTests: resetPrefs } = await import('../src/systems/uiPrefs.js');
const { getString, getBool, setValue, saveSettings, _resetForTests: resetSettings } = await import('../src/systems/settings.js');
const { modSetting, setModSetting, _resetModSettings } = await import('../src/systems/modSettings.js');
const { onlineSyncCard, ONLINE_SYNC_TITLE, ONLINE_SYNC_SAME } = await import('../src/ui/enhancedMenu.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
function fresh() {
  store.clear();
  resetPrefs(); resetSettings(); _resetModSettings();
}

test('UXB1-E: the plan is the lane\'s tables, whole - every forced pref but the arms build\'s, every forced setting, the full-size dungeon, every key the room owns - and nothing on an online page', () => {
  fresh();
  const plan = onlineSyncPlan({ search: '' });
  const ids = plan.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'one row a rule');
  const want = [
    ...Object.keys(ONLINE_FORCED_PREFS).filter((k) => !Object.hasOwn(ONLINE_SYNC_SKIPPED_PREFS, k)).map((k) => `prefs:${k}`),
    ...[ONLINE_FORCED_SETTINGS, ONLINE_LAYOUT_SETTINGS].flatMap((t) => Object.entries(t).flatMap(([s, keys]) => Object.keys(keys).map((k) => `settings:${s}/${k}`))),
    ...Object.entries(ONLINE_ROOM_MOD_KEYS).flatMap(([v, keys]) => Object.keys(keys).map((k) => `mods:${v}/${k}`)),
  ];
  assert.deepEqual(ids, want);
  assert.ok(ids.includes('prefs:enhancedAI'), 'the registry\'s `online: true` rows are in the lane\'s table by the time the plan reads it');
  assert.ok(!ids.includes('prefs:mwArms'), 'the arms build\'s switch is its Build\'s to write');
  assert.ok(ids.includes('settings:Experimental/SmallerDungeons'), 'online every dungeon is full size (useSmallerDungeon)');
  assert.equal(ONLINE_LAYOUT_SETTINGS.Experimental.SmallerDungeons, 'False');
  assert.match(read('src/world/smallerDungeons.js'), /if \(online\) return false;/, '...which is the law the row copies');
  for (const r of plan) assert.ok(r.label && !/^[a-z]+[A-Z]/.test(r.label), `${r.id} reads as words: ${r.label}`);
  assert.equal(onlineSyncPlan({ search: '?online' }), null, 'online, every read is the room\'s - the player\'s own cannot be seen');
});

test('UXB1-E: a sync writes only what differs, each into its own store, keeps what it replaced, and Undo puts it back', () => {
  fresh();
  setPref('enhancedAI', false);
  setPref('enhancedWater', false);
  setValue('Controls', 'AllowMagicRepairs', 'False');
  setValue('Experimental', 'SmallerDungeons', 'True');
  setModSetting('pcaao', 'Enabled', false);
  setModSetting('roleplay-realism', 'RefinedTraining.intensiveTraining', true);
  saveSettings();
  const before = onlineSyncPlan({ search: '' });
  assert.deepEqual(before.filter((r) => !r.same).map((r) => r.id).sort(), [
    'mods:pcaao/Enabled', 'mods:roleplay-realism/RefinedTraining.intensiveTraining',
    'prefs:enhancedAI', 'prefs:enhancedWater',
    'settings:Controls/AllowMagicRepairs', 'settings:Experimental/SmallerDungeons',
  ]);
  const rec = applyOnlineSync(before, { now: 1234 });
  assert.equal(rec.at, 1234);
  assert.equal(rec.rows.length, 6);
  assert.equal(getPref('enhancedAI'), true);
  assert.equal(getPref('enhancedWater'), true);
  assert.equal(getBool('Controls', 'AllowMagicRepairs'), true);
  assert.equal(getBool('Experimental', 'SmallerDungeons'), false);
  assert.equal(modSetting('pcaao', 'Enabled'), true);
  assert.equal(modSetting('roleplay-realism', 'RefinedTraining.intensiveTraining'), false);
  assert.ok(onlineSyncPlan({ search: '' }).every((r) => r.same), 'synced: nothing differs');
  // the settings were SAVED - a reload reads them back
  resetSettings();
  assert.equal(getBool('Experimental', 'SmallerDungeons'), false);
  // the record survives a reload too
  assert.deepEqual(lastOnlineSync(), JSON.parse(store.get(ONLINE_SYNC_STORE_KEY)));
  assert.equal(applyOnlineSync(onlineSyncPlan({ search: '' })), null, 'a second sync with nothing to do writes nothing');
  assert.ok(lastOnlineSync(), '...and leaves the undo standing');

  assert.equal(undoOnlineSync(), 6);
  assert.equal(getPref('enhancedAI'), false);
  assert.equal(getPref('enhancedWater'), false);
  assert.equal(getString('Controls', 'AllowMagicRepairs'), 'False');
  resetSettings();
  assert.equal(getBool('Experimental', 'SmallerDungeons'), true, 'saved back');
  assert.equal(modSetting('pcaao', 'Enabled'), false);
  assert.equal(modSetting('roleplay-realism', 'RefinedTraining.intensiveTraining'), true);
  assert.equal(lastOnlineSync(), null, 'the undo is spent');
  assert.equal(undoOnlineSync(), 0);
});

test('UXB1-E: an undo record from another build is read carefully - a key this build no longer declares is passed over, a broken record is none', () => {
  fresh();
  store.set(ONLINE_SYNC_STORE_KEY, JSON.stringify({ at: 1, rows: [
    { store: 'mods', vendor: 'retired-mod', key: 'Enabled', was: false },
    { store: 'prefs', key: 'enhancedAI', was: false },
    { store: 'nowhere', key: 'x', was: 1 },
  ] }));
  setPref('enhancedAI', true);
  assert.equal(undoOnlineSync(), 1);
  assert.equal(getPref('enhancedAI'), false);
  store.set(ONLINE_SYNC_STORE_KEY, '{ torn');
  assert.equal(lastOnlineSync(), null);
  assert.equal(undoOnlineSync(), 0);
});

function fakeEl(tag) {
  const n = {
    tag, tagName: tag.toUpperCase(), children: [], className: '', title: '', type: '', attrs: {}, onclick: null,
    _text: '',
    get textContent() { return n._text + n.children.map((c) => c.textContent).join(''); },
    set textContent(v) { n._text = String(v); n.children.length = 0; },
    append(...cs) { for (const c of cs) n.children.push(c); },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
const find = (n, cls, out = []) => {
  if (n.className.split(/\s+/).includes(cls)) out.push(n);
  for (const c of n.children) find(c, cls, out);
  return out;
};

test('UXB1-E: the Online pane\'s card - what differs, now and then, one press to sync, and Undo after it; nothing to press when nothing differs', () => {
  fresh();
  globalThis.document = { createElement: fakeEl };
  try {
    let card = onlineSyncCard();
    assert.equal(find(card, 'svsync').length, 1);
    assert.equal(card.children[0].textContent, ONLINE_SYNC_TITLE);
    const rows = find(card, 'svsync-row');
    const differ = onlineSyncPlan({ search: '' }).filter((r) => !r.same);
    assert.equal(rows.length, differ.length);
    assert.deepEqual(rows.map((r) => find(r, 'svsync-name')[0].textContent), differ.map((r) => r.label));
    const ai = rows.find((r) => find(r, 'svsync-name')[0].textContent === 'Enhanced AI');
    assert.ok(ai, 'a default shelf differs from the room in Enhanced AI - off offline, on in every room');
    assert.deepEqual([find(ai, 'svsync-was')[0].textContent, find(ai, 'svsync-to')[0].textContent], ['Off', 'On']);
    const [go] = find(card, 'svsync-go');
    assert.equal(go.textContent, `Sync ${differ.length} setting${differ.length === 1 ? '' : 's'}`);
    assert.equal(find(card, 'svsync-undo').length, 0, 'nothing to undo yet');
    go.onclick();
    assert.equal(getPref('enhancedAI'), true);

    card = onlineSyncCard();
    assert.equal(find(card, 'svsync-row').length, 0);
    assert.equal(find(card, 'svsync-same')[0].textContent, ONLINE_SYNC_SAME);
    assert.equal(find(card, 'svsync-go').length, 0);
    const [undo] = find(card, 'svsync-undo');
    assert.ok(undo, 'the way back');
    undo.onclick();
    assert.equal(getPref('enhancedAI'), false);
    assert.equal(find(onlineSyncCard(), 'svsync-undo').length, 0);
  } finally {
    delete globalThis.document;
  }
  // on the pane, with saves and without: under the rules it copies
  const menu = read('src/ui/enhancedMenu.js');
  const pane = menu.slice(menu.indexOf('function paneOnline(body)'), menu.indexOf('export const ONLINE_SYNC_TITLE'));
  assert.equal((pane.match(/body\.append\(onlineSyncCard\(\)\);/g) ?? []).length, 2);
  assert.ok(pane.indexOf("body.append(foot);\n  body.append(onlineSyncCard());") > 0, 'after the footer that names the room\'s switches');
});
