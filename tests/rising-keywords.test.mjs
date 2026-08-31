import assert from "node:assert/strict";
import test from "node:test";

import { extractKeywordTokens } from "../worker/keyword-metrics.ts";

test("extracts normalized title and tag keywords without generic video terms", () => {
  const tokens = extractKeywordTokens(
    "Official Video: 새로운 게임 챌린지",
    JSON.stringify(["게임", "챌린지", "YouTube"]),
  );

  assert.ok(tokens.includes("게임"));
  assert.ok(tokens.includes("챌린지"));
  assert.equal(tokens.filter((token) => token === "챌린지").length, 1);
  assert.ok(!tokens.includes("official"));
  assert.ok(!tokens.includes("video"));
  assert.ok(!tokens.includes("youtube"));
});

test("segments Japanese titles into usable word tokens", () => {
  const tokens = extractKeywordTokens("新しいアニメ予告編を公開", "[]");

  assert.ok(tokens.some((token) => token.includes("アニメ")));
  assert.ok(!tokens.includes("公開"));
});
