# PulseTube Radar

YouTube 인기 영상의 **순위, 상승 속도, 신규 진입, 카테고리 점유율**을 한 화면에서 탐색하는 트렌드 레이더입니다.

## 주요 기능

- YouTube Data API 기반 대한민국 현재 인기 영상 피드
- TOP 10, 실제 수집 구간 조회 속도, 최근 공개 메뉴
- 고정 8개 분야 메뉴와 카테고리별 실시간 API 조회
- 현재 인기 영상에서 파생한 인기 채널 스트립
- 실데이터 연결 실패 시 샘플 스냅샷 자동 폴백
- D1 기반 24시간·7일·30일 영상 시계열
- 카테고리 점유율 변화와 인기 목록 진입·이탈
- 60초 자동 확인과 10종 컬러 테마
- 데스크톱·모바일 반응형 UI

Cloudflare Worker의 `YT_API_KEY` Secret이 설정되면 `/api/youtube/trending`이 대한민국 인기 영상 25개를 서버에서 조회하고 15분간 엣지 캐시합니다. `category` 파라미터를 사용하면 음악·게임·엔터테인먼트·뉴스/정치·스포츠·영화/애니메이션·과학기술·코미디를 별도로 조회합니다. API 키는 브라우저에 노출되지 않습니다.

`DB` D1 binding이 있으면 Cron Trigger가 15분마다 전체 및 8개 카테고리 스냅샷을 저장합니다. 두 번째 스냅샷부터 직전 순위 변화, 신규 진입, 실제 시간당 조회 증가량이 계산됩니다. D1이 없거나 아직 마이그레이션되지 않은 배포에서도 현재 YouTube 라이브 피드는 그대로 동작합니다.

## 로컬 실행

```bash
npm ci
npm run dev
```

로컬 실데이터 확인은 Git에 포함하지 않는 `.dev.vars`에 `YT_API_KEY`를 설정합니다.

## 검증

```bash
npm run lint
npm run build
```

## 배포

AWS 없이 운영하는 두 가지 구성을 지원 대상으로 둡니다.

- 권장: Cloudflare Workers + D1 + Cron Triggers
- 대안: Vercel Functions + Vercel Cron + Marketplace Postgres

Cloudflare D1 생성·마이그레이션·Git 빌드 변수 설정은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

## Reference

제품 구조를 검토할 때 [whchoi98/youtube-trend](https://github.com/whchoi98/youtube-trend)를 참고했으며, 코드와 브랜드는 별도로 구현했습니다.
