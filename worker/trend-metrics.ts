export type BreakoutStatus = "NONE" | "BREAKOUT" | "EARLY";

export type TrendSignalInput = {
  velocity: number;
  acceleration: number;
  relativeGrowth: number;
  likeRate: number;
  freshness: number;
  sampleCount: number;
  ageHours: number;
};

export type TrendSignal = {
  velocityPercentile: number;
  accelerationPercentile: number;
  momentumScore: number;
  breakoutStatus: BreakoutStatus;
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
  const velocityPercentiles = percentileRanks(inputs.map((input) => input.velocity));
  const accelerationPercentiles = percentileRanks(inputs.map((input) => input.acceleration));
  const growthPercentiles = percentileRanks(inputs.map((input) => input.relativeGrowth));
  const likePercentiles = percentileRanks(inputs.map((input) => input.likeRate));
  const freshnessPercentiles = percentileRanks(inputs.map((input) => input.freshness));

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
    const enoughEvidence = inputs.length >= 20
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
    };
  });
}
