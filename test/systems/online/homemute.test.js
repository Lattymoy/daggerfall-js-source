// FIELD BUGS 2026-10-29b HOME-MUTE (#feature-feedback, "Housing feedback & suggestions after 20 hours of decorating",
// item 22: "Let us turn off the visibility of selected house decorations ... just come to someone's doors and turn off
// their HORRIBLE DESERT SHACK"). At a stranger's door a row hides its decorations for me alone - its paint, its yard and
// its room stand as a shunned home's do (HOME-VOTE's homeDecorShown) - kept on this device by town, building and owner,
// so a new owner's home is seen again; never my own, nor my guild's hall.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  setHomeMuteStore, setHomeMuted, homeMuted, homeMutable, homeDecorShownHere, homeMuteRows, homeMuteLines, homeMuteOptions, pressHomeMute,
  HOME_MUTE_VERB, HOME_MUTE_STORE, HOME_MUTE_MAX, HOME_MUTE_TEXT,
} from '../../../src/systems/online/homeMute.js';
import { HOME_SHUN_AT } from '../../../src/net/homeVoteLaw.js';
import { yardWorld, yardPiece, live } from '../../decorFakes.mjs';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const shack = (over = {}) => ({ buildingKey: 300, owner: 'Tomas', mine: false, own: false, score: 0, look: { roof: 1 }, ...over });
let store;
beforeEach(() => { store = memory(); setHomeMuteStore(store); });

test('HOME-MUTE the law: a stranger\'s home hidden for me stands as a shunned one does; my own account\'s, my guild\'s hall and a knight\'s deed never are; the key is its town, building and owner, so its next owner is seen; kept on the device, the oldest let go past HOME_MUTE_MAX (mutants: HOMEMUTE-own-hidden, HOMEMUTE-owner-unkeyed, HOMEMUTE-unkept, HOMEMUTE-uncapped)', () => {
  const h = shack();
  assert.equal(homeDecorShownHere(h, 7), true);
  assert.equal(setHomeMuted(7, h, true), true);
  assert.equal(homeDecorShownHere(h, 7), false, 'hidden for me');
  assert.equal(homeDecorShownHere(h, 8), true, 'the same building key in another town is another home');
  assert.equal(homeDecorShownHere({ ...h, owner: 'Ilsa' }, 7), true, 'sold: its new owner\'s is seen');
  assert.equal(homeDecorShownHere({ ...h, score: HOME_SHUN_AT }, 7), false, 'the vote\'s law stands beside it');
  for (const mine of [{ mine: true }, { own: true }, { deed: true }, { hall: { name: 'G' }, member: true }, { hall: { name: 'G' }, insider: true }]) {
    assert.equal(homeMutable(shack(mine)), false, JSON.stringify(mine));
    assert.equal(setHomeMuted(7, shack({ ...mine, buildingKey: 301 }), true), false);
  }
  assert.deepEqual(JSON.parse(store.m.get(HOME_MUTE_STORE)), ['7:300:Tomas'], 'on the device');
  setHomeMuteStore(store);
  assert.equal(homeMuted(7, h), true, 'read back');
  for (let i = 0; i < HOME_MUTE_MAX + 5; i++) setHomeMuted(9, shack({ buildingKey: 1000 + i }), true);
  assert.equal(JSON.parse(store.m.get(HOME_MUTE_STORE)).length, HOME_MUTE_MAX);
  assert.equal(homeMuted(7, h), false, 'the oldest let go');
  setHomeMuteStore(null);
  assert.equal(setHomeMuted(7, h, true), true, 'no store: the session keeps it');
});

test('HOME-MUTE the door: its row says hide or show, its line says it is hidden, and a press flips it, bumps the registry so the town repaints, and says so; the Info box\'s H the same (mutants: HOMEMUTE-row-stuck, HOMEMUTE-no-bump, HOMEMUTE-verb-unread)', () => {
  const h = shack();
  assert.deepEqual(homeMuteRows(h, 7), [{ id: HOME_MUTE_VERB.hide, label: 'Hide its decorations (for you)' }]);
  assert.deepEqual(homeMuteRows(shack({ mine: true }), 7), []);
  let bumps = 0;
  const said = [];
  const host = { onlineHomes: { bump: () => { bumps += 1; } } };
  const talk = { say: (t) => said.push(t) };
  assert.equal(pressHomeMute('home-vote-up', 7, h, host, talk), false, 'another verb is not this one\'s');
  assert.equal(pressHomeMute(HOME_MUTE_VERB.hide, 7, h, host, talk), true);
  assert.equal(bumps, 1);
  assert.deepEqual(homeMuteRows(h, 7), [{ id: HOME_MUTE_VERB.show, label: 'Show its decorations again' }]);
  assert.deepEqual(homeMuteLines(h, 7), [HOME_MUTE_TEXT.muted]);
  const [opt] = homeMuteOptions(h, 7, host, talk);
  assert.equal(opt.code, 'KeyH');
  opt.action();
  assert.equal(homeMuted(7, h), false, 'shown again');
  assert.equal(bumps, 2);
  assert.equal(said.length, 2);
});

test('HOME-MUTE the yard: a home I hid stands no yard for me, and stands it again when I show it (mutant: HOMEMUTE-yard-unread)', async () => {
  const w = yardWorld({ pieces: [yardPiece({ id: 'p1' }), yardPiece({ id: 'p2', pos: [-8, 0, 2] })], home: { buildingKey: 300 } });
  await w.run();
  assert.equal(live(w.made).length, 2, 'stood');
  setHomeMuted(7, { buildingKey: 300, owner: 'Tomas', own: false, mine: false }, true);
  w.clock.t += 61_000;
  await w.run();
  assert.equal(live(w.made).length, 0, 'hidden for me');
  setHomeMuted(7, { buildingKey: 300, owner: 'Tomas', own: false, mine: false }, false);
  w.clock.t += 61_000;
  await w.run();
  assert.equal(live(w.made).length, 2, 'shown again');
});

test('HOME-MUTE the hosts read it: the paint (world.js lookOfHome and the merge\'s test), the yard, the room and the door (worldModes.js) - each through homeDecorShownHere; exterior.js and dungeonContext.js stand no online home (mutants: HOMEMUTE-paint-unread, HOMEMUTE-room-unread, HOMEMUTE-door-unwired)', () => {
  const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
  const world = rd('src/scenes/world.js'), modes = rd('src/scenes/worldModes.js');
  assert.match(world, /const lookOfHome = [^\n]*homeDecorShownHere\(row, mapId\)/);
  assert.match(world, /row\?\.look && homeDecorShownHere\(row, p\.homeTown\)/);
  assert.match(modes, /const shown = homeDecorShownHere\(interiorHome, homeTownOf\(b\)\);/);
  assert.match(modes, /\.\.\.homeMuteRows\(home, homeTownOf\(bd\)\)/);
  assert.match(modes, /if \(pressHomeMute\(verb, homeTownOf\(bd\), home, host, townTalk\)\) return true;/);
  assert.equal((modes.match(/\.\.\.homeMuteOptions\(home, homeTownOf\(bd\), host, townTalk\)/g) ?? []).length, 2, 'the Info box and the rent box');
  for (const f of ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/homeYards.js']) assert.doesNotMatch(rd(f), /[^.\w]homeDecorShown\(/, `${f}: never the vote's alone`);
});
