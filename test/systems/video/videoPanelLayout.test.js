import assert from 'node:assert/strict';
import {
  videoProjectToScreen, videoScreenRectOfCorners, VIDEO_YT_MIN_W, VIDEO_YT_MIN_H,
} from '../../../src/systems/video/videoPanelLayout.js';

const cam = { pos: [0, 1.6, 0], yaw: 0, pitch: 0 };
const fov = Math.PI / 3;
const ahead = videoProjectToScreen([0, 1.6, 4], cam, fov, 800, 600);
assert.ok(ahead);
assert.ok(Math.abs(ahead.x - 400) < 2, 'dead-ahead centres on x');

const behind = videoProjectToScreen([0, 1.6, -2], cam, fov, 800, 600);
assert.equal(behind, null);

const corners = [
  [-0.4, 1.2, 3], [0.4, 1.2, 3], [0.4, 2.0, 3], [-0.4, 2.0, 3],
];
const rect = videoScreenRectOfCorners(corners, (p) => videoProjectToScreen(p, cam, fov, 800, 600));
assert.ok(rect);
assert.ok(rect.width >= VIDEO_YT_MIN_W);
assert.ok(rect.height >= VIDEO_YT_MIN_H);

console.log('videoPanelLayout: ok');
