"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowLeft, BarChart3, Check, ChevronLeft, ChevronRight,
  Clock3, Database, Flame, Palette, Play, RefreshCw, Search, Sparkles,
  TrendingUp,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { rows, shareData, themes, videos, type TrendRow, type TrendVideo } from "./trend-data";

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
      <span>조회 {fmt(video.views)} <em>+{fmt(video.velocity)}/시</em></span>
    </span>
    <span className="hover-preview" aria-hidden="true">
      <b>{video.title}</b><small>{video.category} · {video.tags.join(" · ")}</small>
      <p><span>AI</span>{video.aiNote}</p>
    </span>
  </button>;
}

function TrendStrip({ row, onSelect }: { row: TrendRow; onSelect: (video: TrendVideo) => void }) {
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

function Hero({ video, isSelection, onClear, onQuiz }: {
  video: TrendVideo; isSelection: boolean; onClear: () => void; onQuiz: () => void;
}) {
  return <section className="hero">
    <img className="hero-image" src={`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`} alt="" />
    <div className="hero-wash" />
    <div className="hero-copy">
      <div className="eyebrow"><span>{isSelection ? `급상승 ${video.rank}위` : "지금 한국 1위"}</span>
        <span className="category-chip">{video.category}</span>{video.isNew && <span className="new-chip">오늘 첫 진입</span>}
      </div>
      <h1>{video.title}</h1><p>{video.description}</p>
      <div className="ai-line"><span>AI</span>{video.aiNote}</div>
      <div className="hero-meta">{video.channel} · 조회 {fmt(video.views)} · 좋아요 {fmt(video.likes)} · <b>+{fmt(video.velocity)}/시</b></div>
      <div className="hero-actions">
        <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="primary-action"><Play fill="currentColor" /> 보러가기</a>
        <button className="secondary-action" onClick={isSelection ? onClear : onQuiz}>
          {isSelection ? <><ArrowLeft /> 홈 화면으로</> : <><Sparkles /> 내 취향 찾기</>}
        </button>
      </div>
    </div>
    <div className="live-pill"><span /> DEMO SNAPSHOT</div>
  </section>;
}

function HistoryPanel({ video }: { video: TrendVideo }) {
  return <section className="selected-panel">
    <div className="section-head"><div><span>SELECTED SIGNAL</span><h2>선택한 콘텐츠 추이</h2></div>
      <div className="metric"><small>7일 순위 변화</small><strong>▲ {Math.max(1, video.history[0].rank - video.rank)}</strong></div>
    </div>
    <div className="chart-grid">
      <div className="chart-box"><h3>급상승 순위 <span>낮을수록 높음</span></h3>
        <ResponsiveContainer width="100%" height={220}><LineChart data={video.history} margin={{ top:16,right:12,left:-22,bottom:0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="time" stroke="var(--muted-fg)" tickLine={false} axisLine={false} fontSize={11}/>
          <YAxis reversed domain={[1,30]} stroke="var(--muted-fg)" tickLine={false} axisLine={false} fontSize={11}/>
          <Tooltip contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/>
          <Line type="monotone" dataKey="rank" stroke="var(--accent)" strokeWidth={3} dot={{ fill:"var(--accent)",r:3 }}/>
        </LineChart></ResponsiveContainer>
      </div>
      <div className="chart-box"><h3>누적 조회수 <span>최근 7일</span></h3>
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

function SeriesView() {
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

function ShareView() {
  const [briefType, setBriefType] = useState("today");
  const briefs: Record<string,string> = {
    today:"음악 카테고리의 점유율이 57%까지 확대됐습니다. 상위권에서는 오래된 글로벌 히트곡의 재진입이 두드러지고, 짧은 댄스·커버 콘텐츠가 원본 영상으로 조회를 되돌리는 흐름이 강합니다.",
    compare:"어제보다 음악 비중이 3%p 늘었고 엔터테인먼트는 1%p 줄었습니다. 신규 진입은 3건 감소했지만 상위 10개 영상의 평균 시간당 조회는 8.4% 증가했습니다.",
    report:"최근 7일은 신규 대형 영상 한 편보다 기존 히트곡이 서로 다른 커뮤니티에서 반복 재발견되는 패턴이 중심입니다. 다음 수집에서는 AI·게임 분야의 신규 진입과 음악 점유율 60% 돌파 여부를 확인할 필요가 있습니다.",
  };
  return <main className="subpage">
    <div className="page-heading"><div><span>CATEGORY PULSE</span><h1>점유율 · 리포트</h1><p>무엇이 커지고 무엇이 빠지는지 7일 흐름으로 읽습니다.</p></div><BarChart3 /></div>
    <div className="share-grid">
      <section className="chart-box large"><div className="section-head compact"><div><span>SHARE</span><h2>카테고리 점유율</h2></div>
        <div className="legend"><i className="music"/>음악 <i className="ent"/>엔터 <i className="game"/>게임 <i className="tech"/>기술</div></div>
        <ResponsiveContainer width="100%" height={330}><AreaChart data={shareData} margin={{ top:20,right:12,left:-18,bottom:0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="time" tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/><YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/>
          <Tooltip contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/>
          <Area type="monotone" stackId="1" dataKey="music" stroke="#baff46" fill="#baff46" fillOpacity={.72}/><Area type="monotone" stackId="1" dataKey="entertainment" stroke="#7259ff" fill="#7259ff" fillOpacity={.76}/><Area type="monotone" stackId="1" dataKey="game" stroke="#ff5c8a" fill="#ff5c8a" fillOpacity={.72}/><Area type="monotone" stackId="1" dataKey="tech" stroke="#43d9ca" fill="#43d9ca" fillOpacity={.68}/>
        </AreaChart></ResponsiveContainer>
      </section>
      <section className="chart-box large"><div className="section-head compact"><div><span>CHURN</span><h2>진입 · 이탈</h2></div></div>
        <ResponsiveContainer width="100%" height={330}><BarChart data={shareData} margin={{ top:20,right:12,left:-24,bottom:0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="time" tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/><YAxis tickLine={false} axisLine={false} stroke="var(--muted-fg)" fontSize={11}/><Tooltip contentStyle={{ background:"var(--panel-solid)",border:"1px solid var(--border)",borderRadius:12 }}/><Bar dataKey="entered" fill="var(--accent)" radius={[5,5,0,0]}/><Bar dataKey="exited" fill="var(--danger)" radius={[5,5,0,0]}/>
        </BarChart></ResponsiveContainer>
      </section>
    </div>
    <section className="brief-panel"><div className="brief-mark"><Sparkles /></div><div className="brief-main">
      <div className="section-head compact"><div><span>AI BRIEFING</span><h2>트렌드 한 줄보다 깊게</h2></div><span className="model-chip">LLM READY</span></div>
      <div className="brief-tabs">{[["today","오늘의 브리핑"],["compare","어제와 비교"],["report","7일 리포트"]].map(([id,label]) => <button key={id} className={briefType === id ? "active" : ""} onClick={() => setBriefType(id)}>{label}</button>)}</div>
      <p>{briefs[briefType]}</p><div className="brief-foot"><span><Check/> 스냅샷 분석 완료</span><small>실운영 시 OpenAI·Claude·Workers AI 연결</small></div>
    </div></section>
  </main>;
}

function QuizChoice({ value, selected, onClick, children }: {
  value:string; selected:string; onClick:(value:string)=>void; children:React.ReactNode;
}) {
  return <button className={selected === value ? "quiz-choice active" : "quiz-choice"} onClick={() => onClick(value)}>
    {selected === value && <Check/>}{children}
  </button>;
}

function QuizDialog({ open, onOpenChange, onComplete }: { open:boolean; onOpenChange:(open:boolean)=>void; onComplete:(row:TrendRow)=>void }) {
  const [mood,setMood] = useState("energy"); const [time,setTime] = useState("short"); const [style,setStyle] = useState("music");
  const submit = () => {
    const ids = mood === "calm" ? [videos[6].id,videos[3].id,videos[2].id,videos[8].id] : [videos[0].id,videos[4].id,videos[7].id,videos[5].id];
    onComplete({ id:"quiz",group:"AI 추천",label:"나의 추천",title:time === "short" ? "지금 10분, 나를 위한 추천" : "오늘 오래 즐길 추천",hint:`${style === "music" ? "음악 중심" : "이야기 중심"} · 취향 퀴즈`,videoIds:ids }); onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="trend-dialog quiz-dialog"><DialogHeader><span className="dialog-kicker">TASTE SIGNAL</span><DialogTitle>지금 보고 싶은 분위기는?</DialogTitle><DialogDescription>세 가지 선택으로 현재 트렌드에서 취향에 맞는 영상을 골라드려요.</DialogDescription></DialogHeader>
    <div className="question"><b>1. 지금의 기분</b><div><QuizChoice value="energy" selected={mood} onClick={setMood}>에너지가 필요해요</QuizChoice><QuizChoice value="calm" selected={mood} onClick={setMood}>차분하게 쉬고 싶어요</QuizChoice></div></div>
    <div className="question"><b>2. 시청할 시간</b><div><QuizChoice value="short" selected={time} onClick={setTime}>10분 안쪽</QuizChoice><QuizChoice value="long" selected={time} onClick={setTime}>오래 즐기기</QuizChoice></div></div>
    <div className="question"><b>3. 선호 스타일</b><div><QuizChoice value="music" selected={style} onClick={setStyle}>음악과 퍼포먼스</QuizChoice><QuizChoice value="story" selected={style} onClick={setStyle}>이야기와 맥락</QuizChoice></div></div>
    <button className="dialog-submit" onClick={submit}><Sparkles/> 내 추천 만들기</button>
  </DialogContent></Dialog>;
}

function ThemeDialog({ open, onOpenChange, theme, onTheme }: { open:boolean; onOpenChange:(open:boolean)=>void; theme:string; onTheme:(theme:string)=>void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="trend-dialog"><DialogHeader><span className="dialog-kicker">COLOR SIGNAL</span><DialogTitle>화면 테마 선택</DialogTitle><DialogDescription>선택은 이 브라우저에 저장됩니다.</DialogDescription></DialogHeader>
    <div className="theme-grid">{themes.map((item) => <button key={item.id} className={theme === item.id ? "theme-card active" : "theme-card"} onClick={() => onTheme(item.id)}><span className="swatches">{item.colors.map((color) => <i key={color} style={{ background:color }}/>)}</span><b>{item.name}</b>{theme === item.id && <Check/>}</button>)}</div>
  </DialogContent></Dialog>;
}

export default function Home() {
  const [selected,setSelected] = useState<TrendVideo|null>(null); const [focus,setFocus] = useState<string|null>(null);
  const [quizOpen,setQuizOpen] = useState(false); const [themeOpen,setThemeOpen] = useState(false); const [quizRow,setQuizRow] = useState<TrendRow|null>(null);
  const [theme,setTheme] = useState("neon"); const [updatedAt,setUpdatedAt] = useState("11:00"); const [refreshing,setRefreshing] = useState(false);
  useEffect(() => {
    const stored=window.localStorage.getItem("yt-trend-theme");
    if(stored&&themes.some((item)=>item.id===stored)) window.setTimeout(() => setTheme(stored), 0);
  },[]);
  const applyTheme=(next:string)=>{setTheme(next);window.localStorage.setItem("yt-trend-theme",next)};
  const allRows=useMemo(()=>quizRow?[quizRow,...rows]:rows,[quizRow]); const shownRows=focus?allRows.filter((row)=>row.id===focus):allRows;
  const groups=["랭킹","YouTube Music","AI 추천","분야","국가"];
  const choose=(video:TrendVideo)=>{setSelected(video);window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})};
  const refresh=()=>{setRefreshing(true);window.setTimeout(()=>{setUpdatedAt(new Intl.DateTimeFormat("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()));setRefreshing(false)},650)};
  return <div className="trend-app" data-theme={theme}>
    <Tabs defaultValue="home" className="app-tabs">
      <header className="topbar">
        <button className="brand" onClick={()=>{setSelected(null);setFocus(null)}} aria-label="홈으로"><span className="brand-mark"><TrendingUp/></span><span><b>PULSETUBE</b><small>RADAR</small></span></button>
        <TabsList className="top-tabs"><TabsTrigger value="home">홈</TabsTrigger><TabsTrigger value="series">시계열 추이</TabsTrigger><TabsTrigger value="share">점유율 · 리포트</TabsTrigger></TabsList>
        <div className="capture"><span/> 수집 {updatedAt} KST</div><div className="top-actions"><button onClick={refresh} aria-label="새로고침"><RefreshCw className={refreshing?"spin":""}/><span>새로고침</span></button><button onClick={()=>setThemeOpen(true)} aria-label="테마"><Palette/><span>테마</span></button></div>
      </header>
      <TabsContent value="home" className="tab-content">
        <Hero video={selected??videos[0]} isSelection={Boolean(selected)} onClear={()=>setSelected(null)} onQuiz={()=>setQuizOpen(true)}/>{selected&&<HistoryPanel video={selected}/>} 
        <section className="insight-band" aria-label="오늘의 인사이트"><div><Flame/><span>음악 점유율</span><b>57%</b><em>+3%p</em></div><div><TrendingUp/><span>가장 빠른 영상</span><b>+{fmt(videos[0].velocity)}/시</b></div><div><Sparkles/><span>오늘의 흐름</span><b>글로벌 히트곡 재발견</b></div><div><Database/><span>현재 데이터</span><b>10개 영상 · 8개 신호</b></div></section>
        <div className="home-layout"><aside className="sidebar"><button className={focus===null?"active":""} onClick={()=>setFocus(null)}><span>⌂</span> 홈</button>
          {groups.map((group)=>{const groupRows=allRows.filter((row)=>row.group===group);if(!groupRows.length)return null;return <Fragment key={group}><h3>{group}</h3>{groupRows.map((row)=><button key={row.id} className={focus===row.id?"active":""} onClick={()=>setFocus(row.id)}>{row.label}</button>)}</Fragment>})}
          <div className="source-note"><span>DEMO MODE</span><p>YouTube Data API 연결 전 샘플 스냅샷입니다.</p></div></aside>
          <main className="rows-area">{focus&&<button className="focus-back" onClick={()=>setFocus(null)}><ArrowLeft/> 전체 피드로</button>}{shownRows.map((row)=><TrendStrip key={row.id} row={row} onSelect={choose}/>)}</main>
        </div>
      </TabsContent>
      <TabsContent value="series" className="tab-content"><SeriesView/></TabsContent><TabsContent value="share" className="tab-content"><ShareView/></TabsContent>
    </Tabs>
    <QuizDialog open={quizOpen} onOpenChange={setQuizOpen} onComplete={(row)=>{setQuizRow(row);setFocus(null)}}/><ThemeDialog open={themeOpen} onOpenChange={setThemeOpen} theme={theme} onTheme={applyTheme}/>
    <footer><span>PULSETUBE RADAR</span><p>샘플 데이터 · 실제 서비스에서는 YouTube Data API v3와 예약 수집을 연결합니다.</p></footer>
  </div>;
}
