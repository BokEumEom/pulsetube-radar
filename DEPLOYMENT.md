# AWS 없이 운영하는 PulseTube Radar

현재 화면은 원본 프로젝트의 Trend Radar 흐름을 독립적으로 재구현했습니다. Cloudflare Worker의 `/api/youtube/trending`이 YouTube Data API v3에서 대한민국·일본·미국 중 선택한 국가의 인기 영상 25개를 서버 측으로 조회하며 15분 엣지 캐시를 적용합니다. 운영 화면에는 샘플 데이터를 섞지 않으며, D1이 연결되면 예약 수집과 시계열 분석이 함께 활성화됩니다.

현재 구현된 범위:

- `YT_API_KEY` Worker Runtime Secret
- `videos.list(chart=mostPopular, regionCode=KR|JP|US)` 서버 측 호출과 국가 전환
- 3개국 전체 및 고정 8개 분야의 `videoCategoryId`별 조회와 국가·카테고리별 캐시
- 60초 클라이언트 자동 확인
- 현재 순위·누적 조회수·좋아요·게시 이후 평균 조회 속도
- 현재 스냅샷의 카테고리 점유율
- D1 15분 스냅샷과 Cron Trigger
- 직전 순위 대비 delta, 신규 진입·이탈, 실제 시간당 조회 증가량
- 세 번째 스냅샷부터 조회 가속도, 모집단 백분위, 모멘텀 점수, 급상승 판정
- 예약 수집 실행 상태, 성공 범위, 수집 영상 수, 예상 YouTube API 사용량
- 24시간·7일·30일 영상 시계열과 7일 카테고리 변화
- 30일 원시 스냅샷 자동 정리

## 권장안: Cloudflare Workers + D1

Cloudflare 한 플랫폼 안에서 HTTP API, 정적 프런트엔드, 예약 수집, SQL 저장소를 운영합니다.

| 원본 AWS 구성 | Cloudflare 대체 |
| --- | --- |
| CloudFront + ALB | Workers Custom Domain / Worker Assets |
| ECS Fargate + FastAPI | TypeScript Worker (`fetch` handler) |
| APScheduler | Cron Trigger (`scheduled` handler) |
| DynamoDB | D1 |
| Secrets Manager | Worker Secrets |
| CloudWatch | Workers Logs + Analytics Engine |

구성:

```text
Browser → Cloudflare Worker → D1
                         ↘ YouTube Data API v3
Cron Trigger → Collector → D1
```

구현 디렉터리:

```text
worker/
  index.ts             # fetch + scheduled handlers
  youtube-store.ts     # D1 저장·조회·집계
db/
  schema.ts            # Drizzle schema
drizzle/
  0000_*.sql           # D1 migration
```

필수 설정:

- `YT_API_KEY`: Worker Secret
- `YT_API_KEY`는 Build Variable이 아닌 Runtime Secret으로 설정
- 생성되는 Wrangler 설정은 `keep_vars: true`로 대시보드 런타임 값을 보존하고, `secrets.required`로 키 누락 배포를 차단
- D1 binding: `DB`
- Cron: `*/15 * * * *`
- 동일 15분 구간 중복 수집을 막는 `UNIQUE(region, scope, captured_bucket)` 제약
- 현재 API 응답 `Cache-Control: public, max-age=300, s-maxage=900, stale-while-revalidate=3600`
- 예약 수집 범위: 3개국 × (전체 + 8개 카테고리) = 15분마다 27회 요청
- 예상 수집량: 회당 27 quota units, 하루 약 2,592 units(96회 예약 실행 기준)

## Cloudflare Git 배포에서 D1 활성화

현재 Git 연동 배포는 D1 없이도 성공하도록 구성되어 있습니다. 시계열을 켜려면 아래 작업을 한 번 수행합니다.

1. Cloudflare Dashboard의 **Storage & Databases → D1 SQL database**에서 `pulsetube-radar-history`를 생성합니다.
2. 생성한 DB의 Console에서 마이그레이션을 번호 순서대로 실행합니다. 기존 DB는 `0001`만 추가로 적용합니다. CLI를 사용한다면 다음과 같습니다.

   ```bash
   npx wrangler d1 execute pulsetube-radar-history --remote --file=drizzle/0000_sweet_invaders.sql
   npx wrangler d1 execute pulsetube-radar-history --remote --file=drizzle/0001_rich_overlord.sql
   ```

3. Workers Builds의 **Build variables and secrets**에 아래 빌드 변수를 추가합니다.

   | 이름 | 값 | 구분 |
   | --- | --- | --- |
   | `D1_DATABASE_ID` | 생성한 D1의 UUID | Build variable |
   | `D1_DATABASE_NAME` | `pulsetube-radar-history` | Build variable, 선택 |

4. 기존 `YT_API_KEY`는 **Runtime variables and secrets**의 Secret으로 유지합니다. 빌드 변수로 옮기지 않습니다.
5. 다시 배포하면 생성 Wrangler 설정에 `DB` binding과 15분 Cron Trigger가 포함됩니다.

각 국가의 첫 수집 직후에는 비교 기준점 하나만 있으므로 순위 변화가 `–`로 보입니다. 약 15분 뒤 두 번째 수집부터 변화량·신규 진입·진입/이탈 차트가 채워지고, 세 번째 수집부터 가속도와 급상승 판정이 활성화됩니다.

분석 API:

- `GET /api/youtube/history?region=KR&videoId=...&hours=168`
- `GET /api/youtube/category-trends?region=JP&hours=168`
- `GET /api/youtube/churn?region=US&hours=168`
- `GET /api/youtube/storage-status?region=KR`
- `GET /api/youtube/collector-status`

## 대안: Vercel + Postgres

프런트엔드 팀이 Next.js App Router를 선호하거나 관계형 분석 쿼리를 빠르게 확장해야 할 때 적합합니다.

| 역할 | Vercel 구성 |
| --- | --- |
| 웹/SSR/API | Next.js + Vercel Functions |
| 예약 수집 | Vercel Cron → `/api/collect` |
| 저장소 | Neon/Supabase 등 Marketplace Postgres |
| 캐시/락 | Upstash Redis 또는 DB advisory lock |

`CRON_SECRET`으로 수집 엔드포인트를 보호하고, 데이터베이스의 unique key로 재시도 시 중복 적재를 막습니다.

## 적용된 데이터 모델

```sql
youtube_snapshots
  id, region, scope, category_id, captured_at, captured_bucket, item_count

youtube_rankings
  snapshot_id, video_id, rank, previous_rank, delta, is_new,
  views, likes, views_per_hour, previous_views_per_hour,
  view_acceleration, sample_count, velocity_percentile,
  acceleration_percentile, momentum_score, breakout_status,
  title, channel, category_id, category_name, thumbnail,
  description, tags_json, published_at

youtube_collector_runs
  id, trigger, status, started_at, completed_at, scopes_total,
  scopes_succeeded, videos_collected, quota_units, error_summary
```

## 시간별 수집 순서

1. 대한민국(`KR`)·일본(`JP`)·미국(`US`)을 순회합니다.
2. 국가마다 `videos.list(chart=mostPopular, maxResults=25)` 전체 범위와 고정 8개 카테고리를 호출합니다.
3. 동일 국가의 직전 스냅샷과 비교해 순위 delta, 신규 진입, 시간당 조회수와 가속도를 계산합니다.
4. 동일 국가·수집 범위 모집단의 속도·가속도 백분위로 급상승 신호를 판정합니다.
5. 국가별 snapshot + ranking을 한 트랜잭션으로 저장하고 수집 실행 상태를 기록합니다.
6. `/api/youtube/trending`은 요청 국가의 최근 D1 스냅샷을 우선 사용하고 국가별 엣지 캐시를 적용합니다.
7. 30일을 넘긴 원시 스냅샷과 수집 실행 로그를 자동 정리합니다.

## 선택 기준

- **Cloudflare 권장:** 저비용, 한 플랫폼, 시간별 수집, 엣지 API, D1 정도면 충분한 현재 범위
- **Vercel 권장:** Next.js 중심 팀, Postgres 분석 확장, 인증·대시보드가 빠르게 커질 예정
- 데이터 규모가 커지면 수집기는 Cloudflare Worker에 두고, 분석 저장소만 외부 Postgres로 분리할 수도 있습니다.
