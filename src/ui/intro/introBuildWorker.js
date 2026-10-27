// INTRO4 (bible/10-UI/UI-Arc.md INTRO4) - THE FILM'S HEAVY HALF, OFF THE PAGE'S THREAD: the Imperial City (its landmarks'
// meshes, its houses, its trees, its ground - introCity.js) and then the continent's field (introTamriel.js), each
// posted the moment it is built, its arrays transferred. The city is the film's first frame and comes first; the
// continent is not wanted until the ascent. Pure modules only - a worker has no DOM.
//
// Message in: {t: 'build'}. Messages out: {t: 'city', city}, {t: 'field', field}, or {t: 'error', message}.
import { buildIntroCity, introCityTransfers } from './introCity.js';
import { buildTamrielField } from './introTamriel.js';

globalThis.onmessage = (event) => {
  if (event.data?.t !== 'build') return;
  try {
    const city = buildIntroCity();
    globalThis.postMessage({ t: 'city', city }, introCityTransfers(city));
    const field = buildTamrielField();
    globalThis.postMessage({ t: 'field', field }, [field.rgba.buffer, field.border.buffer, field.province.buffer]);
  } catch (error) {
    globalThis.postMessage({ t: 'error', message: String(error?.message ?? error) });
  }
};
