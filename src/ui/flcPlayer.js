// THE FLIC PLAYER (F2) - Game/UserInterface/FLCPlayer.cs's pacing law
// over the F1 reader. DFU's player is a Unity Panel that uploads a
// texture; the port keeps only the part that is behaviour - WHEN a
// frame changes and WHEN the animation ends - and hands the caller
// the frame to draw in whatever idiom it uses.
//
// Update()'s ORDER IS THE LAW and is preserved exactly:
//   1. the END CHECK RUNS FIRST: a non-looping animation whose
//      CurrentFrame has reached NumOfFrames stops and raises
//      OnAnimEnd - before any pacing, so the end lands on the first
//      tick after the last frame was decoded.
//   2. nothing happens unless playing and ready.
//   3. the frame clock gates: below nextFrameTime, return.
//   4. the CURRENT buffer is displayed, and only THEN is the next
//      frame decoded. So what you see is always the frame decoded on
//      the previous tick, and the RING frame is never displayed.
//
// DFU paces on Time.realtimeSinceStartup; the port counts down dt,
// which is the same law without a wall clock (and is what every other
// timed thing here rides).

export class FlcPlayer {
  /**
   * @param {import('../formats/flcFile.js').FlcFile} flcFile a LOADED reader
   * @param {object} [opts] loop (DFU's Loop), onAnimEnd(player)
   */
  constructor(flcFile, { loop = false, onAnimEnd = null } = {}) {
    this.flc = flcFile;
    this.loop = loop;
    this.onAnimEnd = onAnimEnd;
    this.playing = false;
    this._timeToNextFrame = 0;
    this._displayed = null;   // the frame the caller draws, or null
  }

  get width() { return this.flc?.width ?? 0; }
  get height() { return this.flc?.height ?? 0; }
  /** The frame to draw ({width,height,colors}), or null before the
   *  first one lands - DFU shows its cleared texture until then. */
  get frame() { return this._displayed; }

  /** Start(): rewind, arm the clock, play. */
  start() {
    if (!this.flc || !this.flc.readyToPlay) return false;
    this.flc.currentFrame = 0;
    this._timeToNextFrame = this.flc.frameDelay;
    this._displayed = null;
    this.playing = true;
    return true;
  }

  /** Stop(): DFU also drops the background texture, which here is
   *  the displayed frame. */
  stop() {
    this.playing = false;
    this._displayed = null;
  }

  /** One frame of Update(), in DFU's order. */
  tick(dt) {
    // 1. the end check, FIRST
    if (this.playing && !this.loop && this.flc.currentFrame >= this.flc.header.numOfFrames) {
      this.playing = false;
      this.onAnimEnd?.(this);
      return;
    }
    // 2. playing and ready only
    if (!this.flc || !this.flc.readyToPlay || !this.playing) return;
    // 3. the frame clock
    this._timeToNextFrame -= dt;
    if (this._timeToNextFrame > 0) return;
    this._timeToNextFrame = this.flc.frameDelay;
    // 4. display the CURRENT buffer, then decode the next
    this._displayed = this.flc.getFrame();
    this.flc.bufferNextFrame();
  }
}
