// AUDIT INSTALL (lane 5 #15, 2026-09-29): THE MAC BUILD IS SIGNED - AD HOC.
//
// electron-builder signs a Mac app only with an identity from a keychain,
// and the release has none (CSC_IDENTITY_AUTO_DISCOVERY: 'false'), so it
// skipped signing (app-builder-lib 25.1.8 macPackager.sign: no identity,
// return) - and the bundle it had renamed and given its own Info.plist kept
// Electron's signature, which those changes BROKE. A downloaded app whose
// signature is broken is "damaged and can't be opened", with no Open Anyway
// to press. An ad-hoc signature is whole, if nobody's: the first launch is
// then the ordinary "cannot be verified" warning that System Settings >
// Privacy & Security answers, which is what the landing page tells a Mac
// player to do. Runs after packing, before the dmg is made from the app;
// every other platform passes straight through.
'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
