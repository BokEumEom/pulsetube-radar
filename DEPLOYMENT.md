# AWS 없이 운영하는 PulseTube Radar

현재 화면은 원본 프로젝트의 Trend Radar 흐름을 독립적으로 재구현한 프런트엔드입니다. 샘플 스냅샷으로 모든 탐색·차트·퀴즈·테마 동작을 확인할 수 있습니다. 실데이터 운영에는 아래 데이터 계층을 연결합니다.

## 권장안: Cloudflare Workers + D1

Cloudflare 한 플랫폼 안에서 HTTP API, 정적 프런트엔드, 예약 수집, SQL 저장소를 운영합니다.

| 원본 AWS 구성 | Cloudflare 대체 |
| --- | --- |
| CloudFront + ALB | Workers Custom Domain / Worker Assets |
| ECS Fargate + FastAPI | TypeScript Worker (`fetch` handler) |
| APScheduler | Cron Trigger (`scheduled` handler) |
| DynamoDB | D1 |
| Secrets Manager | Worker Secrets |
| Bedrock | Workers AI 또는 OpenAI/Anthropic API + AI Gateway |
| CloudWatch | Workers Logs + Analytics Engine |

구성:

```text
Browser → Cloudflare Worker → D1
                         ↘ YouTube Data API v3
Cron Trigger → Collector → D1 → AI tagging job
```

권장 디렉터리:

```text
src/
  index.ts             # fetch + scheduled handlers
  api/home.ts          # 홈 피드 조합
  api/history.ts       # 영상/카테고리 시계열
  jobs/collect.ts      # YouTube 수집 + delta 계산
  jobs/tag.ts          # 선택적 AI 태깅
  db/schema.sql
```

필수 설정:

- `YT_API_KEY`: Worker Secret
- `OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY`: 선택, AI 브리핑용
- D1 binding: `DB`
- Cron: `0 * * * *`
- 동일 시간 중복 수집을 막는 `UNIQUE(region, scope, captured_hour)` 제약
- API 응답 `Cache-Control: public, max-age=60, stale-while-revalidate=300`

## 대안: Vercel + Postgres

프런트엔드 팀이 Next.js App Router를 선호하거나 관계형 분석 쿼리를 빠르게 확장해야 할 때 적합합니다.

| 역할 | Vercel 구성 |
| --- | --- |
| 웹/SSR/API | Next.js + Vercel Functions |
| 예약 수집 | Vercel Cron → `/api/collect` |
| 저장소 | Neon/Supabase 등 Marketplace Postgres |
| 캐시/락 | Upstash Redis 또는 DB advisory lock |
| AI | Vercel AI SDK + 선택한 모델 공급자 |

`CRON_SECRET`으로 수집 엔드포인트를 보호하고, 데이터베이스의 unique key로 재시도 시 중복 적재를 막습니다. 긴 AI 태깅은 수집 요청과 분리해 Queue 또는 Workflow로 넘기는 편이 안전합니다.

## 최소 데이터 모델

```sql
CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  captured_at TIMESTAMP NOT NULL,
  captured_hour TEXT NOT NULL,
  region TEXT NOT NULL,
  scope TEXT NOT NULL,
  UNIQUE (captured_hour, region, scope)
);

CREATE TABLE video_rankings (
  snapshot_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  views BIGINT NOT NULL,
  likes BIGINT NOT NULL,
  category_id TEXT,
  views_per_hour BIGINT,
  delta INTEGER,
  is_new INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_id, video_id)
);

CREATE INDEX idx_video_history ON video_rankings(video_id, snapshot_id);
```

## 시간별 수집 순서

1. `videos.list(chart=mostPopular, regionCode=KR, maxResults=50)` 호출
2. 필요한 카테고리 범위 추가 호출
3. 직전 스냅샷과 비교해 순위 delta, 신규 진입, 시간당 조회수 계산
4. snapshot + ranking을 한 트랜잭션으로 저장
5. AI 태깅은 한 스냅샷당 한 번만 비동기로 실행
6. `/api/home`은 최신 스냅샷과 태그를 조합하고 60초 캐시
7. 30~90일을 넘긴 원시 랭킹은 정리하고 일 단위 집계만 유지

## 선택 기준

- **Cloudflare 권장:** 저비용, 한 플랫폼, 시간별 수집, 엣지 API, D1 정도면 충분한 현재 범위
- **Vercel 권장:** Next.js 중심 팀, Postgres 분석 확장, 인증·대시보드가 빠르게 커질 예정
- 데이터 규모가 커지면 수집기는 Cloudflare Worker에 두고, 분석 저장소만 외부 Postgres로 분리할 수도 있습니다.
