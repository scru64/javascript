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
   * contains an unsigned integer larger than `36^12 - 1`.
   */
  static ofInner(bytes: Readonly<Uint8Array>) {
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
   * Creates a value from the `timestamp` and the combined `nodeCtr` field
   * value.
   *
   * @throws RangeError if any argument is negative or larger than their
   * respective maximum value (`36^12 / 2^24 - 1` and `2^24 - 1`, respectively).
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
    // no further check is necessary because `MAX_SCRU64_INT` happens to equal
    // `MAX_TIMESTAMP << 24 | MAX_NODE_CTR`

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
   * Creates an object from a 64-bit unsigned integer.
   *
   * @throws RangeError if the argument is negative or larger than `36^12 - 1`.
   * @category Conversion
   */
  static fromBigInt(value: bigint): Scru64Id {
    if (value < 0 || value >> BigInt(64) > 0) {
      throw new RangeError("out of 64-bit value range");
    }
    const bytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
      bytes[i] = Number(value & BigInt(0xff));
      value >>= BigInt(8);
    }
    return Scru64Id.ofInner(bytes);
  }

  /**
   * Returns the 64-bit unsigned integer representation.
   *
   * @category Conversion
   */
  toBigInt(): bigint {
    return this.bytes.reduce(
      (acc, curr) => (acc << BigInt(8)) | BigInt(curr),
      BigInt(0),
    );
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
 * The generator comes with several different methods that generate a SCRU64 ID:
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
 * All of these methods return a monotonically increasing ID by reusing the
 * previous `timestamp` even if the one provided is smaller than the immediately
 * preceding ID's, unless such a clock rollback is considered significant (by
 * default, approx. 10 seconds). A clock rollback may also be detected when a
 * generator has generated too many IDs within a certain unit of time, because
 * this implementation increments the previous `timestamp` when `counter`
 * reaches the limit to continue instant monotonic generation. When a
 * significant clock rollback is detected:
 *
 * 1. `generate` (OrAbort) methods abort and return `undefined` immediately.
 * 2. `OrReset` variants reset the generator and return a new ID based on the
 *    given `timestamp`, breaking the increasing order of IDs.
 * 3. `OrSleep` and `OrAwait` methods sleep and wait for the next timestamp
 *    tick.
 *
 * The `Core` functions offer low-level primitives to customize the behavior.
 */
export class Scru64Generator {
  private prevTimestamp: number;
  private prevNodeCtr: number;
  private readonly counterSize: number;
  private readonly counterMode: CounterMode;

  /**
   * Creates a new generator with the given node configuration and counter mode.
   *
   * @throws `SyntaxError` if an invalid string `nodeSpec` is passed or
   * `RangeError` if an invalid object `nodeSpec` is passed.
   */
  constructor(nodeSpec: NodeSpec, counterMode?: CounterMode) {
    let errType = RangeError;
    if (typeof nodeSpec === "string") {
      // convert string `nodeSpec` to object
      errType = SyntaxError;
      const m = nodeSpec.match(
        /^(?:([0-9a-z]{12})|([0-9]{1,8}|0x[0-9a-f]{1,6}))\/([0-9]{1,3})$/i,
      );
      if (m === null) {
        throw new errType(
          'could not parse string as node spec (expected: e.g., "42/8", "0xb00/12", "0u2r85hm2pt3/16")',
        );
      } else if (typeof m[1] === "string") {
        nodeSpec = {
          nodePrev: Scru64Id.fromString(m[1]),
          nodeIdSize: parseInt(m[3], 10),
        };
      } else if (typeof m[2] === "string") {
        nodeSpec = {
          nodeId: parseInt(m[2]),
          nodeIdSize: parseInt(m[3], 10),
        };
      } else {
        throw new Error("unreachable");
      }
    }

    // process object `nodeSpec`
    const nodeIdSize = nodeSpec.nodeIdSize;
    if (
      nodeIdSize < 1 ||
      nodeIdSize >= NODE_CTR_SIZE ||
      !Number.isInteger(nodeIdSize)
    ) {
      throw new errType(
        `\`nodeIdSize\` (${nodeIdSize}) must range from 1 to 23`,
      );
    }
    this.counterSize = NODE_CTR_SIZE - nodeIdSize;

    if ("nodePrev" in nodeSpec && typeof nodeSpec.nodePrev === "object") {
      this.prevTimestamp = nodeSpec.nodePrev.timestamp;
      this.prevNodeCtr = nodeSpec.nodePrev.nodeCtr;
    } else if ("nodeId" in nodeSpec && typeof nodeSpec.nodeId === "number") {
      this.prevTimestamp = 0;

      const nodeId = nodeSpec.nodeId;
      if (
        nodeId < 0 ||
        nodeId >= 1 << nodeIdSize ||
        !Number.isInteger(nodeId)
      ) {
        throw new errType(
          `\`nodeId\` (${nodeId}) must fit in \`nodeIdSize\` (${nodeIdSize}) bits`,
        );
      }
      this.prevNodeCtr = nodeId << this.counterSize;
    } else {
      throw new errType("invalid `nodeSpec` argument");
    }

    // reserve one overflow guard bit if `counterSize` is very small
    this.counterMode =
      counterMode ?? new DefaultCounterMode(this.counterSize <= 4 ? 1 : 0);
  }

  /** Returns the `nodeId` of the generator. */
  getNodeId(): number {
    return this.prevNodeCtr >>> this.counterSize;
  }

  /**
   * Returns the `nodePrev` value if the generator is constructed with one or
   * `undefined` otherwise.
   */
  getNodePrev(): Scru64Id | undefined {
    if (this.prevTimestamp > 0) {
      return Scru64Id.fromParts(this.prevTimestamp, this.prevNodeCtr);
    } else {
      return undefined;
    }
  }

  /** Returns the size in bits of the `nodeId` adopted by the generator. */
  getNodeIdSize(): number {
    return NODE_CTR_SIZE - this.counterSize;
  }

  /**
   * Returns the node configuration specifier describing the generator state.
   */
  getNodeSpec(): string {
    const nodePrev = this.getNodePrev();
    return nodePrev !== undefined
      ? `${nodePrev.toString()}/${this.getNodeIdSize()}`
      : `${this.getNodeId()}/${this.getNodeIdSize()}`;
  }

  /**
   * Calculates the combined `nodeCtr` field value for the next `timestamp`
   * tick.
   */
  private renewNodeCtr(timestamp: number): number {
    const nodeId = this.getNodeId();
    const context = { timestamp, nodeId };
    const counter = this.counterMode.renew(this.counterSize, context);
    if (counter >= 1 << this.counterSize) {
      throw new Error("illegal `CounterMode` implementation");
    }

    return (nodeId << this.counterSize) | counter;
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
      this.prevNodeCtr = this.renewNodeCtr(this.prevTimestamp);
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
      this.prevNodeCtr = this.renewNodeCtr(this.prevTimestamp);
    } else if (timestamp + allowance >= this.prevTimestamp) {
      // go on with previous timestamp if new one is not much smaller
      const counterMask = (1 << this.counterSize) - 1;
      if ((this.prevNodeCtr & counterMask) < counterMask) {
        this.prevNodeCtr++;
      } else {
        // increment timestamp at counter overflow
        this.prevTimestamp++;
        this.prevNodeCtr = this.renewNodeCtr(this.prevTimestamp);
      }
    } else {
      // abort if clock went backwards to unbearable extent
      return undefined;
    }
    return Scru64Id.fromParts(this.prevTimestamp, this.prevNodeCtr);
  }
}

/**
 * Represents a node configuration specifier used to build a
 * {@link Scru64Generator}.
 *
 * A `NodeSpec` is usually expressed as a node spec string, which starts with a
 * decimal `nodeId`, a hexadecimal `nodeId` prefixed with `"0x"`, or a 12-digit
 * `nodePrev` SCRU64 ID value, followed by a slash and a decimal `nodeIdSize`
 * value ranging from 1 to 23 (e.g., `"42/8"`, `"0xb00/12"`, `"0u2r85hm2pt3/16"`).
 * The first and second forms create a fresh new generator with the given
 * `nodeId`, while the third form constructs one that generates subsequent
 * SCRU64 IDs to the `nodePrev`.
 */
export type NodeSpec =
  | string
  | { nodeId: number; nodeIdSize: number }
  | { nodePrev: Scru64Id; nodeIdSize: number };

/**
 * An interface of objects to customize the initial counter value for each new
 * `timestamp`.
 *
 * {@link Scru64Generator} calls `renew()` to obtain the initial counter value
 * when the `timestamp` field has changed since the immediately preceding ID.
 * Types implementing this interface may apply their respective logic to
 * calculate the initial counter value.
 */
export type CounterMode = {
  /**
   * Returns the next initial counter value of `counterSize` bits.
   *
   * {@link Scru64Generator} passes the `counterSize` (from 1 to 23) and other
   * context information that may be useful for counter renewal. The returned
   * value must be within the range of `counterSize`-bit unsigned integer.
   */
  renew(
    counterSize: number,
    context: { timestamp: number; nodeId: number },
  ): number;
};

/**
 * The default "initialize a portion counter" strategy.
 *
 * With this strategy, the counter is reset to a random number for each new
 * `timestamp` tick, but some specified leading bits are set to zero to reserve
 * space as the counter overflow guard.
 *
 * Note that the random number generator employed is not cryptographically
 * strong. This mode does not pay for security because a small random number is
 * insecure anyway.
 */
export class DefaultCounterMode {
  /** Creates a new instance with the size (in bits) of overflow guard bits. */
  constructor(private readonly overflowGuardSize: number) {
    if (overflowGuardSize < 0 || !Number.isInteger(overflowGuardSize)) {
      throw new RangeError("`overflowGuardSize` must be an unsigned integer");
    }
  }

  /** Returns the next initial counter value of `counterSize` bits. */
  renew(counterSize: number, context: {}): number {
    const k = Math.max(0, counterSize - this.overflowGuardSize);
    return Math.trunc(Math.random() * (1 << k));
  }
}

declare const SCRU64_NODE_SPEC: string | undefined;

let globalGen: Scru64Generator | undefined = undefined;

const getGlobalGenerator = (): Scru64Generator => {
  if (globalGen === undefined) {
    if (typeof SCRU64_NODE_SPEC === "undefined") {
      throw new Error(
        "scru64: could not read config from SCRU64_NODE_SPEC global var",
      );
    }
    globalGen = new Scru64Generator(SCRU64_NODE_SPEC);
  }
  return globalGen;
};

/**
 * The gateway object that forwards supported method calls to the process-wide
 * global generator.
 *
 * The global generator reads the node configuration from the `SCRU64_NODE_SPEC`
 * global variable by default, and it throws an error if it fails to read a
 * well-formed node spec string (e.g., `"42/8"`, `"0xb00/12"`,
 * `"0u2r85hm2pt3/16"`) when a generator method is first called. See also
 * {@link NodeSpec} for the node spec string format.
 */
export class GlobalGenerator {
  private constructor() {}

  /**
   * Initializes the global generator, if not initialized, with the node spec
   * passed.
   *
   * This method tries to configure the global generator with the argument only
   * when the global generator is not yet initialized. Otherwise, it preserves
   * the existing configuration.
   *
   * @throws `SyntaxError` or `RangeError` according to the semantics of
   * {@link Scru64Generator.constructor | new Scru64Generator(nodeSpec)} if the
   * argument represents an invalid node spec.
   * @returns `true` if this method configures the global generator or `false`
   * if it preserves the existing configuration.
   */
  static initialize(nodeSpec: NodeSpec): boolean {
    if (globalGen === undefined) {
      globalGen = new Scru64Generator(nodeSpec);
      return true;
    } else {
      return false;
    }
  }

  /** Calls {@link Scru64Generator.generate} of the global generator. */
  static generate(): Scru64Id | undefined {
    return getGlobalGenerator().generate();
  }

  /** Calls {@link Scru64Generator.generateOrSleep} of the global generator. */
  static generateOrSleep(): Scru64Id {
    return getGlobalGenerator().generateOrSleep();
  }

  /** Calls {@link Scru64Generator.generateOrAwait} of the global generator. */
  static async generateOrAwait(): Promise<Scru64Id> {
    return getGlobalGenerator().generateOrAwait();
  }

  /** Calls {@link Scru64Generator.getNodeId} of the global generator. */
  static getNodeId(): number {
    return getGlobalGenerator().getNodeId();
  }

  /** Calls {@link Scru64Generator.getNodePrev} of the global generator. */
  static getNodePrev(): Scru64Id | undefined {
    return getGlobalGenerator().getNodePrev();
  }

  /** Calls {@link Scru64Generator.getNodeIdSize} of the global generator. */
  static getNodeIdSize(): number {
    return getGlobalGenerator().getNodeIdSize();
  }

  /** Calls {@link Scru64Generator.getNodeSpec} of the global generator. */
  static getNodeSpec(): string {
    return getGlobalGenerator().getNodeSpec();
  }
}

/**
 * Generates a new SCRU64 ID object using the global generator.
 *
 * The {@link GlobalGenerator} reads the node configuration from the
 * `SCRU64_NODE_SPEC` global variable by default, and it throws an error if it
 * fails to read a well-formed node spec string (e.g., `"42/8"`, `"0xb00/12"`,
 * `"0u2r85hm2pt3/16"`) when a generator method is first called. See also
 * {@link NodeSpec} for the node spec string format.
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick. It employs a blocking busy loop
 * to wait; use the non-blocking {@link scru64} where possible.
 *
 * @throws Error if the global generator is not properly configured.
 */
export const scru64Sync = (): Scru64Id => GlobalGenerator.generateOrSleep();

/**
 * Generates a new SCRU64 ID encoded in the 12-digit canonical string
 * representation using the global generator.
 *
 * The {@link GlobalGenerator} reads the node configuration from the
 * `SCRU64_NODE_SPEC` global variable by default, and it throws an error if it
 * fails to read a well-formed node spec string (e.g., `"42/8"`, `"0xb00/12"`,
 * `"0u2r85hm2pt3/16"`) when a generator method is first called. See also
 * {@link NodeSpec} for the node spec string format.
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick. It employs a blocking busy loop
 * to wait; use the non-blocking {@link scru64String} where possible.
 *
 * @throws Error if the global generator is not properly configured.
 */
export const scru64StringSync = (): string => scru64Sync().toString();

/**
 * Generates a new SCRU64 ID object using the global generator.
 *
 * The {@link GlobalGenerator} reads the node configuration from the
 * `SCRU64_NODE_SPEC` global variable by default, and it throws an error if it
 * fails to read a well-formed node spec string (e.g., `"42/8"`, `"0xb00/12"`,
 * `"0u2r85hm2pt3/16"`) when a generator method is first called. See also
 * {@link NodeSpec} for the node spec string format.
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick.
 *
 * @throws Error if the global generator is not properly configured.
 */
export const scru64 = async (): Promise<Scru64Id> =>
  GlobalGenerator.generateOrAwait();

/**
 * Generates a new SCRU64 ID encoded in the 12-digit canonical string
 * representation using the global generator.
 *
 * The {@link GlobalGenerator} reads the node configuration from the
 * `SCRU64_NODE_SPEC` global variable by default, and it throws an error if it
 * fails to read a well-formed node spec string (e.g., `"42/8"`, `"0xb00/12"`,
 * `"0u2r85hm2pt3/16"`) when a generator method is first called. See also
 * {@link NodeSpec} for the node spec string format.
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick.
 *
 * @throws Error if the global generator is not properly configured.
 */
export const scru64String = async (): Promise<string> => {
  const DELAY = 64;
  while (true) {
    const value = GlobalGenerator.generate();
    if (value !== undefined) {
      return value.toString();
    } else {
      await new Promise((resolve) => setTimeout(resolve, DELAY));
    }
  }
};
