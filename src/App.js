import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabase';
import { STORE_MAP, STORE_NAMES, SC, S_DATA_START, S_PERIOD_ROW, GRADE_TABLE, HQ_MENUS, MANAGER_MENUS, ADMIN_MENUS } from './lib/constants';
import { useStyle, toast, Toasts, useSort, sortRows, uniq, formatPhone, getGrade, GradeBadge, parseSubul, dlBlob } from './lib/utils';
import NoticePage from './pages/notice/NoticePage';
import Sidebar from './components/Sidebar';
import HomePage from './pages/home/HomePage';
import CustomerQRPage from './pages/customer/CustomerQRPage';
import CustomerDocPage from './pages/customer/CustomerDocPage';
import CustomerLookupPage from './pages/customer/CustomerLookupPage';
import CustomerInputPage from './pages/customer/CustomerInputPage';
import MyMembersPage from './pages/customer/MyMembersPage';
import SalesInputPage from './pages/sales/SalesInputPage';
import SalesListPage from './pages/sales/SalesListPage';
import LectureSalesPage from './pages/sales/LectureSalesPage';
import BizSalesPage from './pages/sales/BizSalesPage';
import SalesViewHub from './pages/sales/SalesViewHub';

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
      <div className="auth-box">
        <div className="auth-logo">
          <div className="auth-logo-icon">🏬</div>
          <div className="auth-logo-text">(주)한국생활건강</div>
        </div>
        <div className="auth-sub">백화점(매장) 관리시스템</div>

        <form onSubmit={handleSubmit} style={{marginTop:24}}>
          <div className="form-group">
            <label>아이디</label>
            <input className="input" type="text" value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="예) KBH0001" required autoCapitalize="none" />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <input className="input" type="password" value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="비밀번호" required />
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

// ════════════════════════════════════════════════════════
// ADMIN — USER MANAGEMENT
// ════════════════════════════════════════════════════════
function AdminTab({ profile }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = profile?.role === 'admin';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast(error.message, 'err');
    else setUsers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const approve = async (id) => {
    const { error } = await supabase.from('profiles').update({ approved: true }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('승인 완료', 'ok'); fetchUsers(); }
  };

  const setRole = async (id, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('권한 변경 완료', 'ok'); fetchUsers(); }
  };

  const withdraw = async (u) => {
    if (!window.confirm(`${u.name}(${u.email}) 계정을 탈퇴 처리하시겠습니까?\n탈퇴 후에는 로그인이 불가합니다.`)) return;
    const { error } = await supabase.from('profiles').update({ approved: false }).eq('id', u.id);
    if (error) toast(error.message, 'err');
    else { toast(`${u.name} 탈퇴 처리 완료`, 'ok'); fetchUsers(); }
  };

  const pending = users.filter(u => !u.approved);
  const approved = users.filter(u => u.approved);

  return (
    <div>
      {pending.length > 0 && (
        <div className="card" style={{ borderLeft: '3px solid #E65100' }}>
          <div className="card-label" style={{ color: '#E65100' }}>승인 대기 ({pending.length}명)</div>
          <table className="user-table">
            <thead>
              <tr><th>이름</th><th>직책</th><th>점포명</th><th>지점명</th><th>이메일</th><th>가입일</th><th>상태</th><th>처리</th></tr>
            </thead>
            <tbody>
              {pending.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name || '-'}</strong></td>
                  <td>{u.job_title || '-'}</td>
                  <td>{u.department || '-'}</td>
                  <td>{u.branch || '-'}</td>
                  <td>{u.email}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                    {new Date(u.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td><span className="status-badge status-wait">대기 중</span></td>
                  <td style={{display:'flex', gap:4}}>
                    <button className="btn btn-success" onClick={() => approve(u.id)}>✓ 승인</button>
                    <button className="btn-danger" style={{padding:'4px 8px', fontSize:11}} onClick={() => withdraw(u)}>탈퇴</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-label">전체 사용자 ({users.length}명)</div>
        {loading ? <div className="empty"><span className="spinner" /></div> : (
          <table className="user-table">
            <thead>
              <tr><th>이름</th><th>직책</th><th>점포명</th><th>지점명</th><th>이메일</th><th>권한</th><th>상태</th><th>가입일</th><th>권한 변경</th><th>탈퇴</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name || '-'}</strong></td>
                  <td>{u.job_title || '-'}</td>
                  <td>{u.department || '-'}</td>
                  <td>{u.branch || '-'}</td>
                  <td>{u.email}</td>
                  <td>
                    {u.role === 'admin'
                      ? <span className="admin-badge">ADMIN</span>
                      : <span style={{ fontSize: 12, color: 'var(--text2)' }}>일반</span>}
                  </td>
                  <td>
                    <span className={`status-badge ${u.approved ? 'status-ok' : 'status-wait'}`}>
                      {u.approved ? '승인됨' : '대기 중'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                    {new Date(u.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td>
                    {u.role !== 'admin'
                      ? <button className="btn btn-s" style={{ fontSize: 11 }} onClick={() => setRole(u.id, 'admin')}>관리자로</button>
                      : <button className="btn btn-s" style={{ fontSize: 11 }} onClick={() => setRole(u.id, 'user')}>일반으로</button>
                    }
                  </td>
                  <td>
                    {u.approved && (
                      <button className="btn-danger" style={{padding:'3px 8px', fontSize:11}} onClick={() => withdraw(u)}>탈퇴</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 상품별점별수불현황 파싱
// col1:그룹, col2:매장, col3:상품코드, col4:상품명
// col14:재고수량, col32:매출수량
// 데이터 시작: 10행 / 기간: 2행
// ════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════
// EXCEL EXPORT
// ════════════════════════════════════════════════════════
async function exportSafety(rows, period) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('안전재고현황');
  ws.columns = [
    { key: 'dept',    width: 14 },
    { key: 'store',   width: 16 },
    { key: 'code',    width: 18 },
    { key: 'name',    width: 36 },
    { key: 'sales',   width: 16 },
    { key: 'safe',    width: 14 },
    { key: 'stock',   width: 14 },
    { key: 'shortage',width: 14 },
  ];
  const hr = ws.addRow([
    '백화점', '매장', '상품코드', '상품명',
    `매출수량(${period})`, '안전재고', '현재재고', '부족수량'
  ]);
  hr.height = 26;
  hr.eachCell(cell => {
    cell.font = { bold: true, name: 'Malgun Gothic', size: 10, color: { argb: 'FF1A1A1A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD600' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  rows.forEach((r, i) => {
    const shortage = r.sales - r.stock;
    const row = ws.addRow([r.dept, r.store, r.code, r.name, r.sales, r.sales, r.stock, shortage]);
    row.height = 18;
    row.eachCell((cell, ci) => {
      cell.font = { name: 'Malgun Gothic', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: ci <= 4 ? 'left' : 'center' };
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
      if (ci === 6) cell.font = { name: 'Malgun Gothic', size: 10, bold: true, color: { argb: 'FFBF6000' } };
      if (ci === 8 && shortage > 0) {
        cell.font = { name: 'Malgun Gothic', size: 10, bold: true, color: { argb: 'FFC62828' } };
      }
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  dlBlob(buf, `안전재고현황_${period.replace(/\s/g,'')}.xlsx`);
}


// ════════════════════════════════════════════════════════
// SORT HOOK
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
// SAFETY STOCK TAB
// ════════════════════════════════════════════════════════
function SafetyTab({ rows: allRows, period }) {
  const [fDept,  setFDept]  = useState('');
  const [fStore, setFStore] = useState('');
  const [fSearch, setFS]    = useState('');
  const [showShortOnly, setShortOnly] = useState(false);
  const [exporting, setEx]  = useState(false);
  const sort = useSort('dept');

  const depts  = useMemo(() => uniq(allRows.map(r => r.dept)), [allRows]);
  const stores = useMemo(() => uniq((fDept ? allRows.filter(r => r.dept === fDept) : allRows).map(r => r.store)), [allRows, fDept]);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (fDept)  rows = rows.filter(r => r.dept === fDept);
    if (fStore) rows = rows.filter(r => r.store === fStore);
    if (fSearch) {
      const q = fSearch.toLowerCase();
      rows = rows.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    }
    if (showShortOnly) rows = rows.filter(r => r.stock < r.sales);
    return sortRows(rows, sort.key, sort.dir);
  }, [allRows, fDept, fStore, fSearch, showShortOnly, sort.key, sort.dir]);

  const shortCount = useMemo(() => allRows.filter(r => r.stock < r.sales).length, [allRows]);

  return (
    <>
      {/* 부족 알림 배너 */}
      {shortCount > 0 && (
        <div style={{
          background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 'var(--radius)',
          padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center',
          gap: 10, fontSize: 13, color: '#856404'
        }}>
          <span>⚠️</span>
          <span>재고 부족 항목 <strong>{shortCount}개</strong> — 안전재고 미달입니다.</span>
          <button className="btn btn-s" style={{ marginLeft: 'auto', fontSize: 11 }}
            onClick={() => setShortOnly(v => !v)}>
            {showShortOnly ? '전체 보기' : '부족 항목만 보기'}
          </button>
        </div>
      )}

      {/* 필터 */}
      <div className="fbar">
        <select className="fsel" value={fDept} onChange={e => { setFDept(e.target.value); setFStore(''); }}>
          <option value="">전체 백화점</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
          <option value="">전체 매장</option>
          {stores.map(s => <option key={s}>{s}</option>)}
        </select>
        <input className="finput" placeholder="상품코드 / 상품명 검색" value={fSearch} onChange={e => setFS(e.target.value)} />
        {(fDept || fStore || fSearch) && (
          <button className="btn-ghost" onClick={() => { setFDept(''); setFStore(''); setFS(''); }}>✕ 초기화</button>
        )}
        <div className="fbar-right">
          <span className="fresult"><b>{filtered.length.toLocaleString()}</b>개 항목</span>
          <button className="btn btn-p"
            onClick={async () => { setEx(true); try { await exportSafety(filtered, period); toast('엑셀 다운로드 완료'); } catch(e) { toast(e.message,'err'); } setEx(false); }}
            disabled={exporting || !filtered.length}>
            {exporting ? <span className="spinner" /> : '⬇ Excel'}
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="twrap">
        <table>
          <thead>
            <tr>
              <th className={sort.thClass('dept')}  onClick={() => sort.toggle('dept')}>백화점</th>
              <th className={sort.thClass('store')} onClick={() => sort.toggle('store')}>매장</th>
              <th className={sort.thClass('code')}  onClick={() => sort.toggle('code')}>상품코드</th>
              <th className={sort.thClass('name')}  onClick={() => sort.toggle('name')}>상품명</th>
              <th className={'r '+sort.thClass('sales')}  onClick={() => sort.toggle('sales')} title="해당 기간 동안 판매한 수량">판매수량</th>
              <th className={'r '+sort.thClass('stock')}  onClick={() => sort.toggle('stock')} title="판매수량을 제외하고 남은 현재 재고">현재재고</th>
              <th className="r">부족수량</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={7} className="empty">조회 결과가 없습니다</td></tr>
              : filtered.map((r, i) => {
                  const shortage = r.stock - r.sales;
                  const isShort  = shortage < 0;
                  return (
                    <tr key={i} style={isShort ? { background: '#fff9f9' } : {}}>
                      <td><span className="badge badge-dept">{r.dept}</span></td>
                      <td><span className="badge badge-store">{r.store}</span></td>
                      <td className="mono">{r.code}</td>
                      <td>{r.name}</td>
                      <td className="r"><span className="safety-num">{r.sales.toLocaleString()}</span></td>
                      <td className="r">{r.stock.toLocaleString()}</td>
                      <td className="r">
                        {isShort
                          ? <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--danger)' }}>
                              ▼ {Math.abs(shortage).toLocaleString()}
                            </span>
                          : <span style={{ fontFamily:'var(--mono)', color:'var(--success)' }}>
                              +{shortage.toLocaleString()}
                            </span>
                        }
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
// UPLOAD PAGE
// ════════════════════════════════════════════════════════
function UploadPage({ profile, activeUploadId, setActiveUploadId, parsed, setParsed, filename, setFilename }) {
  const [loading, setLoading] = useState(false);
  const [dragging, setDrag]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const fileRef = useRef();

  // 앱 시작 시 최근 업로드 자동 로드
  useEffect(() => {
    if (activeUploadId && !parsed) loadFromHistory(activeUploadId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFromHistory = async (id) => {
    setLoading(true);
    try {
      const { data: rec } = await supabase
        .from('upload_history').select('*').eq('id', id).single();
      if (!rec) { setLoading(false); return; }
      const { data: fileData, error } = await supabase.storage
        .from('uploads').download(rec.storage_path);
      if (error) throw error;
      const arrayBuf = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let str = '';
      for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
      const result = parseSubul(str);
      setParsed(result);
      setFilename(rec.filename);
    } catch(e) {
      toast('파일 로드 실패: ' + e.message, 'err');
    }
    setLoading(false);
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xls|xlsx)$/i)) { toast('xls 또는 xlsx 파일만 지원합니다', 'err'); return; }
    setLoading(true); setFilename(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // 1. 파싱
        const result = parseSubul(e.target.result);
        if (!result.rows.length) { toast('데이터가 없습니다', 'err'); setLoading(false); return; }
        setParsed(result);

        // 2. Supabase Storage 업로드
        setSaving(true);
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('uploads').upload(path, file, { upsert: false });
        if (upErr) throw upErr;

        // 3. 이력 저장
        const { data: hist, error: histErr } = await supabase
          .from('upload_history').insert({
            filename: file.name,
            storage_path: path,
            period_str: result.periodStr,
            row_count: result.rows.length,
            uploaded_by: profile.id,
          }).select().single();
        if (histErr) throw histErr;

        setActiveUploadId(hist.id);
        toast(`업로드 완료 · ${result.rows.length.toLocaleString()}개 항목 저장됨`);
      } catch(err) {
        toast('업로드 오류: ' + err.message, 'err');
      }
      setSaving(false);
      setLoading(false);
    };
    reader.onerror = () => { toast('파일 읽기 실패', 'err'); setLoading(false); };
    reader.readAsBinaryString(file);
  };

  const handleReset = async () => {
    if (!window.confirm('현재 파일을 초기화하시겠습니까?\n(업로드 이력은 유지됩니다)')) return;
    setParsed(null);
    setFilename('');
    setActiveUploadId(null);
    toast('초기화됐습니다', 'inf');
  };

  const stats = useMemo(() => {
    if (!parsed) return null;
    const { rows } = parsed;
    const depts   = new Set(rows.map(r => r.dept));
    const stores  = new Set(rows.map(r => r.store));
    const codes   = new Set(rows.map(r => r.code));
    const totalSales = rows.reduce((s,r) => s+r.sales, 0);
    const totalStock = rows.reduce((s,r) => s+r.stock, 0);
    const shortCount = rows.filter(r => r.stock < r.sales).length;
    return { depts: depts.size, stores: stores.size, codes: codes.size, totalSales, totalStock, shortCount };
  }, [parsed]);

  return (
    <div>
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
          <div className="card-label" style={{ margin:0, padding:0, border:'none' }}>굿MD 상품별점별수불현황 파일 업로드</div>
          {parsed && (
            <button className="btn-danger" onClick={handleReset}>✕ 초기화</button>
          )}
        </div>

        <div className={`drop ${dragging?'over':''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".xls,.xlsx"
            onClick={e => e.stopPropagation()}
            onChange={e => { handleFile(e.target.files[0]); e.target.value=''; }} />
          {loading || saving
            ? <><div className="drop-icon"><span className="spinner"/></div>
                <div className="drop-main">{saving ? 'Supabase에 저장 중...' : '파싱 중...'}</div></>
            : parsed
              ? <><div className="drop-icon">✅</div>
                  <div className="drop-main"><strong>다른 파일</strong>을 올리면 교체 업로드됩니다</div>
                  <div className="drop-filename">📄 {filename}</div></>
              : <><div className="drop-icon">📂</div>
                  <div className="drop-main"><strong>클릭</strong> 또는 <strong>드래그&드롭</strong></div>
                  <div className="drop-sub">굿MD → 상품별점별수불현황 (.xls / .xlsx)</div></>
          }
        </div>
      </div>

      {stats && (
        <div className="stats">
          <div className="stat">
            <div className="stat-l">기간</div>
            <div className="stat-v" style={{fontSize:15, lineHeight:1.3}}>{parsed.periodStr}</div>
          </div>
          <div className="stat">
            <div className="stat-l">백화점 / 매장</div>
            <div className="stat-v">{stats.depts} <span style={{fontSize:13, fontWeight:400, color:'var(--text2)'}}>그룹</span> · {stats.stores} <span style={{fontSize:13, fontWeight:400, color:'var(--text2)'}}>지점</span></div>
            <div className="stat-u">{stats.codes}개 상품</div>
          </div>
          <div className="stat">
            <div className="stat-l">총 판매수량</div>
            <div className="stat-v">{stats.totalSales.toLocaleString()}</div>
            <div className="stat-u">개</div>
          </div>
          <div className="stat">
            <div className="stat-l">총 현재재고</div>
            <div className="stat-v">{stats.totalStock.toLocaleString()}</div>
            <div className="stat-u">개</div>
          </div>
          <div className="stat" style={stats.shortCount > 0 ? {borderColor:'#ffc107'} : {}}>
            <div className="stat-l">재고 부족</div>
            <div className="stat-v" style={{color: stats.shortCount > 0 ? 'var(--danger)' : 'var(--success)'}}>
              {stats.shortCount}
            </div>
            <div className="stat-u">개 항목</div>
          </div>
        </div>
      )}

      {parsed && (
        <div className="card" style={{padding:'16px 20px'}}>
          <SafetyTab rows={parsed.rows} period={parsed.periodStr} />
        </div>
      )}

      {!parsed && !loading && (
        <div className="empty">
          굿MD에서 <strong>상품별점별수불현황</strong> 파일을 다운로드한 뒤<br/>
          위 영역에 업로드하면 안전재고 현황을 바로 확인할 수 있습니다<br/>
          <span style={{fontSize:11,color:'var(--text3)'}}>업로드한 파일은 자동 저장되어 누적 관리됩니다</span>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// UPLOAD HISTORY PAGE
// ════════════════════════════════════════════════════════
function UploadHistoryPage({ profile, activeUploadId, setActiveUploadId, setPage, setParsed, setFilename }) {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('upload_history')
      .select('*, uploader:profiles(name, email, job_title, department)')
      .order('created_at', { ascending: false });
    if (error) toast(error.message, 'err');
    else setList(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  // 원본 파일 다운로드
  const handleDownload = async (item) => {
    try {
      const { data, error } = await supabase.storage
        .from('uploads').download(item.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = item.filename; a.click();
      URL.revokeObjectURL(url);
      toast('다운로드 완료');
    } catch(e) { toast('다운로드 실패: ' + e.message, 'err'); }
  };

  // 이력 삭제
  const handleDelete = async (item) => {
    if (!window.confirm(`"${item.filename}" 이력을 삭제하시겠습니까?\n저장된 파일도 함께 삭제됩니다.`)) return;
    try {
      await supabase.storage.from('uploads').remove([item.storage_path]);
      const { error } = await supabase.from('upload_history').delete().eq('id', item.id);
      if (error) throw error;
      if (activeUploadId === item.id) {
        setActiveUploadId(null);
        setParsed(null);
        setFilename('');
      }
      toast('삭제 완료', 'inf');
      fetchList();
    } catch(e) { toast('삭제 실패: ' + e.message, 'err'); }
  };

  // 이력에서 안전재고 화면으로 불러오기
  const handleLoad = async (item) => {
    try {
      const { data, error } = await supabase.storage
        .from('uploads').download(item.storage_path);
      if (error) throw error;
      const arrayBuf = await data.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let str = '';
      for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
      const result = parseSubul(str);
      setParsed(result);
      setFilename(item.filename);
      setActiveUploadId(item.id);
      localStorage.setItem('gmd_active_id', item.id);
      toast(`"${item.filename}" 불러왔습니다`);
      setPage('upload');
    } catch(e) { toast('불러오기 실패: ' + e.message, 'err'); }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <div>
      <div className="card">
        <div className="card-label">업로드 이력</div>
        {loading ? (
          <div className="empty"><span className="spinner" /></div>
        ) : list.length === 0 ? (
          <div className="empty">업로드 이력이 없습니다</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="history-table">
              <thead>
                <tr>
                  <th>상태</th>
                  <th>업로드 일시</th>
                  <th>파일명</th>
                  <th>기간</th>
                  <th>항목수</th>
                  <th>업로드 담당자</th>
                  <th>직책 / 소속</th>
                  <th>파일</th>
                  <th>삭제</th>
                </tr>
              </thead>
              <tbody>
                {list.map(item => {
                  const isActive = item.id === activeUploadId;
                  const canDelete = isAdmin || item.uploaded_by === profile?.id;
                  return (
                    <tr key={item.id} className={isActive ? 'active-row' : ''}>
                      <td>
                        {isActive
                          ? <span className="active-badge">✓ 현재</span>
                          : <button className="btn-load" onClick={() => handleLoad(item)}>불러오기</button>
                        }
                      </td>
                      <td style={{ fontFamily:'var(--mono)', fontSize:11, whiteSpace:'nowrap' }}>
                        {new Date(item.created_at).toLocaleString('ko-KR')}
                      </td>
                      <td style={{ fontSize:12, maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        📄 {item.filename}
                      </td>
                      <td style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text2)', whiteSpace:'nowrap' }}>
                        {item.period_str || '-'}
                      </td>
                      <td style={{ fontFamily:'var(--mono)', fontSize:12, textAlign:'right' }}>
                        {item.row_count?.toLocaleString() || '-'}
                      </td>
                      <td>
                        <div style={{ fontWeight:600, fontSize:13 }}>{item.uploader?.name || '-'}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{item.uploader?.email}</div>
                      </td>
                      <td style={{ fontSize:12, color:'var(--text2)' }}>
                        {item.uploader?.job_title || '-'} / {item.uploader?.department || '-'}
                        {item.uploader?.branch ? ` / ${item.uploader.branch}` : ''}
                      </td>
                      <td>
                        <button className="btn-dl" onClick={() => handleDownload(item)}>⬇ 다운로드</button>
                      </td>
                      <td>
                        {canDelete
                          ? <button className="btn-danger" onClick={() => handleDelete(item)}>삭제</button>
                          : <span style={{ fontSize:11, color:'var(--text3)' }}>-</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
// ════════════════════════════════════════════════════════
// 상품관리 페이지
// ════════════════════════════════════════════════════════
function ProductMgmtPage({ subPage }) {
  // 판매상품 현황
  const [products, setProducts] = useState([]);
  const [brands,   setBrands]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  // 상품추가 폼
  const [selBrand,  setSelBrand]  = useState(null);
  const [newBrand,  setNewBrand]  = useState('');
  const [newProd,   setNewProd]   = useState('');
  const [newOption, setNewOption] = useState('');
  const [newPrice,  setNewPrice]  = useState('');
  const [newCode,   setNewCode]   = useState('');
  const [newCost,   setNewCost]   = useState('');
  const [newErpCode,setNewErpCode]= useState('');
  const [dragging,  setDrag]      = useState(false);
  const fileRef = useRef();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: br }, { data: pr }] = await Promise.all([
      supabase.from('brands').select('*').order('name'),
      supabase.from('products').select('*, brand:brands(name)').order('name'),
    ]);
    setBrands(br || []);
    setProducts(pr || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addBrand = async () => {
    if (!newBrand.trim()) return;
    const { error } = await supabase.from('brands').insert({ name: newBrand.trim() });
    if (error) toast(error.message, 'err');
    else { toast('브랜드 추가 완료', 'ok'); setNewBrand(''); fetchAll(); }
  };

  const addProduct = async () => {
    if (!selBrand || !newProd.trim()) { toast('브랜드와 상품명을 입력해주세요', 'err'); return; }
    if (!newCode.trim()) { toast('상품코드를 입력해주세요', 'err'); return; }
    const { error } = await supabase.from('products').insert({
      brand_id: selBrand.id, name: newProd.trim(),
      code: newCode.trim(),
      erp_code: newErpCode.trim() || null,
      cost: Number(newCost) || 0,
      price: Number(newPrice) || 0,
    });
    if (error) toast(error.message, 'err');
    else { toast('상품 추가 완료', 'ok'); setNewProd(''); setNewOption(''); setNewPrice(''); setNewCode(''); setNewCost(''); setNewErpCode(''); fetchAll(); }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('상품을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); fetchAll(); }
  };

  const deleteBrand = async (id) => {
    if (!window.confirm('브랜드와 해당 상품이 모두 삭제됩니다. 계속하시겠습니까?')) return;
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); if (selBrand?.id===id) setSelBrand(null); fetchAll(); }
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xls|xlsx)$/i)) { toast('xls, xlsx 파일만 지원합니다', 'err'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        toast(`${rows.length}행 감지됨 — 순차 저장 중...`, 'inf');
        let cnt = 0;
        for (const row of rows) {
          const brandName = String(row['브랜드명'] || row['브랜드'] || '').trim();
          const prodName  = String(row['상품명'] || '').trim();
          const code      = String(row['상품코드'] || row['code'] || '').trim() || null;
          const cost      = Number(row['원가'] || row['cost'] || 0);
          const price     = Number(row['판매가'] || row['price'] || 0);
          if (!brandName || !prodName) continue;
          let { data: br } = await supabase.from('brands').select('id').eq('name', brandName).single();
          if (!br) {
            const { data: newBr } = await supabase.from('brands').insert({ name: brandName }).select().single();
            br = newBr;
          }
          if (br) { await supabase.from('products').insert({ brand_id: br.id, name: prodName, code, cost, price }); cnt++; }
        }
        toast(`${cnt}개 상품 업로드 완료`, 'ok'); fetchAll();
      } catch(err) { toast('파싱 실패: ' + err.message, 'err'); }
    };
    reader.readAsBinaryString(file);
  };

  const inputStyle = { height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const [pSearch,  setPSearch]  = useState('');
  const [editing,  setEditing]  = useState({}); // { [id]: { cost, price } }
  const [saving,   setSavingP]  = useState({});

  const filteredProducts = (() => {
    let list = selBrand ? products.filter(p => p.brand_id === selBrand.id) : products;
    if (pSearch.trim()) {
      const kw = pSearch.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(kw) ||
        (p.code||'').toLowerCase().includes(kw) ||
        (p.erp_code||'').toLowerCase().includes(kw)
      );
    }
    return list;
  })();

  const startEdit = (p) => setEditing(prev => ({...prev, [p.id]: { cost: p.cost||0, price: p.price||0 }}));
  const cancelEdit = (id) => setEditing(prev => { const n={...prev}; delete n[id]; return n; });
  const saveEdit = async (p) => {
    setSavingP(prev => ({...prev, [p.id]: true}));
    const { cost, price } = editing[p.id];
    const { error } = await supabase.from('products').update({ cost: Number(cost)||0, price: Number(price)||0 }).eq('id', p.id);
    if (error) toast(error.message, 'err');
    else { toast('저장 완료', 'ok'); cancelEdit(p.id); fetchAll(); }
    setSavingP(prev => ({...prev, [p.id]: false}));
  };

  if (subPage === 'product_add') {
    return (
      <div>
        <div style={{display:'grid', gridTemplateColumns:'280px 1fr', gap:16}}>
          {/* 브랜드 패널 */}
          <div className="card" style={{height:'fit-content'}}>
            <div className="card-label">브랜드</div>
            <div style={{display:'flex', flexDirection:'column', gap:6, marginBottom:12}}>
              <input value={newBrand} onChange={e => setNewBrand(e.target.value)}
                style={{...inputStyle, width:'100%'}} placeholder="새 브랜드명"
                onKeyDown={e => e.key==='Enter' && addBrand()} />
              <button className="btn btn-p" onClick={addBrand} style={{width:'100%', justifyContent:'center'}}>+ 브랜드 추가</button>
            </div>
            {brands.map(b => (
              <div key={b.id} onClick={() => setSelBrand(b)}
                style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 10px', borderRadius:'var(--radius)', cursor:'pointer', background: selBrand?.id===b.id ? '#fff3e0' : 'transparent', marginBottom:2}}>
                <span style={{fontWeight: selBrand?.id===b.id ? 700 : 400, color: selBrand?.id===b.id ? 'var(--accent)' : 'var(--text)'}}>{b.name}</span>
                <button className="btn-danger" style={{padding:'2px 8px', fontSize:11}} onClick={e => { e.stopPropagation(); deleteBrand(b.id); }}>삭제</button>
              </div>
            ))}
            {brands.length === 0 && <div className="empty" style={{padding:16}}>브랜드 없음</div>}
          </div>

          <div>
            {/* 상품 직접 입력 */}
            <div className="card">
              <div className="card-label">상품 직접 추가</div>
              {/* 1행: 브랜드, 상품코드(필수), ERP코드 */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8}}>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>브랜드 선택 <span style={{color:'var(--danger)'}}>*</span></label>
                  <select value={selBrand?.id||''} onChange={e => setSelBrand(brands.find(b=>b.id===Number(e.target.value))||null)}
                    style={{...inputStyle, width:'100%'}}>
                    <option value="">-- 선택 --</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>상품코드 <span style={{color:'var(--danger)'}}>*</span></label>
                  <input value={newCode} onChange={e => setNewCode(e.target.value)} style={{...inputStyle, width:'100%'}} placeholder="상품코드 입력"/>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>ERP코드</label>
                  <input value={newErpCode} onChange={e => setNewErpCode(e.target.value)} style={{...inputStyle, width:'100%'}} placeholder="ERP코드 입력"/>
                </div>
              </div>
              {/* 2행: 상품명(넓게), 원가, 판매가, 추가버튼 */}
              <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, alignItems:'end'}}>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>상품명 <span style={{color:'var(--danger)'}}>*</span></label>
                  <input value={newProd} onChange={e => setNewProd(e.target.value)} style={{...inputStyle, width:'100%'}} placeholder="상품명 입력"/>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>원가</label>
                  <input type="number" value={newCost} onChange={e => setNewCost(e.target.value)} style={{...inputStyle, width:'100%'}} placeholder="0"/>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>판매가</label>
                  <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} style={{...inputStyle, width:'100%'}} placeholder="0"/>
                </div>
                <button className="btn btn-p" onClick={addProduct} style={{height:34}}>추가</button>
              </div>
            </div>

            {/* 파일 업로드 */}
            <div className="card">
              <div className="card-label">파일 업로드로 일괄 추가</div>
              <div className={`drop ${dragging?'over':''}`}
                onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
                onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
                onClick={()=>fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".xls,.xlsx" onClick={e=>e.stopPropagation()} onChange={e=>{handleFile(e.target.files[0]);e.target.value='';}}/>
                <div className="drop-icon">📂</div>
                <div className="drop-main"><strong>클릭</strong> 또는 <strong>드래그&드롭</strong></div>
                <div className="drop-sub">컬럼: 브랜드명 / 상품명 / 판매가</div>
              </div>
              <div style={{marginTop:12, background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:12}}>
                <div style={{fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:6}}>📋 필수 컬럼 안내</div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  {['브랜드명','상품명','판매가'].map(h => (
                    <span key={h} style={{background:'#fff', border:'1px solid var(--border)', borderRadius:4, padding:'3px 10px', fontSize:12, fontWeight:600, color:'var(--text)'}}>{h}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 기본: 판매상품 현황
  return (
    <div>
      <div style={{display:'grid', gridTemplateColumns:'240px 1fr', gap:16}}>
        <div className="card" style={{height:'fit-content'}}>
          <div className="card-label">브랜드</div>
          <div onClick={() => setSelBrand(null)}
            style={{padding:'8px 10px', borderRadius:'var(--radius)', cursor:'pointer', background:!selBrand?'#fff3e0':'transparent', fontWeight:!selBrand?700:400, marginBottom:4, fontSize:12}}>
            전체 ({products.length}개)
          </div>
          {brands.map(b => {
            const cnt = products.filter(p => p.brand_id===b.id).length;
            return (
              <div key={b.id} onClick={() => setSelBrand(b)}
                style={{display:'flex', justifyContent:'space-between', padding:'8px 10px', borderRadius:'var(--radius)', cursor:'pointer', background:selBrand?.id===b.id?'#fff3e0':'transparent', marginBottom:2, fontSize:12}}>
                <span style={{fontWeight:selBrand?.id===b.id?700:400, color:selBrand?.id===b.id?'var(--accent)':'var(--text)'}}>{b.name}</span>
                <span style={{fontSize:11, color:'var(--text3)'}}>{cnt}개</span>
              </div>
            );
          })}
        </div>
        <div className="card">
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
            <div className="card-label" style={{marginBottom:0}}>{selBrand ? selBrand.name : '전체'} 상품 현황 ({filteredProducts.length}개)</div>
            <input className="finput" value={pSearch} onChange={e => setPSearch(e.target.value)}
              placeholder="🔍 상품명·코드·ERP코드 검색" style={{height:32, fontSize:12, marginLeft:'auto', width:220}}/>
            {pSearch && <button className="btn-ghost" style={{fontSize:11}} onClick={() => setPSearch('')}>✕</button>}
          </div>
          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead><tr><th>상품코드</th><th>ERP코드</th><th>브랜드</th><th>상품명</th><th className="r">원가</th><th className="r">판매가</th><th style={{width:100, textAlign:'center'}}>수정</th><th></th></tr></thead>
                <tbody>
                  {filteredProducts.length === 0
                    ? <tr><td colSpan={8} className="empty">등록된 상품이 없습니다</td></tr>
                    : filteredProducts.map(p => {
                      const isEditing = !!editing[p.id];
                      const ed = editing[p.id] || {};
                      return (
                        <tr key={p.id} style={{background: isEditing ? '#fffde7' : ''}}>
                          <td className="mono" style={{fontSize:12, color:'var(--text3)'}}>{p.code || '-'}</td>
                          <td className="mono" style={{fontSize:12, color:'var(--text3)'}}>{p.erp_code || '-'}</td>
                          <td><span className="badge badge-dept">{p.brand?.name}</span></td>
                          <td style={{fontWeight:600}}>{p.name}</td>
                          <td className="r">
                            {isEditing
                              ? <input type="number" value={ed.cost} onChange={e => setEditing(prev=>({...prev,[p.id]:{...prev[p.id],cost:e.target.value}}))}
                                  style={{width:90, height:28, padding:'0 6px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', fontSize:12, textAlign:'right', outline:'none'}}/>
                              : <span style={{fontFamily:'var(--mono)', color:'var(--text2)'}}>{p.cost ? Number(p.cost).toLocaleString()+'원' : '-'}</span>
                            }
                          </td>
                          <td className="r">
                            {isEditing
                              ? <input type="number" value={ed.price} onChange={e => setEditing(prev=>({...prev,[p.id]:{...prev[p.id],price:e.target.value}}))}
                                  style={{width:90, height:28, padding:'0 6px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', fontSize:12, textAlign:'right', outline:'none'}}/>
                              : <span style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{Number(p.price).toLocaleString()}원</span>
                            }
                          </td>
                          <td style={{textAlign:'center'}}>
                            {isEditing ? (
                              <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                                <button className="btn btn-p" style={{height:26, padding:'0 10px', fontSize:11}} disabled={saving[p.id]} onClick={() => saveEdit(p)}>
                                  {saving[p.id] ? <span className="spinner"/> : '저장'}
                                </button>
                                <button className="btn btn-s" style={{height:26, padding:'0 8px', fontSize:11}} onClick={() => cancelEdit(p.id)}>취소</button>
                              </div>
                            ) : (
                              <button className="btn btn-s" style={{height:26, padding:'0 10px', fontSize:11}} onClick={() => startEdit(p)}>수정</button>
                            )}
                          </td>
                          <td><button className="btn-danger" onClick={() => deleteProduct(p.id)}>삭제</button></td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 센터재고 페이지
// ════════════════════════════════════════════════════════
function CenterStockPage() {
  const [stocks,   setStocks]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('list');
  const [brands,   setBrands]   = useState([]);
  const [products, setProducts] = useState([]);
  const [editing,  setEditing]  = useState({});
  // 등록 폼
  const [fBrand,   setFBrand]   = useState('');
  const [fProduct, setFProduct] = useState('');
  const [fCode,    setFCode]    = useState('');
  const [fQty,     setFQty]     = useState('');
  const [fNote,    setFNote]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [dragging, setDrag]     = useState(false);
  const [fSearch,  setFSearch]  = useState('');
  const fileRef = useRef();

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('center_stock')
      .select('*, brand:brands(name), product:products(name)')
      .order('updated_at', { ascending: false });
    setStocks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);
  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || []));
  }, []);
  useEffect(() => {
    if (!fBrand) { setProducts([]); setFProduct(''); return; }
    supabase.from('products').select('*').eq('brand_id', fBrand).order('name')
      .then(({ data }) => setProducts(data || []));
    setFProduct('');
  }, [fBrand]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fBrand || !fProduct || fQty === '') { toast('브랜드·상품·수량을 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('center_stock').insert({
      brand_id: Number(fBrand), product_id: Number(fProduct),
      product_code: fCode.trim() || null,
      quantity: Number(fQty), note: fNote.trim() || null,
      updated_at: new Date().toISOString(),
    });
    if (error) toast(error.message, 'err');
    else { toast('센터재고 등록 완료', 'ok'); setFBrand(''); setFProduct(''); setFCode(''); setFQty(''); setFNote(''); fetchStocks(); setTab('list'); }
    setSaving(false);
  };

  const saveQty = async (id, qty) => {
    const { error } = await supabase.from('center_stock').update({ quantity: Number(qty), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('수량 수정 완료', 'ok'); setEditing(p => { const n={...p}; delete n[id]; return n; }); fetchStocks(); }
  };

  const deleteRow = async (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    const { error } = await supabase.from('center_stock').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); fetchStocks(); }
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xls|xlsx)$/i)) { toast('xls, xlsx 파일만 지원합니다', 'err'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        toast(`${rows.length}행 처리 중...`, 'inf');
        let cnt = 0;
        for (const row of rows) {
          const brandName = String(row['브랜드명']||row['브랜드']||'').trim();
          const prodName  = String(row['상품명']||'').trim();
          const code      = String(row['상품코드']||'').trim();
          const qty       = Number(row['수량']||0);
          const note      = String(row['비고']||'').trim();
          if (!brandName || !prodName) continue;
          let { data: br } = await supabase.from('brands').select('id').eq('name', brandName).maybeSingle();
          if (!br) { const { data } = await supabase.from('brands').insert({ name: brandName }).select().single(); br = data; }
          if (!br) continue;
          let { data: pr } = await supabase.from('products').select('id').eq('brand_id', br.id).eq('name', prodName).maybeSingle();
          if (!pr) continue;
          await supabase.from('center_stock').insert({ brand_id: br.id, product_id: pr.id, product_code: code||null, quantity: qty, note: note||null, updated_at: new Date().toISOString() });
          cnt++;
        }
        toast(`${cnt}개 등록 완료`, 'ok'); fetchStocks(); setTab('list');
      } catch(err) { toast('파싱 실패: ' + err.message, 'err'); }
    };
    reader.readAsBinaryString(file);
  };

  const filtered = useMemo(() => {
    if (!fSearch) return stocks;
    const q = fSearch.toLowerCase();
    return stocks.filter(s => s.product?.name?.toLowerCase().includes(q) || s.product_code?.toLowerCase().includes(q));
  }, [stocks, fSearch]);

  const totalQty = useMemo(() => filtered.reduce((s,r) => s + (r.quantity||0), 0), [filtered]);

  const inputStyle = { width:'100%', height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='list'?'on':''}`} onClick={() => setTab('list')}>재고 현황</button>
        <button className={`tab ${tab==='input'?'on':''}`} onClick={() => setTab('input')}>직접 등록</button>
        <button className={`tab ${tab==='upload'?'on':''}`} onClick={() => setTab('upload')}>파일 업로드</button>
      </div>

      {tab === 'list' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div className="fbar">
            <input className="finput" placeholder="상품명 / 상품코드 검색" value={fSearch} onChange={e => setFSearch(e.target.value)}/>
            {fSearch && <button className="btn-ghost" onClick={() => setFSearch('')}>✕</button>}
            <div className="fbar-right">
              <span className="fresult"><b>{filtered.length}</b>개 품목 · 총 <b>{totalQty.toLocaleString()}</b>개</span>
            </div>
          </div>
          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead><tr><th>브랜드</th><th>상품코드</th><th>상품명</th><th className="r">수량</th><th>비고</th><th>수정</th><th>최종수정</th><th></th></tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={8} className="empty">등록된 센터재고가 없습니다</td></tr>
                    : filtered.map(s => (
                      <tr key={s.id}>
                        <td><span className="badge badge-dept">{s.brand?.name||'-'}</span></td>
                        <td className="mono" style={{fontSize:11}}>{s.product_code||'-'}</td>
                        <td style={{fontSize:12}}>{s.product?.name||'-'}</td>
                        <td className="r">
                          {editing[s.id] !== undefined
                            ? <input type="number" value={editing[s.id]} autoFocus
                                onChange={e => setEditing(p => ({...p, [s.id]: e.target.value}))}
                                style={{width:80, height:28, padding:'0 6px', border:'1px solid var(--accent)', borderRadius:4, fontSize:13, textAlign:'right'}}/>
                            : <span style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{s.quantity?.toLocaleString()}</span>
                          }
                        </td>
                        <td style={{fontSize:11, color:'var(--text2)'}}>{s.note||'-'}</td>
                        <td>
                          {editing[s.id] !== undefined
                            ? <div style={{display:'flex', gap:4}}>
                                <button className="btn btn-p" style={{padding:'3px 8px', fontSize:11}} onClick={() => saveQty(s.id, editing[s.id])}>저장</button>
                                <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => setEditing(p => { const n={...p}; delete n[s.id]; return n; })}>취소</button>
                              </div>
                            : <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => setEditing(p => ({...p, [s.id]: s.quantity}))}>수정</button>
                          }
                        </td>
                        <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{s.updated_at ? new Date(s.updated_at).toLocaleDateString('ko-KR') : '-'}</td>
                        <td><button className="btn-danger" onClick={() => deleteRow(s.id)}>삭제</button></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'input' && (
        <div className="card">
          <div className="card-label">센터재고 직접 등록</div>
          <form onSubmit={handleSave}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:14, marginBottom:14}}>
              <div><label style={labelStyle}>브랜드</label>
                <select value={fBrand} onChange={e => setFBrand(e.target.value)} style={inputStyle} required>
                  <option value="">-- 선택 --</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>상품</label>
                <select value={fProduct} onChange={e => setFProduct(e.target.value)} style={{...inputStyle, background:!fBrand?'#f0f0f0':'#fff'}} required disabled={!fBrand}>
                  <option value="">-- 선택 --</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>상품코드 (선택)</label>
                <input value={fCode} onChange={e => setFCode(e.target.value)} style={inputStyle} placeholder="바코드 등"/>
              </div>
              <div><label style={labelStyle}>수량</label>
                <input type="number" min={0} value={fQty} onChange={e => setFQty(e.target.value)} style={inputStyle} placeholder="0" required/>
              </div>
              <div><label style={labelStyle}>비고 (선택)</label>
                <input value={fNote} onChange={e => setFNote(e.target.value)} style={inputStyle} placeholder="입고일, 로트번호 등"/>
              </div>
            </div>
            <button className="btn btn-p" type="submit" disabled={saving} style={{width:'100%', justifyContent:'center', height:40}}>
              {saving ? <span className="spinner"/> : '✓ 센터재고 등록'}
            </button>
          </form>
        </div>
      )}

      {tab === 'upload' && (
        <div className="card">
          <div className="card-label">파일 업로드로 일괄 등록</div>
          <div className={`drop ${dragging?'over':''}`}
            onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
            onClick={()=>fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".xls,.xlsx" onClick={e=>e.stopPropagation()} onChange={e=>{handleFile(e.target.files[0]);e.target.value='';}}/>
            <div className="drop-icon">📂</div>
            <div className="drop-main"><strong>클릭</strong> 또는 <strong>드래그&드롭</strong></div>
            <div className="drop-sub">컬럼: 브랜드명 / 상품명 / 상품코드 / 수량 / 비고</div>
          </div>
          <div style={{marginTop:12, background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:12}}>
            <div style={{fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:6}}>📋 필수 컬럼 안내</div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {['브랜드명','상품명','상품코드 (선택)','수량','비고 (선택)'].map(h => (
                <span key={h} style={{background:'#fff', border:'1px solid var(--border)', borderRadius:4, padding:'3px 10px', fontSize:12, fontWeight:600, color:'var(--text)'}}>{h}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 재고관리 페이지 (인라인 수정)
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// 매장재고 페이지 (store_stock 테이블)
// ════════════════════════════════════════════════════════
function StoreStockPage({ profile }) {
  const isManager  = profile?.job_title === '매니저';
  const [stocks,   setStocks]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [fStore,   setFStore]   = useState(isManager ? (profile?.department||'') : '');
  const [fBranch,  setFBranch]  = useState(isManager ? (profile?.branch||'') : '');
  const [fSearch,  setFSearch]  = useState('');
  const [stores,   setStores]   = useState([]);
  const [branches, setBranches] = useState([]);
  const [editing,  setEditing]  = useState({}); // {id: qty}
  const [saving,   setSaving]   = useState({});

  // 점포/지점 목록
  useEffect(() => {
    supabase.from('store_stock').select('store_name').then(({data}) => {
      const s = [...new Set((data||[]).map(r=>r.store_name).filter(Boolean))].sort();
      setStores(s);
    });
  }, []);

  useEffect(() => {
    if (!fStore) { setBranches([]); return; }
    supabase.from('store_stock').select('branch_name').eq('store_name', fStore).then(({data}) => {
      const b = [...new Set((data||[]).map(r=>r.branch_name).filter(Boolean))].sort();
      setBranches(b);
    });
  }, [fStore]);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('store_stock').select('*').order('store_name').order('branch_name').order('product_name');
    if (fStore)  q = q.eq('store_name',  fStore);
    if (fBranch) q = q.eq('branch_name', fBranch);
    const { data } = await q;
    setStocks(data || []);
    setLoading(false);
  }, [fStore, fBranch]);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);

  // 클라이언트 검색 필터
  const filtered = useMemo(() => {
    if (!fSearch.trim()) return stocks;
    const kw = fSearch.trim().toLowerCase();
    return stocks.filter(s =>
      (s.product_name||'').toLowerCase().includes(kw) ||
      (s.product_code||'').toLowerCase().includes(kw)
    );
  }, [stocks, fSearch]);

  const totalQty = useMemo(() => filtered.reduce((s,r) => s+(r.stock_qty||0), 0), [filtered]);

  // 재고 수정
  const startEdit  = (id, qty) => setEditing(p => ({...p, [id]: qty}));
  const cancelEdit = (id) => setEditing(p => { const n={...p}; delete n[id]; return n; });
  const saveEdit   = async (id) => {
    setSaving(p => ({...p, [id]: true}));
    const qty = Number(editing[id]) || 0;
    const { error } = await supabase.from('store_stock')
      .update({ stock_qty: qty, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('재고 수정 완료', 'ok'); cancelEdit(id); fetchStocks(); }
    setSaving(p => ({...p, [id]: false}));
  };

  // 점포 변경 시 지점 초기화
  const handleStoreChange = (val) => { setFStore(val); setFBranch(''); };

  return (
    <div>
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        {/* 필터 */}
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'14px 20px', borderBottom:'1px solid var(--border)', flexWrap:'wrap'}}>
          {!isManager && (
            <>
              <select className="fsel" value={fStore} onChange={e=>handleStoreChange(e.target.value)}>
                <option value="">전체 점포</option>
                {stores.map(s=><option key={s}>{s}</option>)}
              </select>
              <select className="fsel" value={fBranch} onChange={e=>setFBranch(e.target.value)}
                disabled={!fStore} style={{background:!fStore?'#f0f0f0':'#fff'}}>
                <option value="">전체 지점</option>
                {branches.map(b=><option key={b}>{b}</option>)}
              </select>
            </>
          )}
          <input className="finput" value={fSearch} onChange={e=>setFSearch(e.target.value)}
            placeholder="🔍 상품명·상품코드 검색" style={{height:34, minWidth:200}}/>
          {(fStore||fBranch||fSearch) && !isManager &&
            <button className="btn-ghost" onClick={()=>{setFStore('');setFBranch('');setFSearch('');}}>✕ 초기화</button>}
          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:16}}>
            <span className="fresult">
              <b>{filtered.length.toLocaleString()}</b>개 상품 · 총 재고 <b>{totalQty.toLocaleString()}</b>개
            </span>
          </div>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div> : filtered.length === 0 ? (
          <div className="empty">재고 데이터가 없습니다</div>
        ) : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>점포</th><th>지점</th><th>상품코드</th><th>상품명</th>
                  <th className="r">재고수량</th>
                  {!isManager && <th style={{width:120, textAlign:'center'}}>수정</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isEditing = editing[s.id] !== undefined;
                  const isLow = (s.stock_qty||0) <= 5;
                  return (
                    <tr key={s.id} style={{background: isEditing ? '#fffde7' : ''}}>
                      <td><span className="badge badge-dept">{s.store_name}</span></td>
                      <td><span className="badge badge-store">{s.branch_name}</span></td>
                      <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{s.product_code||'-'}</td>
                      <td style={{fontSize:13}}>{s.product_name}</td>
                      <td className="r">
                        {isEditing ? (
                          <input type="number" min={0} value={editing[s.id]}
                            onChange={e=>setEditing(p=>({...p,[s.id]:e.target.value}))}
                            style={{width:70, height:28, padding:'0 6px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', fontSize:13, textAlign:'right', outline:'none'}}/>
                        ) : (
                          <span style={{fontFamily:'var(--mono)', fontWeight:700,
                            color: (s.stock_qty||0) === 0 ? 'var(--danger)' : isLow ? 'var(--accent)' : 'var(--text)'}}>
                            {(s.stock_qty||0).toLocaleString()}
                            {(s.stock_qty||0) === 0 && <span style={{fontSize:10, marginLeft:4}}>품절</span>}
                            {isLow && (s.stock_qty||0) > 0 && <span style={{fontSize:10, marginLeft:4}}>⚠️</span>}
                          </span>
                        )}
                      </td>
                      {!isManager && (
                        <td style={{textAlign:'center'}}>
                          {isEditing ? (
                            <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                              <button className="btn btn-p" style={{height:26,padding:'0 10px',fontSize:11}}
                                disabled={saving[s.id]} onClick={()=>saveEdit(s.id)}>
                                {saving[s.id]?<span className="spinner"/>:'저장'}
                              </button>
                              <button className="btn btn-s" style={{height:26,padding:'0 8px',fontSize:11}}
                                onClick={()=>cancelEdit(s.id)}>취소</button>
                            </div>
                          ) : (
                            <button className="btn btn-s" style={{height:26,padding:'0 10px',fontSize:11}}
                              onClick={()=>startEdit(s.id, s.stock_qty||0)}>수정</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StockMgmtPage() {
  const [stocks,   setStocks]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState({}); // {id: qty}
  const [fStore,   setFStore]   = useState('');
  const [fBranch,  setFBranch]  = useState('');
  const [tab,      setTab]      = useState('list');
  // 직접 입력
  const [brands,   setBrands]   = useState([]);
  const [products, setProducts] = useState([]);
  const [fBrand,   setFBrand]   = useState('');
  const [fProduct, setFProduct] = useState('');
  const [fSt,      setFSt]      = useState('');
  const [fBr,      setFBr]      = useState('');
  const [fQty,     setFQty]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const fileRef = useRef();

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('stock_status')
      .select('*, brand:brands(name), product:products(name)')
      .order('updated_at', { ascending: false });
    setStocks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);
  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || []));
  }, []);
  useEffect(() => {
    if (!fBrand) { setProducts([]); setFProduct(''); return; }
    supabase.from('products').select('*').eq('brand_id', fBrand).order('name').then(({ data }) => setProducts(data || []));
    setFProduct('');
  }, [fBrand]);

  const stores  = useMemo(() => uniq(stocks.map(s => s.store_name)), [stocks]);
  const branches = useMemo(() => {
    const src = fStore ? stocks.filter(s => s.store_name===fStore) : stocks;
    return uniq(src.map(s => s.branch_name));
  }, [stocks, fStore]);

  const filtered = useMemo(() => {
    let r = stocks;
    if (fStore)  r = r.filter(s => s.store_name===fStore);
    if (fBranch) r = r.filter(s => s.branch_name===fBranch);
    return r;
  }, [stocks, fStore, fBranch]);

  const saveQty = async (id, qty) => {
    const { error } = await supabase.from('stock_status').update({ quantity: Number(qty), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('수량 저장 완료', 'ok'); setEditing(p => { const n={...p}; delete n[id]; return n; }); fetchStocks(); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fBrand || !fProduct || !fSt || !fBr || fQty==='') { toast('모든 항목을 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('stock_status').upsert({
      brand_id: Number(fBrand), product_id: Number(fProduct),
      store_name: fSt, branch_name: fBr, quantity: Number(fQty),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,product_id,store_name,branch_name' });
    if (error) toast(error.message, 'err');
    else { toast('재고 저장 완료', 'ok'); setFQty(''); fetchStocks(); setTab('list'); }
    setSaving(false);
  };

  const [dragging2, setDrag2] = useState(false);
  const fileRef2 = useRef();

  const handleStockFile = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xls|xlsx)$/i)) { toast('xls, xlsx 파일만 지원합니다', 'err'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        toast(`${rows.length}행 처리 중...`, 'inf');
        let cnt = 0;
        for (const row of rows) {
          const brandName = String(row['브랜드명']||row['브랜드']||'').trim();
          const prodName  = String(row['상품명']||'').trim();
          const store     = String(row['점포명']||row['점포']||'').trim();
          const branch    = String(row['지점명']||row['지점']||'').trim();
          const qty       = Number(row['재고수량']||row['수량']||0);
          if (!brandName || !prodName || !store || !branch) continue;
          let { data: br } = await supabase.from('brands').select('id').eq('name', brandName).maybeSingle();
          if (!br) continue;
          let { data: pr } = await supabase.from('products').select('id').eq('brand_id', br.id).eq('name', prodName).maybeSingle();
          if (!pr) continue;
          await supabase.from('stock_status').upsert({
            brand_id: br.id, product_id: pr.id, store_name: store, branch_name: branch,
            quantity: qty, updated_at: new Date().toISOString(),
          }, { onConflict: 'brand_id,product_id,store_name,branch_name' });
          cnt++;
        }
        toast(`${cnt}개 재고 업로드 완료`, 'ok'); fetchStocks();
      } catch(err) { toast('파싱 실패: ' + err.message, 'err'); }
    };
    reader.readAsBinaryString(file);
  };

  const inputStyle = { width:'100%', height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='list'?'on':''}`} onClick={() => setTab('list')}>재고 현황</button>
        <button className={`tab ${tab==='input'?'on':''}`} onClick={() => setTab('input')}>직접 입력</button>
        <button className={`tab ${tab==='upload'?'on':''}`} onClick={() => setTab('upload')}>파일 업로드</button>
      </div>

      {tab === 'list' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div className="fbar">
            <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFBranch(''); }}>
              <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)} disabled={!fStore} style={{background:!fStore?'#f0f0f0':'#fff'}}>
              <option value="">전체 지점</option>{branches.map(b => <option key={b}>{b}</option>)}
            </select>
            {(fStore||fBranch) && <button className="btn-ghost" onClick={() => { setFStore(''); setFBranch(''); }}>✕ 초기화</button>}
            <div className="fbar-right"><span className="fresult"><b>{filtered.length}</b>개 항목</span></div>
          </div>
          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead><tr><th>브랜드</th><th>상품명</th><th>점포</th><th>지점</th><th className="r">재고수량</th><th>수정</th><th>최종수정일</th><th></th></tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={7} className="empty">재고 데이터가 없습니다</td></tr>
                    : filtered.map(s => (
                      <tr key={s.id}>
                        <td>{s.brand?.name||'-'}</td>
                        <td style={{fontSize:12}}>{s.product?.name||'-'}</td>
                        <td><span className="badge badge-dept">{s.store_name}</span></td>
                        <td><span className="badge badge-store">{s.branch_name}</span></td>
                        <td className="r">
                          {editing[s.id] !== undefined ? (
                            <input type="number" value={editing[s.id]}
                              onChange={e => setEditing(p => ({...p, [s.id]: e.target.value}))}
                              style={{width:80, height:28, padding:'0 6px', border:'1px solid var(--accent)', borderRadius:4, fontSize:13, textAlign:'right'}}
                              autoFocus/>
                          ) : (
                            <span style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{s.quantity?.toLocaleString()}</span>
                          )}
                        </td>
                        <td>
                          {editing[s.id] !== undefined ? (
                            <div style={{display:'flex', gap:4}}>
                              <button className="btn btn-p" style={{padding:'3px 8px', fontSize:11}} onClick={() => saveQty(s.id, editing[s.id])}>저장</button>
                              <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => setEditing(p => { const n={...p}; delete n[s.id]; return n; })}>취소</button>
                            </div>
                          ) : (
                            <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => setEditing(p => ({...p, [s.id]: s.quantity}))}>수정</button>
                          )}
                        </td>
                        <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{s.updated_at ? new Date(s.updated_at).toLocaleDateString('ko-KR') : '-'}</td>
                        <td><button className="btn-danger" onClick={async () => {
                          if (!window.confirm('이 재고 항목을 삭제하시겠습니까?')) return;
                          const { error } = await supabase.from('stock_status').delete().eq('id', s.id);
                          if (error) toast(error.message, 'err');
                          else { toast('삭제 완료', 'ok'); fetchStocks(); }
                        }}>삭제</button></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'input' && (
        <div className="card">
          <div className="card-label">재고 직접 입력</div>
          <form onSubmit={handleSave}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:14, marginBottom:14}}>
              <div><label style={labelStyle}>브랜드</label>
                <select value={fBrand} onChange={e => setFBrand(e.target.value)} style={inputStyle} required>
                  <option value="">-- 선택 --</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>상품</label>
                <select value={fProduct} onChange={e => setFProduct(e.target.value)} style={{...inputStyle, background:!fBrand?'#f0f0f0':'#fff'}} required disabled={!fBrand}>
                  <option value="">-- 선택 --</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>점포명</label><input value={fSt} onChange={e => setFSt(e.target.value)} style={inputStyle} placeholder="롯데백화점" required/></div>
              <div><label style={labelStyle}>지점명</label><input value={fBr} onChange={e => setFBr(e.target.value)} style={inputStyle} placeholder="건대스타시티점" required/></div>
              <div><label style={labelStyle}>재고수량</label><input type="number" min={0} value={fQty} onChange={e => setFQty(e.target.value)} style={inputStyle} placeholder="0" required/></div>
            </div>
            <button className="btn btn-p" type="submit" disabled={saving} style={{width:'100%', justifyContent:'center', height:40}}>
              {saving ? <span className="spinner"/> : '✓ 재고 저장'}
            </button>
          </form>
        </div>
      )}

      {tab === 'upload' && (
        <div className="card">
          <div className="card-label">파일 업로드로 재고 일괄 등록</div>
          <div className={`drop ${dragging2?'over':''}`}
            onDragOver={e=>{e.preventDefault();setDrag2(true);}} onDragLeave={()=>setDrag2(false)}
            onDrop={e=>{e.preventDefault();setDrag2(false);handleStockFile(e.dataTransfer.files[0]);}}
            onClick={()=>fileRef2.current?.click()}>
            <input ref={fileRef2} type="file" accept=".xls,.xlsx" onClick={e=>e.stopPropagation()} onChange={e=>{handleStockFile(e.target.files[0]);e.target.value='';}}/>
            <div className="drop-icon">📂</div>
            <div className="drop-main"><strong>클릭</strong> 또는 <strong>드래그&드롭</strong></div>
            <div className="drop-sub">컬럼: 브랜드명 / 상품명 / 점포명 / 지점명 / 재고수량</div>
          </div>
          <div style={{marginTop:12, background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:12}}>
            <div style={{fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:6}}>📋 필수 컬럼 안내</div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {['브랜드명','상품명','점포명','지점명','재고수량'].map(h => (
                <span key={h} style={{background:'#fff', border:'1px solid var(--border)', borderRadius:4, padding:'3px 10px', fontSize:12, fontWeight:600, color:'var(--text)'}}>{h}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 안전재고 확인 페이지
// 최근 1달 판매수량 = 안전재고 기준
// 현재재고 = stock_status
// 부족분 발주요청 기능
// ════════════════════════════════════════════════════════
function SafetyCheckPage({ profile }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [fStore,  setFStore]  = useState('');
  const [fBranch, setFBranch] = useState('');
  const [fSearch, setFSearch] = useState('');
  const [showShort, setShowShort] = useState(false);
  const [requesting, setRequesting] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const fromDate = oneMonthAgo.toISOString().slice(0,10);

    // 최근 1달 판매수량 집계
    const { data: salesData } = await supabase.from('sales')
      .select('store_name, branch_name, brand_id, product_id, quantity, brand:brands(name), product:products(name)')
      .gte('sold_at', fromDate);

    // 현재 재고
    const { data: stockData } = await supabase.from('stock_status')
      .select('store_name, branch_name, brand_id, product_id, quantity');

    // 발주요청 현황
    const { data: orderData } = await supabase.from('order_requests')
      .select('store_name, branch_name, product_id, status')
      .eq('status', 'pending');

    // 판매 집계
    const salesMap = new Map();
    for (const s of (salesData||[])) {
      const key = `${s.store_name}|||${s.branch_name}|||${s.brand_id}|||${s.product_id}`;
      if (!salesMap.has(key)) salesMap.set(key, { ...s, sales: 0 });
      salesMap.get(key).sales += s.quantity;
    }

    // 재고 맵
    const stockMap = new Map();
    for (const s of (stockData||[])) {
      const key = `${s.store_name}|||${s.branch_name}|||${s.brand_id}|||${s.product_id}`;
      stockMap.set(key, s.quantity);
    }

    // 발주 중 맵
    const orderSet = new Set();
    for (const o of (orderData||[])) {
      orderSet.add(`${o.store_name}|||${o.branch_name}|||${o.product_id}`);
    }

    const combined = [...salesMap.values()].map(s => {
      const key  = `${s.store_name}|||${s.branch_name}|||${s.brand_id}|||${s.product_id}`;
      const stockRec = (stockData||[]).find(x =>
        `${x.store_name}|||${x.branch_name}|||${x.brand_id}|||${x.product_id}` === key
      );
      const stock = stockRec?.quantity ?? 0;
      const shortage = s.sales - stock;
      const orderKey = `${s.store_name}|||${s.branch_name}|||${s.product_id}`;
      return {
        store: s.store_name, branch: s.branch_name,
        brandName: s.brand?.name || '-', productName: s.product?.name || '-',
        brandId: s.brand_id, productId: s.product_id,
        stockId: stockRec?.id || null,
        safety: s.sales, stock, shortage,
        isPending: orderSet.has(orderKey),
      };
    }).sort((a,b) => b.shortage - a.shortage);

    setRows(combined);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stores   = useMemo(() => uniq(rows.map(r => r.store)),  [rows]);
  const branches = useMemo(() => uniq((fStore ? rows.filter(r => r.store===fStore) : rows).map(r => r.branch)), [rows, fStore]);

  const filtered = useMemo(() => {
    let r = rows;
    if (fStore)  r = r.filter(x => x.store===fStore);
    if (fBranch) r = r.filter(x => x.branch===fBranch);
    if (fSearch) { const q = fSearch.toLowerCase(); r = r.filter(x => x.productName.toLowerCase().includes(q)); }
    if (showShort) r = r.filter(x => x.shortage > 0);
    return r;
  }, [rows, fStore, fBranch, fSearch, showShort]);

  const shortCount = useMemo(() => rows.filter(r => r.shortage > 0).length, [rows]);

  const requestOrder = async (row) => {
    const key = `${row.store}|||${row.branch}|||${row.productId}`;
    setRequesting(p => ({...p, [key]: true}));
    const { error } = await supabase.from('order_requests').insert({
      store_name: row.store, branch_name: row.branch,
      brand_id: row.brandId, product_id: row.productId,
      safety_qty: row.safety, current_qty: row.stock,
      shortage_qty: row.shortage, status: 'pending',
      requested_by: profile?.id,
    });
    if (error) toast(error.message, 'err');
    else { toast(`${row.branch} - ${row.productName} 발주요청 완료`, 'ok'); fetchData(); }
    setRequesting(p => ({...p, [key]: false}));
  };

  return (
    <div>
      {/* 요약 배너 */}
      {!loading && shortCount > 0 && (
        <div style={{background:'#fff3cd', border:'1px solid #ffc107', borderRadius:'var(--radius)', padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#856404'}}>
          <span>⚠️</span>
          <span>재고 부족 항목 <strong>{shortCount}개</strong> — 안전재고 미달 (최근 1달 판매수량 기준)</span>
          <button className="btn btn-s" style={{marginLeft:'auto', fontSize:11}} onClick={() => setShowShort(v=>!v)}>
            {showShort ? '전체 보기' : '부족 항목만 보기'}
          </button>
        </div>
      )}

      <div className="card" style={{padding:'16px 20px'}}>
        <div className="fbar">
          <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFBranch(''); }}>
            <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)} disabled={!fStore} style={{background:!fStore?'#f0f0f0':'#fff'}}>
            <option value="">전체 지점</option>{branches.map(b => <option key={b}>{b}</option>)}
          </select>
          <input className="finput" placeholder="상품명 검색" value={fSearch} onChange={e => setFSearch(e.target.value)}/>
          {(fStore||fBranch||fSearch) && <button className="btn-ghost" onClick={() => { setFStore(''); setFBranch(''); setFSearch(''); }}>✕ 초기화</button>}
          <div className="fbar-right">
            <span className="fresult"><b>{filtered.length}</b>개 항목</span>
          </div>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>점포</th><th>지점</th><th>브랜드</th><th>상품명</th>
                  <th className="r">안전재고<br/><span style={{fontWeight:400,fontSize:9}}>(1달 판매수량)</span></th>
                  <th className="r">현재재고</th>
                  <th className="r">부족수량</th>
                  <th>발주요청</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={9} className="empty">데이터가 없습니다<br/><span style={{fontSize:11}}>판매 입력 및 재고 등록 후 확인하세요</span></td></tr>
                  : filtered.map((r,i) => {
                    const isShort = r.shortage > 0;
                    const orderKey = `${r.store}|||${r.branch}|||${r.productId}`;
                    return (
                      <tr key={i} style={isShort ? {background:'#fff9f9'} : {}}>
                        <td><span className="badge badge-dept">{r.store}</span></td>
                        <td><span className="badge badge-store">{r.branch}</span></td>
                        <td style={{fontSize:12}}>{r.brandName}</td>
                        <td style={{fontSize:12}}>{r.productName}</td>
                        <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{r.safety.toLocaleString()}</td>
                        <td className="r" style={{fontFamily:'var(--mono)'}}>{r.stock.toLocaleString()}</td>
                        <td className="r">
                          {isShort
                            ? <span style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--danger)'}}>▼ {r.shortage.toLocaleString()}</span>
                            : <span style={{fontFamily:'var(--mono)', color:'var(--success)'}}>+{Math.abs(r.shortage).toLocaleString()}</span>
                          }
                        </td>
                        <td>
                          {isShort && (
                            r.isPending
                              ? <span style={{fontSize:11, color:'var(--text3)', fontWeight:600}}>요청중</span>
                              : <button className="btn btn-p" style={{padding:'4px 10px', fontSize:11}}
                                  disabled={requesting[orderKey]}
                                  onClick={() => requestOrder(r)}>
                                  {requesting[orderKey] ? <span className="spinner"/> : '발주요청'}
                                </button>
                          )}
                        </td>
                        <td>
                          {r.stockId && (
                            <button className="btn-danger" onClick={async () => {
                              if (!window.confirm(`[${r.store} ${r.branch}] ${r.productName} 재고를 삭제하시겠습니까?`)) return;
                              const { error } = await supabase.from('stock_status').delete().eq('id', r.stockId);
                              if (error) toast(error.message, 'err');
                              else { toast('삭제 완료', 'ok'); fetchData(); }
                            }}>삭제</button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 매니저관리 페이지
// ════════════════════════════════════════════════════════
function ManagerMgmtPage() {
  const [members,   setMembers]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [fStore,    setFStore]    = useState('');
  const [fBranch,   setFBranch]   = useState('');
  const [fJob,      setFJob]      = useState('');
  const [fYear,     setFYear]     = useState('');
  const [sortOld,   setSortOld]   = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('store_members')
      .select('*, store:profiles!store_account_id(email, department, branch)')
      .order('store_account_id');
    setMembers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const stores   = useMemo(() => uniq(members.map(m => m.store?.department).filter(Boolean)), [members]);
  const branches = useMemo(() => uniq((fStore ? members.filter(m => m.store?.department===fStore) : members).map(m => m.store?.branch).filter(Boolean)), [members, fStore]);
  const hireYears = useMemo(() => uniq(members.map(m => m.hire_date?.slice(0,4)).filter(Boolean)).sort(), [members]);

  const filtered = useMemo(() => {
    let r = members;
    if (fStore)  r = r.filter(m => m.store?.department===fStore);
    if (fBranch) r = r.filter(m => m.store?.branch===fBranch);
    if (fJob)    r = r.filter(m => m.job_title===fJob);
    if (fYear)   r = r.filter(m => m.hire_date?.startsWith(fYear));
    if (sortOld) r = [...r].sort((a,b) => (a.hire_date||'').localeCompare(b.hire_date||''));
    return r;
  }, [members, fStore, fBranch, fJob, fYear, sortOld]);

  const td = { fontSize:13, color:'var(--text)' };

  return (
    <div>
      <div className="card" style={{padding:'16px 20px'}}>
        <div className="fbar">
          <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFBranch(''); }}>
            <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)} disabled={!fStore} style={{background:!fStore?'#f0f0f0':'#fff'}}>
            <option value="">전체 지점</option>{branches.map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="fsel" value={fJob} onChange={e => setFJob(e.target.value)}>
            <option value="">전체 직급</option>
            <option value="매니저">매니저</option>
            <option value="부매니저">부매니저</option>
          </select>
          <select className="fsel" value={fYear} onChange={e => setFYear(e.target.value)}>
            <option value="">전체 입사연도</option>
            {hireYears.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <button className="btn btn-s" onClick={() => setSortOld(p => !p)}
            style={{fontWeight:700, background: sortOld?'var(--accent)':'', color: sortOld?'#fff':'', borderColor: sortOld?'var(--accent)':''}}>
            {sortOld ? '↑ 오래된순' : '정렬'}
          </button>
          {(fStore||fBranch||fJob||fYear) && <button className="btn-ghost" onClick={() => { setFStore(''); setFBranch(''); setFJob(''); setFYear(''); }}>✕ 초기화</button>}
          <div className="fbar-right"><span className="fresult">근무자 <b>{filtered.length}</b>명</span></div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>점포명</th><th>지점명</th><th>직급</th><th>이름</th><th>연락처</th><th>아이디</th><th>입사일</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={7} className="empty">근무자가 없습니다</td></tr>
                  : filtered.map(m => (
                    <tr key={m.id}>
                      <td><span className="badge badge-dept">{m.store?.department}</span></td>
                      <td><span className="badge badge-store">{m.store?.branch}</span></td>
                      <td style={{...td, fontWeight:600, color: m.job_title==='매니저'?'var(--accent)':'var(--text2)'}}>{m.job_title}</td>
                      <td style={{...td, fontWeight:700}}>{m.display_name || m.name}</td>
                      <td style={td}>{m.phone || '-'}</td>
                      <td style={td}>{m.employee_id}</td>
                      <td style={td}>{m.hire_date || '-'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
// ════════════════════════════════════════════════════════
// 인센티브 조회 페이지 (관리자/담당자)
// ════════════════════════════════════════════════════════
function IncentivePage({ profile }) {
  const [tab, setTab] = useState('condition');

  return (
    <div>
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        {[{key:'condition',label:'📋 급여 조건'},{key:'incentive',label:'🏆 인센티브'},{key:'calc',label:'🧮 급여 계산'}].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ height:38, padding:'0 20px', border:'2px solid', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 120ms',
              borderColor: tab===t.key ? 'var(--accent)' : 'var(--border)',
              background: tab===t.key ? '#fff3e0' : '#fff',
              color: tab===t.key ? 'var(--accent)' : 'var(--text2)' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'condition'  && <SalaryConditionTab profile={profile}/>}
      {tab === 'incentive'  && <IncentiveTab/>}
      {tab === 'calc'       && <SalaryCalcTab/>}
    </div>
  );
}

function IncentiveTab() {
  const [subTab, setSubTab] = useState('target');
  return (
    <div>
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        {[{key:'target',label:'🎯 목표매출 달성 혜택'},{key:'member',label:'👥 회원가입 매출 혜택'}].map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            style={{height:36, padding:'0 18px', border:'2px solid', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 120ms',
              borderColor: subTab===t.key ? 'var(--accent)' : 'var(--border)',
              background: subTab===t.key ? '#fff3e0' : '#fff',
              color: subTab===t.key ? 'var(--accent)' : 'var(--text2)'}}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'target' && <TargetIncentiveTab/>}
      {subTab === 'member' && <MemberIncentiveTab/>}
    </div>
  );
}

function TargetIncentiveTab() {
  const now = new Date();
  const prevM  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonStr = `${prevM.getFullYear()}-${String(prevM.getMonth()+1).padStart(2,'0')}`;
  const curMonStr  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const [selMonth, setSelMonth] = useState(curMonStr);
  const [stores,   setStores]   = useState([]);
  const [sales,    setSales]    = useState({});
  const [targets,  setTargets]  = useState({});
  const [editing,  setEditing]  = useState({});
  const [saving,   setSaving]   = useState({});
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: profiles } = await supabase.from('profiles')
        .select('id, department, branch').eq('approved', true)
        .neq('role','admin').neq('job_title','담당자').order('department');
      setStores((profiles||[]).filter(p => p.branch));
      const prevFrom = `${prevMonStr}-01`;
      const prevLast = new Date(prevM.getFullYear(), prevM.getMonth()+1, 0).getDate();
      const prevTo   = `${prevMonStr}-${String(prevLast).padStart(2,'0')}`;
      const { data: salesData } = await supabase.from('sales')
        .select('branch_name, price, quantity').gte('sold_at', prevFrom).lte('sold_at', prevTo);
      const salesMap = {};
      (salesData||[]).forEach(s => {
        if (!salesMap[s.branch_name]) salesMap[s.branch_name] = 0;
        salesMap[s.branch_name] += (s.price||0) * (s.quantity||0);
      });
      setSales(salesMap);
      const { data: tData } = await supabase.from('incentive_targets')
        .select('branch_name, target_amount').eq('target_month', selMonth);
      const tMap = {};
      (tData||[]).forEach(t => { tMap[t.branch_name] = t.target_amount; });
      setTargets(tMap);
      setLoading(false);
    };
    load();
  }, [selMonth]);

  const handleSave = async (store) => {
    const branch = store.branch;
    const amount = Number(String(editing[branch]||'').replace(/,/g,''));
    if (!amount) return;
    setSaving(p => ({...p, [branch]: true}));
    await supabase.from('incentive_targets').upsert({
      store_name: store.department, branch_name: branch,
      target_month: selMonth, target_amount: amount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'branch_name,target_month' });
    setTargets(p => ({...p, [branch]: amount}));
    setEditing(p => ({...p, [branch]: ''}));
    setSaving(p => ({...p, [branch]: false}));
    toast(`${branch} 목표매출 저장`, 'ok');
  };

  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const fmtAmt = (v) => v ? Number(v).toLocaleString() + '원' : '-';
  const achieveRate = (branch) => {
    const t = targets[branch], s = sales[branch];
    if (!t || !s) return null;
    return Math.round(s / t * 100);
  };

  return (
    <div className="card" style={{padding:0, overflow:'hidden'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'14px 20px', borderBottom:'1px solid var(--border)'}}>
        <span style={{fontSize:13, fontWeight:700}}>목표 월</span>
        <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
          style={{height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span style={{fontSize:12, color:'var(--text3)'}}>전월 매출: {prevMonStr} 기준</span>
      </div>
      {loading ? <div className="empty"><span className="spinner"/></div> : (
        <div className="twrap">
          <table>
            <thead><tr><th>점포</th><th>지점명</th><th className="r">전월 매출</th><th className="r">목표 매출</th><th className="r">달성률</th><th style={{width:200}}>목표 설정</th></tr></thead>
            <tbody>
              {stores.map(s => {
                const branch=s.branch, prevSal=sales[branch]||0, target=targets[branch], rate=achieveRate(branch);
                return (
                  <tr key={s.id}>
                    <td style={{fontSize:13}}><span className="badge badge-dept">{s.department}</span></td>
                    <td style={{fontSize:13}}><span className="badge badge-store">{branch}</span></td>
                    <td className="r" style={{fontSize:13,fontFamily:'var(--mono)',fontWeight:600}}>{prevSal>0?prevSal.toLocaleString()+'원':'-'}</td>
                    <td className="r" style={{fontSize:13,fontFamily:'var(--mono)',fontWeight:700,color:target?'var(--accent)':'var(--text3)'}}>{fmtAmt(target)}</td>
                    <td className="r">{rate!==null?<span style={{padding:'2px 8px',borderRadius:4,fontSize:12,fontWeight:700,background:rate>=100?'#e8f5e9':rate>=80?'#fff3e0':'#ffebee',color:rate>=100?'var(--success)':rate>=80?'var(--accent)':'var(--danger)'}}>{rate}%</span>:'-'}</td>
                    <td style={{padding:'8px 12px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <input type="text" value={editing[branch]??(target?target.toLocaleString():'')}
                          onChange={e=>setEditing(p=>({...p,[branch]:e.target.value.replace(/[^0-9]/g,'')}))}
                          placeholder="금액 입력"
                          style={{flex:1,height:32,padding:'0 8px',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:12,fontFamily:'var(--mono)',outline:'none'}}/>
                        <button className="btn btn-p" style={{height:32,padding:'0 12px',fontSize:12}}
                          disabled={saving[branch]} onClick={()=>handleSave(s)}>
                          {saving[branch]?<span className="spinner"/>:'저장'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MemberIncentiveTab() {
  const now = new Date();
  const curMonStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [selMonth, setSelMonth] = useState(curMonStr);
  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(null);

  const calcIncentive = (amt) => {
    if (amt >= 200000) return 3000;
    if (amt >= 100000) return 2000;
    if (amt >= 20000)  return 1000;
    return 0;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const from = `${selMonth}-01`;
    const lastDay = new Date(selMonth.split('-')[0], selMonth.split('-')[1], 0).getDate();
    const to = `${selMonth}-${String(lastDay).padStart(2,'0')}`;

    const { data: newMembers } = await supabase.from('customers')
      .select('id, name, phone, manager_name, branch_name, store_name')
      .eq('sms_consent', true)
      .gte('joined_at', from).lte('joined_at', to);

    if (!newMembers?.length) { setRows([]); setLoading(false); return; }

    const memberIds = newMembers.map(m => m.id);
    const { data: salesData } = await supabase.from('sales')
      .select('customer_id, price, quantity')
      .in('customer_id', memberIds)
      .gte('sold_at', from).lte('sold_at', to);

    const salesMap = {};
    (salesData||[]).forEach(s => {
      if (!salesMap[s.customer_id]) salesMap[s.customer_id] = 0;
      salesMap[s.customer_id] += (s.price||0) * (s.quantity||0);
    });

    const managerMap = {};
    newMembers.forEach(m => {
      const purchaseAmt = salesMap[m.id] || 0;
      const incentive   = calcIncentive(purchaseAmt);
      if (!m.manager_name) return;
      if (!managerMap[m.manager_name]) {
        managerMap[m.manager_name] = { manager_name:m.manager_name, branch_name:m.branch_name, store_name:m.store_name, members:[], totalIncentive:0 };
      }
      managerMap[m.manager_name].members.push({...m, purchaseAmt, incentive});
      managerMap[m.manager_name].totalIncentive += incentive;
    });

    setRows(Object.values(managerMap).sort((a,b) => b.totalIncentive-a.totalIncentive));
    setLoading(false);
  }, [selMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const grandTotal = rows.reduce((s,r) => s+r.totalIncentive, 0);

  return (
    <div>
      <div style={{background:'#e3f2fd', border:'1px solid #90caf9', borderRadius:'var(--radius)', padding:'10px 16px', marginBottom:12, fontSize:12, color:'#1565C0', lineHeight:1.8}}>
        📌 <strong>회원가입 매출 혜택 기준</strong> — SMS 수신동의 + 가입월 내 구매 시<br/>
        2만원 이상 <strong>1,000원</strong> · 10만원 이상 <strong>2,000원</strong> · 20만원 이상 <strong>3,000원</strong>
      </div>
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'14px 20px', borderBottom:'1px solid var(--border)'}}>
          <span style={{fontSize:13, fontWeight:700}}>조회 월</span>
          <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
            style={{height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div style={{marginLeft:'auto', textAlign:'right'}}>
            <div style={{fontSize:11, color:'var(--text3)'}}>총 인센티브</div>
            <div style={{fontSize:18, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{grandTotal.toLocaleString()}원</div>
          </div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : rows.length===0 ? (
          <div className="empty">{selMonth} 해당 데이터가 없습니다</div>
        ) : (
          <div className="twrap">
            <table>
              <thead><tr><th>점포</th><th>지점</th><th>담당 매니저</th><th className="r">가입+구매 회원수</th><th className="r">인센티브 합계</th><th></th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <>
                    <tr key={r.manager_name} style={{background:expanded===r.manager_name?'#fffde7':''}}>
                      <td><span className="badge badge-dept">{r.store_name}</span></td>
                      <td><span className="badge badge-store">{r.branch_name}</span></td>
                      <td style={{fontSize:13, fontWeight:700}}>{r.manager_name}</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:600}}>{r.members.length}명</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:'var(--accent)'}}>{r.totalIncentive.toLocaleString()}원</td>
                      <td><button className="btn btn-s" style={{fontSize:11}} onClick={()=>setExpanded(expanded===r.manager_name?null:r.manager_name)}>{expanded===r.manager_name?'▲ 닫기':'▼ 상세'}</button></td>
                    </tr>
                    {expanded===r.manager_name && (
                      <tr key={r.manager_name+'_d'}>
                        <td colSpan={6} style={{padding:0, background:'#fffde7'}}>
                          <div style={{padding:'8px 16px 16px'}}>
                            <table style={{width:'100%', borderCollapse:'collapse', fontSize:12, marginTop:8}}>
                              <thead>
                                <tr style={{background:'#fff3e0'}}>
                                  <th style={{padding:'6px 10px', textAlign:'left', fontWeight:600, color:'var(--text2)'}}>회원명</th>
                                  <th style={{padding:'6px 10px', textAlign:'left', fontWeight:600, color:'var(--text2)'}}>연락처</th>
                                  <th style={{padding:'6px 10px', textAlign:'right', fontWeight:600, color:'var(--text2)'}}>당월 구매금액</th>
                                  <th style={{padding:'6px 10px', textAlign:'right', fontWeight:600, color:'var(--text2)'}}>인센티브</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.members.map(m => (
                                  <tr key={m.id} style={{borderBottom:'1px solid #ffcc80'}}>
                                    <td style={{padding:'7px 10px', fontWeight:600}}>{m.name}</td>
                                    <td style={{padding:'7px 10px', fontFamily:'var(--mono)', fontSize:11}}>{m.phone}</td>
                                    <td style={{padding:'7px 10px', textAlign:'right', fontFamily:'var(--mono)'}}>{m.purchaseAmt.toLocaleString()}원</td>
                                    <td style={{padding:'7px 10px', textAlign:'right', fontFamily:'var(--mono)', fontWeight:700, color:m.incentive>0?'var(--accent)':'var(--text3)'}}>
                                      {m.incentive>0?`${m.incentive.toLocaleString()}원`:'해당없음'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                <tr style={{background:'var(--bg3)', borderTop:'2px solid var(--border2)'}}>
                  <td colSpan={5} style={{padding:'10px 11px', fontWeight:700}}>합계</td>
                  <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:'var(--accent)', padding:'10px 11px'}}>{grandTotal.toLocaleString()}원</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SalaryConditionTab({ profile }) {
  const [members,   setMembers]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [fStore,    setFStore]    = useState('');
  const [fBranch,   setFBranch]   = useState('');
  const [fJob,      setFJob]      = useState('');
  const [editing,   setEditing]   = useState(null); // id
  const [editData,  setEditData]  = useState({});
  const [saving,    setSaving]    = useState(false);
  const [histTarget, setHistTarget] = useState(null); // {id, name}
  const [history,   setHistory]   = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('store_members')
      .select('*, store:profiles!store_account_id(department, branch)')
      .order('store_account_id');
    setMembers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const stores   = useMemo(() => uniq(members.map(m => m.store?.department).filter(Boolean)), [members]);
  const branches = useMemo(() => uniq((fStore ? members.filter(m => m.store?.department===fStore) : members).map(m => m.store?.branch).filter(Boolean)), [members, fStore]);
  const filtered = useMemo(() => {
    let r = members;
    if (fStore)  r = r.filter(m => m.store?.department===fStore);
    if (fBranch) r = r.filter(m => m.store?.branch===fBranch);
    if (fJob)    r = r.filter(m => m.job_title===fJob);
    return r;
  }, [members, fStore, fBranch, fJob]);

  const startEdit = (m) => {
    setEditing(m.id);
    setEditData({ salary_type: m.salary_type, salary: m.salary||0, extra_pay: m.extra_pay||0, affiliation: m.affiliation||'', job_title: m.job_title||'' });
  };

  const saveEdit = async (m) => {
    setSaving(true);
    await supabase.from('salary_history').insert({
      store_member_id: m.id,
      branch_name: m.store?.branch,
      member_name: m.name,
      changed_by: profile?.name,
      salary_type: editData.salary_type,
      salary: Number(editData.salary),
      extra_pay: Number(editData.extra_pay),
    });
    const { error } = await supabase.from('store_members').update({
      salary_type: editData.salary_type,
      salary: Number(editData.salary),
      extra_pay: Number(editData.extra_pay),
      affiliation: editData.affiliation,
      job_title: editData.job_title,
    }).eq('id', m.id);
    if (error) toast(error.message, 'err');
    else { toast(`${m.display_name||m.name} 정보 수정 완료`, 'ok'); setEditing(null); fetchMembers(); }
    setSaving(false);
  };

  const showHistory = async (m) => {
    setHistTarget({ id: m.id, name: m.display_name || m.name });
    setHistLoading(true);
    const { data } = await supabase.from('salary_history')
      .select('*').eq('store_member_id', m.id)
      .order('changed_at', { ascending: false }).limit(20);
    setHistory(data || []);
    setHistLoading(false);
  };

  const td = { fontSize:13, color:'var(--text)' };
  const iStyle = { height:32, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:12, fontFamily:'var(--mono)', outline:'none', background:'#fff' };

  return (
    <div>
      {/* 급여 이력 모달 */}
      {histTarget && (
        <div style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={() => setHistTarget(null)}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, padding:'28px 24px', width:'min(560px, 92vw)', maxHeight:'80vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
            onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', alignItems:'center', marginBottom:16}}>
              <div style={{fontSize:17, fontWeight:700}}>{histTarget.name} 급여 변경 이력</div>
              <button onClick={() => setHistTarget(null)} style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999'}}>✕</button>
            </div>
            {histLoading ? <div className="empty"><span className="spinner"/></div> : (
              history.length === 0
                ? <div className="empty">변경 이력이 없습니다</div>
                : <div className="twrap">
                    <table>
                      <thead><tr><th>변경일시</th><th>급여방법</th><th className="r">기본급여</th><th className="r">금토일 추가</th><th>변경자</th></tr></thead>
                      <tbody>
                        {history.map(h => (
                          <tr key={h.id}>
                            <td className="mono" style={{fontSize:11}}>{new Date(h.changed_at).toLocaleString('ko-KR')}</td>
                            <td><span style={{padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                              background: h.salary_type==='월급'?'#e3f2fd':'#f3e5f5',
                              color: h.salary_type==='월급'?'#1565C0':'#6a1b9a'}}>{h.salary_type}</span></td>
                            <td className="r" style={{fontFamily:'var(--mono)', fontWeight:600}}>{(h.salary||0).toLocaleString()}원</td>
                            <td className="r" style={{fontFamily:'var(--mono)', color:'var(--success)'}}>{h.extra_pay>0?`+${(h.extra_pay).toLocaleString()}원`:'-'}</td>
                            <td style={{fontSize:12, color:'var(--text2)'}}>{h.changed_by||'-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{padding:'16px 20px'}}>
        <div className="fbar">
          <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFBranch(''); }}>
            <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)} disabled={!fStore} style={{background:!fStore?'#f0f0f0':'#fff'}}>
            <option value="">전체 지점</option>{branches.map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="fsel" value={fJob} onChange={e => setFJob(e.target.value)}>
            <option value="">전체 직급</option>
            <option value="매니저">매니저</option>
            <option value="부매니저">부매니저</option>
          </select>
          {(fStore||fBranch||fJob) && <button className="btn-ghost" onClick={() => { setFStore(''); setFBranch(''); setFJob(''); }}>✕ 초기화</button>}
          <div className="fbar-right"><span className="fresult">근무자 <b>{filtered.length}</b>명</span></div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>점포</th><th>지점</th><th>소속</th><th>직급</th><th>이름</th><th>연락처</th><th>급여방법</th><th className="r">기본급여</th><th className="r">금·토·일 추가</th><th>관리</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={10} className="empty">근무자가 없습니다</td></tr>
                  : filtered.map(m => {
                    const isEditing = editing === m.id;
                    return (
                      <tr key={m.id}>
                        <td><span className="badge badge-dept">{m.store?.department}</span></td>
                        <td><span className="badge badge-store">{m.store?.branch}</span></td>
                        <td style={td}>
                          {isEditing ? (
                            <select value={editData.affiliation} onChange={e => setEditData(p=>({...p, affiliation:e.target.value}))}
                              style={{...iStyle, width:100}}>
                              <option value="한국생활건강">한국생활건강</option>
                              <option value="신우">신우</option>
                              <option value="사업소득">사업소득</option>
                            </select>
                          ) : m.affiliation || '-'}
                        </td>
                        <td>
                          {isEditing ? (
                            <select value={editData.job_title} onChange={e => setEditData(p=>({...p, job_title:e.target.value}))}
                              style={{...iStyle, width:90}}>
                              <option value="매니저">매니저</option>
                              <option value="부매니저">부매니저</option>
                            </select>
                          ) : (
                            <span style={{...td, fontWeight:600, color: m.job_title==='매니저'?'var(--accent)':'var(--text2)'}}>{m.job_title}</span>
                          )}
                        </td>
                        <td style={{...td, fontWeight:700}}>{m.display_name || m.name}</td>
                        <td style={td}>{m.phone || '-'}</td>
                        <td>
                          {isEditing ? (
                            <select value={editData.salary_type} onChange={e => setEditData(p=>({...p, salary_type:e.target.value}))}
                              style={{...iStyle, width:70}}>
                              <option value="월급">월급</option>
                              <option value="일급">일급</option>
                            </select>
                          ) : (
                            <span style={{padding:'2px 8px', borderRadius:4, fontSize:12, fontWeight:600,
                              background: m.salary_type==='월급'?'#e3f2fd':'#f3e5f5',
                              color: m.salary_type==='월급'?'#1565C0':'#6a1b9a'}}>
                              {m.salary_type}
                            </span>
                          )}
                        </td>
                        <td className="r">
                          {isEditing ? (
                            <input type="number" value={editData.salary} onChange={e => setEditData(p=>({...p, salary:e.target.value}))}
                              style={{...iStyle, width:100, textAlign:'right'}}/>
                          ) : (
                            <span style={{...td, fontWeight:700, fontFamily:'var(--mono)'}}>{(m.salary||0).toLocaleString()}원</span>
                          )}
                        </td>
                        <td className="r">
                          {isEditing ? (
                            <input type="number" value={editData.extra_pay} onChange={e => setEditData(p=>({...p, extra_pay:e.target.value}))}
                              style={{...iStyle, width:80, textAlign:'right'}}/>
                          ) : (
                            <span style={{...td, fontFamily:'var(--mono)', color: m.extra_pay>0?'var(--success)':'var(--text3)'}}>
                              {m.extra_pay > 0 ? `+${(m.extra_pay).toLocaleString()}원` : '-'}
                            </span>
                          )}
                        </td>
                        <td>
                            {isEditing ? (
                              <div style={{display:'flex', gap:4}}>
                                <button className="btn btn-p" style={{padding:'3px 8px', fontSize:11}} onClick={() => saveEdit(m)} disabled={saving}>
                                  {saving ? <span className="spinner"/> : '저장'}
                                </button>
                                <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => setEditing(null)}>취소</button>
                              </div>
                            ) : (
                              <div style={{display:'flex', gap:4}}>
                                <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => startEdit(m)}>수정</button>
                                <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => showHistory(m)}>이력</button>
                              </div>
                            )}
                          </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AttendanceCalendarModal({ member, year, month, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    supabase.from('attendance').select('*')
      .eq('manager_name', member.name)
      .gte('work_date', from).lte('work_date', to)
      .then(({ data }) => { setRecords(data || []); setLoading(false); });
  }, [member.name, year, month]);

  const recMap = {};
  records.forEach(r => { recMap[r.work_date] = r; });

  const fmt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const duration = (ci, co) => {
    if (!ci || !co) return '';
    const m = Math.round((new Date(co) - new Date(ci)) / 60000);
    return `${Math.floor(m/60)}h${m%60}m`;
  };
  const dailySalary = (dateStr) => {
    if (member.salary_type === '월급') return null;
    const dow = new Date(dateStr).getDay();
    const isFriSatSun = dow === 0 || dow === 5 || dow === 6;
    return (member.salary || 0) + (isFriSatSun ? (member.extra_pay || 0) : 0);
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const dayNames = ['일','월','화','수','목','금','토'];

  return (
    <div style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}
      onClick={onClose}>
      <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}}/>
      <div style={{position:'relative', background:'#fff', borderRadius:16, padding:'28px 28px', width:'min(940px, 96vw)', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
        onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={{display:'flex', alignItems:'center', marginBottom:20}}>
          <div>
            <div style={{fontSize:20, fontWeight:700}}>{member.display_name || member.name} 출근표</div>
            <div style={{fontSize:13, color:'var(--text2)', marginTop:3}}>
              {year}년 {month}월 · {member.store?.branch} · {member.salary_type}
              {member.salary_type === '일급' && ` (기본 ${(member.salary||0).toLocaleString()}원${member.extra_pay ? ` / 금토일 +${(member.extra_pay).toLocaleString()}원` : ''})`}
            </div>
          </div>
          <button onClick={onClose}
            style={{marginLeft:'auto', background:'none', border:'none', fontSize:24, cursor:'pointer', color:'#999', lineHeight:1}}>✕</button>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <>
            {/* 요일 헤더 */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, marginBottom:6}}>
              {dayNames.map((d,i) => (
                <div key={d} style={{textAlign:'center', fontSize:13, fontWeight:700, padding:'8px 0',
                  background:'#f5f5f5', borderRadius:6,
                  color: i===0?'#c62828':i===6?'#1565C0':'var(--text3)'}}>
                  {d}
                </div>
              ))}
            </div>

            {/* 달력 */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6}}>
              {Array.from({length: firstDow}).map((_,i) => <div key={`e${i}`}/>)}
              {Array.from({length: daysInMonth}).map((_,i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const dow = (firstDow + i) % 7;
                const isSun = dow === 0, isSat = dow === 6, isFri = dow === 5;
                const rec = recMap[dateStr];
                const sal = dailySalary(dateStr);
                const isWeekend = isSun || isSat || isFri;

                return (
                  <div key={day} style={{
                    borderRadius:8, padding:'8px 8px', minHeight:110,
                    background: rec ? (isWeekend ? '#fff3e0' : '#e8f5e9') : '#fafafa',
                    border: `1px solid ${rec ? (isWeekend ? '#ffcc80' : '#a5d6a7') : '#e0e0e0'}`,
                  }}>
                    <div style={{fontSize:14, fontWeight:700, marginBottom:5,
                      color: isSun?'#c62828': isSat?'#1565C0': isFri?'#2e7d32':'var(--text)'}}>
                      {day}
                    </div>
                    {rec ? (
                      <div style={{fontSize:11, lineHeight:1.9}}>
                        {rec.clock_in  && <div style={{color:'#2E7D32', fontWeight:600}}>↑ {fmt(rec.clock_in)}</div>}
                        {rec.clock_out && <div style={{color:'#C62828', fontWeight:600}}>↓ {fmt(rec.clock_out)}</div>}
                        {rec.clock_in && rec.clock_out && (
                          <div style={{color:'var(--text2)', fontWeight:600}}>{duration(rec.clock_in, rec.clock_out)}</div>
                        )}
                        {sal !== null && (
                          <div style={{color:'var(--accent)', fontWeight:700, marginTop:3, fontSize:12}}>
                            {sal.toLocaleString()}원
                          </div>
                        )}
                        {member.salary_type === '월급' && rec && (
                          <div style={{color:'#1565C0', fontSize:10, marginTop:2}}>월급제</div>
                        )}
                      </div>
                    ) : (
                      <div style={{fontSize:11, color:'#ccc', marginTop:6}}>휴무</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 요약 */}
            <div style={{marginTop:20, padding:'14px 20px', background:'#f8f8f8', borderRadius:10, display:'flex', gap:32, flexWrap:'wrap', alignItems:'center'}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:11, color:'var(--text3)', marginBottom:3}}>출근일수</div>
                <div style={{fontSize:20, fontWeight:700, fontFamily:'var(--mono)'}}>{records.length}일</div>
              </div>
              {member.salary_type === '일급' && (
                <>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:11, color:'var(--text3)', marginBottom:3}}>평일</div>
                    <div style={{fontSize:20, fontWeight:700, fontFamily:'var(--mono)'}}>{records.filter(r => {const d=new Date(r.work_date).getDay(); return d!==0&&d!==5&&d!==6;}).length}일</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:11, color:'var(--text3)', marginBottom:3}}>금·토·일</div>
                    <div style={{fontSize:20, fontWeight:700, fontFamily:'var(--mono)', color:'var(--success)'}}>{records.filter(r => {const d=new Date(r.work_date).getDay(); return d===0||d===5||d===6;}).length}일</div>
                  </div>
                </>
              )}
              <div style={{marginLeft:'auto', textAlign:'right'}}>
                <div style={{fontSize:11, color:'var(--text3)', marginBottom:3}}>이번 달 지급액</div>
                <div style={{fontSize:24, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{member.salary.toLocaleString()}원</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SalaryCalcTab() {
  const now = new Date();
  const defaultYear  = now.getMonth() === 0 ? now.getFullYear()-1 : now.getFullYear();
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const [selYear,   setSelYear]   = useState(defaultYear);
  const [selMonth,  setSelMonth]  = useState(defaultMonth);
  const [rows,      setRows]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [fStore,    setFStore]    = useState('');
  const [calTarget, setCalTarget] = useState(null);

  const calcSalary = useCallback(async () => {
    setLoading(true);
    const from = `${selYear}-${String(selMonth).padStart(2,'0')}-01`;
    const lastDay = new Date(selYear, selMonth, 0).getDate();
    const to = `${selYear}-${String(selMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

    const { data: members } = await supabase.from('store_members')
      .select('*, store:profiles!store_account_id(department, branch)');
    const { data: att } = await supabase.from('attendance')
      .select('manager_name, work_date').gte('work_date', from).lte('work_date', to);

    // 회원가입 인센티브 계산
    const calcIncentive = (amt) => {
      if (amt >= 200000) return 3000;
      if (amt >= 100000) return 2000;
      if (amt >= 20000)  return 1000;
      return 0;
    };
    // 해당 월 신규 가입 + SMS 동의 회원
    const { data: newCustomers } = await supabase.from('customers')
      .select('id, manager_name').eq('sms_consent', true)
      .gte('joined_at', from).lte('joined_at', to);
    // 해당 회원들의 당월 구매액
    const custIds = (newCustomers||[]).map(c => c.id);
    let custSalesMap = {};
    if (custIds.length > 0) {
      const { data: custSales } = await supabase.from('sales')
        .select('customer_id, price, quantity')
        .in('customer_id', custIds)
        .gte('sold_at', from).lte('sold_at', to);
      (custSales||[]).forEach(s => {
        if (!custSalesMap[s.customer_id]) custSalesMap[s.customer_id] = 0;
        custSalesMap[s.customer_id] += (s.price||0) * (s.quantity||0);
      });
    }
    // 매니저별 인센티브 합산
    const managerIncentiveMap = {};
    (newCustomers||[]).forEach(c => {
      if (!c.manager_name) return;
      const inc = calcIncentive(custSalesMap[c.id] || 0);
      if (!managerIncentiveMap[c.manager_name]) managerIncentiveMap[c.manager_name] = 0;
      managerIncentiveMap[c.manager_name] += inc;
    });

    const attMap = {};
    (att || []).forEach(r => {
      if (!attMap[r.manager_name]) attMap[r.manager_name] = [];
      attMap[r.manager_name].push(r.work_date);
    });

    const result = (members || []).map(m => {
      const dates = attMap[m.name] || [];
      let salary = 0, weekdays = 0, weekends = 0;
      if (m.salary_type === '월급') {
        salary = m.salary || 0;
      } else {
        dates.forEach(d => {
          const dow = new Date(d).getDay();
          const isFriSatSun = dow === 0 || dow === 5 || dow === 6;
          if (isFriSatSun) { salary += (m.salary||0) + (m.extra_pay||0); weekends++; }
          else             { salary += (m.salary||0); weekdays++; }
        });
      }
      const memberIncentive = managerIncentiveMap[m.name] || 0;
      return { ...m, totalDays: dates.length, weekdays, weekends, salary, memberIncentive, totalPay: salary + memberIncentive };
    });

    setRows(result.sort((a,b) => (a.store?.department||'').localeCompare(b.store?.department||'')));
    setLoading(false);
  }, [selYear, selMonth]);

  useEffect(() => { calcSalary(); }, [calcSalary]);

  const stores = useMemo(() => uniq(rows.map(r => r.store?.department).filter(Boolean)), [rows]);
  const filtered = useMemo(() => fStore ? rows.filter(r => r.store?.department===fStore) : rows, [rows, fStore]);
  const totalSalary = useMemo(() => filtered.reduce((s,r) => s+r.totalPay, 0), [filtered]);
  const years  = Array.from({length:5}, (_,i) => now.getFullYear() - i);
  const months = Array.from({length:12}, (_,i) => i+1);

  return (
    <div>
      {calTarget && (
        <AttendanceCalendarModal member={calTarget} year={selYear} month={selMonth}
          onClose={() => setCalTarget(null)} />
      )}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', padding:'14px 20px', borderBottom:'1px solid var(--border)'}}>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
            style={{height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}>
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
            style={{height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}>
            {months.map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
          <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
            <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
          </select>
          {fStore && <button className="btn-ghost" onClick={() => setFStore('')}>✕</button>}
          <div style={{marginLeft:'auto', textAlign:'right'}}>
            <div style={{fontSize:11, color:'var(--text3)', marginBottom:2}}>총 인건비</div>
            <div style={{fontSize:20, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{totalSalary.toLocaleString()}원</div>
          </div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>점포</th><th>지점</th><th>직급</th><th>이름</th><th>급여방법</th><th className="r">출근 (평일/금토일)</th><th className="r">기본급여</th><th className="r">회원 인센티브</th><th className="r">합계 지급액</th><th style={{width:70, textAlign:'center'}}>상세</th></tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id}>
                    <td style={{padding:'12px 12px'}}><span className="badge badge-dept">{m.store?.department}</span></td>
                    <td style={{padding:'12px 12px'}}><span className="badge badge-store">{m.store?.branch}</span></td>
                    <td style={{padding:'12px 12px', fontSize:13, fontWeight:600, color: m.job_title==='매니저'?'var(--accent)':'var(--text2)'}}>{m.job_title}</td>
                    <td style={{padding:'12px 12px', fontSize:13, fontWeight:700}}>{m.display_name || m.name}</td>
                    <td style={{padding:'12px 12px'}}><span style={{padding:'2px 8px', borderRadius:4, fontSize:12, fontWeight:600, background: m.salary_type==='월급'?'#e3f2fd':'#f3e5f5', color: m.salary_type==='월급'?'#1565C0':'#6a1b9a'}}>{m.salary_type}</span></td>
                    <td className="r" style={{padding:'12px 12px', fontSize:13, fontFamily:'var(--mono)'}}>
                      {m.salary_type==='월급' ? '-' : (
                        <span>{m.totalDays}일 <span style={{fontSize:11, color:'var(--text3)'}}>({m.weekdays}/{m.weekends})</span></span>
                      )}
                    </td>
                    <td className="r" style={{padding:'12px 12px', fontSize:13, fontFamily:'var(--mono)', color:'var(--text2)'}}>{m.salary.toLocaleString()}원</td>
                    <td className="r" style={{padding:'12px 12px', fontSize:13, fontFamily:'var(--mono)', fontWeight: m.memberIncentive>0?700:400, color: m.memberIncentive>0?'var(--success)':'var(--text3)'}}>
                      {m.memberIncentive>0 ? `+${m.memberIncentive.toLocaleString()}원` : '-'}
                    </td>
                    <td className="r" style={{padding:'12px 12px', fontSize:13, fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{m.totalPay.toLocaleString()}원</td>
                    <td style={{padding:'12px 6px', textAlign:'center'}}>
                      <button className="btn btn-s" style={{fontSize:11, padding:'4px 10px'}} onClick={() => setCalTarget(m)}>상세보기</button>
                    </td>
                  </tr>
                ))}
                <tr style={{background:'var(--bg3)', borderTop:'2px solid var(--border2)'}}>
                  <td colSpan={6} style={{padding:'10px 11px', fontWeight:700}}>합계</td>
                  <td className="r" style={{fontFamily:'var(--mono)', fontWeight:600, padding:'10px 11px', color:'var(--text2)'}}>{filtered.reduce((s,r)=>s+r.salary,0).toLocaleString()}원</td>
                  <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, padding:'10px 11px', color:'var(--success)'}}>
                    {filtered.reduce((s,r)=>s+r.memberIncentive,0)>0?`+${filtered.reduce((s,r)=>s+r.memberIncentive,0).toLocaleString()}원`:'-'}
                  </td>
                  <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:'var(--accent)', padding:'10px 11px'}}>{totalSalary.toLocaleString()}원</td>
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StockStatusPage() {
  const [tab, setTab] = useState('list'); // 'list' | 'input' | 'upload'
  const [stocks, setStocks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [brands, setBrands]   = useState([]);
  const [products, setProducts] = useState([]);
  // 직접 입력 폼
  const [fBrand,   setFBrand]   = useState('');
  const [fProduct, setFProduct] = useState('');
  const [fStore,   setFStore]   = useState('');
  const [fBranch,  setFBranch]  = useState('');
  const [fQty,     setFQty]     = useState('');
  const [saving,   setSaving]   = useState(false);
  // 파일 업로드
  const [dragging, setDrag]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('stock_status')
      .select('*, brand:brands(name), product:products(name)')
      .order('updated_at', { ascending: false });
    setStocks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);
  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || []));
  }, []);
  useEffect(() => {
    if (!fBrand) { setProducts([]); setFProduct(''); return; }
    supabase.from('products').select('*').eq('brand_id', fBrand).order('name')
      .then(({ data }) => setProducts(data || []));
    setFProduct('');
  }, [fBrand]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fBrand || !fProduct || !fStore || !fBranch || fQty === '') { toast('모든 항목을 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('stock_status').upsert({
      brand_id: Number(fBrand), product_id: Number(fProduct),
      store_name: fStore, branch_name: fBranch, quantity: Number(fQty),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,product_id,store_name,branch_name' });
    if (error) toast(error.message, 'err');
    else { toast('재고 저장 완료', 'ok'); setFQty(''); fetchStocks(); setTab('list'); }
    setSaving(false);
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xls|xlsx)$/i)) { toast('xls, xlsx 파일만 지원합니다', 'err'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        toast(`${rows.length}행 감지 — 브랜드/상품 매핑 후 저장해주세요`, 'inf');
      } catch(err) { toast('파싱 실패: ' + err.message, 'err'); }
      setUploading(false);
    };
    reader.readAsBinaryString(file);
  };

  const inputStyle = { width:'100%', height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='list'?'on':''}`} onClick={() => setTab('list')}>재고 현황</button>
        <button className={`tab ${tab==='input'?'on':''}`} onClick={() => setTab('input')}>직접 입력</button>
        <button className={`tab ${tab==='upload'?'on':''}`} onClick={() => setTab('upload')}>파일 업로드</button>
      </div>

      {tab === 'list' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div className="card-label">재고 현황</div>
          {loading ? <div className="empty"><span className="spinner"/></div> : stocks.length === 0 ? (
            <div className="empty">등록된 재고 데이터가 없습니다<br/><span style={{fontSize:11}}>직접 입력 또는 파일 업로드로 등록하세요</span></div>
          ) : (
            <div className="twrap">
              <table>
                <thead><tr><th>브랜드</th><th>상품명</th><th>점포</th><th>지점</th><th className="r">재고수량</th><th className="td-m" style={{fontSize:10}}>최종수정</th></tr></thead>
                <tbody>
                  {stocks.map((s,i) => (
                    <tr key={i}>
                      <td>{s.brand?.name || '-'}</td>
                      <td style={{fontSize:12}}>{s.product?.name || '-'}</td>
                      <td><span className="badge badge-dept">{s.store_name}</span></td>
                      <td><span className="badge badge-store">{s.branch_name}</span></td>
                      <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--accent)'}}>{s.quantity?.toLocaleString()}</td>
                      <td className="mono">{s.updated_at ? new Date(s.updated_at).toLocaleDateString('ko-KR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'input' && (
        <div className="card">
          <div className="card-label">재고 직접 입력</div>
          <form onSubmit={handleSave}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14, marginBottom:14}}>
              <div><label style={labelStyle}>브랜드</label>
                <select value={fBrand} onChange={e => setFBrand(e.target.value)} style={inputStyle} required>
                  <option value="">-- 선택 --</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>상품</label>
                <select value={fProduct} onChange={e => setFProduct(e.target.value)} style={{...inputStyle, background:!fBrand?'#f0f0f0':'#fff'}} required disabled={!fBrand}>
                  <option value="">-- 선택 --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>점포명</label>
                <input value={fStore} onChange={e => setFStore(e.target.value)} style={inputStyle} placeholder="롯데백화점" required/>
              </div>
              <div><label style={labelStyle}>지점명</label>
                <input value={fBranch} onChange={e => setFBranch(e.target.value)} style={inputStyle} placeholder="건대스타시티점" required/>
              </div>
              <div><label style={labelStyle}>재고수량</label>
                <input type="number" min={0} value={fQty} onChange={e => setFQty(e.target.value)} style={inputStyle} placeholder="0" required/>
              </div>
            </div>
            <button className="btn btn-p" type="submit" disabled={saving} style={{width:'100%',justifyContent:'center',height:40}}>
              {saving ? <span className="spinner"/> : '✓ 재고 저장'}
            </button>
          </form>
        </div>
      )}

      {tab === 'upload' && (
        <div className="card">
          <div className="card-label">파일 업로드</div>
          <div className={`drop ${dragging?'over':''}`}
            onDragOver={e=>{e.preventDefault();setDrag(true);}}
            onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
            onClick={()=>fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".xls,.xlsx" onClick={e=>e.stopPropagation()} onChange={e=>{handleFile(e.target.files[0]);e.target.value='';}}/>
            {uploading
              ? <><div className="drop-icon"><span className="spinner"/></div><div className="drop-main">처리 중...</div></>
              : <><div className="drop-icon">📂</div><div className="drop-main"><strong>클릭</strong> 또는 <strong>드래그&드롭</strong></div><div className="drop-sub">브랜드 / 상품 / 점포 / 지점 / 재고수량 컬럼 포함 엑셀 (.xls / .xlsx)</div></>
            }
          </div>
          <div style={{marginTop:14, background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:14}}>
            <div style={{fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:8}}>📋 업로드 파일 양식 안내</div>
            <div className="twrap">
              <table style={{fontSize:11}}>
                <thead><tr><th>브랜드명</th><th>상품명</th><th>점포명</th><th>지점명</th><th>재고수량</th></tr></thead>
                <tbody>
                  <tr><td>팔레오</td><td>팔레오_닥터스노트...</td><td>롯데백화점</td><td>건대스타시티점</td><td>100</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// 본사 메뉴 (드롭다운 포함)
// ════════════════════════════════════════════════════════
// 출근/퇴근 체크 페이지
// ════════════════════════════════════════════════════════
function ClockInOutPage({ profile }) {
  const [today,    setToday]    = useState(null); // 오늘 출퇴근 레코드
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [history,  setHistory]  = useState([]);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: todayRec } = await supabase.from('attendance')
      .select('*').eq('manager_id', profile.id).eq('work_date', todayStr()).maybeSingle();
    setToday(todayRec);
    const { data: hist } = await supabase.from('attendance')
      .select('*').eq('manager_id', profile.id)
      .order('work_date', { ascending: false }).limit(20);
    setHistory(hist || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleClock = async (type) => {
    setSaving(true);
    const now = new Date().toISOString();
    if (type === 'in') {
      if (today) { toast('오늘은 이미 출근 처리됐습니다', 'err'); setSaving(false); return; }
      const { error } = await supabase.from('attendance').insert({
        manager_id: profile.id, manager_name: profile.name,
        store_name: profile.department, branch_name: profile.branch,
        work_date: todayStr(), clock_in: now,
      });
      if (error) toast(error.message, 'err');
      else toast('출근 체크 완료 ✅', 'ok');
    } else {
      if (!today) { toast('출근 체크를 먼저 해주세요', 'err'); setSaving(false); return; }
      if (today.clock_out) { toast('오늘은 이미 퇴근 처리됐습니다', 'err'); setSaving(false); return; }
      const { error } = await supabase.from('attendance').update({ clock_out: now }).eq('id', today.id);
      if (error) toast(error.message, 'err');
      else toast('퇴근 체크 완료 ✅', 'ok');
    }
    fetchData();
    setSaving(false);
  };

  const fmt = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const duration = (ci, co) => {
    if (!ci || !co) return '-';
    const m = Math.round((new Date(co) - new Date(ci)) / 60000);
    return `${Math.floor(m/60)}시간 ${m%60}분`;
  };

  if (loading) return <div className="empty"><span className="spinner"/></div>;

  return (
    <div>
      {/* 오늘 상태 카드 */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
          <div style={{fontSize:13, fontWeight:700, color:'var(--text)'}}>
            📍 {profile.department} · {profile.branch}
          </div>
          <div style={{marginLeft:'auto', fontFamily:'var(--mono)', fontSize:12, color:'var(--text3)'}}>
            {todayStr()} (오늘)
          </div>
        </div>

        {/* 상태 표시 */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20}}>
          {[
            { label:'출근 시각', value: today ? fmt(today.clock_in) : '-', color: today ? 'var(--success)' : 'var(--text3)' },
            { label:'퇴근 시각', value: today?.clock_out ? fmt(today.clock_out) : '-', color: today?.clock_out ? 'var(--accent)' : 'var(--text3)' },
            { label:'근무 시간', value: duration(today?.clock_in, today?.clock_out), color: 'var(--text)' },
          ].map(s => (
            <div key={s.label} style={{background:'var(--bg3)', borderRadius:'var(--radius)', padding:'14px 16px', textAlign:'center'}}>
              <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:22, fontWeight:700, fontFamily:'var(--mono)', color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* 버튼 */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <button
            onClick={() => handleClock('in')} disabled={saving || !!today}
            style={{height:56, fontSize:16, fontWeight:700, borderRadius:'var(--radius)', border:'none', cursor: today ? 'not-allowed' : 'pointer',
              background: today ? '#e0e0e0' : 'var(--success)', color: today ? '#aaa' : '#fff'}}>
            {saving ? <span className="spinner"/> : today ? '✅ 출근 완료' : '🟢 출근'}
          </button>
          <button
            onClick={() => handleClock('out')} disabled={saving || !today || !!today?.clock_out}
            style={{height:56, fontSize:16, fontWeight:700, borderRadius:'var(--radius)', border:'none',
              cursor: (!today || today?.clock_out) ? 'not-allowed' : 'pointer',
              background: today?.clock_out ? '#e0e0e0' : (today ? 'var(--accent)' : '#e0e0e0'),
              color: (!today || today?.clock_out) ? '#aaa' : '#fff'}}>
            {saving ? <span className="spinner"/> : today?.clock_out ? '✅ 퇴근 완료' : '🔴 퇴근'}
          </button>
        </div>
      </div>

      {/* 최근 이력 */}
      <div className="card">
        <div className="card-label">최근 출퇴근 이력</div>
        <div className="twrap">
          <table>
            <thead><tr><th>날짜</th><th>출근</th><th>퇴근</th><th>근무시간</th></tr></thead>
            <tbody>
              {history.length === 0
                ? <tr><td colSpan={4} className="empty">이력이 없습니다</td></tr>
                : history.map(r => (
                  <tr key={r.id}>
                    <td className="mono">{r.work_date}</td>
                    <td style={{color:'var(--success)', fontWeight:600, fontFamily:'var(--mono)'}}>{fmt(r.clock_in)}</td>
                    <td style={{color:'var(--accent)', fontWeight:600, fontFamily:'var(--mono)'}}>{fmt(r.clock_out)}</td>
                    <td className="mono" style={{color:'var(--text2)'}}>{duration(r.clock_in, r.clock_out)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 휴무 신청 페이지
// ════════════════════════════════════════════════════════
function LeavePlanPage({ profile }) {
  const [saving,    setSaving]    = useState(false);
  const [myPlans,   setMyPlans]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selDates,  setSelDates]  = useState([]);
  const [memo,      setMemo]      = useState('');
  const [editingId, setEditingId] = useState(null);
  const [members,   setMembers]   = useState([]);
  const [selMember, setSelMember] = useState(null);

  useEffect(() => {
    supabase.from('store_members').select('name, display_name, job_title')
      .eq('store_account_id', profile.id).order('is_primary', { ascending: false })
      .then(({ data }) => { setMembers(data || []); if (data?.length === 1) setSelMember(data[0]); });
  }, [profile.id]);

  // 익월 계산
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextYear  = nextMonth.getFullYear();
  const nextMon   = nextMonth.getMonth();
  const nextMonStr = `${nextYear}-${String(nextMon + 1).padStart(2,'0')}`;
  const daysInMonth = new Date(nextYear, nextMon + 1, 0).getDate();
  const firstDow = new Date(nextYear, nextMon, 1).getDay();

  const fetchPlans = useCallback(async () => {
    if (!selMember) return;
    setLoading(true);
    const { data } = await supabase.from('leave_plans')
      .select('*').eq('manager_id', profile.id).eq('manager_name', selMember.name)
      .order('created_at', { ascending: false });
    setMyPlans(data || []);
    setLoading(false);
  }, [profile.id, selMember]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const pendingNextMonth = myPlans.find(p => p.target_month === nextMonStr && p.status === 'pending');
  const confirmedNextMonth = myPlans.find(p => p.target_month === nextMonStr && p.status !== 'pending');

  const toggleDate = (dateStr) => {
    setSelDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort()
    );
  };

  const startEdit = (plan) => {
    setEditingId(plan.id);
    setSelDates(plan.dates || []);
    setMemo(plan.memo || '');
  };

  const cancelEdit = () => {
    setEditingId(null); setSelDates([]); setMemo('');
  };

  const handleSubmit = async () => {
    if (!selMember) { toast('근무자를 선택해주세요', 'err'); return; }
    if (selDates.length === 0) { toast('날짜를 하나 이상 선택해주세요', 'err'); return; }
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from('leave_plans').update({
        dates: selDates, memo: memo.trim() || null,
      }).eq('id', editingId);
      if (error) toast(error.message, 'err');
      else { toast('휴무계획 수정 완료', 'ok'); cancelEdit(); fetchPlans(); }
    } else {
      if (pendingNextMonth || confirmedNextMonth) { toast('이미 해당 월 계획을 제출했습니다', 'err'); setSaving(false); return; }
      const { error } = await supabase.from('leave_plans').insert({
        manager_id: profile.id, manager_name: selMember.name,
        store_name: profile.department, branch_name: profile.branch,
        target_month: nextMonStr, dates: selDates, memo: memo.trim() || null,
      });
      if (error) toast(error.message, 'err');
      else { toast(`${nextMonStr} 휴무계획 제출 완료`, 'ok'); setSelDates([]); setMemo(''); fetchPlans(); }
    }
    setSaving(false);
  };

  const dayNames = ['일','월','화','수','목','금','토'];
  const isFormMode = editingId || (!pendingNextMonth && !confirmedNextMonth);

  return (
    <div>
      {/* 근무자 선택 */}
      <div className="card" style={{padding:'14px 18px', marginBottom:0}}>
        <div style={{fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10}}>근무자 선택</div>
        <div style={{display:'flex', gap:8}}>
          {members.map(m => (
            <button key={m.name} type="button"
              onClick={() => { setSelMember(selMember?.name===m.name ? null : m); setSelDates([]); setMemo(''); setEditingId(null); }}
              style={{ flex:1, height:40, border:'2px solid', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
                borderColor: selMember?.name===m.name ? 'var(--accent)' : 'var(--border)',
                background: selMember?.name===m.name ? '#fff3e0' : '#fafafa',
                color: selMember?.name===m.name ? 'var(--accent)' : 'var(--text2)',
              }}>
              {m.display_name || m.name}
              <div style={{fontSize:10, fontWeight:400, marginTop:2}}>{m.job_title}</div>
            </button>
          ))}
        </div>
      </div>

      {selMember && (
      <>
      <div className="card">
        <div className="card-label">
          {editingId ? '휴무계획 수정' : `${nextYear}년 ${nextMon + 1}월 휴무계획 신청`}
          <span style={{fontSize:11, fontWeight:400, color:'var(--text3)', marginLeft:8}}>(익월 기준 · {selMember.display_name || selMember.name})</span>
        </div>

        {!isFormMode ? (
          <div>
            <div style={{background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:12, fontSize:13, color:'var(--success)', fontWeight:600}}>
              ✅ {nextMonStr} 휴무계획을 제출했습니다.
            </div>
            {pendingNextMonth && (
              <button className="btn btn-s" onClick={() => startEdit(pendingNextMonth)}>
                ✏️ 수정하기
              </button>
            )}
            {confirmedNextMonth && (
              <div style={{fontSize:12, color:'var(--text3)', marginTop:8}}>
                확인 완료된 계획은 수정할 수 없습니다.
              </div>
            )}
          </div>
        ) : (
          <>
            {editingId && (
              <div style={{background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'8px 12px', marginBottom:12, fontSize:12, color:'#E65100', fontWeight:600}}>
                ✏️ 수정 모드 — 날짜를 다시 선택하세요
              </div>
            )}
            {/* 달력 */}
            <div style={{marginBottom:16}}>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4}}>
                {dayNames.map((d,i) => (
                  <div key={d} style={{textAlign:'center', fontSize:11, fontWeight:600,
                    color: i===0?'#c62828':i===6?'#1565C0':'var(--text3)', padding:'4px 0'}}>
                    {d}
                  </div>
                ))}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2}}>
                {Array.from({length: firstDow}).map((_, i) => <div key={`e${i}`}/>)}
                {Array.from({length: daysInMonth}).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${nextYear}-${String(nextMon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const dow = (firstDow + i) % 7;
                  const isSat = dow === 6;
                  const isSun = dow === 0;
                  const isSel = selDates.includes(dateStr);
                  return (
                    <button key={day} onClick={() => toggleDate(dateStr)}
                      style={{
                        height:38, borderRadius:'var(--radius)', fontSize:13, fontWeight: isSel ? 700 : 400,
                        cursor:'pointer',
                        background: isSel ? 'var(--accent)' : '#fff',
                        color: isSel ? '#fff' : isSun ? '#c62828' : isSat ? '#1565C0' : 'var(--text)',
                        border: isSel ? 'none' : '1px solid var(--border)',
                      }}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {selDates.length > 0 && (
              <div style={{background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:12}}>
                <div style={{fontSize:11, fontWeight:600, color:'#E65100', marginBottom:6}}>선택된 날짜 ({selDates.length}일)</div>
                <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                  {selDates.map(d => (
                    <span key={d} style={{background:'var(--accent)', color:'#fff', borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:600}}>{d}</span>
                  ))}
                </div>
              </div>
            )}

            <textarea value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="메모 (선택사항)"
              style={{width:'100%', height:72, padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', resize:'vertical', outline:'none', marginBottom:12}}/>

            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-p" onClick={handleSubmit} disabled={saving || selDates.length===0}
                style={{flex:1, justifyContent:'center', height:40}}>
                {saving ? <span className="spinner"/> : editingId ? '✓ 휴무계획 수정 완료' : `✓ ${nextMonStr} 휴무계획 제출`}
              </button>
              {editingId && (
                <button className="btn btn-s" onClick={cancelEdit} style={{height:40}}>취소</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 제출 이력 */}
      {!loading && myPlans.length > 0 && (
        <div className="card">
          <div className="card-label">제출 이력</div>
          <div className="twrap">
            <table>
              <thead><tr><th>신청월</th><th>선택 날짜</th><th>일수</th><th>메모</th><th>제출일</th><th>상태</th><th></th></tr></thead>
              <tbody>
                {myPlans.map(p => (
                  <tr key={p.id}>
                    <td className="mono" style={{fontWeight:700}}>{p.target_month}</td>
                    <td><div style={{display:'flex',flexWrap:'wrap',gap:3}}>{(p.dates||[]).map(d=><span key={d} style={{background:'#fff3e0',color:'var(--accent)',border:'1px solid #ffcc80',borderRadius:3,padding:'1px 6px',fontSize:10,fontWeight:600,whiteSpace:'nowrap'}}>{d}</span>)}</div></td>
                    <td style={{textAlign:'center', fontWeight:700, color:'var(--accent)'}}>{(p.dates||[]).length}일</td>
                    <td style={{fontSize:11, color:'var(--text3)'}}>{p.memo||'-'}</td>
                    <td className="mono" style={{fontSize:11}}>{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                    <td>
                      <span style={{padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                        background: p.status==='approved'?'#e8f5e9':p.status==='rejected'?'#ffebee':'#fff3e0',
                        color: p.status==='approved'?'var(--success)':p.status==='rejected'?'var(--danger)':'#E65100'}}>
                        {p.status==='approved'?'확인':p.status==='rejected'?'반려':'대기'}
                      </span>
                    </td>
                    <td>
                      {p.status === 'pending' && (
                        <button className="btn btn-s" style={{fontSize:11, padding:'3px 8px'}}
                          onClick={() => startEdit(p)}>수정</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 근태관리 (본사 담당자/관리자용)
// ════════════════════════════════════════════════════════
function AttendanceMgmtPage() {
  const [tab,      setTab]      = useState('attendance');
  const [records,  setRecords]  = useState([]);
  const [plans,    setPlans]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [fStore,   setFStore]   = useState('');
  const [fManager, setFManager] = useState('');
  const [fFrom,    setFFrom]    = useState('');
  const [fTo,      setFTo]      = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: att } = await supabase.from('attendance')
      .select('*').order('work_date', { ascending: false }).limit(200);
    const { data: lp } = await supabase.from('leave_plans')
      .select('*').order('created_at', { ascending: false });
    setRecords(att || []);
    setPlans(lp || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fmt = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const duration = (ci, co) => {
    if (!ci || !co) return '-';
    const m = Math.round((new Date(co) - new Date(ci)) / 60000);
    return `${Math.floor(m/60)}h ${m%60}m`;
  };

  const stores = useMemo(() => [...new Set(records.map(r => r.store_name).filter(Boolean))].sort(), [records]);
  const managers = useMemo(() => [...new Set(records.map(r => r.manager_name).filter(Boolean))].sort(), [records]);

  const filteredAtt = useMemo(() => {
    let r = records;
    if (fStore)   r = r.filter(x => x.store_name === fStore);
    if (fManager) r = r.filter(x => x.manager_name === fManager);
    if (fFrom)    r = r.filter(x => x.work_date >= fFrom);
    if (fTo)      r = r.filter(x => x.work_date <= fTo);
    return r;
  }, [records, fStore, fManager, fFrom, fTo]);

  const newPlanCount = plans.filter(p => p.status === 'pending').length;

  const updatePlanStatus = async (id, status) => {
    const { error } = await supabase.from('leave_plans').update({ status }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast(status === 'approved' ? '확인 완료' : '반려 처리', 'ok'); fetchAll(); }
  };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='attendance'?'on':''}`} onClick={() => setTab('attendance')}>출퇴근 현황</button>
        <button className={`tab ${tab==='leave'?'on':''}`} onClick={() => setTab('leave')}>
          연차계획
          {newPlanCount > 0 && (
            <span style={{marginLeft:6, background:'var(--danger)', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700}}>
              NEW {newPlanCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'attendance' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div className="fbar" style={{flexWrap:'wrap'}}>
            <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFManager(''); }}>
              <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="fsel" value={fManager} onChange={e => setFManager(e.target.value)}>
              <option value="">전체 매니저</option>{managers.map(m => <option key={m}>{m}</option>)}
            </select>
            <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)}/>
            <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
            <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)}/>
            {(fStore||fManager||fFrom||fTo) && (
              <button className="btn-ghost" onClick={() => { setFStore(''); setFManager(''); setFFrom(''); setFTo(''); }}>✕ 초기화</button>
            )}
            <div className="fbar-right"><span className="fresult"><b>{filteredAtt.length}</b>건</span></div>
          </div>

          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead><tr><th>날짜</th><th>매니저</th><th>점포</th><th>지점</th><th>출근</th><th>퇴근</th><th>근무시간</th></tr></thead>
                <tbody>
                  {filteredAtt.length === 0
                    ? <tr><td colSpan={7} className="empty">데이터가 없습니다</td></tr>
                    : filteredAtt.map(r => (
                      <tr key={r.id}>
                        <td className="mono">{r.work_date}</td>
                        <td><strong>{r.manager_name}</strong></td>
                        <td><span className="badge badge-dept">{r.store_name}</span></td>
                        <td><span className="badge badge-store">{r.branch_name}</span></td>
                        <td style={{fontFamily:'var(--mono)', color:'var(--success)', fontWeight:600}}>{fmt(r.clock_in)}</td>
                        <td style={{fontFamily:'var(--mono)', color:'var(--accent)', fontWeight:600}}>{fmt(r.clock_out)}</td>
                        <td className="mono" style={{color:'var(--text2)'}}>{duration(r.clock_in, r.clock_out)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'leave' && (
        <div className="card" style={{padding:'16px 20px'}}>
          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead>
                  <tr><th>신청월</th><th>매니저</th><th>점포</th><th>지점</th><th>선택날짜</th><th>일수</th><th>메모</th><th>제출일</th><th>상태</th></tr>
                </thead>
                <tbody>
                  {plans.length === 0
                    ? <tr><td colSpan={9} className="empty">연차계획 신청 내역이 없습니다</td></tr>
                    : plans.map(p => (
                      <tr key={p.id}>
                        <td className="mono" style={{fontWeight:700}}>{p.target_month}</td>
                        <td><strong>{p.manager_name}</strong></td>
                        <td><span className="badge badge-dept">{p.store_name}</span></td>
                        <td><span className="badge badge-store">{p.branch_name}</span></td>
                        <td style={{fontSize:11, color:'var(--text2)', maxWidth:200}}><div style={{display:'flex',flexWrap:'wrap',gap:3}}>{(p.dates||[]).map(d=><span key={d} style={{background:'#fff3e0',color:'var(--accent)',border:'1px solid #ffcc80',borderRadius:3,padding:'1px 6px',fontSize:10,fontWeight:600,whiteSpace:'nowrap'}}>{d}</span>)}</div></td>
                        <td style={{textAlign:'center', fontWeight:700, color:'var(--accent)'}}>{(p.dates||[]).length}일</td>
                        <td style={{fontSize:11, color:'var(--text3)'}}>{p.memo||'-'}</td>
                        <td className="mono" style={{fontSize:11}}>{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                        <td>
                          {p.status === 'pending' ? (
                            <div style={{display:'flex', gap:4}}>
                              <button className="btn btn-p" style={{padding:'3px 8px', fontSize:11}}
                                onClick={() => updatePlanStatus(p.id, 'approved')}>확인</button>
                              <button className="btn-danger" style={{padding:'3px 8px', fontSize:11}}
                                onClick={() => updatePlanStatus(p.id, 'rejected')}>반려</button>
                            </div>
                          ) : (
                            <span style={{
                              padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                              background: p.status==='approved'?'#e8f5e9':'#ffebee',
                              color: p.status==='approved'?'var(--success)':'var(--danger)',
                            }}>
                              {p.status==='approved'?'✅ 확인':'❌ 반려'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}



// ════════════════════════════════════════════════════════
// 재고 요청 페이지 (매니저)
// ════════════════════════════════════════════════════════
function StockRequestPage({ profile }) {
  const today = new Date().toISOString().slice(0, 10);
  const [brands,      setBrands]     = useState([]);
  const [allProducts, setAllProducts]= useState([]);
  const [requests,    setRequests]   = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [saving,      setSaving]     = useState(false);

  // 폼
  const [reqDate,   setReqDate]   = useState(today);
  const [brandId,   setBrandId]   = useState('');
  const [prodSearch,setProdSearch]= useState('');
  const [prodId,    setProdId]    = useState('');
  const [prodName,  setProdName]  = useState('');
  const [quantity,  setQty]       = useState(1);
  const [memo,      setMemo]      = useState('');
  const [showSugg,  setShowSugg]  = useState(false);

  const filteredProds = prodSearch.trim()
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(prodSearch.toLowerCase()) &&
        (!brandId || String(p.brand_id) === String(brandId))
      ).sort((a,b) => (a.name.includes('[단종]')?1:0)-(b.name.includes('[단종]')?1:0)).slice(0, 10)
    : [];

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || []));
    supabase.from('products').select('*').order('name').then(({ data }) => setAllProducts(data || []));
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('order_requests')
      .select('*, brand:brands(name), product:products(name)')
      .eq('store_name', profile.department)
      .eq('branch_name', profile.branch)
      .order('created_at', { ascending: false })
      .limit(30);
    setRequests(data || []);
    setLoading(false);
  }, [profile.department, profile.branch]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleBrandChange = (bid) => {
    setBrandId(bid); setProdSearch(''); setProdId(''); setProdName(''); setShowSugg(false);
  };

  const handleSelectProd = (p) => {
    setProdId(p.id); setProdName(p.name); setProdSearch(p.name);
    if (!brandId) setBrandId(String(p.brand_id));
    setShowSugg(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prodId) { toast('상품을 선택해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('order_requests').insert({
      store_name:  profile.department,
      branch_name: profile.branch,
      brand_id:    Number(brandId),
      product_id:  Number(prodId),
      quantity:    Number(quantity),
      memo:        memo.trim() || null,
      status:      'pending',
      created_by:  profile.id,
      request_date: reqDate,
    });
    if (error) toast(error.message, 'err');
    else {
      toast('재고 요청 완료', 'ok');
      setProdSearch(''); setProdId(''); setProdName(''); setQty(1); setMemo('');
      fetchRequests();
    }
    setSaving(false);
  };

  const inputStyle = { width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      <div className="card">
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:16, fontFamily:'var(--mono)' }}>
          📍 {profile.department} · {profile.branch}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:12, marginBottom:12 }}>
            <div>
              <label style={labelStyle}>요청일</label>
              <input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>브랜드</label>
              <select value={brandId} onChange={e => handleBrandChange(e.target.value)} style={inputStyle}>
                <option value="">전체 브랜드</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px', gap:12, marginBottom:12 }}>
            <div style={{ position:'relative' }}>
              <label style={labelStyle}>상품 검색</label>
              <input
                value={prodSearch}
                onChange={e => { setProdSearch(e.target.value); setProdId(''); setProdName(''); setShowSugg(true); }}
                onFocus={() => setShowSugg(true)}
                style={{ ...inputStyle }}
                placeholder="상품명 키워드 입력"
                autoComplete="off"
              />
              {prodId && (
                <div style={{ marginTop:4, fontSize:12, color:'var(--success)', fontWeight:600 }}>✅ {prodName}</div>
              )}
              {showSugg && filteredProds.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:220, overflowY:'auto' }}>
                  {filteredProds.map(p => {
                    const br = brands.find(b => b.id === p.brand_id);
                    return (
                      <div key={p.id}
                        onMouseDown={e => { e.preventDefault(); handleSelectProd(p); }}
                        style={{ padding:'9px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0f0f0' }}
                        onMouseEnter={e => e.currentTarget.style.background='#fffde7'}
                        onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                        {!brandId && br && <span style={{fontSize:11, color:'var(--accent)', fontWeight:700, marginRight:6}}>[{br.name}]</span>}
                        {p.name}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>수량</label>
              <input type="number" min={1} value={quantity} onChange={e => setQty(e.target.value)} style={inputStyle} required />
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>메모 (선택)</label>
            <input value={memo} onChange={e => setMemo(e.target.value)} style={inputStyle} placeholder="요청 사유 또는 특이사항" />
          </div>

          <button className="btn btn-p" type="submit" disabled={saving || !prodId}
            style={{ width:'100%', justifyContent:'center', height:40 }}>
            {saving ? <span className="spinner"/> : '📦 재고 요청'}
          </button>
        </form>
      </div>

      {/* 요청 이력 */}
      <div className="card">
        <div className="card-label">요청 이력</div>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>요청일</th><th>브랜드</th><th>상품명</th><th className="r">수량</th><th>메모</th><th>상태</th><th>등록일시</th></tr>
              </thead>
              <tbody>
                {requests.length === 0
                  ? <tr><td colSpan={7} className="empty">요청 내역이 없습니다</td></tr>
                  : requests.map(r => (
                    <tr key={r.id}>
                      <td className="mono">{r.request_date || '-'}</td>
                      <td><span className="badge badge-dept">{r.brand?.name || '-'}</span></td>
                      <td style={{fontSize:12}}>{r.product?.name || '-'}</td>
                      <td className="r" style={{fontWeight:700, color:'var(--accent)'}}>{r.quantity}</td>
                      <td style={{fontSize:11, color:'var(--text3)'}}>{r.memo || '-'}</td>
                      <td>
                        <span style={{
                          padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                          background: r.status==='approved'?'#e8f5e9':r.status==='rejected'?'#ffebee':'#fff3e0',
                          color: r.status==='approved'?'var(--success)':r.status==='rejected'?'var(--danger)':'#E65100',
                        }}>
                          {r.status==='approved'?'승인':r.status==='rejected'?'반려':'대기'}
                        </span>
                      </td>
                      <td className="mono" style={{fontSize:11}}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 근태현황 페이지 (매니저 본인)
// ════════════════════════════════════════════════════════
function MyAttendancePage({ profile }) {
  const now = new Date();
  const defaultYear  = now.getFullYear();
  const defaultMonth = String(now.getMonth() + 1).padStart(2, '0');
  const [selMonth,  setSelMonth]  = useState(`${defaultYear}-${defaultMonth}`);
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [members,   setMembers]   = useState([]);
  const [selMember, setSelMember] = useState(null);

  useEffect(() => {
    supabase.from('store_members').select('name, display_name, job_title')
      .eq('store_account_id', profile.id).order('is_primary', { ascending: false })
      .then(({ data }) => { setMembers(data || []); if (data?.length === 1) setSelMember(data[0]); });
  }, [profile.id]);

  const fetchData = useCallback(async () => {
    if (!selMember) { setRecords([]); setLoading(false); return; }
    setLoading(true);
    const from = `${selMonth}-01`;
    const toD  = new Date(selMonth.split('-')[0], selMonth.split('-')[1], 0);
    const to   = `${selMonth}-${String(toD.getDate()).padStart(2,'0')}`;
    const { data } = await supabase.from('attendance')
      .select('*').eq('manager_id', profile.id).eq('manager_name', selMember.name)
      .gte('work_date', from).lte('work_date', to)
      .order('work_date', { ascending: true });
    setRecords(data || []);
    setLoading(false);
  }, [profile.id, selMonth, selMember]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const duration = (ci, co) => {
    if (!ci || !co) return '-';
    const m = Math.round((new Date(co) - new Date(ci)) / 60000);
    return `${Math.floor(m/60)}시간 ${m%60}분`;
  };

  const totalDays = records.length;
  const totalMins = records.reduce((s, r) => {
    if (!r.clock_in || !r.clock_out) return s;
    return s + Math.round((new Date(r.clock_out) - new Date(r.clock_in)) / 60000);
  }, 0);

  const dayName = (dateStr) => {
    const days = ['일','월','화','수','목','금','토'];
    return days[new Date(dateStr).getDay()];
  };

  return (
    <div>
      {/* 근무자 선택 */}
      {members.length > 1 && (
        <div className="card" style={{padding:'14px 18px', marginBottom:0}}>
          <div style={{fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10}}>근무자 선택</div>
          <div style={{display:'flex', gap:8}}>
            {members.map(m => (
              <button key={m.name} type="button"
                onClick={() => setSelMember(selMember?.name===m.name ? null : m)}
                style={{ flex:1, height:44, border:'2px solid', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
                  borderColor: selMember?.name===m.name ? 'var(--accent)' : 'var(--border)',
                  background: selMember?.name===m.name ? '#fff3e0' : '#fafafa',
                  color: selMember?.name===m.name ? 'var(--accent)' : 'var(--text2)' }}>
                {m.display_name || m.name}
                <div style={{fontSize:10, fontWeight:400, marginTop:2}}>{m.job_title}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 월 선택 */}
      <div className="card" style={{padding:'14px 18px'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <label style={{fontSize:13, fontWeight:700, color:'var(--text)'}}>조회 월</label>
          <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)}
            style={{height:36, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}/>
          <div style={{marginLeft:'auto', display:'flex', gap:16}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:2}}>출근일수</div>
              <div style={{fontSize:20, fontWeight:700, color:'var(--success)', fontFamily:'var(--mono)'}}>{totalDays}일</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:2}}>총 근무시간</div>
              <div style={{fontSize:20, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{Math.floor(totalMins/60)}h {totalMins%60}m</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{padding:'16px 20px'}}>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>날짜</th><th>요일</th><th>출근</th><th>퇴근</th><th>근무시간</th></tr>
              </thead>
              <tbody>
                {records.length === 0
                  ? <tr><td colSpan={5} className="empty">{!selMember ? '근무자를 선택해주세요' : `${selMonth} 출퇴근 기록이 없습니다`}</td></tr>
                  : records.map(r => {
                    const day = dayName(r.work_date);
                    const isSun = day === '일';
                    const isSat = day === '토';
                    return (
                      <tr key={r.id}>
                        <td className="mono">{r.work_date}</td>
                        <td style={{fontWeight:700, color: isSun?'var(--danger)':isSat?'var(--accent2)':'var(--text)'}}>{day}</td>
                        <td style={{fontFamily:'var(--mono)', fontWeight:600, color:'var(--success)'}}>{fmt(r.clock_in)}</td>
                        <td style={{fontFamily:'var(--mono)', fontWeight:600, color: r.clock_out?'var(--accent)':'var(--text3)'}}>{fmt(r.clock_out)}</td>
                        <td className="mono" style={{color:'var(--text2)'}}>{duration(r.clock_in, r.clock_out)}</td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════
// 공개 회원가입 페이지 (QR 스캔 후 접근, 비로그인)
// URL: ?m=매장UUID&mn=근무자이름(선택)
// ════════════════════════════════════════════════════════
function JoinPage({ managerId }) {
  const urlParams = new URLSearchParams(window.location.search);
  const presetMemberName = urlParams.get('mn') ? decodeURIComponent(urlParams.get('mn')) : null;

  const [storeProfile, setStoreProfile] = useState(null);
  const [members,      setMembers]      = useState([]);
  const [selMember,    setSelMember]    = useState(null);
  const [loadingMgr,   setLoadingMgr]  = useState(true);
  const [name,         setName]        = useState('');
  const [phone,        setPhone]       = useState('');
  const [birthday,     setBirthday]    = useState('');
  const [gender,       setGender]      = useState('');
  const [smsConsent,   setSmsConsent]  = useState(false);
  const [saving,       setSaving]      = useState(false);
  const [done,         setDone]        = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id,name,department,branch')
      .eq('id', managerId).eq('approved',true).maybeSingle()
      .then(({ data }) => {
        setStoreProfile(data);
        if (data) {
          supabase.from('store_members').select('name,display_name,job_title')
            .eq('store_account_id', data.id).order('is_primary', { ascending: false })
            .then(({ data: mems }) => {
              setMembers(mems || []);
              if (presetMemberName) {
                const found = (mems || []).find(m => m.name === presetMemberName);
                if (found) setSelMember(found);
              }
            });
        }
        setLoadingMgr(false);
      });
  }, [managerId, presetMemberName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selMember) { alert('담당 매니저를 선택해주세요'); return; }
    const cleaned = phone.replace(/\D/g,'');
    if (cleaned.length < 10) { alert('연락처를 올바르게 입력해주세요'); return; }
    setSaving(true);

    let consentIp = null, consentUa = null;
    if (smsConsent) {
      try {
        const r = await fetch('/api/get-client-info');
        const d = await r.json();
        consentIp = d.ip; consentUa = d.ua;
      } catch (_) {}
    }

    const { error } = await supabase.from('customers').insert({
      joined_at: new Date().toISOString().slice(0,10),
      name: name.trim(), phone, birthday: birthday || null, gender: gender || null,
      store_name: storeProfile.department, branch_name: storeProfile.branch,
      manager_name: selMember.name,
      sms_consent: smsConsent,
      sms_consent_at: smsConsent ? new Date().toISOString() : null,
      consent_ip: consentIp, consent_ua: consentUa,
    });
    if (error) { alert('오류가 발생했습니다. 다시 시도해주세요.'); setSaving(false); return; }
    setDone(true); setSaving(false);
  };

  if (loadingMgr) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#fff9f0'}}>
      <span className="spinner"/>
    </div>
  );

  if (!storeProfile) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#fff9f0',flexDirection:'column',gap:12}}>
      <div style={{fontSize:40}}>⚠️</div>
      <div style={{fontSize:16,fontWeight:700,color:'#333'}}>유효하지 않은 링크입니다</div>
      <div style={{fontSize:13,color:'#888'}}>담당 매니저에게 문의해주세요</div>
    </div>
  );

  if (done) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#fff9f0',flexDirection:'column',gap:16,padding:24}}>
      <div style={{fontSize:56}}>🎉</div>
      <div style={{fontSize:20,fontWeight:700,color:'#333',textAlign:'center'}}>회원가입이 완료됐습니다!</div>
      <div style={{fontSize:14,color:'#666',textAlign:'center',lineHeight:1.8}}>
        <strong>{storeProfile.department} {storeProfile.branch}</strong><br/>
        담당: <strong>{selMember?.display_name || selMember?.name}</strong>
      </div>
      {smsConsent && (
        <div style={{background:'#fff3e0',border:'1px solid #ffcc80',borderRadius:10,padding:'10px 18px',fontSize:12,color:'#6d4c41',textAlign:'center'}}>
          📱 마케팅·정보 수신에 동의해주셔서 감사합니다
        </div>
      )}
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#fff9f0',display:'flex',alignItems:'center',justifyContent:'center',padding:20,overflowX:'hidden'}}>
      <div style={{width:'100%',maxWidth:420,background:'#fff',borderRadius:16,boxShadow:'0 4px 24px rgba(0,0,0,0.10)',overflow:'hidden',boxSizing:'border-box'}}>
        {/* 헤더 */}
        <div style={{background:'var(--sidebar)',padding:'28px 28px 20px',textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:8}}>🏬</div>
          <div style={{fontSize:18,fontWeight:700,color:'var(--sidebar-text)'}}>(주)한국생활건강</div>
          <div style={{fontSize:14,fontWeight:600,color:'rgba(0,0,0,0.6)',marginTop:4}}>회원 가입</div>
          <div style={{fontSize:11,color:'rgba(0,0,0,0.4)',marginTop:6}}>
            가입 매장: {storeProfile.department} · {storeProfile.branch}
          </div>
        </div>

        {/* 폼 */}
        <div style={{padding:'28px 24px 32px', overflowX:'hidden'}}>
          <form onSubmit={handleSubmit}>
            {/* 담당 매니저 선택 (QR에 mn 파라미터 없을 때) */}
            {members.length > 1 && !presetMemberName && (
              <div style={{marginBottom:20}}>
                <label style={{display:'block',fontSize:13,fontWeight:700,color:'#444',marginBottom:8}}>
                  담당 매니저 선택 <span style={{color:'#e53935',fontWeight:400,fontSize:12}}>*필수</span>
                </label>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                  {members.map(m => (
                    <button key={m.name} type="button"
                      onClick={() => setSelMember(selMember?.name===m.name ? null : m)}
                      style={{height:52, border:'2px solid', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer',
                        borderColor: selMember?.name===m.name ? 'var(--accent)' : '#e0e0e0',
                        background: selMember?.name===m.name ? '#fff8e1' : '#fafafa',
                        color: selMember?.name===m.name ? 'var(--accent)' : '#555'}}>
                      {m.display_name || m.name}
                      <div style={{fontSize:11, fontWeight:400, marginTop:2, color: selMember?.name===m.name ? 'var(--accent)' : '#999'}}>{m.job_title}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selMember && (
              <div style={{background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:8, padding:'8px 12px', marginBottom:16, fontSize:13, color:'#2e7d32', fontWeight:600}}>
                ✅ 담당: {selMember.display_name || selMember.name} ({selMember.job_title})
              </div>
            )}
            <div style={{marginBottom:18}}>
              <label style={{display:'block',fontSize:13,fontWeight:700,color:'#444',marginBottom:8}}>이름</label>
              <input value={name} onChange={e => setName(e.target.value)}
                style={{width:'100%',height:50,padding:'0 16px',border:'1.5px solid #e0e0e0',borderRadius:10,fontSize:16,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}
                placeholder="홍길동" required />
            </div>
            <div style={{marginBottom:18}}>
              <label style={{display:'block',fontSize:13,fontWeight:700,color:'#444',marginBottom:8}}>연락처</label>
              <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                style={{width:'100%',height:50,padding:'0 16px',border:'1.5px solid #e0e0e0',borderRadius:10,fontSize:16,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}
                placeholder="010-0000-0000" inputMode="numeric" required />
            </div>
            <div style={{marginBottom:24}}>
              <label style={{display:'block',fontSize:13,fontWeight:700,color:'#444',marginBottom:8}}>
                생일 <span style={{fontSize:11,fontWeight:400,color:'#999'}}>(선택 — 생일 혜택 제공용)</span>
              </label>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                style={{width:'100%',maxWidth:'100%',height:50,padding:'0 40px 0 12px',border:'1.5px solid #e0e0e0',borderRadius:10,fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box',color: birthday ? '#222' : '#aaa',display:'block',WebkitAppearance:'none',appearance:'none'}}/>
            </div>
            <div style={{marginBottom:24}}>
              <label style={{display:'block',fontSize:13,fontWeight:700,color:'#444',marginBottom:8}}>
                성별 <span style={{fontSize:11,fontWeight:400,color:'#999'}}>(선택)</span>
              </label>
              <div style={{display:'flex', gap:10}}>
                {['여성','남성'].map(g => (
                  <button key={g} type="button" onClick={() => setGender(gender===g ? '' : g)}
                    style={{flex:1, height:50, border:`1.5px solid ${gender===g?'var(--accent)':'#e0e0e0'}`,
                      borderRadius:10, fontSize:15, fontWeight:700, cursor:'pointer',
                      background: gender===g ? '#fff8e1' : '#fafafa',
                      color: gender===g ? 'var(--accent)' : '#888'}}>
                    {g === '여성' ? '👩 여성' : '👨 남성'}
                  </button>
                ))}
              </div>
            </div>

            {/* 마케팅 수신동의 */}
            <div style={{background: smsConsent?'#fff8e1':'#f8f9fa', border:`1.5px solid ${smsConsent?'var(--accent)':'#e0e0e0'}`, borderRadius:12, padding:'16px', marginBottom:24, transition:'all 150ms'}}>
              <label style={{display:'flex',alignItems:'flex-start',gap:12,cursor:'pointer'}}>
                <input type="checkbox" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)}
                  style={{width:20,height:20,marginTop:2,accentColor:'var(--accent)',flexShrink:0}}/>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color: smsConsent?'var(--accent)':'#555',marginBottom:6}}>
                    마케팅·정보 수신 동의 <span style={{fontSize:11,fontWeight:400,color:'#999'}}>(선택)</span>
                  </div>
                  <div style={{fontSize:12,color:'#666',lineHeight:1.8}}>
                    (주)한국생활건강으로부터 회원 전용 혜택, 할인·이벤트·프로모션·신상품 안내 등 유용한 정보를 문자메시지(SMS/MMS), 카카오톡 등을 통해 수신하는 것에 동의합니다.
                  </div>
                  <div style={{marginTop:8,fontSize:11,color:'#aaa',lineHeight:1.7}}>
                    · 동의하지 않으셔도 서비스 이용에 불이익이 없습니다.<br/>
                    · 동의 후에도 언제든지 철회하실 수 있습니다.
                  </div>
                </div>
              </label>
            </div>

            <button type="submit" disabled={saving}
              style={{width:'100%',height:52,background:'var(--accent)',color:'#fff',border:'none',borderRadius:12,fontSize:16,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {saving ? <span className="spinner"/> : '✓ 회원 등록 완료'}
            </button>
          </form>
          <div style={{marginTop:14,fontSize:11,color:'#bbb',textAlign:'center',lineHeight:1.7}}>
            {selMember ? `담당: ${selMember.display_name || selMember.name}` : ''}<br/>
            입력하신 정보는 회원 관리 목적으로만 사용됩니다
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 도움말 페이지 (화면 목업 + 예시 데이터)
// ════════════════════════════════════════════════════════
function HelpPage({ profile }) {
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

  // 공통 목업 스타일
  const mW  = { border:'1px solid #e0e0e0', borderRadius:8, overflow:'hidden', marginBottom:16, fontSize:11, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' };
  const mH  = { background:'#f5f5f5', borderBottom:'1px solid #ddd', padding:'7px 12px', fontWeight:700, fontSize:11, color:'#555', display:'flex', alignItems:'center', gap:6 };
  const mB  = { background:'#fff', padding:'12px' };
  const mTh = { background:'#f8f8f8', padding:'6px 10px', fontSize:10, fontWeight:600, color:'#888', borderBottom:'1px solid #eee', whiteSpace:'nowrap', textAlign:'left' };
  const mTd = { padding:'7px 10px', fontSize:11, borderBottom:'1px solid #f0f0f0', whiteSpace:'nowrap' };
  const bdg = (txt, bg='#fff3e0', col='#E65100') => <span style={{background:bg,color:col,border:`1px solid ${col}33`,borderRadius:3,padding:'2px 7px',fontSize:10,fontWeight:600}}>{txt}</span>;
  const btn = (txt, bg='#E65100', col='#fff') => <span style={{background:bg,color:col,borderRadius:4,padding:'3px 9px',fontSize:10,fontWeight:600,cursor:'pointer'}}>{txt}</span>;
  const inp = (val, w=120) => <span style={{display:'inline-block',width:w,border:'1px solid #ddd',borderRadius:4,padding:'4px 8px',fontSize:11,background:'#fafafa',color:'#333'}}>{val}</span>;

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
            {/* 헤더 */}
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

            {/* 화면 미리보기 */}
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

            {/* 사용 방법 */}
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

        {/* 전체화면 모달 */}
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



// ════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════
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
    stock_safety:   '안전재고',
    manager_mgmt:   '매니저 현황',
    incentive:      '급여관리',
    member_mgmt:    '고객관리',
    sales_view:          '매출조회',
    sales_list:          '매장 매출',
    biz_sales_view:      '특판 매출',
    lecture_sales_view:  '강좌 매출',
    sales_input:    '판매 입력',
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
            {page === 'stock_safety'   && canSeeMain && <SafetyCheckPage profile={profile}/>}
            {page === 'manager_mgmt'   && canSeeMain && <ManagerMgmtPage/>}
            {page === 'incentive'      && canSeeMain && <IncentivePage profile={profile}/>}
            {page === 'member_mgmt'    && canSeeMain && <CustomerLookupPage profile={profile}/>}
            {page === 'sales_view'         && canSeeMain && <SalesViewHub setPage={setPage}/>}
            {page === 'sales_list'          && canSeeMain && <SalesListPage setPage={setPage}/>}
            {page === 'biz_sales_view'      && canSeeMain && <BizSalesPage profile={profile} setPage={setPage}/>}
            {page === 'lecture_sales_view'  && canSeeMain && <LectureSalesPage profile={profile} setPage={setPage}/>}
            {page === 'sales_input'    && (isManager || isAdmin || isHQ) && <SalesInputPage profile={profile}/>}
            {page === 'customer_input' && (isManager || isAdmin || isHQ) && <CustomerInputPage profile={profile}/>}
            {page === 'customer_qr'    && (isManager || isAdmin || isHQ) && <CustomerQRPage profile={profile}/>}
            {page === 'customer_doc'   && (isManager || isAdmin || isHQ) && <CustomerDocPage profile={profile}/>}
            {page === 'my_members'     && (isManager || isAdmin || isHQ) && <MyMembersPage profile={profile}/>}
            {page === 'stock_request'  && (isManager || isAdmin || isHQ) && <StockRequestPage profile={profile}/>}
            {page === 'stock_mgr_view' && (isManager || isAdmin || isHQ) && <StoreStockPage profile={profile}/>}
            {page === 'my_attendance'  && (isManager || isAdmin || isHQ) && <MyAttendancePage profile={profile}/>}
            {page === 'leave_plan'     && (isManager || isAdmin || isHQ) && <LeavePlanPage profile={profile}/>}
            {page === 'attendance_mgmt'&& canSeeMain && <AttendanceMgmtPage/>}
            {page === 'admin'          && (isAdmin || isHQ) && <AdminTab profile={profile}/>}
            {page === 'notice'         && (isAdmin || isHQ || isManager) && <NoticePage profile={profile}/>}
          </div>
        </div>
      </div>
    </>
  );
}
