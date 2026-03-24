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
  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 13px; line-height: 1.6; -webkit-font-smoothing: antialiased; }

  /* ── AUTH ── */
  .auth-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f8f8; }
  .auth-box { width: 380px; background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 36px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .auth-logo { text-align: center; margin-bottom: 6px; }
  .auth-logo-icon { font-size: 36px; }
  .auth-logo-text { font-family: var(--mono); font-size: 18px; font-weight: 700; color: var(--sidebar-active); letter-spacing: -0.5px; }
  .auth-sub { text-align: center; font-size: 12px; color: var(--text3); margin-bottom: 28px; }
  .auth-tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 24px; }
  .auth-tab { flex: 1; padding: 8px; background: none; border: none; font-family: var(--sans); font-size: 13px; font-weight: 500; color: var(--text3); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 120ms; }
  .auth-tab.on { color: var(--accent); border-bottom-color: var(--accent); }
  .form-group { margin-bottom: 14px; }
  label { display: block; font-size: 11px; font-weight: 500; color: var(--text2); margin-bottom: 5px; }
  .input { width: 100%; height: 38px; padding: 0 12px; border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--sans); font-size: 13px; background: #fafafa; outline: none; transition: border-color 120ms; }
  .input:focus { border-color: var(--accent); background: #fff; }
  .input::placeholder { color: var(--text3); }
  .btn-auth { width: 100%; height: 40px; background: var(--sidebar); border: none; border-radius: var(--radius); font-family: var(--sans); font-size: 14px; font-weight: 600; color: var(--sidebar-text); cursor: pointer; transition: background 120ms; margin-top: 4px; }
  .btn-auth:hover { background: var(--sidebar-hover); }
  .btn-auth:disabled { opacity: 0.5; cursor: not-allowed; }
  .auth-msg { text-align: center; font-size: 12px; margin-top: 12px; padding: 10px; border-radius: var(--radius); }
  .auth-msg.err { background: #fdecea; color: var(--danger); }
  .auth-msg.ok  { background: #e8f5e9; color: var(--success); }

  /* ── PENDING ── */
  .pending-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f8f8; }
  .pending-box { text-align: center; background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 48px 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); max-width: 400px; }
  .pending-icon { font-size: 48px; margin-bottom: 16px; }
  .pending-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
  .pending-desc { font-size: 13px; color: var(--text2); line-height: 1.8; margin-bottom: 20px; }
  .btn-logout-sm { padding: 7px 16px; border: 1px solid var(--border2); border-radius: var(--radius); background: transparent; font-family: var(--sans); font-size: 12px; color: var(--text2); cursor: pointer; }
  .btn-logout-sm:hover { background: var(--bg3); }

  /* ── APP LAYOUT ── */
  .app-layout { display: flex; min-height: 100vh; }

  /* ── SIDEBAR ── */
  .sidebar { width: var(--sidebar-w); background: var(--sidebar); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
  .sidebar-logo { padding: 20px 18px 16px; border-bottom: 1px solid rgba(0,0,0,0.1); }
  .sidebar-logo-icon { font-size: 22px; }
  .sidebar-logo-text { font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--sidebar-text); letter-spacing: -0.3px; margin-top: 2px; }
  .sidebar-logo-sub { font-size: 10px; color: rgba(0,0,0,0.65); margin-top: 1px; }
  .sidebar-section { padding: 12px 10px 4px; font-size: 9px; font-weight: 700; color: rgba(0,0,0,0.6); letter-spacing: 2px; text-transform: uppercase; }
  .sidebar-menu { flex: 1; padding: 6px 8px; overflow-y: auto; }
  .sidebar-item { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 6px; cursor: pointer; transition: background 120ms; margin-bottom: 2px; font-size: 13px; font-weight: 600; color: #1a1a1a; border: none; background: none; width: 100%; text-align: left; }
  .sidebar-item:hover { background: rgba(0,0,0,0.12); }
  .sidebar-item.on { background: rgba(0,0,0,0.18); font-weight: 700; }
  .sidebar-item-icon { font-size: 15px; flex-shrink: 0; }
  .sidebar-bottom { padding: 12px 8px; border-top: 1px solid rgba(0,0,0,0.15); }
  .sidebar-user { padding: 8px 10px; font-size: 11px; color: rgba(0,0,0,0.7); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sidebar-logout { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; color: rgba(0,0,0,0.7); background: none; border: none; width: 100%; transition: background 120ms; }
  .sidebar-logout:hover { background: rgba(0,0,0,0.12); }

  /* ── CONTENT ── */
  .content { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
  .content-header { background: #fff; border-bottom: 1px solid var(--border); padding: 0 28px; height: 52px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
  .content-title { font-size: 15px; font-weight: 600; color: var(--text); }
  .content-body { padding: 24px 28px; flex: 1; }

  /* ── ADMIN ── */
  .admin-badge { display: inline-flex; padding: 2px 8px; background: #fff3e0; border: 1px solid #ffcc80; border-radius: 4px; font-size: 10px; font-weight: 600; color: var(--accent); font-family: var(--mono); }
  .user-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .user-table th { background: var(--bg3); padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; color: var(--text2); border-bottom: 1px solid var(--border); }
  .user-table td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  .user-table tr:hover td { background: #fafafa; }
  .user-table tr:last-child td { border-bottom: none; }
  .status-badge { display: inline-flex; padding: 2px 9px; border-radius: 99px; font-size: 11px; font-weight: 500; }
  .status-ok  { background: #e8f5e9; color: var(--success); }
  .status-wait { background: #fff8e1; color: #E65100; }

  /* ── CARDS ── */
  .card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 16px; }
  .card-label { font-size: 12px; font-weight: 700; color: #333333; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
  .card-label::before { content: ''; display: block; width: 3px; height: 12px; background: var(--sidebar); border-radius: 2px; }

  /* ── DROP ZONE ── */
  .drop { border: 2px dashed var(--border2); border-radius: var(--radius); padding: 44px 24px; text-align: center; cursor: pointer; background: #fafafa; position: relative; transition: all 140ms ease; }
  .drop:hover, .drop.over { border-color: var(--accent); background: #fff8e1; }
  .drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .drop-icon { font-size: 28px; margin-bottom: 8px; }
  .drop-main { font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
  .drop-main strong { color: var(--accent); }
  .drop-sub { font-size: 12px; color: #444444; font-family: var(--mono); }
  .drop-filename { display: inline-flex; align-items: center; gap: 8px; background: #fff3e0; border: 1px solid #ffcc80; color: var(--accent); font-family: var(--mono); font-size: 12px; padding: 5px 14px; border-radius: var(--radius); margin-top: 10px; }

  /* ── STATS ── */
  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
  @media (max-width: 900px) { .stats { grid-template-columns: repeat(3, 1fr); } }
  .stat { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
  .stat-l { font-size: 9px; font-weight: 600; color: var(--text3); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }
  .stat-v { font-family: var(--mono); font-size: 22px; font-weight: 700; color: var(--accent); line-height: 1; }
  .stat-u { font-size: 10px; color: var(--text3); margin-top: 4px; }

  /* ── TABS ── */
  .tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 16px; }
  .tab { padding: 9px 20px; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: var(--sans); font-size: 13px; font-weight: 500; color: var(--text3); cursor: pointer; transition: all 120ms; }
  .tab.on { color: var(--accent); border-bottom-color: var(--accent); }
  .tab:hover:not(.on) { color: var(--text2); }

  /* ── FILTER ── */
  .fbar { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
  .fsel, .finput { height: 32px; padding: 0 10px; border-radius: var(--radius); border: 1px solid var(--border); background: #fff; color: var(--text); font-family: var(--sans); font-size: 12px; outline: none; transition: border-color 120ms; }
  .fsel:focus, .finput:focus { border-color: var(--accent); }
  .finput { min-width: 200px; }
  .finput::placeholder { color: var(--text3); }
  .fbar-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .fresult { font-size: 12px; color: var(--text3); font-family: var(--mono); }
  .fresult b { color: var(--accent); }

  /* ── BUTTONS ── */
  .btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: var(--radius); border: 1px solid transparent; font-family: var(--sans); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 120ms ease; white-space: nowrap; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-p { background: var(--sidebar); color: var(--sidebar-text); border-color: var(--sidebar); }
  .btn-p:hover:not(:disabled) { background: var(--sidebar-hover); }
  .btn-s { background: transparent; color: var(--text2); border-color: var(--border2); }
  .btn-s:hover:not(:disabled) { background: var(--bg3); }
  .btn-success { background: #e8f5e9; color: var(--success); border-color: #a5d6a7; }
  .btn-success:hover:not(:disabled) { background: #c8e6c9; }
  .btn-ghost { background: transparent; color: var(--text3); border: none; font-size: 11px; padding: 4px 8px; cursor: pointer; }
  .btn-ghost:hover { color: var(--text2); }

  /* ── TABLE ── */
  .twrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead tr { background: var(--bg3); border-bottom: 1px solid var(--border2); }
  th { font-size: 10px; font-weight: 600; color: var(--text2); letter-spacing: 0.8px; padding: 9px 11px; text-align: left; white-space: nowrap; cursor: pointer; user-select: none; text-transform: uppercase; }
  th:hover { color: var(--text); }
  th.s-a::after { content: ' ↑'; color: var(--accent); }
  th.s-d::after { content: ' ↓'; color: var(--accent); }
  th.r { text-align: right; }
  td { padding: 9px 11px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  td.r { text-align: right; font-family: var(--mono); font-size: 12px; }
  td.mono { font-family: var(--mono); font-size: 11px; color: var(--text2); }
  tr:hover td { background: #fffde7; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-flex; padding: 2px 8px; border-radius: 4px; font-size: 11px; white-space: nowrap; }
  .badge-dept  { background: #fff3e0; color: #E65100; border: 1px solid #ffcc80; }
  .badge-store { background: #e3f2fd; color: #1565C0; border: 1px solid #90caf9; }
  .safety-num { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--accent); }
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
  const [mode, setMode]         = useState('login');
  const [email, setEmail]       = useState('');
  const [pw, setPw]             = useState('');
  const [name, setName]         = useState('');
  const [jobTitle, setJobTitle] = useState('담당자');
  const [department, setDept]   = useState('');   // 점포명 (백화점 그룹)
  const [branch, setBranch]     = useState('');   // 지점명
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState(null);

  const handleJobTitle = (val) => {
    setJobTitle(val);
    setDept('');
    setBranch('');
  };

  const handleDeptChange = (val) => {
    setDept(val);
    setBranch('');
  };

  const resetForm = () => {
    setEmail(''); setPw(''); setName('');
    setJobTitle('담당자'); setDept(''); setBranch('');
    setMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else {
        if (!name.trim()) throw new Error('이름을 입력해주세요');
        if (pw.length < 6) throw new Error('비밀번호는 6자리 이상이어야 합니다');
        if (jobTitle === '매니저') {
          if (!department) throw new Error('점포명을 선택해주세요');
          if (!branch) throw new Error('지점명을 선택해주세요');
        }
        const { data, error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        if (data?.user?.id) {
          await supabase.from('profiles').update({
            name: name.trim(),
            job_title: jobTitle,
            department: jobTitle === '담당자' ? '본사' : department,
            branch: jobTitle === '매니저' ? branch : null,
          }).eq('id', data.user.id);
        }
        setMsg({ text: '회원가입이 완료됐어요. 관리자 승인 후 로그인 가능합니다.', type: 'ok' });
        setMode('login');
        resetForm();
      }
    } catch (err) {
      const ko = err.message
        .replace('Invalid login credentials', '이메일 또는 비밀번호가 틀렸습니다')
        .replace('User already registered', '이미 가입된 이메일입니다')
        .replace('Email not confirmed', '이메일 인증이 필요합니다');
      setMsg({ text: ko, type: 'err' });
    }
    setLoading(false);
  };

  const branchList = department ? (STORE_MAP[department] || []) : [];

  return (
    <div className="auth-wrap">
      <div className="auth-box" style={{ width: mode === 'signup' ? 420 : 380 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">🏬</div>
          <div className="auth-logo-text">재고관리 대시보드</div>
        </div>
        <div className="auth-sub">백화점 매장 판매·재고 관리 시스템</div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'on' : ''}`} onClick={() => { setMode('login'); resetForm(); }}>로그인</button>
          <button className={`auth-tab ${mode === 'signup' ? 'on' : ''}`} onClick={() => { setMode('signup'); resetForm(); }}>회원가입</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              {/* 직책 */}
              <div className="form-group">
                <label>직책</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['담당자', '매니저'].map(t => (
                    <button key={t} type="button"
                      onClick={() => handleJobTitle(t)}
                      style={{
                        flex: 1, height: 38, border: '1px solid',
                        borderColor: jobTitle === t ? 'var(--accent)' : 'var(--border)',
                        borderRadius: 'var(--radius)',
                        background: jobTitle === t ? '#fff3e0' : '#fafafa',
                        color: jobTitle === t ? 'var(--accent)' : 'var(--text2)',
                        fontWeight: jobTitle === t ? 700 : 500,
                        fontSize: 13, cursor: 'pointer', transition: 'all 120ms',
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 담당자: 본사 고정 */}
              {jobTitle === '담당자' && (
                <div className="form-group">
                  <label>부서</label>
                  <input className="input" value="본사" readOnly
                    style={{ background: '#f0f0f0', color: 'var(--text2)' }} />
                </div>
              )}

              {/* 매니저: 점포명 → 지점명 */}
              {jobTitle === '매니저' && (
                <>
                  <div className="form-group">
                    <label>점포명 <span style={{ color: 'var(--danger)', fontSize: 11 }}>*필수</span></label>
                    <select className="input" value={department} onChange={e => handleDeptChange(e.target.value)} required>
                      <option value="">-- 점포명 선택 --</option>
                      {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>지점명 <span style={{ color: 'var(--danger)', fontSize: 11 }}>*필수</span></label>
                    <select className="input" value={branch} onChange={e => setBranch(e.target.value)}
                      required disabled={!department}
                      style={{ background: !department ? '#f0f0f0' : '#fff' }}>
                      <option value="">-- 지점명 선택 --</option>
                      {branchList.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* 이름 */}
              <div className="form-group">
                <label>이름</label>
                <input className="input" type="text" value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="실명 입력" required />
              </div>
            </>
          )}

          <div className="form-group">
            <label>이메일</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="이메일 주소" required />
          </div>
          <div className="form-group">
            <label>비밀번호
              {mode === 'signup' && <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 4 }}>(6자리 이상)</span>}
            </label>
            <input className="input" type="password" value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="비밀번호" required minLength={6} />
          </div>

          <button className="btn-auth" type="submit" disabled={loading}>
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입 신청'}
          </button>
        </form>

        {msg && <div className={`auth-msg ${msg.type}`}>{msg.text}</div>}

        {mode === 'signup' && !msg && (
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 14, lineHeight: 1.7 }}>
            회원가입 후 관리자 승인이 필요합니다.<br />
            승인 완료 후 로그인하실 수 있습니다.
          </p>
        )}
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
function AdminTab() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);

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
                  <td>
                    <button className="btn btn-success" onClick={() => approve(u.id)}>✓ 승인</button>
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
              <tr><th>이름</th><th>직책</th><th>점포명</th><th>지점명</th><th>이메일</th><th>권한</th><th>상태</th><th>가입일</th><th>권한 변경</th></tr>
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
                      : <button className="btn btn-s" style={{ fontSize: 11 }} onClick={() => setRole(u.id, 'user')}>일반으로</button>}
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
  const [brandId,   setBrandId]  = useState('');
  const [productId, setProdId]   = useState('');
  const [quantity,  setQty]      = useState(1);
  const [price,     setPrice]    = useState('');
  const [payment,   setPayment]  = useState('카드');
  const [memo,      setMemo]     = useState('');
  const [brands,    setBrands]   = useState([]);
  const [products,  setProducts] = useState([]);
  const [saving,    setSaving]   = useState(false);
  const [recentSales, setRecent] = useState([]);

  // 회원 연결
  const [memberMode,   setMemberMode]   = useState('none');   // 'none' | 'search' | 'new'
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults,setMemberResults]= useState([]);
  const [selectedMember,setSelMember]  = useState(null);
  const [searching,    setSearching]    = useState(false);
  // 신규 회원등록
  const [custName,    setCustName]    = useState('');
  const [custPhone,   setCustPhone]   = useState('');
  const [managerName, setManagerName] = useState('');

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
  }, []);

  useEffect(() => {
    if (!brandId) { setProducts([]); setProdId(''); setPrice(''); return; }
    supabase.from('products').select('*').eq('brand_id', brandId).order('name')
      .then(({ data }) => setProducts(data || []));
    setProdId(''); setPrice('');
  }, [brandId]);

  useEffect(() => {
    if (!productId) return;
    const prod = products.find(p => String(p.id) === String(productId));
    if (prod?.price) setPrice(prod.price);
  }, [productId, products]);

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase.from('sales')
      .select('*, brand:brands(name), product:products(name), customer:customers(name,phone)')
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setRecent(data || []);
  }, [profile.id]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  const resetForm = () => {
    setProdId(''); setQty(1); setPrice(''); setMemo(''); setPayment('카드');
    setCustName(''); setCustPhone(''); setManagerName('');
    setMemberMode('none'); setMemberSearch(''); setMemberResults([]); setSelMember(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!brandId)   { toast('브랜드를 선택해주세요', 'err'); return; }
    if (!productId) { toast('상품을 선택해주세요', 'err'); return; }
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
          joined_at: soldAt,
          name: custName.trim(),
          phone: custPhone,
          store_name: profile.department,
          branch_name: profile.branch,
          manager_name: managerName.trim() || null,
          created_by: profile.id,
        }).select().single();
        if (custErr) throw custErr;
        customerId = custData.id;
      }

      const { error } = await supabase.from('sales').insert({
        sold_at: soldAt,
        store_name: profile.department,
        branch_name: profile.branch,
        brand_id: Number(brandId),
        product_id: Number(productId),
        quantity: Number(quantity),
        price: Number(String(price).replace(/,/g, '')),
        payment,
        memo: memo.trim() || null,
        created_by: profile.id,
        customer_id: customerId,
      });
      if (error) throw error;

      const modeMsg = memberMode === 'search' ? '회원 적립 완료' : memberMode === 'new' ? '판매 + 회원등록 완료' : '판매 입력 완료';
      toast(modeMsg, 'ok');
      resetForm();
      fetchRecent();
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
          {/* 판매 정보 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:14, marginBottom:14 }}>
            <div>
              <label style={labelStyle}>판매날짜</label>
              <input type="date" value={soldAt} onChange={e => setSoldAt(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>브랜드</label>
              <select value={brandId} onChange={e => setBrandId(e.target.value)} style={inputStyle} required>
                <option value="">-- 브랜드 선택 --</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>상품</label>
              <select value={productId} onChange={e => setProdId(e.target.value)}
                style={{...inputStyle, background: !brandId ? '#f0f0f0' : '#fff'}} required disabled={!brandId}>
                <option value="">-- 상품 선택 --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>수량</label>
              <input type="number" min={1} value={quantity} onChange={e => setQty(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>판매가 (원)</label>
              <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} style={inputStyle} placeholder="0" required />
            </div>
            <div>
              <label style={labelStyle}>결제수단</label>
              <div style={{ display:'flex', gap:6, height:38, alignItems:'center' }}>
                {['카드','현금','기타'].map(p => (
                  <button key={p} type="button" onClick={() => setPayment(p)}
                    style={{ flex:1, height:36, border:'1px solid', cursor:'pointer', borderRadius:'var(--radius)',
                      borderColor: payment===p ? 'var(--accent)' : 'var(--border)',
                      background: payment===p ? '#fff3e0' : '#fafafa',
                      color: payment===p ? 'var(--accent)' : 'var(--text2)',
                      fontWeight: payment===p ? 700 : 500, fontSize:12 }}>{p}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>메모 (선택)</label>
            <input value={memo} onChange={e => setMemo(e.target.value)} style={inputStyle} placeholder="특이사항 입력..." />
          </div>

          {/* 회원 연결 섹션 */}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:14, marginBottom:14 }}>
            <div style={{ marginBottom:10, fontSize:13, fontWeight:600, color:'var(--text2)' }}>🙋 회원 연결</div>
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
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12,
                background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:14 }}>
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
                  <label style={labelStyle}>담당 매니저 이름</label>
                  <input value={managerName} onChange={e => setManagerName(e.target.value)}
                    style={inputStyle} placeholder="매니저 이름 입력" />
                </div>
              </div>
            )}
          </div>

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
function CustomerLookupPage() {
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
        <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:16 }}>
          {/* 회원 목록 */}
          <div className="card" style={{ maxHeight:700, overflowY:'auto' }}>
            <div className="card-label">조회 결과 ({customers.length}명)</div>
            {customers.map(c => (
              <div key={c.id} onClick={() => handleSelect(c)}
                style={{
                  padding:'10px 12px', borderRadius:'var(--radius)', cursor:'pointer', marginBottom:4,
                  background: selected?.id===c.id ? '#fff8e1' : 'var(--bg3)',
                  border: `1px solid ${selected?.id===c.id ? '#ffcc80' : 'transparent'}`,
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:600, fontSize:13 }}>{c.name}</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)' }}>{c.joined_at}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)', marginTop:2 }}>{c.phone}</div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                  <span className="badge badge-dept" style={{fontSize:10, marginRight:4}}>{c.store_name}</span>
                  <span className="badge badge-store" style={{fontSize:10}}>{c.branch_name}</span>
                </div>
                {c.manager_name && (
                  <div style={{ fontSize:11, color:'var(--accent)', fontWeight:600, marginTop:3 }}>
                    담당: {c.manager_name}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 구매 이력 */}
          <div className="card">
            {!selected ? (
              <div className="empty">왼쪽에서 회원을 선택하면 구매 이력이 표시됩니다</div>
            ) : (
              <>
                {/* 회원 정보 헤더 */}
                <div style={{ background:'#fafafa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                    <div style={{ fontSize:17, fontWeight:700 }}>{selected.name}</div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:13, color:'var(--text2)' }}>{selected.phone}</div>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, fontSize:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{color:'var(--text3)'}}>가입일</span>
                      <strong>{selected.joined_at}</strong>
                    </div>
                    <span style={{color:'var(--border2)'}}>|</span>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{color:'var(--text3)'}}>가입점포</span>
                      <span className="badge badge-dept">{selected.store_name}</span>
                      <span className="badge badge-store">{selected.branch_name}</span>
                    </div>
                    {selected.manager_name && (
                      <>
                        <span style={{color:'var(--border2)'}}>|</span>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{color:'var(--text3)'}}>담당 매니저</span>
                          <strong style={{color:'var(--accent)'}}>{selected.manager_name}</strong>
                        </div>
                      </>
                    )}
                    {selected.creator && (
                      <>
                        <span style={{color:'var(--border2)'}}>|</span>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{color:'var(--text3)'}}>입력자</span>
                          <span>{selected.creator.name}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {/* 구매 요약 */}
                  <div style={{ display:'flex', gap:12, marginTop:12 }}>
                    {[
                      { label:'총 구매건수', value: purchases.length + '건' },
                      { label:'총 구매수량', value: totalQty + '개' },
                      { label:'총 구매금액', value: totalAmt.toLocaleString() + '원' },
                    ].map(s => (
                      <div key={s.label} style={{ background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'7px 14px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600 }}>{s.label}</div>
                        <div style={{ fontSize:16, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 구매 이력 테이블 */}
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
                              <td>{p.brand?.name || '-'}</td>
                              <td>{p.product?.name || '-'}</td>
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
              </>
            )}
          </div>
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
  const [managerName, setManagerName] = useState('');
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
      store_name: profile.department,
      branch_name: profile.branch,
      manager_name: managerName.trim() || null,
      created_by: profile.id,
    });
    if (error) { toast('저장 실패: ' + error.message, 'err'); }
    else { toast('회원 등록 완료', 'ok'); setCustName(''); setPhone(''); setManagerName(''); fetchRecent(); }
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
              <label style={labelStyle}>담당 매니저 이름 <span style={{color:'var(--text3)',fontWeight:400}}>(인센티브 기준)</span></label>
              <input value={managerName} onChange={e => setManagerName(e.target.value)}
                style={inputStyle} placeholder="매니저 이름 입력" />
            </div>
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
              <tr><th>가입일</th><th>이름</th><th>연락처</th><th>담당 매니저</th><th>입력일시</th><th></th></tr>
            </thead>
            <tbody>
              {recentList.length === 0
                ? <tr><td colSpan={6} className="empty">입력된 고객이 없습니다</td></tr>
                : recentList.map(c => (
                  <tr key={c.id}>
                    <td className="mono">{c.joined_at}</td>
                    <td><strong>{c.name}</strong></td>
                    <td className="mono">{c.phone}</td>
                    <td style={{fontSize:12,color:'var(--accent)',fontWeight:600}}>{c.manager_name || '-'}</td>
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
// 브랜드/상품 관리 (관리자)
// ════════════════════════════════════════════════════════
function BrandMgmtPage() {
  const [brands,    setBrands]   = useState([]);
  const [products,  setProducts] = useState([]);
  const [selBrand,  setSelBrand] = useState(null);
  const [newBrand,  setNewBrand] = useState('');
  const [newProd,   setNewProd]  = useState('');
  const [newPrice,  setNewPrice] = useState('');

  const fetchBrands = useCallback(async () => {
    const { data } = await supabase.from('brands').select('*').order('name');
    setBrands(data || []);
  }, []);

  const fetchProducts = useCallback(async (brandId) => {
    if (!brandId) return;
    const { data } = await supabase.from('products').select('*').eq('brand_id', brandId).order('name');
    setProducts(data || []);
  }, []);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);
  useEffect(() => { if (selBrand) fetchProducts(selBrand.id); }, [selBrand, fetchProducts]);

  const addBrand = async () => {
    if (!newBrand.trim()) return;
    const { error } = await supabase.from('brands').insert({ name: newBrand.trim() });
    if (error) toast(error.message, 'err');
    else { toast('브랜드 추가 완료', 'ok'); setNewBrand(''); fetchBrands(); }
  };

  const deleteBrand = async (id) => {
    if (!window.confirm('브랜드와 해당 상품이 모두 삭제됩니다. 계속하시겠습니까?')) return;
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); fetchBrands(); if (selBrand?.id === id) { setSelBrand(null); setProducts([]); } }
  };

  const addProduct = async () => {
    if (!newProd.trim() || !selBrand) return;
    const { error } = await supabase.from('products').insert({ brand_id: selBrand.id, name: newProd.trim(), price: Number(newPrice) || 0 });
    if (error) toast(error.message, 'err');
    else { toast('상품 추가 완료', 'ok'); setNewProd(''); setNewPrice(''); fetchProducts(selBrand.id); }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('상품을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); fetchProducts(selBrand.id); }
  };

  const inputStyle = { height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16 }}>
      {/* 브랜드 목록 */}
      <div className="card" style={{ height:'fit-content' }}>
        <div className="card-label">브랜드</div>
        <div style={{ display:'flex', gap:6, marginBottom:14 }}>
          <input value={newBrand} onChange={e => setNewBrand(e.target.value)}
            style={{...inputStyle, flex:1}} placeholder="새 브랜드명" onKeyDown={e => e.key==='Enter' && addBrand()} />
          <button className="btn btn-p" onClick={addBrand}>추가</button>
        </div>
        {brands.map(b => (
          <div key={b.id} onClick={() => setSelBrand(b)}
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 10px', borderRadius:'var(--radius)', cursor:'pointer', background: selBrand?.id===b.id ? '#fff3e0' : 'transparent', marginBottom:2 }}>
            <span style={{ fontWeight: selBrand?.id===b.id ? 700 : 400, color: selBrand?.id===b.id ? 'var(--accent)' : 'var(--text)' }}>
              {b.name}
            </span>
            <button className="btn-danger" style={{ padding:'2px 8px', fontSize:11 }} onClick={e => { e.stopPropagation(); deleteBrand(b.id); }}>삭제</button>
          </div>
        ))}
        {brands.length === 0 && <div className="empty" style={{padding:20}}>브랜드 없음</div>}
      </div>

      {/* 상품 목록 */}
      <div className="card">
        <div className="card-label">{selBrand ? `${selBrand.name} 상품` : '브랜드를 선택하세요'}</div>
        {selBrand && (
          <>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              <input value={newProd} onChange={e => setNewProd(e.target.value)}
                style={{...inputStyle, flex:2}} placeholder="상품명" onKeyDown={e => e.key==='Enter' && addProduct()} />
              <input value={newPrice} onChange={e => setNewPrice(e.target.value)}
                style={{...inputStyle, width:120}} placeholder="기본가격" type="number" />
              <button className="btn btn-p" onClick={addProduct}>추가</button>
            </div>
            <div className="twrap">
              <table>
                <thead><tr><th>상품명</th><th className="r">기본가격</th><th></th></tr></thead>
                <tbody>
                  {products.length === 0
                    ? <tr><td colSpan={3} className="empty">등록된 상품이 없습니다</td></tr>
                    : products.map(p => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td className="r">{Number(p.price).toLocaleString()}원</td>
                        <td><button className="btn-danger" onClick={() => deleteProduct(p.id)}>삭제</button></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </>
        )}
        {!selBrand && <div className="empty">왼쪽에서 브랜드를 클릭하세요</div>}
      </div>
    </div>
  );
}

const MENUS = [
  { key: 'upload',          icon: '📊', label: '안전재고 현황' },
  { key: 'history',         icon: '🗂️', label: '업로드 이력' },
  { key: 'sales_list',      icon: '📋', label: '판매내역 조회' },
  { key: 'customer_lookup', icon: '🔍', label: '회원 조회' },
];
const MANAGER_MENUS = [
  { key: 'sales_input',    icon: '🛒', label: '판매 입력' },
  { key: 'customer_input', icon: '👤', label: '회원 등록' },
];
const ADMIN_MENUS = [
  { key: 'admin', icon: '👥', label: '사용자 관리' },
  { key: 'brand_mgmt', icon: '🏷️', label: '브랜드/상품 관리' },
];

function Sidebar({ page, setPage, profile, onLogout }) {
  const isAdmin    = profile?.role === 'admin';
  const isHQ       = profile?.job_title === '담당자';
  const isManager  = profile?.job_title === '매니저';
  const canSeeMain = isAdmin || isHQ;

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏬</div>
        <div className="sidebar-logo-text">백화점팀 재고관리</div>
        <div className="sidebar-logo-sub">대시보드</div>
      </div>
      <div className="sidebar-menu">
        {/* 본사/관리자 메뉴 */}
        {canSeeMain && (
          <>
            <div className="sidebar-section">본사</div>
            {MENUS.map(m => (
              <button key={m.key} className={`sidebar-item ${page===m.key?'on':''}`} onClick={() => setPage(m.key)}>
                <span className="sidebar-item-icon">{m.icon}</span>{m.label}
              </button>
            ))}
          </>
        )}
        {/* 매니저 메뉴 */}
        {(isManager || isAdmin) && (
          <>
            <div className="sidebar-section" style={{marginTop: canSeeMain ? 8 : 0}}>매장</div>
            {MANAGER_MENUS.map(m => (
              <button key={m.key} className={`sidebar-item ${page===m.key?'on':''}`} onClick={() => setPage(m.key)}>
                <span className="sidebar-item-icon">{m.icon}</span>{m.label}
              </button>
            ))}
          </>
        )}
        {/* 관리자 메뉴 */}
        {isAdmin && (
          <>
            <div className="sidebar-section" style={{marginTop:8}}>관리자</div>
            {ADMIN_MENUS.map(m => (
              <button key={m.key} className={`sidebar-item ${page===m.key?'on':''}`} onClick={() => setPage(m.key)}>
                <span className="sidebar-item-icon">{m.icon}</span>{m.label}
              </button>
            ))}
          </>
        )}
        {/* 접근 가능한 메뉴 없음 */}
        {!canSeeMain && !isManager && !isAdmin && (
          <div style={{ padding:'12px 10px', fontSize:12, color:'rgba(0,0,0,0.5)', lineHeight:1.7 }}>
            접근 가능한 메뉴가 없습니다.
          </div>
        )}
      </div>
      <div className="sidebar-bottom">
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
// MAIN APP
// ════════════════════════════════════════════════════════
export default function App() {
  useStyle(GLOBAL_CSS);

  const [session, setSession]         = useState(null);
  const [profile, setProfile]         = useState(null);
  const [authLoading, setAL]          = useState(true);
  const [page, setPage]               = useState('upload');

  // 페이지 이동해도 유지되는 업로드 상태
  const [parsed, setParsed]           = useState(null);
  const [filename, setFilename]       = useState('');
  const [activeUploadId, setActiveId] = useState(
    () => { const v = localStorage.getItem('gmd_active_id'); return v ? Number(v) : null; }
  );

  const setActiveUploadId = (id) => {
    setActiveId(id);
    if (id) localStorage.setItem('gmd_active_id', id);
    else localStorage.removeItem('gmd_active_id');
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setAL(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (!session) { setProfile(null); setAL(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { setProfile(data); setAL(false); });
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast('로그아웃 됐습니다', 'inf');
  };

  const isAdmin    = profile?.role === 'admin';
  const isHQ       = profile?.job_title === '담당자';
  const isManager  = profile?.job_title === '매니저';
  const canSeeMain = isAdmin || isHQ;

  const PAGE_TITLES = {
    upload:          '안전재고 현황',
    history:         '업로드 이력',
    sales_list:      '판매내역 조회',
    customer_lookup: '회원 조회',
    sales_input:     '판매 입력',
    customer_input:  '회원 등록',
    admin:           '사용자 관리',
    brand_mgmt:      '브랜드/상품 관리',
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
          </div>
          <div className="content-body">
            {(page === 'upload' || page === 'history') && !canSeeMain ? (
              <div className="empty">
                ⛔ 접근 권한이 없습니다.<br/>
                <span style={{fontSize:11}}>본사 담당자 또는 관리자만 이용할 수 있습니다.</span>
              </div>
            ) : null}
            {page === 'upload' && canSeeMain && (
              <UploadPage
                profile={profile}
                activeUploadId={activeUploadId}
                setActiveUploadId={setActiveUploadId}
                parsed={parsed}
                setParsed={setParsed}
                filename={filename}
                setFilename={setFilename}
              />
            )}
            {page === 'history' && canSeeMain && (
              <UploadHistoryPage
                profile={profile}
                activeUploadId={activeUploadId}
                setActiveUploadId={setActiveUploadId}
                setPage={setPage}
                setParsed={setParsed}
                setFilename={setFilename}
              />
            )}
            {page === 'admin'          && <AdminTab/>}
            {page === 'brand_mgmt'     && isAdmin && <BrandMgmtPage/>}
            {page === 'sales_input'    && (isManager || isAdmin) && <SalesInputPage profile={profile}/>}
            {page === 'customer_input' && (isManager || isAdmin) && <CustomerInputPage profile={profile}/>}
            {page === 'sales_list'     && canSeeMain && <SalesListPage/>}
            {page === 'customer_lookup'&& canSeeMain && <CustomerLookupPage/>}
          </div>
        </div>
      </div>
    </>
  );
}
