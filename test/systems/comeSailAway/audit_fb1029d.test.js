// AUDIT FB1029d (bible/01-Overview/audits/Audit-FB1029d.md): FIELD BUGS 2026-10-29d read cold. Lane B's findings, each
// pinned on the real runtimes - Come Sail Away over test/csaScene.mjs, Horse Cart and Cargo over test/hccWorld.mjs, the
// helm panel over test/hudPage.mjs - and each assertion failing on the code as it stood at 600348498e.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene } from '../../csaScene.mjs';
import { makeWorld } from '../../hccWorld.mjs';
import { withHudPage, childOf } from '../../hudPage.mjs';
import { WAGON_MODE, HORSE_MODE, TRANSPORT, HCC_TEXT } from '../../../src/systems/horse/horseCartLaw.js';
import { IRONS_TEXT, IRONS_TELL_S } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { passengerCard } from '../../../src/scenes/naval/passageHelm.js';
import { drawEnhancedHelm, hideEnhancedHelm, helmHeavyText } from '../../../src/ui/enhanced/enhancedHelm.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const mk = (handling = 'responsive') => { const s = scene({ float: Array(80).fill(1.5), int: Array(80).fill(0) }); s.deps.handling = () => handling; return s; };

test('AUDIT FB1029d B1: on a Come Sail Away deck no pair is summoned, sent away or mounted - a summon at the helm set the wagon down in the sea, and Send away shed its load from a ship under way; the host says the deck under me (mutants: a refusal on Daggerfall\'s ship alone)', () => {
  const h = makeWorld();
  h.step();
  h.w.deck = true;
  assert.deepEqual(h.rt.summonTransport(), { ok: false, text: HCC_TEXT.summonOutdoorsOnly });
  assert.deepEqual(h.rt.sendTransportAway(), { ok: false, text: HCC_TEXT.sendAwayOutdoorsOnly });
  assert.deepEqual([h.state().Mode, h.state().WagonStabled], [WAGON_MODE.WithPlayer, false], 'the wagon stays in my keeping');
  h.rt.handleQuickMountOrDismount();
  assert.equal(h.w.said.at(-1), HCC_TEXT.mountOutdoorsOnly, 'the mount key refused');
  h.w.mode = TRANSPORT.Horse;   // the Transport window's set: ObserveTransportMode answers it next frame
  h.step();
  assert.deepEqual([h.w.mode, h.state().Mode], [TRANSPORT.Foot, WAGON_MODE.WithPlayer], 'no horse ridden from a deck, no wagon parked in the sea');
  h.w.deck = false;
  assert.equal(h.rt.summonTransport().ok, true, 'ashore it answers');
  assert.match(src('src/scenes/world.js'), /onDeck: \(\) => !!\(csaBoatUnderMe\(\) \?\? _csaBuckets\.get\(player\.groundKey\)\?\.boat\),/, 'the host: my helm\'s boat, another\'s I stand aboard, or one under my feet');
});

test('AUDIT FB1029d B2: a cart left for the helm is parked by the next frame - its load is off her from the helm\'s first weighing, not the next magic round (mutants: the keeping read before the park)', () => {
  const h = makeWorld();
  h.step();
  assert.equal(h.rt.tryUseTransport(TRANSPORT.Cart).ok ?? true, true);
  h.step(2);
  assert.equal(h.w.mode, TRANSPORT.Cart, 'driving the wagon');
  h.w.mode = TRANSPORT.Foot;   // Come Sail Away's StartSailing: the player set on foot, then her cargo weighed
  assert.equal(h.rt.wagonWithPlayer(), false, 'the park the next frame makes is read now');
  h.step();
  assert.deepEqual([h.state().Mode, h.rt.wagonWithPlayer()], [WAGON_MODE.Deployed, false], 'and the frame parks it');
});

test('AUDIT FB1029d B6: the opt-in horse and cart items weigh by their keeping, as the wagon\'s load - a horse beside me, ridden or hitched to a wagon in my keeping counts; one waiting where I left it, stabled, or hitched to a parked wagon does not (mutants: the horse by ownership)', () => {
  const h = makeWorld();
  h.step();
  assert.deepEqual([h.state().HorseMode, h.rt.horseWithPlayer(), h.rt.wagonWithPlayer()], [HORSE_MODE.WithPlayer, true, true]);
  const st = h.state();
  st.HorseMode = HORSE_MODE.LooseStationary;
  assert.equal(h.rt.horseWithPlayer(), false, 'waiting where I left it');
  st.HorseMode = HORSE_MODE.HitchedToWagon; st.Mode = WAGON_MODE.Deployed;
  assert.equal(h.rt.horseWithPlayer(), false, 'in the shafts of a parked wagon');
  st.Mode = WAGON_MODE.WithPlayer;
  assert.equal(h.rt.horseWithPlayer(), true, 'in the shafts of the wagon in my keeping');
  st.HorseMode = HORSE_MODE.WithPlayer; st.HorseStabled = true;
  assert.equal(h.rt.horseWithPlayer(), false, 'stabled');
  st.HorseStabled = false; st.Mode = WAGON_MODE.FollowingPlayer;
  assert.equal(h.rt.wagonWithPlayer(), false, 'B8: a team following on foot stays ashore');
  const w = src('src/scenes/world.js');
  assert.ok(w.includes('hasHorse: () => hasTransport(TRANSPORT_HORSE) && (!hccOn() || !!hccRuntime?.horseWithPlayer?.()), hasCart: () => hasTransport(TRANSPORT_SMALL_CART) && (!hccOn() || !!hccRuntime?.wagonWithPlayer?.()),'), 'Come Sail Away\'s transport seam');
});

test('AUDIT FB1029d B3 + B8: the helm\'s line says a load under half her way, never the Classic helm\'s Carrack, whose missing hold no lightening helps; at exactly half the mod\'s own word is the lighter one (mutants: the threshold moved; the hold unread)', () => {
  const heavyAt = (share) => {
    const s = mk();
    const boat = s.place(1, 0);
    s.helm(boat);
    const { slows } = s.rt.cargoRoom(boat);
    s.deps.entity.wagonWeight = () => share * slows - 185;   // her load: the body's 175, the pack's 10, the wagon's the rest
    s.rt.OnNewMagicRound();
    return [+s.rt.state.boatCargoMod.toFixed(2), s.rt.helmPanelState().heavy];
  };
  assert.deepEqual(heavyAt(1.6), [0.4, true]);
  assert.deepEqual(heavyAt(1.5), [0.5, false], 'at half: "draws a little lower", not "a bigger boat"');
  assert.deepEqual(heavyAt(1.4), [0.6, false]);
  const c = mk('classic');
  c.helm(c.place(4, 0));
  assert.deepEqual([c.rt.state.boatCargoMod, c.rt.helmPanelState().heavy], [0, false], 'the Classic Carrack: dead by the mod\'s own missing hold, and not told to lighten');
});

test('AUDIT FB1029d B4: a hull her load holds dead is never in irons - striking sail to row turns nothing then, and the helm says her load instead (mutants: the load unread)', () => {
  const s = mk('classic');
  s.deps.entity.wagonWeight = () => 1500;
  const boat = s.place(1, 0);
  s.helm(boat);
  s.rt.ToggleSails();
  for (let t = 0; t < IRONS_TELL_S + 1; t += 0.25) { s.rt.state.windVectorCurrent = [0, 0, -1.5]; s.frame(); }
  assert.equal(s.rt.state.boatCargoMod, 0);
  assert.deepEqual([s.rt.helmPanelState().inIrons, s.out.hud.includes(IRONS_TEXT), s.rt.helmPanelState().heavy], [false, false, true]);
});

test('AUDIT FB1029d B5: a passenger on a booked ship her load holds is told so on her card\'s line, as a captain is (mutants: the card without the word; the line unpainted)', async () => {
  const s = mk();
  s.deps.entity.wagonWeight = () => 1500;
  const boat = s.place(1, 0);
  boat.charter = { to: { name: 'Wayrest', px: 859, py: 244 }, ship: 'The Fair Silk' };
  s.helm(boat);
  const card = passengerCard(boat, { live: true }, s.rt.helmPanelState());
  assert.equal(card.heavy, true);
  await withHudPage(null, (doc) => {
    const root = drawEnhancedHelm({ helm: null, aboard: card }, {}, { doc });
    assert.equal(childOf(childOf(childOf(root, 'helmpanel-bar'), 'helmpanel-title'), 'helmpanel-hint').textContent, helmHeavyText());
  }, { teardown: hideEnhancedHelm });
});
