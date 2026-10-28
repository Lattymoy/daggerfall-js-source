// @ts-check
// VIDEO1 — provider registry. New providers: add an adapter + one register() call.

/** @typedef {{
 *   id: string,
 *   capabilities: object,
 *   create: (opts: object) => any,
 * }} VideoProvider */

/** @type {Map<string, VideoProvider>} */
const providers = new Map();

export function registerVideoProvider(/** @type {VideoProvider} */ p) {
  if (!p?.id || typeof p.create !== 'function') throw new TypeError('bad video provider');
  providers.set(p.id, p);
}

export function videoProviderOf(id) {
  return providers.get(id) ?? null;
}

export function videoProviderIds() {
  return [...providers.keys()];
}

export function _resetVideoProviders() {
  providers.clear();
}
