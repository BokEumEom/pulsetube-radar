/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

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

function buildTrendingVideo(item: YouTubeVideoItem, index: number) {
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
    category,
    views,
    likes: asCount(item.statistics?.likeCount),
    velocity: Math.round(views / ageInHours),
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

async function handleYouTubeTrending(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!env.YT_API_KEY) {
    return jsonResponse(
      {
        error: "YT_API_KEY가 Cloudflare Worker Runtime Secret에 설정되지 않았습니다.",
        code: "missing_api_key",
      },
      503,
      { "Cache-Control": "no-store" },
    );
  }

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

  const upstream = await fetch(apiUrl, {
    headers: { Accept: "application/json" },
  });

  if (!upstream.ok) {
    console.error("YouTube Data API request failed", upstream.status);
    const code = upstream.status === 403 ? "youtube_api_denied" : "youtube_api_error";
    return jsonResponse(
      {
        error:
          upstream.status === 403
            ? "YouTube API 요청이 거부되었습니다. API 활성화, 키 제한, 할당량을 확인해 주세요."
            : "YouTube 인기 영상을 불러오지 못했습니다.",
        code,
      },
      upstream.status === 429 ? 429 : 502,
      { "Cache-Control": "no-store" },
    );
  }

  const data = (await upstream.json()) as YouTubeVideosResponse;
  const videos = (data.items ?? [])
    .map(buildTrendingVideo)
    .filter((video): video is NonNullable<typeof video> => Boolean(video));

  if (!videos.length) {
    return jsonResponse(
      { error: "YouTube API returned no videos.", code: "empty_result" },
      502,
      { "Cache-Control": "no-store" },
    );
  }

  const response = jsonResponse(
    {
      source: "youtube",
      region: "KR",
      category: categoryId
        ? {
            id: categoryId,
            label: CATEGORY_NAMES[categoryId] ?? "기타",
          }
        : null,
      capturedAt: new Date().toISOString(),
      videos,
    },
    200,
    {
      "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
    },
  );

  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
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
};

export default worker;
