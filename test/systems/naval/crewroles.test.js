// HOLDINGS - CREW ROLES (2026-10-03, Mac: "Named crew companions should be able to be assigned to certain roles, and be
// positioned accordingly to their role" - bible/03-World/Holdings.md 8). A hand given a post (systems/naval/shipCrew.js
// assign - CREW_ROLES, a Bard's calling his own, one First Mate); each keeps his role's post on her main deck
// (systems/naval/crewLife.js ROLE_POSTS - her First Mate aft by her helm, her Bosun before her mainmast, her Carpenter by
// her hatch, her Cook forward, her Gunners at her guns along her waist, under fire at a run); the hand made First Mate
// answers for her (scenes/naval/navalHost.js mateOf); the Fleet page's Crew panel (ui/fleetPage.js) over the host half.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createShipCrew, CREW_ROLES, ROLES, FIRST_MATE } from '../../../src/systems/naval/shipCrew.js';
import { createCrewLife, crewRoster, ROLE_POSTS, POST_REACH } from '../../../src/systems/naval/crewLife.js';
import { MOBILE } from '../../../src/systems/naval/navalBoarding.js';
import { sea, readyPool } from '../../navalSea.mjs';
import { firstBuildOf, hullBuild } from '../../../src/systems/naval/navalShips.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ROSTER = [{ mobile: MOBILE.Warrior, gender: 'male' }, { mobile: MOBILE.Barbarian, gender: 'female' }, { mobile: MOBILE.Bard, gender: 'male' },
  { mobile: MOBILE.Archer, gender: 'female' }, { mobile: MOBILE.Warrior, gender: 'male' }, { mobile: MOBILE.Monk, gender: 'male' }];

test('CREW-ROLES the posts a captain gives: her First Mate and the roles dealt; a Bard\'s calling his alone; one First Mate - the one she had stands down to Deckhand; an unknown hand or post refused; kept in her crew\'s record (mutants: the one-mate law, the Bard\'s gate, the post list)', () => {
  assert.deepEqual([...CREW_ROLES], ['First Mate', 'Bosun', 'Gunner', 'Carpenter', 'Lookout', 'Cook', 'Deckhand']);
  assert.deepEqual([...CREW_ROLES.slice(1)], [...ROLES]);
  const c = createShipCrew({ seed: 9 });
  c.sync(ROSTER);
  const [mate, a, bard, b] = c.hands;
  assert.equal(mate.role, FIRST_MATE);
  assert.equal(bard.role, 'Bard');
  assert.equal(b.role, 'Gunner', 'dealt in turn after the First Mate and past the Bard');
  assert.deepEqual(c.assign(b.name, 'Lookout'), { ok: true, text: `${b.name} is now the Lookout.` });
  assert.deepEqual(c.assign(b.name, 'Lookout'), { ok: true, text: `${b.name} is already the Lookout.` });
  assert.deepEqual(c.assign(a.name, FIRST_MATE), { ok: true, text: `${a.name} is now the First Mate.` });
  assert.equal(mate.role, 'Deckhand', 'the First Mate she had stands down');
  assert.equal(c.hands.filter((h) => h.role === FIRST_MATE).length, 1);
  assert.deepEqual(c.assign(a.name, 'Bard'), { ok: false, text: 'There\'s no such post on this ship.' }, 'a Bard\'s calling is a Bard\'s');
  assert.deepEqual(c.assign(bard.name, 'Cook'), { ok: true, text: `${bard.name} is now the Cook.` });
  assert.deepEqual(c.assign(bard.name, 'Bard'), { ok: true, text: `${bard.name} is now the Bard.` }, 'given back');
  assert.deepEqual(c.assign(b.name, 'Admiral'), { ok: false, text: 'There\'s no such post on this ship.' });
  assert.deepEqual(c.assign('Nobody', 'Cook'), { ok: false, text: 'There\'s no crew member by that name aboard.' });
  const again = createShipCrew({ seed: 9, record: JSON.parse(JSON.stringify(c.snapshot())) });
  assert.deepEqual(again.hands.map((h) => h.role), c.hands.map((h) => h.role), 'her record keeps them');
});

async function smallShip() {
  const pool = await readyPool();
  return pool.deckOf(2, 0);
}
const dist = (m, p) => Math.hypot(m.pos[0] - p[0], m.pos[2] - p[2]);

test('CREW-ROLES her posts on her main deck: her First Mate aft by her helm, her Bosun before her mainmast, her Cook forward, her Carpenter beside her hatch, her Gunners at her rails along her waist starboard and port in turn, facing out; a second holder of a post beside the first; none for her Lookout (her bow), a Deckhand or a Bard', async () => {
  const deck = await smallShip();
  const roles = ['First Mate', 'Gunner', 'Carpenter', 'Lookout', 'Cook', 'Gunner', 'Bosun', 'Bosun'];
  const roster = [...ROSTER, { mobile: MOBILE.Warrior, gender: 'male' }, { mobile: MOBILE.Rogue, gender: 'female' }];
  const life = createCrewLife({ deck, roster, seed: 3 });
  life.step(0.05, { roles, lookout: 3 });
  const p = (i) => life.postOf(i);
  assert.deepEqual([...ROLE_POSTS], ['First Mate', 'Bosun', 'Carpenter', 'Cook', 'Gunner']);
  assert.ok(p(0).at[2] < p(6).at[2] && p(6).at[2] < p(4).at[2], `helm ${p(0).at[2]} < mast ${p(6).at[2]} < galley ${p(4).at[2]}`);
  assert.deepEqual([p(0).face, p(6).face, p(4).face], [0, 0, Math.PI]);
  assert.ok(dist({ pos: p(2).at }, life.hatch) < 3, 'the Carpenter by her hatch');
  const all = [0, 1, 2, 4, 5, 6, 7].map((i) => p(i).at);
  for (const a of all) for (const b of all) if (a !== b) assert.ok(Math.hypot(a[0] - b[0], a[2] - b[2]) >= 0.99, 'every post a place of its own');
  assert.ok(p(1).at[0] > 0.5 && p(5).at[0] < -0.5, `her Gunners starboard then port: ${p(1).at[0]}, ${p(5).at[0]}`);
  assert.deepEqual([p(1).face, p(5).face], [Math.PI / 2, -Math.PI / 2], 'facing out over the rail');
  assert.ok(Math.abs(p(7).at[0] - p(6).at[0]) >= 0.9, 'the second Bosun beside the first');
  assert.equal(p(3), null, 'her Lookout\'s is her bow');
  for (const i of [0, 1, 2, 4, 5, 6, 7]) assert.ok(deck.walkable(p(i).at[0], p(i).at[2]), `post ${i} on her deck`);
  const none = createCrewLife({ deck, roster: ROSTER, seed: 3 });
  none.step(0.05, { roles: ['Deckhand', 'Bard', 'Deckhand', 'Deckhand', 'Deckhand', 'Deckhand'] });
  assert.equal(none.postOf(0), null);
  assert.equal(none.postOf(1), null);
});

test('CREW-ROLES each keeps to his post: over five calm minutes her First Mate, Carpenter, Cook and Gunner stand at theirs much of the time - the same crew with no roles hardly ever at those places; a Deckhand has none; under fire her Gunner holds his gun (mutants: the share, the reach, the battle\'s guns)', async () => {
  const deck = await smallShip();
  const roles = ['First Mate', 'Deckhand', 'Carpenter', 'Lookout', 'Cook', 'Gunner'];
  const kept = [0, 2, 4, 5];
  for (const seed of [7, 3, 11]) {
    const life = createCrewLife({ deck, roster: ROSTER, seed });
    life.step(0.05, { roles, lookout: 3 });
    const posts = kept.map((i) => life.postOf(i).at);
    const control = createCrewLife({ deck, roster: ROSTER, seed });
    const at = [0, 0, 0, 0], ctl = [0, 0, 0, 0], N = 3000;
    for (let k = 0; k < N; k++) {
      life.step(0.1, { roles, lookout: 3 });
      control.step(0.1, { lookout: 3 });
      kept.forEach((i, j) => { if (dist(life.members[i], posts[j]) <= POST_REACH * 2) at[j]++; if (dist(control.members[i], posts[j]) <= POST_REACH * 2) ctl[j]++; });
    }
    kept.forEach((i, j) => {
      assert.ok(at[j] / N > 0.3, `seed ${seed}: her ${roles[i]} at his post ${(at[j] / N).toFixed(2)}`);
      assert.ok(ctl[j] / N < 0.1, `seed ${seed}: with no roles, at that place ${(ctl[j] / N).toFixed(2)}`);
    });
    // PIN MOVED (AUDIT HOLDINGS T4): the bar was POST_SHARE * 0.6 - a share mutated lowered its own bar; measured 0.73-0.78
    assert.ok(at.reduce((a, b) => a + b, 0) / (N * kept.length) > 0.6, 'her posts kept, most of the time');
    assert.equal(life.postOf(1), null, 'a Deckhand\'s own place - never a post');
  }
  // under fire her Gunner holds his gun
  const fight = createCrewLife({ deck, roster: ROSTER, seed: 7 });
  let gun = 0;
  for (let k = 0; k < 1200; k++) { fight.step(0.1, { roles, lookout: 3, battle: true }); if (dist(fight.members[5], fight.postOf(5).at) <= POST_REACH * 2) gun++; }
  assert.ok(gun / 1200 > 0.8, `her Gunner at his gun under fire ${(gun / 1200).toFixed(2)}`);
});

test('CREW-ROLES the hand made her First Mate answers for her - her repairs\' words in his name (mateOf: her First Mate aboard first, else her first aboard)', async () => {
  const first = firstBuildOf(2);
  const save = { v: 2, boats: { 42: { hull: first.hullHp * 0.2, sail: first.sailHp, maxHull: first.hullHp, maxSail: first.sailHp, crew: hullBuild(2).crew, fire: 0, state: SHIP_STATES.afloat, credit: 0, barrels: 0 } } };
  const s = await sea({ hull: 2, save });
  const hands = s.host.crewHands(s.boat);
  assert.ok(hands.length >= 2, 'her roster signed on for the page');
  assert.equal(hands[0].role, FIRST_MATE);
  const r = s.host.assignRole(s.boat, hands[1].name, FIRST_MATE);
  assert.equal(r.ok, true);
  s.boat.Cargo.Items.length = 0;
  const said = s.host.repairAway(s.boat).text;
  assert.ok(said.startsWith(`${hands[1].name}: `), said);
  assert.equal(s.host.crewHands(s.boat)[0].role, 'Deckhand');
  // her roles to the crew's step
  const src = read('src/scenes/naval/navalHost.js');
  assert.match(src, /const roles = boat\.crewed \? st\.crew\.hands\.map\(\(h\) => h\.role\) : null;/);
  assert.match(src, /return \(aboard\.find\(\(h\) => h\.role === FIRST_MATE\) \?\? aboard\[0\]\)\?\.name \?\? null;/);
  assert.match(read('src/scenes/world.js'), /_crewCtx\.roles = ship\.mine\?\.roles \?\? null;/);
  assert.equal(s.host.assignRole(s.boat, 'Nobody', 'Cook').ok, false);
});

test('CREW-ROLES the Fleet page\'s Crew panel: her hands and their posts, a post given from a list - a Bard\'s calling on his list alone - through the host half (the role act), said under her card', async () => {
  const { createFleetHost } = await import('../../../src/scenes/fleetHost.js');
  const { titleDeed, _resetFleetForTests } = await import('../../../src/systems/fleet.js');
  const { mintDeed } = await import('../../../src/systems/comeSailAway/comeSailAwayItems.js');
  const { scene, terrain } = await import('../../csaScene.mjs');
  const { drawFleetPage, resetFleetPage } = await import('../../../src/ui/fleetPage.js');
  const { setHoldingsProvider, _setHoldingsIconForTests } = await import('../../../src/ui/holdingsPages.js');
  _resetFleetForTests();
  const s = scene({ terrains: [terrain(10, 20)] });
  s.deps.items = { create: () => null, addToPlayer: () => {}, player: () => [], titles: () => [] };
  const crew = createShipCrew({ seed: 2 });
  crew.sync(ROSTER);
  const naval = {
    fleetStatus: () => ({ hull: 1, maxHull: 1, sail: 1, maxSail: 1, crew: 60, maxCrew: 60, wants: false, fire: false, stores: 0, inFight: false }),
    hostileNear: () => false, freeBerth: () => null, boatInPlay: () => null,
    crewHands: () => crew.hands.map((h) => ({ ...h })), assignRole: (b, name, role) => crew.assign(name, role),
  };
  const host = createFleetHost({ csa: () => s.rt, naval: () => naval, pack: () => [], where: () => ({ inside: false, pixel: { X: 10, Y: 20 }, feet: [0, 0, 0] }), nearPort: () => true });
  titleDeed(mintDeed(2, 0, 5, 1));
  const row = host.model().ships[0];
  assert.deepEqual(row.hands.map((h) => [h.role, h.bard]), crew.hands.map((h) => [h.role, h.mobile === MOBILE.Bard]));
  assert.deepEqual(host.act(5, 'role', { name: crew.hands[4].name, role: 'Cook' }), { ok: true, text: `${crew.hands[4].name} is now the Cook.` });
  assert.deepEqual(host.act(5, 'role', { name: crew.hands[4].name, role: 'Captain' }), { ok: false, text: 'There\'s no such post on this ship.' });
  // the page
  _setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
  globalThis.document = undefined;
  const fake = (tag) => {
    const classes = new Set();
    const n = { tag, children: [], attrs: {}, value: '', title: '', selected: false, isConnected: true,
      classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c) },
      set className(v) { classes.clear(); String(v ?? '').split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); }, get className() { return [...classes].join(' '); },
      _t: '', get textContent() { return n._t + n.children.map((c) => c.textContent).join(''); }, set textContent(v) { n._t = String(v ?? ''); },
      append(...cs) { n.children.push(...cs); }, setAttribute(k, v) { n.attrs[k] = v; } };
    return n;
  };
  const el = (t, c, x) => { const n = fake(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  const all = (root, pred) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (pred(c)) out.push(c); walk(c); } }; walk(root); return out; };
  setHoldingsProvider({ fleet: { model: () => host.model(), offer: (u) => host.offer(u), act: (u, v, a) => host.act(u, v, a) } });
  resetFleetPage();
  const draw = () => { const d = el('div'); drawFleetPage(d, () => {}, { el, divider: (t) => el('h4', null, t), meter: () => el('div') }); return d; };
  let d = draw();
  all(d, (c) => c.tag === 'button' && c.textContent === 'Crew')[0].onclick();
  d = draw();
  const picks = all(d, (c) => c.tag === 'select');
  assert.equal(picks.length, ROSTER.length);
  // PIN MOVED (AUDIT HOLDINGS C3): a Bard's list has his calling and never the Lookout - her bow is never a Bard's
  assert.deepEqual(picks.map((p) => p.children.length), crew.hands.map(() => CREW_ROLES.length), 'every list CREW_ROLES long - a Bard\'s his calling in the Lookout\'s place');
  const bardPick = picks[crew.hands.findIndex((h) => h.mobile === MOBILE.Bard)];
  assert.ok(bardPick.children.some((o) => o.value === 'Bard') && !bardPick.children.some((o) => o.value === 'Lookout'), 'his calling, no lookout');
  picks[1].value = 'Gunner'; picks[1].onchange();
  d = draw();
  assert.equal(crew.hands[1].role, 'Gunner');
  assert.match(d.textContent, new RegExp(`${crew.hands[1].name} is now the Gunner\\.`));
  assert.match(d.textContent, /the Gunners at the guns and the Lookout at the bow/);
  setHoldingsProvider(null);
});
