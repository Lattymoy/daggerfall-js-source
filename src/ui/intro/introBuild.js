// INTRO4 (bible/10-UI/UI-Arc.md INTRO4) - THE FILM'S BUILD, ASKED FOR: the city and the continent from the intro's worker
// (introBuildWorker.js), or - no Worker, a factory that throws, a worker that errors or dies - the same two builds on
// this thread, one after the other with the page let breathe between them. Either way the answer is the same arrays,
// and `city` always resolves before `field`. `new Worker(new URL(...))` stays in exactly that spelling for Vite; the
// factory is injectable so node never evaluates `new Worker`.

function defaultWorkerFactory() {
  return new Worker(new URL('./introBuildWorker.js', import.meta.url), { type: 'module' });
}

/** Start the build. Answers { city: Promise, field: Promise, dispose() } - a disposed build resolves nothing more. */
export function startIntroBuild({ factory = defaultWorkerFactory, here = null } = {}) {
  let worker = null, disposed = false, cityDone = false, fieldDone = false, fellBack = false;
  let resolveCity, resolveField, rejectCity, rejectField;
  const city = new Promise((res, rej) => { resolveCity = res; rejectCity = rej; });
  const field = new Promise((res, rej) => { resolveField = res; rejectField = rej; });
  const giveCity = (c) => { if (!disposed && !cityDone) { cityDone = true; resolveCity(c); } };
  const giveField = (f) => { if (!disposed && !fieldDone) { fieldDone = true; resolveField(f); } };
  const stop = () => { if (worker) { worker.onmessage = null; worker.onerror = null; try { worker.terminate(); } catch { /* gone */ } worker = null; } };
  const onThisThread = here ?? (async () => {
    const [{ buildIntroCity }, { buildTamrielField }] = await Promise.all([import('./introCity.js'), import('./introTamriel.js')]);
    return { buildIntroCity, buildTamrielField };
  });
  const fallBack = async () => {
    if (fellBack || disposed) return;
    fellBack = true;
    stop();
    try {
      const b = await onThisThread();
      if (!cityDone) giveCity(b.buildIntroCity());
      await new Promise((r) => setTimeout(r, 0));
      if (!fieldDone && !disposed) giveField(b.buildTamrielField());
    } catch (error) {
      if (!cityDone) rejectCity(error);
      if (!fieldDone) rejectField(error);
    }
  };
  try { worker = factory(); } catch { worker = null; }
  if (!worker) void fallBack();
  else {
    worker.onmessage = (event) => {
      const m = event.data;
      if (m?.t === 'city') giveCity(m.city);
      else if (m?.t === 'field') { giveField(m.field); stop(); }
      else void fallBack();
    };
    worker.onerror = (event) => { event?.preventDefault?.(); void fallBack(); };
    worker.postMessage({ t: 'build' });
  }
  // a rejection nobody is waiting on yet must not surface as unhandled
  city.catch(() => {}); field.catch(() => {});
  return { city, field, dispose() { disposed = true; stop(); } };
}
