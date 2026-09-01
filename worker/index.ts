/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  finishCollectorRun,
  pruneSnapshots,
  readCategoryTrends,
  readChurn,
  readCollectorStatus,
  readLatestSignals,
  readLatestSnapshot,
  readRisingKeywords,
  readSignalValidation,
  readStorageStatus,
  readVideoHistory,
  saveSnapshot,
  scopeForCategory,
  startCollectorRun,
  type TrendRegion,
  type TrendSnapshotVideo,
} from "./youtube-store";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  YT_API_KEY?: string;
  ADSENSE_PUBLISHER_ID?: string;
  ADSENSE_FEED_SLOT_ID?: string;
  ADSENSE_FEED_LAYOUT_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const readAdSenseConfig = (env?: Env) => {
  const publisherMatch = env?.ADSENSE_PUBLISHER_ID?.trim().match(/^(?:ca-)?(pub-\d{16})$/);
  if (!publisherMatch) return null;

  const slot = env?.ADSENSE_FEED_SLOT_ID?.trim() ?? "";
  const layoutKey = env?.ADSENSE_FEED_LAYOUT_KEY?.trim() ?? "";
  return {
    client: `ca-${publisherMatch[1]}`,
    publisher: publisherMatch[1],
    slot: /^\d+$/.test(slot) ? slot : null,
    layoutKey: /^[-+A-Za-z0-9/]+$/.test(layoutKey) ? layoutKey : null,
  };
};

const injectAdSenseConfig = async (response: Response, env: Env) => {
  const config = readAdSenseConfig(env);
  const contentType = response.headers.get("content-type") ?? "";
  if (!config || [204, 205, 304].includes(response.status) || !contentType.toLowerCase().startsWith("text/html")) {
    return response;
  }

  const html = await response.text();
  const htmlAttributes = [
    `data-adsense-client="${config.client}"`,
    config.slot ? `data-adsense-feed-slot="${config.slot}"` : "",
    config.layoutKey ? `data-adsense-feed-layout-key="${config.layoutKey}"` : "",
  ].filter(Boolean).join(" ");
  const headMarkup = [
    `<meta name="google-adsense-account" content="${config.client}">`,
    `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}" crossorigin="anonymous"></script>`,
  ].join("");
  const body = html
    .replace(/<html\b/i, `<html ${htmlAttributes}`)
    .replace(/<\/head>/i, `${headMarkup}</head>`);
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

type YouTubeVideoItem = {
  id?: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    categoryId?: string;
    publishedAt?: string;
    description?: string;
    tags?: string[];
    thumbnails?: Record<string, { url?: string }>;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
};

type YouTubeVideosResponse = {
  items?: YouTubeVideoItem[];
};

const CATEGORY_NAMES: Record<string, string> = {
  "1": "영화·애니메이션",
  "2": "자동차",
  "10": "음악",
  "15": "동물",
  "17": "스포츠",
  "19": "여행·이벤트",
  "20": "게임",
  "22": "인물·블로그",
  "23": "코미디",
  "24": "엔터테인먼트",
  "25": "뉴스·정치",
  "26": "노하우·스타일",
  "27": "교육",
  "28": "과학기술",
  "29": "비영리·사회운동",
};

const FEATURED_CATEGORIES = [
  { id: "10", label: "음악" },
  { id: "20", label: "게임" },
  { id: "24", label: "엔터테인먼트" },
  { id: "25", label: "뉴스·정치" },
  { id: "17", label: "스포츠" },
  { id: "1", label: "영화·애니메이션" },
  { id: "28", label: "과학기술" },
  { id: "23", label: "코미디" },
] as const;

const FEATURED_CATEGORY_IDS: Set<string> = new Set(
  FEATURED_CATEGORIES.map((category) => category.id),
);

const REGIONS: ReadonlyArray<{ code: TrendRegion; label: string }> = [
  { code: "KR", label: "대한민국" },
  { code: "JP", label: "일본" },
  { code: "US", label: "미국" },
];
const DEFAULT_REGION: TrendRegion = "KR";
const REGION_CODES = new Set<TrendRegion>(REGIONS.map((region) => region.code));
const isTrendRegion = (value: string): value is TrendRegion =>
  REGION_CODES.has(value as TrendRegion);
const regionLabel = (region: TrendRegion) =>
  REGIONS.find((item) => item.code === region)?.label ?? region;

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });

const compactText = (value = "", maxLength = 180) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trimEnd()}…`
    : normalized;
};

const asCount = (value?: string) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDurationSeconds = (duration?: string) => {
  const match = duration?.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match) return 0;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Math.round(Number(days) * 86_400 + Number(hours) * 3_600 + Number(minutes) * 60 + Number(seconds));
};

function buildTrendingVideo(
  item: YouTubeVideoItem,
  index: number,
  region: TrendRegion,
): TrendSnapshotVideo | null {
  if (!item.id || !item.snippet) return null;

  const views = asCount(item.statistics?.viewCount);
  const publishedAt = item.snippet.publishedAt ?? new Date().toISOString();
  const ageInHours = Math.max(
    1,
    (Date.now() - new Date(publishedAt).getTime()) / 3_600_000,
  );
  const category = CATEGORY_NAMES[item.snippet.categoryId ?? ""] ?? "기타";
  const market = regionLabel(region);
  const durationSeconds = parseDurationSeconds(item.contentDetails?.duration);
  const videoFormat = durationSeconds > 0 && durationSeconds <= 180 ? "SHORTS" : "LONG_FORM";

  return {
    id: item.id,
    title: item.snippet.title ?? "제목 없음",
    channel: item.snippet.channelTitle ?? "채널 정보 없음",
    categoryId: item.snippet.categoryId ?? null,
    category,
    views,
    likes: asCount(item.statistics?.likeCount),
    velocity: Math.round(views / ageInHours),
    velocityKind: "lifetime" as const,
    acceleration: 0,
    sampleCount: 1,
    velocityPercentile: 0,
    accelerationPercentile: 0,
    momentumScore: 0,
    breakoutStatus: "NONE" as const,
    durationSeconds,
    videoFormat,
    formatPopulationSize: 0,
    delta: null,
    rank: index + 1,
    thumbnail:
      item.snippet.thumbnails?.maxres?.url ??
      item.snippet.thumbnails?.high?.url ??
      item.snippet.thumbnails?.medium?.url ??
      `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    description:
      compactText(item.snippet.description) ||
      `${item.snippet.channelTitle ?? "이 채널"}의 현재 ${market} 인기 영상입니다.`,
    tags: item.snippet.tags?.slice(0, 3) ?? [category],
    aiNote: `YouTube Data API의 ${market} 인기 영상 현재 스냅샷 ${index + 1}위입니다.`,
    history: [{ time: "현재", rank: index + 1, views }],
    publishedAt,
    source: "youtube" as const,
  };
}

class YouTubeApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function fetchYouTubeTrending(
  env: Env,
  region: TrendRegion,
  categoryId: string | null,
): Promise<TrendSnapshotVideo[]> {
  if (!env.YT_API_KEY) {
    throw new YouTubeApiError(
      "YT_API_KEY가 Cloudflare Worker Runtime Secret에 설정되지 않았습니다.",
      "missing_api_key",
      503,
    );
  }

  const apiUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  const apiParams = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    chart: "mostPopular",
    regionCode: region,
    maxResults: "25",
    key: env.YT_API_KEY,
  });
  if (categoryId) apiParams.set("videoCategoryId", categoryId);
  apiUrl.search = apiParams.toString();

  const upstream = await fetch(apiUrl, { headers: { Accept: "application/json" } });
  if (!upstream.ok) {
    console.error("YouTube Data API request failed", upstream.status);
    throw new YouTubeApiError(
      upstream.status === 403
        ? "YouTube API 요청이 거부되었습니다. API 활성화, 키 제한, 할당량을 확인해 주세요."
        : "YouTube 인기 영상을 불러오지 못했습니다.",
      upstream.status === 403 ? "youtube_api_denied" : "youtube_api_error",
      upstream.status === 429 ? 429 : 502,
    );
  }

  const data = (await upstream.json()) as YouTubeVideosResponse;
  const videos = (data.items ?? [])
    .map((item, index) => buildTrendingVideo(item, index, region))
    .filter((video): video is TrendSnapshotVideo => Boolean(video));

  if (!videos.length) {
    throw new YouTubeApiError(
      "YouTube API returned no videos.",
      "empty_result",
      502,
    );
  }

  return videos;
}

async function collectScope(
  env: Env,
  region: TrendRegion,
  categoryId: string | null,
) {
  const capturedAtSeconds = Math.floor(Date.now() / 1000);
  const videos = await fetchYouTubeTrending(env, region, categoryId);

  if (!env.DB) {
    return {
      capturedAt: new Date(capturedAtSeconds * 1000).toISOString(),
      videos,
      stored: false,
      storageError: null,
    };
  }

  try {
    const savedVideos = await saveSnapshot(env.DB, {
      region,
      scope: scopeForCategory(categoryId),
      categoryId,
      capturedAt: capturedAtSeconds,
      videos,
    });
    return {
      capturedAt: new Date(capturedAtSeconds * 1000).toISOString(),
      videos: savedVideos,
      stored: true,
      storageError: null,
    };
  } catch (error) {
    console.error("D1 snapshot save failed; serving current YouTube data", error);
    return {
      capturedAt: new Date(capturedAtSeconds * 1000).toISOString(),
      videos,
      stored: false,
      storageError: error instanceof Error ? error.message : "D1 snapshot save failed",
    };
  }
}

const trendingResponse = (
  region: TrendRegion,
  categoryId: string | null,
  capturedAt: string,
  videos: TrendSnapshotVideo[],
  historyEnabled: boolean,
  dataOrigin: "youtube_api" | "d1_snapshot",
) =>
  jsonResponse(
    {
      source: "youtube",
      region,
      category: categoryId
        ? { id: categoryId, label: CATEGORY_NAMES[categoryId] ?? "기타" }
        : null,
      capturedAt,
      historyEnabled,
      dataOrigin,
      videos,
    },
    200,
    {
      "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
    },
  );

async function handleYouTubeTrending(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const categoryId = requestUrl.searchParams.get("category");
  const regionValue = requestUrl.searchParams.get("region") ?? DEFAULT_REGION;
  if (!isTrendRegion(regionValue)) {
    return jsonResponse(
      {
        error: "지원하지 않는 YouTube 국가입니다.",
        code: "invalid_region",
      },
      400,
      { "Cache-Control": "no-store" },
    );
  }
  const region = regionValue;
  if (categoryId && !FEATURED_CATEGORY_IDS.has(categoryId)) {
    return jsonResponse(
      {
        error: "지원하지 않는 YouTube 카테고리입니다.",
        code: "invalid_category",
      },
      400,
      { "Cache-Control": "no-store" },
    );
  }

  const cacheUrl = new URL(request.url);
  const cacheParams = new URLSearchParams({ region });
  if (categoryId) cacheParams.set("category", categoryId);
  cacheUrl.search = cacheParams.toString();
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const scope = scopeForCategory(categoryId);
  if (env.DB) {
    try {
      const stored = await readLatestSnapshot(env.DB, region, scope);
      if (stored) {
        const response = trendingResponse(
          region,
          categoryId,
          stored.capturedAt,
          stored.videos,
          true,
          "d1_snapshot",
        );
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      }
    } catch (error) {
      console.error("D1 snapshot read failed; falling back to YouTube", error);
    }
  }

  let collected: Awaited<ReturnType<typeof collectScope>>;
  try {
    collected = await collectScope(env, region, categoryId);
  } catch (error) {
    if (error instanceof YouTubeApiError) {
      return jsonResponse(
        { error: error.message, code: error.code },
        error.status,
        { "Cache-Control": "no-store" },
      );
    }
    console.error("YouTube collection failed", error);
    return jsonResponse(
      { error: "YouTube 인기 영상을 불러오지 못했습니다.", code: "youtube_api_error" },
      502,
      { "Cache-Control": "no-store" },
    );
  }

  const response = trendingResponse(
    region,
    categoryId,
    collected.capturedAt,
    collected.videos,
    collected.stored,
    "youtube_api",
  );

  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

const requestedHours = (url: URL) => {
  const parsed = Number(url.searchParams.get("hours") ?? 168);
  return Number.isFinite(parsed) ? Math.min(720, Math.max(24, Math.round(parsed))) : 168;
};

const storageUnavailable = () =>
  jsonResponse(
    {
      error: "D1 데이터베이스가 아직 연결되지 않았습니다.",
      code: "storage_unavailable",
    },
    503,
    { "Cache-Control": "no-store" },
  );

class RequestValidationError extends Error {}

const requestedRegion = (url: URL): TrendRegion => {
  const value = url.searchParams.get("region") ?? DEFAULT_REGION;
  if (!isTrendRegion(value)) {
    throw new RequestValidationError("지원하지 않는 YouTube 국가입니다.");
  }
  return value;
};

async function handleStorageRequest(
  request: Request,
  env: Env,
  reader: (db: D1Database, url: URL) => Promise<unknown>,
) {
  if (request.method !== "GET") {
    return jsonResponse(
      { error: "Method not allowed", code: "method_not_allowed" },
      405,
      { Allow: "GET", "Cache-Control": "no-store" },
    );
  }
  if (!env.DB) return storageUnavailable();

  try {
    return jsonResponse(await reader(env.DB, new URL(request.url)), 200, {
      "Cache-Control": "public, max-age=60, s-maxage=300",
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return jsonResponse(
        { error: error.message, code: "invalid_request" },
        400,
        { "Cache-Control": "no-store" },
      );
    }
    console.error("D1 analytics query failed", error);
    return jsonResponse(
      {
        error: "D1 스키마 적용 또는 스냅샷 수집 상태를 확인해 주세요.",
        code: "storage_not_ready",
      },
      503,
      { "Cache-Control": "no-store" },
    );
  }
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ads.txt") {
      const config = readAdSenseConfig(env);
      return new Response(
        config ? `google.com, ${config.publisher}, DIRECT, f08c47fec0942fa0\n` : "",
        {
          status: config ? 200 : 404,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        },
      );
    }

    if (url.pathname === "/api/youtube/trending") {
      if (request.method !== "GET") {
        return jsonResponse(
          { error: "Method not allowed", code: "method_not_allowed" },
          405,
          { Allow: "GET", "Cache-Control": "no-store" },
        );
      }
      return handleYouTubeTrending(request, env, ctx);
    }

    if (url.pathname === "/api/youtube/history") {
      return handleStorageRequest(request, env, async (db, requestUrl) => {
        const videoId = requestUrl.searchParams.get("videoId") ?? "";
        if (!/^[A-Za-z0-9_-]{6,32}$/.test(videoId)) {
          throw new RequestValidationError("올바른 YouTube videoId가 필요합니다.");
        }
        const hours = requestedHours(requestUrl);
        const region = requestedRegion(requestUrl);
        return {
          region,
          videoId,
          hours,
          points: await readVideoHistory(db, region, videoId, hours),
        };
      });
    }

    if (url.pathname === "/api/youtube/category-trends") {
      return handleStorageRequest(request, env, async (db, requestUrl) => {
        const hours = requestedHours(requestUrl);
        const region = requestedRegion(requestUrl);
        return {
          region,
          hours,
          points: await readCategoryTrends(db, region, hours),
        };
      });
    }

    if (url.pathname === "/api/youtube/churn") {
      return handleStorageRequest(request, env, async (db, requestUrl) => {
        const hours = requestedHours(requestUrl);
        const region = requestedRegion(requestUrl);
        return {
          region,
          hours,
          points: await readChurn(db, region, hours),
        };
      });
    }

    if (url.pathname === "/api/youtube/rising-keywords") {
      return handleStorageRequest(request, env, async (db, requestUrl) => {
        const hours = requestedHours(requestUrl);
        const region = requestedRegion(requestUrl);
        return {
          region,
          hours,
          ...(await readRisingKeywords(db, region, hours)),
        };
      });
    }

    if (url.pathname === "/api/youtube/signals") {
      return handleStorageRequest(request, env, async (db, requestUrl) => {
        const region = requestedRegion(requestUrl);
        const result = await readLatestSignals(db, region);
        if (!result) {
          return { region, capturedAt: null, scopeCount: 0, analysisCount: 0, videos: [] };
        }
        return { region, ...result };
      });
    }

    if (url.pathname === "/api/youtube/signal-validation") {
      return handleStorageRequest(request, env, async (db, requestUrl) => {
        const region = requestedRegion(requestUrl);
        return { region, ...(await readSignalValidation(db, region, 12)) };
      });
    }

    if (url.pathname === "/api/youtube/storage-status") {
      return handleStorageRequest(request, env, async (db, requestUrl) => {
        const region = requestedRegion(requestUrl);
        return { region, ...(await readStorageStatus(db, region)) };
      });
    }

    if (url.pathname === "/api/youtube/collector-status") {
      return handleStorageRequest(request, env, async (db) => readCollectorStatus(db));
    }

    if (url.pathname === "/api/youtube/categories") {
      if (request.method !== "GET") {
        return jsonResponse(
          { error: "Method not allowed", code: "method_not_allowed" },
          405,
          { Allow: "GET", "Cache-Control": "no-store" },
        );
      }
      const regionValue = url.searchParams.get("region") ?? DEFAULT_REGION;
      if (!isTrendRegion(regionValue)) {
        return jsonResponse(
          { error: "지원하지 않는 YouTube 국가입니다.", code: "invalid_region" },
          400,
          { "Cache-Control": "no-store" },
        );
      }
      return jsonResponse(
        { region: regionValue, regions: REGIONS, categories: FEATURED_CATEGORIES },
        200,
        { "Cache-Control": "public, max-age=86400" },
      );
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return injectAdSenseConfig(await handler.fetch(request, env, ctx), env);
  },

  async scheduled(
    _controller: { scheduledTime: number; cron: string },
    env: Env,
    ctx: ExecutionContext,
  ) {
    if (!env.DB || !env.YT_API_KEY) return;

    ctx.waitUntil((async () => {
      const categoryIds: Array<string | null> = [
        null,
        ...FEATURED_CATEGORIES.map((category) => category.id),
      ];
      const collectionJobs = REGIONS.flatMap((region) =>
        categoryIds.map((categoryId) => ({ region: region.code, categoryId })),
      );
      let runId: string | null = null;
      try {
        runId = await startCollectorRun(env.DB!, {
          trigger: "cron",
          scopesTotal: collectionJobs.length,
        });
      } catch (error) {
        console.error("Collector run log could not be started", error);
      }

      const results = await Promise.allSettled(
        collectionJobs.map((job) => collectScope(env, job.region, job.categoryId)),
      );
      let scopesSucceeded = 0;
      let videosCollected = 0;
      const errors: string[] = [];
      results.forEach((result, index) => {
        const job = collectionJobs[index];
        const scopeLabel = `${job.region}/${job.categoryId ?? "all"}`;
        if (result.status === "rejected") {
          const message = result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
          errors.push(`${scopeLabel}: ${message}`);
          console.error(
            `Scheduled YouTube collection failed for ${scopeLabel}`,
            result.reason,
          );
        } else if (result.value.stored) {
          scopesSucceeded += 1;
          videosCollected += result.value.videos.length;
        } else {
          errors.push(
            `${scopeLabel}: ${result.value.storageError ?? "snapshot not stored"}`,
          );
        }
      });

      const status = scopesSucceeded === collectionJobs.length
        ? "success"
        : scopesSucceeded > 0
          ? "partial"
          : "failed";
      if (runId) {
        try {
          await finishCollectorRun(env.DB!, runId, {
            status,
            scopesSucceeded,
            videosCollected,
            quotaUnits: collectionJobs.length,
            errorSummary: errors.length ? errors.join(" | ").slice(0, 1000) : null,
          });
        } catch (error) {
          console.error("Collector run log could not be completed", error);
        }
      }

      try {
        await pruneSnapshots(env.DB!);
      } catch (error) {
        console.error("Snapshot retention cleanup failed", error);
      }
    })());
  },
};

export default worker;
