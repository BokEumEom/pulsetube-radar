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
