// GUILD-REP (2026-09-22, Mac: "we need to add guild reputation to our
// enhanced pause menu, its missing"). The enhanced pause menu's Stats >
// Standing page drew only the five social groups; the guilds a player
// belongs to, their rank and their standing with each were on the
// classic sheet's Affiliations box alone. ShowAffiliationsDialog's model
// (DaggerfallCharacterSheetWindow.cs:327-364) now lives in
// systems/affiliations.js and both skins draw it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { affiliations } from '../src/systems/affiliations.js';
import { GUILDS } from '../src/systems/guilds.js';
import { DIVINES } from '../src/systems/guildVariants.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const fighters = GUILDS.FightersGuild;
const hero = (extra = {}) => ({ name: 'Aldric Vane', stats: {}, level: 10, ...extra });

test('GUILD-REP: the book - affiliation, rank title and live reputation, one row a membership', () => {
  const e = hero({
    guildMemberships: {
      [fighters.guildGroup]: { guild: fighters.name, rank: 2, lastRankChange: 0 },
      HolyOrder: { guild: 'Temple:Julianos', rank: 0, lastRankChange: 0 },
      Nobody: { guild: 'Not A Guild', rank: 1, lastRankChange: 0 },
    },
    factionRep: { dict: new Map([
      [fighters.factionId, { name: 'The Fighters Guild', rep: 37 }],
      [DIVINES.Julianos, { name: 'Julianos', rep: -4 }],
    ]) },
  });
  const book = affiliations(e);
  assert.equal(book.length, 2, 'a membership naming no guild is no row');
  assert.deepEqual(book[0], { affiliation: 'The Fighters Guild', title: 'Swordsman', rep: 37, factionId: fighters.factionId });
  assert.equal(book[1].affiliation, 'Julianos');
  assert.equal(book[1].rep, -4);
  assert.deepEqual(affiliations(hero({ guildMemberships: {} })), [], 'no memberships, no rows');
  assert.equal(affiliations(hero({ guildMemberships: { [fighters.guildGroup]: { guild: fighters.name, rank: 0, lastRankChange: 0 } } }))[0].rep, 0,
    'no faction store yet reads 0, as the classic box always has');
});

// the page's el() is document.createElement - a node's worth of DOM is enough
function withDom(fn) {
  const make = (tag) => ({ tag, className: '', textContent: '', children: [], append(...c) { this.children.push(...c); } });
  globalThis.document = { createElement: make };
  try { return fn(make); } finally { delete globalThis.document; }
}
const text = (n) => (n.textContent || '') + n.children.map(text).join('|');

test('GUILD-REP: the enhanced Standing page draws each guild - name, rank and a signed, toned reputation', async () => {
  const { statsGuilds } = await import('../src/ui/enhancedMenu.js');
  withDom((make) => {
    const detail = make('div');
    statsGuilds(detail, hero({
      guildMemberships: { [fighters.guildGroup]: { guild: fighters.name, rank: 2, lastRankChange: 0 } },
      factionRep: { dict: new Map([[fighters.factionId, { name: 'The Fighters Guild', rep: 37 }]]) },
    }));
    assert.match(text(detail.children[0]), /Guilds/, 'its own divider under the social groups');
    const row = detail.children[1];
    assert.equal(row.className, 'px-stat px-guild');
    assert.deepEqual(row.children.map((c) => [c.className, c.textContent]),
      [['k', 'The Fighters Guild'], ['v px-rank', 'Swordsman'], ['v won', '+37']]);
  });
  withDom((make) => {
    const detail = make('div');
    statsGuilds(detail, hero({
      guildMemberships: { [fighters.guildGroup]: { guild: fighters.name, rank: 0, lastRankChange: 0 } },
      factionRep: { dict: new Map([[fighters.factionId, { name: 'The Fighters Guild', rep: -12 }]]) },
    }));
    assert.deepEqual(detail.children[1].children[2], { ...detail.children[1].children[2], className: 'v bad', textContent: '-12' });
  });
  withDom((make) => {
    const detail = make('div');
    statsGuilds(detail, hero({ guildMemberships: {} }));
    assert.equal(detail.children[1].textContent, 'You have no affiliations.', 'an empty book says so, as record 19 does');
  });
});

test('GUILD-REP: one model, both skins - the classic box and the enhanced page read the same book', () => {
  assert.match(read('src/ui/charsheet.js'), /const book = affiliations\(entity\);/);
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /const book = affiliations\(entity\);/);
  assert.match(menu, /r\.append\(el\('span', 'k', SOCIAL_GROUP_NAMES\[i\]\), signedRep\(reps\[i\] \?\? 0\)\);\s*detail\.append\(r\);\s*\}\s*statsGuilds\(detail, playerEntity\);/,
    'the Standing page draws the guilds after the social groups');
  assert.doesNotMatch(menu, /from '\.\/charsheet\.js'/, 'the enhanced skin never imports the classic sheet');
});
