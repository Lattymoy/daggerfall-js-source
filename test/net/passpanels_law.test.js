// PASS-PANELS (2026-10-30, the owner: "rework this to be more of a helldivers type system. Like a free panel track and a
// premium panel track using our new currency to both unlock tracks and buy the items"; bible/06-Systems/Battle-Pass.md).
// The law both ends read (src/net/battlePassLaw.js): the tracks' panels and their items, what opens a panel, why an item
// cannot be bought, the finds' Aurum under the day's bound, the challenges' Aurum, and the card as the client takes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PASS_SEASONS, PASS_TRACKS, PASS_PANELS, PASS_PREMIUM_AURUM, PASS_ALL_GRANTS, PASS_CHALLENGES, PASS_SOURCES, PASS_DAY_AURUM,
  PASS_FINDS_FROM_MS, passSeasonById, passSeasonAt, passSeasonShown, passStageAt, passOpen, passTracksOpen, passPanelsOf,
  passItemOf, passSpentOn, passPanelOpen, passBuyBlock, passItemsOf, passKeysOf, passCardOf, passFindAurum,
} from '../../src/net/battlePassLaw.js';
import { TITLES, GLYPHS, ICONS, AURAS } from '../../src/net/identityToken.js';
import { effectOf } from '../../src/net/effectLaw.js';
import { shopWareById } from '../../src/net/shopLaw.js';
import { AURUM_DAILY, AURUM_DEEDS } from '../../src/net/aurumLaw.js';
import { AURUM_CACHE_AURUM } from '../../src/net/aurumCacheLaw.js';

const S1 = passSeasonById('s1');
const DAY = 86_400_000;
const free = passPanelsOf('s1', 'free'), premium = passPanelsOf('s1', 'premium');
const sum = (panels) => panels.reduce((a, p) => a + p.items.reduce((b, it) => b + it.aurum, 0), 0);

test('PASS-PANELS the tracks: two a season, free and premium, three panels each - the first open from the start, each later one opened by more Aurum spent on its own track than the last, and each reachable by buying what the panels before it sell; every item once on every track, every price a whole hundred (mutants: a panel no purchase can open; an item on two tracks; a panel opened by the other track\'s spending)', () => {
  assert.deepEqual(PASS_TRACKS, ['free', 'premium']);
  for (const s of PASS_SEASONS) assert.deepEqual(Object.keys(PASS_PANELS[s.id]), ['free', 'premium'], `${s.id}: both tracks`);
  for (const panels of [free, premium]) {
    assert.equal(panels.length, panels === premium ? 4 : 3, 'PIN MOVED (the capstone): the Gilded Folio four pages');
    assert.equal(panels[0].open, 0, 'the first panel open from the start');
    for (let p = 1; p < panels.length; p++) {
      assert.ok(panels[p].open > panels[p - 1].open, 'each later panel dearer to open');
      assert.ok(sum(panels.slice(0, p)) >= panels[p].open, `panel ${p}: what the panels before it sell opens it`);
    }
    for (const p of panels) for (const it of p.items) assert.ok(Number.isSafeInteger(it.aurum) && it.aurum > 0 && it.aurum % 100 === 0, it.grant);
  }
  // THE CAPSTONE (the owner: "the developer wing aura has a light blue style"): the Gilded Folio's last page, the
  // Aetherium Wings alone, opening only once every item before it is bought
  const cap = premium.at(-1);
  assert.deepEqual(cap.items, [{ grant: 'aura:aetherwings', aurum: 2000 }]);
  assert.equal(cap.open, sum(premium.slice(0, -1)), 'it opens at what every Gilded item before it costs');
  assert.equal(passPanelOpen('s1', 'premium', premium.length - 1, premium.slice(0, -1).flatMap((p) => p.items.map((it) => it.grant)).slice(1)), false, 'one item short, shut');
  assert.ok(AURAS.includes('aetherwings'));
  const grants = [...free, ...premium].flatMap((p) => p.items.map((it) => it.grant));
  assert.equal(new Set(grants).size, grants.length, 'every item once');
  assert.deepEqual([...PASS_ALL_GRANTS].sort(), [...grants].sort());
  // a panel reads its own track's spending, never the other's
  const allFree = free.flatMap((p) => p.items.map((it) => it.grant));
  assert.equal(passPanelOpen('s1', 'premium', 1, allFree), false);
  assert.equal(passPanelOpen('s1', 'free', 2, allFree), true);
  assert.equal(passPanelOpen('s1', 'free', 3, allFree), false, 'no such panel');
  assert.equal(passPanelOpen('s1', 'free', -1, allFree), false);
});

test('PASS-PANELS the items: each a cosmetic the wardrobe knows - a title, a glyph, a profile icon, an aura, a kill effect, a portal skin or a mount look - never a shop ware nor a daily ware; the owner\'s "No overbundence of titles and profile icons" holds - a title on the free track, two on the premium, an icon or two each (mutants: an item the vocabulary lacks; a daily ware on a track)', () => {
  const known = { title: TITLES, glyph: GLYPHS, icon: ICONS, aura: AURAS };
  for (const g of PASS_ALL_GRANTS) {
    const [kind, key] = g.split(':');
    if (kind === 'kill' || kind === 'portal' || kind === 'mount') assert.ok(effectOf(kind, key), `${g}: an effect`);
    else assert.ok(known[kind]?.includes(key), `${g}: in the vocabulary`);
    assert.equal(shopWareById(g), null, `${g}: never sold for money`);
    assert.ok(!AURUM_DAILY.some((d) => d.id === g), `${g}: never a daily ware`);
  }
  const count = (panels, kind) => panels.flatMap((p) => p.items).filter((it) => it.grant.startsWith(`${kind}:`)).length;
  assert.deepEqual([count(free, 'title'), count(premium, 'title')], [1, 2]);
  assert.ok(count(free, 'icon') <= 1 && count(premium, 'icon') <= 2);
});

test('PASS-PANELS the prices: the free track costs 2,300 Aurum, the premium 1,000 to open and 8,400 more (PIN MOVED, the capstone: 6,400); a season\'s finds alone pay the free track inside a month and both tracks inside its sixty days with its challenges, so no item needs money (mutants: a price moved; the premium opened for nothing)', () => {
  assert.equal(sum(free), 2300);
  assert.equal(PASS_PREMIUM_AURUM.s1, 1000);
  assert.equal(sum(premium), 8400);
  const days = (S1.toMs - S1.fromMs) / DAY, challenges = PASS_CHALLENGES.reduce((a, c) => a + c.aurum, 0);
  assert.equal(days, 60);
  assert.ok(30 * PASS_DAY_AURUM >= sum(free), 'the free track inside a month of finds');
  assert.ok(days * PASS_DAY_AURUM + challenges >= sum(free) + PASS_PREMIUM_AURUM.s1 + sum(premium.slice(0, -1)) - 2000, 'both tracks but the capstone within reach of the season, a little short without the deeds and caches');
  const deeds = Object.values(AURUM_DEEDS).reduce((a, n) => a + n, 0) * (days / 7);
  // PIN MOVED (CACHES-ONCE): two caches a day at 25; now a dedicated day's, six new dungeons of ten at 10 - about the same Aurum
  assert.ok(days * PASS_DAY_AURUM + challenges + deeds + days * 6 * AURUM_CACHE_AURUM >= sum(free) + PASS_PREMIUM_AURUM.s1 + sum(premium), 'the capstone too, with the week\'s deeds and a dedicated day\'s caches');
});

test('PASS-PANELS where an item stands, and why it cannot be bought: unknown, its season\'s tracks not open yet, held, the premium track shut, its panel shut - in that order; bought on an open panel once the track opens it; the tracks sell from the season\'s first instant for good (mutants: a premium item sold on a shut track; a shut panel sold; the tracks closed with the season)', () => {
  assert.deepEqual(passItemOf('s1', 'portal:brass'), { season: 's1', track: 'free', panel: 1, open: 300, aurum: 700 });
  assert.deepEqual(passItemOf('s1', 'mount:automaton'), { season: 's1', track: 'premium', panel: 2, open: 2000, aurum: 1600 });
  assert.equal(passItemOf('s1', 'kill:pyre'), null);
  assert.equal(passItemOf('s9', 'portal:brass'), null);
  const at = S1.fromMs + DAY, a = (premiumOn, bought, nowMs = at) => ({ premium: premiumOn, bought, nowMs });
  assert.equal(passBuyBlock('s1', 'kill:pyre', a(true, [])), 'item');
  assert.equal(passBuyBlock('s9', 'glyph:cog', a(true, [])), 'item');
  assert.equal(passBuyBlock('s1', 'glyph:cog', a(false, [], S1.fromMs - 1)), 'soon');
  assert.equal(passBuyBlock('s1', 'glyph:cog', a(false, [])), null, 'the first panel, the free track: open to all');
  assert.equal(passBuyBlock('s1', 'glyph:cog', a(false, ['glyph:cog'])), 'held');
  assert.equal(passBuyBlock('s1', 'glyph:tonalfork', a(false, [])), 'track');
  assert.equal(passBuyBlock('s1', 'glyph:tonalfork', a(true, [])), null);
  assert.equal(passBuyBlock('s1', 'title:tremorborn', a(false, ['glyph:cog'])), 'panel', '200 spent of the 300 it needs');
  assert.equal(passBuyBlock('s1', 'title:tremorborn', a(false, ['icon:aetherium'])), null, '300 spent');
  assert.equal(passBuyBlock('s1', 'title:heartwaker', a(true, ['glyph:cog', 'icon:aetherium', 'title:tremorborn'])), 'panel', 'the free track\'s 900 opens nothing on the premium');
  assert.equal(passBuyBlock('s1', 'title:heartwaker', a(true, ['glyph:tonalfork', 'icon:lexicon'])), 'panel', '500 of 600');
  assert.equal(passBuyBlock('s1', 'title:heartwaker', a(true, ['aura:aetherium'])), null);
  assert.equal(passBuyBlock('s1', 'glyph:cog', a(false, [], S1.toMs + 400 * DAY)), null, 'a year past the season: still sold');
  assert.equal(passSpentOn('s1', 'premium', ['aura:aetherium', 'glyph:cog', 'title:heartwaker']), 1600);
  assert.equal(passTracksOpen(S1, S1.fromMs), true);
  assert.equal(passTracksOpen(S1, NaN), false);
  assert.equal(passTracksOpen(null, S1.fromMs), false);
});

test('PASS-PANELS the calendar: the season runs sixty days in three stages of twenty - its challenges and its world - while its tracks and the finds\' Aurum never close; the window shows the running season, else the next, else the last (mutants: a stage a day late; the finds shut with the season)', () => {
  assert.equal(passSeasonAt(S1.fromMs - 1), null);
  assert.equal(passSeasonAt(S1.fromMs)?.id, 's1');
  assert.equal(passSeasonAt(S1.toMs), null);
  assert.equal(passSeasonShown(S1.fromMs - DAY)?.id, 's1');
  assert.equal(passSeasonShown(S1.toMs + 900 * DAY)?.id, 's1');
  assert.deepEqual([S1.fromMs - 1, S1.fromMs, S1.fromMs + 20 * DAY - 1, S1.fromMs + 20 * DAY, S1.fromMs + 40 * DAY, S1.toMs + DAY].map((ms) => passStageAt(S1, ms)), [-1, 0, 0, 1, 2, 2]);
  assert.equal(passOpen(S1, S1.toMs - 1), true);
  assert.equal(passOpen(S1, S1.toMs), false);
  assert.equal(PASS_FINDS_FROM_MS, S1.fromMs);
});

test('PASS-PANELS the finds: a source\'s Aurum under what is left of the day\'s 100 - a foe one, a quest ten, an endgame deed twenty; nothing for a source the law lacks; the challenges pay 60 to 200 each, once (mutants: the bound ignored; a find past the bound)', () => {
  assert.equal(PASS_DAY_AURUM, 100);
  assert.deepEqual([passFindAurum('foe', 0), passFindAurum('quest', 0), passFindAurum('endgame', 0), passFindAurum('endgame', 90), passFindAurum('endgame', 100), passFindAurum('endgame', 150)], [1, 10, 20, 10, 0, 0]);
  assert.equal(passFindAurum('nope', 0), 0);
  assert.equal(passFindAurum('foe', -50), 1, 'a bad day count reads as none found');
  for (const v of Object.values(PASS_SOURCES)) assert.ok(Number.isSafeInteger(v) && v > 0 && v <= 20);
  for (const c of PASS_CHALLENGES) assert.ok(c.aurum >= 60 && c.aurum <= 200 && c.n > 0 && c.sources.every((x) => x in PASS_SOURCES), c.key);
  assert.deepEqual(PASS_CHALLENGES.map((c) => c.stage).filter((x, i, a) => a.indexOf(x) === i), [0, 1, 2]);
});

test('PASS-PANELS what an account holds: `pass_items` read as the tracks\' own grants, once each, in order; the keys of one kind among them (mutants: a stranger\'s grant kept; a grant twice)', () => {
  assert.deepEqual(passItemsOf('glyph:cog  title:tremorborn glyph:cog kill:pyre nope'), ['glyph:cog', 'title:tremorborn']);
  assert.deepEqual(passItemsOf(null), []);
  assert.deepEqual(passKeysOf(['glyph:cog', 'title:tremorborn', 'glyph:gearcrown'], 'glyph'), ['cog', 'gearcrown']);
  assert.deepEqual(passKeysOf(['glyph:cog'], 'title'), []);
});

test('PASS-PANELS the card as the client takes it: checked on the way in - an unknown season none; a stage past the season\'s none; an item another season\'s or listed twice dropped; the day\'s Aurum past its bound none; a challenge\'s count held to its target; the free track always open (mutants: the wire\'s stage trusted; a stranger\'s item kept; the premium read from a truthy word)', () => {
  assert.equal(passCardOf(null), null);
  assert.equal(passCardOf({ season: 's9' }), null);
  const c = passCardOf({
    season: 's1', open: true, stage: 7, tracks: { free: false, premium: 'yes' }, bought: ['glyph:cog', 'glyph:cog', 'kill:pyre', 'title:heartwaker'],
    today: 500, challenges: [{ key: 'tremor-tavern', n: 99, paid: true }, { key: 'nope', n: 1 }],
  });
  assert.equal(c.season, 's1');
  assert.equal(c.open, true);
  assert.equal(c.stage, -1);
  assert.deepEqual(c.tracks, { free: true, premium: false });
  assert.deepEqual(c.bought, ['glyph:cog', 'title:heartwaker']);
  assert.deepEqual([c.today, c.dayMax], [0, PASS_DAY_AURUM]);
  assert.deepEqual(c.challenges.find((x) => x.key === 'tremor-tavern'), { key: 'tremor-tavern', n: 3, paid: true });
  assert.equal(c.challenges.length, PASS_CHALLENGES.length);
  const d = passCardOf({ season: 's1', open: 1, stage: 2, tracks: { premium: true }, bought: 'glyph:cog', today: 40 });
  assert.deepEqual([d.open, d.stage, d.tracks.premium, d.bought, d.today], [false, 2, true, [], 40]);
});
