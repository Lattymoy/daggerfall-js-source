// FIELD BUGS 2026-10-09e - EVERY-STANDING, the Discord's suggestion "Could we have a setting to see our reputation with
// every guild/kingdoms?": "I got expelled from the Mages Guild recently ... I wanted to get my reputation back into
// positive with them ... since I don't am part of the guild anymore, I can't see how is my standing with them ... could
// we be able to see most or all organizations? I personally feel that could be a setting".
//
// The Standing page listed the player's memberships alone (systems/affiliations.js). With the Interface tab's Character
// sheet row on (prefs `standingAll`, off by default), it lists every organization's reputation from the live faction
// store (systems/factionStanding.js). `01-Overview/Field-Bugs-2026-10-09e.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { standingGroups, ORG_STANDING_GROUPS } from '../src/systems/factionStanding.js';
import { RANDOM_RULER } from '../src/systems/npcSession.js';
import { createFactionRep, setReputation } from '../src/systems/factionRep.js';
import { FactionFile, FACTION_TYPES as T } from '../src/formats/factionFile.js';
import { GUILDS } from '../src/systems/guilds.js';
import { DIVINES, ORDERS } from '../src/systems/guildVariants.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { CATEGORIES } from '../src/ui/settingsMap.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_FACTIONS = !!ARENA2 && existsSync(join(ARENA2, 'FACTION.TXT'));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A faction table in the reader's shape, cloned into a live store as the game attaches one. */
function store() {
  const f = (id, name, type) => [id, { id, name, type, rep: 0, parent: 0, children: [] }];
  const dict = new Map([
    f(40, 'The Mages Guild', T.Group), f(41, 'The Fighters Guild', T.Group), f(42, 'The Thieves Guild', T.Group), f(108, 'The Dark Brotherhood', T.Group),
    ...Object.entries(DIVINES).map(([n, id]) => f(id, n, T.God)), f(25, 'Ebonarm', T.God),
    ...Object.entries(ORDERS).map(([n, id]) => f(id, `The Order of ${n}`, T.Group)),
    f(207, 'Wayrest', T.Province), f(201, 'Daggerfall', T.Province), f(358, 'Orsinium', T.Province), f(RANDOM_RULER, 'Random Ruler', T.Province),
    f(419, 'The Glenmoril Witches', T.WitchesCoven), f(150, 'The Vraseth', T.VampireClan), f(9, 'Sheogorath', T.Daedra), f(1, 'Clavicus Vile', T.Daedra),
    f(517, 'People of Dwynnen', T.People), f(595, 'Court of Daggerfall', T.Courts),
  ]);
  return createFactionRep(dict);
}

test('EVERY-STANDING: every organization by group - the guilds and temples the player is not in (the expelled Mages Guild\'s -15 the way back reads), the knightly orders, the kingdoms by name (no Random Ruler), the covens, the clans, the Daedra; no People or Court; a membership is under Guilds already', () => {
  const rep = store();
  setReputation(rep, 40, -15);
  setReputation(rep, 207, 22);
  setReputation(rep, 9, 10);
  const entity = {
    name: 'Faetasi', factionRep: rep,
    guildMemberships: { [GUILDS.FightersGuild.guildGroup]: { guild: GUILDS.FightersGuild.name, rank: 2, lastRankChange: 0 } },
  };
  const groups = standingGroups(entity);
  assert.deepEqual(groups.map((g) => g.title), ['Guilds', 'Temples', 'Knightly orders', 'Kingdoms', 'Witches\' covens', 'Vampire clans', 'Daedric Princes']);
  const guilds = groups[0].rows;
  assert.deepEqual(guilds.map((r) => [r.factionId, r.name, r.rep]), [[40, 'The Mages Guild', -15], [42, 'The Thieves Guild', 0], [108, 'The Dark Brotherhood', 0]],
    'the Fighters Guild is a membership - under Guilds above, with its rank');
  assert.deepEqual(groups[1].rows.map((r) => r.factionId), Object.values(DIVINES), 'the eight temples by the god their membership reads - no Ebonarm, who keeps none');
  assert.deepEqual(groups[2].rows.map((r) => r.factionId), Object.values(ORDERS));
  assert.deepEqual(groups[3].rows.map((r) => [r.name, r.rep]), [['Daggerfall', 0], ['Orsinium', 0], ['Wayrest', 22]], 'by name');
  assert.deepEqual(groups[6].rows.map((r) => [r.name, r.rep]), [['Clavicus Vile', 0], ['Sheogorath', 10]]);
  assert.ok(!groups.flatMap((g) => g.rows).some((r) => r.factionId === 517 || r.factionId === 595 || r.factionId === RANDOM_RULER));
  assert.deepEqual(standingGroups({ name: 'x' }), [], 'no faction store yet: nothing to read');
  assert.equal(ORG_STANDING_GROUPS.length, 7);
});

test('EVERY-STANDING: off by default - the page as it was; on, the Standing page draws each group under its divider, a row its name and a signed number', async () => {
  assert.equal(PREF_DEFAULTS.standingAll, false);
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /statsGuilds\(detail, playerEntity\);\s*\n\s*if \(getPref\('standingAll'\)\) statsEveryStanding\(detail, playerEntity\);/);
  assert.match(menu, /out\.push\(prefRow\('standingAll', 'Every faction\\'s standing',/);
  const sheet = CATEGORIES.find((t) => t.id === 'interface').sections.find((s) => s.id === 'sheet');
  assert.deepEqual(sheet.items, ['port:standingAll']);
  const { statsEveryStanding } = await import('../src/ui/enhancedMenu.js');
  const make = (tag) => ({ tag, className: '', textContent: '', children: [], append(...c) { this.children.push(...c); } });
  globalThis.document = { createElement: make };
  try {
    const rep = store();
    setReputation(rep, 40, -15);
    const detail = make('div');
    statsEveryStanding(detail, { name: 'x', factionRep: rep, guildMemberships: {} });
    const text = (n) => (n.textContent || '') + n.children.map(text).join('|');
    assert.match(text(detail.children[0]), /Guilds/);
    assert.equal(text(detail.children[1]), 'The Fighters Guild|0', 'the guilds in their book\'s order');
    const row = detail.children[2];
    assert.equal(row.className, 'px-stat px-org');
    assert.equal(text(row), 'The Mages Guild|-15');
    assert.equal(row.children[1].className, 'v bad', 'toned as the page tones a reputation');
    assert.equal(detail.children.filter((n) => n.className === 'px-stat px-org').length, 4 + 8 + 10 + 3 + 1 + 1 + 2);
  } finally { delete globalThis.document; }
});

test('EVERY-STANDING with ARENA2: the player\'s own FACTION.TXT - the four guilds, the eight temples, the ten orders, every kingdom and the Empire, fourteen covens, nine clans, sixteen Princes', { skip: HAVE_FACTIONS ? false : 'ARENA2_PATH not set' }, () => {
  const ff = new FactionFile();
  ff.load(new Uint8Array(readFileSync(join(ARENA2, 'FACTION.TXT'))));
  const groups = standingGroups({ name: 'x', factionRep: createFactionRep(ff.factionDict), guildMemberships: {} });
  assert.deepEqual(groups.map((g) => [g.id, g.rows.length]), [['guilds', 4], ['temples', 8], ['orders', 10], ['kingdoms', 45], ['covens', 14], ['clans', 9], ['daedra', 16]]);
  const k = groups.find((g) => g.id === 'kingdoms').rows.map((r) => r.name);
  for (const n of ['Daggerfall', 'Wayrest', 'Sentinel', 'Orsinium', 'The Septim Empire', 'Isle of Balfiera']) assert.ok(k.includes(n), n);
  assert.deepEqual(groups.find((g) => g.id === 'guilds').rows.map((r) => r.name), ['The Fighters Guild', 'The Mages Guild', 'The Thieves Guild', 'The Dark Brotherhood']);
});
