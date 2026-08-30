import assert from "node:assert/strict";
import test from "node:test";

import { percentileRanks, scoreTrendSignals } from "../worker/trend-metrics.ts";

test("uses midpoint percentile ranks for tied observations", () => {
  assert.deepEqual(percentileRanks([10, 10, 30]), [25, 25, 100]);
});

test("does not classify breakout signals before three snapshots", () => {
  const inputs = Array.from({ length: 20 }, (_, index) => ({
    velocity: index + 1,
    acceleration: index + 1,
    relativeGrowth: index / 100,
    likeRate: index / 1000,
    freshness: index / 20,
    sampleCount: index === 19 ? 2 : 3,
    ageHours: 10,
  }));

  assert.equal(scoreTrendSignals(inputs)[19].breakoutStatus, "NONE");
});

test("classifies a sufficiently observed top-decile early signal", () => {
  const inputs = Array.from({ length: 20 }, (_, index) => ({
    velocity: index + 1,
    acceleration: index + 1,
    relativeGrowth: index / 100,
    likeRate: index / 1000,
    freshness: index / 20,
    sampleCount: 3,
    ageHours: 10,
  }));
  const signal = scoreTrendSignals(inputs)[19];

  assert.equal(signal.breakoutStatus, "EARLY");
  assert.equal(signal.velocityPercentile, 100);
  assert.equal(signal.accelerationPercentile, 100);
  assert.equal(signal.momentumScore, 100);
});
