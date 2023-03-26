import { Scru64Id } from "../dist/index.js";
import { assert, assertThrows } from "./assert.mjs";

describe("Scru64Id", function () {
  it("supports equality comparison", function () {
    const e = TEST_CASES[TEST_CASES.length - 1];
    let prev = Scru64Id.fromParts(e.timestamp, e.nodeCtr);
    for (const e of TEST_CASES) {
      const curr = Scru64Id.fromParts(e.timestamp, e.nodeCtr);
      const twin = Scru64Id.fromParts(e.timestamp, e.nodeCtr);

      assert(curr !== twin);
      assert(curr.equals(twin));
      assert(twin.equals(curr));
      assert(
        curr.bytes.length === twin.bytes.length &&
          curr.bytes.every((elem, i) => elem === twin.bytes[i])
      );
      assert(curr.toHex() === twin.toHex());
      assert(String(curr) === String(twin));
      assert(JSON.stringify(curr) === JSON.stringify(twin));
      assert(curr.timestamp === twin.timestamp);
      assert(curr.nodeCtr === twin.nodeCtr);

      assert(curr !== prev);
      assert(!prev.equals(curr));
      assert(!curr.equals(prev));
      assert(
        curr.bytes.length === prev.bytes.length &&
          !curr.bytes.every((elem, i) => elem === prev.bytes[i])
      );
      assert(curr.toHex() !== prev.toHex());
      assert(String(curr) !== String(prev));
      assert(JSON.stringify(curr) !== JSON.stringify(prev));
      assert(
        curr.timestamp !== prev.timestamp || curr.nodeCtr !== prev.nodeCtr
      );

      prev = curr;
    }
  });

  it("supports ordering comparison", function () {
    const cases = TEST_CASES.slice();
    cases.sort((a, b) => Number(a.num - b.num));

    const e = cases.shift();
    let prev = Scru64Id.fromParts(e.timestamp, e.nodeCtr);
    for (const e of cases) {
      const curr = Scru64Id.fromParts(e.timestamp, e.nodeCtr);

      assert(prev.compareTo(curr) < 0);
      assert(curr.compareTo(prev) > 0);

      prev = curr;
    }
  });

  it("converts to various types", function () {
    for (const e of TEST_CASES) {
      const x = Scru64Id.fromParts(e.timestamp, e.nodeCtr);

      assert(
        x.bytes.length === e.bytes.length &&
          x.bytes.every((elem, i) => elem === e.bytes[i])
      );
      assert(BigInt(x.toHex()) === e.num);
      assert(String(x) === e.text);
      assert(x.timestamp === e.timestamp);
      assert(x.nodeCtr === e.nodeCtr);
    }
  });

  it("converts from various types", function () {
    for (const e of TEST_CASES) {
      const x = Scru64Id.fromParts(e.timestamp, e.nodeCtr);

      assert(Scru64Id.ofInner(e.bytes).equals(x));
      assert(Scru64Id.fromString(e.text).equals(x));
      assert(Scru64Id.fromString(e.text.toUpperCase()).equals(x));
    }
  });

  it("rejects byte array containing integer out of valid range", function () {
    const cases = [
      new Uint8Array(7),
      new Uint8Array(9),
      Uint8Array.of(65, 194, 28, 184, 225, 0, 0, 0), // 36n ** 12n
      new Uint8Array(8).fill(0xff),
    ];

    for (const e of cases) {
      assertThrows(() => {
        Scru64Id.ofInner(e);
      }, RangeError);
    }
  });

  it("fails to parse invalid textual representations", function () {
    const cases = [
      "",
      " 0u3wrp5g81jx",
      "0u3wrp5g81jy ",
      " 0u3wrp5g81jz ",
      "+0u3wrp5g81k0",
      "-0u3wrp5g81k1",
      "+u3wrp5q7ta5",
      "-u3wrp5q7ta6",
      "0u3w_p5q7ta7",
      "0u3wrp5-7ta8",
      "0u3wrp5q7t 9",
    ];

    for (const e of cases) {
      assertThrows(() => {
        Scru64Id.fromString(e);
      }, SyntaxError);
    }
  });
});

const TEST_CASES = [
  { text: "000000000000", num: 0x0000000000000000n, timestamp: 0, nodeCtr: 0 },
  {
    text: "00000009zldr",
    num: 0x0000000000ffffffn,
    timestamp: 0,
    nodeCtr: 16777215,
  },
  {
    text: "zzzzzzzq0em8",
    num: 0x41c21cb8e0000000n,
    timestamp: 282429536480,
    nodeCtr: 0,
  },
  {
    text: "zzzzzzzzzzzz",
    num: 0x41c21cb8e0ffffffn,
    timestamp: 282429536480,
    nodeCtr: 16777215,
  },
  {
    text: "0u375nxqh5cq",
    num: 0x0186d52bbe2a635an,
    timestamp: 6557084606,
    nodeCtr: 2777946,
  },
  {
    text: "0u375nxqh5cr",
    num: 0x0186d52bbe2a635bn,
    timestamp: 6557084606,
    nodeCtr: 2777947,
  },
  {
    text: "0u375nxqh5cs",
    num: 0x0186d52bbe2a635cn,
    timestamp: 6557084606,
    nodeCtr: 2777948,
  },
  {
    text: "0u375nxqh5ct",
    num: 0x0186d52bbe2a635dn,
    timestamp: 6557084606,
    nodeCtr: 2777949,
  },
  {
    text: "0u375ny0glr0",
    num: 0x0186d52bbf2a4a1cn,
    timestamp: 6557084607,
    nodeCtr: 2771484,
  },
  {
    text: "0u375ny0glr1",
    num: 0x0186d52bbf2a4a1dn,
    timestamp: 6557084607,
    nodeCtr: 2771485,
  },
  {
    text: "0u375ny0glr2",
    num: 0x0186d52bbf2a4a1en,
    timestamp: 6557084607,
    nodeCtr: 2771486,
  },
  {
    text: "0u375ny0glr3",
    num: 0x0186d52bbf2a4a1fn,
    timestamp: 6557084607,
    nodeCtr: 2771487,
  },
  {
    text: "jdsf1we3ui4f",
    num: 0x2367c8dfb2e6d23fn,
    timestamp: 152065073074,
    nodeCtr: 15127103,
  },
  {
    text: "j0afcjyfyi98",
    num: 0x22b86eaad6b2f7ecn,
    timestamp: 149123148502,
    nodeCtr: 11728876,
  },
  {
    text: "ckzyfc271xsn",
    num: 0x16fc214296b29057n,
    timestamp: 98719318678,
    nodeCtr: 11702359,
  },
  {
    text: "t0vgc4c4b18n",
    num: 0x3504295badc14f07n,
    timestamp: 227703085997,
    nodeCtr: 12668679,
  },
  {
    text: "mwcrtcubk7bp",
    num: 0x29d3c7553e748515n,
    timestamp: 179646715198,
    nodeCtr: 7636245,
  },
  {
    text: "g9ye86pgplu7",
    num: 0x1dbb24363718aecfn,
    timestamp: 127693764151,
    nodeCtr: 1617615,
  },
  {
    text: "qmez19t9oeir",
    num: 0x30a122fef7cd6c83n,
    timestamp: 208861855479,
    nodeCtr: 13462659,
  },
  {
    text: "d81r595fq52m",
    num: 0x18278838f0660f2en,
    timestamp: 103742454000,
    nodeCtr: 6688558,
  },
  {
    text: "v0rbps7ay8ks",
    num: 0x38a9e683bb4425ecn,
    timestamp: 243368625083,
    nodeCtr: 4466156,
  },
  {
    text: "z0jndjt42op2",
    num: 0x3ff596748ea77186n,
    timestamp: 274703217806,
    nodeCtr: 10973574,
  },
  {
    text: "f2bembkd4zrb",
    num: 0x1b844eb5d1aebb07n,
    timestamp: 118183867857,
    nodeCtr: 11451143,
  },
  {
    text: "mkg0fd5p76pp",
    num: 0x29391373ab449abdn,
    timestamp: 177051235243,
    nodeCtr: 4496061,
  },
];

for (const e of TEST_CASES) {
  e.bytes = new Uint8Array(8);
  new DataView(e.bytes.buffer).setBigUint64(0, e.num);
}
