// 백화점 매장 일일운영 체크리스트 — 구분/항목/응답 옵션 정의 (매장 작성 · 본사 조회 공용)
export const DAILY_CHECKLIST = [
  { cat: '매출', icon: '📈', items: [
    { label: '오늘 매출 목표 달성률', options: ['120% 이상', '100~119%', '80~99%', '80% 미만'] },
    { label: '전일 대비 매출', options: ['증가', '동일', '감소'] },
    { label: '오늘 매장 분위기', options: ['매우 좋음', '보통', '저조'] },
  ]},
  { cat: '고객관리', icon: '👥', items: [
    { label: '신규 고객 방문', options: ['없음', '1~3명', '4명 이상'] },
    { label: '단골 고객 방문', options: ['없음', '1~3명', '4명 이상'] },
    { label: '신규 회원 가입', options: ['없음', '1명', '2명 이상'] },
    { label: '고객관리(전화·문자·카톡)', options: ['미실시', '1~5명', '6명 이상'] },
  ]},
  { cat: '시음·전단지', icon: '🥤', items: [
    { label: '시음 진행 여부', options: ['진행', '미진행'] },
    { label: '고객 반응', options: ['좋음', '보통', '저조'] },
    { label: '시음 후 구매', options: ['없음', '1~2건', '3건 이상'] },
    { label: '전단지 배포', options: ['못했음', '10장 이상', '30장 이상'] },
    { label: '전단지 상품 구매', options: ['없음', '2개 이상', '5개 이상'] },
  ]},
  { cat: '재고관리', icon: '📦', items: [
    { label: '품절 상품 발생', options: ['없음', '있음'] },
    { label: '품절 임박 상품', options: ['없음', '있음'] },
    { label: '발주 필요 상품', options: ['없음', '있음'] },
  ]},
  { cat: '경쟁사', icon: '🏬', items: [
    { label: '경쟁사 행사 진행', options: ['없음', '있음'] },
    { label: '경쟁사 신제품 확인', options: ['없음', '있음'] },
    { label: '가격 변동 확인', options: ['없음', '있음'] },
  ]},
  { cat: '운영관리', icon: '🛠️', items: [
    { label: '클레임 발생', options: ['없음', '있음'] },
    { label: '내일 운영 이슈', options: ['없음', '있음'] },
  ]},
];

// 전체 항목 라벨(순서대로) — answers는 { 라벨: 선택응답 } 형태 jsonb로 저장
export const CHECKLIST_ITEMS = DAILY_CHECKLIST.flatMap(c => c.items.map(i => i.label));

// '있음'/'저조'/'감소' 등 주의가 필요한 응답(본사 조회 강조용)
export const ATTENTION_ANSWERS = new Set(['있음', '저조', '감소', '80% 미만', '미진행', '못했음', '미실시']);
