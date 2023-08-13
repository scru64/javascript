import {
  GlobalGenerator,
  scru64String,
  scru64StringSync,
} from "../dist/index.js";
import { assert } from "./assert.mjs";

globalThis.SCRU64_NODE_SPEC = "42/8";

describe("GlobalGenerator", function () {
  it("reads configuration from global var", function () {
    assert(GlobalGenerator.getNodeId() === 42);
    assert(GlobalGenerator.getNodeIdSize() === 8);
    assert(GlobalGenerator.getNodeSpec() === "42/8");
  });
});

describe("scru64StringSync()", function () {
  it("generates 10k monotonically increasing IDs", function () {
    let prev = scru64StringSync();
    for (let i = 0; i < 10_000; i++) {
      const curr = scru64StringSync();
      assert(prev < curr);
      prev = curr;
    }
  });
});

describe("scru64String()", function () {
  it("generates 10k monotonically increasing IDs", async function () {
    let prev = await scru64String();
    for (let i = 0; i < 10_000; i++) {
      const curr = await scru64String();
      assert(prev < curr);
      prev = curr;
    }
  });
});
