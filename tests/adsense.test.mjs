import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("keeps the only manual ad after channel discovery and outside signal views", async () => {
  const page = await readFile(`${root}/app/page.tsx`, "utf8");
  const adMatches = page.match(/<FeedAdSlot\s*\/>/g) ?? [];
  const channelPosition = page.indexOf("<ChannelStrip");
  const adPosition = page.indexOf("<FeedAdSlot");
  const rowsPosition = page.indexOf("shownRows.map", adPosition);

  assert.equal(adMatches.length, 1);
  assert.ok(channelPosition > -1 && channelPosition < adPosition);
  assert.ok(rowsPosition > adPosition);
  assert.doesNotMatch(page.slice(page.indexOf("function EarlySignalsView"), page.indexOf("function RisingKeywordsView")), /FeedAdSlot/);
});

test("publishes the review pages and required advertising disclosures", async () => {
  const [privacy, terms, contact, footer] = await Promise.all([
    readFile(`${root}/app/privacy/page.tsx`, "utf8"),
    readFile(`${root}/app/terms/page.tsx`, "utf8"),
    readFile(`${root}/app/contact/page.tsx`, "utf8"),
    readFile(`${root}/components/site-footer.tsx`, "utf8"),
  ]);

  assert.match(privacy, /Google AdSense와 쿠키/);
  assert.match(privacy, /adssettings\.google\.com/);
  assert.match(privacy, /동의 관리 플랫폼\(CMP\)/);
  assert.match(terms, /데이터의 성격/);
  assert.match(contact, /pulsetube-radar\/issues\/new/);
  assert.match(footer, /href="\/privacy"/);
  assert.match(footer, /href="\/terms"/);
  assert.match(footer, /href="\/contact"/);
});
