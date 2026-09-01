import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "이용약관 | PulseTube Radar",
  description: "PulseTube Radar의 서비스 이용 조건입니다.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="TERMS"
      title="이용약관"
      description="데이터 기반 트렌드 서비스를 이용할 때 알아야 할 기본 조건입니다."
    >
      <p className="legal-date">시행일: 2026년 9월 1일</p>

      <section>
        <h2>1. 목적</h2>
        <p>이 약관은 PulseTube Radar가 제공하는 YouTube 트렌드 분석 서비스의 이용 조건과 서비스 및 이용자의 권리·책임을 정합니다.</p>
      </section>

      <section>
        <h2>2. 제공하는 서비스</h2>
        <p>서비스는 YouTube Data API의 공개 데이터와 시간대별 수집 이력을 바탕으로 인기 순위, 조회 속도, 키워드 및 초기 상승 신호를 제공합니다. 기능과 분석 기준은 운영상 필요에 따라 추가, 변경 또는 중단될 수 있습니다.</p>
      </section>

      <section>
        <h2>3. 데이터의 성격</h2>
        <ul>
          <li>화면의 수치는 특정 스냅샷과 규칙 기반 계산 결과이며 실시간 상황과 차이가 날 수 있습니다.</li>
          <li>초기 상승 신호와 점수는 향후 성과를 보장하는 예측이나 추천이 아닙니다.</li>
          <li>이용자는 중요한 의사결정 전에 원본 영상과 공식 정보를 직접 확인해야 합니다.</li>
        </ul>
      </section>

      <section>
        <h2>4. 이용자의 의무</h2>
        <p>이용자는 관련 법령과 이 약관을 준수해야 하며, 서비스의 정상 운영을 방해하는 자동화 요청, 보안 우회, 데이터의 오인 유도 또는 제3자의 권리를 침해하는 방식으로 서비스를 이용해서는 안 됩니다.</p>
      </section>

      <section>
        <h2>5. 콘텐츠와 권리</h2>
        <p>YouTube 영상, 썸네일, 채널명 등 제3자 콘텐츠의 권리는 각 권리자에게 있습니다. PulseTube Radar의 자체 UI, 분석 방식, 설명 문구와 브랜드 자산은 관련 법률에 따라 보호됩니다. 서비스는 YouTube 또는 Google이 운영하거나 보증하는 공식 서비스가 아닙니다.</p>
      </section>

      <section>
        <h2>6. 외부 링크와 광고</h2>
        <p>서비스에는 YouTube를 비롯한 외부 사이트 링크와 제3자 광고가 포함될 수 있습니다. 외부 사이트의 콘텐츠, 거래, 개인정보 처리 및 광고 내용은 해당 사업자의 정책과 책임에 따릅니다.</p>
      </section>

      <section>
        <h2>7. 서비스의 변경과 책임 범위</h2>
        <p>유지보수, 외부 API 제한, 네트워크 장애 또는 불가항력으로 서비스가 일시 중단될 수 있습니다. 운영자는 합리적인 범위에서 서비스의 안정성과 데이터 정확성을 높이기 위해 노력하지만, 법령이 허용하는 범위에서 데이터의 완전성이나 특정 목적 적합성을 보증하지 않습니다.</p>
      </section>

      <section>
        <h2>8. 약관의 변경과 문의</h2>
        <p>약관이 변경되면 시행일과 주요 변경 내용을 서비스에 알립니다. 약관 또는 서비스 이용에 관한 사항은 <Link href="/contact">문의 페이지</Link>를 이용해 주세요.</p>
      </section>
    </LegalPage>
  );
}
