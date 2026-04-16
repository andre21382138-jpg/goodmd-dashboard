import React, { useState } from 'react';
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
import SalesListPage from '../sales/SalesListPage';
import BizSalesPage from '../sales/BizSalesPage';
import LectureSalesPage from '../sales/LectureSalesPage';
import SalesInputPage from '../sales/SalesInputPage';
import NoticePage from '../notice/NoticePage';

export default function HelpPage({ profile }) {
  const isAdmin   = profile?.role === 'admin';
  const isHQ      = profile?.job_title === '담당자';
  const isManager = profile?.job_title === '매니저';

  const [role,       setRole]       = useState(isManager ? 'manager' : 'hq');
  const [selMenu,    setSelMenu]    = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

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

  const previewProfile = {
    ...profile,
    job_title: role==='manager' ? '매니저' : '담당자',
    role: role==='admin' ? 'admin' : 'user',
  };

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
      steps:['전체 매니저 출퇴근 현황 월별 조회','휴무계획: 매니저가 제출한 다음달 휴무계획 승인/반려','매월 20~25일 미제출 매니저에게 대시보드 알림 자동 표시'],
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
      component: <SalesInputPage profile={previewProfile}/>, previewScale:0.52, previewHeight:460,
    },
    stock_mgr_view: {
      icon:'📊', label:'재고 현황', desc:'담당 매장의 현재 재고를 확인합니다.',
      steps:['사이드바 → 📦 재고 관리 → 📊 재고 현황 클릭','본인 매장 재고 자동 표시 (점포/지점 필터 고정)','상품명 또는 코드로 검색 가능','품절(0개) → 빨간색 / 5개 이하 → 주황색 ⚠️ 경고','판매 입력 시 재고 자동 차감'],
      component: <StoreStockPage profile={previewProfile}/>, previewScale:0.55, previewHeight:420,
    },
    stock_req: {
      icon:'📦', label:'재고 요청', desc:'본사에 상품 입고를 요청합니다.',
      steps:['사이드바 → 📦 재고 요청 클릭','브랜드·상품 선택 → 요청 수량 입력','[요청 등록] 클릭 → 본사 담당자에게 전달'],
      component: <StockRequestPage profile={previewProfile}/>, previewScale:0.52, previewHeight:400,
    },
    member_reg: {
      icon:'👤', label:'회원 관리', desc:'담당 회원 등록·조회·QR 가입을 처리합니다.',
      steps:['QR 가입: QR코드 출력 → 카운터 비치 → 고객이 직접 스캔하여 가입','서류 가입: 이름·연락처·생일·SMS동의 직접 입력','⚠️ 서류 가입 시 반드시 고객에게 마케팅 수신 동의 서면 별도 보관'],
      component: <CustomerDocPage profile={previewProfile}/>, previewScale:0.52, previewHeight:440,
    },
    qr: {
      icon:'📱', label:'QR 회원가입', desc:'고객이 QR을 스캔하면 자동으로 내 담당 회원으로 등록됩니다.',
      steps:['사이드바 → 👤 회원 관리 → QR 가입 클릭','QR 이미지 출력 후 카운터에 비치','고객이 스마트폰으로 QR 스캔 → 직접 정보 입력 → 자동 등록'],
      component: <CustomerQRPage profile={previewProfile}/>, previewScale:0.52, previewHeight:400,
    },
    attendance_mgr: {
      icon:'🗓️', label:'근태 관리', desc:'출퇴근 체크와 다음달 휴무계획을 제출합니다.',
      steps:['출퇴근: 사이드바 하단 [출근]/[퇴근] 버튼 → 근무자 선택 → 확인','근무현황: 내 월별 출퇴근 기록 조회','휴무신청: 다음달 희망 휴무일 선택 후 제출 (매월 25일까지)'],
      component: <MyAttendancePage profile={previewProfile}/>, previewScale:0.52, previewHeight:420,
    },
  };

  const roles = [];
  if (isAdmin || isHQ) roles.push({key:'admin', label:'🔐 관리자'});
  if (isAdmin || isHQ) roles.push({key:'hq',    label:'🏢 본사담당자'});
  roles.push({key:'manager', label:'👔 매니저'});

  const menuList = MENUS[role] || [];
  const detail   = selMenu ? DETAILS[selMenu] : null;

  return (
    <div style={{display:'flex', gap:16, minHeight:500}}>
      {/* 역할 선택 */}
      <div style={{width:140, flexShrink:0}}>
        <div style={{fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:8, letterSpacing:1}}>역할</div>
        {roles.map(r => (
          <button key={r.key} onClick={()=>{setRole(r.key);setSelMenu(null);setFullscreen(false);}}
            style={{display:'block', width:'100%', textAlign:'left', padding:'10px 12px', marginBottom:4,
              border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight: role===r.key?700:500,
              background: role===r.key?'var(--sidebar)':'#f5f5f5',
              color: role===r.key?'#1a1a1a':'var(--text2)'}}>
            {r.label}
          </button>
        ))}
      </div>

      {/* 메뉴 목록 */}
      <div style={{width:160, flexShrink:0}}>
        <div style={{fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:8, letterSpacing:1}}>메뉴</div>
        {menuList.map(m => (
          <button key={m.key} onClick={()=>{setSelMenu(m.key);setFullscreen(false);}}
            style={{display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left',
              padding:'10px 12px', marginBottom:4, border:'1px solid',
              borderColor: selMenu===m.key?'var(--accent)':'transparent',
              borderRadius:8, cursor:'pointer', fontSize:13, fontWeight: selMenu===m.key?700:400,
              background: selMenu===m.key?'#fff3e0':'#fff',
              color: selMenu===m.key?'var(--accent)':'var(--text)'}}>
            <span>{m.icon}</span>{m.label}
          </button>
        ))}
      </div>

      {/* 상세 설명 */}
      <div style={{flex:1}}>
        {!detail ? (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            height:'100%', color:'var(--text3)', gap:12}}>
            <span style={{fontSize:48}}>📖</span>
            <div style={{fontSize:14, fontWeight:600}}>왼쪽에서 메뉴를 선택하세요</div>
            <div style={{fontSize:12}}>각 메뉴의 설명과 사용방법을 확인할 수 있습니다</div>
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:16}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <span style={{fontSize:24}}>{detail.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:17, fontWeight:700, color:'var(--text)'}}>{detail.label}</div>
                <div style={{fontSize:12, color:'var(--text2)', marginTop:2}}>{detail.desc}</div>
              </div>
              <button onClick={()=>setFullscreen(true)}
                style={{height:34, padding:'0 14px', background:'var(--accent)', color:'#fff',
                  border:'none', borderRadius:'var(--radius)', fontSize:12, fontWeight:700,
                  cursor:'pointer', display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
                ⛶ 전체화면
              </button>
            </div>

            <div>
              <div style={{fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:8}}>🖥️ 화면 미리보기</div>
              <div style={{
                border:'2px solid var(--border)', borderRadius:10, overflow:'hidden',
                background:'var(--bg)', position:'relative',
                height: Math.round((detail.previewHeight||400) * (detail.previewScale||0.65)),
              }}>
                <div style={{position:'absolute',inset:0,zIndex:10,cursor:'default'}}/>
                <div style={{
                  transform:`scale(${detail.previewScale||0.65})`,
                  transformOrigin:'top left',
                  width:`${Math.round(100/(detail.previewScale||0.65))}%`,
                  pointerEvents:'none',
                }}>
                  <div style={{padding:20}}>
                    {detail.component}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10}}>📋 사용 방법</div>
              <div style={{display:'flex', flexDirection:'column', gap:6}}>
                {detail.steps.map((step, i) => (
                  <div key={i} style={{display:'flex', gap:10, alignItems:'flex-start',
                    background: i%2===0?'#fafafa':'#fff', borderRadius:8, padding:'9px 12px'}}>
                    <span style={{width:20, height:20, background:'var(--accent)', color:'#fff',
                      borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:10, fontWeight:700, flexShrink:0}}>{i+1}</span>
                    <span style={{fontSize:12, color:'var(--text)', lineHeight:1.7}}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {fullscreen && detail && (
          <div style={{position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)',
            display:'flex', flexDirection:'column'}}>
            <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 20px',
              background:'#fff', borderBottom:'1px solid var(--border)', flexShrink:0}}>
              <span style={{fontSize:18}}>{detail.icon}</span>
              <span style={{fontSize:15, fontWeight:700}}>{detail.label}</span>
              <button onClick={()=>setFullscreen(false)}
                style={{marginLeft:'auto', height:32, padding:'0 16px', background:'#f5f5f5',
                  border:'1px solid var(--border)', borderRadius:'var(--radius)',
                  fontSize:13, fontWeight:600, cursor:'pointer'}}>✕ 닫기</button>
            </div>
            <div style={{flex:1, overflow:'auto', background:'var(--bg)', padding:24}}>
              {detail.component}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
