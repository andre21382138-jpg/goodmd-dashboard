import React, { useState, useRef } from 'react';
import GuideTour from './GuideTour';
import AdminTab from '../admin/AdminTab';
import ManagerMgmtPage from '../admin/ManagerMgmtPage';
import HomePage from '../home/HomePage';
import ProductMgmtPage from '../product/ProductMgmtPage';
import StoreStockPage from '../stock/StoreStockPage';
import StockRequestPage from '../stock/StockRequestPage';
import IncentivePage from '../salary/IncentivePage';
import AttendanceMgmtPage from '../attendance/AttendanceMgmtPage';
import MyAttendancePage from '../attendance/MyAttendancePage';
import CustomerLookupPage from '../customer/CustomerLookupPage';
import CustomerDocPage from '../customer/CustomerDocPage';
import CustomerQRPage from '../customer/CustomerQRPage';
import ConsentRenewMgrPage from '../customer/ConsentRenewMgrPage';
import SalesListPage from '../sales/SalesListPage';
import BizSalesPage from '../sales/BizSalesPage';
import LectureSalesPage from '../sales/LectureSalesPage';
import SalesInputPage from '../sales/SalesInputPage';
import NoticePage from '../notice/NoticePage';

export default function HelpPage({ profile }) {
  const isAdmin   = profile?.role === 'admin';
  const isHQ      = profile?.job_title === '담당자';
  const isManager = profile?.job_title === '매니저';

  const canHQ = isAdmin || isHQ;  // 본사 사용안내 열람 가능 (매장 로그인은 불가)
  const [cat,     setCat]     = useState(null);  // null | 'hq' | 'store'
  const [selMenu, setSelMenu] = useState(null);  // 따라하기 실행 중인 메뉴 key
  const [tourOn,  setTourOn]  = useState(false);
  const contentRef = useRef(null);

  const MENUS = {
    admin: [
      { key:'user_mgmt',   icon:'👥', label:'사용자 관리' },
      { key:'notice',      icon:'📢', label:'공지사항' },
      { key:'manager_mgmt',icon:'👔', label:'매니저 현황' },
    ],
    hq: [
      { key:'home',          icon:'🏠', label:'홈 대시보드' },
      { key:'product_mgmt',  icon:'🛍️', label:'상품관리' },
      { key:'stock',         icon:'📦', label:'매장재고' },
      { key:'salary',        icon:'💰', label:'급여관리' },
      { key:'attendance',    icon:'🗓️', label:'근태관리' },
      { key:'member_mgmt',   icon:'👥', label:'고객관리' },
      { key:'sales_store',   icon:'🏬', label:'매장 매출' },
      { key:'sales_biz',     icon:'🤝', label:'특판 매출' },
      { key:'sales_lecture', icon:'🎓', label:'강좌 매출' },
    ],
    manager: [
      { key:'sales_input',   icon:'🛒', label:'판매 입력' },
      { key:'stock_mgr_view',icon:'📊', label:'재고 현황' },
      { key:'stock_req',     icon:'📋', label:'재고 요청' },
      { key:'member_reg',    icon:'👤', label:'회원 관리' },
      { key:'qr',            icon:'📱', label:'QR 회원가입' },
      { key:'attendance_mgr',icon:'🗓️', label:'근태 관리' },
    ],
  };

  // 따라하기 대상은 모두 매장 운영 화면 → 매니저 컨텍스트로 미리보기 렌더
  const previewProfile = { ...profile, job_title: '매니저', role: 'user' };

  const DETAILS = {
    user_mgmt: {
      icon:'👥', label:'사용자 관리', desc:'신규 가입 요청을 승인하고 역할을 설정합니다.',
      steps:['사이드바 → 🔐 사용자 관리 클릭','승인 대기 목록에서 [✓ 승인] 클릭 → 즉시 로그인 가능','[관리자로] 버튼으로 관리자 권한 부여 가능'],
      component: <AdminTab profile={previewProfile}/>, previewScale:0.55, previewHeight:420,
    },
    notice: {
      icon:'📢', label:'공지사항', desc:'담당자·매니저 전원에게 공지를 작성합니다.',
      steps:['사이드바 → 📢 공지사항 클릭','[+ 공지사항 작성] 버튼 클릭','제목·내용 입력 → [등록] 클릭'],
      component: <NoticePage profile={previewProfile}/>, previewScale:0.55, previewHeight:380,
    },
    manager_mgmt: {
      icon:'👔', label:'매니저 현황', desc:'전체 매니저 목록을 조회하고 QR 코드를 발급합니다.',
      steps:['사이드바 → 👔 매니저 현황 클릭','[📱 QR] 버튼 클릭 → QR 이미지 팝업 → 인쇄','카운터에 비치 → 고객이 스캔 시 자동 연결'],
      component: <ManagerMgmtPage/>, previewScale:0.55, previewHeight:400,
    },
    home: {
      icon:'🏠', label:'홈 대시보드', desc:'당월 매장/강좌/특판 누적 매출을 한눈에 확인합니다.',
      steps:['매장매출·강좌매출·특판매출 3가지 카드로 분류 표시','우측 상단 통합 총 매출 금액 크게 표시','하단 매장별/강좌별/특판별 상세 현황표 확인'],
      component: <HomePage profile={previewProfile} setPage={()=>{}}/>, previewScale:0.5, previewHeight:500,
    },
    product_mgmt: {
      icon:'🛍️', label:'상품관리', desc:'브랜드와 상품을 등록·조회·수정합니다.',
      steps:['전체상품현황: 상품코드·ERP코드·브랜드·상품명·원가·판매가 조회','검색창에서 상품명·코드로 즉시 검색 가능','[수정] 클릭 → 원가·판매가 직접 수정 후 저장'],
      component: <ProductMgmtPage subPage={null}/>, previewScale:0.52, previewHeight:420,
    },
    stock: {
      icon:'📦', label:'매장재고', desc:'매장별 현재 재고를 조회하고 수정합니다. 판매 시 자동 차감됩니다.',
      steps:['점포·지점 선택 후 해당 매장 재고 조회','품절(0개) → 빨간색 / 5개 이하 → 주황색 ⚠️','[수정] 클릭 → 수량 직접 입력 → [저장] 클릭','판매 입력 완료 시 해당 상품 재고 자동 차감'],
      component: <StoreStockPage profile={previewProfile}/>, previewScale:0.52, previewHeight:420,
    },
    salary: {
      icon:'💰', label:'급여관리', desc:'급여조건·인센티브·급여계산 3개 탭으로 구성됩니다.',
      steps:['급여조건: 소속·직급·급여방법·기본급여 설정','인센티브 → 목표매출달성혜택: 점포별 월 목표 / 전월매출 자동 조회','급여계산: 출근기록 기반 자동 계산 (기본급여 + 회원인센티브)'],
      component: <IncentivePage profile={previewProfile}/>, previewScale:0.52, previewHeight:480,
    },
    attendance: {
      icon:'🗓️', label:'근태관리', desc:'매니저별 출퇴근 기록과 휴무 계획을 관리합니다.',
      steps:['전체 매니저 출퇴근 현황 월별 조회','휴무계획: 매니저가 제출한 다음달 휴무계획 승인/반려','매월 15~20일 미제출 매니저에게 대시보드 알림 자동 표시'],
      component: <AttendanceMgmtPage/>, previewScale:0.52, previewHeight:420,
    },
    member_mgmt: {
      icon:'👥', label:'고객관리', desc:'전체 53,000명 이상의 회원을 조회·관리합니다.',
      steps:['점포/지점/가입일/마케팅동의/등급 필터 조합 가능','[조회] 클릭 → 200명씩 페이지네이션 표시','회원 클릭 → 팝업으로 상세정보·구매이력 즉시 확인'],
      component: <CustomerLookupPage profile={previewProfile}/>, previewScale:0.5, previewHeight:460,
    },
    sales_store: {
      icon:'🏬', label:'매장 매출', desc:'날짜·점포·브랜드·키워드 필터로 매장 판매 내역을 조회합니다.',
      steps:['날짜 빠른선택: 어제 / 당월 / 전월 버튼','점포·지점·브랜드·키워드 필터 조합 후 자동 조회','상단 탭으로 특판매출·강좌매출 바로 이동 가능'],
      component: <SalesListPage setPage={()=>{}}/>, previewScale:0.52, previewHeight:440,
    },
    sales_biz: {
      icon:'🤝', label:'특판 매출', desc:'B2B 특판 업체에 납품한 매출을 입력하고 조회합니다.',
      steps:['[📋 조회] 탭: 월별·업체별 필터로 조회','[➕ 입력] 탭: 날짜·업체·브랜드·상품·수량·공급가 입력','공급가 = 개당 단가 (합계는 수량×공급가 자동 계산)'],
      component: <BizSalesPage profile={previewProfile} setPage={()=>{}}/>, previewScale:0.52, previewHeight:440,
    },
    sales_lecture: {
      icon:'🎓', label:'강좌 매출', desc:'백화점 현장 강좌 매출을 입력하고 조회합니다.',
      steps:['[📋 조회] 탭: 월별·점포별 필터로 조회','[➕ 입력] 탭: 날짜·점포·지점·인원수·매출액·메모 입력','메모 입력칸에서 엔터키로 줄바꿈 가능'],
      component: <LectureSalesPage profile={previewProfile} setPage={()=>{}}/>, previewScale:0.52, previewHeight:440,
    },
    sales_input: {
      icon:'🛒', label:'판매 입력', desc:'매일 판매한 상품을 기록합니다. 회원 적립도 함께 처리합니다.',
      steps:['브랜드 없이 상품명 바로 검색 (검색결과에 브랜드명 표시)','판매가 입력 시 할인금액 자동 계산','회원 없음 / 기존회원 검색 / 신규회원 등록 선택','저장 시 해당 상품 매장재고 자동 차감'],
      guide:[
        { selector:'sales-scan', title:'① 상품 스캔·검색', body:'바코드로 상품을 스캔하면 상품명 칸에 자동으로 입력됩니다.\n동일 상품을 2번·3번 스캔하면 수량이 2개·3개로 늘어납니다.\n바코드가 없으면 상품명·코드로 직접 검색해 선택합니다.' },
        { selector:'sales-price', title:'② 판매가 입력', body:'정상가·할인금액·판매가를 입력합니다.\n판매가를 입력하면 할인금액이 자동으로 계산됩니다.\n증정·시식은 판매가를 0으로 입력합니다.' },
        { selector:'sales-pay', title:'③ 결제방식 선택', body:'카드 / 현금 / 증정 / 시식 중 결제수단을 선택합니다.\n결제수단을 선택하지 않으면 저장되지 않습니다.' },
        { selector:'sales-point', title:'④ 적립금 사용', body:'회원 적립금을 사용할 경우 [💳 적립금 사용]을 누릅니다.\n회원 휴대폰 번호(전체)를 입력해 검색·선택한 뒤, 사용할 금액을 입력합니다.\n결제수단과는 별개의 공제 항목입니다.' },
        { selector:'sales-delivery', title:'⑤ 택배 발송', body:'택배가 필요하면 없음 / 매장발송 / 본사요청 중 선택합니다.\n본사요청은 본사 물류로 발송이 요청됩니다.' },
        { selector:'sales-add', title:'⑥ 상품 추가', body:'여러 상품을 한 번에 판매할 때 [상품추가]로 줄을 늘려 입력합니다.\n각 줄마다 위 과정을 반복합니다.' },
        { selector:'sales-member', title:'⑦ 회원 적립', body:'회원 없음 / 기존 회원 검색 / 신규 회원등록 중 선택합니다.\n기존 회원은 휴대폰 뒷 4자리로 검색해 연결하면 구매액·적립금·등급이 자동 반영됩니다.' },
        { selector:'sales-save', title:'⑧ 저장', body:'모든 줄의 결제수단을 선택한 뒤 [판매 입력 저장]을 누르면,\n매장재고가 자동 차감되고 회원 적립금이 반영됩니다.' },
      ],
      component: <SalesInputPage profile={previewProfile}/>, previewScale:0.52, previewHeight:460,
    },
    stock_mgr_view: {
      icon:'📊', label:'재고 현황', desc:'담당 매장의 현재 재고를 확인합니다.',
      steps:['사이드바 → 📦 재고 관리 → 📊 재고 현황 클릭','본인 매장 재고 자동 표시 (점포/지점 필터 고정)','상품명 또는 코드로 검색 가능','품절(0개) → 빨간색 / 5개 이하 → 주황색 ⚠️ 경고','판매 입력 시 재고 자동 차감'],
      component: <StoreStockPage profile={previewProfile}/>, previewScale:0.55, previewHeight:420,
    },
    stock_req: {
      icon:'📦', label:'발주 요청', desc:'본사에 상품 입고(발주)를 요청합니다.',
      steps:['사이드바 → 📦 발주 요청 클릭','기간 판매량 − 현재고로 발주수량 자동 계산','발주할 상품 체크 → [발주요청] 클릭 → 본사 전달'],
      guide:[
        { selector:'req-add', title:'상품 추가 검색', body:'매장재고에 없는 상품은 여기서 검색해\n발주 목록에 추가할 수 있습니다.' },
        { selector:'req-find', title:'목록에서 찾기', body:'상품명·코드로 목록을 빠르게 찾거나,\n"발주수량 0 숨기기"로 발주할 상품만 볼 수 있습니다.' },
        { selector:'req-table', title:'발주수량 확인', body:'발주수량 = 기간 판매량 − 현재고 로 자동 계산됩니다.\n필요하면 수량을 직접 수정하세요.' },
        { selector:'req-submit', title:'발주요청', body:'발주할 상품을 체크하고 [발주요청]을 누르면 본사로 전송됩니다.\n(수량 0인 상품은 제외됩니다.)' },
      ],
      component: <StockRequestPage profile={previewProfile} demo/>, previewScale:0.52, previewHeight:400,
    },
    member_reg: {
      icon:'📄', label:'서류 가입', desc:'서면 동의서를 받은 회원을 직접 등록합니다.',
      steps:['서류 가입: 이름·연락처·생일·SMS동의 직접 입력','⚠️ 서류 가입 시 반드시 고객에게 마케팅 수신 동의 서면 별도 보관'],
      guide:[
        { selector:'member-form', title:'회원 정보 입력', body:'가입일·이름·연락처는 필수, 생일·성별은 선택입니다.\n생일은 생일 혜택 제공에 활용됩니다.' },
        { selector:'member-consent', title:'마케팅 수신 동의', body:'고객이 서면 동의서에 직접 서명한 경우에만 체크합니다.\n(동의 서류는 매장에서 별도 보관하세요.)' },
        { selector:'member-submit', title:'서류 가입 등록', body:'[서류 가입 등록]을 누르면 회원이 등록되고,\n아래 최근 등록 목록에 바로 표시됩니다.' },
        { selector:'member-recent', title:'최근 등록 확인', body:'최근 등록한 회원 20건을 확인하고,\n잘못 등록한 경우 [삭제]할 수 있습니다.' },
      ],
      component: <CustomerDocPage profile={previewProfile}/>, previewScale:0.52, previewHeight:440,
    },
    qr: {
      icon:'📱', label:'QR 회원가입', desc:'고객이 QR을 스캔하면 자동으로 내 담당 회원으로 등록됩니다.',
      steps:['QR 이미지 출력 후 카운터에 비치','고객이 스마트폰으로 QR 스캔 → 직접 정보 입력 → 자동 등록'],
      guide:[
        { selector:'qr-code', title:'① QR코드 비치', body:'이 QR코드를 인쇄해 카운터에 비치합니다.\n고객이 스마트폰으로 스캔하면 담당자를 직접 선택하고 가입합니다.' },
        { selector:'qr-actions', title:'② 인쇄 / 공유', body:'[🖨️ QR 인쇄]로 출력하거나 [🔗 URL 복사]로 공유할 수 있습니다.\nQR로 가입한 고객은 마케팅 수신동의를 직접 체크하므로 서면 동의서가 필요 없습니다.' },
      ],
      component: <CustomerQRPage profile={previewProfile}/>, previewScale:0.52, previewHeight:400,
    },
    member_renew: {
      icon:'🔄', label:'수신 재동의', desc:'마케팅 수신동의가 만료·미동의된 회원의 재동의를 받습니다.',
      steps:['재동의 QR 인쇄 → 카운터 비치 → 회원 본인 스캔·재동의','스마트폰 없는 회원은 대면 검색 후 [재동의] 처리'],
      guide:[
        { selector:'renew-qr', title:'① 재동의 QR 비치', body:'만료·미동의 회원이 매장에 방문하면 이 QR을 인쇄해 카운터에 비치합니다.\n회원이 본인 휴대폰으로 스캔 → 번호 입력 → [재동의]하면, 본인 동의와 시각이 기록되어 증빙이 됩니다.' },
        { selector:'renew-search', title:'② 대면 처리', body:'스마트폰이 없는 회원은 구두 동의를 확인한 뒤,\n이름·휴대폰으로 검색해 수신 상태를 확인하고 [✅ 재동의]를 눌러 처리합니다.' },
      ],
      component: <ConsentRenewMgrPage/>, previewScale:0.52, previewHeight:460,
    },
    attendance_mgr: {
      icon:'🗓️', label:'근태 관리', desc:'출퇴근 체크와 다음달 휴무계획을 제출합니다.',
      steps:['출퇴근: 사이드바 하단 [출근]/[퇴근] 버튼 → 근무자 선택 → 확인','근무현황: 내 월별 출퇴근 기록 조회','휴무신청: 다음달 희망 휴무일 선택 후 제출 (매월 20일까지)'],
      component: <MyAttendancePage profile={previewProfile}/>, previewScale:0.52, previewHeight:420,
    },
  };

  const MEMBER_GROUP = { group:'회원 관리', icon:'👥', items:['qr','member_reg','member_renew'] };
  const GUIDE_MENUS = {
    hq:    ['sales_input', MEMBER_GROUP, 'stock_req'],
    store: ['sales_input', MEMBER_GROUP, 'stock_req'],
  };
  const CATS = [
    { key:'hq',    icon:'🏢', label:'본사', desc:'본사 담당자용 사용안내' },
    { key:'store', icon:'🏬', label:'매장', desc:'매장 근무자용 사용안내' },
  ];
  const detail = selMenu ? DETAILS[selMenu] : null;
  const menuCard = (k) => {
    const d = DETAILS[k];
    if (!d || !d.guide) return null;
    return (
      <button key={k} onClick={()=>{ setSelMenu(k); setTourOn(true); }}
        style={{textAlign:'left', width:'100%', padding:'14px 16px', borderRadius:12, border:'1px solid var(--border)',
          background:'#fff', cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
          display:'flex', alignItems:'center', gap:12}}>
        <span style={{fontSize:24}}>{d.icon}</span>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:15, fontWeight:800, color:'var(--text)'}}>{d.label}</div>
          <div style={{fontSize:12, color:'var(--text2)', lineHeight:1.5, marginTop:2}}>{d.desc}</div>
        </div>
        <span style={{flexShrink:0, display:'inline-flex', alignItems:'center', gap:6, height:30, padding:'0 12px', background:'#6a1b9a', color:'#fff', borderRadius:8, fontSize:12, fontWeight:700, whiteSpace:'nowrap'}}>▶ 시작</span>
      </button>
    );
  };

  return (
    <div style={{minHeight:520}}>
      {/* 1) 본사 / 매장 선택 */}
      {!cat && (
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:480, gap:28}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:22, fontWeight:800, color:'var(--text)'}}>📖 사용안내</div>
            <div style={{fontSize:13, color:'var(--text2)', marginTop:6}}>실제 화면을 보며 단계별로 따라하기</div>
          </div>
          <div style={{display:'flex', gap:20, flexWrap:'wrap', justifyContent:'center'}}>
            {CATS.map(c => {
              const disabled = c.key === 'hq' && !canHQ;
              return (
                <button key={c.key} disabled={disabled}
                  onClick={()=>{ setCat(c.key); setSelMenu(null); setTourOn(false); }}
                  style={{width:210, height:190, borderRadius:18, cursor: disabled?'not-allowed':'pointer',
                    border:'2px solid', borderColor: disabled?'var(--border)':'var(--accent)',
                    background: disabled?'#f5f5f5':'#fff', opacity: disabled?0.55:1,
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12,
                    boxShadow: disabled?'none':'0 4px 18px rgba(0,0,0,0.08)'}}>
                  <span style={{fontSize:54}}>{c.icon}</span>
                  <span style={{fontSize:20, fontWeight:800, color: disabled?'var(--text3)':'var(--accent)'}}>{c.label}</span>
                  <span style={{fontSize:12, color:'var(--text3)'}}>{disabled ? '매장 로그인은 이용 불가' : c.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2) 선택 카테고리의 따라하기 메뉴 */}
      {cat && (
        <div>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:18, flexWrap:'wrap'}}>
            <button onClick={()=>{ setCat(null); setSelMenu(null); setTourOn(false); }}
              style={{height:32, padding:'0 12px', border:'1px solid var(--border)', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600}}>← 뒤로</button>
            <span style={{fontSize:16, fontWeight:800}}>{cat==='hq'?'🏢 본사':'🏬 매장'} 사용안내</span>
            <span style={{fontSize:12, color:'var(--text3)'}}>메뉴를 선택하면 따라하기가 시작됩니다</span>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:12, maxWidth:560}}>
            {GUIDE_MENUS[cat].map((entry, idx) => {
              if (typeof entry === 'string') return menuCard(entry);
              return (
                <div key={'g'+idx} style={{border:'1px solid var(--border)', borderRadius:14, padding:'14px', background:'#fafafa'}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10, padding:'0 2px'}}>
                    <span style={{fontSize:20}}>{entry.icon}</span>
                    <span style={{fontSize:15, fontWeight:800, color:'var(--text)'}}>{entry.group}</span>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:8}}>
                    {entry.items.map(k => menuCard(k))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3) 전체화면 따라하기 */}
      {selMenu && detail && detail.guide && (
        <div style={{position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', display:'flex', flexDirection:'column'}}>
          <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 20px', background:'#fff', borderBottom:'1px solid var(--border)', flexShrink:0}}>
            <span style={{fontSize:18}}>{detail.icon}</span>
            <span style={{fontSize:15, fontWeight:700}}>{detail.label} 따라하기</span>
            {!tourOn && (
              <button onClick={()=>setTourOn(true)}
                style={{marginLeft:12, height:32, padding:'0 14px', background:'#6a1b9a', color:'#fff',
                  border:'none', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                ▶ 다시 시작
              </button>
            )}
            <button onClick={()=>{ setSelMenu(null); setTourOn(false); }}
              style={{marginLeft:'auto', height:32, padding:'0 16px', background:'#f5f5f5',
                border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontWeight:600, cursor:'pointer'}}>✕ 닫기</button>
          </div>
          <div ref={contentRef} style={{flex:1, overflow:'auto', background:'var(--bg)', padding:24, position:'relative'}}>
            {detail.component}
          </div>
          {tourOn && (
            <GuideTour steps={detail.guide} containerRef={contentRef} onClose={()=>setTourOn(false)} />
          )}
        </div>
      )}
    </div>
  );
}
