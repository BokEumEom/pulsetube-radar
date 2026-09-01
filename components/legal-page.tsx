import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "./site-footer";

type LegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function LegalPage({ eyebrow, title, description, children }: LegalPageProps) {
  return (
    <div className="legal-app">
      <header className="legal-header">
        <Link className="legal-brand" href="/" aria-label="PulseTube Radar 홈">
          <i aria-hidden="true">↗</i>
          <span><b>PULSETUBE</b><small>RADAR</small></span>
        </Link>
        <nav aria-label="정책 페이지">
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/terms">이용약관</Link>
          <Link href="/contact">문의</Link>
        </nav>
      </header>
      <main className="legal-main">
        <div className="legal-title">
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <article className="legal-content">{children}</article>
      </main>
      <SiteFooter status="YouTube 트렌드의 초기 가속 신호를 설명하는 데이터 서비스" />
    </div>
  );
}
