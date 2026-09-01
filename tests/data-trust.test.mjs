import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("keeps freshness compact and exposes detailed provenance on demand", () => {
  assert.match(page, /aria-label="데이터 신뢰 정보"/);
  assert.match(page, /data-status-trigger/);
  assert.match(page, /DataStatusAlert/);
  assert.match(page, /YouTube Data API v3/);
  assert.match(page, /분석 범위/);
  assert.match(page, /스냅샷 기준 시각/);
  assert.match(page, /D1 이력 저장 활성/);
  assert.match(page, /ageMinutes <= 30/);
  assert.match(page, /ageMinutes <= 120/);
  assert.match(css, /\.data-status-popover/);
  assert.match(css, /\.data-status-trigger/);
  assert.match(css, /position:fixed!important/);
  assert.doesNotMatch(css, /\.data-trust/);
});

test("labels whether trending data came directly from YouTube or a D1 snapshot", () => {
  assert.match(worker, /dataOrigin: "youtube_api" \| "d1_snapshot"/);
  assert.match(worker, /"d1_snapshot"/);
  assert.match(worker, /"youtube_api"/);
});
