// LW7c (2026-10-05, bible/06-Systems/Living-World.md "LW7c", Mac: "make friends or enemies"): THE PEOPLE WHO KNOW YOU
// - the character's regards as the chronicle's People page: each resident met, minted again from their id (nothing new
// saved), by name and town, their standing and their fate; the page in the enhanced chronicle where the host hands it
// over. The town is the synthetic one (test/lwTown.mjs); the window mounts on the minimal DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './chargenDom.mjs';   // the minimal DOM - globals
import { synthTown } from './lwTown.mjs';
import { residentOfId, peoplePage, personWords, RESIDENT_ID, PEOPLE_MAX } from '../src/systems/livingWorld/people.js';
import { townCensus, mintResident } from '../src/systems/livingWorld/census.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { CHRONICLE_SECTIONS, PEOPLE_SECTION, chronicleSections, chronicleModel, mountEnhancedChronicle } from '../src/ui/enhancedChronicle.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: true, name: 'Synth' });
const townOf = (id) => (id === TOWN.mapId ? TOWN : null);
const all = (root, cls) => root.querySelectorAll('.' + cls);

test('LW7c a resident\'s id names them again: every one of a town\'s census - household, watch, traveller - minted again from their id alone bears the census\'s own name (a name reads no trade but the watch\'s); a newcomer\'s generation in the id; another kind of id, or a town not known, none (mutants: the roll, the watch, the generation, the pattern)', () => {
  const { buildings } = synthTown();
  const census = townCensus(TOWN, buildings);
  for (const roll of ['h', 'w', 't']) assert.ok(census.some((r) => r.roll === roll), `a ${roll} in the census`);
  for (const r of census) {
    const again = residentOfId(r.id, townOf);
    assert.ok(again, r.id);
    assert.equal(again.name, r.name, `${r.id}: the census's own name`);
    assert.equal(again.roll, r.roll);
    assert.equal(again.slot, r.slot);
  }
  const t = census.find((r) => r.roll === 't');
  const nu = mintResident(TOWN, 't', t.slot, t.job, { gen: 77 });
  assert.equal(residentOfId(`${t.id}~77`, townOf).name, nu.name, 'a newcomer');
  assert.notEqual(nu.name, t.name);
  assert.equal(residentOfId('L999.3', townOf), null, 'a town not known');
  for (const bad of ['', 'X12345.3', 'L12345.x3', 'L12345.', 'L12345.t3~', 'e1']) assert.equal(residentOfId(bad, townOf), null, `'${bad}'`);
  assert.ok(RESIDENT_ID.test('L12345.w2~5'));
});

test('LW7c the page: friends the warmest first, enemies (hostile and enemy) the bitterest first, the known the latest seen first - each its name, town, standing, eased regard, days since seen and the words of it; one the player struck down SLAIN, one who fell at their side DIED - told by their place and the name they bore, a newcomer to the place not; each list to PEOPLE_MAX (mutants: the groups, the orders, the days, the fate, the newcomer, the cap)', () => {
  const { buildings } = synthTown();
  const census = townCensus(TOWN, buildings);
  const [a, b, c, d, e, f] = census.filter((r) => r.roll === 'h');
  const rel = createRelations();
  rel.note(a.id, 'saved', 10); rel.note(a.id, 'helped', 10);   // 55: a friend
  rel.note(b.id, 'saved', 12); rel.note(b.id, 'polite', 12); rel.note(b.id, 'talk', 12);   // 39: known
  rel.note(c.id, 'struck', 11);   // -45: an enemy
  rel.note(d.id, 'slain', 13);   // -75: hostile
  rel.note(e.id, 'talk', 9);   // known, seen long ago
  rel.note(f.id, 'saved', 13); rel.note(f.id, 'saved', 13);   // 70: the warmest
  rel.note('L999.1', 'talk', 13);   // a town the page does not know
  rel.turn('slain', `L${TOWN.mapId}.${d.slot}@3`, { t: 1, seen: true, who: d.name });
  rel.turn('died', `L${TOWN.mapId}.${f.slot}@3`, { t: 2, who: 'Someone Else' });   // the place's - but another who bore it
  const page = peoplePage(rel, 14, townOf);
  assert.deepEqual(page.friends.map((p) => p.id), [f.id, a.id], 'the warmest first');
  assert.deepEqual(page.enemies.map((p) => p.id), [d.id, c.id], 'the bitterest first');
  assert.deepEqual(page.known.map((p) => p.id), [b.id, e.id], 'the latest seen first');
  const pa = page.friends[1];
  assert.equal(pa.name, a.name);
  assert.equal(pa.town, 'Synth');
  assert.equal(pa.standing, 'friend');
  assert.equal(pa.regard, Math.round(rel.regard(a.id, 14)));
  assert.equal(pa.days, 4);
  assert.equal(pa.words, personWords(pa));
  assert.equal(page.enemies[0].standing, 'hostile');
  assert.equal(page.enemies[0].fate, 'slain', 'struck down by the player');
  assert.equal(page.friends[0].fate, null, 'another who bore the place died - not them');
  rel.turn('died', `L${TOWN.mapId}.${a.slot}@4`, { t: 3, who: a.name });
  assert.equal(peoplePage(rel, 14, townOf).friends.find((p) => p.id === a.id).fate, 'died');
  // the cap
  assert.equal(PEOPLE_MAX, 60);
  const many = createRelations();
  for (let i = 0; i < PEOPLE_MAX + 5; i++) many.note(`L${TOWN.mapId}.t${i}`, 'talk', 14);
  assert.equal(peoplePage(many, 14, townOf).known.length, PEOPLE_MAX);
  // the words
  assert.equal(personWords({ fate: 'slain' }), 'Slain by your hand.');
  assert.equal(personWords({ fate: 'died' }), 'Fell fighting at your side.');
  assert.equal(personWords({ standing: 'friend', days: 0 }), 'A friend. Seen today.');
  assert.equal(personWords({ standing: 'hostile', days: 1 }), 'Hostile - they mean you harm. Last seen yesterday.');
  assert.equal(personWords({ standing: 'enemy', days: 5 }), 'An enemy - they will not speak to you. Last seen 5 days ago.');
  assert.equal(personWords({ standing: 'neutral', days: 2 }), 'Knows you. Last seen 2 days ago.');
});

test('LW7c the chronicle\'s People: a section of its own where the host hands the page over (the four as they were otherwise), its count the people known, each group its cards - the name, the town, the words; nobody yet said so; opened on it by name; the streaming host hands the page where the living world is on (mutants: the section, the count, the cards, the empty page, the open, the host)', () => {
  assert.deepEqual(chronicleSections({}), CHRONICLE_SECTIONS, 'no page: the four');
  assert.deepEqual(chronicleSections({ people: () => null }).map(([id]) => id), ['quests', 'notes', 'messages', 'history', 'people']);
  assert.deepEqual([...PEOPLE_SECTION], ['people', 'People']);
  assert.deepEqual(chronicleModel({}), { quests: [], notes: [], messages: [], history: [] }, 'no page: the model as it was');
  const page = {
    friends: [{ id: 'a', name: 'Ada Lark', town: 'Synth', words: 'A friend. Seen today.' }],
    enemies: [{ id: 'b', name: 'Bo Reed', town: 'Far', words: 'Slain by your hand.' }, { id: 'c', name: 'Cy Fenn', town: '', words: 'An enemy - they will not speak to you. Last seen 3 days ago.' }],
    known: [],
  };
  assert.deepEqual(chronicleModel({ people: () => page }).people, page);
  globalThis.window ??= globalThis;
  const host = globalThis.document.createElement('div');
  const view = mountEnhancedChronicle(host, { section: 'people', people: () => page });
  try {
    const rail = all(host, 'cr-row');
    assert.equal(rail.length, 5);
    assert.ok(rail[4].textContent.includes('People') && rail[4].textContent.includes('3'), 'the count: the people known');
    assert.ok(rail[4].className.includes(' on'), 'opened on it by name');
    const cards = all(host, 'cr-entry');
    assert.equal(cards.length, 3);
    assert.equal(all(cards[0], 'cr-when')[0].textContent, 'Ada Lark');
    assert.ok(cards[0].textContent.includes('Synth') && cards[0].textContent.includes('A friend. Seen today.'));
    assert.ok(cards[1].textContent.includes('Slain by your hand.'));
    assert.equal(all(cards[2], 'sb-chip').length, 0, 'no town: no chip');
    const groups = all(host, 'sb-chip').map((n) => n.textContent).filter((x) => /·/.test(x));
    assert.deepEqual(groups, ['Friends · 1', 'Enemies · 2'], 'each group with its count, an empty one not drawn');
  } finally { view.destroy(); }
  const empty = globalThis.document.createElement('div');
  const v2 = mountEnhancedChronicle(empty, { section: 'people', people: () => ({ friends: [], enemies: [], known: [] }) });
  try { assert.ok(all(empty, 'px-note').some((n) => n.textContent === 'No one in the Bay knows you yet.')); } finally { v2.destroy(); }
  const none = globalThis.document.createElement('div');
  const v3 = mountEnhancedChronicle(none, { section: 'people' });
  try { assert.ok(all(none, 'cr-row')[0].className.includes(' on'), 'no page: the section unknown, the window opens on the quests'); } finally { v3.destroy(); }
  const w = rd('src/scenes/world.js');
  assert.match(w, /people: livingWorldOn\(\) \? \(\) => peoplePage\(livingRelations, Math\.floor\(\(skyMinutes\(\) - 240\) \/ 1440\), livingTownOfId\) : undefined,/);
});
