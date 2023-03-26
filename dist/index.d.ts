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
     * contains an integer out of the valid value range.
     */
    static ofInner(bytes: Uint8Array): Scru64Id;
    /**
     * Returns the 12-digit canonical string representation.
     *
     * @category Conversion
     */
    toString(): string;
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
    /** Returns the `timestamp` field value. */
    get timestamp(): number;
    /**
     * Returns the `nodeId` and `counter` field values combined as a single
     * integer.
     */
    get nodeCtr(): number;
    /**
     * Creates a value from the `timestamp` and the combined `nodeCtr` field
     * value.
     *
     * @throws RangeError if any argument is out of the valid value range.
     * @category Conversion
     */
    static fromParts(timestamp: number, nodeCtr: number): Scru64Id;
    /**
     * Returns the 64-bit unsigned integer representation as a 16-digit
     * hexadecimal string prefixed with "0x".
     *
     * @category Conversion
     */
    toHex(): string;
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
export declare class Scru64Generator {
    private prevTimestamp;
    private prevNodeCtr;
    private counterSize;
    /**
     * Creates a generator with a node configuration.
     *
     * The `nodeId` must fit in `nodeIdSize` bits, where `nodeIdSize` ranges from
     * 1 to 23, inclusive.
     *
     * @throws RangeError if the arguments represent an invalid node
     * configuration.
     */
    constructor(nodeId: number, nodeIdSize: number);
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
    static parse(nodeSpec: string): Scru64Generator;
    /** Returns the `nodeId` of the generator. */
    getNodeId(): number;
    /** Returns the size in bits of the `nodeId` adopted by the generator. */
    getNodeIdSize(): number;
    /**
     * Calculates the combined `nodeCtr` field value for the next `timestamp`
     * tick.
     */
    private initNodeCtr;
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
export declare const scru64Sync: () => Scru64Id;
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
export declare const scru64StringSync: () => string;
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
export declare const scru64: () => Promise<Scru64Id>;
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
export declare const scru64String: () => Promise<string>;
