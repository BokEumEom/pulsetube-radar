import Link from "next/link";

type SiteFooterProps = {
  status?: string;
};

export function SiteFooter({ status }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <span>PULSETUBE RADAR</span>
        {status && <p>{status}</p>}
      </div>
      <nav aria-label="서비스 정책">
        <Link href="/privacy">개인정보처리방침</Link>
        <Link href="/terms">이용약관</Link>
        <Link href="/contact">문의</Link>
      </nav>
    </footer>
  );
}
