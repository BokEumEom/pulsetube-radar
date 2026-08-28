"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowLeft, BarChart3, Check, ChevronLeft, ChevronRight,
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
  rows as demoRows,
  shareData,
  themes,
  videos as demoVideos,
  YOUTUBE_CATEGORIES,
  type TrendRow,
  type TrendVideo,
} from "./trend-data";

type TrendingApiResponse = {
  source: "youtube";
  region: "KR";
  capturedAt: string;
  category: { id: string; label: string } | null;
  videos: TrendVideo[];
};

const formatCapturedAt = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));

async function requestTrendingVideos(categoryId?: string, signal?: AbortSignal): Promise<TrendingApiResponse> {
  const search = categoryId ? `?${new URLSearchParams({ category: categoryId })}` : "";
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

const fmt = (value: number) => new Intl.NumberFormat("ko-KR", {
  notation: "compact", maximumFractionDigits: 1,
}).format(value);

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
      <span className="play-dot"><Play fill="currentColor" /></span>
    </span>
    <span className="video-copy">
      <strong>{video.title}</strong><span>{video.channel}</span>
      <span>조회 {fmt(video.views)} <em>{video.source === "youtube" ? "평균 " : "+"}{fmt(video.velocity)}/시</em></span>
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
    const grouped = new Map<string, { channel: string; views: number; count: number; video: TrendVideo }>();
    videos.forEach((video) => {
      const current = grouped.get(video.channel);
      if (current) {
        current.views += video.views;
        current.count += 1;
      } else {
        grouped.set(video.channel, { channel: video.channel, views: video.views, count: 1, video });
      }
    });
    return [...grouped.values()].sort((a, b) => b.views - a.views).slice(0, 8);
  }, [videos]);

  return <section className="channel-row" aria-label="지금 뜨는 채널">
    <div className="row-title"><Users/><h2>지금 뜨는 채널</h2><span>현재 인기 영상 기준</span></div>
    <div className="channel-strip">
      {channels.map((item) => <button key={item.channel} onClick={() => onSelect(item.video)}>
        <img src={item.video.thumbnail} alt="" loading="lazy"/>
        <span><b>{item.channel}</b><small>조회 {fmt(item.views)} · {item.count}개 영상</small></span>
      </button>)}
    </div>
  </section>;
}

function Hero({ video, isSelection, onClear, scopeLabel }: {
  video: TrendVideo; isSelection: boolean; onClear: () => void; scopeLabel?: string;
}) {
  return <section className="hero">
    <img className="hero-image" src={`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`} alt="" />
    <div className="hero-wash" />
    <div className="hero-copy">
      <div className="eyebrow"><span>{isSelection ? `현재 ${video.rank}위` : scopeLabel ? `${scopeLabel} 1위` : "지금 한국 1위"}</span>
        <span className="category-chip">{video.category}</span>{video.isNew && <span className="new-chip">오늘 첫 진입</span>}
      </div>
      <h1>{video.title}</h1><p>{video.description}</p>
      <div className="ai-line"><span>SIGNAL</span>{video.aiNote}</div>
      <div className="hero-meta">{video.channel} · 조회 {fmt(video.views)} · 좋아요 {fmt(video.likes)} · <b>{video.source === "youtube" ? "게시 후 평균 " : "+"}{fmt(video.velocity)}/시</b></div>
      <div className="hero-actions">
        <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="primary-action"><Play fill="currentColor" /> 보러가기</a>
        {isSelection && <button className="secondary-action" onClick={onClear}><ArrowLeft /> 목록으로</button>}
      </div>
    </div>
    <div className="live-pill"><span /> {video.source === "youtube" ? "YOUTUBE LIVE" : "SAMPLE DATA"}</div>
  </section>;
}

function HistoryPanel({ video }: { video: TrendVideo }) {
  const hasHistory = video.history.length > 1;
  return <section className="selected-panel">
    <div className="section-head"><div><span>SELECTED SIGNAL</span><h2>선택한 콘텐츠 추이</h2></div>
      <div className="metric"><small>{hasHistory ? "7일 순위 변화" : "현재 순위"}</small><strong>{hasHistory ? `▲ ${Math.max(1, video.history[0].rank - video.rank)}` : `#${video.rank}`}</strong></div>
    </div>
    <div className="chart-grid">
      <div className="chart-box"><h3>급상승 순위 <span>{hasHistory ? "낮을수록 높음" : "스냅샷 축적 전"}</span></h3>
        <ResponsiveContainer width="100%" height={220}><LineChart data={video.history} margin={{ top:16,right:12,left:-22,bottom:0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="time" stroke="var(--muted-fg)" tickLine={false} axisLine={false} fontSize={11}/>
          <YAxis reversed domain={[1,30]} stroke="var(--muted-fg)" tickLine={false} axisLine={false} fontSize={11}/>
          <Tooltip contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/>
          <Line type="monotone" dataKey="rank" stroke="var(--accent)" strokeWidth={3} dot={{ fill:"var(--accent)",r:3 }}/>
        </LineChart></ResponsiveContainer>
      </div>
      <div className="chart-box"><h3>누적 조회수 <span>{hasHistory ? "최근 7일" : "현재 값"}</span></h3>
        <ResponsiveContainer width="100%" height={220}><AreaChart data={video.history} margin={{ top:16,right:12,left:-6,bottom:0 }}>
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

function SeriesView({ videos }: { videos: TrendVideo[] }) {
  const [videoId, setVideoId] = useState(videos[0].id);
  const [period, setPeriod] = useState("7일");
  const video = videos.find((item) => item.id === videoId) ?? videos[0];
  return <main className="subpage">
    <div className="page-heading"><div><span>TIME SERIES</span><h1>영상 시계열 추이</h1><p>순위와 조회수의 변화 속도를 함께 비교합니다.</p></div><Clock3 /></div>
    <section className="control-card">
      <label><span><Search /> 분석할 영상</span><select value={videoId} onChange={(event) => setVideoId(event.target.value)}>
        {videos.map((item) => <option key={item.id} value={item.id}>{item.rank}위 · {item.title}</option>)}
      </select></label>
      <div className="periods">{["24시간","7일","30일"].map((item) => <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div>
    </section>
    <HistoryPanel video={video}/>
    <section className="signal-table"><div className="section-head"><div><span>VELOCITY</span><h2>상승 속도 비교</h2></div></div>
      <div className="table-head"><span>영상</span><span>현재 순위</span><span>시간당 조회</span><span>변화</span></div>
      {videos.slice(0,6).map((item) => <button key={item.id} onClick={() => setVideoId(item.id)}>
        <span><img src={item.thumbnail} alt=""/><b>{item.title}</b></span><strong>#{item.rank}</strong><em>+{fmt(item.velocity)}</em><Delta video={item}/>
      </button>)}
    </section>
  </main>;
}

function ShareView({ videos, isLive }: { videos: TrendVideo[]; isLive: boolean }) {
  const [briefType, setBriefType] = useState("today");
  const categoryShare = [
    { category:"음악", value:videos.filter((video)=>video.category==="음악").length },
    { category:"엔터", value:videos.filter((video)=>["엔터테인먼트","코미디","영화·애니메이션"].includes(video.category)).length },
    { category:"게임", value:videos.filter((video)=>video.category==="게임").length },
    { category:"기술·교육", value:videos.filter((video)=>["과학기술","교육"].includes(video.category)).length },
    { category:"기타", value:videos.filter((video)=>!["음악","엔터테인먼트","코미디","영화·애니메이션","게임","과학기술","교육"].includes(video.category)).length },
  ].map((item)=>({...item,share:Math.round((item.value/Math.max(1,videos.length))*100)}));
  const topCategory = [...categoryShare].sort((a,b)=>b.value-a.value)[0];
  const briefs: Record<string,string> = isLive ? {
    today:`현재 대한민국 인기 영상 ${videos.length}개 중 ${topCategory.category} 분야가 ${topCategory.share}%로 가장 큰 비중을 차지합니다. 이 수치는 YouTube Data API의 현재 스냅샷을 기준으로 합니다.`,
    compare:"아직 이전 스냅샷이 저장되지 않아 전일 대비 증감은 계산하지 않습니다. D1 예약 수집이 연결되면 순위 진입·이탈과 카테고리 변화량을 제공할 수 있습니다.",
    report:"현재 단계에서는 실시간 인기 순위와 누적 조회수, 게시 이후 평균 조회 속도를 제공합니다. 7일 리포트는 시간별 스냅샷이 축적된 이후 활성화됩니다.",
  } : {
    today:"음악 카테고리의 점유율이 57%까지 확대됐습니다. 상위권에서는 오래된 글로벌 히트곡의 재진입이 두드러지고, 짧은 댄스·커버 콘텐츠가 원본 영상으로 조회를 되돌리는 흐름이 강합니다.",
    compare:"어제보다 음악 비중이 3%p 늘었고 엔터테인먼트는 1%p 줄었습니다. 신규 진입은 3건 감소했지만 상위 10개 영상의 평균 시간당 조회는 8.4% 증가했습니다.",
    report:"최근 7일은 신규 대형 영상 한 편보다 기존 히트곡이 서로 다른 커뮤니티에서 반복 재발견되는 패턴이 중심입니다. 다음 수집에서는 게임·과학기술 분야의 신규 진입과 음악 점유율 60% 돌파 여부를 확인할 필요가 있습니다.",
  };
  return <main className="subpage">
    <div className="page-heading"><div><span>CATEGORY PULSE</span><h1>점유율 · 리포트</h1><p>{isLive?"현재 인기 영상의 분야 구성을 읽습니다.":"무엇이 커지고 무엇이 빠지는지 7일 흐름으로 읽습니다."}</p></div><BarChart3 /></div>
    <div className="share-grid">
      <section className="chart-box large"><div className="section-head compact"><div><span>SHARE</span><h2>카테고리 점유율</h2></div>
        <div className="legend"><i className="music"/>음악 <i className="ent"/>엔터 <i className="game"/>게임 <i className="tech"/>기술</div></div>
        {isLive?<ResponsiveContainer width="100%" height={330}><BarChart data={categoryShare} layout="vertical" margin={{ top:20,right:24,left:8,bottom:0 }}>
          <CartesianGrid stroke="var(--grid)" horizontal={false}/><XAxis type="number" domain={[0,100]} tickFormatter={(v)=>`${v}%`} tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/><YAxis type="category" dataKey="category" tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11} width={72}/><Tooltip formatter={(value)=>`${value}%`} contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/><Bar dataKey="share" fill="var(--accent)" radius={[0,6,6,0]}/>
        </BarChart></ResponsiveContainer>:<ResponsiveContainer width="100%" height={330}><AreaChart data={shareData} margin={{ top:20,right:12,left:-18,bottom:0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="time" tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/><YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/>
          <Tooltip contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/>
          <Area type="monotone" stackId="1" dataKey="music" stroke="#baff46" fill="#baff46" fillOpacity={.72}/><Area type="monotone" stackId="1" dataKey="entertainment" stroke="#7259ff" fill="#7259ff" fillOpacity={.76}/><Area type="monotone" stackId="1" dataKey="game" stroke="#ff5c8a" fill="#ff5c8a" fillOpacity={.72}/><Area type="monotone" stackId="1" dataKey="tech" stroke="#43d9ca" fill="#43d9ca" fillOpacity={.68}/>
        </AreaChart></ResponsiveContainer>}
      </section>
      <section className="chart-box large"><div className="section-head compact"><div><span>CHURN</span><h2>진입 · 이탈</h2></div></div>
        {isLive?<div className="snapshot-note"><Database/><strong>비교 스냅샷 준비 중</strong><p>현재 API는 한 시점의 인기 영상만 제공합니다. D1에 시간별 순위를 저장한 뒤 진입·이탈을 계산합니다.</p></div>:<ResponsiveContainer width="100%" height={330}><BarChart data={shareData} margin={{ top:20,right:12,left:-24,bottom:0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="time" tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/><YAxis tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/><Tooltip contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/><Bar dataKey="entered" fill="var(--accent)" radius={[5,5,0,0]}/><Bar dataKey="exited" fill="var(--danger)" radius={[5,5,0,0]}/>
        </BarChart></ResponsiveContainer>}
      </section>
    </div>
    <section className="brief-panel"><div className="brief-mark"><Radio /></div><div className="brief-main">
      <div className="section-head compact"><div><span>SNAPSHOT BRIEF</span><h2>트렌드 한 줄보다 깊게</h2></div><span className="model-chip">{isLive?"LIVE DATA":"SAMPLE ANALYSIS"}</span></div>
      <div className="brief-tabs">{[["today","오늘의 브리핑"],["compare","어제와 비교"],["report","7일 리포트"]].map(([id,label]) => <button key={id} className={briefType === id ? "active" : ""} onClick={() => setBriefType(id)}>{label}</button>)}</div>
      <p>{briefs[briefType]}</p><div className="brief-foot"><span><Check/> 규칙 기반 스냅샷 분석</span><small>{isLive?"YouTube Data API 현재 데이터 기준":"샘플 스냅샷 기준"}</small></div>
    </div></section>
  </main>;
}

function ThemeDialog({ open, onOpenChange, theme, onTheme }: { open:boolean; onOpenChange:(open:boolean)=>void; theme:string; onTheme:(theme:string)=>void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="trend-dialog"><DialogHeader><span className="dialog-kicker">COLOR SIGNAL</span><DialogTitle>화면 테마 선택</DialogTitle><DialogDescription>선택은 이 브라우저에 저장됩니다.</DialogDescription></DialogHeader>
    <div className="theme-grid">{themes.map((item) => <button key={item.id} className={theme === item.id ? "theme-card active" : "theme-card"} onClick={() => onTheme(item.id)}><span className="swatches">{item.colors.map((color) => <i key={color} style={{ background:color }}/>)}</span><b>{item.name}</b>{theme === item.id && <Check/>}</button>)}</div>
  </DialogContent></Dialog>;
}

export default function Home() {
  const [selected, setSelected] = useState<TrendVideo | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setTheme] = useState("neon");
  const [updatedAt, setUpdatedAt] = useState("--:--");
  const [refreshing, setRefreshing] = useState(false);
  const [liveVideos, setLiveVideos] = useState<TrendVideo[] | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [categoryCache, setCategoryCache] = useState<Record<string, TrendVideo[]>>({});
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("yt-trend-theme");
    if (stored && themes.some((item) => item.id === stored)) {
      window.setTimeout(() => setTheme(stored), 0);
    }

    const controller = new AbortController();
    const load = async (silent = false) => {
      try {
        const data = await requestTrendingVideos(undefined, controller.signal);
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

    void load();
    const pollId = window.setInterval(() => void load(true), 60_000);

    return () => {
      controller.abort();
      window.clearInterval(pollId);
    };
  }, []);

  const applyTheme = (next: string) => {
    setTheme(next);
    window.localStorage.setItem("yt-trend-theme", next);
  };

  const allVideos = liveVideos ?? demoVideos;
  const isLive = Boolean(liveVideos);
  const baseRows = useMemo(() => liveVideos ? buildLiveRows(liveVideos) : demoRows, [liveVideos]);
  const activeCategory = YOUTUBE_CATEGORIES.find((category) => category.id === activeCategoryId) ?? null;
  const categoryVideos = activeCategoryId ? categoryCache[activeCategoryId] : undefined;
  const visibleVideos = activeCategory ? categoryVideos ?? [] : allVideos;
  const categoryRow = activeCategory && categoryVideos
    ? buildCategoryRow(activeCategory, categoryVideos)
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
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  const showHome = () => {
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
      const data = await requestTrendingVideos(categoryId);
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
      const data = await requestTrendingVideos(activeCategoryId ?? undefined);
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
  const categoryCounts = metricVideos.reduce<Record<string, number>>((counts, video) => {
    counts[video.category] = (counts[video.category] ?? 0) + 1;
    return counts;
  }, {});
  const dominantCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "기타";
  const heroVideo = selected ?? visibleVideos[0] ?? allVideos[0];

  return <div className="trend-app" data-theme={theme}>
    <Tabs defaultValue="home" className="app-tabs">
      <header className="topbar">
        <button className="brand" onClick={showHome} aria-label="홈으로"><span className="brand-mark"><TrendingUp/></span><span><b>PULSETUBE</b><small>RADAR</small></span></button>
        <TabsList className="top-tabs"><TabsTrigger value="home">홈</TabsTrigger><TabsTrigger value="series">시계열 추이</TabsTrigger><TabsTrigger value="share">점유율 · 리포트</TabsTrigger></TabsList>
        <div className="capture"><span/> 수집 {updatedAt} KST</div><div className="top-actions"><button onClick={refresh} aria-label="새로고침"><RefreshCw className={refreshing?"spin":""}/><span>새로고침</span></button><button onClick={()=>setThemeOpen(true)} aria-label="테마"><Palette/><span>테마</span></button></div>
      </header>
      <TabsContent value="home" className="tab-content">
        {!dataLoading&&!isLive&&<div className="data-alert" role="status"><AlertTriangle/><strong>현재 샘플 데이터 표시 중</strong><span>{dataError??"YouTube 실데이터 연결에 실패했습니다."}</span><button onClick={refresh} disabled={refreshing}>{refreshing?"확인 중":"다시 확인"}</button></div>}
        <Hero video={heroVideo} isSelection={Boolean(selected)} onClear={()=>setSelected(null)} scopeLabel={categoryVideos ? activeCategory?.label : undefined}/>{selected&&<HistoryPanel video={selected}/>}
        <section className="insight-band" aria-label="현재 스냅샷"><div><Flame/><span>음악 비중</span><b>{musicShare}%</b><em>{isLive?"현재":"샘플"}</em></div><div><TrendingUp/><span>평균 조회 속도</span><b>{fmt(fastest.velocity)}/시</b></div><div><Radio/><span>가장 많은 분야</span><b>{dominantCategory}</b></div><div><Database/><span>현재 범위</span><b>{metricVideos.length}개 영상</b></div></section>
        <div className="home-layout"><aside className="sidebar"><button className={focus===null&&!activeCategory?"active":""} onClick={showHome}><span>⌂</span> 홈</button>
          {groups.map((group)=>{const groupRows=baseRows.filter((row)=>row.group===group);if(!groupRows.length)return null;return <Fragment key={group}><h3>{group}</h3>{groupRows.map((row)=><button key={row.id} className={!activeCategory&&focus===row.id?"active":""} onClick={()=>selectRow(row.id)}>{row.label}</button>)}</Fragment>})}
          <h3>분야</h3>
          {YOUTUBE_CATEGORIES.map((category)=><button key={category.id} className={activeCategoryId===category.id?"active":""} onClick={()=>void selectCategory(category.id)}>{category.label}</button>)}
          <div className="source-note"><span>{isLive?"LIVE API":dataLoading?"CONNECTING":"DEMO FALLBACK"}</span><p>{isLive?"60초 자동 확인 · 카테고리별 API 조회":dataLoading?"실시간 인기 영상을 불러오는 중입니다.":dataError??"샘플 스냅샷을 표시하고 있습니다."}</p>{dataError&&!isLive&&<AlertTriangle aria-hidden="true"/>}</div></aside>
          <main className="rows-area">{(focus||activeCategory)&&<button className="focus-back" onClick={showHome}><ArrowLeft/> 전체 피드로</button>}
            {categoryLoading&&activeCategory&&<div className="scope-state" role="status"><RefreshCw className="spin"/><strong>{activeCategory.label} 인기 영상을 불러오는 중</strong><span>YouTube Data API 카테고리 조회</span></div>}
            {!categoryLoading&&categoryError&&activeCategory&&<div className="scope-state error" role="alert"><AlertTriangle/><strong>{activeCategory.label} 데이터를 불러오지 못했습니다</strong><span>{categoryError}</span><button onClick={()=>void selectCategory(activeCategory.id)}>다시 시도</button></div>}
            {!focus&&!activeCategory&&<ChannelStrip videos={allVideos} onSelect={choose}/>}
            {shownRows.map((row)=><TrendStrip key={row.id} row={row} videos={visibleVideos.length?visibleVideos:allVideos} onSelect={choose}/>)}</main>
        </div>
      </TabsContent>
      <TabsContent value="series" className="tab-content"><SeriesView videos={allVideos}/></TabsContent><TabsContent value="share" className="tab-content"><ShareView videos={allVideos} isLive={isLive}/></TabsContent>
    </Tabs>
    <ThemeDialog open={themeOpen} onOpenChange={setThemeOpen} theme={theme} onTheme={applyTheme}/>
    <footer><span>PULSETUBE RADAR</span><p>{isLive?"YouTube Data API v3 · 대한민국 현재 인기 영상 · 15분 엣지 캐시":"샘플 데이터 · 실시간 API 연결 실패 시 자동 폴백"}</p></footer>
  </div>;
}
