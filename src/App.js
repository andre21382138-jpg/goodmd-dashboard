import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// ════════════════════════════════════════════════════════
// SUPABASE
// ════════════════════════════════════════════════════════
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

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
    --mono:    'IBM Plex Mono', monospace;
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
  .sidebar-menu { flex: 1; padding: 6px 8px; overflow-y: auto; }
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
function useStyle(css) {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
    return () => el.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// ════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════
let _toast = null;
function toast(msg, type = 'ok') { _toast?.(msg, type); }

function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    _toast = (msg, type) => {
      const id = Date.now();
      setList(p => [...p, { id, msg, type }]);
      setTimeout(() => setList(p => p.filter(t => t.id !== id)), 3200);
    };
  }, []);
  const icon = { ok: '✓', err: '✕', inf: 'ℹ' };
  return (
    <div className="toasts">
      {list.map(t => (
        <div key={t.id} className={`toast t-${t.type}`}>
          <span>{icon[t.type]}</span><span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 점포/지점 목록
// ════════════════════════════════════════════════════════
const STORE_MAP = {
  '롯데백화점':    ['건대스타시티점','천호점','영등포점','관악점','수원점','대구점','센텀시티점','부산점','강남점','잠실점','노원점','청량리점','본점','인천점','광주점','울산점','창원점','포항점','기타'],
  '신세계백화점':  ['강남점','본점','마산점','센텀시티점','대전점','광주점','충청점','경기점','하남점','기타'],
  '현대백화점':    ['더현대서울점','목동점','중동점','무역센터점','천호점','신촌점','압구정본점','판교점','대구점','울산점','기타'],
  'AK백화점':     ['평택점','수원점','분당점','원주점','홍대점','기타'],
  '갤러리아백화점': ['명품관','타임월드점','센터시티점','광교점','진주점','기타'],
  '그린푸드':     ['그린푸드'],
  '농협_SHOP':   ['농협_SHOP'],
  '대동백화점':   ['대동백화점'],
  '특판':        ['특판'],
};
const STORE_NAMES = Object.keys(STORE_MAP);

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
const SC = { DEPT:1, STORE:2, CODE:3, NAME:4, STOCK:14, SALES:32 };
const S_DATA_START = 10;
const S_PERIOD_ROW = 2;

function parseSubul(binary) {
  const wb = XLSX.read(binary, { type: 'binary' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const periodStr = String(raw[S_PERIOD_ROW]?.[0] || '')
    .replace('조회기간 :', '').replace('조회기간:', '').trim();
  const rows = [];
  for (let i = S_DATA_START; i < raw.length; i++) {
    const row = raw[i];
    const dept  = String(row[SC.DEPT]  || '').trim();
    const store = String(row[SC.STORE] || '').trim();
    const code  = String(row[SC.CODE]  || '').trim();
    const name  = String(row[SC.NAME]  || '').trim();
    if (!dept || !code || dept === '합계') continue;
    const stock = Number(row[SC.STOCK]) || 0;
    const sales = Number(row[SC.SALES]) || 0;
    rows.push({ dept, store, code, name, stock, sales });
  }
  return { rows, periodStr };
}

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

function dlBlob(buf, filename) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════
// SORT HOOK
// ════════════════════════════════════════════════════════
function useSort(initKey = '') {
  const [key, setKey] = useState(initKey);
  const [dir, setDir] = useState('asc');
  const toggle = (k) => { if (key === k) setDir(d => d === 'asc' ? 'desc' : 'asc'); else { setKey(k); setDir('asc'); } };
  const thClass = (k) => key === k ? (dir === 'asc' ? 's-a' : 's-d') : '';
  return { key, dir, toggle, thClass };
}
function sortRows(rows, key, dir) {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const av = a[key] ?? 0, bv = b[key] ?? 0;
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ko');
    return dir === 'asc' ? cmp : -cmp;
  });
}
function uniq(arr) { return [...new Set(arr)].filter(Boolean).sort((a,b) => a.localeCompare(b,'ko')); }

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
// 전화번호 자동 포맷
// ════════════════════════════════════════════════════════
function formatPhone(val) {
  const num = val.replace(/\D/g, '').slice(0, 11);
  if (num.length < 4) return num;
  if (num.length < 8) return `${num.slice(0,3)}-${num.slice(3)}`;
  return `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`;
}

// ════════════════════════════════════════════════════════
// 판매 입력 페이지 (고객 동시 등록 포함)
// ════════════════════════════════════════════════════════
function SalesInputPage({ profile }) {
  const today = new Date().toISOString().slice(0, 10);
  const [soldAt,    setSoldAt]   = useState(today);
  const [payment,   setPayment]  = useState('카드');
  const [memo,      setMemo]     = useState('');
  const [brands,    setBrands]   = useState([]);
  const [allProducts, setAllProducts] = useState([]); // 전체 상품
  const [saving,    setSaving]   = useState(false);
  const [recentSales, setRecent] = useState([]);

  // 상품 라인 (여러 개)
  const newLine = () => ({ id: Date.now(), brandId:'', productId:'', productSearch:'', showSuggestions:false, quantity:1, normalPrice:'', discount:'0', price:'', products:[] });
  const [lines, setLines] = useState([newLine()]);

  // 회원 연결
  const [memberMode,   setMemberMode]   = useState('none');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults,setMemberResults]= useState([]);
  const [selectedMember,setSelMember]  = useState(null);
  const [searching,    setSearching]    = useState(false);
  // 신규 회원등록
  const [custName,    setCustName]    = useState('');
  const [custPhone,   setCustPhone]   = useState('');
  const [custBirthday,setCustBirthday]= useState('');
  const [managerName, setManagerName] = useState('');
  const [smsConsent,  setSmsConsent]  = useState(false);

  const searchMembers = async () => {
    if (!memberSearch.trim()) return;
    setSearching(true);
    const { data } = await supabase.from('customers')
      .select('*')
      .or(`name.ilike.%${memberSearch}%,phone.ilike.%${memberSearch}%`)
      .limit(10);
    setMemberResults(data || []);
    setSearching(false);
  };

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || []));
    supabase.from('products').select('*').order('name').then(({ data }) => setAllProducts(data || []));
  }, []);

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase.from('sales')
      .select('*, brand:brands(name), product:products(name), customer:customers(name,phone)')
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setRecent(data || []);
  }, [profile.id]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  // 라인 업데이트 헬퍼
  const updateLine = (id, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      if (field === 'brandId') {
        updated.productId = ''; updated.productSearch = ''; updated.price = ''; updated.normalPrice = ''; updated.discount = '0';
        updated.products = allProducts.filter(p => String(p.brand_id) === String(value));
      }
      if (field === 'productId') {
        const prod = l.products.find(p => String(p.id) === String(value));
        if (prod?.price) { updated.normalPrice = prod.price; updated.discount = '0'; updated.price = prod.price; }
        updated.showSuggestions = false;
      }
      // 정상가나 할인금액 변경 시 판매가 자동 계산
      if (field === 'normalPrice' || field === 'discount') {
        const np = Number(field==='normalPrice' ? value : updated.normalPrice) || 0;
        const dc = Number(field==='discount'    ? value : updated.discount)    || 0;
        updated.price = Math.max(0, np - dc);
      }
      return updated;
    }));
  };

  const addLine = () => setLines(prev => [...prev, newLine()]);
  const removeLine = (id) => setLines(prev => prev.filter(l => l.id !== id));

  const totalAmt = lines.reduce((s, l) => s + (Number(l.quantity)||0) * (Number(String(l.price).replace(/,/g,''))||0), 0);

  const resetForm = () => {
    setLines([newLine()]); setMemo(''); setPayment('카드');
    setCustName(''); setCustPhone(''); setCustBirthday(''); setManagerName(''); setSmsConsent(false);
    setMemberMode('none'); setMemberSearch(''); setMemberResults([]); setSelMember(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validLines = lines.filter(l => l.brandId && l.productId);
    if (validLines.length === 0) { toast('상품을 하나 이상 선택해주세요', 'err'); return; }
    if (memberMode === 'search' && !selectedMember) { toast('회원을 선택해주세요', 'err'); return; }
    if (memberMode === 'new') {
      if (!custName.trim()) { toast('고객 이름을 입력해주세요', 'err'); return; }
      if (custPhone.replace(/\D/g,'').length < 10) { toast('연락처를 올바르게 입력해주세요', 'err'); return; }
    }
    setSaving(true);
    try {
      let customerId = null;
      if (memberMode === 'search') {
        customerId = selectedMember.id;
      } else if (memberMode === 'new') {
        const { data: custData, error: custErr } = await supabase.from('customers').insert({
          joined_at: soldAt, name: custName.trim(), phone: custPhone,
          birthday: custBirthday || null, store_name: profile.department,
          branch_name: profile.branch, manager_name: managerName.trim() || null,
          sms_consent: false, sms_consent_at: null,
          created_by: profile.id,
        }).select().single();
        if (custErr) throw custErr;
        customerId = custData.id;
      }

      // 모든 라인 저장
      for (const l of validLines) {
        const { error } = await supabase.from('sales').insert({
          sold_at: soldAt, store_name: profile.department, branch_name: profile.branch,
          brand_id: Number(l.brandId), product_id: Number(l.productId),
          quantity: Number(l.quantity), price: Number(String(l.price).replace(/,/g,'')),
          payment, memo: memo.trim() || null, created_by: profile.id, customer_id: customerId,
        });
        if (error) throw error;
      }

      const modeMsg = memberMode === 'search' ? `${validLines.length}건 저장 + 회원 적립 완료` : memberMode === 'new' ? `${validLines.length}건 저장 + 회원등록 완료` : `${validLines.length}건 판매 입력 완료`;
      toast(modeMsg, 'ok');
      resetForm(); fetchRecent();
    } catch(err) {
      toast('저장 실패: ' + err.message, 'err');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 판매 내역을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); fetchRecent(); }
  };

  const inputStyle = { width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      <div className="card">
        <div className="card-label">판매 입력</div>
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:16, fontFamily:'var(--mono)' }}>
          📍 {profile.department} · {profile.branch}
        </div>
        <form onSubmit={handleSubmit}>
          {/* 판매날짜 + 결제수단 */}
          <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label style={labelStyle}>판매날짜</label>
              <input type="date" value={soldAt} onChange={e => setSoldAt(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>결제수단</label>
              <div style={{ display:'flex', gap:6, height:38, alignItems:'center' }}>
                {['카드','현금','기타'].map(p => (
                  <button key={p} type="button" onClick={() => setPayment(p)}
                    style={{ flex:1, height:38, border:'1px solid', cursor:'pointer', borderRadius:'var(--radius)',
                      borderColor: payment===p ? 'var(--accent)' : 'var(--border)',
                      background: payment===p ? '#fff3e0' : '#fafafa',
                      color: payment===p ? 'var(--accent)' : 'var(--text2)',
                      fontWeight: payment===p ? 700 : 500, fontSize:13 }}>{p}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 상품 목록 섹션 */}
          <div style={{ background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
                🛍️ 상품 목록
              </div>
              <button type="button" className="btn btn-s" style={{fontSize:12}} onClick={addLine}>+ 상품 추가</button>
            </div>

            {lines.map((l, idx) => {
              const suggestions = l.productSearch && l.products.length > 0
                ? l.products.filter(p => p.name.toLowerCase().includes(l.productSearch.toLowerCase())).slice(0, 8)
                : [];
              const selectedProd = l.products.find(p => String(p.id) === String(l.productId));

              return (
              <div key={l.id} style={{ background: idx%2===0?'#fafafa':'#f0f7ff', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'12px 14px', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text3)' }}>상품 {idx+1}</span>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(l.id)}
                      style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--danger)', fontSize:16, lineHeight:1 }}>✕</button>
                  )}
                </div>
                {/* 1행: 브랜드 + 상품검색 */}
                <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <label style={labelStyle}>브랜드</label>
                    <select value={l.brandId} onChange={e => updateLine(l.id,'brandId',e.target.value)} style={inputStyle} required>
                      <option value="">-- 브랜드 선택 --</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div style={{ position:'relative' }}>
                    <label style={labelStyle}>상품 검색</label>
                    <input
                      value={l.productSearch !== undefined ? l.productSearch : (selectedProd?.name || '')}
                      onChange={e => {
                        updateLine(l.id,'productSearch',e.target.value);
                        updateLine(l.id,'productId','');
                        updateLine(l.id,'showSuggestions',true);
                      }}
                      onFocus={() => updateLine(l.id,'showSuggestions',true)}
                      style={{...inputStyle, background:!l.brandId?'#f0f0f0':'#fff'}}
                      placeholder={!l.brandId ? '브랜드 먼저 선택' : '상품명 입력 후 선택'}
                      disabled={!l.brandId}
                      autoComplete="off"
                    />
                    {/* 선택된 상품 표시 */}
                    {selectedProd && (
                      <div style={{ marginTop:4, fontSize:12, color:'var(--success)', fontWeight:600 }}>
                        ✅ {selectedProd.name}
                      </div>
                    )}
                    {/* 자동완성 목록 */}
                    {l.showSuggestions && suggestions.length > 0 && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:220, overflowY:'auto' }}>
                        {suggestions.map(p => (
                          <div key={p.id}
                            onMouseDown={e => { e.preventDefault(); updateLine(l.id,'productId',String(p.id)); updateLine(l.id,'productSearch',p.name); }}
                            style={{ padding:'9px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0f0f0' }}
                            onMouseEnter={e => e.currentTarget.style.background='#fffde7'}
                            onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                            {p.name}
                            <span style={{ fontSize:11, color:'var(--text3)', marginLeft:8, fontFamily:'var(--mono)' }}>{Number(p.price).toLocaleString()}원</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* 2행: 수량 + 정상가 + 할인금액 + 판매가 */}
                <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 1fr', gap:10 }}>
                  <div>
                    <label style={labelStyle}>수량</label>
                    <input type="number" min={1} value={l.quantity} onChange={e => updateLine(l.id,'quantity',e.target.value)} style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>정상가 (원)</label>
                    <input type="number" min={0} value={l.normalPrice} onChange={e => updateLine(l.id,'normalPrice',e.target.value)} style={inputStyle} placeholder="0" />
                  </div>
                  <div>
                    <label style={labelStyle}>할인금액 (원)</label>
                    <input type="number" min={0} value={l.discount} onChange={e => updateLine(l.id,'discount',e.target.value)} style={{...inputStyle, color:'var(--danger)'}} placeholder="0" />
                  </div>
                  <div>
                    <label style={labelStyle}>판매가 (원)</label>
                    <input type="number" min={0} value={l.price} onChange={e => updateLine(l.id,'price',e.target.value)} style={{...inputStyle, fontWeight:700, color:'var(--accent)'}} placeholder="0" required />
                  </div>
                </div>
                {l.productId && l.price && (
                  <div style={{ marginTop:8, fontSize:12, fontWeight:700, textAlign:'right', fontFamily:'var(--mono)', color:'var(--accent)' }}>
                    소계: {(Number(l.quantity) * Number(String(l.price).replace(/,/g,''))).toLocaleString()}원
                    {Number(l.discount) > 0 && <span style={{color:'var(--danger)', marginLeft:8, fontWeight:400, fontSize:11}}>할인 -{(Number(l.quantity)*Number(l.discount)).toLocaleString()}원</span>}
                  </div>
                )}
              </div>
              );
            })}

            {/* 합계 */}
            {lines.length > 1 && (
              <div style={{ background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', textAlign:'right', fontSize:14, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)' }}>
                총 합계: {totalAmt.toLocaleString()}원 ({lines.filter(l=>l.brandId&&l.productId).length}개 상품)
              </div>
            )}
          </div>

          {/* 메모 섹션 */}
          <div style={{ background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10 }}>📝 메모</div>
            <input value={memo} onChange={e => setMemo(e.target.value)} style={inputStyle} placeholder="특이사항 입력... (선택)" />
          </div>

          {/* 회원적립 섹션 */}
          <div style={{ background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10 }}>🙋 회원 적립</div>
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              {[
                { key:'none',   label:'없음' },
                { key:'search', label:'기존 회원 검색' },
                { key:'new',    label:'신규 회원등록' },
              ].map(opt => (
                <button key={opt.key} type="button"
                  onClick={() => { setMemberMode(opt.key); setSelMember(null); setMemberResults([]); setMemberSearch(''); }}
                  style={{
                    padding:'7px 16px', border:'1px solid', cursor:'pointer', borderRadius:'var(--radius)',
                    borderColor: memberMode===opt.key ? 'var(--accent)' : 'var(--border)',
                    background:  memberMode===opt.key ? '#fff3e0' : '#fafafa',
                    color:       memberMode===opt.key ? 'var(--accent)' : 'var(--text2)',
                    fontWeight:  memberMode===opt.key ? 700 : 500, fontSize:12,
                  }}>{opt.label}</button>
              ))}
            </div>

            {/* 기존 회원 검색 */}
            {memberMode === 'search' && (
              <div style={{ background:'#f0f7ff', border:'1px solid #90caf9', borderRadius:'var(--radius)', padding:14 }}>
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && (e.preventDefault(), searchMembers())}
                    style={{...inputStyle, flex:1}} placeholder="이름 또는 연락처로 검색" />
                  <button type="button" className="btn btn-s" onClick={searchMembers} disabled={searching}>
                    {searching ? <span className="spinner"/> : '검색'}
                  </button>
                </div>
                {selectedMember && (
                  <div style={{ background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:'var(--radius)', padding:'8px 12px', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <strong style={{color:'var(--success)'}}>{selectedMember.name}</strong>
                      <span style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)', marginLeft:10}}>{selectedMember.phone}</span>
                      {selectedMember.manager_name && <span style={{fontSize:11, color:'var(--text3)', marginLeft:8}}>담당: {selectedMember.manager_name}</span>}
                    </div>
                    <button type="button" className="btn-ghost" onClick={() => setSelMember(null)}>✕</button>
                  </div>
                )}
                {memberResults.length > 0 && !selectedMember && (
                  <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
                    {memberResults.map(m => (
                      <div key={m.id} onClick={() => { setSelMember(m); setMemberResults([]); }}
                        style={{ padding:'9px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', background:'#fff', fontSize:13 }}
                        onMouseEnter={e => e.currentTarget.style.background='#fffde7'}
                        onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                        <strong>{m.name}</strong>
                        <span style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)', marginLeft:10}}>{m.phone}</span>
                        <span style={{fontSize:11, color:'var(--text3)', marginLeft:8}}>{m.store_name} · {m.branch_name}</span>
                        {m.manager_name && <span style={{fontSize:11, color:'var(--accent)', marginLeft:8}}>담당: {m.manager_name}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {memberResults.length === 0 && memberSearch && !searching && !selectedMember && (
                  <div style={{fontSize:12, color:'var(--text3)'}}>검색 결과가 없습니다</div>
                )}
              </div>
            )}

            {/* 신규 회원등록 */}
            {memberMode === 'new' && (
              <div style={{ background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                  <div>
                    <label style={labelStyle}>고객 이름</label>
                    <input value={custName} onChange={e => setCustName(e.target.value)}
                      style={inputStyle} placeholder="홍길동" />
                  </div>
                  <div>
                    <label style={labelStyle}>연락처</label>
                    <input value={custPhone} onChange={e => setCustPhone(formatPhone(e.target.value))}
                      style={inputStyle} placeholder="010-0000-0000" />
                  </div>
                  <div>
                    <label style={labelStyle}>생일 <span style={{color:'var(--text3)',fontWeight:400}}>(선택)</span></label>
                    <input type="date" value={custBirthday} onChange={e => setCustBirthday(e.target.value)}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>담당 매니저 이름</label>
                    <input value={managerName} onChange={e => setManagerName(e.target.value)}
                      style={inputStyle} placeholder="매니저 이름 입력" />
                  </div>
                </div>
                <div style={{fontSize:12, color:'var(--text3)', marginTop:6, padding:'6px 0'}}>
                  💡 SMS 수신동의는 QR코드 가입으로만 처리됩니다
                </div>
              </div>
            )}
          </div>{/* 회원적립 섹션 끝 */}

          <button className="btn btn-p" type="submit" disabled={saving}
            style={{ width:'100%', justifyContent:'center', height:40 }}>
            {saving ? <span className="spinner"/> :
              memberMode === 'search' ? '✓ 판매 + 회원 적립' :
              memberMode === 'new'    ? '✓ 판매 + 신규 회원등록' :
                                       '✓ 판매 입력 저장'}
          </button>
        </form>
      </div>

      {/* 최근 입력 내역 */}
      <div className="card">
        <div className="card-label">최근 입력 내역 (10건)</div>
        <div className="twrap">
          <table>
            <thead>
              <tr>
                <th>판매일</th><th>브랜드</th><th>상품명</th>
                <th className="r">수량</th><th className="r">판매가</th>
                <th>결제</th><th>고객</th><th>메모</th><th></th>
              </tr>
            </thead>
            <tbody>
              {recentSales.length === 0
                ? <tr><td colSpan={9} className="empty">입력된 판매 내역이 없습니다</td></tr>
                : recentSales.map(s => (
                  <tr key={s.id}>
                    <td className="mono">{s.sold_at}</td>
                    <td>{s.brand?.name || '-'}</td>
                    <td>{s.product?.name || '-'}</td>
                    <td className="r">{s.quantity}</td>
                    <td className="r">{Number(s.price).toLocaleString()}원</td>
                    <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9'}}>{s.payment}</span></td>
                    <td style={{fontSize:12}}>{s.customer ? <span style={{color:'var(--success)',fontWeight:600}}>👤 {s.customer.name}</span> : '-'}</td>
                    <td style={{fontSize:11,color:'var(--text2)'}}>{s.memo || '-'}</td>
                    <td><button className="btn-danger" onClick={() => handleDelete(s.id)}>삭제</button></td>
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
// 회원 조회 페이지 (본사/관리자)
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// QR코드 가입 안내 페이지
// ════════════════════════════════════════════════════════
function CustomerQRPage({ profile }) {
  const joinUrl = `${window.location.origin}${window.location.pathname}?m=${profile.id}`;
  const qrImg   = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(joinUrl)}&margin=12`;

  const handlePrint = () => {
    const w = window.open('');
    w.document.write(`<html><head><title>회원가입 QR코드</title></head>
      <body style="text-align:center;padding:40px;font-family:sans-serif">
        <h2>${profile.department} ${profile.branch}</h2>
        <p style="color:#888">(주)한국생활건강 회원가입</p>
        <img src="${qrImg}" style="width:280px;margin:16px 0"/>
        <p style="font-size:11px;color:#bbb">${joinUrl}</p>
        <script>window.onload=()=>window.print()<\/script>
      </body></html>`);
  };

  return (
    <div>
      <div className="card" style={{maxWidth:520}}>
        <div style={{textAlign:'center', padding:'8px 0 20px'}}>
          <div style={{fontSize:40, marginBottom:12}}>📱</div>
          <div style={{fontSize:16, fontWeight:700, marginBottom:6}}>매장 QR코드</div>
          <div style={{fontSize:13, color:'var(--text2)', lineHeight:1.8, marginBottom:20}}>
            카운터에 출력해두세요.<br/>
            고객이 스캔하면 <strong>담당자를 직접 선택</strong>하고 가입합니다.
          </div>
          <img src={qrImg} alt="QR코드" style={{width:240, height:240, borderRadius:8, border:'1px solid var(--border)', marginBottom:16}}/>
          <div style={{fontSize:11, color:'var(--text3)', wordBreak:'break-all', marginBottom:20}}>{joinUrl}</div>
          <div style={{display:'flex', gap:10, justifyContent:'center'}}>
            <button className="btn btn-s" onClick={() => { navigator.clipboard?.writeText(joinUrl); toast('URL 복사됨', 'ok'); }}>🔗 URL 복사</button>
            <button className="btn btn-p" onClick={handlePrint}>🖨️ QR 인쇄</button>
          </div>
        </div>
        <div style={{background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:12, color:'#1b5e20', lineHeight:1.8}}>
          ✅ QR코드로 가입한 고객은 <strong>SMS 수신동의</strong>를 직접 체크하므로 별도 서면 동의서가 필요 없습니다.
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 서류 가입 페이지 (SMS 동의 없음)
// ════════════════════════════════════════════════════════
function CustomerDocPage({ profile }) {
  const today = new Date().toISOString().slice(0, 10);
  const [joinedAt,    setJoinedAt]    = useState(today);
  const [custName,    setCustName]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [birthday,    setBirthday]    = useState('');
  const [smsConsent,  setSmsConsent]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [recentList,  setRecent]      = useState([]);
  const [members,     setMembers]     = useState([]);
  const [selMember,   setSelMember]   = useState(null);

  useEffect(() => {
    supabase.from('store_members').select('name, display_name, job_title')
      .eq('store_account_id', profile.id).order('is_primary', { ascending: false })
      .then(({ data }) => { setMembers(data || []); if (data?.length === 1) setSelMember(data[0]); });
  }, [profile.id]);

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase.from('customers')
      .select('*').eq('created_by', profile.id)
      .order('created_at', { ascending: false }).limit(20);
    setRecent(data || []);
  }, [profile.id]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selMember) { toast('담당 근무자를 선택해주세요', 'err'); return; }
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) { toast('연락처를 올바르게 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('customers').insert({
      joined_at: joinedAt, name: custName.trim(), phone,
      birthday: birthday || null,
      store_name: profile.department, branch_name: profile.branch,
      manager_name: selMember.name,
      sms_consent: smsConsent,
      sms_consent_at: smsConsent ? new Date().toISOString() : null,
      created_by: profile.id,
    });
    if (error) { toast('저장 실패: ' + error.message, 'err'); }
    else { toast('회원 등록 완료', 'ok'); setCustName(''); setPhone(''); setBirthday(''); setSmsConsent(false); fetchRecent(); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 고객 정보를 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); fetchRecent(); }
  };

  const inputStyle = { width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      {/* 근무자 선택 */}
      {members.length > 1 && (
        <div className="card" style={{padding:'14px 18px', marginBottom:0}}>
          <div style={{fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10}}>담당 근무자 선택 <span style={{color:'var(--danger)', fontSize:12}}>*필수</span></div>
          <div style={{display:'flex', gap:8}}>
            {members.map(m => (
              <button key={m.name} type="button" onClick={() => setSelMember(selMember?.name===m.name ? null : m)}
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
      <div className="card">
        <div style={{background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:16, fontSize:12, color:'#6d4c41', lineHeight:1.8}}>
          ⚠️ 고객으로부터 <strong>서면 동의서를 수령한 후</strong> 등록하세요.<br/>
          마케팅 수신동의는 서류에 고객이 직접 서명한 경우에만 체크하세요.
        </div>
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:16, fontFamily:'var(--mono)' }}>
          📍 {profile.department} · {profile.branch}{selMember ? ` · ${selMember.display_name || selMember.name}` : ''}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:14, marginBottom:16 }}>
            <div>
              <label style={labelStyle}>회원가입일</label>
              <input type="date" value={joinedAt} onChange={e => setJoinedAt(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>고객 이름</label>
              <input value={custName} onChange={e => setCustName(e.target.value)} style={inputStyle} placeholder="홍길동" required />
            </div>
            <div>
              <label style={labelStyle}>연락처</label>
              <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} style={inputStyle} placeholder="010-0000-0000" required />
            </div>
            <div>
              <label style={labelStyle}>생일 <span style={{color:'var(--text3)', fontWeight:400}}>(선택)</span></label>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* 마케팅 수신동의 */}
          <div style={{ background: smsConsent ? '#e8f5e9' : '#f8f8f8', border:`1px solid ${smsConsent ? '#a5d6a7' : 'var(--border)'}`, borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:16 }}>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)}
                style={{ width:18, height:18, accentColor:'var(--success)', flexShrink:0 }} />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color: smsConsent ? 'var(--success)' : 'var(--text)' }}>
                  📱 마케팅·정보 수신 동의
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, lineHeight:1.7 }}>
                  (주)한국생활건강으로부터 회원 전용 혜택, 할인·이벤트·프로모션·신상품 안내 등 유용한 정보를 문자메시지(SMS/MMS), 카카오톡 등을 통해 수신하는 것에 동의합니다.<br/>
                  · 동의하지 않으셔도 서비스 이용에 불이익이 없습니다.<br/>
                  · 동의 후에도 언제든지 철회하실 수 있습니다.
                </div>
              </div>
            </label>
          </div>

          <button className="btn btn-p" type="submit" disabled={saving} style={{ width:'100%', justifyContent:'center', height:40 }}>
            {saving ? <span className="spinner"/> : '✓ 서류 가입 등록'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-label">최근 등록 (20건)</div>
        <div className="twrap">
          <table>
            <thead>
              <tr><th>가입일</th><th>이름</th><th>연락처</th><th>생일</th><th>담당매니저</th><th style={{textAlign:'center'}}>수신동의</th><th>등록일시</th><th></th></tr>
            </thead>
            <tbody>
              {recentList.length === 0
                ? <tr><td colSpan={8} className="empty">등록된 회원이 없습니다</td></tr>
                : recentList.map(c => (
                  <tr key={c.id}>
                    <td className="mono">{c.joined_at}</td>
                    <td><strong>{c.name}</strong></td>
                    <td className="mono">{c.phone}</td>
                    <td className="mono" style={{fontSize:11}}>{c.birthday || '-'}</td>
                    <td style={{color:'var(--accent)', fontWeight:600}}>{c.manager_name || '-'}</td>
                    <td style={{textAlign:'center'}}>
                      {c.sms_consent
                        ? <span style={{color:'var(--success)', fontWeight:700, fontSize:12}}>✅ 동의</span>
                        : <span style={{color:'var(--text3)', fontSize:12}}>미동의</span>}
                    </td>
                    <td className="mono" style={{fontSize:11, color:'var(--text2)'}}>{new Date(c.created_at).toLocaleString('ko-KR')}</td>
                    <td><button className="btn-danger" onClick={() => handleDelete(c.id)}>삭제</button></td>
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

function CustomerLookupPage({ profile }) {
  const isManager = profile?.job_title === '매니저';
  const [search,    setSearch]   = useState('');
  const [fStore,    setFStore]   = useState('');
  const [fBranch,   setFBranch]  = useState('');
  const [fFrom,     setFFrom]    = useState('');
  const [fTo,       setFTo]      = useState('');
  const [customers, setCustomers]= useState([]);
  const [selected,  setSelected] = useState(null);
  const [purchases, setPurchases]= useState([]);
  const [loading,   setLoading]  = useState(false);
  const [loadingP,  setLoadingP] = useState(false);
  const [allStores, setAllStores]= useState([]);

  // 점포 목록 로드
  useEffect(() => {
    supabase.from('customers').select('store_name, branch_name')
      .then(({ data }) => {
        const stores = [...new Set((data||[]).map(d => d.store_name))].filter(Boolean).sort();
        setAllStores(stores);
      });
  }, []);

  const allBranches = useMemo(() => {
    if (!fStore) return [];
    const branches = [...new Set(
      (customers.length ? customers : []).map(c => c.branch_name).filter(Boolean)
    )].sort();
    return branches;
  }, [fStore, customers]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('customers')
      .select('*, creator:profiles(name)')
      .order('joined_at', { ascending: false });
    if (search.trim()) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    if (fStore)  q = q.eq('store_name', fStore);
    if (fBranch) q = q.eq('branch_name', fBranch);
    if (fFrom)   q = q.gte('joined_at', fFrom);
    if (fTo)     q = q.lte('joined_at', fTo);
    const { data } = await q.limit(200);
    setCustomers(data || []);
    setSelected(null); setPurchases([]);
    setLoading(false);
  }, [search, fStore, fBranch, fFrom, fTo]);

  // 점포 변경시 지점 초기화
  const handleStoreChange = (val) => { setFStore(val); setFBranch(''); };

  const fetchPurchases = async (customerId) => {
    setLoadingP(true);
    const { data } = await supabase.from('sales')
      .select('*, brand:brands(name), product:products(name)')
      .eq('customer_id', customerId)
      .order('sold_at', { ascending: false });
    setPurchases(data || []);
    setLoadingP(false);
  };

  const handleSelect = (c) => { setSelected(c); fetchPurchases(c.id); };

  const withdrawCustomer = async (c, e) => {
    e.stopPropagation();
    if (!window.confirm(`[${c.name}] 회원을 탈퇴 처리하시겠습니까?\n\n이름: ${c.name}\n연락처: ${c.phone}\n점포: ${c.store_name} ${c.branch_name}\n\n탈퇴 후에는 회원 정보가 삭제됩니다.`)) return;
    const { error } = await supabase.from('customers').delete().eq('id', c.id);
    if (error) toast(error.message, 'err');
    else {
      toast(`${c.name} 회원 탈퇴 처리 완료`, 'ok');
      if (selected?.id === c.id) setSelected(null);
      fetchCustomers();
    }
  };

  const totalAmt = useMemo(() => purchases.reduce((s,r) => s + r.price * r.quantity, 0), [purchases]);
  const totalQty = useMemo(() => purchases.reduce((s,r) => s + r.quantity, 0), [purchases]);

  // 지점 목록 (선택된 점포 기준으로 customers에서 추출)
  const branchList = useMemo(() => {
    const src = fStore ? customers.filter(c => c.store_name === fStore) : customers;
    return [...new Set(src.map(c => c.branch_name).filter(Boolean))].sort();
  }, [customers, fStore]);

  return (
    <div>
      {/* 검색·필터 */}
      <div className="card">
        <div className="card-label">회원 조회</div>
        <div className="fbar" style={{ flexWrap:'wrap', gap:8 }}>
          <input className="finput" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 연락처 검색" style={{ height:34 }}
            onKeyDown={e => e.key==='Enter' && fetchCustomers()} />
          <select className="fsel" value={fStore} onChange={e => handleStoreChange(e.target.value)}>
            <option value="">전체 점포</option>
            {allStores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)}
            disabled={!fStore} style={{ background: !fStore ? '#f0f0f0' : '#fff' }}>
            <option value="">전체 지점</option>
            {branchList.map(b => <option key={b}>{b}</option>)}
          </select>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} title="가입일 시작" />
          <span style={{fontSize:12,color:'var(--text3)'}}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} title="가입일 종료" />
          {(search||fStore||fBranch||fFrom||fTo) &&
            <button className="btn-ghost" onClick={() => { setSearch(''); setFStore(''); setFBranch(''); setFFrom(''); setFTo(''); setCustomers([]); setSelected(null); }}>✕ 초기화</button>}
          <div className="fbar-right">
            <button className="btn btn-p" onClick={fetchCustomers} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔍 조회'}
            </button>
          </div>
        </div>
      </div>

      {customers.length > 0 && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
            <span className="fresult">총 <b>{customers.length}</b>명 · SMS동의 <b>{customers.filter(c=>c.sms_consent).length}</b>명</span>
          </div>
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>가입일</th>
                  <th>이름</th>
                  <th>휴대폰번호</th>
                  <th>생일</th>
                  <th>점포</th>
                  <th>지점</th>
                  <th>담당매니저</th>
                  <th style={{textAlign:'center'}}>마케팅동의</th>
                  <th></th>
                  {!isManager && <th></th>}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} style={{cursor:'pointer'}} onClick={() => handleSelect(c)}>
                    <td className="mono" style={{fontSize:11}}>{c.joined_at}</td>
                    <td><strong style={{fontSize:13}}>{c.name}</strong></td>
                    <td className="mono" style={{fontSize:12}}>{c.phone}</td>
                    <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{c.birthday || '-'}</td>
                    <td><span className="badge badge-dept">{c.store_name}</span></td>
                    <td><span className="badge badge-store">{c.branch_name}</span></td>
                    <td style={{fontSize:12, color:'var(--accent)', fontWeight:600}}>{c.manager_name || '-'}</td>
                    <td style={{textAlign:'center'}}>
                      {c.sms_consent
                        ? <span style={{color:'var(--success)', fontWeight:700, fontSize:12}}>✅ 동의</span>
                        : <span style={{color:'var(--text3)', fontSize:12}}>미동의</span>
                      }
                    </td>
                    <td>
                      <button
                        className="btn btn-s"
                        style={{fontSize:11, padding:'3px 10px', opacity: c.sms_consent ? 1 : 0.35}}
                        title={c.sms_consent ? '문자 발송' : 'SMS 미동의 회원'}
                        onClick={e => {
                          e.stopPropagation();
                          if (!c.sms_consent) { toast('SMS 수신 미동의 회원입니다', 'err'); return; }
                          toast(`${c.name} (${c.phone}) — 문자 발송 기능은 SMS API 연동 후 활성화됩니다`, 'inf');
                        }}>
                        📱 문자
                      </button>
                    </td>
                    {!isManager && (
                      <td>
                        <button className="btn-danger" style={{padding:'3px 8px', fontSize:11}}
                          onClick={e => withdrawCustomer(c, e)}>
                          탈퇴
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 회원 상세 + 구매이력 패널 */}
      {selected && (
        <div className="card">
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              <div style={{fontSize:17, fontWeight:700}}>{selected.name}</div>
              <div style={{fontFamily:'var(--mono)', fontSize:13, color:'var(--text2)'}}>{selected.phone}</div>
              {selected.birthday && <div style={{fontSize:12, color:'var(--text3)'}}>🎂 {selected.birthday}</div>}
            </div>
            <button className="btn btn-s" style={{fontSize:11}} onClick={() => setSelected(null)}>닫기</button>
          </div>
          <div style={{display:'flex', flexWrap:'wrap', gap:8, fontSize:12, marginBottom:14, paddingBottom:12, borderBottom:'1px solid var(--border)'}}>
            <span style={{color:'var(--text3)'}}>가입일</span><strong>{selected.joined_at}</strong>
            <span style={{color:'var(--border2)'}}>|</span>
            <span className="badge badge-dept">{selected.store_name}</span>
            <span className="badge badge-store">{selected.branch_name}</span>
            {selected.manager_name && (<><span style={{color:'var(--border2)'}}>|</span><span style={{color:'var(--text3)'}}>담당</span><strong style={{color:'var(--accent)'}}>{selected.manager_name}</strong></>)}
            <span style={{color:'var(--border2)'}}>|</span>
            {selected.sms_consent
              ? <span style={{color:'var(--success)', fontWeight:700}}>✅ SMS동의</span>
              : <span style={{color:'var(--text3)'}}>SMS미동의</span>
            }
          </div>
          <div style={{display:'flex', gap:10, marginBottom:16}}>
            {[
              {label:'구매건수', value: purchases.length + '건'},
              {label:'구매수량', value: totalQty + '개'},
              {label:'총 결제금액', value: totalAmt.toLocaleString() + '원'},
            ].map(s => (
              <div key={s.label} style={{background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'7px 14px', textAlign:'center'}}>
                <div style={{fontSize:10, fontWeight:600, color:'var(--text2)'}}>{s.label}</div>
                <div style={{fontSize:15, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)', marginTop:2}}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="card-label">구매 이력</div>
          {loadingP ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>구매일</th><th>점포</th><th>지점</th>
                    <th>브랜드</th><th>상품명</th>
                    <th className="r">수량</th><th className="r">판매가</th><th className="r">합계</th>
                    <th>결제</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length === 0
                    ? <tr><td colSpan={9} className="empty">구매 이력이 없습니다</td></tr>
                    : purchases.map(p => (
                      <tr key={p.id}>
                        <td className="mono">{p.sold_at}</td>
                        <td><span className="badge badge-dept">{p.store_name}</span></td>
                        <td><span className="badge badge-store">{p.branch_name}</span></td>
                        <td>{p.brand?.name||'-'}</td>
                        <td>{p.product?.name||'-'}</td>
                        <td className="r">{p.quantity}</td>
                        <td className="r">{Number(p.price).toLocaleString()}</td>
                        <td className="r" style={{fontWeight:600}}>{(p.price*p.quantity).toLocaleString()}</td>
                        <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11}}>{p.payment}</span></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {customers.length === 0 && !loading && (
        <div className="empty">
          조건을 설정하고 <strong>조회</strong> 버튼을 눌러주세요<br/>
          <span style={{fontSize:11,color:'var(--text3)'}}>이름·연락처 검색, 점포·지점·날짜 필터 사용 가능 · 조건 없이 조회하면 전체 회원 표시</span>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 고객 입력 페이지
// ════════════════════════════════════════════════════════
function CustomerInputPage({ profile }) {
  const today = new Date().toISOString().slice(0, 10);
  const [joinedAt,    setJoinedAt]    = useState(today);
  const [custName,    setCustName]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [birthday,    setBirthday]    = useState('');
  const [managerName, setManagerName] = useState('');
  const [smsConsent,  setSmsConsent]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [recentList,  setRecent]      = useState([]);

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase.from('customers')
      .select('*').eq('created_by', profile.id)
      .order('created_at', { ascending: false }).limit(20);
    setRecent(data || []);
  }, [profile.id]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) { toast('연락처를 올바르게 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('customers').insert({
      joined_at: joinedAt,
      name: custName.trim(),
      phone: phone,
      birthday: birthday || null,
      store_name: profile.department,
      branch_name: profile.branch,
      manager_name: managerName.trim() || null,
      sms_consent: smsConsent,
      sms_consent_at: smsConsent ? new Date().toISOString() : null,
      created_by: profile.id,
    });
    if (error) { toast('저장 실패: ' + error.message, 'err'); }
    else { toast('회원 등록 완료', 'ok'); setCustName(''); setPhone(''); setBirthday(''); setManagerName(''); setSmsConsent(false); fetchRecent(); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 고객 정보를 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); fetchRecent(); }
  };

  const inputStyle = { width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      <div className="card">
        <div className="card-label">회원 등록</div>
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:16, fontFamily:'var(--mono)' }}>
          📍 {profile.department} · {profile.branch}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:14, marginBottom:16 }}>
            <div>
              <label style={labelStyle}>회원가입일</label>
              <input type="date" value={joinedAt} onChange={e => setJoinedAt(e.target.value)}
                style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>고객 이름</label>
              <input value={custName} onChange={e => setCustName(e.target.value)}
                style={inputStyle} placeholder="홍길동" required />
            </div>
            <div>
              <label style={labelStyle}>연락처</label>
              <input value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                style={inputStyle} placeholder="010-0000-0000" required />
            </div>
            <div>
              <label style={labelStyle}>담당 매니저 이름</label>
              <input value={managerName} onChange={e => setManagerName(e.target.value)}
                style={inputStyle} placeholder="매니저 이름 입력" />
            </div>
            <div>
              <label style={labelStyle}>생일 <span style={{color:'var(--text3)',fontWeight:400}}>(선택)</span></label>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                style={inputStyle} />
            </div>
          </div>

          {/* SMS 수신동의 */}
          <div style={{ background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:10 }}>📱 광고성 문자 수신 동의</div>
            <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)}
                style={{ width:17, height:17, marginTop:2, accentColor:'var(--accent)', flexShrink:0 }} />
              <div>
                <div style={{ fontSize:13, fontWeight:600, color: smsConsent ? 'var(--accent)' : 'var(--text2)' }}>
                  광고성 정보 문자 수신에 동의합니다 (선택)
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:4, lineHeight:1.6 }}>
                  이벤트, 프로모션, 신상품 안내 등 마케팅 목적의 문자메시지 수신에 동의합니다.<br/>
                  동의 철회는 매장 담당자에게 요청하실 수 있습니다.
                </div>
              </div>
            </label>
            {smsConsent && (
              <div style={{ marginTop:10, background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:6, padding:'8px 12px', fontSize:11, color:'#6d4c41' }}>
                ✅ 수신동의 일시가 자동으로 기록됩니다 ({new Date().toLocaleDateString('ko-KR')})
              </div>
            )}
          </div>

          <button className="btn btn-p" type="submit" disabled={saving} style={{ width:'100%', justifyContent:'center', height:40 }}>
            {saving ? <span className="spinner"/> : '✓ 회원 정보 저장'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-label">최근 입력 고객 (20건)</div>
        <div className="twrap">
          <table>
            <thead>
              <tr><th>가입일</th><th>이름</th><th>연락처</th><th>생일</th><th>담당 매니저</th><th>SMS동의</th><th>입력일시</th><th></th></tr>
            </thead>
            <tbody>
              {recentList.length === 0
                ? <tr><td colSpan={7} className="empty">입력된 고객이 없습니다</td></tr>
                : recentList.map(c => (
                  <tr key={c.id}>
                    <td className="mono">{c.joined_at}</td>
                    <td><strong>{c.name}</strong></td>
                    <td className="mono">{c.phone}</td>
                    <td className="mono" style={{fontSize:11}}>{c.birthday || '-'}</td>
                    <td style={{fontSize:12,color:'var(--accent)',fontWeight:600}}>{c.manager_name || '-'}</td>
                    <td>
                      {c.sms_consent
                        ? <span style={{color:'var(--success)', fontWeight:600, fontSize:12}}>✅ 동의</span>
                        : <span style={{color:'var(--text3)', fontSize:12}}>미동의</span>
                      }
                    </td>
                    <td className="mono" style={{fontSize:11,color:'var(--text2)'}}>{new Date(c.created_at).toLocaleString('ko-KR')}</td>
                    <td><button className="btn-danger" onClick={() => handleDelete(c.id)}>삭제</button></td>
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
// 판매내역 조회 (본사/관리자)
// ════════════════════════════════════════════════════════
function SalesListPage() {
  const [sales,   setSales]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [fStore,  setFStore]  = useState('');
  const [fBrand,  setFBrand]  = useState('');
  const [fFrom,   setFFrom]   = useState('');
  const [fTo,     setFTo]     = useState('');

  const fetchSales = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('sales')
      .select('*, brand:brands(name), product:products(name), seller:profiles(name,department,branch)')
      .order('sold_at', { ascending: false });
    if (fStore) q = q.eq('store_name', fStore);
    if (fBrand) q = q.eq('brand_id', fBrand);
    if (fFrom)  q = q.gte('sold_at', fFrom);
    if (fTo)    q = q.lte('sold_at', fTo);
    const { data, error } = await q.limit(500);
    if (error) toast(error.message, 'err');
    else setSales(data || []);
    setLoading(false);
  }, [fStore, fBrand, fFrom, fTo]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const [brands, setBrands] = useState([]);
  useEffect(() => { supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || [])); }, []);

  const stores = useMemo(() => uniq(sales.map(s => s.store_name)), [sales]);
  const totalQty = useMemo(() => sales.reduce((s, r) => s + r.quantity, 0), [sales]);
  const totalAmt = useMemo(() => sales.reduce((s, r) => s + r.price * r.quantity, 0), [sales]);

  return (
    <div>
      <div className="card">
        <div className="card-label">판매내역 조회</div>
        <div className="fbar">
          <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
            <option value="">전체 점포</option>
            {stores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBrand} onChange={e => setFBrand(e.target.value)}>
            <option value="">전체 브랜드</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} title="시작일" />
          <span style={{fontSize:12,color:'var(--text3)'}}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} title="종료일" />
          {(fStore||fBrand||fFrom||fTo) && <button className="btn-ghost" onClick={() => { setFStore(''); setFBrand(''); setFFrom(''); setFTo(''); }}>✕ 초기화</button>}
          <div className="fbar-right">
            <span className="fresult"><b>{sales.length.toLocaleString()}</b>건 · <b>{totalQty.toLocaleString()}</b>개 · <b>{totalAmt.toLocaleString()}</b>원</span>
          </div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>판매일</th><th>점포</th><th>지점</th><th>매니저</th>
                  <th>브랜드</th><th>상품명</th>
                  <th className="r">수량</th><th className="r">판매가</th><th className="r">합계</th>
                  <th>결제</th><th>메모</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0
                  ? <tr><td colSpan={11} className="empty">조회된 판매 내역이 없습니다</td></tr>
                  : sales.map(s => (
                    <tr key={s.id}>
                      <td className="mono">{s.sold_at}</td>
                      <td><span className="badge badge-dept">{s.store_name}</span></td>
                      <td><span className="badge badge-store">{s.branch_name}</span></td>
                      <td style={{fontSize:12}}>{s.seller?.name || '-'}</td>
                      <td>{s.brand?.name || '-'}</td>
                      <td>{s.product?.name || '-'}</td>
                      <td className="r">{s.quantity}</td>
                      <td className="r">{Number(s.price).toLocaleString()}</td>
                      <td className="r" style={{fontWeight:600}}>{(s.price * s.quantity).toLocaleString()}</td>
                      <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11}}>{s.payment}</span></td>
                      <td style={{fontSize:11,color:'var(--text2)'}}>{s.memo || '-'}</td>
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
    const { error } = await supabase.from('products').insert({
      brand_id: selBrand.id, name: newProd.trim(),
      price: Number(newPrice) || 0,
    });
    if (error) toast(error.message, 'err');
    else { toast('상품 추가 완료', 'ok'); setNewProd(''); setNewOption(''); setNewPrice(''); fetchAll(); }
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
          const price     = Number(row['판매가'] || row['price'] || 0);
          if (!brandName || !prodName) continue;
          let { data: br } = await supabase.from('brands').select('id').eq('name', brandName).single();
          if (!br) {
            const { data: newBr } = await supabase.from('brands').insert({ name: brandName }).select().single();
            br = newBr;
          }
          if (br) { await supabase.from('products').insert({ brand_id: br.id, name: prodName, price }); cnt++; }
        }
        toast(`${cnt}개 상품 업로드 완료`, 'ok'); fetchAll();
      } catch(err) { toast('파싱 실패: ' + err.message, 'err'); }
    };
    reader.readAsBinaryString(file);
  };

  const inputStyle = { height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const filteredProducts = selBrand ? products.filter(p => p.brand_id === selBrand.id) : products;

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
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 120px auto', gap:8, marginBottom:14, alignItems:'end'}}>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>브랜드 선택</label>
                  <select value={selBrand?.id||''} onChange={e => setSelBrand(brands.find(b=>b.id===Number(e.target.value))||null)}
                    style={{...inputStyle, width:'100%'}}>
                    <option value="">-- 선택 --</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>상품명</label>
                  <input value={newProd} onChange={e => setNewProd(e.target.value)} style={{...inputStyle, width:'100%'}} placeholder="상품명 입력"/>
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
          <div className="card-label">{selBrand ? selBrand.name : '전체'} 상품 현황 ({filteredProducts.length}개)</div>
          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead><tr><th>브랜드</th><th>상품명</th><th className="r">판매가</th><th></th></tr></thead>
                <tbody>
                  {filteredProducts.length === 0
                    ? <tr><td colSpan={4} className="empty">등록된 상품이 없습니다</td></tr>
                    : filteredProducts.map(p => (
                      <tr key={p.id}>
                        <td><span className="badge badge-dept">{p.brand?.name}</span></td>
                        <td>{p.name}</td>
                        <td className="r" style={{fontFamily:'var(--mono)',fontWeight:600,color:'var(--accent)'}}>{Number(p.price).toLocaleString()}원</td>
                        <td><button className="btn-danger" onClick={() => deleteProduct(p.id)}>삭제</button></td>
                      </tr>
                    ))
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
function IncentivePage() {
  const [tab, setTab] = useState('condition'); // 'condition' | 'calc'

  return (
    <div>
      {/* 탭 */}
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        {[{key:'condition',label:'📋 급여 조건'},{key:'calc',label:'🧮 급여 계산'}].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ height:38, padding:'0 20px', border:'2px solid', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 120ms',
              borderColor: tab===t.key ? 'var(--accent)' : 'var(--border)',
              background: tab===t.key ? '#fff3e0' : '#fff',
              color: tab===t.key ? 'var(--accent)' : 'var(--text2)' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'condition' && <SalaryConditionTab/>}
      {tab === 'calc'      && <SalaryCalcTab/>}
    </div>
  );
}

function SalaryConditionTab() {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [fStore,   setFStore]   = useState('');
  const [fBranch,  setFBranch]  = useState('');
  const [fJob,     setFJob]     = useState('');

  useEffect(() => {
    supabase.from('store_members')
      .select('*, store:profiles!store_account_id(department, branch)')
      .order('store_account_id')
      .then(({ data }) => { setMembers(data || []); setLoading(false); });
  }, []);

  const stores   = useMemo(() => uniq(members.map(m => m.store?.department).filter(Boolean)), [members]);
  const branches = useMemo(() => uniq((fStore ? members.filter(m => m.store?.department===fStore) : members).map(m => m.store?.branch).filter(Boolean)), [members, fStore]);

  const filtered = useMemo(() => {
    let r = members;
    if (fStore)  r = r.filter(m => m.store?.department===fStore);
    if (fBranch) r = r.filter(m => m.store?.branch===fBranch);
    if (fJob)    r = r.filter(m => m.job_title===fJob);
    return r;
  }, [members, fStore, fBranch, fJob]);

  const td = { fontSize:13, color:'var(--text)' };

  return (
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
              <tr><th>점포</th><th>지점</th><th>소속</th><th>직급</th><th>이름</th><th>연락처</th><th>급여방법</th><th className="r">기본급여</th><th className="r">금·토·일 추가</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={9} className="empty">근무자가 없습니다</td></tr>
                : filtered.map(m => (
                  <tr key={m.id}>
                    <td><span className="badge badge-dept">{m.store?.department}</span></td>
                    <td><span className="badge badge-store">{m.store?.branch}</span></td>
                    <td style={td}>{m.affiliation || '-'}</td>
                    <td style={{...td, fontWeight:600, color: m.job_title==='매니저'?'var(--accent)':'var(--text2)'}}>{m.job_title}</td>
                    <td style={{...td, fontWeight:700}}>{m.display_name || m.name}</td>
                    <td style={td}>{m.phone || '-'}</td>
                    <td style={td}>
                      <span style={{padding:'2px 8px', borderRadius:4, fontSize:12, fontWeight:600,
                        background: m.salary_type==='월급'?'#e3f2fd':'#f3e5f5',
                        color: m.salary_type==='월급'?'#1565C0':'#6a1b9a'}}>
                        {m.salary_type}
                      </span>
                    </td>
                    <td className="r" style={{...td, fontWeight:700, fontFamily:'var(--mono)'}}>{(m.salary||0).toLocaleString()}원</td>
                    <td className="r" style={{...td, fontFamily:'var(--mono)', color: m.extra_pay>0?'var(--success)':'var(--text3)'}}>
                      {m.extra_pay > 0 ? `+${(m.extra_pay).toLocaleString()}원` : '-'}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
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
      <div style={{position:'relative', background:'#fff', borderRadius:16, padding:'28px 24px', width:'min(760px, 95vw)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
        onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', alignItems:'center', marginBottom:20}}>
          <div>
            <div style={{fontSize:18, fontWeight:700}}>{member.display_name || member.name} 출근표</div>
            <div style={{fontSize:13, color:'var(--text2)', marginTop:2}}>
              {year}년 {month}월 · {member.store?.branch} · {member.salary_type}
              {member.salary_type === '일급' && ` (기본 ${(member.salary||0).toLocaleString()}원${member.extra_pay ? ` / 금토일 +${(member.extra_pay).toLocaleString()}원` : ''})`}
            </div>
          </div>
          <button onClick={onClose}
            style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999', lineHeight:1}}>✕</button>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:4}}>
              {dayNames.map((d,i) => (
                <div key={d} style={{textAlign:'center', fontSize:12, fontWeight:700, padding:'6px 0',
                  color: i===0?'#c62828':i===6?'#1565C0':'var(--text3)'}}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4}}>
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
                    borderRadius:8, padding:'6px 5px', minHeight:90,
                    background: rec ? (isWeekend ? '#fff3e0' : '#e8f5e9') : '#fafafa',
                    border: `1px solid ${rec ? (isWeekend ? '#ffcc80' : '#a5d6a7') : '#e0e0e0'}`,
                  }}>
                    <div style={{fontSize:13, fontWeight:700, marginBottom:3,
                      color: isSun?'#c62828': isSat?'#1565C0': isFri?'#2e7d32':'var(--text)'}}>
                      {day}
                    </div>
                    {rec ? (
                      <div style={{fontSize:10, lineHeight:1.7}}>
                        {rec.clock_in  && <div style={{color:'#2E7D32', fontWeight:600}}>↑ {fmt(rec.clock_in)}</div>}
                        {rec.clock_out && <div style={{color:'#C62828', fontWeight:600}}>↓ {fmt(rec.clock_out)}</div>}
                        {rec.clock_in && rec.clock_out && <div style={{color:'var(--text2)'}}>{duration(rec.clock_in, rec.clock_out)}</div>}
                        {sal !== null && <div style={{color:'var(--accent)', fontWeight:700, marginTop:2}}>{sal.toLocaleString()}원</div>}
                        {member.salary_type === '월급' && <div style={{color:'var(--text3)', fontSize:9}}>월급제</div>}
                      </div>
                    ) : (
                      <div style={{fontSize:10, color:'#ccc', marginTop:4}}>-</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:16, padding:'12px 16px', background:'#f8f8f8', borderRadius:8, display:'flex', gap:24, flexWrap:'wrap'}}>
              <div><span style={{fontSize:12, color:'var(--text3)'}}>출근일수 </span><strong>{records.length}일</strong></div>
              {member.salary_type === '일급' && (
                <>
                  <div><span style={{fontSize:12, color:'var(--text3)'}}>평일 </span><strong>{records.filter(r => {const d=new Date(r.work_date).getDay(); return d!==0&&d!==5&&d!==6;}).length}일</strong></div>
                  <div><span style={{fontSize:12, color:'var(--text3)'}}>금·토·일 </span><strong style={{color:'var(--success)'}}>{records.filter(r => {const d=new Date(r.work_date).getDay(); return d===0||d===5||d===6;}).length}일</strong></div>
                </>
              )}
              <div style={{marginLeft:'auto'}}>
                <span style={{fontSize:12, color:'var(--text3)'}}>이번 달 지급액 </span>
                <strong style={{fontSize:16, color:'var(--accent)'}}>{member.salary.toLocaleString()}원</strong>
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
      return { ...m, totalDays: dates.length, weekdays, weekends, salary };
    });

    setRows(result.sort((a,b) => (a.store?.department||'').localeCompare(b.store?.department||'')));
    setLoading(false);
  }, [selYear, selMonth]);

  useEffect(() => { calcSalary(); }, [calcSalary]);

  const stores = useMemo(() => uniq(rows.map(r => r.store?.department).filter(Boolean)), [rows]);
  const filtered = useMemo(() => fStore ? rows.filter(r => r.store?.department===fStore) : rows, [rows, fStore]);
  const totalSalary = useMemo(() => filtered.reduce((s,r) => s+r.salary, 0), [filtered]);
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
          <div className="twrap" style={{margin:0}}>
            <table>
              <thead>
                <tr><th>점포</th><th>지점</th><th>직급</th><th>이름</th><th>급여방법</th><th className="r">출근일수</th><th className="r">평일</th><th className="r">금·토·일</th><th className="r">지급급여</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id}>
                    <td><span className="badge badge-dept">{m.store?.department}</span></td>
                    <td><span className="badge badge-store">{m.store?.branch}</span></td>
                    <td style={{fontSize:13, fontWeight:600, color: m.job_title==='매니저'?'var(--accent)':'var(--text2)'}}>{m.job_title}</td>
                    <td style={{fontSize:13, fontWeight:700}}>{m.display_name || m.name}</td>
                    <td><span style={{padding:'2px 8px', borderRadius:4, fontSize:12, fontWeight:600, background: m.salary_type==='월급'?'#e3f2fd':'#f3e5f5', color: m.salary_type==='월급'?'#1565C0':'#6a1b9a'}}>{m.salary_type}</span></td>
                    <td className="r" style={{fontSize:13, fontFamily:'var(--mono)', fontWeight:600}}>{m.salary_type==='월급' ? '-' : `${m.totalDays}일`}</td>
                    <td className="r" style={{fontSize:13, fontFamily:'var(--mono)', color:'var(--text2)'}}>{m.salary_type==='월급' ? '-' : `${m.weekdays}일`}</td>
                    <td className="r" style={{fontSize:13, fontFamily:'var(--mono)', color: m.weekends>0?'var(--success)':'var(--text3)'}}>{m.salary_type==='월급' ? '-' : `${m.weekends}일`}</td>
                    <td className="r" style={{fontSize:13, fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{m.salary.toLocaleString()}원</td>
                    <td><button className="btn btn-s" style={{fontSize:11, padding:'4px 10px', whiteSpace:'nowrap'}} onClick={() => setCalTarget(m)}>상세보기</button></td>
                  </tr>
                ))}
                <tr style={{background:'var(--bg3)', borderTop:'2px solid var(--border2)'}}>
                  <td colSpan={9} style={{padding:'10px 11px', fontWeight:700}}>합계</td>
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

// ════════════════════════════════════════════════════════
// 홈 페이지 (당월 누적 판매매출)
// ════════════════════════════════════════════════════════
function HomePage({ profile, setPage }) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${year}-${month}-01`;
  const toLocalDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = toLocalDate(yesterday);
  const monthLabel = `${year}년 ${month}월`;

  const [summary,    setSummary]    = useState(null);
  const [storeRows,  setStoreRows]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  const isManager = profile?.job_title === '매니저';
  const today = now.getDate();
  const isReminderPeriod = today >= 20 && today <= 25;

  // 다음달 문자열
  const nextM = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonStr = `${nextM.getFullYear()}-${String(nextM.getMonth()+1).padStart(2,'0')}`;
  const daysLeft = 25 - today;

  useEffect(() => {
    if (!isManager || !isReminderPeriod) return;
    supabase.from('leave_plans')
      .select('id').eq('manager_id', profile.id).eq('target_month', nextMonStr)
      .maybeSingle()
      .then(({ data }) => { if (!data) setShowBanner(true); });
  }, [isManager, isReminderPeriod, profile?.id, nextMonStr]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let query = supabase.from('sales')
        .select('store_name, branch_name, quantity, price, sold_at')
        .gte('sold_at', monthStart)
        .lte('sold_at', yesterdayStr);

      // 매니저는 본인 지점만 필터링
      if (isManager && profile?.department) {
        query = query.eq('store_name', profile.department).eq('branch_name', profile.branch);
      }

      const { data } = await query;
      const rows = data || [];
      const totalAmt   = rows.reduce((s,r) => s + r.price * r.quantity, 0);
      const totalCount = rows.length;
      const totalQty   = rows.reduce((s,r) => s + r.quantity, 0);

      // 점포/지점별 집계
      const map = new Map();
      for (const r of rows) {
        const key = `${r.store_name}|||${r.branch_name}`;
        if (!map.has(key)) map.set(key, { store: r.store_name, branch: r.branch_name, count: 0, qty: 0, amt: 0 });
        const e = map.get(key);
        e.count += 1; e.qty += r.quantity; e.amt += r.price * r.quantity;
      }
      const stores = [...map.values()].sort((a,b) => b.amt - a.amt);

      setSummary({ totalAmt, totalCount, totalQty, storeCount: map.size });
      setStoreRows(stores);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="empty"><span className="spinner"/></div>;

  return (
    <div>
      {/* 휴무계획 미제출 알림 배너 */}
      {showBanner && (
        <div style={{ display:'flex', alignItems:'center', gap:12, background:'#ffebee', border:'1px solid #ef9a9a', borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:16 }}>
          <span style={{ fontSize:18, flexShrink:0 }}>🔴</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#c62828', marginBottom:2 }}>
              {nextMonStr.replace('-','년 ').replace('-','월')} 휴무계획을 아직 제출하지 않았습니다
            </div>
            <div style={{ fontSize:12, color:'#b71c1c' }}>
              제출 마감일: {now.getMonth()+1}월 25일 · 오늘 포함 {daysLeft + 1}일 남았습니다
            </div>
          </div>
          <button
            onClick={() => { setShowBanner(false); setPage && setPage('leave_plan'); }}
            style={{ height:32, padding:'0 14px', background:'#c62828', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            지금 제출
          </button>
          <button onClick={() => setShowBanner(false)}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#ef9a9a', flexShrink:0, lineHeight:1 }}>✕</button>
        </div>
      )}

      {/* 월 헤더 */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:4 }}>
          {monthLabel} 누적 판매매출
          {isManager && <span style={{ fontSize:13, fontWeight:500, color:'var(--text3)', marginLeft:8 }}>({profile?.branch})</span>}
        </div>
        <div style={{ fontSize:12, color:'var(--text3)', fontFamily:'var(--mono)' }}>
          {monthStart} ~ {yesterdayStr} (어제까지)
        </div>
      </div>

      {/* 상단 요약 카드 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'총 매출금액', value: summary.totalAmt.toLocaleString() + '원', big: true },
          { label:'판매 건수',   value: summary.totalCount.toLocaleString() + '건' },
          { label:'판매 수량',   value: summary.totalQty.toLocaleString() + '개' },
          { label:'활동 점포',   value: summary.storeCount + '개' },
        ].map(s => (
          <div key={s.label} style={{
            background:'#fff', border: s.big ? '2px solid var(--sidebar)' : '1px solid var(--border)',
            borderRadius:'var(--radius)', padding:'16px 20px',
            boxShadow: s.big ? '0 2px 12px rgba(255,214,0,0.2)' : 'none',
          }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize: s.big ? 26 : 22, fontWeight:700, color: s.big ? 'var(--accent)' : 'var(--text)', fontFamily:'var(--mono)', lineHeight:1 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* 점포/지점별 테이블 */}
      <div className="card">
        <div className="card-label">점포 / 지점별 당월 누적 판매매출</div>
        {storeRows.length === 0 ? (
          <div className="empty">이번 달 판매 데이터가 없습니다</div>
        ) : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>점포</th>
                  <th>지점</th>
                  <th className="r">판매건수</th>
                  <th className="r">판매수량</th>
                  <th className="r">매출금액</th>
                  <th style={{minWidth:120}}>비중</th>
                </tr>
              </thead>
              <tbody>
                {storeRows.map((r, i) => {
                  const pct = summary.totalAmt > 0 ? (r.amt / summary.totalAmt * 100).toFixed(1) : 0;
                  return (
                    <tr key={i}>
                      <td className="mono" style={{ color:'var(--text3)', width:40 }}>{i+1}</td>
                      <td><span className="badge badge-dept">{r.store}</span></td>
                      <td><span className="badge badge-store">{r.branch}</span></td>
                      <td className="r">{r.count.toLocaleString()}건</td>
                      <td className="r">{r.qty.toLocaleString()}개</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)' }}>
                        {r.amt.toLocaleString()}원
                      </td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ flex:1, height:6, background:'#f0f0f0', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ width:`${pct}%`, height:'100%', background:'var(--sidebar)', borderRadius:3 }}/>
                          </div>
                          <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text2)', minWidth:36 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* 합계 */}
                <tr style={{ background:'var(--bg3)', borderTop:'2px solid var(--border2)' }}>
                  <td colSpan={3} style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)', padding:'9px 11px', fontWeight:700 }}>합계</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{summary.totalCount.toLocaleString()}건</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{summary.totalQty.toLocaleString()}개</td>
                  <td className="r" style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)', fontSize:14 }}>{summary.totalAmt.toLocaleString()}원</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 재고현황 페이지 (직접 입력 or 파일 업로드)
// ════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════
// 공지사항 페이지
// ════════════════════════════════════════════════════════
function NoticePage({ profile }) {
  const isAdmin = profile?.role === 'admin';
  const [notices,  setNotices]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [writing,  setWriting]  = useState(false);
  const [title,    setTitle]    = useState('');
  const [content,  setContent]  = useState('');
  const [saving,   setSaving]   = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('notices')
      .select('*, author:profiles(name)')
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) { toast('제목과 내용을 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('notices').insert({
      title: title.trim(), content: content.trim(), created_by: profile.id
    });
    if (error) toast(error.message, 'err');
    else { toast('공지사항 등록 완료', 'ok'); setTitle(''); setContent(''); setWriting(false); fetchNotices(); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('공지사항을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); setSelected(null); fetchNotices(); }
  };

  const inputStyle = { width:'100%', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };

  return (
    <div>
      {/* 작성 폼 */}
      {isAdmin && (
        <div className="card" style={{marginBottom:14}}>
          {!writing ? (
            <button className="btn btn-p" onClick={() => setWriting(true)}>+ 공지사항 작성</button>
          ) : (
            <>
              <div className="card-label">공지사항 작성</div>
              <div style={{marginBottom:10}}>
                <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>제목</label>
                <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="공지사항 제목"/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>내용</label>
                <textarea value={content} onChange={e => setContent(e.target.value)}
                  style={{...inputStyle, height:120, resize:'vertical', lineHeight:1.6}}
                  placeholder="공지사항 내용을 입력하세요"/>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-p" onClick={handleSave} disabled={saving}>{saving ? <span className="spinner"/> : '등록'}</button>
                <button className="btn btn-s" onClick={() => {setWriting(false);setTitle('');setContent('');}}>취소</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 목록 + 상세 */}
      <div style={{display:'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr', gap:14}}>
        <div className="card" style={{padding:'14px 16px'}}>
          <div className="card-label">공지사항 목록</div>
          {loading ? <div className="empty"><span className="spinner"/></div>
            : notices.length === 0 ? <div className="empty">등록된 공지사항이 없습니다</div>
            : notices.map(n => (
              <div key={n.id} onClick={() => setSelected(n)}
                style={{padding:'11px 12px', borderRadius:'var(--radius)', cursor:'pointer', marginBottom:4,
                  background: selected?.id===n.id ? '#fff8e1' : 'var(--bg3)',
                  border: `1px solid ${selected?.id===n.id ? '#ffcc80' : 'transparent'}`}}>
                <div style={{fontWeight:600, fontSize:13, marginBottom:3}}>{n.title}</div>
                <div style={{fontSize:11, color:'var(--text3)', display:'flex', gap:8}}>
                  <span>{n.author?.name || '-'}</span>
                  <span>{new Date(n.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            ))
          }
        </div>

        {selected && (
          <div className="card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, paddingBottom:12, borderBottom:'1px solid var(--border)'}}>
              <div>
                <div style={{fontSize:16, fontWeight:700, marginBottom:6}}>{selected.title}</div>
                <div style={{fontSize:12, color:'var(--text3)'}}>
                  {selected.author?.name} · {new Date(selected.created_at).toLocaleString('ko-KR')}
                </div>
              </div>
              <div style={{display:'flex', gap:6}}>
                {isAdmin && <button className="btn-danger" onClick={() => handleDelete(selected.id)}>삭제</button>}
                <button className="btn btn-s" style={{fontSize:11}} onClick={() => setSelected(null)}>닫기</button>
              </div>
            </div>
            <div style={{fontSize:13, lineHeight:1.8, color:'var(--text)', whiteSpace:'pre-wrap'}}>{selected.content}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 내 회원 목록 (매니저 전용)
// ════════════════════════════════════════════════════════
function MyMembersPage({ profile }) {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [purchases,setPurchases]= useState([]);
  const [loadingP, setLoadingP] = useState(false);
  const [fSearch,  setFSearch]  = useState('');

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('customers')
      .select('*')
      .eq('manager_name', profile.name)
      .order('joined_at', { ascending: false });
    setMembers(data || []);
    setLoading(false);
  }, [profile.name]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const fetchPurchases = async (customerId) => {
    setLoadingP(true);
    const { data } = await supabase.from('sales')
      .select('*, brand:brands(name), product:products(name)')
      .eq('customer_id', customerId)
      .order('sold_at', { ascending: false });
    setPurchases(data || []);
    setLoadingP(false);
  };

  const handleSelect = (m) => { setSelected(m); fetchPurchases(m.id); };

  const filtered = useMemo(() => {
    if (!fSearch) return members;
    const q = fSearch.toLowerCase();
    return members.filter(m => m.name.toLowerCase().includes(q) || m.phone.includes(q));
  }, [members, fSearch]);

  const totalAmt = useMemo(() => purchases.reduce((s,r) => s + r.price * r.quantity, 0), [purchases]);
  const totalQty = useMemo(() => purchases.reduce((s,r) => s + r.quantity, 0), [purchases]);

  const consentCount = useMemo(() => members.filter(m => m.sms_consent).length, [members]);

  return (
    <div>
      {/* 요약 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        {[
          { label:'총 회원수',      value: members.length + '명' },
          { label:'SMS 동의 회원',  value: consentCount + '명' },
          { label:'미동의 회원',    value: (members.length - consentCount) + '명' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 18px' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr', gap:16 }}>
        {/* 회원 목록 */}
        <div className="card" style={{ padding:'16px 18px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <input className="finput" value={fSearch} onChange={e => setFSearch(e.target.value)}
              placeholder="이름 또는 연락처 검색" style={{ flex:1 }}/>
            {fSearch && <button className="btn-ghost" onClick={() => setFSearch('')}>✕</button>}
          </div>
          {loading ? <div className="empty"><span className="spinner"/></div>
            : filtered.length === 0 ? <div className="empty">등록된 회원이 없습니다</div>
            : filtered.map(m => (
              <div key={m.id} onClick={() => handleSelect(m)}
                style={{
                  padding:'11px 12px', borderRadius:'var(--radius)', cursor:'pointer', marginBottom:4,
                  background: selected?.id===m.id ? '#fff8e1' : 'var(--bg3)',
                  border: `1px solid ${selected?.id===m.id ? '#ffcc80' : 'transparent'}`,
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <strong style={{ fontSize:13 }}>{m.name}</strong>
                  <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>{m.joined_at}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)', marginTop:2 }}>{m.phone}</div>
                <div style={{ display:'flex', gap:6, marginTop:5, alignItems:'center' }}>
                  <span className="badge badge-dept" style={{fontSize:10}}>{m.store_name}</span>
                  <span className="badge badge-store" style={{fontSize:10}}>{m.branch_name}</span>
                  <span style={{ fontSize:10, marginLeft:'auto', color: m.sms_consent ? 'var(--success)' : 'var(--text3)', fontWeight:600 }}>
                    {m.sms_consent ? '✅ SMS동의' : 'SMS미동의'}
                  </span>
                </div>
              </div>
            ))
          }
        </div>

        {/* 구매 이력 */}
        {selected && (
          <div className="card">
            <div style={{ background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ fontSize:16, fontWeight:700 }}>{selected.name}</div>
                <div style={{ fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)' }}>{selected.phone}</div>
                {selected.sms_consent
                  ? <span style={{ marginLeft:'auto', fontSize:11, color:'var(--success)', fontWeight:700 }}>✅ SMS동의</span>
                  : <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)' }}>SMS미동의</span>
                }
              </div>
              <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12 }}>
                가입일 <strong>{selected.joined_at}</strong> · <span className="badge badge-dept">{selected.store_name}</span> <span className="badge badge-store">{selected.branch_name}</span>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                {[
                  { label:'구매건수', value: purchases.length + '건' },
                  { label:'구매수량', value: totalQty + '개' },
                  { label:'총 결제금액', value: totalAmt.toLocaleString() + '원' },
                ].map(s => (
                  <div key={s.label} style={{ background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'7px 14px', textAlign:'center' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text2)' }}>{s.label}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)', marginTop:2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-label">구매 이력</div>
            {loadingP ? <div className="empty"><span className="spinner"/></div> : (
              <div className="twrap">
                <table>
                  <thead>
                    <tr><th>구매일</th><th>점포</th><th>지점</th><th>상품명</th><th className="r">수량</th><th className="r">합계</th><th>결제</th></tr>
                  </thead>
                  <tbody>
                    {purchases.length === 0
                      ? <tr><td colSpan={7} className="empty">구매 이력이 없습니다</td></tr>
                      : purchases.map(p => (
                        <tr key={p.id}>
                          <td className="mono">{p.sold_at}</td>
                          <td><span className="badge badge-dept">{p.store_name}</span></td>
                          <td><span className="badge badge-store">{p.branch_name}</span></td>
                          <td style={{fontSize:12}}>{p.product?.name||'-'}</td>
                          <td className="r">{p.quantity}</td>
                          <td className="r" style={{fontWeight:600,color:'var(--accent)'}}>{(p.price*p.quantity).toLocaleString()}</td>
                          <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11}}>{p.payment}</span></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
            <button className="btn btn-s" style={{marginTop:12, fontSize:11}} onClick={() => setSelected(null)}>닫기</button>
          </div>
        )}
      </div>
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


const HQ_MENUS = [
  { key: 'product_mgmt', icon: '🛍️', label: '상품관리', sub: [
    { key: 'product_add', icon: '➕', label: '상품추가' },
  ]},
  { key: 'stock_mgmt', icon: '📦', label: '재고관리', sub: [
    { key: 'stock_center', icon: '🏭', label: '센터재고' },
    { key: 'stock_store',  icon: '🏬', label: '매장재고' },
    { key: 'stock_safety', icon: '🛡️', label: '안전재고' },
  ]},
  { key: 'manager_mgmt', icon: '👔', label: '직원관리', sub: [
    { key: 'incentive', icon: '💰', label: '급여 조회' },
  ]},
  { key: 'attendance_mgmt', icon: '🗓️', label: '근태관리' },
  { key: 'member_mgmt',  icon: '👥', label: '고객관리' },
  { key: 'sales_view',   icon: '📋', label: '매출조회' },
];
const MANAGER_MENUS = [
  { key: 'home',        icon: '🏠', label: '홈 대시보드' },
  { key: 'sales_input', icon: '🛒', label: '판매 입력' },
  { key: 'stock_request', icon: '📦', label: '재고 요청' },
  { key: 'customer_reg', icon: '👤', label: '회원 관리', sub: [
    { key: 'customer_qr',  icon: '📱', label: 'QR 가입' },
    { key: 'customer_doc', icon: '📝', label: '서류 가입' },
    { key: 'my_members',   icon: '📋', label: '회원 목록' },
  ]},
  { key: 'attendance', icon: '🗓️', label: '근태 관리', sub: [
    { key: 'my_attendance', icon: '📊', label: '근무 현황' },
    { key: 'leave_plan',    icon: '📅', label: '휴무 신청' },
  ]},
];
const ADMIN_MENUS = [
  { key: 'admin',  icon: '🔐', label: '사용자 관리' },
  { key: 'notice', icon: '📢', label: '공지 사항' },
];

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

  const filteredProds = brandId && prodSearch
    ? allProducts.filter(p => String(p.brand_id) === String(brandId) && p.name.toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 8)
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
    setProdId(p.id); setProdName(p.name); setProdSearch(p.name); setShowSugg(false);
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
              <select value={brandId} onChange={e => handleBrandChange(e.target.value)} style={inputStyle} required>
                <option value="">-- 브랜드 선택 --</option>
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
                style={{ ...inputStyle, background: !brandId ? '#f0f0f0' : '#fff' }}
                placeholder={!brandId ? '브랜드 먼저 선택' : '상품명 키워드 입력'}
                disabled={!brandId}
                autoComplete="off"
              />
              {prodId && (
                <div style={{ marginTop:4, fontSize:12, color:'var(--success)', fontWeight:600 }}>✅ {prodName}</div>
              )}
              {showSugg && filteredProds.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:220, overflowY:'auto' }}>
                  {filteredProds.map(p => (
                    <div key={p.id}
                      onMouseDown={e => { e.preventDefault(); handleSelectProd(p); }}
                      style={{ padding:'9px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0f0f0' }}
                      onMouseEnter={e => e.currentTarget.style.background='#fffde7'}
                      onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                      {p.name}
                    </div>
                  ))}
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
// 사이드바 출퇴근 패널 (매니저 전용)
// ════════════════════════════════════════════════════════
function ClockModal({ type, members, todayMap, onConfirm, onClose }) {
  const [selMember, setSelMember] = useState(null);
  const label = type === 'in' ? '출근' : '퇴근';
  const color = type === 'in' ? '#2E7D32' : '#C62828';

  // 체크 가능한 근무자 필터
  const available = members.filter(m => {
    const rec = todayMap[m.name];
    if (type === 'in') return !rec;              // 출근 기록 없는 사람만
    return rec && !rec.clock_out;                // 출근했고 퇴근 안 한 사람만
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)' }}/>
      <div style={{ position:'relative', background:'#fff', borderRadius:16, padding:'28px 24px', width:320, maxWidth:'90vw', boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        {/* 타이틀 */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>{type === 'in' ? '🟢' : '🔴'}</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#111' }}>{label} 체크</div>
          <div style={{ fontSize:13, color:'#888', marginTop:4 }}>근무자를 선택하세요</div>
        </div>

        {/* 근무자 버튼 */}
        {available.length === 0 ? (
          <div style={{ textAlign:'center', padding:'16px 0', fontSize:13, color:'#999' }}>
            {type === 'in' ? '모든 근무자가 이미 출근 체크했습니다' : '퇴근 체크할 근무자가 없습니다'}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
            {available.map(m => (
              <button key={m.name} type="button"
                onClick={() => setSelMember(selMember?.name === m.name ? null : m)}
                style={{ height:56, border:'2px solid', borderRadius:10, fontSize:15, fontWeight:700, cursor:'pointer', transition:'all 120ms',
                  borderColor: selMember?.name === m.name ? color : '#e0e0e0',
                  background: selMember?.name === m.name ? (type==='in'?'#e8f5e9':'#ffebee') : '#fafafa',
                  color: selMember?.name === m.name ? color : '#555',
                }}>
                {m.display_name || m.name}
                <div style={{ fontSize:11, fontWeight:400, marginTop:3, color: selMember?.name===m.name ? color : '#999' }}>{m.job_title}</div>
              </button>
            ))}
          </div>
        )}

        {/* 확인 / 취소 버튼 */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose}
            style={{ flex:1, height:44, border:'1px solid #e0e0e0', borderRadius:10, background:'#fafafa', fontSize:14, fontWeight:600, color:'#888', cursor:'pointer' }}>
            취소
          </button>
          <button onClick={() => selMember && onConfirm(selMember)}
            disabled={!selMember}
            style={{ flex:2, height:44, border:'none', borderRadius:10, background: selMember ? color : '#e0e0e0', fontSize:14, fontWeight:700, color: selMember ? '#fff' : '#bbb', cursor: selMember ? 'pointer' : 'default', transition:'all 120ms' }}>
            {selMember ? `${selMember.display_name || selMember.name} ${label} 확인` : `${label} 확인`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarClockPanel({ profile }) {
  const [members,  setMembers]  = useState([]);
  const [loaded,   setLoaded]   = useState(false);
  const [popup,    setPopup]    = useState(null); // 'in' | 'out'
  const [saving,   setSaving]   = useState(false);
  const [todayMap, setTodayMap] = useState({}); // name → attendance record

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const dateLabel = () => {
    const d = new Date();
    const days = ['일','월','화','수','목','금','토'];
    return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  };
  const fmt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const fetchToday = useCallback(async () => {
    const { data } = await supabase.from('attendance')
      .select('*').eq('manager_id', profile.id).eq('work_date', todayStr());
    const map = {};
    (data || []).forEach(r => { map[r.manager_name] = r; });
    setTodayMap(map);
  }, [profile.id]);

  useEffect(() => {
    supabase.from('store_members').select('name, display_name, job_title')
      .eq('store_account_id', profile.id).order('is_primary', { ascending: false })
      .then(({ data }) => { setMembers(data || []); setLoaded(true); });
    fetchToday();
  }, [profile.id, fetchToday]);

  const handleConfirm = async (member) => {
    if (saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const rec = todayMap[member.name];
    if (popup === 'in') {
      const { data, error } = await supabase.from('attendance').insert({
        manager_id: profile.id, manager_name: member.name,
        store_name: profile.department, branch_name: profile.branch,
        work_date: todayStr(), clock_in: now,
      }).select().single();
      if (!error) {
        setTodayMap(prev => ({ ...prev, [member.name]: data }));
        toast(`${member.display_name || member.name} 출근 체크 완료 ✅`, 'ok');
      }
    } else {
      const { data, error } = await supabase.from('attendance')
        .update({ clock_out: now }).eq('id', rec.id).select().single();
      if (!error) {
        setTodayMap(prev => ({ ...prev, [member.name]: data }));
        toast(`${member.display_name || member.name} 퇴근 체크 완료 ✅`, 'ok');
      }
    }
    setSaving(false);
    setPopup(null);
  };

  if (!loaded) return null;

  const anyIn   = members.some(m => todayMap[m.name]);
  const allIn   = members.length > 0 && members.every(m => todayMap[m.name]);
  const anyOut  = members.some(m => todayMap[m.name]?.clock_out);
  const canOut  = members.some(m => todayMap[m.name] && !todayMap[m.name]?.clock_out);

  return (
    <>
      {popup && (
        <ClockModal type={popup} members={members} todayMap={todayMap}
          onConfirm={handleConfirm} onClose={() => setPopup(null)} />
      )}
      <div style={{ padding:'8px', borderBottom:'1px solid rgba(0,0,0,0.1)' }}>
        <div style={{ background:'#fff', borderRadius:8, border:'1px solid rgba(0,0,0,0.08)', padding:'10px 10px 8px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#888', textAlign:'center', marginBottom:8 }}>
            {dateLabel()}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:6 }}>
            <button
              onClick={() => setPopup('in')}
              disabled={saving || allIn}
              style={{ height:32, border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor: allIn ? 'default' : 'pointer',
                background: allIn ? '#f5f5f5' : '#2E7D32', color: allIn ? '#aaa' : '#fff' }}>
              {allIn ? '✅ 출근' : '출근'}
            </button>
            <button
              onClick={() => setPopup('out')}
              disabled={saving || !canOut}
              style={{ height:32, border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor: !canOut ? 'default' : 'pointer',
                background: !canOut ? '#f5f5f5' : '#C62828', color: !canOut ? '#aaa' : '#fff' }}>
              {anyOut && !canOut ? '✅ 퇴근' : '퇴근'}
            </button>
          </div>
          {/* 근무자별 현황 */}
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {members.map(m => {
              const rec = todayMap[m.name];
              return (
                <div key={m.name} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, fontFamily:'var(--mono)' }}>
                  <span style={{ fontWeight:700, color:'#666', minWidth:40 }}>{m.display_name || m.name}</span>
                  {rec?.clock_in  && <span style={{ color:'#2E7D32', fontWeight:700 }}>↑{fmt(rec.clock_in)}</span>}
                  {rec?.clock_out && <span style={{ color:'var(--accent)', fontWeight:700 }}>↓{fmt(rec.clock_out)}</span>}
                  {!rec && <span style={{ color:'#ccc' }}>미체크</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function Sidebar({ page, setPage, profile, onLogout }) {
  const isAdmin    = profile?.role === 'admin';
  const isHQ       = profile?.job_title === '담당자';
  const isManager  = profile?.job_title === '매니저';
  const canSeeMain = isAdmin || isHQ;
  const [newPlanCount, setNewPlanCount] = useState(0);

  useEffect(() => {
    if (!canSeeMain) return;
    supabase.from('leave_plans').select('id', { count: 'exact' }).eq('status', 'pending')
      .then(({ count }) => setNewPlanCount(count || 0));
  }, [canSeeMain]);
  const [expanded, setExpanded] = useState(() => {
    const parentMap = {
      product_add:  'product_mgmt',
      stock_center: 'stock_mgmt',
      stock_store:  'stock_mgmt',
      stock_safety: 'stock_mgmt',
      incentive:    'manager_mgmt',
      clock_inout:    'attendance',
      leave_plan:     'attendance',
      my_attendance:  'attendance',
      customer_qr:    'customer_reg',
      customer_doc:   'customer_reg',
      my_members:     'customer_reg',
    };
    return parentMap[page] ? [parentMap[page]] : [];
  });

  const toggleExpand = (key) => {
    setExpanded(p => p.includes(key) ? p.filter(k => k!==key) : [...p, key]);
  };

  const isOn = (key) => page === key;
  const parentKey = { product_add:'product_mgmt', incentive:'manager_mgmt' };

  return (
    <div className="sidebar">
      {/* 홈 버튼 */}
      <button
        onClick={() => setPage('home')}
        style={{
          display:'flex', alignItems:'center', gap:10, padding:'0 18px',
          background: page==='home' ? 'rgba(0,0,0,0.08)' : 'transparent',
          border:'none', borderBottom:'1px solid rgba(0,0,0,0.1)',
          cursor:'pointer', width:'100%', textAlign:'left', transition:'background 120ms',
          height:'52px', flexShrink:0,
        }}
        onMouseEnter={e => { if(page!=='home') e.currentTarget.style.background='rgba(0,0,0,0.05)'; }}
        onMouseLeave={e => { if(page!=='home') e.currentTarget.style.background='transparent'; }}
      >
        <span style={{ fontSize:22 }}>🏬</span>
        <div>
          <div style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:700, color:'var(--sidebar-text)', lineHeight:1.2 }}>백화점팀 관리시스템</div>
        </div>
      </button>

      {/* 출퇴근 카드 (매니저 전용) */}
      {isManager && <SidebarClockPanel profile={profile}/>}

      <div className="sidebar-menu">
        {/* 본사 메뉴 */}
        {canSeeMain && (
          <>
            <div className="sidebar-section">본사</div>
            {HQ_MENUS.map(m => {
              const hasSub = m.sub && m.sub.length > 0;
              const isOpen = expanded.includes(m.key);
              const isActive = isOn(m.key) || (hasSub && m.sub.some(s => isOn(s.key)));
              return (
                <div key={m.key}>
                  <button
                    className={`sidebar-item ${isActive?'on':''}`}
                    onClick={() => {
                      if (hasSub) toggleExpand(m.key);
                      setPage(m.key);
                    }}>
                    <span className="sidebar-item-icon">{m.icon}</span>
                    {m.label}
                    {m.key==='attendance_mgmt' && newPlanCount > 0 && (
                      <span style={{marginLeft:'auto', background:'var(--danger)', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:9, fontWeight:700}}>NEW</span>
                    )}
                    {hasSub && <span className={`sidebar-chevron ${isOpen?'open':''}`}>▼</span>}
                  </button>
                  {hasSub && isOpen && m.sub.map(s => (
                    <button key={s.key} className={`sidebar-sub ${isOn(s.key)?'on':''}`} onClick={() => setPage(s.key)}>
                      <span className="sidebar-sub-icon">{s.icon}</span>{s.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </>
        )}
        {/* 매장 메뉴 */}
        {(isManager || isAdmin || isHQ) && (
          <>
            <div className="sidebar-section" style={{marginTop: canSeeMain ? 8 : 0}}>매장</div>
            {MANAGER_MENUS.map(m => {
              const hasSub = m.sub && m.sub.length > 0;
              const isOpen = expanded.includes(m.key);
              const isActive = page===m.key || (hasSub && m.sub.some(s => page===s.key));
              return (
                <div key={m.key}>
                  <button className={`sidebar-item ${isActive?'on':''}`}
                    onClick={() => { if(hasSub) toggleExpand(m.key); else setPage(m.key); }}>
                    <span className="sidebar-item-icon">{m.icon}</span>
                    {m.label}
                    {hasSub && <span className={`sidebar-chevron ${isOpen?'open':''}`}>▼</span>}
                  </button>
                  {hasSub && isOpen && m.sub.map(s => (
                    <button key={s.key} className={`sidebar-sub ${page===s.key?'on':''}`} onClick={() => setPage(s.key)}>
                      <span className="sidebar-sub-icon">{s.icon}</span>{s.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </>
        )}
        {/* 관리자 메뉴 */}
        {(isAdmin || isHQ) && (
          <>
            <div className="sidebar-section" style={{marginTop:8}}>관리자</div>
            {isAdmin && ADMIN_MENUS.map(m => (
              <button key={m.key} className={`sidebar-item ${page===m.key?'on':''}`} onClick={() => setPage(m.key)}>
                <span className="sidebar-item-icon">{m.icon}</span>{m.label}
              </button>
            ))}
            {!isAdmin && (
              <button className={`sidebar-item ${page==='admin'?'on':''}`} onClick={() => setPage('admin')}>
                <span className="sidebar-item-icon">🔐</span>사용자 관리
              </button>
            )}
          </>
        )}
        {/* 공지사항 - 담당자/매니저 열람 */}
        {(isHQ || isManager) && (
          <>
            <div className="sidebar-section" style={{marginTop:8}}>공지</div>
            <button className={`sidebar-item ${page==='notice'?'on':''}`} onClick={() => setPage('notice')}>
              <span className="sidebar-item-icon">📢</span>공지 사항
            </button>
          </>
        )}
        {!canSeeMain && !isManager && !isAdmin && (
          <div style={{ padding:'12px 10px', fontSize:12, color:'rgba(0,0,0,0.5)', lineHeight:1.7 }}>
            접근 가능한 메뉴가 없습니다.
          </div>
        )}
      </div>
      <div className="sidebar-bottom">
        <button className={`sidebar-item ${page==='help'?'on':''}`} onClick={() => setPage('help')}
          style={{marginBottom:6, width:'100%'}}>
          <span className="sidebar-item-icon">❓</span>사용 안내
        </button>
        <div className="sidebar-user">
          {isAdmin && <span className="admin-badge" style={{marginRight:6}}>ADMIN</span>}
          {profile?.name && <strong style={{marginRight:4}}>{profile.name}</strong>}
          {profile?.email}
        </div>
        <button className="sidebar-logout" onClick={onLogout}>
          <span>🚪</span> 로그아웃
        </button>
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
      name: name.trim(), phone, birthday: birthday || null,
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
  const defaultTab = isManager ? 'manager' : isHQ ? 'hq' : 'admin';
  const [tab, setTab] = useState(defaultTab);

  // ── 공통 스타일 ──
  const mockWrap = { border:'1px solid #ddd', borderRadius:8, overflow:'hidden', marginBottom:8, boxShadow:'0 2px 8px rgba(0,0,0,0.07)', fontSize:11 };
  const mockHead = { background:'#f5f5f5', borderBottom:'1px solid #ddd', padding:'6px 10px', fontWeight:700, fontSize:11, color:'#555', display:'flex', alignItems:'center', gap:6 };
  const mockBody = { background:'#fff', padding:'10px' };
  const mockTh   = { background:'#f8f8f8', padding:'5px 8px', fontSize:10, fontWeight:600, color:'#888', borderBottom:'1px solid #eee', whiteSpace:'nowrap' };
  const mockTd   = { padding:'6px 8px', fontSize:11, borderBottom:'1px solid #f0f0f0', whiteSpace:'nowrap' };
  const bdg      = (txt, bg='#fff3e0', col='#E65100') => <span style={{background:bg,color:col,border:`1px solid ${col}33`,borderRadius:3,padding:'1px 6px',fontSize:10,fontWeight:600}}>{txt}</span>;
  const suc      = { color:'#2e7d32', fontWeight:700 };
  const dan      = { color:'#c62828', fontWeight:700 };

  // ── 섹션 래퍼 ──
  const Sec = ({ icon, title, desc, children }) => (
    <div style={{marginBottom:12, background:'#fff', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'11px 16px', background:'#FFF9C4', color:'#5d4a00'}}>
        <span style={{fontSize:17}}>{icon}</span>
        <span style={{fontSize:13, fontWeight:700, letterSpacing:'-0.2px'}}>{title}</span>
      </div>
      <div style={{padding:'14px 16px'}}>
        {desc && <div style={{fontSize:12, color:'var(--text2)', marginBottom:12, lineHeight:1.7, background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:6, padding:'8px 12px'}}>{desc}</div>}
        {children}
      </div>
    </div>
  );

  return (
    <div>
      <div className="tabs" style={{marginBottom:20}}>
        {(isAdmin||isHQ) && <button className={`tab ${tab==='admin'?'on':''}`} onClick={()=>setTab('admin')}>🔐 관리자</button>}
        {(isAdmin||isHQ) && <button className={`tab ${tab==='hq'?'on':''}`} onClick={()=>setTab('hq')}>🏢 담당자</button>}
        <button className={`tab ${tab==='manager'?'on':''}`} onClick={()=>setTab('manager')}>👔 매니저</button>
      </div>

      {/* ════ 관리자 ════ */}
      {tab==='admin' && <div style={{display:'flex',flexDirection:'column',gap:12}}>

        <Sec icon="👥" title="사용자 관리"
          desc="신규 가입 요청이 들어오면 승인하고 권한을 설정합니다.">
          <div style={mockWrap}>
            <div style={mockHead}>👥 사용자 관리</div>
            <div style={mockBody}>
              <div style={{background:'#fff3e0',border:'1px solid #ffcc80',borderRadius:6,padding:'6px 10px',marginBottom:8,fontSize:11,color:'#6d4c41'}}>⏳ 승인 대기 (2명)</div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th style={mockTh}>이름</th><th style={mockTh}>직책</th><th style={mockTh}>점포</th><th style={mockTh}>이메일</th><th style={mockTh}>처리</th></tr></thead>
                <tbody>
                  <tr><td style={mockTd}><b>김지영</b></td><td style={mockTd}>{bdg('매니저','#e3f2fd','#1565C0')}</td><td style={mockTd}>롯데백화점 건대점</td><td style={mockTd}>kim@kbh.kr</td><td style={mockTd}><span style={{background:'#e8f5e9',color:'#2e7d32',border:'1px solid #a5d6a7',borderRadius:4,padding:'2px 8px',fontSize:10,fontWeight:600}}>✓ 승인</span></td></tr>
                  <tr><td style={mockTd}><b>박수진</b></td><td style={mockTd}>{bdg('매니저','#e3f2fd','#1565C0')}</td><td style={mockTd}>갤러리아 진주점</td><td style={mockTd}>park@kbh.kr</td><td style={mockTd}><span style={{background:'#e8f5e9',color:'#2e7d32',border:'1px solid #a5d6a7',borderRadius:4,padding:'2px 8px',fontSize:10,fontWeight:600}}>✓ 승인</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>① 승인 대기 목록에서 <b>✓ 승인</b> 클릭 → 즉시 로그인 가능 &nbsp;|&nbsp; ② '관리자로' 버튼으로 관리자 권한 부여 가능</div>
        </Sec>

        <Sec icon="📢" title="공지사항 작성"
          desc="담당자·매니저 전원에게 공지를 작성합니다.">
          <div style={mockWrap}>
            <div style={mockHead}>📢 공지사항</div>
            <div style={mockBody}>
              <div style={{background:'#fff3e0',border:'1px solid #ffcc80',borderRadius:6,padding:'8px 12px',marginBottom:8}}>
                <div style={{fontSize:11,fontWeight:700,marginBottom:4}}>3월 판매 목표 공지</div>
                <div style={{fontSize:10,color:'#888'}}>관리자 · 2026-03-20</div>
              </div>
              <div style={{background:'#f8f8f8',border:'1px solid #eee',borderRadius:6,padding:'8px 12px'}}>
                <div style={{fontSize:11,fontWeight:700,marginBottom:4}}>팔레오 신상품 입고 안내</div>
                <div style={{fontSize:10,color:'#888'}}>관리자 · 2026-03-15</div>
              </div>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>① <b>+ 공지사항 작성</b> 버튼 클릭 → 제목·내용 입력 → <b>등록</b> &nbsp;|&nbsp; ② 작성 즉시 전 직원에게 노출</div>
        </Sec>

        <Sec icon="👔" title="매니저관리 & QR 코드 발급"
          desc="매니저별 고유 QR을 발급해 카운터에 비치합니다.">
          <div style={mockWrap}>
            <div style={mockHead}>👔 매니저 현황</div>
            <div style={mockBody}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th style={mockTh}>이름</th><th style={mockTh}>점포</th><th style={mockTh}>지점</th><th style={mockTh}>QR</th><th style={mockTh}>수정</th></tr></thead>
                <tbody>
                  <tr><td style={mockTd}><b>홍길동</b></td><td style={mockTd}>{bdg('롯데백화점')}</td><td style={mockTd}>{bdg('건대점','#e3f2fd','#1565C0')}</td><td style={mockTd}><span style={{background:'#f3e5f5',color:'#6a1b9a',border:'1px solid #ce93d8',borderRadius:4,padding:'2px 8px',fontSize:10,fontWeight:600}}>📱 QR</span></td><td style={mockTd}><span style={{background:'#f8f8f8',border:'1px solid #ddd',borderRadius:4,padding:'2px 8px',fontSize:10}}>수정</span></td></tr>
                  <tr><td style={mockTd}><b>김지영</b></td><td style={mockTd}>{bdg('갤러리아')}</td><td style={mockTd}>{bdg('진주점','#e3f2fd','#1565C0')}</td><td style={mockTd}><span style={{background:'#f3e5f5',color:'#6a1b9a',border:'1px solid #ce93d8',borderRadius:4,padding:'2px 8px',fontSize:10,fontWeight:600}}>📱 QR</span></td><td style={mockTd}><span style={{background:'#f8f8f8',border:'1px solid #ddd',borderRadius:4,padding:'2px 8px',fontSize:10}}>수정</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>① <b>📱 QR</b> 버튼 클릭 → QR 이미지 팝업 → <b>인쇄</b> 출력 후 카운터 비치 &nbsp;|&nbsp; ② 고객이 스캔하면 해당 매니저와 자동 연결</div>
        </Sec>

      </div>}

      {/* ════ 담당자 ════ */}
      {tab==='hq' && <div style={{display:'flex',flexDirection:'column',gap:12}}>

        <Sec icon="🏠" title="홈 대시보드"
          desc="로그인 시 첫 화면. 당월 누적 매출을 한눈에 확인합니다.">
          <div style={mockWrap}>
            <div style={mockHead}>🏠 2026년 03월 대시보드 <span style={{marginLeft:'auto',fontSize:10,color:'#aaa'}}>03/01 ~ 03/24 (어제까지)</span></div>
            <div style={mockBody}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                {[['총 매출금액','136,320,000원','#E65100'],['판매 건수','2,864건','#333'],['판매 수량','28,294개','#333'],['활동 점포','23개','#333']].map(([l,v,c])=>(
                  <div key={l} style={{border:'1px solid #eee',borderRadius:6,padding:'8px 10px'}}>
                    <div style={{fontSize:9,color:'#aaa',marginBottom:4}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                  </div>
                ))}
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th style={mockTh}>#</th><th style={mockTh}>점포</th><th style={mockTh}>지점</th><th style={mockTh}>매출금액</th><th style={mockTh}>비중</th></tr></thead>
                <tbody>
                  <tr><td style={mockTd}>1</td><td style={mockTd}>{bdg('갤러리아')}</td><td style={mockTd}>{bdg('진주점','#e3f2fd','#1565C0')}</td><td style={{...mockTd,color:'#E65100',fontWeight:700}}>25,400,000</td><td style={mockTd}><div style={{background:'#eee',height:5,borderRadius:3,width:80}}><div style={{background:'#E65100',height:'100%',width:'82%',borderRadius:3}}/></div></td></tr>
                  <tr><td style={mockTd}>2</td><td style={mockTd}>{bdg('롯데백화점')}</td><td style={mockTd}>{bdg('건대점','#e3f2fd','#1565C0')}</td><td style={{...mockTd,color:'#E65100',fontWeight:700}}>22,100,000</td><td style={mockTd}><div style={{background:'#eee',height:5,borderRadius:3,width:80}}><div style={{background:'#E65100',height:'100%',width:'71%',borderRadius:3}}/></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>점포/지점별 매출 순위와 비중(%)을 막대로 확인 &nbsp;|&nbsp; 사이드바 상단 🏬 클릭으로 언제든 돌아올 수 있음</div>
        </Sec>

        <Sec icon="🛡️" title="안전재고 확인"
          desc="최근 1달 판매수량 기준으로 부족 재고를 파악하고 발주요청합니다.">
          <div style={mockWrap}>
            <div style={mockHead}>🛡️ 안전재고 확인</div>
            <div style={mockBody}>
              <div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:6,padding:'6px 10px',marginBottom:8,fontSize:11,color:'#78350f'}}>⚠️ 재고 부족 항목 <b>14개</b> — 안전재고 미달</div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th style={mockTh}>점포</th><th style={mockTh}>상품명</th><th style={mockTh}>안전재고</th><th style={mockTh}>현재재고</th><th style={mockTh}>부족수량</th><th style={mockTh}>발주</th></tr></thead>
                <tbody>
                  <tr style={{background:'#fff9f9'}}><td style={mockTd}>{bdg('건대점','#e3f2fd','#1565C0')}</td><td style={{...mockTd,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis'}}>팔레오_탱글탱글석류콜라겐젤리</td><td style={{...mockTd,...suc}}>100</td><td style={mockTd}>62</td><td style={{...mockTd,...dan}}>▼ 38</td><td style={mockTd}><span style={{background:'#E65100',color:'#fff',borderRadius:4,padding:'2px 8px',fontSize:10,fontWeight:600}}>발주요청</span></td></tr>
                  <tr><td style={mockTd}>{bdg('진주점','#e3f2fd','#1565C0')}</td><td style={mockTd}>팔레오_닥터스노트 생생활력</td><td style={{...mockTd,...suc}}>45</td><td style={mockTd}>51</td><td style={{...mockTd,color:'#2e7d32',fontWeight:700}}>+6</td><td style={mockTd}></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>빨간 행 = 부족 &nbsp;|&nbsp; <b>발주요청</b> 클릭 시 저장되며 '요청중'으로 표시 &nbsp;|&nbsp; 우측 상단 '부족 항목만 보기'로 필터 가능</div>
        </Sec>

        <Sec icon="👥" title="회원(고객)관리"
          desc="전체 회원을 테이블로 조회하고 구매이력을 확인합니다.">
          <div style={mockWrap}>
            <div style={mockHead}>👥 회원(고객)관리 <span style={{marginLeft:'auto',fontSize:10,color:'#aaa'}}>총 247명 · SMS동의 183명</span></div>
            <div style={mockBody}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th style={mockTh}>가입일</th><th style={mockTh}>이름</th><th style={mockTh}>연락처</th><th style={mockTh}>생일</th><th style={mockTh}>점포</th><th style={mockTh}>담당매니저</th><th style={mockTh}>마케팅동의</th><th style={mockTh}>문자</th></tr></thead>
                <tbody>
                  <tr><td style={mockTd}>2026-03-22</td><td style={mockTd}><b>조해숙</b></td><td style={mockTd}>010-3554-2100</td><td style={mockTd}>1975-06-15</td><td style={mockTd}>{bdg('건대점','#e3f2fd','#1565C0')}</td><td style={{...mockTd,color:'#E65100',fontWeight:600}}>홍길동</td><td style={{...mockTd,...suc}}>✅ 동의</td><td style={mockTd}><span style={{background:'#f3e5f5',color:'#6a1b9a',border:'1px solid #ce93d8',borderRadius:4,padding:'2px 6px',fontSize:10}}>📱 문자</span></td></tr>
                  <tr><td style={mockTd}>2026-03-20</td><td style={mockTd}><b>정수아</b></td><td style={mockTd}>010-3498-3750</td><td style={mockTd}>-</td><td style={mockTd}>{bdg('진주점','#e3f2fd','#1565C0')}</td><td style={{...mockTd,color:'#E65100',fontWeight:600}}>김지영</td><td style={{...mockTd,color:'#aaa'}}>미동의</td><td style={mockTd}><span style={{opacity:0.3,background:'#f3e5f5',color:'#6a1b9a',border:'1px solid #ce93d8',borderRadius:4,padding:'2px 6px',fontSize:10}}>📱 문자</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>조건 없이 <b>조회</b> 클릭 → 전체 회원 목록 &nbsp;|&nbsp; 행 클릭 시 하단에 구매이력 펼침 &nbsp;|&nbsp; SMS 동의 회원만 📱 문자 버튼 활성</div>
        </Sec>

        <Sec icon="💰" title="인센티브 조회"
          desc="매니저가 가입시킨 회원들의 구매 실적을 매니저별로 집계합니다.">
          <div style={mockWrap}>
            <div style={mockHead}>💰 인센티브 조회 <span style={{marginLeft:'auto',fontSize:10,color:'#aaa'}}>2026-03-01 ~ 2026-03-24</span></div>
            <div style={mockBody}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th style={mockTh}>담당 매니저</th><th style={mockTh}>가입 회원수</th><th style={mockTh}>총 구매횟수</th><th style={mockTh}>총 결제금액</th><th style={mockTh}></th></tr></thead>
                <tbody>
                  <tr><td style={mockTd}><b>👤 홍길동</b></td><td style={mockTd}>23명</td><td style={mockTd}>87회</td><td style={{...mockTd,color:'#E65100',fontWeight:700,fontSize:13}}>4,320,000원</td><td style={mockTd}><span style={{background:'#f8f8f8',border:'1px solid #ddd',borderRadius:4,padding:'2px 8px',fontSize:10}}>▼ 상세</span></td></tr>
                  <tr><td style={mockTd}><b>👤 김지영</b></td><td style={mockTd}>18명</td><td style={mockTd}>64회</td><td style={{...mockTd,color:'#E65100',fontWeight:700,fontSize:13}}>3,150,000원</td><td style={mockTd}><span style={{background:'#f8f8f8',border:'1px solid #ddd',borderRadius:4,padding:'2px 8px',fontSize:10}}>▼ 상세</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>날짜 선택 후 <b>조회</b> &nbsp;|&nbsp; <b>▼ 상세</b> 클릭 시 회원별·구매건별 내역 펼침 &nbsp;|&nbsp; 담당 매니저 이름 기준으로 자동 집계</div>
        </Sec>

        <Sec icon="📋" title="매출조회"
          desc="날짜·점포·브랜드 필터로 판매 내역을 조회합니다.">
          <div style={mockWrap}>
            <div style={mockHead}>📋 매출조회</div>
            <div style={mockBody}>
              <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
                <select style={{height:28,padding:'0 8px',border:'1px solid #ddd',borderRadius:4,fontSize:11}} disabled><option>전체 점포</option></select>
                <select style={{height:28,padding:'0 8px',border:'1px solid #ddd',borderRadius:4,fontSize:11}} disabled><option>팔레오</option></select>
                <input type="date" style={{height:28,padding:'0 8px',border:'1px solid #ddd',borderRadius:4,fontSize:11}} defaultValue="2026-03-01" readOnly/>
                <span style={{lineHeight:'28px',fontSize:11}}>~</span>
                <input type="date" style={{height:28,padding:'0 8px',border:'1px solid #ddd',borderRadius:4,fontSize:11}} defaultValue="2026-03-24" readOnly/>
                <span style={{fontSize:11,color:'#888',lineHeight:'28px',marginLeft:4}}><b>2,864</b>건 · <b>136,320,000</b>원</span>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th style={mockTh}>판매일</th><th style={mockTh}>점포</th><th style={mockTh}>매니저</th><th style={mockTh}>상품명</th><th style={mockTh}>수량</th><th style={mockTh}>합계</th><th style={mockTh}>결제</th></tr></thead>
                <tbody>
                  <tr><td style={mockTd}>2026-03-24</td><td style={mockTd}>{bdg('건대점','#e3f2fd','#1565C0')}</td><td style={mockTd}>홍길동</td><td style={mockTd}>팔레오_탱글탱글젤리</td><td style={mockTd}>3</td><td style={{...mockTd,color:'#E65100',fontWeight:700}}>120,000</td><td style={mockTd}>{bdg('카드','#e8f5e9','#2e7d32')}</td></tr>
                  <tr><td style={mockTd}>2026-03-24</td><td style={mockTd}>{bdg('진주점','#e3f2fd','#1565C0')}</td><td style={mockTd}>김지영</td><td style={mockTd}>팔레오_닥터스노트</td><td style={mockTd}>2</td><td style={{...mockTd,color:'#E65100',fontWeight:700}}>100,000</td><td style={mockTd}>{bdg('현금','#f3e5f5','#6a1b9a')}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>필터 조합 후 자동 조회 &nbsp;|&nbsp; 상단 요약에서 총 건수·금액 즉시 확인</div>
        </Sec>

      </div>}

      {/* ════ 매니저 ════ */}
      {tab==='manager' && <div style={{display:'flex',flexDirection:'column',gap:12}}>

        <Sec icon="🛒" title="판매 입력"
          desc="매일 판매한 상품을 기록합니다. 회원 적립도 함께 처리합니다.">
          <div style={mockWrap}>
            <div style={mockHead}>🛒 판매 입력 <span style={{marginLeft:8,fontSize:10,color:'#aaa'}}>📍 롯데백화점 · 건대스타시티점</span></div>
            <div style={mockBody}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:8}}>
                {[['판매날짜','2026-03-24'],['브랜드','팔레오'],['상품','팔레오_탱글탱글석류콜라겐젤리']].map(([l,v])=>(
                  <div key={l}><div style={{fontSize:9,color:'#aaa',marginBottom:3}}>{l}</div><div style={{border:'1px solid #ddd',borderRadius:4,padding:'5px 8px',fontSize:11,background:'#f8f8f8'}}>{v}</div></div>
                ))}
                {[['수량','3'],['판매가','40,000'],['결제수단','']].map(([l,v])=>(
                  <div key={l}><div style={{fontSize:9,color:'#aaa',marginBottom:3}}>{l}</div>
                    {l==='결제수단'
                      ? <div style={{display:'flex',gap:4}}>{['카드','현금','기타'].map((p,i)=><span key={p} style={{flex:1,textAlign:'center',padding:'4px 0',border:'1px solid',borderRadius:4,fontSize:10,fontWeight:600, borderColor:i===0?'#E65100':'#ddd',background:i===0?'#fff3e0':'#f8f8f8',color:i===0?'#E65100':'#888'}}>{p}</span>)}</div>
                      : <div style={{border:'1px solid #ddd',borderRadius:4,padding:'5px 8px',fontSize:11,background:'#f8f8f8'}}>{v}</div>
                    }
                  </div>
                ))}
              </div>
              <div style={{background:'#f8f8f8',border:'1px solid #ddd',borderRadius:6,padding:'8px 10px',marginBottom:6}}>
                <div style={{fontSize:10,fontWeight:700,marginBottom:6}}>🙋 회원 연결</div>
                <div style={{display:'flex',gap:6}}>
                  {['없음','기존 회원 검색','신규 회원등록'].map((t,i)=><span key={t} style={{padding:'4px 10px',border:'1px solid',borderRadius:4,fontSize:10,fontWeight:600, borderColor:i===1?'#E65100':'#ddd',background:i===1?'#fff3e0':'#f8f8f8',color:i===1?'#E65100':'#888'}}>{t}</span>)}
                </div>
              </div>
              <div style={{background:'#e8f5e9',border:'1px solid #a5d6a7',borderRadius:4,padding:'5px 10px',fontSize:11,color:'#2e7d32',fontWeight:600}}>✅ 조해숙 (010-3554-2100)</div>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>
            브랜드→상품 순서로 선택하면 기본 판매가 자동 입력 &nbsp;|&nbsp;
            <b>기존 회원 검색</b>: 이름·연락처 입력 후 선택 → 해당 회원 구매이력에 기록 &nbsp;|&nbsp;
            <b>신규 회원등록</b>: 가입과 판매를 한 번에 처리
          </div>
        </Sec>

        <Sec icon="👤" title="회원 등록"
          desc="구매 없이 회원가입만 하는 경우 이 메뉴를 사용합니다.">
          <div style={mockWrap}>
            <div style={mockHead}>👤 회원 등록 <span style={{marginLeft:8,fontSize:10,color:'#aaa'}}>📍 롯데백화점 · 건대스타시티점</span></div>
            <div style={mockBody}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:8}}>
                {[['회원가입일','2026-03-24'],['고객 이름','홍길순'],['연락처','010-1234-5678'],['생일 (선택)','1982-09-03'],['담당 매니저','홍길동'],['','']].map(([l,v],i)=> l ? (
                  <div key={i}><div style={{fontSize:9,color:'#aaa',marginBottom:3}}>{l}</div><div style={{border:'1px solid #ddd',borderRadius:4,padding:'5px 8px',fontSize:11,background:'#f8f8f8'}}>{v||'-'}</div></div>
                ) : <div key={i}/>)}
              </div>
              <div style={{background:'#f8f8f8',border:'1px solid #ddd',borderRadius:6,padding:'8px 10px',marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:700,marginBottom:4}}>📱 광고성 문자 수신 동의</div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:14,height:14,background:'#E65100',borderRadius:3,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:'#fff',fontSize:9}}>✓</span></div>
                  <span style={{fontSize:11,color:'#E65100',fontWeight:600}}>광고성 정보 문자 수신에 동의합니다 (선택)</span>
                </div>
              </div>
              <div style={{background:'#E65100',color:'#fff',borderRadius:6,padding:'8px',textAlign:'center',fontSize:12,fontWeight:700}}>✓ 회원 정보 저장</div>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>
            연락처는 숫자만 입력해도 010-XXXX-XXXX 형식으로 자동 변환 &nbsp;|&nbsp;
            SMS 동의: 고객에게 직접 확인 후 체크 &nbsp;|&nbsp;
            생일 입력 시 추후 생일 혜택 문자 발송에 활용
          </div>
          <div style={{background:'#fff3cd',border:'1px solid #ffc107',borderRadius:'var(--radius)',padding:'12px 14px',marginTop:12}}>
            <div style={{fontWeight:700,fontSize:12,color:'#856404',marginBottom:6}}>⚠️ 중요사항</div>
            <div style={{fontSize:12,color:'#856404',lineHeight:1.8}}>
              앱에서 매니저가 직접 회원을 등록하는 경우, <b>마케팅 수신 동의 체크는 매니저가 대신 입력</b>하게 됩니다.<br/>
              법적 분쟁을 예방하기 위해 반드시 <b>고객에게 마케팅 수신 동의 서명을 받은 서면 동의서를 별도로 보관</b>하세요.<br/>
              고객이 QR코드로 직접 가입한 경우에는 서면 동의서가 필요하지 않습니다.
            </div>
          </div>
        </Sec>

        <Sec icon="📋" title="내 회원 목록"
          desc="내가 담당하는 회원과 그들의 구매이력을 확인합니다.">
          <div style={mockWrap}>
            <div style={mockHead}>📋 내 회원 목록</div>
            <div style={mockBody}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:8}}>
                {[['총 회원수','23명'],['SMS 동의','18명'],['미동의','5명']].map(([l,v])=>(
                  <div key={l} style={{border:'1px solid #eee',borderRadius:6,padding:'8px',textAlign:'center'}}>
                    <div style={{fontSize:9,color:'#aaa',marginBottom:4}}>{l}</div>
                    <div style={{fontSize:16,fontWeight:700,color:'#E65100'}}>{v}</div>
                  </div>
                ))}
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th style={mockTh}>가입일</th><th style={mockTh}>이름</th><th style={mockTh}>연락처</th><th style={mockTh}>SMS</th></tr></thead>
                <tbody>
                  <tr style={{background:'#fff8e1',border:'1px solid #ffcc80',borderRadius:4}}><td style={mockTd}>2026-03-22</td><td style={mockTd}><b>조해숙</b></td><td style={mockTd}>010-3554-2100</td><td style={{...mockTd,...suc}}>✅</td></tr>
                  <tr><td style={mockTd}>2026-03-18</td><td style={mockTd}><b>김민수</b></td><td style={mockTd}>010-2233-4455</td><td style={{...mockTd,color:'#aaa'}}>-</td></tr>
                </tbody>
              </table>
              <div style={{marginTop:8,background:'#f8f8f8',border:'1px solid #eee',borderRadius:6,padding:'8px 10px'}}>
                <div style={{fontSize:10,fontWeight:700,marginBottom:4}}>📦 조해숙 구매이력</div>
                <div style={{display:'flex',gap:8}}>
                  {[['구매건수','3건'],['총 금액','370,000원']].map(([l,v])=>(
                    <div key={l} style={{background:'#fff3e0',border:'1px solid #ffcc80',borderRadius:4,padding:'4px 10px',textAlign:'center'}}>
                      <div style={{fontSize:9,color:'#aaa'}}>{l}</div>
                      <div style={{fontSize:12,fontWeight:700,color:'#E65100'}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>
            회원 카드 클릭 → 우측에 구매이력 펼침 &nbsp;|&nbsp; 이름·연락처 검색 가능 &nbsp;|&nbsp; 내 이름으로 담당 등록된 회원만 표시
          </div>
        </Sec>

        <Sec icon="📱" title="내 QR 코드"
          desc="고객이 스캔하면 자동으로 내 담당 회원으로 등록됩니다.">
          <div style={mockWrap}>
            <div style={mockHead}>📱 QR 회원가입 화면 (고객 화면)</div>
            <div style={mockBody}>
              <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
                <div style={{flex:1}}>
                  <div style={{background:'#fff9f0',border:'1px solid #eee',borderRadius:12,padding:'16px',maxWidth:200}}>
                    <div style={{textAlign:'center',marginBottom:12}}>
                      <div style={{fontSize:20,marginBottom:4}}>🏬</div>
                      <div style={{fontSize:13,fontWeight:700}}>회원 등록</div>
                      <div style={{fontSize:10,color:'#aaa'}}>롯데백화점 · 건대스타시티점</div>
                    </div>
                    {[['이름','홍길순'],['연락처','010-1234-5678'],['생일 (선택)','1982-09-03']].map(([l,v])=>(
                      <div key={l} style={{marginBottom:8}}>
                        <div style={{fontSize:10,fontWeight:700,color:'#444',marginBottom:3}}>{l}</div>
                        <div style={{border:'1px solid #e0e0e0',borderRadius:8,padding:'8px 10px',fontSize:12,background:'#f8f8f8'}}>{v}</div>
                      </div>
                    ))}
                    <div style={{background:'#f8f8f8',borderRadius:8,padding:'8px',marginBottom:8}}>
                      <div style={{fontSize:10,fontWeight:700,marginBottom:4}}>📱 광고성 문자 수신 동의</div>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <div style={{width:14,height:14,background:'#E65100',borderRadius:3}}/>
                        <span style={{fontSize:10,color:'#E65100'}}>동의합니다 (선택)</span>
                      </div>
                    </div>
                    <div style={{background:'#E65100',color:'#fff',borderRadius:10,padding:'8px',textAlign:'center',fontSize:12,fontWeight:700}}>✓ 회원 등록 완료</div>
                  </div>
                </div>
                <div style={{fontSize:11,color:'var(--text2)',lineHeight:1.8,flex:1}}>
                  <b>① 사이드바 → 📱 내 QR 코드 클릭</b><br/>
                  인쇄 화면이 열립니다<br/><br/>
                  <b>② QR 출력 후 카운터 비치</b><br/>
                  고객이 스마트폰으로 스캔<br/><br/>
                  <b>③ 고객이 직접 입력</b><br/>
                  이름·연락처·생일·SMS동의<br/><br/>
                  <b>④ 자동으로 내 담당 회원으로 등록</b><br/>
                  인센티브도 자동 귀속
                </div>
              </div>
            </div>
          </div>
        </Sec>

      </div>}
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
    incentive:      '급여 조회',
    member_mgmt:    '고객관리',
    sales_view:     '매출조회',
    sales_input:    '판매 입력',
    customer_input: '회원 등록',
    customer_qr:    'QR 가입',
    customer_doc:   '서류 가입',
    my_members:     '회원 목록',
    stock_request:  '재고 요청',
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
            {page === 'stock_store'    && canSeeMain && <StockMgmtPage/>}
            {page === 'stock_safety'   && canSeeMain && <SafetyCheckPage profile={profile}/>}
            {page === 'manager_mgmt'   && canSeeMain && <ManagerMgmtPage/>}
            {page === 'incentive'      && canSeeMain && <IncentivePage/>}
            {page === 'member_mgmt'    && canSeeMain && <CustomerLookupPage profile={profile}/>}
            {page === 'sales_view'     && canSeeMain && <SalesListPage/>}
            {page === 'sales_input'    && (isManager || isAdmin || isHQ) && <SalesInputPage profile={profile}/>}
            {page === 'customer_input' && (isManager || isAdmin || isHQ) && <CustomerInputPage profile={profile}/>}
            {page === 'customer_qr'    && (isManager || isAdmin || isHQ) && <CustomerQRPage profile={profile}/>}
            {page === 'customer_doc'   && (isManager || isAdmin || isHQ) && <CustomerDocPage profile={profile}/>}
            {page === 'my_members'     && (isManager || isAdmin || isHQ) && <MyMembersPage profile={profile}/>}
            {page === 'stock_request'  && (isManager || isAdmin || isHQ) && <StockRequestPage profile={profile}/>}
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
