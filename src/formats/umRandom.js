// Unity.Mathematics Random: xorshift PRNG with Wang-hash index seeding.
// 1:1 translation from the Unity.Mathematics source (MIT,
// Unity Technologies, github.com/Unity-Technologies/Unity.Mathematics) -
// unlike Mathf.PerlinNoise this one IS open source, so the beach-line
// randomness in terrain texturing is byte-exact with DFU. Verbatim:
//   - CreateFromIndex(i) seeds with WangHash(i + 62) (offset so
//     uint.MaxValue hashes to zero instead of 61).
//   - The constructor burns one NextState().
//   - NextState is xorshift 13/17/5 returning the PRE-update state.
//   - NextFloat reinterprets (0x3f800000 | state >> 9) as a float and
//     subtracts 1 -> [0, 1); the (min, max) form scales it.

const F32 = new Float32Array(1);
const U32 = new Uint32Array(F32.buffer);

function wangHash(n) {
  n = ((n ^ 61) ^ (n >>> 16)) >>> 0;
  n = (n * 9) >>> 0;
  n = (n ^ (n >>> 4)) >>> 0;
  n = Math.imul(n, 0x27d4eb2d) >>> 0;
  n = (n ^ (n >>> 15)) >>> 0;
  return n;
}

export class UMRandom {
  /** new Random(seed): state = seed, then one NextState() burn. */
  constructor(seed) {
    this.state = seed >>> 0;
    this._nextState();
  }

  /** Random.CreateFromIndex(index). */
  static createFromIndex(index) {
    return new UMRandom(wangHash((index + 62) >>> 0));
  }

  _nextState() {
    const t = this.state;
    let s = this.state;
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >>> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    this.state = s;
    return t;
  }

  /** Uniform float in [0, 1), verbatim bit trick. */
  nextFloat() {
    U32[0] = (0x3f800000 | (this._nextState() >>> 9)) >>> 0;
    return F32[0] - 1.0;
  }

  /** Uniform float in [min, max). */
  nextFloatRange(min, max) {
    return this.nextFloat() * (max - min) + min;
  }
}
