import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseTube Radar",
  description: "YouTube 인기 영상의 순위·속도·카테고리 흐름을 읽는 트렌드 레이더",
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
