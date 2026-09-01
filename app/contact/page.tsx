import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "문의 | PulseTube Radar",
  description: "PulseTube Radar의 데이터, 광고, 오류 및 개인정보 관련 문의 안내입니다.",
};

export default function ContactPage() {
  return (
    <LegalPage
      eyebrow="CONTACT"
      title="문의"
      description="데이터 오류, 기능 제안, 광고 및 개인정보 관련 요청을 보내주세요."
    >
      <section className="contact-lead">
        <span>PRIMARY CONTACT</span>
        <h2>GitHub Issues</h2>
        <p>재현 가능한 오류와 기능 제안은 공개 이슈로 남기면 확인하기 쉽습니다.</p>
        <a className="contact-action" href="https://github.com/BokEumEom/pulsetube-radar/issues/new" target="_blank" rel="noreferrer">새 문의 작성 ↗</a>
      </section>

      <section>
        <h2>문의할 때 포함하면 좋은 정보</h2>
        <ul>
          <li>확인한 국가, 카테고리, 영상 또는 키워드</li>
          <li>문제가 발생한 날짜와 시각</li>
          <li>기대했던 결과와 실제 표시된 결과</li>
          <li>가능한 경우 화면 캡처와 재현 순서</li>
        </ul>
      </section>

      <section>
        <h2>개인정보 관련 요청</h2>
        <p>정보 열람, 정정 또는 삭제 요청은 공개 이슈 본문에 개인정보를 적지 말고, 먼저 요청 유형만 남겨 비공개 연락 방법을 안내받아 주세요. 문의에 비밀번호, API 키, 결제 정보 등 민감한 정보를 포함하지 마세요.</p>
      </section>

      <section>
        <h2>영상과 채널 콘텐츠</h2>
        <p>영상 자체의 저작권, 삭제 또는 신고는 해당 YouTube 영상과 채널의 공식 절차를 이용해야 합니다. PulseTube Radar 화면의 데이터 연결이나 표시 오류는 서비스 문의로 남길 수 있습니다.</p>
      </section>
    </LegalPage>
  );
}
