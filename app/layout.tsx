import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pulsetube-radar.bokmail83.workers.dev"),
  title: "PulseTube Radar",
  description: "YouTube 인기 영상의 순위·속도·카테고리 흐름을 읽는 트렌드 레이더",
  openGraph: {
    title: "PulseTube Radar",
    description: "이미 뜬 영상이 아니라, 지금 뜨기 시작하는 신호를 찾습니다.",
    type: "website",
    locale: "ko_KR",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head><meta name="codex-preview" content="development" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
