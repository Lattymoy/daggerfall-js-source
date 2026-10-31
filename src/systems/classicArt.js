// NO-BETHESDA2 (2026-10-31): the session's one reader of the player's classic pictures (formats/classicPictures.js),
// over scenes/dataSource.js getBytes - imported on first use, as eotbLantern.js and chargenSession.js reach it. A mod
// picture that is Daggerfall's own is built here from its spec, never carried (bible/01-Overview/Own-Work.md).
import { createClassicPictures } from '../formats/classicPictures.js';

let _art = null;
export const classicArt = () => (_art ??= createClassicPictures(async (name) => (await import('../scenes/dataSource.js')).getBytes(name)));
