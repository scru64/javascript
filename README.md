# SCRU64: Sortable, Clock-based, Realm-specifically Unique identifier

[![npm](https://img.shields.io/npm/v/scru64)](https://www.npmjs.com/package/scru64)
[![License](https://img.shields.io/npm/l/scru64)](https://github.com/scru64/javascript/blob/main/LICENSE)

SCRU64 ID offers compact, time-ordered unique identifiers generated by
distributed nodes. SCRU64 has the following features:

- ~62-bit non-negative integer storable as signed/unsigned 64-bit integer
- Sortable by generation time (as integer and as text)
- 12-digit case-insensitive textual representation (Base36)
- ~38-bit Unix epoch-based timestamp that ensures useful life until year 4261
- Variable-length node/machine ID and counter fields that share 24 bits

```javascript
// pass node ID through global variable
globalThis.SCRU64_NODE_SPEC = "42/8";

import { scru64Sync, scru64StringSync } from "scru64";
// or on browsers:
// import { scru64Sync, scru64StringSync } from "https://unpkg.com/scru64@^0.1";

// generate a new identifier object
const x = scru64Sync();
console.log(String(x)); // e.g. "0u2r85hm2pt3"
console.log(BigInt(x.toHex())); // as a 64-bit unsigned integer

// generate a textual representation directly
console.log(scru64StringSync()); // e.g. "0u2r85hm2pt4"
```

See [SCRU64 Specification] for details.

SCRU64's uniqueness is realm-specific, i.e., dependent on the centralized
assignment of node ID to each generator. If you need decentralized, globally
unique time-ordered identifiers, consider [SCRU128].

[SCRU64 Specification]: https://github.com/scru64/spec
[SCRU128]: https://github.com/scru128/spec

## License

Licensed under the Apache License, Version 2.0.

## See also

- [API Documentation](https://scru64.github.io/javascript/docs/)
