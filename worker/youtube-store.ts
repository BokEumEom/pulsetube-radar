import {
  scoreTrendSignals,
  type BreakoutStatus,
  type TrendVideoFormat,
} from "./trend-metrics";
import { extractKeywordTokens } from "./keyword-metrics";

export type TrendRegion = "KR" | "JP" | "US";

export type TrendSnapshotVideo = {
  id: string;
  title: string;
  channel: string;
  categoryId: string | null;
  category: string;
  views: number;
  likes: number;
  velocity: number;
  velocityKind: "snapshot" | "lifetime";
  acceleration: number;
  sampleCount: number;
  velocityPercentile: number;
  accelerationPercentile: number;
  momentumScore: number;
  breakoutStatus: BreakoutStatus;
  confidenceLevel?: "LOW" | "MEDIUM" | "HIGH";
  confidenceScore?: number;
  confidenceReasons?: string[];
  channelBaselineVelocity?: number;
  channelVelocityRatio?: number;
  channelBaselineVideos?: number;
  durationSeconds: number;
  videoFormat: TrendVideoFormat;
  formatPopulationSize: number;
  delta: number | null;
  rank: number;
  isNew?: boolean;
  thumbnail: string;
  description: string;
  tags: string[];
  aiNote: string;
  history: { time: string; rank: number; views: number }[];
  publishedAt?: string;
  source: "youtube";
};

type SnapshotRow = { id: string; captured_at: number };

type RankingRow = {
  video_id: string;
  rank: number;
  previous_rank: number | null;
  delta: number | null;
  is_new: number;
  views: number;
  likes: number;
  views_per_hour: number;
  view_acceleration: number;
  sample_count: number;
  velocity_percentile: number;
  acceleration_percentile: number;
  momentum_score: number;
  breakout_status: BreakoutStatus;
  duration_seconds: number;
  video_format: TrendVideoFormat;
  format_population_size: number;
  title: string;
  channel: string;
  category_id: string | null;
  category_name: string;
  thumbnail: string;
  description: string;
  tags_json: string;
  published_at: number | null;
};

type PreviousRankingRow = {
  video_id: string;
  rank: number;
  views: number;
  views_per_hour: number;
  sample_count: number;
};

type CollectorRunRow = {
  id: string;
  trigger: string;
  status: string;
  started_at: number;
  completed_at: number | null;
  scopes_total: number;
  scopes_succeeded: number;
  videos_collected: number;
  quota_units: number;
  error_summary: string | null;
};

const SNAPSHOT_INTERVAL_SECONDS = 15 * 60;

const parseTags = (value: string) => {
  try {
    const tags = JSON.parse(value);
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
};

const formatTime = (seconds: number) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(seconds * 1000));

const REGION_LABELS: Record<TrendRegion, string> = {
  KR: "대한민국",
  JP: "일본",
  US: "미국",
};

const signalNote = (row: RankingRow, region: TrendRegion) => {
  const regionLabel = REGION_LABELS[region];
  if (row.breakout_status === "EARLY") {
    return `같은 ${row.video_format === "SHORTS" ? "Shorts 후보" : "롱폼"} ${row.format_population_size}개 중 조회 속도와 가속도가 모두 상위 10%인 초기 급상승 신호입니다.`;
  }
  if (row.breakout_status === "BREAKOUT") {
    return "3회 이상 수집에서 조회 속도와 가속도가 모두 상위 20%인 급상승 신호입니다.";
  }
  if (row.sample_count < 3) {
    return `${row.sample_count}회 수집됨 · 가속 급상승 판정은 3번째 스냅샷부터 활성화됩니다.`;
  }
  if (row.view_acceleration > 0) {
    return `조회 속도가 직전 구간보다 시간당 ${row.view_acceleration.toLocaleString("ko-KR")}회 빨라졌습니다.`;
  }
  if (row.delta === null) {
    return `${regionLabel} 인기 영상 ${row.rank}위로 수집된 첫 비교 기준점입니다.`;
  }
  return row.delta > 0
    ? `직전 수집보다 ${row.delta}계단 상승한 ${regionLabel} 인기 영상입니다.`
    : row.delta < 0
      ? `직전 수집보다 ${Math.abs(row.delta)}계단 하락한 ${regionLabel} 인기 영상입니다.`
      : `직전 수집과 같은 ${row.rank}위를 유지하고 있습니다.`;
};

const signalConfidence = (
  row: Pick<RankingRow, "sample_count" | "format_population_size" | "views_per_hour" | "view_acceleration" | "published_at">,
  capturedAt = Math.floor(Date.now() / 1000),
  channelBaselineVideos = 0,
) => {
  const ageHours = row.published_at
    ? Math.max(0, (capturedAt - row.published_at) / 3600)
    : Number.POSITIVE_INFINITY;
  const observationScore = Math.min(40, row.sample_count / 6 * 40);
  const cohortScore = Math.min(25, row.format_population_size / 12 * 25);
  const movementScore = row.views_per_hour > 0 && row.view_acceleration > 0
    ? 20
    : row.views_per_hour > 0 ? 10 : 0;
  const freshnessScore = ageHours <= 48 ? 10 : ageHours <= 168 ? 5 : 0;
  const baselineScore = channelBaselineVideos >= 3 ? 5 : channelBaselineVideos >= 2 ? 3 : 0;
  const score = Math.round(Math.min(100, observationScore + cohortScore + movementScore + freshnessScore + baselineScore));
  const level = score >= 75 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW";
  const reasons = [
    `${row.sample_count}회 관측`,
    `동일 포맷 ${row.format_population_size}개 비교`,
    channelBaselineVideos >= 2 ? `채널 기준 영상 ${channelBaselineVideos}개` : "채널 기준선 축적 중",
  ];
  return { level, score, reasons } as const;
};

const toVideo = (row: RankingRow, region: TrendRegion): TrendSnapshotVideo => {
  const confidence = signalConfidence(row);
  return ({
  id: row.video_id,
  title: row.title,
  channel: row.channel,
  categoryId: row.category_id,
  category: row.category_name,
  views: row.views,
  likes: row.likes,
  velocity: row.views_per_hour,
  velocityKind: row.previous_rank === null ? "lifetime" : "snapshot",
  acceleration: row.view_acceleration,
  sampleCount: row.sample_count,
  velocityPercentile: row.velocity_percentile,
  accelerationPercentile: row.acceleration_percentile,
  momentumScore: row.momentum_score,
  breakoutStatus: row.breakout_status,
  confidenceLevel: confidence.level,
  confidenceScore: confidence.score,
  confidenceReasons: confidence.reasons,
  durationSeconds: row.duration_seconds,
  videoFormat: row.video_format,
  formatPopulationSize: row.format_population_size,
  delta: row.delta,
  rank: row.rank,
  isNew: Boolean(row.is_new),
  thumbnail: row.thumbnail,
  description: row.description,
  tags: parseTags(row.tags_json),
  aiNote: signalNote(row, region),
  history: [{ time: "현재", rank: row.rank, views: row.views }],
  publishedAt: row.published_at ? new Date(row.published_at * 1000).toISOString() : undefined,
  source: "youtube",
  });
};

export const scopeForCategory = (categoryId: string | null) =>
  categoryId ? `category:${categoryId}` : "all";

export async function readLatestSnapshot(
  db: D1Database,
  region: TrendRegion,
  scope: string,
  maxAgeSeconds = 20 * 60,
) {
  const minimumCapturedAt = Math.floor(Date.now() / 1000) - maxAgeSeconds;
  const snapshot = await db
    .prepare(
      `SELECT id, captured_at
       FROM youtube_snapshots
       WHERE region = ? AND scope = ? AND captured_at >= ?
       ORDER BY captured_at DESC
       LIMIT 1`,
    )
    .bind(region, scope, minimumCapturedAt)
    .first<SnapshotRow>();
  if (!snapshot) return null;

  const result = await db
    .prepare(
      `SELECT video_id, rank, previous_rank, delta, is_new, views, likes,
              views_per_hour, view_acceleration, sample_count,
              velocity_percentile, acceleration_percentile, momentum_score,
              breakout_status, duration_seconds, video_format,
              format_population_size, title, channel, category_id, category_name,
              thumbnail, description, tags_json, published_at
       FROM youtube_rankings
       WHERE snapshot_id = ?
       ORDER BY rank ASC`,
    )
    .bind(snapshot.id)
    .all<RankingRow>();
  if (!result.results.length) return null;

  return {
    capturedAt: new Date(snapshot.captured_at * 1000).toISOString(),
    videos: result.results.map((row) => toVideo(row, region)),
  };
}

/**
 * Builds one country-level signal cohort from the latest overall and category
 * snapshots. A video that appears in multiple scopes is counted once.
 */
export async function readLatestSignals(
  db: D1Database,
  region: TrendRegion,
  maxAgeSeconds = 30 * 60,
) {
  const minimumCapturedAt = Math.floor(Date.now() / 1000) - maxAgeSeconds;
  const meta = await db
    .prepare(
      `SELECT captured_bucket, MAX(captured_at) AS captured_at,
              COUNT(DISTINCT scope) AS scope_count
       FROM youtube_snapshots
       WHERE region = ? AND captured_at >= ?
       GROUP BY captured_bucket
       ORDER BY captured_bucket DESC
       LIMIT 1`,
    )
    .bind(region, minimumCapturedAt)
    .first<{ captured_bucket: number; captured_at: number; scope_count: number }>();
  if (!meta) return null;

  const result = await db
    .prepare(
      `WITH deduped AS (
         SELECT r.video_id, r.rank, r.previous_rank, r.delta, r.is_new,
                r.views, r.likes, r.views_per_hour, r.view_acceleration,
                r.sample_count, r.velocity_percentile,
                r.acceleration_percentile, r.momentum_score,
                r.breakout_status, r.duration_seconds, r.video_format,
                r.format_population_size, r.title, r.channel, r.category_id,
                r.category_name, r.thumbnail, r.description, r.tags_json,
                r.published_at,
                ROW_NUMBER() OVER (
                  PARTITION BY r.video_id
                  ORDER BY CASE WHEN s.scope = 'all' THEN 0 ELSE 1 END,
                           r.momentum_score DESC,
                           r.rank ASC
                ) AS video_priority
         FROM youtube_snapshots s
         JOIN youtube_rankings r ON r.snapshot_id = s.id
         WHERE s.region = ? AND s.captured_bucket = ?
       )
       SELECT video_id, rank, previous_rank, delta, is_new, views, likes,
              views_per_hour, view_acceleration, sample_count,
              velocity_percentile, acceleration_percentile, momentum_score,
              breakout_status, duration_seconds, video_format,
              format_population_size, title, channel, category_id,
              category_name, thumbnail, description, tags_json, published_at
       FROM deduped
       WHERE video_priority = 1`,
    )
    .bind(region, meta.captured_bucket)
    .all<RankingRow>();
  if (!result.results.length) return null;

  const baselineFrom = meta.captured_at - 30 * 24 * 3600;
  const baselines = await db
    .prepare(
      `WITH latest_video AS (
         SELECT r.channel, r.video_id, r.views_per_hour,
                ROW_NUMBER() OVER (
                  PARTITION BY r.video_id
                  ORDER BY s.captured_at DESC
                ) AS video_priority
         FROM youtube_snapshots s
         JOIN youtube_rankings r ON r.snapshot_id = s.id
         WHERE s.region = ? AND s.captured_at >= ? AND s.captured_at <= ?
       )
       SELECT channel, AVG(views_per_hour) AS baseline_velocity,
              COUNT(*) AS baseline_videos
       FROM latest_video
       WHERE video_priority = 1
       GROUP BY channel`,
    )
    .bind(region, baselineFrom, meta.captured_at)
    .all<{ channel: string; baseline_velocity: number; baseline_videos: number }>();
  const baselineByChannel = new Map(baselines.results.map((row) => [row.channel, row]));
  const now = meta.captured_at;
  const signals = scoreTrendSignals(result.results.map((row) => {
    const baseline = baselineByChannel.get(row.channel);
    const channelRatio = baseline && baseline.baseline_videos >= 2
      ? row.views_per_hour / Math.max(1, baseline.baseline_velocity)
      : row.views_per_hour / Math.max(1, row.views);
    const ageHours = row.published_at ? Math.max(0, (now - row.published_at) / 3600) : 24 * 365;
    return {
      velocity: row.views_per_hour,
      acceleration: row.view_acceleration,
      relativeGrowth: channelRatio,
      likeRate: row.likes / Math.max(1, row.views),
      freshness: Math.max(0, 1 - ageHours / 72),
      sampleCount: row.sample_count,
      ageHours,
      format: row.video_format,
    };
  }));

  const videos = result.results.map((row, index) => {
    const baseline = baselineByChannel.get(row.channel);
    const baselineVideos = baseline?.baseline_videos ?? 0;
    const baselineVelocity = Math.round(baseline?.baseline_velocity ?? 0);
    const channelRatio = baselineVideos >= 2
      ? Math.round(row.views_per_hour / Math.max(1, baselineVelocity) * 10) / 10
      : null;
    const signal = signals[index];
    const confidence = signalConfidence(
      { ...row, format_population_size: signal.formatPopulationSize },
      now,
      baselineVideos,
    );
    const formatLabel = row.video_format === "SHORTS" ? "Shorts 후보" : "롱폼";
    const baselineText = channelRatio === null
      ? "채널 기준선은 더 많은 영상이 필요합니다."
      : `채널 최근 기준보다 ${channelRatio.toFixed(1)}배 빠릅니다.`;
    return {
      ...toVideo(row, region),
      velocityPercentile: signal.velocityPercentile,
      accelerationPercentile: signal.accelerationPercentile,
      momentumScore: signal.momentumScore,
      breakoutStatus: signal.breakoutStatus,
      formatPopulationSize: signal.formatPopulationSize,
      confidenceLevel: confidence.level,
      confidenceScore: confidence.score,
      confidenceReasons: confidence.reasons,
      channelBaselineVelocity: baselineVelocity,
      channelVelocityRatio: channelRatio ?? undefined,
      channelBaselineVideos: baselineVideos,
      aiNote: `통합 ${formatLabel} 표본에서 속도 ${signal.velocityPercentile}백분위, 가속 ${signal.accelerationPercentile}백분위입니다. ${baselineText}`,
    } satisfies TrendSnapshotVideo;
  }).sort((a, b) => {
    const weight = (status: BreakoutStatus) => status === "EARLY" ? 2 : status === "BREAKOUT" ? 1 : 0;
    return weight(b.breakoutStatus) - weight(a.breakoutStatus)
      || b.momentumScore - a.momentumScore
      || b.velocity - a.velocity;
  });

  return {
    capturedAt: new Date(meta.captured_at * 1000).toISOString(),
    scopeCount: meta.scope_count,
    analysisCount: videos.length,
    videos,
  };
}

export async function saveSnapshot(
  db: D1Database,
  input: {
    region: TrendRegion;
    scope: string;
    categoryId: string | null;
    capturedAt: number;
    videos: TrendSnapshotVideo[];
  },
) {
  const capturedBucket = Math.floor(input.capturedAt / SNAPSHOT_INTERVAL_SECONDS);
  const snapshotId = `${input.region}:${input.scope}:${capturedBucket}`;
  const previousSnapshot = await db
    .prepare(
      `SELECT id, captured_at
       FROM youtube_snapshots
       WHERE region = ? AND scope = ? AND captured_bucket < ?
       ORDER BY captured_bucket DESC
       LIMIT 1`,
    )
    .bind(input.region, input.scope, capturedBucket)
    .first<SnapshotRow>();

  const previousRankings = previousSnapshot
    ? await db
        .prepare(
          `SELECT video_id, rank, views, views_per_hour, sample_count
           FROM youtube_rankings
           WHERE snapshot_id = ?`,
        )
        .bind(previousSnapshot.id)
        .all<PreviousRankingRow>()
    : { results: [] as PreviousRankingRow[] };
  const previousByVideo = new Map(
    previousRankings.results.map((row) => [row.video_id, row]),
  );
  const elapsedHours = previousSnapshot
    ? Math.max((input.capturedAt - previousSnapshot.captured_at) / 3600, 0.01)
    : null;

  const calculated = input.videos.map((video) => {
    const previous = previousByVideo.get(video.id);
    const viewsPerHour = previous && elapsedHours
      ? Math.max(0, Math.round((video.views - previous.views) / elapsedHours))
      : video.velocity;
    const acceleration = previous && previous.sample_count >= 2
      ? viewsPerHour - previous.views_per_hour
      : 0;
    const publishedAt = video.publishedAt
      ? Math.floor(new Date(video.publishedAt).getTime() / 1000)
      : null;
    const ageHours = publishedAt
      ? Math.max(0, (input.capturedAt - publishedAt) / 3600)
      : 24 * 365;

    return {
      video,
      previous,
      viewsPerHour,
      acceleration,
      sampleCount: previous ? previous.sample_count + 1 : 1,
      publishedAt,
      ageHours,
      relativeGrowth: previous
        ? Math.max(0, video.views - previous.views) / Math.max(1, previous.views)
        : 0,
      likeRate: video.likes / Math.max(1, video.views),
      freshness: Math.max(0, 1 - ageHours / 72),
    };
  });
  const signals = scoreTrendSignals(calculated.map((item) => ({
    velocity: item.viewsPerHour,
    acceleration: item.acceleration,
    relativeGrowth: item.relativeGrowth,
    likeRate: item.likeRate,
    freshness: item.freshness,
    sampleCount: item.sampleCount,
    ageHours: item.ageHours,
    format: item.video.videoFormat,
  })));

  const snapshotStatement = db
    .prepare(
      `INSERT INTO youtube_snapshots
         (id, region, scope, category_id, captured_at, captured_bucket, item_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         captured_at = excluded.captured_at,
         item_count = excluded.item_count`,
    )
    .bind(
      snapshotId,
      input.region,
      input.scope,
      input.categoryId,
      input.capturedAt,
      capturedBucket,
      input.videos.length,
    );

  const rankingStatements = calculated.map((item, index) => {
    const { video, previous } = item;
    const signal = signals[index];
    const delta = previous ? previous.rank - video.rank : null;
    const isNew = Boolean(previousSnapshot && !previous);

    return db
      .prepare(
        `INSERT INTO youtube_rankings
           (snapshot_id, video_id, rank, previous_rank, delta, is_new, views,
            likes, views_per_hour, previous_views_per_hour, view_acceleration,
            sample_count, velocity_percentile, acceleration_percentile,
            momentum_score, breakout_status, duration_seconds, video_format,
            format_population_size, title, channel, category_id,
            category_name, thumbnail, description, tags_json, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(snapshot_id, video_id) DO UPDATE SET
           rank = excluded.rank,
           previous_rank = excluded.previous_rank,
           delta = excluded.delta,
           is_new = excluded.is_new,
           views = excluded.views,
           likes = excluded.likes,
           views_per_hour = excluded.views_per_hour,
           previous_views_per_hour = excluded.previous_views_per_hour,
           view_acceleration = excluded.view_acceleration,
           sample_count = excluded.sample_count,
           velocity_percentile = excluded.velocity_percentile,
           acceleration_percentile = excluded.acceleration_percentile,
           momentum_score = excluded.momentum_score,
           breakout_status = excluded.breakout_status,
           duration_seconds = excluded.duration_seconds,
           video_format = excluded.video_format,
           format_population_size = excluded.format_population_size,
           title = excluded.title,
           channel = excluded.channel,
           category_id = excluded.category_id,
           category_name = excluded.category_name,
           thumbnail = excluded.thumbnail,
           description = excluded.description,
           tags_json = excluded.tags_json,
           published_at = excluded.published_at`,
      )
      .bind(
        snapshotId,
        video.id,
        video.rank,
        previous?.rank ?? null,
        delta,
        isNew ? 1 : 0,
        video.views,
        video.likes,
        item.viewsPerHour,
        previous?.views_per_hour ?? 0,
        item.acceleration,
        item.sampleCount,
        signal.velocityPercentile,
        signal.accelerationPercentile,
        signal.momentumScore,
        signal.breakoutStatus,
        video.durationSeconds,
        video.videoFormat,
        signal.formatPopulationSize,
        video.title,
        video.channel,
        video.categoryId,
        video.category,
        video.thumbnail,
        video.description,
        JSON.stringify(video.tags),
        Number.isFinite(item.publishedAt) ? item.publishedAt : null,
      );
  });

  await db.batch([snapshotStatement, ...rankingStatements]);
  const saved = await readLatestSnapshot(db, input.region, input.scope);
  return saved?.videos ?? input.videos;
}

export async function readVideoHistory(
  db: D1Database,
  region: TrendRegion,
  videoId: string,
  hours: number,
) {
  const minimumCapturedAt = Math.floor(Date.now() / 1000) - hours * 3600;
  const result = await db
    .prepare(
      `WITH ranked_points AS (
         SELECT s.captured_at, r.rank, r.views, r.likes, r.views_per_hour,
                r.view_acceleration,
                ROW_NUMBER() OVER (
                  PARTITION BY s.captured_at
                  ORDER BY CASE WHEN s.scope = 'all' THEN 0 ELSE 1 END
                ) AS scope_priority
         FROM youtube_snapshots s
         JOIN youtube_rankings r ON r.snapshot_id = s.id
         WHERE s.region = ? AND r.video_id = ? AND s.captured_at >= ?
       )
       SELECT captured_at, rank, views, likes, views_per_hour, view_acceleration
       FROM ranked_points
       WHERE scope_priority = 1
       ORDER BY captured_at ASC`,
    )
    .bind(region, videoId, minimumCapturedAt)
    .all<{
      captured_at: number;
      rank: number;
      views: number;
      likes: number;
      views_per_hour: number;
      view_acceleration: number;
    }>();

  return result.results.map((row) => ({
    capturedAt: new Date(row.captured_at * 1000).toISOString(),
    time: formatTime(row.captured_at),
    rank: row.rank,
    views: row.views,
    likes: row.likes,
    velocity: row.views_per_hour,
    acceleration: row.view_acceleration,
  }));
}

const categoryGroup = (categoryName: string) => {
  if (categoryName === "음악") return "music";
  if (["엔터테인먼트", "코미디", "영화·애니메이션"].includes(categoryName)) return "entertainment";
  if (categoryName === "게임") return "game";
  if (["과학기술", "교육"].includes(categoryName)) return "tech";
  return "other";
};

export async function readCategoryTrends(db: D1Database, region: TrendRegion, hours: number) {
  const minimumCapturedAt = Math.floor(Date.now() / 1000) - hours * 3600;
  const result = await db
    .prepare(
      `SELECT CAST(s.captured_at / 3600 AS INTEGER) * 3600 AS captured_hour,
              r.category_name, COUNT(*) AS item_count
       FROM youtube_snapshots s
       JOIN youtube_rankings r ON r.snapshot_id = s.id
       WHERE s.region = ? AND s.scope = 'all' AND s.captured_at >= ?
       GROUP BY captured_hour, r.category_name
       ORDER BY captured_hour ASC`,
    )
    .bind(region, minimumCapturedAt)
    .all<{ captured_hour: number; category_name: string; item_count: number }>();

  const byHour = new Map<number, Record<string, number>>();
  for (const row of result.results) {
    const point = byHour.get(row.captured_hour) ?? {
      music: 0,
      entertainment: 0,
      game: 0,
      tech: 0,
      other: 0,
    };
    const group = categoryGroup(row.category_name);
    point[group] = (point[group] ?? 0) + row.item_count;
    byHour.set(row.captured_hour, point);
  }

  return [...byHour.entries()].map(([capturedAt, counts]) => {
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const share = (key: string) => Math.round(((counts[key] ?? 0) / Math.max(1, total)) * 100);
    return {
      capturedAt: new Date(capturedAt * 1000).toISOString(),
      time: formatTime(capturedAt),
      music: share("music"),
      entertainment: share("entertainment"),
      game: share("game"),
      tech: share("tech"),
      other: share("other"),
      sampleSize: total,
    };
  });
}

export async function readChurn(db: D1Database, region: TrendRegion, hours: number) {
  const minimumCapturedAt = Math.floor(Date.now() / 1000) - hours * 3600;
  const result = await db
    .prepare(
      `WITH hour_candidates AS (
         SELECT id, captured_at,
                ROW_NUMBER() OVER (
                  PARTITION BY CAST(captured_at / 3600 AS INTEGER)
                  ORDER BY captured_at DESC
                ) AS hour_priority
         FROM youtube_snapshots
         WHERE region = ? AND scope = 'all' AND captured_at >= ?
       ), hourly AS (
         SELECT id, captured_at FROM hour_candidates WHERE hour_priority = 1
       ), ordered AS (
         SELECT id, captured_at, LAG(id) OVER (ORDER BY captured_at ASC) AS previous_id
         FROM hourly
       )
       SELECT current.captured_at,
              (SELECT COUNT(*) FROM youtube_rankings current_rank
               LEFT JOIN youtube_rankings previous_rank
                 ON previous_rank.snapshot_id = current.previous_id
                AND previous_rank.video_id = current_rank.video_id
               WHERE current_rank.snapshot_id = current.id
                 AND previous_rank.video_id IS NULL) AS entered,
              (SELECT COUNT(*) FROM youtube_rankings previous_rank
               LEFT JOIN youtube_rankings current_rank
                 ON current_rank.snapshot_id = current.id
                AND current_rank.video_id = previous_rank.video_id
               WHERE previous_rank.snapshot_id = current.previous_id
                 AND current_rank.video_id IS NULL) AS exited
       FROM ordered current
       WHERE current.previous_id IS NOT NULL
       ORDER BY current.captured_at ASC`,
    )
    .bind(region, minimumCapturedAt)
    .all<{ captured_at: number; entered: number; exited: number }>();

  return result.results.map((row) => ({
    capturedAt: new Date(row.captured_at * 1000).toISOString(),
    time: formatTime(row.captured_at),
    entered: row.entered,
    exited: row.exited,
  }));
}

export async function readRisingKeywords(
  db: D1Database,
  region: TrendRegion,
  hours: number,
) {
  const minimumCapturedAt = Math.floor(Date.now() / 1000) - hours * 3600;
  const result = await db
    .prepare(
      `WITH deduped AS (
         SELECT s.captured_bucket, s.captured_at, s.scope, r.video_id,
                r.title, r.tags_json, r.views_per_hour, r.momentum_score,
                ROW_NUMBER() OVER (
                  PARTITION BY s.captured_bucket, r.video_id
                  ORDER BY CASE WHEN s.scope = 'all' THEN 0 ELSE 1 END,
                           r.momentum_score DESC
                ) AS video_priority
         FROM youtube_snapshots s
         JOIN youtube_rankings r ON r.snapshot_id = s.id
         WHERE s.region = ? AND s.captured_at >= ?
       )
       SELECT captured_bucket, captured_at, scope, video_id, title, tags_json,
              views_per_hour, momentum_score
       FROM deduped
       WHERE video_priority = 1
       ORDER BY captured_bucket ASC, video_id ASC`,
    )
    .bind(region, minimumCapturedAt)
    .all<{
      captured_bucket: number;
      captured_at: number;
      scope: string;
      video_id: string;
      title: string;
      tags_json: string;
      views_per_hour: number;
      momentum_score: number;
    }>();

  const capturedTimes = [...new Set(result.results.map((row) => row.captured_bucket))];
  const analyzedVideos = new Set(result.results.map((row) => row.video_id)).size;
  const scopeCount = new Set(result.results.map((row) => row.scope)).size;
  if (capturedTimes.length < 2) {
    const latestCapturedAt = result.results.reduce((latest, row) => Math.max(latest, row.captured_at), 0);
    return {
      ready: false,
      snapshots: capturedTimes.length,
      analyzedVideos,
      scopeCount,
      recentFrom: latestCapturedAt ? new Date(latestCapturedAt * 1000).toISOString() : null,
      previousFrom: null,
      latestCapturedAt: latestCapturedAt ? new Date(latestCapturedAt * 1000).toISOString() : null,
      keywords: [],
    };
  }

  const splitIndex = Math.max(1, Math.floor(capturedTimes.length / 2));
  const splitAt = capturedTimes[splitIndex];
  const previousRows = result.results.filter((row) => row.captured_bucket < splitAt);
  const recentRows = result.results.filter((row) => row.captured_bucket >= splitAt);
  type KeywordAggregate = {
    previousMentions: number;
    recentMentions: number;
    recentVelocity: number;
    videos: Map<string, number>;
  };
  const aggregates = new Map<string, KeywordAggregate>();
  const addRows = (rows: typeof result.results, period: "previous" | "recent") => {
    rows.forEach((row) => {
      extractKeywordTokens(row.title, row.tags_json).forEach((keyword) => {
        const aggregate = aggregates.get(keyword) ?? {
          previousMentions: 0,
          recentMentions: 0,
          recentVelocity: 0,
          videos: new Map<string, number>(),
        };
        if (period === "previous") {
          aggregate.previousMentions += 1;
        } else {
          aggregate.recentMentions += 1;
          aggregate.recentVelocity += row.views_per_hour;
          aggregate.videos.set(
            row.video_id,
            Math.max(aggregate.videos.get(row.video_id) ?? 0, row.views_per_hour),
          );
        }
        aggregates.set(keyword, aggregate);
      });
    });
  };
  addRows(previousRows, "previous");
  addRows(recentRows, "recent");

  const toShare = (mentions: number, total: number) => mentions / Math.max(1, total) * 100;
  const keywords = [...aggregates.entries()]
    .map(([keyword, aggregate]) => {
      const recentShare = toShare(aggregate.recentMentions, recentRows.length);
      const previousShare = toShare(aggregate.previousMentions, previousRows.length);
      const shareDelta = recentShare - previousShare;
      const lift = previousShare > 0 ? recentShare / previousShare : recentShare > 0 ? 3 : 0;
      const signalScore = Math.round(Math.min(100, Math.max(0,
        shareDelta * 12 + Math.log2(Math.max(1, lift)) * 14 + recentShare * 2,
      )));
      return {
        keyword,
        recentMentions: aggregate.recentMentions,
        previousMentions: aggregate.previousMentions,
        recentShare: Math.round(recentShare * 10) / 10,
        previousShare: Math.round(previousShare * 10) / 10,
        shareDelta: Math.round(shareDelta * 10) / 10,
        signalScore,
        averageVelocity: Math.round(aggregate.recentVelocity / Math.max(1, aggregate.recentMentions)),
        topVideoIds: [...aggregate.videos.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([videoId]) => videoId),
      };
    })
    .filter((keyword) => keyword.recentMentions >= 2 && keyword.shareDelta > 0)
    .sort((a, b) => b.signalScore - a.signalScore || b.shareDelta - a.shareDelta)
    .slice(0, 24);

  return {
    ready: true,
    snapshots: capturedTimes.length,
    analyzedVideos,
    scopeCount,
    recentFrom: new Date(Math.min(...recentRows.map((row) => row.captured_at)) * 1000).toISOString(),
    previousFrom: new Date(Math.min(...previousRows.map((row) => row.captured_at)) * 1000).toISOString(),
    latestCapturedAt: new Date(Math.max(...result.results.map((row) => row.captured_at)) * 1000).toISOString(),
    keywords,
  };
}

export async function readSignalValidation(
  db: D1Database,
  region: TrendRegion,
  horizonHours = 12,
) {
  const now = Math.floor(Date.now() / 1000);
  const horizonSeconds = horizonHours * 3600;
  const windowFrom = now - 7 * 24 * 3600;
  const matureBefore = now - horizonSeconds;
  const result = await db
    .prepare(
      `WITH signal_candidates AS (
         SELECT s.scope, r.video_id, s.captured_at AS signal_at,
                r.rank AS signal_rank, r.momentum_score,
                ROW_NUMBER() OVER (
                  PARTITION BY s.scope, r.video_id
                  ORDER BY s.captured_at ASC
                ) AS signal_priority
         FROM youtube_snapshots s
         JOIN youtube_rankings r ON r.snapshot_id = s.id
         WHERE s.region = ?
           AND s.captured_at >= ?
           AND s.captured_at <= ?
           AND r.breakout_status IN ('EARLY', 'BREAKOUT')
       ), signals AS (
         SELECT scope, video_id, signal_at, signal_rank, momentum_score
         FROM signal_candidates
         WHERE signal_priority = 1
       ), outcomes AS (
         SELECT signal.scope, signal.video_id, signal.signal_at,
                signal.signal_rank, signal.momentum_score,
                MIN(later_rank.rank) AS best_rank,
                MIN(CASE WHEN later_rank.rank <= 10 THEN later.captured_at END) AS top10_at
         FROM signals signal
         LEFT JOIN youtube_snapshots later
           ON later.region = ?
          AND later.scope = signal.scope
          AND later.captured_at > signal.signal_at
          AND later.captured_at <= signal.signal_at + ?
         LEFT JOIN youtube_rankings later_rank
           ON later_rank.snapshot_id = later.id
          AND later_rank.video_id = signal.video_id
         GROUP BY signal.scope, signal.video_id, signal.signal_at,
                  signal.signal_rank, signal.momentum_score
       )
       SELECT COUNT(*) AS observed_signals,
              SUM(CASE WHEN top10_at IS NOT NULL THEN 1 ELSE 0 END) AS top10_hits,
              SUM(CASE WHEN best_rank IS NOT NULL AND signal_rank - best_rank >= 3 THEN 1 ELSE 0 END) AS rising_hits,
              AVG(CASE WHEN top10_at IS NOT NULL THEN (top10_at - signal_at) / 3600.0 END) AS average_lead_hours
       FROM outcomes`,
    )
    .bind(region, windowFrom, matureBefore, region, horizonSeconds)
    .first<{
      observed_signals: number;
      top10_hits: number;
      rising_hits: number;
      average_lead_hours: number | null;
    }>();
  const observedSignals = result?.observed_signals ?? 0;
  const percentage = (value: number) => observedSignals
    ? Math.round(value / observedSignals * 100)
    : 0;
  return {
    horizonHours,
    observedSignals,
    top10Hits: result?.top10_hits ?? 0,
    top10Rate: percentage(result?.top10_hits ?? 0),
    risingHits: result?.rising_hits ?? 0,
    risingRate: percentage(result?.rising_hits ?? 0),
    averageLeadHours: result?.average_lead_hours === null || result?.average_lead_hours === undefined
      ? null
      : Math.round(result.average_lead_hours * 10) / 10,
  };
}

export async function readStorageStatus(db: D1Database, region: TrendRegion) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS snapshot_count,
              MIN(captured_at) AS first_captured_at,
              MAX(captured_at) AS latest_captured_at
       FROM youtube_snapshots
       WHERE region = ?`,
    )
    .bind(region)
    .first<{
      snapshot_count: number;
      first_captured_at: number | null;
      latest_captured_at: number | null;
    }>();

  return {
    enabled: true,
    snapshotCount: row?.snapshot_count ?? 0,
    firstCapturedAt: row?.first_captured_at ? new Date(row.first_captured_at * 1000).toISOString() : null,
    latestCapturedAt: row?.latest_captured_at ? new Date(row.latest_captured_at * 1000).toISOString() : null,
  };
}

export async function startCollectorRun(
  db: D1Database,
  input: { trigger: "cron" | "request"; scopesTotal: number },
) {
  const id = crypto.randomUUID();
  const startedAt = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO youtube_collector_runs
         (id, trigger, status, started_at, scopes_total, scopes_succeeded,
          videos_collected, quota_units)
       VALUES (?, ?, 'running', ?, ?, 0, 0, 0)`,
    )
    .bind(id, input.trigger, startedAt, input.scopesTotal)
    .run();
  return id;
}

export async function finishCollectorRun(
  db: D1Database,
  id: string,
  input: {
    status: "success" | "partial" | "failed";
    scopesSucceeded: number;
    videosCollected: number;
    quotaUnits: number;
    errorSummary: string | null;
  },
) {
  await db
    .prepare(
      `UPDATE youtube_collector_runs
       SET status = ?, completed_at = ?, scopes_succeeded = ?,
           videos_collected = ?, quota_units = ?, error_summary = ?
       WHERE id = ?`,
    )
    .bind(
      input.status,
      Math.floor(Date.now() / 1000),
      input.scopesSucceeded,
      input.videosCollected,
      input.quotaUnits,
      input.errorSummary,
      id,
    )
    .run();
}

export async function readCollectorStatus(db: D1Database) {
  const [latest, lastSuccess] = await Promise.all([
    db
      .prepare(
        `SELECT id, trigger, status, started_at, completed_at, scopes_total,
                scopes_succeeded, videos_collected, quota_units, error_summary
         FROM youtube_collector_runs
         ORDER BY started_at DESC LIMIT 1`,
      )
      .first<CollectorRunRow>(),
    db
      .prepare(
        `SELECT completed_at FROM youtube_collector_runs
         WHERE status = 'success' AND completed_at IS NOT NULL
         ORDER BY completed_at DESC LIMIT 1`,
      )
      .first<{ completed_at: number }>(),
  ]);

  return {
    enabled: true,
    latestRun: latest ? {
      id: latest.id,
      trigger: latest.trigger,
      status: latest.status,
      startedAt: new Date(latest.started_at * 1000).toISOString(),
      completedAt: latest.completed_at ? new Date(latest.completed_at * 1000).toISOString() : null,
      scopesTotal: latest.scopes_total,
      scopesSucceeded: latest.scopes_succeeded,
      videosCollected: latest.videos_collected,
      quotaUnits: latest.quota_units,
      errorSummary: latest.error_summary,
    } : null,
    lastSuccessAt: lastSuccess?.completed_at
      ? new Date(lastSuccess.completed_at * 1000).toISOString()
      : null,
  };
}

export async function pruneSnapshots(db: D1Database, retentionDays = 30) {
  const cutoff = Math.floor(Date.now() / 1000) - retentionDays * 24 * 3600;
  await db.batch([
    db.prepare("DELETE FROM youtube_snapshots WHERE captured_at < ?").bind(cutoff),
    db.prepare("DELETE FROM youtube_collector_runs WHERE started_at < ?").bind(cutoff),
  ]);
}
