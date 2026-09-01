import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "개인정보처리방침 | PulseTube Radar",
  description: "PulseTube Radar의 개인정보 및 쿠키 처리 기준입니다.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="PRIVACY"
      title="개인정보처리방침"
      description="PulseTube Radar가 어떤 정보와 외부 서비스를 사용하는지 투명하게 안내합니다."
    >
      <p className="legal-date">시행일: 2026년 9월 1일</p>

      <section>
        <h2>1. 서비스와 처리 원칙</h2>
        <p>PulseTube Radar는 YouTube의 공개 인기 영상 데이터를 분석해 순위, 조회 속도, 초기 상승 신호를 제공하는 서비스입니다. 회원가입이나 로그인을 요구하지 않으며, 이용자의 YouTube 계정 정보에 접근하지 않습니다.</p>
      </section>

      <section>
        <h2>2. 처리되는 정보</h2>
        <ul>
          <li><b>서비스 설정:</b> 선택한 화면 테마와 분석 국가는 브라우저의 로컬 저장소에 보관됩니다.</li>
          <li><b>접속 정보:</b> 안정적인 서비스 제공과 보안을 위해 IP 주소, 브라우저·기기 정보, 접속 시각, 요청 URL 등의 서버 로그가 호스팅 사업자에 의해 처리될 수 있습니다.</li>
          <li><b>문의 정보:</b> 이용자가 문의 과정에서 직접 제공한 이름, 이메일 주소 및 문의 내용은 답변을 위해 처리될 수 있습니다.</li>
        </ul>
      </section>

      <section>
        <h2>3. 이용 목적과 보관</h2>
        <p>정보는 서비스 제공, 장애 대응, 보안, 문의 답변을 위해 필요한 범위에서만 사용합니다. 브라우저 설정은 이용자가 직접 삭제할 때까지 해당 기기에 남을 수 있습니다. 문의 정보와 로그는 목적 달성 후 지체 없이 삭제하며, 관련 법령이나 각 인프라 제공자의 정책에 따라 필요한 기간 동안 보관될 수 있습니다.</p>
      </section>

      <section>
        <h2>4. Google AdSense와 쿠키</h2>
        <p>광고가 활성화되면 Google을 포함한 제3자 광고 사업자가 이전 방문 기록을 바탕으로 광고를 제공하기 위해 쿠키를 사용할 수 있습니다. Google과 광고 파트너는 이 사이트 또는 다른 사이트 방문 기록에 기반해 개인 맞춤 광고를 제공할 수 있습니다.</p>
        <p>이용자는 <a href="https://adssettings.google.com/" target="_blank" rel="noreferrer">Google 광고 설정</a>에서 개인 맞춤 광고를 관리하거나 사용 중지할 수 있습니다. Google이 파트너 사이트의 정보를 사용하는 방식은 <a href="https://business.safety.google/privacy/" target="_blank" rel="noreferrer">Google 비즈니스 데이터 책임 사이트</a>에서 확인할 수 있습니다.</p>
        <p>유럽경제지역(EEA), 영국, 스위스 등 동의가 필요한 지역에는 Google AdSense에서 설정한 동의 관리 플랫폼(CMP)을 통해 광고 쿠키와 개인 맞춤 광고에 대한 선택권을 제공합니다.</p>
      </section>

      <section>
        <h2>5. 외부 서비스</h2>
        <ul>
          <li><b>YouTube Data API v3:</b> 공개 인기 영상과 관련 메타데이터 조회</li>
          <li><b>Cloudflare:</b> 웹 호스팅, 보안, 네트워크 및 데이터 저장</li>
          <li><b>Google AdSense:</b> 설정 완료 후 광고 제공과 성과 측정</li>
        </ul>
        <p>각 사업자가 독립적으로 처리하는 정보에는 해당 사업자의 개인정보처리방침이 적용됩니다.</p>
      </section>

      <section>
        <h2>6. 이용자의 선택과 권리</h2>
        <p>브라우저 설정에서 쿠키와 로컬 저장소를 삭제하거나 차단할 수 있습니다. 문의 과정에서 제공한 정보의 열람, 정정 또는 삭제를 원할 경우 <Link href="/contact">문의 페이지</Link>를 통해 요청할 수 있습니다. 쿠키를 차단하면 일부 광고 또는 설정 저장 기능이 정상적으로 동작하지 않을 수 있습니다.</p>
      </section>

      <section>
        <h2>7. 방침의 변경</h2>
        <p>사용하는 기능이나 법적 요구사항이 달라지면 이 방침을 변경할 수 있습니다. 중요한 변경은 시행 전에 서비스 내에서 알리며, 최신 시행일을 이 페이지에 표시합니다.</p>
      </section>
    </LegalPage>
  );
}
