// 카드 카탈로그 (v2 확정) — 카드 1종 = 이북 페이지 1장
export type CardGroup = 'frame' | 'model' | 'extra' | 'viz'
export interface CardField { key: string; label: string; example?: string; textarea?: boolean }
export interface CardDef {
  key: string
  group: CardGroup
  label: string
  title: string
  kind?: 'cover' | 'back' | 'toc'
  viz?: 'flow' | 'mindmap' | 'sticky' | 'board'
  kpi?: boolean
  fields: CardField[]
}

const f = (key: string, label: string, example = ''): CardField => ({ key, label, example })

export const CARD_REGISTRY: CardDef[] = [
  { key: 'cover', group: 'frame', label: '표지', title: '유니에버 AX 사업모델', kind: 'cover',
    fields: [f('title', '제목', '유니에버 AX 사업모델'), f('sub', '부제', '2026 경영보고')] },
  { key: 'toc', group: 'frame', label: '목차(자동)', title: '목차', kind: 'toc', fields: [] },
  { key: 'closing', group: 'frame', label: '마무리', title: '함께 시작합시다', kind: 'back',
    fields: [f('title', '한 줄 메시지', '지금이 가장 잘 시작할 수 있는 때입니다'), f('sub', '연락/링크(선택)')] },

  { key: 'value_prop', group: 'model', label: '가치 제안', title: '가치 제안',
    fields: [f('title', '제목', '현장 데이터로 품질을 바꿉니다'), f('p1', '핵심 문구 1', '불량 원인을 실시간 추적'), f('p2', '핵심 문구 2', '검사 인력 30% 절감'), f('p3', '핵심 문구 3', '품질 사고 사전 예방')] },
  { key: 'customer', group: 'model', label: '고객군', title: '고객군',
    fields: [f('title', '제목', '고객군'), f('p1', '대상 고객', '중견 제조기업 품질팀'), f('p2', '특징', '수기 검사 비중이 높은 현장')] },
  { key: 'revenue', group: 'model', label: '수익원', title: '수익 구조',
    fields: [f('title', '제목', '수익 구조'), f('p1', '항목 1', '월 구독 (SaaS)'), f('p2', '항목 2', '구축·컨설팅')] },
  { key: 'channel', group: 'model', label: '채널', title: '채널',
    fields: [f('title', '제목', '채널'), f('p1', '채널 1', '직접 영업'), f('p2', '채널 2', '파트너 리셀러')] },
  { key: 'resource', group: 'model', label: '핵심 자원', title: '핵심 자원',
    fields: [f('title', '제목', '핵심 자원'), f('p1', '자원 1', '품질 AI 엔진'), f('p2', '자원 2', '현장 데이터셋')] },
  { key: 'activity', group: 'model', label: '핵심 활동', title: '핵심 활동',
    fields: [f('title', '제목', '핵심 활동'), f('p1', '활동 1', '모델 학습·튜닝'), f('p2', '활동 2', '현장 도입 지원')] },
  { key: 'partner', group: 'model', label: '핵심 파트너', title: '핵심 파트너',
    fields: [f('title', '제목', '핵심 파트너'), f('p1', '파트너·역할', '설비사 — 데이터 연동')] },
  { key: 'relation', group: 'model', label: '고객 관계', title: '고객 관계',
    fields: [f('title', '제목', '고객 관계'), f('p1', '방식', '전담 성공 매니저')] },
  { key: 'cost', group: 'model', label: '비용 구조', title: '비용 구조',
    fields: [f('title', '제목', '비용 구조'), f('p1', '항목 1', 'R&D 인건비'), f('p2', '항목 2', '클라우드')] },

  { key: 'summary', group: 'extra', label: '한 줄 요약', title: '핵심 요약',
    fields: [f('title', '제목', '핵심 요약'), { key: 'body', label: '한 문장', example: '현장 데이터로 품질을 바꾸는 AX 사업', textarea: true }] },
  { key: 'kpi', group: 'extra', label: '성과·KPI', title: '기대 성과', kpi: true,
    fields: [f('title', '제목', '기대 성과'), f('k1', '지표 1 (이름:값)', '불량률:-30%'), f('k2', '지표 2', '검사시간:-40%'), f('k3', '지표 3', 'ROI:14개월')] },
  { key: 'roadmap', group: 'extra', label: '로드맵', title: '로드맵',
    fields: [f('title', '제목', '로드맵'), f('p1', '단계 (이름:시기)', 'PoC : 1분기'), f('p2', '단계', '확산 : 3분기')] },
  { key: 'market', group: 'extra', label: '시장·경쟁', title: '시장과 경쟁',
    fields: [f('title', '제목', '시장과 경쟁'), f('p1', '시장 한 줄', '국내 품질SW 3천억'), f('p2', '우위', '현장 특화 데이터')] },

  { key: 'flow', group: 'viz', label: '프로세스(플로우)', title: '도입 프로세스', viz: 'flow',
    fields: [f('title', '제목', '도입 프로세스'), f('s1', '단계 1', '데이터 연결'), f('s2', '단계 2', 'AI 학습'), f('s3', '단계 3', '현장 적용'), f('s4', '단계 4 (선택)', '성과 검증')] },
  { key: 'mindmap', group: 'viz', label: '마인드맵', title: 'AX 추진 영역', viz: 'mindmap',
    fields: [f('title', '제목', 'AX 추진 영역'), f('center', '중심 주제', '유니에버 AX'), f('b1', '가지 1', '품질'), f('b2', '가지 2', '생산'), f('b3', '가지 3', '물류'), f('b4', '가지 4 (선택)', '경영정보'), f('b5', '가지 5 (선택)')] },
  { key: 'sticky', group: 'viz', label: '스티키 메모', title: '아이디어 메모', viz: 'sticky',
    fields: [f('title', '제목', '아이디어 메모'), f('n1', '메모 1', '현장 니즈 인터뷰'), f('n2', '메모 2', 'PoC 대상 라인'), f('n3', '메모 3', 'ROI 계산'), f('n4', '메모 4 (선택)')] },
  { key: 'board', group: 'viz', label: '자유 메모 보드', title: '자유 보드', viz: 'board',
    fields: [f('title', '제목', '자유 보드'), f('n1', '메모 1', '핵심 가설'), f('n2', '메모 2', '리스크'), f('n3', '메모 3', '다음 액션'), f('n4', '메모 4', '질문'), f('n5', '메모 5 (선택)'), f('n6', '메모 6 (선택)')] },
]

export const cardByKey = (key: string) => CARD_REGISTRY.find((c) => c.key === key)
