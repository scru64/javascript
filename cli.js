#!/usr/bin/env node

import { EOL } from "node:os";
import { exit, env, stdout } from "node:process";
import { parseArgs } from "node:util";
import { pipeline } from "node:stream/promises";

import { GlobalGenerator, scru64String } from "scru64";

// check arguments
let options = undefined;
try {
  options = parseArgs({
    options: {
      count: { type: "string", short: "n" },
      help: { type: "boolean", short: "h" },
    },
  }).values;

  if (options.count && !/^[0-9]+$/.test(options.count)) {
    throw new TypeError("Invalid argument to option '-n, --count <value>'");
  }
} catch (e) {
  console.error(`Error: ${e.message ?? e}`);
  exit(1);
}

// print usage if requested
if (options.help) {
  console.log("Usage: SCRU64_NODE_SPEC=<spec> scru64 [-n <count>]");
  exit(0);
}

// read node spec from env var
try {
  if (typeof env.SCRU64_NODE_SPEC === "string") {
    GlobalGenerator.initialize(env.SCRU64_NODE_SPEC);
  } else {
    throw new Error("could not read config from SCRU64_NODE_SPEC env var");
  }
} catch (e) {
  console.error(`Error: ${e.message ?? e}`);
  exit(1);
}

// write `-n` SCRU64 ID strings to `stdout`
const count = parseInt(options.count ?? "1", 10);
await pipeline(
  (async function* (count) {
    for (let i = 0; i < count; i++) {
      yield (await scru64String()) + EOL;
    }
  })(count),
  stdout,
);
