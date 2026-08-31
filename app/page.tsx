"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowLeft, BarChart3, Check, ChevronLeft, ChevronRight,
  Clock3, Database, Flame, Palette, Play, Radio, RefreshCw, Search,
  TrendingUp, Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  buildCategoryRow,
  buildLiveRows,
  themes,
  YOUTUBE_CATEGORIES,
  type TrendRow,
  type TrendVideo,
} from "./trend-data";

type TrendRegion = "KR" | "JP" | "US";

const TREND_REGIONS: ReadonlyArray<{ code: TrendRegion; label: string }> = [
  { code: "KR", label: "대한민국" },
  { code: "JP", label: "일본" },
  { code: "US", label: "미국" },
];

type TrendingApiResponse = {
  source: "youtube";
  region: TrendRegion;
  capturedAt: string;
  historyEnabled?: boolean;
  category: { id: string; label: string } | null;
  videos: TrendVideo[];
};

type HistoryPoint = {
  capturedAt?: string;
  time: string;
  rank: number;
  views: number;
  likes?: number;
  velocity?: number;
};

type CategoryTrendPoint = {
  capturedAt: string;
  time: string;
  music: number;
  entertainment: number;
  game: number;
  tech: number;
  other: number;
  sampleSize: number;
};

type ChurnPoint = {
  capturedAt: string;
  time: string;
  entered: number;
  exited: number;
};

type StorageStatus = {
  enabled: boolean;
  snapshotCount: number;
  firstCapturedAt: string | null;
  latestCapturedAt: string | null;
};

type CollectorStatus = {
  enabled: boolean;
  latestRun: {
    id: string;
    trigger: string;
    status: "running" | "success" | "partial" | "failed";
    startedAt: string;
    completedAt: string | null;
    scopesTotal: number;
    scopesSucceeded: number;
    videosCollected: number;
    quotaUnits: number;
    errorSummary: string | null;
  } | null;
  lastSuccessAt: string | null;
};

const formatCapturedAt = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));

const formatRelativeTime = (value: string | null) => {
  if (!value) return "성공 기록 없음";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}시간 전` : `${Math.floor(hours / 24)}일 전`;
};

async function requestTrendingVideos(
  region: TrendRegion,
  categoryId?: string,
  signal?: AbortSignal,
): Promise<TrendingApiResponse> {
  const params = new URLSearchParams({ region });
  if (categoryId) params.set("category", categoryId);
  const search = `?${params}`;
  const response = await fetch(`/api/youtube/trending${search}`, { signal, cache: "no-store" });
  let body: TrendingApiResponse & { error?: string; code?: string };
  try {
    body = (await response.json()) as TrendingApiResponse & { error?: string; code?: string };
  } catch {
    throw new Error(`실시간 API 응답을 읽지 못했습니다. HTTP ${response.status}`);
  }
  if (!response.ok) {
    const detail = body.code ? ` [${body.code}]` : "";
    throw new Error(`${body.error ?? "실시간 인기 영상을 불러오지 못했습니다."}${detail}`);
  }
  if (!Array.isArray(body.videos) || body.videos.length === 0) {
    throw new Error("실시간 인기 영상 응답이 비어 있습니다.");
  }
  return body;
}

async function requestAnalytics<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, cache: "no-store" });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "수집 히스토리를 불러오지 못했습니다.");
  }
  return body;
}

const fmt = (value: number) => new Intl.NumberFormat("ko-KR", {
  notation: "compact", maximumFractionDigits: 1,
}).format(value);

const velocityText = (video: TrendVideo, long = false) => {
  if (video.source !== "youtube") return `+${fmt(video.velocity)}/시`;
  if (video.velocityKind === "snapshot") {
    return `${long ? "최근 수집 " : "최근 +"}${fmt(video.velocity)}/시`;
  }
  return `${long ? "게시 후 평균 " : "평균 "}${fmt(video.velocity)}/시`;
};

const accelerationText = (video: TrendVideo) => {
  if ((video.sampleCount ?? 1) < 3) return "3회 수집 후 가속도";
  const acceleration = video.acceleration ?? 0;
  return `${acceleration >= 0 ? "+" : "−"}${fmt(Math.abs(acceleration))}/시²`;
};

const durationText = (seconds = 0) => {
  if (!seconds) return "길이 확인 중";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
};

function FormatBadge({ video, compact = false }: { video: TrendVideo; compact?: boolean }) {
  if (!video.videoFormat) return null;
  return <span className={`video-format-badge ${video.videoFormat === "SHORTS" ? "shorts" : "long"}`}>
    {video.videoFormat === "SHORTS" ? "SHORTS 후보" : "LONG"}{!compact && ` · ${durationText(video.durationSeconds)}`}
  </span>;
}

function BreakoutBadge({ video }: { video: TrendVideo }) {
  if (video.breakoutStatus === "EARLY") return <span className="breakout-badge early">EARLY</span>;
  if (video.breakoutStatus === "BREAKOUT") return <span className="breakout-badge">급상승</span>;
  return null;
}

function Delta({ video }: { video: TrendVideo }) {
  if (video.isNew) return <span className="delta new">NEW</span>;
  if (video.delta === null || video.delta === 0) return <span className="delta steady">–</span>;
  return <span className={video.delta > 0 ? "delta up" : "delta down"}>
    {video.delta > 0 ? "▲" : "▼"}{Math.abs(video.delta)}
  </span>;
}

function VideoTile({ video, index, topStyle, onSelect }: {
  video: TrendVideo; index: number; topStyle?: boolean; onSelect: (video: TrendVideo) => void;
}) {
  return <button className={topStyle ? "video-tile top-style" : "video-tile"} onClick={() => onSelect(video)}>
    {topStyle && <span className="big-rank" aria-hidden="true">{index + 1}</span>}
    <span className="video-visual">
      <img src={video.thumbnail} alt="" loading="lazy" />
      {!topStyle && <span className="rank-chip">{video.rank}</span>}
      <Delta video={video} />
      <BreakoutBadge video={video} />
      <span className="play-dot"><Play fill="currentColor" /></span>
    </span>
    <span className="video-copy">
      <strong>{video.title}</strong><span>{video.channel}</span>
      <span>조회 {fmt(video.views)} <em>{velocityText(video)}</em></span>
      {(video.sampleCount ?? 1) >= 3 && <span className="acceleration-copy">가속 {accelerationText(video)} · 신호 {video.momentumScore ?? 0}</span>}
    </span>
    <span className="hover-preview" aria-hidden="true">
      <b>{video.title}</b><small>{video.category} · {video.tags.join(" · ")}</small>
      <p><span>SIGNAL</span>{video.aiNote}</p>
    </span>
  </button>;
}

function TrendStrip({ row, videos, onSelect }: { row: TrendRow; videos: TrendVideo[]; onSelect: (video: TrendVideo) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = row.videoIds.map((id) => videos.find((video) => video.id === id)).filter(Boolean) as TrendVideo[];
  const move = (direction: number) => ref.current?.scrollBy({ left: direction * ref.current.clientWidth * .82, behavior: "smooth" });
  return <section className="trend-row">
    <div className="row-title"><h2>{row.title}</h2>{row.hint && <span>{row.hint}</span>}</div>
    <div className="strip-shell">
      <button className="strip-arrow left" onClick={() => move(-1)} aria-label="이전 영상"><ChevronLeft /></button>
      <div className={row.topStyle ? "video-strip top-strip" : "video-strip"} ref={ref}>
        {items.map((video, index) => <VideoTile key={video.id} video={video} index={index} topStyle={row.topStyle} onSelect={onSelect} />)}
      </div>
      <button className="strip-arrow right" onClick={() => move(1)} aria-label="다음 영상"><ChevronRight /></button>
    </div>
  </section>;
}

function ChannelStrip({ videos, onSelect }: {
  videos: TrendVideo[];
  onSelect: (video: TrendVideo) => void;
}) {
  const channels = useMemo(() => {
    const grouped = new Map<string, { channel: string; velocity: number; count: number; peakScore: number; signals: number; video: TrendVideo }>();
    videos.forEach((video) => {
      const current = grouped.get(video.channel);
      if (current) {
        current.velocity += video.velocity;
        current.count += 1;
        current.peakScore = Math.max(current.peakScore, video.momentumScore ?? 0);
        current.signals += video.breakoutStatus && video.breakoutStatus !== "NONE" ? 1 : 0;
        if ((video.momentumScore ?? 0) > (current.video.momentumScore ?? 0)) current.video = video;
      } else {
        grouped.set(video.channel, {
          channel: video.channel,
          velocity: video.velocity,
          count: 1,
          peakScore: video.momentumScore ?? 0,
          signals: video.breakoutStatus && video.breakoutStatus !== "NONE" ? 1 : 0,
          video,
        });
      }
    });
    return [...grouped.values()]
      .sort((a, b) => b.signals - a.signals || b.peakScore - a.peakScore || b.velocity - a.velocity)
      .slice(0, 8);
  }, [videos]);

  return <section className="channel-row" aria-label="지금 뜨는 채널">
    <div className="row-title"><Users/><h2>지금 뜨는 채널</h2><span>인기 목록 내 조회 속도 · 신호 기준</span></div>
    <div className="channel-strip">
      {channels.map((item, index) => <button className="channel-card" key={item.channel} onClick={() => onSelect(item.video)}>
        <span className="channel-cover"><img src={item.video.thumbnail} alt="" loading="lazy"/><i>#{index + 1}</i></span>
        <span className="channel-copy"><b>{item.channel}</b><small>{item.count}개 인기 영상 · 합산 +{fmt(item.velocity)}/시</small>
          <span><em>최고 신호 {item.peakScore}</em>{item.signals > 0 && <strong>{item.signals} SIGNAL</strong>}</span>
        </span>
      </button>)}
    </div>
  </section>;
}

function CategorySnapshot({ category, videos, regionLabel }: {
  category: { id: string; label: string };
  videos: TrendVideo[];
  regionLabel: string;
}) {
  const shorts = videos.filter((video) => video.videoFormat === "SHORTS").length;
  const signals = videos.filter((video) => video.breakoutStatus && video.breakoutStatus !== "NONE").length;
  const fastest = [...videos].sort((a, b) => b.velocity - a.velocity)[0];
  return <section className="category-snapshot">
    <div><span>CATEGORY {category.id}</span><h2>{regionLabel} {category.label}는 지금</h2><p>전체 인기 목록의 단순 필터가 아니라 YouTube 카테고리 전용 인기 데이터를 보여줍니다.</p></div>
    <dl><div><dt>인기 영상</dt><dd>{videos.length}</dd></div><div><dt>Shorts 후보</dt><dd>{shorts}</dd></div><div><dt>급상승 신호</dt><dd>{signals}</dd></div><div><dt>최고 조회 속도</dt><dd>{fastest ? `${fmt(fastest.velocity)}/시` : "—"}</dd></div></dl>
  </section>;
}

function EarlySignalsView({ videos, regionLabel, onSelect }: {
  videos: TrendVideo[];
  regionLabel: string;
  onSelect: (video: TrendVideo) => void;
}) {
  const [format, setFormat] = useState<"ALL" | "SHORTS" | "LONG_FORM">("ALL");
  const measured = videos.filter((video) => video.videoFormat);
  const candidates = [...measured]
    .filter((video) => format === "ALL" || video.videoFormat === format)
    .sort((a, b) => {
      const signalWeight = (value?: TrendVideo["breakoutStatus"]) => value === "EARLY" ? 2 : value === "BREAKOUT" ? 1 : 0;
      return signalWeight(b.breakoutStatus) - signalWeight(a.breakoutStatus)
        || (b.momentumScore ?? 0) - (a.momentumScore ?? 0)
        || (b.accelerationPercentile ?? 0) - (a.accelerationPercentile ?? 0);
    });
  const confirmed = candidates.filter((video) => video.breakoutStatus && video.breakoutStatus !== "NONE").length;
  const observed = candidates.filter((video) => (video.sampleCount ?? 1) >= 3).length;
  const shorts = measured.filter((video) => video.videoFormat === "SHORTS").length;

  return <main className="subpage early-signals-view">
    <div className="early-heading"><div><span>FORMAT-AWARE DETECTION</span><h1>Early Signals</h1><p>{regionLabel}에서 이미 뜬 영상보다 지금 가속하기 시작한 영상을 포맷별로 비교합니다.</p></div>
      <div className="early-summary"><b>{confirmed}</b><span>활성 신호</span><small>{observed}개가 3회 이상 관측됨</small></div>
    </div>
    <section className="early-method"><div><strong>영상 길이 수집</strong><span>contentDetails.duration</span></div><i>→</i><div><strong>Shorts 분류</strong><span>180초 이하 후보</span></div><i>→</i><div><strong>포맷별 백분위</strong><span>Shorts와 롱폼 분리</span></div><i>→</i><div><strong>Early 판정</strong><span>속도·가속 동시 상위</span></div></section>
    <div className="early-toolbar"><div className="format-filters" aria-label="영상 포맷 필터">
      {([['ALL', `전체 ${measured.length}`], ['SHORTS', `Shorts 후보 ${shorts}`], ['LONG_FORM', `롱폼 ${measured.length - shorts}`]] as const).map(([value, label]) => <button key={value} className={format === value ? "active" : ""} onClick={() => setFormat(value)}>{label}</button>)}
    </div><span>Early는 같은 포맷 표본 8개 이상 · 3회 수집 · 공개 18시간 이내에서 판정</span></div>
    {!measured.length ? <div className="analytics-empty"><Clock3/><strong>영상 길이 수집을 기다리고 있습니다</strong><p>새 배포 이후 수집된 스냅샷부터 포맷과 백분위가 표시됩니다.</p></div> : <section className="early-grid">
      {candidates.map((video, index) => <button key={video.id} className="early-card" onClick={() => onSelect(video)}>
        <span className="early-visual"><img src={video.thumbnail} alt="" loading="lazy"/><i>{String(index + 1).padStart(2, "0")}</i><BreakoutBadge video={video}/></span>
        <span className="early-copy"><span><FormatBadge video={video}/><em>{video.category}</em></span><b>{video.title}</b><small>{video.channel}</small>
          <span className="early-metrics"><span><small>Momentum</small><strong>{video.momentumScore ?? 0}</strong></span><span><small>속도 백분위</small><strong>{video.velocityPercentile ?? 0}%</strong></span><span><small>가속 백분위</small><strong>{video.accelerationPercentile ?? 0}%</strong></span></span>
          <span className="early-foot">{velocityText(video)} · 포맷 표본 {video.formatPopulationSize ?? 0}개</span>
        </span>
      </button>)}
    </section>}
  </main>;
}

function Hero({ video, isSelection, onClear, scopeLabel, regionLabel }: {
  video: TrendVideo;
  isSelection: boolean;
  onClear: () => void;
  scopeLabel?: string;
  regionLabel: string;
}) {
  return <section className="hero">
    <img className="hero-image" src={`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`} alt="" />
    <div className="hero-wash" />
    <div className="hero-copy">
      <div className="eyebrow"><span>{isSelection ? `현재 ${video.rank}위` : scopeLabel ? `${scopeLabel} 1위` : `지금 ${regionLabel} 1위`}</span>
        <span className="category-chip">{video.category}</span>{video.isNew && <span className="new-chip">오늘 첫 진입</span>}<BreakoutBadge video={video}/>
      </div>
      <h1>{video.title}</h1><p>{video.description}</p>
      <div className="ai-line"><span>SIGNAL</span>{video.aiNote}</div>
      <div className="hero-meta">{video.channel} · 조회 {fmt(video.views)} · 좋아요 {fmt(video.likes)} · <b>{velocityText(video, true)}</b>{(video.sampleCount ?? 1) >= 3 && <> · 가속 {accelerationText(video)} · 신호 {video.momentumScore ?? 0}</>}</div>
      <div className="hero-actions">
        <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="primary-action"><Play fill="currentColor" /> 보러가기</a>
        {isSelection && <button className="secondary-action" onClick={onClear}><ArrowLeft /> 목록으로</button>}
      </div>
    </div>
    <div className="live-pill"><span /> YOUTUBE LIVE</div>
  </section>;
}

function DataUnavailableHero({ loading, error, refreshing, onRetry, regionLabel }: {
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRetry: () => void;
  regionLabel: string;
}) {
  return <section className="hero empty-hero">
    <div className="empty-hero-copy">
      <span className="empty-icon">{loading ? <RefreshCw className="spin"/> : <AlertTriangle/>}</span>
      <div><span className="dialog-kicker">YOUTUBE LIVE DATA</span>
        <h1>{loading ? "실시간 인기 영상을 연결하는 중" : "실데이터를 불러오지 못했습니다"}</h1>
        <p>{loading ? `${regionLabel} 인기 영상과 수집 상태를 확인하고 있습니다.` : error ?? "YouTube API와 Cloudflare 런타임 설정을 확인해 주세요."}</p>
        {!loading && <button className="primary-action" onClick={onRetry} disabled={refreshing}><RefreshCw className={refreshing ? "spin" : ""}/>{refreshing ? "다시 확인 중" : "다시 확인"}</button>}
      </div>
    </div>
  </section>;
}

function EmptyAnalyticsView({ title, description }: { title: string; description: string }) {
  return <main className="subpage"><div className="page-heading"><div><span>LIVE DATA REQUIRED</span><h1>{title}</h1><p>{description}</p></div><Database/></div>
    <div className="analytics-empty"><Activity/><strong>샘플 데이터는 표시하지 않습니다</strong><p>홈에서 YouTube 실데이터 연결 상태를 확인한 뒤 다시 열어 주세요.</p></div>
  </main>;
}

function CollectorStatusCard({ status, state }: {
  status: CollectorStatus | null;
  state: "loading" | "ready" | "unavailable";
}) {
  const run = status?.latestRun;
  const tone = run?.status ?? state;
  const label = state === "loading" ? "확인 중" : state === "unavailable" ? "D1 미연결" : !run ? "수집 대기" : run.status === "success" ? "정상" : run.status === "partial" ? "부분 성공" : run.status === "running" ? "수집 중" : "실패";
  return <div className={`collector-card ${tone}`}><div><span>COLLECTOR</span><b><i/>{label}</b></div>
    {run ? <><p>범위 {run.scopesSucceeded}/{run.scopesTotal} · 영상 {run.videosCollected}개</p><small>마지막 성공 {formatRelativeTime(status?.lastSuccessAt ?? null)} · API 단위 {run.quotaUnits}</small></> : <p>{state === "unavailable" ? "D1 바인딩과 최신 마이그레이션이 필요합니다." : "첫 예약 수집을 기다리고 있습니다."}</p>}
  </div>;
}

function HistoryPanel({ video, region, hours = 168, periodLabel = "7일" }: {
  video: TrendVideo;
  region: TrendRegion;
  hours?: number;
  periodLabel?: string;
}) {
  type HistoryState = "loading" | "ready" | "collecting" | "unavailable";
  const [historyResult, setHistoryResult] = useState<{
    region: TrendRegion;
    videoId: string;
    hours: number;
    points: HistoryPoint[];
    state: HistoryState;
  } | null>(null);

  useEffect(() => {
    if (video.source !== "youtube") return;

    const controller = new AbortController();
    void requestAnalytics<{ points: HistoryPoint[] }>(
      `/api/youtube/history?${new URLSearchParams({ region, videoId: video.id, hours: String(hours) })}`,
      controller.signal,
    ).then((body) => {
      setHistoryResult({
        region,
        videoId: video.id,
        hours,
        points: body.points,
        state: body.points.length > 1 ? "ready" : "collecting",
      });
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setHistoryResult({ region, videoId: video.id, hours, points: [], state: "unavailable" });
    });

    return () => controller.abort();
  }, [hours, region, video.id, video.source]);

  const currentResult = historyResult?.region === region
    && historyResult.videoId === video.id
    && historyResult.hours === hours
    ? historyResult
    : null;
  const historyState: HistoryState = video.source !== "youtube"
    ? "unavailable"
    : currentResult?.state ?? "loading";
  const series = currentResult?.points.length ? currentResult.points : video.history;
  const hasHistory = series.length > 1;
  const rankChange = hasHistory ? series[0].rank - series[series.length - 1].rank : 0;
  const changeText = rankChange > 0
    ? `▲ ${rankChange}`
    : rankChange < 0
      ? `▼ ${Math.abs(rankChange)}`
      : "–";
  const stateText = historyState === "loading"
    ? "D1 수집 이력을 확인하는 중입니다."
    : historyState === "ready"
      ? `실제 ${periodLabel} 수집 스냅샷 ${series.length}개를 표시합니다.`
      : historyState === "collecting"
        ? "첫 스냅샷이 저장되었습니다. 다음 수집부터 변화량이 표시됩니다."
        : historyState === "unavailable"
          ? "D1이 아직 연결되지 않아 현재 스냅샷만 표시합니다."
          : "현재 스냅샷만 표시합니다.";

  return <section className="selected-panel">
    <div className="section-head"><div><span>SELECTED SIGNAL</span><h2>선택한 콘텐츠 추이</h2></div>
      <div className="metric"><small>{hasHistory ? `${periodLabel} 순위 변화` : "현재 순위"}</small><strong>{hasHistory ? changeText : `#${video.rank}`}</strong></div>
    </div>
    <div className={`history-status ${historyState}`}><Database/>{stateText}</div>
    <div className="chart-grid">
      <div className="chart-box"><h3>급상승 순위 <span>{hasHistory ? "낮을수록 높음" : "스냅샷 축적 전"}</span></h3>
        <ResponsiveContainer width="100%" height={220}><LineChart data={series} margin={{ top:16,right:12,left:-22,bottom:0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="time" stroke="var(--muted-fg)" tickLine={false} axisLine={false} fontSize={11}/>
          <YAxis reversed domain={[1,30]} stroke="var(--muted-fg)" tickLine={false} axisLine={false} fontSize={11}/>
          <Tooltip contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/>
          <Line type="monotone" dataKey="rank" stroke="var(--accent)" strokeWidth={3} dot={{ fill:"var(--accent)",r:3 }}/>
        </LineChart></ResponsiveContainer>
      </div>
      <div className="chart-box"><h3>누적 조회수 <span>{hasHistory ? `최근 ${periodLabel}` : "현재 값"}</span></h3>
        <ResponsiveContainer width="100%" height={220}><AreaChart data={series} margin={{ top:16,right:12,left:-6,bottom:0 }}>
          <defs><linearGradient id="viewFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent2)" stopOpacity={.55}/><stop offset="1" stopColor="var(--accent2)" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="time" stroke="var(--muted-fg)" tickLine={false} axisLine={false} fontSize={11}/>
          <YAxis tickFormatter={fmt} stroke="var(--muted-fg)" tickLine={false} axisLine={false} fontSize={11} width={52}/>
          <Tooltip formatter={(value) => fmt(Number(value))} contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/>
          <Area type="monotone" dataKey="views" stroke="var(--accent2)" fill="url(#viewFill)" strokeWidth={3}/>
        </AreaChart></ResponsiveContainer>
      </div>
    </div>
  </section>;
}

function SeriesView({ videos, region }: { videos: TrendVideo[]; region: TrendRegion }) {
  const [videoId, setVideoId] = useState(videos[0]?.id ?? "");
  const [period, setPeriod] = useState("7일");
  const video = videos.find((item) => item.id === videoId) ?? videos[0];
  const periodHours: Record<string, number> = { "24시간": 24, "7일": 168, "30일": 720 };
  if (!video) {
    return <EmptyAnalyticsView title="영상 시계열 추이" description="실시간 인기 영상이 연결되면 순위·조회 속도·가속도 추이를 표시합니다."/>;
  }
  return <main className="subpage">
    <div className="page-heading"><div><span>TIME SERIES</span><h1>영상 시계열 추이</h1><p>순위와 조회수의 변화 속도를 함께 비교합니다.</p></div><Clock3 /></div>
    <section className="control-card">
      <label><span><Search /> 분석할 영상</span><select value={videoId} onChange={(event) => setVideoId(event.target.value)}>
        {videos.map((item) => <option key={item.id} value={item.id}>{item.rank}위 · {item.title}</option>)}
      </select></label>
      <div className="periods">{["24시간","7일","30일"].map((item) => <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div>
    </section>
    <HistoryPanel video={video} region={region} hours={periodHours[period]} periodLabel={period}/>
    <section className="signal-table"><div className="section-head"><div><span>VELOCITY</span><h2>상승 속도 비교</h2></div></div>
      <div className="table-head"><span>영상</span><span>현재 순위</span><span>시간당 조회</span><span>가속 신호</span></div>
      {videos.slice(0,6).map((item) => <button key={item.id} onClick={() => setVideoId(item.id)}>
        <span><img src={item.thumbnail} alt=""/><b>{item.title}</b></span><strong>#{item.rank}</strong><em>{velocityText(item)}</em><span className="table-signal">{(item.sampleCount ?? 1) >= 3 ? accelerationText(item) : "준비 중"}</span>
      </button>)}
    </section>
  </main>;
}

function ShareView({ videos, isLive, region, regionLabel }: {
  videos: TrendVideo[];
  isLive: boolean;
  region: TrendRegion;
  regionLabel: string;
}) {
  const [briefType, setBriefType] = useState("today");
  const [categoryHistory, setCategoryHistory] = useState<CategoryTrendPoint[]>([]);
  const [churnHistory, setChurnHistory] = useState<ChurnPoint[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [analyticsState, setAnalyticsState] = useState<"idle" | "loading" | "ready" | "collecting" | "unavailable">(
    isLive ? "loading" : "idle",
  );

  useEffect(() => {
    if (!isLive) return;
    const controller = new AbortController();
    const hours = 168;
    const params = new URLSearchParams({ region, hours: String(hours) });
    void Promise.all([
      requestAnalytics<{ points: CategoryTrendPoint[] }>(`/api/youtube/category-trends?${params}`, controller.signal),
      requestAnalytics<{ points: ChurnPoint[] }>(`/api/youtube/churn?${params}`, controller.signal),
      requestAnalytics<StorageStatus>(`/api/youtube/storage-status?${new URLSearchParams({ region })}`, controller.signal),
    ]).then(([categoryBody, churnBody, status]) => {
      setCategoryHistory(categoryBody.points);
      setChurnHistory(churnBody.points);
      setStorageStatus(status);
      setAnalyticsState(categoryBody.points.length > 1 ? "ready" : "collecting");
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAnalyticsState("unavailable");
    });
    return () => controller.abort();
  }, [isLive, region]);

  if (!videos.length) {
    return <EmptyAnalyticsView title="점유율 · 리포트" description="실시간 인기 영상이 연결되면 카테고리 점유율과 진입·이탈을 표시합니다."/>;
  }

  const categoryShare = [
    { category:"음악", value:videos.filter((video)=>video.category==="음악").length },
    { category:"엔터", value:videos.filter((video)=>["엔터테인먼트","코미디","영화·애니메이션"].includes(video.category)).length },
    { category:"게임", value:videos.filter((video)=>video.category==="게임").length },
    { category:"기술·교육", value:videos.filter((video)=>["과학기술","교육"].includes(video.category)).length },
    { category:"기타", value:videos.filter((video)=>!["음악","엔터테인먼트","코미디","영화·애니메이션","게임","과학기술","교육"].includes(video.category)).length },
  ].map((item)=>({...item,share:Math.round((item.value/Math.max(1,videos.length))*100)}));
  const topCategory = [...categoryShare].sort((a,b)=>b.value-a.value)[0];
  type CategoryMetricKey = "music" | "entertainment" | "game" | "tech" | "other";
  const categoryMetricKey: Record<string, CategoryMetricKey> = {
    "음악": "music",
    "엔터": "entertainment",
    "게임": "game",
    "기술·교육": "tech",
    "기타": "other",
  };
  const firstCategoryPoint = categoryHistory[0];
  const latestCategoryPoint = categoryHistory[categoryHistory.length - 1];
  const topMetricKey = categoryMetricKey[topCategory.category] ?? "other";
  const categoryDelta = firstCategoryPoint && latestCategoryPoint
    ? latestCategoryPoint[topMetricKey] - firstCategoryPoint[topMetricKey]
    : null;
  const enteredTotal = churnHistory.reduce((sum, point) => sum + point.entered, 0);
  const exitedTotal = churnHistory.reduce((sum, point) => sum + point.exited, 0);
  const briefs: Record<string,string> = {
    today:`현재 ${regionLabel} 인기 영상 ${videos.length}개 중 ${topCategory.category} 분야가 ${topCategory.share}%로 가장 큰 비중을 차지합니다. 이 수치는 YouTube Data API의 현재 스냅샷을 기준으로 합니다.`,
    compare:categoryDelta === null
      ? "비교 가능한 이전 스냅샷이 아직 없습니다. D1 연결 후 두 번째 수집부터 카테고리 변화량이 계산됩니다."
      : `${topCategory.category} 비중은 수집 구간 시작보다 ${Math.abs(categoryDelta)}%p ${categoryDelta > 0 ? "늘었고" : categoryDelta < 0 ? "줄었고" : "변화가 없고"}, 같은 기간 신규 진입 ${enteredTotal}건·이탈 ${exitedTotal}건이 감지됐습니다.`,
    report:categoryHistory.length > 1
      ? `최근 7일 범위에서 ${categoryHistory.length}개 시간 구간을 비교했습니다. 현재 가장 큰 분야는 ${topCategory.category}이며, 총 ${storageStatus?.snapshotCount ?? categoryHistory.length}개 D1 스냅샷을 근거로 한 규칙 기반 리포트입니다.`
      : "D1에 스냅샷이 축적되면 7일 카테고리 점유율과 진입·이탈 리포트가 자동으로 활성화됩니다.",
  };
  return <main className="subpage">
    <div className="page-heading"><div><span>CATEGORY PULSE</span><h1>점유율 · 리포트</h1><p>현재 인기 영상의 분야 구성을 읽습니다.</p></div><BarChart3 /></div>
    <div className="share-grid">
      <section className="chart-box large"><div className="section-head compact"><div><span>SHARE</span><h2>카테고리 점유율</h2></div>
        <div className="legend"><i className="music"/>음악 <i className="ent"/>엔터 <i className="game"/>게임 <i className="tech"/>기술</div></div>
        {categoryHistory.length>1?<ResponsiveContainer width="100%" height={330}><AreaChart data={categoryHistory} margin={{ top:20,right:12,left:-18,bottom:0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="time" tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/><YAxis domain={[0,100]} tickFormatter={(v)=>`${v}%`} tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/>
          <Tooltip formatter={(value)=>`${value}%`} contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/>
          <Area type="monotone" stackId="1" dataKey="music" name="음악" stroke="#baff46" fill="#baff46" fillOpacity={.72}/><Area type="monotone" stackId="1" dataKey="entertainment" name="엔터" stroke="#7259ff" fill="#7259ff" fillOpacity={.76}/><Area type="monotone" stackId="1" dataKey="game" name="게임" stroke="#ff5c8a" fill="#ff5c8a" fillOpacity={.72}/><Area type="monotone" stackId="1" dataKey="tech" name="기술" stroke="#43d9ca" fill="#43d9ca" fillOpacity={.68}/><Area type="monotone" stackId="1" dataKey="other" name="기타" stroke="#7f8795" fill="#7f8795" fillOpacity={.55}/>
        </AreaChart></ResponsiveContainer>:<ResponsiveContainer width="100%" height={330}><BarChart data={categoryShare} layout="vertical" margin={{ top:20,right:24,left:8,bottom:0 }}>
          <CartesianGrid stroke="var(--grid)" horizontal={false}/><XAxis type="number" domain={[0,100]} tickFormatter={(v)=>`${v}%`} tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/><YAxis type="category" dataKey="category" tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11} width={72}/><Tooltip formatter={(value)=>`${value}%`} contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/><Bar dataKey="share" fill="var(--accent)" radius={[0,6,6,0]}/>
        </BarChart></ResponsiveContainer>}
      </section>
      <section className="chart-box large"><div className="section-head compact"><div><span>CHURN</span><h2>진입 · 이탈</h2></div></div>
        {churnHistory.length?<ResponsiveContainer width="100%" height={330}><BarChart data={churnHistory} margin={{ top:20,right:12,left:-24,bottom:0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="time" tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/><YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/><Tooltip contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/><Bar dataKey="entered" name="진입" fill="var(--accent)" radius={[5,5,0,0]}/><Bar dataKey="exited" name="이탈" fill="var(--danger)" radius={[5,5,0,0]}/>
        </BarChart></ResponsiveContainer>:<div className="snapshot-note"><Database/><strong>{analyticsState==="unavailable"?"D1 연결 필요":"비교 스냅샷 준비 중"}</strong><p>{analyticsState==="unavailable"?"D1 바인딩과 마이그레이션을 적용하면 15분 예약 수집이 시작됩니다.":"두 번째 시간 구간부터 인기 목록의 진입·이탈을 자동 계산합니다."}</p></div>}
      </section>
    </div>
    <section className="brief-panel"><div className="brief-mark"><Radio /></div><div className="brief-main">
      <div className="section-head compact"><div><span>SNAPSHOT BRIEF</span><h2>트렌드 한 줄보다 깊게</h2></div><span className="model-chip">{analyticsState==="ready"?"D1 HISTORY":"LIVE DATA"}</span></div>
      <div className="brief-tabs">{[["today","오늘의 브리핑"],["compare","어제와 비교"],["report","7일 리포트"]].map(([id,label]) => <button key={id} className={briefType === id ? "active" : ""} onClick={() => setBriefType(id)}>{label}</button>)}</div>
      <p>{briefs[briefType]}</p><div className="brief-foot"><span><Check/> 규칙 기반 스냅샷 분석</span><small>{analyticsState==="ready"?`D1 ${storageStatus?.snapshotCount ?? 0}개 스냅샷`:"YouTube Data API 현재 데이터 기준"}</small></div>
    </div></section>
  </main>;
}

function ThemeDialog({ open, onOpenChange, theme, onTheme }: { open:boolean; onOpenChange:(open:boolean)=>void; theme:string; onTheme:(theme:string)=>void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="trend-dialog"><DialogHeader><span className="dialog-kicker">COLOR SIGNAL</span><DialogTitle>화면 테마 선택</DialogTitle><DialogDescription>선택은 이 브라우저에 저장됩니다.</DialogDescription></DialogHeader>
    <div className="theme-grid">{themes.map((item) => <button key={item.id} className={theme === item.id ? "theme-card active" : "theme-card"} onClick={() => onTheme(item.id)}><span className="swatches">{item.colors.map((color) => <i key={color} style={{ background:color }}/>)}</span><b>{item.name}</b>{theme === item.id && <Check/>}</button>)}</div>
  </DialogContent></Dialog>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("home");
  const [selected, setSelected] = useState<TrendVideo | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setTheme] = useState("neon");
  const [updatedAt, setUpdatedAt] = useState("--:--");
  const [refreshing, setRefreshing] = useState(false);
  const [liveVideos, setLiveVideos] = useState<TrendVideo[] | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [region, setRegion] = useState<TrendRegion>("KR");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [categoryCache, setCategoryCache] = useState<Record<string, TrendVideo[]>>({});
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [collectorStatus, setCollectorStatus] = useState<CollectorStatus | null>(null);
  const [collectorState, setCollectorState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("yt-trend-theme");
    if (storedTheme && themes.some((item) => item.id === storedTheme)) {
      window.setTimeout(() => setTheme(storedTheme), 0);
    }
    const storedRegion = window.localStorage.getItem("yt-trend-region");
    if (storedRegion && TREND_REGIONS.some((item) => item.code === storedRegion)) {
      window.setTimeout(() => setRegion(storedRegion as TrendRegion), 0);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (silent = false) => {
      try {
        const data = await requestTrendingVideos(region, undefined, controller.signal);
        setLiveVideos(data.videos);
        setUpdatedAt(formatCapturedAt(data.capturedAt));
        setDataError(null);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!silent) {
          setDataError(error instanceof Error ? error.message : "실시간 데이터 연결에 실패했습니다.");
        }
      } finally {
        if (!silent) setDataLoading(false);
      }
    };

    const loadCollector = async () => {
      try {
        const status = await requestAnalytics<CollectorStatus>("/api/youtube/collector-status", controller.signal);
        setCollectorStatus(status);
        setCollectorState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCollectorState("unavailable");
      }
    };

    void Promise.allSettled([load(), loadCollector()]);
    const pollId = window.setInterval(() => {
      void load(true);
      void loadCollector();
    }, 60_000);

    return () => {
      controller.abort();
      window.clearInterval(pollId);
    };
  }, [region]);

  const applyTheme = (next: string) => {
    setTheme(next);
    window.localStorage.setItem("yt-trend-theme", next);
  };

  const selectRegion = (next: TrendRegion) => {
    if (next === region) return;
    window.localStorage.setItem("yt-trend-region", next);
    setSelected(null);
    setFocus(null);
    setActiveCategoryId(null);
    setCategoryCache({});
    setCategoryError(null);
    setLiveVideos(null);
    setDataError(null);
    setDataLoading(true);
    setRegion(next);
  };

  const activeRegion = TREND_REGIONS.find((item) => item.code === region) ?? TREND_REGIONS[0];
  const allVideos = useMemo(() => liveVideos ?? [], [liveVideos]);
  const isLive = allVideos.length > 0;
  const baseRows = useMemo(
    () => buildLiveRows(allVideos, activeRegion.label),
    [activeRegion.label, allVideos],
  );
  const activeCategory = YOUTUBE_CATEGORIES.find((category) => category.id === activeCategoryId) ?? null;
  const categoryVideos = activeCategoryId ? categoryCache[activeCategoryId] : undefined;
  const visibleVideos = activeCategory ? categoryVideos ?? [] : allVideos;
  const categoryRow = activeCategory && categoryVideos
    ? buildCategoryRow(activeCategory, categoryVideos, activeRegion.label)
    : null;
  const shownRows = categoryRow
    ? [categoryRow]
    : activeCategory
      ? []
      : focus
        ? baseRows.filter((row) => row.id === focus)
        : baseRows;
  const groups = ["랭킹", "YouTube Music", "국가"];

  const choose = (video: TrendVideo) => {
    setSelected(video);
    setActiveTab("home");
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  const showHome = () => {
    setActiveTab("home");
    setSelected(null);
    setFocus(null);
    setActiveCategoryId(null);
    setCategoryError(null);
  };

  const selectRow = (rowId: string) => {
    setSelected(null);
    setActiveCategoryId(null);
    setCategoryError(null);
    setFocus(rowId);
  };

  const selectCategory = async (categoryId: string) => {
    setSelected(null);
    setFocus(null);
    setActiveCategoryId(categoryId);
    setCategoryError(null);
    if (categoryCache[categoryId]) return;

    setCategoryLoading(true);
    try {
      const data = await requestTrendingVideos(region, categoryId);
      setCategoryCache((current) => ({ ...current, [categoryId]: data.videos }));
      setUpdatedAt(formatCapturedAt(data.capturedAt));
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "카테고리 데이터를 불러오지 못했습니다.");
    } finally {
      setCategoryLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const data = await requestTrendingVideos(region, activeCategoryId ?? undefined);
      if (activeCategoryId) {
        setCategoryCache((current) => ({ ...current, [activeCategoryId]: data.videos }));
        setCategoryError(null);
      } else {
        setLiveVideos(data.videos);
        setCategoryCache({});
        setDataError(null);
      }
      setSelected(null);
      setUpdatedAt(formatCapturedAt(data.capturedAt));
      try {
        const status = await requestAnalytics<CollectorStatus>("/api/youtube/collector-status");
        setCollectorStatus(status);
        setCollectorState("ready");
      } catch {
        setCollectorState("unavailable");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "실시간 데이터 새로고침에 실패했습니다.";
      if (activeCategoryId) setCategoryError(message);
      else setDataError(message);
    } finally {
      setRefreshing(false);
      setDataLoading(false);
    }
  };

  const metricVideos = visibleVideos.length ? visibleVideos : allVideos;
  const musicShare = Math.round((metricVideos.filter((video) => video.category === "음악").length / Math.max(1, metricVideos.length)) * 100);
  const fastest = [...metricVideos].sort((a, b) => b.velocity - a.velocity)[0] ?? metricVideos[0];
  const fastestAcceleration = [...metricVideos].sort((a, b) => (b.acceleration ?? 0) - (a.acceleration ?? 0))[0];
  const categoryCounts = metricVideos.reduce<Record<string, number>>((counts, video) => {
    counts[video.category] = (counts[video.category] ?? 0) + 1;
    return counts;
  }, {});
  const dominantCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "기타";
  const heroVideo = selected ?? visibleVideos[0] ?? allVideos[0];
  const latestRun = collectorStatus?.latestRun;
  const collectorLabel = collectorState === "loading"
    ? "수집 상태 확인 중"
    : collectorState === "unavailable"
      ? "실시간 API · D1 미연결"
      : !latestRun
        ? "예약 수집 대기"
        : `${latestRun.status === "success" ? "정상 수집" : latestRun.status === "partial" ? "부분 수집" : latestRun.status === "running" ? "수집 중" : "수집 실패"} · ${formatRelativeTime(latestRun.completedAt ?? latestRun.startedAt)}`;

  return <div className="trend-app" data-theme={theme}>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="app-tabs">
      <header className="topbar">
        <button className="brand" onClick={showHome} aria-label="홈으로"><span className="brand-mark"><TrendingUp/></span><span><b>PULSETUBE</b><small>RADAR</small></span></button>
        <TabsList className="top-tabs"><TabsTrigger value="home">홈</TabsTrigger><TabsTrigger value="early">Early Signals</TabsTrigger><TabsTrigger value="series">시계열 추이</TabsTrigger><TabsTrigger value="share">점유율 · 리포트</TabsTrigger></TabsList>
        <div className="region-switch" aria-label="분석 국가 선택">
          {TREND_REGIONS.map((item) => <button key={item.code} className={region === item.code ? "active" : ""} onClick={() => selectRegion(item.code)}>{item.label}</button>)}
        </div>
        <div className={`capture ${latestRun?.status ?? collectorState}`}><span/> {collectorLabel}</div><div className="top-actions"><button onClick={refresh} aria-label="새로고침"><RefreshCw className={refreshing?"spin":""}/><span>새로고침</span></button><button onClick={()=>setThemeOpen(true)} aria-label="테마"><Palette/><span>테마</span></button></div>
      </header>
      <TabsContent value="home" className="tab-content">
        {heroVideo ? <Hero video={heroVideo} isSelection={Boolean(selected)} onClear={()=>setSelected(null)} scopeLabel={categoryVideos ? activeCategory?.label : undefined} regionLabel={activeRegion.label}/> : <DataUnavailableHero loading={dataLoading} error={dataError} refreshing={refreshing} onRetry={()=>void refresh()} regionLabel={activeRegion.label}/>} {selected&&<HistoryPanel video={selected} region={region}/>}
        {metricVideos.length>0&&<section className="insight-band" aria-label="현재 스냅샷"><div><Flame/><span>음악 비중</span><b>{musicShare}%</b><em>현재</em></div><div><TrendingUp/><span>{(fastestAcceleration?.sampleCount ?? 1)>=3?"최대 조회 가속":"조회 속도"}</span><b>{(fastestAcceleration?.sampleCount ?? 1)>=3?accelerationText(fastestAcceleration):`${fmt(fastest.velocity)}/시`}</b></div><div><Radio/><span>가장 많은 분야</span><b>{dominantCategory}</b></div><div><Database/><span>현재 범위</span><b>{metricVideos.length}개 영상</b></div></section>}
        <div className="home-layout"><aside className="sidebar"><button className={focus===null&&!activeCategory?"active":""} onClick={showHome}><span>⌂</span> 홈</button>
          {groups.map((group)=>{const groupRows=baseRows.filter((row)=>row.group===group);if(!groupRows.length)return null;return <Fragment key={group}><h3>{group}</h3>{groupRows.map((row)=><button key={row.id} className={!activeCategory&&focus===row.id?"active":""} onClick={()=>selectRow(row.id)}>{row.label}</button>)}</Fragment>})}
          <h3>분야</h3>
          {YOUTUBE_CATEGORIES.map((category)=><button key={category.id} className={activeCategoryId===category.id?"active":""} onClick={()=>void selectCategory(category.id)}>{category.label}</button>)}
          <div className="source-note"><span>{isLive?"LIVE API":dataLoading?"CONNECTING":"LIVE UNAVAILABLE"}</span><p>{isLive?`${activeRegion.label} · 최근 화면 갱신 ${updatedAt} KST · 60초 자동 확인`:dataLoading?"실시간 인기 영상을 불러오는 중입니다.":dataError??"실데이터 연결을 확인해 주세요."}</p>{dataError&&!isLive&&<AlertTriangle aria-hidden="true"/>}</div>
          <CollectorStatusCard status={collectorStatus} state={collectorState}/></aside>
          <main className="rows-area">{(focus||activeCategory)&&<button className="focus-back" onClick={showHome}><ArrowLeft/> 전체 피드로</button>}
            {categoryLoading&&activeCategory&&<div className="scope-state" role="status"><RefreshCw className="spin"/><strong>{activeCategory.label} 인기 영상을 불러오는 중</strong><span>YouTube Data API 카테고리 조회</span></div>}
            {!categoryLoading&&categoryError&&activeCategory&&<div className="scope-state error" role="alert"><AlertTriangle/><strong>{activeCategory.label} 데이터를 불러오지 못했습니다</strong><span>{categoryError}</span><button onClick={()=>void selectCategory(activeCategory.id)}>다시 시도</button></div>}
            {!categoryLoading&&activeCategory&&activeCategory.id!=="24"&&categoryVideos&&<CategorySnapshot category={activeCategory} videos={categoryVideos} regionLabel={activeRegion.label}/>}
            {!dataLoading&&!activeCategory&&!shownRows.length&&<div className="scope-state" role="status"><Database/><strong>표시할 실시간 영상이 없습니다</strong><span>샘플 데이터 대신 YouTube API 연결 상태를 그대로 표시합니다.</span></div>}
            {!focus&&!activeCategory&&allVideos.length>0&&<ChannelStrip videos={allVideos} onSelect={choose}/>}
            {shownRows.map((row)=><TrendStrip key={row.id} row={row} videos={visibleVideos.length?visibleVideos:allVideos} onSelect={choose}/>)}</main>
        </div>
      </TabsContent>
      <TabsContent value="early" className="tab-content"><EarlySignalsView key={region} videos={allVideos} regionLabel={activeRegion.label} onSelect={choose}/></TabsContent>
      <TabsContent value="series" className="tab-content"><SeriesView key={region} videos={allVideos} region={region}/></TabsContent><TabsContent value="share" className="tab-content"><ShareView key={region} videos={allVideos} isLive={isLive} region={region} regionLabel={activeRegion.label}/></TabsContent>
    </Tabs>
    <ThemeDialog open={themeOpen} onOpenChange={setThemeOpen} theme={theme} onTheme={applyTheme}/>
    <footer><span>PULSETUBE RADAR</span><p>{isLive?`YouTube Data API v3 · ${activeRegion.label} 현재 인기 영상 · D1 15분 스냅샷`:"실데이터 연결 필요 · 샘플 데이터 미표시"}</p></footer>
  </div>;
}
