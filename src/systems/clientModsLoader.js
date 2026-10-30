import { clientMods, validClientMod } from './clientMods.js';

/** Does not block boot. Dispose remains available while fetch/imports are pending. */
export function loadClientMods({ host = clientMods, fetchIndex = () => fetch('/__client_mods/index.json'), importModule = url => import(/* @vite-ignore */ url) } = {}) {
  let stopped = false;
  const dispose = () => { stopped = true; host.dispose(); };
  const ready = (async () => {
    try {
      const response = await fetchIndex();
      if (stopped || !response.ok) return;
      const index = await response.json();
      if (stopped || index?.enabled !== true || index.apiVersion !== 1 || !Array.isArray(index.mods) || index.mods.length > 32) return;
      const seen = new Set();
      for (const mod of index.mods) {
        if (stopped || !validClientMod(mod) || seen.has(mod.id)) continue;
        seen.add(mod.id);
        if (typeof mod.entry !== 'string' || !/^[a-zA-Z0-9_./-]+\.(?:m?js)$/.test(mod.entry) || mod.entry.split('/').some(p => !p || p === '.' || p === '..')) continue;
        try {
          const loaded = await importModule(`/__client_mods/${mod.id}/${mod.entry}`);
          if (!stopped) host.start(mod, loaded.default);
        } catch (error) { if (!stopped) host.reportError(mod.id, error); }
      }
    } catch (error) { if (!stopped) host.reportError('loader', error); }
  })();
  return Object.freeze({ ready, dispose });
}
