/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  finishCollectorRun,
  pruneSnapshots,
  readCategoryTrends,
  readChurn,
  readCollectorStatus,
  readLatestSnapshot,
  readStorageStatus,
  readVideoHistory,
  saveSnapshot,
  scopeForCategory,
  startCollectorRun,
  type TrendSnapshotVideo,
} from "./youtube-store";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  YT_API_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

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

function buildTrendingVideo(item: YouTubeVideoItem, index: number): TrendSnapshotVideo | null {
  if (!item.id || !item.snippet) return null;

  const views = asCount(item.statistics?.viewCount);
  const publishedAt = item.snippet.publishedAt ?? new Date().toISOString();
  const ageInHours = Math.max(
    1,
    (Date.now() - new Date(publishedAt).getTime()) / 3_600_000,
  );
  const category = CATEGORY_NAMES[item.snippet.categoryId ?? ""] ?? "기타";

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
    delta: null,
    rank: index + 1,
    thumbnail:
      item.snippet.thumbnails?.maxres?.url ??
      item.snippet.thumbnails?.high?.url ??
      item.snippet.thumbnails?.medium?.url ??
      `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    description:
      compactText(item.snippet.description) ||
      `${item.snippet.channelTitle ?? "이 채널"}의 현재 대한민국 인기 영상입니다.`,
    tags: item.snippet.tags?.slice(0, 3) ?? [category],
    aiNote: `YouTube Data API의 대한민국 인기 영상 현재 스냅샷 ${index + 1}위입니다.`,
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
    part: "snippet,statistics",
    chart: "mostPopular",
    regionCode: "KR",
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
    .map(buildTrendingVideo)
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

async function collectScope(env: Env, categoryId: string | null) {
  const capturedAtSeconds = Math.floor(Date.now() / 1000);
  const videos = await fetchYouTubeTrending(env, categoryId);

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
  categoryId: string | null,
  capturedAt: string,
  videos: TrendSnapshotVideo[],
  historyEnabled: boolean,
) =>
  jsonResponse(
    {
      source: "youtube",
      region: "KR",
      category: categoryId
        ? { id: categoryId, label: CATEGORY_NAMES[categoryId] ?? "기타" }
        : null,
      capturedAt,
      historyEnabled,
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
  cacheUrl.search = categoryId
    ? new URLSearchParams({ category: categoryId }).toString()
    : "";
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const scope = scopeForCategory(categoryId);
  if (env.DB) {
    try {
      const stored = await readLatestSnapshot(env.DB, scope);
      if (stored) {
        const response = trendingResponse(
          categoryId,
          stored.capturedAt,
          stored.videos,
          true,
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
    collected = await collectScope(env, categoryId);
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
    categoryId,
    collected.capturedAt,
    collected.videos,
    collected.stored,
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
        return {
          videoId,
          hours,
          points: await readVideoHistory(db, videoId, hours),
        };
      });
    }

    if (url.pathname === "/api/youtube/category-trends") {
      return handleStorageRequest(request, env, async (db, requestUrl) => {
        const hours = requestedHours(requestUrl);
        return {
          hours,
          points: await readCategoryTrends(db, hours),
        };
      });
    }

    if (url.pathname === "/api/youtube/churn") {
      return handleStorageRequest(request, env, async (db, requestUrl) => {
        const hours = requestedHours(requestUrl);
        return {
          hours,
          points: await readChurn(db, hours),
        };
      });
    }

    if (url.pathname === "/api/youtube/storage-status") {
      return handleStorageRequest(request, env, async (db) => readStorageStatus(db));
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
      return jsonResponse(
        { region: "KR", categories: FEATURED_CATEGORIES },
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

    return handler.fetch(request, env, ctx);
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
      let runId: string | null = null;
      try {
        runId = await startCollectorRun(env.DB!, {
          trigger: "cron",
          scopesTotal: categoryIds.length,
        });
      } catch (error) {
        console.error("Collector run log could not be started", error);
      }

      const results = await Promise.allSettled(
        categoryIds.map((categoryId) => collectScope(env, categoryId)),
      );
      let scopesSucceeded = 0;
      let videosCollected = 0;
      const errors: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const message = result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
          errors.push(`${categoryIds[index] ?? "all"}: ${message}`);
          console.error(
            `Scheduled YouTube collection failed for ${categoryIds[index] ?? "all"}`,
            result.reason,
          );
        } else if (result.value.stored) {
          scopesSucceeded += 1;
          videosCollected += result.value.videos.length;
        } else {
          errors.push(
            `${categoryIds[index] ?? "all"}: ${result.value.storageError ?? "snapshot not stored"}`,
          );
        }
      });

      const status = scopesSucceeded === categoryIds.length
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
            quotaUnits: categoryIds.length,
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
