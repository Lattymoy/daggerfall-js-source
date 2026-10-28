// SNOW-THREAD (2026-10-26): the snow's build worker - snowBuildKernel.js on a module Worker's thread. A build that
// throws is a fault of the kernel's, never of the ground: the worker says so and the main thread builds on its own
// from then on (snowBuildClient.js `_down`).

import { SnowBuildKernel } from './snowBuildKernel.js';

const kernel = new SnowBuildKernel();

globalThis.onmessage = (ev) => {
  const m = ev.data;
  try {
    const out = kernel.handle(m);
    if (out?.reply) globalThis.postMessage(out.reply, out.transfer ?? []);
  } catch (e) {
    globalThis.postMessage({ t: 'error', id: m?.id ?? 0, message: String(e?.stack ?? e) });
  }
};
