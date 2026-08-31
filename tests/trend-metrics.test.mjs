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
    format: "LONG_FORM",
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
    format: "LONG_FORM",
  }));
  const signal = scoreTrendSignals(inputs)[19];

  assert.equal(signal.breakoutStatus, "EARLY");
  assert.equal(signal.velocityPercentile, 100);
  assert.equal(signal.accelerationPercentile, 100);
  assert.equal(signal.momentumScore, 100);
  assert.equal(signal.formatPopulationSize, 20);
});

test("calculates percentile ranks inside Shorts and long-form cohorts", () => {
  const common = {
    acceleration: 1,
    relativeGrowth: 0.1,
    likeRate: 0.01,
    freshness: 0.8,
    sampleCount: 3,
    ageHours: 10,
  };
  const signals = scoreTrendSignals([
    { ...common, format: "SHORTS", velocity: 10 },
    { ...common, format: "SHORTS", velocity: 20 },
    { ...common, format: "LONG_FORM", velocity: 1_000 },
    { ...common, format: "LONG_FORM", velocity: 2_000 },
  ]);

  assert.equal(signals[1].velocityPercentile, 100);
  assert.equal(signals[2].velocityPercentile, 0);
  assert.equal(signals[0].formatPopulationSize, 2);
  assert.equal(signals[2].formatPopulationSize, 2);
});
