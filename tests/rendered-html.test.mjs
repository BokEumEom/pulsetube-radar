import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("injects verified AdSense configuration and serves ads.txt", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("adsense-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = {
    ADSENSE_PUBLISHER_ID: "ca-pub-1234567890123456",
    ADSENSE_FEED_SLOT_ID: "1234567890",
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  };
  const context = {
    waitUntil() {},
    passThroughOnException() {},
  };

  const pageResponse = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    env,
    context,
  );
  const html = await pageResponse.text();
  assert.equal(pageResponse.status, 200);
  assert.match(html, /data-adsense-client="ca-pub-1234567890123456"/);
  assert.match(html, /data-adsense-feed-slot="1234567890"/);
  assert.match(html, /name="google-adsense-account" content="ca-pub-1234567890123456"/);
  assert.match(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);

  const adsResponse = await worker.fetch(new Request("http://localhost/ads.txt"), env, context);
  assert.equal(adsResponse.status, 200);
  assert.equal(
    await adsResponse.text(),
    "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n",
  );
});
