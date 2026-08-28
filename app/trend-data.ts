export type TrendVideo = {
  id: string;
  title: string;
  channel: string;
  category: string;
  views: number;
  likes: number;
  velocity: number;
  delta: number | null;
  rank: number;
  isNew?: boolean;
  thumbnail: string;
  description: string;
  tags: string[];
  aiNote: string;
  history: { time: string; rank: number; views: number }[];
  publishedAt?: string;
  source?: "youtube" | "demo";
};

export type TrendRow = {
  id: string;
  group: "랭킹" | "YouTube Music" | "분야" | "국가" | "채널";
  label: string;
  title: string;
  hint?: string;
  topStyle?: boolean;
  videoIds: string[];
};

export type YouTubeCategory = {
  id: string;
  label: string;
  title: string;
};

export const YOUTUBE_CATEGORIES: YouTubeCategory[] = [
  { id: "10", label: "음악", title: "대한민국 음악 인기 영상" },
  { id: "20", label: "게임", title: "대한민국 게임 인기 영상" },
  { id: "24", label: "엔터테인먼트", title: "대한민국 엔터테인먼트 인기 영상" },
  { id: "25", label: "뉴스·정치", title: "대한민국 뉴스·정치 인기 영상" },
  { id: "17", label: "스포츠", title: "대한민국 스포츠 인기 영상" },
  { id: "1", label: "영화·애니메이션", title: "대한민국 영화·애니메이션 인기 영상" },
  { id: "28", label: "과학기술", title: "대한민국 과학기술 인기 영상" },
  { id: "23", label: "코미디", title: "대한민국 코미디 인기 영상" },
];

const history = (rank: number, views: number, seed: number) =>
  ["6일 전", "5일 전", "4일 전", "3일 전", "2일 전", "어제", "지금"].map(
    (time, index) => ({
      time,
      rank: Math.max(1, Math.min(30, rank + (6 - index) * 2 - ((seed + index) % 4))),
      views: Math.round(views * (0.36 + index * 0.106 + ((seed + index) % 3) * 0.012)),
    }),
  );

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const videos: TrendVideo[] = [
  {
    id: "9bZkp7q19f0",
    title: "PSY - GANGNAM STYLE(강남스타일) M/V",
    channel: "officialpsy",
    category: "음악",
    views: 5600000000,
    likes: 31000000,
    velocity: 284000,
    delta: 2,
    rank: 1,
    thumbnail: thumb("9bZkp7q19f0"),
    description: "강한 후렴과 상징적인 안무가 다시 밈과 숏폼을 타고 확산되는 글로벌 뮤직비디오.",
    tags: ["K-POP", "댄스", "에너지"],
    aiNote: "오래된 히트곡이 신규 숏폼 밈과 결합하면서 세대가 다른 시청자까지 다시 끌어들이고 있습니다.",
    history: history(1, 5600000000, 1),
  },
  {
    id: "kJQP7kiw5Fk",
    title: "Luis Fonsi - Despacito ft. Daddy Yankee",
    channel: "Luis Fonsi",
    category: "음악",
    views: 8700000000,
    likes: 54000000,
    velocity: 241000,
    delta: 1,
    rank: 2,
    thumbnail: thumb("kJQP7kiw5Fk"),
    description: "라틴 팝의 대표곡. 짧은 댄스 챌린지를 중심으로 재생 속도가 다시 높아지고 있습니다.",
    tags: ["라틴", "파티", "뮤직비디오"],
    aiNote: "국가를 넘는 익숙한 멜로디와 여름 시즌성이 조회 증가를 견인합니다.",
    history: history(2, 8700000000, 2),
  },
  {
    id: "JGwWNGJdvx8",
    title: "Ed Sheeran - Shape of You",
    channel: "Ed Sheeran",
    category: "음악",
    views: 6500000000,
    likes: 34000000,
    velocity: 198000,
    delta: -1,
    rank: 3,
    thumbnail: thumb("JGwWNGJdvx8"),
    description: "꾸준한 검색 유입과 플레이리스트 재생이 이어지는 글로벌 팝 스테디셀러.",
    tags: ["팝", "운동", "플레이리스트"],
    aiNote: "큰 이벤트보다 검색과 추천 재생을 통해 안정적으로 상위권을 유지하는 유형입니다.",
    history: history(3, 6500000000, 3),
  },
  {
    id: "RgKAFK5djSk",
    title: "Wiz Khalifa - See You Again ft. Charlie Puth",
    channel: "Wiz Khalifa",
    category: "음악",
    views: 6600000000,
    likes: 45000000,
    velocity: 176000,
    delta: 4,
    rank: 4,
    thumbnail: thumb("RgKAFK5djSk"),
    description: "영화의 감정선을 대표하는 곡으로 추억·헌정 콘텐츠와 함께 반복 소비됩니다.",
    tags: ["OST", "감성", "추억"],
    aiNote: "감정적 맥락을 가진 사용자 제작 콘텐츠가 원본 영상으로 유입을 되돌리고 있습니다.",
    history: history(4, 6600000000, 4),
  },
  {
    id: "hT_nvWreIhg",
    title: "OneRepublic - Counting Stars",
    channel: "OneRepublic",
    category: "음악",
    views: 4200000000,
    likes: 19000000,
    velocity: 151000,
    delta: 0,
    rank: 5,
    thumbnail: thumb("hT_nvWreIhg"),
    description: "빠른 전개와 익숙한 후렴으로 운동·드라이브 플레이리스트에서 강세를 보입니다.",
    tags: ["밴드", "드라이브", "에너지"],
    aiNote: "긴 재생 수명을 가진 곡이 추천 알고리즘에서 꾸준히 재발견되는 흐름입니다.",
    history: history(5, 4200000000, 5),
  },
  {
    id: "CevxZvSJLk8",
    title: "Katy Perry - Roar",
    channel: "Katy Perry",
    category: "엔터테인먼트",
    views: 4300000000,
    likes: 17000000,
    velocity: 137000,
    delta: 3,
    rank: 6,
    thumbnail: thumb("CevxZvSJLk8"),
    description: "강렬한 색감과 메시지가 짧은 리액션 영상에서 다시 주목받는 팝 뮤직비디오.",
    tags: ["팝", "긍정", "퍼포먼스"],
    aiNote: "직관적인 서사와 후렴구가 짧은 클립으로 분리되어도 전달력이 높습니다.",
    history: history(6, 4300000000, 6),
  },
  {
    id: "60ItHLz5WEA",
    title: "Alan Walker - Faded",
    channel: "Alan Walker",
    category: "음악",
    views: 3900000000,
    likes: 31000000,
    velocity: 129000,
    delta: -2,
    rank: 7,
    thumbnail: thumb("60ItHLz5WEA"),
    description: "전자음악의 공간감과 서정적인 분위기로 집중·게임 플레이리스트에서 재생됩니다.",
    tags: ["EDM", "게임", "몰입"],
    aiNote: "게임과 공부용 장시간 플레이리스트에서 원곡으로 이어지는 유입이 두드러집니다.",
    history: history(7, 3900000000, 7),
  },
  {
    id: "OPf0YbXqDm0",
    title: "Mark Ronson - Uptown Funk ft. Bruno Mars",
    channel: "Mark Ronson",
    category: "엔터테인먼트",
    views: 5400000000,
    likes: 22000000,
    velocity: 118000,
    delta: null,
    rank: 8,
    isNew: true,
    thumbnail: thumb("OPf0YbXqDm0"),
    description: "복고적 퍼포먼스와 즉각적인 리듬이 댄스·행사 영상에서 다시 확산 중입니다.",
    tags: ["펑크", "댄스", "레트로"],
    aiNote: "새로운 커버 영상이 공개되며 원곡 검색량이 함께 뛰었습니다.",
    history: history(8, 5400000000, 8),
  },
  {
    id: "3JZ_D3ELwOQ",
    title: "Charlie Puth - Attention",
    channel: "Charlie Puth",
    category: "음악",
    views: 1700000000,
    likes: 14000000,
    velocity: 104000,
    delta: 5,
    rank: 9,
    thumbnail: thumb("3JZ_D3ELwOQ"),
    description: "베이스 라인과 보컬 구성이 분석·커버 콘텐츠의 소재로 다시 떠오르고 있습니다.",
    tags: ["팝", "보컬", "커버"],
    aiNote: "음악 제작 해설과 보컬 커버가 동시에 늘면서 역주행 속도가 빨라졌습니다.",
    history: history(9, 1700000000, 9),
  },
  {
    id: "dQw4w9WgXcQ",
    title: "Rick Astley - Never Gonna Give You Up",
    channel: "Rick Astley",
    category: "코미디",
    views: 1700000000,
    likes: 18000000,
    velocity: 99000,
    delta: -2,
    rank: 10,
    thumbnail: thumb("dQw4w9WgXcQ"),
    description: "인터넷 문화의 대표 밈으로, 새로운 커뮤니티 이벤트마다 반복해서 차트에 진입합니다.",
    tags: ["밈", "레트로", "유머"],
    aiNote: "의도적인 링크 공유와 커뮤니티 이벤트가 짧고 강한 조회수 파동을 만듭니다.",
    history: history(10, 1700000000, 10),
  },
];

export const rows: TrendRow[] = [
  { id: "top", group: "랭킹", label: "전체 급상승", title: "대한민국 TOP 10", topStyle: true, videoIds: videos.map((video) => video.id) },
  { id: "velocity", group: "랭킹", label: "조회수 급증", title: "지금 가장 빠르게 뜨는 영상", hint: "시간당 증가 기준", videoIds: [...videos].sort((a, b) => b.velocity - a.velocity).slice(0, 7).map((video) => video.id) },
  { id: "new", group: "랭킹", label: "오늘 첫 진입", title: "오늘 첫 진입", hint: "이전 스냅샷에 없던 영상", videoIds: [videos[7].id, videos[5].id, videos[9].id, videos[3].id] },
  { id: "music", group: "YouTube Music", label: "대한민국 차트", title: "YouTube Music · 대한민국", hint: "공식 차트", videoIds: [videos[0].id, videos[2].id, videos[1].id, videos[6].id, videos[8].id] },
  { id: "entertainment", group: "분야", label: "엔터테인먼트", title: "엔터테인먼트는 지금", videoIds: [videos[5].id, videos[7].id, videos[9].id, videos[0].id, videos[3].id] },
  { id: "global", group: "국가", label: "글로벌 교차", title: "한국과 글로벌에서 함께 뜨는 영상", videoIds: [videos[1].id, videos[2].id, videos[3].id, videos[4].id, videos[6].id] },
];

export function buildLiveRows(liveVideos: TrendVideo[]): TrendRow[] {
  const top = liveVideos.slice(0, 10);
  const fastest = [...liveVideos]
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, 10);
  const publishedRecently = liveVideos
    .filter((video) => {
      if (!video.publishedAt) return false;
      const age = Date.now() - new Date(video.publishedAt).getTime();
      return age >= 0 && age <= 48 * 60 * 60 * 1000;
    })
    .slice(0, 10);
  const music = liveVideos.filter((video) => video.category === "음악").slice(0, 10);
  const entertainment = liveVideos
    .filter((video) => ["엔터테인먼트", "코미디", "영화·애니메이션"].includes(video.category))
    .slice(0, 10);
  const gaming = liveVideos.filter((video) => video.category === "게임").slice(0, 10);

  const liveRows: TrendRow[] = [
    {
      id: "top",
      group: "랭킹",
      label: "현재 인기",
      title: "대한민국 인기 영상 TOP 10",
      hint: "YouTube Data API 현재 스냅샷",
      topStyle: true,
      videoIds: top.map((video) => video.id),
    },
    {
      id: "velocity",
      group: "랭킹",
      label: "평균 조회 속도",
      title: "게시 이후 평균 조회 속도",
      hint: "누적 조회수 ÷ 공개 후 경과 시간",
      videoIds: fastest.map((video) => video.id),
    },
  ];

  if (publishedRecently.length) {
    liveRows.push({
      id: "new",
      group: "랭킹",
      label: "최근 공개",
      title: "48시간 안에 공개된 인기 영상",
      hint: "현재 인기 목록 기준",
      videoIds: publishedRecently.map((video) => video.id),
    });
  }
  if (music.length) {
    liveRows.push({
      id: "music",
      group: "YouTube Music",
      label: "인기 음악",
      title: "대한민국 인기 영상 속 음악",
      hint: "공식 Music Charts가 아닌 인기 영상 필터",
      videoIds: music.map((video) => video.id),
    });
  }
  if (entertainment.length) {
    liveRows.push({
      id: "entertainment",
      group: "분야",
      label: "엔터테인먼트",
      title: "엔터테인먼트는 지금",
      videoIds: entertainment.map((video) => video.id),
    });
  }
  if (gaming.length) {
    liveRows.push({
      id: "gaming",
      group: "분야",
      label: "게임",
      title: "지금 인기 있는 게임 영상",
      videoIds: gaming.map((video) => video.id),
    });
  }

  return liveRows;
}

export function buildCategoryRow(
  category: YouTubeCategory,
  categoryVideos: TrendVideo[],
): TrendRow {
  return {
    id: `category-${category.id}`,
    group: "분야",
    label: category.label,
    title: category.title,
    hint: "YouTube Data API 카테고리별 현재 인기",
    topStyle: true,
    videoIds: categoryVideos.map((video) => video.id),
  };
}

export const shareData = [
  { time: "6일 전", music: 46, entertainment: 23, game: 12, tech: 8, entered: 7, exited: 4 },
  { time: "5일 전", music: 43, entertainment: 25, game: 13, tech: 9, entered: 5, exited: 6 },
  { time: "4일 전", music: 48, entertainment: 21, game: 12, tech: 8, entered: 9, exited: 5 },
  { time: "3일 전", music: 51, entertainment: 19, game: 11, tech: 8, entered: 8, exited: 7 },
  { time: "2일 전", music: 49, entertainment: 22, game: 10, tech: 9, entered: 6, exited: 8 },
  { time: "어제", music: 54, entertainment: 19, game: 9, tech: 8, entered: 11, exited: 6 },
  { time: "지금", music: 57, entertainment: 18, game: 8, tech: 7, entered: 8, exited: 9 },
];

export const themes = [
  { id: "neon", name: "Neon Hunter", colors: ["#090b12", "#d7ff3f", "#7857ff"] },
  { id: "ruby", name: "Ruby Signal", colors: ["#10090d", "#ff4f78", "#ffb84f"] },
  { id: "ocean", name: "Deep Ocean", colors: ["#06121b", "#37d7ff", "#4e76ff"] },
  { id: "forest", name: "Digital Forest", colors: ["#07130f", "#42f59e", "#ffe16b"] },
  { id: "violet", name: "Violet Hour", colors: ["#0f0a18", "#c98cff", "#6af0d2"] },
  { id: "cotton", name: "Cotton Candy", colors: ["#f8f5ff", "#7258ff", "#ff71b8"] },
  { id: "mono", name: "Signal Mono", colors: ["#0c0c0d", "#f4f4f2", "#8b8b91"] },
  { id: "sunset", name: "Seoul Sunset", colors: ["#160d13", "#ff8159", "#ffcc63"] },
  { id: "ice", name: "Polar Ice", colors: ["#071218", "#8ff5ff", "#b0b9ff"] },
  { id: "lime", name: "Electric Lime", colors: ["#0d1008", "#b8ff52", "#48e6c8"] },
];
