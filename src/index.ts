/**
 * SCRU64: Sortable, Clock-based, Realm-specifically Unique identifier
 *
 * @packageDocumentation
 */

/** The maximum valid value (i.e., `zzzzzzzzzzzz`). */
const MAX_SCRU64_BYTES = Uint8Array.of(65, 194, 28, 184, 224, 255, 255, 255);

/** The total size in bits of the `nodeId` and `counter` fields. */
const NODE_CTR_SIZE = 24;

/// The maximum valid value of the `timestamp` field.
const MAX_TIMESTAMP = 282_429_536_480; // (36n ** 12n - 1n) >> 24n

/// The maximum valid value of the combined `nodeCtr` field.
const MAX_NODE_CTR = (1 << NODE_CTR_SIZE) - 1;

/** Digit characters used in the Base36 notation. */
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** An O(1) map from ASCII code points to Base36 digit values. */
const DECODE_MAP = [
  0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f,
  0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f,
  0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f,
  0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x00, 0x01, 0x02, 0x03,
  0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f,
  0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
  0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23,
  0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
  0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d,
  0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f,
];

/** Represents a SCRU64 ID. */
export class Scru64Id {
  /**
   * An 8-byte byte array containing the 64-bit unsigned integer representation
   * in the big-endian (network) byte order.
   */
  readonly bytes: Readonly<Uint8Array>;

  /** Creates an object from an 8-byte byte array. */
  private constructor(bytes: Readonly<Uint8Array>) {
    this.bytes = bytes;
  }

  /**
   * Creates an object from the internal representation, an 8-byte byte array
   * containing the 64-bit unsigned integer representation in the big-endian
   * (network) byte order.
   *
   * This method does NOT shallow-copy the argument, and thus the created object
   * holds the reference to the underlying buffer.
   *
   * @throws RangeError if the length of the argument is not 8 or the argument
   * contains an integer out of the valid value range.
   */
  static ofInner(bytes: Uint8Array) {
    if (bytes.length !== 8) {
      throw new RangeError("invalid length: " + bytes.length);
    }
    for (let i = 0; i < 8; i++) {
      if (bytes[i] > MAX_SCRU64_BYTES[i]) {
        throw new RangeError("integer out of valid value range");
      } else if (bytes[i] < MAX_SCRU64_BYTES[i]) {
        break;
      }
    }
    return new Scru64Id(bytes);
  }

  /**
   * Returns the 12-digit canonical string representation.
   *
   * @category Conversion
   */
  toString(): string {
    const dst = new Uint8Array(12);
    let minIndex = 99; // any number greater than size of output array
    for (let i = -2; i < 8; i += 5) {
      // implement Base36 using 40-bit words
      let carry = this.subUint(i < 0 ? 0 : i, i + 5);

      // iterate over output array from right to left while carry != 0 but at
      // least up to place already filled
      let j = dst.length - 1;
      for (; carry > 0 || j > minIndex; j--) {
        console.assert(j >= 0);
        carry += dst[j] * 0x100_0000_0000;
        const quo = Math.trunc(carry / 36);
        dst[j] = carry - quo * 36; // remainder
        carry = quo;
      }
      minIndex = j;
    }

    let text = "";
    for (const d of dst) {
      text += DIGITS.charAt(d);
    }
    return text;
  }

  /**
   * Creates an object from a 12-digit string representation.
   *
   * @throws SyntaxError if the argument is not a valid string representation.
   * @category Conversion
   */
  static fromString(value: string): Scru64Id {
    if (value.length !== 12) {
      throw new SyntaxError("invalid length: " + value.length);
    }

    const src = new Uint8Array(12);
    for (let i = 0; i < 12; i++) {
      src[i] = DECODE_MAP[value.charCodeAt(i)] ?? 0x7f;
    }

    return Scru64Id.fromDigitValues(src);
  }

  /**
   * Creates an object from an array of Base36 digit values representing a
   * 12-digit string representation.
   *
   * @throws SyntaxError if the argument does not contain a valid string
   * representation.
   * @category Conversion
   */
  private static fromDigitValues(src: ArrayLike<number>): Scru64Id {
    if (src.length !== 12) {
      throw new SyntaxError("invalid length: " + src.length);
    }

    const dst = new Uint8Array(8);
    let minIndex = 99; // any number greater than size of output array
    for (let i = -4; i < 12; i += 8) {
      // implement Base36 using 8-digit words
      let carry = 0;
      for (let j = i < 0 ? 0 : i; j < i + 8; j++) {
        const e = src[j];
        if (e < 0 || e > 35 || !Number.isInteger(e)) {
          throw new SyntaxError("invalid digit");
        }
        carry = carry * 36 + e;
      }

      // iterate over output array from right to left while carry != 0 but at
      // least up to place already filled
      let j = dst.length - 1;
      for (; carry > 0 || j > minIndex; j--) {
        console.assert(j >= 0);
        carry += dst[j] * 2821109907456; // 36 ** 8
        const quo = Math.trunc(carry / 0x100);
        dst[j] = carry & 0xff; // remainder
        carry = quo;
      }
      minIndex = j;
    }

    return new Scru64Id(dst);
  }

  /** Returns the `timestamp` field value. */
  get timestamp(): number {
    return this.subUint(0, 5);
  }

  /**
   * Returns the `nodeId` and `counter` field values combined as a single
   * integer.
   */
  get nodeCtr(): number {
    return this.subUint(5, 8);
  }

  /**
   * Creates a value from the `timestamp` and the combined `nodeCtr` field
   * value.
   *
   * @throws RangeError if any argument is out of the valid value range.
   * @category Conversion
   */
  static fromParts(timestamp: number, nodeCtr: number): Scru64Id {
    if (
      timestamp < 0 ||
      timestamp > MAX_TIMESTAMP ||
      !Number.isInteger(timestamp)
    ) {
      throw new RangeError("`timestamp` out of range");
    } else if (
      nodeCtr < 0 ||
      nodeCtr > MAX_NODE_CTR ||
      !Number.isInteger(nodeCtr)
    ) {
      throw new RangeError("`nodeCtr` out of range");
    }

    const bytes = new Uint8Array(8);
    bytes[0] = timestamp / 0x1_0000_0000;
    bytes[1] = timestamp >>> 24;
    bytes[2] = timestamp >>> 16;
    bytes[3] = timestamp >>> 8;
    bytes[4] = timestamp;
    bytes[5] = nodeCtr >>> 16;
    bytes[6] = nodeCtr >>> 8;
    bytes[7] = nodeCtr;
    return new Scru64Id(bytes);
  }

  /**
   * Returns the 64-bit unsigned integer representation as a 16-digit
   * hexadecimal string prefixed with "0x".
   *
   * @category Conversion
   */
  toHex(): string {
    const digits = "0123456789abcdef";
    let text = "0x";
    for (const e of this.bytes) {
      text += digits.charAt(e >>> 4);
      text += digits.charAt(e & 0xf);
    }
    return text;
  }

  /** Represents `this` in JSON as a 12-digit canonical string. */
  toJSON(): string {
    return this.toString();
  }

  /**
   * Creates an object from `this`.
   *
   * Note that this class is designed to be immutable, and thus `clone()` is not
   * necessary unless properties marked as read-only are modified.
   */
  clone(): Scru64Id {
    return new Scru64Id(this.bytes.slice(0));
  }

  /** Returns true if `this` is equivalent to `other`. */
  equals(other: Scru64Id): boolean {
    return this.compareTo(other) === 0;
  }

  /**
   * Returns a negative integer, zero, or positive integer if `this` is less
   * than, equal to, or greater than `other`, respectively.
   */
  compareTo(other: Scru64Id): number {
    for (let i = 0; i < 8; i++) {
      const diff = this.bytes[i] - other.bytes[i];
      if (diff !== 0) {
        return Math.sign(diff);
      }
    }
    return 0;
  }

  /** Returns a part of `bytes` as an unsigned integer. */
  private subUint(beginIndex: number, endIndex: number): number {
    let buffer = 0;
    while (beginIndex < endIndex) {
      buffer = buffer * 0x100 + this.bytes[beginIndex++];
    }
    return buffer;
  }
}

/**
 * Represents a SCRU64 ID generator.
 *
 * The generator offers six different methods to generate a SCRU64 ID:
 *
 * | Flavor                      | Timestamp | On big clock rewind |
 * | --------------------------- | --------- | ------------------- |
 * | {@link generate}            | Now       | Returns `undefined` |
 * | {@link generateOrReset}     | Now       | Resets generator    |
 * | {@link generateOrSleep}     | Now       | Sleeps (blocking)   |
 * | {@link generateOrAwait}     | Now       | Sleeps (async)      |
 * | {@link generateOrAbortCore} | Argument  | Returns `undefined` |
 * | {@link generateOrResetCore} | Argument  | Resets generator    |
 *
 * All of these methods return monotonically increasing IDs unless a timestamp
 * provided is significantly (by default, approx. 10 seconds or more) smaller
 * than the one embedded in the immediately preceding ID. If such a significant
 * clock rollback is detected, (1) the `generate` (OrAbort) method aborts and
 * returns `undefined`; (2) the `OrReset` variants reset the generator and
 * return a new ID based on the given timestamp; and, (3) the `OrSleep` and
 * `OrAwait` methods sleep and wait for the next timestamp tick. The `Core`
 * functions offer low-level primitives.
 */
export class Scru64Generator {
  private prevTimestamp: number;
  private prevNodeCtr: number;
  private counterSize: number;

  /**
   * Creates a generator with a node configuration.
   *
   * The `nodeId` must fit in `nodeIdSize` bits, where `nodeIdSize` ranges from
   * 1 to 23, inclusive.
   *
   * @throws RangeError if the arguments represent an invalid node
   * configuration.
   */
  constructor(nodeId: number, nodeIdSize: number) {
    if (
      nodeIdSize <= 0 ||
      nodeIdSize >= NODE_CTR_SIZE ||
      !Number.isInteger(nodeIdSize)
    ) {
      throw new RangeError("`nodeIdSize` must range from 1 to 23");
    } else if (
      nodeId < 0 ||
      nodeId >= 1 << nodeIdSize ||
      !Number.isInteger(nodeId)
    ) {
      throw new RangeError("`nodeId` must fit in `nodeIdSize` bits");
    }

    this.counterSize = NODE_CTR_SIZE - nodeIdSize;
    this.prevTimestamp = 0;
    this.prevNodeCtr = nodeId << this.counterSize;
  }

  /**
   * Creates a generator by parsing a node spec string that describes the node
   * configuration.
   *
   * A node spec string consists of `nodeId` and `nodeIdSize` separated by a
   * slash (e.g., `"42/8"`, `"12345/16"`).
   *
   * @throws Error if the node spec does not conform to the valid syntax or
   * represents an invalid node configuration.
   */
  static parse(nodeSpec: string): Scru64Generator {
    const m = nodeSpec.match(/^([0-9]{1,10})\/([0-9]{1,3})$/);
    if (m === null) {
      throw new SyntaxError(
        "invalid `nodeSpec`; it looks like: `42/8`, `12345/16`",
      );
    }
    return new Scru64Generator(parseInt(m[1], 10), parseInt(m[2], 10));
  }

  /** Returns the `nodeId` of the generator. */
  getNodeId(): number {
    return this.prevNodeCtr >>> this.counterSize;
  }

  /** Returns the size in bits of the `nodeId` adopted by the generator. */
  getNodeIdSize(): number {
    return NODE_CTR_SIZE - this.counterSize;
  }

  /**
   * Calculates the combined `nodeCtr` field value for the next `timestamp`
   * tick.
   */
  private initNodeCtr(): number {
    // initialize counter at `counter_size - 1`-bit random number
    const OVERFLOW_GUARD_SIZE = 1;
    const limit = 1 << (this.counterSize - OVERFLOW_GUARD_SIZE);
    const counter = Math.trunc(Math.random() * limit);

    return (this.getNodeId() << this.counterSize) | counter;
  }

  /**
   * Generates a new SCRU64 ID object from the current `timestamp`, or returns
   * `undefined` upon significant timestamp rollback.
   *
   * See the {@link Scru64Generator} class documentation for the description.
   */
  generate(): Scru64Id | undefined {
    return this.generateOrAbortCore(Date.now(), 10_000);
  }

  /**
   * Generates a new SCRU64 ID object from the current `timestamp`, or resets
   * the generator upon significant timestamp rollback.
   *
   * See the {@link Scru64Generator} class documentation for the description.
   */
  generateOrReset(): Scru64Id {
    return this.generateOrResetCore(Date.now(), 10_000);
  }

  /**
   * Returns a new SCRU64 ID object, or synchronously sleeps and waits for one
   * if not immediately available.
   *
   * See the {@link Scru64Generator} class documentation for the description.
   *
   * This method uses a blocking busy loop to wait for the next `timestamp`
   * tick. Use {@link generateOrAwait} where possible.
   */
  generateOrSleep(): Scru64Id {
    while (true) {
      const value = this.generate();
      if (value !== undefined) {
        return value;
      } else {
        // busy loop
      }
    }
  }

  /**
   * Returns a new SCRU64 ID object, or asynchronously sleeps and waits for one
   * if not immediately available.
   *
   * See the {@link Scru64Generator} class documentation for the description.
   */
  async generateOrAwait(): Promise<Scru64Id> {
    const DELAY = 64;
    while (true) {
      const value = this.generate();
      if (value !== undefined) {
        return value;
      } else {
        await new Promise((resolve) => setTimeout(resolve, DELAY));
      }
    }
  }

  /**
   * Generates a new SCRU64 ID object from a Unix timestamp in milliseconds, or
   * resets the generator upon significant timestamp rollback.
   *
   * See the {@link Scru64Generator} class documentation for the description.
   *
   * @param rollbackAllowance - The amount of `unixTsMs` rollback that is
   * considered significant. A suggested value is `10_000` (milliseconds).
   * @throws RangeError if `unixTsMs` is not a positive integer within the valid
   * range.
   */
  generateOrResetCore(unixTsMs: number, rollbackAllowance: number): Scru64Id {
    const value = this.generateOrAbortCore(unixTsMs, rollbackAllowance);
    if (value !== undefined) {
      return value;
    } else {
      // reset state and resume
      this.prevTimestamp = Math.trunc(unixTsMs / 0x100);
      this.prevNodeCtr = this.initNodeCtr();
      return Scru64Id.fromParts(this.prevTimestamp, this.prevNodeCtr);
    }
  }

  /**
   * Generates a new SCRU64 ID object from a Unix timestamp in milliseconds, or
   * returns `undefined` upon significant timestamp rollback.
   *
   * See the {@link Scru64Generator} class documentation for the description.
   *
   * @param rollbackAllowance - The amount of `unixTsMs` rollback that is
   * considered significant. A suggested value is `10_000` (milliseconds).
   * @throws RangeError if `unixTsMs` is not a positive integer within the valid
   * range.
   */
  generateOrAbortCore(
    unixTsMs: number,
    rollbackAllowance: number,
  ): Scru64Id | undefined {
    const timestamp = Math.trunc(unixTsMs / 0x100);
    const allowance = Math.trunc(rollbackAllowance / 0x100);
    if (timestamp <= 0) {
      throw new RangeError("`timestamp` out of range");
    } else if (allowance < 0 || allowance > 0xff_ffff_ffff) {
      throw new RangeError("`rollbackAllowance` out of reasonable range");
    }

    if (timestamp > this.prevTimestamp) {
      this.prevTimestamp = timestamp;
      this.prevNodeCtr = this.initNodeCtr();
    } else if (timestamp + allowance > this.prevTimestamp) {
      // go on with previous timestamp if new one is not much smaller
      const counterMask = (1 << this.counterSize) - 1;
      if ((this.prevNodeCtr & counterMask) < counterMask) {
        this.prevNodeCtr++;
      } else {
        // increment timestamp at counter overflow
        this.prevTimestamp++;
        this.prevNodeCtr = this.initNodeCtr();
      }
    } else {
      // abort if clock went backwards to unbearable extent
      return undefined;
    }
    return Scru64Id.fromParts(this.prevTimestamp, this.prevNodeCtr);
  }
}

declare const SCRU64_NODE_SPEC: string | undefined;

let globalGenerator: Scru64Generator | undefined = undefined;

const getGlobalGenerator = (): Scru64Generator => {
  if (globalGenerator === undefined) {
    if (typeof SCRU64_NODE_SPEC === "undefined") {
      throw new Error(
        "scru64: could not read config from SCRU64_NODE_SPEC global var",
      );
    }
    globalGenerator = Scru64Generator.parse(SCRU64_NODE_SPEC);
  }
  return globalGenerator;
};

/**
 * Generates a new SCRU64 ID object using the global generator.
 *
 * The global generator reads the node configuration from the `SCRU64_NODE_SPEC`
 * global variable. A node spec string consists of `nodeId` and `nodeIdSize`
 * separated by a slash (e.g., `"42/8"`, `"12345/16"`).
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick. It employs a blocking busy loop
 * to wait; use the non-blocking {@link scru64} where possible.
 *
 * @throws Error if the global generator is not properly configured through the
 * global variable.
 */
export const scru64Sync = (): Scru64Id =>
  getGlobalGenerator().generateOrSleep();

/**
 * Generates a new SCRU64 ID encoded in the 12-digit canonical string
 * representation using the global generator.
 *
 * The global generator reads the node configuration from the `SCRU64_NODE_SPEC`
 * global variable. A node spec string consists of `nodeId` and `nodeIdSize`
 * separated by a slash (e.g., `"42/8"`, `"12345/16"`).
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick. It employs a blocking busy loop
 * to wait; use the non-blocking {@link scru64String} where possible.
 *
 * @throws Error if the global generator is not properly configured through the
 * global variable.
 */
export const scru64StringSync = (): string => scru64Sync().toString();

/**
 * Generates a new SCRU64 ID object using the global generator.
 *
 * The global generator reads the node configuration from the `SCRU64_NODE_SPEC`
 * global variable. A node spec string consists of `nodeId` and `nodeIdSize`
 * separated by a slash (e.g., `"42/8"`, `"12345/16"`).
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick.
 *
 * @throws Error if the global generator is not properly configured through the
 * global variable.
 */
export const scru64 = async (): Promise<Scru64Id> =>
  getGlobalGenerator().generateOrAwait();

/**
 * Generates a new SCRU64 ID encoded in the 12-digit canonical string
 * representation using the global generator.
 *
 * The global generator reads the node configuration from the `SCRU64_NODE_SPEC`
 * global variable. A node spec string consists of `nodeId` and `nodeIdSize`
 * separated by a slash (e.g., `"42/8"`, `"12345/16"`).
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick.
 *
 * @throws Error if the global generator is not properly configured through the
 * global variable.
 */
export const scru64String = async (): Promise<string> =>
  (await scru64()).toString();
