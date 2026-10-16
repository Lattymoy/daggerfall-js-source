// LIVING CREW (2026-09-29, Mac: "Crew members shouldnt be the static sprites and instead the enemy type sprites with
// multiple animations, they should navigate the deck, talk with each other, blurb, sing chantys, etc" and "Boarding
// scenarios should be seamless, with crew naturally getting into position and fighting enemies"):
//
//   THE CREW (systems/naval/crewLife.js) - who stands on a deck (a ship's muster, a player's hands' mix), where (her own
//   flats' places: a walker on her deck, a station off it), and their work: walking her deck, two men at their talk, a
//   word now and then, the chanty, the guns (a hurry and the battle's words) and a grapple's muster at the rail.
//   THE HOST (scenes/naval/navalCrew.js) - the crews near the eye as DFU's mobile units on her deck, carried by her mesh node,
//   the mod's people flats standing down for them (never the rowers below), taken off her deck for a fight.
//   SEAMLESS BOARDING (scenes/naval/navalHost.js beginFight) - her muster fights where her crew stands, the player lands across
//   from where he stood, my hands are my own crew and land at her rail across from my ship; a repel's party is her own
//   men (never her captain), over my rail across from her, and my hands stand to where they stand.
//   THE WORDS (ui/naval/navalHud.js drawCrewLines) and the world's wiring (scenes/world.js).
import '../../modsOff.js';
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createCrewLife, crewRoster, crewCount, playerCrewCount, deckExtentZ, sung,
  CREW_SHOWN, PLAYER_CREW, CREW_TALKS, CHANTIES, CREW_BLURBS, CREW_BLURB_S, CREW_LINE_S, CREW_HURRY, CREW_WALK, CREW_BLOCKED_S,
} from '../../../src/systems/naval/crewLife.js';
import { createNavalCrew, peopleFlatsOf, mainLevel, CREW_RANGE, CREW_KEEP } from '../../../src/scenes/naval/navalCrew.js';
import { buildDeck, intoDeck, outOfDeck, DECK_STEP, DECK_HEADROOM } from '../../../src/systems/naval/navalDeck.js';
import { boxColliderTriangles } from '../../../src/world/prefabColliders.js';
import { musterOf, MOBILE, CREW_PER_HAND, GRAPPLE_S, HAND } from '../../../src/systems/naval/navalBoarding.js';
import { classById } from '../../../src/systems/naval/navalShips.js';
import { Boat, spawnBoat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { drawCrewLines, destroyNavalHud, tagAlpha, CREW_SAY_RANGE, CREW_SAY_FADE_FROM, CREW_SAY_MAX, CREW_SAY_LIFT } from '../../../src/ui/naval/navalHud.js';   // FIELD BUGS 2026-10-02 CREW-SAY: the foot's lift
import { MODELS, ctxFor } from '../../csaScene.mjs';
import { sea, readyPool } from '../../navalSea.mjs';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');

/** A plain deck: a flat 8 m by 24 m at 2 m (her frame) with a mast amidships - the brain's own ground; a straight line
 *  across her is no walk. */
const plainDeck = () => buildDeck([
  { positions: [-4, 2, -12, 4, 2, -12, 4, 2, 12, -4, 2, 12], indices: [0, 1, 2, 0, 2, 3] },
  boxColliderTriangles({ m_Center: { x: 0, y: 6, z: 0 }, m_Size: { x: 1.2, y: 8, z: 1.2 } }),
], { minX: -6, maxX: 6, minZ: -14, maxZ: 14 });
const pirate = classById('pirateBrig');
/** A crew stepped `s` seconds at `dt`, each frame's reading handed to `each`. */
function run(life, s, ctx = {}, each = null, dt = 0.05) { for (let t = 0; t < s; t += dt) { life.step(dt, ctx); each?.(life); } }

// ── who they are ─────────────────────────────────────────────────────────────────────────────────────────────────

test('LIVING CREW WHO STANDS: a sea ship\'s crew is her muster\'s first CREW_SHOWN - her captain first, her men in the muster\'s own order (so the ones standing are the ones who fight) - and fewer as her crew thins; a player\'s is the hands\' mix, a man for every CREW_PER_HAND of her crew; each seeded by the ship, the same for every player; crewCount is their number without making them (mutants: the roster another order, the count off by her share, the seed unread)', () => {
  const r = crewRoster({ hull: 2, seed: 7, shipClass: pirate });
  const m = musterOf(pirate, 1);
  assert.deepEqual(r.map((x) => x.mobile), [m.captain, ...m.men].slice(0, CREW_SHOWN[2]));
  assert.equal(r.length, CREW_SHOWN[2]);
  assert.deepEqual(crewRoster({ hull: 2, seed: 7, shipClass: pirate }), r, 'the same seed, the same crew');
  const thin = crewRoster({ hull: 2, seed: 7, shipClass: pirate, crewShare: 0.2 });
  assert.equal(thin.length, Math.min(CREW_SHOWN[2], musterOf(pirate, 0.2).men.length + 1), 'fewer as her crew thins');
  assert.ok(r.every((x) => x.gender === 'male' || x.gender === 'female'));
  const sexes = new Set(); for (let s = 0; s < 40; s++) for (const x of crewRoster({ hull: 3, seed: s, shipClass: pirate })) sexes.add(x.gender);
  assert.deepEqual([...sexes].sort(), ['female', 'male'], 'women among them');
  assert.ok(new Set(Array.from({ length: 12 }, (_, s) => JSON.stringify(crewRoster({ hull: 3, seed: s, crew: 60 })))).size > 3, 'each ship her own crew');
  const mine = crewRoster({ hull: 2, seed: 99, crew: 24 });
  assert.equal(mine.length, playerCrewCount(2, 24));
  assert.equal(playerCrewCount(2, 24), Math.min(CREW_SHOWN[2], Math.round(24 / CREW_PER_HAND)));
  assert.equal(playerCrewCount(2, 0), 0, 'no crew, nobody');
  assert.equal(playerCrewCount(2, 2), 1, 'a man while any are aboard');
  assert.ok(mine.every((x) => PLAYER_CREW.includes(x.mobile)));
  for (const hull of [1, 2, 3, 4]) for (const share of [0, 0.3, 0.7, 1]) for (const cls of ['pirateBrig', 'merchantGalleon', 'navyGalley', 'pirateSloop']) {
    assert.equal(crewCount({ hull, shipClass: classById(cls), crewShare: share }), crewRoster({ hull, seed: 3, shipClass: classById(cls), crewShare: share }).length);
  }
  for (const crew of [0, 3, 10, 24, 60]) assert.equal(crewCount({ hull: 3, crew }), crewRoster({ hull: 3, seed: 3, crew }).length);
});

test('LIVING CREW WHERE THEY STAND: her own flats\' places first - one off her deck a station (her helmsman on the poop, never walking), one on it a walker starting there - the rest spread across her deck (mutants: the stations walk, the places unread)', () => {
  const deck = plainDeck();
  const life = createCrewLife({ deck, roster: crewRoster({ hull: 2, seed: 4, shipClass: pirate }), seed: 4, places: [[1, 2, 3], [5.5, 3.2, -11]] });
  assert.equal(deck.walkable(0, 0), false, 'her mast');
  const [helm, walker, ...rest] = [life.members.find((x) => x.station), life.members.find((x) => !x.station && x.post[2] === 3), ...life.members];
  assert.ok(helm && helm.station && helm.post[0] === 5.5, 'the one off her deck is a station');
  assert.ok(walker && walker.pos[0] === 1, 'the one on it starts a walker there');
  assert.equal(life.members.filter((x) => x.station).length, 1);
  assert.ok(rest.every((x) => x.station || deck.walkable(x.pos[0], x.pos[2])));
  const post = [...helm.pos];
  run(life, 120);
  assert.deepEqual(helm.pos, post, 'a station keeps his post');
});

// ── their work ───────────────────────────────────────────────────────────────────────────────────────────────────

test('LIVING CREW AT THEIR WORK: five minutes on deck - every walker on her deck at every step, walking and standing and talking; a talk\'s lines alternate between the two, first to last, each facing the other; a man\'s own words spaced; a chanty sung - the leader\'s verse (a Bard\'s when she has one), the whole crew\'s chorus (mutants: a walker off her deck, the talk\'s turns unread, the chanty\'s chorus the leader\'s alone, the blurbs unspaced)', () => {
  const deck = plainDeck();
  const roster = crewRoster({ hull: 3, seed: 21, crew: 60 });
  roster[1] = { mobile: MOBILE.Bard, gender: 'female' };
  const life = createCrewLife({ deck, roster, seed: 21 });
  const seen = new Set(), talk = [], verses = [], chorus = new Set(), blurbs = new Map();
  let t = 0;
  run(life, 300, {}, (l) => {
    t += 0.05;
    for (const m of l.members) {
      seen.add(m.state);
      assert.ok(deck.walkable(m.pos[0], m.pos[2]), `on her deck: ${m.pos}`);
    }
    for (const x of l.speech()) {
      const key = `${x.member.i}:${x.text}`;
      if (x.kind === 'sing') { if (x.text === sung(CHANTIES.find((c) => c.verses.some((v) => sung(v) === x.text) || sung(c.chorus) === x.text).chorus)) chorus.add(x.member.i); else if (!verses.includes(key)) verses.push(key); }
      else if (CREW_TALKS.some((s) => s.includes(x.text))) { if (!talk.some((q) => q.key === key && t - q.t < CREW_LINE_S * 1.1)) talk.push({ key, t, i: x.member.i, text: x.text, mate: x.member.mate }); }
      else { const was = blurbs.get(x.member.i); if (!was || t - was.t > CREW_LINE_S * 1.2) { if (was) assert.ok(t - was.t >= CREW_BLURB_S[0] * 0.4 - 1e-6, 'a man\'s words spaced'); blurbs.set(x.member.i, { t }); } }
    }
  });
  for (const s of ['idle', 'walk', 'talk']) assert.ok(seen.has(s), `seen ${s}`);
  assert.ok(talk.length >= 4, `talks: ${talk.length}`);
  // a talk's first two lines: one man, then the other
  const first = talk.find((q) => CREW_TALKS.some((s) => s[0] === q.text));
  const script = CREW_TALKS.find((s) => s[0] === first.text);
  const answer = talk.find((q) => q.text === script[1] && q.t > first.t);
  assert.ok(answer && answer.i !== first.i, 'the other man answers');
  assert.ok(verses.length >= 2, 'a chanty\'s verses');
  assert.ok(verses.every((k) => Number(k.split(':')[0]) === 1), 'the Bard leads');
  assert.ok(chorus.size >= 3, `the crew sings the chorus: ${chorus.size}`);
  assert.ok(blurbs.size >= 3, 'their own words');
});

test('LIVING CREW THE GUNS AND THE GRAPPLE: her guns out - no song, the battle\'s words, a hurry from post to post; a grapple thrown - every man to the rail on that side, spread fore and aft, facing out, shouting; stations stay at their posts; the grapple over, back to work (mutants: the muster\'s side unread, the facing unread, a song under the guns)', () => {
  const deck = plainDeck();
  const roster = crewRoster({ hull: 3, seed: 5, shipClass: pirate });
  const life = createCrewLife({ deck, roster, seed: 5, places: [[5.5, 3, -11]] });
  const said = new Set();
  let hurried = false;
  run(life, 90, { battle: true }, (l) => {
    assert.equal(l.singing(), false, 'no song under the guns');
    for (const x of l.speech()) said.add(x.text);
    for (const m of l.members) if (m.state === 'walk' && m.speed === CREW_HURRY) hurried = true;
  });
  assert.ok([...said].every((w) => CREW_BLURBS.battle.includes(w) || CREW_BLURBS.pirate.includes(w)), 'the battle\'s words');
  assert.ok(hurried, 'at a run');
  for (const [n, m] of life.members.entries()) if (!m.station) { m.pos = [-1 + (n % 3), 2, 5 + n * 0.2]; m.path = null; m.state = 'idle'; }   // a knot of them amidships
  const shouts = new Set();
  let into = 0;
  // PIN MOVED (CREW-MUSTER, FIELD BUGS 2026-10-14): a grapple thrown names her side of it - here she is boarded
  run(life, 25, { muster: -1, way: 'repel' }, (l) => { into += 0.05; if (into > CREW_LINE_S) for (const x of l.speech()) shouts.add(x.text); });   // a word already said fades on
  const ext = deckExtentZ(deck);
  const walkers = life.members.filter((m) => !m.station);
  for (const m of walkers) {
    assert.equal(m.state, 'ready');
    assert.ok(m.pos[0] < -3, `at the port rail: ${m.pos}`);
    assert.ok(Math.abs(((m.yaw + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) < 0.05 || Math.abs(m.yaw + Math.PI / 2) < 0.05, `facing out: ${m.yaw}`);
  }
  const zs = walkers.map((m) => m.pos[2]).sort((a, b) => a - b);
  assert.ok(zs.at(-1) - zs[0] > (ext[1] - ext[0]) * 0.5, 'spread fore and aft');
  for (let i = 1; i < zs.length; i++) assert.ok(zs[i] - zs[i - 1] > (ext[1] - ext[0]) / walkers.length * 0.5, `evenly along her rail: ${zs.map((z) => z.toFixed(1))}`);
  assert.ok(shouts.size > 0 && [...shouts].every((w) => CREW_BLURBS.repel.includes(w)), `the repel's words: ${[...shouts]}`);
  assert.ok(life.members.find((m) => m.station).pos[0] === 5.5, 'the station at his post');
  run(life, 1, {});
  assert.ok(life.members.every((m) => m.state !== 'ready'), 'the grapple over');
});

test('LIVING CREW THE ONE TO AVOID, AND THE CREW TAKEN: a walker waits while the player stands in his next step and goes elsewhere after CREW_BLOCKED_S; a fight takes her crew in the roster\'s order - a party passing her captain by - each as he stands; the guns thin her from the last, never her first (mutants: walked through, the order unread, the captain sent over, the trim from the first)', () => {
  const deck = plainDeck();
  const life = createCrewLife({ deck, roster: crewRoster({ hull: 3, seed: 8, shipClass: pirate }), seed: 8 });
  const m = life.members[2];
  m.state = 'walk'; m.path = [[0, 2, -8], [0, 2, 8]]; m.leg = 1; m.pos = [0, 2, -8]; m.speed = CREW_WALK;
  const avoid = [0, 2, -7];
  for (let t = 0; t < CREW_BLOCKED_S - 0.2; t += 0.05) { life.step(0.05, { avoid }); assert.ok(Math.abs(m.pos[2] + 8) < 1e-9, 'waits'); }
  run(life, 0.5, { avoid });
  assert.notEqual(m.path?.[1]?.[2], 8, 'gone elsewhere');
  const before = life.members.map((x) => ({ mobile: x.mobile, pos: [...x.pos] }));
  const party = life.take(2, { from: 1 });
  assert.deepEqual(party.map((p) => p.mobile), [before[1].mobile, before[2].mobile], 'her men, never her captain');
  assert.deepEqual(party[0].pos, before[1].pos, 'as he stands');
  assert.equal(life.standing(), life.members.length - 2);
  const all = life.take(Infinity);
  assert.equal(all[0].mobile, before[0].mobile, 'the rest, her captain first');
  assert.equal(life.standing(), 0);
  assert.deepEqual(life.speech(), []);
  const other = createCrewLife({ deck, roster: crewRoster({ hull: 3, seed: 9, shipClass: pirate }), seed: 9 });
  other.trim(2);
  assert.equal(other.standing(), 2);
  assert.ok(!other.members[0].gone && !other.members[1].gone, 'the last go first');
});

// ── the host ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The host over a stand-in renderer and textures - its batches, the frames it asked for. */
function host() {
  const made = [], destroyed = [], uploads = [];
  const renderer = { createBillboardBatch: (archive) => { const b = { archive }; made.push(b); return b; }, destroyBillboardBatch: (b) => destroyed.push(b), textures: new Map() };
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20 };
  const crew = createNavalCrew({ renderer, getTexture: async () => tex, uploadRecordFrame: (a, r, f) => uploads.push([a, r, f]), rand: () => 0.3 });
  return { crew, made, destroyed, uploads };
}
const settle = () => new Promise((r) => setTimeout(r, 0));
const smallShip = () => { const b = new Boat(2, 0); spawnBoat(b, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] })); return b; };
const entry = (boat, deck, o = {}) => ({ key: 'ship:1', boat, deck, count: 6, rosterOf: () => crewRoster({ hull: 2, seed: 3, shipClass: pirate }), seed: 3, faction: 'pirate', battle: false, ...o });

test('LIVING CREW THE HOST: a ship in range stands her crew as mobile units - the mod\'s people flats on and above her deck standing down in their places, never the ones below it; each man carried out of her deck by her mesh node (her way, her turn, her roll), his head over him, his sprite\'s frame asked for; out of the list, stood down - the flats back, the sprites gone (mutants: the flats left up, the rowers taken, the carry by the root, the flats never back)', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const boat = smallShip();
  const flats = peopleFlatsOf(boat);
  const main = mainLevel(deck);
  assert.ok(Math.abs(main - 6.2) < 0.1, `her main deck: ${main}`);   // PIN MOVED (GALLEON, 2026-10-01): the new galleon's
  const below = flats.filter((f) => f.feet[1] < main - DECK_STEP), onDeck = flats.filter((f) => f.feet[1] >= main - DECK_STEP);
  assert.ok(below.length >= 1 && onDeck.length >= 4, `flats: ${onDeck.length} on or above her deck, ${below.length} below`);
  const h = host();
  h.crew.sync([entry(boat, deck)]);
  assert.ok(onDeck.every((f) => f.renderer.m_Enabled === false), 'the flats on her deck stand down');
  assert.ok(below.every((f) => f.renderer.m_Enabled !== false), 'the rowers below never');
  await settle();
  const ship = h.crew.ships()[0];
  assert.equal(ship.life.members.length, 6);
  // her roll and her way: each man where his deck point is now
  boat.GameObject.position = [30, 0.4, -12];
  boat.GameObject.rotation = [0, Math.sin(0.4), 0, Math.cos(0.4)];
  boat.MeshObject.localRotation = [Math.sin(0.08), 0, 0, Math.cos(0.08)];
  h.crew.frame(0.05, [0, 10, 0]);
  const m = boat.MeshObject.worldMatrix();
  const batches = h.crew.batches();
  assert.equal(batches.length, 6);
  for (const [member, s] of ship.sprites) {
    const want = outOfDeck(m, member.pos);
    assert.ok(s.origin.every((v, i) => Math.abs(v - want[i]) < 1e-9), 'carried by her mesh node');
    assert.ok(s.head[1] > s.origin[1] + 1, 'his head over him');
    assert.match(s.batch.record, /^\d+#\d+$/);
  }
  assert.ok(h.uploads.length > 0, 'the frames asked for');
  h.crew.sync([]);
  assert.ok(onDeck.every((f) => f.renderer.m_Enabled !== false), 'stood down: the flats back');
  assert.equal(h.destroyed.length, 6, 'the sprites gone');
  assert.equal(h.crew.batches().length, 0);
});

test('LIVING CREW TAKEN, HELD, THINNED: a fight takes her men off her deck as they stand in the world (their sprites gone); a held crew (a prize, another\'s fight) - her flats stay down and nobody stands; the guns thin her to her count; the fight\'s end stands mine again whole (mutants: take in her frame, the hold unread, the count unread, the reset unread)', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const boat = smallShip();
  boat.GameObject.position = [100, 0, 50];
  const h = host();
  h.crew.sync([entry(boat, deck)]);
  await settle();
  h.crew.frame(0.05, [0, 10, 0]);
  const ship = h.crew.ships()[0];
  const first = ship.life.members[0];
  const taken = h.crew.takeByBoat(boat, 2);
  assert.equal(taken.length, 2);
  // AUDIT NAV2 F35 PIN MOVED: her captain at the wheel on the poop is off her deck - taken at the deck point nearest him
  const at = deck.clamp(first.pos[0], first.pos[2]);
  assert.ok(Math.abs(taken[0].feet[0] - (at[0] + 100)) < 1e-6 && Math.abs(taken[0].feet[2] - (at[2] + 50)) < 1e-6, 'where he stands in the world');
  assert.equal(taken[0].mobile, first.mobile);
  assert.equal(h.crew.batches().length, 4, 'their sprites gone');
  h.crew.sync([entry(boat, deck, { count: 3 })]);
  assert.equal(ship.life.standing(), 3, 'thinned to her count');
  h.crew.sync([entry(boat, deck, { hold: true })]);
  assert.equal(ship.life.standing(), 0, 'held: nobody stands');
  h.crew.sync([]);
  const fresh = smallShip();
  h.crew.sync([{ ...entry(fresh, deck, { hold: true }), key: 'ship:2' }]);
  assert.ok(peopleFlatsOf(fresh).filter((f) => f.feet[1] >= mainLevel(deck) - DECK_STEP).every((f) => f.renderer.m_Enabled === false), 'a held ship\'s flats stay down');
  assert.equal(h.crew.ships()[0].life.members.length, 0);
  h.crew.reset('ship:2');
  assert.equal(h.crew.has('ship:2'), false, 'forgotten - the next sync stands her again');
  assert.ok(CREW_KEEP > CREW_RANGE, 'kept past the range it stands at');
});

// ── the boarding, seamless ───────────────────────────────────────────────────────────────────────────────────────

/** A sea with the world's crew doors stood in: `crew` the men each boat's crew hands over, the landing and the rails. */
async function crewSea(o = {}) {
  const h = await sea({ hull: 2, ...o });
  h.boat.crewed = true;
  const asked = { crewOf: [], landing: [], rail: [] };
  const men = (n, x) => Array.from({ length: n }, (_, i) => ({ mobile: [MOBILE.Rogue, MOBILE.Barbarian, MOBILE.Bard, MOBILE.Archer][i % 4], gender: i % 2 ? 'female' : 'male', feet: [x, 7, i], yaw: 0.5 }));
  h.deps.board.crewOf = (boat, n, opts) => { asked.crewOf.push([boat === h.boat ? 'mine' : 'hers', n, opts ?? null]); return boat === h.boat ? men(Math.min(n, 3), -1) : men(Math.min(n, 4), 20); };
  h.deps.board.landing = (boat, feet) => { asked.landing.push(feet); return [[18, 7, 0], 1.2]; };
  h.deps.board.railSpots = (boat, toward, n) => { asked.rail.push([boat === h.boat ? 'mine' : 'hers', n]); return Array.from({ length: n }, (_, i) => [[boat === h.boat ? 2 : 17, 7, i], 0]); };
  return { h, asked };
}

test('LIVING CREW SEAMLESS BOARDING: her muster fights where her crew stands - each man his class, his sex and his place, the rest up from below; I land across from where I stood; my hands are my own crew, landed at her rail across from my ship (mutants: the crew\'s places unread, the landing unread, the hands a Warrior\'s, the hands\' rail unread)', async () => {
  const { h, asked } = await crewSea();
  const id = h.host.spawnShip('merchantGalleon', { range: 26.8, bearing: Math.PI / 2, yaw: 0 });
  const e = h.host._sea.get(id);
  e.ship.pos = [26.8, 0, 0];
  h.host.frame(0.1);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  h.host.frame(0.1);
  assert.equal(h.host.activate(), true);
  h.run(GRAPPLE_S + 0.3);
  assert.equal(h.host.boarding?.phase, 'fight');
  assert.deepEqual(h.log.placed.at(-1), [[18, 7, 0], 1.2], 'landed across from where I stood');
  const enemies = h.log.foes.filter((f) => f.side === 'enemy'), hands = h.log.foes.filter((f) => f.side === 'ally');
  assert.deepEqual(asked.crewOf[0], ['hers', Infinity, null], 'her whole standing crew');
  assert.deepEqual(enemies.slice(0, 4).map((f) => f.pos), [0, 1, 2, 3].map((i) => [20, 7, i]), 'where they stood');
  assert.ok(enemies.length > 4 && enemies.slice(4).every((f) => f.pos[0] !== 20), 'the rest up from below');
  const muster = musterOf(e.ship.cls, e.ship.damage.crewShare());
  // AUDIT NAV2 F44: PIN MOVED - each man stands as HIMSELF where he stood (the stand-in crew's own classes), and only
  // the men up from below take the muster's next classes (the muster's order was pinned over the man's own)
  assert.deepEqual(enemies.map((f) => f.mobile), [MOBILE.Rogue, MOBILE.Barbarian, MOBILE.Bard, MOBILE.Archer, ...[muster.captain, ...muster.men].slice(4)], 'each man his own class, the rest her muster\'s');
  assert.ok(hands.length > 0);
  assert.deepEqual(hands.slice(0, 3).map((f) => f.mobile), [MOBILE.Rogue, MOBILE.Barbarian, MOBILE.Bard].slice(0, hands.length), 'my own crew');
  assert.ok(hands.every((f) => f.pos[0] === 17), 'at her rail across from my ship');
  assert.ok(hands.slice(3).every((f) => f.mobile === HAND), 'a hand beyond my standing crew is a Warrior');
});

test('LIVING CREW SEAMLESS REPEL: her party is her own men (never her captain), over my rail across from her; my hands stand to where they stand, as themselves (mutants: the captain sent over, the rail unread, the hands moved)', async () => {
  const { h, asked } = await crewSea({ save: { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] } });
  const id = h.host.spawnShip('pirateBrig', { range: 16, bearing: Math.PI / 2, yaw: 0 });
  h.host._sea.get(id).ship.pos = [16, 0, 0];
  h.host.frame(0.1);
  h.run(0.5);
  assert.equal(h.host.boarding?.kind, 'repel');
  h.run(GRAPPLE_S + 0.2);
  const party = h.log.foes.filter((f) => f.side === 'enemy'), hands = h.log.foes.filter((f) => f.side === 'ally');
  assert.deepEqual(asked.crewOf.find((c) => c[0] === 'hers').slice(2), [{ from: 1 }], 'never her captain');
  assert.ok(party.length > 0 && party.every((f) => f.pos[0] === 2), 'over my rail across from her');
  assert.deepEqual(party.slice(0, 4).map((f) => f.mobile), [MOBILE.Rogue, MOBILE.Barbarian, MOBILE.Bard, MOBILE.Archer].slice(0, party.length), 'her own men');
  assert.ok(hands.length > 0);
  assert.deepEqual(hands.slice(0, 3).map((f) => f.pos), [0, 1, 2].slice(0, hands.length).map((i) => [-1, 7, i]), 'my hands where they stand');
});

test('LIVING CREW THE SEA\'S CREWS: every ship with her boat built, afloat, struck or taken - her class, her crew\'s share, her seed - her guns out when she engages, runs or answers; a prize\'s crew held, and a ship another boards in a room; my boat\'s crew and her fight (mutants: the prize unheld, the battle unread)', async () => {
  const h = await sea({ hull: 2 });
  const id = h.host.spawnShip('pirateBrig', { range: 300, bearing: 0 });
  const e = h.host._sea.get(id);
  h.host.frame(0.1);
  const c = h.host.crewShips().find((x) => x.key === id);
  assert.ok(c && c.boat === e.boat && c.shipClass === e.ship.cls && c.seed === e.ship.seed && c.faction === 'pirate');
  e.ship.mode = 'cruise';
  assert.equal(h.host.crewShips().find((x) => x.key === id).battle, false);
  e.ship.mode = 'engage';
  assert.equal(h.host.crewShips().find((x) => x.key === id).battle, true);
  assert.equal(h.host.crewShips().find((x) => x.key === id).hold, false);
  e.ship.boarded = true;   // another's boarding, in a room
  assert.equal(h.host.crewShips().find((x) => x.key === id).hold, true);
  e.ship.boarded = false;
  e.ship.damage.takePrize();
  assert.equal(h.host.crewShips().find((x) => x.key === id).hold, true, 'a prize\'s crew held');
  e.ship.damage.scuttle();
  // AUDIT NAV2 F45 PIN MOVED: a ship going down keeps her living crew aboard to the end, her colours down (the decision)
  const going = h.host.crewShips().find((x) => x.key === id);
  assert.ok(!!going && going.struck === true && going.battle === false, 'a ship going down, her colours down');
  assert.equal(h.host.boatOf(id), e.boat);
  const mine = h.host.myCrew(h.boat);
  assert.ok(mine && mine.crew > 0 && typeof mine.battle === 'boolean');
});

test('LIVING CREW THE LANDING AND THE RAIL, lifted from the world host over the Small Ship\'s real deck: a boarder lands on her deck\'s point nearest where he stood - her edge across from him, never her middle - facing her middle; a party\'s places are along her rail on the side the other ship lies, spread fore and aft round the point across from her (mutants: the landing her middle, the side unread)', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const boat = smallShip();
  const line = (start) => { const i = WORLD.indexOf(start); assert.ok(i >= 0, start); return WORLD.slice(i, WORLD.indexOf('\n', i) + 1); };
  const fn = (name) => { const m = new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n  \\}\\n`).exec(WORLD); assert.ok(m, name); return m[0]; };
  // PIN MOVED (AUDIT NAV2 F33): the deck point's ray starts under her deck's headroom - DECK_HEADROOM in the lifted scope;
  // AUDIT GALLEON D2 (2026-10-02): her rail asked at her main level - mainLevel in it too
  const body = `const { intoDeck, outOfDeck, DECK_HEADROOM, csa, raycastColliders, csaColliderMesh, mainLevel } = s;
    ${line('  const navalDeckToWorld = (boat, p, out) =>')}${line('  const navalWorldToDeck = (boat, p, out) =>')}${line('  const NAVAL_RAIL_GAP =')}
    ${fn('navalDeckPoint')}${fn('navalDeckLanding')}${fn('navalRailSpots')}
    return { navalDeckLanding, navalRailSpots };`;
  // eslint-disable-next-line no-new-func
  const w = new Function('s', body)({ intoDeck, outOfDeck, DECK_HEADROOM, csa: { deckOf: () => deck }, raycastColliders: () => null, csaColliderMesh: null, mainLevel });
  const [feet, yaw] = w.navalDeckLanding(boat, [14, 8, 2]);
  assert.ok(deck.walkable(feet[0], feet[2]) && feet[0] > 3, `her edge across from him: ${feet}`);
  assert.ok(Math.abs(feet[2] - 2) < 0.5, 'across from where he stood');
  assert.ok(Math.cos(yaw - Math.atan2(-feet[0], -feet[2] + deck.nearest(0, 0)[2])) > 0.9, 'facing her middle');
  const rail = w.navalRailSpots(boat, [-40, 0, 4], 5);
  assert.equal(rail.length, 5);
  assert.ok(rail.every(([f]) => f[0] < -3 && deck.walkable(f[0], f[2])), 'her port rail, where the other ship lies');
  const zs = rail.map(([f]) => f[2]).sort((a, b) => a - b);
  assert.ok(zs[0] < 4 && zs.at(-1) > 4 && zs.at(-1) - zs[0] > 3, 'spread fore and aft round the point across from her');
  assert.ok(w.navalRailSpots(boat, [40, 0, -2], 3).every(([f]) => f[0] > 3), 'and her starboard rail when she lies there');
});

// ── the words, and the world ─────────────────────────────────────────────────────────────────────────────────────

test('LIVING CREW THE WORDS: a bubble a line over his head at the HUD\'s scale - the nearest CREW_SAY_MAX, a song\'s in the song\'s own look, a shout\'s in its own - fading with the distance to CREW_SAY_RANGE; one node a slot, moved and re-worded, never rebuilt; a window over the world hides them all (mutants: every line drawn, rebuilt each frame, never hidden, the fade unread)', () => {
  destroyNavalHud();
  // FIELD BUGS 2026-10-02b PIN MOVED: the heads 500 px down, the stack's room over them - a lifted bubble over the screen's top is not drawn
  const pts = Array.from({ length: 8 }, (_, i) => ({ x: 100 + i * 10, y: 500, text: `line ${i}`, kind: i === 0 ? 'sing' : i === 1 ? 'shout' : 'talk', distance: 5 + i * 3 }));
  drawCrewLines(pts, { scale: 1.5 });
  const [layer] = byClass(globalThis.document.body, 'dfnaval-tags');
  const says = byClass(layer, 'dfnaval-say');
  assert.equal(says.length, CREW_SAY_MAX, 'the nearest six');
  assert.deepEqual(says.map((n) => n.textContent), pts.slice(0, CREW_SAY_MAX).map((p) => p.text));
  assert.deepEqual(says.slice(0, 3).map((n) => n.className), ['dfnaval-say sing', 'dfnaval-say shout', 'dfnaval-say']);
  assert.equal(says[0].style.transform, `translate(100px, 500px) scale(1.5) translate(-50%, calc(-100% - ${CREW_SAY_LIFT}px))`);   // CREW-SAY: the nearest at its own place, its foot clear of a bar and a mate's name
  assert.equal(says[5].style.opacity, String(Math.round(tagAlpha(20, CREW_SAY_RANGE, CREW_SAY_FADE_FROM) * 100) / 100));
  assert.equal(says[0].style.opacity, '1');
  drawCrewLines([{ ...pts[0], text: 'again', x: 120 }], { scale: 1.5 });
  const again = byClass(layer, 'dfnaval-say');
  assert.equal(again[0], says[0], 'the same node');
  assert.equal(again[0].textContent, 'again');
  assert.equal(again[1].style.display, 'none');
  drawCrewLines(pts, { covered: true });
  assert.ok(byClass(layer, 'dfnaval-say').every((n) => n.style.display === 'none'), 'covered: all hidden');
  destroyNavalHud();
});

test('LIVING CREW THE WORLD by source: the crews stepped before the people are drawn, their sprites among them; the words after the bars; every clear stands them down; the fight\'s end brings my hands home; a grapple\'s side each crew\'s own, her other ship by the host\'s door; me never walked through; a room\'s boat seeded by whose and which; the boarding\'s doors (mutants: each unwired)', () => {
  assert.match(WORLD, /navalCrewFrame\(gamePaused\(\) \? 0 : foeDt\);[^\n]*\n\s+livePersonBatches\.push\(\.\.\.exteriorFoes\.batches\(\), \.\.\.navalCrew\.batches\(\)\);/);   // AUDIT NAV2 F53 PIN MOVED: held by a pause
  assert.match(WORLD, /navalCrewBars\(proj, view, mwv\.eye\);[^\n]*\n\s+navalCrewLines\(proj, view, mwv\.eye, dt\);/);   // FIELD BUGS 2026-10-02b PIN MOVED: the frame's dt, the lifts' ease
  assert.match(WORLD, /navalFlames\.clear\(\); navalCrew\.clear\(\);[^\n]*drawCrewLines\(\[\]\); lowerGlass\(\); \};/);   // AUDIT CAPTAIN'S SEA S1 PIN MOVED: and the glass lowered after the crews
  assert.match(WORLD, /if \(_crewBoarding && !b\) for \(const boat of csa\.boats\) navalCrew\.reset\(boat\);/);
  assert.match(WORLD, /const other = grapple \? \(key === grapple\.shipId \? grapple\.boat : key === grapple\.boat \? naval\.boatOf\(grapple\.shipId\) : null\) : null;/);
  assert.match(WORLD, /_crewCtx\.muster = _crewThem\[0\] >= 0 \? 1 : -1;/);
  assert.match(WORLD, /intoDeck\(m, player\.pos, _crewMe\);/);
  assert.match(WORLD, /seed = _crewSeed\(boat\.peerKey \?\? ''\);/);
  assert.match(WORLD, /crewOf: \(boat, n, opts\) => navalCrew\.takeByBoat\(boat, n, opts\),\n\s+landing: \(boat, feet\) => navalDeckLanding\(boat, feet\),\n\s+railSpots: \(boat, toward, n\) => navalRailSpots\(boat, toward, n\),/);
  assert.match(WORLD, /allied: side === 'ally', team: side === 'ally' \? null : team, \.\.\.\(gender \? \{ gender \} : \{\}\) \}\)/, 'a crewman stood as himself');
  assert.match(readFileSync(new URL('../../../src/scenes/comeSailAway/comeSailAwayPeers.js', import.meta.url), 'utf8'), /if \(boat\) \{ boat\.peerKey = `\$\{owner\}:\$\{i\}`;/);
});
