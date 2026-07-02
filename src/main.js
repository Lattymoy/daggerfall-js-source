// project-dagger entry point.
// Desktop-only. Hand-rolled WebGL2, no framework. Same doctrine as project-final.
// Phase 1 (Readers-Arc) has no runtime yet - this boots a bare GL context so
// the build gate is real from commit one.

const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2');

if (!gl) {
  document.body.textContent = 'WebGL2 required.';
} else {
  gl.clearColor(0.02, 0.02, 0.05, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  console.log('project-dagger boot ok');
}
