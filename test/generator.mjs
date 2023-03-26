import { Scru64Generator } from "../dist/index.js";
import { assert, assertThrows } from "./assert.mjs";

describe("Scru64Generator", function () {
  const NODE_SPECS = [
    [0, 1, "0/1"],
    [1, 1, "1/1"],
    [0, 8, "0/8"],
    [42, 8, "42/8"],
    [255, 8, "255/8"],
    [0, 16, "0/16"],
    [334, 16, "334/16"],
    [65535, 16, "65535/16"],
    [0, 23, "0/23"],
    [123456, 23, "123456/23"],
    [8388607, 23, "8388607/23"],
  ];

  it("initializes with node ID and size pair and node spec string", function () {
    for (const [nodeId, nodeIdSize, nodeSpec] of NODE_SPECS) {
      const x = new Scru64Generator(nodeId, nodeIdSize);
      assert(x.getNodeId() === nodeId);
      assert(x.getNodeIdSize() === nodeIdSize);

      const y = Scru64Generator.parse(nodeSpec);
      assert(y.getNodeId() === nodeId);
      assert(y.getNodeIdSize() === nodeIdSize);
    }
  });

  it("fails to initialize with invalid node spec string", function () {
    const cases = [
      "",
      "42",
      "/8",
      "42/",
      " 42/8",
      "42/8 ",
      " 42/8 ",
      "42 / 8",
      "+42/8",
      "42/+8",
      "-42/8",
      "42/-8",
      "ab/8",
      "0x42/8",
      "1/2/3",
      "0/0",
      "0/24",
      "8/1",
      "1024/8",
      "00000000001/8",
      "1/0016",
    ];

    for (const e of cases) {
      assertThrows(() => {
        Scru64Generator.parse(e);
      });
    }
  });

  const testConsecutivePair = (first, second) => {
    assert(first.compareTo(second) < 0);
    if (first.timestamp === second.timestamp) {
      assert(first.nodeCtr + 1 === second.nodeCtr);
    } else {
      assert(first.timestamp + 1 === second.timestamp);
    }
  };

  it("normally generates monotonic IDs or resets state upon significant rollback", function () {
    const N_LOOPS = 64;
    const ALLOWANCE = 10_000;

    for (const [nodeId, nodeIdSize, nodeSpec] of NODE_SPECS) {
      const counterSize = 24 - nodeIdSize;
      const g = Scru64Generator.parse(nodeSpec);

      // happy path
      let ts = 1_577_836_800_000; // 2020-01-01
      let prev = g.generateOrResetCore(ts, ALLOWANCE);
      for (let i = 0; i < N_LOOPS; i++) {
        ts += 16;
        const curr = g.generateOrResetCore(ts, ALLOWANCE);
        testConsecutivePair(prev, curr);
        assert(curr.timestamp - ts / 256 < ALLOWANCE / 256);
        assert(curr.nodeCtr >> counterSize === nodeId);

        prev = curr;
      }

      // keep monotonic order under mildly decreasing timestamps
      ts += ALLOWANCE * 16;
      prev = g.generateOrResetCore(ts, ALLOWANCE);
      for (let i = 0; i < N_LOOPS; i++) {
        ts -= 16;
        const curr = g.generateOrResetCore(ts, ALLOWANCE);
        testConsecutivePair(prev, curr);
        assert(curr.timestamp - ts / 256 < ALLOWANCE / 256);
        assert(curr.nodeCtr >> counterSize === nodeId);

        prev = curr;
      }

      // reset state with significantly decreasing timestamps
      ts += ALLOWANCE * 16;
      prev = g.generateOrResetCore(ts, ALLOWANCE);
      for (let i = 0; i < N_LOOPS; i++) {
        ts -= ALLOWANCE;
        const curr = g.generateOrResetCore(ts, ALLOWANCE);
        assert(prev.compareTo(curr) > 0);
        assert(curr.timestamp - ts / 256 < ALLOWANCE / 256);
        assert(curr.nodeCtr >> counterSize === nodeId);

        prev = curr;
      }
    }
  });

  it("normally generates monotonic IDs or aborts upon significant rollback", function () {
    const N_LOOPS = 64;
    const ALLOWANCE = 10_000;

    for (const [nodeId, nodeIdSize, nodeSpec] of NODE_SPECS) {
      const counterSize = 24 - nodeIdSize;
      const g = Scru64Generator.parse(nodeSpec);

      // happy path
      let ts = 1_577_836_800_000; // 2020-01-01
      let prev = g.generateOrAbortCore(ts, ALLOWANCE);
      for (let i = 0; i < N_LOOPS; i++) {
        ts += 16;
        const curr = g.generateOrAbortCore(ts, ALLOWANCE);
        assert(curr !== undefined);
        testConsecutivePair(prev, curr);
        assert(curr.timestamp - ts / 256 < ALLOWANCE / 256);
        assert(curr.nodeCtr >> counterSize === nodeId);

        prev = curr;
      }

      // keep monotonic order under mildly decreasing timestamps
      ts += ALLOWANCE * 16;
      prev = g.generateOrAbortCore(ts, ALLOWANCE);
      for (let i = 0; i < N_LOOPS; i++) {
        ts -= 16;
        const curr = g.generateOrAbortCore(ts, ALLOWANCE);
        assert(curr !== undefined);
        testConsecutivePair(prev, curr);
        assert(curr.timestamp - ts / 256 < ALLOWANCE / 256);
        assert(curr.nodeCtr >> counterSize === nodeId);

        prev = curr;
      }

      // abort with significantly decreasing timestamps
      ts += ALLOWANCE * 16;
      g.generateOrAbortCore(ts, ALLOWANCE);
      ts -= ALLOWANCE;
      for (let i = 0; i < N_LOOPS; i++) {
        ts -= 16;
        assert(g.generateOrAbortCore(ts, ALLOWANCE) === undefined);
      }
    }
  });

  it("embeds up-to-date timestamp", async function () {
    for (const [, , nodeSpec] of NODE_SPECS) {
      const g = Scru64Generator.parse(nodeSpec);
      let ts_now = Math.trunc(Date.now() / 256);
      let x = g.generate();
      assert(x.timestamp - ts_now <= 1);

      ts_now = Math.trunc(Date.now() / 256);
      x = g.generateOrReset();
      assert(x.timestamp - ts_now <= 1);

      ts_now = Math.trunc(Date.now() / 256);
      x = g.generateOrSleep();
      assert(x.timestamp - ts_now <= 1);

      ts_now = Math.trunc(Date.now() / 256);
      x = await g.generateOrAwait();
      assert(x.timestamp - ts_now <= 1);
    }
  });
});
