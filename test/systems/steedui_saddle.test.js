// STEED-UI (2026-10-11, the owner: "Proper UI elements for the horse + wagon/cart (Enhanced plus)") - THE SADDLE PANEL
// (bible/10-UI/Controls.md, THE SADDLE PANEL): the horse ridden and the wagon driven on screen in Enhanced Plus, the
// helm panel's kind (ui/enhanced/enhancedHelm.js). The panel's pure reads (ui/enhanced/enhancedSaddle.js - its gait, its meters, its
// buttons, its line), the panel on a page, the upkeep's read (systems/upkeep/upkeepRuntime.js saddle), the hosts' one glue
// (scenes/saddleHost.js), Horse Cart and Cargo's Cargo door (systems/horse/horseCart.js openWagonCargo), the view's own word
// (player/mwView.js mwViewCanTogglePerspective), the Plus kit's dress, and the four hosts.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HORSE_CARE_HARD as HARD, WAGON_UPKEEP_HARD as WHARD } from '../../src/systems/upkeep/upkeepTiers.js';   // HORSE-TIERS / WAGON-TIERS (PIN MOVED): the upkeep is handed each tier's rules - these pins pin the system as it stood, Hard
import { readFileSync } from 'node:fs';
import {
  saddleGait, saddleSpeedText, saddleTitle, saddleMeters, saddleButtons, saddleHint, fedText, drawEnhancedSaddle, hideEnhancedSaddle,
  enhancedSaddleMounted, enhancedSaddleBar, ENHANCED_SADDLE_ID, SADDLE_ACTIONS, STANDING_MPS, SADDLE_BREATH_LOW, SADDLE_CSS,
} from '../../src/ui/enhanced/enhancedSaddle.js';
import { createSaddleHost, SADDLE_SPEED_TAU, SADDLE_MODES } from '../../src/scenes/saddleHost.js';
import { createUpkeep, BREATH_LOW } from '../../src/systems/upkeep/upkeepRuntime.js';
import { OATS_TEMPLATE, APPLE_TEMPLATES, BOND_TIERS, FULL_AHEAD } from '../../src/systems/steedCare.js';
import { UPKEEP_ITEM } from '../../src/systems/upkeep/upkeepItemRows.js';
import { newWagonItem } from '../../src/systems/wagon/wagonKinds.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { HCC_MOUNT_ACTION } from '../../src/systems/horse/horseCart.js';
import { FRAME_ROLES } from '../../src/ui/enhanced/enhancedFrame.js';
import { SMALL_WINDOWS } from '../../src/ui/grimoireDress.js';
import { makeWorld } from '../hccWorld.mjs';
import { fakeDoc, all, one } from '../decorFakes.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const horse = (seed, extra = {}) => ({ group: 'Transportation', templateIndex: 94, horseSeed: seed, ...extra });
const oats = (n = 1) => ({ group: 'UselessItems2', templateIndex: OATS_TEMPLATE, ...(n > 1 ? { stackCount: n } : {}) });
const apple = (n = 1) => ({ group: 'UselessItems2', templateIndex: APPLE_TEMPLATES[0], ...(n > 1 ? { stackCount: n } : {}) });
const kit = (n = 1) => ({ group: 'UselessItems2', templateIndex: UPKEEP_ITEM.WagonKit, ...(n > 1 ? { stackCount: n } : {}) });
const wagon = (kind = 'cart', condition = null) => { const w = mintCondition(setItemFields(newWagonItem(kind))); if (condition != null) w.currentCondition = condition; return w; };
const T0 = 2_000_000;

/** A saddle's read as the host hands it the panel (saddleHost.js read). */
const S = (o = {}) => ({
  mode: 'Horse', name: 'Shadow', wagonName: '', speed: 0, galloping: false,
  horse: { breath: 1, winded: false, hunger: 'Fed', hungerKey: 'fed', fedHours: 14, full: false, tier: 'Familiar', bond: 45, tierAt: 35, next: { name: 'Trusting', at: 55 } },
  wagon: null, oats: 3, apples: 0, kits: 0, load: null, near: true, wagonNear: true, cargo: null, view: false, hcc: true, ...o,
});

test('STEED-UI the gait and the pace: standing under STANDING_MPS, galloping on the run, else a horse trots and a wagon rolls; the pace in whole km/h (mutants: STEEDUI-gait-standing, STEEDUI-gait-cart-gallops, STEEDUI-kmh)', () => {
  assert.equal(STANDING_MPS, 0.3);
  assert.deepEqual([saddleGait('Horse', 0), saddleGait('Horse', 0.29), saddleGait('Horse', null), saddleGait('Horse', NaN)], ['Standing', 'Standing', 'Standing', 'Standing']);
  assert.deepEqual([saddleGait('Horse', 5), saddleGait('Horse', 5, true), saddleGait('Cart', 5), saddleGait('Cart', 5, true)], ['Trotting', 'Galloping', 'Rolling', 'Rolling'], 'a team in harness never gallops');
  assert.equal(saddleGait('Horse', 0.1, true), 'Standing', 'a run held still stands');
  assert.deepEqual([saddleSpeedText(10), saddleSpeedText(0), saddleSpeedText(-2), saddleSpeedText(null)], ['36 km/h', '0 km/h', '0 km/h', '']);
  assert.deepEqual([saddleTitle(S()), saddleTitle(S({ name: '' })), saddleTitle(S({ mode: 'Cart', wagonName: 'Caravan' })), saddleTitle(S({ mode: 'Cart' }))],
    ['Riding Shadow', 'Riding', 'Driving the Caravan', 'Driving the wagon']);
  assert.deepEqual([fedText(14.9), fedText(2), fedText(1.5), fedText(0.001)], ['14h', '2h', '90m', '1m']);
});

test('STEED-UI the meters: the breath a bar while ridden (Winded in words, short under a quarter, winded or starving), the hunger a chip in its tone with its hours, the bond a bar to the next word (whole at Kindred), the wagon its state and share, the load its kilos (mutants: STEEDUI-breath-low, STEEDUI-bond-share, STEEDUI-load-over)', () => {
  assert.equal(SADDLE_BREATH_LOW, BREATH_LOW, 'the HUD bar\'s own short');
  const keys = (s) => saddleMeters(s).map((m) => m.key);
  const by = (s, k) => saddleMeters(s).find((m) => m.key === k);
  assert.deepEqual(keys(S()), ['breath', 'hunger', 'bond']);
  assert.deepEqual(by(S(), 'breath'), { key: 'breath', label: 'Breath', share: 1, text: '100%', tone: 'ok' });
  assert.deepEqual([by(S({ horse: { ...S().horse, breath: 0.2 } }), 'breath').tone, by(S({ horse: { ...S().horse, breath: 0.25 } }), 'breath').tone], ['low', 'ok']);
  assert.deepEqual(by(S({ horse: { ...S().horse, breath: 0, winded: true } }), 'breath'), { key: 'breath', label: 'Breath', share: 0, text: 'Winded', tone: 'low' });
  assert.equal(by(S({ horse: { ...S().horse, hungerKey: 'starving', hunger: 'Starving' } }), 'breath').tone, 'low', 'a starving horse reads short');
  assert.deepEqual(by(S(), 'hunger'), { key: 'hunger', label: 'Hunger', text: 'Fed 14h', tone: 'ok' });
  assert.deepEqual(by(S({ horse: { ...S().horse, hungerKey: 'hungry', hunger: 'Hungry', fedHours: 0 } }), 'hunger'), { key: 'hunger', label: 'Hunger', text: 'Hungry', tone: 'warn' });
  assert.deepEqual(by(S({ horse: { ...S().horse, hungerKey: 'starving', hunger: 'Starving', fedHours: 0 } }), 'hunger').tone, 'low');
  assert.equal(by(S({ horse: { ...S().horse, fedHours: 0 } }), 'hunger').text, 'Fed', 'a horse never seen fed: no hours to say');
  const bond = by(S(), 'bond');
  assert.equal(bond.share, 0.5, 'halfway from Familiar (35) to Trusting (55)');
  assert.deepEqual([bond.text, bond.tone, bond.title], ['Familiar', 'bond', '45 of 55 to Trusting']);
  assert.deepEqual(by(S({ horse: { ...S().horse, bond: 99, tier: 'Kindred', tierAt: 95, next: null } }), 'bond'), { key: 'bond', label: 'Bond', share: 1, text: 'Kindred', tone: 'bond', title: 'Kindred: the bond is complete' });
  // a team in harness: no breath (it never gallops)
  assert.deepEqual(keys(S({ mode: 'Cart', horse: { ...S().horse, breath: null } })), ['hunger', 'bond']);
  // the wagon and its load
  const cart = S({ mode: 'Cart', horse: null, wagon: { name: 'Caravan', state: 'Rickety', stateKey: 'rickety', share: 0.2, kitWorks: true }, load: { kg: 300, limit: 400 } });
  assert.deepEqual(keys(cart), ['wagon', 'load']);
  assert.deepEqual(by(cart, 'wagon'), { key: 'wagon', label: 'Caravan', share: 0.2, text: 'Rickety 20%', tone: 'warn' });
  assert.deepEqual(by({ ...cart, wagon: { ...cart.wagon, state: 'Failing', stateKey: 'failing', share: 0 } }, 'wagon'), { key: 'wagon', label: 'Caravan', share: 0, text: 'Failing 0%', tone: 'low' }, 'WAGON-MEND: at its worst, Failing - no Broken');
  assert.deepEqual(by({ ...cart, wagon: { ...cart.wagon, state: 'Sound', stateKey: 'sound', share: 0.9 } }, 'wagon').tone, 'ok');
  assert.deepEqual(by(cart, 'load'), { key: 'load', label: 'Load', share: 0.75, text: '300/400 kg', tone: 'ok' });
  assert.deepEqual([by({ ...cart, load: { kg: 380, limit: 400 } }, 'load').tone, by({ ...cart, load: { kg: 500, limit: 400 } }, 'load').tone, by({ ...cart, load: { kg: 500, limit: 400 } }, 'load').share], ['warn', 'low', 1]);
  assert.deepEqual(keys({ ...cart, load: { kg: 0, limit: 0 } }), ['wagon'], 'no limit, no load');
  assert.deepEqual(saddleMeters(null), []);
});

test('STEED-UI the buttons: feed and the apple (the apple only with apples), dark with a reason when full, away or out of oats; the kit only where it would mend, dark without a kit or the wagon\'s reach; Cargo where a wagon can be opened; the Stable; the view where it turns; getting down, its key Horse Cart and Cargo\'s mount (mutants: STEEDUI-feed-full, STEEDUI-kit-shown, STEEDUI-mount-key)', () => {
  assert.equal(SADDLE_ACTIONS.mount, HCC_MOUNT_ACTION, 'one home for the mount\'s name');
  const acts = (s) => saddleButtons(s).map((b) => b.act);
  const by = (s, a) => saddleButtons(s).find((b) => b.act === a);
  assert.deepEqual(acts(S()), ['feed', 'stable', 'dismount']);
  assert.deepEqual(by(S(), 'feed'), { act: 'feed', label: 'Feed oats (3)', disabled: false, why: '' });
  assert.deepEqual(by(S({ oats: 0 }), 'feed'), { act: 'feed', label: 'Feed oats (0)', disabled: true, why: 'No oats. Stables sell them' });
  assert.deepEqual(by(S({ horse: { ...S().horse, full: true } }), 'feed'), { act: 'feed', label: 'Feed oats (3)', disabled: true, why: 'Full. It will not eat yet' });
  assert.equal(by(S({ near: false }), 'feed').why, 'Your horse is not here');
  assert.deepEqual(acts(S({ apples: 2 })), ['feed', 'treat', 'stable', 'dismount']);
  assert.deepEqual(by(S({ apples: 2 }), 'treat'), { act: 'treat', label: 'Apple (2)', disabled: false, why: '' });
  assert.equal(by(S({ apples: 2, horse: { ...S().horse, full: true } }), 'treat').disabled, true);
  assert.deepEqual(acts(S({ horse: null })), ['stable', 'dismount'], 'horse care off: nothing to feed');
  assert.deepEqual(by(S(), 'dismount'), { act: 'dismount', label: 'Dismount', action: 'HorseMount' });
  assert.deepEqual(by(S({ hcc: false }), 'dismount').action, null, 'the classic transport has no mount key');
  assert.deepEqual(acts(S({ view: true })), ['feed', 'stable', 'view', 'dismount']);
  assert.equal(by(S({ view: true }), 'view').action, 'TogglePerspective');
  // the bench
  const W = { name: 'Small Cart', state: 'Worn', stateKey: 'worn', share: 0.4, kitWorks: true };
  const cart = S({ mode: 'Cart', wagon: W, kits: 1, cargo: true });
  assert.deepEqual(acts(cart), ['feed', 'kit', 'cargo', 'stable', 'dismount']);
  assert.deepEqual(by(cart, 'dismount').label, 'Climb down');
  assert.deepEqual(by(cart, 'kit'), { act: 'kit', label: 'Repair kit (1)', disabled: false, why: '' });
  assert.deepEqual(by({ ...cart, kits: 0 }, 'kit'), { act: 'kit', label: 'Repair kit (0)', disabled: true, why: 'No repair kit. Wagon Yards sell them' });
  assert.equal(by({ ...cart, wagonNear: false }, 'kit').why, 'The wagon is out of reach');
  assert.deepEqual(acts({ ...cart, wagon: { ...W, share: 0.7, kitWorks: false } }), ['feed', 'cargo', 'stable', 'dismount'], 'past the kit\'s ceiling: no kit');
  assert.deepEqual(by({ ...cart, cargo: false }, 'cargo'), { act: 'cargo', label: 'Cargo', disabled: true, why: 'The wagon is out of reach' });
  assert.deepEqual(acts({ ...cart, cargo: null }), ['feed', 'kit', 'stable', 'dismount'], 'Horse Cart and Cargo off: no Cargo');
  assert.deepEqual(saddleButtons(null), []);
});

test('STEED-UI the line under the title: what the horse needs first - winded, starving, a wagon failing; else the gallop\'s key while ridden and how to free the mouse; a finger reads the meters (mutants: STEEDUI-hint-order)', () => {
  const keyOf = (a) => ({ Run: 'LEFTSHIFT' })[a] ?? '';
  assert.equal(saddleHint(S(), { keyOf, mouseFree: false, freeKey: 'Y' }), 'Gallop: hold LEFTSHIFT · Free the mouse (Y) to use these');
  assert.equal(saddleHint(S(), { keyOf, mouseFree: true }), 'Gallop: hold LEFTSHIFT');
  assert.equal(saddleHint(S(), { keyOf: () => '', mouseFree: true }), '', 'no key bound: none named');
  assert.equal(saddleHint(S({ mode: 'Cart' }), { keyOf, mouseFree: true }), '', 'a bench gallops nowhere');
  assert.equal(saddleHint(S(), { touch: true, keyOf }), '');
  assert.equal(saddleHint(S({ horse: { ...S().horse, winded: true, hungerKey: 'starving' } }), { touch: true }), 'Winded. Ease off and let it breathe', 'winded first, under a finger too');
  assert.equal(saddleHint(S({ horse: { ...S().horse, hungerKey: 'starving' } }), {}), 'Starving. It will not gallop until it eats');
  assert.equal(saddleHint(S({ mode: 'Cart', horse: { ...S().horse, hungerKey: 'starving' } }), {}), 'Starving. Feed your horse');
  assert.equal(saddleHint(S({ mode: 'Cart', wagon: { name: 'Open Wagon', stateKey: 'failing' } }), { mouseFree: true }), 'The open wagon is failing. Mend it to restore its pace');
});

test('STEED-UI the panel on a page (UI-CALM: as the Always choice stands it): mounted over the vitals, titled, its gait and pace, its meters and buttons; a key hint on a button with a key (none on a finger); a click answers its hook, a dark one nothing; covered it hides, uncovered it stands again updated in place - made again only when its set changes; nothing to read, it goes (mutants: STEEDUI-covered, STEEDUI-rebuilt-every-frame, STEEDUI-dark-presses)', () => {
  const doc = fakeDoc();
  const calls = [];
  const hooks = Object.fromEntries(['feed', 'treat', 'kit', 'cargo', 'stable', 'view', 'dismount'].map((a) => [a, () => calls.push(a)]));
  const keyOf = (a) => ({ HorseMount: 'H', TogglePerspective: 'MOUSE4', Run: 'LEFTSHIFT' })[a] ?? '';
  try {
    const root = drawEnhancedSaddle({ panel: 'always', saddle: S({ speed: 10, galloping: true, view: true }), keyOf, mouseFree: false, freeKey: 'Y' }, hooks, { doc });
    assert.ok(root && root.id === ENHANCED_SADDLE_ID && doc.body.children.includes(root) && enhancedSaddleMounted());
    assert.ok(doc.head.children.some((c) => c.id === 'enhanced-saddle-style' && c.textContent === SADDLE_CSS), 'its sheet, once');
    assert.equal(enhancedSaddleBar(), one(root, 'saddlepanel-bar'));
    assert.equal(one(root, 'saddlepanel-name').textContent, 'Riding Shadow');
    assert.equal(one(root, 'saddlepanel-gait').textContent, 'Galloping · 36 km/h');
    assert.equal(one(root, 'saddlepanel-hint').textContent, 'Gallop: hold LEFTSHIFT · Free the mouse (Y) to use these');
    const meter = (k) => all(root, 'saddlepanel-meter').find((m) => m.dataset.key === k);
    assert.deepEqual(all(root, 'saddlepanel-meter').map((m) => m.dataset.key), ['breath', 'hunger', 'bond']);
    assert.equal(one(meter('breath'), 'saddlepanel-fill').style.width, '100.0%');
    assert.equal(one(meter('hunger'), 'saddlepanel-fill'), undefined, 'a chip has no bar');
    assert.equal(one(meter('hunger'), 'saddlepanel-mtext').textContent, 'Fed 14h');
    assert.equal(meter('bond').getAttribute('title'), '45 of 55 to Trusting');
    const btn = (a) => all(root, 'saddlepanel-btn').find((b) => b.dataset.act === a);
    assert.deepEqual(all(root, 'saddlepanel-btn').map((b) => b.dataset.act), ['feed', 'stable', 'view', 'dismount']);
    assert.deepEqual([one(btn('dismount'), 'saddlepanel-key').textContent, one(btn('view'), 'saddlepanel-key').textContent, one(btn('feed'), 'saddlepanel-key').textContent], ['H', 'MOUSE4', '']);
    btn('feed').fire('click'); btn('stable').fire('click'); btn('view').fire('click'); btn('dismount').fire('click');
    assert.deepEqual(calls, ['feed', 'stable', 'view', 'dismount']);
    // the frame after: the breath spent, the feed dark (full) - updated in place, the same nodes
    const feedNode = btn('feed'), breathNode = meter('breath');
    drawEnhancedSaddle({ panel: 'always', saddle: S({ speed: 0, view: true, horse: { ...S().horse, breath: 0.1, winded: true, full: true } }), keyOf, mouseFree: true }, hooks, { doc });
    assert.equal(btn('feed'), feedNode, 'not rebuilt');
    assert.equal(meter('breath'), breathNode, 'not rebuilt');
    assert.equal(one(meter('breath'), 'saddlepanel-fill').style.width, '10.0%');
    assert.equal(one(meter('breath'), 'saddlepanel-mtext').textContent, 'Winded');
    assert.match(meter('breath').className, /\blow\b/);
    assert.equal(one(root, 'saddlepanel-hint').className, 'saddlepanel-hint warn');
    assert.equal(one(root, 'saddlepanel-gait').textContent, 'Standing · 0 km/h');
    assert.equal(btn('feed').disabled, true);
    assert.equal(btn('feed').getAttribute('title'), 'Full. It will not eat yet');
    btn('feed').fire('click');
    assert.equal(calls.length, 4, 'a dark button answers nothing');
    // a window over the HUD
    drawEnhancedSaddle({ panel: 'always', saddle: S(), covered: true, keyOf }, hooks, { doc });
    assert.equal(root.style.display, 'none');
    assert.equal(enhancedSaddleBar(), null);
    drawEnhancedSaddle({ panel: 'always', saddle: S({ apples: 1 }), keyOf, touch: true }, hooks, { doc });
    assert.equal(root.style.display, '');
    assert.notEqual(btn('feed'), feedNode, 'a new set (the apple, the view gone): made again');
    assert.deepEqual(all(root, 'saddlepanel-btn').map((b) => b.dataset.act), ['feed', 'treat', 'stable', 'dismount']);
    assert.equal(one(btn('dismount'), 'saddlepanel-key').textContent, '', 'a finger: no key hints');
    assert.equal(root.className, 'saddlepanel touch');
    // nothing to read: gone
    assert.equal(drawEnhancedSaddle({ saddle: null }, hooks, { doc }), null);
    assert.ok(root.removed && !enhancedSaddleMounted());
  } finally { hideEnhancedSaddle(); }
});

test('STEED-UI the upkeep\'s read: the ridden horse - its breath while ridden (none on a bench), its hunger with its hours, its bond and the next word; the wagon\'s card; the oats, apples and kits of the pack and the wagon\'s load; each half null with its switch off (mutants: STEEDUI-read-breath-bench, STEEDUI-read-next, STEEDUI-team-lead-only)', () => {
  let t = T0;
  const h = horse(321, { horseFed: T0 + 10 * 60, horseBond: 450 });
  const w = wagon('caravan', 600);
  const items = [h, w, oats(2), apple(1), kit(1)];
  const store = [oats(3), kit(2)];
  const sw = { horse: true, wagon: true };
  const up = createUpkeep({ items: () => items, now: () => t, horseCare: () => (sw.horse ? HARD : null), wagonUpkeep: () => (sw.wagon ? WHARD : null), stores: () => store });
  const r = up.saddle('Horse');
  assert.equal(r.horse.breath, 1);
  assert.equal(r.horse.winded, false);
  assert.deepEqual([r.horse.hunger, r.horse.hungerKey, r.horse.fedHours, r.horse.full], ['Fed', 'fed', 10, false]);
  assert.deepEqual([r.horse.tier, r.horse.bond, r.horse.tierAt, r.horse.next], ['Familiar', 45, 35, { name: 'Trusting', at: 55 }]);
  assert.deepEqual([r.oats, r.apples, r.kits], [5, 1, 3], 'the pack\'s and the wagon\'s load');
  assert.deepEqual([r.wagon.name, r.wagon.stateKey, r.wagon.kitWorks], ['Caravan', 'worn', true]);
  assert.equal(up.saddle('Cart').horse.breath, null, 'a team in harness: no breath to show');
  assert.equal(up.saddle('Cart').horse.winded, false);
  h.horseFed = T0 + FULL_AHEAD;
  assert.equal(up.saddle('Horse').horse.full, true);
  h.horseBond = 1000;
  assert.deepEqual([up.saddle('Horse').horse.tier, up.saddle('Horse').horse.next, up.saddle('Horse').horse.tierAt], ['Kindred', null, BOND_TIERS.at(-1).min]);
  t = T0 + FULL_AHEAD + 60;
  assert.deepEqual([up.saddle('Horse').horse.hungerKey, up.saddle('Horse').horse.fedHours], ['hungry', 0]);
  // on a bench, the team's hungriest horse is the one shown hungry and fed - the bond stays the lead's
  const lead = horse(41, { horseFed: T0 + 600, horseBond: 300 }), second = horse(42, { horseFed: T0 - 60 }), spare = horse(43, { horseFed: T0 - 5000 });
  const teamPack = [lead, second, spare, wagon('openWagon')];
  const tu = createUpkeep({ items: () => teamPack, now: () => T0, horseCare: () => HARD, wagonUpkeep: () => WHARD });
  const bench = tu.saddle('Cart').horse;
  assert.deepEqual([bench.hungerKey, bench.feed, bench.team, bench.tier], ['hungry', 1, 2, 'Accepting'], 'the second of the Open Wagon\'s two - the spare is in no harness');
  assert.deepEqual([tu.saddle('Horse').horse.hungerKey, tu.saddle('Horse').horse.feed, tu.saddle('Horse').horse.team], ['fed', 0, 1], 'astride: the one ridden');
  assert.equal(saddleMeters({ mode: 'Cart', horse: { ...bench, breath: null } })[0].label, 'Team');
  sw.horse = false;
  assert.equal(up.saddle('Horse').horse, null);
  sw.wagon = false;
  assert.equal(up.saddle('Cart').wagon, null);
  assert.equal(up.saddle('Cart').oats, 5, 'the supplies are counted either way');
});

test('STEED-UI the hosts\' one glue: the read off the upkeep and Horse Cart and Cargo (the name, the wagon\'s kind and load, its reach, Cargo), the pace smoothed off the odometer\'s metres, the gallop; each button its door - the feed and the kit through the upkeep\'s act with the horse under its rider, Cargo the runtime\'s, getting down the mount key\'s or the classic foot; out of the saddle it goes (mutants: STEEDUI-host-near, STEEDUI-host-foot, STEEDUI-host-speed, STEEDUI-host-feed-lead)', () => {
  assert.deepEqual(SADDLE_MODES, ['Horse', 'Cart']);
  const acts = [], said = [], log = [];
  const upkeep = {
    saddle: (mode) => ({ horse: { breath: mode === 'Horse' ? 1 : null, winded: false, hunger: 'Fed', hungerKey: 'fed', fedHours: 5, full: false, tier: 'Wary', bond: 0, tierAt: 0, next: { name: 'Accepting', at: 15 } }, wagon: { name: 'Small Cart', state: 'Worn', stateKey: 'worn', share: 0.5, kitWorks: true }, oats: 1, apples: 0, kits: 1 }),
    act: (verb, arg, o) => { acts.push([verb, arg, o.near, o.stabled, o.wagonNear, typeof o.pass]); return { ok: true, text: `did ${verb}` }; },
  };
  let rt = {
    hasHorseName: true, horseName: 'Shadow', stableView: () => ({ persistence: true, hasHorse: true, transport: 'Horse' }),
    canMountHorseFromTransportWindow: () => false, canAccessWagonInventory: () => ({ allowed: true }),
    openWagonCargo: () => log.push('cargo'), handleQuickMountOrDismount: () => log.push('mount-key'),
  };
  const items = [wagon('cart')];
  const host = createSaddleHost({
    upkeep, runtime: () => rt, items: () => items, wagonKg: () => 120, wagonLimit: () => 400,
    say: (l) => said.push(l), pass: () => {}, openStable: () => log.push('stable'), canView: () => true, toggleView: () => log.push('view'), foot: () => log.push('foot'),
  });
  const horseRead = host.read('Horse');
  assert.deepEqual([horseRead.mode, horseRead.name, horseRead.wagon, horseRead.load, horseRead.cargo, horseRead.view, horseRead.hcc, horseRead.near], ['Horse', 'Shadow', null, null, null, true, true, true], 'astride: no wagon, no load, no Cargo');
  const cartRead = host.read('Cart');
  assert.deepEqual([cartRead.wagonName, cartRead.wagon.stateKey, cartRead.load, cartRead.cargo, cartRead.wagonNear], ['Small Cart', 'worn', { kg: 120, limit: 400 }, true, true]);
  assert.equal(host.read('Foot'), null);
  // the pace: smoothed toward metres / dt over SADDLE_SPEED_TAU; a pause holds it
  assert.equal(SADDLE_SPEED_TAU, 0.35);
  host.motion(0.35, 3.5, true);
  assert.equal(host.speed, 10, 'one tau: there');
  host.motion(0.035, 0, false);
  assert.ok(Math.abs(host.speed - 9) < 1e-9, 'a tenth of the way toward standing');
  host.motion(0, 50, false);
  assert.ok(Math.abs(host.speed - 9) < 1e-9, 'a paused frame moves nothing');
  host.motion(0.1, 1, true);
  assert.equal(host.read('Horse').galloping, true);
  assert.equal(host.read('Cart').galloping, false);
  // the doors
  host.hooks.feed(); host.hooks.kit();
  assert.deepEqual(acts, [['feed', 0, true, false, true, 'function'], ['kit', 0, true, false, true, 'function']], 'the horse is under its rider: near, never stabled');
  const feedTo = upkeep.saddle;
  upkeep.saddle = (mode) => ({ ...feedTo(mode), horse: { ...feedTo(mode).horse, feed: 1, team: 2 } });
  host.frame({ show: true, mode: 'Cart' });   // (no page: the read stands, nothing is drawn)
  host.hooks.feed(); host.hooks.treat();
  assert.deepEqual(acts.slice(-2).map((x) => x.slice(0, 2)), [['feed', 1], ['treat', 1]], 'the feed and the apple to the horse the panel shows hungry');
  upkeep.saddle = feedTo;
  acts.length = 0;
  assert.deepEqual(said, ['did feed', 'did kit', 'did feed', 'did treat']);
  host.hooks.cargo(); host.hooks.stable(); host.hooks.view(); host.hooks.dismount();
  assert.deepEqual(log, ['cargo', 'stable', 'view', 'mount-key']);
  rt = null;
  host.hooks.dismount();
  assert.equal(log.at(-1), 'foot', 'the mod off: the classic foot');
  assert.deepEqual([host.read('Cart').cargo, host.read('Cart').hcc, host.read('Horse').name], [null, false, '']);
  // the frame: shown off the page (no document) answers null; out of the saddle it hides
  assert.equal(host.frame({ show: false, mode: 'Horse' }), null);
  assert.equal(host.speed, 0, 'out of the saddle the pace is forgotten');
});

test('STEED-UI Cargo, Horse Cart and Cargo\'s door: the wagon\'s load opened as a press on the wagon opens it (pre-selected) where CanAccessWagonInventory allows; refused in the mod\'s own words, nothing opened (mutants: STEEDUI-cargo-unguarded)', () => {
  const a = makeWorld();
  a.step(3);
  assert.equal(a.rt.openWagonCargo(), true);
  assert.equal(a.w.openedInv, 1);
  assert.equal(a.rt.consumeWagonSelectionRequest(), true, 'the wagon selected on the open');
  const b = makeWorld();
  b.step(3); b.rt.summonTransport(); b.step(5); b.walk(30, 60);
  assert.equal(b.rt.openWagonCargo(), false);
  assert.equal(b.w.openedInv, 0);
  assert.equal(b.w.said.at(-1), 'You must be within 5 metres of your wagon.');
  assert.equal(b.rt.consumeWagonSelectionRequest(), false, 'no selection left armed');
});

test('STEED-UI the view\'s own word: the toggle turns only where mwViewCanTogglePerspective says - the panel\'s View stands on the same word (mutants: STEEDUI-view-unguarded)', () => {
  const src = rd('src/player/mwView.js');
  assert.match(src, /export function mwViewTogglePerspective\(\) \{\n {2}if \(!mwViewCanTogglePerspective\(\)\) return false;/);
  assert.match(src, /export function mwViewCanTogglePerspective\(\) \{\n {2}if \(heldThird \|\| heldFirst\) return false;[^\n]*\n {2}if \(eotbLane\(\) \|\| mwCamera\.thirdPerson\(\)\) return true;\n {2}return !!fpArm\.canThirdPerson\(\) && !mounted;\n\}/);
});

test('STEED-UI dressed by the Plus kit: the bar a small window, the buttons the kit\'s presses', () => {
  assert.ok(FRAME_ROLES.window.includes('.saddlepanel-bar'));
  assert.ok(Object.values(FRAME_ROLES).some((list) => list.includes('.saddlepanel-btn')));
  assert.ok(SMALL_WINDOWS.includes('.saddlepanel-bar'));
});

test('STEED-UI the four hosts: world.js and exterior.js build the one glue over their upkeep, hand it the frame\'s motion in the upkeep\'s block and its frame from the top of every mode (a door takes it down), under the helm\'s covers; world.js offers its view key, exterior.js has none; worldModes.js and dungeonContext.js stand no transport and are named, not wired (mutants: STEEDUI-world-unwired, STEEDUI-ext-unwired)', () => {
  const world = rd('src/scenes/world.js'), ext = rd('src/scenes/exterior.js');
  for (const [name, s] of [['world.js', world], ['exterior.js', ext]]) {
    assert.match(s, /const saddleHost = createSaddleHost\(\{\n {4}upkeep, runtime: \(\) => hccRuntimeOn\(\), items: \(\) => playerEntity\.items \?\? \[\],/, `${name}: the glue`);
    assert.match(s, /saddleHost\.motion\(gamePaused\(\) \? 0 : dt, metres, galloping, player\.rideWalking\);/, `${name}: the motion - HORSE-TIERS (PIN MOVED): and the walk the motor took`);
    assert.match(s, /openStable: \(\) => hudCtx\.togglePause\(\{ at: 'holdings' \}\)/, `${name}: the Stable`);
    assert.match(s, /pass: upkeepPass/, `${name}: the kit's hour`);
    assert.ok(s.includes("isEnhancedPlus() && typeof document !== 'undefined' && walkMode"), `${name}: Enhanced Plus only`);
    assert.ok(s.includes('covered: townTalk.hudCovered || (modes?.hudCovered ?? false) || gamePaused() || !hudRenderEnabled()'), `${name}: the helm's covers`);
  }
  assert.ok(world.includes('    saddleDrawPanel();   // STEED-UI: the saddle panel, as the helm\'s below - every mode, so a door takes it down\n    csaDrawHelmPanel();'), 'world.js: beside the helm, every mode');
  assert.match(world, /canView: \(\) => mwViewCanTogglePerspective\(\), toggleView: \(\) => \{ mwViewTogglePerspective\(\); \}, foot: \(\) => setTransportModeHere\(TRANSPORT_MODES\.Foot\)/);
  assert.ok(world.includes("_mode() === 'exterior' && !(townTalk.overlay instanceof DeathScreen)"), 'world.js: outdoors, alive');
  const extTop = ext.indexOf('    tickAmbientText();\n'), extFrame = ext.indexOf('saddleHost.frame({'), extModal = ext.indexOf('if (modes.frame(dt, now)) {');
  assert.ok(extTop > 0 && extTop < extFrame && extFrame < extModal, 'exterior.js: above the modal gate (the ambient text\'s law), every mode');
  assert.match(ext, /canView: \(\) => false, toggleView: \(\) => \{\}, foot: \(\) => mountRig\.setMode\(TRANSPORT_MODES\.Foot\)/);
  for (const p of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.ok(!rd(p).includes('saddleHost'), `${p}: no transport indoors - named, not wired`);
  assert.ok(rd('src/scenes/saddleHost.js').includes('scenes/worldModes.js (interiors) and scenes/dungeonContext.js (dungeons) stand no transport'), 'the glue names them');
});

test('STEED-UI the Stable page, polished: the bond a bar to the next word with the points to go (whole at Kindred), a fed horse its food\'s hours, a winded breath said, each stat\'s making on its tooltip; the wagon\'s bar in its state\'s tone and a Wagon Yard\'s price to make it whole, at the yard and fetched (mutants: STEEDUI-stable-bond-to-go, STEEDUI-stable-mend-price)', async () => {
  globalThis.document = undefined;
  const { drawStablePage, stableProviderFor, setHoldingsProvider, resetHoldingsPages, _setHoldingsIconForTests, statWhy, hungerLine, mendLine } = await import('../../src/ui/holdingsPages.js');
  _setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
  const fakeEl = (tag) => {
    const n = { tag, children: [], attrs: {}, title: '', isConnected: true, className: '', _text: '',
      get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; } };
    return n;
  };
  const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const meters = [];
  const kit = { el, divider: (t) => el('h4', 'px-divider', t), meter: (now, max, tone) => { meters.push([Math.round(now * 10) / 10, max, tone]); return el('div', 'px-meter', ''); } };
  const rows = (root, cls, out = []) => { for (const c of root.children ?? []) { if (String(c.className).split(' ').includes(cls)) out.push(c); rows(c, cls, out); } return out; };
  const a = horse(31, { horseFed: T0 + 14 * 60 + 10, horseBond: 450 });
  const w = wagon('caravan', 300);
  const items = [a, w, oats(2)];
  const u = createUpkeep({ items: () => items, now: () => T0, horseCare: () => HARD, wagonUpkeep: () => WHARD });
  setHoldingsProvider(stableProviderFor({ runtime: null, on: () => false, hasHorse: () => true, hasCart: () => true, wagonKind: () => 'caravan', items: () => items, upkeep: u }));
  resetHoldingsPages();
  try {
    const d = el('div', 'px-qdetail');
    drawStablePage(d, () => {}, kit);
    const text = d.textContent;
    assert.match(text, /Familiar - bond 45 of 100, \+9 to every stat\. Fed, with food enough for 14 hours\./);
    const bond = rows(d, 'hld-meter').find((r) => r.children[0].textContent === 'Bond');
    assert.equal(bond.children[2].textContent, '10 to Trusting');
    assert.equal(bond.title, 'Fed by your hand, Familiar grows to Trusting at 55');
    assert.ok(meters.some(([now, max, tone]) => now === 10 && max === 20 && tone === 'thin'), 'the bar: ten of the twenty points from Familiar to Trusting');
    const speed = rows(d, 'hld-stat').find((r) => r.children[0].textContent === 'Speed');
    assert.match(speed.title, /^Born \d+, \+9 from your bond$/);
    // the wagon: rickety at 300 of 1400 - its bar plain, the yard's price at the yard and fetched
    const card = u.model().wagon;
    assert.equal(card.stateKey, 'rickety');
    assert.ok(card.mend > 0 && card.mendAway === Math.round(card.mend * 1.5), 'fetched: half again');
    assert.match(text, new RegExp(`Rickety\\. Its team pulls it more slowly\\. A Wagon Yard repairs it fully for ${card.mend} gold, or ${card.mendAway} if its wright must travel to it\\.`));
    assert.ok(meters.some(([now, max, tone]) => max === 100 && tone === '' && Math.abs(now - card.share * 100) < 0.1), 'rickety: its bar plain (sound and worn verdigris, failing blood)');
  } finally { setHoldingsProvider(null); }
  // the words alone
  assert.equal(statWhy({ born: 50 }, 0, 0, 'Fed'), 'Born 50');
  assert.equal(statWhy({ born: 50 }, 9, 25, 'Starving'), 'Born 50, +9 from your bond, −25 starving');
  assert.equal(hungerLine({ hungerKey: 'fed', fedHours: 1.5 }), 'Fed, with food enough for 90 minutes.');
  assert.equal(hungerLine({ hungerKey: 'fed', fedHours: 0 }), 'Fed.');
  assert.equal(hungerLine({ hungerKey: 'hungry', fedHours: 0 }), 'Hungry: every attribute 10 lower, and slower to catch its breath.');
  assert.equal(mendLine({ mend: 0 }), 'A town’s Wagon Yard mends it.');
});

test('AUDIT STEED-UI no button keeps the keyboard\'s focus: a press is never a focus (mousedown\'s default refused) and a click lets it go - a focused button was clicked again by the next Space or Enter the look\'s keys sent through, a second kit and its hour spent; the helm\'s tap buttons the same (mutants: STEEDUI-focus-taken, STEEDUI-focus-kept)', async () => {
  const doc = fakeDoc();
  const calls = [];
  try {
    drawEnhancedSaddle({ saddle: S({ mode: 'Cart', wagon: { name: 'Small Cart', state: 'Worn', stateKey: 'worn', share: 0.4, kitWorks: true }, kits: 2 }) }, { kit: () => calls.push('kit') }, { doc });
    const btn = all(doc.body, 'saddlepanel-btn').find((b) => b.dataset.act === 'kit');
    let refused = false;
    btn.fire('mousedown', { preventDefault: () => { refused = true; } });
    assert.equal(refused, true, 'a press never takes the focus');
    let blurred = false;
    btn.blur = () => { blurred = true; };
    btn.fire('click');
    assert.deepEqual([blurred, calls], [true, ['kit']], 'a click lets it go');
  } finally { hideEnhancedSaddle(); }
  const { drawEnhancedHelm, hideEnhancedHelm } = await import('../../src/ui/enhanced/enhancedHelm.js');
  const hdoc = fakeDoc();
  try {
    drawEnhancedHelm({ helm: { hull: 1, hasSails: true, sailsUp: false, light: false, timeScaleIndex: 0, timeScaleMax: 4, timeScale: 1 } }, { press: () => {} }, { doc: hdoc });
    const sails = all(hdoc.body, 'helmpanel-btn').find((b) => b.dataset.act === 'sails');
    let refused = false, blurred = false;
    sails.blur = () => { blurred = true; };
    sails.fire('mousedown', { preventDefault: () => { refused = true; } });
    sails.fire('click');
    assert.deepEqual([refused, blurred], [true, true], 'the helm\'s the same');
  } finally { hideEnhancedHelm(); }
});
