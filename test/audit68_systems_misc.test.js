// AUDIT 68 (2026-09-24), the whole-tree sweep - cluster systems_misc:
// assorted src/systems, survival and world. Each pin below failed on the
// base (ad238de08) and names the finding it holds; the pure refactors and
// dead-code deletions of the same cluster are guarded by the suite they
// already had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { makeVendoredArchive } from '../src/systems/urlArchive.js';
import { cloudIo, pullSlot } from '../src/systems/cloudSaves.js';
import { keepSession } from '../src/net/accountClient.js';
import { setSoundReplacements } from '../src/systems/soundReplacer.js';
import { audio } from '../src/systems/audio.js';
import { dailyStockRolls, stockSoulGems } from '../src/systems/shopStock.js';
import { SongPlayer } from '../src/systems/songPlayer.js';
import { volumeGain } from '../src/systems/gmSynth.js';
import { classicCastingCost } from '../src/systems/spellcost.js';
import { RRI_SPELLS } from '../src/systems/rriKits.js';
import { skillValue, permanentSkillValue, SKILLS } from '../src/systems/skills.js';
import { setEnemySpells, ENEMY_MAGIC_SKILL } from '../src/systems/enemySpells.js';
import { registerEntityFold, computeEntityMods } from '../src/systems/entityMods.js';
import { freeMagickaRecharge } from '../src/systems/guildServices.js';
import { GUILDS } from '../src/systems/guilds.js';
import { parseCareerData } from '../src/systems/specialAdvantages.js';
import { buildCustomCareer, HP_DEFAULT } from '../src/systems/customClass.js';
import { STAT_KEYS_ORDER } from '../src/systems/statMods.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

test('AUDIT 68 X7-urlarchive-poisoned-inflight: a failed load leaves the slot empty, so the next load fetches again', async () => {
  let calls = 0;
  const arc = makeVendoredArchive({ 'meshes/w/gun.nif': 'u' }, async () => {
    calls++;
    if (calls === 1) throw new TypeError('Failed to fetch');
    return new Uint8Array([1, 2, 3]);
  });
  await assert.rejects(arc.load('meshes/w/gun.nif'), /Failed to fetch/);
  assert.equal(arc.loaded('meshes/w/gun.nif'), false);
  assert.deepEqual(await arc.load('meshes/w/gun.nif'), new Uint8Array([1, 2, 3]), 'the retry is a real fetch, not the old rejection');
  assert.equal(calls, 2);
  assert.equal(arc.loaded('meshes/w/gun.nif'), true);
});

test('AUDIT 68 X7-urlarchive-poisoned-inflight: the shipped archives fetch through ONE checked fetcher, and an HTTP error is never cached as the asset', async () => {
  const { fetchUrlBytes } = await import('../src/systems/urlArchive.js');
  assert.equal(typeof fetchUrlBytes, 'function');
  const answers = [
    () => { throw new TypeError('Failed to fetch'); },
    () => new Response('<!doctype html><title>404 Not Found</title>', { status: 404 }),
    () => new Response(new Uint8Array([9, 8, 7])),
  ];
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { seen.push(url); return answers[seen.length - 1](); };
  try {
    const arc = makeVendoredArchive({ 'Meshes/Thunderlock.nif': '/assets/thunderlock-abc.nif' }, fetchUrlBytes);
    await assert.rejects(arc.load('meshes/thunderlock.nif'), /Failed to fetch/);
    await assert.rejects(arc.load('meshes/thunderlock.nif'), /404/);
    assert.equal(arc.loaded('meshes/thunderlock.nif'), false, 'a 404 page is not the mesh');
    assert.deepEqual(await arc.load('meshes/thunderlock.nif'), new Uint8Array([9, 8, 7]));
    assert.deepEqual(seen, ['/assets/thunderlock-abc.nif', '/assets/thunderlock-abc.nif', '/assets/thunderlock-abc.nif']);
  } finally {
    globalThis.fetch = realFetch;
  }
  for (const [f, table] of [['src/systems/ownMwAssets.js', 'OWN_MW_URLS'], ['src/systems/weaponSheathingAssets.js', 'WEAPON_SHEATHING_URLS']]) {
    const s = src(f);
    assert.match(s, new RegExp(`makeVendoredArchive\\(${table}, fetchUrlBytes\\)`), `${f} hands the checked fetcher`);
    assert.doesNotMatch(s, /const fetchBytes = /, `${f} keeps no fetcher of its own`);
  }
});

test('AUDIT 68 X7-cloudsaves-text-unguarded: a download cut off mid-body is a refusal the menu can word, not a throw', async () => {
  const m = new Map();
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
  keepSession(storage, { id: 'p', name: 'Nystul', kind: 'linked', sessionId: 's', secret: 'x' });
  // A REAL Response whose body stream fails partway - what fetch hands
  // back when the connection resets while a save's bytes stream in.
  const cut = () => new Response(new ReadableStream({ start(c) { c.error(new TypeError('network error')); } }),
    { status: 200, headers: { 'content-type': 'application/octet-stream' } });
  const io = cloudIo({ fetch: async () => cut(), storage });
  assert.ok(io, 'signed in');
  assert.deepEqual(await pullSlot(io, storage, { characterId: 'c', saveName: 'QuickSave' }), { ok: false, error: 'offline' });
});

test('AUDIT 68 S20-v-soundrep-regen: the same pack registered again decodes nothing again, and a re-attach keeps ONE copy', async () => {
  let decodes = 0;
  class FakeAudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; }
    async decodeAudioData() { decodes++; return { duration: 1, decoded: decodes }; }
  }
  const hadWindow = 'window' in globalThis;
  globalThis.window = { AudioContext: FakeAudioContext };
  const repKeys = () => [...audio.buffers.keys()].filter((k) => typeof k === 'string' && k.startsWith('rep:AmbientCrickets#'));
  const load = async (f) => new Uint8Array([f.length, 1, 2, 3]);
  try {
    // ensureAudio's shape: every host boot and dungeon entry registers the stored pack, then preloads
    for (let i = 0; i < 3; i++) {
      setSoundReplacements(['AmbientCrickets.wav'], load);
      audio.preloadReplacements();
      await settle();
    }
    assert.equal(decodes, 1, 'one decode for one unchanged pack');
    assert.equal(repKeys().length, 1);
    // the player picks the folder again: the same names may hold new bytes
    setSoundReplacements(['AmbientCrickets.wav'], load, { reattach: true });
    audio.preloadReplacements();
    await settle();
    assert.equal(decodes, 2, 'a re-attach is read again');
    assert.equal(repKeys().length, 1, 'and the retired generation\'s copy is gone');
  } finally {
    setSoundReplacements([], null);
    if (!hadWindow) delete globalThis.window;
  }
});

test('AUDIT 68 S32-daily-stock-rng-first-draw: the first draw of the day moves with the day, so the first Buy Soulgems gem is empty three days in four', () => {
  let lo = 1, hi = 0, empty = 0, sameBucket = 0, prev = null;
  for (let d = 363; d < 723; d++) {   // the first game year (CLASSIC_GAME_START_TIME is day 363)
    const r1 = dailyStockRolls(d)();
    lo = Math.min(lo, r1); hi = Math.max(hi, r1);
    if (prev !== null && Math.floor(r1 * 30) === Math.floor(prev * 30)) sameBucket++;
    prev = r1;
    if (stockSoulGems({ quality: 0, gameMinutes: d * 1440 })[0].trappedSoulType == null) empty++;
  }
  assert.ok(hi - lo > 0.8, `draw #1 spans ${lo}..${hi}`);
  assert.ok(sameBucket < 36, `draw #1 shares its 1/30 bucket with the day before on ${sameBucket}/359 days`);
  assert.ok(empty > 0.6 * 360 && empty < 0.9 * 360, `the first gem is empty on ${empty}/360 days (FailedRoll(25): three in four)`);
});

/** A WebIDL-faithful AudioContext double whose setValueAtTime lands the value (music.test.js's strictCtx). */
function strictCtx() {
  const finite = (t) => { if (!Number.isFinite(t)) throw new TypeError('non-finite'); return t; };
  const param = () => ({
    value: 0,
    setValueAtTime(v, t) { finite(t); this.value = v; },
    linearRampToValueAtTime(v, t) { finite(t); },
    exponentialRampToValueAtTime(v, t) { finite(t); },
    cancelScheduledValues(t) { finite(t); },
  });
  const osc = () => ({ type: '', frequency: param(), detune: param(), connect: () => {}, start: (t) => finite(t), stop: () => {} });
  return {
    currentTime: 0, sampleRate: 44100, destination: {},
    createOscillator: osc,
    createGain: () => ({ gain: param(), connect: () => {} }),
    createBufferSource: () => ({ buffer: null, connect: () => {}, start: (t) => finite(t), stop: () => {} }),
    createBiquadFilter: () => ({ type: '', frequency: param(), Q: param(), connect: () => {} }),
    createBuffer: (ch, n) => ({ getChannelData: () => new Float32Array(n) }),
    createStereoPanner: null,
  };
}

test('AUDIT 68 S32-songplayer-stall-cc7: a stall across a CC7 still lands it on the channel node', () => {
  const ctx = strictCtx();
  const p = new SongPlayer(ctx);
  const events = [{ tick: 0, type: 'controller', channel: 0, controller: 7, value: 127 }];
  for (let i = 0; i < 40; i++) events.push({ tick: i * 100, type: 'noteOn', channel: 0, note: 60, velocity: 100, duration: 50 });
  events.push({ tick: 2000, type: 'controller', channel: 0, controller: 7, value: 20 });
  events.sort((a, b) => a.tick - b.tick);
  p.play({ secondsPerTick: 0.001, durationTicks: 4000, events });
  clearInterval(p._timer); p._timer = null;
  try {
    ctx.currentTime = 0.1; p._pump();
    ctx.currentTime = 3.0; p._pump();   // a background tab: the pump slept across tick 2000
    assert.ok(Math.abs(p._state[0].volume - volumeGain(20)) < 1e-9, 'the fold saw it');
    assert.ok(Math.abs(p._chGains[0].gain.value - volumeGain(20)) < 1e-9, `and so does the node (${p._chGains[0].gain.value})`);
  } finally {
    p.stop();
  }
});

test('AUDIT 68 S32-classic-cost-subtype-255: the registry\'s 255 "no subtype" prices as SPELLS.STD\'s -1, on the records that carry it', () => {
  const respelled = (rec) => ({ ...rec, effects: rec.effects.map((e) => (e.subType === 255 ? { ...e, subType: -1 } : e)) });
  const carriers = Object.values(RRI_SPELLS).filter((s) => s.effects.some((e) => e.subType === 255));
  assert.equal(carriers.length, 5, 'Gentle Fall, Candle, Knick-Knack, Rise and Knock');
  for (const s of carriers) {
    assert.equal(classicCastingCost(s), classicCastingCost(respelled(s)), s.name);
    assert.equal(s.cost, classicCastingCost(respelled(s)), `${s.name}'s stored cost`);
  }
  assert.deepEqual(carriers.map((s) => s.cost), [6, 28, 36, 9, 24]);
});

test('AUDIT 68 S32-skillvalue-override-skips-mods: a pinned skill is a PERMANENT value, and the live read adds its mods on top', () => {
  const foe = { level: 5, skills: 40 };
  setEnemySpells(foe, [], new Map());   // SetPermanentSkillValue x6 - the one producer of skillOverrides
  registerEntityFold('audit68-pin', () => ({ skills: { [SKILLS.Destruction]: 15 } }));
  try {
    computeEntityMods(foe);
  } finally {
    registerEntityFold('audit68-pin', null);
  }
  assert.equal(permanentSkillValue(foe, SKILLS.Destruction), ENEMY_MAGIC_SKILL);
  assert.equal(skillValue(foe, SKILLS.Destruction), ENEMY_MAGIC_SKILL + 15);
  assert.equal(skillValue(foe, SKILLS.Mysticism), ENEMY_MAGIC_SKILL, 'a pin with no mod reads as before');
});

test('AUDIT 68 X1-lights-archive-4-homes: the lights archive is declared in ONE module and the interior lights read it', () => {
  const root = new URL('../src/', import.meta.url);
  const homes = readdirSync(root, { recursive: true })
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /^export const LIGHTS_ARCHIVE\b/m.test(readFileSync(new URL(f, root), 'utf8')));
  assert.deepEqual(homes, ['world/cityLights.js']);
  const il = src('src/world/interiorLights.js');
  assert.match(il, /import \{ LIGHTS_ARCHIVE \} from '\.\/cityLights\.js';/);
  assert.doesNotMatch(il, /const LIGHTS_ARCHIVE = /);
});

test('AUDIT 68 X1-v-onehome-worldcoord-statkeys: MapsFile.WorldCoordToMapPixel has one implementation', async () => {
  const sw = await import('../src/world/streamingWorld.js');
  const mf = await import('../src/formats/mapsFile.js');
  assert.equal(sw.worldCoordToMapPixel, mf.worldCoordToMapPixel);
});

test('AUDIT 68 X4-mg-recharge-career-field: the Mages Guild recharges the career the producers mint with NoRegenSpellPoints', () => {
  const career = () => buildCustomCareer({
    name: 'X', hp: HP_DEFAULT, skills: [SKILLS.Destruction, SKILLS.Alteration, SKILLS.Mysticism, 0, 1, 2, 3, 4, 5, 6, 7, 8],
    stats: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 50])),
  });
  const sorcerer = career();
  parseCareerData(sorcerer, [{ primary: 'inabilityToRegen', secondary: '' }]);
  const member = { guild: 'x', rank: 0, lastRankChange: 0 };
  assert.equal(freeMagickaRecharge(GUILDS.MagesGuild, member, { career: sorcerer }), true);
  assert.equal(freeMagickaRecharge(GUILDS.MagesGuild, { ...member, rank: 9 }, { career: career() }), false, 'a career that regenerates gets nothing');
});

test('AUDIT 68 X4-getitemhands-wrapper: equip.js answers GetItemHands through its one home, not a per-call copy of the item', async () => {
  const equip = await import('../src/systems/equip.js');
  const table = await import('../src/characters/equipTable.js');
  assert.equal(equip.getItemHands, table.getItemHands);
});
