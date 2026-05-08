// ════════════════════════════════════════════════════════
// 점포/지점 목록
// ════════════════════════════════════════════════════════
export const STORE_MAP = {
  '롯데백화점':    ['건대시티점','천호점','영등포점','관악점','센텀시티점','부산본점','강남점','잠실점','노원점','청량리점','본점','인천점','광주점','울산점','포항점','광복점','구리점','대전점','동래점','미아점','일산점','기타'],
  '신세계백화점':  ['강남점','본점','마산점','센텀시티점','광주점','충청점','경기점','하남점','기타'],
  '현대백화점':    ['더현대서울점','목동점','무역센터점','천호점','신촌점','압구정본점','판교점','대구점','울산점','충청점','기타'],
  'AK백화점':     ['평택점','수원점','분당점','원주점','홍대점','기타'],
  '갤러리아백화점': ['명품관','타임월드점','센터시티점','광교점','진주점','기타'],
  '그린푸드':     ['그린푸드'],
  '농협_SHOP':   ['농협_SHOP'],
  '대동백화점':   ['대동백화점'],
  '특판':        ['특판'],
};
export const STORE_NAMES = Object.keys(STORE_MAP);

// ════════════════════════════════════════════════════════
// 안전재고 엑셀 파싱 상수
// ════════════════════════════════════════════════════════
export const SC = { DEPT:1, STORE:2, CODE:3, NAME:4, STOCK:14, SALES:32 };
export const S_DATA_START = 10;
export const S_PERIOD_ROW = 2;

// ════════════════════════════════════════════════════════
// 회원 등급 테이블
// ════════════════════════════════════════════════════════
export const GRADE_TABLE = [
  { grade:'VVIP',   min:10000000, rate:0.07, color:'#6a1b9a', bg:'#f3e5f5' },
  { grade:'VIP',    min:3000000,  rate:0.06, color:'#c62828', bg:'#ffebee' },
  { grade:'로얄',   min:1000000,  rate:0.05, color:'#1565C0', bg:'#e3f2fd' },
  { grade:'골드',   min:300000,   rate:0.04, color:'#E65100', bg:'#fff3e0' },
  { grade:'실버',   min:100000,   rate:0.03, color:'#455a64', bg:'#eceff1' },
  { grade:'패밀리', min:0,        rate:0.02, color:'#2e7d32', bg:'#e8f5e9' },
];

// ════════════════════════════════════════════════════════
// 사이드바 메뉴
// ════════════════════════════════════════════════════════
export const HQ_MENUS = [
  { key: 'product_mgmt', icon: '🛍️', label: '상품관리', sub: [
    { key: 'product_add', icon: '➕', label: '상품추가' },
  ]},
  { key: 'stock_mgmt', icon: '📦', label: '재고관리', sub: [
    { key: 'stock_center', icon: '🏭', label: '센터재고' },
    { key: 'stock_store',  icon: '🏬', label: '매장재고' },
    { key: 'purchase_hq',  icon: '📋', label: '발주관리' },
  ]},
  { key: 'store_info',     icon: '📍', label: '매장 정보' },
  { key: 'incentive',      icon: '💰', label: '급여관리' },
  { key: 'attendance_mgmt',icon: '🗓️', label: '근태관리' },
  { key: 'member_mgmt', icon: '👥', label: '고객관리', sub: [
    { key: 'member_mgmt',   icon: '🔍', label: '회원 조회' },
    { key: 'sms_history',   icon: '📨', label: '문자 내역' },
  ]},
  { key: 'sales_view',     icon: '📋', label: '매출조회' },
];
export const MANAGER_MENUS = [
  { key: 'home',           icon: '🏠', label: '홈 대시보드' },
  { key: 'sales_input',    icon: '🛒', label: '판매 입력' },
  { key: 'mgr_sales_view', icon: '📊', label: '매출 조회' },
  { key: 'sales_return',   icon: '↩️', label: '반품 접수' },
  { key: 'customer_reg',   icon: '👤', label: '회원 관리', sub: [
    { key: 'customer_qr',  icon: '📱', label: 'QR 가입' },
    { key: 'customer_doc', icon: '📝', label: '서류 가입' },
    { key: 'my_members',   icon: '📋', label: '회원 목록' },
  ]},
  { key: 'stock_mgmt_mgr', icon: '📦', label: '재고 관리', sub: [
    { key: 'stock_mgr_view', icon: '📊', label: '재고 현황' },
    { key: 'stock_request',  icon: '📋', label: '재고 요청' },
    { key: 'purchase_check', icon: '📋', label: '발주 확인' },
  ]},
  { key: 'attendance',     icon: '🗓️', label: '근태 관리', sub: [
    { key: 'my_attendance', icon: '📊', label: '근무 현황' },
    { key: 'leave_plan',    icon: '📅', label: '휴무 신청' },
  ]},
];
export const ADMIN_MENUS = [
  { key: 'admin',  icon: '🔐', label: '사용자 관리' },
  { key: 'notice', icon: '📢', label: '공지 사항' },
];
