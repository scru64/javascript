/**
 * SCRU64: Sortable, Clock-based, Realm-specifically Unique identifier
 *
 * @packageDocumentation
 */
/** Total size in bits of the `nodeId` and `counter` fields. */
const NODE_CTR_SIZE = 24;
/// Maximum valid value of the `timestamp` field.
const TIMESTAMP_MAX = 282429536480; // (36n ** 12n - 1n) >> 24n
/// Maximum valid value of the combined `nodeCtr` field.
const NODE_CTR_MAX = (1 << NODE_CTR_SIZE) - 1;
/** Digit characters used in the Base36 notation. */
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
/** O(1) map from ASCII code points to Base36 digit values. */
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
    /** Creates an object from a 8-byte byte array. */
    constructor(bytes) {
        this.bytes = bytes;
    }
    /**
     * Returns the 12-digit canonical string representation.
     *
     * @category Conversion
     */
    toString() {
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
                carry += dst[j] * 1099511627776;
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
    static fromString(value) {
        var _a;
        if (value.length !== 12) {
            throw new SyntaxError("invalid length: " + value.length);
        }
        const src = new Uint8Array(12);
        for (let i = 0; i < 12; i++) {
            src[i] = (_a = DECODE_MAP[value.charCodeAt(i)]) !== null && _a !== void 0 ? _a : 0x7f;
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
    static fromDigitValues(src) {
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
    get timestamp() {
        return this.subUint(0, 5);
    }
    /**
     * Returns the `nodeId` and `counter` field values combined as a single
     * integer.
     */
    get nodeCtr() {
        return this.subUint(5, 8);
    }
    /**
     * Creates a value from the `timestamp` and the combined `nodeCtr` field
     * value.
     *
     * @throws RangeError if any argument is out of the valid value range.
     * @category Conversion
     */
    static fromParts(timestamp, nodeCtr) {
        if (timestamp < 0 ||
            timestamp > TIMESTAMP_MAX ||
            !Number.isInteger(timestamp)) {
            throw new RangeError("`timestamp` out of range");
        }
        else if (nodeCtr < 0 ||
            nodeCtr > NODE_CTR_MAX ||
            !Number.isInteger(nodeCtr)) {
            throw new RangeError("`nodeCtr` out of range");
        }
        const bytes = new Uint8Array(8);
        bytes[0] = timestamp / 4294967296;
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
    toHex() {
        const digits = "0123456789abcdef";
        let text = "0x";
        for (const e of this.bytes) {
            text += digits.charAt(e >>> 4);
            text += digits.charAt(e & 0xf);
        }
        return text;
    }
    /** Represents `this` in JSON as a 12-digit canonical string. */
    toJSON() {
        return this.toString();
    }
    /**
     * Creates an object from `this`.
     *
     * Note that this class is designed to be immutable, and thus `clone()` is not
     * necessary unless properties marked as private are modified directly.
     */
    clone() {
        return new Scru64Id(this.bytes.slice(0));
    }
    /** Returns true if `this` is equivalent to `other`. */
    equals(other) {
        return this.compareTo(other) === 0;
    }
    /**
     * Returns a negative integer, zero, or positive integer if `this` is less
     * than, equal to, or greater than `other`, respectively.
     */
    compareTo(other) {
        for (let i = 0; i < 8; i++) {
            const diff = this.bytes[i] - other.bytes[i];
            if (diff !== 0) {
                return Math.sign(diff);
            }
        }
        return 0;
    }
    /** Returns a part of `bytes` as an unsigned integer. */
    subUint(beginIndex, endIndex) {
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
 * | Flavor                       | Timestamp | On big clock rewind  |
 * | ---------------------------- | --------- | -------------------- |
 * | {@link generate}             | Now       | Rewinds state        |
 * | {@link generateNoRewind}     | Now       | Returns `undefined`  |
 * | {@link generateOrWait}       | Now       | Waits (blocking)     |
 * | {@link generateOrWaitAsync}  | Now       | Waits (non-blocking) |
 * | {@link generateCore}         | Argument  | Rewinds state        |
 * | {@link generateCoreNoRewind} | Argument  | Returns `undefined`  |
 *
 * Each method returns monotonically increasing IDs unless a timestamp provided
 * is significantly (by ~10 seconds or more) smaller than the one embedded in
 * the immediately preceding ID. If such a significant clock rollback is
 * detected, (i) the standard `generate` rewinds the generator state and returns
 * a new ID based on the current timestamp; (ii) `NoRewind` variants keep the
 * state untouched and return `undefined`; and, (iii) `OrWait` functions sleep
 * and wait for the next timestamp tick. `core` functions offer low-level
 * primitives.
 */
export class Scru64Generator {
    /**
     * Creates a generator with a node configuration.
     *
     * The `nodeId` must fit in `nodeIdSize` bits, where `nodeIdSize` ranges from
     * 1 to 23, inclusive.
     *
     * @throws RangeError if the arguments represent an invalid node
     * configuration.
     */
    constructor(nodeId, nodeIdSize) {
        if (nodeIdSize <= 0 ||
            nodeIdSize >= NODE_CTR_SIZE ||
            !Number.isInteger(nodeIdSize)) {
            throw new RangeError("`nodeIdSize` must range from 1 to 23");
        }
        else if (nodeId < 0 ||
            nodeId >= 1 << nodeIdSize ||
            !Number.isInteger(nodeId)) {
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
    static parse(nodeSpec) {
        const m = nodeSpec.match(/^([0-9]+)\/([0-9]+)$/);
        if (m === null) {
            throw new SyntaxError("invalid `nodeSpec`; it looks like: `42/8`, `12345/16`");
        }
        return new Scru64Generator(parseInt(m[1], 10), parseInt(m[2], 10));
    }
    /** Returns the `nodeId` of the generator. */
    getNodeId() {
        return this.prevNodeCtr >>> this.counterSize;
    }
    /** Returns the size in bits of the `nodeId` adopted by the generator. */
    getNodeIdSize() {
        return NODE_CTR_SIZE - this.counterSize;
    }
    /**
     * Calculates the combined `nodeCtr` field value for the next `timestamp`
     * tick.
     */
    initNodeCtr() {
        // initialize counter at `counter_size - 1`-bit random number
        const OVERFLOW_GUARD_SIZE = 1;
        const limit = 1 << (this.counterSize - OVERFLOW_GUARD_SIZE);
        const counter = Math.trunc(Math.random() * limit);
        return (this.getNodeId() << this.counterSize) | counter;
    }
    /**
     * Generates a new SCRU64 ID object from the current `timestamp`.
     *
     * See the {@link Scru64Generator} class documentation for the description.
     */
    generate() {
        return this.generateCore(Date.now());
    }
    /**
     * Generates a new SCRU64 ID object from the current `timestamp`, guaranteeing
     * the monotonic order of generated IDs despite a significant timestamp
     * rollback.
     *
     * See the {@link Scru64Generator} class documentation for the description.
     */
    generateNoRewind() {
        return this.generateCoreNoRewind(Date.now());
    }
    /**
     * Returns a new SCRU64 ID object, or waits for one if not immediately
     * available.
     *
     * See the {@link Scru64Generator} class documentation for the description.
     *
     * This method uses a blocking busy loop to wait for the next `timestamp`
     * tick. Use {@link generateOrWaitAsync} where possible.
     */
    generateOrWait() {
        while (true) {
            const value = this.generateNoRewind();
            if (value !== undefined) {
                return value;
            }
            else {
                // busy loop
            }
        }
    }
    /**
     * Returns a new SCRU64 ID object, or waits for one if not immediately
     * available.
     *
     * See the {@link Scru64Generator} class documentation for the description.
     */
    async generateOrWaitAsync() {
        const DELAY = 64;
        while (true) {
            const value = this.generateNoRewind();
            if (value !== undefined) {
                return value;
            }
            else {
                await new Promise((resolve) => setTimeout(resolve, DELAY));
            }
        }
    }
    /**
     * Generates a new SCRU64 ID object from a Unix timestamp in milliseconds.
     *
     * See the {@link Scru64Generator} class documentation for the description.
     *
     * @throws RangeError if the argument is not a positive integer within the
     * valid range.
     */
    generateCore(unixTsMs) {
        const value = this.generateCoreNoRewind(unixTsMs);
        if (value !== undefined) {
            return value;
        }
        else {
            // reset state and resume
            this.prevTimestamp = Math.trunc(unixTsMs / 0x100);
            this.prevNodeCtr = this.initNodeCtr();
            return Scru64Id.fromParts(this.prevTimestamp, this.prevNodeCtr);
        }
    }
    /**
     * Generates a new SCRU64 ID object from a Unix timestamp in milliseconds,
     * guaranteeing the monotonic order of generated IDs despite a significant
     * timestamp rollback.
     *
     * See the {@link Scru64Generator} class documentation for the description.
     *
     * @throws RangeError if the argument is not a positive integer within the
     * valid range.
     */
    generateCoreNoRewind(unixTsMs) {
        const ROLLBACK_ALLOWANCE = 40; // x256 milliseconds = ~10 seconds
        const timestamp = Math.trunc(unixTsMs / 0x100);
        if (timestamp <= 0) {
            throw new RangeError("`timestamp` out of range");
        }
        if (timestamp > this.prevTimestamp) {
            this.prevTimestamp = timestamp;
            this.prevNodeCtr = this.initNodeCtr();
        }
        else if (timestamp + ROLLBACK_ALLOWANCE > this.prevTimestamp) {
            // go on with previous timestamp if new one is not much smaller
            const counterMask = (1 << this.counterSize) - 1;
            if ((this.prevNodeCtr & counterMask) < counterMask) {
                this.prevNodeCtr++;
            }
            else {
                // increment timestamp at counter overflow
                this.prevTimestamp++;
                this.prevNodeCtr = this.initNodeCtr();
            }
        }
        else {
            // abort if clock moves back to unbearable extent
            return undefined;
        }
        return Scru64Id.fromParts(this.prevTimestamp, this.prevNodeCtr);
    }
}
let globalGenerator = undefined;
const getGlobalGenerator = () => {
    if (globalGenerator === undefined) {
        if (typeof SCRU64_NODE_SPEC === "undefined") {
            throw new Error("scru64: could not read config from SCRU64_NODE_SPEC global var");
        }
        globalGenerator = Scru64Generator.parse(SCRU64_NODE_SPEC);
    }
    return globalGenerator;
};
/**
 * Generates a new SCRU64 ID object using the global generator.
 *
 * @throws Error if the global generator is not properly configured through the
 * `SCRU64_NODE_SPEC` global variable.
 */
export const scru64 = () => getGlobalGenerator().generateOrWait();
/**
 * Generates a new SCRU64 ID encoded in the 12-digit canonical string
 * representation using the global generator.
 *
 * @throws Error if the global generator is not properly configured through the
 * `SCRU64_NODE_SPEC` global variable.
 */
export const scru64String = () => scru64().toString();
/**
 * Generates a new SCRU64 ID object using the global generator.
 *
 * @throws Error if the global generator is not properly configured through the
 * `SCRU64_NODE_SPEC` global variable.
 */
export const scru64Async = async () => getGlobalGenerator().generateOrWaitAsync();
/**
 * Generates a new SCRU64 ID encoded in the 12-digit canonical string
 * representation using the global generator.
 *
 * @throws Error if the global generator is not properly configured through the
 * `SCRU64_NODE_SPEC` global variable.
 */
export const scru64StringAsync = async () => (await scru64Async()).toString();
