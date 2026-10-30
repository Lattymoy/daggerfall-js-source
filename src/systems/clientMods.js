// Native extension boundary: no entity, account, save or renderer object crosses it.
export const CLIENT_MOD_API_VERSION = 1;
export const CLIENT_MOD_CAPABILITIES = Object.freeze(['player.health.read', 'hud.health-label']);
export function validClientMod(mod) {
  return !!mod && typeof mod.id === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(mod.id)
    && mod.apiVersion === CLIENT_MOD_API_VERSION && Array.isArray(mod.requires)
    && mod.requires.length <= CLIENT_MOD_CAPABILITIES.length
    && mod.requires.every(cap => CLIENT_MOD_CAPABILITIES.includes(cap));
}

export function createClientModHost() {
  const mods = new Map(), listeners = new Set(), errors = [];
  let health = null, formatter = null, closed = false;
  const fail = (id, error) => {
    if (errors.length < 16) errors.push(Object.freeze({ id, message: String(error?.message ?? error).slice(0, 200) }));
  };
  const stop = id => {
    const mod = mods.get(id); if (!mod) return;
    mods.delete(id); mod.active = false;
    for (const dispose of [...mod.disposers].reverse()) {
      try { dispose(); } catch (error) { fail(id, error); }
    }
    mod.disposers.clear(); if (!mods.size) health = null;
  };
  const start = (manifest, initialize) => {
    if (closed || !validClientMod(manifest) || typeof initialize !== 'function' || mods.has(manifest.id) || mods.size >= 32) return false;
    const id = manifest.id, caps = new Set(manifest.requires);
    const mod = { active: true, disposers: new Set() }; mods.set(id, mod);
    const requireCap = cap => { if (!mod.active || !caps.has(cap)) throw Error(`Unavailable client mod capability: ${cap}`); };
    const own = dispose => {
      let active = true;
      const release = () => { if (!active) return; active = false; mod.disposers.delete(release); dispose(); };
      mod.disposers.add(release); return release;
    };
    const player = Object.freeze({
      health() { requireCap('player.health.read'); return health; },
      onHealthChange(fn) {
        requireCap('player.health.read');
        if (typeof fn !== 'function' || mod.disposers.size >= 16) throw Error('Invalid or excessive mod subscription');
        let release;
        const notify = value => {
          try {
            const result = fn(value);
            if (result?.then) { result.catch?.(() => {}); throw Error('Health listeners must be synchronous'); }
          } catch (error) { fail(id, error); release(); }
        };
        release = own(() => listeners.delete(notify)); listeners.add(notify); notify(health); return release;
      },
    });
    const hud = Object.freeze({
      formatHealth(fn) {
        requireCap('hud.health-label');
        if (typeof fn !== 'function' || formatter) throw Error('Health label formatter already owned or invalid');
        const registration = { id, fn, release: null, cache: null };
        registration.release = own(() => { if (formatter === registration) formatter = null; });
        formatter = registration; return registration.release;
      },
    });
    try {
      const dispose = initialize(Object.freeze({ apiVersion: CLIENT_MOD_API_VERSION, player, hud }));
      if (dispose !== undefined && typeof dispose !== 'function') {
        dispose?.catch?.(() => {});
        throw Error('Client mod initializer must return a cleanup function or undefined');
      }
      if (dispose) own(dispose);
      return true;
    } catch (error) { fail(id, error); stop(id); return false; }
  };
  return Object.freeze({
    start, stop,
    publishHealth(current, maximum) {
      if (closed || !mods.size) return;
      const available = Number.isFinite(current) && Number.isFinite(maximum) && maximum > 0;
      if (available ? health?.current === current && health?.maximum === maximum : health === null) return;
      health = available ? Object.freeze({ current, maximum }) : null;
      for (const notify of [...listeners]) if (listeners.has(notify)) notify(health);
    },
    healthLabel(current, maximum, fallback) {
      if (!formatter) return fallback;
      const active = formatter;
      const cached = active.cache;
      if (cached && cached.current === current && cached.maximum === maximum && cached.fallback === fallback) return cached.text;
      try {
        const text = active.fn(Object.freeze({ current, maximum }));
        text?.catch?.(() => {});
        if (typeof text !== 'string' || !text.length || text.length > 64) throw Error('Invalid health label');
        active.cache = { current, maximum, fallback, text };
        return text;
      } catch (error) { fail(active.id, error); active.release(); return fallback; }
    },
    reportError: fail,
    status: () => Object.freeze({ apiVersion: CLIENT_MOD_API_VERSION, mods: Object.freeze([...mods.keys()]), errors: Object.freeze([...errors]) }),
    dispose() { closed = true; for (const id of [...mods.keys()]) stop(id); health = null; },
  });
}
export const clientMods = createClientModHost();
