// LANE E probe: the Imperial City's slices' names - each slice its own map id and town grid (capitalPlaceId(k, so)),
// but the building-discovery key is `${regionIndex}:${name}` (scenes/world.js discoveryLocationId).
const R = '/home/user/daggerfall-js-source';
const { imperialSliceName } = await import(`${R}/src/world/imperialCity.js`);
const { IMPERIAL_SPAN } = await import(`${R}/src/world/imperialCity.js`).then((m) => ({ IMPERIAL_SPAN: m.IMPERIAL_SPAN ?? 25 }));
const n = IMPERIAL_SPAN * IMPERIAL_SPAN, by = new Map();
for (let s = 0; s < n; s++) { const nm = imperialSliceName(s); by.set(nm, (by.get(nm) ?? 0) + 1); }
console.log(`${n} slices, ${by.size} names:`, JSON.stringify([...by].sort((a, b) => b[1] - a[1])));
