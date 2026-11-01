const DEATH_BEACON_KEY = "keta.death-beacons.v1";
const deathMarkerLimit = (value) => Number.isFinite(value) ? Math.max(1, Math.min(10, Math.round(value))) : 5;
const point = (p) => Array.isArray(p) && p.length === 3 && p.every((n) => Number.isFinite(n) && Math.abs(n) < 1e9);
const place = (p) => p && ["world", "interior", "dungeon"].includes(p.space) && typeof p.k === "string" && p.k.length > 0 && p.k.length < 240;
function deathRecord(value) {
  if (!value || !point(value.at) || !place(value.place) || !Number.isFinite(value.time)) return null;
  return {
    ...typeof value.id === "string" && /^[\w-]{1,80}$/.test(value.id) ? { id: value.id } : {},
    at: [...value.at],
    place: { space: value.place.space, k: value.place.k, ...typeof value.place.name === "string" ? { name: value.place.name.slice(0, 100) } : {} },
    time: value.time,
    entrance: point(value.entrance) ? [...value.entrance] : null
  };
}
function sameDeathPlace(a, b) {
  return !!a && !!b && a.space === b.space && (a.space === "world" || a.k === b.k);
}
function deathWorldPoint(record) {
  const r = deathRecord(record);
  if (!r) return null;
  const at = r.place.space === "world" ? r.at : r.entrance;
  return at ? { id: r.id, at, time: r.time, label: r.place.space === "world" ? "Death location" : "Death \u2014 entrance", entrance: r.place.space !== "world" } : null;
}
function deathMapCircle(record) {
  const p = deathWorldPoint(record);
  if (!p) return null;
  return { cx: Math.trunc(p.at[0] / 32768), cy: 499 - Math.trunc(p.at[2] / 32768), r: 2, label: p.label, deathId: p.id ?? "legacy" };
}
function deathBeaconTarget(record, here) {
  const r = deathRecord(record);
  if (!r || !place(here)) return null;
  if (sameDeathPlace(r.place, here)) return { at: r.at, world: here.space !== "dungeon", entrance: false, label: "Last death" };
  if (here.space === "world" && r.place.space !== "world" && r.entrance) return { at: r.entrance, world: true, entrance: true, label: r.place.space === "dungeon" ? "Death location \u2014 dungeon entrance" : "Death location \u2014 entrance" };
  return null;
}
// Bounded per-character history. The old one-record-per-character shelf migrates in place.
// No saves, inventories or authentication data are read or stored here.
function createDeathBeaconStore(storage) {
  let records = [], serial = 0, revision = 0, migrated = false;
  const idFor = () => `death-${Date.now().toString(36)}-${(++serial).toString(36)}`;
  try {
    const raw = storage?.getItem(DEATH_BEACON_KEY);
    const data = raw && raw.length < 262144 ? JSON.parse(raw) : [];
    if (Array.isArray(data)) {
      const valid = data.filter((r) => typeof r?.character === "string" && r.character.length > 0 && r.character.length <= 200 && deathRecord(r));
      const characters = [...new Set(valid.map((r) => r.character).reverse())].slice(0, 16);
      for (const character of characters.reverse()) {
        const seen = /* @__PURE__ */ new Set();
        for (const r of valid.filter((r2) => r2.character === character).slice(-10)) {
          let id = deathRecord(r).id;
          if (!id || seen.has(id)) {
            do {
              id = idFor();
            } while (seen.has(id));
            migrated = true;
          }
          seen.add(id);
          records.push({ character, ...deathRecord(r), id });
        }
      }
      if (records.length !== data.length) migrated = true;
    }
  } catch {
    /* an unavailable or malformed shelf starts empty */
  }
  const save = () => {
    revision++;
    try {
      storage?.setItem(DEATH_BEACON_KEY, JSON.stringify(records));
    } catch {
      /* session-only remains useful */
    }
  };
  if (migrated) save();
  const list = (character) => records.filter((r) => r.character === character).slice().reverse().map(deathRecord);
  const trim = (character, limit) => {
    const keep = new Set(list(character).slice(0, deathMarkerLimit(limit)).map((r) => r.id));
    const before = records.length;
    records = records.filter((r) => r.character !== character || keep.has(r.id));
    if (records.length !== before) save();
  };
  return {
    get revision() {
      return revision;
    },
    read: (character) => list(character)[0] ?? null,
    list,
    trim,
    write(character, value, limit = 5) {
      const r = deathRecord(value);
      if (!r || typeof character !== "string" || !character || character.length > 200) return false;
      const characters = [...new Set(records.map((r2) => r2.character).filter((c) => c !== character).reverse())].slice(0, 15);
      records = records.filter((r2) => r2.character === character || characters.includes(r2.character));
      let id;
      do {
        id = idFor();
      } while (records.some((r2) => r2.id === id));
      records.push({ character, ...r, id });
      trim(character, limit);
      save();
      return true;
    },
    clear(character) {
      records = records.filter((r) => r.character !== character);
      save();
    },
    remove(character, id) {
      const before = records.length;
      records = records.filter((r) => r.character !== character || r.id !== id);
      if (before !== records.length) save();
      return before !== records.length;
    }
  };
}
export {
  DEATH_BEACON_KEY,
  createDeathBeaconStore,
  deathBeaconTarget,
  deathMapCircle,
  deathMarkerLimit,
  deathRecord,
  deathWorldPoint,
  sameDeathPlace
};
