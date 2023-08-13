import { Scru64Generator, Scru64Id } from "../dist/index.js";
import { assert, assertThrows } from "./assert.mjs";

describe("Scru64Generator", function () {
  it("initializes with node ID and size pair and node spec string", function () {
    for (const {
      nodeSpec,
      canonical,
      specType,
      nodeId,
      nodeIdSize,
      nodePrevBytes,
    } of EXAMPLE_NODE_SPECS) {
      const nodePrev = Scru64Id.ofInner(nodePrevBytes);

      const withNodePrev = new Scru64Generator({ nodePrev, nodeIdSize });
      assert(withNodePrev.getNodeId() === nodeId);
      assert(withNodePrev.getNodeIdSize() === nodeIdSize);
      if (withNodePrev.getNodePrev() !== undefined) {
        assert(withNodePrev.getNodePrev().equals(nodePrev));
      }
      assert(withNodePrev.getNodeSpec() === canonical);

      const withNodeId = new Scru64Generator({ nodeId, nodeIdSize });
      assert(withNodeId.getNodeId() === nodeId);
      assert(withNodeId.getNodeIdSize() === nodeIdSize);
      assert(withNodeId.getNodePrev() === undefined);
      if (specType.endsWith("NodeId")) {
        assert(withNodePrev.getNodeSpec() === canonical);
      }

      const parsed = new Scru64Generator(nodeSpec);
      assert(parsed.getNodeId() === nodeId);
      assert(parsed.getNodeIdSize() === nodeIdSize);
      if (parsed.getNodePrev() !== undefined) {
        assert(parsed.getNodePrev().equals(nodePrev));
      }
      assert(withNodePrev.getNodeSpec() === canonical);
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
      "1/2/3",
      "0/0",
      "0/24",
      "8/1",
      "1024/8",
      "0000000000001/8",
      "1/0016",
    ];

    for (const e of cases) {
      assertThrows(() => {
        new Scru64Generator(e);
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

    for (const { nodeId, nodeIdSize, nodeSpec } of EXAMPLE_NODE_SPECS) {
      const counterSize = 24 - nodeIdSize;
      const g = new Scru64Generator({ nodeId, nodeIdSize });

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
        ts -= ALLOWANCE + 0x100;
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

    for (const { nodeId, nodeIdSize, nodeSpec } of EXAMPLE_NODE_SPECS) {
      const counterSize = 24 - nodeIdSize;
      const g = new Scru64Generator({ nodeId, nodeIdSize });

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
      ts -= ALLOWANCE + 0x100;
      for (let i = 0; i < N_LOOPS; i++) {
        ts -= 16;
        assert(g.generateOrAbortCore(ts, ALLOWANCE) === undefined);
      }
    }
  });

  it("embeds up-to-date timestamp", async function () {
    for (const { nodeId, nodeIdSize } of EXAMPLE_NODE_SPECS) {
      const g = new Scru64Generator({ nodeId, nodeIdSize });
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

const EXAMPLE_NODE_SPECS = [
  {
    nodeSpec: "0/1",
    canonical: "0/1",
    specType: "decNodeId",
    nodeId: 0,
    nodeIdSize: 1,
    nodePrev: 0x0000000000000000n,
  },
  {
    nodeSpec: "1/1",
    canonical: "1/1",
    specType: "decNodeId",
    nodeId: 1,
    nodeIdSize: 1,
    nodePrev: 0x0000000000800000n,
  },
  {
    nodeSpec: "0/8",
    canonical: "0/8",
    specType: "decNodeId",
    nodeId: 0,
    nodeIdSize: 8,
    nodePrev: 0x0000000000000000n,
  },
  {
    nodeSpec: "42/8",
    canonical: "42/8",
    specType: "decNodeId",
    nodeId: 42,
    nodeIdSize: 8,
    nodePrev: 0x00000000002a0000n,
  },
  {
    nodeSpec: "255/8",
    canonical: "255/8",
    specType: "decNodeId",
    nodeId: 255,
    nodeIdSize: 8,
    nodePrev: 0x0000000000ff0000n,
  },
  {
    nodeSpec: "0/16",
    canonical: "0/16",
    specType: "decNodeId",
    nodeId: 0,
    nodeIdSize: 16,
    nodePrev: 0x0000000000000000n,
  },
  {
    nodeSpec: "334/16",
    canonical: "334/16",
    specType: "decNodeId",
    nodeId: 334,
    nodeIdSize: 16,
    nodePrev: 0x0000000000014e00n,
  },
  {
    nodeSpec: "65535/16",
    canonical: "65535/16",
    specType: "decNodeId",
    nodeId: 65535,
    nodeIdSize: 16,
    nodePrev: 0x0000000000ffff00n,
  },
  {
    nodeSpec: "0/23",
    canonical: "0/23",
    specType: "decNodeId",
    nodeId: 0,
    nodeIdSize: 23,
    nodePrev: 0x0000000000000000n,
  },
  {
    nodeSpec: "123456/23",
    canonical: "123456/23",
    specType: "decNodeId",
    nodeId: 123456,
    nodeIdSize: 23,
    nodePrev: 0x000000000003c480n,
  },
  {
    nodeSpec: "8388607/23",
    canonical: "8388607/23",
    specType: "decNodeId",
    nodeId: 8388607,
    nodeIdSize: 23,
    nodePrev: 0x0000000000fffffen,
  },
  {
    nodeSpec: "0x0/1",
    canonical: "0/1",
    specType: "hexNodeId",
    nodeId: 0,
    nodeIdSize: 1,
    nodePrev: 0x0000000000000000n,
  },
  {
    nodeSpec: "0x1/1",
    canonical: "1/1",
    specType: "hexNodeId",
    nodeId: 1,
    nodeIdSize: 1,
    nodePrev: 0x0000000000800000n,
  },
  {
    nodeSpec: "0xb/8",
    canonical: "11/8",
    specType: "hexNodeId",
    nodeId: 11,
    nodeIdSize: 8,
    nodePrev: 0x00000000000b0000n,
  },
  {
    nodeSpec: "0x8f/8",
    canonical: "143/8",
    specType: "hexNodeId",
    nodeId: 143,
    nodeIdSize: 8,
    nodePrev: 0x00000000008f0000n,
  },
  {
    nodeSpec: "0xd7/8",
    canonical: "215/8",
    specType: "hexNodeId",
    nodeId: 215,
    nodeIdSize: 8,
    nodePrev: 0x0000000000d70000n,
  },
  {
    nodeSpec: "0xbaf/16",
    canonical: "2991/16",
    specType: "hexNodeId",
    nodeId: 2991,
    nodeIdSize: 16,
    nodePrev: 0x00000000000baf00n,
  },
  {
    nodeSpec: "0x10fa/16",
    canonical: "4346/16",
    specType: "hexNodeId",
    nodeId: 4346,
    nodeIdSize: 16,
    nodePrev: 0x000000000010fa00n,
  },
  {
    nodeSpec: "0xcc83/16",
    canonical: "52355/16",
    specType: "hexNodeId",
    nodeId: 52355,
    nodeIdSize: 16,
    nodePrev: 0x0000000000cc8300n,
  },
  {
    nodeSpec: "0xc8cd1/23",
    canonical: "822481/23",
    specType: "hexNodeId",
    nodeId: 822481,
    nodeIdSize: 23,
    nodePrev: 0x00000000001919a2n,
  },
  {
    nodeSpec: "0x26eff5/23",
    canonical: "2551797/23",
    specType: "hexNodeId",
    nodeId: 2551797,
    nodeIdSize: 23,
    nodePrev: 0x00000000004ddfean,
  },
  {
    nodeSpec: "0x7c6bc4/23",
    canonical: "8154052/23",
    specType: "hexNodeId",
    nodeId: 8154052,
    nodeIdSize: 23,
    nodePrev: 0x0000000000f8d788n,
  },
  {
    nodeSpec: "v0rbps7ay8ks/1",
    canonical: "v0rbps7ay8ks/1",
    specType: "nodePrev",
    nodeId: 0,
    nodeIdSize: 1,
    nodePrev: 0x38a9e683bb4425ecn,
  },
  {
    nodeSpec: "v0rbps7ay8ks/8",
    canonical: "v0rbps7ay8ks/8",
    specType: "nodePrev",
    nodeId: 68,
    nodeIdSize: 8,
    nodePrev: 0x38a9e683bb4425ecn,
  },
  {
    nodeSpec: "v0rbps7ay8ks/16",
    canonical: "v0rbps7ay8ks/16",
    specType: "nodePrev",
    nodeId: 17445,
    nodeIdSize: 16,
    nodePrev: 0x38a9e683bb4425ecn,
  },
  {
    nodeSpec: "v0rbps7ay8ks/23",
    canonical: "v0rbps7ay8ks/23",
    specType: "nodePrev",
    nodeId: 2233078,
    nodeIdSize: 23,
    nodePrev: 0x38a9e683bb4425ecn,
  },
  {
    nodeSpec: "z0jndjt42op2/1",
    canonical: "z0jndjt42op2/1",
    specType: "nodePrev",
    nodeId: 1,
    nodeIdSize: 1,
    nodePrev: 0x3ff596748ea77186n,
  },
  {
    nodeSpec: "z0jndjt42op2/8",
    canonical: "z0jndjt42op2/8",
    specType: "nodePrev",
    nodeId: 167,
    nodeIdSize: 8,
    nodePrev: 0x3ff596748ea77186n,
  },
  {
    nodeSpec: "z0jndjt42op2/16",
    canonical: "z0jndjt42op2/16",
    specType: "nodePrev",
    nodeId: 42865,
    nodeIdSize: 16,
    nodePrev: 0x3ff596748ea77186n,
  },
  {
    nodeSpec: "z0jndjt42op2/23",
    canonical: "z0jndjt42op2/23",
    specType: "nodePrev",
    nodeId: 5486787,
    nodeIdSize: 23,
    nodePrev: 0x3ff596748ea77186n,
  },
  {
    nodeSpec: "f2bembkd4zrb/1",
    canonical: "f2bembkd4zrb/1",
    specType: "nodePrev",
    nodeId: 1,
    nodeIdSize: 1,
    nodePrev: 0x1b844eb5d1aebb07n,
  },
  {
    nodeSpec: "f2bembkd4zrb/8",
    canonical: "f2bembkd4zrb/8",
    specType: "nodePrev",
    nodeId: 174,
    nodeIdSize: 8,
    nodePrev: 0x1b844eb5d1aebb07n,
  },
  {
    nodeSpec: "f2bembkd4zrb/16",
    canonical: "f2bembkd4zrb/16",
    specType: "nodePrev",
    nodeId: 44731,
    nodeIdSize: 16,
    nodePrev: 0x1b844eb5d1aebb07n,
  },
  {
    nodeSpec: "f2bembkd4zrb/23",
    canonical: "f2bembkd4zrb/23",
    specType: "nodePrev",
    nodeId: 5725571,
    nodeIdSize: 23,
    nodePrev: 0x1b844eb5d1aebb07n,
  },
  {
    nodeSpec: "mkg0fd5p76pp/1",
    canonical: "mkg0fd5p76pp/1",
    specType: "nodePrev",
    nodeId: 0,
    nodeIdSize: 1,
    nodePrev: 0x29391373ab449abdn,
  },
  {
    nodeSpec: "mkg0fd5p76pp/8",
    canonical: "mkg0fd5p76pp/8",
    specType: "nodePrev",
    nodeId: 68,
    nodeIdSize: 8,
    nodePrev: 0x29391373ab449abdn,
  },
  {
    nodeSpec: "mkg0fd5p76pp/16",
    canonical: "mkg0fd5p76pp/16",
    specType: "nodePrev",
    nodeId: 17562,
    nodeIdSize: 16,
    nodePrev: 0x29391373ab449abdn,
  },
  {
    nodeSpec: "mkg0fd5p76pp/23",
    canonical: "mkg0fd5p76pp/23",
    specType: "nodePrev",
    nodeId: 2248030,
    nodeIdSize: 23,
    nodePrev: 0x29391373ab449abdn,
  },
];

for (const e of EXAMPLE_NODE_SPECS) {
  e.nodePrevBytes = new Uint8Array(8);
  new DataView(e.nodePrevBytes.buffer).setBigUint64(0, e.nodePrev);
}
