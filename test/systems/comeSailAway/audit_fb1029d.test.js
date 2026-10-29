// AUDIT FB1029d (bible/01-Overview/audits/Audit-FB1029d.md): FIELD BUGS 2026-10-29d read cold. Lane B's findings, each
// pinned on the real runtimes - Come Sail Away over test/csaScene.mjs, Horse Cart and Cargo over test/hccWorld.mjs, the
// helm panel over test/hudPage.mjs - and each assertion failing on the code as it stood at 600348498e.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene, terrain } from '../../csaScene.mjs';
import { makeWorld } from '../../hccWorld.mjs';
import { withHudPage, childOf } from '../../hudPage.mjs';
import { WAGON_MODE, HORSE_MODE, TRANSPORT, HCC_TEXT } from '../../../src/systems/horse/horseCartLaw.js';
import { IRONS_TEXT, IRONS_TELL_S } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { passengerCard } from '../../../src/scenes/naval/passageHelm.js';
import { drawEnhancedHelm, hideEnhancedHelm, helmHeavyText, buildHelmPreview } from '../../../src/ui/enhanced/enhancedHelm.js';

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

test('AUDIT FB1029d B1: from a deck the Transport window mounts no horse left beside her and drives no wagon parked by her - ashore both answer (mutants: the mount checks\' deck refusals)', () => {
  for (const deck of [false, true]) {
    const h = makeWorld({ cart: false });
    h.step();
    h.rt.tryUseTransport(TRANSPORT.Horse);
    h.step();
    h.w.mode = TRANSPORT.Foot;
    h.step();
    assert.equal(h.state().HorseMode, HORSE_MODE.LooseStationary);
    h.w.deck = deck;
    assert.equal(h.rt.tryUseTransport(TRANSPORT.Horse).succeeded, !deck, `the horse, deck ${deck}`);
    const c = makeWorld();
    c.step();
    c.rt.tryUseTransport(TRANSPORT.Cart);
    c.step(2);
    c.w.mode = TRANSPORT.Foot;
    c.step();
    assert.equal(c.state().Mode, WAGON_MODE.Deployed);
    c.w.deck = deck;
    assert.equal(c.rt.tryUseTransport(TRANSPORT.Cart).succeeded, !deck, `the wagon, deck ${deck}`);
  }
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
  assert.deepEqual(heavyAt(1.45), [0.55, false], 'C3: over half');
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

const TS = 819.2;
/** A scene over two built pixels, the player standing on `at` (C1's and A1's): (10, 20) and (14, 20). */
function twoPixels() {
  const ts = [terrain(10, 20), terrain(14, 20)];
  const s = scene({ terrains: ts, float: Array(80).fill(1.5), int: Array(80).fill(0) });
  s.deps.handling = () => 'responsive';
  let px = { X: 10, Y: 20 };
  s.deps.currentMapPixel = () => ({ ...px });
  s.deps.playerTerrain = () => ts.find((t) => t.mapPixelX === px.X && t.mapPixelY === px.Y) ?? null;
  return { s, go: (p) => { px = p; } };
}

test('AUDIT FB1029d A1 + A2: a record of a boat with no pixel loaded in an inn keeps no guess - the player\'s pixel answers indoors and is never saved, and her own is read the first time she is asked outdoors (mutants: the guess kept; the guard dropped)', () => {
  const herPlace = [4 * TS + 100, 34, 200];   // inside (14, 20), four pixels east of the inn's
  const rec = (() => { const { s } = twoPixels(); const b = s.place(1, 0, herPlace); b.MapPixel = null; return JSON.parse(JSON.stringify(s.rt.getSaveData())); })();
  const { s, go } = twoPixels();
  s.world.inside = true;
  s.rt.restoreSaveData(JSON.parse(JSON.stringify(rec)));
  s.rt.OnLoad();
  const b = s.rt.AllBoats[0];
  assert.deepEqual([b.MapPixel, s.rt.getSaveData().placedBoats[0].MapPixel], [null, null], 'indoors: no guess on her, none saved');
  s.world.inside = false;
  s.rt.OnTransition();
  assert.deepEqual(b.MapPixel, { X: 14, Y: 20 }, 'out of the door: the pixel she stands on');
  go({ X: 14, Y: 20 });
  s.rt.OnPositionUpdate([0, 0, 0]);
  assert.equal(b.GameObject.activeSelf, true, 'at her own pixel she is shown (the inn\'s pixel had hidden her for good)');
});

test('AUDIT FB1029d A3 + C1: a dungeon\'s boat with no pixel stands in the dungeon she is in, and outdoors throws nowhere and is given no outdoor pixel; a boat placed on a terrain the streamer no longer holds takes hers at once (mutants: the dungeon arm\'s bare MapPixel; the fallback; the inside guard; the placing\'s read; A5 the console\'s)', () => {
  const { s } = twoPixels();
  const d = s.place(1, 0, [3000, 34, 3000]);
  d.inside = true; d.MapPixel = null;
  const far = s.place(1, 0, [3100, 34, 3000]);
  far.inside = true; far.MapPixel = { X: 14, Y: 20 };   // another dungeon's boat: her own pixel answers, never the player's
  s.world.inside = true;
  assert.doesNotThrow(() => s.rt.OnTransition());
  assert.deepEqual([d.GameObject.activeSelf, d.MapPixel], [true, null], 'in her dungeon: shown by the player\'s pixel, none kept');
  assert.equal(far.GameObject.activeSelf, false, 'a boat of another dungeon stays hidden here');
  assert.doesNotThrow(() => s.rt.UpdateBoatVisibilityOf(d));
  assert.match(s.rt.console.printboats(), /^0 - .+ at 10, 20\n1 - .+ at 14, 20\n$/, 'A5: the console lists her at the pixel she is read at');
  s.world.inside = false;
  assert.doesNotThrow(() => s.rt.OnPositionUpdate([0, 0, 0]), 'outdoors: a recentre passes her');
  assert.deepEqual([d.GameObject.activeSelf, d.MapPixel], [false, null], 'hidden, and no outdoor pixel laid on a dungeon\'s boat');
  const gone = terrain(12, 20);   // a terrain the streamer does not hold: GetMapPixelFromTerrain answers none
  const p = s.rt.PlaceBoat([2 * TS + 100, 34, 200], [0, 0, 1], 1, 0, gone);
  assert.deepEqual(p.MapPixel, { X: 12, Y: 20 });
});

test('AUDIT FB1029d WIND-HELD (lane A, not proven at the door): a wind of nought found outdoors - a door whose host chain stopped before OnTransition - is the door\'s wind laid the next frame, and logged (mutants: the frame\'s law dropped)', () => {
  const s = mk();
  s.place(2, 0);
  s.world.inside = true; s.rt.OnTransition();
  s.world.inside = false;   // the mode is the street's; OnTransition never came
  s.frame();
  assert.ok(Math.hypot(...s.rt.state.windVectorCurrent) > 0.5, 'a wind outdoors');
  assert.ok(s.out.log.some((l) => /WIND OF NOUGHT OUTDOORS/.test(l)), 'and the path said');
  s.world.inside = true; s.rt.OnTransition(); s.frame();
  assert.deepEqual(s.rt.state.windVectorCurrent, [0, 0, 0], 'indoors the mod\'s none stands');
});

test('AUDIT FB1029d C3: the HUD\'s preview of the helm panel says the keys, never a load (mutants: the preview heavy)', async () => {
  await withHudPage(null, (doc) => {
    const p = buildHelmPreview(doc);
    assert.notEqual(childOf(childOf(childOf(p, 'helmpanel-bar'), 'helmpanel-title'), 'helmpanel-hint').textContent, helmHeavyText());
  }, { teardown: hideEnhancedHelm });
});
