import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const context = {
  waitUntil() {},
  passThroughOnException() {},
};

test("exposes the eight featured YouTube categories", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/api/youtube/categories"),
    {},
    context,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.region, "KR");
  assert.deepEqual(
    body.categories.map((category) => category.id),
    ["10", "20", "24", "25", "17", "1", "28", "23"],
  );
});

test("exposes Japan and the United States as selectable YouTube regions", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/api/youtube/categories?region=JP"),
    {},
    context,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.region, "JP");
  assert.deepEqual(
    body.regions.map((region) => region.code),
    ["KR", "JP", "US"],
  );
});

test("rejects unsupported regions before calling YouTube", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/api/youtube/trending?region=GB"),
    { YT_API_KEY: "test-key" },
    context,
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.code, "invalid_region");
});

test("rejects unsupported category ids before calling YouTube", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/api/youtube/trending?category=999"),
    { YT_API_KEY: "test-key" },
    context,
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.code, "invalid_category");
});

test("keeps D1 analytics endpoints explicit when storage is not connected", async () => {
  for (const path of [
    "/api/youtube/history?videoId=abcdefghijk&hours=168&region=JP",
    "/api/youtube/category-trends?hours=168&region=US",
    "/api/youtube/churn?hours=168&region=JP",
    "/api/youtube/storage-status?region=US",
    "/api/youtube/collector-status",
  ]) {
    const response = await worker.fetch(
      new Request(`http://localhost${path}`),
      {},
      context,
    );
    const body = await response.json();
    assert.equal(response.status, 503, path);
    assert.equal(body.code, "storage_unavailable", path);
  }
});

test("rejects writes to read-only analytics endpoints", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/api/youtube/churn", { method: "POST" }),
    {},
    context,
  );
  const body = await response.json();

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET");
  assert.equal(body.code, "method_not_allowed");
});

test("scheduled collection is a safe no-op until D1 and the API key exist", async () => {
  let waitUntilCalls = 0;
  await worker.scheduled(
    { scheduledTime: Date.now(), cron: "*/15 * * * *" },
    {},
    {
      ...context,
      waitUntil() {
        waitUntilCalls += 1;
      },
    },
  );

  assert.equal(waitUntilCalls, 0);
});
