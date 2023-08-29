import { DefaultCounterMode } from "../dist/index.js";
import { assert } from "./assert.mjs";

describe("DefaultCounterMode", function () {
  /**
   * This case includes statistical tests for the random number generator and
   * thus may fail at a certain low probability.
   */
  it("returns random numbers, setting guard bits to zero (this test may fail)", function () {
    const N = 4096;

    // set margin based on binom dist 99.999999% confidence interval
    const margin = 5.730729 * Math.sqrt((0.5 * 0.5) / N);

    const context = {
      timestamp: 0x0123_4567_89ab,
      nodeId: 0,
    };
    for (let counterSize = 1; counterSize < 24; counterSize++) {
      for (
        let overflowGuardSize = 0;
        overflowGuardSize < 24;
        overflowGuardSize++
      ) {
        // count number of set bits by bit position (from LSB to MSB)
        const countsByPos = new Array(24).fill(0);

        const c = new DefaultCounterMode(overflowGuardSize);
        for (let i = 0; i < N; i++) {
          let n = c.renew(counterSize, context);
          for (let j = 0; j < countsByPos.length; j++) {
            countsByPos[j] += n & 1;
            n >>>= 1;
          }
          assert(n === 0);
        }

        const filled = Math.max(0, counterSize - overflowGuardSize);
        for (const e of countsByPos.slice(0, filled)) {
          assert(Math.abs(e / N - 0.5) < margin);
        }
        for (const e of countsByPos.slice(filled)) {
          assert(e === 0);
        }
      }
    }
  });
});
