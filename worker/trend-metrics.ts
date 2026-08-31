export type BreakoutStatus = "NONE" | "BREAKOUT" | "EARLY";
export type TrendVideoFormat = "SHORTS" | "LONG_FORM";

export type TrendSignalInput = {
  velocity: number;
  acceleration: number;
  relativeGrowth: number;
  likeRate: number;
  freshness: number;
  sampleCount: number;
  ageHours: number;
  format: TrendVideoFormat;
};

export type TrendSignal = {
  velocityPercentile: number;
  accelerationPercentile: number;
  momentumScore: number;
  breakoutStatus: BreakoutStatus;
  formatPopulationSize: number;
};

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

/** Midpoint percentile ranks keep equal observations tied deterministically. */
export function percentileRanks(values: number[]) {
  if (values.length <= 1) return values.map(() => 50);

  const ordered = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value || a.index - b.index);
  const ranks = new Array<number>(values.length);

  for (let start = 0; start < ordered.length;) {
    let end = start;
    while (end + 1 < ordered.length && ordered[end + 1].value === ordered[start].value) {
      end += 1;
    }
    const percentile = ((start + end) / 2 / (ordered.length - 1)) * 100;
    for (let index = start; index <= end; index += 1) {
      ranks[ordered[index].index] = percentile;
    }
    start = end + 1;
  }

  return ranks;
}

export function scoreTrendSignals(inputs: TrendSignalInput[]): TrendSignal[] {
  const cohortIndexes = new Map<TrendVideoFormat, number[]>();
  inputs.forEach((input, index) => {
    const indexes = cohortIndexes.get(input.format) ?? [];
    indexes.push(index);
    cohortIndexes.set(input.format, indexes);
  });

  const velocityPercentiles = new Array<number>(inputs.length);
  const accelerationPercentiles = new Array<number>(inputs.length);
  const growthPercentiles = new Array<number>(inputs.length);
  const likePercentiles = new Array<number>(inputs.length);
  const freshnessPercentiles = new Array<number>(inputs.length);

  for (const indexes of cohortIndexes.values()) {
    const rankMetric = (metric: (input: TrendSignalInput) => number, target: number[]) => {
      const ranks = percentileRanks(indexes.map((index) => metric(inputs[index])));
      indexes.forEach((inputIndex, cohortIndex) => {
        target[inputIndex] = ranks[cohortIndex];
      });
    };
    rankMetric((input) => input.velocity, velocityPercentiles);
    rankMetric((input) => input.acceleration, accelerationPercentiles);
    rankMetric((input) => input.relativeGrowth, growthPercentiles);
    rankMetric((input) => input.likeRate, likePercentiles);
    rankMetric((input) => input.freshness, freshnessPercentiles);
  }

  return inputs.map((input, index) => {
    const velocityPercentile = velocityPercentiles[index];
    const accelerationPercentile = accelerationPercentiles[index];
    const momentumScore = Math.round(clamp(
      velocityPercentile * 0.35
      + accelerationPercentile * 0.30
      + growthPercentiles[index] * 0.15
      + likePercentiles[index] * 0.10
      + freshnessPercentiles[index] * 0.10,
    ));

    let breakoutStatus: BreakoutStatus = "NONE";
    const formatPopulationSize = cohortIndexes.get(input.format)?.length ?? 0;
    const enoughEvidence = formatPopulationSize >= 8
      && input.sampleCount >= 3
      && input.velocity > 0
      && input.acceleration > 0;

    if (
      enoughEvidence
      && input.ageHours <= 18
      && velocityPercentile >= 90
      && accelerationPercentile >= 90
      && momentumScore >= 80
    ) {
      breakoutStatus = "EARLY";
    } else if (
      enoughEvidence
      && input.ageHours <= 48
      && velocityPercentile >= 80
      && accelerationPercentile >= 80
      && momentumScore >= 70
    ) {
      breakoutStatus = "BREAKOUT";
    }

    return {
      velocityPercentile: Math.round(velocityPercentile * 10) / 10,
      accelerationPercentile: Math.round(accelerationPercentile * 10) / 10,
      momentumScore,
      breakoutStatus,
      formatPopulationSize,
    };
  });
}
