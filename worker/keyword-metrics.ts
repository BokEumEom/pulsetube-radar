const KEYWORD_STOPWORDS = new Set([
  "official", "video", "music", "audio", "lyrics", "lyric", "shorts", "short",
  "live", "full", "clip", "episode", "part", "feat", "with", "from", "the", "and",
  "mv", "m/v", "teaser", "trailer", "youtube", "new", "ver", "version",
  "영상", "공개", "최초", "오늘", "지금", "라이브", "공식", "뮤직비디오", "예고편",
  "ショート", "公式", "動画", "公開", "ライブ",
]);

const parseKeywordTags = (value: string) => {
  try {
    const tags = JSON.parse(value);
    return Array.isArray(tags)
      ? tags.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
};

export const extractKeywordTokens = (title: string, tagsJson: string) => {
  const source = `${title} ${parseKeywordTags(tagsJson).join(" ")}`
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/gi, " ");
  const segmenter = new Intl.Segmenter(["ko", "ja", "en"], { granularity: "word" });
  const tokens = [...segmenter.segment(source)]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment.toLocaleLowerCase())
    .map((token) => token.replace(/^[_-]+|[_-]+$/g, ""))
    .filter((token) => token.length >= 2 && token.length <= 28)
    .filter((token) => !/^\d+$/.test(token) && !KEYWORD_STOPWORDS.has(token));
  return [...new Set(tokens)];
};
