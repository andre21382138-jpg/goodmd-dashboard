import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { useStyle, toast, Toasts } from './lib/utils';
import NoticePage from './pages/notice/NoticePage';
import Sidebar from './components/Sidebar';
import NotificationCenter from './components/NotificationCenter';
import HomePage from './pages/home/HomePage';
import CustomerQRPage from './pages/customer/CustomerQRPage';
import CustomerDocPage from './pages/customer/CustomerDocPage';
import CustomerLookupPage from './pages/customer/CustomerLookupPage';
import CustomerInputPage from './pages/customer/CustomerInputPage';
import MyMembersPage from './pages/customer/MyMembersPage';
import SmsHistoryPage from './pages/customer/SmsHistoryPage';
import SalesInputPage from './pages/sales/SalesInputPage';
import SalesReturnPage from './pages/sales/SalesReturnPage';
import MgrSalesViewPage from './pages/sales/MgrSalesViewPage';
import PurchaseOrderHQPage from './pages/order/PurchaseOrderHQPage';
import PurchaseOrderMgrPage from './pages/order/PurchaseOrderMgrPage';
import SalesListPage from './pages/sales/SalesListPage';
import LectureSalesPage from './pages/sales/LectureSalesPage';
import BizSalesPage from './pages/sales/BizSalesPage';
import SalesViewHub from './pages/sales/SalesViewHub';
import AdminTab from './pages/admin/AdminTab';
import ManagerMgmtPage from './pages/admin/ManagerMgmtPage';
import CenterStockPage from './pages/stock/CenterStockPage';
import StockMgmtPage from './pages/stock/StockMgmtPage';
import StoreStockPage from './pages/stock/StoreStockPage';
import StockRequestPage from './pages/stock/StockRequestPage';
import UploadPage from './pages/stock/UploadPage';
import UploadHistoryPage from './pages/stock/UploadHistoryPage';
import ProductMgmtPage from './pages/product/ProductMgmtPage';
import StoreInfoPage from './pages/store/StoreInfoPage';
import ClockInOutPage from './pages/attendance/ClockInOutPage';
import MyAttendancePage from './pages/attendance/MyAttendancePage';
import LeavePlanPage from './pages/attendance/LeavePlanPage';
import AttendanceMgmtPage from './pages/attendance/AttendanceMgmtPage';
import IncentivePage from './pages/salary/IncentivePage';
import JoinPage from './pages/join/JoinPage';
import HelpPage from './pages/help/HelpPage';

// ════════════════════════════════════════════════════════
// GLOBAL CSS
// ════════════════════════════════════════════════════════
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+KR:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:      #f5f5f5;
    --bg2:     #ffffff;
    --bg3:     #f0f0f0;
    --border:  #e0e0e0;
    --border2: #cccccc;
    --sidebar: #FFD600;
    --sidebar-hover: #FFC200;
    --sidebar-active: #FF8F00;
    --sidebar-text: #1a1a1a;
    --accent:  #FF8F00;
    --accent2: #1565C0;
    --danger:  #C62828;
    --success: #2E7D32;
    --text:    #0a0a0a;
    --text2:   #333333;
    --text3:   #666666;
    --radius:  6px;
    --mono:    'Pretendard', 'Apple SD Gothic Neo', sans-serif;
    --sans:    'Noto Sans KR', sans-serif;
    --sidebar-w: 220px;
  }
  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 14px; line-height: 1.65; -webkit-font-smoothing: antialiased; }

  /* ── AUTH ── */
  .auth-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f8f8; }
  .auth-box { width: 380px; background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 36px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .auth-logo { text-align: center; margin-bottom: 6px; }
  .auth-logo-icon { font-size: 36px; }
  .auth-logo-text { font-family: var(--mono); font-size: 18px; font-weight: 700; color: var(--accent); letter-spacing: -0.5px; }
  .auth-sub { text-align: center; font-size: 13px; color: var(--text2); margin-bottom: 28px; }
  .auth-tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 24px; }
  .auth-tab { flex: 1; padding: 8px; background: none; border: none; font-family: var(--sans); font-size: 14px; font-weight: 500; color: var(--text3); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 120ms; }
  .auth-tab.on { color: var(--accent); border-bottom-color: var(--accent); }
  .form-group { margin-bottom: 14px; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--text2); margin-bottom: 5px; }
  .input { width: 100%; height: 38px; padding: 0 12px; border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--sans); font-size: 14px; background: #fafafa; outline: none; transition: border-color 120ms; }
  .input:focus { border-color: var(--accent); background: #fff; }
  .input::placeholder { color: var(--text3); }
  .btn-auth { width: 100%; height: 40px; background: var(--sidebar); border: none; border-radius: var(--radius); font-family: var(--sans); font-size: 14px; font-weight: 600; color: var(--sidebar-text); cursor: pointer; transition: background 120ms; margin-top: 4px; }
  .btn-auth:hover { background: var(--sidebar-hover); }
  .btn-auth:disabled { opacity: 0.5; cursor: not-allowed; }
  .auth-msg { text-align: center; font-size: 13px; margin-top: 12px; padding: 10px; border-radius: var(--radius); }
  .auth-msg.err { background: #fdecea; color: var(--danger); }
  .auth-msg.ok  { background: #e8f5e9; color: var(--success); }

  /* ── PENDING ── */
  .pending-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f8f8; }
  .pending-box { text-align: center; background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 48px 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); max-width: 400px; }
  .pending-icon { font-size: 48px; margin-bottom: 16px; }
  .pending-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
  .pending-desc { font-size: 14px; color: var(--text2); line-height: 1.8; margin-bottom: 20px; }
  .btn-logout-sm { padding: 7px 16px; border: 1px solid var(--border2); border-radius: var(--radius); background: transparent; font-family: var(--sans); font-size: 13px; color: var(--text2); cursor: pointer; }
  .btn-logout-sm:hover { background: var(--bg3); }

  /* ── APP LAYOUT ── */
  .app-layout { display: flex; min-height: 100vh; }

  /* ── SIDEBAR ── */
  .sidebar { width: var(--sidebar-w); background: var(--sidebar); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
  .sidebar-logo { padding: 20px 18px 16px; border-bottom: 1px solid rgba(0,0,0,0.1); }
  .sidebar-logo-icon { font-size: 22px; }
  .sidebar-logo-text { font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--sidebar-text); letter-spacing: -0.3px; margin-top: 2px; }
  .sidebar-logo-sub { font-size: 10px; color: rgba(0,0,0,0.55); margin-top: 1px; }
  .sidebar-section { padding: 12px 10px 4px; font-size: 9px; font-weight: 700; color: rgba(0,0,0,0.5); letter-spacing: 2px; text-transform: uppercase; }
  .sidebar-menu { flex: 1; padding: 6px 8px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.2) transparent; }
  .sidebar-menu::-webkit-scrollbar { width: 4px; }
  .sidebar-menu::-webkit-scrollbar-track { background: transparent; }
  .sidebar-menu::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 4px; }
  .sidebar-menu::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.35); }
  .flyout-item { display:flex; align-items:center; gap:9px; padding:9px 16px; width:100%; border:none; cursor:pointer; font-size:13px; text-align:left; transition:background 100ms; }
  .flyout-item:hover { background: #fff3e0 !important; }
  .sidebar-item { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 6px; cursor: pointer; transition: background 120ms; margin-bottom: 2px; font-size: 13px; font-weight: 600; color: #1a1a1a; border: none; background: none; width: 100%; text-align: left; }
  .sidebar-item:hover { background: rgba(0,0,0,0.12); }
  .sidebar-item.on { background: rgba(0,0,0,0.18); font-weight: 700; color: #1a1a1a; }
  .sidebar-item-icon { font-size: 15px; flex-shrink: 0; }
  .sidebar-sub { display: flex; align-items: center; gap: 9px; padding: 7px 10px 7px 34px; border-radius: 6px; cursor: pointer; transition: background 120ms; font-size: 12px; font-weight: 500; color: rgba(0,0,0,0.6); border: none; background: none; width: 100%; text-align: left; }
  .sidebar-sub:hover { background: rgba(0,0,0,0.08); }
  .sidebar-sub.on { background: rgba(0,0,0,0.12); font-weight: 700; color: rgba(0,0,0,0.85); }
  .sidebar-sub-icon { font-size: 12px; }
  .sidebar-chevron { margin-left: auto; font-size: 10px; transition: transform 150ms; color: rgba(0,0,0,0.35); }
  .sidebar-chevron.open { transform: rotate(180deg); }
  .sidebar-bottom { padding: 12px 8px; border-top: 1px solid rgba(0,0,0,0.12); }
  .sidebar-user { padding: 8px 10px; font-size: 11px; color: rgba(0,0,0,0.7); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sidebar-logout { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; color: rgba(0,0,0,0.7); background: none; border: none; width: 100%; transition: background 120ms; }
  .sidebar-logout:hover { background: rgba(0,0,0,0.12); }

  /* ── CONTENT ── */
  .content { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
  .content-header { background: #fff; border-bottom: 1px solid var(--border); padding: 0 28px; height: 52px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
  .content-title { font-size: 16px; font-weight: 700; color: var(--text); }
  .content-body { padding: 24px 28px; flex: 1; }

  /* ── ADMIN ── */
  .admin-badge { display: inline-flex; padding: 2px 8px; background: #fff3e0; border: 1px solid #ffcc80; border-radius: 4px; font-size: 11px; font-weight: 600; color: var(--accent); font-family: var(--mono); }
  .user-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .user-table th { background: var(--bg3); padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: var(--text); border-bottom: 2px solid var(--border2); }
  .user-table td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--text); }
  .user-table tr:hover td { background: #fafafa; }
  .user-table tr:last-child td { border-bottom: none; }
  .status-badge { display: inline-flex; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
  .status-ok  { background: #e8f5e9; color: var(--success); }
  .status-wait { background: #fff8e1; color: #E65100; }

  /* ── CARDS ── */
  .card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 16px; }
  .card-label { font-size: 13px; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
  .card-label::before { content: ''; display: block; width: 3px; height: 13px; background: var(--sidebar); border-radius: 2px; }

  /* ── DROP ZONE ── */
  .drop { border: 2px dashed var(--border2); border-radius: var(--radius); padding: 44px 24px; text-align: center; cursor: pointer; background: #fafafa; position: relative; transition: all 140ms ease; }
  .drop:hover, .drop.over { border-color: var(--accent); background: #fff8e1; }
  .drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .drop-icon { font-size: 28px; margin-bottom: 8px; }
  .drop-main { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .drop-main strong { color: var(--accent); }
  .drop-sub { font-size: 13px; color: var(--text2); font-family: var(--mono); }
  .drop-filename { display: inline-flex; align-items: center; gap: 8px; background: #fff3e0; border: 1px solid #ffcc80; color: var(--accent); font-family: var(--mono); font-size: 13px; padding: 5px 14px; border-radius: var(--radius); margin-top: 10px; }

  /* ── STATS ── */
  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
  @media (max-width: 900px) { .stats { grid-template-columns: repeat(3, 1fr); } }
  .stat { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
  .stat-l { font-size: 10px; font-weight: 700; color: var(--text2); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
  .stat-v { font-family: var(--mono); font-size: 24px; font-weight: 700; color: var(--accent); line-height: 1; }
  .stat-u { font-size: 11px; color: var(--text2); margin-top: 4px; }

  /* ── TABS ── */
  .tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 16px; }
  .tab { padding: 9px 20px; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: var(--sans); font-size: 14px; font-weight: 600; color: var(--text2); cursor: pointer; transition: all 120ms; }
  .tab.on { color: var(--accent); border-bottom-color: var(--accent); }
  .tab:hover:not(.on) { color: var(--text); }

  /* ── FILTER ── */
  .fbar { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
  .fsel, .finput { height: 34px; padding: 0 10px; border-radius: var(--radius); border: 1px solid var(--border); background: #fff; color: var(--text); font-family: var(--sans); font-size: 13px; outline: none; transition: border-color 120ms; }
  .fsel:focus, .finput:focus { border-color: var(--accent); }
  .finput { min-width: 200px; }
  .finput::placeholder { color: var(--text3); }
  .fbar-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .fresult { font-size: 13px; color: var(--text2); font-family: var(--mono); font-weight: 600; }
  .fresult b { color: var(--accent); }

  /* ── BUTTONS ── */
  .btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: var(--radius); border: 1px solid transparent; font-family: var(--sans); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 120ms ease; white-space: nowrap; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-p { background: var(--sidebar); color: var(--sidebar-text); border-color: var(--sidebar); }
  .btn-p:hover:not(:disabled) { background: var(--sidebar-hover); }
  .btn-s { background: transparent; color: var(--text); border-color: var(--border2); font-weight: 600; }
  .btn-s:hover:not(:disabled) { background: var(--bg3); }
  .btn-success { background: #e8f5e9; color: var(--success); border-color: #a5d6a7; font-weight: 700; }
  .btn-success:hover:not(:disabled) { background: #c8e6c9; }
  .btn-ghost { background: transparent; color: var(--text2); border: none; font-size: 12px; padding: 4px 8px; cursor: pointer; font-weight: 600; }
  .btn-ghost:hover { color: var(--text); }
  .btn-danger { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: var(--radius); border: 1px solid #ffcdd2; background: #ffebee; color: var(--danger); font-family: var(--sans); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 120ms; }
  .btn-danger:hover { background: #ffcdd2; }

  /* ── TABLE ── */
  .twrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead tr { background: var(--bg3); border-bottom: 2px solid var(--border2); }
  th { font-size: 11px; font-weight: 700; color: var(--text); letter-spacing: 0.5px; padding: 10px 12px; text-align: left; white-space: nowrap; cursor: pointer; user-select: none; text-transform: uppercase; }
  th:hover { color: var(--accent); }
  th.s-a::after { content: ' ↑'; color: var(--accent); }
  th.s-d::after { content: ' ↓'; color: var(--accent); }
  th.r { text-align: right; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--text); font-size: 13px; }
  td.r { text-align: right; font-family: var(--mono); font-size: 13px; font-weight: 600; }
  td.mono { font-family: var(--mono); font-size: 12px; color: var(--text2); }
  tr:hover td { background: #fffde7; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-flex; padding: 2px 9px; border-radius: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .badge-dept  { background: #fff3e0; color: #BF360C; border: 1px solid #ffcc80; }
  .badge-store { background: #e3f2fd; color: #0D47A1; border: 1px solid #90caf9; }
  .safety-num { font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--accent); }
  .wk-head { text-align: center !important; }
  .wk-head.latest { color: #C62828 !important; }
  .wk-cell { text-align: right; font-family: var(--mono); font-size: 12px; }
  .wk-cell.latest-col { background: #fff8e1; }
  .wk-cell.zero { color: var(--text3); }
  .wk-total { font-weight: 700; color: var(--accent); }
  .wtabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .wtab { padding: 4px 12px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--mono); font-size: 10px; color: var(--text2); cursor: default; }
  .wtab.on { background: #fff3e0; border-color: #ffcc80; color: #E65100; }

  /* ── EMPTY / LOADING ── */
  .empty { text-align: center; padding: 60px 24px; font-size: 12px; color: var(--text3); line-height: 2.4; }
  .spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── HISTORY ── */
  .history-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .history-table th { background: var(--bg3); padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; color: var(--text2); border-bottom: 1px solid var(--border); white-space: nowrap; }
  .history-table td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  .history-table tr:last-child td { border-bottom: none; }
  .history-table tr:hover td { background: #fffde7; }
  .active-row td { background: #fff8e1 !important; }
  .active-badge { display: inline-flex; align-items: center; padding: 2px 8px; background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 99px; font-size: 10px; font-weight: 600; color: var(--success); gap: 4px; }
  .btn-danger { background: transparent; color: var(--danger); border: 1px solid #ef9a9a; border-radius: var(--radius); padding: 5px 10px; font-size: 11px; cursor: pointer; transition: all 120ms; font-family: var(--sans); }
  .btn-danger:hover { background: #fdecea; }
  .btn-dl { background: transparent; color: var(--accent2); border: 1px solid #90caf9; border-radius: var(--radius); padding: 5px 10px; font-size: 11px; cursor: pointer; transition: all 120ms; font-family: var(--sans); }
  .btn-dl:hover { background: #e3f2fd; }
  .btn-load { background: var(--sidebar); color: #1a1a1a; border: none; border-radius: var(--radius); padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 120ms; font-family: var(--sans); }
  .btn-load:hover { background: var(--sidebar-hover); }

  /* ── TOAST ── */
  .toasts { position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 6px; }
  .toast { display: flex; align-items: center; gap: 9px; padding: 11px 16px; border-radius: var(--radius); border: 1px solid; font-family: var(--mono); font-size: 11px; min-width: 220px; box-shadow: 0 2px 12px rgba(0,0,0,0.12); animation: tIn 180ms ease; }
  .t-ok  { background: #e8f5e9; border-color: #a5d6a7; color: var(--success); }
  .t-err { background: #fdecea; border-color: #ef9a9a; color: var(--danger); }
  .t-inf { background: #e3f2fd; border-color: #90caf9; color: var(--accent2); }
  @keyframes tIn { from { opacity:0; transform: translateX(10px); } to { opacity:1; transform: none; } }
`;

// ════════════════════════════════════════════════════════
// STYLE INJECT
// ════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════
// AUTH SCREEN
// ════════════════════════════════════════════════════════
function AuthScreen() {
  const [userId, setUserId] = useState('');
  const [pw, setPw]         = useState('');
  const [showPw, setShowPw] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const email = `${userId.trim().toLowerCase()}@kbh.kr`;
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
    } catch (err) {
      setMsg(err.message.replace('Invalid login credentials', '아이디 또는 비밀번호가 틀렸습니다'));
    }
    setLoading(false);
  };

  return (
    <div className="auth-wrap">
      {/* 제공자 로고 (좌측 상단) */}
      <img src="/logo-ksl.jpg" alt="한국스마트물류"
        style={{
          position:'fixed', top:18, left:22, zIndex:1,
          height:52, width:'auto',
          mixBlendMode:'multiply',
          userSelect:'none', pointerEvents:'none',
        }}/>
      <div className="auth-box">
        <div className="auth-logo">
          <div className="auth-logo-icon">🏬</div>
          <div className="auth-logo-text">(주)한국생활건강</div>
        </div>
        <div className="auth-sub">온라인/오프라인 주문수집 &amp; 결산 &amp; 발주관리</div>

        <form onSubmit={handleSubmit} style={{marginTop:24}}>
          <div className="form-group">
            <label>아이디</label>
            <input className="input" type="text" value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="예) KBH0001" required autoCapitalize="none" />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <div style={{position:'relative'}}>
              <input className="input" type={showPw ? 'text' : 'password'} value={pw}
                onChange={e => setPw(e.target.value)}
                onKeyDown={e => setCapsOn(e.getModifierState && e.getModifierState('CapsLock'))}
                onKeyUp={e => setCapsOn(e.getModifierState && e.getModifierState('CapsLock'))}
                onBlur={() => setCapsOn(false)}
                placeholder="비밀번호" required style={{paddingRight:42}}/>
              <button type="button" onClick={() => setShowPw(v => !v)}
                title={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                style={{position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', fontSize:16, padding:4, lineHeight:1, color:'var(--text3)'}}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
            {capsOn && (
              <div style={{marginTop:6, padding:'6px 10px', background:'#fff3e0', border:'1px solid #ffb74d',
                borderRadius:'var(--radius)', fontSize:12, color:'#e65100', fontWeight:600, display:'flex', alignItems:'center', gap:6}}>
                ⚠️ Caps Lock이 켜져 있습니다
              </div>
            )}
          </div>
          <button className="btn-auth" type="submit" disabled={loading}>
            {loading ? '처리 중...' : '로그인'}
          </button>
        </form>
        {msg && <div className="auth-msg err">{msg}</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// PENDING APPROVAL SCREEN
// ════════════════════════════════════════════════════════
function PendingScreen({ email }) {
  const handleLogout = async () => { await supabase.auth.signOut(); };
  return (
    <div className="pending-wrap">
      <div className="pending-box">
        <div className="pending-icon">⏳</div>
        <div className="pending-title">승인 대기 중</div>
        <div className="pending-desc">
          <strong>{email}</strong><br />
          계정 승인을 기다리고 있습니다.<br />
          관리자 승인 후 로그인이 가능합니다.
        </div>
        <button className="btn-logout-sm" onClick={handleLogout}>로그아웃</button>
      </div>
    </div>
  );
}


export default function App() {
  useStyle(GLOBAL_CSS);

  // QR 가입 페이지 감지 (?m=매니저ID)
  const joinManagerId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('m');
  }, []);

  // 모든 hooks는 조건부 return 전에 선언해야 함 (Rules of Hooks)
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [authLoading, setAL]    = useState(true);
  const [page, setPage]         = useState('home');
  const [parsed, setParsed]     = useState(null);
  const [filename, setFilename] = useState('');
  const [activeUploadId, setActiveId] = useState(
    () => { const v = localStorage.getItem('gmd_active_id'); return v ? Number(v) : null; }
  );

  const setActiveUploadId = (id) => {
    setActiveId(id);
    if (id) localStorage.setItem('gmd_active_id', id);
    else localStorage.removeItem('gmd_active_id');
  };

  useEffect(() => {
    if (joinManagerId) return; // QR 가입 페이지면 인증 불필요
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setAL(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (!session) { setProfile(null); setAL(false); }
    });
    return () => subscription.unsubscribe();
  }, [joinManagerId]);

  useEffect(() => {
    if (!session || joinManagerId) return;
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { setProfile(data); setAL(false); });
  }, [session, joinManagerId]);

  // QR 가입 페이지면 여기서 렌더
  if (joinManagerId) return <><Toasts/><JoinPage managerId={joinManagerId}/></>;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast('로그아웃 됐습니다', 'inf');
  };

  const isAdmin    = profile?.role === 'admin';
  const isHQ       = profile?.job_title === '담당자';
  const isManager  = profile?.job_title === '매니저';
  const canSeeMain = isAdmin || isHQ;

  const PAGE_TITLES = {
    help:           '사용 안내',
    home:           `${new Date().getFullYear()}년 ${String(new Date().getMonth()+1).padStart(2,'0')}월 대시보드`,
    product_mgmt:   '상품관리',
    product_add:    '상품추가',
    stock_mgmt:     '재고관리',
    stock_center:   '센터재고',
    stock_store:    '매장재고',
    manager_mgmt:   '매니저 현황',
    incentive:      '급여관리',
    member_mgmt:    '회원 조회',
    sms_history:    '문자 내역',
    store_info:     '매장주소정보',
    purchase_status: '발주현황',
    sales_view:          '매출조회',
    sales_list:          '매장 매출',
    biz_sales_view:      '특판 매출',
    lecture_sales_view:  '강좌 매출',
    sales_input:    '판매 입력',
    sales_return:   '반품 접수',
    mgr_sales_view: '매출 조회',
    purchase_hq:    '발주진행',
    purchase_check: '발주 확인',
    customer_input: '회원 등록',
    customer_qr:    'QR 가입',
    customer_doc:   '서류 가입',
    my_members:     '회원 목록',
    stock_request:   '재고 요청',
    stock_mgmt_mgr:  '재고 관리',
    stock_mgr_view:  '재고 현황',
    attendance_mgmt: '근태 관리',
    clock_inout:     '출근/퇴근 체크',
    leave_plan:      '휴무 신청',
    admin:          '사용자 관리',
    notice:         '공지 사항',
  };

  if (authLoading) {
    return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><span className="spinner"/></div>;
  }
  if (!session) return <><Toasts/><AuthScreen/></>;
  if (!profile?.approved) return <><Toasts/><PendingScreen email={session.user.email}/></>;

  return (
    <>
      <Toasts/>
      <NotificationCenter profile={profile} setPage={setPage}/>
      <div className="app-layout">
        <Sidebar page={page} setPage={setPage} profile={profile} onLogout={handleLogout}/>
        <div className="content">
          <div className="content-header">
            <div className="content-title">{PAGE_TITLES[page]}</div>
            {isManager && profile?.department && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:20, padding:'5px 12px', flexShrink:0 }}>
                <div style={{ width:7, height:7, background:'var(--accent)', borderRadius:'50%', flexShrink:0 }}/>
                <span style={{ fontSize:12, fontWeight:700, color:'#E65100' }}>{profile.department}</span>
                <div style={{ width:1, height:12, background:'#ffcc80' }}/>
                <span style={{ fontSize:12, fontWeight:700, color:'#bf360c' }}>{profile.branch}</span>
              </div>
            )}
          </div>
          <div className="content-body">
            {page === 'home'           && <HomePage profile={profile} setPage={setPage}/>}
            {page === 'help'           && <HelpPage profile={profile}/>}
            {page === 'product_mgmt'   && canSeeMain && <ProductMgmtPage subPage={null}/>}
            {page === 'product_add'    && canSeeMain && <ProductMgmtPage subPage="product_add"/>}
            {page === 'stock_mgmt'     && canSeeMain && <StockMgmtPage/>}
            {page === 'stock_center'   && canSeeMain && <CenterStockPage/>}
            {page === 'stock_store'    && canSeeMain && <StoreStockPage profile={profile}/>}
            {page === 'manager_mgmt'   && canSeeMain && <ManagerMgmtPage/>}
            {page === 'incentive'      && canSeeMain && <IncentivePage profile={profile}/>}
            {page === 'member_mgmt'    && canSeeMain && <CustomerLookupPage profile={profile}/>}
            {page === 'sms_history'    && canSeeMain && <SmsHistoryPage/>}
            {page === 'store_info'     && canSeeMain && <StoreInfoPage/>}
            {page === 'sales_view'         && canSeeMain && <SalesViewHub setPage={setPage}/>}
            {page === 'sales_list'          && canSeeMain && <SalesListPage setPage={setPage}/>}
            {page === 'biz_sales_view'      && canSeeMain && <BizSalesPage profile={profile} setPage={setPage}/>}
            {page === 'lecture_sales_view'  && canSeeMain && <LectureSalesPage profile={profile} setPage={setPage}/>}
            {page === 'sales_input'    && (isManager || isAdmin || isHQ) && <SalesInputPage profile={profile}/>}
            {page === 'sales_return'   && (isManager || isAdmin || isHQ) && <SalesReturnPage profile={profile}/>}
            {page === 'mgr_sales_view' && (isManager || isAdmin || isHQ) && <MgrSalesViewPage profile={profile}/>}
            {page === 'purchase_hq'    && (isAdmin || isHQ) && <PurchaseOrderHQPage profile={profile}/>}
            {page === 'purchase_status' && canSeeMain && (
              <div className="card">
                <div className="card-label">발주현황</div>
                <div className="empty">📊 발주현황 — 구현 예정<br/><span style={{fontSize:11, color:'var(--text3)'}}>발주 이력·상태 조회 페이지가 곧 들어옵니다.</span></div>
              </div>
            )}
            {page === 'purchase_check' && (isManager || isAdmin || isHQ) && <PurchaseOrderMgrPage profile={profile}/>}
            {page === 'customer_input' && (isManager || isAdmin || isHQ) && <CustomerInputPage profile={profile}/>}
            {page === 'customer_qr'    && (isManager || isAdmin || isHQ) && <CustomerQRPage profile={profile}/>}
            {page === 'customer_doc'   && (isManager || isAdmin || isHQ) && <CustomerDocPage profile={profile}/>}
            {page === 'my_members'     && (isManager || isAdmin || isHQ) && <MyMembersPage profile={profile}/>}
            {page === 'stock_request'  && (isManager || isAdmin || isHQ) && <StockRequestPage profile={profile}/>}
            {page === 'stock_mgr_view' && (isManager || isAdmin || isHQ) && <StoreStockPage profile={profile}/>}
            {page === 'my_attendance'  && (isManager || isAdmin || isHQ) && <MyAttendancePage profile={profile}/>}
            {page === 'leave_plan'     && (isManager || isAdmin || isHQ) && <LeavePlanPage profile={profile}/>}
            {page === 'attendance_mgmt'&& canSeeMain && <AttendanceMgmtPage/>}
            {page === 'clock_inout'    && (isManager || isAdmin || isHQ) && <ClockInOutPage profile={profile}/>}
            {page === 'upload'         && canSeeMain && <UploadPage profile={profile} activeUploadId={activeUploadId} setActiveUploadId={setActiveUploadId} parsed={parsed} setParsed={setParsed} filename={filename} setFilename={setFilename}/>}
            {page === 'upload_history' && canSeeMain && <UploadHistoryPage profile={profile} activeUploadId={activeUploadId} setActiveUploadId={setActiveUploadId} setPage={setPage} setParsed={setParsed} setFilename={setFilename}/>}
            {page === 'admin'          && (isAdmin || isHQ) && <AdminTab profile={profile}/>}
            {page === 'notice'         && (isAdmin || isHQ || isManager) && <NoticePage profile={profile}/>}
          </div>
        </div>
      </div>
    </>
  );
}
