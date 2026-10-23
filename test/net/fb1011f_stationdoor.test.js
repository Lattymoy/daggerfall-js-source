// FIELD BUGS 2026-10-11f STATION-DOOR (Mac: "can't refund a station even though I think my enchanter is bugged now
// because I can't do that disenchant thing"). A home's enchanting station (200,000 gold) opened Daggerfall's item maker
// and nothing else; Disenchanting stood at the foot of the Stores page with no door from the station to it - and the
// alchemy station's brew the same. The press now offers both: the maker, or the act on the Stores page, landed on its
// station. Driven through the host's own functions (worldModes.js useDecorStation, openStationMaker, offerStationActs)
// and the page's own draw. bible/01-Overview/bugs/Field-Bugs-2026-10-11f.md.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { ChoiceWindow } from '../../src/ui/talkWindow.js';
import { SERVICE_LABEL, SERVICE_DESTINATION, isServiceBox } from '../../src/systems/guild/guildServiceFlow.js';
import { DECOR_STATIONS, DECOR_STATION_SERVICES, DECOR_STATION_NAMES } from '../../src/net/decorLaw.js';
import { xpForRank, trackOf } from '../../src/net/professionLaw.js';
import {
  STORES_ACT_STATIONS, PROF_STATIONS, focusStoresStation, setProfessionsPages, drawStoresPage, resetProfPages,
  ENCHANTING_HOW, ALCHEMY_HOW,
} from '../../src/ui/professions/profPages.js';

const require = createRequire(import.meta.url);
const { parse } = require('acorn');
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// ─── THE HOST'S PRESS, AS IT SHIPS ──────────────────────────────────

const M = src('src/scenes/worldModes.js');
const fns = {};
(function walk(n) {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'FunctionDeclaration' && ['useDecorStation', 'openStationMaker', 'offerStationActs'].includes(n.id?.name)) fns[n.id.name] = M.slice(n.start, n.end);
  for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
})(parse(M, { ecmaVersion: 'latest', sourceType: 'module' }));

test('STATION-DOOR: the host\'s three functions are found', () => {
  assert.deepEqual(Object.keys(fns).sort(), ['offerStationActs', 'openStationMaker', 'useDecorStation']);
});

/** The three functions over a stub room - `online` whether the Stores page works (forgeOffered), `owner` whether the
 *  room is mine, `makerOpens` whether the maker's art has landed - the doors writing the host's own slot, as
 *  mountServiceWindow and openPauseFlow's show do. */
function rig(opts) {
  const log = { said: [], flows: [], pauses: [], focus: [] };
  let host = null;
  const env = {
    stationOwnerHere: () => opts?.owner ?? true, hallMemberHere: () => false, caravanGuestHere: () => false, interiorHome: (opts?.owner ?? true) ? null : { owner: 'Someone' },   // PIN MOVED (FB1018D HOME-BENCH): the press asks the stations' owner question
    homeBelongsLine: () => 'This is not your home.', say: (t) => log.said.push(t),
    PROF_STATIONS, forgeOffered: () => opts?.online ?? true, stationColdLine: (k) => `cold ${k}`,
    interiorKeyCtx: { togglePause: (o) => { log.pauses.push({ ...o, slotWas: host.slot }); host.slot = { pause: true }; } },
    STORES_ACT_STATIONS, focusStoresStation: (k) => log.focus.push(k),
    townTalk: null, DECOR_STATION_SERVICES, DECOR_STATION_NAMES, SERVICE_LABEL, SERVICE_DESTINATION, isServiceBox, ChoiceWindow,
    openServiceFlow: (dest) => { log.flows.push(dest); if (opts?.makerOpens ?? true) host.slot = { maker: dest }; return null; },
    DECOR_STATION_REFUSED: 'refused', DECOR_STATION_NOT_READY: 'not ready',
  };
  const body = `let interiorOverlay = null;\n${fns.useDecorStation}\n${fns.openStationMaker}\n${fns.offerStationActs}\n`
    + 'return { press: useDecorStation, get slot() { return interiorOverlay; }, set slot(v) { interiorOverlay = v; } };';
  host = Function(...Object.keys(env), body)(...Object.values(env));
  return { host, log };
}

test('STATION-DOOR: an enchanting station pressed online offers Daggerfall\'s item maker and Disenchanting - the press opens no maker by itself (mutants: the chooser never offered; offered offline)', () => {
  const { host, log } = rig();
  host.press({ station: 'enchant' });
  assert.equal(log.flows.length, 0, 'nothing opened under the chooser');
  const c = host.slot;
  assert.equal(c?.isChoiceWindow, true, 'the chooser stands in the room\'s slot');
  assert.deepEqual(c.lines, ['Enchanting station']);
  assert.deepEqual(c.options.map((o) => [o.code, o.label]), [['Digit1', '1 - Make Magic Items'], ['Digit2', '2 - Disenchant (Stores page)'], ['Escape', 'Esc - close']]);
  // offline (the Stores page is not), the press is the maker's, as it always was
  const off = rig({ online: false });
  off.host.press({ station: 'enchant' });
  assert.deepEqual(off.log.flows, ['guildServiceItemMaker']);
  assert.deepEqual(off.host.slot, { maker: 'guildServiceItemMaker' });
});

test('STATION-DOOR: "2 - Disenchant" empties the slot, hands the page its station and opens the Stores page; "1" opens the item maker; Esc nothing (mutants: the slot left full under the door; the focus never handed; the wrong page)', () => {
  let { host, log } = rig();
  host.press({ station: 'enchant' });
  const c = host.slot;
  c.input('Digit2');
  assert.equal(c.done, true);
  assert.deepEqual(log.focus, ['enchant']);
  assert.equal(log.pauses.length, 1);
  assert.equal(log.pauses[0].at, 'stores');
  assert.equal(log.pauses[0].slotWas, null, 'THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD - the pause opens on a free slot');
  assert.deepEqual(host.slot, { pause: true });
  assert.equal(log.flows.length, 0, 'no maker under the page');

  ({ host, log } = rig());
  host.press({ station: 'enchant' });
  host.slot.input('Digit1');
  assert.deepEqual(log.flows, ['guildServiceItemMaker']);
  assert.deepEqual(host.slot, { maker: 'guildServiceItemMaker' });
  assert.deepEqual([log.pauses.length, log.focus.length, log.said.length], [0, 0, 0]);

  ({ host, log } = rig());
  host.press({ station: 'enchant' });
  const esc = host.slot;
  esc.input('Escape');
  assert.equal(esc.done, true);
  assert.deepEqual([log.flows.length, log.pauses.length, log.focus.length], [0, 0, 0]);
});

test('STATION-DOOR: the maker\'s "not ready" is said when the chooser\'s maker could not open - the slot read empty, not the chooser (mutant: the chooser left in the slot)', () => {
  const { host, log } = rig({ makerOpens: false });
  host.press({ station: 'enchant' });
  host.slot.input('Digit1');
  assert.deepEqual(log.said, ['not ready']);
  assert.equal(host.slot, null);
});

test('STATION-DOOR: the alchemy station offers Daggerfall\'s potion maker and the brew; the spellmaking station and the Stores page\'s own stations are as they were; a visitor is still told whose home it is (mutants: the table widened or narrowed)', () => {
  let { host, log } = rig();
  host.press({ station: 'alchemy' });
  assert.deepEqual(host.slot.lines, ['Alchemy station']);
  assert.deepEqual(host.slot.options.map((o) => o.label), ['1 - Make Potions', '2 - Brew (Stores page)', 'Esc - close']);
  host.slot.input('Digit2');
  assert.deepEqual([log.focus, log.pauses.map((p) => p.at)], [['alchemy'], ['stores']]);

  ({ host, log } = rig());
  host.press({ station: 'spells' });
  assert.deepEqual(log.flows, ['guildServiceSpellMaker'], 'the spell maker has no act on the Stores page - straight to it');

  ({ host, log } = rig());
  host.press({ station: 'forge' });
  assert.deepEqual([log.flows.length, log.pauses.map((p) => p.at), log.focus], [0, ['stores'], []], 'a forge opens the page, no chooser');

  ({ host, log } = rig({ owner: false }));
  host.press({ station: 'enchant' });
  assert.deepEqual([log.said, host.slot], [['This is not your home.'], null]);
});

test('STATION-DOOR: the table is the stations with a Daggerfall maker AND an act on the Stores page - every one a station, none the page\'s own; each maker\'s label is Daggerfall\'s service label', () => {
  assert.deepEqual(STORES_ACT_STATIONS, { alchemy: 'Brew', enchant: 'Disenchant' });
  for (const k of Object.keys(STORES_ACT_STATIONS)) {
    assert.ok(DECOR_STATIONS.includes(k), k);
    assert.ok(!PROF_STATIONS.includes(k), k);
    assert.ok(DECOR_STATION_SERVICES[k], `${k} has a maker`);
  }
  assert.equal(Object.isFrozen(STORES_ACT_STATIONS), true);
});

// ─── THE PAGE, LANDED ON ITS STATION ────────────────────────────────

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
function stubPages() {
  resetProfPages();
  const tracks = new Map([['enchanting', { profession: 'enchanting', xp: xpForRank(0), rank: 0, specs: { 50: null, 100: null } }]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: {}, hunt: { hides: 0, high: 0 } }, stale: () => false, refresh: async () => ({ ok: true }),
    held: () => 0, track: (p) => tracks.get(trackOf(p)) ?? { profession: trackOf(p), xp: 0, rank: 0, specs: { 50: null, 100: null } }, pendingWithdrawals: 0, pendingCrafts: 0, choose: async () => ({ ok: true }),
  };
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), purse: () => 1000,
    alchemy: () => null, brew: async () => ({ ok: true, text: '' }), smelt: async () => ({ ok: true, text: '' }),
    enchanter: () => ({ kind: 'home', fee: 0 }), disenchantable: () => [], disenchant: async () => ({ ok: true, text: '' }),
  });
}
const find = (n, id) => (n.id === id ? n : n.children?.reduce((f, c) => f ?? find(c, id), null) ?? null);

test('STATION-DOOR: the Stores page opened from the station scrolls to its section once, after the draw put it in the window; a later visit opens at the top (mutants: never scrolled; scrolled every draw; the wrong section)', (t) => {
  stubPages();
  const frames = [];
  t.mock.method(globalThis, 'requestAnimationFrame', (f) => { frames.push(f); return frames.length; });
  t.mock.method(document, 'getElementById', (id) => find(document.body, id));
  const scrolled = [];
  const draw = () => { const root = el('div'); document.body.append(root); drawStoresPage(root, () => {}, kit); return root; };
  focusStoresStation('enchant');
  let root = draw();
  const head = find(root, 'prof-station-enchant');
  assert.equal(head?.textContent, 'The Enchanting Station');
  assert.ok(find(root, 'prof-station-alchemy'), 'the alchemy station\'s head is named too');
  for (const n of [head, find(root, 'prof-station-alchemy')]) n.scrollIntoView = (o) => scrolled.push([n.id, o]);
  assert.equal(frames.length, 1, 'one landing asked, after the draw');
  frames.shift()();
  assert.deepEqual(scrolled, [['prof-station-enchant', { block: 'start' }]]);
  root.remove();
  root = draw();
  assert.equal(frames.length, 0, 'read once: the next draw lands nowhere');
  root.remove();
  focusStoresStation('alchemy');
  root = draw();
  find(root, 'prof-station-alchemy').scrollIntoView = (o) => scrolled.push(['prof-station-alchemy', o]);
  frames.shift()();
  assert.equal(scrolled.at(-1)[0], 'prof-station-alchemy');
  root.remove();
});

test('STATION-DOOR: the Professions page says where the act is done - the Stores page', () => {
  assert.match(ENCHANTING_HOW(0), /^Enchanting improves as you break crafted pieces down into Arcane Essence at an enchanting station, in a Mages Guild hall or your own home, from the Stores page\./);   // VOICE1 (PIN MOVED): the same law in plain words
  assert.match(ALCHEMY_HOW, /^Brew at an alchemy station \(an Alchemist's or your own home\) from the Stores page/);   // VOICE1 (PIN MOVED): the same law in plain words
});
