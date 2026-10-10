// SD-HERALD (2026-10-09, the owner: "We need to add discord integration to abyss dungeons"): THE ABYSS DUNGEON'S
// HERALD, DRIVEN. The law (net/sdHerald.js: the rise's, the find's, the fall's and the fade's posts, and which the
// herald owes off the hub's record), and the hub over the real Room with Discord stubbed (server/src/index.js: the rise
// posted on the alarm that raised it, a find and a fall the moment the hub hears them, a found Hollow's fade, an unfound
// one's never, a refusal posted again, each moment once, nothing without a webhook), and the door's role.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { sdRisePost, sdFoundPost, sdFellPost, sdFadePost, sdHeraldPost, sdHeraldDue, sdHeraldName, sdRegionName, readSdHeraldState } from '../src/net/sdHerald.js';
import { HERALD_RETRY_MS, HERALD_FELL_KEEP_MS } from '../src/net/gateHerald.js';
import { sdFind, sdFell, sdGone, SD_LIFETIME_MS, SD_COLLAPSE_MS, SD_COOLDOWN_MS, SD_FADE_GRACE_MS } from '../src/net/sdLaw.js';
import { SOCIAL_ROOM, SD_KEY, SD_INTERNAL_FOUND, SD_INTERNAL_FELL, PIXEL_UNITS } from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';
const ROLE = '112233445566778899', OWN = '998877665544332211';
const T0 = Date.UTC(2026, 9, 9, 20, 0, 0);
const s = (ms) => Math.floor(ms / 1000);
const fresh = { rise: -1, found: -1, end: -1 };
/** Slot 2's name needs no city (The Stopped Bell); slot 4's does (The Last Bell of <city>). */
const risen = (slot, r, at = T0) => ({ s: slot, ph: 'risen', r, at, until: at + SD_LIFETIME_MS, next: at + SD_LIFETIME_MS + SD_COOLDOWN_MS });

// ═══ THE LAW ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('SD-HERALD law: THE NAMES - a slot\'s name when it needs no city, else none (the city is every client\'s own); the region as MapsFile names it, the Bay\'s great cities none (mutants: a city name said bare; the region one off)', () => {
  assert.equal(sdHeraldName(2), 'The Stopped Bell');
  assert.equal(sdHeraldName(1), 'The Clockless Deep');
  assert.equal(sdHeraldName(4), null, 'The Last Bell of <city>: no city on the relay, so no name');
  assert.equal(sdHeraldName(10), null, 'The Hollow Under <city>');
  assert.equal(sdRegionName(0), 'Alik\'r Desert');
  assert.equal(sdRegionName(17), 'Daggerfall');
  assert.equal(sdRegionName(61), 'Cybiades');
  assert.equal(sdRegionName(-1), '', 'the Bay\'s great cities: no region');
  assert.equal(sdRegionName(62), '');
  assert.equal(sdRegionName('17'), '');
});

test('SD-HERALD law: THE RISE\'S POST - the role pinged first and the ONLY mention Discord may make; never where (a find); when it fades unfound, in each reader\'s own time (mutants: a ping with no role; every mention allowed; the fade\'s stamp the next rise\'s)', () => {
  const rec = risen(2, 17);
  const p = sdRisePost({ rec, role: ROLE });
  assert.equal(p.content, `<@&${ROLE}> **A bell rings where there is no bell: an Abyss Dungeon has risen.** A column of brass-gold light stands over it somewhere in the Iliac Bay, and the taverns of the city it stands by speak of it. No map shows it - the first to stand at its door finds it. Unfound, it fades <t:${s(rec.until)}:R>.`);
  assert.deepEqual(p.allowed_mentions, { roles: [ROLE] }, 'the one role, and nothing else');
  assert.ok(!p.content.includes('Daggerfall') && !p.content.includes('Stopped Bell'), 'neither its region nor its name: it must be found');
  const bare = sdRisePost({ rec });
  assert.ok(bare.content.startsWith('**A bell rings'), 'no role: no ping');
  assert.deepEqual(bare.allowed_mentions, { parse: [] }, 'nobody');
});

test('SD-HERALD law: THE FIND\'S POST - the chat\'s own line with no city (who, in its region), its name when it needs no city, the way in and when it fades; the role pinged; a finder\'s name held to letters (mutants: the find pinging nobody; the finder taken raw; the region unnamed; a city name said bare)', () => {
  const rec = sdFind(risen(2, 17), T0 + 60_000, 'Mara');
  const p = sdFoundPost({ rec, role: ROLE });
  assert.equal(p.content, `<@&${ROLE}> **Mara has found an Abyss Dungeon in the Daggerfall region!** The Stopped Bell is on every map now. Fight through it to the Rift at its end: the Shattered Hour waits beyond, one life each to break it before it fades <t:${s(rec.until)}:R>.`);
  assert.deepEqual(p.allowed_mentions, { roles: [ROLE] });
  const city = sdFoundPost({ rec: { ...sdFind(risen(4, -1), T0 + 60_000, 'Mara'), fb: '**@everyone**' } });
  assert.ok(city.content.startsWith('**everyone has found an Abyss Dungeon near the Iliac Bay!** It is on every map now.'), city.content);
  assert.deepEqual(city.allowed_mentions, { parse: [] });
  assert.ok(sdFoundPost({ rec: { ...rec, fb: '' } }).content.startsWith('**Someone has found'), 'no name: someone');
});

test('SD-HERALD law: THE FALL\'S POST - who broke the Hour (the top fighter and how many more fought - `n` counts the top too), where, and when the next may rise; pings nobody (mutants: the others miscounted; the top taken raw; a ping on the fall; the next rise\'s stamp the fade\'s)', () => {
  const found = sdFind(risen(2, 17), T0 + 60_000, 'Mara');
  const rec = sdFell(found, T0 + 600_000, { top: 'Ann', n: 4 });
  const p = sdFellPost({ rec });
  assert.equal(p.content, `**Ann and 3 others broke the Hour** in the Stopped Bell in the Daggerfall region. The Brass Remnant has fallen, and the Abyss Dungeon collapses. The next may rise <t:${s(rec.next)}:R>.`);
  assert.deepEqual(p.allowed_mentions, { parse: [] }, 'no ping');
  assert.equal(sdFellPost({ rec: { ...rec, n: 2 } }).content.split('**')[1], 'Ann and 1 other broke the Hour');
  assert.equal(sdFellPost({ rec: { ...rec, n: 1 } }).content.split('**')[1], 'Ann broke the Hour');
  assert.equal(sdFellPost({ rec: { ...rec, n: 0 } }).content.split('**')[1], 'Ann broke the Hour');
  const city = sdFellPost({ rec: { ...sdFell(sdFind(risen(4, -1), T0, 'Mara'), T0 + 1000, { top: 'Ann', n: 1 }), top: '<@&1>' } });
  assert.ok(city.content.startsWith('**1 broke the Hour** in an Abyss Dungeon near the Iliac Bay.'), city.content);
  assert.ok(sdFellPost({ rec: { ...rec, top: '' } }).content.startsWith('**Someone and 3 others broke the Hour**'));
});

test('SD-HERALD law: THE FADE\'S POST - the chat\'s own line, where, and when the next may rise; pings nobody', () => {
  const rec = sdGone(sdFind(risen(2, 17), T0, 'Mara'), T0 + SD_LIFETIME_MS + SD_FADE_GRACE_MS);
  const p = sdFadePost({ rec });
  assert.equal(p.content, `**The Hour closes over the Stopped Bell in the Daggerfall region, unbroken.** The next Abyss Dungeon may rise <t:${s(rec.next)}:R>.`);
  assert.deepEqual(p.allowed_mentions, { parse: [] });
  assert.ok(sdFadePost({ rec: { ...rec, s: 4, r: -1 } }).content.startsWith('**The Hour closes over an Abyss Dungeon near the Iliac Bay, unbroken.**'));
  assert.deepEqual(sdHeraldPost('rise', rec, ROLE), sdRisePost({ rec, role: ROLE }));
  assert.deepEqual(sdHeraldPost('found', rec, ROLE), sdFoundPost({ rec, role: ROLE }));
  assert.deepEqual(sdHeraldPost('fell', rec, ROLE), sdFellPost({ rec }), 'the fall pings nobody, whatever the role');
  assert.deepEqual(sdHeraldPost('fade', rec, ROLE), sdFadePost({ rec }));
});

test('SD-HERALD law: WHAT IS OWED - each moment once a slot, while it is still so, in the Hollow\'s order: the rise while risen, the find while found and its time not run, the fall until HERALD_FELL_KEEP_MS past its collapse, a FOUND Hollow\'s fade once the hub says it; a moment no longer so let go; nothing for slot 0 (mutants: the rise after the find; the rise twice; the find after the fall; the find twice; a stale fall posted; an unfound fade posted; a fade before the hub says it; slot 0 let go)', () => {
  assert.deepEqual(sdHeraldDue(null, fresh, T0), { kind: null, st: fresh });
  assert.deepEqual(sdHeraldDue({ s: 0, ph: 'gone', r: -1, at: T0, until: T0, next: T0 + 1 }, fresh, T0), { kind: null, st: fresh }, 'the hub\'s first beat: nothing, nothing let go');
  const r = risen(2, 17);
  assert.deepEqual(sdHeraldDue(r, fresh, T0), { kind: 'rise', st: fresh });
  assert.deepEqual(sdHeraldDue(r, { ...fresh, rise: 2 }, T0 + 1000), { kind: null, st: { ...fresh, rise: 2 } }, 'once');
  assert.deepEqual(sdHeraldDue(r, { rise: 1, found: 1, end: 1 }, T0), { kind: 'rise', st: { rise: 1, found: 1, end: 1 } }, 'a new slot\'s');
  assert.deepEqual(sdHeraldDue(r, fresh, r.until).st, { ...fresh, rise: 2, end: -1 }, 'its time run, unfound: the rise let go');
  const f = sdFind(r, T0 + 60_000, 'Mara');
  assert.deepEqual(sdHeraldDue(f, fresh, T0 + 60_000), { kind: 'found', st: { ...fresh, rise: 2 } }, 'found before the rise went: the rise let go, the find owed');
  assert.deepEqual(sdHeraldDue(f, { ...fresh, rise: 2, found: 2 }, T0 + 70_000), { kind: null, st: { ...fresh, rise: 2, found: 2 } }, 'once');
  assert.deepEqual(sdHeraldDue(f, { ...fresh, rise: 2 }, f.until), { kind: null, st: { ...fresh, rise: 2, found: 2 } }, 'its time run: the find let go - and no fade until the hub says it');
  const fl = sdFell(f, T0 + 600_000, { top: 'Ann', n: 3 });
  assert.deepEqual(sdHeraldDue(fl, { ...fresh, rise: 2 }, T0 + 600_000), { kind: 'fell', st: { ...fresh, rise: 2, found: 2 } }, 'fallen before the find went: the find let go, the fall owed');
  assert.deepEqual(sdHeraldDue(fl, { rise: 2, found: 2, end: 2 }, T0 + 600_000).kind, null, 'once');
  const fg = sdGone(fl, fl.fellAt + SD_COLLAPSE_MS);
  assert.equal(sdHeraldDue(fg, { rise: 2, found: 2, end: -1 }, fl.fellAt + SD_COLLAPSE_MS + HERALD_FELL_KEEP_MS - 1).kind, 'fell', 'a hub told late, still news');
  assert.deepEqual(sdHeraldDue(fg, { rise: 2, found: 2, end: -1 }, fl.fellAt + SD_COLLAPSE_MS + HERALD_FELL_KEEP_MS), { kind: null, st: { rise: 2, found: 2, end: 2 } }, 'no news: let go');
  const faded = sdGone(f, f.until + SD_FADE_GRACE_MS);
  assert.equal(sdHeraldDue(faded, { rise: 2, found: 2, end: -1 }, f.until + SD_FADE_GRACE_MS).kind, 'fade');
  assert.deepEqual(sdHeraldDue(faded, { rise: 2, found: 2, end: -1 }, f.until + SD_FADE_GRACE_MS + HERALD_FELL_KEEP_MS), { kind: null, st: { rise: 2, found: 2, end: 2 } }, 'no news: let go');
  const lost = sdGone(r, r.until);
  assert.deepEqual(sdHeraldDue(lost, { rise: 2, found: -1, end: -1 }, r.until), { kind: null, st: { rise: 2, found: -1, end: 2 } }, 'never found: no news to anybody, let go');
  assert.deepEqual(readSdHeraldState(undefined), fresh);
  assert.deepEqual(readSdHeraldState({ rise: 3, found: '3', end: 2.5 }), { rise: 3, found: -1, end: -1 });
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════════════════════

const quiet = (fn) => { const warn = console.warn; console.warn = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; }); };
/** The hub over a driven clock with Discord stubbed - the Abyss Dungeon's herald alone (the gate's and the serpent's, on
 *  the same door, are discordgates.test.js's and serpent2_herald.test.js's): `posts` is every body sent, `answer` what
 *  Discord says. The director's record is seeded (`rec`, else a rise a minute off) and its own beat runs as it does. */
async function withHerald(fn, { env = { GATE_DISCORD_WEBHOOK: HOOK, GATE_DISCORD_ROLE: ROLE, SD_DISCORD_ROLE: OWN }, rec = null, herald = null } = {}) {
  const r = fakeRoom(SOCIAL_ROOM);
  Object.assign(r.env, env);
  r.room._heraldBeat = async () => {}; r.room._heraldNextAt = () => null;
  r.room._serpentHeraldBeat = async () => {}; r.room._serpentHeraldArm = async () => {};
  const realNow = Date.now, realFetch = globalThis.fetch;
  let clock = T0;
  r.store.set(SD_KEY, rec ?? { s: 0, ph: 'gone', r: -1, at: T0, until: T0, next: T0 + 60_000 });
  if (herald) r.store.set('sdherald', herald);
  const posts = [];
  const discord = { answer: () => ({ ok: true, status: 204 }) };
  Date.now = () => clock;
  globalThis.fetch = async (url, init) => {
    posts.push({ url, body: JSON.parse(init.body), method: init.method });
    const a = discord.answer();
    if (a instanceof Error) throw a;
    return a;
  };
  const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); return ws; };
  const found = (fb) => {
    const h = r.store.get(SD_KEY), px = 300, py = 200;
    return r.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_FOUND}`, { method: 'POST', body: JSON.stringify({ s: h.s, px, py, x: (px + 0.5) * PIXEL_UNITS, z: (500 - py - 0.5) * PIXEL_UNITS, fb }) }));
  };
  const fell = (top, n) => r.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ s: r.store.get(SD_KEY).s, at: clock, top, n, rc: [], here: [] }) }));
  try { await quiet(() => fn({ r, join, found, fell, posts, discord, now: () => clock, set: (t) => { clock = t; } })); } finally { Date.now = realNow; globalThis.fetch = realFetch; }
}

test('SD-HERALD relay: A HOLLOW\'S LIFE ON THE CHANNEL - the rise posted on the very alarm that raised it (its own role pinged), the find and the fall the moment the hub hears them, each once; a refusal or a throw posted again HERALD_RETRY_MS on; the collapse says nothing more; the next Hollow\'s rise posted in its turn (mutants: the beat off the alarm; the beat before the director\'s; the find or the fall unarmed; a refusal marked posted; the retry unarmed; the state never kept; the gate\'s role over the Abyss Dungeon\'s own)', async () => {
  await withHerald(async ({ r, join, found, fell, posts, discord, now, set }) => {
    await join('a');
    assert.equal(posts.length, 0, 'nothing has risen');
    set(T0 + 60_000); await r.fire();
    const rec = r.store.get(SD_KEY);
    assert.equal(rec.s, 1); assert.equal(rec.ph, 'risen');
    assert.equal(posts.length, 1, 'the rise, on the alarm that raised it');
    assert.equal(posts[0].url, HOOK); assert.equal(posts[0].method, 'POST');
    assert.deepEqual(posts[0].body, sdRisePost({ rec, role: OWN }), 'the Abyss Dungeon\'s own role');
    assert.deepEqual(r.store.get('sdherald'), { rise: 1, found: -1, end: -1 });
    await r.fire();
    assert.equal(posts.length, 1, 'never twice');
    // the find - Discord throwing first
    set(now() + 3600_000);
    discord.answer = () => new Error('network');
    assert.equal((await found('Mara')).status, 200);
    assert.equal(r.store.get(SD_KEY).ph, 'found');
    assert.equal(r.alarm.at, now(), 'the alarm armed now');
    await r.fire();
    assert.equal(posts.length, 2);
    assert.equal(r.store.get('sdherald').found, -1, 'a throw is no post');
    assert.equal(r.alarm.at, now() + HERALD_RETRY_MS, 'posted again HERALD_RETRY_MS on');
    discord.answer = () => ({ ok: true, status: 204 });
    set(now() + HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 3);
    assert.deepEqual(posts[2].body, sdFoundPost({ rec: r.store.get(SD_KEY), role: OWN }));
    assert.ok(posts[2].body.content.includes('**Mara has found an Abyss Dungeon near the Iliac Bay!** The Clockless Deep is on every map now.'));
    assert.equal(r.store.get('sdherald').found, 1);
    // the fall - Discord refusing first
    set(now() + 1800_000);
    discord.answer = () => ({ ok: false, status: 500 });
    assert.equal((await fell('Ann', 5)).status, 200);
    assert.equal(r.store.get(SD_KEY).ph, 'fell');
    assert.equal(r.alarm.at, now(), 'the alarm armed now, before the collapse\'s');
    await r.fire();
    assert.equal(posts.length, 4); assert.equal(r.store.get('sdherald').end, -1, 'a refusal is no post');
    assert.equal(r.alarm.at, now() + HERALD_RETRY_MS);
    discord.answer = () => ({ ok: true, status: 204 });
    set(now() + HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 5);
    const fallen = r.store.get(SD_KEY);
    assert.deepEqual(posts[4].body, sdFellPost({ rec: fallen }));
    assert.ok(posts[4].body.content.startsWith('**Ann and 4 others broke the Hour** in the Clockless Deep near the Iliac Bay.'));
    assert.deepEqual(r.store.get('sdherald'), { rise: 1, found: 1, end: 1 });
    await fell('Ann', 5); await r.fire();
    assert.equal(posts.length, 5, 'once');
    // the collapse, then the next
    set(fallen.fellAt + SD_COLLAPSE_MS); await r.fire();
    assert.equal(r.store.get(SD_KEY).ph, 'gone');
    assert.equal(posts.length, 5, 'the collapse says nothing more');
    set(fallen.next); await r.fire();
    assert.equal(r.store.get(SD_KEY).s, 2);
    assert.equal(posts.length, 6);
    assert.deepEqual(posts[5].body, sdRisePost({ rec: r.store.get(SD_KEY), role: OWN }));
  });
  // no role of its own: the gate's
  await withHerald(async ({ r, join, posts, set }) => {
    await join('a');
    set(T0 + 60_000); await r.fire();
    assert.ok(posts[0].body.content.startsWith(`<@&${ROLE}> **A bell rings`));
    assert.deepEqual(posts[0].body.allowed_mentions, { roles: [ROLE] });
  }, { env: { GATE_DISCORD_WEBHOOK: HOOK, GATE_DISCORD_ROLE: ROLE } });
});

test('SD-HERALD relay: THE END OF A HOLLOW NOBODY BROKE - a found one\'s fade posted on the alarm that says it, with its name and region; one never found posted never; a find owed at the first hello armed then (mutants: an unfound fade posted; the hello unarmed)', async () => {
  const f = { ...sdFind(risen(2, 17, T0 - SD_LIFETIME_MS + 60_000), T0 - 1000, 'Mara') };
  await withHerald(async ({ r, join, posts, set }) => {
    await join('a');
    assert.ok(r.alarm.at <= f.until, 'armed for the director\'s fade');
    set(f.until + SD_FADE_GRACE_MS); await r.fire();
    assert.equal(r.store.get(SD_KEY).ph, 'gone');
    assert.equal(posts.length, 1);
    assert.equal(posts[0].body.content, `**The Hour closes over the Stopped Bell in the Daggerfall region, unbroken.** The next Abyss Dungeon may rise <t:${s(f.next)}:R>.`);
    assert.deepEqual(r.store.get('sdherald'), { rise: 2, found: 2, end: 2 });
  }, { rec: f, herald: { rise: 2, found: 2, end: -1 } });
  const u = risen(2, 17, T0 - SD_LIFETIME_MS + 60_000);
  await withHerald(async ({ r, join, posts, set }) => {
    await join('a');
    set(u.until); await r.fire();
    assert.equal(r.store.get(SD_KEY).ph, 'gone');
    assert.equal(posts.length, 0, 'never found: news to nobody');
    assert.deepEqual(r.store.get('sdherald'), { rise: 2, found: -1, end: 2 }, 'let go');
  }, { rec: u, herald: { rise: 2, found: -1, end: -1 } });
  // a find the herald owes when the hub wakes: armed at its first hello
  await withHerald(async ({ r, join, posts, now }) => {
    await join('a');
    assert.equal(r.alarm.at, now(), 'armed now, not at the sweep\'s');
    await r.fire();
    assert.equal(posts.length, 1);
    assert.ok(posts[0].body.content.startsWith(`<@&${OWN}> **Mara has found an Abyss Dungeon in the Daggerfall region!**`));
  }, { rec: sdFind(risen(2, 17, T0 - 3600_000), T0 - 1000, 'Mara'), herald: { rise: 2, found: -1, end: -1 } });
});

test('SD-HERALD relay: NO WEBHOOK, NO HERALD - a Hollow rises, is found and falls with nothing posted and nothing of the herald\'s kept, the alarm the director\'s and the sweep\'s; a webhook that is not Discord\'s is none (mutants: the herald ignoring its door; an arm without one)', async () => {
  for (const env of [{}, { GATE_DISCORD_WEBHOOK: 'https://example.com/hook', SD_DISCORD_ROLE: OWN }]) {
    await withHerald(async ({ r, join, found, fell, posts, now, set }) => {
      await join('a');
      assert.equal(r.alarm.at, T0 + 60_000, 'the director\'s rise');
      set(T0 + 60_000); await r.fire();
      assert.equal(r.store.get(SD_KEY).ph, 'risen');
      assert.ok(r.alarm.at > now() + HERALD_RETRY_MS, 'the director\'s and the sweep\'s, never a retry\'s');
      set(now() + 1000); await found('Mara');
      assert.equal(r.store.get(SD_KEY).ph, 'found');
      assert.ok(r.alarm.at > now(), 'no herald: nothing armed for it');
      await r.fire();
      set(now() + 1000); await fell('Ann', 1); await r.fire();
      assert.equal(r.store.get(SD_KEY).ph, 'fell');
      assert.equal(r.store.has('sdherald'), false);
      assert.equal(posts.length, 0);
    }, { env });
  }
});

test('SD-HERALD the door and the order, by source: the role a var beside the serpent\'s, empty by default (the gate\'s then); read with the serpent\'s law; the herald\'s beat after the director\'s on the hub\'s one alarm', () => {
  const toml = rd('server/wrangler.toml');
  assert.match(toml, /^SD_DISCORD_ROLE = "\d*"$/m);
  assert.ok(toml.indexOf('SD_DISCORD_ROLE') > toml.indexOf('SERPENT_DISCORD_ROLE = '), 'beside the serpent\'s');
  const relay = rd('server/src/index.js');
  assert.match(relay, /sdRole: serpentHeraldRole\(this\.env\?\.SD_DISCORD_ROLE, this\.env\?\.GATE_DISCORD_ROLE\)/);
  assert.match(relay, /await this\._sdBeat\(Date\.now\(\)\); await this\._sdHeraldBeat\(Date\.now\(\)\); return; \}/, 'after the director\'s moves');
});
