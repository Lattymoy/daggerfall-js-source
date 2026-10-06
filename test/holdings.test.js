// HOLDINGS (2026-10-03, Mac: "Lets add a new tab to the pause menu as the stat page is starting to get bloated. Lets
// organize everything appropriately. Under the new tab add a page that allows you to see your currently owned mounts
// ships and carts. You can summon your horse/cart from this page/send away much like the companion system") - THE
// HOLDINGS TAB and THE STABLE (bible/03-World/Holdings.md): the pause window's fourth tab and its rail (ui/enhancedMenu.js
// pauseHoldings), what moved off the Stats rail onto it, the landings; Horse Cart and Cargo's summon answered and its
// new other half, Send away (systems/horseCart.js summonTransport, sendTransportAway, renameHorse, stableView - the
// real runtime over test/hccWorld.mjs); the Stable page's words and acts (ui/holdingsPages.js); the one construction
// seam the two hosts share. The Fleet page is test/fleet.test.js's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld } from './hccWorld.mjs';
import { WAGON_MODE, HORSE_MODE, TRANSPORT, HCC_TEXT } from '../src/systems/horseCartLaw.js';
import {
  drawStablePage, stableWords, stableProviderFor, setHoldingsProvider, stablePageShown, resetHoldingsPages, _setHoldingsIconForTests, farWords,
  STABLE_PAGE_SECTIONS, HORSE_ART, WAGON_ART,
} from '../src/ui/holdingsPages.js';
import { CSA_ITEM_TEMPLATES } from '../src/systems/comeSailAwayItems.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MENU = read('src/ui/enhancedMenu.js');

// ── a fake DOM, the Companions page's (test/revenant_companions.test.js) ─────────────────────────────────────────────
function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, parent: null, title: '', isConnected: true, value: '', type: '', maxLength: 0,
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), contains: (c) => classes.has(c), remove: (...c) => c.forEach((x) => classes.delete(x)) },
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    get firstChild() { return n.children[0] ?? null; },
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (t) => el('h4', 'px-divider', t), meter: (now, max) => el('div', 'px-meter', `${now}/${max}`) };
const buttons = (root, label) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.tag === 'button' && c.textContent === label) out.push(c); walk(c); } }; walk(root); return out; };
const byTag = (root, tag) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.tag === tag) out.push(c); walk(c); } }; walk(root); return out; };
_setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
globalThis.document = undefined;

// ── the tab ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('HOLDINGS the pause window has a fourth tab, Holdings, between Stats and System; a landing may name it (every tab one list - PAUSE_TAB_IDS - the landing and the strip read alike)', () => {
  assert.match(MENU, /const PAUSE_TABS = Object\.freeze\(\[\['quests', 'Quests'\], \['stats', 'Stats'\], \['holdings', 'Holdings'\], \['family', 'Family'\], \['system', 'System'\]\]\);/);   // LEGACY3: the Family tab between Holdings and System
  assert.match(MENU, /export const PAUSE_TAB_IDS = Object\.freeze\(PAUSE_TABS\.map\(\(\[id\]\) => id\)\);/);
  assert.match(MENU, /if \(PAUSE_TAB_IDS\.includes\(at\)\) pauseTab = at;/);
  assert.match(MENU, /\(\{ quests: pauseQuests, stats: pauseStats, holdings: pauseHoldings, family: pauseFamily, system: pauseSystem \}\)\[pauseTab\]\(body\);/);
});

test('HOLDINGS the Stats rail is the character sheet again - its six pages and the Professions online; the Holdings rail takes the Stable, the Fleet, the Companions, the Revenants and the Stores, each while it has a thing to show', () => {
  assert.match(MENU, /const statsSections = \(\) => \[\.\.\.STATS_SECTIONS, \.\.\.\(profPagesShown\(\) \? PROF_STATS_SECTIONS : \[\]\), \.\.\.\(vendorPageShown\(\) \? VENDOR_PAGE_SECTIONS : \[\]\)\];/);   // PIN MOVED (HOME-VENDOR): the Vendor page under the Professions
  assert.match(MENU, /const PROF_STATS_SECTIONS = Object\.freeze\(PROF_PAGE_SECTIONS\.filter\(\(\[id\]\) => id === 'professions'\)\);/);
  assert.match(MENU, /const PROF_HOLD_SECTIONS = Object\.freeze\(PROF_PAGE_SECTIONS\.filter\(\(\[id\]\) => id !== 'professions'\)\);/);
  assert.match(MENU, /const holdingsSections = \(\) => \[\.\.\.\(stablePageShown\(\) \? STABLE_PAGE_SECTIONS : \[\]\), \.\.\.\(fleetPageShown\(\) \? FLEET_PAGE_SECTIONS : \[\]\), \.\.\.\(companionPageShown\(\) \? COMPANION_PAGE_SECTIONS : \[\]\), \.\.\.\(revenantPageShown\(playerEntity\) \? REVENANT_PAGE_SECTIONS : \[\]\), \.\.\.\(profPagesShown\(\) \? PROF_HOLD_SECTIONS : \[\]\)\];/);
  // the Stats page draws none of the moved pages; the Holdings page draws every one, the Fleet's with its door
  const stats = MENU.slice(MENU.indexOf('function pauseStats(body)'), MENU.indexOf('// PX25: THE DOORS THE F5 SHEET CARRIED'));
  for (const gone of ['drawStoresPage', 'drawRevenantsPage', 'drawCompanionsPage']) assert.doesNotMatch(stats, new RegExp(gone), `${gone} left the Stats page`);
  const hold = MENU.slice(MENU.indexOf('function pauseHoldings(body)'), MENU.indexOf('// ── PX7: THE SYSTEM PAGE'));
  for (const page of ['drawStablePage', 'drawFleetPage', 'drawCompanionsPage', 'drawRevenantsPage', 'drawStoresPage']) assert.match(hold, new RegExp(page));
  assert.match(hold, /if \(!secs\.some\(\(\[id\]\) => id === holdSec\)\) holdSec = secs\[0\]\?\.\[0\] \?\? 'stable';/, 'a page gone falls to the first');
  assert.match(hold, /door: \(fn\) => \{ onAction\('handoff'\); if \(fn\(\) === false\) onAction\('resume'\); \}/, 'a door the Fleet opens is the sheet doors\' handoff');
  assert.match(hold, /el\('div', 'px-qdetail px-sys'\)/, 'the system page\'s dress, as the Stats detail wears it');
});

test('HOLDINGS the landings: a Stores press (a home\'s station) lands on the Holdings tab at the Stores, a Professions press on the Stats tab; every visit opens the rail on its first page and forgets the pages\' words', () => {
  const mount = MENU.slice(MENU.indexOf('export function mountEnhancedMenu'));
  assert.match(mount, /if \(PROF_STATS_SECTIONS\.some\(\(\[id\]\) => id === at\)\) \{ pauseTab = 'stats'; statsSec = at; \}\n  else if \(PROF_HOLD_SECTIONS\.some\(\(\[id\]\) => id === at\)\) \{ pauseTab = 'holdings'; holdSec = at; \}/);
  assert.ok(mount.indexOf("holdSec = 'stable';") < mount.indexOf("pauseTab = 'holdings'; holdSec = at;"), 'the reset runs before the landing');
  assert.match(mount, /resetHoldingsPages\(\); resetFleetPage\(\);/);
});

// ── the runtime: summon answered, send away, the name ────────────────────────────────────────────────────────────────

test('HOLDINGS Summon answers its line rather than saying it (the page says it under the cards, the hotkey on the HUD - one body): the pair to the player\'s side; refused indoors, aboard, owning nothing, riding the horse alone', () => {
  const { w, rt, state } = makeWorld();
  assert.deepEqual(rt.summonTransport(), { ok: true, text: HCC_TEXT.summonedBoth });
  assert.equal(state().Mode, WAGON_MODE.Deployed);
  assert.equal(state().HorseMode, HORSE_MODE.HitchedToWagon);
  assert.deepEqual(w.said, [], 'answered, never said');
  rt.handleSummonTransport();
  assert.deepEqual(w.said, [HCC_TEXT.summonedBoth], 'the hotkey says the same body\'s line');
  w.inside = true;
  assert.deepEqual(rt.summonTransport(), { ok: false, text: HCC_TEXT.summonOutdoorsOnly });
  w.inside = false; w.ship = true;
  assert.equal(rt.summonTransport().text, HCC_TEXT.summonOutdoorsOnly);
  const none = makeWorld({ cart: false, horse: false });
  assert.deepEqual(none.rt.summonTransport(), { ok: false, text: HCC_TEXT.doNotOwnHorseOrWagon });
  const horse = makeWorld({ cart: false });
  horse.w.mode = TRANSPORT.Horse;
  assert.deepEqual(horse.rt.summonTransport(), { ok: false, text: HCC_TEXT.alreadyWithYou });
});

test('HOLDINGS Send away: whatever of the pair stands in the world leaves it - the wagon and horse back to the record the persistence\'s turning on makes (both WithPlayer), the presentations torn down; then mounted from the transport window, or summoned again (mutants: the out-check, the dismount refusal, the record)', () => {
  const { w, rt, state, step } = makeWorld();
  rt.summonTransport();
  step(5);
  assert.equal(rt.stableView().out, true);
  const changed = w.changed;
  assert.deepEqual(rt.sendTransportAway(), { ok: true, text: HCC_TEXT.sentBoth });
  assert.equal(state().Mode, WAGON_MODE.WithPlayer);
  assert.equal(state().HorseMode, HORSE_MODE.WithPlayer);
  assert.deepEqual([state().WorldX, state().WorldZ, state().HorseWorldX, state().HorseWorldZ], [0, 0, 0, 0]);
  assert.ok(w.changed > changed, 'the presentation told');
  assert.equal(rt.view().deployed, null, 'the parked wagon\'s presentation gone');
  assert.deepEqual(rt.sendTransportAway(), { ok: false, text: HCC_TEXT.alreadyAway }, 'nothing out: nothing sent');
  // stabled, the transport window mounts the cart from anywhere (the mod's WithPlayer law)
  assert.equal(rt.canUseTransport(TRANSPORT.Cart).allowed, true);
  // summoned again
  assert.equal(rt.summonTransport().ok, true);
  assert.equal(state().Mode, WAGON_MODE.Deployed);
  // a horse left waiting is sent too; riding, nothing is sent
  const h = makeWorld({ cart: false });
  h.rt.summonTransport();
  assert.equal(h.state().HorseMode, HORSE_MODE.LooseStationary);
  h.w.mode = TRANSPORT.Horse;
  assert.deepEqual(h.rt.sendTransportAway(), { ok: false, text: HCC_TEXT.sendAwayDismount });
  h.w.mode = TRANSPORT.Foot;
  assert.deepEqual(h.rt.sendTransportAway(), { ok: true, text: HCC_TEXT.sentHorse });
  assert.equal(h.state().HorseMode, HORSE_MODE.WithPlayer);
  assert.equal(h.state().Mode, WAGON_MODE.None, 'no wagon owned: none');
});

test('HOLDINGS Send away is refused indoors and aboard, owning nothing, and with physical persistence off (nothing stands in the world to send)', () => {
  const { w, rt } = makeWorld();
  rt.summonTransport();
  w.inside = true;
  assert.deepEqual(rt.sendTransportAway(), { ok: false, text: HCC_TEXT.sendAwayOutdoorsOnly });
  w.inside = false; w.ship = true;
  assert.deepEqual(rt.sendTransportAway(), { ok: false, text: HCC_TEXT.sendAwayOutdoorsOnly });
  assert.deepEqual(makeWorld({ cart: false, horse: false }).rt.sendTransportAway(), { ok: false, text: HCC_TEXT.doNotOwnHorseOrWagon });
  const off = makeWorld({ settings: { physicalPersistence: false } });
  off.rt.handleSettingsChanged();
  assert.deepEqual(off.rt.sendTransportAway(), { ok: false, text: HCC_TEXT.notInTheWorld });
});

test('HOLDINGS the horse renamed from the page by the prompt\'s own law (an empty name keeps the old one, the mod\'s length bound); no horse, no name', () => {
  const { rt } = makeWorld();
  assert.equal(rt.renameHorse('  Shadowmere  '), 'Shadowmere');
  assert.equal(rt.horseName, 'Shadowmere');
  assert.equal(rt.renameHorse('   '), 'Shadowmere', 'empty keeps it');
  assert.equal(rt.renameHorse('x'.repeat(60)).length, 31, 'HORSE_NAME_MAX');
  assert.equal(makeWorld({ horse: false }).rt.renameHorse('Nobody'), null);
});

test('HOLDINGS stableView: the pair as the page reads it - owned, its modes, a parked wagon\'s and a waiting horse\'s distance off the player in the scene\'s metres, the load', () => {
  const { w, rt, walk } = makeWorld();
  w.weight = 120;
  rt.summonTransport();
  walk(30, 90);
  const v = rt.stableView();
  assert.deepEqual({ ...v, wagonAt: undefined }, { persistence: true, transport: TRANSPORT.Foot, hasHorse: true, hasCart: true, horseName: '', wagonMode: WAGON_MODE.Deployed, horseMode: HORSE_MODE.HitchedToWagon,
    wagonAt: undefined, horseAt: null, out: true, inside: false, onShip: false, kg: 120, limit: 750 });
  assert.ok(v.wagonAt >= 32 && v.wagonAt <= 33, `the wagon 2.5 m behind where it was summoned, 30 m walked: ${v.wagonAt}`);
});

// ── the page ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('HOLDINGS the Stable\'s words: each state of the pair a chip and a line - ridden, in harness, following, waiting how far, hitched to the parked wagon, parked, stabled; the classic transport\'s with the mod off or the persistence off; none owned none drawn', () => {
  const view = (o) => ({ persistence: true, transport: TRANSPORT.Foot, hasHorse: true, hasCart: true, horseName: '', wagonMode: WAGON_MODE.WithPlayer, horseMode: HORSE_MODE.WithPlayer, wagonAt: null, horseAt: null, out: false, kg: 0, limit: 750, ...o });
  const at = (o) => stableWords({ hcc: true, hasHorse: true, hasCart: true, view: view(o) });
  assert.deepEqual([at({ transport: TRANSPORT.Horse }).horse.state, at({ transport: TRANSPORT.Cart }).horse.state, at({ transport: TRANSPORT.Cart }).wagon.state], ['Riding', 'In harness', 'Driving']);
  const team = at({ wagonMode: WAGON_MODE.FollowingPlayer, horseMode: HORSE_MODE.HitchedToWagon });
  assert.deepEqual([team.horse.state, team.wagon.state], ['Following', 'Following']);
  assert.deepEqual(at({ horseMode: HORSE_MODE.LooseStationary, horseAt: 42 }).horse, { state: 'Waiting', tone: 'is-away', line: 'Waiting where you left it, 42 m away.' });
  assert.equal(at({ wagonMode: WAGON_MODE.Deployed, horseMode: HORSE_MODE.HitchedToWagon, wagonAt: 1500 }).horse.line, 'Hitched to your parked wagon, 1.5 km away.');
  assert.equal(at({ wagonMode: WAGON_MODE.Deployed, wagonAt: null }).wagon.line, 'Parked away from here.');
  assert.deepEqual([at({}).horse.state, at({}).wagon.state], ['Stabled', 'Stabled']);
  assert.equal(stableWords({ hcc: false, hasHorse: true, hasCart: false }).horse.state, 'With you');
  assert.equal(stableWords({ hcc: false, hasHorse: true, hasCart: false }).wagon, null);
  assert.equal(stableWords({ hcc: true, hasHorse: false, hasCart: true, view: view({ persistence: false, hasHorse: false }) }).wagon.state, 'With you');
  assert.equal(farWords(999), '999 m away');
  assert.equal(farWords(1000), '1.0 km away');
});

test('HOLDINGS the Stable page over the real runtime through the hosts\' one seam (stableProviderFor): its two cards with their pictures (the items\' own art), the load\'s meter, Summon and its word under the cards, Send away once out, the horse renamed in place', () => {
  const { rt, state } = makeWorld();
  let on = true;
  setHoldingsProvider(stableProviderFor({ runtime: rt, on: () => on, hasHorse: () => true, hasCart: () => true }));
  assert.equal(stablePageShown(), true);
  assert.deepEqual(STABLE_PAGE_SECTIONS, [['stable', 'Stable']]);
  resetHoldingsPages();
  let re = 0;
  const draw = () => { const d = el('div', 'px-qdetail'); drawStablePage(d, () => { re++; }, kit); return d; };
  let d = draw();
  assert.match(d.textContent, /Your horse.*Stabled/);
  assert.match(d.textContent, /Your wagon.*Stabled/);
  assert.match(d.textContent, /0\/750/, 'the load against the wagon\'s limit');
  assert.equal(buttons(d, 'Send away').length, 0, 'nothing out to send');
  buttons(d, 'Summon')[0].onclick();
  assert.equal(state().Mode, WAGON_MODE.Deployed);
  d = draw();
  assert.match(d.textContent, new RegExp(HCC_TEXT.summonedBoth.replace('.', '\\.')));
  buttons(d, 'Send away')[0].onclick();
  d = draw();
  assert.match(d.textContent, /go back to the stable/);
  assert.equal(state().Mode, WAGON_MODE.WithPlayer);
  // the name, in place
  buttons(d, 'Rename horse')[0].onclick();
  d = draw();
  const field = byTag(d, 'input')[0];
  assert.equal(field.maxLength, 31);
  field.value = 'Bucephalus'; field.oninput();
  buttons(d, 'Name')[0].onclick();
  d = draw();
  assert.match(d.textContent, /Bucephalus/);
  assert.match(d.textContent, /Your horse is called Bucephalus\./);
  // the mod off: the classic transport's words, no acts
  on = false;
  d = draw();
  assert.match(d.textContent, /With you/);
  assert.equal(buttons(d, 'Summon').length, 0);
  assert.match(d.textContent, /Turn on Horse Cart and Cargo/);
  // nothing owned
  setHoldingsProvider(stableProviderFor({ runtime: rt, on: () => true, hasHorse: () => false, hasCart: () => false }));
  const none = makeWorld({ horse: false, cart: false });
  setHoldingsProvider(stableProviderFor({ runtime: none.rt, on: () => true, hasHorse: () => false, hasCart: () => false }));
  d = draw();
  assert.match(d.textContent, /You own no horse and no wagon\. A general store sells both/);
  setHoldingsProvider(null);
  assert.equal(stablePageShown(), false);
});

test('HOLDINGS the pictures are the two items\' own (DFU\'s Horse 94 and Small Cart 93 inventory art); THE ONE CONSTRUCTION SEAM - both hosts that stand Horse Cart and Cargo build the Stable\'s provider through stableProviderFor, never their own', () => {
  const T = JSON.parse(read('src/characters/itemTemplates.json'));
  const row = (i) => T.find((t) => t.index === i);
  assert.deepEqual([row(94).playerTextureArchive, row(94).playerTextureRecord], [HORSE_ART.archive, HORSE_ART.record]);
  assert.deepEqual([row(93).playerTextureArchive, row(93).playerTextureRecord], [WAGON_ART.archive, WAGON_ART.record]);
  assert.ok(CSA_ITEM_TEMPLATES.length === 2);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(host);
    assert.match(s, /setHoldingsProvider\(\{\n    \.\.\.stableProviderFor\(\{ runtime: hccRuntime, on: hccOn,/, `${host} through the one seam`);
    assert.doesNotMatch(s, /summonTransport\(\)|sendTransportAway\(\)/, `${host} never calls the acts itself`);
  }
  // the FOUR HOSTS: the interiors and the dungeon stand no runtime of their own - the world host's provider answers
  // over them, and a summon or a send away there is refused by the runtime's own indoor law (pinned above)
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(read(host), /setHoldingsProvider/);
});
