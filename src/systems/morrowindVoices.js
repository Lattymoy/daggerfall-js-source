// @ts-check
// VOICE1: Morrowind speech lines over the player's already-attached Data Files.
//
// The Data Files picker stores loose files and BSAs behind the same archive
// interface (scenes/dataSource.js). This module scans only Sound/Vo entries,
// indexes their closed race/gender/category keys, and loads/decode one file only
// when somebody actually speaks it. Loose files already outrank BSAs because
// loadMorrowindArchives() returns them in engine override order.

import { loadMorrowindArchives, morrowindDataGeneration } from '../scenes/dataSource.js';

const RACE_CODE = Object.freeze({
  Argonian: 'a',
  Breton: 'b',
  DarkElf: 'd',
  HighElf: 'h',
  Khajiit: 'k',
  Nord: 'n',
  Redguard: 'r',
  WoodElf: 'w',
});
const CODE_RACE = Object.freeze(Object.fromEntries(Object.entries(RACE_CODE).map(([race, code]) => [code, race])));
const TYPE_STEM = Object.freeze({
  atk: 'attack',
  cratk: 'crattack',
  fle: 'flee',
  flw: 'follower',
  hlo: 'hello',
  hit: 'hit',
  idl: 'idle',
  int: 'intruder',
  op: 'oppose',
  srv: 'service',
  thf: 'thief',
  uni: 'uniform',
});

export const MW_TYPE_ALIASES = Object.freeze({
  atk: 'attack', attack: 'attack',
  cratk: 'crattack', crattack: 'crattack', creatureattack: 'crattack',
  flee: 'flee', fle: 'flee',
  follower: 'follower', flw: 'follower',
  hello: 'hello', hlo: 'hello',
  hit: 'hit', hurt: 'hit', pain: 'hit',
  idle: 'idle', idl: 'idle',
  intruder: 'intruder', int: 'intruder',
  oppose: 'oppose', op: 'oppose',
  service: 'service', srv: 'service',
  thief: 'thief', thf: 'thief',
  uniform: 'uniform', uni: 'uniform',
  misc: 'misc', special: 'special', werewolf: 'werewolf', wolf: 'werewolf', ww: 'werewolf',
});
export const MW_COLLECTION_ALIASES = Object.freeze({
  default: 'default',
  tb: 'tb', tribunal: 'tb',
  bm: 'bm', bloodmoon: 'bm',
  ord: 'ord', ordinator: 'ord',
  v: 'vampire', vamp: 'vampire', vampire: 'vampire',
});

const norm = (p) => String(p ?? '').replace(/\\/g, '/').toLowerCase();
const bareVoicePath = (p) => {
  const n = norm(p);
  const at = n.indexOf('sound/vo/');
  if (at >= 0) return n.slice(at + 'sound/'.length);
  const vo = n.indexOf('vo/');
  return vo >= 0 ? n.slice(vo) : null;
};
const stemType = (s) => TYPE_STEM[String(s ?? '').toLowerCase()] ?? null;

/** Parse one Data Files voice path into a stable symbolic record.
 * Returns null for non-voice audio and unusual one-offs; those one-offs are
 * collected under the global "special" list by buildMorrowindVoiceCatalog. */
export function parseMorrowindVoicePath(path) {
  const voice = bareVoicePath(path);
  if (!voice || !/\.(mp3|wav)$/i.test(voice)) return null;
  const parts = voice.split('/');
  if (parts.length < 3 || parts[0] !== 'vo') return null;
  const file = parts.at(-1);
  const base = file.replace(/\.(mp3|wav)$/i, '');

  if (parts[1] === 'ww') return { collection: 'global', type: 'werewolf', path: norm(path) };
  if (parts[1] === 'misc') return { collection: 'global', type: 'misc', path: norm(path) };

  if (parts[1] === 'ord') {
    const m = /^(atk|cratk|fle|flw|hlo|hit|idl|int|op|srv|thf|uni)_orm([0-9]+[a-z]?)$/i.exec(base);
    const type = m && stemType(m[1]);
    return type ? { collection: 'ord', type, voiceId: m[2].toLowerCase(), race: 'DarkElf', gender: 'any', path: norm(path) } : null;
  }

  if (parts[1] === 'v') {
    const m = /^(atk|cratk|fle|flw|hlo|hit|idl|int|op|srv|thf|uni)_v([abdhknrw])([fm])([0-9]+[a-z]?)$/i.exec(base);
    const type = m && stemType(m[1]);
    const race = m && CODE_RACE[m[2].toLowerCase()];
    if (!type || !race) return null;
    return { collection: 'vampire', type, voiceId: m[4].toLowerCase(), race, gender: m[3].toLowerCase() === 'f' ? 'female' : 'male', path: norm(path) };
  }

  const dirRace = CODE_RACE[parts[1]];
  const dirGender = parts[2] === 'f' ? 'female' : parts[2] === 'm' ? 'male' : null;
  if (!dirRace || !dirGender) return null;

  const m = /^(b|t)?(atk|cratk|fle|flw|hlo|hit|idl|int|op|srv|thf|uni)_([abdhknrw])([fm])([0-9]+[a-z]?)$/i.exec(base);
  if (!m) return null;
  const type = stemType(m[2]);
  const race = CODE_RACE[m[3].toLowerCase()];
  const gender = m[4].toLowerCase() === 'f' ? 'female' : 'male';
  if (!type || !race || race !== dirRace || gender !== dirGender) return null;
  const collection = m[1]?.toLowerCase() === 'b' ? 'bm' : m[1]?.toLowerCase() === 't' ? 'tb' : 'default';
  return { collection, type, voiceId: m[5].toLowerCase(), race, gender, path: norm(path) };
}

const archiveNames = (archive) => {
  if (typeof archive?.list === 'function') return archive.list();
  if (Array.isArray(archive?.names)) return archive.names.slice();
  return [];
};
const regularKey = (e) => `${e.race}|${e.gender}|${e.collection}|${e.type}`;
const globalKey = (e) => `global|${e.type}`;

/** Build an index over archive ducks. First path wins, matching the loader's
 * loose-before-BSA override order. */
export function buildMorrowindVoiceCatalog(archives) {
  const regular = new Map();
  const globals = new Map();
  const seenPaths = new Set();
  const specials = [];

  for (const archive of archives ?? []) {
    for (const raw of archiveNames(archive)) {
      const path = norm(raw);
      if (seenPaths.has(path) || !bareVoicePath(path) || !/\.(mp3|wav)$/i.test(path)) continue;
      seenPaths.add(path);
      const parsed = parseMorrowindVoicePath(path);
      if (!parsed) {
        const v = bareVoicePath(path);
        if (v && /^vo\/[abdhknrw]\/[fm]\//.test(v)) specials.push({ path, archive });
        continue;
      }
      if (parsed.collection === 'global') {
        const list = globals.get(globalKey(parsed)) ?? [];
        list.push({ ...parsed, archive });
        globals.set(globalKey(parsed), list);
        continue;
      }
      const key = regularKey(parsed);
      let byId = regular.get(key);
      if (!byId) regular.set(key, byId = new Map());
      if (!byId.has(parsed.voiceId)) byId.set(parsed.voiceId, { ...parsed, archive });
    }
  }

  // Global lists are ordinal in the OpenMW command style. Keep them stable
  // independently of BSA directory order.
  for (const list of globals.values()) list.sort((a, b) => a.path.localeCompare(b.path));
  specials.sort((a, b) => a.path.localeCompare(b.path));
  if (specials.length) globals.set('global|special', specials.map((e, i) => ({ collection: 'global', type: 'special', voiceId: String(i + 1), ...e })));

  return { regular, globals };
}

const numericId = (s) => /^\d+$/.test(s) ? Number(s) : null;
const findById = (byId, requested) => {
  if (!byId) return null;
  const raw = String(requested ?? '').toLowerCase();
  if (byId.has(raw)) return byId.get(raw);
  const n = numericId(raw);
  if (n == null || n < 1) return null;
  for (const [id, entry] of byId) if (numericId(id) === n) return entry;
  return null;
};

/** Resolve a relay-stamped Morrowind playback key to the local asset entry. */
export function resolveMorrowindVoice(catalog, playback) {
  if (!catalog || playback?.source !== 'mw') return null;
  if (playback.collection === 'global') {
    const list = catalog.globals.get(`global|${playback.type}`) ?? [];
    const n = numericId(String(playback.voiceId ?? ''));
    return n != null && n >= 1 ? list[n - 1] ?? null : null;
  }
  const race = playback.race;
  const gender = playback.gender;
  if (!RACE_CODE[race] || (gender !== 'male' && gender !== 'female')) return null;
  const exact = catalog.regular.get(`${race}|${gender}|${playback.collection}|${playback.type}`);
  const hit = findById(exact, playback.voiceId);
  if (hit) return hit;
  // Ordinator files are a Dark Elf collection but do not encode a female/
  // male distinction in the filename; either Dark Elf voice can address them.
  if (playback.collection === 'ord' && race === 'DarkElf') {
    return findById(catalog.regular.get(`DarkElf|any|ord|${playback.type}`), playback.voiceId);
  }
  return null;
}

let _cache = null;
export async function morrowindVoiceCatalog() {
  const gen = morrowindDataGeneration();
  if (_cache?.gen === gen) return _cache.catalog;
  const catalog = buildMorrowindVoiceCatalog(await loadMorrowindArchives());
  _cache = { gen, catalog };
  return catalog;
}

/** Resolve, lazily load, and decode one Morrowind voice into AudioEngine.
 * Returns its string buffer key or null when this client has no matching file. */
export async function loadMorrowindVoice(audio, playback) {
  const entry = resolveMorrowindVoice(await morrowindVoiceCatalog(), playback);
  if (!entry) return null;
  const key = `mw-voice:${entry.path}`;
  const bytes = typeof entry.archive?.load === 'function'
    ? await entry.archive.load(entry.path).catch(() => null)
    : entry.archive?.get?.(entry.path) ?? null;
  if (!bytes) return null;
  return await audio.registerSound(key, bytes) ? key : null;
}

/** Compact availability rows for /speechhelp. */
export async function morrowindVoiceHelp(look) {
  const catalog = await morrowindVoiceCatalog();
  const race = look?.race;
  const gender = look?.gender === 'female' ? 'female' : 'male';
  const rows = [];
  for (const [key, byId] of catalog.regular) {
    const [r, g, collection, type] = key.split('|');
    if (r !== race || (g !== gender && g !== 'any')) continue;
    const ids = [...byId.keys()].sort((a, b) => (numericId(a) ?? Infinity) - (numericId(b) ?? Infinity) || a.localeCompare(b));
    if (!ids.length) continue;
    rows.push({ collection, type, count: ids.length, first: ids[0], last: ids.at(-1) });
  }
  for (const [key, list] of catalog.globals) {
    if (!list.length) continue;
    rows.push({ collection: 'global', type: key.slice('global|'.length), count: list.length, first: '1', last: String(list.length) });
  }
  return rows.sort((a, b) => a.collection.localeCompare(b.collection) || a.type.localeCompare(b.type));
}
