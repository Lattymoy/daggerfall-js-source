// EG-FULL (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 9.3, 16.5, 17.4, 21 and 27): THE
// SPIRE ON THIS SCREEN (scenes/eliteGates/egClient.js, ui/eliteGates/egHud.js, systems/eliteGates/spireKit.js) - folded from the director's own words
// (net/eliteGates/egBrain.js egStateOf and friends, held to the wire's projection): THE WITNESS (the death save, no blow reaching it,
// the eye behind a living companion, Q and E, the body put away, the recall's word standing me back), THE PANEL (a
// Vestige's cards and the company's word by key and by `/breach`), THE POTION LAW, the push, the cage and the ring, the
// room's heals, THE RECAP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEgClient, EG_PUSH_MPS, EG_PUSH_MAX_M, EG_WITNESS_BACK } from '../../../src/scenes/eliteGates/egClient.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { validEgOut } from '../../../src/net/wire.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { egPanelModel, egRecapModel, EG_POTIONS_PER_HALL } from '../../../src/ui/eliteGates/egHud.js';
import { EG_VESTIGES, EG_V_BY_KEY } from '../../../src/net/eliteGates/egVestige.js';
import { isRestoringPotion, registerSpirePotionLaw, spirePotionRefusal, SPIRE_POTION_TEXT } from '../../../src/systems/eliteGates/spireKit.js';
import { POTION_RECIPES, potionRecipeKey } from '../../../src/systems/potionRecipes.js';
import { useItem } from '../../../src/systems/useItem.js';
import { registerMadeLevelHere } from '../../../src/systems/madeLevel.js';   // EG-H2: THE POTION LAW is the made level's rule
import { TEMPLATES } from '../../../src/systems/item/itemKinds.js';
import { createEgLink } from '../../../src/net/eliteGates/egLink.js';
import { EG_FALL_MS } from '../../../src/ui/eliteGates/egSpireHud.js';   // EG-ZD: THE FALL's length, before the witness's eye

const T0 = 1_800_000_000_000;
const ME = 'acct-0';

/** A client inside a breach of two at hall `h`'s `sg`, its words the director's own. */
function inBreach({ h = 2, sg = 'trial' } = {}) {
  let clock = T0 + EG_SEALED_MS + 60_000;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.h = h; B.sg = sg; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 };
  const sent = [], said = [], mids = [], placed = [], hurts = [];
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: { strength: 50, endurance: 50 }, items: [] };
  const moves = [];
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, collider: { move: (pos, dx, dy, dz) => { moves.push([dx, dz]); pos[0] += dx; pos[2] += dz; } } };
  const modes = { mode: 'dungeon', egHallBreach: () => B.b, egHallCircle: () => 1, egPlace: (at) => { placed.push(at); player.pos = [...at]; return true; }, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, sendEg: (k, f = {}) => { sent.push({ k, ...f }); return true; } };
  let peers = [];
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0] },
    say: (t) => said.push(t), mid: (t) => mids.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: (n) => { hurts.push(n); entity.health -= n; }, peers: () => peers });
  const tell = (w) => { const v = validEgOut(JSON.parse(JSON.stringify(w))); assert.ok(v, `the wire refuses ${w.k}`); client.word(v); };
  tell(egStateOf(B, clock));
  const spec = egHallOf(77, h, 0);
  player.pos = realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z);
  return { client, B, entity, player, sent, said, mids, placed, hurts, moves, tell, spec, step: (ms) => { clock += ms; }, now: () => clock, setPeers: (p) => { peers = p; } };
}

test('EG-FULL THE WITNESS (section 16.5): the death save takes a killing blow in the Spire - I watch, the room is told once (`fell`), no blow reaches me (the damage door\'s mod answers 0), my body is put away under the hall and held there; the eye sits behind and over a living companion, Q and E change whom; the recall\'s word stands me where it calls me at its share of my health and the watching ends (mutants: a death screen in the Spire; a witness struck; the eye on the fallen; the recall never standing me)', () => {
  const P = inBreach();
  const { client, sent, entity, player } = P;
  assert.equal(client.witnessing(), false);
  assert.equal(client.fallSave(), true);
  assert.equal(client.fallSave(), false, 'once');
  assert.equal(sent.filter((w) => w.k === 'fell').length, 1, 'the room told once');
  assert.ok(entity.health >= 1, 'no death');
  assert.equal(client.witnessing(), true);
  // the room's word: the company's rows (me a witness), the fall
  P.B.mem[ME].alive = 0; P.B.mem[ME].wit = 1; P.B.mem[ME].falls = 1;
  P.tell(egStateOf(P.B, P.now()));
  client.frame();
  const [, y] = dungeonToRealm(...player.pos);
  assert.ok(y < -30, 'the body put away under the hall');
  player.pos[1] += 5; client.frame();
  assert.ok(dungeonToRealm(...player.pos)[1] < -30, 'and held there');
  // the eye: behind and over the living companion - PIN MOVED (EG-ZD, section 16.5): once THE FALL's own screen has run
  // (the eye sinking where I fell, the card, the dither - ui/eliteGates/egSpireHud.js EG_FALL_MS; test/net/eliteGates/egz_return.test.js pins it)
  P.setPeers([{ sub: 'acct-1', pos: [10, 2, 20] }]);
  P.step(EG_FALL_MS);
  client.frame();
  const c = { pos: [0, 0, 0] };
  assert.equal(client.witnessEye(c, 0), true);
  assert.deepEqual(c.pos.map((v) => Math.round(v * 100) / 100), [10, 2 + 1.5 + 1.6, 20 - EG_WITNESS_BACK]);
  assert.equal(client.key({ code: 'KeyE' }), true, 'E changes whom');
  // the recall
  const before = P.placed.length;
  P.tell({ k: 'rise', s: ME, p: 0.5, x: 1, z: 30, h: 2 });
  assert.equal(client.witnessing(), false);
  assert.equal(P.placed.length, before + 1);
  const [sx, , sz] = dungeonToRealm(...P.placed.at(-1));
  assert.deepEqual([Math.round((sx - P.spec.x0) * 100) / 100, sz], [1, 30], 'stood where it calls me');
  assert.equal(entity.health, 50, 'at its share of my health');
});

test('EG-FULL THE PANEL (sections 16.2 and 21): a Vestige offer drawn as its cards (each named from the catalogue, keyed 1-6) and the company\'s word as its choices; key 1 takes the first card, Y says yes to the newest yes-or-no choice, `/breach vote 2` takes a decree\'s second option, `/breach pick 2` the second card; nothing taken when nothing is open (mutants: a pick of a card not shown; a key taken with no panel)', () => {
  const P = inBreach({ h: 5, sg: 'rest' });
  const { client, sent } = P;
  assert.equal(client.key({ code: 'Digit1' }), false, 'no panel, no key');
  const cards = [EG_V_BY_KEY.ironfooting.id, EG_VESTIGES[5].id, EG_VESTIGES[12].id];
  P.tell({ k: 'offer', v: cards, n: 1 });
  const model = egPanelModel(client.state(), ME, P.now());
  assert.deepEqual(model.offer.cards.map((c) => [c.key, c.card]), [[1, cards[0]], [2, cards[1]], [3, cards[2]]]);
  assert.equal(model.offer.cards[0].name, 'Iron Footing I', 'named with the rank it would take');
  assert.equal(client.key({ code: 'Digit1' }), true);
  assert.deepEqual(sent.at(-1), { k: 'pick', v: cards[0] });
  client.command('pick 2');
  assert.deepEqual(sent.at(-1), { k: 'pick', v: cards[1] });
  P.tell({ k: 'offer', v: [], n: 0 });
  P.tell({ k: 'ask', q: 'ready', o: [1], until: P.now() + 20_000 });
  P.tell({ k: 'ask', q: 'dec:legion', o: [4, 5, 6], until: P.now() + 20_000 });
  const m2 = egPanelModel(client.state(), ME, P.now());
  assert.equal(m2.asks.length, 2);
  assert.equal(client.key({ code: 'KeyY' }), true);
  assert.deepEqual(sent.at(-1), { k: 'vote', q: 'ready', y: 1 });
  client.command('vote 2');
  assert.deepEqual(sent.at(-1), { k: 'vote', q: 'dec:legion', y: 1 });
});

test('EG-FULL THE POTION LAW (section 17.4): the restoring potions are the recipes that heal health (Healing, Heal True, Purification) and no other; in the breach two a hall - the third refused with the bottle kept, the count filled again at the wake and the rest; outside it, never (mutants: a Stamina potion counted; the bottle drunk on a refusal; the count never refilled)', () => {
  const key = (name) => potionRecipeKey(POTION_RECIPES.find((r) => r.name === name).ingredients);
  for (const n of ['healing', 'healTrue', 'purification']) assert.equal(isRestoringPotion({ potionRecipeKey: key(n) }), true, n);
  for (const n of ['stamina', 'restorePower', 'levitation', 'resistFire']) assert.equal(isRestoringPotion({ potionRecipeKey: key(n) }), false, n);
  const P = inBreach();
  const { client } = P;
  registerSpirePotionLaw({ allowed: () => client.potionAllowed(), used: () => client.potionUsed() });
  registerMadeLevelHere(() => 'spire');   // PIN MOVED (EG-H2): the potion door asks the made level's law where the player stands - the world host's word, here the Spire's
  try {
    client.frame();   // the trial's wake fills the count
    const bottle = () => ({ group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, potionRecipeKey: key('healing'), name: 'Healing' });
    const pack = [];
    const drink = () => { const it = bottle(); pack.push(it); return useItem(it, pack, { drinkPotion: () => 'Healing' }); };
    assert.equal(drink().kind, 'potion');
    assert.equal(drink().kind, 'potion');
    const third = drink();
    assert.equal(third.kind, 'refused');
    assert.equal(third.text, SPIRE_POTION_TEXT);
    assert.equal(pack.length, 1, 'the refused bottle kept');
    assert.equal(spirePotionRefusal({ potionRecipeKey: key('stamina') }), null, 'a Stamina potion never counted');
    // the rest fills it again
    P.B.sg = 'rest'; P.tell(egStateOf(P.B, P.now()));
    client.frame();
    assert.equal(spirePotionRefusal({ potionRecipeKey: key('healing') }), null);
    assert.equal(EG_POTIONS_PER_HALL, 2);
  } finally { registerSpirePotionLaw(null); registerMadeLevelHere(null); }
  assert.equal(spirePotionRefusal({ potionRecipeKey: key('healing') }), null, 'outside the breach, never');
});

test('EG-FULL THE PUSH, THE CAGE AND THE RING (section 9.3): a push carried by the collider\'s own move at the breath\'s pace (no edge stops it), Iron Footing taking its share off; a cage holds the motor; a challenge\'s ring keeps the challenged inside its rim and everyone else out (mutants: a push teleporting; Iron Footing ignored; the ring keeping nobody)', async () => {
  const P = inBreach();
  const { client, moves, player } = P;
  client.push(1, 0, 3);
  for (let i = 0; i < 40; i++) { P.step(50); await new Promise((r) => setTimeout(r, 2)); client.frame(); }
  const total = moves.reduce((s, [dx]) => s + dx, 0);
  assert.ok(Math.abs(total - 3) < 1e-6, `pushed ${total} m`);
  assert.ok(moves.every(([dx]) => dx <= EG_PUSH_MPS * 0.1 + 1e-9), 'never more than a frame\'s pace');
  client.push(0, 1, 99);
  moves.length = 0;
  for (let i = 0; i < 400 && (moves.length === 0 || moves.at(-1)[1] > 0); i++) { await new Promise((r) => setTimeout(r, 2)); client.frame(); if (i > 300) break; }
  assert.ok(moves.reduce((s, [, dz]) => s + dz, 0) <= EG_PUSH_MAX_M + 1e-6, 'a push carries at most EG_PUSH_MAX_M');
  // Iron Footing III: pushes taken whole off
  P.B.mem[ME].vs = [[EG_V_BY_KEY.ironfooting.id, 3]];
  P.tell(egStateOf(P.B, P.now()));
  moves.length = 0;
  client.push(1, 0, 3);
  for (let i = 0; i < 10; i++) { P.step(50); client.frame(); }
  assert.equal(moves.length, 0, 'Iron Footing III: no push');
  P.B.mem[ME].vs = [[EG_V_BY_KEY.ironfooting.id, 1]];
  P.tell(egStateOf(P.B, P.now()));
  client.push(1, 0, 2);
  for (let i = 0; i < 40; i++) { P.step(50); client.frame(); }
  const taken = moves.reduce((sum, [dx]) => sum + dx, 0);
  assert.ok(Math.abs(taken - 2 * (1 - EG_V_BY_KEY.ironfooting.v[0])) < 1e-6, `Iron Footing I takes its share off: ${taken} m`);
  client.hold(250);
  assert.ok(player.freezeMotor >= 0.25, 'the cage holds');
  // the ring: inside for the challenged, outside for the rest
  const ring = [P.spec.arrive.x, P.spec.arrive.z + 20, 6];
  player.pos = realmToDungeon(P.spec.x0 + ring[0], 0, ring[1] + 10);
  client.ring(ring[0], ring[1], ring[2], true);
  let [sx, , z] = dungeonToRealm(...player.pos);
  assert.ok(Math.hypot(sx - P.spec.x0 - ring[0], z - ring[1]) <= ring[2], 'the challenged kept inside');
  player.pos = realmToDungeon(P.spec.x0 + ring[0], 0, ring[1] + 1);
  client.ring(ring[0], ring[1], ring[2], false);
  [sx, , z] = dungeonToRealm(...player.pos);
  assert.ok(Math.hypot(sx - P.spec.x0 - ring[0], z - ring[1]) >= ring[2], 'the others kept out');
});

test('EG-FULL THE ROOM\'S HEALS AND THE RECAP (sections 16.2 and 27.6): the rest\'s heal fills health, magicka and fatigue; a Rally or a Mending adds its share; the fray\'s lash takes its share through the hurt door and never past 1; THE RECAP names the depth, the circles\' glyph strip, the company and my Vestiges (mutants: the lash killing; the rest\'s heal partial; the recap blank)', () => {
  const P = inBreach();
  const { client, entity, hurts } = P;
  P.tell({ k: 'eheal', p: 0.15, why: 'mending' });
  assert.equal(entity.health, 95);
  entity.health = 10;
  P.tell({ k: 'eheal', p: -0.25, why: 'fray' });
  assert.equal(entity.health, 1, 'never past 1');
  assert.deepEqual(hurts, [9], 'through the hurt door');
  P.tell({ k: 'eheal', p: 1, why: 'rest' });
  assert.equal(entity.health, entity.maxHealth);
  assert.equal(entity.magicka, entity.maxMagicka, 'and magicka');
  P.B.mem[ME].vs = [[EG_V_BY_KEY.ironfooting.id, 2]];
  P.tell(egStateOf(P.B, P.now()));
  const R = egRecapModel(client.state(), ME, [{ h: 1, glyph: 'Y' }, { h: 2, glyph: 'S', fall: true }], P.now());
  assert.match(R.title, /^Hall 2 - Redoubt 0 - The Broken Galleries$/);
  assert.deepEqual(R.circles, ['Circle 1: Y S (a fall)']);
  assert.deepEqual(R.vestiges, ['Iron Footing II']);
  assert.match(R.company, /Mac/);
  void createEgLink;
});
