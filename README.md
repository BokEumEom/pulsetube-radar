# PulseTube Radar

YouTube 인기 영상의 **순위, 상승 속도, 신규 진입, 카테고리 점유율**을 한 화면에서 탐색하는 트렌드 레이더입니다.

## 주요 기능

- 히어로형 실시간 트렌드 피드
- TOP 10, 시간당 조회수 급증, 신규 진입, AI 추천 행
- 영상별 순위·조회수 시계열
- 카테고리 점유율과 진입·이탈 분석
- 취향 퀴즈와 10종 컬러 테마
- 데스크톱·모바일 반응형 UI

현재 기본 데이터는 제품 검토를 위한 샘플 스냅샷입니다. 운영 환경에서는 YouTube Data API v3, 예약 수집기, D1 또는 Postgres를 연결합니다.

## 로컬 실행

```bash
npm ci
npm run dev
```

## 검증

```bash
npm run lint
npm run build
```

## 배포

AWS 없이 운영하는 두 가지 구성을 지원 대상으로 둡니다.

- 권장: Cloudflare Workers + D1 + Cron Triggers
- 대안: Vercel Functions + Vercel Cron + Marketplace Postgres

자세한 데이터 모델과 수집 흐름은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

## Reference

제품 구조를 검토할 때 [whchoi98/youtube-trend](https://github.com/whchoi98/youtube-trend)를 참고했으며, 코드와 브랜드는 별도로 구현했습니다.

