/**
 * SCRU64: Sortable, Clock-based, Realm-specifically Unique identifier
 *
 * @packageDocumentation
 */
/** Represents a SCRU64 ID. */
export declare class Scru64Id {
    /**
     * An 8-byte byte array containing the 64-bit unsigned integer representation
     * in the big-endian (network) byte order.
     */
    readonly bytes: Readonly<Uint8Array>;
    /** Creates an object from an 8-byte byte array. */
    private constructor();
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
    static ofInner(bytes: Readonly<Uint8Array>): Scru64Id;
    /**
     * Creates an object from a 12-digit string representation.
     *
     * @throws SyntaxError if the argument is not a valid string representation.
     * @category Conversion
     */
    static fromString(value: string): Scru64Id;
    /**
     * Creates an object from an array of Base36 digit values representing a
     * 12-digit string representation.
     *
     * @throws SyntaxError if the argument does not contain a valid string
     * representation.
     * @category Conversion
     */
    private static fromDigitValues;
    /**
     * Returns the 12-digit canonical string representation.
     *
     * @category Conversion
     */
    toString(): string;
    /**
     * Creates a value from the `timestamp` and the combined `nodeCtr` field
     * value.
     *
     * @throws RangeError if any argument is negative or larger than their
     * respective maximum value (`36^12 / 2^24 - 1` and `2^24 - 1`, respectively).
     * @category Conversion
     */
    static fromParts(timestamp: number, nodeCtr: number): Scru64Id;
    /** Returns the `timestamp` field value. */
    get timestamp(): number;
    /**
     * Returns the `nodeId` and `counter` field values combined as a single 24-bit
     * integer.
     */
    get nodeCtr(): number;
    /**
     * Creates an object from a 64-bit unsigned integer.
     *
     * @throws RangeError if the argument is negative or larger than `36^12 - 1`.
     * @category Conversion
     */
    static fromBigInt(value: bigint): Scru64Id;
    /**
     * Returns the 64-bit unsigned integer representation.
     *
     * @category Conversion
     */
    toBigInt(): bigint;
    /** Represents `this` in JSON as a 12-digit canonical string. */
    toJSON(): string;
    /**
     * Creates an object from `this`.
     *
     * Note that this class is designed to be immutable, and thus `clone()` is not
     * necessary unless properties marked as read-only are modified.
     */
    clone(): Scru64Id;
    /** Returns true if `this` is equivalent to `other`. */
    equals(other: Scru64Id): boolean;
    /**
     * Returns a negative integer, zero, or positive integer if `this` is less
     * than, equal to, or greater than `other`, respectively.
     */
    compareTo(other: Scru64Id): number;
    /** Returns a part of `bytes` as an unsigned integer. */
    private subUint;
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
export declare class Scru64Generator {
    private prevTimestamp;
    private prevNodeCtr;
    private readonly counterSize;
    private readonly counterMode;
    /**
     * Creates a new generator with the given node configuration and counter mode.
     *
     * @throws `SyntaxError` if an invalid string `nodeSpec` is passed or
     * `RangeError` if an invalid object `nodeSpec` is passed.
     */
    constructor(nodeSpec: NodeSpec, counterMode?: CounterMode);
    /** Returns the `nodeId` of the generator. */
    getNodeId(): number;
    /**
     * Returns the `nodePrev` value if the generator is constructed with one or
     * `undefined` otherwise.
     */
    getNodePrev(): Scru64Id | undefined;
    /** Returns the size in bits of the `nodeId` adopted by the generator. */
    getNodeIdSize(): number;
    /**
     * Returns the node configuration specifier describing the generator state.
     */
    getNodeSpec(): string;
    /**
     * Calculates the combined `nodeCtr` field value for the next `timestamp`
     * tick.
     */
    private renewNodeCtr;
    /**
     * Generates a new SCRU64 ID object from the current `timestamp`, or returns
     * `undefined` upon significant timestamp rollback.
     *
     * See the {@link Scru64Generator} class documentation for the description.
     */
    generate(): Scru64Id | undefined;
    /**
     * Generates a new SCRU64 ID object from the current `timestamp`, or resets
     * the generator upon significant timestamp rollback.
     *
     * See the {@link Scru64Generator} class documentation for the description.
     *
     * Note that this mode of generation is not recommended because rewinding
     * `timestamp` without changing `nodeId` considerably increases the risk of
     * duplicate results.
     */
    generateOrReset(): Scru64Id;
    /**
     * Returns a new SCRU64 ID object, or synchronously sleeps and waits for one
     * if not immediately available.
     *
     * See the {@link Scru64Generator} class documentation for the description.
     *
     * This method uses a blocking busy loop to wait for the next `timestamp`
     * tick. Use {@link generateOrAwait} where possible.
     */
    generateOrSleep(): Scru64Id;
    /**
     * Returns a new SCRU64 ID object, or asynchronously sleeps and waits for one
     * if not immediately available.
     *
     * See the {@link Scru64Generator} class documentation for the description.
     */
    generateOrAwait(): Promise<Scru64Id>;
    /**
     * Generates a new SCRU64 ID object from a Unix timestamp in milliseconds, or
     * resets the generator upon significant timestamp rollback.
     *
     * See the {@link Scru64Generator} class documentation for the description.
     *
     * Note that this mode of generation is not recommended because rewinding
     * `timestamp` without changing `nodeId` considerably increases the risk of
     * duplicate results.
     *
     * @param rollbackAllowance - The amount of `unixTsMs` rollback that is
     * considered significant. A suggested value is `10_000` (milliseconds).
     * @throws RangeError if `unixTsMs` is not a positive integer within the valid
     * range.
     */
    generateOrResetCore(unixTsMs: number, rollbackAllowance: number): Scru64Id;
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
    generateOrAbortCore(unixTsMs: number, rollbackAllowance: number): Scru64Id | undefined;
}
/**
 * Represents a node configuration specifier used to build a
 * {@link Scru64Generator}.
 *
 * A `NodeSpec` is usually expressed as a node spec string, which starts with a
 * decimal `nodeId`, a hexadecimal `nodeId` prefixed by "0x", or a 12-digit
 * `nodePrev` SCRU64 ID value, followed by a slash and a decimal `nodeIdSize`
 * value ranging from 1 to 23 (e.g., "42/8", "0xb00/12", "0u2r85hm2pt3/16"). The
 * first and second forms create a fresh new generator with the given `nodeId`,
 * while the third form constructs one that generates subsequent SCRU64 IDs to
 * the `nodePrev`. See also {@link https://github.com/scru64/spec#informative-usage-notes | the usage notes}
 * in the SCRU64 spec for tips and techniques to design node configurations.
 */
export type NodeSpec = string | {
    nodeId: number;
    nodeIdSize: number;
} | {
    nodePrev: Scru64Id;
    nodeIdSize: number;
};
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
    renew(counterSize: number, context: {
        timestamp: number;
        nodeId: number;
    }): number;
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
export declare class DefaultCounterMode {
    private readonly overflowGuardSize;
    /** Creates a new instance with the size (in bits) of overflow guard bits. */
    constructor(overflowGuardSize: number);
    /** Returns the next initial counter value of `counterSize` bits. */
    renew(counterSize: number, context: {}): number;
}
/**
 * The gateway object that forwards supported method calls to the process-wide
 * global generator.
 *
 * By default, the global generator reads the node configuration from the
 * `SCRU64_NODE_SPEC` global variable when a generator method is first called,
 * and it throws an error if it fails to do so. The node configuration is
 * encoded in a node spec string consisting of `nodeId` and `nodeIdSize`
 * integers separated by a slash (e.g., "42/8", "0xb00/12"; see {@link NodeSpec}
 * for details). You can configure the global generator differently by calling
 * {@link GlobalGenerator.initialize} before the default initializer is
 * triggered.
 */
export declare class GlobalGenerator {
    private constructor();
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
    static initialize(nodeSpec: NodeSpec): boolean;
    /** Calls {@link Scru64Generator.generate} of the global generator. */
    static generate(): Scru64Id | undefined;
    /** Calls {@link Scru64Generator.generateOrSleep} of the global generator. */
    static generateOrSleep(): Scru64Id;
    /** Calls {@link Scru64Generator.generateOrAwait} of the global generator. */
    static generateOrAwait(): Promise<Scru64Id>;
    /** Calls {@link Scru64Generator.getNodeId} of the global generator. */
    static getNodeId(): number;
    /** Calls {@link Scru64Generator.getNodePrev} of the global generator. */
    static getNodePrev(): Scru64Id | undefined;
    /** Calls {@link Scru64Generator.getNodeIdSize} of the global generator. */
    static getNodeIdSize(): number;
    /** Calls {@link Scru64Generator.getNodeSpec} of the global generator. */
    static getNodeSpec(): string;
}
/**
 * Generates a new SCRU64 ID object using the global generator.
 *
 * By default, the global generator reads the node configuration from the
 * `SCRU64_NODE_SPEC` global variable when a generator method is first called,
 * and it throws an error if it fails to do so. The node configuration is
 * encoded in a node spec string consisting of `nodeId` and `nodeIdSize`
 * integers separated by a slash (e.g., "42/8", "0xb00/12"; see {@link NodeSpec}
 * for details). You can configure the global generator differently by calling
 * {@link GlobalGenerator.initialize} before the default initializer is
 * triggered.
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick. It employs a blocking busy loop
 * to wait; use the non-blocking {@link scru64} where possible.
 *
 * @throws Error if the global generator is not properly configured.
 */
export declare const scru64Sync: () => Scru64Id;
/**
 * Generates a new SCRU64 ID encoded in the 12-digit canonical string
 * representation using the global generator.
 *
 * By default, the global generator reads the node configuration from the
 * `SCRU64_NODE_SPEC` global variable when a generator method is first called,
 * and it throws an error if it fails to do so. The node configuration is
 * encoded in a node spec string consisting of `nodeId` and `nodeIdSize`
 * integers separated by a slash (e.g., "42/8", "0xb00/12"; see {@link NodeSpec}
 * for details). You can configure the global generator differently by calling
 * {@link GlobalGenerator.initialize} before the default initializer is
 * triggered.
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick. It employs a blocking busy loop
 * to wait; use the non-blocking {@link scru64String} where possible.
 *
 * @throws Error if the global generator is not properly configured.
 */
export declare const scru64StringSync: () => string;
/**
 * Generates a new SCRU64 ID object using the global generator.
 *
 * By default, the global generator reads the node configuration from the
 * `SCRU64_NODE_SPEC` global variable when a generator method is first called,
 * and it throws an error if it fails to do so. The node configuration is
 * encoded in a node spec string consisting of `nodeId` and `nodeIdSize`
 * integers separated by a slash (e.g., "42/8", "0xb00/12"; see {@link NodeSpec}
 * for details). You can configure the global generator differently by calling
 * {@link GlobalGenerator.initialize} before the default initializer is
 * triggered.
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick.
 *
 * @throws Error if the global generator is not properly configured.
 */
export declare const scru64: () => Promise<Scru64Id>;
/**
 * Generates a new SCRU64 ID encoded in the 12-digit canonical string
 * representation using the global generator.
 *
 * By default, the global generator reads the node configuration from the
 * `SCRU64_NODE_SPEC` global variable when a generator method is first called,
 * and it throws an error if it fails to do so. The node configuration is
 * encoded in a node spec string consisting of `nodeId` and `nodeIdSize`
 * integers separated by a slash (e.g., "42/8", "0xb00/12"; see {@link NodeSpec}
 * for details). You can configure the global generator differently by calling
 * {@link GlobalGenerator.initialize} before the default initializer is
 * triggered.
 *
 * This function usually returns a value immediately, but if not possible, it
 * sleeps and waits for the next timestamp tick.
 *
 * @throws Error if the global generator is not properly configured.
 */
export declare const scru64String: () => Promise<string>;
