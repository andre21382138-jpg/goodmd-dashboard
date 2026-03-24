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
const MENUS = [
  { key: 'upload',  icon: '📊', label: '안전재고 현황' },
  { key: 'history', icon: '🗂️', label: '업로드 이력' },
];
const ADMIN_MENUS = [
  { key: 'admin', icon: '👥', label: '사용자 관리' },
];

function Sidebar({ page, setPage, profile, onLogout }) {
  const isAdmin   = profile?.role === 'admin';
  const isHQ      = profile?.job_title === '담당자'; // 본사 담당자
  const canSeeMain = isAdmin || isHQ;               // 안전재고·업로드이력 접근 가능

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏬</div>
        <div className="sidebar-logo-text">백화점팀 재고관리</div>
        <div className="sidebar-logo-sub">대시보드</div>
      </div>
      <div className="sidebar-menu">
        <div className="sidebar-section">메뉴</div>
        {canSeeMain && MENUS.map(m => (
          <button key={m.key} className={`sidebar-item ${page===m.key?'on':''}`} onClick={() => setPage(m.key)}>
            <span className="sidebar-item-icon">{m.icon}</span>{m.label}
          </button>
        ))}
        {!canSeeMain && (
          <div style={{ padding:'12px 10px', fontSize:12, color:'rgba(0,0,0,0.5)', lineHeight:1.7 }}>
            안녕하세요, {profile?.name || ''}님!<br/>
            현재 접근 가능한 메뉴가 없습니다.
          </div>
        )}
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

  const isAdmin   = profile?.role === 'admin';
  const isHQ      = profile?.job_title === '담당자';
  const canSeeMain = isAdmin || isHQ;

  const PAGE_TITLES = { upload: '안전재고 현황', history: '업로드 이력', admin: '사용자 관리' };

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
            {page === 'admin' && <AdminTab/>}
          </div>
        </div>
      </div>
    </>
  );
}
